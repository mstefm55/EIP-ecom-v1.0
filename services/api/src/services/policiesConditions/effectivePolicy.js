import { mapCommercialConditionToPolicyCondition } from "./readModel.js";

const MAX_SCAN_ROWS = 10000;
const PHYSICAL_TABLE = "eip_core.commercial_condition";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const SAFE_TEXT_PATTERN = /^[A-Za-z0-9 ._:/-]{1,120}$/;
const SENSITIVE_KEY_PATTERN = /(secret|token|password|credential|cookie|authorization|signature|api[_-]?key|private[_-]?key|client[_-]?secret|raw[_-]?legal|legal[_-]?text|compliance[_-]?text)/i;
const SENSITIVE_VALUE_PATTERN = /(bearer\s+|basic\s+|secret|password|token|private[_-]?key|api[_-]?key|-----BEGIN|sk_live|sk_test|raw legal|legal text|compliance text)/i;

const DEFAULT_POLICY_DOMAINS = new Set([
  "COMMERCIAL",
  "FINANCIAL",
  "APPROVAL_FRAMEWORK",
  "INVENTORY",
  "FISCAL_TAX_TREATMENT",
  "MARKETPLACE",
  "LOGISTICS"
]);

const ALLOWED_QUERY_FIELDS = new Set([
  "policy_domain",
  "policy_family",
  "condition_type",
  "condition_subtype",
  "material_id",
  "product_id",
  "supplier_agent_id",
  "customer_agent_id",
  "marketplace_agent_id",
  "warehouse_agent_id",
  "jurisdiction",
  "channel",
  "quantity",
  "amount",
  "currency",
  "effective_at",
  "process_type",
  "process_id",
  "task_type",
  "task_id"
]);

const UUID_FIELDS = new Set([
  "material_id",
  "product_id",
  "supplier_agent_id",
  "customer_agent_id",
  "marketplace_agent_id",
  "warehouse_agent_id",
  "process_id",
  "task_id"
]);

const NUMBER_FIELDS = new Set(["quantity", "amount"]);
const TAXONOMY_FIELDS = new Set(["policy_domain", "policy_family", "condition_type", "condition_subtype"]);
const CODE_TEXT_FIELDS = new Set(["jurisdiction", "channel", "process_type", "task_type"]);

const SCOPE_DIMENSIONS = [
  {
    name: "process",
    weight: 70,
    contextFields: ["process_id"],
    aliases: ["process_id", "process_ids", "source_process_id", "source_process_ids"]
  },
  {
    name: "task",
    weight: 70,
    contextFields: ["task_id"],
    aliases: ["task_id", "task_ids", "source_task_id", "source_task_ids"]
  },
  {
    name: "process_type",
    weight: 55,
    contextFields: ["process_type"],
    aliases: ["process_type", "process_types", "scor_process", "scor_processes"]
  },
  {
    name: "task_type",
    weight: 55,
    contextFields: ["task_type"],
    aliases: ["task_type", "task_types"]
  },
  {
    name: "material",
    weight: 50,
    contextFields: ["material_id"],
    aliases: ["material_id", "material_ids", "material", "materials"]
  },
  {
    name: "product",
    weight: 50,
    contextFields: ["product_id"],
    aliases: ["product_id", "product_ids", "product", "products"]
  },
  {
    name: "supplier",
    weight: 40,
    contextFields: ["supplier_agent_id"],
    aliases: ["supplier_agent_id", "supplier_agent_ids", "supplier_id", "supplier_ids", "vendor_agent_id", "vendor_agent_ids", "vendor_id", "vendor_ids", "preferred_supplier_agent_id"]
  },
  {
    name: "customer",
    weight: 40,
    contextFields: ["customer_agent_id"],
    aliases: ["customer_agent_id", "customer_agent_ids", "customer_id", "customer_ids", "buyer_agent_id", "buyer_agent_ids", "buyer_id", "buyer_ids"]
  },
  {
    name: "party",
    weight: 40,
    contextFields: ["supplier_agent_id", "customer_agent_id", "marketplace_agent_id"],
    aliases: ["agent_id", "agent_ids", "entity_id", "entity_ids", "party_agent_id", "party_agent_ids", "party_id", "party_ids"]
  },
  {
    name: "marketplace",
    weight: 35,
    contextFields: ["marketplace_agent_id"],
    aliases: ["marketplace_agent_id", "marketplace_agent_ids", "marketplace_id", "marketplace_ids", "platform_agent_id", "platform_agent_ids", "platform_id", "platform_ids"]
  },
  {
    name: "warehouse",
    weight: 35,
    contextFields: ["warehouse_agent_id"],
    aliases: ["warehouse_agent_id", "warehouse_agent_ids", "warehouse_id", "warehouse_ids", "storage_agent_id", "storage_agent_ids", "storage_location_id", "storage_location_ids", "location_id", "location_ids"]
  },
  {
    name: "channel",
    weight: 25,
    contextFields: ["channel"],
    aliases: ["channel", "channels", "sales_channel", "sales_channels", "commerce_channel", "commerce_channels"]
  },
  {
    name: "jurisdiction",
    weight: 20,
    contextFields: ["jurisdiction"],
    aliases: ["jurisdiction", "jurisdictions", "country", "countries", "region", "regions", "tax_jurisdiction", "tax_jurisdictions"]
  }
];

