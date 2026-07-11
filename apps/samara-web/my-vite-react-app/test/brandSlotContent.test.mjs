import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const appCss = fs.readFileSync(new URL("../src/App.css", import.meta.url), "utf8");

test("Samara consumes the published brand slot instead of hardcoded brand text", () => {
  assert.match(appSource, /const BRAND_CONTENT_SLOTS = \["brand", "site\.brand", "home\.brand", "header\.brand", "global\.brand"\]/);
  assert.match(appSource, /function resolveBrandContent/);
  assert.match(appSource, /BRAND_CONTENT_SLOTS\.forEach\(\(slot\) => \{\s*fetchSlotContent\(slot\);/s);
  assert.match(appSource, /siteBrandTitle=\{siteBrand\.title\}/);
  assert.match(appSource, /brandContent=\{siteBrand\}/);
  assert.match(appSource, /<StorefrontBrandSection brandContent=\{brandContent\} onCta=\{onHeroCta\} \/>/);
  assert.match(appSource, /<p>\{siteBrand\.title\}<\/p>/);
  assert.doesNotMatch(appSource, /<button className="brand" type="button" onClick=\{\(\) => onNavigate\("home"\)\}>\s*Samara\s*<\/button>/);
  assert.match(appCss, /\.storefront-brand-section/);
  assert.match(appCss, /\.storefront-brand-actions/);
});
