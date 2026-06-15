-- 0131_entity_relationship_mobility_org_chart.sql
-- Purpose: entity relationship mobility and metadata-driven org chart.
-- Uses existing eip_core.agent and eip_core.object_link only. No new tables.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.seed_entity_relationship_dropdown(
  p_list_code text,
  p_list_name text,
  p_values jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  target_list_id uuid;
  item jsonb;
BEGIN
  SELECT dropdown_list.id INTO target_list_id
  FROM eip_core.dropdown_list dropdown_list
  WHERE dropdown_list.tenant_id IS NULL
    AND dropdown_list.module='entity_management'
    AND dropdown_list.code=p_list_code
    AND dropdown_list.version=1
  ORDER BY dropdown_list.created_at ASC
  LIMIT 1;

  IF target_list_id IS NULL THEN
    INSERT INTO eip_core.dropdown_list
      (tenant_id, module, code, name, version, is_active, attrs)
    VALUES
      (
        NULL,
        'entity_management',
        p_list_code,
        p_list_name,
        1,
        true,
        '{"ui":{"module":"entity-management","scope":"entity_relationship_mobility_org_chart_v1"},"extensible":true,"closed_enum":false}'::jsonb
      )
    RETURNING id INTO target_list_id;
  ELSE
    UPDATE eip_core.dropdown_list
    SET name=p_list_name,
        is_active=true,
        attrs=COALESCE(attrs,'{}'::jsonb)
          || '{"ui":{"module":"entity-management","scope":"entity_relationship_mobility_org_chart_v1"},"extensible":true,"closed_enum":false}'::jsonb,
        updated_at=now()
    WHERE id=target_list_id;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_values)
  LOOP
    INSERT INTO eip_core.dropdown_value
      (list_id, code, label, sort_order, is_active, attrs)
    VALUES
      (
        target_list_id,
        item->>'code',
        item->>'label',
        COALESCE((item->>'sort_order')::integer, 100),
        COALESCE((item->>'is_active')::boolean, true),
        COALESCE(item->'attrs', '{}'::jsonb)
      )
    ON CONFLICT (list_id, code) DO UPDATE
      SET label=EXCLUDED.label,
          sort_order=EXCLUDED.sort_order,
          is_active=EXCLUDED.is_active,
          attrs=COALESCE(eip_core.dropdown_value.attrs,'{}'::jsonb) || EXCLUDED.attrs,
          updated_at=now();
  END LOOP;
END;
$$;

