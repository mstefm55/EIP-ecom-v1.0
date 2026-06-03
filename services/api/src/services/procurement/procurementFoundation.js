const PROCUREMENT_MODELS = new Set([
  "direct_purchase",
  "formal_purchase_order",
  "purchase_requisition_then_po",
  "request_for_quote",
  "multi_supplier_quote_comparison",
  "cash_shop_purchase",
  "marketplace_purchase",
  "blanket_order_call_off",
  "contract_supplier_purchase",
  "emergency_purchase",
  "manual_receipt_only"
]);

const SUPPLIER_ROLES = new Set([
  "preferred",
  "backup",
  "emergency",
  "blocked",
  "trial",
  "cash_supplier",
  "marketplace",
  "contract"
]);

const SUPPLIER_ACCREDITATION_STATUSES = new Set(["approved", "pending", "blocked", "expired", "trial"]);
const QUOTE_STATUSES = new Set(["requested", "received", "rejected", "accepted", "expired"]);
const PROCUREMENT_CONDITION_TYPES = new Set([
  "INVENTORY_REORDER_POLICY",
  "SUPPLY_REORDER_CONDITION",
  "SUPPLIER_PURCHASE_CONDITION",
  "MATERIAL_SUPPLIER_CONDITION",
  "PROCUREMENT_POLICY",
  "PAYMENT_TERM_CONDITION",
  "FREIGHT_COST_CONDITION",
  "CASH_PURCHASE_CONDITION"
]);
const PROCUREMENT_CONDITION_CATEGORIES = new Set(["INVENTORY", "SUPPLY", "PURCHASING", "FINANCE", "LOGISTICS"]);

const DEFAULT_PROCUREMENT_POLICY = {
  procurement_model: "purchase_requisition_then_po",
  rfq_threshold_value: 250,
  direct_purchase_threshold_value: 250,
  cash_purchase_limit_value: 100,
  emergency_days_of_cover_threshold: 3,
  minimum_quote_count: 3,
  approval_required: true,
  approval_threshold_value: 250,
  cash_purchase_allowed: true,
  emergency_purchase_allowed: true,
  marketplace_purchase_allowed: true,
  currency: "EUR",
  payment_terms_code: "NET_30",
  payment_due_days: 30,
  selection_strategy: "lowest_landed_cost",
  quote_selection_weights: {
    price_weight: 0.4,
    lead_time_weight: 0.25,
    otif_weight: 0.2,
    risk_weight: 0.15
  }
};

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value) {
  const text = normalizeText(value);
  return text.length ? text : null;
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return fallback;
  const text = normalizeLower(value);
  if (["true", "1", "yes", "y", "on"].includes(text)) return true;
  if (["false", "0", "no", "n", "off"].includes(text)) return false;
  return fallback;
}

function finiteNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
  const parsed = finiteNumber(value, fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

function roundMoney(value) {
  return Number(nonNegativeNumber(value, 0).toFixed(2));
}

function normalizeCurrency(value, fallback = "EUR") {
  const text = normalizeUpper(value || fallback);
  return /^[A-Z]{3}$/.test(text) ? text : fallback;
}

function normalizeScopeArray(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeUpper(item)).filter(Boolean);
  const text = normalizeUpper(value);
  return text ? [text] : [];
}

function normalizeIdArray(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeText(item)).filter(Boolean);
  const text = normalizeOptionalText(value);
  return text ? [text] : [];
}

function normalizeEnum(value, allowed, fallback) {
  const text = normalizeLower(value);
  return allowed.has(text) ? text : fallback;
}

function normalizeProcurementModel(value, fallback = "purchase_requisition_then_po") {
  return normalizeEnum(value, PROCUREMENT_MODELS, fallback);
}

function normalizeSupplierRole(value, fallback = "backup") {
  return normalizeEnum(value, SUPPLIER_ROLES, fallback);
}

function normalizeAccreditationStatus(value, fallback = "approved") {
  return normalizeEnum(value, SUPPLIER_ACCREDITATION_STATUSES, fallback);
}

