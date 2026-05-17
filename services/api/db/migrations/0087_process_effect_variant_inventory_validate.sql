-- 0087_process_effect_variant_inventory_validate.sql
-- Purpose: add process effect for variant inventory consistency and bind it to ecom product flow

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
    ('VARIANT_INVENTORY_VALIDATE', 'Variant Inventory Validate', 130, '{"group":"inventory"}'::jsonb)
) AS v(code,label,sort_order,attrs)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    attrs = EXCLUDED.attrs;

WITH target AS (
  SELECT id, graph
  FROM eip_core.process_def
  WHERE code = 'ECOM_PRODUCT_ONBOARDING'
    AND COALESCE(is_active, true) = true
),
patched AS (
  SELECT
    t.id,
    jsonb_set(
      t.graph,
      '{transitions}',
      (
        SELECT COALESCE(
          jsonb_agg(
            CASE
              WHEN UPPER(COALESCE(tr.elem->>'action', '')) IN ('DRAFT_READY', 'PUBLISH') THEN
                CASE
                  WHEN EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(COALESCE(tr.elem->'effects', '[]'::jsonb)) eff
                    WHERE UPPER(COALESCE(eff->>'type', '')) = 'VARIANT_INVENTORY_VALIDATE'
                  )
                    THEN tr.elem
                  ELSE jsonb_set(
                    tr.elem,
                    '{effects}',
                    COALESCE(tr.elem->'effects', '[]'::jsonb) || jsonb_build_array(
                      jsonb_build_object(
                        'type', 'VARIANT_INVENTORY_VALIDATE',
                        'material_id', '$payload.material_id',
                        'mode', 'sync'
                      )
                    ),
                    true
                  )
                END
              ELSE tr.elem
            END
            ORDER BY tr.ord
          ),
          '[]'::jsonb
        )
        FROM jsonb_array_elements(COALESCE(t.graph->'transitions', '[]'::jsonb))
          WITH ORDINALITY AS tr(elem, ord)
      ),
      true
    ) AS graph
  FROM target t
)
UPDATE eip_core.process_def pd
SET graph = p.graph,
    updated_at = now()
FROM patched p
WHERE pd.id = p.id
  AND pd.graph IS DISTINCT FROM p.graph;

COMMIT;
