-- Add inventory effect handlers to process taxonomy

BEGIN;

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
    ('INVENTORY_MOVE',    'Inventory Move',    90,  '{"group":"inventory"}'::jsonb),
    ('INVENTORY_CONSUME', 'Inventory Consume', 100, '{"group":"inventory"}'::jsonb),
    ('INVENTORY_PRODUCE', 'Inventory Produce', 110, '{"group":"inventory"}'::jsonb),
    ('INVENTORY_CONVERT', 'Inventory Convert', 120, '{"group":"inventory"}'::jsonb)
) AS v(code,label,sort_order,attrs)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    attrs = EXCLUDED.attrs;

COMMIT;

