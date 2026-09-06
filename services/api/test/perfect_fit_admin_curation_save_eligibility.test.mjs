import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const route = fs.readFileSync(
  path.join(repoRoot, 'services/api/src/routes/public_perfect_fit_admin.js'),
  'utf8'
);

test('PF Admin curation save accepts the same canonical Style Variant identity as the list endpoint', () => {
  assert.match(route, /async function ensureCurationStyleVariant/);
  assert.match(route, /PERFECT_FIT_PRODUCT_LINK/);
  assert.match(route, /PERFECT_FIT_PRODUCT/);
  assert.match(route, /perfectFit\.entity_level/);
  assert.match(route, /perfectFit\.variant_id/);
  assert.match(route, /hierarchyLevel === "STYLE_VARIANT"/);
  assert.match(route, /linkedLevel === "STYLE_VARIANT"/);
  assert.match(route, /hasVariantIdentity/);
});

test('PF Admin curation save self-heals legacy hierarchy metadata before the governed tag write', () => {
  const ensureIndex = route.indexOf('ensureCurationStyleVariant(');
  const syncIndex = route.lastIndexOf('syncPerfectFitAdminCuration(app.db');
  assert.ok(ensureIndex > 0);
  assert.ok(syncIndex > ensureIndex);
  assert.match(route, /\{product_hierarchy,level\}/);
  assert.match(route, /to_jsonb\('STYLE_VARIANT'::text\)/);
  assert.match(route, /if \(!eligible\.ok\)/);
});

test('curation save still preserves PF Admin, governed vocabulary and CSRF boundaries', () => {
  assert.match(route, /r\.code = 'PF_ADMIN'/);
  assert.match(route, /MEMBER_CSRF_REQUIRED/);
  assert.match(route, /validateGovernedDropdownValue/);
  assert.match(route, /PF_PRODUCT_TAG/);
});
