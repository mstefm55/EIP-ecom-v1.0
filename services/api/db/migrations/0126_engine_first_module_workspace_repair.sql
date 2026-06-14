-- 0126_engine_first_module_workspace_repair.sql
-- Purpose: move Inventory, Entity Management, and Policies & Conditions active
-- dashboard workspace composition to the generic UI engine workspace primitive.
-- Released migrations 0121-0124 are repaired additively; 0125 is also aligned.

BEGIN;

DO $$
DECLARE
  inventory_workspace jsonb := $json${"module":"inventory","optionsEndpoint":"/api/eip/inventory/governance/options","layout":{"eyebrow":"Inventory Management","title":"Inventory","subtitle":"Materials, lots, stock visibility, reorder recommendations, policy explanations, suppliers, documents, and activity."},"list":{"endpoint":"/api/eip/inventory/materials","itemsPath":"items","limit":100,"icon":"package","titlePath":"name","subtitlePath":"code","badgePath":"status","searchPlaceholder":"Search materials","filters":[{"name":"status","label":"Status","optionList":"INVENTORY_MATERIAL_STATUS","defaultOptionsPath":"material_statuses"},{"name":"material_type","label":"Type","optionLists":["INVENTORY_MATERIAL_TYPE","MATERIAL_TYPE"],"defaultOptionsPath":"material_types"}]},"detail":{"endpoint":"/api/eip/inventory/materials/:id","titlePath":"name","subtitlePath":"code","badgePath":"status","emptyLabel":"Select a material to inspect inventory."},"actions":{"create":{"label":"Create material","title":"Create material","endpoint":"/api/eip/inventory/materials","method":"POST","permission":"inventory.material.create","fields":[{"name":"code","label":"Code"},{"name":"name","label":"Name"},{"name":"material_type","label":"Type","type":"select","optionLists":["INVENTORY_MATERIAL_TYPE","MATERIAL_TYPE"],"defaultOptionsPath":"material_types"},{"name":"status","label":"Status","type":"select","optionList":"INVENTORY_MATERIAL_STATUS","defaultOptionsPath":"material_statuses"},{"name":"unit_of_measure","label":"Unit"},{"name":"category","label":"Category"},{"name":"family","label":"Family"},{"name":"default_supplier_entity_id","label":"Supplier entity id"},{"name":"reorder_point","label":"Reorder point","type":"number","sourcePath":"stock_profile.reorder_point"},{"name":"reorder_qty","label":"Reorder quantity","type":"number","sourcePath":"stock_profile.reorder_qty"},{"name":"safety_stock","label":"Safety stock","type":"number","sourcePath":"stock_profile.safety_stock"},{"name":"notes","label":"Notes","type":"textarea","rows":2}]}},"tabs":[{"id":"overview","label":"Overview","icon":"boxes","type":"summary","rows":[{"label":"Status","path":"item.status","format":"label"},{"label":"Type","path":"item.material_type","format":"label"},{"label":"On hand","path":"item.stock_profile.stock_on_hand","unitPath":"item.stock_profile.unit_of_measure","format":"quantity"},{"label":"Available","path":"item.stock_profile.available_qty","unitPath":"item.stock_profile.unit_of_measure","format":"quantity"},{"label":"Lots","path":"summary.lots.total","format":"number"},{"label":"Documents","path":"summary.documents.total","format":"number"}]},{"id":"materials","label":"Material","icon":"package","type":"form","form":{"title":"Material profile","endpoint":"/api/eip/inventory/materials/:id","method":"PATCH","permission":"inventory.material.update","submitLabel":"Save material","resetOnSave":false,"fields":[{"name":"code","label":"Code"},{"name":"name","label":"Name"},{"name":"material_type","label":"Type","type":"select","optionLists":["INVENTORY_MATERIAL_TYPE","MATERIAL_TYPE"],"defaultOptionsPath":"material_types"},{"name":"status","label":"Status","type":"select","optionList":"INVENTORY_MATERIAL_STATUS","defaultOptionsPath":"material_statuses"},{"name":"unit_of_measure","label":"Unit"},{"name":"category","label":"Category"},{"name":"family","label":"Family"},{"name":"default_supplier_entity_id","label":"Supplier entity id"},{"name":"reorder_point","label":"Reorder point","type":"number","sourcePath":"stock_profile.reorder_point"},{"name":"reorder_qty","label":"Reorder quantity","type":"number","sourcePath":"stock_profile.reorder_qty"},{"name":"safety_stock","label":"Safety stock","type":"number","sourcePath":"stock_profile.safety_stock"},{"name":"notes","label":"Notes","type":"textarea","rows":2}]}},{"id":"lots","label":"Lots","icon":"layers","type":"collection","itemsPath":"lots","titlePath":"lot_code","subtitlePath":"quantity","badgePath":"status","empty":"No lots recorded for this material.","createForm":{"title":"Create lot","endpoint":"/api/eip/inventory/materials/:id/lots","method":"POST","permission":"inventory.lot.create","submitLabel":"Create lot","fields":[{"name":"lot_code","label":"Lot code"},{"name":"quantity","label":"Quantity","type":"number"},{"name":"unit","label":"Unit","sourcePath":"unit"},{"name":"status","label":"Status","type":"select","optionLists":["INVENTORY_LOT_STATUS","MATERIAL_LOT_STATUS"],"defaultOptionsPath":"lot_statuses"},{"name":"received_date","label":"Received","type":"date"},{"name":"expiry_date","label":"Expires","type":"date"},{"name":"location_ref","label":"Location"},{"name":"supplier_agent_id","label":"Supplier entity id"},{"name":"notes","label":"Notes","type":"textarea","rows":2}]},"updateForm":{"title":"Update lot","endpoint":"/api/eip/inventory/lots/:rowId","method":"PATCH","permission":"inventory.lot.update","submitLabel":"Save lot","resetOnSave":false,"fields":[{"name":"lot_code","label":"Lot code"},{"name":"quantity","label":"Quantity","type":"number"},{"name":"unit","label":"Unit","sourcePath":"unit"},{"name":"status","label":"Status","type":"select","optionLists":["INVENTORY_LOT_STATUS","MATERIAL_LOT_STATUS"],"defaultOptionsPath":"lot_statuses"},{"name":"received_date","label":"Received","type":"date"},{"name":"expiry_date","label":"Expires","type":"date"},{"name":"location_ref","label":"Location"},{"name":"supplier_agent_id","label":"Supplier entity id"},{"name":"notes","label":"Notes","type":"textarea","rows":2}]}},{"id":"reorder","label":"Reorder","icon":"reorder","type":"summary","rows":[{"label":"Stock status","path":"item.stock_profile.stock_status","format":"label"},{"label":"Risk status","path":"item.stock_profile.risk_status","format":"label"},{"label":"Reorder point","path":"item.stock_profile.reorder_point","unitPath":"item.stock_profile.unit_of_measure","format":"quantity"},{"label":"Suggested quantity","path":"item.stock_profile.suggested_qty","unitPath":"item.stock_profile.unit_of_measure","format":"quantity"},{"label":"Policy source","path":"item.stock_profile.policy_source","format":"label"},{"label":"Condition codes","path":"item.stock_profile.policy_condition_codes","format":"array"}]},{"id":"policies","label":"Policies","icon":"policy","type":"summary","rows":[{"label":"Policy source","path":"policy_summary.source","format":"label"},{"label":"Condition codes","path":"policy_summary.condition_codes","format":"array"},{"label":"Resolution","path":"policy_summary.effective_read_model.resolution_status","format":"label"},{"label":"Fallback used","path":"policy_summary.effective_read_model.fallback_used"}]},{"id":"documents","label":"Documents","icon":"document","type":"records","itemsPath":"documents","titlePath":"title","subtitlePath":"record_type","badgePath":"status","empty":"No documents linked."},{"id":"activity","label":"Activity","icon":"archive","type":"records","itemsPath":"movements","titlePath":"title","subtitlePath":"record_type","badgePath":"direction","empty":"No stock movement records."}]}$json$::jsonb;
  policies_workspace jsonb := $json${"module":"policies-conditions","optionsEndpoint":"/api/eip/policies-conditions/governance/options","layout":{"eyebrow":"Policies & Conditions","title":"Policies & Conditions","subtitle":"Read-only business rules that explain recommendations and approvals."},"list":{"endpoint":"/api/eip/policies-conditions","itemsPath":"items","limitParam":"page_size","limit":25,"icon":"policy","titlePath":"label","subtitlePath":"code","badgePath":"mapping_status","searchPlaceholder":"Search policies","filters":[{"name":"policy_domain","label":"Domain","optionList":"POLICY_DOMAIN"},{"name":"status","label":"Status","options":[{"value":"needs_review","label":"Needs review"},{"value":"active","label":"Active"},{"value":"inactive","label":"Inactive"}]}]},"detail":{"endpoint":"/api/eip/policies-conditions/:id","titlePath":"label","subtitlePath":"code","badgePath":"mapping_status","emptyLabel":"Select a policy or condition to inspect the read model."},"tabs":[{"id":"overview","label":"Overview","icon":"policy","type":"summary","rows":[{"label":"Mapping","path":"item.mapping_status","format":"label"},{"label":"Status","path":"item.status","format":"label"},{"label":"Domain","path":"item.classification.policy_domain","format":"label"},{"label":"Family","path":"item.classification.policy_family","format":"label"},{"label":"Condition type","path":"item.classification.condition_type","format":"label"},{"label":"Nature","path":"item.classification.condition_nature","format":"label"}]},{"id":"scope","label":"Scope","icon":"link","type":"json","path":"item.scope_summary"},{"id":"values","label":"Values","icon":"file","type":"json","path":"item.value_summary"},{"id":"warnings","label":"Warnings","icon":"archive","type":"json","path":"item.warnings"}]}$json$::jsonb;
  entity_workspace jsonb := $json${"module":"entity-management","optionsEndpoint":"/api/eip/entities/governance/options","layout":{"eyebrow":"Entity Management","title":"Entity Management","subtitle":"Customers, suppliers, employees, partners, authorities, addresses, contacts, bank accounts, relationships, documents, policies, and activity."},"list":{"endpoint":"/api/eip/entities","itemsPath":"items","limit":50,"icon":"building","titlePath":"display_name","subtitlePath":"code","badgePath":"status","searchPlaceholder":"Search entities","filters":[{"name":"role","label":"Role","optionList":"ENTITY_ROLE","defaultOptionsPath":"roles"},{"name":"status","label":"Status","optionList":"ENTITY_STATUS","defaultOptionsPath":"statuses"},{"name":"entity_kind","label":"Kind","optionList":"ENTITY_KIND","options":["ORG","PERSON"]}]},"detail":{"endpoint":"/api/eip/entities/:id","titlePath":"display_name","subtitlePath":"code","badgePath":"status","emptyLabel":"Select an entity."},"actions":{"create":{"label":"Create entity","title":"Create entity","endpoint":"/api/eip/entities","method":"POST","permission":"entities.create","fields":[{"name":"entity_kind","label":"Kind","type":"select","optionList":"ENTITY_KIND","options":["ORG","PERSON"]},{"name":"code","label":"Code"},{"name":"display_name","label":"Display name"},{"name":"legal_name","label":"Legal name"},{"name":"roles","label":"Roles","type":"multiselect","optionList":"ENTITY_ROLE","defaultOptionsPath":"roles"},{"name":"status","label":"Status","type":"select","optionList":"ENTITY_STATUS","defaultOptionsPath":"statuses"},{"name":"registration_number","label":"Registration number"},{"name":"tax_number","label":"Tax number"},{"name":"country_code","label":"Country"},{"name":"currency_code","label":"Currency"},{"name":"website","label":"Website","type":"url"},{"name":"notes","label":"Notes","type":"textarea","rows":2}]}},"tabs":[{"id":"overview","label":"Overview","icon":"building","type":"summary","rows":[{"label":"Kind","path":"item.entity_kind","format":"label"},{"label":"Status","path":"item.status","format":"label"},{"label":"Roles","path":"item.roles","format":"array"},{"label":"Country","path":"item.country_code"},{"label":"Contacts","path":"summary.contacts","format":"number"},{"label":"Tasks","path":"summary.tasks","format":"number"}]},{"id":"profile","label":"Profile","icon":"building","type":"form","form":{"title":"Entity profile","endpoint":"/api/eip/entities/:id","method":"PATCH","permission":"entities.update","submitLabel":"Save entity","resetOnSave":false,"fields":[{"name":"entity_kind","label":"Kind","type":"select","optionList":"ENTITY_KIND","options":["ORG","PERSON"]},{"name":"code","label":"Code"},{"name":"display_name","label":"Display name"},{"name":"legal_name","label":"Legal name"},{"name":"roles","label":"Roles","type":"multiselect","optionList":"ENTITY_ROLE","defaultOptionsPath":"roles"},{"name":"status","label":"Status","type":"select","optionList":"ENTITY_STATUS","defaultOptionsPath":"statuses"},{"name":"registration_number","label":"Registration number"},{"name":"tax_number","label":"Tax number"},{"name":"country_code","label":"Country"},{"name":"currency_code","label":"Currency"},{"name":"website","label":"Website","type":"url"},{"name":"notes","label":"Notes","type":"textarea","rows":2}]}},{"id":"addresses","label":"Addresses","icon":"link","type":"collection","itemsPath":"addresses","titlePath":"label","subtitlePath":"line1","badgePath":"address_type","empty":"No addresses recorded.","createForm":{"title":"Add address","endpoint":"/api/eip/entities/:id/addresses","method":"POST","permission":"entities.manage_addresses","submitLabel":"Add address","fields":[{"name":"address_type","label":"Address type","type":"select","optionList":"ENTITY_ADDRESS_TYPE","options":["MAIN","BILLING","SHIPPING"]},{"name":"label","label":"Label"},{"name":"line1","label":"Line 1"},{"name":"line2","label":"Line 2"},{"name":"city","label":"City"},{"name":"state_region","label":"State/Region"},{"name":"postal_code","label":"Postal code"},{"name":"country_code","label":"Country"},{"name":"is_primary","label":"Primary","type":"checkbox"},{"name":"is_active","label":"Active","type":"checkbox","defaultValue":true}]},"updateForm":{"title":"Update address","endpoint":"/api/eip/entities/:id/addresses/:rowId","method":"PATCH","permission":"entities.manage_addresses","submitLabel":"Save address","resetOnSave":false,"fields":[{"name":"address_type","label":"Address type","type":"select","optionList":"ENTITY_ADDRESS_TYPE","options":["MAIN","BILLING","SHIPPING"]},{"name":"label","label":"Label"},{"name":"line1","label":"Line 1"},{"name":"line2","label":"Line 2"},{"name":"city","label":"City"},{"name":"state_region","label":"State/Region"},{"name":"postal_code","label":"Postal code"},{"name":"country_code","label":"Country"},{"name":"is_primary","label":"Primary","type":"checkbox"},{"name":"is_active","label":"Active","type":"checkbox","defaultValue":true}]}},{"id":"contacts","label":"Contacts","icon":"users","type":"collection","itemsPath":"contacts","titlePath":"label","subtitlePath":"value","badgePath":"contact_type","empty":"No contacts recorded.","createForm":{"title":"Add contact","endpoint":"/api/eip/entities/:id/contacts","method":"POST","permission":"entities.manage_contacts","submitLabel":"Add contact","fields":[{"name":"contact_type","label":"Contact type","type":"select","optionList":"ENTITY_CONTACT_TYPE","options":["EMAIL","PHONE","WEBSITE"]},{"name":"label","label":"Label"},{"name":"value","label":"Value"},{"name":"is_primary","label":"Primary","type":"checkbox"},{"name":"is_active","label":"Active","type":"checkbox","defaultValue":true}]},"updateForm":{"title":"Update contact","endpoint":"/api/eip/entities/:id/contacts/:rowId","method":"PATCH","permission":"entities.manage_contacts","submitLabel":"Save contact","resetOnSave":false,"fields":[{"name":"contact_type","label":"Contact type","type":"select","optionList":"ENTITY_CONTACT_TYPE","options":["EMAIL","PHONE","WEBSITE"]},{"name":"label","label":"Label"},{"name":"value","label":"Value"},{"name":"is_primary","label":"Primary","type":"checkbox"},{"name":"is_active","label":"Active","type":"checkbox","defaultValue":true}]}},{"id":"bank_accounts","label":"Bank Accounts","icon":"file","type":"collection","itemsPath":"bank_accounts","titlePath":"label","subtitlePath":"bank_name","badgePath":"currency_code","empty":"No bank account metadata recorded.","createForm":{"title":"Add bank account","endpoint":"/api/eip/entities/:id/bank-accounts","method":"POST","permission":"entities.manage_bank_accounts","submitLabel":"Add bank account","fields":[{"name":"account_type","label":"Account type","type":"select","optionList":"ENTITY_BANK_ACCOUNT_TYPE","options":["BANK","MOBILE_MONEY","OTHER"]},{"name":"label","label":"Label"},{"name":"bank_name","label":"Bank"},{"name":"account_name","label":"Account name"},{"name":"account_number","label":"Account number"},{"name":"iban","label":"IBAN"},{"name":"swift_bic","label":"SWIFT/BIC"},{"name":"currency_code","label":"Currency"},{"name":"is_primary","label":"Primary","type":"checkbox"},{"name":"is_active","label":"Active","type":"checkbox","defaultValue":true}]},"updateForm":{"title":"Update bank account","endpoint":"/api/eip/entities/:id/bank-accounts/:rowId","method":"PATCH","permission":"entities.manage_bank_accounts","submitLabel":"Save bank account","resetOnSave":false,"fields":[{"name":"account_type","label":"Account type","type":"select","optionList":"ENTITY_BANK_ACCOUNT_TYPE","options":["BANK","MOBILE_MONEY","OTHER"]},{"name":"label","label":"Label"},{"name":"bank_name","label":"Bank"},{"name":"account_name","label":"Account name"},{"name":"account_number","label":"Account number"},{"name":"iban","label":"IBAN"},{"name":"swift_bic","label":"SWIFT/BIC"},{"name":"currency_code","label":"Currency"},{"name":"is_primary","label":"Primary","type":"checkbox"},{"name":"is_active","label":"Active","type":"checkbox","defaultValue":true}]}},{"id":"relationships","label":"Relationships","icon":"link","type":"collection","itemsPath":"relationships","titlePath":"related_entity.display_name","subtitlePath":"related_entity.code","badgePath":"relation_type","empty":"No relationships recorded.","createForm":{"title":"Add relationship","endpoint":"/api/eip/entities/:id/relationships","method":"POST","permission":"entities.manage_relationships","submitLabel":"Add relationship","fields":[{"name":"related_entity_id","label":"Related entity id"},{"name":"relation_type","label":"Relationship","type":"select","optionList":"ENTITY_RELATIONSHIP_TYPE","options":["RELATED_TO","PARENT_OF","SUPPLIER_OF","CUSTOMER_OF"]},{"name":"direction","label":"Direction","type":"select","options":["OUTGOING","INCOMING"]},{"name":"is_active","label":"Active","type":"checkbox","defaultValue":true}]},"updateForm":{"title":"Update relationship","endpoint":"/api/eip/entities/:id/relationships/:rowId","method":"PATCH","permission":"entities.manage_relationships","submitLabel":"Save relationship","resetOnSave":false,"fields":[{"name":"related_entity_id","label":"Related entity id"},{"name":"relation_type","label":"Relationship","type":"select","optionList":"ENTITY_RELATIONSHIP_TYPE","options":["RELATED_TO","PARENT_OF","SUPPLIER_OF","CUSTOMER_OF"]},{"name":"direction","label":"Direction","type":"select","options":["OUTGOING","INCOMING"]},{"name":"is_active","label":"Active","type":"checkbox","defaultValue":true}]}},{"id":"documents","label":"Documents","icon":"document","type":"records","itemsPath":"documents","titlePath":"title","subtitlePath":"record_type","badgePath":"status","empty":"No documents linked."},{"id":"policies","label":"Policies","icon":"policy","type":"summary","rows":[{"label":"Total policies","path":"policy_summary.total","format":"number"},{"label":"Policy domains","path":"policy_summary.domains","format":"array"}]},{"id":"activity","label":"Activity","icon":"archive","type":"summary","rows":[{"label":"Service objects","path":"activity_summary.service_objects.total","format":"number"},{"label":"Tasks","path":"activity_summary.tasks.total","format":"number"},{"label":"Open tasks","path":"activity_summary.tasks.open","format":"number"},{"label":"Overdue tasks","path":"activity_summary.tasks.overdue","format":"number"}]}]}$json$::jsonb;
  inventory_panel jsonb := '{"id":"user-inventory-panel","type":"UserPanel","props":{"tab":"inventory"},"children":[{"id":"inventory-management-workspace","type":"KernelModuleWorkspace","props":{"module":"inventory","configEndpoint":"/api/eip/inventory/governance/options"}}]}'::jsonb;
  policies_menu jsonb := '{"code":"policies","label":"Policies & Conditions","icon":"FileClock","module":"policies-conditions"}'::jsonb;
  policies_panel jsonb := '{"id":"user-policies-panel","type":"UserPanel","props":{"tab":"policies"},"children":[{"id":"policies-conditions-workspace","type":"KernelModuleWorkspace","props":{"module":"policies-conditions","configEndpoint":"/api/eip/policies-conditions/governance/options"}}]}'::jsonb;
  entity_panel jsonb := '{"id":"user-entities-panel","type":"UserPanel","props":{"tab":"entities"},"children":[{"id":"entity-management-workspace","type":"KernelModuleWorkspace","props":{"module":"entity-management","configEndpoint":"/api/eip/entities/governance/options"}}]}'::jsonb;
  surface_record record;
  next_menu jsonb;
  next_children jsonb;
