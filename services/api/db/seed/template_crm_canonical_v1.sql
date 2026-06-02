-- template_crm_canonical_v1.sql
-- Purpose: refresh CRM kernel metadata on the canonical eip_ecom clone source.
-- CRM dropdowns and UI descriptors remain governed global metadata so tenants
-- inherit their current published baseline without stale per-tenant copies.

BEGIN;

DO $$
DECLARE
  source_tenant_id uuid;
  template_tenant_id uuid;
  expected_process_count integer := 9;
  copied_process_count integer;
  copied_binding_count integer;
  mailbox_dropdown_count integer;
  mailbox_role_template_count integer;
BEGIN
  SELECT id INTO template_tenant_id
  FROM eip_core.tenant
  WHERE code='eip_ecom';

  IF template_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Template tenant eip_ecom not found';
  END IF;

  SELECT process_def.tenant_id INTO source_tenant_id
  FROM eip_core.process_def process_def
  JOIN eip_core.tenant tenant ON tenant.id=process_def.tenant_id
  WHERE process_def.tenant_id<>template_tenant_id
    AND process_def.is_active=true
    AND process_def.code IN (
      'CRM_INTERACTION_FLOW_V1',
      'CRM_CASE_FLOW_V1',
      'CRM_OPPORTUNITY_FLOW_V1',
      'CRM_LEAD_FLOW_V1',
      'CRM_CAMPAIGN_FLOW_V1',
      'CRM_SEGMENT_REVIEW_FLOW_V1',
      'CRM_INTAKE_REVIEW_FLOW_V1',
      'CRM_MAILBOX_MESSAGE_FLOW_V1',
      'CRM_REPLY_REVIEW_FLOW_V1'
    )
  GROUP BY process_def.tenant_id, tenant.code, tenant.created_at
  HAVING count(DISTINCT process_def.code)=expected_process_count
  ORDER BY (tenant.code='eip_demo') DESC, tenant.created_at ASC
  LIMIT 1;

  IF source_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Post-migration CRM process baseline source not found';
  END IF;

  INSERT INTO eip_core.process_def
    (tenant_id, code, name, version, is_active, graph, attrs)
  SELECT
    template_tenant_id, code, name, version, is_active, graph, attrs
  FROM eip_core.process_def
  WHERE tenant_id=source_tenant_id
    AND code IN (
      'CRM_INTERACTION_FLOW_V1',
      'CRM_CASE_FLOW_V1',
      'CRM_OPPORTUNITY_FLOW_V1',
      'CRM_LEAD_FLOW_V1',
      'CRM_CAMPAIGN_FLOW_V1',
      'CRM_SEGMENT_REVIEW_FLOW_V1',
      'CRM_INTAKE_REVIEW_FLOW_V1',
      'CRM_MAILBOX_MESSAGE_FLOW_V1',
      'CRM_REPLY_REVIEW_FLOW_V1'
    )
  ON CONFLICT (tenant_id, code, version) DO UPDATE
  SET name=EXCLUDED.name,
      is_active=EXCLUDED.is_active,
      graph=EXCLUDED.graph,
      attrs=EXCLUDED.attrs,
      updated_at=now();

  SELECT count(*)::integer INTO copied_process_count
  FROM eip_core.process_def
  WHERE tenant_id=template_tenant_id
    AND is_active=true
    AND code IN (
      'CRM_INTERACTION_FLOW_V1',
      'CRM_CASE_FLOW_V1',
      'CRM_OPPORTUNITY_FLOW_V1',
      'CRM_LEAD_FLOW_V1',
      'CRM_CAMPAIGN_FLOW_V1',
      'CRM_SEGMENT_REVIEW_FLOW_V1',
      'CRM_INTAKE_REVIEW_FLOW_V1',
      'CRM_MAILBOX_MESSAGE_FLOW_V1',
      'CRM_REPLY_REVIEW_FLOW_V1'
    );

  IF copied_process_count <> expected_process_count THEN
    RAISE EXCEPTION 'Canonical CRM template expected % process defs, found %',
      expected_process_count, copied_process_count;
  END IF;

  INSERT INTO eip_core.task_template
    (tenant_id, process_def_id, service_object_type, task_type, title, description, is_active, sort_order, attrs)
  SELECT
    template_tenant_id,
    target_def.id,
    task_template.service_object_type,
    task_template.task_type,
    task_template.title,
    task_template.description,
    task_template.is_active,
    task_template.sort_order,
    task_template.attrs
  FROM eip_core.task_template task_template
  JOIN eip_core.process_def source_def
    ON source_def.id=task_template.process_def_id
   AND source_def.tenant_id=source_tenant_id
  JOIN eip_core.process_def target_def
    ON target_def.tenant_id=template_tenant_id
   AND target_def.code=source_def.code
   AND target_def.version=source_def.version
  WHERE source_def.code IN (
    'CRM_INTERACTION_FLOW_V1',
    'CRM_CASE_FLOW_V1',
    'CRM_OPPORTUNITY_FLOW_V1',
    'CRM_LEAD_FLOW_V1',
    'CRM_CAMPAIGN_FLOW_V1',
    'CRM_SEGMENT_REVIEW_FLOW_V1',
    'CRM_INTAKE_REVIEW_FLOW_V1',
    'CRM_MAILBOX_MESSAGE_FLOW_V1',
    'CRM_REPLY_REVIEW_FLOW_V1'
  )
  ON CONFLICT (tenant_id, process_def_id, (COALESCE(service_object_type,'')), task_type) DO UPDATE
  SET title=EXCLUDED.title,
      description=EXCLUDED.description,
      is_active=EXCLUDED.is_active,
      sort_order=EXCLUDED.sort_order,
      attrs=EXCLUDED.attrs,
      updated_at=now();

  INSERT INTO eip_core.process_binding
    (tenant_id, service_object_type, process_def_id, is_active, priority, task_type, attrs)
  SELECT
    template_tenant_id,
    process_binding.service_object_type,
    target_def.id,
    process_binding.is_active,
    process_binding.priority,
    process_binding.task_type,
    process_binding.attrs
  FROM eip_core.process_binding process_binding
  JOIN eip_core.process_def source_def
    ON source_def.id=process_binding.process_def_id
   AND source_def.tenant_id=source_tenant_id
  JOIN eip_core.process_def target_def
    ON target_def.tenant_id=template_tenant_id
   AND target_def.code=source_def.code
   AND target_def.version=source_def.version
  WHERE source_def.code IN (
    'CRM_INTERACTION_FLOW_V1',
    'CRM_CASE_FLOW_V1',
    'CRM_OPPORTUNITY_FLOW_V1',
    'CRM_LEAD_FLOW_V1',
    'CRM_CAMPAIGN_FLOW_V1',
    'CRM_SEGMENT_REVIEW_FLOW_V1',
    'CRM_INTAKE_REVIEW_FLOW_V1',
    'CRM_MAILBOX_MESSAGE_FLOW_V1',
    'CRM_REPLY_REVIEW_FLOW_V1'
  )
  ON CONFLICT (tenant_id, service_object_type, process_def_id, (COALESCE(task_type,''))) DO UPDATE
  SET is_active=EXCLUDED.is_active,
      priority=EXCLUDED.priority,
      attrs=EXCLUDED.attrs,
      updated_at=now();

  SELECT count(*)::integer INTO copied_binding_count
  FROM eip_core.process_binding process_binding
  JOIN eip_core.process_def process_def ON process_def.id=process_binding.process_def_id
  WHERE process_binding.tenant_id=template_tenant_id
    AND process_binding.is_active=true
    AND process_def.code IN (
      'CRM_INTERACTION_FLOW_V1',
      'CRM_CASE_FLOW_V1',
      'CRM_OPPORTUNITY_FLOW_V1',
      'CRM_LEAD_FLOW_V1',
      'CRM_CAMPAIGN_FLOW_V1',
      'CRM_SEGMENT_REVIEW_FLOW_V1',
      'CRM_INTAKE_REVIEW_FLOW_V1',
      'CRM_MAILBOX_MESSAGE_FLOW_V1',
      'CRM_REPLY_REVIEW_FLOW_V1'
    );

  IF copied_binding_count < expected_process_count THEN
    RAISE EXCEPTION 'Canonical CRM template expected at least % bindings, found %',
      expected_process_count, copied_binding_count;
  END IF;

  INSERT INTO eip_core.tenant_module_setting
    (tenant_id, module, code, attrs, is_active)
  VALUES (
    template_tenant_id,
    'crm',
    'subscription',
    '{
      "capabilities":{
        "basic":true,
        "segments":true,
        "campaigns":true,
        "signals":true,
        "intelligence":true,
        "connectors":true,
        "intake":true,
        "mailbox":true
      },
      "intake_policy":{
        "automation_mode":"review_required",
        "auto_create_threshold":0.95,
        "review_threshold":0.6,
        "human_review_required":true
      },
      "ai_extraction_policy":{
        "ai_extraction_enabled":false,
        "provider":"",
        "model":"",
        "mode":"assistive",
        "human_review_required":true,
        "auto_convert_threshold":0.98,
        "pii_redaction_required":true
      }
    }'::jsonb,
    true
  )
  ON CONFLICT (tenant_id, module, code) DO UPDATE
  SET attrs=EXCLUDED.attrs,
      is_active=true,
      updated_at=now();

  SELECT count(*)::integer INTO mailbox_dropdown_count
  FROM eip_core.dropdown_list
  WHERE tenant_id IS NULL
    AND module='crm'
    AND code IN (
      'CRM_MAILBOX_PROVIDER',
      'CRM_MAILBOX_MESSAGE_STATUS',
      'CRM_MAILBOX_DIRECTION',
      'CRM_REPLY_STATUS'
    )
    AND is_active=true;

  IF mailbox_dropdown_count <> 4 THEN
    RAISE EXCEPTION 'Canonical CRM governance expected 4 mailbox dropdown lists, found %',
      mailbox_dropdown_count;
  END IF;

  SELECT count(*)::integer INTO mailbox_role_template_count
  FROM eip_authz.role_template_permission
  WHERE role_code='CRM_ADMIN'
    AND permission_code IN (
      'CRM_MAILBOX_READ',
      'CRM_MAILBOX_WRITE',
      'CRM_MAILBOX_REPLY_DRAFT',
      'CRM_MAILBOX_REPLY_SEND'
    );

  IF mailbox_role_template_count <> 4 THEN
    RAISE EXCEPTION 'Canonical CRM governance expected 4 CRM_ADMIN mailbox role grants, found %',
      mailbox_role_template_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM eip_core.ui_surface
    WHERE code='dashboard'
      AND is_active=true
      AND is_published=true
      AND tree::text LIKE '%"id": "mailbox"%'
      AND tree::text LIKE '%"id": "mailbox_replies"%'
  ) THEN
    RAISE EXCEPTION 'Published dashboard descriptor is missing CRM mailbox tabs';
  END IF;
END;
$$;

COMMIT;
