BEGIN;

-- =========================================================
-- 1) Role → Menu wiring (minimal: each role sees its own HOME)
-- =========================================================

WITH
r AS (
  SELECT id, tenant_id, code, surface_code
  FROM eip_authz.role
  WHERE tenant_id = '18e6209d-155a-4932-9b7b-e11ad09aaf49'::uuid
    AND code IN ('ADMIN_SUPER','ERP_USER','PARTNER_USER','ECOM_USER')
),
m AS (
  SELECT id, surface_code, code
  FROM eip_authz.menu_item
  WHERE (surface_code, code) IN (
    ('ADMIN','ADMIN_HOME'),
    ('ERP','ERP_HOME'),
    ('PARTNER','PARTNER_HOME'),
    ('ECOM','ECOM_HOME')
  )
),
pairs AS (
  SELECT
    r.id  AS role_id,
    m.id  AS menu_item_id
  FROM r
  JOIN m ON m.surface_code = r.surface_code
)
INSERT INTO eip_authz.role_menu(role_id, menu_item_id)
SELECT role_id, menu_item_id
FROM pairs
ON CONFLICT DO NOTHING;

-- =========================================================
-- 2) Optional: grant ADMIN_SUPER to all identities that pass your temporary admin gate
--    (primary + active mapping in auth_identity_agent)
--
--    This avoids asking for identity UUIDs and stays deterministic.
--    If you prefer manual assignment later, remove this whole block.
-- =========================================================

WITH admin_role AS (
  SELECT id
  FROM eip_authz.role
  WHERE tenant_id = '18e6209d-155a-4932-9b7b-e11ad09aaf49'::uuid
    AND code = 'ADMIN_SUPER'
  LIMIT 1
),
eligible_identities AS (
  SELECT ia.tenant_id, ia.identity_id
  FROM eip_auth.auth_identity_agent ia
  WHERE ia.tenant_id = '18e6209d-155a-4932-9b7b-e11ad09aaf49'::uuid
    AND ia.is_primary = true
    AND ia.is_active = true
),
to_grant AS (
  SELECT e.tenant_id, e.identity_id, ar.id AS role_id
  FROM eligible_identities e
  CROSS JOIN admin_role ar
)
INSERT INTO eip_authz.identity_role(tenant_id, identity_id, role_id, granted_by_identity_id)
SELECT tenant_id, identity_id, role_id, NULL
FROM to_grant
ON CONFLICT DO NOTHING;

COMMIT;
