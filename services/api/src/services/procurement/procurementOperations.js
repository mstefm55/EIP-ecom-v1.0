import { randomBytes } from "node:crypto";
import { sha256Hex } from "../../auth/crypto.js";
import { applyInventoryMovement, normalizeMovement } from "../inventory/inventoryFoundation.js";
import {
  buildPurchaseRequisitionPayload,
  buildRfqPayload,
  compareSupplierQuotes,
  normalizeSupplierLink,
  normalizeSupplierQuote,
  selectProcurementModel
} from "./procurementFoundation.js";
import {
  buildStockProfileFromNeed,
  composePurchaseNeedWorkbench,
  listProcurementConditions,
  PROCUREMENT_LINK_TYPES,
  PROCUREMENT_OBJECT_TYPES,
  PROCUREMENT_RECORD_TYPES,
  serializeAgent,
  serializeMaterial
} from "./procurementWorkbench.js";

const MAX_LIMIT = 200;

export const REORDER_OBJECT_TYPE = PROCUREMENT_OBJECT_TYPES.REORDER_SUGGESTION;
export const PURCHASE_REQUISITION_OBJECT_TYPE = PROCUREMENT_OBJECT_TYPES.PURCHASE_REQUISITION;
export const PURCHASE_RFQ_OBJECT_TYPE = PROCUREMENT_OBJECT_TYPES.PURCHASE_RFQ;
export const CASH_PURCHASE_OBJECT_TYPE = PROCUREMENT_OBJECT_TYPES.CASH_PURCHASE;
export const SUPPLIER_LINK_RELATION = PROCUREMENT_LINK_TYPES.MATERIAL_SUPPLIER;
export const SUPPLIER_QUOTE_RECORD_TYPE = PROCUREMENT_RECORD_TYPES.SUPPLIER_QUOTE;
export const QUOTE_COMPARISON_RECORD_TYPE = PROCUREMENT_RECORD_TYPES.SUPPLIER_QUOTE_COMPARISON;
export const CASH_PURCHASE_RECORD_TYPE = PROCUREMENT_RECORD_TYPES.CASH_PURCHASE_RECEIPT;
export const MOVEMENT_RECORD_TYPE = PROCUREMENT_RECORD_TYPES.INVENTORY_STOCK_MOVEMENT;

export { serializeAgent, serializeMaterial };

function normalizeText(value) {
  return String(value || "").trim();
}

export function normalizeOptionalText(value) {
  const text = normalizeText(value);
  return text.length ? text : null;
}

export function normalizeStatus(value, fallback = null) {
  const text = normalizeText(value).toLowerCase();
  return text || fallback;
}

