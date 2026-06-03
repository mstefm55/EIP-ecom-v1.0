-- 0111_procurement_foundation.sql
-- Purpose: purchase requisition, supplier policy, RFQ, quote review, and cash purchase foundation.
-- Uses existing kernel tables only: commercial_condition, material, agent, object_link,
-- service_object, info_record, task/process/task_template, dropdowns, module settings,
-- role permissions, and UI surfaces.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.seed_procurement_dropdown(
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
      (NULL, 'procurement', p_list_code, p_list_name, 1, true, '{"ui":{"module":"procurement","scope":"purchase_foundation"}}'::jsonb)
    RETURNING id INTO target_list_id;
  ELSE
    UPDATE eip_core.dropdown_list
    SET name=p_list_name,
        is_active=true,
        attrs=COALESCE(attrs,'{}'::jsonb) || '{"ui":{"module":"procurement","scope":"purchase_foundation"}}'::jsonb,
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

SELECT pg_temp.seed_procurement_dropdown('PROCUREMENT_MODEL', 'Procurement Model', '[
  {"code":"direct_purchase","label":"Direct purchase","sort_order":10},
  {"code":"formal_purchase_order","label":"Formal purchase order","sort_order":20},
  {"code":"purchase_requisition_then_po","label":"Purchase requisition then PO","sort_order":30},
  {"code":"request_for_quote","label":"Request for quote","sort_order":40},
  {"code":"multi_supplier_quote_comparison","label":"Multi-supplier quote comparison","sort_order":50},
  {"code":"cash_shop_purchase","label":"Cash/shop purchase","sort_order":60},
  {"code":"marketplace_purchase","label":"Marketplace purchase","sort_order":70},
  {"code":"blanket_order_call_off","label":"Blanket order call-off","sort_order":80},
  {"code":"contract_supplier_purchase","label":"Contract supplier purchase","sort_order":90},
  {"code":"emergency_purchase","label":"Emergency purchase","sort_order":100},
  {"code":"manual_receipt_only","label":"Manual receipt only","sort_order":110}
]'::jsonb);

SELECT pg_temp.seed_procurement_dropdown('SUPPLIER_ROLE', 'Supplier Role', '[
  {"code":"preferred","label":"Preferred","sort_order":10},
  {"code":"backup","label":"Backup","sort_order":20},
  {"code":"emergency","label":"Emergency","sort_order":30},
  {"code":"blocked","label":"Blocked","sort_order":40},
  {"code":"trial","label":"Trial","sort_order":50},
  {"code":"cash_supplier","label":"Cash supplier","sort_order":60},
  {"code":"marketplace","label":"Marketplace","sort_order":70},
  {"code":"contract","label":"Contract","sort_order":80}
]'::jsonb);

SELECT pg_temp.seed_procurement_dropdown('SUPPLIER_ACCREDITATION_STATUS', 'Supplier Accreditation Status', '[
  {"code":"approved","label":"Approved","sort_order":10},
  {"code":"pending","label":"Pending","sort_order":20},
  {"code":"trial","label":"Trial","sort_order":30},
  {"code":"expired","label":"Expired","sort_order":40},
  {"code":"blocked","label":"Blocked","sort_order":50}
]'::jsonb);

SELECT pg_temp.seed_procurement_dropdown('PURCHASE_REQUISITION_STATUS', 'Purchase Requisition Status', '[
  {"code":"draft","label":"Draft","sort_order":10},
  {"code":"review","label":"Review","sort_order":20},
  {"code":"approved","label":"Approved","sort_order":30},
  {"code":"converted_to_rfq","label":"Converted to RFQ","sort_order":40},
  {"code":"converted_to_po_draft","label":"Converted to PO draft","sort_order":50},
  {"code":"converted_to_cash_purchase","label":"Converted to cash purchase","sort_order":60},
  {"code":"ignored","label":"Ignored","sort_order":70},
  {"code":"closed","label":"Closed","sort_order":80}
]'::jsonb);

SELECT pg_temp.seed_procurement_dropdown('RFQ_STATUS', 'RFQ Status', '[
  {"code":"draft","label":"Draft","sort_order":10},
  {"code":"sent","label":"Sent","sort_order":20},
  {"code":"quotes_pending","label":"Quotes pending","sort_order":30},
  {"code":"comparison_ready","label":"Comparison ready","sort_order":40},
  {"code":"supplier_selected","label":"Supplier selected","sort_order":50},
  {"code":"cancelled","label":"Cancelled","sort_order":60},
  {"code":"closed","label":"Closed","sort_order":70}
]'::jsonb);

SELECT pg_temp.seed_procurement_dropdown('SUPPLIER_QUOTE_STATUS', 'Supplier Quote Status', '[
  {"code":"requested","label":"Requested","sort_order":10},
  {"code":"received","label":"Received","sort_order":20},
  {"code":"accepted","label":"Accepted","sort_order":30},
  {"code":"rejected","label":"Rejected","sort_order":40},
  {"code":"expired","label":"Expired","sort_order":50}
]'::jsonb);

SELECT pg_temp.seed_procurement_dropdown('PAYMENT_TERMS', 'Payment Terms', '[
  {"code":"DUE_ON_RECEIPT","label":"Due on receipt","sort_order":10},
  {"code":"NET_7","label":"Net 7","sort_order":20},
  {"code":"NET_15","label":"Net 15","sort_order":30},
  {"code":"NET_30","label":"Net 30","sort_order":40},
  {"code":"CASH_ON_DELIVERY","label":"Cash on delivery","sort_order":50}
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
    ('draft','Draft',210,'{"scope":"status","module":"procurement","object_types":["PURCHASE_REQUISITION","PURCHASE_RFQ","CASH_PURCHASE"]}'::jsonb),
    ('review','Review',212,'{"scope":"status","module":"procurement","object_type":"PURCHASE_REQUISITION"}'::jsonb),
    ('approved','Approved',214,'{"scope":"status","module":"procurement","object_type":"PURCHASE_REQUISITION"}'::jsonb),
    ('converted_to_rfq','Converted to RFQ',216,'{"scope":"status","module":"procurement","object_type":"PURCHASE_REQUISITION"}'::jsonb),
    ('converted_to_po_draft','Converted to PO draft',218,'{"scope":"status","module":"procurement","object_type":"PURCHASE_REQUISITION"}'::jsonb),
    ('converted_to_cash_purchase','Converted to cash purchase',220,'{"scope":"status","module":"procurement","object_type":"PURCHASE_REQUISITION"}'::jsonb),
    ('ignored','Ignored',222,'{"scope":"status","module":"procurement","object_type":"PURCHASE_REQUISITION"}'::jsonb),
    ('sent','Sent',224,'{"scope":"status","module":"procurement","object_type":"PURCHASE_RFQ"}'::jsonb),
    ('quotes_pending','Quotes pending',226,'{"scope":"status","module":"procurement","object_type":"PURCHASE_RFQ"}'::jsonb),
    ('comparison_ready','Comparison ready',228,'{"scope":"status","module":"procurement","object_type":"PURCHASE_RFQ"}'::jsonb),
    ('supplier_selected','Supplier selected',230,'{"scope":"status","module":"procurement","object_type":"PURCHASE_RFQ"}'::jsonb),
    ('recorded','Recorded',232,'{"scope":"status","module":"procurement","object_type":"CASH_PURCHASE"}'::jsonb),
    ('closed','Closed',234,'{"scope":"status","module":"procurement","object_types":["PURCHASE_REQUISITION","PURCHASE_RFQ","CASH_PURCHASE"]}'::jsonb),
    ('cancelled','Cancelled',236,'{"scope":"status","module":"procurement","object_types":["PURCHASE_REQUISITION","PURCHASE_RFQ"]}'::jsonb)
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT status_list.id, seeded.code, seeded.label, seeded.sort_order, true, seeded.attrs
FROM status_list
CROSS JOIN values_to_seed seeded
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label,
    sort_order=EXCLUDED.sort_order,
    is_active=true,
    attrs=COALESCE(eip_core.dropdown_value.attrs,'{}'::jsonb) || EXCLUDED.attrs,
    updated_at=now();

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('PROCUREMENT_READ', 'Read procurement', 'View procurement overview, purchase needs, supplier links, requisitions, and RFQs'),
  ('PROCUREMENT_WRITE', 'Write procurement', 'Create and update procurement records'),
  ('PROCUREMENT_REQUISITION_READ', 'Read purchase requisitions', 'View purchase requisitions'),
  ('PROCUREMENT_REQUISITION_WRITE', 'Write purchase requisitions', 'Create, ignore, and maintain purchase requisitions'),
  ('PROCUREMENT_REQUISITION_APPROVE', 'Approve purchase requisitions', 'Approve purchase requisitions before RFQ or PO preparation'),
  ('PROCUREMENT_RFQ_READ', 'Read RFQs', 'View RFQs and supplier quotes'),
  ('PROCUREMENT_RFQ_WRITE', 'Write RFQs', 'Create RFQs and record supplier quotes'),
  ('PROCUREMENT_QUOTE_REVIEW', 'Review supplier quotes', 'Compare and approve supplier quotes'),
  ('PROCUREMENT_CASH_PURCHASE', 'Record cash purchase', 'Record low-value cash/shop purchases and receipt movements'),
  ('SUPPLIER_LINK_READ', 'Read supplier links', 'View material-supplier policy links'),
  ('SUPPLIER_LINK_WRITE', 'Write supplier links', 'Create and update material-supplier policy links')
ON CONFLICT (code) DO UPDATE
SET label=EXCLUDED.label,
    description=EXCLUDED.description;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','PROCUREMENT_READ'), ('ADMIN_SUPER','PROCUREMENT_WRITE'), ('ADMIN_SUPER','PROCUREMENT_REQUISITION_READ'),
    ('ADMIN_SUPER','PROCUREMENT_REQUISITION_WRITE'), ('ADMIN_SUPER','PROCUREMENT_REQUISITION_APPROVE'), ('ADMIN_SUPER','PROCUREMENT_RFQ_READ'),
    ('ADMIN_SUPER','PROCUREMENT_RFQ_WRITE'), ('ADMIN_SUPER','PROCUREMENT_QUOTE_REVIEW'), ('ADMIN_SUPER','PROCUREMENT_CASH_PURCHASE'),
    ('ADMIN_SUPER','SUPPLIER_LINK_READ'), ('ADMIN_SUPER','SUPPLIER_LINK_WRITE'),
    ('ACCESS_UNIVERSAL','PROCUREMENT_READ'), ('ACCESS_UNIVERSAL','PROCUREMENT_WRITE'), ('ACCESS_UNIVERSAL','PROCUREMENT_REQUISITION_READ'),
    ('ACCESS_UNIVERSAL','PROCUREMENT_REQUISITION_WRITE'), ('ACCESS_UNIVERSAL','PROCUREMENT_REQUISITION_APPROVE'), ('ACCESS_UNIVERSAL','PROCUREMENT_RFQ_READ'),
    ('ACCESS_UNIVERSAL','PROCUREMENT_RFQ_WRITE'), ('ACCESS_UNIVERSAL','PROCUREMENT_QUOTE_REVIEW'), ('ACCESS_UNIVERSAL','PROCUREMENT_CASH_PURCHASE'),
    ('ACCESS_UNIVERSAL','SUPPLIER_LINK_READ'), ('ACCESS_UNIVERSAL','SUPPLIER_LINK_WRITE'),
    ('ECOM_ADMIN','PROCUREMENT_READ'), ('ECOM_ADMIN','PROCUREMENT_WRITE'), ('ECOM_ADMIN','PROCUREMENT_REQUISITION_READ'),
    ('ECOM_ADMIN','PROCUREMENT_REQUISITION_WRITE'), ('ECOM_ADMIN','PROCUREMENT_REQUISITION_APPROVE'), ('ECOM_ADMIN','PROCUREMENT_RFQ_READ'),
    ('ECOM_ADMIN','PROCUREMENT_RFQ_WRITE'), ('ECOM_ADMIN','PROCUREMENT_QUOTE_REVIEW'), ('ECOM_ADMIN','PROCUREMENT_CASH_PURCHASE'),
    ('ECOM_ADMIN','SUPPLIER_LINK_READ'), ('ECOM_ADMIN','SUPPLIER_LINK_WRITE'),
    ('ECOM_USER','PROCUREMENT_READ'), ('ECOM_USER','PROCUREMENT_REQUISITION_READ'), ('ECOM_USER','PROCUREMENT_REQUISITION_WRITE'),
    ('ECOM_USER','PROCUREMENT_RFQ_READ'), ('ECOM_USER','SUPPLIER_LINK_READ'),
    ('ACCESS_ECOM_FULL','PROCUREMENT_READ'), ('ACCESS_ECOM_FULL','PROCUREMENT_WRITE'), ('ACCESS_ECOM_FULL','PROCUREMENT_REQUISITION_READ'),
    ('ACCESS_ECOM_FULL','PROCUREMENT_REQUISITION_WRITE'), ('ACCESS_ECOM_FULL','PROCUREMENT_RFQ_READ'), ('ACCESS_ECOM_FULL','PROCUREMENT_RFQ_WRITE'),
    ('ACCESS_ECOM_FULL','PROCUREMENT_QUOTE_REVIEW'), ('ACCESS_ECOM_FULL','PROCUREMENT_CASH_PURCHASE'), ('ACCESS_ECOM_FULL','SUPPLIER_LINK_READ'),
    ('ACCESS_ECOM_FULL','SUPPLIER_LINK_WRITE'),
    ('ACCESS_READ_ONLY','PROCUREMENT_READ'), ('ACCESS_READ_ONLY','PROCUREMENT_REQUISITION_READ'), ('ACCESS_READ_ONLY','PROCUREMENT_RFQ_READ'),
    ('ACCESS_READ_ONLY','SUPPLIER_LINK_READ')
)
INSERT INTO eip_authz.role_template_permission(role_code, permission_code)
SELECT rt.code, bundles.permission_code
FROM eip_authz.role_template rt
JOIN bundles ON bundles.role_code=rt.code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','PROCUREMENT_READ'), ('ADMIN_SUPER','PROCUREMENT_WRITE'), ('ADMIN_SUPER','PROCUREMENT_REQUISITION_READ'),
    ('ADMIN_SUPER','PROCUREMENT_REQUISITION_WRITE'), ('ADMIN_SUPER','PROCUREMENT_REQUISITION_APPROVE'), ('ADMIN_SUPER','PROCUREMENT_RFQ_READ'),
    ('ADMIN_SUPER','PROCUREMENT_RFQ_WRITE'), ('ADMIN_SUPER','PROCUREMENT_QUOTE_REVIEW'), ('ADMIN_SUPER','PROCUREMENT_CASH_PURCHASE'),
    ('ADMIN_SUPER','SUPPLIER_LINK_READ'), ('ADMIN_SUPER','SUPPLIER_LINK_WRITE'),
    ('ACCESS_UNIVERSAL','PROCUREMENT_READ'), ('ACCESS_UNIVERSAL','PROCUREMENT_WRITE'), ('ACCESS_UNIVERSAL','PROCUREMENT_REQUISITION_READ'),
    ('ACCESS_UNIVERSAL','PROCUREMENT_REQUISITION_WRITE'), ('ACCESS_UNIVERSAL','PROCUREMENT_REQUISITION_APPROVE'), ('ACCESS_UNIVERSAL','PROCUREMENT_RFQ_READ'),
    ('ACCESS_UNIVERSAL','PROCUREMENT_RFQ_WRITE'), ('ACCESS_UNIVERSAL','PROCUREMENT_QUOTE_REVIEW'), ('ACCESS_UNIVERSAL','PROCUREMENT_CASH_PURCHASE'),
    ('ACCESS_UNIVERSAL','SUPPLIER_LINK_READ'), ('ACCESS_UNIVERSAL','SUPPLIER_LINK_WRITE'),
    ('ECOM_ADMIN','PROCUREMENT_READ'), ('ECOM_ADMIN','PROCUREMENT_WRITE'), ('ECOM_ADMIN','PROCUREMENT_REQUISITION_READ'),
    ('ECOM_ADMIN','PROCUREMENT_REQUISITION_WRITE'), ('ECOM_ADMIN','PROCUREMENT_REQUISITION_APPROVE'), ('ECOM_ADMIN','PROCUREMENT_RFQ_READ'),
    ('ECOM_ADMIN','PROCUREMENT_RFQ_WRITE'), ('ECOM_ADMIN','PROCUREMENT_QUOTE_REVIEW'), ('ECOM_ADMIN','PROCUREMENT_CASH_PURCHASE'),
    ('ECOM_ADMIN','SUPPLIER_LINK_READ'), ('ECOM_ADMIN','SUPPLIER_LINK_WRITE'),
    ('ECOM_USER','PROCUREMENT_READ'), ('ECOM_USER','PROCUREMENT_REQUISITION_READ'), ('ECOM_USER','PROCUREMENT_REQUISITION_WRITE'),
    ('ECOM_USER','PROCUREMENT_RFQ_READ'), ('ECOM_USER','SUPPLIER_LINK_READ'),
    ('ACCESS_ECOM_FULL','PROCUREMENT_READ'), ('ACCESS_ECOM_FULL','PROCUREMENT_WRITE'), ('ACCESS_ECOM_FULL','PROCUREMENT_REQUISITION_READ'),
    ('ACCESS_ECOM_FULL','PROCUREMENT_REQUISITION_WRITE'), ('ACCESS_ECOM_FULL','PROCUREMENT_RFQ_READ'), ('ACCESS_ECOM_FULL','PROCUREMENT_RFQ_WRITE'),
    ('ACCESS_ECOM_FULL','PROCUREMENT_QUOTE_REVIEW'), ('ACCESS_ECOM_FULL','PROCUREMENT_CASH_PURCHASE'), ('ACCESS_ECOM_FULL','SUPPLIER_LINK_READ'),
    ('ACCESS_ECOM_FULL','SUPPLIER_LINK_WRITE'),
    ('ACCESS_READ_ONLY','PROCUREMENT_READ'), ('ACCESS_READ_ONLY','PROCUREMENT_REQUISITION_READ'), ('ACCESS_READ_ONLY','PROCUREMENT_RFQ_READ'),
    ('ACCESS_READ_ONLY','SUPPLIER_LINK_READ')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT role_record.id, bundles.permission_code
FROM eip_authz.role role_record
JOIN bundles ON bundles.role_code=role_record.code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

INSERT INTO eip_core.module_catalog (code, label, description, attrs, is_active)
VALUES
  (
    'procurement',
    'Procurement',
    'Purchase requisitions, supplier policy links, RFQs, quote comparison, and cash/shop purchases',
    '{"capabilities":{"overview":true,"purchase_needs":true,"supplier_links":true,"requisitions":true,"rfqs":true,"cash_purchases":true},"scope":"sme_procurement_foundation"}'::jsonb,
    true
  )
ON CONFLICT (code) DO UPDATE
SET label=EXCLUDED.label,
    description=EXCLUDED.description,
    attrs=COALESCE(eip_core.module_catalog.attrs,'{}'::jsonb) || EXCLUDED.attrs,
    is_active=true,
    updated_at=now();

WITH target_tenants AS (
  SELECT DISTINCT tenant.id
  FROM eip_core.tenant tenant
  LEFT JOIN eip_core.tenant_module_setting inventory_setting
    ON inventory_setting.tenant_id=tenant.id
   AND inventory_setting.module='inventory'
   AND inventory_setting.is_active=true
  LEFT JOIN eip_core.tenant_module_setting ecom_setting
    ON ecom_setting.tenant_id=tenant.id
   AND ecom_setting.module IN ('ecom','commerce')
   AND ecom_setting.is_active=true
  WHERE tenant.is_active=true
    AND (
      tenant.code='eip_ecom'
      OR inventory_setting.id IS NOT NULL
      OR ecom_setting.id IS NOT NULL
      OR COALESCE(tenant.attrs->>'industry','')='ecom'
      OR COALESCE(tenant.attrs->>'template_kind','')='base'
    )
)
INSERT INTO eip_core.tenant_module_setting (tenant_id, module, code, attrs, is_active)
SELECT target_tenants.id, 'procurement', 'operations',
       '{"capabilities":{"overview":true,"purchase_needs":true,"supplier_links":true,"requisitions":true,"rfqs":true,"cash_purchases":true},"settings":{"default_currency":"EUR","minimum_quote_count":3,"cash_purchase_limit_value":100,"rfq_threshold_value":250}}'::jsonb,
       true
FROM target_tenants
ON CONFLICT (tenant_id, module, code) DO UPDATE
SET attrs=jsonb_set(
      COALESCE(eip_core.tenant_module_setting.attrs,'{}'::jsonb),
      '{capabilities}',
      COALESCE(eip_core.tenant_module_setting.attrs->'capabilities','{}'::jsonb) || '{"overview":true,"purchase_needs":true,"supplier_links":true,"requisitions":true,"rfqs":true,"cash_purchases":true}'::jsonb,
      true
    ),
    is_active=true,
    updated_at=now();

WITH target_tenants AS (
  SELECT DISTINCT tenant.id
  FROM eip_core.tenant tenant
  JOIN eip_core.tenant_module_setting procurement_setting
    ON procurement_setting.tenant_id=tenant.id
   AND procurement_setting.module='procurement'
   AND procurement_setting.is_active=true
  WHERE tenant.is_active=true
),
conditions(code, label, condition_type, condition_category, priority, scope, effect, attrs) AS (
  VALUES
    (
      'PROCUREMENT_POLICY_DEFAULT',
      'Default procurement policy',
      'PROCUREMENT_POLICY',
      'PURCHASING',
      80,
      '{}'::jsonb,
      '{"procurement_policy":{"procurement_model":"purchase_requisition_then_po","rfq_threshold_value":250,"direct_purchase_threshold_value":250,"minimum_quote_count":3,"approval_required":true,"approval_threshold_value":250,"currency":"EUR","selection_strategy":"lowest_landed_cost","quote_selection_weights":{"price_weight":0.4,"lead_time_weight":0.25,"otif_weight":0.2,"risk_weight":0.15}}}'::jsonb,
      '{"module":"procurement","owner":"commercial_condition","policy_scope":"tenant_default"}'::jsonb
    ),
    (
      'MATERIAL_SUPPLIER_STANDARD',
      'Standard material supplier condition',
      'MATERIAL_SUPPLIER_CONDITION',
      'PURCHASING',
      90,
      '{}'::jsonb,
      '{"supplier_policy":{"preferred_supplier_required":false,"accreditation_required":true,"blocked_supplier_allowed":false,"supplier_link_relation":"MATERIAL_SUPPLIER"}}'::jsonb,
      '{"module":"procurement","owner":"commercial_condition","policy_scope":"supplier_relationship"}'::jsonb
    ),
    (
      'PAYMENT_TERMS_NET_30',
      'Default payment terms',
      'PAYMENT_TERM_CONDITION',
      'FINANCE',
      100,
      '{}'::jsonb,
      '{"payment_terms":{"payment_terms_code":"NET_30","payment_due_days":30,"credit_available":true}}'::jsonb,
      '{"module":"procurement","owner":"commercial_condition","policy_scope":"payment_terms"}'::jsonb
    ),
    (
      'FREIGHT_COST_STANDARD',
      'Default freight estimate policy',
      'FREIGHT_COST_CONDITION',
      'LOGISTICS',
      110,
      '{}'::jsonb,
      '{"supplier_policy":{"freight_cost_estimate":0,"freight_in_landed_cost":true}}'::jsonb,
      '{"module":"procurement","owner":"commercial_condition","policy_scope":"freight"}'::jsonb
    ),
    (
      'CASH_PURCHASE_STANDARD',
      'Low-value cash purchase policy',
      'CASH_PURCHASE_CONDITION',
      'PURCHASING',
      70,
      '{}'::jsonb,
      '{"cash_purchase_policy":{"cash_purchase_allowed":true,"cash_purchase_limit_value":100,"payment_terms_code":"DUE_ON_RECEIPT","payment_due_days":0}}'::jsonb,
      '{"module":"procurement","owner":"commercial_condition","policy_scope":"cash_purchase"}'::jsonb
    )
)
INSERT INTO eip_core.commercial_condition
  (tenant_id, code, label, condition_type, condition_category, priority, scope, effect, attrs, is_active)
SELECT
  target_tenants.id,
  conditions.code,
  conditions.label,
  conditions.condition_type,
  conditions.condition_category,
  conditions.priority,
  conditions.scope,
  conditions.effect,
  conditions.attrs,
  true
FROM target_tenants
CROSS JOIN conditions
ON CONFLICT (tenant_id, code) DO UPDATE
SET label=EXCLUDED.label,
    condition_type=EXCLUDED.condition_type,
    condition_category=EXCLUDED.condition_category,
    priority=EXCLUDED.priority,
    scope=COALESCE(eip_core.commercial_condition.scope,'{}'::jsonb) || EXCLUDED.scope,
    effect=COALESCE(eip_core.commercial_condition.effect,'{}'::jsonb) || EXCLUDED.effect,
    attrs=COALESCE(eip_core.commercial_condition.attrs,'{}'::jsonb) || EXCLUDED.attrs,
    is_active=true,
    updated_at=now();

WITH target_tenants AS (
  SELECT DISTINCT tenant.id
  FROM eip_core.tenant tenant
  JOIN eip_core.tenant_module_setting procurement_setting
    ON procurement_setting.tenant_id=tenant.id
   AND procurement_setting.module='procurement'
   AND procurement_setting.is_active=true
  WHERE tenant.is_active=true
),
definitions(code, name, object_type, graph) AS (
  VALUES
    (
      'PURCHASE_REQUISITION_FLOW_V1',
      'Purchase requisition review flow',
      'PURCHASE_REQUISITION',
      '{
        "module":"procurement",
        "object_type":"PURCHASE_REQUISITION",
        "initial_node":"draft",
        "nodes":{
          "draft":{"id":"draft","type":"HUMAN_TASK","label":"Draft","on_enter":{"task_template_types":["PURCHASE_REQUISITION_REVIEW"]}},
          "review":{"id":"review","type":"HUMAN_TASK","label":"Review"},
          "approved":{"id":"approved","type":"STEP","label":"Approved"},
          "converted_to_rfq":{"id":"converted_to_rfq","type":"STEP","label":"Converted to RFQ"},
          "converted_to_po_draft":{"id":"converted_to_po_draft","type":"STEP","label":"Converted to PO draft"},
          "converted_to_cash_purchase":{"id":"converted_to_cash_purchase","type":"STEP","label":"Converted to cash purchase"},
          "ignored":{"id":"ignored","type":"END","label":"Ignored","is_terminal":true},
          "closed":{"id":"closed","type":"END","label":"Closed","is_terminal":true}
        },
        "transitions":[
          {"from":"draft","to":"review","action":"review","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"review"}]},
          {"from":"draft","to":"approved","action":"approve","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"approved"},{"type":"INFO_RECORD_WRITE","record_type":"PURCHASE_REQUISITION_DECISION","title":"Purchase requisition approved","payload":{"decision":"approved","note":"$payload.note"},"attrs":{"module":"procurement"},"links":[{"src_kind":"service_object","src_id":"$service_object_id","dst_kind":"info_record","relation_type":"DECISION"}]}]},
          {"from":"review","to":"approved","action":"approve","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"approved"},{"type":"INFO_RECORD_WRITE","record_type":"PURCHASE_REQUISITION_DECISION","title":"Purchase requisition approved","payload":{"decision":"approved","note":"$payload.note"},"attrs":{"module":"procurement"},"links":[{"src_kind":"service_object","src_id":"$service_object_id","dst_kind":"info_record","relation_type":"DECISION"}]}]},
          {"from":"draft","to":"ignored","action":"ignore","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"ignored"},{"type":"INFO_RECORD_WRITE","record_type":"PURCHASE_REQUISITION_DECISION","title":"Purchase requisition ignored","payload":{"decision":"ignored","note":"$payload.note"},"attrs":{"module":"procurement"},"links":[{"src_kind":"service_object","src_id":"$service_object_id","dst_kind":"info_record","relation_type":"DECISION"}]}]},
          {"from":"review","to":"ignored","action":"ignore","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"ignored"},{"type":"INFO_RECORD_WRITE","record_type":"PURCHASE_REQUISITION_DECISION","title":"Purchase requisition ignored","payload":{"decision":"ignored","note":"$payload.note"},"attrs":{"module":"procurement"},"links":[{"src_kind":"service_object","src_id":"$service_object_id","dst_kind":"info_record","relation_type":"DECISION"}]}]},
          {"from":"approved","to":"converted_to_rfq","action":"convert_to_rfq","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"converted_to_rfq"}]},
          {"from":"approved","to":"converted_to_po_draft","action":"convert_to_po_draft","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"converted_to_po_draft"}]},
          {"from":"approved","to":"converted_to_cash_purchase","action":"convert_to_cash_purchase","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"converted_to_cash_purchase"}]},
          {"from":"approved","to":"closed","action":"close","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"closed"}]},
          {"from":"converted_to_rfq","to":"closed","action":"close","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"closed"}]},
          {"from":"converted_to_po_draft","to":"closed","action":"close","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"closed"}]},
          {"from":"converted_to_cash_purchase","to":"closed","action":"close","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"closed"}]}
        ]
      }'::jsonb
    ),
    (
      'PURCHASE_RFQ_FLOW_V1',
      'Purchase RFQ flow',
      'PURCHASE_RFQ',
      '{
        "module":"procurement",
        "object_type":"PURCHASE_RFQ",
        "initial_node":"draft",
        "nodes":{
          "draft":{"id":"draft","type":"HUMAN_TASK","label":"Draft","on_enter":{"task_template_types":["RFQ_PREPARE"]}},
          "sent":{"id":"sent","type":"STEP","label":"Sent"},
          "quotes_pending":{"id":"quotes_pending","type":"HUMAN_TASK","label":"Quotes pending","on_enter":{"task_template_types":["SUPPLIER_QUOTE_INTAKE"]}},
          "comparison_ready":{"id":"comparison_ready","type":"HUMAN_TASK","label":"Comparison ready","on_enter":{"task_template_types":["SUPPLIER_QUOTE_REVIEW"]}},
          "supplier_selected":{"id":"supplier_selected","type":"STEP","label":"Supplier selected"},
          "cancelled":{"id":"cancelled","type":"END","label":"Cancelled","is_terminal":true},
          "closed":{"id":"closed","type":"END","label":"Closed","is_terminal":true}
        },
        "transitions":[
          {"from":"draft","to":"sent","action":"send","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"sent"}]},
          {"from":"sent","to":"quotes_pending","action":"wait_for_quotes","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"quotes_pending"}]},
          {"from":"quotes_pending","to":"comparison_ready","action":"compare","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"comparison_ready"}]},
          {"from":"draft","to":"comparison_ready","action":"compare","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"comparison_ready"}]},
          {"from":"comparison_ready","to":"supplier_selected","action":"approve_quote","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"supplier_selected"},{"type":"INFO_RECORD_WRITE","record_type":"SUPPLIER_QUOTE_DECISION","title":"Supplier quote approved","payload":{"decision":"approved","note":"$payload.note"},"attrs":{"module":"procurement"},"links":[{"src_kind":"service_object","src_id":"$service_object_id","dst_kind":"info_record","relation_type":"DECISION"}]}]},
          {"from":"supplier_selected","to":"closed","action":"close","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"closed"}]},
          {"from":"draft","to":"cancelled","action":"cancel","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"cancelled"}]},
          {"from":"sent","to":"cancelled","action":"cancel","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"cancelled"}]},
          {"from":"quotes_pending","to":"cancelled","action":"cancel","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"cancelled"}]}
        ]
      }'::jsonb
    ),
    (
      'SUPPLIER_QUOTE_REVIEW_FLOW_V1',
      'Supplier quote review flow',
      'SUPPLIER_QUOTE_REVIEW',
      '{
        "module":"procurement",
        "object_type":"SUPPLIER_QUOTE_REVIEW",
        "initial_node":"review",
        "nodes":{
          "review":{"id":"review","type":"HUMAN_TASK","label":"Review quotes","on_enter":{"task_template_types":["SUPPLIER_QUOTE_REVIEW"]}},
          "selected":{"id":"selected","type":"STEP","label":"Selected"},
          "closed":{"id":"closed","type":"END","label":"Closed","is_terminal":true}
        },
        "transitions":[
          {"from":"review","to":"selected","action":"select_quote","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"selected"}]},
          {"from":"selected","to":"closed","action":"close","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"closed"}]}
        ]
      }'::jsonb
    ),
    (
      'PURCHASE_ORDER_DRAFT_FLOW_V1',
      'Purchase order draft flow',
      'PURCHASE_ORDER_DRAFT',
      '{
        "module":"procurement",
        "object_type":"PURCHASE_ORDER_DRAFT",
        "initial_node":"draft",
        "nodes":{
          "draft":{"id":"draft","type":"HUMAN_TASK","label":"Draft PO","on_enter":{"task_template_types":["PURCHASE_ORDER_PREPARE"]}},
          "ready":{"id":"ready","type":"STEP","label":"Ready"},
          "closed":{"id":"closed","type":"END","label":"Closed","is_terminal":true}
        },
        "transitions":[
          {"from":"draft","to":"ready","action":"mark_ready","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"ready"}]},
          {"from":"ready","to":"closed","action":"close","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"closed"}]}
        ]
      }'::jsonb
    ),
    (
      'CASH_PURCHASE_FLOW_V1',
      'Cash purchase capture flow',
      'CASH_PURCHASE',
      '{
        "module":"procurement",
        "object_type":"CASH_PURCHASE",
        "initial_node":"recorded",
        "nodes":{
          "recorded":{"id":"recorded","type":"STEP","label":"Recorded"},
          "review":{"id":"review","type":"HUMAN_TASK","label":"Review receipt","on_enter":{"task_template_types":["CASH_PURCHASE_REVIEW"]}},
          "closed":{"id":"closed","type":"END","label":"Closed","is_terminal":true}
        },
        "transitions":[
          {"from":"recorded","to":"review","action":"review","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"review"}]},
          {"from":"recorded","to":"closed","action":"close","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"closed"}]},
          {"from":"review","to":"closed","action":"close","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"closed"}]}
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
    'source', 'procurement_foundation'
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
  WHERE pd.code IN (
    'PURCHASE_REQUISITION_FLOW_V1',
    'PURCHASE_RFQ_FLOW_V1',
    'SUPPLIER_QUOTE_REVIEW_FLOW_V1',
    'PURCHASE_ORDER_DRAFT_FLOW_V1',
    'CASH_PURCHASE_FLOW_V1'
  )
    AND pd.version=1
    AND pd.is_active=true
)
INSERT INTO eip_core.process_binding
  (tenant_id, service_object_type, process_def_id, is_active, priority, attrs)
SELECT definitions.tenant_id, definitions.object_type, definitions.id, true, 52,
       '{"module":"procurement","source":"procurement_foundation"}'::jsonb
FROM definitions
ON CONFLICT (tenant_id, service_object_type, process_def_id, (COALESCE(task_type, ''))) DO UPDATE
SET is_active=true,
    priority=EXCLUDED.priority,
    attrs=EXCLUDED.attrs,
    updated_at=now();

WITH definitions AS (
  SELECT pd.tenant_id, pd.id, pd.attrs->>'object_type' AS object_type
  FROM eip_core.process_def pd
  WHERE pd.code IN (
    'PURCHASE_REQUISITION_FLOW_V1',
    'PURCHASE_RFQ_FLOW_V1',
    'SUPPLIER_QUOTE_REVIEW_FLOW_V1',
    'PURCHASE_ORDER_DRAFT_FLOW_V1',
    'CASH_PURCHASE_FLOW_V1'
  )
    AND pd.version=1
    AND pd.is_active=true
),
templates(object_type, task_type, title, description, sort_order, attrs) AS (
  VALUES
    ('PURCHASE_REQUISITION','PURCHASE_REQUISITION_REVIEW','Review purchase requisition','Review suggested supplier, quantity, landed cost, payment terms, and RFQ requirement before purchase preparation.',10,'{"module":"procurement","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"medium","due_in_days":2},"due_in_days":2}'::jsonb),
    ('PURCHASE_RFQ','RFQ_PREPARE','Prepare RFQ','Prepare RFQ supplier list, due date, quantity, and quote requirements.',10,'{"module":"procurement","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"medium","due_in_days":2},"due_in_days":2}'::jsonb),
    ('PURCHASE_RFQ','SUPPLIER_QUOTE_INTAKE','Collect supplier quotes','Collect and record supplier quotes against the RFQ.',20,'{"module":"procurement","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"medium","due_in_days":5},"due_in_days":5}'::jsonb),
    ('PURCHASE_RFQ','SUPPLIER_QUOTE_REVIEW','Review supplier quotes','Compare price, lead time, risk, payment terms, and landed cost before selecting a supplier.',30,'{"module":"procurement","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"medium","due_in_days":2},"due_in_days":2}'::jsonb),
    ('SUPPLIER_QUOTE_REVIEW','SUPPLIER_QUOTE_REVIEW','Review supplier quotes','Dedicated quote review task for manual comparison and supplier selection.',10,'{"module":"procurement","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"medium","due_in_days":2},"due_in_days":2}'::jsonb),
    ('PURCHASE_ORDER_DRAFT','PURCHASE_ORDER_PREPARE','Prepare purchase order draft','Prepare purchase order draft after requisition or quote approval. Full PO execution is intentionally deferred.',10,'{"module":"procurement","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"medium","due_in_days":3},"due_in_days":3}'::jsonb),
    ('CASH_PURCHASE','CASH_PURCHASE_REVIEW','Review cash purchase receipt','Review low-value cash/shop purchase receipt and stock receipt movement.',10,'{"module":"procurement","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"low","due_in_days":7},"due_in_days":7}'::jsonb)
)
INSERT INTO eip_core.task_template
  (tenant_id, process_def_id, service_object_type, task_type, title, description, is_active, sort_order, attrs)
SELECT definitions.tenant_id, definitions.id, definitions.object_type, templates.task_type, templates.title,
       templates.description, true, templates.sort_order, templates.attrs
FROM definitions
JOIN templates ON templates.object_type=definitions.object_type
ON CONFLICT (tenant_id, process_def_id, (COALESCE(service_object_type,'')), task_type) DO UPDATE
SET title=EXCLUDED.title,
    description=EXCLUDED.description,
    is_active=true,
    sort_order=EXCLUDED.sort_order,
    attrs=EXCLUDED.attrs,
    updated_at=now();

CREATE INDEX IF NOT EXISTS object_link_material_supplier_procurement_idx
  ON eip_core.object_link (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type)
  WHERE relation_type='MATERIAL_SUPPLIER';

CREATE INDEX IF NOT EXISTS service_object_procurement_foundation_idx
  ON eip_core.service_object (tenant_id, object_type, status, created_at DESC, id)
  WHERE object_type IN ('PURCHASE_REQUISITION','PURCHASE_RFQ','CASH_PURCHASE','PURCHASE_ORDER_DRAFT','SUPPLIER_QUOTE_REVIEW');

CREATE INDEX IF NOT EXISTS service_object_procurement_source_reorder_idx
  ON eip_core.service_object (tenant_id, ((attrs->>'source_reorder_suggestion_id')))
  WHERE object_type='PURCHASE_REQUISITION';

CREATE INDEX IF NOT EXISTS service_object_procurement_source_requisition_idx
  ON eip_core.service_object (tenant_id, ((attrs->>'source_requisition_id')))
  WHERE object_type='PURCHASE_RFQ';

CREATE INDEX IF NOT EXISTS info_record_procurement_quote_idx
  ON eip_core.info_record (tenant_id, record_type, created_at DESC, id)
  WHERE record_type IN ('SUPPLIER_QUOTE','SUPPLIER_QUOTE_COMPARISON','PROCUREMENT_CASH_PURCHASE_RECEIPT','INVENTORY_STOCK_MOVEMENT','PURCHASE_REQUISITION_DECISION','SUPPLIER_QUOTE_DECISION');

CREATE INDEX IF NOT EXISTS info_record_procurement_rfq_idx
  ON eip_core.info_record (tenant_id, ((payload->>'rfq_id')), created_at DESC)
  WHERE record_type IN ('SUPPLIER_QUOTE','SUPPLIER_QUOTE_COMPARISON');

DO $$
DECLARE
  procurement_menu jsonb := '{"code":"procurement","label":"Procurement","icon":"ShoppingCart","module":"procurement"}'::jsonb;
  procurement_panel jsonb := '{
    "id":"user-procurement-panel",
    "type":"UserPanel",
    "props":{"tab":"procurement"},
    "children":[
      {
        "id":"procurement-workspace",
        "type":"ProcurementWorkspace",
        "props":{
          "module":"procurement",
          "title":"Procurement",
          "subtitle":"Supplier policy, purchase requisitions, RFQs, quote review, and cash/shop purchase capture.",
          "endpoints":{
            "overview":"/api/eip/procurement/overview",
            "supplierLinks":"/api/eip/procurement/supplier-links",
            "requisitions":"/api/eip/procurement/requisitions",
            "rfqs":"/api/eip/procurement/rfqs",
            "cashPurchases":"/api/eip/procurement/cash-purchases"
          },
          "tabs":[
            {"id":"overview","label":"Overview"},
            {"id":"needs","label":"Purchase Needs"},
            {"id":"suppliers","label":"Suppliers"},
            {"id":"requisitions","label":"Requisitions"},
            {"id":"rfqs","label":"RFQs"},
            {"id":"cash","label":"Cash Purchase"}
          ],
          "actions":{
            "refresh":"Refresh",
            "createRequisition":"Create requisition",
            "approve":"Approve",
            "ignore":"Ignore",
            "createRfq":"Create RFQ",
            "addQuote":"Add quote",
            "compareQuotes":"Compare quotes",
            "approveQuote":"Approve quote",
            "saveSupplierLink":"Save supplier link",
            "recordCashPurchase":"Record cash purchase"
          }
        }
      }
    ]
  }'::jsonb;
  surface_record record;
  next_menu jsonb;
  next_children jsonb;
BEGIN
  FOR surface_record IN
    SELECT ui_surface.id, ui_surface.tree
    FROM eip_core.ui_surface ui_surface
    WHERE ui_surface.code='dashboard'
      AND ui_surface.is_active=true
      AND ui_surface.is_published=true
  LOOP
    next_menu := COALESCE(surface_record.tree#>'{props,menu}','[]'::jsonb);
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(next_menu) existing_menu
      WHERE existing_menu->>'code'='procurement'
    ) THEN
      next_menu := next_menu || jsonb_build_array(procurement_menu);
    END IF;

    next_children := COALESCE(surface_record.tree->'children','[]'::jsonb);
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(next_children) existing_child
      WHERE existing_child->>'id'='user-procurement-panel'
    ) THEN
      next_children := next_children || jsonb_build_array(procurement_panel);
    END IF;

    UPDATE eip_core.ui_surface
    SET tree = jsonb_set(
          jsonb_set(surface_record.tree, '{props,menu}', next_menu, true),
          '{children}',
          next_children,
          true
        ),
        attrs = COALESCE(attrs,'{}'::jsonb) || '{"module":"dashboard","procurement_surface":true}'::jsonb,
        updated_at=now()
    WHERE id=surface_record.id;
  END LOOP;
END;
$$;

COMMIT;
