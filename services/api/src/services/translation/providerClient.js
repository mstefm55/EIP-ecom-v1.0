import { executeGatewayOutboundRequest } from "../gateway/outbound.js";

const OPENAI_MODEL_FALLBACK = "gpt-4o-mini";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value) {
  const trimmed = normalizeText(value);
  return trimmed.length ? trimmed : null;
}

function normalizeLocale(value) {
  return normalizeText(value).toLowerCase();
}

function parseCsv(input) {
  return String(input || "")
    .split(",")
    .map((entry) => normalizeLocale(entry))
    .filter(Boolean);
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function makeProviderError(code, message, details = {}) {
  const err = new Error(message || code);
  err.code = code;
  if (details && typeof details === "object") {
    Object.assign(err, details);
  }
  return err;
}

function sanitizeProviderCode(value) {
  const provider = normalizeText(value).toLowerCase();
  if (["azure", "google", "deepl", "libretranslate", "openai"].includes(provider)) return provider;
  if (provider === "none") return "none";
  return provider;
}

function defaultBaseUrlByProvider(providerCode) {
  const code = sanitizeProviderCode(providerCode);
  if (code === "google") return "https://translation.googleapis.com";
  if (code === "openai") return "https://api.openai.com/v1";
  return null;
}

function collectTargetLocales(translationSettings = {}, appConfig = {}, sourceLocale = "en") {
  const locales = new Set();
  const defaultLocale = normalizeLocale(translationSettings?.default_locale);
  if (defaultLocale) locales.add(defaultLocale);
  for (const locale of Array.isArray(translationSettings?.locale_options) ? translationSettings.locale_options : []) {
    const normalized = normalizeLocale(locale);
    if (normalized) locales.add(normalized);
  }
  for (const marketplace of Array.isArray(translationSettings?.marketplaces) ? translationSettings.marketplaces : []) {
    for (const locale of Array.isArray(marketplace?.allowed_locales) ? marketplace.allowed_locales : []) {
      const normalized = normalizeLocale(locale);
      if (normalized) locales.add(normalized);
    }
    const primary = normalizeLocale(marketplace?.primary_locale);
    if (primary) locales.add(primary);
  }

  const engineLocales = Array.isArray(translationSettings?.engine?.target_locales)
    ? translationSettings.engine.target_locales
    : [];
  for (const locale of engineLocales) {
    const normalized = normalizeLocale(locale);
    if (normalized) locales.add(normalized);
  }

  for (const locale of parseCsv(appConfig?.TRANSLATION_TARGET_LANGS)) {
    locales.add(locale);
  }

  const normalizedSource = normalizeLocale(sourceLocale) || "en";
  locales.delete(normalizedSource);
  return [...locales].sort((a, b) => a.localeCompare(b));
}

function pickHealthProbeTarget(sourceLocale, configuredTargets = []) {
  const source = normalizeLocale(sourceLocale) || "en";
  const firstConfigured = Array.isArray(configuredTargets)
    ? configuredTargets.find((entry) => normalizeLocale(entry) && normalizeLocale(entry) !== source)
    : null;
  if (firstConfigured) return normalizeLocale(firstConfigured);
  const probeFallbacks = ["fr", "es", "de", "ru", "ar", "it", "pt"];
  for (const candidate of probeFallbacks) {
    if (candidate !== source) return candidate;
  }
  return source === "en" ? "fr" : "en";
}

function normalizeTimeout(value, fallback = 15000) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(1000, Math.min(120000, Math.round(n)));
}

