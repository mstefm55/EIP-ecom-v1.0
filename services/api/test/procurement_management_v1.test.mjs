import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Fastify from "fastify";
import procurementRoutes from "../src/routes/procurement.js";
import {
  PROCUREMENT_MANAGEMENT_PERMISSIONS,
  ProcurementInputError,
  createProcurementRequest,
  getProcurementRequestSummary,
  listProcurementRequests,
  listProcurementSupplierOptions,
  transitionProcurementRequest,
  updateProcurementRequest
} from "../src/services/procurement/procurementManagement.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const TENANT_B = "00000000-0000-0000-0000-00000000000b";
const IDENTITY_A = "10000000-0000-0000-0000-00000000000a";
const AGENT_A = "20000000-0000-4000-8000-00000000000a";
const SUPPLIER_A = "21000000-0000-4000-8000-00000000000a";
const SUPPLIER_B = "21000000-0000-4000-8000-00000000000b";
const MATERIAL_A = "30000000-0000-4000-8000-00000000000a";
const MATERIAL_B = "30000000-0000-4000-8000-00000000000b";
const REQUEST_A = "40000000-0000-4000-8000-00000000000a";
const REQUEST_B = "40000000-0000-4000-8000-00000000000b";

const route = read("../src/routes/procurement.js");
const service = read("../src/services/procurement/procurementManagement.js");
const migration = read("../db/migrations/0127_procurement_management_v1.sql");
const registry = read("../../../apps/dashboard/src/engine/registry.jsx");
const dashboardSurface = read("../../../apps/dashboard/src/engine/surfaces/dashboard.js");
const moduleDescriptors = read("../../../apps/dashboard/src/engine/surfaces/kernelModuleDescriptors.js");
const seedSurface = read("../db/seed/ui_surface_dashboard.sql");
const kernelWorkspace = read("../../../apps/dashboard/src/components/engine/KernelModuleWorkspace.jsx");

function material(overrides = {}) {
  return {
    id: overrides.id || MATERIAL_A,
    tenant_id: overrides.tenant_id || TENANT_A,
    code: overrides.code || "MAT-1",
    name: overrides.name || "Material One",
    material_type: overrides.material_type || "RAW_MATERIAL",
    attrs: overrides.attrs || {
      inventory: {
        unit_of_measure: "pcs",
        stock_on_hand: 4,
        reserved_qty: 1,
        average_cost: 10,
        reorder_qty: 20,
        risk_status: "reorder_now"
      }
    },
    is_active: overrides.is_active ?? true,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z"
  };
}

function agent(overrides = {}) {
  return {
    id: overrides.id || SUPPLIER_A,
    tenant_id: overrides.tenant_id || TENANT_A,
    agent_type: overrides.agent_type || "ORG",
    code: overrides.code || "SUP-1",
    name: overrides.name || "Supplier One",
    attrs: overrides.attrs || { roles: ["SUPPLIER"], status: "ACTIVE" },
    is_active: overrides.is_active ?? true
  };
}

function request(overrides = {}) {
  const attrs = overrides.attrs || {
    procurement_management_v1: {
      item_type: "MATERIAL",
      material_id: MATERIAL_A,
      material_code: "MAT-1",
      material_name: "Material One",
      requested_qty: 12,
      unit_of_measure: "pcs",
      supplier_agent_id: SUPPLIER_A,
      supplier_name: "Supplier One",
      currency: "EUR",
      payment_terms_code: "NET_30",
      incoterm_code: "DAP",
      approval_required: true,
      missing_data: [],
      warnings: []
    },
    material_id: MATERIAL_A,
    requested_qty: 12,
    unit_of_measure: "pcs",
    recommended_supplier_agent_id: SUPPLIER_A,
    recommendation: {
      requested_material: { id: MATERIAL_A, code: "MAT-1", name: "Material One" },
      requested_quantity: 12,
      unit_of_measure: "pcs",
      candidate_supplier: { supplier_agent_id: SUPPLIER_A, supplier_name: "Supplier One" },
      procurement_model: "formal_purchase_order",
      payment_terms: { code: "NET_30", due_days: 30 },
      incoterm: { code: "DAP" },
      approval_requirement: { required: true, threshold_value: 250 },
      warnings: [],
      missing_data: [],
      reason: "preferred_supplier_requires_formal_order",
      explanation: "Preferred supplier requires formal order.",
      estimated_landed_cost: 120,
      currency: "EUR"
    }
  };
  return {
    id: overrides.id || REQUEST_A,
    tenant_id: overrides.tenant_id || TENANT_A,
    object_type: "PURCHASE_REQUISITION",
    status: overrides.status || "draft",
    code: overrides.code || "REQ-1",
    title: overrides.title || "Buy material",
    attrs,
    owner_agent_id: overrides.owner_agent_id || AGENT_A,
    created_at: overrides.created_at || "2026-06-01T00:00:00.000Z",
    updated_at: overrides.updated_at || "2026-06-01T00:00:00.000Z"
  };
}

