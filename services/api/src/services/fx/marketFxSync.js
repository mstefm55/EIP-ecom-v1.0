import { executeGatewayOutboundRequest } from "../gateway/outbound.js";

const MODULE_CODE = "ecom";
const SETTINGS_CODE = "commerce";
const DEFAULT_BASE_CURRENCY = "USD";
const FX_SOURCE = "FX_SYNC";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value) {
  const trimmed = normalizeText(value);
  return trimmed.length ? trimmed : null;
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeLocale(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeExchangeRate(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(0.000001, Math.min(1000000, Number(n.toFixed(6))));
}

function normalizeCurrency(value, fallback = DEFAULT_BASE_CURRENCY) {
  const upper = normalizeUpper(value);
  if (!/^[A-Z]{3}$/.test(upper)) return fallback;
  return upper;
}

function normalizeJurisdiction(value) {
  return normalizeUpper(value).replace(/[^A-Z0-9_-]/g, "").slice(0, 24);
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
}

function normalizeProviderConnectionCodes(value, appConfig = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    openexchangerates: normalizeOptionalText(
      source.openexchangerates || appConfig.FX_OPENEXCHANGERATES_CONNECTION_CODE
    ),
    ecb: normalizeOptionalText(source.ecb || appConfig.FX_ECB_CONNECTION_CODE)
  };
}

function normalizeTimestampIso(value) {
  const t = Date.parse(String(value || ""));
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

function normalizeFxSettings(translation = {}, appConfig = {}) {
  const source = translation?.fx && typeof translation.fx === "object" ? translation.fx : {};
  const connectionCodes = normalizeProviderConnectionCodes(source.connection_codes, appConfig);
  const baseCurrency = normalizeCurrency(source.base_currency || appConfig.FX_BASE_CURRENCY || "USD", "USD");
  const providers = Array.from(
    new Set(
      [
        ...parseCsv(source.provider_priority),
        ...parseCsv(appConfig.FX_PROVIDER_PRIORITY || ""),
        normalizeText(appConfig.FX_PRIMARY_PROVIDER || "openexchangerates"),
        normalizeText(appConfig.FX_FALLBACK_PROVIDER || "ecb")
      ]
        .map((entry) => normalizeText(entry).toLowerCase())
        .filter(Boolean)
    )
  );
  return {
    enabled: normalizeBoolean(source.enabled, normalizeBoolean(appConfig.FX_SYNC_ENABLED, true)),
    auto_sync: normalizeBoolean(source.auto_sync, true),
    base_currency: baseCurrency,
    connection_codes: connectionCodes,
    provider_priority: providers.length ? providers : ["openexchangerates", "ecb"],
    timeout_ms: Math.max(1000, Math.min(60000, Number(source.timeout_ms || appConfig.FX_TIMEOUT_MS || 12000))),
    freshness_hours: Math.max(1, Math.min(168, Number(source.freshness_hours || appConfig.FX_SYNC_FRESHNESS_HOURS || 24))),
    last_sync_at: normalizeTimestampIso(source.last_sync_at),
    last_provider: normalizeText(source.last_provider).toLowerCase() || null,
    last_error: normalizeText(source.last_error) || null,
    status: normalizeText(source.status).toLowerCase() || "pending"
  };
}

function normalizeTranslation(translation = {}, appConfig = {}) {
  const defaultLocale = normalizeLocale(translation.default_locale) || "en";
  const marketsRaw = Array.isArray(translation.marketplaces) ? translation.marketplaces : [];
  const seen = new Set();
  const marketplaces = [];
  for (const entry of marketsRaw) {
    if (!entry || typeof entry !== "object") continue;
    const jurisdiction = normalizeJurisdiction(entry.jurisdiction_code);
    if (!jurisdiction || seen.has(jurisdiction)) continue;
    seen.add(jurisdiction);
    const currency = normalizeCurrency(entry.currency || entry.quote_currency || "USD", "USD");
    const allowedRaw = Array.isArray(entry.allowed_locales) ? entry.allowed_locales : [];
    const allowed = Array.from(new Set(allowedRaw.map(normalizeLocale).filter(Boolean)));
    const primary = normalizeLocale(entry.primary_locale) || allowed[0] || defaultLocale;
    if (!allowed.includes(primary)) allowed.unshift(primary);
    marketplaces.push({
      ...entry,
      jurisdiction_code: jurisdiction,
      primary_locale: primary,
      allowed_locales: allowed,
      currency,
      exchange_rate: normalizeExchangeRate(entry.exchange_rate, currency === "USD" ? 1 : 1)
    });
  }
  return {
    ...translation,
    default_locale: defaultLocale,
    marketplaces,
    fx: normalizeFxSettings(translation, appConfig)
  };
}

function normalizeOpenExchangeRatesPayload(payload, symbols = []) {
  if (!payload || typeof payload !== "object") return null;
  const rates = payload.rates && typeof payload.rates === "object" ? payload.rates : null;
  if (!rates) return null;
  const out = {};
  for (const symbol of symbols) {
    const code = normalizeCurrency(symbol, "");
    if (!code) continue;
    if (code === "USD") {
      out[code] = 1;
      continue;
    }
    const rate = normalizeExchangeRate(rates[code], null);
    if (rate) out[code] = rate;
  }
  out.USD = 1;
  const asOf = Number.isFinite(Number(payload.timestamp))
    ? new Date(Number(payload.timestamp) * 1000).toISOString()
    : new Date().toISOString();
  return { provider: "openexchangerates", as_of: asOf, rates: out };
}

async function executeFxGatewayRequest({
  client,
  tenantId,
  connectionCode,
  endpoint,
  query,
  timeoutMs
}) {
  if (!client) throw new Error("FX_GATEWAY_CLIENT_REQUIRED");
  if (!normalizeOptionalText(connectionCode)) throw new Error("FX_PROVIDER_CONNECTION_REQUIRED");
  let response;
  try {
    response = await executeGatewayOutboundRequest(client, { tenantId }, {
      connection_code: connectionCode,
      endpoint,
      method: "GET",
      query: query && typeof query === "object" ? query : undefined,
      timeout_ms: timeoutMs
    });
  } catch (error) {
    const msg = normalizeText(error?.message || error);
    if (msg === "GATEWAY_CONNECTION_REQUIRED" || msg === "CONNECTION_NOT_FOUND") {
      throw new Error("FX_PROVIDER_CONNECTION_REQUIRED");
    }
    if (msg === "CONNECTION_DISABLED" || msg === "CONNECTION_OUTBOUND_NOT_ALLOWED" || msg === "OUTBOUND_NOT_CONFIGURED") {
      throw new Error("FX_PROVIDER_CONNECTION_INVALID");
    }
    if (msg === "AbortError") throw new Error("FX_PROVIDER_TIMEOUT");
    throw new Error("FX_PROVIDER_NETWORK");
  }
  const text = String(response?.text || "");
  if (!response?.ok) {
    throw new Error(`FX_PROVIDER_HTTP_${response?.status || 0}:${text.slice(0, 200)}`);
  }
  return text;
}

async function fetchOpenExchangeRates({ client, tenantId, appConfig, symbols, timeoutMs, connectionCode }) {
  const appId = normalizeOptionalText(appConfig.FX_OPENEXCHANGERATES_APP_ID);
  const symbolList = Array.from(new Set(symbols.map((entry) => normalizeCurrency(entry)).filter(Boolean)));
  const text = await executeFxGatewayRequest({
    client,
    tenantId,
    connectionCode,
    endpoint: "/api/latest.json",
    query: {
      ...(appId ? { app_id: appId } : {}),
      ...(symbolList.length ? { symbols: symbolList.join(",") } : {})
    },
    timeoutMs
  });
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("FX_PROVIDER_RESPONSE_INVALID");
  }
  const normalized = normalizeOpenExchangeRatesPayload(payload, symbolList);
  if (!normalized) throw new Error("FX_PROVIDER_RESPONSE_INVALID");
  return normalized;
}

function parseEcbDailyXml(xmlText = "") {
  const raw = String(xmlText || "");
  const map = {};
  const tagRegex = /<Cube\s+([^>]+?)\/?>/g;
  let match;
  while ((match = tagRegex.exec(raw)) !== null) {
    const attrs = String(match[1] || "");
    const codeMatch = attrs.match(/\bcurrency=['"]([A-Z]{3})['"]/i);
    const rateMatch = attrs.match(/\brate=['"]([0-9.]+)['"]/i);
    const code = normalizeCurrency(codeMatch?.[1], "");
    const rate = Number(rateMatch?.[1]);
    if (!code || !Number.isFinite(rate) || rate <= 0) continue;
    map[code] = rate;
  }
  return map;
}

async function fetchEcbUsdCrossRates({ client, tenantId, symbols, timeoutMs, connectionCode }) {
  const text = await executeFxGatewayRequest({
    client,
    tenantId,
    connectionCode,
    endpoint: "/stats/eurofxref/eurofxref-daily.xml",
    timeoutMs
  });
  const eurRates = parseEcbDailyXml(text);
  const usdPerEur = Number(eurRates.USD);
  if (!Number.isFinite(usdPerEur) || usdPerEur <= 0) {
    throw new Error("FX_PROVIDER_RESPONSE_INVALID");
  }
  const out = { USD: 1 };
  for (const symbol of symbols) {
    const code = normalizeCurrency(symbol, "");
    if (!code || code === "USD") continue;
    if (code === "EUR") {
      out.EUR = normalizeExchangeRate(1 / usdPerEur, null);
      continue;
    }
    const quotePerEur = Number(eurRates[code]);
    if (!Number.isFinite(quotePerEur) || quotePerEur <= 0) continue;
    out[code] = normalizeExchangeRate(quotePerEur / usdPerEur, null);
  }
  return {
    provider: "ecb",
    as_of: new Date().toISOString(),
    rates: out
  };
}

async function fetchUsdRatesWithFallback({
  client,
  tenantId,
  appConfig,
  symbols,
  providerPriority,
  timeoutMs,
  connectionCodes
}) {
  const errors = [];
  for (const provider of providerPriority) {
    const connectionCode = normalizeOptionalText(connectionCodes?.[provider]);
    if (!connectionCode) {
      errors.push(`${provider}:FX_PROVIDER_CONNECTION_REQUIRED`);
      continue;
    }
    try {
      if (provider === "openexchangerates") {
        const data = await fetchOpenExchangeRates({
          client,
          tenantId,
          appConfig,
          symbols,
          timeoutMs,
          connectionCode
        });
        return { ok: true, ...data };
      }
      if (provider === "ecb") {
        const data = await fetchEcbUsdCrossRates({
          client,
          tenantId,
          symbols,
          timeoutMs,
          connectionCode
        });
        return { ok: true, ...data };
      }
    } catch (error) {
      errors.push(`${provider}:${normalizeText(error?.message || error)}`);
    }
  }
  return { ok: false, error: errors.join(" | ") || "FX_PROVIDER_UNAVAILABLE" };
}

function computeRateByCurrency(marketplaces, baseCurrency) {
  const map = new Map();
  for (const marketplace of marketplaces) {
    const currency = normalizeCurrency(marketplace?.currency, baseCurrency);
    const rate = normalizeExchangeRate(marketplace?.exchange_rate, null);
    if (!currency || !rate) continue;
    if (!map.has(currency)) map.set(currency, rate);
  }
  if (!map.has(baseCurrency)) map.set(baseCurrency, 1);
  return map;
}

function isFxSyncDue(fxSettings, nowIso) {
  const nowMs = Date.parse(nowIso);
  const lastMs = Date.parse(String(fxSettings?.last_sync_at || ""));
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastMs)) return true;
  const freshnessMs = Math.max(1, Number(fxSettings?.freshness_hours || 24)) * 3600 * 1000;
  return nowMs - lastMs >= freshnessMs;
}

async function upsertFxConditionRows(client, tenantId, marketplaces, meta) {
  const keepCodes = [];
  for (const marketplace of marketplaces) {
    const jurisdiction = normalizeJurisdiction(marketplace?.jurisdiction_code);
    if (!jurisdiction) continue;
    const code = `FX_RATE_${jurisdiction}`;
    keepCodes.push(code);
    const quoteCurrency = normalizeCurrency(marketplace.currency, meta.base_currency || "USD");
    const rate = normalizeExchangeRate(marketplace.exchange_rate, quoteCurrency === meta.base_currency ? 1 : null);
    if (!rate) continue;
    await client.query(
      `
      INSERT INTO eip_core.commercial_condition
        (tenant_id, code, label, condition_type, condition_category, priority, is_active, scope, effect, attrs)
      VALUES
        ($1::uuid, $2, $3, 'FOREX_RATE', 'FOREX', 20, true, $4::jsonb, $5::jsonb, $6::jsonb)
      ON CONFLICT (tenant_id, code) DO UPDATE
        SET label = EXCLUDED.label,
            condition_type = EXCLUDED.condition_type,
            condition_category = EXCLUDED.condition_category,
            priority = EXCLUDED.priority,
            is_active = true,
            scope = EXCLUDED.scope,
            effect = EXCLUDED.effect,
            attrs = COALESCE(eip_core.commercial_condition.attrs, '{}'::jsonb) || EXCLUDED.attrs,
            updated_at = now()
      `,
      [
        tenantId,
        code,
        `FX ${meta.base_currency}->${quoteCurrency} (${jurisdiction})`,
        JSON.stringify({
          jurisdictions: [jurisdiction],
          currency: quoteCurrency
        }),
        JSON.stringify({
          rate,
          base_currency: meta.base_currency,
          quote_currency: quoteCurrency,
          provider: meta.provider,
          as_of: meta.as_of
        }),
        JSON.stringify({
          source: FX_SOURCE,
          synced_at: meta.synced_at
        })
      ]
    );
  }

  await client.query(
    `
    UPDATE eip_core.commercial_condition
    SET is_active = false,
        updated_at = now()
    WHERE tenant_id = $1::uuid
      AND COALESCE(attrs->>'source', '') = $2
      AND (CASE WHEN $3::text[] IS NULL THEN true ELSE NOT (code = ANY($3::text[])) END)
    `,
    [tenantId, FX_SOURCE, keepCodes.length ? keepCodes : null]
  );
}

async function saveTenantCommerceSettings(client, tenantId, attrs) {
  const payload = attrs && typeof attrs === "object" ? attrs : {};
  await client.query(
    `
    INSERT INTO eip_core.tenant_module_setting
      (tenant_id, module, code, attrs, is_active)
    VALUES
      ($1::uuid, $2, $3, $4::jsonb, true)
    ON CONFLICT (tenant_id, module, code) DO UPDATE
      SET attrs = EXCLUDED.attrs,
          is_active = true,
          updated_at = now()
    `,
    [tenantId, MODULE_CODE, SETTINGS_CODE, JSON.stringify(payload)]
  );
}

async function loadTenantCommerceSettings(client, tenantId) {
  const r = await client.query(
    `
    SELECT attrs
    FROM eip_core.tenant_module_setting
    WHERE tenant_id = $1::uuid
      AND module = $2
      AND code = $3
      AND is_active = true
    LIMIT 1
    `,
    [tenantId, MODULE_CODE, SETTINGS_CODE]
  );
  return r.rows[0]?.attrs && typeof r.rows[0].attrs === "object" ? r.rows[0].attrs : {};
}

function buildSyncSummary({ ok, tenantId, provider = null, syncedAt = null, marketplaces = 0, updated = 0, skipped = false, reason = null, error = null }) {
  return {
    ok,
    tenant_id: tenantId,
    provider,
    synced_at: syncedAt,
    marketplaces,
    updated,
    skipped,
    reason,
    error
  };
}

async function syncTenantMarketplaceFx(client, appConfig, tenantId, settingsAttrs = {}, options = {}) {
  const nowIso = new Date().toISOString();
  const force = options.force === true;
  const attrs = settingsAttrs && typeof settingsAttrs === "object" ? { ...settingsAttrs } : {};
  const translationRaw = attrs.translation && typeof attrs.translation === "object" ? attrs.translation : {};
  const translation = normalizeTranslation(translationRaw, appConfig);
  const fx = translation.fx;

  if (!fx.enabled) {
    translation.fx = { ...fx, status: "disabled", last_error: "FX_SYNC_DISABLED" };
    attrs.translation = translation;
    return buildSyncSummary({ ok: true, tenantId, skipped: true, reason: "FX_DISABLED", marketplaces: translation.marketplaces.length });
  }

  if (!force && !fx.auto_sync) {
    return buildSyncSummary({ ok: true, tenantId, skipped: true, reason: "AUTO_SYNC_DISABLED", marketplaces: translation.marketplaces.length });
  }

  if (!force && !isFxSyncDue(fx, nowIso)) {
    return buildSyncSummary({ ok: true, tenantId, skipped: true, reason: "NOT_DUE", marketplaces: translation.marketplaces.length });
  }

  if (!Array.isArray(translation.marketplaces) || translation.marketplaces.length === 0) {
    return buildSyncSummary({ ok: true, tenantId, skipped: true, reason: "NO_MARKETPLACES", marketplaces: 0 });
  }

  const symbols = Array.from(
    new Set(
      translation.marketplaces
        .map((entry) => normalizeCurrency(entry.currency, fx.base_currency))
        .filter(Boolean)
    )
  );
  if (!symbols.includes(fx.base_currency)) symbols.push(fx.base_currency);

  const providerResult = await fetchUsdRatesWithFallback({
    client,
    tenantId,
    appConfig,
    symbols,
    providerPriority: fx.provider_priority,
    timeoutMs: fx.timeout_ms,
    connectionCodes: fx.connection_codes || {}
  });

  if (!providerResult.ok) {
    translation.fx = {
      ...fx,
      status: "offline",
      last_error: providerResult.error || "FX_PROVIDER_UNAVAILABLE"
    };
    attrs.translation = translation;
    await saveTenantCommerceSettings(client, tenantId, attrs);
    return buildSyncSummary({
      ok: false,
      tenantId,
      marketplaces: translation.marketplaces.length,
      error: providerResult.error || "FX_PROVIDER_UNAVAILABLE"
    });
  }

  const rates = providerResult.rates || {};
  let updated = 0;
  const marketplaces = translation.marketplaces.map((entry) => {
    const currency = normalizeCurrency(entry.currency, fx.base_currency);
    const rate = currency === fx.base_currency
      ? 1
      : normalizeExchangeRate(rates[currency], entry.exchange_rate || null);
    if (!rate) return { ...entry };
    updated += 1;
    return {
      ...entry,
      currency,
      exchange_rate: rate
    };
  });
  const syncedAt = new Date().toISOString();
  translation.marketplaces = marketplaces;
  translation.fx = {
    ...fx,
    status: "connected",
    base_currency: fx.base_currency,
    last_provider: providerResult.provider,
    last_sync_at: syncedAt,
    last_error: null
  };
  attrs.translation = translation;

  await saveTenantCommerceSettings(client, tenantId, attrs);

  const conditionMeta = {
    base_currency: fx.base_currency,
    provider: providerResult.provider,
    as_of: providerResult.as_of || syncedAt,
    synced_at: syncedAt
  };
  await upsertFxConditionRows(client, tenantId, marketplaces, conditionMeta);

  return buildSyncSummary({
    ok: true,
    tenantId,
    provider: providerResult.provider,
    syncedAt,
    marketplaces: marketplaces.length,
    updated
  });
}

async function syncTenantMarketplaceFxByTenantId(app, tenantId, options = {}) {
  const client = await app.db.connect();
  try {
    await client.query("BEGIN");
    const attrs = await loadTenantCommerceSettings(client, tenantId);
    const result = await syncTenantMarketplaceFx(client, app.config || {}, tenantId, attrs, options);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    return {
      ok: false,
      tenant_id: tenantId,
      error: normalizeText(error?.message || error) || "FX_SYNC_FAILED"
    };
  } finally {
    client.release();
  }
}

async function syncAllTenantMarketplaceFx(app, options = {}) {
  const r = await app.db.query(
    `
    SELECT tenant_id
    FROM eip_core.tenant_module_setting
    WHERE module = $1
      AND code = $2
      AND is_active = true
    ORDER BY tenant_id
    `,
    [MODULE_CODE, SETTINGS_CODE]
  );
  const tenantIds = Array.from(new Set((r.rows || []).map((row) => normalizeText(row.tenant_id)).filter(Boolean)));
  const results = [];
  for (const tenantId of tenantIds) {
    const result = await syncTenantMarketplaceFxByTenantId(app, tenantId, options);
    results.push(result);
  }
  return results;
}

function resolveMarketplaceFxContext(translationSettings = {}, input = {}) {
  const translation = normalizeTranslation(translationSettings, {});
  const baseCurrency = normalizeCurrency(translation.fx?.base_currency || "USD", "USD");
  const jurisdiction = normalizeJurisdiction(input.jurisdiction);
  const requestedCurrency = normalizeCurrency(input.currency || "", "");
  const marketplaces = Array.isArray(translation.marketplaces) ? translation.marketplaces : [];
  const byCurrency = computeRateByCurrency(marketplaces, baseCurrency);
  const byJurisdiction = new Map();
  for (const entry of marketplaces) {
    const code = normalizeJurisdiction(entry.jurisdiction_code);
    if (!code || byJurisdiction.has(code)) continue;
    byJurisdiction.set(code, entry);
  }

  const selectedMarketplace = jurisdiction ? byJurisdiction.get(jurisdiction) : null;
  const targetCurrency = requestedCurrency || normalizeCurrency(selectedMarketplace?.currency, baseCurrency) || baseCurrency;
  const rawRate = targetCurrency === baseCurrency ? 1 : byCurrency.get(targetCurrency);
  const rate = normalizeExchangeRate(rawRate, targetCurrency === baseCurrency ? 1 : 1);

  return {
    jurisdiction: jurisdiction || null,
    base_currency: baseCurrency,
    target_currency: targetCurrency,
    rate
  };
}

export {
  normalizeFxSettings,
  normalizeTranslation,
  syncTenantMarketplaceFxByTenantId,
  syncAllTenantMarketplaceFx,
  resolveMarketplaceFxContext
};
