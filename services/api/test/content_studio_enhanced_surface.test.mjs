import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const migration = fs.readFileSync(
  path.join(apiRoot, "db", "migrations", "0134_content_studio_enhanced_surface.sql"),
  "utf8"
);
const dashboardSeed = fs.readFileSync(
  path.join(apiRoot, "db", "seed", "ui_surface_dashboard.sql"),
  "utf8"
);

test("governed dashboard surface exposes enhanced Content Studio without replacing legacy studio", () => {
  for (const source of [migration, dashboardSeed]) {
    assert.match(source, /content-enhanced/);
    assert.match(source, /content-studio-enhanced/);
    assert.match(source, /user-content-enhanced-panel/);
    assert.match(source, /Content Studio Enhanced/);
  }
  assert.match(dashboardSeed, /"mode": "content-studio"/);
  assert.match(dashboardSeed, /"mode": "content-studio-enhanced"/);
});

test("migration patches every active published dashboard surface idempotently", () => {
  assert.match(migration, /WHERE ui_surface\.code = 'dashboard'/);
  assert.match(migration, /ui_surface\.is_active = true/);
  assert.match(migration, /ui_surface\.is_published = true/);
  assert.match(migration, /entry->>'code' <> 'content-enhanced'/);
  assert.match(migration, /entry->>'id' <> 'user-content-enhanced-panel'/);
  assert.match(migration, /content_studio_legacy_preserved/);
});
