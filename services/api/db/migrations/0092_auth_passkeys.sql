-- Staged WebAuthn/passkey support for phishing-resistant login and step-up.

CREATE TABLE IF NOT EXISTS eip_auth.auth_passkey (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  identity_id uuid NOT NULL,
  credential_id text NOT NULL,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}'::text[],
  device_type text NULL,
  backed_up boolean NOT NULL DEFAULT false,
  label text NULL,
  last_used_at timestamptz NULL,
  is_revoked boolean NOT NULL DEFAULT false,
  revoked_at timestamptz NULL,
  revoked_by uuid NULL,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_passkey_identity
    FOREIGN KEY (tenant_id, identity_id)
    REFERENCES eip_auth.auth_identity (tenant_id, id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_passkey_credential_unique
  ON eip_auth.auth_passkey (credential_id);

CREATE INDEX IF NOT EXISTS auth_passkey_identity_idx
  ON eip_auth.auth_passkey (tenant_id, identity_id, is_revoked, last_used_at DESC);

DROP TRIGGER IF EXISTS trg_auth_passkey_set_updated_at ON eip_auth.auth_passkey;
CREATE TRIGGER trg_auth_passkey_set_updated_at
BEFORE UPDATE ON eip_auth.auth_passkey
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS eip_auth.auth_webauthn_challenge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  identity_id uuid NULL,
  session_id uuid NULL REFERENCES eip_auth.auth_session(id) ON DELETE CASCADE,
  challenge text NOT NULL,
  challenge_type text NOT NULL
    CHECK (challenge_type IN ('registration','login','step_up')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_webauthn_challenge_identity
    FOREIGN KEY (tenant_id, identity_id)
    REFERENCES eip_auth.auth_identity (tenant_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS auth_webauthn_challenge_lookup_idx
  ON eip_auth.auth_webauthn_challenge (id, challenge_type, expires_at, consumed_at);

CREATE INDEX IF NOT EXISTS auth_webauthn_challenge_identity_idx
  ON eip_auth.auth_webauthn_challenge (tenant_id, identity_id, challenge_type, created_at DESC);
