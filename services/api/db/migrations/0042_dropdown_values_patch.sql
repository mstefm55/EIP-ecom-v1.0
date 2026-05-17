BEGIN;

-- =========================================================
-- Ensure TASK_STATUS values exist (no new list creation)
-- =========================================================
WITH list AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE code = 'TASK_STATUS'
    AND is_active = true
  ORDER BY (tenant_id IS NOT NULL) DESC, version DESC
  LIMIT 1
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT list.id, v.code, v.label, v.sort_order, true, '{}'::jsonb
FROM list,
LATERAL (
  VALUES
    ('open',       'Open',       10),
    ('in_progress','In progress',30),
    ('done',       'Done',       80),
    ('cancelled',  'Cancelled',  90)
) AS v(code,label,sort_order)
WHERE list.id IS NOT NULL
ON CONFLICT (list_id, code) DO NOTHING;

-- =========================================================
-- Ensure process instance status values exist in existing list
-- (prefer PROCESS_INSTANCE_STATUS, fallback to STATUS)
-- =========================================================
WITH list AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE code IN ('PROCESS_INSTANCE_STATUS', 'STATUS')
    AND is_active = true
  ORDER BY (code = 'PROCESS_INSTANCE_STATUS') DESC,
           (tenant_id IS NOT NULL) DESC,
           version DESC
  LIMIT 1
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT list.id, v.code, v.label, v.sort_order, true, '{}'::jsonb
FROM list,
LATERAL (
  VALUES
    ('active',    'Active',    10),
    ('completed', 'Completed', 20),
    ('cancelled', 'Cancelled', 30),
    ('failed',    'Failed',    40)
) AS v(code,label,sort_order)
WHERE list.id IS NOT NULL
ON CONFLICT (list_id, code) DO NOTHING;

COMMIT;
