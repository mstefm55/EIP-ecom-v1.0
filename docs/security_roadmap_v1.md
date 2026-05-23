# EIP V1 Security Roadmap

Date: 2026-05-24

Companion document: `docs/security_gap_matrix_v1.md`

This roadmap turns the security gap matrix into practical fix waves. It assumes the current goal is to make EIP V1 safe enough for a public hosted production baseline while keeping the validated Railway dashboard/API deployment working.

## P0 Before Production

1. Harden public commerce ingress to match the stricter public gateway model.
   - Disallow `verification.mode = none` for production connections unless the profile is explicitly sandbox-only and non-production.
   - Require non-empty production origin allowlists.
   - Reject wildcard production origins.
   - Apply JWT `exp`, `nbf`, `iat`, skew, and max-age validation as in `public_gateway.js`.
   - Evidence: `services/api/src/routes/public_commerce.js`, `services/api/src/routes/public_gateway.js`, `services/api/src/services/gateway/connectionProfile.js`.

2. Remove API keys from URL/query authentication paths.
   - Keep `Authorization: Bearer` and/or explicit key headers.
   - Reject `api_key` and `apiKey` query parameters in public gateway routes.
   - Evidence: `services/api/src/routes/public_gateway.js`.

3. Put the admin DB explorer behind an explicit production-safe gate.
   - Add a default-off production feature flag.
   - Require owner/admin tenant classification plus explicit permission.
   - Require recent step-up for table reads and exports, not just sensitive token consumption.
   - Convert export/table reads to POST with CSRF or add equivalent origin/Fetch Metadata checks for sensitive GETs.
   - Evidence: `services/api/src/server.js`, `services/api/src/routes/admin_db_explorer.js`.

4. Protect sensitive read/export routes from cross-site browser triggering.
   - Review every authenticated GET that returns sensitive tenant/admin data.
   - Add origin enforcement where GET returns sensitive material.
   - Prefer POST + CSRF for exports and sensitive operational reads.
   - Evidence: `services/api/src/server.js`, `services/api/src/routes/admin_db_explorer.js`, `services/api/src/lib/authCookies.js`.

5. Set default-safe audit redaction for gateway intake.
   - Redact `authorization`, `cookie`, API key headers, signature headers, tokens, secrets, and password-like payload fields by default.
   - Keep profile-specific redaction as an additive override.
   - Evidence: `services/api/src/routes/public_gateway.js`, `services/api/src/lib/securityAudit.js`.

## P1 Short-Term

1. Fix password lifecycle controls.
   - Compare a proposed password against historic Argon2 hashes with verifier calls instead of hash equality.
   - Replace generated password randomness with cryptographic random selection.
   - Add breached/common password screening.
   - Revisit NIST alignment for length, composition, and forced rotation.
   - Evidence: `services/api/src/auth/password.js`, `services/api/src/routes/auth.js`.

2. Make failed-login throttling durable and consistently wired.
   - Wire failed-attempt tracking into password, OTP, TOTP, and recovery login paths.
   - Replace process-local unlock timers with DB-enforced lock expiry.
   - Keep route-level rate limits as defense in depth.
   - Evidence: `services/api/src/auth/password.js`, `services/api/src/routes/auth.js`.

3. Strengthen admin MFA.
   - Require TOTP or a stronger authenticator for owner/admin sessions.
   - Consider WebAuthn/passkeys for phishing-resistant admin authentication.
   - Keep OTP email as a recovery or bootstrap channel rather than the strongest normal factor.
   - Evidence: `services/api/src/routes/auth.js`, `services/api/src/server.js`.

4. Add SSRF and egress controls for outbound gateway requests.
   - Deny private, loopback, link-local, metadata, and internal network targets.
   - Enforce HTTPS for production outbound profiles unless explicitly allowed.
   - Add DNS rebinding protections where possible.
   - Evidence: `services/api/src/routes/gateway.js`, `services/api/src/services/gateway/outbound.js`.

5. Add upload malware scanning.
   - Keep current extension/MIME/signature/path controls.
   - Add asynchronous malware scanning and quarantine state for tenant assets.
   - Do not publish assets until scan passes where the file type is user supplied.
   - Evidence: `services/api/src/lib/uploadSecurity.js`, `services/api/src/server.js`.

6. Add security regression tests.
   - Auth/session/CSRF.
   - Hosted cross-origin CORS.
   - Owner/admin versus tenant dashboard surface partitioning.
   - Public gateway and public commerce verification.
   - Tenant isolation/BOLA checks.
   - Upload rejection and signed asset access.

7. Add per-tenant and per-connection quotas.
   - Keep route-level rate limits.
   - Add tenant and connection aware ceilings for commerce, gateway, tenant request, upload, and auth abuse.
   - Evidence: `services/api/src/routes/public_gateway.js`, `services/api/src/routes/public_commerce.js`, `services/api/src/routes/tenant_requests_public.js`.

8. Improve recovery governance.
   - Document owner/admin recovery policy.
   - Add stronger audit trails for approvals, consumption, and device trust changes.
   - Require step-up for all recovery administration.
   - Evidence: `services/api/src/routes/auth.js`.

## P2 Maturity Hardening

1. Publish a machine-readable API inventory.
   - Generate OpenAPI or an equivalent route contract for EIP, public commerce, public gateway, and admin operations.
   - Track auth, tenant, CSRF, and rate-limit requirements per route.

2. Add CI security checks.
   - Dependency audit.
   - Secret scanning.
   - SAST/lint rules for query-string secrets, unsafe fetch targets, and unguarded admin routes.
   - Focused integration tests for the P0 controls.

3. Add operational monitoring and alerting.
   - Alert on repeated auth failures, recovery events, sensitive DB access, gateway verification failures, upload rejection spikes, and API key rotations.
   - Make audit redaction testable.

4. Run periodic access reviews.
   - Review admin roles and direct identity permissions.
   - Review tenant connection profiles and API keys.
   - Review owner/admin tenant membership.

5. Tighten browser policies as the app stabilizes.
   - Remove unnecessary `unsafe-inline` style allowances when feasible.
   - Review CORP/COEP/CSP settings for dashboard and public tenant assets.

6. Add incident response runbooks.
   - API key compromise.
   - Admin account compromise.
   - Gateway replay/abuse.
   - Malicious upload.
   - Tenant data exposure.

## Recommended Execution Order

1. Public commerce verification/origin/JWT hardening.
2. Query-string API key removal.
3. Admin DB explorer production gate and sensitive GET/export hardening.
4. Gateway audit redaction defaults.
5. Password history, failed-login throttling, and generated-secret randomness.
6. Admin MFA enforcement policy.
7. SSRF/egress controls for outbound gateway.
8. Upload malware scanning/quarantine.
9. Security regression test suite.
10. Machine-readable API inventory and CI security checks.

## Production Gate

EIP V1 should not be considered production-ready for broad public tenant traffic until all P0 items are closed and retested against the live hosted dashboard/API and external gateway/commerce deployment model.
