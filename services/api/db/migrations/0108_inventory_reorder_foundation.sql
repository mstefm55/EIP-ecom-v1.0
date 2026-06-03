-- 0108_inventory_reorder_foundation.sql
-- Purpose: lightweight SME inventory and reorder governance for V1.
-- Uses existing kernel tables only: material, info_record, service_object,
-- task, dropdowns, process_def/process_binding/task_template, role templates,
-- tenant_module_setting, module_catalog, and UI surfaces.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.seed_inventory_dropdown(
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
  SELECT dropdown_list.id INTO target_list_id
  FROM eip_core.dropdown_list dropdown_list
  WHERE dropdown_list.tenant_id IS NULL
    AND dropdown_list.module='inventory'
    AND dropdown_list.code=list_code
    AND dropdown_list.version=1
  ORDER BY dropdown_list.created_at ASC
  LIMIT 1;

  IF target_list_id IS NULL THEN
    INSERT INTO eip_core.dropdown_list
      (tenant_id, module, code, name, version, is_active, attrs)
    VALUES
      (NULL, 'inventory', list_code, list_name, 1, true, '{"ui":{"module":"inventory","scope":"inventory_reorder"}}'::jsonb)
    RETURNING id INTO target_list_id;
  ELSE
    UPDATE eip_core.dropdown_list
    SET name=list_name,
        is_active=true,
        attrs=COALESCE(attrs,'{}'::jsonb) || '{"ui":{"module":"inventory","scope":"inventory_reorder"}}'::jsonb,
        updated_at=now()
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
        COALESCE((item->>'is_active')::boolean, true),
        COALESCE(item->'attrs', '{}'::jsonb)
      )
    ON CONFLICT (list_id, code) DO UPDATE
      SET label=EXCLUDED.label,
          sort_order=EXCLUDED.sort_order,
          is_active=EXCLUDED.is_active,
          attrs=EXCLUDED.attrs,
          updated_at=now();
  END LOOP;
END;
$$;

SELECT pg_temp.seed_inventory_dropdown('INVENTORY_STOCK_STATUS', 'Inventory Stock Status', '[
  {"code":"in_stock","label":"In stock","sort_order":10},
  {"code":"low_stock","label":"Low stock","sort_order":20},
  {"code":"out_of_stock","label":"Out of stock","sort_order":30},
  {"code":"untracked","label":"Untracked","sort_order":40},
  {"code":"negative_stock","label":"Negative stock","sort_order":50}
]'::jsonb);

SELECT pg_temp.seed_inventory_dropdown('INVENTORY_MOVEMENT_TYPE', 'Inventory Movement Type', '[
  {"code":"opening_balance","label":"Opening balance","sort_order":10},
  {"code":"manual_adjustment","label":"Manual adjustment","sort_order":20},
  {"code":"sale_reservation","label":"Sale reservation","sort_order":30},
  {"code":"sale_issue","label":"Sale issue","sort_order":40},
  {"code":"return_in","label":"Return in","sort_order":50},
  {"code":"purchase_receipt","label":"Purchase receipt","sort_order":60},
  {"code":"stock_count_adjustment","label":"Stock count adjustment","sort_order":70}
]'::jsonb);

SELECT pg_temp.seed_inventory_dropdown('INVENTORY_MOVEMENT_DIRECTION', 'Inventory Movement Direction', '[
  {"code":"in","label":"In","sort_order":10},
  {"code":"out","label":"Out","sort_order":20},
  {"code":"reserve","label":"Reserve","sort_order":30},
  {"code":"release","label":"Release","sort_order":40},
  {"code":"adjust","label":"Adjust","sort_order":50}
]'::jsonb);

