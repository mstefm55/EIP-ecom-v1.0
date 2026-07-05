BEGIN;

DO $$
DECLARE
  surface_record record;
  root_child jsonb;
  panel_child jsonb;
  next_root_children jsonb;
  next_panel_children jsonb;
BEGIN
  FOR surface_record IN
    SELECT ui_surface.id, ui_surface.tree
    FROM eip_core.ui_surface ui_surface
    WHERE ui_surface.code = 'dashboard'
      AND ui_surface.is_active = true
      AND ui_surface.is_published = true
  LOOP
    next_root_children := '[]'::jsonb;
    FOR root_child IN
      SELECT value FROM jsonb_array_elements(COALESCE(surface_record.tree->'children', '[]'::jsonb))
    LOOP
      IF root_child->>'id' = 'user-content-enhanced-panel' THEN
        next_panel_children := '[]'::jsonb;
        FOR panel_child IN
          SELECT value FROM jsonb_array_elements(COALESCE(root_child->'children', '[]'::jsonb))
        LOOP
          IF panel_child->>'id' = 'content-enhanced-workspace' THEN
            panel_child := jsonb_set(panel_child, '{type}', '"ContentStudioEnhanced"'::jsonb, true);
          END IF;
          next_panel_children := next_panel_children || jsonb_build_array(panel_child);
        END LOOP;
        root_child := jsonb_set(root_child, '{children}', next_panel_children, true);
      END IF;
      next_root_children := next_root_children || jsonb_build_array(root_child);
    END LOOP;

    UPDATE eip_core.ui_surface
    SET tree = jsonb_set(surface_record.tree, '{children}', next_root_children, true),
        attrs = COALESCE(attrs, '{}'::jsonb)
          || '{"content_studio_template_builder_v1":true}'::jsonb,
        updated_at = now()
    WHERE id = surface_record.id;
  END LOOP;
END;
$$;

COMMIT;
