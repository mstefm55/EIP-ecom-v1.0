-- 0150_perfect_fit_controlled_vocabulary_completion.sql
-- Purpose:
--   Complete EIP governance for persisted Perfect Fit controlled choices that
--   still lived only in frontend metadata after 0144-0149.
--
-- Rules:
--   - reuse eip_core.dropdown_list / dropdown_value
--   - do not duplicate process-engine lifecycle state as dropdowns
--   - free text, numeric measurements, files/media binaries and notes remain
--     typed data, not artificial dropdowns
--   - publish a versioned successor PERFECT_FIT manifest
--
-- Historical migrations are intentionally not modified.

BEGIN;

CREATE TEMP TABLE _pf_0150_tenants ON COMMIT DROP AS
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

WITH list_seed(logical_code, db_code, name) AS (
  VALUES
    ('MEDIA_ASSET_TYPE','PF_MEDIA_ASSET_TYPE','Perfect Fit Media Asset Type'),
    ('MEDIA_ASSET_ROLE','PF_MEDIA_ASSET_ROLE','Perfect Fit Media Asset Role'),
    ('MEDIA_PROFILE','PF_MEDIA_PROFILE','Perfect Fit Media Processing Profile'),
    ('TIME_STUDY_MODE','PF_TIME_STUDY_MODE','Perfect Fit Time Study Mode'),
    ('TIME_SEQUENCE_MODE','PF_TIME_SEQUENCE_MODE','Perfect Fit Time Study Sequence Mode'),
    ('TIME_RECORDING_MODE','PF_TIME_RECORDING_MODE','Perfect Fit Time Recording Mode'),
    ('TIME_ANNOTATION_TYPE','PF_TIME_ANNOTATION_TYPE','Perfect Fit Time Study Annotation Type'),
    ('COLLAB_SCOPE','PF_COLLAB_SCOPE','Perfect Fit Collaboration Scope'),
    ('COLLAB_DURATION','PF_COLLAB_DURATION','Perfect Fit Collaboration Duration'),
    ('COLLAB_POLICY','PF_COLLAB_POLICY','Perfect Fit Collaboration Policy'),
    ('COLLAB_ROLE','PF_COLLAB_ROLE','Perfect Fit Collaboration Role'),
    ('COLLAB_PERMISSION','PF_COLLAB_PERMISSION','Perfect Fit Collaboration Permission'),
    ('MATERIAL_UOM','PF_MATERIAL_UOM','Perfect Fit Material Unit of Measure'),
    ('MATERIAL_CURRENCY','PF_MATERIAL_CURRENCY','Perfect Fit Material Currency'),
    ('MATERIAL_INCOMING_STATUS','PF_MATERIAL_INCOMING_STATUS','Perfect Fit Incoming Material Status'),
    ('MATERIAL_ISSUE_TYPE','PF_MATERIAL_ISSUE_TYPE','Perfect Fit Material Issue Type'),
    ('MESSAGE_TYPE','PF_MESSAGE_TYPE','Perfect Fit Message Type'),
    ('AVATAR_GENDER','PF_AVATAR_GENDER','Perfect Fit Avatar Gender'),
    ('AVATAR_AGE_GROUP','PF_AVATAR_AGE_GROUP','Perfect Fit Avatar Age Group'),
    ('MEASUREMENT_UNIT','PF_MEASUREMENT_UNIT','Perfect Fit Measurement Unit'),
    ('TECHPACK_SEQUENCE_MODE','PF_TECHPACK_SEQUENCE_MODE','Perfect Fit Tech Pack Sequence Mode'),
    ('TECHPACK_REFERENCE_TYPE','PF_TECHPACK_REFERENCE_TYPE','Perfect Fit Tech Pack Reference Type')
)
INSERT INTO eip_core.dropdown_list
  (tenant_id, module, code, name, version, is_active, attrs)
SELECT
  t.tenant_id,
  'perfect_fit',
  s.db_code,
  s.name,
  1,
  true,
  jsonb_build_object(
    'application','perfect_fit',
    'logical_code',s.logical_code,
    'authority','EIP_DB',
    'managed_by','eip_governance',
    'seed_migration','0150'
  )
FROM _pf_0150_tenants t
CROSS JOIN list_seed s
ON CONFLICT (tenant_id, module, code, version) DO UPDATE
SET name = EXCLUDED.name,
    is_active = true,
    attrs = COALESCE(eip_core.dropdown_list.attrs, '{}'::jsonb) || EXCLUDED.attrs,
    updated_at = now();

