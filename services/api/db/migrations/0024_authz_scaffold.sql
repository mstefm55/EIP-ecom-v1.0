BEGIN;

-- 1) New schema for authorization / UI bootstrap structures
CREATE SCHEMA IF NOT EXISTS eip_authz;

-- 2) UI Surfaces (the 4 entry “products”)
CREATE TABLE IF NOT EXISTS eip_authz.surface (
  code        text PRIMARY KEY,                -- ADMIN / ERP / PARTNER / ECOM
  label       text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 100,
  is_active   boolean NOT NULL DEFAULT true
);

-- 3) Roles (tenant-scoped)
CREATE TABLE IF NOT EXISTS eip_authz.role (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  code         text NOT NULL,                  -- e.g. ADMIN_SUPER
  label        text NOT NULL,
  surface_code text NOT NULL REFERENCES eip_authz.surface(code),
  is_system    boolean NOT NULL DEFAULT false,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT role_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES eip_core.tenant(id) ON DELETE CASCADE,

  CONSTRAINT role_unique_per_tenant
    UNIQUE (tenant_id, code)
);

-- keep same updated_at discipline you already use
DROP TRIGGER IF EXISTS trg_role_set_updated_at ON eip_authz.role;
CREATE TRIGGER trg_role_set_updated_at
BEFORE UPDATE ON eip_authz.role
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

-- 4) Permissions (global, stable strings)
CREATE TABLE IF NOT EXISTS eip_authz.permission (
  code        text PRIMARY KEY,                -- e.g. core.agent.read
  label       text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 5) Role ↔ Permission mapping
CREATE TABLE IF NOT EXISTS eip_authz.role_permission (
  role_id          uuid NOT NULL REFERENCES eip_authz.role(id) ON DELETE CASCADE,
  permission_code  text NOT NULL REFERENCES eip_authz.permission(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

-- 6) Identity ↔ Role assignment (composite FK to auth_identity)
CREATE TABLE IF NOT EXISTS eip_authz.identity_role (
  tenant_id   uuid NOT NULL,
  identity_id uuid NOT NULL,
  role_id     uuid NOT NULL REFERENCES eip_authz.role(id) ON DELETE CASCADE,

  granted_by_identity_id uuid,                 -- optional audit, same-tenant identity

  created_at  timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, identity_id, role_id),

  CONSTRAINT fk_identity_role_identity
    FOREIGN KEY (tenant_id, identity_id)
    REFERENCES eip_auth.auth_identity(tenant_id, id)
    ON DELETE CASCADE,

  CONSTRAINT fk_identity_role_granted_by
    FOREIGN KEY (tenant_id, granted_by_identity_id)
    REFERENCES eip_auth.auth_identity(tenant_id, id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS identity_role_tenant_identity_idx
  ON eip_authz.identity_role(tenant_id, identity_id);

CREATE INDEX IF NOT EXISTS identity_role_tenant_role_idx
  ON eip_authz.identity_role(tenant_id, role_id);

-- 7) Menu items (for dynamic React nav)
CREATE TABLE IF NOT EXISTS eip_authz.menu_item (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surface_code text NOT NULL REFERENCES eip_authz.surface(code),

  code         text NOT NULL,                  -- stable key, e.g. ERP_HOME
  label        text NOT NULL,
  route        text NOT NULL,                  -- e.g. /erp
  icon         text,                           -- e.g. lucide key "LayoutDashboard"

  parent_id    uuid REFERENCES eip_authz.menu_item(id) ON DELETE CASCADE,

  sort_order   int NOT NULL DEFAULT 100,
  is_active    boolean NOT NULL DEFAULT true,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT menu_item_unique
    UNIQUE (surface_code, code)
);

DROP TRIGGER IF EXISTS trg_menu_item_set_updated_at ON eip_authz.menu_item;
CREATE TRIGGER trg_menu_item_set_updated_at
BEFORE UPDATE ON eip_authz.menu_item
FOR EACH ROW EXECUTE FUNCTION eip_core.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS menu_item_surface_sort_idx
  ON eip_authz.menu_item(surface_code, sort_order);

-- 8) Role ↔ Menu visibility
CREATE TABLE IF NOT EXISTS eip_authz.role_menu (
  role_id      uuid NOT NULL REFERENCES eip_authz.role(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES eip_authz.menu_item(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, menu_item_id)
);

-- 9) Seed surfaces (idempotent)
INSERT INTO eip_authz.surface(code, label, sort_order) VALUES
  ('ADMIN','Admin',10),
  ('ERP','ERP',20),
  ('PARTNER','Partner Portal',30),
  ('ECOM','E-Commerce',40)
ON CONFLICT (code) DO NOTHING;

COMMIT;
