BEGIN;

-- =========================================================
-- Core process engine permissions (generic)
-- =========================================================
INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('PROCESS_DEF_READ', 'Read process defs', 'View process definitions'),
  ('PROCESS_DEF_WRITE', 'Write process defs', 'Create/update process definitions'),
  ('PROCESS_INSTANCE_READ', 'Read process instances', 'View process instances'),
  ('PROCESS_INSTANCE_WRITE', 'Write process instances', 'Create/update process instances')
ON CONFLICT (code) DO NOTHING;

WITH roles AS (
  SELECT id, code
  FROM eip_authz.role
  WHERE code IN ('ADMIN_SUPER', 'CRM_ADMIN', 'CRM_USER')
),
rp(role_code, perm_code) AS (
  VALUES
    ('ADMIN_SUPER','PROCESS_DEF_READ'),
    ('ADMIN_SUPER','PROCESS_DEF_WRITE'),
    ('ADMIN_SUPER','PROCESS_INSTANCE_READ'),
    ('ADMIN_SUPER','PROCESS_INSTANCE_WRITE'),

    ('CRM_ADMIN','PROCESS_DEF_READ'),
    ('CRM_ADMIN','PROCESS_DEF_WRITE'),
    ('CRM_ADMIN','PROCESS_INSTANCE_READ'),
    ('CRM_ADMIN','PROCESS_INSTANCE_WRITE'),

    ('CRM_USER','PROCESS_DEF_READ'),
    ('CRM_USER','PROCESS_INSTANCE_READ')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, rp.perm_code
FROM rp
JOIN roles r ON r.code = rp.role_code
ON CONFLICT DO NOTHING;

COMMIT;
