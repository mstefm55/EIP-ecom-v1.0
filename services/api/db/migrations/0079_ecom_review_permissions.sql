-- Active: 1769891749921@@127.0.0.1@5432@eip
-- 0079_ecom_review_permissions.sql
-- Purpose: product review moderation permissions + query indexes

BEGIN;

INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('ECOM_REVIEW_READ', 'Read ECOM reviews', 'View ecommerce product reviews'),
  ('ECOM_REVIEW_MODERATE', 'Moderate ECOM reviews', 'Approve/reject/hide ecommerce product reviews')
ON CONFLICT (code) DO NOTHING;

WITH roles AS (
  SELECT id, code
  FROM eip_authz.role
  WHERE code IN ('ADMIN_SUPER', 'ADMIN_EXEC', 'ECOM_ADMIN', 'ERP_USER')
),
rp(role_code, perm_code) AS (
  VALUES
    ('ADMIN_SUPER', 'ECOM_REVIEW_READ'),
    ('ADMIN_SUPER', 'ECOM_REVIEW_MODERATE'),
    ('ADMIN_EXEC', 'ECOM_REVIEW_READ'),
    ('ADMIN_EXEC', 'ECOM_REVIEW_MODERATE'),
    ('ECOM_ADMIN', 'ECOM_REVIEW_READ'),
    ('ECOM_ADMIN', 'ECOM_REVIEW_MODERATE'),
    ('ERP_USER', 'ECOM_REVIEW_READ')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, rp.perm_code
FROM roles r
JOIN rp ON rp.role_code = r.code
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS so_product_review_material_code_idx
  ON eip_core.service_object (tenant_id, (attrs->>'material_code'), created_at DESC)
  WHERE object_type = 'product_review';

CREATE INDEX IF NOT EXISTS so_product_review_material_id_idx
  ON eip_core.service_object (tenant_id, (attrs->>'material_id'), created_at DESC)
  WHERE object_type = 'product_review';

COMMIT;
