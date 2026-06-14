import { hasPermission } from "../auth/perm.js";
import {
  CASH_PURCHASE_OBJECT_TYPE,
  PURCHASE_REQUISITION_OBJECT_TYPE,
  PURCHASE_RFQ_OBJECT_TYPE,
  SUPPLIER_LINK_RELATION,
  SUPPLIER_QUOTE_RECORD_TYPE,
  addSupplierQuote,
  advanceObject,
  buildPurchaseNeedWorkbench,
  buildRequisitionFromReorder,
  clampLimit,
  compareRfqQuotes,
  createRfqFromRequisition,
  createSupplierLink,
  fetchServiceObject,
  listPurchaseNeeds,
  listQuotesForRfq,
  listServiceObjects,
  listSupplierLinks,
  normalizeOptionalText,
  normalizeStatus,
  recordCashPurchase,
  serializeAgent,
  serializeMaterial,
  updateSupplierLink
} from "../services/procurement/procurementOperations.js";
import {
  PROCUREMENT_MANAGEMENT_PERMISSIONS,
  ProcurementInputError,
  createProcurementRequest,
  getProcurementEffectivePolicy,
  getProcurementGovernanceOptions,
  getProcurementRecommendation,
  getProcurementRequest,
  getProcurementRequestSummary,
  listProcurementRequests,
  listProcurementSupplierOptions,
  transitionProcurementRequest,
  updateProcurementRequest
} from "../services/procurement/procurementManagement.js";
import { EffectivePolicyInputError } from "../services/policiesConditions/effectivePolicy.js";

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

async function withTransaction(app, session, reply, eventName, failureCode, handler) {
  const client = await app.db.connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    if (!result.ok) {
      await client.query("ROLLBACK");
      return reply.code(result.status || 409).send({ ok: false, error: result.error });
    }
    await client.query("COMMIT");
    return reply.send(result.response || { ok: true, item: result.item, reused: result.reused === true });
  } catch (error) {
    await client.query("ROLLBACK");
    app.log.error({ event: eventName, tenantId: session.tenant_id, error: error.message });
    return reply.code(500).send({ ok: false, error: failureCode });
  } finally {
    client.release();
  }
}

function sendServiceResult(reply, result) {
  if (!result) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
  if (result.ok === false) return reply.code(result.status || 409).send({ ok: false, error: result.error, details: result.details });
  return reply.send(result);
}

function sendRouteError(app, req, reply, error, failureCode) {
  if (error instanceof ProcurementInputError || error instanceof EffectivePolicyInputError) {
    return reply.code(error.statusCode || 400).send({ ok: false, error: error.code || error.message, details: error.details || null });
  }
  app.log.error({ event: failureCode, error: error.message, route: req.url });
  return reply.code(500).send({ ok: false, error: failureCode });
}

