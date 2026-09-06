import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { syncPerfectFitVariantPresentation } from '../src/services/perfectFit/productGateway.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const migration = read('services/api/db/migrations/0147_perfect_fit_keywords_curation.sql');
const correction = read('services/api/db/migrations/0148_perfect_fit_admin_curation_ownership.sql');
const workspace = read('apps/samara-web/my-vite-react-app/src/components/Workspace.jsx');
const projection = read('services/api/src/services/perfectFit/workspaceProductProjection.js');
const presentation = read('apps/samara-web/my-vite-react-app/src/lib/workspaceProductPresentation.js');
const seo = read('apps/samara-web/my-vite-react-app/src/components/PatternSEO.jsx');

function makeDb(existingAttrs = {}) {
  const state = { updatedAttrs: null };
  const client = {
    async query(sql, params = []) {
      if (/SELECT id, attrs/i.test(sql)) {
        return { rowCount: 1, rows: [{ id: 'product-1', attrs: structuredClone(existingAttrs) }] };
      }
      if (/UPDATE eip_core\.material SET attrs=/i.test(sql)) {
        state.updatedAttrs = JSON.parse(params[2]);
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
    release() {}
  };
  return {
    state,
    db: {
      async connect() {
        return client;
      }
    }
  };
}

test('0147 adds free search keywords without creating a second governed keyword list', () => {
  assert.match(migration, /variant\.seo_keywords/);
  assert.match(migration, /seo\.keywords/);
  assert.match(migration, /"type":"tagInput"/);
  assert.match(migration, /"allowFreeText":true/);
  assert.match(migration, /PF_PRODUCT_TAG/);
  assert.match(migration, /VARIANT_CURATION/);
  assert.doesNotMatch(migration, /PF_(?:SEO_)?KEYWORD/);
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i);
});

test('0148 corrects curation assignment authority without changing 0147 history', () => {
  assert.match(correction, /workspace_selectable', false/);
  assert.match(correction, /admin_selectable', true/);
  assert.match(correction, /product_studio_selectable', true/);
  assert.match(correction, /MERCHANDISING_ADMIN/);
  assert.match(correction, /PF_ADMIN/);
  assert.match(correction, /EIP_PRODUCT_STUDIO/);
  assert.match(correction, /2026-09-06-db-workspace-v4/);
  assert.match(correction, /variantDiscoverySeo/);
  assert.match(correction, /variant\.seo_keywords/);
  assert.doesNotMatch(correction, /"fields":\["variant\.seo_title","variant\.seo_description","variant\.seo_slug","variant\.seo_keywords","variant\.tags"\]/);
});

test('workspace keeps an EIP-like free keyword chip input with explicit add control', () => {
  assert.match(workspace, /field\.type === 'tagInput'/);
  assert.match(workspace, /Press Enter|event\.key === 'Enter'/);
  assert.match(workspace, /event\.key === ','/);
  assert.match(workspace, /aria-label="Add keyword"/);
  assert.match(workspace, /Remove \$\{keyword\}/);
  assert.match(workspace, /variant\.seo_keywords/);
});

test('ordinary PF projection maps free keywords but not enterprise curation tags', () => {
  assert.match(projection, /"seo\.keywords"/);
  assert.match(projection, /presentationField === "seo_keywords"/);
  assert.doesNotMatch(projection, /"taxonomy\.tags"/);
  assert.doesNotMatch(projection, /presentationField === "tags"/);
});

test('gateway preserves admin curation tags while saving designer keyword array under seo', async () => {
  const { db, state } = makeDb({
    seo: { title: 'Existing title' },
    taxonomy: { category: 'DRESS', tags: ['ORBIT_FEATURED'] },
    inventory: { qty: 4 }
  });

  const result = await syncPerfectFitVariantPresentation(db, {
    tenantId: 'tenant-1',
    productId: 'product-1',
    presentation: {
      seo_keywords: ['bias cut', 'silk', 'bias cut'],
      tags: ['BEST_SELLER']
    },
    presence: {
      seo_keywords: true,
      tags: true
    }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(state.updatedAttrs.seo.keywords, ['bias cut', 'silk']);
  assert.equal(state.updatedAttrs.seo.title, 'Existing title');
  assert.deepEqual(state.updatedAttrs.taxonomy.tags, ['ORBIT_FEATURED']);
  assert.equal(state.updatedAttrs.inventory.qty, 4);
});

test('explicit empty keyword list clears only keywords and preserves admin tags', async () => {
  const { db, state } = makeDb({
    seo: { title: 'Keep', keywords: ['old'] },
    taxonomy: { tags: ['BEST_SELLER'] }
  });

  const result = await syncPerfectFitVariantPresentation(db, {
    tenantId: 'tenant-1',
    productId: 'product-1',
    presentation: { seo_keywords: [], tags: [] },
    presence: { seo_keywords: true, tags: true }
  });

  assert.equal(result.ok, true);
  assert.equal(state.updatedAttrs.seo.title, 'Keep');
  assert.equal(state.updatedAttrs.seo.keywords, undefined);
  assert.deepEqual(state.updatedAttrs.taxonomy.tags, ['BEST_SELLER']);
});

test('catalog presentation consumes Variant keywords while curation comes from commerce overlay', () => {
  assert.match(presentation, /seoKeywordsPresent/);
  assert.match(presentation, /seoKeywords:/);
  assert.match(presentation, /collectionTags: commerce\?\.collectionTags \|\| commerce\?\.tags \|\| \[\]/);
  assert.match(presentation, /tags: commerce\?\.tags \|\| commerce\?\.collectionTags \|\| \[\]/);
  assert.doesNotMatch(presentation, /variantTagsPresent/);
  assert.match(seo, /pattern\?\.seoKeywords/);
  assert.match(seo, /metaKeywords/);
  assert.match(seo, /seoKeywords\.join\(', '\)/);
});