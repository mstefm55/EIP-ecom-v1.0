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

test("product studio surface alignment is descriptor-backed and keeps existing studio as the main tab", () => {
  const component = read("apps/dashboard/src/components/ecom/EcomProductWorkspace.jsx");
  const descriptor = read("apps/dashboard/src/engine/surfaces/dashboard.js");
  const seed = read("services/api/db/seed/ui_surface_dashboard.sql");
  const migration = read("services/api/db/migrations/0115_command_center_product_studio_surface_polish.sql");

  assert.match(component, /DEFAULT_PRODUCT_STUDIO_UI/);
  assert.match(component, /ProductStudioTabs/);
  assert.match(component, /ProductFocusPanel/);
  assert.match(component, /ProductAnalyticsPanel/);
  assert.match(component, /ProductWorkloadPanel/);
  assert.match(component, /TradeConditionsDrawer/);
  assert.match(component, /productStudioTab === "studio"/);
  assert.match(component, /setProductStudioTab\("studio"\)/);

  assert.match(descriptor, /productStudio/);
  assert.match(descriptor, /id: "studio", label: "Studio"/);
  assert.match(descriptor, /id: "focus", label: "Focus"/);
  assert.match(descriptor, /id: "analytics", label: "Analytics"/);
  assert.match(descriptor, /id: "workload", label: "Workload"/);
  assert.match(seed, /"productStudio"/);
  assert.match(seed, /"missing_trade_conditions"/);
  assert.match(migration, /product_studio_surface_alignment/);
  assert.match(migration, /productStudio/);
});

test("product studio preserves product/inventory boundary and rejected status display", () => {
  const component = read("apps/dashboard/src/components/ecom/EcomProductWorkspace.jsx");

  assert.match(component, /isDigitalProduct/);
  assert.match(component, /needsInitialInventorySetup/);
  assert.match(component, /currentProductIsDigital \? \[\] : \[\{ id: "inventory"/);
  assert.match(component, /rejected \? "Rejected" : inStock \? "In stock" : "Out of stock"/);
  assert.match(component, /Operational stock movements stay in the Inventory module/);
  assert.doesNotMatch(component, /Purchase Order|PO lifecycle|supplier outbound transmission/i);
  assert.doesNotMatch(component, /samara|samarapattern|samara-web-storefront/i);
});
