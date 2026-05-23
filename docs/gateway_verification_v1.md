# Gateway Verification V1

Date: 2026-05-24

This note documents how Admin > Connections verification settings are enforced at runtime for public gateway and public commerce traffic.

## Runtime Path

Public gateway:
1. Route entry: `services/api/src/routes/public_gateway.js`
2. Raw body capture: `services/api/src/services/gateway/rawBody.js`
3. Tenant/profile resolution by inbound suffix
4. Enabled/inbound/channel/method/content-type checks
5. Origin and IP allowlist checks
6. Verification mode enforcement: `services/api/src/services/gateway/verification.js`
7. Event id extraction and idempotency ledger
8. Gateway audit insert and response finalization

Public commerce:
1. Route entry: `services/api/src/routes/public_commerce.js`
2. Raw body capture: `services/api/src/services/gateway/rawBody.js`
3. Tenant/profile resolution by inbound suffix
4. Enabled/inbound/channel checks
5. Origin and IP allowlist checks
6. Verification mode enforcement: `services/api/src/services/gateway/verification.js`
7. Route-specific storefront/member/order/payment handling
8. Idempotency where the commerce operation requires event ids, such as subscribe, order, and payment

## Verification Modes

`api_key`
- Runtime reads only the configured header name.
- The configured secret is compared with a timing-safe comparison.
- Missing or wrong keys are rejected with `INVALID_API_KEY`.
- Browser storefronts can use this mode without putting HMAC secrets in frontend code.

`hmac_signature`
- Runtime requires a configured signature header, timestamp header, and secret.
- The timestamp is parsed for skew validation.
- The signature payload uses the exact timestamp header value plus the exact raw body when `payload_mode = timestamp_sha256`.
- Missing signatures, bad signatures, missing timestamps, invalid timestamps, and expired timestamps are rejected before intake.

`oauth2_jwt`
- Runtime requires the configured header and token prefix when a prefix is configured.
- Runtime validates issuer, audience, signature, `exp`, optional `nbf`, and optional `iat` max age.
- Tokens without `exp` are rejected.

`none`
- Runtime allows unverified requests only for sandbox connection profiles.
- Production profiles must use `api_key`, `hmac_signature`, or `oauth2_jwt`.

## Origin Rules

- Empty origin allowlists are accepted only for sandbox profiles.
- Wildcard origins are accepted only for sandbox profiles.
- Browser origins must exactly match configured origins.
- Server-to-server requests with no `Origin` header are allowed only when the allowlist explicitly includes `server` or `no-origin`.

## Replay and Idempotency

Public gateway inbound traffic requires an event id from the configured idempotency location/key. The idempotency ledger stores the raw-body hash:
- New event id: accepted and finalized.
- Same event id with same raw body: treated as an idempotent replay and returns the stored response.
- Same event id with different raw body: rejected with `IDEMPOTENCY_CONFLICT`.

Public commerce keeps route-specific idempotency for operations that create externally observable effects, including subscribe, order, and payment. Storefront reads and member session operations are verified by the same connection verifier but do not require gateway-style event ids globally.

## Test Coverage

Automated coverage is in:
- `services/api/test/gateway_verification.test.mjs`
- `services/api/test/public_gateway_runtime.test.mjs`

The tests cover:
- valid `api_key`, `hmac_signature`, and `oauth2_jwt` decisions
- missing signature
- bad signature
- expired timestamp
- wrong origin
- replayed event id with different raw body
- wrong suffix/profile routing

Run:

```bash
cd services/api
npm run test:gateway-verification
```
