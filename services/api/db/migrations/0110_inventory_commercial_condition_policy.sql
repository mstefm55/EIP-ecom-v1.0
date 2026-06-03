-- 0110_inventory_commercial_condition_policy.sql
-- Purpose: move governed inventory reorder defaults into commercial_condition.
-- No new tables. material.attrs.inventory remains state + overrides + calculated snapshots.

BEGIN;

WITH target_tenants AS (
  SELECT tenant.id
  FROM eip_core.tenant tenant
  LEFT JOIN eip_core.tenant_module_setting inventory_setting
    ON inventory_setting.tenant_id=tenant.id
   AND inventory_setting.module='inventory'
   AND inventory_setting.is_active=true
  WHERE tenant.is_active=true
    AND (
      tenant.code='eip_ecom'
      OR inventory_setting.id IS NOT NULL
      OR COALESCE(tenant.attrs->>'industry','')='ecom'
      OR COALESCE(tenant.attrs->>'template_kind','')='base'
    )
),
conditions(code, label, condition_type, condition_category, priority, scope, effect, attrs) AS (
  VALUES
    (
      'INV_REORDER_DEFAULT',
      'Default inventory reorder policy',
      'INVENTORY_REORDER_POLICY',
      'INVENTORY',
      100,
      '{}'::jsonb,
      '{
        "planning_method":"reorder_point",
        "service_level_target":0.95,
        "reorder_point_qty":0,
        "reorder_qty":0,
        "minimum_stock_qty":0,
        "maximum_stock_qty":0,
        "safety_stock_qty":0,
        "lead_time_days":0,
        "safety_lead_time_days":0,
        "minimum_order_qty":0,
        "order_multiple":0,
        "approval_required":true,
        "approval_threshold_value":0,
        "currency":"EUR",
        "auto_reorder_enabled":false
      }'::jsonb,
      '{"module":"inventory","owner":"commercial_condition","policy_scope":"tenant_default"}'::jsonb
    ),
    (
      'SUPPLY_REORDER_STANDARD',
      'Standard supply reorder condition',
      'SUPPLY_REORDER_CONDITION',
      'SUPPLY',
      90,
      '{}'::jsonb,
      '{
        "supplier_risk_level":"medium",
        "single_source_risk":false,
        "lead_time_variability":0,
        "supply_disruption_flag":false,
        "alternative_supplier_available":false,
        "supplier_reliability_score":null,
        "reorder_transaction_cost":0,
        "freight_cost_estimate":0,
        "holding_cost_percent":0
      }'::jsonb,
      '{"module":"inventory","owner":"commercial_condition","policy_scope":"supply_default"}'::jsonb
    ),
    (
      'SUPPLIER_PURCHASE_STANDARD',
      'Standard supplier purchase condition',
      'SUPPLIER_PURCHASE_CONDITION',
      'PURCHASING',
      90,
      '{}'::jsonb,
      '{
        "minimum_order_qty":0,
        "order_multiple":0,
        "approval_required":true,
        "approval_threshold_value":0,
        "currency":"EUR",
        "payment_timing_hint":"future_cashflow_signal"
      }'::jsonb,
      '{"module":"inventory","owner":"commercial_condition","policy_scope":"supplier_default","future_transmission_modes":["email","api_json","edi_webhook"]}'::jsonb
    )
)
INSERT INTO eip_core.commercial_condition
  (tenant_id, code, label, condition_type, condition_category, priority, scope, effect, attrs, is_active)
SELECT target_tenants.id,
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
    scope=EXCLUDED.scope,
    effect=EXCLUDED.effect || COALESCE(eip_core.commercial_condition.effect,'{}'::jsonb),
    attrs=EXCLUDED.attrs || COALESCE(eip_core.commercial_condition.attrs,'{}'::jsonb),
    is_active=true,
    updated_at=now();

UPDATE eip_core.tenant_module_setting
SET attrs = COALESCE(attrs,'{}'::jsonb) || '{
      "policy_governance":{
        "reorder_policy_source":"commercial_condition",
        "material_attrs_role":"state_override_snapshot",
        "condition_types":["INVENTORY_REORDER_POLICY","SUPPLY_REORDER_CONDITION","SUPPLIER_PURCHASE_CONDITION"]
      }
    }'::jsonb,
    updated_at=now()
WHERE module='inventory'
  AND code='operations'
  AND is_active=true;

COMMIT;