SELECT pg_temp.seed_entity_relationship_dropdown('ENTITY_KIND', 'Entity Kind', '[
  {"code":"ORG","label":"Organization","sort_order":10},
  {"code":"PERSON","label":"Person","sort_order":20},
  {"code":"DIVISION","label":"Division","sort_order":30},
  {"code":"DEPARTMENT","label":"Department","sort_order":40},
  {"code":"TEAM","label":"Team","sort_order":50},
  {"code":"SYSTEM","label":"System","sort_order":60},
  {"code":"OTHER","label":"Other","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_entity_relationship_dropdown('ENTITY_RELATIONSHIP_TYPE', 'Entity Relationship Type', '[
  {"code":"RELATED_TO","label":"Related to","sort_order":10},
  {"code":"PARENT_OF","label":"Parent of","sort_order":20,"attrs":{"org_chart_direction":"parent_to_child"}},
  {"code":"SUBSIDIARY_OF","label":"Subsidiary of","sort_order":30,"attrs":{"org_chart_direction":"child_to_parent"}},
  {"code":"MEMBER_OF","label":"Member of","sort_order":40,"attrs":{"org_chart_direction":"child_to_parent","mobile_affiliation":true}},
  {"code":"DIVISION_OF","label":"Division of","sort_order":50,"attrs":{"org_chart_direction":"child_to_parent","mobile_affiliation":true}},
  {"code":"DEPARTMENT_OF","label":"Department of","sort_order":60,"attrs":{"org_chart_direction":"child_to_parent","mobile_affiliation":true}},
  {"code":"TEAM_OF","label":"Team of","sort_order":70,"attrs":{"org_chart_direction":"child_to_parent","mobile_affiliation":true}},
  {"code":"REPORTS_TO","label":"Reports to","sort_order":80,"attrs":{"org_chart_direction":"child_to_parent","mobile_affiliation":true}},
  {"code":"AFFILIATED_TO","label":"Affiliated to","sort_order":90,"attrs":{"org_chart_direction":"child_to_parent","mobile_affiliation":true}},
  {"code":"PART_OF","label":"Part of","sort_order":100,"attrs":{"org_chart_direction":"child_to_parent","mobile_affiliation":true}},
  {"code":"HAS_MEMBER","label":"Has member","sort_order":110,"attrs":{"org_chart_direction":"parent_to_child"}},
  {"code":"OWNS","label":"Owns","sort_order":120,"attrs":{"org_chart_direction":"parent_to_child"}},
  {"code":"MANAGES","label":"Manages","sort_order":130,"attrs":{"org_chart_direction":"parent_to_child"}},
  {"code":"CONTACT_FOR","label":"Contact for","sort_order":140},
  {"code":"WORKS_FOR","label":"Works for","sort_order":150,"attrs":{"org_chart_direction":"child_to_parent","mobile_affiliation":true}},
  {"code":"BILLS_TO","label":"Bills to","sort_order":160},
  {"code":"SUPPLIES_TO","label":"Supplies to","sort_order":170},
  {"code":"SUPPLIER_OF","label":"Supplier of","sort_order":180},
  {"code":"CUSTOMER_OF","label":"Customer of","sort_order":190}
]'::jsonb);

SELECT pg_temp.seed_entity_relationship_dropdown('ENTITY_RELATIONSHIP_SCOPE', 'Entity Relationship Scope', '[
  {"code":"GENERAL","label":"General","sort_order":10},
  {"code":"SELF","label":"Self structure","sort_order":20},
  {"code":"LEGAL","label":"Legal","sort_order":30},
  {"code":"COMMERCIAL","label":"Commercial","sort_order":40},
  {"code":"OPERATIONAL","label":"Operational","sort_order":50}
]'::jsonb);

SELECT pg_temp.seed_entity_relationship_dropdown('ENTITY_STRUCTURE_CATEGORY', 'Entity Structure Category', '[
  {"code":"SELF","label":"Self","sort_order":10},
  {"code":"GROUP","label":"Group","sort_order":20},
  {"code":"TEAM","label":"Team","sort_order":30},
  {"code":"LEGAL","label":"Legal","sort_order":40},
  {"code":"COMMERCIAL","label":"Commercial","sort_order":50},
  {"code":"OPERATIONAL","label":"Operational","sort_order":60}
]'::jsonb);

CREATE INDEX IF NOT EXISTS object_link_entity_relationship_scope_idx
  ON eip_core.object_link (
    tenant_id,
    ((attrs->>'relationship_scope')),
    ((attrs->>'structure_category')),
    is_active,
    relation_type
  )
  WHERE src_kind='agent' AND dst_kind='agent';

CREATE INDEX IF NOT EXISTS object_link_entity_mobile_affiliation_idx
  ON eip_core.object_link (tenant_id, src_id, is_active, relation_type)
  WHERE src_kind='agent'
    AND dst_kind='agent'
    AND (attrs->>'mobile_affiliation')='true';

CREATE OR REPLACE FUNCTION pg_temp.entity_relationship_patch_tabs(
  p_workspace jsonb,
  p_tab_patches jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb := COALESCE(p_workspace, '{}'::jsonb);
  tabs jsonb := COALESCE(result->'tabs', '[]'::jsonb);
  patch jsonb;
BEGIN
  FOR patch IN SELECT value FROM jsonb_array_elements(COALESCE(p_tab_patches, '[]'::jsonb))
  LOOP
    IF COALESCE(patch->>'id', '') = '' THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(tabs) AS tab(value)
      WHERE tab.value->>'id' = patch->>'id'
    ) THEN
      SELECT jsonb_agg(
        CASE
          WHEN tab.value->>'id' = patch->>'id' THEN tab.value || patch
          ELSE tab.value
        END
        ORDER BY tab.ordinality
      )
      INTO tabs
      FROM jsonb_array_elements(tabs) WITH ORDINALITY AS tab(value, ordinality);
    ELSE
      tabs := tabs || jsonb_build_array(patch);
    END IF;
  END LOOP;

  RETURN jsonb_set(result, '{tabs}', tabs, true);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.entity_relationship_patch_workspace(
  p_workspace jsonb,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb := COALESCE(p_workspace, '{}'::jsonb);
BEGIN
  result := jsonb_set(
    result,
    '{layout}',
    COALESCE(result->'layout', '{}'::jsonb) || COALESCE(p_patch->'layout', '{}'::jsonb),
    true
  );

  result := jsonb_set(
    result,
    '{list}',
    COALESCE(result->'list', '{}'::jsonb) || COALESCE(p_patch->'list', '{}'::jsonb),
    true
  );

  IF p_patch ? 'tabs' THEN
    result := pg_temp.entity_relationship_patch_tabs(result, p_patch->'tabs');
  END IF;

  RETURN result;
END;
$$;

WITH relationship_fields(fields) AS (
  VALUES (
    $json$[
      {"name":"related_entity_id","label":"Related entity","type":"lookup","endpoint":"/api/eip/entities","itemsPath":"items","valuePath":"id","labelPath":"display_name","placeholder":"Search entities"},
      {"name":"relation_type","label":"Relationship","type":"select","optionList":"ENTITY_RELATIONSHIP_TYPE","options":["RELATED_TO","PARENT_OF","SUBSIDIARY_OF","MEMBER_OF","DIVISION_OF","DEPARTMENT_OF","TEAM_OF","REPORTS_TO","AFFILIATED_TO","CONTACT_FOR","WORKS_FOR","BILLS_TO","SUPPLIES_TO","SUPPLIER_OF","CUSTOMER_OF"]},
      {"name":"direction","label":"Direction","type":"select","options":["OUTGOING","INCOMING"]},
      {"name":"relationship_scope","label":"Scope","type":"select","optionList":"ENTITY_RELATIONSHIP_SCOPE","options":["GENERAL","SELF","LEGAL","COMMERCIAL","OPERATIONAL"],"defaultValue":"GENERAL"},
      {"name":"structure_category","label":"Structure category","type":"select","optionList":"ENTITY_STRUCTURE_CATEGORY","options":["SELF","GROUP","TEAM","LEGAL","COMMERCIAL","OPERATIONAL"],"defaultValue":"SELF"},
      {"name":"mobile_affiliation","label":"Mobile affiliation","type":"checkbox"},
      {"name":"valid_from","label":"Valid from","type":"date"},
      {"name":"valid_to","label":"Valid to","type":"date"},
      {"name":"movement_reason","label":"Movement reason"},
      {"name":"is_active","label":"Active","type":"checkbox","defaultValue":true}
    ]$json$::jsonb
  )
),
entity_patch AS (
  SELECT jsonb_build_object(
    'layout',
    '{"subtitle":"Customers, suppliers, employees, teams, departments, divisions, partners, authorities, relationship mobility, org structure, documents, policies, and activity."}'::jsonb,
    'list',
    '{"filters":[{"name":"role","label":"Role","optionList":"ENTITY_ROLE","defaultOptionsPath":"roles"},{"name":"status","label":"Status","optionList":"ENTITY_STATUS","defaultOptionsPath":"statuses"},{"name":"entity_kind","label":"Kind","optionList":"ENTITY_KIND","options":["ORG","PERSON","DIVISION","DEPARTMENT","TEAM","SYSTEM","OTHER"]}]}'::jsonb,
    'tabs',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'relationships',
        'label', 'Relationships',
        'icon', 'link',
        'type', 'collection',
        'itemsPath', 'relationships',
        'titlePath', 'related_entity.display_name',
        'subtitlePath', 'related_entity.code',
        'badgePath', 'relation_type',
        'empty', 'No relationships recorded.',
        'createForm', jsonb_build_object(
          'title', 'Add relationship',
          'endpoint', '/api/eip/entities/:id/relationships',
          'method', 'POST',
          'permission', 'entities.manage_relationships',
          'submitLabel', 'Add relationship',
          'fields', relationship_fields.fields
        ),
        'updateForm', jsonb_build_object(
          'title', 'Update relationship',
          'endpoint', '/api/eip/entities/:id/relationships/:rowId',
          'method', 'PATCH',
          'permission', 'entities.manage_relationships',
          'submitLabel', 'Save relationship',
          'resetOnSave', false,
          'fields', relationship_fields.fields
        )
      ),
      '{
        "id":"org_chart",
        "label":"Org Chart",
        "icon":"layers",
        "type":"org_chart",
        "itemsPath":"org_chart",
        "endpoint":"/api/eip/entities/:id/org-chart?relationship_scope=SELF&structure_category=SELF",
        "moveEndpoint":"/api/eip/entities/:id/org-chart/move",
        "moveMethod":"POST",
        "moveRelationType":"MEMBER_OF",
        "relationshipScope":"SELF",
        "structureCategory":"SELF",
        "permission":"entities.manage_relationships",
        "empty":"No self-structure relationships recorded."
      }'::jsonb
    )
  ) AS patch
  FROM relationship_fields
)
UPDATE eip_core.module_catalog catalog
SET attrs = jsonb_set(
      jsonb_set(
        COALESCE(catalog.attrs, '{}'::jsonb),
        '{capabilities}',
        COALESCE(catalog.attrs->'capabilities','{}'::jsonb)
          || '{"relationship_mobility":true,"org_chart":true,"self_structure":true}'::jsonb,
        true
      ),
      '{ui_workspace}',
      pg_temp.entity_relationship_patch_workspace(COALESCE(catalog.attrs->'ui_workspace', '{}'::jsonb), entity_patch.patch),
      true
    ),
    updated_at = now()
FROM entity_patch
WHERE catalog.code='entity-management';

WITH catalog_workspace AS (
  SELECT attrs->'ui_workspace' AS workspace
  FROM eip_core.module_catalog
  WHERE code='entity-management'
)
UPDATE eip_core.tenant_module_setting setting
SET attrs = jsonb_set(
      jsonb_set(
        COALESCE(setting.attrs, '{}'::jsonb),
        '{capabilities}',
        COALESCE(setting.attrs->'capabilities','{}'::jsonb)
          || '{"relationship_mobility":true,"org_chart":true,"self_structure":true}'::jsonb,
        true
      ),
      '{ui_workspace}',
      catalog_workspace.workspace,
      true
    ),
    updated_at=now()
FROM catalog_workspace
WHERE setting.module='entity-management'
  AND catalog_workspace.workspace IS NOT NULL;

COMMIT;
