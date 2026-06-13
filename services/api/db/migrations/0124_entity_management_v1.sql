-- 0124_entity_management_v1.sql
-- Purpose: production-capable Entity Management V1 on existing kernel tables.
-- Uses eip_core.agent plus existing entity subtables, object_link, info_record,
-- commercial_condition, service_object_party, and task. No new tables.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.seed_entity_dropdown(
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
    AND dropdown_list.module='entity_management'
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
        'entity_management',
        p_list_code,
        p_list_name,
        1,
        true,
        '{"ui":{"module":"entity-management","scope":"entity_management_v1"},"extensible":true,"closed_enum":false}'::jsonb
      )
    RETURNING id INTO target_list_id;
  ELSE
    UPDATE eip_core.dropdown_list
    SET name=p_list_name,
        is_active=true,
        attrs=COALESCE(attrs,'{}'::jsonb) || '{"ui":{"module":"entity-management","scope":"entity_management_v1"},"extensible":true,"closed_enum":false}'::jsonb,
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

SELECT pg_temp.seed_entity_dropdown('ENTITY_ROLE', 'Entity Role', '[
  {"code":"CUSTOMER","label":"Customer","sort_order":10},
  {"code":"SUPPLIER","label":"Supplier","sort_order":20},
  {"code":"PARTNER","label":"Partner","sort_order":30},
  {"code":"INTERNAL_ORG","label":"Internal org","sort_order":40},
  {"code":"EMPLOYEE","label":"Employee","sort_order":50},
  {"code":"CARRIER","label":"Carrier","sort_order":60},
  {"code":"MARKETPLACE","label":"Marketplace","sort_order":70},
  {"code":"AUTHORITY","label":"Authority","sort_order":80},
  {"code":"OTHER","label":"Other","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_entity_dropdown('ENTITY_STATUS', 'Entity Status', '[
  {"code":"ACTIVE","label":"Active","sort_order":10},
  {"code":"UNDER_REVIEW","label":"Under review","sort_order":20},
  {"code":"BLOCKED","label":"Blocked","sort_order":30},
  {"code":"INACTIVE","label":"Inactive","sort_order":40},
  {"code":"ARCHIVED","label":"Archived","sort_order":50}
]'::jsonb);

SELECT pg_temp.seed_entity_dropdown('ENTITY_KIND', 'Entity Kind', '[
  {"code":"ORG","label":"Organization","sort_order":10},
  {"code":"PERSON","label":"Person","sort_order":20},
  {"code":"TEAM","label":"Team","sort_order":30},
  {"code":"SYSTEM","label":"System","sort_order":40},
  {"code":"OTHER","label":"Other","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_entity_dropdown('ENTITY_ADDRESS_TYPE', 'Entity Address Type', '[
  {"code":"MAIN","label":"Main","sort_order":10},
  {"code":"REGISTERED","label":"Registered","sort_order":20},
  {"code":"BILLING","label":"Billing","sort_order":30},
  {"code":"SHIPPING","label":"Shipping","sort_order":40},
  {"code":"SITE","label":"Site","sort_order":50},
  {"code":"OTHER","label":"Other","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_entity_dropdown('ENTITY_CONTACT_TYPE', 'Entity Contact Type', '[
  {"code":"EMAIL","label":"Email","sort_order":10},
  {"code":"PHONE","label":"Phone","sort_order":20},
  {"code":"MOBILE","label":"Mobile","sort_order":30},
  {"code":"WHATSAPP","label":"WhatsApp","sort_order":40},
  {"code":"WEBSITE","label":"Website","sort_order":50},
  {"code":"OTHER","label":"Other","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_entity_dropdown('ENTITY_BANK_ACCOUNT_TYPE', 'Entity Bank Account Type', '[
  {"code":"BANK","label":"Bank account","sort_order":10},
  {"code":"MOBILE_MONEY","label":"Mobile money","sort_order":20},
  {"code":"SETTLEMENT","label":"Settlement","sort_order":30},
  {"code":"OTHER","label":"Other","sort_order":90}
]'::jsonb);

SELECT pg_temp.seed_entity_dropdown('ENTITY_RELATIONSHIP_TYPE', 'Entity Relationship Type', '[
  {"code":"RELATED_TO","label":"Related to","sort_order":10},
  {"code":"PARENT_OF","label":"Parent of","sort_order":20},
  {"code":"SUBSIDIARY_OF","label":"Subsidiary of","sort_order":30},
  {"code":"CONTACT_FOR","label":"Contact for","sort_order":40},
  {"code":"WORKS_FOR","label":"Works for","sort_order":50},
  {"code":"BILLS_TO","label":"Bills to","sort_order":60},
  {"code":"SUPPLIES_TO","label":"Supplies to","sort_order":70}
]'::jsonb);

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('entities.read', 'Read entities', 'View tenant entities and related entity summaries'),
  ('entities.create', 'Create entities', 'Create tenant entities on the agent backbone'),
  ('entities.update', 'Update entities', 'Update tenant entity profile and lifecycle fields'),
  ('entities.manage_addresses', 'Manage entity addresses', 'Create and update tenant entity addresses'),
  ('entities.manage_contacts', 'Manage entity contacts', 'Create and update tenant entity contacts'),
  ('entities.manage_bank_accounts', 'Manage entity bank accounts', 'Create and update tenant entity bank account metadata with masked reads'),
  ('entities.manage_relationships', 'Manage entity relationships', 'Create and update tenant entity relationships')
ON CONFLICT (code) DO UPDATE
SET label=EXCLUDED.label,
    description=EXCLUDED.description;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','entities.read'), ('ADMIN_SUPER','entities.create'), ('ADMIN_SUPER','entities.update'),
    ('ADMIN_SUPER','entities.manage_addresses'), ('ADMIN_SUPER','entities.manage_contacts'),
    ('ADMIN_SUPER','entities.manage_bank_accounts'), ('ADMIN_SUPER','entities.manage_relationships'),
    ('ADMIN_EXEC','entities.read'), ('ADMIN_EXEC','entities.create'), ('ADMIN_EXEC','entities.update'),
    ('ADMIN_EXEC','entities.manage_addresses'), ('ADMIN_EXEC','entities.manage_contacts'),
    ('ADMIN_EXEC','entities.manage_bank_accounts'), ('ADMIN_EXEC','entities.manage_relationships'),
    ('ACCESS_UNIVERSAL','entities.read'), ('ACCESS_UNIVERSAL','entities.create'), ('ACCESS_UNIVERSAL','entities.update'),
    ('ACCESS_UNIVERSAL','entities.manage_addresses'), ('ACCESS_UNIVERSAL','entities.manage_contacts'),
    ('ACCESS_UNIVERSAL','entities.manage_bank_accounts'), ('ACCESS_UNIVERSAL','entities.manage_relationships'),
    ('ECOM_ADMIN','entities.read'), ('ECOM_ADMIN','entities.create'), ('ECOM_ADMIN','entities.update'),
    ('ECOM_ADMIN','entities.manage_addresses'), ('ECOM_ADMIN','entities.manage_contacts'),
    ('ECOM_ADMIN','entities.manage_bank_accounts'), ('ECOM_ADMIN','entities.manage_relationships'),
    ('ERP_USER','entities.read'), ('ERP_USER','entities.create'), ('ERP_USER','entities.update'),
    ('ERP_USER','entities.manage_addresses'), ('ERP_USER','entities.manage_contacts'),
    ('ERP_USER','entities.manage_bank_accounts'), ('ERP_USER','entities.manage_relationships'),
    ('CRM_ADMIN','entities.read'), ('CRM_ADMIN','entities.create'), ('CRM_ADMIN','entities.update'),
    ('CRM_ADMIN','entities.manage_addresses'), ('CRM_ADMIN','entities.manage_contacts'),
    ('CRM_ADMIN','entities.manage_bank_accounts'), ('CRM_ADMIN','entities.manage_relationships'),
    ('CRM_USER','entities.read'), ('CRM_USER','entities.create'), ('CRM_USER','entities.update'),
    ('CRM_USER','entities.manage_addresses'), ('CRM_USER','entities.manage_contacts'),
    ('CRM_USER','entities.manage_relationships'),
    ('ACCESS_READ_ONLY','entities.read')
)
INSERT INTO eip_authz.role_template_permission(role_code, permission_code)
SELECT role_template.code, bundles.permission_code
FROM bundles
JOIN eip_authz.role_template role_template ON role_template.code=bundles.role_code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT DO NOTHING;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','entities.read'), ('ADMIN_SUPER','entities.create'), ('ADMIN_SUPER','entities.update'),
    ('ADMIN_SUPER','entities.manage_addresses'), ('ADMIN_SUPER','entities.manage_contacts'),
    ('ADMIN_SUPER','entities.manage_bank_accounts'), ('ADMIN_SUPER','entities.manage_relationships'),
    ('ADMIN_EXEC','entities.read'), ('ADMIN_EXEC','entities.create'), ('ADMIN_EXEC','entities.update'),
    ('ADMIN_EXEC','entities.manage_addresses'), ('ADMIN_EXEC','entities.manage_contacts'),
    ('ADMIN_EXEC','entities.manage_bank_accounts'), ('ADMIN_EXEC','entities.manage_relationships'),
    ('ACCESS_UNIVERSAL','entities.read'), ('ACCESS_UNIVERSAL','entities.create'), ('ACCESS_UNIVERSAL','entities.update'),
    ('ACCESS_UNIVERSAL','entities.manage_addresses'), ('ACCESS_UNIVERSAL','entities.manage_contacts'),
    ('ACCESS_UNIVERSAL','entities.manage_bank_accounts'), ('ACCESS_UNIVERSAL','entities.manage_relationships'),
    ('ECOM_ADMIN','entities.read'), ('ECOM_ADMIN','entities.create'), ('ECOM_ADMIN','entities.update'),
    ('ECOM_ADMIN','entities.manage_addresses'), ('ECOM_ADMIN','entities.manage_contacts'),
    ('ECOM_ADMIN','entities.manage_bank_accounts'), ('ECOM_ADMIN','entities.manage_relationships'),
    ('ERP_USER','entities.read'), ('ERP_USER','entities.create'), ('ERP_USER','entities.update'),
    ('ERP_USER','entities.manage_addresses'), ('ERP_USER','entities.manage_contacts'),
    ('ERP_USER','entities.manage_bank_accounts'), ('ERP_USER','entities.manage_relationships'),
    ('CRM_ADMIN','entities.read'), ('CRM_ADMIN','entities.create'), ('CRM_ADMIN','entities.update'),
    ('CRM_ADMIN','entities.manage_addresses'), ('CRM_ADMIN','entities.manage_contacts'),
    ('CRM_ADMIN','entities.manage_bank_accounts'), ('CRM_ADMIN','entities.manage_relationships'),
    ('CRM_USER','entities.read'), ('CRM_USER','entities.create'), ('CRM_USER','entities.update'),
    ('CRM_USER','entities.manage_addresses'), ('CRM_USER','entities.manage_contacts'),
    ('CRM_USER','entities.manage_relationships'),
    ('ACCESS_READ_ONLY','entities.read')
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
    'entity-management',
    'Entity Management',
    'Universal tenant party and entity backbone for customers, suppliers, employees, partners, authorities, and related parties',
    '{"capabilities":{"overview":true,"profiles":true,"addresses":true,"contacts":true,"bank_accounts":true,"relationships":true,"documents":true,"policies":true,"activity":true},"scope":"entity_management_v1","kernel_tables":["agent","entity_address","entity_contact","entity_bank_account","object_link","info_record","service_object_party","task"]}'::jsonb,
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
  WHERE tenant.is_active=true
)
INSERT INTO eip_core.tenant_module_setting (tenant_id, module, code, attrs, is_active)
SELECT target_tenants.id, 'entity-management', 'operations',
       '{"capabilities":{"overview":true,"profiles":true,"addresses":true,"contacts":true,"bank_accounts":true,"relationships":true,"documents":true,"policies":true,"activity":true},"settings":{"default_entity_kind":"ORG","default_status":"ACTIVE","hard_delete_enabled":false}}'::jsonb,
       true
FROM target_tenants
ON CONFLICT (tenant_id, module, code) DO UPDATE
SET attrs=jsonb_set(
      COALESCE(eip_core.tenant_module_setting.attrs,'{}'::jsonb),
      '{capabilities}',
      COALESCE(eip_core.tenant_module_setting.attrs->'capabilities','{}'::jsonb) || '{"overview":true,"profiles":true,"addresses":true,"contacts":true,"bank_accounts":true,"relationships":true,"documents":true,"policies":true,"activity":true}'::jsonb,
      true
    ),
    is_active=true,
    updated_at=now();

CREATE INDEX IF NOT EXISTS agent_entity_management_status_idx
  ON eip_core.agent (tenant_id, ((attrs->>'status')), updated_at DESC)
  WHERE attrs ? 'entity_management_v1';

CREATE INDEX IF NOT EXISTS agent_entity_management_country_idx
  ON eip_core.agent (tenant_id, ((attrs->>'country_code')))
  WHERE attrs ? 'entity_management_v1';

CREATE INDEX IF NOT EXISTS object_link_entity_relationship_idx
  ON eip_core.object_link (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type)
  WHERE src_kind='agent' AND dst_kind='agent';

DO $$
DECLARE
  entity_menu jsonb := '{"code":"entities","label":"Entities","icon":"Users","module":"entity-management"}'::jsonb;
  entity_panel jsonb := '{
    "id":"user-entities-panel",
    "type":"UserPanel",
    "props":{"tab":"entities"},
    "children":[
      {
        "id":"entity-management-workspace",
        "type":"EntityManagementWorkspace",
        "props":{
          "module":"entity-management",
          "title":"Entity Management",
          "subtitle":"Customers, suppliers, employees, partners, authorities, addresses, contacts, bank accounts, relationships, documents, policies, and activity.",
          "endpoints":{
            "list":"/api/eip/entities",
            "detail":"/api/eip/entities/:id",
            "options":"/api/eip/entities/governance/options"
          },
          "tabs":[
            {"id":"overview","label":"Overview"},
            {"id":"addresses","label":"Addresses"},
            {"id":"contacts","label":"Contacts"},
            {"id":"bank_accounts","label":"Bank Accounts"},
            {"id":"relationships","label":"Relationships"},
            {"id":"documents","label":"Documents"},
            {"id":"policies","label":"Policies"},
            {"id":"activity","label":"Activity"}
          ],
          "actions":{
            "refresh":"Refresh",
            "create":"Create entity",
            "save":"Save",
            "archive":"Archive",
            "addAddress":"Add address",
            "addContact":"Add contact",
            "addBankAccount":"Add bank account",
            "addRelationship":"Add relationship"
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
      WHERE existing_menu->>'code'='entities'
    ) THEN
      next_menu := next_menu || jsonb_build_array(entity_menu);
    END IF;

    next_children := COALESCE(surface_record.tree->'children', '[]'::jsonb);
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(next_children) existing_child
      WHERE existing_child->>'id'='user-entities-panel'
    ) THEN
      next_children := next_children || jsonb_build_array(entity_panel);
    END IF;

    UPDATE eip_core.ui_surface
    SET tree=jsonb_set(
          jsonb_set(surface_record.tree, '{props,menu}', next_menu, true),
          '{children}',
          next_children,
          true
        ),
        attrs=COALESCE(attrs,'{}'::jsonb) || '{"module":"dashboard","entity_management_surface":true,"production_data_only":true}'::jsonb,
        updated_at=now()
    WHERE id=surface_record.id;
  END LOOP;
END;
$$;

COMMIT;
