-- 0052_jurisdiction.sql
-- Purpose: jurisdiction hierarchy with ISO codes (country -> city -> special)

BEGIN;

CREATE TABLE IF NOT EXISTS eip_core.jurisdiction (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid REFERENCES eip_core.tenant(id) ON DELETE RESTRICT,
  code              text NOT NULL,
  name              text NOT NULL,
  level             text NOT NULL,
  parent_id         uuid REFERENCES eip_core.jurisdiction(id) ON DELETE SET NULL,
  iso_country_code  char(2),
  iso_subdivision_code text,
  iso_numeric_code  text,
  is_active         boolean NOT NULL DEFAULT true,
  attrs             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_jurisdiction_code_trim CHECK (code = btrim(code)),
  CONSTRAINT chk_jurisdiction_name_trim CHECK (name = btrim(name)),
  CONSTRAINT chk_jurisdiction_level CHECK (
    level = ANY (ARRAY[
      'COUNTRY'::text,
      'REGION'::text,
      'STATE'::text,
      'PROVINCE'::text,
      'CITY'::text,
      'DISTRICT'::text,
      'SPECIAL'::text
    ])
  )
);

-- Unique per tenant when tenant_id is set
CREATE UNIQUE INDEX IF NOT EXISTS jurisdiction_code_unique_per_tenant
  ON eip_core.jurisdiction (tenant_id, code)
  WHERE tenant_id IS NOT NULL;

-- Unique global codes when tenant_id is null (shared seed)
CREATE UNIQUE INDEX IF NOT EXISTS jurisdiction_code_unique_global
  ON eip_core.jurisdiction (code)
  WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS jurisdiction_parent_idx
  ON eip_core.jurisdiction (parent_id);

CREATE INDEX IF NOT EXISTS jurisdiction_country_idx
  ON eip_core.jurisdiction (iso_country_code);

CREATE INDEX IF NOT EXISTS jurisdiction_attrs_gin
  ON eip_core.jurisdiction USING gin (attrs);

DROP TRIGGER IF EXISTS trg_jurisdiction_set_updated_at ON eip_core.jurisdiction;
CREATE TRIGGER trg_jurisdiction_set_updated_at
BEFORE UPDATE ON eip_core.jurisdiction
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

COMMIT;
