-- 0129_cross_module_hardening_v1.sql
-- Purpose: forward-only cross-module hardening repairs for released V1 modules.
-- No new tables. No destructive changes. Keeps Entity relationship metadata
-- aligned with the DB-driven UI descriptors.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.ensure_entity_relationship_value(
  p_code text,
  p_label text,
  p_sort_order integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  target_list_id uuid;
BEGIN
  SELECT dropdown_list.id INTO target_list_id
  FROM eip_core.dropdown_list dropdown_list
  WHERE dropdown_list.tenant_id IS NULL
    AND dropdown_list.module='entity_management'
    AND dropdown_list.code='ENTITY_RELATIONSHIP_TYPE'
    AND dropdown_list.version=1
  ORDER BY dropdown_list.created_at ASC
  LIMIT 1;

  IF target_list_id IS NULL THEN
    INSERT INTO eip_core.dropdown_list
      (tenant_id, module, code, name, version, is_active, attrs)
    VALUES
      (
        NULL,
        'entity_management',
        'ENTITY_RELATIONSHIP_TYPE',
        'Entity Relationship Type',
        1,
        true,
        '{"ui":{"module":"entity-management","scope":"entity_management_v1"},"extensible":true,"closed_enum":false}'::jsonb
      )
    RETURNING id INTO target_list_id;
  END IF;

  INSERT INTO eip_core.dropdown_value
    (list_id, code, label, sort_order, is_active, attrs)
  VALUES
    (
      target_list_id,
      p_code,
      p_label,
      p_sort_order,
      true,
      '{"source":"cross_module_hardening_v1","ui":{"module":"entity-management","scope":"entity_management_v1"}}'::jsonb
    )
  ON CONFLICT (list_id, code) DO UPDATE
    SET label=EXCLUDED.label,
        sort_order=EXCLUDED.sort_order,
        is_active=true,
        attrs=COALESCE(eip_core.dropdown_value.attrs,'{}'::jsonb) || EXCLUDED.attrs,
        updated_at=now();
END;
$$;

SELECT pg_temp.ensure_entity_relationship_value('SUPPLIER_OF', 'Supplier of', 80);
SELECT pg_temp.ensure_entity_relationship_value('CUSTOMER_OF', 'Customer of', 90);

COMMIT;
