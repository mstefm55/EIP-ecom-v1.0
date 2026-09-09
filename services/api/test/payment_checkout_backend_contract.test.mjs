import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const publicCommerceRoute = fs.readFileSync(
  new URL("../src/routes/public_commerce.js", import.meta.url),
  "utf8"
);
const commerceOrdersRoute = fs.readFileSync(
  new URL("../src/routes/commerce_orders.js", import.meta.url),
  "utf8"
);
const paypalAdapterSource = fs.readFileSync(
  new URL("../src/services/payments/paypalAdapter.js", import.meta.url),
  "utf8"
);

test("EIP checkout routes remain governed, verified, replay-safe, and provider-backed", () => {
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/checkout\/session"/);
  assert.match(publicCommerceRoute, /"\/checkout\/payment-methods"/);
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/checkout\/payment-session"/);
  assert.match(publicCommerceRoute, /"\/payments\/webhooks\/:provider"/);
  assert.match(publicCommerceRoute, /browser_amount_not_accepted/);
  assert.match(publicCommerceRoute, /pricing_snapshot/);
  assert.match(publicCommerceRoute, /buildPublicPaymentMethods/);
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/checkout\/confirm"/);
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/payments\/:provider\/webhook"/);
  assert.match(
    publicCommerceRoute,
    /hydrateConnectionProfileSecrets\(app, app\.db, access\.tenant\.id, providerProfile\)/
  );
  assert.match(publicCommerceRoute, /provider_connection_code/);
  assert.match(publicCommerceRoute, /PAYMENT_PROVIDER_SESSION_MISMATCH/);
  assert.doesNotMatch(publicCommerceRoute, /normalizeProviderMode/);

  assert.match(commerceOrdersRoute, /"\/commerce\/payments"/);
  assert.match(commerceOrdersRoute, /ECOM_PAYMENT_CAPTURE/);
  assert.match(commerceOrdersRoute, /CRM_PAYMENT_SIGNAL/);

  assert.match(publicCommerceRoute, /applyVerifiedPaymentLifecycle/);
  assert.match(
    publicCommerceRoute,
    /initialOrderStatus = checkoutPaymentMethod \? "pending_payment" : "new"/
  );
  assert.match(publicCommerceRoute, /PAYMENT_WEBHOOK_DISABLED/);
  assert.match(publicCommerceRoute, /matched: Boolean\(payment\)/);

  const webhookStart = publicCommerceRoute.indexOf("const handlePaymentWebhook");
  const webhookReplay = publicCommerceRoute.indexOf("if (idem.replay)", webhookStart);
  const webhookApply = publicCommerceRoute.indexOf("loadPaymentForProviderEvent", webhookStart);
  assert.ok(
    webhookReplay > webhookStart && webhookReplay < webhookApply,
    "duplicate webhook replay must short-circuit before lifecycle updates"
  );

  assert.match(paypalAdapterSource, /\/v2\/checkout\/orders/);
  assert.match(paypalAdapterSource, /PayPal-Request-Id/);
  assert.doesNotMatch(paypalAdapterSource, /console\.log|client_secret\s*:/);
});
