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

  assert.match(component, /DEFAULT_PRODUCT_STUDIO_UI/);
  assert.match(component, /ProductStudioTabs/);
  assert.match(component, /ProductFocusPanel/);
  assert.doesNotMatch(component, /function ProductAnalyticsPanel/);
  assert.doesNotMatch(component, /function ProductWorkloadPanel/);
  assert.match(component, /TradeConditionsDrawer/);
  assert.match(component, /Complete product setup work/);
  assert.match(component, /Complete trade terms/);
  assert.match(component, /Read-only governance view/);
  assert.match(component, /sticky bottom-0/);
  assert.match(component, /overflow-y-auto/);
  assert.match(component, /productStudioTab === "studio"/);
  assert.match(component, /setProductStudioTab\("studio"\)/);

  assert.match(descriptor, /productStudio/);
  assert.match(descriptor, /id: "studio", label: "Studio"/);
  assert.match(descriptor, /id: "focus", label: "Focus"/);
  assert.doesNotMatch(descriptor, /id: "analytics", label: "Analytics"/);
  assert.doesNotMatch(descriptor, /id: "workload", label: "Workload"/);
  assert.match(seed, /"productStudio"/);
  assert.match(seed, /"missing_trade_conditions"/);
  const correctionMigration = read("services/api/db/migrations/0116_product_studio_focus_surface_correction.sql");
  assert.match(correctionMigration, /product_studio_focus_surface_correction/);
  assert.match(correctionMigration, /"tabs": \[/);
  assert.doesNotMatch(correctionMigration, /"analytics"/);
  assert.doesNotMatch(correctionMigration, /"workload"/);
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
