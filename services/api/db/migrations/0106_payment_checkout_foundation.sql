-- 0106_payment_checkout_foundation.sql
-- Purpose: payment/checkout foundation governance for V1 ecommerce tenants.
-- Uses existing kernel tables only: tenant_module_setting, dropdowns,
-- process_def/task_template/process_binding, role templates, and UI surfaces.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.seed_ecom_payment_dropdown(
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
  WHERE tenant_id IS NULL
    AND module='ecom'
    AND code=list_code
    AND version=1
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_list_id IS NULL THEN
    INSERT INTO eip_core.dropdown_list
      (tenant_id, module, code, name, version, is_active, attrs)
    VALUES
      (NULL, 'ecom', list_code, list_name, 1, true, '{"ui":{"module":"ecom","scope":"payment_checkout"}}'::jsonb)
    RETURNING id INTO target_list_id;
  ELSE
    UPDATE eip_core.dropdown_list
    SET name=list_name,
        is_active=true,
        attrs=COALESCE(attrs,'{}'::jsonb) || '{"ui":{"module":"ecom","scope":"payment_checkout"}}'::jsonb,
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

SELECT pg_temp.seed_ecom_payment_dropdown('ECOM_PAYMENT_METHOD', 'ECOM Payment Method', '[
  {"code":"card","label":"Card","sort_order":10,"attrs":{"provider":"checkout_com"}},
  {"code":"paypal","label":"PayPal","sort_order":20,"attrs":{"provider":"paypal"}},
  {"code":"google_pay","label":"Google Pay","sort_order":30,"attrs":{"provider":"checkout_com","wallet":true}},
  {"code":"manual_test","label":"Sandbox manual test","sort_order":90,"attrs":{"provider":"manual_test","sandbox_only":true}}
]'::jsonb);

SELECT pg_temp.seed_ecom_payment_dropdown('ECOM_PAYMENT_PROVIDER', 'ECOM Payment Provider', '[
  {"code":"checkout_com","label":"Checkout.com","sort_order":10,"attrs":{"primary":true}},
  {"code":"paypal","label":"PayPal","sort_order":20},
  {"code":"manual_test","label":"Sandbox manual test","sort_order":90,"attrs":{"sandbox_only":true}}
]'::jsonb);

SELECT pg_temp.seed_ecom_payment_dropdown('ECOM_PAYMENT_STATUS', 'ECOM Payment Status', '[
  {"code":"created","label":"Created","sort_order":10},
  {"code":"pending","label":"Pending","sort_order":20},
  {"code":"authorized","label":"Authorized","sort_order":30},
  {"code":"captured","label":"Captured","sort_order":40},
  {"code":"paid","label":"Paid","sort_order":50},
  {"code":"failed","label":"Failed","sort_order":60},
  {"code":"cancelled","label":"Cancelled","sort_order":70},
  {"code":"expired","label":"Expired","sort_order":80},
  {"code":"refund_requested","label":"Refund requested","sort_order":90},
  {"code":"refunded","label":"Refunded","sort_order":100},
  {"code":"requires_action","label":"Requires action","sort_order":110},
  {"code":"requires_review","label":"Requires review","sort_order":120}
]'::jsonb);

SELECT pg_temp.seed_ecom_payment_dropdown('ECOM_PAYMENT_EVENT_TYPE', 'ECOM Payment Event Type', '[
  {"code":"payment_created","label":"Payment created","sort_order":10},
  {"code":"payment_authorized","label":"Payment authorized","sort_order":20},
  {"code":"payment_captured","label":"Payment captured","sort_order":30},
  {"code":"payment_paid","label":"Payment paid","sort_order":40},
  {"code":"payment_failed","label":"Payment failed","sort_order":50},
  {"code":"payment_cancelled","label":"Payment cancelled","sort_order":60},
  {"code":"payment_expired","label":"Payment expired","sort_order":70},
  {"code":"refund_requested","label":"Refund requested","sort_order":80},
  {"code":"refund_completed","label":"Refund completed","sort_order":90},
  {"code":"webhook_received","label":"Webhook received","sort_order":100},
  {"code":"webhook_failed_verification","label":"Webhook failed verification","sort_order":110}
]'::jsonb);

SELECT pg_temp.seed_ecom_payment_dropdown('ECOM_CAPTURE_MODE', 'ECOM Capture Mode', '[
  {"code":"automatic","label":"Automatic capture","sort_order":10},
  {"code":"manual","label":"Manual capture","sort_order":20}
]'::jsonb);

WITH so_list AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE code='SERVICE_OBJECT_STATUS'
    AND is_active=true
  ORDER BY (tenant_id IS NOT NULL) DESC, version DESC
  LIMIT 1
),
values_to_seed(code, label, sort_order, attrs) AS (
  VALUES
    ('authorized','Authorized',42,'{"scope":"status","module":"ecom","object_type":"payment"}'::jsonb),
    ('captured','Captured',48,'{"scope":"status","module":"ecom","object_type":"payment"}'::jsonb),
    ('paid','Paid',52,'{"scope":"status","module":"ecom","object_type":"payment"}'::jsonb),
    ('failed','Failed',62,'{"scope":"status","module":"ecom","object_type":"payment"}'::jsonb),
    ('requires_review','Requires review',64,'{"scope":"status","module":"ecom","object_type":"payment"}'::jsonb),
    ('refund_requested','Refund requested',72,'{"scope":"status","module":"ecom","object_type":"payment"}'::jsonb),
    ('refunded','Refunded',82,'{"scope":"status","module":"ecom","object_type":"payment"}'::jsonb)
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT so_list.id, v.code, v.label, v.sort_order, true, v.attrs
FROM so_list
CROSS JOIN values_to_seed v
ON CONFLICT (list_id, code) DO UPDATE
SET label=EXCLUDED.label,
    sort_order=EXCLUDED.sort_order,
    is_active=true,
    attrs=EXCLUDED.attrs,
    updated_at=now();

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('ECOM_PAYMENT_READ', 'Read ECOM payments', 'View ecommerce payment sessions and payment status'),
  ('ECOM_PAYMENT_WRITE', 'Write ECOM payments', 'Update ecommerce payment operational metadata'),
  ('ECOM_PAYMENT_CAPTURE', 'Capture ECOM payments', 'Advance authorized ecommerce payments through governed capture'),
  ('ECOM_PAYMENT_REFUND_REQUEST', 'Request ECOM payment refunds', 'Create governed refund requests from payment records'),
  ('ECOM_PAYMENT_ADMIN', 'Administer ECOM payments', 'Administer ecommerce payment operations'),
  ('ECOM_PAYMENT_CONNECTOR_READ', 'Read ECOM payment connector readiness', 'View redacted payment connector readiness')
ON CONFLICT (code) DO UPDATE
SET label=EXCLUDED.label,
    description=EXCLUDED.description;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','ECOM_PAYMENT_READ'), ('ADMIN_SUPER','ECOM_PAYMENT_WRITE'),
    ('ADMIN_SUPER','ECOM_PAYMENT_CAPTURE'), ('ADMIN_SUPER','ECOM_PAYMENT_REFUND_REQUEST'),
    ('ADMIN_SUPER','ECOM_PAYMENT_ADMIN'), ('ADMIN_SUPER','ECOM_PAYMENT_CONNECTOR_READ'),
    ('ADMIN_EXEC','ECOM_PAYMENT_READ'), ('ADMIN_EXEC','ECOM_PAYMENT_WRITE'),
    ('ADMIN_EXEC','ECOM_PAYMENT_CAPTURE'), ('ADMIN_EXEC','ECOM_PAYMENT_REFUND_REQUEST'),
    ('ADMIN_EXEC','ECOM_PAYMENT_CONNECTOR_READ'),
    ('ADMIN_ASSOC','ECOM_PAYMENT_READ'), ('ADMIN_ASSOC','ECOM_PAYMENT_CONNECTOR_READ'),
    ('ACCESS_UNIVERSAL','ECOM_PAYMENT_READ'), ('ACCESS_UNIVERSAL','ECOM_PAYMENT_WRITE'),
    ('ACCESS_UNIVERSAL','ECOM_PAYMENT_CAPTURE'), ('ACCESS_UNIVERSAL','ECOM_PAYMENT_REFUND_REQUEST'),
    ('ACCESS_UNIVERSAL','ECOM_PAYMENT_ADMIN'), ('ACCESS_UNIVERSAL','ECOM_PAYMENT_CONNECTOR_READ'),
    ('ECOM_ADMIN','ECOM_PAYMENT_READ'), ('ECOM_ADMIN','ECOM_PAYMENT_WRITE'),
    ('ECOM_ADMIN','ECOM_PAYMENT_CAPTURE'), ('ECOM_ADMIN','ECOM_PAYMENT_REFUND_REQUEST'),
    ('ECOM_ADMIN','ECOM_PAYMENT_ADMIN'), ('ECOM_ADMIN','ECOM_PAYMENT_CONNECTOR_READ'),
    ('ECOM_USER','ECOM_PAYMENT_READ'), ('ECOM_USER','ECOM_PAYMENT_REFUND_REQUEST'),
    ('ACCESS_ECOM_FULL','ECOM_PAYMENT_READ'), ('ACCESS_ECOM_FULL','ECOM_PAYMENT_WRITE'),
    ('ACCESS_ECOM_FULL','ECOM_PAYMENT_CAPTURE'), ('ACCESS_ECOM_FULL','ECOM_PAYMENT_REFUND_REQUEST'),
    ('ACCESS_ECOM_FULL','ECOM_PAYMENT_CONNECTOR_READ'),
    ('ACCESS_READ_ONLY','ECOM_PAYMENT_READ'), ('ACCESS_READ_ONLY','ECOM_PAYMENT_CONNECTOR_READ')
)
INSERT INTO eip_authz.role_template_permission(role_code, permission_code)
SELECT rt.code, bundles.permission_code
FROM eip_authz.role_template rt
JOIN bundles ON bundles.role_code=rt.code
JOIN eip_authz.permission p ON p.code=bundles.permission_code
ON CONFLICT DO NOTHING;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ADMIN_SUPER','ECOM_PAYMENT_READ'), ('ADMIN_SUPER','ECOM_PAYMENT_WRITE'),
    ('ADMIN_SUPER','ECOM_PAYMENT_CAPTURE'), ('ADMIN_SUPER','ECOM_PAYMENT_REFUND_REQUEST'),
    ('ADMIN_SUPER','ECOM_PAYMENT_ADMIN'), ('ADMIN_SUPER','ECOM_PAYMENT_CONNECTOR_READ'),
    ('ADMIN_EXEC','ECOM_PAYMENT_READ'), ('ADMIN_EXEC','ECOM_PAYMENT_WRITE'),
    ('ADMIN_EXEC','ECOM_PAYMENT_CAPTURE'), ('ADMIN_EXEC','ECOM_PAYMENT_REFUND_REQUEST'),
    ('ADMIN_EXEC','ECOM_PAYMENT_CONNECTOR_READ'),
    ('ADMIN_ASSOC','ECOM_PAYMENT_READ'), ('ADMIN_ASSOC','ECOM_PAYMENT_CONNECTOR_READ'),
    ('ACCESS_UNIVERSAL','ECOM_PAYMENT_READ'), ('ACCESS_UNIVERSAL','ECOM_PAYMENT_WRITE'),
    ('ACCESS_UNIVERSAL','ECOM_PAYMENT_CAPTURE'), ('ACCESS_UNIVERSAL','ECOM_PAYMENT_REFUND_REQUEST'),
    ('ACCESS_UNIVERSAL','ECOM_PAYMENT_ADMIN'), ('ACCESS_UNIVERSAL','ECOM_PAYMENT_CONNECTOR_READ'),
    ('ECOM_ADMIN','ECOM_PAYMENT_READ'), ('ECOM_ADMIN','ECOM_PAYMENT_WRITE'),
    ('ECOM_ADMIN','ECOM_PAYMENT_CAPTURE'), ('ECOM_ADMIN','ECOM_PAYMENT_REFUND_REQUEST'),
    ('ECOM_ADMIN','ECOM_PAYMENT_ADMIN'), ('ECOM_ADMIN','ECOM_PAYMENT_CONNECTOR_READ'),
    ('ECOM_USER','ECOM_PAYMENT_READ'), ('ECOM_USER','ECOM_PAYMENT_REFUND_REQUEST'),
    ('ACCESS_ECOM_FULL','ECOM_PAYMENT_READ'), ('ACCESS_ECOM_FULL','ECOM_PAYMENT_WRITE'),
    ('ACCESS_ECOM_FULL','ECOM_PAYMENT_CAPTURE'), ('ACCESS_ECOM_FULL','ECOM_PAYMENT_REFUND_REQUEST'),
    ('ACCESS_ECOM_FULL','ECOM_PAYMENT_CONNECTOR_READ'),
    ('ACCESS_READ_ONLY','ECOM_PAYMENT_READ'), ('ACCESS_READ_ONLY','ECOM_PAYMENT_CONNECTOR_READ')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, bundles.permission_code
