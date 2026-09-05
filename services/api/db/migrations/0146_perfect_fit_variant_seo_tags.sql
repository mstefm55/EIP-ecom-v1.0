-- 0146_perfect_fit_variant_seo_tags.sql
-- Purpose:
--   Add Style Variant SEO + governed merchandising/discovery tags to Perfect Fit.
--   Reuse existing EIP Product attrs: seo.* and taxonomy.tags.
--   Publish the next PERFECT_FIT socket manifest version.
--
-- 0144 and 0145 are already executed and are intentionally not modified.

BEGIN;

-- ---------------------------------------------------------------------
-- 1) Identify PF-enabled tenants using the existing connection-profile contract.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _pf_0146_tenants ON COMMIT DROP AS
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
-- 2) Govern the PF product/variant tag vocabulary in existing dropdown tables.
-- ---------------------------------------------------------------------
INSERT INTO eip_core.dropdown_list
  (tenant_id, module, code, name, version, is_active, attrs)
SELECT
  t.tenant_id,
  'perfect_fit',
  'PF_PRODUCT_TAG',
  'Perfect Fit Product Tags',
  1,
  true,
  jsonb_build_object(
    'authority', 'EIP_DB',
    'taxonomy_role', 'DISCOVERY_TAG',
    'shared_consumers', jsonb_build_array(
      'perfect_fit_workspace',
      'pattern_library',
      'signature_orbit_carousel'
    ),
    'seed_migration', '0146'
  )
FROM _pf_0146_tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM eip_core.dropdown_list dl
  WHERE dl.tenant_id = t.tenant_id
    AND dl.module = 'perfect_fit'
    AND dl.code = 'PF_PRODUCT_TAG'
    AND dl.version = 1
);

WITH tag_seed(code, label, sort_order, attrs) AS (
  VALUES
    ('NEW_RELEASE', 'New Release', 10,
      '{"taxonomy_role":"DISCOVERY_TAG","workspace_selectable":true,"legacy_tag_id":"new-release"}'::jsonb),
    ('BEST_SELLER', 'Best Seller', 20,
      '{"taxonomy_role":"DISCOVERY_TAG","workspace_selectable":true,"catalog_filter_id":"best-sellers","legacy_tag_id":"best-seller"}'::jsonb),
    ('FREE_PATTERN', 'Free Pattern', 30,
      '{"taxonomy_role":"DISCOVERY_TAG","workspace_selectable":true,"catalog_filter_id":"free-patterns","legacy_tag_id":"free-pattern"}'::jsonb),
    ('PATTERN_OF_THE_DAY', 'Pattern of the Day', 40,
      '{"taxonomy_role":"DISCOVERY_TAG","workspace_selectable":true,"catalog_filter_id":"pattern-of-the-day","legacy_tag_id":"pattern-of-the-day"}'::jsonb),
    ('PREMIUM_BLUEPRINT', 'Premium Blueprint', 50,
      '{"taxonomy_role":"DISCOVERY_TAG","workspace_selectable":true,"legacy_tag_id":"premium-blueprint"}'::jsonb),
    ('BEGINNER_FRIENDLY', 'Beginner Friendly', 60,
      '{"taxonomy_role":"DISCOVERY_TAG","workspace_selectable":true,"legacy_tag_id":"beginner-friendly"}'::jsonb),
    ('EDITORIAL_PICK', 'Editorial Pick', 70,
      '{"taxonomy_role":"DISCOVERY_TAG","workspace_selectable":true,"legacy_tag_id":"editorial-pick"}'::jsonb),
    ('CURVE_PLUS', 'Curve & Plus Sizes', 80,
      '{"taxonomy_role":"DISCOVERY_TAG","workspace_selectable":true,"catalog_filter_id":"curve-plus","legacy_tag_id":"curve-plus"}'::jsonb),
    ('ORBIT_FEATURED', 'Orbit Featured', 90,
      '{"taxonomy_role":"DISCOVERY_TAG","workspace_selectable":true,"surface_targets":["signature-orbit-carousel","orbit-carousel"],"legacy_tag_id":"orbit-featured"}'::jsonb)
), pf_lists AS (
  SELECT dl.id
  FROM eip_core.dropdown_list dl
  JOIN _pf_0146_tenants t ON t.tenant_id = dl.tenant_id
  WHERE dl.module = 'perfect_fit'
    AND dl.code = 'PF_PRODUCT_TAG'
    AND dl.version = 1
    AND dl.is_active = true
)
INSERT INTO eip_core.dropdown_value
  (list_id, code, label, sort_order, is_active, attrs)
SELECT
  l.id,
  s.code,
  s.label,
  s.sort_order,
  true,
  s.attrs || jsonb_build_object(
    'application', 'perfect_fit',
    'authority', 'EIP_DB',
    'seed_migration', '0146'
  )
