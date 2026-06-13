import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Fastify from "fastify";
import inventoryRoutes from "../src/routes/inventory.js";
import {
  InventoryInputError,
  createInventoryLot,
  createInventoryMaterial,
  listInventoryMaterials,
  updateInventoryLot,
  updateInventoryMaterial
} from "../src/services/inventory/inventoryManagement.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const TENANT_B = "00000000-0000-0000-0000-00000000000b";
const IDENTITY_A = "10000000-0000-0000-0000-00000000000a";
const MATERIAL_A = "30000000-0000-4000-8000-00000000000a";
const MATERIAL_B = "30000000-0000-4000-8000-00000000000b";
const LOT_A = "31000000-0000-4000-8000-00000000000a";
const AGENT_A = "40000000-0000-4000-8000-00000000000a";

const route = read("../src/routes/inventory.js");
const service = read("../src/services/inventory/inventoryManagement.js");
const server = read("../src/server.js");
const migration = read("../db/migrations/0125_inventory_management_v1.sql");
const registry = read("../../../apps/dashboard/src/engine/registry.jsx");
const dashboardSurface = read("../../../apps/dashboard/src/engine/surfaces/dashboard.js");
const seedSurface = read("../db/seed/ui_surface_dashboard.sql");
const workspace = read("../../../apps/dashboard/src/components/inventory/InventoryManagementWorkspace.jsx");
const docs = read("../../../docs/inventory_management_v1.md");

function material(overrides = {}) {
  return {
    id: overrides.id || MATERIAL_A,
    tenant_id: overrides.tenant_id || TENANT_A,
    code: overrides.code || "MAT-1",
    name: overrides.name || "Material One",
    material_type: overrides.material_type || "RAW_MATERIAL",
    attrs: overrides.attrs || {
      inventory_management_v1: {
        status: "ACTIVE",
        unit_of_measure: "pcs",
        default_supplier_entity_id: AGENT_A,
        safe_attrs: { color: "blue" }
      },
      inventory: {
        track_stock: true,
        reorder_point: 5,
        reorder_qty: 20,
        unit_of_measure: "pcs",
        preferred_supplier_agent_id: AGENT_A
      }
    },
    is_active: overrides.is_active ?? true,
    created_at: overrides.created_at || "2026-06-01T00:00:00.000Z",
    updated_at: overrides.updated_at || "2026-06-01T00:00:00.000Z"
  };
}

function lot(overrides = {}) {
  return {
    id: overrides.id || LOT_A,
    tenant_id: overrides.tenant_id || TENANT_A,
    material_id: overrides.material_id || MATERIAL_A,
    lot_code: overrides.lot_code || "LOT-1",
    status: overrides.status || "AVAILABLE",
    quantity: overrides.quantity ?? 12,
    uom: overrides.uom || "pcs",
    service_object_id: overrides.service_object_id || null,
    owner_agent_id: overrides.owner_agent_id || AGENT_A,
    attrs: overrides.attrs || {
      inventory_management_v1: {
        status: overrides.status || "AVAILABLE",
        unit: "pcs",
        supplier_agent_id: AGENT_A,
        safe_attrs: { bin: "A1" }
      }
    },
    is_active: overrides.is_active ?? true,
    created_at: overrides.created_at || "2026-06-01T00:00:00.000Z",
    updated_at: overrides.updated_at || "2026-06-01T00:00:00.000Z"
  };
}

function agent(overrides = {}) {
  return {
    id: overrides.id || AGENT_A,
    tenant_id: overrides.tenant_id || TENANT_A,
    agent_type: overrides.agent_type || "ORG",
    code: overrides.code || "SUP-1",
    name: overrides.name || "Supplier One",
    attrs: overrides.attrs || { roles: ["SUPPLIER"], status: "ACTIVE" },
    is_active: overrides.is_active ?? true
  };
}

function withMaterialJoin(row, state) {
  const supplierId = row.attrs?.inventory_management_v1?.default_supplier_entity_id || row.attrs?.inventory?.preferred_supplier_agent_id;
  const supplier = state.agents.find((item) => item.tenant_id === row.tenant_id && item.id === supplierId);
  return {
    ...row,
    supplier_id: supplier?.id || null,
    supplier_code: supplier?.code || null,
    supplier_name: supplier?.name || null,
    supplier_agent_type: supplier?.agent_type || null
  };
}

