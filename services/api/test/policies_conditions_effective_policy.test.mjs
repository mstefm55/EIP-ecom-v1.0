import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import policiesConditionsRoutes from "../src/routes/policies_conditions.js";
import {
  normalizeEffectivePolicyQuery,
  resolveEffectivePolicy
} from "../src/services/policiesConditions/effectivePolicy.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const TENANT_B = "00000000-0000-0000-0000-00000000000b";
const IDENTITY_A = "10000000-0000-0000-0000-00000000000a";
const MATERIAL_A = "30000000-0000-0000-0000-00000000000a";
const PRODUCT_A = "30000000-0000-0000-0000-00000000000b";
const SUPPLIER_A = "40000000-0000-0000-0000-00000000000a";
const CUSTOMER_A = "40000000-0000-0000-0000-00000000000b";
const MARKETPLACE_A = "40000000-0000-0000-0000-00000000000c";
const WAREHOUSE_A = "50000000-0000-0000-0000-00000000000a";

function condition(overrides = {}) {
  return {
    id: overrides.id || "20000000-0000-0000-0000-000000000001",
    tenant_id: overrides.tenant_id || TENANT_A,
    code: overrides.code || "TENANT_DEFAULT_REORDER",
    label: overrides.label || "Tenant default reorder policy",
    condition_type: overrides.condition_type || "INVENTORY_REORDER_POLICY",
    condition_category: overrides.condition_category || "INVENTORY",
    priority: overrides.priority ?? 100,
    valid_from: overrides.valid_from ?? null,
    valid_to: overrides.valid_to ?? null,
    is_active: overrides.is_active ?? true,
    scope: overrides.scope || {},
    effect: overrides.effect || { reorder_policy: { reorder_point_qty: 10, currency: "EUR" } },
    attrs: overrides.attrs || {},
    created_at: overrides.created_at || "2026-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at || "2026-01-02T00:00:00.000Z"
  };
}

function classified(overrides = {}, classification = {}) {
  return condition({
    condition_type: overrides.condition_type || classification.condition_type || "PRICE",
    condition_category: overrides.condition_category || "PRICING",
    ...overrides,
    attrs: {
      ...(overrides.attrs || {}),
      classification: {
        policy_domain: classification.policy_domain || "COMMERCIAL",
        policy_family: classification.policy_family || "PRICE_POLICY",
        condition_type: classification.condition_type || "PRICE",
        condition_subtype: classification.condition_subtype || null,
        condition_nature: classification.condition_nature || "INTERNAL_MANAGEMENT_POLICY"
      }
    }
  });
}

function buildDb(rows = [], { permissionAllowed = true, queries = [] } = {}) {
  return {
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (sql.includes("FROM eip_authz.identity_role")) {
        const allowed = permissionAllowed && params[2] === "policies_conditions.read_effective";
        return allowed ? { rowCount: 1, rows: [{ ok: 1 }] } : { rowCount: 0, rows: [] };
      }
      if (sql.includes("FROM eip_core.commercial_condition")) {
        const tenantId = params[0];
        const scoped = rows.filter((row) => row.tenant_id === tenantId);
        return { rowCount: scoped.length, rows: scoped };
      }
      return { rowCount: 0, rows: [] };
    }
  };
}

