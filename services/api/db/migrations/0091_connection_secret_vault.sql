-- Connection secret vault for Admin > Connections.
-- Keeps tenant connection metadata in tenant attrs while moving runtime secrets
-- into encrypted, versioned rows with rotation/revocation metadata.

CREATE TABLE IF NOT EXISTS eip_core.connection_secret (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,
  connection_code text NOT NULL,
  secret_kind text NOT NULL,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'superseded', 'revoked')),
  algorithm text NOT NULL DEFAULT 'aes-256-gcm',
  key_id text NOT NULL DEFAULT 'default',
  iv text NOT NULL,
  tag text NOT NULL,
  ciphertext text NOT NULL,
  aad text NOT NULL DEFAULT '',
  fingerprint text NOT NULL,
  rotated_from uuid REFERENCES eip_core.connection_secret(id) ON DELETE SET NULL,
  rotated_at timestamptz NOT NULL DEFAULT now(),
  rotated_by uuid NULL,
  revoked_at timestamptz NULL,
  revoked_by uuid NULL,
  last_used_at timestamptz NULL,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS connection_secret_version_unique
  ON eip_core.connection_secret (tenant_id, connection_code, secret_kind, version);

CREATE UNIQUE INDEX IF NOT EXISTS connection_secret_active_unique
  ON eip_core.connection_secret (tenant_id, connection_code, secret_kind)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS connection_secret_lookup_idx
  ON eip_core.connection_secret (tenant_id, connection_code, secret_kind, status);

CREATE INDEX IF NOT EXISTS connection_secret_rotated_at_idx
  ON eip_core.connection_secret (tenant_id, rotated_at DESC);
