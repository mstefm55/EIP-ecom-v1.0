-- 0095_authz_role_templates.sql
-- Purpose: move tenant user role taxonomy/provisioning into DB-owned templates.

BEGIN;

INSERT INTO eip_authz.surface(code, label, sort_order) VALUES
  ('ADMIN','Admin',10),
  ('ERP','ERP',20),
  ('PARTNER','Partner Portal',30),
  ('ECOM','E-Commerce',40)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS eip_authz.role_template (
  code text PRIMARY KEY,
  label text NOT NULL,
  surface_code text NOT NULL REFERENCES eip_authz.surface(code),
  role_kind text NOT NULL DEFAULT 'profile',
  is_system boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT role_template_kind_chk CHECK (role_kind IN ('profile', 'access'))
);

DROP TRIGGER IF EXISTS trg_role_template_set_updated_at ON eip_authz.role_template;
CREATE TRIGGER trg_role_template_set_updated_at
BEFORE UPDATE ON eip_authz.role_template
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS eip_authz.role_template_permission (
  role_code text NOT NULL REFERENCES eip_authz.role_template(code) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES eip_authz.permission(code) ON DELETE CASCADE,
  PRIMARY KEY (role_code, permission_code)
);

WITH templates(code, label, surface_code, role_kind, is_system, sort_order) AS (
  VALUES
    ('ADMIN_SUPER', 'Super Admin', 'ADMIN', 'profile', true, 10),
    ('ADMIN_EXEC', 'Executive Admin', 'ADMIN', 'profile', true, 20),
    ('ADMIN_ASSOC', 'Associate Admin', 'ADMIN', 'profile', true, 30),
    ('ECOM_ADMIN', 'ECOM Admin', 'ERP', 'profile', true, 100),
    ('ECOM_USER', 'ECOM User', 'ECOM', 'profile', true, 110),
    ('ERP_USER', 'ERP User', 'ERP', 'profile', true, 120),
    ('PARTNER_USER', 'Partner User', 'PARTNER', 'profile', true, 130),
    ('CRM_ADMIN', 'CRM Admin', 'ERP', 'profile', true, 140),
    ('CRM_USER', 'CRM User', 'ERP', 'profile', true, 150),
    ('ACCESS_UNIVERSAL', 'Universal Access', 'ERP', 'access', false, 10),
    ('ACCESS_ECOM_FULL', 'Ecommerce Full Access', 'ERP', 'access', false, 20),
    ('ACCESS_ECOM_CATALOG', 'Product & Content Studio', 'ERP', 'access', false, 30),
    ('ACCESS_ECOM_ORDERS', 'Orders & Payments', 'ERP', 'access', false, 40),
    ('ACCESS_CRM_FULL', 'CRM Full Access', 'ERP', 'access', false, 50),
    ('ACCESS_READ_ONLY', 'Read Only', 'ERP', 'access', false, 90)
)
INSERT INTO eip_authz.role_template(code, label, surface_code, role_kind, is_system, is_active, sort_order)
SELECT code, label, surface_code, role_kind, is_system, true, sort_order
FROM templates
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  surface_code = EXCLUDED.surface_code,
  role_kind = EXCLUDED.role_kind,
  is_system = EXCLUDED.is_system,
  is_active = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO eip_authz.role_template_permission(role_code, permission_code)
SELECT DISTINCT rt.code, rp.permission_code
FROM eip_authz.role_template rt
JOIN eip_authz.role r ON r.code = rt.code
JOIN eip_authz.role_permission rp ON rp.role_id = r.id
JOIN eip_authz.permission p ON p.code = rp.permission_code
WHERE rt.is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO eip_authz.role(tenant_id, code, label, surface_code, is_system, is_active)
SELECT t.id, rt.code, rt.label, rt.surface_code, rt.is_system, true
FROM eip_core.tenant t
CROSS JOIN eip_authz.role_template rt
WHERE rt.is_active = true
ON CONFLICT (tenant_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  surface_code = EXCLUDED.surface_code,
  is_system = EXCLUDED.is_system,
  is_active = true;

INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, rtp.permission_code
FROM eip_authz.role r
JOIN eip_authz.role_template_permission rtp ON rtp.role_code = r.code
JOIN eip_authz.permission p ON p.code = rtp.permission_code
ON CONFLICT DO NOTHING;

COMMIT;
