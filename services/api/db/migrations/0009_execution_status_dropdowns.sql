-- 0009_execution_status_dropdowns.sql
-- Kernel: governance of execution statuses via existing dropdown_list / dropdown_value tables
-- Semantics: dropdowns are data, not new tables.

BEGIN;

-- ============================================================
-- 1) SERVICE_OBJECT_STATUS (core, v1)
-- ============================================================
WITH ins_list AS (
  INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
  VALUES (
    NULL,
    'core',
    'SERVICE_OBJECT_STATUS',
    'Service Object Status',
    1,
    true,
    '{"ui":{"applies_to":["service_object.status"]}}'::jsonb
  )
  ON CONFLICT (tenant_id, module, code, version) DO UPDATE
    SET is_active = EXCLUDED.is_active
  RETURNING id
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT id, v.code, v.label, v.sort_order, true, '{}'::jsonb
FROM ins_list,
LATERAL (
  VALUES
    ('new',        'New',        10),
    ('in_progress','In progress',20),
    ('on_hold',    'On hold',    30),
    ('done',       'Done',       40),
    ('cancelled',  'Cancelled',  90)
) AS v(code,label,sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- ============================================================
-- 2) TASK_STATUS (core, v1)
-- ============================================================
WITH ins_list AS (
  INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
  VALUES (
    NULL,
    'core',
    'TASK_STATUS',
    'Task Status',
    1,
    true,
    '{"ui":{"applies_to":["task.status"]}}'::jsonb
  )
  ON CONFLICT (tenant_id, module, code, version) DO UPDATE
    SET is_active = EXCLUDED.is_active
  RETURNING id
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT id, v.code, v.label, v.sort_order, true, '{}'::jsonb
FROM ins_list,
LATERAL (
  VALUES
    ('open',       'Open',       10),
    ('assigned',   'Assigned',   20),
    ('in_progress','In progress',30),
    ('blocked',    'Blocked',    40),
    ('done',       'Done',       80),
    ('cancelled',  'Cancelled',  90)
) AS v(code,label,sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

COMMIT;
