-- template_ecom_process.sql
-- Purpose: seed ecommerce product onboarding process into the eip_ecom template tenant.

BEGIN;

DO $$
DECLARE
  template_tenant_id uuid;
  v_process_def_id uuid;
  v_order_def_id uuid;
  v_return_def_id uuid;
  v_refund_def_id uuid;
  v_payment_def_id uuid;
BEGIN
  SELECT id INTO template_tenant_id
  FROM eip_core.tenant
  WHERE code = 'eip_ecom';

  IF template_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Template tenant eip_ecom not found';
  END IF;

  -- Process action taxonomy (template-scoped)
  INSERT INTO eip_core.dropdown_list
    (tenant_id, module, code, name, version, is_active, attrs)
  VALUES
    (template_tenant_id, 'core', 'PROCESS_ACTION', 'Process Actions', 1, true, '{}'::jsonb)
  ON CONFLICT (tenant_id, module, code, version) DO NOTHING;

  INSERT INTO eip_core.dropdown_value
    (list_id, code, label, sort_order, is_active, attrs)
  SELECT
    dl.id,
    v.code,
    v.label,
    v.sort_order,
    true,
    '{}'::jsonb
  FROM eip_core.dropdown_list dl
  JOIN (
    VALUES
      ('INTAKE', 'Intake', 10),
      ('DRAFT_READY', 'Draft ready', 20),
      ('APPROVE', 'Approve', 30),
      ('REJECT', 'Reject', 40),
      ('PUBLISH', 'Publish', 50),
      ('CANCEL', 'Cancel', 60),
      ('ORDER_CREATED', 'Order created', 70),
      ('ORDER_APPROVE', 'Order approve', 80),
      ('ORDER_REJECT', 'Order reject', 90),
      ('ORDER_FULFILL', 'Order fulfill', 100),
      ('ORDER_CANCEL', 'Order cancel', 110),
      ('ORDER_CONFIRM', 'Order confirm', 120),
      ('ORDER_PACK', 'Order pack', 130),
      ('ORDER_SHIP', 'Order ship', 140),
      ('ORDER_DELIVER', 'Order deliver', 150),
      ('ORDER_RETURN_REQUEST', 'Order return request', 160),
      ('ORDER_REFUND_REQUEST', 'Order refund request', 170),
      ('RETURN_REQUEST', 'Return request', 180),
      ('RETURN_APPROVE', 'Return approve', 190),
      ('RETURN_REJECT', 'Return reject', 200),
      ('RETURN_RECEIVE', 'Return receive', 210),
      ('REFUND_REQUEST', 'Refund request', 220),
      ('REFUND_APPROVE', 'Refund approve', 230),
      ('REFUND_REJECT', 'Refund reject', 240),
      ('REFUND_ISSUE', 'Refund issue', 250),
      ('PAYMENT_INITIATE', 'Payment initiate', 260),
      ('PAYMENT_AUTHORIZE', 'Payment authorize', 270),
      ('PAYMENT_CAPTURE', 'Payment capture', 280),
      ('PAYMENT_FAIL', 'Payment fail', 290),
      ('PAYMENT_CANCEL', 'Payment cancel', 300)
  ) AS v(code, label, sort_order) ON true
  WHERE dl.tenant_id = template_tenant_id
    AND dl.code = 'PROCESS_ACTION'
    AND dl.version = 1
  ON CONFLICT (list_id, code) DO NOTHING;

  INSERT INTO eip_core.process_def
    (tenant_id, code, name, version, is_active, graph, attrs)
  VALUES
    (
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
          {
            "id": "draft_enrich",
            "type": "HUMAN_TASK",
            "label": "Draft & Enrich",
            "on_enter": { "task_template_types": ["PRODUCT_DRAFT_ENRICH"] }
          },
          {
            "id": "qa_review",
            "type": "HUMAN_TASK",
            "label": "QA Review",
            "on_enter": { "task_template_types": ["PRODUCT_QA_REVIEW"] }
          },
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
        "description": "Streamlined onboarding for ecommerce products (single workspace + QA review + publish).",
        "stages": [
          "intake",
          "review",
          "published",
          "rejected",
          "completed"
        ],
        "notes": "Draft & Enrich collects all data; QA review approves or rejects before publish."
      }$json$::jsonb
    )
  ON CONFLICT (tenant_id, code, version) DO UPDATE
    SET name = EXCLUDED.name,
        is_active = EXCLUDED.is_active,
        graph = EXCLUDED.graph,
        attrs = EXCLUDED.attrs,
        updated_at = now()
  RETURNING id INTO v_process_def_id;

  INSERT INTO eip_core.task_template
    (tenant_id, process_def_id, service_object_type, task_type, title, description, is_active, sort_order, attrs)
  VALUES
    (
      template_tenant_id,
      v_process_def_id,
      'product',
      'PRODUCT_DRAFT_ENRICH',
      'Draft & enrich product',
      'Complete content, taxonomy, media, compliance, pricing, inventory, channels, and localization in one workspace.',
      true,
      10,
      '{"assign":"owner","due_in_days":2,"allowed_actions":["TASK_START","TASK_COMPLETE","TASK_REQUEST_CHANGES","TASK_ADD_NOTE","TASK_ADD_ATTACHMENT"],"completion_action":"TASK_COMPLETE","ui":{"form_code":"product_master","layout":"full"},"routing":{"role":"CATALOG_EDITOR"},"sla":{"severity":"medium"}}'::jsonb
    ),
    (
      template_tenant_id,
      v_process_def_id,
      'product',
      'PRODUCT_QA_REVIEW',
      'QA review',
      'Review completeness, preview rendering, and approve or reject publishing.',
      true,
      20,
      '{"assign":"owner","due_in_days":1,"allowed_actions":["TASK_APPROVE","TASK_REJECT","TASK_ADD_NOTE"],"completion_action":"TASK_APPROVE","ui":{"form_code":"product_review","layout":"compact"},"routing":{"role":"CATALOG_ADMIN"},"sla":{"severity":"high"}}'::jsonb
    )
  ON CONFLICT (tenant_id, process_def_id, COALESCE(service_object_type, ''), task_type)
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    attrs = EXCLUDED.attrs,
    updated_at = now();

  -- Deactivate legacy granular templates for this process (kept for history)
  UPDATE eip_core.task_template
  SET is_active = false,
      updated_at = now()
  WHERE tenant_id = template_tenant_id
    AND process_def_id = v_process_def_id
    AND task_type IN (
      'PRODUCT_CONTENT_ENRICH',
      'PRODUCT_TAXONOMY_REVIEW',
      'PRODUCT_MEDIA_REVIEW',
      'PRODUCT_COMPLIANCE_REVIEW',
      'PRODUCT_PRICING_REVIEW',
      'PRODUCT_INVENTORY_REVIEW',
      'PRODUCT_CHANNEL_MAPPING',
      'PRODUCT_LOCALIZATION',
      'PRODUCT_FINAL_APPROVAL'
    );

  INSERT INTO eip_core.process_binding
    (tenant_id, service_object_type, process_def_id, is_active, priority, task_type, attrs)
  VALUES
    (
      template_tenant_id,
      'product',
      v_process_def_id,
      true,
      50,
      NULL,
      '{"source":"template","apply_on_create":true}'::jsonb
    )
  ON CONFLICT (tenant_id, service_object_type, process_def_id, COALESCE(task_type, ''))
  DO UPDATE SET
    is_active = EXCLUDED.is_active,
    priority = EXCLUDED.priority,
    attrs = EXCLUDED.attrs,
    updated_at = now();

  -- ==========================================================
  -- Sales order fulfillment (minimal)
  -- ==========================================================
  INSERT INTO eip_core.process_def
    (tenant_id, code, name, version, is_active, graph, attrs)
  VALUES
    (
      template_tenant_id,
      'ECOM_SALES_ORDER_FLOW',
      'Ecommerce Sales Order Flow',
      1,
      true,
      $json${
        "version": 1,
        "object_type": "sales_order",
        "initial_node": "order_intake",
        "nodes": [
          { "id": "order_intake", "type": "TRIGGER", "label": "Order Created" },
          {
            "id": "order_confirm",
            "type": "AUTOMATION",
            "label": "Confirm Order"
          },
          {
            "id": "order_pack",
            "type": "AUTOMATION",
            "label": "Pack Order"
          },
          {
            "id": "order_ship",
            "type": "AUTOMATION",
            "label": "Ship Order"
          },
          { "id": "order_delivered", "type": "TERMINAL", "label": "Delivered", "is_terminal": true },
          { "id": "order_cancelled", "type": "TERMINAL", "label": "Cancelled", "is_terminal": true }
        ],
        "transitions": [
          {
            "from": "order_intake",
            "to": "order_confirm",
            "action": "ORDER_CREATED",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "in_progress" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "intake" } } }
            ]
          },
          {
            "from": "order_confirm",
            "to": "order_pack",
            "action": "ORDER_CONFIRM",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "in_progress" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "confirmed" } } }
            ]
          },
          {
            "from": "order_confirm",
            "to": "order_pack",
            "action": "ORDER_APPROVE",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "in_progress" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "confirmed" } } }
            ]
          },
          {
            "from": "order_confirm",
            "to": "order_cancelled",
            "action": "ORDER_REJECT",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "cancelled" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "outcome": "rejected" } } }
            ]
          },
          {
            "from": "order_confirm",
            "to": "order_cancelled",
            "action": "ORDER_CANCEL",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "cancelled" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "outcome": "cancelled" } } }
            ]
          },
          {
            "from": "order_pack",
            "to": "order_ship",
            "action": "ORDER_PACK",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "in_progress" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "packed" } } }
            ]
          },
          {
            "from": "order_pack",
            "to": "order_cancelled",
            "action": "ORDER_CANCEL",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "cancelled" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "outcome": "cancelled" } } }
            ]
          },
          {
            "from": "order_ship",
            "to": "order_delivered",
            "action": "ORDER_SHIP",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "in_progress" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "shipped" } } }
            ]
          },
          {
            "from": "order_ship",
            "to": "order_delivered",
            "action": "ORDER_DELIVER",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "done" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "delivered" } } }
            ]
          },
          {
            "from": "order_ship",
            "to": "order_delivered",
            "action": "ORDER_FULFILL",
            "edge_type": "DEFAULT",
            "effects": [
              {
                "type": "ACCESS_GRANT_CREATE",
                "grant_type": "digital_delivery",
                "token_raw": "$payload.entitlement_token",
                "service_object_id": "$service_object_id",
                "attrs": { "source": "order" },
                "allow_missing": true
              },
              { "type": "STATUS_SET", "to": "done" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "fulfilled" } } }
            ]
          },
          {
            "from": "order_ship",
            "to": "order_cancelled",
            "action": "ORDER_CANCEL",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "cancelled" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "outcome": "cancelled" } } }
            ]
          }
        ]
      }$json$::jsonb,
      $json${
        "module": "ecom",
        "object_type": "sales_order",
        "description": "Core sales order flow: confirm, pack, ship, deliver, or cancel.",
        "stages": [
          "intake",
          "confirmed",
          "packed",
          "shipped",
          "delivered",
          "fulfilled",
          "cancelled",
          "completed"
        ]
      }$json$::jsonb
    )
  ON CONFLICT (tenant_id, code, version) DO UPDATE
    SET name = EXCLUDED.name,
        is_active = EXCLUDED.is_active,
        graph = EXCLUDED.graph,
        attrs = EXCLUDED.attrs,
        updated_at = now()
  RETURNING id INTO v_order_def_id;

  -- Order steps are automated by default; keep any existing templates inactive
  UPDATE eip_core.task_template
  SET is_active = false,
      updated_at = now()
  WHERE tenant_id = template_tenant_id
    AND process_def_id = v_order_def_id
    AND task_type IN ('ORDER_CONFIRM', 'ORDER_FULFILL');

  INSERT INTO eip_core.process_binding
    (tenant_id, service_object_type, process_def_id, is_active, priority, task_type, attrs)
  VALUES
    (
      template_tenant_id,
      'sales_order',
      v_order_def_id,
      true,
      50,
      NULL,
      '{"source":"template","apply_on_create":true}'::jsonb
    )
  ON CONFLICT (tenant_id, service_object_type, process_def_id, COALESCE(task_type, ''))
  DO UPDATE SET
    is_active = EXCLUDED.is_active,
    priority = EXCLUDED.priority,
    attrs = EXCLUDED.attrs,
    updated_at = now();

  -- ==========================================================
  -- Returns (customer initiated)
  -- ==========================================================
  INSERT INTO eip_core.process_def
    (tenant_id, code, name, version, is_active, graph, attrs)
  VALUES
    (
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
          {
            "id": "return_review",
            "type": "HUMAN_TASK",
            "label": "Return Review",
            "on_enter": { "task_template_types": ["RETURN_REVIEW"] }
          },
          {
            "id": "return_receive",
            "type": "STEP",
            "label": "Receive Return"
          },
          { "id": "return_completed", "type": "TERMINAL", "label": "Completed", "is_terminal": true },
          { "id": "return_rejected", "type": "TERMINAL", "label": "Rejected", "is_terminal": true }
        ],
        "transitions": [
          {
            "from": "return_intake",
            "to": "return_review",
            "action": "RETURN_REQUEST",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "in_progress" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "requested" } } }
            ]
          },
          {
            "from": "return_review",
            "to": "return_receive",
            "action": "RETURN_APPROVE",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "approved" } } }
            ]
          },
          {
            "from": "return_review",
            "to": "return_rejected",
            "action": "RETURN_REJECT",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "cancelled" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "outcome": "rejected" } } }
            ]
          },
          {
            "from": "return_receive",
            "to": "return_completed",
            "action": "RETURN_RECEIVE",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "done" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "received" } } }
            ]
          }
        ]
      }$json$::jsonb,
      $json${
        "module": "ecom",
        "object_type": "return_request",
        "description": "Customer return workflow: request, review, receive, complete/reject.",
        "stages": [
          "requested",
          "approved",
          "received",
          "rejected",
          "completed"
        ]
      }$json$::jsonb
    )
  ON CONFLICT (tenant_id, code, version) DO UPDATE
    SET name = EXCLUDED.name,
        is_active = EXCLUDED.is_active,
        graph = EXCLUDED.graph,
        attrs = EXCLUDED.attrs,
        updated_at = now()
  RETURNING id INTO v_return_def_id;

  INSERT INTO eip_core.task_template
    (tenant_id, process_def_id, service_object_type, task_type, title, description, is_active, sort_order, attrs)
  VALUES
    (
      template_tenant_id,
      v_return_def_id,
      'return_request',
      'RETURN_REVIEW',
      'Review return request',
      'Review return request, validate eligibility, and approve or reject.',
      true,
      10,
      '{"assign":"owner","due_in_days":1,"allowed_actions":["TASK_APPROVE","TASK_REJECT","TASK_ADD_NOTE"],"completion_action":"TASK_APPROVE","routing":{"role":"CATALOG_ADMIN"},"sla":{"severity":"high"}}'::jsonb
    )
  ON CONFLICT (tenant_id, process_def_id, COALESCE(service_object_type, ''), task_type)
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    attrs = EXCLUDED.attrs,
    updated_at = now();

  INSERT INTO eip_core.process_binding
    (tenant_id, service_object_type, process_def_id, is_active, priority, task_type, attrs)
  VALUES
    (
      template_tenant_id,
      'return_request',
      v_return_def_id,
      true,
      50,
      NULL,
      '{"source":"template","apply_on_create":true}'::jsonb
    )
  ON CONFLICT (tenant_id, service_object_type, process_def_id, COALESCE(task_type, ''))
  DO UPDATE SET
    is_active = EXCLUDED.is_active,
    priority = EXCLUDED.priority,
    attrs = EXCLUDED.attrs,
    updated_at = now();

  -- ==========================================================
  -- Refunds (customer initiated)
  -- ==========================================================
  INSERT INTO eip_core.process_def
    (tenant_id, code, name, version, is_active, graph, attrs)
  VALUES
    (
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
          {
            "id": "refund_review",
            "type": "HUMAN_TASK",
            "label": "Refund Review",
            "on_enter": { "task_template_types": ["REFUND_REVIEW"] }
          },
          {
            "id": "refund_issue",
            "type": "STEP",
            "label": "Issue Refund"
          },
          { "id": "refund_completed", "type": "TERMINAL", "label": "Completed", "is_terminal": true },
          { "id": "refund_rejected", "type": "TERMINAL", "label": "Rejected", "is_terminal": true }
        ],
        "transitions": [
          {
            "from": "refund_intake",
            "to": "refund_review",
            "action": "REFUND_REQUEST",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "in_progress" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "requested" } } }
            ]
          },
          {
            "from": "refund_review",
            "to": "refund_issue",
            "action": "REFUND_APPROVE",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "approved" } } }
            ]
          },
          {
            "from": "refund_review",
            "to": "refund_rejected",
            "action": "REFUND_REJECT",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "cancelled" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "outcome": "rejected" } } }
            ]
          },
          {
            "from": "refund_issue",
            "to": "refund_completed",
            "action": "REFUND_ISSUE",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "done" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "issued" } } }
            ]
          }
        ]
      }$json$::jsonb,
      $json${
        "module": "ecom",
        "object_type": "refund_request",
        "description": "Customer refund workflow: request, review, issue, complete/reject.",
        "stages": [
          "requested",
          "approved",
          "issued",
          "rejected",
          "completed"
        ]
      }$json$::jsonb
    )
  ON CONFLICT (tenant_id, code, version) DO UPDATE
    SET name = EXCLUDED.name,
        is_active = EXCLUDED.is_active,
        graph = EXCLUDED.graph,
        attrs = EXCLUDED.attrs,
        updated_at = now()
  RETURNING id INTO v_refund_def_id;

  INSERT INTO eip_core.task_template
    (tenant_id, process_def_id, service_object_type, task_type, title, description, is_active, sort_order, attrs)
  VALUES
    (
      template_tenant_id,
      v_refund_def_id,
      'refund_request',
      'REFUND_REVIEW',
      'Review refund request',
      'Review refund request, validate eligibility, and approve or reject.',
      true,
      10,
      '{"assign":"owner","due_in_days":1,"allowed_actions":["TASK_APPROVE","TASK_REJECT","TASK_ADD_NOTE"],"completion_action":"TASK_APPROVE","routing":{"role":"CATALOG_ADMIN"},"sla":{"severity":"high"}}'::jsonb
    )
  ON CONFLICT (tenant_id, process_def_id, COALESCE(service_object_type, ''), task_type)
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    attrs = EXCLUDED.attrs,
    updated_at = now();

  INSERT INTO eip_core.process_binding
    (tenant_id, service_object_type, process_def_id, is_active, priority, task_type, attrs)
  VALUES
    (
      template_tenant_id,
      'refund_request',
      v_refund_def_id,
      true,
      50,
      NULL,
      '{"source":"template","apply_on_create":true}'::jsonb
    )
  ON CONFLICT (tenant_id, service_object_type, process_def_id, COALESCE(task_type, ''))
  DO UPDATE SET
    is_active = EXCLUDED.is_active,
    priority = EXCLUDED.priority,
    attrs = EXCLUDED.attrs,
    updated_at = now();

  -- ==========================================================
  -- Payment processing (minimal)
  -- ==========================================================
  INSERT INTO eip_core.process_def
    (tenant_id, code, name, version, is_active, graph, attrs)
  VALUES
    (
      template_tenant_id,
      'ECOM_PAYMENT_FLOW',
      'Ecommerce Payment Flow',
      1,
      true,
      $json${
        "version": 1,
        "object_type": "payment",
        "initial_node": "payment_intake",
        "nodes": [
          { "id": "payment_intake", "type": "TRIGGER", "label": "Payment Created" },
          {
            "id": "payment_authorize",
            "type": "AUTOMATION",
            "label": "Authorize Payment"
          },
          {
            "id": "payment_capture",
            "type": "AUTOMATION",
            "label": "Capture Payment"
          },
          { "id": "payment_failed", "type": "TERMINAL", "label": "Failed", "is_terminal": true },
          { "id": "payment_completed", "type": "TERMINAL", "label": "Completed", "is_terminal": true }
        ],
        "transitions": [
          {
            "from": "payment_intake",
            "to": "payment_authorize",
            "action": "PAYMENT_INITIATE",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "in_progress" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "initiated" } } }
            ]
          },
          {
            "from": "payment_authorize",
            "to": "payment_capture",
            "action": "PAYMENT_AUTHORIZE",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "authorized" } } }
            ]
          },
          {
            "from": "payment_authorize",
            "to": "payment_failed",
            "action": "PAYMENT_FAIL",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "cancelled" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "outcome": "failed" } } }
            ]
          },
          {
            "from": "payment_authorize",
            "to": "payment_failed",
            "action": "PAYMENT_CANCEL",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "cancelled" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "outcome": "cancelled" } } }
            ]
          },
          {
            "from": "payment_capture",
            "to": "payment_completed",
            "action": "PAYMENT_CAPTURE",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "done" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "outcome": "captured" } } }
            ]
          },
          {
            "from": "payment_capture",
            "to": "payment_failed",
            "action": "PAYMENT_FAIL",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "cancelled" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "outcome": "failed" } } }
            ]
          }
        ]
      }$json$::jsonb,
      $json${
        "module": "ecom",
        "object_type": "payment",
        "description": "Core payment flow: authorize, capture, or fail/cancel.",
        "stages": [
          "initiated",
          "authorized",
          "captured",
          "failed",
          "completed"
        ]
      }$json$::jsonb
    )
  ON CONFLICT (tenant_id, code, version) DO UPDATE
    SET name = EXCLUDED.name,
        is_active = EXCLUDED.is_active,
        graph = EXCLUDED.graph,
        attrs = EXCLUDED.attrs,
        updated_at = now()
  RETURNING id INTO v_payment_def_id;

  -- Payment steps are automated; keep any existing templates inactive
  UPDATE eip_core.task_template
  SET is_active = false,
      updated_at = now()
  WHERE tenant_id = template_tenant_id
    AND process_def_id = v_payment_def_id
    AND task_type IN ('PAYMENT_AUTHORIZE', 'PAYMENT_CAPTURE');

  INSERT INTO eip_core.process_binding
    (tenant_id, service_object_type, process_def_id, is_active, priority, task_type, attrs)
  VALUES
    (
      template_tenant_id,
      'payment',
      v_payment_def_id,
      true,
      50,
      NULL,
      '{"source":"template","apply_on_create":true}'::jsonb
    )
  ON CONFLICT (tenant_id, service_object_type, process_def_id, COALESCE(task_type, ''))
  DO UPDATE SET
    is_active = EXCLUDED.is_active,
    priority = EXCLUDED.priority,
    attrs = EXCLUDED.attrs,
    updated_at = now();
END $$;

COMMIT;
