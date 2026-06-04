import {
  PROCUREMENT_CONDITION_CATEGORIES,
  PROCUREMENT_CONDITION_TYPES
} from "./procurementFoundation.js";

export const PROCUREMENT_OBJECT_TYPES = Object.freeze({
  REORDER_SUGGESTION: "INVENTORY_REORDER_SUGGESTION",
  PURCHASE_REQUISITION: "PURCHASE_REQUISITION",
  PURCHASE_RFQ: "PURCHASE_RFQ",
  CASH_PURCHASE: "CASH_PURCHASE"
});

export const PROCUREMENT_LINK_TYPES = Object.freeze({
  MATERIAL_SUPPLIER: "MATERIAL_SUPPLIER"
});

export const PROCUREMENT_RECORD_TYPES = Object.freeze({
  SUPPLIER_QUOTE: "SUPPLIER_QUOTE",
  SUPPLIER_QUOTE_COMPARISON: "SUPPLIER_QUOTE_COMPARISON",
  CASH_PURCHASE_RECEIPT: "PROCUREMENT_CASH_PURCHASE_RECEIPT",
  INVENTORY_STOCK_MOVEMENT: "INVENTORY_STOCK_MOVEMENT"
});

export async function listProcurementConditions(client, tenantId) {
  const result = await client.query(
    `
    SELECT id, code, label, condition_type, condition_category, priority,
           valid_from, valid_to, scope, effect, attrs, created_at, updated_at
    FROM eip_core.commercial_condition
    WHERE tenant_id=$1
      AND is_active=true
      AND (valid_from IS NULL OR valid_from <= now())
      AND (valid_to IS NULL OR valid_to > now())
      AND (
        UPPER(COALESCE(condition_type,'')) = ANY($2::text[])
        OR UPPER(COALESCE(condition_category,'')) = ANY($3::text[])
      )
    ORDER BY priority ASC, created_at DESC
    `,
    [
      tenantId,
      Array.from(PROCUREMENT_CONDITION_TYPES),
      Array.from(PROCUREMENT_CONDITION_CATEGORIES)
    ]
  );
  return result.rows || [];
}

export function serializeMaterial(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    material_type: row.material_type,
    attrs: row.attrs || {},
    label: [row.code, row.name].filter(Boolean).join(" - ") || row.id
  };
}

export function serializeAgent(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    agent_type: row.agent_type,
    label: [row.code, row.name].filter(Boolean).join(" - ") || row.id
  };
}

export function buildStockProfileFromNeed(need, material) {
  const attrs = need?.attrs || {};
  const inventory = material?.attrs?.inventory && typeof material.attrs.inventory === "object"
    ? material.attrs.inventory
    : {};
  return {
    ...inventory,
    ...(attrs.stock_profile || {}),
    ...attrs,
    recommendation: attrs.recommendation || attrs.reorder_recommendation || inventory.recommendation || null,
    material_id: attrs.material_id || material?.id || inventory.material_id || null,
    material_code: attrs.material_code || material?.code || inventory.material_code || null,
    material_name: attrs.material_name || material?.name || inventory.material_name || null,
    suggested_qty: Number(attrs.suggested_qty ?? attrs.recommended_qty ?? attrs.reorder_qty ?? inventory.suggested_qty ?? inventory.reorder_qty ?? 0),
    unit_of_measure: attrs.unit_of_measure || inventory.unit_of_measure || "pcs",
    stock_on_hand: Number(inventory.stock_on_hand ?? inventory.on_hand ?? attrs.stock_on_hand ?? 0),
    reserved_qty: Number(inventory.reserved_qty ?? attrs.reserved_qty ?? 0),
    available_qty: Number(inventory.available_qty ?? attrs.available_qty ?? Math.max(0, Number(inventory.stock_on_hand ?? inventory.on_hand ?? 0) - Number(inventory.reserved_qty ?? 0))),
    days_of_cover: attrs.days_of_cover ?? inventory.days_of_cover ?? null,
    predicted_out_of_stock_date: attrs.predicted_out_of_stock_date || inventory.predicted_out_of_stock_date || null,
    abc_classification: attrs.abc_classification || inventory.abc_classification || null,
    risk_status: attrs.risk_status || inventory.risk_status || attrs.recommendation?.risk_status || null,
    source_reason: attrs.reason || attrs.trigger_reason || attrs.recommendation?.reason || "inventory_reorder_need"
  };
}

