import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyInventoryMovement,
  buildReorderSuggestionPayload,
  mergeInventoryPolicy,
  normalizeInventoryProfile,
  normalizeInventoryTaskType,
  normalizeMovement,
  resolveInventoryPolicy
} from "../src/services/inventory/inventoryFoundation.js";
import { composeInventorySignalWorkbench } from "../src/services/inventory/inventoryWorkbench.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const route = read("../src/routes/inventory.js");
const workbenchService = read("../src/services/inventory/inventoryWorkbench.js");
const server = read("../src/server.js");
const migration = read("../db/migrations/0108_inventory_reorder_foundation.sql");
const recommendationMigration = read("../db/migrations/0109_inventory_recommendation_policy_addendum.sql");
const commercialConditionMigration = read("../db/migrations/0110_inventory_commercial_condition_policy.sql");
const surfaceSeed = read("../db/seed/ui_surface_dashboard.sql");
const cloneSql = read("../db/seed/clone_template_to_tenant.sql");
const adminCloneRoute = read("../src/routes/admin_template_clone.js");
const registry = read("../../../apps/dashboard/src/engine/registry.jsx");
const dashboardSurface = read("../../../apps/dashboard/src/engine/surfaces/dashboard.js");
const workspace = read("../../../apps/dashboard/src/components/inventory/InventoryWorkspace.jsx");
const paymentDocs = read("../../../docs/payment_checkout_foundation_v1.md");

test("inventory stock profile normalizes existing ECOM inventory attrs and detects low stock", () => {
  const material = {
    id: "mat-1",
    code: "SKU-1",
    name: "Oak board",
    material_type: "PRODUCT",
    attrs: {
      inventory: {
        track_inventory: true,
        on_hand: 4,
        available_qty: 2,
        reserved_qty: 2,
        reorder_point: 5,
        reorder_qty: 20,
        unit_of_measure: "pcs"
      }
    }
  };

  const profile = normalizeInventoryProfile(material);
  assert.equal(profile.track_stock, true);
  assert.equal(profile.stock_on_hand, 4);
  assert.equal(profile.available_qty, 2);
  assert.equal(profile.stock_status, "low_stock");
  assert.equal(profile.needs_reorder, true);
  assert.equal(profile.suggested_qty, 20);
  assert.deepEqual(profile.signals.includes("available_below_reorder_point"), true);
});

test("inventory movements update balances and movement record without a new movement table", () => {
  const base = { inventory: { track_stock: true, stock_on_hand: 10, reserved_qty: 1, available_qty: 9 } };
  const normalized = normalizeMovement({
    movement_type: "sale_reservation",
    direction: "reserve",
    quantity: 3,
    unit_of_measure: "pcs",
    reason: "Order hold"
  });
  assert.equal(normalized.ok, true);

  const applied = applyInventoryMovement(base, normalized.movement);
  assert.equal(applied.attrs.inventory.stock_on_hand, 10);
  assert.equal(applied.attrs.inventory.reserved_qty, 4);
  assert.equal(applied.attrs.inventory.available_qty, 6);
  assert.equal(applied.movement_record.balance_after, 10);
  assert.equal(applied.movement_record.available_after, 6);
});

test("policy merge preserves existing quantity source while adding reorder governance", () => {
  const attrs = { inventory: { track_inventory: true, on_hand: 12, available_qty: 10 } };
  const next = mergeInventoryPolicy(attrs, {
    reorder_point: 5,
    reorder_qty: 18,
    unit_of_measure: "pcs",
    preferred_supplier_agent_id: "supplier-agent"
  });
  assert.equal(next.inventory.on_hand, 12);
  assert.equal(next.inventory.available_qty, 10);
  assert.equal(next.inventory.reorder_point, 5);
  assert.equal(next.inventory.reorder_qty, 18);
  assert.equal(next.inventory.preferred_supplier_agent_id, "supplier-agent");
});

