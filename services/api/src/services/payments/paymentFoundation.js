import crypto from "node:crypto";
import {
  confirmPaypalCheckoutSession,
  createPaypalCheckoutSession
} from "./paypalAdapter.js";

const DEFAULT_PROVIDER_REGISTRY = [
  {
    code: "checkout_com",
    label: "Checkout.com",
    enabled: true,
    visible: true,
    priority: 10,
    environment: "production",
    methods: [
      { code: "card", label: "Credit card", enabled: true, visible: true, priority: 10 },
      { code: "google_pay", label: "Google Pay", enabled: false, visible: true, priority: 20, wallet: true },
      {
        code: "apple_pay",
        label: "Apple Pay",
        enabled: false,
        visible: true,
        priority: 30,
        wallet: true,
        requirements: { domain_validation: true }
      }
    ]
  },
  {
    code: "paypal",
    label: "PayPal",
    enabled: true,
    visible: true,
    priority: 20,
    environment: "production",
    methods: [
      { code: "paypal", label: "PayPal", enabled: false, visible: true, priority: 10 }
    ]
  },
  {
    code: "manual_test",
    label: "Manual test",
    enabled: false,
    visible: false,
    priority: 1000,
    environment: "sandbox",
    methods: [
      { code: "manual_test", label: "Sandbox manual test", enabled: false, visible: false, priority: 10 }
    ]
  }
];

const PAYMENT_METHODS = DEFAULT_PROVIDER_REGISTRY.flatMap((provider) =>
  provider.methods.map((method) => ({ ...method, provider_code: provider.code }))
);
const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|signature|api[_-]?key|card[_-]?number|pan|cvc|cvv|cryptogram)/i;
const SAFE_CARD_KEYS = new Set(["brand", "card_last4", "last4"]);

export const PAYMENT_READINESS_STATES = Object.freeze({
  NOT_CONFIGURED: "NOT_CONFIGURED",
  CONFIGURED: "CONFIGURED",
  HEALTHY: "HEALTHY",
  UNHEALTHY: "UNHEALTHY",
  DISABLED: "DISABLED"
});

const PAYMENT_READINESS_PRESENTATION = Object.freeze({
  [PAYMENT_READINESS_STATES.NOT_CONFIGURED]: {
    status: "provider_not_configured",
    label: "Not configured"
  },
  [PAYMENT_READINESS_STATES.CONFIGURED]: {
    status: "awaiting_health_verification",
    label: "Awaiting health verification"
  },
  [PAYMENT_READINESS_STATES.HEALTHY]: {
    status: "healthy",
    label: "Healthy"
  },
  [PAYMENT_READINESS_STATES.UNHEALTHY]: {
    status: "connection_failed",
    label: "Connection failed"
  },
  [PAYMENT_READINESS_STATES.DISABLED]: {
    status: "provider_disabled",
    label: "Provider Disabled"
  }
});

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
  provider_registry: DEFAULT_PROVIDER_REGISTRY,
  providers: {
    card: { provider_code: "checkout_com" },
    paypal: { provider_code: "paypal" },
    google_pay: { provider_code: "checkout_com" },
    apple_pay: { provider_code: "checkout_com" },
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

function normalizePriority(value, fallback = 0) {
  const priority = Number(value);
  return Number.isFinite(priority) ? Math.trunc(priority) : fallback;
}

function humanizeCode(value) {
  return normalizeText(value)
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function normalizePaymentMethodCode(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return "";
  if (["card", "credit_card", "creditcard", "bank_card"].includes(normalized)) return "card";
  if (["paypal", "pay_pal"].includes(normalized)) return "paypal";
  if (["applepay", "apple_pay", "apple", "apple_wallet"].includes(normalized)) return "apple_pay";
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
  if (["card", "google_pay", "apple_pay"].includes(normalizedMethod)) return "checkout_com";
  return normalized;
}

export function toPublicPaymentCode(value) {
  const normalized = normalizeText(value).toUpperCase().replace(/[-.\s]+/g, "_");
  if (normalized === "CHECKOUTCOM") return "CHECKOUT_COM";
  return normalized;
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
      enabled: normalizeBoolean(item.enabled, normalizeBoolean(baseline.enabled, false)),
      visible: normalizeBoolean(
        item.visible,
        item.enabled === true ? true : normalizeBoolean(baseline.visible, true)
      ),
      priority: normalizePriority(item.priority, normalizePriority(baseline.priority, (out.length + 1) * 10)),
      wallet: normalizeBoolean(item.wallet, normalizeBoolean(baseline.wallet, false)),
      requirements: item.requirements && typeof item.requirements === "object"
        ? item.requirements
        : baseline.requirements || {}
    });
  }

  for (const baseline of PAYMENT_METHODS) {
    if (!seen.has(baseline.code)) out.push({ ...baseline });
  }
  return out;
}

