import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Fastify from "fastify";
import entitiesRoutes from "../src/routes/entities.js";
import {
  createEntity,
  createEntityAddress,
  createEntityBankAccount,
  createEntityContact,
  createEntityRelationship,
  EntityInputError,
  listEntities,
  updateEntity
} from "../src/services/entities/entityManagement.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const route = read("../src/routes/entities.js");
const service = read("../src/services/entities/entityManagement.js");
const server = read("../src/server.js");
const migration = read("../db/migrations/0124_entity_management_v1.sql");
const repairMigration = read("../db/migrations/0126_engine_first_module_workspace_repair.sql");
const formErrorMigration = read("../db/migrations/0132_form_error_address_layout_v1.sql");
const registry = read("../../../apps/dashboard/src/engine/registry.jsx");
const dashboardSurface = read("../../../apps/dashboard/src/engine/surfaces/dashboard.js");
const moduleDescriptors = read("../../../apps/dashboard/src/engine/surfaces/kernelModuleDescriptors.js");
const seedSurface = read("../db/seed/ui_surface_dashboard.sql");
const workspace = read("../../../apps/dashboard/src/components/engine/KernelModuleWorkspace.jsx");
const docs = read("../../../docs/entity_management_v1.md");

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const TENANT_B = "00000000-0000-0000-0000-00000000000b";
const IDENTITY_A = "10000000-0000-0000-0000-00000000000a";

function makeAgent(overrides = {}) {
  return {
    id: overrides.id || "20000000-0000-4000-8000-000000000001",
    tenant_id: overrides.tenant_id || TENANT_A,
    agent_type: overrides.agent_type || "ORG",
    code: overrides.code || "ACME",
    name: overrides.name || "Acme Ltd",
    attrs: overrides.attrs || {
      entity_management_v1: true,
      roles: ["CUSTOMER"],
      status: "ACTIVE",
      legal_name: "Acme Limited"
    },
    parent_agent_id: overrides.parent_agent_id || null,
    is_active: overrides.is_active ?? true,
    created_at: overrides.created_at || "2026-06-01T00:00:00.000Z",
    updated_at: overrides.updated_at || "2026-06-01T00:00:00.000Z"
  };
}

function mask(value) {
  const text = String(value || "").replace(/\s+/g, "");
  return text ? `****${text.slice(-4)}` : null;
}

