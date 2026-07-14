import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const gatewayRoute = fs.readFileSync(new URL("../src/routes/gateway.js", import.meta.url), "utf8");

test("Gateway admin exposes authenticated storefront connector patch preview", () => {
  assert.match(gatewayRoute, /\/gateway\/connections\/:tenantId\/profile\/:connectionCode\/storefront\/connector-patch/);
  assert.match(gatewayRoute, /tenant\.connection\.read/);
  assert.match(gatewayRoute, /CONNECTOR_PATCH_REQUIRES_WEBSITE_CONNECTION/);
  assert.match(gatewayRoute, /INBOUND_SUFFIX_REQUIRED/);
  assert.match(gatewayRoute, /buildAdminStorefrontConnectorPatch/);
});

test("Gateway admin connector patch preview returns public install contract without secrets", () => {
  assert.match(gatewayRoute, /eip_storefront_connector/);
  assert.match(gatewayRoute, /\/api\/public\/commerce-loader\/v1\.js/);
  assert.match(gatewayRoute, /eip:storefront:applied/);
  assert.match(gatewayRoute, /storefront\.mapping\.read/);
  assert.match(gatewayRoute, /storefront\.content\.read/);
  assert.doesNotMatch(gatewayRoute.match(/function buildAdminStorefrontConnectorPatch[\s\S]*?\n}\n/)?.[0] || "", /secret|password|api_key/i);
});
