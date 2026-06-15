import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Fastify from "fastify";
import crmRoutes from "../src/routes/crm.js";
import policiesConditionsRoutes from "../src/routes/policies_conditions.js";
import {
  createCrmAccount,
  createCrmActivity,
  createCrmOpportunity,
  CrmInputError
} from "../src/services/crm/crmManagement.js";
import { addSupplierQuote } from "../src/services/procurement/procurementOperations.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const IDENTITY_A = "10000000-0000-0000-0000-00000000000a";
const AGENT_A = "20000000-0000-4000-8000-00000000000a";
const OTHER_TENANT_AGENT = "20000000-0000-4000-8000-00000000000b";
const CRM_SESSION = { tenant_id: TENANT_A, identity_id: IDENTITY_A, realm: "EIP" };

const migrations = {
  "0121": read("../db/migrations/0121_policies_conditions_readonly_center.sql"),
  "0122": read("../db/migrations/0122_policies_conditions_business_lexicon.sql"),
  "0123": read("../db/migrations/0123_policies_conditions_effective_read_permission.sql"),
  "0124": read("../db/migrations/0124_entity_management_v1.sql"),
  "0125": read("../db/migrations/0125_inventory_management_v1.sql"),
  "0126": read("../db/migrations/0126_engine_first_module_workspace_repair.sql"),
  "0127": read("../db/migrations/0127_procurement_management_v1.sql"),
  "0128": read("../db/migrations/0128_crm_management_v1.sql"),
  "0129": read("../db/migrations/0129_cross_module_hardening_v1.sql")
};

const files = {
  policiesRoute: read("../src/routes/policies_conditions.js"),
  policiesReadModel: read("../src/services/policiesConditions/readModel.js"),
  policiesEffective: read("../src/services/policiesConditions/effectivePolicy.js"),
  entityService: read("../src/services/entities/entityManagement.js"),
  inventoryRoute: read("../src/routes/inventory.js"),
  inventoryService: read("../src/services/inventory/inventoryManagement.js"),
  procurementRoute: read("../src/routes/procurement.js"),
  procurementService: read("../src/services/procurement/procurementManagement.js"),
  procurementOperations: read("../src/services/procurement/procurementOperations.js"),
  crmRoute: read("../src/routes/crm.js"),
  crmCompletionRoute: read("../src/routes/crm_completion.js"),
  crmService: read("../src/services/crm/crmManagement.js"),
  registry: read("../../../apps/dashboard/src/engine/registry.jsx"),
  dashboardSurface: read("../../../apps/dashboard/src/engine/surfaces/dashboard.js"),
  moduleDescriptors: read("../../../apps/dashboard/src/engine/surfaces/kernelModuleDescriptors.js"),
  seedSurface: read("../db/seed/ui_surface_dashboard.sql"),
  kernelWorkspace: read("../../../apps/dashboard/src/components/engine/KernelModuleWorkspace.jsx")
};

function count(text, pattern) {
  return (text.match(pattern) || []).length;
}

function flattenSql(sql) {
  return String(sql || "").replace(/\s+/g, " ").trim();
}

function buildCrmDb(queries = []) {
  return {
    async query(sql, params = []) {
      queries.push({ sql, params });
      const flat = flattenSql(sql);
      if (flat.includes("FROM eip_authz.identity_role")) return { rowCount: 1, rows: [{ ok: 1 }] };
      if (flat.includes("FROM eip_core.agent") && flat.includes("WHERE tenant_id=$1 AND id=$2")) {
        return { rowCount: 1, rows: [{ id: params[1], agent_type: "ORG" }] };
      }
      if (flat.includes("INSERT INTO eip_core.entity_bank_account")) {
        return {
          rowCount: 1,
          rows: [{
            id: "bank-1",
            account_type: "BANK",
            label: "Main",
            bank_name: "Bank",
            account_name: "Account",
            account_number: "1234567890",
            iban: "MU00BANK1234567890",
            swift_bic: "BANKMUMU",
            currency_code: "EUR",
            is_primary: true,
            is_active: true,
            attrs: {},
            created_at: "2026-06-01T00:00:00.000Z",
            updated_at: "2026-06-01T00:00:00.000Z"
          }]
        };
      }
      if (flat.includes("FROM eip_core.agent")) return { rowCount: 0, rows: [] };
      return { rowCount: 0, rows: [] };
    }
  };
}

