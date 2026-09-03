BEGIN;

-- Perfect Fit administration is an ECOM/Perfect Fit role, not an EIP ADMIN role.
-- Bootstrap current system administrators into PF_ADMIN so the platform owner can
-- administer Perfect Fit without granting PF sessions access to /api/eip/*.
INSERT INTO eip_authz.role (tenant_id, code, label, surface_code, is_system, is_active)
SELECT t.id, 'PF_ADMIN', 'Perfect Fit Administrator', 'ECOM', true, true
FROM eip_core.tenant t
ON CONFLICT (tenant_id, code)
DO UPDATE SET
  label = EXCLUDED.label,
  surface_code = EXCLUDED.surface_code,
  is_system = true,
  is_active = true,
  updated_at = now();

INSERT INTO eip_authz.identity_role (tenant_id, identity_id, role_id, granted_by_identity_id)
SELECT i.tenant_id, i.id, r.id, NULL
FROM eip_auth.auth_identity i
JOIN eip_authz.role r
  ON r.tenant_id = i.tenant_id
 AND r.code = 'PF_ADMIN'
WHERE lower(COALESCE(i.attrs->>'system_admin', 'false')) = 'true'
ON CONFLICT (tenant_id, identity_id, role_id) DO NOTHING;

COMMIT;
