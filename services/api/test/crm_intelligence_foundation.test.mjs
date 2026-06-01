import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sanitizeMetadata } from "../src/routes/crm_intelligence.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const crm = read("../src/routes/crm.js");
const intelligence = read("../src/routes/crm_intelligence.js");
const completion = read("../src/routes/crm_completion.js");
const migration = read("../db/migrations/0101_crm_intelligence_foundation.sql");
const seed = read("../db/seed/ui_surface_dashboard.sql");
const surface = read("../../../apps/dashboard/src/engine/surfaces/dashboard.js");
const workspace = read("../../../apps/dashboard/src/components/crm/CrmWorkspace.jsx");

test("CRM intelligence extends the existing route family without new persistence tables", () => {
  assert.match(crm, /registerCrmIntelligenceRoutes/);
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i);
  assert.match(migration, /No CRM-specific persistence tables are introduced/);
});

test("CRM intelligence route families are present", () => {
  for (const route of [
    '"/segments"',
    '"/segments/:id/link"',
    '"/segments/:id/tasks"',
    '"/segments/:id/timeline"',
    '"/campaigns"',
    '"/campaigns/:id/link"',
    '"/campaigns/:id/status"',
    '"/campaigns/:id/tasks"',
    '"/campaigns/:id/notes"',
    '"/campaigns/:id/timeline"',
    '"/campaigns/:id/channel-variants"',
    '"/campaigns/:id/channel-variants/:variantId"',
    '"/signals"',
    '"/signals/:id/link"',
    '"/signals/:id/promote"',
    '"/intelligence/overview"',
    '"/intelligence/connectors"',
  ]) {
    assert.match(intelligence, new RegExp(route.replace(/[/:]/g, "\\$&")));
  }
});

test("CRM intelligence routes preserve session, CSRF, RBAC, capability, and tenant scoping", () => {
  assert.match(intelligence, /app\.requireSession\(req, \{ realm: "EIP" \}\)/);
  assert.match(intelligence, /app\.requireCsrf\(req\)/);
  assert.match(intelligence, /hasPermission\(/);
  assert.match(intelligence, /CRM_CAPABILITY_DISABLED/);
  assert.match(intelligence, /tenant_id=\$1/);
});

test("segments use agents, campaigns use process-backed service objects, and signals use info records", () => {
  assert.match(intelligence, /INSERT INTO eip_core\.agent/);
  assert.match(intelligence, /object_type: "CRM_CAMPAIGN"/);
  assert.match(intelligence, /startObjectProcess/);
  assert.match(intelligence, /advanceObjectProcess/);
  assert.match(intelligence, /INSERT INTO eip_core\.info_record/);
  assert.match(intelligence, /CRM_CAMPAIGN_SIGNAL/);
  assert.match(intelligence, /INSERT INTO eip_core\.object_link/);
});

test("signal metadata redaction removes credential-like fields by default", () => {
  assert.deepEqual(
    sanitizeMetadata({
      metric: "clicks",
      api_key: "raw-key",
      nested: { Authorization: "Bearer raw", safe: "value" },
      cookies: "browser-state"
    }),
    {
      metric: "clicks",
      api_key: "[REDACTED]",
      nested: { Authorization: "[REDACTED]", safe: "value" },
      cookies: "[REDACTED]"
    }
  );
});

test("connector readiness exposes metadata only and not profile secrets", () => {
  assert.match(intelligence, /connection_code:/);
  assert.match(intelligence, /provider_category:/);
  assert.match(intelligence, /last_sync_status:/);
  assert.doesNotMatch(intelligence, /verification\?\.api_key\?\.secret/);
  assert.doesNotMatch(intelligence, /oauth2_jwt\?\.secret/);
});

test("migration seeds governed dropdowns, permissions, role bundles, capabilities, processes, and bindings", () => {
  for (const value of [
    "CRM_SEGMENT_TYPE",
    "CRM_SEGMENT_PRIORITY",
    "CRM_SEGMENT_MATURITY",
    "CRM_CAMPAIGN_STATUS",
    "CRM_CAMPAIGN_OBJECTIVE",
    "CRM_CAMPAIGN_CHANNEL",
    "CRM_CHANNEL_VARIANT_STATUS",
    "CRM_SIGNAL_TYPE",
    "CRM_SIGNAL_PROVIDER_CATEGORY",
    "CRM_SIGNAL_SOURCE_CHANNEL",
    "CRM_CONNECTOR_READINESS_STATUS",
    "CRM_CONNECTOR_PROVIDER",
    "CRM_CAMPAIGN_FLOW_V1",
    "CRM_SEGMENT_REVIEW_FLOW_V1",
    "CRM_SEGMENT_READ",
    "CRM_CAMPAIGN_WRITE",
    "CRM_SIGNAL_WRITE",
    "CRM_INTELLIGENCE_READ",
    "CRM_CONNECTOR_READ",
  ]) {
    assert.match(migration, new RegExp(value));
  }
  assert.match(migration, /INSERT INTO eip_core\.process_binding/);
  assert.match(migration, /INSERT INTO eip_core\.task_template/);
  assert.match(migration, /UPDATE eip_core\.tenant_module_setting/);
});

test("dashboard descriptors and reusable workspace register capability-gated intelligence tabs", () => {
  for (const value of ["intelligence", "segments", "campaigns", "signals", "connectors"]) {
    assert.match(surface, new RegExp(`id: "${value}"`));
    assert.match(seed, new RegExp(`"id": "${value}"`));
  }
  assert.match(workspace, /capabilities\[item\.capability\] === true/);
  assert.match(workspace, /CRM_CAMPAIGN_CHANNEL/);
  assert.match(workspace, /CRM_SIGNAL_SOURCE_CHANNEL/);
  assert.match(completion, /capabilities: await loadCapabilities/);
});

test("CRM intelligence remains tenant agnostic and provider-adapter independent", () => {
  const touched = `${intelligence}\n${migration}\n${surface}\n${workspace}`;
  assert.doesNotMatch(touched, /samarapattern|samara-web-storefront|samara/i);
  assert.doesNotMatch(touched, /graph\.facebook|api\.instagram|analyticsdata\.googleapis/i);
});