WITH list_map(logical_code, db_code) AS (
  VALUES
    ('MEDIA_ASSET_TYPE','PF_MEDIA_ASSET_TYPE'),
    ('MEDIA_ASSET_ROLE','PF_MEDIA_ASSET_ROLE'),
    ('MEDIA_PROFILE','PF_MEDIA_PROFILE'),
    ('TIME_STUDY_MODE','PF_TIME_STUDY_MODE'),
    ('TIME_SEQUENCE_MODE','PF_TIME_SEQUENCE_MODE'),
    ('TIME_RECORDING_MODE','PF_TIME_RECORDING_MODE'),
    ('TIME_ANNOTATION_TYPE','PF_TIME_ANNOTATION_TYPE'),
    ('COLLAB_SCOPE','PF_COLLAB_SCOPE'),
    ('COLLAB_DURATION','PF_COLLAB_DURATION'),
    ('COLLAB_POLICY','PF_COLLAB_POLICY'),
    ('COLLAB_ROLE','PF_COLLAB_ROLE'),
    ('COLLAB_PERMISSION','PF_COLLAB_PERMISSION'),
    ('MATERIAL_UOM','PF_MATERIAL_UOM'),
    ('MATERIAL_CURRENCY','PF_MATERIAL_CURRENCY'),
    ('MATERIAL_INCOMING_STATUS','PF_MATERIAL_INCOMING_STATUS'),
    ('MATERIAL_ISSUE_TYPE','PF_MATERIAL_ISSUE_TYPE'),
    ('MESSAGE_TYPE','PF_MESSAGE_TYPE'),
    ('AVATAR_GENDER','PF_AVATAR_GENDER'),
    ('AVATAR_AGE_GROUP','PF_AVATAR_AGE_GROUP'),
    ('MEASUREMENT_UNIT','PF_MEASUREMENT_UNIT'),
    ('TECHPACK_SEQUENCE_MODE','PF_TECHPACK_SEQUENCE_MODE'),
    ('TECHPACK_REFERENCE_TYPE','PF_TECHPACK_REFERENCE_TYPE')
), seed_value(logical_code, code, label, sort_order, attrs) AS (
  VALUES
    ('MEDIA_ASSET_TYPE','GARMENT_SAMPLE','Garment Sample',10,'{}'::jsonb),
    ('MEDIA_ASSET_TYPE','TECHNICAL_SKETCH','Technical Sketch',20,'{}'::jsonb),
    ('MEDIA_ASSET_TYPE','PATTERN_PREVIEW','Pattern Preview',30,'{}'::jsonb),
    ('MEDIA_ASSET_TYPE','DETAIL','Construction Detail',40,'{}'::jsonb),
    ('MEDIA_ASSET_TYPE','PROTOTYPE','Prototype',50,'{}'::jsonb),
    ('MEDIA_ASSET_TYPE','REFERENCE','Reference',60,'{}'::jsonb),

    ('MEDIA_ASSET_ROLE','PRIMARY','Primary',10,'{"slotKey":"primaryAssetId","icon":"star","allowClear":false,"forcesCustomerVisible":true}'::jsonb),
    ('MEDIA_ASSET_ROLE','TECHNICAL_SKETCH','Technical Sketch',20,'{"slotKey":"technicalSketchAssetId","icon":"technicalSketch","allowClear":true,"forcesCustomerVisible":false,"forceType":"TECHNICAL_SKETCH"}'::jsonb),
    ('MEDIA_ASSET_ROLE','PATTERN_PREVIEW','Pattern Preview',30,'{"slotKey":"patternAssetId","icon":"pattern","allowClear":true,"forcesCustomerVisible":true,"forceType":"PATTERN_PREVIEW"}'::jsonb),

    ('MEDIA_PROFILE','product-card','Product card',10,'{"width":1200,"height":1500,"fitMode":"cover","mimeType":"image/jpeg","quality":92,"backgroundColor":"#f4f1eb"}'::jsonb),
    ('MEDIA_PROFILE','product-gallery','Product gallery',20,'{"width":1400,"height":1750,"fitMode":"cover","mimeType":"image/jpeg","quality":92,"backgroundColor":"#f4f1eb"}'::jsonb),
    ('MEDIA_PROFILE','hero-banner','Hero banner',30,'{"width":1920,"height":1080,"fitMode":"cover","mimeType":"image/jpeg","quality":90,"backgroundColor":"#f4f1eb"}'::jsonb),
    ('MEDIA_PROFILE','blog-cover','Blog cover',40,'{"width":1800,"height":1200,"fitMode":"cover","mimeType":"image/jpeg","quality":90,"backgroundColor":"#f4f1eb"}'::jsonb),
    ('MEDIA_PROFILE','content-block','Content block',50,'{"width":1600,"height":1200,"fitMode":"cover","mimeType":"image/jpeg","quality":90,"backgroundColor":"#f4f1eb"}'::jsonb),

    ('TIME_STUDY_MODE','VIDEO','Video study',10,'{}'::jsonb),
    ('TIME_STUDY_MODE','STOPWATCH','Live stopwatch',20,'{}'::jsonb),
    ('TIME_SEQUENCE_MODE','SEQUENCE','Sequence study',10,'{}'::jsonb),
    ('TIME_SEQUENCE_MODE','REPEAT','Repeated cycle study',20,'{}'::jsonb),
    ('TIME_RECORDING_MODE','FULL_STUDY','One full study recording',10,'{}'::jsonb),
    ('TIME_RECORDING_MODE','OPERATION_CLIPS','Clip per operation',20,'{}'::jsonb),
    ('TIME_ANNOTATION_TYPE','PRODUCTIVE','Productive work',10,'{}'::jsonb),
    ('TIME_ANNOTATION_TYPE','HANDLING','Handling',20,'{}'::jsonb),
    ('TIME_ANNOTATION_TYPE','PREPARATION','Preparation / setup',30,'{}'::jsonb),
    ('TIME_ANNOTATION_TYPE','INSPECTION','Inspection',40,'{}'::jsonb),
    ('TIME_ANNOTATION_TYPE','DELAY','Delay',50,'{}'::jsonb),
    ('TIME_ANNOTATION_TYPE','PERSONAL','Personal',60,'{}'::jsonb),
    ('TIME_ANNOTATION_TYPE','MACHINE_DELAY','Machine delay',70,'{}'::jsonb),
    ('TIME_ANNOTATION_TYPE','MATERIAL_DELAY','Material delay',80,'{}'::jsonb),
    ('TIME_ANNOTATION_TYPE','OTHER','Other',90,'{}'::jsonb),

    ('COLLAB_SCOPE','PROJECT','Project',10,'{"nodeType":"project"}'::jsonb),
    ('COLLAB_SCOPE','STYLE','Style',20,'{"nodeType":"product"}'::jsonb),
    ('COLLAB_SCOPE','VARIANT','Variant',30,'{"nodeType":"variant"}'::jsonb),
    ('COLLAB_DURATION','PERMANENT','Permanent until revoked',10,'{}'::jsonb),
    ('COLLAB_DURATION','FIXED','Fixed duration',20,'{}'::jsonb),
    ('COLLAB_POLICY','DIRECT','Direct editing',10,'{}'::jsonb),
    ('COLLAB_POLICY','APPROVAL_REQUIRED','Changes require approval',20,'{}'::jsonb),
    ('COLLAB_POLICY','REVIEW_ONLY','Review / comment only',30,'{}'::jsonb),
    ('COLLAB_ROLE','CO_DESIGNER','Co-designer',10,'{"defaultPermission":"EDIT"}'::jsonb),
    ('COLLAB_ROLE','CONTRIBUTOR','Contributor',20,'{"defaultPermission":"EDIT"}'::jsonb),
    ('COLLAB_ROLE','REVIEWER','Reviewer',30,'{"defaultPermission":"VIEW"}'::jsonb),
    ('COLLAB_ROLE','VIEWER','Viewer',40,'{"defaultPermission":"VIEW"}'::jsonb),
    ('COLLAB_PERMISSION','EDIT','Edit',10,'{}'::jsonb),
    ('COLLAB_PERMISSION','VIEW','View',20,'{}'::jsonb),
    ('COLLAB_PERMISSION','NONE','No access',30,'{}'::jsonb),

    ('MATERIAL_UOM','meters','metres',10,'{"shortLabel":"m","family":"length","toBase":1}'::jsonb),
    ('MATERIAL_UOM','yards','yards',20,'{"shortLabel":"yd","family":"length","toBase":0.9144}'::jsonb),
    ('MATERIAL_UOM','pieces','pieces',30,'{"shortLabel":"pc","family":"count","toBase":1}'::jsonb),
    ('MATERIAL_CURRENCY','USD','USD',10,'{"symbol":"$"}'::jsonb),
    ('MATERIAL_CURRENCY','EUR','EUR',20,'{"symbol":"€"}'::jsonb),
    ('MATERIAL_CURRENCY','GBP','GBP',30,'{"symbol":"£"}'::jsonb),
    ('MATERIAL_INCOMING_STATUS','ORDERED','Ordered',10,'{}'::jsonb),
    ('MATERIAL_INCOMING_STATUS','IN_TRANSIT','In transit',20,'{}'::jsonb),
    ('MATERIAL_INCOMING_STATUS','RECEIVED','Received',30,'{"terminal":true}'::jsonb),
    ('MATERIAL_INCOMING_STATUS','CANCELLED','Cancelled',40,'{"terminal":true}'::jsonb),
    ('MATERIAL_ISSUE_TYPE','ISSUE','Issue',10,'{}'::jsonb),
    ('MATERIAL_ISSUE_TYPE','CONSUME','Consume',20,'{}'::jsonb),

    ('MESSAGE_TYPE','DIRECT','Direct message',10,'{"editable":true}'::jsonb),
    ('MESSAGE_TYPE','WORKFLOW','Workflow',20,'{"editable":false,"systemManaged":true}'::jsonb),

    ('AVATAR_GENDER','FEMALE','Female',10,'{}'::jsonb),
    ('AVATAR_GENDER','MALE','Male',20,'{}'::jsonb),
    ('AVATAR_AGE_GROUP','ADULT','Adult',10,'{"ageRange":"18+"}'::jsonb),
    ('AVATAR_AGE_GROUP','TEEN','Teen (13–17)',20,'{"ageRange":"13–17"}'::jsonb),
    ('AVATAR_AGE_GROUP','KID','Child (5–12)',30,'{"ageRange":"5–12"}'::jsonb),
    ('MEASUREMENT_UNIT','cm','Centimetres',10,'{}'::jsonb),
    ('MEASUREMENT_UNIT','in','Inches',20,'{}'::jsonb),

    ('TECHPACK_SEQUENCE_MODE','NUMERIC','1 2 3',10,'{}'::jsonb),
    ('TECHPACK_SEQUENCE_MODE','ALPHA','A B C',20,'{}'::jsonb),
    ('TECHPACK_REFERENCE_TYPE','NONE','No linked reference',10,'{"source":null}'::jsonb),
    ('TECHPACK_REFERENCE_TYPE','CONSTRUCTION_STEP','Construction step',20,'{"source":"sewing.constructionSteps"}'::jsonb),
    ('TECHPACK_REFERENCE_TYPE','OPERATION','Manufacturing operation',30,'{"source":"sewing.operations"}'::jsonb),
    ('TECHPACK_REFERENCE_TYPE','MEASUREMENT','Measurement / POM',40,'{"source":"measurement.measurements"}'::jsonb)
), pf_lists AS (
  SELECT dl.id, lm.logical_code
  FROM eip_core.dropdown_list dl
  JOIN _pf_0150_tenants t ON t.tenant_id = dl.tenant_id
  JOIN list_map lm ON lm.db_code = dl.code
  WHERE dl.module='perfect_fit' AND dl.version=1 AND dl.is_active=true
)
INSERT INTO eip_core.dropdown_value
  (list_id, code, label, sort_order, is_active, attrs)
