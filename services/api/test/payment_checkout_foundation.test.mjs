import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildPaymentReadiness,
  buildPublicCheckoutConfig,
  buildPublicPaymentMethods,
  getPaymentAdapter,
  normalizePaymentMethodCode,
  normalizePaymentSettings,
  registerPaymentAdapter,
  resolvePaymentMethodContext,
  sanitizePaymentMetadata
} from "../src/services/payments/paymentFoundation.js";
import {
  PAYMENT_CONNECTION_TYPES,
  maskSecrets,
  normalizeProfile,
  validateProfiles
} from "../src/services/gateway/connectionProfile.js";

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
    public_storefront: { google_pay_enabled: true },
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

test("payment provider registry supports dynamic count, visibility, priority, and registered methods", () => {
  registerPaymentAdapter("future_pay", {
    async createCheckoutSession() {
      return { ok: false, error: "FUTURE_PAY_NOT_IMPLEMENTED" };
    }
  });
  const settings = normalizePaymentSettings({
    provider_registry: [
      {
        code: "hidden_pay",
        label: "Hidden Pay",
        enabled: true,
        visible: false,
        priority: 1,
        methods: [{ code: "hidden_method", label: "Hidden", enabled: true, visible: true, priority: 1 }]
      },
      {
        code: "future_pay",
        label: "Future Pay",
        enabled: true,
        visible: true,
        priority: 5,
        methods: [{ code: "bank_transfer", label: "Bank transfer", enabled: true, visible: true, priority: 7 }]
      }
    ]
  });
  const profiles = [{
    identity: {
      connection_code: "future-pay-live",
      connection_name: "Future Pay",
      connection_kind: "payments",
      environment: "production",
      is_enabled: true
    },
    outbound: { auth: {} },
    routing: {
      channel: "payments",
      provider_code: "future_pay",
      supported_payment_methods: ["BANK_TRANSFER"],
      health_status: "healthy"
    }
  }];

  const readiness = buildPaymentReadiness({ settings, profiles });
  assert.equal(readiness.providers.length, 2);
  assert.equal(readiness.providers[0].code, "hidden_pay");
  assert.equal(readiness.methods.find((method) => method.code === "bank_transfer").available, true);

  const publicConfig = buildPublicCheckoutConfig({ settings, profiles });
  assert.deepEqual(publicConfig.providers.map((provider) => provider.code), ["future_pay"]);
  assert.deepEqual(publicConfig.methods.map((method) => method.code), ["bank_transfer"]);
  assert.equal(publicConfig.methods[0].provider_code, "future_pay");
  assert.equal(publicConfig.methods[0].provider_priority, 5);
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
  assert.deepEqual(PAYMENT_CONNECTION_TYPES.PAYPAL.required_secret_fields, ["outbound.auth.client_secret"]);
  assert.deepEqual(PAYMENT_CONNECTION_TYPES.CHECKOUT_COM.required_secret_fields, ["outbound.auth.secret"]);
});

test("payment profiles do not require inbound suffix or webhook fields until webhook setup is configured", () => {
  const paypal = normalizeProfile({
    id: "paypal-no-webhook",
    identity: {
      connection_name: "PayPal",
      connection_code: "paypal-no-webhook",
      connection_kind: "paypal",
      direction: "outbound",
      environment: "sandbox"
    },
    outbound: {
      base_url: "https://api-m.sandbox.paypal.com",
      path_prefix: "/",
      auth_mode: "oauth2_client_credentials",
      auth: { client_id: "paypal-client-reference", client_secret: "paypal-client-secret" }
    },
    verification: { mode: "none", hmac_signature: {} }
  });
  const checkout = normalizeProfile({
    id: "checkout-no-webhook",
    identity: {
      connection_name: "Checkout.com",
      connection_code: "checkout-no-webhook",
      connection_kind: "checkout_com",
      direction: "outbound",
      environment: "sandbox"
    },
    outbound: {
      base_url: "https://api.sandbox.checkout.com",
      path_prefix: "/",
      auth_mode: "api_key_header",
      auth: { header_name: "Authorization", secret: "checkout-secret-key" }
    },
    verification: { mode: "none", hmac_signature: {} }
  });

  assert.deepEqual(validateProfiles([paypal, checkout]), []);

  paypal.identity.direction = "both";
  paypal.verification.hmac_signature.webhook_id_ref = "paypal-webhook-reference";
  assert.match(validateProfiles([paypal]).join("\n"), /inbound_path_suffix required when payment webhook is configured/);
});

