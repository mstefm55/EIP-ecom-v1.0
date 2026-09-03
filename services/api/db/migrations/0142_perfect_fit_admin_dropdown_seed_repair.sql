BEGIN;

-- Perfect Fit admin must be independently assignable from EIP Users & roles.
-- The Users & roles Access Type dropdown is sourced from eip_authz.role_template
-- joined to the tenant-local eip_authz.role table. Seed/repair both explicitly.
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
  '{"application":"perfect_fit","assignable":true}'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  surface_code = EXCLUDED.surface_code,
  role_kind = 'access',
  is_system = false,
  is_active = true,
  sort_order = EXCLUDED.sort_order,
  attrs = COALESCE(eip_authz.role_template.attrs, '{}'::jsonb) || EXCLUDED.attrs,
  updated_at = now();

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
  'PF_ADMIN',
  'Perfect Fit Administrator',
  'ECOM',
  false,
  true
FROM eip_core.tenant t
ON CONFLICT (tenant_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  surface_code = EXCLUDED.surface_code,
  is_system = false,
  is_active = true,
  updated_at = now();

COMMIT;