SELECT
  l.id, v.code, v.label, v.sort_order, true,
  v.attrs || jsonb_build_object('application','perfect_fit','authority','EIP_DB','seed_migration','0150')
FROM pf_lists l
JOIN seed_value v ON v.logical_code=l.logical_code
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label,
    sort_order=EXCLUDED.sort_order,
    is_active=true,
    attrs=COALESCE(eip_core.dropdown_value.attrs,'{}'::jsonb) || EXCLUDED.attrs,
    updated_at=now();

-- PF supports these display systems in Measurement Chart / size conversion.
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT dl.id, v.code, v.label, v.sort_order, true,
       jsonb_build_object('application','perfect_fit','authority','EIP_DB','seed_migration','0150')
FROM eip_core.dropdown_list dl
JOIN _pf_0150_tenants t ON t.tenant_id=dl.tenant_id
CROSS JOIN (VALUES ('FR','FR',50),('RU','RU',60)) AS v(code,label,sort_order)
WHERE dl.module='perfect_fit' AND dl.code='PF_SIZE_SYSTEM' AND dl.version=1 AND dl.is_active=true
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label,
    sort_order=EXCLUDED.sort_order,
    is_active=true,
    attrs=COALESCE(eip_core.dropdown_value.attrs,'{}'::jsonb) || EXCLUDED.attrs,
    updated_at=now();

