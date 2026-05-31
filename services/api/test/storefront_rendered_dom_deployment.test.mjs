import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dockerfile = fs.readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

test("API Dockerfile installs Debian Bookworm Chromium at the scanner path", () => {
  assert.match(dockerfile, /FROM node:22-bookworm-slim/);
  assert.match(dockerfile, /apt-get install -y --no-install-recommends[\s\S]*chromium/);
  assert.match(dockerfile, /STOREFRONT_RENDERED_SCAN_EXECUTABLE_PATH=\/usr\/bin\/chromium/);
  assert.match(dockerfile, /USER node/);
  assert.doesNotMatch(dockerfile, /--no-sandbox/);
});

test("API startup emits a safe rendered DOM browser diagnostic", () => {
  assert.match(server, /event: "storefront_rendered_dom_scanner_diagnostic"/);
  assert.match(server, /buildRenderedDomScannerDiagnostic\(app\.config\)/);
});
