import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import policiesConditionsRoutes from "../src/routes/policies_conditions.js";
import {
  getPolicyConditionDetail,
  listPolicyConditions,
  mapCommercialConditionToPolicyCondition
} from "../src/services/policiesConditions/readModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const TENANT_B = "00000000-0000-0000-0000-00000000000b";
const IDENTITY_A = "10000000-0000-0000-0000-00000000000a";

function condition(overrides = {}) {
  return {
    id: overrides.id || "20000000-0000-0000-0000-000000000001",
    tenant_id: overrides.tenant_id || TENANT_A,
    code: overrides.code || "PROCUREMENT_POLICY_DEFAULT",
    label: overrides.label || "Procurement policy default",
    condition_type: overrides.condition_type || "PROCUREMENT_POLICY",
    condition_category: overrides.condition_category || "PURCHASING",
    priority: overrides.priority ?? 100,
    valid_from: overrides.valid_from ?? null,
    valid_to: overrides.valid_to ?? null,
    is_active: overrides.is_active ?? true,
    scope: overrides.scope || {},
    effect: overrides.effect || { procurement_policy: { minimum_quote_count: 3 } },
    attrs: overrides.attrs || {},
    created_at: overrides.created_at || "2026-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at || "2026-01-02T00:00:00.000Z"
  };
}

function buildDb(rows = [], { permissionAllowed = true, queries = [] } = {}) {
  return {
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (sql.includes("FROM eip_authz.identity_role")) {
        return permissionAllowed ? { rowCount: 1, rows: [{ ok: 1 }] } : { rowCount: 0, rows: [] };
      }
      if (sql.includes("FROM eip_core.commercial_condition")) {
        const tenantId = params[0];
        const id = params[1];
        const scoped = rows.filter((row) => row.tenant_id === tenantId);
        const resultRows = id ? scoped.filter((row) => row.id === id) : scoped;
        return { rowCount: resultRows.length, rows: resultRows };
      }
      return { rowCount: 0, rows: [] };
    }
  };
}

async function buildRouteApp({ rows = [], permissionAllowed = true, authenticated = true } = {}) {
  const app = Fastify({ logger: false });
  app.decorate("db", buildDb(rows, { permissionAllowed }));
  app.decorate("requireSession", async () => {
    if (!authenticated) return { ok: false, status: 401, error: "UNAUTHENTICATED" };
    return {
      ok: true,
      session: {
        tenant_id: TENANT_A,
        identity_id: IDENTITY_A,
        realm: "EIP"
      }
    };
  });
  await app.register(policiesConditionsRoutes, { prefix: "/api/eip/policies-conditions" });
  return app;
}

test("legacy commercial condition rows map to canonical read model classifications", () => {
  const procurement = mapCommercialConditionToPolicyCondition(condition());
  assert.equal(procurement.source.physical_table, "eip_core.commercial_condition");
  assert.equal(procurement.classification.policy_domain, "PROCUREMENT");
  assert.equal(procurement.classification.policy_family, "PURCHASE_REQUISITION");
  assert.equal(procurement.classification.condition_type, "PROCUREMENT_ROUTE");
  assert.equal(procurement.classification.mapping_status, "mapped");

  const inventory = mapCommercialConditionToPolicyCondition(condition({
    condition_type: "INVENTORY_REORDER_POLICY",
    condition_category: "INVENTORY"
  }));
  assert.equal(inventory.classification.policy_domain, "INVENTORY");
  assert.equal(inventory.classification.policy_family, "REPLENISHMENT");

  const tax = mapCommercialConditionToPolicyCondition(condition({
    condition_type: "TAX",
    condition_category: "VAT"
  }));
  assert.equal(tax.classification.policy_domain, "FISCAL_TAX_TREATMENT");
  assert.equal(tax.classification.condition_nature, "REGULATION_DERIVED_OPERATIONAL_POLICY");

  const ambiguous = mapCommercialConditionToPolicyCondition(condition({
    condition_type: "TRADE_TERMS",
    condition_category: "TRADE"
  }));
  assert.equal(ambiguous.status, "needs_review");
  assert.equal(ambiguous.classification.mapping_status, "legacy_ambiguous");
  assert.equal(ambiguous.warnings.some((warning) => warning.code === "CLASSIFICATION_NEEDS_REVIEW"), true);
});

