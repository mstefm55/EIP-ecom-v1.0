-- 0004_process_and_tasks.sql
-- Purpose: minimal process/task engine in core:
--  - process_def: definition (graph stored in jsonb)
--  - task: runtime tasks assigned to people/teams/resources, linked to a service_object

BEGIN;

-- Process definition (template / blueprint)
CREATE TABLE IF NOT EXISTS eip_core.process_def (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE RESTRICT,

  code         text NOT NULL,
  name         text NOT NULL,
  version      integer NOT NULL DEFAULT 1,
  is_active    boolean NOT NULL DEFAULT true,

  -- Workflow definition graph (nodes/edges/stages/ops)
  graph        jsonb NOT NULL DEFAULT '{}'::jsonb,

  attrs        jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT process_def_unique UNIQUE (tenant_id, code, version)
);

CREATE INDEX IF NOT EXISTS process_def_tenant_idx ON eip_core.process_def(tenant_id);
CREATE INDEX IF NOT EXISTS process_def_active_idx ON eip_core.process_def(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS process_def_graph_gin ON eip_core.process_def USING gin (graph);
CREATE INDEX IF NOT EXISTS process_def_attrs_gin ON eip_core.process_def USING gin (attrs);

-- Task (runtime work item)
CREATE TABLE IF NOT EXISTS eip_core.task (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE RESTRICT,

  -- What this task is for
  service_object_id uuid NOT NULL REFERENCES eip_core.service_object(id) ON DELETE CASCADE,

  -- Optional: which process generated it
  process_def_id    uuid REFERENCES eip_core.process_def(id) ON DELETE SET NULL,

  task_type         text NOT NULL,                 -- approval, data_entry, operation, info
  status            text NOT NULL DEFAULT 'open',   -- open, in_progress, done, cancelled
  title             text,
  description       text,

  -- Assigned to an entity (person/team/resource) in eip_core.agent for now
  assigned_agent_id uuid REFERENCES eip_core.agent(id) ON DELETE SET NULL,

  -- Scheduling fields
  due_at            timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,

  -- Flexible payload for forms/instructions/outputs
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  attrs             jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_tenant_idx ON eip_core.task(tenant_id);
CREATE INDEX IF NOT EXISTS task_so_idx ON eip_core.task(service_object_id);
CREATE INDEX IF NOT EXISTS task_status_idx ON eip_core.task(tenant_id, status);
CREATE INDEX IF NOT EXISTS task_assigned_idx ON eip_core.task(assigned_agent_id);
CREATE INDEX IF NOT EXISTS task_due_idx ON eip_core.task(due_at);
CREATE INDEX IF NOT EXISTS task_payload_gin ON eip_core.task USING gin (payload);
CREATE INDEX IF NOT EXISTS task_attrs_gin ON eip_core.task USING gin (attrs);

COMMIT;
