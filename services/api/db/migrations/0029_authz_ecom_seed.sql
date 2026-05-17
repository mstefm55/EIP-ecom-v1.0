BEGIN;

-- ============================================================
-- 0029_authz_ecom_seed.sql
-- Seed ECOM permissions + menu items + wiring for tenant eip_demo
-- Tenant: resolved by code eip_demo
-- Role used: ECOM_USER (already exists)
-- Menu used: ECOM_HOME (already exists)
-- ============================================================

DO $$
DECLARE
  v_tenant  uuid;
  v_role_id uuid;
  v_id_test uuid;
  v_menu_id uuid;
BEGIN
  SELECT id INTO v_tenant
  FROM eip_core.tenant
  WHERE code = 'eip_demo';

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Tenant not found: code=%', 'eip_demo';
  END IF;

  -- 1) Resolve ECOM role (must exist already)
  SELECT id INTO v_role_id
  FROM eip_authz.role
  WHERE tenant_id = v_tenant
    AND code = 'ECOM_USER';

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'ECOM_USER role not found for tenant %', v_tenant;
  END IF;

  -- 2) Seed ECOM permissions (global)
  INSERT INTO eip_authz.permission (code, label, description)
  VALUES
    ('ecom.home.read',        'ECOM: View home',            'Allows viewing ECOM home surface'),
    ('ecom.catalog.read',     'ECOM: View catalog',         'Allows browsing catalog/listings'),
    ('ecom.product.read',     'ECOM: View product',         'Allows viewing product details'),
    ('ecom.account.read',     'ECOM: View account',         'Allows viewing account/profile'),
    ('ecom.order.read',       'ECOM: View orders',          'Allows viewing own orders'),
    ('ecom.checkout.start',   'ECOM: Start checkout',       'Allows starting checkout flow'),
    ('ecom.entitlement.read', 'ECOM: View entitlements',    'Allows viewing download entitlements'),
    ('content.read',          'Content: Read',              'Allows reading content metadata'),
    ('content.download',      'Content: Download',          'Allows downloading content (guarded by app rules)')
  ON CONFLICT (code) DO NOTHING;

  -- IMPORTANT: allow ECOM users to call bootstrap
  INSERT INTO eip_authz.permission (code, label, description)
  VALUES ('authz.bootstrap.read', 'AuthZ: Bootstrap', 'Allows reading bootstrap payload')
  ON CONFLICT (code) DO NOTHING;

  -- 3) Map role -> permissions
  INSERT INTO eip_authz.role_permission (role_id, permission_code)
  VALUES
    (v_role_id, 'authz.bootstrap.read'),
    (v_role_id, 'ecom.home.read'),
    (v_role_id, 'ecom.catalog.read'),
    (v_role_id, 'ecom.product.read'),
    (v_role_id, 'ecom.account.read'),
    (v_role_id, 'ecom.order.read'),
    (v_role_id, 'ecom.checkout.start'),
    (v_role_id, 'ecom.entitlement.read'),
    (v_role_id, 'content.read'),
    (v_role_id, 'content.download')
  ON CONFLICT (role_id, permission_code) DO NOTHING;

  -- 4) Ensure ECOM menu items exist (keep minimal but real)
  -- ECOM_HOME already exists; add a few more.
  INSERT INTO eip_authz.menu_item (surface_code, code, label, route, icon, parent_id, sort_order, is_active)
  VALUES
    ('ECOM', 'ECOM_ACCOUNT', 'My Account', '/account', 'User', NULL, 20, true),
    ('ECOM', 'ECOM_ORDERS',  'My Orders',  '/orders',  'Receipt', NULL, 30, true)
  ON CONFLICT (surface_code, code) DO NOTHING;

  -- 5) Map role -> menu items (include ECOM_HOME + new ones)
  -- ECOM_HOME
  SELECT id INTO v_menu_id
  FROM eip_authz.menu_item
  WHERE surface_code='ECOM' AND code='ECOM_HOME';
  IF v_menu_id IS NOT NULL THEN
    INSERT INTO eip_authz.role_menu (role_id, menu_item_id)
    VALUES (v_role_id, v_menu_id)
    ON CONFLICT (role_id, menu_item_id) DO NOTHING;
  END IF;

  -- ECOM_ACCOUNT
  SELECT id INTO v_menu_id
  FROM eip_authz.menu_item
  WHERE surface_code='ECOM' AND code='ECOM_ACCOUNT';
  IF v_menu_id IS NOT NULL THEN
    INSERT INTO eip_authz.role_menu (role_id, menu_item_id)
    VALUES (v_role_id, v_menu_id)
    ON CONFLICT (role_id, menu_item_id) DO NOTHING;
  END IF;

  -- ECOM_ORDERS
  SELECT id INTO v_menu_id
  FROM eip_authz.menu_item
  WHERE surface_code='ECOM' AND code='ECOM_ORDERS';
  IF v_menu_id IS NOT NULL THEN
    INSERT INTO eip_authz.role_menu (role_id, menu_item_id)
    VALUES (v_role_id, v_menu_id)
    ON CONFLICT (role_id, menu_item_id) DO NOTHING;
  END IF;

  -- 6) (DEV convenience) grant ECOM_USER to the test identity
  -- This lets you bootstrap Samara behavior immediately using the same login.
  SELECT id INTO v_id_test
  FROM eip_auth.auth_identity
  WHERE tenant_id = v_tenant
    AND lower(login) = 'test@example.com'
  LIMIT 1;

  IF v_id_test IS NOT NULL THEN
    INSERT INTO eip_authz.identity_role (tenant_id, identity_id, role_id, granted_by_identity_id)
    VALUES (v_tenant, v_id_test, v_role_id, NULL)
    ON CONFLICT (tenant_id, identity_id, role_id) DO NOTHING;
  END IF;

END $$;

COMMIT;
