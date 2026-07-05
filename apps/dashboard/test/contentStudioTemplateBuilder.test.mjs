import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  addButton,
  addChild,
  createSectionFromTemplate,
  deleteButton,
  deleteChild,
  previewKind,
  reorderChild,
  moveChildTo,
  serializeEnhancedSection
} from "../src/components/ecom/contentStudioEnhancedModel.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(here, "..");
const source = fs.readFileSync(
  path.join(dashboardRoot, "src", "components", "ecom", "ContentStudioEnhanced.jsx"),
  "utf8"
);
const surface = fs.readFileSync(
  path.join(dashboardRoot, "src", "engine", "surfaces", "dashboard.js"),
  "utf8"
);

test("legacy and enhanced Content Studio surfaces remain parallel", () => {
  assert.match(surface, /mode:\s*"content-studio"/);
  assert.match(surface, /type:\s*"ContentStudioEnhanced"/);
  assert.match(surface, /content-enhanced-workspace/);
});

test("exact builder exposes top bar, three panels, scanner, templates, preview, and inspector tabs", () => {
  for (const label of [
    "Content Studio Enhanced",
    "PAGE STRUCTURE",
    "ELEMENT SCANNER & MAPPING",
    "LIVE PREVIEW",
    "SECTION INSPECTOR",
    "SECTION TEMPLATE LIBRARY",
    "Data Binding",
    "Media",
    "Display",
    "Advanced"
  ]) assert.match(source, new RegExp(label));
  assert.match(source, /cse-left/);
  assert.match(source, /cse-center/);
  assert.match(source, /cse-right/);
});

test("section template parent owns repeatable child order", () => {
  let section = createSectionFromTemplate("hero_slider", 0);
  section = addChild(section);
  section = addChild(section);
  assert.equal(section.children.length, 3);
  const lastId = section.children[2].sectionId;
  section = reorderChild(section, lastId, "up");
  assert.equal(section.children[1].sectionId, lastId);
  assert.deepEqual(section.children.map((child) => child.order), [10, 20, 30]);
  section = deleteChild(section, lastId);
  assert.equal(section.children.length, 2);
  const firstId = section.children[0].sectionId;
  const secondId = section.children[1].sectionId;
  section = moveChildTo(section, secondId, firstId);
  assert.equal(section.children[0].sectionId, secondId);
  assert.match(source, /draggable/);
  assert.match(source, /beginPreviewInteraction\("move"/);
  assert.match(source, /beginPreviewInteraction\("resize"/);
});

test("a slide supports five repeatable buttons and deletion", () => {
  let child = createSectionFromTemplate("hero_slider", 0).children[0];
  while (child.content.buttons.length < 5) child = addButton(child);
  assert.equal(child.content.buttons.length, 5);
  const removedId = child.content.buttons[2].id;
  child = deleteButton(child, removedId);
  assert.equal(child.content.buttons.length, 4);
  assert.equal(child.content.buttons.some((button) => button.id === removedId), false);
});

test("Product Studio binding serializes references without product snapshots", () => {
  const section = createSectionFromTemplate("product_grid", 0);
  section.children[0].dataBinding = {
    source: "product_studio",
    entity: "products_collection",
    reference: "featured-patterns",
    filter: "featured=true",
    sort: "sort_order asc",
    limit: 8,
    fieldMappings: { Title: "title", Image: "images[0].url" },
    products: [{ id: "must-not-copy" }],
    snapshot: { forbidden: true }
  };
  const payload = serializeEnhancedSection(section);
  const serialized = JSON.stringify(payload);
  assert.equal(payload.attrs.source_mode, "collection_or_drop");
  assert.equal(payload.attrs.product_source.collection_code, "featured-patterns");
  assert.match(serialized, /featured-patterns/);
  assert.doesNotMatch(serialized, /must-not-copy/);
  assert.doesNotMatch(serialized, /forbidden/);
});

test("unknown section types render a safe placeholder", () => {
  assert.equal(previewKind("unsupported_future_section"), "unknown");
  assert.match(source, /Safe preview unavailable/);
});

test("image editor is explicit before upload and loading clears in finally", () => {
  assert.match(source, /ImageAssetStudioModal/);
  assert.match(source, /applyLabel="Apply & Upload"/);
  assert.match(source, /onApply=\{uploadEditedImage\}/);
  assert.match(source, /uploadEditedImage[\s\S]*?finally\s*\{[\s\S]*?setUploading\(false\)/);
  assert.match(source, /URL\.createObjectURL\(file\)/);
});
