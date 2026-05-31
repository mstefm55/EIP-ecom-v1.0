import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildRenderedDomScannerDiagnostic,
  renderStorefrontDom,
  resolveRenderedScanConfig,
  shouldAllowRenderedResource
} from "../src/services/storefront/renderedDomScanner.js";

const executablePath = process.execPath;

test("rendered DOM scanner can be disabled without loading a browser adapter", async () => {
  let loaded = false;
  const result = await renderStorefrontDom({
    url: "https://store.example",
    config: { STOREFRONT_RENDERED_SCAN_ENABLED: false },
    playwrightLoader: async () => {
      loaded = true;
      return {};
    }
  });
  assert.deepEqual(result, { ok: false, error: "RENDERED_DOM_SCANNER_DISABLED" });
  assert.equal(loaded, false);
});

test("rendered DOM resource policy blocks writes, credential URLs, and heavy resources", () => {
  assert.equal(
    shouldAllowRenderedResource({ url: "https://store.example/app.js", method: "GET", resourceType: "script" }).allowed,
    true
  );
  assert.equal(
    shouldAllowRenderedResource({ url: "https://store.example/intake", method: "POST", resourceType: "fetch" }).reason,
    "RENDERED_DOM_RESOURCE_METHOD_FORBIDDEN"
  );
  assert.equal(
    shouldAllowRenderedResource({ url: "https://user:pass@store.example/app.js", method: "GET", resourceType: "script" }).reason,
    "RENDERED_DOM_RESOURCE_CREDENTIALS_FORBIDDEN"
  );
  assert.equal(
    shouldAllowRenderedResource({ url: "https://store.example/cover.jpg", method: "GET", resourceType: "image" }).reason,
    "RENDERED_DOM_RESOURCE_TYPE_BLOCKED"
  );
  assert.equal(
    shouldAllowRenderedResource({ url: "file:///etc/passwd", method: "GET", resourceType: "document" }).reason,
    "RENDERED_DOM_RESOURCE_SCHEME_FORBIDDEN"
  );
});

test("rendered DOM scan executes an isolated adapter and returns only its sanitized snapshot", async () => {
  const guarded = [];
  let routeHandler;
  let browserClosed = false;
  let contextClosed = false;
  const page = {
    route: async (_pattern, handler) => {
      routeHandler = handler;
    },
    on: () => {},
    goto: async () => {},
    waitForTimeout: async () => {},
    evaluate: async () => "<html><body><section class=\"hero-banner\"><h1>Rendered storefront</h1></section></body></html>"
  };
  const result = await renderStorefrontDom({
    url: "https://store.example",
    config: {
      STOREFRONT_RENDERED_SCAN_ENABLED: true,
      STOREFRONT_RENDERED_SCAN_EXECUTABLE_PATH: executablePath,
      STOREFRONT_RENDERED_SCAN_WAIT_MS: 0
    },
    outboundGuard: async (url) => {
      guarded.push(url);
      return { ok: true, url };
    },
    playwrightLoader: async () => ({
      chromium: {
        launch: async () => ({
          newContext: async () => ({
            newPage: async () => page,
            close: async () => {
              contextClosed = true;
            }
          }),
          close: async () => {
            browserClosed = true;
          }
        })
      }
    })
  });
  assert.equal(typeof routeHandler, "function");
  assert.equal(result.ok, true);
  assert.match(result.html, /Rendered storefront/);
  assert.deepEqual(guarded, ["https://store.example"]);
  assert.equal(contextClosed, true);
  assert.equal(browserClosed, true);
});

test("rendered DOM scanner config is bounded and discovers an explicit executable", () => {
  const config = resolveRenderedScanConfig({
    STOREFRONT_RENDERED_SCAN_EXECUTABLE_PATH: executablePath,
    STOREFRONT_RENDERED_SCAN_TIMEOUT_MS: 999999,
    STOREFRONT_RENDERED_SCAN_WAIT_MS: -1,
    STOREFRONT_RENDERED_SCAN_MAX_REQUESTS: 1
  });
  assert.equal(fs.existsSync(config.executable_path), true);
  assert.equal(config.timeout_ms, 30000);
  assert.equal(config.wait_ms, 0);
  assert.equal(config.max_requests, 20);
  assert.equal(config.allow_no_sandbox, false);
});

test("rendered DOM scanner startup diagnostic reports browser discovery without sensitive values", () => {
  const diagnostic = buildRenderedDomScannerDiagnostic({
    STOREFRONT_RENDERED_SCAN_ENABLED: true,
    STOREFRONT_RENDERED_SCAN_EXECUTABLE_PATH: executablePath
  });
  assert.deepEqual(diagnostic, {
    rendered_scan_enabled: true,
    configured_executable_path: executablePath,
    discovered_executable_path: executablePath,
    browser_found: true,
    browser_version: diagnostic.browser_version
  });
  assert.equal(typeof diagnostic.browser_version === "string" || diagnostic.browser_version === null, true);
});
