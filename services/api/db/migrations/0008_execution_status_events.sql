-- 0008_execution_status_events.sql
-- Kernel: immutable status transition events for service_object and task
-- Semantics: *_event tables are append-only audit/history logs.

BEGIN;

-- UUID generator (safe if already installed)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1) Service Object Status Events (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS eip_core.service_object_status_event (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  service_object_id uuid NOT NULL,

  from_status       text,
  to_status         text NOT NULL,

  reason_code       text,
  note              text,

  occurred_at       timestamptz NOT NULL DEFAULT now(),
  actor_agent_id    uuid,

  attrs             jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eip_core.service_object_status_event
  ADD CONSTRAINT service_object_status_event_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES eip_core.tenant(id)
  ON DELETE RESTRICT;

ALTER TABLE eip_core.service_object_status_event
  ADD CONSTRAINT service_object_status_event_service_object_fk
  FOREIGN KEY (service_object_id) REFERENCES eip_core.service_object(id)
  ON DELETE CASCADE;

ALTER TABLE eip_core.service_object_status_event
  ADD CONSTRAINT service_object_status_event_actor_fk
  FOREIGN KEY (actor_agent_id) REFERENCES eip_core.agent(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS so_status_event_tenant_object_time_idx
  ON eip_core.service_object_status_event (tenant_id, service_object_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS so_status_event_status_idx
  ON eip_core.service_object_status_event (tenant_id, to_status);

CREATE INDEX IF NOT EXISTS so_status_event_actor_idx
  ON eip_core.service_object_status_event (actor_agent_id);

CREATE INDEX IF NOT EXISTS so_status_event_attrs_gin
  ON eip_core.service_object_status_event USING gin (attrs);


-- ============================================================
-- 2) Task Status Events (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS eip_core.task_status_event (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  task_id        uuid NOT NULL,

  from_status    text,
  to_status      text NOT NULL,

  reason_code    text,
  note           text,

  occurred_at    timestamptz NOT NULL DEFAULT now(),
  actor_agent_id uuid,

  attrs          jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eip_core.task_status_event
  ADD CONSTRAINT task_status_event_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES eip_core.tenant(id)
  ON DELETE RESTRICT;

ALTER TABLE eip_core.task_status_event
  ADD CONSTRAINT task_status_event_task_fk
  FOREIGN KEY (task_id) REFERENCES eip_core.task(id)
  ON DELETE CASCADE;

ALTER TABLE eip_core.task_status_event
  ADD CONSTRAINT task_status_event_actor_fk
  FOREIGN KEY (actor_agent_id) REFERENCES eip_core.agent(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS task_status_event_tenant_task_time_idx
  ON eip_core.task_status_event (tenant_id, task_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS task_status_event_status_idx
  ON eip_core.task_status_event (tenant_id, to_status);

CREATE INDEX IF NOT EXISTS task_status_event_actor_idx
  ON eip_core.task_status_event (actor_agent_id);

CREATE INDEX IF NOT EXISTS task_status_event_attrs_gin
  ON eip_core.task_status_event USING gin (attrs);

COMMIT;