function buildCrmServiceApp(queries = []) {
  const client = {
    async query(sql, params = []) {
      queries.push({ sql, params });
      const flat = flattenSql(sql);
      if (flat === "BEGIN" || flat === "COMMIT" || flat === "ROLLBACK") return { rowCount: 0, rows: [] };
      if (flat.includes("FROM eip_core.dropdown_list")) return { rowCount: 0, rows: [] };
      if (flat.includes("FROM eip_core.agent") && flat.includes("WHERE tenant_id=$1 AND id=$2")) {
        return params[1] === AGENT_A
          ? { rowCount: 1, rows: [{ id: AGENT_A, agent_type: "ORG", name: "Tenant A Agent", attrs: {}, is_active: true }] }
          : { rowCount: 0, rows: [] };
      }
      if (flat.includes("FROM eip_core.service_object so") && flat.includes("WHERE so.tenant_id=$1 AND so.id=$2")) {
        return { rowCount: 1, rows: [{ id: params[1], object_type: "CRM_OPPORTUNITY", account_id: AGENT_A }] };
      }
      throw new Error(`Unexpected CRM service query: ${flat}`);
    },
    release() {}
  };
  return {
    db: { connect: async () => client }
  };
}

async function assertCrmReferenceRejected(action, expectedCode, forbiddenSql) {
  const queries = [];
  const app = buildCrmServiceApp(queries);
  await assert.rejects(
    () => action(app),
    (error) => {
      assert.equal(error instanceof CrmInputError, true);
      assert.equal(error.code, expectedCode);
      return true;
    }
  );
  assert.equal(queries.some(({ sql }) => flattenSql(sql).includes(forbiddenSql)), false, forbiddenSql);
  assert.equal(queries.some(({ sql }) => flattenSql(sql) === "ROLLBACK"), true);
}

async function buildCrmApp({ csrfResult = { ok: true }, queries = [] } = {}) {
  const app = Fastify({ logger: false });
  app.decorate("db", buildCrmDb(queries));
  app.decorate("requireSession", async () => ({
    ok: true,
    session: { tenant_id: TENANT_A, identity_id: IDENTITY_A, realm: "EIP" }
  }));
  let csrfCalls = 0;
  app.decorate("requireCsrf", async () => {
    csrfCalls += 1;
    return csrfResult;
  });
  app.decorate("coreProcess", {
    findActiveInstance: async () => null,
    createInstance: async () => ({ ok: true, item: { id: "process-1" } }),
    advanceInstance: async () => ({ ok: true })
  });
  await app.register(crmRoutes, { prefix: "/api/eip/crm" });
  return { app, getCsrfCalls: () => csrfCalls };
}

async function buildPoliciesApp({ permissions = new Set(["policies_conditions.read", "policies_conditions.read_effective"]) } = {}) {
  const app = Fastify({ logger: false });
  app.decorate("db", {
    async query(sql, params = []) {
      const flat = flattenSql(sql);
      if (flat.includes("FROM eip_authz.identity_role")) {
        return permissions.has(params[2]) ? { rowCount: 1, rows: [{ ok: 1 }] } : { rowCount: 0, rows: [] };
      }
      if (flat.includes("attrs->'ui_workspace' AS workspace")) {
        return { rowCount: 1, rows: [{ workspace: { module: "policies-conditions" } }] };
      }
      if (flat.includes("FROM eip_core.dropdown_list")) return { rowCount: 0, rows: [] };
      if (flat.includes("FROM eip_core.commercial_condition")) return { rowCount: 0, rows: [] };
      return { rowCount: 0, rows: [] };
    }
  });
  app.decorate("requireSession", async () => ({
    ok: true,
    session: { tenant_id: TENANT_A, identity_id: IDENTITY_A, realm: "EIP" }
  }));
  await app.register(policiesConditionsRoutes, { prefix: "/api/eip/policies-conditions" });
  return app;
}

