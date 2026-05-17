-- 0016_material_skeleton.sql
-- Backbone: Material master + lots/batches + event history (materials transform through processes)
-- Semantics:
--   material      = master definition/spec
--   material_lot  = batch/instance that changes state/properties over time
--   material_lot_status_event = append-only history

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1) material (definition/spec)
-- ============================================================
CREATE TABLE IF NOT EXISTS eip_core.material (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,

  material_type text NOT NULL,  -- e.g. 'FABRIC', 'YARN', 'CHEMICAL', 'PART', 'SERVICE'
  code       text,
  name       text,

  attrs      jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active  boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eip_core.material
  ADD CONSTRAINT material_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES eip_core.tenant(id)
  ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS material_code_unique_per_tenant
  ON eip_core.material (tenant_id, code)
  WHERE (code IS NOT NULL);

CREATE INDEX IF NOT EXISTS material_tenant_type_idx
  ON eip_core.material (tenant_id, material_type);

CREATE INDEX IF NOT EXISTS material_attrs_gin
  ON eip_core.material USING gin (attrs);


-- ============================================================
-- 2) material_lot (batch/instance)
-- ============================================================
CREATE TABLE IF NOT EXISTS eip_core.material_lot (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,

  material_id   uuid NOT NULL,

  lot_code      text,            -- batch/roll/coil/serial grouping
  status        text NOT NULL DEFAULT 'new',

  quantity      numeric,         -- optional base quantity
  uom           text,            -- optional unit of measure

  -- Optional link to the operational "case" managing this lot through a process
  service_object_id uuid,

  owner_agent_id uuid,

  attrs         jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active     boolean NOT NULL DEFAULT true,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eip_core.material_lot
  ADD CONSTRAINT material_lot_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES eip_core.tenant(id)
  ON DELETE RESTRICT;

ALTER TABLE eip_core.material_lot
  ADD CONSTRAINT material_lot_material_fk
  FOREIGN KEY (material_id) REFERENCES eip_core.material(id)
  ON DELETE RESTRICT;

ALTER TABLE eip_core.material_lot
  ADD CONSTRAINT material_lot_service_object_fk
  FOREIGN KEY (service_object_id) REFERENCES eip_core.service_object(id)
  ON DELETE SET NULL;

ALTER TABLE eip_core.material_lot
  ADD CONSTRAINT material_lot_owner_agent_fk
  FOREIGN KEY (owner_agent_id) REFERENCES eip_core.agent(id)
  ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS material_lot_code_unique_per_material
  ON eip_core.material_lot (tenant_id, material_id, lot_code)
  WHERE (lot_code IS NOT NULL);

CREATE INDEX IF NOT EXISTS material_lot_status_idx
  ON eip_core.material_lot (tenant_id, status);

CREATE INDEX IF NOT EXISTS material_lot_material_idx
  ON eip_core.material_lot (material_id);

CREATE INDEX IF NOT EXISTS material_lot_service_object_idx
  ON eip_core.material_lot (service_object_id);

CREATE INDEX IF NOT EXISTS material_lot_attrs_gin
  ON eip_core.material_lot USING gin (attrs);


-- ============================================================
-- 3) material_lot_status_event (append-only history)
-- ============================================================
CREATE TABLE IF NOT EXISTS eip_core.material_lot_status_event (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,

  material_lot_id uuid NOT NULL,

  from_status    text,
  to_status      text NOT NULL,

  reason_code    text,
  note           text,

  occurred_at    timestamptz NOT NULL DEFAULT now(),
  actor_agent_id uuid,

  attrs          jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eip_core.material_lot_status_event
  ADD CONSTRAINT mlse_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES eip_core.tenant(id)
  ON DELETE RESTRICT;

ALTER TABLE eip_core.material_lot_status_event
  ADD CONSTRAINT mlse_material_lot_fk
  FOREIGN KEY (material_lot_id) REFERENCES eip_core.material_lot(id)
  ON DELETE CASCADE;

ALTER TABLE eip_core.material_lot_status_event
  ADD CONSTRAINT mlse_actor_fk
  FOREIGN KEY (actor_agent_id) REFERENCES eip_core.agent(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS mlse_tenant_lot_time_idx
  ON eip_core.material_lot_status_event (tenant_id, material_lot_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS mlse_to_status_idx
  ON eip_core.material_lot_status_event (tenant_id, to_status);

CREATE INDEX IF NOT EXISTS mlse_attrs_gin
  ON eip_core.material_lot_status_event USING gin (attrs);

COMMIT;
