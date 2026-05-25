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
- active short-lived break-glass investigation grant for table reads, exports, and sensitive-token consumption

When the flag is unset or false in production, DB explorer returns `DB_EXPLORER_DISABLED`.

### Sensitive GET/Export Guard

DB explorer GET table reads and exports remain compatible with the current dashboard fetch flow, but now apply an equivalent browser-origin defense:

- reject cross-site Fetch Metadata
- reject direct browser navigation mode
- require a configured dashboard origin in production
- require recent step-up before table/export data is returned

Admin > Audit security operations reads apply the same production origin/Fetch Metadata guard because they return recent security event details.

Configured hosted dashboard origins are allowed even when browsers classify the dashboard/API request as cross-site. Unknown origins and browser navigation attempts remain blocked.

## Operator Notes

- Keep `ENABLE_ADMIN_DB_EXPLORER=false` or unset by default on Railway.
- Temporarily enable it only for a specific owner/admin maintenance window.
- Confirm `CORS_ORIGIN` includes the hosted dashboard origin.
- Confirm `OWNER_TENANT_CODE` points to the definitive owner/admin tenant.
- Keep `OWNER_ADMIN_PASSKEY_STEP_UP_REQUIRED=true` in production so owner/admin privileged actions require phishing-resistant step-up.
- Use the DB Explorer investigation grant UI to record reason and ticket/case reference before table reads or exports. Grants expire server-side after `ADMIN_DB_BREAK_GLASS_TTL_MIN` minutes.
- Mount a Railway volume for uploaded assets and set `ASSET_ROOT` to that mount before relying on avatars/uploads across redeploys.
- Tune `PUBLIC_GATEWAY_QUOTA_MAX`, `PUBLIC_GATEWAY_QUOTA_WINDOW_SEC`, `PUBLIC_COMMERCE_QUOTA_MAX`, and `PUBLIC_COMMERCE_QUOTA_WINDOW_SEC` after observing real traffic.
- Do not place tenant connection API keys in URLs. Use the one configured endpoint plus the API key header value from Admin > Connections.

## Tests

Focused coverage lives in:

- `services/api/test/public_commerce_hardening.test.mjs`
- `services/api/test/tenant_isolation.test.mjs`
- `services/api/test/admin_db_explorer_security.test.mjs`
- `services/api/test/admin_security_ops.test.mjs`
- `services/api/test/password_lifecycle.test.mjs`
- `services/api/test/upload_security.test.mjs`
- `services/api/test/abuse_quota.test.mjs`
- `services/api/test/profile_avatar_persistence.test.mjs`
- `services/api/test/synthetic_validation_bot.test.mjs`

Run:

```text
npm --workspace @eip/core-api run test:security
```
