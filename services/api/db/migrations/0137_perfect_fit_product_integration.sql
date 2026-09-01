-- Perfect Fit <-> EIP Wave 1 semantic link and governed shared-field vocabulary.
-- Reuses info_record + object_link; no product-development data is copied into a new table.
BEGIN;

WITH relation_list AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE tenant_id IS NULL AND module = 'core' AND code = 'LINK_RELATION_TYPE' AND version = 1
  LIMIT 1
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT id, 'PERFECT_FIT_PRODUCT', 'Perfect Fit product', 70, true,
       '{"integration":"perfect_fit","unlink_deletes_records":false}'::jsonb
FROM relation_list
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = true, attrs = EXCLUDED.attrs;

WITH shared_list AS (
  INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
  VALUES (NULL, 'ecom', 'PERFECT_FIT_SHARED_FIELD', 'Perfect Fit shared product field', 1, true,
          '{"integration":"perfect_fit","keys_are_codes_not_labels":true}'::jsonb)
  ON CONFLICT (tenant_id, module, code, version) DO UPDATE SET is_active = true
  RETURNING id
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT id, v.code, v.label, v.sort_order, true, v.attrs::jsonb
FROM shared_list,
LATERAL (VALUES
  ('product_name', 'Product name', 10, '{"authority":"LATEST_ACCEPTED"}'),
  ('description', 'Description', 20, '{"authority":"PF_WINS"}'),
  ('brand', 'Brand', 30, '{"authority":"LATEST_ACCEPTED"}'),
  ('category_code', 'Category code', 40, '{"authority":"EIP_WINS"}'),
  ('category_label', 'Category label', 50, '{"authority":"DERIVED"}'),
  ('lifecycle_status', 'Lifecycle status', 60, '{"authority":"EIP_WINS"}'),
  ('publication_status', 'Publication status', 70, '{"authority":"MANUAL_REVIEW"}'),
  ('currency', 'Currency', 80, '{"authority":"EIP_WINS"}')
) AS v(code, label, sort_order, attrs)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = true, attrs = EXCLUDED.attrs;

COMMIT;
