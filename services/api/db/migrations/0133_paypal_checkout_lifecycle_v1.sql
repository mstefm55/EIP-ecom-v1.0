-- 0133_paypal_checkout_lifecycle_v1.sql
-- Adds governed payment/order lifecycle labels used by verified PayPal capture and refunds.

BEGIN;

WITH target AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE code='SERVICE_OBJECT_STATUS' AND is_active=true
  ORDER BY (tenant_id IS NOT NULL) DESC, version DESC
  LIMIT 1
), values_to_seed(code, label, sort_order, attrs) AS (
  VALUES
    ('pending_payment','Pending payment',41,'{"scope":"status","module":"ecom","object_types":["sales_order"]}'::jsonb),
    ('confirmed','Confirmed',52,'{"scope":"status","module":"ecom","object_types":["sales_order"]}'::jsonb),
    ('refund_pending','Refund pending',73,'{"scope":"status","module":"ecom","object_types":["payment"]}'::jsonb),
    ('partially_refunded','Partially refunded',81,'{"scope":"status","module":"ecom","object_types":["payment","sales_order"]}'::jsonb),
    ('refund_failed','Refund failed',83,'{"scope":"status","module":"ecom","object_types":["payment"]}'::jsonb)
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT target.id, seed.code, seed.label, seed.sort_order, true, seed.attrs
FROM target CROSS JOIN values_to_seed seed
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label,
    sort_order=EXCLUDED.sort_order,
    is_active=true,
    attrs=EXCLUDED.attrs,
    updated_at=now();

WITH target AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE module='ecom' AND code='ECOM_PAYMENT_STATUS' AND is_active=true
  ORDER BY (tenant_id IS NOT NULL) DESC, version DESC
  LIMIT 1
), values_to_seed(code, label, sort_order) AS (
  VALUES
    ('refund_pending','Refund pending',92),
    ('partially_refunded','Partially refunded',96),
    ('refund_failed','Refund failed',98)
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT target.id, seed.code, seed.label, seed.sort_order, true,
       '{"module":"ecom","scope":"paypal_checkout_lifecycle_v1"}'::jsonb
FROM target CROSS JOIN values_to_seed seed
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label,
    sort_order=EXCLUDED.sort_order,
    is_active=true,
    attrs=EXCLUDED.attrs,
    updated_at=now();

WITH target AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE module='ecom' AND code='ECOM_PAYMENT_EVENT_TYPE' AND is_active=true
  ORDER BY (tenant_id IS NOT NULL) DESC, version DESC
  LIMIT 1
), values_to_seed(code, label, sort_order) AS (
  VALUES
    ('payment_approved','Payment approved',25),
    ('refund_pending','Refund pending',82),
    ('payment_refunded','Payment refunded',90),
    ('refund_failed','Refund failed',95)
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT target.id, seed.code, seed.label, seed.sort_order, true,
       '{"module":"ecom","scope":"paypal_checkout_lifecycle_v1"}'::jsonb
FROM target CROSS JOIN values_to_seed seed
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label,
    sort_order=EXCLUDED.sort_order,
    is_active=true,
    attrs=EXCLUDED.attrs,
    updated_at=now();

COMMIT;
