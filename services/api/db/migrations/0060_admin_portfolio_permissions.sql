-- 0060_admin_portfolio_permissions.sql
-- Purpose: permissions for admin portfolio management

BEGIN;

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('admin.portfolio.read', 'Read admin portfolios', 'View admin portfolio assignments'),
  ('admin.portfolio.write', 'Write admin portfolios', 'Create or update admin portfolios'),
  ('admin.portfolio.assign', 'Assign admin portfolios', 'Assign tenants to admin portfolios')
ON CONFLICT (code) DO NOTHING;

INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, p.code
FROM eip_authz.role r
JOIN eip_authz.permission p ON p.code IN ('admin.portfolio.read', 'admin.portfolio.write', 'admin.portfolio.assign')
WHERE r.code IN ('ADMIN_SUPER', 'ADMIN_EXEC')
ON CONFLICT DO NOTHING;

COMMIT;
