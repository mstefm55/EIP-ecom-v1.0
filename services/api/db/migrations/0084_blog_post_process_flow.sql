-- 0084_blog_post_process_flow.sql
-- Purpose: enforce process-driven lifecycle for storefront blog posts.

BEGIN;

-- Ensure service-object status values used by blog lifecycle exist.
WITH status_lists AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE code = 'SERVICE_OBJECT_STATUS'
    AND is_active = true
)
INSERT INTO eip_core.dropdown_value
  (list_id, code, label, sort_order, is_active, attrs)
SELECT
  sl.id,
  v.code,
  v.label,
  v.sort_order,
  true,
  v.attrs::jsonb
FROM status_lists sl
CROSS JOIN (
  VALUES
    ('cancelled', 'Cancelled', 90, '{"scope":"status","module":"ecom"}')
) AS v(code, label, sort_order, attrs)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    attrs = EXCLUDED.attrs,
    updated_at = now();

DO $$
DECLARE
  v_tenant_id uuid;
  v_blog_def_id uuid;
BEGIN
  -- Mirror existing tenant rollout pattern: tenants with active product bindings.
  FOR v_tenant_id IN
    SELECT DISTINCT pb.tenant_id
    FROM eip_core.process_binding pb
    WHERE pb.is_active = true
      AND pb.service_object_type = 'product'
  LOOP
    INSERT INTO eip_core.process_def
      (tenant_id, code, name, version, is_active, graph, attrs)
    VALUES
      (
        v_tenant_id,
        'ECOM_BLOG_POST_FLOW',
        'Ecommerce Blog Post Flow',
        1,
        true,
        $json${
          "version": 1,
          "object_type": "blog_post",
          "initial_node": "blog_intake",
          "nodes": [
            { "id": "blog_intake", "type": "TRIGGER", "label": "Blog Created" },
            { "id": "blog_draft", "type": "STEP", "label": "Draft" },
            { "id": "blog_published", "type": "STEP", "label": "Published" },
            { "id": "blog_rejected", "type": "STEP", "label": "Rejected" },
            { "id": "blog_closed", "type": "TERMINAL", "label": "Closed", "is_terminal": true }
          ],
          "transitions": [
            {
              "from": "blog_intake",
              "to": "blog_draft",
              "action": "INTAKE",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "new" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "draft" } } }
              ]
            },
            {
              "from": "blog_draft",
              "to": "blog_published",
              "action": "PUBLISH",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "published" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "published", "outcome": "approved" } } }
              ]
            },
            {
              "from": "blog_draft",
              "to": "blog_rejected",
              "action": "REJECT",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "rejected" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "rejected", "outcome": "rejected" } } }
              ]
            },
            {
              "from": "blog_published",
              "to": "blog_rejected",
              "action": "REJECT",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "rejected" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "rejected", "outcome": "rejected" } } }
              ]
            },
            {
              "from": "blog_rejected",
              "to": "blog_draft",
              "action": "INTAKE",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "new" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "draft" } } }
              ]
            },
            {
              "from": "blog_draft",
              "to": "blog_closed",
              "action": "CANCEL",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "cancelled" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "cancelled", "outcome": "cancelled" } } }
              ]
            },
            {
              "from": "blog_published",
              "to": "blog_closed",
              "action": "CANCEL",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "cancelled" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "cancelled", "outcome": "cancelled" } } }
              ]
            },
            {
              "from": "blog_rejected",
              "to": "blog_closed",
              "action": "CANCEL",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "cancelled" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "cancelled", "outcome": "cancelled" } } }
              ]
            }
          ]
        }$json$::jsonb,
        $json${
          "module": "ecom",
          "object_type": "blog_post",
          "description": "Lifecycle for member blog posts."
        }$json$::jsonb
      )
    ON CONFLICT (tenant_id, code, version) DO UPDATE
      SET name = EXCLUDED.name,
          is_active = EXCLUDED.is_active,
          graph = EXCLUDED.graph,
          attrs = EXCLUDED.attrs,
          updated_at = now()
    RETURNING id INTO v_blog_def_id;

    INSERT INTO eip_core.process_binding
      (tenant_id, service_object_type, process_def_id, is_active, priority, task_type, attrs)
    SELECT
      v_tenant_id,
      'blog_post',
      v_blog_def_id,
      true,
      50,
      NULL,
      '{"source":"migration-0084","apply_on_create":true}'::jsonb
    WHERE NOT EXISTS (
      SELECT 1
      FROM eip_core.process_binding pb
      WHERE pb.tenant_id = v_tenant_id
        AND pb.service_object_type = 'blog_post'
        AND pb.process_def_id = v_blog_def_id
        AND COALESCE(pb.task_type, '') = ''
    );

    UPDATE eip_core.process_binding pb
    SET is_active = true,
        priority = 50,
        attrs = '{"source":"migration-0084","apply_on_create":true}'::jsonb,
        updated_at = now()
    WHERE pb.tenant_id = v_tenant_id
      AND pb.service_object_type = 'blog_post'
      AND pb.process_def_id = v_blog_def_id
      AND COALESCE(pb.task_type, '') = '';
  END LOOP;
END $$;

COMMIT;