async function buildRouteApp({ rows = [], permissionAllowed = true, authenticated = true, queries = [] } = {}) {
  const app = Fastify({ logger: false });
  app.decorate("db", buildDb(rows, { permissionAllowed, queries }));
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

async function resolve(rows, context) {
  return resolveEffectivePolicy({ db: buildDb(rows) }, { tenant_id: TENANT_A, identity_id: IDENTITY_A }, normalizeEffectivePolicyQuery(context));
}

test("effective route rejects unauthenticated and missing permission requests", async () => {
  const unauthenticated = await buildRouteApp({ authenticated: false });
  const unauthRes = await unauthenticated.inject({ method: "GET", url: "/api/eip/policies-conditions/effective" });
  assert.equal(unauthRes.statusCode, 401);
  await unauthenticated.close();

  const queries = [];
  const forbidden = await buildRouteApp({ permissionAllowed: false, queries });
  const forbiddenRes = await forbidden.inject({ method: "GET", url: "/api/eip/policies-conditions/effective" });
  assert.equal(forbiddenRes.statusCode, 403);
  assert.equal(forbiddenRes.json().error, "FORBIDDEN");
  assert.equal(queries.some((query) => query.params[2] === "policies_conditions.read_effective"), true);
  await forbidden.close();
});

test("effective route returns safe 400 responses for invalid context", async () => {
  const app = await buildRouteApp();
  const cases = [
    ["/api/eip/policies-conditions/effective?material_id=not-a-uuid", "material_id"],
    ["/api/eip/policies-conditions/effective?effective_at=not-a-date", "effective_at"],
    ["/api/eip/policies-conditions/effective?quantity=-1", "quantity"],
    [`/api/eip/policies-conditions/effective?tenant_id=${TENANT_B}`, "tenant_id"],
    ["/api/eip/policies-conditions/effective?unexpected=value", "unexpected"]
  ];

  for (const [url, field] of cases) {
    const response = await app.inject({ method: "GET", url });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "INVALID_EFFECTIVE_POLICY_CONTEXT");
    assert.equal(response.json().details.some((item) => item.field === field), true);
  }
  await app.close();
});

test("effective helper resolves tenant-default rows and never reads another tenant", async () => {
  const rows = [
    condition({ code: "TENANT_A_DEFAULT", tenant_id: TENANT_A }),
    condition({
      code: "TENANT_B_MATERIAL",
      tenant_id: TENANT_B,
      scope: { material_id: MATERIAL_A },
      priority: 1
    })
  ];

  const result = await resolve(rows, {
    policy_domain: "INVENTORY",
    policy_family: "REPLENISHMENT",
    condition_type: "REORDER_POLICY",
    effective_at: "2026-06-13T00:00:00.000Z"
  });

  assert.equal(result.resolution_status, "resolved");
  assert.equal(result.selected_condition.code, "TENANT_A_DEFAULT");
  assert.equal(result.fallback_used, true);
  assert.equal(JSON.stringify(result).includes("TENANT_B_MATERIAL"), false);
  assert.equal(JSON.stringify(result).includes("tenant_id"), false);
});

test("material-specific condition beats tenant default and explains exclusions", async () => {
  const rows = [
    condition({ id: "20000000-0000-0000-0000-000000000010", code: "TENANT_DEFAULT_REORDER" }),
    condition({
      id: "20000000-0000-0000-0000-000000000011",
      code: "MATERIAL_REORDER",
      label: "Material-specific Inventory reorder policy",
      scope: { material_id: MATERIAL_A }
    })
  ];

  const result = await resolve(rows, {
    policy_domain: "INVENTORY",
    condition_type: "REORDER_POLICY",
    material_id: MATERIAL_A,
    effective_at: "2026-06-13T00:00:00.000Z"
  });

  assert.equal(result.resolution_status, "resolved");
  assert.equal(result.selected_condition.code, "MATERIAL_REORDER");
  assert.equal(result.selected_condition.resolution.specificity_factors.includes("material"), true);
  assert.equal(result.excluded_conditions.some((item) => item.reason === "lower_specificity" && item.condition.code === "TENANT_DEFAULT_REORDER"), true);
  assert.equal(result.precedence_trace.some((item) => item.step === "precedence"), true);
  assert.equal(result.explanation.some((line) => line.includes("most specific")), true);
});

