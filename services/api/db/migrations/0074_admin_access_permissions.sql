-- 0074_admin_access_permissions.sql
-- Purpose: permissions for admin users/roles + module subscriptions

BEGIN;

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('admin.user.read', 'Read tenant users', 'View tenant users and role assignments'),
  ('admin.user.write', 'Write tenant users', 'Assign or revoke tenant roles'),
  ('admin.module.read', 'Read tenant modules', 'View tenant module subscriptions'),
  ('admin.module.write', 'Write tenant modules', 'Enable or disable tenant modules')
ON CONFLICT (code) DO NOTHING;

INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, p.code
FROM eip_authz.role r
JOIN eip_authz.permission p ON p.code IN (
  'admin.user.read',
  'admin.user.write',
  'admin.module.read',
  'admin.module.write'
)
WHERE r.code IN ('ADMIN_SUPER', 'ADMIN_EXEC')
ON CONFLICT DO NOTHING;

COMMIT;