test("released migration chain and permissions are present for the V1 backbone", () => {
  for (const [number, sql] of Object.entries(migrations)) {
    assert.equal(sql.length > 0, true, `migration ${number} is readable`);
    assert.match(sql, /ON CONFLICT|IF NOT EXISTS|jsonb_set|CREATE INDEX IF NOT EXISTS/i, `migration ${number} is idempotent-looking`);
  }

  const requiredPermissions = [
    "policies_conditions.read",
    "policies_conditions.read_effective",
    "entities.read",
    "entities.create",
    "entities.update",
    "inventory.read",
    "inventory.material.create",
    "inventory.lot.update",
    "procurement.read",
    "procurement.request.create",
    "procurement.request.approve",
    "crm.read",
    "crm.account.create",
    "crm.opportunity.update",
    "crm.convert"
  ];

  const migrationText = Object.values(migrations).join("\n");
  for (const permission of requiredPermissions) {
    assert.match(migrationText, new RegExp(permission.replaceAll(".", "\\.")), permission);
    if (!permission.endsWith(".update") || permission.startsWith("entities.")) {
      assert.match(migrationText, new RegExp(`'ADMIN_SUPER'\\s*,\\s*'${permission.replaceAll(".", "\\.")}'`), `ADMIN_SUPER ${permission}`);
    }
  }
});

