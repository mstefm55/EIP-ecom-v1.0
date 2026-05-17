BEGIN;

-- =========================================================
-- 1) Seed a minimal permission catalog (global strings)
--    Keep names stable: <module>.<resource>.<action>
-- =========================================================
INSERT INTO eip_authz.permission(code, label, description) VALUES
  -- Auth / Admin
  ('auth.device.read',   'View devices',   'List devices for the current identity'),
  ('auth.device.trust',  'Trust device',   'Mark a device as trusted (admin gated until full RBAC)'),
  ('auth.device.revoke', 'Revoke device',  'Revoke a device and invalidate its sessions'),

  -- AuthZ
  ('authz.bootstrap.read','Read bootstrap','Fetch UI bootstrap payload (surfaces, roles, menu, permissions)'),

  -- Core navigation basics
  ('core.home.read',     'View home',      'Access surface home routes'),

  -- Core master data (starter)
  ('core.agent.read',    'Read agents',    'View agents (entities)'),
  ('core.agent.write',   'Write agents',   'Create/update agents (entities)'),

  ('core.material.read', 'Read materials', 'View materials'),
  ('core.material.write','Write materials','Create/update materials'),

  -- Process / Task (starter)
  ('core.task.read',     'Read tasks',     'View tasks'),
  ('core.task.write',    'Write tasks',    'Create/update tasks'),

  ('core.process.read',  'Read processes', 'View process defs/instances'),
  ('core.process.write', 'Write processes','Create/update process defs/instances')
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- 2) Map permissions to seeded roles (demo tenant)
-- =========================================================
WITH roles AS (
  SELECT id, code
  FROM eip_authz.role
  WHERE tenant_id = (SELECT id FROM eip_core.tenant WHERE code = 'eip_demo')
    AND code IN ('ADMIN_SUPER','ERP_USER','PARTNER_USER','ECOM_USER')
),
rp(role_code, perm_code) AS (
  VALUES
    -- ADMIN_SUPER: everything in this seed set
    ('ADMIN_SUPER','auth.device.read'),
    ('ADMIN_SUPER','auth.device.trust'),
    ('ADMIN_SUPER','auth.device.revoke'),
    ('ADMIN_SUPER','authz.bootstrap.read'),
    ('ADMIN_SUPER','core.home.read'),
    ('ADMIN_SUPER','core.agent.read'),
    ('ADMIN_SUPER','core.agent.write'),
    ('ADMIN_SUPER','core.material.read'),
    ('ADMIN_SUPER','core.material.write'),
    ('ADMIN_SUPER','core.task.read'),
    ('ADMIN_SUPER','core.task.write'),
    ('ADMIN_SUPER','core.process.read'),
    ('ADMIN_SUPER','core.process.write'),

    -- ERP_USER: operational basics (no admin device actions)
    ('ERP_USER','authz.bootstrap.read'),
    ('ERP_USER','core.home.read'),
    ('ERP_USER','core.agent.read'),
    ('ERP_USER','core.material.read'),
    ('ERP_USER','core.task.read'),
    ('ERP_USER','core.process.read'),

    -- PARTNER_USER: start minimal (read-only shell for now)
    ('PARTNER_USER','authz.bootstrap.read'),
    ('PARTNER_USER','core.home.read'),

    -- ECOM_USER: start minimal (shop shell for now)
    ('ECOM_USER','authz.bootstrap.read'),
    ('ECOM_USER','core.home.read')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, rp.perm_code
FROM rp
JOIN roles r ON r.code = rp.role_code
ON CONFLICT DO NOTHING;

COMMIT;