test("commercial condition reorder policy resolves defaults, scoped overrides, and allowed material overrides", () => {
  const conditions = [
    {
      code: "INV_REORDER_DEFAULT",
      condition_type: "INVENTORY_REORDER_POLICY",
      condition_category: "INVENTORY",
      priority: 100,
      scope: {},
      effect: {
        planning_method: "reorder_point",
        service_level_target: 0.9,
        reorder_point_qty: 10,
        reorder_qty: 25,
        lead_time_days: 10,
        safety_lead_time_days: 2,
        minimum_order_qty: 10,
        order_multiple: 5,
        approval_required: true,
        approval_threshold_value: 500,
        currency: "EUR"
      },
      attrs: {},
      created_at: "2026-01-01T00:00:00Z"
    },
    {
      code: "INV_REORDER_SKU",
      condition_type: "SUPPLY_REORDER_CONDITION",
      condition_category: "SUPPLY",
      priority: 10,
      scope: { material_codes: ["SKU-1"] },
      effect: {
        reorder_qty: 30,
        supplier_risk_level: "high",
        freight_cost_estimate: 12
      },
      attrs: {},
      created_at: "2026-01-02T00:00:00Z"
    }
  ];
  const material = {
    id: "mat-1",
    code: "SKU-1",
    material_type: "PRODUCT",
    attrs: {
      inventory: {
        track_stock: true,
        stock_on_hand: 12,
        available_qty: 8,
        reorder_qty: 35,
        daily_consumption_rate: 1,
        ungoverned_note: "not a policy override"
      }
    }
  };

  const resolution = resolveInventoryPolicy(material, conditions);
  assert.equal(resolution.policy_source, "commercial_condition");
  assert.deepEqual(resolution.condition_codes, ["INV_REORDER_DEFAULT", "INV_REORDER_SKU"]);
  assert.equal(resolution.effective_policy.reorder_point_qty, 10);
  assert.equal(resolution.effective_policy.reorder_qty, 35);
  assert.equal(resolution.effective_policy.lead_time_days, 10);
  assert.equal(resolution.effective_policy.supplier_risk_level, "high");
  assert.equal(resolution.effective_policy.currency, "EUR");
  assert.ok(resolution.material_override_fields.includes("reorder_qty"));
  assert.ok(!resolution.material_override_fields.includes("ungoverned_note"));

  const profile = normalizeInventoryProfile(material, { conditions });
  assert.equal(profile.policy_source, "commercial_condition");
  assert.deepEqual(profile.policy_condition_codes, ["INV_REORDER_DEFAULT", "INV_REORDER_SKU"]);
  assert.equal(profile.reorder_point, 10);
  assert.equal(profile.reorder_qty, 35);
  assert.equal(profile.target_service_level, 0.9);
  assert.equal(profile.supplier_risk_level, "high");
});

test("reorder suggestion payload stays service_object-based and human-review oriented", () => {
  const material = { id: "mat-1", code: "SKU-1", name: "Oak board", material_type: "PRODUCT" };
  const profile = normalizeInventoryProfile({
    ...material,
    attrs: { inventory: { track_stock: true, stock_on_hand: 2, available_qty: 2, reorder_point: 5, reorder_qty: 20 } }
  });
  const payload = buildReorderSuggestionPayload(material, profile);
  assert.equal(payload.material_id, "mat-1");
  assert.equal(payload.status, "open");
  assert.equal(payload.source, "low_stock_detection");
  assert.equal(payload.suggested_qty, 20);
  assert.equal(payload.policy_source, "material_attrs_legacy");
  assert.deepEqual(payload.policy_condition_codes, []);
  assert.equal(payload.process_parameters.object_type, "INVENTORY_REORDER_SUGGESTION");
  assert.equal(payload.process_parameters.effect, "CREATE_PURCHASE_REQUISITION_DRAFT");
  assert.equal(payload.process_parameters.parameters.recommended_qty, 20);
  assert.equal(normalizeInventoryTaskType("supplier_check"), "SUPPLIER_CHECK");
});

