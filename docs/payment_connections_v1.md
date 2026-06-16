# Payment Connections V1

Payment Connections V1 connects Samara checkout to payment provider readiness through the existing EIP control plane.

## Responsibility Model

Admin Console Connections stores the technical provider profile:

- connection kind: `paypal` or `checkout_com`
- provider code and payments channel routing
- sandbox or production environment
- outbound auth and webhook verification secret references
- safe public metadata such as supported payment methods and health status

Dashboard Settings stores user-facing commerce preferences:

- enable or disable `CARD`, `PAYPAL`, `GOOGLE_PAY`, and `APPLE_PAY`
- map methods to providers
- choose capture mode and default currency
- view readiness without viewing provider secrets

The public payment gateway reads both sources. Samara only receives safe method availability and never receives provider credentials.

## Provider And Method Model

`PAYPAL` is a provider connection and supports:

- `PAYPAL`

`CHECKOUT_COM` is a provider connection and supports:

- `CARD`
- `GOOGLE_PAY`
- `APPLE_PAY`

Google Pay and Apple Pay are wallet methods under the Checkout.com provider, not separate provider connections.

## Public Checkout Flow

Samara calls:

- `GET /api/public/checkout/payment-methods?suffix=<storefront-suffix>`
- `POST /api/public/checkout/payment-session?suffix=<storefront-suffix>`

`payment-methods` returns only safe public fields:

- method code
- provider code
- enabled flag
- available flag
- unavailable reason

`payment-session` accepts an order reference and method. Browser-supplied amounts are rejected; the API reads the stored sales order pricing snapshot and uses that server-side amount. If there is no safe order source, the endpoint fails closed with `checkout_source_missing`.

The legacy suffix commerce endpoints remain for compatibility.

## Webhooks

Webhook foundation routes are available at:

- `POST /api/public/payments/webhooks/paypal?suffix=<storefront-suffix>`
- `POST /api/public/payments/webhooks/checkout-com?suffix=<storefront-suffix>`
- `POST /api/public/commerce/:suffix/payments/:provider/webhook`

The route verifies provider signatures through the adapter. If verification is not configured or fails, the webhook is rejected and a sanitized event record is stored. When a provider event id is available, idempotency is enforced before accepting a normalized event.

## Secrets And Security

Provider secrets stay in Admin Console Connections and the connection secret vault. Public responses omit secret references, secret values, client secrets, tokens, card numbers, and raw payment credentials.

Samara stores no provider secrets and does not render hardcoded always-on payment methods.

## Deferred Live Setup

Before enabling live provider payments:

- create sandbox provider connections in Admin Console Connections
- store provider secrets through the existing secret reference flow
- configure webhook signing secrets
- verify provider health status
- enable methods in Dashboard Settings
- switch environment only after sandbox webhook and payment-session tests pass

Live mode is not enabled by this V1 branch.

## Migration Release Discipline

This module adds `services/api/db/migrations/0131_payment_connections_v1.sql`.

When this migration is intended to be run from Railway, it must be present on GitHub `main`, not only on `agent/payment-connections-v1`. Before telling the user to run migrations, confirm the file exists on GitHub `main` and report the resulting `main` SHA.
