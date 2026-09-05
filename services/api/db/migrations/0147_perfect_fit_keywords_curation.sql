-- 0147_perfect_fit_keywords_curation.sql
-- Purpose:
--   Separate free-entry SEO/search keywords from governed curation controls.
--   Keep executed 0146 tag codes stable for compatibility, but present them as
--   governed curation/placement controls. Add free keywords mapped to seo.keywords.
--
-- 0144, 0145 and 0146 are historical/executed migrations and are not modified.

BEGIN;

CREATE TEMP TABLE _pf_0147_tenants ON COMMIT DROP AS
SELECT DISTINCT t.id AS tenant_id
FROM eip_core.tenant t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(t.attrs->'connection_profiles') = 'array'
    THEN t.attrs->'connection_profiles'
    ELSE '[]'::jsonb
  END
) AS profile
WHERE t.is_active = true
  AND (
    lower(COALESCE(profile->'public_storefront'->>'perfect_fit_enabled', 'false')) = 'true'
    OR COALESCE(profile->'public_storefront'->'scopes', '[]'::jsonb) ? 'perfect_fit.products.read'
  );

-- ---------------------------------------------------------------------
-- 1) Re-characterize the existing governed PF_PRODUCT_TAG vocabulary as
--    curation/placement controls. Codes remain unchanged to avoid regressions.
-- ---------------------------------------------------------------------
UPDATE eip_core.dropdown_list dl
SET name = 'Perfect Fit Curation & Placement',
    attrs = COALESCE(dl.attrs, '{}'::jsonb) || jsonb_build_object(
      'authority', 'EIP_DB',
      'ui_role', 'CURATION_PLACEMENT',
      'behavioral', true,
      'workspace_selectable', true,
      'seed_migration', '0147'
    ),
    updated_at = now()
FROM _pf_0147_tenants t
WHERE dl.tenant_id = t.tenant_id
  AND dl.module = 'perfect_fit'
  AND dl.code = 'PF_PRODUCT_TAG'
  AND dl.version = 1;

UPDATE eip_core.dropdown_value dv
SET attrs = COALESCE(dv.attrs, '{}'::jsonb) || jsonb_build_object(
      'ui_role', 'CURATION_PLACEMENT',
      'behavioral', true,
      'seed_migration', '0147'
    ),
    updated_at = now()
FROM eip_core.dropdown_list dl
JOIN _pf_0147_tenants t ON t.tenant_id = dl.tenant_id
WHERE dv.list_id = dl.id
  AND dl.module = 'perfect_fit'
  AND dl.code = 'PF_PRODUCT_TAG'
  AND dl.version = 1;

-- ---------------------------------------------------------------------
-- 2) Add the free-entry keyword alias. Keywords are not dropdown-governed.
-- ---------------------------------------------------------------------
INSERT INTO eip_commerce.socket_alias_map
  (tenant_id, map_kind, alias_code, canonical_code, attrs, is_active)
SELECT
  t.tenant_id,
  'FIELD',
  'variant.seo_keywords',
  'seo.keywords',
  jsonb_build_object(
    'application', 'perfect_fit',
    'authority', 'PERFECT_FIT_VARIANT',
    'entity_level', 'STYLE_VARIANT',
    'value_kind', 'STRING_ARRAY',
    'allow_free_text', true,
    'seed_migration', '0147'
  ),
  true
FROM _pf_0147_tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM eip_commerce.socket_alias_map existing
  WHERE existing.tenant_id = t.tenant_id
    AND existing.map_kind = 'FIELD'
    AND existing.alias_code = 'variant.seo_keywords'
    AND existing.is_active = true
);

-- Keep the legacy logical key variant.tags mapped to taxonomy.tags, but make
-- its semantic role explicit as governed curation/placement for PF.
UPDATE eip_commerce.socket_alias_map sam
SET attrs = COALESCE(sam.attrs, '{}'::jsonb) || jsonb_build_object(
      'ui_role', 'CURATION_PLACEMENT',
      'governed', true,
      'seed_migration', '0147'
    ),
    updated_at = now()
