import { randomUUID } from "node:crypto";
import { hasPermission } from "../auth/perm.js";
import { sha256Hex } from "../auth/crypto.js";
import { extractProfiles } from "../services/gateway/connectionProfile.js";
import {
  DEFAULT_PAYMENT_SETTINGS,
  buildPaymentReadiness,
  normalizePaymentSettings,
  sanitizePaymentMetadata
} from "../services/payments/paymentFoundation.js";
import {
  normalizeFxSettings,
  normalizeTranslation as normalizeFxTranslation,
  syncTenantMarketplaceFxByTenantId
} from "../services/fx/marketFxSync.js";

const MAX_LIMIT = 200;
const SETTINGS_MODULE = "ecom";
const SETTINGS_CODE = "commerce";
const ORDER_OBJECT_TYPE = "sales_order";
const RETURN_OBJECT_TYPE = "return_request";
const REFUND_OBJECT_TYPE = "refund_request";
const PAYMENT_OBJECT_TYPE = "payment";

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

const TRANSLATION_PROVIDER_LIST_CODE = "TRANSLATION_PROVIDER";
const TRANSLATION_QUALITY_LIST_CODE = "TRANSLATION_QUALITY";
const TRANSLATION_CHARGE_MODE_LIST_CODE = "TRANSLATION_CHARGE_MODE";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value) {
  const trimmed = normalizeText(value);
  return trimmed.length ? trimmed : null;
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return fallback;
  const normalized = normalizeText(value).toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function clampLimit(value) {
  const n = Number(value || 50);
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, n));
}

function buildIdempotencyKey(prefix, payload) {
  return sha256Hex(`${prefix}:${JSON.stringify(payload || {})}`);
}

function buildCode(prefix) {
  return `${prefix}-${randomUUID().split("-")[0].toUpperCase()}`;
}

function mergeTranslationPatch(baseTranslation = {}, patch = {}) {
  const base = baseTranslation && typeof baseTranslation === "object" ? baseTranslation : {};
  const source = patch && typeof patch === "object" ? patch : {};
  const merged = { ...base, ...source };

  const baseEngine = base.engine && typeof base.engine === "object" ? base.engine : {};
  const sourceEngine = source.engine && typeof source.engine === "object" ? source.engine : null;
  merged.engine = sourceEngine ? { ...baseEngine, ...sourceEngine } : baseEngine;

  const baseBilling = base.billing && typeof base.billing === "object" ? base.billing : {};
  const sourceBilling = source.billing && typeof source.billing === "object" ? source.billing : null;
  merged.billing = sourceBilling ? { ...baseBilling, ...sourceBilling } : baseBilling;

  const baseFx = base.fx && typeof base.fx === "object" ? base.fx : {};
  const sourceFx = source.fx && typeof source.fx === "object" ? source.fx : null;
  if (sourceFx) {
    const baseCodes =
      baseFx.connection_codes && typeof baseFx.connection_codes === "object"
        ? baseFx.connection_codes
        : {};
    const sourceCodes =
      sourceFx.connection_codes && typeof sourceFx.connection_codes === "object"
        ? sourceFx.connection_codes
        : null;
    merged.fx = {
      ...baseFx,
      ...sourceFx,
      connection_codes: sourceCodes ? { ...baseCodes, ...sourceCodes } : baseCodes
    };
  } else {
    merged.fx = baseFx;
  }

  return merged;
}

function mergeSettings(base, override) {
  if (!override || typeof override !== "object") return base;
  const translationBase = base.translation || {};
  const translationOverride = override.translation || {};
  const translation = normalizeTranslationSettings(
    mergeTranslationPatch(translationBase, translationOverride),
    DEFAULT_SETTINGS.translation
  );
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
  return normalizeText(value).toLowerCase();
}

