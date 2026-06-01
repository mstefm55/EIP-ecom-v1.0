import { hasPermission } from "../auth/perm.js";
import { sha256Hex } from "../auth/crypto.js";

const MAX_LIMIT = 200;
const CRM_OBJECT_TYPES = new Set(["CRM_LEAD", "CRM_INTERACTION", "CRM_CASE", "CRM_OPPORTUNITY"]);
const NOTE_TYPES = new Set([
  "CRM_NOTE",
  "CRM_CALL_LOG",
  "CRM_EMAIL_LOG",
  "CRM_MEETING_LOG",
  "CRM_ACTIVITY_LOG"
]);
const CRM_PERMISSIONS = [
  "CRM_AGENT_READ",
  "CRM_AGENT_WRITE",
  "CRM_LEAD_READ",
  "CRM_LEAD_WRITE",
  "CRM_LEAD_CONVERT",
  "CRM_INTERACTION_READ",
  "CRM_INTERACTION_WRITE",
  "CRM_CASE_READ",
  "CRM_CASE_WRITE",
  "CRM_OPPORTUNITY_READ",
  "CRM_OPPORTUNITY_WRITE",
  "CRM_TASK_READ",
  "CRM_TASK_WRITE",
  "CRM_DASHBOARD_READ",
  "CRM_TIMELINE_READ",
  "CRM_NOTE_WRITE"
];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value) {
  const text = normalizeText(value);
  return text.length ? text : null;
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase();
}

