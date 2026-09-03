# Perfect Fit public gateway boundary

Perfect Fit is a browser-only Vite application. It does not hold EIP administrator credentials and it does not call the internal `/api/eip/*` surface. Product integration and member authentication use the existing public commerce connection boundary.

## Browser configuration

Configure the Perfect Fit frontend with exactly these connection values:

```text
VITE_EIP_ENDPOINT=https://<eip-api>/api/public/commerce/<connection-suffix>
VITE_EIP_API_KEY=<browser-safe connection API key>
```

The endpoint is copied from Admin > Connections and already contains the tenant-routing suffix. `VITE_EIP_API_KEY` is a browser credential, so it identifies an allowed storefront connection but never grants an EIP dashboard or administrator session.

The former `VITE_EIP_API_BASE_URL` is accepted only by local Vite development when `VITE_EIP_SUFFIX` is also present. Production builds require the canonical endpoint.

## Connection policy

The selected connection must be inbound or bidirectional, use exact production origins, use API-key verification, and enable:

- capability: `public_storefront.perfect_fit_enabled`
- read scope: `perfect_fit.products.read`
- write scope: `perfect_fit.products.write`

The API derives the tenant from the resolved connection. Tenant identifiers in browser payloads are neither required nor trusted.

## Authentication and authorization

Perfect Fit uses these member routes under the configured endpoint:

- `POST /member/auth/start`
- `POST /member/auth/verify`
- `GET /member/auth/me`
- `POST /member/auth/logout`

The member session is a `MEMBER` realm cookie bound to the connection suffix and tenant. All browser requests include credentials and `X-API-Key`. Product writes additionally require `X-Member-Csrf` from member authentication and a unique `X-Event-Id`.

An API key by itself is insufficient. It cannot create an EIP session, cannot authorize product access, and cannot open the dashboard.

## Perfect Fit product routes

All routes below are relative to `VITE_EIP_ENDPOINT`:

- `GET /perfect-fit/capability`
- `GET /perfect-fit/products`
- `GET /perfect-fit/products/:id`
- `GET /perfect-fit/products/:id/link`
- `POST /perfect-fit/products/register`
- `POST /perfect-fit/products/:id/link`
- `POST /perfect-fit/products/:id/sync`
- `DELETE /perfect-fit/products/:id/link`

Product responses are tenant-scoped projections. They exclude internal material attributes and private Perfect Fit technical data. Register, link, sync, and unlink reuse the same server-side Wave 1 service as the EIP administrator routes. Unlink remains soft and preserves both records. Shared-field authority and manual conflict rules remain defined by `PERFECT_FIT_SHARED_FIELD_POLICIES`.

## Security controls

Every route passes through connection resolution, exact-origin validation, API-key verification, connection quota/rate limiting, tenant derivation, member-session validation, and security audit logging. Writes add member CSRF and idempotency. Internal CORS and EIP admin permissions are not part of this browser contract.
