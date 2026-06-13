-- Phase 3 effective-policy read helper permission.
-- No new tables; commercial_condition remains the physical V1 authority.

BEGIN;

INSERT INTO eip_authz.permission(code, label, description) VALUES
  (
    'policies_conditions.read_effective',
    'Read Effective Policies & Conditions',
    'Resolve and explain tenant-scoped effective policy and condition rows without mutation'
  )
ON CONFLICT (code) DO UPDATE SET
  label=EXCLUDED.label,
  description=EXCLUDED.description;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER', 'policies_conditions.read_effective'),
    ('ADMIN_EXEC', 'policies_conditions.read_effective'),
    ('ACCESS_UNIVERSAL', 'policies_conditions.read_effective'),
    ('ACCESS_READ_ONLY', 'policies_conditions.read_effective'),
    ('ECOM_ADMIN', 'policies_conditions.read_effective'),
    ('ERP_USER', 'policies_conditions.read_effective')
)
INSERT INTO eip_authz.role_template_permission(role_code, permission_code)
SELECT role_template.code, bundles.permission_code
FROM bundles
JOIN eip_authz.role_template role_template ON role_template.code=bundles.role_code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT (role_code, permission_code) DO NOTHING;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER', 'policies_conditions.read_effective'),
    ('ADMIN_EXEC', 'policies_conditions.read_effective'),
    ('ACCESS_UNIVERSAL', 'policies_conditions.read_effective'),
    ('ACCESS_READ_ONLY', 'policies_conditions.read_effective'),
    ('ECOM_ADMIN', 'policies_conditions.read_effective'),
    ('ERP_USER', 'policies_conditions.read_effective')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT role_record.id, bundles.permission_code
FROM bundles
JOIN eip_authz.role role_record ON role_record.code=bundles.role_code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT (role_id, permission_code) DO NOTHING;

COMMIT;

