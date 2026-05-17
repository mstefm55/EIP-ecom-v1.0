BEGIN;

-- 1) Channel registry per tenant (e.g., WEB, POS, PORTAL, SOCIAL, etc.)
CREATE TABLE IF NOT EXISTS eip_commerce.socket_channel (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,

  -- "WEB" / "POS" / "PORTAL" / etc
  code        text NOT NULL,
  name        text NOT NULL,

  is_active   boolean NOT NULL DEFAULT true,
  attrs       jsonb   NOT NULL DEFAULT '{}'::jsonb,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT socket_channel_uniq UNIQUE (tenant_id, code)
);

COMMENT ON TABLE eip_commerce.socket_channel IS
'Per-tenant channel registry for gateway sockets (WEB/POS/PORTAL/SOCIAL...). Used by origin allowlists and capability binding.';


-- 2) Allowed origins per channel (public website control)
CREATE TABLE IF NOT EXISTS eip_commerce.socket_origin_allowlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  uuid NOT NULL REFERENCES eip_commerce.socket_channel(id) ON DELETE CASCADE,

  -- exact match string (ex: https://shop.customer.com)
  origin      text NOT NULL,

  is_active   boolean NOT NULL DEFAULT true,
  attrs       jsonb   NOT NULL DEFAULT '{}'::jsonb,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT socket_origin_allowlist_uniq UNIQUE (channel_id, origin)
);

COMMENT ON TABLE eip_commerce.socket_origin_allowlist IS
'Allowed Origin header values for public socket manifest fetch. Governance gate for tenant websites.';

-- Indexes for fast checks
CREATE INDEX IF NOT EXISTS socket_channel_lookup_idx
  ON eip_commerce.socket_channel (tenant_id, code)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS socket_origin_allowlist_lookup_idx
  ON eip_commerce.socket_origin_allowlist (channel_id, origin)
  WHERE is_active;

COMMIT;
