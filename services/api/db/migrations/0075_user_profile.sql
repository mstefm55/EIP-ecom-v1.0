-- 0075_user_profile.sql
-- Purpose: user profile metadata (display name, avatar, contact info)

BEGIN;

CREATE TABLE IF NOT EXISTS eip_core.user_profile (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,
  identity_id  uuid NOT NULL REFERENCES eip_auth.auth_identity(id) ON DELETE CASCADE,
  display_name text,
  title        text,
  phone        text,
  locale       text,
  timezone     text,
  avatar_url   text,
  attrs        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profile_unique UNIQUE (tenant_id, identity_id)
);

CREATE INDEX IF NOT EXISTS user_profile_tenant_identity_idx
  ON eip_core.user_profile (tenant_id, identity_id);

CREATE INDEX IF NOT EXISTS user_profile_attrs_gin
  ON eip_core.user_profile USING gin (attrs);

INSERT INTO eip_core.user_profile
  (tenant_id, identity_id, display_name)
SELECT
  i.tenant_id,
  i.id,
  NULLIF(split_part(i.login, '@', 1), '')
FROM eip_auth.auth_identity i
ON CONFLICT (tenant_id, identity_id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_user_profile_set_updated_at ON eip_core.user_profile;
CREATE TRIGGER trg_user_profile_set_updated_at
BEFORE UPDATE ON eip_core.user_profile
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

COMMIT;
