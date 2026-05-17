-- grant_ecom_admin.sql
-- Purpose: grant ECOM_ADMIN role (catalog access) to a specific identity in a tenant.
-- Edit tenant_code and login_email before running.

DO $$
DECLARE
  tenant_code text := 'eip_ecom';
  login_email text := 'mstefm55@gmail.com';
  role_code text := 'ECOM_ADMIN';
  v_tenant_id uuid;
  v_identity_id uuid;
  v_role_id uuid;
BEGIN
  SELECT id INTO v_tenant_id
  FROM eip_core.tenant
  WHERE code = tenant_code;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant % not found', tenant_code;
  END IF;

  SELECT id INTO v_identity_id
  FROM eip_auth.auth_identity
  WHERE tenant_id = v_tenant_id
    AND login = login_email;

  IF v_identity_id IS NULL THEN
    RAISE EXCEPTION 'Identity % not found for tenant %', login_email, tenant_code;
  END IF;

  SELECT id INTO v_role_id
  FROM eip_authz.role
  WHERE tenant_id = v_tenant_id
    AND code = role_code;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role % not found for tenant %', role_code, tenant_code;
  END IF;

  INSERT INTO eip_authz.identity_role
    (tenant_id, identity_id, role_id, granted_by_identity_id)
  VALUES
    (v_tenant_id, v_identity_id, v_role_id, v_identity_id)
  ON CONFLICT DO NOTHING;
END $$;