FROM _pf_0147_tenants t
WHERE sam.tenant_id = t.tenant_id
  AND sam.map_kind = 'FIELD'
  AND sam.alias_code = 'variant.tags'
  AND sam.canonical_code = 'taxonomy.tags'
  AND sam.is_active = true;

-- ---------------------------------------------------------------------
-- 3) Publish a successor PERFECT_FIT runtime manifest.
--    - Search keywords: free-entry tag input, no governance list.
--    - Curation & placement: governed by PF_PRODUCT_TAG.
-- ---------------------------------------------------------------------
WITH current_manifest AS (
  SELECT DISTINCT ON (sm.tenant_id)
    sm.id,
    sm.tenant_id,
    sm.code,
    sm.version,
    sm.manifest,
    sm.attrs
  FROM eip_commerce.socket_manifest sm
  JOIN _pf_0147_tenants t ON t.tenant_id = sm.tenant_id
  WHERE sm.code = 'PERFECT_FIT'
    AND sm.is_published = true
  ORDER BY sm.tenant_id, sm.version DESC, sm.updated_at DESC
), unpublished AS (
  UPDATE eip_commerce.socket_manifest sm
  SET is_published = false,
      updated_at = now()
  FROM current_manifest current
  WHERE sm.id = current.id
  RETURNING
    current.tenant_id,
    current.code,
    current.version,
    current.manifest,
    current.attrs
), patched AS (
  SELECT
    tenant_id,
    code,
    version + 1 AS next_version,
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                manifest,
                '{workspace,version}',
                to_jsonb('2026-09-05-db-workspace-v3'::text),
                true
              ),
              '{workspace,dropdownBindings,VARIANT_CURATION}',
              to_jsonb('PF_PRODUCT_TAG'::text),
              true
            ),
            '{workspace,fields,variant.seo_keywords}',
            '{"key":"variant.seo_keywords","label":"Search keywords","help":"Add free search terms. Press Enter or comma, or use the add button.","type":"tagInput","allowFreeText":true,"usedAsEipParameter":true,"maxItems":30,"maxItemLength":80,"placeholder":"Add keyword"}'::jsonb,
            true
          ),
          '{workspace,fields,variant.tags}',
          '{"key":"variant.tags","label":"Curation & placement","help":"Governed controls drive catalogue facets, badges and eligible presentation surfaces such as Orbit.","type":"multiselect","governanceList":"VARIANT_CURATION","allowFreeText":false,"usedAsEipParameter":true}'::jsonb,
          true
        ),
        '{workspace,fieldGroups,variantDiscoverySeo}',
        '{"label":"Discovery & SEO","fields":["variant.seo_title","variant.seo_description","variant.seo_slug","variant.seo_keywords","variant.tags"]}'::jsonb,
        true
      ),
      '{workspace,discovery}',
      COALESCE(manifest #> '{workspace,discovery}', '{}'::jsonb) || jsonb_build_object(
        'keywordField', 'variant.seo_keywords',
        'keywordMode', 'FREE_ENTRY',
        'curationField', 'variant.tags',
        'curationGovernanceList', 'VARIANT_CURATION',
        'curationDropdownCode', 'PF_PRODUCT_TAG',
        'legacyFallbackWhenNoTaggedItems', true
      ),
      true
    ) AS manifest,
    COALESCE(attrs, '{}'::jsonb) || jsonb_build_object(
      'application', 'perfect_fit',
      'authority', 'EIP_DB',
      'metadata_scope', 'workspace_runtime',
      'seed_migration', '0147'
    ) AS attrs
  FROM unpublished
)
INSERT INTO eip_commerce.socket_manifest
  (tenant_id, code, version, is_published, published_at, manifest, attrs)
SELECT
  tenant_id,
  code,
  next_version,
  true,
  now(),
  manifest,
  attrs
FROM patched;

COMMIT;
