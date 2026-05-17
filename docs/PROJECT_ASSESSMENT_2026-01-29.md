# EIP Core Project Assessment (2026-01-29)

## Scope & baseline
- Date: 2026-01-29
- Working tree: master, with local changes and many untracked additions (see `git status -sb`).
- Baseline for regression comparison: **not provided**. Findings below are based on current working tree and documented expectations in `docs/DEVELOPER_MANUAL.md`.

## High-level observations
- The API surface expanded significantly (new routes, auth flows, gateway/tenant onboarding, public intake).
- Several security controls are temporarily disabled or missing gating.
- There are local artifacts containing cookies/tokens that are not ignored by git.

## Findings (flagged only — do not fix yet)

### Critical
1) **Sensitive cookie/token artifacts in repo**
   - Risk: local session cookies can leak if accidentally committed or shared; not ignored by git.
   - Evidence: `services/api/admin_cookies.txt`, `services/api/bootstrap_cookies.txt`, `services/api/cookies.tx`, `services/api/cookies.txt`, `services/api/core_process_cookies.txt`, `services/api/new_device_cookies.txt`, `services/api/tenant_admin_cookies.txt` (all untracked).
   - Status: **open (must address before any sharing/commit)**.

### High
2) **Tenant validation/audit for public static routes disabled**
   - Risk: `/public/:tenant/...` is served without tenant existence checks or audit logging; allows enumeration of tenant slugs and removes audit trail.
   - Evidence: `services/api/src/server.js:163` (preHandler fully commented out).
   - Status: **open (testing door; add closure note and re-enable before prod)**.

3) **Debug endpoint exposed to any authenticated session**
   - Risk: `/api/eip/_debug/whoami-shape` reveals auth/session shape to any logged-in user; no env/admin gating.
   - Evidence: `services/api/src/routes/_debug.js:3`, registered in `services/api/src/server.js:438`.
   - Status: **open (testing door; add closure note and restrict before prod)**.

4) **Electron auth cookies missing Secure/expiry attributes**
   - Risk: sessions created via electron flow lack `secure` flag (in production) and explicit expiry; inconsistent with browser flow and weaker cookie security.
   - Evidence: `services/api/src/routes/auth_electron.js:249-251`.
   - Status: **open (security regression)**.

### Medium
5) **Public DB health probe exposed**
   - Risk: `/api/public/health/db` performs live DB query and exposes DB availability; can be used for probing/amplification.
   - Evidence: `services/api/src/routes/health.js:20`.
   - Status: **open (testing door; restrict before prod)**.

6) **OTP printed to stdout in non-production**
   - Risk: OTP values appear in logs if `NODE_ENV` is not `production` (staging often runs as non-prod); OTP leakage risk if logs are shared.
   - Evidence: `services/api/src/routes/auth.js:278-280`.
   - Status: **open (testing door; restrict before prod)**.

### Low
7) **CRM GET endpoints require CSRF header**
   - Risk: read-only CRM GET calls now require CSRF tokens; may break clients and tooling; unusual for GET.
   - Evidence: `services/api/src/routes/crm.js:49-66`.
   - Status: **open (behavior regression)**.

8) **Frontend default API base URL set to 4000**
   - Risk: local setups expecting `3000` will fail without env override.
   - Evidence: `apps/samara-web/my-vite-react-app/src/services/api.js:4`.
   - Status: **open (behavior change)**.

## Documentation mismatches (manual vs code)
1) **Debug routes mismatch**
   - Manual lists `/api/eip/_debug/env`, `/api/eip/_debug/db`, `/api/eip/_debug/permissions`.
   - Code only defines `/api/eip/_debug/whoami-shape`.
   - Evidence: `docs/DEVELOPER_MANUAL.md` vs `services/api/src/routes/_debug.js`.

2) **Public tenant site validation described but currently disabled**
   - Manual implies tenant validation and audit logging for public static routes.
   - Code has the preHandler commented out.
   - Evidence: `docs/DEVELOPER_MANUAL.md`, `services/api/src/server.js:163`.

3) **Public health endpoint details differ**
   - Manual describes health endpoint with multi-service checks; code implements minimal `/health` and a public `/health/db` probe.
   - Evidence: `docs/DEVELOPER_MANUAL.md`, `services/api/src/routes/health.js`.

## Questions / required inputs
- What is the baseline for regression comparison (branch/commit/tag)?
- Are the cookie files intentionally kept locally for testing, or should they be moved out of repo + added to `.gitignore`?
- Should debug/health endpoints ever be accessible in production, or only behind admin + `NODE_ENV !== "production"` gating?
- Should CRM GET endpoints require CSRF, or revert to standard GET behavior?

## Next step (waiting on direction)
- I can walk each finding one by one and implement fixes after you confirm priority order and baseline.
