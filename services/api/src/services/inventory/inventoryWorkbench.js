import { normalizeInventoryProfile } from "./inventoryFoundation.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function materialLabel(material = {}, fallback = "Material") {
  return [material.code, material.name].filter(Boolean).join(" - ") || material.name || material.code || fallback;
}

function objectRef(item, fallbackKind) {
  if (!item) return null;
  return {
    id: item.id,
    code: item.code || null,
    title: item.title || null,
    label: [item.code, item.title].filter(Boolean).join(" - ") || item.title || item.code || fallbackKind,
    status: item.status || null,
    object_type: item.object_type || fallbackKind || null,
    created_at: item.created_at || null,
    updated_at: item.updated_at || null
  };
}

function movementRef(item = {}) {
  const payload = item.payload && typeof item.payload === "object" ? item.payload : {};
  return {
    id: item.id,
    title: item.title || null,
    movement_type: payload.movement_type || null,
    direction: payload.direction || null,
    quantity: numberOrNull(payload.quantity),
    unit_of_measure: payload.unit_of_measure || null,
    balance_after: numberOrNull(payload.balance_after),
    available_after: numberOrNull(payload.available_after),
    reason: payload.reason || item.description || null,
    created_at: item.created_at || null
  };
}

function taskRef(item = {}) {
  return {
    id: item.id,
    task_type: item.task_type || null,
    status: item.status || null,
    title: item.title || null,
    due_at: item.due_at || null,
    created_at: item.created_at || null
  };
}

function materialOverrideSnapshot(material = {}, profile = {}) {
  const inventory = material?.attrs?.inventory && typeof material.attrs.inventory === "object" ? material.attrs.inventory : {};
  const fields = Array.isArray(profile.material_override_fields) ? profile.material_override_fields : [];
  return {
    fields,
    values: Object.fromEntries(fields.map((field) => [field, inventory[field] ?? null]))
  };
}

function buildRiskExplanation(profile = {}, suggestion = {}) {
  const recommendation = suggestion.recommendation || suggestion.attrs?.recommendation || profile.recommendation || {};
  return {
    headline: suggestion.decision_card?.headline || profile.decision_card?.headline || suggestion.reason || recommendation.reason || "Review stock signal.",
    risk_status: suggestion.risk_status || profile.risk_status || null,
    reason: suggestion.reason || recommendation.reason || null,
    signals: Array.isArray(profile.signals) ? profile.signals : [],
    explanation: Array.isArray(recommendation.explanation) ? recommendation.explanation : [],
    approval_reasons: Array.isArray(recommendation.approval_reasons) ? recommendation.approval_reasons : []
  };
}

function composeProcurementBridge({ suggestion, requisition, rfq }) {
  const suggestionStatus = normalizeText(suggestion?.status).toLowerCase();
  const handoffReady = suggestionStatus === "approved" || Boolean(requisition || rfq);
  return {
    status: rfq
      ? "rfq_started"
      : requisition
        ? "requisition_started"
        : handoffReady
          ? "ready_for_procurement"
          : "inventory_review_required",
    purchase_need: objectRef(suggestion, "INVENTORY_REORDER_SUGGESTION"),
    requisition: objectRef(requisition, "PURCHASE_REQUISITION"),
    rfq: objectRef(rfq, "PURCHASE_RFQ"),
    workbench_endpoint: suggestion?.id ? `/api/eip/procurement/purchase-needs/${suggestion.id}/workbench` : null,
    handoff_module: "procurement",
    boundary:
      "Inventory explains the stock risk and approved purchase need. Procurement governs supplier options, buying route, RFQ/quote work, and purchase preparation.",
    can_open_procurement: Boolean(suggestion?.id),
    ready_for_procurement: handoffReady
  };
}

