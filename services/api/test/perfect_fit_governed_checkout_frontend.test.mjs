import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const appRoot = path.join(repoRoot, 'apps/samara-web/my-vite-react-app/src');

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
}

test('Perfect Fit checkout uses governed EIP order and payment lifecycle', () => {
  const source = read('components/CheckoutDrawer.jsx');
  const client = read('services/perfectFitCheckout.js');

  assert.match(source, /createPerfectFitOrder\(/);
  assert.match(source, /createPerfectFitPaymentSession\(/);
  assert.match(source, /confirmPerfectFitPaymentSession\(/);
  assert.match(source, /fetchPerfectFitPaymentSession\(/);
  assert.match(source, /source:\s*'EIP'/);

  assert.match(client, /\/order/);
  assert.match(client, /\/checkout\/payment-session/);
  assert.match(client, /\/checkout\/confirm/);

  assert.doesNotMatch(source, /SRT-/);
  assert.doesNotMatch(source, /Simulate real bank authorization delay/i);
  assert.doesNotMatch(source, /This demo file represents/i);
  assert.doesNotMatch(source, /name=["']cardNumber["']/);
  assert.doesNotMatch(source, /name=["']cardCVC["']/);
});

test('Workspace purchase snapshots cannot inherit arbitrary commerce fallback media', () => {
  const source = read('components/CheckoutDrawer.jsx');
  const presentation = read('lib/workspaceProductPresentation.js');

  assert.match(source, /sanitizePatternForPurchase/);
  assert.match(source, /workspaceOwned\s*\|\|\s*pattern\?\.presentationSource\s*===\s*'workspace'/);
  assert.match(source, /getWorkspaceTrustedImage/);
  assert.match(source, /isPersistentUrl/);

  assert.match(presentation, /image:\s*media\.primaryAsset\?\.url\s*\|\|\s*''/);
  assert.match(presentation, /primaryImage:\s*media\.primaryAsset\?\.url\s*\|\|\s*''/);
});

test('Checkout never fabricates a downloadable pattern bundle', () => {
  const source = read('components/CheckoutDrawer.jsx');

  assert.match(source, /resolveDigitalDownloadUrl/);
  assert.match(source, /no placeholder file will be fabricated/i);
  assert.doesNotMatch(source, /new Blob\(/);
  assert.doesNotMatch(source, /text\/plain;charset=utf-8/);
});
