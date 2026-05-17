-- tenant_template_ecom.sql
-- Purpose: create a generic ecommerce template tenant (industry baseline)

BEGIN;

INSERT INTO eip_core.tenant (code, name, attrs, is_active)
VALUES (
  'eip_ecom',
  'EIP Ecommerce Template',
  '{
    "template": true,
    "industry": "ecom",
    "template_kind": "base",
    "notes": "Generic ecommerce baseline used to clone process/ui/config into new tenants."
  }'::jsonb,
  true
)
ON CONFLICT (code) DO NOTHING;

COMMIT;
