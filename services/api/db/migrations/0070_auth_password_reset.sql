-- 0070_auth_password_reset.sql

CREATE TABLE IF NOT EXISTS eip_auth.auth_password_reset (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,
  identity_id uuid NOT NULL REFERENCES eip_auth.auth_identity(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_ip text,
  requested_user_agent text
);

CREATE INDEX IF NOT EXISTS idx_auth_password_reset_lookup
  ON eip_auth.auth_password_reset (token_hash, expires_at, consumed_at);

CREATE INDEX IF NOT EXISTS idx_auth_password_reset_tenant_identity
  ON eip_auth.auth_password_reset (tenant_id, identity_id, requested_at DESC);