test("supplier, customer, warehouse, jurisdiction, and channel scopes match only supplied context", async () => {
  const rows = [
    classified({ code: "SUPPLIER_PAYMENT", scope: { supplier_agent_id: SUPPLIER_A } }, {
      policy_domain: "COMMERCIAL",
      policy_family: "PAYMENT_TERMS",
      condition_type: "PAYMENT_TERMS"
    }),
    classified({ code: "CUSTOMER_DISCOUNT", scope: { customer_agent_id: CUSTOMER_A } }, {
      policy_domain: "COMMERCIAL",
      policy_family: "DISCOUNT_POLICY",
      condition_type: "DISCOUNT"
    }),
    condition({ code: "WAREHOUSE_REORDER", scope: { warehouse_agent_id: WAREHOUSE_A } }),
    classified({ code: "MU_TAX", condition_type: "TAX", condition_category: "VAT", scope: { jurisdiction: "MU" } }, {
      policy_domain: "FISCAL_TAX_TREATMENT",
      policy_family: "TAX_CATEGORY",
      condition_type: "TAX"
    }),
    classified({ code: "B2B_PRICE", scope: { channel: "B2B", marketplace_agent_id: MARKETPLACE_A } }, {
      policy_domain: "COMMERCIAL",
      policy_family: "PRICE_POLICY",
      condition_type: "PRICE"
    })
  ];

  const supplier = await resolve(rows, { policy_domain: "COMMERCIAL", condition_type: "PAYMENT_TERMS", supplier_agent_id: SUPPLIER_A });
  assert.equal(supplier.selected_condition.code, "SUPPLIER_PAYMENT");

  const customer = await resolve(rows, { policy_domain: "COMMERCIAL", condition_type: "DISCOUNT", customer_agent_id: CUSTOMER_A });
  assert.equal(customer.selected_condition.code, "CUSTOMER_DISCOUNT");

  const warehouse = await resolve(rows, { policy_domain: "INVENTORY", condition_type: "REORDER_POLICY", warehouse_agent_id: WAREHOUSE_A });
  assert.equal(warehouse.selected_condition.code, "WAREHOUSE_REORDER");

  const jurisdiction = await resolve(rows, { policy_domain: "FISCAL_TAX_TREATMENT", condition_type: "TAX", jurisdiction: "MU" });
  assert.equal(jurisdiction.selected_condition.code, "MU_TAX");

  const channel = await resolve(rows, {
    policy_domain: "COMMERCIAL",
    condition_type: "PRICE",
    channel: "B2B",
    marketplace_agent_id: MARKETPLACE_A
  });
  assert.equal(channel.selected_condition.code, "B2B_PRICE");
});

test("priority and updated_at are deterministic tiebreakers", async () => {
  const priorityRows = [
    condition({ code: "MATERIAL_PRIORITY_20", scope: { material_id: MATERIAL_A }, priority: 20 }),
    condition({ code: "MATERIAL_PRIORITY_5", scope: { material_id: MATERIAL_A }, priority: 5 })
  ];
  const priority = await resolve(priorityRows, {
    policy_domain: "INVENTORY",
    condition_type: "REORDER_POLICY",
    material_id: MATERIAL_A
  });
  assert.equal(priority.selected_condition.code, "MATERIAL_PRIORITY_5");
  assert.equal(priority.excluded_conditions.some((item) => item.reason === "lower_priority"), true);

  const updatedRows = [
    condition({ code: "OLDER_PRODUCT", scope: { product_id: PRODUCT_A }, priority: 10, updated_at: "2026-01-01T00:00:00.000Z" }),
    condition({ code: "NEWER_PRODUCT", scope: { product_id: PRODUCT_A }, priority: 10, updated_at: "2026-02-01T00:00:00.000Z" })
  ];
  const updated = await resolve(updatedRows, {
    policy_domain: "INVENTORY",
    condition_type: "REORDER_POLICY",
    product_id: PRODUCT_A
  });
  assert.equal(updated.selected_condition.code, "NEWER_PRODUCT");
});

test("future, expired, and inactive conditions are excluded with reasons", async () => {
  const rows = [
    condition({ code: "FUTURE_REORDER", valid_from: "2026-07-01T00:00:00.000Z" }),
    condition({ code: "EXPIRED_REORDER", valid_to: "2026-01-01T00:00:00.000Z" }),
    condition({ code: "INACTIVE_REORDER", is_active: false })
  ];

  const result = await resolve(rows, {
    policy_domain: "INVENTORY",
    condition_type: "REORDER_POLICY",
    effective_at: "2026-06-13T00:00:00.000Z"
  });

  assert.equal(result.resolution_status, "no_match");
  assert.equal(result.excluded_conditions.some((item) => item.reason === "not_yet_valid"), true);
  assert.equal(result.excluded_conditions.some((item) => item.reason === "expired"), true);
  assert.equal(result.excluded_conditions.some((item) => item.reason === "inactive"), true);
});