function boolFromAny(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function resolveTranslationRuntime(appConfig = {}, translationSettings = {}) {
  const engine = translationSettings?.engine && typeof translationSettings.engine === "object"
    ? translationSettings.engine
    : {};

  const sourceLocale =
    normalizeLocale(engine.source_locale) ||
    normalizeLocale(appConfig.TRANSLATION_SOURCE_LANG) ||
    normalizeLocale(translationSettings.default_locale) ||
    "en";

  const targetLocales = collectTargetLocales(translationSettings, appConfig, sourceLocale);

  const providerCode = sanitizeProviderCode(
    engine.provider_code || appConfig.TRANSLATION_PROVIDER_CODE || "none"
  );
  const baseUrl =
    normalizeOptionalText(engine.base_url || appConfig.TRANSLATION_PROVIDER_BASE_URL) ||
    defaultBaseUrlByProvider(providerCode);

  const enabled = typeof engine.enabled === "boolean"
    ? engine.enabled
    : boolFromAny(appConfig.TRANSLATION_PROVIDER_ENABLED, false);
  const apiKeyFromEnv =
    providerCode === "openai"
      ? normalizeOptionalText(appConfig.OPENAI_API_KEY || appConfig.TRANSLATION_PROVIDER_API_KEY)
      : normalizeOptionalText(appConfig.TRANSLATION_PROVIDER_API_KEY);

  const resolvedModel =
    normalizeOptionalText(engine.model || appConfig.TRANSLATION_PROVIDER_MODEL || appConfig.OPENAI_MODEL_DEFAULT) ||
    (providerCode === "openai" ? OPENAI_MODEL_FALLBACK : null);

  return {
    enabled,
    provider_code: providerCode,
    source_locale: sourceLocale,
    target_locales: targetLocales,
    connection_code: normalizeOptionalText(engine.connection_code),
    base_url: baseUrl,
    api_key: normalizeOptionalText(engine.api_key) || apiKeyFromEnv,
    api_region: normalizeOptionalText(engine.api_region || appConfig.TRANSLATION_PROVIDER_API_REGION),
    timeout_ms: normalizeTimeout(engine.timeout_ms || appConfig.TRANSLATION_PROVIDER_TIMEOUT_MS, 15000),
    model: resolvedModel
  };
}

function parseOpenAITranslatedPayload(payload) {
  if (Array.isArray(payload)) return payload.map((entry) => normalizeText(entry));
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload.translations)) {
    return payload.translations.map((entry) => normalizeText(entry));
  }
  if (payload.translations && typeof payload.translations === "object") {
    return Object.keys(payload.translations)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => normalizeText(payload.translations[key]));
  }
  if (Array.isArray(payload.items)) {
    return payload.items.map((entry) => normalizeText(entry?.text || entry));
  }
  if (typeof payload.translation === "string") {
    return [normalizeText(payload.translation)];
  }
  if (typeof payload.text === "string") {
    return [normalizeText(payload.text)];
  }
  return null;
}

function unwrapJsonCodeFence(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? normalizeText(fenced[1]) : raw;
}

function parseProviderResponse(providerCode, responseText) {
  let payload;
  try {
    payload = JSON.parse(String(responseText || "{}"));
  } catch {
    return null;
  }
  if (providerCode === "azure") {
    if (!Array.isArray(payload)) return null;
    return payload.map((entry) => normalizeText(entry?.translations?.[0]?.text));
  }
  if (providerCode === "google") {
    const translations = Array.isArray(payload?.data?.translations) ? payload.data.translations : [];
    return translations.map((entry) => decodeHtmlEntities(entry?.translatedText || ""));
  }
  if (providerCode === "deepl") {
    const translations = Array.isArray(payload?.translations) ? payload.translations : [];
    return translations.map((entry) => normalizeText(entry?.text));
  }
  if (providerCode === "libretranslate") {
    if (Array.isArray(payload?.translatedText)) {
      return payload.translatedText.map((entry) => normalizeText(entry));
    }
    if (typeof payload?.translatedText === "string") {
      return [normalizeText(payload.translatedText)];
    }
    if (Array.isArray(payload)) {
      return payload.map((entry) => normalizeText(entry?.translatedText || entry));
    }
  }
  if (providerCode === "openai") {
    const content = normalizeText(payload?.choices?.[0]?.message?.content || "");
    if (!content) return null;
    let parsed = null;
    try {
      parsed = JSON.parse(unwrapJsonCodeFence(content));
    } catch {
      parsed = null;
    }
    if (parsed) {
      return parseOpenAITranslatedPayload(parsed);
    }
    return [content];
  }
  return null;
}

function buildProviderRequest(runtime, sourceLocale, targetLocale, texts) {
  const provider = runtime.provider_code;
  if (provider === "azure") {
    return {
      endpoint: "/translate",
      method: "POST",
      query: {
        "api-version": "3.0",
        from: sourceLocale,
        to: targetLocale
      },
      headers: { "Content-Type": "application/json" },
      body: texts.map((text) => ({ text }))
    };
  }
  if (provider === "google") {
    return {
      endpoint: "/language/translate/v2",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      query: runtime.api_key ? { key: runtime.api_key } : {},
      body: {
        q: texts,
        source: sourceLocale,
        target: targetLocale,
        format: "text"
      }
    };
  }
  if (provider === "deepl") {
    return {
      endpoint: "/v2/translate",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        text: texts,
        source_lang: sourceLocale.toUpperCase(),
        target_lang: targetLocale.toUpperCase()
      }
    };
  }
  if (provider === "libretranslate") {
    return {
      endpoint: "/translate",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        q: texts,
        source: sourceLocale,
        target: targetLocale,
        format: "text",
        ...(runtime.api_key ? { api_key: runtime.api_key } : {})
      }
    };
  }
  if (provider === "openai") {
    const model = normalizeOptionalText(runtime.model);
    if (!model) {
      throw makeProviderError("TRANSLATION_PROVIDER_MODEL_REQUIRED", "Provider model missing.");
    }
    return {
      endpoint: "/chat/completions",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Translate text. Return strict JSON object: {\"translations\":[...]} with same order and count."
          },
          {
            role: "user",
            content: JSON.stringify({
              source_locale: sourceLocale,
              target_locale: targetLocale,
              texts
            })
          }
        ]
      }
    };
  }
  return null;
}

