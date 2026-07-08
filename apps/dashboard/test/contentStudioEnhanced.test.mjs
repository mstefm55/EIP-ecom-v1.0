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
