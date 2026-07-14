// services/api/src/routes/public_commerce.js
// Public commerce intake for tenant storefronts (orders, payments, entitlements).
import crypto from "node:crypto";
import { promisify } from "node:util";
import argon2 from "argon2";
import { buildSignedAssetUrl } from "../services/assets/signing.js";
import { ensureUploadDirectory, resolveAssetRoot } from "../services/assets/root.js";
import { randomToken, sha256Hex, timingSafeEqual } from "../auth/crypto.js";
import { buildRequestHash, ensureIdempotency, finalizeIdempotency } from "../services/gateway/idempotency.js";
import {
  connectionAllowsStorefrontCapability,
  connectionAllowsStorefrontScope,
  extractProfiles
} from "../services/gateway/connectionProfile.js";
import { registerRawBody, parseJsonBody } from "../services/gateway/rawBody.js";
import { hydrateConnectionProfileSecrets } from "../services/gateway/secretStore.js";
import { connectionAllowsOrigin, extractEventId, verifyConnectionRequest } from "../services/gateway/verification.js";
import { isTenantAssetPath, toLocalAssetPath } from "../services/assets/url_policy.js";
import { sendEmail } from "../lib/email.js";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  createUploadErrorHandler,
  normalizeUploadError,
  resolveMultipartFilePart,
  safeUploadTarget,
  sendUploadFailure,
  uploadPartToBuffer,
  validateImageUpload,
  writeVerifiedUpload
} from "../lib/uploadSecurity.js";
import { enforceConnectionQuota } from "../lib/abuseQuota.js";
import { resolveMarketplaceFxContext } from "../services/fx/marketFxSync.js";
import { auditSecurityEvent } from "../lib/securityAudit.js";
import { normalizeProductSource, resolveProductDrivenRows } from "../lib/storefrontContentResolution.js";
import {
  buildPublicCheckoutConfig,
  buildPublicPaymentMethods,
  getPaymentAdapter,
  normalizePaymentEnvironment,
  normalizePaymentMethodCode,
  normalizePaymentProviderCode,
  normalizePaymentSettings,
  resolvePaymentMethodContext,
  sanitizePaymentMetadata
} from "../services/payments/paymentFoundation.js";
import {
  isVerifiedPaidStatus,
  orderLifecycleForPayment,
  paymentLifecycleState,
  transitionPaymentLifecycle
} from "../services/payments/paymentLifecycle.js";

