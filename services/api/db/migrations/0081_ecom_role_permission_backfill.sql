-- 0081_ecom_role_permission_backfill.sql
-- Purpose: align ECOM permissions with ADMIN_EXEC/ADMIN_ASSOC role bundles

BEGIN;

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('ECOM_PRODUCT_READ', 'Read ECOM products', 'View ecommerce products'),
  ('ECOM_PRODUCT_WRITE', 'Write ECOM products', 'Create/update ecommerce products'),
  ('ECOM_ORDER_READ', 'Read ECOM orders', 'View ecommerce orders'),
  ('ECOM_ORDER_WRITE', 'Write ECOM orders', 'Create/update ecommerce orders'),
  ('ECOM_RETURN_READ', 'Read ECOM returns', 'View ecommerce return requests'),
  ('ECOM_RETURN_WRITE', 'Write ECOM returns', 'Create/update ecommerce return requests'),
  ('ECOM_REFUND_READ', 'Read ECOM refunds', 'View ecommerce refund requests'),
  ('ECOM_REFUND_WRITE', 'Write ECOM refunds', 'Create/update ecommerce refund requests'),
  ('ECOM_SETTINGS_WRITE', 'Write ECOM settings', 'Update ecommerce order settings')
ON CONFLICT (code) DO NOTHING;

-- ADMIN_EXEC can operate the full tenant ecommerce workspace.
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, p.code
FROM eip_authz.role r
JOIN eip_authz.permission p ON p.code IN (
  'ECOM_PRODUCT_READ',
  'ECOM_PRODUCT_WRITE',
  'ECOM_ORDER_READ',
  'ECOM_ORDER_WRITE',
  'ECOM_RETURN_READ',
  'ECOM_RETURN_WRITE',
  'ECOM_REFUND_READ',
  'ECOM_REFUND_WRITE',
  'ECOM_SETTINGS_WRITE'
)
WHERE r.code = 'ADMIN_EXEC'
ON CONFLICT DO NOTHING;

-- ADMIN_ASSOC stays read-only for ecommerce monitoring.
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, p.code
FROM eip_authz.role r
JOIN eip_authz.permission p ON p.code IN (
  'ECOM_PRODUCT_READ',
  'ECOM_ORDER_READ',
  'ECOM_RETURN_READ',
  'ECOM_REFUND_READ'
)
WHERE r.code = 'ADMIN_ASSOC'
ON CONFLICT DO NOTHING;

COMMIT;
