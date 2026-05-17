-- =====================================================================
-- 0010_smart_socket_ss2.sql
-- SmartSocket (SS2): API + manifest-driven UI metadata (tenant plug & play)
--
-- Goal:
-- - Store a versioned, publishable SmartSocket manifest (JSONB)
-- - Store tenant vocabulary alias/mapping (optional but recommended)
-- - Keep kernel-first: minimal tables, JSONB for config payload, relational for keys/versioning
-- - No business-state duplication here (orders/customers/etc. stay canonical in core)
--
-- Assumptions:
-- - Schema eip_commerce exists (adjust if you use a different schema for the Channel Hub)
-- - pgcrypto is available for gen_random_uuid()
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0) Ensure schema exists (no-op if already present)
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS eip_commerce;

-- ---------------------------------------------------------------------
-- 1) SmartSocket manifest (SS2)
--    - One manifest per tenant, code, version
--    - Publish/unpublish supported
--    - JSONB holds the "plug-and-play UI contract":
--        * feature flags
--        * checkout form schemas
--        * validation rules
--        * payment methods available
--        * required steps and policies
--        * mapping pointers (aliases)
--        * event types it can emit/consume
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eip_commerce.socket_manifest (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,

  -- "code" lets you ship multiple sockets if you ever need
  -- e.g. 'WEB', 'POS', 'PORTAL'. Start with 'WEB'.
  code         text NOT NULL DEFAULT 'WEB',

  version      integer NOT NULL DEFAULT 1,

  -- draft/published lifecycle
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,

  -- the SS2 manifest payload
  manifest     jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- optional metadata
  attrs        jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness: tenant + code + version
CREATE UNIQUE INDEX IF NOT EXISTS ux_socket_manifest_tenant_code_version
  ON eip_commerce.socket_manifest (tenant_id, code, version);

-- Only one published per tenant+code (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS ux_socket_manifest_one_published
  ON eip_commerce.socket_manifest (tenant_id, code)
  WHERE is_published = true;

-- Useful query indexes
CREATE INDEX IF NOT EXISTS ix_socket_manifest_tenant
  ON eip_commerce.socket_manifest (tenant_id);

CREATE INDEX IF NOT EXISTS ix_socket_manifest_tenant_code_published
  ON eip_commerce.socket_manifest (tenant_id, code, is_published);

-- ---------------------------------------------------------------------
-- 2) SmartSocket alias mapping (tenant vocabulary ↔ canonical vocabulary)
--
-- Why relational here:
-- - prevents JSONB duplication + allows targeted lookups/indexing
-- - supports your "use relational for relationships" rule
--
-- Examples:
-- - alias_object_type: 'pattern' -> canonical_object_type: 'material'
-- - alias_field_path: 'pattern.sku' -> canonical_field_path: 'material.attrs.sku'
--
-- You can keep it minimal now; expand later if needed.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eip_commerce.socket_alias_map (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL,

  -- Scope of mapping: object / field / event
  map_kind              text NOT NULL CHECK (map_kind IN ('OBJECT','FIELD','EVENT')),

  -- Tenant-facing (alias) terms
  alias_code            text NOT NULL,     -- e.g. 'pattern', 'pattern.sku', 'checkout.started'

  -- Canonical EIP terms
  canonical_code        text NOT NULL,     -- e.g. 'material', 'material.attrs.sku', 'ECOM.CHECKOUT.STARTED'

  -- Optional: extra rules per mapping (transforms, formatting, etc.)
  attrs                 jsonb NOT NULL DEFAULT '{}'::jsonb,

  is_active             boolean NOT NULL DEFAULT true,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS ux_socket_alias_map_unique
  ON eip_commerce.socket_alias_map (tenant_id, map_kind, alias_code)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS ix_socket_alias_map_tenant_kind
  ON eip_commerce.socket_alias_map (tenant_id, map_kind);

-- ---------------------------------------------------------------------
-- 3) Optional: SmartSocket capability bindings (manifest ↔ AuthZ permission)
--
-- This table is OPTIONAL but highly useful for SS2 because it ties
-- "UI visible capabilities" to your RBAC permission codes.
--
-- If you already have a canonical permission table in AuthZ, you can
-- add a FK later. For now: keep it loosely coupled by storing codes.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eip_commerce.socket_capability (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,

  -- which socket this applies to
  socket_code    text NOT NULL DEFAULT 'WEB',

  -- capability identifier used by UI (semantic and readable)
  capability_code text NOT NULL,           -- e.g. 'CHECKOUT', 'PAYMENT_PAYPAL', 'CUSTOM_ORDER_UPLOAD'

  -- RBAC permission code that grants it (semantic)
  permission_code text NOT NULL,           -- e.g. 'ECOM.CHECKOUT.START', 'ECOM.PAYMENT.REFUND'

  attrs          jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active      boolean NOT NULL DEFAULT true,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_socket_capability_unique
  ON eip_commerce.socket_capability (tenant_id, socket_code, capability_code)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS ix_socket_capability_tenant_socket
  ON eip_commerce.socket_capability (tenant_id, socket_code);

COMMIT;

-- =====================================================================
-- Notes (SS2 manifest conventions)
--
-- You can store a manifest like:
-- {
--   "featureFlags": { "payments": true, "paypal": true, "pos": false },
--   "forms": {
--     "checkout": { "fields": [...], "validation": {...} }
--   },
--   "payments": { "methods": ["CARD","PAYPAL","CASH"] },
--   "events": {
--     "emit": ["ECOM.CART.UPDATED","ECOM.CHECKOUT.STARTED","ECOM.ORDER.PLACED"],
--     "consume": ["ECOM.ORDER.STATUS_CHANGED","ECOM.REFUND.COMPLETED"]
--   },
--   "mapping": { "useAliasMap": true }
-- }
--
-- Keep big 1-to-many (e.g., order lines) out of manifest; it's configuration only.
-- =====================================================================
