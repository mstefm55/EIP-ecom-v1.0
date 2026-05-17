-- 0088_ecom_variant_header_dropdowns.sql
-- Purpose: govern product variant headers via dropdown_list/dropdown_value

BEGIN;

WITH tenants AS (
  SELECT id
  FROM eip_core.tenant
  WHERE is_active = true
)
INSERT INTO eip_core.dropdown_list
  (tenant_id, module, code, name, version, is_active, attrs)
SELECT
  t.id,
  'ecom',
  'ECOM_VARIANT_HEADER',
  'Ecommerce Variant Header',
  1,
  true,
  '{"scope":"variant_headers","delegated":true,"managed_by":"tenant"}'::jsonb
FROM tenants t
ON CONFLICT (tenant_id, module, code, version) DO UPDATE
SET name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    attrs = EXCLUDED.attrs,
    updated_at = now();

WITH lists AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE module = 'ecom'
    AND code = 'ECOM_VARIANT_HEADER'
    AND version = 1
    AND is_active = true
)
INSERT INTO eip_core.dropdown_value
  (list_id, code, label, sort_order, is_active, attrs)
SELECT
  l.id,
  v.code,
  v.label,
  v.sort_order,
  true,
  '{}'::jsonb
FROM lists l
CROSS JOIN (
  VALUES
    ('size', 'Size', 10),
    ('color', 'Color', 20),
    ('width', 'Width', 30),
    ('length', 'Length', 40),
    ('fit', 'Fit', 50),
    ('material', 'Material', 60),
    ('style', 'Style', 70),
    ('finish', 'Finish', 80)
) AS v(code, label, sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

COMMIT;