export function clampLimit(value) {
  const parsed = Number(value || 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function buildCode(prefix) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

function buildIdempotencyKey(prefix, payload) {
  return sha256Hex(`${prefix}:${JSON.stringify(payload || {})}`);
}

export async function getPrimaryAgentId(client, tenantId, identityId) {
  const result = await client.query(
    `
    SELECT agent_id
    FROM eip_auth.auth_identity_agent
    WHERE tenant_id=$1
      AND identity_id=$2
      AND is_primary=true
      AND is_active=true
    LIMIT 1
    `,
    [tenantId, identityId]
  );
  return result.rows[0]?.agent_id || null;
}

async function resolveProcessBinding(client, tenantId, objectType) {
  const result = await client.query(
    `
    SELECT process_def_id
    FROM eip_core.process_binding
    WHERE tenant_id=$1
      AND service_object_type=$2
      AND is_active=true
    ORDER BY priority ASC, created_at DESC
    LIMIT 1
    `,
    [tenantId, objectType]
  );
  return result.rows[0] || null;
}

export async function ensureProcessInstance(client, app, input) {
  const active = await app.coreProcess.findActiveInstance(client, input.tenantId, input.serviceObjectId);
  if (active) return { ok: true, instance: active };

  const binding = await resolveProcessBinding(client, input.tenantId, input.objectType);
  if (!binding) return { ok: false, error: "PROCESS_BINDING_REQUIRED" };

  const started = await app.coreProcess.createInstance(client, {
    tenantId: input.tenantId,
    identityId: input.identityId,
    serviceObjectId: input.serviceObjectId,
    processDefId: binding.process_def_id,
    idempotencyKey: `auto:${input.objectType}:${input.serviceObjectId}`
  });
  if (!started.ok) return started;
  return { ok: true, instance: started.item };
}

export async function fetchMaterial(client, tenantId, materialId, { lock = false } = {}) {
  if (!materialId) return null;
  const result = await client.query(
    `
    SELECT id, code, name, material_type, attrs, is_active, created_at, updated_at
    FROM eip_core.material
    WHERE tenant_id=$1
      AND id=$2
      AND is_active=true
    ${lock ? "FOR UPDATE" : ""}
    `,
    [tenantId, materialId]
  );
  return result.rows[0] || null;
}

export async function fetchAgent(client, tenantId, agentId) {
  if (!agentId) return null;
  const result = await client.query(
    `
    SELECT id, code, name, agent_type, attrs, is_active
    FROM eip_core.agent
    WHERE tenant_id=$1
      AND id=$2
      AND is_active=true
    LIMIT 1
    `,
    [tenantId, agentId]
  );
  return result.rows[0] || null;
}

export function serializeSupplierLink(row) {
  if (!row) return null;
  return {
    id: row.id,
    material_id: row.material_id || row.src_id,
    supplier_agent_id: row.supplier_agent_id || row.dst_id,
    material_code: row.material_code || null,
    material_name: row.material_name || null,
    supplier_code: row.supplier_code || null,
    supplier_name: row.supplier_name || null,
    relation_type: row.relation_type,
    sort_order: row.sort_order,
    attrs: row.attrs || {},
    is_active: row.is_active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function listSupplierLinks(client, tenantId, query = {}) {
  const materialId = normalizeOptionalText(query.material_id);
  const supplierAgentId = normalizeOptionalText(query.supplier_agent_id);
  const params = [tenantId];
  const filters = [
    "link.tenant_id=$1",
    "link.src_kind='material'",
    "link.dst_kind='agent'",
    "link.relation_type=$2",
    "link.is_active=true"
  ];
  params.push(SUPPLIER_LINK_RELATION);
  if (materialId) {
    params.push(materialId);
    filters.push(`link.src_id=$${params.length}`);
  }
  if (supplierAgentId) {
    params.push(supplierAgentId);
    filters.push(`link.dst_id=$${params.length}`);
  }
  const result = await client.query(
    `
    SELECT link.id, link.src_id AS material_id, link.dst_id AS supplier_agent_id,
           link.relation_type, link.sort_order, link.attrs, link.is_active, link.created_at, link.updated_at,
           material.code AS material_code, material.name AS material_name,
           supplier.code AS supplier_code, supplier.name AS supplier_name
    FROM eip_core.object_link link
    JOIN eip_core.material material
      ON material.tenant_id=link.tenant_id
     AND material.id=link.src_id
    JOIN eip_core.agent supplier
      ON supplier.tenant_id=link.tenant_id
     AND supplier.id=link.dst_id
    WHERE ${filters.join(" AND ")}
    ORDER BY COALESCE((link.attrs->>'priority')::int, link.sort_order), supplier.name NULLS LAST
    `,
    params
  );
  return result.rows.map(serializeSupplierLink);
}

export async function fetchServiceObject(client, tenantId, id, objectType) {
  const result = await client.query(
    `
    SELECT id, code, title, status, object_type, attrs, owner_agent_id, created_at, updated_at
    FROM eip_core.service_object
    WHERE tenant_id=$1
      AND id=$2
      AND object_type=$3
    LIMIT 1
    `,
    [tenantId, id, objectType]
  );
  return result.rows[0] || null;
}

export async function listServiceObjects(client, tenantId, objectType, query = {}) {
  const params = [tenantId, objectType];
  const filters = ["tenant_id=$1", "object_type=$2"];
  const status = normalizeOptionalText(query.status);
  const q = normalizeOptionalText(query.q);
  if (status) {
    params.push(normalizeStatus(status));
    filters.push(`lower(status)=$${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    filters.push(`(code ILIKE $${params.length} OR title ILIKE $${params.length} OR attrs::text ILIKE $${params.length})`);
  }
  params.push(clampLimit(query.limit), Math.max(0, Number(query.offset || 0)));
  const result = await client.query(
    `
    SELECT id, code, title, status, object_type, attrs, owner_agent_id, created_at, updated_at
    FROM eip_core.service_object
    WHERE ${filters.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );
  return { items: result.rows || [], limit: params.at(-2), offset: params.at(-1) };
}

export async function listPurchaseNeeds(client, tenantId, query = {}) {
  const limit = clampLimit(query.limit || 25);
  const result = await client.query(
    `
    SELECT id, code, title, status, object_type, attrs, owner_agent_id, created_at, updated_at
    FROM eip_core.service_object
    WHERE tenant_id=$1
      AND object_type=$2
      AND status IN ('open','review','approved')
    ORDER BY
      CASE COALESCE(attrs->>'risk_status', attrs->'recommendation'->>'risk_status')
        WHEN 'already_out_of_stock' THEN 1
        WHEN 'stockout_predicted' THEN 2
        WHEN 'reorder_now' THEN 3
        WHEN 'watch' THEN 4
        ELSE 5
      END,
      CASE
        WHEN COALESCE(attrs->>'days_of_cover','') ~ '^[0-9]+(\\.[0-9]+)?$' THEN (attrs->>'days_of_cover')::numeric
        ELSE 999999
      END ASC,
      created_at DESC
    LIMIT $3
    `,
    [tenantId, REORDER_OBJECT_TYPE, limit]
  );
  return result.rows || [];
}

export async function linkObject(client, tenantId, srcKind, srcId, dstKind, dstId, relationType, attrs = {}) {
  await client.query(
    `
    INSERT INTO eip_core.object_link
      (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7::jsonb)
    ON CONFLICT (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type) DO UPDATE
      SET attrs=COALESCE(eip_core.object_link.attrs,'{}'::jsonb) || EXCLUDED.attrs,
          is_active=true,
          updated_at=now()
    `,
    [tenantId, srcKind, srcId, dstKind, dstId, relationType, JSON.stringify(attrs || {})]
  );
}

export async function createServiceObject(client, input) {
  const result = await client.query(
    `
    INSERT INTO eip_core.service_object
      (tenant_id, object_type, status, code, title, attrs, owner_agent_id)
    VALUES
      ($1,$2,$3,$4,$5,$6::jsonb,$7)
    RETURNING id, code, title, status, object_type, attrs, owner_agent_id, created_at, updated_at
    `,
    [
      input.tenantId,
      input.objectType,
      input.status || "draft",
      input.code,
      input.title,
      JSON.stringify(input.attrs || {}),
      input.ownerAgentId || null
    ]
  );
  return result.rows[0];
}

export async function createSupplierLink(client, input) {
  const [material, supplier] = await Promise.all([
    fetchMaterial(client, input.tenantId, input.materialId),
    fetchAgent(client, input.tenantId, input.supplierAgentId)
  ]);
  if (!material || !supplier) return { ok: false, status: 404, error: "MATERIAL_OR_SUPPLIER_NOT_FOUND" };
  const attrs = normalizeSupplierLink(input.body || {});
  const result = await client.query(
    `
    INSERT INTO eip_core.object_link
      (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, sort_order, attrs)
    VALUES
      ($1,'material',$2,'agent',$3,$4,$5,$6::jsonb)
    ON CONFLICT (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type) DO UPDATE
      SET attrs=COALESCE(eip_core.object_link.attrs,'{}'::jsonb) || EXCLUDED.attrs,
          sort_order=EXCLUDED.sort_order,
          is_active=true,
          updated_at=now()
    RETURNING id, src_id AS material_id, dst_id AS supplier_agent_id, relation_type, sort_order, attrs, is_active, created_at, updated_at
    `,
    [input.tenantId, material.id, supplier.id, SUPPLIER_LINK_RELATION, attrs.priority, JSON.stringify(attrs)]
  );
  return {
    ok: true,
    item: serializeSupplierLink({
      ...result.rows[0],
      material_code: material.code,
      material_name: material.name,
      supplier_code: supplier.code,
      supplier_name: supplier.name
    })
  };
}

export async function updateSupplierLink(client, input) {
  const attrs = normalizeSupplierLink(input.body || {});
  const result = await client.query(
    `
    UPDATE eip_core.object_link
    SET attrs=COALESCE(attrs,'{}'::jsonb) || $3::jsonb,
        sort_order=$4,
        is_active=COALESCE($5::boolean, is_active),
        updated_at=now()
    WHERE tenant_id=$1
      AND id=$2
      AND relation_type=$6
    RETURNING id, src_id AS material_id, dst_id AS supplier_agent_id, relation_type, sort_order, attrs, is_active, created_at, updated_at
    `,
    [input.tenantId, input.linkId, JSON.stringify(attrs), attrs.priority, input.body?.is_active, SUPPLIER_LINK_RELATION]
  );
  if (!result.rowCount) return { ok: false, status: 404, error: "NOT_FOUND" };
  return { ok: true, item: serializeSupplierLink(result.rows[0]) };
}

export async function buildRequisitionFromReorder(client, app, input) {
  const suggestion = await fetchServiceObject(client, input.tenantId, input.reorderSuggestionId, REORDER_OBJECT_TYPE);
  if (!suggestion) return { ok: false, status: 404, error: "REORDER_SUGGESTION_NOT_FOUND" };

  const existing = await client.query(
    `
    SELECT id, code, title, status, object_type, attrs, owner_agent_id, created_at, updated_at
    FROM eip_core.service_object
    WHERE tenant_id=$1
      AND object_type=$2
      AND attrs->>'source_reorder_suggestion_id'=$3
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [input.tenantId, PURCHASE_REQUISITION_OBJECT_TYPE, suggestion.id]
  );
  if (existing.rowCount) return { ok: true, item: existing.rows[0], reused: true };

  const suggestionAttrs = suggestion.attrs || {};
  const material = await fetchMaterial(client, input.tenantId, suggestionAttrs.material_id || suggestionAttrs.materialId);
  if (!material) return { ok: false, status: 409, error: "MATERIAL_REQUIRED" };

  const [links, conditions] = await Promise.all([
    listSupplierLinks(client, input.tenantId, { material_id: material.id }),
    listProcurementConditions(client, input.tenantId)
  ]);
  const stockProfile = suggestionAttrs.reorder_recommendation || suggestionAttrs.recommendation
    ? {
        ...suggestionAttrs,
        ...(suggestionAttrs.stock_profile || {}),
        recommendation: suggestionAttrs.recommendation || suggestionAttrs.reorder_recommendation
      }
    : suggestionAttrs;
  const recommendation = selectProcurementModel({
    material,
    stock_profile: stockProfile,
    supplier_links: links,
    conditions,
    requested_qty: suggestionAttrs.suggested_qty
  });
  const payload = buildPurchaseRequisitionPayload({
    material,
    stock_profile: stockProfile,
    recommendation,
    source_reorder_suggestion_id: suggestion.id,
    trigger_reason: suggestionAttrs.reason || "inventory_reorder_need"
  });
  const ownerAgentId = await getPrimaryAgentId(client, input.tenantId, input.identityId);
  const item = await createServiceObject(client, {
    tenantId: input.tenantId,
    objectType: PURCHASE_REQUISITION_OBJECT_TYPE,
    status: "draft",
    code: buildCode("PR"),
    title: `Purchase need: ${material.name || material.code || material.id}`,
    attrs: payload,
    ownerAgentId
  });
  await linkObject(client, input.tenantId, "service_object", item.id, "service_object", suggestion.id, "REQUISITION_FROM_REORDER", { module: "procurement" });
  await linkObject(client, input.tenantId, "service_object", item.id, "material", material.id, "REQUISITION_FOR", { module: "procurement" });
  if (payload.recommended_supplier_agent_id) {
    await linkObject(client, input.tenantId, "service_object", item.id, "agent", payload.recommended_supplier_agent_id, "RECOMMENDED_SUPPLIER", { module: "procurement" });
  }

  const started = await ensureProcessInstance(client, app, {
    tenantId: input.tenantId,
    identityId: input.identityId,
    serviceObjectId: item.id,
    objectType: PURCHASE_REQUISITION_OBJECT_TYPE
  });
  if (!started.ok) return { ok: false, status: 409, error: started.error };
  return { ok: true, item };
}

export async function advanceObject(client, app, input) {
  const item = await fetchServiceObject(client, input.tenantId, input.id, input.objectType);
  if (!item) return { ok: false, status: 404, error: "NOT_FOUND" };
  const instance = await ensureProcessInstance(client, app, {
    tenantId: input.tenantId,
    identityId: input.identityId,
    serviceObjectId: item.id,
    objectType: input.objectType
  });
  if (!instance.ok) return { ok: false, status: 409, error: instance.error };
  const payload = input.payload || {};
  const result = await app.coreProcess.advanceInstance(client, {
    tenantId: input.tenantId,
    identityId: input.identityId,
    instanceId: instance.instance.id,
    action: input.action,
    payload,
    idempotencyKey: input.idempotencyKey || buildIdempotencyKey("procurement_action", {
      id: item.id,
      action: input.action,
      payload
    })
  });
  if (!result.ok) return { ok: false, status: 409, error: result.error };
  return { ok: true, reused: result.reused === true, item: await fetchServiceObject(client, input.tenantId, item.id, input.objectType) };
}

export async function findRequisitionForNeed(client, tenantId, needId) {
  const result = await client.query(
    `
    SELECT id, code, title, status, object_type, attrs, owner_agent_id, created_at, updated_at
    FROM eip_core.service_object
    WHERE tenant_id=$1
      AND object_type=$2
      AND attrs->>'source_reorder_suggestion_id'=$3
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [tenantId, PURCHASE_REQUISITION_OBJECT_TYPE, needId]
  );
  return result.rows[0] || null;
}

export async function findRfqForRequisition(client, tenantId, requisitionId) {
  if (!requisitionId) return null;
  const result = await client.query(
    `
    SELECT id, code, title, status, object_type, attrs, owner_agent_id, created_at, updated_at
    FROM eip_core.service_object
    WHERE tenant_id=$1
      AND object_type=$2
      AND attrs->>'source_requisition_id'=$3
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [tenantId, PURCHASE_RFQ_OBJECT_TYPE, requisitionId]
  );
  return result.rows[0] || null;
}

export async function listQuotesForRfq(client, tenantId, rfqId) {
  if (!rfqId) return [];
  const result = await client.query(
    `
    SELECT id, title, payload, attrs, created_at
    FROM eip_core.info_record
    WHERE tenant_id=$1
      AND record_type=$2
      AND payload->>'rfq_id'=$3
      AND is_active=true
    ORDER BY created_at DESC
    `,
    [tenantId, SUPPLIER_QUOTE_RECORD_TYPE, rfqId]
  );
  return result.rows || [];
}

export async function latestQuoteComparisonForRfq(client, tenantId, rfqId) {
  if (!rfqId) return null;
  const result = await client.query(
    `
    SELECT id, title, payload, attrs, created_at
    FROM eip_core.info_record
    WHERE tenant_id=$1
      AND record_type=$2
      AND payload->>'rfq_id'=$3
      AND is_active=true
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [tenantId, QUOTE_COMPARISON_RECORD_TYPE, rfqId]
  );
  return result.rows[0] || null;
}

export async function buildPurchaseNeedWorkbench(client, app, tenantId, needId) {
  const need = await fetchServiceObject(client, tenantId, needId, REORDER_OBJECT_TYPE);
  if (!need) return { ok: false, status: 404, error: "PURCHASE_NEED_NOT_FOUND" };

  const materialId = need.attrs?.material_id || need.attrs?.materialId || need.attrs?.process_parameters?.parameters?.material_id;
  const material = await fetchMaterial(client, tenantId, materialId);
  const [conditions, supplierLinks, requisition] = await Promise.all([
    listProcurementConditions(client, tenantId),
    materialId ? listSupplierLinks(client, tenantId, { material_id: materialId }) : Promise.resolve([]),
    findRequisitionForNeed(client, tenantId, need.id)
  ]);
  const stockProfile = buildStockProfileFromNeed(need, material);
  const recommendation = selectProcurementModel({
    material,
    stock_profile: stockProfile,
    supplier_links: supplierLinks,
    conditions,
    requested_qty: stockProfile.suggested_qty
  });
  recommendation.material_id = material?.id || materialId || null;

  const rfq = await findRfqForRequisition(client, tenantId, requisition?.id);
  const [quotes, quoteComparison] = await Promise.all([
    listQuotesForRfq(client, tenantId, rfq?.id),
    latestQuoteComparisonForRfq(client, tenantId, rfq?.id)
  ]);
  const [needProcess, requisitionProcess, rfqProcess] = await Promise.all([
    app.coreProcess.findActiveInstance(client, tenantId, need.id),
    requisition?.id ? app.coreProcess.findActiveInstance(client, tenantId, requisition.id) : Promise.resolve(null),
    rfq?.id ? app.coreProcess.findActiveInstance(client, tenantId, rfq.id) : Promise.resolve(null)
  ]);

  return composePurchaseNeedWorkbench({
    need,
    material,
    supplierLinks,
    stockProfile,
    recommendation,
    requisition,
    rfq,
    quotes,
    quoteComparison,
    processState: {
      need: needProcess,
      requisition: requisitionProcess,
      rfq: rfqProcess
    }
  });
}

export async function createRfqFromRequisition(client, app, input) {
  const requisition = await fetchServiceObject(client, input.tenantId, input.requisitionId, PURCHASE_REQUISITION_OBJECT_TYPE);
  if (!requisition) return { ok: false, status: 404, error: "REQUISITION_NOT_FOUND" };

  const existing = await client.query(
    `
    SELECT id, code, title, status, object_type, attrs, created_at, updated_at
    FROM eip_core.service_object
    WHERE tenant_id=$1
      AND object_type=$2
      AND attrs->>'source_requisition_id'=$3
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [input.tenantId, PURCHASE_RFQ_OBJECT_TYPE, requisition.id]
  );
  if (existing.rowCount) return { ok: true, item: existing.rows[0], reused: true };

  const attrs = buildRfqPayload({ requisition, ...(input.body || {}) });
  const ownerAgentId = await getPrimaryAgentId(client, input.tenantId, input.identityId);
  const item = await createServiceObject(client, {
    tenantId: input.tenantId,
    objectType: PURCHASE_RFQ_OBJECT_TYPE,
    status: "draft",
    code: buildCode("RFQ"),
    title: `RFQ: ${requisition.title || requisition.code}`,
    attrs,
    ownerAgentId
  });
  await linkObject(client, input.tenantId, "service_object", item.id, "service_object", requisition.id, "RFQ_FROM_REQUISITION", { module: "procurement" });
  if (attrs.material_id) await linkObject(client, input.tenantId, "service_object", item.id, "material", attrs.material_id, "RFQ_FOR", { module: "procurement" });
  const started = await ensureProcessInstance(client, app, {
    tenantId: input.tenantId,
    identityId: input.identityId,
    serviceObjectId: item.id,
    objectType: PURCHASE_RFQ_OBJECT_TYPE
  });
  if (!started.ok) return { ok: false, status: 409, error: started.error };
  return { ok: true, item };
}

export async function addSupplierQuote(client, input) {
  const rfq = await fetchServiceObject(client, input.tenantId, input.rfqId, PURCHASE_RFQ_OBJECT_TYPE);
  if (!rfq) return { ok: false, status: 404, error: "RFQ_NOT_FOUND" };
  const quote = normalizeSupplierQuote({ ...(input.body || {}), material_id: input.body?.material_id || rfq.attrs?.material_id });
  if (!quote.supplier_agent_id) return { ok: false, status: 400, error: "SUPPLIER_REQUIRED" };
  const supplier = await fetchAgent(client, input.tenantId, quote.supplier_agent_id);
  if (!supplier) return { ok: false, status: 404, error: "SUPPLIER_NOT_FOUND" };
  const actorAgentId = await getPrimaryAgentId(client, input.tenantId, input.identityId);
  const result = await client.query(
    `
    INSERT INTO eip_core.info_record
      (tenant_id, record_type, title, payload, attrs, created_by_agent_id)
    VALUES
      ($1,$2,$3,$4::jsonb,$5::jsonb,$6)
    RETURNING id, record_type, title, payload, attrs, created_at
    `,
    [
      input.tenantId,
      SUPPLIER_QUOTE_RECORD_TYPE,
      `Supplier quote for ${rfq.code || rfq.id}`,
      JSON.stringify({ ...quote, rfq_id: rfq.id }),
      JSON.stringify({ module: "procurement", source: "rfq_quote" }),
      actorAgentId
    ]
  );
  await linkObject(client, input.tenantId, "service_object", rfq.id, "info_record", result.rows[0].id, "RFQ_QUOTE", { module: "procurement" });
  await linkObject(client, input.tenantId, "info_record", result.rows[0].id, "agent", quote.supplier_agent_id, "QUOTE_SUPPLIER", { module: "procurement" });
  return { ok: true, item: result.rows[0] };
}

export async function compareRfqQuotes(client, input) {
  const rfq = await fetchServiceObject(client, input.tenantId, input.rfqId, PURCHASE_RFQ_OBJECT_TYPE);
  if (!rfq) return { ok: false, status: 404, error: "RFQ_NOT_FOUND" };
  const quotes = await client.query(
    `
    SELECT id, payload, attrs, created_at
    FROM eip_core.info_record
    WHERE tenant_id=$1
      AND record_type=$2
      AND payload->>'rfq_id'=$3
      AND is_active=true
    `,
    [input.tenantId, SUPPLIER_QUOTE_RECORD_TYPE, rfq.id]
  );
  const comparison = compareSupplierQuotes(quotes.rows, { selection_criteria: rfq.attrs?.selection_criteria, currency: rfq.attrs?.currency });
  const actorAgentId = await getPrimaryAgentId(client, input.tenantId, input.identityId);
  const record = await client.query(
    `
    INSERT INTO eip_core.info_record
      (tenant_id, record_type, title, payload, attrs, created_by_agent_id)
    VALUES
      ($1,$2,$3,$4::jsonb,$5::jsonb,$6)
    RETURNING id, record_type, title, payload, attrs, created_at
    `,
    [
      input.tenantId,
      QUOTE_COMPARISON_RECORD_TYPE,
      `Quote comparison for ${rfq.code || rfq.id}`,
      JSON.stringify({ ...comparison, rfq_id: rfq.id }),
      JSON.stringify({ module: "procurement", source: "rfq_compare" }),
      actorAgentId
    ]
  );
  await linkObject(client, input.tenantId, "service_object", rfq.id, "info_record", record.rows[0].id, "RFQ_QUOTE_COMPARISON", { module: "procurement" });
  await client.query(
    `
    UPDATE eip_core.service_object
    SET attrs=COALESCE(attrs,'{}'::jsonb) || $3::jsonb,
        status='comparison_ready',
        updated_at=now()
    WHERE tenant_id=$1 AND id=$2
    `,
    [input.tenantId, rfq.id, JSON.stringify({ quote_comparison: comparison })]
  );
  return { ok: true, item: record.rows[0], comparison };
}

export async function recordCashPurchase(client, input) {
  const materialId = normalizeOptionalText(input.body?.material_id);
  const quantity = Number(input.body?.quantity || input.body?.received_qty || 0);
  const material = await fetchMaterial(client, input.tenantId, materialId, { lock: true });
  if (!material) return { ok: false, status: 404, error: "MATERIAL_NOT_FOUND" };
  const actorAgentId = await getPrimaryAgentId(client, input.tenantId, input.identityId);
  const currency = normalizeOptionalText(input.body?.currency) || material.attrs?.inventory?.effective_policy?.currency || "EUR";
  const unitCost = Number(input.body?.unit_cost || material.attrs?.inventory?.average_cost || material.attrs?.inventory?.unit_cost || 0);
  const totalCost = Number(input.body?.total_cost || quantity * unitCost);
  const attrs = {
    procurement_model: "cash_shop_purchase",
    material_id: material.id,
    material_code: material.code,
    material_name: material.name,
    supplier_agent_id: normalizeOptionalText(input.body?.supplier_agent_id),
    quantity,
    unit_of_measure: normalizeOptionalText(input.body?.unit_of_measure) || material.attrs?.inventory?.unit_of_measure || "pcs",
    unit_cost: Number.isFinite(unitCost) ? unitCost : 0,
    total_cost: Number.isFinite(totalCost) ? Number(totalCost.toFixed(2)) : 0,
    currency,
    receipt_ref: normalizeOptionalText(input.body?.receipt_ref),
    payment_terms_code: "DUE_ON_RECEIPT",
    cash_required: Number.isFinite(totalCost) ? Number(totalCost.toFixed(2)) : 0,
    status: "recorded"
  };
  const item = await createServiceObject(client, {
    tenantId: input.tenantId,
    objectType: CASH_PURCHASE_OBJECT_TYPE,
    status: "recorded",
    code: buildCode("CASH"),
    title: `Cash purchase: ${material.name || material.code || material.id}`,
    attrs,
    ownerAgentId: actorAgentId
  });
  await linkObject(client, input.tenantId, "service_object", item.id, "material", material.id, "CASH_PURCHASE_FOR", { module: "procurement" });
  const movement = normalizeMovement({
    movement_type: "purchase_receipt",
    direction: "in",
    quantity,
    unit_of_measure: attrs.unit_of_measure,
    reason: "Cash/shop purchase receipt",
    source_object_kind: "service_object",
    source_object_id: item.id
  });
  if (movement.ok) {
    const applied = applyInventoryMovement(material.attrs || {}, movement.movement, {
      material,
      conditions: await listProcurementConditions(client, input.tenantId)
    });
    await client.query(
      `
      UPDATE eip_core.material
      SET attrs=$3::jsonb, updated_at=now()
      WHERE tenant_id=$1 AND id=$2
      `,
      [input.tenantId, material.id, JSON.stringify(applied.attrs)]
    );
    await client.query(
      `
      INSERT INTO eip_core.info_record
        (tenant_id, record_type, title, payload, attrs, created_by_agent_id)
      VALUES
        ($1,$2,$3,$4::jsonb,$5::jsonb,$6)
      `,
      [
        input.tenantId,
        MOVEMENT_RECORD_TYPE,
        `Cash purchase receipt: ${material.name || material.code || material.id}`,
        JSON.stringify({ ...applied.movement_record, material_id: material.id, source_object_id: item.id }),
        JSON.stringify({ module: "inventory", source: "procurement_cash_purchase" }),
        actorAgentId
      ]
    );
  }
  const receipt = await client.query(
    `
    INSERT INTO eip_core.info_record
      (tenant_id, record_type, title, payload, attrs, created_by_agent_id)
    VALUES
      ($1,$2,$3,$4::jsonb,$5::jsonb,$6)
    RETURNING id, record_type, title, payload, attrs, created_at
    `,
    [
      input.tenantId,
      CASH_PURCHASE_RECORD_TYPE,
      `Cash purchase recorded: ${material.name || material.code || material.id}`,
      JSON.stringify({ ...attrs, cash_purchase_id: item.id }),
      JSON.stringify({ module: "procurement", source: "cash_purchase" }),
      actorAgentId
    ]
  );
  return { ok: true, item, receipt: receipt.rows[0] };
}
