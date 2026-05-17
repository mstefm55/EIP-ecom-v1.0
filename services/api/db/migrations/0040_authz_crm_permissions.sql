BEGIN;

-- =========================================================
-- CRM permissions (module-specific)
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
  ('CRM_DASHBOARD_READ',    'Read CRM dashboard',     'View CRM dashboard metrics')
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- CRM roles (demo tenant) + permission wiring
-- =========================================================
WITH tenant AS (
  SELECT id
  FROM eip_core.tenant
  WHERE code = 'eip_demo'
),
roles(code, label, surface_code, is_system) AS (
  VALUES
    ('CRM_ADMIN','CRM Admin','ERP', true),
    ('CRM_USER','CRM User','ERP', true)
)
INSERT INTO eip_authz.role(tenant_id, code, label, surface_code, is_system)
SELECT tenant.id, roles.code, roles.label, roles.surface_code, roles.is_system
FROM tenant
CROSS JOIN roles
ON CONFLICT (tenant_id, code) DO NOTHING;

WITH roles AS (
  SELECT id, code
  FROM eip_authz.role
  WHERE tenant_id = (SELECT id FROM eip_core.tenant WHERE code = 'eip_demo')
    AND code IN ('ADMIN_SUPER','CRM_ADMIN','CRM_USER')
),
rp(role_code, perm_code) AS (
  VALUES
    -- CRM_ADMIN: full CRM access
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

    -- ADMIN_SUPER: inherit CRM access for demo tenant
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
    ('ADMIN_SUPER','CRM_DASHBOARD_READ')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, rp.perm_code
FROM rp
JOIN roles r ON r.code = rp.role_code
ON CONFLICT DO NOTHING;

COMMIT;
