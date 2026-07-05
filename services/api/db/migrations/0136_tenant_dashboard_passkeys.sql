BEGIN;

DO $$
DECLARE
  security_menu jsonb := '{"code":"security","label":"Security","icon":"Shield"}'::jsonb;
  security_panel jsonb := '{
    "id":"user-security-panel",
    "type":"UserPanel",
    "props":{"tab":"security"},
    "children":[
      {
        "id":"user-security",
        "type":"UserSecurityPanel"
      }
    ]
  }'::jsonb;
  surface_record record;
  entry jsonb;
  next_nav jsonb;
  next_menu jsonb;
  next_children jsonb;
  inserted boolean;
BEGIN
  FOR surface_record IN
    SELECT ui_surface.id, ui_surface.tree
    FROM eip_core.ui_surface ui_surface
    WHERE ui_surface.code = 'dashboard'
      AND ui_surface.is_active = true
      AND ui_surface.is_published = true
  LOOP
    next_nav := '[]'::jsonb;
    inserted := false;
    FOR entry IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(surface_record.tree #> '{props,nav}', '[]'::jsonb))
    LOOP
      IF entry #>> '{}' <> 'Security' THEN
        IF entry #>> '{}' = 'Settings' THEN
          next_nav := next_nav || jsonb_build_array(to_jsonb('Security'::text));
          inserted := true;
        END IF;
        next_nav := next_nav || jsonb_build_array(entry);
      END IF;
    END LOOP;
    IF NOT inserted THEN
      next_nav := next_nav || jsonb_build_array(to_jsonb('Security'::text));
    END IF;

    next_menu := '[]'::jsonb;
    inserted := false;
    FOR entry IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(surface_record.tree #> '{props,menu}', '[]'::jsonb))
    LOOP
      IF entry->>'code' <> 'security' THEN
        IF entry->>'code' = 'settings' THEN
          next_menu := next_menu || jsonb_build_array(security_menu);
          inserted := true;
        END IF;
        next_menu := next_menu || jsonb_build_array(entry);
      END IF;
    END LOOP;
    IF NOT inserted THEN
      next_menu := next_menu || jsonb_build_array(security_menu);
    END IF;

    next_children := '[]'::jsonb;
    inserted := false;
    FOR entry IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(surface_record.tree->'children', '[]'::jsonb))
    LOOP
      IF entry->>'id' <> 'user-security-panel' THEN
        IF entry->>'id' = 'user-settings-panel' THEN
          next_children := next_children || jsonb_build_array(security_panel);
          inserted := true;
        END IF;
        next_children := next_children || jsonb_build_array(entry);
      END IF;
    END LOOP;
    IF NOT inserted THEN
      next_children := next_children || jsonb_build_array(security_panel);
    END IF;

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
          || '{"tenant_passkeys_v1":true}'::jsonb,
        updated_at = now()
    WHERE id = surface_record.id;
  END LOOP;
END;
$$;

COMMIT;
