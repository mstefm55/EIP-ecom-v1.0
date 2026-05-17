-- 0055_process_taxonomy_dropdowns.sql
-- Kernel: governed process builder taxonomy (nodes, edges, effects, task actions)

BEGIN;

-- ============================================================
-- PROCESS_NODE_TYPE (core, v1)
-- ============================================================
WITH ins_list AS (
  INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
  VALUES (
    NULL,
    'core',
    'PROCESS_NODE_TYPE',
    'Process Node Type',
    1,
    true,
    '{"ui":{"applies_to":["process_def.graph.nodes"]}}'::jsonb
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
    ('TRIGGER',    'Trigger',     10),
    ('STEP',       'Step',        20),
    ('HUMAN_TASK', 'Human Task',  30),
    ('ROUTER',     'Router',      40),
    ('JOIN',       'Join',        50),
    ('TERMINAL',   'Terminal',    90)
) AS v(code,label,sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- ============================================================
-- PROCESS_EDGE_TYPE (core, v1)
-- ============================================================
WITH ins_list AS (
  INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
  VALUES (
    NULL,
    'core',
    'PROCESS_EDGE_TYPE',
    'Process Edge Type',
    1,
    true,
    '{"ui":{"applies_to":["process_def.graph.transitions"]}}'::jsonb
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
    ('DEFAULT',     'Default',      10),
    ('ON_SUCCESS',  'On Success',   20),
    ('ON_FAIL',     'On Fail',      30),
    ('CONDITIONAL', 'Conditional',  40)
) AS v(code,label,sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- ============================================================
-- PROCESS_EFFECT_TYPE (core, v1)
-- ============================================================
WITH ins_list AS (
  INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
  VALUES (
    NULL,
    'core',
    'PROCESS_EFFECT_TYPE',
    'Process Effect Type',
    1,
    true,
    '{"ui":{"applies_to":["process_def.graph.transitions.effects"]}}'::jsonb
  )
  ON CONFLICT (tenant_id, module, code, version) DO UPDATE
    SET is_active = EXCLUDED.is_active
  RETURNING id
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT id, v.code, v.label, v.sort_order, true, v.attrs
FROM ins_list,
LATERAL (
  VALUES
    ('STATUS_SET',                 'Status Set',                 10, '{}'::jsonb),
    ('TASK_CREATE',                'Task Create',                20, '{}'::jsonb),
    ('TASK_UPDATE',                'Task Update',                30, '{}'::jsonb),
    ('LINK_CREATE',                'Link Create',                40, '{}'::jsonb),
    ('LINK_REMOVE',                'Link Remove',                50, '{}'::jsonb),
    ('JSON_MERGE',                 'JSON Merge',                 60, '{}'::jsonb),
    ('CHILD_SERVICE_OBJECT_CREATE','Child Service Object Create',70, '{}'::jsonb),
    ('INFO_RECORD_WRITE',          'Info Record Write',          80, '{}'::jsonb),

    -- Legacy/internal effect types (kept for compatibility; hidden in UI)
    ('SO_CREATE',                  'Legacy: Service Object Create', 200, '{"deprecated":true}'::jsonb),
    ('SO_STATUS',                  'Legacy: Service Object Status', 210, '{"deprecated":true}'::jsonb),
    ('SO_UPDATE',                  'Legacy: Service Object Update', 220, '{"deprecated":true}'::jsonb),
    ('TASK_STATUS',                'Legacy: Task Status',           230, '{"deprecated":true}'::jsonb),
    ('LINK',                       'Legacy: Link Create',           240, '{"deprecated":true}'::jsonb),
    ('ATTRS_MERGE',                'Legacy: JSON Merge',            250, '{"deprecated":true}'::jsonb),
    ('INSTANCE_START',             'Legacy: Instance Start',        260, '{"deprecated":true}'::jsonb),
    ('ACCESS_GRANT_UPDATE',        'Legacy: Access Grant Update',   270, '{"deprecated":true}'::jsonb)
) AS v(code,label,sort_order,attrs)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    attrs = EXCLUDED.attrs;

-- ============================================================
-- TASK_ACTION (core, v1)
-- ============================================================
WITH ins_list AS (
  INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
  VALUES (
    NULL,
    'core',
    'TASK_ACTION',
    'Task Action',
    1,
    true,
    '{"ui":{"applies_to":["task.actions","task_template.attrs.allowed_actions"]}}'::jsonb
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
    ('TASK_START',           'Start',            10),
    ('TASK_PAUSE',           'Pause',            20),
    ('TASK_RESUME',          'Resume',           30),
    ('TASK_COMPLETE',        'Complete',         40),
    ('TASK_CANCEL',          'Cancel',           50),
    ('TASK_BLOCK',           'Block',            60),
    ('TASK_UNBLOCK',         'Unblock',          70),
    ('TASK_FAIL',            'Fail',             80),
    ('TASK_ASSIGN',          'Assign',           90),
    ('TASK_UNASSIGN',        'Unassign',         100),
    ('TASK_REASSIGN',        'Reassign',         110),
    ('TASK_CLAIM',           'Claim',            120),
    ('TASK_RELEASE',         'Release',          130),
    ('TASK_APPROVE',         'Approve',          140),
    ('TASK_REJECT',          'Reject',           150),
    ('TASK_REQUEST_CHANGES', 'Request Changes',  160),
    ('TASK_ADD_NOTE',        'Add Note',         170),
    ('TASK_ADD_ATTACHMENT',  'Add Attachment',   180),
    ('TASK_ADD_LINK',        'Add Link',         190),
    ('TASK_ESCALATE',        'Escalate',          200),
    ('TASK_DEADLINE_EXTEND', 'Extend Deadline',  210),
    ('TASK_ADVANCE_PROCESS', 'Advance Process',  220)
) AS v(code,label,sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

COMMIT;