export function composeCashPurchaseOption(recommendation, stockProfile) {
  const cashAllowed = recommendation?.effective_policy?.cash_purchase_allowed === true;
  const cashRoute = recommendation?.procurement_model === "cash_shop_purchase";
  if (!cashAllowed && !cashRoute) return null;
  return {
    available: cashAllowed || cashRoute,
    recommended: cashRoute,
    reason: cashRoute ? "below_cash_purchase_limit" : "allowed_as_fallback",
    quantity: recommendation?.requested_qty || stockProfile?.suggested_qty || 0,
    unit_of_measure: stockProfile?.unit_of_measure || "pcs",
    cash_required: recommendation?.cash_required || 0,
    currency: recommendation?.currency || recommendation?.effective_policy?.currency || "EUR",
    payment_terms_code: cashRoute ? "DUE_ON_RECEIPT" : recommendation?.payment_terms_code || "NET_30"
  };
}

export function composeProcurementTimeline({ need, requisition, rfq, quotes, quoteComparison, processState = {} }) {
  return [
    {
      code: "need_detected",
      label: "Need detected",
      status: need?.status || "open",
      timestamp: need?.created_at,
      detail: need?.attrs?.reason || need?.attrs?.risk_status || "Inventory purchase need"
    },
    requisition ? {
      code: "requisition_drafted",
      label: "Requisition drafted",
      status: requisition.status,
      timestamp: requisition.created_at,
      detail: requisition.code || requisition.title,
      process_status: processState.requisition?.status || null
    } : {
      code: "requisition_pending",
      label: "Requisition not created yet",
      status: "pending",
      timestamp: null,
      detail: null
    },
    rfq ? {
      code: "rfq_created",
      label: "Request quotes",
      status: rfq.status,
      timestamp: rfq.created_at,
      detail: rfq.code || rfq.title,
      process_status: processState.rfq?.status || null
    } : null,
    quotes?.length ? {
      code: "quotes_received",
      label: "Supplier offers received",
      status: "received",
      timestamp: quotes[0]?.created_at,
      detail: `${quotes.length} offer${quotes.length === 1 ? "" : "s"} recorded`
    } : null,
    quoteComparison ? {
      code: "quotes_compared",
      label: "Offers compared",
      status: "comparison_ready",
      timestamp: quoteComparison.created_at,
      detail: quoteComparison.payload?.recommended_supplier_agent_id || null
    } : null,
    rfq?.status === "supplier_selected" ? {
      code: "quote_approved",
      label: "Offer approved",
      status: "supplier_selected",
      timestamp: rfq.updated_at,
      detail: rfq.attrs?.quote_comparison?.recommended_supplier_agent_id || null
    } : null
  ].filter(Boolean);
}

