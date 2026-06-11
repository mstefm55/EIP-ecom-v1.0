const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_SCAN_ROWS = 10000;
const PHYSICAL_TABLE = "eip_core.commercial_condition";

const SENSITIVE_KEY_PATTERN = /(secret|token|password|credential|cookie|authorization|signature|api[_-]?key|private[_-]?key|client[_-]?secret|raw[_-]?legal|legal[_-]?text|compliance[_-]?text)/i;
const SAFE_VALUE_KEY_PATTERN = /(amount|percentage|percent|quantity|qty|unit|currency|threshold|min|max|minimum|maximum|priority|days|rate|count|limit|enabled|allowed|mode|method|rounding|code|level)$/i;
const SENSITIVE_VALUE_PATTERN = /(bearer\s+|basic\s+|secret|password|token|private[_-]?key|api[_-]?key|-----BEGIN|sk_live|sk_test)/i;

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
      policy_domain: "LOGISTICS_DELIVERY",
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
      policy_domain: "PROCUREMENT",
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
      policy_domain: "PROCUREMENT",
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
      policy_domain: "PROCUREMENT",
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
      policy_domain: "TRADE_PARTY",
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
      policy_domain: "LOGISTICS_DELIVERY",
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
      policy_domain: "FINANCE_APPROVAL",
      policy_family: "CASHFLOW_CONTROL",
      condition_type: "CASH_PURCHASE_LIMIT",
      condition_subtype: null,
      condition_nature: "INTERNAL_MANAGEMENT_POLICY",
      mapping_status: "mapped",
      mapping_source: "legacy_mapping"
    }
  },
  {
    match: { type: "FOREX_RATE", category: "FOREX" },
    classification: {
      policy_domain: "FINANCE_APPROVAL",
      policy_family: "CURRENCY_CONVERSION",
      condition_type: "FOREX_RATE",
      condition_subtype: null,
      condition_nature: "SYSTEM_CALCULATION_POLICY",
      mapping_status: "mapped",
      mapping_source: "legacy_mapping"
    }
  },
  {
    match: { type: "PRICE" },
    classification: {
      policy_domain: "SELLING",
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
      policy_domain: "SELLING",
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
      policy_domain: "TRADE_PARTY",
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
      policy_domain: "TRADE_PARTY",
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
      policy_domain: "TRADE_PARTY",
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

function legacyMatch(mapping, type, category) {
  if (mapping.match.type && mapping.match.type !== type) return false;
  if (mapping.match.category && mapping.match.category !== category) return false;
  return true;
}

export function deriveClassification(row = {}) {
  const attrs = asObject(row.attrs);
  if (isPlainObject(attrs.classification)) {
    return cloneClassification(attrs.classification);
  }

  const type = normalizeCode(row.condition_type);
  const category = normalizeCode(row.condition_category);
  const mapping = LEGACY_MAPPINGS.find((item) => legacyMatch(item, type, category));
  if (mapping) return { ...mapping.classification };

  return {
    policy_domain: "NEEDS_REVIEW",
    policy_family: "NEEDS_REVIEW",
    condition_type: type || "NEEDS_REVIEW",
    condition_subtype: null,
    condition_nature: "HYBRID_POLICY",
    mapping_status: "legacy_ambiguous",
    mapping_source: "unmapped_legacy_value"
  };
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
      condition_category: row.condition_category || null
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
