import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Box,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Download,
  ExternalLink,
  FilePlus2,
  FileText,
  Image,
  Loader2,
  LayoutTemplate,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  UploadCloud,
  ArrowUp,
  ArrowDown,
  X,
  XCircle
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";
import ActionMiniModal from "../shared/ActionMiniModal";
import ImageAssetStudioModal from "../shared/ImageAssetStudioModal";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const ECOM_PREVIEW_BASE_URL = import.meta.env.VITE_ECOM_PREVIEW_BASE_URL || "http://localhost:5174";
const ASSET_BASE =
  typeof window !== "undefined"
    ? new URL(API_BASE_URL, window.location.origin).origin
    : API_BASE_URL;

const EMPTY_ATTRS = {
  content: {},
  pricing: {},
  inventory: {},
  variants: { enabled: false, items: [] },
  taxonomy: {},
  media: {},
  seo: {},
  channels: {}
};

const STAGE_BADGES = {
  intake: { label: "Intake", icon: CircleDot, className: "bg-slate-100 text-slate-700" },
  review: { label: "Review", icon: ClipboardCheck, className: "bg-amber-100 text-amber-700" },
  published: { label: "Published", icon: BadgeCheck, className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejected", icon: XCircle, className: "bg-rose-100 text-rose-700" },
  completed: { label: "Completed", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700" }
};

const CURATION_TAGS = [
  { value: "featured", label: "Featured product" },
  { value: "worth", label: "Patterns worth making" },
  { value: "drop", label: "The Drop highlight" }
];
const PRODUCT_SLOT_SOURCE_MODES = [
  { value: "", label: "Editorial content" },
  { value: "manual_products", label: "Manual product codes" },
  { value: "product_tag", label: "Product tag" },
  { value: "collection_or_drop", label: "Collection or drop" },
  { value: "hybrid_tag_overrides", label: "Tag with manual overrides" }
];
const DEFAULT_PRODUCT_STUDIO_UI = {
  tabs: [
    { id: "studio", label: "Studio" },
    { id: "focus", label: "Focus" }
  ],
  focusRules: [
    { code: "rejected", label: "Rejected products", action: "Review rejection" },
    { code: "pending_publish", label: "Pending publish", action: "Open publish task" },
    { code: "missing_trade_conditions", label: "Missing trade conditions", action: "Complete trade terms" },
    { code: "missing_category", label: "Missing category/type", action: "Complete setup" },
    { code: "inventory_setup", label: "Physical inventory setup", action: "Complete initial inventory" }
  ],
  tradeConditions: {
    title: "Trade conditions",
    subtitle: "Commercial rules, pricing terms, supplier/customer terms, validity, and renewal tasks."
  }
};
const DEFAULT_STOREFRONT_MAPPING_UI = {
  title: "Storefront mapping",
  scanButtonLabel: "Scan",
  scanningLabel: "Scanning...",
  connectionLabel: "Scan connection",
  modeLabel: "Scan mode",
  connectionLoadingLabel: "Loading connections...",
  connectionEmptyLabel: "No connected frontend",
  structureLoadingLabel: "Loading structure...",
  structureEmptyLabel: "No structure map yet. Run scan.",
  zoneMappingLabel: "Zone mapping",
  viewMapLabel: "View map",
  modal: {
    eyebrow: "Storefront structure",
    title: "Detected zone mapping",
    subtitle: "Review inferred website zones, approve slots, then create governed content.",
    closeLabel: "Close"
  },
  actions: {
    approve: "Approve",
    edit: "Edit",
    ignore: "Ignore",
    reset: "Reset",
    openContent: "Open content",
    createContent: "Create content"
  },
  diagnostics: {
    renderedAvailable: "Rendered available",
    renderedCandidates: "Rendered candidates",
    staticCandidates: "Static candidates",
    taggedCandidates: "Tagged candidates",
    usableCandidates: "Usable candidates",
    renderedError: "Rendered error",
    recommendation: "Recommendation"
  },
  scanModes: [
    { value: "auto", label: "Auto scan" },
    { value: "rendered", label: "Rendered DOM scan" },
    { value: "generic", label: "Static generic scan" },
    { value: "tagged", label: "Tagged fallback scan" }
  ],
  rendererOptions: [
    "hero_slider",
    "product_carousel",
    "product_grid",
    "editorial_card_grid",
    "rich_text_block",
    "cta_block",
    "newsletter_form",
    "media_gallery",
    "testimonial_grid",
    "feature_block"
  ],
  productSourceModes: PRODUCT_SLOT_SOURCE_MODES,
  requiredFieldsByRenderer: {
    hero_slider: ["slides"],
    product_carousel: ["source_mode"],
    product_grid: ["source_mode"],
    editorial_card_grid: ["slides"],
    rich_text_block: ["slides"],
    cta_block: ["slides"],
    newsletter_form: ["slides"]
  }
};

const STOREFRONT_SLOT_PRESETS = [
  {
    slot: "home.hero",
    title: "Home hero",
    page: "home",
    mode: "hero",
    description: "Main landing slider for the storefront home page."
  },
  {
    slot: "pages.hero",
    title: "Pages hero",
    page: "pages",
    mode: "hero",
    description: "Hero band for the Pages tab."
  },
  {
    slot: "pages.cards",
    title: "Pages cards",
    page: "pages",
    mode: "cards",
    description: "Card content shown inside Pages tab."
  },
  {
    slot: "sizes.hero",
    title: "Sizes hero",
    page: "sizes",
    mode: "hero",
    description: "Intro copy and hero art for Sizes tab."
  },
  {
    slot: "blog.hero",
    title: "Blog hero",
    page: "blog",
    mode: "hero",
    description: "Hero copy for the Blog tab."
  },
  {
    slot: "line.hero",
    title: "Line hero",
    page: "line",
    mode: "hero",
    description: "Collection planning hero section."
  },
  {
    slot: "line.cards",
    title: "Line cards",
    page: "line",
    mode: "cards",
    description: "Capsule cards for Line tab."
  },
  {
    slot: "learning.hero",
    title: "Learning hero",
    page: "learning",
    mode: "hero",
    description: "Learning tab hero section."
  },
  {
    slot: "learning.cards",
    title: "Learning cards",
    page: "learning",
    mode: "cards",
    description: "Training track/session cards."
  },
  {
    slot: "collab.hero",
    title: "Collab hero",
    page: "collab",
    mode: "hero",
    description: "Collab shop hero section."
  },
  {
    slot: "collab.cards",
    title: "Collab cards",
    page: "collab",
    mode: "cards",
    description: "Program cards for Collab tab."
  }
];

const CATEGORY_CREATE_OPTION = "__create_category__";
const VARIANT_HEADER_CREATE_OPTION = "__create_variant_header__";

const STOREFRONT_SLOT_PRESET_MAP = new Map(
  STOREFRONT_SLOT_PRESETS.map((item) => [item.slot, item])
);

const IMAGE_STUDIO_WORKFLOW_PROFILES = [
  {
    id: "product-card",
    label: "Product card",
    description: "Catalog cards and primary product media.",
    width: 1200,
    height: 1500,
    fitMode: "cover",
    mimeType: "image/jpeg",
    quality: 92
  },
  {
    id: "product-gallery",
    label: "Product gallery",
    description: "Detail gallery image with portrait crop.",
    width: 1400,
    height: 1750,
    fitMode: "cover",
    mimeType: "image/jpeg",
    quality: 92
  },
  {
    id: "hero-banner",
    label: "Hero banner",
    description: "Storefront hero and large sliders.",
    width: 1920,
    height: 1080,
    fitMode: "cover",
    mimeType: "image/jpeg",
    quality: 90
  },
  {
    id: "blog-cover",
    label: "Blog cover",
    description: "Blog and article lead image.",
    width: 1800,
    height: 1200,
    fitMode: "cover",
    mimeType: "image/jpeg",
    quality: 90
  },
  {
    id: "content-block",
    label: "Content block",
    description: "Cards, promos, and rich content sections.",
    width: 1600,
    height: 1200,
    fitMode: "cover",
    mimeType: "image/jpeg",
    quality: 90
  }
];

function toCsv(value) {
  if (Array.isArray(value)) return value.join(", ");
  return value || "";
}

function fromCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function detectDelimiter(text) {
  const sample = String(text || "")
    .split(/\r?\n/)
    .find((line) => line.trim().length);
  if (!sample) return ",";
  const comma = (sample.match(/,/g) || []).length;
  const semicolon = (sample.match(/;/g) || []).length;
  const tab = (sample.match(/\t/g) || []).length;
  if (tab > comma && tab > semicolon) return "\t";
  if (semicolon > comma) return ";";
  return ",";
}

function parseDelimited(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(current);
      if (row.some((cell) => String(cell).trim().length)) {
        rows.push(row);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current);
  if (row.some((cell) => String(cell).trim().length)) {
    rows.push(row);
  }
  return rows;
}

function parseCsvObjects(text) {
  const delimiter = detectDelimiter(text);
  const rows = parseDelimited(text, delimiter);
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = row[index] ?? "";
    });
    return record;
  });
}

function splitMultiValue(value) {
  return String(value || "")
    .split(/[,|;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSheetUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (!value.includes("docs.google.com/spreadsheets")) return value;
  const match = value.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return value;
  const id = match[1];
  const gidMatch = value.match(/gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : null;
  const base = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  return gid ? `${base}&gid=${gid}` : base;
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function makeVariantId() {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 7);
  return `vr-${ts}${rnd}`;
}

const VARIANT_RESERVED_KEYS = new Set(["id", "active", "stock_qty", "price_delta", "hasData"]);

function toVariantFieldKey(label, fallback = "option") {
  const raw = String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (raw || fallback).slice(0, 40);
}

function toVariantFieldLabel(key) {
  const value = String(key || "").trim();
  if (!value) return "Option";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function normalizeVariantHeaders(value) {
  const base = Array.isArray(value) ? value : [];
  const ordered = [];
  const seen = new Set();

  const pushHeader = (inputKey, inputLabel) => {
    const key = toVariantFieldKey(inputKey || inputLabel, "option");
    if (!key || seen.has(key)) return;
    seen.add(key);
    ordered.push({
      key,
      label: String(inputLabel || toVariantFieldLabel(key)).trim().slice(0, 60) || toVariantFieldLabel(key)
    });
  };

  base.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    pushHeader(entry.key, entry.label);
  });

  return ordered;
}

function normalizeVariantItem(item, headers = []) {
  const next = item && typeof item === "object" ? { ...item } : {};
  const stock_qty =
    next.stock_qty === "" || next.stock_qty === null || next.stock_qty === undefined
      ? null
      : Number(next.stock_qty);
  const price_delta =
    next.price_delta === "" || next.price_delta === null || next.price_delta === undefined
      ? null
      : Number(next.price_delta);
  const active = next.active !== false;

  const dynamic = {};
  const normalizedHeaders = normalizeVariantHeaders(headers);
  for (const header of normalizedHeaders) {
    const key = header.key;
    dynamic[key] = String(next[key] || "").trim();
  }

  const hasData =
    Object.values(dynamic).some((value) => String(value || "").trim().length > 0) ||
    Number.isFinite(stock_qty) ||
    Number.isFinite(price_delta);

  return {
    id: String(next.id || makeVariantId()),
    ...dynamic,
    stock_qty: Number.isFinite(stock_qty) ? stock_qty : null,
    price_delta: Number.isFinite(price_delta) ? price_delta : null,
    active,
    hasData
  };
}

function normalizeProductVariants(value) {
  const raw = value && typeof value === "object" ? value : {};
  const inputItems = Array.isArray(raw.items) ? raw.items : [];
  const headers = normalizeVariantHeaders(raw.headers);
  const items = inputItems.map((item) => normalizeVariantItem(item, headers));
  const hasExplicitEnabled = raw.enabled === true || raw.enabled === false;
  const enabled = hasExplicitEnabled ? raw.enabled === true : items.some((item) => item.hasData);
  return { enabled, headers, items };
}

function compactProductVariants(value) {
  const normalized = normalizeProductVariants(value);
  const items = normalized.items
    .filter((item) => item.hasData)
    .map(({ hasData, ...item }) => item);
  if (!normalized.enabled && !items.length) return null;
  return { enabled: normalized.enabled, headers: normalized.headers, items };
}

function summarizeProductVariants(value) {
  const normalized = normalizeProductVariants(value);
  const activeItems = normalized.items.filter((item) => item.hasData && item.active !== false);
  return {
    enabled: normalized.enabled,
    totalCount: normalized.items.length,
    activeCount: activeItems.length,
    hasRows: normalized.items.length > 0
  };
}

function computeVariantInventoryTotals(value) {
  const normalized = normalizeProductVariants(value);
  let activeQty = 0;
  let totalQty = 0;
  for (const item of normalized.items) {
    const parsedQty = Number(item?.stock_qty);
    const qty = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 0;
    totalQty += qty;
    if (item?.active !== false) {
      activeQty += qty;
    }
  }
  return {
    enabled: normalized.enabled,
    activeQty,
    totalQty
  };
}

function resolveProductStock(attrs) {
  const source = attrs && typeof attrs === "object" ? attrs : {};
  const variants = normalizeProductVariants(source.variants);
  if (variants.enabled) {
    return computeVariantInventoryTotals(variants).activeQty;
  }
  const availableQty = Number(source?.inventory?.available_qty);
  if (Number.isFinite(availableQty)) return Math.max(0, availableQty);
  const onHandQty = Number(source?.inventory?.on_hand);
  if (Number.isFinite(onHandQty)) return Math.max(0, onHandQty);
  return 0;
}

function toCsvValue(value) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  if (/["\n\r,]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function safeNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
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
  const raw = parsed.raw || "";

  if (code === "FORBIDDEN" || parsed.status === 403) {
    return "Access denied. Ask an admin to grant catalog permissions.";
  }
  if (code === "UNAUTHENTICATED") {
    return "Session expired. Please sign in again.";
  }
  if (code === "CSRF_MISSING" || code === "CSRF_MISMATCH" || code === "CSRF_INVALID") {
    return "Security check failed. Refresh the page and try again.";
  }
  if (code === "STATUS_LIST_MISSING") {
    return "Workflow statuses are not configured for this tenant. Ask an administrator to complete tenant setup.";
  }
  if (code === "INVALID_STATUS") {
    return "Status is not valid for SERVICE_OBJECT_STATUS.";
  }
  if (code === "PROCESS_BINDING_REQUIRED") {
    return "Product workflow is not configured for this tenant. Ask an administrator to complete tenant setup.";
  }
  if (code === "PROCESS_DEF_NOT_FOUND") {
    return "Product process definition is missing for this tenant.";
  }
  if (code === "OBJECT_TYPE_MISMATCH") {
    return "Process definition object_type does not match product.";
  }
  if (code === "INVALID_TRANSITION") {
    return "Process transition not found for this action.";
  }
  if (code === "TASK_TEMPLATE_NOT_FOUND") {
    return "Task template is missing or inactive for this process.";
  }
  if (code === "MATERIAL_ID_REQUIRED") {
    return "Material reference missing for this workflow action.";
  }
  if (code.startsWith("EFFECT_HANDLER_NOT_FOUND")) {
    return `Process effect not registered: ${code.split(":")[1] || "unknown"}.`;
  }
  if (code === "SKU_IMMUTABLE") {
    return "SKU is locked once generated. Clear the product and create a new SKU instead.";
  }
  if (code === "ASSET_TENANT_MISMATCH") {
    return "One or more media URLs point to another tenant. Re-upload the files in this tenant.";
  }
  if (code === "SUPPLIER_CODE_REQUIRED") {
    return "Supplier code is required to generate the SKU.";
  }
  if (code === "SKU_GENERATION_FAILED") {
    return "SKU generation failed. Check category setup and SKU policy, then retry.";
  }
  if (code === "PRODUCT_REQUIRED_FIELDS_MISSING") {
    const fields = Array.isArray(parsed.payload?.missing_fields)
      ? parsed.payload.missing_fields.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    if (fields.length) {
      return `Save blocked. Required before save: ${fields.join(", ")}.`;
    }
    return "Save blocked. Complete required product fields first.";
  }
  if (raw.includes("UNAUTHENTICATED")) {
    return "Session expired. Please sign in again.";
  }

  return fallback || code || raw || err?.message || "Request failed.";
}

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm", ".ogg"];
const DOCUMENT_EXTENSIONS = [
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
];

function guessVideoFromUrl(url) {
  const lower = String(url || "").toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.includes(ext));
}

function guessDocumentFromUrl(url) {
  const lower = String(url || "").toLowerCase();
  return DOCUMENT_EXTENSIONS.some((ext) => lower.includes(ext));
}

function isVideoAsset(asset) {
  if (!asset) return false;
  if (asset.type && String(asset.type).startsWith("video/")) return true;
  if (asset.url) return guessVideoFromUrl(asset.url);
  if (typeof asset === "string") return guessVideoFromUrl(asset);
  return false;
}

function isDocumentAsset(asset) {
  if (!asset) return false;
  const type = String(asset.type || "");
  if (type.startsWith("video/") || type.startsWith("image/")) return false;
  if (type.startsWith("application/") || type.startsWith("text/")) return true;
  if (asset.url) return guessDocumentFromUrl(asset.url);
  if (typeof asset === "string") return guessDocumentFromUrl(asset);
  return false;
}

function normalizeAsset(source) {
  if (!source) return null;
  if (typeof source === "string") {
    if (guessVideoFromUrl(source)) return { url: source, type: "video" };
    if (guessDocumentFromUrl(source)) return { url: source, type: "document" };
    return { url: source, type: "image" };
  }
  if (source.url) {
    const inferredType = guessVideoFromUrl(source.url)
      ? "video"
      : guessDocumentFromUrl(source.url)
        ? "document"
        : "image";
    return {
      name: source.name,
      url: source.url,
      preview_url: source.preview_url,
      kind: source.kind,
      type: source.type || inferredType
    };
  }
  if (source.preview_url) {
    return {
      name: source.name,
      preview_url: source.preview_url,
      type: source.type || "image"
    };
  }
  return null;
}

function normalizeAssetList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeAsset).filter(Boolean);
}

function resolveAssetUrl(url) {
  if (!url) return "";
  if (String(url).startsWith("http")) return url;
  if (String(url).startsWith("blob:") || String(url).startsWith("data:")) return url;
  if (String(url).startsWith("/")) return `${ASSET_BASE}${url}`;
  return `${ASSET_BASE}/${url}`;
}

function revokePreview(asset) {
  const preview = asset?.preview_url;
  if (preview && typeof preview === "string" && preview.startsWith("blob:")) {
    URL.revokeObjectURL(preview);
  }
}

function sanitizeMediaAttrs(media) {
  if (!media || typeof media !== "object") return media;
  const next = { ...media };
  if (next.main_asset) {
    const { preview_url, previewUrl, ...rest } = next.main_asset;
    if (!rest.url) {
      delete next.main_asset;
    } else {
      next.main_asset = rest;
    }
  }
  if (next.hero_asset) {
    const { preview_url, previewUrl, ...rest } = next.hero_asset;
    if (!rest.url) {
      delete next.hero_asset;
    } else {
      next.hero_asset = rest;
    }
  }
  if (Array.isArray(next.gallery_assets)) {
    next.gallery_assets = next.gallery_assets
      .map((asset) => {
        if (!asset || typeof asset !== "object") return null;
        const { preview_url, previewUrl, ...rest } = asset;
        return rest.url ? rest : null;
      })
      .filter(Boolean);
  }
  if (Array.isArray(next.document_assets)) {
    next.document_assets = next.document_assets
      .map((asset) => {
        if (!asset || typeof asset !== "object") return null;
        const { preview_url, previewUrl, ...rest } = asset;
        return rest.url ? rest : null;
      })
      .filter(Boolean);
  }
  return next;
}

function pickThumbnail(item) {
  const media = item?.attrs?.media || {};
  const mainAsset = normalizeAsset(media.main_asset || media.main_url || media.hero_asset || media.hero_url);
  if (mainAsset?.url) return resolveAssetUrl(mainAsset.url);
  const galleryAsset = normalizeAssetList(media.gallery_assets)?.[0];
  if (galleryAsset?.url) return resolveAssetUrl(galleryAsset.url);
  const galleryUrl = normalizeAssetList(media.gallery)?.[0];
  return galleryUrl?.url ? resolveAssetUrl(galleryUrl.url) : "";
}

async function fileToAsset(file, options = {}) {
  const assetKind = options.assetKind === "document" ? "document" : "media";
  const formData = new FormData();
  formData.append("file", file);
  formData.append("asset_kind", assetKind);
  const payload = await apiFetch("/api/eip/ecom/uploads", {
    method: "POST",
    body: formData
  });
  const asset = payload?.asset || {};
  return {
    name: asset.name || file.name,
    type: asset.type || file.type || (guessVideoFromUrl(file.name) ? "video" : assetKind),
    kind: asset.kind || assetKind,
    // Persist canonical local path; signed URLs are generated at read time.
    url: asset.raw_url || asset.url
  };
}

function defaultDraft() {
  return {
    id: null,
    code: "",
    title: "",
    attrs: { ...EMPTY_ATTRS }
  };
}

function hydrateDraft(item) {
  if (!item) return defaultDraft();
  const attrs = {
    ...EMPTY_ATTRS,
    ...(item.attrs || {})
  };
  attrs.variants = normalizeProductVariants(attrs.variants);
  return {
    id: item.id,
    code: item.code || "",
    title: item.title || "",
    attrs
  };
}

function defaultStorefrontDraft(slot = "home.hero") {
  const normalizedSlot = normalizeStorefrontSlot(slot);
  const preset = getStorefrontSlotPreset(normalizedSlot);
  const mode = storefrontSlotMode(normalizedSlot);
  return {
    id: null,
    code: "",
    slot: normalizedSlot,
    title: preset?.title || "Storefront content",
    category_code: "",
    category_label: "",
    status: "new",
    is_active: true,
    attrs: {},
    slides: [
      {
        id: "slide-1",
        image: "",
        eyebrow: "",
        title: "",
        subtitle: "",
        body: "",
        cta_label: mode === "cards" ? "Open" : "Shop patterns",
        cta_url: mode === "cards" ? "" : "/patterns",
        cta_action: "navigate_internal",
        cta_target: mode === "cards" ? "" : "/patterns",
        cta_new_tab: false,
        cta: {
          action: "navigate_internal",
          target: mode === "cards" ? "" : "/patterns",
          new_tab: false
        },
        overlay: "left",
        fit: "cover",
        focus_x: 50,
        focus_y: 50,
        overlay_strength: 78,
        order: 1
      }
    ]
  };
}

function clampPercent(value, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function normalizeStorefrontCtaDraft(slide = {}) {
  const rawTarget = String(
    slide?.cta?.target ||
      slide?.cta_target ||
      slide?.cta_url ||
      slide?.ctaUrl ||
      ""
  ).trim();
  const rawAction = String(
    slide?.cta?.action ||
      slide?.cta_action ||
      ""
  ).trim().toLowerCase();
  const action = ["navigate_internal", "navigate_external", "scroll_to"].includes(rawAction)
    ? rawAction
    : rawTarget
      ? /^https?:\/\//i.test(rawTarget)
        ? "navigate_external"
        : rawTarget.startsWith("#")
          ? "scroll_to"
          : "navigate_internal"
      : "navigate_internal";
  const newTabRaw =
    slide?.cta?.new_tab ??
    slide?.cta_new_tab ??
    slide?.cta?.newTab ??
    slide?.cta_newTab;
  const newTab = newTabRaw === true || String(newTabRaw || "").toLowerCase() === "true";
  return {
    action,
    target: rawTarget,
    new_tab: newTab
  };
}

function normalizeStorefrontSlot(value) {
  const slot = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 80);
  return slot || "home.hero";
}

function normalizeStorefrontCategoryCode(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  return raw
    .replace(/[^A-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeProductCategoryCode(value) {
  return normalizeStorefrontCategoryCode(value);
}

function normalizeProductCategoryLabel(value, fallbackCode = "") {
  const label = String(value || "").trim();
  if (label) return label.slice(0, 120);
  const code = normalizeProductCategoryCode(fallbackCode);
  if (!code) return "";
  return code
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0) + token.slice(1).toLowerCase())
    .join(" ");
}

function normalizeProductSubcategoryCode(value) {
  return normalizeProductCategoryCode(value);
}

function normalizeProductSubcategoryLabel(value, fallbackCode = "") {
  return normalizeProductCategoryLabel(value, fallbackCode);
}

function normalizeProductSubcategories(items) {
  const source = Array.isArray(items) ? items : [];
  const ordered = [];
  const seen = new Set();
  source.forEach((item, index) => {
    const code = normalizeProductSubcategoryCode(
      typeof item === "string" ? item : item?.code || item?.label
    );
    if (!code || seen.has(code)) return;
    seen.add(code);
    ordered.push({
      code,
      label: normalizeProductSubcategoryLabel(
        typeof item === "string" ? item : item?.label,
        code
      ),
      sort_order:
        Number.isInteger(Number(item?.sort_order)) && Number(item.sort_order) > 0
          ? Number(item.sort_order)
          : (index + 1) * 10,
      is_active: item?.is_active !== false
    });
  });
  return ordered;
}

function normalizeCategoryVariantHeaders(items) {
  const source = Array.isArray(items) ? items : [];
  const ordered = [];
  const seen = new Set();
  source.forEach((item, index) => {
    const code = toVariantFieldKey(
      typeof item === "string" ? item : item?.code || item?.key || item?.label,
      ""
    );
    if (!code || seen.has(code)) return;
    seen.add(code);
    ordered.push({
      code,
      label: String(
        typeof item === "string" ? toVariantFieldLabel(code) : item?.label || toVariantFieldLabel(code)
      ).trim(),
      sort_order:
        Number.isInteger(Number(item?.sort_order)) && Number(item.sort_order) > 0
          ? Number(item.sort_order)
          : (index + 1) * 10,
      is_active: item?.is_active !== false
    });
  });
  return ordered;
}

function defaultProductCategoryComposer(seedLabel = "") {
  return {
    label: String(seedLabel || "").trim(),
    subcategory: "",
    variantHeaderCodes: [],
    selectedVariantHeaderCode: "",
    mode: "create",
    sourceCode: ""
  };
}

function normalizeProductCategoryCatalog(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const code = normalizeProductCategoryCode(item?.code || "");
      if (!code) return null;
      return {
        code,
        label: normalizeProductCategoryLabel(item?.label, code) || code,
        sort_order: Number(item?.sort_order || 0),
        is_active: item?.is_active !== false,
        subcategories: normalizeProductSubcategories(item?.subcategories),
        variant_headers: normalizeCategoryVariantHeaders(item?.variant_headers)
      };
    })
    .filter(Boolean);
}

function iconForStudioTabMode(mode) {
  const value = String(mode || "").trim().toLowerCase();
  if (value === "blocks") return LayoutTemplate;
  if (value === "blog") return MessageSquare;
  if (value === "pages") return FileText;
  return CircleDot;
}

function getStorefrontSlotPreset(slotValue) {
  const slot = normalizeStorefrontSlot(slotValue);
  return STOREFRONT_SLOT_PRESET_MAP.get(slot) || null;
}

function storefrontPreviewPageForSlot(slotValue) {
  const preset = getStorefrontSlotPreset(slotValue);
  if (preset?.page) return preset.page;
  const slot = normalizeStorefrontSlot(slotValue);
  if (slot.startsWith("pages.")) return "pages";
  if (slot.startsWith("sizes.")) return "sizes";
  if (slot.startsWith("blog.")) return "blog";
  if (slot.startsWith("line.")) return "line";
  if (slot.startsWith("learning.")) return "learning";
  if (slot.startsWith("collab.")) return "collab";
  return "home";
}

function storefrontSlotMode(slotValue) {
  const preset = getStorefrontSlotPreset(slotValue);
  if (preset?.mode) return preset.mode;
  const slot = normalizeStorefrontSlot(slotValue);
  if (slot.endsWith(".cards") || slot.includes(".cards.")) return "cards";
  return "hero";
}

function resolveStorefrontMappingUi(value) {
  const input = value && typeof value === "object" ? value : {};
  const scanModes = Array.isArray(input.scanModes)
    ? input.scanModes
        .map((item) => ({
          value: String(item?.value || "").trim().toLowerCase(),
          label: String(item?.label || item?.value || "").trim()
        }))
        .filter((item) => item.value && item.label)
    : [];
  const rendererOptions = Array.isArray(input.rendererOptions)
    ? input.rendererOptions.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const productSourceModes = Array.isArray(input.productSourceModes)
    ? input.productSourceModes
        .map((item) => ({
          value: String(item?.value || "").trim().toLowerCase(),
          label: String(item?.label || item?.value || "").trim()
        }))
        .filter((item) => item.label)
    : [];
  const slotPresets = Array.isArray(input.slotPresets)
    ? input.slotPresets
        .map((item) => {
          const rawSlot = String(item?.slot || "").trim();
          if (!rawSlot) return null;
          const slot = normalizeStorefrontSlot(rawSlot);
          return {
            slot,
            title: String(item?.title || slot).trim(),
            page: normalizeStorefrontSlot(item?.page || slot.split(".")[0] || "home"),
            mode: String(item?.mode || "").trim().toLowerCase() === "cards" ? "cards" : "hero",
            description: String(item?.description || "").trim()
          };
        })
        .filter(Boolean)
    : [];
  const requiredFieldsByRenderer =
    input.requiredFieldsByRenderer && typeof input.requiredFieldsByRenderer === "object"
      ? input.requiredFieldsByRenderer
      : {};
  return {
    ...DEFAULT_STOREFRONT_MAPPING_UI,
    ...input,
    modal: { ...DEFAULT_STOREFRONT_MAPPING_UI.modal, ...(input.modal || {}) },
    actions: { ...DEFAULT_STOREFRONT_MAPPING_UI.actions, ...(input.actions || {}) },
    diagnostics: { ...DEFAULT_STOREFRONT_MAPPING_UI.diagnostics, ...(input.diagnostics || {}) },
    scanModes: scanModes.length ? scanModes : DEFAULT_STOREFRONT_MAPPING_UI.scanModes,
    rendererOptions: rendererOptions.length ? rendererOptions : DEFAULT_STOREFRONT_MAPPING_UI.rendererOptions,
    productSourceModes: productSourceModes.length
      ? productSourceModes
      : DEFAULT_STOREFRONT_MAPPING_UI.productSourceModes,
    slotPresets: slotPresets.length ? slotPresets : STOREFRONT_SLOT_PRESETS,
    requiredFieldsByRenderer: {
      ...DEFAULT_STOREFRONT_MAPPING_UI.requiredFieldsByRenderer,
      ...requiredFieldsByRenderer
    }
  };
}

function inferProductSourceTag(slotValue) {
  const slot = normalizeStorefrontSlot(slotValue);
  if (slot.includes("worth")) return "worth";
  if (slot.includes("drop")) return "drop";
  if (slot.includes("featured")) return "featured";
  return "";
}

function isStorefrontSlideContentful(slide) {
  if (!slide || typeof slide !== "object") return false;
  return Boolean(
      String(slide.image || "").trim() ||
      String(slide.eyebrow || "").trim() ||
      String(slide.title || "").trim() ||
      String(slide.subtitle || "").trim() ||
      String(slide.body || "").trim() ||
      String(slide.cta_label || "").trim()
  );
}

function normalizeStorefrontSlideDraft(slide, index = 0) {
  if (!slide || typeof slide !== "object") return null;
  const cta = normalizeStorefrontCtaDraft(slide);
  return {
    id: String(slide.id || `slide-${index + 1}`),
    image: String(slide.image || slide.image_url || "").trim(),
    eyebrow: String(slide.eyebrow || "").trim(),
    title: String(slide.title || "").trim(),
    subtitle: String(slide.subtitle || "").trim(),
    body: String(slide.body || slide.content || "").trim(),
    cta_label: String(slide.cta_label || slide.ctaLabel || "").trim(),
    cta_url: cta.target,
    cta_action: cta.action,
    cta_target: cta.target,
    cta_new_tab: cta.new_tab,
    cta: cta,
    overlay: String(slide.overlay || "").toLowerCase() === "center" ? "center" : "left",
    fit: String(slide.fit || slide.image_fit || "").toLowerCase() === "contain" ? "contain" : "cover",
    focus_x: clampPercent(slide.focus_x, 50),
    focus_y: clampPercent(slide.focus_y, 50),
    overlay_strength: clampPercent(slide.overlay_strength, 78),
    order: Number.isFinite(Number(slide.order)) ? Number(slide.order) : index + 1
  };
}

function normalizeStorefrontDraft(item) {
  if (!item || typeof item !== "object") return defaultStorefrontDraft();
  const slides = Array.isArray(item.slides)
    ? item.slides.map((slide, index) => normalizeStorefrontSlideDraft(slide, index)).filter(Boolean)
    : [];
  const attrs = item.attrs && typeof item.attrs === "object" ? item.attrs : {};
  return {
    id: item.id || null,
    code: String(item.code || ""),
    slot: normalizeStorefrontSlot(item.slot || "home.hero"),
    title: String(item.title || "Home hero"),
    category_code: normalizeStorefrontCategoryCode(item.category_code || attrs.content_category_code || attrs?.content_category?.code || ""),
    category_label: String(item.category_label || attrs.content_category_label || attrs?.content_category?.label || ""),
    status: String(item.status || "new").toLowerCase(),
    is_active: item.is_active !== false,
    attrs: attrs,
    slides: slides.length ? slides : defaultStorefrontDraft(item.slot || "home.hero").slides
  };
}

function defaultPageContentDraft(slot = "pages.cards") {
  return {
    id: null,
    code: "",
    slot: normalizeStorefrontSlot(slot || "pages.cards"),
    title: "",
    category_code: "",
    category_label: "",
    status: "new",
    is_active: true,
    content_model: "article",
    attrs: {},
    article: {
      image: "",
      eyebrow: "",
      title: "",
      excerpt: "",
      body: "",
      cta_label: "Read article",
      cta_action: "navigate_internal",
      cta_target: "",
      cta_new_tab: false
    }
  };
}

function normalizePageContentDraft(item) {
  const base = defaultPageContentDraft(item?.slot || "pages.cards");
  if (!item || typeof item !== "object") return base;
  const article = item.article && typeof item.article === "object" ? item.article : {};
  return {
    ...base,
    id: item.id || null,
    code: String(item.code || ""),
    slot: normalizeStorefrontSlot(item.slot || base.slot),
    title: String(item.title || article.title || ""),
    category_code: normalizeStorefrontCategoryCode(item.category_code || item?.attrs?.content_category_code || item?.attrs?.content_category?.code || ""),
    category_label: String(item.category_label || item?.attrs?.content_category_label || item?.attrs?.content_category?.label || ""),
    status: String(item.status || "new").toLowerCase(),
    is_active: item.is_active !== false,
    attrs: item.attrs && typeof item.attrs === "object" ? item.attrs : {},
    content_model: "article",
    article: {
      ...base.article,
      image: String(article.image || article.image_url || "").trim(),
      eyebrow: String(article.eyebrow || "").trim(),
      title: String(article.title || item.title || "").trim(),
      excerpt: String(article.excerpt || article.subtitle || article.summary || "").trim(),
      body: String(article.body || article.content || "").trim(),
      cta_label: String(article.cta_label || article.ctaLabel || "Read article").trim(),
      cta_action: String(article.cta_action || article?.cta?.action || "navigate_internal").trim().toLowerCase() || "navigate_internal",
      cta_target: String(article.cta_target || article.cta_url || article?.cta?.target || "").trim(),
      cta_new_tab:
        article.cta_new_tab === true ||
        article?.cta?.new_tab === true ||
        String(article?.cta?.newTab || "").toLowerCase() === "true"
    }
  };
}