function condition(overrides = {}) {
  return {
    id: overrides.id || `cond-${overrides.code || "default"}`,
    tenant_id: overrides.tenant_id || TENANT_A,
    code: overrides.code || "PROCUREMENT_POLICY_DEFAULT",
    label: overrides.label || "Default procurement policy",
    condition_type: overrides.condition_type || "PROCUREMENT_POLICY",
    condition_category: overrides.condition_category || "COMMERCIAL",
    priority: overrides.priority ?? 10,
    valid_from: null,
    valid_to: null,
    is_active: true,
    scope: overrides.scope || {},
    effect: overrides.effect || {
      procurement_policy: {
        procurement_model: "formal_purchase_order",
        approval_required: true,
        approval_threshold_value: 250,
        currency: "EUR",
        payment_terms_code: "NET_30",
        payment_due_days: 30
      }
    },
    attrs: overrides.attrs || {
      classification: {
        mapping_status: "mapped",
        policy_domain: overrides.policy_domain || "COMMERCIAL",
        policy_family: overrides.policy_family || "PROCUREMENT",
        condition_type: overrides.taxonomy_type || overrides.condition_type || "PROCUREMENT_POLICY"
      }
    },
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z"
  };
}

function buildDb(initial = {}, options = {}) {
  const state = {
    materials: initial.materials || [material(), material({ id: MATERIAL_B, tenant_id: TENANT_B, code: "OTHER", name: "Other tenant material" })],
    agents: initial.agents || [agent({ id: AGENT_A, code: "BUYER", name: "Buyer", attrs: { roles: ["BUYER"] } }), agent(), agent({ id: SUPPLIER_B, tenant_id: TENANT_B, code: "SUP-B", name: "Supplier B" })],
    serviceObjects: initial.serviceObjects || [request(), request({ id: REQUEST_B, tenant_id: TENANT_B, code: "REQ-B", title: "Other tenant request" })],
    objectLinks: initial.objectLinks || [{
      id: "link-1",
      tenant_id: TENANT_A,
      src_kind: "material",
      src_id: MATERIAL_A,
      dst_kind: "agent",
      dst_id: SUPPLIER_A,
      relation_type: "MATERIAL_SUPPLIER",
      sort_order: 1,
      attrs: {
        supplier_role: "preferred",
        accreditation_status: "approved",
        is_accredited: true,
        last_price: 10,
        currency: "EUR",
        lead_time_days: 7,
        payment_terms_code: "NET_30",
        payment_due_days: 30,
        supplier_risk_level: "low"
      },
      is_active: true,
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z"
    }],
    infoRecords: initial.infoRecords || [{
      id: "50000000-0000-4000-8000-00000000000a",
      tenant_id: TENANT_A,
      record_type: "SUPPLIER_QUOTE",
      title: "Supplier quote",
      description: "Quote metadata",
      payload: { rfq_id: "rfq-1", supplier_agent_id: SUPPLIER_A, landed_cost: 120, currency: "EUR" },
      attrs: { module: "procurement" },
      is_active: true,
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z"
    }],
    conditions: initial.conditions || [
      condition(),
      condition({
        code: "PAYMENT_TERMS_NET_30",
        label: "Payment terms Net 30",
        condition_type: "PAYMENT_TERM_CONDITION",
        condition_category: "COMMERCIAL",
        policy_domain: "COMMERCIAL",
        policy_family: "PAYMENT_TERMS",
        taxonomy_type: "PAYMENT_TERM",
        effect: { payment_terms: { payment_terms_code: "NET_30", payment_due_days: 30, currency: "EUR" } }
      }),
      condition({
        code: "INCOTERM_DAP",
        label: "Incoterm DAP",
        condition_type: "INCOTERM",
        condition_category: "COMMERCIAL",
        policy_domain: "COMMERCIAL",
        policy_family: "INCOTERMS",
        taxonomy_type: "INCOTERM",
        effect: { incoterms: { incoterm_code: "DAP" } }
      }),
      condition({
        code: "PROCUREMENT_APPROVAL_DEFAULT",
        label: "Approval default",
        condition_type: "APPROVAL_RULE",
        condition_category: "APPROVAL_FRAMEWORK",
        policy_domain: "APPROVAL_FRAMEWORK",
        policy_family: "PROCUREMENT_APPROVAL",
        taxonomy_type: "APPROVAL_RULE",
        effect: { approval: { approval_required: true, approval_threshold_value: 250 } }
      })
    ],
    tasks: [],
    statusEvents: [],
    securityEvents: [],
    queries: [],
    permissions: options.permissions || new Set(Object.values(PROCUREMENT_MANAGEMENT_PERMISSIONS)),
    workspace: { layout: { title: "Procurement" } }
  };

  const dropdownRows = [
    ...["DRAFT", "NEEDS_REVIEW", "PENDING_APPROVAL", "APPROVED", "REJECTED", "SOURCING", "ORDER_PREPARATION", "COMPLETED", "CANCELLED", "ARCHIVED"].map((code) => ({ list_code: "PROCUREMENT_REQUEST_STATUS", code, label: code.replace(/_/g, " ") })),
    { list_code: "PAYMENT_TERMS", code: "NET_30", label: "Net 30" },
    { list_code: "INCOTERM", code: "DAP", label: "DAP" }
  ];

  const db = {
    state,
    async connect() {
      return { query: db.query, release() {} };
    },
    async query(sql, params = []) {
      state.queries.push({ sql, params });
      const flat = String(sql).replace(/\s+/g, " ");
      if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(String(sql).trim())) return { rowCount: 0, rows: [] };
      if (flat.includes("FROM eip_authz.identity_role")) {
        const allowed = options.permissionAllowed === false ? false : state.permissions.has(params[2]);
        return allowed ? { rowCount: 1, rows: [{ ok: 1 }] } : { rowCount: 0, rows: [] };
      }
      if (flat.includes("FROM eip_auth.auth_identity_agent")) return { rowCount: 1, rows: [{ agent_id: AGENT_A }] };
      if (flat.includes("INSERT INTO eip_core.security_event")) {
        state.securityEvents.push(params);
        return { rowCount: 1, rows: [{ id: "event-1" }] };
      }
      if (flat.includes("attrs->'ui_workspace' AS workspace")) return { rowCount: 1, rows: [{ workspace: state.workspace }] };
      if (flat.includes("FROM eip_core.dropdown_list")) return { rowCount: dropdownRows.length, rows: dropdownRows };
      if (flat.includes("FROM eip_core.material") && flat.includes("id=$2")) {
        const row = state.materials.find((item) => item.tenant_id === params[0] && item.id === params[1] && item.is_active);
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
      }
      if (flat.includes("FROM eip_core.material") && flat.includes("code=$2")) {
        const row = state.materials.find((item) => item.tenant_id === params[0] && item.code === params[1] && item.is_active);
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
      }
      if (flat.includes("FROM eip_core.material") && flat.includes("ORDER BY name")) {
        const rows = state.materials.filter((item) => item.tenant_id === params[0] && item.is_active);
        return { rowCount: rows.length, rows };
      }
      if (flat.includes("FROM eip_core.agent") && flat.includes("id=$2")) {
        const row = state.agents.find((item) => item.tenant_id === params[0] && item.id === params[1] && item.is_active);
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
      }
      if (flat.includes("FROM eip_core.agent") && flat.includes("ORDER BY name")) {
        const rows = state.agents.filter((item) => item.tenant_id === params[0] && item.is_active);
        return { rowCount: rows.length, rows };
      }
      if (flat.includes("FROM eip_core.object_link link") && flat.includes("JOIN eip_core.material")) {
        const materialId = params.length > 2 ? params[2] : null;
        const rows = state.objectLinks
          .filter((link) => link.tenant_id === params[0] && link.relation_type === params[1] && (!materialId || link.src_id === materialId) && link.is_active)
          .map((link) => {
            const mat = state.materials.find((item) => item.id === link.src_id && item.tenant_id === link.tenant_id);
            const sup = state.agents.find((item) => item.id === link.dst_id && item.tenant_id === link.tenant_id);
            return {
              ...link,
              material_id: link.src_id,
              supplier_agent_id: link.dst_id,
              material_code: mat?.code,
              material_name: mat?.name,
              supplier_code: sup?.code,
              supplier_name: sup?.name
            };
          });
        return { rowCount: rows.length, rows };
      }
      if (flat.includes("INSERT INTO eip_core.object_link")) {
        state.objectLinks.push({
          id: `link-${state.objectLinks.length + 1}`,
          tenant_id: params[0],
          src_kind: params[1],
          src_id: params[2],
          dst_kind: params[3],
          dst_id: params[4],
          relation_type: params[5],
          attrs: JSON.parse(params[6] || "{}"),
          is_active: true,
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-01T00:00:00.000Z"
        });
        return { rowCount: 1, rows: [] };
      }
      if (flat.includes("FROM eip_core.service_object") && flat.includes("id=$2") && flat.includes("object_type=$3")) {
        const row = state.serviceObjects.find((item) => item.tenant_id === params[0] && item.id === params[1] && item.object_type === params[2]);
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
      }
      if (flat.includes("FROM eip_core.service_object") && flat.includes("ORDER BY created_at DESC")) {
        const rows = state.serviceObjects.filter((item) => item.tenant_id === params[0] && item.object_type === params[1]);
        return { rowCount: rows.length, rows };
      }
      if (flat.includes("INSERT INTO eip_core.service_object")) {
        const row = request({
          id: `40000000-0000-4000-8000-${String(state.serviceObjects.length + 1).padStart(12, "0")}`,
          tenant_id: params[0],
          status: params[2],
          code: params[3],
          title: params[4],
          attrs: JSON.parse(params[5]),
          owner_agent_id: params[6]
        });
        state.serviceObjects.push(row);
        return { rowCount: 1, rows: [row] };
      }
      if (flat.includes("UPDATE eip_core.service_object") && flat.includes("SET title=$3")) {
        const row = state.serviceObjects.find((item) => item.tenant_id === params[0] && item.id === params[1] && item.object_type === params[5]);
        if (!row) return { rowCount: 0, rows: [] };
        row.title = params[2];
        row.status = params[3];
        row.attrs = JSON.parse(params[4]);
        row.updated_at = "2026-06-01T00:10:00.000Z";
        return { rowCount: 1, rows: [row] };
      }
      if (flat.includes("UPDATE eip_core.service_object") && flat.includes("SET status=$3")) {
        const row = state.serviceObjects.find((item) => item.tenant_id === params[0] && item.id === params[1]);
        if (!row) return { rowCount: 0, rows: [] };
        row.status = params[2];
        row.updated_at = "2026-06-01T00:20:00.000Z";
        return { rowCount: 1, rows: [row] };
      }
      if (flat.includes("INSERT INTO eip_core.service_object_status_event")) {
        state.statusEvents.push({
          service_object_id: params[1],
          from_status: params[2],
          to_status: params[3],
          reason_code: params[4],
          note: params[5],
          created_at: "2026-06-01T00:20:00.000Z"
        });
        return { rowCount: 1, rows: [{ id: `event-${state.statusEvents.length}` }] };
      }
      if (flat.includes("UPDATE eip_core.task")) return { rowCount: 0, rows: [] };
      if (flat.includes("FROM eip_core.task")) return { rowCount: state.tasks.length, rows: state.tasks };
      if (flat.includes("FROM eip_core.service_object_status_event")) return { rowCount: state.statusEvents.length, rows: state.statusEvents };
      if (flat.includes("FROM eip_core.object_link link") && flat.includes("JOIN eip_core.info_record")) {
        const links = state.objectLinks.filter((link) => link.tenant_id === params[0] && link.src_id === params[1] && link.dst_kind === "info_record" && link.is_active);
        const rows = links.flatMap((link) => {
          const info = state.infoRecords.find((item) => item.tenant_id === link.tenant_id && item.id === link.dst_id && item.is_active);
          return info ? [{ ...info, relation_type: link.relation_type }] : [];
        });
        return { rowCount: rows.length, rows };
      }
      if (flat.includes("FROM eip_core.info_record")) return { rowCount: state.infoRecords.length, rows: state.infoRecords };
      if (flat.includes("INSERT INTO eip_core.info_record")) {
        const row = {
          id: `50000000-0000-4000-8000-${String(state.infoRecords.length + 1).padStart(12, "0")}`,
          tenant_id: params[0],
          record_type: params[1],
          title: params[2],
          description: params[3] || null,
          payload: JSON.parse(params[4] || "{}"),
          attrs: JSON.parse(params[5] || "{}"),
          is_active: true,
          created_at: "2026-06-01T00:30:00.000Z",
          updated_at: "2026-06-01T00:30:00.000Z"
        };
        state.infoRecords.push(row);
        return { rowCount: 1, rows: [row] };
      }
      if (flat.includes("FROM eip_core.commercial_condition")) {
        const rows = state.conditions.filter((item) => item.tenant_id === params[0]);
        return { rowCount: rows.length, rows };
      }
      return { rowCount: 0, rows: [] };
    }
  };
  return db;
}

