import { hasPermission } from "../auth/perm.js";
import { sha256Hex } from "../auth/crypto.js";
import {
  getMailboxAdapter,
  listMailboxAdapters,
  normalizeMailboxMessage,
  sanitizeReadableMessageText,
  summarizeMailboxMessage
} from "../services/crm/mailboxAdapters.js";
import { createIntakeProposal } from "./crm_intake.js";
import { loadCapabilities, loadConnectorReadiness, sanitizeMetadata } from "./crm_intelligence.js";

const MAX_LIMIT = 200;
const MESSAGE_STATUSES = new Set(["imported", "intake_created", "linked", "archived", "ignored"]);
const REPLY_STATUSES = new Set(["draft", "review", "approved", "send_pending", "sent", "send_failed", "cancelled"]);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value, maxLength = 500) {
  const text = normalizeText(value);
  return text ? text.slice(0, maxLength) : null;
}

function normalizeStatus(value) {
  return normalizeOptionalText(value, 80)?.toLowerCase() || null;
}

function clampLimit(value) {
  const number = Number(value || 50);
  if (!Number.isFinite(number)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, number));
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
  const allowed = await hasPermission(app, sessionResult.session.tenant_id, sessionResult.session.identity_id, permissionCode);
  if (!allowed) {
    reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    return null;
  }
  return sessionResult.session;
}

async function requireMailboxCapability(app, session, reply) {
  const capabilities = await loadCapabilities(app.db, session.tenant_id);
  if (capabilities.mailbox !== true) {
    reply.code(403).send({ ok: false, error: "CRM_CAPABILITY_DISABLED", capability: "mailbox" });
    return false;
  }
  return true;
}

async function getPrimaryAgentId(client, tenantId, identityId) {
  const result = await client.query(
    `SELECT agent_id FROM eip_auth.auth_identity_agent
     WHERE tenant_id=$1 AND identity_id=$2 AND is_primary=true AND is_active=true LIMIT 1`,
    [tenantId, identityId]
  );
  return result.rows[0]?.agent_id || null;
}

async function ensureInfoRecord(client, tenantId, recordId, recordType = null) {
  const result = await client.query(
    `SELECT id, record_type, title, description, payload, attrs, created_at, updated_at
     FROM eip_core.info_record
     WHERE tenant_id=$1 AND id=$2 AND ($3::text IS NULL OR record_type=$3) AND is_active=true`,
    [tenantId, recordId, recordType]
  );
  return result.rows[0] || null;
}

async function insertInfoRecord(client, tenantId, actorAgentId, input) {
  const result = await client.query(
    `INSERT INTO eip_core.info_record
       (tenant_id, record_type, title, description, payload, attrs, created_by_agent_id)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)
     RETURNING id, record_type, title, description, payload, attrs, created_at, updated_at`,
    [
      tenantId,
      input.record_type,
      normalizeOptionalText(input.title, 300),
      normalizeOptionalText(input.description, 1000),
      JSON.stringify(input.payload || {}),
      JSON.stringify(sanitizeMetadata(input.attrs || {})),
      actorAgentId
    ]
  );
  return result.rows[0];
}

async function updateInfoPayload(client, tenantId, recordId, recordType, patch) {
  const result = await client.query(
    `UPDATE eip_core.info_record
     SET payload=COALESCE(payload,'{}'::jsonb) || $4::jsonb, updated_at=now()
     WHERE tenant_id=$1 AND id=$2 AND record_type=$3 AND is_active=true
     RETURNING id, record_type, title, description, payload, attrs, created_at, updated_at`,
    [tenantId, recordId, recordType, JSON.stringify(patch || {})]
  );
  return result.rows[0] || null;
}

async function insertLink(client, tenantId, input) {
  const result = await client.query(
    `INSERT INTO eip_core.object_link
       (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     ON CONFLICT (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type)
     DO UPDATE SET is_active=true, attrs=EXCLUDED.attrs, updated_at=now()
     RETURNING id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs, is_active, created_at`,
    [tenantId, input.src_kind, input.src_id, input.dst_kind, input.dst_id, input.relation_type, JSON.stringify(sanitizeMetadata(input.attrs || {}))]
  );
  return result.rows[0];
}

async function loadLinks(client, tenantId, kind, id) {
  const result = await client.query(
    `SELECT id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs, created_at
     FROM eip_core.object_link
     WHERE tenant_id=$1 AND is_active=true
       AND ((src_kind=$2 AND src_id=$3) OR (dst_kind=$2 AND dst_id=$3))
     ORDER BY created_at ASC`,
    [tenantId, kind, id]
  );
  return result.rows;
}

