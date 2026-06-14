import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import policiesConditionsRoutes from "../src/routes/policies_conditions.js";
import {
  DEFAULT_POLICY_DOMAINS,
  getPolicyConditionDetail,
  getPolicyConditionTaxonomy,
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

function taxonomyRow(overrides = {}) {
  return {
    list_code: overrides.list_code || "POLICY_DOMAIN",
    list_label: overrides.list_label || "Policy Domain",
    code: overrides.code || "COMMERCIAL",
    label: overrides.label || "Commercial",
    sort_order: overrides.sort_order ?? 10,
    is_active: overrides.is_active ?? true,
    attrs: overrides.attrs || {},
    tenant_id: overrides.tenant_id ?? null
  };
}

function buildDb(rows = [], { permissionAllowed = true, queries = [], dropdownRows = [] } = {}) {
  return {
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (sql.includes("FROM eip_authz.identity_role")) {
        return permissionAllowed ? { rowCount: 1, rows: [{ ok: 1 }] } : { rowCount: 0, rows: [] };
      }
      if (sql.includes("FROM eip_core.dropdown_list") && sql.includes("JOIN eip_core.dropdown_value")) {
        return { rowCount: dropdownRows.length, rows: dropdownRows };
      }
      if (sql.includes("FROM eip_core.commercial_condition")) {
        const tenantId = params[0];
        const id = sql.includes("AND id=$2") ? params[1] : null;
        const scoped = rows.filter((row) => row.tenant_id === tenantId);
        const resultRows = id ? scoped.filter((row) => row.id === id) : scoped;
        return { rowCount: resultRows.length, rows: resultRows };
      }
      return { rowCount: 0, rows: [] };
    }
  };
}