test("dashboard and UI engine descriptors mount each released module once", () => {
  for (const [panelId, moduleCode, endpoint] of [
    ["user-policies-panel", "policies-conditions", "/api/eip/policies-conditions/governance/options"],
    ["user-entities-panel", "entity-management", "/api/eip/entities/governance/options"],
    ["user-inventory-panel", "inventory", "/api/eip/inventory/governance/options"],
    ["user-procurement-panel", "procurement", "/api/eip/procurement/governance/options"],
    ["user-crm-panel", "crm", "/api/eip/crm/governance/options"]
  ]) {
    assert.equal(count(files.seedSurface, new RegExp(`"id": "${panelId}"`, "g")), 1, panelId);
    assert.match(files.seedSurface, new RegExp(`"module": "${moduleCode}"`));
    assert.match(files.seedSurface, new RegExp(endpoint.replace(/[/.]/g, "\\$&")));
  }

  assert.match(files.registry, /KernelModuleWorkspace/);
  assert.match(files.dashboardSurface, /inventoryKernelWorkspaceNode/);
  assert.match(files.dashboardSurface, /procurementKernelWorkspaceNode/);
  assert.match(files.dashboardSurface, /crmKernelWorkspaceNode/);
  assert.match(files.moduleDescriptors, /entityKernelWorkspaceNode/);
  assert.match(files.moduleDescriptors, /policiesKernelWorkspaceNode/);
  assert.match(files.kernelWorkspace, /rowActions/);
  assert.match(files.kernelWorkspace, /disabledReason/);
  assert.match(files.kernelWorkspace, /field\.type === "lookup"/);
  assert.match(files.moduleDescriptors, /SUPPLIES_TO/);
  assert.match(files.moduleDescriptors, /SUPPLIER_OF/);
  assert.match(files.moduleDescriptors, /CUSTOMER_OF/);
  assert.match(migrations["0129"], /ensure_entity_relationship_value\('SUPPLIER_OF'/);
  assert.match(migrations["0129"], /ensure_entity_relationship_value\('CUSTOMER_OF'/);
});

test("cross-module data flows use kernel tables and safe policy helpers", () => {
  assert.doesNotMatch(files.crmService + migrations["0128"], /CREATE\s+TABLE[\s\S]*crm_(customer|prospect|account|contact|opportunity)\b/i);
  assert.match(files.crmService, /FROM eip_core\.agent/);
  assert.match(files.crmService, /FROM eip_core\.entity_contact/);
  assert.match(files.crmService, /service_object_party/);

  assert.doesNotMatch(files.procurementService + migrations["0127"], /CREATE\s+TABLE[\s\S]*(supplier|procurement_request)\b/i);
  assert.match(files.procurementService, /fetchAgent/);
  assert.match(files.procurementService, /listProcurementSupplierOptions/);
  assert.match(files.procurementService, /MATERIAL_SUPPLIER|SELECTED_SUPPLIER/);

  assert.match(files.inventoryService, /LEFT JOIN eip_core\.agent supplier\s+ON supplier\.tenant_id=m\.tenant_id/s);
  assert.match(files.inventoryService, /resolveEffectivePolicy/);
  assert.match(files.procurementService, /resolveEffectivePolicy/);
  assert.match(files.crmService, /resolveEffectivePolicy/);

  assert.match(files.policiesReadModel, /INCOTERM/);
  assert.match(files.policiesReadModel, /PAYMENT_TERMS/);
  assert.match(files.policiesReadModel, /APPROVAL_FRAMEWORK/);
  assert.match(migrations["0122"], /'COMMERCIAL','Commercial'/);
  assert.match(migrations["0122"], /'APPROVAL_FRAMEWORK','Approval Framework'/);
});

test("CRM Management V1 read routes do not require CSRF while mutations still do", async () => {
  const readCase = await buildCrmApp({ csrfResult: { ok: false, status: 419, error: "CSRF_REQUIRED" } });
  const readResponse = await readCase.app.inject({ method: "GET", url: "/api/eip/crm/accounts" });
  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json().ok, true);
  assert.equal(readCase.getCsrfCalls(), 0);
  await readCase.app.close();

  const writeCase = await buildCrmApp({ csrfResult: { ok: false, status: 419, error: "CSRF_REQUIRED" } });
  const writeResponse = await writeCase.app.inject({ method: "POST", url: "/api/eip/crm/accounts", payload: { display_name: "Acme" } });
  assert.equal(writeResponse.statusCode, 419);
  assert.equal(writeResponse.json().error, "CSRF_REQUIRED");
  assert.equal(writeCase.getCsrfCalls(), 1);
  await writeCase.app.close();
});

test("CRM legacy bank-account response is masked and strips raw identifiers", async () => {
  const { app } = await buildCrmApp();
  const response = await app.inject({
    method: "POST",
    url: `/api/eip/crm/agents/${AGENT_A}/bank-accounts`,
    payload: {
      account_type: "BANK",
      label: "Main",
      bank_name: "Bank",
      account_name: "Acme",
      account_number: "1234567890",
      iban: "MU00BANK1234567890",
      swift_bic: "BANKMUMU",
      currency_code: "EUR",
      is_primary: true
    }
  });
  assert.equal(response.statusCode, 200);
  const item = response.json().item;
  assert.equal(Object.hasOwn(item, "account_number"), false);
  assert.equal(Object.hasOwn(item, "iban"), false);
  assert.equal(item.account_number_masked, "****7890");
  assert.equal(item.iban_masked, "****7890");
  assert.doesNotMatch(files.crmRoute, /RETURNING id, account_type, label, bank_name, account_name, account_number,\s*iban/i);
  await app.close();
});

test("CRM write services reject cross-tenant agent references before mutation", async () => {
  await assertCrmReferenceRejected(
    (app) => createCrmAccount(app, CRM_SESSION, {
      display_name: "Acme",
      parent_agent_id: OTHER_TENANT_AGENT
    }),
    "PARENT_AGENT_NOT_FOUND",
    "INSERT INTO eip_core.agent"
  );

  await assertCrmReferenceRejected(
    (app) => createCrmOpportunity(app, CRM_SESSION, {
      account_id: AGENT_A,
      title: "Expansion",
      owner_agent_id: OTHER_TENANT_AGENT
    }),
    "OWNER_AGENT_NOT_FOUND",
    "INSERT INTO eip_core.service_object"
  );

  await assertCrmReferenceRejected(
    (app) => createCrmActivity(app, CRM_SESSION, {
      service_object_id: "30000000-0000-4000-8000-00000000000a",
      title: "Follow up",
      assigned_agent_id: OTHER_TENANT_AGENT
    }),
    "ASSIGNED_AGENT_NOT_FOUND",
    "INSERT INTO eip_core.task"
  );
});

test("Procurement RFQ quote creation rejects suppliers outside the tenant before linking", async () => {
  const queries = [];
  const client = {
    async query(sql, params = []) {
      queries.push({ sql, params });
      const flat = flattenSql(sql);
      if (flat.includes("FROM eip_core.service_object") && flat.includes("object_type=$3")) {
        return {
          rowCount: 1,
          rows: [{
            id: params[1],
            code: "RFQ-1",
            title: "RFQ",
            status: "open",
            object_type: params[2],
            attrs: { material_id: "mat-1" },
            owner_agent_id: AGENT_A
          }]
        };
      }
      if (flat.includes("FROM eip_core.agent") && flat.includes("WHERE tenant_id=$1")) {
        return { rowCount: 0, rows: [] };
      }
      throw new Error(`Unexpected procurement service query: ${flat}`);
    }
  };

  const result = await addSupplierQuote(client, {
    tenantId: TENANT_A,
    identityId: IDENTITY_A,
    rfqId: "rfq-1",
    body: {
      supplier_agent_id: OTHER_TENANT_AGENT,
      quoted_qty: 10,
      unit_price: 5
    }
  });

  assert.deepEqual(result, { ok: false, status: 404, error: "SUPPLIER_NOT_FOUND" });
  assert.equal(queries.some(({ sql }) => flattenSql(sql).includes("INSERT INTO eip_core.info_record")), false);
  assert.equal(queries.some(({ sql }) => flattenSql(sql).includes("QUOTE_SUPPLIER")), false);
});

test("Policies & Conditions governance reports effective-read permission when granted", async () => {
  const app = await buildPoliciesApp();
  const response = await app.inject({ method: "GET", url: "/api/eip/policies-conditions/governance/options" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().permissions.sort(), [
    "policies_conditions.read",
    "policies_conditions.read_effective"
  ]);
  await app.close();
});

test("released module routes reject tenant override patterns and avoid hard deletes", () => {
  for (const routeText of [
    files.policiesRoute,
    files.inventoryRoute,
    files.procurementRoute,
    files.crmRoute,
    files.crmCompletionRoute
  ]) {
    assert.doesNotMatch(routeText, /app\.delete\(/i);
  }

  for (const serviceText of [
    files.entityService,
    files.inventoryService,
    files.procurementService,
    files.crmService,
    files.policiesEffective
  ]) {
    assert.match(serviceText, /tenant_id|tenantId|tenant/i);
    assert.doesNotMatch(serviceText, /DELETE\s+FROM/i);
  }

  assert.match(files.entityService, /TENANT_OVERRIDE_NOT_ALLOWED/);
  assert.match(files.inventoryService, /TENANT_OVERRIDE_NOT_ALLOWED/);
  assert.match(files.procurementService, /TENANT_OVERRIDE_NOT_ALLOWED/);
  assert.match(files.crmService, /TENANT_OVERRIDE_NOT_ALLOWED/);
  assert.match(files.policiesEffective, /tenant_id/);
  assert.match(files.crmService, /PARENT_AGENT_NOT_FOUND/);
  assert.match(files.crmService, /OWNER_AGENT_NOT_FOUND/);
  assert.match(files.crmService, /ASSIGNED_AGENT_NOT_FOUND/);
  assert.match(files.procurementOperations, /SUPPLIER_NOT_FOUND/);
});

test("released module outputs avoid fake data markers and raw sensitive fields", () => {
  const productionText = [
    files.entityService,
    files.inventoryService,
    files.procurementService,
    files.crmService,
    files.crmRoute,
    files.moduleDescriptors,
    files.seedSurface,
    migrations["0124"],
    migrations["0125"],
    migrations["0127"],
    migrations["0128"],
    migrations["0129"]
  ].join("\n");

  assert.doesNotMatch(productionText, /lorem ipsum|sample customer|fake customer|manual_test|samarapattern/i);
  assert.match(files.entityService, /account_number_masked/);
  assert.match(files.crmRoute, /account_number_masked/);
  assert.match(files.crmService, /safeCommercialCondition/);
  assert.doesNotMatch(files.crmService, /SELECT \*/);
  assert.doesNotMatch(files.procurementService, /payload:\s*row\.payload/);
});
