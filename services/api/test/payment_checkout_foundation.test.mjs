import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildPaymentReadiness,
  buildPublicCheckoutConfig,
  buildPublicPaymentMethods,
  getPaymentAdapter,
  PAYMENT_READINESS_STATES,
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
import { persistConnectionTestHealth } from "../src/services/gateway/connectionHealth.js";
import { buildSuffixAwareCheckoutPath } from "../../../apps/samara-web/my-vite-react-app/src/services/publicCheckoutPath.js";

const publicCommerceRoute = fs.readFileSync(
  new URL("../src/routes/public_commerce.js", import.meta.url),
  "utf8"
);
const paypalAdapterSource = fs.readFileSync(
  new URL("../src/services/payments/paypalAdapter.js", import.meta.url),
  "utf8"
);
const commerceOrdersRoute = fs.readFileSync(
  new URL("../src/routes/commerce_orders.js", import.meta.url),
  "utf8"
);
const gatewayRoute = fs.readFileSync(
  new URL("../src/routes/gateway.js", import.meta.url),
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
    routing: { provider_code: "checkout_com", health_status: "healthy", provider_available: true, last_successful_test_at: "2026-06-30T08:00:00.000Z", apple_pay_domain_status: "validated" },
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
      health_status: "healthy",
      provider_available: true,
      last_successful_test_at: "2026-06-30T08:00:00.000Z"
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

  paypal.outbound.auth.client_id = "sandbox-business@example.com";
  assert.match(validateProfiles([paypal]).join("\n"), /PayPal REST app Client ID/);
  paypal.outbound.auth.client_id = "paypal-client-reference";

  const websiteWithoutSuffix = normalizeProfile({
    id: "website-no-suffix",
    identity: {
      connection_name: "Website",
      connection_code: "website-no-suffix",
      connection_kind: "website",
      direction: "inbound",
      environment: "sandbox",
      frontend_url: "https://store.example"
    },
    verification: { mode: "none" },
    idempotency: { event_id_location: "header", event_id_key: "X-Event-Id" },
    routing: { channel: "website_intake" }
  });
  assert.match(validateProfiles([websiteWithoutSuffix]).join("\n"), /inbound_path_suffix required/);

  paypal.inbound.webhook_enabled = true;
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
      direction: "outbound",
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
      direction: "outbound",
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
      routing: { channel: "payments", provider_code: "paypal", health_status: "healthy", provider_available: true, last_successful_test_at: "2026-06-30T08:00:00.000Z", supported_payment_methods: ["PAYPAL"] }
    },
    {
      identity: { connection_code: "checkout-live", connection_kind: "checkout_com", environment: "production", is_enabled: true },
      outbound: { auth: { secret_set: true } },
      routing: { channel: "payments", provider_code: "checkout_com", health_status: "healthy", provider_available: true, last_successful_test_at: "2026-06-30T08:00:00.000Z", apple_pay_domain_status: "validated", supported_payment_methods: ["CARD", "GOOGLE_PAY", "APPLE_PAY"] },
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

test("payment readiness implements NOT_CONFIGURED, CONFIGURED, HEALTHY, UNHEALTHY, and DISABLED", () => {
  const settings = normalizePaymentSettings({
    provider_registry: [{
      code: "paypal",
      enabled: true,
      visible: true,
      methods: [{ code: "paypal", enabled: true, visible: true }]
    }]
  });
  const baseProfile = {
    identity: {
      connection_code: "p-conn",
      connection_kind: "paypal",
      environment: "sandbox",
      is_enabled: true
    },
    outbound: { auth: { client_id: "paypal-client-id", client_secret_set: true } },
    routing: {
      channel: "payments",
      provider_code: "paypal",
      health_status: "pending",
      provider_available: false,
      supported_payment_methods: ["PAYPAL"]
    }
  };
  const providerState = (profiles, stateSettings = settings) =>
    buildPaymentReadiness({ settings: stateSettings, profiles }).providers.find((provider) => provider.code === "paypal");

  const notConfigured = providerState([]);
  assert.equal(notConfigured.readiness_state, PAYMENT_READINESS_STATES.NOT_CONFIGURED);
  assert.equal(notConfigured.available, false);
  assert.equal(notConfigured.status_label, "Not configured");

  const configured = providerState([baseProfile]);
  assert.equal(configured.readiness_state, PAYMENT_READINESS_STATES.CONFIGURED);
  assert.equal(configured.available, false);
  assert.equal(configured.status_label, "Awaiting health verification");

  const healthy = providerState([{
    ...baseProfile,
    routing: {
      ...baseProfile.routing,
      health_status: "healthy",
      provider_available: true,
      last_successful_test_at: "2026-07-01T08:00:00.000Z"
    }
  }]);
  assert.equal(healthy.readiness_state, PAYMENT_READINESS_STATES.HEALTHY);
  assert.equal(healthy.available, true);
  assert.equal(healthy.status_label, "Healthy");

  const unhealthy = providerState([{
    ...baseProfile,
    routing: {
      ...baseProfile.routing,
      health_status: "unhealthy",
      health_checked_at: "2026-07-01T08:05:00.000Z",
      health_error: "OAUTH_TOKEN_FAILED"
    }
  }]);
  assert.equal(unhealthy.readiness_state, PAYMENT_READINESS_STATES.UNHEALTHY);
  assert.equal(unhealthy.available, false);
  assert.equal(unhealthy.status_label, "Connection failed");

  const disabled = providerState([{
    ...baseProfile,
    identity: { ...baseProfile.identity, is_enabled: false }
  }]);
  assert.equal(disabled.readiness_state, PAYMENT_READINESS_STATES.DISABLED);
  assert.equal(disabled.available, false);
  assert.equal(disabled.status_label, "Provider Disabled");

  const providerDisabled = providerState([baseProfile], normalizePaymentSettings({
    provider_registry: [{
      code: "paypal",
      enabled: false,
      visible: true,
      methods: [{ code: "paypal", enabled: true, visible: true }]
    }]
  }));
  assert.equal(providerDisabled.readiness_state, PAYMENT_READINESS_STATES.DISABLED);
});

test("auto-matched enabled PayPal connections do not inherit synthetic disabled defaults", () => {
  const settings = normalizePaymentSettings({
    provider_registry: [{
      code: "checkout_com",
      enabled: true,
      visible: true,
      methods: [{ code: "card", enabled: true, visible: true }]
    }]
  });
  const readiness = buildPaymentReadiness({
    settings,
    profiles: [{
      identity: {
        connection_code: "p-conn",
        connection_name: "PayPal",
        connection_kind: "paypal",
        environment: "sandbox",
        is_enabled: true
      },
      outbound: { auth: { client_id: "paypal-client-id", client_secret_set: true } },
      routing: {
        channel: "payments",
        provider_code: "paypal",
        health_status: "healthy",
        provider_available: true,
        last_successful_test_at: "2026-07-01T08:00:00.000Z",
        supported_payment_methods: ["PAYPAL"],
        payment_provider: { code: "paypal", methods: [{ code: "PAYPAL" }] }
      }
    }]
  });
  const paypal = readiness.providers.find((provider) => provider.code === "paypal");
  assert.equal(paypal.connection_code, "p-conn");
  assert.equal(paypal.enabled, true);
  assert.equal(paypal.methods[0].enabled, true);
  assert.equal(paypal.readiness_state, PAYMENT_READINESS_STATES.HEALTHY);
  assert.equal(paypal.available, true);
});

test("payment adapters fail closed when unconfigured and allow manual_test sandbox only", async () => {
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

test("PayPal adapter creates an approval session and captures it without exposing credentials", async (t) => {
  const originalFetch = global.fetch;
  const requests = [];
  let rejectCreate = false;
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "server-only-access-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (String(url).endsWith("/v2/checkout/orders")) {
      if (rejectCreate) {
        return new Response(JSON.stringify({ details: [{ issue: "INSTRUMENT_DECLINED" }] }), {
          status: 422,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({
        id: "PAYPAL-ORDER-1",
        status: "PAYER_ACTION_REQUIRED",
        links: [{
          rel: "payer-action",
          href: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-1",
          method: "GET"
        }]
      }), { status: 201, headers: { "Content-Type": "application/json" } });
    }
    if (String(url).endsWith("/v2/checkout/orders/PAYPAL-ORDER-1/capture")) {
      return new Response(JSON.stringify({
        id: "PAYPAL-ORDER-1",
        status: "COMPLETED",
        purchase_units: [{ payments: { captures: [{ id: "PAYPAL-CAPTURE-1", status: "COMPLETED" }] } }]
      }), { status: 201, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`Unexpected PayPal request: ${url}`);
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const profile = normalizeProfile({
    id: "paypal-runtime",
    identity: {
      connection_name: "PayPal",
      connection_code: "paypal-runtime",
      connection_kind: "paypal",
      direction: "outbound",
      environment: "sandbox",
      is_enabled: true
    },
    outbound: {
      base_url: "https://203.0.113.10",
      path_prefix: "/",
      timeout_ms: 1000,
      auth_mode: "oauth2_client_credentials",
      auth: {
        client_id: "paypal-client-id",
        client_secret: "paypal-client-secret",
        token_url: "https://203.0.113.10/v1/oauth2/token",
        client_auth_method: "basic"
      }
    },
    routing: {
      channel: "payments",
      provider_code: "paypal",
      health_status: "healthy",
      provider_available: true,
      health_checked_at: "2026-07-02T08:00:00.000Z",
      last_successful_test_at: "2026-07-02T08:00:00.000Z",
      supported_payment_methods: ["PAYPAL"]
    }
  });
  const paypal = getPaymentAdapter("paypal");
  const created = await paypal.createCheckoutSession({
    connectionProfile: profile,
    environment: "sandbox",
    paymentCode: "PAY-100",
    amount: 19.5,
    currency: "USD",
    captureMode: "automatic",
    returnUrl: "https://shop.example/?eip_payment_status=approved&eip_payment_code=PAY-100",
    cancelUrl: "https://shop.example/?eip_payment_status=cancelled&eip_payment_code=PAY-100"
  });
  assert.equal(created.ok, true);
  assert.equal(created.session.provider_session_id, "PAYPAL-ORDER-1");
  assert.equal(created.session.client_action, "redirect");
  assert.equal(created.session.redirect_url, "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-1");

  const orderRequest = requests.find((request) => request.url.endsWith("/v2/checkout/orders"));
  assert.equal(orderRequest.options.headers.Authorization, "Bearer server-only-access-token");
  assert.equal(orderRequest.options.headers["PayPal-Request-Id"], "PAY-100");
  assert.doesNotMatch(orderRequest.options.body, /paypal-client-secret|server-only-access-token/);
  const orderBody = JSON.parse(orderRequest.options.body);
  assert.equal(orderBody.intent, "CAPTURE");
  assert.equal(orderBody.purchase_units[0].amount.value, "19.50");
  assert.equal(orderBody.payment_source.paypal.experience_context.user_action, "PAY_NOW");

  const confirmed = await paypal.confirmCheckoutSession({
    connectionProfile: profile,
    providerSessionId: "PAYPAL-ORDER-1",
    paymentCode: "PAY-100",
    captureMode: "automatic"
  });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.event.status, "paid");
  assert.equal(confirmed.event.provider_event_id, "PAYPAL-CAPTURE-1");

  rejectCreate = true;
  const failed = await paypal.createCheckoutSession({
    connectionProfile: profile,
    environment: "sandbox",
    paymentCode: "PAY-101",
    amount: 10,
    currency: "USD",
    captureMode: "automatic",
    returnUrl: "https://shop.example/return",
    cancelUrl: "https://shop.example/cancel"
  });
  assert.deepEqual(failed, { ok: false, error: "PAYPAL_ORDER_CREATE_FAILED_422" });
  assert.doesNotMatch(JSON.stringify(failed), /paypal-client-secret|INSTRUMENT_DECLINED/);
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
      routing: { provider_code: "checkout_com", health_status: "healthy", provider_available: true, last_successful_test_at: "2026-06-30T08:00:00.000Z" },
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
  assert.equal(healthUnknown.find((item) => item.methodCode === "CARD").reason, "awaiting_health_verification");

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

test("successful outbound test persists healthy state used by Tenant Dashboard and checkout", async () => {
  const checkedAt = "2026-06-30T08:30:00.000Z";
  const state = {
    attrs: {
      connection_profiles: [{
        id: "paypal-health",
        identity: {
          connection_name: "PayPal",
          connection_code: "paypal-health",
          connection_kind: "paypal",
          direction: "outbound",
          environment: "sandbox",
          is_enabled: true
        },
        outbound: {
          base_url: "https://api-m.sandbox.paypal.com",
          auth_mode: "oauth2_client_credentials",
          auth: { client_id: "paypal-client-id", client_secret_set: true }
        },
        routing: {
          channel: "payments",
          provider_code: "paypal",
          health_status: "pending",
          provider_available: false,
          supported_payment_methods: ["PAYPAL"]
        }
      }]
    }
  };
  const db = {
    async query(sql, params) {
      if (/^SELECT attrs/.test(sql.trim())) {
        return { rowCount: 1, rows: [{ attrs: state.attrs }] };
      }
      if (/^UPDATE eip_core\.tenant/.test(sql.trim())) {
        state.attrs.connection_profiles = JSON.parse(params[1]);
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const connection = await persistConnectionTestHealth(db, "tenant-1", "paypal-health", {
    ok: true,
    checkedAt,
    mode: "sandbox"
  });
  assert.equal(connection.routing.health_status, "healthy");
  assert.equal(connection.routing.provider_available, true);
  assert.equal(connection.routing.health_mode, "sandbox");
  assert.equal(connection.routing.health_checked_at, checkedAt);
  assert.equal(connection.routing.last_successful_test_at, checkedAt);

  const settings = normalizePaymentSettings({
    provider_registry: [{
      code: "paypal",
      label: "PayPal",
      enabled: true,
      visible: true,
      priority: 10,
      methods: [{ code: "paypal", label: "PayPal", enabled: true, visible: true, priority: 10 }]
    }]
  });
  const profiles = state.attrs.connection_profiles.map((profile) => normalizeProfile(profile, profile.id));
  const dashboardReadiness = buildPaymentReadiness({ settings, profiles });
  assert.equal(dashboardReadiness.providers[0].available, true);
  assert.equal(dashboardReadiness.providers[0].status, "healthy");
  assert.equal(dashboardReadiness.providers[0].readiness_state, PAYMENT_READINESS_STATES.HEALTHY);
  assert.equal(dashboardReadiness.methods[0].available, true);
  const storefrontMethod = buildPublicPaymentMethods({ settings, profiles })[0];
  assert.equal(storefrontMethod.readinessState, dashboardReadiness.methods[0].readiness_state);
  assert.equal(storefrontMethod.statusLabel, dashboardReadiness.methods[0].status_label);
  assert.equal(storefrontMethod.available, true);
  assert.deepEqual(buildPublicCheckoutConfig({ settings, profiles }).ready_methods, ["paypal"]);
});

test("failed outbound test persists unhealthy state and removes checkout availability", async () => {
  const previousSuccess = "2026-06-30T08:30:00.000Z";
  const failedAt = "2026-06-30T08:45:00.000Z";
  const state = {
    attrs: {
      connection_profiles: [{
        id: "paypal-health",
        identity: {
          connection_name: "PayPal",
          connection_code: "paypal-health",
          connection_kind: "paypal",
          direction: "outbound",
          environment: "sandbox",
          is_enabled: true
        },
        outbound: { auth: { client_id: "paypal-client-id", client_secret_set: true } },
        routing: {
          channel: "payments",
          provider_code: "paypal",
          health_status: "healthy",
          provider_available: true,
          last_successful_test_at: previousSuccess,
          supported_payment_methods: ["PAYPAL"]
        }
      }]
    }
  };
  const db = {
    async query(sql, params) {
      if (/^SELECT attrs/.test(sql.trim())) return { rowCount: 1, rows: [{ attrs: state.attrs }] };
      if (/^UPDATE eip_core\.tenant/.test(sql.trim())) {
        state.attrs.connection_profiles = JSON.parse(params[1]);
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const connection = await persistConnectionTestHealth(db, "tenant-1", "paypal-health", {
    ok: false,
    checkedAt: failedAt,
    mode: "sandbox",
    error: "OAUTH_TOKEN_FAILED"
  });
  assert.equal(connection.routing.health_status, "unhealthy");
  assert.equal(connection.routing.provider_available, false);
  assert.equal(connection.routing.health_checked_at, failedAt);
  assert.equal(connection.routing.last_successful_test_at, previousSuccess);
  assert.equal(connection.routing.health_error, "OAUTH_TOKEN_FAILED");

  const settings = normalizePaymentSettings({
    provider_registry: [{
      code: "paypal",
      enabled: true,
      visible: true,
      methods: [{ code: "paypal", enabled: true, visible: true }]
    }]
  });
  const profiles = state.attrs.connection_profiles.map((profile) => normalizeProfile(profile, profile.id));
  const dashboardReadiness = buildPaymentReadiness({ settings, profiles });
  assert.equal(dashboardReadiness.providers[0].available, false);
  assert.equal(dashboardReadiness.providers[0].status, "connection_failed");
  assert.equal(dashboardReadiness.providers[0].readiness_state, PAYMENT_READINESS_STATES.UNHEALTHY);
  const storefrontMethod = buildPublicPaymentMethods({ settings, profiles })[0];
  assert.equal(storefrontMethod.readinessState, PAYMENT_READINESS_STATES.UNHEALTHY);
  assert.equal(storefrontMethod.statusLabel, "Connection failed");
  assert.equal(storefrontMethod.available, false);
  assert.deepEqual(buildPublicCheckoutConfig({ settings, profiles }).ready_methods, []);
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
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/checkout\/payment-session"/);
  assert.match(publicCommerceRoute, /"\/payments\/webhooks\/:provider"/);
  assert.match(publicCommerceRoute, /browser_amount_not_accepted/);
  assert.match(publicCommerceRoute, /pricing_snapshot/);
  assert.match(publicCommerceRoute, /buildPublicPaymentMethods/);
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/checkout\/confirm"/);
  assert.match(publicCommerceRoute, /"\/commerce\/:suffix\/payments\/:provider\/webhook"/);
  assert.match(publicCommerceRoute, /hydrateConnectionProfileSecrets\(app, app\.db, access\.tenant\.id, providerProfile\)/);
  assert.match(publicCommerceRoute, /provider_connection_code/);
  assert.match(publicCommerceRoute, /PAYMENT_PROVIDER_SESSION_MISMATCH/);
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
  assert.match(samaraApp, /status_label/);
  assert.match(samaraApp, /readiness_label/);
  assert.match(samaraApp, /friendlyCheckoutError/);
  assert.match(samaraApp, /trustedPaypalRedirectUrl/);
  assert.match(samaraApp, /window\.open\("about:blank", "_blank"\)/);
  assert.match(samaraApp, /checkoutTab\.opener = null/);
  assert.match(samaraApp, /providerCheckoutWindow\.location\.replace\(redirectUrl\)/);
  assert.match(samaraApp, /PayPal checkout opened in a new tab/);
  assert.ok(
    samaraApp.indexOf("const providerCheckoutWindow = usesPaypal ? openPaypalCheckoutTab() : null") <
      samaraApp.indexOf("const result = await createOrder({ payload })"),
    "PayPal tab must be reserved before asynchronous order creation"
  );
  assert.match(samaraApp, /window\.location\.assign\(redirectUrl\)/);
  assert.match(samaraApp, /eip_payment_status/);
  assert.match(samaraApp, /provider_session_id: providerSessionId/);
  assert.match(samaraApp, /No raw card details are collected by EIP/);
  assert.match(samaraApp, /const DEFAULT_CHECKOUT_METHODS = \[\]/);
  assert.match(samaraApp, /item\.available !== false/);
  assert.doesNotMatch(samaraApp, /enabled_methods:\s*\["card"\]/);
  assert.match(paypalAdapterSource, /\/v2\/checkout\/orders/);
  assert.match(paypalAdapterSource, /PayPal-Request-Id/);
  assert.doesNotMatch(paypalAdapterSource, /console\.log|client_secret\s*:/);
});

test("Samara checkout builds suffix-aware payment endpoints without legacy suffix query calls", () => {
  const endpoint = "https://eip-ecom-v1.up.railway.app/api/public/commerce/samara";
  const paymentSession = buildSuffixAwareCheckoutPath(endpoint, "/checkout/payment-session");
  const paymentMethods = buildSuffixAwareCheckoutPath(endpoint, "/checkout/payment-methods");

  assert.equal(
    paymentSession,
    "https://eip-ecom-v1.up.railway.app/api/public/commerce/samara/checkout/payment-session"
  );
  assert.equal(
    paymentMethods,
    "https://eip-ecom-v1.up.railway.app/api/public/commerce/samara/checkout/payment-methods"
  );
  assert.doesNotMatch(paymentSession, /\/api\/public\/checkout\/payment-session\?suffix=/);
  assert.doesNotMatch(paymentMethods, /\/api\/public\/checkout\/payment-methods\?suffix=/);
  assert.throws(
    () => buildSuffixAwareCheckoutPath("https://eip-ecom-v1.up.railway.app/api/public", "/checkout/payment-session"),
    /CONNECTION_SUFFIX_REQUIRED/
  );
  assert.match(samaraApi, /buildSuffixAwareCheckoutPath/);
  assert.doesNotMatch(samaraApi, /nextParams\.suffix|rootPath.*\/api\/public/);
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
  assert.match(adminConnections, /Last successful test/);
  assert.doesNotMatch(adminConnections, /health_status === "healthy"\) patch\.health_status = "pending"/);
  assert.doesNotMatch(adminConnections, /localStorage.*client_secret|localStorage.*secret key/i);
  assert.match(gatewayRoute, /persistConnectionTestHealth/);
  assert.match(gatewayRoute, /PayPal OAuth token acquired successfully[\s\S]*connection/);
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
  assert.match(dashboardSettings, /status_label/);
  assert.doesNotMatch(dashboardSettings, /formatStatus\(readiness\?\.|formatStatus\(methodReadiness\?\./);
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
