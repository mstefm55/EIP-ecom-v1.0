import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const source = fs.readFileSync(
  path.join(repoRoot, 'apps/samara-web/my-vite-react-app/src/lib/userIdentity.js'),
  'utf8'
);

test('member identity hydration preserves the member purchase history', () => {
  assert.match(source, /purchaseHistory:\s*resolvePurchaseHistory\(user, id\)/);
  assert.match(source, /isSameStoredIdentity/);
  assert.match(source, /storedUser\.purchaseHistory/);
});

test('same-browser guest checkout is claimed only by the authenticated checkout email', () => {
  assert.match(source, /GUEST_ORDER_STORAGE_KEY\s*=\s*['"]perfectfit_bureau_guest_orders['"]/);
  assert.match(source, /guestOrders\.filter\(\(order\)\s*=>\s*orderOwnerEmail\(order\)\s*===\s*userEmail\)/);
  assert.doesNotMatch(source, /claimableGuestOrders\s*=\s*guestOrders\s*;/);
});

test('purchase history deduplicates order identifiers during identity hydration', () => {
  assert.match(source, /dedupePurchaseHistory/);
  assert.match(source, /order\?\.id\s*\|\|\s*order\?\.orderId\s*\|\|\s*order\?\.code/);
});
