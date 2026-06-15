-- 0130_kernel_ux_shell_v1.sql
-- Purpose: metadata-only upgrade for the generic KernelModuleWorkspace shell.
-- No tables, no destructive changes, no fake/demo data.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.kernel_ux_patch_tabs(
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
  IF p_tab_patches IS NULL OR jsonb_typeof(p_tab_patches) <> 'array' THEN
    RETURN result;
  END IF;

  FOR patch IN SELECT value FROM jsonb_array_elements(p_tab_patches)
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

CREATE OR REPLACE FUNCTION pg_temp.kernel_ux_patch_workspace(
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

  result := jsonb_set(
    result,
    '{detail}',
    COALESCE(result->'detail', '{}'::jsonb) || COALESCE(p_patch->'detail', '{}'::jsonb),
    true
  );

  IF p_patch ? 'tabs' THEN
    result := pg_temp.kernel_ux_patch_tabs(result, p_patch->'tabs');
  END IF;

  RETURN result;
END;
$$;

WITH patches(module, patch) AS (
  VALUES
    (
      'entity-management',
      $json${
        "layout":{
          "icon":"building",
          "processHealth":{"label":"Entity lifecycle","path":"item.status","fallback":"Registry ready","format":"label"},
          "metrics":[
            {"label":"Entities","path":"items.length","format":"number","icon":"building"},
            {"label":"Contacts","path":"summary.contacts","format":"number","icon":"users"},
            {"label":"Open tasks","path":"activity_summary.tasks.open","format":"number","icon":"activity"}
          ]
        },
        "list":{
          "meta":[
            {"label":"Roles","path":"roles","format":"array"},
            {"label":"Kind","path":"entity_kind","format":"label"}
          ]
        },
        "detail":{
          "meta":[
            {"label":"Roles","path":"item.roles","format":"array"},
            {"label":"Kind","path":"item.entity_kind","format":"label"},
            {"label":"Country","path":"item.country_code"},
            {"label":"Currency","path":"item.currency_code"}
          ],
          "process":{
            "label":"Entity intent",
            "stage":{"path":"item.status","format":"label"},
            "nextAction":{"path":"summary.next_action","fallback":"Complete profile, contacts, relationships, policies, and activity"},
            "blocked":{"path":"summary.missing_data","format":"array"},
            "approval":{"path":"policy_summary.resolution_status","format":"label"},
            "taskCount":{"path":"activity_summary.tasks.open","format":"number"}
          },
          "overviewCards":[
            {"label":"Contacts","path":"summary.contacts","format":"number","icon":"users"},
            {"label":"Addresses","path":"summary.addresses","format":"number","icon":"link"},
            {"label":"Relationships","path":"summary.relationships","format":"number","icon":"layers"},
            {"label":"Open tasks","path":"activity_summary.tasks.open","format":"number","icon":"activity"}
          ]
        }
      }$json$::jsonb
    ),
    (
      'inventory',
      $json${
        "layout":{
          "icon":"package",
          "processHealth":{"label":"Stock flow","path":"item.stock_profile.risk_status","fallback":"Stock monitored","format":"label"},
          "metrics":[
            {"label":"Materials","path":"items.length","format":"number","icon":"package"},
            {"label":"On hand","path":"item.stock_profile.stock_on_hand","unitPath":"item.stock_profile.unit_of_measure","format":"quantity","icon":"boxes"},
            {"label":"Risk","path":"item.stock_profile.risk_status","format":"label","icon":"reorder"}
          ]
        },
        "list":{
          "meta":[
            {"label":"Type","path":"material_type","format":"label"},
            {"label":"On hand","path":"stock_profile.stock_on_hand","unitPath":"stock_profile.unit_of_measure","format":"quantity"}
          ]
        },
        "detail":{
          "meta":[
            {"label":"Type","path":"item.material_type","format":"label"},
            {"label":"Available","path":"item.stock_profile.available_qty","unitPath":"item.stock_profile.unit_of_measure","format":"quantity"},
            {"label":"Supplier","path":"item.default_supplier_name"},
            {"label":"Policy source","path":"item.stock_profile.policy_source","format":"label"}
          ],
          "process":{
            "label":"Inventory intent",
            "stage":{"path":"item.stock_profile.risk_status","fallback":"Stock monitored","format":"label"},
            "nextAction":{"path":"item.stock_profile.next_action","fallback":"Review stock, reorder policy, and procurement bridge"},
            "blocked":{"path":"item.stock_profile.missing_data","format":"array"},
            "approval":{"path":"policy_summary.effective_read_model.resolution_status","format":"label"},
            "taskCount":{"path":"summary.tasks.open","format":"number"}
          },
          "overviewCards":[
            {"label":"On hand","path":"item.stock_profile.stock_on_hand","unitPath":"item.stock_profile.unit_of_measure","format":"quantity","icon":"boxes"},
            {"label":"Available","path":"item.stock_profile.available_qty","unitPath":"item.stock_profile.unit_of_measure","format":"quantity","icon":"check"},
            {"label":"Reorder point","path":"item.stock_profile.reorder_point","unitPath":"item.stock_profile.unit_of_measure","format":"quantity","icon":"reorder"},
            {"label":"Lots","path":"summary.lots.total","format":"number","icon":"layers"}
          ]
        }
      }$json$::jsonb
    ),
    (
      'procurement',
      $json${
        "layout":{
          "icon":"shopping-cart",
          "processHealth":{"label":"Sourcing flow","path":"summary.next_action.label","fallback":"Workflow ready"},
          "metrics":[
            {"label":"Needs","path":"items.length","format":"number","icon":"shopping-cart"},
            {"label":"Selected status","path":"item.status","format":"label","icon":"dot"},
            {"label":"Open tasks","path":"activity.summary.open_tasks","format":"number","icon":"activity"}
          ]
        },
        "list":{
          "meta":[
            {"label":"Priority","path":"priority","format":"label"},
            {"label":"Item","path":"item_type","format":"label"}
          ]
        },
        "detail":{
          "meta":[
            {"label":"Supplier","path":"item.supplier_name"},
            {"label":"Payment terms","path":"commercial_terms.payment_terms_code"},
            {"label":"Incoterm","path":"commercial_terms.incoterm_code"},
            {"label":"Approval","path":"approval.status","format":"label"}
          ],
          "process":{
            "label":"Procurement intent",
            "stage":{"path":"item.status","format":"label"},
            "nextAction":{"path":"summary.next_action.label","fallback":"Review supplier, terms, and approval path"},
            "blocked":{"path":"recommendation.missing_data","format":"array"},
            "approval":{"path":"approval.status","format":"label"},
            "taskCount":{"path":"activity.summary.open_tasks","format":"number"}
          },
          "overviewCards":[
            {"label":"Buying route","path":"recommendation.procurement_model","format":"label","icon":"reorder"},
            {"label":"Selected supplier","path":"item.supplier_name","icon":"users"},
            {"label":"Approval","path":"approval.status","format":"label","icon":"policy"},
            {"label":"Documents","path":"documents.length","format":"number","icon":"document"}
          ]
        }
      }$json$::jsonb
    ),
    (
      'policies-conditions',
      $json${
        "layout":{
          "icon":"policy",
          "processHealth":{"label":"Policy read model","path":"item.mapping_status","fallback":"Governed","format":"label"},
          "metrics":[
            {"label":"Conditions","path":"items.length","format":"number","icon":"policy"},
            {"label":"Domain","path":"item.classification.policy_domain","format":"label","icon":"layers"},
            {"label":"Mapping","path":"item.mapping_status","format":"label","icon":"check"}
          ]
        },
        "list":{
          "meta":[
            {"label":"Domain","path":"classification.policy_domain","format":"label"},
            {"label":"Nature","path":"classification.condition_nature","format":"label"}
          ]
        },
        "detail":{
          "meta":[
            {"label":"Domain","path":"item.classification.policy_domain","format":"label"},
            {"label":"Family","path":"item.classification.policy_family","format":"label"},
            {"label":"Type","path":"item.classification.condition_type","format":"label"},
            {"label":"Status","path":"item.status","format":"label"}
          ],
          "process":{
            "label":"Policy intent",
            "stage":{"path":"item.mapping_status","format":"label"},
            "nextAction":{"path":"item.next_action","fallback":"Review scope, values, and effective condition impact"},
            "blocked":{"path":"item.warnings","format":"array"},
            "approval":{"path":"item.classification.policy_domain","format":"label"},
            "taskCount":{"value":0,"format":"number"}
          },
          "overviewCards":[
            {"label":"Domain","path":"item.classification.policy_domain","format":"label","icon":"policy"},
            {"label":"Condition type","path":"item.classification.condition_type","format":"label","icon":"file"},
            {"label":"Scope fields","path":"item.scope_summary.length","format":"number","icon":"link"},
            {"label":"Warnings","path":"item.warnings.length","format":"number","icon":"alert"}
          ]
        }
      }$json$::jsonb
    ),
    (
      'crm',
      $json${
        "layout":{
          "icon":"pipeline",
          "processHealth":{"label":"CRM flow","value":"Pipeline ready"},
          "metrics":[
            {"label":"Accounts","path":"items.length","format":"number","icon":"building"},
            {"label":"Open opportunities","path":"summary.open_opportunities","format":"number","icon":"pipeline"},
            {"label":"Open activities","path":"summary.open_activities","format":"number","icon":"activity"}
          ]
        },
        "list":{
          "meta":[
            {"label":"Roles","path":"roles","format":"array"},
            {"label":"Country","path":"country_code"}
          ]
        },
        "detail":{
          "meta":[
            {"label":"Roles","path":"item.roles","format":"array"},
            {"label":"Currency","path":"item.currency_code"},
            {"label":"Source","path":"item.source","format":"label"}
          ],
          "process":{
            "label":"CRM intent",
            "stage":{"path":"item.status","format":"label"},
            "nextAction":{"path":"summary.next_action","fallback":"Qualify account, update opportunity, or schedule activity"},
            "blocked":{"path":"summary.blocked_reasons","format":"array"},
            "approval":{"path":"policy_summary.domains.COMMERCIAL.resolution_status","format":"label"},
            "taskCount":{"path":"summary.open_activities","format":"number"}
          },
          "overviewCards":[
            {"label":"Contacts","path":"summary.contacts","format":"number","icon":"users"},
            {"label":"Open opportunities","path":"summary.open_opportunities","format":"number","icon":"pipeline"},
            {"label":"Pipeline value","path":"summary.pipeline_value","format":"number","icon":"trend"},
            {"label":"Commercial conditions","path":"summary.commercial_conditions","format":"number","icon":"policy"}
          ]
        },
        "tabs":[
          {"id":"communications","label":"Communications","icon":"mail","type":"communications","itemsPath":"communications","titlePath":"title","subtitlePath":"record_type","badgePath":"relation_type","disabledMessage":"Communication provider not configured"}
        ]
      }$json$::jsonb
    )
)
UPDATE eip_core.module_catalog catalog
SET attrs = jsonb_set(
      COALESCE(catalog.attrs, '{}'::jsonb),
      '{ui_workspace}',
      pg_temp.kernel_ux_patch_workspace(COALESCE(catalog.attrs->'ui_workspace', '{}'::jsonb), patches.patch),
      true
    ),
    updated_at = now()
FROM patches
WHERE catalog.code = patches.module;

WITH catalog_workspaces AS (
  SELECT code, attrs->'ui_workspace' AS workspace
  FROM eip_core.module_catalog
  WHERE code IN ('entity-management', 'inventory', 'procurement', 'policies-conditions', 'crm')
)
UPDATE eip_core.tenant_module_setting setting
SET attrs = jsonb_set(
      COALESCE(setting.attrs, '{}'::jsonb),
      '{ui_workspace}',
      catalog_workspaces.workspace,
      true
    ),
    updated_at = now()
FROM catalog_workspaces
WHERE setting.module = catalog_workspaces.code
  AND catalog_workspaces.workspace IS NOT NULL;

COMMIT;