async function resolveProcessBinding(client, tenantId, objectType) {
  const result = await client.query(
    `SELECT process_def_id FROM eip_core.process_binding
     WHERE tenant_id=$1 AND service_object_type=$2 AND is_active=true
     ORDER BY priority ASC, created_at DESC LIMIT 1`,
    [tenantId, objectType]
  );
  return result.rows[0] || null;
}

async function startProcessContext(client, app, session, input) {
  const binding = await resolveProcessBinding(client, session.tenant_id, input.object_type);
  if (!binding) return { ok: false, error: "PROCESS_BINDING_REQUIRED" };
  return app.coreProcess.createInstance(client, {
    tenantId: session.tenant_id,
    identityId: session.identity_id,
    processDefId: binding.process_def_id,
    idempotencyKey: input.idempotency_key,
    serviceObject: {
      object_type: input.object_type,
      status: input.status,
      title: input.title,
      attrs: sanitizeMetadata(input.attrs || {})
    }
  });
}

async function advanceProcessContext(client, app, session, serviceObjectId, action, payload = {}, idempotencyKey = null) {
  const instance = await app.coreProcess.findActiveInstance(client, session.tenant_id, serviceObjectId);
  if (!instance) return { ok: false, error: "PROCESS_INSTANCE_REQUIRED" };
  return app.coreProcess.advanceInstance(client, {
    tenantId: session.tenant_id,
    identityId: session.identity_id,
    instanceId: instance.id,
    action,
    payload,
    idempotencyKey: idempotencyKey || sha256Hex(`crm-mailbox:${serviceObjectId}:${action}:${JSON.stringify(payload)}`)
  });
}

async function ensureThread(client, session, actorAgentId, message) {
  const existing = await client.query(
    `SELECT id, record_type, title, description, payload, attrs, created_at, updated_at
     FROM eip_core.info_record
     WHERE tenant_id=$1 AND record_type='CRM_MAILBOX_THREAD' AND is_active=true
       AND payload->>'thread_fingerprint'=$2 LIMIT 1`,
    [session.tenant_id, message.thread_fingerprint]
  );
  if (existing.rowCount) return existing.rows[0];
  return insertInfoRecord(client, session.tenant_id, actorAgentId, {
    record_type: "CRM_MAILBOX_THREAD",
    title: message.subject || "Mailbox thread",
    description: message.redacted_snippet,
    payload: {
      provider: message.provider,
      connection_code: message.connection_code,
      provider_thread_id: message.provider_thread_id,
      thread_fingerprint: message.thread_fingerprint,
      last_message_at: message.received_at
    },
    attrs: { protected: true, source: "crm_mailbox" }
  });
}

async function ensureMessageProcess(client, app, session, messageRecord) {
  if (messageRecord.payload?.review_object_id) return { ok: true, service_object: { id: messageRecord.payload.review_object_id } };
  const started = await startProcessContext(client, app, session, {
    object_type: "CRM_MAILBOX_MESSAGE_REVIEW",
    status: "imported",
    title: messageRecord.title || "Mailbox message review",
    attrs: { mailbox_message_id: messageRecord.id, provider: messageRecord.payload?.provider },
    idempotency_key: `crm-mailbox-message:${messageRecord.id}`
  });
  if (!started.ok) return started;
  await insertLink(client, session.tenant_id, {
    src_kind: "info_record",
    src_id: messageRecord.id,
    dst_kind: "service_object",
    dst_id: started.service_object.id,
    relation_type: "MAILBOX_REVIEW_CONTEXT"
  });
  const updated = await updateInfoPayload(client, session.tenant_id, messageRecord.id, "CRM_MAILBOX_MESSAGE", {
    review_object_id: started.service_object.id
  });
  return { ok: true, service_object: started.service_object, item: updated };
}