function normalizeLegacyPaymentProviders(input = {}, methods = PAYMENT_METHODS) {
  const source = input && typeof input === "object" ? input : {};
  const out = {};
  for (const method of methods.map((item) => item.code)) {
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

function normalizeProviderMethod(item = {}, fallback = {}, index = 0) {
  const code = normalizePaymentMethodCode(item.code || item.id || item.method || fallback.code);
  if (!code) return null;
  const requirements = item.requirements && typeof item.requirements === "object"
    ? item.requirements
    : fallback.requirements && typeof fallback.requirements === "object"
      ? fallback.requirements
      : {};
  return {
    code,
    label: normalizeText(item.label || fallback.label || humanizeCode(code)),
    enabled: normalizeBoolean(item.enabled, normalizeBoolean(fallback.enabled, false)),
    visible: normalizeBoolean(item.visible, normalizeBoolean(fallback.visible, true)),
    priority: normalizePriority(item.priority, normalizePriority(fallback.priority, (index + 1) * 10)),
    wallet: normalizeBoolean(item.wallet, normalizeBoolean(fallback.wallet, false)),
    requirements
  };
}

function providerRegistryInput(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).map(([code, provider]) => ({
    ...(provider && typeof provider === "object" ? provider : {}),
    code
  }));
}

function registryFromLegacy(methods, providers) {
  const registry = new Map();
  methods.forEach((method, index) => {
    const assignment = providers[method.code] || {};
    const providerCode = normalizePaymentProviderCode(assignment.provider_code, method.code);
    if (!providerCode) return;
    if (!registry.has(providerCode)) {
      registry.set(providerCode, {
        code: providerCode,
        label: humanizeCode(providerCode),
        enabled: true,
        visible: true,
        priority: (registry.size + 1) * 10,
        environment: assignment.environment,
        connection_code: assignment.connection_code,
        methods: []
      });
    }
    registry.get(providerCode).methods.push({
      ...method,
      visible: method.visible !== false,
      priority: normalizePriority(method.priority, (index + 1) * 10)
    });
  });
  return [...registry.values()];
}

function normalizePaymentProviderRegistry(input, { methods, providers, fallback } = {}) {
  const fallbackList = providerRegistryInput(fallback);
  const sourceList = providerRegistryInput(input);
  const source = sourceList.length ? sourceList : registryFromLegacy(methods || [], providers || {});
  const fallbackByCode = new Map(
    fallbackList
      .map((provider) => [normalizePaymentProviderCode(provider.code || provider.provider_code), provider])
      .filter(([code]) => code)
  );
  const registry = [];
  const seen = new Set();

  source.forEach((provider, providerIndex) => {
    if (!provider || typeof provider !== "object") return;
    const code = normalizePaymentProviderCode(provider.code || provider.provider_code || provider.id);
    if (!code || seen.has(code)) return;
    seen.add(code);
    const baseline = fallbackByCode.get(code) || {};
    const fallbackMethods = Array.isArray(baseline.methods) ? baseline.methods : [];
    const fallbackMethodsByCode = new Map(
      fallbackMethods
        .map((method) => [normalizePaymentMethodCode(method.code || method.id), method])
        .filter(([methodCode]) => methodCode)
    );
    const configuredMethods = Array.isArray(provider.methods) ? provider.methods : fallbackMethods;
    const normalizedMethods = [];
    const methodSeen = new Set();
    configuredMethods.forEach((method, methodIndex) => {
      const methodCode = normalizePaymentMethodCode(method?.code || method?.id || method);
      const normalized = normalizeProviderMethod(
        typeof method === "string" ? { code: method } : method,
        fallbackMethodsByCode.get(methodCode) || {},
        methodIndex
      );
      if (!normalized || methodSeen.has(normalized.code)) return;
      methodSeen.add(normalized.code);
      normalizedMethods.push(normalized);
    });

    registry.push({
      code,
      label: normalizeText(provider.label || provider.display_name || baseline.label || humanizeCode(code)),
      enabled: normalizeBoolean(provider.enabled, normalizeBoolean(baseline.enabled, true)),
      visible: normalizeBoolean(provider.visible, normalizeBoolean(baseline.visible, true)),
      priority: normalizePriority(provider.priority, normalizePriority(baseline.priority, (providerIndex + 1) * 10)),
      environment: normalizePaymentEnvironment(
        provider.environment || provider.mode || baseline.environment,
        code === "manual_test" ? "sandbox" : "production"
      ),
      connection_code: normalizeText(provider.connection_code || baseline.connection_code) || null,
      adapter_code: normalizePaymentProviderCode(provider.adapter_code || baseline.adapter_code || code),
      methods: normalizedMethods.sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label))
    });
  });

  return registry.sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label));
}

