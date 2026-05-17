-- 0011_task_template.sql
-- Kernel: task templates (definitions) used to generate runtime tasks
-- Semantics: template = rule/blueprint, not an instance

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS eip_core.task_template (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,

  process_def_id      uuid NOT NULL,

  -- Optional: scope template to a runtime object type (for reuse across multiple object types)
  service_object_type text,

  task_type           text NOT NULL,
  title               text,
  description         text,

  is_active           boolean NOT NULL DEFAULT true,
  sort_order          integer NOT NULL DEFAULT 100,

  -- Policy and integration hooks (graph node id, SLA, role routing, UI schema ids, etc.)
  attrs               jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eip_core.task_template
  ADD CONSTRAINT task_template_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES eip_core.tenant(id)
  ON DELETE RESTRICT;

ALTER TABLE eip_core.task_template
  ADD CONSTRAINT task_template_process_def_fk
  FOREIGN KEY (process_def_id) REFERENCES eip_core.process_def(id)
  ON DELETE CASCADE;

-- Avoid duplicates within a process scope
CREATE UNIQUE INDEX IF NOT EXISTS task_template_unique
  ON eip_core.task_template (tenant_id, process_def_id, COALESCE(service_object_type,''), task_type);

-- Lookup templates for a process (and optionally type)
CREATE INDEX IF NOT EXISTS task_template_lookup_idx
  ON eip_core.task_template (tenant_id, process_def_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS task_template_attrs_gin
  ON eip_core.task_template USING gin (attrs);

COMMIT;