test("gateway connection profile metadata supports PayPal and Checkout.com without changing Website profiles", () => {
  const website = normalizeProfile({
    id: "website-profile",
    identity: {
      connection_name: "Website",
      connection_code: "website-main",
      connection_kind: "website",
      direction: "inbound",
      environment: "sandbox",
      frontend_url: "https://store.example"
    },
    inbound: {
      inbound_path_suffix: "store-main",
      origin_allowlist: ["https://store.example"]
    },
    verification: { mode: "none" },
    idempotency: { event_id_location: "header", event_id_key: "X-Event-Id", idempotency_scope: "connection" },
    routing: { channel: "website_intake" }
  });
  const paypal = normalizeProfile({
    id: "paypal-profile",
    identity: {
      connection_name: "PayPal",
      connection_code: "paypal-sandbox",
      connection_kind: "paypal",
      direction: "both",
      environment: "sandbox",
      is_enabled: true
    },
    inbound: { inbound_path_suffix: "paypal-sandbox" },
    verification: {
      mode: "none",
      hmac_signature: { webhook_id_ref: "paypal-webhook-ref", secret: "paypal-webhook-secret" }
    },
    idempotency: { event_id_location: "header", event_id_key: "paypal-transmission-id", idempotency_scope: "connection" },
    outbound: {
      base_url: "https://api-m.sandbox.paypal.com",
      path_prefix: "/",
      auth_mode: "oauth2_client_credentials",
      auth: {
        client_id: "paypal-client-ref",
        client_secret: "paypal-client-secret",
        token_url: "https://api-m.sandbox.paypal.com/v1/oauth2/token"
      }
    },
    routing: {
      channel: "payments",
      provider_code: "paypal",
      protocol: "paypal",
      health_status: "healthy",
      supported_payment_methods: ["PAYPAL"],
      payment_provider: {
        code: "paypal",
        label: "PayPal",
        enabled: true,
        visible: true,
        priority: 20,
        methods: [{ code: "PAYPAL", enabled: true, visible: true, priority: 10 }],
        secret: "must-not-survive-normalization"
      }
    },
    public_storefront: { scan_allowed: false, loader_enabled: false, public_api_enabled: false }
  });
  const checkout = normalizeProfile({
    id: "checkout-profile",
    identity: {
      connection_name: "Checkout.com",
      connection_code: "checkout-sandbox",
      connection_kind: "checkout_com",
      direction: "both",
      environment: "sandbox",
      is_enabled: true
    },
    inbound: { inbound_path_suffix: "checkout-sandbox" },
    verification: { mode: "none", hmac_signature: { secret: "checkout-webhook-secret" } },
    idempotency: { event_id_location: "header", event_id_key: "cko-request-id", idempotency_scope: "connection" },
    outbound: {
      base_url: "https://api.sandbox.checkout.com",
      path_prefix: "/",
      auth_mode: "api_key_header",
      auth: { header_name: "Authorization", secret: "checkout-secret-key", public_key_ref: "checkout-public-ref" }
    },
    routing: {
      channel: "payments",
      provider_code: "checkout_com",
      protocol: "checkout_com",
      health_status: "healthy",
      apple_pay_domain_status: "validated",
      supported_payment_methods: ["CARD", "GOOGLE_PAY", "APPLE_PAY"]
    },
    public_storefront: {
      scan_allowed: false,
      loader_enabled: false,
      public_api_enabled: false,
      google_pay_enabled: true,
      apple_pay_domain_status: "validated"
    }
  });

  assert.deepEqual(validateProfiles([website, paypal, checkout]), []);
  assert.equal(website.identity.connection_kind, "website");
  assert.equal(website.routing.channel, "website_intake");
  assert.deepEqual(paypal.routing.supported_payment_methods, ["PAYPAL"]);
  assert.deepEqual(checkout.routing.supported_payment_methods, ["CARD", "GOOGLE_PAY", "APPLE_PAY"]);
  assert.equal(checkout.public_storefront.google_pay_enabled, true);
  assert.equal("secret" in paypal.routing.payment_provider, false);

  const masked = JSON.stringify([maskSecrets(paypal), maskSecrets(checkout)]);
  assert.doesNotMatch(masked, /paypal-client-secret|paypal-webhook-secret|checkout-secret-key|checkout-webhook-secret/);
  assert.match(masked, /client_secret_set|secret_set/);
});