export function composeProcurementNextActions({ need, requisition, rfq, quotes = [], quoteComparison, recommendation, cashPurchaseOption, processState = {} }) {
  if (!requisition) {
    const actions = [{
      code: "create_requisition",
      label: "Create requisition",
      tone: "primary",
      endpoint: "/api/eip/procurement/requisitions/from-reorder",
      body: { reorder_suggestion_id: need.id },
      reason: "Start the governed buying review for this purchase need.",
      process_status: processState.need?.status || null
    }];
    if (cashPurchaseOption?.recommended) {
      actions.unshift({
        code: "record_cash_purchase",
        label: "Record cash purchase",
        tone: "primary",
        endpoint: "/api/eip/procurement/cash-purchases",
        body: {
          material_id: recommendation?.material_id || need.attrs?.material_id,
          quantity: cashPurchaseOption.quantity,
          currency: cashPurchaseOption.currency
        },
        reason: "Policy allows a low-value cash/shop purchase.",
        process_status: processState.need?.status || null
      });
    }
    return actions;
  }

  if (["draft", "review"].includes(requisition.status)) {
    return [
      {
        code: "approve_requisition",
        label: "Approve requisition",
        tone: "primary",
        endpoint: `/api/eip/procurement/requisitions/${requisition.id}/approve`,
        body: {},
        reason: "Approve the owner decision before quote or purchase preparation.",
        process_status: processState.requisition?.status || null
      },
      {
        code: "ignore_requisition",
        label: "Ignore",
        tone: "danger",
        endpoint: `/api/eip/procurement/requisitions/${requisition.id}/ignore`,
        body: {},
        reason: "Stop this buying path.",
        process_status: processState.requisition?.status || null
      }
    ];
  }

  if (requisition.status === "approved" && !rfq && ["request_for_quote", "multi_supplier_quote_comparison"].includes(recommendation?.procurement_model)) {
    return [{
      code: "create_rfq",
      label: "Request quotes",
      tone: "primary",
      endpoint: "/api/eip/procurement/rfqs/from-requisition",
      body: { requisition_id: requisition.id },
      reason: "Policy recommends supplier offers before approval.",
      process_status: processState.requisition?.status || null
    }];
  }

  if (rfq && quotes.length === 0) {
    return [{
      code: "add_quote",
      label: "Add supplier offer",
      tone: "primary",
      endpoint: `/api/eip/procurement/rfqs/${rfq.id}/quotes`,
      body: {},
      reason: "Record the first supplier offer for comparison.",
      process_status: processState.rfq?.status || null
    }];
  }

  if (rfq && quotes.length > 0 && !quoteComparison) {
    return [{
      code: "compare_quotes",
      label: "Compare offers",
      tone: "primary",
      endpoint: `/api/eip/procurement/rfqs/${rfq.id}/compare`,
      body: {},
      reason: "Compare landed cost, lead time, payment terms, and supplier risk.",
      process_status: processState.rfq?.status || null
    }];
  }

  if (rfq && quoteComparison && rfq.status !== "supplier_selected") {
    return [{
      code: "approve_quote",
      label: "Approve recommended offer",
      tone: "primary",
      endpoint: `/api/eip/procurement/rfqs/${rfq.id}/approve-quote`,
      body: {},
      reason: "Approve the recommended supplier offer.",
      process_status: processState.rfq?.status || null
    }];
  }

  return [{
    code: "future_purchase_action",
    label: "Ready for future purchase action",
    tone: "soft",
    endpoint: null,
    body: {},
    reason: "Purchase order execution is not enabled yet; it will be added in a later governed wave.",
    process_status: processState.rfq?.status || processState.requisition?.status || null
  }];
}

export function composePurchaseNeedWorkbench(input = {}) {
  const {
    need,
    material,
    supplierLinks = [],
    recommendation = {},
    requisition,
    rfq,
    quotes = [],
    quoteComparison,
    processState = {}
  } = input;
  const stockProfile = input.stockProfile || buildStockProfileFromNeed(need, material);
  const cashPurchaseOption = composeCashPurchaseOption(recommendation, stockProfile);
  const timeline = composeProcurementTimeline({ need, requisition, rfq, quotes, quoteComparison, processState });
  const nextActions = composeProcurementNextActions({
    need,
    requisition,
    rfq,
    quotes,
    quoteComparison,
    recommendation,
    cashPurchaseOption,
    processState
  });

  return {
    ok: true,
    purchase_need: {
      id: need.id,
      code: need.code,
      title: need.title,
      status: need.status,
      attrs: need.attrs || {},
      created_at: need.created_at,
      updated_at: need.updated_at
    },
    source_reorder_suggestion: need,
    material: serializeMaterial(material),
    inventory_state: stockProfile,
    effective_policy: recommendation.effective_policy,
    supplier_candidates: recommendation.candidate_suppliers || [],
    supplier_options: supplierLinks,
    recommended_procurement_model: recommendation,
    requisition,
    rfq,
    quotes,
    quote_comparison: quoteComparison?.payload || rfq?.attrs?.quote_comparison || null,
    quote_comparison_record: quoteComparison,
    cash_purchase_option: cashPurchaseOption,
    process_timeline: timeline,
    next_actions: nextActions
  };
}
