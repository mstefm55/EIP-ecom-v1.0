-- clone_template_to_tenant.sql
-- Purpose: clone a template tenant's configuration into a target tenant.
-- Edit source_code and target_code before running.

DO $$
DECLARE
  source_code text := 'eip_ecom';
  target_code text := 't_ed6019735b2f';
  source_id uuid;
  target_id uuid;
BEGIN
  SELECT id INTO source_id FROM eip_core.tenant WHERE code = source_code;
  SELECT id INTO target_id FROM eip_core.tenant WHERE code = target_code;

  IF source_id IS NULL THEN
    RAISE EXCEPTION 'Source tenant % not found', source_code;
  END IF;
  IF target_id IS NULL THEN
    RAISE EXCEPTION 'Target tenant % not found', target_code;
  END IF;

  -- 1) Dropdown lists
  INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
  SELECT target_id, module, code, name, version, is_active, attrs
  FROM eip_core.dropdown_list
  WHERE tenant_id = source_id
  ON CONFLICT (tenant_id, module, code, version) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = EXCLUDED.is_active,
      attrs = EXCLUDED.attrs,
      updated_at = now();

  -- 2) Dropdown values (mapped to target list_id)
  INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
  SELECT tgt_list.id, dv.code, dv.label, dv.sort_order, dv.is_active, dv.attrs
  FROM eip_core.dropdown_value dv
  JOIN eip_core.dropdown_list src_list
    ON src_list.id = dv.list_id
   AND src_list.tenant_id = source_id
  JOIN eip_core.dropdown_list tgt_list
    ON tgt_list.tenant_id = target_id
   AND tgt_list.module = src_list.module
   AND tgt_list.code = src_list.code
   AND tgt_list.version = src_list.version
  ON CONFLICT (list_id, code) DO UPDATE
  SET label = EXCLUDED.label,
      sort_order = EXCLUDED.sort_order,
      is_active = EXCLUDED.is_active,
      attrs = EXCLUDED.attrs,
      updated_at = now();

  -- 3) Schema registry (UI + validation metadata)
  INSERT INTO eip_core.schema_registry
    (tenant_id, module, object_kind, object_type, version, is_active, schema_json, ui_json)
  SELECT
    target_id, module, object_kind, object_type, version, is_active, schema_json, ui_json
  FROM eip_core.schema_registry
  WHERE tenant_id = source_id
  ON CONFLICT (tenant_id, module, object_kind, object_type, version) DO UPDATE
  SET is_active = EXCLUDED.is_active,
      schema_json = EXCLUDED.schema_json,
      ui_json = EXCLUDED.ui_json,
      updated_at = now();

  -- 4) Schema bundles (prebuilt UI bundles)
  INSERT INTO eip_core.schema_bundle
    (tenant_id, module, version, is_published, bundle_json, etag)
  SELECT
    target_id, module, version, is_published, bundle_json, etag
  FROM eip_core.schema_bundle
  WHERE tenant_id = source_id
  ON CONFLICT (tenant_id, module, version) DO UPDATE
  SET is_published = EXCLUDED.is_published,
      bundle_json = EXCLUDED.bundle_json,
      etag = EXCLUDED.etag,
      updated_at = now();

  -- 5) Process definitions
  INSERT INTO eip_core.process_def
    (tenant_id, code, name, version, is_active, graph, attrs)
  SELECT
    target_id, code, name, version, is_active, graph, attrs
  FROM eip_core.process_def
  WHERE tenant_id = source_id
  ON CONFLICT (tenant_id, code, version) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = EXCLUDED.is_active,
      graph = EXCLUDED.graph,
      attrs = EXCLUDED.attrs,
      updated_at = now();

  -- 6) Task templates (mapped by process_def code/version)
  INSERT INTO eip_core.task_template
    (tenant_id, process_def_id, service_object_type, task_type, title, description, is_active, sort_order, attrs)
  SELECT
    target_id,
    tgt_def.id,
    tt.service_object_type,
    tt.task_type,
    tt.title,
    tt.description,
    tt.is_active,
    tt.sort_order,
    tt.attrs
  FROM eip_core.task_template tt
  JOIN eip_core.process_def src_def
    ON src_def.id = tt.process_def_id
   AND src_def.tenant_id = source_id
  JOIN eip_core.process_def tgt_def
    ON tgt_def.tenant_id = target_id
   AND tgt_def.code = src_def.code
   AND tgt_def.version = src_def.version
  ON CONFLICT (tenant_id, process_def_id, COALESCE(service_object_type, ''), task_type) DO UPDATE
  SET title = EXCLUDED.title,
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active,
      sort_order = EXCLUDED.sort_order,
      attrs = EXCLUDED.attrs,
      updated_at = now();

  -- 7) Process bindings (mapped by process_def code/version)
  INSERT INTO eip_core.process_binding
    (tenant_id, service_object_type, process_def_id, is_active, priority, task_type, attrs)
  SELECT
    target_id,
    pb.service_object_type,
    tgt_def.id,
    pb.is_active,
    pb.priority,
    pb.task_type,
    pb.attrs
  FROM eip_core.process_binding pb
  JOIN eip_core.process_def src_def
    ON src_def.id = pb.process_def_id
   AND src_def.tenant_id = source_id
  JOIN eip_core.process_def tgt_def
    ON tgt_def.tenant_id = target_id
   AND tgt_def.code = src_def.code
   AND tgt_def.version = src_def.version
  ON CONFLICT (tenant_id, service_object_type, process_def_id, COALESCE(task_type, '')) DO UPDATE
  SET is_active = EXCLUDED.is_active,
      priority = EXCLUDED.priority,
      attrs = EXCLUDED.attrs,
      updated_at = now();

  -- 8) UI surfaces
  INSERT INTO eip_core.ui_surface
    (tenant_id, code, title, version, is_active, is_published, is_public, tree, attrs)
  SELECT
    target_id, code, title, version, is_active, is_published, is_public, tree, attrs
  FROM eip_core.ui_surface
  WHERE tenant_id = source_id
  ON CONFLICT (tenant_id, code, version) DO UPDATE
  SET title = EXCLUDED.title,
      is_active = EXCLUDED.is_active,
      is_published = EXCLUDED.is_published,
      is_public = EXCLUDED.is_public,
      tree = EXCLUDED.tree,
      attrs = EXCLUDED.attrs,
      updated_at = now();

  -- 9) Commercial conditions
  INSERT INTO eip_core.commercial_condition
    (tenant_id, code, label, condition_type, condition_category, priority, valid_from, valid_to, is_active, scope, effect, attrs)
  SELECT
    target_id, code, label, condition_type, condition_category, priority, valid_from, valid_to, is_active, scope, effect, attrs
  FROM eip_core.commercial_condition
  WHERE tenant_id = source_id
  ON CONFLICT (tenant_id, code) DO UPDATE
  SET label = EXCLUDED.label,
      condition_type = EXCLUDED.condition_type,
      condition_category = EXCLUDED.condition_category,
      priority = EXCLUDED.priority,
      valid_from = EXCLUDED.valid_from,
      valid_to = EXCLUDED.valid_to,
      is_active = EXCLUDED.is_active,
      scope = EXCLUDED.scope,
      effect = EXCLUDED.effect,
      attrs = EXCLUDED.attrs,
      updated_at = now();
END $$;