export function normalizePaymentSettings(input = {}, fallback = DEFAULT_PAYMENT_SETTINGS) {
  const base = fallback && typeof fallback === "object" ? fallback : DEFAULT_PAYMENT_SETTINGS;
  const source = input && typeof input === "object" ? input : {};
  const merged = { ...base, ...source };
  const methods = normalizePaymentMethods(source.methods, base.methods);
  const providers = normalizeLegacyPaymentProviders(
    { ...(base.providers || {}), ...(source.providers || {}) },
    methods
  );
  const providerRegistry = normalizePaymentProviderRegistry(source.provider_registry, {
    methods,
    providers,
    fallback: base.provider_registry || DEFAULT_PROVIDER_REGISTRY
  });
  if (Array.isArray(source.methods)) {
    const legacyOverrides = new Map(
      source.methods
        .map((method) => [normalizePaymentMethodCode(method?.code || method?.id), method])
        .filter(([code]) => code)
    );
    for (const provider of providerRegistry) {
      provider.methods = provider.methods.map((method) => {
        const override = legacyOverrides.get(method.code);
        if (!override) return method;
        return {
          ...method,
          label: normalizeText(override.label || method.label),
          enabled: normalizeBoolean(override.enabled, method.enabled),
          visible: normalizeBoolean(override.visible, method.visible)
        };
      });
    }
  }
  const normalizedMethods = providerRegistry.flatMap((provider) =>
    provider.methods.map((method) => ({
      ...method,
      provider_code: provider.code
    }))
  );
  const normalizedProviders = { ...providers };
  for (const provider of providerRegistry) {
    for (const method of provider.methods) {
      if (normalizedProviders[method.code] && !source.provider_registry) continue;
      normalizedProviders[method.code] = {
        provider_code: provider.code,
        connection_code: provider.connection_code,
        environment: provider.environment
      };
    }
  }
  return {
    methods: normalizedMethods,
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
    provider_registry: providerRegistry,
    providers: normalizedProviders
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

function registeredProviderMetadata(profile, index = 0) {
  if (!profile || typeof profile !== "object") return null;
  const providerCode = profileProviderCode(profile);
  const channel = normalizeText(profile?.routing?.channel).toLowerCase();
  if (!providerCode || channel !== "payments") return null;
  const metadata = profile?.routing?.payment_provider && typeof profile.routing.payment_provider === "object"
    ? profile.routing.payment_provider
    : {};
  const rawMethods = Array.isArray(metadata.methods)
    ? metadata.methods
    : Array.isArray(profile?.routing?.supported_payment_methods)
      ? profile.routing.supported_payment_methods
      : Array.isArray(profile?.routing?.supported_message_types)
        ? profile.routing.supported_message_types
        : [];
  const methods = rawMethods
    .map((method, methodIndex) => normalizeProviderMethod(
      typeof method === "string" ? { code: method } : method,
      { enabled: true, visible: true },
      methodIndex
    ))
    .filter(Boolean);
  return {
    code: providerCode,
    label: normalizeText(
      metadata.label ||
      profile?.identity?.provider_display_name ||
      profile?.identity?.connection_name ||
      humanizeCode(providerCode)
    ),
    enabled: normalizeBoolean(metadata.enabled, profile?.identity?.is_enabled !== false),
    visible: normalizeBoolean(metadata.visible, true),
    priority: normalizePriority(metadata.priority, (index + 1) * 10),
    environment: normalizePaymentEnvironment(profile?.identity?.environment, "production"),
    connection_code: normalizeText(profile?.identity?.connection_code) || null,
    adapter_code: normalizePaymentProviderCode(metadata.adapter_code || providerCode),
    methods
  };
}

export function buildPaymentProviderRegistry({ settings, profiles = [] } = {}) {
  const normalized = normalizePaymentSettings(settings);
  const registry = new Map(normalized.provider_registry.map((provider) => [provider.code, {
    ...provider,
    methods: provider.methods.map((method) => ({ ...method }))
  }]));

  (Array.isArray(profiles) ? profiles : []).forEach((profile, index) => {
    const registered = registeredProviderMetadata(profile, index);
    if (!registered) return;
    const existing = registry.get(registered.code);
    if (!existing) {
      registry.set(registered.code, registered);
      return;
    }
    const methodCodes = new Set(existing.methods.map((method) => method.code));
    const addedMethods = registered.methods
      .filter((method) => !methodCodes.has(method.code))
      .map((method) => ({ ...method, enabled: false }));
    registry.set(registered.code, {
      ...existing,
      connection_code: existing.connection_code || registered.connection_code,
      methods: [...existing.methods, ...addedMethods]
        .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label))
    });
  });

  return [...registry.values()].sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label));
}

