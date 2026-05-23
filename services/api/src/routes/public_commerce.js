// services/api/src/routes/public_commerce.js
// Public commerce intake for tenant storefronts (orders, payments, entitlements).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import argon2 from "argon2";
import { buildSignedAssetUrl } from "../services/assets/signing.js";
import { randomToken, sha256Hex, timingSafeEqual } from "../auth/crypto.js";
import { buildRequestHash, ensureIdempotency, finalizeIdempotency } from "../services/gateway/idempotency.js";
import { extractProfiles } from "../services/gateway/connectionProfile.js";
import { registerRawBody, parseJsonBody } from "../services/gateway/rawBody.js";
import { isTenantAssetPath, toLocalAssetPath } from "../services/assets/url_policy.js";
import { sendEmail } from "../lib/email.js";
import { safeUploadTarget, uploadPartToBuffer, validateImageUpload } from "../lib/uploadSecurity.js";
import { resolveMarketplaceFxContext } from "../services/fx/marketFxSync.js";

const RATE_LIMIT = { max: 120, timeWindow: "1 minute" };
const MAX_BODY = 512 * 1024;
const JWKS_CACHE = new Map();
const JWKS_TTL_MS = 10 * 60 * 1000;
const PRODUCT_REVIEW_OBJECT_TYPE = "product_review";
const BLOG_POST_OBJECT_TYPE = "blog_post";
const REVIEW_VISIBLE_STATUSES = new Set(["approved", "published", "visible"]);
const REVIEW_FLAGGED_STATUS = "pending_review";
const BLOG_VISIBLE_STATUSES = new Set(["new", "approved", "published", "visible", "review"]);
const PUBLISHED_STAGE = "published";
const MEMBER_MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const MEMBER_SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SCRYPT_MAX_MEM = 64 * 1024 * 1024;
const scryptAsync = promisify(crypto.scrypt);
const REVIEW_BLOCKED_TERMS = [
  "idiot",
  "stupid",
  "dumb",
  "trash",
  "moron",
  "bastard",
  "loser",
  "fuck",
  "shit",
  "asshole"
];
const STOREFRONT_CTA_ACTIONS = new Set([
  "navigate_internal",
  "navigate_external",
  "scroll_to"
]);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSET_ROOT = path.join(__dirname, "../../assets");
const COMMERCE_SETTINGS_MODULE = "ecom";
const COMMERCE_SETTINGS_CODE = "commerce";
const DEFAULT_PAYMENT_SETTINGS = {
  methods: [
    { code: "card", label: "Credit card", enabled: true },
    { code: "paypal", label: "PayPal", enabled: false },
    { code: "app", label: "App payment", enabled: false }
  ],
  providers: {
    card: { mode: "manual", public_key: "" },
    paypal: { mode: "manual", client_id: "" },
    app: { mode: "manual", app_id: "" }
  }
};
const DEFAULT_TRANSLATION_SETTINGS = {
  default_locale: "en",
  marketplaces: [],
  engine: {
    source_locale: "en"
  }
};

function normalizeText(value) {
  return String(value || "").trim();
}

function parseScryptHash(value) {
  const parts = String(value || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  const salt = Buffer.from(parts[4], "base64");
  const hash = Buffer.from(parts[5], "base64");
  if (!salt.length || !hash.length) return null;
  return { N, r, p, salt, hash };
}

async function verifyPassword(password, credential) {
  if (!password || !credential?.secret_hash) return false;
  const hash = String(credential.secret_hash || "");
  const algorithm = String(credential.algorithm || "").toLowerCase();
  if (hash.startsWith("$argon2") || algorithm.startsWith("argon2")) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
  if (algorithm && algorithm !== "scrypt") return false;
  const parsed = parseScryptHash(hash);
  if (!parsed) return false;
  try {
    const derived = await scryptAsync(password, parsed.salt, parsed.hash.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
      maxmem: SCRYPT_MAX_MEM
    });
    return timingSafeEqual(derived, parsed.hash);
  } catch {
    return false;
  }
}

async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

function normalizeOptionalText(value) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeLocaleCode(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (!normalized) return "";
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(normalized)) return "";
  return normalized;
}

function isStorefrontContentActive(attrs = {}) {
  return attrs.is_active !== false && String(attrs.is_active || "").toLowerCase() !== "false";
}

function isStorefrontContentPublished(row = {}, attrs = {}) {
  const stage = normalizeText(attrs?.workflow?.stage || "").toLowerCase();
  const status = normalizeText(row?.status || "").toLowerCase();
  return stage === PUBLISHED_STAGE || status === PUBLISHED_STAGE;
}

function normalizeStorefrontCta(slide = {}) {
  const actionRaw = normalizeText(
    slide.cta?.action ||
      slide.cta_action ||
      ""
  ).toLowerCase();
  const target = normalizeOptionalText(
    slide.cta?.target ||
      slide.cta_target ||
      slide.cta_url ||
      slide.ctaUrl ||
      ""
  );
  const action = STOREFRONT_CTA_ACTIONS.has(actionRaw)
    ? actionRaw
    : target
      ? /^https?:\/\//i.test(target)
        ? "navigate_external"
        : target.startsWith("#")
          ? "scroll_to"
          : "navigate_internal"
      : "navigate_internal";

  let newTabRaw = slide.cta?.new_tab;
  if (newTabRaw === undefined) newTabRaw = slide.cta_new_tab;
  if (newTabRaw === undefined) newTabRaw = slide.cta?.newTab;
  if (newTabRaw === undefined) newTabRaw = slide.cta_newTab;
  const newTab =
    newTabRaw === true || String(newTabRaw || "").toLowerCase() === "true";

  return {
    action,
    target: target || "",
    new_tab: newTab
  };
}

function normalizeStorefrontArticlePublic(input = {}) {
  if (!input || typeof input !== "object") return null;
  const cta = normalizeStorefrontCta(input);
  return {
    image: normalizeOptionalText(input.image || input.image_url || input.media?.url) || "",
    eyebrow: normalizeOptionalText(input.eyebrow),
    title: normalizeOptionalText(input.title),
    excerpt: normalizeOptionalText(input.excerpt || input.subtitle || input.summary),
    body: normalizeOptionalText(input.body || input.content || input.text),
    cta_label: normalizeOptionalText(input.cta_label || input.ctaLabel),
    cta_url: cta.target,
    cta,
    cta_action: cta.action,
    cta_target: cta.target,
    cta_new_tab: cta.new_tab
  };
}

