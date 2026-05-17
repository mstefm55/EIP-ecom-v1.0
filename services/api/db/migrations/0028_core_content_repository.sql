BEGIN;

-- ============================================================
-- 0028_core_content_repository.sql
-- CORE: tenant-scoped content repository (documents/media/files)
-- ============================================================

-- 1) CORE content object (one row per "document / digital thing")
CREATE TABLE IF NOT EXISTS eip_core.content_object (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  code        text,
  content_kind text NOT NULL,
  label       text NOT NULL,
  attrs       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT content_object_tenant_fk
    FOREIGN KEY (tenant_id)
    REFERENCES eip_core.tenant(id)
    ON DELETE RESTRICT,

  CONSTRAINT chk_content_object_code_trim
    CHECK (code IS NULL OR code = btrim(code)),

  CONSTRAINT chk_content_object_label_trim
    CHECK (label = btrim(label)),

  CONSTRAINT chk_content_kind
    CHECK (content_kind = ANY (ARRAY[
      'document'::text,  -- generic document (pdf, docx, etc.)
      'image'::text,     -- single image
      'video'::text,     -- single video
      'audio'::text,     -- single audio
      'file'::text,      -- generic file
      'package'::text,   -- multi-file pack (zip, pattern pack)
      'folder'::text     -- logical container (optional use)
    ]))
);

-- Composite unique key to enable (tenant_id, id) FKs (same pattern as auth_identity)
CREATE UNIQUE INDEX IF NOT EXISTS content_object_tenant_id_uq
  ON eip_core.content_object (tenant_id, id);

-- Optional human-friendly code: unique per tenant only when provided
CREATE UNIQUE INDEX IF NOT EXISTS content_object_code_unique_per_tenant
  ON eip_core.content_object (tenant_id, code)
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS content_object_tenant_kind_created_idx
  ON eip_core.content_object (tenant_id, content_kind, created_at DESC);

CREATE INDEX IF NOT EXISTS content_object_attrs_gin
  ON eip_core.content_object
  USING gin (attrs);

-- updated_at trigger (you already use this function elsewhere)
DROP TRIGGER IF EXISTS trg_content_object_set_updated_at ON eip_core.content_object;
CREATE TRIGGER trg_content_object_set_updated_at
BEFORE UPDATE ON eip_core.content_object
FOR EACH ROW
EXECUTE FUNCTION eip_core.tg_set_updated_at();


-- 2) Content versions / blobs (one-to-many artifacts per content_object)
--    (original file, revised contract v2, thumbnails, rendered previews, zip packs, etc.)
CREATE TABLE IF NOT EXISTS eip_core.content_version (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  content_object_id  uuid NOT NULL,

  version_no         integer NOT NULL DEFAULT 1,   -- simple monotonically increasing
  is_current         boolean NOT NULL DEFAULT true,

  storage_kind       text NOT NULL,
  storage_ref        text NOT NULL,                -- e.g. file path, s3 key, url, external ref
  file_name          text,
  mime_type          text,
  size_bytes         bigint,
  checksum_sha256    text,

  attrs              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT content_version_tenant_fk
    FOREIGN KEY (tenant_id)
    REFERENCES eip_core.tenant(id)
    ON DELETE RESTRICT,

  -- enforce tenant match to parent content_object
  CONSTRAINT content_version_object_fk
    FOREIGN KEY (tenant_id, content_object_id)
    REFERENCES eip_core.content_object (tenant_id, id)
    ON DELETE CASCADE,

  CONSTRAINT chk_storage_kind
    CHECK (storage_kind = ANY (ARRAY[
      'fs'::text,        -- local filesystem (dev / on-prem)
      's3'::text,        -- AWS S3 or compatible
      'gcs'::text,       -- Google Cloud Storage
      'azure'::text,     -- Azure Blob Storage
      'url'::text,       -- externally hosted URL
      'inline'::text     -- small inline payload stored elsewhere (rare; metadata-only here)
    ])),

  CONSTRAINT chk_content_version_file_name_trim
    CHECK (file_name IS NULL OR file_name = btrim(file_name)),

  CONSTRAINT chk_content_version_checksum_trim
    CHECK (checksum_sha256 IS NULL OR checksum_sha256 = btrim(checksum_sha256)),

  CONSTRAINT chk_content_version_size_nonneg
    CHECK (size_bytes IS NULL OR size_bytes >= 0),

  CONSTRAINT chk_content_version_version_no_positive
    CHECK (version_no > 0)
);

-- One "current" version per content_object (optional, but useful)
-- If you later want multi-currents (e.g., multiple thumbnails), you can relax this.
CREATE UNIQUE INDEX IF NOT EXISTS content_version_one_current_per_object
  ON eip_core.content_version (tenant_id, content_object_id)
  WHERE is_current = true;

CREATE UNIQUE INDEX IF NOT EXISTS content_version_no_unique_per_object
  ON eip_core.content_version (tenant_id, content_object_id, version_no);

CREATE INDEX IF NOT EXISTS content_version_object_created_idx
  ON eip_core.content_version (tenant_id, content_object_id, created_at DESC);

CREATE INDEX IF NOT EXISTS content_version_attrs_gin
  ON eip_core.content_version
  USING gin (attrs);


COMMIT;
