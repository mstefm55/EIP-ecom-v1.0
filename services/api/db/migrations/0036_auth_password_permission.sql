BEGIN;

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('auth.password.write', 'Set password', 'Create or reset passwords for identities')
ON CONFLICT (code) DO NOTHING;

WITH role AS (
  SELECT id
  FROM eip_authz.role
  WHERE tenant_id = '18e6209d-155a-4932-9b7b-e11ad09aaf49'::uuid
    AND code = 'ADMIN_SUPER'
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT role.id, 'auth.password.write'
FROM role
ON CONFLICT DO NOTHING;

COMMIT;
