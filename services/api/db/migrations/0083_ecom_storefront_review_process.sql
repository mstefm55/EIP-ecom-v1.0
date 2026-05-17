-- 0083_ecom_storefront_review_process.sql
-- Purpose: process-driven lifecycle for storefront content and product reviews.

BEGIN;

-- Ensure required process actions are available.
WITH action_lists AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE code = 'PROCESS_ACTION'
    AND version = 1
    AND is_active = true
)
INSERT INTO eip_core.dropdown_value
  (list_id, code, label, sort_order, is_active, attrs)
SELECT
  al.id,
  v.code,
  v.label,
  v.sort_order,
  true,
  '{}'::jsonb
FROM action_lists al
CROSS JOIN (
  VALUES
    ('REVIEW_SUBMIT', 'Review submit', 305),
    ('HIDE', 'Hide', 306)
) AS v(code, label, sort_order)
ON CONFLICT (list_id, code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- Ensure status values used by storefront/review flows are valid for STATUS_SET effects.
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
    ('review', 'Review', 35, '{"scope":"status","module":"ecom"}'),
    ('approved', 'Approved', 45, '{"scope":"status","module":"ecom"}'),
    ('published', 'Published', 55, '{"scope":"status","module":"ecom"}'),
    ('rejected', 'Rejected', 65, '{"scope":"status","module":"ecom"}'),
    ('pending_review', 'Pending review', 70, '{"scope":"status","object_type":"product_review"}'),
    ('hidden', 'Hidden', 75, '{"scope":"status","object_type":"product_review"}'),
    ('visible', 'Visible', 76, '{"scope":"status","object_type":"product_review"}')
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
  v_content_def_id uuid;
  v_review_def_id uuid;
BEGIN
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
        'ECOM_STOREFRONT_CONTENT_FLOW',
        'Ecommerce Storefront Content Flow',
        1,
        true,
        $json${
          "version": 1,
          "object_type": "storefront_content",
          "initial_node": "content_intake",
          "nodes": [
            { "id": "content_intake", "type": "TRIGGER", "label": "Content Created" },
            { "id": "content_draft", "type": "STEP", "label": "Draft" },
            { "id": "content_review", "type": "STEP", "label": "Review" },
            { "id": "content_approved", "type": "STEP", "label": "Approved" },
            { "id": "content_published", "type": "STEP", "label": "Published" },
            { "id": "content_rejected", "type": "STEP", "label": "Rejected" },
            { "id": "content_closed", "type": "TERMINAL", "label": "Closed", "is_terminal": true }
          ],
          "transitions": [
            {
              "from": "content_intake",
              "to": "content_draft",
              "action": "INTAKE",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "new" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "draft" } } }
              ]
            },
            {
              "from": "content_draft",
              "to": "content_review",
              "action": "DRAFT_READY",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "review" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "review" } } }
              ]
            },
            {
              "from": "content_review",
              "to": "content_approved",
              "action": "APPROVE",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "approved" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "approved" } } }
              ]
            },
            {
              "from": "content_approved",
              "to": "content_published",
              "action": "PUBLISH",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "published" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "published" } } }
              ]
            },
            {
              "from": "content_draft",
              "to": "content_rejected",
              "action": "REJECT",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "rejected" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "rejected", "outcome": "rejected" } } }
              ]
            },
            {
              "from": "content_review",
              "to": "content_rejected",
              "action": "REJECT",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "rejected" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "rejected", "outcome": "rejected" } } }
              ]
            },
            {
              "from": "content_approved",
              "to": "content_rejected",
              "action": "REJECT",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "rejected" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "rejected", "outcome": "rejected" } } }
              ]
            },
            {
              "from": "content_published",
              "to": "content_rejected",
              "action": "REJECT",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "rejected" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "rejected", "outcome": "rejected" } } }
              ]
            },
            {
              "from": "content_rejected",
              "to": "content_draft",
              "action": "INTAKE",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "new" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "draft" } } }
              ]
            },
            {
              "from": "content_rejected",
              "to": "content_closed",
              "action": "CANCEL",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "cancelled" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "cancelled", "outcome": "cancelled" } } }
              ]
            },
            {
              "from": "content_published",
              "to": "content_closed",
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
          "object_type": "storefront_content",
          "description": "Lifecycle for storefront slots: draft, review, approve, publish, reject, cancel."
        }$json$::jsonb
      )
    ON CONFLICT (tenant_id, code, version) DO UPDATE
      SET name = EXCLUDED.name,
          is_active = EXCLUDED.is_active,
          graph = EXCLUDED.graph,
          attrs = EXCLUDED.attrs,
          updated_at = now()
    RETURNING id INTO v_content_def_id;

    INSERT INTO eip_core.process_def
      (tenant_id, code, name, version, is_active, graph, attrs)
    VALUES
      (
        v_tenant_id,
        'ECOM_PRODUCT_REVIEW_FLOW',
        'Ecommerce Product Review Flow',
        1,
        true,
        $json${
          "version": 1,
          "object_type": "product_review",
          "initial_node": "review_intake",
          "nodes": [
            { "id": "review_intake", "type": "TRIGGER", "label": "Review Created" },
            { "id": "review_pending", "type": "STEP", "label": "Pending Review" },
            { "id": "review_approved", "type": "STEP", "label": "Approved" },
            { "id": "review_hidden", "type": "STEP", "label": "Hidden" },
            { "id": "review_rejected", "type": "STEP", "label": "Rejected" }
          ],
          "transitions": [
            {
              "from": "review_intake",
              "to": "review_pending",
              "action": "REVIEW_SUBMIT",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "pending_review" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "pending_review" } } }
              ]
            },
            {
              "from": "review_pending",
              "to": "review_approved",
              "action": "APPROVE",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "approved" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "approved" } } }
              ]
            },
            {
              "from": "review_pending",
              "to": "review_hidden",
              "action": "HIDE",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "hidden" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "hidden" } } }
              ]
            },
            {
              "from": "review_pending",
              "to": "review_rejected",
              "action": "REJECT",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "rejected" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "rejected" } } }
              ]
            },
            {
              "from": "review_approved",
              "to": "review_hidden",
              "action": "HIDE",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "hidden" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "hidden" } } }
              ]
            },
            {
              "from": "review_hidden",
              "to": "review_approved",
              "action": "APPROVE",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "approved" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "approved" } } }
              ]
            },
            {
              "from": "review_hidden",
              "to": "review_rejected",
              "action": "REJECT",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "rejected" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "rejected" } } }
              ]
            },
            {
              "from": "review_rejected",
              "to": "review_approved",
              "action": "APPROVE",
              "edge_type": "DEFAULT",
              "effects": [
                { "type": "STATUS_SET", "to": "approved" },
                { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "approved" } } }
              ]
            }
          ]
        }$json$::jsonb,
        $json${
          "module": "ecom",
          "object_type": "product_review",
          "description": "Lifecycle for product reviews with moderation and visibility control."
        }$json$::jsonb
      )
    ON CONFLICT (tenant_id, code, version) DO UPDATE
      SET name = EXCLUDED.name,
          is_active = EXCLUDED.is_active,
          graph = EXCLUDED.graph,
          attrs = EXCLUDED.attrs,
          updated_at = now()
    RETURNING id INTO v_review_def_id;

    INSERT INTO eip_core.process_binding
      (tenant_id, service_object_type, process_def_id, is_active, priority, task_type, attrs)
    SELECT
      v_tenant_id,
      'storefront_content',
      v_content_def_id,
      true,
      50,
      NULL,
      '{"source":"migration-0083","apply_on_create":true}'::jsonb
    WHERE NOT EXISTS (
      SELECT 1
      FROM eip_core.process_binding pb
      WHERE pb.tenant_id = v_tenant_id
        AND pb.service_object_type = 'storefront_content'
        AND pb.process_def_id = v_content_def_id
        AND COALESCE(pb.task_type, '') = ''
    );

    UPDATE eip_core.process_binding pb
    SET is_active = true,
        priority = 50,
        attrs = '{"source":"migration-0083","apply_on_create":true}'::jsonb,
        updated_at = now()
    WHERE pb.tenant_id = v_tenant_id
      AND pb.service_object_type = 'storefront_content'
      AND pb.process_def_id = v_content_def_id
      AND COALESCE(pb.task_type, '') = '';

    INSERT INTO eip_core.process_binding
      (tenant_id, service_object_type, process_def_id, is_active, priority, task_type, attrs)
    SELECT
      v_tenant_id,
      'product_review',
      v_review_def_id,
      true,
      50,
      NULL,
      '{"source":"migration-0083","apply_on_create":true}'::jsonb
    WHERE NOT EXISTS (
      SELECT 1
      FROM eip_core.process_binding pb
      WHERE pb.tenant_id = v_tenant_id
        AND pb.service_object_type = 'product_review'
        AND pb.process_def_id = v_review_def_id
        AND COALESCE(pb.task_type, '') = ''
    );

    UPDATE eip_core.process_binding pb
    SET is_active = true,
        priority = 50,
        attrs = '{"source":"migration-0083","apply_on_create":true}'::jsonb,
        updated_at = now()
    WHERE pb.tenant_id = v_tenant_id
      AND pb.service_object_type = 'product_review'
      AND pb.process_def_id = v_review_def_id
      AND COALESCE(pb.task_type, '') = '';
  END LOOP;
END $$;

COMMIT;
