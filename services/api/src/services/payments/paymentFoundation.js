import crypto from "node:crypto";

const PAYMENT_METHODS = [
  { code: "card", label: "Credit card", provider_code: "checkout_com", enabled: true },
  { code: "paypal", label: "PayPal", provider_code: "paypal", enabled: false },
  { code: "google_pay", label: "Google Pay", provider_code: "checkout_com", enabled: false },
  { code: "manual_test", label: "Sandbox manual test", provider_code: "manual_test", enabled: false }
];

const PROVIDER_CODES = new Set(["checkout_com", "paypal", "manual_test"]);
const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|signature|api[_-]?key|card[_-]?number|pan|cvc|cvv|cryptogram)/i;
const SAFE_CARD_KEYS = new Set(["brand", "card_last4", "last4"]);

export const DEFAULT_PAYMENT_SETTINGS = {
  methods: PAYMENT_METHODS,
  default_currency: "USD",
  capture_mode: "automatic",
  allowed_countries: [],
  display_order: PAYMENT_METHODS.map((item) => item.code),
  refund_approval_threshold: null,
  manual_review_rules: {
    enabled: true,
    high_value_threshold: null
  },
  providers: {
    card: { provider_code: "checkout_com" },
    paypal: { provider_code: "paypal" },
    google_pay: { provider_code: "checkout_com" },
    manual_test: { provider_code: "manual_test", environment: "sandbox" }
  }
};

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return fallback;
  const normalized = normalizeText(value).toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeCurrency(value, fallback = "USD") {
  const normalized = normalizeText(value).toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
}

function normalizeCountryList(value) {
  const source = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      source
        .map((item) => normalizeText(item).toUpperCase())
        .filter((item) => /^[A-Z]{2}$/.test(item))
    )
  );
}

function normalizeOptionalAmount(value) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function normalizePaymentMethodCode(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return "";
  if (["card", "credit_card", "creditcard", "bank_card"].includes(normalized)) return "card";
  if (["paypal", "pay_pal"].includes(normalized)) return "paypal";
  if (["app", "app_pay", "googlepay", "google_pay", "wallet"].includes(normalized)) return "google_pay";
  if (["manual", "manual_test", "test"].includes(normalized)) return "manual_test";
  return normalized;
}

export function normalizePaymentProviderCode(value, method = "") {
  const normalized = normalizeText(value).toLowerCase().replace(/[-.\s]+/g, "_");
  if (["checkout", "checkoutcom", "checkout_com"].includes(normalized)) return "checkout_com";
  if (["paypal", "pay_pal"].includes(normalized)) return "paypal";
  if (["manual", "manual_test", "test"].includes(normalized)) return "manual_test";
  const normalizedMethod = normalizePaymentMethodCode(method);
  if (normalizedMethod === "paypal") return "paypal";
  if (normalizedMethod === "manual_test") return "manual_test";
  if (normalizedMethod === "card" || normalizedMethod === "google_pay") return "checkout_com";
  return PROVIDER_CODES.has(normalized) ? normalized : normalized;
}

export function normalizePaymentEnvironment(value, fallback = "sandbox") {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "production" || normalized === "live") return "production";
  if (normalized === "sandbox" || normalized === "test" || normalized === "manual") return "sandbox";
  return fallback;
}

function normalizeCaptureMode(value, fallback = "automatic") {
  const normalized = normalizeText(value).toLowerCase();
  return ["automatic", "manual"].includes(normalized) ? normalized : fallback;
}

function normalizePaymentMethods(input, fallback = DEFAULT_PAYMENT_SETTINGS.methods) {
  const source = Array.isArray(input) ? input : fallback;
  const fallbackByCode = new Map(PAYMENT_METHODS.map((item) => [item.code, item]));
  const out = [];
  const seen = new Set();

  for (const item of source) {
    if (!item || typeof item !== "object") continue;
    const code = normalizePaymentMethodCode(item.code || item.id || item.method);
    if (!code || seen.has(code)) continue;
    const baseline = fallbackByCode.get(code) || {};
    seen.add(code);
    out.push({
      code,
      label: normalizeText(item.label || baseline.label || code.toUpperCase()),
      enabled: normalizeBoolean(item.enabled, normalizeBoolean(baseline.enabled, false))
    });
  }

  for (const baseline of PAYMENT_METHODS) {
    if (!seen.has(baseline.code)) out.push({ code: baseline.code, label: baseline.label, enabled: baseline.enabled });
  }
  return out;
}

function normalizePaymentProviders(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const out = {};
  for (const method of PAYMENT_METHODS.map((item) => item.code)) {
    const legacyKey = method === "google_pay" ? "app" : method;
    const item = source[method] || source[legacyKey] || {};
    out[method] = {
      provider_code: normalizePaymentProviderCode(item.provider_code || item.provider || "", method),
      connection_code: normalizeText(item.connection_code) || null,
      environment: normalizePaymentEnvironment(item.environment || item.mode, method === "manual_test" ? "sandbox" : "production")
    };
  }
  return out;
}