export class EffectivePolicyInputError extends Error {
  constructor(details = []) {
    super("INVALID_EFFECTIVE_POLICY_CONTEXT");
    this.name = "EffectivePolicyInputError";
    this.statusCode = 400;
    this.details = details;
  }
}

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
  return normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function normalizeComparable(value) {
  return normalizeText(value).toUpperCase();
}

function redactText(value, fallback = null) {
  const text = normalizeText(value);
  if (!text) return fallback;
  if (SENSITIVE_VALUE_PATTERN.test(text)) return "[redacted]";
  return text.slice(0, 160);
}

function detail(field, code) {
  return { field, code };
}

function singleQueryValue(value) {
  if (Array.isArray(value)) return { ok: false, value: null };
  return { ok: true, value };
}

function parseEffectiveAt(value, details) {
  if (value === undefined || value === null || value === "") return new Date();
  const text = normalizeText(value);
  const parsed = new Date(text);
  if (!text || !Number.isFinite(parsed.getTime())) {
    details.push(detail("effective_at", "invalid_date"));
    return null;
  }
  return parsed;
}

export function normalizeEffectivePolicyQuery(query = {}) {
  const source = isPlainObject(query) ? query : {};
  const details = [];
  const normalized = {};

  for (const key of Object.keys(source)) {
    if (key === "tenant_id") {
      details.push(detail(key, "tenant_id_not_allowed"));
      continue;
    }
    if (!ALLOWED_QUERY_FIELDS.has(key)) {
      details.push(detail(key, "unknown_field"));
    }
  }

  for (const field of ALLOWED_QUERY_FIELDS) {
    if (!(field in source) || source[field] === undefined || source[field] === null || source[field] === "") continue;
    const single = singleQueryValue(source[field]);
    if (!single.ok) {
      details.push(detail(field, "multiple_values_not_allowed"));
      continue;
    }
    const text = normalizeText(single.value);
    if (!text) continue;

    if (UUID_FIELDS.has(field)) {
      if (!UUID_PATTERN.test(text)) {
        details.push(detail(field, "invalid_uuid"));
        continue;
      }
      normalized[field] = text.toLowerCase();
      continue;
    }

    if (NUMBER_FIELDS.has(field)) {
      const parsed = Number(text);
      if (!Number.isFinite(parsed) || parsed < 0) {
        details.push(detail(field, "invalid_number"));
        continue;
      }
      normalized[field] = parsed;
      continue;
    }

    if (field === "currency") {
      const currency = text.toUpperCase();
      if (!CURRENCY_PATTERN.test(currency)) {
        details.push(detail(field, "invalid_currency"));
        continue;
      }
      normalized.currency = currency;
      continue;
    }

    if (field === "effective_at") continue;

    if (TAXONOMY_FIELDS.has(field)) {
      const code = normalizeCode(text);
      if (!code || code.length > 80) {
        details.push(detail(field, "invalid_code"));
        continue;
      }
      normalized[field] = code;
      continue;
    }

    if (CODE_TEXT_FIELDS.has(field)) {
      if (!SAFE_TEXT_PATTERN.test(text)) {
        details.push(detail(field, "invalid_text"));
        continue;
      }
      normalized[field] = normalizeCode(text);
    }
  }

  const effectiveAt = parseEffectiveAt(source.effective_at, details);
  if (details.length || !effectiveAt) throw new EffectivePolicyInputError(details);
  normalized.effective_at = effectiveAt.toISOString();
  Object.defineProperty(normalized, "_effectiveAtDate", {
    value: effectiveAt,
    enumerable: false
  });
  return normalized;
}

