-- 0056_admin_db_explorer.sql
-- Purpose: admin DB explorer permissions + access mapping for tenant-scoped admin portfolios

BEGIN;

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('admin.db.read', 'Read DB explorer', 'View database schema and table data'),
  ('admin.db.export', 'Export DB data', 'Export database tables to CSV/JSON'),
  ('admin.db.read_sensitive', 'Read sensitive DB', 'View sensitive/auth tables in DB explorer')
ON CONFLICT (code) DO NOTHING;

-- Ensure executive/associate admin roles exist for the EIP tenant
WITH eip_tenant AS (
  SELECT id FROM eip_core.tenant WHERE code = 'eip' LIMIT 1
)
INSERT INTO eip_authz.role(tenant_id, code, label, surface_code, is_system)
SELECT t.id, 'ADMIN_EXEC', 'Executive Admin', 'ADMIN', true
FROM eip_tenant t
WHERE NOT EXISTS (
  SELECT 1 FROM eip_authz.role r WHERE r.tenant_id = t.id AND r.code = 'ADMIN_EXEC'
);

WITH eip_tenant AS (
  SELECT id FROM eip_core.tenant WHERE code = 'eip' LIMIT 1
)
INSERT INTO eip_authz.role(tenant_id, code, label, surface_code, is_system)
SELECT t.id, 'ADMIN_ASSOC', 'Associate Admin', 'ADMIN', true
FROM eip_tenant t
WHERE NOT EXISTS (
  SELECT 1 FROM eip_authz.role r WHERE r.tenant_id = t.id AND r.code = 'ADMIN_ASSOC'
);

-- Map permissions to roles
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, p.code
FROM eip_authz.role r
JOIN eip_authz.permission p ON p.code IN ('admin.db.read', 'admin.db.export', 'admin.db.read_sensitive')
WHERE r.code IN ('ADMIN_SUPER', 'ADMIN_EXEC')
ON CONFLICT DO NOTHING;

INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, p.code
FROM eip_authz.role r
JOIN eip_authz.permission p ON p.code IN ('admin.db.read', 'admin.db.export')
WHERE r.code IN ('ADMIN_ASSOC')
ON CONFLICT DO NOTHING;

-- Portfolio mapping: which tenants an admin identity can access
CREATE TABLE IF NOT EXISTS eip_authz.admin_tenant_access (
  admin_identity_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,
  access_level text NOT NULL,
  sensitive_allowed boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT admin_tenant_access_pk PRIMARY KEY (admin_identity_id, tenant_id),
  CONSTRAINT admin_tenant_access_level_chk CHECK (access_level IN ('EXEC','ASSOC'))
);

DROP TRIGGER IF EXISTS trg_admin_tenant_access_set_updated_at ON eip_authz.admin_tenant_access;
CREATE TRIGGER trg_admin_tenant_access_set_updated_at
BEFORE UPDATE ON eip_authz.admin_tenant_access
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

COMMIT;
