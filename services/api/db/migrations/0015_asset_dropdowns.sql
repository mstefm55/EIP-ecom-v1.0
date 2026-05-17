-- 0015_asset_dropdowns.sql
-- Backbone: seed dropdown governance for asset module (core)
-- Uses existing dropdown_list / dropdown_value (no new dropdown tables)

BEGIN;

-- ------------------------------------------------------------
-- 1) ASSET_STATUS (core, v1)
-- ------------------------------------------------------------
WITH ins_list AS (
  INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
  VALUES (
    NULL,
    'core',
    'ASSET_STATUS',
    'Asset Status',
    1,
    true,
    '{"ui":{"applies_to":["asset.status"]}}'::jsonb
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
    ('active',      'Active',      10),
    ('idle',        'Idle',        20),
    ('down',        'Down',        30),
    ('maintenance', 'Maintenance',  40),
    ('retired',     'Retired',     90)
) AS v(code,label,sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------
-- 2) ASSET_TYPE (core, v1)
-- ------------------------------------------------------------
WITH ins_list AS (
  INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
  VALUES (
    NULL,
    'core',
    'ASSET_TYPE',
    'Asset Type',
    1,
    true,
    '{"ui":{"applies_to":["asset.asset_type"]}}'::jsonb
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
    ('MACHINE',     'Machine',     10),
    ('TOOL',        'Tool',        20),
    ('VEHICLE',     'Vehicle',     30),
    ('EQUIPMENT',   'Equipment',   40),
    ('OTHER',       'Other',       90)
) AS v(code,label,sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

COMMIT;
