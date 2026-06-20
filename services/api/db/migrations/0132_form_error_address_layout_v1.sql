-- 0132_form_error_address_layout_v1.sql
-- Purpose: metadata-only patch for kernel form field validation hints and address layout.
-- No tables, no destructive changes, no fake/demo data.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.form_error_address_patch_fields(
  p_fields jsonb,
  p_field_patches jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  fields jsonb := COALESCE(p_fields, '[]'::jsonb);
BEGIN
  IF jsonb_typeof(fields) <> 'array' THEN
    RETURN fields;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN patch.patch IS NULL THEN field.value
        ELSE field.value || (patch.patch - 'name')
      END
      ORDER BY field.ordinality
    ),
    '[]'::jsonb
  )
  INTO result
  FROM jsonb_array_elements(fields) WITH ORDINALITY AS field(value, ordinality)
  LEFT JOIN LATERAL (
    SELECT patch_item.value AS patch
    FROM jsonb_array_elements(COALESCE(p_field_patches, '[]'::jsonb)) AS patch_item(value)
    WHERE patch_item.value->>'name' = field.value->>'name'
    LIMIT 1
  ) patch ON true;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.form_error_address_patch_collection_tab(
  p_tab jsonb,
  p_field_patches jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb := COALESCE(p_tab, '{}'::jsonb);
  form_key text;
BEGIN
  FOREACH form_key IN ARRAY ARRAY['createForm', 'updateForm']
  LOOP
    IF jsonb_typeof(result#>ARRAY[form_key, 'fields']::text[]) = 'array' THEN
      result := jsonb_set(
        result,
        ARRAY[form_key, 'fields']::text[],
        pg_temp.form_error_address_patch_fields(result#>ARRAY[form_key, 'fields']::text[], p_field_patches),
        true
      );
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.form_error_address_patch_workspace(
  p_workspace jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb := COALESCE(p_workspace, '{}'::jsonb);
  tabs jsonb := COALESCE(result->'tabs', '[]'::jsonb);
  field_patches jsonb := $json$[
    {"name":"label","maxLength":120},
    {"name":"line1","span":"full","maxLength":240},
    {"name":"line2","span":"full","maxLength":240},
    {"name":"city","maxLength":120},
    {"name":"state_region","maxLength":120},
    {"name":"postal_code","maxLength":40},
    {"name":"country_code","maxLength":2}
  ]$json$::jsonb;
BEGIN
  IF jsonb_typeof(tabs) <> 'array' THEN
    RETURN result;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN tab.value->>'id' = 'addresses' THEN pg_temp.form_error_address_patch_collection_tab(tab.value, field_patches)
        ELSE tab.value
      END
      ORDER BY tab.ordinality
    ),
    '[]'::jsonb
  )
  INTO tabs
  FROM jsonb_array_elements(tabs) WITH ORDINALITY AS tab(value, ordinality);

  RETURN jsonb_set(result, '{tabs}', tabs, true);
END;
$$;

UPDATE eip_core.module_catalog
SET attrs = jsonb_set(
      COALESCE(attrs, '{}'::jsonb),
      '{ui_workspace}',
      pg_temp.form_error_address_patch_workspace(attrs->'ui_workspace'),
      true
    ),
    updated_at = now()
WHERE code = 'entity-management'
  AND COALESCE(attrs, '{}'::jsonb) ? 'ui_workspace';

WITH catalog_workspace AS (
  SELECT attrs->'ui_workspace' AS workspace
  FROM eip_core.module_catalog
  WHERE code = 'entity-management'
)
UPDATE eip_core.tenant_module_setting setting
SET attrs = jsonb_set(
      COALESCE(setting.attrs, '{}'::jsonb),
      '{ui_workspace}',
      pg_temp.form_error_address_patch_workspace(
        COALESCE(setting.attrs->'ui_workspace', catalog_workspace.workspace, '{}'::jsonb)
      ),
      true
    ),
    updated_at = now()
FROM catalog_workspace
WHERE setting.module = 'entity-management';

COMMIT;
