-- 0125_inventory_management_v1.sql
-- Purpose: production-capable Inventory Management V1 on existing kernel tables.
-- Uses eip_core.material, material_lot, material_lot_status_event,
-- agent, commercial_condition, info_record, object_link, service_object, and task.
-- No new tables.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.seed_inventory_management_dropdown(
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
    AND dropdown_list.module='inventory'
    AND dropdown_list.code=p_list_code
    AND dropdown_list.version=1
  ORDER BY dropdown_list.created_at ASC
  LIMIT 1;

  IF target_list_id IS NULL THEN
    INSERT INTO eip_core.dropdown_list
      (tenant_id, module, code, name, version, is_active, attrs)
    VALUES
      (
        NULL,
        'inventory',
        p_list_code,
        p_list_name,
        1,
        true,
        '{"ui":{"module":"inventory","scope":"inventory_management_v1"},"extensible":true,"closed_enum":false}'::jsonb
      )
    RETURNING id INTO target_list_id;
  ELSE
    UPDATE eip_core.dropdown_list
    SET name=p_list_name,
        is_active=true,
        attrs=COALESCE(attrs,'{}'::jsonb) || '{"ui":{"module":"inventory","scope":"inventory_management_v1"},"extensible":true,"closed_enum":false}'::jsonb,
        updated_at=now()
    WHERE id=target_list_id;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_values)
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
          attrs=COALESCE(eip_core.dropdown_value.attrs,'{}'::jsonb) || EXCLUDED.attrs,
          updated_at=now();
  END LOOP;
END;
$$;

