const STOCK_STATUS = {
  IN_STOCK: "in_stock",
  LOW_STOCK: "low_stock",
  OUT_OF_STOCK: "out_of_stock",
  UNTRACKED: "untracked",
  NEGATIVE_STOCK: "negative_stock"
};

const ABC_CLASSES = new Set(["A", "B", "C"]);
const INVENTORY_RISK_STATUSES = new Set([
  "healthy",
  "watch",
  "reorder_now",
  "stockout_predicted",
  "already_out_of_stock"
]);
const MOVEMENT_DIRECTIONS = new Set(["in", "out", "reserve", "release", "adjust"]);
const MOVEMENT_TYPES = new Set([
  "opening_balance",
  "manual_adjustment",
  "sale_reservation",
  "sale_issue",
  "return_in",
  "purchase_receipt",
  "stock_count_adjustment"
]);

const REORDER_STATUSES = new Set([
  "open",
  "review",
  "approved",
  "ignored",
  "converted_to_purchase_request",
  "closed",
  "failed"
]);

const SUPPLIER_RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);
const INVENTORY_CONDITION_TYPES = new Set([
  "INVENTORY_REORDER_POLICY",
  "SUPPLY_REORDER_CONDITION",
  "SUPPLIER_PURCHASE_CONDITION"
]);
const INVENTORY_CONDITION_CATEGORIES = new Set(["INVENTORY", "SUPPLY", "PURCHASING"]);
const TASK_TYPES = new Set([
  "STOCK_REVIEW",
  "REORDER_REVIEW",
  "STOCK_COUNT",
  "SUPPLIER_CHECK",
  "PURCHASE_REQUISITION_REVIEW"
]);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value) {
  const text = normalizeText(value);
  return text.length ? text : null;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = normalizeText(value).toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeEnum(value, allowed, fallback = null, { upper = false } = {}) {
  const text = normalizeText(value);
  if (!text) return fallback;
  const normalized = upper ? text.toUpperCase() : text.toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
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

function roundQty(value) {
  const parsed = finiteNumber(value, 0);
  return Number(Number(parsed || 0).toFixed(6));
}

function roundMoney(value) {
  const parsed = finiteNumber(value, 0);
  return Number(Number(parsed || 0).toFixed(2));
}

function roundMetric(value) {
  const parsed = finiteNumber(value, null);
  if (!Number.isFinite(parsed)) return null;
  return Number(Number(parsed).toFixed(3));
}

function normalizeTextArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeOptionalText(item)).filter(Boolean);
  }
  const text = normalizeOptionalText(value);
  return text ? [text] : [];
}

function addDaysIso(days) {
  if (!Number.isFinite(days) || days < 0) return null;
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + Math.ceil(days));
  return date.toISOString().slice(0, 10);
}

function roundUpToMultiple(quantity, multiple) {
  const qty = roundQty(quantity);
  const step = nonNegativeNumber(multiple, 0);
  if (!step) return qty;
  return roundQty(Math.ceil(qty / step) * step);
}

function sourceInventory(attrs = {}) {
  return attrs?.inventory && typeof attrs.inventory === "object" && !Array.isArray(attrs.inventory)
    ? { ...attrs.inventory }
    : {};
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeScopeArray(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeUpper(item)).filter(Boolean);
  const text = normalizeUpper(value);
  return text ? [text] : [];
}

function conditionKindMatches(condition = {}) {
  const type = normalizeUpper(condition.condition_type);
  const category = normalizeUpper(condition.condition_category);
  if (INVENTORY_CONDITION_TYPES.has(type)) return true;
  if (INVENTORY_CONDITION_CATEGORIES.has(category) && /(INVENTORY|REORDER|SUPPLY|SUPPLIER|PURCHASE|PURCHAS)/.test(type)) {
    return true;
  }
  return false;
}

function conditionScopeScore(scope = {}) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return 0;
  return [
    "material_id",
    "material_ids",
    "material_code",
    "material_codes",
    "materials",
    "material_type",
    "material_types",
    "supplier_agent_id",
    "supplier_agent_ids",
    "preferred_supplier_agent_id",
    "abc_class",
    "abc_classes",
    "abc_classification",
    "category",
    "categories",
    "material_category"
  ].reduce((score, key) => (scope[key] === undefined || scope[key] === null ? score : score + 1), 0);
}

function commercialConditionScopeMatches(scope = {}, material = {}, inventory = {}) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return true;

  const materialCodes = normalizeScopeArray(scope.material_codes || scope.materials || scope.material_code);
  if (materialCodes.length && !materialCodes.includes(normalizeUpper(material.code))) return false;

  const materialIds = Array.isArray(scope.material_ids)
    ? scope.material_ids.map((item) => normalizeText(item)).filter(Boolean)
    : normalizeText(scope.material_id)
      ? [normalizeText(scope.material_id)]
      : [];
  if (materialIds.length && !materialIds.includes(normalizeText(material.id))) return false;

  const materialTypes = normalizeScopeArray(scope.material_types || scope.material_type);
  if (materialTypes.length && !materialTypes.includes(normalizeUpper(material.material_type))) return false;

  const supplierIds = Array.isArray(scope.supplier_agent_ids)
    ? scope.supplier_agent_ids.map((item) => normalizeText(item)).filter(Boolean)
    : normalizeText(scope.supplier_agent_id || scope.preferred_supplier_agent_id)
      ? [normalizeText(scope.supplier_agent_id || scope.preferred_supplier_agent_id)]
      : [];
  const preferredSupplier = normalizeText(inventory.preferred_supplier_agent_id);
  if (supplierIds.length && !supplierIds.includes(preferredSupplier)) return false;

  const abcClasses = normalizeScopeArray(scope.abc_classes || scope.abc_class || scope.abc_classification);
  const materialAbc = normalizeUpper(inventory.abc_classification || inventory.abc_class);
  if (abcClasses.length && !abcClasses.includes(materialAbc)) return false;

  const categories = normalizeScopeArray(scope.categories || scope.category || scope.material_category);
  const materialCategory = normalizeUpper(material.category || material.attrs?.category || material.attrs?.ecom?.category || material.attrs?.product?.category);
  if (categories.length && !categories.includes(materialCategory)) return false;

  return true;
}

