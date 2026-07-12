import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  connectionAllowsStorefrontCapability,
  connectionAllowsStorefrontScope,
  normalizeProfile
} from "../src/services/gateway/connectionProfile.js";
import {
  buildStorefrontConnectorPatch,
  loadPublicStorefrontManifest,
  normalizePublicMapping,
  storefrontLoaderScript
} from "../src/routes/public_commerce.js";

const publicCommerceRoute = fs.readFileSync(
  new URL("../src/routes/public_commerce.js", import.meta.url),
  "utf8"
);

test("website connections receive governed storefront capabilities without enabling loader injection", () => {
  const profile = normalizeProfile({
    identity: {
      connection_name: "Tenant site",
      connection_code: "tenant-site",
      connection_kind: "website",
      direction: "inbound",
      frontend_url: "https://store.example"
    },
    inbound: {
      inbound_path_suffix: "tenant-site",
      origin_allowlist: ["https://store.example"]
    },
    routing: { channel: "website_intake" }
  });
  assert.equal(connectionAllowsStorefrontCapability(profile, "scan"), true);
  assert.equal(connectionAllowsStorefrontCapability(profile, "public_api"), true);
  assert.equal(connectionAllowsStorefrontCapability(profile, "loader"), false);
  assert.equal(connectionAllowsStorefrontScope(profile, "storefront.mapping.read"), true);
  assert.equal(connectionAllowsStorefrontScope(profile, "storefront.content.read"), true);
  assert.equal(connectionAllowsStorefrontScope(profile, "storefront.catalog.read"), true);
});

test("non-storefront outbound connections do not gain storefront scan or public API defaults", () => {
  const profile = normalizeProfile({
    identity: {
      connection_name: "Provider outbound",
      connection_code: "provider-outbound",
      connection_kind: "custom",
      direction: "outbound"
    },
    routing: { channel: "custom" }
  });
  assert.equal(connectionAllowsStorefrontCapability(profile, "scan"), false);
  assert.equal(connectionAllowsStorefrontCapability(profile, "public_api"), false);
  assert.equal(connectionAllowsStorefrontCapability(profile, "loader"), false);
});

test("public mapping projection excludes unapproved, unsafe, and unsupported mappings", () => {
  assert.deepEqual(
    normalizePublicMapping({
      suggested_slot: "home.hero",
      suggested_renderer: "hero_slider",
      selector: "section.hero",
      mapping_status: "approved",
      push_allowed: true
    }),
    {
      slot_code: "home.hero",
      renderer: "hero_slider",
      selector: "section.hero",
      source: "approved_mapping",
      content_endpoint: null
    }
  );
  assert.equal(normalizePublicMapping({
    suggested_slot: "home.secret",
    suggested_renderer: "rich_text_block",
    selector: "section[data-x='ok'];script",
    mapping_status: "approved"
  }), null);
  assert.equal(normalizePublicMapping({
    suggested_slot: "home.draft",
    suggested_renderer: "rich_text_block",
    selector: ".draft",
    mapping_status: "proposed"
  }), null);
  assert.equal(normalizePublicMapping({
    suggested_slot: "home.custom",
    suggested_renderer: "execute_script",
    selector: ".custom",
    mapping_status: "approved"
  }), null);
});

test("public manifest returns only approved safe connection-scoped mappings", async () => {
  const access = {
    tenant: { id: "tenant-a" },
    profile: {
      identity: {
        connection_code: "tenant-site",
        frontend_url: "https://store.example"
      }
    }
  };
  const app = {
    db: {
      query: async () => ({
        rows: [{
          attrs: {
            mapping_profiles: [{
              connection_code: "tenant-site",
              mapping_profile_code: "tenant-site_default",
              mapping_version: 4,
              approved_mappings: [
                {
                  suggested_slot: "home.hero",
                  suggested_renderer: "hero_slider",
                  selector: "section.hero",
                  mapping_status: "approved",
                  push_allowed: true
                },
                {
                  suggested_slot: "home.internal",
                  suggested_renderer: "rich_text_block",
                  selector: ".internal",
                  mapping_status: "needs_review"
                }
              ]
            }]
          }
        }]
      })
    }
  };
  const manifest = await loadPublicStorefrontManifest(app, access, "tenant-site");
  assert.equal(manifest.mapping_profile_code, "tenant-site_default");
  assert.equal(manifest.mapping_version, 4);
  assert.equal(typeof manifest.content_version, "string");
  assert.equal(typeof manifest.connector_version, "string");
  assert.match(manifest.refresh_endpoint, /storefront\/manifest\?integration=api/);
  assert.equal(manifest.slots.length, 1);
  assert.equal(manifest.slots[0].slot_code, "home.hero");
  assert.equal(manifest.slots[0].content_endpoint, "/api/public/commerce/tenant-site/content?slot=home.hero");
});