function profileIsEnabled(profile) {
  return Boolean(profile?.identity?.is_enabled !== false);
}

function profileHealthStatus(profile) {
  return normalizeText(profile?.routing?.health_status || "pending").toLowerCase();
}

function hasConfiguredValue(container, key) {
  if (!container || typeof container !== "object") return false;
  return Boolean(
    normalizeText(container[key]) ||
      normalizeText(container[`${key}_ref`]) ||
      container[`${key}_set`] === true
  );
}

function providerCredentialReason(profile, providerCode) {
  if (!profile) return "provider_not_configured";
  const auth = profile?.outbound?.auth || {};
  const environment = normalizePaymentEnvironment(profile?.identity?.environment, "production");
  const missingReason = environment === "sandbox" ? "sandbox_credentials_missing" : "provider_not_configured";
  if (providerCode === "paypal") {
    if (!hasConfiguredValue(auth, "client_id") || !hasConfiguredValue(auth, "client_secret")) return missingReason;
    return null;
  }
  if (providerCode === "checkout_com") {
    if (!hasConfiguredValue(auth, "secret")) return missingReason;
    return null;
  }
  return null;
}

function applePayDomainStatus(profile) {
  return normalizeText(
    profile?.routing?.apple_pay_domain_status ||
      profile?.routing?.domain_validation_status ||
      profile?.public_storefront?.apple_pay_domain_status ||
      profile?.identity?.apple_pay_domain_status
  ).toLowerCase();
}

function applePayDomainReady(profile) {
  const status = applePayDomainStatus(profile);
  return ["validated", "verified", "active", "configured", "ready"].includes(status);
}

function readinessPresentation(state, overrides = {}) {
  const presentation = PAYMENT_READINESS_PRESENTATION[state] || PAYMENT_READINESS_PRESENTATION.CONFIGURED;
  return {
    state,
    status: presentation.status,
    label: presentation.label,
    available: state === PAYMENT_READINESS_STATES.HEALTHY,
    ...overrides
  };
}

