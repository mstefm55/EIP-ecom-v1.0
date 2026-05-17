-- 0080_tenant_admin_access_role_backfill.sql
-- Purpose: ensure tenant settings/admin-access panel has role coverage in ecommerce/admin tenants

BEGIN;

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('tenant.admin_access.read', 'Read admin access', 'View EIP admin access grants for this tenant'),
  ('tenant.admin_access.write', 'Write admin access', 'Grant/revoke EIP admin access for this tenant')
ON CONFLICT (code) DO NOTHING;

-- Read access for tenant admin viewers.
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, 'tenant.admin_access.read'
FROM eip_authz.role r
WHERE r.code IN ('ADMIN_SUPER', 'ADMIN_EXEC', 'ADMIN_ASSOC', 'ECOM_ADMIN')
ON CONFLICT DO NOTHING;

-- Write access for tenant admin managers.
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, 'tenant.admin_access.write'
FROM eip_authz.role r
WHERE r.code IN ('ADMIN_SUPER', 'ADMIN_EXEC', 'ECOM_ADMIN')
ON CONFLICT DO NOTHING;

COMMIT;
