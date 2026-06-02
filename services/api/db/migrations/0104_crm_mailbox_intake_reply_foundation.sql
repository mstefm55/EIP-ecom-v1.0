-- CRM mailbox intake and reply foundation. Mail transport remains external.
-- Existing info_record, object_link, service_object, process, task, dropdown,
-- role, module setting, and UI descriptor structures are reused.
-- No CRM-specific persistence tables are introduced.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.seed_crm_mailbox_dropdown(
  p_list_code text,
  p_list_name text,
  p_values jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  target_list_id uuid;
  item jsonb;
BEGIN
  SELECT dropdown_list.id INTO target_list_id
  FROM eip_core.dropdown_list dropdown_list
  WHERE dropdown_list.tenant_id IS NULL
    AND dropdown_list.module='crm'
    AND dropdown_list.code=p_list_code
    AND dropdown_list.version=1
  ORDER BY dropdown_list.created_at ASC
  LIMIT 1;

  IF target_list_id IS NULL THEN
    INSERT INTO eip_core.dropdown_list
      (tenant_id, module, code, name, version, is_active, attrs)
    VALUES
      (NULL, 'crm', p_list_code, p_list_name, 1, true, '{"ui":{"module":"crm","area":"mailbox"}}'::jsonb)
    RETURNING id INTO target_list_id;
  ELSE
    UPDATE eip_core.dropdown_list
    SET name=p_list_name, is_active=true, updated_at=now()
    WHERE id=target_list_id;
  END IF;

  FOR item IN SELECT entry.value FROM jsonb_array_elements(p_values) AS entry(value)
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

SELECT pg_temp.seed_crm_mailbox_dropdown('CRM_MAILBOX_PROVIDER', 'CRM Mailbox Provider', '[
  {"code":"gmail","label":"Gmail","sort_order":10},
  {"code":"microsoft_graph","label":"Microsoft Graph","sort_order":20},
  {"code":"imap","label":"IMAP","sort_order":30},
  {"code":"manual_test","label":"Manual test provider","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_crm_mailbox_dropdown('CRM_MAILBOX_MESSAGE_STATUS', 'CRM Mailbox Message Status', '[
  {"code":"imported","label":"Imported","sort_order":10},
  {"code":"intake_created","label":"Intake created","sort_order":20},
  {"code":"linked","label":"Linked","sort_order":30},
  {"code":"archived","label":"Archived","sort_order":80},
  {"code":"ignored","label":"Ignored","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_crm_mailbox_dropdown('CRM_MAILBOX_DIRECTION', 'CRM Mailbox Direction', '[
  {"code":"inbound","label":"Inbound","sort_order":10},
  {"code":"outbound","label":"Outbound","sort_order":20}
]'::jsonb);

SELECT pg_temp.seed_crm_mailbox_dropdown('CRM_REPLY_STATUS', 'CRM Reply Status', '[
  {"code":"draft","label":"Draft","sort_order":10},
  {"code":"review","label":"In review","sort_order":20},
  {"code":"approved","label":"Approved","sort_order":30},
  {"code":"send_pending","label":"Send pending","sort_order":40},
  {"code":"sent","label":"Sent","sort_order":50},
  {"code":"send_failed","label":"Send failed","sort_order":80},
  {"code":"cancelled","label":"Cancelled","sort_order":90}
]'::jsonb);

WITH status_list AS (
  SELECT dropdown_list.id
  FROM eip_core.dropdown_list dropdown_list
  WHERE dropdown_list.code='SERVICE_OBJECT_STATUS' AND dropdown_list.is_active=true
  ORDER BY (dropdown_list.tenant_id IS NOT NULL) DESC, dropdown_list.version DESC
  LIMIT 1
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT status_list.id, item.code, item.label, item.sort_order, true, '{"module":"crm","area":"mailbox"}'::jsonb
FROM status_list
CROSS JOIN (VALUES
  ('imported','Imported',6),
  ('intake_created','Intake created',7),
  ('linked','Linked',8),
  ('archived','Archived',89),
  ('draft','Draft',10),
  ('review','In review',11),
  ('send_pending','Send pending',12),
  ('sent','Sent',13),
  ('send_failed','Send failed',94)
) AS item(code,label,sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label, sort_order=EXCLUDED.sort_order, is_active=true, attrs=EXCLUDED.attrs;

SELECT pg_temp.seed_crm_mailbox_dropdown('PROCESS_ACTION', 'Process Action', '[
  {"code":"intake_created","label":"Intake created","sort_order":330},
  {"code":"linked","label":"Linked","sort_order":340},
  {"code":"archived","label":"Archived","sort_order":350},
  {"code":"review","label":"Review","sort_order":360},
  {"code":"send_pending","label":"Send pending","sort_order":370},
  {"code":"sent","label":"Sent","sort_order":380},
  {"code":"send_failed","label":"Send failed","sort_order":390},
  {"code":"cancelled","label":"Cancelled","sort_order":400}
]'::jsonb);

WITH definitions(code, name, object_type, graph) AS (
  VALUES
  (
    'CRM_MAILBOX_MESSAGE_FLOW_V1',
    'CRM mailbox message flow',
    'CRM_MAILBOX_MESSAGE_REVIEW',
    '{
      "module":"crm",
      "area":"mailbox",
      "object_type":"CRM_MAILBOX_MESSAGE_REVIEW",
      "initial_node":"imported",
      "nodes":{
        "imported":{"id":"imported","type":"TRIGGER"},
        "intake_created":{"id":"intake_created","type":"STEP"},
        "linked":{"id":"linked","type":"END"},
        "archived":{"id":"archived","type":"END"},
        "ignored":{"id":"ignored","type":"END"}
      },
      "transitions":[
        {"from":"imported","to":"intake_created","action":"intake_created","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"intake_created"}]},
        {"from":"intake_created","to":"linked","action":"linked","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"linked"}]},
        {"from":"imported","to":"archived","action":"archived","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"archived"}]},
        {"from":"intake_created","to":"archived","action":"archived","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"archived"}]},
        {"from":"imported","to":"ignored","action":"ignored","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"ignored"}]}
      ]
    }'::jsonb
  ),
  (
    'CRM_REPLY_REVIEW_FLOW_V1',
    'CRM reply review flow',
    'CRM_MAILBOX_REPLY_REVIEW',
    '{
      "module":"crm",
      "area":"mailbox",
      "object_type":"CRM_MAILBOX_REPLY_REVIEW",
      "initial_node":"draft",
      "nodes":{
        "draft":{"id":"draft","type":"TRIGGER"},
        "review":{"id":"review","type":"STEP"},
        "approved":{"id":"approved","type":"STEP"},
        "send_pending":{"id":"send_pending","type":"STEP"},
        "sent":{"id":"sent","type":"END"},
        "send_failed":{"id":"send_failed","type":"END"},
        "cancelled":{"id":"cancelled","type":"END"}
      },
      "transitions":[
        {"from":"draft","to":"review","action":"review","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"review"}]},
        {"from":"review","to":"approved","action":"approved","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"approved"}]},
        {"from":"approved","to":"send_pending","action":"send_pending","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"send_pending"}]},
        {"from":"send_pending","to":"sent","action":"sent","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"sent"}]},
        {"from":"send_pending","to":"send_failed","action":"send_failed","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"send_failed"}]},
        {"from":"draft","to":"cancelled","action":"cancelled","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"cancelled"}]},
        {"from":"review","to":"cancelled","action":"cancelled","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"cancelled"}]},
        {"from":"approved","to":"cancelled","action":"cancelled","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"cancelled"}]}
      ]
    }'::jsonb
  )
)
INSERT INTO eip_core.process_def
  (tenant_id, code, name, version, is_active, graph, attrs)
SELECT tenant.id, definitions.code, definitions.name, 1, true, definitions.graph,
       jsonb_build_object(
         'module', 'crm',
         'area', 'mailbox',
         'object_type', definitions.object_type,
         'is_published', true,
         'source', 'crm_mailbox_foundation'
       )
FROM eip_core.tenant tenant
CROSS JOIN definitions
ON CONFLICT (tenant_id, code, version) DO UPDATE
SET name=EXCLUDED.name, is_active=true, graph=EXCLUDED.graph, attrs=EXCLUDED.attrs, updated_at=now();

WITH definitions AS (
  SELECT process_def.tenant_id, process_def.id, process_def.attrs->>'object_type' AS object_type
  FROM eip_core.process_def process_def
  WHERE process_def.code IN ('CRM_MAILBOX_MESSAGE_FLOW_V1','CRM_REPLY_REVIEW_FLOW_V1')
    AND process_def.version=1 AND process_def.is_active=true
)
INSERT INTO eip_core.process_binding
  (tenant_id, service_object_type, process_def_id, is_active, priority, attrs)
SELECT definitions.tenant_id, definitions.object_type, definitions.id, true, 50,
       '{"module":"crm","area":"mailbox","source":"crm_mailbox_foundation"}'::jsonb
FROM definitions
ON CONFLICT (tenant_id, service_object_type, process_def_id, (COALESCE(task_type, ''))) DO UPDATE
SET is_active=true, priority=EXCLUDED.priority, attrs=EXCLUDED.attrs, updated_at=now();

WITH definitions AS (
  SELECT process_def.tenant_id, process_def.id, process_def.attrs->>'object_type' AS object_type
  FROM eip_core.process_def process_def
  WHERE process_def.code IN ('CRM_MAILBOX_MESSAGE_FLOW_V1','CRM_REPLY_REVIEW_FLOW_V1')
    AND process_def.version=1 AND process_def.is_active=true
)
INSERT INTO eip_core.task_template
  (tenant_id, process_def_id, service_object_type, task_type, title, is_active, sort_order, attrs)
SELECT definitions.tenant_id, definitions.id, definitions.object_type,
       CASE WHEN definitions.object_type='CRM_MAILBOX_REPLY_REVIEW' THEN 'APPROVAL' ELSE 'FOLLOW_UP' END,
       CASE WHEN definitions.object_type='CRM_MAILBOX_REPLY_REVIEW' THEN 'Review CRM mailbox reply' ELSE 'Review CRM mailbox message' END,
       true, 10,
       '{"module":"crm","area":"mailbox","source":"crm_mailbox_foundation"}'::jsonb
FROM definitions
ON CONFLICT (tenant_id, process_def_id, (COALESCE(service_object_type,'')), task_type) DO UPDATE
SET title=EXCLUDED.title, is_active=true, sort_order=EXCLUDED.sort_order, attrs=EXCLUDED.attrs, updated_at=now();

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('CRM_MAILBOX_READ', 'Read CRM mailbox', 'View protected mailbox messages, readiness, threads, and reply drafts'),
  ('CRM_MAILBOX_WRITE', 'Write CRM mailbox', 'Import mailbox messages and create governed intake proposals'),
  ('CRM_MAILBOX_REPLY_DRAFT', 'Draft CRM mailbox replies', 'Create, edit, and approve mailbox reply drafts'),
  ('CRM_MAILBOX_REPLY_SEND', 'Request CRM mailbox reply send', 'Request provider delivery only after governed reply approval')
ON CONFLICT (code) DO UPDATE
SET label=EXCLUDED.label, description=EXCLUDED.description;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','CRM_MAILBOX_READ'), ('ADMIN_SUPER','CRM_MAILBOX_WRITE'),
    ('ADMIN_SUPER','CRM_MAILBOX_REPLY_DRAFT'), ('ADMIN_SUPER','CRM_MAILBOX_REPLY_SEND'),
    ('ACCESS_UNIVERSAL','CRM_MAILBOX_READ'), ('ACCESS_UNIVERSAL','CRM_MAILBOX_WRITE'),
    ('ACCESS_UNIVERSAL','CRM_MAILBOX_REPLY_DRAFT'), ('ACCESS_UNIVERSAL','CRM_MAILBOX_REPLY_SEND'),
    ('CRM_ADMIN','CRM_MAILBOX_READ'), ('CRM_ADMIN','CRM_MAILBOX_WRITE'),
    ('CRM_ADMIN','CRM_MAILBOX_REPLY_DRAFT'), ('CRM_ADMIN','CRM_MAILBOX_REPLY_SEND'),
    ('CRM_USER','CRM_MAILBOX_READ'), ('CRM_USER','CRM_MAILBOX_WRITE'),
    ('CRM_USER','CRM_MAILBOX_REPLY_DRAFT'),
    ('ACCESS_CRM_FULL','CRM_MAILBOX_READ'), ('ACCESS_CRM_FULL','CRM_MAILBOX_WRITE'),
    ('ACCESS_CRM_FULL','CRM_MAILBOX_REPLY_DRAFT'), ('ACCESS_CRM_FULL','CRM_MAILBOX_REPLY_SEND'),
    ('ACCESS_READ_ONLY','CRM_MAILBOX_READ')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT role.id, bundles.permission_code
FROM eip_authz.role role
JOIN bundles ON bundles.role_code=role.code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','CRM_MAILBOX_READ'), ('ADMIN_SUPER','CRM_MAILBOX_WRITE'),
    ('ADMIN_SUPER','CRM_MAILBOX_REPLY_DRAFT'), ('ADMIN_SUPER','CRM_MAILBOX_REPLY_SEND'),
    ('ACCESS_UNIVERSAL','CRM_MAILBOX_READ'), ('ACCESS_UNIVERSAL','CRM_MAILBOX_WRITE'),
    ('ACCESS_UNIVERSAL','CRM_MAILBOX_REPLY_DRAFT'), ('ACCESS_UNIVERSAL','CRM_MAILBOX_REPLY_SEND'),
    ('CRM_ADMIN','CRM_MAILBOX_READ'), ('CRM_ADMIN','CRM_MAILBOX_WRITE'),
    ('CRM_ADMIN','CRM_MAILBOX_REPLY_DRAFT'), ('CRM_ADMIN','CRM_MAILBOX_REPLY_SEND'),
    ('CRM_USER','CRM_MAILBOX_READ'), ('CRM_USER','CRM_MAILBOX_WRITE'),
    ('CRM_USER','CRM_MAILBOX_REPLY_DRAFT'),
    ('ACCESS_CRM_FULL','CRM_MAILBOX_READ'), ('ACCESS_CRM_FULL','CRM_MAILBOX_WRITE'),
    ('ACCESS_CRM_FULL','CRM_MAILBOX_REPLY_DRAFT'), ('ACCESS_CRM_FULL','CRM_MAILBOX_REPLY_SEND'),
    ('ACCESS_READ_ONLY','CRM_MAILBOX_READ')
)
INSERT INTO eip_authz.role_template_permission(role_code, permission_code)
SELECT role_template.code, bundles.permission_code
FROM eip_authz.role_template role_template
JOIN bundles ON bundles.role_code=role_template.code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

UPDATE eip_core.tenant_module_setting
SET attrs=jsonb_set(
      COALESCE(attrs,'{}'::jsonb),
      '{capabilities}',
      COALESCE(attrs->'capabilities','{}'::jsonb) || '{"mailbox":true}'::jsonb,
      true
    ),
    updated_at=now()
WHERE module='crm' AND code='subscription' AND is_active=true;

UPDATE eip_core.module_catalog
SET attrs=jsonb_set(
      COALESCE(attrs,'{}'::jsonb),
      '{capabilities}',
      COALESCE(attrs->'capabilities','{}'::jsonb) || '{"mailbox":true}'::jsonb,
      true
    ),
    updated_at=now()
WHERE code='crm';

CREATE INDEX IF NOT EXISTS info_record_crm_mailbox_created_idx
  ON eip_core.info_record (tenant_id, record_type, created_at DESC, id)
  WHERE record_type IN ('CRM_MAILBOX_MESSAGE','CRM_MAILBOX_THREAD','CRM_MAILBOX_REPLY_DRAFT','CRM_MAILBOX_REPLY_DECISION');

CREATE INDEX IF NOT EXISTS info_record_crm_mailbox_fingerprint_idx
  ON eip_core.info_record (tenant_id, ((payload->>'fingerprint')))
  WHERE record_type='CRM_MAILBOX_MESSAGE' AND is_active=true;

CREATE INDEX IF NOT EXISTS info_record_crm_mailbox_thread_idx
  ON eip_core.info_record (tenant_id, ((payload->>'thread_fingerprint')), created_at)
  WHERE record_type='CRM_MAILBOX_MESSAGE' AND is_active=true;

DO $$
DECLARE
  surface_row record;
  root_child jsonb;
  panel_child jsonb;
  tabs jsonb;
  mailbox_tab jsonb := '{"id":"mailbox","label":"Mailbox","kind":"mailbox","endpoint":"/api/eip/crm/mailbox/messages","permission":"CRM_MAILBOX_READ","capability":"mailbox"}'::jsonb;
  mailbox_replies_tab jsonb := '{"id":"mailbox_replies","label":"Reply Drafts","kind":"mailbox_reply","endpoint":"/api/eip/crm/mailbox/replies","permission":"CRM_MAILBOX_READ","capability":"mailbox"}'::jsonb;
  next_root_children jsonb;
  next_panel_children jsonb;
BEGIN
  FOR surface_row IN
    SELECT ui_surface.id, ui_surface.tree
    FROM eip_core.ui_surface ui_surface
    WHERE ui_surface.code='dashboard' AND ui_surface.is_active=true AND ui_surface.is_published=true
  LOOP
    next_root_children := '[]'::jsonb;
    FOR root_child IN SELECT entry.value FROM jsonb_array_elements(COALESCE(surface_row.tree->'children','[]'::jsonb)) AS entry(value)
    LOOP
      IF root_child->>'id'='user-crm-panel' THEN
        next_panel_children := '[]'::jsonb;
        FOR panel_child IN SELECT entry.value FROM jsonb_array_elements(COALESCE(root_child->'children','[]'::jsonb)) AS entry(value)
        LOOP
          IF panel_child->>'id'='crm-workspace' THEN
            tabs := COALESCE(panel_child->'props'->'tabs','[]'::jsonb);
            IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(tabs) existing_tab WHERE existing_tab->>'id'='mailbox') THEN
              tabs := jsonb_build_array(mailbox_tab) || tabs;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(tabs) existing_tab WHERE existing_tab->>'id'='mailbox_replies') THEN
              tabs := tabs || jsonb_build_array(mailbox_replies_tab);
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
