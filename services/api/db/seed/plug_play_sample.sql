-- plug_play_sample.sql
-- Seed sample SDUI template + mapping registry + demo service object for tenant 'eip'

DO $$
DECLARE
  t_id uuid;
  so_id uuid;
BEGIN
  SELECT id INTO t_id FROM eip_core.tenant WHERE code = 'eip';
  IF t_id IS NULL THEN
    RAISE NOTICE 'Tenant eip not found, skipping plug-play seed.';
    RETURN;
  END IF;

  UPDATE eip_core.tenant
  SET allowed_origins = ARRAY(
    SELECT DISTINCT unnest(allowed_origins || ARRAY['http://localhost:5173','http://127.0.0.1:5173'])
  )
  WHERE id = t_id;

  INSERT INTO eip_core.service_object (
    tenant_id,
    object_type,
    status,
    code,
    title,
    attrs
  )
  VALUES (
    t_id,
    'demo_case',
    'active',
    'PLUG-DEMO-001',
    'Plug & Play Demo',
    jsonb_build_object(
      'active_jobs', '24',
      'active_delta', 'up 6%',
      'queue_depth', '7',
      'queue_delta', 'down 2%',
      'sla_health', '99.5%',
      'sla_delta', 'up 0.2%',
      'contact_name', 'Operations Lead',
      'contact_email', 'ops@eip.local',
      'contact_note', 'Add any updates needed for this case.'
    )
  )
  ON CONFLICT (tenant_id, code)
  DO UPDATE SET
    status = EXCLUDED.status,
    title = EXCLUDED.title,
    attrs = EXCLUDED.attrs,
    updated_at = now()
  RETURNING id INTO so_id;

  IF so_id IS NULL THEN
    SELECT id INTO so_id
    FROM eip_core.service_object
    WHERE tenant_id = t_id AND code = 'PLUG-DEMO-001';
  END IF;

  INSERT INTO eip_core.mapping_registry (
    tenant_id,
    template_code,
    version,
    mapping,
    is_active
  )
  VALUES (
    t_id,
    'plug_demo',
    1,
    '{
      "tenant.name": "header.title",
      "tenant.code": "header.subtitle",
      "object.code": "header.ref",
      "object.attrs.active_jobs": "kpis.active",
      "object.attrs.active_delta": "kpis.delta",
      "object.attrs.queue_depth": "kpis.queue",
      "object.attrs.queue_delta": "kpis.queueDelta",
      "object.attrs.sla_health": "kpis.sla",
      "object.attrs.sla_delta": "kpis.slaDelta",
      "object.attrs.contact_name": "form.placeholders.name",
      "object.attrs.contact_email": "form.placeholders.email",
      "object.attrs.contact_note": "form.placeholders.note"
    }'::jsonb,
    true
  )
  ON CONFLICT (tenant_id, template_code, version)
  DO UPDATE SET
    mapping = EXCLUDED.mapping,
    is_active = true,
    updated_at = now();

  INSERT INTO eip_core.ui_surface (
    tenant_id,
    code,
    title,
    version,
    is_active,
    is_published,
    is_public,
    tree,
    attrs
  )
  VALUES (
    t_id,
    'plug_demo',
    'Plug & Play Demo',
    1,
    true,
    true,
    false,
    '{
      "id": "plug-shell",
      "type": "Box",
      "props": { "className": "space-y-4 p-6" },
      "children": [
        {
          "id": "plug-hero",
          "type": "Box",
          "props": {
            "className": "glass-panel rounded-2xl p-6",
            "title": "{{header.title}}",
            "subtitle": "{{header.subtitle}}"
          },
          "children": [
            {
              "id": "plug-ref",
              "type": "Text",
              "props": {
                "text": "Reference: {{header.ref}}",
                "className": "mt-2 text-xs uppercase tracking-[0.3em] text-ink-400"
              }
            }
          ]
        },
        {
          "id": "plug-kpis",
          "type": "Grid",
          "props": { "cols": 3, "className": "gap-3" },
          "children": [
            {
              "id": "kpi-active",
              "type": "StatCard",
              "props": {
                "label": "Active Jobs",
                "value": "{{kpis.active}}",
                "delta": "{{kpis.delta}}",
                "tone": "emerald"
              }
            },
            {
              "id": "kpi-queue",
              "type": "StatCard",
              "props": {
                "label": "Queue Depth",
                "value": "{{kpis.queue}}",
                "delta": "{{kpis.queueDelta}}",
                "tone": "indigo"
              }
            },
            {
              "id": "kpi-sla",
              "type": "StatCard",
              "props": {
                "label": "SLA Health",
                "value": "{{kpis.sla}}",
                "delta": "{{kpis.slaDelta}}",
                "tone": "cyan"
              }
            }
          ]
        },
        {
          "id": "plug-form",
          "type": "FormCard",
          "props": {
            "title": "Request Update",
            "subtitle": "Leave a note for the operations team.",
            "submitLabel": "Send request",
            "fields": [
              { "name": "contactName", "label": "Contact Name", "placeholder": "{{form.placeholders.name}}" },
              { "name": "contactEmail", "label": "Contact Email", "type": "email", "placeholder": "{{form.placeholders.email}}" },
              { "name": "note", "label": "Note", "placeholder": "{{form.placeholders.note}}" }
            ]
          }
        }
      ]
    }'::jsonb,
    jsonb_build_object('demo_object_id', so_id)
  )
  ON CONFLICT (tenant_id, code, version)
  DO UPDATE SET
    title = EXCLUDED.title,
    is_active = true,
    is_published = true,
    is_public = false,
    tree = EXCLUDED.tree,
    attrs = EXCLUDED.attrs,
    updated_at = now();
END $$;
