BEGIN;

DO $$
DECLARE
  enhanced_menu jsonb := '{"code":"content-enhanced","label":"Content Studio Enhanced","icon":"LayoutTemplate","badge":"Beta"}'::jsonb;
  enhanced_panel jsonb := '{
    "id":"user-content-enhanced-panel",
    "type":"UserPanel",
    "props":{"tab":"content-enhanced"},
    "children":[
      {
        "id":"content-enhanced-workspace",
        "type":"EcomProductWorkspace",
        "props":{"mode":"content-studio-enhanced"}
      }
    ]
  }'::jsonb;
  surface_record record;
  entry jsonb;
  next_nav jsonb;
  next_menu jsonb;
  next_children jsonb;
BEGIN
  FOR surface_record IN
    SELECT ui_surface.id, ui_surface.tree
    FROM eip_core.ui_surface ui_surface
    WHERE ui_surface.code = 'dashboard'
      AND ui_surface.is_active = true
      AND ui_surface.is_published = true
  LOOP
    next_nav := '[]'::jsonb;
    FOR entry IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(surface_record.tree #> '{props,nav}', '[]'::jsonb))
    LOOP
      IF entry #>> '{}' <> 'Content Studio Enhanced' THEN
        next_nav := next_nav || jsonb_build_array(entry);
      END IF;
      IF entry #>> '{}' = 'Content Studio' THEN
        next_nav := next_nav || jsonb_build_array(to_jsonb('Content Studio Enhanced'::text));
      END IF;
    END LOOP;

    next_menu := '[]'::jsonb;
    FOR entry IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(surface_record.tree #> '{props,menu}', '[]'::jsonb))
    LOOP
      IF entry->>'code' <> 'content-enhanced' THEN
        next_menu := next_menu || jsonb_build_array(entry);
      END IF;
      IF entry->>'code' = 'content' THEN
        next_menu := next_menu || jsonb_build_array(enhanced_menu);
      END IF;
    END LOOP;

    next_children := '[]'::jsonb;
    FOR entry IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(surface_record.tree->'children', '[]'::jsonb))
    LOOP
      IF entry->>'id' <> 'user-content-enhanced-panel' THEN
        next_children := next_children || jsonb_build_array(entry);
      END IF;
      IF entry->>'id' = 'user-content-panel' THEN
        next_children := next_children || jsonb_build_array(enhanced_panel);
      END IF;
    END LOOP;

    UPDATE eip_core.ui_surface
    SET tree = jsonb_set(
          jsonb_set(
            jsonb_set(surface_record.tree, '{props,nav}', next_nav, true),
            '{props,menu}',
            next_menu,
            true
          ),
          '{children}',
          next_children,
          true
        ),
        attrs = COALESCE(attrs, '{}'::jsonb)
          || '{"content_studio_enhanced_v1":true,"content_studio_legacy_preserved":true}'::jsonb,
        updated_at = now()
    WHERE id = surface_record.id;
  END LOOP;
END;
$$;

COMMIT;
