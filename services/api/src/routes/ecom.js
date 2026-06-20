// services/api/src/routes/ecom.js
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { hasPermission } from "../auth/perm.js";
import { sha256Hex } from "../auth/crypto.js";
import { buildSignedAssetUrl } from "../services/assets/signing.js";
import { ensureUploadDirectory, resolveAssetRoot } from "../services/assets/root.js";
import { sanitizeMediaForStorage } from "../services/assets/url_policy.js";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  createUploadErrorHandler,
  safeUploadTarget,
  sendUploadFailure,
  uploadPartToBuffer,
  validateEcomUpload,
  writeVerifiedUpload
} from "../lib/uploadSecurity.js";
import { extractProfiles } from "../services/gateway/connectionProfile.js";
import { assertOutboundUrlAllowed, fetchWithTimeout } from "../services/gateway/outbound.js";
import {
  buildRenderedDomScannerDiagnostic,
  renderStorefrontDom
} from "../services/storefront/renderedDomScanner.js";
import {
  buildMappingProfile,
  isLikelyClientRenderedShell,
  mappingProfileZones,
  mergeScanCandidates,
  scanGenericStorefrontHtml,
  taggedZoneToCandidate,
  updateMappingCandidate
} from "../lib/storefrontStructureScanner.js";
import {
  resolveTranslationRuntime,
  checkTranslationServiceAvailability,
  translateTextsThroughProvider,
  normalizeProviderError
} from "../services/translation/providerClient.js";
import { auditSecurityEvent } from "../lib/securityAudit.js";

