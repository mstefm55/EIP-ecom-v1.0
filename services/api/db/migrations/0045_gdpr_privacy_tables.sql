-- 0045_gdpr_privacy_tables.sql
-- GDPR compliance tables for data subject rights

BEGIN;

-- Data request tracking (access/erasure requests)
CREATE TABLE eip_core.gdpr_data_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id),
  identity_id uuid NOT NULL REFERENCES eip_auth.auth_identity(id),
  request_type text NOT NULL CHECK (request_type IN ('access', 'erasure')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_by uuid REFERENCES eip_auth.auth_identity(id),
  completed_at timestamptz,
  completed_by uuid REFERENCES eip_auth.auth_identity(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(tenant_id, identity_id, request_type, status) DEFERRABLE INITIALLY DEFERRED
);

-- Data export storage (temporary, auto-deleted after download)
CREATE TABLE eip_core.gdpr_data_export (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id),
  request_id uuid NOT NULL REFERENCES eip_core.gdpr_data_request(id) ON DELETE CASCADE,
  personal_data jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now(),

  UNIQUE(tenant_id, request_id)
);

-- Consent tracking
CREATE TABLE eip_core.gdpr_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id),
  identity_id uuid NOT NULL REFERENCES eip_auth.auth_identity(id),
  consent_type text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now(),

  UNIQUE(tenant_id, identity_id, consent_type)
);

-- Processing records (Article 30 compliance)
CREATE TABLE eip_core.gdpr_processing_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id),
  purpose text NOT NULL,
  legal_basis text NOT NULL,
  data_categories text[] NOT NULL DEFAULT '{}',
  recipients text[] NOT NULL DEFAULT '{}',
  retention_period interval NOT NULL,
  dpo_contact text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Failed login attempts tracking
CREATE TABLE eip_auth.auth_failed_attempt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id),
  identity_id uuid REFERENCES eip_auth.auth_identity(id),
  ip_address inet,
  user_agent text,
  attempted_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_gdpr_data_request_tenant_identity ON eip_core.gdpr_data_request(tenant_id, identity_id);
CREATE INDEX idx_gdpr_data_request_status ON eip_core.gdpr_data_request(status);
CREATE INDEX idx_gdpr_data_export_expires ON eip_core.gdpr_data_export(expires_at);
CREATE INDEX idx_gdpr_consent_tenant_identity ON eip_core.gdpr_consent(tenant_id, identity_id);
CREATE INDEX idx_auth_failed_attempt_tenant_identity ON eip_auth.auth_failed_attempt(tenant_id, identity_id);
CREATE INDEX idx_auth_failed_attempt_attempted ON eip_auth.auth_failed_attempt(attempted_at);

-- Permissions for privacy officers
INSERT INTO eip_authz.permission (code, label, description) VALUES
('privacy.data.export', 'Export user data', 'Export user data for GDPR'),
('privacy.erasure.execute', 'Execute erasure request', 'Process GDPR erasure requests'),
('privacy.consent.manage', 'Manage consents', 'Create/update/delete GDPR consents'),
('privacy.audit.view', 'View privacy audit logs', 'View GDPR audit events');

-- Auto-cleanup of expired exports
CREATE OR REPLACE FUNCTION cleanup_expired_gdpr_exports()
RETURNS void AS $$
BEGIN
  DELETE FROM eip_core.gdpr_data_export
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (would be called by cron or similar)
-- SELECT cleanup_expired_gdpr_exports();

COMMIT;
