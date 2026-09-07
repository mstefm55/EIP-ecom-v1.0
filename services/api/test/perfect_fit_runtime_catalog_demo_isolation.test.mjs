import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const bootstrap = fs.readFileSync(
  path.join(repoRoot, 'apps/samara-web/my-vite-react-app/src/lib/runtimeRepositoryBootstrap.js'),
  'utf8'
);
const orders = fs.readFileSync(
  path.join(repoRoot, 'apps/samara-web/my-vite-react-app/src/components/MyOrdersSection.jsx'),
  'utf8'
);

const legacyNames = [
  'Merchant & Mills Fielder Dress',
  'The Fold Line Dawn Jeans',
  'Etsy Modern Linen Boxy Tee'
];

test('legacy imported Atelier library is not a storefront catalogue migration source', () => {
  assert.match(bootstrap, /domain === 'catalogProducts' && legacyKey === importedPatternStorageKey/);
  assert.match(bootstrap, /continue;/);
});

test('production runtime removes only the exact historical imported-pattern demo signatures', () => {
  assert.match(bootstrap, /sanitizeProductionPatternStorage/);
  assert.match(bootstrap, /removeLegacyImportedPatternDemoRecords/);
  assert.match(bootstrap, /if \(!enableDemoData\)/);
  for (const name of legacyNames) {
    assert.ok(bootstrap.includes(name), `missing legacy demo signature: ${name}`);
  }
});

test('production bootstrap initializes imported pattern storage before the legacy UI fallback can seed demo records', () => {
  assert.match(bootstrap, /storage\.setItem\(importedKey, JSON\.stringify\(\[\]\)\)/);
  assert.match(orders, /sartorial_atelier_imported_patterns/);
});

test('catalog cleanup is scoped to known demo ids and preserves unrelated catalogue records', () => {
  assert.match(bootstrap, /\['IMP-001', 'Merchant & Mills Fielder Dress'\]/);
  assert.match(bootstrap, /\['IMP-002', 'The Fold Line Dawn Jeans'\]/);
  assert.match(bootstrap, /\['IMP-003', 'Etsy Modern Linen Boxy Tee'\]/);
  assert.match(bootstrap, /filter\(\s*\(record\) => !isLegacyImportedPatternDemoRecord\(record\)\s*\)/);
});
