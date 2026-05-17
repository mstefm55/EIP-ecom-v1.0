\set ON_ERROR_STOP on
BEGIN;

WITH so_list AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE tenant_id IS NULL
    AND module = 'core'
    AND code = 'SERVICE_OBJECT_STATUS'
    AND version = 1
  LIMIT 1
)
INSERT INTO eip_core.dropdown_value (
  list_id,
  code,
  label,
  sort_order,
  is_active,
  attrs
)
SELECT
  so_list.id,
  v.code,
  v.label,
  v.sort_order,
  true,
  v.attrs::jsonb
FROM so_list
CROSS JOIN (
  VALUES
  -- =====================================================
  -- COMMS_CASE (signals / CRM / inbound-outbound messages)
  -- =====================================================
  ('COMMS_NEW',         'New',         10,  '{"scope":"status","object_type":"COMMS_CASE","stage":"new"}'),
  ('COMMS_RECEIVED',    'Received',    20,  '{"scope":"status","object_type":"COMMS_CASE","stage":"open"}'),
  ('COMMS_TRIAGED',     'Triaged',     30,  '{"scope":"status","object_type":"COMMS_CASE","stage":"open"}'),
  ('COMMS_INTERPRETED', 'Interpreted', 40,  '{"scope":"status","object_type":"COMMS_CASE","stage":"open"}'),
  ('COMMS_DRAFTED',     'Drafted',     50,  '{"scope":"status","object_type":"COMMS_CASE","stage":"open"}'),
  ('COMMS_REVIEW',      'In Review',   60,  '{"scope":"status","object_type":"COMMS_CASE","stage":"open"}'),
  ('COMMS_APPROVED',    'Approved',    70,  '{"scope":"status","object_type":"COMMS_CASE","stage":"open"}'),
  ('COMMS_SENT',        'Sent',        80,  '{"scope":"status","object_type":"COMMS_CASE","stage":"done"}'),
  ('COMMS_FAILED',      'Failed',      90,  '{"scope":"status","object_type":"COMMS_CASE","stage":"blocked"}'),
  ('COMMS_CLOSED',      'Closed',     100,  '{"scope":"status","object_type":"COMMS_CASE","stage":"done"}'),

  -- ==========================
  -- ECOM_ORDER
  -- ==========================
  ('ORDER_NEW',         'New',         10,  '{"scope":"status","object_type":"ECOM_ORDER","stage":"new"}'),
  ('ORDER_PLACED',      'Placed',      20,  '{"scope":"status","object_type":"ECOM_ORDER","stage":"open"}'),
  ('ORDER_PAID',        'Paid',        30,  '{"scope":"status","object_type":"ECOM_ORDER","stage":"open"}'),
  ('ORDER_PACKING',     'Packing',     40,  '{"scope":"status","object_type":"ECOM_ORDER","stage":"open"}'),
  ('ORDER_SHIPPED',     'Shipped',     50,  '{"scope":"status","object_type":"ECOM_ORDER","stage":"open"}'),
  ('ORDER_DELIVERED',   'Delivered',   60,  '{"scope":"status","object_type":"ECOM_ORDER","stage":"done"}'),
  ('ORDER_REFUNDED',    'Refunded',    70,  '{"scope":"status","object_type":"ECOM_ORDER","stage":"done"}'),
  ('ORDER_CANCELLED',   'Cancelled',   80,  '{"scope":"status","object_type":"ECOM_ORDER","stage":"done"}'),
  ('ORDER_FAILED',      'Failed',      90,  '{"scope":"status","object_type":"ECOM_ORDER","stage":"blocked"}'),

  -- ==========================
  -- ECOM_ACCOUNT
  -- ==========================
  ('ACCT_NEW',          'New',         10,  '{"scope":"status","object_type":"ECOM_ACCOUNT","stage":"new"}'),
  ('ACCT_ACTIVE',       'Active',      20,  '{"scope":"status","object_type":"ECOM_ACCOUNT","stage":"open"}'),
  ('ACCT_SUSPENDED',    'Suspended',   30,  '{"scope":"status","object_type":"ECOM_ACCOUNT","stage":"blocked"}'),
  ('ACCT_CLOSED',       'Closed',      40,  '{"scope":"status","object_type":"ECOM_ACCOUNT","stage":"done"}')
) AS v(code, label, sort_order, attrs)
ON CONFLICT (list_id, code)
DO UPDATE SET
  label      = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active  = EXCLUDED.is_active,
  attrs      = EXCLUDED.attrs,
  updated_at = now();

COMMIT;