function buildPageNumbers(page, totalPages) {
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) pages.push(i);
    return pages;
  }
  pages.push(1);
  if (page > 3) pages.push("ellipsis-start");
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (page < totalPages - 2) pages.push("ellipsis-end");
  pages.push(totalPages);
  return pages;
}

function resolveProductStudioUi(overrides = {}) {
  const allowedTabs = new Set(["studio", "focus"]);
  const configuredTabs = Array.isArray(overrides?.tabs) && overrides.tabs.length
    ? overrides.tabs.filter((tab) => allowedTabs.has(tab.id))
    : DEFAULT_PRODUCT_STUDIO_UI.tabs;
  return {
    ...DEFAULT_PRODUCT_STUDIO_UI,
    ...(overrides || {}),
    tabs: configuredTabs.length ? configuredTabs : DEFAULT_PRODUCT_STUDIO_UI.tabs,
    focusRules: Array.isArray(overrides?.focusRules) && overrides.focusRules.length
      ? overrides.focusRules
      : DEFAULT_PRODUCT_STUDIO_UI.focusRules,
    tradeConditions: {
      ...DEFAULT_PRODUCT_STUDIO_UI.tradeConditions,
      ...(overrides?.tradeConditions || {})
    }
  };
}

function productStage(item = {}) {
  return String(item?.attrs?.workflow?.stage || item?.status || "new").toLowerCase();
}

function productType(item = {}) {
  const attrs = item?.attrs || {};
  return String(
    attrs.product_type ||
    attrs.material_type ||
    attrs.taxonomy?.product_type ||
    attrs.taxonomy?.type ||
    ""
  ).toLowerCase();
}

function isDigitalProduct(item = {}) {
  const type = productType(item);
  return ["digital", "download", "service", "virtual"].some((token) => type.includes(token));
}

function productTradeConditions(item = {}) {
  const attrs = item?.attrs || {};
  const candidates = [
    attrs.commercial_conditions,
    attrs.trade_conditions,
    attrs.pricing?.conditions,
    attrs.conditions
  ];
  return candidates.find((value) => Array.isArray(value)) || [];
}

function hasTradeConditions(item = {}) {
  return productTradeConditions(item).length > 0 || Boolean(item?.attrs?.pricing?.tiers?.length);
}

function needsInitialInventorySetup(item = {}) {
  if (isDigitalProduct(item)) return false;
  const inventory = item?.attrs?.inventory || {};
  const stage = productStage(item);
  const active = ["published", "completed", "active"].includes(stage);
  return !active && inventory.track_inventory !== false && inventory.available_qty == null && inventory.on_hand == null;
}

function buildProductFocusItems(products = [], rules = DEFAULT_PRODUCT_STUDIO_UI.focusRules) {
  const counts = {
    rejected: products.filter((item) => productStage(item) === "rejected"),
    pending_publish: products.filter((item) => ["review", "approved", "intake"].includes(productStage(item))),
    missing_trade_conditions: products.filter((item) => !hasTradeConditions(item)),
    missing_category: products.filter((item) => !(item.attrs?.taxonomy?.category || item.attrs?.taxonomy?.category_code)),
    inventory_setup: products.filter((item) => needsInitialInventorySetup(item))
  };
  return (rules || []).map((rule) => ({
    ...rule,
    items: counts[rule.code] || [],
    count: (counts[rule.code] || []).length
  }));
}