export function normalizePaymentSettings(input = {}, fallback = DEFAULT_PAYMENT_SETTINGS) {
  const base = fallback && typeof fallback === "object" ? fallback : DEFAULT_PAYMENT_SETTINGS;
  const source = input && typeof input === "object" ? input : {};
  const merged = { ...base, ...source };
  return {
    methods: normalizePaymentMethods(source.methods, base.methods),
    default_currency: normalizeCurrency(merged.default_currency || "USD"),
    capture_mode: normalizeCaptureMode(merged.capture_mode),
    allowed_countries: normalizeCountryList(merged.allowed_countries),
    display_order: Array.from(
      new Set(
        (Array.isArray(merged.display_order) ? merged.display_order : DEFAULT_PAYMENT_SETTINGS.display_order)
          .map(normalizePaymentMethodCode)
          .filter(Boolean)
      )
    ),
    refund_approval_threshold: normalizeOptionalAmount(merged.refund_approval_threshold),
    manual_review_rules: {
      enabled: normalizeBoolean(merged.manual_review_rules?.enabled, true),
      high_value_threshold: normalizeOptionalAmount(merged.manual_review_rules?.high_value_threshold)
    },
    providers: normalizePaymentProviders({ ...(base.providers || {}), ...(source.providers || {}) })
  };
}

function profileProviderCode(profile) {
  return normalizePaymentProviderCode(
    profile?.routing?.provider_code ||
      profile?.routing?.protocol ||
      profile?.identity?.connection_kind ||
      profile?.identity?.connection_code
  );
}

function profileIsEnabled(profile) {
  return Boolean(profile?.identity?.is_enabled !== false);
}

function selectProviderProfile(profiles, providerCode, configuredCode) {
  const source = Array.isArray(profiles) ? profiles : [];
  if (configuredCode) {
    return source.find((profile) => normalizeText(profile?.identity?.connection_code) === configuredCode) || null;
  }
  return (
    source.find((profile) => profileIsEnabled(profile) && profileProviderCode(profile) === providerCode) ||
    null
  );
}

export function buildPaymentReadiness({ settings, profiles = [] } = {}) {
  const normalized = normalizePaymentSettings(settings);
  const methods = normalized.methods.map((method) => {
    const provider = normalized.providers[method.code] || {};
    const providerCode = normalizePaymentProviderCode(provider.provider_code, method.code);
    const profile = providerCode === "manual_test"
      ? null
      : selectProviderProfile(profiles, providerCode, provider.connection_code);
    const available = providerCode === "manual_test"
      ? provider.environment === "sandbox"
      : Boolean(profile && profileIsEnabled(profile));
    const status = available
      ? providerCode === "manual_test"
        ? "sandbox_ready"
        : "configured"
      : "provider_not_configured";

    return {
      code: method.code,
      label: method.label,
      enabled: method.enabled !== false,
      provider_code: providerCode,
      environment: providerCode === "manual_test"
        ? "sandbox"
        : normalizePaymentEnvironment(profile?.identity?.environment || provider.environment, "production"),
      connection_code: profile?.identity?.connection_code || provider.connection_code || null,
      available,
      status,
      wallet: method.code === "google_pay"
    };
  });

  return {
    default_currency: normalized.default_currency,
    capture_mode: normalized.capture_mode,
    allowed_countries: normalized.allowed_countries,
    methods,
    ready_methods: methods.filter((method) => method.enabled && method.available).map((method) => method.code)
  };
}

export function resolvePaymentMethodContext({ settings, profiles = [], method } = {}) {
  const normalizedMethod = normalizePaymentMethodCode(method);
  const readiness = buildPaymentReadiness({ settings, profiles });
  const item = readiness.methods.find((entry) => entry.code === normalizedMethod);
  if (!item || !item.enabled) return { ok: false, error: "PAYMENT_METHOD_DISABLED" };
  if (!item.available) {
    return {
      ok: false,
      error: "PAYMENT_PROVIDER_NOT_CONFIGURED",
      method: item.code,
      provider_code: item.provider_code
    };
  }
  return { ok: true, ...item, readiness };
}

export function sanitizePaymentMetadata(value, depth = 0) {
  if (depth > 6) return null;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizePaymentMetadata(item, depth + 1));
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? value.slice(0, 500) : value;
  }

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = normalizeText(key).toLowerCase();
    if (SENSITIVE_KEY.test(normalizedKey) && !SAFE_CARD_KEYS.has(normalizedKey)) continue;
    if (normalizedKey === "card") {
      const card = item && typeof item === "object" ? item : {};
      out.card = {
        brand: normalizeText(card.brand).slice(0, 32) || null,
        card_last4: normalizeText(card.card_last4 || card.last4).replace(/\D/g, "").slice(-4) || null
      };
      continue;
    }
    out[key] = sanitizePaymentMetadata(item, depth + 1);
  }
  return out;
}