test("equal exclusive specificity and priority returns a conflict", async () => {
  const rows = [
    condition({
      id: "20000000-0000-0000-0000-000000000020",
      code: "CONFLICT_A",
      scope: { material_id: MATERIAL_A },
      priority: 10,
      updated_at: "2026-01-01T00:00:00.000Z"
    }),
    condition({
      id: "20000000-0000-0000-0000-000000000021",
      code: "CONFLICT_B",
      scope: { material_id: MATERIAL_A },
      priority: 10,
      updated_at: "2026-01-01T00:00:00.000Z"
    })
  ];

  const result = await resolve(rows, {
    policy_domain: "INVENTORY",
    condition_type: "REORDER_POLICY",
    material_id: MATERIAL_A
  });

  assert.equal(result.resolution_status, "conflict");
  assert.equal(result.selected_condition, null);
  assert.equal(result.applicable_conditions.length, 2);
  assert.equal(result.conflicts.some((item) => item.code === "EQUAL_SCOPE_PRIORITY"), true);
});

test("no-match result returns classification and scope exclusion reasons", async () => {
  const rows = [
    classified({ code: "COMMERCIAL_PRICE", scope: { channel: "B2B" } }, {
      policy_domain: "COMMERCIAL",
      policy_family: "PRICE_POLICY",
      condition_type: "PRICE"
    })
  ];

  const result = await resolve(rows, {
    policy_domain: "INVENTORY",
    condition_type: "REORDER_POLICY",
    channel: "B2B"
  });

  assert.equal(result.resolution_status, "no_match");
  assert.equal(result.selected_condition, null);
  assert.equal(result.excluded_conditions.some((item) => item.reason === "domain_mismatch"), true);
});

test("currency mismatch, missing context, and incomplete custom domain return conflicts", async () => {
  const currency = await resolve([
    classified({
      code: "USD_PRICE",
      effect: { price: { amount: 10, currency: "USD" } }
    }, {
      policy_domain: "COMMERCIAL",
      policy_family: "PRICE_POLICY",
      condition_type: "PRICE"
    })
  ], {
    policy_domain: "COMMERCIAL",
    condition_type: "PRICE",
    currency: "EUR"
  });
  assert.equal(currency.resolution_status, "conflict");
  assert.equal(currency.excluded_conditions.some((item) => item.reason === "conflicting_currency"), true);
  assert.equal(currency.conflicts.some((item) => item.code === "CONFLICTING_CURRENCY"), true);

  const missing = await resolve([
    classified({ code: "SUPPLIER_PAYMENT_REQUIRED", scope: { supplier_agent_id: SUPPLIER_A } }, {
      policy_domain: "COMMERCIAL",
      policy_family: "PAYMENT_TERMS",
      condition_type: "PAYMENT_TERMS"
    })
  ], {
    policy_domain: "COMMERCIAL",
    condition_type: "PAYMENT_TERMS"
  });
  assert.equal(missing.resolution_status, "conflict");
  assert.equal(missing.excluded_conditions.some((item) => item.reason === "missing_context"), true);
  assert.equal(missing.conflicts.some((item) => item.code === "MISSING_CONTEXT"), true);

  const custom = await resolve([
    classified({ code: "CUSTOM_RISK_HOLD" }, {
      policy_domain: "CUSTOM_RISK",
      policy_family: "LOCAL_EXCEPTION",
      condition_type: "RISK_HOLD"
    })
  ], { policy_domain: "CUSTOM_RISK" });
  assert.equal(custom.resolution_status, "conflict");
  assert.equal(custom.selected_condition, null);
  assert.equal(custom.conflicts.some((item) => item.code === "CUSTOM_DOMAIN_CONTEXT_INCOMPLETE"), true);
});

