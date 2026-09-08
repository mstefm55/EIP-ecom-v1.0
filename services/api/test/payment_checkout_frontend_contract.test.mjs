import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const checkoutDrawer = fs.readFileSync(
  new URL('../../../apps/samara-web/my-vite-react-app/src/components/CheckoutDrawer.jsx', import.meta.url),
  'utf8'
);
const checkoutTransport = fs.readFileSync(
  new URL('../../../apps/samara-web/my-vite-react-app/src/services/perfectFitCheckout.js', import.meta.url),
  'utf8'
);
const checkoutFacade = fs.readFileSync(
  new URL('../../../apps/samara-web/my-vite-react-app/src/services/api.js', import.meta.url),
  'utf8'
);
const checkoutPath = fs.readFileSync(
  new URL('../../../apps/samara-web/my-vite-react-app/src/services/publicCheckoutPath.js', import.meta.url),
  'utf8'
);

test('Perfect Fit checkout uses the governed EIP public-commerce transport', () => {
  assert.match(checkoutDrawer, /fetchPerfectFitPaymentMethods/);
  assert.match(checkoutDrawer, /createPerfectFitOrder/);
  assert.match(checkoutDrawer, /createPerfectFitPaymentSession/);
  assert.match(checkoutDrawer, /fetchPerfectFitPaymentSession/);
  assert.match(checkoutDrawer, /confirmPerfectFitPaymentSession/);
  assert.match(checkoutDrawer, /cancelPerfectFitPaymentSession/);

  assert.match(checkoutTransport, /buildSuffixAwareCheckoutPath/);
  assert.match(checkoutTransport, /X-API-Key|apiKeyHeader/);
  assert.match(checkoutTransport, /X-Event-Id|eventIdHeader/);
  assert.match(checkoutTransport, /credentials/);
  assert.match(checkoutTransport, /\/checkout\/payment-methods/);
  assert.match(checkoutTransport, /\/checkout\/payment-session/);
  assert.match(checkoutTransport, /\/checkout\/confirm/);
  assert.doesNotMatch(checkoutTransport, /\?suffix=/);

  assert.match(checkoutFacade, /Network authority remains `perfectFitCheckout`/);
  assert.match(checkoutFacade, /fetchPaymentMethods = fetchPerfectFitPaymentMethods/);
  assert.match(checkoutPath, /\/api\/public\/commerce\//);
  assert.match(checkoutPath, /CONNECTION_SUFFIX_REQUIRED/);
});

test('Perfect Fit renders only governed available payment methods and keeps provider identity', () => {
  assert.match(checkoutDrawer, /item\?\.enabled !== false/);
  assert.match(checkoutDrawer, /item\?\.available !== false/);
  assert.match(checkoutDrawer, /item\?\.visible !== false/);
  assert.match(checkoutDrawer, /\.filter\(\(item\) => item\.code && item\.enabled && item\.available && item\.visible\)/);
  assert.match(checkoutDrawer, /key=\{`\$\{method\.provider_code\}-\$\{method\.code\}`\}/);
  assert.match(checkoutDrawer, /method\.provider_code \|\| 'EIP provider'/);
  assert.match(checkoutDrawer, /No governed payment method is currently available/);
  assert.doesNotMatch(checkoutDrawer, /enabled_methods:\s*\[\s*['"]card['"]\s*\]/);
});

test('Perfect Fit does not collect or submit raw card credentials', () => {
  assert.doesNotMatch(checkoutDrawer, /cardNumber|card_number|cardCvc|card_cvc|\bcvc\b|\bcvv\b/i);
  assert.doesNotMatch(checkoutTransport, /cardNumber|card_number|cardCvc|card_cvc|\bcvc\b|\bcvv\b/i);
  assert.doesNotMatch(checkoutDrawer, /type=['"]password['"][^>]*(card|cvc|cvv)/i);
  assert.match(checkoutDrawer, /paymentMethod/);
});

test('Perfect Fit confirms purchase only from EIP payment lifecycle state', () => {
  assert.match(checkoutDrawer, /const PAID_STATES = new Set\(\['paid', 'partially_refunded', 'refunded'\]\)/);
  assert.match(checkoutDrawer, /PAID_STATES\.has\(getPaymentState\(result\)\)/);
  assert.match(checkoutDrawer, /provider_session_id: providerSessionId/);
  assert.match(checkoutDrawer, /eip_payment_status/);
  assert.match(checkoutDrawer, /eip_payment_code/);
  assert.match(checkoutDrawer, /Payment is not yet verified/);
  assert.match(checkoutDrawer, /Payment verified by EIP/);
});

test('provider redirects remain HTTPS-only and cart clearing stays download-gated', () => {
  assert.match(checkoutDrawer, /url\.protocol === 'https:'/);
  assert.match(checkoutDrawer, /resolveDigitalDownloadUrl/);
  assert.match(checkoutDrawer, /downloadedItemIds/);
  assert.match(checkoutDrawer, /cartClearedAfterDownloads/);
  assert.match(checkoutDrawer, /onClearCart/);
  assert.doesNotMatch(checkoutDrawer, /onClearCart\?\.\(\)[\s\S]{0,120}finalizePaidOrder/);
});
