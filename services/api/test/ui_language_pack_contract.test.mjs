import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const routeSource = fs.readFileSync(path.join(apiRoot, "src", "routes", "ui_surface.js"), "utf8");

test("EIP UI language pack is exposed as metadata, not component-local literals", () => {
  assert.match(routeSource, /DEFAULT_UI_LANGUAGE_PACK/);
  assert.match(routeSource, /supported_locales:\s*\["en", "ru", "fr", "ky", "es", "de"\]/);
  assert.match(routeSource, /component_metadata/);
  assert.match(routeSource, /loadUiLanguagePack/);
  assert.match(routeSource, /tenant_module_setting/);
  assert.match(routeSource, /module = 'ui'/);
  assert.match(routeSource, /code = 'language_pack'/);
  assert.match(routeSource, /source: "tenant_module_setting"/);
});

test("EIP UI language pack has public and authenticated metadata endpoints", () => {
  const matches = routeSource.match(/"\/ui\/language-pack"/g) || [];
  assert.ok(matches.length >= 2);
  assert.match(routeSource, /\/api\/public\/ui\/language-pack|public, max-age=60/);
  assert.match(routeSource, /\/api\/eip\/ui\/language-pack|private, max-age=0, must-revalidate/);
});
