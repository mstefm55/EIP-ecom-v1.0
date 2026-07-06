import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  addButton,
  addChild,
  buildScannerTree,
  createSectionFromTemplate,
  deleteButton,
  deleteChild,
  duplicateChild,
  normalizeScannerZones,
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
const studioCss = fs.readFileSync(
  path.join(dashboardRoot, "src", "components", "ecom", "ContentStudioEnhanced.css"),
  "utf8"
);
const imageStudioCss = fs.readFileSync(
  path.join(dashboardRoot, "src", "components", "shared", "ImageAssetStudioModal.css"),
  "utf8"
);
const globalCss = fs.readFileSync(path.join(dashboardRoot, "src", "index.css"), "utf8");
const surface = fs.readFileSync(
  path.join(dashboardRoot, "src", "engine", "surfaces", "dashboard.js"),
  "utf8"
);

test("legacy and enhanced Content Studio surfaces remain parallel", () => {
  assert.match(surface, /mode:\s*"content-studio"/);
  assert.match(surface, /type:\s*"ContentStudioEnhanced"/);
  assert.match(surface, /content-enhanced-workspace/);
});

test("enhanced studio and photo toolkit share the EIP V1 artwork palette", () => {
  for (const token of [
    "--eip-v1-navy-950",
    "--eip-v1-primary-600",
    "--eip-v1-teal",
    "--eip-v1-gold",
    "--eip-v1-canvas",
    "--eip-v1-editorial-ivory"
  ]) assert.match(globalCss, new RegExp(token));
  assert.match(studioCss, /EIP V1 artwork harmonisation/);
  assert.match(studioCss, /var\(--eip-v1-primary-600\)/);
  assert.match(imageStudioCss, /EIP V1 artwork palette/);
  assert.match(imageStudioCss, /var\(--eip-v1-teal\)/);
});

test("exact builder exposes top bar, three panels, scanner, templates, preview, and inspector tabs", () => {
  for (const label of [
    "Content Studio Enhanced",
    "PAGE STRUCTURE",
    "RENDERED DOM SCANNER",
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
  assert.match(source, /scan_mode: "rendered"/);
  assert.match(source, /MAP RENDERED COMPONENT/);
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
  section = duplicateChild(section, section.children[0].sectionId);
  assert.equal(section.children.length, 3);
});

test("rendered scanner candidates normalize into a real parent child tree", () => {
  const zones = normalizeScannerZones({
    mapping_profile: {
      candidate_zones: [
        { candidate_id: "root", label: "Product page", suggested_slot: "products.page", suggested_renderer: "product_detail", selector: "main", dom_order: 1, node_kind: "section", source: "rendered_dom_scan" },
        { candidate_id: "gallery", parent_candidate_id: "root", label: "Gallery", suggested_slot: "products.gallery", suggested_renderer: "media_gallery", selector: ".gallery", dom_depth: 1, dom_order: 2, node_kind: "gallery", image_count: 4, source: "rendered_dom_scan" },
        { candidate_id: "image", parent_candidate_id: "gallery", label: "Image", suggested_slot: "products.image", suggested_renderer: "media_gallery", selector: ".gallery img", dom_depth: 2, dom_order: 3, node_kind: "image", source: "rendered_dom_scan" }
      ]
    }
  });
  const tree = buildScannerTree(zones);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].children[0].id, "gallery");
  assert.equal(tree[0].children[0].children[0].id, "image");
  assert.equal(tree[0].children[0].counts.images, 4);
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
  assert.match(source, /width: Number\(result\?\.width/);
  assert.match(source, /height: Number\(result\?\.height/);
  assert.match(source, /uploadEditedImage[\s\S]*?finally\s*\{[\s\S]*?setUploading\(false\)/);
  assert.match(source, /URL\.createObjectURL\(file\)/);
});
