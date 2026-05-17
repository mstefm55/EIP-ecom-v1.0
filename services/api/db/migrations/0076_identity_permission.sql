-- 0076_identity_permission.sql
-- Purpose: direct permission grants to identities

BEGIN;

CREATE TABLE IF NOT EXISTS eip_authz.identity_permission (
  tenant_id      uuid NOT NULL,
  identity_id    uuid NOT NULL,
  permission_code text NOT NULL REFERENCES eip_authz.permission(code) ON DELETE CASCADE,

  granted_by_identity_id uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, identity_id, permission_code),

  CONSTRAINT fk_identity_permission_identity
    FOREIGN KEY (tenant_id, identity_id)
    REFERENCES eip_auth.auth_identity(tenant_id, id)
    ON DELETE CASCADE,

  CONSTRAINT fk_identity_permission_granted_by
    FOREIGN KEY (tenant_id, granted_by_identity_id)
    REFERENCES eip_auth.auth_identity(tenant_id, id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS identity_permission_tenant_identity_idx
  ON eip_authz.identity_permission(tenant_id, identity_id);

CREATE INDEX IF NOT EXISTS identity_permission_tenant_permission_idx
  ON eip_authz.identity_permission(tenant_id, permission_code);

COMMIT;
