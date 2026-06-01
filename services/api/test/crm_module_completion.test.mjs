import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const crm = read("../src/routes/crm.js");
const completion = read("../src/routes/crm_completion.js");
const engine = read("../src/core/core_process_engine.js");
const processRoutes = read("../src/routes/process/core_process.js");
const migration = read("../db/migrations/0099_crm_module_completion.sql");
const descriptorRepair = read("../db/migrations/0100_crm_dashboard_descriptor_repair.sql");
const uiSurfaceRoutes = read("../src/routes/ui_surface.js");
const registry = read("../../../apps/dashboard/src/engine/registry.jsx");
const surface = read("../../../apps/dashboard/src/engine/surfaces/dashboard.js");
const userShell = read("../../../apps/dashboard/src/components/user/UserShell.jsx");
const workspace = read("../../../apps/dashboard/src/components/crm/CrmWorkspace.jsx");

test("CRM completion extends the existing route family without CRM persistence tables", () => {
  assert.match(crm, /registerCrmCompletionRoutes/);
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i);
  assert.match(migration, /No CRM-specific persistence tables are introduced/);
});

test("CRM completion registers leads, conversion, notes, timeline, overview, and editable objects", () => {
  for (const route of [
    '"/leads"',
    '"/leads/:id"',
    '"/leads/:id/status"',
    '"/leads/:id/tasks"',
    '"/leads/:id/convert"',
    '"/notes"',
    '"/timeline"',
    '"/dashboard/overview"',
    '"/agents/:id/overview"',
  ]) {
    assert.match(completion, new RegExp(route.replace(/[/:]/g, "\\$&")));
  }
  assert.match(completion, /\["cases", "CRM_CASE", "CRM_CASE_WRITE"\]/);
  assert.match(completion, /\["opportunities", "CRM_OPPORTUNITY", "CRM_OPPORTUNITY_WRITE"\]/);
});

test("CRM write routes preserve session, CSRF, permission, and tenant scope checks", () => {
  assert.match(completion, /app\.requireSession\(req, \{ realm: "EIP" \}\)/);
  assert.match(completion, /app\.requireCsrf\(req\)/);
  assert.match(completion, /hasPermission\(/);
  assert.match(completion, /tenant_id=\$1/);
});

test("legacy case and opportunity task routes both use governed process advancement", () => {
  assert.doesNotMatch(crm, /insertTask\(app\.db/);
  assert.match(crm, /objectType: "CRM_CASE"[\s\S]*?action: "task\.create"/);
  assert.match(crm, /objectType: "CRM_OPPORTUNITY"[\s\S]*?action: "task\.create"/);
  assert.match(crm, /effect\.type === "TASK_CREATE"/);
});

test("kernel process engine supports governed party linking and explicit task due dates", () => {
  assert.match(engine, /PARTY_LINK_CREATE: "partyLinkCreate"/);
  assert.match(engine, /INSERT INTO eip_core\.service_object_party/);
  assert.match(engine, /resolveDynamicValue\(effect\?\.due_at, ctx, payload\)/);
  assert.match(engine, /taskServiceObjectId/);
  assert.match(processRoutes, /PARTY_LINK_SERVICE_OBJECT_ID_REQUIRED/);
  assert.match(processRoutes, /PARTY_LINK_AGENT_ID_REQUIRED/);
  assert.match(processRoutes, /PARTY_LINK_ROLE_REQUIRED/);
});

test("migration seeds tenant-scoped CRM processes, bindings, task templates, dropdowns, and additive permissions", () => {
  for (const value of [
    "CRM_LEAD_FLOW_V1",
    "CRM_INTERACTION_FLOW_V1",
    "CRM_CASE_FLOW_V1",
    "CRM_OPPORTUNITY_FLOW_V1",
    "CRM_LEAD_STATUS",
    "CRM_TASK_TYPE",
    "CRM_LEAD_CONVERT",
    "CRM_TIMELINE_READ",
    "CRM_NOTE_WRITE",
    "PARTY_LINK_CREATE",
  ]) {
    assert.match(migration, new RegExp(value));
  }
  assert.match(migration, /INSERT INTO eip_core\.process_binding/);
  assert.match(migration, /INSERT INTO eip_core\.task_template/);
  assert.match(migration, /target_list_id uuid/);
  assert.doesNotMatch(migration, /^\s*list_id uuid;/m);
});

test("lead conversion remains process-governed", () => {
  assert.match(migration, /"action":"convert"/);
  assert.match(migration, /"type":"CHILD_SERVICE_OBJECT_CREATE"/);
  assert.match(migration, /"type":"PARTY_LINK_CREATE"/);
  assert.match(migration, /"type":"INFO_RECORD_WRITE"/);
  assert.match(migration, /"type":"INSTANCE_START"/);
  assert.match(completion, /action: "convert"/);
});

test("CRM dashboard is descriptor registered, module gated, and backed by a reusable widget", () => {
  assert.match(registry, /import CrmWorkspace/);
  assert.match(registry, /CrmWorkspace,/);
  assert.match(surface, /\{ code: "crm", label: "CRM", icon: "Users", module: "crm" \}/);
  assert.match(surface, /type: "CrmWorkspace"/);
  assert.match(userShell, /activeModules\?\.includes\(String\(item\.module\)\.trim\(\)\.toLowerCase\(\)\)/);
  assert.match(workspace, /export default function CrmWorkspace/);
  assert.match(workspace, /CRM_LEAD_STATUS/);
  assert.match(workspace, /WRITE_PERMISSIONS/);
  assert.match(completion, /options,[\s\S]*permissions,[\s\S]*capabilities: await loadCapabilities/);
});

test("CRM module visibility uses a narrow entitlement endpoint and repairs older dashboard descriptors", () => {
  assert.match(uiSurfaceRoutes, /app\.get\("\/user\/dashboard\/modules"/);
  assert.match(uiSurfaceRoutes, /buildActiveModules\(app, s\.session\.tenant_id\)/);
  assert.match(userShell, /apiFetch\("\/api\/eip\/user\/dashboard\/modules"\)/);
  assert.match(userShell, /apiFetch\("\/api\/eip\/user\/dashboard\/summary"\)/);
  assert.match(descriptorRepair, /item->>'code' = 'crm'/);
  assert.match(descriptorRepair, /item->>'id' = 'user-crm-panel'/);
  assert.doesNotMatch(descriptorRepair, /CREATE\s+TABLE/i);
});

test("CRM completion remains tenant agnostic", () => {
  const touched = `${completion}\n${workspace}\n${migration}\n${descriptorRepair}`;
  assert.doesNotMatch(touched, /samarapattern|samara-web-storefront|samara/i);
});

test("agent overview masks bank account identifiers on read", () => {
  assert.match(completion, /account_number_masked/);
  assert.match(completion, /iban_masked/);
  assert.doesNotMatch(completion, /SELECT \* FROM eip_core\.entity_bank_account/);
});
