import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildPaymentReadiness,
  buildPublicCheckoutConfig,
  getPaymentAdapter,
  normalizePaymentMethodCode,
  normalizePaymentSettings,
  sanitizePaymentMetadata
} from "../src/services/payments/paymentFoundation.js";

const publicCommerceRoute = fs.readFileSync(
  new URL("../src/routes/public_commerce.js", import.meta.url),
  "utf8"
);
const commerceOrdersRoute = fs.readFileSync(
  new URL("../src/routes/commerce_orders.js", import.meta.url),
  "utf8"
);
const migration = fs.readFileSync(
  new URL("../db/migrations/0106_payment_checkout_foundation.sql", import.meta.url),
  "utf8"
);
const settingsOwnershipMigration = fs.readFileSync(
  new URL("../db/migrations/0107_payment_settings_surface_ownership.sql", import.meta.url),
  "utf8"
);
const samaraApi = fs.readFileSync(
  new URL("../../../apps/samara-web/my-vite-react-app/src/services/api.js", import.meta.url),
  "utf8"
);
const samaraApp = fs.readFileSync(
  new URL("../../../apps/samara-web/my-vite-react-app/src/App.jsx", import.meta.url),
  "utf8"
);
const dashboardSettings = fs.readFileSync(
  new URL("../../../apps/dashboard/src/components/ecom/EcomCommerceSettingsPanel.jsx", import.meta.url),
  "utf8"
);
const dashboardOrdersPanel = fs.readFileSync(
  new URL("../../../apps/dashboard/src/components/ecom/EcomOrderManagementPanel.jsx", import.meta.url),
  "utf8"
);
const dashboardSurface = fs.readFileSync(
  new URL("../../../apps/dashboard/src/engine/surfaces/dashboard.js", import.meta.url),
  "utf8"
);
const dashboardSurfaceSeed = fs.readFileSync(
  new URL("../db/seed/ui_surface_dashboard.sql", import.meta.url),
  "utf8"
);

test("payment settings normalize legacy app wallet to google_pay without preserving secret-like public keys", () => {
  const settings = normalizePaymentSettings({
    methods: [
      { code: "card", label: "Card", enabled: true },
      { code: "app", label: "Wallet", enabled: true }
    ],
    providers: {
      card: { mode: "sandbox", public_key: "pk_test_secret-ish" },
      app: { mode: "sandbox", app_id: "merchant-id" }
    }
  });
  assert.equal(normalizePaymentMethodCode("app_pay"), "google_pay");
  assert.equal(settings.methods.some((item) => item.code === "google_pay"), true);
  assert.equal(settings.providers.card.provider_code, "checkout_com");
  assert.equal(settings.providers.card.environment, "sandbox");
  assert.equal("public_key" in settings.providers.card, false);
  assert.equal("app_id" in settings.providers.google_pay, false);
});

test("payment readiness and public checkout config expose only secret-free provider state", () => {
  const settings = normalizePaymentSettings({
    methods: [
      { code: "card", label: "Card", enabled: true },
      { code: "paypal", label: "PayPal", enabled: true },
      { code: "manual_test", label: "Sandbox", enabled: true }
    ],
    providers: {
      card: { provider_code: "checkout_com", environment: "sandbox" },
      paypal: { provider_code: "paypal", environment: "sandbox" },
      manual_test: { provider_code: "manual_test", environment: "sandbox" }
    }
  });
  const profiles = [{
    identity: {
      connection_code: "checkout-sandbox",
      connection_kind: "checkout_com",
      environment: "sandbox",
      is_enabled: true
    },
    routing: { provider_code: "checkout_com" },
    verification: { api_key: { secret: "do-not-leak" } }
  }];
  const readiness = buildPaymentReadiness({ settings, profiles });
  assert.equal(readiness.methods.find((item) => item.code === "card").available, true);
  assert.equal(readiness.methods.find((item) => item.code === "paypal").available, false);
  assert.equal(readiness.methods.find((item) => item.code === "manual_test").available, true);

  const publicConfig = buildPublicCheckoutConfig({ settings, profiles });
  const serialized = JSON.stringify(publicConfig);
  assert.match(serialized, /checkout_com/);
  assert.doesNotMatch(serialized, /do-not-leak|secret|public_key|client_id|app_id/i);
  assert.deepEqual(publicConfig.ready_methods.sort(), ["card", "manual_test"]);
});