-- Publish a successor manifest that tells the API which EIP lists own the
-- deeper PF controlled choices. Existing ordinary workspace field bindings
-- remain untouched.
WITH current_manifest AS (
  SELECT DISTINCT ON (sm.tenant_id)
    sm.id, sm.tenant_id, sm.code, sm.version, sm.manifest, sm.attrs
  FROM eip_commerce.socket_manifest sm
  JOIN _pf_0150_tenants t ON t.tenant_id=sm.tenant_id
  WHERE sm.code='PERFECT_FIT' AND sm.is_published=true
  ORDER BY sm.tenant_id, sm.version DESC, sm.updated_at DESC
), unpublished AS (
  UPDATE eip_commerce.socket_manifest sm
  SET is_published=false, updated_at=now()
  FROM current_manifest current
  WHERE sm.id=current.id
  RETURNING current.tenant_id,current.code,current.version,current.manifest,current.attrs
), patched AS (
  SELECT
    tenant_id,
    code,
    version + 1 AS next_version,
    jsonb_set(
      jsonb_set(
        manifest,
        '{workspace,version}',
        to_jsonb('2026-09-10-db-workspace-v5-controlled-governance'::text),
        true
      ),
      '{workspace,controlledBindings}',
      '{
        "MEDIA_ASSET_TYPE":"PF_MEDIA_ASSET_TYPE",
        "MEDIA_ASSET_ROLE":"PF_MEDIA_ASSET_ROLE",
        "MEDIA_PROFILE":"PF_MEDIA_PROFILE",
        "TIME_STUDY_MODE":"PF_TIME_STUDY_MODE",
        "TIME_SEQUENCE_MODE":"PF_TIME_SEQUENCE_MODE",
        "TIME_RECORDING_MODE":"PF_TIME_RECORDING_MODE",
        "TIME_ANNOTATION_TYPE":"PF_TIME_ANNOTATION_TYPE",
        "COLLAB_SCOPE":"PF_COLLAB_SCOPE",
        "COLLAB_DURATION":"PF_COLLAB_DURATION",
        "COLLAB_POLICY":"PF_COLLAB_POLICY",
        "COLLAB_ROLE":"PF_COLLAB_ROLE",
        "COLLAB_PERMISSION":"PF_COLLAB_PERMISSION",
        "MATERIAL_UOM":"PF_MATERIAL_UOM",
        "MATERIAL_CURRENCY":"PF_MATERIAL_CURRENCY",
        "MATERIAL_INCOMING_STATUS":"PF_MATERIAL_INCOMING_STATUS",
        "MATERIAL_ISSUE_TYPE":"PF_MATERIAL_ISSUE_TYPE",
        "MESSAGE_TYPE":"PF_MESSAGE_TYPE",
        "AVATAR_GENDER":"PF_AVATAR_GENDER",
        "AVATAR_AGE_GROUP":"PF_AVATAR_AGE_GROUP",
        "MEASUREMENT_UNIT":"PF_MEASUREMENT_UNIT",
        "TECHPACK_SEQUENCE_MODE":"PF_TECHPACK_SEQUENCE_MODE",
        "TECHPACK_REFERENCE_TYPE":"PF_TECHPACK_REFERENCE_TYPE"
      }'::jsonb,
      true
    ) AS manifest,
    COALESCE(attrs,'{}'::jsonb) || jsonb_build_object(
      'application','perfect_fit',
      'authority','EIP_DB',
      'metadata_scope','workspace_runtime',
      'controlled_vocabulary_completion',true,
      'seed_migration','0150'
    ) AS attrs
  FROM unpublished
)
INSERT INTO eip_commerce.socket_manifest
  (tenant_id, code, version, is_published, published_at, manifest, attrs)
SELECT tenant_id, code, next_version, true, now(), manifest, attrs
FROM patched;

COMMIT;
