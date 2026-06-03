import { randomBytes } from "node:crypto";
import { hasPermission } from "../auth/perm.js";
import { sha256Hex } from "../auth/crypto.js";
import { applyInventoryMovement, normalizeMovement } from "../services/inventory/inventoryFoundation.js";
import {
  buildPurchaseRequisitionPayload,
  buildRfqPayload,
  compareSupplierQuotes,
  normalizeSupplierLink,
  normalizeSupplierQuote,
  selectProcurementModel
} from "../services/procurement/procurementFoundation.js";

const MAX_LIMIT = 200;
const REORDER_OBJECT_TYPE = "INVENTORY_REORDER_SUGGESTION";
const PURCHASE_REQUISITION_OBJECT_TYPE = "PURCHASE_REQUISITION";
const PURCHASE_RFQ_OBJECT_TYPE = "PURCHASE_RFQ";
const CASH_PURCHASE_OBJECT_TYPE = "CASH_PURCHASE";
const SUPPLIER_LINK_RELATION = "MATERIAL_SUPPLIER";
const SUPPLIER_QUOTE_RECORD_TYPE = "SUPPLIER_QUOTE";
const QUOTE_COMPARISON_RECORD_TYPE = "SUPPLIER_QUOTE_COMPARISON";
const CASH_PURCHASE_RECORD_TYPE = "PROCUREMENT_CASH_PURCHASE_RECEIPT";
const MOVEMENT_RECORD_TYPE = "INVENTORY_STOCK_MOVEMENT";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value) {
  const text = normalizeText(value);
  return text.length ? text : null;
}

function normalizeStatus(value, fallback = null) {
  const text = normalizeText(value).toLowerCase();
  return text || fallback;
}

