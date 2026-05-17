-- 0072_auth_recovery_request.sql

CREATE TABLE IF NOT EXISTS eip_auth.auth_recovery_request (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,
  identity_id uuid NOT NULL REFERENCES eip_auth.auth_identity(id) ON DELETE CASCADE,
  login text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_ip text,
  requested_user_agent text,
  decided_at timestamptz,
  decided_by uuid,
  decision_reason text
);

CREATE INDEX IF NOT EXISTS idx_auth_recovery_request_status
  ON eip_auth.auth_recovery_request (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_recovery_request_identity
  ON eip_auth.auth_recovery_request (tenant_id, identity_id, requested_at DESC);
