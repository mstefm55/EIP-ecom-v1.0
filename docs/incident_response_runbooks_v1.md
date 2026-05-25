# EIP V1 Incident Response Runbooks

Date: 2026-05-25

These runbooks are the V1 hosted-production operator baseline. They assume Railway-hosted API/dashboard services, tenant-scoped connection profiles managed through Admin > Connections, and structured events in `eip_core.security_event`.

## API Key Compromise

Detection signals:
- `connection.api_key_created`, `connection.api_key_rotated`, or `connection.api_key_revoked` outside an expected change window
- spikes in `gateway.verification_failed`, `commerce.verification_failed`, `gateway.quota_exceeded`, or `commerce.quota_exceeded`
- tenant reports of unexpected storefront or gateway traffic

Immediate actions:
1. In Admin > Connections, revoke the suspected key for the affected tenant/connection.
2. Rotate the connection API key and distribute the new value through the approved tenant channel.
3. Confirm the external site no longer sends `api_key` or `apiKey` in query strings.
4. Review Admin > Audit for the affected `tenant_id`, `connection_code`, and `suffix`.
5. If abuse persists, temporarily disable the connection profile.

Recovery:
- Re-enable only after successful verification from the expected origin.
- Preserve the security events and any related external logs.
- Update the tenant incident note with rotation time, rotated-by identity, and post-rotation validation.

## Admin Account Compromise

Detection signals:
- owner/admin login from unusual IP or device
- unexpected `passkey.revoked`, `admin_passkey_revoke`, `connection.secret_rotated`, `template.clone_completed`, or DB explorer events
- repeated `auth.step_up_failed` or recovery events

Immediate actions:
1. Revoke active sessions for the affected identity from the database or admin tooling.
2. Revoke unknown trusted devices and passkeys.
3. Force password reset and require passkey step-up before restoring privileged access.
4. Review `eip_core.security_event` for actor identity, target tenant, and connection changes.
5. Rotate any connection secrets touched during the suspected window.

Recovery:
- Confirm `OWNER_ADMIN_PASSKEY_STEP_UP_REQUIRED=true` in production.
- Confirm owner/admin passkeys are enrolled and tested.
- Document affected tenants, actions reviewed, and credentials rotated.

## Gateway Replay Or Abuse

Detection signals:
- `gateway.idempotency_rejected`
- `gateway.idempotency_replay`
- `gateway.verification_failed`
- `gateway.quota_exceeded`
- abnormal event volume for one `suffix` or `connection_code`

Immediate actions:
1. Inspect Admin > Audit by event type and suffix.
2. Confirm the connection verification mode is `api_key`, `hmac_signature`, or `oauth2_jwt`.
3. Rotate API/HMAC/JWT secrets if replay source is uncertain.
4. Lower the connection profile quota temporarily if abuse continues.
5. Disable the connection profile if valid signed abuse is ongoing.

Recovery:
- Restore quota thresholds after traffic normalizes.
- Keep event ids and request hashes for forensic comparison.
- Confirm the external sender uses stable idempotency/event ids.

## Malicious Upload

Detection signals:
- `upload.rejected` with `MALWARE_SIGNATURE_DETECTED`, `ACTIVE_CONTENT_REJECTED`, or repeated signature mismatch reasons
- upload rejection spikes in Admin > Audit
- tenant report of suspicious uploaded media/document

Immediate actions:
1. Block the user/session or tenant workflow causing the upload spike.
2. Confirm the file was rejected before publishing. V1 inline scanning rejects before file write for known malware test signatures and active-content text-like payloads.
3. If a file was already published before this control was present, remove it from tenant assets and revoke signed URLs by rotating `API_KEY_PEPPER` only if broad asset URL compromise is suspected.
4. Preserve rejected metadata from security events; do not store raw malicious payloads in logs.

Recovery:
- Re-enable uploads after source remediation.
- Decide whether the tenant requires external AV/CDR integration for accepted file types.
- Tune upload alert thresholds if false positives or abuse spikes repeat.

## Tenant Data Exposure

Detection signals:
- `tenant.connection_scope_forbidden`
- `admin_db_explorer.owner_admin_required`
- `ASSET_TENANT_FORBIDDEN`
- wrong suffix/key/origin rejection spikes
- user report of seeing another tenant's data

Immediate actions:
1. Freeze affected tenant connection profiles and admin access grants if active leakage is suspected.
2. Review Admin > Audit for actor tenant, target tenant, suffix, and route family.
3. Confirm owner/admin sessions are not being used as storefront/member contexts.
4. Confirm signed asset URLs are tenant-scoped and not reusable across tenant ids.
5. Rotate affected connection keys/secrets if any external tenant boundary was crossed.

Recovery:
- Run tenant isolation and gateway verification tests before re-enabling.
- Document affected objects, users, time window, and containment steps.
- Notify affected tenants according to contractual and legal requirements.
