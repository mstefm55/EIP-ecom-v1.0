-- 0096_security_event_ops.sql
-- Purpose: structured, tenant-aware security operations event stream.

BEGIN;

CREATE TABLE IF NOT EXISTS eip_core.security_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  category text NOT NULL DEFAULT 'security',
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  outcome text NOT NULL DEFAULT 'observed'
    CHECK (outcome IN ('success', 'failure', 'denied', 'rejected', 'blocked', 'error', 'observed')),
  tenant_id uuid NULL,
  actor_tenant_id uuid NULL,
  actor_identity_id uuid NULL,
  target_tenant_id uuid NULL,
  target_identity_id uuid NULL,
  connection_code text NULL,
  suffix text NULL,
  event_id text NULL,
  request_id text NULL,
  ip text NULL,
  user_agent text NULL,
  reason text NULL,
  source text NOT NULL DEFAULT 'api',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_event_tenant_time_idx
  ON eip_core.security_event (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS security_event_category_time_idx
  ON eip_core.security_event (category, occurred_at DESC);

CREATE INDEX IF NOT EXISTS security_event_type_time_idx
  ON eip_core.security_event (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS security_event_connection_time_idx
  ON eip_core.security_event (tenant_id, connection_code, suffix, occurred_at DESC);

CREATE INDEX IF NOT EXISTS security_event_outcome_time_idx
  ON eip_core.security_event (outcome, occurred_at DESC);

CREATE INDEX IF NOT EXISTS security_event_metadata_gin
  ON eip_core.security_event USING gin (metadata);

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('security.ops.read', 'View security operations', 'View security events, connection health, and anomaly summaries')
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description;

INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, 'security.ops.read'
FROM eip_authz.role r
WHERE r.code IN ('ADMIN_SUPER', 'ACCESS_UNIVERSAL')
ON CONFLICT DO NOTHING;

INSERT INTO eip_authz.role_template_permission(role_code, permission_code)
SELECT rt.code, 'security.ops.read'
FROM eip_authz.role_template rt
WHERE rt.code IN ('ADMIN_SUPER', 'ACCESS_UNIVERSAL')
ON CONFLICT DO NOTHING;

COMMIT;