const POLICY_ALIASES = {
  planning_method: ["planning_method", "reorder_method", "default_reorder_method"],
  service_level_target: ["service_level_target", "target_service_level"],
  reorder_point_qty: ["reorder_point_qty", "reorder_point"],
  reorder_qty: ["reorder_qty", "reorder_quantity"],
  minimum_stock_qty: ["minimum_stock_qty", "minimum_stock"],
  maximum_stock_qty: ["maximum_stock_qty", "maximum_stock"],
  safety_stock_qty: ["safety_stock_qty", "safety_stock"],
  lead_time_days: ["lead_time_days", "supplier_lead_time_days"],
  safety_lead_time_days: ["safety_lead_time_days"],
  minimum_order_qty: ["minimum_order_qty", "moq"],
  order_multiple: ["order_multiple"],
  approval_required: ["approval_required"],
  approval_threshold_value: ["approval_threshold_value"],
  currency: ["currency"],
  unit_of_measure: ["unit_of_measure", "uom"],
  preferred_supplier_agent_id: ["preferred_supplier_agent_id", "supplier_agent_id"],
  fallback_supplier_agent_ids: ["fallback_supplier_agent_ids"],
  review_frequency_days: ["review_frequency_days"],
  auto_reorder_enabled: ["auto_reorder_enabled"],
  abc_classification: ["abc_classification", "abc_class"],
  supplier_risk_level: ["supplier_risk_level"],
  single_source_risk: ["single_source_risk"],
  lead_time_variability: ["lead_time_variability"],
  supply_disruption_flag: ["supply_disruption_flag"],
  alternative_supplier_available: ["alternative_supplier_available"],
  supplier_reliability_score: ["supplier_reliability_score"],
  unit_cost: ["unit_cost"],
  average_cost: ["average_cost"],
  holding_cost_percent: ["holding_cost_percent"],
  reorder_transaction_cost: ["reorder_transaction_cost"],
  freight_cost_estimate: ["freight_cost_estimate"],
  landed_cost_estimate: ["landed_cost_estimate"],
  stockout_cost_estimate: ["stockout_cost_estimate"],
  daily_consumption_rate: ["daily_consumption_rate", "consumption_rate_daily", "recent_sales_velocity_daily"],
  weekly_consumption_rate: ["weekly_consumption_rate", "consumption_rate_weekly"],
  open_customer_demand: ["open_customer_demand"],
  target_service_level: ["target_service_level", "service_level_target"],
  actual_service_level: ["actual_service_level"],
  otif_target: ["otif_target", "otif_target_percent"],
  otif_actual: ["otif_actual", "otif_actual_percent"]
};

const MATERIAL_POLICY_OVERRIDE_FIELDS = new Set(Object.values(POLICY_ALIASES).flat());

function readAliased(source = {}, key) {
  for (const alias of POLICY_ALIASES[key] || [key]) {
    if (source[alias] !== undefined && source[alias] !== null && source[alias] !== "") return source[alias];
  }
  return undefined;
}

function normalizePolicyEnvelope(source = {}) {
  const policy = {};
  for (const key of Object.keys(POLICY_ALIASES)) {
    const value = readAliased(source, key);
    if (value !== undefined) policy[key] = value;
  }
  return policy;
}

function policyFromCondition(condition = {}) {
  return normalizePolicyEnvelope({
    ...(condition.effect?.reorder_policy || {}),
    ...(condition.effect?.inventory_policy || {}),
    ...(condition.effect?.supply_policy || {}),
    ...(condition.effect || {}),
    ...(condition.attrs?.reorder_policy || {}),
    ...(condition.attrs?.inventory_policy || {}),
    ...(condition.attrs?.supply_policy || {})
  });
}

function normalizeEffectivePolicy(policy = {}) {
  return {
    planning_method: normalizeOptionalText(policy.planning_method) || "reorder_point",
    service_level_target: finiteNumber(policy.service_level_target ?? policy.target_service_level, null),
    target_service_level: finiteNumber(policy.target_service_level ?? policy.service_level_target, null),
    reorder_point_qty: nonNegativeNumber(policy.reorder_point_qty, 0),
    reorder_qty: nonNegativeNumber(policy.reorder_qty, 0),
    minimum_stock_qty: nonNegativeNumber(policy.minimum_stock_qty, 0),
    maximum_stock_qty: nonNegativeNumber(policy.maximum_stock_qty, 0),
    safety_stock_qty: nonNegativeNumber(policy.safety_stock_qty, 0),
    lead_time_days: Math.round(nonNegativeNumber(policy.lead_time_days, 0)),
    safety_lead_time_days: Math.round(nonNegativeNumber(policy.safety_lead_time_days, 0)),
    minimum_order_qty: nonNegativeNumber(policy.minimum_order_qty, 0),
    order_multiple: nonNegativeNumber(policy.order_multiple, 0),
    approval_required: normalizeBoolean(policy.approval_required, true),
    approval_threshold_value: nonNegativeNumber(policy.approval_threshold_value, 0),
    currency: normalizeOptionalText(policy.currency) || null,
    unit_of_measure: normalizeOptionalText(policy.unit_of_measure) || "pcs",
    preferred_supplier_agent_id: normalizeOptionalText(policy.preferred_supplier_agent_id),
    fallback_supplier_agent_ids: normalizeTextArray(policy.fallback_supplier_agent_ids),
    review_frequency_days: Math.round(nonNegativeNumber(policy.review_frequency_days, 30)),
    auto_reorder_enabled: normalizeBoolean(policy.auto_reorder_enabled, false),
    abc_classification: normalizeEnum(policy.abc_classification, ABC_CLASSES, null, { upper: true }),
    supplier_risk_level: normalizeEnum(policy.supplier_risk_level, SUPPLIER_RISK_LEVELS, "medium"),
    single_source_risk: normalizeBoolean(policy.single_source_risk, false),
    lead_time_variability: finiteNumber(policy.lead_time_variability, null),
    supply_disruption_flag: normalizeBoolean(policy.supply_disruption_flag, false),
    alternative_supplier_available: normalizeBoolean(policy.alternative_supplier_available, false),
    supplier_reliability_score: finiteNumber(policy.supplier_reliability_score, null),
    unit_cost: nonNegativeNumber(policy.unit_cost, 0),
    average_cost: nonNegativeNumber(policy.average_cost, nonNegativeNumber(policy.unit_cost, 0)),
    holding_cost_percent: nonNegativeNumber(policy.holding_cost_percent, 0),
    reorder_transaction_cost: roundMoney(policy.reorder_transaction_cost),
    freight_cost_estimate: roundMoney(policy.freight_cost_estimate),
    landed_cost_estimate: nonNegativeNumber(policy.landed_cost_estimate, 0),
    stockout_cost_estimate: roundMoney(policy.stockout_cost_estimate),
    daily_consumption_rate: finiteNumber(policy.daily_consumption_rate, null),
    weekly_consumption_rate: finiteNumber(policy.weekly_consumption_rate, null),
    open_customer_demand: nonNegativeNumber(policy.open_customer_demand, 0),
    actual_service_level: finiteNumber(policy.actual_service_level, null),
    otif_target: finiteNumber(policy.otif_target, null),
    otif_actual: finiteNumber(policy.otif_actual, null)
  };
}