SELECT pg_temp.seed_inventory_management_dropdown('INVENTORY_MATERIAL_TYPE', 'Inventory Material Type', '[
  {"code":"RAW_MATERIAL","label":"Raw material","sort_order":10},
  {"code":"FINISHED_GOOD","label":"Finished good","sort_order":20},
  {"code":"SEMI_FINISHED","label":"Semi-finished","sort_order":30},
  {"code":"CONSUMABLE","label":"Consumable","sort_order":40},
  {"code":"PACKAGING","label":"Packaging","sort_order":50},
  {"code":"SERVICE_ITEM","label":"Service item","sort_order":60},
  {"code":"OTHER","label":"Other","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_inventory_management_dropdown('INVENTORY_MATERIAL_STATUS', 'Inventory Material Status', '[
  {"code":"ACTIVE","label":"Active","sort_order":10},
  {"code":"UNDER_REVIEW","label":"Under review","sort_order":20},
  {"code":"BLOCKED","label":"Blocked","sort_order":30},
  {"code":"INACTIVE","label":"Inactive","sort_order":40},
  {"code":"ARCHIVED","label":"Archived","sort_order":50}
]'::jsonb);

SELECT pg_temp.seed_inventory_management_dropdown('INVENTORY_LOT_STATUS', 'Inventory Lot Status', '[
  {"code":"AVAILABLE","label":"Available","sort_order":10},
  {"code":"RESERVED","label":"Reserved","sort_order":20},
  {"code":"BLOCKED","label":"Blocked","sort_order":30},
  {"code":"QUARANTINE","label":"Quarantine","sort_order":40},
  {"code":"CONSUMED","label":"Consumed","sort_order":50},
  {"code":"EXPIRED","label":"Expired","sort_order":60},
  {"code":"ARCHIVED","label":"Archived","sort_order":70}
]'::jsonb);

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('inventory.read', 'Read inventory', 'View tenant-scoped materials, lots, stock visibility, documents, policies, and activity'),
  ('inventory.material.create', 'Create inventory materials', 'Create tenant materials on the material backbone'),
  ('inventory.material.update', 'Update inventory materials', 'Update tenant material profile, status, supplier reference, and safe inventory attributes'),
  ('inventory.lot.create', 'Create inventory lots', 'Create tenant material lots and initial lot status events'),
  ('inventory.lot.update', 'Update inventory lots', 'Update tenant material lot quantities, references, and lifecycle status'),
  ('inventory.recommendation.read', 'Read inventory reorder recommendations', 'View policy-backed tenant reorder recommendations and explanations'),
  ('inventory.policy.read', 'Read inventory effective policy', 'Resolve tenant-scoped inventory policies through the effective-policy helper')
ON CONFLICT (code) DO UPDATE
SET label=EXCLUDED.label,
    description=EXCLUDED.description;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','inventory.read'), ('ADMIN_SUPER','inventory.material.create'), ('ADMIN_SUPER','inventory.material.update'),
    ('ADMIN_SUPER','inventory.lot.create'), ('ADMIN_SUPER','inventory.lot.update'), ('ADMIN_SUPER','inventory.recommendation.read'),
    ('ADMIN_SUPER','inventory.policy.read'),
    ('ADMIN_EXEC','inventory.read'), ('ADMIN_EXEC','inventory.material.create'), ('ADMIN_EXEC','inventory.material.update'),
    ('ADMIN_EXEC','inventory.lot.create'), ('ADMIN_EXEC','inventory.lot.update'), ('ADMIN_EXEC','inventory.recommendation.read'),
    ('ADMIN_EXEC','inventory.policy.read'),
    ('ACCESS_UNIVERSAL','inventory.read'), ('ACCESS_UNIVERSAL','inventory.material.create'), ('ACCESS_UNIVERSAL','inventory.material.update'),
    ('ACCESS_UNIVERSAL','inventory.lot.create'), ('ACCESS_UNIVERSAL','inventory.lot.update'), ('ACCESS_UNIVERSAL','inventory.recommendation.read'),
    ('ACCESS_UNIVERSAL','inventory.policy.read'),
    ('ECOM_ADMIN','inventory.read'), ('ECOM_ADMIN','inventory.material.create'), ('ECOM_ADMIN','inventory.material.update'),
    ('ECOM_ADMIN','inventory.lot.create'), ('ECOM_ADMIN','inventory.lot.update'), ('ECOM_ADMIN','inventory.recommendation.read'),
    ('ECOM_ADMIN','inventory.policy.read'),
    ('ERP_USER','inventory.read'), ('ERP_USER','inventory.material.create'), ('ERP_USER','inventory.material.update'),
    ('ERP_USER','inventory.lot.create'), ('ERP_USER','inventory.lot.update'), ('ERP_USER','inventory.recommendation.read'),
    ('ERP_USER','inventory.policy.read'),
    ('ACCESS_ECOM_FULL','inventory.read'), ('ACCESS_ECOM_FULL','inventory.material.create'), ('ACCESS_ECOM_FULL','inventory.material.update'),
    ('ACCESS_ECOM_FULL','inventory.lot.create'), ('ACCESS_ECOM_FULL','inventory.lot.update'), ('ACCESS_ECOM_FULL','inventory.recommendation.read'),
    ('ACCESS_ECOM_FULL','inventory.policy.read'),
    ('ACCESS_READ_ONLY','inventory.read'), ('ACCESS_READ_ONLY','inventory.recommendation.read'), ('ACCESS_READ_ONLY','inventory.policy.read')
)
INSERT INTO eip_authz.role_template_permission(role_code, permission_code)
SELECT role_template.code, bundles.permission_code
FROM bundles
JOIN eip_authz.role_template role_template ON role_template.code=bundles.role_code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','inventory.read'), ('ADMIN_SUPER','inventory.material.create'), ('ADMIN_SUPER','inventory.material.update'),
    ('ADMIN_SUPER','inventory.lot.create'), ('ADMIN_SUPER','inventory.lot.update'), ('ADMIN_SUPER','inventory.recommendation.read'),
    ('ADMIN_SUPER','inventory.policy.read'),
    ('ADMIN_EXEC','inventory.read'), ('ADMIN_EXEC','inventory.material.create'), ('ADMIN_EXEC','inventory.material.update'),
    ('ADMIN_EXEC','inventory.lot.create'), ('ADMIN_EXEC','inventory.lot.update'), ('ADMIN_EXEC','inventory.recommendation.read'),
    ('ADMIN_EXEC','inventory.policy.read'),
    ('ACCESS_UNIVERSAL','inventory.read'), ('ACCESS_UNIVERSAL','inventory.material.create'), ('ACCESS_UNIVERSAL','inventory.material.update'),
    ('ACCESS_UNIVERSAL','inventory.lot.create'), ('ACCESS_UNIVERSAL','inventory.lot.update'), ('ACCESS_UNIVERSAL','inventory.recommendation.read'),
    ('ACCESS_UNIVERSAL','inventory.policy.read'),
    ('ECOM_ADMIN','inventory.read'), ('ECOM_ADMIN','inventory.material.create'), ('ECOM_ADMIN','inventory.material.update'),
    ('ECOM_ADMIN','inventory.lot.create'), ('ECOM_ADMIN','inventory.lot.update'), ('ECOM_ADMIN','inventory.recommendation.read'),
    ('ECOM_ADMIN','inventory.policy.read'),
    ('ERP_USER','inventory.read'), ('ERP_USER','inventory.material.create'), ('ERP_USER','inventory.material.update'),
    ('ERP_USER','inventory.lot.create'), ('ERP_USER','inventory.lot.update'), ('ERP_USER','inventory.recommendation.read'),
    ('ERP_USER','inventory.policy.read'),
    ('ACCESS_ECOM_FULL','inventory.read'), ('ACCESS_ECOM_FULL','inventory.material.create'), ('ACCESS_ECOM_FULL','inventory.material.update'),
    ('ACCESS_ECOM_FULL','inventory.lot.create'), ('ACCESS_ECOM_FULL','inventory.lot.update'), ('ACCESS_ECOM_FULL','inventory.recommendation.read'),
    ('ACCESS_ECOM_FULL','inventory.policy.read'),
    ('ACCESS_READ_ONLY','inventory.read'), ('ACCESS_READ_ONLY','inventory.recommendation.read'), ('ACCESS_READ_ONLY','inventory.policy.read')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT role_record.id, bundles.permission_code
