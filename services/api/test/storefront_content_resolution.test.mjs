import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { resolveProductDrivenRows } from "../src/lib/storefrontContentResolution.js";

const rows = [
  { code: "P-001", name: "One", attrs: { taxonomy: { tags: ["worth", "featured"] }, content: { title: "One" } } },
  { code: "P-002", name: "Two", attrs: { taxonomy: { tags: ["worth"] }, content: { title: "Two" } } },
  { code: "P-003", name: "Three", attrs: { taxonomy: { tags: ["drop"] }, content: { title: "Three" } } }
];

test("product tag slots resolve product rows from Product Studio without embedding card copies", () => {
  const resolved = resolveProductDrivenRows(rows, {
    source_mode: "product_tag",
    product_source: { mode: "product_tag", tag: "worth", limit: 12 }
  });
  assert.deepEqual(resolved.products.map((row) => row.code), ["P-001", "P-002"]);
  assert.equal(resolved.source_mode, "product_tag");
});

test("hybrid slots preserve explicit ordering and apply exclusions", () => {
  const resolved = resolveProductDrivenRows(rows, {
    source_mode: "hybrid_tag_overrides",
    product_source: {
      mode: "hybrid_tag_overrides",
      tag: "worth",
      include_product_codes: ["P-003"],
      exclude_product_codes: ["P-002"]
    }
  });
  assert.deepEqual(resolved.products.map((row) => row.code), ["P-003", "P-001"]);
});

test("manual product slots retain only references to Product Studio codes", () => {
  const resolved = resolveProductDrivenRows(rows, {
    source_mode: "manual_products",
    product_source: {
      mode: "manual_products",
      product_codes: ["P-002", "P-001"]
    }
  });
  assert.deepEqual(resolved.products, [rows[1], rows[0]]);
});

test("public commerce content route serializes render-ready slot payloads", () => {
  const source = fs.readFileSync(new URL("../src/routes/public_commerce.js", import.meta.url), "utf8");
  assert.match(source, /renderer,\s*\r?\n\s*renderer_type: renderer,/);
  assert.match(source, /content:\s*\{\s*\r?\n\s*slides\s*\}/);
  assert.match(source, /products: productSlot\.products/);
});