test("explicit attrs.classification is preferred over legacy mapping", () => {
  const mapped = mapCommercialConditionToPolicyCondition(condition({
    condition_type: "TRADE_TERMS",
    attrs: {
      classification: {
        policy_domain: "SELLING",
        policy_family: "PRICE_POLICY",
        condition_type: "PRICE",
        condition_nature: "INTERNAL_MANAGEMENT_POLICY"
      }
    }
  }));

  assert.equal(mapped.classification.policy_domain, "SELLING");
  assert.equal(mapped.classification.mapping_source, "attrs.classification");
  assert.equal(mapped.status, "active");
});

test("list read model returns real tenant rows with pagination, filters, and empty state", async () => {
  const rows = [
    condition({ id: "20000000-0000-0000-0000-000000000001", tenant_id: TENANT_A, code: "A_PRICE", condition_type: "PRICE", condition_category: "PRICING" }),
    condition({ id: "20000000-0000-0000-0000-000000000002", tenant_id: TENANT_A, code: "A_TAX", condition_type: "TAX", condition_category: "VAT" }),
    condition({ id: "20000000-0000-0000-0000-000000000003", tenant_id: TENANT_B, code: "B_PRICE", condition_type: "PRICE", condition_category: "PRICING" })
  ];
  const queries = [];
  const app = { db: buildDb(rows, { queries }) };

  const pageOne = await listPolicyConditions(app, { tenant_id: TENANT_A }, { page: 1, page_size: 1 });
  assert.equal(pageOne.total, 2);
  assert.equal(pageOne.total_pages, 2);
  assert.equal(pageOne.items.length, 1);
  assert.equal(pageOne.items.some((item) => item.code === "B_PRICE"), false);
  assert.equal(queries.some((query) => query.params[0] === TENANT_A), true);

  const filtered = await listPolicyConditions(app, { tenant_id: TENANT_A }, { condition_type: "TAX" });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.items[0].classification.policy_domain, "FISCAL_TAX_TREATMENT");

  const empty = await listPolicyConditions({ db: buildDb([]) }, { tenant_id: TENANT_A }, {});
  assert.equal(empty.total, 0);
  assert.equal(empty.empty_state.title, "No policies or conditions yet");
});

test("detail read model is tenant-scoped and redacts sensitive machine fields", async () => {
  const rows = [
    condition({
      id: "20000000-0000-0000-0000-000000000099",
      tenant_id: TENANT_A,
      effect: {
        price: { amount: 10, api_key: "secret-key" },
        raw_legal_text: "do not expose"
      },
      attrs: {
        credential: "hidden",
        governance_source: "test"
      },
      scope: {
        channel: "web",
        signature_secret: "hidden"
      }
    })
  ];
  const app = { db: buildDb(rows) };
  const detail = await getPolicyConditionDetail(app, { tenant_id: TENANT_A }, rows[0].id);
  assert.equal(detail.item.safe_machine_fields.effect.price.api_key, "[redacted]");
  assert.equal(detail.item.safe_machine_fields.effect.raw_legal_text, "[redacted]");
  assert.equal(detail.item.safe_machine_fields.attrs.credential, "[redacted]");
  assert.equal(detail.item.safe_machine_fields.scope.signature_secret, "[redacted]");
  assert.equal(detail.item.warnings.some((warning) => warning.code === "REDACTED_FIELDS"), true);

  const otherTenant = await getPolicyConditionDetail(app, { tenant_id: TENANT_B }, rows[0].id);
  assert.equal(otherTenant, null);
});

