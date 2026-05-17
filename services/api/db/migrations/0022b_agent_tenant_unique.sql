BEGIN;

-- Required so eip_auth can reference (tenant_id, id) safely.
-- If this already exists, this will do nothing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'eip_core'
      AND indexname = 'agent_tenant_id_uq'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX agent_tenant_id_uq ON eip_core.agent (tenant_id, id)';
  END IF;
END $$;

COMMIT;
