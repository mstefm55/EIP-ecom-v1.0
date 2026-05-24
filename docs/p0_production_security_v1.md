# EIP V1 P0 Production Security Gates

Date: 2026-05-24

## Closed Controls

### Public Commerce

Public commerce now uses the same runtime verification foundation as public gateway and adds an explicit production profile policy before business logic runs.

Production inbound connection profiles must:

- use `api_key`, `hmac_signature`, or `oauth2_jwt`
- have a non-empty `origin_allowlist`
- not use wildcard origin `*`
- pass the shared verifier, including JWT `exp`, `nbf`, `iat`, skew, and max-age rules

Sandbox profiles keep local/dev usability for `verification.mode = none` and wildcard origins.

### Query-String API Keys

Public gateway and public commerce reject `api_key` and `apiKey` query parameters. Tenant sites and integrations must send API keys through the configured explicit header or `Authorization: Bearer` where that path supports it.

### Admin DB Explorer

Admin DB explorer is default-off in production. To enable it temporarily for owner/admin operations, set:

```text
ENABLE_ADMIN_DB_EXPLORER=true
```

The route still requires:

- authenticated EIP session
- owner/admin tenant classification from `OWNER_TENANT_CODE` or owner tenant kind fallback
- explicit DB explorer permission such as `admin.db.read` or `admin.db.export`
- allowed dashboard origin / Fetch Metadata guard
- recent step-up for table reads and exports

When the flag is unset or false in production, DB explorer returns `DB_EXPLORER_DISABLED`.

### Sensitive GET/Export Guard

DB explorer GET table reads and exports remain compatible with the current dashboard fetch flow, but now apply an equivalent browser-origin defense:

- reject cross-site Fetch Metadata
- reject direct browser navigation mode
- require a configured dashboard origin in production
- require recent step-up before table/export data is returned

Admin > Audit security operations reads apply the same production origin/Fetch Metadata guard because they return recent security event details.

## Operator Notes

- Keep `ENABLE_ADMIN_DB_EXPLORER=false` or unset by default on Railway.
- Temporarily enable it only for a specific owner/admin maintenance window.
- Confirm `CORS_ORIGIN` includes the hosted dashboard origin.
- Confirm `OWNER_TENANT_CODE` points to the definitive owner/admin tenant.
- Do not place tenant connection API keys in URLs. Use the one configured endpoint plus the API key header value from Admin > Connections.

## Tests

Focused coverage lives in:

- `services/api/test/public_commerce_hardening.test.mjs`
- `services/api/test/tenant_isolation.test.mjs`
- `services/api/test/admin_db_explorer_security.test.mjs`
- `services/api/test/admin_security_ops.test.mjs`

Run:

```text
npm --workspace @eip/core-api run test:security
```
