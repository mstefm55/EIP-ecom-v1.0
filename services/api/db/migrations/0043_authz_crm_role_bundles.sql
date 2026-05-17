BEGIN;

-- =========================================================
-- CRM + core process permissions (idempotent)
-- =========================================================
INSERT INTO eip_authz.permission(code, label, description) VALUES
  ('CRM_AGENT_READ',        'Read CRM agents',        'View CRM agents'),
  ('CRM_AGENT_WRITE',       'Write CRM agents',       'Create/update CRM agents'),
  ('CRM_INTERACTION_READ',  'Read CRM interactions',  'View CRM interactions'),
  ('CRM_INTERACTION_WRITE', 'Write CRM interactions', 'Create/update CRM interactions'),
  ('CRM_CASE_READ',         'Read CRM cases',         'View CRM cases'),
  ('CRM_CASE_WRITE',        'Write CRM cases',        'Create/update CRM cases'),
  ('CRM_OPPORTUNITY_READ',  'Read CRM opportunities', 'View CRM opportunities'),
  ('CRM_OPPORTUNITY_WRITE', 'Write CRM opportunities','Create/update CRM opportunities'),
  ('CRM_TASK_READ',         'Read CRM tasks',         'View CRM tasks'),
  ('CRM_TASK_WRITE',        'Write CRM tasks',        'Create/update CRM tasks'),
  ('CRM_PROCESS_DEF_READ',  'Read CRM processes',     'View CRM process defs/instances'),
  ('CRM_PROCESS_DEF_WRITE', 'Write CRM processes',    'Create/update CRM process defs/instances'),
  ('CRM_DASHBOARD_READ',    'Read CRM dashboard',     'View CRM dashboard metrics'),
  ('PROCESS_DEF_READ',      'Read process defs',      'View process definitions'),
  ('PROCESS_DEF_WRITE',     'Write process defs',     'Create/update process definitions'),
  ('PROCESS_INSTANCE_READ', 'Read process instances', 'View process instances'),
  ('PROCESS_INSTANCE_WRITE','Write process instances','Create/update process instances')
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- Ensure CRM roles exist for every tenant
-- =========================================================
INSERT INTO eip_authz.role(tenant_id, code, label, surface_code, is_system)
SELECT t.id, 'CRM_ADMIN', 'CRM Admin', 'ERP', true
FROM eip_core.tenant t
WHERE NOT EXISTS (
  SELECT 1
  FROM eip_authz.role r
  WHERE r.tenant_id = t.id AND r.code = 'CRM_ADMIN'
);

INSERT INTO eip_authz.role(tenant_id, code, label, surface_code, is_system)
SELECT t.id, 'CRM_USER', 'CRM User', 'ERP', true
FROM eip_core.tenant t
WHERE NOT EXISTS (
  SELECT 1
  FROM eip_authz.role r
  WHERE r.tenant_id = t.id AND r.code = 'CRM_USER'
);

-- =========================================================
-- Role bundles (apply to all tenants)
-- =========================================================
WITH roles AS (
  SELECT id, code
  FROM eip_authz.role
  WHERE code IN ('ADMIN_SUPER','CRM_ADMIN','CRM_USER')
),
rp(role_code, perm_code) AS (
  VALUES
    -- CRM_ADMIN: full CRM + core process
    ('CRM_ADMIN','CRM_AGENT_READ'),
    ('CRM_ADMIN','CRM_AGENT_WRITE'),
    ('CRM_ADMIN','CRM_INTERACTION_READ'),
    ('CRM_ADMIN','CRM_INTERACTION_WRITE'),
    ('CRM_ADMIN','CRM_CASE_READ'),
    ('CRM_ADMIN','CRM_CASE_WRITE'),
    ('CRM_ADMIN','CRM_OPPORTUNITY_READ'),
    ('CRM_ADMIN','CRM_OPPORTUNITY_WRITE'),
    ('CRM_ADMIN','CRM_TASK_READ'),
    ('CRM_ADMIN','CRM_TASK_WRITE'),
    ('CRM_ADMIN','CRM_PROCESS_DEF_READ'),
    ('CRM_ADMIN','CRM_PROCESS_DEF_WRITE'),
    ('CRM_ADMIN','CRM_DASHBOARD_READ'),
    ('CRM_ADMIN','PROCESS_DEF_READ'),
    ('CRM_ADMIN','PROCESS_DEF_WRITE'),
    ('CRM_ADMIN','PROCESS_INSTANCE_READ'),
    ('CRM_ADMIN','PROCESS_INSTANCE_WRITE'),

    -- CRM_USER: read + limited write
    ('CRM_USER','CRM_AGENT_READ'),
    ('CRM_USER','CRM_INTERACTION_READ'),
    ('CRM_USER','CRM_INTERACTION_WRITE'),
    ('CRM_USER','CRM_CASE_READ'),
    ('CRM_USER','CRM_CASE_WRITE'),
    ('CRM_USER','CRM_OPPORTUNITY_READ'),
    ('CRM_USER','CRM_TASK_READ'),
    ('CRM_USER','CRM_TASK_WRITE'),
    ('CRM_USER','CRM_PROCESS_DEF_READ'),
    ('CRM_USER','CRM_DASHBOARD_READ'),
    ('CRM_USER','PROCESS_DEF_READ'),
    ('CRM_USER','PROCESS_INSTANCE_READ'),

    -- ADMIN_SUPER: full CRM + core process
    ('ADMIN_SUPER','CRM_AGENT_READ'),
    ('ADMIN_SUPER','CRM_AGENT_WRITE'),
    ('ADMIN_SUPER','CRM_INTERACTION_READ'),
    ('ADMIN_SUPER','CRM_INTERACTION_WRITE'),
    ('ADMIN_SUPER','CRM_CASE_READ'),
    ('ADMIN_SUPER','CRM_CASE_WRITE'),
    ('ADMIN_SUPER','CRM_OPPORTUNITY_READ'),
    ('ADMIN_SUPER','CRM_OPPORTUNITY_WRITE'),
    ('ADMIN_SUPER','CRM_TASK_READ'),
    ('ADMIN_SUPER','CRM_TASK_WRITE'),
    ('ADMIN_SUPER','CRM_PROCESS_DEF_READ'),
    ('ADMIN_SUPER','CRM_PROCESS_DEF_WRITE'),
    ('ADMIN_SUPER','CRM_DASHBOARD_READ'),
    ('ADMIN_SUPER','PROCESS_DEF_READ'),
    ('ADMIN_SUPER','PROCESS_DEF_WRITE'),
    ('ADMIN_SUPER','PROCESS_INSTANCE_READ'),
    ('ADMIN_SUPER','PROCESS_INSTANCE_WRITE')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, rp.perm_code
FROM rp
JOIN roles r ON r.code = rp.role_code
ON CONFLICT DO NOTHING;

COMMIT;
