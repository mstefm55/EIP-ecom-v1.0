# EIP V1 Security Operations And Observability

Date: 2026-05-24

## Purpose

This document defines the V1 security operations baseline. It turns existing hardening controls into observable, tenant-aware events that can be used by admins and operators without exposing secrets, tokens, credentials, or raw sensitive headers.

## Event Store

Structured security events are written to `eip_core.security_event`.

Core event shape:

| Field | Purpose |
| --- | --- |
| `event_type` | Stable event key such as `gateway.verification_failed` |
| `category` | One of `auth`, `gateway`, `public_commerce`, `connection`, `recovery`, `bootstrap`, `onboarding`, `template`, `upload`, `tenant_isolation`, `security` |
| `severity` | `debug`, `info`, `warning`, `error`, or `critical` |
| `outcome` | `success`, `failure`, `denied`, `rejected`, `blocked`, `error`, or `observed` |
| `tenant_id` | Tenant most directly affected by the event |
| `actor_*` | Authenticated admin/user that performed the action, where applicable |
| `target_*` | Target tenant/user, where applicable |
| `connection_code` / `suffix` | Connection context for gateway/storefront events |
| `event_id` | External idempotency/event id when provided |
| `reason` | Machine-readable rejection or failure reason |
| `metadata` | Redacted extra context |

## Redaction

The security audit helper redacts sensitive keys recursively before logging or storing metadata. Default redacted keys include:

- `authorization`
- `cookie`
- `set-cookie`
- `x-api-key`
- `api_key` / `apiKey`
- `secret`
- `token`
- `password`
- `credential`
- `signature`
- `csrf`
- `sid`
- `did`
- `otp`
- `totp`
- `recovery`
- public/private key material

Long strings are truncated and buffers are summarized as byte counts.

Gateway intake audit payloads redact raw request bodies by default and store only a byte-count marker unless a connection explicitly opts into both `audit.include_raw_body = true` and `audit.raw_body_safe = true`. Query parameter values are redacted by default before gateway audit persistence.

## Emitted Events

### Auth And Passkeys

- `login_failure`
- `login_success`
- `auth.step_up_failed`
- `passkey.enrolled`
- `passkey.enrollment_failed`
- `passkey.login_success`
- `passkey.login_failed`
- `passkey.step_up_success`
- `passkey.step_up_failed`
- `passkey.revoked`
- `admin_passkey_revoke`

### Gateway And Public Commerce

- `gateway.intake_accepted`
- `gateway.query_api_key_rejected`
- `gateway.legacy_intake_query_api_key_rejected`
- `gateway.bootstrap_query_api_key_rejected`
- `gateway.manifest_query_api_key_rejected`
- `gateway.verification_failed`
- `gateway.origin_rejected`
- `gateway.ip_rejected`
- `gateway.idempotency_missing`
- `gateway.idempotency_rejected`
- `gateway.idempotency_replay`
- `gateway.rate_limited`
- `gateway.quota_exceeded`
- `gateway.payload_too_large`
- `gateway.handshake_denied`
- `commerce.query_api_key_rejected`
- `commerce.production_policy_rejected`
- `commerce.verification_failed`
- `commerce.origin_rejected`
- `commerce.ip_rejected`
- `commerce.quota_exceeded`
- `commerce.routing_not_found`
- `commerce.channel_not_allowed`

### Admin DB Explorer

- `admin_db_explorer.disabled`
- `admin_db_explorer.browser_guard_rejected`
- `admin_db_explorer.owner_admin_required`
- `admin_db_explorer.step_up_missing`
- `admin_db_explorer.sensitive_grant_created`
- `admin_db_explorer.sensitive_grant_rejected`
- `admin_db_explorer.sensitive_grant_cleared`
- `admin_db_explorer.sensitive_table_read`
- `admin_db_explorer.sensitive_export`
- `admin_db_explorer.break_glass_issued`
- `admin_db_explorer.break_glass_used`
- `admin_db_explorer.break_glass_rejected`
- `admin_db_explorer.break_glass_expired`
- `admin_db_explorer.break_glass_cleared`
- `admin_security_ops.browser_guard_rejected`

### Connections And Secrets

