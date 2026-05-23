# Cross-Origin Auth Cookie Check (V1 finding, V2 must verify)

## Purpose

This note records a likely cross-origin authentication/session persistence issue discovered during the live Railway restore of EIP V1.

It must also be checked explicitly in **V2** so the same class of issue is not repeated.

## Observed Behavior

After successful OTP login:
- the dashboard/admin surface appears briefly
- then the app rolls back to the auth surface

This suggests that authentication appears to succeed initially, but subsequent authenticated API calls do not retain the session correctly.

## Current V1 Deployment Shape

Cross-origin hosted deployment:
- dashboard origin: `https://eip-dashboard.up.railway.app`
- api origin: `https://eip-ecom-v1.up.railway.app`

Frontend uses credentialed fetch requests to the API.

## Evidence / Likely Cause

The likely root cause identified during review was:

- OTP/session cookies are being set successfully
- but auth cookies were configured with `SameSite=Lax`
- in a cross-origin dashboard -> API deployment, this likely prevents cookies from being sent consistently on credentialed fetch requests

The likely production-safe hosted fix is:
- `SameSite=None`
- `Secure=true`

with local dev kept workable through environment-sensitive handling.

## Relevant V1 Areas To Check

- `services/api/src/routes/auth.js`
- `services/api/src/server.js`
- `apps/dashboard/src/App.jsx`
- `apps/dashboard/src/components/admin/AdminShell.jsx`
- `apps/dashboard/src/services/apiClient.js`

## Why The Rollback Happens

The reviewed interaction pattern was:
1. OTP verify succeeds
2. frontend redirects toward dashboard/admin
3. subsequent `whoami` / session-dependent call fails as unauthenticated
4. admin/dashboard shell then sends the user back to auth

So the visible symptom is not primary login failure.
It is likely **post-login session cookie non-persistence across origins**.

## V2 Mandatory Check

V2 must explicitly verify all of the following whenever UI and API are split across origins/subdomains:

1. session cookie policy for hosted deployment
2. CSRF cookie policy for hosted deployment
3. device cookie policy for hosted deployment
4. whether `SameSite=Lax` is still present where cross-origin fetch auth is required
5. whether cookie policy is environment-driven and deployment-aware
6. whether frontend credentialed fetch requests align with the cookie policy
7. whether auth success is followed immediately by a `whoami` / bootstrap check that can expose hidden cookie persistence issues

## V2 Guardrail

For V2, cross-origin auth/session behavior must be treated as a first-class deployment check, not just a local smoke-test concern.

This issue class should be included in:
- auth hardening review
- hosted deployment checklist
- post-login bootstrap validation
- drift checks for dashboard/API split deployment

## Status

Recorded as an architecture/runtime check item.

At the time of writing, this note is a saved finding and review target.
It does not by itself confirm that the final cookie patch has already been applied.
