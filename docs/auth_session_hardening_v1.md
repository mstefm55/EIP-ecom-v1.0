# EIP Auth And Session Hardening V1

## Summary

This wave raises EIP from OTP/TOTP-only step-up toward a staged phishing-resistant posture. Existing password, OTP, and TOTP login paths remain available, while passkeys can now be enrolled and used for login or step-up.

## Current Controls

- Server-side sessions in `eip_auth.auth_session`.
- Session cookies are HttpOnly.
- Hosted cross-origin cookies continue to use the existing `AUTH_COOKIE_CROSS_SITE` policy.
- CSRF uses a cookie/header value checked against a server-side hash.
- OTP and TOTP continue to work as high-assurance step-up.
- Password-only login remains low assurance and is blocked for admin identities.
- Device rows are tenant/identity scoped in `eip_auth.auth_device`.

## New Passkey Path

New API endpoints:

- `GET /api/eip/auth/passkeys`
- `POST /api/eip/auth/passkeys/register/options`
- `POST /api/eip/auth/passkeys/register/verify`
- `POST /api/eip/auth/passkeys/login/options`
- `POST /api/eip/auth/passkeys/login/verify`
- `POST /api/eip/auth/passkeys/step-up/options`
- `POST /api/eip/auth/passkeys/step-up/verify`
- `POST /api/eip/auth/passkeys/:passkeyId/revoke`

Registration requires an authenticated EIP session, CSRF, and recent step-up. Login and step-up require user verification from the authenticator. Successful passkey auth marks the session as:

```json
{
  "assurance": "phishing_resistant",
  "step_up_method": "passkey",
  "step_up_phishing_resistant": true
}
```

## Session Policy Defaults

Defaults are tightened for new deployments:

- `SESSION_IDLE_TTL_MIN=15`
- `SESSION_ABSOLUTE_TTL_HOURS=4`
- `STEP_UP_TTL_MIN=5`
- `DEVICE_COOKIE_TTL_DAYS=14`
- `REQUIRE_TRUSTED_DEVICE=true`
- `AUTH_AUTO_TRUST_ON_STEP_UP=true`

Existing Railway variables override defaults, so confirm live values during rollout.

## Privileged Mutation Step-Up

The following high-risk paths now use privileged step-up:

- Admin > Connections profile and secret mutations.
- Gateway API key create, rotate, revoke.
- Inbound/outbound connection tests.
- Template clone execution.

Set this variable after owner/admin passkeys are enrolled:

```bash
REQUIRE_PASSKEY_FOR_PRIVILEGED_ACTIONS=true
```

When enabled, those privileged mutations require passkey-backed step-up, not just OTP/TOTP.

## Device Trust

The staged default preserves the existing OTP/TOTP login path by trusting a browser after successful step-up.

For the stricter top-tier posture, set `AUTH_AUTO_TRUST_ON_STEP_UP=false` after owner/admin passkeys are enrolled. In that mode, new browser devices are not trusted after OTP/TOTP when a trusted device already exists, unless:

- the auth method is passkey,
- the flow is approved recovery, or
- there is no existing trusted device.

## Recovery Hardening

- Password reset consumes the reset token and revokes active sessions for that identity.
- Recovery token consumption revokes existing sessions before issuing the recovery session.
- Recovery approval/rejection remains CSRF and step-up protected.

## Rollout Order

1. Deploy API and run `npm run migrate`.
2. Confirm `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN`.
3. Enroll owner/admin passkeys.
4. Test passkey step-up on an existing session.
5. Test passkey login from the dashboard origin.
6. Enable `REQUIRE_PASSKEY_FOR_PRIVILEGED_ACTIONS=true` for the API service.
7. Retest Connections and Template Clone mutations.

## Railway Variables

Recommended hosted values:

```text
WEBAUTHN_RP_ID=eip-dashboard.up.railway.app
WEBAUTHN_RP_NAME=EIP
WEBAUTHN_ORIGIN=https://eip-dashboard.up.railway.app
STEP_UP_TTL_MIN=5
SESSION_IDLE_TTL_MIN=15
SESSION_ABSOLUTE_TTL_HOURS=4
DEVICE_COOKIE_TTL_DAYS=14
REQUIRE_TRUSTED_DEVICE=true
AUTH_AUTO_TRUST_ON_STEP_UP=true
REQUIRE_PASSKEY_FOR_PRIVILEGED_ACTIONS=false
```

After passkeys are enrolled and tested:

```text
AUTH_AUTO_TRUST_ON_STEP_UP=false
REQUIRE_PASSKEY_FOR_PRIVILEGED_ACTIONS=true
```
