-- 0010_process_binding.sql
-- Kernel: declarative bindings between runtime objects and process definitions
-- Semantics: "binding" = rule that connects object types to process defs (and optional task policy)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS eip_core.process_binding (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,

  -- Runtime scope
  service_object_type text NOT NULL,

  -- Which process definition governs this runtime type
  process_def_id      uuid NOT NULL,

  -- Policy
  is_active           boolean NOT NULL DEFAULT true,
  priority            integer NOT NULL DEFAULT 100,

  -- Optional: narrow to a task type category (if you want multiple bindings per object_type)
  task_type           text,

  attrs               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eip_core.process_binding
  ADD CONSTRAINT process_binding_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES eip_core.tenant(id)
  ON DELETE RESTRICT;

ALTER TABLE eip_core.process_binding
  ADD CONSTRAINT process_binding_process_def_fk
  FOREIGN KEY (process_def_id) REFERENCES eip_core.process_def(id)
  ON DELETE RESTRICT;

-- Uniqueness: avoid duplicate competing bindings (but allow multiple task_type variants)
CREATE UNIQUE INDEX IF NOT EXISTS process_binding_unique
  ON eip_core.process_binding (tenant_id, service_object_type, process_def_id, COALESCE(task_type, ''));

-- Query speed: find active binding for a type
CREATE INDEX IF NOT EXISTS process_binding_lookup_idx
  ON eip_core.process_binding (tenant_id, service_object_type, is_active, priority);

CREATE INDEX IF NOT EXISTS process_binding_attrs_gin
  ON eip_core.process_binding USING gin (attrs);

COMMIT;
