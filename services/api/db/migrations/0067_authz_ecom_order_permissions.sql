BEGIN;

-- =========================================================
-- ECOM order management permissions (idempotent)
-- =========================================================
INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('ECOM_ORDER_READ',   'Read ECOM orders',   'View ecommerce orders'),
  ('ECOM_ORDER_WRITE',  'Write ECOM orders',  'Create/update ecommerce orders'),
  ('ECOM_RETURN_READ',  'Read ECOM returns',  'View ecommerce return requests'),
  ('ECOM_RETURN_WRITE', 'Write ECOM returns', 'Create/update ecommerce return requests'),
  ('ECOM_REFUND_READ',  'Read ECOM refunds',  'View ecommerce refund requests'),
  ('ECOM_REFUND_WRITE', 'Write ECOM refunds', 'Create/update ecommerce refund requests'),
  ('ECOM_SETTINGS_WRITE', 'Write ECOM settings', 'Update ecommerce order settings')
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- Role bundles (apply to all tenants)
-- =========================================================
WITH roles AS (
  SELECT id, code
  FROM eip_authz.role
  WHERE code IN ('ADMIN_SUPER','ERP_USER','ECOM_ADMIN')
),
rp(role_code, perm_code) AS (
  VALUES
    ('ECOM_ADMIN','ECOM_ORDER_READ'),
    ('ECOM_ADMIN','ECOM_ORDER_WRITE'),
    ('ECOM_ADMIN','ECOM_RETURN_READ'),
    ('ECOM_ADMIN','ECOM_RETURN_WRITE'),
    ('ECOM_ADMIN','ECOM_REFUND_READ'),
    ('ECOM_ADMIN','ECOM_REFUND_WRITE'),
    ('ECOM_ADMIN','ECOM_SETTINGS_WRITE'),
    ('ERP_USER','ECOM_ORDER_READ'),
    ('ERP_USER','ECOM_ORDER_WRITE'),
    ('ERP_USER','ECOM_RETURN_READ'),
    ('ERP_USER','ECOM_RETURN_WRITE'),
    ('ERP_USER','ECOM_REFUND_READ'),
    ('ERP_USER','ECOM_REFUND_WRITE'),
    ('ADMIN_SUPER','ECOM_ORDER_READ'),
    ('ADMIN_SUPER','ECOM_ORDER_WRITE'),
    ('ADMIN_SUPER','ECOM_RETURN_READ'),
    ('ADMIN_SUPER','ECOM_RETURN_WRITE'),
    ('ADMIN_SUPER','ECOM_REFUND_READ'),
    ('ADMIN_SUPER','ECOM_REFUND_WRITE'),
    ('ADMIN_SUPER','ECOM_SETTINGS_WRITE')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, rp.perm_code
FROM rp
JOIN roles r ON r.code = rp.role_code
ON CONFLICT DO NOTHING;

COMMIT;
