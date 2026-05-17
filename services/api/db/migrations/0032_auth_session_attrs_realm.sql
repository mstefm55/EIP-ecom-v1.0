-- 0032_auth_session_attrs_realm.sql
-- Purpose: add session-scoped attrs (jsonb) to support realm + future gateway metadata

BEGIN;

ALTER TABLE eip_auth.auth_session
  ADD COLUMN IF NOT EXISTS attrs jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN eip_auth.auth_session.attrs IS
  'Session-scoped metadata. Includes realm (EIP|GATEWAY|PUBLIC), plus future gateway fields.';

-- Optional but useful: index realm lookups (tenant-scoped)
-- Only indexes rows that actually have realm key.
CREATE INDEX IF NOT EXISTS auth_session_realm_idx
  ON eip_auth.auth_session (tenant_id, ((attrs->>'realm')))
  WHERE (attrs ? 'realm');

COMMIT;
