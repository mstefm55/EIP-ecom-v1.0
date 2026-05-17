-- 0053_document_registry.sql
-- Purpose: audit/legal document registry (separate from content artifacts)

BEGIN;

CREATE TABLE IF NOT EXISTS eip_core.document_registry (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE RESTRICT,
  code               text,
  doc_type           text NOT NULL,
  doc_no             text,
  title              text,
  status             text NOT NULL DEFAULT 'active',
  issued_at          timestamptz,
  owner_agent_id     uuid REFERENCES eip_core.agent(id),
  content_object_id  uuid,
  content_version_id uuid,
  attrs              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_document_registry_code_trim CHECK (code IS NULL OR code = btrim(code)),
  CONSTRAINT chk_document_registry_doc_no_trim CHECK (doc_no IS NULL OR doc_no = btrim(doc_no)),
  CONSTRAINT chk_document_registry_title_trim CHECK (title IS NULL OR title = btrim(title))
);

-- Optional links to content repository (enforced by tenant)
DO $$
BEGIN
  IF to_regclass('eip_core.content_object') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'document_registry_content_object_fk'
        AND conrelid = 'eip_core.document_registry'::regclass
    ) THEN
      ALTER TABLE eip_core.document_registry
        ADD CONSTRAINT document_registry_content_object_fk
        FOREIGN KEY (tenant_id, content_object_id)
        REFERENCES eip_core.content_object (tenant_id, id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('eip_core.content_version') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'document_registry_content_version_fk'
        AND conrelid = 'eip_core.document_registry'::regclass
    ) THEN
      ALTER TABLE eip_core.document_registry
        ADD CONSTRAINT document_registry_content_version_fk
        FOREIGN KEY (content_version_id)
        REFERENCES eip_core.content_version (id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS document_registry_code_unique_per_tenant
  ON eip_core.document_registry (tenant_id, code)
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_registry_tenant_status_idx
  ON eip_core.document_registry (tenant_id, status, issued_at DESC);

CREATE INDEX IF NOT EXISTS document_registry_attrs_gin
  ON eip_core.document_registry USING gin (attrs);

DROP TRIGGER IF EXISTS trg_document_registry_set_updated_at ON eip_core.document_registry;
CREATE TRIGGER trg_document_registry_set_updated_at
BEFORE UPDATE ON eip_core.document_registry
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

COMMIT;