export default async function procurementRoutes(app) {
  app.get("/governance/options", async (req, reply) => {
    const session = await requireRead(app, req, reply, PROCUREMENT_MANAGEMENT_PERMISSIONS.read);
    if (!session) return;
    try {
      const options = await getProcurementGovernanceOptions(app, session);
      const permissions = [];
      for (const permissionCode of Object.values(PROCUREMENT_MANAGEMENT_PERMISSIONS)) {
        if (await hasPermission(app, session.tenant_id, session.identity_id, permissionCode)) {
          permissions.push(permissionCode);
        }
      }
      return reply.send({ ...options, permissions });
    } catch (error) {
      return sendRouteError(app, req, reply, error, "PROCUREMENT_GOVERNANCE_OPTIONS_FAILED");
    }
  });

  app.get("/requests", async (req, reply) => {
    const session = await requireRead(app, req, reply, PROCUREMENT_MANAGEMENT_PERMISSIONS.read);
    if (!session) return;
    try {
      return reply.send(await listProcurementRequests(app, session, req.query || {}));
    } catch (error) {
      return sendRouteError(app, req, reply, error, "PROCUREMENT_REQUEST_LIST_FAILED");
    }
  });

  app.post("/requests", async (req, reply) => {
    const session = await requireWrite(app, req, reply, PROCUREMENT_MANAGEMENT_PERMISSIONS.requestCreate);
    if (!session) return;
    try {
      return sendServiceResult(reply, await createProcurementRequest(app, session, req.body || {}));
    } catch (error) {
      return sendRouteError(app, req, reply, error, "PROCUREMENT_REQUEST_CREATE_FAILED");
    }
  });

  app.get("/requests/:id", async (req, reply) => {
    const session = await requireRead(app, req, reply, PROCUREMENT_MANAGEMENT_PERMISSIONS.read);
    if (!session) return;
    try {
      return sendServiceResult(reply, await getProcurementRequest(app, session, req.params.id));
    } catch (error) {
      return sendRouteError(app, req, reply, error, "PROCUREMENT_REQUEST_DETAIL_FAILED");
    }
  });

  app.patch("/requests/:id", async (req, reply) => {
    const session = await requireWrite(app, req, reply, PROCUREMENT_MANAGEMENT_PERMISSIONS.requestUpdate);
    if (!session) return;
    try {
      return sendServiceResult(reply, await updateProcurementRequest(app, session, req.params.id, req.body || {}));
    } catch (error) {
      return sendRouteError(app, req, reply, error, "PROCUREMENT_REQUEST_UPDATE_FAILED");
    }
  });

  app.get("/requests/:id/summary", async (req, reply) => {
    const session = await requireRead(app, req, reply, PROCUREMENT_MANAGEMENT_PERMISSIONS.read);
    if (!session) return;
    try {
      return sendServiceResult(reply, await getProcurementRequestSummary(app, session, req.params.id));
    } catch (error) {
      return sendRouteError(app, req, reply, error, "PROCUREMENT_REQUEST_SUMMARY_FAILED");
    }
  });

  app.get("/requests/:id/supplier-options", async (req, reply) => {
    const session = await requireRead(app, req, reply, PROCUREMENT_MANAGEMENT_PERMISSIONS.read);
    if (!session) return;
    try {
      return sendServiceResult(reply, await listProcurementSupplierOptions(app, session, req.params.id, req.query || {}));
    } catch (error) {
      return sendRouteError(app, req, reply, error, "PROCUREMENT_SUPPLIER_OPTIONS_FAILED");
    }
  });

  app.get("/recommendations", async (req, reply) => {
    const session = await requireRead(app, req, reply, PROCUREMENT_MANAGEMENT_PERMISSIONS.recommendationRead);
    if (!session) return;
    try {
      return sendServiceResult(reply, await getProcurementRecommendation(app, session, req.query || {}));
    } catch (error) {
      return sendRouteError(app, req, reply, error, "PROCUREMENT_RECOMMENDATION_FAILED");
    }
  });

  app.get("/policies/effective", async (req, reply) => {
    const session = await requireRead(app, req, reply, PROCUREMENT_MANAGEMENT_PERMISSIONS.policyRead);
    if (!session) return;
    try {
      return sendServiceResult(reply, await getProcurementEffectivePolicy(app, session, req.query || {}));
    } catch (error) {
      return sendRouteError(app, req, reply, error, "PROCUREMENT_EFFECTIVE_POLICY_FAILED");
    }
  });

  for (const [path, action, permission] of [
    ["/requests/:id/submit", "submit", PROCUREMENT_MANAGEMENT_PERMISSIONS.requestSubmit],
    ["/requests/:id/approve", "approve", PROCUREMENT_MANAGEMENT_PERMISSIONS.requestApprove],
    ["/requests/:id/reject", "reject", PROCUREMENT_MANAGEMENT_PERMISSIONS.requestApprove]
  ]) {
    app.post(path, async (req, reply) => {
      const session = await requireWrite(app, req, reply, permission);
      if (!session) return;
      try {
        return sendServiceResult(reply, await transitionProcurementRequest(app, session, req.params.id, action, req.body || {}));
      } catch (error) {
        return sendRouteError(app, req, reply, error, "PROCUREMENT_REQUEST_ACTION_FAILED");
      }
    });
  }

  app.get("/overview", async (req, reply) => {
    const session = await requireRead(app, req, reply, "PROCUREMENT_READ");
    if (!session) return;
    const [requisitions, rfqs, cashPurchases, supplierLinks, needs] = await Promise.all([
      app.db.query("SELECT COUNT(*)::int AS total FROM eip_core.service_object WHERE tenant_id=$1 AND object_type=$2", [session.tenant_id, PURCHASE_REQUISITION_OBJECT_TYPE]),
      app.db.query("SELECT COUNT(*)::int AS total FROM eip_core.service_object WHERE tenant_id=$1 AND object_type=$2", [session.tenant_id, PURCHASE_RFQ_OBJECT_TYPE]),
      app.db.query("SELECT COUNT(*)::int AS total FROM eip_core.service_object WHERE tenant_id=$1 AND object_type=$2", [session.tenant_id, CASH_PURCHASE_OBJECT_TYPE]),
      listSupplierLinks(app.db, session.tenant_id, {}),
      listPurchaseNeeds(app.db, session.tenant_id, { limit: 25 })
    ]);

    return reply.send({
      ok: true,
      stats: {
        supplier_links: supplierLinks.length,
        open_purchase_needs: needs.length,
        purchase_requisitions: Number(requisitions.rows[0]?.total || 0),
        rfqs: Number(rfqs.rows[0]?.total || 0),
        cash_purchases: Number(cashPurchases.rows[0]?.total || 0)
      },
      purchase_needs: needs.map((item) => ({
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

  app.get("/lookup", async (req, reply) => {
    const session = await requireRead(app, req, reply, "PROCUREMENT_READ");
    if (!session) return;
    const kind = normalizeStatus(req.query?.kind || "material");
    const q = normalizeOptionalText(req.query?.q);
    const limit = clampLimit(req.query?.limit || 25);
    const needle = q ? `%${q}%` : "%";
    if (["supplier", "suppliers", "agent", "agents"].includes(kind)) {
      const result = await app.db.query(
        `
        SELECT id, code, name, agent_type
        FROM eip_core.agent
        WHERE tenant_id=$1
          AND is_active=true
          AND (code ILIKE $2 OR name ILIKE $2 OR agent_type ILIKE $2)
        ORDER BY name NULLS LAST, code NULLS LAST
        LIMIT $3
        `,
        [session.tenant_id, needle, limit]
      );
      return reply.send({ ok: true, kind: "supplier", items: result.rows.map(serializeAgent) });
    }

    const result = await app.db.query(
      `
      SELECT id, code, name, material_type, attrs
      FROM eip_core.material
      WHERE tenant_id=$1
        AND is_active=true
        AND (code ILIKE $2 OR name ILIKE $2 OR material_type ILIKE $2)
      ORDER BY name NULLS LAST, code NULLS LAST
      LIMIT $3
      `,
      [session.tenant_id, needle, limit]
    );
    return reply.send({ ok: true, kind: "material", items: result.rows.map(serializeMaterial) });
  });

  app.get("/purchase-needs/:id/workbench", async (req, reply) => {
    const session = await requireRead(app, req, reply, "PROCUREMENT_READ");
    if (!session) return;
    const result = await buildPurchaseNeedWorkbench(app.db, app, session.tenant_id, req.params.id);
    if (!result.ok) return reply.code(result.status || 404).send({ ok: false, error: result.error });
    return reply.send(result);
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

    return withTransaction(app, session, reply, "procurement_supplier_link_create_error", "SUPPLIER_LINK_CREATE_FAILED", async (client) => {
      const result = await createSupplierLink(client, {
        tenantId: session.tenant_id,
        materialId,
        supplierAgentId,
        body: req.body || {}
      });
      return result.ok ? { ...result, response: { ok: true, item: result.item } } : result;
    });
  });

  app.patch("/supplier-links/:id", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "SUPPLIER_LINK_WRITE");
    if (!session) return;
    const result = await updateSupplierLink(app.db, {
      tenantId: session.tenant_id,
      linkId: req.params.id,
      body: req.body || {}
    });
    if (!result.ok) return reply.code(result.status || 404).send({ ok: false, error: result.error });
    return reply.send({ ok: true, item: result.item });
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

    return withTransaction(app, session, reply, "procurement_requisition_from_reorder_error", "REQUISITION_CREATE_FAILED", (client) => buildRequisitionFromReorder(client, app, {
      tenantId: session.tenant_id,
      identityId: session.identity_id,
      reorderSuggestionId
    }));
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
      return withTransaction(app, session, reply, "procurement_requisition_action_error", "REQUISITION_ACTION_FAILED", (client) => advanceObject(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        id: req.params.id,
        objectType: PURCHASE_REQUISITION_OBJECT_TYPE,
        action,
        payload: req.body || {},
        idempotencyKey: req.body?.idempotency_key
      }));
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

    return withTransaction(app, session, reply, "procurement_rfq_from_requisition_error", "RFQ_CREATE_FAILED", (client) => createRfqFromRequisition(client, app, {
      tenantId: session.tenant_id,
      identityId: session.identity_id,
      requisitionId,
      body: req.body || {}
    }));
  });

  app.get("/rfqs/:id", async (req, reply) => {
    const session = await requireRead(app, req, reply, "PROCUREMENT_RFQ_READ");
    if (!session) return;
    const item = await fetchServiceObject(app.db, session.tenant_id, req.params.id, PURCHASE_RFQ_OBJECT_TYPE);
    if (!item) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const quotes = await listQuotesForRfq(app.db, session.tenant_id, item.id);
    return reply.send({ ok: true, item, quotes });
  });

  app.post("/rfqs/:id/quotes", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "PROCUREMENT_RFQ_WRITE");
    if (!session) return;
    return withTransaction(app, session, reply, "procurement_rfq_quote_error", "RFQ_QUOTE_FAILED", (client) => addSupplierQuote(client, {
      tenantId: session.tenant_id,
      identityId: session.identity_id,
      rfqId: req.params.id,
      body: req.body || {}
    }));
  });

  app.post("/rfqs/:id/compare", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "PROCUREMENT_QUOTE_REVIEW");
    if (!session) return;
    return withTransaction(app, session, reply, "procurement_rfq_compare_error", "RFQ_COMPARE_FAILED", async (client) => {
      const result = await compareRfqQuotes(client, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        rfqId: req.params.id
      });
      return result.ok ? { ...result, response: { ok: true, item: result.item, comparison: result.comparison } } : result;
    });
  });

  app.post("/rfqs/:id/approve-quote", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "PROCUREMENT_QUOTE_REVIEW");
    if (!session) return;
    return withTransaction(app, session, reply, "procurement_quote_approve_error", "QUOTE_APPROVE_FAILED", (client) => advanceObject(client, app, {
      tenantId: session.tenant_id,
      identityId: session.identity_id,
      id: req.params.id,
      objectType: PURCHASE_RFQ_OBJECT_TYPE,
      action: "approve_quote",
      payload: req.body || {},
      idempotencyKey: req.body?.idempotency_key
    }));
  });

  app.post("/cash-purchases", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "PROCUREMENT_CASH_PURCHASE");
    if (!session) return;
    const materialId = normalizeOptionalText(req.body?.material_id);
    const quantity = Number(req.body?.quantity || req.body?.received_qty || 0);
    if (!materialId || !Number.isFinite(quantity) || quantity <= 0) return reply.code(400).send({ ok: false, error: "MATERIAL_AND_QUANTITY_REQUIRED" });

    return withTransaction(app, session, reply, "procurement_cash_purchase_error", "CASH_PURCHASE_FAILED", async (client) => {
      const result = await recordCashPurchase(client, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        body: req.body || {}
      });
      return result.ok ? { ...result, response: { ok: true, item: result.item, receipt: result.receipt } } : result;
    });
  });
}

export {
  CASH_PURCHASE_OBJECT_TYPE,
  PURCHASE_REQUISITION_OBJECT_TYPE,
  PURCHASE_RFQ_OBJECT_TYPE,
  SUPPLIER_LINK_RELATION,
  SUPPLIER_QUOTE_RECORD_TYPE
};