test("read-only route rejects unauthenticated and unauthorized requests", async () => {
  const unauthenticated = await buildRouteApp({ authenticated: false });
  const unauthRes = await unauthenticated.inject({ method: "GET", url: "/api/eip/policies-conditions" });
  assert.equal(unauthRes.statusCode, 401);
  await unauthenticated.close();

  const forbidden = await buildRouteApp({ permissionAllowed: false });
  const forbiddenRes = await forbidden.inject({ method: "GET", url: "/api/eip/policies-conditions" });
  assert.equal(forbiddenRes.statusCode, 403);
  assert.equal(forbiddenRes.json().error, "FORBIDDEN");
  await forbidden.close();
});

test("read-only route lists and details only current tenant commercial_condition rows", async () => {
  const rows = [
    condition({ id: "20000000-0000-0000-0000-0000000000aa", tenant_id: TENANT_A, code: "TENANT_A_PRICE", condition_type: "PRICE" }),
    condition({ id: "20000000-0000-0000-0000-0000000000bb", tenant_id: TENANT_B, code: "TENANT_B_PRICE", condition_type: "PRICE" })
  ];
  const app = await buildRouteApp({ rows });

  const list = await app.inject({ method: "GET", url: "/api/eip/policies-conditions?page=1&page_size=25" });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().items.length, 1);
  assert.equal(list.json().items[0].code, "TENANT_A_PRICE");

  const detail = await app.inject({ method: "GET", url: "/api/eip/policies-conditions/20000000-0000-0000-0000-0000000000aa" });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().item.code, "TENANT_A_PRICE");

  const otherTenant = await app.inject({ method: "GET", url: "/api/eip/policies-conditions/20000000-0000-0000-0000-0000000000bb" });
  assert.equal(otherTenant.statusCode, 404);
  assert.equal(otherTenant.json().error, "POLICY_CONDITION_NOT_FOUND");
  await app.close();
});

test("phase 2 wiring is read-only, descriptor-backed, and has no fake policy rows", () => {
  const server = read("services/api/src/server.js");
  const route = read("services/api/src/routes/policies_conditions.js");
  const service = read("services/api/src/services/policiesConditions/readModel.js");
  const registry = read("apps/dashboard/src/engine/registry.jsx");
  const dashboardSurface = read("apps/dashboard/src/engine/surfaces/dashboard.js");
  const seedSurface = read("services/api/db/seed/ui_surface_dashboard.sql");
  const migration = read("services/api/db/migrations/0121_policies_conditions_readonly_center.sql");

  assert.match(server, /policiesConditionsRoutes/);
  assert.match(server, /prefix: "\/api\/eip\/policies-conditions"/);
  assert.match(route, /app\.get\("\/"/);
  assert.match(route, /app\.get\("\/:id"/);
  assert.doesNotMatch(route, /app\.(post|patch|put|delete)\(/i);
  assert.match(route, /app\.requireSession\(req, \{ realm: "EIP" \}\)/);
  assert.match(route, /policies_conditions\.read/);
  assert.match(service, /FROM eip_core\.commercial_condition/);
  assert.match(service, /WHERE tenant_id=\$1/);
  assert.doesNotMatch(service, /INSERT INTO|UPDATE eip_core\.commercial_condition|DELETE FROM eip_core\.commercial_condition/i);
  assert.doesNotMatch(service, /sample|demo|fake/i);
  assert.match(registry, /PoliciesConditionsWorkspace/);
  assert.match(dashboardSurface, /Policies & Conditions/);
  assert.match(dashboardSurface, /type: "PoliciesConditionsWorkspace"/);
  assert.match(seedSurface, /PoliciesConditionsWorkspace/);
  assert.match(migration, /policies_conditions\.read/);
  assert.match(migration, /role_template_permission/);
  assert.doesNotMatch(migration, /CREATE TABLE/i);
});
