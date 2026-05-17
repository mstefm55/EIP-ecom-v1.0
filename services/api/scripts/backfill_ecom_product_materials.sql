-- backfill_ecom_product_materials.sql
-- Purpose: ensure ECOM product service_objects are represented as core materials.
-- Idempotent: safe to run multiple times.

BEGIN;

-- 1) Update existing materials that match product codes.
WITH products AS (
  SELECT
    so.id AS product_id,
    so.tenant_id,
    so.code,
    so.title,
    so.status,
    COALESCE(so.attrs, '{}'::jsonb) AS attrs,
    COALESCE(so.attrs->>'material_type', so.attrs->'material'->>'type', 'PRODUCT') AS material_type
  FROM eip_core.service_object so
  WHERE so.object_type = 'product'
)
UPDATE eip_core.material m
SET name = COALESCE(p.title, m.name),
    material_type = COALESCE(p.material_type, m.material_type),
    attrs = COALESCE(m.attrs, '{}'::jsonb) || jsonb_build_object(
      'source', 'ecom_backfill',
      'product_service_object_id', p.product_id::text,
      'product_code', p.code,
      'product_status', p.status,
      'product_attrs', p.attrs
    ),
    updated_at = now()
FROM products p
WHERE m.tenant_id = p.tenant_id
  AND p.code IS NOT NULL
  AND m.code = p.code;

-- 2) Insert missing materials for products without a link or code match.
WITH products AS (
  SELECT
    so.id AS product_id,
    so.tenant_id,
    so.code,
    so.title,
    so.status,
    COALESCE(so.attrs, '{}'::jsonb) AS attrs,
    COALESCE(so.attrs->>'material_type', so.attrs->'material'->>'type', 'PRODUCT') AS material_type
  FROM eip_core.service_object so
  WHERE so.object_type = 'product'
),
linked AS (
  SELECT p.*, ol.dst_id AS linked_material_id
  FROM products p
  LEFT JOIN eip_core.object_link ol
    ON ol.tenant_id = p.tenant_id
   AND ol.src_kind = 'service_object'
   AND ol.src_id = p.product_id
   AND ol.dst_kind = 'material'
   AND ol.relation_type = 'REFERS_TO'
   AND ol.is_active = true
),
missing AS (
  SELECT l.*
  FROM linked l
  LEFT JOIN eip_core.material m
    ON m.tenant_id = l.tenant_id
   AND l.code IS NOT NULL
   AND m.code = l.code
  WHERE l.linked_material_id IS NULL
    AND m.id IS NULL
)
INSERT INTO eip_core.material (tenant_id, material_type, code, name, attrs)
SELECT
  tenant_id,
  material_type,
  code,
  title,
  jsonb_build_object(
    'source', 'ecom_backfill',
    'product_service_object_id', product_id::text,
    'product_code', code,
    'product_status', status,
    'product_attrs', attrs
  )
FROM missing;

-- 3) Link products to materials (by existing link, code match, or attrs).
WITH products AS (
  SELECT
    so.id AS product_id,
    so.tenant_id,
    so.code,
    COALESCE(so.attrs, '{}'::jsonb) AS attrs
  FROM eip_core.service_object so
  WHERE so.object_type = 'product'
),
resolved AS (
  SELECT
    p.product_id,
    p.tenant_id,
    COALESCE(ol.dst_id, m.id) AS material_id
  FROM products p
  LEFT JOIN eip_core.object_link ol
    ON ol.tenant_id = p.tenant_id
   AND ol.src_kind = 'service_object'
   AND ol.src_id = p.product_id
   AND ol.dst_kind = 'material'
   AND ol.relation_type = 'REFERS_TO'
   AND ol.is_active = true
  LEFT JOIN eip_core.material m
    ON m.tenant_id = p.tenant_id
   AND (
     (p.code IS NOT NULL AND m.code = p.code)
     OR (m.attrs->>'product_service_object_id' = p.product_id::text)
   )
)
INSERT INTO eip_core.object_link
  (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs)
SELECT
  r.tenant_id,
  'service_object',
  r.product_id,
  'material',
  r.material_id,
  'REFERS_TO',
  jsonb_build_object('source', 'ecom_backfill')
FROM resolved r
WHERE r.material_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
