import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/components/admin/AdminConnectionsPanelSafe.jsx", import.meta.url),
  "utf8"
);

test("Gateway Connection Profiles exposes external website connector patch install UI", () => {
  assert.match(source, /External website connector patch/);
  assert.match(source, /buildStorefrontConnectorScript/);
  assert.match(source, /\/api\/public\/commerce-loader\/v1\.js/);
  assert.match(source, /\/api\/public\/commerce\/.*\/storefront\/connector-patch/);
  assert.match(source, /Copy install script/);
  assert.match(source, /Load live patch JSON/);
  assert.match(source, /eip:storefront:applied/);
});

test("Connector install UI keeps the patch tied to website storefront governance", () => {
  assert.match(source, /isWebsiteStorefrontConnection/);
  assert.match(source, /loader_enabled/);
  assert.match(source, /public_api_enabled/);
  assert.match(source, /storefront\.mapping\.read/);
  assert.match(source, /storefront\.content\.read/);
  assert.match(source, /inbound_path_suffix/);
});
