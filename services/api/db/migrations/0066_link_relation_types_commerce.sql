BEGIN;

-- Extend LINK_RELATION_TYPE list with commerce relations.
WITH list AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE code = 'LINK_RELATION_TYPE'
    AND version = 1
    AND tenant_id IS NULL
  LIMIT 1
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT list.id, v.code, v.label, v.sort_order, true, '{}'::jsonb
FROM list,
LATERAL (
  VALUES
    ('ORDER_ITEM',       'Order item',       110),
    ('PAYMENT_FOR',      'Payment for',      120),
    ('FULFILLMENT_FOR',  'Fulfillment for',  130),
    ('RETURN_FOR',       'Return for',       140),
    ('REFUND_FOR',       'Refund for',       150)
) AS v(code, label, sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

COMMIT;
