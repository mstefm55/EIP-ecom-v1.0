# Payment Checkout Foundation V1

Status: implemented foundation
Date: 2026-06-03

## Purpose

This wave adds the first governed checkout loop for V1 ecommerce tenants:

```text
storefront order
-> checkout session
-> payment service_object
-> payment process flow
-> payment event + CRM signal
```

It does not implement inventory, accounting ledger, settlement reconciliation, or provider SDK UI.

## Provider Strategy

```text
Checkout.com = primary PSP foundation for card and wallet payments
PayPal = alternative checkout provider
Google Pay = wallet method through the primary PSP/provider
manual_test = sandbox-only development method
```

Live Checkout.com and PayPal adapters fail closed until real provider credentials, SDK behavior, and webhook normalization are implemented. They never return fake live payment success.

## Ownership Boundary

Admin Console > Connections owns technical trust:

```text
provider credentials
webhook verification secrets
environment
enabled/disabled state
origin allowlists
rate limits
secret rotation and revoke
```

Dashboard > Settings > Commerce / Payments owns tenant-local business preferences:

```text
enabled methods
default currency
capture mode
display labels
manual review threshold
optional provider connection selection
```

Storefront checkout owns operational usage:

```text
create checkout session
redirect/render provider checkout later
confirm sandbox manual test
poll/read payment status
```

CRM consumes payment facts only through `CRM_PAYMENT_SIGNAL`.

Dashboard > Orders & Payments > Payments owns operational payment work: payment records, capture, cancel,
refund request handoff, and payment follow-up. It must not collect provider credentials or tenant policy setup.

## Kernel Model

No new table was added.

| Capability | Kernel storage |
| --- | --- |
| Payment session/case | `eip_core.service_object` with `object_type='payment'` |
| Payment event/audit | `eip_core.info_record` with `record_type='ECOM_PAYMENT_EVENT'` |
| Webhook summary | `eip_core.info_record` with `record_type='ECOM_PAYMENT_WEBHOOK'` |
| CRM signal | `eip_core.info_record` with `record_type='CRM_PAYMENT_SIGNAL'` |
| Order/payment relationship | `eip_core.object_link` with `relation_type='PAYMENT_FOR'` |
| Payment preferences | `eip_core.tenant_module_setting` module `ecom`, code `commerce` |
| Provider readiness | `tenant.attrs.connection_profiles` through Admin Connections |

Raw card data, provider secrets, API keys, signatures, and tokens are not stored in payment metadata.

## Routes

Public storefront routes:

```text
GET  /api/public/commerce/:suffix/meta/checkout-config
POST /api/public/commerce/:suffix/checkout/session
GET  /api/public/commerce/:suffix/checkout/session/:id
POST /api/public/commerce/:suffix/checkout/confirm
POST /api/public/commerce/:suffix/payment
POST /api/public/commerce/:suffix/payments/:provider/webhook
```

`/payment` is retained as a compatibility alias for checkout session creation.

Authenticated operator routes:

```text
GET  /api/eip/commerce/payment-readiness
GET  /api/eip/commerce/payments
GET  /api/eip/commerce/payments/:id
POST /api/eip/commerce/payments/:id/capture
POST /api/eip/commerce/payments/:id/cancel
POST /api/eip/commerce/payments/:id/refund-request
```

Write routes require session, CSRF, RBAC, and tenant scoping.

## Payment Lifecycle

Payment records use the existing canonical `ECOM_PAYMENT_FLOW` for process authority:

```text
PAYMENT_AUTHORIZE
PAYMENT_CAPTURE
PAYMENT_FAIL
PAYMENT_CANCEL
```

Provider-facing status is stored as operational metadata under `attrs.payment_status`. Business status changes still go through the process engine.

## Governance Added

Migration `0106_payment_checkout_foundation.sql` adds:

```text
ECOM_PAYMENT_METHOD
ECOM_PAYMENT_PROVIDER
ECOM_PAYMENT_STATUS
ECOM_PAYMENT_EVENT_TYPE
ECOM_CAPTURE_MODE
```

Permissions:

```text
ECOM_PAYMENT_READ
ECOM_PAYMENT_WRITE
ECOM_PAYMENT_CAPTURE
ECOM_PAYMENT_REFUND_REQUEST
ECOM_PAYMENT_ADMIN
ECOM_PAYMENT_CONNECTOR_READ
```

Role-template grants are added for admin, universal, ecommerce, ecommerce-full, and read-only bundles. Future cloned tenants receive payment permissions through the governed role template path.

## Provider Adapter Boundary

Provider code lives under:

```text
services/api/src/services/payments/paymentFoundation.js
```

Adapters expose:

```text
createCheckoutSession
confirmCheckoutSession
capturePayment
cancelPayment
verifyWebhookSignature
normalizeWebhookEvent
getPaymentStatus
```

`manual_test` is sandbox-only. Checkout.com and PayPal placeholders fail closed with explicit errors.

## Storefront Behavior

Native storefronts fetch `/meta/checkout-config`. The response is secret-free and includes:

```text
methods
enabled_methods
ready_methods
default_currency
capture_mode
allowed_countries
```

Storefronts should show only `ready_methods` when present. Samara now creates checkout sessions and does not collect or post raw card details to EIP.

## Webhook Behavior

Webhook routes remain behind connection verification. Provider-specific webhook normalization is staged behind adapters. Until real provider verification is implemented, Checkout.com and PayPal webhook adapters fail closed and store only sanitized rejected summaries.

## Local Verification

```bash
cd services/api
npm run migrate
node --test test/payment_checkout_foundation.test.mjs
npm test
npm run test:security

cd ../../apps/dashboard
npm run build

cd ../samara-web/my-vite-react-app
npm run build
```

## Railway Test Sequence

1. Redeploy API.
2. In Railway API shell:

   ```bash
   cd services/api
   npm run migrate
   ```

3. Redeploy dashboard and Samara.
4. In Admin Console > Connections, configure payment provider profiles as needed.
5. In Dashboard > Settings > Commerce / Payments, enable only methods intended for the storefront and verify readiness.
6. Verify:

   ```text
   GET /api/public/commerce/{suffix}/meta/checkout-config
   ```

   returns `ready_methods`.
7. Create an order from the storefront, then create a checkout session.
8. For `manual_test`, confirm the session and verify Dashboard > Orders & Payments > Payments shows the payment.

## Known Limitations

```text
Checkout.com live session creation is not implemented yet.
PayPal live order/approval flow is not implemented yet.
Provider webhook normalization is not implemented yet.
Google Pay is modeled as a wallet method through Checkout.com but has no browser SDK integration yet.
No accounting ledger, settlement reconciliation, chargeback workflow, or inventory demand automation is included in this wave.
```

## Next Recommended Wave

Implement the real Checkout.com sandbox adapter first:

```text
hosted payment session creation
provider redirect/return handling
webhook signature verification
normalized provider events
capture/cancel/refund adapter operations
provider health diagnostics
```