test("inventory profile produces professional recommendation and decision-card outputs", () => {
  const material = {
    id: "mat-1",
    code: "SKU-1",
    name: "Oak board",
    material_type: "PRODUCT",
    attrs: {
      inventory: {
        track_stock: true,
        stock_on_hand: 8,
        reserved_qty: 2,
        available_qty: 6,
        reorder_point: 4,
        reorder_qty: 10,
        minimum_stock: 4,
        maximum_stock: 30,
        safety_stock: 5,
        lead_time_days: 10,
        safety_lead_time_days: 2,
        daily_consumption_rate: 0.75,
        minimum_order_qty: 20,
        order_multiple: 5,
        unit_cost: 12,
        freight_cost_estimate: 15,
        approval_threshold_value: 200,
        target_service_level: 0.95,
        supplier_risk_level: "high",
        single_source_risk: true,
        abc_classification: "A"
      }
    }
  };

  const profile = normalizeInventoryProfile(material);
  assert.equal(profile.days_of_cover, 8);
  assert.equal(profile.risk_status, "stockout_predicted");
  assert.equal(profile.predicted_out_of_stock_date.length, 10);
  assert.equal(profile.suggested_qty, 20);
  assert.equal(profile.cash_required_for_reorder, 255);
  assert.equal(profile.supplier_risk_level, "high");
  assert.equal(profile.target_service_level, 0.95);
  assert.equal(profile.abc_classification, "A");
  assert.equal(profile.recommendation.action, "create_reorder_suggestion");
  assert.equal(profile.recommendation.requires_human_approval, true);
  assert.ok(profile.recommendation.approval_reasons.includes("cash_threshold_exceeded"));
  assert.equal(profile.recommendation.process_parameters.effect, "CREATE_PURCHASE_REQUISITION_DRAFT");
  assert.deepEqual(profile.recommendation.process_parameters.parameters.policy_condition_codes, []);
  assert.ok(profile.action_proposals.includes("create_purchase_requisition_draft"));
  assert.ok(profile.action_proposals.includes("recommend_alternative_supplier"));
  assert.equal(profile.purchase_requisition_bridge.ready_for_draft, true);
  assert.match(profile.decision_card.headline, /Oak board will run out/);

  const payload = buildReorderSuggestionPayload(material, profile);
  assert.equal(payload.risk_status, "stockout_predicted");
  assert.equal(payload.cash_required_for_reorder, 255);
  assert.equal(payload.purchase_requisition_bridge.draft_object_type, "PURCHASE_REQUISITION_DRAFT");
  assert.equal(payload.purchase_requisition_bridge.handoff_module, "procurement");
  assert.equal(payload.purchase_requisition_bridge.handoff_boundary, "inventory_signal_to_procurement_workbench");
  assert.equal("future_transmission_modes" in payload.purchase_requisition_bridge, false);
  assert.equal("future_commitment_object_type" in payload.purchase_requisition_bridge, false);
  assert.equal(payload.process_parameters.parameters.material_id, "mat-1");
  assert.ok(payload.decision_card.headline.includes("Oak board"));
});

test("inventory signal workbench composes stock risk, policy, procurement bridge, movements, tasks, and actions", () => {
  const material = {
    id: "mat-1",
    code: "SKU-1",
    name: "Oak board",
    material_type: "PRODUCT",
    supplier_name: "Supplier A",
    attrs: {
      inventory: {
        track_stock: true,
        stock_on_hand: 2,
        available_qty: 2,
        reorder_point: 5,
        reorder_qty: 20,
        daily_consumption_rate: 1,
        unit_cost: 10,
        freight_cost_estimate: 5
      }
    }
  };
  const profile = normalizeInventoryProfile(material);
  const suggestion = {
    id: "sig-1",
    code: "REORDER-1",
    title: "Review reorder: Oak board",
    status: "approved",
    attrs: buildReorderSuggestionPayload(material, profile),
    material_id: "mat-1",
    material_code: "SKU-1",
    material_name: "Oak board",
    suggested_qty: 20,
    reason: "available_qty below reorder point",
    risk_status: "reorder_now",
    decision_card: profile.decision_card,
    recommendation: profile.recommendation,
    policy_source: profile.policy_source,
    policy_condition_codes: profile.policy_condition_codes,
    created_at: "2026-06-01T00:00:00Z"
  };
  const workbench = composeInventorySignalWorkbench({
    suggestion,
    material,
    movements: [
      {
        id: "mov-1",
        title: "Sale issue",
        payload: {
          movement_type: "sale_issue",
          direction: "out",
          quantity: 3,
          unit_of_measure: "pcs",
          balance_after: 2
        },
        created_at: "2026-06-02T00:00:00Z"
      }
    ],
    requisition: {
      id: "req-1",
      code: "PR-1",
      title: "Purchase need: Oak board",
      status: "draft",
      object_type: "PURCHASE_REQUISITION",
      created_at: "2026-06-03T00:00:00Z"
    },
    tasks: [
      {
        id: "task-1",
        task_type: "REORDER_REVIEW",
        status: "open",
        title: "Review reorder",
        created_at: "2026-06-01T00:00:00Z"
      }
    ],
    processState: {
      suggestion: { status: "active" },
      requisition: { status: "active" }
    }
  });

  assert.equal(workbench.ok, true);
  assert.equal(workbench.signal.label, "Oak board");
  assert.equal(workbench.material.label, "SKU-1 - Oak board");
  assert.equal(workbench.inventory_state.available_qty, 2);
  assert.equal(workbench.inventory_state.suggested_qty, 20);
  assert.equal(workbench.policy_source.source, "material_attrs_legacy");
  assert.ok(workbench.material_override.fields.includes("reorder_point_qty"));
  assert.ok(workbench.material_override.fields.includes("reorder_qty"));
  assert.ok(workbench.material_override.fields.includes("unit_cost"));
  assert.equal(workbench.procurement_bridge.status, "requisition_started");
  assert.equal(workbench.procurement_bridge.requisition.label, "PR-1 - Purchase need: Oak board");
  assert.equal(workbench.recent_movements[0].movement_type, "sale_issue");
  assert.equal(workbench.process_timeline.some((item) => item.code === "procurement_requisition"), true);
  assert.equal(workbench.next_actions.some((item) => item.code === "open_procurement_workbench"), true);
  assert.equal(workbench.next_actions.every((item) => item.code !== "future_purchase_action"), true);
});

