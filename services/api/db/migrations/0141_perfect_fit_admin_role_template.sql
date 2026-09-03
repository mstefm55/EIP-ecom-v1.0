BEGIN;

-- Register PF_ADMIN in the DB-owned role taxonomy so EIP Users & roles exposes
-- it consistently as an Access Type. This does not grant the role to anyone.
INSERT INTO eip_authz.role_template (
  code,
  label,
  surface_code,
  role_kind,
  is_system,
  is_active,
  sort_order,
  attrs
)
VALUES (
  'PF_ADMIN',
  'Perfect Fit Administrator',
  'ECOM',
  'access',
  false,
  true,
  25,
  '{"application":"perfect_fit"}'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  surface_code = EXCLUDED.surface_code,
  role_kind = EXCLUDED.role_kind,
  is_system = EXCLUDED.is_system,
  is_active = true,
  sort_order = EXCLUDED.sort_order,
  attrs = eip_authz.role_template.attrs || EXCLUDED.attrs,
  updated_at = now();

-- Ensure every tenant has the governed PF_ADMIN role available for explicit
-- assignment. No identity_role row is created here.
INSERT INTO eip_authz.role (
  tenant_id,
  code,
  label,
  surface_code,
  is_system,
  is_active
)
SELECT
  t.id,
  rt.code,
  rt.label,
  rt.surface_code,
  rt.is_system,
  true
FROM eip_core.tenant t
JOIN eip_authz.role_template rt ON rt.code = 'PF_ADMIN'
ON CONFLICT (tenant_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  surface_code = EXCLUDED.surface_code,
  is_system = EXCLUDED.is_system,
  is_active = true,
  updated_at = now();

COMMIT;
