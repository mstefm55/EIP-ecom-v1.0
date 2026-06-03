import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildPurchaseRequisitionPayload,
  buildRfqPayload,
  compareSupplierQuotes,
  normalizeSupplierLink,
  resolveProcurementPolicy,
  selectProcurementModel
} from "../src/services/procurement/procurementFoundation.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const route = read("../src/routes/procurement.js");
const server = read("../src/server.js");
const migration = read("../db/migrations/0111_procurement_foundation.sql");
const surfaceSeed = read("../db/seed/ui_surface_dashboard.sql");
const cloneSql = read("../db/seed/clone_template_to_tenant.sql");
const adminCloneRoute = read("../src/routes/admin_template_clone.js");
const registry = read("../../../apps/dashboard/src/engine/registry.jsx");
const dashboardSurface = read("../../../apps/dashboard/src/engine/surfaces/dashboard.js");
const workspace = read("../../../apps/dashboard/src/components/procurement/ProcurementWorkspace.jsx");
const procurementDocs = read("../../../docs/procurement_foundation_v1.md");
const inventoryDocs = read("../../../docs/inventory_reorder_foundation_v1.md");
const smeDocs = read("../../../docs/sme_operating_model_v1.md");

const material = {
  id: "mat-1",
  code: "SKU-1",
  name: "Oak board",
  material_type: "PRODUCT",
  attrs: { category: "wood" }
};

const baseStockProfile = {
  material_id: "mat-1",
  material_code: "SKU-1",
  material_name: "Oak board",
  suggested_qty: 20,
  unit_of_measure: "pcs",
  abc_classification: "B",
  average_cost: 12,
  freight_cost_estimate: 15,
  days_of_cover: 12,
  risk_status: "reorder_now"
};

const preferredLink = {
  supplier_agent_id: "supplier-1",
  supplier_name: "Main Supplier",
  attrs: {
    supplier_role: "preferred",
    accreditation_status: "approved",
    is_accredited: true,
    last_price: 10,
    currency: "EUR",
    lead_time_days: 7,
    freight_cost_estimate: 20,
    payment_terms_code: "NET_30",
    payment_due_days: 30,
    supplier_risk_level: "low",
    otif_score: 0.94,
    quality_rating: 0.9
  }
};

const backupLink = {
  supplier_agent_id: "supplier-2",
  supplier_name: "Backup Supplier",
  attrs: {
    supplier_role: "backup",
    accreditation_status: "approved",
    is_accredited: true,
    last_price: 11,
    currency: "EUR",
    lead_time_days: 10,
    freight_cost_estimate: 30,
    payment_terms_code: "NET_15",
    payment_due_days: 15,
    supplier_risk_level: "medium"
  }
};

const thirdLink = {
  supplier_agent_id: "supplier-3",
  supplier_name: "Third Supplier",
  attrs: {
    supplier_role: "backup",
    accreditation_status: "approved",
    is_accredited: true,
    last_price: 12,
    currency: "EUR",
    lead_time_days: 9,
    supplier_risk_level: "medium"
  }
};

test("commercial-condition procurement policy resolves scoped overrides and defaults", () => {
  const conditions = [
    {
      code: "PROCUREMENT_POLICY_DEFAULT",
      condition_type: "PROCUREMENT_POLICY",
      condition_category: "PURCHASING",
      priority: 100,
      scope: {},
      effect: {
        procurement_policy: {
          procurement_model: "purchase_requisition_then_po",
          rfq_threshold_value: 500,
          minimum_quote_count: 3,
          cash_purchase_allowed: true,
          cash_purchase_limit_value: 100,
          currency: "EUR"
        }
      },
      attrs: {},
      created_at: "2026-01-01T00:00:00Z"
    },
    {
      code: "PROCUREMENT_POLICY_SKU",
      condition_type: "PROCUREMENT_POLICY",
      condition_category: "PURCHASING",
      priority: 10,
      scope: { material_codes: ["SKU-1"] },
      effect: {
        procurement_policy: {
          rfq_threshold_value: 150,
          approval_threshold_value: 200
        }
      },
      attrs: {},
      created_at: "2026-01-02T00:00:00Z"
    }
  ];

  const policy = resolveProcurementPolicy({ material, stockProfile: baseStockProfile }, conditions);
  assert.equal(policy.policy_source, "commercial_condition");
  assert.deepEqual(policy.condition_codes, ["PROCUREMENT_POLICY_DEFAULT", "PROCUREMENT_POLICY_SKU"]);
  assert.equal(policy.effective_policy.rfq_threshold_value, 150);
  assert.equal(policy.effective_policy.minimum_quote_count, 3);
  assert.equal(policy.effective_policy.cash_purchase_limit_value, 100);
  assert.equal(policy.effective_policy.currency, "EUR");
});

