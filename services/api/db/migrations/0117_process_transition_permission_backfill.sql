-- 0117_process_transition_permission_backfill.sql
-- Keep process transition permissions attached to governed user profile/access roles.

BEGIN;

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('PROCESS_DEF_READ', 'Read process defs', 'View process definitions'),
  ('PROCESS_DEF_WRITE', 'Write process defs', 'Create/update process definitions'),
  ('PROCESS_INSTANCE_READ', 'Read process instances', 'View process instances'),
  ('PROCESS_INSTANCE_WRITE', 'Write process instances', 'Advance process instances'),
  ('CRM_PROCESS_DEF_READ', 'Read CRM processes', 'View CRM process defs/instances'),
  ('CRM_PROCESS_DEF_WRITE', 'Write CRM processes', 'Create/update CRM process defs/instances')
ON CONFLICT (code) DO NOTHING;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER', 'PROCESS_DEF_READ'),
    ('ADMIN_SUPER', 'PROCESS_DEF_WRITE'),
    ('ADMIN_SUPER', 'PROCESS_INSTANCE_READ'),
    ('ADMIN_SUPER', 'PROCESS_INSTANCE_WRITE'),
    ('ADMIN_SUPER', 'CRM_PROCESS_DEF_READ'),
    ('ADMIN_SUPER', 'CRM_PROCESS_DEF_WRITE'),

    ('ADMIN_EXEC', 'PROCESS_DEF_READ'),
    ('ADMIN_EXEC', 'PROCESS_INSTANCE_READ'),
    ('ADMIN_EXEC', 'PROCESS_INSTANCE_WRITE'),

    ('ADMIN_ASSOC', 'PROCESS_DEF_READ'),
    ('ADMIN_ASSOC', 'PROCESS_INSTANCE_READ'),

    ('ECOM_ADMIN', 'PROCESS_DEF_READ'),
    ('ECOM_ADMIN', 'PROCESS_INSTANCE_READ'),
    ('ECOM_ADMIN', 'PROCESS_INSTANCE_WRITE'),

    ('ECOM_USER', 'PROCESS_DEF_READ'),
    ('ECOM_USER', 'PROCESS_INSTANCE_READ'),

    ('ERP_USER', 'PROCESS_DEF_READ'),
    ('ERP_USER', 'PROCESS_INSTANCE_READ'),
    ('ERP_USER', 'PROCESS_INSTANCE_WRITE'),

    ('CRM_ADMIN', 'PROCESS_DEF_READ'),
    ('CRM_ADMIN', 'PROCESS_DEF_WRITE'),
    ('CRM_ADMIN', 'PROCESS_INSTANCE_READ'),
    ('CRM_ADMIN', 'PROCESS_INSTANCE_WRITE'),
    ('CRM_ADMIN', 'CRM_PROCESS_DEF_READ'),
    ('CRM_ADMIN', 'CRM_PROCESS_DEF_WRITE'),

    ('CRM_USER', 'PROCESS_DEF_READ'),
    ('CRM_USER', 'PROCESS_INSTANCE_READ'),
    ('CRM_USER', 'PROCESS_INSTANCE_WRITE'),
    ('CRM_USER', 'CRM_PROCESS_DEF_READ'),

    ('ACCESS_UNIVERSAL', 'PROCESS_DEF_READ'),
    ('ACCESS_UNIVERSAL', 'PROCESS_DEF_WRITE'),
    ('ACCESS_UNIVERSAL', 'PROCESS_INSTANCE_READ'),
    ('ACCESS_UNIVERSAL', 'PROCESS_INSTANCE_WRITE'),
    ('ACCESS_UNIVERSAL', 'CRM_PROCESS_DEF_READ'),
    ('ACCESS_UNIVERSAL', 'CRM_PROCESS_DEF_WRITE'),

    ('ACCESS_ECOM_FULL', 'PROCESS_DEF_READ'),
    ('ACCESS_ECOM_FULL', 'PROCESS_INSTANCE_READ'),
    ('ACCESS_ECOM_FULL', 'PROCESS_INSTANCE_WRITE'),

    ('ACCESS_ECOM_CATALOG', 'PROCESS_DEF_READ'),
    ('ACCESS_ECOM_CATALOG', 'PROCESS_INSTANCE_READ'),
    ('ACCESS_ECOM_CATALOG', 'PROCESS_INSTANCE_WRITE'),

    ('ACCESS_ECOM_ORDERS', 'PROCESS_DEF_READ'),
    ('ACCESS_ECOM_ORDERS', 'PROCESS_INSTANCE_READ'),
    ('ACCESS_ECOM_ORDERS', 'PROCESS_INSTANCE_WRITE'),

    ('ACCESS_CRM_FULL', 'PROCESS_DEF_READ'),
    ('ACCESS_CRM_FULL', 'PROCESS_DEF_WRITE'),
    ('ACCESS_CRM_FULL', 'PROCESS_INSTANCE_READ'),
    ('ACCESS_CRM_FULL', 'PROCESS_INSTANCE_WRITE'),
    ('ACCESS_CRM_FULL', 'CRM_PROCESS_DEF_READ'),
    ('ACCESS_CRM_FULL', 'CRM_PROCESS_DEF_WRITE'),

    ('ACCESS_READ_ONLY', 'PROCESS_DEF_READ'),
    ('ACCESS_READ_ONLY', 'PROCESS_INSTANCE_READ')
)
INSERT INTO eip_authz.role_template_permission(role_code, permission_code)
SELECT bundles.role_code, bundles.permission_code
FROM bundles
JOIN eip_authz.role_template role_template ON role_template.code=bundles.role_code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

WITH bundles(role_code, permission_code) AS (
  SELECT role_code, permission_code
  FROM eip_authz.role_template_permission
  WHERE permission_code IN (
    'PROCESS_DEF_READ',
    'PROCESS_DEF_WRITE',
    'PROCESS_INSTANCE_READ',
    'PROCESS_INSTANCE_WRITE',
    'CRM_PROCESS_DEF_READ',
    'CRM_PROCESS_DEF_WRITE'
  )
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT role.id, bundles.permission_code
FROM eip_authz.role
JOIN bundles ON bundles.role_code=role.code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

COMMIT;
