-- 0120_commercial_condition_structured_fields.sql
-- Purpose: governed field catalog for structured commercial_condition.effect values.
-- No new tables. Uses dropdown_list/dropdown_value like Product Studio variant headers.

BEGIN;

WITH target_tenants AS (
  SELECT DISTINCT tenant.id
  FROM eip_core.tenant tenant
  LEFT JOIN eip_core.tenant_module_setting ecom_setting
    ON ecom_setting.tenant_id=tenant.id
   AND ecom_setting.module='ecom'
   AND ecom_setting.is_active=true
  WHERE tenant.is_active=true
    AND (
      tenant.code='eip_ecom'
      OR ecom_setting.id IS NOT NULL
      OR COALESCE(tenant.attrs->>'industry','')='ecom'
      OR COALESCE(tenant.attrs->>'template_kind','')='base'
    )
),
field_lists AS (
  INSERT INTO eip_core.dropdown_list
    (tenant_id, module, code, name, version, is_active, attrs)
  SELECT
    target_tenants.id,
    'ecom',
    'ECOM_COMMERCIAL_CONDITION_FIELD',
    'Ecommerce Commercial Condition Field',
    1,
    true,
    '{
      "scope":"commercial_condition_fields",
      "delegated":true,
      "managed_by":"tenant",
      "target_table":"eip_core.commercial_condition",
      "target_column":"effect"
    }'::jsonb
  FROM target_tenants
  ON CONFLICT (tenant_id, module, code, version) DO UPDATE
  SET is_active=true,
      attrs=COALESCE(eip_core.dropdown_list.attrs,'{}'::jsonb) || EXCLUDED.attrs,
      updated_at=now()
  RETURNING id
),
fields(code, label, sort_order, attrs) AS (
  VALUES
    ('payment_terms_code','Payment terms code',10,'{"data_type":"text","effect_path":"payment_terms.payment_terms_code","allowed_condition_types":["PAYMENT_TERM_CONDITION","PAYMENT_TERMS","TRADE_TERMS"],"condition_category":"FINANCE"}'::jsonb),
    ('payment_due_days','Payment due days',20,'{"data_type":"integer","unit":"days","effect_path":"payment_terms.payment_due_days","allowed_condition_types":["PAYMENT_TERM_CONDITION","PAYMENT_TERMS","TRADE_TERMS"],"condition_category":"FINANCE"}'::jsonb),
    ('credit_limit_days','Credit limit days',30,'{"data_type":"integer","unit":"days","effect_path":"payment_terms.credit_limit_days","allowed_condition_types":["PAYMENT_TERM_CONDITION","PAYMENT_TERMS","TRADE_TERMS"],"condition_category":"FINANCE"}'::jsonb),
    ('credit_limit_amount','Credit limit amount',40,'{"data_type":"number","unit":"amount","effect_path":"payment_terms.credit_limit_amount","allowed_condition_types":["PAYMENT_TERM_CONDITION","PAYMENT_TERMS","TRADE_TERMS"],"condition_category":"FINANCE"}'::jsonb),
    ('credit_available','Credit available',50,'{"data_type":"boolean","effect_path":"payment_terms.credit_available","allowed_condition_types":["PAYMENT_TERM_CONDITION","PAYMENT_TERMS","TRADE_TERMS"],"condition_category":"FINANCE"}'::jsonb),
    ('minimum_order_qty','Minimum order quantity',60,'{"data_type":"number","unit":"qty","effect_path":"supplier_purchase.minimum_order_qty","allowed_condition_types":["SUPPLIER_PURCHASE_CONDITION","MATERIAL_SUPPLIER_CONDITION","TRADE_TERMS"],"condition_category":"PURCHASING"}'::jsonb),
    ('approval_threshold_value','Approval threshold value',70,'{"data_type":"number","unit":"amount","effect_path":"procurement_policy.approval_threshold_value","allowed_condition_types":["PROCUREMENT_POLICY","TRADE_TERMS"],"condition_category":"PURCHASING"}'::jsonb),
    ('cash_purchase_limit_value','Cash purchase limit value',80,'{"data_type":"number","unit":"amount","effect_path":"cash_purchase_policy.cash_purchase_limit_value","allowed_condition_types":["CASH_PURCHASE_CONDITION","TRADE_TERMS"],"condition_category":"PURCHASING"}'::jsonb),
    ('reorder_point_qty','Reorder point quantity',90,'{"data_type":"number","unit":"qty","effect_path":"reorder_policy.reorder_point_qty","allowed_condition_types":["INVENTORY_REORDER_POLICY","TRADE_TERMS"],"condition_category":"INVENTORY"}'::jsonb),
    ('discount_percent','Discount percent',100,'{"data_type":"number","unit":"percent","effect_path":"discount.percent","allowed_condition_types":["DISCOUNT","TRADE_TERMS"],"condition_category":"PRICING"}'::jsonb)
)
INSERT INTO eip_core.dropdown_value
  (list_id, code, label, sort_order, is_active, attrs)
SELECT
  field_lists.id,
  fields.code,
  fields.label,
  fields.sort_order,
  true,
  fields.attrs || '{"governed":true,"source":"commercial_condition_field_defaults"}'::jsonb
FROM field_lists
CROSS JOIN fields
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label,
    sort_order=EXCLUDED.sort_order,
    attrs=COALESCE(eip_core.dropdown_value.attrs,'{}'::jsonb) || EXCLUDED.attrs,
    is_active=true,
    updated_at=now();

COMMIT;