test("procurement model selects RFQ for high-value ABC A or threshold-based multi-supplier buying", () => {
  const recommendation = selectProcurementModel({
    material,
    stock_profile: { ...baseStockProfile, abc_classification: "A", suggested_qty: 30 },
    supplier_links: [preferredLink, backupLink, thirdLink],
    conditions: [{
      code: "PROCUREMENT_POLICY_DEFAULT",
      condition_type: "PROCUREMENT_POLICY",
      condition_category: "PURCHASING",
      priority: 100,
      scope: {},
      effect: { procurement_policy: { rfq_threshold_value: 250, minimum_quote_count: 3, currency: "EUR" } },
      attrs: {}
    }]
  });

  assert.equal(recommendation.procurement_model, "request_for_quote");
  assert.equal(recommendation.next_process, "PURCHASE_RFQ_FLOW_V1");
  assert.equal(recommendation.selection_reason, "abc_a_multiple_suppliers");
  assert.equal(recommendation.minimum_quote_count, 3);
  assert.equal(recommendation.approval_required, true);
  assert.equal(recommendation.policy_condition_codes.includes("PROCUREMENT_POLICY_DEFAULT"), true);
  assert.equal(recommendation.candidate_suppliers.length, 3);
  assert.equal(recommendation.currency, "EUR");
});

test("procurement model supports cash purchase and direct purchase without bypassing approval metadata", () => {
  const cash = selectProcurementModel({
    material,
    stock_profile: { ...baseStockProfile, suggested_qty: 2, abc_classification: "C" },
    supplier_links: [preferredLink],
    conditions: [{
      code: "CASH_PURCHASE_STANDARD",
      condition_type: "CASH_PURCHASE_CONDITION",
      condition_category: "PURCHASING",
      priority: 10,
      scope: {},
      effect: { cash_purchase_policy: { cash_purchase_allowed: true, cash_purchase_limit_value: 100 } },
      attrs: {}
    }]
  });
  assert.equal(cash.procurement_model, "cash_shop_purchase");
  assert.equal(cash.next_process, "CASH_PURCHASE_FLOW_V1");
  assert.equal(cash.cash_required > 0, true);

  const direct = selectProcurementModel({
    material,
    stock_profile: { ...baseStockProfile, suggested_qty: 5, abc_classification: "C" },
    supplier_links: [preferredLink],
    conditions: [{
      code: "DIRECT_POLICY",
      condition_type: "PROCUREMENT_POLICY",
      condition_category: "PURCHASING",
      priority: 10,
      scope: {},
      effect: { procurement_policy: { cash_purchase_allowed: false, direct_purchase_threshold_value: 1000, approval_required: false } },
      attrs: {}
    }]
  });
  assert.equal(direct.procurement_model, "direct_purchase");
  assert.equal(direct.selection_reason, "preferred_supplier_low_risk_known_price");
  assert.equal(direct.recommended_supplier_agent_id, "supplier-1");
});

test("missing accredited supplier forces RFQ and supplier-required risk flag", () => {
  const recommendation = selectProcurementModel({
    material,
    stock_profile: baseStockProfile,
    supplier_links: [{
      supplier_agent_id: "supplier-blocked",
      attrs: { supplier_role: "blocked", accreditation_status: "blocked", is_accredited: false }
    }],
    conditions: []
  });
  assert.equal(recommendation.procurement_model, "request_for_quote");
  assert.equal(recommendation.selection_reason, "no_accredited_supplier");
  assert.equal(recommendation.recommended_supplier_agent_id, null);
  assert.equal(recommendation.risk_flags.includes("no_accredited_supplier"), true);
});

