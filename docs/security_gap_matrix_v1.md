# EIP V1 Security Gap Matrix

Date: 2026-05-24

Scope: code-level review of the EIP V1 API, auth/session handling, gateway/public commerce routes, admin console control plane, upload handling, tenant onboarding, and dashboard client request helpers. This is an evidence baseline, not a penetration test, and it does not assert live Railway variable values.

Benchmarks used:
- OWASP ASVS 5.0: https://github.com/OWASP/ASVS
- OWASP API Security Top 10 2023: https://owasp.org/API-Security/editions/2023/en/0x10-api-security-risks/
- NIST SP 800-63B: https://pages.nist.gov/800-63-4/sp800-63b.html

Status vocabulary:
- `implemented`: control is present in code for the reviewed path.
- `partial`: control exists but is incomplete, unevenly applied, or lacks production guardrails/tests.
- `missing`: no meaningful implementation was found in the reviewed path.

Risk vocabulary:
- `critical`: should be closed before public production use.
- `high`: should be prioritized in the next hardening wave.
- `medium`: meaningful maturity or defense-in-depth gap.
- `low`: acceptable for baseline, track for hygiene.

## Matrix

| Control area | Benchmark source | Current EIP status | Evidence file(s) | Risk level | Recommended fix wave |
|---|---|---:|---|---:|---|
| Security headers, CSP, HSTS, global request limits | OWASP ASVS 5.0 security configuration; OWASP API8:2023 | implemented | `services/api/src/server.js` | low | P2 maturity hardening |
| Internal dashboard/API CORS deny wildcard and require configured origins | OWASP ASVS 5.0 CORS/security configuration; OWASP API8:2023 | implemented | `services/api/src/server.js`, `services/api/src/config.js` | low | P2 maturity hardening |
| Browser origin and Fetch Metadata guard for EIP state-changing requests | OWASP ASVS 5.0 CSRF/session; OWASP API8:2023 | implemented | `services/api/src/server.js` | low | P2 maturity hardening |
| Cross-origin session cookie policy for hosted dashboard/API | OWASP ASVS 5.0 session management; NIST SP 800-63B session binding | implemented | `services/api/src/lib/authCookies.js`, `services/api/src/routes/auth.js`, `apps/dashboard/src/services/apiClient.js` | medium | P1 short-term |
| CSRF token validation for EIP state-changing session routes | OWASP ASVS 5.0 CSRF; OWASP API5:2023 | implemented | `services/api/src/server.js`, `apps/dashboard/src/services/apiClient.js` | medium | P1 short-term |
| Sensitive read/export operations protected against browser-initiated cross-site GETs | OWASP ASVS 5.0 CSRF/data protection; OWASP API3/API5:2023 | implemented | `services/api/src/routes/admin_db_explorer.js`, `services/api/src/routes/admin_monitoring.js` | low | P0 closed in Prompt 8 |
| Admin DB explorer production exposure | OWASP ASVS 5.0 access control/data protection; OWASP API3/API5/API8:2023 | implemented | `services/api/src/config.js`, `services/api/src/routes/admin_db_explorer.js`, `apps/dashboard/src/components/admin/AdminDbExplorer.jsx` | low | P0 closed in Prompt 8 |
| Admin DB explorer sensitive table masking and sensitive-token gate | OWASP ASVS 5.0 sensitive data protection; OWASP API3:2023 | partial | `services/api/src/routes/admin_db_explorer.js` | high | P1 short-term |
| Tenant-scoped permission checks for admin control plane | OWASP ASVS 5.0 access control; OWASP API1/API5:2023 | partial | `services/api/src/auth/perm.js`, `services/api/src/routes/admin_access.js`, `services/api/src/routes/gateway.js`, `services/api/src/routes/admin_template_clone.js` | high | P1 short-term |
| Surface partitioning between owner admin and tenant dashboard sessions | OWASP ASVS 5.0 access control; OWASP API5:2023 | implemented | `services/api/src/lib/surfaceAccess.js`, `services/api/src/routes/auth.js`, `services/api/src/routes/ui_surface.js`, `apps/dashboard/src/App.jsx` | medium | P1 short-term |
| API key storage for EIP integration keys | OWASP ASVS 5.0 secret storage; OWASP API2:2023 | implemented | `services/api/src/server.js`, `services/api/src/routes/gateway.js` | low | P2 maturity hardening |
| Public gateway API key accepted in URL query string | OWASP ASVS 5.0 secret handling; OWASP API2/API8:2023 | implemented | `services/api/src/routes/public_gateway.js`, `services/api/test/tenant_isolation.test.mjs` | low | P0 closed in Prompt 8 |
| Public gateway inbound verification, origin rules, HMAC timestamp, JWT lifetime checks, idempotency | OWASP ASVS 5.0 API/web service; OWASP API2/API4/API8:2023 | implemented | `services/api/src/routes/public_gateway.js`, `services/api/src/services/gateway/idempotency.js`, `services/api/src/services/gateway/connectionProfile.js` | medium | P1 short-term |
| Public commerce origin allowlist enforcement | OWASP ASVS 5.0 CORS/API; OWASP API8:2023 | implemented | `services/api/src/routes/public_commerce.js`, `services/api/src/services/gateway/connectionProfile.js`, `services/api/test/public_commerce_hardening.test.mjs` | low | P0 closed in Prompt 8 |
| Public commerce verification mode restrictions | OWASP ASVS 5.0 API authentication; OWASP API2/API5/API8:2023 | implemented | `services/api/src/routes/public_commerce.js`, `services/api/src/services/gateway/verification.js`, `services/api/test/public_commerce_hardening.test.mjs` | low | P0 closed in Prompt 8 |
| Public commerce JWT expiry, not-before, issued-at, and max-age validation | OWASP ASVS 5.0 token validation; OWASP API2:2023; NIST SP 800-63B authenticator/session freshness | implemented | `services/api/src/routes/public_commerce.js`, `services/api/src/services/gateway/verification.js`, `services/api/test/public_commerce_hardening.test.mjs` | low | P0 closed in Prompt 8 |
| Public commerce order/payment/member write idempotency | OWASP API4/API6:2023 | partial | `services/api/src/routes/public_commerce.js`, `services/api/src/services/gateway/idempotency.js` | high | P1 short-term |
| Public tenant request abuse resistance | OWASP API4/API6:2023 | partial | `services/api/src/routes/tenant_requests_public.js` | medium | P1 short-term |
| Per-tenant quotas beyond in-memory route rate limits | OWASP API4/API6:2023 | partial | `services/api/src/server.js`, `services/api/src/routes/public_gateway.js`, `services/api/src/routes/public_commerce.js` | high | P1 short-term |
| Outbound gateway SSRF and egress controls | OWASP API7/API10:2023; OWASP ASVS 5.0 SSRF/unsafe API consumption | partial | `services/api/src/routes/gateway.js`, `services/api/src/services/gateway/outbound.js`, `services/api/src/services/gateway/connectionProfile.js` | high | P1 short-term |
| Gateway audit redaction defaults for headers/query/raw body | OWASP ASVS 5.0 logging/privacy; OWASP API10:2023 | partial | `services/api/src/routes/public_gateway.js`, `services/api/src/services/gateway/audit.js`, `services/api/src/lib/securityAudit.js` | high | P1 short-term |
| Password hashing for EIP auth credentials | NIST SP 800-63B memorized secrets; OWASP ASVS 5.0 password storage | implemented | `services/api/src/routes/auth.js` | low | P2 maturity hardening |
| Password policy alignment with NIST guidance | NIST SP 800-63B memorized secrets | partial | `services/api/src/auth/password.js`, `services/api/src/routes/auth.js` | medium | P1 short-term |
| Password reuse prevention | NIST SP 800-63B; OWASP ASVS 5.0 credential lifecycle | partial | `services/api/src/auth/password.js`, `services/api/src/routes/auth.js` | high | P1 short-term |
| Failed login throttling and account lockout durability | NIST SP 800-63B online guessing resistance; OWASP ASVS 5.0 authentication | partial | `services/api/src/auth/password.js`, `services/api/src/routes/auth.js` | high | P1 short-term |
| Admin MFA and step-up | NIST SP 800-63B authenticator assurance; OWASP ASVS 5.0 reauthentication | partial | `services/api/src/routes/auth.js`, `services/api/src/server.js` | high | P1 short-term |
| TOTP secret protection | NIST SP 800-63B OTP authenticators; OWASP ASVS 5.0 secret storage | implemented | `services/api/src/config.js`, `services/api/src/routes/auth.js` | medium | P1 short-term |
| Account recovery controls | NIST SP 800-63B account recovery; OWASP ASVS 5.0 authentication recovery | partial | `services/api/src/routes/auth.js` | high | P1 short-term |
| Upload path safety, MIME/extension/signature validation, and file size limits | OWASP ASVS 5.0 file upload; OWASP API8:2023 | partial | `services/api/src/server.js`, `services/api/src/lib/uploadSecurity.js`, `services/api/src/routes/auth.js`, `services/api/src/routes/public_commerce.js`, `services/api/src/routes/admin_access.js` | high | P1 short-term |
| Malware scanning or content disarm for uploaded tenant assets | OWASP ASVS 5.0 file upload; OWASP API8:2023 | missing | `services/api/src/lib/uploadSecurity.js`, `services/api/src/server.js` | high | P1 short-term |
| Signed asset access for tenant upload paths | OWASP ASVS 5.0 access control/data protection | implemented | `services/api/src/server.js`, `services/api/src/services/assets/signing.js`, `services/api/src/services/assets/url_policy.js` | medium | P1 short-term |
| Production debug route disablement | OWASP ASVS 5.0 security configuration; OWASP API8:2023 | implemented | `services/api/src/server.js`, `services/api/src/config.js` | low | P2 maturity hardening |
| Feature flags for high-risk operational tools | OWASP ASVS 5.0 security configuration; OWASP API8:2023 | implemented | `services/api/src/config.js`, `services/api/src/routes/admin_db_explorer.js` | low | P0 closed in Prompt 8 |
| Public/API inventory and machine-readable contract | OWASP API9:2023 | partial | `services/api/src/routes/*`, `docs/DEVELOPER_MANUAL.md` | medium | P2 maturity hardening |
| Security regression tests for auth, CORS, CSRF, tenant isolation, gateway verification, and uploads | OWASP ASVS 5.0 verification; OWASP API1/API2/API5/API8:2023 | implemented | `services/api/test/*.mjs`, `tools/security/static_security_checks.mjs`, `.github/workflows/security-gates.yml` | low | P1 baseline added in Prompts 7-8 |
| Secret generation quality for generated passwords | NIST SP 800-63B random secret quality | partial | `services/api/src/auth/password.js` | medium | P1 short-term |
| Consent/version capture for tenant onboarding | NIST SP 800-63B privacy references; OWASP ASVS 5.0 privacy/data handling | implemented | `services/api/src/config.js`, `services/api/src/routes/tenant_requests_public.js`, `services/api/src/routes/privacy.js` | medium | P1 short-term |

