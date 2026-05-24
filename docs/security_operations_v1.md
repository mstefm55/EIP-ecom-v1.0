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

Gateway intake audit payloads redact raw request bodies by default and store only a byte-count marker unless a connection explicitly opts into `audit.include_raw_body = true`.

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
- `gateway.verification_failed`
- `gateway.origin_rejected`
- `gateway.ip_rejected`
- `gateway.idempotency_missing`
- `gateway.idempotency_rejected`
- `gateway.idempotency_replay`
- `gateway.rate_limited`
- `gateway.payload_too_large`
- `gateway.handshake_denied`
- `commerce.verification_failed`
- `commerce.origin_rejected`
- `commerce.ip_rejected`
- `commerce.routing_not_found`
- `commerce.channel_not_allowed`

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
- `bootstrap.consumed`
- `bootstrap.password_set`
- `bootstrap.totp_enabled`
- `bootstrap.device_trusted`
- `bootstrap.agreements_accepted`
- `bootstrap.completed`
- `recovery.token_requested`
- `recovery.request_created`
- `recovery.consume_failed`
- `recovery.consumed`
- `recovery.request_approved`
- `recovery.request_rejected`
- `template.clone_completed`

### Uploads

- `upload.rejected`

## Admin Usage

Admin-facing API:

```text
GET /api/eip/admin/security/ops?window=24h
```

Supported windows:

- `24h`
- `7d`
- `30d`

The route returns:

- summary counts
- top security failures
- per-tenant/per-connection health
- recent events
- recommended alert thresholds

Dashboard location:

```text
Admin > Audit
```

Required permission:

```text
security.ops.read
```

For compatibility, the route also permits existing high-trust audit roles with `privacy.audit.view` or `tenant.connection.log`.

## Recommended Alert Thresholds

Start with these hosted-production thresholds and tune after real traffic:

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
- Durable per-tenant quotas.
- Malware scanning/quarantine events.
- Long-term security event retention policy.