function buildProviderHealthRequest(runtime, sourceLocale = "en") {
  const provider = sanitizeProviderCode(runtime?.provider_code);
  if (provider === "azure") {
    return {
      endpoint: "/languages",
      method: "GET",
      query: { "api-version": "3.0" }
    };
  }
  if (provider === "google") {
    return {
      endpoint: "/language/translate/v2/languages",
      method: "GET",
      query: {
        ...(runtime.api_key ? { key: runtime.api_key } : {}),
        target: sourceLocale || "en"
      }
    };
  }
  if (provider === "deepl") {
    return {
      endpoint: "/v2/languages",
      method: "GET"
    };
  }
  if (provider === "libretranslate") {
    return {
      endpoint: "/languages",
      method: "GET"
    };
  }
  if (provider === "openai") {
    return {
      endpoint: "/models",
      method: "GET"
    };
  }
  return null;
}


async function executeProviderRequest({ client, tenantId, runtime, requestSpec }) {
  if (!runtime?.connection_code) {
    throw makeProviderError(
      "TRANSLATION_GATEWAY_CONNECTION_REQUIRED",
      "Gateway connection is required for translation provider calls."
    );
  }
  if (!client) {
    throw makeProviderError("TRANSLATION_GATEWAY_CLIENT_REQUIRED", "Database client required for gateway translation calls.");
  }

  const response = await executeGatewayOutboundRequest(client, { tenantId }, {
    connection_code: runtime.connection_code,
    endpoint: requestSpec.endpoint,
    method: requestSpec.method,
    query: requestSpec.query,
    headers: requestSpec.headers,
    body: requestSpec.body,
    timeout_ms: runtime.timeout_ms
  });
  if (!response.ok) {
    const status = Number(response.status || 0);
    if (status === 401 || status === 403) {
      throw makeProviderError("TRANSLATION_PROVIDER_AUTH_FAILED", "Translation provider authentication failed.", {
        provider_status: status
      });
    }
    throw makeProviderError(`TRANSLATION_PROVIDER_HTTP_${status || 0}`, "Translation provider returned an error.", {
      provider_status: status,
      provider_response: String(response.text || "").slice(0, 500)
    });
  }
  return { status: response.status, text: response.text || "" };
}

async function translateTextsThroughProvider({ client = null, tenantId = null, runtime, sourceLocale, targetLocale, texts }) {
  const list = Array.isArray(texts)
    ? texts.map((entry) => normalizeText(entry)).filter(Boolean)
    : [];
  if (!list.length) {
    throw makeProviderError("TRANSLATION_NO_TEXTS", "No source text provided.");
  }
  const providerCode = sanitizeProviderCode(runtime?.provider_code);
  if (!providerCode || providerCode === "none") {
    throw makeProviderError("TRANSLATION_PROVIDER_DISABLED", "Translation provider is disabled.");
  }

  const source = normalizeLocale(sourceLocale || runtime?.source_locale || "en") || "en";
  const target = normalizeLocale(targetLocale || "") || "";
  if (!target || target === source) {
    throw makeProviderError("TRANSLATION_TARGET_INVALID", "Translation target locale is invalid.");
  }

  const requestSpec = buildProviderRequest({ ...runtime, provider_code: providerCode }, source, target, list);
  if (!requestSpec) {
    throw makeProviderError("TRANSLATION_PROVIDER_UNSUPPORTED", "Translation provider is unsupported.");
  }

  const response = await executeProviderRequest({ client, tenantId, runtime: { ...runtime, provider_code: providerCode }, requestSpec });
  const translated = parseProviderResponse(providerCode, response.text);
  if (!Array.isArray(translated) || translated.length !== list.length) {
    throw makeProviderError("TRANSLATION_PROVIDER_RESPONSE_INVALID", "Translation provider response is invalid.", {
      provider_status: response.status
    });
  }

  return translated.map((entry) => normalizeText(entry));
}