export function paymentProviderReadinessState({ profile, providerCode, providerEnabled = true, adapterRegistered = true } = {}) {
  if (providerEnabled === false || (profile && !profileIsEnabled(profile))) {
    return readinessPresentation(PAYMENT_READINESS_STATES.DISABLED);
  }
  if (!profile) return readinessPresentation(PAYMENT_READINESS_STATES.NOT_CONFIGURED);

  const credentialReason = providerCredentialReason(profile, providerCode);
  if (credentialReason) {
    return readinessPresentation(PAYMENT_READINESS_STATES.NOT_CONFIGURED, {
      status: credentialReason,
      label: credentialReason === "sandbox_credentials_missing"
        ? "Sandbox credentials missing"
        : "Credentials missing"
    });
  }
  if (!adapterRegistered) {
    return readinessPresentation(PAYMENT_READINESS_STATES.CONFIGURED, {
      status: "adapter_not_registered",
      label: "Provider adapter not registered"
    });
  }

  const healthStatus = profileHealthStatus(profile);
  if (["down", "failed", "unhealthy", "error"].includes(healthStatus)) {
    return readinessPresentation(PAYMENT_READINESS_STATES.UNHEALTHY);
  }
  const lastSuccessfulTestAt = normalizeText(profile?.routing?.last_successful_test_at);
  if (
    ["healthy", "configured", "ok", "ready"].includes(healthStatus) &&
    lastSuccessfulTestAt &&
    profile?.routing?.provider_available !== false
  ) {
    return readinessPresentation(PAYMENT_READINESS_STATES.HEALTHY);
  }
  return readinessPresentation(PAYMENT_READINESS_STATES.CONFIGURED);
}

function methodAvailability({ providerState, profile, method }) {
  if (!providerState.available) return providerState;
  if (method?.code === "google_pay" && profile?.public_storefront?.google_pay_enabled !== true) {
    return { ...providerState, available: false, status: "google_pay_not_enabled", label: "Google Pay not enabled" };
  }
  if (method?.requirements?.domain_validation === true && !applePayDomainReady(profile)) {
    return { ...providerState, available: false, status: "domain_validation_missing", label: "Domain validation missing" };
  }
  return providerState;
}

function selectProviderProfile(profiles, providerCode, configuredCode) {
  const source = Array.isArray(profiles) ? profiles : [];
  if (configuredCode) {
    return source.find((profile) => normalizeText(profile?.identity?.connection_code) === configuredCode) || null;
  }
  return (
    source.find((profile) => profileIsEnabled(profile) && profileProviderCode(profile) === providerCode) ||
    source.find((profile) => profileProviderCode(profile) === providerCode) ||
    null
  );
}

