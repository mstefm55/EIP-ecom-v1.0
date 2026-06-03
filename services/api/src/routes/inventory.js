import { randomBytes } from "node:crypto";
import { hasPermission } from "../auth/perm.js";
import { sha256Hex } from "../auth/crypto.js";
import {
  applyInventoryMovement,
  buildReorderSuggestionPayload,
  mergeInventoryPolicy,
  normalizeInventoryProfile,
  normalizeInventoryTaskType,
  normalizeMovement,
  normalizeReorderStatus
} from "../services/inventory/inventoryFoundation.js";

const MAX_LIMIT = 200;
const REORDER_OBJECT_TYPE = "INVENTORY_REORDER_SUGGESTION";
const STOCK_REVIEW_OBJECT_TYPE = "INVENTORY_STOCK_REVIEW";
const MOVEMENT_RECORD_TYPE = "INVENTORY_STOCK_MOVEMENT";
const REORDER_DECISION_RECORD_TYPE = "INVENTORY_REORDER_DECISION";
const OPEN_REORDER_STATUSES = ["open", "review", "approved"];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value) {
  const text = normalizeText(value);
  return text.length ? text : null;
}

function normalizeStatus(value, fallback = "open") {
  return normalizeReorderStatus(value, fallback);
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

function serializeMaterial(row) {
  if (!row) return null;
  const profile = normalizeInventoryProfile(row);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    material_type: row.material_type,
    attrs: row.attrs || {},
    is_active: row.is_active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
    supplier_name: row.supplier_name || null,
    stock_profile: profile
  };
}

function serializeSuggestion(row) {
  if (!row) return null;
  const attrs = row.attrs && typeof row.attrs === "object" ? row.attrs : {};
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    status: row.status,
    attrs,
    material_id: attrs.material_id || row.material_id || null,
    material_code: attrs.material_code || row.material_code || null,
    material_name: attrs.material_name || row.material_name || null,
    supplier_name: row.supplier_name || null,
    suggested_qty: Number(attrs.suggested_qty || 0),
    reason: attrs.reason || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
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
  const result = await client.query(
    `
    SELECT m.id, m.code, m.name, m.material_type, m.attrs, m.is_active, m.created_at, m.updated_at,
           supplier.name AS supplier_name
    FROM eip_core.material m
    LEFT JOIN eip_core.agent supplier
      ON supplier.tenant_id=m.tenant_id
     AND supplier.id::text = m.attrs->'inventory'->>'preferred_supplier_agent_id'
    WHERE m.tenant_id=$1
      AND m.id=$2
      AND m.is_active=true
    ${lock ? "FOR UPDATE OF m" : ""}
    `,
    [tenantId, materialId]
  );
  return result.rows[0] || null;
}

async function listMaterials(client, tenantId, query = {}) {
  const q = normalizeOptionalText(query.q);
  const params = [tenantId];
  const filters = ["m.tenant_id=$1", "m.is_active=true"];
  if (q) {
    params.push(`%${q}%`);
    filters.push(`(m.code ILIKE $${params.length} OR m.name ILIKE $${params.length} OR m.material_type ILIKE $${params.length})`);
  }

  const result = await client.query(
    `
    SELECT m.id, m.code, m.name, m.material_type, m.attrs, m.is_active, m.created_at, m.updated_at,
           supplier.name AS supplier_name
    FROM eip_core.material m
    LEFT JOIN eip_core.agent supplier
      ON supplier.tenant_id=m.tenant_id
     AND supplier.id::text = m.attrs->'inventory'->>'preferred_supplier_agent_id'
    WHERE ${filters.join(" AND ")}
    ORDER BY m.updated_at DESC, m.created_at DESC
    `,
    params
  );
  return result.rows.map(serializeMaterial);
}

async function listMovements(client, tenantId, materialId, limit = 50) {
  const result = await client.query(
    `
    SELECT id, record_type, title, description, payload, attrs, created_by_agent_id, created_at
    FROM eip_core.info_record
    WHERE tenant_id=$1
      AND record_type=$2
      AND payload->>'material_id'=$3
      AND is_active=true
    ORDER BY created_at DESC
    LIMIT $4
    `,
    [tenantId, MOVEMENT_RECORD_TYPE, materialId, clampLimit(limit)]
  );
  return result.rows || [];
}

