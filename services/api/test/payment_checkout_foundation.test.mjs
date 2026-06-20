import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildPaymentConnectionHealth,
  buildPaymentReadiness,
  buildPublicCheckoutConfig,
  buildPublicPaymentMethods,
  getPaymentAdapter,
  normalizePaymentMethodCode,
  normalizePaymentSettings,
  resolvePaymentMethodContext,
  sanitizePaymentMetadata
} from "../src/services/payments/paymentFoundation.js";
import { PAYMENT_CONNECTION_TYPES } from "../src/services/gateway/connectionProfile.js";

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
const paymentConnectionsMigration = fs.readFileSync(
  new URL("../db/migrations/0131_payment_connections_v1.sql", import.meta.url),
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
      { code: "app", label: "Wallet", enabled: true },
      { code: "apple_pay", label: "Apple Pay", enabled: true }
    ],
    providers: {
      card: { mode: "sandbox", public_key: "pk_test_secret-ish" },
      app: { mode: "sandbox", app_id: "merchant-id" }
    }
  });
  assert.equal(normalizePaymentMethodCode("app_pay"), "google_pay");
  assert.equal(normalizePaymentMethodCode("apple_pay"), "apple_pay");
  assert.equal(settings.methods.some((item) => item.code === "google_pay"), true);
  assert.equal(settings.methods.some((item) => item.code === "apple_pay"), true);
  assert.equal(settings.providers.card.provider_code, "checkout_com");
  assert.equal(settings.providers.apple_pay.provider_code, "checkout_com");
  assert.equal(settings.providers.card.environment, "sandbox");
  assert.equal("public_key" in settings.providers.card, false);
  assert.equal("app_id" in settings.providers.google_pay, false);
});

