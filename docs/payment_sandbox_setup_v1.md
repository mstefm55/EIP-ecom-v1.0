# Payment Sandbox Setup V1

Payment Sandbox Setup V1 prepares PayPal and Checkout.com test connections for Samara checkout without adding live credentials or enabling live payments.

## Control Plane

Admin Console Connections remains the technical control plane:

- PayPal connection kind: `paypal`
- Checkout.com connection kind: `checkout_com`
- mode: `sandbox` or `production`
- provider code and supported methods
- secret references and stored-secret status
- webhook signing metadata
- provider health status
- Apple Pay domain validation status for Checkout.com

Dashboard Settings remains the business toggle surface:

- enable or disable `PAYPAL`
- enable or disable `CARD`
- enable or disable `GOOGLE_PAY`
- enable or disable `APPLE_PAY`

Dashboard enablement does not override provider readiness. If a method is enabled but its provider is not configured, Samara receives `available: false` with a fail-closed reason.

## PayPal Sandbox Setup

In Admin Console Connections, create or update a `paypal` connection:

- set mode to `sandbox`
- keep routing channel as `payments`
- keep provider code as `paypal`
- store a PayPal sandbox client ID reference
- store the PayPal sandbox client secret through the existing secret vault flow
- store the webhook ID reference when available
- configure webhook signature metadata before accepting webhook events
- keep health status `pending` until a safe provider check has passed

No raw PayPal secret is shown again after save.

## Checkout.com Sandbox Setup

In Admin Console Connections, create or update a `checkout_com` connection:

- set mode to `sandbox`
- keep routing channel as `payments`
- keep provider code as `checkout_com`
- supported methods are `CARD`, `GOOGLE_PAY`, and `APPLE_PAY`
- store the Checkout.com sandbox secret key through the existing secret vault flow
- store public key or safe public config as a non-secret reference if needed
- store webhook signing secret through the existing secret vault flow
- set Apple Pay domain validation status only after domain validation is complete
- keep health status `pending` until a safe provider check has passed

Google Pay and Apple Pay are wallet methods under Checkout.com, not standalone provider connections.

## Samara Availability

Samara reads:

- `GET /api/public/checkout/payment-methods?suffix=<storefront-suffix>`

The response contains only safe fields:

- `methodCode`
- `providerCode`
- `label`
- `enabled`
- `available`
- `reason`
- `mode`
- `status`

Possible fail-closed reasons include:

- `provider_not_configured`
- `sandbox_credentials_missing`
- `payment_method_disabled`
- `domain_validation_missing`
- `provider_health_unknown`
- `provider_health_failed`
- `provider_disabled`

Samara must not render provider secrets and must not show always-on payment buttons.

## Payment Session Rules

Samara calls:

- `POST /api/public/checkout/payment-session?suffix=<storefront-suffix>`

Rules:

- browser-supplied amounts are rejected with `browser_amount_not_accepted`
- the backend requires a stored checkout, order, or cart source
- missing safe source returns `checkout_source_missing`
- disabled methods return `payment_method_disabled`
- missing provider connection returns `provider_not_configured`
- missing sandbox credentials return `sandbox_credentials_missing`
- no fake successful payment is returned

## Webhook Sandbox Notes

Webhook endpoints remain:

- `POST /api/public/payments/webhooks/paypal`
- `POST /api/public/payments/webhooks/checkout-com`

Webhook handling fails closed when signing secret references are missing, rejects invalid signatures, keeps idempotency by provider event id, and stores only sanitized event metadata.

## Deferred Before Live Mode

Before live mode:

- add real live provider secret references through Admin Console Connections
- complete provider health checks against live endpoints
- configure and verify webhook signing
- complete Apple Pay domain validation for live domain use
- confirm Dashboard Settings method enablement
- run sandbox payment-session and webhook checks successfully
- switch mode only after operational approval

Live mode is not enabled by this V1 branch.
