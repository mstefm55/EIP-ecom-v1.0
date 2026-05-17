-- 0050_connection_permissions.sql
-- Purpose: permissions for tenant connection management

BEGIN;

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('tenant.connection.read', 'Read connections', 'View tenant connection profiles and health'),
  ('tenant.connection.write', 'Write connections', 'Update tenant connection profile'),
  ('tenant.connection.api_key', 'Manage API keys', 'Create or revoke tenant API keys'),
  ('tenant.connection.template', 'Manage templates', 'Enable or disable tenant UI templates'),
  ('tenant.connection.log', 'Read connection logs', 'View handshake and connection logs')
ON CONFLICT (code) DO NOTHING;

INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, p.code
FROM eip_authz.role r
JOIN eip_authz.permission p ON p.code IN (
  'tenant.connection.read',
  'tenant.connection.write',
  'tenant.connection.api_key',
  'tenant.connection.template',
  'tenant.connection.log'
)
WHERE r.code = 'ADMIN_SUPER'
ON CONFLICT DO NOTHING;

COMMIT;