FROM bundles
JOIN eip_authz.role role_record ON role_record.code=bundles.role_code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

INSERT INTO eip_core.module_catalog (code, label, description, attrs, is_active)
VALUES
  (
    'inventory',
    'Inventory',
    'Operational material and lot management, stock visibility, reorder recommendations, policy explanations, supplier/entity links, documents, and activity',
    '{"capabilities":{"overview":true,"materials":true,"material_crud":true,"lots":true,"lot_crud":true,"lot_status":true,"stock_visibility":true,"reorder_recommendations":true,"effective_policy":true,"entity_links":true,"documents":true,"activity":true},"scope":"inventory_management_v1","kernel_tables":["material","material_lot","material_lot_status_event","agent","commercial_condition","info_record","object_link","service_object","task"]}'::jsonb,
    true
  )
ON CONFLICT (code) DO UPDATE
SET label=EXCLUDED.label,
    description=EXCLUDED.description,
    attrs=COALESCE(eip_core.module_catalog.attrs,'{}'::jsonb) || EXCLUDED.attrs,
    is_active=true,
    updated_at=now();

WITH target_tenants AS (
  SELECT tenant.id
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
)
INSERT INTO eip_core.tenant_module_setting (tenant_id, module, code, attrs, is_active)
SELECT target_tenants.id, 'inventory', 'operations',
       '{"capabilities":{"overview":true,"materials":true,"material_crud":true,"lots":true,"lot_crud":true,"lot_status":true,"stock_visibility":true,"reorder_recommendations":true,"effective_policy":true,"entity_links":true,"documents":true,"activity":true},"settings":{"default_material_type":"OTHER","default_material_status":"ACTIVE","default_lot_status":"AVAILABLE","hard_delete_enabled":false}}'::jsonb,
       true
FROM target_tenants
ON CONFLICT (tenant_id, module, code) DO UPDATE
SET attrs=jsonb_set(
      COALESCE(eip_core.tenant_module_setting.attrs,'{}'::jsonb),
      '{capabilities}',
      COALESCE(eip_core.tenant_module_setting.attrs->'capabilities','{}'::jsonb) || '{"overview":true,"materials":true,"material_crud":true,"lots":true,"lot_crud":true,"lot_status":true,"stock_visibility":true,"reorder_recommendations":true,"effective_policy":true,"entity_links":true,"documents":true,"activity":true}'::jsonb,
      true
    ),
    is_active=true,
    updated_at=now();

