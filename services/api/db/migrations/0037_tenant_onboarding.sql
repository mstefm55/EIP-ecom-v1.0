BEGIN;

-- ============================================================
-- Tenant onboarding request (public -> internal review -> bootstrap)
-- ============================================================
CREATE TABLE IF NOT EXISTS eip_core.tenant_request (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_code            text NOT NULL UNIQUE,

  status_code         text NOT NULL, -- SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED | BOOTSTRAP_PENDING | ACTIVE | EXPIRED
  applicant_type      text NOT NULL, -- business | sole_trader
  legal_name          text NOT NULL,
  business_reg_no     text,
  personal_id_no      text,
  email               text NOT NULL,
  phone               text,
  country             text NOT NULL,
  timezone            text NOT NULL,

  tenant_id           uuid,          -- set on approval
  admin_identity_id   uuid,          -- set on approval

  bootstrap_token_hash text,
  bootstrap_expires_at timestamptz,
  bootstrap_used_at    timestamptz,

  attrs               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_request_status_idx
  ON eip_core.tenant_request (status_code, created_at DESC);

CREATE INDEX IF NOT EXISTS tenant_request_email_idx
  ON eip_core.tenant_request (email);

CREATE INDEX IF NOT EXISTS tenant_request_attrs_gin
  ON eip_core.tenant_request USING gin (attrs);

DROP TRIGGER IF EXISTS trg_tenant_request_set_updated_at ON eip_core.tenant_request;
CREATE TRIGGER trg_tenant_request_set_updated_at
BEFORE UPDATE ON eip_core.tenant_request
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

-- ============================================================
-- Tenant status (align with onboarding lifecycle)
-- ============================================================
ALTER TABLE eip_core.tenant
  ADD COLUMN IF NOT EXISTS status_code text NOT NULL DEFAULT 'ACTIVE';

-- ============================================================
-- Permissions for onboarding review workflow
-- ============================================================
INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('tenant.onboarding.read', 'Read tenant requests', 'View tenant onboarding requests'),
  ('tenant.onboarding.approve', 'Approve tenant requests', 'Approve tenant onboarding requests'),
  ('tenant.onboarding.reject', 'Reject tenant requests', 'Reject tenant onboarding requests')
ON CONFLICT (code) DO NOTHING;

INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, p.code
FROM eip_authz.role r
JOIN eip_authz.permission p ON p.code IN (
  'tenant.onboarding.read',
  'tenant.onboarding.approve',
  'tenant.onboarding.reject'
)
WHERE r.code = 'ADMIN_SUPER'
ON CONFLICT DO NOTHING;

COMMIT;
