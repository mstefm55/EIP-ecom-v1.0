-- 0112_procurement_workbench_ui_correction.sql
-- Metadata-only correction: Procurement should open as a guided purchase need
-- workbench instead of disconnected object tabs.

BEGIN;

DO $$
DECLARE
  procurement_menu jsonb := '{"code":"procurement","label":"Procurement","icon":"ShoppingCart","module":"procurement"}'::jsonb;
  procurement_panel jsonb := '{
    "id":"user-procurement-panel",
    "type":"UserPanel",
    "props":{"tab":"procurement"},
    "children":[
      {
        "id":"procurement-workspace",
        "type":"ProcurementWorkspace",
        "props":{
          "module":"procurement",
          "title":"Purchase Need Workbench",
          "subtitle":"Review what needs buying, supplier options, buying route, offers, and the next owner action.",
          "endpoints":{
            "overview":"/api/eip/procurement/overview",
            "workbench":"/api/eip/procurement/purchase-needs",
            "lookup":"/api/eip/procurement/lookup",
            "supplierLinks":"/api/eip/procurement/supplier-links",
            "requisitions":"/api/eip/procurement/requisitions",
            "rfqs":"/api/eip/procurement/rfqs",
            "cashPurchases":"/api/eip/procurement/cash-purchases"
          },
          "tabs":[
            {"id":"workbench","label":"Purchase Need Workbench"},
            {"id":"supplier-policy","label":"Supplier Policy"},
            {"id":"history","label":"History"}
          ],
          "actions":{
            "refresh":"Refresh",
            "createRequisition":"Create requisition",
            "approve":"Approve",
            "ignore":"Ignore",
            "createRfq":"Request quotes",
            "addQuote":"Add supplier offer",
            "compareQuotes":"Compare offers",
            "approveQuote":"Approve recommended offer",
            "saveSupplierLink":"Save supplier link",
            "recordCashPurchase":"Record cash purchase"
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
      WHERE existing_menu->>'code'='procurement'
    ) THEN
      next_menu := next_menu || jsonb_build_array(procurement_menu);
    END IF;

    next_children := COALESCE(surface_record.tree->'children','[]'::jsonb);
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(next_children) existing_child
      WHERE existing_child->>'id'='user-procurement-panel'
    ) THEN
      SELECT jsonb_agg(
        CASE
          WHEN existing_child->>'id'='user-procurement-panel' THEN procurement_panel
          ELSE existing_child
        END
      )
      INTO next_children
      FROM jsonb_array_elements(next_children) existing_child;
    ELSE
      next_children := next_children || jsonb_build_array(procurement_panel);
    END IF;

    UPDATE eip_core.ui_surface
    SET tree = jsonb_set(
          jsonb_set(surface_record.tree, '{props,menu}', next_menu, true),
          '{children}',
          next_children,
          true
        ),
        attrs = COALESCE(attrs,'{}'::jsonb) || '{"module":"dashboard","procurement_surface":true,"procurement_workbench":true}'::jsonb,
        updated_at=now()
    WHERE id=surface_record.id;
  END LOOP;
END;
$$;

COMMIT;
