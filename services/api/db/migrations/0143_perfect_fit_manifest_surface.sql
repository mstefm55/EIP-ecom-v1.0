BEGIN;

-- Perfect Fit does not know EIP table/JSONB storage details. This governed
-- manifest surface is the server-side translation contract. Tenant-specific
-- published surfaces with the same code can override these defaults later.
INSERT INTO eip_core.ui_surface (
  tenant_id,
  code,
  title,
  version,
  is_active,
  is_published,
  is_public,
  tree,
  attrs
)
SELECT
  NULL,
  'perfect_fit_workspace_manifest',
  'Perfect Fit Workspace Manifest',
  1,
  true,
  true,
  false,
  '{"id":"perfect-fit-workspace-manifest","type":"Manifest","props":{"application":"perfect_fit"},"children":[]}'::jsonb,
  jsonb_build_object(
    'mapping_meta', jsonb_build_object(
      'application', 'perfect_fit',
      'coordinator_version', 1,
      'policy', 'manifest_driven_projection',
      'admin_override_allowed', true,
      'frontend_storage_knowledge', false
    ),
    'mapping', jsonb_build_object(
      'product.style_name', jsonb_build_object(
        'target', 'material.name',
        'status', 'APPROVED',
        'direction', 'BOTH',
        'authority', 'PERFECT_FIT',
        'storage', jsonb_build_object(
          'kind', 'RELATIONAL_COLUMN',
          'object_kind', 'material',
          'field', 'name'
        )
      ),
      'product.description', jsonb_build_object(
        'target', 'material.attrs.content.summary',
        'status', 'APPROVED',
        'direction', 'PF_TO_EIP',
        'authority', 'PERFECT_FIT',
        'storage', jsonb_build_object(
          'kind', 'JSONB_PATH',
          'object_kind', 'material',
          'field', 'attrs',
          'path', jsonb_build_array('content', 'summary')
        )
      ),
      'product.brand', jsonb_build_object(
        'target', 'material.attrs.taxonomy.brand',
        'status', 'APPROVED',
        'direction', 'BOTH',
        'authority', 'LATEST_ACCEPTED',
        'storage', jsonb_build_object(
          'kind', 'JSONB_PATH',
          'object_kind', 'material',
          'field', 'attrs',
          'path', jsonb_build_array('taxonomy', 'brand')
        )
      ),
      'product.enterprise_category_code', jsonb_build_object(
        'target', 'material.attrs.taxonomy.category_code',
        'status', 'APPROVED',
        'direction', 'BOTH',
        'authority', 'EIP',
        'storage', jsonb_build_object(
          'kind', 'JSONB_PATH',
          'object_kind', 'material',
          'field', 'attrs',
          'path', jsonb_build_array('taxonomy', 'category_code')
        )
      ),
      'product.enterprise_lifecycle_status', jsonb_build_object(
        'target', 'material.attrs.workflow.lifecycle_status',
        'status', 'APPROVED',
        'direction', 'BOTH',
        'authority', 'EIP',
        'storage', jsonb_build_object(
          'kind', 'JSONB_PATH',
          'object_kind', 'material',
          'field', 'attrs',
          'path', jsonb_build_array('workflow', 'lifecycle_status')
        )
      ),
      'product.enterprise_publication_status', jsonb_build_object(
        'target', 'material.attrs.workflow.publication_status',
        'status', 'APPROVED',
        'direction', 'BOTH',
        'authority', 'MANUAL_REVIEW',
        'storage', jsonb_build_object(
          'kind', 'JSONB_PATH',
          'object_kind', 'material',
          'field', 'attrs',
          'path', jsonb_build_array('workflow', 'publication_status')
        )
      ),
      'product.currency', jsonb_build_object(
        'target', 'material.attrs.commercial.currency',
        'status', 'APPROVED',
        'direction', 'BOTH',
        'authority', 'EIP',
        'storage', jsonb_build_object(
          'kind', 'JSONB_PATH',
          'object_kind', 'material',
          'field', 'attrs',
          'path', jsonb_build_array('commercial', 'currency')
        )
      ),
      'variant.name', jsonb_build_object(
        'target', 'material.attrs.perfect_fit.variant_name',
        'status', 'APPROVED',
        'direction', 'PF_TO_EIP',
        'authority', 'PERFECT_FIT',
        'storage', jsonb_build_object(
          'kind', 'JSONB_PATH',
          'object_kind', 'material',
          'field', 'attrs',
          'path', jsonb_build_array('perfect_fit', 'variant_name')
        )
      ),
      'variant.code', jsonb_build_object(
        'target', 'material.attrs.perfect_fit.variant_code',
        'status', 'APPROVED',
        'direction', 'PF_TO_EIP',
        'authority', 'PERFECT_FIT',
        'storage', jsonb_build_object(
          'kind', 'JSONB_PATH',
          'object_kind', 'material',
          'field', 'attrs',
          'path', jsonb_build_array('perfect_fit', 'variant_code')
        )
      )
    )
  )
WHERE NOT EXISTS (
  SELECT 1
  FROM eip_core.ui_surface
  WHERE tenant_id IS NULL
    AND code = 'perfect_fit_workspace_manifest'
    AND version = 1
);

COMMIT;