test("commercial payment terms, Incoterms, custom domains, and ambiguous rows are handled", async () => {
  const payment = await resolve([
    condition({
      code: "NET_30_PAYMENT",
      condition_type: "PAYMENT_TERM_CONDITION",
      condition_category: "FINANCE"
    })
  ], { policy_domain: "COMMERCIAL", condition_type: "PAYMENT_TERMS" });
  assert.equal(payment.selected_condition.code, "NET_30_PAYMENT");
  assert.equal(payment.selected_condition.classification.policy_family, "PAYMENT_TERMS");

  const incoterm = await resolve([
    condition({
      code: "FOB_INCOTERM",
      condition_type: "TRADE_TERMS",
      condition_category: "TRADE",
      attrs: { incoterm: "FOB" },
      effect: { trade_terms: { incoterm: "FOB" } }
    })
  ], {
    policy_domain: "COMMERCIAL",
    policy_family: "INCOTERMS",
    condition_type: "INCOTERM",
    condition_subtype: "FOB"
  });
  assert.equal(incoterm.selected_condition.code, "FOB_INCOTERM");

  const custom = await resolve([
    classified({ code: "CUSTOM_RISK_HOLD" }, {
      policy_domain: "CUSTOM_RISK",
      policy_family: "LOCAL_EXCEPTION",
      condition_type: "RISK_HOLD"
    })
  ], {
    policy_domain: "CUSTOM_RISK",
    policy_family: "LOCAL_EXCEPTION",
    condition_type: "RISK_HOLD"
  });
  assert.equal(custom.resolution_status, "resolved");
  assert.equal(custom.selected_condition.classification.policy_domain, "CUSTOM_RISK");

  const ambiguous = await resolve([
    condition({
      code: "FOREX_REVIEW",
      condition_type: "FOREX_RATE",
      condition_category: "FOREX"
    })
  ], { condition_type: "FOREX_RATE" });
  assert.equal(ambiguous.resolution_status, "needs_review");
  assert.equal(ambiguous.warnings.some((item) => item.code === "AMBIGUOUS_CLASSIFICATION"), true);
});

test("effective response does not expose raw secrets or raw legal text", async () => {
  const result = await resolve([
    classified({
      code: "SECURE_PRICE",
      scope: { channel: "B2B", api_key: "sk_live_secret_scope" },
      effect: { price: { amount: 99, currency: "EUR", api_key: "sk_live_secret_effect" } },
      attrs: { raw_legal_text: "do not expose this legal text" }
    }, {
      policy_domain: "COMMERCIAL",
      policy_family: "PRICE_POLICY",
      condition_type: "PRICE"
    })
  ], {
    policy_domain: "COMMERCIAL",
    condition_type: "PRICE",
    channel: "B2B",
    currency: "EUR"
  });

  const serialized = JSON.stringify(result);
  assert.equal(result.selected_condition.code, "SECURE_PRICE");
  assert.equal(serialized.includes("sk_live_secret_scope"), false);
  assert.equal(serialized.includes("sk_live_secret_effect"), false);
  assert.equal(serialized.includes("do not expose"), false);
  assert.equal(serialized.includes("raw_legal_text"), false);
});

test("effective route is GET-only, production-data-only, and permission-migrated", async () => {
  const app = await buildRouteApp({
    rows: [condition({ code: "TENANT_DEFAULT_REORDER" })]
  });
  const response = await app.inject({
    method: "GET",
    url: "/api/eip/policies-conditions/effective?policy_domain=INVENTORY&condition_type=REORDER_POLICY"
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().source.physical_table, "eip_core.commercial_condition");

  const post = await app.inject({ method: "POST", url: "/api/eip/policies-conditions/effective" });
  assert.equal(post.statusCode, 404);
  await app.close();

  const route = read("services/api/src/routes/policies_conditions.js");
  const service = read("services/api/src/services/policiesConditions/effectivePolicy.js");
  const migration = read("services/api/db/migrations/0123_policies_conditions_effective_read_permission.sql");
  const docs = read("docs/effective_policy_read_helper_v1.md");

  assert.match(route, /app\.get\("\/effective"/);
  assert.doesNotMatch(route, /app\.(post|patch|put|delete)\(/i);
  assert.match(route, /policies_conditions\.read_effective/);
  assert.match(service, /FROM eip_core\.commercial_condition/);
  assert.match(service, /WHERE tenant_id=\$1/);
  assert.doesNotMatch(service, /INSERT INTO|UPDATE eip_core\.commercial_condition|DELETE FROM eip_core\.commercial_condition/i);
  assert.doesNotMatch(service, new RegExp("sample|demo|f" + "ake", "i"));
  assert.match(migration, /policies_conditions\.read_effective/);
  assert.match(migration, /role_template_permission/);
  assert.match(migration, /role_permission/);
  assert.doesNotMatch(migration, /CREATE TABLE/i);
  assert.match(docs, /effective_at/);
  assert.match(docs, /selected_condition/);
  assert.match(docs, /excluded_conditions/);
});
