import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMappingProfile,
  mappingProfileZones,
  mergeScanCandidates,
  scanGenericStorefrontHtml,
  updateMappingCandidate
} from "../src/lib/storefrontStructureScanner.js";

const UNKNOWN_STOREFRONT = `
  <html>
    <body>
      <header class="site-header"><nav class="main-nav"><a href="/">Home</a></nav></header>
      <main>
        <section class="hero-banner">
          <img src="/cover.jpg" alt="">
          <h1>Make a pattern worth keeping</h1>
          <button>Shop patterns</button>
        </section>
        <section class="worth product-carousel">
          <article class="product-card"><img src="/1.jpg"><a href="/p/1">One</a></article>
          <article class="product-card"><img src="/2.jpg"><a href="/p/2">Two</a></article>
          <article class="product-card"><img src="/3.jpg"><a href="/p/3">Three</a></article>
        </section>
        <section class="newsletter"><form><input type="email"><button>Subscribe</button></form></section>
      </main>
      <footer>Footer</footer>
    </body>
  </html>
`;

test("unknown static storefront returns generic candidate mappings without EIP tags", () => {
  const candidates = scanGenericStorefrontHtml(UNKNOWN_STOREFRONT);
  assert.equal(candidates.some((item) => item.suggested_renderer === "hero_slider"), true);
  assert.equal(candidates.some((item) => item.suggested_renderer === "product_carousel"), true);
  assert.equal(candidates.some((item) => item.suggested_renderer === "newsletter_form"), true);
  assert.equal(candidates.every((item) => item.source === "generic_scan"), true);
  assert.equal(candidates.every((item) => item.candidate_id && item.dom_signature && item.selector), true);
});

test("tagged mappings remain high-confidence approved candidates in auto merge", () => {
  const generic = scanGenericStorefrontHtml(UNKNOWN_STOREFRONT);
  const merged = mergeScanCandidates(generic, [
    { tag: "home.hero", page: "home", renderer_type: "hero" },
    { tag: "home.worth", page: "home", renderer_type: "cards" }
  ]);
  const taggedHero = merged.find((item) => item.suggested_slot === "home.hero");
  const taggedWorth = merged.find((item) => item.suggested_slot === "home.worth");
  assert.equal(taggedHero.source, "tagged_scan");
  assert.equal(taggedHero.mapping_status, "approved");
  assert.equal(taggedHero.suggested_renderer, "hero_slider");
  assert.equal(taggedWorth.suggested_renderer, "product_carousel");
});

test("mapping approval persists in governed profile while sensitive forms cannot be approved", () => {
  const candidates = scanGenericStorefrontHtml(`
    <section class="editorial-grid"><article>One</article><article>Two</article></section>
    <form class="account-login"><input type="password"><button>Log in</button></form>
  `);
  const profile = buildMappingProfile({
    tenantId: "tenant-a",
    connectionCode: "storefront-a",
    frontendUrl: "https://store.example",
    scan: {
      scan_mode: "generic",
      scan_source: "generic_scan",
      usable_candidate_count: candidates.length,
      candidate_zones: candidates
    }
  });
  const contentCandidate = profile.candidate_zones.find((item) => item.push_allowed !== false);
  const approved = updateMappingCandidate(profile, {
    candidate_id: contentCandidate.candidate_id,
    mapping_status: "approved",
    suggested_slot: "home.editorial",
    suggested_renderer: "editorial_card_grid"
  });
  assert.equal(approved.approved_mappings.some((item) => item.suggested_slot === "home.editorial"), true);
  assert.equal(mappingProfileZones(approved).some((item) => item.tag === "home.editorial"), true);

  const sensitive = profile.candidate_zones.find((item) => item.push_allowed === false);
  assert.ok(sensitive);
  assert.throws(
    () => updateMappingCandidate(profile, { candidate_id: sensitive.candidate_id, mapping_status: "approved" }),
    /SENSITIVE_ZONE_APPROVAL_FORBIDDEN/
  );
});

test("generic text samples redact secret-like words and remain short", () => {
  const [candidate] = scanGenericStorefrontHtml("<section>Password token secret credential should never leak in a scan sample.</section>");
  assert.equal(candidate.text_sample.length <= 160, true);
  assert.equal(/password|token|secret|credential/i.test(candidate.text_sample), false);
});
