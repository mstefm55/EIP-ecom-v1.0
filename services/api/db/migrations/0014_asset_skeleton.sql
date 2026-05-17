-- 0014_asset_skeleton.sql
-- Backbone Step B: Asset module skeleton (resources, not agents)
-- Semantics: assets are resources used in processes; they can be assigned and tracked with event history.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1) asset (resource master)
-- ============================================================
CREATE TABLE IF NOT EXISTS eip_core.asset (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,

  asset_type    text NOT NULL,   -- e.g. 'MACHINE', 'VEHICLE', 'TOOL', 'WORKSTATION_EQUIPMENT'
  code          text,            -- human code / tag (serial, internal code)
  name          text,

  status        text NOT NULL DEFAULT 'active', -- governed later via dropdown
  attrs         jsonb NOT NULL DEFAULT '{}'::jsonb,

  is_active     boolean NOT NULL DEFAULT true,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eip_core.asset
  ADD CONSTRAINT asset_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES eip_core.tenant(id)
  ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS asset_code_unique_per_tenant
  ON eip_core.asset (tenant_id, code)
  WHERE (code IS NOT NULL);

CREATE INDEX IF NOT EXISTS asset_tenant_type_status_idx
  ON eip_core.asset (tenant_id, asset_type, status);

CREATE INDEX IF NOT EXISTS asset_attrs_gin
  ON eip_core.asset USING gin (attrs);


-- ============================================================
-- 2) asset_assignment (deployment/ownership/placement over time)
-- ============================================================
CREATE TABLE IF NOT EXISTS eip_core.asset_assignment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,

  asset_id       uuid NOT NULL,

  -- Flexible target (because org/workstation tables may come later)
  -- Use attrs for: site_id, org_unit_id, workstation_id, location_code, etc.
  assigned_to_agent_id uuid,      -- optional: an agent responsible/owner

  starts_at      timestamptz NOT NULL DEFAULT now(),
  ends_at        timestamptz,

  is_active      boolean NOT NULL DEFAULT true,
  attrs          jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eip_core.asset_assignment
  ADD CONSTRAINT asset_assignment_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES eip_core.tenant(id)
  ON DELETE RESTRICT;

ALTER TABLE eip_core.asset_assignment
  ADD CONSTRAINT asset_assignment_asset_fk
  FOREIGN KEY (asset_id) REFERENCES eip_core.asset(id)
  ON DELETE CASCADE;

ALTER TABLE eip_core.asset_assignment
  ADD CONSTRAINT asset_assignment_agent_fk
  FOREIGN KEY (assigned_to_agent_id) REFERENCES eip_core.agent(id)
  ON DELETE SET NULL;

-- Ensure ends_at consistency
ALTER TABLE eip_core.asset_assignment
  ADD CONSTRAINT asset_assignment_time_check
  CHECK (ends_at IS NULL OR ends_at > starts_at);

-- At most one active assignment at a time per asset (can be relaxed later)
CREATE UNIQUE INDEX IF NOT EXISTS asset_assignment_one_active
  ON eip_core.asset_assignment (tenant_id, asset_id)
  WHERE (is_active = true AND ends_at IS NULL);

CREATE INDEX IF NOT EXISTS asset_assignment_asset_time_idx
  ON eip_core.asset_assignment (asset_id, starts_at DESC);

CREATE INDEX IF NOT EXISTS asset_assignment_attrs_gin
  ON eip_core.asset_assignment USING gin (attrs);


-- ============================================================
-- 3) asset_status_event (append-only status history)
-- ============================================================
CREATE TABLE IF NOT EXISTS eip_core.asset_status_event (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,

  asset_id       uuid NOT NULL,

  from_status    text,
  to_status      text NOT NULL,

  reason_code    text,
  note           text,

  occurred_at    timestamptz NOT NULL DEFAULT now(),
  actor_agent_id uuid,

  attrs          jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eip_core.asset_status_event
  ADD CONSTRAINT asset_status_event_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES eip_core.tenant(id)
  ON DELETE RESTRICT;

ALTER TABLE eip_core.asset_status_event
  ADD CONSTRAINT asset_status_event_asset_fk
  FOREIGN KEY (asset_id) REFERENCES eip_core.asset(id)
  ON DELETE CASCADE;

ALTER TABLE eip_core.asset_status_event
  ADD CONSTRAINT asset_status_event_actor_fk
  FOREIGN KEY (actor_agent_id) REFERENCES eip_core.agent(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS asset_status_event_tenant_asset_time_idx
  ON eip_core.asset_status_event (tenant_id, asset_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS asset_status_event_status_idx
  ON eip_core.asset_status_event (tenant_id, to_status);

CREATE INDEX IF NOT EXISTS asset_status_event_attrs_gin
  ON eip_core.asset_status_event USING gin (attrs);

COMMIT;
