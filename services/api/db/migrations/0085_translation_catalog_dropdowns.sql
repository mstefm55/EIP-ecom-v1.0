-- 0085_translation_catalog_dropdowns.sql
-- Purpose: tenant-scoped translation provider/quality/billing catalogs for commerce settings.

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
  v.code,
  v.name,
  1,
  true,
  v.attrs::jsonb
FROM tenants t
CROSS JOIN (
  VALUES
    ('TRANSLATION_PROVIDER', 'Translation provider', '{"scope":"commerce_translation"}'),
    ('TRANSLATION_QUALITY', 'Translation quality tier', '{"scope":"commerce_translation"}'),
    ('TRANSLATION_CHARGE_MODE', 'Translation charge mode', '{"scope":"commerce_translation"}')
) AS v(code, name, attrs)
ON CONFLICT (tenant_id, module, code, version) DO UPDATE
SET name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    attrs = EXCLUDED.attrs,
    updated_at = now();

WITH lists AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE module = 'ecom'
    AND code = 'TRANSLATION_PROVIDER'
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
  v.attrs::jsonb
FROM lists l
CROSS JOIN (
  VALUES
    ('none', 'Disabled', 10, '{"requires_connection":false}'),
    ('azure', 'Azure Translator', 20, '{"requires_connection":true}'),
    ('google', 'Google Translate', 30, '{"requires_connection":true}'),
    ('deepl', 'DeepL', 40, '{"requires_connection":true}'),
    ('libretranslate', 'LibreTranslate', 50, '{"requires_connection":true}')
) AS v(code, label, sort_order, attrs)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    attrs = EXCLUDED.attrs,
    updated_at = now();

WITH lists AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE module = 'ecom'
    AND code = 'TRANSLATION_QUALITY'
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
  v.attrs::jsonb
FROM lists l
CROSS JOIN (
  VALUES
    ('economy', 'Economy', 10, '{"sla":"best_effort"}'),
    ('balanced', 'Balanced', 20, '{"sla":"standard"}'),
    ('premium', 'Premium', 30, '{"sla":"high_quality"}')
) AS v(code, label, sort_order, attrs)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    attrs = EXCLUDED.attrs,
    updated_at = now();

WITH lists AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE module = 'ecom'
    AND code = 'TRANSLATION_CHARGE_MODE'
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
  v.attrs::jsonb
FROM lists l
CROSS JOIN (
  VALUES
    ('pass_through', 'Pass-through', 10, '{"formula":"vendor_cost"}'),
    ('pass_through_markup', 'Pass-through + markup', 20, '{"formula":"vendor_cost + markup"}'),
    ('flat_per_char', 'Flat per character', 30, '{"formula":"fixed_rate * chars"}'),
    ('manual_invoice', 'Manual invoice', 40, '{"formula":"manual"}')
) AS v(code, label, sort_order, attrs)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    attrs = EXCLUDED.attrs,
    updated_at = now();

COMMIT;
