import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyInventoryMovement,
  buildReorderSuggestionPayload,
  mergeInventoryPolicy,
  normalizeInventoryProfile,
  normalizeInventoryTaskType,
  normalizeMovement
} from "../src/services/inventory/inventoryFoundation.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const route = read("../src/routes/inventory.js");
const server = read("../src/server.js");
const migration = read("../db/migrations/0108_inventory_reorder_foundation.sql");
const recommendationMigration = read("../db/migrations/0109_inventory_recommendation_policy_addendum.sql");
const surfaceSeed = read("../db/seed/ui_surface_dashboard.sql");
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
  assert.ok(profile.action_proposals.includes("create_purchase_requisition_draft"));
  assert.ok(profile.action_proposals.includes("recommend_alternative_supplier"));
  assert.equal(profile.purchase_requisition_bridge.ready_for_draft, true);
  assert.match(profile.decision_card.headline, /Oak board will run out/);

  const payload = buildReorderSuggestionPayload(material, profile);
  assert.equal(payload.risk_status, "stockout_predicted");
  assert.equal(payload.cash_required_for_reorder, 255);
  assert.equal(payload.purchase_requisition_bridge.draft_object_type, "PURCHASE_REQUISITION_DRAFT");
  assert.ok(payload.decision_card.headline.includes("Oak board"));
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
});

test("reorder approval and ignore remain process governed", () => {
  assert.match(route, /REORDER_OBJECT_TYPE = "INVENTORY_REORDER_SUGGESTION"/);
  assert.match(route, /ensureProcessInstance/);
  assert.match(route, /app\.coreProcess\.advanceInstance/);
  assert.match(route, /action: "approve"/);
  assert.match(route, /action: "ignore"/);
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

test("inventory dashboard is descriptor registered and module gated", () => {
  assert.match(registry, /import InventoryWorkspace/);
  assert.match(registry, /InventoryWorkspace,/);
  assert.match(dashboardSurface, /\{ code: "inventory", label: "Inventory", icon: "Package", module: "inventory" \}/);
  assert.match(dashboardSurface, /type: "InventoryWorkspace"/);
  assert.match(dashboardSurface, /\/api\/eip\/inventory\/overview/);
  assert.match(surfaceSeed, /"code": "inventory"/);
  assert.match(surfaceSeed, /"type": "InventoryWorkspace"/);
  assert.match(workspace, /export default function InventoryWorkspace/);
  assert.ok(workspace.includes("apiFetch(`${endpoints.suggestions}/run`"));
  assert.match(workspace, /decision_card/);
  assert.match(workspace, /Explain recommendation/);
  assert.match(workspace, /Approve requisition/);
});

test("inventory workspace remains tenant agnostic and separate from payment operations", () => {
  const touched = `${route}\n${migration}\n${workspace}\n${dashboardSurface}`;
  assert.doesNotMatch(touched, /samara|samarapattern|samara-web-storefront/i);
  assert.match(paymentDocs, /Inventory\/reorder is now handled by the separate Inventory foundation/);
  assert.match(paymentDocs, /payment-driven stock issue/);
  assert.doesNotMatch(workspace, /payment-readiness|Checkout\.com|PayPal|manual_test/);
});
