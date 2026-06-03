-- Clarify payment settings ownership in the dashboard descriptor.
-- Payment operations remain in Orders & Payments; tenant payment preferences
-- and readiness live under Settings. No schema changes.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.patch_payment_settings_surface_node(node jsonb, payment_node jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  next_node jsonb := node;
  patched_children jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(node) <> 'object' THEN
    RETURN node;
  END IF;

  IF node->>'type' = 'EcomCommerceSettingsPanel'
     OR node->>'id' IN ('commerce-settings', 'commerce-payment-settings') THEN
    RETURN payment_node;
  END IF;

  IF jsonb_typeof(node->'children') = 'array' THEN
    SELECT COALESCE(
      jsonb_agg(
        pg_temp.patch_payment_settings_surface_node(child.value, payment_node)
        ORDER BY child.ordinality
      ),
      '[]'::jsonb
    )
    INTO patched_children
    FROM jsonb_array_elements(node->'children') WITH ORDINALITY AS child(value, ordinality);

    IF node->>'id' = 'user-settings-panel'
       AND NOT EXISTS (
         SELECT 1
         FROM jsonb_array_elements(patched_children) child(value)
         WHERE child.value->>'type' = 'EcomCommerceSettingsPanel'
            OR child.value->>'id' = 'commerce-payment-settings'
       ) THEN
      patched_children := patched_children || jsonb_build_array(payment_node);
    END IF;

    next_node := jsonb_set(next_node, '{children}', patched_children, true);
  END IF;

  RETURN next_node;
END;
$$;

DO $$
DECLARE
  payment_node jsonb := $json$
  {
    "id": "commerce-payment-settings",
    "type": "EcomCommerceSettingsPanel",
    "props": {
      "module": "ecom",
      "capability": "payments",
      "placement": "settings",
      "layout": {
        "eyebrow": "Settings",
        "title": "Commerce / Payments",
        "subtitle": "Tenant-local commerce preferences and payment readiness. Provider secrets stay in Admin Console > Connections.",
        "paymentTitle": "Payment readiness & preferences",
        "paymentSubtitle": "Enable storefront payment methods, choose business policy, and verify provider readiness without exposing secrets.",
        "operationsPath": "Dashboard > Orders & Payments > Payments",
        "connectionsPath": "Admin Console > Connections"
      }
    }
  }
  $json$::jsonb;
BEGIN
  UPDATE eip_core.ui_surface
  SET tree = pg_temp.patch_payment_settings_surface_node(tree, payment_node),
      updated_at = now()
  WHERE code = 'dashboard'
    AND is_active = true
    AND is_published = true
    AND (
      tree::text LIKE '%EcomCommerceSettingsPanel%'
      OR tree::text LIKE '%user-settings-panel%'
    );
END;
$$;

COMMIT;
