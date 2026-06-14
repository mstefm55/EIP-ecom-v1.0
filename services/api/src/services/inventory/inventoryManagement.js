import { emitSecurityEvent } from "../../lib/securityAudit.js";
import { allowedCodesFrom, loadDropdownCodeSets, loadModuleWorkspace } from "../moduleWorkspace.js";
import {
  buildReorderSuggestionPayload,
  normalizeInventoryProfile,
  resolveInventoryPolicy
} from "./inventoryFoundation.js";
import {
  EffectivePolicyInputError,
  normalizeEffectivePolicyQuery,
  resolveEffectivePolicy
} from "../policiesConditions/effectivePolicy.js";

export const INVENTORY_MANAGEMENT_PERMISSIONS = Object.freeze({
  read: "inventory.read",
  materialCreate: "inventory.material.create",
  materialUpdate: "inventory.material.update",
  lotCreate: "inventory.lot.create",
  lotUpdate: "inventory.lot.update",
  recommendationRead: "inventory.recommendation.read",
  policyRead: "inventory.policy.read"
});

export const MATERIAL_TYPES = Object.freeze([
  "RAW_MATERIAL",
  "FINISHED_GOOD",
  "SEMI_FINISHED",
  "CONSUMABLE",
  "PACKAGING",
  "SERVICE_ITEM",
  "OTHER"
]);

export const MATERIAL_STATUSES = Object.freeze([
  "ACTIVE",
  "INACTIVE",
  "UNDER_REVIEW",
  "BLOCKED",
  "ARCHIVED"
]);

export const LOT_STATUSES = Object.freeze([
  "AVAILABLE",
  "RESERVED",
  "BLOCKED",
  "QUARANTINE",
  "CONSUMED",
  "EXPIRED",
  "ARCHIVED"
]);

export const INVENTORY_DROPDOWN_CODES = Object.freeze([
  "MATERIAL_TYPE",
  "INVENTORY_MATERIAL_TYPE",
  "INVENTORY_MATERIAL_STATUS",
  "MATERIAL_LOT_STATUS",
  "INVENTORY_LOT_STATUS",
  "INVENTORY_STOCK_STATUS",
  "INVENTORY_RISK_STATUS",
  "INVENTORY_ABC_CLASS",
  "INVENTORY_SUPPLIER_RISK_LEVEL"
]);

const MAX_LIMIT = 200;
const MATERIAL_KIND = "material";
const LOT_KIND = "material_lot";
const INFO_KIND = "info_record";
const AGENT_KIND = "agent";
const INVENTORY_POLICY_CONTEXT = Object.freeze({
  policy_domain: "INVENTORY",
  condition_type: "REORDER_POLICY"
});

const MATERIAL_MUTATION_KEYS = new Set([
  "code",
  "name",
  "label",
  "material_type",
  "status",
  "unit_of_measure",
  "uom",
  "category",
  "family",
  "default_supplier_entity_id",
  "preferred_supplier_agent_id",
  "supplier_agent_id",
  "notes",
  "attrs",
  "track_stock",
  "track_inventory",
  "reorder_point",
  "reorder_qty",
  "minimum_stock",
  "maximum_stock",
  "safety_stock",
  "lead_time_days",
  "daily_consumption_rate",
  "unit_cost"
]);

const LOT_MUTATION_KEYS = new Set([
  "lot_code",
  "code",
  "quantity",
  "qty",
  "unit",
  "uom",
  "unit_of_measure",
  "status",
  "received_date",
  "received_at",
  "expiry_date",
  "expires_at",
  "location_ref",
  "storage_ref",
  "supplier_agent_id",
  "supplier_entity_id",
  "reason_code",
  "note",
  "notes",
  "attrs"
]);

const SENSITIVE_KEY_RE = /(password|secret|token|credential|authorization|cookie|signature|csrf|sid|api[_-]?key|private[_-]?key|raw[_-]?legal|legal[_-]?text|compliance[_-]?text|account_number|iban)/i;
const TENANT_OVERRIDE_RE = /^(tenant_id|tenantId)$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^[A-Z0-9][A-Z0-9_.:-]{0,79}$/;

