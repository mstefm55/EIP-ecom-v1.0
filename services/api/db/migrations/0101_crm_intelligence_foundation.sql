-- CRM Intelligence foundation: governed segments, campaigns, signals, connector
-- readiness metadata, descriptor tabs, and reusable process bindings.
-- No CRM-specific persistence tables are introduced.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.seed_crm_intelligence_dropdown(
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
      (NULL, 'crm', list_code, list_name, 1, true, '{"ui":{"module":"crm","area":"intelligence"}}'::jsonb)
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

SELECT pg_temp.seed_crm_intelligence_dropdown('CRM_SEGMENT_TYPE', 'CRM Segment Type', '[
  {"code":"market_group","label":"Market group","sort_order":10},
  {"code":"cohort","label":"Cohort","sort_order":20},
  {"code":"account_group","label":"Account group","sort_order":30},
  {"code":"product_interest","label":"Product interest","sort_order":40},
  {"code":"geography","label":"Geography","sort_order":50}
]'::jsonb);

SELECT pg_temp.seed_crm_intelligence_dropdown('CRM_SEGMENT_PRIORITY', 'CRM Segment Priority', '[
  {"code":"low","label":"Low","sort_order":10},
  {"code":"medium","label":"Medium","sort_order":20},
  {"code":"high","label":"High","sort_order":30}
]'::jsonb);

SELECT pg_temp.seed_crm_intelligence_dropdown('CRM_SEGMENT_MATURITY', 'CRM Segment Maturity', '[
  {"code":"early","label":"Early","sort_order":10},
  {"code":"developing","label":"Developing","sort_order":20},
  {"code":"established","label":"Established","sort_order":30}
]'::jsonb);

SELECT pg_temp.seed_crm_intelligence_dropdown('CRM_CAMPAIGN_STATUS', 'CRM Campaign Status', '[
  {"code":"draft","label":"Draft","sort_order":10},
  {"code":"review","label":"Review","sort_order":20},
  {"code":"approved","label":"Approved","sort_order":30},
  {"code":"scheduled","label":"Scheduled","sort_order":40},
  {"code":"active","label":"Active","sort_order":50},
  {"code":"paused","label":"Paused","sort_order":60},
  {"code":"completed","label":"Completed","sort_order":80},
  {"code":"cancelled","label":"Cancelled","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_crm_intelligence_dropdown('CRM_CAMPAIGN_OBJECTIVE', 'CRM Campaign Objective', '[
  {"code":"awareness","label":"Awareness","sort_order":10},
  {"code":"engagement","label":"Engagement","sort_order":20},
  {"code":"lead_generation","label":"Lead generation","sort_order":30},
  {"code":"conversion","label":"Conversion","sort_order":40},
  {"code":"retention","label":"Retention","sort_order":50}
]'::jsonb);

SELECT pg_temp.seed_crm_intelligence_dropdown('CRM_CAMPAIGN_CHANNEL', 'CRM Campaign Channel', '[
  {"code":"website","label":"Website","sort_order":10},
  {"code":"storefront","label":"Storefront","sort_order":20},
  {"code":"email","label":"Email","sort_order":30},
  {"code":"instagram","label":"Instagram","sort_order":40},
  {"code":"facebook","label":"Facebook","sort_order":50},
  {"code":"tiktok","label":"TikTok","sort_order":60},
  {"code":"pinterest","label":"Pinterest","sort_order":70},
  {"code":"linkedin","label":"LinkedIn","sort_order":80},
  {"code":"youtube","label":"YouTube","sort_order":90},
  {"code":"google_ads","label":"Google Ads","sort_order":100},
  {"code":"meta_ads","label":"Meta Ads","sort_order":110}
]'::jsonb);

SELECT pg_temp.seed_crm_intelligence_dropdown('CRM_CHANNEL_VARIANT_STATUS', 'CRM Channel Variant Status', '[
  {"code":"draft","label":"Draft","sort_order":10},
  {"code":"review","label":"Review","sort_order":20},
  {"code":"approved","label":"Approved","sort_order":30},
  {"code":"scheduled","label":"Scheduled","sort_order":40},
  {"code":"ready","label":"Ready","sort_order":50},
  {"code":"disabled","label":"Disabled","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_crm_intelligence_dropdown('CRM_SIGNAL_TYPE', 'CRM Signal Type', '[
  {"code":"content_view","label":"Content view","sort_order":10},
  {"code":"content_click","label":"Content click","sort_order":20},
  {"code":"product_interest","label":"Product interest","sort_order":30},
  {"code":"cart_activity","label":"Cart activity","sort_order":40},
  {"code":"commerce_event","label":"Commerce event","sort_order":50},
  {"code":"campaign_response","label":"Campaign response","sort_order":60},
  {"code":"manual_observation","label":"Manual observation","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_crm_intelligence_dropdown('CRM_SIGNAL_PROVIDER_CATEGORY', 'CRM Signal Provider Category', '[
  {"code":"manual","label":"Manual","sort_order":10},
  {"code":"website_analytics","label":"Website analytics","sort_order":20},
  {"code":"social_media","label":"Social media","sort_order":30},
  {"code":"ad_platform","label":"Ad platform","sort_order":40},
  {"code":"email_marketing","label":"Email marketing","sort_order":50},
  {"code":"commerce_events","label":"Commerce events","sort_order":60},
  {"code":"payment_order_signals","label":"Payment and order signals","sort_order":70}
]'::jsonb);

SELECT pg_temp.seed_crm_intelligence_dropdown('CRM_SIGNAL_SOURCE_CHANNEL', 'CRM Signal Source Channel', '[
  {"code":"manual","label":"Manual","sort_order":10},
  {"code":"website","label":"Website","sort_order":20},
  {"code":"storefront","label":"Storefront","sort_order":30},
  {"code":"social","label":"Social","sort_order":40},
  {"code":"email","label":"Email","sort_order":50},
  {"code":"ads","label":"Ads","sort_order":60},
  {"code":"commerce","label":"Commerce","sort_order":70},
  {"code":"payments","label":"Payments","sort_order":80}
]'::jsonb);

SELECT pg_temp.seed_crm_intelligence_dropdown('CRM_CONNECTOR_READINESS_STATUS', 'CRM Connector Readiness Status', '[
  {"code":"available","label":"Available","sort_order":10},
  {"code":"configured","label":"Configured","sort_order":20},
  {"code":"enabled","label":"Enabled","sort_order":30},
  {"code":"degraded","label":"Degraded","sort_order":40},
  {"code":"disabled","label":"Disabled","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_crm_intelligence_dropdown('CRM_CONNECTOR_PROVIDER', 'CRM Connector Provider', '[
  {"code":"ga4","label":"Google Analytics 4","sort_order":10,"attrs":{"category":"website_analytics","module_dependency":"crm"}},
  {"code":"search_console","label":"Search Console","sort_order":20,"attrs":{"category":"website_analytics","module_dependency":"crm"}},
  {"code":"instagram","label":"Instagram","sort_order":30,"attrs":{"category":"social_media","module_dependency":"crm"}},
  {"code":"facebook","label":"Facebook","sort_order":40,"attrs":{"category":"social_media","module_dependency":"crm"}},
  {"code":"tiktok","label":"TikTok","sort_order":50,"attrs":{"category":"social_media","module_dependency":"crm"}},
  {"code":"pinterest","label":"Pinterest","sort_order":60,"attrs":{"category":"social_media","module_dependency":"crm"}},
  {"code":"linkedin","label":"LinkedIn","sort_order":70,"attrs":{"category":"social_media","module_dependency":"crm"}},
  {"code":"youtube","label":"YouTube","sort_order":80,"attrs":{"category":"social_media","module_dependency":"crm"}},
  {"code":"google_ads","label":"Google Ads","sort_order":90,"attrs":{"category":"ad_platform","module_dependency":"crm"}},
  {"code":"meta_ads","label":"Meta Ads","sort_order":100,"attrs":{"category":"ad_platform","module_dependency":"crm"}},
  {"code":"mailchimp","label":"Mailchimp","sort_order":110,"attrs":{"category":"email_marketing","module_dependency":"crm"}},
  {"code":"brevo","label":"Brevo","sort_order":120,"attrs":{"category":"email_marketing","module_dependency":"crm"}},
  {"code":"klaviyo","label":"Klaviyo","sort_order":130,"attrs":{"category":"email_marketing","module_dependency":"crm"}},
  {"code":"custom_storefront","label":"Custom storefront","sort_order":140,"attrs":{"category":"commerce_events","module_dependency":"ecom"}},
  {"code":"shopify","label":"Shopify","sort_order":150,"attrs":{"category":"commerce_events","module_dependency":"ecom"}},
  {"code":"woocommerce","label":"WooCommerce","sort_order":160,"attrs":{"category":"commerce_events","module_dependency":"ecom"}},
  {"code":"stripe","label":"Stripe","sort_order":170,"attrs":{"category":"payment_order_signals","module_dependency":"ecom"}},
  {"code":"checkout_com","label":"Checkout.com","sort_order":180,"attrs":{"category":"payment_order_signals","module_dependency":"ecom"}},
  {"code":"paypal","label":"PayPal","sort_order":190,"attrs":{"category":"payment_order_signals","module_dependency":"ecom"}}
]'::jsonb);

WITH status_list AS (
  SELECT id FROM eip_core.dropdown_list
  WHERE code='SERVICE_OBJECT_STATUS' AND is_active=true
  ORDER BY (tenant_id IS NOT NULL) DESC, version DESC LIMIT 1
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT status_list.id, value.code, value.label, value.sort_order, true, '{"module":"crm","area":"intelligence"}'::jsonb
FROM status_list
CROSS JOIN (VALUES
  ('draft','Draft',5),
  ('review','Review',15),
  ('approved','Approved',20),
  ('scheduled','Scheduled',35),
  ('active','Active',45),
  ('paused','Paused',55),
  ('completed','Completed',85)
) AS value(code,label,sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label, sort_order=EXCLUDED.sort_order, is_active=true, attrs=EXCLUDED.attrs;

SELECT pg_temp.seed_crm_intelligence_dropdown('PROCESS_ACTION', 'Process Action', '[
  {"code":"update","label":"Update","sort_order":10},
  {"code":"task.create","label":"Create task","sort_order":20},
  {"code":"task.status","label":"Update task status","sort_order":30},
  {"code":"draft","label":"Draft","sort_order":190},
  {"code":"review","label":"Review","sort_order":200},
  {"code":"approved","label":"Approved","sort_order":210},
  {"code":"scheduled","label":"Scheduled","sort_order":220},
  {"code":"active","label":"Active","sort_order":230},
  {"code":"paused","label":"Paused","sort_order":240},
  {"code":"completed","label":"Completed","sort_order":250},
  {"code":"cancelled","label":"Cancelled","sort_order":260}
]'::jsonb);

CREATE OR REPLACE FUNCTION pg_temp.crm_intelligence_process_graph(
  object_type text,
  initial_node text,
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
      )
    );
  END LOOP;

  FOR extra IN SELECT value FROM jsonb_array_elements(extra_transitions)
  LOOP
    transitions := transitions || jsonb_build_array(
      jsonb_build_object(
        'from', extra->>'from',
        'to', extra->>'to',
        'action', extra->>'action',
        'edge_type', 'DEFAULT',
        'effects', jsonb_build_array(jsonb_build_object('type', 'STATUS_SET', 'to', extra->>'to'))
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'module', 'crm',
    'area', 'intelligence',
    'object_type', object_type,
    'initial_node', initial_node,
    'nodes', nodes,
    'transitions', transitions
  );
END;
$$;

WITH definitions(code, name, object_type, graph) AS (
  VALUES
    (
      'CRM_CAMPAIGN_FLOW_V1',
      'CRM campaign flow',
      'CRM_CAMPAIGN',
      pg_temp.crm_intelligence_process_graph(
        'CRM_CAMPAIGN',
        'draft',
        ARRAY['draft','review','approved','scheduled','active','paused','completed','cancelled']::text[],
        '[
          {"from":"draft","to":"review","action":"review"},
          {"from":"draft","to":"cancelled","action":"cancelled"},
          {"from":"review","to":"approved","action":"approved"},
          {"from":"review","to":"draft","action":"draft"},
          {"from":"review","to":"cancelled","action":"cancelled"},
          {"from":"approved","to":"scheduled","action":"scheduled"},
          {"from":"approved","to":"active","action":"active"},
          {"from":"approved","to":"cancelled","action":"cancelled"},
          {"from":"scheduled","to":"active","action":"active"},
          {"from":"scheduled","to":"cancelled","action":"cancelled"},
          {"from":"active","to":"paused","action":"paused"},
          {"from":"active","to":"completed","action":"completed"},
          {"from":"paused","to":"active","action":"active"},
          {"from":"paused","to":"completed","action":"completed"},
          {"from":"paused","to":"cancelled","action":"cancelled"}
        ]'::jsonb
      )
    ),
    (
      'CRM_SEGMENT_REVIEW_FLOW_V1',
      'CRM segment review work flow',
      'CRM_SEGMENT_REVIEW',
      pg_temp.crm_intelligence_process_graph(
        'CRM_SEGMENT_REVIEW',
        'new',
        ARRAY['new']::text[],
        '[]'::jsonb
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
    'area', 'intelligence',
    'object_type', definitions.object_type,
    'is_published', true,
    'source', 'crm_intelligence_foundation'
  )
FROM eip_core.tenant tenant
CROSS JOIN definitions
ON CONFLICT (tenant_id, code, version) DO UPDATE
SET name=EXCLUDED.name, is_active=true, graph=EXCLUDED.graph, attrs=EXCLUDED.attrs, updated_at=now();

WITH definitions AS (
  SELECT tenant_id, id, attrs->>'object_type' AS object_type
  FROM eip_core.process_def
  WHERE code IN ('CRM_CAMPAIGN_FLOW_V1','CRM_SEGMENT_REVIEW_FLOW_V1')
    AND version=1 AND is_active=true
)
INSERT INTO eip_core.process_binding
  (tenant_id, service_object_type, process_def_id, is_active, priority, attrs)
SELECT tenant_id, object_type, id, true, 50, '{"module":"crm","area":"intelligence","source":"crm_intelligence_foundation"}'::jsonb
FROM definitions
ON CONFLICT (tenant_id, service_object_type, process_def_id, (COALESCE(task_type, ''))) DO UPDATE
SET is_active=true, priority=EXCLUDED.priority, attrs=EXCLUDED.attrs, updated_at=now();

WITH definitions AS (
  SELECT tenant_id, id, attrs->>'object_type' AS object_type
  FROM eip_core.process_def
  WHERE code IN ('CRM_CAMPAIGN_FLOW_V1','CRM_SEGMENT_REVIEW_FLOW_V1')
    AND version=1 AND is_active=true
),
templates(object_type, task_type, title, sort_order) AS (
  VALUES
    ('CRM_CAMPAIGN','FOLLOW_UP','Campaign follow up',10),
    ('CRM_CAMPAIGN','APPROVAL','Campaign approval',20),
    ('CRM_SEGMENT_REVIEW','FOLLOW_UP','Segment follow up',30)
)
INSERT INTO eip_core.task_template
  (tenant_id, process_def_id, service_object_type, task_type, title, is_active, sort_order, attrs)
SELECT definitions.tenant_id, definitions.id, definitions.object_type, templates.task_type,
       templates.title, true, templates.sort_order,
       '{"module":"crm","area":"intelligence","source":"crm_intelligence_foundation"}'::jsonb
FROM definitions
JOIN templates ON templates.object_type=definitions.object_type
ON CONFLICT (tenant_id, process_def_id, (COALESCE(service_object_type,'')), task_type) DO UPDATE
SET title=EXCLUDED.title, is_active=true, sort_order=EXCLUDED.sort_order, attrs=EXCLUDED.attrs, updated_at=now();

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('CRM_SEGMENT_READ', 'Read CRM segments', 'View CRM market groups and segments'),
  ('CRM_SEGMENT_WRITE', 'Write CRM segments', 'Create and update CRM market groups and segments'),
  ('CRM_CAMPAIGN_READ', 'Read CRM campaigns', 'View CRM campaigns and channel variants'),
  ('CRM_CAMPAIGN_WRITE', 'Write CRM campaigns', 'Create, update, and transition CRM campaigns'),
  ('CRM_SIGNAL_READ', 'Read CRM signals', 'View redacted CRM intelligence signals'),
  ('CRM_SIGNAL_WRITE', 'Write CRM signals', 'Create and link redacted CRM intelligence signals'),
  ('CRM_INTELLIGENCE_READ', 'Read CRM intelligence', 'View CRM intelligence KPIs and capability state'),
  ('CRM_CONNECTOR_READ', 'Read CRM connector readiness', 'View redacted connector readiness metadata')
ON CONFLICT (code) DO UPDATE
SET label=EXCLUDED.label, description=EXCLUDED.description;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','CRM_SEGMENT_READ'), ('ADMIN_SUPER','CRM_SEGMENT_WRITE'),
    ('ADMIN_SUPER','CRM_CAMPAIGN_READ'), ('ADMIN_SUPER','CRM_CAMPAIGN_WRITE'),
    ('ADMIN_SUPER','CRM_SIGNAL_READ'), ('ADMIN_SUPER','CRM_SIGNAL_WRITE'),
    ('ADMIN_SUPER','CRM_INTELLIGENCE_READ'), ('ADMIN_SUPER','CRM_CONNECTOR_READ'),
    ('ACCESS_UNIVERSAL','CRM_SEGMENT_READ'), ('ACCESS_UNIVERSAL','CRM_SEGMENT_WRITE'),
    ('ACCESS_UNIVERSAL','CRM_CAMPAIGN_READ'), ('ACCESS_UNIVERSAL','CRM_CAMPAIGN_WRITE'),
    ('ACCESS_UNIVERSAL','CRM_SIGNAL_READ'), ('ACCESS_UNIVERSAL','CRM_SIGNAL_WRITE'),
    ('ACCESS_UNIVERSAL','CRM_INTELLIGENCE_READ'), ('ACCESS_UNIVERSAL','CRM_CONNECTOR_READ'),
    ('CRM_ADMIN','CRM_SEGMENT_READ'), ('CRM_ADMIN','CRM_SEGMENT_WRITE'),
    ('CRM_ADMIN','CRM_CAMPAIGN_READ'), ('CRM_ADMIN','CRM_CAMPAIGN_WRITE'),
    ('CRM_ADMIN','CRM_SIGNAL_READ'), ('CRM_ADMIN','CRM_SIGNAL_WRITE'),
    ('CRM_ADMIN','CRM_INTELLIGENCE_READ'), ('CRM_ADMIN','CRM_CONNECTOR_READ'),
    ('CRM_USER','CRM_SEGMENT_READ'), ('CRM_USER','CRM_SEGMENT_WRITE'),
    ('CRM_USER','CRM_CAMPAIGN_READ'), ('CRM_USER','CRM_CAMPAIGN_WRITE'),
    ('CRM_USER','CRM_SIGNAL_READ'), ('CRM_USER','CRM_SIGNAL_WRITE'),
    ('CRM_USER','CRM_INTELLIGENCE_READ'), ('CRM_USER','CRM_CONNECTOR_READ'),
    ('ACCESS_CRM_FULL','CRM_SEGMENT_READ'), ('ACCESS_CRM_FULL','CRM_SEGMENT_WRITE'),
    ('ACCESS_CRM_FULL','CRM_CAMPAIGN_READ'), ('ACCESS_CRM_FULL','CRM_CAMPAIGN_WRITE'),
    ('ACCESS_CRM_FULL','CRM_SIGNAL_READ'), ('ACCESS_CRM_FULL','CRM_SIGNAL_WRITE'),
    ('ACCESS_CRM_FULL','CRM_INTELLIGENCE_READ'), ('ACCESS_CRM_FULL','CRM_CONNECTOR_READ'),
    ('ACCESS_READ_ONLY','CRM_SEGMENT_READ'), ('ACCESS_READ_ONLY','CRM_CAMPAIGN_READ'),
    ('ACCESS_READ_ONLY','CRM_SIGNAL_READ'), ('ACCESS_READ_ONLY','CRM_INTELLIGENCE_READ'),
    ('ACCESS_READ_ONLY','CRM_CONNECTOR_READ')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT role.id, bundles.permission_code
FROM eip_authz.role role
JOIN bundles ON bundles.role_code=role.code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

UPDATE eip_core.tenant_module_setting
SET attrs=jsonb_set(
      COALESCE(attrs,'{}'::jsonb),
      '{capabilities}',
      COALESCE(attrs->'capabilities','{}'::jsonb) || '{
        "basic":true,
        "segments":true,
        "campaigns":true,
        "signals":true,
        "intelligence":true,
        "connectors":true
      }'::jsonb,
      true
    ),
    updated_at=now()
WHERE module='crm' AND code='subscription' AND is_active=true;

UPDATE eip_core.module_catalog
SET attrs=jsonb_set(
      COALESCE(attrs,'{}'::jsonb),
      '{capabilities}',
      COALESCE(attrs->'capabilities','{}'::jsonb) || '{
        "basic":true,
        "segments":true,
        "campaigns":true,
        "signals":true,
        "intelligence":true,
        "connectors":true
      }'::jsonb,
      true
    ),
    updated_at=now()
WHERE code='crm';

CREATE INDEX IF NOT EXISTS so_crm_campaign_status_created_idx
  ON eip_core.service_object (tenant_id, status, created_at DESC, id)
  WHERE object_type='CRM_CAMPAIGN';

CREATE INDEX IF NOT EXISTS agent_crm_segment_updated_idx
  ON eip_core.agent (tenant_id, updated_at DESC, id)
  WHERE upper(agent_type) IN ('SEGMENT','MARKET_GROUP');

CREATE INDEX IF NOT EXISTS info_record_crm_signal_created_idx
  ON eip_core.info_record (tenant_id, created_at DESC, id)
  WHERE record_type IN ('CRM_SIGNAL','CRM_CAMPAIGN_SIGNAL');

DO $$
DECLARE
  surface_row record;
  root_child jsonb;
  panel_child jsonb;
  tabs jsonb;
  tab jsonb;
  next_root_children jsonb;
  next_panel_children jsonb;
  intelligence_tabs jsonb := '[
    {"id":"intelligence","label":"Intelligence","kind":"intelligence","endpoint":"/api/eip/crm/intelligence/overview","permission":"CRM_INTELLIGENCE_READ","capability":"intelligence"},
    {"id":"segments","label":"Segments","kind":"agent","endpoint":"/api/eip/crm/segments","permission":"CRM_SEGMENT_READ","capability":"segments"},
    {"id":"campaigns","label":"Campaigns","kind":"service_object","endpoint":"/api/eip/crm/campaigns","permission":"CRM_CAMPAIGN_READ","capability":"campaigns"},
    {"id":"signals","label":"Signals","kind":"info_record","endpoint":"/api/eip/crm/signals","permission":"CRM_SIGNAL_READ","capability":"signals"},
    {"id":"connectors","label":"Connectors","kind":"connector","endpoint":"/api/eip/crm/intelligence/connectors","permission":"CRM_CONNECTOR_READ","capability":"connectors"}
  ]'::jsonb;
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
            FOR tab IN SELECT value FROM jsonb_array_elements(intelligence_tabs)
            LOOP
              IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(tabs) existing_tab WHERE existing_tab->>'id'=tab->>'id') THEN
                tabs := tabs || jsonb_build_array(tab);
              END IF;
            END LOOP;
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
