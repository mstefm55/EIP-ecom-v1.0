-- 0018_info_record.sql
-- Core backbone: generic information package / document / record
-- Semantics: info_record = structured metadata + optional JSON payload + external file pointer
-- Used for: POD, invoices, receipts, photos, lab results, notes, etc.
-- NOTE: This stores references/tokens, not sensitive card data.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS eip_core.info_record (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,

  record_type         text NOT NULL,                 -- e.g. 'POD', 'RECEIPT', 'INVOICE', 'PHOTO', 'NOTE'
  title               text,
  description         text,

  -- External storage reference (optional): S3 key, Drive file id, local path, etc.
  file_ref            text,
  mime_type           text,
  file_size           bigint,
  file_hash           text,                           -- sha256 or similar (optional)

  -- Structured content (optional)
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  attrs               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_by_agent_id uuid,
  is_active           boolean NOT NULL DEFAULT true,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eip_core.info_record
  ADD CONSTRAINT info_record_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES eip_core.tenant(id)
  ON DELETE RESTRICT;

ALTER TABLE eip_core.info_record
  ADD CONSTRAINT info_record_created_by_fk
  FOREIGN KEY (created_by_agent_id) REFERENCES eip_core.agent(id)
  ON DELETE SET NULL;

-- Common lookups
CREATE INDEX IF NOT EXISTS info_record_tenant_type_time_idx
  ON eip_core.info_record (tenant_id, record_type, created_at DESC);

CREATE INDEX IF NOT EXISTS info_record_file_hash_idx
  ON eip_core.info_record (tenant_id, file_hash);

CREATE INDEX IF NOT EXISTS info_record_payload_gin
  ON eip_core.info_record USING gin (payload);

CREATE INDEX IF NOT EXISTS info_record_attrs_gin
  ON eip_core.info_record USING gin (attrs);

COMMIT;
