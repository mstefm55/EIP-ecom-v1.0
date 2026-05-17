-- 0020_link_dropdowns.sql
-- Core backbone: seed dropdown governance for object_link semantics
-- Adds OBJECT_KIND and LINK_RELATION_TYPE lists.

BEGIN;

-- ------------------------------------------------------------
-- 1) OBJECT_KIND (core, v1)
-- ------------------------------------------------------------
WITH ins_list AS (
  INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
  VALUES (
    NULL,
    'core',
    'OBJECT_KIND',
    'Object Kind',
    1,
    true,
    '{"ui":{"applies_to":["object_link.src_kind","object_link.dst_kind"]}}'::jsonb
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
    ('agent',         'Agent',         10),
    ('asset',         'Asset',         20),
    ('material',      'Material',      30),
    ('material_lot',  'Material Lot',  40),
    ('service_object','Service Object',50),
    ('task',          'Task',          60),
    ('process_def',   'Process Def',   70),
    ('process_instance','Process Instance',80),
    ('info_record',   'Info Record',   90)
) AS v(code,label,sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------
-- 2) LINK_RELATION_TYPE (core, v1)
-- ------------------------------------------------------------
WITH ins_list AS (
  INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
  VALUES (
    NULL,
    'core',
    'LINK_RELATION_TYPE',
    'Link Relation Type',
    1,
    true,
    '{"ui":{"applies_to":["object_link.relation_type"]}}'::jsonb
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
    ('INPUT',        'Input',        10),
    ('OUTPUT',       'Output',       20),
    ('EVIDENCE',     'Evidence',     30),
    ('ATTACHMENT',   'Attachment',   40),
    ('REFERS_TO',    'Refers to',    50),
    ('RESULT_OF',    'Result of',    60),
    ('RELATED',      'Related',      90)
) AS v(code,label,sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

COMMIT;
