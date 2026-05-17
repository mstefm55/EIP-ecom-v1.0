BEGIN;

CREATE TABLE IF NOT EXISTS eip_core.ui_surface (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES eip_core.tenant(id),
  code text NOT NULL,
  title text,
  version integer DEFAULT 1,
  is_active boolean DEFAULT true,
  is_published boolean DEFAULT false,
  is_public boolean DEFAULT false,
  tree jsonb NOT NULL,
  attrs jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, code, version)
);

CREATE INDEX IF NOT EXISTS idx_ui_surface_code
  ON eip_core.ui_surface (code);

CREATE INDEX IF NOT EXISTS idx_ui_surface_tenant_code
  ON eip_core.ui_surface (tenant_id, code);

CREATE INDEX IF NOT EXISTS idx_ui_surface_public
  ON eip_core.ui_surface (code)
  WHERE is_public = true AND is_active = true AND is_published = true;

COMMIT;