export function buildPaymentReadiness({ settings, profiles = [] } = {}) {
  const normalized = normalizePaymentSettings(settings);
  const providerRegistry = buildPaymentProviderRegistry({ settings: normalized, profiles });
  const providers = providerRegistry.map((provider) => {
    const providerCode = provider.code;
    const profile = providerCode === "manual_test"
      ? null
      : selectProviderProfile(profiles, providerCode, provider.connection_code);
    const baseProviderState = providerCode === "manual_test"
      ? provider.enabled === false
        ? readinessPresentation(PAYMENT_READINESS_STATES.DISABLED)
        : provider.environment === "sandbox"
          ? readinessPresentation(PAYMENT_READINESS_STATES.HEALTHY, { status: "sandbox_ready", label: "Sandbox ready" })
          : readinessPresentation(PAYMENT_READINESS_STATES.NOT_CONFIGURED)
      : paymentProviderReadinessState({
          profile,
          providerCode,
          providerEnabled: provider.enabled !== false,
          adapterRegistered: Boolean(getPaymentAdapter(provider.adapter_code || providerCode))
        });
    const providerAvailable = baseProviderState.available;
    const providerStatus = baseProviderState.status;
    const connectionPresent = Boolean(profile);
    const configured = connectionPresent && !providerCredentialReason(profile, providerCode);
    const methods = provider.methods.map((method) => {
      const methodState = providerCode === "manual_test"
        ? baseProviderState
        : methodAvailability({ providerState: baseProviderState, profile, method });
      const available = method.enabled !== false && methodState.available;
      const status = method.enabled === false ? "payment_method_disabled" : methodState.status;
      const statusLabel = method.enabled === false ? "Payment method disabled" : methodState.label;
      return {
        code: method.code,
        label: method.label,
        enabled: method.enabled !== false,
        visible: method.visible !== false,
        priority: method.priority,
        provider_code: providerCode,
        provider_label: provider.label,
        provider_enabled: provider.enabled !== false,
        provider_visible: provider.visible !== false,
        provider_priority: provider.priority,
        environment: providerCode === "manual_test"
          ? "sandbox"
          : normalizePaymentEnvironment(profile?.identity?.environment || provider.environment, "production"),
        connection_code: profile?.identity?.connection_code || provider.connection_code || null,
        connection_present: connectionPresent,
        configured,
        available,
        status,
        reason: status,
        readiness_state: methodState.state,
        readiness_label: methodState.label,
        status_label: statusLabel,
        wallet: method.wallet === true
      };
    });
    return {
      code: providerCode,
      label: provider.label,
      enabled: provider.enabled !== false,
      visible: provider.visible !== false,
      priority: provider.priority,
      environment: providerCode === "manual_test"
        ? "sandbox"
        : normalizePaymentEnvironment(profile?.identity?.environment || provider.environment, "production"),
      connection_code: profile?.identity?.connection_code || provider.connection_code || null,
      connection_present: connectionPresent,
      connection_enabled: profile ? profileIsEnabled(profile) : null,
      configured,
      available: providerAvailable,
      status: providerStatus,
      reason: providerStatus,
      readiness_state: baseProviderState.state,
      readiness_label: baseProviderState.label,
      status_label: baseProviderState.label,
      methods
    };
  });
  const methods = providers.flatMap((provider) => provider.methods);

  return {
    default_currency: normalized.default_currency,
    capture_mode: normalized.capture_mode,
    allowed_countries: normalized.allowed_countries,
    providers,
    methods,
    ready_methods: methods
      .filter((method) => method.provider_visible && method.visible && method.enabled && method.available)
      .map((method) => method.code)
  };
}

