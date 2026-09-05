-- 0144_perfect_fit_db_metadata_manifest.sql
-- Purpose:
--   Move Perfect Fit dynamic workspace metadata authority into existing EIP V1
--   governance tables. No Perfect Fit-specific persistence table is introduced.
--
-- Runtime authority:
--   socket_manifest   -> workspace field/tree/group metadata
--   dropdown_*       -> controlled vocabularies and labels
--   socket_alias_map -> PF logical field -> canonical EIP vocabulary
--
-- This migration intentionally does NOT reuse retired/unexecuted migration 0143.

BEGIN;

-- ---------------------------------------------------------------------
-- 1) PF-enabled tenants only. Seed tenant-owned Perfect Fit dropdown lists.
-- ---------------------------------------------------------------------
WITH pf_tenants AS (
  SELECT DISTINCT t.id
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
    )
), list_seed(logical_code, db_code, name) AS (
  VALUES
    ('PROJECT_STATUS', 'PF_PROJECT_STATUS', 'Perfect Fit Project Status'),
    ('PRODUCT_DEVELOPMENT_STAGE', 'PF_PRODUCT_DEVELOPMENT_STAGE', 'Perfect Fit Product Development Stage'),
    ('GARMENT_CATEGORY', 'PF_GARMENT_CATEGORY', 'Perfect Fit Garment Category'),
    ('DIFFICULTY_LEVEL', 'PF_DIFFICULTY_LEVEL', 'Perfect Fit Difficulty Level'),
    ('FIT_SILHOUETTE', 'PF_FIT_SILHOUETTE', 'Perfect Fit Fit Silhouette'),
    ('STANDARD_FIT_CATEGORY', 'PF_STANDARD_FIT_CATEGORY', 'Perfect Fit Standard Fit Category'),
    ('FIT_PRIORITY', 'PF_FIT_PRIORITY', 'Perfect Fit Fit Priority'),
    ('FIT_RESULT', 'PF_FIT_RESULT', 'Perfect Fit Fit Result'),
    ('FIT_ISSUE', 'PF_FIT_ISSUE', 'Perfect Fit Fit Issue'),
    ('FIT_SEVERITY', 'PF_FIT_SEVERITY', 'Perfect Fit Fit Severity'),
    ('SIZE_SYSTEM', 'PF_SIZE_SYSTEM', 'Perfect Fit Size System'),
    ('VARIANT_STATUS', 'PF_VARIANT_STATUS', 'Perfect Fit Style Variant Status'),
    ('BASE_REFERENCE_SIZE', 'PF_BASE_REFERENCE_SIZE', 'Perfect Fit Base Reference Size'),
    ('CHANGE_INITIATOR', 'PF_CHANGE_INITIATOR', 'Perfect Fit Change Initiator'),
    ('CHANGE_OPERATION', 'PF_CHANGE_OPERATION', 'Perfect Fit Change Operation'),
    ('PATTERN_SOURCE_PROVIDER', 'PF_PATTERN_SOURCE_PROVIDER', 'Perfect Fit Pattern Source Provider'),
    ('PATTERN_TECHNICAL_TYPE', 'PF_PATTERN_TECHNICAL_TYPE', 'Perfect Fit Pattern Technical Type'),
    ('PATTERN_FILE_STATUS', 'PF_PATTERN_FILE_STATUS', 'Perfect Fit Pattern File Status')
)
INSERT INTO eip_core.dropdown_list
  (tenant_id, module, code, name, version, is_active, attrs)
SELECT
  t.id,
  'perfect_fit',
  s.db_code,
  s.name,
  1,
  true,
  jsonb_build_object(
    'application', 'perfect_fit',
    'logical_code', s.logical_code,
    'authority', 'EIP_DB',
    'managed_by', 'eip_governance',
    'seed_migration', '0144'
  )
FROM pf_tenants t
CROSS JOIN list_seed s
ON CONFLICT (tenant_id, module, code, version) DO UPDATE
SET name = EXCLUDED.name,
    is_active = true,
    attrs = COALESCE(eip_core.dropdown_list.attrs, '{}'::jsonb) || EXCLUDED.attrs,
    updated_at = now();