FROM eip_authz.role r
JOIN bundles ON bundles.role_code=r.code
JOIN eip_authz.permission p ON p.code=bundles.permission_code
ON CONFLICT DO NOTHING;

WITH defaults AS (
  SELECT '{
    "methods": [
      {"code":"card","label":"Credit card","enabled":true},
      {"code":"paypal","label":"PayPal","enabled":false},
      {"code":"google_pay","label":"Google Pay","enabled":false},
      {"code":"manual_test","label":"Sandbox manual test","enabled":false}
    ],
    "default_currency":"USD",
    "capture_mode":"automatic",
    "allowed_countries":[],
    "display_order":["card","paypal","google_pay","manual_test"],
    "refund_approval_threshold":null,
    "manual_review_rules":{"enabled":true,"high_value_threshold":null},
    "providers": {
      "card":{"provider_code":"checkout_com","environment":"production","connection_code":null},
      "paypal":{"provider_code":"paypal","environment":"production","connection_code":null},
      "google_pay":{"provider_code":"checkout_com","environment":"production","connection_code":null},
      "manual_test":{"provider_code":"manual_test","environment":"sandbox","connection_code":null}
    }
  }'::jsonb AS payment
),
target_tenants AS (
  SELECT DISTINCT t.id
  FROM eip_core.tenant t
  LEFT JOIN eip_core.tenant_module_setting s
    ON s.tenant_id=t.id AND s.module='ecom' AND s.code='commerce'
  WHERE t.is_active=true
    AND (
      t.code='eip_ecom'
      OR s.id IS NOT NULL
      OR COALESCE(t.attrs->>'industry','')='ecom'
      OR COALESCE(t.attrs->>'template_kind','')='base'
    )
)
INSERT INTO eip_core.tenant_module_setting (tenant_id, module, code, attrs, is_active)
SELECT target_tenants.id, 'ecom', 'commerce',
       jsonb_build_object('payment', defaults.payment, 'capabilities', '{"payments":true}'::jsonb),
       true
