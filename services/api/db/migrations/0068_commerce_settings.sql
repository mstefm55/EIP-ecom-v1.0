BEGIN;

CREATE TABLE IF NOT EXISTS eip_core.tenant_module_setting (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE RESTRICT,
  module      text NOT NULL,
  code        text NOT NULL,
  attrs       jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_module_setting_unique UNIQUE (tenant_id, module, code)
);

CREATE INDEX IF NOT EXISTS tenant_module_setting_tenant_idx
  ON eip_core.tenant_module_setting (tenant_id, module, code);

CREATE INDEX IF NOT EXISTS tenant_module_setting_attrs_gin
  ON eip_core.tenant_module_setting USING gin (attrs);

COMMIT;