async function createIntakeFromMailboxMessage(client, app, session, messageRecord) {
  const current = await ensureInfoRecord(client, session.tenant_id, messageRecord.id, "CRM_MAILBOX_MESSAGE");
  if (!current) return { ok: false, status: 404, error: "CRM_MAILBOX_MESSAGE_NOT_FOUND" };
  if (current.payload?.proposal_id) {
    return { ok: true, reused: true, proposal_id: current.payload.proposal_id, item: current };
  }
  const created = await createIntakeProposal(client, app, session, {
    source_type: "email",
    source_channel: current.payload?.provider || "manual",
    source_ref: `crm-mailbox:${current.payload?.fingerprint}`,
    subject: current.payload?.subject,
    body: current.payload?.body_text,
    from_name: current.payload?.from_name,
    from_email: null,
    received_at: current.payload?.received_at
  }, {
    source: "crm_mailbox",
    source_info_record_id: current.id,
    raw_relation_type: "MAILBOX_INTAKE_RAW",
    proposal_relation_type: "MAILBOX_INTAKE_PROPOSAL"
  });
  if (!created.ok) return created;
  const process = await ensureMessageProcess(client, app, session, current);
  if (!process.ok) return { ok: false, status: 409, error: process.error };
  const advanced = await advanceProcessContext(
    client,
    app,
    session,
    process.service_object.id,
    "intake_created",
    { proposal_id: created.item.id },
    sha256Hex(`crm-mailbox-message:${current.id}:intake_created`)
  );
  if (!advanced.ok) return { ok: false, status: 409, error: advanced.error };
  const updated = await updateInfoPayload(client, session.tenant_id, current.id, "CRM_MAILBOX_MESSAGE", {
    message_status: "intake_created",
    proposal_id: created.item.id,
    intake_raw_record_id: created.raw_record_id,
    review_object_id: process.service_object.id
  });
  return { ok: true, reused: created.reused === true, proposal_id: created.item.id, item: updated };
}

async function loadReplyContext(client, tenantId, replyId) {
  const item = await ensureInfoRecord(client, tenantId, replyId, "CRM_MAILBOX_REPLY_DRAFT");
  if (!item) return null;
  const links = await loadLinks(client, tenantId, "info_record", replyId);
  const review = links.find((link) => link.relation_type === "MAILBOX_REPLY_REVIEW_CONTEXT" && link.src_id === replyId);
  return { item, links, review_object_id: review?.dst_id || item.payload?.review_object_id || null };
}

