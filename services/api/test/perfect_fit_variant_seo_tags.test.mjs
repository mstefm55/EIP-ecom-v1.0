import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { syncPerfectFitVariantPresentation } from '../src/services/perfectFit/productGateway.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const migration = read('services/api/db/migrations/0146_perfect_fit_variant_seo_tags.sql');
const projection = read('services/api/src/services/perfectFit/workspaceProductProjection.js');
const gateway = read('services/api/src/services/perfectFit/productGateway.js');
const workspace = read('apps/samara-web/my-vite-react-app/src/components/Workspace.jsx');
const presentation = read('apps/samara-web/my-vite-react-app/src/lib/workspaceProductPresentation.js');
const taxonomy = read('apps/samara-web/my-vite-react-app/src/data/catalogTaxonomy.js');
const app = read('apps/samara-web/my-vite-react-app/src/App.jsx');
const seo = read('apps/samara-web/my-vite-react-app/src/components/PatternSEO.jsx');
const categoryMigration = read('services/api/db/migrations/0145_perfect_fit_governed_garment_taxonomy.sql');

function makeDb(existingAttrs = {}) {
  const state = { updatedAttrs: null, connected: 0, released: 0, queries: [] };
  const client = {
    async query(sql, params = []) {
      state.queries.push({ sql, params });
      if (/SELECT id, attrs/i.test(sql)) {
        return { rowCount: 1, rows: [{ id: 'product-1', attrs: structuredClone(existingAttrs) }] };
      }
      if (/UPDATE eip_core\.material SET attrs=/i.test(sql)) {
        state.updatedAttrs = JSON.parse(params[2]);
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
    release() {
      state.released += 1;
    }
  };
  return {
    state,
    db: {
      async connect() {
        state.connected += 1;
        return client;
      }
    }
  };
}

test('0146 reuses EIP governance and Product JSONB without PF-specific business tables', () => {
  assert.match(migration, /PF_PRODUCT_TAG/);
  assert.match(migration, /eip_core\.dropdown_list/);
  assert.match(migration, /eip_core\.dropdown_value/);
  assert.match(migration, /eip_commerce\.socket_manifest/);
  assert.match(migration, /eip_commerce\.socket_alias_map/);
  assert.doesNotMatch(migration, /CREATE\s+TABLE\s+eip_(?:core|commerce)\.[a-z0-9_]*perfect_fit/i);
  assert.match(migration, /'variant\.seo_title', 'seo\.title'/);
  assert.match(migration, /'variant\.seo_description', 'seo\.description'/);
  assert.match(migration, /'variant\.seo_slug', 'seo\.slug'/);
  assert.match(migration, /'variant\.tags', 'taxonomy\.tags'/);
});

test('0146 governs merchandising tags and Orbit surface behavior separately from category', () => {
  for (const code of [
    'NEW_RELEASE',
    'BEST_SELLER',
    'FREE_PATTERN',
    'PATTERN_OF_THE_DAY',
    'PREMIUM_BLUEPRINT',
    'BEGINNER_FRIENDLY',
    'EDITORIAL_PICK',
    'CURVE_PLUS',
    'ORBIT_FEATURED'
  ]) {
    assert.match(migration, new RegExp(`'${code}'`));
  }
  assert.match(migration, /surface_targets.*signature-orbit-carousel.*orbit-carousel/);
  assert.match(migration, /catalog_filter_id.*best-sellers/);
  assert.match(migration, /catalog_filter_id.*free-patterns/);
  assert.match(migration, /catalog_filter_id.*pattern-of-the-day/);
  assert.match(migration, /catalog_filter_id.*curve-plus/);

  // Guard the 0145 category distinction: these remain filter facets, not garment categories.
  assert.match(categoryMigration, /Catalogue-only facets/);
  assert.doesNotMatch(categoryMigration, /\('BEST_SELLER'/);
  assert.doesNotMatch(categoryMigration, /\('FREE_PATTERN'/);
  assert.doesNotMatch(categoryMigration, /\('PATTERN_OF_THE_DAY'/);
  assert.doesNotMatch(categoryMigration, /\('CURVE_PLUS'/);
});

test('manifest successor adds Variant Discovery & SEO fields and governed multiselect binding', () => {
  assert.match(migration, /2026-09-05-db-workspace-v2/);
  assert.match(migration, /dropdownBindings,VARIANT_TAG/);
  assert.match(migration, /PF_PRODUCT_TAG/);
  assert.match(migration, /variantDiscoverySeo/);
  assert.match(migration, /variant\.seo_title/);
  assert.match(migration, /variant\.seo_description/);
  assert.match(migration, /variant\.seo_slug/);
  assert.match(migration, /variant\.tags/);
  assert.match(migration, /"type":"multiselect"/);
  assert.match(migration, /"governanceList":"VARIANT_TAG"/);
});

test('workspace renderer is metadata driven for governed Variant tags', () => {
  assert.match(workspace, /field\.type === 'multiselect'/);
  assert.match(workspace, /metadata\.dropdowns\?\.\[field\.governanceList\]/);
  assert.match(workspace, /discoverySeoGroup = getFieldGroups\(metadata, 'variant'\)/);
  assert.match(workspace, /group\.key === 'variantDiscoverySeo'/);
  assert.match(workspace, /field\.label \|\|/);
  assert.match(workspace, /option\?\.label \|\|/);
  assert.doesNotMatch(workspace, /\['ORBIT_FEATURED',\s*'BEST_SELLER'/);
});

test('workspace projection maps SEO and tags only to the Style Variant presentation path', () => {
  assert.match(projection, /"seo\.title"/);
  assert.match(projection, /"seo\.description"/);
  assert.match(projection, /"seo\.slug"/);
  assert.match(projection, /"taxonomy\.tags"/);
  assert.match(projection, /entry\.scope !== "variant"/);
  assert.match(projection, /syncPerfectFitVariantPresentation/);
  assert.match(projection, /presentationPresence/);
  assert.match(projection, /validateGovernedDropdownValue/);
  assert.match(projection, /for \(const tag of normalizedTags\)/);
});

test('variant presentation sync preserves unrelated EIP attrs and applies explicit PF-owned SEO/tags', async () => {
  const { db, state } = makeDb({
    content: { summary: 'Keep me' },
    taxonomy: { brand: 'Existing Brand', category: 'Dresses', tags: ['LEGACY'] },
    seo: { title: 'Old title', robots: 'index,follow' },
    inventory: { qty: 12 },
    integration: { other_system: { id: 'x' } }
  });

  const result = await syncPerfectFitVariantPresentation(db, {
    tenantId: 'tenant-1',
    productId: 'product-1',
    presentation: {
      seo_title: 'Variant SEO Title',
      seo_description: 'Variant SEO Description',
      seo_slug: 'variant-seo-slug',
      tags: ['ORBIT_FEATURED', 'BEST_SELLER', 'ORBIT_FEATURED']
    },
    presence: {
      seo_title: true,
      seo_description: true,
      seo_slug: true,
      tags: true
    }
  });

  assert.equal(result.ok, true);
  assert.equal(state.connected, 1);
  assert.equal(state.released, 1);
  assert.equal(state.updatedAttrs.content.summary, 'Keep me');
  assert.equal(state.updatedAttrs.inventory.qty, 12);
  assert.equal(state.updatedAttrs.taxonomy.brand, 'Existing Brand');
  assert.equal(state.updatedAttrs.taxonomy.category, 'Dresses');
  assert.deepEqual(state.updatedAttrs.taxonomy.tags, ['ORBIT_FEATURED', 'BEST_SELLER']);
  assert.equal(state.updatedAttrs.seo.title, 'Variant SEO Title');
  assert.equal(state.updatedAttrs.seo.description, 'Variant SEO Description');
  assert.equal(state.updatedAttrs.seo.slug, 'variant-seo-slug');
  assert.equal(state.updatedAttrs.seo.robots, 'index,follow');
  assert.equal(state.updatedAttrs.integration.other_system.id, 'x');
});

test('legacy Variant with absent SEO/tag keys does not touch EIP presentation attrs', async () => {
  const { db, state } = makeDb({ seo: { title: 'Existing' }, taxonomy: { tags: ['KEEP'] } });
  const result = await syncPerfectFitVariantPresentation(db, {
    tenantId: 'tenant-1',
    productId: 'product-1',
    presentation: {},
    presence: {}
  });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(state.connected, 0);
  assert.equal(state.updatedAttrs, null);
});

test('explicit empty Variant values clear only PF-owned SEO fields and tags', async () => {
  const { db, state } = makeDb({
    seo: { title: 'Old', description: 'Old description', robots: 'index' },
    taxonomy: { brand: 'Keep', tags: ['OLD'] }
  });
  const result = await syncPerfectFitVariantPresentation(db, {
    tenantId: 'tenant-1',
    productId: 'product-1',
    presentation: { seo_title: '', tags: [] },
    presence: { seo_title: true, tags: true }
  });
  assert.equal(result.ok, true);
  assert.equal(state.updatedAttrs.seo.title, undefined);
  assert.equal(state.updatedAttrs.seo.description, 'Old description');
  assert.equal(state.updatedAttrs.seo.robots, 'index');
  assert.equal(state.updatedAttrs.taxonomy.brand, 'Keep');
  assert.deepEqual(state.updatedAttrs.taxonomy.tags, []);
});

test('catalog presentation prefers explicit Variant SEO/tags while retaining legacy overlay fallback', () => {
  assert.match(presentation, /variantTagsPresent/);
  assert.match(presentation, /collectionTags: presentation\.variantTagsPresent/);
  assert.match(presentation, /seoTitle: presentation\.seoTitle !== undefined/);
  assert.match(presentation, /seoDescription: presentation\.seoDescription !== undefined/);
  assert.match(presentation, /seoSlug: presentation\.seoSlug !== undefined/);
  assert.match(seo, /pattern\?\.seoTitle/);
  assert.match(seo, /pattern\?\.seoDescription/);
  assert.match(seo, /pattern\?\.seoSlug/);
});

test('Orbit selection is driven by governed tag attrs with safe first-N fallback', () => {
  assert.match(taxonomy, /perfectFitMetadata\.workspace\?\.dropdowns\?\.VARIANT_TAG/);
  assert.match(taxonomy, /option\?\.attrs\?\.surface_targets/);
  assert.match(taxonomy, /const source = eligible\.length \? eligible : safe/);
  assert.match(taxonomy, /attrs\.legacy_tag_id/);
  assert.match(app, /selectPatternsForSurface\(productPresentationPatterns, 'signature-orbit-carousel', 8\)/);
  assert.match(app, /selectPatternsForSurface\(productPresentationPatterns, 'orbit-carousel', 4\)/);
  assert.doesNotMatch(app, /productPresentationPatterns\.slice\(0, 8\)/);
});

test('product gateway writes existing material JSONB rather than parallel SEO/tag persistence', () => {
  assert.match(gateway, /nextAttrs\.seo/);
  assert.match(gateway, /nextAttrs\.taxonomy\.tags/);
  assert.match(gateway, /UPDATE eip_core\.material SET attrs=/);
  assert.doesNotMatch(gateway, /INSERT INTO .*seo/i);
  assert.doesNotMatch(gateway, /INSERT INTO .*tag/i);
});
