-- 0093_tenant_user_role_baseline.sql
-- Purpose: keep Admin > Users & Roles populated for existing and future tenant onboarding.

BEGIN;

INSERT INTO eip_authz.surface(code, label, sort_order) VALUES
  ('ADMIN','Admin',10),
  ('ERP','ERP',20),
  ('PARTNER','Partner Portal',30),
  ('ECOM','E-Commerce',40)
ON CONFLICT (code) DO NOTHING;

WITH role_defs(code, label, surface_code, is_system) AS (
  VALUES
    ('ECOM_ADMIN', 'ECOM Admin', 'ERP', true),
    ('ECOM_USER', 'ECOM User', 'ECOM', true),
    ('ERP_USER', 'ERP User', 'ERP', true),
    ('PARTNER_USER', 'Partner User', 'PARTNER', true),
    ('CRM_ADMIN', 'CRM Admin', 'ERP', true),
    ('CRM_USER', 'CRM User', 'ERP', true)
)
INSERT INTO eip_authz.role(tenant_id, code, label, surface_code, is_system, is_active)
SELECT t.id, r.code, r.label, r.surface_code, r.is_system, true
FROM eip_core.tenant t
CROSS JOIN role_defs r
ON CONFLICT (tenant_id, code) DO NOTHING;

WITH bundles(role_code, permission_code) AS (
  VALUES
    ('ECOM_ADMIN', 'ECOM_PRODUCT_READ'),
    ('ECOM_ADMIN', 'ECOM_PRODUCT_WRITE'),
    ('ECOM_ADMIN', 'ECOM_REVIEW_READ'),
    ('ECOM_ADMIN', 'ECOM_REVIEW_MODERATE'),
    ('ECOM_ADMIN', 'ECOM_ORDER_READ'),
    ('ECOM_ADMIN', 'ECOM_ORDER_WRITE'),
    ('ECOM_ADMIN', 'ECOM_RETURN_READ'),
    ('ECOM_ADMIN', 'ECOM_RETURN_WRITE'),
    ('ECOM_ADMIN', 'ECOM_REFUND_READ'),
    ('ECOM_ADMIN', 'ECOM_REFUND_WRITE'),
    ('ECOM_ADMIN', 'ECOM_SETTINGS_WRITE'),
    ('ECOM_ADMIN', 'tenant.admin_access.read'),
    ('ECOM_ADMIN', 'tenant.admin_access.write'),
    ('ECOM_USER', 'ECOM_PRODUCT_READ'),
    ('ECOM_USER', 'ECOM_ORDER_READ'),
    ('ECOM_USER', 'ECOM_RETURN_READ'),
    ('ECOM_USER', 'ECOM_REFUND_READ'),
    ('ERP_USER', 'authz.bootstrap.read'),
    ('ERP_USER', 'core.home.read'),
    ('ERP_USER', 'core.agent.read'),
    ('ERP_USER', 'core.material.read'),
    ('ERP_USER', 'core.task.read'),
    ('ERP_USER', 'core.process.read'),
    ('ERP_USER', 'ECOM_PRODUCT_READ'),
    ('ERP_USER', 'ECOM_PRODUCT_WRITE'),
    ('ERP_USER', 'ECOM_ORDER_READ'),
    ('ERP_USER', 'ECOM_ORDER_WRITE'),
    ('ERP_USER', 'ECOM_RETURN_READ'),
    ('ERP_USER', 'ECOM_RETURN_WRITE'),
    ('ERP_USER', 'ECOM_REFUND_READ'),
    ('ERP_USER', 'ECOM_REFUND_WRITE'),
    ('PARTNER_USER', 'authz.bootstrap.read'),
    ('PARTNER_USER', 'core.home.read'),
    ('CRM_ADMIN', 'CRM_AGENT_READ'),
    ('CRM_ADMIN', 'CRM_AGENT_WRITE'),
    ('CRM_ADMIN', 'CRM_INTERACTION_READ'),
    ('CRM_ADMIN', 'CRM_INTERACTION_WRITE'),
    ('CRM_ADMIN', 'CRM_CASE_READ'),
    ('CRM_ADMIN', 'CRM_CASE_WRITE'),
    ('CRM_ADMIN', 'CRM_OPPORTUNITY_READ'),
    ('CRM_ADMIN', 'CRM_OPPORTUNITY_WRITE'),
    ('CRM_ADMIN', 'CRM_TASK_READ'),
    ('CRM_ADMIN', 'CRM_TASK_WRITE'),
    ('CRM_ADMIN', 'CRM_DASHBOARD_READ'),
    ('CRM_ADMIN', 'PROCESS_DEF_READ'),
    ('CRM_ADMIN', 'PROCESS_DEF_WRITE'),
    ('CRM_ADMIN', 'PROCESS_INSTANCE_READ'),
    ('CRM_ADMIN', 'PROCESS_INSTANCE_WRITE'),
    ('CRM_USER', 'CRM_AGENT_READ'),
    ('CRM_USER', 'CRM_INTERACTION_READ'),
    ('CRM_USER', 'CRM_INTERACTION_WRITE'),
    ('CRM_USER', 'CRM_CASE_READ'),
    ('CRM_USER', 'CRM_CASE_WRITE'),
    ('CRM_USER', 'CRM_OPPORTUNITY_READ'),
    ('CRM_USER', 'CRM_TASK_READ'),
    ('CRM_USER', 'CRM_TASK_WRITE'),
    ('CRM_USER', 'CRM_DASHBOARD_READ'),
    ('CRM_USER', 'PROCESS_DEF_READ'),
    ('CRM_USER', 'PROCESS_INSTANCE_READ')
)
INSERT INTO eip_authz.role_permission(role_id, permission_code)
SELECT r.id, p.code
FROM eip_authz.role r
JOIN bundles b ON b.role_code = r.code
JOIN eip_authz.permission p ON p.code = b.permission_code
ON CONFLICT DO NOTHING;

COMMIT;
