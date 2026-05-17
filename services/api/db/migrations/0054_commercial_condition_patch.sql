-- 0054_commercial_condition_patch.sql
-- Purpose: ensure commercial_condition has category/scope/effect + indexes

BEGIN;

ALTER TABLE eip_core.commercial_condition
  ADD COLUMN IF NOT EXISTS condition_category text,
  ADD COLUMN IF NOT EXISTS scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS effect jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS commercial_condition_scope_gin
  ON eip_core.commercial_condition USING gin (scope);

CREATE INDEX IF NOT EXISTS commercial_condition_effect_gin
  ON eip_core.commercial_condition USING gin (effect);

COMMIT;
