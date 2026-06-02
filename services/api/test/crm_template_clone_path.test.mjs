import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const cloneRoute = read("../src/routes/admin_template_clone.js");
const legacyClone = read("../db/seed/clone_template_to_tenant.sql");
const canonicalCrmSeed = read("../db/seed/template_crm_canonical_v1.sql");
const roleTemplateMigration = read("../db/migrations/0105_crm_template_clone_hardening.sql");
const runner = read("../scripts/reseed_post_migration.mjs");
const dashboardSeed = read("../db/seed/ui_surface_dashboard.sql");
const uiSurfaceRoute = read("../src/routes/ui_surface.js");
const crmCompletion = read("../src/routes/crm_completion.js");
const crmIntake = read("../src/routes/crm_intake.js");
const crmIntelligence = read("../src/routes/crm_intelligence.js");

const CRM_PROCESS_CODES = [
  "CRM_INTERACTION_FLOW_V1",
  "CRM_CASE_FLOW_V1",
  "CRM_OPPORTUNITY_FLOW_V1",
  "CRM_LEAD_FLOW_V1",
  "CRM_CAMPAIGN_FLOW_V1",
  "CRM_SEGMENT_REVIEW_FLOW_V1",
  "CRM_INTAKE_REVIEW_FLOW_V1",
  "CRM_MAILBOX_MESSAGE_FLOW_V1",
  "CRM_REPLY_REVIEW_FLOW_V1"
];

test("canonical CRM refresh puts all reusable CRM process metadata on the template tenant", () => {
  for (const code of CRM_PROCESS_CODES) {
    assert.match(canonicalCrmSeed, new RegExp(code));
    assert.match(runner, new RegExp(code));
  }
  assert.match(canonicalCrmSeed, /INSERT INTO eip_core\.process_def/);
  assert.match(canonicalCrmSeed, /INSERT INTO eip_core\.task_template/);
  assert.match(canonicalCrmSeed, /INSERT INTO eip_core\.process_binding/);
  assert.match(runner, /executeSqlFile\(client, "template_crm_canonical_v1\.sql"\)/);
});

test("governed template clone includes modules, CRM process metadata, dropdown overrides, UI overrides, and DB-owned role bundles", () => {
  for (const source of [cloneRoute, legacyClone]) {
    assert.match(source, /INSERT INTO eip_core\.tenant_module_setting/);
    assert.match(source, /INSERT INTO eip_core\.dropdown_list/);
    assert.match(source, /INSERT INTO eip_core\.dropdown_value/);
    assert.match(source, /INSERT INTO eip_core\.process_def/);
    assert.match(source, /INSERT INTO eip_core\.task_template/);
    assert.match(source, /INSERT INTO eip_core\.process_binding/);
    assert.match(source, /INSERT INTO eip_core\.ui_surface/);
    assert.match(source, /INSERT INTO eip_authz\.role/);
    assert.match(source, /INSERT INTO eip_authz\.role_permission/);
    assert.match(source, /role_template_permission/);
  }
  assert.match(cloneRoute, /COALESCE\(EXCLUDED\.attrs->'capabilities', '\{\}'::jsonb\)/);
  assert.match(cloneRoute, /COALESCE\(eip_core\.tenant_module_setting\.attrs->'capabilities', '\{\}'::jsonb\)/);
});

test("mailbox capability, mailbox dropdowns, and descriptor tabs are included in canonical governance", () => {
  assert.match(canonicalCrmSeed, /"mailbox":true/);
  for (const code of [
    "CRM_MAILBOX_PROVIDER",
    "CRM_MAILBOX_MESSAGE_STATUS",
    "CRM_MAILBOX_DIRECTION",
    "CRM_REPLY_STATUS"
  ]) {
    assert.match(canonicalCrmSeed, new RegExp(code));
  }
  assert.match(dashboardSeed, /"id": "mailbox"/);
  assert.match(dashboardSeed, /"id": "mailbox_replies"/);
  assert.match(dashboardSeed, /"capability": "mailbox"/);
});

test("published dashboard descriptors and global CRM dropdowns remain inheritable without stale tenant copies", () => {
  assert.match(uiSurfaceRoute, /\(tenant_id = \$2 OR tenant_id IS NULL\)/);
  assert.match(crmCompletion, /\(tenant_id=\$1 OR tenant_id IS NULL\)/);
  assert.match(crmIntake, /\(list\.tenant_id=\$2 OR list\.tenant_id IS NULL\)/);
  assert.match(crmIntelligence, /\(list\.tenant_id=\$2 OR list\.tenant_id IS NULL\)/);
});

test("newer lead, intelligence, intake, and mailbox permissions flow through governed role templates", () => {
  for (const value of [
    "CRM_LEAD_CONVERT",
    "CRM_TIMELINE_READ",
    "CRM_NOTE_WRITE",
    "CRM_SEGMENT_READ",
    "CRM_CAMPAIGN_WRITE",
    "CRM_SIGNAL_WRITE",
    "CRM_INTELLIGENCE_READ",
    "CRM_CONNECTOR_READ"
  ]) {
    assert.match(roleTemplateMigration, new RegExp(value));
  }
  assert.match(roleTemplateMigration, /INSERT INTO eip_authz\.role_template_permission/);
  assert.match(roleTemplateMigration, /INSERT INTO eip_authz\.role_permission/);
  assert.match(canonicalCrmSeed, /CRM_MAILBOX_REPLY_SEND/);
});
