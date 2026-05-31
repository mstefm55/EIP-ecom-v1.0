import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildMappingProfile,
  scanGenericStorefrontHtml
} from "../src/lib/storefrontStructureScanner.js";

function read(relativeUrl) {
  return fs.readFileSync(new URL(relativeUrl, import.meta.url), "utf8");
}

const ecomRoute = read("../src/routes/ecom.js");
const scanner = read("../src/lib/storefrontStructureScanner.js");
const renderedScanner = read("../src/services/storefront/renderedDomScanner.js");
const connectionProfile = read("../src/services/gateway/connectionProfile.js");
const surfaceSeed = read("../db/seed/ui_surface_dashboard.sql");
const surfaceFallback = read("../../../apps/dashboard/src/engine/surfaces/dashboard.js");
const descriptorMigration = read("../db/migrations/0098_storefront_mapping_ui_descriptor.sql");
const cloneTemplate = read("../db/seed/clone_template_to_tenant.sql");
const canonicalSeed = read("../db/seed/template_ecom_canonical_v1.sql");
const adminConnections = read("../../../apps/dashboard/src/components/admin/AdminConnectionsPanelSafe.jsx");
const ecomWorkspace = read("../../../apps/dashboard/src/components/ecom/EcomProductWorkspace.jsx");

const GENERIC_STOREFRONT = `
  <html>
    <body>
      <header class="site-header"><nav><a href="/">Home</a></nav></header>
      <main>
        <section class="hero-banner">
          <h1>Seasonal work</h1>
          <img src="/cover.jpg" alt="">
          <button>Explore</button>
        </section>
        <section class="product-carousel">
          <article class="product-card"><img src="/1.jpg"><a href="/p/1">One</a></article>
          <article class="product-card"><img src="/2.jpg"><a href="/p/2">Two</a></article>
          <article class="product-card"><img src="/3.jpg"><a href="/p/3">Three</a></article>
        </section>
      </main>
    </body>
  </html>
`;

test("storefront scanner core is a generic ECOM capability without storefront-specific identifiers", () => {
  for (const source of [ecomRoute, scanner, renderedScanner, connectionProfile]) {
    assert.doesNotMatch(source, /samara|samarapattern|samara-web-storefront-2/i);
  }
});

test("dashboard registers the reusable mapping widget through governed ECOM surface metadata", () => {
  for (const source of [surfaceSeed, surfaceFallback, descriptorMigration]) {
    assert.match(source, /EcomProductWorkspace/);
    assert.match(source, /content-studio/);
    assert.match(source, /storefrontMapping/);
    assert.match(source, /scanModes/);
    assert.match(source, /rendererOptions/);
    assert.match(source, /slotPresets/);
    assert.match(source, /requiredFieldsByRenderer/);
  }
  assert.match(cloneTemplate, /INSERT INTO eip_core\.ui_surface/);
  assert.match(cloneTemplate, /FROM eip_core\.ui_surface/);
});

test("a second tenant connection builds an independent mapping profile without storefront forks", () => {
  const candidates = scanGenericStorefrontHtml(GENERIC_STOREFRONT);
  const profileA = buildMappingProfile({
    tenantId: "tenant-a",
    connectionCode: "site-a",
    frontendUrl: "https://a.example",
    scan: {
      scan_mode: "generic",
      scan_source: "generic_scan",
      usable_candidate_count: candidates.length,
      candidate_zones: candidates
    }
  });
  const profileB = buildMappingProfile({
    tenantId: "tenant-b",
    connectionCode: "site-b",
    frontendUrl: "https://b.example",
    scan: {
      scan_mode: "generic",
      scan_source: "generic_scan",
      usable_candidate_count: candidates.length,
      candidate_zones: candidates
    }
  });

  assert.equal(profileA.tenant_id, "tenant-a");
  assert.equal(profileA.connection_code, "site-a");
  assert.equal(profileA.mapping_profile_code, "site-a_default");
  assert.equal(profileB.tenant_id, "tenant-b");
  assert.equal(profileB.connection_code, "site-b");
  assert.equal(profileB.mapping_profile_code, "site-b_default");
  assert.notEqual(profileA.mapping_profile_code, profileB.mapping_profile_code);
  assert.equal(profileB.candidate_zones.some((item) => item.suggested_slot === "home.hero"), true);
  assert.equal(profileB.candidate_zones.some((item) => item.suggested_renderer === "product_carousel"), true);
  assert.doesNotMatch(JSON.stringify(profileB), /samara/i);
});

test("storefront content publication remains bound to the governed ECOM process", () => {
  assert.match(canonicalSeed, /ECOM_STOREFRONT_CONTENT_FLOW/);
  assert.match(canonicalSeed, /CONTENT_REVIEW/);
  assert.match(canonicalSeed, /storefront_content/);
  for (const action of ["DRAFT_READY", "APPROVE", "PUBLISH"]) {
    assert.match(canonicalSeed, new RegExp(`"action": "${action}"`));
  }
});

test("generic connection setup placeholders do not imply a storefront-specific integration", () => {
  assert.match(adminConnections, /https:\/\/storefront\.example\.com/);
  assert.match(adminConnections, /tenant-storefront/);
  assert.doesNotMatch(adminConnections, /samara|samarapattern|samara-web-storefront-2/i);
});

test("mapping descriptor drives renderer options and required-field validation in the editor primitive", () => {
  assert.match(ecomWorkspace, /storefrontMappingUi\.rendererOptions/);
  assert.match(ecomWorkspace, /storefrontMappingUi\.requiredFieldsByRenderer/);
  assert.match(ecomWorkspace, /requiredFields\.includes\("slides"\)/);
  assert.match(ecomWorkspace, /requiredFields\.includes\("source_mode"\)/);
});