## Highest-Risk Gaps

Prompt 8 closed the original P0 public commerce, query-string API key, DB explorer, and sensitive admin-read browser-trigger gaps. Remaining highest-risk gaps are:

1. Gateway audit payloads can include request headers, query values, and raw body unless redaction policy is configured.
2. Outbound gateway testing/execution accepts tenant-configured URLs without explicit SSRF/egress denylisting.
3. Password reuse prevention compares hashes directly and is ineffective for salted Argon2 hashes.
4. Upload handling validates type/signature/path but does not perform malware scanning or content disarm.
5. Failed-login throttling and lockout behavior still need durable DB-backed enforcement across all auth paths.
6. Owner/admin MFA policy remains staged and should move to phishing-resistant enforcement after passkey rollout verification.
7. Per-tenant and per-connection quotas beyond route-local rate limits are still needed for production abuse control.
8. Outbound provider credential use needs continued egress and audit review.
9. Public/API machine-readable route inventory is not yet generated.
10. Incident response runbooks are not yet tracked for API key compromise, admin compromise, gateway abuse, malicious upload, and tenant data exposure.

## Notes

- The strongest existing areas are the EIP session/CSRF foundation, configured-origin CORS, HSTS/CSP, DB-backed sessions with idle timeout, hashed API keys, signed tenant asset URLs, and a strict public gateway path.
- The biggest immediate risk is not that EIP lacks security controls. It is that the controls are uneven across similar ingress surfaces, especially `public_gateway` versus `public_commerce`.
- This matrix should be updated after each hardening wave and after any live configuration review.
