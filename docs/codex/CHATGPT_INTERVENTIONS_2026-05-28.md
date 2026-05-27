# ChatGPT Intervention Record — EIP Core V1

Date: 2026-05-28  
Scope: `mstefm55/EIP-ecom-v1.0` only  
Important boundary: this work is for the current V1 deployment/cloud-readiness branch. Do not treat it as V2 migration work.

## Purpose

This document records the direct GitHub interventions made by ChatGPT while Codex access was unavailable. It is intended as a handoff note for Codex so future work does not accidentally undo, duplicate, or misinterpret these changes.

## Core principles preserved

- Backend remains the authority for security, tenant lifecycle, bootstrap state, CSRF, step-up, RBAC, token validation, and tenant activation.
- Frontend only renders workflow state and dispatches backend actions.
- Bootstrap magic links are one-time and short-lived.
- Raw bootstrap tokens are not stored in the database.
- Privileged actions require session + CSRF + RBAC + a fresh step-up window.
- OTP, TOTP, and passkey are alternative step-up methods unless a route explicitly requests passkey-only mode.
- No V2 migration was performed.

## Commits made

### Tenant bootstrap magic link and expiry

- `76c59bd75d1fbf5549a9bfe849262255869c0202` — `Use secure magic link for tenant bootstrap`
  - File: `services/api/src/routes/tenant_requests_admin.js`
  - Changed bootstrap token TTL from 60 minutes to 48 hours.
  - Generated a magic link instead of exposing only a raw token in production email.
  - Production email now sends one-time bootstrap link.
  - Raw token/link is returned only outside production for local testing.
  - Production validates that bootstrap URL is HTTPS except localhost/dev.

- `51dae6c47e2312c7f1fe5424c83e849116a82c8a` — `Add bootstrap URL base configuration`
  - File: `services/api/src/config.js`
  - Added optional env variable: `BOOTSTRAP_URL_BASE`.
  - Expected production value example: `https://eip-dashboard.up.railway.app/bootstrap`.

### Bootstrap session API/client support

- `61648e8e6f76a4242241c05c81b0d06f5140c6a9` — `Support bootstrap session API responses`
  - File: `apps/dashboard/src/services/apiClient.js`
  - Added bootstrap consume/complete to session-mutating paths.
  - Added handling for `204 No Content` responses.

- `0f4ae2c7ffadcca3204114eb6042227fb0ce6269` — `Add dashboard bootstrap magic link flow`
  - File: `apps/dashboard/src/App.jsx`
  - Added an initial inline bootstrap flow in `App.jsx`.
  - Note: this inline flow is now superseded by the dedicated `BootstrapPage.jsx` route below, but still exists in `App.jsx` as legacy code.

### CSRF bootstrap fixes

- `fb07b4d7a7fbbeed4660225407294225f5a03d15` — `Expose CSRF cookie for bootstrap fallback`
  - File: `services/api/src/lib/authCookies.js`
  - Made CSRF cookie readable for double-submit CSRF fallback.
  - `sid` and `did` remain HttpOnly.
  - Security reasoning: CSRF value alone does not authenticate; backend still validates it against the server-side session hash.

- `80e64c92d4bbe289841867874cdd594cc9c29ddd` — `Read CSRF cookie when refresh endpoint is unavailable`
  - File: `apps/dashboard/src/services/apiClient.js`
  - Added client fallback to read CSRF cookie.
  - Later found insufficient in production because dashboard and API run on different Railway hostnames.

- `ac0193b42d192da62704f76449970e67063867af` — `Return CSRF token after bootstrap consume`
  - File: `services/api/src/routes/bootstrap.js`
  - Real production fix: `/api/eip/bootstrap/consume` now returns `csrf` and `csrfToken` in JSON response.
  - This allows the dashboard to cache and send `x-csrf` even when it cannot read the API cookie.
  - Backend still sets CSRF cookie and validates `x-csrf` against cookie + DB hash.

- `ff49e133ab198e62243e2460d846daa41167f731` — `Preserve bootstrap CSRF token after consume`
  - File: `apps/dashboard/src/services/apiClient.js`
  - Caches `csrf` / `csrfToken` returned by `/bootstrap/consume`.
  - Prevents immediate clearing of CSRF cache after bootstrap consume when response contains a fresh CSRF token.
  - Fix target: `POST /api/eip/bootstrap/totp/enroll` returning `CSRF_MISSING`.

### Tenant request board: prevent re-approval and add resend bootstrap link

- `15c3045d0a346b5154b769ae4f27a853c2b78a11` — `Prevent re-approving bootstrap pending requests`
  - File: `apps/dashboard/src/components/admin/TenantRequestBoard.jsx`
  - Prevented `BOOTSTRAP_PENDING` requests from being approved again.
  - Treated bootstrap/terminal states as non-rejectable in the UI.

