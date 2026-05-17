-- 0012_process_instance.sql
-- Kernel: execution cursor/state for a process_def applied to a service_object
-- Semantics: instance = runtime execution state (not definition, not task)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS eip_core.process_instance (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,

  service_object_id  uuid NOT NULL,
  process_def_id     uuid NOT NULL,

  status             text NOT NULL DEFAULT 'active',  -- keep as text for now; can be dropdown-governed later
  started_at         timestamptz NOT NULL DEFAULT now(),
  ended_at           timestamptz,

  -- Execution cursor (graph-driven)
  cursor_json        jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Extra execution metadata
  attrs              jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eip_core.process_instance
  ADD CONSTRAINT process_instance_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES eip_core.tenant(id)
  ON DELETE RESTRICT;

ALTER TABLE eip_core.process_instance
  ADD CONSTRAINT process_instance_service_object_fk
  FOREIGN KEY (service_object_id) REFERENCES eip_core.service_object(id)
  ON DELETE CASCADE;

ALTER TABLE eip_core.process_instance
  ADD CONSTRAINT process_instance_process_def_fk
  FOREIGN KEY (process_def_id) REFERENCES eip_core.process_def(id)
  ON DELETE RESTRICT;

-- One active instance per service_object + process_def (historical runs can exist if ended)
CREATE UNIQUE INDEX IF NOT EXISTS process_instance_one_active
  ON eip_core.process_instance (tenant_id, service_object_id, process_def_id)
  WHERE (ended_at IS NULL);

CREATE INDEX IF NOT EXISTS process_instance_lookup_idx
  ON eip_core.process_instance (tenant_id, process_def_id, status);

CREATE INDEX IF NOT EXISTS process_instance_cursor_gin
  ON eip_core.process_instance USING gin (cursor_json);

CREATE INDEX IF NOT EXISTS process_instance_attrs_gin
  ON eip_core.process_instance USING gin (attrs);

COMMIT;