-- ---------------------------------------------------------------------
-- 2) Seed the full currently-used Perfect Fit workspace controlled values.
--    Stable codes are runtime values; labels remain presentation values.
-- ---------------------------------------------------------------------
WITH pf_tenants AS (
  SELECT DISTINCT t.id
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
    )
), list_map(logical_code, db_code) AS (
  VALUES
    ('PROJECT_STATUS', 'PF_PROJECT_STATUS'),
    ('PRODUCT_DEVELOPMENT_STAGE', 'PF_PRODUCT_DEVELOPMENT_STAGE'),
    ('GARMENT_CATEGORY', 'PF_GARMENT_CATEGORY'),
    ('DIFFICULTY_LEVEL', 'PF_DIFFICULTY_LEVEL'),
    ('FIT_SILHOUETTE', 'PF_FIT_SILHOUETTE'),
    ('STANDARD_FIT_CATEGORY', 'PF_STANDARD_FIT_CATEGORY'),
    ('FIT_PRIORITY', 'PF_FIT_PRIORITY'),
    ('FIT_RESULT', 'PF_FIT_RESULT'),
    ('FIT_ISSUE', 'PF_FIT_ISSUE'),
    ('FIT_SEVERITY', 'PF_FIT_SEVERITY'),
    ('SIZE_SYSTEM', 'PF_SIZE_SYSTEM'),
    ('VARIANT_STATUS', 'PF_VARIANT_STATUS'),
    ('BASE_REFERENCE_SIZE', 'PF_BASE_REFERENCE_SIZE'),
    ('CHANGE_INITIATOR', 'PF_CHANGE_INITIATOR'),
    ('CHANGE_OPERATION', 'PF_CHANGE_OPERATION'),
    ('PATTERN_SOURCE_PROVIDER', 'PF_PATTERN_SOURCE_PROVIDER'),
    ('PATTERN_TECHNICAL_TYPE', 'PF_PATTERN_TECHNICAL_TYPE'),
    ('PATTERN_FILE_STATUS', 'PF_PATTERN_FILE_STATUS')
), seed_value(logical_code, code, label, sort_order) AS (
  VALUES
    ('PROJECT_STATUS','DRAFT','Draft',10),
    ('PROJECT_STATUS','ACTIVE','Active',20),
    ('PROJECT_STATUS','ARCHIVED','Archived',30),

    ('PRODUCT_DEVELOPMENT_STAGE','IDEA','Idea',10),
    ('PRODUCT_DEVELOPMENT_STAGE','DRAFTING','Drafting',20),
    ('PRODUCT_DEVELOPMENT_STAGE','SAMPLE_REVIEW','Sample review',30),
    ('PRODUCT_DEVELOPMENT_STAGE','APPROVED','Approved',40),
    ('PRODUCT_DEVELOPMENT_STAGE','ARCHIVED','Archived',50),

    ('GARMENT_CATEGORY','DRESS','Dress',10),
    ('GARMENT_CATEGORY','COAT','Coat',20),
    ('GARMENT_CATEGORY','TOP','Top',30),
    ('GARMENT_CATEGORY','SKIRT','Skirt',40),
    ('GARMENT_CATEGORY','TROUSER','Trouser',50),

    ('DIFFICULTY_LEVEL','BEGINNER','Beginner',10),
    ('DIFFICULTY_LEVEL','INTERMEDIATE','Intermediate',20),
    ('DIFFICULTY_LEVEL','ADVANCED','Advanced',30),

    ('FIT_SILHOUETTE','FITTED','Fitted',10),
    ('FIT_SILHOUETTE','SEMI_FITTED','Semi-fitted',20),
    ('FIT_SILHOUETTE','REGULAR','Regular',30),
    ('FIT_SILHOUETTE','RELAXED','Relaxed',40),
    ('FIT_SILHOUETTE','OVERSIZED','Oversized',50),
    ('FIT_SILHOUETTE','A_LINE','A-line',60),

    ('STANDARD_FIT_CATEGORY','DRESS','Dress',10),
    ('STANDARD_FIT_CATEGORY','TOP_BLOUSE_SHIRT','Top / blouse / shirt',20),
    ('STANDARD_FIT_CATEGORY','JACKET_COAT','Jacket / coat',30),
    ('STANDARD_FIT_CATEGORY','SKIRT','Skirt',40),
    ('STANDARD_FIT_CATEGORY','TROUSER_SHORTS','Trouser / shorts',50),
    ('STANDARD_FIT_CATEGORY','ONE_PIECE','Jumpsuit / one-piece',60),

    ('FIT_PRIORITY','CRITICAL','Critical',10),
    ('FIT_PRIORITY','IMPORTANT','Important',20),
    ('FIT_PRIORITY','SECONDARY','Secondary',30),
    ('FIT_PRIORITY','NOT_RELEVANT','Not relevant',40),

    ('FIT_RESULT','UNASSESSED','Not assessed',10),
    ('FIT_RESULT','TOO_TIGHT','Too tight',20),
    ('FIT_RESULT','SLIGHTLY_TIGHT','Slightly tight',30),
    ('FIT_RESULT','GOOD','Good',40),
    ('FIT_RESULT','SLIGHTLY_LOOSE','Slightly loose',50),
    ('FIT_RESULT','TOO_LOOSE','Too loose',60),

    ('FIT_ISSUE','NONE','None',10),
    ('FIT_ISSUE','PULLING','Pulling',20),
    ('FIT_ISSUE','GAPING','Gaping',30),
    ('FIT_ISSUE','RESTRICTION','Restriction',40),
    ('FIT_ISSUE','EXCESS_EASE','Excess ease',50),
    ('FIT_ISSUE','DRAG_LINES','Drag lines',60),
    ('FIT_ISSUE','BALANCE','Balance',70),
    ('FIT_ISSUE','LENGTH','Length',80),
    ('FIT_ISSUE','OTHER','Other',90),

    ('FIT_SEVERITY','NONE','None',10),
    ('FIT_SEVERITY','MINOR','Minor',20),
    ('FIT_SEVERITY','MODERATE','Moderate',30),
    ('FIT_SEVERITY','CRITICAL','Critical',40),

    ('SIZE_SYSTEM','US','US',10),
    ('SIZE_SYSTEM','UK','UK',20),
    ('SIZE_SYSTEM','EU','EU',30),
    ('SIZE_SYSTEM','ALPHA','Alpha',40),

    ('VARIANT_STATUS','DEVELOPMENT','In development',10),
    ('VARIANT_STATUS','FIT_REVIEW','Fit review',20),
    ('VARIANT_STATUS','APPROVED','Approved',30),
    ('VARIANT_STATUS','ARCHIVED','Archived',40),

    ('BASE_REFERENCE_SIZE','XS','XS',10),
    ('BASE_REFERENCE_SIZE','S','S',20),
    ('BASE_REFERENCE_SIZE','M','M',30),
    ('BASE_REFERENCE_SIZE','L','L',40),
    ('BASE_REFERENCE_SIZE','XL','XL',50),
    ('BASE_REFERENCE_SIZE','34','34',60),
    ('BASE_REFERENCE_SIZE','36','36',70),
    ('BASE_REFERENCE_SIZE','38','38',80),
    ('BASE_REFERENCE_SIZE','40','40',90),
    ('BASE_REFERENCE_SIZE','42','42',100),
    ('BASE_REFERENCE_SIZE','44','44',110),
    ('BASE_REFERENCE_SIZE','8','8',120),
    ('BASE_REFERENCE_SIZE','10','10',130),
    ('BASE_REFERENCE_SIZE','12','12',140),
    ('BASE_REFERENCE_SIZE','14','14',150),
    ('BASE_REFERENCE_SIZE','16','16',160),

    ('CHANGE_INITIATOR','DESIGNER','Designer',10),
    ('CHANGE_INITIATOR','GARMENT_TECHNICIAN','Garment technician',20),
    ('CHANGE_INITIATOR','PATTERN_MAKER','Pattern maker',30),
    ('CHANGE_INITIATOR','PRODUCTION_TEAM','Production team',40),
    ('CHANGE_INITIATOR','QUALITY','Quality',50),
    ('CHANGE_INITIATOR','FIT_TEST','Fit test',60),
    ('CHANGE_INITIATOR','CUSTOMER_FEEDBACK','Customer feedback',70),
    ('CHANGE_INITIATOR','SAMPLE_REVIEW','Sample review',80),
    ('CHANGE_INITIATOR','SUPPLIER','Supplier',90),
    ('CHANGE_INITIATOR','COMPLIANCE','Compliance',100),
    ('CHANGE_INITIATOR','OTHER','Other',110),

    ('CHANGE_OPERATION','CREATE','Created',10),
    ('CHANGE_OPERATION','UPDATE','Changed',20),
    ('CHANGE_OPERATION','DELETE','Deleted',30),

    ('PATTERN_SOURCE_PROVIDER','MANUAL_UNSPECIFIED','Manual / Unspecified',10),
    ('PATTERN_SOURCE_PROVIDER','CLO','CLO',20),
    ('PATTERN_SOURCE_PROVIDER','GERBER_ACCUMARK','Gerber / AccuMark',30),
    ('PATTERN_SOURCE_PROVIDER','RICHPEACE','Richpeace',40),
    ('PATTERN_SOURCE_PROVIDER','OPTITEX','Optitex',50),
    ('PATTERN_SOURCE_PROVIDER','LECTRA','Lectra',60),
    ('PATTERN_SOURCE_PROVIDER','OTHER','Other',70),

    ('PATTERN_TECHNICAL_TYPE','CLO_PROJECT_ZPRJ','CLO Project .zprj',10),
    ('PATTERN_TECHNICAL_TYPE','CLO_GARMENT_ZPAC','CLO Garment .zpac',20),
    ('PATTERN_TECHNICAL_TYPE','CLO_PATTERN_PACX','CLO Pattern .pacx',30),
    ('PATTERN_TECHNICAL_TYPE','DXF_AAMA','DXF-AAMA',40),
    ('PATTERN_TECHNICAL_TYPE','DXF_ASTM','DXF-ASTM',50),
    ('PATTERN_TECHNICAL_TYPE','AI','Adobe Illustrator .ai',60),
    ('PATTERN_TECHNICAL_TYPE','PDF_A0','PDF · A0',70),
    ('PATTERN_TECHNICAL_TYPE','PDF_A4_TILED','PDF · A4 tiled',80),
    ('PATTERN_TECHNICAL_TYPE','PDF_LETTER_TILED','PDF · Letter tiled',90),
    ('PATTERN_TECHNICAL_TYPE','PDF_PROJECTOR','PDF · Projector',100),
    ('PATTERN_TECHNICAL_TYPE','PNG_1_TO_1_REFERENCE','PNG 1:1 reference',110),
    ('PATTERN_TECHNICAL_TYPE','ZIP','ZIP',120),
    ('PATTERN_TECHNICAL_TYPE','OTHER','Other',130),

    ('PATTERN_FILE_STATUS','DRAFT','Draft',10),
    ('PATTERN_FILE_STATUS','IN_REVIEW','In Review',20),
    ('PATTERN_FILE_STATUS','APPROVED','Approved',30),
    ('PATTERN_FILE_STATUS','SUPERSEDED','Superseded',40)
), pf_lists AS (
  SELECT dl.id, lm.logical_code
  FROM eip_core.dropdown_list dl
  JOIN pf_tenants t ON t.id = dl.tenant_id
  JOIN list_map lm ON lm.db_code = dl.code
  WHERE dl.module = 'perfect_fit'
    AND dl.version = 1
    AND dl.is_active = true
)
INSERT INTO eip_core.dropdown_value
  (list_id, code, label, sort_order, is_active, attrs)
