BEGIN;

-- A “channel” = a tenant-facing endpoint surface like WEB storefront, PORTAL, POS, SOCIAL, etc.
CREATE TABLE IF NOT EXISTS eip_commerce.socket_channel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,

  code text NOT NULL,                 -- e.g. WEB, PORTAL, POS
  name text NOT NULL,                 -- human-friendly label
  kind text NOT NULL DEFAULT 'web',    -- web|portal|pos|social|other
  is_active boolean NOT NULL DEFAULT true,

  -- governance: channel configuration (feature flags, limits, references)
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, code)
);

COMMENT ON TABLE eip_commerce.socket_channel IS
  'Gateway channel registry. Defines tenant-facing surfaces (WEB/PORTAL/POS/etc).';

-- Origin allowlist per channel (critical for public clients)
CREATE TABLE IF NOT EXISTS eip_commerce.socket_origin_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES eip_commerce.socket_channel(id) ON DELETE CASCADE,

  origin text NOT NULL,               -- exact origin: https://example.com
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (channel_id, origin)
);

CREATE INDEX IF NOT EXISTS socket_origin_lookup_idx
  ON eip_commerce.socket_origin_allowlist (tenant_id, channel_id, is_active);

COMMENT ON TABLE eip_commerce.socket_origin_allowlist IS
  'Per-channel allowed browser origins. Enforced on PUBLIC endpoints.';

COMMIT;
