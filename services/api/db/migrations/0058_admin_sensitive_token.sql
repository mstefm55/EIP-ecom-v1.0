-- 0058_admin_sensitive_token.sql
-- Purpose: tenant-approved sensitive access tokens for admin portfolio access

BEGIN;

-- =========================================================
-- Tenant admin permissions (for managing admin_tenant_access)
-- =========================================================
INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('tenant.admin_access.read', 'Read admin access', 'View EIP admin access grants for this tenant'),
  ('tenant.admin_access.write', 'Write admin access', 'Grant/revoke EIP admin access for this tenant')
ON CONFLICT (code) DO NOTHING;

INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, p.code
FROM eip_authz.role r
JOIN eip_authz.permission p ON p.code IN (
  'tenant.admin_access.read',
  'tenant.admin_access.write'
)
WHERE r.code IN ('CRM_ADMIN', 'ADMIN_SUPER')
ON CONFLICT DO NOTHING;

-- =========================================================
-- Sensitive access tokens on admin_tenant_access
-- =========================================================
ALTER TABLE eip_authz.admin_tenant_access
  ADD COLUMN IF NOT EXISTS sensitive_token_hash text,
  ADD COLUMN IF NOT EXISTS sensitive_token_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS sensitive_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS sensitive_token_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS sensitive_token_issued_by uuid REFERENCES eip_auth.auth_identity(id),
  ADD COLUMN IF NOT EXISTS sensitive_token_last_used_at timestamptz;

CREATE INDEX IF NOT EXISTS admin_tenant_access_token_hash_idx
  ON eip_authz.admin_tenant_access (sensitive_token_hash)
  WHERE sensitive_token_hash IS NOT NULL;

COMMIT;