SELECT
  l.id,
  v.code,
  v.label,
  v.sort_order,
  true,
  jsonb_build_object('application', 'perfect_fit', 'authority', 'EIP_DB', 'seed_migration', '0144')
FROM pf_lists l
JOIN seed_value v ON v.logical_code = l.logical_code
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    attrs = COALESCE(eip_core.dropdown_value.attrs, '{}'::jsonb) || EXCLUDED.attrs,
    updated_at = now();

-- ---------------------------------------------------------------------
-- 3) Publish DB-backed Perfect Fit workspace metadata.
--    Existing manually-created PERFECT_FIT manifests are never overwritten.
-- ---------------------------------------------------------------------
WITH pf_tenants AS (
  SELECT DISTINCT t.id
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
    )
), seed_manifest AS (
  SELECT $pfjson$
  {
    "application": "perfect_fit",
    "workspace": {
      "version": "2026-09-05-db-workspace-v1",
      "dropdownBindings": {
        "PROJECT_STATUS": "PF_PROJECT_STATUS",
        "PRODUCT_DEVELOPMENT_STAGE": "PF_PRODUCT_DEVELOPMENT_STAGE",
        "GARMENT_CATEGORY": "PF_GARMENT_CATEGORY",
        "DIFFICULTY_LEVEL": "PF_DIFFICULTY_LEVEL",
        "FIT_SILHOUETTE": "PF_FIT_SILHOUETTE",
        "STANDARD_FIT_CATEGORY": "PF_STANDARD_FIT_CATEGORY",
        "FIT_PRIORITY": "PF_FIT_PRIORITY",
        "FIT_RESULT": "PF_FIT_RESULT",
        "FIT_ISSUE": "PF_FIT_ISSUE",
        "FIT_SEVERITY": "PF_FIT_SEVERITY",
        "SIZE_SYSTEM": "PF_SIZE_SYSTEM",
        "VARIANT_STATUS": "PF_VARIANT_STATUS",
        "BASE_REFERENCE_SIZE": "PF_BASE_REFERENCE_SIZE",
        "CHANGE_INITIATOR": "PF_CHANGE_INITIATOR",
        "CHANGE_OPERATION": "PF_CHANGE_OPERATION",
        "PATTERN_SOURCE_PROVIDER": "PF_PATTERN_SOURCE_PROVIDER",
        "PATTERN_TECHNICAL_TYPE": "PF_PATTERN_TECHNICAL_TYPE",
        "PATTERN_FILE_STATUS": "PF_PATTERN_FILE_STATUS"
      },
      "fields": {
        "project.name": {"key":"project.name","labelKey":"fields.project.name.label","type":"text","allowFreeText":true,"usedAsEipParameter":false},
        "project.designer_code": {"key":"project.designer_code","labelKey":"fields.project.designerCode.label","helpKey":"fields.project.designerCode.help","type":"text","allowFreeText":false,"readOnly":true,"usedAsEipParameter":true},
        "project.season": {"key":"project.season","labelKey":"fields.project.season.label","type":"text","allowFreeText":true,"usedAsEipParameter":false},
        "project.status": {"key":"project.status","labelKey":"fields.project.status.label","type":"select","governanceList":"PROJECT_STATUS","allowFreeText":false,"usedAsEipParameter":false},

        "product.style_name": {"key":"product.style_name","labelKey":"fields.product.styleName.label","type":"text","allowFreeText":true,"usedAsEipParameter":true},
        "product.style_code": {"key":"product.style_code","labelKey":"fields.product.styleCode.label","type":"text","allowFreeText":false,"readOnly":true,"usedAsEipParameter":true},
        "product.category": {"key":"product.category","labelKey":"fields.product.category.label","type":"select","governanceList":"GARMENT_CATEGORY","allowFreeText":false,"usedAsEipParameter":true},
        "product.development_stage": {"key":"product.development_stage","labelKey":"fields.product.developmentStage.label","type":"select","governanceList":"PRODUCT_DEVELOPMENT_STAGE","allowFreeText":false,"usedAsEipParameter":true},
        "product.difficulty": {"key":"product.difficulty","labelKey":"fields.product.difficulty.label","type":"select","governanceList":"DIFFICULTY_LEVEL","allowFreeText":false,"usedAsEipParameter":true},
        "product.fit_silhouette": {"key":"product.fit_silhouette","labelKey":"fields.product.fitSilhouette.label","type":"select","governanceList":"FIT_SILHOUETTE","allowFreeText":false,"usedAsEipParameter":true},
        "product.description": {"key":"product.description","labelKey":"fields.product.description.label","type":"textarea","rows":5,"allowFreeText":true,"usedAsEipParameter":true},

        "variant.name": {"key":"variant.name","labelKey":"fields.variant.name.label","type":"text","allowFreeText":true,"usedAsEipParameter":true},
        "variant.code": {"key":"variant.code","labelKey":"fields.variant.code.label","type":"text","allowFreeText":false,"readOnly":true,"usedAsEipParameter":true},
        "variant.status": {"key":"variant.status","labelKey":"fields.variant.status.label","type":"select","governanceList":"VARIANT_STATUS","allowFreeText":false,"usedAsEipParameter":true},
        "variant.size_system": {"key":"variant.size_system","labelKey":"fields.variant.sizeSystem.label","type":"select","governanceList":"SIZE_SYSTEM","allowFreeText":false,"usedAsEipParameter":true},
        "variant.base_reference_size": {"key":"variant.base_reference_size","labelKey":"fields.variant.baseReferenceSize.label","helpKey":"fields.variant.baseReferenceSize.help","type":"select","governanceList":"BASE_REFERENCE_SIZE","allowFreeText":false,"usedAsEipParameter":true},
        "variant.notes": {"key":"variant.notes","labelKey":"fields.variant.notes.label","type":"textarea","rows":4,"allowFreeText":true,"usedAsEipParameter":true}
      },
      "fieldGroups": {
        "projectIdentity": {"labelKey":"group.projectIdentity.title","fields":["project.name","project.designer_code","project.season","project.status"]},
        "styleIdentity": {"labelKey":"group.styleIdentity.title","fields":["product.style_name","product.style_code","product.category","product.description"]},
        "styleDevelopment": {"labelKey":"group.styleDevelopment.title","fields":["product.development_stage","product.difficulty","product.fit_silhouette"]},
        "variantIdentity": {"labelKey":"group.variantIdentity.title","fields":["variant.name","variant.code","variant.status","variant.notes"]},
        "variantReference": {"labelKey":"group.variantReference.title","fields":["variant.size_system","variant.base_reference_size"]}
      },
      "structure": {
        "rootType": "workspace",
        "productHierarchy": {
          "levels": [
            {"level":"STYLE","nodeType":"product","parentLevel":"PROJECT"},
            {"level":"STYLE_VARIANT","nodeType":"variant","parentLevel":"STYLE"},
            {"level":"SIZE_VARIANT","nodeType":"measurement_chart_size","parentLevel":"STYLE_VARIANT"}
          ]
        },
        "treeTypes": {
          "project": {"labelKey":"node.project","icon":"project","titleField":"project.name","children":["product"]},
          "product": {"labelKey":"node.product","icon":"product","titleField":"product.style_name","children":["variant"]},
          "variant": {"labelKey":"node.variant","navigationLabelKey":"nav.variantOverview","icon":"variant","titleField":"variant.name","children":["projectJournal","media","patternLibrary","sizeSet","sewing","techpack","changeHistory"]},
          "projectJournal": {"labelKey":"node.projectJournal","descriptionKey":"module.projectJournal.description","icon":"projectJournal","componentKey":"projectJournal","showInTree":false,"children":[]},
          "media": {"labelKey":"node.media","descriptionKey":"module.media.description","icon":"media","componentKey":"media","showInTree":false,"children":[]},
          "patternLibrary": {"labelKey":"node.patternLibrary","descriptionKey":"module.patternLibrary.description","icon":"patternLibrary","componentKey":"patternLibrary","showInTree":false,"children":[]},
          "sizeSet": {"labelKey":"node.sizeSet","descriptionKey":"module.sizeSet.description","icon":"sizeSet","componentKey":"sizeSet","showInTree":false,"children":[]},
          "sewing": {"labelKey":"node.sewing","descriptionKey":"module.sewing.description","icon":"sewing","componentKey":"sewing","showInTree":false,"children":[]},
          "techpack": {"labelKey":"node.techpack","descriptionKey":"module.techpack.description","icon":"techpack","componentKey":"techPack","showInTree":false,"children":[]},
          "changeHistory": {"labelKey":"node.changeHistory","descriptionKey":"module.changeHistory.description","icon":"changeHistory","componentKey":"changeHistory","showInTree":false,"children":[]}
        },
        "panels": {
          "project": {"fieldGroups":["projectIdentity"]},
          "product": {"fieldGroups":["styleIdentity","styleDevelopment"]},
          "variant": {"fieldGroups":["variantIdentity","variantReference"]}
        }
      },
      "referenceConvention": {
        "designerCodeField": "project.designer_code",
        "styleCodeField": "product.style_code",
        "variantCodeField": "variant.code",
        "separator": "-"
      }
    }
  }
  $pfjson$::jsonb AS payload
)
INSERT INTO eip_commerce.socket_manifest
  (tenant_id, code, version, is_published, published_at, manifest, attrs)