function policyToInventory(policy = {}) {
  return {
    reorder_point: policy.reorder_point_qty,
    reorder_qty: policy.reorder_qty,
    minimum_stock: policy.minimum_stock_qty,
    maximum_stock: policy.maximum_stock_qty,
    safety_stock: policy.safety_stock_qty,
    lead_time_days: policy.lead_time_days,
    safety_lead_time_days: policy.safety_lead_time_days,
    minimum_order_qty: policy.minimum_order_qty,
    order_multiple: policy.order_multiple,
    approval_required: policy.approval_required,
    approval_threshold_value: policy.approval_threshold_value,
    unit_of_measure: policy.unit_of_measure,
    preferred_supplier_agent_id: policy.preferred_supplier_agent_id,
    fallback_supplier_agent_ids: policy.fallback_supplier_agent_ids,
    review_frequency_days: policy.review_frequency_days,
    auto_reorder_enabled: policy.auto_reorder_enabled,
    abc_classification: policy.abc_classification,
    supplier_risk_level: policy.supplier_risk_level,
    single_source_risk: policy.single_source_risk,
    lead_time_variability: policy.lead_time_variability,
    supply_disruption_flag: policy.supply_disruption_flag,
    alternative_supplier_available: policy.alternative_supplier_available,
    supplier_reliability_score: policy.supplier_reliability_score,
    unit_cost: policy.unit_cost,
    average_cost: policy.average_cost,
    holding_cost_percent: policy.holding_cost_percent,
    reorder_transaction_cost: policy.reorder_transaction_cost,
    freight_cost_estimate: policy.freight_cost_estimate,
    landed_cost_estimate: policy.landed_cost_estimate,
    stockout_cost_estimate: policy.stockout_cost_estimate,
    daily_consumption_rate: policy.daily_consumption_rate,
    weekly_consumption_rate: policy.weekly_consumption_rate,
    open_customer_demand: policy.open_customer_demand,
    target_service_level: policy.target_service_level ?? policy.service_level_target,
    actual_service_level: policy.actual_service_level,
    otif_target: policy.otif_target,
    otif_actual: policy.otif_actual
  };
}

