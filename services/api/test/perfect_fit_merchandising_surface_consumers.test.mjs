import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const taxonomy = read('apps/samara-web/my-vite-react-app/src/data/catalogTaxonomy.js');
const sidebar = read('apps/samara-web/my-vite-react-app/src/components/CatalogSidebarNavigator.jsx');
const app = read('apps/samara-web/my-vite-react-app/src/App.jsx');
const ownership = read('docs/PERFECT_FIT_ADMIN_CURATION_OWNERSHIP.md');

test('catalogue merchandising facets consume governed catalog_filter_id metadata', () => {
  assert.match(taxonomy, /dropdowns\?\.VARIANT_CURATION/);
  assert.match(taxonomy, /dropdowns\?\.VARIANT_TAG/);
  assert.match(taxonomy, /attrs\?\.catalog_filter_id/);
  assert.match(taxonomy, /export function getCatalogFilterIdsForPattern/);
  assert.match(taxonomy, /export function matchesPatternCatalogFilters/);
  assert.match(taxonomy, /governedFacetIds\.has\(filterId\)/);
  assert.match(taxonomy, /pattern\.taxonomy\?\.tags/);
});

test('catalogue sidebar counts governed merchandising facets without turning them into garment categories', () => {
  assert.match(sidebar, /getCatalogFilterIdsForPattern/);
  assert.match(sidebar, /categoryTokens = new Set/);
  assert.match(sidebar, /\.\.\.getCatalogFilterIdsForPattern\(pattern\)/);
  assert.match(sidebar, /counts\.categories\[token\]/);
  assert.match(taxonomy, /CATALOG_FILTER_ONLY_CATEGORY_IDS/);
});

test('catalogue product filtering resolves special facets through tag behavior metadata', () => {
  assert.match(app, /matchesPatternCatalogFilters/);
  assert.match(app, /matchesPatternCatalogFilters\(p, selectedCatalogCategories\)/);
  assert.doesNotMatch(
    app,
    /selectedCatalogCategories\.includes\(patternCategory\)/
  );
});

test('all current Signature and Orbit homepage consumers use governed surface_targets', () => {
  assert.match(
    app,
    /selectPatternsForSurface\(productPresentationPatterns, 'signature-orbit-carousel', 8\)/
  );
  assert.match(
    app,
    /selectPatternsForSurface\(productPresentationPatterns, 'signature-orbit-carousel', 10\)/
  );
  assert.match(
    app,
    /selectPatternsForSurface\(productPresentationPatterns, 'orbit-carousel', 4\)/
  );
  assert.match(taxonomy, /option\?\.attrs\?\.surface_targets/);
  assert.match(taxonomy, /const source = eligible\.length \? eligible : safe/);
  assert.doesNotMatch(app, /patterns=\{productPresentationPatterns\.slice\(0, 10\)\}/);
});

test('consumer completion preserves PF Admin and Product Studio assignment authority', () => {
  assert.match(ownership, /Perfect Fit Admin can assign/);
  assert.match(ownership, /EIP Product Studio remains/);
  assert.match(ownership, /material\.attrs\.taxonomy\.tags/);
  assert.match(ownership, /No new tag storage is introduced/);
});
