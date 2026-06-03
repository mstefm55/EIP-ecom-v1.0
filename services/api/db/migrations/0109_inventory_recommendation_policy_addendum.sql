-- 0109_inventory_recommendation_policy_addendum.sql
-- Purpose: add professional inventory policy/recommendation governance without new tables.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.seed_inventory_dropdown(
  list_code text,
  list_name text,
  values_json jsonb
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  target_list_id uuid;
  item jsonb;
BEGIN
  SELECT dropdown_list.id INTO target_list_id
  FROM eip_core.dropdown_list dropdown_list
  WHERE dropdown_list.tenant_id IS NULL
    AND dropdown_list.module='inventory'
    AND dropdown_list.code=list_code
    AND dropdown_list.version=1
  ORDER BY dropdown_list.created_at ASC
  LIMIT 1;

  IF target_list_id IS NULL THEN
    INSERT INTO eip_core.dropdown_list
      (tenant_id, module, code, name, version, is_active, attrs)
    VALUES
      (NULL, 'inventory', list_code, list_name, 1, true, '{"ui":{"module":"inventory","scope":"recommendation_policy"}}'::jsonb)
    RETURNING id INTO target_list_id;
  ELSE
    UPDATE eip_core.dropdown_list
    SET name=list_name,
        is_active=true,
        attrs=COALESCE(attrs,'{}'::jsonb) || '{"ui":{"module":"inventory","scope":"recommendation_policy"}}'::jsonb,
        updated_at=now()
    WHERE id=target_list_id;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(values_json)
  LOOP
    INSERT INTO eip_core.dropdown_value
      (list_id, code, label, sort_order, is_active, attrs)
    VALUES
      (
        target_list_id,
        item->>'code',
        item->>'label',
        COALESCE((item->>'sort_order')::int, 100),
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

SELECT pg_temp.seed_inventory_dropdown('INVENTORY_ABC_CLASS', 'Inventory ABC Class', '[
  {"code":"A","label":"A - high value or strategic","sort_order":10},
  {"code":"B","label":"B - managed","sort_order":20},
  {"code":"C","label":"C - routine","sort_order":30}
]'::jsonb);

SELECT pg_temp.seed_inventory_dropdown('INVENTORY_RISK_STATUS', 'Inventory Risk Status', '[
  {"code":"healthy","label":"Healthy","sort_order":10},
  {"code":"watch","label":"Watch","sort_order":20},
  {"code":"reorder_now","label":"Reorder now","sort_order":30},
  {"code":"stockout_predicted","label":"Stockout predicted","sort_order":40},
  {"code":"already_out_of_stock","label":"Already out of stock","sort_order":50}
]'::jsonb);

SELECT pg_temp.seed_inventory_dropdown('INVENTORY_SUPPLIER_RISK_LEVEL', 'Inventory Supplier Risk Level', '[
  {"code":"low","label":"Low","sort_order":10},
  {"code":"medium","label":"Medium","sort_order":20},
  {"code":"high","label":"High","sort_order":30},
  {"code":"critical","label":"Critical","sort_order":40}
]'::jsonb);

SELECT pg_temp.seed_inventory_dropdown('INVENTORY_RECOMMENDED_ACTION', 'Inventory Recommended Action', '[
  {"code":"create_reorder_suggestion","label":"Create reorder suggestion","sort_order":10},
  {"code":"create_purchase_requisition_draft","label":"Create purchase requisition draft","sort_order":20},
  {"code":"create_supplier_check_task","label":"Create supplier check task","sort_order":30},
  {"code":"warn_cash_impact","label":"Warn cash impact","sort_order":40},
  {"code":"warn_stockout_risk","label":"Warn stockout risk","sort_order":50},
  {"code":"warn_supplier_risk","label":"Warn supplier risk","sort_order":60},
  {"code":"recommend_alternative_supplier","label":"Recommend alternative supplier","sort_order":70},
  {"code":"monitor_inventory_policy","label":"Monitor inventory policy","sort_order":80}
]'::jsonb);

SELECT pg_temp.seed_inventory_dropdown('INVENTORY_TASK_TYPE', 'Inventory Task Type', '[
  {"code":"STOCK_REVIEW","label":"Stock review","sort_order":10},
  {"code":"REORDER_REVIEW","label":"Reorder review","sort_order":20},
  {"code":"STOCK_COUNT","label":"Stock count","sort_order":30},
  {"code":"SUPPLIER_CHECK","label":"Supplier check","sort_order":40},
  {"code":"PURCHASE_REQUISITION_REVIEW","label":"Purchase requisition review","sort_order":50}
]'::jsonb);

UPDATE eip_core.module_catalog
SET attrs = COALESCE(attrs,'{}'::jsonb) || '{
      "capabilities":{
        "recommendations":true,
        "decision_cards":true,
        "stockout_prediction":true,
        "purchase_requisition_bridge":true,
        "cash_impact":true,
        "supplier_risk":true,
        "service_level_policy":true
      },
      "scope":"sme_inventory_reorder"
    }'::jsonb,
    updated_at=now()
WHERE code='inventory';

UPDATE eip_core.tenant_module_setting
SET attrs = COALESCE(attrs,'{}'::jsonb) || '{
      "capabilities":{
        "recommendations":true,
        "decision_cards":true,
        "stockout_prediction":true,
        "purchase_requisition_bridge":true,
        "cash_impact":true,
        "supplier_risk":true,
        "service_level_policy":true
      },
      "settings":{
        "default_reorder_review_mode":"human_review",
        "auto_create_reorder_suggestions":false,
        "auto_create_purchase_requisition_drafts":false,
        "approval_required_by_default":true,
        "supplier_communication_modes":["email","api_json","edi_webhook"]
      }
    }'::jsonb,
    updated_at=now()
WHERE module='inventory'
  AND code='operations'
  AND is_active=true;

WITH process_defs AS (
  SELECT process_def.tenant_id, process_def.id
  FROM eip_core.process_def process_def
  WHERE process_def.code='INVENTORY_REORDER_FLOW_V1'
    AND process_def.version=1
    AND process_def.is_active=true
)
INSERT INTO eip_core.task_template
  (tenant_id, process_def_id, service_object_type, task_type, title, description, is_active, sort_order, attrs)
SELECT process_defs.tenant_id,
       process_defs.id,
       'INVENTORY_REORDER_SUGGESTION',
       'PURCHASE_REQUISITION_REVIEW',
       'Review purchase requisition draft',
       'Review suggested quantity, cash impact, supplier risk, and policy exceptions before purchase commitment.',
       true,
       30,
       '{"module":"inventory","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"high","due_in_days":1},"due_in_days":1,"bridge":{"future_object_type":"PURCHASE_ORDER","requires_human_commitment":true}}'::jsonb
FROM process_defs
ON CONFLICT (tenant_id, process_def_id, (COALESCE(service_object_type,'')), task_type) DO UPDATE
SET title=EXCLUDED.title,
    description=EXCLUDED.description,
    is_active=true,
    sort_order=EXCLUDED.sort_order,
    attrs=COALESCE(eip_core.task_template.attrs,'{}'::jsonb) || EXCLUDED.attrs,
    updated_at=now();

COMMIT;
