BEGIN;

-- Bootstrap Perfect Fit administration from the existing tenant ADMIN_SUPER only
-- when that tenant has an enabled Perfect Fit storefront connection.
-- This grants the separate PF_ADMIN role; it does not expose EIP admin routes to
-- Perfect Fit MEMBER-realm sessions.
WITH pf_tenants AS (
  SELECT DISTINCT t.id AS tenant_id
  FROM eip_core.tenant t
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(t.attrs->'connection_profiles') = 'array'
      THEN t.attrs->'connection_profiles'
      ELSE '[]'::jsonb
    END
  ) profile
  WHERE COALESCE((profile->'identity'->>'is_enabled')::boolean, false) = true
    AND COALESCE((profile->'public_storefront'->>'perfect_fit_enabled')::boolean, false) = true
), admin_identities AS (
  SELECT DISTINCT ir.tenant_id, ir.identity_id
  FROM eip_authz.identity_role ir
  JOIN eip_authz.role ar
    ON ar.id = ir.role_id
   AND ar.tenant_id = ir.tenant_id
  JOIN pf_tenants pt
    ON pt.tenant_id = ir.tenant_id
  WHERE ar.code = 'ADMIN_SUPER'
    AND ar.is_active = true
), pf_roles AS (
  SELECT id, tenant_id
  FROM eip_authz.role
  WHERE code = 'PF_ADMIN'
    AND is_active = true
)
INSERT INTO eip_authz.identity_role (
  tenant_id,
  identity_id,
  role_id,
  granted_by_identity_id
)
SELECT ai.tenant_id, ai.identity_id, pr.id, NULL
FROM admin_identities ai
JOIN pf_roles pr
  ON pr.tenant_id = ai.tenant_id
ON CONFLICT (tenant_id, identity_id, role_id) DO NOTHING;

COMMIT;