export default function EcomProductWorkspace({ node }) {
  const contentStudioOnly = node?.props?.mode === "content-studio";
  const productStudioUi = useMemo(
    () => resolveProductStudioUi(node?.props?.productStudio),
    [node?.props?.productStudio]
  );
  const storefrontMappingUi = useMemo(
    () => resolveStorefrontMappingUi(node?.props?.storefrontMapping),
    [node?.props?.storefrontMapping]
  );
  const storefrontSlotPresetMap = useMemo(
    () => new Map(storefrontMappingUi.slotPresets.map((item) => [item.slot, item])),
    [storefrontMappingUi.slotPresets]
  );
  const getConfiguredStorefrontSlotPreset = (slotValue) =>
    storefrontSlotPresetMap.get(normalizeStorefrontSlot(slotValue)) || null;
  const storefrontSlotModeFor = (slotValue) => {
    const preset = getConfiguredStorefrontSlotPreset(slotValue);
    if (preset?.mode) return preset.mode;
    return normalizeStorefrontSlot(slotValue).endsWith(".cards") ? "cards" : "hero";
  };
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [pageSize, setPageSize] = useState(12);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importMode, setImportMode] = useState("file");
  const [importUrl, setImportUrl] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState({ tone: "", message: "" });
  const [draft, setDraft] = useState(defaultDraft());
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("success");
  const [translationService, setTranslationService] = useState({
    checked: false,
    available: false,
    state: "offline",
    message: ""
  });
  const [showNew, setShowNew] = useState(false);
  const [newProduct, setNewProduct] = useState({ supplierCode: "", title: "" });
  const [activeSection, setActiveSection] = useState(contentStudioOnly ? "storefront" : "basics");
  const [reviewItems, setReviewItems] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewStatusFilter, setReviewStatusFilter] = useState("pending_review");
  const [reviewActionLoadingId, setReviewActionLoadingId] = useState("");
  const [storefrontDraft, setStorefrontDraft] = useState(defaultStorefrontDraft());
  const [storefrontLoading, setStorefrontLoading] = useState(false);
  const [storefrontSaving, setStorefrontSaving] = useState(false);
  const [storefrontUploadingIndex, setStorefrontUploadingIndex] = useState(null);
  const [storefrontListLoading, setStorefrontListLoading] = useState(false);
  const [storefrontListError, setStorefrontListError] = useState("");
  const [storefrontItems, setStorefrontItems] = useState([]);
  const [storefrontQuery, setStorefrontQuery] = useState("");
  const [storefrontPageSize, setStorefrontPageSize] = useState(12);
  const [storefrontPage, setStorefrontPage] = useState(1);
  const [storefrontTotal, setStorefrontTotal] = useState(0);
  const [storefrontStudioTabs, setStorefrontStudioTabs] = useState([]);
  const [storefrontStudioTabsLoading, setStorefrontStudioTabsLoading] = useState(false);
  const [storefrontStudioTabsSaving, setStorefrontStudioTabsSaving] = useState(false);
  const [showStorefrontStudioTabsModal, setShowStorefrontStudioTabsModal] = useState(false);
  const [storefrontStudioTabEditorRows, setStorefrontStudioTabEditorRows] = useState([]);
  const [storefrontCategories, setStorefrontCategories] = useState([]);
  const [storefrontCategoriesLoading, setStorefrontCategoriesLoading] = useState(false);
  const [selectedStorefrontSlot, setSelectedStorefrontSlot] = useState("home.hero");
  const [showStorefrontNew, setShowStorefrontNew] = useState(false);
  const [newStorefront, setNewStorefront] = useState({ slot: "", title: "", category_code: "" });
  const [storefrontActionLoading, setStorefrontActionLoading] = useState(false);
  const [storefrontDeleteLoading, setStorefrontDeleteLoading] = useState(false);
  const [storefrontStructure, setStorefrontStructure] = useState(null);
  const [storefrontStructureLoading, setStorefrontStructureLoading] = useState(false);
  const [storefrontStructureScanning, setStorefrontStructureScanning] = useState(false);
  const [storefrontScanMode, setStorefrontScanMode] = useState("auto");
  const [storefrontMappingSavingId, setStorefrontMappingSavingId] = useState("");
  const [storefrontConnections, setStorefrontConnections] = useState([]);
  const [storefrontConnectionsLoading, setStorefrontConnectionsLoading] = useState(false);
  const [selectedStorefrontConnectionCode, setSelectedStorefrontConnectionCode] = useState("");
  const [showStorefrontMappingModal, setShowStorefrontMappingModal] = useState(false);
  const [contentStudioTab, setContentStudioTab] = useState("blocks");
  const [storefrontBlogPosts, setStorefrontBlogPosts] = useState([]);
  const [storefrontBlogLoading, setStorefrontBlogLoading] = useState(false);
  const [storefrontBlogError, setStorefrontBlogError] = useState("");
  const [storefrontBlogDeletingId, setStorefrontBlogDeletingId] = useState("");
  const [storefrontBlogQuery, setStorefrontBlogQuery] = useState("");
  const [storefrontBlogStatus, setStorefrontBlogStatus] = useState("all");
  const [storefrontBlogPageSize, setStorefrontBlogPageSize] = useState(12);
  const [storefrontBlogPage, setStorefrontBlogPage] = useState(1);
  const [storefrontBlogTotal, setStorefrontBlogTotal] = useState(0);
  const [pageContentDraft, setPageContentDraft] = useState(defaultPageContentDraft());
  const [pageContentItems, setPageContentItems] = useState([]);
  const [pageContentLoading, setPageContentLoading] = useState(false);
  const [pageContentSaving, setPageContentSaving] = useState(false);
  const [pageContentActionLoading, setPageContentActionLoading] = useState(false);
  const [pageContentDeleteLoading, setPageContentDeleteLoading] = useState(false);
  const [pageContentUploading, setPageContentUploading] = useState(false);
  const [pageContentListError, setPageContentListError] = useState("");
  const [pageContentQuery, setPageContentQuery] = useState("");
  const [pageContentStatus, setPageContentStatus] = useState("all");
  const [pageContentPageSize, setPageContentPageSize] = useState(12);
  const [pageContentPage, setPageContentPage] = useState(1);
  const [pageContentTotal, setPageContentTotal] = useState(0);
  const [selectedPageContentId, setSelectedPageContentId] = useState("");
  const [showPageContentNew, setShowPageContentNew] = useState(false);
  const [newPageContent, setNewPageContent] = useState({ slot: "pages.cards", title: "", category_code: "" });
  const [variantInventoryQuery, setVariantInventoryQuery] = useState("");
  const [variantInventoryPageSize, setVariantInventoryPageSize] = useState(7);
  const [variantInventoryPage, setVariantInventoryPage] = useState(1);
  const [variantHeaderCatalog, setVariantHeaderCatalog] = useState([]);
  const [variantHeaderCatalogLoading, setVariantHeaderCatalogLoading] = useState(false);
  const [productCategoryCatalog, setProductCategoryCatalog] = useState([]);
  const [productCategoryCatalogLoading, setProductCategoryCatalogLoading] = useState(false);
  const [productCategorySaveLoading, setProductCategorySaveLoading] = useState(false);
  const imageStudioResolverRef = useRef(null);
  const productCategoryComposerResolverRef = useRef(null);
  const [imageStudioSession, setImageStudioSession] = useState({
    open: false,
    file: null,
    title: "Edit image",
    recommendedSize: null,
    presetProfiles: IMAGE_STUDIO_WORKFLOW_PROFILES,
    defaultProfileId: ""
  });
  const [miniModalRequest, setMiniModalRequest] = useState(null);
  const [productCategoryComposer, setProductCategoryComposer] = useState(null);
  const [productCategoryComposerError, setProductCategoryComposerError] = useState("");
  const [productStudioTab, setProductStudioTab] = useState("studio");
  const [showTradeConditions, setShowTradeConditions] = useState(false);

  const stage = draft?.attrs?.workflow?.stage || "";
  const stageBadge = STAGE_BADGES[stage] || {
    label: stage ? stage : "Draft",
    icon: CalendarClock,
    className: "bg-slate-100 text-slate-600"
  };
  const StageIcon = stageBadge.icon || CalendarClock;
  const productFocusItems = useMemo(
    () => buildProductFocusItems(products, productStudioUi.focusRules),
    [productStudioUi.focusRules, products]
  );
  const currentProductIsDigital = isDigitalProduct(draft);
  const currentProductNeedsInventorySetup = needsInitialInventorySetup(draft);
  const storefrontStage = String(
    storefrontDraft?.attrs?.workflow?.stage ||
      storefrontDraft?.status ||
      ""
  ).toLowerCase();
  const storefrontStageBadge = STAGE_BADGES[storefrontStage] || {
    label: storefrontStage ? storefrontStage : "Draft",
    icon: CalendarClock,
    className: "bg-slate-100 text-slate-600"
  };
  const StorefrontStageIcon = storefrontStageBadge.icon || CalendarClock;
  const settleImageStudio = (value = null) => {
    const resolver = imageStudioResolverRef.current;
    imageStudioResolverRef.current = null;
    setImageStudioSession({
      open: false,
      file: null,
      title: "Edit image",
      recommendedSize: null,
      presetProfiles: IMAGE_STUDIO_WORKFLOW_PROFILES,
      defaultProfileId: ""
    });
    if (resolver) resolver(value);
  };

  const openImageStudioForFile = (file, options = {}) => {
    if (!file || !String(file.type || "").toLowerCase().startsWith("image/")) {
      return Promise.resolve(file || null);
    }
    return new Promise((resolve) => {
      imageStudioResolverRef.current = resolve;
      setImageStudioSession({
        open: true,
        file,
        title: String(options.title || "Edit image"),
        recommendedSize:
          options.recommendedSize && typeof options.recommendedSize === "object"
            ? options.recommendedSize
            : null,
        presetProfiles:
          Array.isArray(options.presetProfiles) && options.presetProfiles.length
            ? options.presetProfiles
            : IMAGE_STUDIO_WORKFLOW_PROFILES,
        defaultProfileId: String(options.defaultProfileId || "").trim()
      });
    });
  };

  const requestConfirm = ({
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    confirmTone = "default"
  }) =>
    new Promise((resolve) => {
      setMiniModalRequest({
        mode: "confirm",
        title,
        message,
        confirmLabel,
        cancelLabel,
        confirmTone,
        resolve
      });
    });

  const requestPrompt = ({
    title,
    message,
    inputLabel = "Input",
    inputPlaceholder = "",
    defaultValue = "",
    confirmLabel = "Save",
    required = false
  }) =>
    new Promise((resolve) => {
      setMiniModalRequest({
        mode: "prompt",
        title,
        message,
        inputLabel,
        inputPlaceholder,
        defaultValue,
        confirmLabel,
        required,
        resolve
      });
    });

  const closeMiniModal = (confirmed, value = "") => {
    if (miniModalRequest?.resolve) {
      if (!confirmed) {
        miniModalRequest.resolve(null);
      } else if (miniModalRequest.mode === "prompt") {
        miniModalRequest.resolve(String(value || ""));
      } else {
        miniModalRequest.resolve(true);
      }
    }
    setMiniModalRequest(null);
  };

  const requestProductCategoryComposer = ({
    seedLabel = "",
    initial = null,
    mode = "create",
    sourceCode = ""
  } = {}) =>
    new Promise((resolve) => {
      productCategoryComposerResolverRef.current = resolve;
      const base = defaultProductCategoryComposer(seedLabel);
      const initialObject = initial && typeof initial === "object" ? initial : {};
      setProductCategoryComposer({
        ...base,
        ...initialObject,
        label:
          normalizeProductCategoryLabel(initialObject.label, initialObject.code || seedLabel) ||
          base.label,
        subcategory: normalizeProductSubcategoryLabel(
          initialObject.subcategory,
          initialObject.subcategory
        ),
        variantHeaderCodes: Array.isArray(initialObject.variantHeaderCodes)
          ? initialObject.variantHeaderCodes.map((code) => toVariantFieldKey(code, "")).filter(Boolean)
          : [],
        selectedVariantHeaderCode: "",
        mode: mode === "edit" ? "edit" : "create",
        sourceCode:
          mode === "edit"
            ? normalizeProductCategoryCode(sourceCode || initialObject.sourceCode || initialObject.code)
            : ""
      });
      setProductCategoryComposerError("");
    });

  const closeProductCategoryComposer = (result = null) => {
    const resolver = productCategoryComposerResolverRef.current;
    productCategoryComposerResolverRef.current = null;
    setProductCategoryComposer(null);
    setProductCategoryComposerError("");
    if (resolver) resolver(result);
  };

  const addProductCategoryComposerHeader = () => {
    setProductCategoryComposer((current) => {
      if (!current) return current;
      const code = toVariantFieldKey(current.selectedVariantHeaderCode, "");
      if (!code) return current;
      if (current.variantHeaderCodes.includes(code)) {
        return { ...current, selectedVariantHeaderCode: "" };
      }
      return {
        ...current,
        variantHeaderCodes: [...current.variantHeaderCodes, code],
        selectedVariantHeaderCode: ""
      };
    });
  };

  const handleCreateProductCategoryComposerHeader = async () => {
    const created = await createVariantHeader("");
    if (!created?.code) return;
    setProductCategoryComposer((current) => {
      if (!current) return current;
      const normalized = toVariantFieldKey(created.code, "");
      if (current.variantHeaderCodes.includes(normalized)) {
        return current;
      }
      return {
        ...current,
        variantHeaderCodes: [...current.variantHeaderCodes, normalized],
        selectedVariantHeaderCode: ""
      };
    });
  };

  const removeProductCategoryComposerHeader = (code) => {
    const normalized = toVariantFieldKey(code, "");
    if (!normalized) return;
    setProductCategoryComposer((current) => {
      if (!current) return current;
      return {
        ...current,
        variantHeaderCodes: current.variantHeaderCodes.filter(
          (entry) => toVariantFieldKey(entry, "") !== normalized
        )
      };
    });
  };

  useEffect(() => {
    if (!productStudioUi.tabs.some((tab) => tab.id === productStudioTab)) {
      setProductStudioTab("studio");
    }
  }, [productStudioTab, productStudioUi.tabs]);

  useEffect(() => {
    return () => {
      if (imageStudioResolverRef.current) {
        imageStudioResolverRef.current(null);
        imageStudioResolverRef.current = null;
      }
      if (productCategoryComposerResolverRef.current) {
        productCategoryComposerResolverRef.current(null);
        productCategoryComposerResolverRef.current = null;
      }
    };
  }, []);

  const hasStorefrontSelection = Boolean(
    normalizeStorefrontSlot(storefrontDraft?.slot || selectedStorefrontSlot)
  );
  const selectedStorefrontPreset = getConfiguredStorefrontSlotPreset(storefrontDraft?.slot || selectedStorefrontSlot);
  const storefrontMode = storefrontSlotModeFor(storefrontDraft?.slot || selectedStorefrontSlot);
  const storefrontStructureZones = useMemo(() => {
    const profileCandidates = storefrontStructure?.mapping_profile?.candidate_zones;
    const zones = Array.isArray(profileCandidates) && profileCandidates.length
      ? profileCandidates.map((candidate) => ({
          tag: candidate?.suggested_slot,
          page: candidate?.page,
          label: candidate?.label || candidate?.suggested_slot,
          renderer_type: candidate?.suggested_renderer,
          occurrences: candidate?.repeated_item_count,
          ...candidate
        }))
      : storefrontStructure?.zones;
    if (!Array.isArray(zones)) return [];
    return zones
      .map((zone) => {
        const rawTag = String(zone?.tag || "").trim();
        if (!rawTag) return null;
        const tag = normalizeStorefrontSlot(rawTag);
        const rawPage = String(zone?.page || "").trim();
        return {
          tag,
          page: rawPage ? normalizeStorefrontSlot(rawPage) : tag.split(".")[0] || "home",
          label: String(zone?.label || "").trim(),
          rendererType: String(zone?.renderer_type || zone?.suggested_renderer || "").trim().toLowerCase(),
          occurrences: Number(zone?.occurrences || zone?.repeated_item_count || 1),
          candidateId: String(zone?.candidate_id || "").trim(),
          selector: String(zone?.selector || "").trim(),
          textSample: String(zone?.text_sample || "").trim(),
          image_count: Number(zone?.image_count || 0),
          link_count: Number(zone?.link_count || 0),
          button_count: Number(zone?.button_count || 0),
          repeated_item_count: Number(zone?.repeated_item_count || 0),
          confidence: Number(zone?.confidence || 0),
          confidenceReasons: Array.isArray(zone?.confidence_reasons) ? zone.confidence_reasons : [],
          mappingStatus: String(zone?.mapping_status || "proposed").trim().toLowerCase(),
          source: String(zone?.source || "").trim(),
          pushAllowed: zone?.push_allowed !== false
        };
      })
      .filter(Boolean);
  }, [storefrontStructure]);
  const storefrontStructureSlotOptions = useMemo(() => {
    return storefrontStructureZones.filter((zone) => zone.mappingStatus === "approved").map((zone) => ({
      value: zone.tag,
      label: `${zone.tag} - ${zone.label || zone.tag}`
    }));
  }, [storefrontStructureZones]);
  const storefrontStructureZoneByTag = useMemo(() => {
    const map = new Map();
    storefrontStructureZones.forEach((zone) => map.set(zone.tag, zone));
    return map;
  }, [storefrontStructureZones]);
  const storefrontConnectionOptions = useMemo(() => {
    const list = Array.isArray(storefrontConnections) ? storefrontConnections : [];
    return list
      .filter((item) => item?.scan_eligible)
      .map((item) => ({
        value: String(item.connection_code || "").trim(),
        label: `${String(item.connection_code || "").trim()} - ${String(item.connection_name || "").trim() || "Connection"}`
      }))
      .filter((item) => item.value);
  }, [storefrontConnections]);
  const selectedStorefrontConnection = useMemo(() => {
    return (Array.isArray(storefrontConnections) ? storefrontConnections : []).find(
      (item) => String(item?.connection_code || "").trim() === selectedStorefrontConnectionCode
    ) || null;
  }, [storefrontConnections, selectedStorefrontConnectionCode]);
  const storefrontScanModeOptions = useMemo(() => {
    const allowed = Array.isArray(selectedStorefrontConnection?.allowed_scan_modes)
      ? new Set(selectedStorefrontConnection.allowed_scan_modes)
      : null;
    return storefrontMappingUi.scanModes.filter((item) => !allowed || allowed.has(item.value));
  }, [selectedStorefrontConnection, storefrontMappingUi.scanModes]);
  const storefrontEligibleConnectionCount = useMemo(
    () => storefrontConnectionOptions.length,
    [storefrontConnectionOptions]
  );
  useEffect(() => {
    if (!storefrontScanModeOptions.length) return;
    if (storefrontScanModeOptions.some((item) => item.value === storefrontScanMode)) return;
    setStorefrontScanMode(storefrontScanModeOptions[0].value);
  }, [storefrontScanMode, storefrontScanModeOptions]);
  const storefrontCategoryByCode = useMemo(() => {
    const map = new Map();
    (Array.isArray(storefrontCategories) ? storefrontCategories : []).forEach((item) => {
      const code = normalizeStorefrontCategoryCode(item?.code || "");
      if (!code) return;
      map.set(code, String(item?.label || code).trim() || code);
    });
    return map;
  }, [storefrontCategories]);
  const selectedCategoryTabCode = useMemo(() => {
    const raw = String(contentStudioTab || "");
    if (!raw.startsWith("cat:")) return "";
    return normalizeStorefrontCategoryCode(raw.slice(4));
  }, [contentStudioTab]);
  const storefrontCategoryOptions = useMemo(() => {
    const items = Array.isArray(storefrontCategories) ? storefrontCategories : [];
    const system = (Array.isArray(storefrontStudioTabs) ? storefrontStudioTabs : [])
      .map((item) => ({
        value: normalizeStorefrontCategoryCode(item?.code || ""),
        label: String(item?.label || item?.code || "").trim()
      }))
      .filter((item) => item.value && item.label);
    const deduped = new Map();
    items.forEach((item) => {
      const code = normalizeStorefrontCategoryCode(item?.code || "");
      if (!code) return;
      deduped.set(code, String(item?.label || item?.code || "").trim() || code);
    });
    system.forEach((item) => {
      if (!deduped.has(item.value)) {
        deduped.set(item.value, item.label);
      }
    });
    return [
      { value: "", label: "Uncategorized" },
      ...Array.from(deduped.entries()).map(([value, label]) => ({ value, label })),
      { value: CATEGORY_CREATE_OPTION, label: "+ Create category..." }
    ].filter((item) => item.value || item.label);
  }, [storefrontCategories, storefrontStudioTabs]);
  const storefrontCategoryTabs = useMemo(() => {
    const items = Array.isArray(storefrontCategories) ? storefrontCategories : [];
    return items
      .map((item) => {
        const code = normalizeStorefrontCategoryCode(item?.code || "");
        if (!code) return null;
        const label = String(item?.label || code).trim() || code;
        return {
          id: `cat:${code}`,
          label,
          icon: CircleDot
        };
      })
      .filter(Boolean);
  }, [storefrontCategories]);
  const contentStudioTabs = useMemo(() => {
    const systemTabs = (Array.isArray(storefrontStudioTabs) ? storefrontStudioTabs : [])
      .map((item) => {
        const mode = String(item?.tab_mode || "").trim().toLowerCase();
        if (!mode) return null;
        return {
          id: mode,
          label: String(item?.label || mode).trim() || mode,
          icon: iconForStudioTabMode(mode)
        };
      })
      .filter(Boolean);
    if (!systemTabs.length) {
      return [
        { id: "blocks", label: "Storefront blocks", icon: LayoutTemplate },
        ...storefrontCategoryTabs,
        { id: "blog", label: "Blog posts", icon: MessageSquare },
        { id: "pages", label: "Page articles", icon: FileText }
      ];
    }

    const tabs = [];
    let insertedCategories = false;
    systemTabs.forEach((tab) => {
      tabs.push(tab);
      if (!insertedCategories && tab.id === "blocks") {
        tabs.push(...storefrontCategoryTabs);
        insertedCategories = true;
      }
    });
    if (!insertedCategories) tabs.unshift(...storefrontCategoryTabs);
    return tabs;
  }, [storefrontStudioTabs, storefrontCategoryTabs]);
  const storefrontAllSlotOptions = useMemo(() => {
    const map = new Map();
    storefrontStructureSlotOptions.forEach((option) => map.set(option.value, option.label));
    storefrontItems.forEach((item) => {
      const slot = normalizeStorefrontSlot(item?.slot || "");
      if (!slot) return;
      if (!map.has(slot)) map.set(slot, `${slot} - Existing`);
    });
    if (!map.size) {
      storefrontMappingUi.slotPresets.forEach((preset) => {
        map.set(preset.slot, `${preset.slot} - ${preset.title}`);
      });
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [storefrontStructureSlotOptions, storefrontItems, storefrontMappingUi.slotPresets]);
  const storefrontItemsBySlot = useMemo(() => {
    const map = new Map();
    [...storefrontItems, ...pageContentItems].forEach((item) => {
      const slot = normalizeStorefrontSlot(item?.slot || "");
      if (!slot) return;
      if (!map.has(slot)) map.set(slot, []);
      map.get(slot).push(item);
    });
    return map;
  }, [storefrontItems, pageContentItems]);
  const storefrontStructureMappingRows = useMemo(() => {
    return storefrontStructureZones.map((zone) => {
      const mappedItems = storefrontItemsBySlot.get(zone.tag) || [];
      return {
        ...zone,
        mappedCount: mappedItems.length,
        primaryItem: mappedItems[0] || null
      };
    });
  }, [storefrontStructureZones, storefrontItemsBySlot]);
  const defaultStorefrontSlot = storefrontAllSlotOptions[0]?.value || "home.hero";
  const pageContentStage = String(
    pageContentDraft?.attrs?.workflow?.stage ||
      pageContentDraft?.status ||
      ""
  ).toLowerCase();
  const pageContentStageBadge = STAGE_BADGES[pageContentStage] || {
    label: pageContentStage ? pageContentStage : "Draft",
    icon: CalendarClock,
    className: "bg-slate-100 text-slate-600"
  };
  const PageContentStageIcon = pageContentStageBadge.icon || CalendarClock;
  const pageArticleSlotOptions = useMemo(() => {
    const options = storefrontStructureSlotOptions.filter((option) => option.value.startsWith("pages."));
    if (options.length) return options;
    return storefrontMappingUi.slotPresets.filter((item) => item.page === "pages").map((item) => ({
      value: item.slot,
      label: item.title
    }));
  }, [storefrontStructureSlotOptions, storefrontMappingUi.slotPresets]);
  const mainAsset = useMemo(
    () =>
      normalizeAsset(
        draft?.attrs?.media?.main_asset ||
          draft?.attrs?.media?.main_url ||
          draft?.attrs?.media?.hero_asset ||
          draft?.attrs?.media?.hero_url
      ),
    [draft]
  );
  const uploadedGallery = useMemo(
    () => normalizeAssetList(draft?.attrs?.media?.gallery_assets),
    [draft]
  );
  const urlGallery = useMemo(
    () => normalizeAssetList(draft?.attrs?.media?.gallery),
    [draft]
  );
  const filteredUrlGallery = useMemo(() => {
    const seen = new Set(uploadedGallery.map((asset) => asset?.url).filter(Boolean));
    return urlGallery.filter((asset) => asset?.url && !seen.has(asset.url));
  }, [uploadedGallery, urlGallery]);
  const galleryAssets = useMemo(
    () => [...uploadedGallery, ...urlGallery],
    [uploadedGallery, urlGallery]
  );
  const uploadedDocuments = useMemo(
    () => normalizeAssetList(draft?.attrs?.media?.document_assets),
    [draft]
  );
  const urlDocuments = useMemo(
    () => normalizeAssetList(draft?.attrs?.media?.documents),
    [draft]
  );
  const filteredUrlDocuments = useMemo(() => {
    const seen = new Set(uploadedDocuments.map((asset) => asset?.url).filter(Boolean));
    return urlDocuments.filter((asset) => asset?.url && !seen.has(asset.url));
  }, [uploadedDocuments, urlDocuments]);
  const documentAssets = useMemo(
    () => [...uploadedDocuments, ...filteredUrlDocuments],
    [uploadedDocuments, filteredUrlDocuments]
  );

  const pricingTiers = useMemo(() => {
    const tiers = draft?.attrs?.pricing?.tiers;
    return Array.isArray(tiers) ? tiers : [];
  }, [draft]);
  const draftBaseItemCode = String(draft?.attrs?.inventory?.sku || draft?.code || "")
    .trim()
    .toUpperCase();
  const draftVariants = useMemo(
    () => normalizeProductVariants(draft?.attrs?.variants),
    [draft?.attrs?.variants]
  );
  const selectedProductCategoryCode = useMemo(
    () =>
      normalizeProductCategoryCode(
        draft?.attrs?.taxonomy?.category_code || draft?.attrs?.taxonomy?.category || ""
      ),
    [draft?.attrs?.taxonomy?.category_code, draft?.attrs?.taxonomy?.category]
  );
  const selectedProductCategory = useMemo(
    () =>
      (Array.isArray(productCategoryCatalog) ? productCategoryCatalog : []).find(
        (item) => normalizeProductCategoryCode(item?.code || "") === selectedProductCategoryCode
      ) || null,
    [productCategoryCatalog, selectedProductCategoryCode]
  );
  const selectedProductSubcategoryCode = useMemo(
    () =>
      normalizeProductSubcategoryCode(
        draft?.attrs?.taxonomy?.subcategory_code || draft?.attrs?.taxonomy?.subcategory || ""
      ),
    [draft?.attrs?.taxonomy?.subcategory_code, draft?.attrs?.taxonomy?.subcategory]
  );
  const productCategoryOptions = useMemo(() => {
    const base = [{ value: "", label: "Select category" }];
    (Array.isArray(productCategoryCatalog) ? productCategoryCatalog : [])
      .filter((item) => item?.is_active !== false)
      .forEach((item) => {
        const code = normalizeProductCategoryCode(item?.code || "");
        if (!code) return;
        base.push({
          value: code,
          label: String(item?.label || code).trim()
        });
      });
    base.push({ value: CATEGORY_CREATE_OPTION, label: "+ Create category..." });
    return base;
  }, [productCategoryCatalog]);
  const variantFieldHeaders = useMemo(
    () => (Array.isArray(draftVariants.headers) ? draftVariants.headers : []),
    [draftVariants.headers]
  );
  const variantHeaderCatalogOptions = useMemo(
    () =>
      (Array.isArray(variantHeaderCatalog) ? variantHeaderCatalog : [])
        .filter((entry) => entry?.is_active !== false)
        .map((entry) => ({
          code: toVariantFieldKey(entry?.code || entry?.key, "option"),
          label: String(entry?.label || entry?.code || "").trim()
        }))
        .filter((entry) => entry.code && entry.label),
    [variantHeaderCatalog]
  );
  const productCategoryComposerHeaderOptions = useMemo(() => {
    const selected = new Set(
      Array.isArray(productCategoryComposer?.variantHeaderCodes)
        ? productCategoryComposer.variantHeaderCodes.map((code) => toVariantFieldKey(code, ""))
        : []
    );
    return variantHeaderCatalogOptions.filter((entry) => !selected.has(entry.code));
  }, [productCategoryComposer?.variantHeaderCodes, variantHeaderCatalogOptions]);
  const productCategoryComposerSelectedHeaders = useMemo(() => {
    const selected = Array.isArray(productCategoryComposer?.variantHeaderCodes)
      ? productCategoryComposer.variantHeaderCodes
      : [];
    const index = new Map(
      variantHeaderCatalogOptions.map((entry) => [toVariantFieldKey(entry.code, ""), entry])
    );
    return selected
      .map((code) => {
        const key = toVariantFieldKey(code, "");
        const entry = index.get(key);
        if (!entry) return null;
        return { code: key, label: entry.label };
      })
      .filter(Boolean);
  }, [productCategoryComposer?.variantHeaderCodes, variantHeaderCatalogOptions]);
  const categoryVariantHeaderOptions = useMemo(
    () =>
      (Array.isArray(selectedProductCategory?.variant_headers)
        ? selectedProductCategory.variant_headers
        : []
      )
        .filter((entry) => entry?.is_active !== false)
        .map((entry) => ({
          code: toVariantFieldKey(entry?.code || entry?.key, "option"),
          label: String(entry?.label || entry?.code || "").trim()
        }))
        .filter((entry) => entry.code && entry.label),
    [selectedProductCategory]
  );
  const variantInventoryColumns = useMemo(
    () => [
      variantFieldHeaders[0] || { key: "", label: "Option 1" },
      variantFieldHeaders[1] || { key: "", label: "Option 2" }
    ],
    [variantFieldHeaders]
  );
  const draftVariantSummary = useMemo(
    () => summarizeProductVariants(draftVariants),
    [draftVariants]
  );
  const variantInventoryTotals = useMemo(
    () => computeVariantInventoryTotals(draftVariants),
    [draftVariants]
  );
  const variantInventoryRows = useMemo(() => {
    const needle = String(variantInventoryQuery || "").trim().toLowerCase();
    const fieldKeys = variantFieldHeaders.map((field) => field.key).filter(Boolean);
    const rows = draftVariants.items.map((item, index) => {
      const parsedQty = Number(item.stock_qty);
      const stock = Number.isFinite(parsedQty) ? parsedQty : 0;
      const values = fieldKeys.map((key) => String(item?.[key] || "").trim());
      const label = values.filter(Boolean).slice(0, 2).join(" / ") || `Variant ${index + 1}`;
      return {
        index: index + 1,
        id: item.id,
        label,
        optionA: variantInventoryColumns[0]?.key
          ? String(item?.[variantInventoryColumns[0].key] || "—").trim() || "—"
          : "—",
        optionB: variantInventoryColumns[1]?.key
          ? String(item?.[variantInventoryColumns[1].key] || "—").trim() || "—"
          : "—",
        stock,
        active: item.active !== false
      };
    });
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.label, row.optionA, row.optionB].some((value) =>
        String(value || "").toLowerCase().includes(needle)
      )
    );
  }, [draftVariants.items, variantFieldHeaders, variantInventoryColumns, variantInventoryQuery]);
  const variantInventoryTotalPages = Math.max(
    1,
    Math.ceil(variantInventoryRows.length / Math.max(1, Number(variantInventoryPageSize) || 1))
  );
  const variantInventoryPageSafe = Math.min(
    variantInventoryTotalPages,
    Math.max(1, Number(variantInventoryPage) || 1)
  );
  const variantInventoryPageNumbers = useMemo(
    () => buildPageNumbers(variantInventoryPageSafe, variantInventoryTotalPages),
    [variantInventoryPageSafe, variantInventoryTotalPages]
  );
  const pagedVariantInventoryRows = useMemo(() => {
    const size = Math.max(1, Number(variantInventoryPageSize) || 1);
    const start = (variantInventoryPageSafe - 1) * size;
    return variantInventoryRows.slice(start, start + size);
  }, [variantInventoryRows, variantInventoryPageSafe, variantInventoryPageSize]);

  const masterCheckboxRef = useRef(null);

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((item) => {
      const title = String(item.title || "").toLowerCase();
      const code = String(item.code || "").toLowerCase();
      const sku = String(item.attrs?.inventory?.sku || "").toLowerCase();
      const category = String(item.attrs?.taxonomy?.category || "").toLowerCase();
      const subcategory = String(item.attrs?.taxonomy?.subcategory || "").toLowerCase();
      const tags = Array.isArray(item.attrs?.taxonomy?.tags)
        ? item.attrs.taxonomy.tags.map((tag) => String(tag || "").toLowerCase())
        : [];
      return (
        title.includes(needle) ||
        code.includes(needle) ||
        sku.includes(needle) ||
        category.includes(needle) ||
        subcategory.includes(needle) ||
        tags.some((tag) => tag.includes(needle))
      );
    });
  }, [products, query]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const pagedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page, pageSize]);

  const allVisibleSelected =
    pagedProducts.length > 0 && pagedProducts.every((item) => selectedIds.has(item.id));
  const someVisibleSelected = pagedProducts.some((item) => selectedIds.has(item.id));

  const pageNumbers = useMemo(() => buildPageNumbers(page, totalPages), [page, totalPages]);
  const storefrontTotalPages = Math.max(1, Math.ceil(storefrontTotal / storefrontPageSize));
  const storefrontPageNumbers = useMemo(
    () => buildPageNumbers(storefrontPage, storefrontTotalPages),
    [storefrontPage, storefrontTotalPages]
  );
  const storefrontBlogTotalPages = Math.max(1, Math.ceil(storefrontBlogTotal / storefrontBlogPageSize));
  const storefrontBlogPageNumbers = useMemo(
    () => buildPageNumbers(storefrontBlogPage, storefrontBlogTotalPages),
    [storefrontBlogPage, storefrontBlogTotalPages]
  );
  const pageContentTotalPages = Math.max(1, Math.ceil(pageContentTotal / pageContentPageSize));
  const pageContentPageNumbers = useMemo(
    () => buildPageNumbers(pageContentPage, pageContentTotalPages),
    [pageContentPage, pageContentTotalPages]
  );

  const loadVariantHeaderCatalog = async () => {
    setVariantHeaderCatalogLoading(true);
    try {
      const data = await apiFetch("/api/eip/ecom/variant-headers");
      const items = Array.isArray(data?.items) ? data.items : [];
      setVariantHeaderCatalog(
        items
          .map((item) => ({
            code: toVariantFieldKey(item?.code || item?.key, "option"),
            label: String(item?.label || item?.code || "").trim(),
            is_active: item?.is_active !== false,
            sort_order: Number(item?.sort_order || 0)
          }))
          .filter((item) => item.code && item.label)
      );
      return items;
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to load variant header catalog."));
      setVariantHeaderCatalog([]);
      return [];
    } finally {
      setVariantHeaderCatalogLoading(false);
    }
  };

  const createVariantHeader = async (seedLabel = "") => {
    const input = await requestPrompt({
      title: "Create variant header",
      message: "Enter a new variant field label.",
      inputLabel: "Header label",
      inputPlaceholder: "Size, Width, Color...",
      defaultValue: String(seedLabel || "").trim(),
      confirmLabel: "Create",
      required: true
    });
    const label = String(input || "").trim();
    const code = toVariantFieldKey(label, "");
    if (!label || !code) return null;
    const existing = variantHeaderCatalogOptions.find((entry) => entry.code === code);
    if (existing) return existing;

    setVariantHeaderCatalogLoading(true);
    setStatusMessage("");
    try {
      const data = await apiFetch("/api/eip/ecom/variant-headers", {
        method: "POST",
        body: { code, label }
      });
      const items = Array.isArray(data?.items) ? data.items : [];
      setVariantHeaderCatalog(
        items
          .map((item) => ({
            code: toVariantFieldKey(item?.code || item?.key, "option"),
            label: String(item?.label || item?.code || "").trim(),
            is_active: item?.is_active !== false,
            sort_order: Number(item?.sort_order || 0)
          }))
          .filter((item) => item.code && item.label)
      );
      setStatusTone("success");
      setStatusMessage(`Variant header ${label} created.`);
      return {
        code,
        label
      };
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to create variant header."));
      return null;
    } finally {
      setVariantHeaderCatalogLoading(false);
    }
  };

  const loadProductCategoryCatalog = async () => {
    setProductCategoryCatalogLoading(true);
    try {
      const data = await apiFetch("/api/eip/ecom/product/categories");
      const items = normalizeProductCategoryCatalog(data?.items || []);
      setProductCategoryCatalog(items);
      return items;
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to load product categories."));
      setProductCategoryCatalog([]);
      return [];
    } finally {
      setProductCategoryCatalogLoading(false);
    }
  };

  const loadTranslationServiceStatus = async () => {
    try {
      const data = await apiFetch("/api/eip/ecom/translation/status");
      const available = data?.available === true;
      const backendMessage = String(data?.message || "").trim();
      const messageBase = backendMessage || (available ? "Translation service connected." : "Translation service offline.");
      const message =
        !available && data?.code
          ? `${messageBase} (${String(data.code).trim()})`
          : messageBase;
      setTranslationService({
        checked: true,
        available,
        state: available ? "connected" : "offline",
        message
      });
      return available;
    } catch {
      setTranslationService({
        checked: true,
        available: false,
        state: "offline",
        message: "Translation service offline."
      });
      return false;
    }
  };

  const upsertProductCategory = async (payload, options = {}) => {
    const method = options.method || "POST";
    const code = normalizeProductCategoryCode(options.code || payload?.code || "");
    const url =
      method === "PUT" && code
        ? `/api/eip/ecom/product/categories/${encodeURIComponent(code)}`
        : "/api/eip/ecom/product/categories";
    setProductCategorySaveLoading(true);
    setStatusMessage("");
    try {
      const data = await apiFetch(url, { method, body: payload });
      const items = normalizeProductCategoryCatalog(data?.items || []);
      if (items.length) setProductCategoryCatalog(items);
      setStatusTone("success");
      setStatusMessage("Category catalog updated.");
      return {
        ok: true,
        item: data?.item || null,
        items
      };
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to save product category."));
      return { ok: false, item: null, items: [] };
    } finally {
      setProductCategorySaveLoading(false);
    }
  };

  const createProductCategory = async (seedLabel = "") => {
    const fallback = String(seedLabel || "").trim();
    if (!variantHeaderCatalogOptions.length && !variantHeaderCatalogLoading) {
      void loadVariantHeaderCatalog();
    }
    const payload = await requestProductCategoryComposer({ seedLabel: fallback });
    if (!payload) return null;
    const label = normalizeProductCategoryLabel(payload.label, payload.label);
    const code = normalizeProductCategoryCode(payload.code || label);
    if (!code || !label) return null;
    const existing = (Array.isArray(productCategoryCatalog) ? productCategoryCatalog : []).find(
      (item) => normalizeProductCategoryCode(item?.code || "") === code
    );
    if (existing) {
      setStatusTone("success");
      setStatusMessage(`Category ${existing.label} already exists.`);
      return existing;
    }
    const subcategoryLabel = normalizeProductSubcategoryLabel(
      payload.subcategory || "",
      payload.subcategory || ""
    );
    const subcategories = subcategoryLabel
      ? normalizeProductSubcategories([
          {
            code: normalizeProductSubcategoryCode(subcategoryLabel),
            label: subcategoryLabel,
            sort_order: 10,
            is_active: true
          }
        ])
      : [];
    const headerIndex = new Map(
      variantHeaderCatalogOptions.map((entry) => [toVariantFieldKey(entry.code, ""), entry.label])
    );
    const variant_headers = normalizeCategoryVariantHeaders(
      (Array.isArray(payload.variantHeaderCodes) ? payload.variantHeaderCodes : []).map((codeValue) => {
        const codeKey = toVariantFieldKey(codeValue, "");
        return {
          code: codeKey,
          label: headerIndex.get(codeKey) || toVariantFieldLabel(codeKey)
        };
      })
    );
    const result = await upsertProductCategory({
      code,
      label,
      subcategories,
      variant_headers
    });
    if (!result.ok) return null;
    const next = (result.items || []).find((item) => normalizeProductCategoryCode(item?.code) === code);
    return next || null;
  };

  const editProductCategory = async (category) => {
    const selected = category && typeof category === "object" ? category : null;
    if (!selected?.code) return null;
    if (!variantHeaderCatalogOptions.length && !variantHeaderCatalogLoading) {
      void loadVariantHeaderCatalog();
    }
    const activeSubcategory = (Array.isArray(selected.subcategories) ? selected.subcategories : []).find(
      (entry) => entry?.is_active !== false
    );
    const payload = await requestProductCategoryComposer({
      mode: "edit",
      sourceCode: selected.code,
      initial: {
        code: selected.code,
        label: selected.label,
        subcategory: activeSubcategory?.label || "",
        variantHeaderCodes: Array.isArray(selected.variant_headers)
          ? selected.variant_headers.map((entry) => entry?.code || entry?.key)
          : []
      }
    });
    if (!payload) return null;
    const subcategoryLabel = normalizeProductSubcategoryLabel(
      payload.subcategory || "",
      payload.subcategory || ""
    );
    if (!subcategoryLabel) return null;
    const headerIndex = new Map(
      variantHeaderCatalogOptions.map((entry) => [toVariantFieldKey(entry.code, ""), entry.label])
    );
    const result = await upsertProductCategory(
      {
        code: selected.code,
        label: normalizeProductCategoryLabel(payload.label, selected.code),
        sort_order: Number(selected.sort_order || 10) || 10,
        is_active: selected.is_active !== false,
        subcategories: [
          {
            code: normalizeProductSubcategoryCode(subcategoryLabel),
            label: subcategoryLabel,
            sort_order: 10,
            is_active: true
          }
        ],
        variant_headers: normalizeCategoryVariantHeaders(
          (Array.isArray(payload.variantHeaderCodes) ? payload.variantHeaderCodes : []).map((codeValue) => {
            const key = toVariantFieldKey(codeValue, "");
            return {
              code: key,
              label: headerIndex.get(key) || toVariantFieldLabel(key)
            };
          })
        )
      },
      { method: "PUT", code: selected.code }
    );
    if (!result.ok) return null;
    const refreshed = (result.items || []).find(
      (entry) => normalizeProductCategoryCode(entry?.code || "") === normalizeProductCategoryCode(selected.code)
    );
    if (refreshed?.code) {
      applyProductCategorySelection(refreshed.code);
    }
    return refreshed || null;
  };

  const submitProductCategoryComposer = async () => {
    if (!productCategoryComposer) return;
    const mode = productCategoryComposer.mode === "edit" ? "edit" : "create";
    const label = normalizeProductCategoryLabel(
      productCategoryComposer.label,
      productCategoryComposer.label
    );
    const code =
      mode === "edit"
        ? normalizeProductCategoryCode(productCategoryComposer.sourceCode)
        : normalizeProductCategoryCode(productCategoryComposer.label);
    if (!label || !code) {
      setProductCategoryComposerError("Category name is required.");
      return;
    }
    const subcategory = normalizeProductSubcategoryLabel(
      productCategoryComposer.subcategory,
      productCategoryComposer.subcategory
    );
    if (!subcategory) {
      setProductCategoryComposerError("Subcategory is required.");
      return;
    }
    closeProductCategoryComposer({
      mode,
      code,
      label,
      subcategory,
      variantHeaderCodes: Array.isArray(productCategoryComposer.variantHeaderCodes)
        ? productCategoryComposer.variantHeaderCodes
        : []
    });
  };

  const refreshList = async () => {
    setLoadingList(true);
    setListError("");
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "200");
      const data = await apiFetch(`/api/eip/ecom/products?${qs.toString()}`);
      setProducts(data.items || []);
      if (!selectedId && data.items?.length) {
        setSelectedId(data.items[0].id);
      }
    } catch (err) {
      setListError(formatApiError(err, "Failed to load products."));
    } finally {
      setLoadingList(false);
    }
  };

  const loadDetail = async (id) => {
    if (!id) return;
    setDetailLoading(true);
    setStatusMessage("");
    try {
      const data = await apiFetch(`/api/eip/ecom/products/${id}`);
      setDraft(hydrateDraft(data.item));
      if (data.item?.code) {
        await loadReviews(data.item.code, reviewStatusFilter);
      } else {
        setReviewItems([]);
      }
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to load product."));
    } finally {
      setDetailLoading(false);
    }
  };

  const loadReviews = async (productCode, status = reviewStatusFilter) => {
    if (!productCode) {
      setReviewItems([]);
      return;
    }
    setReviewsLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("product_code", productCode);
      qs.set("status", status || "pending_review");
      qs.set("limit", "100");
      const data = await apiFetch(`/api/eip/ecom/reviews?${qs.toString()}`);
      setReviewItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to load reviews."));
      setReviewItems([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const moderateReview = async (reviewId, nextStatus) => {
    if (!reviewId || !nextStatus) return;
    setReviewActionLoadingId(reviewId);
    setStatusMessage("");
    try {
      await apiFetch(`/api/eip/ecom/reviews/${reviewId}`, {
        method: "PATCH",
        body: { status: nextStatus }
      });
      setStatusTone("success");
      setStatusMessage(`Review ${nextStatus}.`);
      await loadReviews(draft?.code, reviewStatusFilter);
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Review moderation failed."));
    } finally {
      setReviewActionLoadingId("");
    }
  };

  const loadStorefrontContent = async (slotValue = selectedStorefrontSlot) => {
    setStorefrontLoading(true);
    try {
      const normalizedSlot = normalizeStorefrontSlot(slotValue);
      const qs = new URLSearchParams();
      qs.set("slot", normalizedSlot);
      const data = await apiFetch(`/api/eip/ecom/storefront/content?${qs.toString()}`);
      setStorefrontDraft(
        data?.item ? normalizeStorefrontDraft(data.item) : defaultStorefrontDraft(normalizedSlot)
      );
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to load storefront content."));
      setStorefrontDraft(defaultStorefrontDraft(normalizeStorefrontSlot(slotValue)));
    } finally {
      setStorefrontLoading(false);
    }
  };

  const loadStorefrontStructure = async () => {
    setStorefrontStructureLoading(true);
    try {
      const data = await apiFetch("/api/eip/ecom/storefront/structure");
      const item = data?.item || null;
      setStorefrontStructure(item);
      const savedCode = String(item?.connection_code || "").trim();
      if (savedCode) setSelectedStorefrontConnectionCode(savedCode);
      return data?.item || null;
    } catch (err) {
      setStorefrontStructure(null);
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to load structure map."));
      return null;
    } finally {
      setStorefrontStructureLoading(false);
    }
  };

  const loadStorefrontConnections = async () => {
    setStorefrontConnectionsLoading(true);
    try {
      const data = await apiFetch("/api/eip/ecom/storefront/structure/connections");
      const items = Array.isArray(data?.items) ? data.items : [];
      setStorefrontConnections(items);
      const selectedCode = String(data?.selected_connection_code || "").trim();
      setSelectedStorefrontConnectionCode((prev) => {
        if (prev && items.some((item) => String(item?.connection_code || "").trim() === prev)) {
          return prev;
        }
        return selectedCode;
      });
      return items;
    } catch (err) {
      setStorefrontConnections([]);
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to load connection list."));
      return [];
    } finally {
      setStorefrontConnectionsLoading(false);
    }
  };

  const loadStorefrontStudioTabs = async () => {
    setStorefrontStudioTabsLoading(true);
    try {
      const data = await apiFetch("/api/eip/ecom/storefront/content/studio-tabs");
      const items = Array.isArray(data?.items) ? data.items : [];
      const normalized = items
        .map((item) => ({
          code: normalizeStorefrontCategoryCode(item?.code || ""),
          label: String(item?.label || item?.code || "").trim(),
          tab_mode: String(item?.tab_mode || "").trim().toLowerCase()
        }))
        .filter((item) => item.tab_mode);
      setStorefrontStudioTabs(normalized);
      return normalized;
    } catch (err) {
      setStorefrontStudioTabs([]);
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to load studio tabs."));
      return [];
    } finally {
      setStorefrontStudioTabsLoading(false);
    }
  };

  const openStorefrontStudioTabsModal = () => {
    const rows = (Array.isArray(storefrontStudioTabs) ? storefrontStudioTabs : [])
      .map((item) => ({
        code: normalizeStorefrontCategoryCode(item?.code || ""),
        tab_mode: String(item?.tab_mode || "").trim().toLowerCase(),
        label: String(item?.label || item?.code || "").trim()
      }))
      .filter((item) => item.code && item.tab_mode);
    setStorefrontStudioTabEditorRows(rows);
    setShowStorefrontStudioTabsModal(true);
  };

  const moveStorefrontStudioTabEditorRow = (index, direction) => {
    setStorefrontStudioTabEditorRows((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row);
      return next;
    });
  };

  const saveStorefrontStudioTabs = async () => {
    const rows = Array.isArray(storefrontStudioTabEditorRows) ? storefrontStudioTabEditorRows : [];
    if (!rows.length) {
      setShowStorefrontStudioTabsModal(false);
      return;
    }
    setStorefrontStudioTabsSaving(true);
    setStatusMessage("");
    try {
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const code = normalizeStorefrontCategoryCode(row.code || "");
        const label = String(row.label || "").trim();
        if (!code || !label) {
          throw new Error("TAB_LABEL_REQUIRED");
        }
        // eslint-disable-next-line no-await-in-loop
        await apiFetch(`/api/eip/ecom/storefront/content/studio-tabs/${encodeURIComponent(code)}`, {
          method: "PUT",
          body: {
            label,
            sort_order: (i + 1) * 10
          }
        });
      }
      await loadStorefrontStudioTabs();
      setShowStorefrontStudioTabsModal(false);
      setStatusTone("success");
      setStatusMessage("Studio tabs updated.");
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to update studio tabs."));
    } finally {
      setStorefrontStudioTabsSaving(false);
    }
  };

  const loadStorefrontCategories = async () => {
    setStorefrontCategoriesLoading(true);
    try {
      const data = await apiFetch("/api/eip/ecom/storefront/content/categories");
      const items = Array.isArray(data?.items) ? data.items : [];
      setStorefrontCategories(
        items
          .map((item) => ({
            code: normalizeStorefrontCategoryCode(item?.code || ""),
            label: String(item?.label || item?.code || "").trim()
          }))
          .filter((item) => item.code)
      );
      return items;
    } catch (err) {
      setStorefrontCategories([]);
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to load content categories."));
      return [];
    } finally {
      setStorefrontCategoriesLoading(false);
    }
  };

  const createStorefrontCategory = async (seedLabel = "") => {
    const fallback = String(seedLabel || "").trim();
    const input = await requestPrompt({
      title: "Create content category",
      message: "Enter a new content category name.",
      inputLabel: "Category name",
      inputPlaceholder: "Category",
      defaultValue: fallback,
      confirmLabel: "Create",
      required: true
    });
    const label = String(input || "").trim();
    if (!label) return "";
    const payload = { label, code: normalizeStorefrontCategoryCode(label) };
    try {
      const data = await apiFetch("/api/eip/ecom/storefront/content/categories", {
        method: "POST",
        body: payload
      });
      const item = data?.item || null;
      const code = normalizeStorefrontCategoryCode(item?.code || payload.code);
      const items = Array.isArray(data?.items) ? data.items : [];
      if (items.length) {
        setStorefrontCategories(
          items
            .map((entry) => ({
              code: normalizeStorefrontCategoryCode(entry?.code || ""),
              label: String(entry?.label || entry?.code || "").trim()
            }))
            .filter((entry) => entry.code)
        );
      } else if (code) {
        setStorefrontCategories((prev) => {
          const next = [...prev];
          if (!next.some((entry) => entry.code === code)) {
            next.push({ code, label: String(item?.label || label || code) });
          }
          return next;
        });
      }
      setStatusTone("success");
      setStatusMessage(`Category "${String(item?.label || label)}" saved.`);
      return code;
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to create category."));
      return "";
    }
  };

  const scanStorefrontStructure = async () => {
    setStorefrontStructureScanning(true);
    setStatusMessage("");
    try {
      const connectionCode = String(selectedStorefrontConnectionCode || "").trim();
      const data = await apiFetch("/api/eip/ecom/storefront/structure/scan", {
        method: "POST",
        body: {
          ...(connectionCode ? { connection_code: connectionCode } : {}),
          scan_mode: storefrontScanMode
        }
      });
      const item = data?.item || null;
      setStorefrontStructure(item);
      const usedCode = String(data?.connection?.connection_code || item?.connection_code || "").trim();
      if (usedCode) setSelectedStorefrontConnectionCode(usedCode);
      const firstApproved = item?.mapping_profile?.approved_mappings?.[0];
      const firstTag = normalizeStorefrontSlot(firstApproved?.suggested_slot || item?.zones?.[0]?.tag || "");
      if (firstTag) {
        setSelectedStorefrontSlot(firstTag);
        setStorefrontDraft((prev) => ({ ...prev, slot: firstTag }));
      }
      const usableCount = Number(item?.usable_candidate_count || 0);
      if (data?.requires_manual_review) {
        setStatusTone("error");
        setStatusMessage(
          data?.fallback_recommendation === "configure_rendered_dom_scanner"
            ? "This storefront is a client-rendered shell. Configure Chromium on the API and run Rendered DOM scan."
            : data?.fallback_recommendation === "review_low_confidence_rendered_dom"
              ? "Rendered DOM scan found only low-confidence zones. Review the proposed mappings before use."
              : "Structure scan found only low-confidence zones. Review the proposed mappings before use."
        );
      } else {
        setStatusTone("success");
        setStatusMessage(
          `Structure scanned (${usableCount} usable zones) on ${usedCode || "default connection"}.`
        );
      }
      return item;
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Structure scan failed."));
      return null;
    } finally {
      setStorefrontStructureScanning(false);
    }
  };

  const updateStorefrontMapping = async (row, mappingStatus, edits = {}) => {
    const candidateId = String(row?.candidateId || "").trim();
    if (!candidateId) return;
    setStorefrontMappingSavingId(candidateId);
    setStatusMessage("");
    try {
      const data = await apiFetch(`/api/eip/ecom/storefront/structure/mappings/${encodeURIComponent(candidateId)}`, {
        method: "PUT",
        body: {
          mapping_status: mappingStatus,
          suggested_slot: normalizeStorefrontSlot(edits.suggested_slot || row.tag),
          suggested_renderer: String(edits.suggested_renderer || row.rendererType || "rich_text_block").trim(),
          selector: String(edits.selector || row.selector || "").trim()
        }
      });
      setStorefrontStructure(data?.item || null);
      setStatusTone("success");
      setStatusMessage(`Mapping ${mappingStatus}.`);
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to update mapping."));
    } finally {
      setStorefrontMappingSavingId("");
    }
  };

  const editStorefrontMapping = async (row) => {
    const suggestedSlot = await requestPrompt({
      title: storefrontMappingUi.editSlotTitle || "Edit mapped slot",
      message: storefrontMappingUi.editSlotMessage || "Choose the governed content slot for this detected website zone.",
      inputLabel: storefrontMappingUi.slotCodeLabel || "Slot code",
      defaultValue: row?.tag || "",
      confirmLabel: storefrontMappingUi.continueLabel || "Continue",
      required: true
    });
    if (!suggestedSlot) return;
    const renderer = await requestPrompt({
      title: storefrontMappingUi.editRendererTitle || "Edit renderer",
      message:
        storefrontMappingUi.editRendererMessage ||
        `Choose a renderer descriptor: ${storefrontMappingUi.rendererOptions.join(", ")}.`,
      inputLabel: storefrontMappingUi.rendererLabel || "Renderer",
      defaultValue: row?.rendererType || "rich_text_block",
      confirmLabel: storefrontMappingUi.approveMappingLabel || "Approve mapping",
      required: true
    });
    if (!renderer) return;
    const normalizedRenderer = String(renderer).trim().toLowerCase();
    if (!storefrontMappingUi.rendererOptions.includes(normalizedRenderer)) {
      setStatusTone("error");
      setStatusMessage("Renderer is not allowed by the active storefront mapping descriptor.");
      return;
    }
    await updateStorefrontMapping(row, "approved", {
      suggested_slot: suggestedSlot,
      suggested_renderer: normalizedRenderer
    });
  };

  const mapStorefrontTag = (tagValue) => {
    const slot = normalizeStorefrontSlot(tagValue);
    if (!slot) return;
    const existingItems = storefrontItemsBySlot.get(slot) || [];
    if (existingItems.length) {
      setSelectedStorefrontSlot(slot);
      setShowStorefrontNew(false);
      return;
    }
    const zone = storefrontStructureZoneByTag.get(slot);
    setNewStorefront((prev) => ({
      ...prev,
      slot,
      title: zone?.label || prev.title || "",
      category_code: selectedCategoryTabCode || prev.category_code || ""
    }));
    setShowStorefrontNew(true);
  };

  const loadStorefrontList = async (
    queryValue = storefrontQuery,
    pageValue = storefrontPage,
    pageSizeValue = storefrontPageSize,
    categoryCodeValue = selectedCategoryTabCode
  ) => {
    setStorefrontListLoading(true);
    setStorefrontListError("");
    try {
      const limit = Math.max(1, Number(pageSizeValue) || 12);
      const pageSafe = Math.max(1, Number(pageValue) || 1);
      const offset = (pageSafe - 1) * limit;
      const qs = new URLSearchParams();
      qs.set("limit", String(limit));
      qs.set("offset", String(offset));
      qs.set("content_model", "singleton");
      if (categoryCodeValue) qs.set("category_code", normalizeStorefrontCategoryCode(categoryCodeValue));
      const q = String(queryValue || "").trim();
      if (q) qs.set("q", q);
      const data = await apiFetch(`/api/eip/ecom/storefront/content/list?${qs.toString()}`);
      const items = Array.isArray(data?.items) ? data.items.map((item) => normalizeStorefrontDraft(item)) : [];
      setStorefrontItems(items);
      setStorefrontTotal(Math.max(Number(data?.total || 0), items.length));
      return items;
    } catch (err) {
      setStorefrontListError(formatApiError(err, "Failed to load content list."));
      setStorefrontItems([]);
      setStorefrontTotal(0);
      return [];
    } finally {
      setStorefrontListLoading(false);
    }
  };

  const loadStorefrontBlogPosts = async () => {
    setStorefrontBlogLoading(true);
    setStorefrontBlogError("");
    try {
      const limit = Math.max(1, Number(storefrontBlogPageSize) || 12);
      const pageSafe = Math.max(1, Number(storefrontBlogPage) || 1);
      const offset = (pageSafe - 1) * limit;
      const qs = new URLSearchParams();
      qs.set("limit", String(limit));
      qs.set("offset", String(offset));
      if (storefrontBlogQuery.trim()) qs.set("q", storefrontBlogQuery.trim());
      if (storefrontBlogStatus && storefrontBlogStatus !== "all") qs.set("status", storefrontBlogStatus);
      const data = await apiFetch(`/api/eip/ecom/blog/posts?${qs.toString()}`);
      const items = Array.isArray(data?.items) ? data.items : [];
      setStorefrontBlogPosts(items);
      setStorefrontBlogTotal(Math.max(Number(data?.total || 0), items.length));
      return items;
    } catch (err) {
      setStorefrontBlogPosts([]);
      setStorefrontBlogTotal(0);
      setStorefrontBlogError(formatApiError(err, "Failed to load blog posts."));
      return [];
    } finally {
      setStorefrontBlogLoading(false);
    }
  };

  const loadPageContentList = async (
    queryValue = pageContentQuery,
    pageValue = pageContentPage,
    pageSizeValue = pageContentPageSize,
    statusValue = pageContentStatus
  ) => {
    setPageContentLoading(true);
    setPageContentListError("");
    try {
      const limit = Math.max(1, Number(pageSizeValue) || 12);
      const pageSafe = Math.max(1, Number(pageValue) || 1);
      const offset = (pageSafe - 1) * limit;
      const qs = new URLSearchParams();
      qs.set("limit", String(limit));
      qs.set("offset", String(offset));
      qs.set("content_model", "article");
      qs.set("page", "pages");
      const q = String(queryValue || "").trim();
      if (q) qs.set("q", q);
      if (statusValue && statusValue !== "all") qs.set("status", statusValue);
      const data = await apiFetch(`/api/eip/ecom/storefront/content/list?${qs.toString()}`);
      const items = Array.isArray(data?.items) ? data.items.map((item) => normalizePageContentDraft(item)) : [];
      setPageContentItems(items);
      setPageContentTotal(Math.max(Number(data?.total || 0), items.length));
      return items;
    } catch (err) {
      setPageContentItems([]);
      setPageContentTotal(0);
      setPageContentListError(formatApiError(err, "Failed to load page content."));
      return [];
    } finally {
      setPageContentLoading(false);
    }
  };

  const deleteStorefrontBlogPost = async (postId) => {
    const target = String(postId || "").trim();
    if (!target) return;
    const confirmed = await requestConfirm({
      title: "Delete blog post",
      message: "Delete this blog post?",
      confirmLabel: "Delete",
      confirmTone: "danger"
    });
    if (!confirmed) return;
    setStorefrontBlogDeletingId(target);
    setStatusMessage("");
    try {
      await apiFetch(`/api/eip/ecom/blog/posts/${encodeURIComponent(target)}`, {
        method: "DELETE"
      });
      setStatusTone("success");
      setStatusMessage("Blog post deleted.");
      await loadStorefrontBlogPosts();
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to delete blog post."));
    } finally {
      setStorefrontBlogDeletingId("");
    }
  };

  const createPageContent = async (event) => {
    event?.preventDefault?.();
    const slot = normalizeStorefrontSlot(newPageContent.slot || "pages.cards");
    if (!slot) {
      setStatusTone("error");
      setStatusMessage("Select a page content parent tag first.");
      return;
    }
    setStatusMessage("");
    try {
      const data = await apiFetch("/api/eip/ecom/storefront/content/items", {
        method: "POST",
        body: {
          slot,
          title: String(newPageContent.title || "").trim() || "Untitled article",
          category_code: normalizeStorefrontCategoryCode(newPageContent.category_code || ""),
          content_model: "article",
          article: {
            title: String(newPageContent.title || "").trim() || "Untitled article"
          }
        }
      });
      const next = normalizePageContentDraft(data?.item);
      setPageContentDraft(next);
      setSelectedPageContentId(next.id || next.code || "");
      setShowPageContentNew(false);
      setNewPageContent({ slot, title: "", category_code: "" });
      setStatusTone("success");
      setStatusMessage("Page article created.");
      await loadPageContentList(pageContentQuery, pageContentPage, pageContentPageSize, pageContentStatus);
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to create page article."));
    }
  };

  const updatePageContentField = (field, value) => {
    setPageContentDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updatePageContentArticleField = (field, value) => {
    setPageContentDraft((prev) => ({
      ...prev,
      article: {
        ...(prev.article || {}),
        [field]: value
      }
    }));
  };

  const savePageContent = async () => {
    const target = String(pageContentDraft?.id || pageContentDraft?.code || "").trim();
    if (!target) return;
    setPageContentSaving(true);
    setStatusMessage("");
    try {
      const body = {
        title: String(pageContentDraft.title || pageContentDraft.article?.title || "").trim() || "Untitled article",
        slot: normalizeStorefrontSlot(pageContentDraft.slot || "pages.cards"),
        category_code: normalizeStorefrontCategoryCode(pageContentDraft.category_code || ""),
        is_active: pageContentDraft.is_active !== false,
        article: {
          ...(pageContentDraft.article || {}),
          title: String(pageContentDraft.article?.title || pageContentDraft.title || "").trim() || "Untitled article"
        }
      };
      const data = await apiFetch(`/api/eip/ecom/storefront/content/items/${encodeURIComponent(target)}`, {
        method: "PUT",
        body
      });
      const next = normalizePageContentDraft(data?.item);
      setPageContentDraft(next);
      setSelectedPageContentId(next.id || next.code || "");
      setStatusTone("success");
      setStatusMessage("Page article saved.");
      await loadPageContentList(pageContentQuery, pageContentPage, pageContentPageSize, pageContentStatus);
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to save page article."));
    } finally {
      setPageContentSaving(false);
    }
  };

  const runPageContentAction = async (action, label) => {
    const target = String(pageContentDraft?.id || pageContentDraft?.code || "").trim();
    if (!target) return;
    setPageContentActionLoading(true);
    setStatusMessage("");
    try {
      const callAction = (publishEnglishOnly = false) =>
        apiFetch(`/api/eip/ecom/storefront/content/items/${encodeURIComponent(target)}/actions`, {
          method: "POST",
          body: {
            action,
            ...(publishEnglishOnly ? { publish_english_only: true } : {})
          }
        });

      let data = await callAction(false);
      if (action === "PUBLISH" && data?.publish_state === "translation_unavailable_confirmation_required") {
        const translationErrorCode = String(data?.translation?.error_code || "").trim();
        const translationErrorMessage = String(data?.translation?.error_message || "").trim();
        if (translationErrorCode || translationErrorMessage) {
          setStatusTone("error");
          setStatusMessage(
            translationErrorMessage
              ? `${translationErrorMessage}${translationErrorCode ? ` (${translationErrorCode})` : ""}`
              : `Translation service offline. (${translationErrorCode})`
          );
        }
        const confirmed = await requestConfirm({
          title: "Translation unavailable",
          message: "Translation service offline. Do you want to publish in English only?",
          confirmLabel: "Publish in English only",
          cancelLabel: "Cancel and check later",
          confirmTone: "default"
        });
        if (!confirmed) {
          setStatusTone("error");
          setStatusMessage("Publish cancelled. You can try again later.");
          return;
        }
        data = await callAction(true);
      }

      const next = normalizePageContentDraft(data?.item);
      setPageContentDraft(next);
      setSelectedPageContentId(next.id || next.code || "");
      setStatusTone("success");
      if (action === "PUBLISH" && data?.publish_state === "published_with_translation") {
        setStatusMessage("Published successfully with translation.");
      } else if (action === "PUBLISH" && data?.publish_state === "published_english_only") {
        setStatusMessage("Published successfully in English only.");
      } else {
        setStatusMessage(label ? `${label} requested.` : `Action ${action} sent.`);
      }
      await loadPageContentList(pageContentQuery, pageContentPage, pageContentPageSize, pageContentStatus);
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, `Action ${action} failed.`));
    } finally {
      setPageContentActionLoading(false);
    }
  };

  const deletePageContent = async () => {
    const target = String(pageContentDraft?.id || pageContentDraft?.code || "").trim();
    if (!target) return;
    const confirmed = await requestConfirm({
      title: "Delete article",
      message: "Delete this article?",
      confirmLabel: "Delete",
      confirmTone: "danger"
    });
    if (!confirmed) return;
    setPageContentDeleteLoading(true);
    setStatusMessage("");
    try {
      await apiFetch(`/api/eip/ecom/storefront/content/items/${encodeURIComponent(target)}`, {
        method: "DELETE"
      });
      setStatusTone("success");
      setStatusMessage("Page article deleted.");
      const nextItems = await loadPageContentList(pageContentQuery, pageContentPage, pageContentPageSize, pageContentStatus);
      const fallback = nextItems[0] || defaultPageContentDraft(newPageContent.slot || "pages.cards");
      setPageContentDraft(normalizePageContentDraft(fallback));
      setSelectedPageContentId(fallback?.id || fallback?.code || "");
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to delete page article."));
    } finally {
      setPageContentDeleteLoading(false);
    }
  };

  const handlePageContentImageUpload = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    setPageContentUploading(true);
    setStatusMessage("");
    try {
      const prepared = await openImageStudioForFile(file, {
        title: "Edit article image",
        recommendedSize: { width: 1800, height: 1200, label: "Article 3:2" },
        defaultProfileId: "blog-cover"
      });
      if (!prepared) return;
      const asset = await fileToAsset(prepared, { assetKind: "media" });
      if (!asset?.url) throw new Error("UPLOAD_MISSING_URL");
      updatePageContentArticleField("image", asset.url);
      setStatusTone("success");
      setStatusMessage("Article image uploaded.");
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Article image upload failed."));
    } finally {
      setPageContentUploading(false);
      input.value = "";
    }
  };

  const updateStorefrontField = (field, value) => {
    setStorefrontDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateStorefrontAttr = (field, value) => {
    setStorefrontDraft((prev) => ({
      ...prev,
      attrs: { ...(prev.attrs || {}), [field]: value }
    }));
  };

  const updateStorefrontProductSource = (field, value) => {
    setStorefrontDraft((prev) => ({
      ...prev,
      attrs: {
        ...(prev.attrs || {}),
        product_source: {
          ...(prev.attrs?.product_source || {}),
          [field]: value
        }
      }
    }));
  };

  const updateStorefrontSlideField = (index, field, value) => {
    setStorefrontDraft((prev) => {
      const slides = [...(Array.isArray(prev.slides) ? prev.slides : [])];
      if (!slides[index]) return prev;
      slides[index] = { ...slides[index], [field]: value };
      return { ...prev, slides };
    });
  };

  const moveStorefrontSlide = (index, direction) => {
    setStorefrontDraft((prev) => {
      const slides = [...(Array.isArray(prev.slides) ? prev.slides : [])];
      const target = index + direction;
      if (target < 0 || target >= slides.length) return prev;
      const [item] = slides.splice(index, 1);
      slides.splice(target, 0, item);
      const normalized = slides.map((slide, orderIdx) => ({ ...slide, order: orderIdx + 1 }));
      return { ...prev, slides: normalized };
    });
  };

  const addStorefrontSlide = () => {
    setStorefrontDraft((prev) => {
      const slides = [...(Array.isArray(prev.slides) ? prev.slides : [])];
      slides.push({
        id: `slide-${slides.length + 1}`,
        image: "",
        eyebrow: "",
        title: "",
        subtitle: "",
        cta_label: "Shop patterns",
        cta_url: "/patterns",
        cta_action: "navigate_internal",
        cta_target: "/patterns",
        cta_new_tab: false,
        cta: {
          action: "navigate_internal",
          target: "/patterns",
          new_tab: false
        },
        overlay: "left",
        fit: "cover",
        focus_x: 50,
        focus_y: 50,
        overlay_strength: 78,
        order: slides.length + 1
      });
      return { ...prev, slides };
    });
  };

  const removeStorefrontSlide = (index) => {
    setStorefrontDraft((prev) => {
      const slides = [...(Array.isArray(prev.slides) ? prev.slides : [])];
      if (!slides[index]) return prev;
      slides.splice(index, 1);
      const normalized = slides.map((slide, orderIdx) => ({ ...slide, order: orderIdx + 1 }));
      return {
        ...prev,
        slides: normalized.length
          ? normalized
          : defaultStorefrontDraft(normalizeStorefrontSlot(prev.slot)).slides
      };
    });
  };

  const handleStorefrontSlideUpload = async (index, event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setStorefrontUploadingIndex(index);
    setStatusMessage("");
    try {
      const prepared = await openImageStudioForFile(file, {
        title: storefrontMode === "cards" ? "Edit card image" : "Edit hero image",
        recommendedSize:
          storefrontMode === "cards"
            ? { width: 1400, height: 1050, label: "Card 4:3" }
            : { width: 1920, height: 1080, label: "Hero 16:9" },
        defaultProfileId: storefrontMode === "cards" ? "content-block" : "hero-banner"
      });
      if (!prepared) return;
      const asset = await fileToAsset(prepared, { assetKind: "media" });
      if (!asset?.url) throw new Error("UPLOAD_MISSING_URL");
      updateStorefrontSlideField(index, "image", asset.url);
      setStatusTone("success");
      setStatusMessage("Slide image uploaded.");
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Slide image upload failed."));
    } finally {
      setStorefrontUploadingIndex(null);
      input.value = "";
    }
  };

  const saveStorefrontContent = async () => {
    setStorefrontSaving(true);
    setStatusMessage("");
    try {
      const payload = {
        title: storefrontDraft.title || "Storefront content",
        category_code: normalizeStorefrontCategoryCode(
          storefrontDraft.category_code || ""
        ),
        is_active: storefrontDraft.is_active !== false,
        attrs: storefrontDraft.attrs || {},
        slides: (Array.isArray(storefrontDraft.slides) ? storefrontDraft.slides : [])
          .map((slide, index) => ({
            ...slide,
            cta: {
              action: String(slide?.cta_action || "navigate_internal").toLowerCase() === "navigate_external"
                ? "navigate_external"
                : String(slide?.cta_action || "navigate_internal").toLowerCase() === "scroll_to"
                  ? "scroll_to"
                  : "navigate_internal",
              target: String(slide?.cta_target || slide?.cta_url || "").trim() || null,
              new_tab: slide?.cta_new_tab === true || String(slide?.cta_new_tab || "").toLowerCase() === "true"
            },
            cta_url: String(slide?.cta_target || slide?.cta_url || "").trim() || null,
            order: Number.isFinite(Number(slide.order)) ? Number(slide.order) : index + 1
          }))
          .filter((slide) => isStorefrontSlideContentful(slide))
      };
      const rendererType = String(payload.attrs?.renderer_type || "").trim().toLowerCase();
      const requiredFields = Array.isArray(storefrontMappingUi.requiredFieldsByRenderer?.[rendererType])
        ? storefrontMappingUi.requiredFieldsByRenderer[rendererType]
        : [];
      if (requiredFields.includes("slides") && !payload.slides.length) {
        setStatusTone("error");
        setStatusMessage("Add at least one content slide or card before saving.");
        return;
      }
      if (requiredFields.includes("source_mode") && !String(payload.attrs?.source_mode || "").trim()) {
        setStatusTone("error");
        setStatusMessage("Choose a governed product source before saving this placement.");
        return;
      }
      if (!payload.slides.length && !String(payload.attrs?.source_mode || "").trim()) {
        const mode = storefrontSlotModeFor(storefrontDraft.slot);
        setStatusTone("error");
        setStatusMessage(
          mode === "cards"
            ? "Add at least one content card before saving."
            : "Add at least one hero slide before saving."
        );
        return;
      }
      const slotValue = normalizeStorefrontSlot(storefrontDraft.slot);
      const slot = encodeURIComponent(slotValue);
      const data = await apiFetch(`/api/eip/ecom/storefront/content/${slot}`, {
        method: "PUT",
        body: payload
      });
      const nextDraft = normalizeStorefrontDraft(data?.item);
      setStorefrontDraft(nextDraft);
      setSelectedStorefrontSlot(normalizeStorefrontSlot(nextDraft.slot));
      await loadStorefrontList(storefrontQuery, storefrontPage, storefrontPageSize);
      setStatusTone("success");
      setStatusMessage("Storefront content saved.");
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Failed to save storefront content."));
    } finally {
      setStorefrontSaving(false);
    }
  };

  const openStorefrontPreview = () => {
    if (typeof window === "undefined") return;
    const base = String(ECOM_PREVIEW_BASE_URL || "").trim().replace(/\/$/, "");
    const normalizedSlot = normalizeStorefrontSlot(storefrontDraft.slot || defaultStorefrontSlot);
    const slot = encodeURIComponent(normalizedSlot);
    const mappedPage = String(storefrontStructureZoneByTag.get(normalizedSlot)?.page || "").trim();
    const mappedPreviewPage =
      (mappedPage ? normalizeStorefrontSlot(mappedPage) : "") ||
      getConfiguredStorefrontSlotPreset(normalizedSlot)?.page ||
      storefrontPreviewPageForSlot(normalizedSlot);
    const previewPage = encodeURIComponent(mappedPreviewPage);
    const previewUrl = `${base}/?page=${previewPage}&content_slot=${slot}&content_preview=1`;
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  const runStorefrontAction = async (action, label) => {
    const slot = normalizeStorefrontSlot(storefrontDraft.slot || selectedStorefrontSlot);
    if (!slot) return;
    setStorefrontActionLoading(true);
    setStatusMessage("");
    try {
      const data = await apiFetch(`/api/eip/ecom/storefront/content/${encodeURIComponent(slot)}/actions`, {
        method: "POST",
        body: { action }
      });
      setStorefrontDraft(normalizeStorefrontDraft(data?.item));
      setStatusTone("success");
      setStatusMessage(label ? `${label} requested.` : `Action ${action} sent.`);
      await loadStorefrontList(storefrontQuery, storefrontPage, storefrontPageSize);
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, `Action ${action} failed.`));
    } finally {
      setStorefrontActionLoading(false);
    }
  };

  const publishStorefrontNow = async () => {
    const slot = normalizeStorefrontSlot(storefrontDraft.slot || selectedStorefrontSlot);
    if (!slot) return;
    setStorefrontActionLoading(true);
    setStatusMessage("");
    try {
      const callAction = async (action, options = {}) => {
        const publishEnglishOnly = options.publishEnglishOnly === true;
        try {
          return await apiFetch(`/api/eip/ecom/storefront/content/${encodeURIComponent(slot)}/actions`, {
            method: "POST",
            body: {
              action,
              ...(publishEnglishOnly ? { publish_english_only: true } : {})
            }
          });
        } catch (err) {
          const parsed = parseApiError(err);
          if (options.allowInvalidTransition && parsed.error === "INVALID_TRANSITION") {
            return null;
          }
          throw err;
        }
      };

      try {
        await callAction("DRAFT_READY", { allowInvalidTransition: true });
      } catch (err) {
        const parsed = parseApiError(err);
        if (parsed.error !== "INVALID_ACTION") {
          throw err;
        }
      }
      await callAction("APPROVE", { allowInvalidTransition: true });
      let published = await callAction("PUBLISH");
      if (published?.publish_state === "translation_unavailable_confirmation_required") {
        const translationErrorCode = String(published?.translation?.error_code || "").trim();
        const translationErrorMessage = String(published?.translation?.error_message || "").trim();
        if (translationErrorCode || translationErrorMessage) {
          setStatusTone("error");
          setStatusMessage(
            translationErrorMessage
              ? `${translationErrorMessage}${translationErrorCode ? ` (${translationErrorCode})` : ""}`
              : `Translation service offline. (${translationErrorCode})`
          );
        }
        const confirmed = await requestConfirm({
          title: "Translation unavailable",
          message: "Translation service offline. Do you want to publish in English only?",
          confirmLabel: "Publish in English only",
          cancelLabel: "Cancel and check later",
          confirmTone: "default"
        });
        if (!confirmed) {
          setStatusTone("error");
          setStatusMessage("Publish cancelled. You can try again later.");
          return;
        }
        published = await callAction("PUBLISH", { publishEnglishOnly: true });
      }
      if (published?.item) {
        setStorefrontDraft(normalizeStorefrontDraft(published.item));
      } else {
        await loadStorefrontContent(slot);
      }
      setStatusTone("success");
      if (published?.publish_state === "published_with_translation") {
        setStatusMessage("Published successfully with translation.");
      } else if (published?.publish_state === "published_english_only") {
        setStatusMessage("Published successfully in English only.");
      } else {
        setStatusMessage("Storefront content published.");
      }
      await loadStorefrontList(storefrontQuery, storefrontPage, storefrontPageSize);
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Publish failed."));
    } finally {
      setStorefrontActionLoading(false);
    }
  };

  const createStorefrontContent = async (event) => {
    event.preventDefault();
    const slot = normalizeStorefrontSlot(newStorefront.slot || "");
    if (!slot) {
      setStatusTone("error");
      setStatusMessage("Select a scanned structure tag before creating content.");
      return;
    }
    const exists = storefrontItems.some(
      (item) => normalizeStorefrontSlot(item.slot) === slot
    );
    if (exists) {
      setStatusTone("error");
      setStatusMessage("Slot already exists. Use a new slot value.");
      return;
    }
    const title = String(newStorefront.title || "").trim() || "New content";
    setStatusMessage("");
    try {
      const payload = defaultStorefrontDraft(slot);
      payload.title = title;
      const mappedZone = storefrontStructureZoneByTag.get(slot);
      const rendererType = String(mappedZone?.rendererType || "").trim().toLowerCase();
      const productDriven = rendererType === "product_carousel" || rendererType === "product_grid";
      const sourceTag = inferProductSourceTag(slot);
      const data = await apiFetch(`/api/eip/ecom/storefront/content/${encodeURIComponent(slot)}`, {
        method: "PUT",
        body: {
          title: payload.title,
          category_code: normalizeStorefrontCategoryCode(
            newStorefront.category_code || ""
          ),
          is_active: true,
          slides: payload.slides,
          attrs: {
            ...(rendererType ? { renderer_type: rendererType } : {}),
            ...(productDriven
              ? {
                  source_mode: sourceTag ? "hybrid_tag_overrides" : "manual_products",
                  product_source: {
                    mode: sourceTag ? "hybrid_tag_overrides" : "manual_products",
                    tag: sourceTag,
                    product_codes: [],
                    include_product_codes: [],
                    exclude_product_codes: [],
                    limit: 24
                  }
                }
              : {})
          }
        }
      });
      const nextDraft = normalizeStorefrontDraft(data?.item);
      setShowStorefrontNew(false);
      setNewStorefront({ slot: "", title: "", category_code: "" });
      setStorefrontPage(1);
      setSelectedStorefrontSlot(normalizeStorefrontSlot(nextDraft.slot));
      setStorefrontDraft(nextDraft);
      await loadStorefrontList(storefrontQuery, 1, storefrontPageSize);
      setStatusTone("success");
      setStatusMessage("Content created.");
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Create failed."));
    }
  };

  const deleteStorefrontContent = async () => {
    const slot = normalizeStorefrontSlot(storefrontDraft.slot || selectedStorefrontSlot);
    if (!slot) return;
    const confirmed = await requestConfirm({
      title: "Delete content slot",
      message: `Delete content slot "${slot}"?`,
      confirmLabel: "Delete",
      confirmTone: "danger"
    });
    if (!confirmed) return;
    setStorefrontDeleteLoading(true);
    setStatusMessage("");
    try {
      await apiFetch(`/api/eip/ecom/storefront/content/${encodeURIComponent(slot)}`, {
        method: "DELETE"
      });
      setStatusTone("success");
      setStatusMessage("Content deleted.");
      const nextPage = storefrontPage > 1 && storefrontItems.length <= 1 ? storefrontPage - 1 : storefrontPage;
      if (nextPage !== storefrontPage) setStorefrontPage(nextPage);
      const nextItems = await loadStorefrontList(storefrontQuery, nextPage, storefrontPageSize);
      if (nextItems.length) {
        const fallback =
          nextItems.find((item) => normalizeStorefrontSlot(item.slot) !== slot) || nextItems[0];
        setSelectedStorefrontSlot(normalizeStorefrontSlot(fallback?.slot || defaultStorefrontSlot));
      } else {
        setSelectedStorefrontSlot(defaultStorefrontSlot);
        setStorefrontDraft(defaultStorefrontDraft(defaultStorefrontSlot));
      }
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Delete failed."));
    } finally {
      setStorefrontDeleteLoading(false);
    }
  };

  useEffect(() => {
    if (contentStudioOnly) return;
    refreshList();
  }, [query, contentStudioOnly]);

  useEffect(() => {
    void loadTranslationServiceStatus();
  }, [contentStudioOnly]);

  useEffect(() => {
    if (contentStudioOnly) return;
    loadVariantHeaderCatalog();
    loadProductCategoryCatalog();
  }, [contentStudioOnly]);

  useEffect(() => {
    loadStorefrontContent(selectedStorefrontSlot);
  }, [selectedStorefrontSlot]);

  useEffect(() => {
    if (!contentStudioOnly) return;
    loadStorefrontList(storefrontQuery, storefrontPage, storefrontPageSize);
  }, [contentStudioOnly, storefrontQuery, storefrontPage, storefrontPageSize, selectedCategoryTabCode]);

  useEffect(() => {
    if (!contentStudioOnly) return;
    loadStorefrontBlogPosts();
  }, [contentStudioOnly, storefrontBlogQuery, storefrontBlogStatus, storefrontBlogPage, storefrontBlogPageSize]);

  useEffect(() => {
    if (!contentStudioOnly) return;
    loadPageContentList(pageContentQuery, pageContentPage, pageContentPageSize, pageContentStatus);
  }, [contentStudioOnly, pageContentQuery, pageContentStatus, pageContentPage, pageContentPageSize]);

  useEffect(() => {
    if (!contentStudioOnly) return;
    let cancelled = false;
    (async () => {
      await loadStorefrontStudioTabs();
      await loadStorefrontCategories();
      const items = await loadStorefrontConnections();
      if (cancelled) return;
      const hasEligible = Array.isArray(items) && items.some((item) => item?.scan_eligible);
      if (!hasEligible) {
        setStorefrontStructure(null);
        return;
      }
      await loadStorefrontStructure();
    })();
    return () => {
      cancelled = true;
    };
  }, [contentStudioOnly]);

  useEffect(() => {
    if (!contentStudioOnly) return;
    if (!storefrontItems.length && !storefrontAllSlotOptions.length) return;
    const selected = normalizeStorefrontSlot(selectedStorefrontSlot || "");
    if (!selected || !storefrontAllSlotOptions.some((item) => item.value === selected)) {
      setSelectedStorefrontSlot(defaultStorefrontSlot);
    }
  }, [contentStudioOnly, storefrontItems, storefrontAllSlotOptions, selectedStorefrontSlot, defaultStorefrontSlot]);

  useEffect(() => {
    if (!contentStudioOnly) return;
    if (!storefrontConnectionOptions.length) return;
    if (
      selectedStorefrontConnectionCode &&
      storefrontConnectionOptions.some((option) => option.value === selectedStorefrontConnectionCode)
    ) {
      return;
    }
    setSelectedStorefrontConnectionCode(storefrontConnectionOptions[0].value);
  }, [contentStudioOnly, storefrontConnectionOptions, selectedStorefrontConnectionCode]);

  useEffect(() => {
    if (!contentStudioOnly) return;
    if (!contentStudioTabs.length) return;
    const exists = contentStudioTabs.some((tab) => tab.id === contentStudioTab);
    if (!exists) {
      setContentStudioTab(contentStudioTabs[0].id);
    }
  }, [contentStudioOnly, contentStudioTabs, contentStudioTab]);

  useEffect(() => {
    if (!contentStudioOnly) return;
    const value = String(contentStudioTab || "");
    if (!value.startsWith("cat:")) return;
    const code = normalizeStorefrontCategoryCode(value.slice(4));
    if (!code) {
      setContentStudioTab("blocks");
      return;
    }
    const exists = Array.isArray(storefrontCategories)
      ? storefrontCategories.some((item) => normalizeStorefrontCategoryCode(item?.code || "") === code)
      : false;
    if (!exists) {
      setContentStudioTab("blocks");
    }
  }, [contentStudioOnly, contentStudioTab, storefrontCategories]);

  useEffect(() => {
    setStorefrontPage(1);
  }, [storefrontQuery, storefrontPageSize]);

  useEffect(() => {
    if (!contentStudioOnly) return;
    if (!selectedCategoryTabCode) return;
    setNewStorefront((prev) => ({ ...prev, category_code: selectedCategoryTabCode }));
  }, [contentStudioOnly, selectedCategoryTabCode]);

  useEffect(() => {
    setStorefrontBlogPage(1);
  }, [storefrontBlogQuery, storefrontBlogStatus, storefrontBlogPageSize]);

  useEffect(() => {
    setPageContentPage(1);
  }, [pageContentQuery, pageContentStatus, pageContentPageSize]);

  useEffect(() => {
    if (storefrontPage > storefrontTotalPages) {
      setStorefrontPage(storefrontTotalPages);
    }
  }, [storefrontPage, storefrontTotalPages]);

  useEffect(() => {
    if (storefrontBlogPage > storefrontBlogTotalPages) {
      setStorefrontBlogPage(storefrontBlogTotalPages);
    }
  }, [storefrontBlogPage, storefrontBlogTotalPages]);

  useEffect(() => {
    if (pageContentPage > pageContentTotalPages) {
      setPageContentPage(pageContentTotalPages);
    }
  }, [pageContentPage, pageContentTotalPages]);

  useEffect(() => {
    setVariantInventoryPage(1);
  }, [draft?.id, variantInventoryPageSize, variantInventoryQuery]);

  useEffect(() => {
    if (variantInventoryPage > variantInventoryTotalPages) {
      setVariantInventoryPage(variantInventoryTotalPages);
    }
  }, [variantInventoryPage, variantInventoryTotalPages]);

  useEffect(() => {
    if (!contentStudioOnly) return;
    if (!pageContentItems.length) {
      setPageContentDraft(defaultPageContentDraft(newPageContent.slot || "pages.cards"));
      setSelectedPageContentId("");
      return;
    }
    const selected = pageContentItems.find((item) => String(item.id || item.code) === String(selectedPageContentId || ""));
    if (selected) {
      setPageContentDraft(normalizePageContentDraft(selected));
      return;
    }
    const first = pageContentItems[0];
    setPageContentDraft(normalizePageContentDraft(first));
    setSelectedPageContentId(first.id || first.code || "");
  }, [contentStudioOnly, pageContentItems, selectedPageContentId, newPageContent.slot]);

  useEffect(() => {
    if (contentStudioOnly) return;
    if (selectedId) {
      loadDetail(selectedId);
    } else {
      setDraft(defaultDraft());
      setReviewItems([]);
    }
  }, [selectedId, contentStudioOnly]);

  useEffect(() => {
    if (contentStudioOnly || !draft?.code) return;
    loadReviews(draft.code, reviewStatusFilter);
  }, [reviewStatusFilter, draft?.code, contentStudioOnly]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(products.map((item) => item.id));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next;
    });
  }, [products]);

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
    }
  }, [allVisibleSelected, someVisibleSelected]);

  useEffect(() => {
    if (!selectedProductCategoryCode) return;
    const allowedEntries = categoryVariantHeaderOptions.map((entry) => ({
      key: toVariantFieldKey(entry.code, ""),
      label: String(entry.label || entry.code).trim()
    }));
    setDraft((prev) => {
      const attrs = prev?.attrs && typeof prev.attrs === "object" ? prev.attrs : {};
      const currentVariants = normalizeProductVariants(attrs.variants);
      if (!allowedEntries.length) {
        if (!currentVariants.headers.length) return prev;
        const nextHeaders = [];
        const nextItems = currentVariants.items.map((item) => normalizeVariantItem(item, nextHeaders));
        return {
          ...prev,
          attrs: {
            ...attrs,
            variants: normalizeProductVariants({
              ...currentVariants,
              headers: nextHeaders,
              items: nextItems
            })
          }
        };
      }
      const currentKeys = currentVariants.headers.map((header) =>
        toVariantFieldKey(header?.key, "")
      );
      const nextHeaders = allowedEntries.map((entry) => ({
        key: entry.key,
        label: entry.label
      }));
      const nextKeys = nextHeaders.map((header) => toVariantFieldKey(header?.key, ""));
      const sameKeys =
        currentKeys.length === nextKeys.length &&
        currentKeys.every((key, index) => key === nextKeys[index]);
      if (sameKeys) return prev;
      const nextItems = currentVariants.items.map((item) => normalizeVariantItem(item, nextHeaders));
      return {
        ...prev,
        attrs: {
          ...attrs,
          variants: normalizeProductVariants({
            ...currentVariants,
            headers: nextHeaders,
            items: nextItems
          })
        }
      };
    });
  }, [selectedProductCategoryCode, categoryVariantHeaderOptions]);

  const updateDraft = (path, value) => {
    setDraft((prev) => {
      const next = { ...prev };
      if (path.length === 1) {
        next[path[0]] = value;
        return next;
      }
      next.attrs = { ...(prev.attrs || {}) };
      let cursor = next.attrs;
      for (let i = 0; i < path.length - 1; i += 1) {
        const key = path[i];
        cursor[key] = { ...(cursor[key] || {}) };
        cursor = cursor[key];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  };

  const updateDraftVariants = (updater) => {
    if (typeof updater !== "function") return;
    setDraft((prev) => {
      const next = { ...prev };
      const attrs = { ...(prev.attrs || {}) };
      const current = normalizeProductVariants(attrs.variants);
      const candidate = updater(current);
      const updated = normalizeProductVariants(candidate || current);
      attrs.variants = updated;
      next.attrs = attrs;
      return next;
    });
  };

  const toggleVariantMode = (enabled) => {
    if (enabled === true && !selectedProductCategoryCode) {
      setStatusTone("error");
      setStatusMessage("Select a primary category before enabling variants.");
    }
    updateDraftVariants((current) => ({ ...current, enabled: enabled === true }));
  };

  const addVariantRow = () => {
    updateDraftVariants((current) => ({
      ...current,
      enabled: true,
      items: [
        ...current.items,
        normalizeVariantItem({ id: makeVariantId(), active: true }, current.headers || [])
      ]
    }));
  };

  const updateVariantRow = (id, patch) => {
    if (!id) return;
    updateDraftVariants((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id
          ? normalizeVariantItem({ ...item, ...patch }, current.headers || [])
          : normalizeVariantItem(item, current.headers || [])
      )
    }));
  };

  const removeVariantRow = (id) => {
    if (!id) return;
    updateDraftVariants((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id)
    }));
  };

  const saveProduct = async () => {
    if (!draft?.id) return;
    setStatusMessage("");
    try {
      const attrs = { ...(draft.attrs || {}) };
      const missingRequired = [];
      if (!String(draft.title || "").trim()) {
        missingRequired.push("Product name");
      }
      if (!stripRichTextToPlain(attrs?.content?.summary)) {
        missingRequired.push("Product description");
      }
      if (!selectedProductCategoryCode) {
        missingRequired.push("Category");
      }
      if (!selectedProductSubcategoryCode) {
        missingRequired.push("Subcategory");
      }
      if (missingRequired.length) {
        setStatusTone("error");
        setStatusMessage(`Save blocked. Required before save: ${missingRequired.join(", ")}.`);
        return;
      }
      delete attrs.workflow;
      const compactVariants = compactProductVariants(attrs.variants);
      if (compactVariants) attrs.variants = compactVariants;
      else delete attrs.variants;
      const inventory = attrs.inventory && typeof attrs.inventory === "object" ? { ...attrs.inventory } : {};
      if (compactVariants?.enabled) {
        const totals = computeVariantInventoryTotals(compactVariants);
        inventory.available_qty = totals.activeQty;
        inventory.on_hand = totals.activeQty;
      }
      if (Object.keys(inventory).length) {
        attrs.inventory = inventory;
      } else {
        delete attrs.inventory;
      }
      if (attrs.media) {
        const media = { ...attrs.media };
        if (media.main_asset?.url && !media.main_url) {
          media.main_url = media.main_asset.url;
        }
        if (media.main_url && !media.hero_url) {
          media.hero_url = media.main_url;
        }
        if (media.hero_asset?.url && !media.hero_url) {
          media.hero_url = media.hero_asset.url;
        }
        if (Array.isArray(media.gallery_assets)) {
          const galleryUrls = media.gallery_assets.map((asset) => asset?.url).filter(Boolean);
          if (galleryUrls.length) {
            const existing = Array.isArray(media.gallery) ? media.gallery.filter(Boolean) : [];
            media.gallery = Array.from(new Set([...existing, ...galleryUrls]));
          }
        }
        if (Array.isArray(media.document_assets)) {
          const documentUrls = media.document_assets.map((asset) => asset?.url).filter(Boolean);
          if (documentUrls.length) {
            const existing = Array.isArray(media.documents) ? media.documents.filter(Boolean) : [];
            media.documents = Array.from(new Set([...existing, ...documentUrls]));
          }
        }
        attrs.media = sanitizeMediaAttrs(media);
      }
      await apiFetch(`/api/eip/ecom/products/${draft.id}`, {
        method: "PATCH",
        body: {
          code: draft.code || null,
          title: draft.title || null,
          attrs
        }
      });
      setStatusTone("success");
      setStatusMessage("Saved.");
      await refreshList();
      await loadDetail(draft.id);
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Save failed."));
    }
  };

  const runAction = async (action, label) => {
    if (!draft?.id) return;
    setStatusMessage("");
    try {
      await apiFetch(`/api/eip/ecom/products/${draft.id}/actions`, {
        method: "POST",
        body: { action }
      });
      setStatusTone("success");
      setStatusMessage(label ? `${label} requested.` : `Action ${action} sent.`);
      await loadDetail(draft.id);
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, `Action ${action} failed.`));
    }
  };

  const publishNow = async () => {
    if (!draft?.id) return;
    setStatusMessage("");
    try {
      try {
        await apiFetch(`/api/eip/ecom/products/${draft.id}/actions`, {
          method: "POST",
          body: { action: "DRAFT_READY" }
        });
      } catch (err) {
        const parsed = parseApiError(err);
        if (parsed.error !== "INVALID_TRANSITION") {
          throw err;
        }
      }
      await apiFetch(`/api/eip/ecom/products/${draft.id}/actions`, {
        method: "POST",
        body: { action: "APPROVE" }
      });
      const publish = async (publishEnglishOnly = false) =>
        apiFetch(`/api/eip/ecom/products/${draft.id}/actions`, {
          method: "POST",
          body: { action: "PUBLISH", publish_english_only: publishEnglishOnly }
        });

      let publishResult = await publish(false);
      if (publishResult?.publish_state === "translation_unavailable_confirmation_required") {
        const translationErrorCode = String(publishResult?.translation?.error_code || "").trim();
        const translationErrorMessage = String(publishResult?.translation?.error_message || "").trim();
        if (translationErrorCode || translationErrorMessage) {
          setStatusTone("error");
          setStatusMessage(
            translationErrorMessage
              ? `${translationErrorMessage}${translationErrorCode ? ` (${translationErrorCode})` : ""}`
              : `Translation service offline. (${translationErrorCode})`
          );
        }
        const confirmed = await requestConfirm({
          title: "Translation unavailable",
          message: "Translation service offline. Do you want to publish in English only?",
          confirmLabel: "Publish in English only",
          cancelLabel: "Cancel and check later",
          confirmTone: "default"
        });
        if (!confirmed) {
          setStatusTone("error");
          setStatusMessage("Publish cancelled. You can try again later.");
          return;
        }
        publishResult = await publish(true);
      }

      if (publishResult?.publish_state === "published_with_translation") {
        setStatusTone("success");
        setStatusMessage("Published successfully with translation.");
      } else if (publishResult?.publish_state === "published_english_only") {
        setStatusTone("success");
        setStatusMessage("Published successfully in English only.");
      } else {
        setStatusTone("success");
        setStatusMessage("Published.");
      }
      await loadDetail(draft.id);
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Publish failed."));
    }
  };

  const createProduct = async (event) => {
    event.preventDefault();
    setStatusMessage("");
    try {
      const data = await apiFetch("/api/eip/ecom/products", {
        method: "POST",
        body: {
          code: null,
          title: newProduct.title || "New product",
          attrs: newProduct.supplierCode
            ? { inventory: { supplier_code: newProduct.supplierCode } }
            : undefined
        }
      });
      setStatusTone("success");
      setStatusMessage("Product created.");
      setShowNew(false);
      setNewProduct({ supplierCode: "", title: "" });
      await refreshList();
      if (data.item?.id) {
        setSelectedId(data.item.id);
      }
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Create failed."));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pagedProducts.forEach((item) => {
        if (checked) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      });
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };


  const applyBulkAction = async () => {
    if (!bulkAction || !selectedIds.size) return;
    setStatusMessage("");
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let errorCount = 0;
    for (const id of ids) {
      try {
        if (bulkAction === "PUBLISH_NOW") {
          try {
            await apiFetch(`/api/eip/ecom/products/${id}/actions`, {
              method: "POST",
              body: { action: "DRAFT_READY" }
            });
          } catch (err) {
            const parsed = parseApiError(err);
            if (parsed.error !== "INVALID_TRANSITION") {
              throw err;
            }
          }
          await apiFetch(`/api/eip/ecom/products/${id}/actions`, {
            method: "POST",
            body: { action: "APPROVE" }
          });
          await apiFetch(`/api/eip/ecom/products/${id}/actions`, {
            method: "POST",
            body: { action: "PUBLISH" }
          });
        } else {
          await apiFetch(`/api/eip/ecom/products/${id}/actions`, {
            method: "POST",
            body: { action: bulkAction }
          });
        }
        successCount += 1;
      } catch (err) {
        errorCount += 1;
      }
    }
    if (errorCount) {
      setStatusTone("error");
      setStatusMessage(`Bulk action completed with ${errorCount} error(s).`);
    } else {
      setStatusTone("success");
      setStatusMessage(`Bulk action applied to ${successCount} product(s).`);
    }
    setBulkAction("");
    await refreshList();
    clearSelection();
  };

  const exportProducts = () => {
    if (!filteredProducts.length) return;
    const columns = [
      "title",
      "sku",
      "supplier_code",
      "category",
      "tags",
      "price",
      "currency",
      "available_qty",
      "variant_count",
      "main_url",
      "gallery_urls",
      "document_urls"
    ];
    const rows = filteredProducts.map((item) => {
      const tier = Array.isArray(item.attrs?.pricing?.tiers) ? item.attrs.pricing.tiers[0] : null;
      const variantSummary = summarizeProductVariants(item.attrs?.variants);
      return {
        title: item.title || "",
        sku: item.attrs?.inventory?.sku || "",
        supplier_code: item.attrs?.inventory?.supplier_code || "",
        category: item.attrs?.taxonomy?.category || "",
        tags: Array.isArray(item.attrs?.taxonomy?.tags) ? item.attrs.taxonomy.tags.join("|") : "",
        price: tier?.amount ?? "",
        currency: tier?.currency ?? "",
        available_qty: resolveProductStock(item.attrs),
        variant_count: variantSummary.activeCount || "",
        main_url: item.attrs?.media?.main_url || item.attrs?.media?.hero_url || "",
        gallery_urls: Array.isArray(item.attrs?.media?.gallery)
          ? item.attrs.media.gallery.join("|")
          : "",
        document_urls: Array.isArray(item.attrs?.media?.documents)
          ? item.attrs.media.documents.join("|")
          : ""
      };
    });
    const csvLines = [
      columns.join(","),
      ...rows.map((row) => columns.map((column) => toCsvValue(row[column])).join(","))
    ];
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `products_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    setImportNotice({ tone: "", message: "" });
    if (importMode === "file" && !importFile) {
      setImportNotice({ tone: "error", message: "Select a CSV file to import." });
      return;
    }
    if (importMode === "sheet" && !importUrl.trim()) {
      setImportNotice({ tone: "error", message: "Provide a Google Sheet or CSV URL." });
      return;
    }

    setImporting(true);
    try {
      let csvText = "";
      if (importMode === "file") {
        csvText = await importFile.text();
      } else {
        const sheetUrl = normalizeSheetUrl(importUrl);
        const response = await fetch(sheetUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch sheet (${response.status})`);
        }
        csvText = await response.text();
      }
      const rows = parseCsvObjects(csvText);
      if (!rows.length) {
        throw new Error("No rows found in the file.");
      }
      const created = [];
      for (const row of rows) {
        const title =
          row.title ||
          row.product_name ||
          row.name ||
          row.product ||
          row.product_title ||
          "";
        if (!String(title).trim()) {
          continue;
        }

        const tags = splitMultiValue(row.tags || row.keywords || row.tag);
        const galleryUrls = splitMultiValue(row.gallery_urls || row.gallery || row.images || row.image_urls);
        const documentUrls = splitMultiValue(
          row.document_urls || row.documents || row.files || row.downloads
        );
        const mainUrl = row.main_url || row.hero_url || row.image || row.image_url || "";
        const amount = parseNumber(row.price || row.amount);
        const currency = row.currency || "USD";
        const availableQty = parseNumber(row.available_qty || row.stock || row.quantity);
        const category = row.category || "";
        const subcategory = row.subcategory || "";

        const attrs = {};
        if (tags.length || category || subcategory) {
          attrs.taxonomy = { tags, category, subcategory };
        }
        if (mainUrl || galleryUrls.length || documentUrls.length) {
          attrs.media = {
            main_url: mainUrl || undefined,
            hero_url: mainUrl || undefined,
            gallery: galleryUrls.length ? galleryUrls : undefined,
            documents: documentUrls.length ? documentUrls : undefined
          };
        }
        if (row.description) {
          attrs.content = { summary: row.description };
        }
        const inventory = {};
        if (row.supplier_code || row.supplier) {
          inventory.supplier_code = row.supplier_code || row.supplier;
        }
        if (availableQty !== null) {
          inventory.available_qty = availableQty;
        }
        if (Object.keys(inventory).length) {
          attrs.inventory = inventory;
        }
        if (amount !== null) {
          attrs.pricing = {
            strategy: "fixed",
            tiers: [
              {
                amount,
                currency
              }
            ]
          };
        }

        await apiFetch("/api/eip/ecom/products", {
          method: "POST",
          body: {
            title: String(title).trim(),
            attrs
          }
        });
        created.push(title);
      }
      setImportNotice({
        tone: "success",
        message: `Imported ${created.length} product(s).`
      });
      setImportFile(null);
      setImportUrl("");
      await refreshList();
    } catch (err) {
      setImportNotice({
        tone: "error",
        message: err?.message || "Import failed."
      });
    } finally {
      setImporting(false);
    }
  };

  const handleMainUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const prepared = await openImageStudioForFile(file, {
      title: "Edit main product media",
      recommendedSize: { width: 1200, height: 1500, label: "Product 4:5" },
      defaultProfileId: "product-card"
    });
    if (!prepared) {
      event.target.value = "";
      return;
    }
    const previewUrl = URL.createObjectURL(prepared);
    setDraft((prev) => {
      const next = { ...prev };
      const attrs = { ...(prev.attrs || {}) };
      const media = { ...(attrs.media || {}) };
      if (media.main_asset) revokePreview(media.main_asset);
      media.main_asset = {
        name: prepared.name,
        type: prepared.type || (guessVideoFromUrl(prepared.name) ? "video" : "image"),
        preview_url: previewUrl
      };
      attrs.media = media;
      next.attrs = attrs;
      return next;
    });
    try {
      const asset = await fileToAsset(prepared, { assetKind: "media" });
      updateDraft(["media", "main_asset"], { ...asset, preview_url: previewUrl });
      if (asset.url) {
        updateDraft(["media", "main_url"], asset.url);
        updateDraft(["media", "hero_url"], asset.url);
      }
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Main media upload failed."));
    } finally {
      event.target.value = "";
    }
  };

  const handleGalleryUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const preparedFiles = [];
    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      const prepared = await openImageStudioForFile(file, {
        title: "Edit gallery image",
        recommendedSize: { width: 1400, height: 1750, label: "Gallery 4:5" },
        defaultProfileId: "product-gallery"
      });
      if (!prepared) continue;
      preparedFiles.push(prepared);
    }
    if (!preparedFiles.length) {
      event.target.value = "";
      return;
    }

    const previews = preparedFiles.map((file) => ({
      name: file.name,
      type: file.type || (guessVideoFromUrl(file.name) ? "video" : "image"),
      preview_url: URL.createObjectURL(file)
    }));
    setDraft((prev) => {
      const next = { ...prev };
      const attrs = { ...(prev.attrs || {}) };
      const media = { ...(attrs.media || {}) };
      const existing = Array.isArray(media.gallery_assets) ? media.gallery_assets : [];
      media.gallery_assets = [...existing, ...previews];
      attrs.media = media;
      next.attrs = attrs;
      return next;
    });
    try {
      const assets = await Promise.all(
        preparedFiles.map((file) => fileToAsset(file, { assetKind: "media" }))
      );
      setDraft((prev) => {
        const next = { ...prev };
        const attrs = { ...(prev.attrs || {}) };
        const media = { ...(attrs.media || {}) };
        const existing = Array.isArray(media.gallery_assets) ? media.gallery_assets : [];
        const pending = [...existing];
        const merged = pending.map((asset) => {
          if (!asset || asset.url) return asset;
          const previewIndex = previews.findIndex(
            (preview) => preview.preview_url === asset.preview_url
          );
          if (previewIndex < 0) return asset;
          const uploaded = assets[previewIndex];
          return uploaded
            ? { ...uploaded, preview_url: previews[previewIndex].preview_url }
            : asset;
        });
        media.gallery_assets = merged;
        const uploadedUrls = assets.map((asset) => asset?.url).filter(Boolean);
        const currentUrls = Array.isArray(media.gallery) ? media.gallery.filter(Boolean) : [];
        media.gallery = Array.from(new Set([...currentUrls, ...uploadedUrls]));
        attrs.media = media;
        next.attrs = attrs;
        return next;
      });
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Gallery upload failed."));
    } finally {
      event.target.value = "";
    }
  };

  const clearMainMedia = () => {
    setDraft((prev) => {
      const next = { ...prev };
      const attrs = { ...(prev.attrs || {}) };
      const media = { ...(attrs.media || {}) };
      if (media.main_asset) revokePreview(media.main_asset);
      if (media.hero_asset) revokePreview(media.hero_asset);
      delete media.main_asset;
      delete media.main_url;
      delete media.hero_asset;
      delete media.hero_url;
      attrs.media = media;
      next.attrs = attrs;
      return next;
    });
  };

  const handleDocumentUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const staged = files.map((file) => ({
      name: file.name,
      type: file.type || "application/octet-stream",
      kind: "document"
    }));
    setDraft((prev) => {
      const next = { ...prev };
      const attrs = { ...(prev.attrs || {}) };
      const media = { ...(attrs.media || {}) };
      const existing = Array.isArray(media.document_assets) ? media.document_assets : [];
      media.document_assets = [...existing, ...staged];
      attrs.media = media;
      next.attrs = attrs;
      return next;
    });

    try {
      const assets = await Promise.all(
        files.map((file) => fileToAsset(file, { assetKind: "document" }))
      );
      setDraft((prev) => {
        const next = { ...prev };
        const attrs = { ...(prev.attrs || {}) };
        const media = { ...(attrs.media || {}) };
        const existing = Array.isArray(media.document_assets) ? media.document_assets : [];
        const merged = [...existing];
        assets.forEach((asset) => {
          const idx = merged.findIndex((item) => !item?.url && item?.name === asset.name);
          if (idx >= 0) merged[idx] = { ...merged[idx], ...asset };
          else merged.push(asset);
        });
        media.document_assets = merged;
        const uploadedUrls = assets.map((asset) => asset?.url).filter(Boolean);
        const currentUrls = Array.isArray(media.documents) ? media.documents.filter(Boolean) : [];
        media.documents = Array.from(new Set([...currentUrls, ...uploadedUrls]));
        attrs.media = media;
        next.attrs = attrs;
        return next;
      });
    } catch (err) {
      setStatusTone("error");
      setStatusMessage(formatApiError(err, "Document upload failed."));
    } finally {
      event.target.value = "";
    }
  };

  const removeDocumentAsset = (index) => {
    setDraft((prev) => {
      const next = { ...prev };
      const attrs = { ...(prev.attrs || {}) };
      const media = { ...(attrs.media || {}) };
      const existing = Array.isArray(media.document_assets) ? media.document_assets : [];
      const target = existing[index];
      media.document_assets = existing.filter((_, i) => i !== index);
      if (target?.url) {
        const urls = Array.isArray(media.documents) ? media.documents : [];
        media.documents = urls.filter((url) => url !== target.url);
      }
      attrs.media = media;
      next.attrs = attrs;
      return next;
    });
  };

  const toggleCurationTag = (tag) => {
    const normalized = String(tag || "").toLowerCase().trim();
    if (!normalized) return;
    const current = Array.isArray(draft?.attrs?.taxonomy?.tags) ? draft.attrs.taxonomy.tags : [];
    const lowered = current.map((item) => String(item || "").toLowerCase());
    const exists = lowered.includes(normalized);
    const next = exists
      ? current.filter((item) => String(item || "").toLowerCase() !== normalized)
      : [...current, normalized];
    updateDraft(["taxonomy", "tags"], next);
  };

  const applyProductCategorySelection = (categoryCode) => {
    const normalizedCode = normalizeProductCategoryCode(categoryCode);
    const category =
      (Array.isArray(productCategoryCatalog) ? productCategoryCatalog : []).find(
        (item) => normalizeProductCategoryCode(item?.code || "") === normalizedCode
      ) || null;
    setDraft((prev) => {
      const next = { ...prev };
      const attrs = { ...(prev.attrs || {}) };
      const taxonomy = { ...(attrs.taxonomy || {}) };
      if (!category) {
        delete taxonomy.category_code;
        delete taxonomy.category_label;
        delete taxonomy.category;
        delete taxonomy.subcategory_code;
        delete taxonomy.subcategory_label;
        delete taxonomy.subcategory;
      } else {
        taxonomy.category_code = category.code;
        taxonomy.category_label = category.label;
        taxonomy.category = category.label;
        const activeSubcategories = (Array.isArray(category.subcategories)
          ? category.subcategories
          : []
        )
          .filter((item) => item?.is_active !== false)
          .slice(0, 1);
        if (!activeSubcategories.length) {
          delete taxonomy.subcategory_code;
          delete taxonomy.subcategory_label;
          delete taxonomy.subcategory;
        } else {
          const first = activeSubcategories[0];
          taxonomy.subcategory_code = first.code;
          taxonomy.subcategory_label = first.label;
          taxonomy.subcategory = first.label;
        }
      }
      attrs.taxonomy = taxonomy;
      next.attrs = attrs;
      return next;
    });
  };

  const handleCreateProductCategory = async () => {
    const created = await createProductCategory(
      normalizeProductCategoryLabel(draft?.attrs?.taxonomy?.category || "")
    );
    if (!created?.code) return;
    applyProductCategorySelection(created.code);
  };

  const openBuyerPreview = () => {
    if (!draft?.code) {
      setStatusTone("error");
      setStatusMessage("Save the product first to generate preview URL.");
      return;
    }
    if (typeof window === "undefined") return;
    const base = String(ECOM_PREVIEW_BASE_URL || "").trim().replace(/\/$/, "");
    const previewUrl = `${base}/?page=patterns&preview=${encodeURIComponent(draft.code)}`;
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  const removeGalleryAsset = (index) => {
    setDraft((prev) => {
      const next = { ...prev };
      const attrs = { ...(prev.attrs || {}) };
      const media = { ...(attrs.media || {}) };
      const existing = Array.isArray(media.gallery_assets) ? media.gallery_assets : [];
      const target = existing[index];
      if (existing[index]) revokePreview(existing[index]);
      media.gallery_assets = existing.filter((_, i) => i !== index);
      if (target?.url) {
        const urls = Array.isArray(media.gallery) ? media.gallery : [];
        const urlIndex = urls.indexOf(target.url);
        if (urlIndex >= 0) {
          media.gallery = urls.filter((_, i) => i !== urlIndex);
        }
      }
      attrs.media = media;
      next.attrs = attrs;
      return next;
    });
  };

  const updatePricingTier = (index, key, value) => {
    setDraft((prev) => {
      const next = { ...prev };
      const attrs = { ...(prev.attrs || {}) };
      const pricing = { ...(attrs.pricing || {}) };
      const tiers = Array.isArray(pricing.tiers) ? [...pricing.tiers] : [];
      const row = { ...(tiers[index] || {}) };
      row[key] = value;
      tiers[index] = row;
      pricing.tiers = tiers;
      attrs.pricing = pricing;
      next.attrs = attrs;
      return next;
    });
  };

  const addPricingTier = () => {
    setDraft((prev) => {
      const next = { ...prev };
      const attrs = { ...(prev.attrs || {}) };
      const pricing = { ...(attrs.pricing || {}) };
      const tiers = Array.isArray(pricing.tiers) ? [...pricing.tiers] : [];
      tiers.push({
        currency: "USD",
        amount: null,
        compare_at: null,
        tax_rate: null,
        discount_pct: null,
        region: ""
      });
      pricing.tiers = tiers;
      attrs.pricing = pricing;
      next.attrs = attrs;
      return next;
    });
  };

  const removePricingTier = (index) => {
    setDraft((prev) => {
      const next = { ...prev };
      const attrs = { ...(prev.attrs || {}) };
      const pricing = { ...(attrs.pricing || {}) };
      const tiers = Array.isArray(pricing.tiers) ? [...pricing.tiers] : [];
      pricing.tiers = tiers.filter((_, i) => i !== index);
      attrs.pricing = pricing;
      next.attrs = attrs;
      return next;
    });
  };

  const listContent = useMemo(() => {
    if (loadingList) {
      return (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading products...
        </div>
      );
    }
    if (listError) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {listError}
        </div>
      );
    }
    if (!filteredProducts.length) {
      return (
        <div className="rounded-2xl border border-ink-100/60 bg-white/70 px-4 py-3 text-[0.7rem] text-ink-400">
          {products.length ? "No products match the current filters." : "No products yet."}
        </div>
      );
    }

    const startIndex = (page - 1) * pageSize + 1;
    const endIndex = Math.min(page * pageSize, filteredProducts.length);

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[0.6rem] text-ink-400">
          <span>
            Showing {startIndex}-{endIndex} of {filteredProducts.length}
          </span>
          <label className="flex items-center gap-2 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Per page
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="rounded-md border border-ink-100/70 bg-white/80 px-2 py-1 text-[0.6rem] font-semibold text-ink-600"
            >
              {[12, 25, 50].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="overflow-hidden rounded-2xl border border-ink-100/60 bg-white/60">
          <div className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 border-b border-ink-100/50 px-3 py-2 text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
            <div className="flex items-center justify-center">
              <input
                ref={masterCheckboxRef}
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(event) => toggleSelectAll(event.target.checked)}
                className="h-4 w-4 rounded border-ink-300 text-ink-900"
              />
            </div>
            <span>Product</span>
            <span className="text-right">Stock</span>
          </div>
          <div className="divide-y divide-ink-100/50">
            {pagedProducts.map((item) => {
              const active = item.id === selectedId;
              const thumb = pickThumbnail(item);
              const stock = resolveProductStock(item.attrs);
              const inStock = stock > 0;
              const itemStage = productStage(item);
              const rejected = itemStage === "rejected";
              const category = item.attrs?.taxonomy?.category || "";
              const tags = Array.isArray(item.attrs?.taxonomy?.tags)
                ? item.attrs.taxonomy.tags.join(", ")
                : "";
              const tier = Array.isArray(item.attrs?.pricing?.tiers) ? item.attrs.pricing.tiers[0] : null;
              const priceLabel =
                tier && tier.amount !== null && tier.amount !== undefined
                  ? `${tier.currency || "USD"} ${tier.amount}`
                  : "";
              const itemBaseCode = String(item.attrs?.inventory?.sku || item.code || "")
                .trim()
                .toUpperCase();
              const variantSummary = summarizeProductVariants(item.attrs?.variants);
              const metaParts = [category, priceLabel, tags].filter(Boolean).join(" | ");
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setSelectedId(item.id);
                    }
                  }}
                  className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left transition ${
                    active
                      ? "bg-ink-900 text-white"
                      : "bg-transparent text-ink-600 hover:bg-white/70"
                  }`}
                >
                  <div
                    className="flex items-center justify-center"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelectOne(item.id)}
                      className={`h-4 w-4 rounded border-ink-300 text-ink-900 ${
                        active ? "bg-white" : ""
                      }`}
                    />
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border ${
                        active ? "border-white/20 bg-white/10" : "border-ink-100/60 bg-white/70"
                      }`}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={item.title || "Product"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Image className={`${active ? "text-white" : "text-ink-300"} h-4 w-4`} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[0.55rem] uppercase tracking-[0.25em] ${
                        active ? "text-white/70" : "text-ink-400"
                      }`}>
                        {itemBaseCode || "NO-CODE"}
                      </p>
                      {variantSummary.activeCount > 0 ? (
                        <p
                          className={`mt-0.5 truncate text-[0.58rem] ${
                            active ? "text-white/70" : "text-ink-400"
                          }`}
                          title={`${variantSummary.activeCount} active variants`}
                        >
                          {variantSummary.activeCount} active variant
                          {variantSummary.activeCount === 1 ? "" : "s"}
                        </p>
                      ) : null}
                      <p className="text-[0.85rem] font-semibold">
                        {item.title || "Untitled product"}
                      </p>
                      {metaParts ? (
                        <p className={`mt-1 text-[0.65rem] ${
                          active ? "text-white/70" : "text-ink-400"
                        }`}>
                          {metaParts}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[0.7rem] ${active ? "text-white/70" : "text-ink-500"}`}>{rejected ? "Review" : stock}</p>
                    <span
                      className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.2em] ${
                        rejected
                          ? active
                            ? "bg-rose-400/30 text-white"
                            : "bg-rose-100 text-rose-700"
                          : inStock
                          ? active
                            ? "bg-emerald-400/30 text-white"
                            : "bg-emerald-100 text-emerald-700"
                          : active
                            ? "bg-rose-400/30 text-white"
                            : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {rejected ? "Rejected" : inStock ? "In stock" : "Out of stock"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  }, [
    loadingList,
    listError,
    filteredProducts,
    products,
    pagedProducts,
    selectedId,
    selectedIds,
    page,
    pageSize,
    totalPages,
    pageNumbers,
    allVisibleSelected,
    toggleSelectAll,
    toggleSelectOne
  ]);

  const listFooter = useMemo(() => {
    if (loadingList || listError || !filteredProducts.length) {
      return null;
    }

    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.6rem] text-ink-400">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="rounded-full border border-ink-100/70 bg-white/70 px-2 py-1 text-[0.6rem] font-semibold text-ink-500 disabled:opacity-50"
          >
            Prev
          </button>
          {pageNumbers.map((value) =>
            typeof value === "string" ? (
              <span key={value} className="px-1 text-[0.6rem] text-ink-400">
                ...
              </span>
            ) : (
              <button
                key={value}
                type="button"
                onClick={() => setPage(value)}
                className={`rounded-full px-2 py-1 text-[0.6rem] font-semibold ${
                  page === value
                    ? "bg-ink-900 text-white"
                    : "border border-ink-100/70 bg-white/70 text-ink-500"
                }`}
              >
                {value}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages}
            className="rounded-full border border-ink-100/70 bg-white/70 px-2 py-1 text-[0.6rem] font-semibold text-ink-500 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    );
  }, [filteredProducts.length, listError, loadingList, page, pageNumbers, totalPages]);

  const storefrontListFooter = useMemo(() => {
    if (storefrontListLoading || storefrontListError || storefrontTotal <= 0) {
      return null;
    }
    const start = storefrontTotal ? (storefrontPage - 1) * storefrontPageSize + 1 : 0;
    const end = Math.min(storefrontPage * storefrontPageSize, storefrontTotal);
    return (
      <div className="space-y-2 text-[0.6rem] text-ink-400">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Showing {start}-{end} of {storefrontTotal}
          </span>
          <label className="flex items-center gap-2 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Per page
            <select
              value={storefrontPageSize}
              onChange={(event) => setStorefrontPageSize(Number(event.target.value))}
              className="rounded-md border border-ink-100/70 bg-white/80 px-2 py-1 text-[0.6rem] font-semibold text-ink-600"
            >
              {[12, 25, 50].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Page {storefrontPage} of {storefrontTotalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setStorefrontPage((prev) => Math.max(1, prev - 1))}
              disabled={storefrontPage === 1}
              className="rounded-full border border-ink-100/70 bg-white/70 px-2 py-1 text-[0.6rem] font-semibold text-ink-500 disabled:opacity-50"
            >
              Prev
            </button>
            {storefrontPageNumbers.map((value) =>
              typeof value === "string" ? (
                <span key={value} className="px-1 text-[0.6rem] text-ink-400">
                  ...
                </span>
              ) : (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStorefrontPage(value)}
                  className={`rounded-full px-2 py-1 text-[0.6rem] font-semibold ${
                    storefrontPage === value
                      ? "bg-ink-900 text-white"
                      : "border border-ink-100/70 bg-white/70 text-ink-500"
                  }`}
                >
                  {value}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() =>
                setStorefrontPage((prev) => Math.min(storefrontTotalPages, prev + 1))
              }
              disabled={storefrontPage === storefrontTotalPages}
              className="rounded-full border border-ink-100/70 bg-white/70 px-2 py-1 text-[0.6rem] font-semibold text-ink-500 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  }, [
    storefrontListError,
    storefrontListLoading,
    storefrontPage,
    storefrontPageNumbers,
    storefrontPageSize,
    storefrontTotal,
    storefrontTotalPages
  ]);

  const storefrontBlogListFooter = useMemo(() => {
    if (storefrontBlogLoading || storefrontBlogError || storefrontBlogTotal <= 0) {
      return null;
    }
    const start = storefrontBlogTotal ? (storefrontBlogPage - 1) * storefrontBlogPageSize + 1 : 0;
    const end = Math.min(storefrontBlogPage * storefrontBlogPageSize, storefrontBlogTotal);
    return (
      <div className="space-y-2 text-[0.6rem] text-ink-400">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Showing {start}-{end} of {storefrontBlogTotal}
          </span>
          <label className="flex items-center gap-2 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Per page
            <select
              value={storefrontBlogPageSize}
              onChange={(event) => setStorefrontBlogPageSize(Number(event.target.value))}
              className="rounded-md border border-ink-100/70 bg-white/80 px-2 py-1 text-[0.6rem] font-semibold text-ink-600"
            >
              {[12, 25, 50].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Page {storefrontBlogPage} of {storefrontBlogTotalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setStorefrontBlogPage((prev) => Math.max(1, prev - 1))}
              disabled={storefrontBlogPage === 1}
              className="rounded-full border border-ink-100/70 bg-white/70 px-2 py-1 text-[0.6rem] font-semibold text-ink-500 disabled:opacity-50"
            >
              Prev
            </button>
            {storefrontBlogPageNumbers.map((value) =>
              typeof value === "string" ? (
                <span key={value} className="px-1 text-[0.6rem] text-ink-400">
                  ...
                </span>
              ) : (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStorefrontBlogPage(value)}
                  className={`rounded-full px-2 py-1 text-[0.6rem] font-semibold ${
                    storefrontBlogPage === value
                      ? "bg-ink-900 text-white"
                      : "border border-ink-100/70 bg-white/70 text-ink-500"
                  }`}
                >
                  {value}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setStorefrontBlogPage((prev) => Math.min(storefrontBlogTotalPages, prev + 1))}
              disabled={storefrontBlogPage === storefrontBlogTotalPages}
              className="rounded-full border border-ink-100/70 bg-white/70 px-2 py-1 text-[0.6rem] font-semibold text-ink-500 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  }, [
    storefrontBlogError,
    storefrontBlogLoading,
    storefrontBlogPage,
    storefrontBlogPageNumbers,
    storefrontBlogPageSize,
    storefrontBlogTotal,
    storefrontBlogTotalPages
  ]);

  const pageContentListFooter = useMemo(() => {
    if (pageContentLoading || pageContentListError || pageContentTotal <= 0) {
      return null;
    }
    const start = pageContentTotal ? (pageContentPage - 1) * pageContentPageSize + 1 : 0;
    const end = Math.min(pageContentPage * pageContentPageSize, pageContentTotal);
    return (
      <div className="space-y-2 text-[0.6rem] text-ink-400">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Showing {start}-{end} of {pageContentTotal}
          </span>
          <label className="flex items-center gap-2 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
            Per page
            <select
              value={pageContentPageSize}
              onChange={(event) => setPageContentPageSize(Number(event.target.value))}
              className="rounded-md border border-ink-100/70 bg-white/80 px-2 py-1 text-[0.6rem] font-semibold text-ink-600"
            >
              {[12, 25, 50].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Page {pageContentPage} of {pageContentTotalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPageContentPage((prev) => Math.max(1, prev - 1))}
              disabled={pageContentPage === 1}
              className="rounded-full border border-ink-100/70 bg-white/70 px-2 py-1 text-[0.6rem] font-semibold text-ink-500 disabled:opacity-50"
            >
              Prev
            </button>
            {pageContentPageNumbers.map((value) =>
              typeof value === "string" ? (
                <span key={value} className="px-1 text-[0.6rem] text-ink-400">
                  ...
                </span>
              ) : (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPageContentPage(value)}
                  className={`rounded-full px-2 py-1 text-[0.6rem] font-semibold ${
                    pageContentPage === value
                      ? "bg-ink-900 text-white"
                      : "border border-ink-100/70 bg-white/70 text-ink-500"
                  }`}
                >
                  {value}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setPageContentPage((prev) => Math.min(pageContentTotalPages, prev + 1))}
              disabled={pageContentPage === pageContentTotalPages}
              className="rounded-full border border-ink-100/70 bg-white/70 px-2 py-1 text-[0.6rem] font-semibold text-ink-500 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  }, [
    pageContentListError,
    pageContentLoading,
    pageContentPage,
    pageContentPageNumbers,
    pageContentPageSize,
    pageContentTotal,
    pageContentTotalPages
  ]);

  const sectionItems = useMemo(
    () =>
      contentStudioOnly
        ? [{ id: "storefront", label: "Content Studio", icon: LayoutTemplate }]
        : [
            { id: "basics", label: "Basics", icon: Box },
            { id: "categories", label: "Categories & tags", icon: ClipboardCheck },
            { id: "variants", label: "Variants", icon: LayoutTemplate },
            { id: "seo", label: "SEO & media data", icon: Search },
            { id: "media", label: "Media files", icon: Image },
            { id: "pricing", label: "Pricing", icon: CircleDot },
            ...(currentProductIsDigital ? [] : [{ id: "inventory", label: "Initial inventory", icon: Box }]),
            { id: "reviews", label: "Reviews", icon: MessageSquare }
          ],
    [contentStudioOnly, currentProductIsDigital]
  );

  useEffect(() => {
    if (sectionItems.some((item) => item.id === activeSection)) return;
    setActiveSection(sectionItems[0]?.id || "basics");
  }, [activeSection, sectionItems]);

  const storefrontSourceMode = String(storefrontDraft?.attrs?.source_mode || "").trim().toLowerCase();
  const storefrontProductSource =
    storefrontDraft?.attrs?.product_source && typeof storefrontDraft.attrs.product_source === "object"
      ? storefrontDraft.attrs.product_source
      : {};
  const storefrontProductDriven = Boolean(storefrontSourceMode);

  const storefrontEditor = (
    <div className="space-y-3">
      <div className="rounded-2xl border border-ink-100/70 bg-white/70 p-3">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-ink-400">
          Slot
        </p>
        <p className="mt-1 text-[0.8rem] font-semibold text-ink-700">
          {storefrontDraft.slot || "home.hero"}
        </p>
      </div>
      <Field
        label="Section title"
        value={storefrontDraft.title || ""}
        onChange={(value) => updateStorefrontField("title", value)}
      />
      <Field
        label="Category"
        type="select"
        value={storefrontDraft.category_code || ""}
        onChange={async (value) => {
          if (value === CATEGORY_CREATE_OPTION) {
            const created = await createStorefrontCategory();
            if (!created) return;
            updateStorefrontField("category_code", created);
            return;
          }
          updateStorefrontField("category_code", value);
        }}
        options={storefrontCategoryOptions}
        disabled={storefrontCategoriesLoading}
      />
      <Field
        type="checkbox"
        label="Active in storefront"
        checked={storefrontDraft.is_active !== false}
        onChange={(value) => updateStorefrontField("is_active", value)}
      />
      <div className="grid gap-2 md:grid-cols-2">
        <Field
          label="Renderer descriptor"
          type="select"
          value={storefrontDraft?.attrs?.renderer_type || ""}
          onChange={(value) => updateStorefrontAttr("renderer_type", value)}
          options={[
            { value: "", label: "Auto from mapping" },
            ...storefrontMappingUi.rendererOptions
          ]}
        />
        <Field
          label="Placement source"
          type="select"
          value={storefrontSourceMode}
          onChange={(value) => {
            updateStorefrontAttr("source_mode", value);
            updateStorefrontProductSource("mode", value);
          }}
          options={storefrontMappingUi.productSourceModes}
        />
      </div>
      {storefrontProductDriven ? (
        <div className="grid gap-2 rounded-2xl border border-ink-100/70 bg-white/70 p-3 md:grid-cols-2">
          <Field
            label="Product tag / collection"
            value={storefrontProductSource.tag || storefrontProductSource.collection_code || ""}
            onChange={(value) => updateStorefrontProductSource("tag", value)}
            placeholder="worth, featured, spring-drop..."
          />
          <Field
            label="Maximum products"
            type="number"
            value={storefrontProductSource.limit || 24}
            onChange={(value) => updateStorefrontProductSource("limit", Math.max(1, Math.min(100, Number(value) || 24)))}
          />
          <Field
            label="Manual / include product codes"
            value={(
              storefrontSourceMode === "manual_products"
                ? storefrontProductSource.product_codes || []
                : storefrontProductSource.include_product_codes || []
            ).join(", ")}
            onChange={(value) =>
              updateStorefrontProductSource(
                storefrontSourceMode === "manual_products" ? "product_codes" : "include_product_codes",
                String(value || "").split(",").map((item) => item.trim()).filter(Boolean)
              )
            }
            placeholder="SKU-001, SKU-002"
          />
          <Field
            label="Exclude product codes"
            value={(storefrontProductSource.exclude_product_codes || []).join(", ")}
            onChange={(value) =>
              updateStorefrontProductSource(
                "exclude_product_codes",
                String(value || "").split(",").map((item) => item.trim()).filter(Boolean)
              )
            }
            placeholder="SKU-ARCHIVED"
          />
          <p className="text-[0.68rem] text-ink-500 md:col-span-2">
            Product Studio remains the source of product cards. This slot stores only placement and selection rules.
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-ink-400">
          {storefrontMode === "cards" ? "Cards" : "Slides"}
        </p>
        <button
          type="button"
          onClick={addStorefrontSlide}
          className="inline-flex items-center gap-1 rounded-full border border-ink-100/70 bg-white/80 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-600"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          {storefrontMode === "cards" ? "Add card" : "Add slide"}
        </button>
      </div>

      {storefrontLoading ? (
        <div className="rounded-xl border border-dashed border-ink-200/70 bg-white/60 px-4 py-6 text-center text-xs text-ink-400">
          Loading storefront content...
        </div>
      ) : (
        <div className="space-y-3">
          {(Array.isArray(storefrontDraft.slides) ? storefrontDraft.slides : []).map((slide, index) => {
            const slidePreviewUrl = resolveAssetUrl(slide.image || "");
            return (
            <article
              key={`${slide.id || "slide"}-${index}`}
              className="space-y-2 rounded-2xl border border-ink-100/70 bg-white/80 p-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  {storefrontMode === "cards" ? "Card" : "Slide"} {index + 1}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveStorefrontSlide(index, -1)}
                    disabled={index === 0}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-ink-100/70 bg-white text-ink-600 disabled:opacity-40"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStorefrontSlide(index, 1)}
                    disabled={index === storefrontDraft.slides.length - 1}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-ink-100/70 bg-white text-ink-600 disabled:opacity-40"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStorefrontSlide(index)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <Field
                    label={storefrontMode === "cards" ? "Image URL (optional)" : "Image URL"}
                    value={slide.image || ""}
                    onChange={(value) => updateStorefrontSlideField(index, "image", value)}
                    placeholder="/assets/... or https://..."
                  />
                  <label className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-full border border-ink-100/70 bg-white/80 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-600 hover:bg-white">
                    {storefrontUploadingIndex === index ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="h-3.5 w-3.5" />
                    )}
                    {storefrontUploadingIndex === index ? "Uploading..." : "Upload image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => handleStorefrontSlideUpload(index, event)}
                    />
                  </label>
                </div>
                {storefrontMode === "hero" ? (
                  <Field
                    label="Overlay"
                    type="select"
                    value={slide.overlay || "left"}
                    onChange={(value) => updateStorefrontSlideField(index, "overlay", value)}
                    options={[
                      { value: "left", label: "Left" },
                      { value: "center", label: "Center" }
                    ]}
                  />
                ) : null}
              </div>
              {storefrontMode === "hero" ? (
                <>
                  <div className="grid gap-2 md:grid-cols-4">
                    <Field
                      label="Image fit"
                      type="select"
                      value={slide.fit || "cover"}
                      onChange={(value) => updateStorefrontSlideField(index, "fit", value)}
                      options={[
                        { value: "cover", label: "Cover" },
                        { value: "contain", label: "Contain" }
                      ]}
                    />
                    <Field
                      label="Focus X %"
                      type="number"
                      value={slide.focus_x ?? 50}
                      onChange={(value) => updateStorefrontSlideField(index, "focus_x", clampPercent(value, 50))}
                      hint="0 = left, 100 = right"
                    />
                    <Field
                      label="Focus Y %"
                      type="number"
                      value={slide.focus_y ?? 50}
                      onChange={(value) => updateStorefrontSlideField(index, "focus_y", clampPercent(value, 50))}
                      hint="0 = top, 100 = bottom"
                    />
                    <Field
                      label="Overlay %"
                      type="number"
                      value={slide.overlay_strength ?? 78}
                      onChange={(value) =>
                        updateStorefrontSlideField(index, "overlay_strength", clampPercent(value, 78))
                      }
                      hint="Text readability"
                    />
                  </div>
                  <div className="rounded-xl border border-ink-100/70 bg-ink-50/60 p-2">
                    <div
                      className="h-44 md:h-56 rounded-lg border border-ink-100/60 bg-white"
                      style={{
                        backgroundImage: slidePreviewUrl ? `url(${slidePreviewUrl})` : "none",
                        backgroundSize: slide.fit === "contain" ? "contain" : "cover",
                        backgroundPosition: `${clampPercent(slide.focus_x, 50)}% ${clampPercent(slide.focus_y, 50)}%`,
                        backgroundRepeat: "no-repeat",
                        backgroundColor: "#eee6dd"
                      }}
                    />
                  </div>
                </>
              ) : null}
              <div className="grid gap-2 md:grid-cols-2">
                <Field
                  label="Eyebrow"
                  value={slide.eyebrow || ""}
                  onChange={(value) => updateStorefrontSlideField(index, "eyebrow", value)}
                />
                <Field
                  label="Title"
                  value={slide.title || ""}
                  onChange={(value) => updateStorefrontSlideField(index, "title", value)}
                />
              </div>
              <Field
                label={storefrontMode === "cards" ? "Summary / teaser" : "Subtitle"}
                type="textarea"
                value={slide.subtitle || ""}
                onChange={(value) => updateStorefrontSlideField(index, "subtitle", value)}
                rows={storefrontMode === "cards" ? 6 : 4}
              />
              <Field
                label="Article body"
                type="textarea"
                value={slide.body || ""}
                onChange={(value) => updateStorefrontSlideField(index, "body", value)}
                rows={16}
                hint="Long-form content block. Use paragraphs and line breaks for magazine-style sections."
              />
              <div className="grid gap-2 md:grid-cols-2">
                <Field
                  label="CTA label"
                  value={slide.cta_label || ""}
                  onChange={(value) => updateStorefrontSlideField(index, "cta_label", value)}
                />
                <Field
                  label="CTA action"
                  type="select"
                  value={slide.cta_action || "navigate_internal"}
                  onChange={(value) => {
                    const nextAction =
                      value === "navigate_external" || value === "scroll_to"
                        ? value
                        : "navigate_internal";
                    updateStorefrontSlideField(index, "cta_action", nextAction);
                  }}
                  options={[
                    { value: "navigate_internal", label: "Internal page" },
                    { value: "navigate_external", label: "External URL" },
                    { value: "scroll_to", label: "Scroll to section" }
                  ]}
                />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Field
                  label={
                    (slide.cta_action || "navigate_internal") === "navigate_external"
                      ? "External URL"
                      : (slide.cta_action || "navigate_internal") === "scroll_to"
                        ? "Section target (example: #worth)"
                        : "Internal path"
                  }
                  value={slide.cta_target || slide.cta_url || ""}
                  onChange={(value) => {
                    updateStorefrontSlideField(index, "cta_target", value);
                    updateStorefrontSlideField(index, "cta_url", value);
                  }}
                  placeholder={
                    (slide.cta_action || "navigate_internal") === "navigate_external"
                      ? "https://..."
                      : (slide.cta_action || "navigate_internal") === "scroll_to"
                        ? "#drop"
                        : "/patterns"
                  }
                />
                <Field
                  type="checkbox"
                  label="Open in new tab"
                  checked={Boolean(slide.cta_new_tab)}
                  onChange={(value) => updateStorefrontSlideField(index, "cta_new_tab", value)}
                />
              </div>
            </article>
            );
          })}
        </div>
      )}

    </div>
  );

  const activeSectionMeta = sectionItems.find((item) => item.id === activeSection) || sectionItems[0];

  if (contentStudioOnly) {
    return (
      <section className="space-y-4">
        <div className="glass-panel flex flex-wrap items-center justify-between gap-4 border border-ink-100/60 bg-white/70 p-5">
          <div>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">E-commerce</p>
            <h2 className="text-lg font-semibold text-ink-900">Content Studio</h2>
            <p className="mt-1 text-[0.85rem] text-ink-500">
              Manage storefront and non-product page content independently from the product catalog.
            </p>
          </div>
        <button
          type="button"
          onClick={async () => {
              await loadTranslationServiceStatus();
              await loadStorefrontStudioTabs();
              await loadStorefrontCategories();
              const items = await loadStorefrontConnections();
              const hasEligible = Array.isArray(items) && items.some((item) => item?.scan_eligible);
            if (hasEligible) {
              await loadStorefrontStructure();
            } else {
              setStorefrontStructure(null);
            }
            await loadStorefrontList(storefrontQuery, storefrontPage, storefrontPageSize);
            await loadStorefrontContent(selectedStorefrontSlot);
            await loadStorefrontBlogPosts();
            await loadPageContentList(pageContentQuery, pageContentPage, pageContentPageSize, pageContentStatus);
          }}
            className="inline-flex items-center gap-2 rounded-full border border-ink-100/70 bg-white/70 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-600"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {translationService.checked ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-xs ${
              translationService.available
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {translationService.available
              ? "Translation service connected."
              : "Translation service offline."}
          </div>
        ) : null}

        {statusMessage ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-xs ${
              statusTone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {statusMessage}
          </div>
        ) : null}

        <div className="glass-panel flex flex-wrap items-center gap-2 border border-ink-100/60 bg-white/70 p-3">
          {contentStudioTabs.map((tab) => {
            const Icon = tab.icon;
            const active = contentStudioTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setContentStudioTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] ${
                  active
                    ? "bg-ink-900 text-white shadow-soft"
                    : "border border-ink-100/70 bg-white/80 text-ink-600"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={openStorefrontStudioTabsModal}
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-ink-100/70 bg-white/80 px-3 py-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-ink-600"
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            {storefrontStudioTabsLoading ? "Loading..." : "Manage tabs"}
          </button>
        </div>

        {contentStudioTab === "blocks" || contentStudioTab.startsWith("cat:") ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,30%)_minmax(0,1fr)]">
          <aside className="glass-panel flex h-[calc(100vh-4.4rem)] min-h-[75rem] flex-col border border-ink-100/60 bg-white/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">Content library</p>
              <div className="flex items-center gap-2">
                {selectedCategoryTabCode ? (
                  <span className="rounded-full border border-ink-100/70 bg-white/70 px-2 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.2em] text-ink-500">
                    {storefrontCategoryByCode.get(selectedCategoryTabCode) || selectedCategoryTabCode}
                  </span>
                ) : null}
                <span className="rounded-full border border-ink-100/70 bg-white/70 px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-ink-500">
                  {storefrontTotal}
                </span>
                <button
                  type="button"
                  onClick={() => setShowStorefrontNew((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-100/70 bg-white/80 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-600"
                >
                  <FilePlus2 className="h-3 w-3" />
                  New
                </button>
              </div>
            </div>
            <label className="mt-3 block text-[0.55rem] font-semibold uppercase tracking-[0.24em] text-ink-400">
              Search
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-ink-100/60 bg-white/65 px-3 py-2 text-[0.7rem] text-ink-500">
                <Search className="h-4 w-4 text-ink-400" />
                <input
                  value={storefrontQuery}
                  onChange={(event) => {
                    setStorefrontQuery(event.target.value);
                  }}
                  placeholder="Search slot or title..."
                  className="w-full bg-transparent text-[0.8rem] text-ink-700 outline-none"
                />
              </div>
            </label>

            <div className="mt-3 rounded-2xl border border-ink-100/60 bg-white/75 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.24em] text-ink-500">
                  {storefrontMappingUi.title}
                </p>
                <button
                  type="button"
                  onClick={scanStorefrontStructure}
                  disabled={storefrontStructureScanning || !storefrontConnectionOptions.length}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-100/70 bg-white/80 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {storefrontStructureScanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {storefrontStructureScanning
                    ? storefrontMappingUi.scanningLabel
                    : storefrontMappingUi.scanButtonLabel}
                </button>
              </div>
              <label className="mt-2 block text-[0.55rem] font-semibold uppercase tracking-[0.22em] text-ink-400">
                {storefrontMappingUi.connectionLabel}
                <select
                  value={selectedStorefrontConnectionCode}
                  onChange={(event) => setSelectedStorefrontConnectionCode(event.target.value)}
                  disabled={storefrontConnectionsLoading || !storefrontConnectionOptions.length}
                  className="mt-1 w-full rounded-xl border border-ink-100/70 bg-white/90 px-2 py-2 text-[0.72rem] uppercase tracking-[0.16em] text-ink-700 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {storefrontConnectionOptions.length ? null : (
                    <option value="">
                      {storefrontConnectionsLoading
                        ? storefrontMappingUi.connectionLoadingLabel
                        : storefrontMappingUi.connectionEmptyLabel}
                    </option>
                  )}
                  {storefrontConnectionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-2 block text-[0.55rem] font-semibold uppercase tracking-[0.22em] text-ink-400">
                {storefrontMappingUi.modeLabel}
                <select
                  value={storefrontScanMode}
                  onChange={(event) => setStorefrontScanMode(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-ink-100/70 bg-white/90 px-2 py-2 text-[0.72rem] uppercase tracking-[0.16em] text-ink-700 outline-none"
                >
                  {storefrontScanModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <p className="mt-1 text-[0.65rem] text-ink-500">
                {storefrontConnectionsLoading
                  ? "Loading connections..."
                  : `${storefrontEligibleConnectionCount} of ${storefrontConnections.length} connections ready for scan`}
              </p>
              <p className="mt-2 text-[0.68rem] text-ink-500">
                {storefrontStructureLoading
                  ? storefrontMappingUi.structureLoadingLabel
                  : storefrontStructure?.usable_candidate_count
                    ? `${storefrontStructure.usable_candidate_count} usable zones detected`
                    : storefrontMappingUi.structureEmptyLabel}
              </p>
              {storefrontStructure?.project_path ? (
                <p className="mt-1 text-[0.62rem] uppercase tracking-[0.18em] text-ink-400">
                  {storefrontStructure.project_path}
                </p>
              ) : null}
              {storefrontStructure?.connection_code ? (
                <p className="mt-1 text-[0.62rem] uppercase tracking-[0.18em] text-ink-400">
                  Connection: {storefrontStructure.connection_code}
                </p>
              ) : null}
              {storefrontStructure?.source_kind ? (
                <p className="mt-1 text-[0.62rem] uppercase tracking-[0.18em] text-ink-400">
                  Source: {storefrontStructure.source_kind}
                </p>
              ) : null}
              {storefrontStructure ? (
                <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-ink-100/60 bg-white/75 px-2.5 py-2 text-[0.58rem] text-ink-500">
                  <span>{storefrontMappingUi.diagnostics.renderedAvailable}</span><strong className="text-right text-ink-700">{storefrontStructure.rendered_dom_available ? "Yes" : "No"}</strong>
                  <span>{storefrontMappingUi.diagnostics.renderedCandidates}</span><strong className="text-right text-ink-700">{storefrontStructure.rendered_dom_candidate_count || 0}</strong>
                  <span>{storefrontMappingUi.diagnostics.staticCandidates}</span><strong className="text-right text-ink-700">{storefrontStructure.generic_candidate_count || 0}</strong>
                  <span>{storefrontMappingUi.diagnostics.taggedCandidates}</span><strong className="text-right text-ink-700">{storefrontStructure.tagged_candidate_count || 0}</strong>
                  <span>{storefrontMappingUi.diagnostics.usableCandidates}</span><strong className="text-right text-ink-700">{storefrontStructure.usable_candidate_count || 0}</strong>
                  {storefrontStructure.rendered_dom_error ? <><span>{storefrontMappingUi.diagnostics.renderedError}</span><strong className="truncate text-right text-rose-600">{storefrontStructure.rendered_dom_error}</strong></> : null}
                  {storefrontStructure.fallback_recommendation ? <><span>{storefrontMappingUi.diagnostics.recommendation}</span><strong className="truncate text-right text-amber-700">{storefrontStructure.fallback_recommendation}</strong></> : null}
                </div>
              ) : null}
              {storefrontStructureMappingRows.length ? (
                <div className="mt-3 rounded-xl border border-ink-100/60 bg-white/75 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[0.55rem] font-semibold uppercase tracking-[0.22em] text-ink-500">
                      {storefrontMappingUi.zoneMappingLabel}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowStorefrontMappingModal(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-ink-100/80 bg-white px-2.5 py-1 text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-ink-600"
                    >
                      {storefrontMappingUi.viewMapLabel}
                    </button>
                  </div>
                  <p className="mt-1 text-[0.62rem] text-ink-500">
                    {storefrontStructureMappingRows.filter((row) => row.mappedCount > 0).length}/
                    {storefrontStructureMappingRows.length} zones content-mapped
                  </p>
                </div>
              ) : null}
            </div>

            {showStorefrontNew ? (
              <form
                onSubmit={createStorefrontContent}
                className="mt-3 space-y-2 rounded-2xl border border-ink-100/60 bg-white/75 p-3"
              >
                <Field
                  label="Parent tag"
                  type="select"
                  value={newStorefront.slot}
                  onChange={(value) => setNewStorefront((prev) => ({ ...prev, slot: value }))}
                  options={[
                    {
                      value: "",
                      label: storefrontStructureSlotOptions.length ? "Select scanned tag..." : "Run structure scan first"
                    },
                    ...storefrontStructureSlotOptions
                  ]}
                  disabled={!storefrontStructureSlotOptions.length}
                  size="sm"
                />
                <Field
                  label="Title"
                  value={newStorefront.title}
                  onChange={(value) => setNewStorefront((prev) => ({ ...prev, title: value }))}
                  placeholder="Content title"
                  size="sm"
                />
                <Field
                  label="Category"
                  type="select"
                  value={newStorefront.category_code || ""}
                  onChange={async (value) => {
                    if (value === CATEGORY_CREATE_OPTION) {
                      const created = await createStorefrontCategory();
                      if (!created) return;
                      setNewStorefront((prev) => ({ ...prev, category_code: created }));
                      return;
                    }
                    setNewStorefront((prev) => ({ ...prev, category_code: value }));
                  }}
                  options={storefrontCategoryOptions}
                  disabled={storefrontCategoriesLoading}
                  size="sm"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!storefrontStructureSlotOptions.length}
                    className="inline-flex items-center gap-1 rounded-full bg-ink-900 px-3 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-white"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStorefrontNew(false);
                      setNewStorefront({ slot: "", title: "", category_code: "" });
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-ink-100/70 bg-white/80 px-3 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-ink-500"
                  >
                    <X className="h-3.5 w-3.5" />
                    Close
                  </button>
                </div>
              </form>
            ) : null}

            <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {storefrontListLoading ? (
                <div className="rounded-xl border border-dashed border-ink-200/70 bg-white/60 px-4 py-6 text-center text-xs text-ink-400">
                  Loading content...
                </div>
              ) : null}
              {!storefrontListLoading && storefrontListError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {storefrontListError}
                </div>
              ) : null}
              {!storefrontListLoading && !storefrontListError && !storefrontItems.length ? (
                <div className="rounded-xl border border-dashed border-ink-200/70 bg-white/60 px-4 py-6 text-center text-xs text-ink-400">
                  No content found.
                </div>
              ) : null}
              {!storefrontListLoading && !storefrontListError
                ? storefrontItems.map((item) => {
                    const active =
                      normalizeStorefrontSlot(item.slot) === normalizeStorefrontSlot(selectedStorefrontSlot);
                    const slotKey = normalizeStorefrontSlot(item.slot);
                    const preset = getConfiguredStorefrontSlotPreset(slotKey);
                    const mappedZone = storefrontStructureZoneByTag.get(slotKey);
                    const itemStage = String(item?.attrs?.workflow?.stage || item?.status || "new").toLowerCase();
                    return (
                      <button
                        key={item.id || item.slot}
                        type="button"
                        onClick={() => setSelectedStorefrontSlot(normalizeStorefrontSlot(item.slot))}
                        className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                          active
                            ? "border-ink-900 bg-ink-900 text-white shadow-soft"
                            : "border-ink-100/70 bg-white/80 text-ink-700 hover:bg-white"
                        }`}
                      >
                        <p className={`text-[0.55rem] font-semibold uppercase tracking-[0.24em] ${active ? "text-white/70" : "text-ink-400"}`}>
                          {slotKey || "home.hero"}
                        </p>
                        <p className="mt-1 text-[0.85rem] font-semibold">{item.title || "Untitled content"}</p>
                        {mappedZone?.label ? (
                          <p className={`mt-1 text-[0.68rem] ${active ? "text-white/70" : "text-ink-500"}`}>
                            {mappedZone.label}
                          </p>
                        ) : preset?.description ? (
                          <p className={`mt-1 text-[0.68rem] ${active ? "text-white/70" : "text-ink-500"}`}>
                            {preset.description}
                          </p>
                        ) : null}
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <div className={`text-[0.65rem] ${active ? "text-white/70" : "text-ink-500"}`}>
                            <p>{Array.isArray(item.slides) ? item.slides.length : 0} slide(s)</p>
                            {item.category_label || item.category_code ? (
                              <p className="mt-0.5 uppercase tracking-[0.16em]">
                                {item.category_label || item.category_code}
                              </p>
                            ) : null}
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[0.52rem] font-semibold uppercase tracking-[0.2em] ${
                              active ? "bg-white/20 text-white/80" : "bg-ink-100 text-ink-600"
                            }`}
                          >
                            {itemStage || "draft"}
                          </span>
                        </div>
                      </button>
                    );
                  })
                : null}
            </div>
            {storefrontListFooter ? (
              <div className="mt-3 border-t border-ink-100/60 pt-3">{storefrontListFooter}</div>
            ) : null}
          </aside>

          <section className="space-y-4">
            <div className="glass-panel border border-ink-100/60 bg-white/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">
                    Selected content
                  </p>
                  <h3 className="text-[1rem] font-semibold text-ink-900">
                    {storefrontDraft?.title || "Select content"}
                  </h3>
                  <p className="mt-1 text-[0.72rem] text-ink-500">
                    {selectedStorefrontPreset?.description ||
                      (storefrontMode === "cards"
                        ? "Card mode: each slide is rendered as a content card. Image is optional."
                        : "Hero mode: slide image + copy are rendered in the hero section.")}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] ${storefrontStageBadge.className}`}
                >
                  <StorefrontStageIcon className="h-4 w-4" />
                  {storefrontStageBadge.label}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveStorefrontContent}
                  disabled={!hasStorefrontSelection || storefrontSaving}
                  className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white shadow-soft disabled:opacity-60"
                >
                  {storefrontSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={openStorefrontPreview}
                  disabled={!hasStorefrontSelection}
                  className="inline-flex items-center gap-2 rounded-full border border-ink-100/70 bg-white/70 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-600 disabled:opacity-60"
                >
                  <ExternalLink className="h-4 w-4" />
                  Buyer preview
                </button>
                <button
                  type="button"
                  onClick={() => runStorefrontAction("DRAFT_READY", "Review")}
                  disabled={!hasStorefrontSelection || storefrontActionLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-ink-100/70 bg-white/70 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-600 disabled:opacity-60"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Review
                </button>
                <button
                  type="button"
                  onClick={publishStorefrontNow}
                  disabled={!hasStorefrontSelection || storefrontActionLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-emerald-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Publish
                </button>
                <button
                  type="button"
                  onClick={() => runStorefrontAction("REJECT")}
                  disabled={!hasStorefrontSelection || storefrontActionLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-rose-700 disabled:opacity-60"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={deleteStorefrontContent}
                  disabled={!hasStorefrontSelection || storefrontDeleteLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-rose-700 disabled:opacity-60"
                >
                  {storefrontDeleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </button>
              </div>
            </div>

            <div className="glass-panel border border-ink-100/60 bg-white/70 p-5">
              <SectionPanel
                title={`Edit ${storefrontDraft.slot || "home.hero"} (${storefrontMode === "cards" ? "cards" : "hero"})`}
                icon={LayoutTemplate}
              >
                {storefrontEditor}
              </SectionPanel>
            </div>
          </section>
        </div>
        ) : null}

        {contentStudioTab === "blog" ? (
          <div className="glass-panel space-y-4 border border-ink-100/60 bg-white/70 p-5">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[16rem] flex-1 text-[0.55rem] font-semibold uppercase tracking-[0.24em] text-ink-400">
                Search
                <div className="mt-1 flex items-center gap-2 rounded-2xl border border-ink-100/60 bg-white/65 px-3 py-2 text-[0.7rem] text-ink-500">
                  <Search className="h-4 w-4 text-ink-400" />
                  <input
                    value={storefrontBlogQuery}
                    onChange={(event) => setStorefrontBlogQuery(event.target.value)}
                    placeholder="Search blog posts..."
                    className="w-full bg-transparent text-[0.8rem] text-ink-700 outline-none"
                  />
                </div>
              </label>
              <Field
                label="Status"
                type="select"
                value={storefrontBlogStatus}
                onChange={setStorefrontBlogStatus}
                size="sm"
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "new", label: "New" },
                  { value: "review", label: "Review" },
                  { value: "published", label: "Published" },
                  { value: "rejected", label: "Rejected" }
                ]}
              />
            </div>

            <div className="rounded-2xl border border-ink-100/60 bg-white/75">
              <div className="grid grid-cols-[minmax(0,2fr)_10rem_10rem_7rem] gap-3 border-b border-ink-100/60 px-4 py-3 text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-ink-400">
                <span>Post</span>
                <span>Author</span>
                <span>Updated</span>
                <span className="text-right">Action</span>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {storefrontBlogLoading ? (
                  <div className="px-4 py-6 text-sm text-ink-500">Loading blog posts...</div>
                ) : null}
                {!storefrontBlogLoading && storefrontBlogError ? (
                  <div className="px-4 py-6 text-sm text-rose-600">{storefrontBlogError}</div>
                ) : null}
                {!storefrontBlogLoading && !storefrontBlogError && !storefrontBlogPosts.length ? (
                  <div className="px-4 py-6 text-sm text-ink-500">No blog posts found.</div>
                ) : null}
                {!storefrontBlogLoading && !storefrontBlogError
                  ? storefrontBlogPosts.map((post) => (
                      <div
                        key={post.id || post.code}
                        className="grid grid-cols-[minmax(0,2fr)_10rem_10rem_7rem] gap-3 border-b border-ink-100/50 px-4 py-3 text-sm text-ink-700 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{post.title || "Untitled post"}</p>
                          <p className="mt-1 truncate text-[0.72rem] text-ink-500">{post.code || post.id}</p>
                        </div>
                        <p className="truncate text-[0.78rem] text-ink-500">{post.author_name || "-"}</p>
                        <p className="text-[0.78rem] text-ink-500">
                          {post.updated_at ? new Date(post.updated_at).toLocaleDateString() : "-"}
                        </p>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => deleteStorefrontBlogPost(post.id || post.code)}
                            disabled={storefrontBlogDeletingId === (post.id || post.code)}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {storefrontBlogDeletingId === (post.id || post.code) ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  : null}
              </div>
            </div>
            {storefrontBlogListFooter ? (
              <div className="border-t border-ink-100/60 pt-3">{storefrontBlogListFooter}</div>
            ) : null}
          </div>
        ) : null}

        {contentStudioTab === "pages" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(280px,30%)_minmax(0,1fr)]">
            <aside className="glass-panel flex h-[calc(100vh-4.4rem)] min-h-[75rem] flex-col border border-ink-100/60 bg-white/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">Page article library</p>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-ink-100/70 bg-white/70 px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-ink-500">
                    {pageContentTotal}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPageContentNew((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded-full border border-ink-100/70 bg-white/80 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-600"
                  >
                    <FilePlus2 className="h-3 w-3" />
                    New
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3">
                <label className="block text-[0.55rem] font-semibold uppercase tracking-[0.24em] text-ink-400">
                  Search
                  <div className="mt-1 flex items-center gap-2 rounded-2xl border border-ink-100/60 bg-white/65 px-3 py-2 text-[0.7rem] text-ink-500">
                    <Search className="h-4 w-4 text-ink-400" />
                    <input
                      value={pageContentQuery}
                      onChange={(event) => setPageContentQuery(event.target.value)}
                      placeholder="Search title or article body..."
                      className="w-full bg-transparent text-[0.8rem] text-ink-700 outline-none"
                    />
                  </div>
                </label>
                <Field
                  label="Status"
                  type="select"
                  value={pageContentStatus}
                  onChange={setPageContentStatus}
                  size="sm"
                  options={[
                    { value: "all", label: "All statuses" },
                    { value: "new", label: "New" },
                    { value: "review", label: "Review" },
                    { value: "published", label: "Published" },
                    { value: "rejected", label: "Rejected" }
                  ]}
                />
              </div>

              {showPageContentNew ? (
                <form
                  onSubmit={createPageContent}
                  className="mt-3 space-y-2 rounded-2xl border border-ink-100/60 bg-white/75 p-3"
                >
                  <Field
                    label="Parent tag"
                    type="select"
                    value={newPageContent.slot}
                    onChange={(value) => setNewPageContent((prev) => ({ ...prev, slot: value }))}
                    options={pageArticleSlotOptions.length ? pageArticleSlotOptions : [{ value: "pages.cards", label: "pages.cards" }]}
                    size="sm"
                  />
                  <Field
                    label="Article title"
                    value={newPageContent.title}
                    onChange={(value) => setNewPageContent((prev) => ({ ...prev, title: value }))}
                    placeholder="Editorial title"
                    size="sm"
                  />
                  <Field
                    label="Category"
                    type="select"
                    value={newPageContent.category_code || ""}
                    onChange={async (value) => {
                      if (value === CATEGORY_CREATE_OPTION) {
                        const created = await createStorefrontCategory();
                        if (!created) return;
                        setNewPageContent((prev) => ({ ...prev, category_code: created }));
                        return;
                      }
                      setNewPageContent((prev) => ({ ...prev, category_code: value }));
                    }}
                    options={storefrontCategoryOptions}
                    disabled={storefrontCategoriesLoading}
                    size="sm"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-full bg-ink-900 px-3 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-white"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPageContentNew(false);
                        setNewPageContent({ slot: "pages.cards", title: "", category_code: "" });
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-ink-100/70 bg-white/80 px-3 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-ink-500"
                    >
                      <X className="h-3.5 w-3.5" />
                      Close
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {pageContentLoading ? (
                  <div className="rounded-xl border border-dashed border-ink-200/70 bg-white/60 px-4 py-6 text-center text-xs text-ink-400">
                    Loading page articles...
                  </div>
                ) : null}
                {!pageContentLoading && pageContentListError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {pageContentListError}
                  </div>
                ) : null}
                {!pageContentLoading && !pageContentListError && !pageContentItems.length ? (
                  <div className="rounded-xl border border-dashed border-ink-200/70 bg-white/60 px-4 py-6 text-center text-xs text-ink-400">
                    No page articles found.
                  </div>
                ) : null}
                {!pageContentLoading && !pageContentListError
                  ? pageContentItems.map((item) => {
                      const active = String(item.id || item.code) === String(selectedPageContentId || "");
                      const stageValue = String(item?.attrs?.workflow?.stage || item?.status || "new").toLowerCase();
                      return (
                        <button
                          key={item.id || item.code}
                          type="button"
                          onClick={() => setSelectedPageContentId(item.id || item.code || "")}
                          className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                            active
                              ? "border-ink-900 bg-ink-900 text-white shadow-soft"
                              : "border-ink-100/70 bg-white/80 text-ink-700 hover:bg-white"
                          }`}
                        >
                          <p className={`text-[0.55rem] font-semibold uppercase tracking-[0.24em] ${active ? "text-white/70" : "text-ink-400"}`}>
                            {item.slot}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[0.85rem] font-semibold">
                            {item.article?.title || item.title || "Untitled article"}
                          </p>
                          <p className={`mt-1 line-clamp-2 text-[0.68rem] ${active ? "text-white/70" : "text-ink-500"}`}>
                            {item.article?.excerpt || "No excerpt yet."}
                          </p>
                          {item.category_label || item.category_code ? (
                            <p className={`mt-1 text-[0.62rem] uppercase tracking-[0.16em] ${active ? "text-white/70" : "text-ink-500"}`}>
                              {item.category_label || item.category_code}
                            </p>
                          ) : null}
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <p className={`text-[0.62rem] ${active ? "text-white/70" : "text-ink-500"}`}>
                              {item.code || item.id}
                            </p>
                            <span className={`rounded-full px-2 py-0.5 text-[0.52rem] font-semibold uppercase tracking-[0.2em] ${
                              active ? "bg-white/20 text-white/80" : "bg-ink-100 text-ink-600"
                            }`}>
                              {stageValue || "draft"}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  : null}
              </div>
              {pageContentListFooter ? (
                <div className="mt-3 border-t border-ink-100/60 pt-3">{pageContentListFooter}</div>
              ) : null}
            </aside>

            <section className="space-y-4">
              <div className="glass-panel border border-ink-100/60 bg-white/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">
                      Selected article
                    </p>
                    <h3 className="text-[1rem] font-semibold text-ink-900">
                      {pageContentDraft?.article?.title || pageContentDraft?.title || "Select article"}
                    </h3>
                    <p className="mt-1 text-[0.72rem] text-ink-500">
                      One content item equals one page article. Multiple articles can map to the same parent tag.
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] ${pageContentStageBadge.className}`}
                  >
                    <PageContentStageIcon className="h-4 w-4" />
                    {pageContentStageBadge.label}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={savePageContent}
                    disabled={!pageContentDraft?.id || pageContentSaving}
                    className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white shadow-soft disabled:opacity-60"
                  >
                    {pageContentSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => runPageContentAction("DRAFT_READY", "Review")}
                    disabled={!pageContentDraft?.id || pageContentActionLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-ink-100/70 bg-white/70 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-600 disabled:opacity-60"
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={() => runPageContentAction("PUBLISH", "Publish")}
                    disabled={!pageContentDraft?.id || pageContentActionLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-emerald-700 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Publish
                  </button>
                  <button
                    type="button"
                    onClick={() => runPageContentAction("REJECT", "Reject")}
                    disabled={!pageContentDraft?.id || pageContentActionLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-rose-700 disabled:opacity-60"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={deletePageContent}
                    disabled={!pageContentDraft?.id || pageContentDeleteLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-rose-700 disabled:opacity-60"
                  >
                    {pageContentDeleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete
                  </button>
                </div>
              </div>

              <div className="glass-panel border border-ink-100/60 bg-white/70 p-5">
                <SectionPanel title={`Edit ${pageContentDraft.slot || "pages.cards"} (article)`} icon={FileText}>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Field
                      label="Parent tag"
                      type="select"
                      value={pageContentDraft.slot}
                      onChange={(value) => updatePageContentField("slot", value)}
                      options={pageArticleSlotOptions.length ? pageArticleSlotOptions : [{ value: "pages.cards", label: "pages.cards" }]}
                    />
                    <Field
                      label="Category"
                      type="select"
                      value={pageContentDraft.category_code || ""}
                      onChange={async (value) => {
                        if (value === CATEGORY_CREATE_OPTION) {
                          const created = await createStorefrontCategory();
                          if (!created) return;
                          updatePageContentField("category_code", created);
                          return;
                        }
                        updatePageContentField("category_code", value);
                      }}
                      options={storefrontCategoryOptions}
                      disabled={storefrontCategoriesLoading}
                    />
                    <Field
                      label="Title"
                      value={pageContentDraft.article?.title || pageContentDraft.title || ""}
                      onChange={(value) => {
                        updatePageContentField("title", value);
                        updatePageContentArticleField("title", value);
                      }}
                      placeholder="Article title"
                    />
                    <Field
                      label="Eyebrow"
                      value={pageContentDraft.article?.eyebrow || ""}
                      onChange={(value) => updatePageContentArticleField("eyebrow", value)}
                      placeholder="Category or eyebrow"
                    />
                    <Field
                      label="Excerpt"
                      value={pageContentDraft.article?.excerpt || ""}
                      onChange={(value) => updatePageContentArticleField("excerpt", value)}
                      placeholder="Teaser copy"
                    />
                    <Field
                      type="checkbox"
                      label="Active in storefront"
                      checked={pageContentDraft.is_active !== false}
                      onChange={(value) => updatePageContentField("is_active", value)}
                    />
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
                    <Field
                      label="Body"
                      type="textarea"
                      value={pageContentDraft.article?.body || ""}
                      onChange={(value) => updatePageContentArticleField("body", value)}
                      placeholder="Long-form article body"
                      rows={18}
                    />
                    <div className="space-y-4">
                      <Field
                        label="Image URL"
                        value={pageContentDraft.article?.image || ""}
                        onChange={(value) => updatePageContentArticleField("image", value)}
                        placeholder="Uploaded asset URL"
                      />
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink-100/70 bg-white/80 px-3 py-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-600">
                        {pageContentUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                        {pageContentUploading ? "Uploading..." : "Upload image"}
                        <input type="file" accept="image/*" className="hidden" onChange={handlePageContentImageUpload} />
                      </label>
                      {pageContentDraft.article?.image ? (
                        <MediaFrame asset={{ url: pageContentDraft.article.image, name: pageContentDraft.article.title || "Article image" }} />
                      ) : null}
                      <Field
                        label="CTA label"
                        value={pageContentDraft.article?.cta_label || ""}
                        onChange={(value) => updatePageContentArticleField("cta_label", value)}
                        placeholder="Read more"
                      />
                      <Field
                        label="CTA action"
                        type="select"
                        value={pageContentDraft.article?.cta_action || "navigate_internal"}
                        onChange={(value) => updatePageContentArticleField("cta_action", value)}
                        options={[
                          { value: "navigate_internal", label: "Internal page" },
                          { value: "navigate_external", label: "External URL" },
                          { value: "scroll_to", label: "Scroll target" }
                        ]}
                      />
                      <Field
                        label="CTA target"
                        value={pageContentDraft.article?.cta_target || ""}
                        onChange={(value) => updatePageContentArticleField("cta_target", value)}
                        placeholder="/pages/brand-story"
                      />
                      <Field
                        type="checkbox"
                        label="Open in new tab"
                        checked={Boolean(pageContentDraft.article?.cta_new_tab)}
                        onChange={(value) => updatePageContentArticleField("cta_new_tab", value)}
                      />
                    </div>
                  </div>
                </SectionPanel>
              </div>
            </section>
          </div>
        ) : null}

        {showStorefrontStudioTabsModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="glass-panel w-full max-w-2xl rounded-3xl border border-ink-100/70 bg-white/95 p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-ink-400">
                    Content Studio
                  </p>
                  <h3 className="text-[1rem] font-semibold text-ink-900">Manage tabs</h3>
                  <p className="text-[0.72rem] text-ink-500">
                    Rename tabs and reorder their display sequence.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (storefrontStudioTabsSaving) return;
                    setShowStorefrontStudioTabsModal(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-100/80 bg-white px-3 py-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink-600"
                >
                  <X className="h-3.5 w-3.5" />
                  Close
                </button>
              </div>

              <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {storefrontStudioTabEditorRows.map((row, index) => (
                  <div
                    key={row.code}
                    className="grid grid-cols-[minmax(0,1fr)_10rem_5rem] items-center gap-2 rounded-xl border border-ink-100/70 bg-white/90 px-3 py-2.5"
                  >
                    <input
                      value={row.label}
                      onChange={(event) => {
                        const value = event.target.value;
                        setStorefrontStudioTabEditorRows((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, label: value } : item
                          )
                        );
                      }}
                      className="w-full rounded-xl border border-ink-200/60 bg-white/90 px-3 py-2 text-[0.8rem] text-ink-700 outline-none"
                    />
                    <p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-ink-500">
                      {row.tab_mode}
                    </p>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => moveStorefrontStudioTabEditorRow(index, -1)}
                        disabled={index === 0}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-ink-100/70 bg-white text-ink-600 disabled:opacity-40"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStorefrontStudioTabEditorRow(index, 1)}
                        disabled={index === storefrontStudioTabEditorRows.length - 1}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-ink-100/70 bg-white text-ink-600 disabled:opacity-40"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStorefrontStudioTabsModal(false)}
                  disabled={storefrontStudioTabsSaving}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-100/80 bg-white px-3.5 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-600 disabled:opacity-60"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveStorefrontStudioTabs}
                  disabled={storefrontStudioTabsSaving}
                  className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-3.5 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-60"
                >
                  {storefrontStudioTabsSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save order
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showStorefrontMappingModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="glass-panel w-full max-w-4xl rounded-3xl border border-ink-100/70 bg-white/95 p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-ink-400">
                    {storefrontMappingUi.modal.eyebrow}
                  </p>
                  <h3 className="text-[1rem] font-semibold text-ink-900">{storefrontMappingUi.modal.title}</h3>
                  <p className="text-[0.72rem] text-ink-500">
                    {storefrontMappingUi.modal.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStorefrontMappingModal(false)}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-100/80 bg-white px-3 py-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink-600"
                >
                  <X className="h-3.5 w-3.5" />
                  {storefrontMappingUi.modal.closeLabel}
                </button>
              </div>
              <div className="mt-4 max-h-[65vh] space-y-2 overflow-y-auto pr-1">
                {storefrontStructureMappingRows.map((row) => {
                  const hasMapped = row.mappedCount > 0;
                  const approved = row.mappingStatus === "approved";
                  const saving = storefrontMappingSavingId === row.candidateId;
                  return (
                    <div
                      key={row.candidateId || `${row.tag}-${row.selector}`}
                      className="rounded-xl border border-ink-100/70 bg-white/90 px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-ink-600">
                            {row.tag}
                          </p>
                          <p className="truncate text-[0.75rem] font-semibold text-ink-800">
                            {row.label || "Untitled zone"}
                          </p>
                          <p className="mt-1 truncate text-[0.68rem] text-ink-500">
                            {row.rendererType || "unknown"} · {Math.round(Number(row.confidence || 0) * 100)}% · {row.source || "scan"}
                          </p>
                          {row.selector ? (
                            <p className="mt-1 truncate font-mono text-[0.62rem] text-ink-400">{row.selector}</p>
                          ) : null}
                          {row.textSample ? (
                            <p className="mt-1 line-clamp-2 text-[0.68rem] text-ink-500">{row.textSample}</p>
                          ) : null}
                          <p className="mt-1 truncate text-[0.62rem] text-ink-400">
                            {row.image_count || 0} images · {row.link_count || 0} links · {row.button_count || 0} buttons · {row.repeated_item_count || 0} repeated items
                          </p>
                          <p className="mt-1 truncate text-[0.68rem] text-ink-500">
                            {hasMapped
                              ? `Mapped to: ${row.primaryItem?.title || "Untitled content"}`
                              : "No mapped content"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.18em] ${
                              hasMapped
                                ? "bg-emerald-100 text-emerald-700"
                                : approved
                                  ? "bg-sky-100 text-sky-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {hasMapped ? "Content ready" : row.mappingStatus || "proposed"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {!approved ? (
                          <button
                            type="button"
                            onClick={() => updateStorefrontMapping(row, "approved")}
                            disabled={saving || !row.pushAllowed}
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-emerald-700 disabled:opacity-50"
                          >
                            {storefrontMappingUi.actions.approve}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => editStorefrontMapping(row)}
                          disabled={saving || !row.pushAllowed}
                          className="rounded-full border border-ink-100/80 bg-white px-2.5 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-ink-600 disabled:opacity-50"
                        >
                          {storefrontMappingUi.actions.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStorefrontMapping(row, "ignored")}
                          disabled={saving}
                          className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-rose-700 disabled:opacity-50"
                        >
                          {storefrontMappingUi.actions.ignore}
                        </button>
                        {row.mappingStatus !== "proposed" ? (
                          <button
                            type="button"
                            onClick={() => updateStorefrontMapping(row, "proposed")}
                            disabled={saving}
                            className="rounded-full border border-ink-100/80 bg-white px-2.5 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-ink-600 disabled:opacity-50"
                          >
                            {storefrontMappingUi.actions.reset}
                          </button>
                        ) : null}
                        {approved ? (
                          <button
                            type="button"
                            onClick={() => {
                              mapStorefrontTag(row.tag);
                              setShowStorefrontMappingModal(false);
                            }}
                            className="rounded-full border border-ink-100/80 bg-white px-2.5 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.16em] text-ink-600"
                          >
                            {hasMapped
                              ? storefrontMappingUi.actions.openContent
                              : storefrontMappingUi.actions.createContent}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
        <ActionMiniModal
          open={Boolean(miniModalRequest)}
          mode={miniModalRequest?.mode || "confirm"}
          title={miniModalRequest?.title || "Confirm action"}
          message={miniModalRequest?.message || ""}
          inputLabel={miniModalRequest?.inputLabel || "Input"}
          inputPlaceholder={miniModalRequest?.inputPlaceholder || ""}
          defaultValue={miniModalRequest?.defaultValue || ""}
          required={Boolean(miniModalRequest?.required)}
          confirmLabel={miniModalRequest?.confirmLabel || "Confirm"}
          cancelLabel={miniModalRequest?.cancelLabel || "Cancel"}
          confirmTone={miniModalRequest?.confirmTone || "default"}
          onCancel={() => closeMiniModal(false)}
          onConfirm={(value) => closeMiniModal(true, value)}
        />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <ProductStudioTabs
        tabs={productStudioUi.tabs}
        activeTab={productStudioTab}
        onChange={setProductStudioTab}
      />
      {productStudioTab === "focus" ? (
        <ProductFocusPanel
          focusItems={productFocusItems}
          onSelectProduct={(item) => {
            setSelectedId(item.id);
            setProductStudioTab("studio");
          }}
          onOpenTradeConditions={(item) => {
            setSelectedId(item.id);
            setShowTradeConditions(true);
          }}
        />
      ) : null}
      {productStudioTab === "studio" ? (
      <>
      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 border border-ink-100/60 bg-white/70 p-5">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">E-commerce</p>
          <h2 className="text-lg font-semibold text-ink-900">All products</h2>
          <p className="mt-1 text-[0.85rem] text-ink-500">
            Manage the full catalog lifecycle. The process engine handles validation and publishing in the background.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await loadTranslationServiceStatus();
            await refreshList();
          }}
          className="inline-flex items-center gap-2 rounded-full border border-ink-100/70 bg-white/70 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-600"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {translationService.checked ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-xs ${
            translationService.available
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {translationService.available
            ? "Translation service connected."
            : "Translation service offline."}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(340px,40%)_minmax(0,1fr)] xl:grid-cols-[minmax(400px,42%)_minmax(0,1fr)]">
        <aside className="glass-panel flex h-[calc(100vh-10.8rem)] min-h-[42rem] flex-col border border-ink-100/60 bg-white/65 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">Library</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImport((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-full border border-ink-100/70 bg-white/70 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-600"
              >
                <UploadCloud className="h-3 w-3" />
                Import
              </button>
              <button
                type="button"
                onClick={exportProducts}
                className="inline-flex items-center gap-1 rounded-full border border-ink-100/70 bg-white/70 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-600"
              >
                <Download className="h-3 w-3" />
                Export
              </button>
              <button
                type="button"
                onClick={() => setShowNew((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-full border border-ink-100/70 bg-white/70 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-600"
              >
                <FilePlus2 className="h-3 w-3" />
                New
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label className="block text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
              Search
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-ink-100/60 bg-white/65 px-3 py-2 text-[0.7rem] text-ink-500">
                <Search className="h-4 w-4 text-ink-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, category, or tags..."
                  className="w-full bg-transparent text-[0.85rem] text-ink-700 outline-none"
                />
              </div>
            </label>
          </div>

          {selectedIds.size ? (
            <div className="mt-3 rounded-2xl border border-ink-100/60 bg-white/70 px-3 py-2 text-[0.65rem] text-ink-600">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  {selectedIds.size} selected
                </span>
                <select
                  value={bulkAction}
                  onChange={(event) => setBulkAction(event.target.value)}
                  className="rounded-md border border-ink-100/70 bg-white/80 px-2 py-1 text-[0.6rem] font-semibold text-ink-600"
                >
                  <option value="">Bulk action</option>
                  <option value="DRAFT_READY">Send to review</option>
                  <option value="APPROVE">Approve</option>
                  <option value="REJECT">Reject</option>
                  <option value="PUBLISH_NOW">Publish</option>
                </select>
                <button
                  type="button"
                  onClick={applyBulkAction}
                  disabled={!bulkAction}
                  className="inline-flex items-center rounded-full border border-ink-100/70 bg-white/80 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-600 disabled:opacity-50"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-500"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          {showImport ? (
            <div className="mt-3 rounded-2xl border border-ink-100/60 bg-white/70 p-3 text-[0.7rem] text-ink-600">
              <div className="flex items-center justify-between">
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                  Import products
                </p>
                <button
                  type="button"
                  onClick={() => setShowImport(false)}
                  className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-500"
                >
                  Close
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode("file")}
                  className={`rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] ${
                    importMode === "file"
                      ? "bg-ink-900 text-white"
                      : "border border-ink-100/70 bg-white/80 text-ink-500"
                  }`}
                >
                  CSV file
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode("sheet")}
                  className={`rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] ${
                    importMode === "sheet"
                      ? "bg-ink-900 text-white"
                      : "border border-ink-100/70 bg-white/80 text-ink-500"
                  }`}
                >
                  Google Sheet
                </button>
              </div>
              {importMode === "file" ? (
                <label className="mt-3 block text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                    className="mt-1 w-full text-[0.7rem] text-ink-600"
                  />
                </label>
              ) : (
                <label className="mt-3 block text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                  Sheet URL
                  <input
                    value={importUrl}
                    onChange={(event) => setImportUrl(event.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
                    className="mt-1 w-full rounded-xl border border-ink-200/50 bg-white/70 px-3 py-2 text-[0.8rem] text-ink-700"
                  />
                </label>
              )}
              <p className="mt-2 text-[0.6rem] text-ink-400">
                Expected columns: title, supplier_code, category, tags, main_url, gallery_urls, document_urls, price, currency, available_qty. Excel files should be saved as CSV.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={runImport}
                  disabled={importing}
                  className="inline-flex items-center rounded-full bg-ink-900 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-60"
                >
                  {importing ? "Importing..." : "Start import"}
                </button>
              </div>
              {importNotice.message ? (
                <div
                  className={`mt-3 rounded-xl border px-3 py-2 text-[0.65rem] ${
                    importNotice.tone === "error"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {importNotice.message}
                </div>
              ) : null}
            </div>
          ) : null}

          {showNew ? (
            <form onSubmit={createProduct} className="mt-4 space-y-3 rounded-2xl border border-ink-100/60 bg-white/70 p-3">
              <label className="block text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Supplier code (optional)
                <input
                  value={newProduct.supplierCode}
                  onChange={(event) => setNewProduct((prev) => ({ ...prev, supplierCode: event.target.value }))}
                  placeholder="Used to generate SKU"
                  className="mt-1 w-full rounded-xl border border-ink-200/50 bg-white/70 px-3 py-2 text-[0.85rem] text-ink-700"
                />
              </label>
              <label className="block text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Product name
                <input
                  value={newProduct.title}
                  onChange={(event) => setNewProduct((prev) => ({ ...prev, title: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-ink-200/50 bg-white/70 px-3 py-2 text-[0.85rem] text-ink-700"
                />
              </label>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink-900 px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-white shadow-soft"
              >
                <PlusCircle className="h-4 w-4" />
                Create
              </button>
            </form>
          ) : null}

          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2.5">
            <div className="flex-1 overflow-y-auto pr-1">{listContent}</div>
            {listFooter}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="glass-panel border border-ink-100/60 bg-white/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">Selected product</p>
                <h3 className="text-[1rem] font-semibold text-ink-900">
                  {draft?.title || "Select a product"}
                </h3>
                <p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-ink-500">
                  {draftBaseItemCode || "NO-CODE"}
                </p>
                {draftVariantSummary.activeCount > 0 ? (
                  <p className="mt-1 text-[0.62rem] text-ink-500">
                    {draftVariantSummary.activeCount} active variant
                    {draftVariantSummary.activeCount === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] ${stageBadge.className}`}>
                <StageIcon className="h-4 w-4" />
                {stageBadge.label}
              </span>
            </div>

            {detailLoading ? (
              <div className="mt-4 inline-flex items-center gap-2 text-xs text-ink-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading product details...
              </div>
            ) : null}

            {statusMessage ? (
              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-xs ${
                  statusTone === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {statusMessage}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveProduct}
                className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white shadow-soft"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
              <button
                type="button"
                onClick={openBuyerPreview}
                className="inline-flex items-center gap-2 rounded-full border border-ink-100/70 bg-white/70 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-600"
              >
                <ExternalLink className="h-4 w-4" />
                Buyer preview
              </button>
              <button
                type="button"
                onClick={() => setShowTradeConditions(true)}
                className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-brand-700"
              >
                <FileText className="h-4 w-4" />
                Trade conditions
              </button>
              <button
                type="button"
                onClick={() => runAction("DRAFT_READY", "Review")}
                className="inline-flex items-center gap-2 rounded-full border border-ink-100/70 bg-white/70 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-600"
              >
                <ClipboardCheck className="h-4 w-4" />
                Review
              </button>
              <button
                type="button"
                onClick={publishNow}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Publish
              </button>
              <button
                type="button"
                onClick={() => runAction("REJECT")}
                className="inline-flex items-center gap-2 rounded-full border border-rose-200/70 bg-rose-50/80 px-3.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-rose-700"
              >
                <ShieldAlert className="h-4 w-4" />
                Reject
              </button>
            </div>
          </div>

          <div className="glass-panel border border-ink-100/60 bg-white/70 p-5">
            <div className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
              <nav className="space-y-1.5">
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.28em] text-ink-400">
                  Sections
                </p>
                <div className="flex flex-wrap gap-2 lg:flex-col">
                  {sectionItems.map((section) => {
                    const active = section.id === activeSection;
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSection(section.id)}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] transition ${
                          active
                            ? "bg-ink-900/90 text-white shadow-soft"
                            : "border border-ink-100/70 bg-white/60 text-ink-600 hover:bg-white/80"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {section.label}
                      </button>
                    );
                  })}
                </div>
              </nav>

              <div className="space-y-5">
                <SectionPanel title={activeSectionMeta.label} icon={activeSectionMeta.icon}>
                  {activeSection === "basics" ? (
                    <>
              <Field
                label="Supplier code"
                value={draft.attrs?.inventory?.supplier_code || ""}
                placeholder="Provided by supplier"
                hint="Used to generate the SKU."
                onChange={(value) => updateDraft(["inventory", "supplier_code"], value)}
              />
              <Field
                label="SKU"
                value={draft.attrs?.inventory?.sku || ""}
                placeholder="Auto-generated"
                hint={`System code: ${draft.code || "auto-generated"}. SKU locks after generation.`}
                readOnly={Boolean(draft.attrs?.inventory?.sku)}
                onChange={(value) => updateDraft(["inventory", "sku"], value)}
              />
              {draftVariantSummary.activeCount > 0 ? (
                <p className="text-[0.62rem] text-ink-500">
                  Variants configured: {draftVariantSummary.activeCount}
                </p>
              ) : null}
              <Field
                label="Product name"
                value={draft.title}
                onChange={(value) => updateDraft(["title"], value)}
              />
              <RichTextField
                label="Product description"
                value={draft.attrs?.content?.summary || ""}
                onChange={(value) => updateDraft(["content", "summary"], value)}
                hint="Use the mini toolbar for emphasis, spacing, and links."
              />
                    </>
                  ) : null}

                  {activeSection === "media" ? (
                    <>
              <div className="space-y-3">
                <Field
                  label="Main media URL"
                  value={draft.attrs?.media?.main_url || draft.attrs?.media?.hero_url || ""}
                  hint="Paste an image or short video URL."
                  onChange={(value) => {
                    updateDraft(["media", "main_url"], value);
                    updateDraft(["media", "hero_url"], value);
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink-100/70 bg-white/70 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-600 transition hover:-translate-y-0.5 hover:border-ink-100/80 hover:bg-white/80 hover:shadow-soft active:translate-y-0 active:scale-[0.98] focus-within:ring-2 focus-within:ring-ink-300/50">
                    <UploadCloud className="h-4 w-4" />
                    Upload main media
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleMainUpload}
                      className="hidden"
                    />
                  </label>
                  {draft.attrs?.media?.main_asset ||
                  draft.attrs?.media?.main_url ||
                  draft.attrs?.media?.hero_asset ||
                  draft.attrs?.media?.hero_url ? (
                    <button
                      type="button"
                      onClick={clearMainMedia}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove main media
                    </button>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-ink-100/60 bg-white/60 p-4">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">Main media preview</p>
                  <div className="mt-3">
                    {mainAsset ? (
                      <MediaFrame asset={mainAsset} variant="hero" />
                    ) : (
                      <div className="rounded-xl border border-dashed border-ink-200/50 bg-white/60 px-3 py-6 text-center text-[0.7rem] text-ink-400">
                        No main media selected.
                      </div>
                    )}
                  </div>
                </div>

                <Field
                  label="Gallery URLs"
                  type="textarea"
                  value={toCsv(draft.attrs?.media?.gallery)}
                  hint="Comma-separated links for additional images or videos."
                  onChange={(value) => updateDraft(["media", "gallery"], fromCsv(value))}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink-100/70 bg-white/70 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-600 transition hover:-translate-y-0.5 hover:border-ink-100/80 hover:bg-white/80 hover:shadow-soft active:translate-y-0 active:scale-[0.98] focus-within:ring-2 focus-within:ring-ink-300/50">
                    <UploadCloud className="h-4 w-4" />
                    Upload gallery
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handleGalleryUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="rounded-2xl border border-ink-100/60 bg-white/60 p-4">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">Gallery preview</p>
                  <div className="mt-3">
                    {galleryAssets.length ? (
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {uploadedGallery.map((asset, index) => (
                          <MediaFrame
                            key={`upload-${asset.url || asset.preview_url}-${index}`}
                            asset={asset}
                            variant="strip"
                            onRemove={() => removeGalleryAsset(index)}
                          />
                        ))}
                        {filteredUrlGallery.map((asset, index) => (
                          <MediaFrame
                            key={`url-${asset.url}-${index}`}
                            asset={asset}
                            variant="strip"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-ink-200/50 bg-white/60 px-3 py-6 text-center text-[0.7rem] text-ink-400">
                        No gallery media yet.
                      </div>
                    )}
                  </div>
                </div>

                <Field
                  label="Document URLs"
                  type="textarea"
                  value={toCsv(draft.attrs?.media?.documents)}
                  hint="Comma-separated links for downloadable files (PDF, ZIP, CLO3D, etc.)."
                  onChange={(value) => updateDraft(["media", "documents"], fromCsv(value))}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink-100/70 bg-white/70 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-600 transition hover:-translate-y-0.5 hover:border-ink-100/80 hover:bg-white/80 hover:shadow-soft active:translate-y-0 active:scale-[0.98] focus-within:ring-2 focus-within:ring-ink-300/50">
                    <UploadCloud className="h-4 w-4" />
                    Upload documents
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.zip,.7z,.rar,.zprj,.zpac,.clo,.dxf,.dwg,.txt,.csv,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      onChange={handleDocumentUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="rounded-2xl border border-ink-100/60 bg-white/60 p-4">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">
                    Documents
                  </p>
                  {documentAssets.length ? (
                    <div className="mt-3 space-y-2">
                      {documentAssets.map((asset, index) => (
                        <div
                          key={`doc-${asset.url || asset.preview_url || asset.name || index}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-ink-100/60 bg-white/80 px-3 py-2 text-[0.75rem] text-ink-600"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink-700">{asset.name || "Attachment"}</p>
                            <p className="truncate text-[0.65rem] uppercase tracking-[0.15em] text-ink-400">
                              {asset.type || "document"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {asset.url ? (
                              <a
                                href={resolveAssetUrl(asset.url)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-ink-100/70 bg-white px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-500"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download
                              </a>
                            ) : (
                              <span className="text-[0.6rem] uppercase tracking-[0.2em] text-ink-400">Uploading</span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeDocumentAsset(index)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-ink-200/50 bg-white/60 px-3 py-5 text-center text-[0.7rem] text-ink-400">
                      No documents attached.
                    </div>
                  )}
                </div>
              </div>

                    </>
                  ) : null}

                  {activeSection === "pricing" ? (
                    <>
              <Field
                label="Pricing strategy"
                type="select"
                value={draft.attrs?.pricing?.strategy || "fixed"}
                options={[
                  { value: "fixed", label: "Fixed price" },
                  { value: "tiered", label: "Tiered pricing" },
                  { value: "regional", label: "Regional pricing" },
                  { value: "subscription", label: "Subscription" }
                ]}
                onChange={(value) => updateDraft(["pricing", "strategy"], value)}
              />
              <div className="rounded-2xl border border-ink-100/60 bg-white/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">
                      Price list
                    </p>
                    <p className="mt-1 text-[0.7rem] text-ink-500">
                      Add one or more price lines by currency or region.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addPricingTier}
                    className="inline-flex items-center gap-2 rounded-full border border-ink-100/70 bg-white/70 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-ink-600"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add price
                  </button>
                </div>

                {pricingTiers.length ? (
                  <div className="mt-4 max-h-[18rem] space-y-3 overflow-y-auto pr-1">
                    {pricingTiers.map((tier, index) => (
                      <div
                        key={`tier-${index}`}
                        className="space-y-2 rounded-xl border border-ink-100/60 bg-white/70 p-3 text-[0.7rem]"
                      >
                        <div className="grid gap-2 lg:grid-cols-[1.1fr_0.8fr_0.9fr_0.9fr_auto]">
                          <Field
                            label="Market"
                            value={tier.region || ""}
                            placeholder="Global / US / EU"
                            onChange={(value) => updatePricingTier(index, "region", value)}
                            size="sm"
                          />
                          <Field
                            label="Currency"
                            value={tier.currency || ""}
                            placeholder="USD"
                            onChange={(value) => updatePricingTier(index, "currency", value)}
                            size="sm"
                          />
                          <Field
                            label="Price"
                            type="number"
                            value={safeNumber(tier.amount)}
                            onChange={(value) =>
                              updatePricingTier(index, "amount", value === "" ? null : Number(value))
                            }
                            size="sm"
                          />
                          <Field
                            label="Compare"
                            type="number"
                            value={safeNumber(tier.compare_at)}
                            onChange={(value) =>
                              updatePricingTier(index, "compare_at", value === "" ? null : Number(value))
                            }
                            size="sm"
                          />
                          <div className="flex items-end justify-end">
                            <button
                              type="button"
                              onClick={() => removePricingTier(index)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-[0.8fr_0.8fr_1.4fr]">
                          <Field
                            label="Tax %"
                            type="number"
                            value={safeNumber(tier.tax_rate)}
                            onChange={(value) =>
                              updatePricingTier(index, "tax_rate", value === "" ? null : Number(value))
                            }
                            size="sm"
                          />
                          <Field
                            label="Discount %"
                            type="number"
                            value={safeNumber(tier.discount_pct)}
                            onChange={(value) =>
                              updatePricingTier(index, "discount_pct", value === "" ? null : Number(value))
                            }
                            hint="Managed by commercial conditions."
                            size="sm"
                          />
                          <Field
                            label="Notes"
                            value={tier.notes || ""}
                            onChange={(value) => updatePricingTier(index, "notes", value)}
                            size="sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-ink-200/70 bg-white/60 px-4 py-6 text-center text-xs text-ink-400">
                    No pricing entries yet. Add a price line to start.
                  </div>
                )}
              </div>
                    </>
                  ) : null}


                  {activeSection === "inventory" ? (
                    <>
              <Field
                label="Starting inventory"
                type="number"
                value={safeNumber(
                  draftVariants.enabled
                    ? variantInventoryTotals.activeQty
                    : draft.attrs?.inventory?.available_qty
                )}
                readOnly={draftVariants.enabled}
                hint={
                  draftVariants.enabled
                    ? "Derived from active variant stock. Process transition will reconcile persisted inventory."
                    : "Inventory movements update stock automatically after this starting value."
                }
                onChange={(value) => {
                  if (draftVariants.enabled) return;
                  updateDraft(["inventory", "available_qty"], value === "" ? null : Number(value));
                }}
              />
              <Field
                label="On-hand stock"
                type="number"
                value={safeNumber(
                  draftVariants.enabled
                    ? variantInventoryTotals.activeQty
                    : draft.attrs?.inventory?.on_hand
                )}
                readOnly
                hint="Calculated from inventory movements (in/out)."
              />
              <Field
                label="Track inventory"
                type="checkbox"
                checked={draft.attrs?.inventory?.track_inventory === true}
                onChange={(value) => updateDraft(["inventory", "track_inventory"], value)}
              />
              <div className="space-y-3 rounded-2xl border border-ink-100/70 bg-white/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-ink-500">
                    Variant stock navigator
                  </p>
                  <span className="rounded-full border border-ink-100/70 bg-white/80 px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-ink-500">
                    {variantInventoryRows.length} lines
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Field
                    label="Search variants"
                    value={variantInventoryQuery}
                    onChange={setVariantInventoryQuery}
                    placeholder={variantInventoryColumns
                      .map((item) => item.label)
                      .join(", ")
                      .toLowerCase()}
                    size="sm"
                  />
                  <Field
                    label="Per page"
                    type="select"
                    value={variantInventoryPageSize}
                    onChange={(value) => setVariantInventoryPageSize(Number(value) || 7)}
                    options={[
                      { label: "5", value: 5 },
                      { label: "7", value: 7 },
                      { label: "10", value: 10 }
                    ]}
                    size="sm"
                  />
                </div>
                <div className="overflow-hidden rounded-xl border border-ink-100/70">
                  <div className="grid grid-cols-[56px_minmax(0,1fr)_90px_90px_78px_68px] gap-2 border-b border-ink-100/70 bg-ink-50/70 px-3 py-2 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-500">
                    <span>#</span>
                    <span>Variant</span>
                    <span>{variantInventoryColumns[0]?.label || "Option 1"}</span>
                    <span>{variantInventoryColumns[1]?.label || "Option 2"}</span>
                    <span className="text-right">Stock</span>
                    <span className="text-right">Status</span>
                  </div>
                  <div className="divide-y divide-ink-100/60 bg-white/80">
                    {pagedVariantInventoryRows.length ? (
                      pagedVariantInventoryRows.map((row) => (
                        <div
                          key={row.id}
                          className="grid grid-cols-[56px_minmax(0,1fr)_90px_90px_78px_68px] items-center gap-2 px-3 py-2 text-[0.64rem] text-ink-600"
                        >
                          <span className="font-semibold text-ink-500">{row.index}</span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{row.label}</p>
                          </div>
                          <span className="truncate">{row.optionA}</span>
                          <span className="truncate">{row.optionB}</span>
                          <span className="text-right font-semibold">{row.stock}</span>
                          <span
                            className={`text-right text-[0.55rem] font-semibold uppercase tracking-[0.18em] ${
                              row.active ? "text-emerald-700" : "text-rose-600"
                            }`}
                          >
                            {row.active ? "On" : "Off"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-center text-xs text-ink-400">
                        {draftVariants.items.length
                          ? "No variant line matches this search."
                          : "No variant lines yet. Use Variants section to add rows."}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[0.58rem] text-ink-400">
                  <span>
                    Page {variantInventoryPageSafe} of {variantInventoryTotalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setVariantInventoryPage((prev) => Math.max(1, prev - 1))}
                      disabled={variantInventoryPageSafe === 1}
                      className="rounded-lg border border-ink-100/70 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Prev
                    </button>
                    {variantInventoryPageNumbers.map((value) =>
                      typeof value === "number" ? (
                        <button
                          key={`variant-stock-page-${value}`}
                          type="button"
                          onClick={() => setVariantInventoryPage(value)}
                          className={`rounded-lg px-2 py-1 ${
                            value === variantInventoryPageSafe
                              ? "bg-ink-900 text-white"
                              : "border border-ink-100/70 bg-white/80 text-ink-500"
                          }`}
                        >
                          {value}
                        </button>
                      ) : (
                        <span key={`variant-stock-page-${value}`} className="px-1 text-ink-300">
                          …
                        </span>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setVariantInventoryPage((prev) =>
                          Math.min(variantInventoryTotalPages, prev + 1)
                        )
                      }
                      disabled={variantInventoryPageSafe === variantInventoryTotalPages}
                      className="rounded-lg border border-ink-100/70 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
                    </>
                  ) : null}

                  {activeSection === "variants" ? (
                    <>
              <Field
                type="checkbox"
                label="Enable variants"
                checked={draftVariants.enabled}
                onChange={toggleVariantMode}
              />
              <p className="text-[0.62rem] text-ink-500">
                Configure tenant-specific variant fields (size, width, material grade, color, etc.) while keeping one SKU per product.
              </p>
              {draftVariants.enabled && !selectedProductCategoryCode ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[0.62rem] text-rose-700">
                  Select a primary category first. Variant fields are governed by that category profile.
                </p>
              ) : null}

              {!variantFieldHeaders.length ? (
                <div className="rounded-xl border border-dashed border-ink-200/70 bg-white/60 px-4 py-4 text-center text-xs text-ink-400">
                  No field header configured yet. Configure category variant headers first.
                </div>
              ) : null}

              {draftVariants.items.length ? (
                <div className="overflow-x-auto rounded-2xl border border-ink-100/70 bg-white/80">
                  <table className="min-w-full text-[0.64rem] text-ink-600">
                    <thead className="bg-ink-50/80 text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-ink-500">
                      <tr>
                        <th className="px-2 py-2 text-left">#</th>
                        {variantFieldHeaders.map((header) => (
                          <th key={`variant-head-${header.key}`} className="px-2 py-2 text-left">
                            {header.label}
                          </th>
                        ))}
                        <th className="px-2 py-2 text-left">Stock</th>
                        <th className="px-2 py-2 text-left">Price delta</th>
                        <th className="px-2 py-2 text-center">Active</th>
                        <th className="px-2 py-2 text-center">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100/60">
                      {draftVariants.items.map((variant, index) => (
                        <tr key={variant.id} className="align-top">
                          <td className="px-2 py-2 font-semibold text-ink-500">{index + 1}</td>
                          {variantFieldHeaders.map((header) => (
                            <td key={`${variant.id}:${header.key}`} className="px-2 py-2">
                              <input
                                type="text"
                                value={String(variant?.[header.key] || "")}
                                onChange={(event) =>
                                  updateVariantRow(variant.id, { [header.key]: event.target.value })
                                }
                                className="h-8 w-full min-w-[110px] rounded-lg border border-ink-100/70 bg-white px-2 text-[0.68rem] text-ink-700 outline-none transition focus:border-ink-300"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={safeNumber(variant.stock_qty)}
                              onChange={(event) =>
                                updateVariantRow(variant.id, {
                                  stock_qty:
                                    event.target.value === "" ? null : Number(event.target.value)
                                })
                              }
                              className="h-8 w-24 rounded-lg border border-ink-100/70 bg-white px-2 text-[0.68rem] text-ink-700 outline-none transition focus:border-ink-300"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={safeNumber(variant.price_delta)}
                              onChange={(event) =>
                                updateVariantRow(variant.id, {
                                  price_delta:
                                    event.target.value === "" ? null : Number(event.target.value)
                                })
                              }
                              className="h-8 w-28 rounded-lg border border-ink-100/70 bg-white px-2 text-[0.68rem] text-ink-700 outline-none transition focus:border-ink-300"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={variant.active !== false}
                              onChange={(event) =>
                                updateVariantRow(variant.id, { active: event.target.checked })
                              }
                              className="h-4 w-4 rounded border-ink-300 text-ink-900"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeVariantRow(variant.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600"
                              title="Remove variant"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-ink-200/70 bg-white/60 px-4 py-5 text-center text-xs text-ink-400">
                  No variant lines yet.
                </div>
              )}

              <button
                type="button"
                onClick={addVariantRow}
                disabled={!variantFieldHeaders.length}
                className="inline-flex items-center gap-2 rounded-full border border-ink-100/70 bg-white/70 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlusCircle className="h-4 w-4" />
                Add variant
              </button>
              {!variantFieldHeaders.length ? (
                <p className="text-[0.58rem] text-ink-400">
                  Add at least one category-governed header before creating variant rows.
                </p>
              ) : null}
                    </>
                  ) : null}

                  {activeSection === "categories" ? (
                    <>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Field
                  label="Primary category"
                  type="select"
                  value={selectedProductCategoryCode || ""}
                  options={productCategoryOptions}
                  hint="One category per product. Use '+ Create category...' from the dropdown when needed."
                  onChange={async (value) => {
                    if (value === CATEGORY_CREATE_OPTION) {
                      await handleCreateProductCategory();
                      return;
                    }
                    applyProductCategorySelection(value);
                  }}
                  disabled={productCategoryCatalogLoading}
                />
                <button
                  type="button"
                  onClick={() => loadProductCategoryCatalog()}
                  disabled={productCategoryCatalogLoading}
                  className="mt-6 inline-flex h-9 items-center gap-2 rounded-full border border-ink-100/70 bg-white/80 px-3 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-600 disabled:opacity-60"
                >
                  {productCategoryCatalogLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Field
                  label="Subcategory"
                  value={
                    String(
                      selectedProductCategory?.subcategories?.find((entry) => entry?.is_active !== false)
                        ?.label || ""
                    )
                  }
                  readOnly
                  hint={
                    selectedProductCategoryCode
                      ? "Managed from category profile."
                      : "Select a primary category first."
                  }
                />
                <button
                  type="button"
                  onClick={() => editProductCategory(selectedProductCategory)}
                  disabled={!selectedProductCategoryCode || productCategorySaveLoading}
                  className="mt-6 inline-flex h-9 items-center gap-2 rounded-full border border-ink-100/70 bg-white/80 px-3 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-600 disabled:opacity-60"
                >
                  {productCategorySaveLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BadgeCheck className="h-4 w-4" />
                  )}
                  Edit profile
                </button>
              </div>
              <div className="space-y-2 rounded-2xl border border-ink-100/70 bg-white/70 p-3">
                <p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-ink-500">
                  Category variant headers
                </p>
                {selectedProductCategoryCode ? (
                  (selectedProductCategory?.variant_headers || []).length ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedProductCategory.variant_headers.map((header) => (
                        <span
                          key={`${selectedProductCategoryCode}:${header.code}`}
                          className="inline-flex items-center rounded-full border border-ink-100/70 bg-white/80 px-3 py-1 text-[0.62rem] font-medium text-ink-600"
                        >
                          {header.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[0.62rem] text-ink-400">
                      No headers configured. Use Edit profile to add headers.
                    </p>
                  )
                ) : (
                  <p className="text-[0.62rem] text-ink-400">
                    Choose a category to view profile headers.
                  </p>
                )}
              </div>
              <TagInput
                label="Keywords"
                value={draft.attrs?.taxonomy?.tags || []}
                onChange={(value) => updateDraft(["taxonomy", "tags"], value)}
                placeholder="Add keywords"
                hint="Press Enter or comma to add tags."
              />
              <div className="space-y-2">
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                  Curation
                </p>
                <div className="flex flex-wrap gap-2">
                  {CURATION_TAGS.map((item) => {
                    const tags = Array.isArray(draft.attrs?.taxonomy?.tags)
                      ? draft.attrs.taxonomy.tags.map((tag) => String(tag || "").toLowerCase())
                      : [];
                    const selected = tags.includes(item.value);
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => toggleCurationTag(item.value)}
                        className={`rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] ${
                          selected
                            ? "bg-ink-900 text-white"
                            : "border border-ink-100/70 bg-white/70 text-ink-500"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
                    </>
                  ) : null}

                  {activeSection === "storefront" ? storefrontEditor : null}

                  {activeSection === "reviews" ? (
                    <>
                      <div className="flex flex-wrap items-end gap-2">
                        <Field
                          label="Status"
                          type="select"
                          value={reviewStatusFilter}
                          options={[
                            { value: "pending_review", label: "Pending review" },
                            { value: "approved", label: "Approved" },
                            { value: "rejected", label: "Rejected" },
                            { value: "hidden", label: "Hidden" },
                            { value: "all", label: "All statuses" }
                          ]}
                          onChange={(value) => setReviewStatusFilter(value || "pending_review")}
                        />
                        <button
                          type="button"
                          onClick={() => loadReviews(draft?.code, reviewStatusFilter)}
                          className="inline-flex h-[2.45rem] items-center gap-2 rounded-full border border-ink-100/70 bg-white/70 px-3.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-600"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Refresh
                        </button>
                      </div>
                      <div className="rounded-2xl border border-ink-100/60 bg-white/60 p-4">
                        {reviewsLoading ? (
                          <div className="inline-flex items-center gap-2 text-xs text-ink-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading reviews...
                          </div>
                        ) : reviewItems.length ? (
                          <div className="space-y-3">
                            {reviewItems.map((item) => {
                              const rating = Number(item.review?.rating || 0);
                              const moderation = item.review?.moderation || {};
                              const flaggedTerms = Array.isArray(moderation.flagged_terms)
                                ? moderation.flagged_terms
                                : [];
                              return (
                                <article
                                  key={item.id}
                                  className="rounded-xl border border-ink-100/70 bg-white/80 p-3 text-[0.75rem]"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <p className="font-semibold text-ink-700">
                                        {item.review?.title || "Untitled review"}
                                      </p>
                                      <p className="text-[0.65rem] uppercase tracking-[0.15em] text-ink-400">
                                        {item.product?.code || draft.code} · {item.status}
                                      </p>
                                    </div>
                                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-600">
                                      {"★".repeat(Math.max(0, Math.min(5, Math.round(rating))))}
                                      {"☆".repeat(Math.max(0, 5 - Math.round(rating)))}
                                    </p>
                                  </div>
                                  <p className="mt-2 text-ink-600">{item.review?.comment || "-"}</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.62rem] uppercase tracking-[0.15em] text-ink-400">
                                    <span>By {item.review?.reviewer?.name || "Anonymous"}</span>
                                    {item.review?.reviewer?.verified_purchase ? <span>Verified purchase</span> : null}
                                    {flaggedTerms.length ? (
                                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                                        Flagged: {flaggedTerms.join(", ")}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={reviewActionLoadingId === item.id}
                                      onClick={() => moderateReview(item.id, "approved")}
                                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-emerald-700 disabled:opacity-60"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      disabled={reviewActionLoadingId === item.id}
                                      onClick={() => moderateReview(item.id, "hidden")}
                                      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-amber-700 disabled:opacity-60"
                                    >
                                      <ShieldAlert className="h-3.5 w-3.5" />
                                      Hide
                                    </button>
                                    <button
                                      type="button"
                                      disabled={reviewActionLoadingId === item.id}
                                      onClick={() => moderateReview(item.id, "rejected")}
                                      className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-rose-700 disabled:opacity-60"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      Reject
                                    </button>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-ink-200/70 bg-white/60 px-4 py-6 text-center text-xs text-ink-400">
                            No reviews for this product in the selected status.
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}

                  {activeSection === "seo" ? (
                    <>
              <Field
                label="Meta title"
                value={draft.attrs?.seo?.title || ""}
                onChange={(value) => updateDraft(["seo", "title"], value)}
              />
              <Field
                label="Meta description"
                type="textarea"
                value={draft.attrs?.seo?.description || ""}
                onChange={(value) => updateDraft(["seo", "description"], value)}
              />
              <Field
                label="URL slug"
                value={draft.attrs?.seo?.slug || ""}
                onChange={(value) => updateDraft(["seo", "slug"], value)}
              />
                    </>
                  ) : null}

                </SectionPanel>
              </div>
            </div>
          </div>
        </section>
      </div>
      </>
      ) : null}
      <ImageAssetStudioModal
        open={imageStudioSession.open}
        sourceFile={imageStudioSession.file}
        title={imageStudioSession.title}
        recommendedSize={imageStudioSession.recommendedSize}
        presetProfiles={imageStudioSession.presetProfiles}
        defaultProfileId={imageStudioSession.defaultProfileId}
        onCancel={() => settleImageStudio(null)}
        onApply={(result) => settleImageStudio(result?.file || null)}
      />
      <ProductCategoryComposerModal
        open={Boolean(productCategoryComposer)}
        value={productCategoryComposer || defaultProductCategoryComposer()}
        error={productCategoryComposerError}
        headerOptions={productCategoryComposerHeaderOptions}
        selectedHeaders={productCategoryComposerSelectedHeaders}
        loading={productCategorySaveLoading}
        catalogLoading={variantHeaderCatalogLoading}
        onChange={(patch) => {
          setProductCategoryComposer((current) => {
            if (!current) return current;
            const nextPatch = typeof patch === "function" ? patch(current) : patch;
            return { ...current, ...(nextPatch || {}) };
          });
          if (productCategoryComposerError) setProductCategoryComposerError("");
        }}
        onAddHeader={addProductCategoryComposerHeader}
        onRemoveHeader={removeProductCategoryComposerHeader}
        onCreateHeader={handleCreateProductCategoryComposerHeader}
        onRefreshHeaders={loadVariantHeaderCatalog}
        onCancel={() => closeProductCategoryComposer(null)}
        onSubmit={submitProductCategoryComposer}
      />
      <ActionMiniModal
        open={Boolean(miniModalRequest)}
        mode={miniModalRequest?.mode || "confirm"}
        title={miniModalRequest?.title || "Confirm action"}
        message={miniModalRequest?.message || ""}
        inputLabel={miniModalRequest?.inputLabel || "Input"}
        inputPlaceholder={miniModalRequest?.inputPlaceholder || ""}
        defaultValue={miniModalRequest?.defaultValue || ""}
        required={Boolean(miniModalRequest?.required)}
        confirmLabel={miniModalRequest?.confirmLabel || "Confirm"}
        cancelLabel={miniModalRequest?.cancelLabel || "Cancel"}
        confirmTone={miniModalRequest?.confirmTone || "default"}
        onCancel={() => closeMiniModal(false)}
        onConfirm={(value) => closeMiniModal(true, value)}
      />
      <TradeConditionsDrawer
        open={showTradeConditions}
        product={draft}
        ui={productStudioUi.tradeConditions}
        isDigital={currentProductIsDigital}
        needsInventorySetup={currentProductNeedsInventorySetup}
        onClose={() => setShowTradeConditions(false)}
      />
    </section>
  );
}

function ProductStudioTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="glass-panel flex flex-wrap items-center gap-2 border border-ink-100/60 bg-white/70 p-3">
      {(tabs || DEFAULT_PRODUCT_STUDIO_UI.tabs).map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-full px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] transition ${
            activeTab === tab.id
              ? "bg-ink-900 text-white shadow-soft"
              : "border border-ink-100/70 bg-white/80 text-ink-600 hover:bg-white"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ProductFocusPanel({ focusItems, onSelectProduct, onOpenTradeConditions }) {
  const actionable = (focusItems || []).filter((group) => group.count > 0);
  const [selectedCode, setSelectedCode] = useState(() => actionable[0]?.code || focusItems?.[0]?.code || "");
  useEffect(() => {
    if (!focusItems?.some((group) => group.code === selectedCode)) {
      setSelectedCode(actionable[0]?.code || focusItems?.[0]?.code || "");
    }
  }, [actionable, focusItems, selectedCode]);
  const selected = (focusItems || []).find((group) => group.code === selectedCode) || actionable[0] || focusItems?.[0];
  const total = actionable.reduce((sum, group) => sum + group.count, 0);
  return (
    <section className="glass-panel border border-ink-100/60 bg-white/75 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">Product focus</p>
          <h3 className="mt-1 text-lg font-semibold text-ink-900">Complete product setup work</h3>
          <p className="mt-1 text-sm text-ink-500">Focus only on incomplete product/master-data activities. Operational stock and business-wide task scheduling stay outside Product Studio.</p>
        </div>
        <span className="rounded-full bg-ink-900 px-3 py-1 text-xs font-semibold text-white">{total} open</span>
      </div>

      <div className="mt-3 grid max-h-[32rem] min-h-[18rem] gap-2 overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
          {(focusItems || []).map((group) => (
            <button
              key={group.code}
              type="button"
              onClick={() => setSelectedCode(group.code)}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                selected?.code === group.code
                  ? "border-ink-900 bg-ink-900 text-white shadow-soft"
                  : "border-ink-100 bg-white text-ink-700 hover:border-brand-200"
              }`}
            >
              <span>
                <span className="block text-sm font-semibold">{group.label}</span>
                <span className={`mt-1 block text-xs ${selected?.code === group.code ? "text-white/70" : "text-ink-400"}`}>{group.action || "Complete setup"}</span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selected?.code === group.code ? "bg-white text-ink-900" : "border border-ink-100 bg-ink-50 text-ink-500"}`}>{group.count}</span>
            </button>
          ))}
        </div>

        <div className="min-h-0 rounded-2xl border border-ink-100 bg-ink-50/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-ink-400">Selected focus</p>
              <h4 className="text-base font-semibold text-ink-900">{selected?.label || "No focus item"}</h4>
            </div>
            <span className="rounded-full border border-ink-100 bg-white px-2.5 py-1 text-xs font-semibold text-ink-500">{selected?.count || 0}</span>
          </div>
          <div className="mt-3 max-h-[24rem] space-y-2 overflow-y-auto pr-1">
            {selected?.items?.length ? selected.items.map((item) => (
              <div key={`${selected.code}-${item.id}`} className="rounded-2xl border border-ink-100 bg-white px-3 py-3 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{item.title || item.name || "Untitled product"}</p>
                    <p className="mt-1 text-[0.65rem] uppercase tracking-[0.16em] text-ink-400">{item.code || "NO-CODE"} · {productStage(item)}</p>
                    <p className="mt-1 text-xs text-ink-500">{selected.action || "Complete this product activity."}</p>
                  </div>
                  <button type="button" onClick={() => onSelectProduct(item)} className="rounded-full bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white">
                    Open
                  </button>
                </div>
                {selected.code === "missing_trade_conditions" ? (
                  <button type="button" onClick={() => onOpenTradeConditions(item)} className="mt-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                    Complete trade terms
                  </button>
                ) : null}
              </div>
            )) : (
              <p className="rounded-2xl border border-dashed border-ink-200 bg-white/70 px-4 py-5 text-sm text-ink-400">
                No incomplete product activity in this focus area.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TradeConditionsDrawer({ open, product, ui, isDigital, needsInventorySetup, onClose }) {
  if (!open) return null;
  const conditions = productTradeConditions(product);
  const pricing = Array.isArray(product?.attrs?.pricing?.tiers) ? product.attrs.pricing.tiers : [];
  const links = Array.isArray(product?.attrs?.agent_links) ? product.attrs.agent_links : [];
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-ink-900/35 backdrop-blur-[2px]">
      <aside className="flex h-full w-full max-w-4xl flex-col border-l border-ink-100 bg-white shadow-strong">
        <div className="border-b border-ink-100 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">Product governance</p>
              <h3 className="mt-1 text-xl font-semibold text-ink-900">{ui?.title || "Trade conditions"}</h3>
              <p className="mt-1 text-sm text-ink-500">{ui?.subtitle || DEFAULT_PRODUCT_STUDIO_UI.tradeConditions.subtitle}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full border border-ink-100 bg-white p-2 text-ink-500">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <ConditionSection title="Marketplace conditions">
              <ConditionList items={conditions.filter((item) => String(item.category || item.condition_category || "").toLowerCase().includes("marketplace"))} />
            </ConditionSection>
            <ConditionSection title="Linked agents / suppliers / customers">
              {links.length ? links.map((link, index) => (
                <ConditionCard key={`link-${index}`} item={{ condition_type: link.role || "LINK", summary: link.name || link.code || "Linked party", status: link.status || "active" }} />
              )) : <EmptyCondition text="No linked agent/supplier/customer terms recorded on this product." />}
            </ConditionSection>
            <ConditionSection title="Trade conditions">
              <ConditionList items={conditions} />
            </ConditionSection>
            <ConditionSection title="Pricing conditions">
              {pricing.length ? pricing.map((tier, index) => (
                <ConditionCard key={`price-${index}`} item={{ condition_type: "PRICE", category: tier.region || "global", summary: `${tier.currency || "USD"} ${tier.amount ?? "-"}`, status: "active" }} />
              )) : <EmptyCondition text="No pricing conditions recorded." />}
            </ConditionSection>
            <ConditionSection title="Validity and renewal">
              <ConditionList items={conditions.filter((item) => item.valid_from || item.valid_to || item.renewal_task_status)} empty="No validity window or renewal task metadata recorded." />
            </ConditionSection>
            <ConditionSection title="Product / Inventory boundary">
              <ConditionCard
                item={{
                  condition_type: isDigital ? "DIGITAL_PRODUCT" : "PHYSICAL_PRODUCT",
                  summary: isDigital
                    ? "Physical inventory setup and stock operations are hidden for this product."
                    : needsInventorySetup
                      ? "Initial inventory setup can be completed here before activation; operational movements stay in Inventory."
                      : "Operational stock movements stay in the Inventory module.",
                  status: needsInventorySetup ? "needs_setup" : "governed"
                }}
              />
            </ConditionSection>
          </div>
        </div>
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-ink-100 bg-white px-5 py-3 shadow-soft">
          <p className="text-xs text-ink-400">Read-only governance view. Edit flows stay process/schema governed.</p>
          <button type="button" onClick={onClose} className="rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold text-white">
            Close
          </button>
        </div>
      </aside>
    </div>
  );
}

function ConditionSection({ title, children }) {
  return (
    <section className="rounded-2xl border border-ink-100 bg-ink-50/60 p-4">
      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink-500">{title}</h4>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function ConditionList({ items, empty = "No governed condition records available for this section." }) {
  return items?.length ? items.map((item, index) => <ConditionCard key={`condition-${index}`} item={item} />) : <EmptyCondition text={empty} />;
}

function ConditionCard({ item }) {
  const status = String(item.status || item.condition_status || "active").toLowerCase();
  const tone = status.includes("expired")
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : status.includes("expir")
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-ink-100 bg-white text-ink-700";
  return (
    <article className={`rounded-xl border px-3 py-3 text-sm ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{item.condition_type || item.type || "Condition"}</p>
          <p className="mt-1 text-xs opacity-80">{item.category || item.condition_category || item.scope || "product scope"}</p>
        </div>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.16em]">{status}</span>
      </div>
      <p className="mt-2">{item.summary || item.effect || item.description || "Governed commercial condition."}</p>
      {(item.valid_from || item.valid_to || item.renewal_task_status) ? (
        <p className="mt-2 text-xs opacity-80">
          {item.valid_from || "open"} to {item.valid_to || "open"} {item.renewal_task_status ? `· renewal ${item.renewal_task_status}` : ""}
        </p>
      ) : null}
    </article>
  );
}

function EmptyCondition({ text }) {
  return <p className="rounded-xl border border-dashed border-ink-200 bg-white/70 px-3 py-4 text-sm text-ink-400">{text}</p>;
}

function ProductCategoryComposerModal({
  open,
  value,
  error,
  headerOptions,
  selectedHeaders,
  loading,
  catalogLoading,
  onChange = () => {},
  onAddHeader = () => {},
  onRemoveHeader = () => {},
  onCreateHeader = () => {},
  onRefreshHeaders = () => {},
  onCancel = () => {},
  onSubmit = () => {}
}) {
  if (!open) return null;

  const selectedCode = String(value?.selectedVariantHeaderCode || "");
  const isEdit = String(value?.mode || "").toLowerCase() === "edit";
  const codePreview = isEdit
    ? normalizeProductCategoryCode(value?.sourceCode || value?.code || value?.label || "")
    : normalizeProductCategoryCode(value?.label || "");
  const modalTitle = isEdit ? "Edit product category" : "Create product category";
  const modalSubtitle = isEdit
    ? "Update one category, one subcategory, and governed variant headers."
    : "Define one category, one subcategory, and governed variant headers.";
  const submitLabel = isEdit ? "Save category" : "Create category";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-900/35 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-3xl rounded-[28px] border border-ink-100/70 bg-white/95 p-5 shadow-[0_28px_70px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[1.08rem] font-semibold tracking-tight text-ink-900">
              {modalTitle}
            </p>
            <p className="text-[0.78rem] text-ink-500">
              {modalSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-100/70 bg-white text-ink-500 transition hover:text-ink-700"
            aria-label="Close category modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
            <Field
              label="Category name"
              value={value?.label || ""}
              onChange={(nextValue) => onChange({ label: nextValue })}
              placeholder="Dress, Fabric, Accessory..."
            />
            <Field label="Code preview" value={codePreview || "Auto"} readOnly />
          </div>

          <Field
            label="Subcategory"
            value={value?.subcategory || ""}
            onChange={(nextValue) => onChange({ subcategory: nextValue })}
            placeholder="Evening wear"
            hint="One subcategory is required per category."
          />

          <div className="space-y-2 rounded-2xl border border-ink-100/70 bg-white/70 p-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
              <Field
                label="Allowed variant header"
                type="select"
                value={selectedCode}
                onChange={async (nextValue) => {
                  if (nextValue === VARIANT_HEADER_CREATE_OPTION) {
                    await onCreateHeader();
                    return;
                  }
                  onChange({ selectedVariantHeaderCode: nextValue });
                }}
                options={
                  headerOptions?.length
                    ? [
                        ...headerOptions.map((entry) => ({
                          value: entry.code,
                          label: `${entry.label} (${entry.code})`
                        })),
                        { value: VARIANT_HEADER_CREATE_OPTION, label: "+ Create header..." }
                      ]
                    : [
                        { value: VARIANT_HEADER_CREATE_OPTION, label: "+ Create header..." },
                        { value: "", label: catalogLoading ? "Loading headers..." : "No available headers" }
                      ]
                }
                disabled={catalogLoading}
                size="sm"
              />
              <button
                type="button"
                onClick={onAddHeader}
                disabled={
                  !selectedCode ||
                  selectedCode === VARIANT_HEADER_CREATE_OPTION ||
                  loading ||
                  catalogLoading
                }
                className="mt-6 inline-flex h-9 items-center gap-2 rounded-full border border-ink-100/70 bg-white/80 px-3 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PlusCircle className="h-4 w-4" />
                Add
              </button>
              <button
                type="button"
                onClick={onCreateHeader}
                disabled={loading || catalogLoading}
                className="mt-6 inline-flex h-9 items-center gap-2 rounded-full border border-ink-100/70 bg-white/80 px-3 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PlusCircle className="h-4 w-4" />
                Create
              </button>
              <button
                type="button"
                onClick={onRefreshHeaders}
                disabled={catalogLoading}
                className="mt-6 inline-flex h-9 items-center gap-2 rounded-full border border-ink-100/70 bg-white/80 px-3 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {catalogLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </button>
            </div>

            {selectedHeaders?.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedHeaders.map((entry) => (
                  <span
                    key={`category-composer-${entry.code}`}
                    className="inline-flex items-center gap-2 rounded-full border border-ink-100/70 bg-white px-3 py-1 text-[0.62rem] font-medium text-ink-600"
                  >
                    {entry.label}
                    <button
                      type="button"
                      onClick={() => onRemoveHeader(entry.code)}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-ink-400 transition hover:text-rose-600"
                      aria-label={`Remove ${entry.label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[0.62rem] text-ink-400">
                No variant headers selected yet.
              </p>
            )}
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-rose-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-ink-100/70 bg-white px-4 text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-ink-600"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-ink-900 px-4 text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionPanel({ title, icon: Icon, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-ink-100/60 pb-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.28em] text-ink-400">
        {Icon ? <Icon className="h-4 w-4 text-ink-400" /> : null}
        <span>{title}</span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function RichTextField({
  label,
  value,
  onChange = () => {},
  hint,
  placeholder
}) {
  const editorRef = useRef(null);
  const selectionRef = useRef(null);
  const [localValue, setLocalValue] = useState(value || "");
  const [isFocused, setIsFocused] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [toolbarState, setToolbarState] = useState({
    bold: false,
    italic: false,
    underline: false,
    block: "p"
  });

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value || "");
    }
  }, [value, isFocused]);

  useEffect(() => {
    if (!editorRef.current || isFocused) return;
    if (editorRef.current.innerHTML !== localValue) {
      editorRef.current.innerHTML = localValue || "";
    }
  }, [localValue, isFocused]);

  const saveSelection = () => {
    if (typeof window === "undefined" || !editorRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;
    selectionRef.current = range.cloneRange();
  };

  const restoreSelection = () => {
    if (typeof window === "undefined" || !editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    if (selectionRef.current) {
      selection.addRange(selectionRef.current);
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    selection.addRange(range);
  };

  const syncFromDom = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setLocalValue(html);
    onChange(html);
  };

  const normalizeBlockTag = (raw) => {
    const clean = String(raw || "")
      .toLowerCase()
      .replace(/[<>]/g, "")
      .trim();
    if (clean === "h2" || clean === "h3" || clean === "p") return clean;
    if (clean === "div" || clean === "normal") return "p";
    return "p";
  };

  const refreshToolbarState = () => {
    if (typeof document === "undefined") return;
    const nextBlock = normalizeBlockTag(document.queryCommandValue("formatBlock"));
    setToolbarState({
      bold: Boolean(document.queryCommandState("bold")),
      italic: Boolean(document.queryCommandState("italic")),
      underline: Boolean(document.queryCommandState("underline")),
      block: nextBlock
    });
  };

  const exec = (command, valueArg) => {
    if (typeof document === "undefined") return;
    restoreSelection();
    document.execCommand(
      "styleWithCSS",
      false,
      command === "underline" || command === "formatBlock" ? false : true
    );
    const arg =
      command === "formatBlock" && valueArg && !String(valueArg).startsWith("<")
        ? `<${valueArg}>`
        : valueArg;
    document.execCommand(command, false, arg);
    syncFromDom();
    saveSelection();
    refreshToolbarState();
  };

  const handleStyleChange = (event) => {
    const next = event.target.value;
    exec("formatBlock", next);
    event.target.blur();
  };

  const handleSizeChange = (event) => {
    const size = event.target.value;
    if (size) {
      exec("fontSize", size);
    }
    event.target.value = "";
    event.target.blur();
  };

  const insertLink = () => {
    restoreSelection();
    setLinkDraft("");
    setShowLinkModal(true);
  };

  const confirmInsertLink = (input) => {
    const url = String(input || "").trim();
    if (!url) return;
    exec("createLink", url);
    setShowLinkModal(false);
    setLinkDraft("");
  };

  return (
    <div className="block">
      <div className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
        {label}
      </div>
      <div className="mt-1 overflow-hidden rounded-xl border border-ink-200/50 bg-white/70">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100/60 px-2 py-1.5 text-[0.6rem] text-ink-500">
          <select
            value={toolbarState.block}
            onChange={handleStyleChange}
            onMouseDown={saveSelection}
            className="rounded-md border border-ink-100/70 bg-white/80 px-2 py-1 text-[0.6rem] font-semibold normal-case tracking-normal text-ink-500"
          >
            <option value="p">Paragraph</option>
            <option value="h3">Subheading</option>
            <option value="h2">Heading</option>
          </select>
          <select
            defaultValue=""
            onChange={handleSizeChange}
            onMouseDown={saveSelection}
            className="rounded-md border border-ink-100/70 bg-white/80 px-2 py-1 text-[0.6rem] font-semibold normal-case tracking-normal text-ink-500"
          >
            <option value="" disabled>
              Size
            </option>
            <option value="2">Small</option>
            <option value="3">Normal</option>
            <option value="4">Large</option>
            <option value="5">X-Large</option>
          </select>
          <button
            type="button"
            onClick={() => exec("bold")}
            onMouseDown={(event) => {
              event.preventDefault();
              saveSelection();
            }}
            className={`inline-flex h-6 items-center justify-center rounded-md border px-2 text-[0.6rem] font-bold normal-case tracking-normal ${
              toolbarState.bold
                ? "border-ink-900 bg-ink-900 text-white"
                : "border-ink-100/70 bg-white/80 text-ink-600 hover:bg-white"
            }`}
          >
            B
          </button>
          <button
            type="button"
            onClick={() => exec("italic")}
            onMouseDown={(event) => {
              event.preventDefault();
              saveSelection();
            }}
            className={`inline-flex h-6 items-center justify-center rounded-md border px-2 text-[0.6rem] font-semibold italic normal-case tracking-normal ${
              toolbarState.italic
                ? "border-ink-900 bg-ink-900 text-white"
                : "border-ink-100/70 bg-white/80 text-ink-600 hover:bg-white"
            }`}
          >
            I
          </button>
          <button
            type="button"
            onClick={() => exec("underline")}
            onMouseDown={(event) => {
              event.preventDefault();
              saveSelection();
            }}
            className={`inline-flex h-6 items-center justify-center rounded-md border px-2 text-[0.6rem] font-semibold normal-case tracking-normal ${
              toolbarState.underline
                ? "border-ink-900 bg-ink-900 text-white"
                : "border-ink-100/70 bg-white/80 text-ink-600 hover:bg-white"
            }`}
          >
            U
          </button>
          <button
            type="button"
            onClick={insertLink}
            onMouseDown={(event) => {
              event.preventDefault();
              saveSelection();
            }}
            className="inline-flex h-6 items-center justify-center rounded-md border border-ink-100/70 bg-white/80 px-2 text-[0.6rem] font-semibold normal-case tracking-normal text-ink-600 hover:bg-white"
          >
            Link
          </button>
          <button
            type="button"
            onClick={() => exec("insertParagraph")}
            onMouseDown={(event) => {
              event.preventDefault();
              saveSelection();
            }}
            className="inline-flex h-6 items-center justify-center rounded-md border border-ink-100/70 bg-white/80 px-2 text-[0.6rem] font-semibold normal-case tracking-normal text-ink-600 hover:bg-white"
          >
            Space
          </button>
        </div>
        <div className="relative">
          {!localValue && placeholder ? (
            <div className="pointer-events-none absolute left-3 top-2 text-[0.8rem] text-ink-400">
              {placeholder}
            </div>
          ) : null}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncFromDom}
            onFocus={() => {
              setIsFocused(true);
              saveSelection();
              refreshToolbarState();
            }}
            onKeyUp={() => {
              saveSelection();
              refreshToolbarState();
            }}
            onMouseUp={() => {
              saveSelection();
              refreshToolbarState();
            }}
            onBlur={() => {
              setIsFocused(false);
              saveSelection();
              syncFromDom();
            }}
            className="min-h-[8rem] max-h-[32rem] w-full resize-y overflow-auto bg-transparent px-3 py-2 text-[0.85rem] normal-case tracking-normal text-ink-700 outline-none [&_h2]:my-2 [&_h2]:text-[1.35rem] [&_h2]:font-semibold [&_h2]:leading-tight [&_h3]:my-1.5 [&_h3]:text-[1.1rem] [&_h3]:font-semibold [&_h3]:leading-snug [&_p]:my-1 [&_a]:text-sky-700 [&_a]:underline"
          />
        </div>
      </div>
      {hint ? <p className="mt-1 text-[0.6rem] text-ink-400 normal-case tracking-normal">{hint}</p> : null}
      <ActionMiniModal
        open={showLinkModal}
        mode="prompt"
        title="Insert link"
        message="Add a URL for the selected text."
        inputLabel="URL"
        inputPlaceholder="https://example.com"
        defaultValue={linkDraft}
        required
        confirmLabel="Insert"
        onCancel={() => {
          setShowLinkModal(false);
          setLinkDraft("");
        }}
        onConfirm={confirmInsertLink}
      />
    </div>
  );
}

function TagInput({
  label,
  value,
  onChange = () => {},
  hint,
  placeholder
}) {
  const [inputValue, setInputValue] = useState("");
  const tags = Array.isArray(value) ? value : [];

  const commitTags = (raw) => {
    const nextTags = String(raw || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!nextTags.length) return;
    const merged = [...tags];
    nextTags.forEach((tag) => {
      if (!merged.includes(tag)) merged.push(tag);
    });
    if (merged.length !== tags.length) {
      onChange(merged);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      if (!inputValue.trim()) return;
      commitTags(inputValue);
      setInputValue("");
      return;
    }
    if (event.key === "Backspace" && !inputValue && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (!inputValue.trim()) return;
    commitTags(inputValue);
    setInputValue("");
  };

  return (
    <label className="block text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
      {label}
      <div className="mt-1 rounded-xl border border-ink-200/50 bg-white/70 px-2 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-2 rounded-full border border-ink-100/70 bg-white/80 px-3 py-1 text-[0.65rem] font-medium text-ink-600"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((item) => item !== tag))}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-ink-400 transition hover:text-ink-700"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="min-w-[120px] flex-1 bg-transparent text-[0.75rem] text-ink-700 outline-none placeholder:text-ink-400"
          />
        </div>
      </div>
      {hint ? <p className="mt-1 text-[0.6rem] text-ink-400 normal-case tracking-normal">{hint}</p> : null}
    </label>
  );
}

function Field({
  label,
  value,
  onChange = () => {},
  type = "text",
  checked,
  hint,
  placeholder,
  readOnly,
  disabled,
  options,
  size = "md",
  rows = 4
}) {
  const sizeClasses = size === "sm" ? "text-[0.75rem] py-1.5" : "text-[0.85rem] py-2";
  if (type === "textarea") {
    return (
      <label className="block text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
        {label}
        <textarea
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={disabled}
          className={`mt-1 w-full rounded-xl border border-ink-200/50 px-3 ${sizeClasses} text-ink-700 ${
            readOnly ? "bg-ink-50/60 text-ink-500" : "bg-white/70"
          }`}
        />
        {hint ? <p className="mt-1 text-[0.55rem] text-ink-400 normal-case tracking-normal">{hint}</p> : null}
      </label>
    );
  }

  if (type === "select") {
    return (
      <label className="block text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
        {label}
        <select
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={`mt-1 w-full rounded-xl border border-ink-200/50 bg-white/70 px-3 ${sizeClasses} text-ink-700`}
        >
          {(options || []).map((option) => {
            const valueOption = typeof option === "string" ? option : option.value;
            const labelOption = typeof option === "string" ? option : option.label;
            return (
              <option key={valueOption} value={valueOption}>
                {labelOption}
              </option>
            );
          })}
        </select>
        {hint ? <p className="mt-1 text-[0.55rem] text-ink-400 normal-case tracking-normal">{hint}</p> : null}
      </label>
    );
  }

  if (type === "checkbox") {
    return (
      <label className="flex items-center gap-3 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-ink-300 text-ink-900"
        />
        {label}
      </label>
    );
  }

  return (
    <label className="block text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
      {label}
      <input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        className={`mt-1 w-full rounded-xl border border-ink-200/50 px-3 ${sizeClasses} text-ink-700 ${
          readOnly ? "bg-ink-50/60 text-ink-500" : "bg-white/70"
        }`}
      />
      {hint ? <p className="mt-1 text-[0.55rem] text-ink-400 normal-case tracking-normal">{hint}</p> : null}
    </label>
  );
}

function MediaFrame({ asset, variant = "tile", onRemove }) {
  if (!asset?.url && !asset?.preview_url) return null;
  const video = isVideoAsset(asset);
  const assetUrl = resolveAssetUrl(asset.preview_url || asset.url);
  const containerClass =
    variant === "hero"
      ? "aspect-video w-full"
      : variant === "strip"
        ? "aspect-[4/3] w-44 shrink-0"
        : "aspect-[4/3] w-full";

  return (
    <div className={`relative overflow-hidden rounded-xl border border-ink-100/60 bg-white/60 ${containerClass}`}>
      {video ? (
        <video src={assetUrl} controls className="h-full w-full object-cover" />
      ) : (
        <img src={assetUrl} alt={asset.name || "Media preview"} className="h-full w-full object-cover" />
      )}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-rose-600 shadow-soft"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-white/80 px-2 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-ink-500">
        {video ? "Video" : "Image"}
      </div>
    </div>
  );
}

