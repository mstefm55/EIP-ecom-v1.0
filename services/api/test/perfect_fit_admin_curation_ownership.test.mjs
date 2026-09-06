import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { syncPerfectFitAdminCuration } from '../src/services/perfectFit/productGateway.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const migration = read('services/api/db/migrations/0148_perfect_fit_admin_curation_ownership.sql');
const route = read('services/api/src/routes/public_perfect_fit_admin.js');
const preflight = read('services/api/src/routes/public_commerce_preflight.js');
const projection = read('services/api/src/services/perfectFit/workspaceProductProjection.js');
const gateway = read('services/api/src/services/perfectFit/productGateway.js');
const adapter = read('apps/samara-web/my-vite-react-app/src/lib/eipApiAdapter.js');
const adminUi = read('apps/samara-web/my-vite-react-app/src/components/admin/PerfectFitCurationAdmin.jsx');
const adminPanel = read('apps/samara-web/my-vite-react-app/src/components/AdminControlPanel.jsx');
const presentation = read('apps/samara-web/my-vite-react-app/src/lib/workspaceProductPresentation.js');
const productStudio = read('apps/dashboard/src/components/ecom/EcomProductWorkspace.jsx');
const storefront = read('services/api/src/lib/storefrontContentResolution.js');

function makeDb(existingAttrs = {}) {
  const state = { updatedAttrs: null, connected: 0, released: 0 };
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

test('0148 is additive governance over existing tag codes', () => {
  assert.match(migration, /0148_perfect_fit_admin_curation_ownership/);
  assert.match(migration, /PF_PRODUCT_TAG/);
  assert.match(migration, /workspace_selectable', false/);
  assert.match(migration, /admin_selectable', true/);
  assert.match(migration, /product_studio_selectable', true/);
  assert.match(migration, /MERCHANDISING_ADMIN/);
  assert.match(migration, /PF_ADMIN/);
  assert.match(migration, /EIP_PRODUCT_STUDIO/);
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i);
  assert.doesNotMatch(migration, /INSERT INTO eip_core\.dropdown_value[\s\S]*BEST_SELLER/i);
});

test('0148 removes curation from ordinary Variant Overview manifest group', () => {
  assert.match(migration, /2026-09-06-db-workspace-v4/);
  assert.match(migration, /"adminOnly":true/);
  assert.match(migration, /"workspaceEditable":false/);
  assert.match(migration, /"fields":\["variant\.seo_title","variant\.seo_description","variant\.seo_slug","variant\.seo_keywords"\]/);
  assert.match(migration, /workspaceCurationEditable', false/);
});

test('ordinary PF workspace projection cannot write taxonomy tags', () => {
  assert.doesNotMatch(projection, /"taxonomy\.tags"/);
  assert.doesNotMatch(projection, /presentationField === "tags"/);
  assert.doesNotMatch(gateway, /const ownedKeys = \[[^\]]*"tags"/);
  assert.doesNotMatch(gateway, /if \(presence\.tags\)/);
});

test('PF admin curation route is member-session, PF_ADMIN and CSRF guarded', () => {
  assert.match(route, /perfect-fit\/admin\/curation\/products/);
  assert.match(route, /r\.code = 'PF_ADMIN'/);
  assert.match(route, /PF_ADMIN_REQUIRED/);
  assert.match(route, /MEMBER_UNAUTHENTICATED/);
  assert.match(route, /MEMBER_CSRF_REQUIRED/);
  assert.match(route, /perfect_fit\.products\.read/);
  assert.match(route, /perfect_fit\.products\.write/);
  assert.match(route, /validateGovernedDropdownValue/);
  assert.match(route, /PF_PRODUCT_TAG/);
  assert.match(route, /syncPerfectFitAdminCuration/);
  assert.match(preflight, /registerPublicPerfectFitAdminRoutes/);
  assert.match(preflight, /await registerPublicPerfectFitAdminRoutes\(app\)/);
});

test('PF admin browser uses the public gateway and DB-governed curation options', () => {
  assert.match(adapter, /listAdminCurationProducts/);
  assert.match(adapter, /saveAdminCuration/);
  assert.match(adminUi, /perfectFitMetadata\.workspace/);
  assert.match(adminUi, /VARIANT_CURATION/);
  assert.match(adminUi, /admin_selectable/);
  assert.match(adminUi, /Save curation/);
  assert.match(adminPanel, /PerfectFitCurationAdmin/);
  assert.match(adminPanel, /id: 'curation'/);
});

test('admin curation helper preserves unrelated product attrs', async () => {
  const { db, state } = makeDb({
    product_hierarchy: { level: 'STYLE_VARIANT' },
    taxonomy: { category: 'DRESS', brand: 'Brand', tags: ['OLD'] },
    seo: { title: 'Keep' },
    inventory: { qty: 12 },
    integration: { other: { id: 'x' } }
  });

  const result = await syncPerfectFitAdminCuration(db, {
    tenantId: 'tenant-1',
    productId: 'product-1',
    tags: ['ORBIT_FEATURED', 'BEST_SELLER', 'ORBIT_FEATURED'],
    actorIdentityId: 'pf-admin-1'
  });

  assert.equal(result.ok, true);
  assert.deepEqual(state.updatedAttrs.taxonomy.tags, ['ORBIT_FEATURED', 'BEST_SELLER']);
  assert.equal(state.updatedAttrs.taxonomy.category, 'DRESS');
  assert.equal(state.updatedAttrs.taxonomy.brand, 'Brand');
  assert.equal(state.updatedAttrs.seo.title, 'Keep');
  assert.equal(state.updatedAttrs.inventory.qty, 12);
  assert.equal(state.updatedAttrs.integration.other.id, 'x');
  assert.equal(state.updatedAttrs.integration.perfect_fit.curation_authority, 'MERCHANDISING_ADMIN');
});

test('catalogue and storefront still consume enterprise taxonomy tags', () => {
  assert.match(presentation, /collectionTags: commerce\?\.collectionTags \|\| commerce\?\.tags \|\| \[\]/);
  assert.match(presentation, /tags: commerce\?\.tags \|\| commerce\?\.collectionTags \|\| \[\]/);
  assert.match(storefront, /taxonomy\.tags/);
  assert.match(productStudio, /taxonomy/);
  assert.match(productStudio, /tags/);
});
