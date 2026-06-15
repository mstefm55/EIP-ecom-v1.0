import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const workspace = read("../../../apps/dashboard/src/components/engine/KernelModuleWorkspace.jsx");
const descriptors = read("../../../apps/dashboard/src/engine/surfaces/kernelModuleDescriptors.js");
const dashboardSurface = read("../../../apps/dashboard/src/engine/surfaces/dashboard.js");
const registry = read("../../../apps/dashboard/src/engine/registry.jsx");
const seedSurface = read("../db/seed/ui_surface_dashboard.sql");
const migration = read("../db/migrations/0130_kernel_ux_shell_v1.sql");
const docs = read("../../../docs/kernel_ux_shell_v1.md");

function count(text, pattern) {
  return (text.match(pattern) || []).length;
}

test("KernelModuleWorkspace supports metadata-driven premium shell primitives", () => {
  for (const token of [
    "HeroMetrics",
    "KernelModuleTabs",
    "ProcessIntentStrip",
    "OverviewCards",
    "ActionButton",
    "layout.metrics",
    "layout.processHealth",
    "detailConfig.process",
    "detailConfig.overviewCards",
    "listConfig.meta",
    "detailConfig.meta"
  ]) {
    assert.match(workspace, new RegExp(token.replace(/[(){}[\].?*+^$|\\]/g, "\\$&")));
  }

  assert.match(workspace, /glass-panel/);
  assert.match(workspace, /tracking-\[0\.2em\]/);
  assert.match(workspace, /rounded-full/);
  assert.match(workspace, /bg-ink-900/);
  assert.match(workspace, /shadow-soft/);
});

test("disabled action reasons and metadata tabs are visible, not dead controls", () => {
  assert.match(workspace, /disabledReasonForAction/);
  assert.match(workspace, /permissionDeniedReason/);
  assert.match(workspace, /Action is unavailable for this status/);
  assert.match(workspace, /<p className="mt-1 max-w-\[12rem\]/);
  assert.match(workspace, /<KernelModuleTabs tabs=\{visibleTabs\}/);
  assert.match(workspace, /tabs\.map/);
  assert.match(workspace, /tab\.type === "communications"/);
});

test("released module descriptors carry process, overview, and master-card metadata", () => {
  for (const moduleLabel of [
    "Entity intent",
    "CRM intent",
    "Inventory intent",
    "Procurement intent",
    "Policy intent"
  ]) {
    assert.match(descriptors, new RegExp(moduleLabel));
  }

  for (const token of [
    "overviewCards",
    "processHealth",
    "list: {",
    "meta: [",
    "Communication provider not configured",
    "type: \"communications\""
  ]) {
    assert.match(descriptors, new RegExp(token.replace(/[(){}[\].?*+^$|\\]/g, "\\$&")));
  }

  assert.equal(count(descriptors, /type:\s*"KernelModuleWorkspace"/g), 5);
  assert.match(registry, /KernelModuleWorkspace/);
  assert.match(dashboardSurface, /entityKernelWorkspaceNode/);
  assert.match(dashboardSurface, /crmKernelWorkspaceNode/);
  assert.match(dashboardSurface, /inventoryKernelWorkspaceNode/);
  assert.match(dashboardSurface, /procurementKernelWorkspaceNode/);
  assert.match(dashboardSurface, /policiesKernelWorkspaceNode/);
});

test("metadata migration patches DB-owned workspaces without schema churn", () => {
  assert.match(migration, /0130_kernel_ux_shell_v1/);
  assert.match(migration, /module_catalog/);
  assert.match(migration, /tenant_module_setting/);
  assert.match(migration, /kernel_ux_patch_workspace/);
  assert.match(migration, /kernel_ux_patch_tabs/);
  assert.match(migration, /"type":"communications"/);
  assert.match(migration, /"overviewCards"/);
  assert.match(migration, /"process"/);
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i);
  assert.doesNotMatch(migration, /ALTER\s+TABLE/i);
  assert.doesNotMatch(migration, /DROP\s+/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("kernel UX docs explain metadata customization and hardcoding boundary", () => {
  assert.match(docs, /Kernel UX Shell V1/);
  assert.match(docs, /Descriptor Fields/);
  assert.match(docs, /Process Model/);
  assert.match(docs, /Communications Slot/);
  assert.match(docs, /Module-specific JavaScript is still avoided/);
  assert.match(docs, /0130_kernel_ux_shell_v1\.sql/);
});

test("kernel UX shell V1 avoids fake data and duplicate panels", () => {
  const productionText = [workspace, descriptors, migration, docs].join("\n");
  assert.doesNotMatch(productionText, /lorem ipsum|fake email|sample customer|manual_test|samarapattern/i);
  for (const panelId of [
    "user-entities-panel",
    "user-crm-panel",
    "user-inventory-panel",
    "user-procurement-panel",
    "user-policies-panel"
  ]) {
    assert.equal(count(seedSurface, new RegExp(`"id": "${panelId}"`, "g")), 1, panelId);
  }
});