async function buildRouteApp({ rows = [], dropdownRows = [], permissionAllowed = true, authenticated = true } = {}) {
  const app = Fastify({ logger: false });
  app.decorate("db", buildDb(rows, { permissionAllowed, dropdownRows }));
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
  assert.equal(procurement.classification.policy_domain, "COMMERCIAL");
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

test("explicit attrs.classification is preferred over legacy mapping and canonicalized", () => {
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

  assert.equal(mapped.classification.policy_domain, "COMMERCIAL");
  assert.equal(mapped.legacy.attrs_classification.policy_domain, "SELLING");
  assert.equal(mapped.classification.mapping_source, "attrs.classification");
  assert.equal(mapped.status, "active");
});

test("default policy domains are the seven governed business lexicon domains", () => {
  assert.deepEqual(DEFAULT_POLICY_DOMAINS.map((item) => item.code), [
    "COMMERCIAL",
    "FINANCIAL",
    "APPROVAL_FRAMEWORK",
    "INVENTORY",
    "FISCAL_TAX_TREATMENT",
    "MARKETPLACE",
    "LOGISTICS"
  ]);
  assert.equal(DEFAULT_POLICY_DOMAINS.some((item) => ["PLAN", "SOURCE", "MAKE", "DELIVER", "RETURN", "ENABLE"].includes(item.code)), false);
});

test("legacy domains canonicalize while tenant custom domains remain visible", () => {
  const selling = mapCommercialConditionToPolicyCondition(condition({
    attrs: {
      classification: {
        policy_domain: "SELLING",
        policy_family: "PRICE_POLICY",
        condition_type: "PRICE",
        condition_nature: "INTERNAL_MANAGEMENT_POLICY"
      }
    }
  }));
  assert.equal(selling.classification.policy_domain, "COMMERCIAL");
  assert.equal(selling.legacy.attrs_classification.policy_domain, "SELLING");

  const tradeParty = mapCommercialConditionToPolicyCondition(condition({
    attrs: {
      classification: {
        policy_domain: "TRADE_PARTY",
        policy_family: "PAYMENT_TERMS",
        condition_type: "PAYMENT_TERMS",
        condition_nature: "EXTERNAL_TRADE_CONDITION"
      }
    }
  }));
  assert.equal(tradeParty.classification.policy_domain, "COMMERCIAL");

  const logistics = mapCommercialConditionToPolicyCondition(condition({
    attrs: {
      classification: {
        policy_domain: "LOGISTICS_DELIVERY",
        policy_family: "DELIVERY_EXECUTION",
        condition_type: "DELIVERY_RULE",
        condition_nature: "OPERATIONAL_POLICY"
      }
    }
  }));
  assert.equal(logistics.classification.policy_domain, "LOGISTICS");

  const custom = mapCommercialConditionToPolicyCondition(condition({
    attrs: {
      classification: {
        policy_domain: "CUSTOM_RISK",
        policy_family: "LOCAL_EXCEPTION",
        condition_type: "RISK_HOLD",
        condition_nature: "INTERNAL_MANAGEMENT_POLICY"
      }
    }
  }));
  assert.equal(custom.classification.policy_domain, "CUSTOM_RISK");
});

test("incoterms classify under Commercial with governed subtype", () => {
  const mapped = mapCommercialConditionToPolicyCondition(condition({
    code: "TRADE_TERM_FOB",
    label: "FOB sale term",
    condition_type: "TRADE_TERMS",
    condition_category: "TRADE",
    attrs: { incoterm: "FOB" },
    effect: { trade_terms: { incoterm: "FOB" } }
  }));

  assert.equal(mapped.classification.policy_domain, "COMMERCIAL");
  assert.equal(mapped.classification.policy_family, "INCOTERMS");
  assert.equal(mapped.classification.condition_type, "INCOTERM");
  assert.equal(mapped.classification.condition_subtype, "FOB");
});

test("finance approval compatibility maps by meaning and keeps ambiguous rows reviewable", () => {
  const commercial = mapCommercialConditionToPolicyCondition(condition({
    attrs: {
      classification: {
        policy_domain: "FINANCE_APPROVAL",
        policy_family: "PAYMENT_TERMS",
        condition_type: "PAYMENT_TERMS",
        condition_nature: "EXTERNAL_TRADE_CONDITION"
      }
    }
  }));
  assert.equal(commercial.classification.policy_domain, "COMMERCIAL");

  const financial = mapCommercialConditionToPolicyCondition(condition({
    attrs: {
      classification: {
        policy_domain: "FINANCE_APPROVAL",
        policy_family: "LIQUIDITY_POLICY",
        condition_type: "FINANCIAL_RATIO",
        condition_nature: "INTERNAL_MANAGEMENT_POLICY"
      }
    }
  }));
  assert.equal(financial.classification.policy_domain, "FINANCIAL");

  const approval = mapCommercialConditionToPolicyCondition(condition({
    attrs: {
      classification: {
        policy_domain: "FINANCE_APPROVAL",
        policy_family: "APPROVAL_MATRIX",
        condition_type: "APPROVAL_MATRIX",
        condition_nature: "INTERNAL_MANAGEMENT_POLICY"
      }
    }
  }));
  assert.equal(approval.classification.policy_domain, "APPROVAL_FRAMEWORK");

  const ambiguous = mapCommercialConditionToPolicyCondition(condition({
    condition_type: "FOREX_RATE",
    condition_category: "FOREX",
    attrs: {
      classification: {
        policy_domain: "FINANCE_APPROVAL",
        policy_family: "CURRENCY_CONVERSION",
        condition_type: "FOREX_RATE",
        condition_nature: "SYSTEM_CALCULATION_POLICY"
      }
    }
  }));
  assert.equal(ambiguous.classification.policy_domain, "NEEDS_REVIEW");
  assert.equal(ambiguous.classification.mapping_status, "legacy_ambiguous");
  assert.equal(ambiguous.status, "needs_review");
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
  assert.equal(Object.hasOwn(pageOne.items[0], "tenant_id"), false);
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
  assert.equal(Object.hasOwn(detail.item, "tenant_id"), false);
  assert.deepEqual(detail.item.safe_machine_fields.effect_blocks, ["price"]);
  assert.deepEqual(detail.item.safe_machine_fields.scope_keys, ["channel"]);
  assert.deepEqual(detail.item.safe_machine_fields.attrs_keys, ["governance_source"]);
  assert.equal(JSON.stringify(detail.item.safe_machine_fields).includes("secret-key"), false);
  assert.equal(JSON.stringify(detail.item.safe_machine_fields).includes("do not expose"), false);
  assert.equal(JSON.stringify(detail.item.safe_machine_fields).includes("hidden"), false);
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

test("overview route is not captured by detail route and malformed detail ids are safe", async () => {
  const app = await buildRouteApp({
    rows: [condition({ id: "20000000-0000-0000-0000-0000000000aa", tenant_id: TENANT_A, condition_type: "PRICE" })]
  });

  const overview = await app.inject({ method: "GET", url: "/api/eip/policies-conditions/overview" });
  assert.equal(overview.statusCode, 200);
  assert.equal(overview.json().summary.total, 1);
  assert.equal(overview.json().by_domain.COMMERCIAL, 1);

  const malformed = await app.inject({ method: "GET", url: "/api/eip/policies-conditions/not-a-uuid" });
  assert.equal(malformed.statusCode, 400);
  assert.equal(malformed.json().error, "INVALID_POLICY_CONDITION_ID");
  await app.close();
});

test("taxonomy route is read-only and not captured by detail route", async () => {
  const app = await buildRouteApp();

  const response = await app.inject({ method: "GET", url: "/api/eip/policies-conditions/taxonomy" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().read_only, true);
  assert.equal(response.json().closed_enum, false);
  assert.deepEqual(response.json().lists.domains.options.map((item) => item.code), DEFAULT_POLICY_DOMAINS.map((item) => item.code));

  const post = await app.inject({ method: "POST", url: "/api/eip/policies-conditions/taxonomy" });
  assert.equal(post.statusCode, 404);
  await app.close();
});

test("taxonomy service returns seeded defaults and tenant custom values as an extensible list", async () => {
  const dropdownRows = [
    ...DEFAULT_POLICY_DOMAINS.map((item) => taxonomyRow({
      code: item.code,
      label: item.label,
      sort_order: item.sort_order,
      attrs: { description: item.description },
      tenant_id: null
    })),
    taxonomyRow({
      code: "CUSTOM_RISK",
      label: "Custom Risk",
      sort_order: 80,
      attrs: { description: "Tenant-specific review domain" },
      tenant_id: TENANT_A
    })
  ];
  const app = { db: buildDb([], { dropdownRows }) };

  const taxonomy = await getPolicyConditionTaxonomy(app, { tenant_id: TENANT_A });
  assert.equal(taxonomy.ok, true);
  assert.equal(taxonomy.read_only, true);
  assert.equal(taxonomy.closed_enum, false);
  assert.equal(taxonomy.lists.domains.options.some((item) => item.code === "CUSTOM_RISK" && item.source === "tenant"), true);
  assert.deepEqual(taxonomy.defaults.domains.map((item) => item.code), DEFAULT_POLICY_DOMAINS.map((item) => item.code));
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

test("overview counts all scanned rows, not only a display page", async () => {
  const rows = Array.from({ length: 150 }, (_, index) =>
    condition({
      id: `20000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
      tenant_id: TENANT_A,
      code: `PRICE_${index + 1}`,
      condition_type: "PRICE",
      condition_category: "PRICING"
    })
  );
  const app = await buildRouteApp({ rows });

  const list = await app.inject({ method: "GET", url: "/api/eip/policies-conditions?page=1&page_size=25" });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().items.length, 25);
  assert.equal(list.json().summary.total, 150);

  const overview = await app.inject({ method: "GET", url: "/api/eip/policies-conditions/overview" });
  assert.equal(overview.statusCode, 200);
  assert.equal(overview.json().summary.total, 150);
  assert.equal(overview.json().by_domain.COMMERCIAL, 150);
  await app.close();
});

test("phase 2 wiring is read-only, descriptor-backed, and has no fake policy rows", () => {
  const server = read("services/api/src/server.js");
  const route = read("services/api/src/routes/policies_conditions.js");
  const service = read("services/api/src/services/policiesConditions/readModel.js");
  const registry = read("apps/dashboard/src/engine/registry.jsx");
  const dashboardSurface = read("apps/dashboard/src/engine/surfaces/dashboard.js");
  const moduleDescriptors = read("apps/dashboard/src/engine/surfaces/kernelModuleDescriptors.js");
  const seedSurface = read("services/api/db/seed/ui_surface_dashboard.sql");
  const migration = read("services/api/db/migrations/0121_policies_conditions_readonly_center.sql");
  const lexiconMigration = read("services/api/db/migrations/0122_policies_conditions_business_lexicon.sql");
  const repairMigration = read("services/api/db/migrations/0126_engine_first_module_workspace_repair.sql");

  assert.match(server, /policiesConditionsRoutes/);
  assert.match(server, /prefix: "\/api\/eip\/policies-conditions"/);
  assert.match(route, /app\.get\("\/"/);
  assert.match(route, /app\.get\("\/taxonomy"/);
  assert.match(route, /app\.get\("\/governance\/options"/);
  assert.match(route, /app\.get\("\/:id"/);
  assert.doesNotMatch(route, /app\.(post|patch|put|delete)\(/i);
  assert.match(route, /app\.requireSession\(req, \{ realm: "EIP" \}\)/);
  assert.match(route, /policies_conditions\.read/);
  assert.match(service, /FROM eip_core\.commercial_condition/);
  assert.match(service, /WHERE tenant_id=\$1/);
  assert.doesNotMatch(service, /INSERT INTO|UPDATE eip_core\.commercial_condition|DELETE FROM eip_core\.commercial_condition/i);
  assert.doesNotMatch(service, /sample|demo|fake/i);
  assert.match(registry, /KernelModuleWorkspace/);
  assert.match(dashboardSurface, /Policies & Conditions/);
  assert.match(dashboardSurface, /module: "policies-conditions"/);
  assert.match(dashboardSurface, /policiesKernelWorkspaceNode/);
  assert.match(moduleDescriptors, /type: "KernelModuleWorkspace"/);
  assert.match(seedSurface, /KernelModuleWorkspace/);
  assert.match(seedSurface, /"module": "policies-conditions"/);
  assert.match(repairMigration, /policies_menu jsonb/);
  assert.match(repairMigration, /tenant_module_setting/);
  assert.match(repairMigration, /'policies-conditions'/);
  assert.match(repairMigration, /'{ui_workspace}'/);
  assert.match(migration, /policies_conditions\.read/);
  assert.match(migration, /role_template_permission/);
  assert.doesNotMatch(migration, /CREATE TABLE/i);
  assert.match(lexiconMigration, /POLICY_DOMAIN/);
  assert.match(lexiconMigration, /POLICY_FAMILY/);
  assert.match(lexiconMigration, /POLICY_CONDITION_TYPE/);
  assert.match(lexiconMigration, /POLICY_CONDITION_SUBTYPE/);
  assert.match(lexiconMigration, /ON CONFLICT \(list_id, code\)/);
  assert.doesNotMatch(lexiconMigration, /CREATE TABLE/i);
  assert.doesNotMatch(lexiconMigration, /'EXW'|'FCA'|'CPT'|'CIP'|'DAP'|'DPU'|'DDP'|'FAS'|'FOB'|'CFR'|'CIF'/);
});

test("dashboard descriptors expose the read-only taxonomy endpoint and seven default domains", () => {
  const seedSurface = read("services/api/db/seed/ui_surface_dashboard.sql");
  const moduleDescriptors = read("apps/dashboard/src/engine/surfaces/kernelModuleDescriptors.js");
  const seedPoliciesBlock = seedSurface.slice(
    seedSurface.indexOf('"id": "policies-conditions-workspace"'),
    seedSurface.indexOf('"id": "user-tasks-panel"')
  );
  const expected = DEFAULT_POLICY_DOMAINS.map((item) => item.code);
  const retired = ["PROCUREMENT", "SELLING", "FINANCE_APPROVAL", "TRADE_PARTY", "LOGISTICS_DELIVERY"];

  assert.match(moduleDescriptors, /optionsEndpoint: "\/api\/eip\/policies-conditions\/governance\/options"/);
  assert.match(moduleDescriptors, /optionList: "POLICY_DOMAIN"/);
  assert.match(seedPoliciesBlock, /"configEndpoint": "\/api\/eip\/policies-conditions\/governance\/options"/);
  for (const code of expected) {
    assert.match(read("services/api/db/migrations/0122_policies_conditions_business_lexicon.sql"), new RegExp(`'${code}'`));
  }
  for (const code of retired) {
    assert.doesNotMatch(moduleDescriptors, new RegExp(`"${code}"`));
    assert.doesNotMatch(seedPoliciesBlock, new RegExp(`"${code}"`));
  }
});

test("SCOR and professional source metadata stay documentation-only", () => {
  const service = read("services/api/src/services/policiesConditions/readModel.js");
  const lexiconDoc = read("docs/policies_conditions_business_lexicon_v1.md");
  const mappingDoc = read("docs/policies_conditions_source_mapping_v1.md");

  assert.match(lexiconDoc, /ASCM\/SCOR Review/);
  assert.match(mappingDoc, /Source Reference Mapping/);
  assert.doesNotMatch(service, /SCOR|SCORmark|ASCM|Frontiers|policies_conditions_source_mapping/i);
  assert.equal(DEFAULT_POLICY_DOMAINS.some((item) => ["PLAN", "SOURCE", "MAKE", "DELIVER", "RETURN", "ENABLE"].includes(item.code)), false);
});
