import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const source = fs.readFileSync(
  path.join(repoRoot, 'apps/samara-web/my-vite-react-app/src/components/MyOrdersSection.jsx'),
  'utf8'
);

test('My Purchased uses the signed-in member purchase history regardless of UI role', () => {
  assert.match(
    source,
    /const orders = currentUser\s*\? \(currentUser\.purchaseHistory \|\| \[\]\)\s*:\s*guestOrders;/
  );
  assert.doesNotMatch(source, /currentUser\?\.role === ['"]buyer['"]/);
});

test('purchased PDF rows define their PDF status before rendering the status badge', () => {
  const definition = source.indexOf("const isPDF = String(item.format || '').toUpperCase().includes('PDF');");
  const usage = source.indexOf("isPDF ? 'bg-emerald-500 animate-pulse' : 'bg-amber-450'");
  assert.ok(definition >= 0, 'isPDF must be defined for purchased order rows');
  assert.ok(usage > definition, 'isPDF must be defined before its status badge usage');
});
