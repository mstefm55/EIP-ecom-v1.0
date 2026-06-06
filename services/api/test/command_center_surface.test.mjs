import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

test("command center backend stays a thin tenant-scoped composition surface", () => {
  const route = read("services/api/src/routes/ui_surface.js");
  const service = read("services/api/src/services/dashboard/commandCenter.js");

  assert.match(route, /\/user\/dashboard\/command-center/);
  assert.match(route, /buildCommandCenterPayload/);
  assert.match(route, /\/user\/tasks\/:id\/delegate/);
  assert.match(route, /app\.requireCsrf\(req\)/);
  assert.match(service, /FROM eip_core\.task t/);
  assert.match(service, /LEFT JOIN eip_core\.service_object so/);
  assert.match(service, /LEFT JOIN eip_core\.process_def pd/);
  assert.match(service, /tenant_id=\$1|tenant_id = \$1/);
  assert.match(service, /task_status_event/);
  assert.doesNotMatch(service, /CREATE TABLE/i);
  assert.doesNotMatch(service, /samara|samarapattern|samara-web-storefront/i);
});

test("command center dashboard UI is descriptor-driven and keeps the task browser scroll bounded", () => {
  const component = read("apps/dashboard/src/components/user/UserDashboardPanel.jsx");
  const descriptor = read("apps/dashboard/src/engine/surfaces/dashboard.js");
  const seed = read("services/api/db/seed/ui_surface_dashboard.sql");
  const migration = read("services/api/db/migrations/0113_command_center_dashboard_descriptor.sql");

  assert.match(component, /mergeConfig\(node\?\.props/);
  assert.match(component, /Run the business, not the system/);
  assert.match(component, /Analytics/);
  assert.match(component, /Workload/);
  assert.match(component, /TaskBrowser/);
  assert.match(component, /Business statistics/);
  assert.match(component, /Burning topics/);
  assert.match(component, /text-3xl font-semibold/);
  assert.match(component, /max-h-\[30vh\]/);
  assert.match(component, /xl:grid-cols-\[minmax\(0,1fr\)_minmax\(330px,24vw\)\]/);
  assert.match(component, /onOpenDetail\?\.\(widget\)/);
  assert.match(component, /onDelegate/);
  assert.match(component, /ctx\?\.user\?\.setActiveTab/);
  assert.doesNotMatch(component, /samara|samarapattern|samara-web-storefront/i);

  assert.match(descriptor, /endpoint: "\/api\/eip\/user\/dashboard\/command-center"/);
  assert.match(descriptor, /taskBrowser/);
  assert.match(descriptor, /categoryPresentation/);
  assert.match(descriptor, /widgets/);
  assert.match(seed, /"endpoint": "\/api\/eip\/user\/dashboard\/command-center"/);
  assert.match(seed, /"categoryPresentation"/);
  assert.match(seed, /"taskBrowser"/);
  assert.match(migration, /command_center_props/);
  assert.match(migration, /jsonb_set\(panel_child, '\{props\}', command_center_props, true\)/);
});
