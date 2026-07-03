# PayPal Checkout Lifecycle V1

## Scope

This lifecycle uses the existing payment provider registry, Gateway Connection Profiles, public commerce routes, payment service objects, sales-order service objects, and process engine. It does not add Checkout.com behavior.

The payment provider is the source of truth. A browser redirect, query parameter, or success screen cannot mark a payment paid or confirm an order.

## Outbound checkout flow

1. Samara creates a sales-order checkout source. When checkout payment metadata is present, the order is created as `pending_payment`, not confirmed.
2. Samara calls `POST /api/public/commerce/:storefront_suffix/checkout/payment-session` with the pending order reference, selected method, and selected provider.
3. EIP recalculates the payable amount from the stored order pricing snapshot. Browser-provided amounts are rejected.
4. EIP creates a `payment` service object and a PayPal order through the configured outbound connection.
5. PayPal opens in a separate tab. The original tab shows a pending state and polls the safe status endpoint.

Outbound checkout remains available when the optional webhook is disabled. Return capture can complete the payment without a webhook.

## Return URL flow

PayPal receives provider return URLs generated from the trusted storefront origin:

- success: the Samara URL with `eip_payment_status=approved` and `eip_payment_code=<payment>`
- cancel: the Samara URL with `eip_payment_status=cancelled` and `eip_payment_code=<payment>`

On an approval return, Samara calls `POST /api/public/commerce/:suffix/checkout/confirm`. EIP validates the stored PayPal order ID and calls the PayPal capture API server-side. Automatic capture is accepted as paid only when PayPal returns a capture record with status `COMPLETED`.

The return query string alone remains `PENDING`; it never marks a payment paid. Repeated returns are idempotent and an already-completed payment returns its persisted status without capturing again.

On cancellation, Samara calls `POST /api/public/commerce/:suffix/checkout/payment-session/:id/cancel`. The payment becomes cancelled and the order remains unpaid in `pending_payment`, allowing a later retry. A later verified PayPal capture/webhook can still supersede that browser cancellation.

## Status flow

Samara checks:

`GET /api/public/commerce/:suffix/checkout/payment-session/:id`

The response contains only safe lifecycle data:

- payment status and lifecycle state
- pending redirect/action, if applicable
- order code and order status
- safe reason code
- refund status and refunded amount

The original checkout tab polls for up to two minutes, then stops automatic polling and leaves a manual **Check payment status** action. It does not retain an infinite loading spinner.

## Order timing

The sales-order object is created before redirect only as a governed checkout source with status `pending_payment`. This preserves server-side pricing, inventory linkage, idempotency, and the payment-to-order relationship.

Only a verified PayPal capture changes:

- payment to `paid`
- order to `confirmed`
- payment/order `paid_at` metadata

PayPal approval, a browser success return, or `CHECKOUT.ORDER.APPROVED` webhook leaves the order pending.

## Webhook flow

The PayPal Gateway Connection Profile can enable an optional inbound webhook. When enabled, the profile requires:

- `inbound.webhook_enabled = true`
- a unique inbound path suffix
- the PayPal webhook ID in the safe `webhook_id_ref` field
- outbound PayPal OAuth credentials, used only by the backend

The Admin Console shows the copyable endpoint:

`POST /api/public/commerce/:paypal_connection_suffix/payments/paypal/webhook`

EIP verifies PayPal transmission headers by calling PayPal's server-side `verify-webhook-signature` API with the configured webhook ID. PayPal does not use a tenant-provided shared HMAC secret for this flow. Raw OAuth credentials and webhook payload secrets are never returned to either frontend.

Supported V1 events:

- `CHECKOUT.ORDER.APPROVED` → pending only
- `PAYMENT.CAPTURE.COMPLETED` → paid and order confirmed
- `PAYMENT.CAPTURE.PENDING` → pending
- `PAYMENT.CAPTURE.DENIED` / `DECLINED` → failed
- `PAYMENT.CAPTURE.REFUNDED` → partial/full refund calculation
- `PAYMENT.CAPTURE.REVERSED` → refunded
- refund pending/failed variants → refund pending/failed

Webhook transmission IDs are processed through the existing idempotency store before lifecycle changes. Duplicate delivery returns the stored response and does not apply a refund twice.

## Refund handling

V1 persists inbound PayPal refund state and safe event summaries:

- `refund_pending`
- `partially_refunded`
- `refunded`
- `refund_failed`

Refund amounts accumulate idempotently. When the accumulated verified refund reaches the original payment amount, payment and order become `refunded`; otherwise they are `partially_refunded`. The existing Admin Commerce payment/order views read these persisted status fields.

Refund initiation from EIP is deferred. V1 covers inbound PayPal refund detection and visibility only.

## Sandbox test steps

1. Configure a PayPal sandbox Gateway Connection Profile with REST app Client ID and securely stored client secret.
2. Save and run **Test outbound** until the connection is healthy.
3. Optionally create a PayPal sandbox webhook, enable inbound webhook, enter its webhook ID and a unique path suffix, then copy the Admin Console webhook URL into PayPal.
4. Enable PayPal for the tenant Commerce Settings.
5. Add an item in Samara, choose PayPal, and check out.
6. Complete payment in the new PayPal tab.
7. Confirm the return tab shows verified success and the original tab changes from pending to paid/confirmed.
8. Repeat with cancellation and a declined sandbox payment.
9. Send a duplicate sandbox webhook and verify no duplicate status/refund amount.
10. Exercise partial and full refund webhooks and verify Admin Commerce status.

## Production requirements

- Production PayPal REST application credentials stored through the server-side secret store
- HTTPS storefront origin and API
- healthy outbound connection in production mode
- exact PayPal webhook ID and unique inbound suffix when webhook is enabled
- PayPal production webhook configured with the displayed EIP URL
- provider events enabled for capture completion/failure and refunds
- database migration `0133_paypal_checkout_lifecycle_v1.sql` applied
- monitoring for `payment_process_sync_deferred`, webhook verification failures, unmatched webhook events, and failed captures
