-- 0145_perfect_fit_governed_garment_taxonomy.sql
-- Purpose:
--   Make PF_GARMENT_CATEGORY the canonical style/product category vocabulary
--   shared by Perfect Fit Workspace and the Pattern Library category filter.
--
-- 0144 has already been executed and is intentionally not modified.
-- This migration preserves existing stable codes and enriches their labels/attrs.
-- Catalogue-only facets (Pattern of the Day, Free Patterns, Curve & Plus Sizes,
-- Best Sellers) are deliberately NOT product.category values.

BEGIN;

WITH pf_tenants AS (
  SELECT DISTINCT t.id
  FROM eip_core.tenant t
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(t.attrs->'connection_profiles') = 'array'
      THEN t.attrs->'connection_profiles'
      ELSE '[]'::jsonb
    END
  ) AS profile
  WHERE t.is_active = true
    AND (
      lower(COALESCE(profile->'public_storefront'->>'perfect_fit_enabled', 'false')) = 'true'
      OR COALESCE(profile->'public_storefront'->'scopes', '[]'::jsonb) ? 'perfect_fit.products.read'
    )
), category_seed(
  code,
  label,
  sort_order,
  catalog_category_id,
  catalog_audience,
  catalog_sort_order
) AS (
  VALUES
    -- Women: true style/product categories only.
    -- Existing 0144 stable codes remain unchanged. New codes are chosen so their
    -- normalized form also matches the existing catalogue category id.
    ('DRESS',                 'Dresses',                 10,  'dresses',                 'women', 10),
    ('TOP',                   'Tops',                    20,  'tops',                    'women', 20),
    ('CORSETS',               'Corsets',                 30,  'corsets',                 'women', 30),
    ('TROUSER',               'Pants & Shorts',          40,  'pants-shorts',            'women', 40),
    ('SKIRT',                 'Skirts',                  50,  'skirts',                  'women', 50),
    ('JUMPSUITS',             'Jumpsuits',               60,  'jumpsuits',               'women', 60),
    ('JACKETS_VESTS',         'Jackets & Vests',         70,  'jackets-vests',           'women', 70),
    ('COAT',                  'Coats & Capes',           80,  'coats-capes',             'women', 80),
    ('EVENING_PARTY',         'Evening & Party Looks',   90,  'evening-party',           'women', 90),
    ('ACCESSORIES',           'Accessories',             100, 'accessories',             'women', 100),
    ('LINGERIE',              'Lingerie',                110, 'lingerie',                'women', 150),

    -- Men.
    ('SWIMWEAR_ACTIVEWEAR',   'Swimwear & Activewear',   200, 'swimwear-activewear',     'men',   10),
    ('HOMEWEAR_SLEEPWEAR',    'Homewear & Sleepwear',    210, 'homewear-sleepwear',      'men',   20),

    -- Kids.
    ('INFANTS_TODDLERS',      'Infants & Toddlers',      300, 'infants-toddlers',        'kids',  10),
    ('CHILDREN',              'Children',                310, 'children',                'kids',  20),
    ('GIRLS',                 'Girls',                   320, 'girls',                   'kids',  30),
    ('BOYS',                  'Boys',                    330, 'boys',                    'kids',  40)
), pf_lists AS (
  SELECT dl.id
  FROM eip_core.dropdown_list dl
  JOIN pf_tenants t ON t.id = dl.tenant_id
  WHERE dl.module = 'perfect_fit'
    AND dl.code = 'PF_GARMENT_CATEGORY'
    AND dl.version = 1
    AND dl.is_active = true
)
INSERT INTO eip_core.dropdown_value
  (list_id, code, label, sort_order, is_active, attrs)
SELECT
  l.id,
  c.code,
  c.label,
  c.sort_order,
  true,
  jsonb_build_object(
    'application', 'perfect_fit',
    'authority', 'EIP_DB',
    'taxonomy_role', 'STYLE_CATEGORY',
    'workspace_style_selectable', true,
    'catalog_filter_visible', true,
    'catalog_category_id', c.catalog_category_id,
    'catalog_audience', c.catalog_audience,
    'catalog_sort_order', c.catalog_sort_order,
    'seed_migration', '0145'
  )
FROM pf_lists l
CROSS JOIN category_seed c
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    attrs = COALESCE(eip_core.dropdown_value.attrs, '{}'::jsonb) || EXCLUDED.attrs,
    updated_at = now();

-- Record the stronger taxonomy contract on the existing governed list itself.
WITH pf_tenants AS (
  SELECT DISTINCT t.id
  FROM eip_core.tenant t
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(t.attrs->'connection_profiles') = 'array'
      THEN t.attrs->'connection_profiles'
      ELSE '[]'::jsonb
    END
  ) AS profile
  WHERE t.is_active = true
    AND (
      lower(COALESCE(profile->'public_storefront'->>'perfect_fit_enabled', 'false')) = 'true'
      OR COALESCE(profile->'public_storefront'->'scopes', '[]'::jsonb) ? 'perfect_fit.products.read'
    )
)
UPDATE eip_core.dropdown_list dl
SET attrs = COALESCE(dl.attrs, '{}'::jsonb) || jsonb_build_object(
      'authority', 'EIP_DB',
      'taxonomy_role', 'STYLE_CATEGORY',
      'shared_consumers', jsonb_build_array('perfect_fit_workspace', 'pattern_library'),
      'seed_migration', '0145'
    ),
    updated_at = now()
FROM pf_tenants t
WHERE dl.tenant_id = t.id
  AND dl.module = 'perfect_fit'
  AND dl.code = 'PF_GARMENT_CATEGORY'
  AND dl.version = 1
  AND dl.is_active = true;

COMMIT;