export function resolveInventoryPolicy(material = {}, conditions = []) {
  const attrs = material?.attrs && typeof material.attrs === "object" ? material.attrs : {};
  const inventory = sourceInventory(attrs);
  const applicable = (conditions || [])
    .filter(conditionKindMatches)
    .filter((condition) => commercialConditionScopeMatches(condition.scope || {}, material, inventory))
    .map((condition) => ({ ...condition, _scopeScore: conditionScopeScore(condition.scope || {}) }))
    .sort((a, b) => {
      if (a._scopeScore !== b._scopeScore) return a._scopeScore - b._scopeScore;
      const pa = Number.isFinite(Number(a.priority)) ? Number(a.priority) : 100;
      const pb = Number.isFinite(Number(b.priority)) ? Number(b.priority) : 100;
      if (pa !== pb) return pb - pa;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

  const conditionPolicy = {};
  for (const condition of applicable) Object.assign(conditionPolicy, policyFromCondition(condition));

  const materialOverride = {};
  for (const key of MATERIAL_POLICY_OVERRIDE_FIELDS) {
    if (inventory[key] !== undefined && inventory[key] !== null && inventory[key] !== "") materialOverride[key] = inventory[key];
  }
  const normalizedOverride = normalizePolicyEnvelope(materialOverride);
  const effectivePolicy = normalizeEffectivePolicy({ ...conditionPolicy, ...normalizedOverride });
  const conditionCodes = applicable.map((condition) => condition.code).filter(Boolean);

  return {
    policy_source: conditionCodes.length ? "commercial_condition" : "material_attrs_legacy",
    condition_codes: conditionCodes,
    effective_policy: effectivePolicy,
    policy_inventory: policyToInventory(effectivePolicy),
    material_override_fields: Object.keys(normalizedOverride)
  };
}

function resolveTracked(inventory) {
  if ("track_stock" in inventory) return normalizeBoolean(inventory.track_stock, false);
  return normalizeBoolean(inventory.track_inventory, false);
}

export function normalizeInventoryProfile(material = {}, options = {}) {
  const attrs = material?.attrs && typeof material.attrs === "object" ? material.attrs : {};
  const stateInventory = sourceInventory(attrs);
  const policyResolution = resolveInventoryPolicy(material, options.conditions || options.commercialConditions || []);
  const inventory = { ...stateInventory, ...policyResolution.policy_inventory };
  const trackStock = resolveTracked(inventory);
  const reservedQty = nonNegativeNumber(inventory.reserved_qty ?? inventory.reserved, 0);
  const onHandCandidate =
    finiteNumber(inventory.stock_on_hand, null) ??
    finiteNumber(inventory.on_hand, null) ??
    finiteNumber(inventory.available_qty, 0);
  const stockOnHand = roundQty(onHandCandidate);
  const explicitAvailable = finiteNumber(inventory.available_qty, null);
  const availableQty = roundQty(explicitAvailable ?? stockOnHand - reservedQty);
  const reorderPoint = nonNegativeNumber(inventory.reorder_point, 0);
  const reorderQty = nonNegativeNumber(inventory.reorder_qty, 0);
  const minimumStock = nonNegativeNumber(inventory.minimum_stock, 0);
  const maximumStock = nonNegativeNumber(inventory.maximum_stock, 0);
  const safetyStock = nonNegativeNumber(inventory.safety_stock, 0);
  const safetyLeadTimeDays = nonNegativeNumber(inventory.safety_lead_time_days, 0);
  const leadTimeDays = nonNegativeNumber(inventory.lead_time_days, 0);
  const unitOfMeasure = normalizeOptionalText(inventory.unit_of_measure || inventory.uom) || "pcs";
  const preferredSupplierAgentId = normalizeOptionalText(inventory.preferred_supplier_agent_id);
  const fallbackSupplierAgentIds = normalizeTextArray(inventory.fallback_supplier_agent_ids);
  const reviewFrequencyDays = Math.round(nonNegativeNumber(inventory.review_frequency_days, 30));
  const autoReorderEnabled = normalizeBoolean(inventory.auto_reorder_enabled, false);
  const approvalRequired = normalizeBoolean(inventory.approval_required, true);
  const approvalThresholdValue = nonNegativeNumber(inventory.approval_threshold_value, 0);
  const abcClassification = normalizeEnum(
    inventory.abc_classification || inventory.abc_class,
    ABC_CLASSES,
    null,
    { upper: true }
  );

  const targetServiceLevel = finiteNumber(inventory.target_service_level, null);
  const actualServiceLevel = finiteNumber(inventory.actual_service_level, null);
  const otifTarget = finiteNumber(inventory.otif_target ?? inventory.otif_target_percent, null);
  const otifActual = finiteNumber(inventory.otif_actual ?? inventory.otif_actual_percent, null);
  const outOfStockCount = Math.round(nonNegativeNumber(inventory.out_of_stock_count, 0));
  const missedSalesOpportunityCount = Math.round(nonNegativeNumber(inventory.missed_sales_opportunity_count, 0));
  const missedSalesOpportunityValue = roundMoney(inventory.missed_sales_opportunity_value);

  const supplierRiskLevel = normalizeEnum(inventory.supplier_risk_level, SUPPLIER_RISK_LEVELS, "medium");
  const singleSourceRisk = normalizeBoolean(inventory.single_source_risk, false);
  const leadTimeVariability = finiteNumber(inventory.lead_time_variability, null);
  const supplyDisruptionFlag = normalizeBoolean(inventory.supply_disruption_flag, false);
  const alternativeSupplierAvailable = normalizeBoolean(
    inventory.alternative_supplier_available,
    fallbackSupplierAgentIds.length > 0
  );
  const minimumOrderQty = nonNegativeNumber(inventory.minimum_order_qty, 0);
  const orderMultiple = nonNegativeNumber(inventory.order_multiple, 0);
  const supplierReliabilityScore = finiteNumber(inventory.supplier_reliability_score, null);

  const unitCost = nonNegativeNumber(inventory.unit_cost, 0);
  const averageCost = nonNegativeNumber(inventory.average_cost, unitCost);
  const costBasis = averageCost || unitCost || 0;
  const inventoryValue = roundMoney(finiteNumber(inventory.inventory_value, null) ?? stockOnHand * costBasis);
  const holdingCostPercent = nonNegativeNumber(inventory.holding_cost_percent, 0);
  const holdingCostValue = roundMoney(
    finiteNumber(inventory.holding_cost_value, null) ?? (inventoryValue * holdingCostPercent) / 100
  );
  const reorderTransactionCost = roundMoney(inventory.reorder_transaction_cost);
  const freightCostEstimate = roundMoney(inventory.freight_cost_estimate);
  const landedCostEstimate = roundMoney(
    finiteNumber(inventory.landed_cost_estimate, null) ?? costBasis
  );
  const stockoutCostEstimate = roundMoney(inventory.stockout_cost_estimate);

  const weeklyConsumptionRate = finiteNumber(
    inventory.weekly_consumption_rate ?? inventory.consumption_rate_weekly,
    null
  );
  const dailyConsumptionRate = roundMetric(
    finiteNumber(
      inventory.daily_consumption_rate ??
        inventory.consumption_rate_daily ??
        inventory.recent_sales_velocity_daily,
      null
    ) ?? (Number.isFinite(weeklyConsumptionRate) ? weeklyConsumptionRate / 7 : null)
  );
  const openCustomerDemand = nonNegativeNumber(inventory.open_customer_demand, 0);
  const leadTimeWithSafety = leadTimeDays + safetyLeadTimeDays;
  const leadTimeDemand = Number.isFinite(dailyConsumptionRate)
    ? roundQty(dailyConsumptionRate * leadTimeWithSafety)
    : 0;
  const daysOfCover = Number.isFinite(dailyConsumptionRate) && dailyConsumptionRate > 0
    ? roundMetric(availableQty / dailyConsumptionRate)
    : null;
  const predictedOutOfStockDate = normalizeOptionalText(inventory.predicted_out_of_stock_date) ||
    (Number.isFinite(daysOfCover) ? addDaysIso(daysOfCover) : null);

  let stockStatus = STOCK_STATUS.UNTRACKED;
  const signals = [];
  if (!trackStock) {
    signals.push("stock_untracked");
  } else if (stockOnHand < 0 || availableQty < 0) {
    stockStatus = STOCK_STATUS.NEGATIVE_STOCK;
    signals.push("negative_stock", "needs_reorder");
  } else if (stockOnHand <= 0 || availableQty <= 0) {
    stockStatus = STOCK_STATUS.OUT_OF_STOCK;
    signals.push("out_of_stock", "needs_reorder");
  } else if (availableQty <= reorderPoint) {
    stockStatus = STOCK_STATUS.LOW_STOCK;
    signals.push("available_below_reorder_point", "below_reorder_point", "needs_reorder");
  } else if (minimumStock > 0 && availableQty <= minimumStock) {
    stockStatus = STOCK_STATUS.LOW_STOCK;
    signals.push("available_below_minimum_stock", "needs_reorder");
  } else {
    stockStatus = STOCK_STATUS.IN_STOCK;
  }

  const stockoutInsideLeadTime = Number.isFinite(daysOfCover) && daysOfCover <= leadTimeWithSafety;
  if (trackStock && stockStatus === STOCK_STATUS.IN_STOCK && stockoutInsideLeadTime) {
    signals.push("stockout_predicted", "needs_reorder");
  }

  let riskStatus = "healthy";
  if (trackStock && (stockStatus === STOCK_STATUS.NEGATIVE_STOCK || stockStatus === STOCK_STATUS.OUT_OF_STOCK)) {
    riskStatus = "already_out_of_stock";
  } else if (trackStock && stockoutInsideLeadTime) {
    riskStatus = "stockout_predicted";
  } else if (trackStock && signals.includes("needs_reorder")) {
    riskStatus = "reorder_now";
  } else if (trackStock && Number.isFinite(daysOfCover) && reviewFrequencyDays > 0 && daysOfCover <= reviewFrequencyDays) {
    riskStatus = "watch";
  }

  const reorderDelta = Math.max(0, reorderPoint, minimumStock, safetyStock + leadTimeDemand + openCustomerDemand) - availableQty;
  let baseSuggestedQty = trackStock && signals.includes("needs_reorder")
    ? Math.max(reorderQty, reorderDelta, 1)
    : 0;
  if (minimumOrderQty > 0 && baseSuggestedQty > 0) baseSuggestedQty = Math.max(baseSuggestedQty, minimumOrderQty);
  if (orderMultiple > 0 && baseSuggestedQty > 0) baseSuggestedQty = roundUpToMultiple(baseSuggestedQty, orderMultiple);
  const suggestedQty = trackStock && signals.includes("needs_reorder")
    ? roundQty(baseSuggestedQty)
    : 0;
  const cashRequiredForReorder = suggestedQty > 0
    ? roundMoney(
        finiteNumber(inventory.cash_required_for_reorder, null) ??
          (suggestedQty * (landedCostEstimate || costBasis) + reorderTransactionCost + freightCostEstimate)
      )
    : 0;
  const projectedCashImpact = roundMoney(finiteNumber(inventory.projected_cash_impact, null) ?? cashRequiredForReorder);
  const approvalReasons = [];
  if (approvalRequired) approvalReasons.push("policy_requires_human_approval");
  if (approvalThresholdValue > 0 && cashRequiredForReorder >= approvalThresholdValue) approvalReasons.push("cash_threshold_exceeded");
  if (["high", "critical"].includes(supplierRiskLevel)) approvalReasons.push("supplier_risk");
  if (singleSourceRisk) approvalReasons.push("single_source_risk");
  if (suggestedQty > 0 && maximumStock > 0 && suggestedQty + availableQty > maximumStock) approvalReasons.push("above_maximum_stock_review");
  const requiresHumanApproval = suggestedQty > 0 && (approvalRequired || approvalReasons.length > 0 || !autoReorderEnabled);

  const reason = signals.includes("negative_stock")
    ? "negative stock requires review"
    : signals.includes("out_of_stock")
      ? "out of stock"
      : signals.includes("stockout_predicted")
        ? "predicted stockout before supplier lead time"
        : signals.includes("available_below_minimum_stock")
          ? "available stock below minimum stock"
          : signals.includes("available_below_reorder_point")
            ? "available_qty below reorder point"
            : "stock healthy";
  const explanation = [
    Number.isFinite(daysOfCover) ? `days_of_cover=${daysOfCover}` : "days_of_cover unavailable until consumption rate exists",
    `lead_time_days=${leadTimeDays}`,
    `safety_lead_time_days=${safetyLeadTimeDays}`,
    `safety_stock=${safetyStock}`,
    `open_customer_demand=${openCustomerDemand}`,
    `suggested_qty=${suggestedQty}`,
    `cash_required_for_reorder=${cashRequiredForReorder}`
  ];
  const displayName = material.name || material.code || "This item";
  const decisionCard = {
    headline: Number.isFinite(daysOfCover)
      ? `${displayName} will run out in about ${Math.max(0, Math.ceil(daysOfCover))} day${Math.ceil(daysOfCover) === 1 ? "" : "s"}.`
      : `${displayName} needs stock policy review.`,
    lead_time: `Lead time is ${leadTimeDays} day${leadTimeDays === 1 ? "" : "s"}${safetyLeadTimeDays ? ` plus ${safetyLeadTimeDays} safety day${safetyLeadTimeDays === 1 ? "" : "s"}` : ""}.`,
    suggested_reorder: suggestedQty > 0
      ? `Suggested reorder: ${suggestedQty} ${unitOfMeasure}.`
      : "No reorder quantity is proposed yet.",
    cash_impact: cashRequiredForReorder > 0
      ? `Estimated cash needed: ${cashRequiredForReorder}.`
      : "Cash impact is not available yet.",
    risk_status: riskStatus,
    primary_action: suggestedQty > 0 ? "review_reorder_suggestion" : "adjust_policy",
    secondary_actions: suggestedQty > 0
      ? ["approve_requisition", "ask_ai_to_explain", "ignore_for_now", "adjust_policy"]
      : ["ask_ai_to_explain", "adjust_policy"]
  };
  const recommendation = {
    action: suggestedQty > 0 ? "create_reorder_suggestion" : "monitor",
    reason,
    risk_status: riskStatus,
    suggested_qty: suggestedQty,
    unit_of_measure: unitOfMeasure,
    days_of_cover: daysOfCover,
    predicted_out_of_stock_date: predictedOutOfStockDate,
    cash_required_for_reorder: cashRequiredForReorder,
    projected_cash_impact: projectedCashImpact,
    requires_human_approval: requiresHumanApproval,
    approval_reasons: approvalReasons,
    policy_source: policyResolution.policy_source,
    policy_condition_codes: policyResolution.condition_codes,
    process_parameters: {
      object_type: "INVENTORY_REORDER_SUGGESTION",
      effect: "CREATE_PURCHASE_REQUISITION_DRAFT",
      parameters: {
        material_id: material.id || null,
        recommended_qty: suggestedQty,
        supplier_agent_id: preferredSupplierAgentId,
        currency: policyResolution.effective_policy.currency,
        estimated_total_cost: cashRequiredForReorder,
        approval_required: requiresHumanApproval,
        trigger_reason: reason,
        policy_condition_codes: policyResolution.condition_codes
      }
    },
    confidence: Number.isFinite(dailyConsumptionRate) ? "medium" : "policy_only",
    explanation
  };
  const actionProposals = suggestedQty > 0
    ? [
        "create_reorder_suggestion",
        "create_purchase_requisition_draft",
        "create_supplier_check_task",
        "warn_cash_impact",
        "warn_stockout_risk"
      ]
    : ["monitor_inventory_policy"];
  if (["high", "critical"].includes(supplierRiskLevel) || singleSourceRisk) {
    actionProposals.push("warn_supplier_risk", "recommend_alternative_supplier");
  }

  return {
    material_id: material.id || null,
    material_code: material.code || null,
    material_name: material.name || null,
    material_type: material.material_type || null,
    track_stock: trackStock,
    track_inventory: trackStock,
    stock_on_hand: stockOnHand,
    on_hand: stockOnHand,
    reserved_qty: reservedQty,
    available_qty: availableQty,
    reorder_point: reorderPoint,
    reorder_qty: reorderQty,
    minimum_stock: minimumStock,
    maximum_stock: maximumStock,
    safety_stock: safetyStock,
    safety_lead_time_days: safetyLeadTimeDays,
    preferred_supplier_agent_id: preferredSupplierAgentId,
    fallback_supplier_agent_ids: fallbackSupplierAgentIds,
    lead_time_days: leadTimeDays,
    review_frequency_days: reviewFrequencyDays,
    auto_reorder_enabled: autoReorderEnabled,
    approval_required: approvalRequired,
    approval_threshold_value: approvalThresholdValue,
    abc_classification: abcClassification,
    unit_of_measure: unitOfMeasure,
    policy_source: policyResolution.policy_source,
    policy_condition_codes: policyResolution.condition_codes,
    effective_policy: policyResolution.effective_policy,
    material_override_fields: policyResolution.material_override_fields,
    stock_status: stockStatus,
    risk_status: riskStatus,
    signals,
    needs_reorder: signals.includes("needs_reorder"),
    suggested_qty: suggestedQty,
    daily_consumption_rate: dailyConsumptionRate,
    weekly_consumption_rate: weeklyConsumptionRate,
    open_customer_demand: openCustomerDemand,
    days_of_cover: daysOfCover,
    predicted_out_of_stock_date: predictedOutOfStockDate,
    target_service_level: targetServiceLevel,
    actual_service_level: actualServiceLevel,
    otif_target: otifTarget,
    otif_actual: otifActual,
    out_of_stock_count: outOfStockCount,
    missed_sales_opportunity_count: missedSalesOpportunityCount,
    missed_sales_opportunity_value: missedSalesOpportunityValue,
    supplier_risk_level: supplierRiskLevel,
    single_source_risk: singleSourceRisk,
    lead_time_variability: leadTimeVariability,
    supply_disruption_flag: supplyDisruptionFlag,
    alternative_supplier_available: alternativeSupplierAvailable,
    minimum_order_qty: minimumOrderQty,
    order_multiple: orderMultiple,
    supplier_reliability_score: supplierReliabilityScore,
    inventory_value: inventoryValue,
    unit_cost: unitCost,
    average_cost: averageCost,
    holding_cost_percent: holdingCostPercent,
    holding_cost_value: holdingCostValue,
    reorder_transaction_cost: reorderTransactionCost,
    freight_cost_estimate: freightCostEstimate,
    landed_cost_estimate: landedCostEstimate,
    cash_required_for_reorder: cashRequiredForReorder,
    projected_cash_impact: projectedCashImpact,
    stockout_cost_estimate: stockoutCostEstimate,
    reorder_recommendation: recommendation,
    recommendation,
    decision_card: decisionCard,
    action_proposals: actionProposals,
    purchase_requisition_bridge: {
      ready_for_draft: suggestedQty > 0,
      draft_object_type: "PURCHASE_REQUISITION_DRAFT",
      future_commitment_object_type: "PURCHASE_ORDER",
      bridge_status: suggestedQty > 0 ? "proposal_ready" : "not_needed",
      commitment_required: true,
      process_parameters: recommendation.process_parameters,
      future_transmission_modes: ["email", "api_json", "edi_webhook"]
    },
    last_movement_at: normalizeOptionalText(inventory.last_movement_at)
  };
}

export function mergeInventoryPolicy(attrs = {}, patch = {}, options = {}) {
  const currentAttrs = attrs && typeof attrs === "object" ? { ...attrs } : {};
  const inventory = sourceInventory(currentAttrs);
  const next = { ...inventory };

  if ("track_stock" in patch || "track_inventory" in patch) {
    const tracked = normalizeBoolean(patch.track_stock ?? patch.track_inventory, resolveTracked(inventory));
    next.track_stock = tracked;
    next.track_inventory = tracked;
  }
  if ("reorder_point" in patch) next.reorder_point = nonNegativeNumber(patch.reorder_point, 0);
  if ("reorder_qty" in patch) next.reorder_qty = nonNegativeNumber(patch.reorder_qty, 0);
  if ("minimum_stock" in patch) next.minimum_stock = nonNegativeNumber(patch.minimum_stock, 0);
  if ("maximum_stock" in patch) next.maximum_stock = nonNegativeNumber(patch.maximum_stock, 0);
  if ("safety_stock" in patch) next.safety_stock = nonNegativeNumber(patch.safety_stock, 0);
  if ("safety_lead_time_days" in patch) next.safety_lead_time_days = Math.round(nonNegativeNumber(patch.safety_lead_time_days, 0));
  if ("lead_time_days" in patch) next.lead_time_days = Math.round(nonNegativeNumber(patch.lead_time_days, 0));
  if ("unit_of_measure" in patch || "uom" in patch) {
    next.unit_of_measure = normalizeOptionalText(patch.unit_of_measure || patch.uom) || "pcs";
  }
  if ("preferred_supplier_agent_id" in patch) {
    next.preferred_supplier_agent_id = normalizeOptionalText(patch.preferred_supplier_agent_id);
  }
  if ("fallback_supplier_agent_ids" in patch) next.fallback_supplier_agent_ids = normalizeTextArray(patch.fallback_supplier_agent_ids);
  if ("review_frequency_days" in patch) next.review_frequency_days = Math.round(nonNegativeNumber(patch.review_frequency_days, 0));
  if ("auto_reorder_enabled" in patch) next.auto_reorder_enabled = normalizeBoolean(patch.auto_reorder_enabled, false);
  if ("approval_required" in patch) next.approval_required = normalizeBoolean(patch.approval_required, true);
  if ("approval_threshold_value" in patch) next.approval_threshold_value = nonNegativeNumber(patch.approval_threshold_value, 0);
  if ("abc_classification" in patch || "abc_class" in patch) {
    next.abc_classification = normalizeEnum(patch.abc_classification || patch.abc_class, ABC_CLASSES, null, { upper: true });
  }
  for (const key of [
    "target_service_level",
    "actual_service_level",
    "otif_target",
    "otif_actual",
    "out_of_stock_count",
    "missed_sales_opportunity_count",
    "missed_sales_opportunity_value",
    "lead_time_variability",
    "supplier_reliability_score",
    "unit_cost",
    "average_cost",
    "holding_cost_percent",
    "reorder_transaction_cost",
    "freight_cost_estimate",
    "landed_cost_estimate",
    "stockout_cost_estimate",
    "daily_consumption_rate",
    "weekly_consumption_rate",
    "open_customer_demand",
    "minimum_order_qty",
    "order_multiple"
  ]) {
    if (key in patch) next[key] = nonNegativeNumber(patch[key], 0);
  }
  if ("supplier_risk_level" in patch) next.supplier_risk_level = normalizeEnum(patch.supplier_risk_level, SUPPLIER_RISK_LEVELS, "medium");
  if ("single_source_risk" in patch) next.single_source_risk = normalizeBoolean(patch.single_source_risk, false);
  if ("supply_disruption_flag" in patch) next.supply_disruption_flag = normalizeBoolean(patch.supply_disruption_flag, false);
  if ("alternative_supplier_available" in patch) next.alternative_supplier_available = normalizeBoolean(patch.alternative_supplier_available, false);
  if ("allow_negative_stock" in patch) {
    next.allow_negative_stock = normalizeBoolean(patch.allow_negative_stock, false);
  }

  const profile = normalizeInventoryProfile({ ...(options.material || {}), attrs: { inventory: next } }, {
    conditions: options.conditions || []
  });
  next.stock_status = profile.stock_status;
  next.risk_status = profile.risk_status;
  next.days_of_cover = profile.days_of_cover;
  next.predicted_out_of_stock_date = profile.predicted_out_of_stock_date;
  next.cash_required_for_reorder = profile.cash_required_for_reorder;
  next.policy_source = profile.policy_source;
  next.policy_condition_codes = profile.policy_condition_codes;
  next.effective_policy = profile.effective_policy;
  next.material_override_fields = profile.material_override_fields;
  next.recommendation_snapshot = profile.recommendation;
  currentAttrs.inventory = next;
  return currentAttrs;
}

export function normalizeMovement(input = {}) {
  const movementType = normalizeText(input.movement_type || input.type || "manual_adjustment").toLowerCase();
  const direction = normalizeText(input.direction || "adjust").toLowerCase();
  const quantity = finiteNumber(input.quantity, null);
  const balanceAfter = finiteNumber(input.balance_after ?? input.stock_on_hand_after, null);

  if (!MOVEMENT_TYPES.has(movementType)) {
    return { ok: false, error: "INVALID_MOVEMENT_TYPE" };
  }
  if (!MOVEMENT_DIRECTIONS.has(direction)) {
    return { ok: false, error: "INVALID_MOVEMENT_DIRECTION" };
  }
  if (!Number.isFinite(quantity) || quantity === 0) {
    return { ok: false, error: "QUANTITY_REQUIRED" };
  }
  if (direction !== "adjust" && quantity < 0) {
    return { ok: false, error: "QUANTITY_MUST_BE_POSITIVE" };
  }

  return {
    ok: true,
    movement: {
      movement_type: movementType,
      direction,
      quantity,
      unit_of_measure: normalizeOptionalText(input.unit_of_measure || input.uom) || "pcs",
      reason: normalizeOptionalText(input.reason),
      source_object_kind: normalizeOptionalText(input.source_object_kind),
      source_object_id: normalizeOptionalText(input.source_object_id),
      balance_after: balanceAfter,
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {}
    }
  };
}

export function applyInventoryMovement(attrs = {}, movement = {}, options = {}) {
  const currentAttrs = attrs && typeof attrs === "object" ? { ...attrs } : {};
  const inventory = sourceInventory(currentAttrs);
  const current = normalizeInventoryProfile({ ...(options.material || {}), attrs: { inventory } }, {
    conditions: options.conditions || []
  });
  const qty = finiteNumber(movement.quantity, 0);
  let stockOnHand = current.stock_on_hand;
  let reservedQty = current.reserved_qty;
  let availableQty = current.available_qty;

  if (movement.direction === "in") {
    stockOnHand += qty;
    availableQty += qty;
  } else if (movement.direction === "out") {
    stockOnHand -= qty;
    availableQty -= qty;
  } else if (movement.direction === "reserve") {
    reservedQty += qty;
    availableQty -= qty;
  } else if (movement.direction === "release") {
    reservedQty = Math.max(0, reservedQty - qty);
    availableQty += qty;
  } else if (movement.direction === "adjust") {
    if (Number.isFinite(movement.balance_after)) {
      stockOnHand = movement.balance_after;
    } else {
      stockOnHand += qty;
    }
    availableQty = stockOnHand - reservedQty;
  }

  const nextInventory = {
    ...inventory,
    track_stock: true,
    track_inventory: true,
    stock_on_hand: roundQty(stockOnHand),
    on_hand: roundQty(stockOnHand),
    reserved_qty: roundQty(reservedQty),
    available_qty: roundQty(availableQty),
    unit_of_measure: movement.unit_of_measure || current.unit_of_measure,
    last_movement_at: new Date().toISOString()
  };
  const nextProfile = normalizeInventoryProfile({ ...(options.material || {}), attrs: { inventory: nextInventory } }, {
    conditions: options.conditions || []
  });
  nextInventory.stock_status = nextProfile.stock_status;
  nextInventory.risk_status = nextProfile.risk_status;
  nextInventory.days_of_cover = nextProfile.days_of_cover;
  nextInventory.predicted_out_of_stock_date = nextProfile.predicted_out_of_stock_date;
  nextInventory.cash_required_for_reorder = nextProfile.cash_required_for_reorder;
  nextInventory.policy_source = nextProfile.policy_source;
  nextInventory.policy_condition_codes = nextProfile.policy_condition_codes;
  nextInventory.effective_policy = nextProfile.effective_policy;
  nextInventory.material_override_fields = nextProfile.material_override_fields;
  nextInventory.recommendation_snapshot = nextProfile.recommendation;
  currentAttrs.inventory = nextInventory;

  return {
    attrs: currentAttrs,
    profile: nextProfile,
    movement_record: {
      ...movement,
      balance_after: nextProfile.stock_on_hand,
      available_after: nextProfile.available_qty,
      reserved_after: nextProfile.reserved_qty,
      stock_status_after: nextProfile.stock_status
    }
  };
}

export function buildReorderSuggestionPayload(material, profile, source = "low_stock_detection") {
  return {
    material_id: material.id,
    material_code: material.code || null,
    material_name: material.name || null,
    material_type: material.material_type || null,
    suggested_qty: profile.suggested_qty,
    reorder_point: profile.reorder_point,
    reorder_qty: profile.reorder_qty,
    stock_on_hand: profile.stock_on_hand,
    available_qty: profile.available_qty,
    reserved_qty: profile.reserved_qty,
    unit_of_measure: profile.unit_of_measure,
    preferred_supplier_agent_id: profile.preferred_supplier_agent_id,
    fallback_supplier_agent_ids: profile.fallback_supplier_agent_ids,
    lead_time_days: profile.lead_time_days,
    safety_lead_time_days: profile.safety_lead_time_days,
    safety_stock: profile.safety_stock,
    minimum_stock: profile.minimum_stock,
    maximum_stock: profile.maximum_stock,
    abc_classification: profile.abc_classification,
    risk_status: profile.risk_status,
    days_of_cover: profile.days_of_cover,
    predicted_out_of_stock_date: profile.predicted_out_of_stock_date,
    daily_consumption_rate: profile.daily_consumption_rate,
    open_customer_demand: profile.open_customer_demand,
    supplier_risk_level: profile.supplier_risk_level,
    single_source_risk: profile.single_source_risk,
    alternative_supplier_available: profile.alternative_supplier_available,
    minimum_order_qty: profile.minimum_order_qty,
    order_multiple: profile.order_multiple,
    inventory_value: profile.inventory_value,
    unit_cost: profile.unit_cost,
    average_cost: profile.average_cost,
    cash_required_for_reorder: profile.cash_required_for_reorder,
    projected_cash_impact: profile.projected_cash_impact,
    stockout_cost_estimate: profile.stockout_cost_estimate,
    reason: profile.recommendation?.reason || "available_qty below reorder point",
    recommendation: profile.recommendation,
    decision_card: profile.decision_card,
    action_proposals: profile.action_proposals,
    purchase_requisition_bridge: profile.purchase_requisition_bridge,
    policy_source: profile.policy_source,
    policy_condition_codes: profile.policy_condition_codes,
    effective_policy: profile.effective_policy,
    process_parameters: profile.recommendation?.process_parameters || profile.purchase_requisition_bridge?.process_parameters || null,
    stock_status: profile.stock_status,
    status: "open",
    source
  };
}

export function normalizeReorderStatus(value, fallback = "open") {
  const status = normalizeText(value).toLowerCase();
  return REORDER_STATUSES.has(status) ? status : fallback;
}

export function normalizeInventoryTaskType(value, fallback = "REORDER_REVIEW") {
  const type = normalizeText(value || fallback).toUpperCase();
  return TASK_TYPES.has(type) ? type : fallback;
}

export {
  ABC_CLASSES,
  INVENTORY_RISK_STATUSES,
  MOVEMENT_DIRECTIONS,
  MOVEMENT_TYPES,
  REORDER_STATUSES,
  STOCK_STATUS,
  SUPPLIER_RISK_LEVELS,
  TASK_TYPES
};
