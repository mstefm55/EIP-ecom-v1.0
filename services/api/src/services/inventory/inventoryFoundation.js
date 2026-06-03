const STOCK_STATUS = {
  IN_STOCK: "in_stock",
  LOW_STOCK: "low_stock",
  OUT_OF_STOCK: "out_of_stock",
  UNTRACKED: "untracked",
  NEGATIVE_STOCK: "negative_stock"
};

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

const TASK_TYPES = new Set(["STOCK_REVIEW", "REORDER_REVIEW", "STOCK_COUNT", "SUPPLIER_CHECK"]);

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

function sourceInventory(attrs = {}) {
  return attrs?.inventory && typeof attrs.inventory === "object" && !Array.isArray(attrs.inventory)
    ? { ...attrs.inventory }
    : {};
}

function resolveTracked(inventory) {
  if ("track_stock" in inventory) return normalizeBoolean(inventory.track_stock, false);
  return normalizeBoolean(inventory.track_inventory, false);
}

export function normalizeInventoryProfile(material = {}) {
  const attrs = material?.attrs && typeof material.attrs === "object" ? material.attrs : {};
  const inventory = sourceInventory(attrs);
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
  const leadTimeDays = nonNegativeNumber(inventory.lead_time_days, 0);
  const unitOfMeasure = normalizeOptionalText(inventory.unit_of_measure || inventory.uom) || "pcs";
  const preferredSupplierAgentId = normalizeOptionalText(inventory.preferred_supplier_agent_id);

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
  } else {
    stockStatus = STOCK_STATUS.IN_STOCK;
  }

  const reorderDelta = Math.max(0, reorderPoint - availableQty);
  const suggestedQty = trackStock && signals.includes("needs_reorder")
    ? roundQty(Math.max(reorderQty, reorderDelta, 1))
    : 0;

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
    preferred_supplier_agent_id: preferredSupplierAgentId,
    lead_time_days: leadTimeDays,
    unit_of_measure: unitOfMeasure,
    stock_status: stockStatus,
    signals,
    needs_reorder: signals.includes("needs_reorder"),
    suggested_qty: suggestedQty,
    last_movement_at: normalizeOptionalText(inventory.last_movement_at)
  };
}

export function mergeInventoryPolicy(attrs = {}, patch = {}) {
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
  if ("lead_time_days" in patch) next.lead_time_days = Math.round(nonNegativeNumber(patch.lead_time_days, 0));
  if ("unit_of_measure" in patch || "uom" in patch) {
    next.unit_of_measure = normalizeOptionalText(patch.unit_of_measure || patch.uom) || "pcs";
  }
  if ("preferred_supplier_agent_id" in patch) {
    next.preferred_supplier_agent_id = normalizeOptionalText(patch.preferred_supplier_agent_id);
  }
  if ("allow_negative_stock" in patch) {
    next.allow_negative_stock = normalizeBoolean(patch.allow_negative_stock, false);
  }

  const profile = normalizeInventoryProfile({ attrs: { inventory: next } });
  next.stock_status = profile.stock_status;
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

export function applyInventoryMovement(attrs = {}, movement = {}) {
  const currentAttrs = attrs && typeof attrs === "object" ? { ...attrs } : {};
  const inventory = sourceInventory(currentAttrs);
  const current = normalizeInventoryProfile({ attrs: { inventory } });
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
  const nextProfile = normalizeInventoryProfile({ attrs: { inventory: nextInventory } });
  nextInventory.stock_status = nextProfile.stock_status;
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
    lead_time_days: profile.lead_time_days,
    reason: profile.signals.includes("negative_stock")
      ? "negative stock requires review"
      : profile.signals.includes("out_of_stock")
        ? "out of stock"
        : "available_qty below reorder point",
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
  MOVEMENT_DIRECTIONS,
  MOVEMENT_TYPES,
  REORDER_STATUSES,
  STOCK_STATUS,
  TASK_TYPES
};