function appWithDb(db) {
  const app = {
    db,
    log: { info() {}, warn() {}, error() {} },
    coreProcess: {
      findActiveInstance: async (_client, _tenantId, serviceObjectId) => {
        app.lastServiceObjectId = serviceObjectId;
        return { id: "pi-1", status: "active" };
      },
      createInstance: async () => ({ ok: true, item: { id: "pi-1", status: "active" } }),
      advanceInstance: async (_client, opts) => {
        const statusByAction = { submit: "pending_approval", approve: "approved", reject: "rejected" };
        const row = db.state.serviceObjects.find((item) => item.id === app.lastServiceObjectId);
        if (row && statusByAction[opts.action]) row.status = statusByAction[opts.action];
        return { ok: true };
      }
    }
  };
  return app;
}

async function fastifyWithDb(db, options = {}) {
  const app = Fastify({ logger: false });
  app.decorate("db", db);
  app.decorate("requireSession", async () => options.sessionResult || { ok: true, session: { tenant_id: TENANT_A, identity_id: IDENTITY_A, realm: "EIP" } });
  app.decorate("requireCsrf", async () => options.csrfResult || { ok: true });
  app.decorate("coreProcess", appWithDb(db).coreProcess);
  await app.register(procurementRoutes, { prefix: "/api/eip/procurement" });
  return app;
}

