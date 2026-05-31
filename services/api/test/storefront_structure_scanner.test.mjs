import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildMappingProfile,
  isLikelyClientRenderedShell,
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
const ecomRoute = fs.readFileSync(new URL("../src/routes/ecom.js", import.meta.url), "utf8");

test("unknown static storefront returns generic candidate mappings without EIP tags", () => {
  const candidates = scanGenericStorefrontHtml(UNKNOWN_STOREFRONT);
  assert.equal(candidates.some((item) => item.suggested_renderer === "hero_slider"), true);
  assert.equal(candidates.some((item) => item.suggested_renderer === "product_carousel"), true);
  assert.equal(candidates.some((item) => item.suggested_renderer === "newsletter_form"), true);
  assert.equal(candidates.every((item) => item.source === "generic_scan"), true);
  assert.equal(candidates.every((item) => item.candidate_id && item.dom_signature && item.selector), true);
});

test("generic scan collapses nested singleton slot proposals into a lean mapping review", () => {
  const candidates = scanGenericStorefrontHtml(`
    <section class="hero-banner">
      <div class="hero-slider-track"><article class="hero-slide">One</article></div>
    </section>
  `);
  assert.equal(candidates.filter((item) => item.suggested_slot === "home.hero").length, 1);
});

test("client-rendered shells are identified when static HTML has no usable DOM zones", () => {
  const html = '<div id="root"></div><script type="module" src="/assets/index.js"></script>';
  const candidates = scanGenericStorefrontHtml(html);
  assert.equal(isLikelyClientRenderedShell(html, candidates), true);
});

test("static storefronts with usable DOM zones are not misclassified as client-rendered shells", () => {
  const candidates = scanGenericStorefrontHtml(UNKNOWN_STOREFRONT);
  assert.equal(isLikelyClientRenderedShell(UNKNOWN_STOREFRONT, candidates), false);
});

test("low-confidence generic candidates are persisted for review instead of discarded", () => {
  assert.match(ecomRoute, /requires_manual_review: !Number\(scanned\?\.usable_candidate_count \|\| 0\)/);
  assert.match(ecomRoute, /fallback_recommendation: scanned\?\.fallback_recommendation \|\| null/);
  assert.doesNotMatch(ecomRoute, /error: "STRUCTURE_TAGS_NOT_FOUND"/);
});

test("client-rendered storefront shells run the isolated rendered DOM adapter before fallback", () => {
  assert.match(ecomRoute, /renderStorefrontDom\(\{ url: rootDoc\.url, profile, config: renderedScanConfig \}\)/);
  assert.match(ecomRoute, /rendered_dom_attempted: renderedDom !== null/);
  assert.match(ecomRoute, /rendered_dom_available: renderedDom\?\.ok === true/);
  assert.match(ecomRoute, /\["auto", "rendered"\]\.includes\(mode\)/);
  assert.match(ecomRoute, /source: "rendered_dom_scan"/);
  assert.match(ecomRoute, /"rendered", "generic", "tagged"/);
});

test("rendered-only scan failures remain diagnostic and do not save a static shell as complete", () => {
  assert.match(ecomRoute, /requestedScanMode === "rendered" && scanned\?\.rendered_dom_available !== true/);
  assert.match(ecomRoute, /error: scanned\?\.rendered_dom_error \|\| "RENDERED_DOM_SCANNER_UNAVAILABLE"/);
  assert.match(ecomRoute, /"configure_rendered_dom_scanner"/);
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