BEGIN
  INSERT INTO eip_core.module_catalog (code, label, description, attrs, is_active)
  VALUES
    ('inventory', 'Inventory', 'Operational material and lot management', jsonb_build_object('ui_workspace', inventory_workspace, 'engine_first_repair', true), true),
    ('policies-conditions', 'Policies & Conditions', 'Read-only governed policy and condition read model', jsonb_build_object('ui_workspace', policies_workspace, 'engine_first_repair', true), true),
    ('entity-management', 'Entity Management', 'Tenant entity registry on the agent kernel', jsonb_build_object('ui_workspace', entity_workspace, 'engine_first_repair', true), true)
  ON CONFLICT (code) DO UPDATE
  SET attrs=jsonb_set(COALESCE(eip_core.module_catalog.attrs,'{}'::jsonb), '{ui_workspace}', EXCLUDED.attrs->'ui_workspace', true)
          || jsonb_build_object('engine_first_repair', true),
      is_active=true,
      updated_at=now();

  UPDATE eip_core.tenant_module_setting
  SET attrs=jsonb_set(COALESCE(attrs,'{}'::jsonb), '{ui_workspace}', inventory_workspace, true),
      updated_at=now()
  WHERE module='inventory' AND is_active=true;

  UPDATE eip_core.tenant_module_setting
  SET attrs=jsonb_set(COALESCE(attrs,'{}'::jsonb), '{ui_workspace}', entity_workspace, true),
      updated_at=now()
  WHERE module='entity-management' AND is_active=true;

  UPDATE eip_core.tenant_module_setting
  SET attrs=jsonb_set(COALESCE(attrs,'{}'::jsonb), '{ui_workspace}', policies_workspace, true)
            || jsonb_build_object('engine_first_repair', true),
      updated_at=now()
  WHERE module IN ('policies-conditions','policies_conditions') AND is_active=true;

  INSERT INTO eip_core.tenant_module_setting (tenant_id, module, code, attrs, is_active)
  SELECT tenant.id,
         'policies-conditions',
         'readonly',
         jsonb_build_object(
           'capabilities', jsonb_build_object('read', true),
           'ui_workspace', policies_workspace,
           'engine_first_repair', true
         ),
         true
  FROM eip_core.tenant tenant
  WHERE tenant.is_active=true
  ON CONFLICT (tenant_id, module, code) DO UPDATE
  SET attrs=jsonb_set(COALESCE(eip_core.tenant_module_setting.attrs,'{}'::jsonb), '{ui_workspace}', policies_workspace, true)
            || jsonb_build_object('engine_first_repair', true),
      is_active=true,
      updated_at=now();

  FOR surface_record IN
    SELECT ui_surface.id, ui_surface.tree
    FROM eip_core.ui_surface ui_surface
    WHERE ui_surface.code='dashboard'
      AND ui_surface.is_active=true
      AND ui_surface.is_published=true
  LOOP
    SELECT jsonb_agg(
             CASE
               WHEN menu_item->>'code'='policies' THEN policies_menu
               ELSE menu_item
             END
             ORDER BY ordinality
           )
    INTO next_menu
    FROM jsonb_array_elements(COALESCE(surface_record.tree->'props'->'menu','[]'::jsonb)) WITH ORDINALITY AS existing(menu_item, ordinality);

    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(next_menu,'[]'::jsonb)) existing_menu
      WHERE existing_menu->>'code'='policies'
    ) THEN
      next_menu := COALESCE(next_menu,'[]'::jsonb) || jsonb_build_array(policies_menu);
    END IF;

    SELECT jsonb_agg(
             CASE
               WHEN child->>'id'='user-inventory-panel' THEN inventory_panel
               WHEN child->>'id'='user-policies-panel' THEN policies_panel
               WHEN child->>'id'='user-entities-panel' THEN entity_panel
               ELSE child
             END
             ORDER BY ordinality
           )
    INTO next_children
    FROM jsonb_array_elements(COALESCE(surface_record.tree->'children','[]'::jsonb)) WITH ORDINALITY AS existing(child, ordinality);

    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(next_children,'[]'::jsonb)) existing_child
      WHERE existing_child->>'id'='user-inventory-panel'
    ) THEN
      next_children := COALESCE(next_children,'[]'::jsonb) || jsonb_build_array(inventory_panel);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(next_children,'[]'::jsonb)) existing_child
      WHERE existing_child->>'id'='user-policies-panel'
    ) THEN
      next_children := COALESCE(next_children,'[]'::jsonb) || jsonb_build_array(policies_panel);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(next_children,'[]'::jsonb)) existing_child
      WHERE existing_child->>'id'='user-entities-panel'
    ) THEN
      next_children := COALESCE(next_children,'[]'::jsonb) || jsonb_build_array(entity_panel);
    END IF;

    UPDATE eip_core.ui_surface
    SET tree=jsonb_set(
          jsonb_set(surface_record.tree, '{props,menu}', next_menu, true),
          '{children}',
          next_children,
          true
        ),
        attrs=COALESCE(attrs,'{}'::jsonb) || '{"engine_first_module_workspace_repair":true}'::jsonb,
        updated_at=now()
    WHERE id=surface_record.id;
  END LOOP;
END;
$$;

COMMIT;