CREATE INDEX IF NOT EXISTS material_inventory_management_status_idx
  ON eip_core.material (tenant_id, ((attrs->'inventory_management_v1'->>'status')), updated_at DESC);

CREATE INDEX IF NOT EXISTS material_inventory_management_supplier_idx
  ON eip_core.material (tenant_id, ((attrs->'inventory_management_v1'->>'default_supplier_entity_id')));

CREATE INDEX IF NOT EXISTS material_lot_inventory_status_idx
  ON eip_core.material_lot (tenant_id, (upper(status)), updated_at DESC)
  WHERE is_active=true;

CREATE INDEX IF NOT EXISTS material_lot_inventory_supplier_idx
  ON eip_core.material_lot (tenant_id, ((attrs->'inventory_management_v1'->>'supplier_agent_id')))
  WHERE is_active=true;

DO $$
DECLARE
  inventory_menu jsonb := '{"code":"inventory","label":"Inventory","icon":"Package","module":"inventory"}'::jsonb;
  inventory_panel jsonb := '{
    "id":"user-inventory-panel",
    "type":"UserPanel",
    "props":{"tab":"inventory"},
    "children":[
      {
        "id":"inventory-management-workspace",
        "type":"InventoryManagementWorkspace",
        "props":{
          "module":"inventory",
          "title":"Inventory",
          "subtitle":"Materials, lots, stock visibility, reorder recommendations, policy explanations, suppliers, documents, and activity.",
          "endpoints":{
            "overview":"/api/eip/inventory/overview",
            "materials":"/api/eip/inventory/materials",
            "materialDetail":"/api/eip/inventory/materials/:id",
            "materialSummary":"/api/eip/inventory/materials/:id/summary",
            "materialLots":"/api/eip/inventory/materials/:id/lots",
            "lotDetail":"/api/eip/inventory/lots/:id",
            "recommendations":"/api/eip/inventory/reorder-recommendations",
            "policiesEffective":"/api/eip/inventory/policies/effective",
            "options":"/api/eip/inventory/governance/options"
          },
          "tabs":[
            {"id":"overview","label":"Overview"},
            {"id":"materials","label":"Materials"},
            {"id":"lots","label":"Lots"},
            {"id":"reorder","label":"Reorder"},
            {"id":"policies","label":"Policies"},
            {"id":"documents","label":"Documents"},
            {"id":"activity","label":"Activity"}
          ],
          "actions":{
            "refresh":"Refresh",
            "createMaterial":"Create material",
            "saveMaterial":"Save material",
            "createLot":"Create lot",
            "saveLot":"Save lot",
            "viewSummary":"View summary"
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
    next_menu := COALESCE(surface_record.tree#>'{props,menu}', '[]'::jsonb);
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(next_menu) existing_menu
      WHERE existing_menu->>'code'='inventory'
    ) THEN
      next_menu := next_menu || jsonb_build_array(inventory_menu);
    END IF;

    next_children := COALESCE(surface_record.tree->'children', '[]'::jsonb);
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(next_children) existing_child
      WHERE existing_child->>'id'='user-inventory-panel'
    ) THEN
      SELECT jsonb_agg(
               CASE
                 WHEN existing_child->>'id'='user-inventory-panel' THEN inventory_panel
                 ELSE existing_child
               END
               ORDER BY ordinality
             )
      INTO next_children
      FROM jsonb_array_elements(next_children) WITH ORDINALITY AS child(existing_child, ordinality);
    ELSE
      next_children := next_children || jsonb_build_array(inventory_panel);
    END IF;

    UPDATE eip_core.ui_surface
    SET tree=jsonb_set(
          jsonb_set(surface_record.tree, '{props,menu}', next_menu, true),
          '{children}',
          next_children,
          true
        ),
        attrs=COALESCE(attrs,'{}'::jsonb) || '{"module":"dashboard","inventory_management_surface":true,"production_data_only":true}'::jsonb,
        updated_at=now()
    WHERE id=surface_record.id;
  END LOOP;
END;
$$;

COMMIT;