test("payment readiness and public checkout config expose only secret-free provider state", () => {
  const settings = normalizePaymentSettings({
    methods: [
      { code: "card", label: "Card", enabled: true },
      { code: "paypal", label: "PayPal", enabled: true },
      { code: "google_pay", label: "Google Pay", enabled: true },
      { code: "apple_pay", label: "Apple Pay", enabled: true },
      { code: "manual_test", label: "Sandbox", enabled: true }
    ],
    providers: {
      card: { provider_code: "checkout_com", environment: "sandbox" },
      paypal: { provider_code: "paypal", environment: "sandbox" },
      google_pay: { provider_code: "checkout_com", environment: "sandbox" },
      apple_pay: { provider_code: "checkout_com", environment: "sandbox" },
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
    outbound: { auth: { secret_set: true } },
    routing: { provider_code: "checkout_com", health_status: "healthy", apple_pay_domain_status: "validated" },
    verification: { api_key: { secret: "do-not-leak" } }
  }];
  const readiness = buildPaymentReadiness({ settings, profiles });
  assert.equal(readiness.methods.find((item) => item.code === "card").available, true);
  assert.equal(readiness.methods.find((item) => item.code === "paypal").available, false);
  assert.equal(readiness.methods.find((item) => item.code === "google_pay").available, true);
  assert.equal(readiness.methods.find((item) => item.code === "apple_pay").available, true);
  assert.equal(readiness.methods.find((item) => item.code === "manual_test").available, true);

  const publicConfig = buildPublicCheckoutConfig({ settings, profiles });
  const serialized = JSON.stringify(publicConfig);
  assert.match(serialized, /checkout_com/);
  assert.doesNotMatch(serialized, /do-not-leak|secret|public_key|client_id|app_id/i);
  assert.deepEqual(publicConfig.ready_methods.sort(), ["apple_pay", "card", "google_pay", "manual_test"]);

  const publicMethods = buildPublicPaymentMethods({ settings, profiles });
  assert.deepEqual(publicMethods.map((item) => item.methodCode).sort(), ["APPLE_PAY", "CARD", "GOOGLE_PAY", "PAYPAL"]);
  assert.equal(publicMethods.find((item) => item.methodCode === "PAYPAL").reason, "provider_not_configured");
  assert.doesNotMatch(JSON.stringify(publicMethods), /manual_test|do-not-leak|secret|client_secret/i);
});

test("payment method priority and connection health are metadata driven and secret-free", () => {
  const settings = normalizePaymentSettings({
    methods: [
      { code: "card", label: "Card", enabled: true },
      { code: "paypal", label: "PayPal", enabled: true },
      { code: "google_pay", label: "Google Pay", enabled: true },
      { code: "apple_pay", label: "Apple Pay", enabled: true },
      { code: "manual_test", label: "Sandbox", enabled: true }
    ],
    display_order: ["paypal", "card", "google_pay", "apple_pay", "manual_test"],
    providers: {
      card: { provider_code: "checkout_com", environment: "sandbox" },
      paypal: { provider_code: "paypal", environment: "sandbox" },
      google_pay: { provider_code: "checkout_com", environment: "sandbox" },
      apple_pay: { provider_code: "checkout_com", environment: "sandbox" },
      manual_test: { provider_code: "manual_test", environment: "sandbox" }
    }
  });
  const profiles = [
    {
      identity: { connection_code: "checkout-sandbox", connection_kind: "checkout_com", environment: "sandbox", is_enabled: true },
      outbound: { auth: { secret: "sk_test_never_expose" } },
      routing: { provider_code: "checkout_com", health_status: "healthy", apple_pay_domain_status: "validated" },
      verification: { hmac_signature: { secret_set: true } }
    },
    {
      identity: { connection_code: "paypal-sandbox", connection_kind: "paypal", environment: "sandbox", is_enabled: true },
      outbound: { auth: { client_id: "paypal-client-ref", client_secret: "paypal-secret-never-expose" } },
      routing: { provider_code: "paypal", health_status: "healthy" },
      verification: { hmac_signature: { webhook_id_ref: "paypal-webhook-ref" } }
    }
  ];

  const readiness = buildPaymentReadiness({ settings, profiles });
  assert.deepEqual(readiness.methods.map((item) => item.code), ["paypal", "card", "google_pay", "apple_pay", "manual_test"]);
  assert.deepEqual(buildPublicPaymentMethods({ settings, profiles }).map((item) => item.methodCode), [
    "PAYPAL",
    "CARD",
    "GOOGLE_PAY",
    "APPLE_PAY"
  ]);

  const health = buildPaymentConnectionHealth({ settings, profiles });
  const paypal = health.find((item) => item.provider === "PAYPAL");
  const checkout = health.find((item) => item.provider === "CHECKOUT_COM");
  assert.equal(paypal.mode, "sandbox");
  assert.equal(paypal.health, "healthy");
  assert.equal(paypal.webhook_state, "configured");
  assert.deepEqual(paypal.available_methods, ["PAYPAL"]);
  assert.equal(checkout.configured, true);
  assert.deepEqual(checkout.available_methods, ["CARD", "GOOGLE_PAY", "APPLE_PAY"]);
  assert.doesNotMatch(JSON.stringify(health), /sk_test_never_expose|paypal-secret-never-expose/);
});

test("payment connection health reports missing secrets, disabled providers, and optional warnings safely", () => {
  const settings = normalizePaymentSettings({
    methods: [
      { code: "card", label: "Card", enabled: true },
      { code: "paypal", label: "PayPal", enabled: true },
      { code: "apple_pay", label: "Apple Pay", enabled: true }
    ],
    providers: {
      card: { provider_code: "checkout_com", environment: "sandbox" },
      paypal: { provider_code: "paypal", environment: "sandbox" },
      apple_pay: { provider_code: "checkout_com", environment: "sandbox" }
    }
  });
  const health = buildPaymentConnectionHealth({
    settings,
    profiles: [
      {
        identity: { connection_code: "checkout-sandbox", connection_kind: "checkout_com", environment: "sandbox", is_enabled: true },
        outbound: { auth: {} },
        routing: { provider_code: "checkout_com", health_status: "pending" },
        verification: { hmac_signature: {} }
      },
      {
        identity: { connection_code: "paypal-sandbox", connection_kind: "paypal", environment: "sandbox", is_enabled: false },
        outbound: { auth: { client_id: "paypal-client-ref" } },
        routing: { provider_code: "paypal", health_status: "healthy" },
        verification: { hmac_signature: {} }
      }
    ]
  });

  const checkout = health.find((item) => item.provider === "CHECKOUT_COM");
  const paypal = health.find((item) => item.provider === "PAYPAL");
  assert.equal(checkout.health, "not_ready");
  assert.equal(checkout.webhook_state, "missing");
  assert.equal(checkout.missing_requirements.includes("sandbox_credentials"), true);
  assert.equal(checkout.missing_requirements.includes("apple_pay_domain_validation"), true);
  assert.equal(checkout.warnings.includes("webhook_signing_secret_missing"), true);
  assert.equal(paypal.enabled, false);
  assert.equal(paypal.missing_requirements.includes("provider_enabled"), true);
  assert.equal(paypal.missing_requirements.includes("sandbox_credentials"), true);
  assert.doesNotMatch(JSON.stringify(health), /client_secret|secret_ref|raw_secret/);
});

test("payment connection provider types are registered as existing Admin Console Connections kinds", () => {
  assert.equal(PAYMENT_CONNECTION_TYPES.PAYPAL.provider_code, "paypal");
  assert.equal(PAYMENT_CONNECTION_TYPES.PAYPAL.connection_kind, "paypal");
  assert.deepEqual(PAYMENT_CONNECTION_TYPES.PAYPAL.supported_payment_methods, ["PAYPAL"]);
  assert.equal(PAYMENT_CONNECTION_TYPES.CHECKOUT_COM.provider_code, "checkout_com");
  assert.equal(PAYMENT_CONNECTION_TYPES.CHECKOUT_COM.connection_kind, "checkout_com");
  assert.deepEqual(PAYMENT_CONNECTION_TYPES.CHECKOUT_COM.supported_payment_methods, ["CARD", "GOOGLE_PAY", "APPLE_PAY"]);
  assert.match(JSON.stringify(PAYMENT_CONNECTION_TYPES), /required_secret_fields|outbound\.auth/);
  assert.match(JSON.stringify(PAYMENT_CONNECTION_TYPES), /required_sandbox_fields|apple_pay_domain_status/);
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
    error: "provider_not_configured"
  });
  assert.deepEqual(await paypal.createCheckoutSession({}), {
    ok: false,
    error: "provider_not_configured"
  });
});