function withLotJoin(row, state) {
  const materialRow = state.materials.find((item) => item.tenant_id === row.tenant_id && item.id === row.material_id);
  const supplierId = row.attrs?.inventory_management_v1?.supplier_agent_id || row.owner_agent_id;
  const supplier = state.agents.find((item) => item.tenant_id === row.tenant_id && item.id === supplierId);
  return {
    ...row,
    material_code: materialRow?.code || null,
    material_name: materialRow?.name || null,
    material_attrs: materialRow?.attrs || {},
    supplier_id: supplier?.id || null,
    supplier_code: supplier?.code || null,
    supplier_name: supplier?.name || null,
    supplier_agent_type: supplier?.agent_type || null
  };
}

function buildDb(initial = {}, { permissionAllowed = true } = {}) {
  const state = {
    materials: initial.materials || [
      material(),
      material({ id: MATERIAL_B, tenant_id: TENANT_B, code: "OTHER", name: "Other tenant material" })
    ],
    lots: initial.lots || [
      lot(),
      lot({ id: "31000000-0000-4000-8000-00000000000b", tenant_id: TENANT_B, material_id: MATERIAL_B })
    ],
    agents: initial.agents || [agent()],
    links: [],
    infoRecords: [],
    statusEvents: [],
    securityEvents: [],
    conditions: initial.conditions || [],
    queries: []
  };

  const db = {
    state,
    async connect() {
      return { query: db.query, release() {} };
    },
    async query(sql, params = []) {
      state.queries.push({ sql, params });
      if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(String(sql).trim())) return { rowCount: 0, rows: [] };
      if (sql.includes("FROM eip_authz.identity_role")) return permissionAllowed ? { rowCount: 1, rows: [{ ok: 1 }] } : { rowCount: 0, rows: [] };
      if (sql.includes("FROM eip_auth.auth_identity_agent")) return { rowCount: 1, rows: [{ agent_id: AGENT_A }] };
      if (sql.includes("INSERT INTO eip_core.security_event")) {
        state.securityEvents.push(params);
        return { rowCount: 1, rows: [{ id: "event-1" }] };
      }
      if (sql.includes("FROM eip_core.commercial_condition")) {
        const rows = state.conditions.filter((row) => row.tenant_id === params[0]);
        return { rowCount: rows.length, rows };
      }
      if (sql.includes("SELECT count(*)::int AS total") && sql.includes("FROM eip_core.material m")) {
        const rows = state.materials.filter((row) => row.tenant_id === params[0] && row.attrs?.inventory_management_v1?.status !== "ARCHIVED");
        return { rowCount: 1, rows: [{ total: rows.length }] };
      }
      if (sql.includes("FROM eip_core.agent") && sql.includes("WHERE tenant_id=$1 AND id=$2")) {
        const row = state.agents.find((item) => item.tenant_id === params[0] && item.id === params[1]);
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
      }
      if (sql.includes("SELECT m.id") && sql.includes("WHERE m.tenant_id=$1 AND m.id=$2")) {
        const row = state.materials.find((item) => item.tenant_id === params[0] && item.id === params[1]);
        return { rowCount: row ? 1 : 0, rows: row ? [withMaterialJoin(row, state)] : [] };
      }
      if (sql.includes("SELECT m.id") && sql.includes("FROM eip_core.material m")) {
        const rows = state.materials.filter((row) => row.tenant_id === params[0]).map((row) => withMaterialJoin(row, state));
        return { rowCount: rows.length, rows };
      }
      if (/INSERT INTO eip_core\.material\s*\(/.test(sql)) {
        const row = material({
          id: `30000000-0000-4000-8000-${String(state.materials.length + 1).padStart(12, "0")}`,
          tenant_id: params[0],
          code: params[1],
          name: params[2],
          material_type: params[3],
          attrs: JSON.parse(params[4]),
          is_active: params[5]
        });
        state.materials.push(row);
        return { rowCount: 1, rows: [row] };
      }
      if (/UPDATE eip_core\.material\s/.test(sql)) {
        const row = state.materials.find((item) => item.tenant_id === params[0] && item.id === params[1]);
        if (!row) return { rowCount: 0, rows: [] };
        row.code = params[2];
        row.name = params[3];
        row.material_type = params[4];
        row.attrs = JSON.parse(params[5]);
        row.is_active = params[6];
        return { rowCount: 1, rows: [row] };
      }
      if (sql.includes("SELECT id, status, quantity, uom, attrs") && sql.includes("FROM eip_core.material_lot")) {
        const rows = state.lots.filter((row) => row.tenant_id === params[0] && row.material_id === params[1] && row.is_active);
        return { rowCount: rows.length, rows };
      }
      if (sql.includes("SELECT lot.id") && sql.includes("WHERE lot.tenant_id=$1 AND lot.id=$2")) {
        const row = state.lots.find((item) => item.tenant_id === params[0] && item.id === params[1]);
        return { rowCount: row ? 1 : 0, rows: row ? [withLotJoin(row, state)] : [] };
      }
      if (sql.includes("SELECT lot.id") && sql.includes("FROM eip_core.material_lot lot")) {
        const rows = state.lots.filter((row) => row.tenant_id === params[0] && row.material_id === params[1] && row.is_active).map((row) => withLotJoin(row, state));
        return { rowCount: rows.length, rows };
      }
      if (/INSERT INTO eip_core\.material_lot\s*\(/.test(sql)) {
        const row = lot({
          id: `31000000-0000-4000-8000-${String(state.lots.length + 1).padStart(12, "0")}`,
          tenant_id: params[0],
          material_id: params[1],
          lot_code: params[2],
          status: params[3],
          quantity: params[4],
          uom: params[5],
          owner_agent_id: params[6],
          attrs: JSON.parse(params[7])
        });
        state.lots.push(row);
        return { rowCount: 1, rows: [row] };
      }
      if (sql.includes("UPDATE eip_core.material_lot")) {
        const row = state.lots.find((item) => item.tenant_id === params[0] && item.id === params[1]);
        if (!row) return { rowCount: 0, rows: [] };
        row.lot_code = params[2];
        row.status = params[3];
        row.quantity = params[4];
        row.uom = params[5];
        row.owner_agent_id = params[6];
        row.attrs = JSON.parse(params[7]);
        row.is_active = params[8];
        return { rowCount: 1, rows: [row] };
      }
      if (sql.includes("INSERT INTO eip_core.material_lot_status_event")) {
        state.statusEvents.push({
          material_lot_id: params[1],
          from_status: params[2],
          to_status: params[3],
          reason_code: params[4]
        });
        return { rowCount: 1, rows: [{ id: "event-1" }] };
      }
      if (sql.includes("INSERT INTO eip_core.object_link")) {
        state.links.push({ src_kind: params[1], src_id: params[2], dst_kind: params[3], dst_id: params[4], relation_type: params[5] });
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes("FROM eip_core.object_link link") && sql.includes("JOIN eip_core.info_record")) return { rowCount: 0, rows: [] };
      if (sql.includes("FROM eip_core.object_link link") && sql.includes("JOIN eip_core.agent agent")) return { rowCount: 0, rows: [] };
      if (sql.includes("FROM eip_core.info_record")) return { rowCount: 0, rows: [] };
      if (sql.includes("FROM eip_core.material_lot_status_event")) return { rowCount: 0, rows: state.statusEvents };
      if (sql.includes("FROM eip_core.dropdown_list")) return { rowCount: 0, rows: [] };
      return { rowCount: 0, rows: [] };
    }
  };
  return db;
}

function appWithDb(db) {
  return {
    db,
    log: { info() {}, warn() {}, error() {} }
  };
}

test("material list is tenant scoped and derives stock from lots", async () => {
  const db = buildDb();
  const result = await listInventoryMaterials(appWithDb(db), { tenant_id: TENANT_A, identity_id: IDENTITY_A }, {});
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].code, "MAT-1");
  assert.equal(result.items[0].stock_summary.available_qty, 12);
  assert.equal(result.items.some((item) => item.code === "OTHER"), false);
  assert.equal(db.state.queries.some((query) => query.params.includes(TENANT_B)), false);
});