test("loader uses approved manifest reads and safe DOM construction only", () => {
  const loader = storefrontLoaderScript();
  assert.match(loader, /storefront\/manifest\?integration=loader/);
  assert.match(loader, /"X-API-Key"/);
  assert.match(loader, /textContent/);
  assert.match(loader, /replaceChildren/);
  assert.match(loader, /appendButtons/);
  assert.match(loader, /connector_version/);
  assert.match(loader, /setInterval/);
  assert.match(loader, /eip-storefront-refresh/);
  assert.match(loader, /eip:storefront:applied/);
  assert.match(loader, /EIPStorefrontConnector/);
  assert.doesNotMatch(loader, /innerHTML/);
  assert.doesNotMatch(loader, /\beval\s*\(/);
  assert.doesNotMatch(loader, /fetch\([^)]*\{[^}]*method:\s*["']POST/i);
});

test("loader highlights the exact Content Studio selector without blocking late DOM rendering", () => {
  const loader = storefrontLoaderScript();
  assert.match(loader, /eip_content_preview/);
  assert.match(loader, /eip_selector/);
  assert.match(loader, /data-eip-preview-highlight/);
  assert.match(loader, /MutationObserver/);
  assert.match(loader, /setTimeout\(\(\) => observer\.disconnect\(\), 8000\)/);
  assert.match(loader, /scrollIntoView/);
  assert.match(loader, /eip-content-preview-select/);
  assert.match(loader, /postMessage/);
});

test("connector patch tells a tenant site how to receive and pull EIP publishes", () => {
  const profile = normalizeProfile({
    identity: {
      connection_name: "Tenant site",
      connection_code: "tenant-site",
      connection_kind: "website",
      direction: "inbound",
      frontend_url: "https://store.example"
    },
    inbound: {
      inbound_path_suffix: "tenant-site",
      origin_allowlist: ["https://store.example"]
    },
    public_storefront: {
      loader_enabled: true,
      public_api_enabled: true
    },
    routing: { channel: "website_intake" }
  });
  const patch = buildStorefrontConnectorPatch(
    {
      protocol: "https",
      headers: {
        host: "api.example",
        "x-forwarded-proto": "https"
      }
    },
    { profile },
    "tenant-site"
  );
  assert.equal(patch.connector, "eip_storefront_connector");
  assert.equal(patch.loader_enabled, true);
  assert.equal(patch.refresh.mode, "manifest_version_poll");
  assert.equal(patch.receiver_contract.applied_event, "eip:storefront:applied");
  assert.match(patch.loader_url, /\/api\/public\/commerce-loader\/v1\.js$/);
  assert.match(patch.script_tag, /data-connection="tenant-site"/);
  assert.match(patch.refresh.manifest_endpoint, /\/api\/public\/commerce\/tenant-site\/storefront\/manifest\?integration=loader/);
});

test("public commerce exposes approved mapping, content, catalog, and loader contracts", () => {
  assert.match(publicCommerceRoute, /"\/commerce-loader\/v1\.js"/);
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/storefront\/connector-patch"/);
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/storefront\/manifest"/);
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/storefront\/mapping"/);
  assert.match(publicCommerceRoute, /function buildStorefrontConnectorPatch/);
  assert.match(publicCommerceRoute, /scope: "storefront\.mapping\.read"/);
  assert.match(publicCommerceRoute, /scope: "storefront\.content\.read"/);
  assert.match(publicCommerceRoute, /scope: "storefront\.catalog\.read"/);
});
