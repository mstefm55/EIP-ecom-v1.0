-- 0122_policies_conditions_business_lexicon.sql
-- Purpose: seed the Phase 2 Policies & Conditions business lexicon and read-only taxonomy.
-- No new tables, no commercial_condition rewrites, and no changes to 0121.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.ensure_policy_taxonomy_list(
  p_list_code text,
  p_list_name text,
  p_attrs jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  target_list_id uuid;
BEGIN
  SELECT dropdown_list.id INTO target_list_id
  FROM eip_core.dropdown_list dropdown_list
  WHERE dropdown_list.tenant_id IS NULL
    AND dropdown_list.module='policies_conditions'
    AND dropdown_list.code=p_list_code
    AND dropdown_list.version=1
  ORDER BY dropdown_list.created_at ASC
  LIMIT 1;

  IF target_list_id IS NULL THEN
    INSERT INTO eip_core.dropdown_list
      (tenant_id, module, code, name, version, is_active, attrs)
    VALUES
      (NULL, 'policies_conditions', p_list_code, p_list_name, 1, true, p_attrs)
    RETURNING id INTO target_list_id;
  ELSE
    UPDATE eip_core.dropdown_list
    SET name=p_list_name,
        is_active=true,
        attrs=COALESCE(attrs,'{}'::jsonb) || p_attrs,
        updated_at=now()
    WHERE id=target_list_id;
  END IF;

  RETURN target_list_id;
END;
$$;

SELECT pg_temp.ensure_policy_taxonomy_list(
  'POLICY_DOMAIN',
  'Policy Domain',
  '{
    "scope":"policies_conditions_taxonomy",
    "taxonomy_level":"domain",
    "delegated":true,
    "managed_by":"tenant",
    "extensible":true,
    "closed_enum":false,
    "default_seed":true,
    "source":"policies_conditions_business_lexicon_v1"
  }'::jsonb
);

SELECT pg_temp.ensure_policy_taxonomy_list(
  'POLICY_FAMILY',
  'Policy Family',
  '{
    "scope":"policies_conditions_taxonomy",
    "taxonomy_level":"family",
    "delegated":true,
    "managed_by":"tenant",
    "extensible":true,
    "closed_enum":false,
    "default_seed":false,
    "source":"policies_conditions_business_lexicon_v1"
  }'::jsonb
);

SELECT pg_temp.ensure_policy_taxonomy_list(
  'POLICY_CONDITION_TYPE',
  'Policy Condition Type',
  '{
    "scope":"policies_conditions_taxonomy",
    "taxonomy_level":"condition_type",
    "delegated":true,
    "managed_by":"tenant",
    "extensible":true,
    "closed_enum":false,
    "default_seed":false,
    "source":"policies_conditions_business_lexicon_v1"
  }'::jsonb
);

SELECT pg_temp.ensure_policy_taxonomy_list(
  'POLICY_CONDITION_SUBTYPE',
  'Policy Condition Subtype',
  '{
    "scope":"policies_conditions_taxonomy",
    "taxonomy_level":"condition_subtype",
    "delegated":true,
    "managed_by":"tenant",
    "extensible":true,
    "closed_enum":false,
    "default_seed":false,
    "source":"policies_conditions_business_lexicon_v1"
  }'::jsonb
);

-- Only default domains are seeded here. Families, condition types, and subtypes
-- remain governed tenant-extensible lists populated by future controlled waves.
WITH domain_list AS (
  SELECT pg_temp.ensure_policy_taxonomy_list(
    'POLICY_DOMAIN',
    'Policy Domain',
    '{
      "scope":"policies_conditions_taxonomy",
      "taxonomy_level":"domain",
      "delegated":true,
      "managed_by":"tenant",
      "extensible":true,
      "closed_enum":false,
      "default_seed":true,
      "source":"policies_conditions_business_lexicon_v1"
    }'::jsonb
  ) AS id
),
domains(code, label, sort_order, description) AS (
  VALUES
    ('COMMERCIAL','Commercial',10,'Buying, selling, payment, price, discount, credit, settlement, Incoterms, and trading-party commercial conditions.'),
    ('FINANCIAL','Financial',20,'Internal cash, liquidity, debt, capital structure, financial ratio, investment, and borrowing policy.'),
    ('APPROVAL_FRAMEWORK','Approval Framework',30,'Approval thresholds, matrices, delegation of authority, and purchasing, expenditure, discount, borrowing, or investment approvals.'),
    ('INVENTORY','Inventory',40,'Reorder, safety stock, threshold, reservation, release, and storage policy.'),
    ('FISCAL_TAX_TREATMENT','Fiscal & Tax Treatment',50,'VAT, sales tax, tax classification, exemption, withholding, and fiscal jurisdiction treatment.'),
    ('MARKETPLACE','Marketplace',60,'Marketplace commissions, platform eligibility, channel pricing, conditions, and publication rules.'),
    ('LOGISTICS','Logistics',70,'Carrier selection, routing, dispatch, warehouse handling, delivery execution, transport rules, and operational lead-time rules.')
)
INSERT INTO eip_core.dropdown_value
  (list_id, code, label, sort_order, is_active, attrs)
