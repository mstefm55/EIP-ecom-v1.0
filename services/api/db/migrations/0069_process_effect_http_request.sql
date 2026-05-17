BEGIN;

WITH list AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE code = 'PROCESS_EFFECT_TYPE'
    AND is_active = true
    AND tenant_id IS NULL
  ORDER BY version DESC
  LIMIT 1
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT id, v.code, v.label, v.sort_order, true, v.attrs
FROM list,
LATERAL (
  VALUES
    ('HTTP_REQUEST', 'HTTP Request', 90, '{}'::jsonb),
    ('API_CALL', 'API Call', 91, '{"deprecated":true}'::jsonb)
) AS v(code, label, sort_order, attrs)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    attrs = EXCLUDED.attrs;

COMMIT;
