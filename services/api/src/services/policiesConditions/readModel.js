const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_SCAN_ROWS = 10000;
const PHYSICAL_TABLE = "eip_core.commercial_condition";
const TAXONOMY_MODULE = "policies_conditions";

export const DEFAULT_POLICY_DOMAINS = Object.freeze([
  {
    code: "COMMERCIAL",
    label: "Commercial",
    sort_order: 10,
    description: "Buying, selling, payment, price, discount, credit, settlement, Incoterms, and trading-party commercial conditions."
  },
  {
    code: "FINANCIAL",
    label: "Financial",
    sort_order: 20,
    description: "Internal cash, liquidity, debt, capital structure, financial ratio, investment, and borrowing policy."
  },
  {
    code: "APPROVAL_FRAMEWORK",
    label: "Approval Framework",
    sort_order: 30,
    description: "Approval thresholds, matrices, delegation of authority, and purchasing, expenditure, discount, borrowing, or investment approvals."
  },
  {
    code: "INVENTORY",
    label: "Inventory",
    sort_order: 40,
    description: "Reorder, safety stock, threshold, reservation, release, and storage policy."
  },
  {
    code: "FISCAL_TAX_TREATMENT",
    label: "Fiscal & Tax Treatment",
    sort_order: 50,
    description: "VAT, sales tax, tax classification, exemption, withholding, and fiscal jurisdiction treatment."
  },
  {
    code: "MARKETPLACE",
    label: "Marketplace",
    sort_order: 60,
    description: "Marketplace commissions, platform eligibility, channel pricing, conditions, and publication rules."
  },
  {
    code: "LOGISTICS",
    label: "Logistics",
    sort_order: 70,
    description: "Carrier selection, routing, dispatch, warehouse handling, delivery execution, transport rules, and operational lead-time rules."
  }
]);

const POLICY_TAXONOMY_LISTS = Object.freeze({
  domains: "POLICY_DOMAIN",
  families: "POLICY_FAMILY",
  condition_types: "POLICY_CONDITION_TYPE",
  condition_subtypes: "POLICY_CONDITION_SUBTYPE"
});

const POLICY_TAXONOMY_LIST_LABELS = Object.freeze({
  POLICY_DOMAIN: "Policy Domain",
  POLICY_FAMILY: "Policy Family",
  POLICY_CONDITION_TYPE: "Policy Condition Type",
  POLICY_CONDITION_SUBTYPE: "Policy Condition Subtype"
});

const SENSITIVE_KEY_PATTERN = /(secret|token|password|credential|cookie|authorization|signature|api[_-]?key|private[_-]?key|client[_-]?secret|raw[_-]?legal|legal[_-]?text|compliance[_-]?text)/i;
const SAFE_VALUE_KEY_PATTERN = /(amount|percentage|percent|quantity|qty|unit|currency|threshold|min|max|minimum|maximum|priority|days|rate|count|limit|enabled|allowed|mode|method|rounding|code|level)$/i;
const SENSITIVE_VALUE_PATTERN = /(bearer\s+|basic\s+|secret|password|token|private[_-]?key|api[_-]?key|-----BEGIN|sk_live|sk_test)/i;

const LEGACY_DOMAIN_MAP = new Map([
  ["SELLING", "COMMERCIAL"],
  ["PROCUREMENT", "COMMERCIAL"],
  ["TRADE_PARTY", "COMMERCIAL"],
  ["LOGISTICS_DELIVERY", "LOGISTICS"],
  ["INVENTORY", "INVENTORY"],
  ["MARKETPLACE", "MARKETPLACE"],
  ["FISCAL_TAX_TREATMENT", "FISCAL_TAX_TREATMENT"]
]);

const COMMERCIAL_MEANING_TYPES = new Set([
  "PAYMENT_TERM_CONDITION",
  "PAYMENT_TERMS",
  "TRADE_TERMS",
  "TRADE_CREDIT",
  "SETTLEMENT_TERMS",
  "PRICE",
  "DISCOUNT",
  "INCOTERM"
]);

const FINANCIAL_MEANING_TYPES = new Set([
  "CASH_POLICY",
  "LIQUIDITY_POLICY",
  "DEBT_LIMIT",
  "CAPITAL_STRUCTURE",
  "FINANCIAL_RATIO",
  "INVESTMENT_POLICY",
  "BORROWING_POLICY"
]);