test("inventory route registers all required endpoints and enforces session, CSRF, RBAC, and tenant scope", () => {
  for (const path of [
    '"/overview"',
    '"/materials"',
    '"/materials/:id"',
    '"/materials/:id/policy"',
    '"/materials/:id/movements"',
    '"/reorder-suggestions"',
    '"/reorder-suggestions/run"',
    '"/reorder-suggestions/:id/workbench"',
    '"/reorder-suggestions/:id"',
    '"/reorder-suggestions/:id/approve"',
    '"/reorder-suggestions/:id/ignore"',
    '"/reorder-suggestions/:id/tasks"'
  ]) {
    assert.match(route, new RegExp(path.replace(/[/:]/g, "\\$&")));
  }
  assert.match(server, /import inventoryRoutes/);
  assert.match(server, /app\.register\(inventoryRoutes, \{ prefix: "\/api\/eip\/inventory" \}\)/);
  assert.match(route, /app\.requireSession\(req, \{ realm: "EIP" \}\)/);
  assert.match(route, /app\.requireCsrf\(req\)/);
  assert.match(route, /hasPermission\(/);
  assert.match(route, /tenant_id=\$1/);
  assert.match(route, /FROM eip_core\.commercial_condition/);
  assert.match(route, /listInventoryPolicyConditions/);
  assert.match(route, /composeInventorySignalWorkbench/);
  assert.match(workbenchService, /export function composeInventorySignalWorkbench/);
  assert.match(workbenchService, /commercial_condition_governed/);
  assert.match(workbenchService, /procurement_bridge/);
});

test("reorder approval and ignore remain process governed", () => {
  assert.match(route, /REORDER_OBJECT_TYPE = "INVENTORY_REORDER_SUGGESTION"/);
  assert.match(route, /ensureProcessInstance/);
  assert.match(route, /app\.coreProcess\.advanceInstance/);
  assert.match(route, /action: "approve"/);
  assert.match(route, /action: "ignore"/);
  assert.doesNotMatch(route, /future_purchase_action|future_transmission_modes|edi_webhook/);
  assert.doesNotMatch(route, /CREATE\s+TABLE/i);
});

test("inventory migration is additive and seeds governed clone-ready metadata", () => {
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i);
  for (const value of [
    "INVENTORY_STOCK_STATUS",
    "INVENTORY_MOVEMENT_TYPE",
    "INVENTORY_REORDER_STATUS",
    "INVENTORY_READ",
    "INVENTORY_REORDER_APPROVE",
    "role_template_permission",
    "tenant_module_setting",
    "INVENTORY_REORDER_FLOW_V1",
    "INVENTORY_STOCK_REVIEW_FLOW_V1",
    "process_binding",
    "task_template",
    "REORDER_REVIEW",
    "STOCK_REVIEW"
  ]) {
    assert.match(migration, new RegExp(value));
  }
  assert.match(migration, /module_catalog/);
  assert.match(migration, /"capabilities":\{"overview":true,"materials":true,"movements":true,"reorder":true\}/);
});

test("inventory recommendation addendum is additive and seeds professional policy governance", () => {
  assert.doesNotMatch(recommendationMigration, /CREATE\s+TABLE/i);
  for (const value of [
    "INVENTORY_ABC_CLASS",
    "INVENTORY_RISK_STATUS",
    "INVENTORY_SUPPLIER_RISK_LEVEL",
    "INVENTORY_RECOMMENDED_ACTION",
    "PURCHASE_REQUISITION_REVIEW",
    "decision_cards",
    "stockout_prediction",
    "purchase_requisition_bridge",
    "cash_impact",
    "supplier_risk",
    "service_level_policy",
    "auto_create_purchase_requisition_drafts"
  ]) {
    assert.match(recommendationMigration, new RegExp(value));
  }
});