function buildDb(initial = {}) {
  const state = {
    agents: initial.agents || [makeAgent(), makeAgent({ id: "20000000-0000-4000-8000-0000000000bb", tenant_id: TENANT_B, code: "OTHER", name: "Other Tenant" })],
    addresses: [],
    contacts: [],
    banks: [],
    links: [],
    events: [],
    queries: []
  };

  const db = {
    state,
    async query(sql, params = []) {
      state.queries.push({ sql, params });
      if (sql.includes("FROM eip_authz.identity_role")) return { rowCount: 1, rows: [{ ok: 1 }] };
      if (sql.includes("INSERT INTO eip_core.security_event")) {
        state.events.push(params);
        return { rowCount: 1, rows: [{ id: "event-1" }] };
      }
      if (sql.includes("SELECT count(*)::int AS total") && sql.includes("FROM eip_core.agent")) {
        const rows = state.agents.filter((agent) => agent.tenant_id === params[0]);
        return { rowCount: 1, rows: [{ total: rows.length }] };
      }
      if (sql.includes("SELECT agent.id") && sql.includes("FROM eip_core.agent agent")) {
        const rows = state.agents
          .filter((agent) => agent.tenant_id === params[0])
          .map((agent) => ({
            ...agent,
            contact_count: state.contacts.filter((item) => item.entity_id === agent.id && item.is_active).length,
            address_count: state.addresses.filter((item) => item.entity_id === agent.id && item.is_active).length
          }));
        return { rowCount: rows.length, rows };
      }
      if (sql.includes("FROM eip_core.agent") && sql.includes("WHERE tenant_id=$1 AND id=$2")) {
        const row = state.agents.find((agent) => agent.tenant_id === params[0] && agent.id === params[1]);
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
      }
      if (sql.includes("INSERT INTO eip_core.agent")) {
        const row = makeAgent({
          id: `20000000-0000-4000-8000-${String(state.agents.length + 1).padStart(12, "0")}`,
          tenant_id: params[0],
          agent_type: params[1],
          code: params[2],
          name: params[3],
          attrs: JSON.parse(params[4]),
          parent_agent_id: params[5],
          is_active: params[6]
        });
        state.agents.push(row);
        return { rowCount: 1, rows: [row] };
      }
      if (sql.includes("UPDATE eip_core.agent")) {
        const row = state.agents.find((agent) => agent.tenant_id === params[0] && agent.id === params[1]);
        if (!row) return { rowCount: 0, rows: [] };
        row.agent_type = params[2];
        row.code = params[3];
        row.name = params[4];
        row.attrs = JSON.parse(params[5]);
        row.parent_agent_id = params[6];
        row.is_active = params[7];
        return { rowCount: 1, rows: [row] };
      }
      if (sql.includes("INSERT INTO eip_core.entity_address")) {
        const row = {
          id: `addr-${state.addresses.length + 1}`,
          entity_id: params[1],
          address_type: params[2],
          label: params[3],
          line1: params[4],
          line2: params[5],
          city: params[6],
          state_region: params[7],
          postal_code: params[8],
          country_code: params[9],
          latitude: params[10],
          longitude: params[11],
          is_primary: params[12],
          is_active: params[13],
          attrs: JSON.parse(params[14]),
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-01T00:00:00.000Z"
        };
        state.addresses.push(row);
        return { rowCount: 1, rows: [row] };
      }
      if (sql.includes("INSERT INTO eip_core.entity_contact")) {
        const row = {
          id: `contact-${state.contacts.length + 1}`,
          entity_id: params[1],
          contact_type: params[2],
          label: params[3],
          value: params[4],
          is_primary: params[5],
          is_active: params[6],
          attrs: JSON.parse(params[7]),
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-01T00:00:00.000Z"
        };
        state.contacts.push(row);
        return { rowCount: 1, rows: [row] };
      }
      if (sql.includes("INSERT INTO eip_core.entity_bank_account")) {
        const row = {
          id: `bank-${state.banks.length + 1}`,
          entity_id: params[1],
          account_type: params[2],
          label: params[3],
          bank_name: params[4],
          account_name: params[5],
          account_number: params[6],
          iban: params[7],
          account_number_masked: mask(params[6]),
          iban_masked: mask(params[7]),
          swift_bic: params[8],
          currency_code: params[9],
          is_primary: params[10],
          is_active: params[11],
          attrs: JSON.parse(params[12]),
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-01T00:00:00.000Z"
        };
        state.banks.push(row);
        return { rowCount: 1, rows: [row] };
      }
      if (sql.includes("INSERT INTO eip_core.object_link")) {
        const row = {
          id: `rel-${state.links.length + 1}`,
          src_id: params[1],
          dst_id: params[2],
          relation_type: params[3],
          sort_order: params[4],
          attrs: JSON.parse(params[5]),
          is_active: params[6],
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-01T00:00:00.000Z"
        };
        state.links.push(row);
        return { rowCount: 1, rows: [row] };
      }
      if (sql.includes("FROM eip_core.object_link link") && sql.includes("JOIN eip_core.agent src")) {
        const rows = state.links
          .filter((link) => link.src_id === params[1] || link.dst_id === params[1])
          .map((link) => {
            const src = state.agents.find((agent) => agent.id === link.src_id);
            const dst = state.agents.find((agent) => agent.id === link.dst_id);
            return {
              ...link,
              src_code: src?.code,
              src_name: src?.name,
              src_type: src?.agent_type,
              dst_code: dst?.code,
              dst_name: dst?.name,
              dst_type: dst?.agent_type
            };
          });
        return { rowCount: rows.length, rows };
      }
      if (sql.includes("UPDATE eip_core.entity_address SET is_primary=false")) return { rowCount: 0, rows: [] };
      if (sql.includes("UPDATE eip_core.entity_contact SET is_primary=false")) return { rowCount: 0, rows: [] };
      if (sql.includes("UPDATE eip_core.entity_bank_account SET is_primary=false")) return { rowCount: 0, rows: [] };
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

test("entity list is tenant-scoped and uses the session tenant only", async () => {
  const db = buildDb();
  const result = await listEntities(appWithDb(db), { tenant_id: TENANT_A, identity_id: IDENTITY_A }, {});
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].code, "ACME");
  assert.equal(result.items.some((item) => item.code === "OTHER"), false);
  assert.equal(db.state.queries.every((query) => query.params[0] !== TENANT_B), true);
});

test("entity create and update preserve lifecycle without hard delete", async () => {
  const db = buildDb({ agents: [] });
  const app = appWithDb(db);
  const created = await createEntity(app, { tenant_id: TENANT_A, identity_id: IDENTITY_A }, {
    entity_kind: "ORG",
    code: "SUP-1",
    display_name: "Supplier One",
    roles: ["SUPPLIER"],
    status: "ACTIVE"
  });
  assert.equal(created.item.display_name, "Supplier One");
  assert.deepEqual(created.item.roles, ["SUPPLIER"]);

  const updated = await updateEntity(app, { tenant_id: TENANT_A, identity_id: IDENTITY_A }, created.item.id, {
    status: "ARCHIVED",
    notes: "No longer active"
  });
  assert.equal(updated.item.status, "ARCHIVED");
  assert.equal(updated.item.is_active, false);
  assert.equal(db.state.queries.some((query) => /DELETE\s+FROM/i.test(query.sql)), false);
});

test("address, contact, bank account, and relationship writes use existing subtables and masked bank reads", async () => {
  const other = makeAgent({ id: "20000000-0000-4000-8000-000000000002", code: "PARTNER", name: "Partner Ltd" });
  const db = buildDb({ agents: [makeAgent(), other] });
  const app = appWithDb(db);
  const session = { tenant_id: TENANT_A, identity_id: IDENTITY_A };
  const entityId = db.state.agents[0].id;

  const address = await createEntityAddress(app, session, entityId, {
    address_type: "BILLING",
    line1: "1 Main Street",
    city: "Port Louis",
    country_code: "MU"
  });
  const contact = await createEntityContact(app, session, entityId, {
    contact_type: "EMAIL",
    value: "ops@example.com"
  });
  const bank = await createEntityBankAccount(app, session, entityId, {
    bank_name: "Bank",
    account_number: "1234567890",
    iban: "MU12BANK1234567890"
  });
  const relationship = await createEntityRelationship(app, session, entityId, {
    related_entity_id: other.id,
    relation_type: "SUPPLIES_TO"
  });

  assert.equal(address.item.country_code, "MU");
  assert.equal(contact.item.value, "ops@example.com");
  assert.equal(bank.item.account_number_masked, "****7890");
  assert.equal(bank.item.iban_masked, "****7890");
  assert.equal(Object.hasOwn(bank.item, "account_number"), false);
  assert.equal(Object.hasOwn(bank.item, "iban"), false);
  assert.equal(relationship.item.related_entity_id, other.id);
});

test("entity input validation returns impacted field metadata", async () => {
  const db = buildDb();
  const app = appWithDb(db);
  const session = { tenant_id: TENANT_A, identity_id: IDENTITY_A };
  const entityId = db.state.agents[0].id;

  await assert.rejects(
    () => createEntityAddress(app, session, entityId, {
      line1: "A62 Avenue Martin Luther",
      city: "Rose Hill",
      country_code: "Mauritius"
    }),
    (error) => {
      assert.equal(error instanceof EntityInputError, true);
      assert.equal(error.code, "TEXT_TOO_LONG");
      assert.equal(error.details.field, "country_code");
      assert.equal(error.details.maxLength, 2);
      return true;
    }
  );

  await assert.rejects(
    () => createEntityAddress(app, session, entityId, {
      line1: "x".repeat(241),
      city: "Rose Hill",
      country_code: "MU"
    }),
    (error) => {
      assert.equal(error instanceof EntityInputError, true);
      assert.equal(error.code, "TEXT_TOO_LONG");
      assert.equal(error.details.field, "line1");
      assert.equal(error.details.maxLength, 240);
      return true;
    }
  );
});

test("route rejects permission denied and tenant_id override", async () => {
  const forbidden = Fastify({ logger: false });
  forbidden.decorate("db", {
    async query(sql) {
      if (sql.includes("FROM eip_authz.identity_role")) return { rowCount: 0, rows: [] };
      return { rowCount: 0, rows: [] };
    }
  });
  forbidden.decorate("requireSession", async () => ({ ok: true, session: { tenant_id: TENANT_A, identity_id: IDENTITY_A, realm: "EIP" } }));
  forbidden.decorate("requireCsrf", async () => ({ ok: true }));
  await forbidden.register(entitiesRoutes, { prefix: "/api/eip/entities" });
  const denied = await forbidden.inject({ method: "GET", url: "/api/eip/entities" });
  assert.equal(denied.statusCode, 403);
  await forbidden.close();

  const invalid = Fastify({ logger: false });
  invalid.decorate("db", buildDb({ agents: [] }));
  invalid.decorate("requireSession", async () => ({ ok: true, session: { tenant_id: TENANT_A, identity_id: IDENTITY_A, realm: "EIP" } }));
  invalid.decorate("requireCsrf", async () => ({ ok: true }));
  await invalid.register(entitiesRoutes, { prefix: "/api/eip/entities" });
  const response = await invalid.inject({
    method: "POST",
    url: "/api/eip/entities",
    payload: { tenant_id: TENANT_B, display_name: "Injected" }
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "TENANT_OVERRIDE_NOT_ALLOWED");
  await invalid.close();
});

test("entity route family registers required endpoints, session, CSRF, RBAC, and no delete route", () => {
  for (const endpoint of [
    '"/"',
    '"/:id"',
    '"/:id/summary"',
    '"/:id/addresses"',
    '"/:id/addresses/:addressId"',
    '"/:id/contacts"',
    '"/:id/contacts/:contactId"',
    '"/:id/bank-accounts"',
    '"/:id/bank-accounts/:bankAccountId"',
    '"/:id/relationships"',
    '"/:id/relationships/:relationshipId"',
    '"/:id/documents"',
    '"/:id/policies"',
    '"/:id/activity"',
    '"/governance/options"'
  ]) {
    assert.match(route, new RegExp(endpoint.replace(/[/:]/g, "\\$&")));
  }
  assert.match(server, /import entitiesRoutes/);
  assert.match(server, /app\.register\(entitiesRoutes, \{ prefix: "\/api\/eip\/entities" \}\)/);
  assert.match(route, /app\.requireSession\(req, \{ realm: "EIP" \}\)/);
  assert.match(route, /app\.requireCsrf\(req\)/);
  assert.match(route, /hasPermission\(/);
  assert.doesNotMatch(route, /app\.delete\(/i);
});

test("service uses only existing kernel tables and protects tenant scope and bank identifiers", () => {
  for (const table of [
    "eip_core.agent",
    "eip_core.entity_address",
    "eip_core.entity_contact",
    "eip_core.entity_bank_account",
    "eip_core.object_link",
    "eip_core.info_record",
    "eip_core.commercial_condition",
    "eip_core.service_object_party",
    "eip_core.task"
  ]) {
    assert.match(service, new RegExp(table.replace(".", "\\.")));
  }
  assert.match(service, /WHERE tenant_id=\$1/);
  assert.match(service, /TENANT_OVERRIDE_NOT_ALLOWED/);
  assert.match(service, /account_number_masked/);
  assert.match(service, /iban_masked/);
  assert.match(service, /emitSecurityEvent/);
  assert.doesNotMatch(service, /CREATE\s+TABLE/i);
  assert.doesNotMatch(service, /DELETE\s+FROM\s+eip_core\.(agent|entity_address|entity_contact|entity_bank_account|object_link)/i);
  assert.doesNotMatch(service, /SELECT \* FROM eip_core\.entity_bank_account/i);
});

test("migration is additive, seeds permissions, dropdowns, module settings, and descriptor repair", () => {
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i);
  for (const value of [
    "entities.read",
    "entities.create",
    "entities.update",
    "entities.manage_addresses",
    "entities.manage_contacts",
    "entities.manage_bank_accounts",
    "entities.manage_relationships",
    "ENTITY_ROLE",
    "ENTITY_STATUS",
    "ENTITY_ADDRESS_TYPE",
    "ENTITY_CONTACT_TYPE",
    "ENTITY_RELATIONSHIP_TYPE",
    "module_catalog",
    "tenant_module_setting",
    "entity-management"
  ]) {
    assert.match(migration, new RegExp(value.replace(/[.]/g, "\\.")));
  }
  assert.match(repairMigration, /KernelModuleWorkspace/);
  assert.match(repairMigration, /ui_workspace/);
  assert.match(migration, /role_template_permission/);
  assert.match(migration, /role_permission/);
});

test("dashboard registry, source descriptor, and seed descriptor are aligned", () => {
  assert.match(registry, /import KernelModuleWorkspace/);
  assert.match(registry, /KernelModuleWorkspace,/);
  assert.match(dashboardSurface, /\{ code: "entities", label: "Entities", icon: "Users", module: "entity-management" \}/);
  assert.match(dashboardSurface, /entityKernelWorkspaceNode/);
  assert.match(moduleDescriptors, /type: "KernelModuleWorkspace"/);
  assert.match(moduleDescriptors, /name: "line1", label: "Line 1", span: "full", maxLength: 240/);
  assert.match(moduleDescriptors, /name: "line2", label: "Line 2", span: "full", maxLength: 240/);
  assert.match(moduleDescriptors, /name: "country_code", label: "Country", maxLength: 2/);
  assert.match(moduleDescriptors, /\/api\/eip\/entities\/governance\/options/);
  assert.match(seedSurface, /"code": "entities"/);
  assert.match(seedSurface, /"type": "KernelModuleWorkspace"/);
  assert.match(seedSurface, /"configEndpoint": "\/api\/eip\/entities\/governance\/options"/);
  for (const tab of ["Overview", "Profile", "Addresses", "Contacts", "Bank Accounts", "Relationships", "Documents", "Policies", "Activity"]) {
    assert.match(moduleDescriptors, new RegExp(tab));
  }
  assert.match(workspace, /configEndpoint/);
  assert.match(formErrorMigration, /0132_form_error_address_layout_v1/);
  assert.match(formErrorMigration, /form_error_address_patch_workspace/);
  assert.match(formErrorMigration, /"line1","span":"full","maxLength":240/);
  assert.match(formErrorMigration, /"line2","span":"full","maxLength":240/);
});

test("workspace and docs are tenant agnostic and avoid fake data", () => {
  const touched = `${route}\n${service}\n${migration}\n${workspace}\n${docs}`;
  assert.doesNotMatch(touched, /samara|samarapattern|samara-web-storefront/i);
  assert.doesNotMatch(touched, /sample customer|fake customer|lorem ipsum|manual_test/i);
  assert.match(docs, /No new tables/);
  assert.match(docs, /never hard-deletes/i);
});