FROM target_tenants, defaults
ON CONFLICT (tenant_id, module, code) DO UPDATE
SET attrs=jsonb_set(
      jsonb_set(
        COALESCE(eip_core.tenant_module_setting.attrs,'{}'::jsonb),
        '{payment}',
        COALESCE(EXCLUDED.attrs->'payment','{}'::jsonb) || COALESCE(eip_core.tenant_module_setting.attrs->'payment','{}'::jsonb),
        true
      ),
      '{capabilities}',
      COALESCE(eip_core.tenant_module_setting.attrs->'capabilities','{}'::jsonb) || '{"payments":true}'::jsonb,
      true
    ),
    is_active=true,
    updated_at=now();

INSERT INTO eip_core.task_template
  (tenant_id, process_def_id, service_object_type, task_type, title, description, is_active, sort_order, attrs)
SELECT pd.tenant_id, pd.id, 'payment', seed.task_type, seed.title, seed.description, true, seed.sort_order,
       seed.attrs
FROM eip_core.process_def pd
JOIN (
  VALUES
    ('PAYMENT_FAILED_FOLLOW_UP', 'Payment failed follow-up', 'Review failed payment and decide whether customer follow-up or order cancellation is required.', 20, '{"module":"ecom","source":"payment_checkout_foundation","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"high"}}'::jsonb),
    ('MANUAL_PAYMENT_REVIEW', 'Manual payment review', 'Review payment sessions that require operator confirmation, fraud review, or capture.', 30, '{"module":"ecom","source":"payment_checkout_foundation","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"high"}}'::jsonb)
) AS seed(task_type, title, description, sort_order, attrs) ON true
WHERE pd.code='ECOM_PAYMENT_FLOW'
  AND pd.version=1
  AND pd.is_active=true
