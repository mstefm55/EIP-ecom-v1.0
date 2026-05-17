-- 0062_admin_template_clone_permissions.sql
-- Purpose: permissions for tenant template cloning

BEGIN;

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('admin.template.read', 'Read template tenants', 'View template tenants for cloning'),
  ('admin.template.clone', 'Clone template tenants', 'Clone template tenant configuration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, p.code
FROM eip_authz.role r
JOIN eip_authz.permission p ON p.code IN ('admin.template.read', 'admin.template.clone')
WHERE r.code IN ('ADMIN_SUPER', 'ADMIN_EXEC')
ON CONFLICT DO NOTHING;

COMMIT;