test("payment sandbox readiness distinguishes provider, credential, health, domain, and disabled states", () => {
  const settings = normalizePaymentSettings({
    methods: [
      { code: "card", label: "Card", enabled: true },
      { code: "paypal", label: "PayPal", enabled: true },
      { code: "google_pay", label: "Google Pay", enabled: true },
      { code: "apple_pay", label: "Apple Pay", enabled: true }
    ],
    providers: {
      card: { provider_code: "checkout_com", environment: "sandbox" },
      paypal: { provider_code: "paypal", environment: "sandbox" },
      google_pay: { provider_code: "checkout_com", environment: "sandbox" },
      apple_pay: { provider_code: "checkout_com", environment: "sandbox" }
    }
  });

  const missingProvider = buildPublicPaymentMethods({ settings, profiles: [] });
  assert.equal(missingProvider.find((item) => item.methodCode === "PAYPAL").reason, "provider_not_configured");
  assert.equal(missingProvider.find((item) => item.methodCode === "GOOGLE_PAY").reason, "provider_not_configured");

  const checkoutMissingSecret = buildPublicPaymentMethods({
    settings,
    profiles: [{
      identity: { connection_code: "checkout-sandbox", connection_kind: "checkout_com", environment: "sandbox", is_enabled: true },
      outbound: { auth: {} },
      routing: { provider_code: "checkout_com", health_status: "healthy", apple_pay_domain_status: "validated" }
    }]
  });
  assert.equal(checkoutMissingSecret.find((item) => item.methodCode === "CARD").reason, "sandbox_credentials_missing");

  const checkoutNoDomain = buildPublicPaymentMethods({
    settings,
    profiles: [{
      identity: { connection_code: "checkout-sandbox", connection_kind: "checkout_com", environment: "sandbox", is_enabled: true },
      outbound: { auth: { secret_set: true } },
      routing: { provider_code: "checkout_com", health_status: "healthy" }
    }]
  });
  assert.equal(checkoutNoDomain.find((item) => item.methodCode === "CARD").available, true);
  assert.equal(checkoutNoDomain.find((item) => item.methodCode === "GOOGLE_PAY").available, true);
  assert.equal(checkoutNoDomain.find((item) => item.methodCode === "APPLE_PAY").reason, "domain_validation_missing");

  const healthUnknown = buildPublicPaymentMethods({
    settings,
    profiles: [{
      identity: { connection_code: "checkout-sandbox", connection_kind: "checkout_com", environment: "sandbox", is_enabled: true },
      outbound: { auth: { secret_set: true } },
      routing: { provider_code: "checkout_com", health_status: "pending", apple_pay_domain_status: "validated" }
    }]
  });
  assert.equal(healthUnknown.find((item) => item.methodCode === "CARD").reason, "provider_health_unknown");

  const disabled = buildPublicPaymentMethods({
    settings: normalizePaymentSettings({
      ...settings,
      methods: [{ code: "paypal", label: "PayPal", enabled: false }]
    }),
    profiles: [{
      identity: { connection_code: "paypal-sandbox", connection_kind: "paypal", environment: "sandbox", is_enabled: true },
      outbound: { auth: { client_id: "paypal-client-ref", client_secret_set: true } },
      routing: { provider_code: "paypal", health_status: "healthy" }
    }]
  });
  assert.equal(disabled.find((item) => item.methodCode === "PAYPAL").reason, "payment_method_disabled");
});

