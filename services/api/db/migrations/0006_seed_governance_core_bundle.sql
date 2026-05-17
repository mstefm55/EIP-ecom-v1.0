-- 0006_seed_governance_core_bundle.sql
-- Purpose (Step C.1):
--   1) Seed base dropdown PRIORITY (LOW/MEDIUM/HIGH)
--   2) Seed base schema_registry for core/work_object/maintenance_case (minimal)
--   3) Publish schema_bundle for tenant eip_demo, module core, version 1

BEGIN;

-- -----------------------------
-- 0) Resolve tenant id
-- -----------------------------
WITH t AS (
  SELECT id AS tenant_id
  FROM eip_core.tenant
  WHERE code = 'eip_demo'
)
SELECT 1 FROM t;

-- -----------------------------
-- 1) Base dropdown: PRIORITY
-- -----------------------------
-- Insert dropdown_list (base: tenant_id IS NULL)
INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
SELECT
  NULL::uuid,
  'core',
  'PRIORITY',
  'Priority',
  1,
  true,
  '{"note":"base dropdown"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM eip_core.dropdown_list dl
  WHERE dl.tenant_id IS NULL
    AND dl.module = 'core'
    AND dl.code = 'PRIORITY'
    AND dl.version = 1
);

-- Insert dropdown values (LOW/MEDIUM/HIGH)
WITH list AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE tenant_id IS NULL AND module='core' AND code='PRIORITY' AND version=1
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT list.id, v.code, v.label, v.sort_order, true, '{}'::jsonb
FROM list
JOIN (VALUES
  ('LOW',    'Low',    10),
  ('MEDIUM', 'Medium', 20),
  ('HIGH',   'High',   30)
) AS v(code, label, sort_order) ON TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM eip_core.dropdown_value dv
  WHERE dv.list_id = list.id
    AND dv.code = v.code
);

-- -----------------------------
-- 2) Base schema_registry: maintenance_case
-- -----------------------------
-- Minimal schema_json + ui_json.
-- schema_json: governs attrs keys (strict snake_case)
-- ui_json: minimal UI hints (labels/order; expand later)
INSERT INTO eip_core.schema_registry (
  tenant_id, module, object_kind, object_type, version, is_active, schema_json, ui_json
)
SELECT
  NULL::uuid,
  'core',
  'work_object',
  'maintenance_case',
  1,
  true,
  -- schema_json (JSON Schema-like)
  '{
    "attrs": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "priority": { "type": "string", "enumRef": "PRIORITY" },
        "symptom":  { "type": "string", "maxLength": 500 },
        "notes":    { "type": "string", "maxLength": 2000 }
      },
      "required": ["priority"]
    }
  }'::jsonb,
  -- ui_json (minimal UI metadata)
  '{
    "title": "Maintenance Case",
    "fields": [
      { "path": "attrs.priority", "label": "Priority", "control": "select", "dropdown": "PRIORITY", "order": 10 },
      { "path": "attrs.symptom",  "label": "Symptom",  "control": "text",   "order": 20 },
      { "path": "attrs.notes",    "label": "Notes",    "control": "textarea","order": 30 }
    ]
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM eip_core.schema_registry sr
  WHERE sr.tenant_id IS NULL
    AND sr.module = 'core'
    AND sr.object_kind = 'work_object'
    AND sr.object_type = 'maintenance_case'
    AND sr.version = 1
);

-- -----------------------------
-- 3) Publish bundle for tenant eip_demo, module core, version 1
-- -----------------------------
-- Bundle contains:
--   - schema for maintenance_case
--   - dropdown PRIORITY and its values
WITH
t AS (
  SELECT id AS tenant_id FROM eip_core.tenant WHERE code='eip_demo'
),
sr AS (
  SELECT
    sr.id,
    sr.module,
    sr.object_kind,
    sr.object_type,
    sr.version,
    sr.schema_json,
    sr.ui_json
  FROM eip_core.schema_registry sr
  WHERE sr.tenant_id IS NULL
    AND sr.module='core'
    AND sr.object_kind='work_object'
    AND sr.object_type='maintenance_case'
    AND sr.version=1
),
dl AS (
  SELECT dl.id, dl.module, dl.code, dl.name, dl.version
  FROM eip_core.dropdown_list dl
  WHERE dl.tenant_id IS NULL
    AND dl.module='core'
    AND dl.code='PRIORITY'
    AND dl.version=1
),
dv AS (
  SELECT dv.list_id, dv.code, dv.label, dv.sort_order
  FROM eip_core.dropdown_value dv
  JOIN dl ON dl.id = dv.list_id
  WHERE dv.is_active = true
),
dropdown_json AS (
  SELECT jsonb_build_object(
    dl.code,
    jsonb_build_object(
      'name', dl.name,
      'version', dl.version,
      'values', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'code', dv.code,
            'label', dv.label,
            'sort_order', dv.sort_order
          )
          ORDER BY dv.sort_order
        )
        FROM dv
      )
    )
  ) AS dd
  FROM dl
),

schema_json AS (
  SELECT jsonb_build_object(
    sr.object_type,
    jsonb_build_object(
      'object_kind', sr.object_kind,
      'version', sr.version,
      'schema', sr.schema_json,
      'ui', sr.ui_json
    )
  ) AS ss
  FROM sr
),
bundle AS (
  SELECT
    t.tenant_id,
    'core'::text AS module,
    1::int AS version,
    true AS is_published,
    jsonb_build_object(
      'module', 'core',
      'version', 1,
      'generated_at', now(),
      'schemas', (SELECT ss FROM schema_json),
      'dropdowns', (SELECT dd FROM dropdown_json)
    ) AS bundle_json
  FROM t
)

INSERT INTO eip_core.schema_bundle (tenant_id, module, version, is_published, bundle_json, etag)
SELECT
  b.tenant_id,
  b.module,
  b.version,
  b.is_published,
  b.bundle_json,
  md5(b.bundle_json::text)  -- simple etag; API can refine later
FROM bundle b
WHERE NOT EXISTS (
  SELECT 1
  FROM eip_core.schema_bundle sb
  WHERE sb.tenant_id = b.tenant_id
    AND sb.module = b.module
    AND sb.version = b.version
);

COMMIT;
