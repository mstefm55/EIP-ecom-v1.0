-- 0057_miscellaneous.sql
-- Purpose: ad-hoc admin SQL snippets (kept for manual execution)
-- NOTE: Keep this file as a controlled scratchpad. Add sections with clear headers.

BEGIN;

-- =========================================================
-- SECTION: TEMPLATE
-- Description:
--   <Explain the goal of the SQL below>
-- =========================================================
-- <SQL HERE>

-- =========================================================
-- SECTION: BOOTSTRAP FIRST EXEC ADMIN
-- Description:
--   Grant ADMIN_EXEC role to a login under tenant code 'eip'.
--   Replace 'you@example.com' with the real admin login.
-- =========================================================
-- INSERT INTO eip_authz.identity_role (tenant_id, identity_id, role_id)
-- SELECT t.id, i.id, r.id
-- FROM eip_core.tenant t
-- JOIN eip_auth.auth_identity i ON i.tenant_id = t.id
-- JOIN eip_authz.role r ON r.tenant_id = t.id AND r.code = 'ADMIN_EXEC'
-- WHERE t.code = 'eip' AND i.login = 'you@example.com'
-- ON CONFLICT DO NOTHING;

-- =========================================================
-- SECTION: ASSOC ADMIN PORTFOLIO ACCESS
-- Description:
--   Allow an associate admin to read a tenant's data.
--   Replace :admin_identity_id and :tenant_id with real values.
-- =========================================================
-- INSERT INTO eip_authz.admin_tenant_access
--   (admin_identity_id, tenant_id, access_level, sensitive_allowed)
-- VALUES
--   (':admin_identity_id', ':tenant_id', 'ASSOC', false)
-- ON CONFLICT (admin_identity_id, tenant_id)
-- DO UPDATE SET
--   access_level = EXCLUDED.access_level,
--   sensitive_allowed = EXCLUDED.sensitive_allowed,
--   is_active = true,
--   updated_at = now();

COMMIT;
