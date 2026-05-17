-- 0021_core_bundle_v2.sql
-- Republish core schema bundle for tenant eip_demo as version 2
-- Includes latest dropdowns and schema_registry snapshot.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Safety: ensure tenant exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM eip_core.tenant
    WHERE id = '18e6209d-155a-4932-9b7b-e11ad09aaf49'::uuid
  ) THEN
    RAISE EXCEPTION 'Tenant not found: %', '18e6209d-155a-4932-9b7b-e11ad09aaf49';
  END IF;
END $$;

WITH
-- All global dropdown lists for core module
dl AS (
  SELECT *
  FROM eip_core.dropdown_list
  WHERE tenant_id IS NULL
    AND module = 'core'
    AND is_active = true
),
dv AS (
  SELECT *
  FROM eip_core.dropdown_value
  WHERE list_id IN (SELECT id FROM dl)
    AND is_active = true
),
-- All global schema registry entries for core module
sr AS (
  SELECT *
  FROM eip_core.schema_registry
  WHERE tenant_id IS NULL
    AND module = 'core'
    AND is_active = true
),
bundle AS (
  SELECT jsonb_build_object(
    'meta', jsonb_build_object(
      'tenant_id', '18e6209d-155a-4932-9b7b-e11ad09aaf49',
      'tenant_code', 'eip_demo',
      'module', 'core',
      'version', 2,
      'built_at', now()
    ),
    'dropdowns', jsonb_build_object(
      'lists', COALESCE((SELECT jsonb_agg(to_jsonb(dl) ORDER BY dl.code, dl.version) FROM dl), '[]'::jsonb),
      'values', COALESCE((SELECT jsonb_agg(to_jsonb(dv) ORDER BY dv.list_id, dv.sort_order) FROM dv), '[]'::jsonb)
    ),
    'schema_registry', COALESCE(
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
  tenant_id, module, version, is_published, bundle_json, etag
)
SELECT
  '18e6209d-155a-4932-9b7b-e11ad09aaf49'::uuid,
  'core',
  2,
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
