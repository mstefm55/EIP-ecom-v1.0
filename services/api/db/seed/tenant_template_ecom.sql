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

UPDATE eip_core.tenant
SET name = 'EIP Ecommerce Template',
    attrs = COALESCE(attrs, '{}'::jsonb) || '{
      "template": true,
      "industry": "ecom",
      "template_kind": "base",
      "canonical_clone_source": true,
      "baseline_version": "v1",
      "notes": "Generic ecommerce baseline used to clone process/ui/config into new tenants."
    }'::jsonb,
    is_active = true,
    updated_at = now()
WHERE code = 'eip_ecom';

COMMIT;