SELECT
  t.id,
  'PERFECT_FIT',
  1,
  true,
  now(),
  s.payload,
  jsonb_build_object(
    'application', 'perfect_fit',
    'authority', 'EIP_DB',
    'metadata_scope', 'workspace_runtime',
    'seed_migration', '0144'
  )
FROM pf_tenants t
CROSS JOIN seed_manifest s
WHERE NOT EXISTS (
  SELECT 1
  FROM eip_commerce.socket_manifest existing
  WHERE existing.tenant_id = t.id
    AND existing.code = 'PERFECT_FIT'
);

-- ---------------------------------------------------------------------
-- 4) Seed only obvious current PF logical field aliases. Ambiguous fields stay
--    visible to manifest completeness/admin review; they are not guessed.
-- ---------------------------------------------------------------------
WITH pf_tenants AS (
  SELECT DISTINCT t.id
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
    )
), alias_seed(alias_code, canonical_code) AS (
  VALUES
    ('product.style_name', 'product.name'),
    ('product.style_code', 'product.code'),
    ('product.category', 'product.category'),
    ('product.description', 'attrs.product_description'),
    ('project.designer_code', 'attrs.designer_code'),
    ('variant.code', 'attrs.variant_code')
)
INSERT INTO eip_commerce.socket_alias_map
  (tenant_id, map_kind, alias_code, canonical_code, attrs, is_active)
