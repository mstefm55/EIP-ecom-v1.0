import { randomBytes } from "node:crypto";
import { emitSecurityEvent } from "../../lib/securityAudit.js";
import { allowedCodesFrom, loadDropdownCodeSets, loadModuleWorkspace } from "../moduleWorkspace.js";
import {
  EffectivePolicyInputError,
  normalizeEffectivePolicyQuery,
  resolveEffectivePolicy
} from "../policiesConditions/effectivePolicy.js";
import {
  buildSupplierCandidates,
  selectProcurementModel
} from "./procurementFoundation.js";
import {
  PURCHASE_REQUISITION_OBJECT_TYPE,
  advanceObject,
  ensureProcessInstance,
  fetchAgent,
  fetchMaterial,
  fetchServiceObject,
  getPrimaryAgentId,
  linkObject,
  listSupplierLinks
} from "./procurementOperations.js";
import { listProcurementConditions } from "./procurementWorkbench.js";

const MAX_LIMIT = 200;
const REQUEST_OBJECT_TYPE = PURCHASE_REQUISITION_OBJECT_TYPE;
const TENANT_OVERRIDE_RE = /^tenant(_id)?$/i;
const SENSITIVE_KEY_RE = /(secret|token|password|credential|cookie|authorization|signature|api[_-]?key|private[_-]?key|client[_-]?secret|raw[_-]?legal|legal[_-]?text|compliance[_-]?text)/i;

export const PROCUREMENT_MANAGEMENT_PERMISSIONS = Object.freeze({
  read: "procurement.read",
  requestCreate: "procurement.request.create",
  requestUpdate: "procurement.request.update",
  requestSubmit: "procurement.request.submit",
  requestApprove: "procurement.request.approve",
  recommendationRead: "procurement.recommendation.read",
  policyRead: "procurement.policy.read"
});

export const PROCUREMENT_REQUEST_STATUSES = Object.freeze([
  "DRAFT",
  "NEEDS_REVIEW",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "SOURCING",
  "ORDER_PREPARATION",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED"
]);

const REQUEST_DROPDOWN_LISTS = Object.freeze([
  "PROCUREMENT_REQUEST_STATUS",
  "PROCUREMENT_MODEL",
  "SUPPLIER_ROLE",
  "SUPPLIER_ACCREDITATION_STATUS",
  "PAYMENT_TERMS",
  "INCOTERM"
]);

const CREATE_FIELDS = new Set([
  "code",
  "title",
  "item_type",
  "material_id",
  "material_code",
  "service_item_name",
  "description",
  "requested_qty",
  "quantity",
  "unit_of_measure",
  "supplier_agent_id",
  "selected_supplier_agent_id",
  "required_by_date",
  "priority",
  "estimated_unit_cost",
  "currency",
  "payment_terms_code",
  "incoterm_code",
  "approval_required",
  "notes",
  "status",
  "attrs"
]);

const UPDATE_FIELDS = new Set([
  "title",
  "description",
  "requested_qty",
  "quantity",
  "unit_of_measure",
  "supplier_agent_id",
  "selected_supplier_agent_id",
  "required_by_date",
  "priority",
  "estimated_unit_cost",
  "currency",
  "payment_terms_code",
  "incoterm_code",
  "approval_required",
  "notes",
  "status",
  "attrs"
]);

const COMMERCIAL_CONDITION_TYPES = new Set([
  "PAYMENT_TERM_CONDITION",
  "SUPPLIER_PURCHASE_CONDITION",
  "MATERIAL_SUPPLIER_CONDITION",
  "FREIGHT_COST_CONDITION",
  "INCOTERM",
  "INCOTERMS",
  "TRADE_CREDIT_CONDITION"
]);

const APPROVAL_CONDITION_TYPES = new Set([
  "APPROVAL_RULE",
  "APPROVAL_POLICY",
  "PROCUREMENT_APPROVAL_RULE",
  "PROCUREMENT_APPROVAL_POLICY"
]);

