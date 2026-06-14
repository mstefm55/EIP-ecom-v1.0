import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Fastify from "fastify";
import crmRoutes from "../src/routes/crm.js";
import {
  CRM_ACCOUNT_STATUSES,
  CRM_ACTIVITY_STATUSES,
  CRM_MANAGEMENT_PERMISSIONS,
  CRM_OPPORTUNITY_STATUSES
} from "../src/services/crm/crmManagement.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const route = read("../src/routes/crm.js");
const completionRoute = read("../src/routes/crm_completion.js");
const service = read("../src/services/crm/crmManagement.js");
const migration = read("../db/migrations/0128_crm_management_v1.sql");
const docs = read("../../../docs/crm_management_v1.md");
const registry = read("../../../apps/dashboard/src/engine/registry.jsx");
const dashboardSurface = read("../../../apps/dashboard/src/engine/surfaces/dashboard.js");
const moduleDescriptors = read("../../../apps/dashboard/src/engine/surfaces/kernelModuleDescriptors.js");
const seedSurface = read("../db/seed/ui_surface_dashboard.sql");
const kernelWorkspace = read("../../../apps/dashboard/src/components/engine/KernelModuleWorkspace.jsx");

test("CRM Management V1 registers the required operational endpoints", async () => {
  const app = Fastify();
  await app.register(crmRoutes, { prefix: "/api/eip/crm" });

  for (const [method, path] of [
    ["GET", "/api/eip/crm/accounts"],
    ["POST", "/api/eip/crm/accounts"],
    ["GET", "/api/eip/crm/accounts/:id"],
    ["PATCH", "/api/eip/crm/accounts/:id"],
    ["GET", "/api/eip/crm/accounts/:id/contacts"],
    ["POST", "/api/eip/crm/accounts/:id/contacts"],
    ["PATCH", "/api/eip/crm/accounts/:id/contacts/:contactId"],
    ["GET", "/api/eip/crm/opportunities"],
    ["POST", "/api/eip/crm/opportunities"],
    ["GET", "/api/eip/crm/opportunities/:id"],
    ["PATCH", "/api/eip/crm/opportunities/:id"],
    ["POST", "/api/eip/crm/opportunities/:id/convert"],
    ["GET", "/api/eip/crm/activities"],
    ["POST", "/api/eip/crm/activities"],
    ["PATCH", "/api/eip/crm/activities/:id"],
    ["GET", "/api/eip/crm/accounts/:id/summary"],
    ["GET", "/api/eip/crm/pipeline"],
    ["GET", "/api/eip/crm/governance/options"]
  ]) {
    assert.equal(app.hasRoute({ method, url: path }), true, `${method} ${path}`);
  }

  await app.close();
});

test("CRM Management V1 exposes the locked permission set and statuses", () => {
  assert.deepEqual(Object.values(CRM_MANAGEMENT_PERMISSIONS), [
    "crm.read",
    "crm.account.create",
    "crm.account.update",
    "crm.contact.manage",
    "crm.opportunity.create",
    "crm.opportunity.update",
    "crm.activity.create",
    "crm.activity.update",
    "crm.convert",
    "crm.policy.read"
  ]);
  assert.deepEqual(CRM_ACCOUNT_STATUSES, ["PROSPECT", "ACTIVE_CUSTOMER", "INACTIVE_CUSTOMER", "UNDER_REVIEW", "BLOCKED", "ARCHIVED"]);
  assert.deepEqual(CRM_OPPORTUNITY_STATUSES, ["NEW", "QUALIFYING", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "CANCELLED", "ARCHIVED"]);
  assert.deepEqual(CRM_ACTIVITY_STATUSES, ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED", "BLOCKED"]);
});

test("CRM Management V1 uses existing kernel tables only", () => {
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i);
  assert.doesNotMatch(migration, /CREATE\s+TABLE[\s\S]*crm_(customer|prospect|account|contact|opportunity)\b/i);
  for (const table of [
    "eip_core.agent",
    "eip_core.entity_contact",
    "eip_core.service_object",
    "eip_core.service_object_party",
    "eip_core.task",
    "eip_core.info_record",
    "eip_core.object_link",
    "eip_core.commercial_condition"
  ]) {
    assert.match(service + migration, new RegExp(table.replace(".", "\\.")));
  }
});