FROM pf_lists l
CROSS JOIN tag_seed s
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    attrs = COALESCE(eip_core.dropdown_value.attrs, '{}'::jsonb) || EXCLUDED.attrs,
    updated_at = now();

-- ---------------------------------------------------------------------
-- 3) Add explicit PF -> canonical EIP aliases. These are metadata projections,
--    not new storage mechanisms.
-- ---------------------------------------------------------------------
WITH alias_seed(alias_code, canonical_code) AS (
  VALUES
    ('variant.seo_title', 'seo.title'),
    ('variant.seo_description', 'seo.description'),
    ('variant.seo_slug', 'seo.slug'),
    ('variant.tags', 'taxonomy.tags')
)
INSERT INTO eip_commerce.socket_alias_map
  (tenant_id, map_kind, alias_code, canonical_code, attrs, is_active)
SELECT
  t.tenant_id,
  'FIELD',
  a.alias_code,
  a.canonical_code,
  jsonb_build_object(
    'application', 'perfect_fit',
    'authority', 'EIP_DB',
    'entity_level', 'STYLE_VARIANT',
    'seed_migration', '0146'
  ),
  true
FROM _pf_0146_tenants t
CROSS JOIN alias_seed a
WHERE NOT EXISTS (
  SELECT 1
  FROM eip_commerce.socket_alias_map existing
  WHERE existing.tenant_id = t.tenant_id
    AND existing.map_kind = 'FIELD'
    AND existing.alias_code = a.alias_code
    AND existing.is_active = true
);

-- ---------------------------------------------------------------------
-- 4) Publish a versioned successor to the current PERFECT_FIT manifest.
--    The prior published row is retained as history and only unpublished.
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
  JOIN _pf_0146_tenants t ON t.tenant_id = sm.tenant_id
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
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      manifest,
                      '{workspace,version}',
                      to_jsonb('2026-09-05-db-workspace-v2'::text),
                      true
                    ),
                    '{workspace,dropdownBindings,VARIANT_TAG}',
                    to_jsonb('PF_PRODUCT_TAG'::text),
                    true
                  ),
                  '{workspace,fields,variant.seo_title}',
                  '{"key":"variant.seo_title","label":"SEO title","type":"text","allowFreeText":true,"usedAsEipParameter":true,"maxLength":160}'::jsonb,
                  true
                ),
                '{workspace,fields,variant.seo_description}',
                '{"key":"variant.seo_description","label":"SEO description","help":"Search and social description for this Style Variant.","type":"textarea","rows":3,"allowFreeText":true,"usedAsEipParameter":true,"maxLength":320}'::jsonb,
                true
              ),
              '{workspace,fields,variant.seo_slug}',
              '{"key":"variant.seo_slug","label":"SEO slug","help":"URL-safe slug. Leave blank until a custom slug is required.","type":"text","allowFreeText":true,"usedAsEipParameter":true,"maxLength":180}'::jsonb,
              true
            ),
            '{workspace,fields,variant.tags}',
            '{"key":"variant.tags","label":"Discovery & merchandising tags","help":"Governed tags drive catalogue discovery and eligible presentation surfaces such as Orbit Featured.","type":"multiselect","governanceList":"VARIANT_TAG","allowFreeText":false,"usedAsEipParameter":true}'::jsonb,
            true
          ),
          '{workspace,fieldGroups,variantDiscoverySeo}',
          '{"label":"Discovery & SEO","fields":["variant.seo_title","variant.seo_description","variant.seo_slug","variant.tags"]}'::jsonb,
          true
        ),
        '{workspace,structure,panels,variant,fieldGroups}',
        (
          CASE
            WHEN COALESCE(manifest #> '{workspace,structure,panels,variant,fieldGroups}', '[]'::jsonb) ? 'variantDiscoverySeo'
            THEN COALESCE(manifest #> '{workspace,structure,panels,variant,fieldGroups}', '[]'::jsonb)
            ELSE COALESCE(manifest #> '{workspace,structure,panels,variant,fieldGroups}', '[]'::jsonb) || '"variantDiscoverySeo"'::jsonb
          END
        ),
        true
      ),
      '{workspace,discovery}',
      jsonb_build_object(
        'tagGovernanceList', 'VARIANT_TAG',
        'orbitSurfaceTargets', jsonb_build_array('signature-orbit-carousel', 'orbit-carousel'),
        'legacyFallbackWhenNoTaggedItems', true
      ),
      true
    ) AS manifest,
    COALESCE(attrs, '{}'::jsonb) || jsonb_build_object(
      'application', 'perfect_fit',
      'authority', 'EIP_DB',
      'metadata_scope', 'workspace_runtime',
      'seed_migration', '0146'
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