- `connection.profile_saved`
- `connection.profile_save_failed`
- `connection.api_key_created`
- `connection.api_key_rotated`
- `connection.api_key_revoked`
- `connection.secret_rotated`
- `connection.secret_revoked`
- `connection.secret_revoke_failed`
- `connection.duplicate_suffix_rejected`
- `tenant.connection_scope_forbidden`

### Onboarding, Bootstrap, Recovery, Templates

- `tenant_onboarding.approved`
- `tenant_onboarding.rejected`
- `tenant_request.submitted`
- `tenant_request.rate_limited`
- `bootstrap.consumed`
- `bootstrap.password_set`
- `bootstrap.totp_enabled`
- `bootstrap.device_trusted`
- `bootstrap.agreements_accepted`
- `bootstrap.completed`
- `recovery.token_requested`
- `recovery.request_created`
- `recovery.admin_rejected`
- `recovery.consume_failed`
- `recovery.consumed`
- `recovery.request_approved`
- `recovery.request_rejected`
- `template.clone_completed`

### Uploads

- `upload.rejected`
- `upload.scan_pending`

Upload scan modes:

| Setting | Purpose |
| --- | --- |
| `UPLOAD_SCAN_MODE=inline_blocking` | Default V1 behavior. Inline signature/active-content checks must pass before files are written to served asset paths. |
| `UPLOAD_SCAN_MODE=external_required` | Writes accepted files to quarantine first and promotes them only after `UPLOAD_SCAN_ENDPOINT` returns a clean verdict. If no clean verdict is available, the upload remains unpublished and the route returns `UPLOAD_SCAN_PENDING`. |
| `UPLOAD_SCAN_ENDPOINT` | Optional external AV/CDR scanner endpoint used when external-required mode is enabled. |
| `UPLOAD_SCAN_API_KEY` | Optional bearer token for the scanner endpoint. |
| `UPLOAD_SCAN_TIMEOUT_MS` | Scanner call timeout; defaults to 5000 ms. |

When `UPLOAD_SCAN_MODE=external_required`, accepted files are first written under an unserved quarantine directory with a sidecar JSON metadata file containing status, tenant, category, MIME, SHA-256, target path, and quarantine path. Files are promoted to `/assets/...` only after a clean scanner verdict.

Asset persistence:

| Setting | Purpose |
| --- | --- |
| `ASSET_ROOT` | Optional filesystem root for served tenant assets. Defaults to `services/api/assets`. On Railway, point this at a mounted persistent volume so profile avatars and tenant uploads survive redeploy/restart. |

## Admin Usage

Admin-facing API:

```text
GET /api/eip/admin/security/ops?window=24h
```

Supported windows:

- `24h`
- `7d`
- `30d`

Recent event pagination and lightweight filters:

| Query param | Purpose |
| --- | --- |
| `page` | 1-based page for `recent_events`; defaults to `1` |
| `page_size` | Recent events per page; defaults to `25`, max `100`; dashboard offers `12`, `25`, and `50` |
| `event_type` | Exact event type filter for recent events |
| `tenant` | Tenant id/code/name search for recent events |
| `outcome` | One of `success`, `failure`, `denied`, `rejected`, `blocked`, `error`, `observed` |
| `severity` | One of `debug`, `info`, `warning`, `error`, `critical` |

The dashboard renders `event_type` and `tenant` as dropdown filters populated from scoped `recent_event_filter_options` returned by the same route.

The route returns:

- summary counts
- top security failures
- per-tenant/per-connection health
- recent events
- recent event pagination metadata
- recent event filter options
- recommended alert thresholds

Recent event response shape:

```json
{
  "recent_events": [],
  "recent_events_pagination": {
    "page": 1,
    "page_size": 25,
    "total": 0,
    "total_pages": 0
  },
  "recent_event_filters": {
    "event_type": "",
    "tenant": "",
    "outcome": "",
    "severity": ""
  },
  "recent_event_filter_options": {
    "event_types": [
      { "value": "gateway.verification_failed", "label": "gateway.verification_failed", "count": 12 }
    ],
    "tenants": [
      { "value": "tenant-uuid", "label": "tenant_a", "code": "tenant_a", "name": "Tenant A", "count": 8 }
    ]
  }
}
```

Dashboard location:

```text
Admin > Audit
```

