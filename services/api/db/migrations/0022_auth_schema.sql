BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS eip_auth;
COMMENT ON SCHEMA eip_auth IS 'Authentication & identity layer (isolated from eip_core).';

-- Shared helper for updated_at (keep in eip_core for reuse)
CREATE OR REPLACE FUNCTION eip_core.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

COMMIT;
