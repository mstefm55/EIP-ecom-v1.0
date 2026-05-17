-- connection_profile_samara.sql
-- Seed connection profile for Samara tenant (Mode B)

DO $$
DECLARE
  t_id uuid;
BEGIN
  SELECT id INTO t_id FROM eip_core.tenant WHERE code = 't_ed6019735b2f';
  IF t_id IS NULL THEN
    RAISE NOTICE 'Samara tenant not found, skipping.';
    RETURN;
  END IF;

  INSERT INTO eip_core.tenant_connection_profile
    (tenant_id, mode, status_code, backend_owner, allowed_origins, ui_templates, attrs)
  VALUES
    (t_id, 'B', 'ACTIVE', 'eip', '{}'::text[], '[]'::jsonb, jsonb_build_object('seed', true))
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    mode = EXCLUDED.mode,
    status_code = EXCLUDED.status_code,
    backend_owner = EXCLUDED.backend_owner,
    updated_at = now();
END $$;