const MAX_LIMIT = 200;
const MATERIAL_TYPE = "PRODUCT";
const PRODUCT_OBJECT_TYPE = "product";
const STOREFRONT_CONTENT_OBJECT_TYPE = "storefront_content";
const STOREFRONT_STRUCTURE_OBJECT_TYPE = "storefront_structure";
const STOREFRONT_STRUCTURE_SCOPE = "auto_scan";
const STOREFRONT_CONTENT_MODEL_SINGLETON = "singleton";
const STOREFRONT_CONTENT_MODEL_ARTICLE = "article";
const STOREFRONT_CONTENT_CATEGORY_LIST_CODE = "STOREFRONT_CONTENT_CATEGORY";
const STOREFRONT_CONTENT_CATEGORY_LIST_MODULE = "ecom";
const STOREFRONT_CONTENT_STUDIO_TAB_LIST_CODE = "STOREFRONT_CONTENT_STUDIO_TAB";
const VARIANT_HEADER_LIST_CODE = "ECOM_VARIANT_HEADER";
const VARIANT_HEADER_LIST_MODULE = "ecom";
const STOREFRONT_CONTENT_STUDIO_TAB_DEFAULTS = [
  { code: "BLOCKS", label: "Storefront blocks", sort_order: 10, tab_mode: "blocks" },
  { code: "BLOG", label: "Blog posts", sort_order: 20, tab_mode: "blog" },
  { code: "PAGES", label: "Page articles", sort_order: 30, tab_mode: "pages" }
];
const PRODUCT_CATEGORY_LIST_CODE = "ECOM_PRODUCT_CATEGORY";
const PRODUCT_CATEGORY_LIST_MODULE = "ecom";
const COMMERCIAL_CONDITION_FIELD_LIST_CODE = "ECOM_COMMERCIAL_CONDITION_FIELD";
const COMMERCIAL_CONDITION_FIELD_LIST_MODULE = "ecom";
const DEFAULT_COMMERCIAL_CONDITION_FIELDS = [
  {
    code: "payment_terms_code",
    label: "Payment terms code",
    sort_order: 10,
    attrs: {
      data_type: "text",
      effect_path: "payment_terms.payment_terms_code",
      allowed_condition_types: ["PAYMENT_TERM_CONDITION", "PAYMENT_TERMS", "TRADE_TERMS"],
      condition_category: "FINANCE"
    }
  },
  {
    code: "payment_due_days",
    label: "Payment due days",
    sort_order: 20,
    attrs: {
      data_type: "integer",
      unit: "days",
      effect_path: "payment_terms.payment_due_days",
      allowed_condition_types: ["PAYMENT_TERM_CONDITION", "PAYMENT_TERMS", "TRADE_TERMS"],
      condition_category: "FINANCE"
    }
  },
  {
    code: "credit_limit_days",
    label: "Credit limit days",
    sort_order: 30,
    attrs: {
      data_type: "integer",
      unit: "days",
      effect_path: "payment_terms.credit_limit_days",
      allowed_condition_types: ["PAYMENT_TERM_CONDITION", "PAYMENT_TERMS", "TRADE_TERMS"],
      condition_category: "FINANCE"
    }
  },
  {
    code: "credit_limit_amount",
    label: "Credit limit amount",
    sort_order: 40,
    attrs: {
      data_type: "number",
      unit: "amount",
      effect_path: "payment_terms.credit_limit_amount",
      allowed_condition_types: ["PAYMENT_TERM_CONDITION", "PAYMENT_TERMS", "TRADE_TERMS"],
      condition_category: "FINANCE"
    }
  },
  {
    code: "credit_available",
    label: "Credit available",
    sort_order: 50,
    attrs: {
      data_type: "boolean",
      effect_path: "payment_terms.credit_available",
      allowed_condition_types: ["PAYMENT_TERM_CONDITION", "PAYMENT_TERMS", "TRADE_TERMS"],
      condition_category: "FINANCE"
    }
  },
  {
    code: "minimum_order_qty",
    label: "Minimum order quantity",
    sort_order: 60,
    attrs: {
      data_type: "number",
      unit: "qty",
      effect_path: "supplier_purchase.minimum_order_qty",
      allowed_condition_types: ["SUPPLIER_PURCHASE_CONDITION", "MATERIAL_SUPPLIER_CONDITION", "TRADE_TERMS"],
      condition_category: "PURCHASING"
    }
  },
  {
    code: "approval_threshold_value",
    label: "Approval threshold value",
    sort_order: 70,
    attrs: {
      data_type: "number",
      unit: "amount",
      effect_path: "procurement_policy.approval_threshold_value",
      allowed_condition_types: ["PROCUREMENT_POLICY", "TRADE_TERMS"],
      condition_category: "PURCHASING"
    }
  },
  {
    code: "cash_purchase_limit_value",
    label: "Cash purchase limit value",
    sort_order: 80,
    attrs: {
      data_type: "number",
      unit: "amount",
      effect_path: "cash_purchase_policy.cash_purchase_limit_value",
      allowed_condition_types: ["CASH_PURCHASE_CONDITION", "TRADE_TERMS"],
      condition_category: "PURCHASING"
    }
  },
  {
    code: "reorder_point_qty",
    label: "Reorder point quantity",
    sort_order: 90,
    attrs: {
      data_type: "number",
      unit: "qty",
      effect_path: "reorder_policy.reorder_point_qty",
      allowed_condition_types: ["INVENTORY_REORDER_POLICY", "TRADE_TERMS"],
      condition_category: "INVENTORY"
    }
  },
  {
    code: "discount_percent",
    label: "Discount percent",
    sort_order: 100,
    attrs: {
      data_type: "number",
      unit: "percent",
      effect_path: "discount.percent",
      allowed_condition_types: ["DISCOUNT", "TRADE_TERMS"],
      condition_category: "PRICING"
    }
  }
];
const STOREFRONT_CTA_ACTIONS = new Set([
  "navigate_internal",
  "navigate_external",
  "scroll_to"
]);
const PRODUCT_REVIEW_OBJECT_TYPE = "product_review";
const BLOG_POST_OBJECT_TYPE = "blog_post";
const REVIEW_STATUS_VALUES = new Set(["approved", "pending_review", "rejected", "hidden", "published", "visible"]);
const STOREFRONT_CONTENT_ACTIONS = new Set(["INTAKE", "DRAFT_READY", "APPROVE", "PUBLISH", "REJECT", "CANCEL"]);
const DOCUMENT_ALLOWED_MIME = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/octet-stream",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/json",
  "model/gltf-binary",
  "model/gltf+json"
]);
const DOCUMENT_ALLOWED_EXT = new Set([
  ".pdf",
  ".zip",
  ".7z",
  ".rar",
  ".zprj",
  ".zpac",
  ".clo",
  ".dxf",
  ".dwg",
  ".txt",
  ".csv",
  ".json",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx"
]);
const STRUCTURE_SCAN_MANIFEST_PATHS = [
  "/.well-known/eip-structure.json",
  "/eip-structure.json",
  "/eip/structure.json"
];
const STRUCTURE_SCAN_TIMEOUT_MS = 9000;
const STRUCTURE_SCAN_MAX_MODULES = 120;
const STRUCTURE_SCAN_MAX_DEPTH = 6;
const STRUCTURE_PARENT_PATTERNS = [
  /data-eip-parent\s*=\s*["']([^"']+)["']/gi,
  /["']data-eip-parent["']\s*:\s*["']([^"']+)["']/gi,
  /data-eip-parent\\?["']\s*[:=]\s*\\?["']([^"'\\]+)\\?["']/gi
];
const STRUCTURE_PAGE_PATTERNS = [
  /data-eip-page\s*=\s*["']([^"']+)["']/gi,
  /["']data-eip-page["']\s*:\s*["']([^"']+)["']/gi,
  /data-eip-page\\?["']\s*[:=]\s*\\?["']([^"'\\]+)\\?["']/gi
];
const STRUCTURE_SCRIPT_SRC_REGEX = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
const STRUCTURE_LINK_MODULE_REGEX = /<link[^>]+rel=["'][^"']*modulepreload[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
const STRUCTURE_IMPORT_FROM_REGEX = /\b(?:import|export)\s+[^"'`]*?\sfrom\s+["']([^"']+)["']/gi;
const STRUCTURE_IMPORT_SIDE_EFFECT_REGEX = /\bimport\s+["']([^"']+)["']/gi;
const STRUCTURE_DYNAMIC_IMPORT_REGEX = /import\s*\(\s*["']([^"']+)["']\s*\)/gi;
const COMMERCE_SETTINGS_MODULE = "ecom";
const COMMERCE_SETTINGS_CODE = "commerce";
const PRODUCT_TRANSLATABLE_PATHS = [
  "content.title",
  "content.name",
  "content.subtitle",
  "content.summary",
  "content.description",
  "content.hero_title",
  "content.hero_subtitle",
  "content.kicker",
  "content.tagline",
  "storefront.hero.kicker",
  "storefront.hero.title",
  "storefront.hero.subtitle"
];
const STOREFRONT_CONTENT_TRANSLATABLE_FIELDS = [
  "title",
  "eyebrow",
  "subtitle",
  "body",
  "excerpt",
  "cta_label"
];
const TRANSLATION_CONNECTED_MESSAGE = "Translation service connected.";
const TRANSLATION_OFFLINE_MESSAGE = "Translation service offline.";
const TRANSLATION_PUBLISH_CONFIRM_MESSAGE = "Translation service offline. Do you want to publish in English only?";
const TRANSLATION_PUBLISH_SUCCESS_MESSAGE = "Published successfully with translation.";
const TRANSLATION_PUBLISH_ENGLISH_ONLY_MESSAGE = "Published successfully in English only.";
const TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION = "published_with_translation";
const TRANSLATION_PUBLISH_STATE_CONFIRM_REQUIRED = "translation_unavailable_confirmation_required";
const TRANSLATION_PUBLISH_STATE_ENGLISH_ONLY = "published_english_only";
const TRANSLATION_REPUBLISH_REQUIRED_CODE = "TRANSLATION_REPUBLISH_REQUIRED";
const VARIANT_RESERVED_KEYS = new Set(["id", "active", "stock_qty", "price_delta", "hasData"]);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value) {
  const trimmed = normalizeText(value);
  return trimmed.length ? trimmed : null;
}

function normalizeCommercialConditionCode(value, fallbackPrefix = "COMM_COND") {
  const normalized = normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  if (normalized) return normalized;
  return `${fallbackPrefix}_${Date.now().toString(36).toUpperCase()}`;
}

function normalizeCommercialConditionType(value) {
  return normalizeCommercialConditionCode(value || "TRADE_TERMS", "TRADE_TERMS").slice(0, 80);
}

function normalizeCommercialConditionFieldCode(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function commercialConditionFieldLabelFromCode(codeValue) {
  const code = normalizeCommercialConditionFieldCode(codeValue);
  if (!code) return "";
  return code
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function normalizeCommercialConditionFieldLabel(value, fallbackCode = "") {
  const label = normalizeOptionalText(value);
  if (label) return label.slice(0, 120);
  return commercialConditionFieldLabelFromCode(fallbackCode).slice(0, 120);
}

function safeJsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getNestedValue(obj, pathValue) {
  const parts = normalizeText(pathValue).split(".").filter(Boolean);
  if (!parts.length) return undefined;
  let cursor = obj;
  for (const part of parts) {
    if (!cursor || typeof cursor !== "object" || !Object.prototype.hasOwnProperty.call(cursor, part)) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

function setNestedCommercialEffectValue(target, pathValue, value) {
  const parts = normalizeText(pathValue).split(".").filter(Boolean);
  if (!parts.length) return target;
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!cursor[part] || typeof cursor[part] !== "object" || Array.isArray(cursor[part])) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
  return target;
}

function normalizeCommercialFieldValue(value, field = {}) {
  const type = normalizeText(field.data_type || field.attrs?.data_type || "text").toLowerCase();
  if (value === null || value === undefined || value === "") return { ok: false, empty: true };
  if (type === "boolean") {
    if (typeof value === "boolean") return { ok: true, value };
    const normalized = normalizeText(value).toLowerCase();
    if (["true", "yes", "y", "1", "enabled", "active"].includes(normalized)) return { ok: true, value: true };
    if (["false", "no", "n", "0", "disabled", "inactive"].includes(normalized)) return { ok: true, value: false };
    return { ok: false, error: "INVALID_BOOLEAN_VALUE" };
  }
  if (type === "number" || type === "integer") {
    const n = Number(value);
    if (!Number.isFinite(n)) return { ok: false, error: "INVALID_NUMBER_VALUE" };
    return { ok: true, value: type === "integer" ? Math.round(n) : n };
  }
  if (type === "date") {
    const raw = normalizeText(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { ok: false, error: "INVALID_DATE_VALUE" };
    return { ok: true, value: raw };
  }
  const text = normalizeOptionalText(value);
  if (!text) return { ok: false, empty: true };
  return { ok: true, value: text.slice(0, 500) };
}

function mapCommercialConditionFieldRow(row) {
  const attrs = safeJsonObject(row?.attrs);
  const code = normalizeCommercialConditionFieldCode(row?.code);
  if (!code) return null;
  const effectPath =
    normalizeOptionalText(attrs.effect_path) ||
    `custom.${code}`;
  const dataType = normalizeText(attrs.data_type || "text").toLowerCase();
  return {
    code,
    label: normalizeCommercialConditionFieldLabel(row?.label, code) || code,
    sort_order: Number(row?.sort_order || 0),
    is_active: row?.is_active !== false,
    data_type: ["text", "number", "integer", "boolean", "date"].includes(dataType) ? dataType : "text",
    unit: normalizeOptionalText(attrs.unit),
    effect_path: effectPath,
    condition_category: normalizeOptionalText(attrs.condition_category),
    allowed_condition_types: Array.isArray(attrs.allowed_condition_types)
      ? attrs.allowed_condition_types.map(normalizeCommercialConditionType).filter(Boolean)
      : [],
    attrs
  };
}

function buildCommercialConditionStructuredValues(effect = {}, attrs = {}, fieldCatalog = []) {
  const stored = Array.isArray(attrs.structured_values) ? attrs.structured_values : [];
  const byCode = new Map(stored.map((item) => [normalizeCommercialConditionFieldCode(item?.field_code || item?.code), item]));
  const values = [];
  for (const field of fieldCatalog || []) {
    const fromEffect = getNestedValue(effect, field.effect_path);
    const storedValue = byCode.get(field.code);
    const value = fromEffect !== undefined ? fromEffect : storedValue?.value;
    if (value === undefined || value === null || value === "") continue;
    values.push({
      field_code: field.code,
      label: field.label,
      value,
      data_type: field.data_type,
      unit: field.unit || null,
      effect_path: field.effect_path
    });
  }
  for (const item of stored) {
    const code = normalizeCommercialConditionFieldCode(item?.field_code || item?.code);
    if (!code || values.some((entry) => entry.field_code === code)) continue;
    values.push({
      field_code: code,
      label: normalizeCommercialConditionFieldLabel(item?.label, code),
      value: item?.value,
      data_type: normalizeText(item?.data_type || "text").toLowerCase(),
      unit: normalizeOptionalText(item?.unit),
      effect_path: normalizeOptionalText(item?.effect_path) || `custom.${code}`
    });
  }
  return values;
}

function applyCommercialStructuredValues(effectInput = {}, structuredValues = [], fieldCatalog = []) {
  const fieldMap = new Map((fieldCatalog || []).map((field) => [field.code, field]));
  const effect = JSON.parse(JSON.stringify(safeJsonObject(effectInput)));
  const normalized = [];
  for (const entry of Array.isArray(structuredValues) ? structuredValues : []) {
    const fieldCode = normalizeCommercialConditionFieldCode(entry?.field_code || entry?.code);
    if (!fieldCode) continue;
    const field = fieldMap.get(fieldCode);
    if (!field) return { ok: false, error: "COMMERCIAL_FIELD_NOT_FOUND", field_code: fieldCode };
    const parsed = normalizeCommercialFieldValue(entry?.value, field);
    if (parsed.empty) continue;
    if (!parsed.ok) return { ok: false, error: parsed.error, field_code: fieldCode };
    setNestedCommercialEffectValue(effect, field.effect_path, parsed.value);
    normalized.push({
      field_code: field.code,
      label: field.label,
      value: parsed.value,
      data_type: field.data_type,
      unit: field.unit || null,
      effect_path: field.effect_path
    });
  }
  return { ok: true, effect, structured_values: normalized };
}

function mapCommercialConditionRow(row, fieldCatalog = []) {
  const attrs = safeJsonObject(row?.attrs);
  const scope = safeJsonObject(row?.scope);
  const effect = safeJsonObject(row?.effect);
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    condition_type: row.condition_type,
    condition_category: row.condition_category,
    priority: row.priority,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    is_active: row.is_active,
    scope,
    effect,
    attrs,
    structured_values: buildCommercialConditionStructuredValues(effect, attrs, fieldCatalog),
    summary: normalizeOptionalText(attrs.summary || effect.summary || row.label),
    status: row.is_active === false ? "inactive" : "active",
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function generateCommercialConditionCode(client, tenantId, seed = "") {
  const base = normalizeCommercialConditionCode(seed || "COMM_COND");
  for (let i = 0; i < 20; i += 1) {
    const candidate = i === 0 ? base : `${base}_${i + 1}`;
    // eslint-disable-next-line no-await-in-loop
    const r = await client.query(
      `SELECT 1 FROM eip_core.commercial_condition WHERE tenant_id=$1 AND code=$2 LIMIT 1`,
      [tenantId, candidate]
    );
    if (r.rowCount === 0) return candidate;
  }
  return `${base}_${Date.now().toString(36).toUpperCase()}`;
}

async function resolveProductForCondition(client, tenantId, productId = null, productCode = null) {
  const id = normalizeOptionalText(productId);
  const code = normalizeOptionalText(productCode);
  if (!id && !code) return null;
  const params = [tenantId, MATERIAL_TYPE];
  const filters = ["tenant_id=$1", "material_type=$2"];
  if (id) {
    params.push(id);
    filters.push(`id=$${params.length}`);
  } else {
    params.push(code);
    filters.push(`code=$${params.length}`);
  }
  const r = await client.query(
    `
    SELECT id, code, name AS title
    FROM eip_core.material
    WHERE ${filters.join(" AND ")}
    LIMIT 1
    `,
    params
  );
  return r.rows[0] || null;
}

async function loadCommercialConditionsForProducts(client, tenantId, products = []) {
  const productRows = (products || []).filter(Boolean);
  if (!productRows.length) return new Map();
  const ids = productRows.map((row) => String(row.id || "")).filter(Boolean);
  const codes = productRows.map((row) => String(row.code || "")).filter(Boolean);
  if (!ids.length && !codes.length) return new Map();
  const [r, fieldCatalog] = await Promise.all([
    client.query(
    `
    SELECT *
    FROM eip_core.commercial_condition
    WHERE tenant_id=$1
      AND (
        scope->>'material_id' = ANY($2::text[])
        OR scope->>'material_code' = ANY($3::text[])
        OR scope->>'product_id' = ANY($2::text[])
        OR scope->>'product_code' = ANY($3::text[])
      )
    ORDER BY priority ASC, created_at DESC
    `,
    [tenantId, ids, codes]
    ),
    loadCommercialConditionFieldCatalog(client, tenantId)
  ]);
  const byProduct = new Map();
  for (const row of r.rows || []) {
    const mapped = mapCommercialConditionRow(row, fieldCatalog);
    const keys = [
      mapped.scope.material_id,
      mapped.scope.product_id,
      mapped.scope.material_code,
      mapped.scope.product_code
    ].filter(Boolean).map(String);
    for (const key of keys) {
      const current = byProduct.get(key) || [];
      current.push(mapped);
      byProduct.set(key, current);
    }
  }
  return byProduct;
}

async function hydrateProductRowsWithCommercialConditions(client, tenantId, rows = []) {
  const conditionMap = await loadCommercialConditionsForProducts(client, tenantId, rows);
  return (rows || []).map((row) => {
    const attrs = safeJsonObject(row.attrs);
    const conditions = [
      ...(conditionMap.get(String(row.id || "")) || []),
      ...(conditionMap.get(String(row.code || "")) || [])
    ];
    const deduped = Array.from(new Map(conditions.map((item) => [item.id, item])).values());
    return {
      ...row,
      attrs: {
        ...attrs,
        commercial_conditions: deduped
      }
    };
  });
}

function stripRichTextToPlain(value) {
  const raw = String(value || "");
  if (!raw) return "";
  const withoutTags = raw
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ");
  return withoutTags.replace(/\s+/g, " ").trim();
}

function normalizeStage(value) {
  return normalizeText(value).toLowerCase();
}

function isPublishedStage(value) {
  return normalizeStage(value) === "published";
}

function isPublishedMaterialAttrs(attrs) {
  return isPublishedStage(attrs?.workflow?.stage || "");
}

function isPublishedStorefrontContent(row, attrs) {
  return isPublishedStage(row?.status || "") || isPublishedMaterialAttrs(attrs);
}

function buildRepublishWorkflowState(previousWorkflow, nowIso = new Date().toISOString()) {
  const prev = previousWorkflow && typeof previousWorkflow === "object" ? previousWorkflow : {};
  const workflow = {
    ...prev,
    stage: "intake",
    outcome: "pending_update",
    republish_required: true,
    updated_at: nowIso
  };
  delete workflow.published_at;
  return workflow;
}

function buildTranslationRepublishMetadata(previousTranslation, nowIso = new Date().toISOString()) {
  const prev = previousTranslation && typeof previousTranslation === "object" ? previousTranslation : {};
  return {
    ...prev,
    status: "stale",
    republish_required: true,
    translation_attempted: false,
    last_error_code: TRANSLATION_REPUBLISH_REQUIRED_CODE,
    updated_at: nowIso
  };
}

function markAttrsRepublishRequired(attrsInput, nowIso = new Date().toISOString()) {
  const attrs = attrsInput && typeof attrsInput === "object" ? { ...attrsInput } : {};
  attrs.workflow = buildRepublishWorkflowState(attrs.workflow, nowIso);
  attrs.translation = buildTranslationRepublishMetadata(attrs.translation, nowIso);
  return attrs;
}

function storefrontContentLifecycleKey(row) {
  const attrs = row?.attrs && typeof row.attrs === "object" ? row.attrs : {};
  return normalizeText(
    attrs?.translation?.updated_at ||
      attrs?.workflow?.updated_at ||
      attrs.updated_at ||
      row?.updated_at ||
      row?.created_at ||
      row?.id
  );
}

function toComparableStorefrontAttrs(attrsInput, fallbackTitle = null) {
  const source = attrsInput && typeof attrsInput === "object" ? attrsInput : {};
  const comparable = JSON.parse(JSON.stringify(source || {}));
  if (!normalizeOptionalText(comparable.title) && normalizeOptionalText(fallbackTitle)) {
    comparable.title = normalizeOptionalText(fallbackTitle);
  }
  delete comparable.updated_at;
  delete comparable.updated_by_identity_id;
  return comparable;
}

function collectMissingProductRequiredFields({ title, attrs }) {
  const missing = [];
  if (!normalizeText(title)) {
    missing.push("Product name");
  }

  const content = attrs?.content && typeof attrs.content === "object" ? attrs.content : {};
  const descriptionText = stripRichTextToPlain(content.summary || content.description || "");
  if (!descriptionText) {
    missing.push("Product description");
  }

  const taxonomy = attrs?.taxonomy && typeof attrs.taxonomy === "object" ? attrs.taxonomy : {};
  const categoryCode = normalizeProductCategoryCode(
    taxonomy.category_code || taxonomy.category || attrs?.category_code || ""
  );
  if (!categoryCode) {
    missing.push("Category");
  }

  const subcategoryCode = normalizeProductSubcategoryCode(
    taxonomy.subcategory_code || taxonomy.subcategory || ""
  );
  if (!subcategoryCode) {
    missing.push("Subcategory");
  }

  return missing;
}

function normalizeContentSlot(value) {
  const slot = normalizeText(value).toLowerCase();
  if (!slot) return "";
  return slot.replace(/[^a-z0-9._-]/g, "").slice(0, 80);
}

function slotLabelFromTag(tagValue) {
  const base = String(tagValue || "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "Untitled zone";
  return base
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function rendererTypeFromTag(tagValue) {
  const tag = normalizeContentSlot(tagValue);
  if (!tag) return "block";
  if (tag.includes("hero") || tag.includes("banner")) return "hero";
  if (tag.includes("card") || tag.includes("grid") || tag.includes("list") || tag.includes("feed")) return "cards";
  return "block";
}

function normalizeStorefrontContentModel(value) {
  const model = normalizeText(value).toLowerCase();
  if (model === STOREFRONT_CONTENT_MODEL_ARTICLE) return STOREFRONT_CONTENT_MODEL_ARTICLE;
  return STOREFRONT_CONTENT_MODEL_SINGLETON;
}

function normalizeStorefrontCategoryCode(value) {
  const raw = normalizeText(value).toUpperCase();
  if (!raw) return "";
  return raw
    .replace(/[^A-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeStorefrontCategoryLabel(value) {
  const label = normalizeOptionalText(value);
  return label ? label.slice(0, 120) : null;
}

function storefrontCategoryLabelFromCode(code) {
  const value = normalizeStorefrontCategoryCode(code);
  if (!value) return null;
  const words = value
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return null;
  return words.map((token) => token.charAt(0) + token.slice(1).toLowerCase()).join(" ");
}

async function ensureStorefrontCategoryList(client, tenantId) {
  const existing = await client.query(
    `
    SELECT id
    FROM eip_core.dropdown_list
    WHERE code = $1
      AND module = $2
      AND is_active = true
      AND (tenant_id = $3 OR tenant_id IS NULL)
    ORDER BY (tenant_id IS NOT NULL) DESC, version DESC
    LIMIT 1
    `,
    [STOREFRONT_CONTENT_CATEGORY_LIST_CODE, STOREFRONT_CONTENT_CATEGORY_LIST_MODULE, tenantId]
  );
  if (existing.rowCount) return existing.rows[0].id;

  const inserted = await client.query(
    `
    INSERT INTO eip_core.dropdown_list
      (tenant_id, module, code, name, version, is_active, attrs)
    VALUES
      ($1, $2, $3, $4, 1, true, $5::jsonb)
    ON CONFLICT (tenant_id, module, code, version) DO UPDATE
      SET is_active = true,
          updated_at = now()
    RETURNING id
    `,
    [
      tenantId,
      STOREFRONT_CONTENT_CATEGORY_LIST_MODULE,
      STOREFRONT_CONTENT_CATEGORY_LIST_CODE,
      "Storefront Content Category",
      JSON.stringify({
        scope: "storefront_content",
        module: "ecom",
        source: "runtime"
      })
    ]
  );
  return inserted.rows[0]?.id || null;
}

async function loadStorefrontCategories(client, tenantId) {
  const rows = await client.query(
    `
    WITH ranked AS (
      SELECT
        dv.code,
        dv.label,
        dv.sort_order,
        row_number() OVER (
          PARTITION BY upper(dv.code)
          ORDER BY (dl.tenant_id = $1) DESC, dl.version DESC, dv.sort_order ASC, dv.code ASC
        ) AS rn
      FROM eip_core.dropdown_value dv
      JOIN eip_core.dropdown_list dl ON dl.id = dv.list_id
      WHERE dl.code = $2
        AND dl.module = $3
        AND dl.is_active = true
        AND dv.is_active = true
        AND (dl.tenant_id = $1 OR dl.tenant_id IS NULL)
    )
    SELECT code, label, sort_order
    FROM ranked
    WHERE rn = 1
    ORDER BY sort_order ASC, code ASC
    `,
    [tenantId, STOREFRONT_CONTENT_CATEGORY_LIST_CODE, STOREFRONT_CONTENT_CATEGORY_LIST_MODULE]
  );
  return (rows.rows || [])
    .map((row) => {
      const code = normalizeStorefrontCategoryCode(row.code);
      if (!code) return null;
      const label =
        normalizeStorefrontCategoryLabel(row.label) ||
        storefrontCategoryLabelFromCode(code) ||
        code;
      return {
        code,
        label,
        sort_order: Number(row.sort_order || 0)
      };
    })
    .filter(Boolean);
}

async function findStorefrontCategory(client, tenantId, categoryCode) {
  const code = normalizeStorefrontCategoryCode(categoryCode);
  if (!code) return null;
  const row = await client.query(
    `
    WITH ranked AS (
      SELECT
        dv.code,
        dv.label,
        row_number() OVER (
          PARTITION BY upper(dv.code)
          ORDER BY (dl.tenant_id = $1) DESC, dl.version DESC, dv.sort_order ASC, dv.code ASC
        ) AS rn
      FROM eip_core.dropdown_value dv
      JOIN eip_core.dropdown_list dl ON dl.id = dv.list_id
      WHERE dl.code = $2
        AND dl.module = $3
        AND dl.is_active = true
        AND dv.is_active = true
        AND upper(dv.code) = upper($4)
        AND (dl.tenant_id = $1 OR dl.tenant_id IS NULL)
    )
    SELECT code, label
    FROM ranked
    WHERE rn = 1
    LIMIT 1
    `,
    [tenantId, STOREFRONT_CONTENT_CATEGORY_LIST_CODE, STOREFRONT_CONTENT_CATEGORY_LIST_MODULE, code]
  );
  if (row.rowCount) {
    const foundCode = normalizeStorefrontCategoryCode(row.rows[0].code);
    const label =
      normalizeStorefrontCategoryLabel(row.rows[0].label) ||
      storefrontCategoryLabelFromCode(foundCode) ||
      foundCode;
    return foundCode ? { code: foundCode, label } : null;
  }

  await ensureDefaultStorefrontStudioTabs(client, tenantId);
  const studio = await client.query(
    `
    SELECT dv.code, dv.label
    FROM eip_core.dropdown_value dv
    JOIN eip_core.dropdown_list dl ON dl.id = dv.list_id
    WHERE dl.tenant_id = $1
      AND dl.module = $2
      AND dl.code = $3
      AND dl.is_active = true
      AND dv.is_active = true
      AND upper(dv.code) = upper($4)
    LIMIT 1
    `,
    [tenantId, STOREFRONT_CONTENT_CATEGORY_LIST_MODULE, STOREFRONT_CONTENT_STUDIO_TAB_LIST_CODE, code]
  );
  if (!studio.rowCount) return null;
  const foundCode = normalizeStorefrontCategoryCode(studio.rows[0].code);
  const label =
    normalizeStorefrontCategoryLabel(studio.rows[0].label) ||
    storefrontCategoryLabelFromCode(foundCode) ||
    foundCode;
  return foundCode ? { code: foundCode, label } : null;
}

async function upsertStorefrontCategory(client, tenantId, codeInput, labelInput) {
  const listId = await ensureStorefrontCategoryList(client, tenantId);
  if (!listId) return null;

  const computedCode =
    normalizeStorefrontCategoryCode(codeInput) ||
    normalizeStorefrontCategoryCode(labelInput);
  if (!computedCode) return null;
  const computedLabel =
    normalizeStorefrontCategoryLabel(labelInput) ||
    storefrontCategoryLabelFromCode(computedCode) ||
    computedCode;

  const maxSort = await client.query(
    `
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort
    FROM eip_core.dropdown_value
    WHERE list_id = $1
    `,
    [listId]
  );
  const nextSort = Number(maxSort.rows[0]?.max_sort || 0) + 10;

  const upserted = await client.query(
    `
    INSERT INTO eip_core.dropdown_value
      (list_id, code, label, sort_order, is_active, attrs)
    VALUES
      ($1, $2, $3, $4, true, '{}'::jsonb)
    ON CONFLICT (list_id, code) DO UPDATE
      SET label = EXCLUDED.label,
          is_active = true,
          updated_at = now()
    RETURNING code, label
    `,
    [listId, computedCode, computedLabel, nextSort]
  );

  const code = normalizeStorefrontCategoryCode(upserted.rows[0]?.code || computedCode);
  const label =
    normalizeStorefrontCategoryLabel(upserted.rows[0]?.label || computedLabel) ||
    storefrontCategoryLabelFromCode(code) ||
    code;
  return code ? { code, label } : null;
}

async function ensureStorefrontStudioTabList(client, tenantId) {
  const existing = await client.query(
    `
    SELECT id
    FROM eip_core.dropdown_list
    WHERE code = $1
      AND module = $2
      AND is_active = true
      AND tenant_id = $3
    ORDER BY version DESC
    LIMIT 1
    `,
    [STOREFRONT_CONTENT_STUDIO_TAB_LIST_CODE, STOREFRONT_CONTENT_CATEGORY_LIST_MODULE, tenantId]
  );
  if (existing.rowCount) return existing.rows[0].id;

  const inserted = await client.query(
    `
    INSERT INTO eip_core.dropdown_list
      (tenant_id, module, code, name, version, is_active, attrs)
    VALUES
      ($1, $2, $3, $4, 1, true, $5::jsonb)
    ON CONFLICT (tenant_id, module, code, version) DO UPDATE
      SET is_active = true,
          updated_at = now()
    RETURNING id
    `,
    [
      tenantId,
      STOREFRONT_CONTENT_CATEGORY_LIST_MODULE,
      STOREFRONT_CONTENT_STUDIO_TAB_LIST_CODE,
      "Storefront Content Studio Tab",
      JSON.stringify({
        scope: "storefront_content_studio",
        module: "ecom",
        source: "runtime"
      })
    ]
  );
  return inserted.rows[0]?.id || null;
}

async function ensureDefaultStorefrontStudioTabs(client, tenantId) {
  const listId = await ensureStorefrontStudioTabList(client, tenantId);
  if (!listId) return;
  for (const tab of STOREFRONT_CONTENT_STUDIO_TAB_DEFAULTS) {
    await client.query(
      `
      INSERT INTO eip_core.dropdown_value
        (list_id, code, label, sort_order, is_active, attrs)
      VALUES
        ($1, $2, $3, $4, true, $5::jsonb)
      ON CONFLICT (list_id, code) DO UPDATE
        SET label = EXCLUDED.label,
            sort_order = EXCLUDED.sort_order,
            is_active = true,
            attrs = EXCLUDED.attrs,
            updated_at = now()
      `,
      [
        listId,
        tab.code,
        tab.label,
        tab.sort_order,
        JSON.stringify({
          tab_mode: tab.tab_mode,
          kind: "system"
        })
      ]
    );
  }
}

async function loadStorefrontStudioTabs(client, tenantId) {
  await ensureDefaultStorefrontStudioTabs(client, tenantId);
  const rows = await client.query(
    `
    SELECT dv.code, dv.label, dv.sort_order, dv.attrs
    FROM eip_core.dropdown_value dv
    JOIN eip_core.dropdown_list dl ON dl.id = dv.list_id
    WHERE dl.tenant_id = $1
      AND dl.module = $2
      AND dl.code = $3
      AND dl.is_active = true
      AND dv.is_active = true
    ORDER BY dv.sort_order ASC, dv.code ASC
    `,
    [tenantId, STOREFRONT_CONTENT_CATEGORY_LIST_MODULE, STOREFRONT_CONTENT_STUDIO_TAB_LIST_CODE]
  );
  return (rows.rows || [])
    .map((row) => {
      const code = normalizeStorefrontCategoryCode(row.code);
      const attrs = row?.attrs && typeof row.attrs === "object" ? row.attrs : {};
      const tabMode = normalizeContentSlot(attrs.tab_mode || code.toLowerCase());
      if (!tabMode) return null;
      return {
        code,
        label: normalizeStorefrontCategoryLabel(row.label) || code,
        tab_mode: tabMode,
        sort_order: Number(row.sort_order || 0),
        attrs
      };
    })
    .filter(Boolean);
}

function normalizeHttpUrl(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!/^https?:$/i.test(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function buildStructureScanAccumulator(frontendUrl) {
  return {
    frontend_url: frontendUrl,
    nodes: [],
    zone_map: new Map(),
    node_seen: new Set(),
    scanned_sources: new Set()
  };
}

function toStructureNodeFileLabel(sourceUrl) {
  try {
    const parsed = new URL(sourceUrl);
    return `${parsed.hostname}${parsed.pathname}${parsed.search || ""}`;
  } catch {
    return normalizeText(sourceUrl);
  }
}

function collectStructureMatches(content, patterns) {
  const seen = new Set();
  const matches = [];
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    for (const match of content.matchAll(regex)) {
      const key = `${Number(match?.index || 0)}|${String(match?.[1] || "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push(match);
    }
  }
  matches.sort((a, b) => Number(a?.index || 0) - Number(b?.index || 0));
  return matches;
}

function detectStructurePage(content) {
  for (const pattern of STRUCTURE_PAGE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags.replace("g", ""));
    const match = regex.exec(content);
    const page = normalizeContentSlot(match?.[1] || "");
    if (page) return page;
  }
  return "";
}

function appendStructureFromText(scan, sourceUrl, content) {
  if (!scan || !content) return 0;
  const fileLabel = toStructureNodeFileLabel(sourceUrl);
  let found = 0;
  const parentMatches = collectStructureMatches(content, STRUCTURE_PARENT_PATTERNS);
  for (const match of parentMatches) {
    const rawTag = match?.[1] || "";
    const tag = normalizeContentSlot(rawTag);
    if (!tag) continue;
    const index = Number(match.index || 0);
    const line = content.slice(0, index).split(/\r?\n/).length;
    const explicitPage = detectStructurePage(content.slice(Math.max(0, index - 320), index + 320));
    const page = explicitPage || tag.split(".")[0] || "home";
    const nodeKey = `${fileLabel}|${line}|${tag}`;
    if (scan.node_seen.has(nodeKey)) continue;
    scan.node_seen.add(nodeKey);
    scan.nodes.push({
      tag,
      page,
      file: fileLabel,
      line
    });
    if (!scan.zone_map.has(tag)) {
      scan.zone_map.set(tag, {
        tag,
        page,
        label: slotLabelFromTag(tag),
        renderer_type: rendererTypeFromTag(tag),
        occurrences: 1
      });
    } else {
      scan.zone_map.get(tag).occurrences += 1;
    }
    found += 1;
  }
  return found;
}

function extractAbsoluteLinksFromHtml(html, documentUrl, pattern) {
  if (!html) return [];
  const links = [];
  for (const match of html.matchAll(new RegExp(pattern))) {
    const ref = normalizeText(match?.[1] || "");
    if (!ref) continue;
    try {
      const resolved = new URL(ref, documentUrl).toString();
      links.push(resolved);
    } catch {
      // ignore malformed links
    }
  }
  return links;
}

function shouldScanModuleUrl(moduleUrl, origin) {
  try {
    const parsed = new URL(moduleUrl);
    if (parsed.origin !== origin) return false;
    const pathname = parsed.pathname || "";
    if (pathname.includes("/node_modules/")) return false;
    if (/\.(png|jpe?g|webp|gif|svg|ico|pdf|woff2?|ttf|eot|mp4|webm|mov|mp3|wav)$/i.test(pathname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function extractModuleImports(content, moduleUrl) {
  const imports = [];
  const appendResolved = (specifier) => {
    const raw = normalizeText(specifier);
    if (!raw) return;
    if (raw.startsWith("data:")) return;
    if (!raw.startsWith("/") && !raw.startsWith(".") && !/^https?:\/\//i.test(raw)) return;
    try {
      imports.push(new URL(raw, moduleUrl).toString());
    } catch {
      // ignore bad import
    }
  };
  for (const match of content.matchAll(new RegExp(STRUCTURE_IMPORT_FROM_REGEX))) {
    appendResolved(match?.[1] || "");
  }
  for (const match of content.matchAll(new RegExp(STRUCTURE_IMPORT_SIDE_EFFECT_REGEX))) {
    appendResolved(match?.[1] || "");
  }
  for (const match of content.matchAll(new RegExp(STRUCTURE_DYNAMIC_IMPORT_REGEX))) {
    appendResolved(match?.[1] || "");
  }
  return imports;
}

function normalizeStructureManifest(payload) {
  const body = payload && typeof payload === "object" ? payload : null;
  if (!body) return null;
  const zonesRaw = Array.isArray(body.zones)
    ? body.zones
    : Array.isArray(body.tags)
      ? body.tags.map((tag) => ({ tag }))
      : Array.isArray(body.items)
        ? body.items
        : [];
  const zones = zonesRaw
    .map((zoneLike) => {
      const zone = typeof zoneLike === "string" ? { tag: zoneLike } : zoneLike;
      const tag = normalizeContentSlot(zone?.tag || zone?.slot || zone?.parent);
      if (!tag) return null;
      const page = normalizeContentSlot(zone?.page || tag.split(".")[0] || "home") || "home";
      return {
        tag,
        page,
        label: normalizeOptionalText(zone?.label) || slotLabelFromTag(tag),
        renderer_type: normalizeContentSlot(zone?.renderer_type || rendererTypeFromTag(tag)) || rendererTypeFromTag(tag),
        occurrences: Number(zone?.occurrences || 1)
      };
    })
    .filter(Boolean);
  if (!zones.length) return null;
  return {
    zones,
    nodes: Array.isArray(body.nodes) ? body.nodes : []
  };
}

async function fetchStructureUrl(url, profile, options = {}, redirectCount = 0) {
  if (redirectCount > 3) throw new Error("STRUCTURE_SCAN_REDIRECT_LIMIT");
  await assertOutboundUrlAllowed(url, profile, { purpose: "storefront_structure_scan" });
  const response = await fetchWithTimeout(url, { ...options, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    const location = normalizeText(response.headers.get("location") || "");
    if (!location) throw new Error("STRUCTURE_SCAN_REDIRECT_INVALID");
    const redirected = new URL(location, url).toString();
    return fetchStructureUrl(redirected, profile, options, redirectCount + 1);
  }
  return response;
}

async function fetchStructureManifest(frontendUrl, profile) {
  for (const candidatePath of STRUCTURE_SCAN_MANIFEST_PATHS) {
    const candidateUrl = new URL(candidatePath, frontendUrl).toString();
    let response;
    try {
      response = await fetchStructureUrl(candidateUrl, profile, {
        method: "GET",
        headers: { Accept: "application/json" },
        timeout_ms: STRUCTURE_SCAN_TIMEOUT_MS
      });
    } catch {
      continue;
    }
    if (!response.ok) continue;
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("json")) continue;
    let payload;
    try {
      payload = await response.json();
    } catch {
      continue;
    }
    const normalized = normalizeStructureManifest(payload);
    if (!normalized) continue;
    return {
      source_kind: "manifest",
      source_url: candidateUrl,
      files_scanned: 1,
      tags_found: normalized.zones.length,
      scanned_at: new Date().toISOString(),
      zones: normalized.zones,
      nodes: normalized.nodes
    };
  }
  return null;
}

async function fetchTextForStructure(url, profile) {
  const response = await fetchStructureUrl(url, profile, {
    method: "GET",
    headers: { Accept: "text/html,application/javascript,text/javascript,*/*;q=0.5" },
    timeout_ms: STRUCTURE_SCAN_TIMEOUT_MS
  });
  if (!response.ok) {
    throw new Error(`FETCH_FAILED_${response.status}`);
  }
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const pathname = (() => {
    try {
      return new URL(response.url || url).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const isLikelyText =
    contentType.includes("javascript") ||
    contentType.includes("ecmascript") ||
    contentType.includes("text/") ||
    contentType.includes("json") ||
    contentType.includes("html") ||
    /\.(?:js|mjs|cjs|jsx|ts|tsx|html|htm|json|vue)$/.test(pathname);
  if (!isLikelyText) {
    throw new Error("UNSUPPORTED_CONTENT_TYPE");
  }
  const text = await response.text();
  return { url: response.url || url, text, contentType };
}

async function buildStructureScanFromFrontend(frontendUrl, profile, scanMode = "auto", renderedScanConfig = {}) {
  const mode = ["auto", "rendered", "generic", "tagged"].includes(normalizeText(scanMode).toLowerCase())
    ? normalizeText(scanMode).toLowerCase()
    : "auto";
  const rootDoc = await fetchTextForStructure(frontendUrl, profile);
  const staticGenericCandidates = ["auto", "generic"].includes(mode)
    ? scanGenericStorefrontHtml(rootDoc.text)
    : [];
  const renderedShellDetected = mode !== "tagged" && isLikelyClientRenderedShell(rootDoc.text, staticGenericCandidates);
  const renderedDom = ["auto", "rendered"].includes(mode)
    ? await renderStorefrontDom({ url: rootDoc.url, profile, config: renderedScanConfig })
    : null;
  const renderedGenericCandidates = renderedDom?.ok
    ? scanGenericStorefrontHtml(renderedDom.html).map((candidate) => ({
        ...candidate,
        source: "rendered_dom_scan"
      }))
    : [];
  const renderedHasUsableCandidate = renderedGenericCandidates.some(
    (candidate) => Number(candidate.confidence || 0) >= 0.45
  );
  const genericCandidates =
    mode === "rendered"
      ? renderedGenericCandidates
      : mode === "generic"
        ? staticGenericCandidates
        : renderedHasUsableCandidate
          ? renderedGenericCandidates
          : staticGenericCandidates;
  const manifest = ["auto", "tagged"].includes(mode)
    ? await fetchStructureManifest(frontendUrl, profile)
    : null;
  const origin = new URL(rootDoc.url).origin;
  const scan = buildStructureScanAccumulator(frontendUrl);
  if (["auto", "tagged"].includes(mode)) appendStructureFromText(scan, rootDoc.url, rootDoc.text);
  scan.scanned_sources.add(rootDoc.url);

  const queue = [];
  const enqueue = (url, depth) => {
    if (!shouldScanModuleUrl(url, origin)) return;
    if (scan.scanned_sources.has(url)) return;
    if (queue.some((item) => item.url === url)) return;
    queue.push({ url, depth });
  };

  if (["auto", "tagged"].includes(mode)) {
    for (const link of extractAbsoluteLinksFromHtml(rootDoc.text, rootDoc.url, STRUCTURE_SCRIPT_SRC_REGEX)) {
      enqueue(link, 0);
    }
    for (const link of extractAbsoluteLinksFromHtml(rootDoc.text, rootDoc.url, STRUCTURE_LINK_MODULE_REGEX)) {
      enqueue(link, 0);
    }
  }

  let fetchedModules = 0;
  while (["auto", "tagged"].includes(mode) && queue.length && fetchedModules < STRUCTURE_SCAN_MAX_MODULES) {
    const current = queue.shift();
    if (!current || scan.scanned_sources.has(current.url)) continue;
    if (current.depth > STRUCTURE_SCAN_MAX_DEPTH) continue;
    let doc;
    try {
      doc = await fetchTextForStructure(current.url, profile);
    } catch {
      scan.scanned_sources.add(current.url);
      continue;
    }
    scan.scanned_sources.add(current.url);
    fetchedModules += 1;
    appendStructureFromText(scan, doc.url, doc.text);
    const imports = extractModuleImports(doc.text, doc.url);
    for (const nextUrl of imports) {
      enqueue(nextUrl, current.depth + 1);
    }
  }

  const scannedZones = Array.from(scan.zone_map.values()).sort((a, b) => a.tag.localeCompare(b.tag));
  const taggedZones = manifest?.zones?.length ? manifest.zones : scannedZones;
  const taggedCandidates = ["auto", "tagged"].includes(mode)
    ? taggedZones.map(taggedZoneToCandidate).filter(Boolean)
    : [];
  const candidates =
    ["generic", "rendered"].includes(mode)
      ? genericCandidates
      : mode === "tagged"
        ? taggedCandidates
        : mergeScanCandidates(genericCandidates, taggedZones);
  const usableCandidates = candidates.filter((candidate) => Number(candidate.confidence || 0) >= 0.45);
  const scanSource =
    mode === "tagged"
      ? "tagged_scan"
      : mode === "rendered"
        ? renderedDom?.ok
          ? renderedHasUsableCandidate
            ? "rendered_dom_scan"
            : "rendered_dom_scan_low_confidence"
          : "rendered_dom_scan_unavailable"
      : genericCandidates.some((candidate) => Number(candidate.confidence || 0) >= 0.45)
        ? taggedCandidates.length
          ? renderedDom?.ok
            ? "rendered_dom_scan_with_tagged_markers"
            : "generic_scan_with_tagged_markers"
          : renderedDom?.ok
            ? "rendered_dom_scan"
            : "generic_scan"
        : taggedCandidates.length
          ? "tagged_scan_fallback"
          : renderedDom?.ok
            ? "rendered_dom_scan_low_confidence"
            : "generic_scan_low_confidence";
  const fallbackRecommendation =
    renderedShellDetected && !renderedDom?.ok
      ? "configure_rendered_dom_scanner"
      : renderedDom?.ok && !usableCandidates.length
        ? "review_low_confidence_rendered_dom"
        : null;
  return {
    project_path: frontendUrl,
    source_kind: renderedDom?.ok ? renderedDom.source_kind : manifest?.source_kind || "frontend_scan",
    source_url: frontendUrl,
    files_scanned: scan.scanned_sources.size,
    tags_found: taggedCandidates.length,
    scanned_at: new Date().toISOString(),
    scan_id: `scan-${randomUUID()}`,
    scan_mode: mode,
    scan_source: scanSource,
    generic_candidate_count: genericCandidates.length,
    tagged_candidate_count: taggedCandidates.length,
    usable_candidate_count: usableCandidates.length,
    rendered_shell_detected: renderedShellDetected,
    rendered_dom_attempted: renderedDom !== null,
    rendered_dom_available: renderedDom?.ok === true,
    rendered_dom_error: renderedDom?.ok === false ? renderedDom.error : null,
    rendered_dom_candidate_count: renderedGenericCandidates.length,
    fallback_recommendation: fallbackRecommendation,
    candidate_zones: candidates,
    unmapped_candidates: candidates.filter((candidate) => candidate.mapping_status !== "approved"),
    approved_mappings: candidates.filter((candidate) => candidate.mapping_status === "approved"),
    zones: taggedZones,
    nodes: manifest?.nodes?.length ? manifest.nodes : scan.nodes
  };
}

function selectStructureConnection(profiles, requestedConnectionCode = "") {
  const requested = normalizeText(requestedConnectionCode);
  const candidates = Array.isArray(profiles)
    ? profiles.filter(
        (profile) =>
          profile?.identity?.is_enabled &&
          normalizeHttpUrl(profile?.identity?.frontend_url)
      )
    : [];
  if (!candidates.length) return { error: "NO_CONNECTED_FRONTEND" };

  if (requested) {
    const exact = candidates.find(
      (profile) => normalizeText(profile?.identity?.connection_code) === requested
    );
    if (!exact) return { error: "CONNECTION_NOT_FOUND" };
    return { profile: exact };
  }

  const websiteCandidate =
    candidates.find((profile) => normalizeText(profile?.routing?.channel) === "website_intake") ||
    candidates[0];
  return { profile: websiteCandidate };
}

function mapStructureConnection(profile) {
  const code = normalizeText(profile?.identity?.connection_code);
  const name = normalizeText(profile?.identity?.connection_name);
  const frontendUrl = normalizeHttpUrl(profile?.identity?.frontend_url);
  const isEnabled = profile?.identity?.is_enabled === true;
  const reasons = [];
  if (!isEnabled) reasons.push("disabled");
  if (!frontendUrl) reasons.push("missing_frontend_url");
  if (profile?.public_storefront?.scan_allowed === false) reasons.push("scan_disabled");
  return {
    connection_code: code,
    connection_name: name || code || "Connection",
    channel: normalizeText(profile?.routing?.channel || ""),
    direction: normalizeText(profile?.identity?.direction || ""),
    frontend_url: frontendUrl || normalizeText(profile?.identity?.frontend_url || ""),
    is_enabled: isEnabled,
    scan_allowed: profile?.public_storefront?.scan_allowed !== false,
    allowed_scan_modes: Array.isArray(profile?.public_storefront?.allowed_scan_modes)
      ? profile.public_storefront.allowed_scan_modes
      : ["auto", "rendered", "generic", "tagged"],
    loader_enabled: profile?.public_storefront?.loader_enabled === true,
    public_api_enabled: profile?.public_storefront?.public_api_enabled !== false,
    scan_eligible: reasons.length === 0,
    excluded_reasons: reasons
  };
}

function findStructureMappingProfile(attrs = {}, connectionCode = "") {
  const requested = normalizeText(connectionCode);
  const profiles = Array.isArray(attrs.mapping_profiles) ? attrs.mapping_profiles : [];
  if (requested) {
    const matched = profiles.find((profile) => normalizeText(profile?.connection_code) === requested);
    if (matched) return matched;
  }
  const active = attrs.mapping_profile && typeof attrs.mapping_profile === "object"
    ? attrs.mapping_profile
    : null;
  if (!requested || normalizeText(active?.connection_code) === requested) return active || {};
  return {};
}

function upsertStructureMappingProfile(profiles, nextProfile) {
  const connectionCode = normalizeText(nextProfile?.connection_code);
  const existing = Array.isArray(profiles) ? profiles : [];
  const next = existing.filter((profile) => normalizeText(profile?.connection_code) !== connectionCode);
  next.push(nextProfile);
  return next.sort((a, b) => normalizeText(a?.connection_code).localeCompare(normalizeText(b?.connection_code)));
}

function clampPercent(value, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
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
    target: target || null,
    new_tab: newTab
  };
}

function normalizeStorefrontSlide(slide, index = 0) {
  if (!slide || typeof slide !== "object") return null;
  const image = normalizeOptionalText(slide.image || slide.image_url || slide.media?.url);
  const fit = normalizeText(slide.fit || slide.image_fit || "").toLowerCase() === "contain" ? "contain" : "cover";
  const cta = normalizeStorefrontCta(slide);
  return {
    id: normalizeOptionalText(slide.id) || `slide-${index + 1}`,
    image: image || "",
    eyebrow: normalizeOptionalText(slide.eyebrow),
    title: normalizeOptionalText(slide.title),
    subtitle: normalizeOptionalText(slide.subtitle),
    body: normalizeOptionalText(slide.body || slide.content || slide.text),
    cta_label: normalizeOptionalText(slide.cta_label || slide.ctaLabel),
    cta_url: cta.target,
    cta,
    cta_action: cta.action,
    cta_target: cta.target,
    cta_new_tab: cta.new_tab,
    overlay: normalizeOptionalText(slide.overlay) === "center" ? "center" : "left",
    fit,
    focus_x: clampPercent(slide.focus_x, 50),
    focus_y: clampPercent(slide.focus_y, 50),
    overlay_strength: clampPercent(slide.overlay_strength, 78),
    order: Number.isFinite(Number(slide.order)) ? Number(slide.order) : index + 1
  };
}

function normalizeStorefrontSlides(input) {
  if (!Array.isArray(input)) return [];
  const list = input
    .map((slide, index) => normalizeStorefrontSlide(slide, index))
    .filter(Boolean)
    .slice(0, 12);
  return list.sort((a, b) => (a.order || 0) - (b.order || 0));
}

function normalizeStorefrontArticle(input) {
  if (!input || typeof input !== "object") return null;
  const cta = normalizeStorefrontCta(input);
  const image = normalizeOptionalText(input.image || input.image_url || input.media?.url);
  return {
    image: image || "",
    eyebrow: normalizeOptionalText(input.eyebrow),
    title: normalizeOptionalText(input.title),
    excerpt: normalizeOptionalText(input.excerpt || input.subtitle || input.summary),
    body: normalizeOptionalText(input.body || input.content || input.text),
    cta_label: normalizeOptionalText(input.cta_label || input.ctaLabel),
    cta_url: cta.target,
    cta,
    cta_action: cta.action,
    cta_target: cta.target,
    cta_new_tab: cta.new_tab,
    order: Number.isFinite(Number(input.order)) ? Number(input.order) : 1
  };
}

function buildStorefrontContentAttrs({
  previous = {},
  slot,
  title,
  isActive,
  slides = [],
  article = null,
  categoryCode = "",
  categoryLabel = null,
  attrsPatch = {},
  identityId = null
}) {
  const nowIso = new Date().toISOString();
  const nextSlot = normalizeContentSlot(slot || previous.slot || "home.hero") || "home.hero";
  const contentModel = normalizeStorefrontContentModel(
    attrsPatch.content_model || previous.content_model || (article ? STOREFRONT_CONTENT_MODEL_ARTICLE : STOREFRONT_CONTENT_MODEL_SINGLETON)
  );
  const rendererType =
    normalizeContentSlot(attrsPatch.renderer_type || previous.renderer_type || "") ||
    (contentModel === STOREFRONT_CONTENT_MODEL_ARTICLE ? "article" : rendererTypeFromTag(nextSlot));
  const nextPage =
    normalizeContentSlot(attrsPatch.page || previous.page || nextSlot.split(".")[0] || "home") || "home";

  const nextAttrs = {
    ...previous,
    ...attrsPatch,
    slot: nextSlot,
    page: nextPage,
    title: title || previous.title || null,
    is_active: isActive,
    content_model: contentModel,
    renderer_type: rendererType,
    updated_at: nowIso
  };

  if (identityId) nextAttrs.updated_by_identity_id = identityId;

  const nextCategoryCode = normalizeStorefrontCategoryCode(
    categoryCode ||
      attrsPatch.content_category_code ||
      attrsPatch?.content_category?.code ||
      previous.content_category_code ||
      previous?.content_category?.code
  );
  const nextCategoryLabel =
    normalizeStorefrontCategoryLabel(
      categoryLabel ||
        attrsPatch.content_category_label ||
        attrsPatch?.content_category?.label ||
        previous.content_category_label ||
        previous?.content_category?.label
    ) ||
    (nextCategoryCode ? storefrontCategoryLabelFromCode(nextCategoryCode) : null);

  if (nextCategoryCode) {
    nextAttrs.content_category_code = nextCategoryCode;
    nextAttrs.content_category_label = nextCategoryLabel || nextCategoryCode;
    nextAttrs.content_category = {
      code: nextCategoryCode,
      label: nextCategoryLabel || nextCategoryCode
    };
  } else {
    delete nextAttrs.content_category_code;
    delete nextAttrs.content_category_label;
    delete nextAttrs.content_category;
  }

  if (contentModel === STOREFRONT_CONTENT_MODEL_ARTICLE) {
    nextAttrs.article = article;
    delete nextAttrs.slides;
  } else {
    nextAttrs.slides = slides;
    delete nextAttrs.article;
  }

  return nextAttrs;
}

function mapStorefrontContentRow(row) {
  const attrs = row?.attrs && typeof row.attrs === "object" ? row.attrs : {};
  const slot = normalizeContentSlot(attrs.slot || "home.hero") || "home.hero";
  const isActive = attrs.is_active !== false && String(attrs.is_active || "").toLowerCase() !== "false";
  const contentModel = normalizeStorefrontContentModel(attrs.content_model);
  const article = normalizeStorefrontArticle(attrs.article || attrs.entry || null);
  const categoryCode = normalizeStorefrontCategoryCode(
    attrs.content_category_code || attrs?.content_category?.code || ""
  );
  const categoryLabel =
    normalizeStorefrontCategoryLabel(
      attrs.content_category_label || attrs?.content_category?.label || ""
    ) ||
    (categoryCode ? storefrontCategoryLabelFromCode(categoryCode) : null);
  return {
    id: row.id,
    code: row.code,
    slot,
    title: normalizeOptionalText(attrs.title) || row.title || null,
    status: row.status,
    is_active: isActive,
    content_model: contentModel,
    page: normalizeContentSlot(attrs.page || slot.split(".")[0] || "home") || "home",
    renderer_type:
      normalizeContentSlot(attrs.renderer_type || "") ||
      (contentModel === STOREFRONT_CONTENT_MODEL_ARTICLE ? "article" : rendererTypeFromTag(slot)),
    category_code: categoryCode || null,
    category_label: categoryLabel || null,
    slides:
      contentModel === STOREFRONT_CONTENT_MODEL_ARTICLE
        ? []
        : normalizeStorefrontSlides(attrs.slides || []),
    article,
    attrs,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapStorefrontStructureRow(row) {
  if (!row) return null;
  const attrs = row?.attrs && typeof row.attrs === "object" ? row.attrs : {};
  const mappingProfile =
    attrs.mapping_profile && typeof attrs.mapping_profile === "object"
      ? attrs.mapping_profile
      : null;
  const zones = Array.isArray(attrs.zones)
    ? attrs.zones
        .map((zone) => {
          const tag = normalizeContentSlot(zone?.tag);
          if (!tag) return null;
          return {
            tag,
            page: normalizeContentSlot(zone?.page || tag.split(".")[0] || "home") || "home",
            label: normalizeOptionalText(zone?.label) || slotLabelFromTag(tag),
            renderer_type: normalizeContentSlot(zone?.renderer_type || rendererTypeFromTag(tag)) || rendererTypeFromTag(tag),
            occurrences: Number(zone?.occurrences || 1),
            candidate_id: normalizeText(zone?.candidate_id || ""),
            selector: normalizeText(zone?.selector || ""),
            dom_signature: normalizeText(zone?.dom_signature || ""),
            text_sample: normalizeText(zone?.text_sample || "").slice(0, 160),
            image_count: Number(zone?.image_count || 0),
            link_count: Number(zone?.link_count || 0),
            button_count: Number(zone?.button_count || 0),
            repeated_item_count: Number(zone?.repeated_item_count || 0),
            confidence: Number(zone?.confidence || 0),
            confidence_reasons: Array.isArray(zone?.confidence_reasons) ? zone.confidence_reasons : [],
            mapping_status: normalizeText(zone?.mapping_status || "proposed"),
            source: normalizeText(zone?.source || ""),
            push_allowed: zone?.push_allowed !== false
          };
        })
        .filter(Boolean)
    : [];
  const nodes = Array.isArray(attrs.nodes)
    ? attrs.nodes
        .map((node) => {
          const tag = normalizeContentSlot(node?.tag);
          if (!tag) return null;
          return {
            tag,
            page: normalizeContentSlot(node?.page || tag.split(".")[0] || "home") || "home",
            file: normalizeText(node?.file || ""),
            line: Number(node?.line || 0)
          };
        })
        .filter(Boolean)
    : [];
  return {
    id: row.id,
    code: row.code,
    title: row.title || normalizeOptionalText(attrs.title) || "Storefront structure",
    status: row.status,
    attrs,
    scope: normalizeText(attrs.scope || STOREFRONT_STRUCTURE_SCOPE) || STOREFRONT_STRUCTURE_SCOPE,
    project_path: normalizeText(attrs.project_path || ""),
    source_kind: normalizeText(attrs.source_kind || ""),
    source_url: normalizeText(attrs.source_url || ""),
    frontend_url: normalizeText(attrs.frontend_url || ""),
    connection_code: normalizeText(attrs.connection_code || ""),
    connection_name: normalizeText(attrs.connection_name || ""),
    files_scanned: Number(attrs.files_scanned || 0),
    tags_found: Number(attrs.tags_found || zones.length),
    scan_mode: normalizeText(attrs.scan_mode || mappingProfile?.source_mode || "auto"),
    scan_source: normalizeText(attrs.scan_source || mappingProfile?.scan_source || ""),
    generic_candidate_count: Number(attrs.generic_candidate_count || mappingProfile?.last_scan_result?.generic_candidate_count || 0),
    tagged_candidate_count: Number(attrs.tagged_candidate_count || mappingProfile?.last_scan_result?.tagged_candidate_count || 0),
    usable_candidate_count: Number(attrs.usable_candidate_count || mappingProfile?.last_scan_result?.usable_candidate_count || zones.length),
    rendered_shell_detected: attrs.rendered_shell_detected === true,
    rendered_dom_attempted: attrs.rendered_dom_attempted === true || mappingProfile?.last_scan_result?.rendered_dom_attempted === true,
    rendered_dom_available: attrs.rendered_dom_available === true || mappingProfile?.last_scan_result?.rendered_dom_available === true,
    rendered_dom_error: normalizeOptionalText(attrs.rendered_dom_error || mappingProfile?.last_scan_result?.rendered_dom_error),
    rendered_dom_candidate_count: Number(attrs.rendered_dom_candidate_count || mappingProfile?.last_scan_result?.rendered_dom_candidate_count || 0),
    fallback_recommendation: normalizeOptionalText(attrs.fallback_recommendation),
    mapping_profile: mappingProfile,
    mapping_profiles: Array.isArray(attrs.mapping_profiles) ? attrs.mapping_profiles : mappingProfile ? [mappingProfile] : [],
    candidate_zones: Array.isArray(mappingProfile?.candidate_zones) ? mappingProfile.candidate_zones : [],
    approved_mappings: Array.isArray(mappingProfile?.approved_mappings) ? mappingProfile.approved_mappings : [],
    ignored_candidates: Array.isArray(mappingProfile?.ignored_candidates) ? mappingProfile.ignored_candidates : [],
    scanned_at: attrs.scanned_at || row.updated_at || row.created_at,
    zones,
    nodes,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function workflowPatchForAction(action) {
  const normalized = normalizeText(action).toUpperCase();
  const nowIso = new Date().toISOString();
  if (normalized === "INTAKE") return { stage: "intake", updated_at: nowIso };
  if (normalized === "DRAFT_READY") return { stage: "review", updated_at: nowIso };
  if (normalized === "APPROVE") return { stage: "review", outcome: "approved", updated_at: nowIso };
  if (normalized === "PUBLISH") {
    return {
      stage: "published",
      outcome: "approved",
      published_at: nowIso,
      updated_at: nowIso
    };
  }
  if (normalized === "REJECT" || normalized === "CANCEL") {
    return { stage: "rejected", outcome: "rejected", updated_at: nowIso };
  }
  return null;
}

function storefrontTargetStatusForAction(action) {
  const normalized = normalizeText(action).toUpperCase();
  if (normalized === "INTAKE") return "new";
  if (normalized === "DRAFT_READY") return "review";
  if (normalized === "APPROVE") return "review";
  if (normalized === "PUBLISH") return "published";
  if (normalized === "REJECT" || normalized === "CANCEL") return "rejected";
  return "";
}

function reviewActionForStatus(status) {
  const normalized = normalizeReviewStatus(status, "");
  if (!normalized) return null;
  if (normalized === "approved" || normalized === "published" || normalized === "visible") return "APPROVE";
  if (normalized === "hidden") return "HIDE";
  if (normalized === "rejected") return "REJECT";
  if (normalized === "pending_review") return "REVIEW_SUBMIT";
  return null;
}

function mapBlogPostAdminRow(row) {
  const attrs = row?.attrs && typeof row.attrs === "object" ? row.attrs : {};
  const author = attrs.author && typeof attrs.author === "object" ? attrs.author : {};
  const imageUrls = Array.isArray(attrs.image_urls)
    ? attrs.image_urls
    : Array.isArray(attrs.images)
      ? attrs.images
      : [];
  const firstImage = normalizeOptionalText(
    attrs.image_url ||
      attrs.image ||
      imageUrls[0] ||
      ""
  );
  return {
    id: row.id,
    code: row.code,
    title: normalizeOptionalText(attrs.title) || row.title || "Untitled post",
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner_identity_id: normalizeOptionalText(attrs.created_by_identity_id || author.identity_id),
    author: {
      name: normalizeOptionalText(author.name) || "Member",
      identity_id: normalizeOptionalText(author.identity_id)
    },
    body_preview: normalizeText(attrs.body || "").slice(0, 220),
    image_url: firstImage
  };
}

async function applyMaterialWorkflowPatch(client, tenantId, materialId, patch) {
  if (!patch || !materialId) return;
  await client.query(
    `
    UPDATE eip_core.material
    SET attrs = COALESCE(attrs, '{}'::jsonb)
              || jsonb_build_object(
                   'workflow',
                   COALESCE(attrs->'workflow', '{}'::jsonb) || $3::jsonb
                 ),
        updated_at = now()
    WHERE tenant_id = $1 AND id = $2
    `,
    [tenantId, materialId, JSON.stringify(patch)]
  );
}

function readMultipartValue(input) {
  if (input === null || input === undefined) return "";
  if (typeof input === "object" && Object.prototype.hasOwnProperty.call(input, "value")) {
    return normalizeText(input.value);
  }
  return normalizeText(input);
}

function clampLimit(value) {
  const n = Number(value || 50);
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, n));
}

function buildIdempotencyKey(prefix, payload) {
  return sha256Hex(`${prefix}:${JSON.stringify(payload || {})}`);
}

const DEFAULT_SKU_POLICY = Object.freeze({
  include_tenant_prefix: true,
  tenant_prefix_length: 3,
  category_prefix_length: 5,
  serial_length: 4,
  date_mode: "yymm",
  separator: "-"
});

function normalizeSkuToken(value, maxLength, fallback) {
  const cleaned = normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return fallback;
  const size = Number.isInteger(maxLength) ? Math.max(1, Math.min(10, maxLength)) : 4;
  return cleaned.slice(0, size);
}

function deriveTenantAbbreviation(name, maxLength = 3) {
  const size = Number.isInteger(maxLength) ? Math.max(2, Math.min(10, maxLength)) : 3;
  const words = normalizeText(name)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "";
  let token = words[0].slice(0, size);
  if (token.length >= size) return token;
  const carry = words.slice(1).join("");
  token = `${token}${carry}`.slice(0, size);
  return token;
}

function deriveCategorySkuPrefix(categoryValue, maxLength = 5) {
  const size = Number.isInteger(maxLength) ? Math.max(2, Math.min(10, maxLength)) : 5;
  const normalized = normalizeText(categoryValue).replace(/[_-]+/g, " ");
  const words = normalized
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "GEN".slice(0, size).padEnd(Math.min(size, 3), "N");

  const initials = words.map((word) => word[0]).join("");
  const remainder = words.map((word) => word.slice(1)).join("");
  const compact = `${initials}${remainder}`;
  return normalizeSkuToken(compact, size, "GEN");
}

function resolveTenantSkuBasePrefix(tenantRow, policy) {
  const attrs = tenantRow?.attrs && typeof tenantRow.attrs === "object" ? tenantRow.attrs : {};
  const override = normalizeText(
    attrs?.sku?.tenant_prefix || attrs?.abbreviation || attrs?.tenant_abbreviation || ""
  );
  if (override) {
    return normalizeSkuToken(override, policy.tenant_prefix_length, "TEN");
  }
  const fromName = deriveTenantAbbreviation(tenantRow?.name, policy.tenant_prefix_length);
  if (fromName) {
    return normalizeSkuToken(fromName, policy.tenant_prefix_length, "TEN");
  }
  return normalizeSkuToken(tenantRow?.code || "", policy.tenant_prefix_length, "TEN");
}

function encodeBase36(value, width) {
  let n = Math.max(0, Number(value) || 0);
  const out = [];
  for (let i = 0; i < width; i += 1) {
    out.push((n % 36).toString(36).toUpperCase());
    n = Math.floor(n / 36);
  }
  return out.reverse().join("");
}

function pickUniqueTenantPrefix(baseToken, policy, takenPrefixes, seedHex) {
  const length = Math.max(2, Math.min(8, Number(policy?.tenant_prefix_length) || 3));
  const normalizedBase = normalizeSkuToken(baseToken, length, "TEN");
  if (!takenPrefixes.has(normalizedBase)) return normalizedBase;

  const seed = Number.parseInt(String(seedHex || "").slice(0, 8), 16) || 0;
  for (let suffixLength = 1; suffixLength <= Math.min(3, length - 1); suffixLength += 1) {
    const stemLength = length - suffixLength;
    const stem = normalizeSkuToken(normalizedBase, stemLength, "TEN".slice(0, stemLength));
    const combinations = 36 ** suffixLength;
    const start = seed % combinations;
    for (let i = 0; i < combinations; i += 1) {
      const value = (start + i) % combinations;
      const suffix = encodeBase36(value, suffixLength);
      const candidate = `${stem}${suffix}`;
      if (!takenPrefixes.has(candidate)) return candidate;
    }
  }

  return normalizedBase;
}

function allocateTenantPrefixMap(rows, policy) {
  const items = Array.isArray(rows) ? [...rows] : [];
  items.sort((a, b) => String(a?.id || "").localeCompare(String(b?.id || "")));
  const out = new Map();
  const taken = new Set();
  for (const row of items) {
    const tenantId = normalizeText(row?.id);
    if (!tenantId) continue;
    const base = resolveTenantSkuBasePrefix(row, policy);
    const seedSource = `${tenantId}:${row?.code || ""}:${row?.name || ""}`;
    const token = pickUniqueTenantPrefix(base, policy, taken, sha256Hex(seedSource));
    out.set(tenantId, token);
    taken.add(token);
  }
  return out;
}

async function resolveTenantSkuPrefix(client, tenantRow, policy) {
  const tenantId = normalizeText(tenantRow?.id);
  const base = resolveTenantSkuBasePrefix(tenantRow, policy);
  if (!tenantId) return base;

  const tenantRes = await client.query(
    `
    SELECT id, code, name, attrs
    FROM eip_core.tenant
    WHERE is_active = true
    `,
    []
  );
  const allocation = allocateTenantPrefixMap(tenantRes.rows || [], policy);
  return allocation.get(tenantId) || base;
}

function normalizeSkuPolicy(input) {
  const source = input && typeof input === "object" ? input : {};
  const separatorRaw = normalizeText(source.separator || DEFAULT_SKU_POLICY.separator);
  return {
    include_tenant_prefix:
      typeof source.include_tenant_prefix === "boolean"
        ? source.include_tenant_prefix
        : DEFAULT_SKU_POLICY.include_tenant_prefix,
    tenant_prefix_length: Number.isInteger(source.tenant_prefix_length)
      ? Math.max(2, Math.min(8, source.tenant_prefix_length))
      : DEFAULT_SKU_POLICY.tenant_prefix_length,
    category_prefix_length: Number.isInteger(source.category_prefix_length)
      ? Math.max(2, Math.min(10, source.category_prefix_length))
      : DEFAULT_SKU_POLICY.category_prefix_length,
    serial_length: Number.isInteger(source.serial_length)
      ? Math.max(3, Math.min(8, source.serial_length))
      : DEFAULT_SKU_POLICY.serial_length,
    date_mode: normalizeText(source.date_mode || DEFAULT_SKU_POLICY.date_mode).toLowerCase() === "yymmdd"
      ? "yymmdd"
      : "yymm",
    separator: separatorRaw === "." || separatorRaw === "_" ? separatorRaw : DEFAULT_SKU_POLICY.separator
  };
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSkuDateSegment(policy) {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  if (policy.date_mode === "yymmdd") {
    const dd = String(now.getUTCDate()).padStart(2, "0");
    return `${yy}${mm}${dd}`;
  }
  return `${yy}${mm}`;
}

async function loadCommerceSkuPolicy(client, tenantId) {
  const settingRes = await client.query(
    `
    SELECT attrs
    FROM eip_core.tenant_module_setting
    WHERE tenant_id = $1::uuid
      AND module = $2
      AND code = $3
      AND is_active = true
    LIMIT 1
    `,
    [tenantId, COMMERCE_SETTINGS_MODULE, COMMERCE_SETTINGS_CODE]
  );
  const attrs = settingRes.rows[0]?.attrs && typeof settingRes.rows[0].attrs === "object"
    ? settingRes.rows[0].attrs
    : {};
  return normalizeSkuPolicy(attrs?.sku);
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

async function findProductServiceObjectId(client, tenantId, materialId) {
  const r = await client.query(
    `
    SELECT so.id
    FROM eip_core.service_object so
    LEFT JOIN eip_core.object_link ol
      ON ol.tenant_id = so.tenant_id
     AND ol.src_kind = 'service_object'
     AND ol.src_id = so.id
     AND ol.dst_kind = 'material'
     AND ol.relation_type = 'REFERS_TO'
     AND ol.is_active = true
    WHERE so.tenant_id = $1
      AND so.object_type = $2
      AND (ol.dst_id = $3 OR so.attrs->>'material_id' = $3::text)
    LIMIT 1
    `,
    [tenantId, PRODUCT_OBJECT_TYPE, materialId]
  );
  return r.rows[0]?.id ?? null;
}

async function ensureProductInstance(client, app, opts) {
  const { tenantId, identityId, material, requireBinding } = opts;
  const binding = await resolveProcessBinding(client, tenantId, PRODUCT_OBJECT_TYPE);
  if (!binding) {
    if (requireBinding) return { ok: false, error: "PROCESS_BINDING_REQUIRED" };
    return { ok: true, skipped: true };
  }

  const existingServiceObjectId = await findProductServiceObjectId(client, tenantId, material.id);
  if (existingServiceObjectId) {
    const active = await app.coreProcess.findActiveInstance(client, tenantId, existingServiceObjectId);
    if (active) {
      return { ok: true, instance: active, serviceObjectId: existingServiceObjectId, createdInstance: false };
    }

    const created = await app.coreProcess.createInstance(client, {
      tenantId,
      identityId,
      serviceObjectId: existingServiceObjectId,
      processDefId: binding.process_def_id,
      idempotencyKey: `auto:${PRODUCT_OBJECT_TYPE}:${existingServiceObjectId}`
    });
    if (!created.ok) return { ok: false, error: created.error };
    return {
      ok: true,
      instance: created.item,
      serviceObjectId: existingServiceObjectId,
      createdInstance: created.reused !== true
    };
  }

  const serviceObjectSpec = {
    object_type: PRODUCT_OBJECT_TYPE,
    status: "new",
    code: material.code || null,
    title: material.title || null,
    attrs: {
      material_id: material.id,
      material_code: material.code || null
    },
    links: [
      {
        src_kind: "service_object",
        dst_kind: "material",
        relation_type: "REFERS_TO",
        dst_id: material.id,
        attrs: { source: "ecom" }
      }
    ]
  };

  const created = await app.coreProcess.createInstance(client, {
    tenantId,
    identityId,
    processDefId: binding.process_def_id,
    serviceObject: serviceObjectSpec,
    idempotencyKey: `auto:${PRODUCT_OBJECT_TYPE}:${material.id}`
  });
  if (!created.ok) return { ok: false, error: created.error };
  return {
    ok: true,
    instance: created.item,
    serviceObjectId: created.item?.service_object_id,
    createdInstance: created.reused !== true
  };
}

async function ensureProcessInstanceForObject(client, app, opts) {
  const {
    tenantId,
    identityId,
    objectType,
    serviceObjectId,
    serviceObject,
    requireBinding
  } = opts;
  const binding = await resolveProcessBinding(client, tenantId, objectType);
  if (!binding) {
    if (requireBinding) return { ok: false, error: "PROCESS_BINDING_REQUIRED" };
    return { ok: true, skipped: true };
  }

  const normalizedServiceObjectId = normalizeOptionalText(serviceObjectId);
  if (normalizedServiceObjectId) {
    const active = await app.coreProcess.findActiveInstance(client, tenantId, normalizedServiceObjectId);
    if (active) {
      return {
        ok: true,
        instance: active,
        serviceObjectId: normalizedServiceObjectId,
        createdInstance: false
      };
    }

    const created = await app.coreProcess.createInstance(client, {
      tenantId,
      identityId,
      serviceObjectId: normalizedServiceObjectId,
      processDefId: binding.process_def_id,
      idempotencyKey: `auto:${objectType}:${normalizedServiceObjectId}`
    });
    if (!created.ok) return { ok: false, error: created.error };
    return {
      ok: true,
      instance: created.item,
      serviceObjectId: normalizedServiceObjectId,
      createdInstance: created.reused !== true
    };
  }

  const created = await app.coreProcess.createInstance(client, {
    tenantId,
    identityId,
    processDefId: binding.process_def_id,
    serviceObject,
    idempotencyKey: normalizeOptionalText(serviceObject?.code)
      ? `auto:${objectType}:${normalizeOptionalText(serviceObject?.code)}`
      : null
  });
  if (!created.ok) return { ok: false, error: created.error };
  const createdServiceObjectId = created.item?.service_object_id || created.service_object?.id || null;
  return {
    ok: true,
    instance: created.item,
    serviceObject: created.service_object || null,
    serviceObjectId: createdServiceObjectId,
    createdInstance: created.reused !== true
  };
}

async function skuExists(client, tenantId, sku) {
  const r = await client.query(
    `
    SELECT 1
    FROM eip_core.material
    WHERE tenant_id=$1
      AND attrs->'inventory'->>'sku' = $2
    LIMIT 1
    `,
    [tenantId, sku]
  );
  return r.rowCount > 0;
}

async function generateSku(client, tenantId, options = {}) {
  const policy = await loadCommerceSkuPolicy(client, tenantId);
  const tenantRes = await client.query(
    `
    SELECT id, code, name, attrs
    FROM eip_core.tenant
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [tenantId]
  );
  const tenantToken = await resolveTenantSkuPrefix(client, tenantRes.rows[0] || {}, policy);
  const categoryToken = deriveCategorySkuPrefix(
    options.categoryLabel ||
      options.category_label ||
      options.categoryCode ||
      options.category_code ||
      "",
    policy.category_prefix_length
  );
  const dateToken = buildSkuDateSegment(policy);
  const prefixParts = [];
  if (policy.include_tenant_prefix) {
    prefixParts.push(tenantToken);
  }
  prefixParts.push(`${categoryToken}${dateToken}`);
  const basePrefix = prefixParts.join(policy.separator);

  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext($1))",
    [`sku:${tenantId}:${basePrefix}`]
  );

  const regex = `^${escapeRegex(basePrefix)}${escapeRegex(policy.separator)}([0-9]{${policy.serial_length}})$`;
  const likePattern = `${basePrefix}${policy.separator}%`;
  const maxRes = await client.query(
    `
    SELECT COALESCE(MAX((regexp_match(attrs->'inventory'->>'sku', $4))[1]::int), 0) AS max_serial
    FROM eip_core.material
    WHERE tenant_id = $1
      AND material_type = $2
      AND attrs->'inventory'->>'sku' LIKE $3
      AND attrs->'inventory'->>'sku' ~ $4
    `,
    [tenantId, MATERIAL_TYPE, likePattern, regex]
  );

  let serial = Number(maxRes.rows[0]?.max_serial || 0) + 1;
  const upperBound = 10 ** policy.serial_length - 1;
  while (serial <= upperBound) {
    const serialToken = String(serial).padStart(policy.serial_length, "0");
    const candidate = `${basePrefix}${policy.separator}${serialToken}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await skuExists(client, tenantId, candidate);
    if (!exists) return candidate;
    serial += 1;
  }

  for (let i = 0; i < 4; i += 1) {
    const seed = String(Date.now() + i);
    const fallback = `${basePrefix}${policy.separator}${seed.slice(-policy.serial_length).padStart(
      policy.serial_length,
      "0"
    )}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await skuExists(client, tenantId, fallback);
    if (!exists) return fallback;
  }
  return null;
}

async function generateProductCode(client, tenantId) {
  const prefix = "PRD";
  for (let i = 0; i < 6; i += 1) {
    const candidate = `${prefix}-${randomUUID().split("-")[0].toUpperCase()}`;
    const r = await client.query(
      `
      SELECT 1
      FROM eip_core.material
      WHERE tenant_id=$1 AND code=$2
      LIMIT 1
      `,
      [tenantId, candidate]
    );
    if (r.rowCount === 0) return candidate;
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

async function requirePerm(app, req, reply, permCode) {
  const s = await app.requireSession(req, { realm: "EIP" });
  if (!s.ok) {
    reply.code(s.status).send({ ok: false, error: s.error });
    return null;
  }

  const permCodes = Array.isArray(permCode) ? permCode : [permCode];
  let allowed = false;
  for (const code of permCodes) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await hasPermission(app, s.session.tenant_id, s.session.identity_id, code);
    if (ok) {
      allowed = true;
      break;
    }
  }
  if (!allowed) {
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

  const permCodes = Array.isArray(permCode) ? permCode : [permCode];
  let allowed = false;
  for (const code of permCodes) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await hasPermission(app, s.session.tenant_id, s.session.identity_id, code);
    if (ok) {
      allowed = true;
      break;
    }
  }
  if (!allowed) {
    reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    return null;
  }

  return s.session;
}

function normalizeReviewStatus(value, fallback = "pending_review") {
  const status = normalizeText(value).toLowerCase();
  if (!status) return fallback;
  return REVIEW_STATUS_VALUES.has(status) ? status : fallback;
}

function normalizeLocale(value) {
  return normalizeText(value).toLowerCase();
}

function getByPath(obj, path) {
  const parts = String(path || "").split(".").filter(Boolean);
  let cursor = obj;
  for (const part of parts) {
    if (!cursor || typeof cursor !== "object" || !(part in cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function setByPath(obj, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length) return;
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!cursor[key] || typeof cursor[key] !== "object" || Array.isArray(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

function pickSourceText(value, sourceLocale) {
  if (!value) return "";
  if (typeof value === "string") return normalizeText(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const source = normalizeText(value[sourceLocale]);
    if (source) return source;
    const english = normalizeText(value.en);
    if (english) return english;
    const fallback = normalizeText(value.default);
    if (fallback) return fallback;
    for (const entry of Object.values(value)) {
      const candidate = normalizeText(entry);
      if (candidate) return candidate;
    }
  }
  return "";
}

async function loadCommerceTranslationSettings(client, tenantId) {
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
    [tenantId, COMMERCE_SETTINGS_MODULE, COMMERCE_SETTINGS_CODE]
  );
  const attrs = r.rows[0]?.attrs && typeof r.rows[0].attrs === "object" ? r.rows[0].attrs : {};
  return attrs.translation && typeof attrs.translation === "object" ? attrs.translation : {};
}

function resolveTranslationLocales(translationSettings, appConfig = {}) {
  const runtime = resolveTranslationRuntime(appConfig, translationSettings);
  return {
    sourceLocale: runtime.source_locale || "en",
    targetLocales: Array.isArray(runtime.target_locales) ? runtime.target_locales : []
  };
}

function extractProductTranslationUnits(attrs, sourceLocale, fallbackByPath = {}) {
  const units = [];
  const seen = new Set();
  const currentAttrs = attrs && typeof attrs === "object" ? attrs : {};
  const fallbackMap = fallbackByPath && typeof fallbackByPath === "object" ? fallbackByPath : {};
  for (const path of PRODUCT_TRANSLATABLE_PATHS) {
    const rawValue = getByPath(currentAttrs, path);
    let text = pickSourceText(rawValue, sourceLocale);
    if (!text) {
      text = pickSourceText(fallbackMap[path], sourceLocale);
    }
    if (!text) continue;
    const dedupeKey = `${path}:${text}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    units.push({ path, source: text });
  }
  return units;
}

function extractStorefrontContentTranslationUnits(attrs, sourceLocale) {
  const units = [];
  const seen = new Set();
  const source = attrs && typeof attrs === "object" ? attrs : {};
  const registerUnit = (path, value) => {
    const text = pickSourceText(value, sourceLocale);
    if (!text) return;
    const key = `${path}:${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    units.push({ path, source: text });
  };

  registerUnit("title", source.title);

  if (Array.isArray(source.slides)) {
    source.slides.forEach((slide, index) => {
      if (!slide || typeof slide !== "object") return;
      STOREFRONT_CONTENT_TRANSLATABLE_FIELDS.forEach((field) => {
        registerUnit(`slides.${index}.${field}`, slide[field]);
      });
    });
  }

  if (source.article && typeof source.article === "object") {
    STOREFRONT_CONTENT_TRANSLATABLE_FIELDS.forEach((field) => {
      registerUnit(`article.${field}`, source.article[field]);
    });
  }

  return units;
}

function toTranslationMap(units, sourceLocale) {
  const out = {};
  for (const unit of units) {
    out[unit.path] = { [sourceLocale]: unit.source };
  }
  return out;
}

async function translateUnitsAtPublish(client, tenantId, appConfig, translationSettings, units) {
  const runtime = resolveTranslationRuntime(appConfig, translationSettings);
  const sourceLocale = normalizeLocale(runtime.source_locale || "en") || "en";
  const targetLocales = Array.isArray(runtime.target_locales) ? runtime.target_locales : [];
  if (!runtime.enabled || !runtime.provider_code || runtime.provider_code === "none") {
    return {
      ok: false,
      publish_state: TRANSLATION_PUBLISH_STATE_CONFIRM_REQUIRED,
      error_code: "TRANSLATION_PROVIDER_DISABLED",
      error_message: "Translation provider is disabled.",
      message: TRANSLATION_PUBLISH_CONFIRM_MESSAGE,
      source_locale: sourceLocale,
      target_locales: targetLocales
    };
  }
  if (!targetLocales.length) {
    return {
      ok: false,
      publish_state: TRANSLATION_PUBLISH_STATE_CONFIRM_REQUIRED,
      error_code: "TRANSLATION_TARGETS_EMPTY",
      error_message: "No translation target locales configured.",
      message: TRANSLATION_PUBLISH_CONFIRM_MESSAGE,
      source_locale: sourceLocale,
      target_locales: targetLocales
    };
  }

  const status = await checkTranslationServiceAvailability({
    client,
    tenantId,
    runtime,
    sourceLocale,
    targetLocale: targetLocales[0]
  });
  if (!status.available) {
    return {
      ok: false,
      publish_state: TRANSLATION_PUBLISH_STATE_CONFIRM_REQUIRED,
      error_code: status.code || "TRANSLATION_PROVIDER_OFFLINE",
      error_message: status.message || "Translation service offline.",
      message: TRANSLATION_PUBLISH_CONFIRM_MESSAGE,
      source_locale: sourceLocale,
      target_locales: targetLocales
    };
  }

  const sourceTexts = units.map((unit) => unit.source);
  const translationsByLocale = {};
  for (const locale of targetLocales) {
    try {
      const translated = await translateTextsThroughProvider({
        client,
        tenantId,
        runtime,
        sourceLocale,
        targetLocale: locale,
        texts: sourceTexts
      });
      if (!Array.isArray(translated) || translated.length !== sourceTexts.length) {
        return {
          ok: false,
          publish_state: TRANSLATION_PUBLISH_STATE_CONFIRM_REQUIRED,
          error_code: "TRANSLATION_PROVIDER_RESPONSE_INVALID",
          error_message: "Translation provider response is invalid.",
          message: TRANSLATION_PUBLISH_CONFIRM_MESSAGE,
          source_locale: sourceLocale,
          target_locales: targetLocales
        };
      }
      const localeMap = {};
      let translatedCount = 0;
      for (let index = 0; index < units.length; index += 1) {
        const text = normalizeText(translated[index]);
        if (!text) continue;
        localeMap[units[index].path] = text;
        translatedCount += 1;
      }
      if (!translatedCount) {
        return {
          ok: false,
          publish_state: TRANSLATION_PUBLISH_STATE_CONFIRM_REQUIRED,
          error_code: "TRANSLATION_PROVIDER_RESPONSE_INVALID",
          error_message: "Translation provider response is invalid.",
          message: TRANSLATION_PUBLISH_CONFIRM_MESSAGE,
          source_locale: sourceLocale,
          target_locales: targetLocales
        };
      }
      translationsByLocale[locale] = localeMap;
    } catch (error) {
      const normalized = normalizeProviderError(error);
      return {
        ok: false,
        publish_state: TRANSLATION_PUBLISH_STATE_CONFIRM_REQUIRED,
        error_code: normalized.code || "TRANSLATION_PROVIDER_ERROR",
        error_message: normalized.message || "Translation provider error.",
        message: TRANSLATION_PUBLISH_CONFIRM_MESSAGE,
        source_locale: sourceLocale,
        target_locales: targetLocales
      };
    }
  }

  return {
    ok: true,
    publish_state: TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION,
    source_locale: sourceLocale,
    target_locales: targetLocales,
    provider_code: runtime.provider_code,
    source_map: toTranslationMap(units, sourceLocale),
    translations_by_locale: translationsByLocale
  };
}

function buildTranslationMetadata({
  previous = {},
  publishState = TRANSLATION_PUBLISH_STATE_ENGLISH_ONLY,
  sourceLocale = "en",
  targetLocales = [],
  providerCode = null,
  sourceMap = {},
  translationsByLocale = {},
  errorCode = null
}) {
  const prev = previous && typeof previous === "object" ? previous : {};
  const nowIso = new Date().toISOString();
  const translationPayload = publishState === TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION
    ? {
        ...(sourceMap && typeof sourceMap === "object" ? sourceMap : {}),
        ...Object.fromEntries(
          Object.entries(translationsByLocale && typeof translationsByLocale === "object" ? translationsByLocale : {})
            .map(([locale, values]) => [
              locale,
              values && typeof values === "object" ? values : {}
            ])
        )
      }
    : prev.translations && typeof prev.translations === "object"
      ? prev.translations
      : {};

  const next = {
    ...prev,
    source_language: sourceLocale,
    source_locale: sourceLocale,
    target_languages: targetLocales,
    republish_required: false,
    status:
      publishState === TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION ? "translated" : "english_only",
    translation_attempted: publishState === TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION,
    published_without_translation: publishState !== TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION,
    last_error_code: publishState === TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION ? null : errorCode || "TRANSLATION_SKIPPED",
    translated_at: publishState === TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION ? nowIso : prev.translated_at || null,
    updated_at: nowIso,
    translations: translationPayload
  };
  if (providerCode) next.provider = providerCode;
  return next;
}

async function persistMaterialTranslationMetadata(client, tenantId, materialId, metadata) {
  const current = await client.query(
    `
    SELECT attrs
    FROM eip_core.material
    WHERE tenant_id = $1::uuid
      AND id = $2::uuid
      AND material_type = $3
    LIMIT 1
    `,
    [tenantId, materialId, MATERIAL_TYPE]
  );
  if (!current.rowCount) return false;
  const attrs = current.rows[0]?.attrs && typeof current.rows[0].attrs === "object"
    ? { ...current.rows[0].attrs }
    : {};
  attrs.translation = metadata;
  await client.query(
    `
    UPDATE eip_core.material
    SET attrs = $3::jsonb,
        updated_at = now()
    WHERE tenant_id = $1::uuid
      AND id = $2::uuid
      AND material_type = $4
    `,
    [tenantId, materialId, JSON.stringify(attrs), MATERIAL_TYPE]
  );
  return true;
}

async function persistStorefrontTranslationMetadata(client, tenantId, serviceObjectId, metadata) {
  const current = await client.query(
    `
    SELECT attrs
    FROM eip_core.service_object
    WHERE tenant_id = $1::uuid
      AND id = $2::uuid
      AND object_type = $3
    LIMIT 1
    `,
    [tenantId, serviceObjectId, STOREFRONT_CONTENT_OBJECT_TYPE]
  );
  if (!current.rowCount) return false;
  const attrs = current.rows[0]?.attrs && typeof current.rows[0].attrs === "object"
    ? { ...current.rows[0].attrs }
    : {};
  attrs.translation = metadata;
  await client.query(
    `
    UPDATE eip_core.service_object
    SET attrs = $4::jsonb,
        updated_at = now()
    WHERE tenant_id = $1::uuid
      AND id = $2::uuid
      AND object_type = $3
    `,
    [tenantId, serviceObjectId, STOREFRONT_CONTENT_OBJECT_TYPE, JSON.stringify(attrs)]
  );
  return true;
}

function sanitizeProductAttrsForStorage(attrs, tenantId) {
  if (!attrs || typeof attrs !== "object") return attrs;
  const next = { ...attrs };
  if (next.media && typeof next.media === "object") {
    next.media = sanitizeMediaForStorage(next.media, tenantId);
  }
  if (next.variants && typeof next.variants === "object") {
    next.variants = normalizeVariantsForStorage(next.variants);
  }
  return next;
}

function normalizeVariantNumber(value, options = {}) {
  const allowNegative = options.allowNegative === true;
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (!allowNegative && num < 0) return 0;
  return num;
}

function normalizeVariantHeaderCode(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function variantHeaderLabelFromCode(codeValue) {
  const code = normalizeVariantHeaderCode(codeValue);
  if (!code) return "";
  return code
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function normalizeVariantHeaderLabel(value, fallbackCode = "") {
  const label = normalizeOptionalText(value);
  if (label) return label.slice(0, 60);
  return variantHeaderLabelFromCode(fallbackCode).slice(0, 60);
}

function normalizeProductCategoryCode(value) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function productCategoryLabelFromCode(codeValue) {
  const code = normalizeProductCategoryCode(codeValue);
  if (!code) return "";
  return code
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0) + token.slice(1).toLowerCase())
    .join(" ");
}

function normalizeProductCategoryLabel(value, fallbackCode = "") {
  const label = normalizeOptionalText(value);
  if (label) return label.slice(0, 120);
  return productCategoryLabelFromCode(fallbackCode).slice(0, 120);
}

function normalizeProductSubcategoryCode(value) {
  return normalizeProductCategoryCode(value);
}

function normalizeProductSubcategoryLabel(value, fallbackCode = "") {
  const label = normalizeOptionalText(value);
  if (label) return label.slice(0, 120);
  return normalizeProductCategoryLabel("", fallbackCode).slice(0, 120);
}

function normalizeProductSubcategories(value) {
  const source = Array.isArray(value) ? value : [];
  const ordered = [];
  const seen = new Set();
  source.forEach((entry, index) => {
    const code = normalizeProductSubcategoryCode(
      typeof entry === "string" ? entry : entry?.code || entry?.label
    );
    if (!code || seen.has(code)) return;
    seen.add(code);
    const label = normalizeProductSubcategoryLabel(
      typeof entry === "string" ? entry : entry?.label,
      code
    );
    ordered.push({
      code,
      label: label || code,
      sort_order:
        Number.isInteger(Number(entry?.sort_order)) && Number(entry.sort_order) > 0
          ? Number(entry.sort_order)
          : (index + 1) * 10,
      is_active: entry?.is_active !== false
    });
  });
  return ordered.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

function normalizeCategoryVariantHeaders(value) {
  const source = Array.isArray(value) ? value : [];
  const ordered = [];
  const seen = new Set();
  source.forEach((entry, index) => {
    const code = normalizeVariantHeaderCode(
      typeof entry === "string" ? entry : entry?.code || entry?.key || entry?.label
    );
    if (!code || seen.has(code)) return;
    seen.add(code);
    const label = normalizeVariantHeaderLabel(
      typeof entry === "string" ? entry : entry?.label,
      code
    );
    ordered.push({
      code,
      label: label || code,
      sort_order:
        Number.isInteger(Number(entry?.sort_order)) && Number(entry.sort_order) > 0
          ? Number(entry.sort_order)
          : (index + 1) * 10,
      is_active: entry?.is_active !== false
    });
  });
  return ordered.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

function normalizeProductCategoryAttrs(value) {
  const attrs = value && typeof value === "object" ? value : {};
  return {
    ...attrs,
    subcategories: normalizeProductSubcategories(attrs.subcategories),
    variant_headers: normalizeCategoryVariantHeaders(attrs.variant_headers)
  };
}

function collectVariantHeaderRecords(headersInput) {
  const ordered = [];
  const seen = new Set();

  const pushHeader = (codeInput, labelInput) => {
    const code = normalizeVariantHeaderCode(codeInput || labelInput);
    if (!code || seen.has(code)) return;
    seen.add(code);
    ordered.push({
      key: code,
      label: normalizeVariantHeaderLabel(labelInput, code) || code
    });
  };

  const headers = Array.isArray(headersInput) ? headersInput : [];
  headers.forEach((entry) => {
    if (typeof entry === "string") {
      pushHeader(entry, entry);
      return;
    }
    if (!entry || typeof entry !== "object") return;
    pushHeader(entry.key || entry.code, entry.label);
  });

  return ordered;
}

async function ensureVariantHeaderList(client, tenantId) {
  const existing = await client.query(
    `
    SELECT id
    FROM eip_core.dropdown_list
    WHERE tenant_id = $1::uuid
      AND module = $2
      AND code = $3
      AND version = 1
      AND is_active = true
    LIMIT 1
    `,
    [tenantId, VARIANT_HEADER_LIST_MODULE, VARIANT_HEADER_LIST_CODE]
  );
  if (existing.rowCount) return existing.rows[0].id;

  const inserted = await client.query(
    `
    INSERT INTO eip_core.dropdown_list
      (tenant_id, module, code, name, version, is_active, attrs)
    VALUES
      ($1::uuid, $2, $3, $4, 1, true, $5::jsonb)
    ON CONFLICT (tenant_id, module, code, version) DO UPDATE
      SET is_active = true,
          updated_at = now()
    RETURNING id
    `,
    [
      tenantId,
      VARIANT_HEADER_LIST_MODULE,
      VARIANT_HEADER_LIST_CODE,
      "Ecommerce Variant Header",
      JSON.stringify({
        scope: "variant_headers",
        delegated: true,
        managed_by: "tenant"
      })
    ]
  );
  return inserted.rows[0]?.id || null;
}

async function loadVariantHeaderCatalog(client, tenantId, options = {}) {
  const includeInactive = options.includeInactive === true;
  const rows = await client.query(
    `
    WITH ranked AS (
      SELECT
        dv.code,
        dv.label,
        dv.sort_order,
        dv.is_active,
        row_number() OVER (
          PARTITION BY lower(dv.code)
          ORDER BY
            (dl.tenant_id = $1::uuid) DESC,
            dl.version DESC,
            dv.sort_order ASC,
            dv.code ASC
        ) AS rn
      FROM eip_core.dropdown_list dl
      JOIN eip_core.dropdown_value dv ON dv.list_id = dl.id
      WHERE dl.module = $2
        AND dl.code = $3
        AND dl.is_active = true
        AND (dl.tenant_id = $1::uuid OR dl.tenant_id IS NULL)
        AND ($4::boolean OR dv.is_active = true)
    )
    SELECT code, label, sort_order, is_active
    FROM ranked
    WHERE rn = 1
    ORDER BY sort_order ASC NULLS LAST, code ASC
    `,
    [tenantId, VARIANT_HEADER_LIST_MODULE, VARIANT_HEADER_LIST_CODE, includeInactive]
  );
  return (rows.rows || [])
    .map((row) => {
      const code = normalizeVariantHeaderCode(row.code);
      if (!code) return null;
      return {
        code,
        label: normalizeVariantHeaderLabel(row.label, code) || code,
        sort_order: Number(row.sort_order || 0),
        is_active: row.is_active !== false
      };
    })
    .filter(Boolean);
}

async function ensureCommercialConditionFieldList(client, tenantId) {
  const existing = await client.query(
    `
    SELECT id
    FROM eip_core.dropdown_list
    WHERE tenant_id = $1::uuid
      AND module = $2
      AND code = $3
      AND version = 1
      AND is_active = true
    LIMIT 1
    `,
    [tenantId, COMMERCIAL_CONDITION_FIELD_LIST_MODULE, COMMERCIAL_CONDITION_FIELD_LIST_CODE]
  );
  let listId = existing.rows[0]?.id || null;
  if (!listId) {
    const inserted = await client.query(
      `
      INSERT INTO eip_core.dropdown_list
        (tenant_id, module, code, name, version, is_active, attrs)
      VALUES
        ($1::uuid, $2, $3, $4, 1, true, $5::jsonb)
      ON CONFLICT (tenant_id, module, code, version) DO UPDATE
        SET is_active = true,
            updated_at = now()
      RETURNING id
      `,
      [
        tenantId,
        COMMERCIAL_CONDITION_FIELD_LIST_MODULE,
        COMMERCIAL_CONDITION_FIELD_LIST_CODE,
        "Ecommerce Commercial Condition Field",
        JSON.stringify({
          scope: "commercial_condition_fields",
          delegated: true,
          managed_by: "tenant",
          target_table: "eip_core.commercial_condition",
          target_column: "effect"
        })
      ]
    );
    listId = inserted.rows[0]?.id || null;
  }

  for (const field of DEFAULT_COMMERCIAL_CONDITION_FIELDS) {
    // eslint-disable-next-line no-await-in-loop
    await client.query(
      `
      INSERT INTO eip_core.dropdown_value
        (list_id, code, label, sort_order, is_active, attrs)
      VALUES
        ($1, $2, $3, $4, true, $5::jsonb)
      ON CONFLICT (list_id, code) DO UPDATE
        SET label = EXCLUDED.label,
            sort_order = EXCLUDED.sort_order,
            attrs = COALESCE(eip_core.dropdown_value.attrs,'{}'::jsonb) || EXCLUDED.attrs,
            is_active = true,
            updated_at = now()
      `,
      [
        listId,
        field.code,
        field.label,
        field.sort_order,
        JSON.stringify({
          ...(field.attrs || {}),
          governed: true,
          source: "commercial_condition_field_defaults"
        })
      ]
    );
  }

  return listId;
}

async function loadCommercialConditionFieldCatalog(client, tenantId, options = {}) {
  const includeInactive = options.includeInactive === true;
  await ensureCommercialConditionFieldList(client, tenantId);
  const rows = await client.query(
    `
    WITH ranked AS (
      SELECT
        dv.code,
        dv.label,
        dv.sort_order,
        dv.is_active,
        dv.attrs,
        row_number() OVER (
          PARTITION BY lower(dv.code)
          ORDER BY
            (dl.tenant_id = $1::uuid) DESC,
            dl.version DESC,
            dv.sort_order ASC,
            dv.code ASC
        ) AS rn
      FROM eip_core.dropdown_list dl
      JOIN eip_core.dropdown_value dv ON dv.list_id = dl.id
      WHERE dl.module = $2
        AND dl.code = $3
        AND dl.is_active = true
        AND (dl.tenant_id = $1::uuid OR dl.tenant_id IS NULL)
        AND ($4::boolean OR dv.is_active = true)
    )
    SELECT code, label, sort_order, is_active, attrs
    FROM ranked
    WHERE rn = 1
    ORDER BY sort_order ASC NULLS LAST, code ASC
    `,
    [
      tenantId,
      COMMERCIAL_CONDITION_FIELD_LIST_MODULE,
      COMMERCIAL_CONDITION_FIELD_LIST_CODE,
      includeInactive
    ]
  );
  return (rows.rows || []).map(mapCommercialConditionFieldRow).filter(Boolean);
}

async function ensureProductCategoryList(client, tenantId) {
  const existing = await client.query(
    `
    SELECT id
    FROM eip_core.dropdown_list
    WHERE tenant_id = $1::uuid
      AND module = $2
      AND code = $3
      AND version = 1
      AND is_active = true
    LIMIT 1
    `,
    [tenantId, PRODUCT_CATEGORY_LIST_MODULE, PRODUCT_CATEGORY_LIST_CODE]
  );
  if (existing.rowCount) return existing.rows[0].id;

  const inserted = await client.query(
    `
    INSERT INTO eip_core.dropdown_list
      (tenant_id, module, code, name, version, is_active, attrs)
    VALUES
      ($1::uuid, $2, $3, $4, 1, true, $5::jsonb)
    ON CONFLICT (tenant_id, module, code, version) DO UPDATE
      SET is_active = true,
          updated_at = now()
    RETURNING id
    `,
    [
      tenantId,
      PRODUCT_CATEGORY_LIST_MODULE,
      PRODUCT_CATEGORY_LIST_CODE,
      "Ecommerce Product Category",
      JSON.stringify({
        scope: "product_taxonomy",
        delegated: true,
        managed_by: "tenant"
      })
    ]
  );
  return inserted.rows[0]?.id || null;
}

async function loadProductCategoryCatalog(client, tenantId, options = {}) {
  const includeInactive = options.includeInactive === true;
  const rows = await client.query(
    `
    SELECT
      dv.code,
      dv.label,
      dv.sort_order,
      dv.is_active,
      dv.attrs
    FROM eip_core.dropdown_list dl
    JOIN eip_core.dropdown_value dv ON dv.list_id = dl.id
    WHERE dl.tenant_id = $1::uuid
      AND dl.module = $2
      AND dl.code = $3
      AND dl.version = 1
      AND dl.is_active = true
      AND ($4::boolean OR dv.is_active = true)
    ORDER BY dv.sort_order ASC NULLS LAST, dv.code ASC
    `,
    [tenantId, PRODUCT_CATEGORY_LIST_MODULE, PRODUCT_CATEGORY_LIST_CODE, includeInactive]
  );
  return (rows.rows || [])
    .map((row) => {
      const code = normalizeProductCategoryCode(row.code);
      if (!code) return null;
      const attrs = normalizeProductCategoryAttrs(row.attrs);
      return {
        code,
        label: normalizeProductCategoryLabel(row.label, code) || code,
        sort_order: Number(row.sort_order || 0),
        is_active: row.is_active !== false,
        subcategories: attrs.subcategories || [],
        variant_headers: attrs.variant_headers || []
      };
    })
    .filter(Boolean);
}

function findProductCategoryByInput(catalog, input) {
  const items = Array.isArray(catalog) ? catalog : [];
  const byCode = normalizeProductCategoryCode(input);
  if (byCode) {
    const direct = items.find((item) => normalizeProductCategoryCode(item?.code) === byCode);
    if (direct) return direct;
  }
  const labelNeedle = normalizeText(input).toLowerCase();
  if (!labelNeedle) return null;
  return (
    items.find((item) => normalizeText(item?.label).toLowerCase() === labelNeedle) || null
  );
}

function findProductSubcategoryByInput(category, input) {
  const items = Array.isArray(category?.subcategories) ? category.subcategories : [];
  const byCode = normalizeProductSubcategoryCode(input);
  if (byCode) {
    const direct = items.find((item) => normalizeProductSubcategoryCode(item?.code) === byCode);
    if (direct) return direct;
  }
  const labelNeedle = normalizeText(input).toLowerCase();
  if (!labelNeedle) return null;
  return (
    items.find((item) => normalizeText(item?.label).toLowerCase() === labelNeedle) || null
  );
}

async function validateCategoryVariantHeaders(client, tenantId, headersInput) {
  const normalizedHeaders = normalizeCategoryVariantHeaders(headersInput);
  if (!normalizedHeaders.length) return { ok: true, items: [] };

  await ensureVariantHeaderList(client, tenantId);
  const masterCatalog = await loadVariantHeaderCatalog(client, tenantId, { includeInactive: false });
  const masterByCode = new Map(
    masterCatalog
      .map((item) => [normalizeVariantHeaderCode(item?.code || item?.key), item])
      .filter(([code]) => Boolean(code))
  );
  const invalidCodes = normalizedHeaders
    .map((entry) => normalizeVariantHeaderCode(entry?.code))
    .filter((code) => code && !masterByCode.has(code));
  if (invalidCodes.length) {
    return { ok: false, error: "VARIANT_HEADER_NOT_ALLOWED", invalid_codes: [...new Set(invalidCodes)] };
  }

  return {
    ok: true,
    items: normalizedHeaders.map((entry, index) => {
      const code = normalizeVariantHeaderCode(entry?.code);
      const master = masterByCode.get(code);
      return {
        code,
        label: normalizeVariantHeaderLabel(master?.label || entry?.label, code) || code,
        sort_order:
          Number.isInteger(Number(entry?.sort_order)) && Number(entry.sort_order) > 0
            ? Number(entry.sort_order)
            : (index + 1) * 10,
        is_active: entry?.is_active !== false
      };
    })
  };
}

async function upsertProductCategoryCatalogEntry(client, tenantId, payload = {}, options = {}) {
  const listId = await ensureProductCategoryList(client, tenantId);
  const fallbackCode = normalizeProductCategoryCode(options.code || payload.code || payload.label || "");
  const code = normalizeProductCategoryCode(payload.code || fallbackCode);
  const label = normalizeProductCategoryLabel(payload.label, code);
  if (!code || !label) return { ok: false, error: "PRODUCT_CATEGORY_CODE_OR_LABEL_REQUIRED" };

  const hasSubcategories = Object.prototype.hasOwnProperty.call(payload, "subcategories");
  const hasVariantHeaders = Object.prototype.hasOwnProperty.call(payload, "variant_headers");
  const hasSortOrder = Object.prototype.hasOwnProperty.call(payload, "sort_order");
  const hasActive = Object.prototype.hasOwnProperty.call(payload, "is_active");

  const existing = await client.query(
    `
    SELECT code, label, sort_order, is_active, attrs
    FROM eip_core.dropdown_value
    WHERE list_id = $1
      AND code = $2
    LIMIT 1
    `,
    [listId, code]
  );
  const current = existing.rowCount
    ? {
        code,
        label: normalizeProductCategoryLabel(existing.rows[0]?.label, code) || code,
        sort_order: Number(existing.rows[0]?.sort_order || 0),
        is_active: existing.rows[0]?.is_active !== false,
        attrs: normalizeProductCategoryAttrs(existing.rows[0]?.attrs)
      }
    : null;

  const maxSortRes = await client.query(
    `
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort
    FROM eip_core.dropdown_value
    WHERE list_id = $1
    `,
    [listId]
  );
  const maxSort = Number(maxSortRes.rows[0]?.max_sort || 0);
  const sortOrder = hasSortOrder
    ? Number(payload.sort_order || 0)
    : current
      ? Number(current.sort_order || 0)
      : maxSort + 10;
  if (!Number.isInteger(sortOrder) || sortOrder < 1) {
    return { ok: false, error: "INVALID_SORT_ORDER" };
  }

  const active = hasActive ? payload.is_active === true : current ? current.is_active : true;
  const subcategories = hasSubcategories
    ? normalizeProductSubcategories(payload.subcategories)
    : current?.attrs?.subcategories || [];
  const rawCategoryHeaders = hasVariantHeaders
    ? payload.variant_headers
    : current?.attrs?.variant_headers || [];
  const categoryHeaderCheck = await validateCategoryVariantHeaders(client, tenantId, rawCategoryHeaders);
  if (!categoryHeaderCheck.ok) return categoryHeaderCheck;
  const variantHeaders = categoryHeaderCheck.items || [];

  const attrs = {
    ...(current?.attrs || {}),
    subcategories,
    variant_headers: variantHeaders
  };

  const upserted = await client.query(
    `
    INSERT INTO eip_core.dropdown_value
      (list_id, code, label, sort_order, is_active, attrs)
    VALUES
      ($1, $2, $3, $4, $5, $6::jsonb)
    ON CONFLICT (list_id, code) DO UPDATE
      SET label = EXCLUDED.label,
          sort_order = EXCLUDED.sort_order,
          is_active = EXCLUDED.is_active,
          attrs = EXCLUDED.attrs,
          updated_at = now()
    RETURNING code, label, sort_order, is_active, attrs
    `,
    [listId, code, label, sortOrder, active, JSON.stringify(attrs)]
  );
  return { ok: true, item: upserted.rows[0] };
}

async function validateProductTaxonomyAndVariantsWithCatalog(client, tenantId, attrsInput) {
  const attrs = attrsInput && typeof attrsInput === "object" ? { ...attrsInput } : {};
  const taxonomyRaw = attrs.taxonomy && typeof attrs.taxonomy === "object" ? { ...attrs.taxonomy } : {};
  const categoryInput =
    taxonomyRaw.category_code ||
    taxonomyRaw.category ||
    taxonomyRaw.category_label ||
    attrs.category_code ||
    "";
  const subcategoryInput =
    taxonomyRaw.subcategory_code ||
    taxonomyRaw.subcategory ||
    taxonomyRaw.subcategory_label ||
    "";
  const tags = Array.isArray(taxonomyRaw.tags)
    ? taxonomyRaw.tags.map((tag) => normalizeText(tag)).filter(Boolean)
    : [];

  let category = null;
  let subcategory = null;
  if (categoryInput) {
    await ensureProductCategoryList(client, tenantId);
    const catalog = await loadProductCategoryCatalog(client, tenantId, { includeInactive: false });
    category = findProductCategoryByInput(catalog, categoryInput);
    if (!category) {
      return {
        ok: false,
        error: "INVALID_PRODUCT_CATEGORY",
        category_code: normalizeProductCategoryCode(categoryInput)
      };
    }
    if (subcategoryInput) {
      subcategory = findProductSubcategoryByInput(category, subcategoryInput);
      if (!subcategory || subcategory.is_active === false) {
        return {
          ok: false,
          error: "INVALID_PRODUCT_SUBCATEGORY",
          category_code: category.code,
          subcategory_code: normalizeProductSubcategoryCode(subcategoryInput)
        };
      }
    }
    attrs.taxonomy = {
      ...taxonomyRaw,
      category_code: category.code,
      category_label: category.label,
      category: category.label,
      tags
    };
    if (subcategory) {
      attrs.taxonomy.subcategory_code = subcategory.code;
      attrs.taxonomy.subcategory_label = subcategory.label;
      attrs.taxonomy.subcategory = subcategory.label;
    } else {
      delete attrs.taxonomy.subcategory_code;
      delete attrs.taxonomy.subcategory_label;
      delete attrs.taxonomy.subcategory;
    }
  } else if (Object.keys(taxonomyRaw).length) {
    attrs.taxonomy = { ...taxonomyRaw, tags };
    delete attrs.taxonomy.category_code;
    delete attrs.taxonomy.category_label;
    delete attrs.taxonomy.category;
    delete attrs.taxonomy.subcategory_code;
    delete attrs.taxonomy.subcategory_label;
    delete attrs.taxonomy.subcategory;
  }

  if (!attrs.variants || typeof attrs.variants !== "object") {
    return { ok: true, attrs };
  }

  const normalized = normalizeVariantsForStorage(attrs.variants);
  const headerCodes = (normalized.headers || [])
    .map((entry) => normalizeVariantHeaderCode(entry?.key || entry?.code))
    .filter(Boolean);
  const hasVariantRows = Array.isArray(normalized.items) && normalized.items.length > 0;
  const requiresCategory = normalized.enabled === true || hasVariantRows || headerCodes.length > 0;
  if (requiresCategory && !category) {
    return { ok: false, error: "PRODUCT_CATEGORY_REQUIRED_FOR_VARIANTS" };
  }
  if (requiresCategory && !headerCodes.length) {
    return { ok: false, error: "VARIANT_HEADERS_REQUIRED" };
  }
  if (!requiresCategory) {
    attrs.variants = normalized;
    return { ok: true, attrs };
  }

  const allowedHeaderEntries = Array.isArray(category?.variant_headers)
    ? category.variant_headers.filter((item) => item?.is_active !== false)
    : [];
  const allowedHeaderByCode = new Map(
    allowedHeaderEntries
      .map((entry) => [normalizeVariantHeaderCode(entry?.code), entry])
      .filter(([code]) => Boolean(code))
  );

  if (headerCodes.length && !allowedHeaderByCode.size) {
    return {
      ok: false,
      error: "CATEGORY_VARIANT_HEADERS_EMPTY",
      category_code: category.code
    };
  }

  const invalidCodes = headerCodes.filter((code) => !allowedHeaderByCode.has(code));
  if (invalidCodes.length) {
    return {
      ok: false,
      error: "VARIANT_HEADER_NOT_ALLOWED_FOR_CATEGORY",
      category_code: category.code,
      invalid_codes: [...new Set(invalidCodes)]
    };
  }

  if (headerCodes.length) {
    normalized.headers = headerCodes.map((code) => {
      const categoryHeader = allowedHeaderByCode.get(code);
      return {
        key: code,
        label:
          normalizeVariantHeaderLabel(categoryHeader?.label || code, code) ||
          normalizeVariantHeaderLabel(code, code) ||
          code
      };
    });
  }

  attrs.variants = normalized;
  return { ok: true, attrs };
}

function normalizeVariantsForStorage(value) {
  const raw = value && typeof value === "object" ? value : {};
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const headers = collectVariantHeaderRecords(raw.headers);
  const items = Array.isArray(raw.items)
    ? raw.items
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const id = normalizeText(item.id) || randomUUID();
          const attrs = {};
          headers.forEach((header) => {
            const key = header.key;
            attrs[key] = normalizeText(item?.[key]);
          });
          return {
            id,
            ...attrs,
            stock_qty: normalizeVariantNumber(item.stock_qty),
            price_delta: normalizeVariantNumber(item.price_delta, { allowNegative: true }),
            active: item.active !== false
          };
        })
        .filter(Boolean)
    : [];
  const hasExplicitEnabled = raw.enabled === true || raw.enabled === false;
  const enabled = hasExplicitEnabled ? raw.enabled === true : items.length > 0;
  return { ...raw, enabled, headers, items };
}

export default async function ecomRoutes(app) {
  app.post(
    "/uploads",
    { errorHandler: createUploadErrorHandler("ecom_upload_request_error") },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PRODUCT_WRITE");
      if (!session) return;

      try {
        if (!req.isMultipart()) {
          return reply.code(415).send({
            ok: false,
            error: "MULTIPART_REQUIRED",
            message: "Upload requests must use multipart form data."
          });
        }

        const bodyFile = req.body?.file;
        let filePart = bodyFile;
        if (!filePart?.file && typeof filePart?.toBuffer !== "function") {
          filePart = await req.file();
        }
        if (!filePart || (!filePart.file && typeof filePart.toBuffer !== "function")) {
          return reply.code(400).send({
            ok: false,
            error: "FILE_REQUIRED",
            message: "Select a file to upload."
          });
        }

        const { filename, mimetype } = filePart;
        const assetKind = readMultipartValue(req.body?.asset_kind).toLowerCase() === "document"
          ? "document"
          : "media";
        const buffer = await uploadPartToBuffer(filePart, {
          maxBytes: Number(app.config.UPLOAD_MAX_BYTES || DEFAULT_MAX_UPLOAD_BYTES)
        });
        const validation = validateEcomUpload({
          buffer,
          filename,
          mimetype,
          assetKind,
          allowedDocumentExt: DOCUMENT_ALLOWED_EXT,
          allowedDocumentMime: DOCUMENT_ALLOWED_MIME
        });
        if (!validation.ok) {
          auditSecurityEvent(app, "upload.rejected", {
            category: "upload",
            source: "ecom.uploads",
            severity: "warning",
            outcome: "rejected",
            tenantId: session.tenant_id,
            identityId: session.identity_id,
            reason: validation.error,
            ip: req.ip,
            userAgent: req.headers["user-agent"] || null,
            metadata: { filename, mimetype, asset_kind: assetKind }
          });
          const error = assetKind === "media" ? "INVALID_IMAGE" : validation.error;
          return reply.code(415).send({
            ok: false,
            error,
            reason: validation.error,
            message: assetKind === "media"
              ? "The selected file is not a valid supported image or video."
              : "The selected document type is not supported."
          });
        }

        const uploadDir = ensureUploadDirectory(
          resolveAssetRoot(app.config),
          [
            session.tenant_id,
            "products",
            ...(assetKind === "document" ? ["documents"] : [])
          ]
        );
        const storedName = `${randomUUID()}${validation.safeExt}`;
        const targetPath = safeUploadTarget(uploadDir, storedName);

        const stored = await writeVerifiedUpload({
          app,
          targetPath,
          buffer,
          tenantId: session.tenant_id,
          storedName,
          assetKind,
          category: assetKind === "document" ? "product_documents" : "products",
          filename,
          mimetype
        });
        if (!stored.ok) {
          auditSecurityEvent(app, "upload.scan_pending", {
            category: "upload",
            source: "ecom.uploads",
            severity: stored.status === "blocked" ? "warning" : "info",
            outcome: "rejected",
            tenantId: session.tenant_id,
            identityId: session.identity_id,
            reason: stored.error,
            ip: req.ip,
            userAgent: req.headers["user-agent"] || null,
            metadata: { filename, mimetype, asset_kind: assetKind, scan_status: stored.scan_status }
          });
          return reply.code(stored.status === "blocked" ? 415 : 202).send({
            ok: false,
            error: stored.error,
            scan_status: stored.scan_status
          });
        }

        const rawUrl =
          assetKind === "document"
            ? `/assets/${session.tenant_id}/products/documents/${storedName}`
            : `/assets/${session.tenant_id}/products/${storedName}`;
        const ttlSec = Number(app.config.ASSET_TOKEN_TTL_SEC || 604800);
        const expiresAt = Math.floor(Date.now() / 1000) + (Number.isFinite(ttlSec) ? ttlSec : 604800);
        const signedUrl = buildSignedAssetUrl(rawUrl, expiresAt, app.config.API_KEY_PEPPER);
        return reply.send({
          ok: true,
          asset: {
            name: filename || storedName,
            url: signedUrl,
            raw_url: rawUrl,
            expires_at: new Date(expiresAt * 1000).toISOString(),
            type: mimetype || "",
            kind: assetKind
          }
        });
      } catch (error) {
        return sendUploadFailure(req, reply, error, { event: "ecom_upload_error" });
      }
    }
  );

  app.get(
    "/translation/status",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_PRODUCT_READ");
      if (!session) return;

      const client = await app.db.connect();
      try {
        const translationSettings = await loadCommerceTranslationSettings(client, session.tenant_id);
        const runtime = resolveTranslationRuntime(app.config, translationSettings);
        const sourceLocale = normalizeLocale(runtime.source_locale || "en") || "en";
        const targetLocale = Array.isArray(runtime.target_locales) && runtime.target_locales.length
          ? runtime.target_locales[0]
          : "";
        const status = await checkTranslationServiceAvailability({
          client,
          tenantId: session.tenant_id,
          runtime,
          sourceLocale,
          targetLocale
        });
        return reply.send({
          ok: true,
          available: status.available === true,
          state: status.available === true ? "connected" : "offline",
          message: status.available === true ? TRANSLATION_CONNECTED_MESSAGE : TRANSLATION_OFFLINE_MESSAGE,
          code: status.code || null
        });
      } catch (err) {
        app.log.warn({
          event: "translation_status_check_failed",
          tenant_id: session.tenant_id,
          error: err?.message || String(err)
        });
        return reply.send({
          ok: true,
          available: false,
          state: "offline",
          message: TRANSLATION_OFFLINE_MESSAGE,
          code: "TRANSLATION_STATUS_CHECK_FAILED"
        });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/storefront/content/studio-tabs",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_PRODUCT_READ");
      if (!session) return;

      try {
        const items = await loadStorefrontStudioTabs(app.db, session.tenant_id);
        return reply.send({ ok: true, items });
      } catch (err) {
        app.log.error({
          event: "storefront_studio_tab_list_failed",
          tenant_id: session.tenant_id,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "STUDIO_TAB_LIST_FAILED" });
      }
    }
  );

  app.put(
    "/storefront/content/studio-tabs/:code",
    {
      schema: {
        params: {
          type: "object",
          required: ["code"],
          properties: {
            code: { type: "string", maxLength: 80 }
          }
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string", maxLength: 120 },
            sort_order: { type: "integer", minimum: 1, maximum: 100000 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PRODUCT_WRITE");
      if (!session) return;

      const code = normalizeStorefrontCategoryCode(req.params?.code || "");
      if (!code) return reply.code(400).send({ ok: false, error: "INVALID_TAB_CODE" });
      const hasLabel = Object.prototype.hasOwnProperty.call(req.body || {}, "label");
      const hasSort = Object.prototype.hasOwnProperty.call(req.body || {}, "sort_order");
      if (!hasLabel && !hasSort) {
        return reply.code(400).send({ ok: false, error: "TAB_PATCH_EMPTY" });
      }
      const nextLabel = hasLabel ? normalizeStorefrontCategoryLabel(req.body?.label || "") : null;
      const nextSort = hasSort ? Number(req.body?.sort_order || 0) : null;
      if (hasLabel && !nextLabel) return reply.code(400).send({ ok: false, error: "TAB_LABEL_REQUIRED" });
      if (hasSort && (!Number.isInteger(nextSort) || nextSort < 1)) {
        return reply.code(400).send({ ok: false, error: "INVALID_SORT_ORDER" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const listId = await ensureStorefrontStudioTabList(client, session.tenant_id);
        await ensureDefaultStorefrontStudioTabs(client, session.tenant_id);
        const current = await client.query(
          `
          SELECT code, label, sort_order
          FROM eip_core.dropdown_value
          WHERE list_id = $1
            AND upper(code) = upper($2)
            AND is_active = true
          LIMIT 1
          `,
          [listId, code]
        );
        if (!current.rowCount) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "TAB_NOT_FOUND" });
        }

        const updated = await client.query(
          `
          UPDATE eip_core.dropdown_value
          SET label = $3,
              sort_order = $4,
              updated_at = now()
          WHERE list_id = $1
            AND upper(code) = upper($2)
            AND is_active = true
          RETURNING code, label, sort_order
          `,
          [
            listId,
            code,
            nextLabel || current.rows[0].label,
            hasSort ? nextSort : Number(current.rows[0].sort_order || 0)
          ]
        );
        const items = await loadStorefrontStudioTabs(client, session.tenant_id);
        await client.query("COMMIT");
        return reply.send({ ok: true, item: updated.rows[0], items });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({
          event: "storefront_studio_tab_update_failed",
          tenant_id: session.tenant_id,
          code,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "STUDIO_TAB_UPDATE_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/storefront/content/categories",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_PRODUCT_READ");
      if (!session) return;

      try {
        const items = await loadStorefrontCategories(app.db, session.tenant_id);
        return reply.send({ ok: true, items });
      } catch (err) {
        app.log.error({
          event: "storefront_categories_list_failed",
          tenant_id: session.tenant_id,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "CATEGORY_LIST_FAILED" });
      }
    }
  );

  app.post(
    "/storefront/content/categories",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            code: { type: "string", maxLength: 80 },
            label: { type: "string", maxLength: 120 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PRODUCT_WRITE");
      if (!session) return;

      const code = normalizeStorefrontCategoryCode(req.body?.code || "");
      const label = normalizeStorefrontCategoryLabel(req.body?.label || "");
      if (!code && !label) {
        return reply.code(400).send({ ok: false, error: "CATEGORY_CODE_OR_LABEL_REQUIRED" });
      }

      try {
        const created = await upsertStorefrontCategory(app.db, session.tenant_id, code, label);
        if (!created) return reply.code(400).send({ ok: false, error: "INVALID_CATEGORY_INPUT" });
        const items = await loadStorefrontCategories(app.db, session.tenant_id);
        return reply.send({ ok: true, item: created, items });
      } catch (err) {
        app.log.error({
          event: "storefront_category_upsert_failed",
          tenant_id: session.tenant_id,
          code: code || null,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "CATEGORY_SAVE_FAILED" });
      }
    }
  );

  app.get(
    "/product/categories",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, ["ECOM_PRODUCT_READ", "ECOM_ORDER_READ"]);
      if (!session) return;

      try {
        await ensureProductCategoryList(app.db, session.tenant_id);
        const items = await loadProductCategoryCatalog(app.db, session.tenant_id, { includeInactive: true });
        return reply.send({ ok: true, items });
      } catch (err) {
        app.log.error({
          event: "product_category_catalog_list_failed",
          tenant_id: session.tenant_id,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "PRODUCT_CATEGORY_CATALOG_LIST_FAILED" });
      }
    }
  );

  app.post(
    "/product/categories",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            code: { type: "string", maxLength: 80 },
            label: { type: "string", maxLength: 120 },
            sort_order: { type: "integer", minimum: 1, maximum: 100000 },
            is_active: { type: "boolean" },
            subcategories: { type: "array", maxItems: 200 },
            variant_headers: { type: "array", maxItems: 50 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, ["ECOM_PRODUCT_WRITE", "ECOM_SETTINGS_WRITE"]);
      if (!session) return;

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const upsert = await upsertProductCategoryCatalogEntry(client, session.tenant_id, req.body || {});
        if (!upsert.ok) {
          await client.query("ROLLBACK");
          return reply.code(400).send({
            ok: false,
            error: upsert.error || "PRODUCT_CATEGORY_CATALOG_UPSERT_INVALID",
            invalid_codes: upsert.invalid_codes || []
          });
        }
        const items = await loadProductCategoryCatalog(client, session.tenant_id, { includeInactive: true });
        await client.query("COMMIT");
        return reply.send({ ok: true, item: upsert.item, items });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({
          event: "product_category_catalog_upsert_failed",
          tenant_id: session.tenant_id,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "PRODUCT_CATEGORY_CATALOG_UPSERT_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.put(
    "/product/categories/:code",
    {
      schema: {
        params: {
          type: "object",
          required: ["code"],
          properties: {
            code: { type: "string", maxLength: 80 }
          }
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string", maxLength: 120 },
            sort_order: { type: "integer", minimum: 1, maximum: 100000 },
            is_active: { type: "boolean" },
            subcategories: { type: "array", maxItems: 200 },
            variant_headers: { type: "array", maxItems: 50 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, ["ECOM_PRODUCT_WRITE", "ECOM_SETTINGS_WRITE"]);
      if (!session) return;

      const code = normalizeProductCategoryCode(req.params?.code || "");
      if (!code) return reply.code(400).send({ ok: false, error: "INVALID_PRODUCT_CATEGORY_CODE" });

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const upsert = await upsertProductCategoryCatalogEntry(
          client,
          session.tenant_id,
          req.body || {},
          { code }
        );
        if (!upsert.ok) {
          await client.query("ROLLBACK");
          return reply.code(400).send({
            ok: false,
            error: upsert.error || "PRODUCT_CATEGORY_CATALOG_UPDATE_INVALID",
            invalid_codes: upsert.invalid_codes || []
          });
        }
        const items = await loadProductCategoryCatalog(client, session.tenant_id, { includeInactive: true });
        await client.query("COMMIT");
        return reply.send({ ok: true, item: upsert.item, items });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({
          event: "product_category_catalog_update_failed",
          tenant_id: session.tenant_id,
          code,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "PRODUCT_CATEGORY_CATALOG_UPDATE_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/variant-headers",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, ["ECOM_PRODUCT_READ", "ECOM_ORDER_READ"]);
      if (!session) return;

      try {
        await ensureVariantHeaderList(app.db, session.tenant_id);
        const items = await loadVariantHeaderCatalog(app.db, session.tenant_id, { includeInactive: true });
        return reply.send({ ok: true, items });
      } catch (err) {
        app.log.error({
          event: "variant_header_catalog_list_failed",
          tenant_id: session.tenant_id,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "VARIANT_HEADER_CATALOG_LIST_FAILED" });
      }
    }
  );

  app.post(
    "/variant-headers",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            code: { type: "string", maxLength: 80 },
            label: { type: "string", maxLength: 120 },
            sort_order: { type: "integer", minimum: 1, maximum: 100000 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, ["ECOM_PRODUCT_WRITE", "ECOM_SETTINGS_WRITE"]);
      if (!session) return;

      const codeInput = normalizeVariantHeaderCode(req.body?.code || req.body?.label || "");
      const labelInput = normalizeVariantHeaderLabel(req.body?.label, codeInput);
      const sortOrderInput = Number(req.body?.sort_order || 0);
      if (!codeInput || !labelInput) {
        return reply.code(400).send({ ok: false, error: "VARIANT_HEADER_CODE_OR_LABEL_REQUIRED" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const listId = await ensureVariantHeaderList(client, session.tenant_id);
        const maxSort = await client.query(
          `
          SELECT COALESCE(MAX(sort_order), 0) AS max_sort
          FROM eip_core.dropdown_value
          WHERE list_id = $1
          `,
          [listId]
        );
        const nextSort = Number.isInteger(sortOrderInput) && sortOrderInput > 0
          ? sortOrderInput
          : Number(maxSort.rows[0]?.max_sort || 0) + 10;
        const inserted = await client.query(
          `
          INSERT INTO eip_core.dropdown_value
            (list_id, code, label, sort_order, is_active, attrs)
          VALUES
            ($1, $2, $3, $4, true, '{}'::jsonb)
          ON CONFLICT (list_id, code) DO UPDATE
            SET label = EXCLUDED.label,
                sort_order = EXCLUDED.sort_order,
                is_active = true,
                updated_at = now()
          RETURNING code, label, sort_order, is_active
          `,
          [listId, codeInput, labelInput, nextSort]
        );
        const items = await loadVariantHeaderCatalog(client, session.tenant_id, { includeInactive: true });
        await client.query("COMMIT");
        return reply.send({ ok: true, item: inserted.rows[0], items });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({
          event: "variant_header_catalog_upsert_failed",
          tenant_id: session.tenant_id,
          code: codeInput,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "VARIANT_HEADER_CATALOG_UPSERT_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.put(
    "/variant-headers/:code",
    {
      schema: {
        params: {
          type: "object",
          required: ["code"],
          properties: {
            code: { type: "string", maxLength: 80 }
          }
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string", maxLength: 120 },
            sort_order: { type: "integer", minimum: 1, maximum: 100000 },
            is_active: { type: "boolean" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, ["ECOM_PRODUCT_WRITE", "ECOM_SETTINGS_WRITE"]);
      if (!session) return;

      const code = normalizeVariantHeaderCode(req.params?.code || "");
      const hasLabel = Object.prototype.hasOwnProperty.call(req.body || {}, "label");
      const hasSortOrder = Object.prototype.hasOwnProperty.call(req.body || {}, "sort_order");
      const hasActive = Object.prototype.hasOwnProperty.call(req.body || {}, "is_active");
      if (!code) return reply.code(400).send({ ok: false, error: "INVALID_VARIANT_HEADER_CODE" });
      if (!hasLabel && !hasSortOrder && !hasActive) {
        return reply.code(400).send({ ok: false, error: "VARIANT_HEADER_PATCH_EMPTY" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const listId = await ensureVariantHeaderList(client, session.tenant_id);
        const current = await client.query(
          `
          SELECT code, label, sort_order, is_active
          FROM eip_core.dropdown_value
          WHERE list_id = $1
            AND code = $2
          LIMIT 1
          `,
          [listId, code]
        );
        if (!current.rowCount) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "VARIANT_HEADER_NOT_FOUND" });
        }
        const nextLabel = hasLabel
          ? normalizeVariantHeaderLabel(req.body?.label, code)
          : normalizeVariantHeaderLabel(current.rows[0]?.label, code);
        const nextSortOrder = hasSortOrder
          ? Number(req.body?.sort_order || 0)
          : Number(current.rows[0]?.sort_order || 0);
        const nextActive = hasActive ? req.body?.is_active === true : current.rows[0]?.is_active !== false;
        if (!nextLabel) {
          await client.query("ROLLBACK");
          return reply.code(400).send({ ok: false, error: "VARIANT_HEADER_LABEL_REQUIRED" });
        }
        if (!Number.isInteger(nextSortOrder) || nextSortOrder < 1) {
          await client.query("ROLLBACK");
          return reply.code(400).send({ ok: false, error: "INVALID_SORT_ORDER" });
        }

        const updated = await client.query(
          `
          UPDATE eip_core.dropdown_value
          SET label = $3,
              sort_order = $4,
              is_active = $5,
              updated_at = now()
          WHERE list_id = $1
            AND code = $2
          RETURNING code, label, sort_order, is_active
          `,
          [listId, code, nextLabel, nextSortOrder, nextActive]
        );
        const items = await loadVariantHeaderCatalog(client, session.tenant_id, { includeInactive: true });
        await client.query("COMMIT");
        return reply.send({ ok: true, item: updated.rows[0], items });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({
          event: "variant_header_catalog_update_failed",
          tenant_id: session.tenant_id,
          code,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "VARIANT_HEADER_CATALOG_UPDATE_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/storefront/content/list",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            q: { type: "string", maxLength: 200 },
            slot: { type: "string", maxLength: 80 },
            page: { type: "string", maxLength: 80 },
            category_code: { type: "string", maxLength: 80 },
            status: { type: "string", maxLength: 50 },
            content_model: { type: "string", maxLength: 40 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_PRODUCT_READ");
      if (!session) return;

      const q = normalizeOptionalText(req.query?.q);
      const slot = normalizeContentSlot(req.query?.slot || "");
      const page = normalizeContentSlot(req.query?.page || "");
      const categoryCode = normalizeStorefrontCategoryCode(req.query?.category_code || "");
      const status = normalizeStage(req.query?.status || "");
      const contentModel = normalizeStorefrontContentModel(req.query?.content_model || "");
      const limit = clampLimit(req.query?.limit);
      const offset = Number(req.query?.offset || 0);
      const params = [session.tenant_id, STOREFRONT_CONTENT_OBJECT_TYPE];
      const filters = ["tenant_id = $1", "object_type = $2"];

      if (slot) {
        params.push(slot);
        filters.push(`COALESCE(attrs->>'slot', '') = $${params.length}`);
      }
      if (page) {
        params.push(page);
        filters.push(`COALESCE(attrs->>'page', split_part(COALESCE(attrs->>'slot',''), '.', 1)) = $${params.length}`);
      }
      if (categoryCode) {
        params.push(categoryCode);
        filters.push(
          `upper(COALESCE(attrs->>'content_category_code', attrs->'content_category'->>'code', '')) = $${params.length}`
        );
      }
      if (status && status !== "all") {
        params.push(status);
        filters.push(`lower(status) = $${params.length}`);
      } else {
        filters.push(`lower(status) NOT IN ('deleted', 'cancelled')`);
      }
      if (normalizeText(req.query?.content_model || "")) {
        params.push(contentModel);
        filters.push(`COALESCE(attrs->>'content_model', '${STOREFRONT_CONTENT_MODEL_SINGLETON}') = $${params.length}`);
      }

      if (q) {
        params.push(`%${q}%`);
        filters.push(
          `(COALESCE(title, '') ILIKE $${params.length}
            OR COALESCE(attrs->>'title', '') ILIKE $${params.length}
            OR COALESCE(attrs->>'slot', '') ILIKE $${params.length}
            OR COALESCE(attrs->>'content_category_label', attrs->'content_category'->>'label', attrs->>'content_category_code', '') ILIKE $${params.length}
            OR COALESCE(attrs->'article'->>'title', '') ILIKE $${params.length}
            OR COALESCE(attrs->'article'->>'excerpt', '') ILIKE $${params.length}
            OR COALESCE(attrs->'article'->>'body', '') ILIKE $${params.length})`
        );
      }

      const countRes = await app.db.query(
        `
        SELECT COUNT(*)::int AS total
        FROM eip_core.service_object
        WHERE ${filters.join(" AND ")}
        `,
        params
      );
      const total = Number(countRes.rows[0]?.total || 0);

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

      return reply.send({
        ok: true,
        items: r.rows.map((row) => mapStorefrontContentRow(row)),
        total,
        limit,
        offset
      });
    }
  );

  app.get(
    "/storefront/content",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            slot: { type: "string", maxLength: 80 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_PRODUCT_READ");
      if (!session) return;

      const slot = normalizeContentSlot(req.query?.slot || "home.hero");
      if (!slot) return reply.code(400).send({ ok: false, error: "INVALID_SLOT" });

      const r = await app.db.query(
        `
        SELECT id, code, title, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = $2
          AND attrs->>'slot' = $3
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
        `,
        [session.tenant_id, STOREFRONT_CONTENT_OBJECT_TYPE, slot]
      );
      if (r.rowCount === 0) {
        return reply.send({ ok: true, item: null, slot });
      }

      return reply.send({
        ok: true,
        item: mapStorefrontContentRow(r.rows[0])
      });
    }
  );

  app.get(
    "/storefront/structure/connections",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_PRODUCT_READ");
      if (!session) return;

      const tenantRes = await app.db.query(
        "SELECT attrs FROM eip_core.tenant WHERE id = $1::uuid",
        [session.tenant_id]
      );
      if (tenantRes.rowCount === 0) {
        return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
      }

      const profiles = extractProfiles(tenantRes.rows[0]?.attrs || {});
      const connections = profiles.map(mapStructureConnection);
      const selected = selectStructureConnection(profiles);
      return reply.send({
        ok: true,
        items: connections,
        selected_connection_code: normalizeText(selected.profile?.identity?.connection_code || "")
      });
    }
  );

  app.get(
    "/storefront/structure/scanner-diagnostic",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_PRODUCT_READ");
      if (!session) return;
      return reply.send({
        ok: true,
        item: buildRenderedDomScannerDiagnostic(app.config)
      });
    }
  );

  app.get(
    "/storefront/structure",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_PRODUCT_READ");
      if (!session) return;

      const row = await app.db.query(
        `
        SELECT id, code, title, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = $2
          AND attrs->>'scope' = $3
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
        `,
        [session.tenant_id, STOREFRONT_STRUCTURE_OBJECT_TYPE, STOREFRONT_STRUCTURE_SCOPE]
      );
      const item = row.rowCount ? mapStorefrontStructureRow(row.rows[0]) : null;
      return reply.send({
        ok: true,
        item,
        tags: Array.isArray(item?.zones) ? item.zones.map((zone) => zone.tag) : []
      });
    }
  );

  app.post(
    "/storefront/structure/scan",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            connection_code: { type: "string", maxLength: 65 },
            scan_mode: { type: "string", enum: ["auto", "rendered", "generic", "tagged"] }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PRODUCT_WRITE");
      if (!session) return;

      const tenantRes = await app.db.query(
        "SELECT attrs FROM eip_core.tenant WHERE id = $1::uuid",
        [session.tenant_id]
      );
      if (tenantRes.rowCount === 0) {
        return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
      }

      const profiles = extractProfiles(tenantRes.rows[0]?.attrs || {});
      const selected = selectStructureConnection(profiles, req.body?.connection_code);
      if (!selected.profile) {
        const status = selected.error === "CONNECTION_NOT_FOUND" ? 404 : 400;
        return reply.code(status).send({ ok: false, error: selected.error || "NO_CONNECTED_FRONTEND" });
      }

      const connectionCode = normalizeText(selected.profile.identity?.connection_code);
      const connectionName = normalizeText(selected.profile.identity?.connection_name);
      const frontendUrl = normalizeHttpUrl(selected.profile.identity?.frontend_url);
      if (!frontendUrl) {
        return reply.code(400).send({ ok: false, error: "INVALID_FRONTEND_URL" });
      }
      const requestedScanMode = normalizeText(req.body?.scan_mode || "auto").toLowerCase() || "auto";
      const allowedScanModes = Array.isArray(selected.profile.public_storefront?.allowed_scan_modes)
        ? selected.profile.public_storefront.allowed_scan_modes
        : ["auto", "rendered", "generic", "tagged"];
      if (selected.profile.public_storefront?.scan_allowed === false) {
        return reply.code(403).send({ ok: false, error: "STOREFRONT_SCAN_DISABLED" });
      }
      if (!allowedScanModes.includes(requestedScanMode)) {
        return reply.code(403).send({ ok: false, error: "STOREFRONT_SCAN_MODE_NOT_ALLOWED" });
      }

      let scanned;
      try {
        scanned = await buildStructureScanFromFrontend(
          frontendUrl,
          selected.profile,
          requestedScanMode,
          app.config
        );
      } catch (error) {
        app.log.error({
          event: "storefront_structure_scan_failed",
          tenant_id: session.tenant_id,
          connection_code: connectionCode || null,
          frontend_url: frontendUrl,
          error: error?.message || String(error)
        });
        return reply.code(500).send({ ok: false, error: "STRUCTURE_SCAN_FAILED" });
      }

      if (
        !Number(scanned?.usable_candidate_count || 0) &&
        (!Array.isArray(scanned?.candidate_zones) || !scanned.candidate_zones.length)
      ) {
        return reply.code(409).send({
          ok: false,
          error: "STRUCTURE_ZONES_NOT_FOUND",
          connection_code: connectionCode || null,
          frontend_url: frontendUrl,
          scan_report: {
            scan_mode: scanned?.scan_mode || "auto",
            scan_source: scanned?.scan_source || "",
            generic_candidate_count: Number(scanned?.generic_candidate_count || 0),
            tagged_candidate_count: Number(scanned?.tagged_candidate_count || 0),
            usable_candidate_count: 0,
            rendered_shell_detected: scanned?.rendered_shell_detected === true,
            rendered_dom_attempted: scanned?.rendered_dom_attempted === true,
            rendered_dom_available: scanned?.rendered_dom_available === true,
            rendered_dom_error: scanned?.rendered_dom_error || null,
            fallback_recommendation: scanned?.fallback_recommendation || null,
            unmapped_candidates: Array.isArray(scanned?.unmapped_candidates) ? scanned.unmapped_candidates : []
          }
        });
      }

      if (requestedScanMode === "rendered" && scanned?.rendered_dom_available !== true) {
        return reply.code(409).send({
          ok: false,
          error: scanned?.rendered_dom_error || "RENDERED_DOM_SCANNER_UNAVAILABLE",
          connection_code: connectionCode || null,
          frontend_url: frontendUrl,
          scan_report: {
            scan_mode: scanned?.scan_mode || "rendered",
            scan_source: scanned?.scan_source || "rendered_dom_scan_unavailable",
            rendered_shell_detected: scanned?.rendered_shell_detected === true,
            rendered_dom_attempted: scanned?.rendered_dom_attempted === true,
            rendered_dom_available: false,
            rendered_dom_error: scanned?.rendered_dom_error || "RENDERED_DOM_SCANNER_UNAVAILABLE",
            rendered_dom_candidate_count: Number(scanned?.rendered_dom_candidate_count || 0),
            fallback_recommendation: scanned?.fallback_recommendation || "configure_rendered_dom_scanner"
          }
        });
      }

      const existing = await app.db.query(
        `
        SELECT id, attrs
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = $2
          AND attrs->>'scope' = $3
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
        `,
        [session.tenant_id, STOREFRONT_STRUCTURE_OBJECT_TYPE, STOREFRONT_STRUCTURE_SCOPE]
      );
      const previousAttrs =
        existing.rows[0]?.attrs && typeof existing.rows[0].attrs === "object"
          ? existing.rows[0].attrs
          : {};
      const mappingProfile = buildMappingProfile({
        tenantId: session.tenant_id,
        connectionCode,
        frontendUrl,
        scan: scanned,
        previous: findStructureMappingProfile(previousAttrs, connectionCode)
      });
      const attrs = {
        scope: STOREFRONT_STRUCTURE_SCOPE,
        title: "Storefront structure",
        source_type: "gateway_connection",
        connection_code: connectionCode || null,
        connection_name: connectionName || null,
        frontend_url: frontendUrl,
        ...scanned,
        mapping_profile: mappingProfile,
        mapping_profiles: upsertStructureMappingProfile(previousAttrs.mapping_profiles, mappingProfile),
        zones: mappingProfileZones(mappingProfile),
        updated_at: new Date().toISOString(),
        updated_by_identity_id: session.identity_id
      };

      let persisted;
      if (existing.rowCount) {
        persisted = await app.db.query(
          `
          UPDATE eip_core.service_object
          SET title = $4,
              status = 'published',
              attrs = $5::jsonb,
              updated_at = now()
          WHERE tenant_id = $1
            AND id = $2
            AND object_type = $3
          RETURNING id, code, title, status, attrs, created_at, updated_at
          `,
          [
            session.tenant_id,
            existing.rows[0].id,
            STOREFRONT_STRUCTURE_OBJECT_TYPE,
            "Storefront structure",
            JSON.stringify(attrs)
          ]
        );
      } else {
        const code = `STR-${randomUUID().slice(0, 8).toUpperCase()}`;
        persisted = await app.db.query(
          `
          INSERT INTO eip_core.service_object
            (tenant_id, object_type, status, code, title, attrs)
          VALUES
            ($1, $2, 'published', $3, $4, $5::jsonb)
          RETURNING id, code, title, status, attrs, created_at, updated_at
          `,
          [
            session.tenant_id,
            STOREFRONT_STRUCTURE_OBJECT_TYPE,
            code,
            "Storefront structure",
            JSON.stringify({
              ...attrs,
              created_at: new Date().toISOString(),
              created_by_identity_id: session.identity_id
            })
          ]
        );
      }

      const item = mapStorefrontStructureRow(persisted.rows[0]);
      return reply.send({
        ok: true,
        connection: mapStructureConnection(selected.profile),
        item,
        requires_manual_review: !Number(scanned?.usable_candidate_count || 0),
        fallback_recommendation: scanned?.fallback_recommendation || null,
        tags: item.zones.map((zone) => zone.tag)
      });
    }
  );

  app.put(
    "/storefront/structure/mappings/:candidateId",
    {
      schema: {
        params: {
          type: "object",
          required: ["candidateId"],
          properties: {
            candidateId: { type: "string", maxLength: 100 }
          }
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["mapping_status"],
          properties: {
            mapping_status: { type: "string", enum: ["proposed", "approved", "ignored", "needs_review"] },
            suggested_slot: { type: "string", maxLength: 80 },
            suggested_renderer: { type: "string", maxLength: 80 },
            selector: { type: "string", maxLength: 500 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PRODUCT_WRITE");
      if (!session) return;

      const row = await app.db.query(
        `
        SELECT id, code, title, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = $2
          AND attrs->>'scope' = $3
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
        `,
        [session.tenant_id, STOREFRONT_STRUCTURE_OBJECT_TYPE, STOREFRONT_STRUCTURE_SCOPE]
      );
      if (!row.rowCount) return reply.code(404).send({ ok: false, error: "STOREFRONT_STRUCTURE_NOT_FOUND" });

      const attrs = row.rows[0]?.attrs && typeof row.rows[0].attrs === "object" ? row.rows[0].attrs : {};
      const profile = attrs.mapping_profile && typeof attrs.mapping_profile === "object"
        ? attrs.mapping_profile
        : null;
      if (!profile) return reply.code(409).send({ ok: false, error: "MAPPING_PROFILE_NOT_FOUND" });

      let nextProfile;
      try {
        nextProfile = updateMappingCandidate(profile, {
          candidate_id: req.params.candidateId,
          ...req.body
        });
      } catch (error) {
        const code = normalizeText(error?.message || "MAPPING_UPDATE_FAILED");
        const status = code === "CANDIDATE_NOT_FOUND" ? 404 : 400;
        return reply.code(status).send({ ok: false, error: code });
      }

      const updated = await app.db.query(
        `
        UPDATE eip_core.service_object
        SET attrs = $4::jsonb,
            updated_at = now()
        WHERE tenant_id = $1
          AND id = $2
          AND object_type = $3
        RETURNING id, code, title, status, attrs, created_at, updated_at
        `,
        [
          session.tenant_id,
          row.rows[0].id,
          STOREFRONT_STRUCTURE_OBJECT_TYPE,
          JSON.stringify({
            ...attrs,
            mapping_profile: nextProfile,
            mapping_profiles: upsertStructureMappingProfile(attrs.mapping_profiles, nextProfile),
            zones: mappingProfileZones(nextProfile),
            updated_at: new Date().toISOString(),
            updated_by_identity_id: session.identity_id
          })
        ]
      );
      return reply.send({ ok: true, item: mapStorefrontStructureRow(updated.rows[0]) });
    }
  );

  app.put(
    "/storefront/content/:slot",
    {
      schema: {
        params: {
          type: "object",
          required: ["slot"],
          properties: {
            slot: { type: "string", maxLength: 80 }
          }
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", maxLength: 250 },
            category_code: { type: "string", maxLength: 80 },
            is_active: { type: "boolean" },
            slides: { type: "array", maxItems: 12 },
            attrs: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PRODUCT_WRITE");
      if (!session) return;

      const slot = normalizeContentSlot(req.params.slot || req.body?.slot || "home.hero");
      if (!slot) return reply.code(400).send({ ok: false, error: "INVALID_SLOT" });

      const title = normalizeOptionalText(req.body?.title);
      const slides = normalizeStorefrontSlides(req.body?.slides || []);
      const attrsPatch = req.body?.attrs && typeof req.body.attrs === "object" ? req.body.attrs : {};
      const isActive = req.body?.is_active !== false;
      const hasCategoryCodeInBody = Object.prototype.hasOwnProperty.call(req.body || {}, "category_code");
      const requestedCategoryCode = normalizeStorefrontCategoryCode(
        req.body?.category_code || attrsPatch?.content_category_code || ""
      );
      let category = null;
      if (requestedCategoryCode) {
        category = await findStorefrontCategory(app.db, session.tenant_id, requestedCategoryCode);
        if (!category) return reply.code(400).send({ ok: false, error: "INVALID_CATEGORY_CODE" });
      }

      const existing = await app.db.query(
        `
        SELECT id, code, title, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = $2
          AND attrs->>'slot' = $3
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
        `,
        [session.tenant_id, STOREFRONT_CONTENT_OBJECT_TYPE, slot]
      );

      const nowIso = new Date().toISOString();
      if (existing.rowCount > 0) {
        const row = existing.rows[0];
        const prevAttrs = row.attrs && typeof row.attrs === "object" ? row.attrs : {};
        const nextAttrs = {
          ...prevAttrs,
          ...attrsPatch,
          slot,
          title: title || prevAttrs.title || row.title || null,
          is_active: isActive,
          slides,
          updated_at: nowIso,
          updated_by_identity_id: session.identity_id
        };
        if (hasCategoryCodeInBody) {
          if (category?.code) {
            nextAttrs.content_category_code = category.code;
            nextAttrs.content_category_label = category.label;
            nextAttrs.content_category = { code: category.code, label: category.label };
          } else {
            delete nextAttrs.content_category_code;
            delete nextAttrs.content_category_label;
            delete nextAttrs.content_category;
          }
        }
        const contentChanged = !isDeepStrictEqual(
          toComparableStorefrontAttrs(prevAttrs, row.title),
          toComparableStorefrontAttrs(nextAttrs, title || row.title)
        );
        const shouldRequireRepublish = isPublishedStorefrontContent(row, prevAttrs) && contentChanged;
        const attrsToPersist = shouldRequireRepublish
          ? markAttrsRepublishRequired(nextAttrs)
          : nextAttrs;

        const updated = await app.db.query(
          `
          UPDATE eip_core.service_object
          SET title = COALESCE($4, title),
              status = CASE WHEN $6::boolean THEN 'new' ELSE status END,
              attrs = $5::jsonb,
              updated_at = now()
          WHERE tenant_id = $1
            AND id = $2
            AND object_type = $3
          RETURNING id, code, title, status, attrs, created_at, updated_at
          `,
          [
            session.tenant_id,
            row.id,
            STOREFRONT_CONTENT_OBJECT_TYPE,
            title,
            JSON.stringify(attrsToPersist),
            shouldRequireRepublish
          ]
        );
        return reply.send({
          ok: true,
          item: mapStorefrontContentRow(updated.rows[0]),
          republish_required: shouldRequireRepublish
        });
      }

      const code = `CNT-${slot.toUpperCase().replace(/[^A-Z0-9]/g, "-")}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const attrs = {
        ...attrsPatch,
        slot,
        title: title || `Storefront ${slot}`,
        is_active: isActive,
        slides,
        created_at: nowIso,
        created_by_identity_id: session.identity_id
      };
      if (hasCategoryCodeInBody && category?.code) {
        attrs.content_category_code = category.code;
        attrs.content_category_label = category.label;
        attrs.content_category = { code: category.code, label: category.label };
      }

      const inserted = await app.db.query(
        `
        INSERT INTO eip_core.service_object
          (tenant_id, object_type, status, code, title, attrs)
        VALUES
          ($1, $2, 'new', $3, $4, $5::jsonb)
        RETURNING id, code, title, status, attrs, created_at, updated_at
        `,
        [
          session.tenant_id,
          STOREFRONT_CONTENT_OBJECT_TYPE,
          code,
          title || `Storefront ${slot}`,
          JSON.stringify(attrs)
        ]
      );
      return reply.send({ ok: true, item: mapStorefrontContentRow(inserted.rows[0]) });
    }
  );

  app.post(
    "/storefront/content/:slot/actions",
    {
      schema: {
        params: {
          type: "object",
          required: ["slot"],
          properties: {
            slot: { type: "string", maxLength: 80 }
          }
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["action"],
          properties: {
            action: { type: "string", maxLength: 100 },
            publish_english_only: { type: "boolean" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PRODUCT_WRITE");
      if (!session) return;

      const slot = normalizeContentSlot(req.params.slot || "home.hero");
      if (!slot) return reply.code(400).send({ ok: false, error: "INVALID_SLOT" });

      const action = normalizeText(req.body?.action).toUpperCase();
      const publishEnglishOnly = req.body?.publish_english_only === true;
      if (!STOREFRONT_CONTENT_ACTIONS.has(action)) {
        return reply.code(400).send({ ok: false, error: "INVALID_ACTION" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const existing = await client.query(
          `
          SELECT id, code, title, status, attrs, created_at, updated_at
          FROM eip_core.service_object
          WHERE tenant_id = $1
            AND object_type = $2
            AND attrs->>'slot' = $3
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 1
          `,
          [session.tenant_id, STOREFRONT_CONTENT_OBJECT_TYPE, slot]
        );

        if (existing.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
        }

        const row = existing.rows[0];
        const instanceRes = await ensureProcessInstanceForObject(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          objectType: STOREFRONT_CONTENT_OBJECT_TYPE,
          serviceObjectId: row.id,
          requireBinding: true
        });
        if (!instanceRes.ok || !instanceRes.instance?.id) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error || "PROCESS_INSTANCE_REQUIRED" });
        }

        const basePayload = {
          service_object_id: row.id,
          slot,
          title: normalizeOptionalText(row.title)
        };
        const lifecycleKey = storefrontContentLifecycleKey(row);

        if (action === "DRAFT_READY") {
          const intake = await app.coreProcess.advanceInstance(client, {
            tenantId: session.tenant_id,
            identityId: session.identity_id,
            instanceId: instanceRes.instance.id,
            action: "INTAKE",
            payload: basePayload,
            idempotencyKey: buildIdempotencyKey("storefront_content_intake", {
              id: row.id,
              slot,
              lifecycle: lifecycleKey
            })
          });
          if (!intake.ok && intake.error !== "INVALID_TRANSITION") {
            await client.query("ROLLBACK");
            return reply.code(409).send({ ok: false, error: intake.error });
          }
        }

        let translationState = null;
        if (action === "PUBLISH") {
          const translationSettings = await loadCommerceTranslationSettings(client, session.tenant_id);
          const runtime = resolveTranslationRuntime(app.config, translationSettings);
          const sourceLocale = normalizeLocale(runtime.source_locale || "en") || "en";
          const units = extractStorefrontContentTranslationUnits(
            row?.attrs && typeof row.attrs === "object" ? row.attrs : {},
            sourceLocale
          );
          const translationAttempt = units.length
            ? await translateUnitsAtPublish(client, session.tenant_id, app.config, translationSettings, units)
            : {
                ok: true,
                publish_state: TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION,
                source_locale: sourceLocale,
                target_locales: runtime.target_locales || [],
                provider_code: runtime.provider_code || null,
                source_map: {},
                translations_by_locale: {}
              };
          if (!translationAttempt.ok && !publishEnglishOnly) {
            await client.query("ROLLBACK");
            return reply.send({
              ok: true,
              publish_state: TRANSLATION_PUBLISH_STATE_CONFIRM_REQUIRED,
              message: TRANSLATION_PUBLISH_CONFIRM_MESSAGE,
              translation: {
                status: "unavailable",
                source_locale: translationAttempt.source_locale || sourceLocale,
                target_locales: translationAttempt.target_locales || [],
                error_code: translationAttempt.error_code || "TRANSLATION_PROVIDER_ERROR",
                error_message: translationAttempt.error_message || null
              }
            });
          }
          translationState = translationAttempt.ok
            ? {
                publish_state: TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION,
                source_locale: translationAttempt.source_locale,
                target_locales: translationAttempt.target_locales,
                provider_code: translationAttempt.provider_code,
                source_map: translationAttempt.source_map,
                translations_by_locale: translationAttempt.translations_by_locale,
                error_code: null
              }
            : {
                publish_state: TRANSLATION_PUBLISH_STATE_ENGLISH_ONLY,
                source_locale: translationAttempt.source_locale || sourceLocale,
                target_locales: translationAttempt.target_locales || [],
                provider_code: runtime.provider_code || null,
                source_map: {},
                translations_by_locale: {},
                error_code: translationAttempt.error_code || "TRANSLATION_PROVIDER_ERROR",
                error_message: translationAttempt.error_message || null
              };
        }

        const transition = await app.coreProcess.advanceInstance(client, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          instanceId: instanceRes.instance.id,
          action,
          payload: basePayload,
          idempotencyKey: buildIdempotencyKey("storefront_content_action", {
            id: row.id,
            action,
            from_status: normalizeText(row.status || ""),
            lifecycle: lifecycleKey
          })
        });
        if (!transition.ok) {
          const targetStatus = storefrontTargetStatusForAction(action);
          if (
            transition.error === "INVALID_TRANSITION" &&
            targetStatus &&
            normalizeText(row.status) === normalizeText(targetStatus)
          ) {
            const current = await client.query(
              `
              SELECT id, code, title, status, attrs, created_at, updated_at
              FROM eip_core.service_object
              WHERE tenant_id = $1
                AND id = $2
                AND object_type = $3
              `,
              [session.tenant_id, row.id, STOREFRONT_CONTENT_OBJECT_TYPE]
            );
            await client.query("COMMIT");
            return reply.send({
              ok: true,
              reused: true,
              item: current.rowCount ? mapStorefrontContentRow(current.rows[0]) : mapStorefrontContentRow(row)
            });
          }
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: transition.error });
        }

        const updated = await client.query(
          `
          SELECT id, code, title, status, attrs, created_at, updated_at
          FROM eip_core.service_object
          WHERE tenant_id = $1
            AND id = $2
            AND object_type = $3
          `,
          [session.tenant_id, row.id, STOREFRONT_CONTENT_OBJECT_TYPE]
        );

        if (action === "PUBLISH" && translationState) {
          const currentAttrs = updated.rows[0]?.attrs && typeof updated.rows[0].attrs === "object"
            ? updated.rows[0].attrs
            : {};
          const existingTranslation = currentAttrs.translation && typeof currentAttrs.translation === "object"
            ? currentAttrs.translation
            : {};
          const metadata = buildTranslationMetadata({
            previous: existingTranslation,
            publishState: translationState.publish_state,
            sourceLocale: translationState.source_locale,
            targetLocales: translationState.target_locales,
            providerCode: translationState.provider_code,
            sourceMap: translationState.source_map,
            translationsByLocale: translationState.translations_by_locale,
            errorCode: translationState.error_code
          });
          await persistStorefrontTranslationMetadata(client, session.tenant_id, row.id, metadata);
        }

        await client.query("COMMIT");
        if (action === "PUBLISH" && translationState) {
          const publishState = translationState.publish_state;
          return reply.send({
            ok: true,
            reused: transition.reused === true,
            publish_state: publishState,
            message:
              publishState === TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION
                ? TRANSLATION_PUBLISH_SUCCESS_MESSAGE
                : TRANSLATION_PUBLISH_ENGLISH_ONLY_MESSAGE,
            item: mapStorefrontContentRow(updated.rows[0]),
            translation: {
              status: publishState === TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION ? "translated" : "english_only",
              source_locale: translationState.source_locale,
              target_locales: translationState.target_locales,
              error_code: translationState.error_code || null,
              error_message: translationState.error_message || null
            }
          });
        }
        return reply.send({ ok: true, reused: transition.reused === true, item: mapStorefrontContentRow(updated.rows[0]) });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({
          event: "storefront_content_action_failed",
          tenant_id: session.tenant_id,
          slot,
          action,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "CONTENT_ACTION_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.delete(
    "/storefront/content/:slot",
    {
      schema: {
        params: {
          type: "object",
          required: ["slot"],
          properties: {
            slot: { type: "string", maxLength: 80 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PRODUCT_WRITE");
      if (!session) return;

      const slot = normalizeContentSlot(req.params.slot || "home.hero");
      if (!slot) return reply.code(400).send({ ok: false, error: "INVALID_SLOT" });

      const deleted = await app.db.query(
        `
        DELETE FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = $2
          AND attrs->>'slot' = $3
        `,
        [session.tenant_id, STOREFRONT_CONTENT_OBJECT_TYPE, slot]
      );

      if (!deleted.rowCount) {
        return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      }

      return reply.send({ ok: true, deleted: true, slot, count: deleted.rowCount });
    }
  );

  app.post(
    "/storefront/content/items",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["slot", "content_model"],
          properties: {
            slot: { type: "string", maxLength: 80 },
            title: { type: "string", maxLength: 250 },
            category_code: { type: "string", maxLength: 80 },
            is_active: { type: "boolean" },
            content_model: { type: "string", maxLength: 40 },
            article: { type: "object" },
            attrs: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PRODUCT_WRITE");
      if (!session) return;

      const slot = normalizeContentSlot(req.body?.slot || "");
      if (!slot) return reply.code(400).send({ ok: false, error: "INVALID_SLOT" });

      const contentModel = normalizeStorefrontContentModel(req.body?.content_model);
      if (contentModel !== STOREFRONT_CONTENT_MODEL_ARTICLE) {
        return reply.code(400).send({ ok: false, error: "UNSUPPORTED_CONTENT_MODEL" });
      }

      const title = normalizeOptionalText(req.body?.title);
      const article = normalizeStorefrontArticle(req.body?.article || {});
      if (!article || !normalizeOptionalText(article.title)) {
        return reply.code(400).send({ ok: false, error: "ARTICLE_TITLE_REQUIRED" });
      }
      const requestedCategoryCode = normalizeStorefrontCategoryCode(
        req.body?.category_code || req.body?.attrs?.content_category_code || ""
      );
      const category = requestedCategoryCode
        ? await findStorefrontCategory(app.db, session.tenant_id, requestedCategoryCode)
        : null;
      if (requestedCategoryCode && !category) {
        return reply.code(400).send({ ok: false, error: "INVALID_CATEGORY_CODE" });
      }

      const attrs = buildStorefrontContentAttrs({
        previous: {},
        slot,
        title: title || article.title,
        isActive: req.body?.is_active !== false,
        article,
        categoryCode: category?.code || "",
        categoryLabel: category?.label || null,
        attrsPatch: req.body?.attrs && typeof req.body.attrs === "object" ? req.body.attrs : {},
        identityId: session.identity_id
      });
      attrs.created_at = new Date().toISOString();
      attrs.created_by_identity_id = session.identity_id;

      const code = `CNT-${slot.toUpperCase().replace(/[^A-Z0-9]/g, "-")}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const inserted = await app.db.query(
        `
        INSERT INTO eip_core.service_object
          (tenant_id, object_type, status, code, title, attrs)
        VALUES
          ($1, $2, 'new', $3, $4, $5::jsonb)
        RETURNING id, code, title, status, attrs, created_at, updated_at
        `,
        [
          session.tenant_id,
          STOREFRONT_CONTENT_OBJECT_TYPE,
          code,
          title || article.title || `Storefront ${slot}`,
          JSON.stringify(attrs)
        ]
      );
      return reply.send({ ok: true, item: mapStorefrontContentRow(inserted.rows[0]) });
    }
  );

  app.get(
    "/storefront/content/items/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", maxLength: 80 } }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_PRODUCT_READ");
      if (!session) return;

      const idOrCode = normalizeText(req.params?.id || "");
      if (!idOrCode) return reply.code(400).send({ ok: false, error: "CONTENT_ID_REQUIRED" });

      const row = await app.db.query(
        `
        SELECT id, code, title, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = $2
          AND (id::text = $3 OR code = $3)
        LIMIT 1
        `,
        [session.tenant_id, STOREFRONT_CONTENT_OBJECT_TYPE, idOrCode]
      );
      if (!row.rowCount) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, item: mapStorefrontContentRow(row.rows[0]) });
    }
  );

  app.put(
    "/storefront/content/items/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", maxLength: 80 } }
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", maxLength: 250 },
            slot: { type: "string", maxLength: 80 },
            category_code: { type: "string", maxLength: 80 },
            is_active: { type: "boolean" },
            article: { type: "object" },
            attrs: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PRODUCT_WRITE");
      if (!session) return;

      const idOrCode = normalizeText(req.params?.id || "");
      if (!idOrCode) return reply.code(400).send({ ok: false, error: "CONTENT_ID_REQUIRED" });

      const existing = await app.db.query(
        `
        SELECT id, code, title, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = $2
          AND (id::text = $3 OR code = $3)
        LIMIT 1
        `,
        [session.tenant_id, STOREFRONT_CONTENT_OBJECT_TYPE, idOrCode]
      );
      if (!existing.rowCount) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      const row = existing.rows[0];
      const prevAttrs = row.attrs && typeof row.attrs === "object" ? row.attrs : {};
      const slot = normalizeContentSlot(req.body?.slot || prevAttrs.slot || "home.hero");
      const article = normalizeStorefrontArticle(req.body?.article || prevAttrs.article || {});
      if (!article || !normalizeOptionalText(article.title)) {
        return reply.code(400).send({ ok: false, error: "ARTICLE_TITLE_REQUIRED" });
      }
      const hasCategoryCodeInBody = Object.prototype.hasOwnProperty.call(req.body || {}, "category_code");
      const requestedCategoryCode = normalizeStorefrontCategoryCode(
        req.body?.category_code || req.body?.attrs?.content_category_code || prevAttrs?.content_category_code || ""
      );
      const category = requestedCategoryCode
        ? await findStorefrontCategory(app.db, session.tenant_id, requestedCategoryCode)
        : null;
      if (requestedCategoryCode && !category) {
        return reply.code(400).send({ ok: false, error: "INVALID_CATEGORY_CODE" });
      }

      const nextAttrs = buildStorefrontContentAttrs({
        previous: prevAttrs,
        slot,
        title: normalizeOptionalText(req.body?.title) || article.title || row.title,
        isActive: req.body?.is_active !== false,
        article,
        categoryCode: category?.code || "",
        categoryLabel: category?.label || null,
        attrsPatch: req.body?.attrs && typeof req.body.attrs === "object" ? req.body.attrs : {},
        identityId: session.identity_id
      });
      if (hasCategoryCodeInBody && !requestedCategoryCode) {
        delete nextAttrs.content_category_code;
        delete nextAttrs.content_category_label;
        delete nextAttrs.content_category;
      }
      const contentChanged = !isDeepStrictEqual(
        toComparableStorefrontAttrs(prevAttrs, row.title),
        toComparableStorefrontAttrs(nextAttrs, normalizeOptionalText(req.body?.title) || article.title || row.title)
      );
      const shouldRequireRepublish = isPublishedStorefrontContent(row, prevAttrs) && contentChanged;
      const attrsToPersist = shouldRequireRepublish
        ? markAttrsRepublishRequired(nextAttrs)
        : nextAttrs;

      const updated = await app.db.query(
        `
        UPDATE eip_core.service_object
        SET title = $4,
            status = CASE WHEN $6::boolean THEN 'new' ELSE status END,
            attrs = $5::jsonb,
            updated_at = now()
        WHERE tenant_id = $1
          AND id = $2
          AND object_type = $3
        RETURNING id, code, title, status, attrs, created_at, updated_at
        `,
        [
          session.tenant_id,
          row.id,
          STOREFRONT_CONTENT_OBJECT_TYPE,
          normalizeOptionalText(req.body?.title) || article.title || row.title || `Storefront ${slot}`,
          JSON.stringify(attrsToPersist),
          shouldRequireRepublish
        ]
      );
      return reply.send({
        ok: true,
        item: mapStorefrontContentRow(updated.rows[0]),
        republish_required: shouldRequireRepublish
      });
    }
  );

  app.post(
    "/storefront/content/items/:id/actions",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", maxLength: 80 } }
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["action"],
          properties: {
            action: { type: "string", enum: [...STOREFRONT_CONTENT_ACTIONS] },
            publish_english_only: { type: "boolean" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PRODUCT_WRITE");
      if (!session) return;

      const idOrCode = normalizeText(req.params?.id || "");
      const action = normalizeText(req.body?.action).toUpperCase();
      const publishEnglishOnly = req.body?.publish_english_only === true;
      if (!idOrCode) return reply.code(400).send({ ok: false, error: "CONTENT_ID_REQUIRED" });
      if (!STOREFRONT_CONTENT_ACTIONS.has(action)) {
        return reply.code(400).send({ ok: false, error: "INVALID_ACTION" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const existing = await client.query(
          `
          SELECT id, code, title, status, attrs, created_at, updated_at
          FROM eip_core.service_object
          WHERE tenant_id = $1
            AND object_type = $2
            AND (id::text = $3 OR code = $3)
          LIMIT 1
          `,
          [session.tenant_id, STOREFRONT_CONTENT_OBJECT_TYPE, idOrCode]
        );
        if (!existing.rowCount) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
        }

        const row = existing.rows[0];
        const slot = normalizeContentSlot(row?.attrs?.slot || "home.hero") || "home.hero";
        const instanceRes = await ensureProcessInstanceForObject(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          objectType: STOREFRONT_CONTENT_OBJECT_TYPE,
          serviceObjectId: row.id,
          requireBinding: true
        });
        if (!instanceRes.ok || !instanceRes.instance?.id) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error || "PROCESS_INSTANCE_REQUIRED" });
        }

        const payload = {
          service_object_id: row.id,
          slot,
          title: normalizeOptionalText(row.title),
          code: row.code
        };
        const lifecycleKey = storefrontContentLifecycleKey(row);

        if (action === "DRAFT_READY") {
          const intake = await app.coreProcess.advanceInstance(client, {
            tenantId: session.tenant_id,
            identityId: session.identity_id,
            instanceId: instanceRes.instance.id,
            action: "INTAKE",
            payload,
            idempotencyKey: buildIdempotencyKey("storefront_content_item_intake", {
              id: row.id,
              slot,
              lifecycle: lifecycleKey
            })
          });
          if (!intake.ok && intake.error !== "INVALID_TRANSITION") {
            await client.query("ROLLBACK");
            return reply.code(409).send({ ok: false, error: intake.error });
          }
        }

        let translationState = null;
        if (action === "PUBLISH") {
          const translationSettings = await loadCommerceTranslationSettings(client, session.tenant_id);
          const runtime = resolveTranslationRuntime(app.config, translationSettings);
          const sourceLocale = normalizeLocale(runtime.source_locale || "en") || "en";
          const units = extractStorefrontContentTranslationUnits(
            row?.attrs && typeof row.attrs === "object" ? row.attrs : {},
            sourceLocale
          );
          const translationAttempt = units.length
            ? await translateUnitsAtPublish(client, session.tenant_id, app.config, translationSettings, units)
            : {
                ok: true,
                publish_state: TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION,
                source_locale: sourceLocale,
                target_locales: runtime.target_locales || [],
                provider_code: runtime.provider_code || null,
                source_map: {},
                translations_by_locale: {}
              };
          if (!translationAttempt.ok && !publishEnglishOnly) {
            await client.query("ROLLBACK");
            return reply.send({
              ok: true,
              publish_state: TRANSLATION_PUBLISH_STATE_CONFIRM_REQUIRED,
              message: TRANSLATION_PUBLISH_CONFIRM_MESSAGE,
              translation: {
                status: "unavailable",
                source_locale: translationAttempt.source_locale || sourceLocale,
                target_locales: translationAttempt.target_locales || [],
                error_code: translationAttempt.error_code || "TRANSLATION_PROVIDER_ERROR",
                error_message: translationAttempt.error_message || null
              }
            });
          }
          translationState = translationAttempt.ok
            ? {
                publish_state: TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION,
                source_locale: translationAttempt.source_locale,
                target_locales: translationAttempt.target_locales,
                provider_code: translationAttempt.provider_code,
                source_map: translationAttempt.source_map,
                translations_by_locale: translationAttempt.translations_by_locale,
                error_code: null
              }
            : {
                publish_state: TRANSLATION_PUBLISH_STATE_ENGLISH_ONLY,
                source_locale: translationAttempt.source_locale || sourceLocale,
                target_locales: translationAttempt.target_locales || [],
                provider_code: runtime.provider_code || null,
                source_map: {},
                translations_by_locale: {},
                error_code: translationAttempt.error_code || "TRANSLATION_PROVIDER_ERROR",
                error_message: translationAttempt.error_message || null
              };
        }

        const transition = await app.coreProcess.advanceInstance(client, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          instanceId: instanceRes.instance.id,
          action,
          payload,
          idempotencyKey: buildIdempotencyKey("storefront_content_item_action", {
            id: row.id,
            action,
            from_status: normalizeText(row.status || ""),
            lifecycle: lifecycleKey
          })
        });
        if (!transition.ok) {
          const targetStatus = storefrontTargetStatusForAction(action);
          if (
            transition.error === "INVALID_TRANSITION" &&
            targetStatus &&
            normalizeText(row.status) === normalizeText(targetStatus)
          ) {
            const current = await client.query(
              `
              SELECT id, code, title, status, attrs, created_at, updated_at
              FROM eip_core.service_object
              WHERE tenant_id = $1
                AND id = $2
                AND object_type = $3
              `,
              [session.tenant_id, row.id, STOREFRONT_CONTENT_OBJECT_TYPE]
            );
            await client.query("COMMIT");
            return reply.send({
              ok: true,
              reused: true,
              item: current.rowCount ? mapStorefrontContentRow(current.rows[0]) : mapStorefrontContentRow(row)
            });
          }
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: transition.error });
        }

        const updated = await client.query(
          `
          SELECT id, code, title, status, attrs, created_at, updated_at
          FROM eip_core.service_object
          WHERE tenant_id = $1
            AND id = $2
            AND object_type = $3
          `,
          [session.tenant_id, row.id, STOREFRONT_CONTENT_OBJECT_TYPE]
        );

        if (action === "PUBLISH" && translationState) {
          const currentAttrs = updated.rows[0]?.attrs && typeof updated.rows[0].attrs === "object"
            ? updated.rows[0].attrs
            : {};
          const existingTranslation = currentAttrs.translation && typeof currentAttrs.translation === "object"
            ? currentAttrs.translation
            : {};
          const metadata = buildTranslationMetadata({
            previous: existingTranslation,
            publishState: translationState.publish_state,
            sourceLocale: translationState.source_locale,
            targetLocales: translationState.target_locales,
            providerCode: translationState.provider_code,
            sourceMap: translationState.source_map,
            translationsByLocale: translationState.translations_by_locale,
            errorCode: translationState.error_code
          });
          await persistStorefrontTranslationMetadata(client, session.tenant_id, row.id, metadata);
        }
        await client.query("COMMIT");
        if (action === "PUBLISH" && translationState) {
          const publishState = translationState.publish_state;
          return reply.send({
            ok: true,
            reused: transition.reused === true,
            publish_state: publishState,
            message:
              publishState === TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION
                ? TRANSLATION_PUBLISH_SUCCESS_MESSAGE
                : TRANSLATION_PUBLISH_ENGLISH_ONLY_MESSAGE,
            item: mapStorefrontContentRow(updated.rows[0]),
            translation: {
              status: publishState === TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION ? "translated" : "english_only",
              source_locale: translationState.source_locale,
              target_locales: translationState.target_locales,
              error_code: translationState.error_code || null,
              error_message: translationState.error_message || null
            }
          });
        }
        return reply.send({ ok: true, reused: transition.reused === true, item: mapStorefrontContentRow(updated.rows[0]) });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({
          event: "storefront_content_item_action_failed",
          tenant_id: session.tenant_id,
          content_id: idOrCode,
          action,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "CONTENT_ACTION_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.delete(
    "/storefront/content/items/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", maxLength: 80 } }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PRODUCT_WRITE");
      if (!session) return;

      const idOrCode = normalizeText(req.params?.id || "");
      if (!idOrCode) return reply.code(400).send({ ok: false, error: "CONTENT_ID_REQUIRED" });

      const current = await app.db.query(
        `
        SELECT id, code, title, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = $2
          AND (id::text = $3 OR code = $3)
        LIMIT 1
        `,
        [session.tenant_id, STOREFRONT_CONTENT_OBJECT_TYPE, idOrCode]
      );
      if (!current.rowCount) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      const row = current.rows[0];
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const ensured = await ensureProcessInstanceForObject(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          objectType: STOREFRONT_CONTENT_OBJECT_TYPE,
          serviceObjectId: row.id,
          requireBinding: true
        });
        if (!ensured.ok || !ensured.instance?.id) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: ensured.error || "PROCESS_INSTANCE_REQUIRED" });
        }

        const payload = {
          service_object_id: row.id,
          slot: normalizeContentSlot(row?.attrs?.slot || "home.hero") || "home.hero",
          title: normalizeOptionalText(row.title),
          code: row.code
        };

        const runCancel = async () =>
          app.coreProcess.advanceInstance(client, {
            tenantId: session.tenant_id,
            identityId: session.identity_id,
            instanceId: ensured.instance.id,
            action: "CANCEL",
            payload,
            idempotencyKey: buildIdempotencyKey("storefront_content_item_cancel", { id: row.id, identity: session.identity_id })
          });

        let transition = await runCancel();
        if (!transition.ok && transition.error === "INVALID_TRANSITION") {
          const intake = await app.coreProcess.advanceInstance(client, {
            tenantId: session.tenant_id,
            identityId: session.identity_id,
            instanceId: ensured.instance.id,
            action: "INTAKE",
            payload,
            idempotencyKey: buildIdempotencyKey("storefront_content_item_intake_before_cancel", { id: row.id, identity: session.identity_id })
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
            ["cancelled", "rejected", "deleted"].includes(normalizeText(row.status).toLowerCase())
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
          `,
          [session.tenant_id, row.id, STOREFRONT_CONTENT_OBJECT_TYPE]
        );
        await client.query("COMMIT");
        return reply.send({ ok: true, item: updated.rowCount ? mapStorefrontContentRow(updated.rows[0]) : mapStorefrontContentRow(row) });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({
          event: "storefront_content_item_delete_failed",
          tenant_id: session.tenant_id,
          content_id: idOrCode,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "CONTENT_DELETE_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/blog/posts",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            q: { type: "string", maxLength: 200 },
            status: { type: "string", maxLength: 50 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 20 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, ["ECOM_PRODUCT_READ", "ECOM_REVIEW_READ"]);
      if (!session) return;

      const limit = clampLimit(req.query?.limit || 20);
      const offset = Number(req.query?.offset || 0);
      const q = normalizeOptionalText(req.query?.q);
      const status = normalizeOptionalText(req.query?.status);

      const params = [session.tenant_id, BLOG_POST_OBJECT_TYPE];
      const filters = ["tenant_id = $1", "object_type = $2"];
      if (status && status.toLowerCase() !== "all") {
        params.push(normalizeStage(status));
        filters.push(`lower(status) = $${params.length}`);
      } else {
        filters.push(`lower(status) NOT IN ('deleted', 'cancelled')`);
      }
      if (q) {
        params.push(`%${q}%`);
        filters.push(
          `(COALESCE(title, '') ILIKE $${params.length} OR COALESCE(attrs->>'title','') ILIKE $${params.length} OR COALESCE(attrs->>'body','') ILIKE $${params.length})`
        );
      }

      const total = await app.db.query(
        `
        SELECT COUNT(*)::int AS total
        FROM eip_core.service_object
        WHERE ${filters.join(" AND ")}
        `,
        params
      );

      params.push(limit);
      params.push(offset);
      const rows = await app.db.query(
        `
        SELECT id, code, title, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE ${filters.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      return reply.send({
        ok: true,
        items: (rows.rows || []).map(mapBlogPostAdminRow),
        total: Number(total.rows?.[0]?.total || 0),
        limit,
        offset
      });
    }
  );

  app.delete(
    "/blog/posts/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", maxLength: 80 } }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, ["ECOM_PRODUCT_WRITE", "ECOM_REVIEW_MODERATE"]);
      if (!session) return;

      const idOrCode = normalizeText(req.params?.id || "");
      if (!idOrCode) return reply.code(400).send({ ok: false, error: "BLOG_POST_ID_REQUIRED" });

      const current = await app.db.query(
        `
        SELECT id, code, title, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = $2
          AND (id::text = $3 OR code = $3)
        LIMIT 1
        `,
        [session.tenant_id, BLOG_POST_OBJECT_TYPE, idOrCode]
      );
      if (!current.rowCount) return reply.code(404).send({ ok: false, error: "BLOG_POST_NOT_FOUND" });

      const row = current.rows[0];
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const ensured = await ensureProcessInstanceForObject(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          objectType: BLOG_POST_OBJECT_TYPE,
          serviceObjectId: row.id,
          requireBinding: true
        });
        if (!ensured.ok || !ensured.instance?.id) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: ensured.error || "PROCESS_INSTANCE_REQUIRED" });
        }

        const payload = {
          service_object_id: row.id,
          post_code: row.code,
          actor_identity_id: session.identity_id
        };

        const runCancel = async () =>
          app.coreProcess.advanceInstance(client, {
            tenantId: session.tenant_id,
            identityId: session.identity_id,
            instanceId: ensured.instance.id,
            action: "CANCEL",
            payload,
            idempotencyKey: buildIdempotencyKey("blog_post_cancel", { id: row.id, identity: session.identity_id })
          });

        let transition = await runCancel();
        if (!transition.ok && transition.error === "INVALID_TRANSITION") {
          const intake = await app.coreProcess.advanceInstance(client, {
            tenantId: session.tenant_id,
            identityId: session.identity_id,
            instanceId: ensured.instance.id,
            action: "INTAKE",
            payload,
            idempotencyKey: buildIdempotencyKey("blog_post_intake", { id: row.id, identity: session.identity_id })
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
            ["cancelled", "rejected", "deleted"].includes(normalizeText(row.status).toLowerCase())
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
          [session.tenant_id, row.id, BLOG_POST_OBJECT_TYPE]
        );
        if (!updated.rowCount) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "BLOG_POST_NOT_FOUND" });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, item: mapBlogPostAdminRow(updated.rows[0]) });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({
          event: "blog_post_admin_delete_failed",
          tenant_id: session.tenant_id,
          identity_id: session.identity_id,
          post_id: row.id,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "BLOG_POST_DELETE_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/products",
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
      const session = await requirePerm(app, req, reply, "ECOM_PRODUCT_READ");
      if (!session) return;

      const tenantId = session.tenant_id;
      const q = normalizeOptionalText(req.query?.q);
      const status = normalizeOptionalText(req.query?.status);
      const limit = clampLimit(req.query?.limit);
      const offset = Number(req.query?.offset || 0);

      const params = [tenantId, MATERIAL_TYPE];
      const filters = ["tenant_id=$1", "material_type=$2"];

      if (status) {
        params.push(normalizeStage(status));
        filters.push(`attrs->'workflow'->>'stage' = $${params.length}`);
      }
      if (q) {
        params.push(`%${q}%`);
        filters.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT id,
               code,
               name AS title,
               NULL::text AS status,
               attrs,
               created_at,
               updated_at
        FROM eip_core.material
        WHERE ${filters.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      const items = await hydrateProductRowsWithCommercialConditions(app.db, tenantId, r.rows);
      return reply.send({ ok: true, items, limit, offset });
    }
  );

  app.get(
    "/products/:id",
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
      const session = await requirePerm(app, req, reply, "ECOM_PRODUCT_READ");
      if (!session) return;

      const r = await app.db.query(
        `
        SELECT id,
               code,
               name AS title,
               NULL::text AS status,
               attrs,
               created_at,
               updated_at
        FROM eip_core.material
        WHERE tenant_id=$1 AND id=$2 AND material_type=$3
        `,
        [session.tenant_id, req.params.id, MATERIAL_TYPE]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      const [item] = await hydrateProductRowsWithCommercialConditions(app.db, session.tenant_id, r.rows);
      return reply.send({ ok: true, item });
    }
  );

  app.get(
    "/commercial-condition-fields",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_PRODUCT_READ");
      if (!session) return;

      try {
        const items = await loadCommercialConditionFieldCatalog(app.db, session.tenant_id, { includeInactive: true });
        return reply.send({ ok: true, items });
      } catch (err) {
        app.log.error({
          event: "commercial_condition_field_catalog_list_failed",
          tenant_id: session.tenant_id,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "COMMERCIAL_CONDITION_FIELD_LIST_FAILED" });
      }
    }
  );

  app.post(
    "/commercial-condition-fields",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            code: { type: "string", maxLength: 80 },
            label: { type: "string", maxLength: 120 },
            data_type: { type: "string", maxLength: 30 },
            unit: { type: "string", maxLength: 40 },
            effect_path: { type: "string", maxLength: 160 },
            condition_category: { type: "string", maxLength: 100 },
            allowed_condition_types: { type: "array", maxItems: 20 },
            sort_order: { type: "integer", minimum: 1, maximum: 100000 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, ["ECOM_PRODUCT_WRITE", "ECOM_SETTINGS_WRITE"]);
      if (!session) return;

      const code = normalizeCommercialConditionFieldCode(req.body?.code || req.body?.label || "");
      const label = normalizeCommercialConditionFieldLabel(req.body?.label, code);
      if (!code || !label) {
        return reply.code(400).send({ ok: false, error: "COMMERCIAL_FIELD_CODE_OR_LABEL_REQUIRED" });
      }
      const dataType = normalizeText(req.body?.data_type || "number").toLowerCase();
      const safeType = ["text", "number", "integer", "boolean", "date"].includes(dataType) ? dataType : "number";
      const effectPath = normalizeOptionalText(req.body?.effect_path) || `custom.${code}`;
      const allowedTypes = Array.isArray(req.body?.allowed_condition_types)
        ? req.body.allowed_condition_types.map(normalizeCommercialConditionType).filter(Boolean)
        : [];
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const listId = await ensureCommercialConditionFieldList(client, session.tenant_id);
        const maxSort = await client.query(
          `
          SELECT COALESCE(MAX(sort_order), 0) AS max_sort
          FROM eip_core.dropdown_value
          WHERE list_id = $1
          `,
          [listId]
        );
        const sortOrder = Number.isInteger(Number(req.body?.sort_order)) && Number(req.body.sort_order) > 0
          ? Number(req.body.sort_order)
          : Number(maxSort.rows[0]?.max_sort || 0) + 10;
        const attrs = {
          data_type: safeType,
          unit: normalizeOptionalText(req.body?.unit),
          effect_path: effectPath,
          condition_category: normalizeOptionalText(req.body?.condition_category),
          allowed_condition_types: allowedTypes,
          governed: true,
          source: "commercial_condition_field_ui"
        };
        const inserted = await client.query(
          `
          INSERT INTO eip_core.dropdown_value
            (list_id, code, label, sort_order, is_active, attrs)
          VALUES
            ($1, $2, $3, $4, true, $5::jsonb)
          ON CONFLICT (list_id, code) DO UPDATE
            SET label = EXCLUDED.label,
                sort_order = EXCLUDED.sort_order,
                attrs = COALESCE(eip_core.dropdown_value.attrs,'{}'::jsonb) || EXCLUDED.attrs,
                is_active = true,
                updated_at = now()
          RETURNING code, label, sort_order, is_active, attrs
          `,
          [listId, code, label, sortOrder, JSON.stringify(attrs)]
        );
        const items = await loadCommercialConditionFieldCatalog(client, session.tenant_id, { includeInactive: true });
        await client.query("COMMIT");
        return reply.send({ ok: true, item: mapCommercialConditionFieldRow(inserted.rows[0]), items });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({
          event: "commercial_condition_field_catalog_upsert_failed",
          tenant_id: session.tenant_id,
          code,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "COMMERCIAL_CONDITION_FIELD_SAVE_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/commercial-conditions",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            product_id: { type: "string", minLength: 36, maxLength: 36 },
            product_code: { type: "string", maxLength: 100 },
            condition_type: { type: "string", maxLength: 100 },
            condition_category: { type: "string", maxLength: 100 },
            include_inactive: { type: "boolean" },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 100 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "ECOM_PRODUCT_READ");
      if (!session) return;

      const tenantId = session.tenant_id;
      const productId = normalizeOptionalText(req.query?.product_id);
      const productCode = normalizeOptionalText(req.query?.product_code);
      const conditionType = normalizeOptionalText(req.query?.condition_type);
      const conditionCategory = normalizeOptionalText(req.query?.condition_category);
      const includeInactive = req.query?.include_inactive === true;
      const limit = clampLimit(req.query?.limit, 100);
      const offset = Number(req.query?.offset || 0);
      const fieldCatalog = await loadCommercialConditionFieldCatalog(app.db, tenantId);

      let product = null;
      if (productId || productCode) {
        product = await resolveProductForCondition(app.db, tenantId, productId, productCode);
        if (!product) return reply.code(404).send({ ok: false, error: "PRODUCT_NOT_FOUND" });
      }

      const params = [tenantId];
      const filters = ["tenant_id=$1"];
      if (!includeInactive) filters.push("is_active=true");
      if (conditionType) {
        params.push(normalizeCommercialConditionType(conditionType));
        filters.push(`condition_type=$${params.length}`);
      }
      if (conditionCategory) {
        params.push(normalizeCommercialConditionType(conditionCategory));
        filters.push(`condition_category=$${params.length}`);
      }
      if (product) {
        params.push(String(product.id), String(product.code || ""));
        filters.push(`(
          scope->>'material_id' = $${params.length - 1}
          OR scope->>'product_id' = $${params.length - 1}
          OR scope->>'material_code' = $${params.length}
          OR scope->>'product_code' = $${params.length}
        )`);
      }
      params.push(limit, offset);

      const r = await app.db.query(
        `
        SELECT *
        FROM eip_core.commercial_condition
        WHERE ${filters.join(" AND ")}
        ORDER BY priority ASC, created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      return reply.send({
        ok: true,
        items: r.rows.map((row) => mapCommercialConditionRow(row, fieldCatalog)),
        fields: fieldCatalog,
        product,
        limit,
        offset
      });
    }
  );

  app.post(
    "/commercial-conditions",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            product_id: { type: "string", minLength: 36, maxLength: 36 },
            product_code: { type: "string", maxLength: 100 },
            code: { type: "string", maxLength: 100 },
            label: { type: "string", maxLength: 200 },
            condition_type: { type: "string", maxLength: 100 },
            condition_category: { type: "string", maxLength: 100 },
            priority: { type: "integer", minimum: 0, maximum: 10000 },
            valid_from: { type: "string", maxLength: 80 },
            valid_to: { type: "string", maxLength: 80 },
            is_active: { type: "boolean" },
            summary: { type: "string", maxLength: 1000 },
            structured_values: { type: "array", maxItems: 50 },
            scope: { type: "object" },
            effect: { type: "object" },
            attrs: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, ["ECOM_PRODUCT_WRITE", "ECOM_SETTINGS_WRITE"]);
      if (!session) return;

      const tenantId = session.tenant_id;
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const product = await resolveProductForCondition(
          client,
          tenantId,
          req.body?.product_id,
          req.body?.product_code
        );
        if ((req.body?.product_id || req.body?.product_code) && !product) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "PRODUCT_NOT_FOUND" });
        }

        const label = normalizeOptionalText(req.body?.label);
        const conditionType = normalizeCommercialConditionType(req.body?.condition_type || "TRADE_TERMS");
        const conditionCategory = normalizeCommercialConditionType(req.body?.condition_category || "TRADE");
        const codeSeed = req.body?.code || `${conditionType}_${product?.code || label || "TENANT"}`;
        const code = await generateCommercialConditionCode(client, tenantId, codeSeed);
        const fieldCatalog = await loadCommercialConditionFieldCatalog(client, tenantId);
        const scope = {
          ...safeJsonObject(req.body?.scope),
          ...(product
            ? {
                object_type: PRODUCT_OBJECT_TYPE,
                material_id: String(product.id),
                material_code: product.code || null
              }
            : {})
        };
        const structured = applyCommercialStructuredValues(
          safeJsonObject(req.body?.effect),
          req.body?.structured_values || [],
          fieldCatalog
        );
        if (!structured.ok) {
          await client.query("ROLLBACK");
          return reply.code(400).send({
            ok: false,
            error: structured.error || "INVALID_STRUCTURED_VALUE",
            field_code: structured.field_code || null
          });
        }
        const effect = structured.effect;
        const attrs = {
          ...safeJsonObject(req.body?.attrs),
          ...(normalizeOptionalText(req.body?.summary) ? { summary: normalizeOptionalText(req.body.summary) } : {}),
          structured_values: structured.structured_values,
          governance_source: "commercial_condition_ui"
        };

        const r = await client.query(
          `
          INSERT INTO eip_core.commercial_condition
            (tenant_id, code, label, condition_type, condition_category, priority, valid_from, valid_to, is_active, scope, effect, attrs)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9,$10::jsonb,$11::jsonb,$12::jsonb)
          RETURNING *
          `,
          [
            tenantId,
            code,
            label || code,
            conditionType,
            conditionCategory,
            Number(req.body?.priority ?? 100),
            normalizeOptionalText(req.body?.valid_from),
            normalizeOptionalText(req.body?.valid_to),
            req.body?.is_active !== false,
            JSON.stringify(scope),
            JSON.stringify(effect),
            JSON.stringify(attrs)
          ]
        );

        await client.query("COMMIT");
        return reply.send({ ok: true, item: mapCommercialConditionRow(r.rows[0], fieldCatalog), product });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({
          event: "commercial_condition_create_failed",
          tenant_id: tenantId,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "COMMERCIAL_CONDITION_CREATE_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.patch(
    "/commercial-conditions/:id",
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
          properties: {
            label: { type: "string", maxLength: 200 },
            condition_type: { type: "string", maxLength: 100 },
            condition_category: { type: "string", maxLength: 100 },
            priority: { type: "integer", minimum: 0, maximum: 10000 },
            valid_from: { type: "string", maxLength: 80 },
            valid_to: { type: "string", maxLength: 80 },
            is_active: { type: "boolean" },
            summary: { type: "string", maxLength: 1000 },
            structured_values: { type: "array", maxItems: 50 },
            scope: { type: "object" },
            effect: { type: "object" },
            attrs: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, ["ECOM_PRODUCT_WRITE", "ECOM_SETTINGS_WRITE"]);
      if (!session) return;

      const existing = await app.db.query(
        `
        SELECT *
        FROM eip_core.commercial_condition
        WHERE tenant_id=$1 AND id=$2
        LIMIT 1
        `,
        [session.tenant_id, req.params.id]
      );
      if (!existing.rowCount) return reply.code(404).send({ ok: false, error: "COMMERCIAL_CONDITION_NOT_FOUND" });

      const current = existing.rows[0];
      const fieldCatalog = await loadCommercialConditionFieldCatalog(app.db, session.tenant_id);
      const currentAttrs = safeJsonObject(current.attrs);
      const hasStructured = Object.prototype.hasOwnProperty.call(req.body || {}, "structured_values");
      const effectBase = Object.prototype.hasOwnProperty.call(req.body || {}, "effect")
        ? safeJsonObject(req.body?.effect)
        : safeJsonObject(current.effect);
      const structured = hasStructured
        ? applyCommercialStructuredValues(effectBase, req.body?.structured_values || [], fieldCatalog)
        : { ok: true, effect: effectBase, structured_values: buildCommercialConditionStructuredValues(effectBase, currentAttrs, fieldCatalog) };
      if (!structured.ok) {
        return reply.code(400).send({
          ok: false,
          error: structured.error || "INVALID_STRUCTURED_VALUE",
          field_code: structured.field_code || null
        });
      }
      const nextAttrs = {
        ...currentAttrs,
        ...safeJsonObject(req.body?.attrs),
        ...(Object.prototype.hasOwnProperty.call(req.body || {}, "summary")
          ? { summary: normalizeOptionalText(req.body?.summary) }
          : {}),
        structured_values: structured.structured_values,
        governance_source: currentAttrs.governance_source || "commercial_condition_ui"
      };

      const r = await app.db.query(
        `
        UPDATE eip_core.commercial_condition
        SET label = COALESCE($3, label),
            condition_type = COALESCE($4, condition_type),
            condition_category = COALESCE($5, condition_category),
            priority = COALESCE($6, priority),
            valid_from = CASE WHEN $7::text IS NULL THEN valid_from ELSE $7::timestamptz END,
            valid_to = CASE WHEN $8::text IS NULL THEN valid_to ELSE $8::timestamptz END,
            is_active = COALESCE($9, is_active),
            scope = COALESCE($10::jsonb, scope),
            effect = $11::jsonb,
            attrs = $12::jsonb,
            updated_at = now()
        WHERE tenant_id=$1 AND id=$2
        RETURNING *
        `,
        [
          session.tenant_id,
          req.params.id,
          Object.prototype.hasOwnProperty.call(req.body || {}, "label") ? normalizeOptionalText(req.body.label) : null,
          Object.prototype.hasOwnProperty.call(req.body || {}, "condition_type")
            ? normalizeCommercialConditionType(req.body.condition_type)
            : null,
          Object.prototype.hasOwnProperty.call(req.body || {}, "condition_category")
            ? normalizeCommercialConditionType(req.body.condition_category)
            : null,
          Object.prototype.hasOwnProperty.call(req.body || {}, "priority") ? Number(req.body.priority) : null,
          Object.prototype.hasOwnProperty.call(req.body || {}, "valid_from") ? normalizeOptionalText(req.body.valid_from) : null,
          Object.prototype.hasOwnProperty.call(req.body || {}, "valid_to") ? normalizeOptionalText(req.body.valid_to) : null,
          Object.prototype.hasOwnProperty.call(req.body || {}, "is_active") ? req.body.is_active === true : null,
          Object.prototype.hasOwnProperty.call(req.body || {}, "scope") ? JSON.stringify(safeJsonObject(req.body.scope)) : null,
          JSON.stringify(structured.effect),
          JSON.stringify(nextAttrs)
        ]
      );

      return reply.send({ ok: true, item: mapCommercialConditionRow(r.rows[0], fieldCatalog) });
    }
  );

  app.get(
    "/reviews",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            product_code: { type: "string", maxLength: 64 },
            status: { type: "string", maxLength: 50 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, ["ECOM_REVIEW_READ", "ECOM_PRODUCT_READ"]);
      if (!session) return;

      const productCode = normalizeOptionalText(req.query?.product_code);
      const status = normalizeOptionalText(req.query?.status);
      const limit = clampLimit(req.query?.limit);
      const offset = Number(req.query?.offset || 0);

      const params = [session.tenant_id, PRODUCT_REVIEW_OBJECT_TYPE];
      const filters = ["so.tenant_id=$1", "so.object_type=$2"];

      if (productCode) {
        params.push(productCode);
        filters.push(`so.attrs->>'material_code' = $${params.length}`);
      }
      if (status && status.toLowerCase() !== "all") {
        params.push(normalizeReviewStatus(status));
        filters.push(`so.status = $${params.length}`);
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT so.id,
               so.code,
               so.status,
               so.title,
               so.attrs,
               so.created_at,
               so.updated_at,
               m.id AS product_id,
               m.code AS product_code,
               m.name AS product_title
        FROM eip_core.service_object so
        LEFT JOIN eip_core.material m
          ON m.tenant_id = so.tenant_id
         AND m.code = so.attrs->>'material_code'
        WHERE ${filters.join(" AND ")}
        ORDER BY so.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      const items = (r.rows || []).map((row) => {
        const attrs = row.attrs && typeof row.attrs === "object" ? row.attrs : {};
        const reviewer = attrs.reviewer && typeof attrs.reviewer === "object" ? attrs.reviewer : {};
        const moderation = attrs.moderation && typeof attrs.moderation === "object" ? attrs.moderation : {};
        return {
          id: row.id,
          code: row.code,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
          product: {
            id: row.product_id || attrs.material_id || null,
            code: row.product_code || attrs.material_code || null,
            title: row.product_title || attrs.material_name || null
          },
          review: {
            rating: Number(attrs.rating) || null,
            title: normalizeOptionalText(attrs.title),
            comment: normalizeOptionalText(attrs.comment),
            reviewer: {
              name: normalizeOptionalText(reviewer.name) || "Anonymous",
              email: normalizeOptionalText(reviewer.email),
              verified_purchase: reviewer.verified_purchase === true
            },
            moderation: {
              state: normalizeOptionalText(moderation.state) || row.status,
              auto_flagged: moderation.auto_flagged === true,
              flagged_terms: Array.isArray(moderation.flagged_terms) ? moderation.flagged_terms : [],
              note: normalizeOptionalText(moderation.note)
            }
          }
        };
      });

      return reply.send({ ok: true, items, limit, offset });
    }
  );

  app.patch(
    "/reviews/:id",
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
          required: ["status"],
          properties: {
            status: { type: "string", maxLength: 50 },
            note: { type: "string", maxLength: 1000 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, ["ECOM_REVIEW_MODERATE", "ECOM_PRODUCT_WRITE"]);
      if (!session) return;

      const nextStatus = normalizeReviewStatus(req.body?.status, "");
      if (!nextStatus) {
        return reply.code(400).send({ ok: false, error: "INVALID_STATUS" });
      }
      const action = reviewActionForStatus(nextStatus);
      if (!action) {
        return reply.code(400).send({ ok: false, error: "INVALID_STATUS_ACTION" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const current = await client.query(
          `
          SELECT id, status, attrs
          FROM eip_core.service_object
          WHERE tenant_id=$1 AND id=$2 AND object_type=$3
          LIMIT 1
          `,
          [session.tenant_id, req.params.id, PRODUCT_REVIEW_OBJECT_TYPE]
        );
        if (current.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
        }

        const instanceRes = await ensureProcessInstanceForObject(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          objectType: PRODUCT_REVIEW_OBJECT_TYPE,
          serviceObjectId: req.params.id,
          requireBinding: true
        });
        if (!instanceRes.ok || !instanceRes.instance?.id) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error || "PROCESS_INSTANCE_REQUIRED" });
        }

        const transition = await app.coreProcess.advanceInstance(client, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          instanceId: instanceRes.instance.id,
          action,
          payload: {
            moderation_state: nextStatus,
            moderation_note: normalizeOptionalText(req.body?.note)
          },
          idempotencyKey: buildIdempotencyKey("ecom_review_moderate", {
            id: req.params.id,
            from_status: normalizeText(current.rows[0]?.status || ""),
            to_status: nextStatus,
            note: normalizeOptionalText(req.body?.note)
          })
        });

        if (!transition.ok) {
          if (transition.error === "INVALID_TRANSITION" && normalizeText(current.rows[0]?.status) === normalizeText(nextStatus)) {
            await client.query("COMMIT");
            return reply.send({ ok: true, reused: true, item: current.rows[0] });
          }
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: transition.error });
        }

        const latest = await client.query(
          `
          SELECT attrs
          FROM eip_core.service_object
          WHERE tenant_id=$1 AND id=$2 AND object_type=$3
          LIMIT 1
          `,
          [session.tenant_id, req.params.id, PRODUCT_REVIEW_OBJECT_TYPE]
        );

        const attrs = latest.rows[0]?.attrs && typeof latest.rows[0].attrs === "object"
          ? { ...latest.rows[0].attrs }
          : {};
        const moderation = attrs.moderation && typeof attrs.moderation === "object"
          ? { ...attrs.moderation }
          : {};

        moderation.state = nextStatus;
        moderation.note = normalizeOptionalText(req.body?.note);
        moderation.reviewed_by_identity_id = session.identity_id;
        moderation.reviewed_at = new Date().toISOString();
        attrs.moderation = moderation;

        const updated = await client.query(
          `
          UPDATE eip_core.service_object
          SET attrs = $3::jsonb,
              updated_at = now()
          WHERE tenant_id=$1 AND id=$2 AND object_type=$4
          RETURNING id, code, status, attrs, created_at, updated_at
          `,
          [
            session.tenant_id,
            req.params.id,
            JSON.stringify(attrs),
            PRODUCT_REVIEW_OBJECT_TYPE
          ]
        );

        await client.query("COMMIT");
        return reply.send({ ok: true, reused: transition.reused === true, item: updated.rows[0] });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({
          event: "ecom_review_moderation_failed",
          tenant_id: session.tenant_id,
          review_id: req.params.id,
          error: err?.message || String(err)
        });
        return reply.code(500).send({ ok: false, error: "REVIEW_MODERATION_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.post(
    "/products",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            code: { type: "string", maxLength: 64 },
            title: { type: "string", maxLength: 200 },
            attrs: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PRODUCT_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const attrs = req.body?.attrs && typeof req.body.attrs === "object" ? req.body.attrs : {};
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const requestedCode = normalizeOptionalText(req.body?.code);
        const code = requestedCode || (await generateProductCode(client, tenantId));
        const sanitizedAttrs = sanitizeProductAttrsForStorage(attrs, tenantId);
        const productCheck = await validateProductTaxonomyAndVariantsWithCatalog(
          client,
          tenantId,
          sanitizedAttrs
        );
        if (!productCheck.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({
            ok: false,
            error: productCheck.error,
            invalid_codes: productCheck.invalid_codes || [],
            category_code: productCheck.category_code || null,
            subcategory_code: productCheck.subcategory_code || null
          });
        }
        const validatedAttrs = productCheck.attrs && typeof productCheck.attrs === "object"
          ? productCheck.attrs
          : sanitizedAttrs;

        if (validatedAttrs.inventory && typeof validatedAttrs.inventory === "object") {
          const existingSku = normalizeOptionalText(validatedAttrs.inventory?.sku);
          const categoryCode = normalizeProductCategoryCode(
            validatedAttrs?.taxonomy?.category_code || validatedAttrs?.taxonomy?.category || ""
          );
          const categoryLabel = normalizeOptionalText(
            validatedAttrs?.taxonomy?.category_label || validatedAttrs?.taxonomy?.category || ""
          );
          if (!existingSku && categoryCode) {
            const sku = await generateSku(client, tenantId, { categoryCode, categoryLabel });
            if (!sku) {
              await client.query("ROLLBACK");
              return reply.code(409).send({ ok: false, error: "SKU_GENERATION_FAILED" });
            }
            validatedAttrs.inventory = { ...validatedAttrs.inventory, sku };
          }
        }

        const r = await client.query(
          `
          INSERT INTO eip_core.material
            (tenant_id, material_type, code, name, attrs)
          VALUES
            ($1,$2,$3,$4,$5::jsonb)
          RETURNING id,
                    code,
                    name AS title,
                    NULL::text AS status,
                    attrs,
                    created_at,
                    updated_at
          `,
          [
            tenantId,
            MATERIAL_TYPE,
            code,
            normalizeOptionalText(req.body?.title),
            JSON.stringify(validatedAttrs)
          ]
        );

        const item = r.rows[0];
        const instanceRes = await ensureProductInstance(client, app, {
          tenantId,
          identityId: session.identity_id,
          material: item,
          requireBinding: true
        });
        if (!instanceRes.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error });
        }

        if (instanceRes.instance?.id && instanceRes.createdInstance) {
          const idempotencyKey = buildIdempotencyKey("ecom_product_intake", {
            material_id: item.id,
            service_object_id: instanceRes.serviceObjectId
          });
          const advance = await app.coreProcess.advanceInstance(client, {
            tenantId,
            identityId: session.identity_id,
            instanceId: instanceRes.instance.id,
            action: "INTAKE",
            payload: { material_id: item.id, material_code: item.code || null },
            idempotencyKey
          });
          if (!advance.ok) {
            await client.query("ROLLBACK");
            return reply.code(409).send({ ok: false, error: advance.error });
          }
          await applyMaterialWorkflowPatch(
            client,
            tenantId,
            item.id,
            workflowPatchForAction("INTAKE")
          );
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, item });
      } catch (err) {
        await client.query("ROLLBACK");
        if (String(err.message || "").includes("ASSET_TENANT_MISMATCH")) {
          return reply.code(409).send({ ok: false, error: "ASSET_TENANT_MISMATCH" });
        }
        app.log.error({ event: "ecom_product_create_error", tenantId, error: err.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.patch(
    "/products/:id",
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
          properties: {
            code: { type: "string", maxLength: 64 },
            title: { type: "string", maxLength: 200 },
            attrs: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PRODUCT_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const attrs = req.body?.attrs && typeof req.body.attrs === "object" ? req.body.attrs : null;
      let resolvedAttrs = attrs;
      const existingRes = await app.db.query(
        `
        SELECT code, name, attrs
        FROM eip_core.material
        WHERE tenant_id=$1 AND id=$2 AND material_type=$3
        `,
        [tenantId, req.params.id, MATERIAL_TYPE]
      );
      if (existingRes.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      const existingCode = normalizeOptionalText(existingRes.rows[0]?.code);
      const existingAttrs = existingRes.rows[0]?.attrs || {};
      const existingTitle = normalizeOptionalText(existingRes.rows[0]?.name);

      if (attrs) {
        const existingInventory =
          existingAttrs?.inventory && typeof existingAttrs.inventory === "object"
            ? existingAttrs.inventory
            : {};
        const incomingInventory =
          attrs?.inventory && typeof attrs.inventory === "object" ? { ...attrs.inventory } : null;
        const existingSku = normalizeOptionalText(existingInventory?.sku);
        const incomingSku = normalizeOptionalText(incomingInventory?.sku);
        if (existingSku && incomingSku && incomingSku !== existingSku) {
          return reply.code(409).send({ ok: false, error: "SKU_IMMUTABLE" });
        }
        if (incomingInventory) {
          if (existingSku && !incomingSku) {
            incomingInventory.sku = existingSku;
          }
          resolvedAttrs = { ...attrs, inventory: incomingInventory };
        }
        resolvedAttrs = sanitizeProductAttrsForStorage(resolvedAttrs, tenantId);
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        let attrsToPersist = null;
        if (resolvedAttrs && typeof resolvedAttrs === "object") {
          const baseAttrs = existingAttrs && typeof existingAttrs === "object" ? existingAttrs : {};
          const mergedAttrs = {
            ...baseAttrs,
            ...resolvedAttrs
          };
          const productCheck = await validateProductTaxonomyAndVariantsWithCatalog(
            client,
            tenantId,
            mergedAttrs
          );
          if (!productCheck.ok) {
            await client.query("ROLLBACK");
            return reply.code(409).send({
              ok: false,
              error: productCheck.error,
              invalid_codes: productCheck.invalid_codes || [],
              category_code: productCheck.category_code || null,
              subcategory_code: productCheck.subcategory_code || null
            });
          }
          attrsToPersist = productCheck.attrs || mergedAttrs;
        }

        if (attrsToPersist && typeof attrsToPersist === "object") {
          const currentInventory =
            attrsToPersist.inventory && typeof attrsToPersist.inventory === "object"
              ? { ...attrsToPersist.inventory }
              : {};
          const existingInventory =
            existingAttrs?.inventory && typeof existingAttrs.inventory === "object"
              ? existingAttrs.inventory
              : {};
          const existingSku = normalizeOptionalText(existingInventory?.sku);
          const incomingSku = normalizeOptionalText(currentInventory?.sku);
          if (existingSku && !incomingSku) {
            currentInventory.sku = existingSku;
          }
          if (!existingSku && !incomingSku) {
            const categoryCode = normalizeProductCategoryCode(
              attrsToPersist?.taxonomy?.category_code || attrsToPersist?.taxonomy?.category || ""
            );
            const categoryLabel = normalizeOptionalText(
              attrsToPersist?.taxonomy?.category_label || attrsToPersist?.taxonomy?.category || ""
            );
            if (categoryCode) {
              const sku = await generateSku(client, tenantId, { categoryCode, categoryLabel });
              if (!sku) {
                await client.query("ROLLBACK");
                return reply.code(409).send({ ok: false, error: "SKU_GENERATION_FAILED" });
              }
              currentInventory.sku = sku;
            }
          }
          attrsToPersist.inventory = currentInventory;
        }

        const requestedCode = normalizeOptionalText(req.body?.code);
        const requestedTitle = normalizeOptionalText(req.body?.title);
        const nextTitle = requestedTitle || existingTitle;
        const requiredFieldMissing = collectMissingProductRequiredFields({
          title: nextTitle || "",
          attrs: attrsToPersist || existingAttrs || {}
        });
        if (requiredFieldMissing.length) {
          await client.query("ROLLBACK");
          return reply.code(409).send({
            ok: false,
            error: "PRODUCT_REQUIRED_FIELDS_MISSING",
            missing_fields: requiredFieldMissing
          });
        }

        const attrsChanged =
          attrsToPersist && typeof attrsToPersist === "object"
            ? !isDeepStrictEqual(attrsToPersist, existingAttrs)
            : false;
        const titleChanged = Boolean(requestedTitle && requestedTitle !== existingTitle);
        const codeChanged = Boolean(requestedCode && requestedCode !== existingCode);
        const shouldRequireRepublish = isPublishedMaterialAttrs(existingAttrs) && (attrsChanged || titleChanged || codeChanged);
        if (shouldRequireRepublish) {
          const nowIso = new Date().toISOString();
          attrsToPersist = markAttrsRepublishRequired(
            attrsToPersist && typeof attrsToPersist === "object"
              ? attrsToPersist
              : (existingAttrs && typeof existingAttrs === "object" ? { ...existingAttrs } : {}),
            nowIso
          );
        }

        const r = await client.query(
          `
          UPDATE eip_core.material
          SET code = COALESCE($3, code),
              name = COALESCE($4, name),
              attrs = COALESCE($5::jsonb, attrs),
              updated_at = now()
          WHERE tenant_id=$1 AND id=$2 AND material_type=$6
          RETURNING id,
                    code,
                    name AS title,
                    NULL::text AS status,
                    attrs,
                    created_at,
                    updated_at
          `,
          [
            tenantId,
            req.params.id,
            requestedCode,
            requestedTitle,
            attrsToPersist ? JSON.stringify(attrsToPersist) : null,
            MATERIAL_TYPE
          ]
        );
        if (r.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
        }

        const item = r.rows[0];
        await client.query("COMMIT");
        return reply.send({ ok: true, item, republish_required: shouldRequireRepublish });
      } catch (err) {
        await client.query("ROLLBACK");
        if (String(err.message || "").includes("ASSET_TENANT_MISMATCH")) {
          return reply.code(409).send({ ok: false, error: "ASSET_TENANT_MISMATCH" });
        }
        app.log.error({ event: "ecom_product_update_error", tenantId, error: err.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.post(
    "/products/:id/actions",
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
            idempotency_key: { type: "string", maxLength: 200 },
            publish_english_only: { type: "boolean" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireWrite(app, req, reply, "ECOM_PRODUCT_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const action = normalizeText(req.body?.action).toUpperCase();
      const publishEnglishOnly = req.body?.publish_english_only === true;

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const materialRes = await client.query(
          `
          SELECT id, code, name AS title, attrs
          FROM eip_core.material
          WHERE tenant_id=$1 AND id=$2 AND material_type=$3
          `,
          [tenantId, req.params.id, MATERIAL_TYPE]
        );
        if (materialRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
        }

        const material = materialRes.rows[0];
        const productCheck = await validateProductTaxonomyAndVariantsWithCatalog(
          client,
          tenantId,
          material?.attrs && typeof material.attrs === "object" ? material.attrs : {}
        );
        if (!productCheck.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({
            ok: false,
            error: productCheck.error,
            invalid_codes: productCheck.invalid_codes || [],
            category_code: productCheck.category_code || null,
            subcategory_code: productCheck.subcategory_code || null
          });
        }
        material.attrs = productCheck.attrs || material.attrs;
        const instanceRes = await ensureProductInstance(client, app, {
          tenantId,
          identityId: session.identity_id,
          material,
          requireBinding: true
        });
        if (!instanceRes.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error });
        }

        const payload = {
          ...(req.body?.payload || {}),
          material_id: material.id,
          material_code: material.code || null
        };

        if (instanceRes.instance?.id && action !== "INTAKE") {
          const intakeKey = buildIdempotencyKey("ecom_product_intake", {
            material_id: material.id,
            service_object_id: instanceRes.serviceObjectId
          });
          const intake = await app.coreProcess.advanceInstance(client, {
            tenantId,
            identityId: session.identity_id,
            instanceId: instanceRes.instance.id,
            action: "INTAKE",
            payload,
            idempotencyKey: intakeKey
          });
          if (!intake.ok && intake.error !== "INVALID_TRANSITION") {
            await client.query("ROLLBACK");
            return reply.code(409).send({ ok: false, error: intake.error });
          }
        }

        const idempotencyKey =
          normalizeOptionalText(req.body?.idempotency_key) ||
          buildIdempotencyKey("ecom_product_action", { id: material.id, action, payload });

        let translationState = null;
        if (action === "PUBLISH") {
          const translationSettings = await loadCommerceTranslationSettings(client, tenantId);
          const runtime = resolveTranslationRuntime(app.config, translationSettings);
          const sourceLocale = normalizeLocale(runtime.source_locale || "en") || "en";
          const units = extractProductTranslationUnits(
            material?.attrs && typeof material.attrs === "object" ? material.attrs : {},
            sourceLocale,
            {
              "content.title": normalizeText(material?.title || material?.code),
              "content.name": normalizeText(material?.title || material?.code),
              "content.summary": stripRichTextToPlain(material?.attrs?.content?.summary || material?.attrs?.content?.description || "")
            }
          );
          const translationAttempt = units.length
            ? await translateUnitsAtPublish(client, tenantId, app.config, translationSettings, units)
            : {
                ok: true,
                publish_state: TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION,
                source_locale: sourceLocale,
                target_locales: runtime.target_locales || [],
                provider_code: runtime.provider_code || null,
                source_map: {},
                translations_by_locale: {}
              };
          if (!translationAttempt.ok && !publishEnglishOnly) {
            await client.query("ROLLBACK");
            return reply.send({
              ok: true,
              publish_state: TRANSLATION_PUBLISH_STATE_CONFIRM_REQUIRED,
              message: TRANSLATION_PUBLISH_CONFIRM_MESSAGE,
              translation: {
                status: "unavailable",
                source_locale: translationAttempt.source_locale || sourceLocale,
                target_locales: translationAttempt.target_locales || [],
                error_code: translationAttempt.error_code || "TRANSLATION_PROVIDER_ERROR",
                error_message: translationAttempt.error_message || null
              }
            });
          }
          if (translationAttempt.ok) {
            translationState = {
              publish_state: TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION,
              source_locale: translationAttempt.source_locale,
              target_locales: translationAttempt.target_locales,
              provider_code: translationAttempt.provider_code,
              source_map: translationAttempt.source_map,
              translations_by_locale: translationAttempt.translations_by_locale,
              error_code: null
            };
          } else {
            translationState = {
              publish_state: TRANSLATION_PUBLISH_STATE_ENGLISH_ONLY,
              source_locale: translationAttempt.source_locale || sourceLocale,
              target_locales: translationAttempt.target_locales || [],
              provider_code: runtime.provider_code || null,
              source_map: {},
              translations_by_locale: {},
              error_code: translationAttempt.error_code || "TRANSLATION_PROVIDER_ERROR",
              error_message: translationAttempt.error_message || null
            };
          }
        }

        const result = await app.coreProcess.advanceInstance(client, {
          tenantId,
          identityId: session.identity_id,
          instanceId: instanceRes.instance.id,
          action,
          payload,
          idempotencyKey
        });
        const workflowPatch = workflowPatchForAction(action);
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }
        if (workflowPatch) {
          await applyMaterialWorkflowPatch(client, tenantId, material.id, workflowPatch);
        }

        if (action === "PUBLISH" && translationState) {
          const current = await client.query(
            `
            SELECT attrs
            FROM eip_core.material
            WHERE tenant_id = $1::uuid
              AND id = $2::uuid
              AND material_type = $3
            LIMIT 1
            `,
            [tenantId, material.id, MATERIAL_TYPE]
          );
          const existingTranslation =
            current.rows[0]?.attrs &&
            typeof current.rows[0].attrs === "object" &&
            current.rows[0].attrs.translation &&
            typeof current.rows[0].attrs.translation === "object"
              ? current.rows[0].attrs.translation
              : {};
          const metadata = buildTranslationMetadata({
            previous: existingTranslation,
            publishState: translationState.publish_state,
            sourceLocale: translationState.source_locale,
            targetLocales: translationState.target_locales,
            providerCode: translationState.provider_code,
            sourceMap: translationState.source_map,
            translationsByLocale: translationState.translations_by_locale,
            errorCode: translationState.error_code
          });
          await persistMaterialTranslationMetadata(client, tenantId, material.id, metadata);
        }

        await client.query("COMMIT");
        if (action === "PUBLISH" && translationState) {
          const publishState = translationState.publish_state;
          const message = publishState === TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION
            ? TRANSLATION_PUBLISH_SUCCESS_MESSAGE
            : TRANSLATION_PUBLISH_ENGLISH_ONLY_MESSAGE;
          return reply.send({
            ok: true,
            reused: result.reused === true,
            publish_state: publishState,
            message,
            translation: {
              status: publishState === TRANSLATION_PUBLISH_STATE_WITH_TRANSLATION ? "translated" : "english_only",
              source_locale: translationState.source_locale,
              target_locales: translationState.target_locales,
              error_code: translationState.error_code || null,
              error_message: translationState.error_message || null
            }
          });
        }
        return reply.send({ ok: true, reused: result.reused === true });
      } catch (err) {
        await client.query("ROLLBACK");
        app.log.error({ event: "ecom_product_action_error", tenantId, error: err.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );
}
