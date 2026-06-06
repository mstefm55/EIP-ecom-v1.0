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
  assert.match(route, /\/user\/tasks\/:id\/schedule/);
  assert.match(route, /app\.requireCsrf\(req\)/);
  assert.match(service, /FROM eip_core\.task t/);
  assert.match(service, /LEFT JOIN eip_core\.service_object so/);
  assert.match(service, /LEFT JOIN eip_core\.process_def pd/);
  assert.match(service, /tenant_id=\$1|tenant_id = \$1/);
  assert.match(service, /task_status_event/);
  assert.match(service, /scheduleCommandCenterTask/);
  assert.match(service, /reason_code, note, actor_agent_id, attrs/);
  assert.match(service, /'scheduled'/);
  assert.doesNotMatch(service, /CREATE TABLE/i);
  assert.doesNotMatch(service, /samara|samarapattern|samara-web-storefront/i);
});

test("command center dashboard UI is descriptor-driven and keeps the task browser scroll bounded", () => {
  const component = read("apps/dashboard/src/components/user/UserDashboardPanel.jsx");
  const descriptor = read("apps/dashboard/src/engine/surfaces/dashboard.js");
  const seed = read("services/api/db/seed/ui_surface_dashboard.sql");
  const migration = read("services/api/db/migrations/0113_command_center_dashboard_descriptor.sql");
  const refreshMigration = read("services/api/db/migrations/0114_command_center_theme_descriptor_refresh.sql");

  assert.match(component, /mergeConfig\(node\?\.props/);
  assert.match(component, /COMMAND_CENTER_THEMES/);
  assert.match(component, /variant: "eip_v1"/);
  assert.match(component, /light_glass_ready/);
  assert.match(component, /resolveCommandTheme/);
  assert.match(component, /Run the business, not the system/);
  assert.match(component, /Analytics/);
  assert.match(component, /Workload/);
  assert.match(component, /TaskBrowser/);
  assert.match(component, /ScheduleTaskModal/);
  assert.match(component, /dueDateFilters/);
  assert.match(component, /assignmentFilters/);
  assert.match(component, /min-h-\[32vh\] max-h-\[46vh\]/);
  assert.match(component, /sticky bottom-0/);
  assert.match(component, /Business statistics/);
  assert.match(component, /Burning topics/);
  assert.match(component, /text-3xl font-semibold/);
  assert.match(component, /xl:fixed xl:right-5 xl:top-\[6\.75rem\]/);
  assert.match(component, /PanelRightClose/);
  assert.match(component, /PanelRightOpen/);
  assert.match(component, /grid-rows-\[1fr\]/);
  assert.match(component, /grid-rows-\[0fr\]/);
  assert.doesNotMatch(component, /!hasOpenCategory/);
  assert.match(component, /xl:grid-cols-\[minmax\(0,1fr\)_minmax\(330px,24vw\)\]/);
  assert.match(component, /onOpenDetail\?\.\(widget\)/);
  assert.match(component, /onDelegate/);
  assert.match(component, /onSchedule/);
  assert.match(component, /ctx\?\.user\?\.setActiveTab/);
  assert.doesNotMatch(component, /samara|samarapattern|samara-web-storefront/i);

  assert.match(descriptor, /endpoint: "\/api\/eip\/user\/dashboard\/command-center"/);
  assert.match(descriptor, /taskBrowser/);
  assert.match(descriptor, /theme/);
  assert.match(descriptor, /variant: "eip_v1"/);
  assert.match(descriptor, /categoryPresentation/);
  assert.match(descriptor, /widgets/);
  assert.match(seed, /"endpoint": "\/api\/eip\/user\/dashboard\/command-center"/);
  assert.match(seed, /"categoryPresentation"/);
  assert.match(seed, /"taskBrowser"/);
  assert.match(seed, /"dueDateFilters"/);
  assert.match(seed, /"assignmentFilters"/);
  assert.match(seed, /"theme"/);
  assert.match(seed, /"variant": "eip_v1"/);
  assert.match(seed, /"controls": "Filters, delegation rules and category pinning"/);
  assert.match(migration, /command_center_props/);
  assert.match(migration, /"theme"/);
  assert.match(migration, /"density": "comfortable"/);
  assert.match(migration, /jsonb_set\(panel_child, '\{props\}', command_center_props, true\)/);
  assert.match(refreshMigration, /command_center_theme_descriptor_refresh/);
  assert.match(refreshMigration, /"command_center_theme_tokens":true/);
  assert.match(refreshMigration, /"variant": "eip_v1"/);
  const surfacePolishMigration = read("services/api/db/migrations/0115_command_center_product_studio_surface_polish.sql");
  assert.match(surfacePolishMigration, /command_center_scheduling/);
});

test("command center category routing uses scored metadata instead of broad text includes", () => {
  const service = read("services/api/src/services/dashboard/commandCenter.js");

  assert.match(service, /explicitModule === category\.code/);
  assert.match(service, /strongFields/);
  assert.match(service, /descriptiveFields/);
  assert.match(service, /new RegExp/);
  assert.match(service, /objectTitle\.toLowerCase\(\)\.includes\(objectCode\.toLowerCase\(\)\)/);
  assert.doesNotMatch(service, /haystack\.includes/);
});
