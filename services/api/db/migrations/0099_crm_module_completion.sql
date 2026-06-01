-- Complete the reusable CRM module with governed dropdowns, processes, permissions,
-- bindings, task templates, and dashboard descriptor registration.
-- No CRM-specific persistence tables are introduced.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.seed_crm_dropdown(
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
      (NULL, 'crm', list_code, list_name, 1, true, '{"ui":{"module":"crm"}}'::jsonb)
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

SELECT pg_temp.seed_crm_dropdown('CRM_LEAD_STATUS', 'CRM Lead Status', '[
  {"code":"new","label":"New","sort_order":10},
  {"code":"contacted","label":"Contacted","sort_order":20},
  {"code":"qualified","label":"Qualified","sort_order":30},
  {"code":"unqualified","label":"Unqualified","sort_order":70},
  {"code":"converted","label":"Converted","sort_order":80},
  {"code":"archived","label":"Archived","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_crm_dropdown('CRM_CASE_STATUS', 'CRM Case Status', '[
  {"code":"new","label":"New","sort_order":10},
  {"code":"in_progress","label":"In progress","sort_order":20},
  {"code":"on_hold","label":"On hold","sort_order":30},
  {"code":"resolved","label":"Resolved","sort_order":70},
  {"code":"closed","label":"Closed","sort_order":80},
  {"code":"cancelled","label":"Cancelled","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_crm_dropdown('CRM_OPPORTUNITY_STATUS', 'CRM Opportunity Status', '[
  {"code":"new","label":"New","sort_order":10},
  {"code":"qualified","label":"Qualified","sort_order":20},
  {"code":"proposal","label":"Proposal","sort_order":30},
  {"code":"negotiation","label":"Negotiation","sort_order":40},
  {"code":"won","label":"Won","sort_order":80},
  {"code":"lost","label":"Lost","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_crm_dropdown('CRM_PRIORITY', 'CRM Priority', '[
  {"code":"LOW","label":"Low","sort_order":10},
  {"code":"MEDIUM","label":"Medium","sort_order":20},
  {"code":"HIGH","label":"High","sort_order":30},
  {"code":"URGENT","label":"Urgent","sort_order":40}
]'::jsonb);

SELECT pg_temp.seed_crm_dropdown('CRM_INTERACTION_CHANNEL', 'CRM Interaction Channel', '[
  {"code":"EMAIL","label":"Email","sort_order":10},
  {"code":"PHONE","label":"Phone","sort_order":20},
  {"code":"WHATSAPP","label":"WhatsApp","sort_order":30},
  {"code":"INSTAGRAM","label":"Instagram","sort_order":40},
  {"code":"FACEBOOK","label":"Facebook","sort_order":50},
  {"code":"MEETING","label":"Meeting","sort_order":60},
  {"code":"WEBFORM","label":"Web form","sort_order":70}
]'::jsonb);

SELECT pg_temp.seed_crm_dropdown('CRM_INTERACTION_DIRECTION', 'CRM Interaction Direction', '[
  {"code":"IN","label":"Inbound","sort_order":10},
  {"code":"OUT","label":"Outbound","sort_order":20}
]'::jsonb);

SELECT pg_temp.seed_crm_dropdown('CRM_TASK_TYPE', 'CRM Task Type', '[
  {"code":"CALL","label":"Call","sort_order":10},
  {"code":"EMAIL","label":"Email","sort_order":20},
  {"code":"MEETING","label":"Meeting","sort_order":30},
  {"code":"FOLLOW_UP","label":"Follow up","sort_order":40},
  {"code":"QUOTE_PREP","label":"Quote preparation","sort_order":50},
  {"code":"PROPOSAL_REVIEW","label":"Proposal review","sort_order":60},
  {"code":"CUSTOMER_REVIEW","label":"Customer review","sort_order":70},
  {"code":"APPROVAL","label":"Approval","sort_order":80},
  {"code":"GENERAL_TASK","label":"General task","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_crm_dropdown('CRM_SOURCE', 'CRM Source', '[
  {"code":"REFERRAL","label":"Referral","sort_order":10},
  {"code":"WEBFORM","label":"Web form","sort_order":20},
  {"code":"SOCIAL","label":"Social","sort_order":30},
  {"code":"OUTBOUND","label":"Outbound","sort_order":40},
  {"code":"INBOUND","label":"Inbound","sort_order":50},
  {"code":"PARTNER","label":"Partner","sort_order":60},
  {"code":"OTHER","label":"Other","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_crm_dropdown('CRM_REASON_LOST', 'CRM Reason Lost', '[
  {"code":"PRICE","label":"Price","sort_order":10},
  {"code":"TIMING","label":"Timing","sort_order":20},
  {"code":"COMPETITOR","label":"Competitor","sort_order":30},
  {"code":"NO_DECISION","label":"No decision","sort_order":40},
  {"code":"OTHER","label":"Other","sort_order":90}
]'::jsonb);

WITH so_list AS (
  SELECT id FROM eip_core.dropdown_list
  WHERE code='SERVICE_OBJECT_STATUS' AND is_active=true
  ORDER BY (tenant_id IS NOT NULL) DESC, version DESC LIMIT 1
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT so_list.id, value.code, value.label, value.sort_order, true, '{"module":"crm"}'::jsonb
FROM so_list
CROSS JOIN (VALUES
  ('contacted','Contacted',25),
  ('unqualified','Unqualified',75),
  ('converted','Converted',85),
  ('archived','Archived',95)
) AS value(code,label,sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label, sort_order=EXCLUDED.sort_order, is_active=true;

WITH effect_list AS (
  SELECT id FROM eip_core.dropdown_list
  WHERE code='PROCESS_EFFECT_TYPE' AND is_active=true
  ORDER BY (tenant_id IS NOT NULL) DESC, version DESC LIMIT 1
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT id, 'PARTY_LINK_CREATE', 'Party Link Create', 85, true, '{"group":"kernel"}'::jsonb
FROM effect_list
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label, sort_order=EXCLUDED.sort_order, is_active=true, attrs=EXCLUDED.attrs;

SELECT pg_temp.seed_crm_dropdown('PROCESS_ACTION', 'Process Action', '[
  {"code":"update","label":"Update","sort_order":10},
  {"code":"task.create","label":"Create task","sort_order":20},
  {"code":"task.status","label":"Update task status","sort_order":30},
  {"code":"new","label":"New","sort_order":40},
  {"code":"contacted","label":"Contacted","sort_order":50},
  {"code":"qualified","label":"Qualified","sort_order":60},
  {"code":"unqualified","label":"Unqualified","sort_order":70},
  {"code":"converted","label":"Converted","sort_order":80},
  {"code":"archived","label":"Archived","sort_order":90},
  {"code":"in_progress","label":"In progress","sort_order":100},
  {"code":"on_hold","label":"On hold","sort_order":110},
  {"code":"resolved","label":"Resolved","sort_order":120},
  {"code":"closed","label":"Closed","sort_order":130},
  {"code":"cancelled","label":"Cancelled","sort_order":140},
  {"code":"proposal","label":"Proposal","sort_order":150},
  {"code":"negotiation","label":"Negotiation","sort_order":160},
  {"code":"won","label":"Won","sort_order":170},
  {"code":"lost","label":"Lost","sort_order":180},
  {"code":"convert","label":"Convert","sort_order":190}
]'::jsonb);

CREATE OR REPLACE FUNCTION pg_temp.crm_process_graph(
  object_type text,
  stages text[],
  extra_transitions jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  nodes jsonb := '{}'::jsonb;
  transitions jsonb := '[]'::jsonb;
  stage text;
  extra jsonb;
  effects jsonb;
BEGIN
  FOREACH stage IN ARRAY stages
  LOOP
    nodes := nodes || jsonb_build_object(stage, jsonb_build_object('id', stage, 'type', 'STEP'));
    transitions := transitions || jsonb_build_array(
      jsonb_build_object(
        'from', stage, 'to', stage, 'action', 'update', 'edge_type', 'DEFAULT',
        'effects', jsonb_build_array(jsonb_build_object(
          'type', 'SO_UPDATE',
          'title', '$payload.title',
          'attrs', '$payload.attrs',
          'owner_agent_id', '$payload.owner_agent_id'
        ))
      ),
      jsonb_build_object(
        'from', stage, 'to', stage, 'action', 'task.create', 'edge_type', 'DEFAULT',
        'effects', jsonb_build_array(jsonb_build_object(
          'type', 'TASK_CREATE',
          'task_type', '$payload.task_type',
          'title', '$payload.title',
          'description', '$payload.description',
          'assigned_agent_id', '$payload.assigned_agent_id',
          'due_at', '$payload.due_at',
          'payload', '$payload.payload',
          'attrs', '$payload.attrs'
        ))
      ),
      jsonb_build_object(
        'from', stage, 'to', stage, 'action', 'task.status', 'edge_type', 'DEFAULT',
        'effects', jsonb_build_array(jsonb_build_object(
          'type', 'TASK_UPDATE',
          'task_id', '$payload.task_id',
          'to', '$payload.to_status',
          'reason_code', '$payload.reason_code',
          'note', '$payload.note'
        ))
      )
    );
  END LOOP;

  FOR extra IN SELECT value FROM jsonb_array_elements(extra_transitions)
  LOOP
    effects := extra->'effects';
    IF effects IS NULL THEN
      effects := jsonb_build_array(jsonb_build_object('type', 'STATUS_SET', 'to', extra->>'to'));
    END IF;
    transitions := transitions || jsonb_build_array(
      jsonb_build_object(
        'from', extra->>'from',
        'to', extra->>'to',
        'action', extra->>'action',
        'edge_type', 'DEFAULT',
        'effects', effects
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'module', 'crm',
    'object_type', object_type,
    'initial_node', 'new',
    'nodes', nodes,
    'transitions', transitions
  );
END;
$$;

WITH definitions(code, name, object_type, graph) AS (
  VALUES
    (
      'CRM_INTERACTION_FLOW_V1',
      'CRM interaction flow',
      'CRM_INTERACTION',
      pg_temp.crm_process_graph('CRM_INTERACTION', ARRAY['new']::text[], '[]'::jsonb)
    ),
    (
      'CRM_CASE_FLOW_V1',
      'CRM case flow',
      'CRM_CASE',
      pg_temp.crm_process_graph(
        'CRM_CASE',
        ARRAY['new','in_progress','on_hold','resolved','closed','cancelled']::text[],
        '[
          {"from":"new","to":"in_progress","action":"in_progress"},
          {"from":"new","to":"cancelled","action":"cancelled"},
          {"from":"in_progress","to":"on_hold","action":"on_hold"},
          {"from":"in_progress","to":"resolved","action":"resolved"},
          {"from":"in_progress","to":"cancelled","action":"cancelled"},
          {"from":"on_hold","to":"in_progress","action":"in_progress"},
          {"from":"on_hold","to":"cancelled","action":"cancelled"},
          {"from":"resolved","to":"closed","action":"closed"},
          {"from":"resolved","to":"in_progress","action":"in_progress"}
        ]'::jsonb
      )
    ),
    (
      'CRM_OPPORTUNITY_FLOW_V1',
      'CRM opportunity flow',
      'CRM_OPPORTUNITY',
      pg_temp.crm_process_graph(
        'CRM_OPPORTUNITY',
        ARRAY['new','qualified','proposal','negotiation','won','lost']::text[],
        '[
          {"from":"new","to":"qualified","action":"qualified"},
          {"from":"new","to":"lost","action":"lost"},
          {"from":"qualified","to":"proposal","action":"proposal"},
          {"from":"qualified","to":"lost","action":"lost"},
          {"from":"proposal","to":"negotiation","action":"negotiation"},
          {"from":"proposal","to":"lost","action":"lost"},
          {"from":"negotiation","to":"won","action":"won"},
          {"from":"negotiation","to":"lost","action":"lost"}
        ]'::jsonb
      )
    ),
    (
      'CRM_LEAD_FLOW_V1',
      'CRM lead flow',
      'CRM_LEAD',
      pg_temp.crm_process_graph(
        'CRM_LEAD',
        ARRAY['new','contacted','qualified','unqualified','converted','archived']::text[],
        '[
          {"from":"new","to":"contacted","action":"contacted"},
          {"from":"new","to":"unqualified","action":"unqualified"},
          {"from":"new","to":"archived","action":"archived"},
          {"from":"contacted","to":"qualified","action":"qualified"},
          {"from":"contacted","to":"unqualified","action":"unqualified"},
          {"from":"contacted","to":"archived","action":"archived"},
          {"from":"qualified","to":"unqualified","action":"unqualified"},
          {"from":"qualified","to":"archived","action":"archived"},
          {
            "from":"qualified",
            "to":"converted",
            "action":"convert",
            "effects":[
              {"type":"STATUS_SET","to":"converted"},
              {
                "type":"CHILD_SERVICE_OBJECT_CREATE",
                "object_type":"CRM_OPPORTUNITY",
                "status":"new",
                "title":"$payload.opportunity_title",
                "as":"opportunity",
                "owner":"source_owner",
                "attrs":{
                  "value":"$payload.value",
                  "currency":"$payload.currency",
                  "probability":"$payload.probability",
                  "expected_close_date":"$payload.expected_close_date",
                  "source":"$payload.source",
                  "converted_from_lead_id":"$service_object_id"
                },
                "links":[
                  {
                    "src_kind":"service_object",
                    "src_id":"$created.opportunity",
                    "dst_kind":"service_object",
                    "dst_id":"$service_object_id",
                    "relation_type":"CONVERTED_FROM"
                  }
                ]
              },
              {
                "type":"PARTY_LINK_CREATE",
                "service_object_id":"$created.opportunity",
                "agent_id":"$payload.customer_agent_id",
                "role":"CUSTOMER"
              },
              {
                "type":"TASK_CREATE",
                "service_object_id":"$created.opportunity",
                "task_type":"FOLLOW_UP",
                "title":"Follow up converted lead",
                "assign":"owner",
                "due_in_days":2,
                "attrs":{"source":"lead_conversion","opportunity_id":"$created.opportunity"}
              },
              {
                "type":"INFO_RECORD_WRITE",
                "record_type":"CRM_ACTIVITY_LOG",
                "title":"Lead converted",
                "description":"$payload.note",
                "payload":{"opportunity_id":"$created.opportunity"},
                "links":[
                  {
                    "src_kind":"service_object",
                    "src_id":"$service_object_id",
                    "dst_kind":"info_record",
                    "relation_type":"NOTE"
                  }
                ]
              },
              {
                "type":"INSTANCE_START",
                "service_object_id":"$created.opportunity",
                "module":"crm",
                "code":"CRM_OPPORTUNITY_FLOW_V1",
                "idempotency_key_prefix":"lead-convert"
              }
            ]
          }
        ]'::jsonb
      )
    )
)
INSERT INTO eip_core.process_def
  (tenant_id, code, name, version, is_active, graph, attrs)
SELECT
  tenant.id,
  definitions.code,
  definitions.name,
  1,
  true,
  definitions.graph,
  jsonb_build_object(
    'module', 'crm',
    'object_type', definitions.object_type,
    'is_published', true,
    'source', 'crm_module_completion'
  )
FROM eip_core.tenant tenant
CROSS JOIN definitions
ON CONFLICT (tenant_id, code, version) DO UPDATE
SET name=EXCLUDED.name,
    is_active=true,
    graph=EXCLUDED.graph,
    attrs=EXCLUDED.attrs,
    updated_at=now();

WITH definitions AS (
  SELECT tenant_id, id, attrs->>'object_type' AS object_type
  FROM eip_core.process_def
  WHERE code IN ('CRM_INTERACTION_FLOW_V1','CRM_CASE_FLOW_V1','CRM_OPPORTUNITY_FLOW_V1','CRM_LEAD_FLOW_V1')
    AND version=1 AND is_active=true
)
INSERT INTO eip_core.process_binding
  (tenant_id, service_object_type, process_def_id, is_active, priority, attrs)
SELECT tenant_id, object_type, id, true, 50, '{"module":"crm","source":"crm_module_completion"}'::jsonb
FROM definitions
ON CONFLICT (tenant_id, service_object_type, process_def_id, (COALESCE(task_type, ''))) DO UPDATE
SET is_active=true, priority=EXCLUDED.priority, attrs=EXCLUDED.attrs, updated_at=now();

WITH definitions AS (
  SELECT tenant_id, id, attrs->>'object_type' AS object_type
  FROM eip_core.process_def
  WHERE code IN ('CRM_LEAD_FLOW_V1','CRM_CASE_FLOW_V1','CRM_OPPORTUNITY_FLOW_V1')
    AND version=1 AND is_active=true
),
templates(object_type, task_type, title, sort_order) AS (
  VALUES
    ('CRM_LEAD','FOLLOW_UP','Lead follow up',10),
    ('CRM_CASE','FOLLOW_UP','Case follow up',20),
    ('CRM_OPPORTUNITY','FOLLOW_UP','Opportunity follow up',30)
)
INSERT INTO eip_core.task_template
  (tenant_id, process_def_id, service_object_type, task_type, title, is_active, sort_order, attrs)
SELECT d.tenant_id, d.id, d.object_type, t.task_type, t.title, true, t.sort_order,
       '{"module":"crm","source":"crm_module_completion"}'::jsonb
FROM definitions d
JOIN templates t ON t.object_type=d.object_type
ON CONFLICT (tenant_id, process_def_id, (COALESCE(service_object_type,'')), task_type) DO UPDATE
SET title=EXCLUDED.title, is_active=true, sort_order=EXCLUDED.sort_order, attrs=EXCLUDED.attrs, updated_at=now();

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('CRM_LEAD_READ', 'Read CRM leads', 'View CRM leads'),
  ('CRM_LEAD_WRITE', 'Write CRM leads', 'Create and update CRM leads'),
  ('CRM_LEAD_CONVERT', 'Convert CRM leads', 'Convert qualified CRM leads into opportunities'),
  ('CRM_TIMELINE_READ', 'Read CRM timeline', 'View CRM notes and execution timeline'),
  ('CRM_NOTE_WRITE', 'Write CRM notes', 'Add CRM notes and activity logs')
ON CONFLICT (code) DO UPDATE
SET label=EXCLUDED.label, description=EXCLUDED.description;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','CRM_LEAD_READ'),
    ('ADMIN_SUPER','CRM_LEAD_WRITE'),
    ('ADMIN_SUPER','CRM_LEAD_CONVERT'),
    ('ADMIN_SUPER','CRM_TIMELINE_READ'),
    ('ADMIN_SUPER','CRM_NOTE_WRITE'),
    ('ACCESS_UNIVERSAL','CRM_LEAD_READ'),
    ('ACCESS_UNIVERSAL','CRM_LEAD_WRITE'),
    ('ACCESS_UNIVERSAL','CRM_LEAD_CONVERT'),
    ('ACCESS_UNIVERSAL','CRM_TIMELINE_READ'),
    ('ACCESS_UNIVERSAL','CRM_NOTE_WRITE'),
    ('CRM_ADMIN','CRM_LEAD_READ'),
    ('CRM_ADMIN','CRM_LEAD_WRITE'),
    ('CRM_ADMIN','CRM_LEAD_CONVERT'),
    ('CRM_ADMIN','CRM_TIMELINE_READ'),
    ('CRM_ADMIN','CRM_NOTE_WRITE'),
    ('CRM_USER','CRM_LEAD_READ'),
    ('CRM_USER','CRM_LEAD_WRITE'),
    ('CRM_USER','CRM_LEAD_CONVERT'),
    ('CRM_USER','CRM_TIMELINE_READ'),
    ('CRM_USER','CRM_NOTE_WRITE'),
    ('ACCESS_CRM_FULL','CRM_LEAD_READ'),
    ('ACCESS_CRM_FULL','CRM_LEAD_WRITE'),
    ('ACCESS_CRM_FULL','CRM_LEAD_CONVERT'),
    ('ACCESS_CRM_FULL','CRM_TIMELINE_READ'),
    ('ACCESS_CRM_FULL','CRM_NOTE_WRITE'),
    ('ACCESS_READ_ONLY','CRM_LEAD_READ'),
    ('ACCESS_READ_ONLY','CRM_TIMELINE_READ')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT role.id, bundles.permission_code
FROM eip_authz.role role
JOIN bundles ON bundles.role_code=role.code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS so_crm_completion_type_status_created_idx
  ON eip_core.service_object (tenant_id, object_type, status, created_at DESC, id)
  WHERE object_type IN ('CRM_LEAD','CRM_INTERACTION','CRM_CASE','CRM_OPPORTUNITY');

DO $$
DECLARE
  crm_menu jsonb := '{"code":"crm","label":"CRM","icon":"Users","module":"crm"}'::jsonb;
  crm_panel jsonb := '{
    "id":"user-crm-panel",
    "type":"UserPanel",
    "props":{"tab":"crm"},
    "children":[
      {
        "id":"crm-workspace",
        "type":"CrmWorkspace",
        "props":{
          "module":"crm",
          "title":"CRM",
          "subtitle":"Customers, leads, opportunities, cases, interactions, and follow-ups.",
          "tabs":[
            {"id":"overview","label":"Overview","kind":"overview"},
            {"id":"leads","label":"Leads","kind":"service_object","endpoint":"/api/eip/crm/leads","permission":"CRM_LEAD_READ"},
            {"id":"agents","label":"Customers","kind":"agent","endpoint":"/api/eip/crm/agents","permission":"CRM_AGENT_READ"},
            {"id":"opportunities","label":"Opportunities","kind":"service_object","endpoint":"/api/eip/crm/opportunities","permission":"CRM_OPPORTUNITY_READ"},
            {"id":"cases","label":"Cases","kind":"service_object","endpoint":"/api/eip/crm/cases","permission":"CRM_CASE_READ"},
            {"id":"interactions","label":"Interactions","kind":"service_object","endpoint":"/api/eip/crm/interactions","permission":"CRM_INTERACTION_READ"},
            {"id":"tasks","label":"Follow-ups","kind":"task","endpoint":"/api/eip/crm/tasks","permission":"CRM_TASK_READ"}
          ],
          "kpis":[
            {"code":"new_leads","label":"New leads"},
            {"code":"open_leads","label":"Open leads"},
            {"code":"qualified_leads","label":"Qualified leads"},
            {"code":"converted_leads","label":"Converted leads"},
            {"code":"open_opportunities","label":"Open opportunities"},
            {"code":"pipeline_value","label":"Pipeline value","format":"currency"},
            {"code":"weighted_pipeline_value","label":"Weighted pipeline","format":"currency"},
            {"code":"won_value","label":"Won value","format":"currency"},
            {"code":"open_cases","label":"Open cases"},
            {"code":"overdue_follow_ups","label":"Overdue follow-ups"},
            {"code":"tasks_due_today","label":"Tasks due today"}
          ],
          "actions":{"create":"Create","edit":"Edit","note":"Add note","task":"Add follow-up","convert":"Convert lead","refresh":"Refresh"}
        }
      }
    ]
  }'::jsonb;
BEGIN
  UPDATE eip_core.ui_surface
  SET tree=jsonb_set(
        jsonb_set(
          tree,
          '{props,menu}',
          CASE
            WHEN EXISTS (
              SELECT 1 FROM jsonb_array_elements(COALESCE(tree->'props'->'menu','[]'::jsonb)) item
              WHERE item->>'code'='crm'
            )
            THEN COALESCE(tree->'props'->'menu','[]'::jsonb)
            ELSE COALESCE(tree->'props'->'menu','[]'::jsonb) || jsonb_build_array(crm_menu)
          END,
          true
        ),
        '{children}',
        CASE
          WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(tree->'children','[]'::jsonb)) item
            WHERE item->>'id'='user-crm-panel'
          )
          THEN COALESCE(tree->'children','[]'::jsonb)
          ELSE COALESCE(tree->'children','[]'::jsonb) || jsonb_build_array(crm_panel)
        END,
        true
      ),
      updated_at=now()
  WHERE code='dashboard' AND is_active=true AND is_published=true;
END;
$$;

COMMIT;