- `7f45bb84de3a89effd35ac5f806361e1d6a32fa8` — `Add secure tenant bootstrap link resend`
  - File: `services/api/src/routes/tenant_requests_admin.js`
  - Added backend endpoint: `POST /api/eip/admin/tenant-requests/:id/resend-bootstrap`.
  - Only valid for `BOOTSTRAP_PENDING` tenant requests.
  - Requires EIP session, CSRF, privileged step-up, and `tenant.onboarding.approve` permission.
  - Rotates bootstrap token, stores only hash, resets expiry to 48 hours, sets `bootstrap_used_at = NULL`.
  - Revokes unfinished bootstrap sessions for that tenant admin.
  - Sends a new magic link email in production.
  - Returns raw token/link only outside production.
  - Emits audit event `tenant_onboarding.bootstrap_link_resent`.
  - Also changed approve endpoint to reject `BOOTSTRAP_PENDING` status.

- `e6df4f8669397078d9103ec8bc2b553d20e9768d` — `Render resend bootstrap link action`
  - File: `apps/dashboard/src/components/admin/TenantRequestBoard.jsx`
  - For `BOOTSTRAP_PENDING`, button now displays `Resend Bootstrap Link` instead of `Approve`.
  - Calls `POST /api/eip/admin/tenant-requests/:id/resend-bootstrap`.

### Step-up/passkey policy fix

- `bbf4b254cf74de40f1ad4a65650b274f0c1037df` — `Allow any valid method for privileged step-up`
  - File: `services/api/src/auth/privilegedStepUp.js`
  - Fixed bug where privileged actions still forced phishing-resistant/passkey step-up after OTP step-up.
  - New default policy: OTP, TOTP, and passkey are alternative methods; any one valid fresh method satisfies step-up.
  - Passkey-only remains possible only if a route explicitly calls `requirePrivilegedStepUp(app, req, { passkeyOnly: true })`.
  - Important: do not reintroduce owner-admin global passkey enforcement unless the user explicitly accepts passkey-only policy.

- `3500ff43727b0ec72efcaa54d0023d83f3aaea9f` — `Align step-up tests with alternative methods policy`
  - File: `services/api/test/session_policy.test.mjs`
  - Tests now confirm OTP, TOTP, and passkey each satisfy step-up by default.
  - Tests still confirm explicit passkey-only mode requires passkey-backed step-up.

### QR-based bootstrap TOTP setup

- `e113d16db49cbb6eec67cfd6bbbeece91a18b26c` — `Support QR-based bootstrap TOTP setup`
  - File: `apps/dashboard/src/components/auth/AuthTotpCard.jsx`
  - Reused existing TOTP QR component for bootstrap mode.
  - Added props including `hideCredentials`, `startFirst`, and `loading`.
  - Bootstrap mode hides email/organisation/password fields.
  - Confirm is disabled until enrollment/QR exists.
  - Uses backend `otpauth://` URI to generate QR code.

- `a68d17bbf3cd9c9b5d6f87131c4bdf5d6165cb19` — `Add QR-based bootstrap workflow page`
  - File: `apps/dashboard/src/pages/BootstrapPage.jsx`
  - Dedicated bootstrap page that:
    - consumes `/bootstrap?token=...` magic link,
    - removes token from URL,
    - sets admin password,
    - renders QR-based TOTP setup using `AuthTotpCard`,
    - confirms TOTP,
    - trusts device,
    - handles required agreements,
    - completes bootstrap.
  - This is the active bootstrap implementation after `main.jsx` routing change.

- `919034cf8caefc9b82b0dec11f00105058a468aa` — `Route bootstrap links to QR setup page`
  - File: `apps/dashboard/src/main.jsx`
  - Routes `/bootstrap` directly to `BootstrapPage` before loading the regular `App`.
  - This bypasses the older inline bootstrap block still present inside `App.jsx`.

## Current active behavior

### Tenant approval

1. Admin approves tenant request.
2. Backend creates tenant/admin identity as needed.
3. Backend creates one-time bootstrap token.
4. Backend stores only token hash in `eip_core.tenant_request.bootstrap_token_hash`.
5. Expiry is set to 48 hours.
6. Production sends a magic link email.
7. Dev/non-production response may include raw `bootstrapToken` and `bootstrapLink` for local testing.

### Bootstrap consume

1. User opens `/bootstrap?token=...`.
2. `BootstrapPage` calls `POST /api/eip/bootstrap/consume`.
3. Backend validates token hash, status, expiry, and used state.
4. Backend creates bootstrap session.
5. Backend sets `sid`, `csrf`, and `did` cookies.
6. Backend returns `csrf` and `csrfToken` in JSON response.
7. Frontend caches CSRF token and removes token from URL.

