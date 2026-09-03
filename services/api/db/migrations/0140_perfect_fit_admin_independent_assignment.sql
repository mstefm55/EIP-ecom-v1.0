BEGIN;

-- Perfect Fit administration is independent from EIP administration.
-- Revoke only the bootstrap grants created by migrations 0138/0139, which used
-- NULL granted_by_identity_id, for identities that were selected because they
-- were system/EIP administrators. PF_ADMIN must be assigned explicitly through
-- EIP Users & roles to the account that should administer Perfect Fit.
WITH auto_bootstrapped AS (
  SELECT DISTINCT i.tenant_id, i.id AS identity_id
  FROM eip_auth.auth_identity i
  LEFT JOIN eip_authz.identity_role admin_ir
    ON admin_ir.tenant_id = i.tenant_id
   AND admin_ir.identity_id = i.id
  LEFT JOIN eip_authz.role admin_role
    ON admin_role.id = admin_ir.role_id
   AND admin_role.tenant_id = admin_ir.tenant_id
  WHERE lower(COALESCE(i.attrs->>'system_admin', 'false')) = 'true'
     OR admin_role.code = 'ADMIN_SUPER'
), pf_roles AS (
  SELECT id, tenant_id
  FROM eip_authz.role
  WHERE code = 'PF_ADMIN'
)
DELETE FROM eip_authz.identity_role ir
USING auto_bootstrapped ab, pf_roles pr
WHERE ir.tenant_id = ab.tenant_id
  AND ir.identity_id = ab.identity_id
  AND ir.role_id = pr.id
  AND pr.tenant_id = ir.tenant_id
  AND ir.granted_by_identity_id IS NULL;

-- Keep PF_ADMIN as a governed ECOM access role. It remains visible in the
-- existing EIP Users & roles screen and is granted/revoked explicitly.
UPDATE eip_authz.role
SET label = 'Perfect Fit Administrator',
    surface_code = 'ECOM',
    is_system = false,
    is_active = true,
    updated_at = now()
WHERE code = 'PF_ADMIN';

COMMIT;