test("create and update material use material attrs, reject tenant override and sensitive attrs, and never hard delete", async () => {
  const db = buildDb({ materials: [], lots: [] });
  const app = appWithDb(db);
  const session = { tenant_id: TENANT_A, identity_id: IDENTITY_A };
  const created = await createInventoryMaterial(app, session, {
    code: "RM-1",
    name: "Raw Material",
    material_type: "RAW_MATERIAL",
    status: "ACTIVE",
    unit_of_measure: "kg",
    default_supplier_entity_id: AGENT_A,
    reorder_point: 5,
    reorder_qty: 25,
    attrs: { color: "natural" }
  });
  assert.equal(created.item.material_type, "RAW_MATERIAL");
  assert.equal(created.item.safe_attrs.color, "natural");

  const updated = await updateInventoryMaterial(app, session, created.item.id, { status: "ARCHIVED", notes: "retired" });
  assert.equal(updated.item.status, "ARCHIVED");
  assert.equal(updated.item.is_active, false);
  assert.equal(db.state.queries.some((query) => /DELETE\s+FROM/i.test(query.sql)), false);
  await assert.rejects(() => createInventoryMaterial(app, session, { tenant_id: TENANT_B, name: "Injected" }), InventoryInputError);
  await assert.rejects(() => createInventoryMaterial(app, session, { name: "Unsafe", attrs: { api_key: "secret" } }), InventoryInputError);
});

