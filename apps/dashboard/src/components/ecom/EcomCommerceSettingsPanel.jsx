import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Settings } from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const DEFAULT_LAYOUT = {
  eyebrow: "Settings",
  title: "Commerce / Payments",
  subtitle: "Tenant-local commerce preferences and payment readiness. Provider secrets stay in Admin Console > Connections.",
  paymentTitle: "Payment readiness & preferences",
  paymentSubtitle: "Enable storefront payment methods, choose business policy, and verify provider readiness without exposing secrets.",
  operationsPath: "Dashboard > Orders & Payments > Payments",
  connectionsPath: "Admin Console > Connections"
};

const DEFAULT_PAYMENT_SETTINGS = {
  methods: [
    { code: "card", label: "Credit card", enabled: true },
    { code: "paypal", label: "PayPal", enabled: false },
    { code: "google_pay", label: "Google Pay", enabled: false },
    { code: "apple_pay", label: "Apple Pay", enabled: false },
    { code: "manual_test", label: "Sandbox manual test", enabled: false }
  ],
  default_currency: "USD",
  capture_mode: "automatic",
  allowed_countries: [],
  display_order: ["card", "paypal", "google_pay", "apple_pay", "manual_test"],
  refund_approval_threshold: null,
  manual_review_rules: { enabled: true, high_value_threshold: null },
  providers: {
    card: { provider_code: "checkout_com", environment: "production", connection_code: null },
    paypal: { provider_code: "paypal", environment: "production", connection_code: null },
    google_pay: { provider_code: "checkout_com", environment: "production", connection_code: null },
    apple_pay: { provider_code: "checkout_com", environment: "production", connection_code: null },
    manual_test: { provider_code: "manual_test", environment: "sandbox", connection_code: null }
  }
};

const DEFAULT_SETTINGS = {
  refund_policy: { request_enabled: true, auto_approve: false },
  return_policy: { request_enabled: true },
  payment: DEFAULT_PAYMENT_SETTINGS,
  translation: {
    default_locale: "en",
    locale_options: [],
    marketplaces: [],
    fx: {
      enabled: true,
      auto_sync: true,
      base_currency: "USD",
      connection_codes: {
        openexchangerates: null,
        ecb: null
      },
      provider_priority: ["openexchangerates", "ecb"],
      timeout_ms: 12000,
      freshness_hours: 24,
      last_sync_at: null,
      last_provider: null,
      last_error: null,
      status: "pending"
    },
    engine: {
      enabled: false,
      provider_code: "none",
      quality_tier: "balanced",
      source_locale: "en",
      connection_code: null
    },
    billing: {
      charge_mode: "pass_through",
      markup_percent: 0,
      fixed_fee_minor: 0,
      currency: "USD"
    }
  }
};

const DEFAULT_LOCALE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "ru", label: "Russian" },
  { code: "ky", label: "Kyrgyz" }
];

const DEFAULT_TRANSLATION_CATALOG = {
  providers: [
    { code: "none", label: "Disabled", attrs: { requires_connection: false } },
    { code: "openai", label: "OpenAI", attrs: { requires_connection: true } }
  ],
  quality_tiers: [
    { code: "balanced", label: "Balanced" }
  ],
  charge_modes: [
    { code: "pass_through", label: "Pass-through" }
  ],
  connections: [],
  jurisdictions: [
    { code: "US", label: "United States" },
    { code: "GB", label: "United Kingdom" },
    { code: "FR", label: "France" },
    { code: "DE", label: "Germany" },
    { code: "RU", label: "Russia" },
    { code: "MU", label: "Mauritius" }
  ]
};

const DEFAULT_JURISDICTION_BY_LOCALE = {
  en: "US",
  fr: "FR",
  es: "ES",
  ru: "RU",
  ky: "KG"
};

const DEFAULT_FX_STATUS = {
  enabled: true,
  auto_sync: true,
  base_currency: "USD",
  connection_codes: {
    openexchangerates: null,
    ecb: null
  },
  provider_priority: ["openexchangerates", "ecb"],
  timeout_ms: 12000,
  freshness_hours: 24,
  last_sync_at: null,
  last_provider: null,
  last_error: null,
  status: "pending",
  stale: true,
  marketplaces: []
};
const VARIANT_HEADER_LIST_CODE = "ECOM_VARIANT_HEADER";
const LOCALE_NAME_BY_CODE = {
  en: "English",
  fr: "French",
  es: "Spanish",
  ru: "Russian",
  ky: "Kyrgyz",
  ar: "Arabic",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  zh: "Chinese",
  ja: "Japanese"
};

function mergeSettings(base, override) {
  if (!override || typeof override !== "object") return base;
  const translationBase = base.translation || {};
  const translationOverride = override.translation || {};
  const translation = normalizeTranslationSettings(translationOverride, translationBase);
  const paymentBase = base.payment || DEFAULT_PAYMENT_SETTINGS;
  const paymentOverride = override.payment || {};
  const payment = normalizePaymentSettings(paymentOverride, paymentBase);
  return {
    ...base,
    ...override,
    refund_policy: { ...base.refund_policy, ...(override.refund_policy || {}) },
    return_policy: { ...base.return_policy, ...(override.return_policy || {}) },
    payment,
    translation
  };
}

function normalizeLocale(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeVariantHeaderCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function normalizeVariantHeaderLabel(value, fallbackCode = "") {
  const label = String(value || "").trim();
  if (label) return label.slice(0, 60);
  const code = normalizeVariantHeaderCode(fallbackCode);
  if (!code) return "";
  return code
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ")
    .slice(0, 60);
}

function normalizeCurrency(value, fallback = "USD") {
  const upper = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(upper)) return fallback;
  return upper;
}

function extractJurisdictionCurrency(value) {
  if (!value || typeof value !== "object") return null;
  const attrs = value.attrs && typeof value.attrs === "object" ? value.attrs : {};
  const directCandidates = [
    value.currency,
    value.currency_code,
    value.default_currency,
    attrs.currency,
    attrs.currency_code,
    attrs.default_currency,
    attrs.primary_currency,
    attrs.iso_currency
  ];
  for (const candidate of directCandidates) {
    const normalized = normalizeCurrency(candidate, "");
    if (normalized) return normalized;
  }
  const nestedCurrency = attrs.currency && typeof attrs.currency === "object"
    ? attrs.currency.code || attrs.currency.iso || attrs.currency.value
    : null;
  const nestedNormalized = normalizeCurrency(nestedCurrency, "");
  if (nestedNormalized) return nestedNormalized;
  const currencies = Array.isArray(attrs.currencies) ? attrs.currencies : [];
  for (const entry of currencies) {
    if (entry === null || entry === undefined) continue;
    if (typeof entry === "string") {
      const normalized = normalizeCurrency(entry, "");
      if (normalized) return normalized;
      continue;
    }
    if (typeof entry === "object") {
      const normalized = normalizeCurrency(
        entry.code || entry.currency || entry.iso || entry.value,
        ""
      );
      if (normalized) return normalized;
    }
  }
  return null;
}

function normalizePercentage(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(500, n));
}

function normalizeNonNegativeInteger(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function normalizeExchangeRate(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n <= 0) return fallback;
  return Math.max(0.000001, Math.min(1000000, Number(n.toFixed(6))));
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return fallback;
  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizePaymentMethodCode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (["card", "credit_card", "creditcard", "bank_card"].includes(normalized)) return "card";
  if (["paypal", "pay_pal"].includes(normalized)) return "paypal";
  if (["applepay", "apple_pay", "apple", "apple_wallet"].includes(normalized)) return "apple_pay";
  if (["app", "app_pay", "googlepay", "google_pay", "wallet"].includes(normalized)) return "google_pay";
  if (["manual", "manual_test", "test"].includes(normalized)) return "manual_test";
  return normalized;
}

function mergeLayout(input) {
  if (!input || typeof input !== "object") return DEFAULT_LAYOUT;
  return { ...DEFAULT_LAYOUT, ...input };
}

function formatStatus(value, fallback = "unknown") {
  return String(value || fallback)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

function normalizePaymentProviderCode(value, method = "") {
  const normalized = String(value || "").trim().toLowerCase().replace(/[-.\s]+/g, "_");
  if (["checkout", "checkoutcom", "checkout_com"].includes(normalized)) return "checkout_com";
  if (["paypal", "pay_pal"].includes(normalized)) return "paypal";
  if (["manual", "manual_test", "test"].includes(normalized)) return "manual_test";
  const normalizedMethod = normalizePaymentMethodCode(method);
  if (normalizedMethod === "paypal") return "paypal";
  if (normalizedMethod === "manual_test") return "manual_test";
  if (["card", "google_pay", "apple_pay"].includes(normalizedMethod)) return "checkout_com";
  return normalized || "checkout_com";
}

function normalizePaymentEnvironment(value, fallback = "production") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "live" || normalized === "production") return "production";
  if (normalized === "sandbox" || normalized === "test" || normalized === "manual") return "sandbox";
  return fallback;
}

function normalizeCaptureMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["automatic", "manual"].includes(normalized) ? normalized : "automatic";
}

function normalizeCountryList(value) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.map((item) => String(item || "").trim().toUpperCase()).filter((item) => /^[A-Z]{2}$/.test(item)))];
}

function normalizeOptionalAmount(value) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function normalizePaymentSettings(input, fallback = DEFAULT_PAYMENT_SETTINGS) {
  const base = fallback && typeof fallback === "object" ? fallback : DEFAULT_PAYMENT_SETTINGS;
  const source = input && typeof input === "object" ? input : {};
  const fallbackMethods = Array.isArray(base.methods) ? base.methods : DEFAULT_PAYMENT_SETTINGS.methods;
  const sourceMethods = Array.isArray(source.methods) ? source.methods : [];
  const methodsByCode = new Map(
    fallbackMethods.map((item) => [normalizePaymentMethodCode(item.code), item]).filter(([code]) => code)
  );
  for (const item of sourceMethods) {
    const code = normalizePaymentMethodCode(item?.code || item?.id);
    if (!code) continue;
    const fallbackItem = methodsByCode.get(code) || {};
    methodsByCode.set(code, {
      ...fallbackItem,
      ...item,
      code,
      label: String(item?.label || fallbackItem.label || code.toUpperCase()).trim(),
      enabled: normalizeBoolean(item?.enabled, normalizeBoolean(fallbackItem.enabled, false))
    });
  }
  const methods = Array.from(methodsByCode.values()).map((item) => ({
    code: normalizePaymentMethodCode(item.code),
    label: String(item.label || item.code || "").trim(),
    enabled: normalizeBoolean(item.enabled, false)
  }));

  const baseProviders = base.providers && typeof base.providers === "object" ? base.providers : {};
  const sourceProviders = source.providers && typeof source.providers === "object" ? source.providers : {};
  const providerCodes = new Set([...Object.keys(baseProviders), ...Object.keys(sourceProviders)].map(normalizePaymentMethodCode));
  const providers = {};
  for (const code of providerCodes) {
    if (!code) continue;
    const baseProvider = baseProviders[code] && typeof baseProviders[code] === "object" ? baseProviders[code] : {};
    const sourceProvider = sourceProviders[code] && typeof sourceProviders[code] === "object" ? sourceProviders[code] : {};
    providers[code] = {
      provider_code: normalizePaymentProviderCode(sourceProvider.provider_code || sourceProvider.provider || baseProvider.provider_code, code),
      environment: normalizePaymentEnvironment(
        sourceProvider.environment || sourceProvider.mode || baseProvider.environment || baseProvider.mode,
        code === "manual_test" ? "sandbox" : "production"
      ),
      connection_code: String(sourceProvider.connection_code || baseProvider.connection_code || "").trim() || null
    };
  }

  return {
    methods,
    default_currency: normalizeCurrency(source.default_currency || base.default_currency || "USD", "USD"),
    capture_mode: normalizeCaptureMode(source.capture_mode || base.capture_mode),
    allowed_countries: normalizeCountryList(source.allowed_countries || base.allowed_countries),
    display_order: Array.isArray(source.display_order) ? source.display_order.map(normalizePaymentMethodCode).filter(Boolean) : base.display_order || [],
    refund_approval_threshold: normalizeOptionalAmount(source.refund_approval_threshold ?? base.refund_approval_threshold),
    manual_review_rules: {
      enabled: normalizeBoolean(source.manual_review_rules?.enabled, normalizeBoolean(base.manual_review_rules?.enabled, true)),
      high_value_threshold: normalizeOptionalAmount(source.manual_review_rules?.high_value_threshold ?? base.manual_review_rules?.high_value_threshold)
    },
    providers
  };
}