function clampLimit(value) {
  const parsed = Number(value || 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function buildIdempotencyKey(prefix, payload) {
  return sha256Hex(`${prefix}:${JSON.stringify(payload || {})}`);
}

async function requirePerm(app, req, reply, permissionCode) {
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

  const allowed = await hasPermission(
    app,
    sessionResult.session.tenant_id,
    sessionResult.session.identity_id,
    permissionCode
  );
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

async function ensureAgent(client, tenantId, agentId) {
  if (!agentId) return null;
  const result = await client.query(
    `SELECT id, agent_type, code, name, attrs FROM eip_core.agent WHERE tenant_id=$1 AND id=$2`,
    [tenantId, agentId]
  );
  return result.rows[0] || null;
}

async function ensureServiceObject(client, tenantId, serviceObjectId, objectType) {
  const result = await client.query(
    `
    SELECT id, object_type, status, title, attrs, owner_agent_id, created_at, updated_at
    FROM eip_core.service_object
    WHERE tenant_id=$1 AND id=$2
      AND ($3::text IS NULL OR object_type=$3)
    `,
    [tenantId, serviceObjectId, objectType || null]
  );
  return result.rows[0] || null;
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

async function startObjectProcess(client, app, input) {
  const binding = await resolveProcessBinding(client, input.tenantId, input.objectType);
  if (!binding) return { ok: false, error: "PROCESS_BINDING_REQUIRED" };
  return app.coreProcess.createInstance(client, {
    tenantId: input.tenantId,
    identityId: input.identityId,
    serviceObject: input.serviceObject,
    processDefId: binding.process_def_id
  });
}

async function advanceObjectProcess(client, app, input) {
  const instanceResult = await ensureProcessInstance(client, app, input);
  if (!instanceResult.ok) return instanceResult;
  return app.coreProcess.advanceInstance(client, {
    tenantId: input.tenantId,
    identityId: input.identityId,
    instanceId: instanceResult.instance.id,
    action: input.action,
    payload: input.payload,
    idempotencyKey:
      normalizeOptionalText(input.idempotencyKey) ||
      buildIdempotencyKey(`crm:${input.objectType}:${input.action}`, {
        service_object_id: input.serviceObjectId,
        payload: input.payload
      })
  });
}

async function loadParties(client, tenantId, serviceObjectId) {
  const result = await client.query(
    `
    SELECT sop.agent_id, sop.role, sop.attrs, sop.created_at,
           a.agent_type, a.name
    FROM eip_core.service_object_party sop
    JOIN eip_core.agent a
      ON a.tenant_id=sop.tenant_id AND a.id=sop.agent_id
    WHERE sop.tenant_id=$1 AND sop.service_object_id=$2
    ORDER BY sop.created_at ASC
    `,
    [tenantId, serviceObjectId]
  );
  return result.rows;
}

async function assertTimelineTarget(client, tenantId, objectKind, objectId) {
  if (objectKind === "agent") return ensureAgent(client, tenantId, objectId);
  if (objectKind === "service_object") return ensureServiceObject(client, tenantId, objectId, null);
  if (objectKind === "task") {
    const result = await client.query(
      `SELECT id, service_object_id, task_type, status, title FROM eip_core.task WHERE tenant_id=$1 AND id=$2`,
      [tenantId, objectId]
    );
    return result.rows[0] || null;
  }
  return null;
}

function toTimelineItem(kind, row, occurredAt) {
  return { kind, ...row, occurred_at: occurredAt };
}

export default async function registerCrmCompletionRoutes(app) {
  app.get(
    "/governance/options",
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_DASHBOARD_READ");
      if (!session) return;
      const result = await app.db.query(
        `
        WITH lists AS (
          SELECT DISTINCT ON (code) id, code
          FROM eip_core.dropdown_list
          WHERE is_active=true
            AND (tenant_id=$1 OR tenant_id IS NULL)
            AND code = ANY($2::text[])
          ORDER BY code, (tenant_id IS NOT NULL) DESC, version DESC
        )
        SELECT lists.code AS list_code, dv.code, dv.label, dv.sort_order, dv.attrs
        FROM lists
        JOIN eip_core.dropdown_value dv ON dv.list_id=lists.id AND dv.is_active=true
        ORDER BY lists.code, dv.sort_order, dv.code
        `,
        [
          session.tenant_id,
          [
            "CRM_LEAD_STATUS",
            "CRM_CASE_STATUS",
            "CRM_OPPORTUNITY_STATUS",
            "CRM_PRIORITY",
            "CRM_INTERACTION_CHANNEL",
            "CRM_INTERACTION_DIRECTION",
            "CRM_TASK_TYPE",
            "CRM_SOURCE",
            "CRM_REASON_LOST",
            "TASK_STATUS"
          ]
        ]
      );
      const options = {};
      for (const item of result.rows) {
        options[item.list_code] = options[item.list_code] || [];
        options[item.list_code].push(item);
      }
      const permissions = [];
      for (const code of CRM_PERMISSIONS) {
        if (await hasPermission(app, session.tenant_id, session.identity_id, code)) permissions.push(code);
      }
      return reply.send({ ok: true, options, permissions });
    }
  );

  app.post(
    "/leads",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            customer_agent_id: { type: "string", minLength: 36, maxLength: 36 },
            owner_agent_id: { type: "string", minLength: 36, maxLength: 36 },
            title: { type: "string", maxLength: 200 },
            description: { type: "string", maxLength: 2000 },
            source: { type: "string", maxLength: 80 },
            priority: { type: "string", maxLength: 50 },
            next_follow_up_at: { type: "string", maxLength: 40 },
            attrs: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_LEAD_WRITE");
      if (!session) return;
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const body = req.body || {};
        const customerAgentId = normalizeOptionalText(body.customer_agent_id);
        const ownerAgentId =
          normalizeOptionalText(body.owner_agent_id) ||
          (await getPrimaryAgentId(client, session.tenant_id, session.identity_id));
        if (customerAgentId && !(await ensureAgent(client, session.tenant_id, customerAgentId))) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "CUSTOMER_NOT_FOUND" });
        }
        if (ownerAgentId && !(await ensureAgent(client, session.tenant_id, ownerAgentId))) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "OWNER_NOT_FOUND" });
        }

        const started = await startObjectProcess(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          objectType: "CRM_LEAD",
          serviceObject: {
            object_type: "CRM_LEAD",
            status: "new",
            title: normalizeOptionalText(body.title) || "Lead",
            attrs: {
              ...(body.attrs || {}),
              description: normalizeOptionalText(body.description),
              source: normalizeOptionalText(body.source),
              priority: normalizeOptionalText(body.priority),
              next_follow_up_at: normalizeOptionalText(body.next_follow_up_at)
            },
            owner_agent_id: ownerAgentId,
            parties: [
              ...(customerAgentId ? [{ role: "PROSPECT", agent_id: customerAgentId }] : []),
              ...(ownerAgentId ? [{ role: "OWNER", agent_id: ownerAgentId }] : [])
            ]
          }
        });
        if (!started.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: started.error });
        }
        await client.query("COMMIT");
        return reply.send({ ok: true, item: started.service_object });
      } catch (error) {
        await client.query("ROLLBACK");
        app.log.error({ event: "crm_lead_create_error", tenantId: session.tenant_id, error: error.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/leads",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string", maxLength: 50 },
            owner_agent_id: { type: "string", minLength: 36, maxLength: 36 },
            q: { type: "string", maxLength: 200 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_LEAD_READ");
      if (!session) return;
      const params = [session.tenant_id];
      const filters = ["tenant_id=$1", "object_type='CRM_LEAD'"];
      if (normalizeOptionalText(req.query?.status)) {
        params.push(normalizeStatus(req.query.status));
        filters.push(`status=$${params.length}`);
      }
      if (normalizeOptionalText(req.query?.owner_agent_id)) {
        params.push(normalizeText(req.query.owner_agent_id));
        filters.push(`owner_agent_id=$${params.length}`);
      }
      if (normalizeOptionalText(req.query?.q)) {
        params.push(`%${normalizeText(req.query.q)}%`);
        filters.push(`(title ILIKE $${params.length} OR COALESCE(attrs->>'description','') ILIKE $${params.length})`);
      }
      params.push(clampLimit(req.query?.limit), Number(req.query?.offset || 0));
      const result = await app.db.query(
        `
        SELECT id, object_type, status, title, attrs, owner_agent_id, created_at, updated_at
        FROM eip_core.service_object
        WHERE ${filters.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );
      return reply.send({ ok: true, items: result.rows, limit: params.at(-2), offset: params.at(-1) });
    }
  );

  app.get("/leads/:id", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_LEAD_READ");
    if (!session) return;
    const item = await ensureServiceObject(app.db, session.tenant_id, req.params.id, "CRM_LEAD");
    if (!item) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({
      ok: true,
      item,
      parties: await loadParties(app.db, session.tenant_id, req.params.id)
    });
  });

  app.patch("/leads/:id", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_LEAD_WRITE");
    if (!session) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      if (!(await ensureServiceObject(client, session.tenant_id, req.params.id, "CRM_LEAD"))) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      }
      const attrs = { ...(req.body?.attrs || {}) };
      for (const key of ["description", "source", "priority", "next_follow_up_at"]) {
        if (req.body?.[key] !== undefined) attrs[key] = normalizeOptionalText(req.body[key]);
      }
      const payload = {
        title: normalizeOptionalText(req.body?.title),
        attrs,
        owner_agent_id: normalizeOptionalText(req.body?.owner_agent_id)
      };
      const advanced = await advanceObjectProcess(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        serviceObjectId: req.params.id,
        objectType: "CRM_LEAD",
        action: "update",
        payload,
        idempotencyKey: req.body?.idempotency_key
      });
      if (!advanced.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: advanced.error });
      }
      await client.query("COMMIT");
      return reply.send({ ok: true, reused: advanced.reused === true });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_lead_update_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.post("/leads/:id/status", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_LEAD_WRITE");
    if (!session) return;
    const status = normalizeStatus(req.body?.to_status);
    if (!status) return reply.code(400).send({ ok: false, error: "STATUS_REQUIRED" });
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      if (!(await ensureServiceObject(client, session.tenant_id, req.params.id, "CRM_LEAD"))) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      }
      const advanced = await advanceObjectProcess(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        serviceObjectId: req.params.id,
        objectType: "CRM_LEAD",
        action: status,
        payload: {
          to_status: status,
          reason_code: normalizeOptionalText(req.body?.reason_code),
          note: normalizeOptionalText(req.body?.note)
        },
        idempotencyKey: req.body?.idempotency_key
      });
      if (!advanced.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: advanced.error });
      }
      await client.query("COMMIT");
      return reply.send({ ok: true, reused: advanced.reused === true });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_lead_status_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.post("/leads/:id/tasks", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_TASK_WRITE");
    if (!session) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      if (!(await ensureServiceObject(client, session.tenant_id, req.params.id, "CRM_LEAD"))) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      }
      const payload = {
        task_type: normalizeText(req.body?.task_type),
        title: normalizeOptionalText(req.body?.title),
        description: normalizeOptionalText(req.body?.description),
        assigned_agent_id: normalizeOptionalText(req.body?.assigned_agent_id),
        due_at: normalizeOptionalText(req.body?.due_at),
        attrs: req.body?.attrs || {}
      };
      if (!payload.task_type) {
        await client.query("ROLLBACK");
        return reply.code(400).send({ ok: false, error: "TASK_TYPE_REQUIRED" });
      }
      const advanced = await advanceObjectProcess(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        serviceObjectId: req.params.id,
        objectType: "CRM_LEAD",
        action: "task.create",
        payload,
        idempotencyKey: req.body?.idempotency_key
      });
      if (!advanced.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: advanced.error });
      }
      await client.query("COMMIT");
      return reply.send({ ok: true, effects: advanced.entry?.effects_applied || [], reused: advanced.reused === true });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_lead_task_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.post("/leads/:id/convert", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_LEAD_CONVERT");
    if (!session) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const lead = await ensureServiceObject(client, session.tenant_id, req.params.id, "CRM_LEAD");
      if (!lead) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      }
      let customerAgentId = normalizeOptionalText(req.body?.customer_agent_id);
      if (!customerAgentId) {
        const partyResult = await client.query(
          `
          SELECT agent_id
          FROM eip_core.service_object_party
          WHERE tenant_id=$1 AND service_object_id=$2 AND role IN ('CUSTOMER','PROSPECT')
          ORDER BY CASE role WHEN 'CUSTOMER' THEN 0 ELSE 1 END
          LIMIT 1
          `,
          [session.tenant_id, req.params.id]
        );
        customerAgentId = partyResult.rows[0]?.agent_id || null;
      }
      if (!customerAgentId || !(await ensureAgent(client, session.tenant_id, customerAgentId))) {
        await client.query("ROLLBACK");
        return reply.code(400).send({ ok: false, error: "CUSTOMER_AGENT_REQUIRED" });
      }
      const payload = {
        customer_agent_id: customerAgentId,
        opportunity_title: normalizeOptionalText(req.body?.opportunity_title) || lead.title || "Opportunity",
        value: req.body?.value ?? null,
        currency: normalizeOptionalText(req.body?.currency) || "EUR",
        probability: req.body?.probability ?? 0.5,
        expected_close_date: normalizeOptionalText(req.body?.expected_close_date),
        source: normalizeOptionalText(req.body?.source) || normalizeOptionalText(lead.attrs?.source),
        note: normalizeOptionalText(req.body?.note)
      };
      const advanced = await advanceObjectProcess(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        serviceObjectId: req.params.id,
        objectType: "CRM_LEAD",
        action: "convert",
        payload,
        idempotencyKey: req.body?.idempotency_key
      });
      if (!advanced.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: advanced.error });
      }
      const childEffect = (advanced.entry?.effects_applied || []).find(
        (effect) => effect.type === "CHILD_SERVICE_OBJECT_CREATE"
      );
      await client.query("COMMIT");
      return reply.send({
        ok: true,
        opportunity_id: childEffect?.created?.[0]?.id || null,
        reused: advanced.reused === true
      });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_lead_convert_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  for (const [routeName, objectType, permission] of [
    ["cases", "CRM_CASE", "CRM_CASE_WRITE"],
    ["opportunities", "CRM_OPPORTUNITY", "CRM_OPPORTUNITY_WRITE"]
  ]) {
    app.patch(`/${routeName}/:id`, async (req, reply) => {
      const session = await requirePerm(app, req, reply, permission);
      if (!session) return;
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        if (!(await ensureServiceObject(client, session.tenant_id, req.params.id, objectType))) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
        }
        const payload = {
          title: normalizeOptionalText(req.body?.title),
          attrs: req.body?.attrs || {},
          owner_agent_id: normalizeOptionalText(req.body?.owner_agent_id)
        };
        const advanced = await advanceObjectProcess(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          serviceObjectId: req.params.id,
          objectType,
          action: "update",
          payload,
          idempotencyKey: req.body?.idempotency_key
        });
        if (!advanced.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: advanced.error });
        }
        await client.query("COMMIT");
        return reply.send({ ok: true, reused: advanced.reused === true });
      } catch (error) {
        await client.query("ROLLBACK");
        app.log.error({ event: "crm_object_update_error", objectType, tenantId: session.tenant_id, error: error.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    });
  }

  app.post("/notes", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_NOTE_WRITE");
    if (!session) return;
    const objectKind = normalizeText(req.body?.object_kind).toLowerCase();
    const objectId = normalizeOptionalText(req.body?.object_id);
    const recordType = normalizeText(req.body?.record_type || "CRM_NOTE").toUpperCase();
    if (!objectId || !NOTE_TYPES.has(recordType)) {
      return reply.code(400).send({ ok: false, error: "NOTE_INPUT_INVALID" });
    }
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      if (!(await assertTimelineTarget(client, session.tenant_id, objectKind, objectId))) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "TARGET_NOT_FOUND" });
      }
      const actorAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
      const result = await client.query(
        `
        INSERT INTO eip_core.info_record
          (tenant_id, record_type, title, description, payload, attrs, created_by_agent_id)
        VALUES
          ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)
        RETURNING id, record_type, title, description, payload, attrs, created_at
        `,
        [
          session.tenant_id,
          recordType,
          normalizeOptionalText(req.body?.title) || "Note",
          normalizeOptionalText(req.body?.description),
          JSON.stringify(req.body?.payload || {}),
          JSON.stringify(req.body?.attrs || {}),
          actorAgentId
        ]
      );
      await client.query(
        `
        INSERT INTO eip_core.object_link
          (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs)
        VALUES
          ($1,$2,$3,'info_record',$4,'NOTE','{}'::jsonb)
        ON CONFLICT DO NOTHING
        `,
        [session.tenant_id, objectKind, objectId, result.rows[0].id]
      );
      await client.query("COMMIT");
      return reply.send({ ok: true, item: result.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_note_create_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.get("/timeline", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_TIMELINE_READ");
    if (!session) return;
    const objectKind = normalizeText(req.query?.object_kind).toLowerCase();
    const objectId = normalizeOptionalText(req.query?.object_id);
    const limit = clampLimit(req.query?.limit);
    if (!objectId || !(await assertTimelineTarget(app.db, session.tenant_id, objectKind, objectId))) {
      return reply.code(404).send({ ok: false, error: "TARGET_NOT_FOUND" });
    }

    const notes = await app.db.query(
      `
      SELECT ir.id, ir.record_type, ir.title, ir.description, ir.payload, ir.attrs, ir.created_by_agent_id, ir.created_at
      FROM eip_core.object_link ol
      JOIN eip_core.info_record ir
        ON ir.tenant_id=ol.tenant_id AND ir.id=ol.dst_id
      WHERE ol.tenant_id=$1 AND ol.src_kind=$2 AND ol.src_id=$3
        AND ol.dst_kind='info_record' AND ol.relation_type='NOTE' AND ol.is_active=true
      ORDER BY ir.created_at DESC
      LIMIT $4
      `,
      [session.tenant_id, objectKind, objectId, limit]
    );
    const items = notes.rows.map((row) => toTimelineItem("note", row, row.created_at));

    if (objectKind === "service_object") {
      const [statusEvents, tasks, taskEvents] = await Promise.all([
        app.db.query(
          `
          SELECT id, from_status, to_status, reason_code, note, actor_agent_id, attrs, occurred_at
          FROM eip_core.service_object_status_event
          WHERE tenant_id=$1 AND service_object_id=$2
          ORDER BY occurred_at DESC LIMIT $3
          `,
          [session.tenant_id, objectId, limit]
        ),
        app.db.query(
          `
          SELECT id, task_type, status, title, assigned_agent_id, due_at, attrs, created_at
          FROM eip_core.task
          WHERE tenant_id=$1 AND service_object_id=$2
          ORDER BY created_at DESC LIMIT $3
          `,
          [session.tenant_id, objectId, limit]
        ),
        app.db.query(
          `
          SELECT tse.id, tse.task_id, tse.from_status, tse.to_status, tse.reason_code,
                 tse.note, tse.actor_agent_id, tse.attrs, tse.occurred_at
          FROM eip_core.task_status_event tse
          JOIN eip_core.task t ON t.tenant_id=tse.tenant_id AND t.id=tse.task_id
          WHERE tse.tenant_id=$1 AND t.service_object_id=$2
          ORDER BY tse.occurred_at DESC LIMIT $3
          `,
          [session.tenant_id, objectId, limit]
        )
      ]);
      items.push(
        ...statusEvents.rows.map((row) => toTimelineItem("service_object_status", row, row.occurred_at)),
        ...tasks.rows.map((row) => toTimelineItem("task", row, row.created_at)),
        ...taskEvents.rows.map((row) => toTimelineItem("task_status", row, row.occurred_at))
      );
    }

    items.sort((a, b) => String(b.occurred_at || "").localeCompare(String(a.occurred_at || "")));
    return reply.send({ ok: true, items: items.slice(0, limit) });
  });

  app.get("/agents/:id/overview", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_AGENT_READ");
    if (!session) return;
    const item = await ensureAgent(app.db, session.tenant_id, req.params.id);
    if (!item) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const [contacts, addresses, bankAccounts, serviceObjects] = await Promise.all([
      app.db.query(`SELECT * FROM eip_core.entity_contact WHERE tenant_id=$1 AND entity_id=$2 ORDER BY created_at DESC`, [session.tenant_id, item.id]),
      app.db.query(`SELECT * FROM eip_core.entity_address WHERE tenant_id=$1 AND entity_id=$2 ORDER BY created_at DESC`, [session.tenant_id, item.id]),
      app.db.query(
        `
        SELECT id, account_type, label, bank_name, account_name,
               CASE WHEN account_number IS NULL THEN NULL ELSE '****' || right(account_number, 4) END AS account_number_masked,
               CASE WHEN iban IS NULL THEN NULL ELSE '****' || right(iban, 4) END AS iban_masked,
               swift_bic, currency_code, is_primary, is_active, attrs, created_at, updated_at
        FROM eip_core.entity_bank_account
        WHERE tenant_id=$1 AND entity_id=$2
        ORDER BY created_at DESC
        `,
        [session.tenant_id, item.id]
      ),
      app.db.query(
        `
        SELECT so.id, so.object_type, so.status, so.title, so.attrs, so.owner_agent_id, so.created_at
        FROM eip_core.service_object_party sop
        JOIN eip_core.service_object so ON so.tenant_id=sop.tenant_id AND so.id=sop.service_object_id
        WHERE sop.tenant_id=$1 AND sop.agent_id=$2
        ORDER BY so.created_at DESC
        `,
        [session.tenant_id, item.id]
      )
    ]);
    return reply.send({
      ok: true,
      item,
      contacts: contacts.rows,
      addresses: addresses.rows,
      bank_accounts: bankAccounts.rows,
      service_objects: serviceObjects.rows
    });
  });

  app.get("/dashboard/overview", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_DASHBOARD_READ");
    if (!session) return;
    const tenantId = session.tenant_id;
    const [leadCounts, opportunityTotals, caseCounts, taskCounts, recentActivities, recentNotes, topAgents] =
      await Promise.all([
        app.db.query(
          `
          SELECT status, count(*)::int AS count
          FROM eip_core.service_object
          WHERE tenant_id=$1 AND object_type='CRM_LEAD'
          GROUP BY status
          `,
          [tenantId]
        ),
        app.db.query(
          `
          WITH opportunities AS (
            SELECT status,
              CASE
                WHEN COALESCE(attrs->>'value','') ~ '^[0-9]+([.][0-9]+)?$' THEN (attrs->>'value')::numeric
                WHEN COALESCE(attrs#>>'{value,amount}','') ~ '^[0-9]+([.][0-9]+)?$' THEN (attrs#>>'{value,amount}')::numeric
                ELSE 0
              END AS value,
              CASE
                WHEN COALESCE(attrs->>'probability','') ~ '^[0-9]+([.][0-9]+)?$' THEN (attrs->>'probability')::numeric
                ELSE 0
              END AS probability
            FROM eip_core.service_object
            WHERE tenant_id=$1 AND object_type='CRM_OPPORTUNITY'
          )
          SELECT
            count(*) FILTER (WHERE status NOT IN ('won','lost'))::int AS open,
            COALESCE(sum(value) FILTER (WHERE status NOT IN ('won','lost')),0)::numeric AS pipeline_value,
            COALESCE(sum(value * probability) FILTER (WHERE status NOT IN ('won','lost')),0)::numeric AS weighted_pipeline_value,
            COALESCE(sum(value) FILTER (WHERE status='won'),0)::numeric AS won_value,
            COALESCE(sum(value) FILTER (WHERE status='lost'),0)::numeric AS lost_value
          FROM opportunities
          `,
          [tenantId]
        ),
        app.db.query(
          `
          SELECT count(*) FILTER (WHERE status NOT IN ('resolved','closed','cancelled'))::int AS open
          FROM eip_core.service_object
          WHERE tenant_id=$1 AND object_type='CRM_CASE'
          `,
          [tenantId]
        ),
        app.db.query(
          `
          SELECT
            count(*) FILTER (WHERE status NOT IN ('done','cancelled') AND due_at::date=current_date)::int AS due_today,
            count(*) FILTER (WHERE status NOT IN ('done','cancelled') AND due_at < now())::int AS overdue
          FROM eip_core.task
          WHERE tenant_id=$1
          `,
          [tenantId]
        ),
        app.db.query(
          `
          SELECT id, record_type, title, description, created_at
          FROM eip_core.info_record
          WHERE tenant_id=$1 AND record_type IN ('CRM_ACTIVITY_LOG','CRM_CALL_LOG','CRM_EMAIL_LOG','CRM_MEETING_LOG')
          ORDER BY created_at DESC LIMIT 10
          `,
          [tenantId]
        ),
        app.db.query(
          `
          SELECT id, record_type, title, description, created_at
          FROM eip_core.info_record
          WHERE tenant_id=$1 AND record_type IN ('CRM_NOTE','CRM_SEGMENT_NOTE')
          ORDER BY created_at DESC LIMIT 10
          `,
          [tenantId]
        ),
        app.db.query(
          `
          SELECT a.id, a.agent_type, a.name, count(sop.id)::int AS activity_count
          FROM eip_core.agent a
          JOIN eip_core.service_object_party sop ON sop.tenant_id=a.tenant_id AND sop.agent_id=a.id
          WHERE a.tenant_id=$1
          GROUP BY a.id, a.agent_type, a.name
          ORDER BY activity_count DESC, a.name ASC
          LIMIT 10
          `,
          [tenantId]
        )
      ]);

    const leads = Object.fromEntries(leadCounts.rows.map((item) => [item.status, Number(item.count)]));
    const leadTotal = Object.values(leads).reduce((sum, count) => sum + count, 0);
    const convertedLeads = Number(leads.converted || 0);
    return reply.send({
      ok: true,
      kpis: {
        new_leads: Number(leads.new || 0),
        open_leads: Number(leads.new || 0) + Number(leads.contacted || 0) + Number(leads.qualified || 0),
        qualified_leads: Number(leads.qualified || 0),
        converted_leads: convertedLeads,
        conversion_rate: leadTotal ? convertedLeads / leadTotal : 0,
        open_opportunities: Number(opportunityTotals.rows[0]?.open || 0),
        pipeline_value: Number(opportunityTotals.rows[0]?.pipeline_value || 0),
        weighted_pipeline_value: Number(opportunityTotals.rows[0]?.weighted_pipeline_value || 0),
        won_value: Number(opportunityTotals.rows[0]?.won_value || 0),
        lost_value: Number(opportunityTotals.rows[0]?.lost_value || 0),
        open_cases: Number(caseCounts.rows[0]?.open || 0),
        overdue_follow_ups: Number(taskCounts.rows[0]?.overdue || 0),
        tasks_due_today: Number(taskCounts.rows[0]?.due_today || 0)
      },
      recent_activities: recentActivities.rows,
      recent_notes: recentNotes.rows,
      top_agents: topAgents.rows
    });
  });
}