test("purchase requisition and RFQ payloads stay process-engine ready", () => {
  const recommendation = selectProcurementModel({
    material,
    stock_profile: baseStockProfile,
    supplier_links: [preferredLink, backupLink, thirdLink],
    conditions: []
  });
  const requisition = buildPurchaseRequisitionPayload({
    material,
    stock_profile: baseStockProfile,
    recommendation,
    source_reorder_suggestion_id: "reorder-1"
  });
  assert.equal(requisition.object_type, "PURCHASE_REQUISITION");
  assert.equal(requisition.source_reorder_suggestion_id, "reorder-1");
  assert.equal(requisition.process_parameters.effect, "CREATE_PURCHASE_REQUISITION_DRAFT");
  assert.equal(requisition.process_parameters.parameters.currency, "EUR");
  assert.equal(requisition.status, "draft");

  const rfq = buildRfqPayload({ requisition: { id: "pr-1", attrs: requisition } });
  assert.equal(rfq.source_requisition_id, "pr-1");
  assert.equal(rfq.process_parameters.effect, "CREATE_PURCHASE_RFQ_DRAFT");
  assert.equal(rfq.process_parameters.parameters.material_id, "mat-1");
  assert.equal(rfq.supplier_agent_ids.includes("supplier-1"), true);
});

test("supplier links and quote comparisons normalize relationship policy without duplicating supplier tables", () => {
  const supplierLink = normalizeSupplierLink({
    supplier_role: "contract",
    accreditation_status: "approved",
    last_price: "13.45",
    lead_time_days: "8",
    payment_terms_code: "NET_15",
    supplier_risk_level: "low"
  });
  assert.equal(supplierLink.supplier_role, "contract");
  assert.equal(supplierLink.last_price, 13.45);
  assert.equal(supplierLink.payment_terms_code, "NET_15");

  const comparison = compareSupplierQuotes([
    { id: "quote-1", payload: { supplier_agent_id: "supplier-1", quoted_qty: 20, unit_price: 12, freight_cost: 25, currency: "EUR", lead_time_days: 8, payment_terms_code: "NET_30", otif_score: 0.9 } },
    { id: "quote-2", payload: { supplier_agent_id: "supplier-2", quoted_qty: 20, unit_price: 10, freight_cost: 15, currency: "EUR", lead_time_days: 20, payment_terms_code: "CASH_ON_DELIVERY", supplier_risk_level: "high" } }
  ], { currency: "EUR" });

  assert.equal(comparison.recommended_supplier_agent_id, "supplier-1");
  assert.equal(comparison.recommended_quote_id, "quote-1");
  assert.equal(comparison.currency, "EUR");
  assert.equal(comparison.quotes.length, 2);
});

test("procurement routes are registered and enforce EIP session, CSRF, RBAC, and tenant scope", () => {
  for (const fragment of [
    '"/overview"',
    '"/supplier-links"',
    '"/requisitions"',
    '"/requisitions/from-reorder"',
    '"/requisitions/:id/approve"',
    '"/rfqs"',
    '"/rfqs/from-requisition"',
    '"/rfqs/:id/quotes"',
    '"/rfqs/:id/compare"',
    '"/rfqs/:id/approve-quote"',
    '"/cash-purchases"'
  ]) {
    assert.match(route, new RegExp(fragment.replace(/[/:]/g, "\\$&")));
  }
  assert.match(server, /import procurementRoutes/);
  assert.match(server, /app\.register\(procurementRoutes, \{ prefix: "\/api\/eip\/procurement" \}\)/);
  assert.match(route, /app\.requireSession\(req, \{ realm: "EIP" \}\)/);
  assert.match(route, /app\.requireCsrf\(req\)/);
  assert.match(route, /hasPermission\(/);
  assert.match(route, /tenant_id=\$1/);
  assert.match(route, /FROM eip_core\.commercial_condition/);
  assert.match(route, /FROM eip_core\.object_link/);
  assert.match(route, /FROM eip_core\.service_object/);
  assert.match(route, /eip_core\.info_record/);
  assert.match(route, /app\.coreProcess\.advanceInstance/);
});

test("procurement migration is additive and seeds clone-ready governance", () => {
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i);
  assert.doesNotMatch(migration, /ALTER\s+TABLE/i);
  for (const value of [
    "PROCUREMENT_MODEL",
    "SUPPLIER_ROLE",
    "SUPPLIER_ACCREDITATION_STATUS",
    "PURCHASE_REQUISITION_STATUS",
    "RFQ_STATUS",
    "SUPPLIER_QUOTE_STATUS",
    "PAYMENT_TERMS",
    "PROCUREMENT_READ",
    "PROCUREMENT_REQUISITION_APPROVE",
    "PROCUREMENT_QUOTE_REVIEW",
    "SUPPLIER_LINK_WRITE",
    "module_catalog",
    "tenant_module_setting",
    "role_template_permission",
    "role_permission",
    "PROCUREMENT_POLICY_DEFAULT",
    "MATERIAL_SUPPLIER_STANDARD",
    "PAYMENT_TERMS_NET_30",
    "FREIGHT_COST_STANDARD",
    "CASH_PURCHASE_STANDARD",
    "PURCHASE_REQUISITION_FLOW_V1",
    "PURCHASE_RFQ_FLOW_V1",
    "SUPPLIER_QUOTE_REVIEW_FLOW_V1",
    "PURCHASE_ORDER_DRAFT_FLOW_V1",
    "CASH_PURCHASE_FLOW_V1",
    "PURCHASE_REQUISITION_REVIEW",
    "SUPPLIER_QUOTE_REVIEW",
    "CASH_PURCHASE_REVIEW"
  ]) {
    assert.match(migration, new RegExp(value));
  }
  assert.match(migration, /eip_core\.commercial_condition/);
  assert.match(migration, /eip_core\.object_link/);
});

