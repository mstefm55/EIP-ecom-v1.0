BEGIN;

-- ============================================================
-- Tenant agreements (bootstrap acceptance evidence)
-- ============================================================
CREATE TABLE IF NOT EXISTS eip_core.tenant_agreement (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,
  agreement_code           text NOT NULL,
  agreement_version        text NOT NULL,
  status_code              text NOT NULL DEFAULT 'ACCEPTED', -- ACCEPTED | SUPERSEDED | REVOKED
  accepted_at              timestamptz NOT NULL DEFAULT now(),
  accepted_by_identity_id  uuid NOT NULL,
  ip_address               text,
  user_agent_hash          text,
  attrs                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_agreement_tenant_code_idx
  ON eip_core.tenant_agreement (tenant_id, agreement_code, accepted_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_agreement_unique_version_idx
  ON eip_core.tenant_agreement (tenant_id, agreement_code, agreement_version);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_agreement_one_accepted_idx
  ON eip_core.tenant_agreement (tenant_id, agreement_code)
  WHERE status_code = 'ACCEPTED';

DROP TRIGGER IF EXISTS trg_tenant_agreement_set_updated_at ON eip_core.tenant_agreement;
CREATE TRIGGER trg_tenant_agreement_set_updated_at
BEFORE UPDATE ON eip_core.tenant_agreement
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

COMMIT;
