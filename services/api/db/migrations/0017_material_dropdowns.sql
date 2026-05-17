-- 0017_material_dropdowns.sql
-- Backbone: seed dropdown governance for materials (core)
-- Uses existing dropdown_list / dropdown_value tables

BEGIN;

-- ------------------------------------------------------------
-- 1) MATERIAL_TYPE (core, v1)
-- ------------------------------------------------------------
WITH ins_list AS (
  INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
  VALUES (
    NULL,
    'core',
    'MATERIAL_TYPE',
    'Material Type',
    1,
    true,
    '{"ui":{"applies_to":["material.material_type"]}}'::jsonb
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
    ('FABRIC',   'Fabric',   10),
    ('YARN',     'Yarn',     20),
    ('CHEMICAL', 'Chemical', 30),
    ('PART',     'Part',     40),
    ('SERVICE',  'Service',  50),
    ('OTHER',    'Other',    90)
) AS v(code,label,sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------
-- 2) MATERIAL_LOT_STATUS (core, v1)
-- ------------------------------------------------------------
WITH ins_list AS (
  INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
  VALUES (
    NULL,
    'core',
    'MATERIAL_LOT_STATUS',
    'Material Lot Status',
    1,
    true,
    '{"ui":{"applies_to":["material_lot.status"]}}'::jsonb
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
    ('new',         'New',         10),
    ('available',   'Available',   20),
    ('reserved',    'Reserved',    30),
    ('in_process',  'In process',  40),
    ('qa_hold',     'QA hold',     50),
    ('consumed',    'Consumed',    80),
    ('scrapped',    'Scrapped',    90)
) AS v(code,label,sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

COMMIT;