test("inventory commercial condition migration is additive, clone-ready, and preserves material attrs compatibility", () => {
  assert.doesNotMatch(commercialConditionMigration, /CREATE\s+TABLE/i);
  for (const value of [
    "eip_core.commercial_condition",
    "INV_REORDER_DEFAULT",
    "SUPPLY_REORDER_STANDARD",
    "SUPPLIER_PURCHASE_STANDARD",
    "INVENTORY_REORDER_POLICY",
    "SUPPLY_REORDER_CONDITION",
    "SUPPLIER_PURCHASE_CONDITION",
    "condition_category",
    "INVENTORY",
    "SUPPLY",
    "PURCHASING",
    "policy_governance",
    "reorder_policy_source",
    "material_attrs_role",
    "state_override_snapshot"
  ]) {
    assert.match(commercialConditionMigration, new RegExp(value));
  }
  assert.match(commercialConditionMigration, /effect=EXCLUDED\.effect \|\| COALESCE\(eip_core\.commercial_condition\.effect/);
  assert.match(adminCloneRoute, /INSERT INTO eip_core\.commercial_condition/);
  assert.match(adminCloneRoute, /FROM eip_core\.commercial_condition/);
  assert.match(cloneSql, /INSERT INTO eip_core\.commercial_condition/);
  assert.match(cloneSql, /FROM eip_core\.commercial_condition/);
});

test("inventory dashboard is descriptor registered and module gated", () => {
  assert.match(registry, /import InventoryWorkspace/);
  assert.match(registry, /import InventoryManagementWorkspace/);
  assert.match(registry, /InventoryWorkspace,/);
  assert.match(registry, /InventoryManagementWorkspace,/);
  assert.match(dashboardSurface, /\{ code: "inventory", label: "Inventory", icon: "Package", module: "inventory" \}/);
  assert.match(dashboardSurface, /type: "InventoryManagementWorkspace"/);
  assert.match(dashboardSurface, /\/api\/eip\/inventory\/overview/);
  assert.match(dashboardSurface, /\/api\/eip\/inventory\/reorder-recommendations/);
  assert.match(dashboardSurface, /\/api\/eip\/inventory\/policies\/effective/);
  assert.match(dashboardSurface, /Materials/);
  assert.match(dashboardSurface, /Lots/);
  assert.match(dashboardSurface, /Reorder/);
  assert.match(surfaceSeed, /"code": "inventory"/);
  assert.match(surfaceSeed, /"type": "InventoryManagementWorkspace"/);
  assert.match(surfaceSeed, /"recommendations": "\/api\/eip\/inventory\/reorder-recommendations"/);
  assert.match(surfaceSeed, /"policiesEffective": "\/api\/eip\/inventory\/policies\/effective"/);
  assert.match(workspace, /export default function InventoryWorkspace/);
  assert.ok(workspace.includes("apiFetch(`${endpoints.suggestions}/run`"));
  assert.match(workspace, /decision_card/);
  assert.match(workspace, /Stock Signals Queue/);
  assert.match(workspace, /Inventory Signal Workbench/);
  assert.match(workspace, /Action Rail/);
  assert.match(workspace, /Governed policy source/);
  assert.match(workspace, /Material overrides/);
  assert.match(workspace, /Current stock state/);
  assert.match(workspace, /Procurement bridge/);
  assert.match(workspace, /Open in Procurement/);
  assert.match(workspace, /Recent stock movements/);
  assert.match(workspace, /Preferred supplier reference/);
  assert.doesNotMatch(workspace, /Approve requisition/);
  assert.doesNotMatch(workspace, /Preferred supplier agent id/);
});

test("inventory workspace remains tenant agnostic and separate from payment operations", () => {
  const touched = `${route}\n${migration}\n${workspace}\n${dashboardSurface}`;
  assert.doesNotMatch(touched, /samara|samarapattern|samara-web-storefront/i);
  assert.match(paymentDocs, /Inventory\/reorder is now handled by the separate Inventory foundation/);
  assert.match(paymentDocs, /payment-driven stock issue/);
  assert.doesNotMatch(workspace, /payment-readiness|Checkout\.com|PayPal|manual_test/);
});
