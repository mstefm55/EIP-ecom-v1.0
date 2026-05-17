BEGIN;

-- =========================================================
-- ECOM catalog permissions (idempotent)
-- =========================================================
INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('ECOM_PRODUCT_READ',  'Read ECOM products',  'View ecommerce products'),
  ('ECOM_PRODUCT_WRITE', 'Write ECOM products', 'Create/update ecommerce products')
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- Ensure ECOM_ADMIN role exists for every tenant
-- =========================================================
INSERT INTO eip_authz.role(tenant_id, code, label, surface_code, is_system)
SELECT t.id, 'ECOM_ADMIN', 'ECOM Admin', 'ERP', true
FROM eip_core.tenant t
WHERE NOT EXISTS (
  SELECT 1
  FROM eip_authz.role r
  WHERE r.tenant_id = t.id AND r.code = 'ECOM_ADMIN'
);

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
    ('ECOM_ADMIN','ECOM_PRODUCT_READ'),
    ('ECOM_ADMIN','ECOM_PRODUCT_WRITE'),
    ('ERP_USER','ECOM_PRODUCT_READ'),
    ('ERP_USER','ECOM_PRODUCT_WRITE'),
    ('ADMIN_SUPER','ECOM_PRODUCT_READ'),
    ('ADMIN_SUPER','ECOM_PRODUCT_WRITE')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, rp.perm_code
FROM rp
JOIN roles r ON r.code = rp.role_code
ON CONFLICT DO NOTHING;

COMMIT;
