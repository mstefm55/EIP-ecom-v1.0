-- 0002_core_kernel.sql
-- Purpose: EIP Core kernel tables for modular SaaS:
--   - tenant (SaaS boundary)
--   - agent (who acts)
--   - service_object (what flows through processes)
--   - service_object_party (flexible link: subject/payer/requester/etc.)

BEGIN;

-- 1) Tenant (required for SaaS + modular licensing)
CREATE TABLE IF NOT EXISTS eip_core.tenant (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,          -- short code: "samara", "demo", etc.
  name         text NOT NULL,
  attrs        jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 2) Agent (who acts: person/org/machine/system)
CREATE TABLE IF NOT EXISTS eip_core.agent (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE RESTRICT,

  -- Use text instead of ENUM for flexibility across industries
  agent_type   text NOT NULL,                 -- e.g. person, org, machine, team, system
  code         text,                          -- optional: internal code, employee no, etc.
  name         text,                          -- display name
  attrs        jsonb NOT NULL DEFAULT '{}'::jsonb,

  parent_agent_id uuid REFERENCES eip_core.agent(id) ON DELETE SET NULL,

  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- If code is used, keep it unique within tenant
  CONSTRAINT agent_code_unique_per_tenant UNIQUE (tenant_id, code)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS agent_tenant_idx ON eip_core.agent(tenant_id);
CREATE INDEX IF NOT EXISTS agent_type_idx ON eip_core.agent(tenant_id, agent_type);
CREATE INDEX IF NOT EXISTS agent_parent_idx ON eip_core.agent(parent_agent_id);
CREATE INDEX IF NOT EXISTS agent_attrs_gin ON eip_core.agent USING gin (attrs);

-- 3) Service Object (what flows through processes: order/case/job/batch/etc.)
CREATE TABLE IF NOT EXISTS eip_core.service_object (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE RESTRICT,

  object_type  text NOT NULL,                 -- e.g. patient_case, sales_order, maintenance_case, material_lot
  status       text NOT NULL DEFAULT 'new',    -- generic lifecycle; modules can extend meanings
  code         text,                          -- optional human-friendly ref
  title        text,                          -- optional display title
  attrs        jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- optional "owner" concept (who is responsible)
  owner_agent_id uuid REFERENCES eip_core.agent(id) ON DELETE SET NULL,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT service_object_code_unique_per_tenant UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS so_tenant_idx ON eip_core.service_object(tenant_id);
CREATE INDEX IF NOT EXISTS so_type_status_idx ON eip_core.service_object(tenant_id, object_type, status);
CREATE INDEX IF NOT EXISTS so_owner_idx ON eip_core.service_object(owner_agent_id);
CREATE INDEX IF NOT EXISTS so_attrs_gin ON eip_core.service_object USING gin (attrs);

-- 4) Service Object ↔ Agent links (subject/payer/requester/supplier/technician/etc.)
CREATE TABLE IF NOT EXISTS eip_core.service_object_party (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES eip_core.tenant(id) ON DELETE RESTRICT,

  service_object_id uuid NOT NULL REFERENCES eip_core.service_object(id) ON DELETE CASCADE,
  agent_id          uuid NOT NULL REFERENCES eip_core.agent(id) ON DELETE RESTRICT,

  role            text NOT NULL,              -- e.g. subject, customer, payer, requester, supplier, technician, provider
  attrs           jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at      timestamptz NOT NULL DEFAULT now(),

  -- avoid duplicate role links (same agent same role on same object)
  CONSTRAINT sop_unique UNIQUE (tenant_id, service_object_id, agent_id, role)
);

CREATE INDEX IF NOT EXISTS sop_tenant_idx ON eip_core.service_object_party(tenant_id);
CREATE INDEX IF NOT EXISTS sop_service_object_idx ON eip_core.service_object_party(service_object_id);
CREATE INDEX IF NOT EXISTS sop_agent_idx ON eip_core.service_object_party(agent_id);
CREATE INDEX IF NOT EXISTS sop_role_idx ON eip_core.service_object_party(tenant_id, role);
CREATE INDEX IF NOT EXISTS sop_attrs_gin ON eip_core.service_object_party USING gin (attrs);

COMMIT;