test("procurement request list is tenant scoped", async () => {
  const db = buildDb();
  const result = await listProcurementRequests(appWithDb(db), { tenant_id: TENANT_A, identity_id: IDENTITY_A }, {});
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, REQUEST_A);
  assert.equal(result.items.some((item) => item.id === REQUEST_B), false);
  assert.equal(db.state.queries.some((query) => query.params.includes(TENANT_B)), false);
});

test("create and update request use service_object, reject tenant override, and never hard delete", async () => {
  const db = buildDb({ serviceObjects: [] });
  const app = appWithDb(db);
  const session = { tenant_id: TENANT_A, identity_id: IDENTITY_A };
  const created = await createProcurementRequest(app, session, {
    title: "Buy more stock",
    item_type: "MATERIAL",
    material_id: MATERIAL_A,
    requested_qty: 10,
    unit_of_measure: "pcs",
    supplier_agent_id: SUPPLIER_A,
    payment_terms_code: "NET_30",
    incoterm_code: "DAP"
  });
  assert.equal(created.item.status, "DRAFT");
  assert.equal(created.item.material_id, MATERIAL_A);
  assert.equal(created.item.supplier_agent_id, SUPPLIER_A);
  assert.equal(db.state.serviceObjects.length, 1);

  const updated = await updateProcurementRequest(app, session, created.item.id, {
    status: "NEEDS_REVIEW",
    requested_qty: 15,
    notes: "review quantity"
  });
  assert.equal(updated.item.status, "NEEDS_REVIEW");
  assert.equal(updated.item.requested_qty, 15);
  assert.equal(db.state.queries.some((query) => /DELETE\s+FROM/i.test(query.sql)), false);
  await assert.rejects(() => createProcurementRequest(app, session, { tenant_id: TENANT_B, title: "Injected", requested_qty: 1 }), ProcurementInputError);
  await assert.rejects(() => createProcurementRequest(app, session, { title: "Unsafe", requested_qty: 1, attrs: { api_key: "secret" } }), ProcurementInputError);
});