SELECT pg_temp.seed_inventory_dropdown('INVENTORY_REORDER_STATUS', 'Inventory Reorder Status', '[
  {"code":"open","label":"Open","sort_order":10},
  {"code":"review","label":"Review","sort_order":20},
  {"code":"approved","label":"Approved","sort_order":30},
  {"code":"ignored","label":"Ignored","sort_order":40},
  {"code":"converted_to_purchase_request","label":"Converted to purchase request","sort_order":50},
  {"code":"closed","label":"Closed","sort_order":60},
  {"code":"failed","label":"Failed","sort_order":70}
]'::jsonb);

SELECT pg_temp.seed_inventory_dropdown('INVENTORY_TASK_TYPE', 'Inventory Task Type', '[
  {"code":"STOCK_REVIEW","label":"Stock review","sort_order":10},
  {"code":"REORDER_REVIEW","label":"Reorder review","sort_order":20},
  {"code":"STOCK_COUNT","label":"Stock count","sort_order":30},
  {"code":"SUPPLIER_CHECK","label":"Supplier check","sort_order":40}
]'::jsonb);

WITH status_list AS (
  SELECT dropdown_list.id
  FROM eip_core.dropdown_list dropdown_list
  WHERE dropdown_list.code='SERVICE_OBJECT_STATUS'
    AND dropdown_list.is_active=true
  ORDER BY (dropdown_list.tenant_id IS NOT NULL) DESC, dropdown_list.version DESC
  LIMIT 1
),
values_to_seed(code, label, sort_order, attrs) AS (
  VALUES
    ('open','Open',120,'{"scope":"status","module":"inventory","object_type":"INVENTORY_REORDER_SUGGESTION"}'::jsonb),
    ('review','Review',122,'{"scope":"status","module":"inventory","object_type":"INVENTORY_REORDER_SUGGESTION"}'::jsonb),
    ('approved','Approved',124,'{"scope":"status","module":"inventory","object_type":"INVENTORY_REORDER_SUGGESTION"}'::jsonb),
    ('ignored','Ignored',126,'{"scope":"status","module":"inventory","object_type":"INVENTORY_REORDER_SUGGESTION"}'::jsonb),
    ('converted_to_purchase_request','Converted to purchase request',128,'{"scope":"status","module":"inventory","object_type":"INVENTORY_REORDER_SUGGESTION"}'::jsonb),
    ('closed','Closed',130,'{"scope":"status","module":"inventory","object_type":"INVENTORY_REORDER_SUGGESTION"}'::jsonb),
    ('failed','Failed',132,'{"scope":"status","module":"inventory","object_type":"INVENTORY_REORDER_SUGGESTION"}'::jsonb)
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT status_list.id, seeded.code, seeded.label, seeded.sort_order, true, seeded.attrs
FROM status_list
CROSS JOIN values_to_seed seeded
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label,
    sort_order=EXCLUDED.sort_order,
    is_active=true,
    attrs=COALESCE(eip_core.dropdown_value.attrs,'{}'::jsonb) || EXCLUDED.attrs,
    updated_at=now();

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('INVENTORY_READ', 'Read inventory', 'View tenant materials, stock profile, movements, and inventory overview'),
  ('INVENTORY_WRITE', 'Write inventory policy', 'Update tenant material stock policy'),
  ('INVENTORY_ADJUST', 'Adjust inventory', 'Create governed stock movements and stock count adjustments'),
  ('INVENTORY_REORDER_READ', 'Read inventory reorder', 'View reorder suggestions'),
  ('INVENTORY_REORDER_WRITE', 'Write inventory reorder', 'Generate, ignore, and task reorder suggestions'),
  ('INVENTORY_REORDER_APPROVE', 'Approve inventory reorder', 'Approve reorder suggestions for purchase preparation')
ON CONFLICT (code) DO UPDATE
SET label=EXCLUDED.label,
    description=EXCLUDED.description;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','INVENTORY_READ'), ('ADMIN_SUPER','INVENTORY_WRITE'), ('ADMIN_SUPER','INVENTORY_ADJUST'),
    ('ADMIN_SUPER','INVENTORY_REORDER_READ'), ('ADMIN_SUPER','INVENTORY_REORDER_WRITE'), ('ADMIN_SUPER','INVENTORY_REORDER_APPROVE'),
    ('ACCESS_UNIVERSAL','INVENTORY_READ'), ('ACCESS_UNIVERSAL','INVENTORY_WRITE'), ('ACCESS_UNIVERSAL','INVENTORY_ADJUST'),
    ('ACCESS_UNIVERSAL','INVENTORY_REORDER_READ'), ('ACCESS_UNIVERSAL','INVENTORY_REORDER_WRITE'), ('ACCESS_UNIVERSAL','INVENTORY_REORDER_APPROVE'),
    ('ECOM_ADMIN','INVENTORY_READ'), ('ECOM_ADMIN','INVENTORY_WRITE'), ('ECOM_ADMIN','INVENTORY_ADJUST'),
    ('ECOM_ADMIN','INVENTORY_REORDER_READ'), ('ECOM_ADMIN','INVENTORY_REORDER_WRITE'), ('ECOM_ADMIN','INVENTORY_REORDER_APPROVE'),
    ('ECOM_USER','INVENTORY_READ'), ('ECOM_USER','INVENTORY_ADJUST'), ('ECOM_USER','INVENTORY_REORDER_READ'), ('ECOM_USER','INVENTORY_REORDER_WRITE'),
    ('ACCESS_ECOM_FULL','INVENTORY_READ'), ('ACCESS_ECOM_FULL','INVENTORY_WRITE'), ('ACCESS_ECOM_FULL','INVENTORY_ADJUST'),
    ('ACCESS_ECOM_FULL','INVENTORY_REORDER_READ'), ('ACCESS_ECOM_FULL','INVENTORY_REORDER_WRITE'),
    ('ACCESS_READ_ONLY','INVENTORY_READ'), ('ACCESS_READ_ONLY','INVENTORY_REORDER_READ')
)
INSERT INTO eip_authz.role_template_permission(role_code, permission_code)
SELECT role_template.code, bundles.permission_code
FROM eip_authz.role_template role_template
JOIN bundles ON bundles.role_code=role_template.code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','INVENTORY_READ'), ('ADMIN_SUPER','INVENTORY_WRITE'), ('ADMIN_SUPER','INVENTORY_ADJUST'),
    ('ADMIN_SUPER','INVENTORY_REORDER_READ'), ('ADMIN_SUPER','INVENTORY_REORDER_WRITE'), ('ADMIN_SUPER','INVENTORY_REORDER_APPROVE'),
    ('ACCESS_UNIVERSAL','INVENTORY_READ'), ('ACCESS_UNIVERSAL','INVENTORY_WRITE'), ('ACCESS_UNIVERSAL','INVENTORY_ADJUST'),
    ('ACCESS_UNIVERSAL','INVENTORY_REORDER_READ'), ('ACCESS_UNIVERSAL','INVENTORY_REORDER_WRITE'), ('ACCESS_UNIVERSAL','INVENTORY_REORDER_APPROVE'),
    ('ECOM_ADMIN','INVENTORY_READ'), ('ECOM_ADMIN','INVENTORY_WRITE'), ('ECOM_ADMIN','INVENTORY_ADJUST'),
    ('ECOM_ADMIN','INVENTORY_REORDER_READ'), ('ECOM_ADMIN','INVENTORY_REORDER_WRITE'), ('ECOM_ADMIN','INVENTORY_REORDER_APPROVE'),
    ('ECOM_USER','INVENTORY_READ'), ('ECOM_USER','INVENTORY_ADJUST'), ('ECOM_USER','INVENTORY_REORDER_READ'), ('ECOM_USER','INVENTORY_REORDER_WRITE'),
    ('ACCESS_ECOM_FULL','INVENTORY_READ'), ('ACCESS_ECOM_FULL','INVENTORY_WRITE'), ('ACCESS_ECOM_FULL','INVENTORY_ADJUST'),
    ('ACCESS_ECOM_FULL','INVENTORY_REORDER_READ'), ('ACCESS_ECOM_FULL','INVENTORY_REORDER_WRITE'),
    ('ACCESS_READ_ONLY','INVENTORY_READ'), ('ACCESS_READ_ONLY','INVENTORY_REORDER_READ')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT role_record.id, bundles.permission_code
