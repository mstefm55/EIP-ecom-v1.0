-- 0148_perfect_fit_admin_curation_ownership.sql
-- Purpose:
--   Correct curation ownership after 0147. Ordinary Perfect Fit designers keep
--   Variant SEO/search metadata, while website-level merchandising tags are
--   assigned only by PF Admin / EIP Product Studio.
--
-- Historical migrations 0144-0147 are intentionally not modified.

BEGIN;

CREATE TEMP TABLE _pf_0148_tenants ON COMMIT DROP AS
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
-- 1) Keep the existing PF_PRODUCT_TAG vocabulary/codes, but make assignment
--    authority explicit. Behavioral attrs (surface_targets, catalog_filter_id,
--    legacy_tag_id, etc.) are preserved by JSONB merge.
-- ---------------------------------------------------------------------
UPDATE eip_core.dropdown_list dl
SET name = 'Perfect Fit Curation & Placement',
    attrs = COALESCE(dl.attrs, '{}'::jsonb) || jsonb_build_object(
      'authority', 'EIP_DB',
      'ui_role', 'CURATION_PLACEMENT',
      'behavioral', true,
      'workspace_selectable', false,
      'admin_selectable', true,
      'product_studio_selectable', true,
      'assignment_authority', 'MERCHANDISING_ADMIN',
      'assignment_surfaces', jsonb_build_array('PF_ADMIN', 'EIP_PRODUCT_STUDIO'),
      'seed_migration', '0148'
    ),
    updated_at = now()
FROM _pf_0148_tenants t
WHERE dl.tenant_id = t.tenant_id
  AND dl.module = 'perfect_fit'
  AND dl.code = 'PF_PRODUCT_TAG'
  AND dl.version = 1;

UPDATE eip_core.dropdown_value dv
SET attrs = COALESCE(dv.attrs, '{}'::jsonb) || jsonb_build_object(
      'ui_role', 'CURATION_PLACEMENT',
      'behavioral', true,
      'workspace_selectable', false,
      'admin_selectable', true,
      'product_studio_selectable', true,
      'assignment_authority', 'MERCHANDISING_ADMIN',
      'seed_migration', '0148'
    ),
    updated_at = now()
FROM eip_core.dropdown_list dl
JOIN _pf_0148_tenants t ON t.tenant_id = dl.tenant_id
WHERE dv.list_id = dl.id
  AND dl.module = 'perfect_fit'
  AND dl.code = 'PF_PRODUCT_TAG'
  AND dl.version = 1;

-- ---------------------------------------------------------------------
-- 2) Preserve the compatibility alias, but explicitly remove ordinary
--    workspace write authority. Server projection enforces this boundary too.
-- ---------------------------------------------------------------------
UPDATE eip_commerce.socket_alias_map sam
SET attrs = COALESCE(sam.attrs, '{}'::jsonb) || jsonb_build_object(
      'ui_role', 'CURATION_PLACEMENT',
      'governed', true,
      'workspace_writeable', false,
      'admin_only', true,
      'assignment_authority', 'MERCHANDISING_ADMIN',
      'assignment_surfaces', jsonb_build_array('PF_ADMIN', 'EIP_PRODUCT_STUDIO'),
      'seed_migration', '0148'
    ),
    updated_at = now()
FROM _pf_0148_tenants t
WHERE sam.tenant_id = t.tenant_id
  AND sam.map_kind = 'FIELD'
  AND sam.alias_code = 'variant.tags'
  AND sam.canonical_code = 'taxonomy.tags'
  AND sam.is_active = true;

-- ---------------------------------------------------------------------
-- 3) Publish a successor PERFECT_FIT runtime manifest.
--    - Designer Variant Overview keeps SEO + free keywords only.
--    - variant.tags remains a compatibility descriptor, admin-only/read-only
--      from the ordinary workspace.
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
  JOIN _pf_0148_tenants t ON t.tenant_id = sm.tenant_id
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
            manifest,
            '{workspace,version}',
            to_jsonb('2026-09-06-db-workspace-v4'::text),
            true
          ),
          '{workspace,fields,variant.tags}',
          '{"key":"variant.tags","label":"Curation & placement","help":"Website merchandising controls are assigned by Perfect Fit Admin or EIP Product Studio.","type":"multiselect","governanceList":"VARIANT_CURATION","allowFreeText":false,"usedAsEipParameter":true,"adminOnly":true,"workspaceEditable":false,"assignmentAuthority":"MERCHANDISING_ADMIN"}'::jsonb,
          true
        ),
        '{workspace,fieldGroups,variantDiscoverySeo}',
        '{"label":"Discovery & SEO","fields":["variant.seo_title","variant.seo_description","variant.seo_slug","variant.seo_keywords"]}'::jsonb,
        true
      ),
      '{workspace,discovery}',
      COALESCE(manifest #> '{workspace,discovery}', '{}'::jsonb) || jsonb_build_object(
        'keywordField', 'variant.seo_keywords',
        'keywordMode', 'FREE_ENTRY',
        'curationField', 'variant.tags',
        'curationGovernanceList', 'VARIANT_CURATION',
        'curationDropdownCode', 'PF_PRODUCT_TAG',
        'curationAssignmentAuthority', 'MERCHANDISING_ADMIN',
        'curationAssignmentSurfaces', jsonb_build_array('PF_ADMIN', 'EIP_PRODUCT_STUDIO'),
        'workspaceCurationEditable', false,
        'legacyFallbackWhenNoTaggedItems', true
      ),
      true
    ) AS manifest,
    COALESCE(attrs, '{}'::jsonb) || jsonb_build_object(
      'application', 'perfect_fit',
      'authority', 'EIP_DB',
      'metadata_scope', 'workspace_runtime',
      'seed_migration', '0148'
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