test("route enforces permissions, CSRF, tenant override rejection, and no delete route", async () => {
  const forbidden = await fastifyWithDb(buildDb(), { });
  forbidden.db.state.permissions = new Set();
  const denied = await forbidden.inject({ method: "GET", url: "/api/eip/procurement/requests" });
  assert.equal(denied.statusCode, 403);
  await forbidden.close();

  const app = await fastifyWithDb(buildDb());
  const invalid = await app.inject({
    method: "POST",
    url: "/api/eip/procurement/requests",
    payload: { tenant_id: TENANT_B, title: "Injected", requested_qty: 1 }
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error, "TENANT_OVERRIDE_NOT_ALLOWED");
  assert.doesNotMatch(route, /app\.delete\(/i);
  await app.close();
});

test("supplier options are tenant scoped and include material links plus manual supplier fallback", async () => {
  const db = buildDb();
  const result = await listProcurementSupplierOptions(appWithDb(db), { tenant_id: TENANT_A, identity_id: IDENTITY_A }, REQUEST_A, {});
  assert.equal(result.ok, true);
  assert.equal(result.items.some((item) => item.supplier_agent_id === SUPPLIER_A), true);
  assert.equal(result.items.some((item) => item.supplier_agent_id === SUPPLIER_B), false);
  assert.equal(result.summary.linked_supplier_count, 1);
});

test("recommendation, commercial terms, approvals, documents, activity, and policy summary are safe", async () => {
  const db = buildDb({
    objectLinks: [
      buildDb().state.objectLinks[0],
      { id: "doc-link", tenant_id: TENANT_A, src_kind: "service_object", src_id: REQUEST_A, dst_kind: "info_record", dst_id: "50000000-0000-4000-8000-00000000000a", relation_type: "QUOTE", attrs: {}, is_active: true }
    ]
  });
  const result = await getProcurementRequestSummary(appWithDb(db), { tenant_id: TENANT_A, identity_id: IDENTITY_A }, REQUEST_A);
  assert.equal(result.ok, true);
  assert.equal(result.recommendation.payment_terms.code, "NET_30");
  assert.equal(result.recommendation.incoterm.code, "DAP");
  assert.equal(result.commercial_terms.payment_terms_code, "NET_30");
  assert.equal(result.commercial_terms.incoterm_code, "DAP");
  assert.equal(result.commercial_terms.conditions.some((item) => item.policy_domain === "COMMERCIAL" && item.condition_type === "PAYMENT_TERM_CONDITION"), true);
  assert.equal(result.commercial_terms.conditions.some((item) => item.policy_domain === "COMMERCIAL" && item.condition_type === "INCOTERM"), true);
  assert.equal(result.approval.required, true);
  assert.equal(result.approval.conditions.some((item) => item.policy_domain === "APPROVAL_FRAMEWORK"), true);
  assert.equal(result.documents.length, 1);
  assert.equal(Object.hasOwn(result.documents[0], "payload"), false);
  assert.equal(result.policy_summary.domains.COMMERCIAL.resolution_status.length > 0, true);
});

test("submit, approve, and reject lifecycle actions use process engine and status transitions", async () => {
  const db = buildDb({ serviceObjects: [request({ status: "draft" })] });
  const app = appWithDb(db);
  const session = { tenant_id: TENANT_A, identity_id: IDENTITY_A };
  const submitted = await transitionProcurementRequest(app, session, REQUEST_A, "submit", { note: "ready" });
  assert.equal(submitted.item.status, "PENDING_APPROVAL");

  const approved = await transitionProcurementRequest(app, session, REQUEST_A, "approve", { note: "ok" });
  assert.equal(approved.item.status, "APPROVED");

  db.state.serviceObjects[0].status = "pending_approval";
  const rejected = await transitionProcurementRequest(app, session, REQUEST_A, "reject", { note: "missing quote" });
  assert.equal(rejected.item.status, "REJECTED");
});

test("required V1 routes, permissions, kernel metadata, migration, and no fake data are aligned", () => {
  for (const endpoint of [
    '"/requests"',
    '"/requests/:id"',
    '"/requests/:id/summary"',
    '"/requests/:id/supplier-options"',
    '"/recommendations"',
    '"/policies/effective"',
    '"/requests/:id/submit"',
    '"/requests/:id/approve"',
    '"/requests/:id/reject"',
    '"/governance/options"'
  ]) {
    assert.match(route, new RegExp(endpoint.replace(/[/:]/g, "\\$&")));
  }
  for (const permission of Object.values(PROCUREMENT_MANAGEMENT_PERMISSIONS)) {
    assert.match(service, new RegExp(permission.replace(/[.]/g, "\\.")));
    assert.match(migration, new RegExp(permission.replace(/[.]/g, "\\.")));
  }
  for (const value of [
    "eip_core.service_object",
    "eip_core.task",
    "eip_core.agent",
    "eip_core.material",
    "eip_core.commercial_condition",
    "eip_core.info_record",
    "eip_core.object_link",
    "dropdown_list",
    "KernelModuleWorkspace",
    "PROCUREMENT_REQUEST_FLOW_V1",
    "PROCUREMENT_REQUEST_STATUS",
    "INCOTERM"
  ]) {
    assert.match(`${service}\n${migration}`, new RegExp(value.replace(/[.]/g, "\\.")));
  }
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i);
  assert.doesNotMatch(service, /DELETE\s+FROM/i);
  assert.match(registry, /KernelModuleWorkspace/);
  assert.doesNotMatch(registry, /ProcurementWorkspace/);
  assert.match(dashboardSurface, /procurementKernelWorkspaceNode/);
  assert.match(moduleDescriptors, /procurementKernelWorkspaceNode/);
  assert.match(moduleDescriptors, /\/api\/eip\/procurement\/requests/);
  assert.match(moduleDescriptors, /\/api\/eip\/procurement\/requests\/:id\/submit/);
  assert.match(moduleDescriptors, /type: "lookup"/);
  assert.match(seedSurface, /"type": "KernelModuleWorkspace"/);
  assert.match(seedSurface, /"configEndpoint": "\/api\/eip\/procurement\/governance\/options"/);
  assert.match(kernelWorkspace, /rowActions/);
  assert.match(kernelWorkspace, /field\.type === "lookup"/);
  assert.doesNotMatch(`${route}\n${service}\n${migration}\n${moduleDescriptors}`, /samara|samarapattern|lorem ipsum|fake customer|sample customer/i);
});

