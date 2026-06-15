-- 0128_crm_management_v1.sql
-- Purpose: CRM Management V1 operational API/UI metadata.
-- Uses existing kernel tables only: agent, entity_contact, service_object,
-- task, info_record, object_link, commercial_condition, dropdowns, and
-- module settings. No CRM-only customer/prospect tables are introduced.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.seed_crm_management_dropdown(
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
    AND dropdown_list.code=p_list_code
  ORDER BY (dropdown_list.module='crm') DESC, dropdown_list.version DESC, dropdown_list.created_at ASC
  LIMIT 1;

  IF target_list_id IS NULL THEN
    INSERT INTO eip_core.dropdown_list
      (tenant_id, module, code, name, version, is_active, attrs)
    VALUES
      (NULL, 'crm', p_list_code, p_list_name, 1, true, '{"ui":{"module":"crm","scope":"crm_management_v1"},"extensible":true}'::jsonb)
    RETURNING id INTO target_list_id;
  ELSE
    UPDATE eip_core.dropdown_list
    SET name=p_list_name,
        is_active=true,
        attrs=COALESCE(attrs,'{}'::jsonb) || '{"ui":{"module":"crm","scope":"crm_management_v1"},"extensible":true}'::jsonb,
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

SELECT pg_temp.seed_crm_management_dropdown('CRM_ACCOUNT_STATUS', 'CRM Account Status', '[
  {"code":"PROSPECT","label":"Prospect","sort_order":10},
  {"code":"ACTIVE_CUSTOMER","label":"Active customer","sort_order":20},
  {"code":"INACTIVE_CUSTOMER","label":"Inactive customer","sort_order":30},
  {"code":"UNDER_REVIEW","label":"Under review","sort_order":40},
  {"code":"BLOCKED","label":"Blocked","sort_order":50},
  {"code":"ARCHIVED","label":"Archived","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_crm_management_dropdown('CRM_OPPORTUNITY_STATUS', 'CRM Opportunity Status', '[
  {"code":"new","label":"New","sort_order":10},
  {"code":"qualifying","label":"Qualifying","sort_order":20},
  {"code":"proposal","label":"Proposal","sort_order":30},
  {"code":"negotiation","label":"Negotiation","sort_order":40},
  {"code":"won","label":"Won","sort_order":80},
  {"code":"lost","label":"Lost","sort_order":90},
  {"code":"cancelled","label":"Cancelled","sort_order":95},
  {"code":"archived","label":"Archived","sort_order":100}
]'::jsonb);

SELECT pg_temp.seed_crm_management_dropdown('TASK_STATUS', 'Task Status', '[
  {"code":"open","label":"Open","sort_order":10},
  {"code":"in_progress","label":"In progress","sort_order":20},
  {"code":"done","label":"Done","sort_order":80},
  {"code":"cancelled","label":"Cancelled","sort_order":90},
  {"code":"blocked","label":"Blocked","sort_order":95}
]'::jsonb);

SELECT pg_temp.seed_crm_management_dropdown('ENTITY_ROLE', 'Entity Role', '[
  {"code":"PROSPECT","label":"Prospect","sort_order":5},
  {"code":"CUSTOMER","label":"Customer","sort_order":10},
  {"code":"PARTNER","label":"Partner","sort_order":30},
  {"code":"LEAD_SOURCE","label":"Lead source","sort_order":35},
  {"code":"OTHER","label":"Other","sort_order":90}
]'::jsonb);

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('crm.read', 'Read CRM Management', 'View CRM accounts, contacts, opportunities, activities, summaries, and pipeline'),
  ('crm.account.create', 'Create CRM accounts', 'Create CRM accounts on the agent backbone'),
  ('crm.account.update', 'Update CRM accounts', 'Update CRM account profile, lifecycle, and classification metadata'),
  ('crm.contact.manage', 'Manage CRM contacts', 'Create and update CRM account contact methods'),
  ('crm.opportunity.create', 'Create CRM opportunities', 'Create CRM opportunities on the service object backbone'),
  ('crm.opportunity.update', 'Update CRM opportunities', 'Update CRM opportunity lifecycle, value, and forecast metadata'),
  ('crm.activity.create', 'Create CRM activities', 'Create CRM follow-up activities on the task backbone'),
  ('crm.activity.update', 'Update CRM activities', 'Update CRM task status, assignment, due date, and notes'),
  ('crm.convert', 'Convert CRM opportunities', 'Record governed CRM opportunity conversion intent'),
  ('crm.policy.read', 'Read CRM policy summaries', 'View CRM effective policy summaries without raw legal text')
ON CONFLICT (code) DO UPDATE
SET label=EXCLUDED.label,
    description=EXCLUDED.description;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','crm.read'), ('ADMIN_SUPER','crm.account.create'), ('ADMIN_SUPER','crm.account.update'),
    ('ADMIN_SUPER','crm.contact.manage'), ('ADMIN_SUPER','crm.opportunity.create'), ('ADMIN_SUPER','crm.opportunity.update'),
    ('ADMIN_SUPER','crm.activity.create'), ('ADMIN_SUPER','crm.activity.update'), ('ADMIN_SUPER','crm.convert'),
    ('ADMIN_SUPER','crm.policy.read'),
    ('ACCESS_UNIVERSAL','crm.read'), ('ACCESS_UNIVERSAL','crm.account.create'), ('ACCESS_UNIVERSAL','crm.account.update'),
    ('ACCESS_UNIVERSAL','crm.contact.manage'), ('ACCESS_UNIVERSAL','crm.opportunity.create'), ('ACCESS_UNIVERSAL','crm.opportunity.update'),
    ('ACCESS_UNIVERSAL','crm.activity.create'), ('ACCESS_UNIVERSAL','crm.activity.update'), ('ACCESS_UNIVERSAL','crm.convert'),
    ('ACCESS_UNIVERSAL','crm.policy.read'),
    ('CRM_ADMIN','crm.read'), ('CRM_ADMIN','crm.account.create'), ('CRM_ADMIN','crm.account.update'),
    ('CRM_ADMIN','crm.contact.manage'), ('CRM_ADMIN','crm.opportunity.create'), ('CRM_ADMIN','crm.opportunity.update'),
    ('CRM_ADMIN','crm.activity.create'), ('CRM_ADMIN','crm.activity.update'), ('CRM_ADMIN','crm.convert'),
    ('CRM_ADMIN','crm.policy.read'),
    ('CRM_USER','crm.read'), ('CRM_USER','crm.account.create'), ('CRM_USER','crm.account.update'),
    ('CRM_USER','crm.contact.manage'), ('CRM_USER','crm.opportunity.create'), ('CRM_USER','crm.opportunity.update'),
    ('CRM_USER','crm.activity.create'), ('CRM_USER','crm.activity.update'), ('CRM_USER','crm.convert'),
    ('CRM_USER','crm.policy.read'),
    ('ACCESS_CRM_FULL','crm.read'), ('ACCESS_CRM_FULL','crm.account.create'), ('ACCESS_CRM_FULL','crm.account.update'),
    ('ACCESS_CRM_FULL','crm.contact.manage'), ('ACCESS_CRM_FULL','crm.opportunity.create'), ('ACCESS_CRM_FULL','crm.opportunity.update'),
    ('ACCESS_CRM_FULL','crm.activity.create'), ('ACCESS_CRM_FULL','crm.activity.update'), ('ACCESS_CRM_FULL','crm.convert'),
    ('ACCESS_CRM_FULL','crm.policy.read'),
    ('ACCESS_READ_ONLY','crm.read'), ('ACCESS_READ_ONLY','crm.policy.read')
)
INSERT INTO eip_authz.role_template_permission(role_code, permission_code)
SELECT role_template.code, bundles.permission_code
FROM bundles
JOIN eip_authz.role_template role_template ON role_template.code=bundles.role_code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','crm.read'), ('ADMIN_SUPER','crm.account.create'), ('ADMIN_SUPER','crm.account.update'),
    ('ADMIN_SUPER','crm.contact.manage'), ('ADMIN_SUPER','crm.opportunity.create'), ('ADMIN_SUPER','crm.opportunity.update'),
    ('ADMIN_SUPER','crm.activity.create'), ('ADMIN_SUPER','crm.activity.update'), ('ADMIN_SUPER','crm.convert'),
    ('ADMIN_SUPER','crm.policy.read'),
    ('ACCESS_UNIVERSAL','crm.read'), ('ACCESS_UNIVERSAL','crm.account.create'), ('ACCESS_UNIVERSAL','crm.account.update'),
    ('ACCESS_UNIVERSAL','crm.contact.manage'), ('ACCESS_UNIVERSAL','crm.opportunity.create'), ('ACCESS_UNIVERSAL','crm.opportunity.update'),
    ('ACCESS_UNIVERSAL','crm.activity.create'), ('ACCESS_UNIVERSAL','crm.activity.update'), ('ACCESS_UNIVERSAL','crm.convert'),
    ('ACCESS_UNIVERSAL','crm.policy.read'),
    ('CRM_ADMIN','crm.read'), ('CRM_ADMIN','crm.account.create'), ('CRM_ADMIN','crm.account.update'),
    ('CRM_ADMIN','crm.contact.manage'), ('CRM_ADMIN','crm.opportunity.create'), ('CRM_ADMIN','crm.opportunity.update'),
    ('CRM_ADMIN','crm.activity.create'), ('CRM_ADMIN','crm.activity.update'), ('CRM_ADMIN','crm.convert'),
    ('CRM_ADMIN','crm.policy.read'),
    ('CRM_USER','crm.read'), ('CRM_USER','crm.account.create'), ('CRM_USER','crm.account.update'),
    ('CRM_USER','crm.contact.manage'), ('CRM_USER','crm.opportunity.create'), ('CRM_USER','crm.opportunity.update'),
    ('CRM_USER','crm.activity.create'), ('CRM_USER','crm.activity.update'), ('CRM_USER','crm.convert'),
    ('CRM_USER','crm.policy.read'),
    ('ACCESS_CRM_FULL','crm.read'), ('ACCESS_CRM_FULL','crm.account.create'), ('ACCESS_CRM_FULL','crm.account.update'),
    ('ACCESS_CRM_FULL','crm.contact.manage'), ('ACCESS_CRM_FULL','crm.opportunity.create'), ('ACCESS_CRM_FULL','crm.opportunity.update'),
    ('ACCESS_CRM_FULL','crm.activity.create'), ('ACCESS_CRM_FULL','crm.activity.update'), ('ACCESS_CRM_FULL','crm.convert'),
    ('ACCESS_CRM_FULL','crm.policy.read'),
    ('ACCESS_READ_ONLY','crm.read'), ('ACCESS_READ_ONLY','crm.policy.read')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT role_record.id, bundles.permission_code
FROM bundles
JOIN eip_authz.role role_record ON role_record.code=bundles.role_code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

INSERT INTO eip_core.module_catalog (code, label, description, attrs, is_active)
VALUES
  (
    'crm',
    'CRM',
    'CRM accounts, contacts, opportunities, pipeline, activities, policies, documents, and conversion intent',
    $crm_module${
      "capabilities":{"overview":true,"account_crud":true,"contact_management":true,"opportunity_crud":true,"pipeline":true,"activities":true,"communications":true,"documents":true,"effective_policy":true,"conversion_intent":true},
      "scope":"crm_management_v1",
      "ui_workspace":{
        "layout":{"eyebrow":"CRM Management","title":"CRM","subtitle":"Accounts, contacts, opportunities, pipeline, activities, policy context, documents, and governed conversion intent."},
        "list":{"endpoint":"/api/eip/crm/accounts","itemsPath":"items","limit":50,"icon":"building","titlePath":"display_name","subtitlePath":"code","badgePath":"status","searchPlaceholder":"Search accounts","filters":[{"name":"status","label":"Status","optionList":"CRM_ACCOUNT_STATUS","uppercaseOptions":true,"defaultOptionsPath":"account_statuses"},{"name":"role","label":"Role","optionList":"ENTITY_ROLE","uppercaseOptions":true,"defaultOptionsPath":"account_roles"}]},
        "detail":{"endpoint":"/api/eip/crm/accounts/:id","titlePath":"display_name","subtitlePath":"code","badgePath":"status","emptyLabel":"Select an account."},
        "actions":{"create":{"label":"Create account","title":"Create account","endpoint":"/api/eip/crm/accounts","method":"POST","permission":"crm.account.create","fields":[{"name":"entity_kind","label":"Kind","type":"select","optionList":"ENTITY_KIND","uppercaseOptions":true,"options":["ORG","PERSON"],"defaultValue":"ORG"},{"name":"code","label":"Code"},{"name":"display_name","label":"Display name"},{"name":"legal_name","label":"Legal name"},{"name":"roles","label":"Roles","type":"multiselect","optionList":"ENTITY_ROLE","uppercaseOptions":true,"defaultOptionsPath":"account_roles","defaultValue":["PROSPECT"]},{"name":"status","label":"Status","type":"select","optionList":"CRM_ACCOUNT_STATUS","uppercaseOptions":true,"defaultOptionsPath":"account_statuses","defaultValue":"PROSPECT"},{"name":"source","label":"Source"},{"name":"website","label":"Website","type":"url"},{"name":"country_code","label":"Country"},{"name":"currency_code","label":"Currency","defaultValue":"EUR"},{"name":"notes","label":"Notes","type":"textarea","rows":2}]}},
        "tabs":[
          {"id":"overview","label":"Overview","icon":"building","type":"summary","rows":[{"label":"Status","path":"item.status","format":"label"},{"label":"Roles","path":"item.roles","format":"array"},{"label":"Contacts","path":"summary.contacts","format":"number"},{"label":"Open opportunities","path":"summary.open_opportunities","format":"number"},{"label":"Open activities","path":"summary.open_activities","format":"number"},{"label":"Pipeline value","path":"summary.pipeline_value","format":"number"}]},
          {"id":"profile","label":"Profile","icon":"building","type":"form","form":{"title":"Account profile","endpoint":"/api/eip/crm/accounts/:id","method":"PATCH","permission":"crm.account.update","submitLabel":"Save account","resetOnSave":false,"fields":[{"name":"entity_kind","label":"Kind","type":"select","optionList":"ENTITY_KIND","uppercaseOptions":true,"options":["ORG","PERSON"]},{"name":"code","label":"Code"},{"name":"display_name","label":"Display name"},{"name":"legal_name","label":"Legal name"},{"name":"roles","label":"Roles","type":"multiselect","optionList":"ENTITY_ROLE","uppercaseOptions":true,"defaultOptionsPath":"account_roles"},{"name":"status","label":"Status","type":"select","optionList":"CRM_ACCOUNT_STATUS","uppercaseOptions":true,"defaultOptionsPath":"account_statuses"},{"name":"source","label":"Source"},{"name":"website","label":"Website","type":"url"},{"name":"country_code","label":"Country"},{"name":"currency_code","label":"Currency"},{"name":"notes","label":"Notes","type":"textarea","rows":2}]}},
          {"id":"contacts","label":"Contacts","icon":"users","type":"collection","itemsPath":"contacts","titlePath":"label","subtitlePath":"value","badgePath":"contact_type","empty":"No contacts recorded.","createForm":{"title":"Add contact","endpoint":"/api/eip/crm/accounts/:id/contacts","method":"POST","permission":"crm.contact.manage","submitLabel":"Add contact","fields":[{"name":"contact_type","label":"Type","type":"select","optionList":"ENTITY_CONTACT_TYPE","uppercaseOptions":true,"options":["EMAIL","PHONE","WEBSITE"],"defaultValue":"EMAIL"},{"name":"label","label":"Label"},{"name":"value","label":"Value"},{"name":"is_primary","label":"Primary","type":"checkbox"},{"name":"is_active","label":"Active","type":"checkbox","defaultValue":true}]},"updateForm":{"title":"Update contact","endpoint":"/api/eip/crm/accounts/:id/contacts/:rowId","method":"PATCH","permission":"crm.contact.manage","submitLabel":"Save contact","resetOnSave":false,"fields":[{"name":"contact_type","label":"Type","type":"select","optionList":"ENTITY_CONTACT_TYPE","uppercaseOptions":true,"options":["EMAIL","PHONE","WEBSITE"]},{"name":"label","label":"Label"},{"name":"value","label":"Value"},{"name":"is_primary","label":"Primary","type":"checkbox"},{"name":"is_active","label":"Active","type":"checkbox"}]}},
          {"id":"opportunities","label":"Opportunities","icon":"pipeline","type":"collection","itemsPath":"opportunities","titlePath":"title","subtitlePath":"code","badgePath":"status","empty":"No opportunities recorded.","createForm":{"title":"Create opportunity","endpoint":"/api/eip/crm/opportunities","method":"POST","permission":"crm.opportunity.create","submitLabel":"Create opportunity","fields":[{"name":"account_id","type":"hidden","sourcePath":"selected.id"},{"name":"title","label":"Title"},{"name":"status","label":"Status","type":"select","optionList":"CRM_OPPORTUNITY_STATUS","uppercaseOptions":true,"defaultOptionsPath":"opportunity_statuses","defaultValue":"NEW"},{"name":"value_amount","label":"Value","type":"number"},{"name":"currency","label":"Currency","defaultValue":"EUR"},{"name":"probability","label":"Probability","type":"number"},{"name":"expected_close_at","label":"Expected close","type":"date"},{"name":"source","label":"Source"},{"name":"next_step","label":"Next step","type":"textarea","rows":2}]},"rowActions":[{"id":"convert","label":"Record conversion intent","endpoint":"/api/eip/crm/opportunities/:rowId/convert","method":"POST","permission":"crm.convert","primary":true,"enabledStatuses":["NEW","QUALIFYING","PROPOSAL","NEGOTIATION"],"disabledReason":"Conversion intent is only available for active opportunities."}],"updateForm":{"title":"Update opportunity","endpoint":"/api/eip/crm/opportunities/:rowId","method":"PATCH","permission":"crm.opportunity.update","submitLabel":"Save opportunity","resetOnSave":false,"fields":[{"name":"title","label":"Title"},{"name":"status","label":"Status","type":"select","optionList":"CRM_OPPORTUNITY_STATUS","uppercaseOptions":true,"defaultOptionsPath":"opportunity_statuses"},{"name":"value_amount","label":"Value","type":"number"},{"name":"currency","label":"Currency"},{"name":"probability","label":"Probability","type":"number"},{"name":"expected_close_at","label":"Expected close","type":"date"},{"name":"source","label":"Source"},{"name":"next_step","label":"Next step","type":"textarea","rows":2}]}},
          {"id":"pipeline","label":"Pipeline","icon":"trend","type":"summary","rows":[{"label":"Open opportunities","path":"summary.open_opportunities","format":"number"},{"label":"Pipeline value","path":"summary.pipeline_value","format":"number"},{"label":"Weighted pipeline","path":"summary.weighted_pipeline_value","format":"number"},{"label":"Won opportunities","path":"summary.opportunity_statuses.WON","format":"number"},{"label":"Lost opportunities","path":"summary.opportunity_statuses.LOST","format":"number"},{"label":"Cancelled opportunities","path":"summary.opportunity_statuses.CANCELLED","format":"number"}]},
          {"id":"activities","label":"Activities","icon":"activity","type":"collection","itemsPath":"activities","titlePath":"title","subtitlePath":"task_type","badgePath":"status","empty":"No activities recorded.","createForm":{"title":"Create activity","endpoint":"/api/eip/crm/activities","method":"POST","permission":"crm.activity.create","submitLabel":"Create activity","fields":[{"name":"account_id","type":"hidden","sourcePath":"selected.id"},{"name":"task_type","label":"Type","type":"select","optionList":"CRM_TASK_TYPE","uppercaseOptions":true,"defaultValue":"FOLLOW_UP"},{"name":"status","label":"Status","type":"select","optionList":"TASK_STATUS","uppercaseOptions":true,"defaultValue":"OPEN"},{"name":"title","label":"Title"},{"name":"description","label":"Description","type":"textarea","rows":2},{"name":"assigned_agent_id","label":"Assigned agent id"},{"name":"due_at","label":"Due","type":"date"},{"name":"notes","label":"Notes","type":"textarea","rows":2}]},"updateForm":{"title":"Update activity","endpoint":"/api/eip/crm/activities/:rowId","method":"PATCH","permission":"crm.activity.update","submitLabel":"Save activity","resetOnSave":false,"fields":[{"name":"task_type","label":"Type","type":"select","optionList":"CRM_TASK_TYPE","uppercaseOptions":true},{"name":"status","label":"Status","type":"select","optionList":"TASK_STATUS","uppercaseOptions":true},{"name":"title","label":"Title"},{"name":"description","label":"Description","type":"textarea","rows":2},{"name":"assigned_agent_id","label":"Assigned agent id"},{"name":"due_at","label":"Due","type":"date"},{"name":"notes","label":"Notes","type":"textarea","rows":2}]}},
          {"id":"commercial_terms","label":"Commercial Terms","icon":"file","type":"records","permission":"crm.policy.read","itemsPath":"commercial_conditions","titlePath":"label","subtitlePath":"code","badgePath":"condition_type","empty":"No account-specific commercial conditions found."},
          {"id":"communications","label":"Communications","icon":"mail","type":"records","itemsPath":"communications","titlePath":"title","subtitlePath":"record_type","badgePath":"relation_type","empty":"No safe communication summaries linked."},
          {"id":"documents","label":"Documents","icon":"document","type":"records","itemsPath":"documents","titlePath":"title","subtitlePath":"record_type","badgePath":"relation_type","empty":"No documents or attachment metadata linked."},
          {"id":"policies","label":"Policies","icon":"policy","type":"summary","permission":"crm.policy.read","rows":[{"label":"Commercial resolution","path":"policy_summary.commercial_terms.resolution_status","format":"label"},{"label":"Commercial warnings","path":"policy_summary.commercial_terms.warnings","format":"array"},{"label":"Approval resolution","path":"policy_summary.approval_framework.resolution_status","format":"label"},{"label":"Approval warnings","path":"policy_summary.approval_framework.warnings","format":"array"},{"label":"Blocked account","path":"policy_summary.account_flags.blocked"},{"label":"Needs review","path":"policy_summary.account_flags.needs_review"}]}
        ]
      }
    }$crm_module$::jsonb,
    true
  )
ON CONFLICT (code) DO UPDATE
SET label=EXCLUDED.label,
    description=EXCLUDED.description,
    attrs=COALESCE(eip_core.module_catalog.attrs,'{}'::jsonb) || EXCLUDED.attrs,
    is_active=true,
    updated_at=now();

WITH target_tenants AS (
  SELECT tenant.id
  FROM eip_core.tenant tenant
  WHERE tenant.is_active=true
)
INSERT INTO eip_core.tenant_module_setting (tenant_id, module, code, attrs, is_active)
SELECT target_tenants.id, 'crm', 'operations',
       jsonb_build_object(
         'capabilities', '{"overview":true,"account_crud":true,"contact_management":true,"opportunity_crud":true,"pipeline":true,"activities":true,"communications":true,"documents":true,"effective_policy":true,"conversion_intent":true}'::jsonb,
         'settings', '{"hard_delete_enabled":false,"default_account_status":"PROSPECT","default_opportunity_status":"NEW"}'::jsonb,
         'ui_workspace', (SELECT attrs->'ui_workspace' FROM eip_core.module_catalog WHERE code='crm')
       ),
       true
FROM target_tenants
ON CONFLICT (tenant_id, module, code) DO UPDATE
SET attrs=jsonb_set(
      jsonb_set(
        COALESCE(eip_core.tenant_module_setting.attrs,'{}'::jsonb),
        '{capabilities}',
        COALESCE(eip_core.tenant_module_setting.attrs->'capabilities','{}'::jsonb) || '{"overview":true,"account_crud":true,"contact_management":true,"opportunity_crud":true,"pipeline":true,"activities":true,"communications":true,"documents":true,"effective_policy":true,"conversion_intent":true}'::jsonb,
        true
      ),
      '{ui_workspace}',
      (SELECT attrs->'ui_workspace' FROM eip_core.module_catalog WHERE code='crm'),
      true
    ),
    is_active=true,
    updated_at=now();

DO $$
DECLARE
  crm_panel jsonb := '{
    "id":"user-crm-panel",
    "type":"UserPanel",
    "props":{"tab":"crm"},
    "children":[
      {
        "id":"crm-management-workspace",
        "type":"KernelModuleWorkspace",
        "props":{
          "module":"crm",
          "configEndpoint":"/api/eip/crm/governance/options"
        }
      }
    ]
  }'::jsonb;
  surface_record record;
  next_children jsonb;
