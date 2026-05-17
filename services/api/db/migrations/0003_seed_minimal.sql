-- 0003_seed_minimal.sql
-- Purpose: minimal seed for visibility/testing:
--   - 1 tenant
--   - 2 agents (customer person + machine)
--   - 1 service object (maintenance_case)
--   - party links (subject_asset, requester)

BEGIN;

-- Create a tenant (idempotent by code)
INSERT INTO eip_core.tenant (code, name, attrs)
VALUES ('eip_demo', 'EIP Demo Tenant', '{"note":"seed"}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- Grab tenant id
WITH t AS (
  SELECT id FROM eip_core.tenant WHERE code = 'eip_demo'
),
ins_agents AS (
  -- Customer/person agent
  INSERT INTO eip_core.agent (tenant_id, agent_type, code, name, attrs)
  SELECT t.id, 'person', 'CUST-0001', 'John Patient', '{"roles":["customer","patient"]}'::jsonb
  FROM t
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id, tenant_id
),
ins_machine AS (
  -- Machine agent (resource)
  INSERT INTO eip_core.agent (tenant_id, agent_type, code, name, attrs)
  SELECT t.id, 'machine', 'MACH-0001', 'CNC Machine 01', '{"roles":["asset","resource"]}'::jsonb
  FROM t
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id, tenant_id
)
SELECT 1;

-- Create a service object (maintenance case)
WITH t AS (
  SELECT id AS tenant_id FROM eip_core.tenant WHERE code = 'eip_demo'
),
so AS (
  INSERT INTO eip_core.service_object (tenant_id, object_type, status, code, title, attrs)
  SELECT t.tenant_id,
         'maintenance_case',
         'new',
         'MC-0001',
         'Maintenance for CNC Machine 01',
         '{"priority":"medium"}'::jsonb
  FROM t
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id, tenant_id
),
cust AS (
  SELECT id AS agent_id, tenant_id
  FROM eip_core.agent
  WHERE code = 'CUST-0001'
),
mach AS (
  SELECT id AS agent_id, tenant_id
  FROM eip_core.agent
  WHERE code = 'MACH-0001'
)
-- Party links (idempotent via sop_unique constraint)
INSERT INTO eip_core.service_object_party (tenant_id, service_object_id, agent_id, role, attrs)
SELECT so.tenant_id, so.id, mach.agent_id, 'subject_asset', '{}'::jsonb
FROM so, mach
ON CONFLICT DO NOTHING;

-- Link requester (customer/person) to the same case
WITH so AS (
  SELECT id, tenant_id FROM eip_core.service_object WHERE code='MC-0001'
),
cust AS (
  SELECT id AS agent_id, tenant_id FROM eip_core.agent WHERE code='CUST-0001'
)
INSERT INTO eip_core.service_object_party (tenant_id, service_object_id, agent_id, role, attrs)
SELECT so.tenant_id, so.id, cust.agent_id, 'requester', '{}'::jsonb
FROM so, cust
ON CONFLICT DO NOTHING;

COMMIT;
