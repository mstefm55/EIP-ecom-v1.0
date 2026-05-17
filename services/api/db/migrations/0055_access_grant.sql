-- 0055_access_grant.sql
-- Purpose: digital delivery entitlements (token-based access rights)

BEGIN;

CREATE TABLE IF NOT EXISTS eip_core.access_grant (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE RESTRICT,
  grant_type        text NOT NULL,
  token_hash        text NOT NULL,
  token_hint        text,
  content_object_id uuid,
  content_version_id uuid,
  service_object_id uuid REFERENCES eip_core.service_object(id) ON DELETE SET NULL,
  agent_id          uuid REFERENCES eip_core.agent(id) ON DELETE SET NULL,
  state             text NOT NULL DEFAULT 'active',
  expires_at        timestamptz,
  max_uses          integer NOT NULL DEFAULT 1,
  uses              integer NOT NULL DEFAULT 0,
  last_redeemed_at  timestamptz,
  attrs             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_access_grant_state CHECK (
    state = ANY (ARRAY['active','reserved','delivered','expired','revoked'])
  )
);

ALTER TABLE eip_core.access_grant
  ADD CONSTRAINT access_grant_content_object_fk
  FOREIGN KEY (tenant_id, content_object_id)
  REFERENCES eip_core.content_object (tenant_id, id)
  ON DELETE SET NULL;

ALTER TABLE eip_core.access_grant
  ADD CONSTRAINT access_grant_content_version_fk
  FOREIGN KEY (content_version_id)
  REFERENCES eip_core.content_version (id)
  ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS access_grant_token_unique
  ON eip_core.access_grant (tenant_id, token_hash);

CREATE INDEX IF NOT EXISTS access_grant_lookup_idx
  ON eip_core.access_grant (tenant_id, state, expires_at);

CREATE INDEX IF NOT EXISTS access_grant_service_object_idx
  ON eip_core.access_grant (tenant_id, service_object_id);

CREATE INDEX IF NOT EXISTS access_grant_agent_idx
  ON eip_core.access_grant (tenant_id, agent_id);

CREATE INDEX IF NOT EXISTS access_grant_attrs_gin
  ON eip_core.access_grant USING gin (attrs);

DROP TRIGGER IF EXISTS trg_access_grant_set_updated_at ON eip_core.access_grant;
CREATE TRIGGER trg_access_grant_set_updated_at
BEFORE UPDATE ON eip_core.access_grant
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

COMMIT;