async function fetchSuggestion(client, tenantId, suggestionId) {
  const result = await client.query(
    `
    SELECT so.id, so.code, so.title, so.status, so.attrs, so.created_at, so.updated_at,
           m.id AS material_id, m.code AS material_code, m.name AS material_name,
           supplier.name AS supplier_name
    FROM eip_core.service_object so
    LEFT JOIN eip_core.material m
      ON m.tenant_id=so.tenant_id
     AND m.id::text=so.attrs->>'material_id'
    LEFT JOIN eip_core.agent supplier
      ON supplier.tenant_id=so.tenant_id
     AND supplier.id::text=so.attrs->>'preferred_supplier_agent_id'
    WHERE so.tenant_id=$1
      AND so.id=$2
      AND so.object_type=$3
    LIMIT 1
    `,
    [tenantId, suggestionId, REORDER_OBJECT_TYPE]
  );
  return serializeSuggestion(result.rows[0]);
}

async function findOpenSuggestion(client, tenantId, materialId) {
  const result = await client.query(
    `
    SELECT id, code, title, status, attrs, created_at, updated_at
    FROM eip_core.service_object
    WHERE tenant_id=$1
      AND object_type=$2
      AND attrs->>'material_id'=$3
      AND lower(status)=ANY($4::text[])
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [tenantId, REORDER_OBJECT_TYPE, materialId, OPEN_REORDER_STATUSES]
  );
  return result.rows[0] || null;
}

async function createReorderSuggestion(client, app, input) {
  const actorAgentId = await getPrimaryAgentId(client, input.tenantId, input.identityId);
  const payload = buildReorderSuggestionPayload(input.material, input.profile, input.source);
  if (input.suggestedQty) payload.suggested_qty = input.suggestedQty;
  if (input.reason) payload.reason = input.reason;

  const code = buildCode("REORDER");
  const title = `Review reorder: ${input.material.name || input.material.code || "Material"}`;
  const so = await client.query(
    `
    INSERT INTO eip_core.service_object
      (tenant_id, object_type, status, code, title, attrs, owner_agent_id)
    VALUES
      ($1,$2,'open',$3,$4,$5::jsonb,$6)
    RETURNING id, code, title, status, attrs, created_at, updated_at
    `,
    [input.tenantId, REORDER_OBJECT_TYPE, code, title, JSON.stringify(payload), actorAgentId]
  );

  await client.query(
    `
    INSERT INTO eip_core.object_link
      (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs)
    VALUES
      ($1,'service_object',$2,'material',$3,'REORDER_FOR',$4::jsonb)
    ON CONFLICT DO NOTHING
    `,
    [
      input.tenantId,
      so.rows[0].id,
      input.material.id,
      JSON.stringify({ source: input.source || "low_stock_detection" })
    ]
  );

  const started = await ensureProcessInstance(client, app, {
    tenantId: input.tenantId,
    identityId: input.identityId,
    serviceObjectId: so.rows[0].id,
    objectType: REORDER_OBJECT_TYPE
  });
  if (!started.ok) return { ok: false, error: started.error };
  return { ok: true, item: serializeSuggestion(so.rows[0]) };
}

async function advanceSuggestion(client, app, input) {
  const suggestion = await fetchSuggestion(client, input.tenantId, input.suggestionId);
  if (!suggestion) return { ok: false, status: 404, error: "NOT_FOUND" };
  if (suggestion.status === input.doneStatus) return { ok: true, reused: true, item: suggestion };

  const instance = await ensureProcessInstance(client, app, {
    tenantId: input.tenantId,
    identityId: input.identityId,
    serviceObjectId: input.suggestionId,
    objectType: REORDER_OBJECT_TYPE
  });
  if (!instance.ok) return { ok: false, status: 409, error: instance.error };

  const payload = {
    note: normalizeOptionalText(input.note),
    reason_code: normalizeOptionalText(input.reason_code),
    decision: input.action,
    decided_at: new Date().toISOString()
  };
  const result = await app.coreProcess.advanceInstance(client, {
    tenantId: input.tenantId,
    identityId: input.identityId,
    instanceId: instance.instance.id,
    action: input.action,
    payload,
    idempotencyKey: input.idempotencyKey || buildIdempotencyKey("inventory_reorder_decision", {
      suggestion_id: input.suggestionId,
      action: input.action,
      payload
    })
  });
  if (!result.ok) return { ok: false, status: 409, error: result.error };
  return { ok: true, reused: result.reused === true, item: await fetchSuggestion(client, input.tenantId, input.suggestionId) };
}

export default async function inventoryRoutes(app) {
  app.get("/overview", async (req, reply) => {
    const session = await requireRead(app, req, reply, "INVENTORY_READ");
    if (!session) return;

    const [materials, recentMovements, reorderRes] = await Promise.all([
      listMaterials(app.db, session.tenant_id, {}),
      app.db.query(
        `
        SELECT id, title, payload, created_at
        FROM eip_core.info_record
        WHERE tenant_id=$1 AND record_type=$2 AND is_active=true
        ORDER BY created_at DESC
        LIMIT 8
        `,
        [session.tenant_id, MOVEMENT_RECORD_TYPE]
      ),
      app.db.query(
        `
        SELECT COUNT(*)::int AS total
        FROM eip_core.service_object
        WHERE tenant_id=$1
          AND object_type=$2
          AND lower(status)=ANY($3::text[])
        `,
        [session.tenant_id, REORDER_OBJECT_TYPE, ["open", "review"]]
      )
    ]);

    const profiles = materials.map((item) => item.stock_profile);
    const stockAlerts = materials.filter((item) => item.stock_profile.needs_reorder);
    const stats = {
      total_active_materials: materials.length,
      in_stock: profiles.filter((item) => item.stock_status === "in_stock").length,
      low_stock: profiles.filter((item) => item.stock_status === "low_stock").length,
      out_of_stock: profiles.filter((item) => item.stock_status === "out_of_stock").length,
      negative_stock: profiles.filter((item) => item.stock_status === "negative_stock").length,
      untracked: profiles.filter((item) => item.stock_status === "untracked").length,
      items_needing_reorder: stockAlerts.length,
      open_reorder_suggestions: Number(reorderRes.rows[0]?.total || 0)
    };

    return reply.send({
      ok: true,
      stats,
      stock_alerts: stockAlerts.slice(0, 12),
      recent_movements: recentMovements.rows || []
    });
  });

  app.get("/materials", async (req, reply) => {
    const session = await requireRead(app, req, reply, "INVENTORY_READ");
    if (!session) return;

    const status = normalizeOptionalText(req.query?.status);
    const limit = clampLimit(req.query?.limit);
    const offset = Math.max(0, Number(req.query?.offset || 0));
    const allItems = await listMaterials(app.db, session.tenant_id, { q: req.query?.q });
    const filtered = status
      ? allItems.filter((item) => item.stock_profile.stock_status === status)
      : allItems;
    return reply.send({
      ok: true,
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
      limit,
      offset
    });
  });

  app.get("/materials/:id", async (req, reply) => {
    const session = await requireRead(app, req, reply, "INVENTORY_READ");
    if (!session) return;
    const material = await fetchMaterial(app.db, session.tenant_id, req.params.id);
    if (!material) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const movements = await listMovements(app.db, session.tenant_id, material.id, 20);
    return reply.send({ ok: true, item: serializeMaterial(material), movements });
  });

  app.patch("/materials/:id/policy", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "INVENTORY_WRITE");
    if (!session) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const material = await fetchMaterial(client, session.tenant_id, req.params.id, { lock: true });
      if (!material) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      }
      const nextAttrs = mergeInventoryPolicy(material.attrs || {}, req.body || {});
      const updated = await client.query(
        `
        UPDATE eip_core.material
        SET attrs=$3::jsonb, updated_at=now()
        WHERE tenant_id=$1 AND id=$2
        RETURNING id, code, name, material_type, attrs, is_active, created_at, updated_at
        `,
        [session.tenant_id, material.id, JSON.stringify(nextAttrs)]
      );
      const actorAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
      await client.query(
        `
        INSERT INTO eip_core.info_record
          (tenant_id, record_type, title, payload, attrs, created_by_agent_id)
        VALUES
          ($1,'INVENTORY_POLICY_UPDATED',$2,$3::jsonb,$4::jsonb,$5)
        `,
        [
          session.tenant_id,
          `Inventory policy updated: ${material.name || material.code || material.id}`,
          JSON.stringify({ material_id: material.id, policy: nextAttrs.inventory || {} }),
          JSON.stringify({ module: "inventory", source: "inventory_policy_update" }),
          actorAgentId
        ]
      );
      await client.query("COMMIT");
      return reply.send({ ok: true, item: serializeMaterial(updated.rows[0]) });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "inventory_policy_update_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "INVENTORY_POLICY_UPDATE_FAILED" });
    } finally {
      client.release();
    }
  });

  app.get("/materials/:id/movements", async (req, reply) => {
    const session = await requireRead(app, req, reply, "INVENTORY_READ");
    if (!session) return;
    const material = await fetchMaterial(app.db, session.tenant_id, req.params.id);
    if (!material) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const movements = await listMovements(app.db, session.tenant_id, material.id, req.query?.limit);
    return reply.send({ ok: true, items: movements });
  });

  app.post("/materials/:id/movements", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "INVENTORY_ADJUST");
    if (!session) return;
    const normalized = normalizeMovement(req.body || {});
    if (!normalized.ok) return reply.code(400).send({ ok: false, error: normalized.error });

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const material = await fetchMaterial(client, session.tenant_id, req.params.id, { lock: true });
      if (!material) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      }
      const applied = applyInventoryMovement(material.attrs || {}, normalized.movement);
      const updated = await client.query(
        `
        UPDATE eip_core.material
        SET attrs=$3::jsonb, updated_at=now()
        WHERE tenant_id=$1 AND id=$2
        RETURNING id, code, name, material_type, attrs, is_active, created_at, updated_at
        `,
        [session.tenant_id, material.id, JSON.stringify(applied.attrs)]
      );
      const actorAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
      const movementPayload = {
        ...applied.movement_record,
        material_id: material.id,
        material_code: material.code || null,
        material_name: material.name || null
      };
      const movementRecord = await client.query(
        `
        INSERT INTO eip_core.info_record
          (tenant_id, record_type, title, description, payload, attrs, created_by_agent_id)
        VALUES
          ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)
        RETURNING id, record_type, title, payload, attrs, created_at
        `,
        [
          session.tenant_id,
          MOVEMENT_RECORD_TYPE,
          `${movementPayload.movement_type}: ${material.name || material.code || material.id}`,
          movementPayload.reason,
          JSON.stringify(movementPayload),
          JSON.stringify({ module: "inventory", source: "manual_stock_movement" }),
          actorAgentId
        ]
      );
      await client.query("COMMIT");
      return reply.send({
        ok: true,
        item: movementRecord.rows[0],
        material: serializeMaterial(updated.rows[0])
      });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "inventory_movement_create_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "INVENTORY_MOVEMENT_FAILED" });
    } finally {
      client.release();
    }
  });

  app.get("/reorder-suggestions", async (req, reply) => {
    const session = await requireRead(app, req, reply, "INVENTORY_REORDER_READ");
    if (!session) return;
    const status = normalizeOptionalText(req.query?.status);
    const q = normalizeOptionalText(req.query?.q);
    const params = [session.tenant_id, REORDER_OBJECT_TYPE];
    const filters = ["so.tenant_id=$1", "so.object_type=$2"];
    if (status) {
      params.push(normalizeStatus(status));
      filters.push(`lower(so.status)=$${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      filters.push(`(so.code ILIKE $${params.length} OR so.title ILIKE $${params.length} OR COALESCE(m.name,'') ILIKE $${params.length} OR COALESCE(m.code,'') ILIKE $${params.length})`);
    }
    params.push(clampLimit(req.query?.limit), Math.max(0, Number(req.query?.offset || 0)));
    const result = await app.db.query(
      `
      SELECT so.id, so.code, so.title, so.status, so.attrs, so.created_at, so.updated_at,
             m.id AS material_id, m.code AS material_code, m.name AS material_name,
             supplier.name AS supplier_name
      FROM eip_core.service_object so
      LEFT JOIN eip_core.material m
        ON m.tenant_id=so.tenant_id
       AND m.id::text=so.attrs->>'material_id'
      LEFT JOIN eip_core.agent supplier
        ON supplier.tenant_id=so.tenant_id
       AND supplier.id::text=so.attrs->>'preferred_supplier_agent_id'
      WHERE ${filters.join(" AND ")}
      ORDER BY so.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params
    );
    return reply.send({ ok: true, items: result.rows.map(serializeSuggestion), limit: params.at(-2), offset: params.at(-1) });
  });

  app.post("/reorder-suggestions/run", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "INVENTORY_REORDER_WRITE");
    if (!session) return;

    const materialId = normalizeOptionalText(req.body?.material_id);
    const force = req.body?.force === true;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const materials = materialId
        ? [await fetchMaterial(client, session.tenant_id, materialId, { lock: true })].filter(Boolean)
        : await listMaterials(client, session.tenant_id, {});
      if (materialId && !materials.length) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "MATERIAL_NOT_FOUND" });
      }

      const created = [];
      const existing = [];
      const skipped = [];
      for (const item of materials) {
        const material = item.stock_profile ? {
          id: item.id,
          code: item.code,
          name: item.name,
          material_type: item.material_type,
          attrs: item.attrs || {}
        } : item;
        const profile = item.stock_profile || normalizeInventoryProfile(material);
        if (!profile.needs_reorder && !force) {
          skipped.push({ material_id: material.id, reason: "stock_not_below_reorder_point" });
          continue;
        }
        const open = await findOpenSuggestion(client, session.tenant_id, material.id);
        if (open) {
          existing.push(serializeSuggestion(open));
          continue;
        }
        const createdResult = await createReorderSuggestion(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          material,
          profile,
          source: force ? "manual_reorder_review" : "low_stock_detection",
          reason: force && !profile.needs_reorder ? "manual reorder review requested" : null,
          suggestedQty: force && !profile.suggested_qty ? profile.reorder_qty || 1 : null
        });
        if (!createdResult.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: createdResult.error });
        }
        created.push(createdResult.item);
      }

      await client.query("COMMIT");
      return reply.send({ ok: true, created, existing, skipped });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "inventory_reorder_run_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "INVENTORY_REORDER_RUN_FAILED" });
    } finally {
      client.release();
    }
  });

  app.get("/reorder-suggestions/:id", async (req, reply) => {
    const session = await requireRead(app, req, reply, "INVENTORY_REORDER_READ");
    if (!session) return;
    const item = await fetchSuggestion(app.db, session.tenant_id, req.params.id);
    if (!item) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const movements = item.material_id ? await listMovements(app.db, session.tenant_id, item.material_id, 10) : [];
    return reply.send({ ok: true, item, movements });
  });

  app.post("/reorder-suggestions/:id/approve", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "INVENTORY_REORDER_APPROVE");
    if (!session) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const result = await advanceSuggestion(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        suggestionId: req.params.id,
        action: "approve",
        doneStatus: "approved",
        note: req.body?.note,
        reason_code: req.body?.reason_code,
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
      app.log.error({ event: "inventory_reorder_approve_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "INVENTORY_REORDER_APPROVE_FAILED" });
    } finally {
      client.release();
    }
  });

  app.post("/reorder-suggestions/:id/ignore", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "INVENTORY_REORDER_WRITE");
    if (!session) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const result = await advanceSuggestion(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        suggestionId: req.params.id,
        action: "ignore",
        doneStatus: "ignored",
        note: req.body?.note,
        reason_code: req.body?.reason_code,
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
      app.log.error({ event: "inventory_reorder_ignore_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "INVENTORY_REORDER_IGNORE_FAILED" });
    } finally {
      client.release();
    }
  });

  app.post("/reorder-suggestions/:id/tasks", async (req, reply) => {
    const session = await requireWrite(app, req, reply, "INVENTORY_REORDER_WRITE");
    if (!session) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const suggestion = await fetchSuggestion(client, session.tenant_id, req.params.id);
      if (!suggestion) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      }
      const instance = await ensureProcessInstance(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        serviceObjectId: suggestion.id,
        objectType: REORDER_OBJECT_TYPE
      });
      if (!instance.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: instance.error });
      }
      const actorAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
      const taskType = normalizeInventoryTaskType(req.body?.task_type);
      const task = await client.query(
        `
        INSERT INTO eip_core.task
          (tenant_id, service_object_id, process_def_id, task_type, status, title, description, assigned_agent_id, due_at, payload, attrs)
        VALUES
          ($1,$2,$3,$4,'open',$5,$6,$7,$8,$9::jsonb,$10::jsonb)
        RETURNING id, task_type, status, title, due_at, created_at
        `,
        [
          session.tenant_id,
          suggestion.id,
          instance.instance.process_def_id,
          taskType,
          normalizeOptionalText(req.body?.title) || "Review reorder suggestion",
          normalizeOptionalText(req.body?.description || req.body?.note),
          normalizeOptionalText(req.body?.assigned_agent_id) || actorAgentId,
          normalizeOptionalText(req.body?.due_at),
          JSON.stringify({ suggestion_id: suggestion.id, material_id: suggestion.material_id }),
          JSON.stringify({ module: "inventory", source: "inventory_reorder_task" })
        ]
      );
      await client.query("COMMIT");
      return reply.send({ ok: true, item: task.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "inventory_reorder_task_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "INVENTORY_REORDER_TASK_FAILED" });
    } finally {
      client.release();
    }
  });
}

export { REORDER_DECISION_RECORD_TYPE, REORDER_OBJECT_TYPE, STOCK_REVIEW_OBJECT_TYPE };
