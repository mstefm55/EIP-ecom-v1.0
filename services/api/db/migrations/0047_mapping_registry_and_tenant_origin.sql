-- 0047_mapping_registry_and_tenant_origin.sql
-- Deprecated: allowlist + mapping are stored in existing tables.
-- - allowlist: eip_core.tenant.attrs.allowed_origins
-- - mapping: eip_core.ui_surface.attrs.mapping

BEGIN;
SELECT 1;
COMMIT;