function replySummary(row = {}) {
  return {
    id: row.id,
    record_type: row.record_type,
    title: row.title,
    description: row.description,
    status: row.payload?.reply_status,
    provider: row.payload?.provider,
    connection_code: row.payload?.connection_code,
    message_id: row.payload?.message_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export default async function registerCrmMailboxRoutes(app) {
  app.get("/mailbox/readiness", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_MAILBOX_READ");
    if (!session || !(await requireMailboxCapability(app, session, reply))) return;
    const connectorReadiness = await loadConnectorReadiness(app.db, session.tenant_id);
    return reply.send({
      ok: true,
      adapters: listMailboxAdapters(),
      configured_connections: connectorReadiness.items.filter((item) => {
        const mailboxKinds = ["email", "mailbox", "gmail", "microsoft_graph", "imap"];
        return mailboxKinds.includes(normalizeStatus(item.provider_category)) || mailboxKinds.includes(normalizeStatus(item.provider));
      }).map((item) => ({
        connection_code: item.connection_code,
        connection_name: item.connection_name,
        provider: item.provider,
        enabled: item.enabled,
        status: item.status,
        direction: item.direction,
        scopes: item.scopes,
        last_sync_status: item.last_sync_status,
        last_sync_at: item.last_sync_at
      })),
      provider_send_enabled: false,
      secrets_exposed: false
    });
  });

  app.get("/mailbox/messages", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_MAILBOX_READ");
    if (!session || !(await requireMailboxCapability(app, session, reply))) return;
    const params = [session.tenant_id];
    const filters = ["tenant_id=$1", "record_type='CRM_MAILBOX_MESSAGE'", "is_active=true"];
    const status = normalizeStatus(req.query?.status);
    if (status) {
      if (!MESSAGE_STATUSES.has(status)) return reply.code(400).send({ ok: false, error: "CRM_MAILBOX_MESSAGE_STATUS_INVALID" });
      params.push(status);
      filters.push(`payload->>'message_status'=$${params.length}`);
    }
    params.push(clampLimit(req.query?.limit), Math.max(0, Number(req.query?.offset || 0)));
    const result = await app.db.query(
      `SELECT id, record_type, title, description, payload, attrs, created_at, updated_at
       FROM eip_core.info_record WHERE ${filters.join(" AND ")}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return reply.send({ ok: true, items: result.rows.map(summarizeMailboxMessage), limit: params.at(-2), offset: params.at(-1) });
  });

  app.post("/mailbox/messages/import-manual", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_MAILBOX_WRITE");
    if (!session || !(await requireMailboxCapability(app, session, reply))) return;
    const normalized = normalizeMailboxMessage({ ...(req.body || {}), provider: req.body?.provider || "manual_test" });
    if (!normalized.ok) return reply.code(400).send(normalized);
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const duplicate = await client.query(
        `SELECT id, record_type, title, description, payload, attrs, created_at, updated_at
         FROM eip_core.info_record
         WHERE tenant_id=$1 AND record_type='CRM_MAILBOX_MESSAGE' AND is_active=true
           AND payload->>'fingerprint'=$2 LIMIT 1`,
        [session.tenant_id, normalized.item.fingerprint]
      );
      if (duplicate.rowCount) {
        await client.query("COMMIT");
        return reply.send({ ok: true, reused: true, item: summarizeMailboxMessage(duplicate.rows[0]) });
      }
      const actorAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
      const thread = await ensureThread(client, session, actorAgentId, normalized.item);
      const item = await insertInfoRecord(client, session.tenant_id, actorAgentId, {
        record_type: "CRM_MAILBOX_MESSAGE",
        title: normalized.item.subject || "Mailbox message",
        description: normalized.item.redacted_snippet,
        payload: normalized.item,
        attrs: { protected: true, source: "manual_test_provider" }
      });
      await insertLink(client, session.tenant_id, {
        src_kind: "info_record",
        src_id: thread.id,
        dst_kind: "info_record",
        dst_id: item.id,
        relation_type: "MAILBOX_THREAD_MESSAGE"
      });
      const created = await createIntakeFromMailboxMessage(client, app, session, item);
      if (!created.ok) {
        await client.query("ROLLBACK");
        return reply.code(created.status || 409).send({ ok: false, error: created.error });
      }
      await client.query("COMMIT");
      return reply.send({ ok: true, reused: false, item: summarizeMailboxMessage(created.item), proposal_id: created.proposal_id });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_mailbox_import_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.get("/mailbox/messages/:id", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_MAILBOX_READ");
    if (!session || !(await requireMailboxCapability(app, session, reply))) return;
    const item = await ensureInfoRecord(app.db, session.tenant_id, req.params.id, "CRM_MAILBOX_MESSAGE");
    if (!item) return reply.code(404).send({ ok: false, error: "CRM_MAILBOX_MESSAGE_NOT_FOUND" });
    return reply.send({ ok: true, item, links: await loadLinks(app.db, session.tenant_id, "info_record", item.id) });
  });

  app.post("/mailbox/messages/:id/create-intake", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_MAILBOX_WRITE");
    if (!session || !(await requireMailboxCapability(app, session, reply))) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const item = await ensureInfoRecord(client, session.tenant_id, req.params.id, "CRM_MAILBOX_MESSAGE");
      const created = item ? await createIntakeFromMailboxMessage(client, app, session, item) : { ok: false, status: 404, error: "CRM_MAILBOX_MESSAGE_NOT_FOUND" };
      if (!created.ok) {
        await client.query("ROLLBACK");
        return reply.code(created.status || 409).send({ ok: false, error: created.error });
      }
      await client.query("COMMIT");
      return reply.send({ ok: true, reused: created.reused === true, item: summarizeMailboxMessage(created.item), proposal_id: created.proposal_id });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_mailbox_create_intake_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.get("/mailbox/threads/:threadId", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_MAILBOX_READ");
    if (!session || !(await requireMailboxCapability(app, session, reply))) return;
    const result = await app.db.query(
      `SELECT id, record_type, title, description, payload, attrs, created_at, updated_at
       FROM eip_core.info_record
       WHERE tenant_id=$1 AND record_type='CRM_MAILBOX_MESSAGE' AND is_active=true
         AND payload->>'thread_fingerprint'=$2 ORDER BY created_at ASC`,
      [session.tenant_id, normalizeOptionalText(req.params.threadId, 128)]
    );
    return reply.send({ ok: true, items: result.rows });
  });

  app.get("/mailbox/replies", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_MAILBOX_READ");
    if (!session || !(await requireMailboxCapability(app, session, reply))) return;
    const params = [session.tenant_id];
    const filters = ["tenant_id=$1", "record_type='CRM_MAILBOX_REPLY_DRAFT'", "is_active=true"];
    const status = normalizeStatus(req.query?.status);
    if (status) {
      if (!REPLY_STATUSES.has(status)) return reply.code(400).send({ ok: false, error: "CRM_REPLY_STATUS_INVALID" });
      params.push(status);
      filters.push(`payload->>'reply_status'=$${params.length}`);
    }
    params.push(clampLimit(req.query?.limit), Math.max(0, Number(req.query?.offset || 0)));
    const result = await app.db.query(
      `SELECT id, record_type, title, description, payload, attrs, created_at, updated_at
       FROM eip_core.info_record WHERE ${filters.join(" AND ")}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return reply.send({ ok: true, items: result.rows.map(replySummary), limit: params.at(-2), offset: params.at(-1) });
  });

  app.get("/mailbox/replies/:id", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_MAILBOX_READ");
    if (!session || !(await requireMailboxCapability(app, session, reply))) return;
    const context = await loadReplyContext(app.db, session.tenant_id, req.params.id);
    if (!context) return reply.code(404).send({ ok: false, error: "CRM_MAILBOX_REPLY_NOT_FOUND" });
    return reply.send({ ok: true, item: context.item, links: context.links });
  });

  app.post("/mailbox/replies/draft", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_MAILBOX_REPLY_DRAFT");
    if (!session || !(await requireMailboxCapability(app, session, reply))) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const message = await ensureInfoRecord(client, session.tenant_id, req.body?.message_id, "CRM_MAILBOX_MESSAGE");
      if (!message) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "CRM_MAILBOX_MESSAGE_NOT_FOUND" });
      }
      const subject = sanitizeReadableMessageText(req.body?.subject || `Re: ${message.payload?.subject || message.title}`, 300);
      const bodyText = sanitizeReadableMessageText(req.body?.body_text, 50000);
      if (!bodyText) {
        await client.query("ROLLBACK");
        return reply.code(400).send({ ok: false, error: "CRM_MAILBOX_REPLY_BODY_REQUIRED" });
      }
      const actorAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
      const item = await insertInfoRecord(client, session.tenant_id, actorAgentId, {
        record_type: "CRM_MAILBOX_REPLY_DRAFT",
        title: subject,
        description: bodyText.slice(0, 500),
        payload: {
          message_id: message.id,
          proposal_id: message.payload?.proposal_id || null,
          provider: message.payload?.provider,
          connection_code: message.payload?.connection_code,
          provider_thread_id: message.payload?.provider_thread_id,
          subject,
          body_text: bodyText,
          reply_status: "draft",
          provider_send_enabled: false
        },
        attrs: { protected: true, source: "crm_mailbox" }
      });
      const started = await startProcessContext(client, app, session, {
        object_type: "CRM_MAILBOX_REPLY_REVIEW",
        status: "draft",
        title: subject,
        attrs: { reply_record_id: item.id, mailbox_message_id: message.id },
        idempotency_key: `crm-mailbox-reply:${item.id}`
      });
      if (!started.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: started.error });
      }
      await insertLink(client, session.tenant_id, {
        src_kind: "info_record",
        src_id: message.id,
        dst_kind: "info_record",
        dst_id: item.id,
        relation_type: "MAILBOX_REPLY_TO"
      });
      await insertLink(client, session.tenant_id, {
        src_kind: "info_record",
        src_id: item.id,
        dst_kind: "service_object",
        dst_id: started.service_object.id,
        relation_type: "MAILBOX_REPLY_REVIEW_CONTEXT"
      });
      const updated = await updateInfoPayload(client, session.tenant_id, item.id, "CRM_MAILBOX_REPLY_DRAFT", {
        review_object_id: started.service_object.id
      });
      await client.query("COMMIT");
      return reply.send({ ok: true, item: updated });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_mailbox_reply_draft_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.patch("/mailbox/replies/:id", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_MAILBOX_REPLY_DRAFT");
    if (!session || !(await requireMailboxCapability(app, session, reply))) return;
    const context = await loadReplyContext(app.db, session.tenant_id, req.params.id);
    if (!context) return reply.code(404).send({ ok: false, error: "CRM_MAILBOX_REPLY_NOT_FOUND" });
    if (!["draft", "review"].includes(context.item.payload?.reply_status)) return reply.code(409).send({ ok: false, error: "CRM_MAILBOX_REPLY_FINAL" });
    const bodyText = sanitizeReadableMessageText(req.body?.body_text ?? context.item.payload?.body_text, 50000);
    if (!bodyText) return reply.code(400).send({ ok: false, error: "CRM_MAILBOX_REPLY_BODY_REQUIRED" });
    const item = await updateInfoPayload(app.db, session.tenant_id, context.item.id, "CRM_MAILBOX_REPLY_DRAFT", {
      subject: sanitizeReadableMessageText(req.body?.subject ?? context.item.payload?.subject, 300),
      body_text: bodyText,
      reply_status: "draft"
    });
    return reply.send({ ok: true, item });
  });

  app.post("/mailbox/replies/:id/approve", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_MAILBOX_REPLY_DRAFT");
    if (!session || !(await requireMailboxCapability(app, session, reply))) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const context = await loadReplyContext(client, session.tenant_id, req.params.id);
      if (!context) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "CRM_MAILBOX_REPLY_NOT_FOUND" });
      }
      if (context.item.payload?.reply_status === "approved") {
        await client.query("COMMIT");
        return reply.send({ ok: true, reused: true, item: context.item });
      }
      if (!["draft", "review"].includes(context.item.payload?.reply_status) || !context.review_object_id) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: "CRM_MAILBOX_REPLY_APPROVAL_INVALID" });
      }
      if (context.item.payload?.reply_status === "draft") {
        const reviewed = await advanceProcessContext(client, app, session, context.review_object_id, "review", {}, sha256Hex(`crm-mailbox-reply:${context.item.id}:review`));
        if (!reviewed.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: reviewed.error });
        }
      }
      const approved = await advanceProcessContext(client, app, session, context.review_object_id, "approved", {}, sha256Hex(`crm-mailbox-reply:${context.item.id}:approved`));
      if (!approved.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: approved.error });
      }
      const actorAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
      const decision = await insertInfoRecord(client, session.tenant_id, actorAgentId, {
        record_type: "CRM_MAILBOX_REPLY_DECISION",
        title: "Mailbox reply approved",
        description: normalizeOptionalText(req.body?.note, 500),
        payload: { reply_id: context.item.id, decision: "approved", decided_at: new Date().toISOString() },
        attrs: { protected: true, source: "crm_mailbox" }
      });
      await insertLink(client, session.tenant_id, {
        src_kind: "info_record",
        src_id: context.item.id,
        dst_kind: "info_record",
        dst_id: decision.id,
        relation_type: "MAILBOX_REPLY_DECISION"
      });
      const item = await updateInfoPayload(client, session.tenant_id, context.item.id, "CRM_MAILBOX_REPLY_DRAFT", {
        reply_status: "approved",
        approved_at: new Date().toISOString()
      });
      await client.query("COMMIT");
      return reply.send({ ok: true, item });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_mailbox_reply_approve_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.post("/mailbox/replies/:id/send", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_MAILBOX_REPLY_SEND");
    if (!session || !(await requireMailboxCapability(app, session, reply))) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const context = await loadReplyContext(client, session.tenant_id, req.params.id);
      if (!context) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "CRM_MAILBOX_REPLY_NOT_FOUND" });
      }
      if (context.item.payload?.reply_status !== "approved" || !context.review_object_id) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: "CRM_MAILBOX_REPLY_APPROVAL_REQUIRED" });
      }
      const pending = await advanceProcessContext(client, app, session, context.review_object_id, "send_pending", {}, sha256Hex(`crm-mailbox-reply:${context.item.id}:send_pending`));
      if (!pending.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: pending.error });
      }
      const item = await updateInfoPayload(client, session.tenant_id, context.item.id, "CRM_MAILBOX_REPLY_DRAFT", {
        reply_status: "send_pending",
        send_requested_at: new Date().toISOString()
      });
      const adapter = getMailboxAdapter(context.item.payload?.provider);
      const sendResult = adapter
        ? await adapter.sendReply({ reply_id: context.item.id, provider_thread_id: context.item.payload?.provider_thread_id })
        : { ok: false, pending: true, error: "CRM_MAILBOX_PROVIDER_NOT_CONFIGURED" };
      if (sendResult.ok) {
        const sent = await advanceProcessContext(client, app, session, context.review_object_id, "sent", {}, sha256Hex(`crm-mailbox-reply:${context.item.id}:sent`));
        if (!sent.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: sent.error });
        }
        const delivered = await updateInfoPayload(client, session.tenant_id, context.item.id, "CRM_MAILBOX_REPLY_DRAFT", {
          reply_status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: normalizeOptionalText(sendResult.provider_message_id, 300)
        });
        await client.query("COMMIT");
        return reply.send({ ok: true, item: delivered });
      }
      await client.query("COMMIT");
      return reply.code(202).send({ ok: false, pending: true, error: sendResult.error, item });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_mailbox_reply_send_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });
}