function normalizeProviderError(error) {
  const code = normalizeText(error?.code || error?.message || "TRANSLATION_PROVIDER_ERROR").toUpperCase();
  const providerResponse = normalizeText(error?.provider_response || "");
  if (code === "TRANSLATION_PROVIDER_DISABLED") {
    return { code, message: "Translation provider is disabled.", retryable: true };
  }
  if (code === "TRANSLATION_PROVIDER_AUTH_MISSING") {
    return { code, message: "Translation provider API key is missing.", retryable: false };
  }
  if (code === "TRANSLATION_GATEWAY_CONNECTION_REQUIRED") {
    return {
      code,
      message: "Translation gateway connection is required.",
      retryable: false
    };
  }
  if (code === "TRANSLATION_PROVIDER_MODEL_REQUIRED") {
    return { code, message: "Translation provider model is missing.", retryable: false };
  }
  if (code === "TRANSLATION_PROVIDER_AUTH_FAILED") {
    return { code, message: "Translation provider authentication failed.", retryable: false };
  }
  if (code === "TRANSLATION_PROVIDER_TIMEOUT") {
    return { code, message: "Translation provider timed out.", retryable: true };
  }
  if (code === "TRANSLATION_PROVIDER_NETWORK") {
    return { code, message: "Translation provider is unreachable.", retryable: true };
  }
  if (code === "TRANSLATION_PROVIDER_HTTP_429") {
    if (/insufficient_quota|quota exceeded|quota/i.test(providerResponse)) {
      return {
        code: "TRANSLATION_PROVIDER_QUOTA_EXCEEDED",
        message: "Translation provider quota exceeded.",
        retryable: false
      };
    }
    return { code, message: "Translation provider rate limit reached.", retryable: true };
  }
  if (code.startsWith("TRANSLATION_PROVIDER_HTTP_")) {
    return { code, message: "Translation provider returned an error.", retryable: true };
  }
  if (code === "TRANSLATION_PROVIDER_RESPONSE_INVALID") {
    return { code, message: "Translation provider response is invalid.", retryable: true };
  }
  if (code === "TRANSLATION_TARGET_INVALID") {
    return { code, message: "Translation target locale is invalid.", retryable: false };
  }
  if (code === "TRANSLATION_TARGETS_EMPTY") {
    return { code, message: "No translation target locales configured.", retryable: false };
  }
  return { code: code || "TRANSLATION_PROVIDER_ERROR", message: "Translation provider error.", retryable: true };
}

async function checkTranslationServiceAvailability({ client = null, tenantId = null, runtime, sourceLocale, targetLocale }) {
  const providerCode = sanitizeProviderCode(runtime?.provider_code);
  if (!runtime?.enabled || !providerCode || providerCode === "none") {
    return {
      available: false,
      state: "offline",
      code: "TRANSLATION_PROVIDER_DISABLED",
      message: "Translation service offline."
    };
  }

  const source = normalizeLocale(sourceLocale || runtime.source_locale || "en") || "en";
  const configuredTargets = Array.isArray(runtime?.target_locales) ? runtime.target_locales : [];
  const hasConfiguredTargets = configuredTargets.some((entry) => normalizeLocale(entry) && normalizeLocale(entry) !== source);
  const target =
    normalizeLocale(targetLocale || "") ||
    pickHealthProbeTarget(source, configuredTargets);
  if (!runtime.connection_code) {
    return {
      available: false,
      state: "offline",
      code: "TRANSLATION_GATEWAY_CONNECTION_REQUIRED",
      message: "Translation service offline."
    };
  }

  const healthRequest = buildProviderHealthRequest(runtime, source);
  if (!healthRequest) {
    return {
      available: false,
      state: "offline",
      code: "TRANSLATION_PROVIDER_UNSUPPORTED",
      message: "Translation service offline."
    };
  }

  try {
    const response = await executeGatewayOutboundRequest(client, { tenantId }, {
      connection_code: runtime.connection_code,
      endpoint: healthRequest.endpoint,
      method: healthRequest.method || "GET",
      query: healthRequest.query || undefined,
      headers: healthRequest.headers || undefined,
      body: healthRequest.body || undefined,
      timeout_ms: runtime.timeout_ms
    });
    if (!response.ok) {
      const status = Number(response.status || 0);
      if (status === 401 || status === 403) {
        throw makeProviderError("TRANSLATION_PROVIDER_AUTH_FAILED", "Translation provider authentication failed.", {
          provider_status: status
        });
      }
      throw makeProviderError(`TRANSLATION_PROVIDER_HTTP_${status || 0}`, "Translation provider returned an error.", {
        provider_status: status,
        provider_response: String(response.text || "").slice(0, 500)
      });
    }
    return {
      available: true,
      state: "connected",
      code: hasConfiguredTargets ? "TRANSLATION_CONNECTED" : "TRANSLATION_CONNECTED_NO_TARGETS",
      message: "Translation service connected."
    };
  } catch (error) {
    const normalized = normalizeProviderError(error);
    return {
      available: false,
      state: "offline",
      code: normalized.code,
      message: "Translation service offline."
    };
  }
}

export {
  resolveTranslationRuntime,
  translateTextsThroughProvider,
  checkTranslationServiceAvailability,
  normalizeProviderError
};

