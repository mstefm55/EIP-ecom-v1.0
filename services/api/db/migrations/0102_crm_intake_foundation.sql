-- CRM Intake foundation: sanitized intake facts, structured proposals, governed
-- review work, additive permissions, capability defaults, and descriptor tab.
-- No CRM-specific persistence tables are introduced.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.seed_crm_intake_dropdown(
  list_code text,
  list_name text,
  values_json jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  target_list_id uuid;
  item jsonb;
BEGIN
  SELECT id INTO target_list_id
  FROM eip_core.dropdown_list
  WHERE tenant_id IS NULL AND module='crm' AND code=list_code AND version=1
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_list_id IS NULL THEN
    INSERT INTO eip_core.dropdown_list
      (tenant_id, module, code, name, version, is_active, attrs)
    VALUES
      (NULL, 'crm', list_code, list_name, 1, true, '{"ui":{"module":"crm","area":"intake"}}'::jsonb)
    RETURNING id INTO target_list_id;
  ELSE
    UPDATE eip_core.dropdown_list
    SET name=list_name, is_active=true, updated_at=now()
    WHERE id=target_list_id;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(values_json)
  LOOP
    INSERT INTO eip_core.dropdown_value
      (list_id, code, label, sort_order, is_active, attrs)
    VALUES
      (
        target_list_id,
        item->>'code',
        item->>'label',
        COALESCE((item->>'sort_order')::integer, 100),
        true,
        COALESCE(item->'attrs', '{}'::jsonb)
      )
    ON CONFLICT (list_id, code) DO UPDATE
      SET label=EXCLUDED.label,
          sort_order=EXCLUDED.sort_order,
          is_active=true,
          attrs=EXCLUDED.attrs;
  END LOOP;
END;
$$;

SELECT pg_temp.seed_crm_intake_dropdown('CRM_INTAKE_SOURCE_TYPE', 'CRM Intake Source Type', '[
  {"code":"email","label":"Email","sort_order":10},
  {"code":"phone_call","label":"Phone call","sort_order":20},
  {"code":"webform","label":"Web form","sort_order":30},
  {"code":"social_message","label":"Social message","sort_order":40},
  {"code":"chat","label":"Chat","sort_order":50},
  {"code":"analytics_signal","label":"Analytics signal","sort_order":60},
  {"code":"payment_event","label":"Payment event","sort_order":70},
  {"code":"manual","label":"Manual","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_crm_intake_dropdown('CRM_INTAKE_PROPOSAL_STATUS', 'CRM Intake Proposal Status', '[
  {"code":"needs_review","label":"Needs review","sort_order":10},
  {"code":"approved","label":"Approved","sort_order":20},
  {"code":"ignored","label":"Ignored","sort_order":70},
  {"code":"converted","label":"Converted","sort_order":80},
  {"code":"failed","label":"Failed","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_crm_intake_dropdown('CRM_INTAKE_SUGGESTED_OBJECT_TYPE', 'CRM Intake Suggested Object Type', '[
  {"code":"CRM_LEAD","label":"Lead","sort_order":10},
  {"code":"CRM_OPPORTUNITY","label":"Opportunity","sort_order":20},
  {"code":"CRM_CASE","label":"Case","sort_order":30},
  {"code":"CRM_INTERACTION","label":"Interaction","sort_order":40},
  {"code":"CRM_SIGNAL","label":"Signal","sort_order":50},
  {"code":"TASK_ONLY","label":"Task only","sort_order":60},
  {"code":"NOTE_ONLY","label":"Note only","sort_order":70},
  {"code":"IGNORE","label":"Ignore","sort_order":90}
]'::jsonb);

WITH status_list AS (
  SELECT id FROM eip_core.dropdown_list
  WHERE code='SERVICE_OBJECT_STATUS' AND is_active=true
  ORDER BY (tenant_id IS NOT NULL) DESC, version DESC LIMIT 1
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT status_list.id, value.code, value.label, value.sort_order, true, '{"module":"crm","area":"intake"}'::jsonb
FROM status_list
CROSS JOIN (VALUES
  ('captured','Captured',6),
  ('structured','Structured',7),
  ('needs_review','Needs review',8),
  ('approved','Approved',9),
  ('converted','Converted',86),
  ('ignored','Ignored',87),
  ('failed','Failed',96)
) AS value(code,label,sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label, sort_order=EXCLUDED.sort_order, is_active=true, attrs=EXCLUDED.attrs;

SELECT pg_temp.seed_crm_intake_dropdown('PROCESS_ACTION', 'Process Action', '[
  {"code":"task.create","label":"Create task","sort_order":20},
  {"code":"structured","label":"Structured","sort_order":270},
  {"code":"needs_review","label":"Needs review","sort_order":280},
  {"code":"approved","label":"Approved","sort_order":290},
  {"code":"converted","label":"Converted","sort_order":300},
  {"code":"ignored","label":"Ignored","sort_order":310},
  {"code":"failed","label":"Failed","sort_order":320}
]'::jsonb);

WITH definitions(code, name, object_type, graph) AS (
  VALUES (
    'CRM_INTAKE_REVIEW_FLOW_V1',
    'CRM intake review flow',
    'CRM_INTAKE_REVIEW',
    '{
      "module":"crm",
      "area":"intake",
      "object_type":"CRM_INTAKE_REVIEW",
      "initial_node":"captured",
      "nodes":{
        "captured":{"id":"captured","type":"TRIGGER"},
        "structured":{"id":"structured","type":"STEP"},
        "needs_review":{"id":"needs_review","type":"STEP"},
        "approved":{"id":"approved","type":"STEP"},
        "converted":{"id":"converted","type":"END"},
        "ignored":{"id":"ignored","type":"END"},
        "failed":{"id":"failed","type":"END"}
      },
      "transitions":[
        {"from":"captured","to":"structured","action":"structured","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"structured"}]},
        {"from":"structured","to":"needs_review","action":"needs_review","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"needs_review"}]},
        {"from":"needs_review","to":"approved","action":"approved","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"approved"}]},
        {"from":"needs_review","to":"ignored","action":"ignored","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"ignored"}]},
        {"from":"approved","to":"converted","action":"converted","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"converted"}]},
        {"from":"approved","to":"ignored","action":"ignored","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"ignored"}]},
        {"from":"captured","to":"failed","action":"failed","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"failed"}]},
        {"from":"structured","to":"failed","action":"failed","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"failed"}]},
        {"from":"needs_review","to":"failed","action":"failed","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"failed"}]},
        {"from":"approved","to":"failed","action":"failed","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"failed"}]},
        {"from":"needs_review","to":"needs_review","action":"task.create","edge_type":"DEFAULT","effects":[{"type":"TASK_CREATE","task_type":"$payload.task_type","title":"$payload.title","description":"$payload.description","assigned_agent_id":"$payload.assigned_agent_id","due_at":"$payload.due_at","attrs":"$payload.attrs"}]},
        {"from":"approved","to":"approved","action":"task.create","edge_type":"DEFAULT","effects":[{"type":"TASK_CREATE","task_type":"$payload.task_type","title":"$payload.title","description":"$payload.description","assigned_agent_id":"$payload.assigned_agent_id","due_at":"$payload.due_at","attrs":"$payload.attrs"}]}
      ]
    }'::jsonb
  )
)
INSERT INTO eip_core.process_def
  (tenant_id, code, name, version, is_active, graph, attrs)
SELECT tenant.id, definitions.code, definitions.name, 1, true, definitions.graph,
       jsonb_build_object(
         'module', 'crm',
         'area', 'intake',
         'object_type', definitions.object_type,
         'is_published', true,
         'source', 'crm_intake_foundation'
       )
FROM eip_core.tenant tenant
CROSS JOIN definitions
ON CONFLICT (tenant_id, code, version) DO UPDATE
SET name=EXCLUDED.name, is_active=true, graph=EXCLUDED.graph, attrs=EXCLUDED.attrs, updated_at=now();

WITH definitions AS (
  SELECT tenant_id, id, attrs->>'object_type' AS object_type
  FROM eip_core.process_def
  WHERE code='CRM_INTAKE_REVIEW_FLOW_V1' AND version=1 AND is_active=true
)
INSERT INTO eip_core.process_binding
  (tenant_id, service_object_type, process_def_id, is_active, priority, attrs)
SELECT tenant_id, object_type, id, true, 50, '{"module":"crm","area":"intake","source":"crm_intake_foundation"}'::jsonb
FROM definitions
ON CONFLICT (tenant_id, service_object_type, process_def_id, (COALESCE(task_type, ''))) DO UPDATE
SET is_active=true, priority=EXCLUDED.priority, attrs=EXCLUDED.attrs, updated_at=now();

WITH definitions AS (
  SELECT tenant_id, id, attrs->>'object_type' AS object_type
  FROM eip_core.process_def
  WHERE code='CRM_INTAKE_REVIEW_FLOW_V1' AND version=1 AND is_active=true
)
INSERT INTO eip_core.task_template
  (tenant_id, process_def_id, service_object_type, task_type, title, is_active, sort_order, attrs)
SELECT tenant_id, id, object_type, 'FOLLOW_UP', 'Review CRM intake', true, 10,
       '{"module":"crm","area":"intake","source":"crm_intake_foundation"}'::jsonb
FROM definitions
ON CONFLICT (tenant_id, process_def_id, (COALESCE(service_object_type,'')), task_type) DO UPDATE
SET title=EXCLUDED.title, is_active=true, sort_order=EXCLUDED.sort_order, attrs=EXCLUDED.attrs, updated_at=now();

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('CRM_INTAKE_READ', 'Read CRM intake', 'View sanitized CRM intake proposals and decisions'),
  ('CRM_INTAKE_WRITE', 'Write CRM intake', 'Create manual CRM intake proposals and follow-up work'),
  ('CRM_INTAKE_APPROVE', 'Approve CRM intake', 'Approve or ignore CRM intake proposals'),
  ('CRM_INTAKE_CONVERT', 'Convert CRM intake', 'Convert approved CRM intake proposals into governed objects')
ON CONFLICT (code) DO UPDATE
SET label=EXCLUDED.label, description=EXCLUDED.description;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','CRM_INTAKE_READ'), ('ADMIN_SUPER','CRM_INTAKE_WRITE'),
    ('ADMIN_SUPER','CRM_INTAKE_APPROVE'), ('ADMIN_SUPER','CRM_INTAKE_CONVERT'),
    ('ACCESS_UNIVERSAL','CRM_INTAKE_READ'), ('ACCESS_UNIVERSAL','CRM_INTAKE_WRITE'),
    ('ACCESS_UNIVERSAL','CRM_INTAKE_APPROVE'), ('ACCESS_UNIVERSAL','CRM_INTAKE_CONVERT'),
    ('CRM_ADMIN','CRM_INTAKE_READ'), ('CRM_ADMIN','CRM_INTAKE_WRITE'),
    ('CRM_ADMIN','CRM_INTAKE_APPROVE'), ('CRM_ADMIN','CRM_INTAKE_CONVERT'),
    ('CRM_USER','CRM_INTAKE_READ'), ('CRM_USER','CRM_INTAKE_WRITE'),
    ('ACCESS_CRM_FULL','CRM_INTAKE_READ'), ('ACCESS_CRM_FULL','CRM_INTAKE_WRITE'),
    ('ACCESS_CRM_FULL','CRM_INTAKE_APPROVE'), ('ACCESS_CRM_FULL','CRM_INTAKE_CONVERT'),
    ('ACCESS_READ_ONLY','CRM_INTAKE_READ')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT role.id, bundles.permission_code
FROM eip_authz.role role
JOIN bundles ON bundles.role_code=role.code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

UPDATE eip_core.tenant_module_setting
SET attrs=jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(attrs,'{}'::jsonb),
          '{capabilities}',
          COALESCE(attrs->'capabilities','{}'::jsonb) || '{"intake":true}'::jsonb,
          true
        ),
        '{intake_policy}',
        COALESCE(attrs->'intake_policy','{
          "automation_mode":"review_required",
          "auto_create_threshold":0.95,
          "review_threshold":0.6,
          "human_review_required":true
        }'::jsonb),
        true
      ),
      '{ai_extraction_policy}',
      COALESCE(attrs->'ai_extraction_policy','{
        "ai_extraction_enabled":false,
        "provider":"",
        "model":"",
        "mode":"assistive",
        "human_review_required":true,
        "auto_convert_threshold":0.98,
        "pii_redaction_required":true
      }'::jsonb),
      true
    ),
    updated_at=now()
WHERE module='crm' AND code='subscription' AND is_active=true;

UPDATE eip_core.module_catalog
SET attrs=jsonb_set(
      COALESCE(attrs,'{}'::jsonb),
      '{capabilities}',
      COALESCE(attrs->'capabilities','{}'::jsonb) || '{"intake":true}'::jsonb,
      true
    ),
    updated_at=now()
WHERE code='crm';

CREATE INDEX IF NOT EXISTS info_record_crm_intake_created_idx
  ON eip_core.info_record (tenant_id, record_type, created_at DESC, id)
  WHERE record_type IN ('CRM_INTAKE_RAW','CRM_INTAKE_PROPOSAL','CRM_INTAKE_DECISION');

CREATE INDEX IF NOT EXISTS info_record_crm_intake_source_ref_idx
  ON eip_core.info_record (tenant_id, ((payload->>'source_ref_hash')))
  WHERE record_type='CRM_INTAKE_RAW' AND is_active=true;

CREATE INDEX IF NOT EXISTS info_record_crm_intake_status_idx
  ON eip_core.info_record (tenant_id, ((payload->>'proposal_status')), created_at DESC)
  WHERE record_type='CRM_INTAKE_PROPOSAL' AND is_active=true;

DO $$
DECLARE
  surface_row record;
  root_child jsonb;
  panel_child jsonb;
  tabs jsonb;
  intake_tab jsonb := '{"id":"intake","label":"Intake Inbox","kind":"intake","endpoint":"/api/eip/crm/intake","permission":"CRM_INTAKE_READ","capability":"intake"}'::jsonb;
  next_root_children jsonb;
  next_panel_children jsonb;
BEGIN
  FOR surface_row IN
    SELECT id, tree FROM eip_core.ui_surface
    WHERE code='dashboard' AND is_active=true AND is_published=true
  LOOP
    next_root_children := '[]'::jsonb;
    FOR root_child IN SELECT value FROM jsonb_array_elements(COALESCE(surface_row.tree->'children','[]'::jsonb))
    LOOP
      IF root_child->>'id'='user-crm-panel' THEN
        next_panel_children := '[]'::jsonb;
        FOR panel_child IN SELECT value FROM jsonb_array_elements(COALESCE(root_child->'children','[]'::jsonb))
        LOOP
          IF panel_child->>'id'='crm-workspace' THEN
            tabs := COALESCE(panel_child->'props'->'tabs','[]'::jsonb);
            IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(tabs) existing_tab WHERE existing_tab->>'id'='intake') THEN
              tabs := jsonb_build_array(intake_tab) || tabs;
            END IF;
            panel_child := jsonb_set(panel_child, '{props,tabs}', tabs, true);
          END IF;
          next_panel_children := next_panel_children || jsonb_build_array(panel_child);
        END LOOP;
        root_child := jsonb_set(root_child, '{children}', next_panel_children, true);
      END IF;
      next_root_children := next_root_children || jsonb_build_array(root_child);
    END LOOP;
    UPDATE eip_core.ui_surface
    SET tree=jsonb_set(surface_row.tree, '{children}', next_root_children, true), updated_at=now()
    WHERE id=surface_row.id;
  END LOOP;
END;
$$;

COMMIT;