function normalizeRiskLevel(value) {
  const text = normalizeLower(value);
  return ["low", "medium", "high", "critical"].includes(text) ? text : "medium";
}

function conditionKindMatches(condition = {}) {
  const type = normalizeUpper(condition.condition_type);
  const category = normalizeUpper(condition.condition_category);
  return PROCUREMENT_CONDITION_TYPES.has(type) || PROCUREMENT_CONDITION_CATEGORIES.has(category);
}

function conditionScopeScore(scope = {}) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return 0;
  return [
    "material_id",
    "material_ids",
    "material_code",
    "material_codes",
    "material_type",
    "material_types",
    "supplier_agent_id",
    "supplier_agent_ids",
    "abc_class",
    "abc_classes",
    "category",
    "categories"
  ].reduce((score, key) => (scope[key] === undefined || scope[key] === null ? score : score + 1), 0);
}

function conditionScopeMatches(scope = {}, context = {}) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return true;
  const material = context.material || {};
  const profile = context.stockProfile || {};
  const supplierAgentId = normalizeText(context.supplier_agent_id || context.supplierAgentId || profile.preferred_supplier_agent_id);

  const materialIds = normalizeIdArray(scope.material_ids || scope.material_id);
  if (materialIds.length && !materialIds.includes(normalizeText(material.id || profile.material_id))) return false;

  const materialCodes = normalizeScopeArray(scope.material_codes || scope.material_code || scope.materials);
  if (materialCodes.length && !materialCodes.includes(normalizeUpper(material.code || profile.material_code))) return false;

  const materialTypes = normalizeScopeArray(scope.material_types || scope.material_type);
  if (materialTypes.length && !materialTypes.includes(normalizeUpper(material.material_type || profile.material_type))) return false;

  const supplierIds = normalizeIdArray(scope.supplier_agent_ids || scope.supplier_agent_id);
  if (supplierIds.length && !supplierIds.includes(supplierAgentId)) return false;

  const abcClasses = normalizeScopeArray(scope.abc_classes || scope.abc_class || scope.abc_classification);
  if (abcClasses.length && !abcClasses.includes(normalizeUpper(profile.abc_classification || profile.abc_class))) return false;

  const categories = normalizeScopeArray(scope.categories || scope.category || scope.material_category);
  const category = normalizeUpper(material.category || material.attrs?.category || material.attrs?.ecom?.category || material.attrs?.product?.category);
  if (categories.length && !categories.includes(category)) return false;

  return true;
}

function policyFromCondition(condition = {}) {
  return {
    ...(condition.effect?.procurement_policy || {}),
    ...(condition.effect?.supplier_policy || {}),
    ...(condition.effect?.payment_terms || {}),
    ...(condition.effect?.cash_purchase_policy || {}),
    ...(condition.effect || {}),
    ...(condition.attrs?.procurement_policy || {}),
    ...(condition.attrs?.supplier_policy || {}),
    ...(condition.attrs?.payment_terms || {}),
    ...(condition.attrs?.cash_purchase_policy || {})
  };
}