FROM eip_authz.role role_record
JOIN bundles ON bundles.role_code=role_record.code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

INSERT INTO eip_core.module_catalog (code, label, description, attrs, is_active)
VALUES
  (
    'inventory',
    'Inventory',
    'Lightweight stock profile, movements, and reorder suggestions for SME operations',
    '{"capabilities":{"overview":true,"materials":true,"movements":true,"reorder":true},"scope":"sme_inventory_reorder"}'::jsonb,
    true
  )
ON CONFLICT (code) DO UPDATE
SET label=EXCLUDED.label,
    description=EXCLUDED.description,
    attrs=COALESCE(eip_core.module_catalog.attrs,'{}'::jsonb) || EXCLUDED.attrs,
    is_active=true,
    updated_at=now();

WITH target_tenants AS (
  SELECT DISTINCT tenant.id
  FROM eip_core.tenant tenant
  LEFT JOIN eip_core.tenant_module_setting ecom_setting
    ON ecom_setting.tenant_id=tenant.id
   AND ecom_setting.module IN ('ecom','commerce')
   AND ecom_setting.is_active=true
  WHERE tenant.is_active=true
    AND (
      tenant.code='eip_ecom'
      OR ecom_setting.id IS NOT NULL
      OR COALESCE(tenant.attrs->>'industry','')='ecom'
      OR COALESCE(tenant.attrs->>'template_kind','')='base'
    )
)
INSERT INTO eip_core.tenant_module_setting (tenant_id, module, code, attrs, is_active)
SELECT target_tenants.id, 'inventory', 'operations',
       '{"capabilities":{"overview":true,"materials":true,"movements":true,"reorder":true},"settings":{"default_unit":"pcs","auto_create_reorder_suggestions":false,"default_reorder_review_mode":"human_review"}}'::jsonb,
       true