function composeTimeline({ suggestion, profile, requisition, rfq, tasks = [] }) {
  return [
    {
      code: "stock_signal_detected",
      label: "Stock signal detected",
      status: profile.risk_status || suggestion?.risk_status || null,
      timestamp: suggestion?.created_at || null,
      detail: suggestion?.reason || profile.recommendation?.reason || "Inventory policy detected a reorder signal."
    },
    {
      code: "policy_resolved",
      label: "Policy resolved",
      status: profile.policy_source || null,
      timestamp: suggestion?.created_at || null,
      detail: Array.isArray(profile.policy_condition_codes) && profile.policy_condition_codes.length
        ? profile.policy_condition_codes.join(", ")
        : "Material inventory policy"
    },
    {
      code: "reorder_review",
      label: "Reorder review",
      status: suggestion?.status || null,
      timestamp: suggestion?.updated_at || suggestion?.created_at || null,
      detail: suggestion?.decision_card?.suggested_reorder || profile.decision_card?.suggested_reorder || null
    },
    requisition ? {
      code: "procurement_requisition",
      label: "Procurement requisition",
      status: requisition.status || null,
      timestamp: requisition.created_at || null,
      detail: requisition.code || requisition.title || null
    } : null,
    rfq ? {
      code: "procurement_rfq",
      label: "Supplier quote phase",
      status: rfq.status || null,
      timestamp: rfq.created_at || null,
      detail: rfq.code || rfq.title || null
    } : null,
    ...tasks.slice(0, 4).map((task) => ({
      code: "inventory_task",
      label: task.title || "Inventory task",
      status: task.status || null,
      timestamp: task.created_at || task.due_at || null,
      detail: task.task_type || null
    }))
  ].filter(Boolean);
}

function composeNextActions({ suggestion, profile, procurementBridge, tasks = [], processState = {} }) {
  const status = normalizeText(suggestion?.status).toLowerCase();
  const actions = [];

  if (["open", "review"].includes(status)) {
    actions.push({
      code: "approve_reorder_suggestion",
      label: "Approve purchase need",
      tone: "primary",
      method: "POST",
      endpoint: `/api/eip/inventory/reorder-suggestions/${suggestion.id}/approve`,
      body: {},
      reason: "Approves the inventory signal through the configured reorder process before procurement continues.",
      process_status: processState.suggestion?.status || null
    });
    actions.push({
      code: "ignore_signal",
      label: "Ignore signal",
      tone: "danger",
      method: "POST",
      endpoint: `/api/eip/inventory/reorder-suggestions/${suggestion.id}/ignore`,
      body: {},
      reason: "Stops this reorder signal through the configured process.",
      process_status: processState.suggestion?.status || null
    });
  }

  if (procurementBridge?.can_open_procurement) {
    actions.push({
      code: "open_procurement_workbench",
      label: procurementBridge.ready_for_procurement ? "Open in Procurement" : "View procurement handoff",
      tone: procurementBridge.ready_for_procurement ? "primary" : "soft",
      method: "GET",
      endpoint: procurementBridge.workbench_endpoint,
      body: {},
      reason: procurementBridge.ready_for_procurement
        ? "Continue supplier options, buying route, RFQ, quotes, or cash purchase in Procurement."
        : "Procurement owns the buying journey after this inventory review is approved.",
      process_status: processState.requisition?.status || processState.suggestion?.status || null
    });
  }

  if (!tasks.some((task) => normalizeText(task.task_type).toUpperCase() === "SUPPLIER_CHECK")) {
    actions.push({
      code: "create_supplier_check_task",
      label: "Create supplier check task",
      tone: "secondary",
      method: "POST",
      endpoint: `/api/eip/inventory/reorder-suggestions/${suggestion.id}/tasks`,
      body: { task_type: "SUPPLIER_CHECK", title: "Check supplier before purchase" },
      reason: "Creates a governed follow-up task without committing to a purchase.",
      process_status: processState.suggestion?.status || null
    });
  }

  if (!Number(profile?.suggested_qty || suggestion?.suggested_qty || 0)) {
    actions.push({
      code: "adjust_reorder_policy",
      label: "Review reorder policy",
      tone: "secondary",
      method: "UI",
      endpoint: null,
      body: {},
      reason: "The recommendation cannot propose a quantity until material policy is complete.",
      process_status: processState.suggestion?.status || null
    });
  }

  return actions;
}