BEGIN
  FOR surface_record IN
    SELECT ui_surface.id, ui_surface.tree
    FROM eip_core.ui_surface ui_surface
    WHERE ui_surface.code='dashboard'
      AND ui_surface.is_active=true
      AND ui_surface.is_published=true
  LOOP
    next_children := COALESCE(surface_record.tree->'children','[]'::jsonb);
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(next_children) existing_child
      WHERE existing_child->>'id'='user-crm-panel'
    ) THEN
      SELECT jsonb_agg(
        CASE
          WHEN existing_child->>'id'='user-crm-panel' THEN crm_panel
          ELSE existing_child
        END
      )
      INTO next_children
      FROM jsonb_array_elements(next_children) existing_child;
    ELSE
      next_children := next_children || jsonb_build_array(crm_panel);
    END IF;

    UPDATE eip_core.ui_surface
    SET tree=jsonb_set(surface_record.tree, '{children}', next_children, true),
        attrs=COALESCE(attrs,'{}'::jsonb) || '{"module":"dashboard","crm_management_v1":true,"engine_first":true}'::jsonb,
        updated_at=now()
    WHERE id=surface_record.id;
  END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS agent_crm_management_v1_idx
  ON eip_core.agent (tenant_id, updated_at DESC, id)
  WHERE attrs ? 'crm_management_v1' OR attrs ? 'roles';

CREATE INDEX IF NOT EXISTS service_object_crm_opportunity_v1_idx
  ON eip_core.service_object (tenant_id, status, created_at DESC, id)
  WHERE object_type='CRM_OPPORTUNITY';

CREATE INDEX IF NOT EXISTS task_crm_management_v1_idx
  ON eip_core.task (tenant_id, status, updated_at DESC, id)
  WHERE attrs ? 'crm_management_v1';

COMMIT;
