-- 0118_task_command_center_permission_backfill.sql
-- Govern Command Center task delegation/scheduling through reusable task permissions.

BEGIN;

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('TASK_DELEGATE', 'Delegate tasks', 'Delegate or reassign tenant-scoped task engine items'),
  ('TASK_SCHEDULE', 'Schedule tasks', 'Update due date, planning, reminder, priority, and schedule metadata for task engine items')
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER', 'TASK_DELEGATE'),
    ('ADMIN_SUPER', 'TASK_SCHEDULE'),

    ('ADMIN_EXEC', 'TASK_DELEGATE'),
    ('ADMIN_EXEC', 'TASK_SCHEDULE'),

    ('ECOM_ADMIN', 'TASK_DELEGATE'),
    ('ECOM_ADMIN', 'TASK_SCHEDULE'),

    ('ERP_USER', 'TASK_DELEGATE'),
    ('ERP_USER', 'TASK_SCHEDULE'),

    ('CRM_ADMIN', 'TASK_DELEGATE'),
    ('CRM_ADMIN', 'TASK_SCHEDULE'),

    ('CRM_USER', 'TASK_DELEGATE'),
    ('CRM_USER', 'TASK_SCHEDULE'),

    ('ACCESS_UNIVERSAL', 'TASK_DELEGATE'),
    ('ACCESS_UNIVERSAL', 'TASK_SCHEDULE'),

    ('ACCESS_ECOM_FULL', 'TASK_DELEGATE'),
    ('ACCESS_ECOM_FULL', 'TASK_SCHEDULE'),

    ('ACCESS_ECOM_CATALOG', 'TASK_DELEGATE'),
    ('ACCESS_ECOM_CATALOG', 'TASK_SCHEDULE'),

    ('ACCESS_ECOM_ORDERS', 'TASK_DELEGATE'),
    ('ACCESS_ECOM_ORDERS', 'TASK_SCHEDULE'),

    ('ACCESS_CRM_FULL', 'TASK_DELEGATE'),
    ('ACCESS_CRM_FULL', 'TASK_SCHEDULE')
)
INSERT INTO eip_authz.role_template_permission(role_code, permission_code)
SELECT bundles.role_code, bundles.permission_code
FROM bundles
JOIN eip_authz.role_template role_template ON role_template.code = bundles.role_code
JOIN eip_authz.permission permission ON permission.code = bundles.permission_code
ON CONFLICT DO NOTHING;

WITH bundles(role_code, permission_code) AS (
  SELECT role_code, permission_code
  FROM eip_authz.role_template_permission
  WHERE permission_code IN ('TASK_DELEGATE', 'TASK_SCHEDULE')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT role.id, bundles.permission_code
FROM eip_authz.role
JOIN bundles ON bundles.role_code = role.code
JOIN eip_authz.permission permission ON permission.code = bundles.permission_code
ON CONFLICT DO NOTHING;

COMMIT;
