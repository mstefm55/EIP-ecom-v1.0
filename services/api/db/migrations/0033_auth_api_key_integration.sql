BEGIN;

CREATE TABLE IF NOT EXISTS eip_auth.auth_api_key (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,

  -- store only a hash of the secret key
  key_hash text NOT NULL UNIQUE,

  label text NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NULL,

  -- optional scoping; keep flexible
  scopes jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- metadata
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_api_key_lookup_idx
  ON eip_auth.auth_api_key (tenant_id, is_active, expires_at);

COMMENT ON TABLE eip_auth.auth_api_key IS
  'Machine credentials for INTEGRATION realm. Store only key_hash, never raw secrets.';

COMMIT;
