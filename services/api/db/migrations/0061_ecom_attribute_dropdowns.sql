-- 0061_ecom_attribute_dropdowns.sql
-- Purpose: seed base ecommerce product attributes (benchmark: Shopify-style fields)

BEGIN;

WITH ins_list AS (
  INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
  VALUES (
    NULL,
    'ecom',
    'PRODUCT_ATTRIBUTE',
    'Product Attribute',
    1,
    true,
    '{"source":"benchmark:shopify","domain":"commerce"}'::jsonb
  )
  ON CONFLICT (tenant_id, module, code, version) DO UPDATE
    SET is_active = EXCLUDED.is_active
  RETURNING id
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT id, v.code, v.label, v.sort_order, true, v.attrs
FROM ins_list,
LATERAL (
  VALUES
    ('TITLE',                'Title',                10,  '{"group":"core","data_type":"text"}'::jsonb),
    ('DESCRIPTION',          'Description',          20,  '{"group":"core","data_type":"text"}'::jsonb),
    ('SKU',                  'SKU',                  30,  '{"group":"core","data_type":"text"}'::jsonb),
    ('BARCODE',              'Barcode',              40,  '{"group":"core","data_type":"text"}'::jsonb),
    ('BRAND',                'Brand',                50,  '{"group":"core","data_type":"text"}'::jsonb),
    ('VENDOR',               'Vendor',               60,  '{"group":"core","data_type":"text"}'::jsonb),
    ('PRODUCT_TYPE',         'Product type',         70,  '{"group":"core","data_type":"text"}'::jsonb),
    ('CATEGORY',             'Category',             80,  '{"group":"core","data_type":"text"}'::jsonb),
    ('TAGS',                 'Tags',                 90,  '{"group":"core","data_type":"array"}'::jsonb),
    ('STATUS',               'Status',               100, '{"group":"core","data_type":"enum"}'::jsonb),
    ('VISIBILITY',           'Visibility',           110, '{"group":"core","data_type":"enum"}'::jsonb),
    ('PRICE',                'Price',                120, '{"group":"pricing","data_type":"money"}'::jsonb),
    ('COMPARE_AT_PRICE',     'Compare at price',     130, '{"group":"pricing","data_type":"money"}'::jsonb),
    ('COST',                 'Cost',                 140, '{"group":"pricing","data_type":"money"}'::jsonb),
    ('TAXABLE',              'Taxable',              150, '{"group":"pricing","data_type":"boolean"}'::jsonb),
    ('TAX_CODE',             'Tax code',             160, '{"group":"pricing","data_type":"text"}'::jsonb),
    ('CURRENCY',             'Currency',             170, '{"group":"pricing","data_type":"text"}'::jsonb),
    ('INVENTORY_TRACKED',    'Inventory tracked',    180, '{"group":"inventory","data_type":"boolean"}'::jsonb),
    ('STOCK_QTY',            'Stock quantity',       190, '{"group":"inventory","data_type":"number"}'::jsonb),
    ('INVENTORY_POLICY',     'Inventory policy',     200, '{"group":"inventory","data_type":"enum"}'::jsonb),
    ('WEIGHT',               'Weight',               210, '{"group":"shipping","data_type":"number"}'::jsonb),
    ('WEIGHT_UNIT',          'Weight unit',          220, '{"group":"shipping","data_type":"text"}'::jsonb),
    ('DIMENSIONS',           'Dimensions',           230, '{"group":"shipping","data_type":"text"}'::jsonb),
    ('ORIGIN_COUNTRY',       'Country of origin',    240, '{"group":"shipping","data_type":"text"}'::jsonb),
    ('HS_CODE',              'HS code',              250, '{"group":"shipping","data_type":"text"}'::jsonb),
    ('SHIPPING_REQUIRED',    'Shipping required',    260, '{"group":"shipping","data_type":"boolean"}'::jsonb),
    ('IMAGE_URL',            'Image URL',            270, '{"group":"media","data_type":"url"}'::jsonb),
    ('IMAGE_GALLERY',        'Image gallery',        280, '{"group":"media","data_type":"array"}'::jsonb),
    ('FILE_URL',             'File URL',             290, '{"group":"media","data_type":"url"}'::jsonb),
    ('DOWNLOADABLE',         'Downloadable',         300, '{"group":"digital","data_type":"boolean"}'::jsonb),
    ('VARIANT_OPTION',       'Variant option',       310, '{"group":"variant","data_type":"text"}'::jsonb),
    ('VARIANT_VALUE',        'Variant value',        320, '{"group":"variant","data_type":"text"}'::jsonb),
    ('SEO_TITLE',            'SEO title',            330, '{"group":"marketing","data_type":"text"}'::jsonb),
    ('SEO_DESCRIPTION',      'SEO description',      340, '{"group":"marketing","data_type":"text"}'::jsonb),
    ('SUBSCRIPTION_INTERVAL','Subscription interval',350, '{"group":"digital","data_type":"text"}'::jsonb),
    ('LICENSE_KEY',          'License key',          360, '{"group":"digital","data_type":"text"}'::jsonb)
) AS v(code,label,sort_order,attrs)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    attrs = EXCLUDED.attrs;

COMMIT;
