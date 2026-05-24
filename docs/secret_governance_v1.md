# EIP Secret Governance V1

## Scope

EIP is the hub for tenant integrations, so tenant-facing secrets must not live in tenant metadata JSON, API responses, logs, or browser state after creation. This model covers:

- plug-and-play connection API keys
- inbound connection API keys
- HMAC shared secrets
- OAuth/JWT shared secrets
- outbound provider credentials such as bearer tokens, basic passwords, API keys, and OAuth client secrets
- provider webhook verification secrets when stored through the vault

## Storage Model

### Connection API Keys

Plug-and-play API keys stay in `eip_auth.auth_api_key`.

- Raw key is returned once on create or rotate.
- Only `key_hash` is stored.
- Rotation/revocation metadata is stored in `attrs`:
  - `status`
  - `created_by`
  - `rotated_by`
  - `last_rotated_at`
  - `rotated_from`
  - `revoked_by`
  - `revoked_at`

### Connection Secret Vault

Admin > Connections profile secrets are stored in `eip_core.connection_secret`.

- Cipher: AES-256-GCM.
- Key source: `SECRET_ENCRYPTION_KEY`.
- Key label: `SECRET_ENCRYPTION_KEY_ID`.
- Each row is tenant-scoped and connection-scoped.
- Each secret kind has a monotonically increasing `version`.
- At most one active row exists for `(tenant_id, connection_code, secret_kind)`.
- Previous active rows become `superseded` on rotation.
- Revoked rows are marked `revoked` and are not used at runtime.

Tenant `attrs.connection_profiles` keeps only non-secret configuration plus secret metadata:

- `*_ref`
- `*_set`
- `*_version`
- `*_last_rotated_at`
- `*_rotated_by`
- `*_status`

Raw values such as `secret`, `token`, `password`, and `client_secret` are removed from tenant attrs after save.

## Runtime Rules

- Admin read APIs return masked profiles only.
- Browser forms receive only `*_set` metadata, never raw vault values.
- Public gateway and commerce routes hydrate secrets server-side immediately before verification.
- Outbound gateway calls hydrate provider credentials server-side immediately before sending.
- If a vaulted secret exists but cannot be decrypted, runtime fails closed.
- Legacy inline secrets can still be read until a profile is saved and migrated into the vault.

After deploying the vault migration, run the one-time operational migration from the API service shell to move existing raw profile secrets into `eip_core.connection_secret`:

```bash
npm run secrets:migrate
```

## Rotation Workflow

1. Admin opens Admin > Connections.
2. Existing secrets appear as set, but raw values are blank.
3. Admin enters only the new secret value in the relevant field.
4. Save profile.
5. API encrypts the new value as the next version.
6. API marks the previous active version `superseded`.
7. Runtime uses only the new active version.

## Revocation Workflow

Use the profile secret revoke endpoint for emergency removal:

```http
POST /api/eip/gateway/connections/:tenantId/profile/:connectionCode/secrets/revoke
```

Body:

```json
{
  "secret_kinds": ["verification.hmac_signature.secret"]
}
```

If `secret_kinds` is omitted, all profile secrets for that connection are revoked. The endpoint requires an EIP session, CSRF, step-up, and `tenant.connection.write`.

For plug-and-play API keys, use the existing Admin > Connections API key Revoke or Rotate controls.

## Environment Requirements

Set these on the API service before creating or rotating vaulted secrets:

- `SECRET_ENCRYPTION_KEY`: 32-byte key as 64 hex characters, 32-byte base64, or exactly 32 UTF-8 bytes.
- `SECRET_ENCRYPTION_KEY_ID`: operator label for the active key, for example `railway-prod-2026-05`.

Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not reuse `API_KEY_PEPPER`, `CSRF_PEPPER`, `OTP_PEPPER`, or cookie secrets as the vault key.

## Operational Rotation Checklist

1. Confirm `SECRET_ENCRYPTION_KEY` and `SECRET_ENCRYPTION_KEY_ID` are set on the API service.
2. Run `npm run migrate`.
3. Run `npm run secrets:migrate` once to vault existing connection profile secrets.
4. Open Admin > Connections for the tenant.
5. Enter the replacement secret value; do not paste it into notes or non-secret fields.
6. Save the connection profile.
7. Run the inbound or outbound connection test.
8. Confirm the old external credential is revoked at the provider, if applicable.
9. For API keys, copy the new raw key once and update the tenant frontend or integration runtime.
10. Revoke the old API key after the consumer is updated.
11. Check gateway audit records for successful handshakes.
12. Never retrieve secrets from database rows; rotate instead.

## Current Known Limits

- Vault key rotation is metadata-ready through `key_id`, but bulk re-encryption to a new `SECRET_ENCRYPTION_KEY` is not automated yet.
- Legacy provider webhook secrets in old `auth_api_key.attrs` remain readable for compatibility. New or rotated provider secrets should be stored through the connection secret vault.
