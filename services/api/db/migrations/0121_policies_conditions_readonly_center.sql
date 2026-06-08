-- Phase 2 read-only Policies & Conditions center.
-- commercial_condition remains the physical V1 policy/condition table.

INSERT INTO eip_authz.permission(code, label, description) VALUES
  (
    'policies_conditions.read',
    'Read Policies & Conditions',
    'View tenant-scoped governed business policies and commercial conditions'
  )
ON CONFLICT (code) DO UPDATE SET
  label=EXCLUDED.label,
  description=EXCLUDED.description;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER', 'policies_conditions.read'),
    ('ADMIN_EXEC', 'policies_conditions.read'),
    ('ACCESS_UNIVERSAL', 'policies_conditions.read'),
    ('ACCESS_READ_ONLY', 'policies_conditions.read'),
    ('ECOM_ADMIN', 'policies_conditions.read'),
    ('ERP_USER', 'policies_conditions.read')
)
INSERT INTO eip_authz.role_template_permission(role_code, permission_code)
SELECT role_template.code, bundles.permission_code
FROM bundles
JOIN eip_authz.role_template role_template ON role_template.code=bundles.role_code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT (role_code, permission_code) DO NOTHING;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER', 'policies_conditions.read'),
    ('ADMIN_EXEC', 'policies_conditions.read'),
    ('ACCESS_UNIVERSAL', 'policies_conditions.read'),
    ('ACCESS_READ_ONLY', 'policies_conditions.read'),
    ('ECOM_ADMIN', 'policies_conditions.read'),
    ('ERP_USER', 'policies_conditions.read')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT role_record.id, bundles.permission_code
FROM bundles
JOIN eip_authz.role role_record ON role_record.code=bundles.role_code
JOIN eip_authz.permission permission ON permission.code=bundles.permission_code
ON CONFLICT (role_id, permission_code) DO NOTHING;

DO $$
DECLARE
  policies_menu jsonb := '{"code":"policies","label":"Policies & Conditions","icon":"FileClock"}'::jsonb;
  policies_panel jsonb := '{
    "id": "user-policies-panel",
    "type": "UserPanel",
    "props": { "tab": "policies" },
    "children": [
      {
        "id": "policies-conditions-workspace",
        "type": "PoliciesConditionsWorkspace",
        "props": {
          "title": "Policies & Conditions",
          "subtitle": "Read-only business rules that explain recommendations and approvals.",
          "endpoints": {
            "list": "/api/eip/policies-conditions",
            "detail": "/api/eip/policies-conditions/:id",
            "overview": "/api/eip/policies-conditions/overview"
          },
          "tabs": [
            { "id": "overview", "label": "Overview" },
            { "id": "library", "label": "Policy Library" },
            { "id": "needs_review", "label": "Needs Review" }
          ],
          "labels": {
            "search": "Search policies...",
            "refresh": "Refresh",
            "readOnly": "Create/edit will be added in a later governed wave.",
            "emptyTitle": "No policies or conditions yet",
            "emptyMessage": "Create governed business rules before EIP can explain recommendations for this area.",
            "detailTitle": "Condition detail",
            "noSelection": "Select a policy or condition to inspect the read model."
          },
          "pageSizes": [12, 25, 50]
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
      WHERE existing_menu->>'code'='policies'
    ) THEN
      next_menu := next_menu || jsonb_build_array(policies_menu);
    END IF;

    next_children := COALESCE(surface_record.tree->'children', '[]'::jsonb);
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(next_children) existing_child
      WHERE existing_child->>'id'='user-policies-panel'
    ) THEN
      next_children := next_children || jsonb_build_array(policies_panel);
    END IF;

    UPDATE eip_core.ui_surface
    SET tree=jsonb_set(
          jsonb_set(surface_record.tree, '{props,menu}', next_menu, true),
          '{children}',
          next_children,
          true
        ),
        attrs=COALESCE(attrs, '{}'::jsonb) || '{"module":"dashboard","policies_conditions_surface":true,"production_data_only":true}'::jsonb,
        updated_at=now()
    WHERE id=surface_record.id;
  END LOOP;
END;
$$;
