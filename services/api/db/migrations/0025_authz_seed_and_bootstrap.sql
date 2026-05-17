BEGIN;

-- =========================================================
-- 1) Seed base roles for demo tenant (idempotent)
-- =========================================================

-- You already seeded surfaces in 0024; keep safe anyway
INSERT INTO eip_authz.surface(code, label, sort_order) VALUES
  ('ADMIN','Admin',10),
  ('ERP','ERP',20),
  ('PARTNER','Partner Portal',30),
  ('ECOM','E-Commerce',40)
ON CONFLICT (code) DO NOTHING;

-- Roles (tenant-scoped)
INSERT INTO eip_authz.role(tenant_id, code, label, surface_code, is_system)
VALUES
  ('18e6209d-155a-4932-9b7b-e11ad09aaf49','ADMIN_SUPER','Super Admin','ADMIN', true),
  ('18e6209d-155a-4932-9b7b-e11ad09aaf49','ERP_USER','ERP User','ERP', true),
  ('18e6209d-155a-4932-9b7b-e11ad09aaf49','PARTNER_USER','Partner User','PARTNER', true),
  ('18e6209d-155a-4932-9b7b-e11ad09aaf49','ECOM_USER','Customer','ECOM', true)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- =========================================================
-- 2) Seed minimal menu skeleton (idempotent)
-- =========================================================

INSERT INTO eip_authz.menu_item(surface_code, code, label, route, icon, sort_order)
VALUES
  ('ADMIN','ADMIN_HOME','Admin Home','/admin','Shield',10),
  ('ERP','ERP_HOME','ERP Home','/erp','LayoutDashboard',10),
  ('PARTNER','PARTNER_HOME','Partner Home','/partner','Handshake',10),
  ('ECOM','ECOM_HOME','Shop','/shop','Store',10)
ON CONFLICT (surface_code, code) DO NOTHING;

-- =========================================================
-- 3) Bootstrap function
--    Returns: surfaces + roles + permissions + menu + agent linkage
-- =========================================================

CREATE OR REPLACE FUNCTION eip_authz.bootstrap(
  p_tenant_id uuid,
  p_identity_id uuid
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH
me AS (
  SELECT
    ai.id,
    ai.tenant_id,
    ai.login,
    ai.login_type,
    ai.is_active,
    ai.is_locked,
    ai.attrs,
    ai.created_at,
    ai.updated_at
  FROM eip_auth.auth_identity ai
  WHERE ai.tenant_id = p_tenant_id
    AND ai.id = p_identity_id
),
primary_agent AS (
  SELECT
    ia.agent_id,
    ia.is_primary,
    ia.is_active,
    ia.created_at
  FROM eip_auth.auth_identity_agent ia
  WHERE ia.tenant_id = p_tenant_id
    AND ia.identity_id = p_identity_id
    AND ia.is_primary = true
    AND ia.is_active = true
  LIMIT 1
),
my_roles AS (
  SELECT
    r.id,
    r.code,
    r.label,
    r.surface_code
  FROM eip_authz.identity_role ir
  JOIN eip_authz.role r ON r.id = ir.role_id
  WHERE ir.tenant_id = p_tenant_id
    AND ir.identity_id = p_identity_id
    AND r.is_active = true
),
my_permissions AS (
  SELECT DISTINCT
    rp.permission_code AS code
  FROM eip_authz.identity_role ir
  JOIN eip_authz.role_permission rp ON rp.role_id = ir.role_id
  WHERE ir.tenant_id = p_tenant_id
    AND ir.identity_id = p_identity_id
),
my_menu AS (
  SELECT DISTINCT
    mi.id,
    mi.surface_code,
    mi.code,
    mi.label,
    mi.route,
    mi.icon,
    mi.parent_id,
    mi.sort_order
  FROM my_roles mr
  JOIN eip_authz.role r ON r.id = mr.id
  JOIN eip_authz.role_menu rm ON rm.role_id = r.id
  JOIN eip_authz.menu_item mi ON mi.id = rm.menu_item_id
  WHERE mi.is_active = true
)
SELECT jsonb_build_object(
  'tenantId', p_tenant_id,
  'identity', (SELECT to_jsonb(me) FROM me),
  'primaryAgent', (SELECT to_jsonb(primary_agent) FROM primary_agent),
  'surfaces', (
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order), '[]'::jsonb)
    FROM eip_authz.surface s
    WHERE s.is_active = true
  ),
  'roles', (
    SELECT coalesce(jsonb_agg(to_jsonb(my_roles) ORDER BY surface_code, code), '[]'::jsonb)
    FROM my_roles
  ),
  'permissions', (
    SELECT coalesce(jsonb_agg(code ORDER BY code), '[]'::jsonb)
    FROM my_permissions
  ),
  'menu', (
    SELECT coalesce(jsonb_agg(to_jsonb(my_menu) ORDER BY surface_code, sort_order, code), '[]'::jsonb)
    FROM my_menu
  )
);
$$;

COMMIT;