function buildManualTestSession({ paymentCode, amount, currency, captureMode }) {
  return {
    provider_code: "manual_test",
    provider_session_id: `manual-${crypto.randomUUID()}`,
    provider_payment_id: null,
    status: "pending",
    amount,
    currency,
    capture_mode: captureMode,
    redirect_url: null,
    client_action: "manual_test_confirm"
  };
}

const ADAPTERS = {
  manual_test: {
    code: "manual_test",
    async createCheckoutSession(input) {
      if (input.environment !== "sandbox") return { ok: false, error: "MANUAL_TEST_SANDBOX_ONLY" };
      return { ok: true, session: buildManualTestSession(input) };
    },
    async confirmCheckoutSession(input) {
      if (input.environment !== "sandbox") return { ok: false, error: "MANUAL_TEST_SANDBOX_ONLY" };
      return {
        ok: true,
        event: {
          provider_code: "manual_test",
          event_type: "payment_paid",
          status: "paid",
          provider_event_id: `manual-confirm-${crypto.randomUUID()}`
        }
      };
    },
    async capturePayment(input) {
      if (input.environment !== "sandbox") return { ok: false, error: "MANUAL_TEST_SANDBOX_ONLY" };
      return { ok: true, status: "captured" };
    },
    async cancelPayment(input) {
      if (input.environment !== "sandbox") return { ok: false, error: "MANUAL_TEST_SANDBOX_ONLY" };
      return { ok: true, status: "cancelled" };
    },
    async verifyWebhookSignature() {
      return { ok: false, error: "MANUAL_TEST_WEBHOOK_DISABLED" };
    },
    async normalizeWebhookEvent() {
      return { ok: false, error: "MANUAL_TEST_WEBHOOK_DISABLED" };
    },
    async getPaymentStatus(input) {
      return { ok: true, status: input.status || "pending" };
    }
  },
  checkout_com: {
    code: "checkout_com",
    async createCheckoutSession() {
      return { ok: false, error: "CHECKOUT_COM_ADAPTER_NOT_CONFIGURED" };
    },
    async confirmCheckoutSession() {
      return { ok: false, error: "CHECKOUT_COM_CONFIRMATION_NOT_CONFIGURED" };
    },
    async capturePayment() {
      return { ok: false, error: "CHECKOUT_COM_CAPTURE_NOT_CONFIGURED" };
    },
    async cancelPayment() {
      return { ok: false, error: "CHECKOUT_COM_CANCEL_NOT_CONFIGURED" };
    },
    async verifyWebhookSignature() {
      return { ok: false, error: "CHECKOUT_COM_WEBHOOK_NOT_CONFIGURED" };
    },
    async normalizeWebhookEvent() {
      return { ok: false, error: "CHECKOUT_COM_WEBHOOK_NOT_CONFIGURED" };
    },
    async getPaymentStatus() {
      return { ok: false, error: "CHECKOUT_COM_STATUS_NOT_CONFIGURED" };
    }
  },
  paypal: {
    code: "paypal",
    async createCheckoutSession() {
      return { ok: false, error: "PAYPAL_ADAPTER_NOT_CONFIGURED" };
    },
    async confirmCheckoutSession() {
      return { ok: false, error: "PAYPAL_CONFIRMATION_NOT_CONFIGURED" };
    },
    async capturePayment() {
      return { ok: false, error: "PAYPAL_CAPTURE_NOT_CONFIGURED" };
    },
    async cancelPayment() {
      return { ok: false, error: "PAYPAL_CANCEL_NOT_CONFIGURED" };
    },
    async verifyWebhookSignature() {
      return { ok: false, error: "PAYPAL_WEBHOOK_NOT_CONFIGURED" };
    },
    async normalizeWebhookEvent() {
      return { ok: false, error: "PAYPAL_WEBHOOK_NOT_CONFIGURED" };
    },
    async getPaymentStatus() {
      return { ok: false, error: "PAYPAL_STATUS_NOT_CONFIGURED" };
    }
  }
};

export function getPaymentAdapter(providerCode) {
  return ADAPTERS[normalizePaymentProviderCode(providerCode)] || null;
}

export function buildPublicCheckoutConfig({ settings, profiles = [] } = {}) {
  const normalized = normalizePaymentSettings(settings);
  const readiness = buildPaymentReadiness({ settings: normalized, profiles });
  return {
    methods: readiness.methods.map((method) => ({
      code: method.code,
      label: method.label,
      enabled: method.enabled,
      provider_code: method.provider_code,
      available: method.available,
      status: method.status,
      wallet: method.wallet
    })),
    enabled_methods: readiness.methods.filter((method) => method.enabled).map((method) => method.code),
    ready_methods: readiness.ready_methods,
    default_currency: readiness.default_currency,
    capture_mode: readiness.capture_mode,
    allowed_countries: readiness.allowed_countries
  };
}