export class InventoryInputError extends Error {
  constructor(code, details = null) {
    super(code);
    this.name = "InventoryInputError";
    this.code = code;
    this.details = details;
  }
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeOptionalText(value, maxLength = 500) {
  const text = normalizeText(value);
  if (!text) return null;
  if (text.length > maxLength) throw new InventoryInputError("TEXT_TOO_LONG", { maxLength });
  return text;
}

function normalizeCode(value, fallback = null) {
  const text = normalizeOptionalText(value, 80);
  if (!text) return fallback;
  const code = text.toUpperCase().replace(/\s+/g, "_");
  if (!CODE_RE.test(code)) throw new InventoryInputError("INVALID_CODE", { code });
  return code;
}

function normalizeFlexibleCode(value, fallback = "OTHER") {
  return normalizeCode(value, fallback);
}

function normalizeUuid(value, field) {
  const text = normalizeOptionalText(value, 64);
  if (!text) return null;
  if (!UUID_RE.test(text)) throw new InventoryInputError("INVALID_UUID", { field });
  return text.toLowerCase();
}

function clampLimit(value) {
  const parsed = Number(value || 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function normalizeOffset(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function finiteNumber(value, field, { required = false, min = 0 } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new InventoryInputError("NUMBER_REQUIRED", { field });
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) throw new InventoryInputError("INVALID_NUMBER", { field });
  return Number(parsed.toFixed(6));
}

function normalizeDate(value, field) {
  const text = normalizeOptionalText(value, 40);
  if (!text) return null;
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) throw new InventoryInputError("INVALID_DATE", { field });
  return text.length <= 10 ? text : parsed.toISOString();
}

function normalizeStatus(value, allowed, fallback, errorCode, governance = null, listCodes = []) {
  const status = normalizeCode(value, fallback);
  const governedAllowed = listCodes.length ? allowedCodesFrom(governance, listCodes, allowed) : allowed;
  if (!governedAllowed.includes(status)) throw new InventoryInputError(errorCode);
  return status;
}

function normalizeMaterialType(value, fallback = "OTHER", governance = null) {
  const materialType = normalizeFlexibleCode(value, fallback);
  const allowed = allowedCodesFrom(governance, ["INVENTORY_MATERIAL_TYPE", "MATERIAL_TYPE"], MATERIAL_TYPES);
  if (!allowed.includes(materialType)) throw new InventoryInputError("INVALID_MATERIAL_TYPE", { material_type: materialType });
  return materialType;
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function rejectUnknownKeys(body, allowed, label) {
  for (const key of Object.keys(body || {})) {
    if (TENANT_OVERRIDE_RE.test(key)) throw new InventoryInputError("TENANT_OVERRIDE_NOT_ALLOWED");
    if (!allowed.has(key)) throw new InventoryInputError("UNKNOWN_FIELD", { label, field: key });
  }
}

function rejectSensitiveAttrs(value, path = "attrs") {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectSensitiveAttrs(item, `${path}.${index}`));
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (TENANT_OVERRIDE_RE.test(key)) throw new InventoryInputError("TENANT_OVERRIDE_NOT_ALLOWED", { path });
    if (SENSITIVE_KEY_RE.test(key)) throw new InventoryInputError("SENSITIVE_FIELD_NOT_ALLOWED", { path, field: key });
    rejectSensitiveAttrs(item, `${path}.${key}`);
  }
}

function normalizeAttrs(value) {
  if (value === null || value === undefined) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new InventoryInputError("ATTRS_MUST_BE_OBJECT");
  rejectSensitiveAttrs(value);
  return value;
}

function materialStatus(row = {}, governance = null) {
  const attrs = safeObject(row.attrs);
  const status = attrs.inventory_management_v1?.status || attrs.status || (row.is_active === false ? "INACTIVE" : "ACTIVE");
  return normalizeStatus(status, MATERIAL_STATUSES, "ACTIVE", "INVALID_MATERIAL_STATUS", governance, ["INVENTORY_MATERIAL_STATUS"]);
}

function lifecycleIsActive(status) {
  return !["INACTIVE", "ARCHIVED"].includes(status);
}

function lotDisplayStatus(row = {}, governance = null) {
  return normalizeStatus(row.status, LOT_STATUSES, "AVAILABLE", "INVALID_LOT_STATUS", governance, ["INVENTORY_LOT_STATUS", "MATERIAL_LOT_STATUS"]);
}

function displayLabel(...values) {
  return values.map((value) => normalizeOptionalText(value, 240)).filter(Boolean).join(" - ") || null;
}

function stockStatusFromLots(summary) {
  if (!summary || summary.has_lots !== true) return null;
  if (summary.stock_on_hand < 0) return "negative_stock";
  if (summary.available_qty <= 0 && summary.stock_on_hand > 0) return "low_stock";
  if (summary.stock_on_hand <= 0) return "out_of_stock";
  return "in_stock";
}

function patchMaterialAttrsWithStock(material, stockSummary) {
  if (!stockSummary?.has_lots) return material;
  const attrs = safeObject(material.attrs);
  const inventory = {
    ...safeObject(attrs.inventory),
    track_stock: true,
    track_inventory: true,
    stock_on_hand: stockSummary.stock_on_hand,
    on_hand: stockSummary.stock_on_hand,
    reserved_qty: stockSummary.reserved_qty,
    available_qty: stockSummary.available_qty,
    unit_of_measure: stockSummary.unit_of_measure || safeObject(attrs.inventory).unit_of_measure || attrs.inventory_management_v1?.unit_of_measure || "pcs"
  };
  return {
    ...material,
    attrs: {
      ...attrs,
      inventory
    }
  };
}

function mapMaterialRow(row, { conditions = [], stockSummary = null, governance = null } = {}) {
  if (!row) return null;
  const attrs = safeObject(row.attrs);
  const management = safeObject(attrs.inventory_management_v1);
  const inventory = safeObject(attrs.inventory);
  const status = materialStatus(row, governance);
  const materialForProfile = patchMaterialAttrsWithStock(row, stockSummary);
  const profile = normalizeInventoryProfile(materialForProfile, { conditions });
  const safeAttrs = safeObject(management.safe_attrs);
  return {
    id: row.id,
    code: row.code || null,
    name: row.name || null,
    label: displayLabel(row.code, row.name) || row.name || row.code || "Material",
    material_type: row.material_type || "OTHER",
    status,
    unit_of_measure: management.unit_of_measure || inventory.unit_of_measure || inventory.uom || profile.unit_of_measure || null,
    category: management.category || attrs.category || attrs.material_category || null,
    family: management.family || attrs.family || attrs.material_family || null,
    default_supplier_entity_id: management.default_supplier_entity_id || inventory.preferred_supplier_agent_id || null,
    supplier: row.supplier_id ? {
      id: row.supplier_id,
      code: row.supplier_code || null,
      display_name: row.supplier_name || null,
      entity_kind: row.supplier_agent_type || null
    } : null,
    notes: management.notes || null,
    safe_attrs: safeAttrs,
    stock_summary: stockSummary || null,
    stock_profile: profile,
    is_active: row.is_active === true,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapLotRow(row, governance = null) {
  if (!row) return null;
  const attrs = safeObject(row.attrs);
  const management = safeObject(attrs.inventory_management_v1);
  return {
    id: row.id,
    material_id: row.material_id,
    material_code: row.material_code || null,
    material_name: row.material_name || null,
    lot_code: row.lot_code || null,
    status: lotDisplayStatus(row, governance),
    quantity: row.quantity === null || row.quantity === undefined ? null : Number(row.quantity),
    unit: row.uom || management.unit || null,
    unit_of_measure: row.uom || management.unit || null,
    received_date: management.received_date || null,
    expiry_date: management.expiry_date || null,
    location_ref: management.location_ref || management.storage_ref || null,
    supplier_agent_id: management.supplier_agent_id || row.owner_agent_id || null,
    supplier: row.supplier_id ? {
      id: row.supplier_id,
      code: row.supplier_code || null,
      display_name: row.supplier_name || null,
      entity_kind: row.supplier_agent_type || null
    } : null,
    notes: management.notes || null,
    safe_attrs: safeObject(management.safe_attrs),
    is_active: row.is_active === true,
    service_object_id: row.service_object_id || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function stockSummaryFromLots(rows = [], governance = null) {
  const summary = {
    has_lots: rows.length > 0,
    lot_count: rows.length,
    stock_on_hand: 0,
    available_qty: 0,
    reserved_qty: 0,
    blocked_qty: 0,
    quarantine_qty: 0,
    consumed_qty: 0,
    expired_qty: 0,
    archived_qty: 0,
    unit_of_measure: null,
    by_status: {},
    warnings: []
  };

  for (const row of rows) {
    const status = lotDisplayStatus(row, governance);
    const qty = row.quantity === null || row.quantity === undefined ? null : Number(row.quantity);
    const unit = normalizeOptionalText(row.uom, 40);
    if (!summary.unit_of_measure && unit) summary.unit_of_measure = unit;
    summary.by_status[status] = (summary.by_status[status] || 0) + 1;
    if (!Number.isFinite(qty)) {
      summary.warnings.push({ code: "LOT_QUANTITY_MISSING", lot_id: row.id });
      continue;
    }
    if (["AVAILABLE", "RESERVED", "BLOCKED", "QUARANTINE"].includes(status)) summary.stock_on_hand += qty;
    if (status === "AVAILABLE") summary.available_qty += qty;
    if (status === "RESERVED") summary.reserved_qty += qty;
    if (status === "BLOCKED") summary.blocked_qty += qty;
    if (status === "QUARANTINE") summary.quarantine_qty += qty;
    if (status === "CONSUMED") summary.consumed_qty += qty;
    if (status === "EXPIRED") summary.expired_qty += qty;
    if (status === "ARCHIVED") summary.archived_qty += qty;
  }

  summary.stock_status = stockStatusFromLots(summary);
  for (const key of ["stock_on_hand", "available_qty", "reserved_qty", "blocked_qty", "quarantine_qty", "consumed_qty", "expired_qty", "archived_qty"]) {
    summary[key] = Number(summary[key].toFixed(6));
  }
  return summary;
}

function normalizeMaterialInput(body = {}, current = null, governance = null) {
  rejectUnknownKeys(body, MATERIAL_MUTATION_KEYS, "material");
  const partial = Boolean(current);
  const currentAttrs = safeObject(current?.attrs);
  const currentManagement = safeObject(currentAttrs.inventory_management_v1);
  const currentInventory = safeObject(currentAttrs.inventory);

  const code = hasOwn(body, "code") ? normalizeCode(body.code, null) : current?.code || null;
  const rawName = hasOwn(body, "name") ? body.name : hasOwn(body, "label") ? body.label : current?.name;
  const name = normalizeOptionalText(rawName, 240);
  if (!partial && !name) throw new InventoryInputError("MATERIAL_NAME_REQUIRED");

  const materialType = hasOwn(body, "material_type")
    ? normalizeMaterialType(body.material_type, "OTHER", governance)
    : current?.material_type || "OTHER";
  const status = hasOwn(body, "status")
    ? normalizeStatus(body.status, MATERIAL_STATUSES, "ACTIVE", "INVALID_MATERIAL_STATUS", governance, ["INVENTORY_MATERIAL_STATUS"])
    : current ? materialStatus(current, governance) : "ACTIVE";
  const unit = hasOwn(body, "unit_of_measure") || hasOwn(body, "uom")
    ? normalizeOptionalText(body.unit_of_measure || body.uom, 40)
    : currentManagement.unit_of_measure || currentInventory.unit_of_measure || currentInventory.uom || null;
  const category = hasOwn(body, "category") ? normalizeOptionalText(body.category, 120) : currentManagement.category || null;
  const family = hasOwn(body, "family") ? normalizeOptionalText(body.family, 120) : currentManagement.family || null;
  const supplierId = hasOwn(body, "default_supplier_entity_id") || hasOwn(body, "preferred_supplier_agent_id") || hasOwn(body, "supplier_agent_id")
    ? normalizeUuid(body.default_supplier_entity_id || body.preferred_supplier_agent_id || body.supplier_agent_id, "supplier_agent_id")
    : currentManagement.default_supplier_entity_id || currentInventory.preferred_supplier_agent_id || null;
  const notes = hasOwn(body, "notes") ? normalizeOptionalText(body.notes, 2000) : currentManagement.notes || null;
  const safeAttrs = hasOwn(body, "attrs")
    ? { ...safeObject(currentManagement.safe_attrs), ...normalizeAttrs(body.attrs) }
    : safeObject(currentManagement.safe_attrs);

  const nextInventory = { ...currentInventory };
  if (unit) nextInventory.unit_of_measure = unit;
  if (supplierId) nextInventory.preferred_supplier_agent_id = supplierId;
  if (hasOwn(body, "track_stock") || hasOwn(body, "track_inventory")) {
    const tracked = body.track_stock ?? body.track_inventory;
    nextInventory.track_stock = tracked === true || tracked === "true";
    nextInventory.track_inventory = nextInventory.track_stock;
  }
  for (const [inputKey, outputKey] of [
    ["reorder_point", "reorder_point"],
    ["reorder_qty", "reorder_qty"],
    ["minimum_stock", "minimum_stock"],
    ["maximum_stock", "maximum_stock"],
    ["safety_stock", "safety_stock"],
    ["lead_time_days", "lead_time_days"],
    ["daily_consumption_rate", "daily_consumption_rate"],
    ["unit_cost", "unit_cost"]
  ]) {
    if (hasOwn(body, inputKey)) nextInventory[outputKey] = finiteNumber(body[inputKey], inputKey, { min: 0 }) ?? 0;
  }

  return {
    code,
    name: name || current?.name || null,
    materialType,
    status,
    supplierId,
    isActive: lifecycleIsActive(status),
    attrs: {
      ...currentAttrs,
      inventory: nextInventory,
      inventory_management_v1: {
        ...currentManagement,
        status,
        unit_of_measure: unit,
        category,
        family,
        default_supplier_entity_id: supplierId,
        notes,
        safe_attrs: safeAttrs
      }
    }
  };
}

function normalizeLotInput(body = {}, current = null, material = null, governance = null) {
  rejectUnknownKeys(body, LOT_MUTATION_KEYS, "lot");
  const partial = Boolean(current);
  const currentAttrs = safeObject(current?.attrs);
  const currentManagement = safeObject(currentAttrs.inventory_management_v1);
  const lotCode = hasOwn(body, "lot_code") || hasOwn(body, "code")
    ? normalizeOptionalText(body.lot_code || body.code, 120)
    : current?.lot_code || null;
  if (!partial && !lotCode) throw new InventoryInputError("LOT_CODE_REQUIRED");

  const quantity = hasOwn(body, "quantity") || hasOwn(body, "qty")
    ? finiteNumber(body.quantity ?? body.qty, "quantity", { required: true, min: 0 })
    : current?.quantity === undefined ? null : current.quantity;
  if (!partial && quantity === null) throw new InventoryInputError("LOT_QUANTITY_REQUIRED");

  const unit = hasOwn(body, "unit") || hasOwn(body, "uom") || hasOwn(body, "unit_of_measure")
    ? normalizeOptionalText(body.unit || body.uom || body.unit_of_measure, 40)
    : current?.uom || material?.attrs?.inventory_management_v1?.unit_of_measure || material?.attrs?.inventory?.unit_of_measure || "pcs";
  const status = hasOwn(body, "status")
    ? normalizeStatus(body.status, LOT_STATUSES, "AVAILABLE", "INVALID_LOT_STATUS", governance, ["INVENTORY_LOT_STATUS", "MATERIAL_LOT_STATUS"])
    : current?.status ? lotDisplayStatus(current, governance) : "AVAILABLE";
  const supplierId = hasOwn(body, "supplier_agent_id") || hasOwn(body, "supplier_entity_id")
    ? normalizeUuid(body.supplier_agent_id || body.supplier_entity_id, "supplier_agent_id")
    : currentManagement.supplier_agent_id || current?.owner_agent_id || null;
  const receivedDate = hasOwn(body, "received_date") || hasOwn(body, "received_at")
    ? normalizeDate(body.received_date || body.received_at, "received_date")
    : currentManagement.received_date || null;
  const expiryDate = hasOwn(body, "expiry_date") || hasOwn(body, "expires_at")
    ? normalizeDate(body.expiry_date || body.expires_at, "expiry_date")
    : currentManagement.expiry_date || null;
  const locationRef = hasOwn(body, "location_ref") || hasOwn(body, "storage_ref")
    ? normalizeOptionalText(body.location_ref || body.storage_ref, 160)
    : currentManagement.location_ref || currentManagement.storage_ref || null;
  const notes = hasOwn(body, "notes") ? normalizeOptionalText(body.notes, 2000) : currentManagement.notes || null;
  const safeAttrs = hasOwn(body, "attrs")
    ? { ...safeObject(currentManagement.safe_attrs), ...normalizeAttrs(body.attrs) }
    : safeObject(currentManagement.safe_attrs);

  return {
    lotCode,
    quantity,
    unit,
    status,
    supplierId,
    attrs: {
      ...currentAttrs,
      inventory_management_v1: {
        ...currentManagement,
        status,
        unit,
        received_date: receivedDate,
        expiry_date: expiryDate,
        location_ref: locationRef,
        storage_ref: locationRef,
        supplier_agent_id: supplierId,
        notes,
        safe_attrs: safeAttrs
      }
    }
  };
}

async function emitMutation(app, session, eventType, metadata = {}) {
  await emitSecurityEvent(app, eventType, {
    category: "inventory",
    source: "inventory.management.v1",
    severity: "info",
    outcome: "success",
    tenantId: session.tenant_id,
    identityId: session.identity_id,
    metadata
  });
}

async function getPrimaryAgentId(db, tenantId, identityId) {
  const result = await db.query(
    `
    SELECT agent_id
    FROM eip_auth.auth_identity_agent
    WHERE tenant_id=$1 AND identity_id=$2 AND is_primary=true AND is_active=true
    LIMIT 1
    `,
    [tenantId, identityId]
  );
  return result.rows[0]?.agent_id || null;
}

async function ensureAgent(db, tenantId, agentId) {
  const id = normalizeUuid(agentId, "agent_id");
  if (!id) return null;
  const result = await db.query(
    `
    SELECT id, agent_type, code, name, attrs, is_active, created_at, updated_at
    FROM eip_core.agent
    WHERE tenant_id=$1 AND id=$2
    LIMIT 1
    `,
    [tenantId, id]
  );
  return result.rows[0] || null;
}

async function ensureMaterial(db, tenantId, materialId, { lock = false } = {}) {
  const id = normalizeUuid(materialId, "material_id");
  const result = await db.query(
    `
    SELECT m.id, m.tenant_id, m.code, m.name, m.material_type, m.attrs, m.is_active, m.created_at, m.updated_at,
           supplier.id AS supplier_id, supplier.code AS supplier_code, supplier.name AS supplier_name,
           supplier.agent_type AS supplier_agent_type
    FROM eip_core.material m
    LEFT JOIN eip_core.agent supplier
      ON supplier.tenant_id=m.tenant_id
     AND supplier.id::text = COALESCE(
       m.attrs->'inventory_management_v1'->>'default_supplier_entity_id',
       m.attrs->'inventory'->>'preferred_supplier_agent_id'
     )
    WHERE m.tenant_id=$1 AND m.id=$2
    ${lock ? "FOR UPDATE OF m" : ""}
    `,
    [tenantId, id]
  );
  return result.rows[0] || null;
}

async function ensureLot(db, tenantId, lotId, { lock = false } = {}) {
  const id = normalizeUuid(lotId, "lot_id");
  const result = await db.query(
    `
    SELECT lot.id, lot.tenant_id, lot.material_id, lot.lot_code, lot.status, lot.quantity, lot.uom,
           lot.service_object_id, lot.owner_agent_id, lot.attrs, lot.is_active, lot.created_at, lot.updated_at,
           material.code AS material_code, material.name AS material_name, material.attrs AS material_attrs,
           supplier.id AS supplier_id, supplier.code AS supplier_code, supplier.name AS supplier_name,
           supplier.agent_type AS supplier_agent_type
    FROM eip_core.material_lot lot
    JOIN eip_core.material material
      ON material.tenant_id=lot.tenant_id AND material.id=lot.material_id
    LEFT JOIN eip_core.agent supplier
      ON supplier.tenant_id=lot.tenant_id
     AND supplier.id::text = COALESCE(lot.attrs->'inventory_management_v1'->>'supplier_agent_id', lot.owner_agent_id::text)
    WHERE lot.tenant_id=$1 AND lot.id=$2
    ${lock ? "FOR UPDATE OF lot" : ""}
    `,
    [tenantId, id]
  );
  return result.rows[0] || null;
}

export async function listInventoryPolicyConditions(app, tenantId) {
  const result = await app.db.query(
    `
    SELECT id, code, label, condition_type, condition_category, priority,
           valid_from, valid_to, scope, effect, attrs, created_at, updated_at
    FROM eip_core.commercial_condition
    WHERE tenant_id=$1
      AND is_active=true
      AND (valid_from IS NULL OR valid_from <= now())
      AND (valid_to IS NULL OR valid_to > now())
      AND (
        UPPER(COALESCE(condition_category,''))='INVENTORY'
        OR UPPER(COALESCE(condition_type,'')) IN (
          'INVENTORY_REORDER_POLICY',
          'REORDER_POLICY',
          'SAFETY_STOCK',
          'REORDER_POINT',
          'STOCK_THRESHOLD',
          'RESERVATION_POLICY',
          'RELEASE_POLICY',
          'STORAGE_POLICY',
          'SUPPLY_REORDER_CONDITION',
          'SUPPLIER_PURCHASE_CONDITION'
        )
      )
    ORDER BY priority ASC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    `,
    [tenantId]
  );
  return result.rows || [];
}

export async function listInventoryMaterials(app, session, query = {}) {
  const tenantId = session.tenant_id;
  const governance = await loadDropdownCodeSets(app, tenantId, [
    "INVENTORY_MATERIAL_TYPE",
    "MATERIAL_TYPE",
    "INVENTORY_MATERIAL_STATUS"
  ]);
  const limit = clampLimit(query.limit);
  const offset = normalizeOffset(query.offset);
  const includeArchived = query.include_archived === true || query.include_archived === "true";
  const params = [tenantId];
  const filters = ["m.tenant_id=$1"];
  const statusSql = "COALESCE(m.attrs->'inventory_management_v1'->>'status', m.attrs->>'status', CASE WHEN m.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END)";

  if (!includeArchived) filters.push(`${statusSql}<>'ARCHIVED'`);
  if (normalizeOptionalText(query.q, 200)) {
    params.push(`%${normalizeText(query.q)}%`);
    filters.push(`(m.code ILIKE $${params.length} OR m.name ILIKE $${params.length} OR m.material_type ILIKE $${params.length})`);
  }
  if (normalizeOptionalText(query.material_type, 80)) {
    params.push(normalizeMaterialType(query.material_type, "OTHER", governance));
    filters.push(`m.material_type=$${params.length}`);
  }
  if (normalizeOptionalText(query.status, 40)) {
    params.push(normalizeStatus(query.status, MATERIAL_STATUSES, "ACTIVE", "INVALID_MATERIAL_STATUS", governance, ["INVENTORY_MATERIAL_STATUS"]));
    filters.push(`${statusSql}=$${params.length}`);
  }

  const countResult = await app.db.query(
    `
    SELECT count(*)::int AS total
    FROM eip_core.material m
    WHERE ${filters.join(" AND ")}
    `,
    params
  );

  params.push(limit, offset);
  const result = await app.db.query(
    `
    SELECT m.id, m.tenant_id, m.code, m.name, m.material_type, m.attrs, m.is_active, m.created_at, m.updated_at,
           supplier.id AS supplier_id, supplier.code AS supplier_code, supplier.name AS supplier_name,
           supplier.agent_type AS supplier_agent_type
    FROM eip_core.material m
    LEFT JOIN eip_core.agent supplier
      ON supplier.tenant_id=m.tenant_id
     AND supplier.id::text = COALESCE(
       m.attrs->'inventory_management_v1'->>'default_supplier_entity_id',
       m.attrs->'inventory'->>'preferred_supplier_agent_id'
     )
    WHERE ${filters.join(" AND ")}
    ORDER BY m.updated_at DESC, m.created_at DESC, m.code ASC NULLS LAST
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );

  const conditions = await listInventoryPolicyConditions(app, tenantId);
  const items = [];
  for (const row of result.rows || []) {
    const stockSummary = await loadMaterialStockSummary(app.db, tenantId, row.id, governance);
    items.push(mapMaterialRow(row, { conditions, stockSummary, governance }));
  }
  return {
    ok: true,
    items,
    total: Number(countResult.rows[0]?.total || 0),
    limit,
    offset
  };
}

export async function createInventoryMaterial(app, session, body = {}) {
  const governance = await loadDropdownCodeSets(app, session.tenant_id, [
    "INVENTORY_MATERIAL_TYPE",
    "MATERIAL_TYPE",
    "INVENTORY_MATERIAL_STATUS"
  ]);
  const input = normalizeMaterialInput(body, null, governance);
  if (input.supplierId && !(await ensureAgent(app.db, session.tenant_id, input.supplierId))) {
    throw new InventoryInputError("SUPPLIER_ENTITY_NOT_FOUND");
  }
  const result = await app.db.query(
    `
    INSERT INTO eip_core.material
      (tenant_id, code, name, material_type, attrs, is_active)
    VALUES ($1,$2,$3,$4,$5::jsonb,$6)
    RETURNING id, tenant_id, code, name, material_type, attrs, is_active, created_at, updated_at
    `,
    [session.tenant_id, input.code, input.name, input.materialType, JSON.stringify(input.attrs), input.isActive]
  );
  const item = result.rows[0];
  if (input.supplierId) await upsertObjectLink(app.db, session.tenant_id, MATERIAL_KIND, item.id, AGENT_KIND, input.supplierId, "DEFAULT_SUPPLIER");
  await emitMutation(app, session, "inventory.material_created", { material_id: item.id, material_type: item.material_type });
  const conditions = await listInventoryPolicyConditions(app, session.tenant_id);
  return { ok: true, item: mapMaterialRow(item, { conditions, governance }) };
}

export async function getInventoryMaterialDetail(app, session, materialId) {
  const row = await ensureMaterial(app.db, session.tenant_id, materialId);
  if (!row) return null;
  const governance = await loadDropdownCodeSets(app, session.tenant_id, [
    "INVENTORY_MATERIAL_STATUS",
    "INVENTORY_LOT_STATUS",
    "MATERIAL_LOT_STATUS"
  ]);
  const [conditions, lots, stockSummary, suppliers, documents, policies, movements] = await Promise.all([
    listInventoryPolicyConditions(app, session.tenant_id),
    listInventoryMaterialLots(app, session, row.id, { limit: 50 }),
    loadMaterialStockSummary(app.db, session.tenant_id, row.id, governance),
    listMaterialEntityLinks(app, session, row.id),
    listInventoryDocuments(app, session, MATERIAL_KIND, row.id),
    getMaterialPolicySummary(app, session, row),
    listInventoryActivity(app, session, row.id, { limit: 20 })
  ]);
  const item = mapMaterialRow(row, { conditions, stockSummary, governance });
  return {
    ok: true,
    item,
    lots: lots.items,
    suppliers: suppliers.items,
    documents: documents.items,
    policy_summary: policies.summary,
    activity_summary: movements.summary,
    movements: movements.movements,
    summary: buildMaterialSummary(item, lots.items, stockSummary, suppliers.items, documents.items, policies.summary)
  };
}

export async function updateInventoryMaterial(app, session, materialId, body = {}) {
  const client = await app.db.connect();
  try {
    await client.query("BEGIN");
    const current = await ensureMaterial(client, session.tenant_id, materialId, { lock: true });
    if (!current) {
      await client.query("ROLLBACK");
      return null;
    }
    const governance = await loadDropdownCodeSets(app, session.tenant_id, [
      "INVENTORY_MATERIAL_TYPE",
      "MATERIAL_TYPE",
      "INVENTORY_MATERIAL_STATUS"
    ]);
    const input = normalizeMaterialInput(body, current, governance);
    if (input.supplierId && !(await ensureAgent(client, session.tenant_id, input.supplierId))) {
      throw new InventoryInputError("SUPPLIER_ENTITY_NOT_FOUND");
    }
    const result = await client.query(
      `
      UPDATE eip_core.material
      SET code=$3, name=$4, material_type=$5, attrs=$6::jsonb, is_active=$7, updated_at=now()
      WHERE tenant_id=$1 AND id=$2
      RETURNING id, tenant_id, code, name, material_type, attrs, is_active, created_at, updated_at
      `,
      [session.tenant_id, current.id, input.code, input.name, input.materialType, JSON.stringify(input.attrs), input.isActive]
    );
    if (input.supplierId) await upsertObjectLink(client, session.tenant_id, MATERIAL_KIND, current.id, AGENT_KIND, input.supplierId, "DEFAULT_SUPPLIER");
    await client.query("COMMIT");
    await emitMutation(app, session, "inventory.material_updated", { material_id: current.id, status: input.status });
    const conditions = await listInventoryPolicyConditions(app, session.tenant_id);
    return {
      ok: true,
      item: mapMaterialRow(result.rows[0], {
        conditions,
        stockSummary: await loadMaterialStockSummary(app.db, session.tenant_id, current.id, governance),
        governance
      })
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listInventoryMaterialLots(app, session, materialId, query = {}) {
  const tenantId = session.tenant_id;
  const governance = await loadDropdownCodeSets(app, tenantId, ["INVENTORY_LOT_STATUS", "MATERIAL_LOT_STATUS"]);
  const material = await ensureMaterial(app.db, tenantId, materialId);
  if (!material) return { ok: false, items: [] };
  const limit = clampLimit(query.limit);
  const offset = normalizeOffset(query.offset);
  const includeArchived = query.include_archived === true || query.include_archived === "true";
  const params = [tenantId, material.id];
  const filters = ["lot.tenant_id=$1", "lot.material_id=$2", "lot.is_active=true"];
  if (!includeArchived) filters.push("UPPER(lot.status)<>'ARCHIVED'");
  if (normalizeOptionalText(query.q, 200)) {
    params.push(`%${normalizeText(query.q)}%`);
    filters.push(`(lot.lot_code ILIKE $${params.length} OR lot.status ILIKE $${params.length})`);
  }
  if (normalizeOptionalText(query.status, 40)) {
    params.push(normalizeStatus(query.status, LOT_STATUSES, "AVAILABLE", "INVALID_LOT_STATUS", governance, ["INVENTORY_LOT_STATUS", "MATERIAL_LOT_STATUS"]));
    filters.push(`UPPER(lot.status)=$${params.length}`);
  }
  params.push(limit, offset);
  const result = await app.db.query(
    `
    SELECT lot.id, lot.tenant_id, lot.material_id, lot.lot_code, lot.status, lot.quantity, lot.uom,
           lot.service_object_id, lot.owner_agent_id, lot.attrs, lot.is_active, lot.created_at, lot.updated_at,
           material.code AS material_code, material.name AS material_name,
           supplier.id AS supplier_id, supplier.code AS supplier_code, supplier.name AS supplier_name,
           supplier.agent_type AS supplier_agent_type
    FROM eip_core.material_lot lot
    JOIN eip_core.material material
      ON material.tenant_id=lot.tenant_id AND material.id=lot.material_id
    LEFT JOIN eip_core.agent supplier
      ON supplier.tenant_id=lot.tenant_id
     AND supplier.id::text = COALESCE(lot.attrs->'inventory_management_v1'->>'supplier_agent_id', lot.owner_agent_id::text)
    WHERE ${filters.join(" AND ")}
    ORDER BY lot.updated_at DESC, lot.created_at DESC, lot.lot_code ASC NULLS LAST
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );
  return { ok: true, items: (result.rows || []).map((row) => mapLotRow(row, governance)), limit, offset };
}

export async function createInventoryLot(app, session, materialId, body = {}) {
  const client = await app.db.connect();
  try {
    await client.query("BEGIN");
    const material = await ensureMaterial(client, session.tenant_id, materialId, { lock: true });
    if (!material) {
      await client.query("ROLLBACK");
      return null;
    }
    const governance = await loadDropdownCodeSets(app, session.tenant_id, ["INVENTORY_LOT_STATUS", "MATERIAL_LOT_STATUS"]);
    const input = normalizeLotInput(body, null, material, governance);
    if (input.supplierId && !(await ensureAgent(client, session.tenant_id, input.supplierId))) {
      throw new InventoryInputError("SUPPLIER_ENTITY_NOT_FOUND");
    }
    const result = await client.query(
      `
      INSERT INTO eip_core.material_lot
        (tenant_id, material_id, lot_code, status, quantity, uom, owner_agent_id, attrs, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,true)
      RETURNING id, tenant_id, material_id, lot_code, status, quantity, uom,
                service_object_id, owner_agent_id, attrs, is_active, created_at, updated_at
      `,
      [session.tenant_id, material.id, input.lotCode, input.status, input.quantity, input.unit, input.supplierId, JSON.stringify(input.attrs)]
    );
    const actorAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
    await insertLotStatusEvent(client, session.tenant_id, result.rows[0].id, null, input.status, "LOT_CREATED", null, actorAgentId);
    if (input.supplierId) await upsertObjectLink(client, session.tenant_id, LOT_KIND, result.rows[0].id, AGENT_KIND, input.supplierId, "SUPPLIER");
    await client.query("COMMIT");
    await emitMutation(app, session, "inventory.lot_created", { material_id: material.id, lot_id: result.rows[0].id, status: input.status });
    return { ok: true, item: mapLotRow({ ...result.rows[0], material_code: material.code, material_name: material.name }, governance) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getInventoryLotDetail(app, session, lotId) {
  const row = await ensureLot(app.db, session.tenant_id, lotId);
  if (!row) return null;
  const governance = await loadDropdownCodeSets(app, session.tenant_id, ["INVENTORY_LOT_STATUS", "MATERIAL_LOT_STATUS"]);
  const [documents, events] = await Promise.all([
    listInventoryDocuments(app, session, LOT_KIND, row.id),
    listLotStatusEvents(app.db, session.tenant_id, row.id)
  ]);
  return {
    ok: true,
    item: mapLotRow(row, governance),
    material: {
      id: row.material_id,
      code: row.material_code || null,
      name: row.material_name || null
    },
    documents: documents.items,
    status_events: events
  };
}

export async function updateInventoryLot(app, session, lotId, body = {}) {
  const client = await app.db.connect();
  try {
    await client.query("BEGIN");
    const current = await ensureLot(client, session.tenant_id, lotId, { lock: true });
    if (!current) {
      await client.query("ROLLBACK");
      return null;
    }
    const material = {
      id: current.material_id,
      code: current.material_code,
      name: current.material_name,
      attrs: current.material_attrs || {}
    };
    const governance = await loadDropdownCodeSets(app, session.tenant_id, ["INVENTORY_LOT_STATUS", "MATERIAL_LOT_STATUS"]);
    const input = normalizeLotInput(body, current, material, governance);
    if (input.supplierId && !(await ensureAgent(client, session.tenant_id, input.supplierId))) {
      throw new InventoryInputError("SUPPLIER_ENTITY_NOT_FOUND");
    }
    const previousStatus = lotDisplayStatus(current, governance);
    const result = await client.query(
      `
      UPDATE eip_core.material_lot
      SET lot_code=$3, status=$4, quantity=$5, uom=$6, owner_agent_id=$7, attrs=$8::jsonb,
          is_active=$9, updated_at=now()
      WHERE tenant_id=$1 AND id=$2
      RETURNING id, tenant_id, material_id, lot_code, status, quantity, uom,
                service_object_id, owner_agent_id, attrs, is_active, created_at, updated_at
      `,
      [
        session.tenant_id,
        current.id,
        input.lotCode,
        input.status,
        input.quantity,
        input.unit,
        input.supplierId,
        JSON.stringify(input.attrs),
        input.status !== "ARCHIVED"
      ]
    );
    if (previousStatus !== input.status) {
      const actorAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
      await insertLotStatusEvent(
        client,
        session.tenant_id,
        current.id,
        previousStatus,
        input.status,
        normalizeOptionalText(body.reason_code, 80) || "STATUS_UPDATED",
        normalizeOptionalText(body.note, 500),
        actorAgentId
      );
    }
    if (input.supplierId) await upsertObjectLink(client, session.tenant_id, LOT_KIND, current.id, AGENT_KIND, input.supplierId, "SUPPLIER");
    await client.query("COMMIT");
    await emitMutation(app, session, "inventory.lot_updated", { material_id: current.material_id, lot_id: current.id, status: input.status });
    return { ok: true, item: mapLotRow({ ...result.rows[0], material_code: current.material_code, material_name: current.material_name }, governance) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getInventoryMaterialSummary(app, session, materialId) {
  const detail = await getInventoryMaterialDetail(app, session, materialId);
  if (!detail) return null;
  return {
    ok: true,
    item: detail.item,
    summary: detail.summary,
    stock_summary: detail.item.stock_summary,
    policy_summary: detail.policy_summary,
    suppliers: detail.suppliers,
    documents: detail.documents
  };
}

export async function listInventoryReorderRecommendations(app, session, query = {}) {
  const materialResult = await listInventoryMaterials(app, session, { ...query, limit: query.limit || 200 });
  const conditions = await listInventoryPolicyConditions(app, session.tenant_id);
  const items = [];
  for (const item of materialResult.items) {
    const materialForProfile = {
      id: item.id,
      code: item.code,
      name: item.name,
      material_type: item.material_type,
      attrs: {
        inventory: {
          ...(item.stock_profile?.effective_policy || {}),
          track_stock: item.stock_summary?.has_lots ? true : item.stock_profile?.track_stock,
          stock_on_hand: item.stock_summary?.has_lots ? item.stock_summary.stock_on_hand : item.stock_profile?.stock_on_hand,
          available_qty: item.stock_summary?.has_lots ? item.stock_summary.available_qty : item.stock_profile?.available_qty,
          reserved_qty: item.stock_summary?.has_lots ? item.stock_summary.reserved_qty : item.stock_profile?.reserved_qty,
          reorder_point: item.stock_profile?.reorder_point,
          reorder_qty: item.stock_profile?.reorder_qty,
          unit_of_measure: item.unit_of_measure || item.stock_profile?.unit_of_measure
        }
      }
    };
    const profile = normalizeInventoryProfile(materialForProfile, { conditions });
    const payload = buildReorderSuggestionPayload(materialForProfile, profile, "inventory_management_v1_read_model");
    const warnings = [];
    if (!item.stock_summary?.has_lots && profile.track_stock !== true) {
      warnings.push({ code: "STOCK_SOURCE_NOT_CONFIGURED", message: "No active lots or tracked material stock profile exist yet." });
    }
    if (item.stock_summary?.warnings?.length) warnings.push(...item.stock_summary.warnings);
    items.push({
      material: {
        id: item.id,
        code: item.code,
        name: item.name,
        material_type: item.material_type,
        status: item.status,
        unit_of_measure: item.unit_of_measure
      },
      current_stock: {
        stock_on_hand: profile.stock_on_hand,
        available_qty: profile.available_qty,
        reserved_qty: profile.reserved_qty,
        stock_status: profile.stock_status,
        risk_status: profile.risk_status
      },
      threshold: {
        reorder_point: profile.reorder_point,
        reorder_qty: profile.reorder_qty,
        safety_stock: profile.safety_stock,
        minimum_stock: profile.minimum_stock,
        maximum_stock: profile.maximum_stock
      },
      suggested_action: payload.recommendation?.action || "monitor",
      suggested_qty: payload.suggested_qty,
      reason: payload.reason,
      explanation: payload.recommendation?.explanation || [],
      linked_policy: {
        source: payload.policy_source,
        condition_codes: payload.policy_condition_codes || [],
        effective_policy: payload.effective_policy || null
      },
      warnings
    });
  }
  return {
    ok: true,
    items,
    total: items.length,
    source: {
      stock: "eip_core.material_lot with material.attrs.inventory fallback",
      policy: "eip_core.commercial_condition"
    }
  };
}

export async function getInventoryEffectivePolicies(app, session, query = {}) {
  const context = {
    ...INVENTORY_POLICY_CONTEXT,
    ...query,
    policy_domain: "INVENTORY",
    condition_type: normalizeCode(query.condition_type || "REORDER_POLICY", "REORDER_POLICY")
  };
  let material = null;
  if (query.material_id) {
    material = await ensureMaterial(app.db, session.tenant_id, query.material_id);
    if (!material) return null;
    context.material_id = material.id;
    const supplierId = safeObject(material.attrs).inventory_management_v1?.default_supplier_entity_id
      || safeObject(material.attrs).inventory?.preferred_supplier_agent_id;
    if (supplierId) context.supplier_agent_id = supplierId;
  }
  const normalized = normalizeEffectivePolicyQuery(context);
  const effective = await resolveEffectivePolicy(app, session, normalized);
  const governance = material
    ? await loadDropdownCodeSets(app, session.tenant_id, ["INVENTORY_MATERIAL_STATUS"])
    : null;
  return {
    ok: true,
    context: Object.fromEntries(Object.entries(normalized).filter(([key]) => key !== "_effectiveAtDate")),
    material: material ? mapMaterialRow(material, { governance }) : null,
    effective_policy: effective
  };
}

export async function getInventoryOverview(app, session) {
  const [materials, recommendations, recent] = await Promise.all([
    listInventoryMaterials(app, session, { limit: 200 }),
    listInventoryReorderRecommendations(app, session, { limit: 200 }),
    app.db.query(
      `
      SELECT id, record_type, title, description, payload, created_at
      FROM eip_core.info_record
      WHERE tenant_id=$1
        AND record_type IN ('INVENTORY_STOCK_MOVEMENT','INVENTORY_POLICY_UPDATED','INVENTORY_REORDER_DECISION')
        AND is_active=true
      ORDER BY created_at DESC
      LIMIT 12
      `,
      [session.tenant_id]
    )
  ]);
  const stats = {
    total_materials: materials.total,
    active_materials: materials.items.filter((item) => item.status === "ACTIVE").length,
    blocked_materials: materials.items.filter((item) => item.status === "BLOCKED").length,
    lot_tracked_materials: materials.items.filter((item) => item.stock_summary?.has_lots).length,
    available_lots: materials.items.reduce((sum, item) => sum + Number(item.stock_summary?.by_status?.AVAILABLE || 0), 0),
    reserved_lots: materials.items.reduce((sum, item) => sum + Number(item.stock_summary?.by_status?.RESERVED || 0), 0),
    materials_needing_reorder: recommendations.items.filter((item) => item.suggested_action === "create_reorder_suggestion").length,
    materials_with_policy_conditions: recommendations.items.filter((item) => item.linked_policy.condition_codes.length > 0).length
  };
  return {
    ok: true,
    stats,
    materials: materials.items.slice(0, 12),
    reorder_recommendations: recommendations.items.slice(0, 12),
    recent_activity: (recent.rows || []).map((row) => ({
      id: row.id,
      record_type: row.record_type,
      title: row.title,
      description: row.description,
      created_at: row.created_at
    }))
  };
}

export async function getInventoryGovernanceOptions(app, session) {
  const [result, workspace] = await Promise.all([
    app.db.query(
    `
    WITH lists AS (
      SELECT DISTINCT ON (code) id, code, name
      FROM eip_core.dropdown_list
      WHERE is_active=true
        AND (tenant_id=$1 OR tenant_id IS NULL)
        AND code = ANY($2::text[])
      ORDER BY code, (tenant_id IS NOT NULL) DESC, version DESC
    )
    SELECT lists.code AS list_code, lists.name AS list_name,
           value.code, value.label, value.sort_order, value.attrs
    FROM lists
    JOIN eip_core.dropdown_value value
      ON value.list_id=lists.id AND value.is_active=true
    ORDER BY lists.code, value.sort_order, value.code
    `,
    [session.tenant_id, INVENTORY_DROPDOWN_CODES]
    ),
    loadModuleWorkspace(app, session.tenant_id, "inventory")
  ]);
  const options = {};
  for (const row of result.rows || []) {
    options[row.list_code] = options[row.list_code] || [];
    options[row.list_code].push({
      code: row.code,
      label: row.label,
      sort_order: row.sort_order,
      attrs: safeObject(row.attrs)
    });
  }
  return {
    ok: true,
    options,
    defaults: {
      material_types: MATERIAL_TYPES,
      material_statuses: MATERIAL_STATUSES,
      lot_statuses: LOT_STATUSES
    },
    workspace
  };
}

async function loadMaterialStockSummary(db, tenantId, materialId, governance = null) {
  const result = await db.query(
    `
    SELECT id, status, quantity, uom, attrs
    FROM eip_core.material_lot
    WHERE tenant_id=$1
      AND material_id=$2
      AND is_active=true
    `,
    [tenantId, materialId]
  );
  return stockSummaryFromLots(result.rows || [], governance);
}

async function upsertObjectLink(db, tenantId, srcKind, srcId, dstKind, dstId, relationType) {
  await db.query(
    `
    INSERT INTO eip_core.object_link
      (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,true)
    ON CONFLICT (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type)
    DO UPDATE SET attrs=COALESCE(eip_core.object_link.attrs,'{}'::jsonb) || EXCLUDED.attrs,
                  is_active=true,
                  updated_at=now()
    `,
    [tenantId, srcKind, srcId, dstKind, dstId, relationType, JSON.stringify({ module: "inventory", source: "inventory_management_v1" })]
  );
}

async function insertLotStatusEvent(db, tenantId, lotId, fromStatus, toStatus, reasonCode, note, actorAgentId) {
  await db.query(
    `
    INSERT INTO eip_core.material_lot_status_event
      (tenant_id, material_lot_id, from_status, to_status, reason_code, note, actor_agent_id, attrs)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    `,
    [
      tenantId,
      lotId,
      fromStatus,
      toStatus,
      reasonCode,
      note,
      actorAgentId,
      JSON.stringify({ module: "inventory", source: "inventory_management_v1" })
    ]
  );
}

async function listLotStatusEvents(db, tenantId, lotId) {
  const result = await db.query(
    `
    SELECT id, from_status, to_status, reason_code, note, occurred_at, actor_agent_id, created_at
    FROM eip_core.material_lot_status_event
    WHERE tenant_id=$1 AND material_lot_id=$2
    ORDER BY occurred_at DESC, created_at DESC
    LIMIT 50
    `,
    [tenantId, lotId]
  );
  return (result.rows || []).map((row) => ({
    id: row.id,
    from_status: row.from_status,
    to_status: row.to_status,
    reason_code: row.reason_code,
    note: row.note,
    occurred_at: row.occurred_at,
    actor_agent_id: row.actor_agent_id,
    created_at: row.created_at
  }));
}

async function listInventoryDocuments(app, session, srcKind, srcId) {
  const result = await app.db.query(
    `
    SELECT info.id, info.record_type, info.title, info.mime_type, info.file_size,
           info.created_by_agent_id, info.is_active, info.created_at, info.updated_at,
           COALESCE(info.attrs->>'status', info.payload->>'status') AS status,
           link.relation_type
    FROM eip_core.object_link link
    JOIN eip_core.info_record info
      ON info.tenant_id=link.tenant_id
     AND info.id = CASE WHEN link.src_kind=$3 THEN link.src_id ELSE link.dst_id END
    WHERE link.tenant_id=$1
      AND link.is_active=true
      AND info.is_active=true
      AND (
        (link.src_kind=$2 AND link.src_id=$4 AND link.dst_kind=$3)
        OR (link.dst_kind=$2 AND link.dst_id=$4 AND link.src_kind=$3)
      )
    ORDER BY info.created_at DESC
    LIMIT 50
    `,
    [session.tenant_id, srcKind, INFO_KIND, srcId]
  );
  return {
    ok: true,
    items: (result.rows || []).map((row) => ({
      id: row.id,
      record_type: row.record_type,
      title: row.title,
      mime_type: row.mime_type,
      file_size: row.file_size === null || row.file_size === undefined ? null : Number(row.file_size),
      status: row.status || null,
      relation_type: row.relation_type,
      created_by_agent_id: row.created_by_agent_id,
      is_active: row.is_active === true,
      created_at: row.created_at,
      updated_at: row.updated_at
    }))
  };
}

async function listMaterialEntityLinks(app, session, materialId) {
  const result = await app.db.query(
    `
    SELECT link.id, link.relation_type, link.sort_order, link.is_active, link.created_at, link.updated_at,
           agent.id AS agent_id, agent.code, agent.name, agent.agent_type, agent.attrs, agent.is_active AS agent_is_active
    FROM eip_core.object_link link
    JOIN eip_core.agent agent
      ON agent.tenant_id=link.tenant_id
     AND agent.id = CASE WHEN link.src_kind=$3 THEN link.src_id ELSE link.dst_id END
    WHERE link.tenant_id=$1
      AND link.is_active=true
      AND (
        (link.src_kind=$2 AND link.src_id=$4 AND link.dst_kind=$3)
        OR (link.dst_kind=$2 AND link.dst_id=$4 AND link.src_kind=$3)
      )
    ORDER BY link.sort_order ASC, link.updated_at DESC
    LIMIT 50
    `,
    [session.tenant_id, MATERIAL_KIND, AGENT_KIND, materialId]
  );
  return {
    ok: true,
    items: (result.rows || []).map((row) => ({
      id: row.agent_id,
      link_id: row.id,
      relation_type: row.relation_type,
      code: row.code || null,
      display_name: row.name || null,
      entity_kind: row.agent_type || null,
      roles: Array.isArray(row.attrs?.roles) ? row.attrs.roles : [],
      status: row.attrs?.status || (row.agent_is_active ? "ACTIVE" : "INACTIVE"),
      created_at: row.created_at,
      updated_at: row.updated_at
    }))
  };
}

async function getMaterialPolicySummary(app, session, materialRow) {
  const conditions = await listInventoryPolicyConditions(app, session.tenant_id);
  const resolution = resolveInventoryPolicy(materialRow, conditions);
  let effectiveReadModel = null;
  const warnings = [];
  try {
    const context = {
      ...INVENTORY_POLICY_CONTEXT,
      material_id: materialRow.id
    };
    const supplierId = safeObject(materialRow.attrs).inventory_management_v1?.default_supplier_entity_id
      || safeObject(materialRow.attrs).inventory?.preferred_supplier_agent_id;
    if (supplierId) context.supplier_agent_id = supplierId;
    effectiveReadModel = await resolveEffectivePolicy(app, session, normalizeEffectivePolicyQuery(context));
  } catch (error) {
    if (error instanceof EffectivePolicyInputError) {
      warnings.push({ code: "EFFECTIVE_POLICY_CONTEXT_INVALID", details: error.details });
    } else {
      throw error;
    }
  }
  return {
    ok: true,
    summary: {
      source: resolution.policy_source,
      condition_codes: resolution.condition_codes,
      effective_policy: resolution.effective_policy,
      material_override_fields: resolution.material_override_fields,
      effective_read_model: effectiveReadModel ? {
        resolution_status: effectiveReadModel.resolution_status,
        selected_condition: effectiveReadModel.selected_condition,
        fallback_used: effectiveReadModel.fallback_used,
        warnings: effectiveReadModel.warnings,
        conflicts: effectiveReadModel.conflicts,
        explanation: effectiveReadModel.explanation,
        source: effectiveReadModel.source
      } : null,
      warnings
    }
  };
}

async function listInventoryActivity(app, session, materialId, query = {}) {
  const limit = clampLimit(query.limit);
  const [movements, lotEvents] = await Promise.all([
    app.db.query(
      `
      SELECT id, record_type, title, description, payload, created_at
      FROM eip_core.info_record
      WHERE tenant_id=$1
        AND is_active=true
        AND (
          payload->>'material_id'=$2
          OR attrs->>'material_id'=$2
        )
      ORDER BY created_at DESC
      LIMIT $3
      `,
      [session.tenant_id, materialId, limit]
    ),
    app.db.query(
      `
      SELECT event.id, event.material_lot_id, event.from_status, event.to_status,
             event.reason_code, event.note, event.occurred_at, event.actor_agent_id
      FROM eip_core.material_lot_status_event event
      JOIN eip_core.material_lot lot
        ON lot.tenant_id=event.tenant_id AND lot.id=event.material_lot_id
      WHERE event.tenant_id=$1 AND lot.material_id=$2
      ORDER BY event.occurred_at DESC
      LIMIT $3
      `,
      [session.tenant_id, materialId, limit]
    )
  ]);
  return {
    ok: true,
    movements: (movements.rows || []).map((row) => ({
      id: row.id,
      record_type: row.record_type,
      title: row.title,
      description: row.description,
      created_at: row.created_at,
      movement_type: row.payload?.movement_type || null,
      direction: row.payload?.direction || null,
      quantity: row.payload?.quantity ?? null,
      unit_of_measure: row.payload?.unit_of_measure || null,
      balance_after: row.payload?.balance_after ?? null
    })),
    status_events: (lotEvents.rows || []).map((row) => ({
      id: row.id,
      material_lot_id: row.material_lot_id,
      from_status: row.from_status,
      to_status: row.to_status,
      reason_code: row.reason_code,
      note: row.note,
      occurred_at: row.occurred_at,
      actor_agent_id: row.actor_agent_id
    })),
    summary: {
      movements: (movements.rows || []).length,
      lot_status_events: (lotEvents.rows || []).length
    }
  };
}

function buildMaterialSummary(item, lots, stockSummary, suppliers, documents, policySummary) {
  return {
    material_id: item.id,
    status: item.status,
    material_type: item.material_type,
    lots: {
      total: lots.length,
      by_status: stockSummary.by_status || {}
    },
    stock: {
      stock_on_hand: stockSummary.stock_on_hand,
      available_qty: stockSummary.available_qty,
      reserved_qty: stockSummary.reserved_qty,
      blocked_qty: stockSummary.blocked_qty,
      quarantine_qty: stockSummary.quarantine_qty,
      stock_status: stockSummary.stock_status || item.stock_profile?.stock_status || null,
      unit_of_measure: stockSummary.unit_of_measure || item.unit_of_measure
    },
    reorder: {
      policy_source: item.stock_profile?.policy_source || null,
      condition_codes: item.stock_profile?.policy_condition_codes || [],
      suggested_qty: item.stock_profile?.suggested_qty ?? null,
      recommendation: item.stock_profile?.recommendation || null
    },
    suppliers: {
      total: suppliers.length,
      primary: item.supplier || suppliers[0] || null
    },
    documents: {
      total: documents.length
    },
    policies: {
      source: policySummary.source || null,
      condition_codes: policySummary.condition_codes || [],
      resolution_status: policySummary.effective_read_model?.resolution_status || null
    },
    warnings: stockSummary.warnings || []
  };
}
