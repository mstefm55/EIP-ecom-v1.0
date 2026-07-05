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