function requestedContext(context = {}) {
  return Object.fromEntries(
    Object.entries(context).filter(([key]) => key !== "_effectiveAtDate")
  );
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

function warning(code, message) {
  return { code, message };
}

function conflict(code, message, conditionCodes = []) {
  return { code, message, condition_codes: conditionCodes.filter(Boolean).map((item) => redactText(item, "[redacted]")) };
}

function dedupeByCode(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.code || ""}:${item.message || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function conditionSummary(candidateOrItem) {
  const candidate = candidateOrItem?.item ? candidateOrItem : null;
  const item = candidate ? candidate.item : candidateOrItem;
  if (!item) return null;
  const scopeSummary = item.scope_summary
    ? {
        ...item.scope_summary,
        keys: (item.scope_summary.keys || []).filter((key) => !SENSITIVE_KEY_PATTERN.test(key))
      }
    : item.scope_summary;
  const summary = {
    id: item.id || null,
    code: redactText(item.code),
    label: redactText(item.label || item.code),
    status: item.status,
    classification: item.classification,
    scope_summary: scopeSummary,
    value_summary: item.value_summary,
    validity: item.validity,
    priority: item.priority,
    warnings: item.warnings || [],
    source: item.source,
    created_at: item.created_at || null,
    updated_at: item.updated_at || null
  };
  if (candidate) {
    summary.resolution = {
      specificity_score: candidate.specificityScore,
      specificity_factors: candidate.specificityFactors,
      resolution_mode: candidate.resolutionMode
    };
  }
  return summary;
}

function excludedCondition(candidateOrItem, reason, explanation, reasons = [reason]) {
  return {
    reason,
    reasons,
    condition: conditionSummary(candidateOrItem),
    explanation
  };
}

function classificationMismatch(row, item, context) {
  const classification = item.classification || {};
  const fields = [
    ["policy_domain", "domain_mismatch"],
    ["policy_family", "family_mismatch"],
    ["condition_type", "type_mismatch"],
    ["condition_subtype", "subtype_mismatch"]
  ];
  for (const [field, reason] of fields) {
    if (!context[field]) continue;
    const requested = normalizeCode(context[field]);
    const actual = normalizeCode(classification[field]);
    if (actual === requested) continue;
    if (field === "condition_type" && normalizeCode(row.condition_type) === requested) continue;
    return reason;
  }
  return null;
}

function isAmbiguousClassification(item) {
  const classification = item.classification || {};
  const status = normalizeCode(classification.mapping_status);
  return status === "NEEDS_REVIEW"
    || status === "LEGACY_AMBIGUOUS"
    || normalizeCode(classification.policy_domain) === "NEEDS_REVIEW"
    || normalizeCode(classification.policy_family) === "NEEDS_REVIEW"
    || normalizeCode(classification.condition_type) === "NEEDS_REVIEW";
}

function valuesFromScope(scope, aliases) {
  const values = [];
  const matchedKeys = [];
  for (const alias of aliases) {
    if (!Object.prototype.hasOwnProperty.call(scope, alias)) continue;
    matchedKeys.push(alias);
    const value = scope[alias];
    const rawValues = Array.isArray(value) ? value : [value];
    for (const raw of rawValues) {
      if (raw === undefined || raw === null || isPlainObject(raw)) continue;
      const text = normalizeComparable(raw);
      if (text) values.push(text);
    }
  }
  return {
    present: matchedKeys.length > 0,
    values: [...new Set(values)],
    keys: matchedKeys
  };
}

function valuesFromContext(context, fields) {
  return [...new Set(fields.map((field) => normalizeComparable(context[field])).filter(Boolean))];
}

function evaluateScope(row, context) {
  const scope = asObject(row.scope);
  const keys = Object.keys(scope);
  if (!keys.length) {
    return { match: true, specificityScore: 0, specificityFactors: ["tenant_default"] };
  }

  let checkedDimensions = 0;
  let specificityScore = 0;
  const specificityFactors = [];

  for (const dimension of SCOPE_DIMENSIONS) {
    const scoped = valuesFromScope(scope, dimension.aliases);
    if (!scoped.present) continue;
    checkedDimensions += 1;
    const contextValues = valuesFromContext(context, dimension.contextFields);
    if (!contextValues.length) {
      return {
        match: false,
        reason: "missing_context",
        specificityScore,
        specificityFactors,
        missing_field: dimension.contextFields[0]
      };
    }
    if (!scoped.values.some((value) => contextValues.includes(value))) {
      return {
        match: false,
        reason: "scope_mismatch",
        specificityScore,
        specificityFactors,
        mismatched_field: dimension.contextFields[0]
      };
    }
    specificityScore += dimension.weight;
    specificityFactors.push(dimension.name);
  }

  const scopedCurrency = valuesFromScope(scope, ["currency", "currencies"]);
  if (scopedCurrency.present) {
    checkedDimensions += 1;
    if (!context.currency) {
      return {
        match: false,
        reason: "missing_context",
        specificityScore,
        specificityFactors,
        missing_field: "currency"
      };
    }
    if (!scopedCurrency.values.includes(normalizeComparable(context.currency))) {
      return {
        match: false,
        reason: "conflicting_currency",
        specificityScore,
        specificityFactors,
        mismatched_field: "currency"
      };
    }
    specificityFactors.push("currency");
  }

  const quantityCheck = evaluateRangeScope(scope, context, {
    field: "quantity",
    minimumAliases: ["min_qty", "minimum_qty", "min_quantity", "minimum_quantity", "quantity_min"],
    maximumAliases: ["max_qty", "maximum_qty", "max_quantity", "maximum_quantity", "quantity_max"]
  });
  if (!quantityCheck.match) return { ...quantityCheck, specificityScore, specificityFactors };
  if (quantityCheck.present) {
    checkedDimensions += 1;
    specificityScore += 10;
    specificityFactors.push("quantity");
  }

  const amountCheck = evaluateRangeScope(scope, context, {
    field: "amount",
    minimumAliases: ["min_amount", "minimum_amount", "amount_min", "threshold_min"],
    maximumAliases: ["max_amount", "maximum_amount", "amount_max", "threshold_max"]
  });
  if (!amountCheck.match) return { ...amountCheck, specificityScore, specificityFactors };
  if (amountCheck.present) {
    checkedDimensions += 1;
    specificityScore += 10;
    specificityFactors.push("amount");
  }

  if (!checkedDimensions) {
    return {
      match: false,
      reason: "missing_context",
      specificityScore,
      specificityFactors,
      missing_field: "scope"
    };
  }

  return { match: true, specificityScore, specificityFactors };
}

function firstFiniteScopeNumber(scope, aliases) {
  for (const alias of aliases) {
    if (!Object.prototype.hasOwnProperty.call(scope, alias)) continue;
    const value = Number(scope[alias]);
    if (Number.isFinite(value)) return { present: true, value };
    return { present: true, value: null };
  }
  return { present: false, value: null };
}

function evaluateRangeScope(scope, context, config) {
  const minimum = firstFiniteScopeNumber(scope, config.minimumAliases);
  const maximum = firstFiniteScopeNumber(scope, config.maximumAliases);
  if (!minimum.present && !maximum.present) return { match: true, present: false };
  if (!Number.isFinite(context[config.field])) {
    return { match: false, present: true, reason: "missing_context", missing_field: config.field };
  }
  if (minimum.present && Number.isFinite(minimum.value) && context[config.field] < minimum.value) {
    return { match: false, present: true, reason: "scope_mismatch", mismatched_field: config.field };
  }
  if (maximum.present && Number.isFinite(maximum.value) && context[config.field] > maximum.value) {
    return { match: false, present: true, reason: "scope_mismatch", mismatched_field: config.field };
  }
  return { match: true, present: true };
}

function collectCurrencies(value, out = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectCurrencies(item, out);
    return out;
  }
  if (!isPlainObject(value)) return out;
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    if (normalizeCode(key) === "CURRENCY" && typeof nested === "string") {
      const currency = nested.trim().toUpperCase();
      if (CURRENCY_PATTERN.test(currency)) out.add(currency);
      continue;
    }
    collectCurrencies(nested, out);
  }
  return out;
}

