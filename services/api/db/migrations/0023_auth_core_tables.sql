BEGIN;

-- ------------------------------------------------------------
-- auth_identity: "who" can authenticate (tenant-scoped)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eip_auth.auth_identity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,

  -- login can be email, username, phone, external subject, etc.
  login       text NOT NULL,
  login_type  text NOT NULL,   -- email | username | phone | external

  is_active   boolean NOT NULL DEFAULT true,
  is_locked   boolean NOT NULL DEFAULT false,

  attrs       jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_auth_identity UNIQUE (tenant_id, login),
  CONSTRAINT chk_login_trim CHECK (login = btrim(login)),
  CONSTRAINT chk_login_type CHECK (login_type IN ('email','username','phone','external'))
);

CREATE INDEX IF NOT EXISTS auth_identity_tenant_active_idx
  ON eip_auth.auth_identity (tenant_id, is_active, is_locked);

CREATE INDEX IF NOT EXISTS auth_identity_attrs_gin
  ON eip_auth.auth_identity USING gin (attrs);

DROP TRIGGER IF EXISTS trg_auth_identity_set_updated_at ON eip_auth.auth_identity;
CREATE TRIGGER trg_auth_identity_set_updated_at
BEFORE UPDATE ON eip_auth.auth_identity
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

-- Ensure tenant-safe composite reference
CREATE UNIQUE INDEX IF NOT EXISTS auth_identity_tenant_id_uq
  ON eip_auth.auth_identity (tenant_id, id);

-- ------------------------------------------------------------
-- auth_identity_agent: optional mapping to "acts as" agent
-- (keeps agent != user boundary)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eip_auth.auth_identity_agent (
  identity_id uuid NOT NULL,
  tenant_id   uuid NOT NULL,
  agent_id    uuid NOT NULL,

  is_primary  boolean NOT NULL DEFAULT true,
  is_active   boolean NOT NULL DEFAULT true,

  created_at  timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (identity_id, agent_id),

  CONSTRAINT fk_identity_agent_identity
    FOREIGN KEY (tenant_id, identity_id)
    REFERENCES eip_auth.auth_identity (tenant_id, id)
    ON DELETE CASCADE,

  -- This assumes agent is tenant-scoped (recommended)
  CONSTRAINT fk_identity_agent_agent
    FOREIGN KEY (tenant_id, agent_id)
    REFERENCES eip_core.agent (tenant_id, id)
    ON DELETE RESTRICT
);

-- One active primary agent per identity
CREATE UNIQUE INDEX IF NOT EXISTS identity_agent_one_primary
  ON eip_auth.auth_identity_agent (tenant_id, identity_id)
  WHERE (is_primary = true AND is_active = true);

CREATE INDEX IF NOT EXISTS identity_agent_agent_idx
  ON eip_auth.auth_identity_agent (tenant_id, agent_id, is_active);

-- ------------------------------------------------------------
-- auth_credential: "how" they authenticate
-- (password / totp / api_key / oidc placeholder)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eip_auth.auth_credential (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  identity_id      uuid NOT NULL,

  credential_type  text NOT NULL, -- password | totp | api_key | oidc
  secret_hash      text,          -- password hash / api key hash / etc.
  secret_enc       bytea,         -- encrypted secret for TOTP (needs retrieval)
  algorithm        text,          -- argon2id | bcrypt | ...
  meta             jsonb NOT NULL DEFAULT '{}'::jsonb,

  valid_from       timestamptz NOT NULL DEFAULT now(),
  valid_to         timestamptz,
  is_revoked       boolean NOT NULL DEFAULT false,

  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_credential_identity
    FOREIGN KEY (tenant_id, identity_id)
    REFERENCES eip_auth.auth_identity (tenant_id, id)
    ON DELETE CASCADE,

  CONSTRAINT chk_credential_type CHECK (credential_type IN ('password','totp','api_key','oidc'))
);

CREATE INDEX IF NOT EXISTS credential_lookup_idx
  ON eip_auth.auth_credential (tenant_id, identity_id, credential_type, is_revoked);

-- Only one active TOTP credential per identity (simple rule; can be relaxed later)
CREATE UNIQUE INDEX IF NOT EXISTS one_active_totp_per_identity
  ON eip_auth.auth_credential (tenant_id, identity_id)
  WHERE (credential_type='totp' AND is_revoked=false AND valid_to IS NULL);

