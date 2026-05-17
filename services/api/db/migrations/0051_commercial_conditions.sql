-- 0051_commercial_conditions.sql
-- Purpose: commercial rules (pricing/tax/discount/terms) with flexible scope

BEGIN;

CREATE TABLE IF NOT EXISTS eip_core.commercial_condition (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE RESTRICT,
  code            text NOT NULL,
  label           text,
  condition_type  text NOT NULL,
  condition_category text,
  priority        integer NOT NULL DEFAULT 100,
  valid_from      timestamptz,
  valid_to        timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  scope           jsonb NOT NULL DEFAULT '{}'::jsonb,
  effect          jsonb NOT NULL DEFAULT '{}'::jsonb,
  attrs           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_commercial_condition_code_trim CHECK (code = btrim(code)),
  CONSTRAINT chk_commercial_condition_label_trim CHECK (label IS NULL OR label = btrim(label))
);

CREATE UNIQUE INDEX IF NOT EXISTS commercial_condition_code_unique_per_tenant
  ON eip_core.commercial_condition (tenant_id, code);

CREATE INDEX IF NOT EXISTS commercial_condition_tenant_type_idx
  ON eip_core.commercial_condition (tenant_id, condition_type, condition_category, is_active, priority);

CREATE INDEX IF NOT EXISTS commercial_condition_scope_gin
  ON eip_core.commercial_condition USING gin (scope);

CREATE INDEX IF NOT EXISTS commercial_condition_effect_gin
  ON eip_core.commercial_condition USING gin (effect);

CREATE INDEX IF NOT EXISTS commercial_condition_attrs_gin
  ON eip_core.commercial_condition USING gin (attrs);

DROP TRIGGER IF EXISTS trg_commercial_condition_set_updated_at ON eip_core.commercial_condition;
CREATE TRIGGER trg_commercial_condition_set_updated_at
BEFORE UPDATE ON eip_core.commercial_condition
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

COMMIT;
