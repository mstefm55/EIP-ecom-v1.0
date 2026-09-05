import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../db/migrations/0145_perfect_fit_governed_garment_taxonomy.sql', import.meta.url),
  'utf8'
);

const taxonomySource = readFileSync(
  new URL('../../../apps/samara-web/my-vite-react-app/src/data/catalogTaxonomy.js', import.meta.url),
  'utf8'
);

const categoryNavigatorSource = readFileSync(
  new URL('../../../apps/samara-web/my-vite-react-app/src/components/CatalogCategoryNavigator.jsx', import.meta.url),
  'utf8'
);

test('0145 extends the existing governed PF garment category list without a new business table', () => {
  assert.match(migration, /PF_GARMENT_CATEGORY/);
  assert.match(migration, /eip_core\.dropdown_value/);
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i);
  assert.match(migration, /0144 has already been executed/i);
});

test('0145 keeps catalogue-only facets out of product category governance', () => {
  const seedSection = migration.match(/category_seed\([\s\S]*?\), pf_lists AS/i)?.[0] || '';

  assert.ok(seedSection, 'category seed section should exist');
  assert.doesNotMatch(seedSection, /pattern-of-the-day/i);
  assert.doesNotMatch(seedSection, /free-patterns/i);
  assert.doesNotMatch(seedSection, /curve-plus/i);
  assert.doesNotMatch(seedSection, /best-sellers/i);
});

test('0145 preserves existing stable category codes and adds the Pattern Library style categories', () => {
  for (const code of [
    'DRESS',
    'TOP',
    'TROUSER',
    'SKIRT',
    'COAT',
    'CORSETS',
    'JUMPSUITS',
    'JACKETS_VESTS',
    'EVENING_PARTY',
    'ACCESSORIES',
    'LINGERIE',
    'SWIMWEAR_ACTIVEWEAR',
    'HOMEWEAR_SLEEPWEAR',
    'INFANTS_TODDLERS',
    'CHILDREN',
    'GIRLS',
    'BOYS'
  ]) {
    assert.match(migration, new RegExp(`'${code}'`));
  }

  assert.match(migration, /'catalog_category_id'/);
  assert.match(migration, /'catalog_audience'/);
  assert.match(migration, /'taxonomy_role', 'STYLE_CATEGORY'/);
});

test('catalogue category presentation consumes runtime GARMENT_CATEGORY governance', () => {
  assert.match(
    taxonomySource,
    /perfectFitMetadata\.workspace\?\.dropdowns\?\.GARMENT_CATEGORY/
  );
  assert.match(taxonomySource, /attrs\.catalog_category_id/);
  assert.match(taxonomySource, /attrs\.catalog_audience === audienceId/);
  assert.match(taxonomySource, /source: 'EIP_DB'/);

  for (const facet of [
    'pattern-of-the-day',
    'free-patterns',
    'curve-plus',
    'best-sellers'
  ]) {
    assert.match(taxonomySource, new RegExp(`'${facet}'`));
  }
});

test('secondary category navigator uses the same dynamic category resolver', () => {
  assert.match(categoryNavigatorSource, /getCategoriesForAudience/);
  assert.match(categoryNavigatorSource, /const activeCategories = getCategoriesForAudience\(selectedAudience\)/);
  assert.match(categoryNavigatorSource, /activeCategories\.map/);
});