SELECT
  domain_list.id,
  domains.code,
  domains.label,
  domains.sort_order,
  true,
  jsonb_build_object(
    'description', domains.description,
    'scope', 'policies_conditions_domain',
    'governed', true,
    'source', 'policies_conditions_business_lexicon_v1'
  )
FROM domain_list
CROSS JOIN domains
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label,
    sort_order=EXCLUDED.sort_order,
    is_active=true,
    attrs=COALESCE(eip_core.dropdown_value.attrs,'{}'::jsonb) || EXCLUDED.attrs,
    updated_at=now();

DO $$
DECLARE
  policies_menu jsonb := '{"code":"policies","label":"Policies & Conditions","icon":"FileClock"}'::jsonb;
  policies_workspace_props jsonb := '{
    "title": "Policies & Conditions",
    "subtitle": "Read-only business rules that explain recommendations and approvals.",
    "endpoints": {
      "list": "/api/eip/policies-conditions",
      "detail": "/api/eip/policies-conditions/:id",
      "overview": "/api/eip/policies-conditions/overview",
      "taxonomy": "/api/eip/policies-conditions/taxonomy"
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
    "pageSizes": [12, 25, 50],
    "domainOptions": [
      "COMMERCIAL",
      "FINANCIAL",
      "APPROVAL_FRAMEWORK",
      "INVENTORY",
      "FISCAL_TAX_TREATMENT",
      "MARKETPLACE",
      "LOGISTICS"
    ]
  }'::jsonb;
  policies_workspace jsonb := jsonb_build_object(
    'id', 'policies-conditions-workspace',
    'type', 'PoliciesConditionsWorkspace',
    'props', policies_workspace_props
  );
  policies_panel jsonb := jsonb_build_object(
    'id', 'user-policies-panel',
    'type', 'UserPanel',
    'props', '{"tab":"policies"}'::jsonb,
    'children', jsonb_build_array(policies_workspace)
  );
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
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(next_children) existing_child
      WHERE existing_child->>'id'='user-policies-panel'
    ) THEN
      SELECT jsonb_agg(
        CASE
          WHEN root_child->>'id'='user-policies-panel' THEN
            jsonb_set(
              root_child,
              '{children}',
              CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(COALESCE(root_child->'children', '[]'::jsonb)) panel_child
                  WHERE panel_child->>'id'='policies-conditions-workspace'
                     OR panel_child->>'type'='PoliciesConditionsWorkspace'
                ) THEN COALESCE((
                  SELECT jsonb_agg(
                    CASE
                      WHEN panel_child->>'id'='policies-conditions-workspace'
                        OR panel_child->>'type'='PoliciesConditionsWorkspace'
                      THEN jsonb_set(
                        panel_child,
                        '{props}',
                        COALESCE(panel_child->'props', '{}'::jsonb) || policies_workspace_props,
                        true
                      )
                      ELSE panel_child
                    END
                  )
                  FROM jsonb_array_elements(COALESCE(root_child->'children', '[]'::jsonb)) panel_child
                ), '[]'::jsonb)
                ELSE COALESCE(root_child->'children', '[]'::jsonb) || jsonb_build_array(policies_workspace)
              END,
              true
            )
          ELSE root_child
        END
      )
      INTO next_children
      FROM jsonb_array_elements(next_children) root_child;
    ELSE
      next_children := next_children || jsonb_build_array(policies_panel);
    END IF;

    UPDATE eip_core.ui_surface
    SET tree=jsonb_set(
          jsonb_set(surface_record.tree, '{props,menu}', next_menu, true),
          '{children}',
          next_children,
          true
        ),
        attrs=COALESCE(attrs, '{}'::jsonb) || '{
          "module":"dashboard",
          "policies_conditions_business_lexicon":true,
          "policies_conditions_surface":true,
          "production_data_only":true
        }'::jsonb,
        updated_at=now()
    WHERE id=surface_record.id;
  END LOOP;
END;
$$;

COMMIT;
