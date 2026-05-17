-- 0078_admin_process_permissions.sql
-- Purpose: ensure admin roles can access process builder taxonomy/defs/instances

BEGIN;

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('CRM_PROCESS_DEF_READ', 'Read CRM processes', 'View CRM process defs/instances'),
  ('CRM_PROCESS_DEF_WRITE', 'Write CRM processes', 'Create/update CRM process defs/instances'),
  ('PROCESS_DEF_READ', 'Read process defs', 'View process definitions'),
  ('PROCESS_DEF_WRITE', 'Write process defs', 'Create/update process definitions'),
  ('PROCESS_INSTANCE_READ', 'Read process instances', 'View process instances'),
  ('PROCESS_INSTANCE_WRITE', 'Write process instances', 'Advance process instances')
ON CONFLICT (code) DO NOTHING;

INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, p.code
FROM eip_authz.role r
JOIN eip_authz.permission p ON p.code IN (
  'CRM_PROCESS_DEF_READ',
  'CRM_PROCESS_DEF_WRITE',
  'PROCESS_DEF_READ',
  'PROCESS_DEF_WRITE',
  'PROCESS_INSTANCE_READ',
  'PROCESS_INSTANCE_WRITE'
)
WHERE r.code IN ('ADMIN_SUPER', 'ADMIN_EXEC')
ON CONFLICT DO NOTHING;

COMMIT;