function isValidLocaleCode(value) {
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(normalizeText(value));
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

function normalizeCurrency(value, fallback = "USD") {
  const upper = normalizeText(value).toUpperCase();
  if (!/^[A-Z]{3}$/.test(upper)) return fallback;
  return upper;
}

function extractJurisdictionCurrency(attrs) {
  if (!attrs || typeof attrs !== "object") return null;
  const directCandidates = [
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

function normalizeTranslationEngine(input, fallback) {
  const base = fallback && typeof fallback === "object" ? fallback : {};
  const source = input && typeof input === "object" ? input : {};
  const out = { ...base, ...source };
  return {
    enabled: normalizeBoolean(out.enabled, normalizeBoolean(base.enabled, false)),
    provider_code: normalizeText(out.provider_code || base.provider_code || "none").toLowerCase() || "none",
    quality_tier: normalizeText(out.quality_tier || base.quality_tier || "balanced").toLowerCase() || "balanced",
    source_locale: normalizeLocale(out.source_locale) || normalizeLocale(base.source_locale) || "en",
    connection_code: normalizeOptionalText(out.connection_code || base.connection_code)
  };
}

function normalizeTranslationBilling(input, fallback) {
  const base = fallback && typeof fallback === "object" ? fallback : {};
  const source = input && typeof input === "object" ? input : {};
  const out = { ...base, ...source };
  return {
    charge_mode: normalizeText(out.charge_mode || base.charge_mode || "pass_through").toLowerCase() || "pass_through",
    markup_percent: normalizePercentage(out.markup_percent, normalizePercentage(base.markup_percent, 0)),
    fixed_fee_minor: normalizeNonNegativeInteger(
      out.fixed_fee_minor,
      normalizeNonNegativeInteger(base.fixed_fee_minor, 0)
    ),
    currency: normalizeCurrency(out.currency, normalizeCurrency(base.currency, "USD"))
  };
}

function normalizeTranslationSettings(input, fallback) {
  const base = fallback && typeof fallback === "object" ? fallback : {};
  const out = input && typeof input === "object" ? { ...base, ...input } : { ...base };
  out.default_locale = normalizeLocale(out.default_locale) || normalizeLocale(base.default_locale) || "en";
  out.locale_options = normalizeLocaleOptionList(out.locale_options);
  const fxNormalized = normalizeFxTranslation(
    {
      default_locale: out.default_locale,
      marketplaces: Array.isArray(out.marketplaces) ? out.marketplaces : base.marketplaces || [],
      fx: out.fx
    },
    {}
  );
  out.default_locale = fxNormalized.default_locale || out.default_locale;
  out.marketplaces = Array.isArray(fxNormalized.marketplaces) ? fxNormalized.marketplaces : [];
  out.engine = normalizeTranslationEngine(out.engine, base.engine);
  out.billing = normalizeTranslationBilling(out.billing, base.billing);
  out.fx = normalizeFxSettings(
    { fx: out.fx || fxNormalized.fx || base.fx || DEFAULT_SETTINGS.translation.fx },
    {}
  );
  return out;
}

async function loadSettings(client, tenantId) {
  const r = await client.query(
    `
    SELECT attrs
    FROM eip_core.tenant_module_setting
    WHERE tenant_id=$1 AND module=$2 AND code=$3 AND is_active=true
    LIMIT 1
    `,
    [tenantId, SETTINGS_MODULE, SETTINGS_CODE]
  );
  return mergeSettings(DEFAULT_SETTINGS, r.rows[0]?.attrs || {});
}

async function upsertSettings(client, tenantId, attrs) {
  const payload = attrs && typeof attrs === "object" ? attrs : {};
  const normalized = mergeSettings(DEFAULT_SETTINGS, payload);
  const r = await client.query(
    `
    INSERT INTO eip_core.tenant_module_setting
      (tenant_id, module, code, attrs, is_active)
    VALUES
      ($1,$2,$3,$4::jsonb,true)
    ON CONFLICT (tenant_id, module, code) DO UPDATE
      SET attrs = EXCLUDED.attrs,
          is_active = true,
          updated_at = now()
    RETURNING attrs
    `,
    [tenantId, SETTINGS_MODULE, SETTINGS_CODE, JSON.stringify(normalized)]
  );
  return mergeSettings(DEFAULT_SETTINGS, r.rows[0]?.attrs || {});
}

async function loadDropdownOptions(client, tenantId, listCode) {
  const r = await client.query(
    `
    SELECT
      dv.code,
      dv.label,
      dv.sort_order,
      COALESCE(dv.attrs, '{}'::jsonb) AS attrs
    FROM eip_core.dropdown_list dl
    JOIN eip_core.dropdown_value dv
      ON dv.list_id = dl.id
    WHERE dl.tenant_id = $1::uuid
      AND dl.module = 'ecom'
      AND dl.code = $2
      AND dl.version = 1
      AND dl.is_active = true
      AND dv.is_active = true
    ORDER BY dv.sort_order NULLS LAST, dv.label
    `,
    [tenantId, listCode]
  );
  return (r.rows || []).map((row) => ({
    code: normalizeText(row.code).toLowerCase(),
    label: normalizeText(row.label) || normalizeText(row.code),
    sort_order: Number(row.sort_order || 0),
    attrs: row.attrs || {}
  }));
}

async function loadOutboundConnections(client, tenantId) {
  const r = await client.query(
    `
    SELECT attrs
    FROM eip_core.tenant
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [tenantId]
  );
  if (!r.rowCount) return [];
  const profiles = extractProfiles(r.rows[0]?.attrs || {});
  return profiles
    .filter((profile) => {
      const direction = normalizeText(profile?.identity?.direction).toLowerCase();
      const kind = normalizeText(profile?.identity?.connection_kind || "custom").toLowerCase();
      const enabled = profile?.identity?.is_enabled !== false;
      if (!enabled || (direction !== "outbound" && direction !== "both")) return false;
      if (kind === "website" || kind === "ecommerce") return false;
      return true;
    })
    .map((profile) => ({
      connection_code: normalizeText(profile?.identity?.connection_code),
      connection_name: normalizeText(profile?.identity?.connection_name) || normalizeText(profile?.identity?.connection_code),
      connection_kind: normalizeText(profile?.identity?.connection_kind || "custom"),
      environment: normalizeText(profile?.identity?.environment || "production"),
      base_url: normalizeText(profile?.outbound?.base_url || "")
    }))
    .filter((item) => item.connection_code)
    .sort((a, b) => a.connection_name.localeCompare(b.connection_name));
}

async function loadJurisdictionOptions(client) {
  const r = await client.query(
    `
    SELECT code, name, COALESCE(attrs, '{}'::jsonb) AS attrs
    FROM eip_core.jurisdiction
    WHERE tenant_id IS NULL
      AND level = 'COUNTRY'
      AND is_active = true
    ORDER BY name ASC
    `
  );
  return (r.rows || [])
    .map((row) => {
      const code = normalizeText(row.code).toUpperCase();
      if (!code) return null;
      return {
        code,
        label: normalizeText(row.name) || code,
        currency: extractJurisdictionCurrency(row.attrs || {}) || "USD"
      };
    })
    .filter(Boolean);
}

async function loadTranslationCatalog(client, tenantId) {
  const [providers, quality_tiers, charge_modes, connections, jurisdictions] = await Promise.all([
    loadDropdownOptions(client, tenantId, TRANSLATION_PROVIDER_LIST_CODE),
    loadDropdownOptions(client, tenantId, TRANSLATION_QUALITY_LIST_CODE),
    loadDropdownOptions(client, tenantId, TRANSLATION_CHARGE_MODE_LIST_CODE),
    loadOutboundConnections(client, tenantId),
    loadJurisdictionOptions(client)
  ]);
  return {
    providers,
    quality_tiers,
    charge_modes,
    connections,
    jurisdictions
  };
}

function isFxSyncStale(fx = {}) {
  const freshnessHours = Math.max(1, Number(fx.freshness_hours || 24));
  const lastSyncMs = Date.parse(String(fx.last_sync_at || ""));
  if (!Number.isFinite(lastSyncMs)) return true;
  return Date.now() - lastSyncMs > freshnessHours * 60 * 60 * 1000;
}

function buildFxStatus(settings = {}) {
  const translation = settings.translation || DEFAULT_SETTINGS.translation;
  const fx = translation.fx || DEFAULT_SETTINGS.translation.fx;
  const marketplaces = Array.isArray(translation.marketplaces) ? translation.marketplaces : [];
  return {
    enabled: fx.enabled === true,
    auto_sync: fx.auto_sync !== false,
    base_currency: normalizeCurrency(fx.base_currency, "USD"),
    connection_codes:
      fx.connection_codes && typeof fx.connection_codes === "object"
        ? {
            openexchangerates: normalizeOptionalText(fx.connection_codes.openexchangerates),
            ecb: normalizeOptionalText(fx.connection_codes.ecb)
          }
        : {
            openexchangerates: null,
            ecb: null
          },
    provider_priority: Array.isArray(fx.provider_priority) ? fx.provider_priority : [],
    timeout_ms: Number(fx.timeout_ms || 12000),
    freshness_hours: Number(fx.freshness_hours || 24),
    last_sync_at: fx.last_sync_at || null,
    last_provider: fx.last_provider || null,
    last_error: fx.last_error || null,
    status: normalizeText(fx.status || "pending").toLowerCase() || "pending",
    stale: isFxSyncStale(fx),
    marketplaces: marketplaces.map((entry) => ({
      jurisdiction_code: normalizeText(entry?.jurisdiction_code).toUpperCase() || null,
      currency: normalizeCurrency(entry?.currency, "USD"),
      exchange_rate: Number(entry?.exchange_rate || 0)
    }))
  };
}

async function requirePerm(app, req, reply, permCode) {
  const s = await app.requireSession(req, { realm: "EIP" });
  if (!s.ok) {
    reply.code(s.status).send({ ok: false, error: s.error });
    return null;
  }

  const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, permCode);
  if (!allowed) {
    app.log.warn({
      event: "ecom_permission_denied",
      permission: permCode,
      tenantId: s.session.tenant_id,
      identityId: s.session.identity_id,
      method: req.method,
      url: req.url
    });
    reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    return null;
  }

  return s.session;
}

async function requireWrite(app, req, reply, permCode) {
  const s = await app.requireSession(req, { realm: "EIP" });
  if (!s.ok) {
    reply.code(s.status).send({ ok: false, error: s.error });
    return null;
  }

  const c = await app.requireCsrf(req);
  if (!c.ok) {
    reply.code(c.status).send({ ok: false, error: c.error });
    return null;
  }

  const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, permCode);
  if (!allowed) {
    app.log.warn({
      event: "ecom_permission_denied",
      permission: permCode,
      tenantId: s.session.tenant_id,
      identityId: s.session.identity_id,
      method: req.method,
      url: req.url
    });
    reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    return null;
  }

  return s.session;
}

async function resolveProcessBinding(client, tenantId, objectType) {
  const r = await client.query(
    `
    SELECT process_def_id, attrs
    FROM eip_core.process_binding
    WHERE tenant_id = $1
      AND service_object_type = $2
      AND is_active = true
    ORDER BY priority ASC, created_at DESC
    LIMIT 1
    `,
    [tenantId, objectType]
  );
  return r.rows[0] || null;
}

async function startProcessFor(client, app, opts) {
  const { tenantId, identityId, objectType, serviceObjectId, serviceObject, requireBinding } = opts;
  const binding = await resolveProcessBinding(client, tenantId, objectType);
  if (!binding) {
    if (requireBinding) return { ok: false, error: "PROCESS_BINDING_REQUIRED" };
    return { ok: true, skipped: true };
  }

  try {
    const result = await app.coreProcess.createInstance(client, {
      tenantId,
      identityId,
      serviceObjectId,
      serviceObject,
      processDefId: binding.process_def_id,
      idempotencyKey: serviceObjectId ? `auto:${objectType}:${serviceObjectId}` : null
    });
    if (!result.ok) return { ok: false, error: result.error };
    return {
      ok: true,
      instance: result.item,
      service_object: result.service_object || null,
      reused: result.reused === true
    };
  } catch (err) {
    return { ok: false, error: err?.message || "PROCESS_INSTANCE_FAILED" };
  }
}

async function ensureProcessInstance(client, app, opts) {
  const { tenantId, identityId, serviceObjectId, objectType } = opts;
  const active = await app.coreProcess.findActiveInstance(client, tenantId, serviceObjectId);
  if (active) return { ok: true, instance: active };

  const started = await startProcessFor(client, app, {
    tenantId,
    identityId,
    objectType,
    serviceObjectId,
    requireBinding: true
  });
  if (!started.ok) return started;
  if (!started.instance) return { ok: false, error: "PROCESS_INSTANCE_REQUIRED" };
  return { ok: true, instance: started.instance };
}

async function fetchOrderItems(client, tenantId, orderId) {
  const r = await client.query(
    `
    SELECT
      ol.id,
      ol.attrs,
      m.id AS material_id,
      m.code AS material_code,
      m.name AS material_name,
      m.material_type,
      m.attrs AS material_attrs
    FROM eip_core.object_link ol
    JOIN eip_core.material m ON m.id = ol.dst_id
    WHERE ol.tenant_id=$1
      AND ol.src_kind='service_object'
      AND ol.src_id=$2
      AND ol.relation_type='ORDER_ITEM'
      AND ol.is_active=true
    ORDER BY ol.created_at ASC
    `,
    [tenantId, orderId]
  );
  return r.rows || [];
}

async function fetchLinkedObjects(client, tenantId, orderId, relationType, objectType) {
  const r = await client.query(
    `
    SELECT so.id, so.code, so.title, so.status, so.attrs, so.created_at, so.updated_at
    FROM eip_core.object_link ol
    JOIN eip_core.service_object so
      ON so.id = ol.src_id AND so.tenant_id = ol.tenant_id
    WHERE ol.tenant_id=$1
      AND ol.dst_kind='service_object'
      AND ol.dst_id=$2
      AND ol.relation_type=$3
      AND ol.is_active=true
      AND so.object_type=$4
    ORDER BY so.created_at DESC
    `,
    [tenantId, orderId, relationType, objectType]
  );
  return r.rows || [];
}

async function resolveOrder(client, tenantId, orderId) {
  const r = await client.query(
    `
    SELECT id, code, title, status, attrs, created_at, updated_at,
           attrs->'workflow'->>'stage' AS stage
    FROM eip_core.service_object
    WHERE tenant_id=$1 AND id=$2 AND object_type=$3
    `,
    [tenantId, orderId, ORDER_OBJECT_TYPE]
  );
  return r.rows[0] || null;
}

async function loadTenantConnectionProfiles(client, tenantId) {
  const r = await client.query(
    `
    SELECT attrs
    FROM eip_core.tenant
    WHERE id=$1::uuid
    LIMIT 1
    `,
    [tenantId]
  );
  return r.rowCount ? extractProfiles(r.rows[0]?.attrs || {}) : [];
}

async function resolvePayment(client, tenantId, paymentId) {
  const r = await client.query(
    `
    SELECT
      so.id, so.code, so.title, so.status, so.attrs, so.created_at, so.updated_at,
      ord.id AS order_id, ord.code AS order_code
    FROM eip_core.service_object so
    LEFT JOIN eip_core.object_link ol
      ON ol.tenant_id=so.tenant_id
     AND ol.src_kind='service_object'
     AND ol.src_id=so.id
     AND ol.relation_type='PAYMENT_FOR'
     AND ol.is_active=true
    LEFT JOIN eip_core.service_object ord
      ON ord.id=ol.dst_id AND ord.tenant_id=so.tenant_id
    WHERE so.tenant_id=$1 AND so.id=$2 AND so.object_type=$3
    LIMIT 1
    `,
    [tenantId, paymentId, PAYMENT_OBJECT_TYPE]
  );
  return r.rows[0] || null;
}

async function writePaymentInfoRecords(client, opts) {
  const payload = sanitizePaymentMetadata({
    payment_id: opts.paymentId,
    payment_code: opts.paymentCode,
    order_id: opts.orderId || null,
    order_code: opts.orderCode || null,
    provider: opts.provider || null,
    method: opts.method || null,
    status: opts.status || null,
    amount: opts.amount ?? null,
    currency: opts.currency || null,
    event_type: opts.eventType,
    source: opts.source || "eip",
    metadata: opts.metadata || {}
  });

  await client.query(
    `
    INSERT INTO eip_core.info_record (tenant_id, record_type, title, payload)
    VALUES
      ($1, 'ECOM_PAYMENT_EVENT', $2, $3::jsonb),
      ($1, 'CRM_PAYMENT_SIGNAL', $4, $3::jsonb)
    `,
    [
      opts.tenantId,
      `payment.${opts.paymentCode}.${opts.eventType}`,
      JSON.stringify(payload),
      `crm.payment.${opts.paymentCode}.${opts.eventType}`
    ]
  );
}

async function runGovernedPaymentAction(client, app, opts) {
  const instanceRes = await ensureProcessInstance(client, app, {
    tenantId: opts.tenantId,
    identityId: opts.identityId,
    serviceObjectId: opts.payment.id,
    objectType: PAYMENT_OBJECT_TYPE
  });
  if (!instanceRes.ok) return instanceRes;

  const payload = {
    payment_id: opts.payment.id,
    payment_code: opts.payment.code,
    order_id: opts.payment.order_id || null,
    order_code: opts.payment.order_code || null,
    ...(opts.payload || {})
  };
  const result = await app.coreProcess.advanceInstance(client, {
    tenantId: opts.tenantId,
    identityId: opts.identityId,
    instanceId: instanceRes.instance.id,
    action: opts.action,
    payload,
    idempotencyKey:
      normalizeOptionalText(opts.idempotencyKey) ||
      buildIdempotencyKey("ecom_payment_action", { id: opts.payment.id, action: opts.action, payload })
  });
  if (!result.ok) return result;

  await writePaymentInfoRecords(client, {
    tenantId: opts.tenantId,
    paymentId: opts.payment.id,
    paymentCode: opts.payment.code,
    orderId: opts.payment.order_id,
    orderCode: opts.payment.order_code,
    provider: opts.payment.attrs?.provider,
    method: opts.payment.attrs?.method,
    status: opts.eventStatus,
    amount: opts.payment.attrs?.amount,
    currency: opts.payment.attrs?.currency,
    eventType: opts.eventType,
    source: opts.source || "eip_operator",
    metadata: opts.payload
  });

  return { ok: true, reused: result.reused === true };
}

async function createLinkedRequest(client, app, opts) {
  const {
    tenantId,
    identityId,
    order,
    objectType,
    codePrefix,
    relationType,
    actionRequest,
    autoApproveAction,
    attrs
  } = opts;

  let attempt = 0;
  let requestRow;
  let instance;

  while (attempt < 6) {
    const code = buildCode(codePrefix);
    const titlePrefix = objectType === RETURN_OBJECT_TYPE ? "Return" : "Refund";
    const serviceObject = {
      object_type: objectType,
      status: "new",
      code,
      title: `${titlePrefix} ${code}`,
      attrs,
      links: [
        {
          src_kind: "service_object",
          src_id: "$service_object_id",
          dst_kind: "service_object",
          dst_id: order.id,
          relation_type: relationType,
          attrs: { order_code: order.code }
        }
      ]
    };

    const started = await startProcessFor(client, app, {
      tenantId,
      identityId,
      objectType,
      serviceObject,
      requireBinding: true
    });

    if (!started.ok) {
      if (String(started.error || "").includes("service_object_code_unique_per_tenant")) {
        attempt += 1;
        continue;
      }
      return { ok: false, error: started.error || "PROCESS_INSTANCE_FAILED" };
    }

    requestRow = started.service_object;
    instance = started.instance;
    break;
  }

  if (!requestRow || !instance) return { ok: false, error: "REQUEST_CREATE_FAILED" };

  const requestPayload = {
    service_object_id: requestRow.id,
    order_id: order.id,
    order_code: order.code
  };
  const requestKey = buildIdempotencyKey(`${objectType}:request`, requestPayload);
  const requestAdvance = await app.coreProcess.advanceInstance(client, {
    tenantId,
    identityId,
    instanceId: instance.id,
    action: actionRequest,
    payload: requestPayload,
    idempotencyKey: requestKey
  });
  if (!requestAdvance.ok) return { ok: false, error: requestAdvance.error };

  if (autoApproveAction) {
    const approveKey = buildIdempotencyKey(`${objectType}:approve`, requestPayload);
    const approveAdvance = await app.coreProcess.advanceInstance(client, {
      tenantId,
      identityId,
      instanceId: instance.id,
      action: autoApproveAction,
      payload: requestPayload,
      idempotencyKey: approveKey
    });
    if (!approveAdvance.ok) return { ok: false, error: approveAdvance.error };
  }

  return { ok: true, item: requestRow };
}

export default async function commerceOrdersRoutes(app) {
  app.get(
    "/commerce/settings",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_ORDER_READ");
      if (!session) return;
      const settings = await loadSettings(app.db, session.tenant_id);
      return reply.send({ ok: true, settings });
    }
  );

  app.put(
    "/commerce/settings",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: true
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_SETTINGS_WRITE");
      if (!session) return;
      const current = await loadSettings(app.db, session.tenant_id);
      const candidate = mergeSettings(current, req.body || {});
      candidate.translation = normalizeTranslationSettings(
        {
          ...(candidate.translation || {}),
          billing: current.translation?.billing || DEFAULT_SETTINGS.translation.billing
        },
        DEFAULT_SETTINGS.translation
      );
      const settings = await upsertSettings(app.db, session.tenant_id, candidate);
      return reply.send({ ok: true, settings });
    }
  );

  app.get(
    "/commerce/translation/catalog",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_ORDER_READ");
      if (!session) return;
      const catalog = await loadTranslationCatalog(app.db, session.tenant_id);
      return reply.send({ ok: true, catalog });
    }
  );

  app.get(
    "/commerce/translation/settings",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_ORDER_READ");
      if (!session) return;
      const settings = await loadSettings(app.db, session.tenant_id);
      return reply.send({ ok: true, translation: settings.translation || DEFAULT_SETTINGS.translation });
    }
  );

  app.put(
    "/commerce/translation/settings",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: true
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_SETTINGS_WRITE");
      if (!session) return;
      const current = await loadSettings(app.db, session.tenant_id);
      const next = mergeSettings(current, { translation: req.body || {} });
      next.translation = normalizeTranslationSettings(
        {
          ...(next.translation || {}),
          billing: current.translation?.billing || DEFAULT_SETTINGS.translation.billing
        },
        DEFAULT_SETTINGS.translation
      );
      const settings = await upsertSettings(app.db, session.tenant_id, next);
      return reply.send({ ok: true, translation: settings.translation || DEFAULT_SETTINGS.translation });
    }
  );

  app.get(
    "/commerce/fx/status",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_ORDER_READ");
      if (!session) return;
      const settings = await loadSettings(app.db, session.tenant_id);
      return reply.send({ ok: true, fx: buildFxStatus(settings) });
    }
  );

  app.post(
    "/commerce/fx/sync",
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_SETTINGS_WRITE");
      if (!session) return;

      const result = await syncTenantMarketplaceFxByTenantId(app, session.tenant_id, { force: true });
      if (!result?.ok) {
        return reply.code(503).send({
          ok: false,
          error: "FX_SYNC_FAILED",
          details: {
            tenant_id: result?.tenant_id || session.tenant_id,
            reason: result?.error || "FX_PROVIDER_UNAVAILABLE"
          }
        });
      }

      const settings = await loadSettings(app.db, session.tenant_id);
      return reply.send({
        ok: true,
        result,
        fx: buildFxStatus(settings)
      });
    }
  );

  app.get(
    "/commerce/payment-readiness",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_PAYMENT_CONNECTOR_READ");
      if (!session) return;
      const [settings, profiles] = await Promise.all([
        loadSettings(app.db, session.tenant_id),
        loadTenantConnectionProfiles(app.db, session.tenant_id)
      ]);
      return reply.send({
        ok: true,
        readiness: buildPaymentReadiness({ settings: settings.payment, profiles })
      });
    }
  );

  app.get(
    "/commerce/payments",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            q: { type: "string", maxLength: 200 },
            status: { type: "string", maxLength: 50 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_PAYMENT_READ");
      if (!session) return;

      const params = [session.tenant_id, PAYMENT_OBJECT_TYPE];
      const filters = ["so.tenant_id=$1", "so.object_type=$2"];
      const q = normalizeOptionalText(req.query?.q);
      const status = normalizeOptionalText(req.query?.status);
      if (status) {
        params.push(normalizeStatus(status));
        filters.push(`so.status=$${params.length}`);
      }
      if (q) {
        params.push(`%${q}%`);
        filters.push(`(so.code ILIKE $${params.length} OR so.title ILIKE $${params.length} OR COALESCE(ord.code,'') ILIKE $${params.length})`);
      }
      params.push(clampLimit(req.query?.limit), Number(req.query?.offset || 0));

      const r = await app.db.query(
        `
        SELECT
          so.id, so.code, so.title, so.status, so.attrs, so.created_at, so.updated_at,
          ord.id AS order_id, ord.code AS order_code
        FROM eip_core.service_object so
        LEFT JOIN eip_core.object_link ol
          ON ol.tenant_id=so.tenant_id
         AND ol.src_kind='service_object'
         AND ol.src_id=so.id
         AND ol.relation_type='PAYMENT_FOR'
         AND ol.is_active=true
        LEFT JOIN eip_core.service_object ord
          ON ord.id=ol.dst_id AND ord.tenant_id=so.tenant_id
        WHERE ${filters.join(" AND ")}
        ORDER BY so.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );
      return reply.send({ ok: true, items: r.rows, limit: params.at(-2), offset: params.at(-1) });
    }
  );

  app.get(
    "/commerce/payments/:id",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_PAYMENT_READ");
      if (!session) return;
      const item = await resolvePayment(app.db, session.tenant_id, req.params.id);
      if (!item) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, item });
    }
  );

  app.post(
    "/commerce/payments/:id/capture",
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PAYMENT_CAPTURE");
      if (!session) return;
      const payment = await resolvePayment(app.db, session.tenant_id, req.params.id);
      if (!payment) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const result = await runGovernedPaymentAction(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          payment,
          action: "PAYMENT_CAPTURE",
          eventType: "payment_captured",
          eventStatus: "captured",
          payload: req.body || {}
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }
        await client.query("COMMIT");
        return reply.send({ ok: true, reused: result.reused });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({ event: "ecom_payment_capture_error", tenantId: session.tenant_id, error: err.message });
        return reply.code(500).send({ ok: false, error: "PAYMENT_CAPTURE_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.post(
    "/commerce/payments/:id/cancel",
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PAYMENT_WRITE");
      if (!session) return;
      const payment = await resolvePayment(app.db, session.tenant_id, req.params.id);
      if (!payment) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const result = await runGovernedPaymentAction(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          payment,
          action: "PAYMENT_CANCEL",
          eventType: "payment_cancelled",
          eventStatus: "cancelled",
          payload: req.body || {}
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }
        await client.query("COMMIT");
        return reply.send({ ok: true, reused: result.reused });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({ event: "ecom_payment_cancel_error", tenantId: session.tenant_id, error: err.message });
        return reply.code(500).send({ ok: false, error: "PAYMENT_CANCEL_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.post(
    "/commerce/payments/:id/refund-request",
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PAYMENT_REFUND_REQUEST");
      if (!session) return;
      const payment = await resolvePayment(app.db, session.tenant_id, req.params.id);
      if (!payment) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      if (!payment.order_id) return reply.code(409).send({ ok: false, error: "PAYMENT_ORDER_LINK_REQUIRED" });
      const order = await resolveOrder(app.db, session.tenant_id, payment.order_id);
      if (!order) return reply.code(409).send({ ok: false, error: "PAYMENT_ORDER_LINK_REQUIRED" });

      const settings = await loadSettings(app.db, session.tenant_id);
      if (settings?.refund_policy?.request_enabled === false) {
        return reply.code(403).send({ ok: false, error: "REFUND_DISABLED" });
      }

      const amount = Number.isFinite(Number(req.body?.amount))
        ? Number(req.body.amount)
        : Number(payment.attrs?.amount);
      if (!Number.isFinite(amount)) return reply.code(400).send({ ok: false, error: "AMOUNT_REQUIRED" });
      const currency = normalizeOptionalText(req.body?.currency) || normalizeOptionalText(payment.attrs?.currency) || "USD";

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const created = await createLinkedRequest(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          order,
          objectType: REFUND_OBJECT_TYPE,
          codePrefix: "RFD",
          relationType: "REFUND_FOR",
          actionRequest: "REFUND_REQUEST",
          attrs: {
            order_id: order.id,
            order_code: order.code,
            payment_id: payment.id,
            payment_code: payment.code,
            reason: normalizeOptionalText(req.body?.reason),
            amount,
            currency,
            metadata: sanitizePaymentMetadata(req.body?.metadata || {})
          }
        });
        if (!created.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: created.error });
        }
        await writePaymentInfoRecords(client, {
          tenantId: session.tenant_id,
          paymentId: payment.id,
          paymentCode: payment.code,
          orderId: order.id,
          orderCode: order.code,
          provider: payment.attrs?.provider,
          method: payment.attrs?.method,
          status: "refund_requested",
          amount,
          currency,
          eventType: "refund_requested",
          source: "eip_operator",
          metadata: { refund_request_id: created.item.id }
        });
        await client.query("COMMIT");
        return reply.send({ ok: true, item: created.item });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({ event: "ecom_payment_refund_request_error", tenantId: session.tenant_id, error: err.message });
        return reply.code(500).send({ ok: false, error: "PAYMENT_REFUND_REQUEST_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/commerce/orders",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            q: { type: "string", maxLength: 200 },
            status: { type: "string", maxLength: 50 },
            stage: { type: "string", maxLength: 50 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_ORDER_READ");
      if (!session) return;

      const tenantId = session.tenant_id;
      const q = normalizeOptionalText(req.query?.q);
      const status = normalizeOptionalText(req.query?.status);
      const stage = normalizeOptionalText(req.query?.stage);
      const limit = clampLimit(req.query?.limit);
      const offset = Number(req.query?.offset || 0);

      const params = [tenantId, ORDER_OBJECT_TYPE];
      const filters = ["tenant_id=$1", "object_type=$2"];

      if (status) {
        params.push(normalizeStatus(status));
        filters.push(`status = $${params.length}`);
      }

      if (stage) {
        params.push(normalizeStatus(stage));
        filters.push(`COALESCE(attrs->'workflow'->>'stage','') = $${params.length}`);
      }

      if (q) {
        params.push(`%${q}%`);
        filters.push(
          `(code ILIKE $${params.length} OR title ILIKE $${params.length} OR attrs->>'external_ref' ILIKE $${params.length})`
        );
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT id, code, title, status, attrs, created_at, updated_at,
               attrs->'workflow'->>'stage' AS stage
        FROM eip_core.service_object
        WHERE ${filters.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      return reply.send({ ok: true, items: r.rows, limit, offset });
    }
  );

  app.get(
    "/commerce/orders/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_ORDER_READ");
      if (!session) return;

      const order = await resolveOrder(app.db, session.tenant_id, req.params.id);
      if (!order) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      const [items, returns, refunds, payments] = await Promise.all([
        fetchOrderItems(app.db, session.tenant_id, order.id),
        fetchLinkedObjects(app.db, session.tenant_id, order.id, "RETURN_FOR", RETURN_OBJECT_TYPE),
        fetchLinkedObjects(app.db, session.tenant_id, order.id, "REFUND_FOR", REFUND_OBJECT_TYPE),
        fetchLinkedObjects(app.db, session.tenant_id, order.id, "PAYMENT_FOR", "payment")
      ]);

      return reply.send({
        ok: true,
        order,
        items,
        returns,
        refunds,
        payments
      });
    }
  );

  app.post(
    "/commerce/orders/:id/actions",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["action"],
          properties: {
            action: { type: "string", maxLength: 100 },
            payload: { type: "object" },
            idempotency_key: { type: "string", maxLength: 200 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_ORDER_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const action = normalizeText(req.body?.action);

      const order = await resolveOrder(app.db, tenantId, req.params.id);
      if (!order) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const instanceRes = await ensureProcessInstance(client, app, {
          tenantId,
          identityId: session.identity_id,
          serviceObjectId: order.id,
          objectType: ORDER_OBJECT_TYPE
        });
        if (!instanceRes.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error });
        }

        const payload = req.body?.payload || {};
        const idempotencyKey =
          normalizeOptionalText(req.body?.idempotency_key) ||
          buildIdempotencyKey("ecom_order_action", { id: order.id, action, payload });

        const result = await app.coreProcess.advanceInstance(client, {
          tenantId,
          identityId: session.identity_id,
          instanceId: instanceRes.instance.id,
          action,
          payload,
          idempotencyKey
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, reused: result.reused === true });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({ event: "ecom_order_action_error", tenantId, error: err.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );
  app.post(
    "/commerce/orders/:id/returns",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        },
        body: {
          type: "object",
          additionalProperties: true,
          properties: {
            reason: { type: "string", maxLength: 500 },
            items: { type: "array" },
            metadata: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_RETURN_WRITE");
      if (!session) return;

      const order = await resolveOrder(app.db, session.tenant_id, req.params.id);
      if (!order) return reply.code(404).send({ ok: false, error: "ORDER_NOT_FOUND" });

      const settings = await loadSettings(app.db, session.tenant_id);
      if (settings?.return_policy?.request_enabled === false) {
        return reply.code(403).send({ ok: false, error: "RETURN_DISABLED" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const attrs = {
          order_id: order.id,
          order_code: order.code,
          reason: normalizeOptionalText(req.body?.reason),
          items: Array.isArray(req.body?.items) ? req.body.items : [],
          metadata: req.body?.metadata || {}
        };

        const created = await createLinkedRequest(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          order,
          objectType: RETURN_OBJECT_TYPE,
          codePrefix: "RET",
          relationType: "RETURN_FOR",
          actionRequest: "RETURN_REQUEST",
          attrs
        });
        if (!created.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: created.error });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, item: created.item });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({ event: "ecom_return_create_error", tenantId: session.tenant_id, error: err.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.post(
    "/commerce/orders/:id/refunds",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        },
        body: {
          type: "object",
          additionalProperties: true,
          properties: {
            reason: { type: "string", maxLength: 500 },
            amount: { type: "number" },
            currency: { type: "string", maxLength: 10 },
            items: { type: "array" },
            metadata: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_REFUND_WRITE");
      if (!session) return;

      const order = await resolveOrder(app.db, session.tenant_id, req.params.id);
      if (!order) return reply.code(404).send({ ok: false, error: "ORDER_NOT_FOUND" });

      const settings = await loadSettings(app.db, session.tenant_id);
      if (settings?.refund_policy?.request_enabled === false) {
        return reply.code(403).send({ ok: false, error: "REFUND_DISABLED" });
      }

      const fallbackTotal = Number(order?.attrs?.pricing_snapshot?.totals?.total);
      const amount = Number.isFinite(Number(req.body?.amount))
        ? Number(req.body.amount)
        : Number.isFinite(fallbackTotal)
          ? fallbackTotal
          : null;
      if (amount === null) return reply.code(400).send({ ok: false, error: "AMOUNT_REQUIRED" });

      const currency =
        normalizeOptionalText(req.body?.currency) ||
        normalizeOptionalText(order?.attrs?.currency) ||
        "USD";

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const attrs = {
          order_id: order.id,
          order_code: order.code,
          reason: normalizeOptionalText(req.body?.reason),
          amount,
          currency,
          items: Array.isArray(req.body?.items) ? req.body.items : [],
          metadata: req.body?.metadata || {}
        };

        const created = await createLinkedRequest(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          order,
          objectType: REFUND_OBJECT_TYPE,
          codePrefix: "RFD",
          relationType: "REFUND_FOR",
          actionRequest: "REFUND_REQUEST",
          autoApproveAction: settings?.refund_policy?.auto_approve ? "REFUND_APPROVE" : null,
          attrs
        });
        if (!created.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: created.error });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, item: created.item });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({ event: "ecom_refund_create_error", tenantId: session.tenant_id, error: err.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/commerce/returns",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            q: { type: "string", maxLength: 200 },
            status: { type: "string", maxLength: 50 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_RETURN_READ");
      if (!session) return;

      const tenantId = session.tenant_id;
      const q = normalizeOptionalText(req.query?.q);
      const status = normalizeOptionalText(req.query?.status);
      const limit = clampLimit(req.query?.limit);
      const offset = Number(req.query?.offset || 0);

      const params = [tenantId, RETURN_OBJECT_TYPE];
      const filters = ["so.tenant_id=$1", "so.object_type=$2"];

      if (status) {
        params.push(normalizeStatus(status));
        filters.push(`so.status = $${params.length}`);
      }

      if (q) {
        params.push(`%${q}%`);
        filters.push(`(so.code ILIKE $${params.length} OR so.title ILIKE $${params.length})`);
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT
          so.id, so.code, so.title, so.status, so.attrs, so.created_at, so.updated_at,
          ord.id AS order_id, ord.code AS order_code
        FROM eip_core.service_object so
        LEFT JOIN eip_core.object_link ol
          ON ol.tenant_id = so.tenant_id
         AND ol.src_kind = 'service_object'
         AND ol.src_id = so.id
         AND ol.relation_type = 'RETURN_FOR'
         AND ol.is_active = true
        LEFT JOIN eip_core.service_object ord
          ON ord.id = ol.dst_id AND ord.tenant_id = so.tenant_id
        WHERE ${filters.join(" AND ")}
        ORDER BY so.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      return reply.send({ ok: true, items: r.rows, limit, offset });
    }
  );

  app.get(
    "/commerce/returns/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_RETURN_READ");
      if (!session) return;

      const r = await app.db.query(
        `
        SELECT
          so.id, so.code, so.title, so.status, so.attrs, so.created_at, so.updated_at,
          ord.id AS order_id, ord.code AS order_code
        FROM eip_core.service_object so
        LEFT JOIN eip_core.object_link ol
          ON ol.tenant_id = so.tenant_id
         AND ol.src_kind = 'service_object'
         AND ol.src_id = so.id
         AND ol.relation_type = 'RETURN_FOR'
         AND ol.is_active = true
        LEFT JOIN eip_core.service_object ord
          ON ord.id = ol.dst_id AND ord.tenant_id = so.tenant_id
        WHERE so.tenant_id=$1 AND so.id=$2 AND so.object_type=$3
        `,
        [session.tenant_id, req.params.id, RETURN_OBJECT_TYPE]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  app.post(
    "/commerce/returns/:id/actions",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["action"],
          properties: {
            action: { type: "string", maxLength: 100 },
            payload: { type: "object" },
            idempotency_key: { type: "string", maxLength: 200 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_RETURN_WRITE");
      if (!session) return;

      const action = normalizeText(req.body?.action);
      const r = await app.db.query(
        `
        SELECT id
        FROM eip_core.service_object
        WHERE tenant_id=$1 AND id=$2 AND object_type=$3
        `,
        [session.tenant_id, req.params.id, RETURN_OBJECT_TYPE]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const instanceRes = await ensureProcessInstance(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          serviceObjectId: req.params.id,
          objectType: RETURN_OBJECT_TYPE
        });
        if (!instanceRes.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error });
        }

        const payload = req.body?.payload || {};
        const idempotencyKey =
          normalizeOptionalText(req.body?.idempotency_key) ||
          buildIdempotencyKey("ecom_return_action", { id: req.params.id, action, payload });

        const result = await app.coreProcess.advanceInstance(client, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          instanceId: instanceRes.instance.id,
          action,
          payload,
          idempotencyKey
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, reused: result.reused === true });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({ event: "ecom_return_action_error", tenantId: session.tenant_id, error: err.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );
  app.get(
    "/commerce/refunds",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            q: { type: "string", maxLength: 200 },
            status: { type: "string", maxLength: 50 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_REFUND_READ");
      if (!session) return;

      const tenantId = session.tenant_id;
      const q = normalizeOptionalText(req.query?.q);
      const status = normalizeOptionalText(req.query?.status);
      const limit = clampLimit(req.query?.limit);
      const offset = Number(req.query?.offset || 0);

      const params = [tenantId, REFUND_OBJECT_TYPE];
      const filters = ["so.tenant_id=$1", "so.object_type=$2"];

      if (status) {
        params.push(normalizeStatus(status));
        filters.push(`so.status = $${params.length}`);
      }

      if (q) {
        params.push(`%${q}%`);
        filters.push(`(so.code ILIKE $${params.length} OR so.title ILIKE $${params.length})`);
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT
          so.id, so.code, so.title, so.status, so.attrs, so.created_at, so.updated_at,
          ord.id AS order_id, ord.code AS order_code
        FROM eip_core.service_object so
        LEFT JOIN eip_core.object_link ol
          ON ol.tenant_id = so.tenant_id
         AND ol.src_kind = 'service_object'
         AND ol.src_id = so.id
         AND ol.relation_type = 'REFUND_FOR'
         AND ol.is_active = true
        LEFT JOIN eip_core.service_object ord
          ON ord.id = ol.dst_id AND ord.tenant_id = so.tenant_id
        WHERE ${filters.join(" AND ")}
        ORDER BY so.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      return reply.send({ ok: true, items: r.rows, limit, offset });
    }
  );

  app.get(
    "/commerce/refunds/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_REFUND_READ");
      if (!session) return;

      const r = await app.db.query(
        `
        SELECT
          so.id, so.code, so.title, so.status, so.attrs, so.created_at, so.updated_at,
          ord.id AS order_id, ord.code AS order_code
        FROM eip_core.service_object so
        LEFT JOIN eip_core.object_link ol
          ON ol.tenant_id = so.tenant_id
         AND ol.src_kind = 'service_object'
         AND ol.src_id = so.id
         AND ol.relation_type = 'REFUND_FOR'
         AND ol.is_active = true
        LEFT JOIN eip_core.service_object ord
          ON ord.id = ol.dst_id AND ord.tenant_id = so.tenant_id
        WHERE so.tenant_id=$1 AND so.id=$2 AND so.object_type=$3
        `,
        [session.tenant_id, req.params.id, REFUND_OBJECT_TYPE]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  app.post(
    "/commerce/refunds/:id/actions",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["action"],
          properties: {
            action: { type: "string", maxLength: 100 },
            payload: { type: "object" },
            idempotency_key: { type: "string", maxLength: 200 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_REFUND_WRITE");
      if (!session) return;

      const action = normalizeText(req.body?.action);
      const r = await app.db.query(
        `
        SELECT id
        FROM eip_core.service_object
        WHERE tenant_id=$1 AND id=$2 AND object_type=$3
        `,
        [session.tenant_id, req.params.id, REFUND_OBJECT_TYPE]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const instanceRes = await ensureProcessInstance(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          serviceObjectId: req.params.id,
          objectType: REFUND_OBJECT_TYPE
        });
        if (!instanceRes.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error });
        }

        const payload = req.body?.payload || {};
        const idempotencyKey =
          normalizeOptionalText(req.body?.idempotency_key) ||
          buildIdempotencyKey("ecom_refund_action", { id: req.params.id, action, payload });

        const result = await app.coreProcess.advanceInstance(client, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          instanceId: instanceRes.instance.id,
          action,
          payload,
          idempotencyKey
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, reused: result.reused === true });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({ event: "ecom_refund_action_error", tenantId: session.tenant_id, error: err.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );
}
