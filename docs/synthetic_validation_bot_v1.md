# EIP V1 Synthetic Validation Bot

Date: 2026-05-25

## Purpose

`tools/synthetic/v1_validation_bot.mjs` is a safe harness for validating live V1 behavior with realistic success, failure, replay, burst, and abuse-shaped requests. It labels requests with synthetic headers so the resulting security events are easy to filter in `Admin > Audit`.

The bot defaults to dry-run plan mode and local targets. It refuses hosted Railway targets unless explicitly allowed and scoped to a test tenant, tenant id, or connection suffix.

## Commands

Dry-run plan:

```bash
npm run synthetic:v1:plan
```

Run against a dedicated hosted test suffix:

```bash
SYNTHETIC_API_URL=https://eip-ecom-v1.up.railway.app \
SYNTHETIC_ALLOW_HOSTED=true \
SYNTHETIC_CONNECTION_SUFFIX=<test-connection-suffix> \
SYNTHETIC_PUBLIC_ORIGIN=<test-storefront-origin> \
npm run synthetic:v1:run
```

## Safe Defaults

- `mode=plan`
- target `http://localhost:4000`
- no public writes
- no authenticated control-plane actions
- no hosted Railway traffic without `SYNTHETIC_ALLOW_HOSTED=true`
- no hosted Railway traffic unless `SYNTHETIC_TEST_TENANT_CODE`, `SYNTHETIC_TEST_TENANT_ID`, or `SYNTHETIC_CONNECTION_SUFFIX` is set

## Supported Scenarios

| Scenario | Purpose | Safety |
| --- | --- | --- |
| `public-gateway-invalid` | Bad API key/origin gateway rejection | Safe default |
| `public-commerce-invalid` | Query-string API key rejection | Safe default |
| `replay-invalid` | Duplicate event-id behavior | Safe default with invalid key; valid replay requires opt-in |
| `tenant-request-burst` | Tenant request quota/rate validation | Requires `SYNTHETIC_ALLOW_PUBLIC_WRITES=true` |
| `auth-login-attempt` | Failed login/lockout behavior | Requires `SYNTHETIC_ALLOW_AUTH=true` and test identity inputs |
| `upload-reject` | Upload rejection/quarantine behavior | Requires session cookie and CSRF token |
| `api-key-lifecycle` | API key create/rotate/revoke audit flow | Requires `SYNTHETIC_ALLOW_CONTROL_PLANE=true`, session cookie, CSRF token, and test tenant id |

## Key Environment Variables

| Variable | Purpose |
| --- | --- |
| `SYNTHETIC_API_URL` | API origin, for example `https://eip-ecom-v1.up.railway.app` |
| `SYNTHETIC_DASHBOARD_ORIGIN` | Dashboard origin used for authenticated EIP requests |
| `SYNTHETIC_PUBLIC_ORIGIN` | Storefront/public origin used for gateway/commerce requests |
| `SYNTHETIC_CONNECTION_SUFFIX` | Dedicated test connection suffix |
| `SYNTHETIC_TEST_TENANT_CODE` / `SYNTHETIC_TEST_TENANT_ID` | Dedicated test tenant scope |
| `SYNTHETIC_SESSION_COOKIE` | Cookie header for authenticated scenarios only |
| `SYNTHETIC_CSRF_TOKEN` | CSRF header value for authenticated write scenarios only |
| `SYNTHETIC_RATE_PER_SEC` | Max request rate; capped by the bot |
| `SYNTHETIC_BURST` | Burst count; capped by the bot |
| `SYNTHETIC_SCENARIOS` | Comma-separated scenario list |

## Operator Use

1. Create or select a disposable test tenant/connection through the normal Admin UI path.
2. Run `npm run synthetic:v1:plan` first and confirm the target/scope.
3. Run a narrow scenario set, for example `SYNTHETIC_SCENARIOS=public-gateway-invalid,replay-invalid`.
4. Open `Admin > Audit` and filter recent events by the synthetic suffix, tenant, or event type.
5. Tune quotas only after checking false positives against real expected traffic.

The bot redacts secret-like headers in its own output and never prints raw API keys, cookies, CSRF tokens, signatures, or authorization headers.
