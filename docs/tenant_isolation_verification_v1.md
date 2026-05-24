# EIP Tenant Isolation Verification V1

## Purpose

This document records the current tenant and connection isolation controls that are testable in EIP V1. The goal is to make tenant separation auditable across the control plane, public gateway, storefront/member session paths, asset URLs, and owner/admin surface partitioning.

## Isolation Model

- Every authenticated EIP session carries `tenant_id`, `identity_id`, and `realm`.
- Owner/admin sessions are classified by `OWNER_TENANT_CODE`, with a fallback to tenant attr `tenant_kind = owner_admin`.
- Tenant organisation sessions are limited to the dashboard surface and must not administer other tenants.
- Connection profiles belong to a tenant through `tenant.attrs.connection_profiles`.
- Public gateway/storefront requests resolve tenant context from an API key or unique inbound suffix, then select a connection only within that resolved tenant.
- Member storefront sessions use realm `MEMBER` and the connection suffix; EIP owner/admin cookies do not satisfy member authentication.
- Tenant asset URLs are path-bound under `/assets/<tenant_id>/...` and signed over the canonical path plus expiry. Authenticated EIP fallback access is limited to the same tenant or owner/admin sessions.

## Verification Matrix

| Control area | Runtime evidence | Negative proof | Test coverage | Status |
| --- | --- | --- | --- | --- |
| Connections list scoping | `services/api/src/routes/gateway.js` filters `/gateway/connections` to caller tenant unless owner-admin classification succeeds. | Tenant A session sees only Tenant A connection rows. | `tenant connection list is tenant-scoped, while owner admin may inspect another tenant` | Implemented |
| Connections target scoping | `services/api/src/routes/gateway.js` uses `requireConnectionTargetAccess` before read/write/test/API-key mutations on `:tenantId`. | Tenant A cannot GET or POST Tenant B connection profile routes. | `tenant connection control plane blocks tenant A from tenant B connections` | Implemented |
| Owner/admin administration | `services/api/src/lib/surfaceAccess.js` classifies owner/admin via `OWNER_TENANT_CODE` or owner tenant kind. | Owner/admin session may inspect another tenant only after permission and owner classification. | `tenant connection list is tenant-scoped, while owner admin may inspect another tenant` | Implemented |
| Public gateway API key routing | `services/api/src/routes/public_gateway.js` resolves API key to one tenant, then searches selected connection within that tenant's profiles. | Bad key is rejected; Tenant A key cannot select Tenant B connection code. | `public gateway API key cannot select another tenant's connection and rejects bad keys/origins` | Implemented |
| Public gateway suffix routing | `services/api/src/routes/public_gateway.js` resolves inbound suffix through tenant connection profiles and rejects missing/duplicate suffixes. | Wrong suffix returns `ROUTING_NOT_FOUND`; duplicate suffix path returns conflict. | Existing `public gateway rejects wrong suffix/profile routing`; matrix test covers wrong connection code. | Implemented |
| Origin allowlist | `services/api/src/services/gateway/verification.js` and public route guards enforce per-profile origins. | Wrong browser origin is rejected before handshake/intake. | Existing `public gateway rejects expired timestamps and wrong origins before intake`; matrix test covers bootstrap origin rejection. | Implemented |
| Storefront member realm isolation | `services/api/src/routes/public_commerce.js` requires member sessions to match tenant, realm `MEMBER`, and connection suffix. | Owner EIP session id presented as `member_sid` is treated as unauthenticated. | `owner EIP session cookie cannot authenticate as a storefront member` | Implemented |
| Signed asset tenant boundary | `services/api/src/services/assets/signing.js` signs canonical path and expiry; `services/assets/access.js` limits authenticated fallback; `url_policy.js` enforces tenant path on storage. | Tenant A asset token cannot validate for Tenant B path; tenant B EIP session cannot access Tenant A asset; storing cross-tenant media path throws. | `signed asset URLs and stored media paths are tenant-bound` | Implemented |
| Authenticated surface partitioning | `services/api/src/routes/ui_surface.js` uses `resolveEipSurfaceAccess` before returning admin/dashboard surfaces. | Owner/admin cannot render dashboard; tenant org cannot render admin. | Covered by current surface classifier behavior and prior live hardening; not duplicated in this matrix test file. | Implemented |

## Test Matrix

Run:

```bash
cd services/api
npm test
```

Focused tests added in `services/api/test/tenant_isolation.test.mjs`:

- Tenant A cannot read Tenant B connection details.
- Tenant A cannot write Tenant B connection profile.
- Tenant connection list is filtered to the session tenant.
- Owner/admin can inspect a tenant after owner classification.
- Public gateway rejects invalid API key.
- Public gateway rejects selecting a connection code outside the resolved tenant.
- Public gateway rejects wrong origin for a valid tenant connection.
- Storefront member auth ignores owner/admin EIP sessions.
- Signed asset tokens cannot be replayed against another tenant path.
- Authenticated EIP asset fallback allows same tenant and owner/admin only.
- Cross-tenant asset paths cannot be stored as tenant media.

Existing supporting tests:

- `services/api/test/public_gateway_runtime.test.mjs`
  - wrong suffix/profile routing
  - wrong origin
  - missing/bad HMAC
  - replay/idempotency conflict
- `services/api/test/gateway_verification.test.mjs`
  - API key, HMAC, OAuth JWT verification modes
  - production origin wildcard rejection
  - production unverified-mode rejection

## Audit Notes

The audit found one control-plane gap before this verification pass: tenant users with `tenant.connection.*` permissions could target another tenant id in Admin > Connections routes because permission was checked against the caller's session tenant while the route operated on `:tenantId`.

The fix keeps owner/admin administration intact while enforcing:

```text
target tenant == session tenant
OR
session is owner/admin by authoritative surface classifier
```

All connection profile, secret, test, and API-key mutations now pass through this target-tenant check.

## Residual Review Items

- Database row-level security is not currently the enforcement layer; application route guards are the active boundary.
- Owner/admin cross-tenant access is intentionally allowed and depends on `OWNER_TENANT_CODE` being configured correctly in hosted environments.
- Public gateway duplicate suffix detection exists at runtime; operationally, Admin > Connections should continue preventing duplicate suffix creation before deploy-time usage.
