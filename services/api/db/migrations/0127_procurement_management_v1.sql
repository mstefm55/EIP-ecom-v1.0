-- 0127_procurement_management_v1.sql
-- Purpose: Procurement Management V1 operational API/UI metadata.
-- Uses existing kernel tables only: service_object, task, agent, material,
-- commercial_condition, info_record, object_link, dropdowns, module settings.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.seed_procurement_management_dropdown(
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
  SELECT dl.id INTO target_list_id
  FROM eip_core.dropdown_list dl
  WHERE dl.tenant_id IS NULL
    AND dl.module='procurement'
    AND dl.code=p_list_code
    AND dl.version=1
  ORDER BY dl.created_at ASC
  LIMIT 1;

  IF target_list_id IS NULL THEN
    INSERT INTO eip_core.dropdown_list
      (tenant_id, module, code, name, version, is_active, attrs)
    VALUES
      (NULL, 'procurement', p_list_code, p_list_name, 1, true, '{"ui":{"module":"procurement","scope":"management_v1"}}'::jsonb)
    RETURNING id INTO target_list_id;
  ELSE
    UPDATE eip_core.dropdown_list
    SET name=p_list_name,
        is_active=true,
        attrs=COALESCE(attrs,'{}'::jsonb) || '{"ui":{"module":"procurement","scope":"management_v1"}}'::jsonb,
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
          attrs=EXCLUDED.attrs,
          updated_at=now();
  END LOOP;
END;
$$;

SELECT pg_temp.seed_procurement_management_dropdown('PROCUREMENT_REQUEST_STATUS', 'Procurement Request Status', '[
  {"code":"DRAFT","label":"Draft","sort_order":10},
  {"code":"NEEDS_REVIEW","label":"Needs review","sort_order":20},
  {"code":"PENDING_APPROVAL","label":"Pending approval","sort_order":30},
  {"code":"APPROVED","label":"Approved","sort_order":40},
  {"code":"REJECTED","label":"Rejected","sort_order":50},
  {"code":"SOURCING","label":"Sourcing","sort_order":60},
  {"code":"ORDER_PREPARATION","label":"Order preparation","sort_order":70},
  {"code":"COMPLETED","label":"Completed","sort_order":80},
  {"code":"CANCELLED","label":"Cancelled","sort_order":90},
  {"code":"ARCHIVED","label":"Archived","sort_order":100}
]'::jsonb);

SELECT pg_temp.seed_procurement_management_dropdown('INCOTERM', 'Incoterm', '[
  {"code":"EXW","label":"EXW","sort_order":10,"attrs":{"policy_domain":"COMMERCIAL","policy_family":"INCOTERMS","condition_type":"INCOTERM"}},
  {"code":"FCA","label":"FCA","sort_order":20,"attrs":{"policy_domain":"COMMERCIAL","policy_family":"INCOTERMS","condition_type":"INCOTERM"}},
  {"code":"CPT","label":"CPT","sort_order":30,"attrs":{"policy_domain":"COMMERCIAL","policy_family":"INCOTERMS","condition_type":"INCOTERM"}},
  {"code":"CIP","label":"CIP","sort_order":40,"attrs":{"policy_domain":"COMMERCIAL","policy_family":"INCOTERMS","condition_type":"INCOTERM"}},
  {"code":"DAP","label":"DAP","sort_order":50,"attrs":{"policy_domain":"COMMERCIAL","policy_family":"INCOTERMS","condition_type":"INCOTERM"}},
  {"code":"DPU","label":"DPU","sort_order":60,"attrs":{"policy_domain":"COMMERCIAL","policy_family":"INCOTERMS","condition_type":"INCOTERM"}},
  {"code":"DDP","label":"DDP","sort_order":70,"attrs":{"policy_domain":"COMMERCIAL","policy_family":"INCOTERMS","condition_type":"INCOTERM"}},
  {"code":"FOB","label":"FOB","sort_order":80,"attrs":{"policy_domain":"COMMERCIAL","policy_family":"INCOTERMS","condition_type":"INCOTERM"}},
  {"code":"CFR","label":"CFR","sort_order":90,"attrs":{"policy_domain":"COMMERCIAL","policy_family":"INCOTERMS","condition_type":"INCOTERM"}},
  {"code":"CIF","label":"CIF","sort_order":100,"attrs":{"policy_domain":"COMMERCIAL","policy_family":"INCOTERMS","condition_type":"INCOTERM"}}
]'::jsonb);

WITH status_list AS (
  SELECT dl.id
  FROM eip_core.dropdown_list dl
  WHERE dl.code='SERVICE_OBJECT_STATUS'
    AND dl.is_active=true
  ORDER BY (dl.tenant_id IS NOT NULL) DESC, dl.version DESC
  LIMIT 1
),
values_to_seed(code, label, sort_order, attrs) AS (
  VALUES
    ('needs_review','Needs review',240,'{"scope":"status","module":"procurement","object_type":"PURCHASE_REQUISITION"}'::jsonb),
    ('pending_approval','Pending approval',242,'{"scope":"status","module":"procurement","object_type":"PURCHASE_REQUISITION"}'::jsonb),
    ('rejected','Rejected',244,'{"scope":"status","module":"procurement","object_type":"PURCHASE_REQUISITION"}'::jsonb),
    ('sourcing','Sourcing',246,'{"scope":"status","module":"procurement","object_type":"PURCHASE_REQUISITION"}'::jsonb),
    ('order_preparation','Order preparation',248,'{"scope":"status","module":"procurement","object_type":"PURCHASE_REQUISITION"}'::jsonb),
    ('completed','Completed',250,'{"scope":"status","module":"procurement","object_type":"PURCHASE_REQUISITION"}'::jsonb),
    ('archived','Archived',252,'{"scope":"status","module":"procurement","object_type":"PURCHASE_REQUISITION"}'::jsonb)
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT status_list.id, seeded.code, seeded.label, seeded.sort_order, true, seeded.attrs
FROM status_list
CROSS JOIN values_to_seed seeded
WHERE status_list.id IS NOT NULL
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label,
    sort_order=EXCLUDED.sort_order,
    is_active=true,
    attrs=COALESCE(eip_core.dropdown_value.attrs,'{}'::jsonb) || EXCLUDED.attrs,
    updated_at=now();

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('procurement.read', 'Read procurement', 'View tenant procurement requests, suppliers, commercial terms, approvals, documents, and activity'),
  ('procurement.request.create', 'Create procurement requests', 'Create tenant purchase needs on the service object backbone'),
  ('procurement.request.update', 'Update procurement requests', 'Update tenant purchase need details and lifecycle metadata'),
  ('procurement.request.submit', 'Submit procurement requests', 'Submit purchase needs for procurement review or approval'),
  ('procurement.request.approve', 'Approve procurement requests', 'Approve or reject submitted procurement requests'),
  ('procurement.recommendation.read', 'Read procurement recommendations', 'View buying recommendations and missing-data warnings'),
  ('procurement.policy.read', 'Read procurement policy summaries', 'View effective procurement policy summaries without raw legal text')
ON CONFLICT (code) DO UPDATE
SET label=EXCLUDED.label,
    description=EXCLUDED.description;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','procurement.read'), ('ADMIN_SUPER','procurement.request.create'), ('ADMIN_SUPER','procurement.request.update'),
    ('ADMIN_SUPER','procurement.request.submit'), ('ADMIN_SUPER','procurement.request.approve'), ('ADMIN_SUPER','procurement.recommendation.read'),
    ('ADMIN_SUPER','procurement.policy.read'),
    ('ACCESS_UNIVERSAL','procurement.read'), ('ACCESS_UNIVERSAL','procurement.request.create'), ('ACCESS_UNIVERSAL','procurement.request.update'),
    ('ACCESS_UNIVERSAL','procurement.request.submit'), ('ACCESS_UNIVERSAL','procurement.request.approve'), ('ACCESS_UNIVERSAL','procurement.recommendation.read'),
    ('ACCESS_UNIVERSAL','procurement.policy.read'),
    ('ECOM_ADMIN','procurement.read'), ('ECOM_ADMIN','procurement.request.create'), ('ECOM_ADMIN','procurement.request.update'),
    ('ECOM_ADMIN','procurement.request.submit'), ('ECOM_ADMIN','procurement.request.approve'), ('ECOM_ADMIN','procurement.recommendation.read'),
    ('ECOM_ADMIN','procurement.policy.read'),
    ('ECOM_USER','procurement.read'), ('ECOM_USER','procurement.request.create'), ('ECOM_USER','procurement.request.update'),
    ('ECOM_USER','procurement.request.submit'), ('ECOM_USER','procurement.recommendation.read'), ('ECOM_USER','procurement.policy.read'),
    ('ACCESS_ECOM_FULL','procurement.read'), ('ACCESS_ECOM_FULL','procurement.request.create'), ('ACCESS_ECOM_FULL','procurement.request.update'),
    ('ACCESS_ECOM_FULL','procurement.request.submit'), ('ACCESS_ECOM_FULL','procurement.request.approve'), ('ACCESS_ECOM_FULL','procurement.recommendation.read'),
    ('ACCESS_ECOM_FULL','procurement.policy.read'),
    ('ACCESS_READ_ONLY','procurement.read'), ('ACCESS_READ_ONLY','procurement.recommendation.read'), ('ACCESS_READ_ONLY','procurement.policy.read')
)
INSERT INTO eip_authz.role_template_permission(role_code, permission_code)
SELECT role_template.code, bundles.permission_code
FROM bundles
JOIN eip_authz.role_template role_template ON role_template.code=bundles.role_code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','procurement.read'), ('ADMIN_SUPER','procurement.request.create'), ('ADMIN_SUPER','procurement.request.update'),
    ('ADMIN_SUPER','procurement.request.submit'), ('ADMIN_SUPER','procurement.request.approve'), ('ADMIN_SUPER','procurement.recommendation.read'),
    ('ADMIN_SUPER','procurement.policy.read'),
    ('ACCESS_UNIVERSAL','procurement.read'), ('ACCESS_UNIVERSAL','procurement.request.create'), ('ACCESS_UNIVERSAL','procurement.request.update'),
    ('ACCESS_UNIVERSAL','procurement.request.submit'), ('ACCESS_UNIVERSAL','procurement.request.approve'), ('ACCESS_UNIVERSAL','procurement.recommendation.read'),
    ('ACCESS_UNIVERSAL','procurement.policy.read'),
    ('ECOM_ADMIN','procurement.read'), ('ECOM_ADMIN','procurement.request.create'), ('ECOM_ADMIN','procurement.request.update'),
    ('ECOM_ADMIN','procurement.request.submit'), ('ECOM_ADMIN','procurement.request.approve'), ('ECOM_ADMIN','procurement.recommendation.read'),
    ('ECOM_ADMIN','procurement.policy.read'),
    ('ECOM_USER','procurement.read'), ('ECOM_USER','procurement.request.create'), ('ECOM_USER','procurement.request.update'),
    ('ECOM_USER','procurement.request.submit'), ('ECOM_USER','procurement.recommendation.read'), ('ECOM_USER','procurement.policy.read'),
    ('ACCESS_ECOM_FULL','procurement.read'), ('ACCESS_ECOM_FULL','procurement.request.create'), ('ACCESS_ECOM_FULL','procurement.request.update'),
    ('ACCESS_ECOM_FULL','procurement.request.submit'), ('ACCESS_ECOM_FULL','procurement.request.approve'), ('ACCESS_ECOM_FULL','procurement.recommendation.read'),
    ('ACCESS_ECOM_FULL','procurement.policy.read'),
    ('ACCESS_READ_ONLY','procurement.read'), ('ACCESS_READ_ONLY','procurement.recommendation.read'), ('ACCESS_READ_ONLY','procurement.policy.read')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT role_record.id, bundles.permission_code
FROM bundles
JOIN eip_authz.role role_record ON role_record.code=bundles.role_code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

WITH target_tenants AS (
  SELECT tenant.id
  FROM eip_core.tenant tenant
  WHERE tenant.is_active=true
),
definitions(code, name, object_type, graph) AS (
  VALUES
    (
      'PROCUREMENT_REQUEST_FLOW_V1',
      'Procurement request management flow',
      'PURCHASE_REQUISITION',
      '{
        "module":"procurement",
        "object_type":"PURCHASE_REQUISITION",
        "initial_node":"draft",
        "nodes":{
          "draft":{"id":"draft","type":"STEP","label":"Draft"},
          "needs_review":{"id":"needs_review","type":"HUMAN_TASK","label":"Needs review"},
          "pending_approval":{"id":"pending_approval","type":"HUMAN_TASK","label":"Pending approval"},
          "approved":{"id":"approved","type":"STEP","label":"Approved"},
          "rejected":{"id":"rejected","type":"END","label":"Rejected","is_terminal":true},
          "sourcing":{"id":"sourcing","type":"STEP","label":"Sourcing"},
          "order_preparation":{"id":"order_preparation","type":"STEP","label":"Order preparation"},
          "completed":{"id":"completed","type":"END","label":"Completed","is_terminal":true},
          "cancelled":{"id":"cancelled","type":"END","label":"Cancelled","is_terminal":true},
          "archived":{"id":"archived","type":"END","label":"Archived","is_terminal":true}
        },
        "transitions":[
          {"from":"draft","to":"pending_approval","action":"submit","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"pending_approval"},{"type":"TASK_CREATE","task_type":"PROCUREMENT_REQUEST_APPROVAL","title":"Approve procurement request","description":"Review supplier, quantity, commercial terms, Incoterm, payment terms, and missing data before approval.","assign":"owner","due_in_days":2,"attrs":{"module":"procurement","source":"procurement_management_v1"}}]},
          {"from":"needs_review","to":"pending_approval","action":"submit","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"pending_approval"},{"type":"TASK_CREATE","task_type":"PROCUREMENT_REQUEST_APPROVAL","title":"Approve procurement request","description":"Review supplier, quantity, commercial terms, Incoterm, payment terms, and missing data before approval.","assign":"owner","due_in_days":2,"attrs":{"module":"procurement","source":"procurement_management_v1"}}]},
          {"from":"pending_approval","to":"approved","action":"approve","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"approved"},{"type":"INFO_RECORD_WRITE","record_type":"PROCUREMENT_DECISION","title":"Procurement request approved","payload":{"decision":"approved","note":"$payload.note"},"attrs":{"module":"procurement","safe_summary":true},"links":[{"src_kind":"service_object","src_id":"$service_object_id","dst_kind":"info_record","relation_type":"DECISION","attrs":{"module":"procurement"}}]}]},
          {"from":"pending_approval","to":"rejected","action":"reject","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"rejected"},{"type":"INFO_RECORD_WRITE","record_type":"PROCUREMENT_DECISION","title":"Procurement request rejected","payload":{"decision":"rejected","note":"$payload.note"},"attrs":{"module":"procurement","safe_summary":true},"links":[{"src_kind":"service_object","src_id":"$service_object_id","dst_kind":"info_record","relation_type":"DECISION","attrs":{"module":"procurement"}}]}]},
          {"from":"approved","to":"sourcing","action":"start_sourcing","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"sourcing"}]},
          {"from":"sourcing","to":"order_preparation","action":"prepare_order","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"order_preparation"}]},
          {"from":"order_preparation","to":"completed","action":"complete","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"completed"}]},
          {"from":"draft","to":"cancelled","action":"cancel","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"cancelled"}]},
          {"from":"needs_review","to":"cancelled","action":"cancel","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"cancelled"}]},
          {"from":"approved","to":"archived","action":"archive","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"archived"}]}
        ]
      }'::jsonb
    )
)
INSERT INTO eip_core.process_def
  (tenant_id, code, name, version, is_active, graph, attrs)
SELECT
  target_tenants.id,
  definitions.code,
  definitions.name,
  1,
  true,
  definitions.graph,
  jsonb_build_object(
    'module', 'procurement',
    'object_type', definitions.object_type,
    'is_published', true,
    'source', 'procurement_management_v1'
  )
FROM target_tenants
CROSS JOIN definitions
ON CONFLICT (tenant_id, code, version) DO UPDATE
SET name=EXCLUDED.name,
    is_active=true,
    graph=EXCLUDED.graph,
    attrs=EXCLUDED.attrs,
    updated_at=now();

WITH definitions AS (
  SELECT pd.tenant_id, pd.id, pd.attrs->>'object_type' AS object_type
  FROM eip_core.process_def pd
  WHERE pd.code='PROCUREMENT_REQUEST_FLOW_V1'
    AND pd.version=1
    AND pd.is_active=true
)
INSERT INTO eip_core.process_binding
  (tenant_id, service_object_type, process_def_id, is_active, priority, attrs)
SELECT definitions.tenant_id, definitions.object_type, definitions.id, true, 30,
       '{"module":"procurement","source":"procurement_management_v1"}'::jsonb
FROM definitions
ON CONFLICT (tenant_id, service_object_type, process_def_id, (COALESCE(task_type, ''))) DO UPDATE
SET is_active=true,
    priority=EXCLUDED.priority,
    attrs=EXCLUDED.attrs,
    updated_at=now();

WITH definitions AS (
  SELECT pd.tenant_id, pd.id, pd.attrs->>'object_type' AS object_type
  FROM eip_core.process_def pd
  WHERE pd.code='PROCUREMENT_REQUEST_FLOW_V1'
    AND pd.version=1
    AND pd.is_active=true
)
INSERT INTO eip_core.task_template
  (tenant_id, process_def_id, service_object_type, task_type, title, description, is_active, sort_order, attrs)
SELECT definitions.tenant_id, definitions.id, definitions.object_type, 'PROCUREMENT_REQUEST_APPROVAL',
       'Approve procurement request',
       'Review supplier, quantity, commercial terms, Incoterm, payment terms, and missing data before approval.',
       true, 10,
       '{"module":"procurement","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"medium","due_in_days":2},"due_in_days":2}'::jsonb
FROM definitions
ON CONFLICT (tenant_id, process_def_id, (COALESCE(service_object_type,'')), task_type) DO UPDATE
SET title=EXCLUDED.title,
    description=EXCLUDED.description,
    is_active=true,
    sort_order=EXCLUDED.sort_order,
    attrs=EXCLUDED.attrs,
    updated_at=now();

INSERT INTO eip_core.module_catalog (code, label, description, attrs, is_active)
VALUES
  (
    'procurement',
    'Procurement',
    'Purchase needs, supplier selection, buying recommendations, commercial terms, approvals, documents, and activity',
    '{
      "capabilities":{"overview":true,"purchase_needs":true,"request_crud":true,"supplier_selection":true,"recommendations":true,"commercial_terms":true,"approvals":true,"documents":true,"activity":true},
      "scope":"procurement_management_v1",
      "ui_workspace":{
        "layout":{"eyebrow":"Procurement Management","title":"Procurement","subtitle":"Purchase needs, supplier selection, commercial terms, approvals, documents, activity, and next procurement actions."},
        "list":{"endpoint":"/api/eip/procurement/requests","itemsPath":"items","limit":50,"icon":"shopping-cart","titlePath":"title","subtitlePath":"code","badgePath":"status","searchPlaceholder":"Search purchase needs","filters":[{"name":"status","label":"Status","optionList":"PROCUREMENT_REQUEST_STATUS","defaultOptionsPath":"statuses"}]},
        "detail":{"endpoint":"/api/eip/procurement/requests/:id","titlePath":"title","subtitlePath":"code","badgePath":"status","emptyLabel":"Select a purchase need."},
        "actions":{"create":{"label":"Create need","title":"Create purchase need","endpoint":"/api/eip/procurement/requests","method":"POST","permission":"procurement.request.create","fields":[{"name":"item_type","label":"Item type","type":"select","options":["MATERIAL","SERVICE"],"defaultValue":"MATERIAL"},{"name":"material_id","label":"Material","type":"lookup","endpoint":"/api/eip/procurement/lookup?kind=material","itemsPath":"items","valuePath":"id","labelPath":"label","placeholder":"Search materials"},{"name":"service_item_name","label":"Service item"},{"name":"title","label":"Title"},{"name":"description","label":"Description","type":"textarea","rows":2},{"name":"requested_qty","label":"Quantity","type":"number"},{"name":"unit_of_measure","label":"Unit"},{"name":"supplier_agent_id","label":"Supplier","type":"lookup","endpoint":"/api/eip/procurement/lookup?kind=supplier","itemsPath":"items","valuePath":"id","labelPath":"label","placeholder":"Search suppliers"},{"name":"required_by_date","label":"Required by","type":"date"},{"name":"priority","label":"Priority","type":"select","options":["LOW","NORMAL","HIGH","URGENT"],"defaultValue":"NORMAL"},{"name":"estimated_unit_cost","label":"Estimated unit cost","type":"number"},{"name":"currency","label":"Currency","defaultValue":"EUR"},{"name":"payment_terms_code","label":"Payment terms","type":"select","optionList":"PAYMENT_TERMS","defaultValue":"NET_30"},{"name":"incoterm_code","label":"Incoterm","type":"select","optionList":"INCOTERM","allowEmpty":true},{"name":"notes","label":"Notes","type":"textarea","rows":2}]}},
        "rowActions":[{"id":"submit","label":"Submit","endpoint":"/api/eip/procurement/requests/:id/submit","method":"POST","permission":"procurement.request.submit","primary":true,"enabledStatuses":["DRAFT","NEEDS_REVIEW"],"disabledReason":"Submit is available for draft or review needs."},{"id":"approve","label":"Approve","endpoint":"/api/eip/procurement/requests/:id/approve","method":"POST","permission":"procurement.request.approve","primary":true,"enabledStatuses":["PENDING_APPROVAL"],"disabledReason":"Approve is available after submission."},{"id":"reject","label":"Reject","endpoint":"/api/eip/procurement/requests/:id/reject","method":"POST","permission":"procurement.request.approve","enabledStatuses":["PENDING_APPROVAL"],"disabledReason":"Reject is available after submission."}],
        "tabs":[
          {"id":"overview","label":"Overview","icon":"shopping-cart","type":"summary","rows":[{"label":"Item type","path":"item.item_type","format":"label"},{"label":"Material","path":"item.material_name"},{"label":"Service","path":"item.service_item_name"},{"label":"Quantity","path":"item.requested_qty","unitPath":"item.unit_of_measure","format":"quantity"},{"label":"Selected supplier","path":"item.supplier_name"},{"label":"Next action","path":"summary.next_action.label"}]},
          {"id":"purchase_needs","label":"Purchase Needs","icon":"package","type":"form","form":{"title":"Purchase need","endpoint":"/api/eip/procurement/requests/:id","method":"PATCH","permission":"procurement.request.update","submitLabel":"Save need","resetOnSave":false,"fields":[{"name":"item_type","label":"Item type","type":"select","options":["MATERIAL","SERVICE"],"defaultValue":"MATERIAL"},{"name":"material_id","label":"Material","type":"lookup","endpoint":"/api/eip/procurement/lookup?kind=material","itemsPath":"items","valuePath":"id","labelPath":"label","placeholder":"Search materials"},{"name":"service_item_name","label":"Service item"},{"name":"title","label":"Title"},{"name":"description","label":"Description","type":"textarea","rows":2},{"name":"requested_qty","label":"Quantity","type":"number"},{"name":"unit_of_measure","label":"Unit"},{"name":"supplier_agent_id","label":"Supplier","type":"lookup","endpoint":"/api/eip/procurement/lookup?kind=supplier","itemsPath":"items","valuePath":"id","labelPath":"label","placeholder":"Search suppliers"},{"name":"required_by_date","label":"Required by","type":"date"},{"name":"priority","label":"Priority","type":"select","options":["LOW","NORMAL","HIGH","URGENT"],"defaultValue":"NORMAL"},{"name":"estimated_unit_cost","label":"Estimated unit cost","type":"number"},{"name":"currency","label":"Currency","defaultValue":"EUR"},{"name":"payment_terms_code","label":"Payment terms","type":"select","optionList":"PAYMENT_TERMS","defaultValue":"NET_30"},{"name":"incoterm_code","label":"Incoterm","type":"select","optionList":"INCOTERM","allowEmpty":true},{"name":"notes","label":"Notes","type":"textarea","rows":2}]}},
          {"id":"recommendations","label":"Recommendations","icon":"reorder","type":"summary","rows":[{"label":"Buying route","path":"recommendation.procurement_model","format":"label"},{"label":"Reason","path":"recommendation.reason","format":"label"},{"label":"Estimated landed cost","path":"recommendation.estimated_landed_cost","format":"number"},{"label":"Currency","path":"recommendation.currency"},{"label":"Warnings","path":"recommendation.warnings","format":"array"},{"label":"Missing data","path":"recommendation.missing_data","format":"array"}]},
          {"id":"suppliers","label":"Suppliers","icon":"users","type":"records","itemsPath":"supplier_options","titlePath":"supplier_name","subtitlePath":"relationship_source","badgePath":"supplier_role","empty":"No supplier options found."},
          {"id":"commercial_terms","label":"Commercial Terms","icon":"file","type":"summary","rows":[{"label":"Payment terms","path":"commercial_terms.payment_terms_code"},{"label":"Incoterm","path":"commercial_terms.incoterm_code"},{"label":"Trade credit","path":"commercial_terms.trade_credit"},{"label":"Commercial conditions","path":"commercial_terms.conditions.length","format":"number"}]},
          {"id":"approvals","label":"Approvals","icon":"policy","type":"summary","rows":[{"label":"Approval required","path":"approval.required"},{"label":"Approval status","path":"approval.status","format":"label"},{"label":"Pending approval","path":"approval.pending"},{"label":"Approval conditions","path":"approval.conditions.length","format":"number"}]},
          {"id":"documents","label":"Documents","icon":"document","type":"records","itemsPath":"documents","titlePath":"title","subtitlePath":"record_type","badgePath":"relation_type","empty":"No quote, supplier document, contract, note, or attachment metadata linked."},
          {"id":"activity","label":"Activity","icon":"archive","type":"summary","rows":[{"label":"Tasks","path":"activity.summary.tasks","format":"number"},{"label":"Open tasks","path":"activity.summary.open_tasks","format":"number"},{"label":"Status events","path":"activity.summary.events","format":"number"},{"label":"Policy commercial resolution","path":"policy_summary.domains.COMMERCIAL.resolution_status","format":"label"}]}
        ]
      }
    }'::jsonb,
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
SELECT target_tenants.id, 'procurement', 'operations',
       jsonb_build_object(
         'capabilities', '{"overview":true,"purchase_needs":true,"request_crud":true,"supplier_selection":true,"recommendations":true,"commercial_terms":true,"approvals":true,"documents":true,"activity":true}'::jsonb,
         'settings', '{"hard_delete_enabled":false,"default_status":"DRAFT"}'::jsonb,
         'ui_workspace', (SELECT attrs->'ui_workspace' FROM eip_core.module_catalog WHERE code='procurement')
       ),
       true
FROM target_tenants
ON CONFLICT (tenant_id, module, code) DO UPDATE
SET attrs=jsonb_set(
      jsonb_set(
        COALESCE(eip_core.tenant_module_setting.attrs,'{}'::jsonb),
        '{capabilities}',
        COALESCE(eip_core.tenant_module_setting.attrs->'capabilities','{}'::jsonb) || '{"overview":true,"purchase_needs":true,"request_crud":true,"supplier_selection":true,"recommendations":true,"commercial_terms":true,"approvals":true,"documents":true,"activity":true}'::jsonb,
        true
      ),
      '{ui_workspace}',
      (SELECT attrs->'ui_workspace' FROM eip_core.module_catalog WHERE code='procurement'),
      true
    ),
    is_active=true,
    updated_at=now();

DO $$
DECLARE
  procurement_panel jsonb := '{
    "id":"user-procurement-panel",
    "type":"UserPanel",
    "props":{"tab":"procurement"},
    "children":[
      {
        "id":"procurement-workspace",
        "type":"KernelModuleWorkspace",
        "props":{
          "module":"procurement",
          "configEndpoint":"/api/eip/procurement/governance/options"
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
      WHERE existing_child->>'id'='user-procurement-panel'
    ) THEN
      SELECT jsonb_agg(
        CASE
          WHEN existing_child->>'id'='user-procurement-panel' THEN procurement_panel
          ELSE existing_child
        END
      )
      INTO next_children
      FROM jsonb_array_elements(next_children) existing_child;
    ELSE
      next_children := next_children || jsonb_build_array(procurement_panel);
    END IF;

    UPDATE eip_core.ui_surface
    SET tree=jsonb_set(surface_record.tree, '{children}', next_children, true),
        attrs=COALESCE(attrs,'{}'::jsonb) || '{"module":"dashboard","procurement_management_v1":true,"engine_first":true}'::jsonb,
        updated_at=now()
    WHERE id=surface_record.id;
  END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS service_object_procurement_management_v1_idx
  ON eip_core.service_object (tenant_id, status, created_at DESC, id)
  WHERE object_type='PURCHASE_REQUISITION';

CREATE INDEX IF NOT EXISTS service_object_procurement_management_material_idx
  ON eip_core.service_object (tenant_id, ((attrs->'procurement_management_v1'->>'material_id')), created_at DESC)
  WHERE object_type='PURCHASE_REQUISITION';

CREATE INDEX IF NOT EXISTS object_link_procurement_request_supplier_idx
  ON eip_core.object_link (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type)
  WHERE relation_type IN ('SELECTED_SUPPLIER','RECOMMENDED_SUPPLIER','PROCUREMENT_REQUEST_FOR');

COMMIT;