test("payment sandbox session and webhook foundations fail closed without trusted setup", async () => {
  const settings = normalizePaymentSettings({
    methods: [{ code: "paypal", label: "PayPal", enabled: true }],
    providers: { paypal: { provider_code: "paypal", environment: "sandbox" } }
  });
  const profiles = [{
    identity: { connection_code: "paypal-sandbox", connection_kind: "paypal", environment: "sandbox", is_enabled: true },
    outbound: { auth: { client_id: "paypal-client-ref" } },
    routing: { provider_code: "paypal", health_status: "healthy" }
  }];
  const context = resolvePaymentMethodContext({ settings, profiles, method: "paypal" });
  assert.equal(context.ok, false);
  assert.equal(context.reason, "sandbox_credentials_missing");
  assert.match(publicCommerceRoute, /checkout_source_missing/);
  assert.match(publicCommerceRoute, /browser_amount_not_accepted/);
  assert.match(publicCommerceRoute, /methodContext\.reason/);

  const paypal = getPaymentAdapter("paypal");
  assert.deepEqual(await paypal.createCheckoutSession({ connectionProfile: profiles[0], method: "paypal" }), {
    ok: false,
    error: "sandbox_credentials_missing"
  });
  assert.deepEqual(await paypal.verifyWebhookSignature({ connectionProfile: profiles[0] }), {
    ok: false,
    error: "webhook_signing_secret_missing"
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
  assert.match(publicCommerceRoute, /"\/checkout\/payment-methods"/);
  assert.match(publicCommerceRoute, /"\/checkout\/payment-health"/);
  assert.match(publicCommerceRoute, /"\/checkout\/payment-session"/);
  assert.match(publicCommerceRoute, /"\/payments\/webhooks\/:provider"/);
  assert.match(publicCommerceRoute, /browser_amount_not_accepted/);
  assert.match(publicCommerceRoute, /pricing_snapshot/);
  assert.match(publicCommerceRoute, /buildPublicPaymentMethods/);
  assert.match(publicCommerceRoute, /buildPaymentConnectionHealth/);
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/checkout\/confirm"/);
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/payments\/:provider\/webhook"/);
  assert.match(publicCommerceRoute, /paymentWebhookEventId\(provider, body, req\)/);
  assert.match(publicCommerceRoute, /ensureIdempotency/);
  assert.match(publicCommerceRoute, /finalizeIdempotency/);
  assert.match(publicCommerceRoute, /sanitizePaymentMetadata/);
  assert.doesNotMatch(publicCommerceRoute, /normalizeProviderMode/);
  assert.match(commerceOrdersRoute, /connection_health/);
  assert.match(commerceOrdersRoute, /"\/commerce\/payments"/);
  assert.match(commerceOrdersRoute, /ECOM_PAYMENT_CAPTURE/);
  assert.match(commerceOrdersRoute, /CRM_PAYMENT_SIGNAL/);

  assert.match(samaraApi, /\/checkout\/session/);
  assert.match(samaraApi, /fetchPaymentMethods/);
  assert.match(samaraApi, /\/checkout\/payment-methods/);
  assert.match(samaraApi, /\/checkout\/payment-session/);
  assert.match(samaraApi, /\/checkout\/confirm/);
  assert.doesNotMatch(samaraApp, /amount: paymentAmount/);
  assert.doesNotMatch(samaraApp, /selectedPaymentMethod === "card"/);
  assert.match(samaraApp, /paymentMethodApplePay/);
  assert.match(samaraApp, /sandbox_credentials_missing/);
  assert.match(samaraApp, /domain_validation_missing/);
  assert.match(samaraApp, /paymentUnavailableExplanation/);
  assert.match(samaraApp, /unavailable because sandbox credentials are missing/);
  assert.match(samaraApp, /unavailable because domain validation has not been completed/);
  assert.match(samaraApp, /friendlyCheckoutError/);
  assert.match(samaraApp, /No raw card details are collected by EIP/);
});

test("admin connection UI exposes payment sandbox setup without raw secret display after save", () => {
  const adminConnections = fs.readFileSync(
    new URL("../../../apps/dashboard/src/components/admin/AdminConnectionsPanelSafe.jsx", import.meta.url),
    "utf8"
  );
  assert.match(adminConnections, /PayPal sandbox setup/);
  assert.match(adminConnections, /Checkout\.com sandbox setup/);
  assert.match(adminConnections, /Client secret reference/);
  assert.match(adminConnections, /Secret key reference/);
  assert.match(adminConnections, /Webhook signing secret/);
  assert.match(adminConnections, /Apple Pay domain status/);
  assert.match(adminConnections, /Raw secret values are never displayed after save/);
  assert.match(adminConnections, /paymentConnectionCardState/);
  assert.match(adminConnections, /PAYMENT_CARD_TONE_CLASS/);
  assert.match(adminConnections, /Webhook \{formatCardStatus\(paymentCard\.webhook\)\}/);
  assert.match(adminConnections, /Methods \{paymentCard\.methods\}/);
  assert.match(adminConnections, /apple pay domain missing/);
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
  assert.match(dashboardSettings, /Priority/);
  assert.match(dashboardSettings, /display_order/);
  assert.match(dashboardSettings, /updatePaymentMethodPriority/);
  assert.match(dashboardSettings, /orderPaymentSettingsMethods/);
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
  assert.doesNotMatch(paymentConnectionsMigration, /CREATE\s+TABLE/i);
  assert.match(paymentConnectionsMigration, /0131_payment_connections_v1/);
  assert.match(paymentConnectionsMigration, /apple_pay/);
  assert.match(paymentConnectionsMigration, /EIP_CONNECTION_KIND/);
  assert.match(paymentConnectionsMigration, /checkout_com/);
  assert.match(paymentConnectionsMigration, /paypal/);

  assert.match(dashboardOrdersPanel, /title: "Orders & payments"/);
  assert.match(dashboardOrdersPanel, /\{ id: "payments", label: "Payments"/);
  assert.doesNotMatch(dashboardOrdersPanel, /payment-readiness/);
  assert.doesNotMatch(dashboardOrdersPanel, /Provider secrets stay in Admin Console/);
});