function resolveClientSource(access, explicitSource, fallback = "public-web") {
  const explicit = normalizeOptionalText(explicitSource);
  if (explicit) return explicit;
  const fromProfile = normalizeOptionalText(
    access?.profile?.identity?.client_source ||
      access?.profile?.identity?.connection_code ||
      access?.profile?.identity?.connection_name
  );
  return fromProfile || fallback;
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeCurrencyCode(value, fallback = "USD") {
  const upper = normalizeUpper(value);
  if (!/^[A-Z]{3}$/.test(upper)) return fallback;
  return upper;
}

function normalizeFxRate(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Number(n.toFixed(6));
}

function publishedMaterialPredicate(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}is_active = true AND COALESCE(lower(${prefix}attrs->'workflow'->>'stage'), '') = '${PUBLISHED_STAGE}'`;
}

function hashAccessToken(app, token) {
  const pepper = app.config.ACCESS_GRANT_PEPPER || app.config.API_KEY_PEPPER;
  return sha256Hex(`${token}:${pepper}`);
}

function normalizeNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeAmount(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const text = String(value).trim();
  if (!text) return fallback;
  const normalized = text
    .replace(/[A-Za-z]/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.\-]/g, "");
  if (!normalized) return fallback;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function pickAmount(...values) {
  for (const value of values) {
    const parsed = normalizeAmount(value, null);
    if (parsed !== null) return parsed;
  }
  return null;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return fallback;
  const normalized = normalizeText(value).toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizePaymentMethodCode(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return "";
  if (["card", "credit_card", "creditcard", "bank_card"].includes(normalized)) return "card";
  if (["paypal", "pay_pal"].includes(normalized)) return "paypal";
  if (["app", "app_pay", "apple_pay", "google_pay", "wallet"].includes(normalized)) return "app";
  return normalized;
}

function normalizeProviderMode(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "live" || normalized === "sandbox") return normalized;
  return "manual";
}

function normalizePaymentMethods(input, fallback = DEFAULT_PAYMENT_SETTINGS.methods) {
  const source = Array.isArray(input) ? input : fallback;
  const out = [];
  const seen = new Set();
  for (const item of source) {
    if (!item || typeof item !== "object") continue;
    const code = normalizePaymentMethodCode(item.code || item.id || item.method);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const fallbackEntry = (fallback || []).find((entry) => normalizePaymentMethodCode(entry.code) === code) || {};
    out.push({
      code,
      label: normalizeText(item.label || fallbackEntry.label || code.toUpperCase()),
      enabled: normalizeBoolean(item.enabled, normalizeBoolean(fallbackEntry.enabled, false))
    });
  }
  if (!out.length) {
    return (DEFAULT_PAYMENT_SETTINGS.methods || []).map((entry) => ({
      code: normalizePaymentMethodCode(entry.code),
      label: normalizeText(entry.label || entry.code),
      enabled: normalizeBoolean(entry.enabled, false)
    }));
  }
  return out;
}

function normalizePaymentProviders(input, fallback = DEFAULT_PAYMENT_SETTINGS.providers) {
  const source = input && typeof input === "object" ? input : {};
  const base = fallback && typeof fallback === "object" ? fallback : {};
  const methodCodes = new Set([
    ...Object.keys(base || {}).map((key) => normalizePaymentMethodCode(key)),
    ...Object.keys(source || {}).map((key) => normalizePaymentMethodCode(key))
  ]);
  const out = {};
  for (const method of methodCodes) {
    if (!method) continue;
    const fallbackEntry = base[method] && typeof base[method] === "object" ? base[method] : {};
    const sourceEntry = source[method] && typeof source[method] === "object" ? source[method] : {};
    out[method] = {
      mode: normalizeProviderMode(sourceEntry.mode || fallbackEntry.mode || "manual"),
      public_key: normalizeText(sourceEntry.public_key || fallbackEntry.public_key || ""),
      client_id: normalizeText(sourceEntry.client_id || fallbackEntry.client_id || ""),
      app_id: normalizeText(sourceEntry.app_id || fallbackEntry.app_id || "")
    };
  }
  return out;
}

function normalizePaymentSettings(input, fallback = DEFAULT_PAYMENT_SETTINGS) {
  const source = input && typeof input === "object" ? input : {};
  const base = fallback && typeof fallback === "object" ? fallback : DEFAULT_PAYMENT_SETTINGS;
  return {
    methods: normalizePaymentMethods(source.methods, base.methods || DEFAULT_PAYMENT_SETTINGS.methods),
    providers: normalizePaymentProviders(source.providers, base.providers || DEFAULT_PAYMENT_SETTINGS.providers)
  };
}

function normalizeOrigin(origin) {
  if (!origin) return "";
  return origin.trim().toLowerCase();
}

function signAssetUrl(url, app, tenantId) {
  const localPath = toLocalAssetPath(url);
  if (!localPath) return url;
  if (!isTenantAssetPath(localPath, tenantId)) return "";
  const ttlSec = Number(app.config.ASSET_TOKEN_TTL_SEC || 604800);
  const exp = Math.floor(Date.now() / 1000) + (Number.isFinite(ttlSec) ? ttlSec : 604800);
  return buildSignedAssetUrl(localPath, exp, app.config.API_KEY_PEPPER);
}

function signMediaAttrs(attrs, app, tenantId) {
  if (!attrs || typeof attrs !== "object") return attrs;
  if (!attrs.media || typeof attrs.media !== "object") return attrs;
  const media = { ...attrs.media };
  if (media.main_asset && typeof media.main_asset === "object") {
    media.main_asset = { ...media.main_asset };
    if (media.main_asset.url) media.main_asset.url = signAssetUrl(media.main_asset.url, app, tenantId);
  }
  if (media.hero_asset && typeof media.hero_asset === "object") {
    media.hero_asset = { ...media.hero_asset };
    if (media.hero_asset.url) media.hero_asset.url = signAssetUrl(media.hero_asset.url, app, tenantId);
  }
  if (media.main_url) media.main_url = signAssetUrl(media.main_url, app, tenantId);
  if (media.hero_url) media.hero_url = signAssetUrl(media.hero_url, app, tenantId);
  if (Array.isArray(media.gallery)) {
    media.gallery = media.gallery
      .map((url) => signAssetUrl(url, app, tenantId))
      .filter(Boolean);
  }
  if (Array.isArray(media.documents)) {
    media.documents = media.documents
      .map((url) => signAssetUrl(url, app, tenantId))
      .filter(Boolean);
  }
  if (Array.isArray(media.gallery_assets)) {
    media.gallery_assets = media.gallery_assets
      .map((asset) => {
        if (!asset || typeof asset !== "object") return asset;
        const next = { ...asset };
        if (next.url) next.url = signAssetUrl(next.url, app, tenantId);
        return next;
      })
      .filter((asset) => !(asset && typeof asset === "object" && "url" in asset) || Boolean(asset.url));
  }
  if (Array.isArray(media.document_assets)) {
    media.document_assets = media.document_assets
      .map((asset) => {
        if (!asset || typeof asset !== "object") return asset;
        const next = { ...asset };
        if (next.url) next.url = signAssetUrl(next.url, app, tenantId);
        return next;
      })
      .filter((asset) => !(asset && typeof asset === "object" && "url" in asset) || Boolean(asset.url));
  }
  return { ...attrs, media };
}

function applyCors(reply, origin, requestHeaders) {
  if (!origin) return;
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Credentials", "true");
  reply.header(
    "Access-Control-Allow-Headers",
    requestHeaders || "Content-Type, X-API-Key, Authorization, X-Event-Id, X-Member-Csrf"
  );
  reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
}

function getHeader(req, name) {
  if (!name) return "";
  const key = String(name).toLowerCase();
  return String(req.headers?.[key] || "").trim();
}

function getBodyPath(body, path) {
  if (!body || !path) return null;
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), body);
}

function connectionAllowsOrigin(profile, origin) {
  const allowlist = Array.isArray(profile?.inbound?.origin_allowlist)
    ? profile.inbound.origin_allowlist
    : [];
  if (!allowlist.length) return true;
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  return allowlist.some((entry) => normalizeOrigin(entry) === normalized || entry === "*");
}

function connectionAllowsIp(profile, ip) {
  const allowlist = Array.isArray(profile?.audit?.ip_allowlist) ? profile.audit.ip_allowlist : [];
  if (!allowlist.length) return true;
  return allowlist.includes(ip);
}

function requiresInbound(profile) {
  return profile?.identity?.direction === "inbound" || profile?.identity?.direction === "both";
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
  const { tenantId, identityId, serviceObjectId, serviceObject, objectType, requireBinding } = opts;
  const binding = await resolveProcessBinding(client, tenantId, objectType);
  if (!binding) {
    if (requireBinding) return { ok: false, error: "PROCESS_BINDING_REQUIRED" };
    await client.query(
      `
      INSERT INTO eip_core.info_record
        (tenant_id, record_type, title, payload)
      VALUES
        ($1,$2,$3,$4::jsonb)
      `,
      [
        tenantId,
        "PROCESS_BINDING_MISSING",
        `process_binding.${objectType}`,
        JSON.stringify({ service_object_id: serviceObjectId || null, object_type: objectType })
      ]
    );
    return { ok: true, skipped: true };
  }

  const result = await app.coreProcess.createInstance(client, {
    tenantId,
    identityId: identityId || null,
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
}

async function ensureProcessInstanceForObject(client, app, opts) {
  const { tenantId, identityId, objectType, serviceObjectId, requireBinding } = opts;
  const binding = await resolveProcessBinding(client, tenantId, objectType);
  if (!binding) {
    if (requireBinding) return { ok: false, error: "PROCESS_BINDING_REQUIRED" };
    return { ok: true, skipped: true, binding: null, instance: null };
  }

  let instance = await app.coreProcess.findActiveInstance(client, tenantId, serviceObjectId);
  if (!instance) {
    const started = await app.coreProcess.createInstance(client, {
      tenantId,
      identityId: identityId || null,
      serviceObjectId,
      processDefId: binding.process_def_id,
      idempotencyKey: `auto:${objectType}:${serviceObjectId}`
    });
    if (!started.ok) return { ok: false, error: started.error };
    instance = started.item;
  }

  return { ok: true, binding, instance };
}

function enforceExpectedContentType(profile, req) {
  const expected = normalizeText(profile?.inbound?.expected_content_type);
  if (!expected) return { ok: true };
  const actual = normalizeText(req.headers["content-type"] || "");
  if (!actual) return { ok: false, error: "CONTENT_TYPE_REQUIRED" };
  if (!actual.toLowerCase().includes(expected.toLowerCase())) {
    return { ok: false, error: "CONTENT_TYPE_MISMATCH" };
  }
  return { ok: true };
}

function enforceInboundMethod(profile, req) {
  const expected = normalizeText(profile?.inbound?.http_method).toUpperCase();
  if (!expected) return { ok: true };
  if (String(req.method || "").toUpperCase() !== expected) {
    return { ok: false, error: "METHOD_NOT_ALLOWED", expected };
  }
  return { ok: true };
}

async function resolveTenantBySuffix(app, suffix) {
  const r = await app.db.query(
    `
    SELECT id, code, name, attrs
    FROM eip_core.tenant
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(attrs->'connection_profiles') = 'array'
          THEN attrs->'connection_profiles'
          ELSE '[]'::jsonb
        END
      ) AS profile
      WHERE profile->'inbound'->>'inbound_path_suffix' = $1
    )
    LIMIT 2
    `,
    [suffix]
  );
  if (r.rowCount === 0) return null;
  if (r.rowCount > 1) return { error: "DUPLICATE_SUFFIX" };
  const tenant = r.rows[0];
  const profiles = extractProfiles(tenant.attrs);
  const profile = profiles.find((item) => item?.inbound?.inbound_path_suffix === suffix);
  return { tenant, profile, profiles };
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (value.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function decodeJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(base64UrlDecode(headerB64).toString("utf8"));
  const payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));
  return {
    header,
    payload,
    signature: signatureB64,
    data: `${headerB64}.${payloadB64}`
  };
}

async function fetchJwks(url) {
  const cached = JWKS_CACHE.get(url);
  if (cached && cached.expires > Date.now()) return cached.keys;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) throw new Error("JWKS_FETCH_FAILED");
  const data = await response.json();
  const keys = Array.isArray(data.keys) ? data.keys : [];
  JWKS_CACHE.set(url, { keys, expires: Date.now() + JWKS_TTL_MS });
  return keys;
}

async function verifyJwtSignature(token, config) {
  const decoded = decodeJwt(token);
  if (!decoded) return false;
  const { header, payload, signature, data } = decoded;

  if (config.issuer && payload.iss !== config.issuer) return false;
  if (config.audience) {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(config.audience)) return false;
  }

  const alg = String(header.alg || "").toUpperCase();
  if (alg === "HS256") {
    const secret = config.secret || "";
    if (!secret) return false;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64url");
    return timingSafeEqual(signature, expected);
  }

  if (alg === "RS256") {
    if (!config.jwks_url) return false;
    const keys = await fetchJwks(config.jwks_url);
    const jwk = keys.find((item) => item.kid === header.kid) || keys[0];
    if (!jwk) return false;
    const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
    const sig = base64UrlDecode(signature);
    return crypto.verify("RSA-SHA256", Buffer.from(data), key, sig);
  }

  return false;
}

function buildHmacSignature(config, rawBody) {
  const algorithm = String(config.algorithm || "sha256").toLowerCase();
  const encoding = String(config.encoding || "hex").toLowerCase();
  const payloadMode = String(config.payload_mode || "raw").toLowerCase();
  let payload = rawBody;
  if (payloadMode === "timestamp_sha256") {
    const timestamp = normalizeText(config.timestamp || "");
    payload = `${timestamp}\n${crypto.createHash("sha256").update(rawBody).digest("hex")}`;
  }
  return crypto.createHmac(algorithm, config.secret).update(payload).digest(encoding);
}

async function verifyInboundRequest(req, profile, rawBody) {
  const verification = profile?.verification || {};
  if (verification.mode === "none") return { ok: true };

  if (verification.mode === "api_key") {
    const headerName = verification.api_key?.header_name;
    const provided = getHeader(req, headerName);
    const expected = normalizeText(verification.api_key?.secret);
    if (!headerName || !expected) return { ok: false, error: "MISSING_API_KEY_CONFIG" };
    if (!timingSafeEqual(provided, expected)) {
      return { ok: false, error: "INVALID_API_KEY" };
    }
    return { ok: true };
  }

  if (verification.mode === "hmac_signature") {
    const config = verification.hmac_signature || {};
    const headerName = normalizeText(config.header_name);
    const expected = getHeader(req, headerName);
    if (!headerName || !expected) return { ok: false, error: "SIGNATURE_HEADER_MISSING" };
    if (!normalizeText(config.secret)) return { ok: false, error: "SIGNATURE_SECRET_MISSING" };
    const computed = buildHmacSignature(config, rawBody);
    if (!timingSafeEqual(expected, computed)) return { ok: false, error: "SIGNATURE_MISMATCH" };
    return { ok: true };
  }

  if (verification.mode === "oauth2_jwt") {
    const config = verification.oauth2_jwt || {};
    const headerName = normalizeText(config.header_name);
    const headerValue = getHeader(req, headerName);
    if (!headerName || !headerValue) return { ok: false, error: "JWT_HEADER_MISSING" };
    const tokenPrefix = normalizeText(config.token_prefix || "");
    const token =
      tokenPrefix && headerValue.startsWith(tokenPrefix)
        ? headerValue.slice(tokenPrefix.length).trim()
        : headerValue;
    const ok = await verifyJwtSignature(token, {
      issuer: config.issuer,
      audience: config.audience,
      jwks_url: config.jwks_url,
      secret: config.secret
    });
    if (!ok) return { ok: false, error: "JWT_INVALID" };
    return { ok: true };
  }

  return { ok: false, error: "VERIFICATION_MODE_UNSUPPORTED" };
}

function extractEventId(req, body, profile) {
  const idem = profile?.idempotency || {};
  const location = normalizeText(idem.event_id_location).toLowerCase();
  const key = normalizeText(idem.event_id_key);
  if (!location || !key) return null;
  if (location === "header") {
    return getHeader(req, key);
  }
  if (location === "body") {
    return normalizeText(getBodyPath(body, key));
  }
  return null;
}

function normalizeScopeArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => normalizeUpper(item));
  if (typeof value === "string") return [normalizeUpper(value)];
  return [];
}

function scopeMatches(scope, ctx) {
  if (!scope || typeof scope !== "object") return true;

  const materialCodes = normalizeScopeArray(
    scope.material_codes || scope.materials || scope.material_code
  );
  if (materialCodes.length && !materialCodes.includes(normalizeUpper(ctx.material?.code))) return false;

  const materialIds = Array.isArray(scope.material_ids) ? scope.material_ids : [];
  if (materialIds.length && !materialIds.includes(ctx.material?.id)) return false;

  const materialTypes = normalizeScopeArray(scope.material_types || scope.material_type);
  if (materialTypes.length && !materialTypes.includes(normalizeUpper(ctx.material?.material_type))) return false;

  const channels = normalizeScopeArray(scope.channels || scope.channel);
  if (channels.length && !channels.includes(normalizeUpper(ctx.channel))) return false;

  const jurisdictions = normalizeScopeArray(
    scope.jurisdictions || scope.jurisdiction_codes || scope.jurisdiction_in || scope.jurisdiction
  );
  if (jurisdictions.length && !jurisdictions.includes(normalizeUpper(ctx.jurisdiction))) return false;

  const currency = normalizeText(scope.currency);
  if (currency && normalizeUpper(currency) !== normalizeUpper(ctx.currency)) return false;

  const minQty = normalizeNumber(scope.min_qty, null);
  const maxQty = normalizeNumber(scope.max_qty, null);
  if (minQty !== null && ctx.quantity < minQty) return false;
  if (maxQty !== null && ctx.quantity > maxQty) return false;

  return true;
}
function categorizeCondition(cond) {
  const raw = normalizeUpper(cond.condition_category || cond.condition_type);
  if (raw.includes("PRICE")) return "PRICE";
  if (raw.includes("TAX")) return "TAX";
  if (raw.includes("DISCOUNT") || raw.includes("PROMO")) return "DISCOUNT";
  if (raw.includes("TERM")) return "TERMS";
  return raw || "OTHER";
}

function selectCondition(conditions, ctx) {
  const matches = conditions.filter((cond) => scopeMatches(cond.scope, ctx));
  if (!matches.length) return null;
  const sorted = matches.sort((a, b) => {
    const pa = Number.isFinite(a.priority) ? a.priority : 100;
    const pb = Number.isFinite(b.priority) ? b.priority : 100;
    if (pa !== pb) return pa - pb;
    return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
  });
  return sorted[0];
}

function pickConditionText(cond) {
  const fromEffect =
    cond?.effect?.text ??
    cond?.effect?.content ??
    cond?.effect?.body ??
    cond?.effect?.terms ??
    null;
  const fromAttrs =
    cond?.attrs?.text ??
    cond?.attrs?.content ??
    cond?.attrs?.description ??
    null;
  const candidate = fromEffect ?? fromAttrs ?? cond?.label ?? cond?.code ?? "";
  if (Array.isArray(candidate)) {
    return candidate.map((item) => normalizeText(item)).filter(Boolean).join("\n");
  }
  if (candidate && typeof candidate === "object") {
    return normalizeText(candidate.text || candidate.content || candidate.value || "");
  }
  return normalizeText(candidate);
}

async function loadConditions(app, tenantId) {
  const r = await app.db.query(
    `
    SELECT id, code, label, condition_type, condition_category, priority,
           valid_from, valid_to, scope, effect, attrs, created_at, updated_at
    FROM eip_core.commercial_condition
    WHERE tenant_id = $1
      AND is_active = true
      AND (valid_from IS NULL OR valid_from <= now())
      AND (valid_to IS NULL OR valid_to > now())
    ORDER BY priority ASC, created_at DESC
    `,
    [tenantId]
  );
  return r.rows || [];
}

async function loadCommercePaymentSettings(app, tenantId) {
  const r = await app.db.query(
    `
    SELECT attrs
    FROM eip_core.tenant_module_setting
    WHERE tenant_id = $1
      AND module = $2
      AND code = $3
      AND is_active = true
    LIMIT 1
    `,
    [tenantId, COMMERCE_SETTINGS_MODULE, COMMERCE_SETTINGS_CODE]
  );
  const attrs = r.rows[0]?.attrs;
  return normalizePaymentSettings(attrs?.payment || {});
}

async function loadCommerceTranslationSettings(app, tenantId) {
  const r = await app.db.query(
    `
    SELECT attrs
    FROM eip_core.tenant_module_setting
    WHERE tenant_id = $1
      AND module = $2
      AND code = $3
      AND is_active = true
    LIMIT 1
    `,
    [tenantId, COMMERCE_SETTINGS_MODULE, COMMERCE_SETTINGS_CODE]
  );
  const attrs = r.rows[0]?.attrs;
  const raw = attrs?.translation && typeof attrs.translation === "object"
    ? attrs.translation
    : {};
  return {
    ...DEFAULT_TRANSLATION_SETTINGS,
    ...raw,
    engine: {
      ...DEFAULT_TRANSLATION_SETTINGS.engine,
      ...(raw.engine && typeof raw.engine === "object" ? raw.engine : {})
    },
    marketplaces: Array.isArray(raw.marketplaces) ? raw.marketplaces : []
  };
}

function resolveTranslationLocales(translationSettings) {
  const locales = new Set();
  const defaultLocale = normalizeLocaleCode(translationSettings?.default_locale) || "en";
  const sourceLocale = normalizeLocaleCode(translationSettings?.engine?.source_locale) || defaultLocale;
  locales.add(defaultLocale);
  locales.add(sourceLocale);
  for (const marketplace of Array.isArray(translationSettings?.marketplaces)
    ? translationSettings.marketplaces
    : []) {
    const primary = normalizeLocaleCode(marketplace?.primary_locale);
    if (primary) locales.add(primary);
    for (const locale of Array.isArray(marketplace?.allowed_locales) ? marketplace.allowed_locales : []) {
      const normalized = normalizeLocaleCode(locale);
      if (normalized) locales.add(normalized);
    }
  }
  return {
    defaultLocale,
    sourceLocale,
    locales: [...locales].sort((a, b) => a.localeCompare(b))
  };
}

function localeLabel(localeCode) {
  const normalized = normalizeLocaleCode(localeCode);
  if (!normalized) return "";
  try {
    const display = new Intl.DisplayNames(["en"], { type: "language" });
    const baseLanguage = normalized.split("-")[0];
    const name = display.of(baseLanguage);
    if (name) return `${name} (${normalized.toUpperCase()})`;
  } catch {
    // Ignore; fallback below.
  }
  return normalized.toUpperCase();
}

function resolveFxRateFromConditions(conditions, { baseCurrency, targetCurrency, jurisdiction }) {
  const base = normalizeUpper(baseCurrency);
  const target = normalizeUpper(targetCurrency);
  if (!base || !target || base === target) return 1;

  const candidates = (conditions || [])
    .filter((cond) => {
      const type = normalizeUpper(cond?.condition_type || "");
      const category = normalizeUpper(cond?.condition_category || "");
      return type.includes("FOREX") || category.includes("FOREX") || type.includes("FX") || category.includes("FX");
    })
    .filter((cond) => {
      const effectBase = normalizeUpper(cond?.effect?.base_currency || "");
      const effectQuote = normalizeUpper(cond?.effect?.quote_currency || "");
      const scopeCurrency = normalizeUpper(cond?.scope?.currency || "");
      const quoteMatches = effectQuote === target || scopeCurrency === target;
      if (!quoteMatches) return false;
      if (effectBase && effectBase !== base) return false;
      if (!jurisdiction) return true;
      const scopeJurisdictions = Array.isArray(cond?.scope?.jurisdictions) ? cond.scope.jurisdictions : [];
      if (!scopeJurisdictions.length) return true;
      return scopeJurisdictions.map((item) => normalizeUpper(item)).includes(normalizeUpper(jurisdiction));
    });

  const chosen = candidates.sort((a, b) => {
    const pa = Number.isFinite(a?.priority) ? a.priority : 100;
    const pb = Number.isFinite(b?.priority) ? b.priority : 100;
    if (pa !== pb) return pa - pb;
    return new Date(b?.updated_at || b?.created_at || 0).getTime() - new Date(a?.updated_at || a?.created_at || 0).getTime();
  })[0];

  const rate = normalizeAmount(chosen?.effect?.rate ?? chosen?.effect?.exchange_rate, null);
  return rate && rate > 0 ? rate : null;
}

function computeLinePricing({ material, quantity, currency, channel, jurisdiction, conditions, fxContext = null }) {
  const ctx = { material, quantity, currency, channel, jurisdiction };
  const categorized = conditions.map((cond) => ({ ...cond, _category: categorizeCondition(cond) }));

  const priceConditions = categorized.filter((cond) => cond._category === "PRICE");
  const discountConditions = categorized.filter((cond) => cond._category === "DISCOUNT");
  const taxConditions = categorized.filter((cond) => cond._category === "TAX");

  const requestedCurrency = normalizeUpper(currency);
  const fxBaseCurrency = normalizeUpper(fxContext?.base_currency || "USD");

  let baseCondition = selectCondition(priceConditions, ctx);
  let priceCurrency = requestedCurrency;
  if (!baseCondition && requestedCurrency && requestedCurrency !== fxBaseCurrency) {
    const baseCurrencyCondition = selectCondition(priceConditions, { ...ctx, currency: fxBaseCurrency });
    if (baseCurrencyCondition) {
      baseCondition = baseCurrencyCondition;
      priceCurrency = fxBaseCurrency;
    }
  }

  let unitPrice = pickAmount(
    baseCondition?.effect?.unit_price ??
      baseCondition?.effect?.price ??
      baseCondition?.effect?.amount,
    null
  );

  if (unitPrice === null) {
    const pricing = material?.attrs?.pricing && typeof material.attrs.pricing === "object"
      ? material.attrs.pricing
      : null;
    const tiers = Array.isArray(pricing?.tiers) ? pricing.tiers : [];
    const requestedTier = tiers.find((tier) => normalizeUpper(tier?.currency) === requestedCurrency) || null;
    const baseTier =
      tiers.find((tier) => normalizeUpper(tier?.currency) === fxBaseCurrency) || null;
    const preferredTier = requestedTier || baseTier || tiers[0] || null;
    if (requestedTier) {
      priceCurrency = requestedCurrency;
    } else if (baseTier) {
      priceCurrency = fxBaseCurrency;
    }
    const fallback = pickAmount(
      material?.attrs?.unit_price ??
      material?.attrs?.price ??
      material?.attrs?.sales?.unit_price ??
      material?.attrs?.sales?.price ??
      material?.attrs?.commerce?.unit_price ??
      material?.attrs?.commerce?.price ??
      pricing?.unit_price ??
      pricing?.price ??
      pricing?.amount ??
      preferredTier?.unit_price ??
      preferredTier?.price ??
      preferredTier?.amount,
      null
    );
    if (fallback !== null) {
      unitPrice = fallback;
      if (!requestedTier && requestedCurrency && requestedCurrency !== fxBaseCurrency) {
        priceCurrency = fxBaseCurrency;
      }
    }
  }

  if (unitPrice === null) {
    return { ok: false, error: "PRICE_NOT_CONFIGURED" };
  }

  let fxApplied = null;
  if (requestedCurrency && priceCurrency && requestedCurrency !== priceCurrency) {
    let rate = normalizeAmount(fxContext?.rate, null);
    if (!rate || rate <= 0) {
      rate = resolveFxRateFromConditions(conditions, {
        baseCurrency: priceCurrency,
        targetCurrency: requestedCurrency,
        jurisdiction
      });
    }
    if (!rate || rate <= 0) {
      return { ok: false, error: "FX_RATE_NOT_CONFIGURED" };
    }
    unitPrice = Number((unitPrice * rate).toFixed(6));
    fxApplied = {
      from_currency: priceCurrency,
      to_currency: requestedCurrency,
      rate
    };
    priceCurrency = requestedCurrency;
  }

  const lineSubtotal = unitPrice * quantity;
  let discountTotal = 0;
  const appliedDiscounts = [];

  for (const disc of discountConditions.filter((cond) => scopeMatches(cond.scope, ctx))) {
    const percent = normalizeNumber(disc.effect?.percent ?? disc.effect?.rate, null);
    const amount = normalizeNumber(disc.effect?.amount, null);
    if (percent !== null) {
      const rate = percent > 1 ? percent / 100 : percent;
      const value = lineSubtotal * rate;
      discountTotal += value;
      appliedDiscounts.push({ code: disc.code, amount: value, percent: rate });
    }
    if (amount !== null) {
      discountTotal += amount;
      appliedDiscounts.push({ code: disc.code, amount });
    }
  }

  const taxableBase = Math.max(lineSubtotal - discountTotal, 0);
  let taxTotal = 0;
  const appliedTaxes = [];

  for (const tax of taxConditions.filter((cond) => scopeMatches(cond.scope, ctx))) {
    const percent = normalizeNumber(tax.effect?.rate ?? tax.effect?.percent, null);
    if (percent === null) continue;
    const rate = percent > 1 ? percent / 100 : percent;
    const value = taxableBase * rate;
    taxTotal += value;
    appliedTaxes.push({ code: tax.code, amount: value, rate });
  }

  const lineTotal = taxableBase + taxTotal;

  return {
    ok: true,
    unit_price: unitPrice,
    currency: requestedCurrency || priceCurrency || null,
    subtotal: lineSubtotal,
    discount_total: discountTotal,
    tax_total: taxTotal,
    total: lineTotal,
    applied: {
      price: baseCondition ? [{ code: baseCondition.code, unit_price: unitPrice }] : [],
      fx: fxApplied ? [fxApplied] : [],
      discounts: appliedDiscounts,
      taxes: appliedTaxes
    }
  };
}

async function buildQuote(app, tenantId, payload, context) {
  const [conditions, translationSettings] = await Promise.all([
    loadConditions(app, tenantId),
    loadCommerceTranslationSettings(app, tenantId)
  ]);
  const fxContext = resolveMarketplaceFxContext(translationSettings, {
    jurisdiction: context.jurisdiction,
    currency: payload.currency
  });
  const lines = [];
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  for (const line of payload.line_items) {
    const material = line.material;
    const result = computeLinePricing({
      material,
      quantity: line.quantity,
      currency: payload.currency,
      channel: context.channel,
      jurisdiction: context.jurisdiction,
      conditions,
      fxContext
    });
    if (!result.ok) {
      return { ok: false, error: result.error, material_code: material?.code };
    }

    subtotal += result.subtotal;
    discountTotal += result.discount_total;
    taxTotal += result.tax_total;

    lines.push({
      material_id: material.id,
      material_code: material.code,
      material_name: material.name,
      quantity: line.quantity,
      unit_price: result.unit_price,
      currency: result.currency || payload.currency,
      subtotal: result.subtotal,
      discount_total: result.discount_total,
      tax_total: result.tax_total,
      total: result.total,
      applied: result.applied
    });
  }

  const total = subtotal - discountTotal + taxTotal;

  const terms = conditions
    .filter((cond) => categorizeCondition(cond) === "TERMS")
    .filter((cond) =>
      scopeMatches(cond.scope, {
        channel: context.channel,
        jurisdiction: context.jurisdiction,
        currency: payload.currency
      })
    )
    .map((cond) => ({
      code: cond.code,
      label: cond.label,
      effect: cond.effect,
      attrs: cond.attrs
    }));

  return {
    ok: true,
    currency: payload.currency,
    totals: {
      subtotal,
      discount_total: discountTotal,
      tax_total: taxTotal,
      total
    },
    lines,
    terms
  };
}

async function resolveMaterialMap(app, tenantId, lineItems) {
  const codes = Array.from(
    new Set(
      lineItems.map((line) => normalizeText(line.material_code)).filter(Boolean)
    )
  );
  const ids = Array.from(
    new Set(
      lineItems.map((line) => normalizeText(line.material_id)).filter(Boolean)
    )
  );

  const materials = new Map();
  if (codes.length) {
    const r = await app.db.query(
      `
      SELECT id, code, name, material_type, attrs
      FROM eip_core.material
      WHERE tenant_id = $1
        AND ${publishedMaterialPredicate()}
        AND code = ANY($2::text[])
      `,
      [tenantId, codes]
    );
    for (const row of r.rows) materials.set(row.code, row);
  }
  if (ids.length) {
    const r = await app.db.query(
      `
      SELECT id, code, name, material_type, attrs
      FROM eip_core.material
      WHERE tenant_id = $1
        AND ${publishedMaterialPredicate()}
        AND id = ANY($2::uuid[])
      `,
      [tenantId, ids]
    );
    for (const row of r.rows) materials.set(row.id, row);
  }

  return materials;
}

function parseInventoryNumber(value, fallback = 0) {
  const parsed = normalizeNumber(value, null);
  return parsed === null ? fallback : parsed;
}

function isInventoryTracked(inventory = {}) {
  if (!inventory || typeof inventory !== "object") return false;
  return normalizeBoolean(inventory.track_inventory, false) === true;
}

async function applyTrackedInventoryConsumption(client, tenantId, preparedLines) {
  if (!Array.isArray(preparedLines) || !preparedLines.length) return [];

  const quantityByMaterial = new Map();
  for (const line of preparedLines) {
    const materialId = normalizeText(line?.material?.id);
    if (!materialId) continue;
    const qty = Math.max(0, parseInventoryNumber(line?.quantity, 0));
    if (!qty) continue;
    quantityByMaterial.set(materialId, (quantityByMaterial.get(materialId) || 0) + qty);
  }
  const materialIds = [...quantityByMaterial.keys()];
  if (!materialIds.length) return [];

  const lockRows = await client.query(
    `
    SELECT id, code, attrs
    FROM eip_core.material
    WHERE tenant_id = $1
      AND id = ANY($2::uuid[])
    FOR UPDATE
    `,
    [tenantId, materialIds]
  );
  if (!lockRows.rowCount) return [];

  const consumed = [];
  for (const row of lockRows.rows) {
    const attrs = row?.attrs && typeof row.attrs === "object" ? { ...row.attrs } : {};
    const inventory = attrs.inventory && typeof attrs.inventory === "object" ? { ...attrs.inventory } : {};
    if (!isInventoryTracked(inventory)) continue;

    const decrement = quantityByMaterial.get(row.id) || 0;
    if (!decrement) continue;

    const availableNow = parseInventoryNumber(inventory.available_qty, 0);
    const onHandNow = parseInventoryNumber(inventory.on_hand, availableNow);
    if (availableNow - decrement < 0) {
      throw new Error(`INSUFFICIENT_STOCK:${row.code}`);
    }

    const availableNext = Number((availableNow - decrement).toFixed(6));
    const onHandNext = Number((onHandNow - decrement).toFixed(6));
    inventory.available_qty = availableNext;
    inventory.on_hand = onHandNext < 0 ? 0 : onHandNext;
    attrs.inventory = inventory;

    await client.query(
      `
      UPDATE eip_core.material
      SET attrs = $3::jsonb,
          updated_at = now()
      WHERE tenant_id = $1
        AND id = $2
      `,
      [tenantId, row.id, JSON.stringify(attrs)]
    );

    consumed.push({
      material_id: row.id,
      material_code: row.code,
      consumed_qty: decrement,
      available_qty: availableNext,
      on_hand: inventory.on_hand
    });
  }

  return consumed;
}

function buildCode(prefix) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

function normalizeEmail(value) {
  const text = normalizeText(value);
  return text ? text.toLowerCase() : "";
}

function isLikelyEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function memberCookieBase(app) {
  const isProd = app.config.NODE_ENV === "production";
  const crossSite = Boolean(app.config.AUTH_COOKIE_CROSS_SITE);
  return {
    path: "/",
    sameSite: crossSite ? "none" : "lax",
    secure: isProd || crossSite
  };
}

function buildMagicLink(origin, challengeId, token) {
  const safeOrigin = normalizeText(origin);
  if (!safeOrigin) return "";
  const base = new URL(safeOrigin);
  base.searchParams.set("mlc", challengeId);
  base.searchParams.set("mlt", token);
  return base.toString();
}

function hashChallengeToken(app, token, challengeId) {
  return sha256Hex(`${token}:${app.config.OTP_PEPPER}:${challengeId}`);
}

function safeDisplayName(input, fallback) {
  const value = normalizeOptionalText(input);
  if (value) return value.slice(0, 120);
  const backup = normalizeOptionalText(fallback);
  return backup ? backup.slice(0, 120) : null;
}

function buildIdentityLookupKeys(...values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const key = normalizeText(value).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

async function findMemberIdentityForUpdate(client, tenantId, { credential, email, username }) {
  const keys = buildIdentityLookupKeys(credential, email, username);
  if (!keys.length) return null;

  const r = await client.query(
    `
    SELECT id, tenant_id, login, attrs, is_active, is_locked
    FROM eip_auth.auth_identity
    WHERE tenant_id = $1
      AND (
        lower(login) = ANY($2::text[])
        OR lower(COALESCE(attrs->>'username', '')) = ANY($2::text[])
      )
    ORDER BY
      CASE
        WHEN lower(login) = lower($3) THEN 0
        WHEN lower(COALESCE(attrs->>'username', '')) = lower($3) THEN 1
        WHEN lower(login) = lower($4) THEN 2
        WHEN lower(COALESCE(attrs->>'username', '')) = lower($4) THEN 3
        ELSE 4
      END,
      created_at DESC
    LIMIT 1
    FOR UPDATE
    `,
    [tenantId, keys, normalizeText(credential), normalizeText(email)]
  );

  return r.rows[0] || null;
}

async function ensureMemberPrincipal(client, tenantId, payload = {}) {
  const mode = normalizeText(payload.mode || "signin").toLowerCase();
  const isSignUp = mode === "signup";
  const credential = normalizeText(payload.credential || payload.login || payload.email);
  const password = String(payload.password || "");
  if (!credential) return { ok: false, error: "CREDENTIAL_REQUIRED" };
  if (!password) return { ok: false, error: "PASSWORD_REQUIRED" };

  const credentialIsEmail = isLikelyEmail(credential);
  const usernameInput = credentialIsEmail ? normalizeText(payload.username) : credential;
  const emailInput = normalizeEmail(payload.email || (credentialIsEmail ? credential : ""));

  const source = normalizeOptionalText(payload.source) || "public-web";
  const metadata =
    payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};

  let identity = await findMemberIdentityForUpdate(client, tenantId, {
    credential,
    email: emailInput,
    username: usernameInput
  });

  let memberCode = "";
  let email = "";
  let username = "";
  let isNewIdentity = false;

  if (identity) {
    if (isSignUp) {
      const existingUsername = normalizeText(identity.attrs?.username);
      const existingEmail = isLikelyEmail(identity.login)
        ? normalizeEmail(identity.login)
        : normalizeEmail(identity.attrs?.email);
      if (emailInput && existingEmail && existingEmail === emailInput) {
        return { ok: false, error: "EMAIL_ALREADY_USED" };
      }
      if (usernameInput && existingUsername && existingUsername.toLowerCase() === usernameInput.toLowerCase()) {
        return { ok: false, error: "USERNAME_ALREADY_USED" };
      }
      return { ok: false, error: "CREDENTIAL_ALREADY_USED" };
    }

    if (!identity.is_active || identity.is_locked) {
      return { ok: false, error: "IDENTITY_DISABLED" };
    }

    email = isLikelyEmail(identity.login)
      ? normalizeEmail(identity.login)
      : normalizeEmail(identity.attrs?.email);
    username = normalizeText(identity.attrs?.username || usernameInput);
    if (!email) return { ok: false, error: "EMAIL_REQUIRED" };

    const credRes = await client.query(
      `
      SELECT secret_hash, algorithm
      FROM eip_auth.auth_credential
      WHERE tenant_id = $1
        AND identity_id = $2
        AND credential_type = 'password'
        AND is_revoked = false
        AND (valid_to IS NULL OR valid_to > now())
      ORDER BY valid_from DESC NULLS LAST, created_at DESC
      LIMIT 1
      `,
      [tenantId, identity.id]
    );
    const verified = await verifyPassword(password, credRes.rows[0]);
    if (!verified) return { ok: false, error: "BAD_PASSWORD" };
  } else {
    if (!isSignUp) return { ok: false, error: "MEMBER_NOT_FOUND" };

    email = emailInput;
    if (!email || !isLikelyEmail(email)) return { ok: false, error: "EMAIL_REQUIRED" };
    username = normalizeText(usernameInput);

    let insertAttempt = 0;
    memberCode = buildCode("MEM");
    while (insertAttempt < 4) {
      try {
        const passwordHash = await hashPassword(password);
        const inserted = await client.query(
          `
          INSERT INTO eip_auth.auth_identity
            (tenant_id, login, login_type, is_active, is_locked, attrs)
          VALUES
            ($1, $2, 'email', true, false, $3::jsonb)
          RETURNING id, tenant_id, login, attrs, is_active, is_locked
          `,
          [
            tenantId,
            email,
            JSON.stringify({
              category: "MEMBER",
              member_code: memberCode,
              username: username || null,
              email,
              source,
              metadata
            })
          ]
        );
        identity = inserted.rows[0];
        isNewIdentity = true;
        await client.query(
          `
          INSERT INTO eip_auth.auth_credential
            (tenant_id, identity_id, credential_type, secret_hash, algorithm, meta)
          VALUES
            ($1, $2, 'password', $3, 'argon2id', '{}'::jsonb)
          `,
          [tenantId, identity.id, passwordHash]
        );
        break;
      } catch (error) {
        if (error?.code === "23505" || String(error.message || "").includes("uq_auth_identity")) {
          return { ok: false, error: "EMAIL_ALREADY_USED" };
        }
        throw error;
      }
    }
    if (!identity) return { ok: false, error: "MEMBER_CREATE_FAILED" };
  }

  const displayName = safeDisplayName(payload.name, username || email.split("@")[0]);
  const identityAttrs = identity.attrs && typeof identity.attrs === "object" ? identity.attrs : {};
  const mergedAttrs = {
    ...identityAttrs,
    category: "MEMBER",
    member_code: normalizeText(identityAttrs.member_code) || memberCode || buildCode("MEM"),
    username: username || normalizeText(identityAttrs.username) || null,
    email,
    source: normalizeText(identityAttrs.source) || source,
    metadata: {
      ...(identityAttrs.metadata && typeof identityAttrs.metadata === "object" ? identityAttrs.metadata : {}),
      ...metadata
    }
  };

  await client.query(
    `
    UPDATE eip_auth.auth_identity
    SET attrs = $3::jsonb
    WHERE tenant_id = $1
      AND id = $2
    `,
    [tenantId, identity.id, JSON.stringify(mergedAttrs)]
  );

  const profileAttrs = { profile_type: "MEMBER" };
  await client.query(
    `
    INSERT INTO eip_core.user_profile
      (tenant_id, identity_id, display_name, attrs)
    VALUES
      ($1, $2, $3, $4::jsonb)
    ON CONFLICT (tenant_id, identity_id) DO UPDATE
      SET display_name = COALESCE(eip_core.user_profile.display_name, EXCLUDED.display_name),
          attrs = COALESCE(eip_core.user_profile.attrs, '{}'::jsonb) || EXCLUDED.attrs,
          updated_at = now()
    `,
    [tenantId, identity.id, displayName, JSON.stringify(profileAttrs)]
  );

  let linkedAgent = await client.query(
    `
    SELECT a.id, a.code, a.name
    FROM eip_auth.auth_identity_agent ia
    JOIN eip_core.agent a
      ON a.tenant_id = ia.tenant_id
     AND a.id = ia.agent_id
    WHERE ia.tenant_id = $1
      AND ia.identity_id = $2
      AND ia.is_active = true
      AND ia.is_primary = true
    LIMIT 1
    `,
    [tenantId, identity.id]
  );

  if (linkedAgent.rowCount === 0) {
    let createdAgent = null;
    let attempt = 0;
    let code = buildCode("MEM");
    while (attempt < 4) {
      try {
        const insertAgent = await client.query(
          `
          INSERT INTO eip_core.agent
            (tenant_id, agent_type, code, name, attrs, is_active)
          VALUES
            ($1, 'person', $2, $3, $4::jsonb, true)
          RETURNING id, code, name
          `,
          [
            tenantId,
            code,
            displayName || email,
            JSON.stringify({
              email,
              source,
              tags: ["member", "creator_portal"]
            })
          ]
        );
        createdAgent = insertAgent.rows[0];
        break;
      } catch (error) {
        if (String(error.message || "").includes("agent_code_unique_per_tenant")) {
          attempt += 1;
          code = buildCode("MEM");
          continue;
        }
        throw error;
      }
    }
    if (!createdAgent) return { ok: false, error: "MEMBER_AGENT_CREATE_FAILED" };

    await client.query(
      `
      INSERT INTO eip_auth.auth_identity_agent
        (identity_id, tenant_id, agent_id, is_primary, is_active)
      VALUES
        ($1, $2, $3, true, true)
      ON CONFLICT (identity_id, agent_id) DO UPDATE
        SET is_primary = true,
            is_active = true
      `,
      [identity.id, tenantId, createdAgent.id]
    );
    linkedAgent = { rowCount: 1, rows: [createdAgent] };
  }

  await ensureEntityContact(client, tenantId, linkedAgent.rows[0].id, "email", email);

  return {
    ok: true,
    identityId: identity.id,
    login: email,
    username: mergedAttrs.username || null,
    displayName,
    memberCode: mergedAttrs.member_code,
    created: isNewIdentity,
    agentId: linkedAgent.rows[0].id,
    agentCode: linkedAgent.rows[0].code
  };
}

async function loadMemberSession(app, req, tenantId, suffix) {
  const sid = normalizeText(req.cookies?.member_sid);
  if (!sid) return null;
  const sessionRes = await app.db.query(
    `
    SELECT id, tenant_id, identity_id, expires_at, is_revoked, attrs, csrf_secret_hash
    FROM eip_auth.auth_session
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [sid]
  );
  if (sessionRes.rowCount === 0) return null;
  const session = sessionRes.rows[0];
  if (session.is_revoked) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;
  if (String(session.tenant_id) !== String(tenantId)) return null;

  const attrs = session.attrs && typeof session.attrs === "object" ? session.attrs : {};
  if (String(attrs.realm || "").toUpperCase() !== "MEMBER") return null;
  if (suffix && normalizeText(attrs.connection_suffix) !== normalizeText(suffix)) return null;

  return session;
}