test("payment adapters fail closed for live placeholders and allow manual_test sandbox only", async () => {
  const manual = getPaymentAdapter("manual_test");
  const checkout = getPaymentAdapter("checkout_com");
  const paypal = getPaymentAdapter("paypal");

  const session = await manual.createCheckoutSession({
    environment: "sandbox",
    paymentCode: "PAY-1",
    amount: 12,
    currency: "USD",
    captureMode: "automatic"
  });
  assert.equal(session.ok, true);
  assert.equal(session.session.client_action, "manual_test_confirm");

  const confirm = await manual.confirmCheckoutSession({ environment: "sandbox" });
  assert.equal(confirm.ok, true);
  assert.equal(confirm.event.status, "paid");

  assert.deepEqual(await checkout.createCheckoutSession({}), {
    ok: false,
    error: "CHECKOUT_COM_ADAPTER_NOT_CONFIGURED"
  });
  assert.deepEqual(await paypal.createCheckoutSession({}), {
    ok: false,
    error: "PAYPAL_ADAPTER_NOT_CONFIGURED"
  });
});

test("payment metadata sanitizer strips raw payment credentials and keeps safe card display data", () => {
  const sanitized = sanitizePaymentMetadata({
    authorization: "Bearer x",
    api_key: "key",
    card: {
      number: "4111111111111111",
      cvc: "123",
      brand: "Visa",
      last4: "1111"
    },
    nested: { password: "secret", ok: "yes" }
  });
  assert.equal(sanitized.authorization, undefined);
  assert.equal(sanitized.api_key, undefined);
  assert.deepEqual(sanitized.card, { brand: "Visa", card_last4: "1111" });
  assert.deepEqual(sanitized.nested, { ok: "yes" });
});

test("payment routes and storefront integration expose governed checkout sessions without raw card collection", () => {
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/checkout\/session"/);
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/checkout\/confirm"/);
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/payments\/:provider\/webhook"/);
  assert.doesNotMatch(publicCommerceRoute, /normalizeProviderMode/);
  assert.match(commerceOrdersRoute, /"\/commerce\/payments"/);
  assert.match(commerceOrdersRoute, /ECOM_PAYMENT_CAPTURE/);
  assert.match(commerceOrdersRoute, /CRM_PAYMENT_SIGNAL/);

  assert.match(samaraApi, /\/checkout\/session/);
  assert.match(samaraApi, /\/checkout\/confirm/);
  assert.doesNotMatch(samaraApp, /selectedPaymentMethod === "card"/);
  assert.match(samaraApp, /No raw card details are collected by EIP/);
});

test("payment governance migration is additive and keeps future clones on role/template metadata", () => {
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i);
  assert.match(migration, /ECOM_PAYMENT_METHOD/);
  assert.match(migration, /ECOM_PAYMENT_STATUS/);
  assert.match(migration, /ECOM_PAYMENT_CONNECTOR_READ/);
  assert.match(migration, /role_template_permission/);
  assert.match(migration, /tenant_module_setting/);
  assert.match(migration, /PAYMENT_FAILED_FOLLOW_UP/);
  assert.match(migration, /MANUAL_PAYMENT_REVIEW/);
  assert.match(migration, /"payments":true/);
});

test("dashboard payment settings no longer render raw provider credential fields", () => {
  assert.doesNotMatch(dashboardSettings, /public_key|client_id|app_id/);
  assert.match(dashboardSettings, /payment-readiness/);
  assert.match(dashboardSettings, /Provider secrets stay in Admin Console/);
  assert.match(dashboardSettings, /Commerce \/ Payments/);
  assert.match(dashboardSettings, /Configured/);
  assert.match(dashboardSettings, /Available/);
  assert.match(dashboardSettings, /Capture mode/);
  assert.match(dashboardSettings, /Default currency/);
  assert.match(dashboardSettings, /Dashboard > Orders & Payments > Payments/);
});

test("payment settings are descriptor-owned by Settings, not the operational payments workspace", () => {
  assert.match(dashboardSurface, /id: "commerce-payment-settings"/);
  assert.match(dashboardSurface, /type: "EcomCommerceSettingsPanel"/);
  assert.match(dashboardSurface, /placement: "settings"/);
  assert.match(dashboardSurface, /capability: "payments"/);
  assert.match(dashboardSurface, /title: "Commerce \/ Payments"/);
  assert.match(dashboardSurfaceSeed, /"id": "commerce-payment-settings"/);
  assert.match(dashboardSurfaceSeed, /"placement": "settings"/);
  assert.match(settingsOwnershipMigration, /patch_payment_settings_surface_node/);
  assert.match(settingsOwnershipMigration, /"id": "commerce-payment-settings"/);
  assert.doesNotMatch(settingsOwnershipMigration, /CREATE\s+TABLE/i);

  assert.match(dashboardOrdersPanel, /title: "Orders & payments"/);
  assert.match(dashboardOrdersPanel, /\{ id: "payments", label: "Payments"/);
  assert.doesNotMatch(dashboardOrdersPanel, /payment-readiness/);
  assert.doesNotMatch(dashboardOrdersPanel, /Provider secrets stay in Admin Console/);
});