### Bootstrap TOTP setup

1. User clicks `Generate QR code`.
2. Frontend calls `POST /api/eip/bootstrap/totp/enroll` with `x-csrf`.
3. Backend returns `secret` and `uri`.
4. `AuthTotpCard` renders QR code from the `uri`.
5. User scans QR code and enters 6-digit code.
6. Frontend calls `POST /api/eip/bootstrap/totp/confirm`.
7. Backend activates TOTP credential.

### Resend bootstrap link

1. For `BOOTSTRAP_PENDING` tenant requests, UI shows `Resend Bootstrap Link`.
2. Backend rotates token and revokes unfinished bootstrap sessions for that tenant admin.
3. New link is valid for 48 hours.
4. Old link/session should no longer work.

### Step-up

Default privileged step-up is now:

```text
OTP OR TOTP OR passkey
```

Not:

```text
OTP then passkey
```

## Files touched

Backend:

- `services/api/src/routes/tenant_requests_admin.js`
- `services/api/src/config.js`
- `services/api/src/routes/bootstrap.js`
- `services/api/src/auth/privilegedStepUp.js`
- `services/api/src/lib/authCookies.js`
- `services/api/test/session_policy.test.mjs`

Frontend:

- `apps/dashboard/src/services/apiClient.js`
- `apps/dashboard/src/components/admin/TenantRequestBoard.jsx`
- `apps/dashboard/src/components/auth/AuthTotpCard.jsx`
- `apps/dashboard/src/pages/BootstrapPage.jsx`
- `apps/dashboard/src/main.jsx`
- `apps/dashboard/src/App.jsx` (legacy inline bootstrap block added earlier, now bypassed by `main.jsx` route)

## Required Railway / production env

Ensure the following are correct in Railway:

```text
BOOTSTRAP_URL_BASE=https://eip-dashboard.up.railway.app/bootstrap
AUTH_COOKIE_CROSS_SITE=true
CORS_ORIGIN=https://eip-dashboard.up.railway.app
```

Also ensure frontend hosting rewrites `/bootstrap` to the dashboard SPA entry point.

## Manual verification checklist

Codex or developer should verify after Railway deploy:

1. Submit tenant request.
2. Approve tenant request.
3. Email contains `/bootstrap?token=...` magic link.
4. Magic link opens dashboard bootstrap page.
5. Token disappears from URL after consume.
6. `POST /api/eip/bootstrap/consume` response includes `csrf` or `csrfToken`.
7. Set password succeeds.
8. Click `Generate QR code`.
9. `POST /api/eip/bootstrap/totp/enroll` sends `x-csrf` and does not return `CSRF_MISSING`.
10. QR code is displayed.
11. TOTP confirm succeeds with authenticator code.
12. Trust device succeeds.
13. Complete bootstrap succeeds and activates tenant.
14. `BOOTSTRAP_PENDING` request shows `Resend Bootstrap Link`, not `Approve`.
15. Resend rotates token and old link no longer works.
16. OTP step-up for privileged action does not require passkey afterward.
17. TOTP step-up for privileged action does not require passkey afterward.
18. Explicit passkey-only route, if any is created later, still requires passkey.

## Known cleanup / technical debt

- `apps/dashboard/src/App.jsx` still contains an older inline `BootstrapPage` implementation. It is no longer active for `/bootstrap` because `main.jsx` routes directly to `apps/dashboard/src/pages/BootstrapPage.jsx`. Codex should remove the old inline block later to reduce confusion, but only after confirming the dedicated page works in production.
- CSRF cookie was made readable as part of an earlier fallback. The effective production fix is now response-body CSRF from `/bootstrap/consume`. Codex may evaluate whether the readable CSRF cookie is still desired or whether to revert to HttpOnly once all flows depend on response-body/token refresh. Do not revert casually without testing bootstrap cross-domain behavior.
- Tenant request stats may still be calculated on the currently fetched filtered page. Earlier desired behavior was global summary independent of filters. If this is still not correct in UI, backend should provide a separate summary endpoint or unfiltered summary payload.
- The bootstrap flow is still a dedicated V1 page. A future engine/kernel-driven approach should expose a backend bootstrap state/manifest endpoint and render the workflow from descriptors.

## Do not regress

- Do not make `Approve` perform resend behavior.
- Do not allow approving `BOOTSTRAP_PENDING` again.
- Do not store raw bootstrap tokens.
- Do not log raw bootstrap tokens.
- Do not remove CSRF enforcement from bootstrap POST routes.
- Do not force passkey after OTP/TOTP step-up unless the route explicitly asks for passkey-only.
- Do not mix this V1 stabilization work with V2 migration.