export function resolvePaymentMethodContext({ settings, profiles = [], method, providerCode } = {}) {
  const normalizedMethod = normalizePaymentMethodCode(method);
  const normalizedProvider = normalizePaymentProviderCode(providerCode);
  const readiness = buildPaymentReadiness({ settings, profiles });
  const item = normalizedMethod
    ? readiness.methods.find((entry) =>
        entry.code === normalizedMethod && (!normalizedProvider || entry.provider_code === normalizedProvider)
      )
    : readiness.methods.find((entry) =>
        entry.provider_visible && entry.visible && entry.provider_enabled && entry.enabled && entry.available
      );
  if (!item || !item.enabled) return { ok: false, error: "PAYMENT_METHOD_DISABLED" };
  if (!item.available) {
    return {
      ok: false,
      error: "PAYMENT_PROVIDER_NOT_CONFIGURED",
      method: item.code,
      provider_code: item.provider_code,
      reason: item.reason || item.status || "provider_not_configured",
      environment: item.environment
    };
  }
  const provider = readiness.providers.find((entry) => entry.code === item.provider_code) || {};
  const profile = item.provider_code === "manual_test"
    ? null
    : selectProviderProfile(profiles, item.provider_code, provider.connection_code);
  return { ok: true, ...item, profile, readiness };
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

function providerAdapterUnavailable(input = {}, providerCode) {
  const profile = input.connectionProfile || null;
  const state = paymentProviderReadinessState({ profile, providerCode });
  if (!state.available) return state.status || "provider_not_configured";
  return "provider_adapter_unavailable";
}

function webhookVerificationUnavailable(input = {}) {
  const hmac = input.connectionProfile?.verification?.hmac_signature || {};
  if (!hasConfiguredValue(hmac, "secret")) return "webhook_signing_secret_missing";
  return "webhook_signature_verification_unavailable";
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
    async createCheckoutSession(input = {}) {
      return { ok: false, error: providerAdapterUnavailable(input, "checkout_com") };
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
    async verifyWebhookSignature(input = {}) {
      return { ok: false, error: webhookVerificationUnavailable(input) };
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
    async createCheckoutSession(input = {}) {
      const readinessError = providerAdapterUnavailable(input, "paypal");
      if (readinessError !== "provider_adapter_unavailable") {
        return { ok: false, error: readinessError };
      }
      return createPaypalCheckoutSession(input);
    },
    confirmCheckoutSession: confirmPaypalCheckoutSession,
    async capturePayment() {
      return { ok: false, error: "PAYPAL_CAPTURE_NOT_CONFIGURED" };
    },
    async cancelPayment() {
      return { ok: false, error: "PAYPAL_CANCEL_NOT_CONFIGURED" };
    },
    async verifyWebhookSignature(input = {}) {
      return { ok: false, error: webhookVerificationUnavailable(input) };
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

export function registerPaymentAdapter(providerCode, adapter) {
  const code = normalizePaymentProviderCode(providerCode);
  if (!code || !adapter || typeof adapter.createCheckoutSession !== "function") {
    throw new TypeError("Payment adapter registration requires a provider code and createCheckoutSession().");
  }
  ADAPTERS[code] = { ...adapter, code };
  return ADAPTERS[code];
}

export function buildPublicCheckoutConfig({ settings, profiles = [] } = {}) {
  const normalized = normalizePaymentSettings(settings);
  const readiness = buildPaymentReadiness({ settings: normalized, profiles });
  const visibleProviders = readiness.providers.filter((provider) => provider.visible !== false);
  const visibleMethods = readiness.methods.filter((method) =>
    method.provider_visible !== false && method.visible !== false
  );
  return {
    providers: visibleProviders.map((provider) => ({
      code: provider.code,
      label: provider.label,
      enabled: provider.enabled,
      visible: provider.visible,
      priority: provider.priority,
      mode: provider.environment,
      environment: provider.environment,
      available: provider.available,
      status: provider.status,
      reason: provider.reason,
      readiness_state: provider.readiness_state,
      readiness_label: provider.readiness_label,
      status_label: provider.status_label,
      methods: provider.methods
        .filter((method) => method.visible !== false)
        .map((method) => method.code)
    })),
    methods: visibleMethods.map((method) => ({
      code: method.code,
      label: method.label,
      enabled: method.enabled,
      visible: method.visible,
      priority: method.priority,
      provider_code: method.provider_code,
      provider_label: method.provider_label,
      provider_priority: method.provider_priority,
      mode: method.environment,
      environment: method.environment,
      available: method.available,
      reason: method.enabled === false
        ? "payment_method_disabled"
        : method.available
          ? null
          : method.status || "provider_not_configured",
      status: method.status,
      readiness_state: method.readiness_state,
      readiness_label: method.readiness_label,
      status_label: method.status_label,
      wallet: method.wallet
    })),
    enabled_methods: visibleMethods
      .filter((method) => method.provider_enabled && method.enabled)
      .map((method) => method.code),
    ready_methods: readiness.ready_methods,
    default_currency: readiness.default_currency,
    capture_mode: readiness.capture_mode,
    allowed_countries: readiness.allowed_countries
  };
}

export function buildPublicPaymentMethods({ settings, profiles = [] } = {}) {
  const config = buildPublicCheckoutConfig({ settings, profiles });
  return config.methods
    .filter((method) => method.code !== "manual_test")
    .map((method) => ({
      methodCode: toPublicPaymentCode(method.code),
      providerCode: toPublicPaymentCode(method.provider_code),
      providerLabel: method.provider_label,
      providerPriority: method.provider_priority,
      priority: method.priority,
      label: method.label,
      enabled: method.enabled !== false,
      available: method.enabled !== false && method.available === true,
      mode: method.mode || method.environment || "production",
      status: method.status || method.reason || null,
      readinessState: method.readiness_state,
      readinessLabel: method.readiness_label,
      statusLabel: method.status_label,
      reason: method.enabled === false
        ? "payment_method_disabled"
        : method.available
          ? null
          : method.reason || "provider_not_configured"
    }));
}