async function loadMemberProfile(client, tenantId, identityId) {
  const r = await client.query(
    `
    SELECT
      i.id AS identity_id,
      i.login,
      i.attrs AS identity_attrs,
      up.display_name,
      up.title,
      up.phone,
      up.locale,
      up.timezone,
      up.avatar_url,
      up.attrs AS profile_attrs
    FROM eip_auth.auth_identity i
    LEFT JOIN eip_core.user_profile up
      ON up.tenant_id = i.tenant_id
     AND up.identity_id = i.id
    WHERE i.tenant_id = $1
      AND i.id = $2
    LIMIT 1
    `,
    [tenantId, identityId]
  );
  if (r.rowCount === 0) return null;
  const row = r.rows[0];
  const attrs = row.identity_attrs && typeof row.identity_attrs === "object" ? row.identity_attrs : {};
  const profileAttrs = row.profile_attrs && typeof row.profile_attrs === "object" ? row.profile_attrs : {};
  const metadata = attrs.metadata && typeof attrs.metadata === "object" ? attrs.metadata : {};
  return {
    identity_id: row.identity_id,
    login: row.login,
    username: normalizeText(attrs.username) || null,
    display_name: row.display_name || null,
    title: row.title || null,
    phone: row.phone || null,
    locale: row.locale || null,
    timezone: row.timezone || null,
    avatar_url: row.avatar_url || null,
    preferences: profileAttrs.preferences && typeof profileAttrs.preferences === "object" ? profileAttrs.preferences : {},
    metadata,
    category: attrs.category || "MEMBER",
    member_code: attrs.member_code || null,
    label: normalizeText(attrs.username) || row.login
  };
}

function normalizeReviewText(value, maxLength) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  return text.slice(0, maxLength);
}

function detectFlaggedTerms(text) {
  const normalized = String(text || "").toLowerCase();
  if (!normalized) return [];
  return REVIEW_BLOCKED_TERMS.filter((term) => normalized.includes(term));
}

