-- template_ecom_canonical_v1.sql
-- Purpose: make eip_ecom the canonical clone-ready ecommerce process baseline.

BEGIN;

DO $$
DECLARE
  template_tenant_id uuid;
  v_product_def_id uuid;
  v_order_def_id uuid;
  v_return_def_id uuid;
  v_refund_def_id uuid;
  v_payment_def_id uuid;
  v_content_def_id uuid;
BEGIN
  SELECT id INTO template_tenant_id
  FROM eip_core.tenant
  WHERE code = 'eip_ecom';

  IF template_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Template tenant eip_ecom not found';
  END IF;

  UPDATE eip_core.tenant
  SET name = 'EIP Ecommerce Template',
      attrs = COALESCE(attrs, '{}'::jsonb) || jsonb_build_object(
        'template', true,
        'industry', 'ecom',
        'template_kind', 'base',
        'canonical_clone_source', true,
        'baseline_version', 'v1',
        'baseline_objects', jsonb_build_array(
          'product',
          'sales_order',
          'payment',
          'return_request',
          'refund_request',
          'storefront_content'
        )
      ),
      is_active = true,
      updated_at = now()
  WHERE id = template_tenant_id;

  -- Ensure status values used by the content/publication process are available.
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
      ('rejected', 'Rejected', 65, '{"scope":"status","module":"ecom"}')
  ) AS v(code, label, sort_order, attrs)
  ON CONFLICT (list_id, code) DO UPDATE
  SET label = EXCLUDED.label,
      sort_order = EXCLUDED.sort_order,
      is_active = EXCLUDED.is_active,
      attrs = EXCLUDED.attrs,
      updated_at = now();

  -- Template-scoped effect governance. Cloned tenants receive this list.
  INSERT INTO eip_core.dropdown_list
    (tenant_id, module, code, name, version, is_active, attrs)
  VALUES (
    template_tenant_id,
    'core',
    'PROCESS_EFFECT_TYPE',
    'Ecommerce Process Effect Types',
    1,
    true,
    '{"ui":{"applies_to":["process_def.graph.transitions.effects"]},"scope":"ecom_template"}'::jsonb
  )
  ON CONFLICT (tenant_id, module, code, version) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = EXCLUDED.is_active,
      attrs = EXCLUDED.attrs,
      updated_at = now();

  INSERT INTO eip_core.dropdown_value
    (list_id, code, label, sort_order, is_active, attrs)
  SELECT
    dl.id,
    v.code,
    v.label,
    v.sort_order,
    true,
    v.attrs::jsonb
  FROM eip_core.dropdown_list dl
  JOIN (
    VALUES
      ('STATUS_SET', 'Status Set', 10, '{"group":"state","used_by":["product","order","payment","return","refund","content"]}'),
      ('JSON_MERGE', 'JSON Merge', 20, '{"group":"metadata","used_by":["product","order","payment","return","refund","content"]}'),
      ('CHILD_SERVICE_OBJECT_CREATE', 'Child Service Object Create', 30, '{"group":"object","used_by":["order"]}'),
      ('INSTANCE_START', 'Instance Start', 40, '{"group":"process","used_by":["order"],"note":"Used after child object creation to start the child flow."}'),
      ('ACCESS_GRANT_CREATE', 'Access Grant Create', 50, '{"group":"access","used_by":["order"]}'),
      ('VARIANT_INVENTORY_VALIDATE', 'Variant Inventory Validate', 60, '{"group":"inventory","used_by":["product"]}')
  ) AS v(code, label, sort_order, attrs) ON true
  WHERE dl.tenant_id = template_tenant_id
    AND dl.module = 'core'
    AND dl.code = 'PROCESS_EFFECT_TYPE'
    AND dl.version = 1
  ON CONFLICT (list_id, code) DO UPDATE
  SET label = EXCLUDED.label,
      sort_order = EXCLUDED.sort_order,
      is_active = EXCLUDED.is_active,
      attrs = EXCLUDED.attrs,
      updated_at = now();

  -- ==========================================================
  -- Product onboarding / review / publish
  -- ==========================================================
  INSERT INTO eip_core.process_def
    (tenant_id, code, name, version, is_active, graph, attrs)
  VALUES (
    template_tenant_id,
    'ECOM_PRODUCT_ONBOARDING',
    'Ecommerce Product Onboarding',
    1,
    true,
    $json${
      "version": 1,
      "object_type": "product",
      "initial_node": "product_intake",
      "nodes": [
        { "id": "product_intake", "type": "TRIGGER", "label": "Product Created" },
        { "id": "draft_enrich", "type": "HUMAN_TASK", "label": "Draft & Enrich", "on_enter": { "task_template_types": ["PRODUCT_DRAFT_ENRICH"] } },
        { "id": "qa_review", "type": "HUMAN_TASK", "label": "QA Review", "on_enter": { "task_template_types": ["PRODUCT_QA_REVIEW"] } },
        { "id": "publish_step", "type": "STEP", "label": "Publish" },
        { "id": "reject_step", "type": "STEP", "label": "Reject" },
        { "id": "completed", "type": "TERMINAL", "label": "Completed", "is_terminal": true }
      ],
      "transitions": [
        {
          "from": "product_intake",
          "to": "draft_enrich",
          "action": "INTAKE",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "STATUS_SET", "to": "in_progress" },
            { "type": "JSON_MERGE", "target": "material", "material_id": "$payload.material_id", "value": { "workflow": { "stage": "intake" } } }
          ]
        },
        {
          "from": "draft_enrich",
          "to": "qa_review",
          "action": "DRAFT_READY",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "VARIANT_INVENTORY_VALIDATE", "material_id": "$payload.material_id", "mode": "sync" },
            { "type": "JSON_MERGE", "target": "material", "material_id": "$payload.material_id", "value": { "workflow": { "stage": "review" } } }
          ]
        },
        {
          "from": "draft_enrich",
          "to": "reject_step",
          "action": "REJECT",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "JSON_MERGE", "target": "material", "material_id": "$payload.material_id", "value": { "workflow": { "outcome": "rejected" } } }
          ]
        },
        {
          "from": "qa_review",
          "to": "publish_step",
          "action": "APPROVE",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "JSON_MERGE", "target": "material", "material_id": "$payload.material_id", "value": { "workflow": { "outcome": "approved" } } }
          ]
        },
        {
          "from": "qa_review",
          "to": "reject_step",
          "action": "REJECT",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "JSON_MERGE", "target": "material", "material_id": "$payload.material_id", "value": { "workflow": { "outcome": "rejected" } } }
          ]
        },
        {
          "from": "publish_step",
          "to": "completed",
          "action": "PUBLISH",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "VARIANT_INVENTORY_VALIDATE", "material_id": "$payload.material_id", "mode": "sync" },
            { "type": "STATUS_SET", "to": "done" },
            { "type": "JSON_MERGE", "target": "material", "material_id": "$payload.material_id", "value": { "workflow": { "stage": "published" } } }
          ]
        },
        {
          "from": "publish_step",
          "to": "reject_step",
          "action": "REJECT",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "JSON_MERGE", "target": "material", "material_id": "$payload.material_id", "value": { "workflow": { "outcome": "rejected" } } }
          ]
        },
        {
          "from": "reject_step",
          "to": "completed",
          "action": "CANCEL",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "STATUS_SET", "to": "cancelled" },
            { "type": "JSON_MERGE", "target": "material", "material_id": "$payload.material_id", "value": { "workflow": { "stage": "rejected" } } }
          ]
        }
      ]
    }$json$::jsonb,
    $json${
      "module": "ecom",
      "object_type": "product",
      "canonical_template": true,
      "baseline_version": "v1",
      "description": "Product onboarding through draft enrichment, QA review, and publish/reject."
    }$json$::jsonb
  )
  ON CONFLICT (tenant_id, code, version) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = EXCLUDED.is_active,
      graph = EXCLUDED.graph,
      attrs = EXCLUDED.attrs,
      updated_at = now()
  RETURNING id INTO v_product_def_id;

  -- ==========================================================
  -- Sales order lifecycle with shipment/fulfilment stages
  -- ==========================================================
  INSERT INTO eip_core.process_def
    (tenant_id, code, name, version, is_active, graph, attrs)
  VALUES (
    template_tenant_id,
    'ECOM_SALES_ORDER_FLOW',
    'Ecommerce Sales Order Flow',
    1,
    true,
    $json${
      "version": 1,
      "object_type": "sales_order",
      "initial_node": "order_confirm",
      "nodes": [
        { "id": "order_confirm", "type": "HUMAN_TASK", "label": "Confirm Order", "on_enter": { "task_template_types": ["ORDER_CONFIRM_TASK"] } },
        { "id": "order_fulfillment", "type": "HUMAN_TASK", "label": "Fulfil Order", "on_enter": { "task_template_types": ["ORDER_FULFILLMENT_TASK"] } },
        { "id": "order_shipped", "type": "STEP", "label": "Shipped" },
        { "id": "order_delivered", "type": "STEP", "label": "Delivered" },
        { "id": "order_closed", "type": "TERMINAL", "label": "Closed", "is_terminal": true },
        { "id": "order_cancelled", "type": "TERMINAL", "label": "Cancelled", "is_terminal": true }
      ],
      "transitions": [
        {
          "from": "order_confirm",
          "to": "order_fulfillment",
          "action": "ORDER_CONFIRM",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "STATUS_SET", "to": "in_progress" },
            { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "confirmed" } } }
          ]
        },
        {
          "from": "order_confirm",
          "to": "order_cancelled",
          "action": "ORDER_CANCEL",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "STATUS_SET", "to": "cancelled" },
            { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "cancelled", "outcome": "cancelled" } } }
          ]
        },
        {
          "from": "order_fulfillment",
          "to": "order_shipped",
          "action": "ORDER_PACK",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "STATUS_SET", "to": "in_progress" },
            { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "packed" } } }
          ]
        },
        {
          "from": "order_fulfillment",
          "to": "order_closed",
          "action": "ORDER_FULFILL",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "ACCESS_GRANT_CREATE", "grant_type": "digital_delivery", "token_raw": "$payload.entitlement_token", "service_object_id": "$service_object_id", "attrs": { "source": "order_fulfillment" }, "allow_missing": true },
            { "type": "STATUS_SET", "to": "done" },
            { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "fulfilled", "outcome": "fulfilled" } } }
          ]
        },
        {
          "from": "order_fulfillment",
          "to": "order_cancelled",
          "action": "ORDER_CANCEL",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "STATUS_SET", "to": "cancelled" },
            { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "cancelled", "outcome": "cancelled" } } }
          ]
        },
        {
          "from": "order_shipped",
          "to": "order_delivered",
          "action": "ORDER_SHIP",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "STATUS_SET", "to": "in_progress" },
            { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "shipped" } } }
          ]
        },
        {
          "from": "order_shipped",
          "to": "order_cancelled",
          "action": "ORDER_CANCEL",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "STATUS_SET", "to": "cancelled" },
            { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "cancelled", "outcome": "cancelled" } } }
          ]
        },
        {
          "from": "order_delivered",
          "to": "order_delivered",
          "action": "ORDER_RETURN_REQUEST",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "CHILD_SERVICE_OBJECT_CREATE", "items": [
              {
                "as": "return_request",
                "object_type": "return_request",
                "status": "new",
                "title": "Return request",
                "attrs": { "order_id": "$service_object_id", "order_code": "$payload.order_code", "reason": "$payload.reason", "items": "$payload.items", "source": "order_transition" },
                "links": [
                  { "src_kind": "service_object", "src_id": "$created.return_request", "dst_kind": "service_object", "dst_id": "$service_object_id", "relation_type": "RETURN_FOR", "attrs": { "source": "order_transition" } }
                ]
              }
            ] },
            { "type": "INSTANCE_START", "service_object_id": "$created.return_request", "code": "ECOM_RETURN_FLOW", "version": 1, "idempotency_key_prefix": "return_from_order" },
            { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "return_requested": true } } }
          ]
        },
        {
          "from": "order_delivered",
          "to": "order_delivered",
          "action": "ORDER_REFUND_REQUEST",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "CHILD_SERVICE_OBJECT_CREATE", "items": [
              {
                "as": "refund_request",
                "object_type": "refund_request",
                "status": "new",
                "title": "Refund request",
                "attrs": { "order_id": "$service_object_id", "order_code": "$payload.order_code", "reason": "$payload.reason", "amount": "$payload.amount", "currency": "$payload.currency", "items": "$payload.items", "source": "order_transition" },
                "links": [
                  { "src_kind": "service_object", "src_id": "$created.refund_request", "dst_kind": "service_object", "dst_id": "$service_object_id", "relation_type": "REFUND_FOR", "attrs": { "source": "order_transition" } }
                ]
              }
            ] },
            { "type": "INSTANCE_START", "service_object_id": "$created.refund_request", "code": "ECOM_REFUND_FLOW", "version": 1, "idempotency_key_prefix": "refund_from_order" },
            { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "refund_requested": true } } }
          ]
        },
        {
          "from": "order_delivered",
          "to": "order_closed",
          "action": "ORDER_DELIVER",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "STATUS_SET", "to": "done" },
            { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "delivered", "outcome": "delivered" } } }
          ]
        },
        {
          "from": "order_delivered",
          "to": "order_closed",
          "action": "ORDER_FULFILL",
          "edge_type": "DEFAULT",
          "effects": [
            { "type": "ACCESS_GRANT_CREATE", "grant_type": "digital_delivery", "token_raw": "$payload.entitlement_token", "service_object_id": "$service_object_id", "attrs": { "source": "order_fulfillment" }, "allow_missing": true },
            { "type": "STATUS_SET", "to": "done" },
            { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "fulfilled", "outcome": "fulfilled" } } }
          ]
        }
      ]
    }$json$::jsonb,
    $json${
      "module": "ecom",
      "object_type": "sales_order",
      "canonical_template": true,
      "baseline_version": "v1",
      "description": "Sales order lifecycle covering confirmation, fulfilment, shipment, delivery, cancellation, and governed return/refund child creation."
    }$json$::jsonb
  )
  ON CONFLICT (tenant_id, code, version) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = EXCLUDED.is_active,
      graph = EXCLUDED.graph,
      attrs = EXCLUDED.attrs,
      updated_at = now()
  RETURNING id INTO v_order_def_id;

  -- ==========================================================
  -- Return lifecycle
  -- ==========================================================
  INSERT INTO eip_core.process_def
    (tenant_id, code, name, version, is_active, graph, attrs)
  VALUES (
    template_tenant_id,
    'ECOM_RETURN_FLOW',
    'Ecommerce Return Flow',
    1,
    true,
    $json${
      "version": 1,
      "object_type": "return_request",
      "initial_node": "return_intake",
      "nodes": [
        { "id": "return_intake", "type": "TRIGGER", "label": "Return Requested" },
        { "id": "return_review", "type": "HUMAN_TASK", "label": "Return Review", "on_enter": { "task_template_types": ["RETURN_REVIEW"] } },
        { "id": "return_receive", "type": "HUMAN_TASK", "label": "Receive Return", "on_enter": { "task_template_types": ["RETURN_RECEIVE_TASK"] } },
        { "id": "return_completed", "type": "TERMINAL", "label": "Completed", "is_terminal": true },
        { "id": "return_rejected", "type": "TERMINAL", "label": "Rejected", "is_terminal": true }
      ],
      "transitions": [
        { "from": "return_intake", "to": "return_review", "action": "RETURN_REQUEST", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "in_progress" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "requested" } } }
        ] },
        { "from": "return_review", "to": "return_receive", "action": "RETURN_APPROVE", "edge_type": "DEFAULT", "effects": [
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "approved" } } }
        ] },
        { "from": "return_review", "to": "return_rejected", "action": "RETURN_REJECT", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "cancelled" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "rejected", "outcome": "rejected" } } }
        ] },
        { "from": "return_receive", "to": "return_completed", "action": "RETURN_RECEIVE", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "done" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "received", "outcome": "completed" } } }
        ] }
      ]
    }$json$::jsonb,
    $json${
      "module": "ecom",
      "object_type": "return_request",
      "canonical_template": true,
      "baseline_version": "v1",
      "description": "Customer return workflow: request, review, receive, complete or reject."
    }$json$::jsonb
  )
  ON CONFLICT (tenant_id, code, version) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = EXCLUDED.is_active,
      graph = EXCLUDED.graph,
      attrs = EXCLUDED.attrs,
      updated_at = now()
  RETURNING id INTO v_return_def_id;

  -- ==========================================================
  -- Refund lifecycle
  -- ==========================================================
  INSERT INTO eip_core.process_def
    (tenant_id, code, name, version, is_active, graph, attrs)
  VALUES (
    template_tenant_id,
    'ECOM_REFUND_FLOW',
    'Ecommerce Refund Flow',
    1,
    true,
    $json${
      "version": 1,
      "object_type": "refund_request",
      "initial_node": "refund_intake",
      "nodes": [
        { "id": "refund_intake", "type": "TRIGGER", "label": "Refund Requested" },
        { "id": "refund_review", "type": "HUMAN_TASK", "label": "Refund Review", "on_enter": { "task_template_types": ["REFUND_REVIEW"] } },
        { "id": "refund_issue", "type": "HUMAN_TASK", "label": "Issue Refund", "on_enter": { "task_template_types": ["REFUND_ISSUE_TASK"] } },
        { "id": "refund_completed", "type": "TERMINAL", "label": "Completed", "is_terminal": true },
        { "id": "refund_rejected", "type": "TERMINAL", "label": "Rejected", "is_terminal": true }
      ],
      "transitions": [
        { "from": "refund_intake", "to": "refund_review", "action": "REFUND_REQUEST", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "in_progress" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "requested" } } }
        ] },
        { "from": "refund_review", "to": "refund_issue", "action": "REFUND_APPROVE", "edge_type": "DEFAULT", "effects": [
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "approved" } } }
        ] },
        { "from": "refund_review", "to": "refund_rejected", "action": "REFUND_REJECT", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "cancelled" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "rejected", "outcome": "rejected" } } }
        ] },
        { "from": "refund_issue", "to": "refund_completed", "action": "REFUND_ISSUE", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "done" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "issued", "outcome": "completed" } } }
        ] }
      ]
    }$json$::jsonb,
    $json${
      "module": "ecom",
      "object_type": "refund_request",
      "canonical_template": true,
      "baseline_version": "v1",
      "description": "Customer refund workflow: request, review, issue, complete or reject."
    }$json$::jsonb
  )
  ON CONFLICT (tenant_id, code, version) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = EXCLUDED.is_active,
      graph = EXCLUDED.graph,
      attrs = EXCLUDED.attrs,
      updated_at = now()
  RETURNING id INTO v_refund_def_id;

  -- ==========================================================
  -- Payment lifecycle
  -- ==========================================================
  INSERT INTO eip_core.process_def
    (tenant_id, code, name, version, is_active, graph, attrs)
  VALUES (
    template_tenant_id,
    'ECOM_PAYMENT_FLOW',
    'Ecommerce Payment Flow',
    1,
    true,
    $json${
      "version": 1,
      "object_type": "payment",
      "initial_node": "payment_review",
      "nodes": [
        { "id": "payment_review", "type": "HUMAN_TASK", "label": "Payment Review", "on_enter": { "task_template_types": ["PAYMENT_REVIEW"] } },
        { "id": "payment_authorized", "type": "STEP", "label": "Authorized" },
        { "id": "payment_completed", "type": "TERMINAL", "label": "Completed", "is_terminal": true },
        { "id": "payment_failed", "type": "TERMINAL", "label": "Failed", "is_terminal": true },
        { "id": "payment_cancelled", "type": "TERMINAL", "label": "Cancelled", "is_terminal": true }
      ],
      "transitions": [
        { "from": "payment_review", "to": "payment_authorized", "action": "PAYMENT_AUTHORIZE", "edge_type": "DEFAULT", "effects": [
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "authorized" } } }
        ] },
        { "from": "payment_review", "to": "payment_failed", "action": "PAYMENT_FAIL", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "cancelled" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "failed", "outcome": "failed" } } }
        ] },
        { "from": "payment_review", "to": "payment_cancelled", "action": "PAYMENT_CANCEL", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "cancelled" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "cancelled", "outcome": "cancelled" } } }
        ] },
        { "from": "payment_authorized", "to": "payment_completed", "action": "PAYMENT_CAPTURE", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "done" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "captured", "outcome": "captured" } } }
        ] },
        { "from": "payment_authorized", "to": "payment_failed", "action": "PAYMENT_FAIL", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "cancelled" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "failed", "outcome": "failed" } } }
        ] }
      ]
    }$json$::jsonb,
    $json${
      "module": "ecom",
      "object_type": "payment",
      "canonical_template": true,
      "baseline_version": "v1",
      "description": "Payment lifecycle for initiation, review/authorization, capture, failure, or cancellation."
    }$json$::jsonb
  )
  ON CONFLICT (tenant_id, code, version) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = EXCLUDED.is_active,
      graph = EXCLUDED.graph,
      attrs = EXCLUDED.attrs,
      updated_at = now()
  RETURNING id INTO v_payment_def_id;

  -- ==========================================================
  -- Content/publication baseline
  -- ==========================================================
  INSERT INTO eip_core.process_def
    (tenant_id, code, name, version, is_active, graph, attrs)
  VALUES (
    template_tenant_id,
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
        { "id": "content_review", "type": "HUMAN_TASK", "label": "Review", "on_enter": { "task_template_types": ["CONTENT_REVIEW"] } },
        { "id": "content_approved", "type": "STEP", "label": "Approved" },
        { "id": "content_published", "type": "STEP", "label": "Published" },
        { "id": "content_rejected", "type": "STEP", "label": "Rejected" },
        { "id": "content_closed", "type": "TERMINAL", "label": "Closed", "is_terminal": true }
      ],
      "transitions": [
        { "from": "content_intake", "to": "content_draft", "action": "INTAKE", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "new" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "draft" } } }
        ] },
        { "from": "content_draft", "to": "content_review", "action": "DRAFT_READY", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "review" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "review" } } }
        ] },
        { "from": "content_review", "to": "content_approved", "action": "APPROVE", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "approved" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "approved" } } }
        ] },
        { "from": "content_approved", "to": "content_published", "action": "PUBLISH", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "published" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "published" } } }
        ] },
        { "from": "content_draft", "to": "content_rejected", "action": "REJECT", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "rejected" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "rejected", "outcome": "rejected" } } }
        ] },
        { "from": "content_review", "to": "content_rejected", "action": "REJECT", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "rejected" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "rejected", "outcome": "rejected" } } }
        ] },
        { "from": "content_rejected", "to": "content_draft", "action": "INTAKE", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "new" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "draft" } } }
        ] },
        { "from": "content_published", "to": "content_draft", "action": "INTAKE", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "new" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "draft", "outcome": "pending_update", "republish_required": true } } }
        ] },
        { "from": "content_published", "to": "content_closed", "action": "CANCEL", "edge_type": "DEFAULT", "effects": [
          { "type": "STATUS_SET", "to": "cancelled" },
          { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "cancelled", "outcome": "cancelled" } } }
        ] }
      ]
    }$json$::jsonb,
    $json${
      "module": "ecom",
      "object_type": "storefront_content",
      "canonical_template": true,
      "baseline_version": "v1",
      "description": "Publication lifecycle for storefront content: draft, review, approve, publish, reject, cancel."
    }$json$::jsonb
  )
  ON CONFLICT (tenant_id, code, version) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = EXCLUDED.is_active,
      graph = EXCLUDED.graph,
      attrs = EXCLUDED.attrs,
      updated_at = now()
  RETURNING id INTO v_content_def_id;

  -- Canonical task templates.
  INSERT INTO eip_core.task_template
    (tenant_id, process_def_id, service_object_type, task_type, title, description, is_active, sort_order, attrs)
  VALUES
    (template_tenant_id, v_product_def_id, 'product', 'PRODUCT_DRAFT_ENRICH', 'Draft & enrich product', 'Complete content, taxonomy, media, compliance, pricing, inventory, channels, and localization.', true, 10, '{"assign":"owner","due_in_days":2,"allowed_actions":["TASK_START","TASK_COMPLETE","TASK_REQUEST_CHANGES","TASK_ADD_NOTE","TASK_ADD_ATTACHMENT"],"completion_action":"TASK_COMPLETE","ui":{"form_code":"product_master","layout":"full"},"routing":{"role":"CATALOG_EDITOR"},"sla":{"severity":"medium"}}'::jsonb),
    (template_tenant_id, v_product_def_id, 'product', 'PRODUCT_QA_REVIEW', 'QA review', 'Review product completeness, preview rendering, and approve or reject publishing.', true, 20, '{"assign":"owner","due_in_days":1,"allowed_actions":["TASK_APPROVE","TASK_REJECT","TASK_ADD_NOTE"],"completion_action":"TASK_APPROVE","ui":{"form_code":"product_review","layout":"compact"},"routing":{"role":"CATALOG_ADMIN"},"sla":{"severity":"high"}}'::jsonb),
    (template_tenant_id, v_order_def_id, 'sales_order', 'ORDER_CONFIRM_TASK', 'Confirm order', 'Verify order, buyer, payment expectation, and fulfilment readiness.', true, 10, '{"assign":"owner","due_in_days":1,"allowed_actions":["TASK_APPROVE","TASK_REJECT","TASK_ADD_NOTE"],"completion_action":"TASK_APPROVE","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"high"}}'::jsonb),
    (template_tenant_id, v_order_def_id, 'sales_order', 'ORDER_FULFILLMENT_TASK', 'Fulfil order', 'Pack, ship, deliver, or fulfil digital access for the order.', true, 20, '{"assign":"owner","due_in_days":2,"allowed_actions":["TASK_START","TASK_COMPLETE","TASK_ADD_NOTE","TASK_ADD_ATTACHMENT"],"completion_action":"TASK_COMPLETE","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"medium"}}'::jsonb),
    (template_tenant_id, v_payment_def_id, 'payment', 'PAYMENT_REVIEW', 'Review payment', 'Authorize, capture, fail, or cancel payment according to provider and order state.', true, 10, '{"assign":"owner","due_in_days":1,"allowed_actions":["TASK_APPROVE","TASK_REJECT","TASK_ADD_NOTE"],"completion_action":"TASK_APPROVE","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"high"}}'::jsonb),
    (template_tenant_id, v_return_def_id, 'return_request', 'RETURN_REVIEW', 'Review return request', 'Validate return eligibility and approve or reject.', true, 10, '{"assign":"owner","due_in_days":1,"allowed_actions":["TASK_APPROVE","TASK_REJECT","TASK_ADD_NOTE"],"completion_action":"TASK_APPROVE","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"high"}}'::jsonb),
    (template_tenant_id, v_return_def_id, 'return_request', 'RETURN_RECEIVE_TASK', 'Receive returned goods', 'Confirm receipt and close the return request.', true, 20, '{"assign":"owner","due_in_days":3,"allowed_actions":["TASK_START","TASK_COMPLETE","TASK_ADD_NOTE"],"completion_action":"TASK_COMPLETE","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"medium"}}'::jsonb),
    (template_tenant_id, v_refund_def_id, 'refund_request', 'REFUND_REVIEW', 'Review refund request', 'Validate refund amount, currency, reason, and approve or reject.', true, 10, '{"assign":"owner","due_in_days":1,"allowed_actions":["TASK_APPROVE","TASK_REJECT","TASK_ADD_NOTE"],"completion_action":"TASK_APPROVE","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"high"}}'::jsonb),
    (template_tenant_id, v_refund_def_id, 'refund_request', 'REFUND_ISSUE_TASK', 'Issue refund', 'Complete refund issuance and close the refund request.', true, 20, '{"assign":"owner","due_in_days":2,"allowed_actions":["TASK_START","TASK_COMPLETE","TASK_ADD_NOTE"],"completion_action":"TASK_COMPLETE","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"high"}}'::jsonb),
    (template_tenant_id, v_content_def_id, 'storefront_content', 'CONTENT_REVIEW', 'Review storefront content', 'Review and approve or reject storefront content before publication.', true, 10, '{"assign":"owner","due_in_days":1,"allowed_actions":["TASK_APPROVE","TASK_REJECT","TASK_ADD_NOTE"],"completion_action":"TASK_APPROVE","routing":{"role":"ECOM_ADMIN"},"sla":{"severity":"medium"}}'::jsonb)
  ON CONFLICT (tenant_id, process_def_id, COALESCE(service_object_type, ''), task_type)
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    attrs = EXCLUDED.attrs,
    updated_at = now();

  -- Keep canonical task surface tight for each rebuilt process.
  UPDATE eip_core.task_template
  SET is_active = false,
      updated_at = now()
  WHERE tenant_id = template_tenant_id
    AND (
      (process_def_id = v_product_def_id AND task_type NOT IN ('PRODUCT_DRAFT_ENRICH', 'PRODUCT_QA_REVIEW')) OR
      (process_def_id = v_order_def_id AND task_type NOT IN ('ORDER_CONFIRM_TASK', 'ORDER_FULFILLMENT_TASK')) OR
      (process_def_id = v_payment_def_id AND task_type NOT IN ('PAYMENT_REVIEW')) OR
      (process_def_id = v_return_def_id AND task_type NOT IN ('RETURN_REVIEW', 'RETURN_RECEIVE_TASK')) OR
      (process_def_id = v_refund_def_id AND task_type NOT IN ('REFUND_REVIEW', 'REFUND_ISSUE_TASK')) OR
      (process_def_id = v_content_def_id AND task_type NOT IN ('CONTENT_REVIEW'))
    );

  -- Canonical clone bindings.
  INSERT INTO eip_core.process_binding
    (tenant_id, service_object_type, process_def_id, is_active, priority, task_type, attrs)
  VALUES
    (template_tenant_id, 'product', v_product_def_id, true, 50, NULL, '{"source":"template_canonical_v1","apply_on_create":true}'::jsonb),
    (template_tenant_id, 'sales_order', v_order_def_id, true, 50, NULL, '{"source":"template_canonical_v1","apply_on_create":true}'::jsonb),
    (template_tenant_id, 'payment', v_payment_def_id, true, 50, NULL, '{"source":"template_canonical_v1","apply_on_create":true}'::jsonb),
    (template_tenant_id, 'return_request', v_return_def_id, true, 50, NULL, '{"source":"template_canonical_v1","apply_on_create":true}'::jsonb),
    (template_tenant_id, 'refund_request', v_refund_def_id, true, 50, NULL, '{"source":"template_canonical_v1","apply_on_create":true}'::jsonb),
    (template_tenant_id, 'storefront_content', v_content_def_id, true, 50, NULL, '{"source":"template_canonical_v1","apply_on_create":true}'::jsonb)
  ON CONFLICT (tenant_id, service_object_type, process_def_id, COALESCE(task_type, ''))
  DO UPDATE SET
    is_active = EXCLUDED.is_active,
    priority = EXCLUDED.priority,
    attrs = EXCLUDED.attrs,
    updated_at = now();
END $$;

COMMIT;