const APPROVAL_MEANING_TYPES = new Set([
  "PURCHASE_APPROVAL",
  "EXPENDITURE_APPROVAL",
  "DISCOUNT_APPROVAL",
  "FINANCIAL_APPROVAL",
  "APPROVAL_MATRIX",
  "DELEGATION_OF_AUTHORITY"
]);

const INCOTERM_SUBTYPES = new Set(["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"]);

const LEGACY_MAPPINGS = [
  {
    match: { type: "INVENTORY_REORDER_POLICY", category: "INVENTORY" },
    classification: {
      policy_domain: "INVENTORY",
      policy_family: "REPLENISHMENT",
      condition_type: "REORDER_POLICY",
      condition_subtype: null,
      condition_nature: "INTERNAL_MANAGEMENT_POLICY",
      mapping_status: "mapped",
      mapping_source: "legacy_mapping"
    }
  },
  {
    match: { type: "SUPPLY_REORDER_CONDITION", category: "SUPPLY" },
    classification: {
      policy_domain: "LOGISTICS",
      policy_family: "LEAD_TIME_POLICY",
      condition_type: "SUPPLY_REORDER",
      condition_subtype: null,
      condition_nature: "HYBRID_POLICY",
      mapping_status: "mapped",
      mapping_source: "legacy_mapping"
    }
  },
  {
    match: { type: "SUPPLIER_PURCHASE_CONDITION", category: "PURCHASING" },
    classification: {
      policy_domain: "COMMERCIAL",
      policy_family: "SUPPLIER_TERMS",
      condition_type: "SUPPLIER_PURCHASE",
      condition_subtype: null,
      condition_nature: "EXTERNAL_TRADE_CONDITION",
      mapping_status: "mapped",
      mapping_source: "legacy_mapping"
    }
  },
  {
    match: { type: "PROCUREMENT_POLICY", category: "PURCHASING" },
    classification: {
      policy_domain: "COMMERCIAL",
      policy_family: "PURCHASE_REQUISITION",
      condition_type: "PROCUREMENT_ROUTE",
      condition_subtype: null,
      condition_nature: "INTERNAL_MANAGEMENT_POLICY",
      mapping_status: "mapped",
      mapping_source: "legacy_mapping"
    }
  },
  {
    match: { type: "MATERIAL_SUPPLIER_CONDITION", category: "PURCHASING" },
    classification: {
      policy_domain: "COMMERCIAL",
      policy_family: "SUPPLIER_SELECTION",
      condition_type: "MATERIAL_SUPPLIER",
      condition_subtype: null,
      condition_nature: "HYBRID_POLICY",
      mapping_status: "mapped",
      mapping_source: "legacy_mapping"
    }
  },
  {
    match: { type: "PAYMENT_TERM_CONDITION", category: "FINANCE" },
    classification: {
      policy_domain: "COMMERCIAL",
      policy_family: "PAYMENT_TERMS",
      condition_type: "PAYMENT_TERMS",
      condition_subtype: null,
      condition_nature: "EXTERNAL_TRADE_CONDITION",
      mapping_status: "mapped",
      mapping_source: "legacy_mapping"
    }
  },
  {
    match: { type: "FREIGHT_COST_CONDITION", category: "LOGISTICS" },
    classification: {
      policy_domain: "LOGISTICS",
      policy_family: "LANDED_COST",
      condition_type: "FREIGHT_COST",
      condition_subtype: null,
      condition_nature: "SYSTEM_CALCULATION_POLICY",
      mapping_status: "mapped",
      mapping_source: "legacy_mapping"
    }
  },
  {
    match: { type: "CASH_PURCHASE_CONDITION", category: "PURCHASING" },
    classification: {
      policy_domain: "NEEDS_REVIEW",
      policy_family: "CASHFLOW_CONTROL",
      condition_type: "CASH_PURCHASE_LIMIT",
      condition_subtype: null,
      condition_nature: "INTERNAL_MANAGEMENT_POLICY",
      mapping_status: "legacy_ambiguous",
      mapping_source: "legacy_mapping_unclear_finance_approval"
    }
  },
  {
    match: { type: "FOREX_RATE", category: "FOREX" },
    classification: {
      policy_domain: "NEEDS_REVIEW",
      policy_family: "CURRENCY_CONVERSION",
      condition_type: "FOREX_RATE",
      condition_subtype: null,
      condition_nature: "SYSTEM_CALCULATION_POLICY",
      mapping_status: "legacy_ambiguous",
      mapping_source: "legacy_mapping_unclear_finance_approval"
    }
  },
  {
    match: { type: "PRICE" },
    classification: {
      policy_domain: "COMMERCIAL",
      policy_family: "PRICE_POLICY",
      condition_type: "PRICE",
      condition_subtype: null,
      condition_nature: "INTERNAL_MANAGEMENT_POLICY",
      mapping_status: "mapped",
      mapping_source: "legacy_mapping"
    }
  },
  {
    match: { type: "TAX" },
    classification: {
      policy_domain: "FISCAL_TAX_TREATMENT",
      policy_family: "TAX_CATEGORY",
      condition_type: "TAX",
      condition_subtype: null,
      condition_nature: "REGULATION_DERIVED_OPERATIONAL_POLICY",
      mapping_status: "mapped",
      mapping_source: "legacy_mapping"
    }
  },
  {
    match: { type: "DISCOUNT" },
    classification: {
      policy_domain: "COMMERCIAL",
      policy_family: "DISCOUNT_POLICY",
      condition_type: "DISCOUNT",
      condition_subtype: null,
      condition_nature: "INTERNAL_MANAGEMENT_POLICY",
      mapping_status: "mapped",
      mapping_source: "legacy_mapping"
    }
  },
  {
    match: { type: "PAYMENT_TERMS" },
    classification: {
      policy_domain: "COMMERCIAL",
      policy_family: "PAYMENT_TERMS",
      condition_type: "PAYMENT_TERMS",
      condition_subtype: null,
      condition_nature: "EXTERNAL_TRADE_CONDITION",
      mapping_status: "mapped",
      mapping_source: "legacy_mapping"
    }
  },
  {
    match: { type: "TERMS" },
    classification: {
      policy_domain: "COMMERCIAL",
      policy_family: "CONTRACT_VALIDITY",
      condition_type: "TERMS",
      condition_subtype: null,
      condition_nature: "EXTERNAL_TRADE_CONDITION",
      mapping_status: "needs_review",
      mapping_source: "legacy_ambiguous"
    }
  },
  {
    match: { type: "TRADE_TERMS" },
    classification: {
      policy_domain: "COMMERCIAL",
      policy_family: "GENERAL_TERMS",
      condition_type: "NEEDS_REVIEW",
      condition_subtype: null,
      condition_nature: "EXTERNAL_TRADE_CONDITION",
      mapping_status: "legacy_ambiguous",
      mapping_source: "legacy_ambiguous"
    }
  }
];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asObject(value) {
  return isPlainObject(value) ? value : {};
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeCode(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeTaxonomyCode(value) {
  return normalizeCode(value)
    .replace(/[^A-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function labelFromCode(value) {
  const code = normalizeTaxonomyCode(value);
  if (!code) return "";
  return code
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizePage(value) {
  const parsed = Number(value || DEFAULT_PAGE);
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE;
  return Math.max(1, Math.floor(parsed));
}

function normalizePageSize(value) {
  const parsed = Number(value || DEFAULT_PAGE_SIZE);
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(parsed)));
}

function normalizeBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  const text = normalizeText(value).toLowerCase();
  if (["false", "0", "no", "off"].includes(text)) return false;
  if (["true", "1", "yes", "on"].includes(text)) return true;
  return fallback;
}

function normalizeFilterText(value) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeFilters(filters = {}) {
  return {
    q: normalizeFilterText(filters.q),
    policy_domain: normalizeFilterText(filters.policy_domain),
    policy_family: normalizeFilterText(filters.policy_family),
    condition_type: normalizeFilterText(filters.condition_type),
    condition_category: normalizeFilterText(filters.condition_category),
    condition_nature: normalizeFilterText(filters.condition_nature),
    status: normalizeFilterText(filters.status || filters.validity),
    scope_kind: normalizeFilterText(filters.scope_kind),
    include_legacy: normalizeBoolean(filters.include_legacy, true),
    page: normalizePage(filters.page),
    page_size: normalizePageSize(filters.page_size)
  };
}

function cloneClassification(value) {
  const source = asObject(value);
  return {
    policy_domain: normalizeFilterText(source.policy_domain),
    policy_family: normalizeFilterText(source.policy_family),
    condition_type: normalizeFilterText(source.condition_type),
    condition_subtype: normalizeFilterText(source.condition_subtype),
    condition_nature: normalizeFilterText(source.condition_nature),
    mapping_status: normalizeFilterText(source.mapping_status) || "mapped",
    mapping_source: normalizeFilterText(source.mapping_source) || "attrs.classification"
  };
}

function collectPotentialIncotermSubtypes(row = {}, classification = {}) {
  const attrs = asObject(row.attrs);
  const effect = asObject(row.effect);
  const scope = asObject(row.scope);
  return [
    classification.condition_subtype,
    row.condition_category,
    row.condition_type,
    attrs.incoterm,
    attrs.incoterms,
    attrs.classification?.condition_subtype,
    attrs.classification?.incoterm,
    effect.incoterm,
    effect.incoterms,
    effect.trade_terms?.incoterm,
    effect.payment_terms?.incoterm,
    scope.incoterm
  ].map(normalizeCode);
}

function inferIncotermSubtype(row = {}, classification = {}) {
  return collectPotentialIncotermSubtypes(row, classification).find((value) => INCOTERM_SUBTYPES.has(value)) || null;
}

function isIncotermRow(row = {}, classification = {}) {
  const type = normalizeCode(classification.condition_type || row.condition_type);
  const family = normalizeCode(classification.policy_family);
  const category = normalizeCode(row.condition_category);
  return type === "INCOTERM" || family === "INCOTERMS" || category === "INCOTERMS" || Boolean(inferIncotermSubtype(row, classification));
}

function canonicalDomainByMeaning(domain, classification = {}, row = {}) {
  const normalizedDomain = normalizeCode(domain);
  const type = normalizeCode(classification.condition_type || row.condition_type);
  const family = normalizeCode(classification.policy_family);
  const legacyType = normalizeCode(row.condition_type);

  if (isIncotermRow(row, classification)) return "COMMERCIAL";
  if (LEGACY_DOMAIN_MAP.has(normalizedDomain)) return LEGACY_DOMAIN_MAP.get(normalizedDomain);
  if (normalizedDomain !== "FINANCE_APPROVAL") return normalizedDomain || "NEEDS_REVIEW";

  const candidates = [type, family, legacyType].filter(Boolean);
  if (candidates.some((item) => COMMERCIAL_MEANING_TYPES.has(item))) return "COMMERCIAL";
  if (candidates.some((item) => FINANCIAL_MEANING_TYPES.has(item))) return "FINANCIAL";
  if (candidates.some((item) => APPROVAL_MEANING_TYPES.has(item))) return "APPROVAL_FRAMEWORK";
  return "NEEDS_REVIEW";
}

function canonicalizeClassification(classification = {}, row = {}) {
  const next = { ...classification };
  if (isIncotermRow(row, next)) {
    next.policy_domain = "COMMERCIAL";
    next.policy_family = "INCOTERMS";
    next.condition_type = "INCOTERM";
    next.condition_subtype = inferIncotermSubtype(row, next);
    next.condition_nature = next.condition_nature || "EXTERNAL_TRADE_CONDITION";
    next.mapping_status = next.mapping_status || "mapped";
    next.mapping_source = next.mapping_source || "incoterms_compatibility";
    return next;
  }

  const originalDomain = normalizeCode(next.policy_domain);
  const canonicalDomain = canonicalDomainByMeaning(originalDomain, next, row);
  if (originalDomain === "FINANCE_APPROVAL" && canonicalDomain === "NEEDS_REVIEW") {
    next.policy_domain = "NEEDS_REVIEW";
    next.mapping_status = "legacy_ambiguous";
    next.mapping_source = next.mapping_source || "finance_approval_compatibility";
    return next;
  }
  next.policy_domain = canonicalDomain;
  return next;
}

function legacyMatch(mapping, type, category) {
  if (mapping.match.type && mapping.match.type !== type) return false;
  if (mapping.match.category && mapping.match.category !== category) return false;
  return true;
}

export function deriveClassification(row = {}) {
  const attrs = asObject(row.attrs);
  if (isPlainObject(attrs.classification)) {
    return canonicalizeClassification(cloneClassification(attrs.classification), row);
  }

  const type = normalizeCode(row.condition_type);
  const category = normalizeCode(row.condition_category);
  if (isIncotermRow(row, { condition_type: type, policy_family: category })) {
    return canonicalizeClassification({
      policy_domain: "COMMERCIAL",
      policy_family: "INCOTERMS",
      condition_type: "INCOTERM",
      condition_subtype: inferIncotermSubtype(row, { condition_type: type, policy_family: category }),
      condition_nature: "EXTERNAL_TRADE_CONDITION",
      mapping_status: "mapped",
      mapping_source: "incoterms_compatibility"
    }, row);
  }
  const mapping = LEGACY_MAPPINGS.find((item) => legacyMatch(item, type, category));
  if (mapping) return canonicalizeClassification({ ...mapping.classification }, row);

  return canonicalizeClassification({
    policy_domain: "NEEDS_REVIEW",
    policy_family: "NEEDS_REVIEW",
    condition_type: type || "NEEDS_REVIEW",
    condition_subtype: null,
    condition_nature: "HYBRID_POLICY",
    mapping_status: "legacy_ambiguous",
    mapping_source: "unmapped_legacy_value"
  }, row);
}

export function deriveValidity(row = {}, now = new Date()) {
  const validFrom = row.valid_from ? new Date(row.valid_from) : null;
  const validTo = row.valid_to ? new Date(row.valid_to) : null;
  const isActive = row.is_active !== false;
  let status = "active";

  if (!isActive) {
    status = "inactive";
  } else if (validFrom && Number.isFinite(validFrom.getTime()) && validFrom > now) {
    status = "future";
  } else if (validTo && Number.isFinite(validTo.getTime()) && validTo < now) {
    status = "expired";
  }

  return {
    status,
    is_active: isActive,
    valid_from: row.valid_from || null,
    valid_to: row.valid_to || null,
    timezone: "UTC"
  };
}

function classifyScopeKind(scope = {}) {
  const keys = Object.keys(asObject(scope));
  const keySet = new Set(keys.map((key) => key.toLowerCase()));
  if (!keys.length) return "tenant";
  if ([...keySet].some((key) => key.includes("supplier"))) return "supplier";
  if ([...keySet].some((key) => key.includes("customer"))) return "customer";
  if ([...keySet].some((key) => key.includes("agent") || key.includes("partner") || key.includes("entity"))) return "entity";
  if ([...keySet].some((key) => key.includes("material") || key.includes("product"))) return "material_product";
  if ([...keySet].some((key) => key.includes("marketplace") || key.includes("channel"))) return "marketplace_channel";
  if ([...keySet].some((key) => key.includes("jurisdiction") || key.includes("country") || key.includes("region") || key.includes("geo"))) return "jurisdiction";
  if ([...keySet].some((key) => key.includes("warehouse") || key.includes("storage") || key.includes("location"))) return "storage";
  if ([...keySet].some((key) => key.includes("process") || key.includes("task"))) return "process_task";
  return "custom";
}

export function deriveScopeSummary(row = {}) {
  const scope = asObject(row.scope);
  const keys = Object.keys(scope).sort();
  return {
    scope_kind: classifyScopeKind(scope),
    keys,
    has_scope: keys.length > 0
  };
}

function hasSensitiveKeys(value) {
  if (Array.isArray(value)) return value.some((item) => hasSensitiveKeys(item));
  if (!isPlainObject(value)) return false;
  return Object.entries(value).some(([key, nested]) => SENSITIVE_KEY_PATTERN.test(key) || hasSensitiveKeys(nested));
}

function listSafeKeys(value) {
  if (!isPlainObject(value)) return [];
  return Object.keys(value)
    .filter((key) => !SENSITIVE_KEY_PATTERN.test(key))
    .sort();
}

function isSafeSummaryLeaf(key, value) {
  if (!SAFE_VALUE_KEY_PATTERN.test(key)) return false;
  if (value === null || value === undefined) return false;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text || text.length > 80) return false;
  if (SENSITIVE_VALUE_PATTERN.test(text)) return false;
  return true;
}

function collectSafeLeafValues(value, prefix = "", out = {}) {
  if (Array.isArray(value)) {
    if (prefix) out[prefix] = value.length;
    return out;
  }
  if (!isPlainObject(value)) {
    const key = prefix.split(".").pop() || "";
    if (prefix && isSafeSummaryLeaf(key, value)) {
      out[prefix] = value;
    }
    return out;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    const next = prefix ? `${prefix}.${key}` : key;
    collectSafeLeafValues(nested, next, out);
  }
  return out;
}

export function deriveValueSummary(row = {}) {
  const effect = asObject(row.effect);
  const attrs = asObject(row.attrs);
  const leaves = collectSafeLeafValues(effect);
  const fallbackLeaves = Object.keys(leaves).length ? leaves : collectSafeLeafValues(attrs);
  const valueFields = Object.fromEntries(Object.entries(fallbackLeaves).slice(0, 8));
  const effectBlocks = Object.entries(effect)
    .filter(([, value]) => isPlainObject(value))
    .map(([key]) => key)
    .sort();

  return {
    value_fields: valueFields,
    effect_blocks: effectBlocks,
    has_structured_values: Object.keys(valueFields).length > 0 || effectBlocks.length > 0
  };
}

export function deriveWarnings(row = {}, classification = deriveClassification(row), validity = deriveValidity(row)) {
  const warnings = [];
  const mappingStatus = normalizeText(classification.mapping_status);
  if (["needs_review", "legacy_ambiguous"].includes(mappingStatus)) {
    warnings.push({
      code: "CLASSIFICATION_NEEDS_REVIEW",
      message: "This legacy condition needs taxonomy review before it can be treated as fully governed policy."
    });
  }
  if (validity.status === "expired") {
    warnings.push({ code: "EXPIRED", message: "This condition is past its valid-to date." });
  }
  if (validity.status === "future") {
    warnings.push({ code: "FUTURE_DATED", message: "This condition is not yet effective." });
  }
  if (hasSensitiveKeys(row.scope) || hasSensitiveKeys(row.effect) || hasSensitiveKeys(row.attrs)) {
    warnings.push({
      code: "REDACTED_FIELDS",
      message: "Sensitive or raw legal fields were redacted from the read model."
    });
  }
  if (!Object.keys(asObject(row.scope)).length) {
    warnings.push({ code: "TENANT_DEFAULT_SCOPE", message: "No specific scope is set; this behaves as a tenant-default condition." });
  }
  return warnings;
}

function deriveRowStatus(classification, validity) {
  if (["expired", "future", "inactive"].includes(validity.status)) return validity.status;
  if (["needs_review", "legacy_ambiguous"].includes(classification.mapping_status)) return "needs_review";
  return "active";
}

export function mapCommercialConditionToPolicyCondition(row = {}, options = {}) {
  const classification = deriveClassification(row);
  const validity = deriveValidity(row, options.now || new Date());
  const scopeSummary = deriveScopeSummary(row);
  const warnings = deriveWarnings(row, classification, validity);
  const status = deriveRowStatus(classification, validity);

  return {
    id: row.id,
    code: row.code,
    label: row.label || row.code,
    status,
    legacy: {
      condition_type: row.condition_type || null,
      condition_category: row.condition_category || null,
      attrs_classification: isPlainObject(asObject(row.attrs).classification)
        ? cloneClassification(asObject(row.attrs).classification)
        : null
    },
    classification,
    scope_summary: scopeSummary,
    value_summary: deriveValueSummary(row),
    validity,
    priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : 100,
    warnings,
    source: {
      physical_table: PHYSICAL_TABLE,
      classification_source: classification.mapping_source
    },
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

function matchesText(item, q) {
  if (!q) return true;
  const haystack = [
    item.code,
    item.label,
    item.legacy?.condition_type,
    item.legacy?.condition_category,
    item.classification?.policy_domain,
    item.classification?.policy_family,
    item.classification?.condition_type,
    item.classification?.condition_nature
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(q.toLowerCase());
}

function matchesFilters(item, filters) {
  if (!matchesText(item, filters.q)) return false;
  if (filters.policy_domain && item.classification.policy_domain !== normalizeCode(filters.policy_domain)) return false;
  if (filters.policy_family && item.classification.policy_family !== normalizeCode(filters.policy_family)) return false;
  if (filters.condition_type) {
    const requested = normalizeCode(filters.condition_type);
    const mappedType = normalizeCode(item.classification.condition_type);
    const legacyType = normalizeCode(item.legacy.condition_type);
    if (mappedType !== requested && legacyType !== requested) return false;
  }
  if (filters.condition_category && normalizeCode(item.legacy.condition_category) !== normalizeCode(filters.condition_category)) return false;
  if (filters.condition_nature && item.classification.condition_nature !== normalizeCode(filters.condition_nature)) return false;
  if (filters.status && item.status !== normalizeText(filters.status).toLowerCase()) return false;
  if (filters.scope_kind && item.scope_summary.scope_kind !== normalizeText(filters.scope_kind).toLowerCase()) return false;
  if (!filters.include_legacy && item.classification.mapping_source !== "attrs.classification") return false;
  return true;
}

function buildSummary(items) {
  return {
    total: items.length,
    active: items.filter((item) => item.status === "active").length,
    expired: items.filter((item) => item.status === "expired").length,
    needs_review: items.filter((item) => item.status === "needs_review").length,
    ambiguous: items.filter((item) => ["needs_review", "legacy_ambiguous"].includes(item.classification.mapping_status)).length
  };
}

function emptyState() {
  return {
    title: "No policies or conditions yet",
    message: "Create governed business rules before EIP can explain recommendations for this area."
  };
}

function toItems(rows) {
  return rows.map((row) => mapCommercialConditionToPolicyCondition(row));
}

function filterItems(items, filters) {
  return items.filter((item) => matchesFilters(item, filters));
}

async function loadTenantConditionRows(app, tenantId) {
  const result = await app.db.query(
    `
    SELECT id, tenant_id, code, label, condition_type, condition_category, priority,
           valid_from, valid_to, is_active, scope, effect, attrs, created_at, updated_at
    FROM eip_core.commercial_condition
    WHERE tenant_id=$1
    ORDER BY priority ASC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, code ASC
    LIMIT $2
    `,
    [tenantId, MAX_SCAN_ROWS + 1]
  );
  const rows = result.rows || [];
  return {
    rows: rows.slice(0, MAX_SCAN_ROWS),
    truncated: rows.length > MAX_SCAN_ROWS
  };
}

function mapTaxonomyOption(row = {}) {
  const attrs = asObject(row.attrs);
  const code = normalizeTaxonomyCode(row.code);
  if (!code) return null;
  return {
    code,
    label: normalizeFilterText(row.label) || labelFromCode(code),
    description: normalizeFilterText(attrs.description),
    sort_order: Number(row.sort_order || 0),
    is_active: row.is_active !== false,
    source: row.tenant_id ? "tenant" : "default"
  };
}

function defaultDomainOptions() {
  return DEFAULT_POLICY_DOMAINS.map((item) => ({
    code: item.code,
    label: item.label,
    description: item.description,
    sort_order: item.sort_order,
    is_active: true,
    source: "default"
  }));
}

function emptyTaxonomyGroup(listCode) {
  return {
    code: listCode,
    label: POLICY_TAXONOMY_LIST_LABELS[listCode] || labelFromCode(listCode),
    options: []
  };
}

export async function getPolicyConditionTaxonomy(app, authContext) {
  const listCodes = Object.values(POLICY_TAXONOMY_LISTS);
  const result = await app.db.query(
    `
    WITH ranked AS (
      SELECT
        dl.code AS list_code,
        dl.name AS list_label,
        dv.code,
        dv.label,
        dv.sort_order,
        dv.is_active,
        dv.attrs,
        dl.tenant_id,
        row_number() OVER (
          PARTITION BY dl.code, upper(dv.code)
          ORDER BY (dl.tenant_id=$1::uuid) DESC, dl.version DESC, dv.sort_order ASC, dv.code ASC
        ) AS rn
      FROM eip_core.dropdown_list dl
      JOIN eip_core.dropdown_value dv ON dv.list_id=dl.id
      WHERE dl.module=$2
        AND dl.code=ANY($3::text[])
        AND dl.is_active=true
        AND (dl.tenant_id=$1::uuid OR dl.tenant_id IS NULL)
    )
    SELECT list_code, list_label, code, label, sort_order, is_active, attrs, tenant_id
    FROM ranked
    WHERE rn=1
    ORDER BY list_code ASC, sort_order ASC NULLS LAST, code ASC
    `,
    [authContext.tenant_id, TAXONOMY_MODULE, listCodes]
  );

  const byList = Object.fromEntries(
    listCodes.map((listCode) => [listCode, emptyTaxonomyGroup(listCode)])
  );
  for (const row of result.rows || []) {
    const listCode = normalizeTaxonomyCode(row.list_code);
    const option = mapTaxonomyOption(row);
    if (!listCode || !option || !byList[listCode]) continue;
    byList[listCode].label = normalizeFilterText(row.list_label) || byList[listCode].label;
    byList[listCode].options.push(option);
  }

  if (!byList.POLICY_DOMAIN.options.length) {
    byList.POLICY_DOMAIN.options = defaultDomainOptions();
  }

  return {
    ok: true,
    module: TAXONOMY_MODULE,
    read_only: true,
    closed_enum: false,
    lists: {
      domains: byList.POLICY_DOMAIN,
      families: byList.POLICY_FAMILY,
      condition_types: byList.POLICY_CONDITION_TYPE,
      condition_subtypes: byList.POLICY_CONDITION_SUBTYPE
    },
    defaults: {
      domains: defaultDomainOptions()
    },
    notes: [
      "Default domains are seeded governance values, not a closed enum.",
      "Inactive values remain readable for historical records but should not be selected by future editors."
    ]
  };
}

export async function listPolicyConditions(app, authContext, filters = {}) {
  const normalized = normalizeFilters(filters);
  const loaded = await loadTenantConditionRows(app, authContext.tenant_id);
  const mapped = toItems(loaded.rows);
  const filtered = filterItems(mapped, normalized);
  const totalPages = filtered.length ? Math.ceil(filtered.length / normalized.page_size) : 0;
  const page = totalPages ? Math.min(normalized.page, totalPages) : 1;
  const start = (page - 1) * normalized.page_size;
  const items = filtered.slice(start, start + normalized.page_size);

  return {
    ok: true,
    items,
    page,
    page_size: normalized.page_size,
    total: filtered.length,
    total_pages: totalPages,
    filters: normalized,
    summary: buildSummary(filtered),
    empty_state: emptyState(),
    warnings: loaded.truncated
      ? [{ code: "SCAN_LIMIT_REACHED", message: "Only the first 10000 policy rows were scanned; narrow filters for complete review." }]
      : []
  };
}

export async function getPolicyConditionDetail(app, authContext, id) {
  const result = await app.db.query(
    `
    SELECT id, tenant_id, code, label, condition_type, condition_category, priority,
           valid_from, valid_to, is_active, scope, effect, attrs, created_at, updated_at
    FROM eip_core.commercial_condition
    WHERE tenant_id=$1 AND id=$2
    LIMIT 1
    `,
    [authContext.tenant_id, id]
  );
  const row = result.rows?.[0] || null;
  if (!row) return null;

  const item = mapCommercialConditionToPolicyCondition(row);
  const scope = asObject(row.scope);
  const effect = asObject(row.effect);
  const attrs = asObject(row.attrs);
  return {
    ok: true,
    item: {
      ...item,
      governance_summary: {
        owner_surface: asObject(row.attrs).governance_source || "commercial_condition",
        read_only_phase: true,
        mutation_available: false
      },
      source_summary: {
        physical_table: PHYSICAL_TABLE,
        original_condition_type: row.condition_type || null,
        original_condition_category: row.condition_category || null
      },
      safe_machine_fields: {
        scope_keys: listSafeKeys(scope),
        effect_blocks: Object.entries(effect).filter(([, value]) => isPlainObject(value)).map(([key]) => key).filter((key) => !SENSITIVE_KEY_PATTERN.test(key)).sort(),
        attrs_keys: listSafeKeys(attrs),
        value_summary: item.value_summary
      }
    }
  };
}

export async function getPoliciesConditionsOverview(app, authContext) {
  const loaded = await loadTenantConditionRows(app, authContext.tenant_id);
  const items = toItems(loaded.rows);
  const byDomain = {};
  const byStatus = {};
  for (const item of items) {
    const domain = item.classification.policy_domain || "NEEDS_REVIEW";
    byDomain[domain] = (byDomain[domain] || 0) + 1;
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
  }
  return {
    ok: true,
    summary: buildSummary(items),
    by_domain: byDomain,
    by_status: byStatus,
    empty_state: emptyState(),
    warnings: loaded.truncated
      ? [{ code: "SCAN_LIMIT_REACHED", message: "Only the first 10000 policy rows were scanned; narrow filters for complete review." }]
      : []
  };
}