ON CONFLICT (tenant_id, process_def_id, COALESCE(service_object_type, ''), task_type) DO UPDATE
SET title=EXCLUDED.title,
    description=EXCLUDED.description,
    is_active=true,
    sort_order=EXCLUDED.sort_order,
    attrs=EXCLUDED.attrs,
    updated_at=now();

UPDATE eip_core.module_catalog
SET attrs=jsonb_set(
      COALESCE(attrs,'{}'::jsonb),
      '{capabilities}',
      COALESCE(attrs->'capabilities','{}'::jsonb) || '{"payments":true,"payment_readiness":true}'::jsonb,
      true
    ),
    updated_at=now()
WHERE code IN ('ecom','commerce');

DO $$
DECLARE
  payment_tab jsonb := '{"id":"payments","label":"Payments","icon":"CreditCard"}'::jsonb;
BEGIN
  UPDATE eip_core.ui_surface
  SET tree=jsonb_set(
        tree,
        '{children,1,children,0,props,layout,tabs}',
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE(tree#>'{children,1,children,0,props,layout,tabs}','[]'::jsonb)) item
            WHERE item->>'id'='payments'
          )
          THEN COALESCE(tree#>'{children,1,children,0,props,layout,tabs}','[]'::jsonb)
          ELSE COALESCE(tree#>'{children,1,children,0,props,layout,tabs}','[]'::jsonb) || jsonb_build_array(payment_tab)
        END,
        true
      ),
      updated_at=now()
  WHERE code='dashboard.shell'
    AND is_active=true
    AND is_published=true
    AND jsonb_path_exists(tree, '$.children[*].children[*] ? (@.type == "EcomOrderManagementPanel")');
END $$;

CREATE INDEX IF NOT EXISTS service_object_ecom_payment_created_idx
  ON eip_core.service_object (tenant_id, created_at DESC, id)
  WHERE object_type='payment';

CREATE INDEX IF NOT EXISTS info_record_ecom_payment_event_idx
  ON eip_core.info_record (tenant_id, record_type, created_at DESC, id)
  WHERE record_type IN ('ECOM_PAYMENT_EVENT','ECOM_PAYMENT_WEBHOOK','CRM_PAYMENT_SIGNAL');

COMMIT;