function normalizeTranslationSettings(input, fallback) {
  const base = fallback && typeof fallback === "object" ? fallback : {};
  const out = input && typeof input === "object" ? { ...base, ...input } : { ...base };
  out.default_locale = normalizeLocale(out.default_locale) || normalizeLocale(base.default_locale) || "en";
  out.locale_options = normalizeLocaleOptionList(out.locale_options);
  const marketplaces = Array.isArray(out.marketplaces) ? out.marketplaces : base.marketplaces || [];
  const seenJurisdiction = new Set();
  out.marketplaces = marketplaces
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const jurisdiction = String(entry.jurisdiction_code || "").trim().toUpperCase();
      if (!jurisdiction) return null;
      if (seenJurisdiction.has(jurisdiction)) return null;
      seenJurisdiction.add(jurisdiction);
      const primary = normalizeLocale(entry.primary_locale);
      const allowedRaw = Array.isArray(entry.allowed_locales) ? entry.allowed_locales : [];
      const allowed = [...new Set(allowedRaw.map(normalizeLocale).filter(Boolean))];
      const primaryLocale = primary || allowed[0] || out.default_locale;
      if (primaryLocale && !allowed.includes(primaryLocale)) allowed.unshift(primaryLocale);
      return {
        jurisdiction_code: jurisdiction,
        primary_locale: primaryLocale,
        allowed_locales: allowed,
        currency: normalizeCurrency(entry.currency, "USD"),
        exchange_rate: normalizeExchangeRate(entry.exchange_rate, 1)
      };
    })
    .filter(Boolean);
  out.engine = normalizeTranslationEngine(out.engine, base.engine);
  out.billing = normalizeTranslationBilling(out.billing, base.billing);
  const fxSource = out.fx && typeof out.fx === "object" ? out.fx : {};
  const fxBase = base.fx && typeof base.fx === "object" ? base.fx : DEFAULT_FX_STATUS;
  const providerPriority = Array.from(
    new Set(
      [
        ...(Array.isArray(fxSource.provider_priority) ? fxSource.provider_priority : []),
        ...(Array.isArray(fxBase.provider_priority) ? fxBase.provider_priority : [])
      ]
        .map((entry) => String(entry || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
  out.fx = {
    enabled: normalizeBoolean(fxSource.enabled, normalizeBoolean(fxBase.enabled, true)),
    auto_sync: normalizeBoolean(fxSource.auto_sync, normalizeBoolean(fxBase.auto_sync, true)),
    base_currency: normalizeCurrency(fxSource.base_currency, normalizeCurrency(fxBase.base_currency, "USD")),
    connection_codes: {
      openexchangerates:
        String(fxSource?.connection_codes?.openexchangerates || fxBase?.connection_codes?.openexchangerates || "")
          .trim() || null,
      ecb: String(fxSource?.connection_codes?.ecb || fxBase?.connection_codes?.ecb || "").trim() || null
    },
    provider_priority: providerPriority.length ? providerPriority : ["openexchangerates", "ecb"],
    timeout_ms: Math.max(1000, Number(fxSource.timeout_ms || fxBase.timeout_ms || 12000)),
    freshness_hours: Math.max(1, Number(fxSource.freshness_hours || fxBase.freshness_hours || 24)),
    last_sync_at: String(fxSource.last_sync_at || fxBase.last_sync_at || "").trim() || null,
    last_provider: String(fxSource.last_provider || fxBase.last_provider || "").trim() || null,
    last_error: String(fxSource.last_error || fxBase.last_error || "").trim() || null,
    status: String(fxSource.status || fxBase.status || "pending").trim().toLowerCase() || "pending"
  };
  return out;
}

function normalizeTranslationEngine(input, fallback) {
  const base = fallback && typeof fallback === "object" ? fallback : {};
  const source = input && typeof input === "object" ? input : {};
  const out = { ...base, ...source };
  return {
    enabled: normalizeBoolean(out.enabled, normalizeBoolean(base.enabled, false)),
    provider_code: String(out.provider_code || base.provider_code || "none").trim().toLowerCase() || "none",
    quality_tier: String(out.quality_tier || base.quality_tier || "balanced").trim().toLowerCase() || "balanced",
    source_locale: normalizeLocale(out.source_locale) || normalizeLocale(base.source_locale) || "en",
    connection_code: String(out.connection_code || base.connection_code || "").trim() || null
  };
}

function normalizeTranslationBilling(input, fallback) {
  const base = fallback && typeof fallback === "object" ? fallback : {};
  const source = input && typeof input === "object" ? input : {};
  const out = { ...base, ...source };
  return {
    charge_mode: String(out.charge_mode || base.charge_mode || "pass_through").trim().toLowerCase() || "pass_through",
    markup_percent: normalizePercentage(out.markup_percent, normalizePercentage(base.markup_percent, 0)),
    fixed_fee_minor: normalizeNonNegativeInteger(
      out.fixed_fee_minor,
      normalizeNonNegativeInteger(base.fixed_fee_minor, 0)
    ),
    currency: normalizeCurrency(out.currency, normalizeCurrency(base.currency, "USD"))
  };
}

function localeLabelFromCode(code) {
  const normalized = normalizeLocale(code);
  if (!normalized) return "";
  const languageCode = normalized.split("-")[0];
  const languageName = LOCALE_NAME_BY_CODE[languageCode] || languageCode.toUpperCase();
  return `${normalized.toUpperCase()} - ${languageName}`;
}

function isValidLocaleCode(value) {
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(String(value || "").trim());
}

function normalizeLocaleOptionList(input) {
  const source = Array.isArray(input) ? input : [];
  const seen = new Set();
  const out = [];
  for (const value of source) {
    const locale = normalizeLocale(value);
    if (!locale || !isValidLocaleCode(locale) || seen.has(locale)) continue;
    seen.add(locale);
    out.push(locale);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function normalizeJurisdictionCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12);
}

function normalizeLocaleOptions(input, fallback = DEFAULT_LOCALE_OPTIONS) {
  const source = Array.isArray(input) ? input : [];
  const seed = Array.isArray(fallback) ? fallback : [];
  const map = new Map();
  for (const item of [...source, ...seed]) {
    const code = normalizeLocale(item?.code);
    if (!code || map.has(code)) continue;
    const label = localeLabelFromCode(code);
    map.set(code, { code, label });
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function parseApiError(err) {
  const message = err?.message || "";
  const match = message.match(/API\s+(\d+):\s*(.*)$/s);
  if (!match) return { status: null, error: null, raw: message };
  const status = Number(match[1]);
  const raw = match[2]?.trim() || "";
  try {
    const payload = JSON.parse(raw);
    return { status, error: payload?.error || null, raw, payload };
  } catch {
    return { status, error: null, raw };
  }
}

function formatApiError(err, fallback) {
  const parsed = parseApiError(err);
  const code = parsed.error || "";
  if (code === "FORBIDDEN" || parsed.status === 403) {
    return "Access denied. Ask an admin to grant commerce permissions.";
  }
  if (code === "UNAUTHENTICATED") {
    return "Session expired. Please sign in again.";
  }
  return fallback || parsed.raw || "Request failed.";
}

export default function EcomCommerceSettingsPanel({ node } = {}) {
  const layout = mergeLayout(node?.props?.layout);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [translationCatalog, setTranslationCatalog] = useState(DEFAULT_TRANSLATION_CATALOG);
  const [localeDraft, setLocaleDraft] = useState("");
  const [marketplaceDraft, setMarketplaceDraft] = useState({
    jurisdiction_code: "",
    primary_locale: DEFAULT_SETTINGS.translation.default_locale,
    currency: "USD",
    exchange_rate: 1
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [variantHeaders, setVariantHeaders] = useState([]);
  const [variantHeaderLoading, setVariantHeaderLoading] = useState(false);
  const [variantHeaderSaving, setVariantHeaderSaving] = useState(false);
  const [variantHeaderDraftCode, setVariantHeaderDraftCode] = useState("");
  const [variantHeaderDraftLabel, setVariantHeaderDraftLabel] = useState("");
  const [fxStatus, setFxStatus] = useState(DEFAULT_FX_STATUS);
  const [syncingFx, setSyncingFx] = useState(false);
  const [savingConnectionScope, setSavingConnectionScope] = useState("");
  const [paymentReadiness, setPaymentReadiness] = useState(null);

  const normalizeVariantHeaderRows = (items) =>
    (Array.isArray(items) ? items : [])
      .map((item) => ({
        code: normalizeVariantHeaderCode(item?.code || item?.key),
        label: normalizeVariantHeaderLabel(item?.label, item?.code || item?.key),
        sort_order: Number(item?.sort_order || 0),
        is_active: item?.is_active !== false
      }))
      .filter((item) => item.code && item.label)
      .sort((a, b) => {
        const sortDiff = Number(a.sort_order || 0) - Number(b.sort_order || 0);
        if (sortDiff !== 0) return sortDiff;
        return a.code.localeCompare(b.code);
      });

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setVariantHeaderLoading(true);
      setError("");
      try {
        const [settingsData, catalogData, variantHeaderData, fxData, paymentReadinessData] = await Promise.all([
          apiFetch("/api/eip/commerce/settings"),
          apiFetch("/api/eip/commerce/translation/catalog"),
          apiFetch("/api/eip/ecom/variant-headers"),
          apiFetch("/api/eip/commerce/fx/status"),
          apiFetch("/api/eip/commerce/payment-readiness")
        ]);
        if (!active) return;
        setSettings(mergeSettings(DEFAULT_SETTINGS, settingsData?.settings || {}));
        setTranslationCatalog({
          providers: Array.isArray(catalogData?.catalog?.providers) && catalogData.catalog.providers.length
            ? catalogData.catalog.providers
            : DEFAULT_TRANSLATION_CATALOG.providers,
          quality_tiers: Array.isArray(catalogData?.catalog?.quality_tiers) && catalogData.catalog.quality_tiers.length
            ? catalogData.catalog.quality_tiers
            : DEFAULT_TRANSLATION_CATALOG.quality_tiers,
          charge_modes: Array.isArray(catalogData?.catalog?.charge_modes) && catalogData.catalog.charge_modes.length
            ? catalogData.catalog.charge_modes
            : DEFAULT_TRANSLATION_CATALOG.charge_modes,
          connections: Array.isArray(catalogData?.catalog?.connections) ? catalogData.catalog.connections : [],
          jurisdictions: Array.isArray(catalogData?.catalog?.jurisdictions) && catalogData.catalog.jurisdictions.length
            ? catalogData.catalog.jurisdictions
            : DEFAULT_TRANSLATION_CATALOG.jurisdictions
        });
        setVariantHeaders(normalizeVariantHeaderRows(variantHeaderData?.items || []));
        setFxStatus({
          ...DEFAULT_FX_STATUS,
          ...(fxData?.fx || {})
        });
        setPaymentReadiness(paymentReadinessData?.readiness || null);
      } catch (err) {
        if (active) setError(formatApiError(err, "Failed to load settings."));
      } finally {
        if (active) {
          setLoading(false);
          setVariantHeaderLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const updateSetting = (path, value) => {
    setSettings((prev) => {
      const next = { ...prev };
      let cursor = next;
      for (let i = 0; i < path.length - 1; i += 1) {
        const key = path[i];
        cursor[key] = { ...(cursor[key] || {}) };
        cursor = cursor[key];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  };

  const updateTranslation = (updater) => {
    setSettings((prev) => {
      const current = normalizeTranslationSettings(prev.translation, DEFAULT_SETTINGS.translation);
      const nextTranslation = updater(current);
      return {
        ...prev,
        translation: normalizeTranslationSettings(nextTranslation, DEFAULT_SETTINGS.translation)
      };
    });
  };

  const updateTranslationEngine = (patch) => {
    updateTranslation((current) => ({
      ...current,
      engine: {
        ...(current.engine || {}),
        ...patch
      }
    }));
  };

  const updateTranslationFx = (patch) => {
    updateTranslation((current) => ({
      ...current,
      fx: {
        ...(current.fx || {}),
        ...patch
      }
    }));
  };

  const updatePayment = (updater) => {
    setSettings((prev) => {
      const current = normalizePaymentSettings(prev.payment, DEFAULT_PAYMENT_SETTINGS);
      const nextPayment = updater(current);
      return {
        ...prev,
        payment: normalizePaymentSettings(nextPayment, DEFAULT_PAYMENT_SETTINGS)
      };
    });
  };

  const updatePaymentMethod = (code, patch) => {
    const methodCode = normalizePaymentMethodCode(code);
    if (!methodCode) return;
    updatePayment((current) => ({
      ...current,
      methods: current.methods.map((item) =>
        normalizePaymentMethodCode(item.code) === methodCode ? { ...item, ...patch, code: methodCode } : item
      )
    }));
  };

  const updatePaymentProvider = (code, patch) => {
    const methodCode = normalizePaymentMethodCode(code);
    if (!methodCode) return;
    updatePayment((current) => ({
      ...current,
      providers: {
        ...current.providers,
        [methodCode]: {
          ...(current.providers?.[methodCode] || {}),
          ...patch
        }
      }
    }));
  };

  const handleAddMarketplace = () => {
    const draftJurisdiction = normalizeJurisdictionCode(marketplaceDraft.jurisdiction_code);
    const draftPrimary = normalizeLocale(marketplaceDraft.primary_locale) || translation.default_locale || "en";
    const draftCurrency = resolveCurrencyForJurisdiction(draftJurisdiction, marketplaceDraft.currency);
    const draftRate = normalizeExchangeRate(marketplaceDraft.exchange_rate, 1);
    if (!draftJurisdiction) {
      setError("Select a jurisdiction before adding a marketplace.");
      setNotice("");
      return;
    }
    const existing = new Set(
      (Array.isArray(translation.marketplaces) ? translation.marketplaces : [])
        .map((entry) => normalizeJurisdictionCode(entry?.jurisdiction_code))
        .filter(Boolean)
    );
    if (existing.has(draftJurisdiction)) {
      setError(`Marketplace ${draftJurisdiction} already exists.`);
      setNotice("");
      return;
    }
    setError("");
    setNotice(`Marketplace ${draftJurisdiction} added.`);
    updateTranslation((current) => ({
      ...current,
      marketplaces: [
        ...(Array.isArray(current.marketplaces) ? current.marketplaces : []),
        {
          jurisdiction_code: draftJurisdiction,
          primary_locale: draftPrimary,
          allowed_locales: [draftPrimary],
          currency: draftCurrency,
          exchange_rate: draftRate
        }
      ]
    }));
  };

  const handleMarketplaceDraftJurisdictionChange = (value) => {
    const nextJurisdiction = normalizeJurisdictionCode(value);
    setMarketplaceDraft((prev) => ({
      ...prev,
      jurisdiction_code: nextJurisdiction,
      currency: resolveCurrencyForJurisdiction(nextJurisdiction, prev.currency)
    }));
  };

  const handleRemoveMarketplace = (index) => {
    updateTranslation((current) => ({
      ...current,
      marketplaces: (Array.isArray(current.marketplaces) ? current.marketplaces : []).filter(
        (_, idx) => idx !== index
      )
    }));
  };

  const updateMarketplace = (index, patch) => {
    updateTranslation((current) => {
      const currentList = Array.isArray(current.marketplaces) ? current.marketplaces : [];
      const nextList = currentList.map((item, idx) => (idx === index ? { ...item, ...patch } : item));
      const duplicate = new Set();
      for (let i = 0; i < nextList.length; i += 1) {
        const code = normalizeJurisdictionCode(nextList[i]?.jurisdiction_code);
        if (!code) continue;
        if (duplicate.has(code)) {
          setError(`Jurisdiction ${code} is already assigned to another marketplace.`);
          setNotice("");
          return current;
        }
        duplicate.add(code);
      }
      setError("");
      return {
        ...current,
        marketplaces: nextList
      };
    });
  };

  const handleMarketplaceJurisdictionChange = (index, nextJurisdictionInput, currentCurrency) => {
    const nextJurisdiction = normalizeJurisdictionCode(nextJurisdictionInput);
    updateMarketplace(index, {
      jurisdiction_code: nextJurisdiction,
      currency: resolveCurrencyForJurisdiction(nextJurisdiction, currentCurrency)
    });
  };

  const toggleMarketplaceLocale = (index, locale) => {
    updateTranslation((current) => {
      const normalizedLocale = normalizeLocale(locale);
      return {
        ...current,
        marketplaces: (Array.isArray(current.marketplaces) ? current.marketplaces : []).map((item, idx) => {
          if (idx !== index) return item;
          const primaryLocale = normalizeLocale(item?.primary_locale) || current.default_locale || "en";
          const allowed = new Set((item.allowed_locales || []).map((entry) => normalizeLocale(entry)).filter(Boolean));
          if (allowed.has(normalizedLocale)) {
            if (normalizedLocale === primaryLocale) return item;
            allowed.delete(normalizedLocale);
          } else {
            allowed.add(normalizedLocale);
          }
          if (!allowed.size) {
            allowed.add(primaryLocale);
          }
          return { ...item, allowed_locales: [...allowed].sort((a, b) => a.localeCompare(b)) };
        })
      };
    });
  };

  const handleAddLocaleOption = () => {
    const locale = normalizeLocale(localeDraft);
    if (!locale || !isValidLocaleCode(locale)) {
      setError("Defined language code format is invalid. Use formats like en, fr, ru, zh-cn.");
      setNotice("");
      return;
    }
    const alreadyExists = localeOptions.some((item) => normalizeLocale(item.code) === locale);
    if (alreadyExists) {
      setError("");
      setNotice(`Defined language ${locale.toUpperCase()} already available.`);
      setLocaleDraft("");
      return;
    }
    setError("");
    updateTranslation((current) => ({
      ...current,
      locale_options: normalizeLocaleOptionList([
        ...(Array.isArray(current.locale_options) ? current.locale_options : []),
        locale
      ])
    }));
    setNotice(`Defined language ${locale.toUpperCase()} added.`);
    setLocaleDraft("");
  };

  const handleRemoveLocaleOption = (localeCode) => {
    const locale = normalizeLocale(localeCode);
    if (!locale) return;
    const inUse = localeOptions.some(
      (item) =>
        normalizeLocale(item.code) === locale &&
        ((normalizeLocale(translation.default_locale) === locale) ||
          (normalizeLocale(translationEngine.source_locale) === locale) ||
          (Array.isArray(translation.marketplaces)
            ? translation.marketplaces.some(
                (entry) =>
                  normalizeLocale(entry?.primary_locale) === locale ||
                  (Array.isArray(entry?.allowed_locales)
                    ? entry.allowed_locales.some((allowed) => normalizeLocale(allowed) === locale)
                    : false)
              )
            : false))
    );
    if (inUse) {
      setError(`Defined language ${locale.toUpperCase()} is in use and cannot be removed.`);
      setNotice("");
      return;
    }
    updateTranslation((current) => ({
      ...current,
      locale_options: normalizeLocaleOptionList(
        (Array.isArray(current.locale_options) ? current.locale_options : []).filter(
          (entry) => normalizeLocale(entry) !== locale
        )
      )
    }));
    setError("");
    setNotice(`Defined language ${locale.toUpperCase()} removed.`);
  };

  const refreshVariantHeaders = async () => {
    setVariantHeaderLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/eip/ecom/variant-headers");
      setVariantHeaders(normalizeVariantHeaderRows(data?.items || []));
    } catch (err) {
      setError(formatApiError(err, "Failed to load variant header catalog."));
    } finally {
      setVariantHeaderLoading(false);
    }
  };

  const handleAddVariantHeader = async () => {
    const draftCode = normalizeVariantHeaderCode(variantHeaderDraftCode || variantHeaderDraftLabel);
    const draftLabel = normalizeVariantHeaderLabel(variantHeaderDraftLabel, draftCode);
    if (!draftCode || !draftLabel) return;
    setVariantHeaderSaving(true);
    setNotice("");
    setError("");
    try {
      const data = await apiFetch("/api/eip/ecom/variant-headers", {
        method: "POST",
        body: {
          code: draftCode,
          label: draftLabel
        }
      });
      setVariantHeaders(normalizeVariantHeaderRows(data?.items || []));
      setVariantHeaderDraftCode("");
      setVariantHeaderDraftLabel("");
      setNotice(`Variant header saved in ${VARIANT_HEADER_LIST_CODE}.`);
    } catch (err) {
      setError(formatApiError(err, "Failed to save variant header."));
    } finally {
      setVariantHeaderSaving(false);
    }
  };

  const handleUpdateVariantHeader = async (code, patch) => {
    const normalizedCode = normalizeVariantHeaderCode(code);
    if (!normalizedCode) return;
    setVariantHeaderSaving(true);
    setNotice("");
    setError("");
    try {
      const data = await apiFetch(`/api/eip/ecom/variant-headers/${encodeURIComponent(normalizedCode)}`, {
        method: "PUT",
        body: patch
      });
      setVariantHeaders(normalizeVariantHeaderRows(data?.items || []));
      setNotice("Variant header updated.");
    } catch (err) {
      setError(formatApiError(err, "Failed to update variant header."));
    } finally {
      setVariantHeaderSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const data = await apiFetch("/api/eip/commerce/settings", {
        method: "PUT",
        body: settings
      });
      setSettings(mergeSettings(DEFAULT_SETTINGS, data?.settings || {}));
      setNotice("Settings saved.");
    } catch (err) {
      setError(formatApiError(err, "Failed to save settings."));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConnectionSelection = async (scope) => {
    const normalizedScope = String(scope || "").trim().toLowerCase();
    if (!normalizedScope) return;
    const payload = {};
    if (normalizedScope === "translation_engine") {
      payload.engine = {
        connection_code: translationEngine.connection_code || null
      };
    } else if (normalizedScope === "fx_openexchangerates") {
      payload.fx = {
        connection_codes: {
          openexchangerates: fxConnectionCodes?.openexchangerates || null
        }
      };
    } else if (normalizedScope === "fx_ecb") {
      payload.fx = {
        connection_codes: {
          ecb: fxConnectionCodes?.ecb || null
        }
      };
    } else {
      return;
    }

    setSavingConnectionScope(normalizedScope);
    setNotice("");
    setError("");
    try {
      const data = await apiFetch("/api/eip/commerce/translation/settings", {
        method: "PUT",
        body: payload
      });
      setSettings((prev) =>
        mergeSettings(prev, {
          translation: data?.translation || {}
        })
      );
      setNotice("Selected connection saved.");
    } catch (err) {
      setError(formatApiError(err, "Failed to save selected connection."));
    } finally {
      setSavingConnectionScope("");
    }
  };

  const handleSyncFx = async () => {
    setSyncingFx(true);
    setError("");
    setNotice("");
    try {
      const data = await apiFetch("/api/eip/commerce/fx/sync", {
        method: "POST",
        body: {}
      });
      setFxStatus({
        ...DEFAULT_FX_STATUS,
        ...(data?.fx || {})
      });
      if (data?.result?.ok) {
        setNotice("Exchange rates synced successfully.");
      } else {
        setNotice("FX sync completed with warnings.");
      }
    } catch (err) {
      setError(formatApiError(err, "Failed to sync exchange rates."));
    } finally {
      setSyncingFx(false);
    }
  };

  const refundRequests = settings.refund_policy?.request_enabled ?? true;
  const refundAutoApprove = settings.refund_policy?.auto_approve ?? false;
  const returnRequests = settings.return_policy?.request_enabled ?? true;
  const payment = normalizePaymentSettings(settings.payment, DEFAULT_PAYMENT_SETTINGS);
  const translation = normalizeTranslationSettings(settings.translation, DEFAULT_SETTINGS.translation);
  const translationEngine = normalizeTranslationEngine(translation.engine, DEFAULT_SETTINGS.translation.engine);
  const translationBilling = normalizeTranslationBilling(translation.billing, DEFAULT_SETTINGS.translation.billing);
  const translationFx = translation.fx && typeof translation.fx === "object"
    ? translation.fx
    : DEFAULT_SETTINGS.translation.fx;
  const fxConnectionCodes = translationFx.connection_codes && typeof translationFx.connection_codes === "object"
    ? translationFx.connection_codes
    : DEFAULT_SETTINGS.translation.fx.connection_codes;
  const missingFxConnectionProviders = (Array.isArray(translationFx.provider_priority)
    ? translationFx.provider_priority
    : []
  ).filter((providerCode) => {
    const key = String(providerCode || "").trim().toLowerCase();
    if (!key) return false;
    return !String(fxConnectionCodes?.[key] || "").trim();
  });
  const localeOptions = useMemo(() => {
    const fromMarketplaces = Array.isArray(translation.marketplaces)
      ? translation.marketplaces.flatMap((entry) => [
          entry?.primary_locale,
          ...(Array.isArray(entry?.allowed_locales) ? entry.allowed_locales : [])
        ])
      : [];
    const configuredLocaleOptions = Array.isArray(translation.locale_options)
      ? translation.locale_options.map((code) => ({ code, label: localeLabelFromCode(code) }))
      : [];
    return normalizeLocaleOptions(
      [
        { code: translation.default_locale, label: localeLabelFromCode(translation.default_locale) },
        { code: translationEngine.source_locale, label: localeLabelFromCode(translationEngine.source_locale) },
        ...fromMarketplaces.map((code) => ({ code, label: localeLabelFromCode(code) })),
        ...configuredLocaleOptions
      ],
      DEFAULT_LOCALE_OPTIONS
    );
  }, [translation.default_locale, translation.locale_options, translation.marketplaces, translationEngine.source_locale]);
  const providerOptions = translationCatalog.providers?.length
    ? translationCatalog.providers
    : DEFAULT_TRANSLATION_CATALOG.providers;
  const paymentReadinessByMethod = useMemo(() => {
    const map = new Map();
    for (const item of paymentReadiness?.methods || []) {
      map.set(normalizePaymentMethodCode(item.code), item);
    }
    return map;
  }, [paymentReadiness]);
  const selectedProvider = providerOptions.find(
    (provider) => String(provider?.code || "").toLowerCase() === String(translationEngine.provider_code || "").toLowerCase()
  );
  const providerRequiresConnection =
    String(translationEngine.provider_code || "none").toLowerCase() !== "none" &&
    (selectedProvider?.attrs && typeof selectedProvider.attrs === "object"
      ? normalizeBoolean(selectedProvider.attrs.requires_connection, true)
      : true);
  const qualityOptions = translationCatalog.quality_tiers?.length
    ? translationCatalog.quality_tiers
    : DEFAULT_TRANSLATION_CATALOG.quality_tiers;
  const connectionOptions = Array.isArray(translationCatalog.connections) ? translationCatalog.connections : [];
  const jurisdictionOptions = useMemo(() => {
    const list = Array.isArray(translationCatalog.jurisdictions) && translationCatalog.jurisdictions.length
      ? translationCatalog.jurisdictions
      : DEFAULT_TRANSLATION_CATALOG.jurisdictions;
    const map = new Map();
    for (const item of list) {
      const code = normalizeJurisdictionCode(item?.code);
      if (!code || map.has(code)) continue;
      const currency = extractJurisdictionCurrency(item);
      map.set(code, {
        code,
        label: String(item?.label || "").trim() || code,
        currency: currency || null
      });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [translationCatalog.jurisdictions]);
  const jurisdictionCurrencyByCode = useMemo(() => {
    const map = new Map();
    for (const item of jurisdictionOptions) {
      const code = normalizeJurisdictionCode(item?.code);
      const currency = normalizeCurrency(item?.currency, "");
      if (!code || !currency) continue;
      map.set(code, currency);
    }
    return map;
  }, [jurisdictionOptions]);
  const resolveCurrencyForJurisdiction = useCallback(
    (jurisdictionCode, fallbackCurrency) => {
      const normalizedJurisdiction = normalizeJurisdictionCode(jurisdictionCode);
      const fallback = normalizeCurrency(
        fallbackCurrency,
        normalizeCurrency(translationBilling.currency || fxStatus.base_currency || "USD", "USD")
      );
      if (!normalizedJurisdiction) return fallback;
      return jurisdictionCurrencyByCode.get(normalizedJurisdiction) || fallback;
    },
    [jurisdictionCurrencyByCode, translationBilling.currency, fxStatus.base_currency]
  );
  const currencyOptions = useMemo(() => {
    const set = new Set();
    const pushCurrency = (value) => {
      const normalized = normalizeCurrency(value, "");
      if (normalized) set.add(normalized);
    };
    for (const item of jurisdictionOptions) pushCurrency(item.currency);
    for (const item of Array.isArray(translation.marketplaces) ? translation.marketplaces : []) {
      pushCurrency(item?.currency);
    }
    for (const item of Array.isArray(fxStatus.marketplaces) ? fxStatus.marketplaces : []) {
      pushCurrency(item?.currency);
    }
    pushCurrency(translationBilling.currency);
    pushCurrency(fxStatus.base_currency);
    pushCurrency(marketplaceDraft.currency);
    if (!set.size) {
      set.add(normalizeCurrency(translationBilling.currency || fxStatus.base_currency || "USD", "USD"));
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [
    jurisdictionOptions,
    translation.marketplaces,
    fxStatus.marketplaces,
    fxStatus.base_currency,
    translationBilling.currency,
    marketplaceDraft.currency
  ]);
  const availableJurisdictionOptions = useMemo(() => {
    const used = new Set(
      (Array.isArray(translation.marketplaces) ? translation.marketplaces : [])
        .map((entry) => normalizeJurisdictionCode(entry?.jurisdiction_code))
        .filter(Boolean)
    );
    return jurisdictionOptions.filter((item) => !used.has(item.code));
  }, [translation.marketplaces, jurisdictionOptions]);

  useEffect(() => {
    setMarketplaceDraft((prev) => {
      const nextPrimary = normalizeLocale(prev.primary_locale) || translation.default_locale || "en";
      const nextRate = normalizeExchangeRate(prev.exchange_rate, 1);
      let nextJurisdiction = normalizeJurisdictionCode(prev.jurisdiction_code);
      if (!nextJurisdiction || !availableJurisdictionOptions.some((option) => option.code === nextJurisdiction)) {
        const fromLocale = DEFAULT_JURISDICTION_BY_LOCALE[nextPrimary] || "";
        const fallbackOption =
          availableJurisdictionOptions.find((option) => option.code === fromLocale) ||
          availableJurisdictionOptions[0] ||
          null;
        nextJurisdiction = fallbackOption?.code || "";
      }
      const nextCurrency = resolveCurrencyForJurisdiction(nextJurisdiction, prev.currency);
      if (
        nextPrimary === prev.primary_locale &&
        nextJurisdiction === prev.jurisdiction_code &&
        nextCurrency === prev.currency &&
        nextRate === prev.exchange_rate
      ) {
        return prev;
      }
      return {
        jurisdiction_code: nextJurisdiction,
        primary_locale: nextPrimary,
        currency: nextCurrency,
        exchange_rate: nextRate
      };
    });
  }, [translation.default_locale, availableJurisdictionOptions, resolveCurrencyForJurisdiction]);

  return (
    <section className="glass-panel space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
            <Settings className="h-4 w-4" />
            {layout.eyebrow}
          </div>
          <h3 className="mt-2 text-lg font-semibold text-ink-900">{layout.title}</h3>
          <p className="mt-1 text-sm text-ink-500">
            {layout.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500"
        >
          {saving ? "Saving" : "Save"}
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-ink-100 bg-white/70 px-4 py-3 text-sm text-ink-500">
          Loading settings...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-ink-100 bg-white/70 p-4 text-sm text-ink-600">
        <label className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
          <input
            type="checkbox"
            checked={returnRequests}
            onChange={(event) => updateSetting(["return_policy", "request_enabled"], event.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-ink-900"
          />
          Allow return requests
        </label>
        <label className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
          <input
            type="checkbox"
            checked={refundRequests}
            onChange={(event) => updateSetting(["refund_policy", "request_enabled"], event.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-ink-900"
          />
          Allow refund requests
        </label>
        <label className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
          <input
            type="checkbox"
            checked={refundAutoApprove}
            disabled={!refundRequests}
            onChange={(event) => updateSetting(["refund_policy", "auto_approve"], event.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-ink-900 disabled:opacity-50"
          />
          Auto-approve refunds
        </label>
      </div>

      <div className="grid gap-4 rounded-2xl border border-ink-100 bg-white/70 p-4 text-sm text-ink-600">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
            {layout.paymentTitle}
          </div>
          <p className="mt-1 text-xs text-ink-500">
            {layout.paymentSubtitle}
          </p>
        </div>

        <div className="grid gap-3 rounded-xl border border-ink-100 bg-white/80 p-3 md:grid-cols-4">
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">Default currency</div>
            <div className="mt-1 text-sm font-semibold text-ink-800">{paymentReadiness?.default_currency || payment.default_currency || "USD"}</div>
          </div>
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">Capture mode</div>
            <div className="mt-1 text-sm font-semibold text-ink-800">{formatStatus(paymentReadiness?.capture_mode || payment.capture_mode)}</div>
          </div>
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">Operations path</div>
            <div className="mt-1 text-xs text-ink-600">{layout.operationsPath}</div>
          </div>
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">Provider setup</div>
            <div className="mt-1 text-xs text-ink-600">{layout.connectionsPath}</div>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-ink-100 bg-white/80 p-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Default currency
            <select
              value={payment.default_currency || "USD"}
              onChange={(event) => updatePayment((current) => ({ ...current, default_currency: event.target.value }))}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            >
              {currencyOptions.map((currencyCode) => (
                <option key={currencyCode} value={currencyCode}>
                  {currencyCode}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Capture mode
            <select
              value={payment.capture_mode || "automatic"}
              onChange={(event) => updatePayment((current) => ({ ...current, capture_mode: event.target.value }))}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            >
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Review threshold
            <input
              type="number"
              min="0"
              value={payment.manual_review_rules?.high_value_threshold ?? ""}
              onChange={(event) =>
                updatePayment((current) => ({
                  ...current,
                  manual_review_rules: {
                    ...(current.manual_review_rules || {}),
                    high_value_threshold: event.target.value === "" ? null : Number(event.target.value)
                  }
                }))
              }
              placeholder="Optional"
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            />
          </label>
        </div>

        <div className="grid gap-3">
          {payment.methods.map((method) => {
            const code = normalizePaymentMethodCode(method.code);
            const provider = payment.providers?.[code] || {};
            const readiness = paymentReadinessByMethod.get(code);
            const providerCode = normalizePaymentProviderCode(provider.provider_code, code);
            const effectiveEnvironment =
              readiness?.environment ||
              normalizePaymentEnvironment(provider.environment || provider.mode, code === "manual_test" ? "sandbox" : "production");
            const configured = providerCode === "manual_test"
              ? effectiveEnvironment === "sandbox"
              : Boolean(readiness?.connection_code || provider.connection_code || readiness?.available);
            const available = Boolean(readiness?.available);
            const connectionOptionsForProvider = connectionOptions.filter((conn) => {
              const value = `${conn.connection_code || ""} ${conn.connection_kind || ""} ${conn.connection_name || ""}`.toLowerCase();
              if (providerCode === "checkout_com") return value.includes("checkout") || !value.includes("paypal");
              if (providerCode === "paypal") return value.includes("paypal");
              return true;
            });
            return (
              <div key={code} className="rounded-xl border border-ink-100 bg-white/80 p-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_150px_minmax(0,1fr)]">
                  <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                    Method
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={method.enabled !== false}
                        onChange={(event) => updatePaymentMethod(code, { enabled: event.target.checked })}
                        className="h-4 w-4 rounded border-ink-300 text-ink-900"
                      />
                      <input
                        value={method.label || ""}
                        onChange={(event) => updatePaymentMethod(code, { label: event.target.value })}
                        className="w-full rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
                      />
                    </div>
                  </label>

                  <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                    Provider
                    <select
                      value={providerCode}
                      onChange={(event) => updatePaymentProvider(code, { provider_code: event.target.value })}
                      className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
                    >
                      <option value="checkout_com">Checkout.com</option>
                      <option value="paypal">PayPal</option>
                      <option value="manual_test">Manual test</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                    Environment
                    <select
                      value={normalizePaymentEnvironment(provider.environment || provider.mode, code === "manual_test" ? "sandbox" : "production")}
                      onChange={(event) => updatePaymentProvider(code, { environment: event.target.value })}
                      className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
                    >
                      <option value="production">Production</option>
                      <option value="sandbox">Sandbox</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                    Admin connection
                    <select
                      value={provider.connection_code || ""}
                      onChange={(event) => updatePaymentProvider(code, { connection_code: event.target.value || null })}
                      disabled={providerCode === "manual_test"}
                      className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700 disabled:opacity-50"
                    >
                      <option value="">Auto-match configured provider</option>
                      {connectionOptionsForProvider.map((conn) => (
                        <option key={`${code}-${conn.connection_code}`} value={conn.connection_code}>
                          {conn.connection_name} ({conn.connection_code})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-3 grid gap-2 rounded-lg border border-ink-100 bg-ink-50/70 px-3 py-2 text-xs text-ink-500 md:grid-cols-6">
                  <div>
                    <div className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink-400">Enabled</div>
                    <div className={method.enabled !== false ? "font-semibold text-emerald-700" : "font-semibold text-ink-500"}>
                      {yesNo(method.enabled !== false)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink-400">Configured</div>
                    <div className={configured ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                      {yesNo(configured)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink-400">Available</div>
                    <div className={available ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                      {yesNo(available)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink-400">Provider</div>
                    <div className="font-semibold text-ink-700">{formatStatus(providerCode)}</div>
                  </div>
                  <div>
                    <div className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink-400">Mode</div>
                    <div className="font-semibold text-ink-700">{formatStatus(effectiveEnvironment)}</div>
                  </div>
                  <div>
                    <div className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink-400">Readiness</div>
                    <div className={available ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                      {formatStatus(readiness?.status, "not checked")}
                    </div>
                  </div>
                  <div className="md:col-span-6">
                    <span className="font-semibold text-ink-500">Connection:</span>{" "}
                    {readiness?.connection_code || provider.connection_code || "No provider connection selected"}
                    {code === "manual_test" ? " - sandbox-only development path." : ""}
                    {readiness?.wallet ? " - wallet method." : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-ink-100 bg-white/70 p-4 text-sm text-ink-600">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
              Translation & marketplaces
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Step 1: configure defined languages. Step 2: assign jurisdictions. Publish translates into allowed languages.
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-ink-100 bg-white/80 p-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Default defined language
            <select
              value={translation.default_locale}
              onChange={(event) => updateTranslation((current) => ({ ...current, default_locale: event.target.value }))}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            >
              {localeOptions.map((locale) => (
                <option key={locale.code} value={locale.code}>
                  {locale.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Add defined language code
            <div className="flex items-center gap-2">
              <input
                value={localeDraft}
                onChange={(event) => setLocaleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddLocaleOption();
                  }
                }}
                placeholder="e.g. de, ar, zh-cn"
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
              />
              <button
                type="button"
                onClick={handleAddLocaleOption}
                className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-500"
              >
                Add
              </button>
            </div>
            <span className="text-[0.62rem] normal-case tracking-normal text-ink-500">
              Added language becomes available in source language and marketplace language selectors.
            </span>
          </label>
        </div>
        {Array.isArray(translation.locale_options) && translation.locale_options.length ? (
          <div className="rounded-xl border border-ink-100 bg-white/80 p-3">
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
              Defined languages
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {translation.locale_options.map((locale) => (
                <button
                  key={locale}
                  type="button"
                  onClick={() => handleRemoveLocaleOption(locale)}
                  className="rounded-full border border-ink-200 bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-600"
                  title="Remove defined language from selector pool"
                >
                  {locale.toUpperCase()} ×
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 rounded-xl border border-ink-100 bg-white/80 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_160px_auto]">
          <div className="md:col-span-5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Create marketplace
          </div>
          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Jurisdiction
            <select
              value={marketplaceDraft.jurisdiction_code}
              onChange={(event) => handleMarketplaceDraftJurisdictionChange(event.target.value)}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            >
              <option value="">Select jurisdiction</option>
              {availableJurisdictionOptions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label} ({item.code})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Primary language
            <select
              value={marketplaceDraft.primary_locale}
              onChange={(event) =>
                setMarketplaceDraft((prev) => ({ ...prev, primary_locale: normalizeLocale(event.target.value) }))
              }
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            >
              {localeOptions.map((locale) => (
                <option key={locale.code} value={locale.code}>
                  {locale.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Currency
            <select
              value={normalizeCurrency(marketplaceDraft.currency, "USD")}
              onChange={(event) =>
                setMarketplaceDraft((prev) => ({ ...prev, currency: normalizeCurrency(event.target.value, "USD") }))
              }
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            >
              {currencyOptions.map((currencyCode) => (
                <option key={currencyCode} value={currencyCode}>
                  {currencyCode}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            FX rate (to base)
            <input
              type="number"
              min="0.000001"
              step="0.000001"
              value={marketplaceDraft.exchange_rate}
              onChange={(event) =>
                setMarketplaceDraft((prev) => ({
                  ...prev,
                  exchange_rate: normalizeExchangeRate(event.target.value, 1)
                }))
              }
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            />
          </label>
          <button
            type="button"
            onClick={handleAddMarketplace}
            disabled={!availableJurisdictionOptions.length}
            className="self-end rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add marketplace
          </button>
        </div>
        {!availableJurisdictionOptions.length ? (
          <div className="rounded-xl border border-ink-100 bg-ink-50/70 px-3 py-2 text-xs text-ink-500">
            All jurisdictions are already assigned.
          </div>
        ) : null}

        <div className="rounded-xl border border-ink-100 bg-white/80 px-3 py-2">
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Marketplace list by jurisdiction
          </div>
        </div>

        {translation.marketplaces.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 bg-white/70 px-4 py-3 text-xs text-ink-500">
            No marketplaces configured. Add one to control languages per jurisdiction.
          </div>
        ) : null}

        {translation.marketplaces.map((marketplace, index) => (
          <div
            key={`${marketplace.jurisdiction_code || "market"}-${index}`}
            className="grid gap-3 rounded-xl border border-ink-100 bg-white/80 p-3"
          >
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
              Marketplace {index + 1}
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_130px_160px_auto]">
              <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                Jurisdiction
                <select
                  value={normalizeJurisdictionCode(marketplace.jurisdiction_code)}
                  onChange={(event) =>
                    handleMarketplaceJurisdictionChange(index, event.target.value, marketplace.currency)
                  }
                  className="rounded-lg border border-ink-200 bg-white px-3 py-1 text-xs text-ink-700"
                >
                  <option value="">Select jurisdiction</option>
                  {normalizeJurisdictionCode(marketplace.jurisdiction_code) &&
                  !jurisdictionOptions.some(
                    (item) => item.code === normalizeJurisdictionCode(marketplace.jurisdiction_code)
                  ) ? (
                    <option value={normalizeJurisdictionCode(marketplace.jurisdiction_code)}>
                      {normalizeJurisdictionCode(marketplace.jurisdiction_code)}
                    </option>
                  ) : null}
                  {jurisdictionOptions.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label} ({item.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                Primary language
                <select
                  value={marketplace.primary_locale || translation.default_locale}
                  onChange={(event) =>
                    updateMarketplace(index, {
                      primary_locale: event.target.value,
                      allowed_locales: Array.from(
                        new Set([event.target.value, ...(marketplace.allowed_locales || [])])
                      )
                    })
                  }
                  className="rounded-lg border border-ink-200 bg-white px-3 py-1 text-xs text-ink-700"
                >
                  {localeOptions.map((locale) => (
                    <option key={locale.code} value={locale.code}>
                      {locale.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                Currency
                <select
                  value={normalizeCurrency(marketplace.currency, "USD")}
                  onChange={(event) =>
                    updateMarketplace(index, { currency: normalizeCurrency(event.target.value, "USD") })
                  }
                  className="rounded-lg border border-ink-200 bg-white px-3 py-1 text-xs text-ink-700"
                >
                  {currencyOptions.map((currencyCode) => (
                    <option key={currencyCode} value={currencyCode}>
                      {currencyCode}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                FX rate (to base)
                <input
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  value={normalizeExchangeRate(marketplace.exchange_rate, 1)}
                  onChange={(event) =>
                    updateMarketplace(index, { exchange_rate: normalizeExchangeRate(event.target.value, 1) })
                  }
                  className="rounded-lg border border-ink-200 bg-white px-3 py-1 text-xs text-ink-700"
                />
              </label>
              <button
                type="button"
                onClick={() => handleRemoveMarketplace(index)}
                className="self-end text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-rose-500"
              >
                Remove
              </button>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-ink-600">
              {localeOptions.map((locale) => (
                <label key={locale.code} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(marketplace.allowed_locales || []).includes(locale.code)}
                    onChange={() => toggleMarketplaceLocale(index, locale.code)}
                    disabled={normalizeLocale(locale.code) === normalizeLocale(marketplace.primary_locale)}
                    className="h-4 w-4 rounded border-ink-300 text-ink-900"
                  />
                  {locale.label}
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="grid gap-3 rounded-xl border border-ink-100 bg-white/80 p-3 md:grid-cols-2">
          <label className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
            <input
              type="checkbox"
              checked={translationEngine.enabled}
              onChange={(event) => updateTranslationEngine({ enabled: event.target.checked })}
              className="h-4 w-4 rounded border-ink-300 text-ink-900"
            />
            Translation enabled
          </label>

          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Provider
            <select
              value={translationEngine.provider_code}
              onChange={(event) => updateTranslationEngine({ provider_code: event.target.value })}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            >
              {providerOptions.map((provider) => (
                <option key={provider.code} value={provider.code}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Quality tier
            <select
              value={translationEngine.quality_tier}
              onChange={(event) => updateTranslationEngine({ quality_tier: event.target.value })}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            >
              {qualityOptions.map((tier) => (
                <option key={tier.code} value={tier.code}>
                  {tier.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Source language
            <select
              value={translationEngine.source_locale}
              onChange={(event) => updateTranslationEngine({ source_locale: event.target.value })}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            >
              {localeOptions.map((locale) => (
                <option key={locale.code} value={locale.code}>
                  {locale.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Gateway connection
            <select
              value={translationEngine.connection_code || ""}
              onChange={(event) =>
                updateTranslationEngine({ connection_code: event.target.value || null })
              }
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            >
              <option value="">Select outbound connection</option>
              {connectionOptions.map((conn) => (
                <option key={conn.connection_code} value={conn.connection_code}>
                  {conn.connection_name} ({conn.connection_code}){conn.connection_kind ? ` - ${conn.connection_kind}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleSaveConnectionSelection("translation_engine")}
              disabled={savingConnectionScope === "translation_engine"}
              className="mt-2 self-end rounded-full border border-ink-200 bg-white px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingConnectionScope === "translation_engine" ? "Saving..." : "Save selected"}
            </button>
          </label>
        </div>

        {translationEngine.enabled &&
        translationEngine.provider_code !== "none" &&
        providerRequiresConnection &&
        !connectionOptions.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            No outbound translation connection is available. Add a non-ecommerce outbound connection in Admin Console
            and select it here before publishing products.
          </div>
        ) : null}

        <div className="rounded-xl border border-ink-100 bg-white/80 p-3">
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Translation pricing
          </div>
          <p className="mt-1 text-xs text-ink-500">
            This pricing is managed by EIP admin console and shared here for visibility.
          </p>
          <div className="mt-3 grid gap-2 text-xs text-ink-600 md:grid-cols-2">
            <div>
              <span className="font-semibold text-ink-500">Charge mode:</span>{" "}
              {translationBilling.charge_mode}
            </div>
            <div>
              <span className="font-semibold text-ink-500">Currency:</span>{" "}
              {translationBilling.currency}
            </div>
            <div>
              <span className="font-semibold text-ink-500">Markup %:</span>{" "}
              {translationBilling.markup_percent}
            </div>
            <div>
              <span className="font-semibold text-ink-500">Fixed fee (minor):</span>{" "}
              {translationBilling.fixed_fee_minor}
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-ink-100 bg-white/80 p-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            FX Gateway (OpenExchangeRates)
            <select
              value={fxConnectionCodes?.openexchangerates || ""}
              onChange={(event) =>
                updateTranslationFx({
                  connection_codes: {
                    ...(fxConnectionCodes || {}),
                    openexchangerates: event.target.value || null
                  }
                })
              }
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            >
              <option value="">Select outbound connection</option>
              {connectionOptions.map((conn) => (
                <option key={`fx-oxr-${conn.connection_code}`} value={conn.connection_code}>
                  {conn.connection_name} ({conn.connection_code})
                  {conn.connection_kind ? ` - ${conn.connection_kind}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleSaveConnectionSelection("fx_openexchangerates")}
              disabled={savingConnectionScope === "fx_openexchangerates"}
              className="mt-2 self-end rounded-full border border-ink-200 bg-white px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingConnectionScope === "fx_openexchangerates" ? "Saving..." : "Save selected"}
            </button>
          </label>

          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            FX Gateway (ECB)
            <select
              value={fxConnectionCodes?.ecb || ""}
              onChange={(event) =>
                updateTranslationFx({
                  connection_codes: {
                    ...(fxConnectionCodes || {}),
                    ecb: event.target.value || null
                  }
                })
              }
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            >
              <option value="">Select outbound connection</option>
              {connectionOptions.map((conn) => (
                <option key={`fx-ecb-${conn.connection_code}`} value={conn.connection_code}>
                  {conn.connection_name} ({conn.connection_code})
                  {conn.connection_kind ? ` - ${conn.connection_kind}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleSaveConnectionSelection("fx_ecb")}
              disabled={savingConnectionScope === "fx_ecb"}
              className="mt-2 self-end rounded-full border border-ink-200 bg-white px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingConnectionScope === "fx_ecb" ? "Saving..." : "Save selected"}
            </button>
          </label>
        </div>
        {missingFxConnectionProviders.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            FX gateway connection is required for: {missingFxConnectionProviders.join(", ")}.
          </div>
        ) : null}

        <div className="grid gap-3 rounded-xl border border-ink-100 bg-ink-50/70 px-3 py-3 text-xs text-ink-600 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="space-y-1">
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-500">
              FX sync status
            </div>
            <div>
              Status:{" "}
              <span className="font-semibold text-ink-700">
                {String(fxStatus.status || "pending").toUpperCase()}
              </span>
              {fxStatus.stale ? (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Stale
                </span>
              ) : null}
            </div>
            <div>
              Base: <span className="font-semibold text-ink-700">{fxStatus.base_currency || "USD"}</span> |
              Provider order:{" "}
              <span className="font-semibold text-ink-700">
                {Array.isArray(fxStatus.provider_priority) && fxStatus.provider_priority.length
                  ? fxStatus.provider_priority.join(" -> ")
                  : "not set"}
              </span>
            </div>
            <div>
              Last sync:{" "}
              <span className="font-semibold text-ink-700">
                {fxStatus.last_sync_at ? new Date(fxStatus.last_sync_at).toLocaleString() : "not synced yet"}
              </span>
              {fxStatus.last_provider ? (
                <span className="ml-2 text-ink-500">via {fxStatus.last_provider}</span>
              ) : null}
            </div>
            {fxStatus.last_error ? (
              <div className="text-rose-600">Last error: {fxStatus.last_error}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleSyncFx}
            disabled={syncingFx || !fxStatus.enabled}
            className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncingFx ? "Syncing..." : "Sync FX now"}
          </button>
        </div>

      </div>

      <div className="grid gap-4 rounded-2xl border border-ink-100 bg-white/70 p-4 text-sm text-ink-600">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
              Variant header catalog
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Governs JSONB variant header keys used by Product Studio ({VARIANT_HEADER_LIST_CODE}).
            </p>
          </div>
          <button
            type="button"
            onClick={refreshVariantHeaders}
            disabled={variantHeaderLoading}
            className="rounded-full border border-ink-200 bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-500 disabled:opacity-60"
          >
            {variantHeaderLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="grid gap-3 rounded-xl border border-ink-100 bg-white/80 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Header key
            <input
              value={variantHeaderDraftCode}
              onChange={(event) => setVariantHeaderDraftCode(event.target.value)}
              placeholder="size"
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Label
            <input
              value={variantHeaderDraftLabel}
              onChange={(event) => setVariantHeaderDraftLabel(event.target.value)}
              placeholder="Size"
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-700"
            />
          </label>
          <button
            type="button"
            onClick={handleAddVariantHeader}
            disabled={variantHeaderSaving}
            className="self-end rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-500 disabled:opacity-60"
          >
            {variantHeaderSaving ? "Saving..." : "Add"}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-ink-100 bg-white/80">
          <div className="grid grid-cols-[minmax(0,1fr)_130px_90px_80px] gap-2 border-b border-ink-100 bg-ink-50/70 px-3 py-2 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-ink-500">
            <span>Header</span>
            <span>Key</span>
            <span>Sort</span>
            <span>Active</span>
          </div>
          <div className="max-h-[16rem] divide-y divide-ink-100/60 overflow-y-auto">
            {variantHeaderLoading ? (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-ink-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading variant headers...
              </div>
            ) : variantHeaders.length ? (
              variantHeaders.map((item) => (
                <div
                  key={item.code}
                  className="grid grid-cols-[minmax(0,1fr)_130px_90px_80px] items-center gap-2 px-3 py-2 text-[0.72rem] text-ink-700"
                >
                  <input
                    value={item.label}
                    onChange={(event) =>
                      setVariantHeaders((prev) =>
                        prev.map((row) =>
                          row.code === item.code
                            ? { ...row, label: event.target.value }
                            : row
                        )
                      )
                    }
                    onBlur={(event) =>
                      handleUpdateVariantHeader(item.code, {
                        label: normalizeVariantHeaderLabel(event.target.value, item.code)
                      })
                    }
                    className="w-full rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-700"
                  />
                  <span className="truncate text-[0.68rem] text-ink-500">{item.code}</span>
                  <input
                    type="number"
                    min={1}
                    value={item.sort_order}
                    onChange={(event) => {
                      const value = Number(event.target.value || 0);
                      setVariantHeaders((prev) =>
                        prev.map((row) =>
                          row.code === item.code ? { ...row, sort_order: value } : row
                        )
                      );
                    }}
                    onBlur={(event) =>
                      handleUpdateVariantHeader(item.code, {
                        sort_order: Math.max(1, Number(event.target.value || 1))
                      })
                    }
                    className="w-full rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-700"
                  />
                  <label className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={item.is_active !== false}
                      onChange={(event) =>
                        handleUpdateVariantHeader(item.code, { is_active: event.target.checked })
                      }
                      className="h-4 w-4 rounded border-ink-300 text-ink-900"
                    />
                  </label>
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-xs text-ink-500">
                No variant headers configured yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