function toPublicReview(row) {
  const attrs = row?.attrs && typeof row.attrs === "object" ? row.attrs : {};
  const reviewer = attrs.reviewer && typeof attrs.reviewer === "object" ? attrs.reviewer : {};
  const rating = Number(attrs.rating);
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    created_at: row.created_at,
    rating: Number.isFinite(rating) ? rating : null,
    title: normalizeText(attrs.title),
    comment: normalizeText(attrs.comment),
    reviewer: {
      name: normalizeText(reviewer.name || "Anonymous"),
      verified_purchase: reviewer.verified_purchase === true
    }
  };
}

function normalizeBlogText(value, maxLength) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  return text.slice(0, maxLength);
}

function normalizeBlogTags(input) {
  const source = Array.isArray(input)
    ? input
    : String(input || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const seen = new Set();
  const tags = [];
  for (const raw of source) {
    const cleaned = normalizeBlogText(raw, 40)
      .toLowerCase()
      .replace(/[^a-z0-9#\-_\s]/g, "")
      .trim();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    tags.push(cleaned.startsWith("#") ? cleaned : `#${cleaned}`);
    if (tags.length >= 10) break;
  }
  return tags;
}

function normalizeBlogImageUrls(input) {
  const source = Array.isArray(input)
    ? input
    : String(input || "")
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
  const urls = [];
  const seen = new Set();
  for (const raw of source) {
    const normalized = normalizeOptionalText(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
    if (urls.length >= 10) break;
  }
  return urls;
}

function toPublicBlogPost(row, app, tenantId) {
  const attrs = row?.attrs && typeof row.attrs === "object" ? row.attrs : {};
  const author = attrs.author && typeof attrs.author === "object" ? attrs.author : {};
  const reactions = attrs.reactions && typeof attrs.reactions === "object" ? attrs.reactions : {};
  const imageUrl = normalizeOptionalText(attrs.image_url || attrs.image || "");
  const imageUrls = normalizeBlogImageUrls(attrs.image_urls || attrs.images || []);
  if (imageUrl && !imageUrls.includes(imageUrl)) {
    imageUrls.unshift(imageUrl);
  }
  const signedImageUrls = imageUrls
    .map((url) => signAssetUrl(url, app, tenantId))
    .filter(Boolean);
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner_identity_id: normalizeOptionalText(attrs.created_by_identity_id || author.identity_id),
    title: normalizeBlogText(attrs.title || row.title || "", 160),
    body: normalizeBlogText(attrs.body || attrs.summary || "", 6000),
    image_url: signedImageUrls[0] || "",
    image_urls: signedImageUrls,
    tags: normalizeBlogTags(attrs.tags || []),
    author: {
      name: normalizeBlogText(author.name || "Creator", 120) || "Creator",
      role: normalizeBlogText(author.role || "Member", 80) || "Member",
      identity_id: normalizeOptionalText(author.identity_id || "")
    },
    metrics: {
      likes: Number.isFinite(Number(reactions.likes)) ? Number(reactions.likes) : 0,
      dislikes: Number.isFinite(Number(reactions.dislikes)) ? Number(reactions.dislikes) : 0,
      comments: Number.isFinite(Number(reactions.comments)) ? Number(reactions.comments) : 0
    }
  };
}

function emptyReviewSummary() {
  return {
    total: 0,
    average_rating: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  };
}

async function loadProductReviewSummary(db, tenantId, materialCode) {
  if (!tenantId || !materialCode) return emptyReviewSummary();

  const summaryRes = await db.query(
    `
    SELECT
      COUNT(*)::int AS total,
      COALESCE(AVG((attrs->>'rating')::numeric), 0)::numeric(10,2) AS average_rating
    FROM eip_core.service_object
    WHERE tenant_id = $1
      AND object_type = $2
      AND status = ANY($3::text[])
      AND attrs->>'material_code' = $4
      AND (attrs->>'rating') ~ '^[1-5](\\.[0-9]+)?$'
    `,
    [tenantId, PRODUCT_REVIEW_OBJECT_TYPE, Array.from(REVIEW_VISIBLE_STATUSES), materialCode]
  );

  const distRes = await db.query(
    `
    SELECT ROUND((attrs->>'rating')::numeric)::int AS rating, COUNT(*)::int AS count
    FROM eip_core.service_object
    WHERE tenant_id = $1
      AND object_type = $2
      AND status = ANY($3::text[])
      AND attrs->>'material_code' = $4
      AND (attrs->>'rating') ~ '^[1-5](\\.[0-9]+)?$'
    GROUP BY ROUND((attrs->>'rating')::numeric)::int
    `,
    [tenantId, PRODUCT_REVIEW_OBJECT_TYPE, Array.from(REVIEW_VISIBLE_STATUSES), materialCode]
  );

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of distRes.rows || []) {
    if (row.rating >= 1 && row.rating <= 5) distribution[row.rating] = row.count;
  }

  const total = Number(summaryRes.rows?.[0]?.total || 0);
  const average = Number(summaryRes.rows?.[0]?.average_rating || 0);
  return {
    total,
    average_rating: Number.isFinite(average) ? average : 0,
    distribution
  };
}

async function resolveAgentByContact(client, tenantId, contactType, value) {
  if (!value) return null;
  const r = await client.query(
    `
    SELECT id, code, name, attrs
    FROM eip_core.agent
    WHERE tenant_id = $1
      AND agent_type = 'person'
      AND lower(attrs->>$2) = $3
    LIMIT 1
    `,
    [tenantId, contactType, value.toLowerCase()]
  );
  return r.rows[0] || null;
}

async function ensureEntityContact(client, tenantId, entityId, type, value, label = "primary") {
  if (!value) return;
  const exists = await client.query(
    `
    SELECT 1
    FROM eip_core.entity_contact
    WHERE tenant_id = $1
      AND entity_id = $2
      AND contact_type = $3
      AND lower(value) = $4
      AND is_active = true
    LIMIT 1
    `,
    [tenantId, entityId, type, value.toLowerCase()]
  );
  if (exists.rowCount > 0) return;

  const hasPrimary = await client.query(
    `
    SELECT 1
    FROM eip_core.entity_contact
    WHERE tenant_id = $1
      AND entity_id = $2
      AND contact_type = $3
      AND is_active = true
      AND is_primary = true
    LIMIT 1
    `,
    [tenantId, entityId, type]
  );

  await client.query(
    `
    INSERT INTO eip_core.entity_contact
      (tenant_id, entity_id, contact_type, label, value, is_primary, attrs)
    VALUES
      ($1,$2,$3,$4,$5,$6,'{}'::jsonb)
    ON CONFLICT DO NOTHING
    `,
    [tenantId, entityId, type, label, value, hasPrimary.rowCount === 0]
  );
}

export default async function publicCommerceRoutes(app) {
  registerRawBody(app);

  app.options("/commerce/*", async (req, reply) => {
    const origin = req.headers.origin;
    applyCors(reply, origin, req.headers["access-control-request-headers"]);
    return reply.code(204).send();
  });

  async function resolveConnection(appInstance, req, reply, allowedChannels) {
    const suffix = normalizeText(req.params?.suffix);
    if (!suffix) {
      reply.code(400).send({ ok: false, error: "CONNECTION_SUFFIX_REQUIRED" });
      return null;
    }

    const resolved = await resolveTenantBySuffix(appInstance, suffix);
    if (!resolved) {
      reply.code(404).send({ ok: false, error: "ROUTING_NOT_FOUND" });
      return null;
    }
    if (resolved.error) {
      reply.code(409).send({ ok: false, error: resolved.error });
      return null;
    }

    const { tenant, profile } = resolved;
    if (!profile) {
      reply.code(404).send({ ok: false, error: "CONNECTION_NOT_FOUND" });
      return null;
    }
    if (!profile.identity?.is_enabled) {
      reply.code(403).send({ ok: false, error: "CONNECTION_DISABLED" });
      return null;
    }
    if (!requiresInbound(profile)) {
      reply.code(403).send({ ok: false, error: "INBOUND_NOT_ALLOWED" });
      return null;
    }

    if (Array.isArray(allowedChannels) && allowedChannels.length) {
      const channel = normalizeText(profile.routing?.channel);
      if (!allowedChannels.includes(channel)) {
        reply.code(403).send({ ok: false, error: "CHANNEL_NOT_ALLOWED" });
        return null;
      }
    }

    const origin = req.headers.origin;
    if (!connectionAllowsOrigin(profile, origin)) {
      reply.code(403).send({ ok: false, error: "ORIGIN_NOT_ALLOWED" });
      return null;
    }

    if (!connectionAllowsIp(profile, req.ip)) {
      reply.code(403).send({ ok: false, error: "IP_NOT_ALLOWED" });
      return null;
    }

    const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody || "");

    // Do not enforce a single profile-level HTTP method/content-type across all
    // storefront endpoints. Public commerce includes mixed operations (GET/POST/PATCH/DELETE
    // and multipart uploads) that are already validated per route + auth checks.
    // A profile-wide method gate caused valid member actions (e.g. blog delete) to fail
    // with METHOD_NOT_ALLOWED expected POST.

    const verify = await verifyInboundRequest(req, profile, rawBody);
    if (!verify.ok) {
      reply.code(401).send({ ok: false, error: verify.error });
      return null;
    }

    applyCors(reply, origin);
    return { tenant, profile };
  }

  function clearMemberCookies(reply) {
    const options = memberCookieBase(app);
    reply.clearCookie("member_sid", options);
    reply.clearCookie("member_csrf", options);
  }

  async function requireMemberSession(access, req, reply) {
    const session = await loadMemberSession(
      app,
      req,
      access.tenant.id,
      req.params?.suffix
    );
    if (!session) {
      clearMemberCookies(reply);
      reply.code(401).send({ ok: false, error: "MEMBER_UNAUTHENTICATED" });
      return null;
    }
    const profile = await loadMemberProfile(app.db, access.tenant.id, session.identity_id);
    if (!profile) {
      clearMemberCookies(reply);
      reply.code(401).send({ ok: false, error: "MEMBER_UNAUTHENTICATED" });
      return null;
    }
    return { session, profile };
  }

  function requireMemberCsrf(member, req, reply) {
    const csrfCookie = normalizeText(req.cookies?.member_csrf);
    const csrfHeader = normalizeText(req.headers["x-member-csrf"]);
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      reply.code(403).send({ ok: false, error: "CSRF_MISSING" });
      return false;
    }
    const expectedHash = sha256Hex(`${csrfCookie}:${app.config.CSRF_PEPPER}`);
    if (!member?.session?.csrf_secret_hash || !timingSafeEqual(expectedHash, member.session.csrf_secret_hash)) {
      reply.code(403).send({ ok: false, error: "CSRF_INVALID" });
      return false;
    }
    return true;
  }

  app.post(
    "/commerce/:suffix/member/auth/start",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      let body;
      try {
        body = parseJsonBody(req);
      } catch {
        return reply.code(400).send({ ok: false, error: "INVALID_JSON" });
      }

      const credential = normalizeText(body.credential || body.login || body.email);
      const password = String(body.password || "");
      const mode = normalizeText(body.mode || "signin").toLowerCase() === "signup" ? "signup" : "signin";
      const email = normalizeEmail(body.email);
      const name = normalizeOptionalText(body.name || body.display_name);
      const metadataInput =
        body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
          ? body.metadata
          : {};
      if (!credential) {
        return reply.code(400).send({ ok: false, error: "CREDENTIAL_REQUIRED" });
      }
      if (!password) {
        return reply.code(400).send({ ok: false, error: "PASSWORD_REQUIRED" });
      }

      const client = await app.db.connect();
      let challengeId = "";
      let token = "";
      let principal = null;
      try {
        await client.query("BEGIN");

        const ensured = await ensureMemberPrincipal(client, access.tenant.id, {
          mode,
          credential,
          email,
          password,
          name,
          source: resolveClientSource(access, body.source),
          metadata: {
            connection_code: access.profile?.identity?.connection_code || null,
            ...metadataInput
          }
        });
        if (!ensured.ok) {
          await client.query("ROLLBACK");
          if (ensured.error === "BAD_PASSWORD") {
            return reply.code(401).send({ ok: false, error: ensured.error });
          }
          if (
            ensured.error === "CREDENTIAL_REQUIRED" ||
            ensured.error === "PASSWORD_REQUIRED" ||
            ensured.error === "EMAIL_REQUIRED"
          ) {
            return reply.code(400).send({ ok: false, error: ensured.error });
          }
          if (ensured.error === "MEMBER_NOT_FOUND" || ensured.error === "BAD_PASSWORD") {
            return reply.code(401).send({ ok: false, error: ensured.error });
          }
          if (
            ensured.error === "EMAIL_ALREADY_USED" ||
            ensured.error === "USERNAME_ALREADY_USED" ||
            ensured.error === "CREDENTIAL_ALREADY_USED"
          ) {
            return reply.code(409).send({ ok: false, error: ensured.error });
          }
          if (ensured.error === "IDENTITY_DISABLED") {
            return reply.code(403).send({ ok: false, error: ensured.error });
          }
          return reply.code(409).send({ ok: false, error: ensured.error });
        }
        principal = ensured;

        if (mode === "signin") {
          const profile = await loadMemberProfile(client, access.tenant.id, ensured.identityId);
          if (!profile) {
            await client.query("ROLLBACK");
            return reply.code(401).send({ ok: false, error: "MEMBER_NOT_FOUND" });
          }

          const sessionId = crypto.randomUUID();
          const csrf = randomToken(24);
          const csrfHash = sha256Hex(`${csrf}:${app.config.CSRF_PEPPER}`);
          const uaHash = sha256Hex(String(req.headers["user-agent"] || ""));
          const expiresAt = new Date(Date.now() + MEMBER_SESSION_TTL_MS);

          await client.query(
            `
            INSERT INTO eip_auth.auth_session
              (id, tenant_id, identity_id, expires_at, csrf_secret_hash, ip_address, user_agent_hash, attrs)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
            `,
            [
              sessionId,
              access.tenant.id,
              ensured.identityId,
              expiresAt,
              csrfHash,
              req.ip,
              uaHash,
              JSON.stringify({
                realm: "MEMBER",
                assurance: "password",
                category: "MEMBER",
                connection_suffix: normalizeText(req.params?.suffix),
                member_code: profile.member_code || null,
                login: profile.login || null
              })
            ]
          );

          await client.query("COMMIT");
          client.release();

          const cookieBase = memberCookieBase(app);
          reply.setCookie("member_sid", sessionId, {
            ...cookieBase,
            httpOnly: true,
            expires: expiresAt
          });
          reply.setCookie("member_csrf", csrf, {
            ...cookieBase,
            httpOnly: false,
            expires: expiresAt
          });

          return reply.send({
            ok: true,
            authenticated: true,
            member: profile
          });
        }

        challengeId = crypto.randomUUID();
        token = randomToken(24);
        const tokenHash = hashChallengeToken(app, token, challengeId);
        const expiresAt = new Date(Date.now() + MEMBER_MAGIC_LINK_TTL_MS);

        await client.query(
          `
          INSERT INTO eip_auth.auth_otp_challenge
            (id, tenant_id, identity_id, channel, otp_hash, expires_at, max_attempts, attempt_count)
          VALUES
            ($1, $2, $3, 'email', $4, $5, 6, 0)
          `,
          [challengeId, access.tenant.id, ensured.identityId, tokenHash, expiresAt]
        );

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        client.release();
        app.log.error({
          event: "member_auth_start_failed",
          tenantId: access.tenant.id,
          error: error.message,
          code: error.code,
          constraint: error.constraint,
          detail: error.detail
        });
        const response = { ok: false, error: "MEMBER_AUTH_START_FAILED" };
        if (app.config.NODE_ENV !== "production") {
          response.detail = error.message;
          if (error.code) response.error_code = error.code;
          if (error.constraint) response.constraint = error.constraint;
        }
        return reply.code(500).send(response);
      }
      client.release();

      const origin =
        normalizeText(req.headers.origin) ||
        (Array.isArray(app.PUBLIC_ORIGINS) && app.PUBLIC_ORIGINS.length ? app.PUBLIC_ORIGINS[0] : "");
      const magicLink = buildMagicLink(origin, challengeId, token);

      const expiresMin = Math.max(1, Math.round(MEMBER_MAGIC_LINK_TTL_MS / 60000));
      const subject = "Your Samara sign-in link";
      const text = `Use this secure sign-in link: ${magicLink}\nThis link expires in ${expiresMin} minutes.`;
      const html = `<p>Hello${principal?.displayName ? ` ${principal.displayName}` : ""},</p><p>Use this secure sign-in link:</p><p><a href="${magicLink}">${magicLink}</a></p><p>This link expires in ${expiresMin} minutes.</p>`;
      try {
        await sendEmail(app, principal?.login, subject, text, html);
      } catch (error) {
        app.log.error({ event: "member_auth_email_failed", tenantId: access.tenant.id, error: error.message });
      }

      const response = {
        ok: true,
        challenge_id: challengeId,
        expires_in_sec: Math.floor(MEMBER_MAGIC_LINK_TTL_MS / 1000)
      };
      if (app.config.NODE_ENV !== "production") {
        response.debug = {
          magic_link: magicLink,
          token
        };
      }
      return reply.send(response);
    }
  );

  app.post(
    "/commerce/:suffix/member/auth/verify",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      let body;
      try {
        body = parseJsonBody(req);
      } catch {
        return reply.code(400).send({ ok: false, error: "INVALID_JSON" });
      }

      const challengeId = normalizeText(body.challenge_id || body.challengeId || body.challenge);
      const token = normalizeText(body.token);
      if (!challengeId || !token) {
        return reply.code(400).send({ ok: false, error: "MAGIC_LINK_REQUIRED" });
      }

      const client = await app.db.connect();
      let profile = null;
      let sessionId = "";
      let csrf = "";
      let expiresAt = null;
      try {
        await client.query("BEGIN");
        const challengeRes = await client.query(
          `
          SELECT id, tenant_id, identity_id, otp_hash, expires_at, is_consumed, attempt_count, max_attempts
          FROM eip_auth.auth_otp_challenge
          WHERE id = $1::uuid
            AND tenant_id = $2
            AND channel = 'email'
          LIMIT 1
          FOR UPDATE
          `,
          [challengeId, access.tenant.id]
        );
        if (challengeRes.rowCount === 0) {
          await client.query("ROLLBACK");
          client.release();
          return reply.code(401).send({ ok: false, error: "MAGIC_LINK_INVALID" });
        }

        const challenge = challengeRes.rows[0];
        if (challenge.is_consumed) {
          await client.query("ROLLBACK");
          client.release();
          return reply.code(410).send({ ok: false, error: "MAGIC_LINK_USED" });
        }
        if (new Date(challenge.expires_at).getTime() <= Date.now()) {
          await client.query("ROLLBACK");
          client.release();
          return reply.code(410).send({ ok: false, error: "MAGIC_LINK_EXPIRED" });
        }

        const expectedHash = hashChallengeToken(app, token, challengeId);
        if (!timingSafeEqual(expectedHash, challenge.otp_hash)) {
          const attempts = Number(challenge.attempt_count || 0) + 1;
          await client.query(
            `
            UPDATE eip_auth.auth_otp_challenge
            SET attempt_count = $3,
                is_consumed = CASE WHEN $3 >= max_attempts THEN true ELSE is_consumed END,
                consumed_at = CASE WHEN $3 >= max_attempts THEN now() ELSE consumed_at END
            WHERE tenant_id = $1
              AND id = $2::uuid
            `,
            [access.tenant.id, challengeId, attempts]
          );
          await client.query("COMMIT");
          client.release();
          return reply.code(401).send({ ok: false, error: "MAGIC_LINK_INVALID" });
        }

        await client.query(
          `
          UPDATE eip_auth.auth_otp_challenge
          SET is_consumed = true,
              consumed_at = now()
          WHERE tenant_id = $1
            AND id = $2::uuid
          `,
          [access.tenant.id, challengeId]
        );

        profile = await loadMemberProfile(client, access.tenant.id, challenge.identity_id);
        if (!profile) {
          await client.query("ROLLBACK");
          client.release();
          return reply.code(401).send({ ok: false, error: "MEMBER_NOT_FOUND" });
        }

        sessionId = crypto.randomUUID();
        csrf = randomToken(24);
        const csrfHash = sha256Hex(`${csrf}:${app.config.CSRF_PEPPER}`);
        const uaHash = sha256Hex(String(req.headers["user-agent"] || ""));
        expiresAt = new Date(Date.now() + MEMBER_SESSION_TTL_MS);

        await client.query(
          `
          INSERT INTO eip_auth.auth_session
            (id, tenant_id, identity_id, expires_at, csrf_secret_hash, ip_address, user_agent_hash, attrs)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          `,
          [
            sessionId,
            access.tenant.id,
            profile.identity_id,
            expiresAt,
            csrfHash,
            req.ip,
            uaHash,
            JSON.stringify({
              realm: "MEMBER",
              assurance: "magic_link",
              category: "MEMBER",
              connection_suffix: normalizeText(req.params?.suffix),
              member_code: profile.member_code || null,
              login: profile.login || null
            })
          ]
        );

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        client.release();
        app.log.error({ event: "member_auth_verify_failed", tenantId: access.tenant.id, error: error.message });
        return reply.code(500).send({ ok: false, error: "MEMBER_AUTH_VERIFY_FAILED" });
      }
      client.release();

      const cookieBase = memberCookieBase(app);
      reply.setCookie("member_sid", sessionId, {
        ...cookieBase,
        httpOnly: true,
        expires: expiresAt
      });
      reply.setCookie("member_csrf", csrf, {
        ...cookieBase,
        httpOnly: false,
        expires: expiresAt
      });

      return reply.send({ ok: true, member: profile });
    }
  );

  app.get(
    "/commerce/:suffix/member/auth/me",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const session = await loadMemberSession(app, req, access.tenant.id, req.params?.suffix);
      if (!session) {
        clearMemberCookies(reply);
        return reply.send({ ok: true, authenticated: false, member: null });
      }

      const profile = await loadMemberProfile(app.db, access.tenant.id, session.identity_id);
      if (!profile) {
        clearMemberCookies(reply);
        return reply.send({ ok: true, authenticated: false, member: null });
      }

      return reply.send({ ok: true, authenticated: true, member: profile });
    }
  );

  app.patch(
    "/commerce/:suffix/member/profile",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const member = await requireMemberSession(access, req, reply);
      if (!member) return;

      const csrfCookie = normalizeText(req.cookies?.member_csrf);
      const csrfHeader = normalizeText(req.headers["x-member-csrf"]);
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return reply.code(403).send({ ok: false, error: "CSRF_MISSING" });
      }

      const expectedHash = sha256Hex(`${csrfCookie}:${app.config.CSRF_PEPPER}`);
      if (!member.session.csrf_secret_hash || !timingSafeEqual(expectedHash, member.session.csrf_secret_hash)) {
        return reply.code(403).send({ ok: false, error: "CSRF_INVALID" });
      }

      let body;
      try {
        body = parseJsonBody(req);
      } catch {
        return reply.code(400).send({ ok: false, error: "INVALID_JSON" });
      }

      const displayName = normalizeOptionalText(body.display_name || body.displayName);
      const title = normalizeOptionalText(body.title);
      const phone = normalizeOptionalText(body.phone);
      const locale = normalizeOptionalText(body.locale);
      const timezone = normalizeOptionalText(body.timezone);
      const avatarUrl = normalizeOptionalText(body.avatar_url || body.avatarUrl);
      const preferencesInput = body.preferences && typeof body.preferences === "object" && !Array.isArray(body.preferences)
        ? body.preferences
        : {};
      const firstName = normalizeOptionalText(body.first_name || body.firstName);
      const lastName = normalizeOptionalText(body.last_name || body.lastName);

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        await client.query(
          `
          INSERT INTO eip_core.user_profile
            (tenant_id, identity_id, display_name, title, phone, locale, timezone, avatar_url, attrs)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, jsonb_build_object('preferences', $9::jsonb))
          ON CONFLICT (tenant_id, identity_id) DO UPDATE
            SET display_name = COALESCE($3, eip_core.user_profile.display_name),
                title = COALESCE($4, eip_core.user_profile.title),
                phone = COALESCE($5, eip_core.user_profile.phone),
                locale = COALESCE($6, eip_core.user_profile.locale),
                timezone = COALESCE($7, eip_core.user_profile.timezone),
                avatar_url = COALESCE($8, eip_core.user_profile.avatar_url),
                attrs = COALESCE(eip_core.user_profile.attrs, '{}'::jsonb) || jsonb_build_object('preferences', $9::jsonb),
                updated_at = now()
          `,
          [
            access.tenant.id,
            member.session.identity_id,
            displayName,
            title,
            phone,
            locale,
            timezone,
            avatarUrl,
            JSON.stringify(preferencesInput)
          ]
        );

        if (firstName || lastName) {
          const identityRes = await client.query(
            `
            SELECT attrs
            FROM eip_auth.auth_identity
            WHERE tenant_id = $1
              AND id = $2
            LIMIT 1
            FOR UPDATE
            `,
            [access.tenant.id, member.session.identity_id]
          );
          if (identityRes.rowCount > 0) {
            const attrs = identityRes.rows[0]?.attrs && typeof identityRes.rows[0].attrs === "object"
              ? identityRes.rows[0].attrs
              : {};
            const metadata = attrs.metadata && typeof attrs.metadata === "object" ? attrs.metadata : {};
            const nextAttrs = {
              ...attrs,
              metadata: {
                ...metadata,
                ...(firstName ? { first_name: firstName } : {}),
                ...(lastName ? { last_name: lastName } : {})
              }
            };
            await client.query(
              `
              UPDATE eip_auth.auth_identity
              SET attrs = $3::jsonb
              WHERE tenant_id = $1
                AND id = $2
              `,
              [access.tenant.id, member.session.identity_id, JSON.stringify(nextAttrs)]
            );
          }
        }

        const profile = await loadMemberProfile(client, access.tenant.id, member.session.identity_id);
        await client.query("COMMIT");
        return reply.send({ ok: true, member: profile });
      } catch (error) {
        await client.query("ROLLBACK");
        app.log.error({ event: "member_profile_update_failed", tenantId: access.tenant.id, error: error.message });
        return reply.code(500).send({ ok: false, error: "MEMBER_PROFILE_UPDATE_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/commerce/:suffix/meta/countries",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const r = await app.db.query(
        `
        SELECT code, name
        FROM eip_core.jurisdiction
        WHERE tenant_id IS NULL
          AND level = 'COUNTRY'
          AND is_active = true
        ORDER BY name ASC
        `
      );
      const items = (r.rows || [])
        .map((row) => ({
          iso: normalizeText(row.code).toUpperCase(),
          name: normalizeText(row.name)
        }))
        .filter((row) => row.iso && row.name);

      return reply.send({ ok: true, items });
    }
  );

  const sendTradeTerms = async (req, reply) => {
    const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
    if (!access) return;

    const channel = normalizeText(req.query?.channel || "WEB");
    const jurisdiction = normalizeText(req.query?.jurisdiction_code || req.query?.jurisdiction || "");
    const currency = normalizeText(req.query?.currency || "");
    const context = {
      material: null,
      quantity: 1,
      channel,
      jurisdiction,
      currency
    };

    const conditions = await loadConditions(app, access.tenant.id);
    const items = conditions
      .filter((cond) => categorizeCondition(cond) === "TERMS")
      .filter((cond) => scopeMatches(cond.scope, context))
      .map((cond) => ({
        code: cond.code,
        label: cond.label,
        priority: cond.priority,
        text: pickConditionText(cond),
        url: normalizeText(
          cond?.effect?.url ||
          cond?.attrs?.url ||
          cond?.effect?.link ||
          cond?.attrs?.link ||
          ""
        ),
        scope: cond.scope || {},
        effect: cond.effect || {},
        attrs: cond.attrs || {}
      }));

    return reply.send({ ok: true, items });
  };

  app.get(
    "/commerce/:suffix/meta/trade-conditions",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    sendTradeTerms
  );

  app.get(
    "/commerce/:suffix/meta/terms",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    sendTradeTerms
  );

  app.get(
    "/commerce/:suffix/meta/locales",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;
      const translation = await loadCommerceTranslationSettings(app, access.tenant.id);
      const resolved = resolveTranslationLocales(translation);
      return reply.send({
        ok: true,
        default_locale: resolved.defaultLocale,
        source_locale: resolved.sourceLocale,
        locales: resolved.locales.map((code) => ({ code, label: localeLabel(code) }))
      });
    }
  );

  app.get(
    "/commerce/:suffix/meta/fx",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const translation = await loadCommerceTranslationSettings(app, access.tenant.id);
      const fxRaw = translation?.fx && typeof translation.fx === "object" ? translation.fx : {};
      const baseCurrency = normalizeCurrencyCode(fxRaw.base_currency || "USD", "USD");

      const marketplaces = (Array.isArray(translation?.marketplaces) ? translation.marketplaces : [])
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => {
          const primaryLocale = normalizeLocaleCode(entry.primary_locale);
          const allowedLocales = Array.isArray(entry.allowed_locales)
            ? entry.allowed_locales.map((locale) => normalizeLocaleCode(locale)).filter(Boolean)
            : [];
          return {
            jurisdiction_code: normalizeUpper(entry.jurisdiction_code || ""),
            primary_locale: primaryLocale || null,
            allowed_locales: Array.from(new Set(allowedLocales)),
            currency: normalizeCurrencyCode(entry.currency || baseCurrency, baseCurrency),
            exchange_rate: normalizeFxRate(entry.exchange_rate, 1)
          };
        })
        .filter((entry) => entry.jurisdiction_code);

      return reply.send({
        ok: true,
        fx: {
          enabled: normalizeBoolean(fxRaw.enabled, true),
          auto_sync: normalizeBoolean(fxRaw.auto_sync, true),
          base_currency: baseCurrency,
          status: normalizeText(fxRaw.status || "pending").toLowerCase() || "pending",
          last_sync_at: normalizeOptionalText(fxRaw.last_sync_at),
          last_provider: normalizeOptionalText(fxRaw.last_provider),
          last_error: normalizeOptionalText(fxRaw.last_error)
        },
        marketplaces
      });
    }
  );

  app.get(
    "/commerce/:suffix/meta/checkout-config",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const payment = await loadCommercePaymentSettings(app, access.tenant.id);
      const methods = Array.isArray(payment.methods)
        ? payment.methods.map((method) => ({
            code: normalizePaymentMethodCode(method.code),
            label: normalizeText(method.label || method.code || "").trim(),
            enabled: method.enabled !== false
          }))
        : [];
      const enabledMethods = methods.filter((method) => method.enabled).map((method) => method.code);
      const providers = {};
      for (const method of methods) {
        const code = normalizePaymentMethodCode(method.code);
        if (!code) continue;
        const provider = payment.providers?.[code] || {};
        providers[code] = {
          mode: normalizeProviderMode(provider.mode || "manual"),
          public_key: normalizeText(provider.public_key || ""),
          client_id: normalizeText(provider.client_id || ""),
          app_id: normalizeText(provider.app_id || "")
        };
      }

      return reply.send({
        ok: true,
        payment: {
          methods,
          enabled_methods: enabledMethods,
          providers
        }
      });
    }
  );

  app.get(
    "/commerce/:suffix/content",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const slot = normalizeText(req.query?.slot || "home.hero").toLowerCase();
      if (!slot) return reply.code(400).send({ ok: false, error: "SLOT_REQUIRED" });
      const activeOnly = String(req.query?.active_only || "true").toLowerCase() !== "false";
      const publishedOnly = String(req.query?.published_only || "true").toLowerCase() !== "false";

      const r = await app.db.query(
        `
        SELECT id, code, title, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = 'storefront_content'
          AND attrs->>'slot' = $2
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 50
        `,
        [access.tenant.id, slot]
      );
      if (r.rowCount === 0) return reply.send({ ok: true, item: null, slot });

      let selected = null;
      for (const candidate of r.rows) {
        const candidateAttrs =
          candidate?.attrs && typeof candidate.attrs === "object" ? candidate.attrs : {};
        const candidateIsActive = isStorefrontContentActive(candidateAttrs);
        if (activeOnly && !candidateIsActive) continue;
        const candidateIsPublished = isStorefrontContentPublished(candidate, candidateAttrs);
        if (publishedOnly && !candidateIsPublished) continue;
        selected = { row: candidate, attrs: candidateAttrs, isActive: candidateIsActive };
        break;
      }
      if (!selected) return reply.send({ ok: true, item: null, slot });
      const { row, attrs, isActive } = selected;

      const slides = Array.isArray(attrs.slides)
        ? attrs.slides
            .map((slide, index) => {
              if (!slide || typeof slide !== "object") return null;
              const rawImage = normalizeText(
                slide.image ||
                slide.image_url ||
                slide.media?.url ||
                ""
              );
              const image = rawImage ? signAssetUrl(rawImage, app, access.tenant.id) : "";
              if (rawImage && !image) return null;
              const cta = normalizeStorefrontCta(slide);
              return {
                id: normalizeText(slide.id || `slide-${index + 1}`),
                image: image || "",
                eyebrow: normalizeText(slide.eyebrow || ""),
                title: normalizeText(slide.title || ""),
                subtitle: normalizeText(slide.subtitle || ""),
                body: normalizeText(slide.body || slide.content || ""),
                cta_label: normalizeText(slide.cta_label || slide.ctaLabel || ""),
                cta_url: cta.target,
                cta,
                cta_action: cta.action,
                cta_target: cta.target,
                cta_new_tab: cta.new_tab,
                overlay: normalizeText(slide.overlay || "").toLowerCase() === "center" ? "center" : "left",
                fit: normalizeText(slide.fit || slide.image_fit || "").toLowerCase() === "contain" ? "contain" : "cover",
                focus_x: Number.isFinite(Number(slide.focus_x)) ? Number(slide.focus_x) : 50,
                focus_y: Number.isFinite(Number(slide.focus_y)) ? Number(slide.focus_y) : 50,
                overlay_strength: Number.isFinite(Number(slide.overlay_strength)) ? Number(slide.overlay_strength) : 78,
                order: Number.isFinite(Number(slide.order)) ? Number(slide.order) : index + 1
              };
            })
            .filter((slide) =>
              slide &&
              (
                slide.image ||
                slide.title ||
                slide.subtitle ||
                slide.body ||
                slide.eyebrow ||
                slide.cta_label
              )
            )
            .filter(Boolean)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
        : [];

      return reply.send({
        ok: true,
        item: {
          id: row.id,
          code: row.code,
          slot,
          title: normalizeText(attrs.title || row.title || ""),
          status: row.status,
          is_active: isActive,
          translation:
            attrs.translation && typeof attrs.translation === "object"
              ? attrs.translation
              : null,
          slides,
          updated_at: row.updated_at
        }
      });
    }
  );

  app.get(
    "/commerce/:suffix/content/list",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const slot = normalizeText(req.query?.slot || "").toLowerCase();
      const page = normalizeText(req.query?.page || "").toLowerCase();
      const contentModel = normalizeText(req.query?.content_model || "").toLowerCase();
      const activeOnly = String(req.query?.active_only || "true").toLowerCase() !== "false";
      const publishedOnly = String(req.query?.published_only || "true").toLowerCase() !== "false";
      const limit = Math.max(1, Math.min(100, Number(req.query?.limit || 20)));
      const offset = Math.max(0, Number(req.query?.offset || 0));

      const params = [access.tenant.id];
      const filters = ["tenant_id = $1", "object_type = 'storefront_content'"];
      if (slot) {
        params.push(slot);
        filters.push(`lower(COALESCE(attrs->>'slot', '')) = $${params.length}`);
      }
      if (page) {
        params.push(page);
        filters.push(`lower(COALESCE(attrs->>'page', split_part(COALESCE(attrs->>'slot',''), '.', 1))) = $${params.length}`);
      }
      if (contentModel) {
        params.push(contentModel);
        filters.push(`lower(COALESCE(attrs->>'content_model', 'singleton')) = $${params.length}`);
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT id, code, title, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE ${filters.join(" AND ")}
        ORDER BY updated_at DESC, created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      const items = (r.rows || [])
        .map((row) => {
          const attrs = row.attrs && typeof row.attrs === "object" ? row.attrs : {};
          const isActive = isStorefrontContentActive(attrs);
          if (activeOnly && !isActive) return null;
          const isPublished = isStorefrontContentPublished(row, attrs);
          if (publishedOnly && !isPublished) return null;

          const articleRaw = normalizeStorefrontArticlePublic(attrs.article || attrs.entry || {});
          const rawImage = articleRaw?.image ? signAssetUrl(articleRaw.image, app, access.tenant.id) : "";
          const categoryCode = String(
            attrs.content_category_code || attrs?.content_category?.code || ""
          )
            .trim()
            .toUpperCase();
          const categoryLabel = String(
            attrs.content_category_label || attrs?.content_category?.label || ""
          ).trim();
          return {
            id: row.id,
            code: row.code,
            title: normalizeOptionalText(attrs.title) || row.title || null,
            slot: normalizeText(attrs.slot || "").toLowerCase(),
            page: normalizeText(attrs.page || "").toLowerCase(),
            status: row.status,
            content_model: normalizeText(attrs.content_model || "singleton").toLowerCase(),
            category_code: categoryCode || null,
            category_label: categoryLabel || null,
            translation:
              attrs.translation && typeof attrs.translation === "object"
                ? attrs.translation
                : null,
            article: articleRaw
              ? {
                  ...articleRaw,
                  image: rawImage || ""
                }
              : null,
            attrs,
            created_at: row.created_at,
            updated_at: row.updated_at
          };
        })
        .filter(Boolean);

      return reply.send({
        ok: true,
        items,
        limit,
        offset
      });
    }
  );

  app.post(
    "/commerce/:suffix/member/auth/logout",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const member = await requireMemberSession(access, req, reply);
      if (!member) return;

      const csrfCookie = normalizeText(req.cookies?.member_csrf);
      const csrfHeader = normalizeText(req.headers["x-member-csrf"]);
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return reply.code(403).send({ ok: false, error: "CSRF_MISSING" });
      }

      const expectedHash = sha256Hex(`${csrfCookie}:${app.config.CSRF_PEPPER}`);
      if (!member.session.csrf_secret_hash || !timingSafeEqual(expectedHash, member.session.csrf_secret_hash)) {
        return reply.code(403).send({ ok: false, error: "CSRF_INVALID" });
      }

      await app.db.query(
        `
        UPDATE eip_auth.auth_session
        SET is_revoked = true,
            revoked_at = now()
        WHERE id = $1::uuid
        `,
        [member.session.id]
      );

      clearMemberCookies(reply);
      return reply.send({ ok: true });
    }
  );

  app.get(
    "/commerce/:suffix/member/history",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const member = await requireMemberSession(access, req, reply);
      if (!member) return;

      const limit = Math.min(Math.max(Number(req.query?.limit) || 20, 1), 100);
      const r = await app.db.query(
        `
        SELECT id, code, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = 'sales_order'
          AND (
            lower(COALESCE(attrs->'buyer'->>'email', '')) = lower($2)
            OR COALESCE(attrs->>'member_identity_id', '') = $3
          )
        ORDER BY created_at DESC
        LIMIT $4
        `,
        [access.tenant.id, member.profile.login, member.profile.identity_id, limit]
      );

      const items = (r.rows || []).map((row) => {
        const attrs = row.attrs && typeof row.attrs === "object" ? row.attrs : {};
        const pricing = attrs.pricing_snapshot && typeof attrs.pricing_snapshot === "object"
          ? attrs.pricing_snapshot
          : {};
        return {
          id: row.id,
          code: row.code,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
          currency: pricing.currency || attrs.currency || null,
          total: Number.isFinite(Number(pricing.grand_total)) ? Number(pricing.grand_total) : null,
          line_count: Array.isArray(attrs.line_items) ? attrs.line_items.length : 0
        };
      });

      return reply.send({ ok: true, items });
    }
  );

  app.post(
    "/commerce/:suffix/member/uploads",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const member = await requireMemberSession(access, req, reply);
      if (!member) return;
      if (!requireMemberCsrf(member, req, reply)) return;

      if (!req.isMultipart()) {
        return reply.code(415).send({ ok: false, error: "MULTIPART_REQUIRED" });
      }

      const bodyFile = req.body?.file;
      let filePart = bodyFile;
      if (!filePart?.file && typeof filePart?.toBuffer !== "function") {
        filePart = await req.file();
      }
      if (!filePart || (!filePart.file && typeof filePart.toBuffer !== "function")) {
        return reply.code(400).send({ ok: false, error: "FILE_REQUIRED" });
      }

      const filename = normalizeText(filePart.filename || "");
      const mimetype = normalizeText(filePart.mimetype || "").toLowerCase();
      const buffer = await uploadPartToBuffer(filePart);
      const validation = validateImageUpload({ buffer, filename, mimetype });
      if (!validation.ok) return reply.code(415).send({ ok: false, error: validation.error });

      const uploadDir = path.join(ASSET_ROOT, access.tenant.id, "blog");
      fs.mkdirSync(uploadDir, { recursive: true });

      const storedName = `${crypto.randomUUID()}${validation.safeExt}`;
      const targetPath = safeUploadTarget(uploadDir, storedName);

      try {
        fs.writeFileSync(targetPath, buffer);
      } catch (error) {
        app.log.error({ event: "member_blog_upload_failed", tenantId: access.tenant.id, error: error.message });
        return reply.code(500).send({ ok: false, error: "UPLOAD_FAILED" });
      }

      const rawUrl = `/assets/${access.tenant.id}/blog/${storedName}`;
      const signedUrl = signAssetUrl(rawUrl, app, access.tenant.id);
      return reply.send({
        ok: true,
        asset: {
          name: filename || storedName,
          type: mimetype,
          kind: "media",
          raw_url: rawUrl,
          url: signedUrl || rawUrl
        }
      });
    }
  );

  app.get(
    "/commerce/:suffix/blog/posts",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const limit = Math.min(Math.max(Number(req.query?.limit) || 20, 1), 100);
      const offset = Math.max(Number(req.query?.offset) || 0, 0);
      const q = normalizeText(req.query?.q || "");

      const params = [access.tenant.id, BLOG_POST_OBJECT_TYPE, Array.from(BLOG_VISIBLE_STATUSES)];
      let filterSql = `
        tenant_id = $1
        AND object_type = $2
        AND status = ANY($3::text[])
      `;

      if (q) {
        params.push(`%${q}%`);
        filterSql += `
          AND (
            COALESCE(title, '') ILIKE $${params.length}
            OR COALESCE(attrs->>'title', '') ILIKE $${params.length}
            OR COALESCE(attrs->>'body', '') ILIKE $${params.length}
          )
        `;
      }

      const totalRes = await app.db.query(
        `
        SELECT COUNT(*)::int AS total
        FROM eip_core.service_object
        WHERE ${filterSql}
        `,
        params
      );

      params.push(limit);
      params.push(offset);
      const rows = await app.db.query(
        `
        SELECT id, code, title, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE ${filterSql}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      return reply.send({
        ok: true,
        items: (rows.rows || []).map((row) => toPublicBlogPost(row, app, access.tenant.id)),
        total: Number(totalRes.rows?.[0]?.total || 0),
        limit,
        offset
      });
    }
  );

  app.post(
    "/commerce/:suffix/blog/posts",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const member = await requireMemberSession(access, req, reply);
      if (!member) return;

      const csrfCookie = normalizeText(req.cookies?.member_csrf);
      const csrfHeader = normalizeText(req.headers["x-member-csrf"]);
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return reply.code(403).send({ ok: false, error: "CSRF_MISSING" });
      }
      const expectedHash = sha256Hex(`${csrfCookie}:${app.config.CSRF_PEPPER}`);
      if (!member.session.csrf_secret_hash || !timingSafeEqual(expectedHash, member.session.csrf_secret_hash)) {
        return reply.code(403).send({ ok: false, error: "CSRF_INVALID" });
      }

      let body;
      try {
        body = parseJsonBody(req);
      } catch {
        return reply.code(400).send({ ok: false, error: "INVALID_JSON" });
      }

      const title = normalizeBlogText(body.title, 160);
      const postBody = normalizeBlogText(body.body || body.content, 6000);
      const imageUrl = normalizeOptionalText(body.image_url || body.image || "");
      const imageUrls = normalizeBlogImageUrls(body.image_urls || body.images || []);
      if (imageUrl && !imageUrls.includes(imageUrl)) {
        imageUrls.unshift(imageUrl);
      }
      const tags = normalizeBlogTags(body.tags || []);
      if (!title) return reply.code(400).send({ ok: false, error: "TITLE_REQUIRED" });
      if (!postBody) return reply.code(400).send({ ok: false, error: "BODY_REQUIRED" });

      for (const candidateUrl of imageUrls) {
        const localPath = toLocalAssetPath(candidateUrl);
        if (localPath && !isTenantAssetPath(localPath, access.tenant.id)) {
          return reply.code(400).send({ ok: false, error: "ASSET_TENANT_MISMATCH" });
        }
      }

      const authorName =
        normalizeBlogText(member.profile.display_name || "", 120) ||
        normalizeBlogText(member.profile.username || "", 120) ||
        normalizeBlogText(member.profile.login || "", 120) ||
        "Member";

      const client = await app.db.connect();
      let createdRow = null;
      let createdInstanceId = null;
      try {
        await client.query("BEGIN");

        let attempt = 0;
        while (!createdRow && attempt < 4) {
          const code = buildCode("BLG");
          try {
            const processStart = await startProcessFor(client, app, {
              tenantId: access.tenant.id,
              identityId: member.profile.identity_id,
              objectType: BLOG_POST_OBJECT_TYPE,
              requireBinding: true,
              serviceObject: {
                object_type: BLOG_POST_OBJECT_TYPE,
                status: "new",
                code,
                title,
                attrs: {
                  title,
                  body: postBody,
                  image_url: imageUrls[0] || null,
                  image_urls: imageUrls,
                  tags,
                  author: {
                    identity_id: member.profile.identity_id,
                    name: authorName,
                    role: "Member"
                  },
                  reactions: {
                    likes: 0,
                    dislikes: 0,
                    comments: 0
                  },
                  workflow: {
                    stage: "draft",
                    outcome: null
                  },
                  created_by_identity_id: member.profile.identity_id
                }
              }
            });
            if (!processStart.ok) {
              await client.query("ROLLBACK");
              if (processStart.error === "PROCESS_BINDING_REQUIRED") {
                return reply.code(409).send({ ok: false, error: processStart.error });
              }
              return reply.code(500).send({ ok: false, error: "BLOG_POST_CREATE_FAILED" });
            }
            createdRow = processStart.service_object || null;
            createdInstanceId = processStart.instance?.id || null;
          } catch (err) {
            const duplicateCode = String(err?.constraint || "").includes("service_object_code_unique_per_tenant");
            if (!duplicateCode) throw err;
            attempt += 1;
          }
        }

        if (!createdRow || !createdInstanceId) {
          throw new Error("BLOG_POST_CREATE_FAILED");
        }

        const basePayload = {
          service_object_id: createdRow.id,
          post_code: createdRow.code,
          channel: "website"
        };

        const intake = await app.coreProcess.advanceInstance(client, {
          tenantId: access.tenant.id,
          identityId: member.profile.identity_id,
          instanceId: createdInstanceId,
          action: "INTAKE",
          payload: basePayload,
          idempotencyKey: sha256Hex(`blog:create:intake:${createdRow.id}`)
        });
        if (!intake.ok && intake.error !== "INVALID_TRANSITION") {
          throw new Error(intake.error || "BLOG_POST_CREATE_FAILED");
        }

        const publish = await app.coreProcess.advanceInstance(client, {
          tenantId: access.tenant.id,
          identityId: member.profile.identity_id,
          instanceId: createdInstanceId,
          action: "PUBLISH",
          payload: basePayload,
          idempotencyKey: sha256Hex(`blog:create:publish:${createdRow.id}`)
        });
        if (!publish.ok && publish.error !== "INVALID_TRANSITION") {
          throw new Error(publish.error || "BLOG_POST_CREATE_FAILED");
        }

        const persisted = await client.query(
          `
          SELECT id, code, title, status, attrs, created_at, updated_at
          FROM eip_core.service_object
          WHERE tenant_id = $1
            AND id = $2
            AND object_type = $3
          LIMIT 1
          `,
          [access.tenant.id, createdRow.id, BLOG_POST_OBJECT_TYPE]
        );
        if (!persisted.rowCount) throw new Error("BLOG_POST_CREATE_FAILED");

        await client.query("COMMIT");
        return reply.send({
          ok: true,
          item: toPublicBlogPost(persisted.rows[0], app, access.tenant.id)
        });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({
          event: "member_blog_create_failed",
          tenant_id: access.tenant.id,
          identity_id: member.profile.identity_id,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "BLOG_POST_CREATE_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.delete(
    "/commerce/:suffix/blog/posts/:postId",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const member = await requireMemberSession(access, req, reply);
      if (!member) return;
      if (!requireMemberCsrf(member, req, reply)) return;

      const postId = normalizeText(req.params?.postId || "");
      if (!postId) return reply.code(400).send({ ok: false, error: "POST_ID_REQUIRED" });

      const current = await app.db.query(
        `
        SELECT id, code, status, attrs
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = $2
          AND (id::text = $3 OR code = $3)
        LIMIT 1
        `,
        [access.tenant.id, BLOG_POST_OBJECT_TYPE, postId]
      );
      if (!current.rowCount) {
        return reply.code(404).send({ ok: false, error: "BLOG_POST_NOT_FOUND" });
      }

      const attrs = current.rows[0]?.attrs && typeof current.rows[0].attrs === "object" ? current.rows[0].attrs : {};
      const ownerIdentityId = normalizeText(
        attrs.created_by_identity_id ||
          attrs.author?.identity_id ||
          ""
      );
      if (!ownerIdentityId || ownerIdentityId !== String(member.profile.identity_id)) {
        return reply.code(403).send({ ok: false, error: "BLOG_POST_FORBIDDEN" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const ensured = await ensureProcessInstanceForObject(client, app, {
          tenantId: access.tenant.id,
          identityId: member.profile.identity_id,
          objectType: BLOG_POST_OBJECT_TYPE,
          serviceObjectId: current.rows[0].id,
          requireBinding: true
        });
        if (!ensured.ok || !ensured.instance?.id) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: ensured.error || "PROCESS_INSTANCE_REQUIRED" });
        }

        const payload = {
          service_object_id: current.rows[0].id,
          post_code: current.rows[0].code,
          actor_identity_id: member.profile.identity_id
        };

        const runCancel = async () =>
          app.coreProcess.advanceInstance(client, {
            tenantId: access.tenant.id,
            identityId: member.profile.identity_id,
            instanceId: ensured.instance.id,
            action: "CANCEL",
            payload,
            idempotencyKey: sha256Hex(`blog:cancel:${current.rows[0].id}:${member.profile.identity_id}`)
          });

        let transition = await runCancel();
        if (!transition.ok && transition.error === "INVALID_TRANSITION") {
          const intake = await app.coreProcess.advanceInstance(client, {
            tenantId: access.tenant.id,
            identityId: member.profile.identity_id,
            instanceId: ensured.instance.id,
            action: "INTAKE",
            payload,
            idempotencyKey: sha256Hex(`blog:intake:${current.rows[0].id}:${member.profile.identity_id}`)
          });
          if (!intake.ok && intake.error !== "INVALID_TRANSITION") {
            await client.query("ROLLBACK");
            return reply.code(409).send({ ok: false, error: intake.error || "INVALID_TRANSITION" });
          }
          transition = await runCancel();
        }
        if (
          !transition.ok &&
          !(
            transition.error === "INVALID_TRANSITION" &&
            ["cancelled", "rejected", "deleted"].includes(normalizeText(current.rows[0].status).toLowerCase())
          )
        ) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: transition.error || "INVALID_TRANSITION" });
        }

        const updated = await client.query(
          `
          SELECT id, code, title, status, attrs, created_at, updated_at
          FROM eip_core.service_object
          WHERE tenant_id = $1
            AND id = $2
            AND object_type = $3
          LIMIT 1
          `,
          [access.tenant.id, current.rows[0].id, BLOG_POST_OBJECT_TYPE]
        );
        if (!updated.rowCount) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "BLOG_POST_NOT_FOUND" });
        }

        await client.query("COMMIT");
        return reply.send({
          ok: true,
          item: toPublicBlogPost(updated.rows[0], app, access.tenant.id)
        });
      } catch (error) {
        await client.query("ROLLBACK");
        app.log.error({
          event: "member_blog_delete_failed",
          tenant_id: access.tenant.id,
          identity_id: member.profile.identity_id,
          post_id: current.rows[0].id,
          error: error?.message || String(error)
        });
        return reply.code(500).send({ ok: false, error: "BLOG_POST_DELETE_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/commerce/:suffix/catalog",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const materialType = normalizeText(req.query?.material_type || "").toUpperCase();
      const q = normalizeText(req.query?.q || "");
      const limit = Math.min(Number(req.query?.limit) || 50, 200);
      const offset = Math.max(Number(req.query?.offset) || 0, 0);

      const params = [access.tenant.id];
      let where = `WHERE tenant_id = $1 AND ${publishedMaterialPredicate()}`;
      if (materialType) {
        params.push(materialType);
        where += ` AND UPPER(material_type) = $${params.length}`;
      }
      if (q) {
        params.push(`%${q}%`);
        where += ` AND (code ILIKE $${params.length} OR name ILIKE $${params.length})`;
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT id, code, name, material_type, attrs
        FROM eip_core.material
        ${where}
        ORDER BY name ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      const items = (r.rows || []).map((row) => ({
        ...row,
        attrs: signMediaAttrs(row.attrs, app, access.tenant.id)
      }));
      return reply.send({ ok: true, items });
    }
  );

  app.post(
    "/commerce/:suffix/subscribe",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom"]);
      if (!access) return;

      let body;
      try {
        body = parseJsonBody(req);
      } catch {
        return reply.code(400).send({ ok: false, error: "INVALID_JSON" });
      }
      const subscriber = body.subscriber && typeof body.subscriber === "object" ? body.subscriber : body;

      const email = normalizeEmail(subscriber.email || body.email);
      const name = normalizeOptionalText(subscriber.name || subscriber.full_name || body.name);
      const phone = normalizeOptionalText(subscriber.phone || body.phone);
      const locale = normalizeOptionalText(subscriber.locale || body.locale);
      const source = resolveClientSource(access, subscriber.source || body.source);
      const metadata = subscriber.metadata && typeof subscriber.metadata === "object" ? subscriber.metadata : {};

      if (!email && !name && !phone) {
        return reply.code(400).send({ ok: false, error: "SUBSCRIBER_REQUIRED" });
      }

      const eventId = extractEventId(req, body, access.profile);
      if (!eventId) return reply.code(400).send({ ok: false, error: "IDEMPOTENCY_REQUIRED" });

      const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody || "");
      const requestHash = buildRequestHash(rawBody);
      const scope = access.profile.idempotency?.idempotency_scope || `commerce.subscribe.${access.profile.identity?.connection_code}`;

      const idem = await ensureIdempotency(app.db, {
        tenantId: access.tenant.id,
        scope,
        key: eventId,
        requestHash
      });
      if (!idem.ok) return reply.code(409).send({ ok: false, error: idem.error });
      if (idem.replay) {
        const replayResponse = idem.response || {};
        const replayCode =
          normalizeText(replayResponse?.order?.code) ||
          normalizeText(replayResponse?.order_code) ||
          normalizeText(replayResponse?.orderCode) ||
          normalizeText(replayResponse?.code);

        if (replayCode) return reply.send(replayResponse);

        const externalRef = normalizeText(body.external_ref || "");
        if (externalRef) {
          const existingOrder = await app.db.query(
            `
            SELECT id, code, status, created_at
            FROM eip_core.service_object
            WHERE tenant_id = $1
              AND object_type = 'sales_order'
              AND attrs->>'external_ref' = $2
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [access.tenant.id, externalRef]
          );
          if (existingOrder.rowCount > 0) {
            return reply.send({
              ok: true,
              replay: true,
              order: existingOrder.rows[0]
            });
          }
        }

        return reply.send(replayResponse || { ok: true, replay: true });
      }

      const client = await app.db.connect();
      let agentRow;
      let created = false;

      try {
        await client.query("BEGIN");

        if (email) {
          agentRow = await resolveAgentByContact(client, access.tenant.id, "email", email);
        }
        if (!agentRow && phone) {
          agentRow = await resolveAgentByContact(client, access.tenant.id, "phone", phone);
        }

        if (!agentRow) {
          let attempt = 0;
          let code = buildCode("SUB");
          while (attempt < 3) {
            try {
              const insert = await client.query(
                `
                INSERT INTO eip_core.agent
                  (tenant_id, agent_type, code, name, attrs, is_active)
                VALUES
                  ($1,'person',$2,$3,$4::jsonb,true)
                RETURNING id, code, name, attrs
                `,
                [
                  access.tenant.id,
                  code,
                  name || email || phone,
                  JSON.stringify({
                    email: email || null,
                    phone: phone || null,
                    locale: locale || null,
                    source,
                    metadata,
                    tags: ["subscriber"]
                  })
                ]
              );
              agentRow = insert.rows[0];
              created = true;
              break;
            } catch (err) {
              if (String(err.message || "").includes("agent_code_unique_per_tenant")) {
                code = buildCode("SUB");
                attempt += 1;
                continue;
              }
              throw err;
            }
          }
        }

        if (!agentRow) throw new Error("SUBSCRIBER_CREATE_FAILED");

        await ensureEntityContact(client, access.tenant.id, agentRow.id, "email", email);
        await ensureEntityContact(client, access.tenant.id, agentRow.id, "phone", phone);

        await client.query(
          `
          INSERT INTO eip_core.info_record
            (tenant_id, record_type, title, payload, attrs)
          VALUES
            ($1,$2,$3,$4::jsonb,$5::jsonb)
          `,
          [
            access.tenant.id,
            "SUBSCRIBER",
            `subscriber.${agentRow.code || agentRow.id}`,
            JSON.stringify({
              agent_id: agentRow.id,
              email,
              phone,
              name,
              source
            }),
            JSON.stringify({
              channel: source,
              locale: locale || null
            })
          ]
        );

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        await finalizeIdempotency(app.db, {
          tenantId: access.tenant.id,
          scope,
          key: eventId,
          response: { ok: false, error: err.message },
          status: "error"
        });
        client.release();
        return reply.code(500).send({ ok: false, error: "SUBSCRIBER_CREATE_FAILED" });
      }

      client.release();

      const response = {
        ok: true,
        created,
        subscriber: {
          agent_id: agentRow.id,
          code: agentRow.code,
          name: agentRow.name || name || email || phone,
          email,
          phone
        }
      };

      await finalizeIdempotency(app.db, {
        tenantId: access.tenant.id,
        scope,
        key: eventId,
        response
      });

      return reply.send(response);
    }
  );

  app.get(
    "/commerce/:suffix/product/:code",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const code = normalizeText(req.params.code);
      if (!code) return reply.code(400).send({ ok: false, error: "MATERIAL_CODE_REQUIRED" });

      const r = await app.db.query(
        `
        SELECT id, code, name, material_type, attrs
        FROM eip_core.material
        WHERE tenant_id = $1
          AND ${publishedMaterialPredicate()}
          AND code = $2
        LIMIT 1
        `,
        [access.tenant.id, code]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "MATERIAL_NOT_FOUND" });

      const reviewSummary = await loadProductReviewSummary(app.db, access.tenant.id, code);
      const item = r.rows[0]
        ? {
            ...r.rows[0],
            attrs: signMediaAttrs(r.rows[0].attrs, app, access.tenant.id),
            review_summary: reviewSummary
          }
        : null;
      return reply.send({ ok: true, item });
    }
  );

  app.get(
    "/commerce/:suffix/product/:code/reviews",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const code = normalizeText(req.params.code);
      if (!code) return reply.code(400).send({ ok: false, error: "MATERIAL_CODE_REQUIRED" });

      const limit = Math.min(Math.max(Number(req.query?.limit) || 20, 1), 100);
      const offset = Math.max(Number(req.query?.offset) || 0, 0);

      const productRes = await app.db.query(
        `
        SELECT id, code
        FROM eip_core.material
        WHERE tenant_id = $1
          AND ${publishedMaterialPredicate()}
          AND code = $2
        LIMIT 1
        `,
        [access.tenant.id, code]
      );
      if (productRes.rowCount === 0) {
        return reply.code(404).send({ ok: false, error: "MATERIAL_NOT_FOUND" });
      }

      const reviewRes = await app.db.query(
        `
        SELECT id, code, status, attrs, created_at
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = $2
          AND status = ANY($3::text[])
          AND attrs->>'material_code' = $4
        ORDER BY created_at DESC
        LIMIT $5 OFFSET $6
        `,
        [access.tenant.id, PRODUCT_REVIEW_OBJECT_TYPE, Array.from(REVIEW_VISIBLE_STATUSES), code, limit, offset]
      );

      const summary = await loadProductReviewSummary(app.db, access.tenant.id, code);
      return reply.send({
        ok: true,
        product_code: code,
        summary,
        items: (reviewRes.rows || []).map(toPublicReview),
        limit,
        offset
      });
    }
  );

  app.post(
    "/commerce/:suffix/reviews",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      let body;
      try {
        body = parseJsonBody(req);
      } catch {
        return reply.code(400).send({ ok: false, error: "INVALID_JSON" });
      }

      const productCode = normalizeText(body.material_code || body.product_code || body.code);
      const productId = normalizeText(body.material_id || body.product_id);
      const rating = Number(body.rating);
      const title = normalizeReviewText(body.title, 180);
      const comment = normalizeReviewText(body.comment, 4000);
      const reviewer = body.reviewer && typeof body.reviewer === "object" ? body.reviewer : {};
      const reviewerName = normalizeReviewText(reviewer.name || body.name, 120) || "Anonymous";
      const reviewerEmail = normalizeEmail(reviewer.email || body.email);

      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return reply.code(400).send({ ok: false, error: "RATING_REQUIRED" });
      }
      if (!productCode && !productId) {
        return reply.code(400).send({ ok: false, error: "MATERIAL_REQUIRED" });
      }
      if (!comment) {
        return reply.code(400).send({ ok: false, error: "COMMENT_REQUIRED" });
      }

      const materialRes = await app.db.query(
        `
        SELECT id, code, name
        FROM eip_core.material
        WHERE tenant_id = $1
          AND ${publishedMaterialPredicate()}
          AND (
            ($2::text <> '' AND code = $2::text)
            OR ($3::text <> '' AND id::text = $3::text)
          )
        LIMIT 1
        `,
        [access.tenant.id, productCode, productId]
      );
      if (materialRes.rowCount === 0) {
        return reply.code(404).send({ ok: false, error: "MATERIAL_NOT_FOUND" });
      }
      const material = materialRes.rows[0];

      const flaggedTerms = detectFlaggedTerms(`${title} ${comment}`);
      const targetStatus = flaggedTerms.length ? REVIEW_FLAGGED_STATUS : "approved";
      const reviewCode = buildCode("REV");

      const attrs = {
        material_id: material.id,
        material_code: material.code,
        material_name: material.name || "",
        rating: Math.round(rating * 10) / 10,
        title,
        comment,
        reviewer: {
          name: reviewerName,
          email: reviewerEmail || null,
          verified_purchase: reviewer.verified_purchase === true
        },
        moderation: {
          state: REVIEW_FLAGGED_STATUS,
          auto_flagged: flaggedTerms.length > 0,
          flagged_terms: flaggedTerms,
          note: flaggedTerms.length ? "Auto-flagged by keyword filter." : null
        },
        source: resolveClientSource(access, body.source)
      };

      const client = await app.db.connect();
      let row = null;
      try {
        await client.query("BEGIN");
        const start = await startProcessFor(client, app, {
          tenantId: access.tenant.id,
          identityId: null,
          objectType: PRODUCT_REVIEW_OBJECT_TYPE,
          serviceObject: {
            object_type: PRODUCT_REVIEW_OBJECT_TYPE,
            status: "new",
            code: reviewCode,
            title: title || `Review for ${material.code}`,
            attrs
          },
          requireBinding: true
        });
        if (!start.ok) {
          await client.query("ROLLBACK");
          client.release();
          return reply.code(409).send({ ok: false, error: start.error || "PROCESS_BINDING_REQUIRED" });
        }
        const serviceObjectId = start.service_object?.id || start.instance?.service_object_id || null;
        const instanceId = start.instance?.id || null;
        if (!serviceObjectId || !instanceId) {
          await client.query("ROLLBACK");
          client.release();
          return reply.code(409).send({ ok: false, error: "PROCESS_INSTANCE_REQUIRED" });
        }

        const submit = await app.coreProcess.advanceInstance(client, {
          tenantId: access.tenant.id,
          identityId: null,
          instanceId,
          action: "REVIEW_SUBMIT",
          payload: {
            material_id: material.id,
            material_code: material.code,
            rating: Math.round(rating * 10) / 10
          },
          idempotencyKey: sha256Hex(`review:submit:${serviceObjectId}`)
        });
        if (!submit.ok && submit.error !== "INVALID_TRANSITION") {
          await client.query("ROLLBACK");
          client.release();
          return reply.code(409).send({ ok: false, error: submit.error });
        }

        if (targetStatus === "approved") {
          const approve = await app.coreProcess.advanceInstance(client, {
            tenantId: access.tenant.id,
            identityId: null,
            instanceId,
            action: "APPROVE",
            payload: {
              material_id: material.id,
              material_code: material.code
            },
            idempotencyKey: sha256Hex(`review:approve:${serviceObjectId}`)
          });
          if (!approve.ok && approve.error !== "INVALID_TRANSITION") {
            await client.query("ROLLBACK");
            client.release();
            return reply.code(409).send({ ok: false, error: approve.error });
          }
        }

        const persisted = await client.query(
          `
          SELECT id, code, status, attrs, created_at
          FROM eip_core.service_object
          WHERE tenant_id=$1 AND id=$2 AND object_type=$3
          LIMIT 1
          `,
          [access.tenant.id, serviceObjectId, PRODUCT_REVIEW_OBJECT_TYPE]
        );
        row = persisted.rows[0];
        if (!row) {
          await client.query("ROLLBACK");
          client.release();
          return reply.code(500).send({ ok: false, error: "REVIEW_CREATE_FAILED" });
        }

        const nextAttrs = row.attrs && typeof row.attrs === "object" ? { ...row.attrs } : {};
        const moderation = nextAttrs.moderation && typeof nextAttrs.moderation === "object"
          ? { ...nextAttrs.moderation }
          : {};
        moderation.state = targetStatus;
        moderation.auto_flagged = flaggedTerms.length > 0;
        moderation.flagged_terms = flaggedTerms;
        moderation.note = flaggedTerms.length ? "Auto-flagged by keyword filter." : null;
        nextAttrs.moderation = moderation;

        const rowUpdate = await client.query(
          `
          UPDATE eip_core.service_object
          SET attrs = $3::jsonb,
              updated_at = now()
          WHERE tenant_id=$1 AND id=$2 AND object_type=$4
          RETURNING id, code, status, attrs, created_at
          `,
          [
            access.tenant.id,
            serviceObjectId,
            JSON.stringify(nextAttrs),
            PRODUCT_REVIEW_OBJECT_TYPE
          ]
        );
        row = rowUpdate.rows[0] || row;

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        client.release();
        app.log.error({ event: "product_review_create_failed", error: err.message });
        return reply.code(500).send({ ok: false, error: "REVIEW_CREATE_FAILED" });
      }
      client.release();

      return reply.send({
        ok: true,
        item: toPublicReview(row),
        moderation: {
          status: row.status,
          flagged_terms: flaggedTerms
        }
      });
    }
  );

  app.post(
    "/commerce/:suffix/quote",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      let body;
      try {
        body = parseJsonBody(req);
      } catch {
        return reply.code(400).send({ ok: false, error: "INVALID_JSON" });
      }

      const currency = normalizeText(body.currency || "USD");
      const jurisdiction = normalizeText(body.jurisdiction_code || body.jurisdiction || "");
      const channel = normalizeText(body.channel || "ECOM");
      const lineItems = Array.isArray(body.line_items) ? body.line_items : [];
      if (!lineItems.length) {
        return reply.code(400).send({ ok: false, error: "LINE_ITEMS_REQUIRED" });
      }

      const normalizedLines = lineItems.map((line) => ({
        material_id: normalizeText(line.material_id),
        material_code: normalizeText(line.material_code || line.code),
        quantity: Math.max(normalizeNumber(line.quantity, 1), 1)
      }));

      const materials = await resolveMaterialMap(app, access.tenant.id, normalizedLines);
      const preparedLines = [];
      for (const line of normalizedLines) {
        const material = line.material_id
          ? materials.get(line.material_id)
          : materials.get(line.material_code);
        if (!material) {
          return reply.code(404).send({ ok: false, error: "MATERIAL_NOT_FOUND", material: line.material_code || line.material_id });
        }
        preparedLines.push({ ...line, material });
      }

      const quote = await buildQuote(
        app,
        access.tenant.id,
        {
          currency,
          line_items: preparedLines
        },
        { channel, jurisdiction }
      );
      if (!quote.ok) return reply.code(400).send(quote);

      return reply.send({ ok: true, quote });
    }
  );

  app.post(
    "/commerce/:suffix/order",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom"]);
      if (!access) return;

      let body;
      try {
        body = parseJsonBody(req);
      } catch {
        return reply.code(400).send({ ok: false, error: "INVALID_JSON" });
      }

      const currency = normalizeText(body.currency || "USD");
      const jurisdiction = normalizeText(body.jurisdiction_code || body.jurisdiction || "");
      const channel = normalizeText(body.channel || "ECOM");
      const lineItems = Array.isArray(body.line_items) ? body.line_items : [];
      if (!lineItems.length) {
        return reply.code(400).send({ ok: false, error: "LINE_ITEMS_REQUIRED" });
      }

      const eventId = extractEventId(req, body, access.profile);
      if (!eventId) return reply.code(400).send({ ok: false, error: "IDEMPOTENCY_REQUIRED" });

      const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody || "");
      const requestHash = buildRequestHash(rawBody);
      const scope = access.profile.idempotency?.idempotency_scope || `commerce.order.${access.profile.identity?.connection_code}`;

      const idem = await ensureIdempotency(app.db, {
        tenantId: access.tenant.id,
        scope,
        key: eventId,
        requestHash
      });
      if (!idem.ok) return reply.code(409).send({ ok: false, error: idem.error });
      if (idem.replay) {
        const replayResponse = idem.response || {};
        const replayCode =
          normalizeText(replayResponse?.order?.code) ||
          normalizeText(replayResponse?.order_code) ||
          normalizeText(replayResponse?.orderCode);

        if (replayCode) return reply.send(replayResponse);

        let recoveredOrder = null;
        const replayOrderId =
          normalizeText(replayResponse?.order?.id) ||
          normalizeText(replayResponse?.order_id);

        if (replayOrderId) {
          const byId = await app.db.query(
            `
            SELECT id, code, status, created_at
            FROM eip_core.service_object
            WHERE tenant_id = $1
              AND id = $2
              AND object_type = 'sales_order'
            LIMIT 1
            `,
            [access.tenant.id, replayOrderId]
          );
          if (byId.rowCount) recoveredOrder = byId.rows[0];
        }

        if (!recoveredOrder) {
          const externalRef =
            normalizeText(body.external_ref) ||
            normalizeText(replayResponse?.external_ref);
          if (externalRef) {
            const byRef = await app.db.query(
              `
              SELECT id, code, status, created_at
              FROM eip_core.service_object
              WHERE tenant_id = $1
                AND object_type = 'sales_order'
                AND attrs->>'external_ref' = $2
              ORDER BY created_at DESC
              LIMIT 1
              `,
              [access.tenant.id, externalRef]
            );
            if (byRef.rowCount) recoveredOrder = byRef.rows[0];
          }
        }

        if (recoveredOrder?.code) {
          const patchedResponse = {
            ...replayResponse,
            ok: true,
            replay: true,
            order: {
              ...(replayResponse.order || {}),
              id: recoveredOrder.id,
              code: recoveredOrder.code,
              status: recoveredOrder.status,
              created_at: recoveredOrder.created_at
            },
            order_code: recoveredOrder.code,
            orderCode: recoveredOrder.code
          };
          await finalizeIdempotency(app.db, {
            tenantId: access.tenant.id,
            scope,
            key: eventId,
            response: patchedResponse,
            status: "ok"
          });
          return reply.send(patchedResponse);
        }

        return reply.send(replayResponse || { ok: true, replay: true });
      }

      const normalizedLines = lineItems.map((line) => ({
        material_id: normalizeText(line.material_id),
        material_code: normalizeText(line.material_code || line.code),
        quantity: Math.max(normalizeNumber(line.quantity, 1), 1)
      }));

      const materials = await resolveMaterialMap(app, access.tenant.id, normalizedLines);
      const preparedLines = [];
      for (const line of normalizedLines) {
        const material = line.material_id
          ? materials.get(line.material_id)
          : materials.get(line.material_code);
        if (!material) {
          return reply.code(404).send({ ok: false, error: "MATERIAL_NOT_FOUND", material: line.material_code || line.material_id });
        }
        preparedLines.push({ ...line, material });
      }

      const quote = await buildQuote(
        app,
        access.tenant.id,
        { currency, line_items: preparedLines },
        { channel, jurisdiction }
      );
      if (!quote.ok) return reply.code(400).send(quote);

      const memberSession = await loadMemberSession(app, req, access.tenant.id, req.params?.suffix);
      const memberProfile = memberSession
        ? await loadMemberProfile(app.db, access.tenant.id, memberSession.identity_id)
        : null;

      const buyer = body.buyer || {};
      const client = await app.db.connect();
      let orderRow;

      try {
        await client.query("BEGIN");

        let orderCode = body.order_code ? normalizeText(body.order_code) : buildCode("SO");
        let attempt = 0;
        let inventoryMoves = [];

        while (attempt < 3) {
          try {
            const buyerAgentSpec = {
              agent_type: normalizeText(buyer.agent_type || "person"),
              name: normalizeOptionalText(
                buyer.name ||
                buyer.full_name ||
                buyer.email ||
                buyer.phone ||
                memberProfile?.display_name ||
                memberProfile?.login
              ),
              attrs: {
                email: normalizeOptionalText(buyer.email || memberProfile?.login),
                phone: normalizeOptionalText(buyer.phone),
                external_ref: normalizeOptionalText(buyer.external_ref),
                metadata: buyer.metadata || {}
              }
            };

            const hasBuyerAgent =
              buyerAgentSpec.name ||
              buyerAgentSpec.attrs.email ||
              buyerAgentSpec.attrs.phone ||
              buyerAgentSpec.attrs.external_ref;

            const orderAttrs = {
              channel,
              currency,
              jurisdiction,
              buyer,
              line_items: preparedLines.map((line) => ({
                material_id: line.material.id,
                material_code: line.material.code,
                quantity: line.quantity
              })),
              pricing_snapshot: quote,
              member_identity_id: memberProfile?.identity_id || null,
              external_ref: normalizeText(body.external_ref || ""),
              metadata: body.metadata || {}
            };

            const links = quote.lines.map((line) => ({
              src_kind: "service_object",
              src_id: "$service_object_id",
              dst_kind: "material",
              dst_id: line.material_id,
              relation_type: "ORDER_ITEM",
              attrs: {
                quantity: line.quantity,
                unit_price: line.unit_price,
                line_total: line.total,
                currency
              }
            }));

            const requireBinding = access.profile?.routing?.require_process_binding === true;
            const processStart = await startProcessFor(client, app, {
              tenantId: access.tenant.id,
              objectType: "sales_order",
              requireBinding,
              serviceObject: {
                object_type: "sales_order",
                status: "new",
                code: orderCode,
                title: `Order ${orderCode}`,
                attrs: orderAttrs,
                parties: hasBuyerAgent ? [{ role: "CUSTOMER", agent: buyerAgentSpec }] : [],
                links
              }
            });
            if (!processStart.ok) throw new Error(processStart.error);
            orderRow = processStart.service_object;
            break;
          } catch (err) {
            if (String(err.message || "").includes("service_object_code_unique_per_tenant")) {
              orderCode = buildCode("SO");
              attempt += 1;
              continue;
            }
            throw err;
          }
        }

        if (!orderRow) throw new Error("ORDER_CODE_GENERATION_FAILED");
        inventoryMoves = await applyTrackedInventoryConsumption(client, access.tenant.id, preparedLines);

        await client.query(
          `
          INSERT INTO eip_core.info_record
            (tenant_id, record_type, title, payload)
          VALUES
            ($1,$2,$3,$4::jsonb)
          `,
          [
            access.tenant.id,
            "COMMERCE_ORDER",
            `order.${orderRow.code}`,
            JSON.stringify({
              order_id: orderRow.id,
              order_code: orderRow.code,
              quote,
              inventory: {
                moves: inventoryMoves
              }
            })
          ]
        );

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        const message = String(err?.message || "");
        const out =
          message.startsWith("INSUFFICIENT_STOCK:")
            ? {
                ok: false,
                error: "INSUFFICIENT_STOCK",
                material_code: normalizeText(message.split(":")[1])
              }
            : { ok: false, error: "ORDER_CREATE_FAILED" };
        await finalizeIdempotency(app.db, {
          tenantId: access.tenant.id,
          scope,
          key: eventId,
          response: out,
          status: "error"
        });
        client.release();
        return reply.code(out.error === "INSUFFICIENT_STOCK" ? 409 : 500).send(out);
      }

      client.release();

      const response = {
        ok: true,
        order: {
          id: orderRow.id,
          code: orderRow.code,
          status: orderRow.status,
          created_at: orderRow.created_at
        },
        order_code: orderRow.code,
        orderCode: orderRow.code,
        quote
      };

      await finalizeIdempotency(app.db, {
        tenantId: access.tenant.id,
        scope,
        key: eventId,
        response,
        status: "ok"
      });

      return reply.send(response);
    }
  );

  app.get(
    "/commerce/:suffix/order/:code",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom"]);
      if (!access) return;

      const code = normalizeText(req.params.code);
      if (!code) return reply.code(400).send({ ok: false, error: "ORDER_CODE_REQUIRED" });

      const r = await app.db.query(
        `
        SELECT id, code, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = 'sales_order'
          AND code = $2
        LIMIT 1
        `,
        [access.tenant.id, code]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "ORDER_NOT_FOUND" });

      return reply.send({ ok: true, order: r.rows[0] });
    }
  );

  app.post(
    "/commerce/:suffix/payment",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["payments", "custom", "website_intake"]);
      if (!access) return;

      let body;
      try {
        body = parseJsonBody(req);
      } catch {
        return reply.code(400).send({ ok: false, error: "INVALID_JSON" });
      }

      const requestedOrderCode = normalizeText(body.order_code || body.orderCode);
      const requestedOrderId = normalizeText(body.order_id || body.orderId);
      if (!requestedOrderCode && !requestedOrderId) {
        return reply.code(400).send({ ok: false, error: "ORDER_REFERENCE_REQUIRED" });
      }

      const eventId = extractEventId(req, body, access.profile);
      if (!eventId) return reply.code(400).send({ ok: false, error: "IDEMPOTENCY_REQUIRED" });

      const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody || "");
      const requestHash = buildRequestHash(rawBody);
      const scope = access.profile.idempotency?.idempotency_scope || `commerce.payment.${access.profile.identity?.connection_code}`;

      const idem = await ensureIdempotency(app.db, {
        tenantId: access.tenant.id,
        scope,
        key: eventId,
        requestHash
      });
      if (!idem.ok) return reply.code(409).send({ ok: false, error: idem.error });
      if (idem.replay) return reply.send(idem.response || { ok: true, replay: true });

      let orderRes = null;
      if (requestedOrderCode) {
        orderRes = await app.db.query(
          `
          SELECT id, code
          FROM eip_core.service_object
          WHERE tenant_id = $1
            AND object_type = 'sales_order'
            AND code = $2
          LIMIT 1
          `,
          [access.tenant.id, requestedOrderCode]
        );
      }
      if ((!orderRes || orderRes.rowCount === 0) && requestedOrderId) {
        orderRes = await app.db.query(
          `
          SELECT id, code
          FROM eip_core.service_object
          WHERE tenant_id = $1
            AND object_type = 'sales_order'
            AND id::text = $2
          LIMIT 1
          `,
          [access.tenant.id, requestedOrderId]
        );
      }
      if (!orderRes || orderRes.rowCount === 0) {
        return reply.code(404).send({ ok: false, error: "ORDER_NOT_FOUND" });
      }
      const orderId = orderRes.rows[0].id;
      const orderCode = normalizeText(orderRes.rows[0].code || requestedOrderCode);

      const amount = normalizeAmount(body.amount, null);
      if (amount === null) return reply.code(400).send({ ok: false, error: "AMOUNT_REQUIRED" });

      const currency = normalizeText(body.currency || "USD");
      const paymentSettings = await loadCommercePaymentSettings(app, access.tenant.id);
      const enabledMethods = (paymentSettings.methods || [])
        .filter((item) => item && item.enabled !== false)
        .map((item) => normalizePaymentMethodCode(item.code))
        .filter(Boolean);
      const requestedMethod = normalizePaymentMethodCode(body.method || body.payment_method || "");
      const method = requestedMethod || enabledMethods[0] || "";
      if (!method || !enabledMethods.includes(method)) {
        return reply.code(403).send({ ok: false, error: "PAYMENT_METHOD_DISABLED" });
      }
      const provider = paymentSettings.providers?.[method] || {};

      const client = await app.db.connect();
      let paymentRow;
      try {
        await client.query("BEGIN");

        const paymentCode = buildCode("PAY");
        const paymentLinks = [
          {
            src_kind: "service_object",
            src_id: "$service_object_id",
            dst_kind: "service_object",
            dst_id: orderId,
            relation_type: "PAYMENT_FOR",
            attrs: { amount, currency }
          }
        ];

        const requireBinding = access.profile?.routing?.require_process_binding === true;
        const processStart = await startProcessFor(client, app, {
          tenantId: access.tenant.id,
          objectType: "payment",
          requireBinding,
          serviceObject: {
            object_type: "payment",
            status: "new",
            code: paymentCode,
            title: `Payment ${paymentCode}`,
            attrs: {
              order_code: orderCode,
              amount,
              currency,
              method,
              provider_mode: normalizeProviderMode(provider.mode || "manual"),
              metadata: body.metadata || {}
            },
            links: paymentLinks
          }
        });
        if (!processStart.ok) throw new Error(processStart.error);
        paymentRow = processStart.service_object;

        await client.query(
          `
          INSERT INTO eip_core.info_record
            (tenant_id, record_type, title, payload)
          VALUES
            ($1,$2,$3,$4::jsonb)
          `,
          [
            access.tenant.id,
            "COMMERCE_PAYMENT",
            `payment.${paymentRow.code}`,
            JSON.stringify({
              payment_id: paymentRow.id,
              payment_code: paymentRow.code,
              order_code: orderCode,
              amount,
              currency,
              method,
              provider_mode: normalizeProviderMode(provider.mode || "manual")
            })
          ]
        );

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        await finalizeIdempotency(app.db, {
          tenantId: access.tenant.id,
          scope,
          key: eventId,
          response: { ok: false, error: err.message },
          status: "error"
        });
        client.release();
        return reply.code(500).send({ ok: false, error: "PAYMENT_CREATE_FAILED" });
      }

      client.release();

      const response = {
        ok: true,
        payment: {
          id: paymentRow.id,
          code: paymentRow.code,
          status: paymentRow.status,
          created_at: paymentRow.created_at
        },
        order_code: orderCode,
        orderCode: orderCode
      };

      await finalizeIdempotency(app.db, {
        tenantId: access.tenant.id,
        scope,
        key: eventId,
        response,
        status: "ok"
      });

      return reply.send(response);
    }
  );

  app.post(
    "/commerce/:suffix/entitlement/redeem",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      let body;
      try {
        body = parseJsonBody(req);
      } catch {
        return reply.code(400).send({ ok: false, error: "INVALID_JSON" });
      }

      const rawToken =
        normalizeText(body.token) ||
        normalizeText(req.headers["x-access-token"]);
      if (!rawToken) return reply.code(400).send({ ok: false, error: "TOKEN_REQUIRED" });

      const tokenHash = hashAccessToken(app, rawToken);
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const r = await client.query(
          `
          SELECT id, state, expires_at, max_uses, uses,
                 content_object_id, content_version_id, attrs,
                 service_object_id
          FROM eip_core.access_grant
          WHERE tenant_id=$1 AND token_hash=$2
          FOR UPDATE
          `,
          [access.tenant.id, tokenHash]
        );
        if (r.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "ENTITLEMENT_NOT_FOUND" });
        }

        const grant = r.rows[0];
        if (grant.expires_at && new Date(grant.expires_at).getTime() <= Date.now()) {
          await client.query("COMMIT");
          return reply.code(410).send({ ok: false, error: "ENTITLEMENT_EXPIRED" });
        }

        if (["revoked", "expired"].includes(grant.state)) {
          await client.query("ROLLBACK");
          return reply.code(403).send({ ok: false, error: "ENTITLEMENT_DISABLED" });
        }

        if (grant.uses >= grant.max_uses) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: "ENTITLEMENT_USED" });
        }

        if (!grant.service_object_id) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: "PROCESS_REQUIRED" });
        }

        const soRes = await client.query(
          `
          SELECT object_type
          FROM eip_core.service_object
          WHERE tenant_id=$1 AND id=$2
          `,
          [access.tenant.id, grant.service_object_id]
        );
        if (soRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "SERVICE_OBJECT_NOT_FOUND" });
        }

        const binding = await resolveProcessBinding(
          client,
          access.tenant.id,
          soRes.rows[0].object_type
        );
        if (!binding) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: "PROCESS_BINDING_REQUIRED" });
        }

        let instance = await app.coreProcess.findActiveInstance(
          client,
          access.tenant.id,
          grant.service_object_id
        );
        if (!instance) {
          const started = await app.coreProcess.createInstance(client, {
            tenantId: access.tenant.id,
            identityId: null,
            serviceObjectId: grant.service_object_id,
            processDefId: binding.process_def_id,
            idempotencyKey: `auto:${soRes.rows[0].object_type}:${grant.service_object_id}`
          });
          if (!started.ok) {
            await client.query("ROLLBACK");
            return reply.code(409).send({ ok: false, error: started.error });
          }
          instance = started.item;
        }

        const payload = {
          grant_id: grant.id,
          token_hash: tokenHash,
          service_object_id: grant.service_object_id
        };
        const idempotencyKey = sha256Hex(`entitlement:redeem:${grant.id}:${tokenHash}`);

        const result = await app.coreProcess.advanceInstance(client, {
          tenantId: access.tenant.id,
          identityId: null,
          instanceId: instance.id,
          action: "entitlement.redeem",
          payload,
          idempotencyKey
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }

        const updated = await client.query(
          `
          SELECT state, content_object_id, content_version_id, attrs
          FROM eip_core.access_grant
          WHERE tenant_id=$1 AND id=$2
          `,
          [access.tenant.id, grant.id]
        );

        await client.query("COMMIT");
        return reply.send({
          ok: true,
          grant: {
            id: grant.id,
            state: updated.rows[0]?.state || grant.state,
            content_object_id: updated.rows[0]?.content_object_id || grant.content_object_id,
            content_version_id: updated.rows[0]?.content_version_id || grant.content_version_id,
            attrs: updated.rows[0]?.attrs || grant.attrs || {}
          }
        });
      } catch (err) {
        await client.query("ROLLBACK");
        return reply.code(500).send({ ok: false, error: "ENTITLEMENT_REDEEM_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.post(
    "/commerce/:suffix/entitlement/confirm",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      let body;
      try {
        body = parseJsonBody(req);
      } catch {
        return reply.code(400).send({ ok: false, error: "INVALID_JSON" });
      }

      const rawToken =
        normalizeText(body.token) ||
        normalizeText(req.headers["x-access-token"]);
      if (!rawToken) return reply.code(400).send({ ok: false, error: "TOKEN_REQUIRED" });

      const tokenHash = hashAccessToken(app, rawToken);
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const r = await client.query(
          `
          SELECT id, state, max_uses, uses, service_object_id
          FROM eip_core.access_grant
          WHERE tenant_id=$1 AND token_hash=$2
          FOR UPDATE
          `,
          [access.tenant.id, tokenHash]
        );
        if (r.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "ENTITLEMENT_NOT_FOUND" });
        }

        const grant = r.rows[0];
        if (grant.state === "delivered") {
          await client.query("COMMIT");
          return reply.send({ ok: true, state: "delivered" });
        }

        if (["revoked", "expired"].includes(grant.state)) {
          await client.query("ROLLBACK");
          return reply.code(403).send({ ok: false, error: "ENTITLEMENT_DISABLED" });
        }

        if (grant.uses >= grant.max_uses) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: "ENTITLEMENT_USED" });
        }

        if (!grant.service_object_id) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: "PROCESS_REQUIRED" });
        }

        const soRes = await client.query(
          `
          SELECT object_type
          FROM eip_core.service_object
          WHERE tenant_id=$1 AND id=$2
          `,
          [access.tenant.id, grant.service_object_id]
        );
        if (soRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "SERVICE_OBJECT_NOT_FOUND" });
        }

        const binding = await resolveProcessBinding(
          client,
          access.tenant.id,
          soRes.rows[0].object_type
        );
        if (!binding) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: "PROCESS_BINDING_REQUIRED" });
        }

        let instance = await app.coreProcess.findActiveInstance(
          client,
          access.tenant.id,
          grant.service_object_id
        );
        if (!instance) {
          const started = await app.coreProcess.createInstance(client, {
            tenantId: access.tenant.id,
            identityId: null,
            serviceObjectId: grant.service_object_id,
            processDefId: binding.process_def_id,
            idempotencyKey: `auto:${soRes.rows[0].object_type}:${grant.service_object_id}`
          });
          if (!started.ok) {
            await client.query("ROLLBACK");
            return reply.code(409).send({ ok: false, error: started.error });
          }
          instance = started.item;
        }

        const payload = {
          grant_id: grant.id,
          token_hash: tokenHash,
          service_object_id: grant.service_object_id
        };
        const idempotencyKey = sha256Hex(`entitlement:confirm:${grant.id}:${tokenHash}`);

        const result = await app.coreProcess.advanceInstance(client, {
          tenantId: access.tenant.id,
          identityId: null,
          instanceId: instance.id,
          action: "entitlement.confirm",
          payload,
          idempotencyKey
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }

        const updated = await client.query(
          `
          SELECT state
          FROM eip_core.access_grant
          WHERE tenant_id=$1 AND id=$2
          `,
          [access.tenant.id, grant.id]
        );

        await client.query("COMMIT");
        return reply.send({ ok: true, state: updated.rows[0]?.state || "delivered" });
      } catch (err) {
        await client.query("ROLLBACK");
        return reply.code(500).send({ ok: false, error: "ENTITLEMENT_CONFIRM_FAILED" });
      } finally {
        client.release();
      }
    }
  );
}
