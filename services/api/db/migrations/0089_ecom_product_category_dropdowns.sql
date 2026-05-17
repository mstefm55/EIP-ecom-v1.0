-- 0089_ecom_product_category_dropdowns.sql
-- Purpose: govern product category/subcategory and category-scoped variant headers via dropdowns

BEGIN;

WITH tenants AS (
  SELECT id
  FROM eip_core.tenant
  WHERE is_active = true
)
INSERT INTO eip_core.dropdown_list
  (tenant_id, module, code, name, version, is_active, attrs)
SELECT
  t.id,
  'ecom',
  'ECOM_PRODUCT_CATEGORY',
  'Ecommerce Product Category',
  1,
  true,
  '{"scope":"product_taxonomy","delegated":true,"managed_by":"tenant"}'::jsonb
FROM tenants t
ON CONFLICT (tenant_id, module, code, version) DO UPDATE
SET name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    attrs = EXCLUDED.attrs,
    updated_at = now();

WITH lists AS (
  SELECT tenant_id, id
  FROM eip_core.dropdown_list
  WHERE module = 'ecom'
    AND code = 'ECOM_PRODUCT_CATEGORY'
    AND version = 1
    AND is_active = true
),
category_source AS (
  SELECT
    m.tenant_id,
    upper(
      regexp_replace(
        coalesce(
          nullif(trim(m.attrs->'taxonomy'->>'category_code'), ''),
          nullif(trim(m.attrs->'taxonomy'->>'category'), '')
        ),
        '[^A-Za-z0-9]+',
        '_',
        'g'
      )
    ) AS category_code,
    coalesce(
      nullif(trim(m.attrs->'taxonomy'->>'category_label'), ''),
      nullif(trim(m.attrs->'taxonomy'->>'category'), '')
    ) AS category_label
  FROM eip_core.material m
  WHERE m.material_type = 'PRODUCT'
),
category_base AS (
  SELECT
    tenant_id,
    category_code,
    coalesce(
      max(category_label) FILTER (WHERE category_label IS NOT NULL AND category_label <> ''),
      initcap(replace(lower(category_code), '_', ' '))
    ) AS category_label
  FROM category_source
  WHERE category_code IS NOT NULL
    AND category_code <> ''
  GROUP BY tenant_id, category_code
),
subcategory_source AS (
  SELECT
    m.tenant_id,
    upper(
      regexp_replace(
        coalesce(
          nullif(trim(m.attrs->'taxonomy'->>'category_code'), ''),
          nullif(trim(m.attrs->'taxonomy'->>'category'), '')
        ),
        '[^A-Za-z0-9]+',
        '_',
        'g'
      )
    ) AS category_code,
    upper(
      regexp_replace(
        coalesce(
          nullif(trim(m.attrs->'taxonomy'->>'subcategory_code'), ''),
          nullif(trim(m.attrs->'taxonomy'->>'subcategory'), '')
        ),
        '[^A-Za-z0-9]+',
        '_',
        'g'
      )
    ) AS subcategory_code,
    coalesce(
      nullif(trim(m.attrs->'taxonomy'->>'subcategory_label'), ''),
      nullif(trim(m.attrs->'taxonomy'->>'subcategory'), '')
    ) AS subcategory_label
  FROM eip_core.material m
  WHERE m.material_type = 'PRODUCT'
),
subcategory_base AS (
  SELECT
    tenant_id,
    category_code,
    subcategory_code,
    coalesce(
      max(subcategory_label) FILTER (WHERE subcategory_label IS NOT NULL AND subcategory_label <> ''),
      initcap(replace(lower(subcategory_code), '_', ' '))
    ) AS subcategory_label
  FROM subcategory_source
  WHERE category_code IS NOT NULL
    AND category_code <> ''
    AND subcategory_code IS NOT NULL
    AND subcategory_code <> ''
  GROUP BY tenant_id, category_code, subcategory_code
),
subcategory_ranked AS (
  SELECT
    tenant_id,
    category_code,
    subcategory_code,
    subcategory_label,
    row_number() OVER (
      PARTITION BY tenant_id, category_code
      ORDER BY subcategory_code
    ) AS rn
  FROM subcategory_base
),
subcategory_json AS (
  SELECT
    tenant_id,
    category_code,
    jsonb_agg(
      jsonb_build_object(
        'code', subcategory_code,
        'label', subcategory_label,
        'sort_order', rn * 10,
        'is_active', true
      )
      ORDER BY rn
    ) AS subcategories
  FROM subcategory_ranked
  GROUP BY tenant_id, category_code
),
variant_header_source AS (
  SELECT
    m.tenant_id,
    upper(
      regexp_replace(
        coalesce(
          nullif(trim(m.attrs->'taxonomy'->>'category_code'), ''),
          nullif(trim(m.attrs->'taxonomy'->>'category'), '')
        ),
        '[^A-Za-z0-9]+',
        '_',
        'g'
      )
    ) AS category_code,
    lower(
      regexp_replace(
        coalesce(
          nullif(trim(vh.value->>'key'), ''),
          nullif(trim(vh.value->>'code'), ''),
          nullif(trim(vh.value->>'label'), '')
        ),
        '[^A-Za-z0-9]+',
        '_',
        'g'
      )
    ) AS header_code,
    coalesce(
      nullif(trim(vh.value->>'label'), ''),
      initcap(
        replace(
          lower(
            coalesce(
              nullif(trim(vh.value->>'key'), ''),
              nullif(trim(vh.value->>'code'), ''),
              nullif(trim(vh.value->>'label'), '')
            )
          ),
          '_',
          ' '
        )
      )
    ) AS header_label
  FROM eip_core.material m
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(m.attrs->'variants'->'headers') = 'array'
      THEN m.attrs->'variants'->'headers'
      ELSE '[]'::jsonb
    END
  ) AS vh(value)
  WHERE m.material_type = 'PRODUCT'
),
variant_header_base AS (
  SELECT
    tenant_id,
    category_code,
    header_code,
    coalesce(
      max(header_label) FILTER (WHERE header_label IS NOT NULL AND header_label <> ''),
      initcap(replace(lower(header_code), '_', ' '))
    ) AS header_label
  FROM variant_header_source
  WHERE category_code IS NOT NULL
    AND category_code <> ''
    AND header_code IS NOT NULL
    AND header_code <> ''
  GROUP BY tenant_id, category_code, header_code
),
variant_header_ranked AS (
  SELECT
    tenant_id,
    category_code,
    header_code,
    header_label,
    row_number() OVER (
      PARTITION BY tenant_id, category_code
      ORDER BY header_code
    ) AS rn
  FROM variant_header_base
),
variant_header_json AS (
  SELECT
    tenant_id,
    category_code,
    jsonb_agg(
      jsonb_build_object(
        'code', header_code,
        'label', header_label,
        'sort_order', rn * 10,
        'is_active', true
      )
      ORDER BY rn
    ) AS variant_headers
  FROM variant_header_ranked
  GROUP BY tenant_id, category_code
)
INSERT INTO eip_core.dropdown_value
  (list_id, code, label, sort_order, is_active, attrs)
SELECT
  l.id,
  c.category_code,
  c.category_label,
  row_number() OVER (
    PARTITION BY c.tenant_id
    ORDER BY c.category_code
  ) * 10 AS sort_order,
  true,
  jsonb_build_object(
    'subcategories', coalesce(s.subcategories, '[]'::jsonb),
    'variant_headers', coalesce(v.variant_headers, '[]'::jsonb)
  ) AS attrs
FROM category_base c
JOIN lists l ON l.tenant_id = c.tenant_id
LEFT JOIN subcategory_json s
  ON s.tenant_id = c.tenant_id
 AND s.category_code = c.category_code
LEFT JOIN variant_header_json v
  ON v.tenant_id = c.tenant_id
 AND v.category_code = c.category_code
ON CONFLICT (list_id, code) DO NOTHING;

COMMIT;
