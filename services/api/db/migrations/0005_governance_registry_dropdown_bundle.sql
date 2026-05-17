-- 0005_governance_registry_dropdown_bundle.sql
-- Purpose:
--   1) schema_registry: source-of-truth field definitions (base + tenant-specific)
--   2) schema_override: tenant patch layer (diff from base) for customization
--   3) schema_bundle: prebuilt effective UI schema bundle per tenant+module (Option 1)
--   4) dropdown_list / dropdown_value: controlled vocabularies (base + tenant overrides)

BEGIN;

-- -----------------------------
-- 1) Schema Registry (source)
-- -----------------------------
-- tenant_id NULL = "base product" definitions (global)
-- tenant_id NOT NULL = tenant-local definitions (rare; mostly use overrides)
CREATE TABLE IF NOT EXISTS eip_core.schema_registry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id     uuid REFERENCES eip_core.tenant(id) ON DELETE CASCADE, -- NULL = base
  module        text NOT NULL,        -- e.g. core, crm, sales, content, commerce
  object_kind   text NOT NULL,        -- e.g. party, service_object, task, asset, document
  object_type   text NOT NULL,        -- e.g. maintenance_case, sales_order, person, org_unit

  version       integer NOT NULL DEFAULT 1,
  is_active     boolean NOT NULL DEFAULT true,

  -- JSON Schema-like definition for attrs/payloads (validated in API)
  schema_json   jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- UI metadata: sections, labels, hints, column configs (not business logic)
  ui_json       jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT schema_registry_unique UNIQUE (tenant_id, module, object_kind, object_type, version)
);

-- Fast lookups by tenant+module+kind+type
CREATE INDEX IF NOT EXISTS schema_registry_lookup_idx
  ON eip_core.schema_registry(tenant_id, module, object_kind, object_type, is_active, version);

-- JSON indexes (used sparingly; still helpful)
CREATE INDEX IF NOT EXISTS schema_registry_schema_gin
  ON eip_core.schema_registry USING gin (schema_json);

CREATE INDEX IF NOT EXISTS schema_registry_ui_gin
  ON eip_core.schema_registry USING gin (ui_json);

-- -----------------------------
-- 2) Schema Overrides (tenant patch)
-- -----------------------------
-- Stores a patch/diff against a base registry entry (recommended "A: patch overrides").
-- Patch format is up to our API merge logic (RFC6902 JSON Patch or merge-patch style).
CREATE TABLE IF NOT EXISTS eip_core.schema_override (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,

  -- Base target: references a base schema_registry row (tenant_id IS NULL)
  base_registry_id uuid NOT NULL REFERENCES eip_core.schema_registry(id) ON DELETE CASCADE,

  -- Patch operations / merge patch payload
  patch_json       jsonb NOT NULL,

  is_active        boolean NOT NULL DEFAULT true,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- allow multiple override versions over time; only one active per base per tenant usually
  CONSTRAINT schema_override_unique UNIQUE (tenant_id, base_registry_id, created_at)
);

CREATE INDEX IF NOT EXISTS schema_override_lookup_idx
  ON eip_core.schema_override(tenant_id, base_registry_id, is_active);

CREATE INDEX IF NOT EXISTS schema_override_patch_gin
  ON eip_core.schema_override USING gin (patch_json);

-- -----------------------------
-- 3) Schema Bundles (prebuilt effective UI bundles)
-- -----------------------------
-- Stores merged "effective bundle" per tenant+module+version.
-- UI downloads one bundle per module; server uses ETag for caching.
CREATE TABLE IF NOT EXISTS eip_core.schema_bundle (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,

  module        text NOT NULL,                -- core, crm, sales, content, commerce
  version       integer NOT NULL DEFAULT 1,   -- bundle version (monotonic per tenant+module)
  is_published  boolean NOT NULL DEFAULT false,

  -- The effective bundle JSON (schemas + dropdowns needed for that module)
  bundle_json   jsonb NOT NULL,

  -- Optional caching helper; filled by API when publishing
  etag          text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT schema_bundle_unique UNIQUE (tenant_id, module, version)
);

-- Fast fetch: "latest published bundle"
CREATE INDEX IF NOT EXISTS schema_bundle_latest_idx
  ON eip_core.schema_bundle(tenant_id, module, is_published, version DESC);

CREATE INDEX IF NOT EXISTS schema_bundle_json_gin
  ON eip_core.schema_bundle USING gin (bundle_json);

-- -----------------------------
-- 4) Dropdowns (controlled vocabularies)
-- -----------------------------
-- dropdown_list tenant_id NULL = base product list
-- tenant_id NOT NULL = tenant-specific list (override or extra list)
CREATE TABLE IF NOT EXISTS eip_core.dropdown_list (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id   uuid REFERENCES eip_core.tenant(id) ON DELETE CASCADE, -- NULL = base
  module      text NOT NULL,      -- core, crm, sales, content, etc.
  code        text NOT NULL,      -- stable key used in schemas (e.g. PRIORITY, UOM, COUNTRY)
  name        text NOT NULL,      -- human readable name
  version     integer NOT NULL DEFAULT 1,
  is_active   boolean NOT NULL DEFAULT true,

  attrs       jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dropdown_list_unique UNIQUE (tenant_id, module, code, version)
);

CREATE INDEX IF NOT EXISTS dropdown_list_lookup_idx
  ON eip_core.dropdown_list(tenant_id, module, code, is_active, version);

CREATE INDEX IF NOT EXISTS dropdown_list_attrs_gin
  ON eip_core.dropdown_list USING gin (attrs);

CREATE TABLE IF NOT EXISTS eip_core.dropdown_value (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       uuid NOT NULL REFERENCES eip_core.dropdown_list(id) ON DELETE CASCADE,

  code          text NOT NULL,        -- stable (e.g. HIGH, MEDIUM, LOW)
  label         text NOT NULL,        -- display label
  sort_order    integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,

  attrs         jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dropdown_value_unique UNIQUE (list_id, code)
);

CREATE INDEX IF NOT EXISTS dropdown_value_list_idx
  ON eip_core.dropdown_value(list_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS dropdown_value_attrs_gin
  ON eip_core.dropdown_value USING gin (attrs);

COMMIT;