-- ------------------------------------------------------------
-- auth_otp_challenge: email OTP requests (hash only)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eip_auth.auth_otp_challenge (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  identity_id      uuid NOT NULL,

  channel         text NOT NULL,  -- email (now), sms (later)
  otp_hash        text NOT NULL,  -- hash(otp + pepper + challenge_id)
  expires_at      timestamptz NOT NULL,
  max_attempts    int NOT NULL DEFAULT 5,
  attempt_count   int NOT NULL DEFAULT 0,

  is_consumed     boolean NOT NULL DEFAULT false,
  consumed_at     timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_otp_identity
    FOREIGN KEY (tenant_id, identity_id)
    REFERENCES eip_auth.auth_identity (tenant_id, id)
    ON DELETE CASCADE,

  CONSTRAINT chk_channel CHECK (channel IN ('email','sms'))
);

CREATE INDEX IF NOT EXISTS otp_active_idx
  ON eip_auth.auth_otp_challenge (tenant_id, identity_id, is_consumed, expires_at);

-- ------------------------------------------------------------
-- auth_device: browser or electron install identity
-- Browser: random device_id (cookie)
-- Electron: public key registered to verify challenges (best)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eip_auth.auth_device (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  identity_id      uuid NOT NULL,

  device_kind     text NOT NULL, -- browser | electron | mobile
  device_id       text,          -- browser stable random ID
  public_key_pem  text,          -- electron trust key
  trust_state     text NOT NULL DEFAULT 'untrusted', -- trusted | untrusted | revoked

  label           text,
  last_seen_at    timestamptz,

  attrs           jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_device_identity
    FOREIGN KEY (tenant_id, identity_id)
    REFERENCES eip_auth.auth_identity (tenant_id, id)
    ON DELETE CASCADE,

  CONSTRAINT chk_device_kind CHECK (device_kind IN ('browser','electron','mobile')),
  CONSTRAINT chk_trust_state CHECK (trust_state IN ('trusted','untrusted','revoked'))
);

DROP TRIGGER IF EXISTS trg_auth_device_set_updated_at ON eip_auth.auth_device;
CREATE TRIGGER trg_auth_device_set_updated_at
BEFORE UPDATE ON eip_auth.auth_device
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

-- one browser device row per identity+device_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_browser
  ON eip_auth.auth_device (tenant_id, identity_id, device_kind, device_id)
  WHERE (device_kind='browser' AND device_id IS NOT NULL);

-- one electron key per identity (can be relaxed later to multi-device)
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_electron_key
  ON eip_auth.auth_device (tenant_id, identity_id, device_kind, public_key_pem)
  WHERE (device_kind='electron' AND public_key_pem IS NOT NULL);

CREATE INDEX IF NOT EXISTS device_last_seen_idx
  ON eip_auth.auth_device (tenant_id, identity_id, last_seen_at);

-- ------------------------------------------------------------
-- auth_session: server-side session (cookie points here)
-- store refresh token hash if you also use refresh rotation
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eip_auth.auth_session (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL,
  identity_id          uuid NOT NULL,
  device_id            uuid,

  issued_at            timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz NOT NULL,

  refresh_token_hash   text,     -- optional (for rotation)
  csrf_secret_hash     text,     -- optional (double-submit CSRF)
  ip_address           inet,
  user_agent_hash      text,

  is_revoked           boolean NOT NULL DEFAULT false,
  revoked_at           timestamptz,

  created_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_session_identity
    FOREIGN KEY (tenant_id, identity_id)
    REFERENCES eip_auth.auth_identity (tenant_id, id)
    ON DELETE CASCADE,

  CONSTRAINT fk_session_device
    FOREIGN KEY (device_id)
    REFERENCES eip_auth.auth_device (id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS session_lookup_idx
  ON eip_auth.auth_session (tenant_id, identity_id, is_revoked, expires_at);

CREATE INDEX IF NOT EXISTS session_device_idx
  ON eip_auth.auth_session (tenant_id, device_id);

-- ------------------------------------------------------------
-- auth_event: audit-lite security events (full audit layer later)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eip_auth.auth_event (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  identity_id  uuid,
  session_id   uuid,
  device_id    uuid,

  event_type  text NOT NULL, -- otp_requested, otp_verified, login_success, login_failed, totp_enrolled, session_revoked, device_trusted, etc
  event_at    timestamptz NOT NULL DEFAULT now(),

  ip_address  inet,
  user_agent  text,

  payload     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS auth_event_tenant_time_idx
  ON eip_auth.auth_event (tenant_id, event_at DESC);

COMMIT;
