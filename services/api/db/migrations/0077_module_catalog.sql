-- 0077_module_catalog.sql
-- Purpose: module catalog registry for tenant module assignments

BEGIN;

CREATE TABLE IF NOT EXISTS eip_core.module_catalog (
  code        text PRIMARY KEY,
  label       text NOT NULL,
  description text,
  attrs       jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS module_catalog_active_idx
  ON eip_core.module_catalog (is_active, code);

DROP TRIGGER IF EXISTS trg_module_catalog_set_updated_at ON eip_core.module_catalog;
CREATE TRIGGER trg_module_catalog_set_updated_at
BEFORE UPDATE ON eip_core.module_catalog
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

INSERT INTO eip_core.module_catalog (code, label, description)
VALUES
  ('core', 'Core', 'Base platform services and governance'),
  ('crm', 'CRM', 'Customer relationship management'),
  ('ecom', 'E-commerce', 'Orders, catalog, and checkout'),
  ('commerce', 'Commerce', 'Unified commerce services')
ON CONFLICT (code) DO NOTHING;

COMMIT;