export function composeInventorySignalWorkbench(input = {}) {
  const {
    suggestion,
    material,
    conditions = [],
    movements = [],
    requisition = null,
    rfq = null,
    tasks = [],
    processState = {}
  } = input;
  const profile = material
    ? normalizeInventoryProfile(material, { conditions })
    : {
        ...(suggestion?.attrs || {}),
        ...(suggestion?.attrs?.stock_profile || {}),
        recommendation: suggestion?.recommendation || suggestion?.attrs?.recommendation || null
      };
  const effectivePolicy = profile.effective_policy || suggestion?.effective_policy || suggestion?.attrs?.effective_policy || {};
  const procurementBridge = composeProcurementBridge({ suggestion, requisition, rfq });
  const recentMovements = movements.map(movementRef);
  const normalizedTasks = tasks.map(taskRef);

  return {
    ok: true,
    signal: {
      id: suggestion.id,
      code: suggestion.code || null,
      title: suggestion.title || null,
      label: suggestion.material_name || suggestion.title || suggestion.code || "Inventory signal",
      status: suggestion.status || null,
      risk_status: suggestion.risk_status || profile.risk_status || null,
      reason: suggestion.reason || profile.recommendation?.reason || null,
      created_at: suggestion.created_at || null,
      updated_at: suggestion.updated_at || null
    },
    material: material ? {
      id: material.id,
      code: material.code || null,
      name: material.name || null,
      label: materialLabel(material),
      material_type: material.material_type || null,
      supplier_name: material.supplier_name || null
    } : null,
    inventory_state: {
      stock_status: profile.stock_status || null,
      risk_status: profile.risk_status || suggestion.risk_status || null,
      stock_on_hand: numberOrNull(profile.stock_on_hand ?? suggestion.attrs?.stock_on_hand),
      reserved_qty: numberOrNull(profile.reserved_qty ?? suggestion.attrs?.reserved_qty),
      available_qty: numberOrNull(profile.available_qty ?? suggestion.attrs?.available_qty),
      reorder_point: numberOrNull(profile.reorder_point ?? suggestion.attrs?.reorder_point),
      reorder_qty: numberOrNull(profile.reorder_qty ?? suggestion.attrs?.reorder_qty),
      suggested_qty: numberOrNull(profile.suggested_qty ?? suggestion.suggested_qty),
      unit_of_measure: profile.unit_of_measure || suggestion.attrs?.unit_of_measure || null,
      days_of_cover: numberOrNull(profile.days_of_cover ?? suggestion.days_of_cover),
      predicted_out_of_stock_date: profile.predicted_out_of_stock_date || suggestion.predicted_out_of_stock_date || null,
      cash_required_for_reorder: numberOrNull(profile.cash_required_for_reorder ?? suggestion.cash_required_for_reorder),
      supplier_risk_level: profile.supplier_risk_level || suggestion.supplier_risk_level || null
    },
    risk_explanation: buildRiskExplanation(profile, suggestion),
    effective_policy: effectivePolicy,
    policy_source: {
      source: profile.policy_source || suggestion.policy_source || null,
      condition_codes: Array.isArray(profile.policy_condition_codes) && profile.policy_condition_codes.length
        ? profile.policy_condition_codes
        : suggestion.policy_condition_codes || [],
      commercial_condition_governed: (profile.policy_condition_codes || suggestion.policy_condition_codes || []).length > 0
    },
    material_override: materialOverrideSnapshot(material, profile),
    reorder_recommendation: profile.recommendation || suggestion.recommendation || suggestion.attrs?.recommendation || null,
    procurement_bridge: procurementBridge,
    recent_movements: recentMovements,
    process_timeline: composeTimeline({ suggestion, profile, requisition, rfq, tasks: normalizedTasks }),
    open_tasks: normalizedTasks,
    next_actions: composeNextActions({ suggestion, profile, procurementBridge, tasks: normalizedTasks, processState })
  };
}
