-- Keep CRM intake permissions in the governed role templates so tenant roles
-- provisioned after the intake foundation receive the same access baseline.

BEGIN;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','CRM_INTAKE_READ'), ('ADMIN_SUPER','CRM_INTAKE_WRITE'),
    ('ADMIN_SUPER','CRM_INTAKE_APPROVE'), ('ADMIN_SUPER','CRM_INTAKE_CONVERT'),
    ('ACCESS_UNIVERSAL','CRM_INTAKE_READ'), ('ACCESS_UNIVERSAL','CRM_INTAKE_WRITE'),
    ('ACCESS_UNIVERSAL','CRM_INTAKE_APPROVE'), ('ACCESS_UNIVERSAL','CRM_INTAKE_CONVERT'),
    ('CRM_ADMIN','CRM_INTAKE_READ'), ('CRM_ADMIN','CRM_INTAKE_WRITE'),
    ('CRM_ADMIN','CRM_INTAKE_APPROVE'), ('CRM_ADMIN','CRM_INTAKE_CONVERT'),
    ('CRM_USER','CRM_INTAKE_READ'), ('CRM_USER','CRM_INTAKE_WRITE'),
    ('ACCESS_CRM_FULL','CRM_INTAKE_READ'), ('ACCESS_CRM_FULL','CRM_INTAKE_WRITE'),
    ('ACCESS_CRM_FULL','CRM_INTAKE_APPROVE'), ('ACCESS_CRM_FULL','CRM_INTAKE_CONVERT'),
    ('ACCESS_READ_ONLY','CRM_INTAKE_READ')
)
INSERT INTO eip_authz.role_template_permission(role_code, permission_code)
SELECT template.code, bundles.permission_code
FROM eip_authz.role_template template
JOIN bundles ON bundles.role_code=template.code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','CRM_INTAKE_READ'), ('ADMIN_SUPER','CRM_INTAKE_WRITE'),
    ('ADMIN_SUPER','CRM_INTAKE_APPROVE'), ('ADMIN_SUPER','CRM_INTAKE_CONVERT'),
    ('ACCESS_UNIVERSAL','CRM_INTAKE_READ'), ('ACCESS_UNIVERSAL','CRM_INTAKE_WRITE'),
    ('ACCESS_UNIVERSAL','CRM_INTAKE_APPROVE'), ('ACCESS_UNIVERSAL','CRM_INTAKE_CONVERT'),
    ('CRM_ADMIN','CRM_INTAKE_READ'), ('CRM_ADMIN','CRM_INTAKE_WRITE'),
    ('CRM_ADMIN','CRM_INTAKE_APPROVE'), ('CRM_ADMIN','CRM_INTAKE_CONVERT'),
    ('CRM_USER','CRM_INTAKE_READ'), ('CRM_USER','CRM_INTAKE_WRITE'),
    ('ACCESS_CRM_FULL','CRM_INTAKE_READ'), ('ACCESS_CRM_FULL','CRM_INTAKE_WRITE'),
    ('ACCESS_CRM_FULL','CRM_INTAKE_APPROVE'), ('ACCESS_CRM_FULL','CRM_INTAKE_CONVERT'),
    ('ACCESS_READ_ONLY','CRM_INTAKE_READ')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT role.id, bundles.permission_code
FROM eip_authz.role role
JOIN bundles ON bundles.role_code=role.code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

COMMIT;
