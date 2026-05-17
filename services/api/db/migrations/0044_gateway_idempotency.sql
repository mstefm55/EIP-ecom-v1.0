BEGIN;

CREATE TABLE IF NOT EXISTS eip_core.idempotency_key (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE CASCADE,
  scope text NOT NULL,
  key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  response jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idempotency_key_scope_idx
  ON eip_core.idempotency_key (tenant_id, scope, key);

CREATE INDEX IF NOT EXISTS idempotency_key_time_idx
  ON eip_core.idempotency_key (tenant_id, scope, created_at DESC);

COMMIT;
