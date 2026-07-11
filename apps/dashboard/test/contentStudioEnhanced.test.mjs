import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(here, "..");
const surfaceSource = fs.readFileSync(
  path.join(dashboardRoot, "src", "engine", "surfaces", "dashboard.js"),
  "utf8"
);
const workspaceSource = fs.readFileSync(
  path.join(dashboardRoot, "src", "components", "ecom", "EcomProductWorkspace.jsx"),
  "utf8"
);
const enhancedSource = fs.readFileSync(
  path.join(dashboardRoot, "src", "components", "ecom", "ContentStudioEnhanced.jsx"),
  "utf8"
);
const enhancedCssSource = fs.readFileSync(
  path.join(dashboardRoot, "src", "components", "ecom", "ContentStudioEnhanced.css"),
  "utf8"
);
const sidebarSource = fs.readFileSync(
  path.join(dashboardRoot, "src", "components", "engine", "SidebarNav.jsx"),
  "utf8"
);

test("enhanced Content Studio is opt-in and the original surface remains available", () => {
  assert.match(surfaceSource, /mode:\s*"content-studio"/);
  assert.match(surfaceSource, /mode:\s*"content-studio-enhanced"/);
  assert.match(surfaceSource, /label:\s*"Content Studio Enhanced"/);
  assert.match(workspaceSource, /Beta preview/);
});

test("enhanced Content Studio reuses scanner mapping and Product Studio binding metadata", () => {
  assert.match(workspaceSource, /scanStorefrontStructure/);
  assert.match(workspaceSource, /approvedStorefrontRendererForZone/);
  assert.match(workspaceSource, /product_carousel/);
  assert.match(workspaceSource, /product_grid/);
  assert.match(workspaceSource, /source_mode/);
  assert.match(workspaceSource, /product_source/);
  assert.match(workspaceSource, /Component preview/);
  assert.match(workspaceSource, /Component inspector/);
});

test("Content Studio upload handlers always clear loading state", () => {
  assert.match(
    workspaceSource,
    /handlePageContentImageUpload[\s\S]*?finally\s*\{[\s\S]*?setPageContentUploading\(false\)/
  );
  assert.match(
    workspaceSource,
    /handleStorefrontSlideUpload[\s\S]*?finally\s*\{[\s\S]*?setStorefrontUploadingIndex\(null\)/
  );
  assert.match(workspaceSource, /contentStudioOnly,\s*\n\s*openImageStudio:/);
});

test("enhanced Content Studio does not report a false publish when translation confirmation is required", () => {
  assert.match(enhancedSource, /translation_unavailable_confirmation_required/);
  assert.match(enhancedSource, /publish_english_only:\s*true/);
  assert.match(enhancedSource, /if \(!publishCompleted\)/);
  assert.match(enhancedSource, /The server did not confirm publication/);
});

test("enhanced Content Studio uses harmonised app chrome and modal confirmations", () => {
  assert.doesNotMatch(enhancedSource, /window\.confirm/);
  assert.match(enhancedSource, /confirmEnglishOnlyPublish/);
  assert.match(enhancedSource, /cse-confirm-modal/);
  assert.match(enhancedSource, /role="toolbar" aria-label="Content Studio command bar"/);
  assert.doesNotMatch(enhancedSource, /<header className="cse-topbar"/);
  assert.match(enhancedCssSource, /one app header, one local studio command strip/);
  assert.match(enhancedCssSource, /position:relative;top:auto;left:auto;right:auto/);
});

test("dashboard sidebar uses the EIP mark and keeps long labels aligned", () => {
  assert.match(sidebarSource, /import EipMark/);
  assert.match(sidebarSource, /<EipMark className="h-5 w-5"/);
  assert.match(sidebarSource, /truncate text-left/);
  assert.match(sidebarSource, /item\.badge/);
});

test("enhanced hero serialization preserves every configured slide", async () => {
  const { createSectionFromTemplate, addChild, serializeEnhancedSection } = await import(
    "../src/components/ecom/contentStudioEnhancedModel.js"
  );
  const first = createSectionFromTemplate("hero_slider", 0);
  const section = addChild(first);
  section.slot = "home.hero";
  section.children[0].content.title = "First slide";
  section.children[0].media.image = "/assets/hero-one.jpg";
  section.children[1].content.title = "Second slide";
  section.children[1].media.image = "/assets/hero-two.jpg";

  const payload = serializeEnhancedSection(section);

  assert.equal(payload.slides.length, 2);
  assert.deepEqual(payload.slides.map((slide) => slide.title), ["First slide", "Second slide"]);
  assert.deepEqual(payload.slides.map((slide) => slide.image), [
    "/assets/hero-one.jpg",
    "/assets/hero-two.jpg"
  ]);
});

test("enhanced hero serialization preserves button metadata for the storefront", async () => {
  const { createSectionFromTemplate, serializeEnhancedSection } = await import(
    "../src/components/ecom/contentStudioEnhancedModel.js"
  );
  const section = createSectionFromTemplate("hero_slider", 0);
  section.slot = "home.hero";
  section.children[0].content.buttons = [
    { id: "brand-button", label: "Explore Brand", url: "/brand", style: "primary", icon: "sparkles", newTab: false },
    { id: "lookbook-button", label: "Open Lookbook", url: "https://example.com/lookbook", style: "secondary", newTab: true }
  ];

  const payload = serializeEnhancedSection(section);
  const [slide] = payload.slides;

  assert.equal(slide.cta_label, "Explore Brand");
  assert.equal(slide.cta_target, "/brand");
  assert.equal(slide.buttons.length, 2);
  assert.deepEqual(slide.buttons.map((button) => button.style), ["primary", "secondary"]);
  assert.equal(slide.buttons[1].newTab, true);
});
