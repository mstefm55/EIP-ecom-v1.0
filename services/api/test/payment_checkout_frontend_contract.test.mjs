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
  assert.match(checkoutTransport, /apiKeyHeader|X-API-Key/);
  assert.match(checkoutTransport, /eventIdHeader|X-Event-Id/);
  assert.match(checkoutTransport, /credentials/);
  assert.match(checkoutTransport, /\/checkout\/payment-methods/);
  assert.match(checkoutTransport, /\/checkout\/payment-session/);
  assert.match(checkoutTransport, /\/checkout\/confirm/);
  assert.doesNotMatch(checkoutTransport, /\?suffix=/);

  assert.match(checkoutFacade, /Network authority remains `perfectFitCheckout`/);
  assert.match(checkoutFacade, /fetchPaymentMethods\s*=\s*fetchPerfectFitPaymentMethods/);
  assert.match(checkoutPath, /\/api\/public\/commerce\//);
  assert.match(checkoutPath, /CONNECTION_SUFFIX_REQUIRED/);
});

test('Perfect Fit normalizes the EIP public payment-method contract before rendering', () => {
  assert.match(
    checkoutTransport,
    /code:\s*item\?\.code\s*\|\|\s*item\?\.methodCode\s*\|\|\s*item\?\.method\s*\|\|\s*item\?\.id/
  );
  assert.match(
    checkoutTransport,
    /provider_code:\s*item\?\.provider_code\s*\|\|\s*item\?\.providerCode/
  );
});

test('Perfect Fit renders only governed available payment methods and preserves provider identity', () => {
  assert.match(checkoutDrawer, /enabled:\s*item\?\.enabled !== false/);
  assert.match(checkoutDrawer, /available:\s*item\?\.available !== false/);
  assert.match(checkoutDrawer, /visible:\s*item\?\.visible !== false/);
  assert.match(
    checkoutDrawer,
    /\.filter\(\(item\) => item\.code && item\.enabled && item\.available && item\.visible\)/
  );
  assert.match(checkoutDrawer, /method\.provider_code \|\| 'EIP provider'/);
  assert.match(checkoutDrawer, /No governed payment method is currently available/);
  assert.doesNotMatch(checkoutDrawer, /enabled_methods:\s*\[\s*['"]card['"]\s*\]/);
});

test('Perfect Fit never collects or submits raw card credentials', () => {
  assert.doesNotMatch(checkoutDrawer, /name=["'](?:cardNumber|card_number|cardCVC|card_cvc|cvc|cvv)["']/i);
  assert.doesNotMatch(checkoutTransport, /\b(?:cardNumber|card_number|cardCVC|card_cvc|cvc|cvv)\b/i);
  assert.match(checkoutDrawer, /Perfect Fit does not authorize payments or store raw card details/);
});

test('Perfect Fit confirms purchase only from verified EIP payment lifecycle state', () => {
  assert.match(checkoutDrawer, /PAID_STATES\s*=\s*new Set\(\['paid', 'partially_refunded', 'refunded'\]\)/);
  assert.match(checkoutDrawer, /PAID_STATES\.has\(getPaymentState\(result\)\)/);
  assert.match(checkoutDrawer, /provider_session_id:\s*providerSessionId \|\| undefined/);
  assert.match(checkoutDrawer, /eip_payment_status/);
  assert.match(checkoutDrawer, /eip_payment_code/);
  assert.match(checkoutDrawer, /Payment is not yet verified/);
  assert.match(checkoutDrawer, /Payment verified by EIP/);
});

test('provider redirects remain HTTPS-only and cart clearing stays download-gated', () => {
  assert.match(checkoutDrawer, /url\.protocol === 'https:'/);
  assert.match(checkoutDrawer, /window\.location\.assign\(redirectUrl\)/);
  assert.match(checkoutDrawer, /resolveDigitalDownloadUrl/);
  assert.match(checkoutDrawer, /nextDownloadedIds/);
  assert.match(checkoutDrawer, /allDownloadsComplete/);
  assert.match(
    checkoutDrawer,
    /if \(allDownloadsComplete && !cartClearedAfterDownloads\) \{[\s\S]*?onClearCart\?\.\(\);/
  );
});