function clampLimit(value) {
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

async function requireRead(app, req, reply, permissionCode) {
  const sessionResult = await app.requireSession(req, { realm: "EIP" });
  if (!sessionResult.ok) {
    reply.code(sessionResult.status).send({ ok: false, error: sessionResult.error });
    return null;
  }

  const allowed = await hasPermission(app, sessionResult.session.tenant_id, sessionResult.session.identity_id, permissionCode);
  if (!allowed) {
    reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    return null;
  }
  return sessionResult.session;
}

async function requireWrite(app, req, reply, permissionCode) {
  const sessionResult = await app.requireSession(req, { realm: "EIP" });
  if (!sessionResult.ok) {
    reply.code(sessionResult.status).send({ ok: false, error: sessionResult.error });
    return null;
  }

  const csrfResult = await app.requireCsrf(req);
  if (!csrfResult.ok) {
    reply.code(csrfResult.status).send({ ok: false, error: csrfResult.error });
    return null;
  }

  const allowed = await hasPermission(app, sessionResult.session.tenant_id, sessionResult.session.identity_id, permissionCode);
  if (!allowed) {
    reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    return null;
  }
  return sessionResult.session;
}

async function getPrimaryAgentId(client, tenantId, identityId) {
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

async function ensureProcessInstance(client, app, input) {
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

async function fetchMaterial(client, tenantId, materialId, { lock = false } = {}) {
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

async function fetchAgent(client, tenantId, agentId) {
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

async function listProcurementConditions(client, tenantId) {
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
        UPPER(COALESCE(condition_type,'')) IN (
          'INVENTORY_REORDER_POLICY',
          'SUPPLY_REORDER_CONDITION',
          'SUPPLIER_PURCHASE_CONDITION',
          'MATERIAL_SUPPLIER_CONDITION',
          'PROCUREMENT_POLICY',
          'PAYMENT_TERM_CONDITION',
          'FREIGHT_COST_CONDITION',
          'CASH_PURCHASE_CONDITION'
        )
        OR UPPER(COALESCE(condition_category,'')) IN ('INVENTORY','SUPPLY','PURCHASING','FINANCE','LOGISTICS')
      )
    ORDER BY priority ASC, created_at DESC
    `,
    [tenantId]
  );
  return result.rows || [];
}

function serializeSupplierLink(row) {
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

async function listSupplierLinks(client, tenantId, query = {}) {
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

async function fetchServiceObject(client, tenantId, id, objectType) {
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

async function listServiceObjects(client, tenantId, objectType, query = {}) {
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

async function linkObject(client, tenantId, srcKind, srcId, dstKind, dstId, relationType, attrs = {}) {
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

async function createServiceObject(client, input) {
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

async function buildRequisitionFromReorder(client, app, input) {
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

async function advanceObject(client, app, input) {
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

export default async function procurementRoutes(app) {
  app.get("/overview", async (req, reply) => {
    const session = await requireRead(app, req, reply, "PROCUREMENT_READ");
    if (!session) return;
    const [requisitions, rfqs, cashPurchases, supplierLinks, needs] = await Promise.all([
      app.db.query("SELECT COUNT(*)::int AS total FROM eip_core.service_object WHERE tenant_id=$1 AND object_type=$2", [session.tenant_id, PURCHASE_REQUISITION_OBJECT_TYPE]),
      app.db.query("SELECT COUNT(*)::int AS total FROM eip_core.service_object WHERE tenant_id=$1 AND object_type=$2", [session.tenant_id, PURCHASE_RFQ_OBJECT_TYPE]),
      app.db.query("SELECT COUNT(*)::int AS total FROM eip_core.service_object WHERE tenant_id=$1 AND object_type=$2", [session.tenant_id, CASH_PURCHASE_OBJECT_TYPE]),
      listSupplierLinks(app.db, session.tenant_id, {}),
      listServiceObjects(app.db, session.tenant_id, REORDER_OBJECT_TYPE, { status: "approved", limit: 10 })
    ]);

    return reply.send({
      ok: true,
      stats: {
        supplier_links: supplierLinks.length,
        open_purchase_needs: needs.items.length,
        purchase_requisitions: Number(requisitions.rows[0]?.total || 0),
        rfqs: Number(rfqs.rows[0]?.total || 0),
        cash_purchases: Number(cashPurchases.rows[0]?.total || 0)
      },
      purchase_needs: needs.items.map((item) => ({
        id: item.id,
        code: item.code,
        title: item.title,
        status: item.status,
        attrs: item.attrs,
        decision_card: item.attrs?.decision_card || null,
        recommendation: item.attrs?.recommendation || null,
        process_parameters: item.attrs?.process_parameters || null
      }))
    });
  });

  app.get("/supplier-links", async (req, reply) => {
    const session = await requireRead(app, req, reply, "SUPPLIER_LINK_READ");
    if (!session) return;
    const items = await listSupplierLinks(app.db, session.tenant_id, req.query || {});
    return reply.send({ ok: true, items });
  });

  app.post("/supplier-links", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "SUPPLIER_LINK_WRITE");
    if (!session) return;
    const materialId = normalizeOptionalText(req.body?.material_id);
    const supplierAgentId = normalizeOptionalText(req.body?.supplier_agent_id);
    if (!materialId || !supplierAgentId) return reply.code(400).send({ ok: false, error: "MATERIAL_AND_SUPPLIER_REQUIRED" });

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const [material, supplier] = await Promise.all([
        fetchMaterial(client, session.tenant_id, materialId),
        fetchAgent(client, session.tenant_id, supplierAgentId)
      ]);
      if (!material || !supplier) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "MATERIAL_OR_SUPPLIER_NOT_FOUND" });
      }
      const attrs = normalizeSupplierLink(req.body || {});
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
        [session.tenant_id, material.id, supplier.id, SUPPLIER_LINK_RELATION, attrs.priority, JSON.stringify(attrs)]
      );
      await client.query("COMMIT");
      return reply.send({ ok: true, item: serializeSupplierLink({ ...result.rows[0], material_code: material.code, material_name: material.name, supplier_code: supplier.code, supplier_name: supplier.name }) });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "procurement_supplier_link_create_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "SUPPLIER_LINK_CREATE_FAILED" });
    } finally {
      client.release();
    }
  });

  app.patch("/supplier-links/:id", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "SUPPLIER_LINK_WRITE");
    if (!session) return;
    const attrs = normalizeSupplierLink(req.body || {});
    const result = await app.db.query(
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
      [session.tenant_id, req.params.id, JSON.stringify(attrs), attrs.priority, req.body?.is_active, SUPPLIER_LINK_RELATION]
    );
    if (!result.rowCount) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, item: serializeSupplierLink(result.rows[0]) });
  });

  app.get("/requisitions", async (req, reply) => {
    const session = await requireRead(app, req, reply, "PROCUREMENT_REQUISITION_READ");
    if (!session) return;
    const result = await listServiceObjects(app.db, session.tenant_id, PURCHASE_REQUISITION_OBJECT_TYPE, req.query || {});
    return reply.send({ ok: true, ...result });
  });

  app.post("/requisitions/from-reorder", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "PROCUREMENT_REQUISITION_WRITE");
    if (!session) return;
    const reorderSuggestionId = normalizeOptionalText(req.body?.reorder_suggestion_id);
    if (!reorderSuggestionId) return reply.code(400).send({ ok: false, error: "REORDER_SUGGESTION_REQUIRED" });
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const result = await buildRequisitionFromReorder(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        reorderSuggestionId
      });
      if (!result.ok) {
        await client.query("ROLLBACK");
        return reply.code(result.status || 409).send({ ok: false, error: result.error });
      }
      await client.query("COMMIT");
      return reply.send({ ok: true, item: result.item, reused: result.reused === true });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "procurement_requisition_from_reorder_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "REQUISITION_CREATE_FAILED" });
    } finally {
      client.release();
    }
  });

  app.get("/requisitions/:id", async (req, reply) => {
    const session = await requireRead(app, req, reply, "PROCUREMENT_REQUISITION_READ");
    if (!session) return;
    const item = await fetchServiceObject(app.db, session.tenant_id, req.params.id, PURCHASE_REQUISITION_OBJECT_TYPE);
    if (!item) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, item });
  });

  for (const [path, action, permission] of [
    ["/requisitions/:id/approve", "approve", "PROCUREMENT_REQUISITION_APPROVE"],
    ["/requisitions/:id/ignore", "ignore", "PROCUREMENT_REQUISITION_WRITE"]
  ]) {
    app.post(path, async (req, reply) => {
      const session = await requireWrite(app, req, reply, permission);
      if (!session) return;
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const result = await advanceObject(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          id: req.params.id,
          objectType: PURCHASE_REQUISITION_OBJECT_TYPE,
          action,
          payload: req.body || {},
          idempotencyKey: req.body?.idempotency_key
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(result.status || 409).send({ ok: false, error: result.error });
        }
        await client.query("COMMIT");
        return reply.send({ ok: true, item: result.item, reused: result.reused === true });
      } catch (error) {
        await client.query("ROLLBACK");
        app.log.error({ event: "procurement_requisition_action_error", tenantId: session.tenant_id, error: error.message });
        return reply.code(500).send({ ok: false, error: "REQUISITION_ACTION_FAILED" });
      } finally {
        client.release();
      }
    });
  }

  app.get("/rfqs", async (req, reply) => {
    const session = await requireRead(app, req, reply, "PROCUREMENT_RFQ_READ");
    if (!session) return;
    const result = await listServiceObjects(app.db, session.tenant_id, PURCHASE_RFQ_OBJECT_TYPE, req.query || {});
    return reply.send({ ok: true, ...result });
  });

  app.post("/rfqs/from-requisition", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "PROCUREMENT_RFQ_WRITE");
    if (!session) return;
    const requisitionId = normalizeOptionalText(req.body?.requisition_id);
    if (!requisitionId) return reply.code(400).send({ ok: false, error: "REQUISITION_REQUIRED" });
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const requisition = await fetchServiceObject(client, session.tenant_id, requisitionId, PURCHASE_REQUISITION_OBJECT_TYPE);
      if (!requisition) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "REQUISITION_NOT_FOUND" });
      }
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
        [session.tenant_id, PURCHASE_RFQ_OBJECT_TYPE, requisition.id]
      );
      if (existing.rowCount) {
        await client.query("COMMIT");
        return reply.send({ ok: true, item: existing.rows[0], reused: true });
      }
      const attrs = buildRfqPayload({ requisition, ...req.body });
      const ownerAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
      const item = await createServiceObject(client, {
        tenantId: session.tenant_id,
        objectType: PURCHASE_RFQ_OBJECT_TYPE,
        status: "draft",
        code: buildCode("RFQ"),
        title: `RFQ: ${requisition.title || requisition.code}`,
        attrs,
        ownerAgentId
      });
      await linkObject(client, session.tenant_id, "service_object", item.id, "service_object", requisition.id, "RFQ_FROM_REQUISITION", { module: "procurement" });
      if (attrs.material_id) await linkObject(client, session.tenant_id, "service_object", item.id, "material", attrs.material_id, "RFQ_FOR", { module: "procurement" });
      const started = await ensureProcessInstance(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        serviceObjectId: item.id,
        objectType: PURCHASE_RFQ_OBJECT_TYPE
      });
      if (!started.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: started.error });
      }
      await client.query("COMMIT");
      return reply.send({ ok: true, item });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "procurement_rfq_from_requisition_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "RFQ_CREATE_FAILED" });
    } finally {
      client.release();
    }
  });

  app.get("/rfqs/:id", async (req, reply) => {
    const session = await requireRead(app, req, reply, "PROCUREMENT_RFQ_READ");
    if (!session) return;
    const item = await fetchServiceObject(app.db, session.tenant_id, req.params.id, PURCHASE_RFQ_OBJECT_TYPE);
    if (!item) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const quotes = await app.db.query(
      `
      SELECT id, title, payload, attrs, created_at
      FROM eip_core.info_record
      WHERE tenant_id=$1
        AND record_type=$2
        AND payload->>'rfq_id'=$3
        AND is_active=true
      ORDER BY created_at DESC
      `,
      [session.tenant_id, SUPPLIER_QUOTE_RECORD_TYPE, item.id]
    );
    return reply.send({ ok: true, item, quotes: quotes.rows || [] });
  });

  app.post("/rfqs/:id/quotes", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "PROCUREMENT_RFQ_WRITE");
    if (!session) return;
    const rfq = await fetchServiceObject(app.db, session.tenant_id, req.params.id, PURCHASE_RFQ_OBJECT_TYPE);
    if (!rfq) return reply.code(404).send({ ok: false, error: "RFQ_NOT_FOUND" });
    const quote = normalizeSupplierQuote({ ...req.body, material_id: req.body?.material_id || rfq.attrs?.material_id });
    if (!quote.supplier_agent_id) return reply.code(400).send({ ok: false, error: "SUPPLIER_REQUIRED" });
    const actorAgentId = await getPrimaryAgentId(app.db, session.tenant_id, session.identity_id);
    const result = await app.db.query(
      `
      INSERT INTO eip_core.info_record
        (tenant_id, record_type, title, payload, attrs, created_by_agent_id)
      VALUES
        ($1,$2,$3,$4::jsonb,$5::jsonb,$6)
      RETURNING id, record_type, title, payload, attrs, created_at
      `,
      [
        session.tenant_id,
        SUPPLIER_QUOTE_RECORD_TYPE,
        `Supplier quote for ${rfq.code || rfq.id}`,
        JSON.stringify({ ...quote, rfq_id: rfq.id }),
        JSON.stringify({ module: "procurement", source: "rfq_quote" }),
        actorAgentId
      ]
    );
    await linkObject(app.db, session.tenant_id, "service_object", rfq.id, "info_record", result.rows[0].id, "RFQ_QUOTE", { module: "procurement" });
    await linkObject(app.db, session.tenant_id, "info_record", result.rows[0].id, "agent", quote.supplier_agent_id, "QUOTE_SUPPLIER", { module: "procurement" });
    return reply.send({ ok: true, item: result.rows[0] });
  });

  app.post("/rfqs/:id/compare", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "PROCUREMENT_QUOTE_REVIEW");
    if (!session) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const rfq = await fetchServiceObject(client, session.tenant_id, req.params.id, PURCHASE_RFQ_OBJECT_TYPE);
      if (!rfq) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "RFQ_NOT_FOUND" });
      }
      const quotes = await client.query(
        `
        SELECT id, payload, attrs, created_at
        FROM eip_core.info_record
        WHERE tenant_id=$1
          AND record_type=$2
          AND payload->>'rfq_id'=$3
          AND is_active=true
        `,
        [session.tenant_id, SUPPLIER_QUOTE_RECORD_TYPE, rfq.id]
      );
      const comparison = compareSupplierQuotes(quotes.rows, { selection_criteria: rfq.attrs?.selection_criteria, currency: rfq.attrs?.currency });
      const actorAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
      const record = await client.query(
        `
        INSERT INTO eip_core.info_record
          (tenant_id, record_type, title, payload, attrs, created_by_agent_id)
        VALUES
          ($1,$2,$3,$4::jsonb,$5::jsonb,$6)
        RETURNING id, record_type, title, payload, attrs, created_at
        `,
        [
          session.tenant_id,
          QUOTE_COMPARISON_RECORD_TYPE,
          `Quote comparison for ${rfq.code || rfq.id}`,
          JSON.stringify({ ...comparison, rfq_id: rfq.id }),
          JSON.stringify({ module: "procurement", source: "rfq_compare" }),
          actorAgentId
        ]
      );
      await linkObject(client, session.tenant_id, "service_object", rfq.id, "info_record", record.rows[0].id, "RFQ_QUOTE_COMPARISON", { module: "procurement" });
      await client.query(
        `
        UPDATE eip_core.service_object
        SET attrs=COALESCE(attrs,'{}'::jsonb) || $3::jsonb,
            status='comparison_ready',
            updated_at=now()
        WHERE tenant_id=$1 AND id=$2
        `,
        [session.tenant_id, rfq.id, JSON.stringify({ quote_comparison: comparison })]
      );
      await client.query("COMMIT");
      return reply.send({ ok: true, item: record.rows[0], comparison });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "procurement_rfq_compare_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "RFQ_COMPARE_FAILED" });
    } finally {
      client.release();
    }
  });

  app.post("/rfqs/:id/approve-quote", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "PROCUREMENT_QUOTE_REVIEW");
    if (!session) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const result = await advanceObject(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        id: req.params.id,
        objectType: PURCHASE_RFQ_OBJECT_TYPE,
        action: "approve_quote",
        payload: req.body || {},
        idempotencyKey: req.body?.idempotency_key
      });
      if (!result.ok) {
        await client.query("ROLLBACK");
        return reply.code(result.status || 409).send({ ok: false, error: result.error });
      }
      await client.query("COMMIT");
      return reply.send({ ok: true, item: result.item, reused: result.reused === true });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "procurement_quote_approve_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "QUOTE_APPROVE_FAILED" });
    } finally {
      client.release();
    }
  });

  app.post("/cash-purchases", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "PROCUREMENT_CASH_PURCHASE");
    if (!session) return;
    const materialId = normalizeOptionalText(req.body?.material_id);
    const quantity = Number(req.body?.quantity || req.body?.received_qty || 0);
    if (!materialId || !Number.isFinite(quantity) || quantity <= 0) return reply.code(400).send({ ok: false, error: "MATERIAL_AND_QUANTITY_REQUIRED" });

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const material = await fetchMaterial(client, session.tenant_id, materialId, { lock: true });
      if (!material) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "MATERIAL_NOT_FOUND" });
      }
      const actorAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
      const currency = normalizeOptionalText(req.body?.currency) || material.attrs?.inventory?.effective_policy?.currency || "EUR";
      const unitCost = Number(req.body?.unit_cost || material.attrs?.inventory?.average_cost || material.attrs?.inventory?.unit_cost || 0);
      const totalCost = Number(req.body?.total_cost || quantity * unitCost);
      const attrs = {
        procurement_model: "cash_shop_purchase",
        material_id: material.id,
        material_code: material.code,
        material_name: material.name,
        supplier_agent_id: normalizeOptionalText(req.body?.supplier_agent_id),
        quantity,
        unit_of_measure: normalizeOptionalText(req.body?.unit_of_measure) || material.attrs?.inventory?.unit_of_measure || "pcs",
        unit_cost: Number.isFinite(unitCost) ? unitCost : 0,
        total_cost: Number.isFinite(totalCost) ? Number(totalCost.toFixed(2)) : 0,
        currency,
        receipt_ref: normalizeOptionalText(req.body?.receipt_ref),
        payment_terms_code: "DUE_ON_RECEIPT",
        cash_required: Number.isFinite(totalCost) ? Number(totalCost.toFixed(2)) : 0,
        status: "recorded"
      };
      const item = await createServiceObject(client, {
        tenantId: session.tenant_id,
        objectType: CASH_PURCHASE_OBJECT_TYPE,
        status: "recorded",
        code: buildCode("CASH"),
        title: `Cash purchase: ${material.name || material.code || material.id}`,
        attrs,
        ownerAgentId: actorAgentId
      });
      await linkObject(client, session.tenant_id, "service_object", item.id, "material", material.id, "CASH_PURCHASE_FOR", { module: "procurement" });
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
        const applied = applyInventoryMovement(material.attrs || {}, movement.movement, { material, conditions: await listProcurementConditions(client, session.tenant_id) });
        await client.query(
          `
          UPDATE eip_core.material
          SET attrs=$3::jsonb, updated_at=now()
          WHERE tenant_id=$1 AND id=$2
          `,
          [session.tenant_id, material.id, JSON.stringify(applied.attrs)]
        );
        await client.query(
          `
          INSERT INTO eip_core.info_record
            (tenant_id, record_type, title, payload, attrs, created_by_agent_id)
          VALUES
            ($1,$2,$3,$4::jsonb,$5::jsonb,$6)
          `,
          [
            session.tenant_id,
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
          session.tenant_id,
          CASH_PURCHASE_RECORD_TYPE,
          `Cash purchase recorded: ${material.name || material.code || material.id}`,
          JSON.stringify({ ...attrs, cash_purchase_id: item.id }),
          JSON.stringify({ module: "procurement", source: "cash_purchase" }),
          actorAgentId
        ]
      );
      await client.query("COMMIT");
      return reply.send({ ok: true, item, receipt: receipt.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "procurement_cash_purchase_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "CASH_PURCHASE_FAILED" });
    } finally {
      client.release();
    }
  });
}

export {
  CASH_PURCHASE_OBJECT_TYPE,
  PURCHASE_REQUISITION_OBJECT_TYPE,
  PURCHASE_RFQ_OBJECT_TYPE,
  SUPPLIER_LINK_RELATION,
  SUPPLIER_QUOTE_RECORD_TYPE
};
