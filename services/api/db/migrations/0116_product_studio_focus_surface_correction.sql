-- 0116_product_studio_focus_surface_correction.sql
-- Metadata-only correction: Product Studio should expose Studio + Focus only.

BEGIN;

DO $$
DECLARE
  product_studio_props jsonb := '{
    "tabs": [
      { "id": "studio", "label": "Studio" },
      { "id": "focus", "label": "Focus" }
    ],
    "focusRules": [
      { "code": "rejected", "label": "Rejected products", "action": "Review rejection" },
      { "code": "pending_publish", "label": "Pending publish", "action": "Open publish task" },
      { "code": "missing_trade_conditions", "label": "Missing trade conditions", "action": "Complete trade terms" },
      { "code": "missing_category", "label": "Missing category/type", "action": "Complete setup" },
      { "code": "inventory_setup", "label": "Physical inventory setup", "action": "Complete initial inventory" }
    ],
    "tradeConditions": {
      "title": "Trade conditions",
      "subtitle": "Commercial rules, pricing terms, supplier/customer terms, validity, and renewal tasks."
    }
  }'::jsonb;
  surface_record record;
  root_children jsonb;
BEGIN
  FOR surface_record IN
    SELECT ui_surface.id, ui_surface.tree
    FROM eip_core.ui_surface ui_surface
    WHERE ui_surface.code='dashboard'
      AND ui_surface.is_active=true
      AND ui_surface.is_published=true
  LOOP
    root_children := COALESCE(surface_record.tree->'children', '[]'::jsonb);

    SELECT jsonb_agg(
      CASE
        WHEN root_child->>'id' = 'user-catalog-panel' THEN
          jsonb_set(
            root_child,
            '{children}',
            COALESCE((
              SELECT jsonb_agg(
                CASE
                  WHEN panel_child->>'id' = 'catalog-workspace'
                    OR panel_child->>'type' = 'EcomProductWorkspace'
                  THEN jsonb_set(
                    panel_child,
                    '{props}',
                    COALESCE(panel_child->'props', '{}'::jsonb)
                    || jsonb_build_object('productStudio', product_studio_props),
                    true
                  )
                  ELSE panel_child
                END
              )
              FROM jsonb_array_elements(COALESCE(root_child->'children', '[]'::jsonb)) panel_child
            ), '[]'::jsonb),
            true
          )
        ELSE root_child
      END
    )
    INTO root_children
    FROM jsonb_array_elements(root_children) root_child;

    UPDATE eip_core.ui_surface
    SET tree=jsonb_set(surface_record.tree, '{children}', root_children, true),
        attrs=COALESCE(attrs, '{}'::jsonb) || '{
          "module":"dashboard",
          "product_studio_focus_surface_correction":true
        }'::jsonb,
        updated_at=now()
    WHERE id=surface_record.id;
  END LOOP;
END;
$$;

COMMIT;