export class ProcurementInputError extends Error {
  constructor(code, details = null) {
    super(code);
    this.name = "ProcurementInputError";
    this.statusCode = 400;
    this.code = code;
    this.details = details;
  }
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeOptionalText(value, maxLength = 500) {
  const text = normalizeText(value);
  return text ? text.slice(0, maxLength) : null;
}

function normalizeCode(value, fallback = null) {
  const text = normalizeText(value || fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return text || fallback;
}

function toStoredStatus(value, fallback = "DRAFT", governance = null) {
  const status = normalizeCode(value, fallback);
  const allowed = allowedCodesFrom(governance, "PROCUREMENT_REQUEST_STATUS", PROCUREMENT_REQUEST_STATUSES);
  if (!allowed.includes(status)) throw new ProcurementInputError("INVALID_PROCUREMENT_STATUS", { status });
  return status.toLowerCase();
}

function toApiStatus(status) {
  return normalizeCode(status, "DRAFT");
}

function finiteNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumber(value, field, fallback = null) {
  const parsed = finiteNumber(value, fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new ProcurementInputError(`${field.toUpperCase()}_REQUIRED`);
  return parsed;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return fallback;
  const text = normalizeText(value).toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(text)) return true;
  if (["false", "0", "no", "n", "off"].includes(text)) return false;
  return fallback;
}

function normalizeCurrency(value, fallback = "EUR") {
  const code = normalizeCode(value, fallback);
  return /^[A-Z]{3}$/.test(code) ? code : fallback;
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function rejectSensitiveAttrs(value, path = "attrs") {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectSensitiveAttrs(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (TENANT_OVERRIDE_RE.test(key)) throw new ProcurementInputError("TENANT_OVERRIDE_NOT_ALLOWED", { path });
    if (SENSITIVE_KEY_RE.test(key)) throw new ProcurementInputError("SENSITIVE_FIELD_NOT_ALLOWED", { path, field: key });
    rejectSensitiveAttrs(item, `${path}.${key}`);
  }
}

function normalizeAttrs(attrs) {
  const safe = asObject(attrs);
  rejectSensitiveAttrs(safe);
  return safe;
}

function rejectUnknownKeys(body, allowed, label) {
  for (const key of Object.keys(body || {})) {
    if (TENANT_OVERRIDE_RE.test(key)) throw new ProcurementInputError("TENANT_OVERRIDE_NOT_ALLOWED");
    if (!allowed.has(key)) throw new ProcurementInputError("UNKNOWN_FIELD", { label, field: key });
  }
}

function rejectTenantQuery(query = {}) {
  for (const key of Object.keys(query || {})) {
    if (TENANT_OVERRIDE_RE.test(key)) throw new ProcurementInputError("TENANT_OVERRIDE_NOT_ALLOWED");
  }
}

function clampLimit(value) {
  const parsed = Number(value || 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function buildCode(prefix) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function displayLabel(code) {
  const text = normalizeText(code).replace(/_/g, " ").toLowerCase();
  return text ? text.replace(/\b\w/g, (char) => char.toUpperCase()) : null;
}

function classifyCondition(row = {}) {
  const attrs = asObject(row.attrs);
  const classification = asObject(attrs.classification);
  const type = normalizeCode(row.condition_type);
  const category = normalizeCode(row.condition_category);
  if (classification.policy_domain) return normalizeCode(classification.policy_domain);
  if (type === "PAYMENT_TERM_CONDITION" || type === "TRADE_CREDIT_CONDITION") return "COMMERCIAL";
  if (type === "INCOTERM" || type === "INCOTERMS") return "COMMERCIAL";
  if (APPROVAL_CONDITION_TYPES.has(type) || category === "APPROVAL_FRAMEWORK") return "APPROVAL_FRAMEWORK";
  if (category === "FINANCE") return "FINANCIAL";
  return category || "COMMERCIAL";
}

function conditionEffect(row = {}) {
  const effect = asObject(row.effect);
  return {
    procurement_policy: asObject(effect.procurement_policy),
    supplier_policy: asObject(effect.supplier_policy),
    payment_terms: asObject(effect.payment_terms),
    incoterms: asObject(effect.incoterms),
    trade_credit: asObject(effect.trade_credit),
    approval: asObject(effect.approval || effect.approval_framework),
    logistics: asObject(effect.logistics || effect.freight)
  };
}

function safeConditionSummary(row = {}) {
  const effect = conditionEffect(row);
  const domain = classifyCondition(row);
  return {
    id: row.id || null,
    code: row.code || null,
    label: row.label || row.code || null,
    condition_type: row.condition_type || null,
    condition_category: row.condition_category || null,
    policy_domain: domain,
    priority: row.priority,
    payment_terms_code: effect.payment_terms.payment_terms_code || effect.procurement_policy.payment_terms_code || null,
    payment_due_days: effect.payment_terms.payment_due_days ?? effect.procurement_policy.payment_due_days ?? null,
    incoterm_code: effect.incoterms.incoterm_code || effect.logistics.incoterm_code || null,
    approval_required: effect.approval.approval_required ?? effect.procurement_policy.approval_required ?? null,
    approval_threshold_value: effect.approval.approval_threshold_value ?? effect.procurement_policy.approval_threshold_value ?? null,
    currency: effect.payment_terms.currency || effect.procurement_policy.currency || null,
    updated_at: row.updated_at || null
  };
}

function safeRecommendation(recommendation = {}, overrides = {}) {
  const candidates = Array.isArray(recommendation.candidate_suppliers)
    ? recommendation.candidate_suppliers.map((candidate) => ({
        supplier_agent_id: candidate.supplier_agent_id || null,
        supplier_name: candidate.supplier_name || null,
        supplier_role: candidate.supplier_role || null,
        accreditation_status: candidate.accreditation_status || null,
        estimated_landed_cost: candidate.estimated_landed_cost || 0,
        currency: candidate.currency || recommendation.currency || null,
        lead_time_days: candidate.lead_time_days ?? null,
        payment_terms_code: candidate.payment_terms_code || null,
        supplier_risk_level: candidate.supplier_risk_level || null,
        score: candidate.score ?? null
      }))
    : [];
  return {
    requested_material: overrides.requested_material || null,
    requested_service: overrides.requested_service || null,
    requested_quantity: recommendation.requested_qty ?? overrides.requested_quantity ?? null,
    unit_of_measure: overrides.unit_of_measure || null,
    candidate_supplier: candidates[0] || null,
    candidate_suppliers: candidates,
    selected_commercial_condition: overrides.selected_commercial_condition || null,
    payment_terms: recommendation.payment_terms_code
      ? { code: recommendation.payment_terms_code, due_days: recommendation.payment_due_days ?? null }
      : null,
    incoterm: overrides.incoterm || null,
    approval_requirement: {
      required: recommendation.approval_required === true,
      threshold_value: recommendation.effective_policy?.approval_threshold_value ?? null
    },
    procurement_model: recommendation.procurement_model || "request_for_quote",
    reason: recommendation.selection_reason || "partial_recommendation",
    explanation: recommendation.selection_reason ? displayLabel(recommendation.selection_reason) : "Partial recommendation based on available procurement data.",
    warnings: [...(recommendation.risk_flags || []), ...(overrides.warnings || [])],
    missing_data: overrides.missing_data || [],
    estimated_landed_cost: recommendation.estimated_landed_cost || 0,
    currency: recommendation.currency || overrides.currency || null,
    policy_condition_codes: recommendation.policy_condition_codes || []
  };
}

function mapRequestRow(row) {
  if (!row) return null;
  const attrs = asObject(row.attrs);
  const request = asObject(attrs.procurement_management_v1);
  const recommendation = asObject(attrs.recommendation);
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    object_type: row.object_type,
    status: toApiStatus(row.status),
    item_type: request.item_type || attrs.item_type || "MATERIAL",
    material_id: request.material_id || attrs.material_id || null,
    material_code: request.material_code || attrs.material_code || null,
    material_name: request.material_name || attrs.material_name || null,
    service_item_name: request.service_item_name || attrs.service_item_name || null,
    description: request.description || attrs.description || null,
    requested_qty: request.requested_qty ?? attrs.requested_qty ?? null,
    unit_of_measure: request.unit_of_measure || attrs.unit_of_measure || null,
    supplier_agent_id: request.supplier_agent_id || request.selected_supplier_agent_id || attrs.recommended_supplier_agent_id || null,
    supplier_name: request.supplier_name || null,
    required_by_date: request.required_by_date || null,
    priority: request.priority || "NORMAL",
    estimated_unit_cost: request.estimated_unit_cost ?? null,
    estimated_landed_cost: recommendation.estimated_landed_cost ?? request.estimated_landed_cost ?? null,
    currency: request.currency || recommendation.currency || null,
    payment_terms_code: request.payment_terms_code || recommendation.payment_terms?.code || recommendation.payment_terms_code || null,
    incoterm_code: request.incoterm_code || recommendation.incoterm?.code || null,
    approval_required: request.approval_required ?? recommendation.approval_requirement?.required ?? null,
    procurement_model: recommendation.procurement_model || request.procurement_model || null,
    recommendation,
    warnings: Array.isArray(request.warnings) ? request.warnings : [],
    missing_data: Array.isArray(request.missing_data) ? request.missing_data : [],
    owner_agent_id: row.owner_agent_id || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function emitMutation(app, session, eventType, metadata = {}) {
  await emitSecurityEvent(app, eventType, {
    category: "procurement",
    source: "procurement.management.v1",
    tenant_id: session.tenant_id,
    identity_id: session.identity_id,
    metadata
  });
}

async function withTransaction(app, handler) {
  const client = await app.db.connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    if (result?.ok === false) {
      await client.query("ROLLBACK");
      return result;
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resolveMaterialByInput(client, tenantId, body = {}) {
  const materialId = normalizeOptionalText(body.material_id);
  if (materialId) return fetchMaterial(client, tenantId, materialId);
  const materialCode = normalizeOptionalText(body.material_code, 120);
  if (!materialCode) return null;
  const result = await client.query(
    `
    SELECT id, code, name, material_type, attrs, is_active, created_at, updated_at
    FROM eip_core.material
    WHERE tenant_id=$1
      AND code=$2
      AND is_active=true
    LIMIT 1
    `,
    [tenantId, materialCode]
  );
  return result.rows[0] || null;
}

async function resolveSupplierByInput(client, tenantId, body = {}) {
  const supplierId = normalizeOptionalText(body.supplier_agent_id || body.selected_supplier_agent_id);
  if (!supplierId) return null;
  return fetchAgent(client, tenantId, supplierId);
}

function buildStockProfileFromRequest(body = {}, material = null) {
  const materialInventory = asObject(material?.attrs?.inventory);
  const qty = positiveNumber(body.requested_qty ?? body.quantity, "requested_qty");
  return {
    ...materialInventory,
    material_id: material?.id || normalizeOptionalText(body.material_id) || null,
    material_code: material?.code || normalizeOptionalText(body.material_code, 120),
    material_name: material?.name || null,
    suggested_qty: qty,
    requested_qty: qty,
    unit_of_measure: normalizeOptionalText(body.unit_of_measure, 40) || materialInventory.unit_of_measure || "pcs",
    average_cost: finiteNumber(body.estimated_unit_cost, materialInventory.average_cost || materialInventory.unit_cost || 0),
    risk_status: "manual_purchase_need",
    source_reason: "manual_procurement_request"
  };
}

function buildRequestAttrs(body, current = null, context = {}) {
  const currentAttrs = asObject(current?.attrs);
  const currentRequest = asObject(currentAttrs.procurement_management_v1);
  const material = context.material || null;
  const supplier = context.supplier || null;
  const recommendation = context.recommendation || {};
  const stockProfile = context.stockProfile || {};
  const partial = Boolean(current);
  const requestedQty = body.requested_qty ?? body.quantity ?? currentRequest.requested_qty;
  const itemType = normalizeCode(body.item_type || currentRequest.item_type || (material ? "MATERIAL" : "SERVICE"), "MATERIAL");
  const serviceItemName = normalizeOptionalText(body.service_item_name ?? currentRequest.service_item_name, 240);
  if (!partial && itemType === "SERVICE" && !serviceItemName) throw new ProcurementInputError("SERVICE_ITEM_REQUIRED");
  if (!partial && itemType !== "SERVICE" && !material) throw new ProcurementInputError("MATERIAL_REQUIRED");

  const missingData = [];
  if (!material && itemType !== "SERVICE") missingData.push("material");
  if (!supplier && !(recommendation.candidate_suppliers || []).length) missingData.push("supplier");
  if (!body.payment_terms_code && !currentRequest.payment_terms_code && !recommendation.payment_terms_code) missingData.push("payment_terms");
  if (!body.incoterm_code && !currentRequest.incoterm_code) missingData.push("incoterm");

  const warnings = [];
  if (supplier && !(recommendation.candidate_suppliers || []).some((candidate) => candidate.supplier_agent_id === supplier.id)) {
    warnings.push("manual_supplier_selection");
  }
  if (missingData.length) warnings.push("partial_recommendation");

  const safeAttrs = body.attrs !== undefined
    ? { ...asObject(currentRequest.safe_attrs), ...normalizeAttrs(body.attrs) }
    : asObject(currentRequest.safe_attrs);

  const incotermCode = normalizeCode(body.incoterm_code || currentRequest.incoterm_code, null);
  const safeRec = safeRecommendation(recommendation, {
    requested_material: material ? { id: material.id, code: material.code, name: material.name } : null,
    requested_service: itemType === "SERVICE" ? serviceItemName : null,
    requested_quantity: requestedQty,
    unit_of_measure: normalizeOptionalText(body.unit_of_measure || currentRequest.unit_of_measure || stockProfile.unit_of_measure, 40),
    incoterm: incotermCode ? { code: incotermCode } : null,
    warnings,
    missing_data: missingData,
    currency: normalizeCurrency(body.currency || currentRequest.currency || recommendation.currency || "EUR")
  });

  const requestAttrs = {
    ...currentRequest,
    item_type: itemType,
    material_id: material?.id || currentRequest.material_id || null,
    material_code: material?.code || normalizeOptionalText(body.material_code || currentRequest.material_code, 120),
    material_name: material?.name || currentRequest.material_name || null,
    service_item_name: serviceItemName,
    description: normalizeOptionalText(body.description ?? currentRequest.description, 1000),
    requested_qty: requestedQty === undefined ? currentRequest.requested_qty : positiveNumber(requestedQty, "requested_qty"),
    unit_of_measure: normalizeOptionalText(body.unit_of_measure || currentRequest.unit_of_measure || stockProfile.unit_of_measure, 40) || "pcs",
    supplier_agent_id: supplier?.id || currentRequest.supplier_agent_id || null,
    supplier_name: supplier?.name || currentRequest.supplier_name || null,
    required_by_date: normalizeOptionalText(body.required_by_date ?? currentRequest.required_by_date, 40),
    priority: normalizeCode(body.priority || currentRequest.priority || "NORMAL", "NORMAL"),
    estimated_unit_cost: finiteNumber(body.estimated_unit_cost, currentRequest.estimated_unit_cost ?? 0),
    estimated_landed_cost: recommendation.estimated_landed_cost ?? currentRequest.estimated_landed_cost ?? 0,
    currency: normalizeCurrency(body.currency || currentRequest.currency || recommendation.currency || "EUR"),
    payment_terms_code: normalizeCode(body.payment_terms_code || currentRequest.payment_terms_code || recommendation.payment_terms_code, null),
    incoterm_code: incotermCode,
    approval_required: body.approval_required === undefined
      ? currentRequest.approval_required ?? recommendation.approval_required ?? true
      : normalizeBoolean(body.approval_required, true),
    procurement_model: recommendation.procurement_model || currentRequest.procurement_model || null,
    warnings,
    missing_data: missingData,
    notes: normalizeOptionalText(body.notes ?? currentRequest.notes, 2000),
    safe_attrs: safeAttrs,
    version: 1
  };

  return {
    ...currentAttrs,
    procurement_management_v1: requestAttrs,
    material_id: requestAttrs.material_id,
    material_code: requestAttrs.material_code,
    material_name: requestAttrs.material_name,
    service_item_name: requestAttrs.service_item_name,
    requested_qty: requestAttrs.requested_qty,
    unit_of_measure: requestAttrs.unit_of_measure,
    recommended_supplier_agent_id: requestAttrs.supplier_agent_id,
    payment_terms_code: requestAttrs.payment_terms_code,
    incoterm_code: requestAttrs.incoterm_code,
    approval_required: requestAttrs.approval_required,
    recommendation: safeRec,
    process_parameters: {
      object_type: REQUEST_OBJECT_TYPE,
      effect: "PROCUREMENT_REQUEST_V1",
      parameters: {
        material_id: requestAttrs.material_id,
        service_item_name: requestAttrs.service_item_name,
        requested_qty: requestAttrs.requested_qty,
        unit_of_measure: requestAttrs.unit_of_measure,
        supplier_agent_id: requestAttrs.supplier_agent_id,
        payment_terms_code: requestAttrs.payment_terms_code,
        incoterm_code: requestAttrs.incoterm_code,
        approval_required: requestAttrs.approval_required
      }
    }
  };
}

async function buildRecommendationContext(client, tenantId, body = {}) {
  const material = await resolveMaterialByInput(client, tenantId, body);
  const supplier = await resolveSupplierByInput(client, tenantId, body);
  const stockProfile = buildStockProfileFromRequest(body, material);
  const [links, conditions] = await Promise.all([
    material?.id ? listSupplierLinks(client, tenantId, { material_id: material.id }) : Promise.resolve([]),
    listProcurementConditions(client, tenantId)
  ]);
  const recommendation = material
    ? selectProcurementModel({
        material,
        stock_profile: stockProfile,
        supplier_links: links,
        conditions,
        requested_qty: stockProfile.requested_qty
      })
    : {
        procurement_model: "request_for_quote",
        selection_reason: "service_or_manual_item_requires_supplier_review",
        requested_qty: stockProfile.requested_qty,
        candidate_suppliers: [],
        approval_required: true,
        currency: normalizeCurrency(body.currency, "EUR"),
        payment_terms_code: normalizeCode(body.payment_terms_code, "NET_30"),
        payment_due_days: 30,
        estimated_landed_cost: finiteNumber(body.estimated_unit_cost, 0) * stockProfile.requested_qty,
        risk_flags: ["service_item_manual_review"],
        policy_condition_codes: []
      };

  if (supplier && !recommendation.candidate_suppliers?.some((candidate) => candidate.supplier_agent_id === supplier.id)) {
    recommendation.candidate_suppliers = [
      {
        supplier_agent_id: supplier.id,
        supplier_name: supplier.name || supplier.code,
        supplier_role: "manual",
        accreditation_status: "manual",
        estimated_landed_cost: recommendation.estimated_landed_cost || 0,
        currency: recommendation.currency,
        payment_terms_code: recommendation.payment_terms_code,
        supplier_risk_level: "medium",
        score: 0
      },
      ...(recommendation.candidate_suppliers || [])
    ];
    recommendation.recommended_supplier_agent_id = recommendation.recommended_supplier_agent_id || supplier.id;
  }

  return { material, supplier, stockProfile, links, conditions, recommendation };
}

async function ensureRequestProcess(client, app, input) {
  if (!app.coreProcess?.findActiveInstance || !app.coreProcess?.createInstance) {
    return { ok: true, skipped: true };
  }
  return ensureProcessInstance(client, app, input);
}

export async function listProcurementRequests(app, session, query = {}) {
  rejectTenantQuery(query);
  const governance = await loadDropdownCodeSets(app, session.tenant_id, ["PROCUREMENT_REQUEST_STATUS"]);
  const params = [session.tenant_id, REQUEST_OBJECT_TYPE];
  const filters = ["tenant_id=$1", "object_type=$2"];
  const q = normalizeOptionalText(query.q, 200);
  const status = normalizeOptionalText(query.status, 80);
  if (status) {
    params.push(toStoredStatus(status, "DRAFT", governance));
    filters.push(`status=$${params.length}`);
  } else if (query.include_archived !== "true" && query.include_archived !== true) {
    filters.push("status<>'archived'");
  }
  if (q) {
    params.push(`%${q}%`);
    filters.push(`(code ILIKE $${params.length} OR title ILIKE $${params.length} OR attrs->'procurement_management_v1'->>'material_name' ILIKE $${params.length} OR attrs->'procurement_management_v1'->>'service_item_name' ILIKE $${params.length})`);
  }
  params.push(clampLimit(query.limit), Math.max(0, Number(query.offset || 0)));
  const result = await app.db.query(
    `
    SELECT id, code, title, status, object_type, attrs, owner_agent_id, created_at, updated_at
    FROM eip_core.service_object
    WHERE ${filters.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );
  return {
    ok: true,
    items: (result.rows || []).map(mapRequestRow),
    limit: params.at(-2),
    offset: params.at(-1)
  };
}

export async function createProcurementRequest(app, session, body = {}) {
  rejectUnknownKeys(body, CREATE_FIELDS, "procurement_request");
  return withTransaction(app, async (client) => {
    const governance = await loadDropdownCodeSets(client, session.tenant_id, ["PROCUREMENT_REQUEST_STATUS"]);
    const context = await buildRecommendationContext(client, session.tenant_id, body);
    const attrs = buildRequestAttrs(body, null, context);
    const ownerAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
    const title = normalizeOptionalText(body.title, 300)
      || attrs.procurement_management_v1.material_name
      || attrs.procurement_management_v1.service_item_name
      || "Procurement request";
    const item = await client.query(
      `
      INSERT INTO eip_core.service_object
        (tenant_id, object_type, status, code, title, attrs, owner_agent_id)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
      RETURNING id, code, title, status, object_type, attrs, owner_agent_id, created_at, updated_at
      `,
      [
        session.tenant_id,
        REQUEST_OBJECT_TYPE,
        toStoredStatus(body.status || "DRAFT", "DRAFT", governance),
        normalizeOptionalText(body.code, 120) || buildCode("REQ"),
        title,
        JSON.stringify(attrs),
        ownerAgentId
      ]
    );
    const row = item.rows[0];
    if (context.material?.id) {
      await linkObject(client, session.tenant_id, "service_object", row.id, "material", context.material.id, "PROCUREMENT_REQUEST_FOR", { module: "procurement" });
    }
    if (context.supplier?.id) {
      await linkObject(client, session.tenant_id, "service_object", row.id, "agent", context.supplier.id, "SELECTED_SUPPLIER", { module: "procurement" });
    }
    const process = await ensureRequestProcess(client, app, {
      tenantId: session.tenant_id,
      identityId: session.identity_id,
      serviceObjectId: row.id,
      objectType: REQUEST_OBJECT_TYPE
    });
    if (!process.ok) return { ok: false, status: 409, error: process.error };
    await emitMutation(app, session, "procurement.request_created", { request_id: row.id, status: toApiStatus(row.status) });
    return { ok: true, item: mapRequestRow(row), process_linked: process.skipped !== true };
  });
}

export async function getProcurementRequest(app, session, requestId) {
  const row = await fetchServiceObject(app.db, session.tenant_id, requestId, REQUEST_OBJECT_TYPE);
  if (!row) return null;
  const [summary, supplierOptions] = await Promise.all([
    getProcurementRequestSummary(app, session, requestId),
    listProcurementSupplierOptions(app, session, requestId, {})
  ]);
  return {
    ok: true,
    item: mapRequestRow(row),
    summary: summary.summary,
    recommendation: summary.recommendation,
    commercial_terms: summary.commercial_terms,
    approval: summary.approval,
    documents: summary.documents,
    activity: summary.activity,
    policy_summary: summary.policy_summary,
    supplier_options: supplierOptions.items
  };
}

export async function updateProcurementRequest(app, session, requestId, body = {}) {
  rejectUnknownKeys(body, UPDATE_FIELDS, "procurement_request");
  return withTransaction(app, async (client) => {
    const current = await fetchServiceObject(client, session.tenant_id, requestId, REQUEST_OBJECT_TYPE);
    if (!current) return { ok: false, status: 404, error: "NOT_FOUND" };
    const governance = await loadDropdownCodeSets(client, session.tenant_id, ["PROCUREMENT_REQUEST_STATUS"]);
    const mergedBody = {
      ...current.attrs?.procurement_management_v1,
      ...body,
      material_id: body.material_id || current.attrs?.procurement_management_v1?.material_id,
      material_code: body.material_code || current.attrs?.procurement_management_v1?.material_code
    };
    const context = await buildRecommendationContext(client, session.tenant_id, mergedBody);
    const attrs = buildRequestAttrs(body, current, context);
    const nextStatus = body.status === undefined ? current.status : toStoredStatus(body.status, toApiStatus(current.status), governance);
    const title = normalizeOptionalText(body.title, 300) || current.title;
    const update = await client.query(
      `
      UPDATE eip_core.service_object
      SET title=$3,
          status=$4,
          attrs=$5::jsonb,
          updated_at=now()
      WHERE tenant_id=$1
        AND id=$2
        AND object_type=$6
      RETURNING id, code, title, status, object_type, attrs, owner_agent_id, created_at, updated_at
      `,
      [session.tenant_id, requestId, title, nextStatus, JSON.stringify(attrs), REQUEST_OBJECT_TYPE]
    );
    if (!update.rowCount) return { ok: false, status: 404, error: "NOT_FOUND" };
    if (nextStatus !== current.status) {
      await client.query(
        `
        INSERT INTO eip_core.service_object_status_event
          (tenant_id, service_object_id, from_status, to_status, reason_code, note, actor_agent_id, attrs)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
        `,
        [
          session.tenant_id,
          requestId,
          current.status,
          nextStatus,
          "PROCUREMENT_REQUEST_UPDATE",
          normalizeOptionalText(body.notes, 500),
          await getPrimaryAgentId(client, session.tenant_id, session.identity_id),
          JSON.stringify({ module: "procurement", source: "procurement_management_v1" })
        ]
      );
    }
    if (context.material?.id) {
      await linkObject(client, session.tenant_id, "service_object", requestId, "material", context.material.id, "PROCUREMENT_REQUEST_FOR", { module: "procurement" });
    }
    if (context.supplier?.id) {
      await linkObject(client, session.tenant_id, "service_object", requestId, "agent", context.supplier.id, "SELECTED_SUPPLIER", { module: "procurement" });
    }
    await emitMutation(app, session, "procurement.request_updated", { request_id: requestId, status: toApiStatus(nextStatus) });
    return { ok: true, item: mapRequestRow(update.rows[0]) };
  });
}

async function closeApprovalTasks(client, tenantId, requestId, toStatus) {
  const taskStatus = toStatus === "approved" ? "done" : toStatus === "rejected" ? "cancelled" : null;
  if (!taskStatus) return;
  await client.query(
    `
    UPDATE eip_core.task
    SET status=$3,
        completed_at=COALESCE(completed_at, now()),
        updated_at=now()
    WHERE tenant_id=$1
      AND service_object_id=$2
      AND task_type='PROCUREMENT_REQUEST_APPROVAL'
      AND status IN ('open','assigned','in_progress','pending','review')
    `,
    [tenantId, requestId, taskStatus]
  );
}

export async function transitionProcurementRequest(app, session, requestId, action, body = {}) {
  rejectUnknownKeys(body, new Set(["note", "reason_code", "idempotency_key"]), "procurement_request_action");
  const actionMap = {
    submit: { permissionAction: "submit", fallbackStatus: "pending_approval", event: "procurement.request_submitted" },
    approve: { permissionAction: "approve", fallbackStatus: "approved", event: "procurement.request_approved" },
    reject: { permissionAction: "reject", fallbackStatus: "rejected", event: "procurement.request_rejected" }
  };
  const config = actionMap[action];
  if (!config) throw new ProcurementInputError("INVALID_PROCUREMENT_ACTION");

  return withTransaction(app, async (client) => {
    const current = await fetchServiceObject(client, session.tenant_id, requestId, REQUEST_OBJECT_TYPE);
    if (!current) return { ok: false, status: 404, error: "NOT_FOUND" };
    const process = await ensureRequestProcess(client, app, {
      tenantId: session.tenant_id,
      identityId: session.identity_id,
      serviceObjectId: requestId,
      objectType: REQUEST_OBJECT_TYPE
    });
    if (!process.ok) return { ok: false, status: 409, error: process.error };

    let result = null;
    if (app.coreProcess?.advanceInstance) {
      result = await advanceObject(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        id: requestId,
        objectType: REQUEST_OBJECT_TYPE,
        action,
        payload: body || {},
        idempotencyKey: body.idempotency_key
      });
      if (!result.ok) return result;
    } else {
      await client.query(
        `
        UPDATE eip_core.service_object
        SET status=$3, updated_at=now()
        WHERE tenant_id=$1 AND id=$2 AND object_type=$4
        `,
        [session.tenant_id, requestId, config.fallbackStatus, REQUEST_OBJECT_TYPE]
      );
      result = { ok: true };
    }
    await closeApprovalTasks(client, session.tenant_id, requestId, config.fallbackStatus);
    const row = await fetchServiceObject(client, session.tenant_id, requestId, REQUEST_OBJECT_TYPE);
    await emitMutation(app, session, config.event, { request_id: requestId, status: toApiStatus(row.status) });
    return { ok: true, item: mapRequestRow(row), reused: result.reused === true };
  });
}

async function querySupplierAgents(client, tenantId, query = {}, selectedSupplierId = null) {
  const q = normalizeOptionalText(query.q, 200);
  const params = [tenantId];
  const filters = [
    "tenant_id=$1",
    "is_active=true",
    "(attrs->'roles' ? 'SUPPLIER' OR attrs->'roles' ? 'supplier' OR UPPER(agent_type)='SUPPLIER')"
  ];
  if (q) {
    params.push(`%${q}%`);
    filters.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
  }
  if (selectedSupplierId) {
    params.push(selectedSupplierId);
    filters[2] = `(${filters[2]} OR id=$${params.length})`;
  }
  params.push(clampLimit(query.limit || 50));
  const result = await client.query(
    `
    SELECT id, code, name, agent_type, attrs, is_active
    FROM eip_core.agent
    WHERE ${filters.join(" AND ")}
    ORDER BY name NULLS LAST, code NULLS LAST
    LIMIT $${params.length}
    `,
    params
  );
  return result.rows || [];
}

export async function listProcurementSupplierOptions(app, session, requestId, query = {}) {
  rejectTenantQuery(query);
  const request = await fetchServiceObject(app.db, session.tenant_id, requestId, REQUEST_OBJECT_TYPE);
  if (!request) return { ok: false, status: 404, error: "NOT_FOUND" };
  const mapped = mapRequestRow(request);
  const [links, agents] = await Promise.all([
    mapped.material_id ? listSupplierLinks(app.db, session.tenant_id, { material_id: mapped.material_id }) : Promise.resolve([]),
    querySupplierAgents(app.db, session.tenant_id, query, mapped.supplier_agent_id)
  ]);
  const linkedIds = new Set(links.map((link) => link.supplier_agent_id).filter(Boolean));
  const linkCandidates = buildSupplierCandidates(links, {
    requested_qty: mapped.requested_qty,
    currency: mapped.currency
  });
  const manualAgents = agents
    .filter((agent) => !linkedIds.has(agent.id))
    .map((agent) => ({
      supplier_agent_id: agent.id,
      supplier_code: agent.code,
      supplier_name: agent.name,
      supplier_role: "manual",
      accreditation_status: "manual",
      relationship_source: "entity_role",
      estimated_landed_cost: 0,
      currency: mapped.currency,
      warnings: ["no_material_supplier_link"]
    }));
  return {
    ok: true,
    items: [
      ...linkCandidates.map((candidate) => ({
        ...candidate,
        relationship_source: "material_supplier_link"
      })),
      ...manualAgents
    ],
    summary: {
      material_id: mapped.material_id,
      linked_supplier_count: linkCandidates.length,
      manual_supplier_count: manualAgents.length,
      selected_supplier_agent_id: mapped.supplier_agent_id
    }
  };
}

async function listRequestDocuments(app, tenantId, requestId) {
  const result = await app.db.query(
    `
    SELECT info.id, info.record_type, info.title, info.description, info.mime_type, info.file_size,
           info.created_at, info.updated_at, link.relation_type, link.attrs
    FROM eip_core.object_link link
    JOIN eip_core.info_record info
      ON info.tenant_id=link.tenant_id
     AND info.id=link.dst_id
     AND info.is_active=true
    WHERE link.tenant_id=$1
      AND link.src_kind='service_object'
      AND link.src_id=$2
      AND link.dst_kind='info_record'
      AND link.is_active=true
      AND link.relation_type IN ('QUOTE','RFQ_QUOTE','SUPPLIER_DOCUMENT','CONTRACT_REFERENCE','PURCHASE_NOTE','ATTACHMENT','DECISION')
    ORDER BY info.created_at DESC
    LIMIT 100
    `,
    [tenantId, requestId]
  );
  return (result.rows || []).map((row) => ({
    id: row.id,
    record_type: row.record_type,
    title: row.title,
    description: row.description ? row.description.slice(0, 240) : null,
    mime_type: row.mime_type,
    file_size: row.file_size,
    relation_type: row.relation_type,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

async function getRequestActivity(app, tenantId, requestId) {
  const [events, tasks] = await Promise.all([
    app.db.query(
      `
      SELECT from_status, to_status, reason_code, note, occurred_at, created_at
      FROM eip_core.service_object_status_event
      WHERE tenant_id=$1 AND service_object_id=$2
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT 50
      `,
      [tenantId, requestId]
    ),
    app.db.query(
      `
      SELECT id, task_type, status, title, due_at, completed_at, created_at, updated_at
      FROM eip_core.task
      WHERE tenant_id=$1 AND service_object_id=$2
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [tenantId, requestId]
    )
  ]);
  return {
    status_events: events.rows || [],
    tasks: tasks.rows || [],
    summary: {
      tasks: tasks.rows?.length || 0,
      open_tasks: (tasks.rows || []).filter((task) => !["done", "closed", "cancelled", "completed"].includes(String(task.status || "").toLowerCase())).length,
      events: events.rows?.length || 0
    }
  };
}

async function listCommercialTermConditions(app, tenantId) {
  const result = await app.db.query(
    `
    SELECT id, code, label, condition_type, condition_category, priority, scope, effect, attrs, updated_at
    FROM eip_core.commercial_condition
    WHERE tenant_id=$1
      AND is_active=true
      AND (valid_from IS NULL OR valid_from <= now())
      AND (valid_to IS NULL OR valid_to > now())
      AND (
        UPPER(COALESCE(condition_category,'')) IN ('COMMERCIAL','LOGISTICS','INCOTERMS','APPROVAL_FRAMEWORK')
        OR UPPER(COALESCE(condition_type,'')) = ANY($2::text[])
      )
    ORDER BY priority ASC, updated_at DESC NULLS LAST
    LIMIT 200
    `,
    [tenantId, [...COMMERCIAL_CONDITION_TYPES, ...APPROVAL_CONDITION_TYPES]]
  );
  return result.rows || [];
}

function buildCommercialTermsSummary(request, conditions = []) {
  const mapped = mapRequestRow(request);
  const summaries = conditions.map(safeConditionSummary);
  const commercial = summaries.filter((item) => item.policy_domain === "COMMERCIAL" || item.policy_domain === "LOGISTICS");
  const approval = summaries.filter((item) => item.policy_domain === "APPROVAL_FRAMEWORK");
  const selectedPayment = mapped.payment_terms_code
    || commercial.find((item) => item.payment_terms_code)?.payment_terms_code
    || null;
  const selectedIncoterm = mapped.incoterm_code
    || commercial.find((item) => item.incoterm_code)?.incoterm_code
    || null;
  return {
    commercial_terms: {
      payment_terms_code: selectedPayment,
      incoterm_code: selectedIncoterm,
      trade_credit: commercial.some((item) => item.condition_type === "TRADE_CREDIT_CONDITION" || item.payment_due_days > 0),
      conditions: commercial
    },
    approval: {
      required: mapped.approval_required === true,
      status: mapped.status,
      conditions: approval,
      pending: mapped.status === "PENDING_APPROVAL"
    }
  };
}

export async function getProcurementRecommendation(app, session, query = {}) {
  rejectTenantQuery(query);
  if (query.request_id) {
    const request = await fetchServiceObject(app.db, session.tenant_id, query.request_id, REQUEST_OBJECT_TYPE);
    if (!request) return { ok: false, status: 404, error: "NOT_FOUND" };
    return { ok: true, recommendation: mapRequestRow(request).recommendation };
  }
  const context = await buildRecommendationContext(app.db, session.tenant_id, {
    ...query,
    requested_qty: query.requested_qty || query.quantity || 1
  });
  const attrs = buildRequestAttrs({
    ...query,
    requested_qty: query.requested_qty || query.quantity || 1
  }, null, context);
  return {
    ok: true,
    recommendation: attrs.recommendation
  };
}

export async function getProcurementEffectivePolicy(app, session, query = {}) {
  try {
    const context = normalizeEffectivePolicyQuery({
      policy_domain: query.policy_domain || "COMMERCIAL",
      process_type: query.process_type || "PROCUREMENT",
      ...query
    });
    return resolveEffectivePolicy(app, session, context);
  } catch (error) {
    if (error instanceof EffectivePolicyInputError) throw error;
    throw error;
  }
}

async function resolvePolicyDomain(app, session, domain, mapped) {
  try {
    return await resolveEffectivePolicy(app, session, normalizeEffectivePolicyQuery({
      policy_domain: domain,
      process_type: "PROCUREMENT",
      material_id: mapped.material_id || undefined,
      supplier_agent_id: mapped.supplier_agent_id || undefined,
      amount: mapped.estimated_landed_cost || undefined,
      currency: mapped.currency || undefined
    }));
  } catch (error) {
    if (error instanceof EffectivePolicyInputError) {
      return { ok: false, resolution_status: "invalid_context", details: error.details };
    }
    throw error;
  }
}

async function buildPolicySummary(app, session, request) {
  const mapped = mapRequestRow(request);
  const domains = ["COMMERCIAL", "APPROVAL_FRAMEWORK", "INVENTORY", "LOGISTICS", "FISCAL_TAX_TREATMENT"];
  const resolved = await Promise.all(domains.map((domain) => resolvePolicyDomain(app, session, domain, mapped)));
  const byDomain = {};
  domains.forEach((domain, index) => {
    const item = resolved[index];
    byDomain[domain] = {
      resolution_status: item.resolution_status || "unavailable",
      selected_condition: item.selected_condition || null,
      warnings: item.warnings || [],
      conflicts: item.conflicts || [],
      explanation: item.explanation || []
    };
  });
  return {
    domains: byDomain,
    explanation: {
      commercial_terms: byDomain.COMMERCIAL.explanation,
      approval_framework: byDomain.APPROVAL_FRAMEWORK.explanation,
      inventory_context: byDomain.INVENTORY.explanation,
      logistics_incoterms: byDomain.LOGISTICS.explanation,
      fiscal_tax_treatment: byDomain.FISCAL_TAX_TREATMENT.explanation
    }
  };
}

export async function getProcurementRequestSummary(app, session, requestId) {
  const request = await fetchServiceObject(app.db, session.tenant_id, requestId, REQUEST_OBJECT_TYPE);
  if (!request) return { ok: false, status: 404, error: "NOT_FOUND" };
  const [supplierOptions, documents, activity, conditions, policySummary] = await Promise.all([
    listProcurementSupplierOptions(app, session, requestId, {}),
    listRequestDocuments(app, session.tenant_id, requestId),
    getRequestActivity(app, session.tenant_id, requestId),
    listCommercialTermConditions(app, session.tenant_id),
    buildPolicySummary(app, session, request)
  ]);
  const mapped = mapRequestRow(request);
  const terms = buildCommercialTermsSummary(request, conditions);
  const nextAction = (() => {
    if (mapped.status === "DRAFT" || mapped.status === "NEEDS_REVIEW") return { code: "submit", label: "Submit for approval", safe: true };
    if (mapped.status === "PENDING_APPROVAL") return { code: "approve_or_reject", label: "Approve or reject", safe: true };
    if (mapped.status === "APPROVED") return { code: "prepare_next", label: "Prepare next procurement action", safe: true };
    return { code: "none", label: "No active procurement action", safe: false };
  })();
  return {
    ok: true,
    item: mapped,
    summary: {
      supplier_material_relationship: supplierOptions.summary,
      next_action: nextAction,
      status: mapped.status,
      no_hard_delete: true
    },
    recommendation: mapped.recommendation,
    commercial_terms: terms.commercial_terms,
    approval: terms.approval,
    documents,
    activity,
    policy_summary: policySummary
  };
}

export async function getProcurementGovernanceOptions(app, session) {
  const [optionsResult, workspace] = await Promise.all([
    app.db.query(
      `
      WITH lists AS (
        SELECT DISTINCT ON (code) id, code
        FROM eip_core.dropdown_list
        WHERE is_active=true
          AND (tenant_id=$1 OR tenant_id IS NULL)
          AND code = ANY($2::text[])
        ORDER BY code, (tenant_id IS NOT NULL) DESC, version DESC
      )
      SELECT lists.code AS list_code, value.code, value.label, value.sort_order
      FROM lists
      JOIN eip_core.dropdown_value value
        ON value.list_id=lists.id
       AND value.is_active=true
      ORDER BY lists.code, value.sort_order, value.label
      `,
      [session.tenant_id, REQUEST_DROPDOWN_LISTS]
    ),
    loadModuleWorkspace(app, session.tenant_id, "procurement")
  ]);
  const options = {};
  for (const row of optionsResult.rows || []) {
    options[row.list_code] = options[row.list_code] || [];
    options[row.list_code].push({ code: row.code, label: row.label || displayLabel(row.code) });
  }
  if (!options.PROCUREMENT_REQUEST_STATUS?.length) {
    options.PROCUREMENT_REQUEST_STATUS = PROCUREMENT_REQUEST_STATUSES.map((code) => ({ code, label: displayLabel(code) }));
  }
  return {
    ok: true,
    options,
    defaults: {
      statuses: PROCUREMENT_REQUEST_STATUSES,
      item_types: ["MATERIAL", "SERVICE"],
      priorities: ["LOW", "NORMAL", "HIGH", "URGENT"]
    },
    workspace
  };
}

