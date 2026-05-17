-- 0090_translation_provider_openai.sql
-- Purpose: add OpenAI as translation provider option in tenant translation catalogs.

BEGIN;

WITH lists AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE module = 'ecom'
    AND code = 'TRANSLATION_PROVIDER'
    AND version = 1
    AND is_active = true
)
INSERT INTO eip_core.dropdown_value
  (list_id, code, label, sort_order, is_active, attrs)
SELECT
  l.id,
  'openai',
  'OpenAI',
  60,
  true,
  '{"requires_connection":false,"auth":"api_key","model_required":true}'::jsonb
FROM lists l
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    attrs = EXCLUDED.attrs,
    updated_at = now();

COMMIT;