export function resolveProcurementPolicy(context = {}, conditions = []) {
  const applicable = (conditions || [])
    .filter(conditionKindMatches)
    .filter((condition) => conditionScopeMatches(condition.scope || {}, context))
    .map((condition) => ({ ...condition, _scopeScore: conditionScopeScore(condition.scope || {}) }))
    .sort((a, b) => {
      if (a._scopeScore !== b._scopeScore) return a._scopeScore - b._scopeScore;
      const pa = Number.isFinite(Number(a.priority)) ? Number(a.priority) : 100;
      const pb = Number.isFinite(Number(b.priority)) ? Number(b.priority) : 100;
      if (pa !== pb) return pb - pa;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

  const merged = { ...DEFAULT_PROCUREMENT_POLICY };
  for (const condition of applicable) Object.assign(merged, policyFromCondition(condition));
  const attrsPolicy = context.policy_override && typeof context.policy_override === "object" ? context.policy_override : {};
  Object.assign(merged, attrsPolicy);

  const policy = {
    procurement_model: normalizeProcurementModel(merged.procurement_model, DEFAULT_PROCUREMENT_POLICY.procurement_model),
    rfq_threshold_value: nonNegativeNumber(merged.rfq_threshold_value ?? merged.rfq_threshold, DEFAULT_PROCUREMENT_POLICY.rfq_threshold_value),
    direct_purchase_threshold_value: nonNegativeNumber(merged.direct_purchase_threshold_value, DEFAULT_PROCUREMENT_POLICY.direct_purchase_threshold_value),
    cash_purchase_limit_value: nonNegativeNumber(merged.cash_purchase_limit_value ?? merged.cash_purchase_limit, DEFAULT_PROCUREMENT_POLICY.cash_purchase_limit_value),
    emergency_days_of_cover_threshold: nonNegativeNumber(merged.emergency_days_of_cover_threshold, DEFAULT_PROCUREMENT_POLICY.emergency_days_of_cover_threshold),
    minimum_quote_count: Math.max(1, Math.round(nonNegativeNumber(merged.minimum_quote_count, DEFAULT_PROCUREMENT_POLICY.minimum_quote_count))),
    approval_required: normalizeBoolean(merged.approval_required, DEFAULT_PROCUREMENT_POLICY.approval_required),
    approval_threshold_value: nonNegativeNumber(merged.approval_threshold_value, DEFAULT_PROCUREMENT_POLICY.approval_threshold_value),
    cash_purchase_allowed: normalizeBoolean(merged.cash_purchase_allowed, DEFAULT_PROCUREMENT_POLICY.cash_purchase_allowed),
    emergency_purchase_allowed: normalizeBoolean(merged.emergency_purchase_allowed, DEFAULT_PROCUREMENT_POLICY.emergency_purchase_allowed),
    marketplace_purchase_allowed: normalizeBoolean(merged.marketplace_purchase_allowed, DEFAULT_PROCUREMENT_POLICY.marketplace_purchase_allowed),
    currency: normalizeCurrency(merged.currency, DEFAULT_PROCUREMENT_POLICY.currency),
    payment_terms_code: normalizeUpper(merged.payment_terms_code || DEFAULT_PROCUREMENT_POLICY.payment_terms_code),
    payment_due_days: Math.round(nonNegativeNumber(merged.payment_due_days, DEFAULT_PROCUREMENT_POLICY.payment_due_days)),
    selection_strategy: normalizeLower(merged.selection_strategy || DEFAULT_PROCUREMENT_POLICY.selection_strategy),
    quote_selection_weights: {
      ...DEFAULT_PROCUREMENT_POLICY.quote_selection_weights,
      ...(merged.quote_selection_weights && typeof merged.quote_selection_weights === "object" ? merged.quote_selection_weights : {})
    }
  };

  return {
    policy_source: applicable.length ? "commercial_condition" : "procurement_defaults",
    condition_codes: applicable.map((condition) => condition.code).filter(Boolean),
    effective_policy: policy
  };
}

export function normalizeSupplierLink(input = {}) {
  const attrs = input.attrs && typeof input.attrs === "object" ? input.attrs : input;
  const supplierRole = normalizeSupplierRole(attrs.supplier_role || attrs.role, "backup");
  const accreditationStatus = normalizeAccreditationStatus(attrs.accreditation_status, attrs.is_accredited === false ? "pending" : "approved");
  const currency = normalizeCurrency(attrs.currency, "EUR");
  return {
    supplier_role: supplierRole,
    is_accredited: normalizeBoolean(attrs.is_accredited, accreditationStatus === "approved"),
    accreditation_status: accreditationStatus,
    priority: Math.max(1, Math.round(nonNegativeNumber(attrs.priority, supplierRole === "preferred" ? 1 : 50))),
    valid_from: normalizeOptionalText(attrs.valid_from),
    valid_to: normalizeOptionalText(attrs.valid_to),
    supplier_material_code: normalizeOptionalText(attrs.supplier_material_code),
    supplier_material_name: normalizeOptionalText(attrs.supplier_material_name),
    minimum_order_qty: nonNegativeNumber(attrs.minimum_order_qty, 0),
    order_multiple: nonNegativeNumber(attrs.order_multiple, 0),
    lead_time_days: Math.round(nonNegativeNumber(attrs.lead_time_days, 0)),
    safety_lead_time_days: Math.round(nonNegativeNumber(attrs.safety_lead_time_days, 0)),
    last_price: roundMoney(attrs.last_price ?? attrs.unit_price),
    currency,
    quality_rating: finiteNumber(attrs.quality_rating, null),
    otif_score: finiteNumber(attrs.otif_score, null),
    supplier_risk_level: normalizeRiskLevel(attrs.supplier_risk_level),
    payment_terms_code: normalizeUpper(attrs.payment_terms_code || "NET_30"),
    payment_due_days: Math.round(nonNegativeNumber(attrs.payment_due_days, 30)),
    freight_cost_estimate: roundMoney(attrs.freight_cost_estimate),
    credit_available: normalizeBoolean(attrs.credit_available, true),
    cash_on_delivery: normalizeBoolean(attrs.cash_on_delivery, false)
  };
}

function supplierRoleScore(role) {
  if (role === "preferred") return 20;
  if (role === "contract") return 16;
  if (role === "backup") return 10;
  if (role === "cash_supplier") return 6;
  if (role === "marketplace") return 4;
  if (role === "trial") return -8;
  if (role === "emergency") return -4;
  if (role === "blocked") return -100;
  return 0;
}

function riskPenalty(risk) {
  if (risk === "low") return 0;
  if (risk === "medium") return 8;
  if (risk === "high") return 20;
  if (risk === "critical") return 40;
  return 10;
}

export function buildSupplierCandidates(links = [], context = {}) {
  const requestedQty = nonNegativeNumber(context.requested_qty ?? context.recommended_qty ?? context.stockProfile?.suggested_qty, 0);
  const fallbackCurrency = normalizeCurrency(context.currency || context.stockProfile?.effective_policy?.currency || "EUR", "EUR");
  return (links || [])
    .map((link) => {
      const attrs = normalizeSupplierLink(link.attrs || link);
      const supplierAgentId = normalizeOptionalText(link.supplier_agent_id || link.dst_id || link.agent_id);
      const unitPrice = roundMoney(attrs.last_price || context.estimated_unit_cost || context.stockProfile?.average_cost || context.stockProfile?.unit_cost || 0);
      const roundedQty = attrs.minimum_order_qty > 0 ? Math.max(requestedQty, attrs.minimum_order_qty) : requestedQty;
      const qty = attrs.order_multiple > 0 ? Math.ceil(roundedQty / attrs.order_multiple) * attrs.order_multiple : roundedQty;
      const freight = roundMoney(attrs.freight_cost_estimate);
      const landed = roundMoney(qty * unitPrice + freight);
      const score = Math.round(
        100 +
          supplierRoleScore(attrs.supplier_role) +
          (attrs.is_accredited ? 12 : -25) +
          (Number.isFinite(attrs.otif_score) ? attrs.otif_score * 10 : 0) +
          (Number.isFinite(attrs.quality_rating) ? attrs.quality_rating * 8 : 0) -
          riskPenalty(attrs.supplier_risk_level) -
          Math.min(30, attrs.lead_time_days * 0.6) -
          (unitPrice > 0 ? Math.min(20, unitPrice / 10) : 8)
      );
      return {
        supplier_agent_id: supplierAgentId,
        supplier_name: link.supplier_name || link.agent_name || null,
        supplier_role: attrs.supplier_role,
        is_accredited: attrs.is_accredited,
        accreditation_status: attrs.accreditation_status,
        unit_price: unitPrice,
        currency: attrs.currency || fallbackCurrency,
        minimum_order_qty: attrs.minimum_order_qty,
        order_multiple: attrs.order_multiple,
        recommended_order_qty: qty,
        lead_time_days: attrs.lead_time_days,
        safety_lead_time_days: attrs.safety_lead_time_days,
        estimated_freight_cost: freight,
        estimated_landed_cost: landed,
        payment_terms_code: attrs.payment_terms_code,
        payment_due_days: attrs.payment_due_days,
        credit_available: attrs.credit_available,
        supplier_risk_level: attrs.supplier_risk_level,
        otif_score: attrs.otif_score,
        quality_rating: attrs.quality_rating,
        score
      };
    })
    .filter((item) => item.supplier_role !== "blocked" && item.accreditation_status !== "blocked")
    .sort((a, b) => b.score - a.score || a.estimated_landed_cost - b.estimated_landed_cost);
}

export function selectProcurementModel(input = {}) {
  const profile = input.stock_profile || input.stockProfile || {};
  const requestedQty = nonNegativeNumber(input.requested_qty ?? profile.suggested_qty ?? profile.reorder_qty, 0);
  const policyResolution = resolveProcurementPolicy(
    {
      material: input.material || {},
      stockProfile: profile,
      supplier_agent_id: profile.preferred_supplier_agent_id,
      policy_override: input.policy_override
    },
    input.conditions || []
  );
  const policy = policyResolution.effective_policy;
  const candidates = buildSupplierCandidates(input.supplier_links || input.supplierLinks || [], {
    requested_qty: requestedQty,
    stockProfile: profile,
    currency: policy.currency
  });
  const accredited = candidates.filter((candidate) => candidate.is_accredited && candidate.accreditation_status === "approved");
  const preferred = accredited.find((candidate) => candidate.supplier_role === "preferred") || accredited[0] || null;
  const estimatedUnitCost = roundMoney(preferred?.unit_price || profile.average_cost || profile.unit_cost || 0);
  const estimatedFreightCost = roundMoney(preferred?.estimated_freight_cost || profile.freight_cost_estimate || 0);
  const estimatedTotalCost = roundMoney(requestedQty * estimatedUnitCost);
  const estimatedLandedCost = roundMoney(preferred?.estimated_landed_cost || estimatedTotalCost + estimatedFreightCost);
  const daysOfCover = finiteNumber(profile.days_of_cover, null);
  const isUrgent = ["stockout_predicted", "already_out_of_stock"].includes(profile.risk_status) ||
    (Number.isFinite(daysOfCover) && daysOfCover <= policy.emergency_days_of_cover_threshold);
  const abcClass = normalizeUpper(profile.abc_classification);

  let procurementModel = policy.procurement_model;
  let selectionReason = "tenant_policy_default";
  let nextProcess = "PURCHASE_REQUISITION_FLOW_V1";

  if (!accredited.length) {
    procurementModel = "request_for_quote";
    selectionReason = "no_accredited_supplier";
    nextProcess = "PURCHASE_RFQ_FLOW_V1";
  } else if (isUrgent && policy.emergency_purchase_allowed) {
    procurementModel = "emergency_purchase";
    selectionReason = "urgent_stockout_risk";
    nextProcess = "PURCHASE_REQUISITION_FLOW_V1";
  } else if (policy.cash_purchase_allowed && estimatedLandedCost > 0 && estimatedLandedCost <= policy.cash_purchase_limit_value) {
    procurementModel = "cash_shop_purchase";
    selectionReason = "below_cash_purchase_limit";
    nextProcess = "CASH_PURCHASE_FLOW_V1";
  } else if (accredited.length >= policy.minimum_quote_count && (estimatedLandedCost >= policy.rfq_threshold_value || abcClass === "A")) {
    procurementModel = "request_for_quote";
    selectionReason = abcClass === "A" ? "abc_a_multiple_suppliers" : "above_rfq_threshold_multiple_suppliers";
    nextProcess = "PURCHASE_RFQ_FLOW_V1";
  } else if (preferred && preferred.supplier_role === "contract") {
    procurementModel = "contract_supplier_purchase";
    selectionReason = "contract_supplier_available";
  } else if (preferred && estimatedLandedCost <= policy.direct_purchase_threshold_value && preferred.supplier_risk_level !== "high" && preferred.supplier_risk_level !== "critical") {
    procurementModel = "direct_purchase";
    selectionReason = "preferred_supplier_low_risk_known_price";
  } else if (preferred) {
    procurementModel = "formal_purchase_order";
    selectionReason = "preferred_supplier_requires_formal_order";
  }

  const approvalRequired = policy.approval_required || estimatedLandedCost >= policy.approval_threshold_value || procurementModel === "request_for_quote";
  const recommendedSupplier = preferred || candidates[0] || null;
  return {
    procurement_model: procurementModel,
    selection_reason: selectionReason,
    minimum_quote_count: policy.minimum_quote_count,
    approval_required: approvalRequired,
    next_process: nextProcess,
    policy_source: policyResolution.policy_source,
    policy_condition_codes: policyResolution.condition_codes,
    effective_policy: policy,
    recommended_supplier_agent_id: recommendedSupplier?.supplier_agent_id || null,
    supplier_selection_reason: recommendedSupplier ? "best_scored_accredited_supplier" : "supplier_required",
    candidate_suppliers: candidates,
    requested_qty: requestedQty,
    estimated_unit_cost: estimatedUnitCost,
    estimated_total_cost: estimatedTotalCost,
    estimated_freight_cost: estimatedFreightCost,
    estimated_landed_cost: estimatedLandedCost,
    currency: policy.currency,
    payment_terms_code: recommendedSupplier?.payment_terms_code || policy.payment_terms_code,
    payment_due_days: recommendedSupplier?.payment_due_days ?? policy.payment_due_days,
    cash_required: ["cash_shop_purchase", "emergency_purchase", "marketplace_purchase"].includes(procurementModel) ? estimatedLandedCost : 0,
    risk_flags: [
      !accredited.length ? "no_accredited_supplier" : null,
      candidates.some((item) => ["high", "critical"].includes(item.supplier_risk_level)) ? "supplier_risk" : null,
      isUrgent ? "urgent_stockout_risk" : null
    ].filter(Boolean)
  };
}

export function buildPurchaseRequisitionPayload(input = {}) {
  const recommendation = input.recommendation || selectProcurementModel(input);
  const material = input.material || {};
  const profile = input.stock_profile || input.stockProfile || {};
  return {
    object_type: "PURCHASE_REQUISITION",
    requisition_type: "material_reorder",
    source_reorder_suggestion_id: normalizeOptionalText(input.source_reorder_suggestion_id || input.reorder_suggestion_id),
    material_id: normalizeOptionalText(input.material_id || material.id || profile.material_id),
    material_code: normalizeOptionalText(material.code || profile.material_code),
    material_name: normalizeOptionalText(material.name || profile.material_name),
    requested_qty: recommendation.requested_qty,
    unit_of_measure: normalizeOptionalText(profile.unit_of_measure) || "pcs",
    recommended_supplier_agent_id: recommendation.recommended_supplier_agent_id,
    procurement_model: recommendation.procurement_model,
    selection_reason: recommendation.selection_reason,
    next_process: recommendation.next_process,
    minimum_quote_count: recommendation.minimum_quote_count,
    estimated_unit_cost: recommendation.estimated_unit_cost,
    estimated_total_cost: recommendation.estimated_total_cost,
    estimated_freight_cost: recommendation.estimated_freight_cost,
    estimated_landed_cost: recommendation.estimated_landed_cost,
    currency: recommendation.currency,
    payment_terms_code: recommendation.payment_terms_code,
    payment_due_days: recommendation.payment_due_days,
    cash_required: recommendation.cash_required,
    approval_required: recommendation.approval_required,
    trigger_reason: input.trigger_reason || profile.recommendation?.reason || "inventory_reorder_need",
    policy_condition_codes: recommendation.policy_condition_codes,
    supplier_recommendation: recommendation,
    process_parameters: {
      object_type: "PURCHASE_REQUISITION",
      effect: "CREATE_PURCHASE_REQUISITION_DRAFT",
      parameters: {
        material_id: normalizeOptionalText(input.material_id || material.id || profile.material_id),
        recommended_qty: recommendation.requested_qty,
        unit_of_measure: normalizeOptionalText(profile.unit_of_measure) || "pcs",
        recommended_supplier_agent_id: recommendation.recommended_supplier_agent_id,
        procurement_model: recommendation.procurement_model,
        estimated_unit_cost: recommendation.estimated_unit_cost,
        estimated_total_cost: recommendation.estimated_total_cost,
        estimated_freight_cost: recommendation.estimated_freight_cost,
        estimated_landed_cost: recommendation.estimated_landed_cost,
        currency: recommendation.currency,
        payment_terms_code: recommendation.payment_terms_code,
        cash_required: recommendation.cash_required,
        payment_due_days: recommendation.payment_due_days,
        approval_required: recommendation.approval_required,
        trigger_reason: input.trigger_reason || "inventory_reorder_need",
        policy_condition_codes: recommendation.policy_condition_codes
      }
    },
    status: "draft"
  };
}

export function buildRfqPayload(input = {}) {
  const requisition = input.requisition || {};
  const attrs = requisition.attrs || requisition || {};
  const supplierIds = Array.isArray(input.supplier_agent_ids)
    ? input.supplier_agent_ids.map((item) => normalizeText(item)).filter(Boolean)
    : Array.isArray(attrs.supplier_recommendation?.candidate_suppliers)
      ? attrs.supplier_recommendation.candidate_suppliers.map((item) => item.supplier_agent_id).filter(Boolean)
      : [];
  return {
    rfq_type: "material_reorder",
    source_requisition_id: normalizeOptionalText(input.source_requisition_id || requisition.id),
    source_reorder_suggestion_id: normalizeOptionalText(attrs.source_reorder_suggestion_id),
    material_id: normalizeOptionalText(attrs.material_id),
    requested_qty: nonNegativeNumber(attrs.requested_qty, 0),
    unit_of_measure: normalizeOptionalText(attrs.unit_of_measure) || "pcs",
    required_by_date: normalizeOptionalText(input.required_by_date),
    target_price: nonNegativeNumber(input.target_price ?? attrs.estimated_unit_cost, 0),
    currency: normalizeCurrency(input.currency || attrs.currency, "EUR"),
    supplier_agent_ids: supplierIds,
    quote_deadline: normalizeOptionalText(input.quote_deadline),
    minimum_quote_count: Math.max(1, Math.round(nonNegativeNumber(attrs.minimum_quote_count, 3))),
    selection_criteria: attrs.effective_policy?.quote_selection_weights || DEFAULT_PROCUREMENT_POLICY.quote_selection_weights,
    status: "draft",
    process_parameters: {
      object_type: "PURCHASE_RFQ",
      effect: "CREATE_PURCHASE_RFQ_DRAFT",
      parameters: {
        material_id: normalizeOptionalText(attrs.material_id),
        recommended_qty: nonNegativeNumber(attrs.requested_qty, 0),
        minimum_quote_count: Math.max(1, Math.round(nonNegativeNumber(attrs.minimum_quote_count, 3))),
        candidate_supplier_agent_ids: supplierIds,
        currency: normalizeCurrency(input.currency || attrs.currency, "EUR")
      }
    }
  };
}

export function normalizeSupplierQuote(input = {}) {
  const currency = normalizeCurrency(input.currency, "EUR");
  const quotedQty = nonNegativeNumber(input.quoted_qty ?? input.quantity, 0);
  const unitPrice = roundMoney(input.unit_price);
  const freight = roundMoney(input.freight_cost ?? input.freight_cost_estimate);
  const tax = roundMoney(input.tax_estimate);
  return {
    id: normalizeOptionalText(input.id),
    supplier_agent_id: normalizeOptionalText(input.supplier_agent_id),
    supplier_quote_ref: normalizeOptionalText(input.supplier_quote_ref),
    material_id: normalizeOptionalText(input.material_id),
    quoted_qty: quotedQty,
    unit_price: unitPrice,
    currency,
    minimum_order_qty: nonNegativeNumber(input.minimum_order_qty, 0),
    order_multiple: nonNegativeNumber(input.order_multiple, 0),
    lead_time_days: Math.round(nonNegativeNumber(input.lead_time_days, 0)),
    freight_cost: freight,
    tax_estimate: tax,
    landed_cost: roundMoney(input.landed_cost ?? quotedQty * unitPrice + freight + tax),
    payment_terms_code: normalizeUpper(input.payment_terms_code || "NET_30"),
    valid_until: normalizeOptionalText(input.valid_until),
    availability_status: normalizeLower(input.availability_status || "available"),
    quote_status: normalizeEnum(input.quote_status, QUOTE_STATUSES, "received"),
    credit_available: normalizeBoolean(input.credit_available, true),
    supplier_risk_level: normalizeRiskLevel(input.supplier_risk_level),
    otif_score: finiteNumber(input.otif_score, null)
  };
}

export function compareSupplierQuotes(quotes = [], options = {}) {
  const normalized = (quotes || [])
    .map((quote) => normalizeSupplierQuote(quote.payload ? { id: quote.id, ...quote.payload } : quote))
    .filter((quote) => quote.quote_status === "received");
  const weights = {
    ...DEFAULT_PROCUREMENT_POLICY.quote_selection_weights,
    ...(options.selection_criteria || {})
  };
  const scored = normalized.map((quote) => {
    const priceScore = quote.landed_cost > 0 ? Math.max(0, 100 - quote.landed_cost / 10) : 40;
    const leadScore = Math.max(0, 100 - quote.lead_time_days * 4);
    const otifScore = Number.isFinite(quote.otif_score) ? quote.otif_score * 100 : 70;
    const riskScore = 100 - riskPenalty(quote.supplier_risk_level);
    const score = Math.round(
      priceScore * weights.price_weight +
      leadScore * weights.lead_time_weight +
      otifScore * weights.otif_weight +
      riskScore * weights.risk_weight
    );
    return { ...quote, comparison_score: score };
  }).sort((a, b) => b.comparison_score - a.comparison_score || a.landed_cost - b.landed_cost);
  const recommended = scored[0] || null;
  return {
    recommended_supplier_agent_id: recommended?.supplier_agent_id || null,
    recommended_quote_id: recommended?.id || null,
    selection_reason: recommended ? "lowest_landed_cost_with_acceptable_lead_time" : "quotes_required",
    comparison_score: recommended?.comparison_score || 0,
    cash_required: recommended?.payment_terms_code === "CASH_ON_DELIVERY" ? recommended.landed_cost : 0,
    payment_due_days: recommended?.payment_terms_code === "NET_30" ? 30 : 0,
    estimated_total_cost: recommended?.landed_cost || 0,
    currency: recommended?.currency || normalizeCurrency(options.currency, "EUR"),
    risk_flags: scored.some((quote) => ["high", "critical"].includes(quote.supplier_risk_level)) ? ["supplier_risk"] : [],
    quotes: scored
  };
}

export {
  DEFAULT_PROCUREMENT_POLICY,
  PROCUREMENT_CONDITION_CATEGORIES,
  PROCUREMENT_CONDITION_TYPES,
  PROCUREMENT_MODELS,
  QUOTE_STATUSES,
  SUPPLIER_ACCREDITATION_STATUSES,
  SUPPLIER_ROLES
};