SELECT
  t.id,
  'FIELD',
  a.alias_code,
  a.canonical_code,
  jsonb_build_object(
    'application', 'perfect_fit',
    'authority', 'EIP_DB',
    'seed_migration', '0144'
  ),
  true
FROM pf_tenants t
CROSS JOIN alias_seed a
WHERE NOT EXISTS (
  SELECT 1
  FROM eip_commerce.socket_alias_map existing
  WHERE existing.tenant_id = t.id
    AND existing.map_kind = 'FIELD'
    AND existing.alias_code = a.alias_code
    AND existing.is_active = true
);

-- ---------------------------------------------------------------------
-- 5) Align existing kernel governance with already-used Product Studio values.
-- ---------------------------------------------------------------------
WITH material_type_list AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE tenant_id IS NULL
    AND module = 'core'
    AND code = 'MATERIAL_TYPE'
    AND version = 1
    AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1
)
INSERT INTO eip_core.dropdown_value
  (list_id, code, label, sort_order, is_active, attrs)
SELECT
  id,
  'PRODUCT',
  'Product',
  80,
  true,
  '{"module":"ecom","purpose":"canonical_product_material","seed_migration":"0144"}'::jsonb
FROM material_type_list
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    is_active = true,
    attrs = COALESCE(eip_core.dropdown_value.attrs, '{}'::jsonb) || EXCLUDED.attrs,
    updated_at = now();

WITH relation_list AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE tenant_id IS NULL
    AND module = 'core'
    AND code = 'LINK_RELATION_TYPE'
    AND version = 1
    AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1
)
INSERT INTO eip_core.dropdown_value
  (list_id, code, label, sort_order, is_active, attrs)
SELECT
  id,
  'STYLE_VARIANT_OF',
  'Style variant of',
  245,
  true,
  '{"module":"perfect_fit","src_kind":"material","dst_kind":"material","seed_migration":"0144"}'::jsonb
FROM relation_list
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    is_active = true,
    attrs = COALESCE(eip_core.dropdown_value.attrs, '{}'::jsonb) || EXCLUDED.attrs,
    updated_at = now();

COMMIT;
