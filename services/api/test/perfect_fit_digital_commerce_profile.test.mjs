import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const productGateway = fs.readFileSync(
  path.join(repoRoot, 'services/api/src/services/perfectFit/productGateway.js'),
  'utf8'
);
const publicCommerce = fs.readFileSync(
  path.join(repoRoot, 'services/api/src/routes/public_commerce.js'),
  'utf8'
);
const workspaceBridge = fs.readFileSync(
  path.join(repoRoot, 'apps/samara-web/my-vite-react-app/src/lib/workspacePersistenceBridge.js'),
  'utf8'
);

test('Perfect Fit products carry an explicit digital commerce profile without stock tracking', () => {
  assert.match(productGateway, /PERFECT_FIT_DIGITAL_DELIVERY_MODE\s*=\s*["']digital["']/);
  assert.match(productGateway, /track_inventory:\s*false/);
  assert.match(productGateway, /mode:\s*PERFECT_FIT_DIGITAL_DELIVERY_MODE/);
  assert.match(productGateway, /commerce_profile:\s*["']DIGITAL_PATTERN["']/);
});

test('legacy commerce reconciliation is restricted to PF-linked materials', () => {
  const reconcile = productGateway.match(
    /async function reconcilePerfectFitCommerceProjections[\s\S]*?return \{[\s\S]*?publication_projection_reconciled:[\s\S]*?\n\s*\};\n\}/
  );
  assert.ok(reconcile, 'commerce reconciliation helper must exist');
  assert.match(reconcile[0], /PERFECT_FIT_PRODUCT_LINK/);
  assert.match(reconcile[0], /ol\.relation_type=\$3/);
  assert.match(reconcile[0], /ol\.src_kind='material'/);
  assert.match(reconcile[0], /ol\.is_active=true/);
  assert.doesNotMatch(reconcile[0], /UPDATE eip_core\.material[\s\S]*WHERE m\.tenant_id=\$1[\s\S]*;[\s\S]*UPDATE eip_core\.material[\s\S]*WHERE m\.tenant_id=\$1\s*;/);
});

test('published-stage repair requires authoritative PF publication workflow evidence', () => {
  assert.match(productGateway, /PERFECT_FIT_PUBLICATION_REQUEST/);
  assert.match(productGateway, /publication_record\.payload->>'material_id'/);
  assert.match(productGateway, /lower\(COALESCE\(so\.status, ''\)\)='published'/);
  assert.match(productGateway, /pi\.cursor_json->>'node'/);
  assert.match(productGateway, /content_published/);
  assert.match(productGateway, /'stage', 'published'/);
  assert.match(productGateway, /'publication_status', 'PUBLISHED'/);
});

test('new, linked, reused, and synchronized PF products preserve the digital profile', () => {
  assert.match(productGateway, /const attrs = applyPerfectFitDigitalCommerceProfile\(/);
  assert.match(productGateway, /await reconcilePerfectFitCommerceProjections\(client, tenantId, productId\)/);
  assert.match(productGateway, /const profiledAttrs = applyPerfectFitDigitalCommerceProfile\(attrs\)/);
  assert.match(productGateway, /const profiledAttrs = applyPerfectFitDigitalCommerceProfile\(nextAttrs\)/);
  assert.match(productGateway, /const nextAttrs = applyPerfectFitDigitalCommerceProfile\(/);
});

test('PF workspace hydration performs one governed legacy commerce reconciliation pass per revision', () => {
  assert.match(workspaceBridge, /perfectfit_workspace_commerce_profile_reconciled_v1/);
  assert.match(workspaceBridge, /commerceReconcileAttempted\(identityId, commerceRevision\)/);
  assert.match(workspaceBridge, /const reconciled = await saveWorkspaceRemotely\(hydratedWorkspace\)/);
  assert.match(workspaceBridge, /markCommerceReconciled\(/);
  assert.match(workspaceBridge, /commerce_profile_reconcile_warning/);
  assert.match(workspaceBridge, /removeItem\(COMMERCE_RECONCILE_MARKER_KEY\)/);
});

test('public commerce only consumes inventory when track_inventory is explicitly true', () => {
  assert.match(publicCommerce, /normalizeBoolean\(inventory\.track_inventory, false\) === true/);
  assert.match(publicCommerce, /if \(!isInventoryTracked\(inventory\)\) continue;/);
  assert.match(publicCommerce, /INSUFFICIENT_STOCK/);
});
