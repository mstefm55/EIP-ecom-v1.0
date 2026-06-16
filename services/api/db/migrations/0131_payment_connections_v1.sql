-- 0131_payment_connections_v1.sql
-- Purpose: register Payment Connections V1 provider/method metadata using
-- existing Admin Console Connections and Dashboard Settings storage.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.seed_payment_dropdown(
  list_code text,
  list_name text,
  values_json jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  list_row record;
  item jsonb;
BEGIN
  FOR list_row IN
    SELECT id AS tenant_id
    FROM eip_core.tenant
    WHERE is_active = true
  LOOP
    INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
    VALUES (
      list_row.tenant_id,
      'ecom',
      list_code,
      list_name,
      1,
      true,
      '{"ui":{"module":"ecom","scope":"payment_connections_v1"}}'::jsonb
    )
    ON CONFLICT (tenant_id, module, code, version)
    DO UPDATE SET
      name = EXCLUDED.name,
      is_active = true,
      attrs = COALESCE(eip_core.dropdown_list.attrs,'{}'::jsonb) || EXCLUDED.attrs,
      updated_at = now();

    FOR item IN SELECT * FROM jsonb_array_elements(values_json)
    LOOP
      INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
      SELECT
        dl.id,
        item->>'code',
        item->>'label',
        COALESCE((item->>'sort_order')::int, 0),
        true,
        COALESCE(item->'attrs', '{}'::jsonb)
      FROM eip_core.dropdown_list dl
      WHERE dl.tenant_id = list_row.tenant_id
        AND dl.module = 'ecom'
        AND dl.code = list_code
        AND dl.version = 1
      ON CONFLICT (list_id, code)
      DO UPDATE SET
        label = EXCLUDED.label,
        sort_order = EXCLUDED.sort_order,
        is_active = true,
        attrs = EXCLUDED.attrs,
        updated_at = now();
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.ensure_jsonb_code_item(source jsonb, item jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  out jsonb := COALESCE(source, '[]'::jsonb);
BEGIN
  IF jsonb_typeof(out) <> 'array' THEN
    out := '[]'::jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(out) entry
    WHERE entry->>'code' = item->>'code'
  ) THEN
    out := out || jsonb_build_array(item);
  END IF;
  RETURN out;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.ensure_jsonb_text_item(source jsonb, value text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  out jsonb := COALESCE(source, '[]'::jsonb);
BEGIN
  IF jsonb_typeof(out) <> 'array' THEN
    out := '[]'::jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(out) entry
    WHERE entry = value
  ) THEN
    out := out || to_jsonb(value);
  END IF;
  RETURN out;
END;
$$;

SELECT pg_temp.seed_payment_dropdown('ECOM_PAYMENT_METHOD', 'ECOM Payment Method', '[
  {"code":"card","label":"Card","sort_order":10,"attrs":{"provider":"checkout_com","provider_code":"CHECKOUT_COM"}},
  {"code":"paypal","label":"PayPal","sort_order":20,"attrs":{"provider":"paypal","provider_code":"PAYPAL"}},
  {"code":"google_pay","label":"Google Pay","sort_order":30,"attrs":{"provider":"checkout_com","provider_code":"CHECKOUT_COM","wallet":true}},
  {"code":"apple_pay","label":"Apple Pay","sort_order":40,"attrs":{"provider":"checkout_com","provider_code":"CHECKOUT_COM","wallet":true}},
  {"code":"manual_test","label":"Sandbox manual test","sort_order":90,"attrs":{"provider":"manual_test","sandbox_only":true}}
]'::jsonb);

SELECT pg_temp.seed_payment_dropdown('ECOM_PAYMENT_PROVIDER', 'ECOM Payment Provider', '[
  {"code":"checkout_com","label":"Checkout.com","sort_order":10,"attrs":{"connection_kind":"checkout_com","public_code":"CHECKOUT_COM","methods":["CARD","GOOGLE_PAY","APPLE_PAY"],"sandbox_live_supported":true,"webhook_supported":true}},
  {"code":"paypal","label":"PayPal","sort_order":20,"attrs":{"connection_kind":"paypal","public_code":"PAYPAL","methods":["PAYPAL"],"sandbox_live_supported":true,"webhook_supported":true}},
  {"code":"manual_test","label":"Sandbox manual test","sort_order":90,"attrs":{"sandbox_only":true}}
]'::jsonb);

SELECT pg_temp.seed_payment_dropdown('EIP_CONNECTION_KIND', 'EIP Connection Kind', '[
  {"code":"paypal","label":"PayPal","sort_order":410,"attrs":{"channel":"payments","provider_code":"PAYPAL","secret_policy":"reference_only","methods":["PAYPAL"]}},
  {"code":"checkout_com","label":"Checkout.com","sort_order":420,"attrs":{"channel":"payments","provider_code":"CHECKOUT_COM","secret_policy":"reference_only","methods":["CARD","GOOGLE_PAY","APPLE_PAY"]}}
]'::jsonb);

WITH patch AS (
  SELECT
    '{"code":"apple_pay","label":"Apple Pay","enabled":false}'::jsonb AS apple_method,
    '{"provider_code":"checkout_com","environment":"production","connection_code":null}'::jsonb AS apple_provider
)
UPDATE eip_core.tenant_module_setting setting
SET attrs = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(setting.attrs,'{}'::jsonb),
      '{payment,methods}',
      pg_temp.ensure_jsonb_code_item(COALESCE(setting.attrs#>'{payment,methods}', '[]'::jsonb), patch.apple_method),
      true
    ),
    '{payment,display_order}',
    pg_temp.ensure_jsonb_text_item(COALESCE(setting.attrs#>'{payment,display_order}', '[]'::jsonb), 'apple_pay'),
    true
  ),
  '{payment,providers}',
  COALESCE(setting.attrs#>'{payment,providers}', '{}'::jsonb) || jsonb_build_object('apple_pay', patch.apple_provider),
  true
),
updated_at = now()
FROM patch
WHERE setting.module = 'ecom'
  AND setting.code = 'commerce'
  AND setting.is_active = true;

COMMIT;