test("create and update lot write existing lot table and append status events", async () => {
  const db = buildDb();
  const app = appWithDb(db);
  const session = { tenant_id: TENANT_A, identity_id: IDENTITY_A };
  const created = await createInventoryLot(app, session, MATERIAL_A, {
    lot_code: "LOT-2",
    quantity: 8,
    unit: "pcs",
    status: "AVAILABLE",
    supplier_agent_id: AGENT_A
  });
  assert.equal(created.item.lot_code, "LOT-2");
  assert.equal(db.state.statusEvents.some((event) => event.to_status === "AVAILABLE"), true);

  const updated = await updateInventoryLot(app, session, created.item.id, {
    status: "RESERVED",
    quantity: 8,
    reason_code: "ORDER_RESERVATION"
  });
  assert.equal(updated.item.status, "RESERVED");
  assert.equal(db.state.statusEvents.some((event) => event.from_status === "AVAILABLE" && event.to_status === "RESERVED"), true);
});

test("inventory route enforces permission, CSRF, tenant override rejection, and no hard delete route", async () => {
  const denied = Fastify({ logger: false });
  denied.decorate("db", buildDb({}, { permissionAllowed: false }));
  denied.decorate("requireSession", async () => ({ ok: true, session: { tenant_id: TENANT_A, identity_id: IDENTITY_A, realm: "EIP" } }));
  denied.decorate("requireCsrf", async () => ({ ok: true }));
  denied.decorate("coreProcess", {});
  await denied.register(inventoryRoutes, { prefix: "/api/eip/inventory" });
  const forbidden = await denied.inject({ method: "GET", url: "/api/eip/inventory/materials" });
  assert.equal(forbidden.statusCode, 403);
  await denied.close();

  const invalid = Fastify({ logger: false });
  invalid.decorate("db", buildDb());
  invalid.decorate("requireSession", async () => ({ ok: true, session: { tenant_id: TENANT_A, identity_id: IDENTITY_A, realm: "EIP" } }));
  invalid.decorate("requireCsrf", async () => ({ ok: true }));
  invalid.decorate("coreProcess", {});
  await invalid.register(inventoryRoutes, { prefix: "/api/eip/inventory" });
  const response = await invalid.inject({
    method: "POST",
    url: "/api/eip/inventory/materials",
    payload: { tenant_id: TENANT_B, name: "Injected" }
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "TENANT_OVERRIDE_NOT_ALLOWED");
  await invalid.close();

  assert.doesNotMatch(route, /app\.delete\(/i);
});

test("route family, service tables, and policy helper integration match Inventory Management V1", () => {
  for (const endpoint of [
    '"/materials"',
    '"/materials/:id"',
    '"/materials/:id/lots"',
    '"/lots/:id"',
    '"/materials/:id/summary"',
    '"/reorder-recommendations"',
    '"/policies/effective"',
    '"/governance/options"'
  ]) {
    assert.match(route, new RegExp(endpoint.replace(/[/:]/g, "\\$&")));
  }
  assert.match(server, /app\.register\(inventoryRoutes, \{ prefix: "\/api\/eip\/inventory" \}\)/);
  assert.match(route, /app\.requireSession\(req, \{ realm: "EIP" \}\)/);
  assert.match(route, /app\.requireCsrf\(req\)/);
  assert.match(route, /hasPermission\(/);
  for (const permission of Object.values({
    read: "inventory.read",
    materialCreate: "inventory.material.create",
    materialUpdate: "inventory.material.update",
    lotCreate: "inventory.lot.create",
    lotUpdate: "inventory.lot.update",
    recommendationRead: "inventory.recommendation.read",
    policyRead: "inventory.policy.read"
  })) {
    assert.match(service, new RegExp(permission.replace(/[.]/g, "\\.")));
    assert.match(migration, new RegExp(permission.replace(/[.]/g, "\\.")));
  }
  assert.match(route, /INVENTORY_MANAGEMENT_PERMISSIONS/);
  for (const table of [
    "eip_core.material",
    "eip_core.material_lot",
    "eip_core.material_lot_status_event",
    "eip_core.agent",
    "eip_core.commercial_condition",
    "eip_core.info_record",
    "eip_core.object_link"
  ]) {
    assert.match(service, new RegExp(table.replace(".", "\\.")));
  }
  assert.match(service, /resolveEffectivePolicy/);
  assert.match(service, /normalizeEffectivePolicyQuery/);
  assert.match(service, /emitSecurityEvent/);
  assert.match(service, /safe_attrs/);
  assert.match(service, /TENANT_OVERRIDE_NOT_ALLOWED/);
  assert.doesNotMatch(service, /DELETE\s+FROM/i);
});

test("migration is additive, reuses kernel tables, seeds governance, and wires descriptor metadata", () => {
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i);
  for (const value of [
    "INVENTORY_MATERIAL_TYPE",
    "INVENTORY_MATERIAL_STATUS",
    "INVENTORY_LOT_STATUS",
    "module_catalog",
    "tenant_module_setting",
    "InventoryManagementWorkspace",
    "material_lot_inventory_status_idx",
    "role_template_permission",
    "role_permission",
    "kernel_tables"
  ]) {
    assert.match(migration, new RegExp(value));
  }
});

test("dashboard registry, source descriptor, seed descriptor, and workspace are aligned", () => {
  assert.match(registry, /import InventoryManagementWorkspace/);
  assert.match(registry, /InventoryManagementWorkspace,/);
  assert.match(dashboardSurface, /type: "InventoryManagementWorkspace"/);
  assert.match(dashboardSurface, /\/api\/eip\/inventory\/materials\/:id\/lots/);
  assert.match(dashboardSurface, /\/api\/eip\/inventory\/reorder-recommendations/);
  assert.match(dashboardSurface, /\/api\/eip\/inventory\/policies\/effective/);
  assert.match(seedSurface, /"type": "InventoryManagementWorkspace"/);
  assert.match(seedSurface, /"materialLots": "\/api\/eip\/inventory\/materials\/:id\/lots"/);
  assert.match(seedSurface, /"policiesEffective": "\/api\/eip\/inventory\/policies\/effective"/);
  for (const label of ["Overview", "Materials", "Lots", "Reorder", "Policies", "Documents", "Activity"]) {
    assert.match(workspace, new RegExp(label));
  }
  assert.match(workspace, /method: "POST"/);
  assert.match(workspace, /method: "PATCH"/);
  assert.match(workspace, /inventory\.material\.create/);
  assert.match(workspace, /inventory\.lot\.update/);
});

test("docs and touched files are production-data-only and avoid fake/demo data", () => {
  const touched = `${route}\n${service}\n${migration}\n${workspace}\n${docs}`;
  assert.match(docs, /No new tables/);
  assert.match(docs, /never hard-deletes/i);
  assert.match(docs, /effective-policy helper/i);
  assert.doesNotMatch(touched, /samara|samarapattern|samara-web-storefront/i);
  assert.doesNotMatch(touched, /lorem ipsum|sample customer|fake customer|manual_test/i);
});