function evaluateCurrency(row, context) {
  if (!context.currency) return { match: true };
  const currencies = new Set([
    ...collectCurrencies(asObject(row.effect)),
    ...collectCurrencies(asObject(row.attrs))
  ]);
  if (!currencies.size || currencies.has(context.currency)) return { match: true };
  return { match: false, reason: "conflicting_currency", currencies: [...currencies] };
}

function resolutionMode(row) {
  const mode = normalizeCode(asObject(row.attrs).resolution_mode).toLowerCase();
  return mode === "stackable" ? "stackable" : "exclusive";
}

function priorityOf(row) {
  const priority = Number(row.priority);
  return Number.isFinite(priority) ? priority : 100;
}

function timestamp(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function compareCandidates(left, right) {
  if (right.specificityScore !== left.specificityScore) return right.specificityScore - left.specificityScore;
  if (left.priority !== right.priority) return left.priority - right.priority;
  const updated = timestamp(right.row.updated_at) - timestamp(left.row.updated_at);
  if (updated) return updated;
  return normalizeText(left.item.code).localeCompare(normalizeText(right.item.code));
}

function sameExclusiveAuthority(left, right) {
  return left.resolutionMode === "exclusive"
    && right.resolutionMode === "exclusive"
    && left.specificityScore === right.specificityScore
    && left.priority === right.priority
    && timestamp(left.row.updated_at) === timestamp(right.row.updated_at);
}

function exclusionExplanation(candidate, reason, selected = null) {
  const label = redactText(candidate.item.label || candidate.item.code, "The condition");
  if (reason === "lower_specificity") {
    const selectedLabel = selected ? redactText(selected.item.label || selected.item.code, "another condition") : "another condition";
    return `${label} was excluded because ${selectedLabel} matched a more specific scope.`;
  }
  if (reason === "lower_priority") {
    return `${label} was excluded by the priority and deterministic tiebreak rules.`;
  }
  if (reason === "ambiguous_classification") {
    return `${label} needs taxonomy review before it can be treated as authoritative.`;
  }
  if (reason === "conflicting_currency") return `${label} was excluded because its currency does not match the requested context.`;
  if (reason === "missing_context") return `${label} requires context that was not supplied.`;
  if (reason === "inactive") return `${label} is inactive.`;
  if (reason === "not_yet_valid") return `${label} is not yet valid at the requested effective time.`;
  if (reason === "expired") return `${label} expired before the requested effective time.`;
  if (reason === "scope_mismatch") return `${label} did not match the requested scope.`;
  return `${label} did not match the requested context.`;
}

function validityReason(status) {
  if (status === "inactive") return "inactive";
  if (status === "future") return "not_yet_valid";
  if (status === "expired") return "expired";
  return null;
}

function selectedExplanation(selected, status) {
  if (!selected) return "No condition was selected for the requested context.";
  const label = redactText(selected.item.label || selected.item.code, "The condition");
  if (status === "needs_review") return `${label} is the only matching condition, but its classification needs review.`;
  if (selected.specificityScore === 0) return `${label} was selected as the tenant-default condition.`;
  return `${label} was selected because it matched the most specific applicable scope.`;
}

function buildTrace(totalRows, candidates, excluded, selected, conflicts) {
  return [
    { step: "tenant_scope", physical_table: PHYSICAL_TABLE, scanned: totalRows },
    {
      step: "active_valid_classification_scope",
      applicable: candidates.length,
      excluded: excluded.length
    },
    {
      step: "precedence",
      order: ["scope_specificity_desc", "priority_asc", "updated_at_desc"],
      selected_condition_code: selected ? redactText(selected.item.code) : null,
      conflicts: conflicts.length
    }
  ];
}

function topLevelMappingStatus(selected, candidates) {
  const source = selected || candidates.find((candidate) => isAmbiguousClassification(candidate.item)) || candidates[0];
  return source?.item?.classification?.mapping_status || "mapped";
}

function hasCustomDomainAmbiguity(context) {
  return context.policy_domain
    && !DEFAULT_POLICY_DOMAINS.has(context.policy_domain)
    && !context.policy_family
    && !context.condition_type;
}

export async function resolveEffectivePolicy(app, authContext, rawContext = {}) {
  const context = rawContext._effectiveAtDate ? rawContext : normalizeEffectivePolicyQuery(rawContext);
  const effectiveAt = context._effectiveAtDate || new Date(context.effective_at);
  const loaded = await loadTenantConditionRows(app, authContext.tenant_id);
  const excluded = [];
  const candidates = [];
  const warnings = [];
  const conflicts = [];
  const customDomainIncomplete = hasCustomDomainAmbiguity(context);

  for (const row of loaded.rows) {
    const item = mapCommercialConditionToPolicyCondition(row, { now: effectiveAt });
    const validity = validityReason(item.validity?.status);
    if (validity) {
      excluded.push(excludedCondition(item, validity, exclusionExplanation({ item }, validity)));
      continue;
    }

    const classificationReason = classificationMismatch(row, item, context);
    if (classificationReason) {
      excluded.push(excludedCondition(item, classificationReason, `${redactText(item.label || item.code, "The condition")} did not match the requested classification.`));
      continue;
    }

    const scope = evaluateScope(row, context);
    if (!scope.match) {
      excluded.push(excludedCondition(item, scope.reason, exclusionExplanation({ item }, scope.reason)));
      if (scope.reason === "missing_context") {
        conflicts.push(conflict("MISSING_CONTEXT", `${redactText(item.label || item.code, "A scoped condition")} requires ${scope.missing_field || "additional context"}.`, [item.code]));
      }
      continue;
    }

    const currency = evaluateCurrency(row, context);
    if (!currency.match) {
      excluded.push(excludedCondition(item, currency.reason, exclusionExplanation({ item }, currency.reason)));
      conflicts.push(conflict("CONFLICTING_CURRENCY", `${redactText(item.label || item.code, "A condition")} uses a different currency from the requested context.`, [item.code]));
      continue;
    }

    candidates.push({
      row,
      item,
      specificityScore: scope.specificityScore,
      specificityFactors: scope.specificityFactors,
      priority: priorityOf(row),
      resolutionMode: resolutionMode(row),
      ambiguous: isAmbiguousClassification(item)
    });
  }

  if (loaded.truncated) {
    warnings.push(warning("SCAN_LIMIT_REACHED", "Only the first 10000 policy rows were scanned; narrow the context for complete review."));
  }
  if (customDomainIncomplete) {
    conflicts.push(conflict("CUSTOM_DOMAIN_CONTEXT_INCOMPLETE", "A custom policy domain requires a clear family or condition type before it can be authoritative."));
  }

  const clearCandidates = candidates.filter((candidate) => !candidate.ambiguous);
  const ambiguousCandidates = candidates.filter((candidate) => candidate.ambiguous);
  let resolutionPool = clearCandidates.length ? clearCandidates : candidates;

  if (clearCandidates.length && ambiguousCandidates.length) {
    for (const candidate of ambiguousCandidates) {
      excluded.push(excludedCondition(candidate, "ambiguous_classification", exclusionExplanation(candidate, "ambiguous_classification")));
    }
  } else if (!clearCandidates.length && ambiguousCandidates.length) {
    warnings.push(warning("AMBIGUOUS_CLASSIFICATION", "Only ambiguous matching conditions were found; taxonomy review is required."));
  }

  resolutionPool = [...resolutionPool].sort(compareCandidates);
  const applicableConditions = [];
  let selected = null;
  let resolutionStatus = "no_match";

  if (resolutionPool.length) {
    const top = resolutionPool[0];
    const equalAuthority = resolutionPool.filter((candidate) => sameExclusiveAuthority(top, candidate));
    if (equalAuthority.length > 1) {
      resolutionStatus = "conflict";
      for (const candidate of equalAuthority) applicableConditions.push(conditionSummary(candidate));
      conflicts.push(conflict(
        "EQUAL_SCOPE_PRIORITY",
        "Two or more exclusive conditions have the same scope specificity and priority; review is required.",
        equalAuthority.map((candidate) => candidate.item.code)
      ));
      for (const candidate of resolutionPool.filter((item) => !equalAuthority.includes(item))) {
        const reason = candidate.specificityScore < top.specificityScore ? "lower_specificity" : "lower_priority";
        excluded.push(excludedCondition(candidate, reason, exclusionExplanation(candidate, reason, top)));
      }
    } else if (top.resolutionMode === "stackable") {
      const stackable = resolutionPool.filter((candidate) => candidate.resolutionMode === "stackable");
      resolutionStatus = stackable.some((candidate) => candidate.ambiguous) ? "needs_review" : "resolved";
      for (const candidate of stackable) applicableConditions.push(conditionSummary(candidate));
      for (const candidate of resolutionPool.filter((item) => item.resolutionMode !== "stackable")) {
        excluded.push(excludedCondition(candidate, "lower_priority", exclusionExplanation(candidate, "lower_priority", top)));
      }
    } else {
      selected = top;
      resolutionStatus = top.ambiguous ? "needs_review" : "resolved";
      applicableConditions.push(conditionSummary(top));
      for (const candidate of resolutionPool.slice(1)) {
        const reason = candidate.specificityScore < top.specificityScore ? "lower_specificity" : "lower_priority";
        excluded.push(excludedCondition(candidate, reason, exclusionExplanation(candidate, reason, top)));
      }
    }
  } else if (conflicts.length) {
    resolutionStatus = "conflict";
  }

  if (customDomainIncomplete) {
    selected = null;
    applicableConditions.splice(0, applicableConditions.length, ...candidates.map((candidate) => conditionSummary(candidate)));
    resolutionStatus = "conflict";
  } else if (conflicts.length && conflicts.some((item) => ["CONFLICTING_CURRENCY", "MISSING_CONTEXT"].includes(item.code))) {
    resolutionStatus = "conflict";
  }

  const fallbackUsed = Boolean(selected && selected.specificityScore === 0);
  if (fallbackUsed) {
    warnings.push(warning("TENANT_DEFAULT_FALLBACK", "A tenant-default condition was used because no more specific condition matched."));
  }
  if (selected) {
    warnings.push(...(selected.item.warnings || []));
  }

  const explanation = [
    selectedExplanation(selected, resolutionStatus),
    ...excluded.slice(0, 5).map((item) => item.explanation).filter(Boolean)
  ];

  return {
    ok: true,
    resolution_status: resolutionStatus,
    requested_context: requestedContext(context),
    selected_condition: selected ? conditionSummary(selected) : null,
    applicable_conditions: applicableConditions,
    excluded_conditions: excluded,
    conflicts: dedupeByCode(conflicts),
    warnings: dedupeByCode(warnings),
    fallback_used: fallbackUsed,
    precedence_trace: buildTrace(loaded.rows.length, candidates, excluded, selected, conflicts),
    explanation,
    validity: {
      effective_at: effectiveAt.toISOString(),
      timezone: "UTC"
    },
    source: {
      physical_table: PHYSICAL_TABLE
    },
    mapping_status: topLevelMappingStatus(selected, resolutionPool)
  };
}
