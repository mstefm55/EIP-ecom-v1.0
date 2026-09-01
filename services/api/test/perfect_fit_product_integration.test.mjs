import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  PERFECT_FIT_SHARED_FIELD_POLICIES,
  buildPerfectFitLinkPayload,
  normalizePerfectFitIdentity,
  reconcileSharedMetadata
} from '../src/lib/perfectFitProductIntegration.js';

const ecomRouteSource = readFileSync(new URL('../src/routes/ecom.js', import.meta.url), 'utf8');
const dashboardSource = readFileSync(
  new URL('../../../apps/dashboard/src/components/ecom/EcomProductWorkspace.jsx', import.meta.url),
  'utf8'
);

test('Perfect Fit product linkage requires stable external product and variant IDs', () => {
  assert.equal(normalizePerfectFitIdentity({ pf_product_id: 'pf-1' }).ok, false);
  const result = normalizePerfectFitIdentity({ pf_product_id: 'pf-1', variant_id: 'variant-1', style_code: 'STYLE-1' });
  assert.equal(result.ok, true);
  assert.equal(result.identity.style_code, 'STYLE-1');
});

test('field reconciliation enforces PF and EIP authority without timestamp-only overwrite', () => {
  const result = reconcileSharedMetadata({
    source: 'PERFECT_FIT',
    lastAccepted: { description: 'old PF', category_code: 'DRESS', publication_status: 'DRAFT' },
    perfectFit: { product_name: 'PF Name', description: 'rich PF', category_code: 'PF_CATEGORY', publication_status: 'REQUESTED' },
    eip: { product_name: 'EIP Name', description: 'short EIP', category_code: 'EIP_DRESSES', publication_status: 'PUBLISHED' }
  });
  assert.equal(result.accepted.product_name, 'PF Name');
  assert.equal(result.accepted.description, 'rich PF');
  assert.equal(result.accepted.category_code, 'EIP_DRESSES');
  assert.deepEqual(result.conflicts.map((item) => item.field), ['publication_status']);
  assert.equal(PERFECT_FIT_SHARED_FIELD_POLICIES.description, 'PF_WINS');
});

test('unmapped PF extensions are reported and never folded into the shared snapshot', () => {
  const result = reconcileSharedMetadata({
    source: 'PERFECT_FIT',
    perfectFit: { product_name: 'Aurelia', measurement_chart: { bust: 91 }, fit_profile: { ease: 8 } },
    eip: { product_name: 'Aurelia' }
  });
  assert.deepEqual(result.unmapped_fields.sort(), ['fit_profile', 'measurement_chart']);
  assert.equal(result.accepted.measurement_chart, undefined);
});

test('link payload stores reference-only identity and governed shared snapshot', () => {
  const payload = buildPerfectFitLinkPayload({
    identity: { pf_product_id: 'pf-1', variant_id: 'variant-1', pattern_references: ['PAT-1'] },
    sharedMetadata: { product_name: 'Aurelia' },
    origin: 'PERFECT_FIT',
    actorIdentityId: 'identity-1'
  });
  assert.equal(payload.perfect_fit.pf_product_id, 'pf-1');
  assert.equal(payload.shared_snapshot.accepted.product_name, 'Aurelia');
  assert.equal(payload.measurement_chart, undefined);
});

test('PF to EIP register, existing-link, sync, and capability routes remain exposed', () => {
  for (const route of [
    '/perfect-fit/capability',
    '/perfect-fit/products/register',
    '/products/:id/perfect-fit/link',
    '/products/:id/perfect-fit/sync'
  ]) {
    assert.match(ecomRouteSource, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(ecomRouteSource, /PERFECT_FIT_PRODUCT/);
  assert.match(ecomRouteSource, /INSERT INTO eip_core\.material/);
  assert.match(ecomRouteSource, /INSERT INTO eip_core\.object_link/);
});

test('unlink is soft and preserves both Perfect Fit and EIP product records', () => {
  const unlinkStart = ecomRouteSource.indexOf('"/products/:id/perfect-fit/link"', ecomRouteSource.indexOf('"/products/:id/perfect-fit/link"') + 1);
  const unlinkSection = ecomRouteSource.slice(unlinkStart, unlinkStart + 1800);
  assert.match(ecomRouteSource.slice(Math.max(0, unlinkStart - 20), unlinkStart), /app\.delete\s*\(/);
  assert.match(unlinkSection, /UPDATE eip_core\.object_link SET is_active=false/);
  assert.match(unlinkSection, /records_deleted:\s*false/);
  assert.doesNotMatch(unlinkSection, /DELETE FROM eip_core\.(?:material|info_record)/);
});

test('EIP Product Studio exposes capability-gated create, link, open, status, sync, and unlink actions', () => {
  assert.match(dashboardSource, /perfect-fit\/capability/);
  for (const action of ['CREATE', 'LINK', 'OPEN', 'STATUS', 'SYNC', 'UNLINK']) {
    assert.match(dashboardSource, new RegExp(`value="${action}"`));
  }
  assert.match(dashboardSource, /perfectFitCapability\.available/);
});
