-- 0149_perfect_fit_community_blog_process_binding.sql
-- Purpose:
--   Repair the original 0084 blog-process rollout for storefront tenants that
--   did not yet have an active product process binding when 0084 ran.
--
--   Perfect Fit Community Feedback uses the canonical blog_post process. A
--   connected storefront must therefore have ECOM_BLOG_POST_FLOW plus an
--   active blog_post process_binding. This migration is additive and does not
--   modify historical migration 0084.

BEGIN;

DO $$
DECLARE
  v_tenant_id uuid;
  v_blog_def_id uuid;
BEGIN
  FOR v_tenant_id IN
    SELECT t.id
    FROM eip_core.tenant t
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(t.attrs->'connection_profiles') = 'array'
          THEN t.attrs->'connection_profiles'
          ELSE '[]'::jsonb
        END
      ) AS profile
      WHERE
        profile->'identity'->'is_enabled' IS NULL
        OR lower(COALESCE(profile->'identity'->>'is_enabled', 'true')) IN ('true', '1', 'yes', 'on')
    )
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
          "description": "Lifecycle for storefront and Perfect Fit community blog posts.",
          "rollout_repair": "0149"
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
      '{"source":"migration-0149","apply_on_create":true,"surface":"storefront-community"}'::jsonb
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
        attrs = '{"source":"migration-0149","apply_on_create":true,"surface":"storefront-community"}'::jsonb,
        updated_at = now()
    WHERE pb.tenant_id = v_tenant_id
      AND pb.service_object_type = 'blog_post'
      AND pb.process_def_id = v_blog_def_id
      AND COALESCE(pb.task_type, '') = '';
  END LOOP;
END $$;

COMMIT;