test("CRM Management V1 routes use lowercase permissions and management service functions", () => {
  for (const value of Object.values(CRM_MANAGEMENT_PERMISSIONS)) {
    assert.match(route + completionRoute + migration, new RegExp(value.replaceAll(".", "\\.")));
  }
  for (const fn of [
    "listCrmAccounts",
    "createCrmAccount",
    "getCrmAccount",
    "updateCrmAccount",
    "listCrmAccountContacts",
    "createCrmContact",
    "updateCrmContact",
    "listCrmOpportunities",
    "createCrmOpportunity",
    "getCrmOpportunity",
    "updateCrmOpportunity",
    "listCrmActivities",
    "createCrmActivity",
    "updateCrmActivity",
    "getCrmAccountSummary",
    "getCrmPipeline",
    "convertCrmOpportunity"
  ]) {
    assert.match(route + completionRoute, new RegExp(fn));
  }
});

test("CRM Management V1 rejects tenant overrides, sensitive attrs, and raw payload exposure", () => {
  assert.match(service, /TENANT_OVERRIDE_NOT_ALLOWED/);
  assert.match(service, /SENSITIVE_FIELD_NOT_ALLOWED/);
  assert.match(service, /TENANT_OVERRIDE_RE/);
  assert.match(service, /SENSITIVE_KEY_RE/);
  assert.match(service, /safeAccount/);
  assert.match(service, /safeOpportunity/);
  assert.match(service, /safeActivity/);
  assert.doesNotMatch(service, /SELECT \*/);
  assert.doesNotMatch(service, /reply\.send\(\{\s*ok:\s*true,\s*items:\s*r\.rows/s);
});

test("CRM Management V1 seeds DB-driven kernel workspace metadata", () => {
  assert.match(migration, /module_catalog/);
  assert.match(migration, /tenant_module_setting/);
  assert.match(migration, /"ui_workspace"/);
  assert.match(migration, /"type":"KernelModuleWorkspace"/);
  assert.match(migration, /"configEndpoint":"\/api\/eip\/crm\/governance\/options"/);
  assert.match(completionRoute, /getCrmGovernanceOptions/);
  assert.match(service, /loadModuleWorkspace\(app, session\.tenant_id, "crm"\)/);
});

test("CRM dashboard uses the generic kernel workspace mount for CRM", () => {
  assert.doesNotMatch(registry, /import CrmWorkspace/);
  assert.doesNotMatch(registry, /CrmWorkspace,/);
  assert.match(registry, /KernelModuleWorkspace/);
  assert.match(moduleDescriptors, /export const crmKernelWorkspaceNode/);
  assert.match(moduleDescriptors, /configEndpoint: "\/api\/eip\/crm\/governance\/options"/);
  assert.match(dashboardSurface, /crmKernelWorkspaceNode/);
  assert.match(seedSurface, /"id": "crm-management-workspace"/);
  assert.match(seedSurface, /"type": "KernelModuleWorkspace"/);
  assert.doesNotMatch(seedSurface, /"type": "CrmWorkspace"/);
});

test("KernelModuleWorkspace has reusable primitives required by CRM metadata", () => {
  for (const token of [
    "field.type === \"hidden\"",
    "source={data}",
    "tab.rowActions",
    "endpointFor(action.endpoint, selected, row)",
    "uppercaseOptions",
    "visibleTabs"
  ]) {
    assert.match(kernelWorkspace, new RegExp(token.replace(/[(){}[\].?*+^$|\\]/g, "\\$&")));
  }
});

test("CRM Management V1 documents routes, permissions, security, and conversion behavior", () => {
  assert.match(docs, /CRM Management V1/);
  assert.match(docs, /No CRM-only customer\/prospect tables/i);
  assert.match(docs, /POST `?\/opportunities\/:id\/convert`?/);
  assert.match(docs, /crm\.policy\.read/);
  assert.match(docs, /No fake\/demo data/i);
  assert.match(docs, /KernelModuleWorkspace/);
});
