-- 0013_core_bundle_v1.sql
-- Skeleton Step C: publish first schema bundle for tenant eip_demo (module core, version 1)
-- Includes: core dropdowns + schema_registry snapshot (global)
-- Rerunnable: upserts into schema_bundle (tenant_id, module, version)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Hard fail if tenant does not exist (no silent publish to nowhere)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM eip_core.tenant
    WHERE id = '18e6209d-155a-4932-9b7b-e11ad09aaf49'::uuid
  ) THEN
    RAISE EXCEPTION 'Tenant not found: %', '18e6209d-155a-4932-9b7b-e11ad09aaf49';
  END IF;
END $$;

WITH
-- Dropdown lists included in this core bundle (global lists only)
dl AS (
  SELECT
    dl.id,
    dl.tenant_id,
    dl.module,
    dl.code,
    dl.name,
    dl.version,
    dl.is_active,
    dl.attrs
  FROM eip_core.dropdown_list dl
  WHERE dl.tenant_id IS NULL
    AND dl.module = 'core'
    AND dl.code IN ('PRIORITY', 'SERVICE_OBJECT_STATUS', 'TASK_STATUS')
),
-- Dropdown values for those lists
dv AS (
  SELECT
    dv.list_id,
    dv.code,
    dv.label,
    dv.sort_order,
    dv.is_active,
    dv.attrs
  FROM eip_core.dropdown_value dv
  WHERE dv.list_id IN (SELECT id FROM dl)
),
-- Schema registry snapshot (global, core module). Schema-proof: don't enumerate columns.
sr AS (
  SELECT sr.*
  FROM eip_core.schema_registry sr
  WHERE sr.tenant_id IS NULL
    AND sr.module = 'core'
),
-- Assemble the bundle JSON
bundle AS (
  SELECT jsonb_build_object(
    'meta', jsonb_build_object(
      'tenant_id', '18e6209d-155a-4932-9b7b-e11ad09aaf49',
      'tenant_code', 'eip_demo',
      'module', 'core',
      'version', 1,
      'built_at', now()
    ),
    'dropdowns', jsonb_build_object(
      'lists',
        COALESCE((SELECT jsonb_agg(to_jsonb(dl) ORDER BY dl.code, dl.version) FROM dl), '[]'::jsonb),
      'values',
        COALESCE((SELECT jsonb_agg(to_jsonb(dv) ORDER BY dv.list_id, dv.sort_order) FROM dv), '[]'::jsonb)
    ),
    'schema_registry',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(sr) ORDER BY
            (to_jsonb(sr)->>'object_kind'),
            (to_jsonb(sr)->>'object_type'),
            (to_jsonb(sr)->>'version')
         ) FROM sr),
        '[]'::jsonb
      )
  ) AS bundle_json
),
final_payload AS (
  SELECT
    bundle.bundle_json,
    encode(digest(bundle.bundle_json::text, 'sha256'), 'hex') AS etag
  FROM bundle
)
INSERT INTO eip_core.schema_bundle (
  tenant_id,
  module,
  version,
  is_published,
  bundle_json,
  etag
)
SELECT
  '18e6209d-155a-4932-9b7b-e11ad09aaf49'::uuid,
  'core',
  1,
  true,
  fp.bundle_json,
  fp.etag
FROM final_payload fp
ON CONFLICT (tenant_id, module, version) DO UPDATE
SET
  is_published = EXCLUDED.is_published,
  bundle_json  = EXCLUDED.bundle_json,
  etag         = EXCLUDED.etag,
  updated_at   = now();

COMMIT;
