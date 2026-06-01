-- Repair dashboard surfaces created or cloned after the reusable CRM descriptor
-- was registered. The descriptor remains metadata-driven and module-gated.

BEGIN;

DO $$
DECLARE
  crm_menu jsonb;
  crm_panel jsonb;
BEGIN
  SELECT item INTO crm_menu
  FROM eip_core.ui_surface surface
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(surface.tree->'props'->'menu', '[]'::jsonb)
  ) item
  WHERE surface.code = 'dashboard'
    AND surface.is_active = true
    AND surface.is_published = true
    AND item->>'code' = 'crm'
  LIMIT 1;

  SELECT item INTO crm_panel
  FROM eip_core.ui_surface surface
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(surface.tree->'children', '[]'::jsonb)
  ) item
  WHERE surface.code = 'dashboard'
    AND surface.is_active = true
    AND surface.is_published = true
    AND item->>'id' = 'user-crm-panel'
  LIMIT 1;

  IF crm_menu IS NULL OR crm_panel IS NULL THEN
    RAISE EXCEPTION 'Reusable CRM dashboard descriptor is missing';
  END IF;

  UPDATE eip_core.ui_surface
  SET tree = jsonb_set(
        jsonb_set(
          tree,
          '{props,menu}',
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM jsonb_array_elements(COALESCE(tree->'props'->'menu', '[]'::jsonb)) item
              WHERE item->>'code' = 'crm'
            )
            THEN COALESCE(tree->'props'->'menu', '[]'::jsonb)
            ELSE COALESCE(tree->'props'->'menu', '[]'::jsonb) || jsonb_build_array(crm_menu)
          END,
          true
        ),
        '{children}',
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE(tree->'children', '[]'::jsonb)) item
            WHERE item->>'id' = 'user-crm-panel'
          )
          THEN COALESCE(tree->'children', '[]'::jsonb)
          ELSE COALESCE(tree->'children', '[]'::jsonb) || jsonb_build_array(crm_panel)
        END,
        true
      ),
      updated_at = now()
  WHERE code = 'dashboard'
    AND is_active = true
    AND is_published = true
    AND (
      NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(tree->'props'->'menu', '[]'::jsonb)) item
        WHERE item->>'code' = 'crm'
      )
      OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(tree->'children', '[]'::jsonb)) item
        WHERE item->>'id' = 'user-crm-panel'
      )
    );
END;
$$;

COMMIT;
