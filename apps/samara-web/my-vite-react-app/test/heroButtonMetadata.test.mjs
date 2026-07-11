import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const heroSliderSource = fs.readFileSync(
  new URL("../src/component-library/HeroViewportSlider/HeroViewportSlider.jsx", import.meta.url),
  "utf8"
);
const heroSliderCss = fs.readFileSync(
  new URL("../src/component-library/HeroViewportSlider/HeroViewportSlider.css", import.meta.url),
  "utf8"
);

test("Samara hero uses enhanced storefront button metadata when available", () => {
  assert.match(appSource, /function resolveStorefrontSlideButtons/);
  assert.match(appSource, /const buttons = resolveStorefrontSlideButtons\(slide, index, heroTranslation, language\)/);
  assert.match(appSource, /ctaLabel: String\(primaryButton\?\.label/);
  assert.match(heroSliderSource, /function normalizeSlideButtons/);
  assert.match(heroSliderSource, /slide\?\.buttons/);
  assert.match(heroSliderSource, /hero-slide-actions/);
  assert.match(heroSliderSource, /hero-slide-cta--\$\{button\.style\}/);
  assert.match(heroSliderCss, /\.hero-slide-cta--primary/);
  assert.match(heroSliderCss, /\.hero-slide-cta--secondary/);
  assert.match(heroSliderCss, /\.hero-slide-cta--link/);
});
