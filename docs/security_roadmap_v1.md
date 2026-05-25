# EIP V1 Security Roadmap

Date: 2026-05-24

Companion document: `docs/security_gap_matrix_v1.md`

This roadmap turns the security gap matrix into practical fix waves. It assumes the current goal is to make EIP V1 safe enough for a public hosted production baseline while keeping the validated Railway dashboard/API deployment working.

## P0 Before Production

Prompt 8 status: items 1-4 are closed in code and covered by focused API security tests. Public commerce now fails closed for production profiles without verification, empty production origin allowlists, wildcard production origins, and invalid JWT lifetime claims. Public gateway and public commerce reject query-string API keys. Admin DB explorer is default-off in production via `ENABLE_ADMIN_DB_EXPLORER`, requires owner/admin classification plus explicit DB permissions, applies origin/Fetch Metadata protections, and requires recent step-up for table reads and exports. Admin > Audit security operations reads also apply production origin/Fetch Metadata protection.

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

Gateway/control-plane hardening status: gateway audit payloads now redact sensitive headers, all query values, body secrets, and raw bodies by default; raw body capture requires both `audit.include_raw_body=true` and `audit.raw_body_safe=true`. Gateway outbound execution and Admin > Connections outbound tests now deny private, loopback, link-local, metadata, and internal targets, validate DNS answers, block URL credentials, and require HTTPS for production profiles. Sandbox profiles may use plain HTTP only when `outbound.allow_insecure_http=true` and the target is still public.

Residual hardening sweep status: password reuse now verifies the proposed plaintext against historic Argon2/scrypt hashes, generated passwords use cryptographic randomness, failed-login locks persist through `auth_failed_attempt` plus `auth_identity.attrs.auth_lock_expires_at`, owner/admin privileged production actions require phishing-resistant step-up, public gateway/commerce enforce security-event-backed tenant/connection quotas, and upload validation runs an inline V1 safety scan before assets are written.

Final V1 security closure status: all remaining gap-matrix `partial` controls have been closed for V1. Admin DB explorer sensitive access now uses server-side session grants rather than a raw sensitive-token cookie, masks broader credential/session/recovery fields, and emits sensitive-read/export/grant audit events. Admin control-plane tenant access is explicitly checked across users/modules/template-clone paths. Public commerce order/payment/member writes use consistent idempotency keys and finalize replay records on success and known errors. Public tenant requests now emit observable security events and durable IP/email-hash quota checks. Password policy is aligned to NIST-style length/blocklist/no-forced-rotation behavior. Recovery administration is owner/admin scoped and step-up protected. Uploads support inline blocking plus an external-required scanner/quarantine hook before publication.

1. Fix password lifecycle controls.
   - Compare a proposed password against historic Argon2 hashes with verifier calls instead of hash equality.
   - Replace generated password randomness with cryptographic random selection.
   - Status: verifier-based reuse prevention and cryptographic generation are implemented in the residual hardening sweep.
   - Status: implemented. Password policy now uses longer minimum length, common-password/pattern screening, no composition requirement, max length, verifier-based reuse checks, and no arbitrary forced rotation by default.
   - Evidence: `services/api/src/auth/password.js`, `services/api/src/routes/auth.js`.

2. Make failed-login throttling durable and consistently wired.
   - Wire failed-attempt tracking into password, OTP, TOTP, and recovery login paths.
   - Replace process-local unlock timers with DB-enforced lock expiry.
   - Keep route-level rate limits as defense in depth.
   - Status: implemented for EIP password, OTP, TOTP, and recovery flows with durable lock expiry.
   - Evidence: `services/api/src/auth/password.js`, `services/api/src/routes/auth.js`.

3. Strengthen admin MFA.
   - Require TOTP or a stronger authenticator for owner/admin sessions.
   - Consider WebAuthn/passkeys for phishing-resistant admin authentication.
   - Keep OTP email as a recovery or bootstrap channel rather than the strongest normal factor.
   - Status: owner/admin privileged production actions now require passkey/phishing-resistant step-up by default through `OWNER_ADMIN_PASSKEY_STEP_UP_REQUIRED`.
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
   - Status: implemented for V1. Inline scanning blocks EICAR and active-content payloads before write/publish. `UPLOAD_SCAN_MODE=external_required` quarantines uploads and only promotes them after a clean external scanner verdict.
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
   - Status: implemented for public gateway, public commerce, and public tenant requests using the existing security event stream. Upload rejection spikes are visible through security events and should be tuned operationally.
   - Evidence: `services/api/src/routes/public_gateway.js`, `services/api/src/routes/public_commerce.js`, `services/api/src/routes/tenant_requests_public.js`.

8. Improve recovery governance.
   - Document owner/admin recovery policy.
   - Add stronger audit trails for approvals, consumption, and device trust changes.
   - Require step-up for all recovery administration.
   - Status: implemented. Recovery request listing/approval/rejection is owner/admin-scoped, step-up protected for decisions, and audited.
   - Evidence: `services/api/src/routes/auth.js`.

## P2 Maturity Hardening

1. Publish a machine-readable API inventory.
   - Generate OpenAPI or an equivalent route contract for EIP, public commerce, public gateway, and admin operations.
   - Track auth, tenant, CSRF, and rate-limit requirements per route.
   - Status: baseline route contract published as `docs/api_inventory_v1.json`.

2. Add CI security checks.
   - Dependency audit.
   - Secret scanning.
   - SAST/lint rules for query-string secrets, unsafe fetch targets, and unguarded admin routes.
   - Focused integration tests for the P0 controls.
   - V1 baseline added in `docs/security_ci_gates_v1.md`: lockfile integrity checks, no-new-high/critical dependency audit gate, secret scanning, focused static checks, API security regression suite, and dashboard build smoke.

3. Add operational monitoring and alerting.
   - Alert on repeated auth failures, recovery events, sensitive DB access, gateway verification failures, upload rejection spikes, and API key rotations.
   - Make audit redaction testable.
   - V1 baseline added in `docs/security_operations_v1.md`: structured `eip_core.security_event` records, Admin > Audit summaries, gateway/auth/connection/recovery/bootstrap/upload event emission, and default redaction.

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
   - Status: baseline runbooks published as `docs/incident_response_runbooks_v1.md`.

## Recommended Execution Order

1. Public commerce verification/origin/JWT hardening.
2. Query-string API key removal.
3. Admin DB explorer production gate and sensitive GET/export hardening.
4. Gateway audit redaction defaults. Completed in gateway/control-plane hardening wave.
5. Password history, failed-login throttling, and generated-secret randomness. Completed in residual hardening sweep.
6. Admin MFA enforcement policy. Completed for owner/admin privileged production actions in residual hardening sweep.
7. SSRF/egress controls for outbound gateway. Completed in gateway/control-plane hardening wave.
8. Upload malware scanning/quarantine. Inline V1 scanner plus external-required quarantine hook completed.
9. Security regression test suite.
10. Machine-readable API inventory and CI security checks. API inventory baseline completed; CI security suite updated.

## Production Gate

EIP V1 has no remaining `partial` rows in the tracked security gap matrix after Prompts 1-8, the residual hardening sweep, and the final V1 closure sweep. Before broad public tenant traffic, retest the live Railway deployment, tune quota thresholds from real traffic, and set `UPLOAD_SCAN_MODE=external_required` plus `UPLOAD_SCAN_ENDPOINT` if the production policy requires third-party AV/CDR for accepted asset types.
