import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const ecomRoute = fs.readFileSync(new URL("../src/routes/ecom.js", import.meta.url), "utf8");
const dashboard = fs.readFileSync(
  new URL("../../../apps/dashboard/src/components/ecom/EcomProductWorkspace.jsx", import.meta.url),
  "utf8"
);
const migration = fs.readFileSync(
  new URL("../db/migrations/0097_storefront_content_republish_cycle.sql", import.meta.url),
  "utf8"
);
const templateSeed = fs.readFileSync(
  new URL("../db/seed/template_ecom_canonical_v1.sql", import.meta.url),
  "utf8"
);

function storefrontActionRoute(path) {
  const start = ecomRoute.indexOf(`"${path}"`);
  assert.notEqual(start, -1, `missing route ${path}`);
  const nextRoute = ecomRoute.indexOf("\n  app.", start + path.length);
  return ecomRoute.slice(start, nextRoute === -1 ? undefined : nextRoute);
}

test("storefront slot actions bootstrap intake only for draft handoff", () => {
  const source = storefrontActionRoute("/storefront/content/:slot/actions");
  assert.match(source, /if \(action === "DRAFT_READY"\) \{/);
  assert.doesNotMatch(source, /if \(action !== "INTAKE"\) \{/);
});

test("storefront item actions bootstrap intake only for draft handoff", () => {
  const source = storefrontActionRoute("/storefront/content/items/:id/actions");
  assert.match(source, /if \(action === "DRAFT_READY"\) \{/);
  assert.doesNotMatch(source, /if \(action !== "INTAKE"\) \{/);
});

test("storefront transition idempotency is scoped to the publication lifecycle", () => {
  assert.match(ecomRoute, /function storefrontContentLifecycleKey\(row\)/);
  assert.equal((ecomRoute.match(/lifecycle: lifecycleKey/g) || []).length, 4);
});

test("published storefront content can re-enter governed draft flow for republish", () => {
  for (const source of [migration, templateSeed]) {
    assert.match(source, /"from": "content_published"/);
    assert.match(source, /"to": "content_draft"/);
    assert.match(source, /"action": "INTAKE"/);
    assert.match(source, /"republish_required": true/);
  }
});

test("dashboard requires final publish confirmation from backend", () => {
  assert.match(dashboard, /let published = await callAction\("PUBLISH"\);/);
  assert.match(dashboard, /published = await callAction\("PUBLISH", \{ publishEnglishOnly: true \}\);/);
  assert.doesNotMatch(dashboard, /callAction\("PUBLISH", \{ allowInvalidTransition: true \}\)/);
});