test("commerce readiness distinguishes missing and configured Gateway payment profiles", () => {
  const settings = normalizePaymentSettings({
    methods: [
      { code: "card", enabled: true },
      { code: "paypal", enabled: true },
      { code: "google_pay", enabled: true },
      { code: "apple_pay", enabled: true }
    ]
  });
  const missing = buildPaymentReadiness({ settings, profiles: [] });
  assert.equal(missing.methods.find((method) => method.code === "paypal").reason, "provider_not_configured");
  assert.equal(missing.methods.find((method) => method.code === "card").reason, "provider_not_configured");

  const profiles = [
    {
      identity: { connection_code: "paypal-live", connection_kind: "paypal", environment: "production", is_enabled: true },
      outbound: { auth: { client_id: "paypal-client-ref", client_secret_set: true } },
      routing: { channel: "payments", provider_code: "paypal", health_status: "healthy", supported_payment_methods: ["PAYPAL"] }
    },
    {
      identity: { connection_code: "checkout-live", connection_kind: "checkout_com", environment: "production", is_enabled: true },
      outbound: { auth: { secret_set: true } },
      routing: { channel: "payments", provider_code: "checkout_com", health_status: "healthy", apple_pay_domain_status: "validated", supported_payment_methods: ["CARD", "GOOGLE_PAY", "APPLE_PAY"] },
      public_storefront: { google_pay_enabled: true, apple_pay_domain_status: "validated" }
    }
  ];
  const configured = buildPaymentReadiness({ settings, profiles });
  assert.equal(configured.providers.find((provider) => provider.code === "paypal").connection_code, "paypal-live");
  assert.equal(configured.methods.find((method) => method.code === "paypal").available, true);
  assert.equal(configured.methods.find((method) => method.code === "card").available, true);
  assert.equal(configured.methods.find((method) => method.code === "google_pay").available, true);
  assert.equal(configured.methods.find((method) => method.code === "apple_pay").available, true);
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
      routing: { provider_code: "checkout_com", health_status: "healthy" },
      public_storefront: { google_pay_enabled: true }
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
  assert.match(publicCommerceRoute, /"\/checkout\/payment-session"/);
  assert.match(publicCommerceRoute, /"\/payments\/webhooks\/:provider"/);
  assert.match(publicCommerceRoute, /browser_amount_not_accepted/);
  assert.match(publicCommerceRoute, /pricing_snapshot/);
  assert.match(publicCommerceRoute, /buildPublicPaymentMethods/);
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/checkout\/confirm"/);
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/payments\/:provider\/webhook"/);
  assert.doesNotMatch(publicCommerceRoute, /normalizeProviderMode/);
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
  assert.match(samaraApp, /friendlyCheckoutError/);
  assert.match(samaraApp, /No raw card details are collected by EIP/);
  assert.match(samaraApp, /const DEFAULT_CHECKOUT_METHODS = \[\]/);
  assert.match(samaraApp, /item\.available !== false/);
  assert.doesNotMatch(samaraApp, /enabled_methods:\s*\["card"\]/);
});

test("admin connection UI exposes payment sandbox setup without raw secret display after save", () => {
  const adminConnections = fs.readFileSync(
    new URL("../../../apps/dashboard/src/components/admin/AdminConnectionsPanelSafe.jsx", import.meta.url),
    "utf8"
  );
  assert.match(adminConnections, /Gateway Connection Profiles/);
  assert.match(adminConnections, /PayPal provider setup/);
  assert.match(adminConnections, /Checkout\.com provider setup/);
  assert.match(adminConnections, /Provider name/);
  assert.match(adminConnections, /Client secret reference \/ status/);
  assert.match(adminConnections, /Secret key reference \/ status/);
  assert.match(adminConnections, /Webhook signing secret reference/);
  assert.match(adminConnections, /Apple Pay domain validation status/);
  assert.match(adminConnections, /Google Pay enabled metadata/);
  assert.match(adminConnections, /Supported payment methods/);
  assert.match(adminConnections, /No payment provider connection configured/);
  assert.match(adminConnections, /Raw secret values are never displayed after save/);
  assert.doesNotMatch(adminConnections, /localStorage.*client_secret|localStorage.*secret key/i);
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
  assert.match(dashboardSettings, /No payment provider connection configured/);
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
  assert.match(paymentConnectionsMigration, /p_value text/);
  assert.doesNotMatch(paymentConnectionsMigration, /ensure_jsonb_text_item\(source jsonb, value text\)/);

  assert.match(dashboardOrdersPanel, /title: "Orders & payments"/);
  assert.match(dashboardOrdersPanel, /\{ id: "payments", label: "Payments"/);
  assert.doesNotMatch(dashboardOrdersPanel, /payment-readiness/);
  assert.doesNotMatch(dashboardOrdersPanel, /Provider secrets stay in Admin Console/);
});