test("canonical clone path already carries procurement-governed tables and metadata", () => {
  for (const value of [
    "INSERT INTO eip_core.commercial_condition",
    "FROM eip_core.commercial_condition",
    "INSERT INTO eip_core.process_def",
    "INSERT INTO eip_core.process_binding",
    "INSERT INTO eip_core.task_template",
    "INSERT INTO eip_core.tenant_module_setting"
  ]) {
    assert.match(cloneSql, new RegExp(value.replace(/[().]/g, "\\$&")));
  }
  for (const value of [
    "INSERT INTO eip_core.commercial_condition",
    "FROM eip_core.commercial_condition",
    "INSERT INTO eip_core.process_def",
    "INSERT INTO eip_core.process_binding",
    "INSERT INTO eip_core.task_template",
    "tenant_module_setting"
  ]) {
    assert.match(adminCloneRoute, new RegExp(value.replace(/[().]/g, "\\$&")));
  }
  assert.match(migration, /tenant\.code='eip_ecom'/);
});

test("procurement dashboard is descriptor registered, module gated, and tenant agnostic", () => {
  assert.match(registry, /import ProcurementWorkspace/);
  assert.match(registry, /ProcurementWorkspace,/);
  assert.match(dashboardSurface, /\{ code: "procurement", label: "Procurement", icon: "ShoppingCart", module: "procurement" \}/);
  assert.match(dashboardSurface, /type: "ProcurementWorkspace"/);
  assert.match(dashboardSurface, /\/api\/eip\/procurement\/overview/);
  assert.match(surfaceSeed, /"code": "procurement"/);
  assert.match(surfaceSeed, /"type": "ProcurementWorkspace"/);
  assert.match(workspace, /export default function ProcurementWorkspace/);
  assert.match(workspace, /Purchase Needs/);
  assert.match(workspace, /supplierLinks/);
  assert.match(workspace, /from-reorder/);
  assert.match(workspace, /from-requisition/);
  assert.match(workspace, /compareQuotes/);
  const touched = `${route}\n${migration}\n${workspace}\n${dashboardSurface}\n${surfaceSeed}`;
  assert.doesNotMatch(touched, /samara|samarapattern|samara-web-storefront/i);
});

test("procurement docs preserve module boundaries and no-heavy-planning scope", () => {
  assert.match(procurementDocs, /No procurement-specific persistence table was added/);
  assert.match(procurementDocs, /commercial_condition/);
  assert.match(procurementDocs, /object_link/);
  assert.match(procurementDocs, /Dashboard -> Procurement/);
  assert.match(procurementDocs, /does not implement full purchase order execution/);
  assert.match(procurementDocs, /heavy MRP/i);
  assert.match(inventoryDocs, /Procurement Foundation/);
  assert.match(inventoryDocs, /RFQ \/ quote review/);
  assert.match(smeDocs, /Procurement \| Supplier policy links/);
  assert.match(smeDocs, /Supplier accreditation and supplier-material terms are relationship metadata on `object_link`/);
});
