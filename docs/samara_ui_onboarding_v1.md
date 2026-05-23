# Samara V1 External Gateway Onboarding And Frontend Deployment

This is the operational path for connecting the real Samara Vite frontend to EIP V1. Samara must be created and connected through the product UI, not through DB seed/reseed helpers.

Samara is an external storefront, not an internal EIP dashboard surface. It must not call `/api/eip/*`, must not depend on owner/admin dashboard cookies, and must not be added as a dashboard CORS origin. EIP feeds Samara through public/gateway read contracts, and Samara feeds EIP through connection-profile governed public commerce and gateway intake contracts.

## Source Of Truth

- Tenant request: public Auth surface, backed by `POST /api/public/tenant-requests`.
- Admin approval: Admin Console > Tenant Requests, backed by `POST /api/eip/admin/tenant-requests/:id/approve`.
- Bootstrap: existing bootstrap token flow under `/api/eip/bootstrap/*`.
- Template clone: Admin Console > Templates, backed by `POST /api/eip/admin/template-clone`.
- Connection setup: Admin Console > Connections, backed by `POST /api/eip/gateway/connections/:tenantId/profile`.
- Public storefront reads/feed: Samara calls `/api/public/commerce/:suffix/...`.
- Public gateway bootstrap/manifest: Samara may call `/api/public/gateway/bootstrap` and `/api/public/gateway/manifest/...` when an Admin-created gateway API key is configured.
- External intake: Samara or a Samara-side server may send events to `/api/public/gateway/intake/:suffix` using the profile's verification and idempotency settings.

## Operational Sequence

1. Open the public Auth surface and submit a tenant request for Samara.
   - Use the real Samara legal name, contact email, country, timezone, and required consent fields.
   - This creates a `tenant_request`; it does not create a live connected storefront by itself.

2. Log in to the owner/admin tenant and approve the Samara request.
   - Go to Admin Console > Tenant Requests.
   - Approve the Samara request after completing any required step-up.
   - The approval creates or associates the Samara tenant and sends or displays the bootstrap token.

3. Complete the Samara tenant bootstrap.
   - Use the bootstrap token flow to set the first tenant admin password, TOTP, agreements, and completion state.
   - After bootstrap, Samara is a normal live tenant, not a template and not a seeded shortcut.

4. Clone the ecommerce template through the Admin UI.
   - Go to Admin Console > Templates.
   - Select source template tenant `eip_ecom`.
   - Select the live Samara tenant as the target.
   - Run Clone template.
   - This copies the ecommerce baseline metadata through the UI-backed clone route.

5. Configure the Samara frontend connection through Admin > Connections.
   - Select the live Samara tenant.
   - Add or edit an inbound website/e-commerce connection.
   - Set Identity:
     - Connection name: `Samara Website`
     - Connection kind: `ecommerce` or `website`
     - Connection code: the code you will deploy as `VITE_EIP_CONNECTION_CODE`
     - Direction: `inbound`
     - Environment: `production`
     - Frontend URL: the Railway Samara frontend URL
   - Set Inbound:
     - Inbound path suffix: the value you will deploy as `VITE_EIP_SUFFIX`
     - Expected content type: `application/json`
     - Origin allowlist: the exact Samara frontend origin, for example `https://samara.example.com`
   - Set Security:
     - For browser storefront reads and browser-origin commerce writes, prefer exact origin allowlisting, rate limits, idempotency, and member CSRF where applicable.
     - If the profile uses API-key verification for browser-facing public commerce, deploy that browser-facing value as `VITE_EIP_COMMERCE_VERIFICATION_KEY` and the matching header as `VITE_EIP_COMMERCE_VERIFICATION_HEADER`.
     - Do not put HMAC/shared-signature secrets in the Vite frontend. Use a Samara-side server/edge function for HMAC or other true shared-secret signing.
     - Admin > Connections > API keys are separate from profile verification. A created API key may be deployed as `VITE_EIP_GATEWAY_API_KEY` for bootstrap/manifest checks.
   - Set Idempotency:
     - Location: `header`
     - Key: `X-Event-Id`
   - Save the profile and use the built-in inbound test where applicable.

6. Deploy the Samara Vite frontend with the saved connection values.
   - The frontend must use values from Admin > Connections.
   - Do not infer the suffix, connection code, or key from seed files.

## Railway Frontend Deployment

Use these settings for the Samara frontend service:

```text
Root directory: apps/samara-web/my-vite-react-app
Install command: npm ci
Build command: npm run build
Output directory: dist
```

Set these Railway variables from the UI-created connection:

```bash
VITE_EIP_GATEWAY_BASE_URL=https://eip-ecom-v1.up.railway.app
VITE_EIP_SUFFIX=<Admin Connections inbound path suffix>
VITE_EIP_CONNECTION_CODE=<Admin Connections connection code>
VITE_EIP_EVENT_ID_HEADER=X-Event-Id
VITE_EIP_CLIENT_SOURCE=web-client
VITE_EIP_EXTERNAL_REF_PREFIX=web
VITE_EIP_GATEWAY_API_KEY=<Admin Connections API key raw value, only if bootstrap/manifest is used>
VITE_EIP_GATEWAY_API_KEY_HEADER=X-API-Key
VITE_EIP_COMMERCE_VERIFICATION_KEY=<connection profile browser verification key, only if required>
VITE_EIP_COMMERCE_VERIFICATION_HEADER=X-API-Key
```

Keep `AUTH_COOKIE_CROSS_SITE=true` on the API service for hosted cross-origin member sessions.

Do not add Samara to `CORS_ORIGIN`. That variable is for internal `/api/eip/*` dashboard/admin callers. Add the Samara frontend origin to `CORS_ORIGIN_PUBLIC` for public onboarding/bootstrap routes, and add the exact same origin to the Samara connection profile's `origin_allowlist` in Admin > Connections for public commerce and gateway traffic.

## Retest Checklist

- Samara tenant request can be submitted from the Auth surface.
- Owner/admin can approve the request from Tenant Requests.
- Samara tenant bootstrap completes and the tenant admin can log in.
- Admin > Templates can clone `eip_ecom` into the Samara tenant.
- Admin > Connections can save the Samara inbound connection.
- Samara frontend deploy reads catalog/content metadata from `/api/public/commerce/:suffix`.
- One Samara write path sends `X-Event-Id` and the configured API key header.
- Samara does not call `/api/eip/*` and does not require an EIP dashboard session.
- Owner/admin tenant context does not leak into the Samara tenant.

## Explicit Non-Goals

- Do not recreate the removed `connection_profile_samara.sql` seed.
- Do not run `clone_template_to_tenant.sql` for Samara.
- Do not add or run a Samara seed/reseed stage.
- Do not claim Samara is live-connected until the UI flow above has been completed.