FROM target_tenants
ON CONFLICT (tenant_id, module, code) DO UPDATE
SET attrs=jsonb_set(
      COALESCE(eip_core.tenant_module_setting.attrs,'{}'::jsonb),
      '{capabilities}',
      COALESCE(eip_core.tenant_module_setting.attrs->'capabilities','{}'::jsonb) || '{"overview":true,"materials":true,"movements":true,"reorder":true}'::jsonb,
      true
    ),
    is_active=true,
    updated_at=now();

WITH target_tenants AS (
  SELECT DISTINCT tenant.id
  FROM eip_core.tenant tenant
  LEFT JOIN eip_core.tenant_module_setting inventory_setting
    ON inventory_setting.tenant_id=tenant.id
   AND inventory_setting.module='inventory'
   AND inventory_setting.is_active=true
  WHERE tenant.is_active=true
    AND (
      tenant.code='eip_ecom'
      OR inventory_setting.id IS NOT NULL
      OR COALESCE(tenant.attrs->>'industry','')='ecom'
      OR COALESCE(tenant.attrs->>'template_kind','')='base'
    )
),
definitions(code, name, object_type, graph) AS (
  VALUES
    (
      'INVENTORY_REORDER_FLOW_V1',
      'Inventory reorder review flow',
      'INVENTORY_REORDER_SUGGESTION',
      '{
        "module":"inventory",
        "object_type":"INVENTORY_REORDER_SUGGESTION",
        "initial_node":"open",
        "nodes":{
          "open":{"id":"open","type":"TRIGGER","label":"Open","on_enter":{"task_template_types":["REORDER_REVIEW"]}},
          "review":{"id":"review","type":"HUMAN_TASK","label":"Review"},
          "approved":{"id":"approved","type":"STEP","label":"Approved"},
          "ignored":{"id":"ignored","type":"END","label":"Ignored","is_terminal":true},
          "converted_to_purchase_request":{"id":"converted_to_purchase_request","type":"STEP","label":"Converted to purchase request"},
          "closed":{"id":"closed","type":"END","label":"Closed","is_terminal":true},
          "failed":{"id":"failed","type":"END","label":"Failed","is_terminal":true}
        },
        "transitions":[
          {"from":"open","to":"review","action":"review","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"review"}]},
          {"from":"open","to":"approved","action":"approve","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"approved"},{"type":"INFO_RECORD_WRITE","record_type":"INVENTORY_REORDER_DECISION","title":"Reorder suggestion approved","payload":{"decision":"approved","note":"$payload.note"},"attrs":{"module":"inventory"},"links":[{"src_kind":"service_object","src_id":"$service_object_id","dst_kind":"info_record","relation_type":"DECISION"}]}]},
          {"from":"review","to":"approved","action":"approve","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"approved"},{"type":"INFO_RECORD_WRITE","record_type":"INVENTORY_REORDER_DECISION","title":"Reorder suggestion approved","payload":{"decision":"approved","note":"$payload.note"},"attrs":{"module":"inventory"},"links":[{"src_kind":"service_object","src_id":"$service_object_id","dst_kind":"info_record","relation_type":"DECISION"}]}]},
          {"from":"open","to":"ignored","action":"ignore","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"ignored"},{"type":"INFO_RECORD_WRITE","record_type":"INVENTORY_REORDER_DECISION","title":"Reorder suggestion ignored","payload":{"decision":"ignored","note":"$payload.note"},"attrs":{"module":"inventory"},"links":[{"src_kind":"service_object","src_id":"$service_object_id","dst_kind":"info_record","relation_type":"DECISION"}]}]},
          {"from":"review","to":"ignored","action":"ignore","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"ignored"},{"type":"INFO_RECORD_WRITE","record_type":"INVENTORY_REORDER_DECISION","title":"Reorder suggestion ignored","payload":{"decision":"ignored","note":"$payload.note"},"attrs":{"module":"inventory"},"links":[{"src_kind":"service_object","src_id":"$service_object_id","dst_kind":"info_record","relation_type":"DECISION"}]}]},
          {"from":"approved","to":"converted_to_purchase_request","action":"convert_to_purchase_request","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"converted_to_purchase_request"}]},
          {"from":"approved","to":"closed","action":"close","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"closed"}]},
          {"from":"converted_to_purchase_request","to":"closed","action":"close","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"closed"}]},
          {"from":"open","to":"failed","action":"fail","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"failed"}]},
          {"from":"review","to":"failed","action":"fail","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"failed"}]}
        ]
      }'::jsonb
    ),
    (
      'INVENTORY_STOCK_REVIEW_FLOW_V1',
      'Inventory stock review flow',
      'INVENTORY_STOCK_REVIEW',
      '{
        "module":"inventory",
        "object_type":"INVENTORY_STOCK_REVIEW",
        "initial_node":"review",
        "nodes":{
          "review":{"id":"review","type":"HUMAN_TASK","label":"Review","on_enter":{"task_template_types":["STOCK_REVIEW"]}},
          "closed":{"id":"closed","type":"END","label":"Closed","is_terminal":true},
          "failed":{"id":"failed","type":"END","label":"Failed","is_terminal":true}
        },
        "transitions":[
          {"from":"review","to":"closed","action":"close","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"closed"}]},
          {"from":"review","to":"failed","action":"fail","edge_type":"DEFAULT","effects":[{"type":"STATUS_SET","to":"failed"}]}
        ]
      }'::jsonb
    )
)
INSERT INTO eip_core.process_def
  (tenant_id, code, name, version, is_active, graph, attrs)
SELECT
  target_tenants.id,
  definitions.code,
  definitions.name,
  1,
  true,
  definitions.graph,
  jsonb_build_object(
    'module', 'inventory',
    'object_type', definitions.object_type,
    'is_published', true,
    'source', 'inventory_reorder_foundation'
  )
FROM target_tenants
CROSS JOIN definitions
ON CONFLICT (tenant_id, code, version) DO UPDATE
SET name=EXCLUDED.name,
    is_active=true,
    graph=EXCLUDED.graph,
    attrs=EXCLUDED.attrs,
    updated_at=now();

WITH definitions AS (
  SELECT process_def.tenant_id, process_def.id, process_def.attrs->>'object_type' AS object_type
  FROM eip_core.process_def process_def
  WHERE process_def.code IN ('INVENTORY_REORDER_FLOW_V1','INVENTORY_STOCK_REVIEW_FLOW_V1')
    AND process_def.version=1
    AND process_def.is_active=true
)
INSERT INTO eip_core.process_binding
  (tenant_id, service_object_type, process_def_id, is_active, priority, attrs)
SELECT definitions.tenant_id, definitions.object_type, definitions.id, true, 45,
       '{"module":"inventory","source":"inventory_reorder_foundation"}'::jsonb
FROM definitions
ON CONFLICT (tenant_id, service_object_type, process_def_id, (COALESCE(task_type, ''))) DO UPDATE
SET is_active=true,
    priority=EXCLUDED.priority,
    attrs=EXCLUDED.attrs,
    updated_at=now();

WITH definitions AS (
  SELECT process_def.tenant_id, process_def.id, process_def.attrs->>'object_type' AS object_type
  FROM eip_core.process_def process_def
  WHERE process_def.code IN ('INVENTORY_REORDER_FLOW_V1','INVENTORY_STOCK_REVIEW_FLOW_V1')
    AND process_def.version=1
    AND process_def.is_active=true
),
templates(object_type, task_type, title, description, sort_order, attrs) AS (
  VALUES
    ('INVENTORY_REORDER_SUGGESTION','REORDER_REVIEW','Review reorder suggestion','Review low stock, preferred supplier, and suggested quantity before purchase preparation.',10,'{"module":"inventory","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"medium","due_in_days":2},"due_in_days":2}'::jsonb),
    ('INVENTORY_REORDER_SUGGESTION','SUPPLIER_CHECK','Check supplier before purchase','Check supplier availability, lead time, and price before purchase commitment.',20,'{"module":"inventory","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"medium","due_in_days":3},"due_in_days":3}'::jsonb),
    ('INVENTORY_STOCK_REVIEW','STOCK_REVIEW','Review low-stock item','Review stock status, recent movement history, and reorder policy.',10,'{"module":"inventory","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"medium","due_in_days":2},"due_in_days":2}'::jsonb),
    ('INVENTORY_STOCK_REVIEW','STOCK_COUNT','Perform stock count','Count physical stock and reconcile differences through a governed movement.',20,'{"module":"inventory","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"medium","due_in_days":5},"due_in_days":5}'::jsonb)
)
INSERT INTO eip_core.task_template
  (tenant_id, process_def_id, service_object_type, task_type, title, description, is_active, sort_order, attrs)
SELECT definitions.tenant_id, definitions.id, definitions.object_type, templates.task_type, templates.title,
       templates.description, true, templates.sort_order, templates.attrs
FROM definitions
JOIN templates ON templates.object_type=definitions.object_type
ON CONFLICT (tenant_id, process_def_id, (COALESCE(service_object_type,'')), task_type) DO UPDATE
SET title=EXCLUDED.title,
    description=EXCLUDED.description,
    is_active=true,
    sort_order=EXCLUDED.sort_order,
    attrs=EXCLUDED.attrs,
    updated_at=now();

CREATE INDEX IF NOT EXISTS material_inventory_stock_status_idx
  ON eip_core.material (tenant_id, ((attrs->'inventory'->>'stock_status')))
  WHERE is_active=true;

CREATE INDEX IF NOT EXISTS info_record_inventory_movement_idx
  ON eip_core.info_record (tenant_id, record_type, created_at DESC, id)
  WHERE record_type IN ('INVENTORY_STOCK_MOVEMENT','INVENTORY_POLICY_UPDATED','INVENTORY_REORDER_DECISION');

CREATE INDEX IF NOT EXISTS service_object_inventory_reorder_idx
  ON eip_core.service_object (tenant_id, object_type, status, created_at DESC, id)
  WHERE object_type='INVENTORY_REORDER_SUGGESTION';

CREATE INDEX IF NOT EXISTS service_object_inventory_reorder_material_idx
  ON eip_core.service_object (tenant_id, ((attrs->>'material_id')), status)
  WHERE object_type='INVENTORY_REORDER_SUGGESTION';

DO $$
DECLARE
  inventory_menu jsonb := '{"code":"inventory","label":"Inventory","icon":"Package","module":"inventory"}'::jsonb;
  inventory_panel jsonb := '{
    "id":"user-inventory-panel",
    "type":"UserPanel",
    "props":{"tab":"inventory"},
    "children":[
      {
        "id":"inventory-workspace",
        "type":"InventoryWorkspace",
        "props":{
          "module":"inventory",
          "title":"Inventory",
          "subtitle":"Stock alerts, material balances, movements, and reorder suggestions for daily SME operations.",
          "endpoints":{
            "overview":"/api/eip/inventory/overview",
            "materials":"/api/eip/inventory/materials",
            "suggestions":"/api/eip/inventory/reorder-suggestions"
          },
          "tabs":[
            {"id":"overview","label":"Overview"},
            {"id":"alerts","label":"Stock Alerts"},
            {"id":"materials","label":"Materials"},
            {"id":"suggestions","label":"Reorder Suggestions"},
            {"id":"movements","label":"Movements"}
          ],
          "actions":{
            "refresh":"Refresh",
            "runReorder":"Run low-stock scan",
            "adjust":"Adjust stock",
            "policy":"Set reorder policy",
            "movements":"View movements",
            "createSuggestion":"Create reorder suggestion",
            "approve":"Approve",
            "ignore":"Ignore",
            "createTask":"Create task"
          }
        }
      }
    ]
  }'::jsonb;
  surface_record record;
  next_menu jsonb;
  next_children jsonb;
BEGIN
  FOR surface_record IN
    SELECT ui_surface.id, ui_surface.tree
    FROM eip_core.ui_surface ui_surface
    WHERE ui_surface.code='dashboard'
      AND ui_surface.is_active=true
      AND ui_surface.is_published=true
  LOOP
    next_menu := COALESCE(surface_record.tree#>'{props,menu}','[]'::jsonb);
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(next_menu) existing_menu
      WHERE existing_menu->>'code'='inventory'
    ) THEN
      next_menu := next_menu || jsonb_build_array(inventory_menu);
    END IF;

    next_children := COALESCE(surface_record.tree->'children','[]'::jsonb);
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(next_children) existing_child
      WHERE existing_child->>'id'='user-inventory-panel'
    ) THEN
      next_children := next_children || jsonb_build_array(inventory_panel);
    END IF;

    UPDATE eip_core.ui_surface
    SET tree = jsonb_set(
          jsonb_set(surface_record.tree, '{props,menu}', next_menu, true),
          '{children}',
          next_children,
          true
        ),
        attrs = COALESCE(attrs,'{}'::jsonb) || '{"module":"dashboard","inventory_surface":true}'::jsonb,
        updated_at=now()
    WHERE id=surface_record.id;
  END LOOP;
END;
$$;

COMMIT;