const RATE_LIMIT = { max: 120, timeWindow: "1 minute" };
const MAX_BODY = 512 * 1024;
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
const COMMERCE_SETTINGS_MODULE = "ecom";
const COMMERCE_SETTINGS_CODE = "commerce";
const DEFAULT_TRANSLATION_SETTINGS = {
  default_locale: "en",
  supported_locales: ["en", "ru", "fr", "ky", "es", "de"],
  marketplaces: [],
  engine: {
    source_locale: "en"
  }
};
const REQUIRED_STOREFRONT_LOCALES = new Set(["en", "ru", "fr", "ky", "es", "de"]);
const PUBLIC_LOCALE_METADATA = {
  en: { label: "EN", native_label: "English", english_label: "English", direction: "ltr", flag_iso: "gb", order: 10 },
  ru: { label: "RU", native_label: "Русский", english_label: "Russian", direction: "ltr", flag_iso: "ru", order: 20 },
  fr: { label: "FR", native_label: "Français", english_label: "French", direction: "ltr", flag_iso: "fr", order: 30 },
  ky: { label: "KY", native_label: "Кыргызча", english_label: "Kyrgyz", direction: "ltr", flag_iso: "kg", order: 40 },
  es: { label: "ES", native_label: "Español", english_label: "Spanish", direction: "ltr", flag_iso: "es", order: 50 },
  de: { label: "DE", native_label: "Deutsch", english_label: "German", direction: "ltr", flag_iso: "de", order: 60 }
};
const STOREFRONT_STRUCTURE_OBJECT_TYPE = "storefront_structure";
const STOREFRONT_CONTENT_OBJECT_TYPE = "storefront_content";
const STOREFRONT_STRUCTURE_SCOPE = "auto_scan";
const SAFE_PUBLIC_SELECTOR = /^[a-z0-9#.[\]="' _>:+~*(),-]+$/i;
const SAFE_LOADER_RENDERERS = new Set([
  "hero_slider",
  "rich_text_block",
  "cta_block",
  "product_carousel",
  "product_grid",
  "editorial_card_grid",
  "newsletter_block",
  "newsletter_form"
]);

function normalizeText(value) {
  return String(value || "").trim();
}

function buildCheckoutProviderReturnUrls(req, paymentCode) {
  const originValue = normalizeText(req?.headers?.origin);
  if (!originValue) return { returnUrl: null, cancelUrl: null };
  let origin;
  try {
    origin = new URL(originValue).origin;
  } catch {
    return { returnUrl: null, cancelUrl: null };
  }

  let current;
  try {
    current = new URL(normalizeText(req?.headers?.referer) || `${origin}/`);
    if (current.origin !== origin) current = new URL(`${origin}/`);
  } catch {
    current = new URL(`${origin}/`);
  }
  for (const key of ["token", "PayerID", "eip_payment_status", "eip_payment_code"]) {
    current.searchParams.delete(key);
  }
  current.hash = "";

  const approved = new URL(current.toString());
  approved.searchParams.set("eip_payment_status", "approved");
  approved.searchParams.set("eip_payment_code", paymentCode);
  const cancelled = new URL(current.toString());
  cancelled.searchParams.set("eip_payment_status", "cancelled");
  cancelled.searchParams.set("eip_payment_code", paymentCode);
  return { returnUrl: approved.toString(), cancelUrl: cancelled.toString() };
}

function profileProviderCode(profile = {}) {
  return normalizePaymentProviderCode(
    profile?.routing?.provider_code ||
      profile?.routing?.protocol ||
      profile?.identity?.connection_kind
  );
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

function normalizePublicSelector(value) {
  const selector = normalizeText(value).slice(0, 500);
  return selector && SAFE_PUBLIC_SELECTOR.test(selector) ? selector : "";
}

function normalizePublicMapping(candidate = {}) {
  const slotCode = normalizeText(candidate.suggested_slot).toLowerCase();
  const renderer = normalizeText(candidate.suggested_renderer).toLowerCase();
  const selector = normalizePublicSelector(candidate.selector);
  if (
    !slotCode ||
    !selector ||
    candidate.mapping_status !== "approved" ||
    candidate.push_allowed === false ||
    !SAFE_LOADER_RENDERERS.has(renderer)
  ) {
    return null;
  }
  return {
    slot_code: slotCode,
    renderer,
    selector,
    source: "approved_mapping",
    content_endpoint: null
  };
}

function findConnectionMappingProfile(attrs = {}, connectionCode = "") {
  const code = normalizeText(connectionCode);
  const profiles = Array.isArray(attrs.mapping_profiles) ? attrs.mapping_profiles : [];
  const matched = profiles.find((profile) => normalizeText(profile?.connection_code) === code);
  if (matched) return matched;
  const active = attrs.mapping_profile && typeof attrs.mapping_profile === "object"
    ? attrs.mapping_profile
    : null;
  return normalizeText(active?.connection_code) === code ? active : null;
}

function escapeHtmlAttribute(value = "") {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function requestPublicOrigin(req) {
  const forwardedHost = normalizeText(req?.headers?.["x-forwarded-host"]).split(",")[0].trim();
  const host = forwardedHost || normalizeText(req?.headers?.host);
  if (!host) return "";
  const forwardedProto = normalizeText(req?.headers?.["x-forwarded-proto"]).split(",")[0].trim();
  const proto = forwardedProto || (req?.protocol ? normalizeText(req.protocol) : "https") || "https";
  return `${proto}://${host}`;
}

function buildStorefrontConnectorPatch(req, access, suffix) {
  const origin = requestPublicOrigin(req);
  const connection = normalizeText(suffix || access.profile?.identity?.connection_code);
  const loaderUrl = `${origin}/api/public/commerce-loader/v1.js`;
  const refreshMs = 30000;
  const scriptTag = `<script async src="${escapeHtmlAttribute(loaderUrl)}" data-connection="${escapeHtmlAttribute(connection)}" data-api-base="${escapeHtmlAttribute(origin)}" data-refresh-ms="${refreshMs}"></script>`;
  const loaderEnabled = connectionAllowsStorefrontCapability(access.profile, "loader");
  return {
    ok: true,
    connector: "eip_storefront_connector",
    connector_version: "loader_polling_v1",
    connection,
    loader_enabled: loaderEnabled,
    public_api_base: origin,
    loader_url: loaderUrl,
    script_tag: scriptTag,
    install_location: "Before </body>, or in the site/app shell so it loads on every editable page.",
    refresh: {
      mode: "manifest_version_poll",
      interval_ms: refreshMs,
      manifest_endpoint: `/api/public/commerce/${encodeURIComponent(connection)}/storefront/manifest?integration=loader`
    },
    receiver_contract: {
      manual_refresh_event: "document.dispatchEvent(new Event('eip:storefront:refresh'))",
      post_message: { type: "eip-storefront-refresh", connection },
      applied_event: "eip:storefront:applied",
      browser_api: "window.EIPStorefrontConnector.refresh()"
    },
    requirements: {
      mapping_required: true,
      publish_required: true,
      loader_must_be_enabled_on_connection_profile: true,
      origin_should_be_allowlisted: true
    }
  };
}

async function loadPublicStorefrontContentVersion(app, tenantId, slots = []) {
  const slotCodes = [...new Set(
    (Array.isArray(slots) ? slots : [])
      .map((slot) => normalizeText(slot).toLowerCase())
      .filter(Boolean)
  )].sort();
  if (!slotCodes.length) {
    return {
      content_version: sha256Hex("storefront-content:empty").slice(0, 24),
      content_updated_at: null,
      slot_versions: {}
    };
  }

  try {
    const contentRes = await app.db.query(
      `
      SELECT DISTINCT ON (lower(COALESCE(attrs->>'slot', '')))
        lower(COALESCE(attrs->>'slot', '')) AS slot,
        status,
        updated_at,
        attrs->'workflow'->>'published_at' AS published_at,
        attrs->'translation'->>'translated_at' AS translated_at
      FROM eip_core.service_object
      WHERE tenant_id = $1
        AND object_type = $2
        AND lower(COALESCE(attrs->>'slot', '')) = ANY($3::text[])
        AND lower(COALESCE(attrs->>'is_active', 'true')) <> 'false'
        AND (
          lower(COALESCE(status, '')) = $4
          OR lower(COALESCE(attrs->'workflow'->>'stage', '')) = $4
        )
      ORDER BY lower(COALESCE(attrs->>'slot', '')), updated_at DESC, created_at DESC
      `,
      [tenantId, STOREFRONT_CONTENT_OBJECT_TYPE, slotCodes, PUBLISHED_STAGE]
    );
    const slotVersions = {};
    for (const row of contentRes.rows || []) {
      const slot = normalizeText(row?.slot).toLowerCase();
      if (!slot || !slotCodes.includes(slot)) continue;
      slotVersions[slot] = {
        status: normalizeText(row?.status),
        updated_at: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
        published_at: normalizeOptionalText(row?.published_at),
        translated_at: normalizeOptionalText(row?.translated_at)
      };
    }
    const contentUpdatedAt = Object.values(slotVersions)
      .map((item) => item.published_at || item.translated_at || item.updated_at)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
    return {
      content_version: sha256Hex(JSON.stringify({ slotCodes, slotVersions })).slice(0, 24),
      content_updated_at: contentUpdatedAt,
      slot_versions: slotVersions
    };
  } catch (error) {
    app.log?.warn?.({
      event: "storefront_content_version_unavailable",
      tenant_id: tenantId,
      error: error?.message || String(error)
    });
    return {
      content_version: sha256Hex(JSON.stringify({ slotCodes })).slice(0, 24),
      content_updated_at: null,
      slot_versions: {}
    };
  }
}

async function loadPublicStorefrontManifest(app, access, suffix, integration = "api") {
  const r = await app.db.query(
    `
    SELECT attrs
    FROM eip_core.service_object
    WHERE tenant_id = $1
      AND object_type = $2
      AND attrs->>'scope' = $3
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
    `,
    [access.tenant.id, STOREFRONT_STRUCTURE_OBJECT_TYPE, STOREFRONT_STRUCTURE_SCOPE]
  );
  const attrs = r.rows[0]?.attrs && typeof r.rows[0].attrs === "object" ? r.rows[0].attrs : {};
  const profile = findConnectionMappingProfile(attrs, access.profile.identity?.connection_code);
  const approved = Array.isArray(profile?.approved_mappings) ? profile.approved_mappings : [];
  const encodedSuffix = encodeURIComponent(suffix);
  const integrationQuery = integration === "loader" ? "&integration=loader" : "";
  const slots = approved
    .map(normalizePublicMapping)
    .filter(Boolean)
    .map((mapping) => ({
      ...mapping,
      content_endpoint: `/api/public/commerce/${encodedSuffix}/content?slot=${encodeURIComponent(mapping.slot_code)}${integrationQuery}`
    }));
  const contentVersion = await loadPublicStorefrontContentVersion(
    app,
    access.tenant.id,
    slots.map((slot) => slot.slot_code)
  );
  const mappingVersion = Number(profile?.mapping_version || 0);
  return {
    ok: true,
    connection_code: access.profile.identity?.connection_code || null,
    mapping_profile_code: profile?.mapping_profile_code || null,
    mapping_version: mappingVersion,
    connector_version: sha256Hex(JSON.stringify({
      mapping_profile_code: profile?.mapping_profile_code || null,
      mapping_version: mappingVersion,
      content_version: contentVersion.content_version
    })).slice(0, 24),
    content_version: contentVersion.content_version,
    content_updated_at: contentVersion.content_updated_at,
    slot_versions: contentVersion.slot_versions,
    refresh_endpoint: `/api/public/commerce/${encodedSuffix}/storefront/manifest?integration=${integration === "loader" ? "loader" : "api"}`,
    frontend_url: normalizeOptionalText(access.profile.identity?.frontend_url),
    slots
  };
}

function storefrontLoaderScript() {
  return `(() => {
  "use strict";
  const script = document.currentScript;
  if (!script) return;
  const connection = String(script.dataset.connection || "").trim();
  const apiBase = String(script.dataset.apiBase || new URL(script.src).origin).replace(/\\/+$/, "");
  const apiKey = String(script.dataset.apiKey || "").trim();
  const debug = script.dataset.debug === "true";
  const refreshMsRaw = Number(script.dataset.refreshMs || script.dataset.pollMs || 30000);
  const refreshMs = Number.isFinite(refreshMsRaw) ? Math.max(5000, refreshMsRaw) : 30000;
  const liveRefresh = script.dataset.liveRefresh !== "false" && script.dataset.refresh !== "false";
  let lastConnectorVersion = "";
  let running = false;
  const warn = (...args) => { if (debug && globalThis.console) console.warn("[EIP storefront loader]", ...args); };
  if (!connection || !apiBase) return warn("Missing data-connection or data-api-base.");
  const headers = apiKey ? { "X-API-Key": apiKey } : {};
  const getJson = async (url) => {
    const response = await fetch(url, { headers, credentials: "omit", mode: "cors" });
    if (!response.ok) throw new Error("HTTP_" + response.status);
    return response.json();
  };
  const text = (value) => String(value == null ? "" : value);
  const el = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value) node.textContent = text(value);
    return node;
  };
  const safeUrl = (value) => {
    const raw = text(value).trim();
    return /^(?:https?:\\/\\/|\\/|#)/i.test(raw) ? raw : "";
  };
  const image = (src, alt = "") => {
    const url = safeUrl(src);
    if (!url) return null;
    const node = el("img", "eip-storefront-image");
    node.src = url;
    node.alt = text(alt);
    node.loading = "lazy";
    return node;
  };
  const buttonLink = (label, href, style = "primary") => {
    const url = safeUrl(href);
    if (!label || !url) return null;
    const node = el("a", "eip-storefront-cta", label);
    node.href = url;
    const variant = text(style).trim().toLowerCase();
    if (/^[a-z0-9_-]{1,32}$/.test(variant)) node.classList.add("eip-storefront-cta--" + variant);
    return node;
  };
  const appendButtons = (parent, entry) => {
    const buttons = Array.isArray(entry?.buttons) && entry.buttons.length
      ? entry.buttons
      : entry?.cta_label
        ? [{ label: entry.cta_label, url: entry.cta_target || entry.cta_url, style: "primary" }]
        : [];
    for (const button of buttons) {
      const cta = buttonLink(
        button?.label || button?.text || button?.cta_label,
        button?.url || button?.href || button?.target || button?.cta?.target || button?.cta_url || button?.ctaUrl,
        button?.style || button?.variant || "primary"
      );
      if (cta) parent.append(cta);
    }
  };
  const highlightPreviewTarget = () => {
    const params = new URLSearchParams(globalThis.location?.search || "");
    if (params.get("eip_content_preview") !== "1") return false;
    const selector = text(params.get("eip_selector")).trim();
    if (!selector || selector.length > 500) return false;
    let target;
    try { target = document.querySelector(selector); } catch { return false; }
    if (!target) return false;
    let style = document.getElementById("eip-preview-highlight-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "eip-preview-highlight-style";
      style.textContent = "[data-eip-preview-highlight]{position:relative!important;z-index:2147483000!important;outline:4px solid #5878aa!important;outline-offset:5px!important;box-shadow:0 0 0 10px rgba(88,120,170,.2),0 18px 50px rgba(11,20,48,.28)!important;animation:eip-preview-highlight-pulse 1.5s ease-in-out infinite alternate!important}[data-eip-preview-highlight]::before{content:attr(data-eip-preview-highlight);position:absolute;z-index:2147483001;top:8px;left:8px;padding:7px 10px;border-radius:999px;background:#0b1430;color:#fff;font:700 11px/1.1 system-ui,sans-serif;letter-spacing:.05em;pointer-events:none}@keyframes eip-preview-highlight-pulse{from{outline-color:#5878aa}to{outline-color:#c99a45}}";
      document.head.append(style);
    }
    document.querySelectorAll("[data-eip-preview-highlight]").forEach((node) => node.removeAttribute("data-eip-preview-highlight"));
    target.setAttribute("data-eip-preview-highlight", "Selected in Content Studio");
    if (target.dataset.eipPreviewClickBound !== "true") {
      target.dataset.eipPreviewClickBound = "true";
      target.addEventListener("click", () => {
        if (globalThis.parent !== globalThis) globalThis.parent.postMessage({ type: "eip-content-preview-select", selector }, "*");
      }, true);
    }
    target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    return true;
  };
  const watchPreviewTarget = () => {
    if (highlightPreviewTarget()) return;
    const observer = new MutationObserver(() => {
      if (highlightPreviewTarget()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    globalThis.setTimeout(() => observer.disconnect(), 8000);
  };
  const productCard = (product) => {
    const card = el("article", "eip-storefront-product-card");
    const media = product?.attrs?.media || {};
    const img = image(media.main_asset?.url || media.main_url || media.hero_asset?.url || media.hero_url, product?.name || "");
    if (img) card.append(img);
    card.append(el("h3", "eip-storefront-product-title", product?.name || product?.title || product?.code || "Product"));
    return card;
  };
  const render = (target, mapping, item) => {
    if (!target || !item || mapping.renderer !== item.renderer) return false;
    const root = el("div", "eip-storefront-slot eip-renderer-" + mapping.renderer);
    if (mapping.renderer === "hero_slider") {
      const slides = Array.isArray(item.slides) ? item.slides : [];
      if (!slides.length) return false;
      for (const slide of slides) {
        const panel = el("article", "eip-storefront-hero-slide");
        const img = image(slide.image, slide.title || "");
        if (img) panel.append(img);
        if (slide.eyebrow) panel.append(el("p", "eip-storefront-eyebrow", slide.eyebrow));
        if (slide.title) panel.append(el("h2", "eip-storefront-title", slide.title));
        if (slide.subtitle || slide.body) panel.append(el("p", "eip-storefront-copy", slide.subtitle || slide.body));
        appendButtons(panel, slide);
        root.append(panel);
      }
    } else if (["product_carousel", "product_grid"].includes(mapping.renderer)) {
      const products = Array.isArray(item.products) ? item.products : [];
      if (!products.length) return false;
      root.classList.add(mapping.renderer === "product_carousel" ? "eip-storefront-carousel" : "eip-storefront-grid");
      for (const product of products) root.append(productCard(product));
    } else {
      const slides = Array.isArray(item.slides) ? item.slides : [];
      const entries = slides.length ? slides : [item.content || item];
      for (const entry of entries) {
        const block = el("article", "eip-storefront-block");
        const img = image(entry.image, entry.title || "");
        if (img) block.append(img);
        if (entry.title || item.title) block.append(el("h3", "eip-storefront-title", entry.title || item.title));
        if (entry.body || entry.subtitle) block.append(el("p", "eip-storefront-copy", entry.body || entry.subtitle));
        appendButtons(block, entry);
        root.append(block);
      }
    }
    if (!root.childNodes.length) return false;
    target.replaceChildren(root);
    return true;
  };
  const manifestUrl = () => apiBase + "/api/public/commerce/" + encodeURIComponent(connection) + "/storefront/manifest?integration=loader";
  const applyManifest = async (manifest, { force = false } = {}) => {
    const version = text(manifest?.connector_version || manifest?.content_version || manifest?.mapping_version || "");
    if (!force && version && version === lastConnectorVersion) {
      return { applied: 0, skipped: true, version };
    }
    let applied = 0;
    for (const mapping of Array.isArray(manifest.slots) ? manifest.slots : []) {
      if (!mapping?.selector || !mapping?.content_endpoint) continue;
      let target;
      try { target = document.querySelector(mapping.selector); } catch { continue; }
      if (!target) continue;
      try {
        const payload = await getJson(apiBase + mapping.content_endpoint);
        if (render(target, mapping, payload?.item)) applied += 1;
        highlightPreviewTarget();
      } catch (error) {
        warn("Slot fallback preserved", mapping.slot_code, error?.message || error);
      }
    }
    if (version) lastConnectorVersion = version;
    document.dispatchEvent(new CustomEvent("eip:storefront:applied", {
      detail: {
        connection,
        version: lastConnectorVersion,
        applied,
        slotCount: Array.isArray(manifest.slots) ? manifest.slots.length : 0
      }
    }));
    return { applied, skipped: false, version: lastConnectorVersion };
  };
  const run = async ({ force = false } = {}) => {
    if (running) return { applied: 0, skipped: true, version: lastConnectorVersion };
    running = true;
    try {
      watchPreviewTarget();
      const manifest = await getJson(manifestUrl());
      return await applyManifest(manifest, { force });
    } finally {
      running = false;
    }
  };
  const refresh = () => run({ force: true }).catch((error) => warn("Refresh failed", error?.message || error));
  const previousConnector = globalThis.EIPStorefrontConnector && typeof globalThis.EIPStorefrontConnector === "object"
    ? globalThis.EIPStorefrontConnector
    : {};
  globalThis.EIPStorefrontConnector = {
    ...previousConnector,
    connection,
    apiBase,
    refresh,
    getVersion: () => lastConnectorVersion
  };
  globalThis.addEventListener("message", (event) => {
    const data = event?.data || {};
    if (data?.type !== "eip-storefront-refresh") return;
    const targetConnection = text(data.connection || "");
    if (targetConnection && targetConnection !== connection) return;
    refresh();
  });
  document.addEventListener("eip:storefront:refresh", refresh);
  run({ force: true }).catch((error) => warn("Manifest load failed", error?.message || error));
  if (liveRefresh && refreshMs > 0) {
    globalThis.setInterval(() => run().catch((error) => warn("Version refresh failed", error?.message || error)), refreshMs);
  }
})();`;
}

function storefrontRenderer(attrs = {}, slot = "") {
  const configured = normalizeText(attrs.renderer || attrs.renderer_type).toLowerCase();
  if (configured) return configured;
  const normalizedSlot = normalizeText(slot).toLowerCase();
  if (normalizedSlot.includes("hero") || normalizedSlot.includes("banner")) return "hero_slider";
  if (normalizedSlot.includes("product") || normalizedSlot.includes("worth") || normalizedSlot.includes("featured")) {
    return "product_carousel";
  }
  return "rich_text_block";
}

async function resolveStorefrontSlotProducts(app, tenantId, attrs = {}) {
  const source = normalizeProductSource(attrs);
  if (!source) return { source_mode: null, products: [] };
  const r = await app.db.query(
    `
    SELECT id, code, name, material_type, attrs
    FROM eip_core.material
    WHERE tenant_id = $1
      AND ${publishedMaterialPredicate()}
    ORDER BY name ASC
    LIMIT 250
    `,
    [tenantId]
  );
  const resolved = resolveProductDrivenRows(r.rows || [], attrs);
  return {
    source_mode: resolved.source_mode,
    products: resolved.products.map((row) => ({
      ...row,
      attrs: signMediaAttrs(row.attrs, app, tenantId)
    }))
  };
}

function normalizeStorefrontCta(slide = {}) {
  const buttons = normalizeStorefrontButtons(slide.buttons || []);
  const firstButton = buttons[0] || null;
  const actionRaw = normalizeText(
    slide.cta?.action ||
      slide.cta_action ||
      firstButton?.cta?.action ||
      ""
  ).toLowerCase();
  const target = normalizeOptionalText(
    slide.cta?.target ||
      slide.cta_target ||
      slide.cta_url ||
      slide.ctaUrl ||
      firstButton?.url ||
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
  if (newTabRaw === undefined) newTabRaw = firstButton?.new_tab;
  const newTab =
    newTabRaw === true || String(newTabRaw || "").toLowerCase() === "true";

  return {
    action,
    target: target || "",
    new_tab: newTab
  };
}

function normalizeStorefrontButton(button = {}, index = 0) {
  if (!button || typeof button !== "object") return null;
  const label = normalizeOptionalText(button.label || button.text || button.cta_label || button.ctaLabel);
  const url = normalizeOptionalText(button.url || button.href || button.target || button.cta_url || button.ctaUrl);
  const styleRaw = normalizeText(button.style || button.variant || "primary").toLowerCase();
  const style = ["primary", "secondary", "link"].includes(styleRaw) ? styleRaw : "primary";
  const actionRaw = normalizeText(button.cta?.action || button.action || "").toLowerCase();
  const action = STOREFRONT_CTA_ACTIONS.has(actionRaw)
    ? actionRaw
    : url
      ? /^https?:\/\//i.test(url)
        ? "navigate_external"
        : url.startsWith("#")
          ? "scroll_to"
          : "navigate_internal"
      : "navigate_internal";
  const newTabRaw = button.new_tab ?? button.newTab ?? button.cta?.new_tab ?? button.cta?.newTab;
  const newTab = newTabRaw === true || String(newTabRaw || "").toLowerCase() === "true";
  if (!label && !url) return null;
  return {
    id: normalizeOptionalText(button.id) || `button-${index + 1}`,
    label,
    url,
    style,
    icon: normalizeOptionalText(button.icon),
    new_tab: newTab,
    newTab,
    cta: {
      action,
      target: url || "",
      new_tab: newTab
    }
  };
}

function normalizeStorefrontButtons(input = []) {
  if (!Array.isArray(input)) return [];
  return input
    .map((button, index) => normalizeStorefrontButton(button, index))
    .filter(Boolean)
    .slice(0, 6);
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

const PUBLIC_CORS_HEADERS = [
  "Content-Type",
  "X-API-Key",
  "Authorization",
  "X-Event-Id",
  "X-Member-Csrf"
];

function applyCors(reply, origin, requestHeaders) {
  if (!origin) return;
  const allowedByName = new Map(PUBLIC_CORS_HEADERS.map((header) => [header.toLowerCase(), header]));
  const requested = String(requestHeaders || "")
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
  const allowedHeaders = requested.length
    ? requested.map((header) => allowedByName.get(header)).filter(Boolean)
    : PUBLIC_CORS_HEADERS;
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Credentials", "true");
  reply.header("Access-Control-Allow-Headers", allowedHeaders.join(", "));
  reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  reply.header("Access-Control-Max-Age", "600");
}

function connectionAllowsIp(profile, ip) {
  const allowlist = Array.isArray(profile?.audit?.ip_allowlist) ? profile.audit.ip_allowlist : [];
  if (!allowlist.length) return true;
  return allowlist.includes(ip);
}

function requiresInbound(profile) {
  return profile?.identity?.direction === "inbound" ||
    profile?.identity?.direction === "both" ||
    profile?.inbound?.webhook_enabled === true;
}

function isSandboxConnection(profile) {
  return normalizeText(profile?.identity?.environment).toLowerCase() === "sandbox";
}

function hasQueryApiKey(req) {
  return Boolean(req.query?.api_key || req.query?.apiKey);
}

function validateProductionConnectionPolicy(profile) {
  if (isSandboxConnection(profile)) return { ok: true };
  const verificationMode = normalizeText(profile?.verification?.mode || "none").toLowerCase();
  const originAllowlist = Array.isArray(profile?.inbound?.origin_allowlist)
    ? profile.inbound.origin_allowlist.map((item) => normalizeText(item)).filter(Boolean)
    : [];

  if (verificationMode === "none") {
    return { ok: false, error: "VERIFICATION_REQUIRED" };
  }
  if (!originAllowlist.length) {
    return { ok: false, error: "ORIGIN_ALLOWLIST_REQUIRED" };
  }
  if (originAllowlist.some((item) => item === "*")) {
    return { ok: false, error: "WILDCARD_ORIGIN_FORBIDDEN" };
  }
  return { ok: true };
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

function toPublicPaymentSession(row = {}) {
  const attrs = row.attrs && typeof row.attrs === "object" ? row.attrs : {};
  const status = attrs.payment_status || attrs.workflow?.stage || row.status;
  return {
    id: row.id,
    code: row.code,
    status,
    lifecycle_state: paymentLifecycleState(status),
    method: attrs.method || null,
    provider: attrs.provider || null,
    environment: attrs.environment || null,
    amount: attrs.amount ?? null,
    currency: attrs.currency || null,
    provider_session_id: attrs.provider_session_id || null,
    order_id: attrs.order_id || null,
    order_code: attrs.order_code || null,
    redirect_url: isVerifiedPaidStatus(status) ? null : attrs.redirect_url || null,
    client_action: isVerifiedPaidStatus(status) ? null : attrs.client_action || null,
    refund_status: attrs.refund_status || null,
    refunded_amount: attrs.refunded_amount ?? null,
    safe_reason: attrs.safe_reason || null,
    verified_at: attrs.verified_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function loadPaymentSession(client, tenantId, reference) {
  const r = await client.query(
    `
    SELECT id, code, status, attrs, created_at, updated_at
    FROM eip_core.service_object
    WHERE tenant_id=$1
      AND object_type='payment'
      AND (id::text=$2 OR code=$2)
    LIMIT 1
    `,
    [tenantId, reference]
  );
  return r.rows[0] || null;
}

async function writePublicPaymentRecords(client, opts) {
  const payload = sanitizePaymentMetadata({
    payment_id: opts.paymentId,
    payment_code: opts.paymentCode,
    order_id: opts.orderId || null,
    order_code: opts.orderCode || null,
    provider: opts.provider,
    method: opts.method,
    environment: opts.environment,
    amount: opts.amount,
    currency: opts.currency,
    status: opts.status,
    event_type: opts.eventType,
    source: opts.source,
    connection_code: opts.connectionCode,
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

async function loadOrderLifecycleSummary(client, tenantId, orderId, orderCode) {
  if (!orderId && !orderCode) return null;
  const r = await client.query(
    `
    SELECT id, code, status, attrs, created_at, updated_at
    FROM eip_core.service_object
    WHERE tenant_id=$1
      AND object_type='sales_order'
      AND (id::text=$2 OR code=$3)
    LIMIT 1
    `,
    [tenantId, normalizeText(orderId), normalizeText(orderCode)]
  );
  const row = r.rows[0];
  if (!row) return null;
  const attrs = row.attrs && typeof row.attrs === "object" ? row.attrs : {};
  return {
    id: row.id,
    code: row.code,
    status: attrs.order_status || row.status,
    payment_status: attrs.payment_status || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function applyVerifiedPaymentLifecycle(client, {
  tenantId,
  payment,
  event,
  source,
  connectionCode,
  metadata
}) {
  const attrs = payment.attrs && typeof payment.attrs === "object" ? payment.attrs : {};
  const transition = transitionPaymentLifecycle({
    currentStatus: attrs.payment_status || payment.status,
    currentRefundedAmount: attrs.refunded_amount,
    paymentAmount: attrs.amount,
    event
  });
  const providerEventId = normalizeText(event?.provider_event_id);
  const providerPaymentId = normalizeText(event?.provider_payment_id);
  const verifiedAt = transition.verified_paid
    ? normalizeText(event?.verified_at) || new Date().toISOString()
    : normalizeText(attrs.verified_at) || null;
  await client.query(
    `
    UPDATE eip_core.service_object
    SET status=$3,
        attrs=COALESCE(attrs, '{}'::jsonb) || jsonb_build_object(
          'payment_status', $3::text,
          'provider_event_id', COALESCE(NULLIF($4::text, ''), attrs->>'provider_event_id'),
          'provider_payment_id', COALESCE(NULLIF($5::text, ''), attrs->>'provider_payment_id'),
          'verified_at', $6::text,
          'refund_status', $7::text,
          'refunded_amount', $8::numeric,
          'safe_reason', $9::text,
          'client_action', CASE WHEN $3 IN ('authorized','paid','failed','cancelled','refund_pending','partially_refunded','refunded','refund_failed') THEN NULL ELSE attrs->'client_action' END
        ),
        updated_at=now()
    WHERE tenant_id=$1 AND id=$2 AND object_type='payment'
    `,
    [
      tenantId,
      payment.id,
      transition.payment_status,
      providerEventId,
      providerPaymentId,
      verifiedAt,
      transition.refund_status,
      transition.refunded_amount,
      normalizeText(event?.safe_reason) || null
    ]
  );

  const order = await loadOrderLifecycleSummary(client, tenantId, attrs.order_id, attrs.order_code);
  let nextOrderStatus = order?.status || null;
  if (order) {
    nextOrderStatus = orderLifecycleForPayment({
      currentOrderStatus: order.status,
      paymentStatus: transition.payment_status
    });
    await client.query(
      `
      UPDATE eip_core.service_object
      SET status=$3,
          attrs=COALESCE(attrs, '{}'::jsonb) || jsonb_build_object(
            'order_status', $3::text,
            'payment_status', $4::text,
            'payment_id', $5::text,
            'payment_code', $6::text,
            'paid_at', CASE WHEN $4 IN ('paid','partially_refunded','refunded') THEN COALESCE(attrs->>'paid_at', $7::text) ELSE attrs->>'paid_at' END,
            'refund_status', $8::text
          ),
          updated_at=now()
      WHERE tenant_id=$1 AND id=$2 AND object_type='sales_order'
      `,
      [
        tenantId,
        order.id,
        nextOrderStatus,
        transition.payment_status,
        payment.id,
        payment.code,
        verifiedAt,
        transition.refund_status
      ]
    );
  }

  await writePublicPaymentRecords(client, {
    tenantId,
    paymentId: payment.id,
    paymentCode: payment.code,
    orderId: attrs.order_id,
    orderCode: attrs.order_code,
    provider: attrs.provider,
    method: attrs.method,
    environment: attrs.environment,
    amount: attrs.amount,
    currency: attrs.currency,
    status: transition.payment_status,
    eventType: event?.event_type || "payment_status_updated",
    source,
    connectionCode,
    metadata: {
      ...(metadata || {}),
      provider_event_id: providerEventId || null,
      refund_amount: event?.refund_amount ?? null,
      order_status: nextOrderStatus
    }
  });
  return { transition, order_status: nextOrderStatus };
}

async function loadPaymentForProviderEvent(client, tenantId, provider, event = {}) {
  const r = await client.query(
    `
    SELECT id, code, status, attrs, created_at, updated_at
    FROM eip_core.service_object
    WHERE tenant_id=$1
      AND object_type='payment'
      AND attrs->>'provider'=$2
      AND (
        (NULLIF($3::text, '') IS NOT NULL AND attrs->>'provider_session_id'=$3) OR
        (NULLIF($4::text, '') IS NOT NULL AND attrs->>'provider_payment_id'=$4) OR
        (NULLIF($4::text, '') IS NOT NULL AND attrs->>'provider_event_id'=$4) OR
        (NULLIF($5::text, '') IS NOT NULL AND code=$5)
      )
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE
    `,
    [
      tenantId,
      provider,
      normalizeText(event.provider_session_id),
      normalizeText(event.provider_payment_id),
      normalizeText(event.payment_code)
    ]
  );
  return r.rows[0] || null;
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
    supported_locales: Array.from(new Set([
      ...DEFAULT_TRANSLATION_SETTINGS.supported_locales,
      ...(Array.isArray(raw.supported_locales) ? raw.supported_locales : [])
    ])),
    marketplaces: Array.isArray(raw.marketplaces) ? raw.marketplaces : []
  };
}

function resolveTranslationLocales(translationSettings) {
  const locales = new Set();
  const defaultLocale = normalizeLocaleCode(translationSettings?.default_locale) || "en";
  const sourceLocale = normalizeLocaleCode(translationSettings?.engine?.source_locale) || defaultLocale;
  locales.add(defaultLocale);
  locales.add(sourceLocale);
  for (const locale of REQUIRED_STOREFRONT_LOCALES) {
    const normalized = normalizeLocaleCode(locale);
    if (normalized) locales.add(normalized);
  }
  for (const locale of Array.isArray(translationSettings?.supported_locales)
    ? translationSettings.supported_locales
    : []) {
    const normalized = normalizeLocaleCode(locale);
    if (normalized) locales.add(normalized);
  }
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
  if (PUBLIC_LOCALE_METADATA[normalized]?.english_label) {
    return `${PUBLIC_LOCALE_METADATA[normalized].english_label} (${normalized.toUpperCase()})`;
  }
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

function publicLocaleMetadata(localeCode) {
  const normalized = normalizeLocaleCode(localeCode);
  const metadata = PUBLIC_LOCALE_METADATA[normalized] || {};
  return {
    code: normalized,
    label: metadata.label || normalized.toUpperCase(),
    short_label: metadata.label || normalized.toUpperCase(),
    native_label: metadata.native_label || localeLabel(normalized),
    english_label: metadata.english_label || localeLabel(normalized),
    direction: metadata.direction || "ltr",
    flag_iso: metadata.flag_iso || "",
    order: Number.isFinite(Number(metadata.order)) ? Number(metadata.order) : 999
  };
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

  app.get("/commerce-loader/v1.js", async (_req, reply) => {
    reply.header("Content-Type", "application/javascript; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=300");
    reply.header("Cross-Origin-Resource-Policy", "cross-origin");
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.send(storefrontLoaderScript());
  });

  app.options("/commerce/*", { config: { cors: false } }, async (req, reply) => {
    const origin = req.headers.origin;
    applyCors(reply, origin, req.headers["access-control-request-headers"]);
    return reply.code(204).send();
  });

  app.options("/checkout/*", { config: { cors: false } }, async (req, reply) => {
    const origin = req.headers.origin;
    applyCors(reply, origin, req.headers["access-control-request-headers"]);
    return reply.code(204).send();
  });

  app.options("/payments/*", { config: { cors: false } }, async (req, reply) => {
    const origin = req.headers.origin;
    applyCors(reply, origin, req.headers["access-control-request-headers"]);
    return reply.code(204).send();
  });

  async function resolveConnection(appInstance, req, reply, allowedChannels, options = {}) {
    const paymentWebhook = options.paymentWebhook === true;
    if (hasQueryApiKey(req)) {
      auditSecurityEvent(appInstance, "commerce.query_api_key_rejected", {
        category: "public_commerce",
        source: "public_commerce.resolveConnection",
        severity: "warning",
        outcome: "rejected",
        reason: "QUERY_API_KEY_REJECTED",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null
      });
      reply.code(401).send({ ok: false, error: "QUERY_API_KEY_REJECTED" });
      return null;
    }

    const suffix = normalizeText(
      req.params?.suffix ||
        req.query?.suffix ||
        req.query?.connection ||
        req.query?.connection_suffix ||
        req.headers["x-eip-connection-suffix"] ||
        req.headers["x-storefront-suffix"] ||
        req.headers["x-storefront-connection"]
    );
    if (!suffix) {
      auditSecurityEvent(appInstance, "commerce.connection_suffix_missing", {
        category: "public_commerce",
        source: "public_commerce.resolveConnection",
        severity: "warning",
        outcome: "rejected",
        reason: "CONNECTION_SUFFIX_REQUIRED",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null
      });
      reply.code(400).send({ ok: false, error: "CONNECTION_SUFFIX_REQUIRED" });
      return null;
    }

    const resolved = await resolveTenantBySuffix(appInstance, suffix);
    if (!resolved) {
      auditSecurityEvent(appInstance, "commerce.routing_not_found", {
        category: "public_commerce",
        source: "public_commerce.resolveConnection",
        severity: "warning",
        outcome: "rejected",
        suffix,
        reason: "ROUTING_NOT_FOUND",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null
      });
      reply.code(404).send({ ok: false, error: "ROUTING_NOT_FOUND" });
      return null;
    }
    if (resolved.error) {
      auditSecurityEvent(appInstance, "commerce.duplicate_suffix", {
        category: "public_commerce",
        source: "public_commerce.resolveConnection",
        severity: "warning",
        outcome: "rejected",
        suffix,
        reason: resolved.error,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null
      });
      reply.code(409).send({ ok: false, error: resolved.error });
      return null;
    }

    const { tenant } = resolved;
    let { profile } = resolved;
    if (!profile) {
      auditSecurityEvent(appInstance, "commerce.connection_not_found", {
        category: "public_commerce",
        source: "public_commerce.resolveConnection",
        severity: "warning",
        outcome: "rejected",
        tenantId: tenant.id,
        suffix,
        reason: "CONNECTION_NOT_FOUND",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null
      });
      reply.code(404).send({ ok: false, error: "CONNECTION_NOT_FOUND" });
      return null;
    }
    if (!profile.identity?.is_enabled) {
      auditSecurityEvent(appInstance, "commerce.connection_disabled", {
        category: "public_commerce",
        source: "public_commerce.resolveConnection",
        severity: "warning",
        outcome: "rejected",
        tenantId: tenant.id,
        connectionCode: profile.identity?.connection_code,
        suffix,
        reason: "CONNECTION_DISABLED",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null
      });
      reply.code(403).send({ ok: false, error: "CONNECTION_DISABLED" });
      return null;
    }
    if (!requiresInbound(profile)) {
      auditSecurityEvent(appInstance, "commerce.inbound_not_allowed", {
        category: "public_commerce",
        source: "public_commerce.resolveConnection",
        severity: "warning",
        outcome: "rejected",
        tenantId: tenant.id,
        connectionCode: profile.identity?.connection_code,
        suffix,
        reason: "INBOUND_NOT_ALLOWED",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null
      });
      reply.code(403).send({ ok: false, error: "INBOUND_NOT_ALLOWED" });
      return null;
    }

    if (Array.isArray(allowedChannels) && allowedChannels.length) {
      const channel = normalizeText(profile.routing?.channel);
      if (!allowedChannels.includes(channel)) {
        auditSecurityEvent(appInstance, "commerce.channel_not_allowed", {
          category: "public_commerce",
          source: "public_commerce.resolveConnection",
          severity: "warning",
          outcome: "rejected",
          tenantId: tenant.id,
          connectionCode: profile.identity?.connection_code,
          suffix,
          reason: "CHANNEL_NOT_ALLOWED",
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null,
          metadata: { channel, allowed_channels: allowedChannels }
        });
        reply.code(403).send({ ok: false, error: "CHANNEL_NOT_ALLOWED" });
        return null;
      }
    }

    const policy = paymentWebhook ? { ok: true } : validateProductionConnectionPolicy(profile);
    if (!policy.ok) {
      auditSecurityEvent(appInstance, "commerce.production_policy_rejected", {
        category: "public_commerce",
        source: "public_commerce.resolveConnection",
        severity: "warning",
        outcome: "rejected",
        tenantId: tenant.id,
        connectionCode: profile.identity?.connection_code,
        suffix,
        reason: policy.error,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
        metadata: {
          environment: profile.identity?.environment || null,
          verification_mode: profile.verification?.mode || null
        }
      });
      reply.code(403).send({ ok: false, error: policy.error });
      return null;
    }

    const origin = req.headers.origin;
    if (!paymentWebhook && !connectionAllowsOrigin(profile, origin)) {
      auditSecurityEvent(appInstance, "commerce.origin_rejected", {
        category: "public_commerce",
        source: "public_commerce.resolveConnection",
        severity: "warning",
        outcome: "rejected",
        tenantId: tenant.id,
        connectionCode: profile.identity?.connection_code,
        suffix,
        reason: "ORIGIN_NOT_ALLOWED",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
        metadata: { origin: origin || null }
      });
      reply.code(403).send({ ok: false, error: "ORIGIN_NOT_ALLOWED" });
      return null;
    }

    if (!connectionAllowsIp(profile, req.ip)) {
      auditSecurityEvent(appInstance, "commerce.ip_rejected", {
        category: "public_commerce",
        source: "public_commerce.resolveConnection",
        severity: "warning",
        outcome: "rejected",
        tenantId: tenant.id,
        connectionCode: profile.identity?.connection_code,
        suffix,
        reason: "IP_NOT_ALLOWED",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null
      });
      reply.code(403).send({ ok: false, error: "IP_NOT_ALLOWED" });
      return null;
    }

    const quota = await enforceConnectionQuota(appInstance, {
      tenantId: tenant.id,
      category: "public_commerce",
      profile,
      connectionCode: profile.identity?.connection_code,
      suffix
    });
    if (!quota.ok) {
      auditSecurityEvent(appInstance, "commerce.quota_exceeded", {
        category: "public_commerce",
        source: "public_commerce.resolveConnection",
        severity: "warning",
        outcome: "rejected",
        tenantId: tenant.id,
        connectionCode: profile.identity?.connection_code,
        suffix,
        reason: "QUOTA_EXCEEDED",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
        metadata: quota
      });
      reply.header("Retry-After", String(quota.retry_after_sec || quota.window_sec || 3600));
      reply.code(429).send({ ok: false, error: "QUOTA_EXCEEDED" });
      return null;
    }

    const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody || "");

    // Do not enforce a single profile-level HTTP method/content-type across all
    // storefront endpoints. Public commerce includes mixed operations (GET/POST/PATCH/DELETE
    // and multipart uploads) that are already validated per route + auth checks.
    // A profile-wide method gate caused valid member actions (e.g. blog delete) to fail
    // with METHOD_NOT_ALLOWED expected POST.

    try {
      profile = await hydrateConnectionProfileSecrets(appInstance, appInstance.db, tenant.id, profile);
    } catch (error) {
      appInstance.log.error({ event: "commerce_secret_hydrate_failed", tenantId: tenant.id, connectionCode: profile.identity?.connection_code, error: error.message });
      auditSecurityEvent(appInstance, "commerce.secret_unavailable", {
        category: "public_commerce",
        source: "public_commerce.resolveConnection",
        severity: "error",
        outcome: "error",
        tenantId: tenant.id,
        connectionCode: profile.identity?.connection_code,
        suffix,
        reason: "CONNECTION_SECRET_UNAVAILABLE",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
        metadata: { error: error.message }
      });
      reply.code(500).send({ ok: false, error: "CONNECTION_SECRET_UNAVAILABLE" });
      return null;
    }

    const verify = paymentWebhook
      ? { ok: true }
      : await verifyConnectionRequest(req, profile, rawBody);
    if (!verify.ok) {
      auditSecurityEvent(appInstance, "commerce.verification_failed", {
        category: "public_commerce",
        source: "public_commerce.resolveConnection",
        severity: "warning",
        outcome: "rejected",
        tenantId: tenant.id,
        connectionCode: profile.identity?.connection_code,
        suffix,
        reason: verify.error,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
        metadata: { mode: profile.verification?.mode || null, origin: req.headers.origin || null }
      });
      reply.code(401).send({ ok: false, error: verify.error });
      return null;
    }

    applyCors(reply, origin);
    return { tenant, profile };
  }

  function requireStorefrontRead(access, reply, { capability = "public_api", scope }) {
    if (!connectionAllowsStorefrontCapability(access?.profile, capability)) {
      reply.code(403).send({ ok: false, error: "STOREFRONT_CAPABILITY_DISABLED" });
      return false;
    }
    if (!connectionAllowsStorefrontScope(access?.profile, scope)) {
      reply.code(403).send({ ok: false, error: "STOREFRONT_SCOPE_FORBIDDEN" });
      return false;
    }
    return true;
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

  function commerceIdempotencyKey(req, body, profile) {
    return (
      extractEventId(req, body, profile) ||
      normalizeText(req.headers["idempotency-key"]) ||
      normalizeText(req.headers["x-idempotency-key"]) ||
      normalizeText(body?.idempotency_key || body?.idempotencyKey || body?.event_id || body?.eventId)
    );
  }

  function commerceRequestHash(req, body, buffer = null) {
    if (Buffer.isBuffer(buffer)) return buildRequestHash(buffer);
    const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody || "");
    if (rawBody.length) return buildRequestHash(rawBody);
    return buildRequestHash(Buffer.from(JSON.stringify(body || {})));
  }

  async function beginCommerceIdempotency(req, reply, { access, body, action, requestHash = null }) {
    const key = commerceIdempotencyKey(req, body, access.profile);
    if (!key) {
      reply.code(400).send({ ok: false, error: "IDEMPOTENCY_REQUIRED" });
      return null;
    }
    const scope =
      access.profile.idempotency?.idempotency_scope ||
      `commerce.${action}.${access.profile.identity?.connection_code || "connection"}`;
    const idem = await ensureIdempotency(app.db, {
      tenantId: access.tenant.id,
      scope,
      key,
      requestHash: requestHash || commerceRequestHash(req, body)
    });
    if (!idem.ok) {
      reply.code(409).send({ ok: false, error: idem.error });
      return null;
    }
    if (idem.replay) {
      reply.send(idem.response || { ok: true, replay: true });
      return { replay: true, key, scope };
    }
    return { key, scope };
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

      const idem = await beginCommerceIdempotency(req, reply, {
        access,
        body,
        action: "member_profile"
      });
      if (!idem || idem.replay) return;

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
        const response = { ok: true, member: profile };
        await finalizeIdempotency(app.db, {
          tenantId: access.tenant.id,
          scope: idem.scope,
          key: idem.key,
          response,
          status: "ok"
        });
        return reply.send(response);
      } catch (error) {
        await client.query("ROLLBACK");
        app.log.error({ event: "member_profile_update_failed", tenantId: access.tenant.id, error: error.message });
        await finalizeIdempotency(app.db, {
          tenantId: access.tenant.id,
          scope: idem.scope,
          key: idem.key,
          response: { ok: false, error: "MEMBER_PROFILE_UPDATE_FAILED" },
          status: "error"
        });
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
        language_library_version: "storefront-public-locales-v1",
        locales: resolved.locales
          .map((code) => publicLocaleMetadata(code))
          .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
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
      return reply.send({
        ok: true,
        payment: buildPublicCheckoutConfig({
          settings: payment,
          profiles: extractProfiles(access.tenant.attrs || {})
        })
      });
    }
  );

  app.get(
    "/commerce/:suffix/storefront/connector-patch",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;
      if (!requireStorefrontRead(access, reply, { capability: "public_api", scope: "storefront.mapping.read" })) return;
      return reply.send(buildStorefrontConnectorPatch(req, access, req.params.suffix));
    }
  );

  app.get(
    "/commerce/:suffix/storefront/manifest",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;
      const capability = req.query?.integration === "loader" ? "loader" : "public_api";
      if (!requireStorefrontRead(access, reply, { capability, scope: "storefront.mapping.read" })) return;
      return reply.send(await loadPublicStorefrontManifest(app, access, req.params.suffix, capability === "loader" ? "loader" : "api"));
    }
  );

  app.get(
    "/commerce/:suffix/storefront/mapping",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;
      const capability = req.query?.integration === "loader" ? "loader" : "public_api";
      if (!requireStorefrontRead(access, reply, { capability, scope: "storefront.mapping.read" })) return;
      return reply.send(await loadPublicStorefrontManifest(app, access, req.params.suffix, capability === "loader" ? "loader" : "api"));
    }
  );

  app.get(
    "/commerce/:suffix/content",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;
      const capability = req.query?.integration === "loader" ? "loader" : "public_api";
      if (!requireStorefrontRead(access, reply, { capability, scope: "storefront.content.read" })) return;

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
              const buttons = normalizeStorefrontButtons(slide.buttons || []);
              const cta = normalizeStorefrontCta(slide);
              return {
                id: normalizeText(slide.id || `slide-${index + 1}`),
                image: image || "",
                eyebrow: normalizeText(slide.eyebrow || ""),
                title: normalizeText(slide.title || ""),
                subtitle: normalizeText(slide.subtitle || ""),
                body: normalizeText(slide.body || slide.content || ""),
                cta_label: normalizeText(slide.cta_label || slide.ctaLabel || buttons[0]?.label || ""),
                cta_url: cta.target,
                cta,
                cta_action: cta.action,
                cta_target: cta.target,
                cta_new_tab: cta.new_tab,
                buttons,
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
                slide.cta_label ||
                slide.buttons?.length
              )
            )
            .filter(Boolean)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
        : [];
      const renderer = storefrontRenderer(attrs, slot);
      const productSlot = await resolveStorefrontSlotProducts(app, access.tenant.id, attrs);

      return reply.send({
        ok: true,
        item: {
          id: row.id,
          code: row.code,
          slot,
          title: normalizeText(attrs.title || row.title || ""),
          status: row.status,
          is_active: isActive,
          renderer,
          renderer_type: renderer,
          source_mode: productSlot.source_mode,
          translation:
            attrs.translation && typeof attrs.translation === "object"
              ? attrs.translation
              : null,
          slides,
          content: {
            slides
          },
          products: productSlot.products,
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
      if (!requireStorefrontRead(access, reply, { scope: "storefront.content.read" })) return;

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
    {
      config: { rateLimit: RATE_LIMIT, cors: false },
      bodyLimit: Number(app.config.UPLOAD_MAX_BYTES || DEFAULT_MAX_UPLOAD_BYTES) + 64 * 1024,
      errorHandler: createUploadErrorHandler("member_blog_upload_request_error")
    },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
      if (!access) return;

      const member = await requireMemberSession(access, req, reply);
      if (!member) return;
      if (!requireMemberCsrf(member, req, reply)) return;

      let filename = "";
      let mimetype = "";
      let storedName = "";
      let idem = null;
      try {
        if (!req.isMultipart()) {
          return reply.code(415).send({
            ok: false,
            error: "MULTIPART_REQUIRED",
            message: "Upload requests must use multipart form data."
          });
        }

        const filePart = await resolveMultipartFilePart(req);
        if (!filePart || (!filePart.file && typeof filePart.toBuffer !== "function")) {
          return reply.code(400).send({
            ok: false,
            error: "FILE_REQUIRED",
            message: "Select an image to upload."
          });
        }

        filename = normalizeText(filePart.filename || "");
        mimetype = normalizeText(filePart.mimetype || "").toLowerCase();
        const buffer = await uploadPartToBuffer(filePart, {
          maxBytes: Number(app.config.UPLOAD_MAX_BYTES || DEFAULT_MAX_UPLOAD_BYTES)
        });
        const validation = validateImageUpload({ buffer, filename, mimetype });
        if (!validation.ok) {
          auditSecurityEvent(app, "upload.rejected", {
            category: "upload",
            source: "public_commerce.member_upload",
            severity: "warning",
            outcome: "rejected",
            tenantId: access.tenant.id,
            connectionCode: access.profile?.identity?.connection_code,
            suffix: req.params?.suffix,
            reason: validation.error,
            ip: req.ip,
            userAgent: req.headers["user-agent"] || null,
            metadata: { filename, mimetype }
          });
          return reply.code(415).send({
            ok: false,
            error: "INVALID_IMAGE",
            reason: validation.error,
            message: "The selected file is not a valid supported image."
          });
        }

        const uploadIdempotencyBody = {
          idempotency_key:
            normalizeText(req.body?.idempotency_key?.value || req.body?.idempotency_key) ||
            normalizeText(req.body?.idempotencyKey?.value || req.body?.idempotencyKey)
        };
        const requestHash = commerceRequestHash(
          req,
          uploadIdempotencyBody,
          Buffer.concat([Buffer.from(`${filename}\n${mimetype}\n`), buffer])
        );
        idem = await beginCommerceIdempotency(req, reply, {
          access,
          body: uploadIdempotencyBody,
          action: "member_upload",
          requestHash
        });
        if (!idem || idem.replay) return;

        const uploadDir = ensureUploadDirectory(
          resolveAssetRoot(app.config),
          [access.tenant.id, "blog"]
        );
        storedName = `${crypto.randomUUID()}${validation.safeExt}`;
        const targetPath = safeUploadTarget(uploadDir, storedName);
        const stored = await writeVerifiedUpload({
          app,
          targetPath,
          buffer,
          tenantId: access.tenant.id,
          storedName,
          assetKind: "media",
          category: "blog",
          filename,
          mimetype
        });
        if (!stored.ok) {
          auditSecurityEvent(app, "upload.scan_pending", {
            category: "upload",
            source: "public_commerce.member_upload",
            severity: stored.status === "blocked" ? "warning" : "info",
            outcome: "rejected",
            tenantId: access.tenant.id,
            identityId: member.profile.identity_id,
            connectionCode: access.profile?.identity?.connection_code,
            suffix: req.params?.suffix,
            reason: stored.error,
            ip: req.ip,
            userAgent: req.headers["user-agent"] || null,
            metadata: { filename, mimetype, scan_status: stored.scan_status }
          });
          await finalizeIdempotency(app.db, {
            tenantId: access.tenant.id,
            scope: idem.scope,
            key: idem.key,
            response: { ok: false, error: stored.error, scan_status: stored.scan_status },
            status: "error"
          });
          return reply.code(stored.status === "blocked" ? 415 : 202).send({
            ok: false,
            error: stored.error,
            scan_status: stored.scan_status
          });
        }
      } catch (error) {
        const failure = normalizeUploadError(error);
        if (idem && !idem.replay) {
          try {
            await finalizeIdempotency(app.db, {
              tenantId: access.tenant.id,
              scope: idem.scope,
              key: idem.key,
              response: { ok: false, error: failure.code, message: failure.message },
              status: "error"
            });
          } catch (finalizeError) {
            req.log.error({
              event: "member_blog_upload_idempotency_finalize_error",
              err: finalizeError,
              stack: finalizeError?.stack || null,
              tenantId: access.tenant.id,
              request_id: req.id
            });
          }
        }
        return sendUploadFailure(req, reply, error, {
          event: "member_blog_upload_failed",
          context: {
            tenantId: access.tenant.id,
            identityId: member.profile.identity_id,
            connectionCode: access.profile?.identity?.connection_code,
            suffix: req.params?.suffix
          }
        });
      }

      const rawUrl = `/assets/${access.tenant.id}/blog/${storedName}`;
      const signedUrl = signAssetUrl(rawUrl, app, access.tenant.id);
      const response = {
        ok: true,
        asset: {
          name: filename || storedName,
          type: mimetype,
          kind: "media",
          raw_url: rawUrl,
          url: signedUrl || rawUrl
        }
      };
      await finalizeIdempotency(app.db, {
        tenantId: access.tenant.id,
        scope: idem.scope,
        key: idem.key,
        response,
        status: "ok"
      });
      return reply.send(response);
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
      if (!requireStorefrontRead(access, reply, { scope: "storefront.catalog.read" })) return;

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

      const eventId = commerceIdempotencyKey(req, body, access.profile);
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
          const out = { ok: false, error: "MATERIAL_NOT_FOUND", material: line.material_code || line.material_id };
          await finalizeIdempotency(app.db, {
            tenantId: access.tenant.id,
            scope,
            key: eventId,
            response: out,
            status: "error"
          });
          return reply.code(404).send(out);
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

      const eventId = commerceIdempotencyKey(req, body, access.profile);
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
      if (!quote.ok) {
        await finalizeIdempotency(app.db, {
          tenantId: access.tenant.id,
          scope,
          key: eventId,
          response: quote,
          status: "error"
        });
        return reply.code(400).send(quote);
      }

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

            const checkoutPaymentMethod = normalizePaymentMethodCode(
              body.metadata?.checkout?.payment_method || body.payment_method
            );
            const initialOrderStatus = checkoutPaymentMethod ? "pending_payment" : "new";
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
              metadata: body.metadata || {},
              order_status: initialOrderStatus,
              payment_status: checkoutPaymentMethod ? "pending" : null
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
                status: initialOrderStatus,
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

  async function loadOrderPaymentSource(client, tenantId, body = {}) {
    const requestedOrderCode = normalizeText(body.order_code || body.orderCode);
    const requestedOrderId = normalizeText(body.order_id || body.orderId);
    if (!requestedOrderCode && !requestedOrderId) {
      return { ok: false, error: "checkout_source_missing", status: 409 };
    }

    const filters = ["tenant_id = $1", "object_type = 'sales_order'"];
    const params = [tenantId];
    if (requestedOrderCode) {
      params.push(requestedOrderCode);
      filters.push(`code = $${params.length}`);
    } else {
      params.push(requestedOrderId);
      filters.push(`id::text = $${params.length}`);
    }

    const r = await client.query(
      `
      SELECT id, code, attrs
      FROM eip_core.service_object
      WHERE ${filters.join(" AND ")}
      LIMIT 1
      `,
      params
    );
    if (r.rowCount === 0) return { ok: false, error: "order_not_found", status: 404 };

    const order = r.rows[0];
    const attrs = order.attrs && typeof order.attrs === "object" ? order.attrs : {};
    const pricing = attrs.pricing_snapshot && typeof attrs.pricing_snapshot === "object"
      ? attrs.pricing_snapshot
      : {};
    const amount = normalizeAmount(pricing?.totals?.total, null);
    if (amount === null || amount <= 0) {
      return { ok: false, error: "checkout_source_missing", status: 409 };
    }

    return {
      ok: true,
      order,
      amount,
      currency: normalizeText(pricing.currency || attrs.currency || body.currency || "USD").toUpperCase()
    };
  }

  const getPublicPaymentMethods = async (req, reply) => {
    const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
    if (!access) return;

    const payment = await loadCommercePaymentSettings(app, access.tenant.id);
    const methods = buildPublicPaymentMethods({
      settings: payment,
      profiles: extractProfiles(access.tenant.attrs || {})
    });

    return reply.send({
      ok: true,
      methods,
      payment: {
        methods,
        default_currency: payment.default_currency || "USD",
        capture_mode: payment.capture_mode || "automatic"
      }
    });
  };

  app.get(
    "/checkout/payment-methods",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    getPublicPaymentMethods
  );

  app.get(
    "/commerce/:suffix/checkout/payment-methods",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    getPublicPaymentMethods
  );

  const createCheckoutSession = async (req, reply) => {
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

    const eventId = commerceIdempotencyKey(req, body, access.profile);
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
      const out = { ok: false, error: "ORDER_NOT_FOUND" };
      await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response: out, status: "error" });
      return reply.code(404).send(out);
    }
    const orderId = orderRes.rows[0].id;
    const orderCode = normalizeText(orderRes.rows[0].code || requestedOrderCode);
    const amount = normalizeAmount(body.amount, null);
    if (amount === null) {
      const out = { ok: false, error: "AMOUNT_REQUIRED" };
      await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response: out, status: "error" });
      return reply.code(400).send(out);
    }

    const currency = normalizeText(body.currency || "USD").toUpperCase();
    const paymentSettings = await loadCommercePaymentSettings(app, access.tenant.id);
    const profiles = extractProfiles(access.tenant.attrs || {});
    const requestedMethod = normalizePaymentMethodCode(body.method || body.payment_method || "");
    const methodContext = resolvePaymentMethodContext({
      settings: paymentSettings,
      profiles,
      method: requestedMethod,
      providerCode: body.provider_code || body.providerCode || body.provider
    });
    if (!methodContext.ok) {
      const out = { ok: false, error: methodContext.error };
      await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response: out, status: "error" });
      return reply.code(methodContext.error === "PAYMENT_METHOD_DISABLED" ? 403 : 409).send(out);
    }

    const adapter = getPaymentAdapter(methodContext.provider_code);
    if (!adapter) {
      const out = { ok: false, error: "PAYMENT_ADAPTER_NOT_FOUND" };
      await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response: out, status: "error" });
      return reply.code(409).send(out);
    }

    let providerProfile = methodContext.profile || null;
    if (providerProfile) {
      try {
        providerProfile = await hydrateConnectionProfileSecrets(app, app.db, access.tenant.id, providerProfile);
      } catch (error) {
        app.log.error({
          event: "payment_provider_secret_hydrate_failed",
          tenantId: access.tenant.id,
          provider: methodContext.provider_code,
          error: error.message
        });
        const out = { ok: false, error: "PAYMENT_PROVIDER_SECRET_UNAVAILABLE" };
        await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response: out, status: "error" });
        return reply.code(500).send(out);
      }
    }

    const paymentCode = buildCode("PAY");
    const providerReturnUrls = buildCheckoutProviderReturnUrls(req, paymentCode);
    const providerResult = await adapter.createCheckoutSession({
      paymentCode,
      amount,
      currency,
      captureMode: paymentSettings.capture_mode,
      environment: methodContext.environment,
      method: methodContext.code,
      connectionProfile: providerProfile,
      ...providerReturnUrls,
      metadata: sanitizePaymentMetadata(body.metadata || {})
    });
    if (!providerResult.ok) {
      const out = { ok: false, error: providerResult.error };
      await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response: out, status: "error" });
      return reply.code(409).send(out);
    }

    const providerSession = providerResult.session || {};
    const client = await app.db.connect();
    let paymentRow;
    try {
      await client.query("BEGIN");
      const processStart = await startProcessFor(client, app, {
        tenantId: access.tenant.id,
        objectType: "payment",
        requireBinding: true,
        serviceObject: {
          object_type: "payment",
          status: "new",
          code: paymentCode,
          title: `Payment ${paymentCode}`,
          attrs: {
            order_id: orderId,
            order_code: orderCode,
            amount,
            currency,
            method: methodContext.code,
            provider: methodContext.provider_code,
            provider_connection_code: methodContext.profile?.identity?.connection_code || null,
            environment: normalizePaymentEnvironment(methodContext.environment),
            capture_mode: paymentSettings.capture_mode,
            payment_status: providerSession.status || "created",
            provider_session_id: providerSession.provider_session_id || null,
            provider_payment_id: providerSession.provider_payment_id || null,
            redirect_url: providerSession.redirect_url || null,
            client_action: providerSession.client_action || null,
            idempotency_key: eventId,
            metadata: sanitizePaymentMetadata(body.metadata || {})
          },
          links: [{
            src_kind: "service_object",
            src_id: "$service_object_id",
            dst_kind: "service_object",
            dst_id: orderId,
            relation_type: "PAYMENT_FOR",
            attrs: { amount, currency }
          }]
        }
      });
      if (!processStart.ok) throw new Error(processStart.error);
      paymentRow = processStart.service_object;
      await writePublicPaymentRecords(client, {
        tenantId: access.tenant.id,
        paymentId: paymentRow.id,
        paymentCode: paymentRow.code,
        orderId,
        orderCode,
        provider: methodContext.provider_code,
        method: methodContext.code,
        environment: methodContext.environment,
        amount,
        currency,
        status: providerSession.status || "created",
        eventType: "payment_created",
        source: "public_checkout",
        connectionCode: access.profile.identity?.connection_code,
        metadata: body.metadata || {}
      });
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      const out = { ok: false, error: err.message };
      await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response: out, status: "error" });
      return reply.code(500).send({ ok: false, error: "PAYMENT_CREATE_FAILED" });
    } finally {
      client.release();
    }

    const response = {
      ok: true,
      payment: toPublicPaymentSession(paymentRow),
      order_code: orderCode,
      orderCode
    };
    await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response, status: "ok" });
    return reply.send(response);
  };

  app.post(
    "/commerce/:suffix/payment",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    createCheckoutSession
  );

  app.post(
    "/commerce/:suffix/checkout/session",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    createCheckoutSession
  );

  const createPublicPaymentSession = async (req, reply) => {
    const access = await resolveConnection(app, req, reply, ["website_intake", "custom", "payments"]);
    if (!access) return;

    let body;
    try {
      body = parseJsonBody(req);
    } catch {
      return reply.code(400).send({ ok: false, error: "invalid_json" });
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "amount") ||
      Object.prototype.hasOwnProperty.call(body, "total") ||
      Object.prototype.hasOwnProperty.call(body, "payment_amount")
    ) {
      return reply.code(400).send({
        ok: false,
        error: "browser_amount_not_accepted",
        reason: "server_amount_from_order_required"
      });
    }

    const paymentSettings = await loadCommercePaymentSettings(app, access.tenant.id);
    const profiles = extractProfiles(access.tenant.attrs || {});
    const requestedMethod = normalizePaymentMethodCode(body.method || body.payment_method || "");
    const methodContext = resolvePaymentMethodContext({
      settings: paymentSettings,
      profiles,
      method: requestedMethod,
      providerCode: body.provider_code || body.providerCode || body.provider
    });
    if (!methodContext.ok) {
      const disabled = methodContext.error === "PAYMENT_METHOD_DISABLED";
      const reason = disabled
        ? "payment_method_disabled"
        : methodContext.reason || "provider_not_configured";
      return reply.code(disabled ? 403 : 409).send({
        ok: false,
        error: reason,
        method: requestedMethod || null,
        providerCode: methodContext.provider_code || null,
        mode: methodContext.environment || null
      });
    }

    const source = await loadOrderPaymentSource(app.db, access.tenant.id, body);
    if (!source.ok) return reply.code(source.status || 409).send({ ok: false, error: source.error });

    req.body = {
      ...body,
      order_id: source.order.id,
      order_code: source.order.code,
      amount: source.amount,
      currency: source.currency,
      method: methodContext.code
    };

    return createCheckoutSession(req, reply);
  };

  app.post(
    "/commerce/:suffix/checkout/payment-session",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    createPublicPaymentSession
  );

  app.post(
    "/checkout/payment-session",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    createPublicPaymentSession
  );

  const getCheckoutSessionStatus = async (req, reply) => {
    const access = await resolveConnection(app, req, reply, ["payments", "custom", "website_intake"]);
    if (!access) return;
    const payment = await loadPaymentSession(app.db, access.tenant.id, normalizeText(req.params.id));
    if (!payment) return reply.code(404).send({ ok: false, error: "PAYMENT_NOT_FOUND" });
    const attrs = payment.attrs && typeof payment.attrs === "object" ? payment.attrs : {};
    const order = await loadOrderLifecycleSummary(
      app.db,
      access.tenant.id,
      attrs.order_id,
      attrs.order_code
    );
    reply.header("Cache-Control", "no-store");
    return reply.send({
      ok: true,
      payment: toPublicPaymentSession(payment),
      order,
      status: paymentLifecycleState(attrs.payment_status || payment.status)
    });
  };

  app.get(
    "/commerce/:suffix/checkout/payment-session/:id",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    getCheckoutSessionStatus
  );

  app.get(
    "/commerce/:suffix/checkout/session/:id",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    getCheckoutSessionStatus
  );

  app.post(
    "/commerce/:suffix/checkout/confirm",
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

      const paymentRef = normalizeText(body.payment_id || body.payment_code || body.session_id);
      if (!paymentRef) return reply.code(400).send({ ok: false, error: "PAYMENT_REFERENCE_REQUIRED" });
      const eventId = commerceIdempotencyKey(req, body, access.profile);
      if (!eventId) return reply.code(400).send({ ok: false, error: "IDEMPOTENCY_REQUIRED" });
      const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody || "");
      const scope = `commerce.payment.confirm.${access.profile.identity?.connection_code}`;
      const idem = await ensureIdempotency(app.db, {
        tenantId: access.tenant.id,
        scope,
        key: eventId,
        requestHash: buildRequestHash(rawBody)
      });
      if (!idem.ok) return reply.code(409).send({ ok: false, error: idem.error });
      if (idem.replay) return reply.send(idem.response || { ok: true, replay: true });

      const payment = await loadPaymentSession(app.db, access.tenant.id, paymentRef);
      if (!payment) return reply.code(404).send({ ok: false, error: "PAYMENT_NOT_FOUND" });
      const attrs = payment.attrs && typeof payment.attrs === "object" ? payment.attrs : {};
      const existingStatus = normalizeText(attrs.payment_status || payment.status).toLowerCase();
      if (isVerifiedPaidStatus(existingStatus) || (existingStatus === "authorized" && attrs.capture_mode === "manual")) {
        const order = await loadOrderLifecycleSummary(app.db, access.tenant.id, attrs.order_id, attrs.order_code);
        const response = {
          ok: true,
          already_completed: true,
          payment: toPublicPaymentSession(payment),
          order
        };
        await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response, status: "ok" });
        return reply.send(response);
      }
      const adapter = getPaymentAdapter(attrs.provider);
      if (!adapter) return reply.code(409).send({ ok: false, error: "PAYMENT_ADAPTER_NOT_FOUND" });
      const requestedProviderSessionId = normalizeText(body.provider_session_id || body.providerSessionId || body.token);
      const storedProviderSessionId = normalizeText(attrs.provider_session_id);
      if (requestedProviderSessionId && storedProviderSessionId && requestedProviderSessionId !== storedProviderSessionId) {
        return reply.code(409).send({ ok: false, error: "PAYMENT_PROVIDER_SESSION_MISMATCH" });
      }

      const profiles = extractProfiles(access.tenant.attrs || {});
      const configuredConnectionCode = normalizeText(attrs.provider_connection_code);
      let providerProfile = profiles.find((profile) =>
        configuredConnectionCode && normalizeText(profile?.identity?.connection_code) === configuredConnectionCode
      );
      if (!providerProfile) {
        providerProfile = profiles.find((profile) => profileProviderCode(profile) === normalizePaymentProviderCode(attrs.provider));
      }
      if (providerProfile) {
        try {
          providerProfile = await hydrateConnectionProfileSecrets(app, app.db, access.tenant.id, providerProfile);
        } catch (error) {
          app.log.error({
            event: "payment_provider_secret_hydrate_failed",
            tenantId: access.tenant.id,
            provider: attrs.provider,
            error: error.message
          });
          return reply.code(500).send({ ok: false, error: "PAYMENT_PROVIDER_SECRET_UNAVAILABLE" });
        }
      }
      const providerResult = await adapter.confirmCheckoutSession({
        environment: normalizePaymentEnvironment(attrs.environment),
        status: attrs.payment_status,
        captureMode: attrs.capture_mode,
        paymentCode: payment.code,
        providerSessionId: storedProviderSessionId,
        connectionProfile: providerProfile,
        metadata: sanitizePaymentMetadata(body.metadata || {})
      });
      if (!providerResult.ok) {
        const failureClient = await app.db.connect();
        try {
          await failureClient.query("BEGIN");
          await applyVerifiedPaymentLifecycle(failureClient, {
            tenantId: access.tenant.id,
            payment,
            event: {
              provider_code: attrs.provider,
              provider_session_id: storedProviderSessionId,
              provider_event_id: eventId,
              event_type: "payment_failed",
              status: "failed",
              safe_reason: providerResult.error
            },
            source: "public_checkout_confirm",
            connectionCode: access.profile.identity?.connection_code,
            metadata: body.metadata || {}
          });
          await failureClient.query("COMMIT");
        } catch {
          await failureClient.query("ROLLBACK");
        } finally {
          failureClient.release();
        }
        const out = { ok: false, error: providerResult.error };
        await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response: out, status: "error" });
        return reply.code(409).send(out);
      }

      const captureMode = attrs.capture_mode === "manual" ? "manual" : "automatic";
      const paymentStatus = captureMode === "automatic" ? "paid" : "authorized";
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        await applyVerifiedPaymentLifecycle(client, {
          tenantId: access.tenant.id,
          payment,
          event: {
            ...(providerResult.event || {}),
            event_type: paymentStatus === "paid" ? "payment_paid" : "payment_authorized",
            status: paymentStatus
          },
          source: "public_checkout_confirm",
          connectionCode: access.profile.identity?.connection_code,
          metadata: body.metadata || {}
        });
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        const out = { ok: false, error: err.message };
        await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response: out, status: "error" });
        return reply.code(409).send(out);
      } finally {
        client.release();
      }

      const processClient = await app.db.connect();
      try {
        await processClient.query("BEGIN");
        const process = await ensureProcessInstanceForObject(processClient, app, {
          tenantId: access.tenant.id,
          objectType: "payment",
          serviceObjectId: payment.id,
          requireBinding: true
        });
        if (!process.ok || !process.instance) throw new Error(process.error || "PROCESS_INSTANCE_REQUIRED");
        const authorize = await app.coreProcess.advanceInstance(processClient, {
          tenantId: access.tenant.id,
          instanceId: process.instance.id,
          action: "PAYMENT_AUTHORIZE",
          payload: { provider_event_id: providerResult.event?.provider_event_id || null },
          idempotencyKey: `${eventId}:authorize`
        });
        if (!authorize.ok) throw new Error(authorize.error);
        if (captureMode === "automatic") {
          const capture = await app.coreProcess.advanceInstance(processClient, {
            tenantId: access.tenant.id,
            instanceId: process.instance.id,
            action: "PAYMENT_CAPTURE",
            payload: { provider_event_id: providerResult.event?.provider_event_id || null },
            idempotencyKey: `${eventId}:capture`
          });
          if (!capture.ok) throw new Error(capture.error);
        }
        await processClient.query("COMMIT");
      } catch (error) {
        await processClient.query("ROLLBACK");
        app.log.warn({
          event: "payment_process_sync_deferred",
          tenantId: access.tenant.id,
          paymentCode: payment.code,
          error: error.message
        });
      } finally {
        processClient.release();
      }

      const updated = await loadPaymentSession(app.db, access.tenant.id, payment.id);
      const updatedAttrs = updated?.attrs && typeof updated.attrs === "object" ? updated.attrs : {};
      const order = await loadOrderLifecycleSummary(app.db, access.tenant.id, updatedAttrs.order_id, updatedAttrs.order_code);
      const response = { ok: true, payment: toPublicPaymentSession(updated), order };
      await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response, status: "ok" });
      return reply.send(response);
    }
  );

  app.post(
    "/commerce/:suffix/checkout/payment-session/:id/cancel",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => {
      const access = await resolveConnection(app, req, reply, ["payments", "custom", "website_intake"]);
      if (!access) return;
      let body = {};
      try {
        body = parseJsonBody(req);
      } catch {
        return reply.code(400).send({ ok: false, error: "INVALID_JSON" });
      }
      const paymentRef = normalizeText(req.params.id);
      const eventId = commerceIdempotencyKey(req, body, access.profile);
      if (!eventId) return reply.code(400).send({ ok: false, error: "IDEMPOTENCY_REQUIRED" });
      const scope = `commerce.payment.cancel.${access.profile.identity?.connection_code}`;
      const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody || "");
      const idem = await ensureIdempotency(app.db, {
        tenantId: access.tenant.id,
        scope,
        key: eventId,
        requestHash: buildRequestHash(rawBody)
      });
      if (!idem.ok) return reply.code(409).send({ ok: false, error: idem.error });
      if (idem.replay) return reply.send(idem.response || { ok: true, replay: true });
      const payment = await loadPaymentSession(app.db, access.tenant.id, paymentRef);
      if (!payment) return reply.code(404).send({ ok: false, error: "PAYMENT_NOT_FOUND" });
      const attrs = payment.attrs && typeof payment.attrs === "object" ? payment.attrs : {};
      if (isVerifiedPaidStatus(attrs.payment_status || payment.status)) {
        return reply.code(409).send({ ok: false, error: "PAYMENT_ALREADY_COMPLETED" });
      }
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        await applyVerifiedPaymentLifecycle(client, {
          tenantId: access.tenant.id,
          payment,
          event: {
            provider_code: attrs.provider,
            provider_session_id: attrs.provider_session_id,
            provider_event_id: eventId,
            event_type: "payment_cancelled",
            status: "cancelled",
            safe_reason: "customer_cancelled"
          },
          source: "public_checkout_cancel",
          connectionCode: access.profile.identity?.connection_code,
          metadata: { return_flow: body.return_flow || "paypal" }
        });
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: "PAYMENT_CANCEL_FAILED" });
      } finally {
        client.release();
      }
      const updated = await loadPaymentSession(app.db, access.tenant.id, payment.id);
      const updatedAttrs = updated?.attrs && typeof updated.attrs === "object" ? updated.attrs : {};
      const order = await loadOrderLifecycleSummary(app.db, access.tenant.id, updatedAttrs.order_id, updatedAttrs.order_code);
      const response = { ok: true, payment: toPublicPaymentSession(updated), order };
      await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response, status: "ok" });
      return reply.send(response);
    }
  );

  function paymentWebhookEventId(provider, body = {}, req = {}) {
    return normalizeText(
      req.headers?.["paypal-transmission-id"] ||
        req.headers?.["cko-request-id"] ||
        req.headers?.["checkout-event-id"] ||
        body.id ||
        body.event_id ||
        body.eventId ||
        body.resource?.id ||
        body.data?.id ||
        `${provider}:${sha256Hex(JSON.stringify(sanitizePaymentMetadata(body || {}))).slice(0, 24)}`
    );
  }

  const handlePaymentWebhook = async (req, reply, allowedChannels = ["payments", "custom"]) => {
    const access = await resolveConnection(app, req, reply, allowedChannels, { paymentWebhook: true });
    if (!access) return;
    if (access.profile?.inbound?.webhook_enabled !== true) {
      return reply.code(404).send({ ok: false, error: "PAYMENT_WEBHOOK_DISABLED" });
    }
    const provider = normalizePaymentProviderCode(req.params.provider);
    const adapter = getPaymentAdapter(provider);
    const registeredProvider = normalizePaymentProviderCode(
      access.profile?.routing?.provider_code ||
      access.profile?.routing?.protocol ||
      access.profile?.identity?.connection_kind
    );
    if (!adapter || (registeredProvider && registeredProvider !== provider)) {
      return reply.code(404).send({ ok: false, error: "PAYMENT_PROVIDER_NOT_SUPPORTED" });
    }
    let body;
    try {
      body = parseJsonBody(req);
    } catch {
      return reply.code(400).send({ ok: false, error: "INVALID_JSON" });
    }
    const verification = await adapter.verifyWebhookSignature({
      headers: req.headers,
      body,
      rawBody: req.rawBody,
      connectionProfile: access.profile
    });
    if (!verification.ok) {
      await app.db.query(
        `
        INSERT INTO eip_core.info_record (tenant_id, record_type, title, payload)
        VALUES ($1, 'ECOM_PAYMENT_WEBHOOK', $2, $3::jsonb)
        `,
        [
          access.tenant.id,
          `payment.webhook.${provider}.rejected`,
          JSON.stringify(sanitizePaymentMetadata({
            provider,
            event_type: "webhook_failed_verification",
            connection_code: access.profile.identity?.connection_code,
            error: verification.error
          }))
        ]
      );
      const status = String(verification.error || "").includes("NOT_CONFIGURED") ? 501 : 401;
      return reply.code(status).send({ ok: false, error: verification.error });
    }

    const eventId = paymentWebhookEventId(provider, body, req);
    const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody || "");
    const scope = `commerce.payment.webhook.${provider}.${access.profile.identity?.connection_code}`;
    const idem = await ensureIdempotency(app.db, {
      tenantId: access.tenant.id,
      scope,
      key: eventId,
      requestHash: buildRequestHash(rawBody)
    });
    if (!idem.ok) return reply.code(409).send({ ok: false, error: idem.error });
    if (idem.replay) return reply.send(idem.response || { ok: true, replay: true });

    const normalized = await adapter.normalizeWebhookEvent({ headers: req.headers, body });
    if (!normalized.ok) {
      const out = { ok: false, error: normalized.error };
      await app.db.query(
        `
        INSERT INTO eip_core.info_record (tenant_id, record_type, title, payload)
        VALUES ($1, 'ECOM_PAYMENT_WEBHOOK', $2, $3::jsonb)
        `,
        [
          access.tenant.id,
          `payment.webhook.${provider}.${eventId}.unmapped`,
          JSON.stringify(sanitizePaymentMetadata({
            provider,
            event_id: eventId,
            event_type: "webhook_not_normalized",
            connection_code: access.profile.identity?.connection_code,
            error: normalized.error
          }))
        ]
      );
      await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response: out, status: "error" });
      return reply.code(501).send(out);
    }

    const event = normalized.event || {};
    const client = await app.db.connect();
    let payment = null;
    try {
      await client.query("BEGIN");
      payment = await loadPaymentForProviderEvent(client, access.tenant.id, provider, event);
      if (payment) {
        await applyVerifiedPaymentLifecycle(client, {
          tenantId: access.tenant.id,
          payment,
          event,
          source: "provider_webhook",
          connectionCode: access.profile.identity?.connection_code,
          metadata: { webhook_event_id: event.provider_event_id || eventId }
        });
      }
      await client.query(
        `
        INSERT INTO eip_core.info_record (tenant_id, record_type, title, payload)
        VALUES ($1, 'ECOM_PAYMENT_WEBHOOK', $2, $3::jsonb)
        `,
        [
          access.tenant.id,
          `payment.webhook.${provider}.${event.provider_event_id || eventId}`,
          JSON.stringify(sanitizePaymentMetadata({
            provider,
            event_id: event.provider_event_id || eventId,
            event_type: event.event_type || "payment_webhook",
            status: event.status || null,
            matched_payment: payment?.code || null,
            connection_code: access.profile.identity?.connection_code,
            payload: event
          }))
        ]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      const out = { ok: false, error: "PAYMENT_WEBHOOK_APPLY_FAILED" };
      await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response: out, status: "error" });
      return reply.code(409).send(out);
    } finally {
      client.release();
    }
    const out = {
      ok: true,
      accepted: true,
      matched: Boolean(payment),
      event_id: event.provider_event_id || eventId
    };
    await finalizeIdempotency(app.db, { tenantId: access.tenant.id, scope, key: eventId, response: out, status: "ok" });
    return reply.send(out);
  };

  app.post(
    "/commerce/:suffix/payments/:provider/webhook",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => handlePaymentWebhook(req, reply, ["payments", "custom"])
  );

  app.post(
    "/payments/webhooks/:provider",
    { config: { rateLimit: RATE_LIMIT, cors: false }, bodyLimit: MAX_BODY },
    async (req, reply) => handlePaymentWebhook(req, reply, ["website_intake", "custom", "payments"])
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

export {
  buildStorefrontConnectorPatch,
  loadPublicStorefrontManifest,
  normalizePublicMapping,
  storefrontLoaderScript
};