Recent events stay compact in the main list. Select an event to open the viewport-centered details modal with event identifiers, tenant/actor/target context, connection/suffix context, reason, outcome, severity, and redacted metadata JSON. Copy actions are available for the event id, event type, and redacted JSON payload.

Required permission:

```text
security.ops.read
```

For compatibility, the route also permits existing high-trust audit roles with `privacy.audit.view` or `tenant.connection.log`.

Admin DB Explorer break-glass:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/eip/admin/db/break-glass/status` | Returns the active short-lived investigation grant for the current session, if any. |
| `POST /api/eip/admin/db/break-glass/issue` | Issues a 10-15 minute grant after owner/admin classification, DB permission, CSRF, and phishing-resistant step-up. Requires reason and ticket/case reference. |
| `POST /api/eip/admin/db/break-glass/clear` | Clears the current session grant. |

Table previews, exports, and sensitive-token consumption require an active break-glass grant. Sensitive tables still require the separate tenant sensitive-token grant where applicable.

## Recommended Alert Thresholds

Start with these hosted-production thresholds and tune after real traffic:

Quota controls added in the residual sweep:

| Variable | Default | Purpose |
| --- | ---: | --- |
| `PUBLIC_GATEWAY_QUOTA_MAX` | `3000` | Max gateway security events per tenant/connection/suffix window |
| `PUBLIC_GATEWAY_QUOTA_WINDOW_SEC` | `3600` | Gateway quota window |
| `PUBLIC_COMMERCE_QUOTA_MAX` | `5000` | Max public commerce security events per tenant/connection/suffix window |
| `PUBLIC_COMMERCE_QUOTA_WINDOW_SEC` | `3600` | Public commerce quota window |

Owner/admin privileged action policy:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OWNER_ADMIN_PASSKEY_STEP_UP_REQUIRED` | `true` | In production, owner/admin privileged actions require phishing-resistant passkey step-up even if the global staged rollout flag is still false |

Upload handling now emits `upload.rejected` before write/publish when the inline V1 scanner detects the EICAR test signature or active content in text-like uploads. External AV/CDR remains an optional maturity control for accepted file types.

Synthetic validation:

| Command | Purpose |
| --- | --- |
| `npm run synthetic:v1:plan` | Shows the synthetic validation plan without sending traffic. |
| `npm run synthetic:v1:run` | Runs explicitly scoped synthetic scenarios. Hosted Railway targets require `SYNTHETIC_ALLOW_HOSTED=true` and a test tenant/suffix. |

See `docs/synthetic_validation_bot_v1.md` for safe usage and scenario controls.

| Signal | Initial threshold | Response |
| --- | ---: | --- |
| Auth failures | 10 in 15 minutes per tenant/IP | Check credential stuffing, raise rate limit controls if needed |
| Passkey failures | 5 in 15 minutes per identity | Verify user support issue vs account probing |
| Step-up failures | 5 in 15 minutes per identity | Confirm admin action legitimacy |
| Gateway verification failures | 10 in 15 minutes per connection | Check leaked/wrong key, HMAC clock skew, wrong JWT issuer/audience |
| Origin rejections | 10 in 15 minutes per suffix | Check bad deploy origin or attempted abuse |
| Idempotency conflicts | 3 in 15 minutes per event id | Investigate replay or duplicate external delivery |
| Upload rejections | 5 in 15 minutes per tenant/IP | Check malicious uploads or wrong file tooling |
| Secret rotation/revoke | Any unexpected event | Confirm operator intent |
| Cross-tenant forbidden attempts | Any repeated event | Investigate tenant isolation probing |

## Operator Runbook

1. Open `Admin > Audit`.
2. Review `Top failures` for the highest-count event type and reason.
3. Check `Connection health` for the affected tenant/connection/suffix.
4. For gateway failures, compare the storefront origin and Admin > Connections settings.
5. For auth/passkey/step-up failures, identify whether one identity, one tenant, or one IP is driving the spike.
6. For secret events, confirm there was an expected operator action in Admin > Connections.
7. For upload rejections, check filename/MIME/signature mismatch trends before allowing new file types.

## Deferred

- External alert delivery to email/Slack/PagerDuty.
- Long-term security event retention policy.
