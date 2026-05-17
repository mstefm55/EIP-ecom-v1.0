-- 0059_admin_portfolio.sql
-- Purpose: admin portfolios for tenant scoping + associate sensitive access permissions

BEGIN;

CREATE TABLE IF NOT EXISTS eip_authz.admin_portfolio (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_identity_id  uuid NOT NULL REFERENCES eip_auth.auth_identity(id) ON DELETE CASCADE,
  code               text,
  name               text,
  is_active          boolean NOT NULL DEFAULT true,
  attrs              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT admin_portfolio_identity_unique UNIQUE (admin_identity_id),
  CONSTRAINT chk_admin_portfolio_code_trim CHECK (code IS NULL OR code = btrim(code)),
  CONSTRAINT chk_admin_portfolio_name_trim CHECK (name IS NULL OR name = btrim(name))
);

DROP TRIGGER IF EXISTS trg_admin_portfolio_set_updated_at ON eip_authz.admin_portfolio;
CREATE TRIGGER trg_admin_portfolio_set_updated_at
BEFORE UPDATE ON eip_authz.admin_portfolio
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

ALTER TABLE eip_core.tenant
  ADD COLUMN IF NOT EXISTS admin_portfolio_id uuid REFERENCES eip_authz.admin_portfolio(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tenant_admin_portfolio_idx
  ON eip_core.tenant (admin_portfolio_id);

-- Allow associates to use tenant-approved sensitive tokens (still gated by token checks)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, p.code
FROM eip_authz.role r
JOIN eip_authz.permission p ON p.code IN ('admin.db.read_sensitive')
WHERE r.code IN ('ADMIN_ASSOC')
ON CONFLICT DO NOTHING;

COMMIT;
