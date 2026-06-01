import crypto from "node:crypto";
import { hasPermission } from "../auth/perm.js";
import { sha256Hex } from "../auth/crypto.js";
import { extractProfiles } from "../services/gateway/connectionProfile.js";

const MAX_LIMIT = 200;
const SEGMENT_TYPES = new Set(["SEGMENT", "MARKET_GROUP"]);
const LINK_KINDS = new Set(["agent", "service_object", "info_record", "material"]);
const SIGNAL_LINK_RELATIONS = new Set([
  "SIGNAL_FOR_SEGMENT",
  "SIGNAL_FOR_AGENT",
  "SIGNAL_FOR_CAMPAIGN",
  "SIGNAL_FOR_LEAD",
  "SIGNAL_FOR_OPPORTUNITY",
  "SIGNAL_FOR_PRODUCT",
  "SIGNAL_FOR_CONTENT"
]);
const SEGMENT_LINK_RELATIONS = new Set([
  "SEGMENT_MEMBER",
  "SEGMENT_INTEREST",
  "SEGMENT_RELATED_LEAD",
  "SEGMENT_RELATED_OPPORTUNITY",
  "SEGMENT_RELATED_CONTENT"
]);
const CAMPAIGN_LINK_RELATIONS = new Set([
  "CAMPAIGN_TARGETS_SEGMENT",
  "CAMPAIGN_RELATED_PRODUCT",
  "CAMPAIGN_RELATED_CONTENT",
  "CAMPAIGN_SOURCE_FOR_LEAD",
  "CAMPAIGN_RELATED_OPPORTUNITY"
]);
const CRM_INTELLIGENCE_CAPABILITIES = [
  "segments",
  "campaigns",
  "signals",
  "intelligence",
  "connectors"
];
const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|credential|password|secret|session|signature|token|api[_-]?key|email|phone|address)/i;

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value, maxLength = 500) {
  const text = normalizeText(value);
  return text ? text.slice(0, maxLength) : null;
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeCode(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeStringList(value, maxItems = 50) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => normalizeOptionalText(item, 120)).filter(Boolean))].slice(0, maxItems);
}

function normalizeNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampLimit(value) {
  const number = Number(value || 50);
  if (!Number.isFinite(number)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, number));
}

function sanitizeMetadata(value, depth = 0) {
  if (depth > 4) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeMetadata(item, depth + 1));
  if (!value || typeof value !== "object") {
    if (typeof value === "string") return value.slice(0, 500);
    return value;
  }
  const out = {};
  for (const [key, entry] of Object.entries(value).slice(0, 80)) {
    out[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitizeMetadata(entry, depth + 1);
  }
  return out;
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

async function loadCapabilities(client, tenantId) {
  const result = await client.query(
    `
    SELECT attrs, is_active
    FROM eip_core.tenant_module_setting
    WHERE tenant_id=$1 AND module='crm' AND code='subscription'
    LIMIT 1
    `,
    [tenantId]
  );
  const row = result.rows[0];
  const configured = row?.attrs?.capabilities && typeof row.attrs.capabilities === "object"
    ? row.attrs.capabilities
    : {};
  return {
    basic: row?.is_active === true,
    segments: row?.is_active === true && configured.segments === true,
    campaigns: row?.is_active === true && configured.campaigns === true,
    signals: row?.is_active === true && configured.signals === true,
    intelligence: row?.is_active === true && configured.intelligence === true,
    connectors: row?.is_active === true && configured.connectors === true
  };
}

async function requireCapability(app, session, reply, capability) {
  const capabilities = await loadCapabilities(app.db, session.tenant_id);
  if (capabilities[capability] !== true) {
    reply.code(403).send({ ok: false, error: "CRM_CAPABILITY_DISABLED", capability });
    return false;
  }
  return true;
}

async function getPrimaryAgentId(client, tenantId, identityId) {
  const result = await client.query(
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

async function ensureAgent(client, tenantId, agentId) {
  if (!agentId) return null;
  const result = await client.query(
    `SELECT id, agent_type, code, name, attrs, is_active, created_at, updated_at
     FROM eip_core.agent WHERE tenant_id=$1 AND id=$2`,
    [tenantId, agentId]
  );
  return result.rows[0] || null;
}

async function ensureSegment(client, tenantId, segmentId) {
  const segment = await ensureAgent(client, tenantId, segmentId);
  return segment && SEGMENT_TYPES.has(normalizeText(segment.agent_type).toUpperCase()) ? segment : null;
}

async function ensureServiceObject(client, tenantId, serviceObjectId, objectType = null) {
  const result = await client.query(
    `
    SELECT id, object_type, status, code, title, attrs, owner_agent_id, created_at, updated_at
    FROM eip_core.service_object
    WHERE tenant_id=$1 AND id=$2 AND ($3::text IS NULL OR object_type=$3)
    `,
    [tenantId, serviceObjectId, objectType]
  );
  return result.rows[0] || null;
}

async function ensureInfoRecord(client, tenantId, recordId, recordType = null) {
  const result = await client.query(
    `
    SELECT id, record_type, title, description, payload, attrs, created_by_agent_id, created_at, updated_at
    FROM eip_core.info_record
    WHERE tenant_id=$1 AND id=$2 AND ($3::text IS NULL OR record_type=$3)
    `,
    [tenantId, recordId, recordType]
  );
  return result.rows[0] || null;
}

async function validateDropdownValue(client, tenantId, listCode, value) {
  const code = normalizeOptionalText(value, 120);
  if (!code) return { ok: true };
  const result = await client.query(
    `
    SELECT 1
    FROM eip_core.dropdown_list list
    JOIN eip_core.dropdown_value value ON value.list_id=list.id AND value.is_active=true
    WHERE list.code=$1 AND list.is_active=true AND (list.tenant_id=$2 OR list.tenant_id IS NULL)
      AND value.code=$3
    ORDER BY (list.tenant_id IS NOT NULL) DESC, list.version DESC
    LIMIT 1
    `,
    [listCode, tenantId, code]
  );
  return result.rowCount ? { ok: true } : { ok: false, error: "DROPDOWN_VALUE_INVALID", list_code: listCode, value: code };
}

async function validateDropdownValues(client, tenantId, entries) {
  for (const [listCode, value] of entries) {
    const result = await validateDropdownValue(client, tenantId, listCode, value);
    if (!result.ok) return result;
  }
  return { ok: true };
}

async function resolveProcessBinding(client, tenantId, objectType) {
  const result = await client.query(
    `
    SELECT process_def_id
    FROM eip_core.process_binding
    WHERE tenant_id=$1 AND service_object_type=$2 AND is_active=true
    ORDER BY priority ASC, created_at DESC
    LIMIT 1
    `,
    [tenantId, objectType]
  );
  return result.rows[0] || null;
}

async function startObjectProcess(client, app, input) {
  const binding = await resolveProcessBinding(client, input.tenantId, input.objectType);
  if (!binding) return { ok: false, error: "PROCESS_BINDING_REQUIRED" };
  return app.coreProcess.createInstance(client, {
    tenantId: input.tenantId,
    identityId: input.identityId,
    serviceObject: input.serviceObject,
    processDefId: binding.process_def_id,
    idempotencyKey: input.idempotencyKey || null
  });
}

async function ensureProcessInstance(client, app, input) {
  const existing = await app.coreProcess.findActiveInstance(client, input.tenantId, input.serviceObjectId);
  if (existing) return { ok: true, instance: existing };
  const binding = await resolveProcessBinding(client, input.tenantId, input.objectType);
  if (!binding) return { ok: false, error: "PROCESS_BINDING_REQUIRED" };
  const started = await app.coreProcess.createInstance(client, {
    tenantId: input.tenantId,
    identityId: input.identityId,
    serviceObjectId: input.serviceObjectId,
    processDefId: binding.process_def_id,
    idempotencyKey: `auto:${input.objectType}:${input.serviceObjectId}`
  });
  return started.ok ? { ok: true, instance: started.item } : started;
}

async function advanceObjectProcess(client, app, input) {
  const instanceResult = await ensureProcessInstance(client, app, input);
  if (!instanceResult.ok) return instanceResult;
  return app.coreProcess.advanceInstance(client, {
    tenantId: input.tenantId,
    identityId: input.identityId,
    instanceId: instanceResult.instance.id,
    action: input.action,
    payload: input.payload || {},
    idempotencyKey:
      input.idempotencyKey ||
      buildIdempotencyKey(`crm-intelligence:${input.objectType}:${input.action}`, {
        service_object_id: input.serviceObjectId,
        payload: input.payload || {}
      })
  });
}

async function insertLink(client, tenantId, input) {
  const result = await client.query(
    `
    INSERT INTO eip_core.object_link
      (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
    ON CONFLICT (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type)
    DO UPDATE SET is_active=true, attrs=EXCLUDED.attrs, updated_at=now()
    RETURNING id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs, is_active, created_at
    `,
    [
      tenantId,
      input.src_kind,
      input.src_id,
      input.dst_kind,
      input.dst_id,
      input.relation_type,
      JSON.stringify(sanitizeMetadata(input.attrs || {}))
    ]
  );
  return result.rows[0];
}

async function loadLinks(client, tenantId, kind, id) {
  const result = await client.query(
    `
    SELECT id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs, is_active, created_at, updated_at
    FROM eip_core.object_link
    WHERE tenant_id=$1 AND is_active=true
      AND ((src_kind=$2 AND src_id=$3) OR (dst_kind=$2 AND dst_id=$3))
    ORDER BY created_at DESC
    `,
    [tenantId, kind, id]
  );
  return result.rows;
}

async function assertLinkTarget(client, tenantId, kind, id) {
  if (kind === "agent") return Boolean(await ensureAgent(client, tenantId, id));
  if (kind === "service_object") return Boolean(await ensureServiceObject(client, tenantId, id));
  if (kind === "info_record") return Boolean(await ensureInfoRecord(client, tenantId, id));
  if (kind === "material") {
    const result = await client.query(`SELECT 1 FROM eip_core.material WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
    return result.rowCount > 0;
  }
  return false;
}

async function assertLinkSemantics(client, tenantId, kind, id, relationType) {
  if (relationType === "SEGMENT_MEMBER" || relationType === "SIGNAL_FOR_AGENT") return kind === "agent";
  if (relationType === "CAMPAIGN_TARGETS_SEGMENT" || relationType === "SIGNAL_FOR_SEGMENT") {
    return kind === "agent" && Boolean(await ensureSegment(client, tenantId, id));
  }
  if (relationType === "SIGNAL_FOR_CAMPAIGN") {
    return kind === "service_object" && Boolean(await ensureServiceObject(client, tenantId, id, "CRM_CAMPAIGN"));
  }
  if (relationType === "SIGNAL_FOR_LEAD" || relationType === "CAMPAIGN_SOURCE_FOR_LEAD" || relationType === "SEGMENT_RELATED_LEAD") {
    return kind === "service_object" && Boolean(await ensureServiceObject(client, tenantId, id, "CRM_LEAD"));
  }
  if (relationType === "SIGNAL_FOR_OPPORTUNITY" || relationType === "CAMPAIGN_RELATED_OPPORTUNITY" || relationType === "SEGMENT_RELATED_OPPORTUNITY") {
    return kind === "service_object" && Boolean(await ensureServiceObject(client, tenantId, id, "CRM_OPPORTUNITY"));
  }
  if (relationType === "SIGNAL_FOR_PRODUCT" || relationType === "CAMPAIGN_RELATED_PRODUCT") return kind === "material";
  if (relationType === "SIGNAL_FOR_CONTENT" || relationType === "CAMPAIGN_RELATED_CONTENT" || relationType === "SEGMENT_RELATED_CONTENT") return kind === "info_record";
  if (relationType === "SEGMENT_INTEREST") return kind === "material" || kind === "info_record";
  return true;
}

async function createGovernedLink(client, tenantId, input, allowedRelations) {
  const dstKind = normalizeText(input.dst_kind).toLowerCase();
  const dstId = normalizeOptionalText(input.dst_id, 36);
  const relationType = normalizeText(input.relation_type).toUpperCase();
  if (!LINK_KINDS.has(dstKind) || !dstId || !allowedRelations.has(relationType)) {
    return { ok: false, status: 400, error: "OBJECT_LINK_INVALID" };
  }
  if (!(await assertLinkTarget(client, tenantId, dstKind, dstId))) {
    return { ok: false, status: 404, error: "LINK_TARGET_NOT_FOUND" };
  }
  if (!(await assertLinkSemantics(client, tenantId, dstKind, dstId, relationType))) {
    return { ok: false, status: 400, error: "LINK_TARGET_TYPE_INVALID" };
  }
  return {
    ok: true,
    item: await insertLink(client, tenantId, {
      src_kind: input.src_kind,
      src_id: input.src_id,
      dst_kind: dstKind,
      dst_id: dstId,
      relation_type: relationType,
      attrs: input.attrs || {}
    })
  };
}

function segmentAttrs(body) {
  return {
    ...sanitizeMetadata(body.attrs || {}),
    segment_type: normalizeOptionalText(body.segment_type, 80),
    source_channels: normalizeStringList(body.source_channels),
    interest_tags: normalizeStringList(body.interest_tags),
    language: normalizeOptionalText(body.language, 20),
    region: normalizeOptionalText(body.region, 40),
    maturity: normalizeOptionalText(body.maturity, 40),
    priority: normalizeOptionalText(body.priority, 40),
    status: normalizeOptionalText(body.status, 40) || "active"
  };
}

function campaignAttrs(body, current = {}) {
  return {
    ...sanitizeMetadata(current || {}),
    ...sanitizeMetadata(body.attrs || {}),
    objective: normalizeOptionalText(body.objective, 80) ?? current.objective ?? null,
    target_segment_ids: Array.isArray(body.target_segment_ids) ? body.target_segment_ids.slice(0, 100) : current.target_segment_ids || [],
    linked_product_ids: Array.isArray(body.linked_product_ids) ? body.linked_product_ids.slice(0, 100) : current.linked_product_ids || [],
    linked_content_ids: Array.isArray(body.linked_content_ids) ? body.linked_content_ids.slice(0, 100) : current.linked_content_ids || [],
    start_date: normalizeOptionalText(body.start_date, 40) ?? current.start_date ?? null,
    end_date: normalizeOptionalText(body.end_date, 40) ?? current.end_date ?? null,
    budget: normalizeNumber(body.budget, current.budget ?? 0),
    currency: normalizeOptionalText(body.currency, 3) ?? current.currency ?? "EUR",
    status_reason: normalizeOptionalText(body.status_reason, 300) ?? current.status_reason ?? null,
    channel_variants: Array.isArray(current.channel_variants) ? current.channel_variants : []
  };
}

function normalizeChannelVariant(body, current = {}) {
  return {
    variant_id: current.variant_id || crypto.randomUUID(),
    channel: normalizeOptionalText(body.channel, 80) ?? current.channel ?? null,
    connection_code: normalizeOptionalText(body.connection_code, 100) ?? current.connection_code ?? null,
    variant_status: normalizeOptionalText(body.variant_status, 40) ?? current.variant_status ?? "draft",
    caption: normalizeOptionalText(body.caption, 2000) ?? current.caption ?? null,
    cta: normalizeOptionalText(body.cta, 300) ?? current.cta ?? null,
    asset_refs: Array.isArray(body.asset_refs) ? body.asset_refs.slice(0, 100).map((item) => normalizeText(item).slice(0, 300)) : current.asset_refs || [],
    payload_preview: sanitizeMetadata(body.payload_preview ?? current.payload_preview ?? {}),
    scheduled_at: normalizeOptionalText(body.scheduled_at, 50) ?? current.scheduled_at ?? null,
    last_publish_attempt: current.last_publish_attempt || null,
    last_publish_status: current.last_publish_status || null,
    last_publish_error_code: current.last_publish_error_code || null
  };
}

function normalizeSignalPayload(body) {
  const externalRef = normalizeOptionalText(body.external_ref, 180);
  return {
    signal_type: normalizeOptionalText(body.signal_type, 80),
    provider: normalizeOptionalText(body.provider, 80) || "manual",
    provider_category: normalizeOptionalText(body.provider_category, 80) || "manual",
    source_channel: normalizeOptionalText(body.source_channel, 80),
    metric: normalizeOptionalText(body.metric, 80),
    value: normalizeNumber(body.value, 0),
    unit: normalizeOptionalText(body.unit, 40) || "count",
    observed_at: normalizeOptionalText(body.observed_at, 50) || new Date().toISOString(),
    confidence: Math.max(0, Math.min(1, normalizeNumber(body.confidence, 1))),
    redacted: true,
    external_ref_hash: externalRef ? sha256Hex(externalRef) : null,
    metadata: sanitizeMetadata(body.metadata || {})
  };
}

async function syncCampaignTargetSegments(client, tenantId, campaignId, targetSegmentIds) {
  await client.query(
    `
    UPDATE eip_core.object_link
    SET is_active=false, updated_at=now()
    WHERE tenant_id=$1 AND src_kind='service_object' AND src_id=$2
      AND dst_kind='agent' AND relation_type='CAMPAIGN_TARGETS_SEGMENT'
      AND NOT (dst_id=ANY($3::uuid[]))
    `,
    [tenantId, campaignId, targetSegmentIds]
  );
  for (const segmentId of targetSegmentIds) {
    await insertLink(client, tenantId, {
      src_kind: "service_object",
      src_id: campaignId,
      dst_kind: "agent",
      dst_id: segmentId,
      relation_type: "CAMPAIGN_TARGETS_SEGMENT"
    });
  }
}

async function appendNote(client, tenantId, identityId, kind, id, recordType, body) {
  const actorAgentId = await getPrimaryAgentId(client, tenantId, identityId);
  const result = await client.query(
    `
    INSERT INTO eip_core.info_record
      (tenant_id, record_type, title, description, payload, attrs, created_by_agent_id)
    VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)
    RETURNING id, record_type, title, description, payload, attrs, created_at
    `,
    [
      tenantId,
      recordType,
      normalizeOptionalText(body.title, 200) || "Note",
      normalizeOptionalText(body.description, 2000),
      JSON.stringify(sanitizeMetadata(body.payload || {})),
      JSON.stringify(sanitizeMetadata(body.attrs || {})),
      actorAgentId
    ]
  );
  await insertLink(client, tenantId, {
    src_kind: kind,
    src_id: id,
    dst_kind: "info_record",
    dst_id: result.rows[0].id,
    relation_type: "NOTE"
  });
  return result.rows[0];
}

async function loadSimpleTimeline(client, tenantId, kind, id) {
  const result = await client.query(
    `
    SELECT ir.id, ir.record_type, ir.title, ir.description, ir.payload, ir.attrs, ir.created_at
    FROM eip_core.object_link ol
    JOIN eip_core.info_record ir ON ir.tenant_id=ol.tenant_id AND ir.id=ol.dst_id
    WHERE ol.tenant_id=$1 AND ol.src_kind=$2 AND ol.src_id=$3
      AND ol.dst_kind='info_record' AND ol.is_active=true
    ORDER BY ir.created_at DESC
    LIMIT 100
    `,
    [tenantId, kind, id]
  );
  return result.rows.map((item) => ({ kind: "note", ...item, occurred_at: item.created_at }));
}

async function createCampaignTask(client, app, session, campaignId, body) {
  const campaign = await ensureServiceObject(client, session.tenant_id, campaignId, "CRM_CAMPAIGN");
  if (!campaign) return { ok: false, error: "CAMPAIGN_NOT_FOUND", status: 404 };
  const payload = {
    task_type: normalizeOptionalText(body.task_type, 80) || "FOLLOW_UP",
    title: normalizeOptionalText(body.title, 200) || "Campaign follow up",
    description: normalizeOptionalText(body.description, 2000),
    assigned_agent_id: normalizeOptionalText(body.assigned_agent_id, 36),
    due_at: normalizeOptionalText(body.due_at, 50),
    payload: sanitizeMetadata(body.payload || {}),
    attrs: sanitizeMetadata(body.attrs || {})
  };
  const advanced = await advanceObjectProcess(client, app, {
    tenantId: session.tenant_id,
    identityId: session.identity_id,
    serviceObjectId: campaignId,
    objectType: "CRM_CAMPAIGN",
    action: "task.create",
    payload,
    idempotencyKey: normalizeOptionalText(body.idempotency_key, 200)
  });
  return advanced.ok ? { ok: true, created: advanced.entry?.effects_applied || [] } : { ...advanced, status: 409 };
}

async function ensureSegmentWorkObject(client, app, session, segment) {
  const existing = await client.query(
    `
    SELECT so.id, so.object_type
    FROM eip_core.object_link ol
    JOIN eip_core.service_object so ON so.tenant_id=ol.tenant_id AND so.id=ol.dst_id
    WHERE ol.tenant_id=$1 AND ol.src_kind='agent' AND ol.src_id=$2
      AND ol.dst_kind='service_object' AND ol.relation_type='SEGMENT_WORK_CONTEXT'
      AND ol.is_active=true AND so.object_type='CRM_SEGMENT_REVIEW'
    ORDER BY so.created_at DESC
    LIMIT 1
    `,
    [session.tenant_id, segment.id]
  );
  if (existing.rowCount) return { ok: true, item: existing.rows[0] };
  const started = await startObjectProcess(client, app, {
    tenantId: session.tenant_id,
    identityId: session.identity_id,
    objectType: "CRM_SEGMENT_REVIEW",
    serviceObject: {
      object_type: "CRM_SEGMENT_REVIEW",
      status: "new",
      title: `Segment follow ups: ${segment.name || segment.code || segment.id}`,
      attrs: { segment_agent_id: segment.id }
    }
  });
  if (!started.ok) return started;
  await insertLink(client, session.tenant_id, {
    src_kind: "agent",
    src_id: segment.id,
    dst_kind: "service_object",
    dst_id: started.service_object.id,
    relation_type: "SEGMENT_WORK_CONTEXT"
  });
  return { ok: true, item: started.service_object };
}

export default async function registerCrmIntelligenceRoutes(app) {
  app.get("/intelligence/capabilities", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_INTELLIGENCE_READ");
    if (!session) return;
    return reply.send({ ok: true, capabilities: await loadCapabilities(app.db, session.tenant_id) });
  });

  app.get("/segments", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_SEGMENT_READ");
    if (!session || !(await requireCapability(app, session, reply, "segments"))) return;
    const q = normalizeOptionalText(req.query?.q, 200);
    const params = [session.tenant_id];
    const filters = ["tenant_id=$1", "upper(agent_type)=ANY(ARRAY['SEGMENT','MARKET_GROUP'])"];
    if (q) {
      params.push(`%${q}%`);
      filters.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`);
    }
    params.push(clampLimit(req.query?.limit), Number(req.query?.offset || 0));
    const result = await app.db.query(
      `SELECT id, agent_type, code, name, attrs, is_active, created_at, updated_at
       FROM eip_core.agent WHERE ${filters.join(" AND ")}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return reply.send({ ok: true, items: result.rows, limit: params.at(-2), offset: params.at(-1) });
  });

  app.post("/segments", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_SEGMENT_WRITE");
    if (!session || !(await requireCapability(app, session, reply, "segments"))) return;
    const body = req.body || {};
    const agentType = normalizeText(body.agent_type || "SEGMENT").toUpperCase();
    if (!SEGMENT_TYPES.has(agentType) || !normalizeOptionalText(body.name, 200)) {
      return reply.code(400).send({ ok: false, error: "SEGMENT_INPUT_INVALID" });
    }
    const governed = await validateDropdownValues(app.db, session.tenant_id, [
      ["CRM_SEGMENT_TYPE", body.segment_type],
      ["CRM_SEGMENT_PRIORITY", body.priority],
      ["CRM_SEGMENT_MATURITY", body.maturity]
    ]);
    if (!governed.ok) return reply.code(400).send({ ok: false, ...governed });
    const result = await app.db.query(
      `
      INSERT INTO eip_core.agent (tenant_id, agent_type, code, name, attrs)
      VALUES ($1,$2,$3,$4,$5::jsonb)
      RETURNING id, agent_type, code, name, attrs, is_active, created_at, updated_at
      `,
      [session.tenant_id, agentType, normalizeOptionalText(body.code, 100), normalizeText(body.name), JSON.stringify(segmentAttrs(body))]
    );
    return reply.send({ ok: true, item: result.rows[0] });
  });

  app.get("/segments/:id", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_SEGMENT_READ");
    if (!session || !(await requireCapability(app, session, reply, "segments"))) return;
    const item = await ensureSegment(app.db, session.tenant_id, req.params.id);
    if (!item) return reply.code(404).send({ ok: false, error: "SEGMENT_NOT_FOUND" });
    return reply.send({ ok: true, item, links: await loadLinks(app.db, session.tenant_id, "agent", item.id) });
  });

  app.patch("/segments/:id", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_SEGMENT_WRITE");
    if (!session || !(await requireCapability(app, session, reply, "segments"))) return;
    const item = await ensureSegment(app.db, session.tenant_id, req.params.id);
    if (!item) return reply.code(404).send({ ok: false, error: "SEGMENT_NOT_FOUND" });
    const body = req.body || {};
    const governed = await validateDropdownValues(app.db, session.tenant_id, [
      ["CRM_SEGMENT_TYPE", body.segment_type],
      ["CRM_SEGMENT_PRIORITY", body.priority],
      ["CRM_SEGMENT_MATURITY", body.maturity]
    ]);
    if (!governed.ok) return reply.code(400).send({ ok: false, ...governed });
    const attrs = { ...(item.attrs || {}), ...segmentAttrs({ ...item.attrs, ...body, attrs: body.attrs || {} }) };
    const result = await app.db.query(
      `
      UPDATE eip_core.agent
      SET code=COALESCE($3,code), name=COALESCE($4,name), attrs=$5::jsonb,
          is_active=COALESCE($6,is_active), updated_at=now()
      WHERE tenant_id=$1 AND id=$2
      RETURNING id, agent_type, code, name, attrs, is_active, created_at, updated_at
      `,
      [
        session.tenant_id,
        item.id,
        normalizeOptionalText(body.code, 100),
        normalizeOptionalText(body.name, 200),
        JSON.stringify(attrs),
        typeof body.is_active === "boolean" ? body.is_active : null
      ]
    );
    return reply.send({ ok: true, item: result.rows[0] });
  });

  app.post("/segments/:id/tasks", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_SEGMENT_WRITE");
    if (!session || !(await requireCapability(app, session, reply, "segments"))) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const segment = await ensureSegment(client, session.tenant_id, req.params.id);
      if (!segment) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "SEGMENT_NOT_FOUND" });
      }
      const work = await ensureSegmentWorkObject(client, app, session, segment);
      if (!work.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: work.error });
      }
      const payload = {
        task_type: normalizeOptionalText(req.body?.task_type, 80) || "FOLLOW_UP",
        title: normalizeOptionalText(req.body?.title, 200) || "Segment follow up",
        description: normalizeOptionalText(req.body?.description, 2000),
        assigned_agent_id: normalizeOptionalText(req.body?.assigned_agent_id, 36),
        due_at: normalizeOptionalText(req.body?.due_at, 50),
        payload: sanitizeMetadata(req.body?.payload || {}),
        attrs: sanitizeMetadata(req.body?.attrs || {})
      };
      const advanced = await advanceObjectProcess(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        serviceObjectId: work.item.id,
        objectType: "CRM_SEGMENT_REVIEW",
        action: "task.create",
        payload
      });
      if (!advanced.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: advanced.error });
      }
      await client.query("COMMIT");
      return reply.send({ ok: true, created: advanced.entry?.effects_applied || [] });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_segment_task_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.post("/segments/:id/link", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_SEGMENT_WRITE");
    if (!session || !(await requireCapability(app, session, reply, "segments"))) return;
    if (!(await ensureSegment(app.db, session.tenant_id, req.params.id))) {
      return reply.code(404).send({ ok: false, error: "SEGMENT_NOT_FOUND" });
    }
    const result = await createGovernedLink(app.db, session.tenant_id, {
      ...(req.body || {}),
      src_kind: "agent",
      src_id: req.params.id
    }, SEGMENT_LINK_RELATIONS);
    return result.ok ? reply.send(result) : reply.code(result.status).send({ ok: false, error: result.error });
  });

  app.get("/segments/:id/timeline", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_TIMELINE_READ");
    if (!session || !(await requireCapability(app, session, reply, "segments"))) return;
    if (!(await ensureSegment(app.db, session.tenant_id, req.params.id))) {
      return reply.code(404).send({ ok: false, error: "SEGMENT_NOT_FOUND" });
    }
    return reply.send({ ok: true, items: await loadSimpleTimeline(app.db, session.tenant_id, "agent", req.params.id) });
  });

  app.get("/campaigns", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_CAMPAIGN_READ");
    if (!session || !(await requireCapability(app, session, reply, "campaigns"))) return;
    const params = [session.tenant_id];
    const filters = ["tenant_id=$1", "object_type='CRM_CAMPAIGN'"];
    if (normalizeOptionalText(req.query?.status, 40)) {
      params.push(normalizeStatus(req.query.status));
      filters.push(`status=$${params.length}`);
    }
    params.push(clampLimit(req.query?.limit), Number(req.query?.offset || 0));
    const result = await app.db.query(
      `SELECT id, object_type, status, code, title, attrs, owner_agent_id, created_at, updated_at
       FROM eip_core.service_object WHERE ${filters.join(" AND ")}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return reply.send({ ok: true, items: result.rows, limit: params.at(-2), offset: params.at(-1) });
  });

  app.post("/campaigns", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_CAMPAIGN_WRITE");
    if (!session || !(await requireCapability(app, session, reply, "campaigns"))) return;
    const body = req.body || {};
    if (!normalizeOptionalText(body.title, 200)) return reply.code(400).send({ ok: false, error: "TITLE_REQUIRED" });
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const ownerAgentId = normalizeOptionalText(body.owner_agent_id, 36) || await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
      if (ownerAgentId && !(await ensureAgent(client, session.tenant_id, ownerAgentId))) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "OWNER_NOT_FOUND" });
      }
      for (const segmentId of body.target_segment_ids || []) {
        if (!(await ensureSegment(client, session.tenant_id, segmentId))) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "TARGET_SEGMENT_NOT_FOUND", segment_id: segmentId });
        }
      }
      const governed = await validateDropdownValues(client, session.tenant_id, [
        ["CRM_CAMPAIGN_OBJECTIVE", body.objective]
      ]);
      if (!governed.ok) {
        await client.query("ROLLBACK");
        return reply.code(400).send({ ok: false, ...governed });
      }
      const started = await startObjectProcess(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        objectType: "CRM_CAMPAIGN",
        serviceObject: {
          object_type: "CRM_CAMPAIGN",
          status: "draft",
          code: normalizeOptionalText(body.code, 100),
          title: normalizeText(body.title),
          attrs: campaignAttrs(body),
          owner_agent_id: ownerAgentId
        }
      });
      if (!started.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: started.error });
      }
      await syncCampaignTargetSegments(client, session.tenant_id, started.service_object.id, body.target_segment_ids || []);
      await client.query("COMMIT");
      return reply.send({ ok: true, item: started.service_object });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_campaign_create_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.get("/campaigns/:id", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_CAMPAIGN_READ");
    if (!session || !(await requireCapability(app, session, reply, "campaigns"))) return;
    const item = await ensureServiceObject(app.db, session.tenant_id, req.params.id, "CRM_CAMPAIGN");
    if (!item) return reply.code(404).send({ ok: false, error: "CAMPAIGN_NOT_FOUND" });
    return reply.send({ ok: true, item, links: await loadLinks(app.db, session.tenant_id, "service_object", item.id) });
  });

  app.patch("/campaigns/:id", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_CAMPAIGN_WRITE");
    if (!session || !(await requireCapability(app, session, reply, "campaigns"))) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const item = await ensureServiceObject(client, session.tenant_id, req.params.id, "CRM_CAMPAIGN");
      if (!item) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "CAMPAIGN_NOT_FOUND" });
      }
      for (const segmentId of req.body?.target_segment_ids || []) {
        if (!(await ensureSegment(client, session.tenant_id, segmentId))) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "TARGET_SEGMENT_NOT_FOUND", segment_id: segmentId });
        }
      }
      const governed = await validateDropdownValues(client, session.tenant_id, [
        ["CRM_CAMPAIGN_OBJECTIVE", req.body?.objective]
      ]);
      if (!governed.ok) {
        await client.query("ROLLBACK");
        return reply.code(400).send({ ok: false, ...governed });
      }
      const attrs = campaignAttrs(req.body || {}, item.attrs || {});
      const advanced = await advanceObjectProcess(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        serviceObjectId: item.id,
        objectType: "CRM_CAMPAIGN",
        action: "update",
        payload: {
          title: normalizeOptionalText(req.body?.title, 200),
          attrs,
          owner_agent_id: normalizeOptionalText(req.body?.owner_agent_id, 36)
        }
      });
      if (!advanced.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: advanced.error });
      }
      if (Array.isArray(req.body?.target_segment_ids)) {
        await syncCampaignTargetSegments(client, session.tenant_id, item.id, req.body.target_segment_ids);
      }
      await client.query("COMMIT");
      return reply.send({ ok: true, reused: advanced.reused === true });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_campaign_update_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.post("/campaigns/:id/status", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_CAMPAIGN_WRITE");
    if (!session || !(await requireCapability(app, session, reply, "campaigns"))) return;
    const toStatus = normalizeStatus(req.body?.to_status);
    if (!toStatus) return reply.code(400).send({ ok: false, error: "STATUS_REQUIRED" });
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      if (!(await ensureServiceObject(client, session.tenant_id, req.params.id, "CRM_CAMPAIGN"))) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "CAMPAIGN_NOT_FOUND" });
      }
      const advanced = await advanceObjectProcess(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        serviceObjectId: req.params.id,
        objectType: "CRM_CAMPAIGN",
        action: toStatus,
        payload: { to_status: toStatus, note: normalizeOptionalText(req.body?.note, 500) }
      });
      if (!advanced.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: advanced.error });
      }
      await client.query("COMMIT");
      return reply.send({ ok: true, reused: advanced.reused === true });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_campaign_status_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.post("/campaigns/:id/tasks", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_CAMPAIGN_WRITE");
    if (!session || !(await requireCapability(app, session, reply, "campaigns"))) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const result = await createCampaignTask(client, app, session, req.params.id, req.body || {});
      if (!result.ok) {
        await client.query("ROLLBACK");
        return reply.code(result.status || 409).send({ ok: false, error: result.error });
      }
      await client.query("COMMIT");
      return reply.send(result);
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_campaign_task_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.post("/campaigns/:id/link", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_CAMPAIGN_WRITE");
    if (!session || !(await requireCapability(app, session, reply, "campaigns"))) return;
    if (!(await ensureServiceObject(app.db, session.tenant_id, req.params.id, "CRM_CAMPAIGN"))) {
      return reply.code(404).send({ ok: false, error: "CAMPAIGN_NOT_FOUND" });
    }
    const result = await createGovernedLink(app.db, session.tenant_id, {
      ...(req.body || {}),
      src_kind: "service_object",
      src_id: req.params.id
    }, CAMPAIGN_LINK_RELATIONS);
    return result.ok ? reply.send(result) : reply.code(result.status).send({ ok: false, error: result.error });
  });

  app.post("/campaigns/:id/notes", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_CAMPAIGN_WRITE");
    if (!session || !(await requireCapability(app, session, reply, "campaigns"))) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      if (!(await ensureServiceObject(client, session.tenant_id, req.params.id, "CRM_CAMPAIGN"))) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "CAMPAIGN_NOT_FOUND" });
      }
      const item = await appendNote(client, session.tenant_id, session.identity_id, "service_object", req.params.id, "CRM_CAMPAIGN_NOTE", req.body || {});
      await client.query("COMMIT");
      return reply.send({ ok: true, item });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_campaign_note_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.get("/campaigns/:id/timeline", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_TIMELINE_READ");
    if (!session || !(await requireCapability(app, session, reply, "campaigns"))) return;
    if (!(await ensureServiceObject(app.db, session.tenant_id, req.params.id, "CRM_CAMPAIGN"))) {
      return reply.code(404).send({ ok: false, error: "CAMPAIGN_NOT_FOUND" });
    }
    return reply.send({ ok: true, items: await loadSimpleTimeline(app.db, session.tenant_id, "service_object", req.params.id) });
  });

  app.post("/campaigns/:id/channel-variants", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_CAMPAIGN_WRITE");
    if (!session || !(await requireCapability(app, session, reply, "campaigns"))) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const item = await ensureServiceObject(client, session.tenant_id, req.params.id, "CRM_CAMPAIGN");
      if (!item) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "CAMPAIGN_NOT_FOUND" });
      }
      const variant = normalizeChannelVariant(req.body || {});
      if (!variant.channel) {
        await client.query("ROLLBACK");
        return reply.code(400).send({ ok: false, error: "CHANNEL_REQUIRED" });
      }
      const governed = await validateDropdownValues(client, session.tenant_id, [
        ["CRM_CAMPAIGN_CHANNEL", variant.channel],
        ["CRM_CHANNEL_VARIANT_STATUS", variant.variant_status]
      ]);
      if (!governed.ok) {
        await client.query("ROLLBACK");
        return reply.code(400).send({ ok: false, ...governed });
      }
      const channelVariants = [...(item.attrs?.channel_variants || []), variant];
      const advanced = await advanceObjectProcess(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        serviceObjectId: item.id,
        objectType: "CRM_CAMPAIGN",
        action: "update",
        payload: { attrs: { channel_variants: channelVariants } }
      });
      if (!advanced.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: advanced.error });
      }
      await client.query("COMMIT");
      return reply.send({ ok: true, item: variant });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_campaign_variant_create_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.patch("/campaigns/:id/channel-variants/:variantId", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_CAMPAIGN_WRITE");
    if (!session || !(await requireCapability(app, session, reply, "campaigns"))) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const item = await ensureServiceObject(client, session.tenant_id, req.params.id, "CRM_CAMPAIGN");
      if (!item) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "CAMPAIGN_NOT_FOUND" });
      }
      let updated = null;
      const channelVariants = (item.attrs?.channel_variants || []).map((variant) => {
        if (variant.variant_id !== req.params.variantId) return variant;
        updated = normalizeChannelVariant(req.body || {}, variant);
        return updated;
      });
      if (!updated) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "CHANNEL_VARIANT_NOT_FOUND" });
      }
      const governed = await validateDropdownValues(client, session.tenant_id, [
        ["CRM_CAMPAIGN_CHANNEL", updated.channel],
        ["CRM_CHANNEL_VARIANT_STATUS", updated.variant_status]
      ]);
      if (!governed.ok) {
        await client.query("ROLLBACK");
        return reply.code(400).send({ ok: false, ...governed });
      }
      const advanced = await advanceObjectProcess(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        serviceObjectId: item.id,
        objectType: "CRM_CAMPAIGN",
        action: "update",
        payload: { attrs: { channel_variants: channelVariants } }
      });
      if (!advanced.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: advanced.error });
      }
      await client.query("COMMIT");
      return reply.send({ ok: true, item: updated });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_campaign_variant_update_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.get("/signals", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_SIGNAL_READ");
    if (!session || !(await requireCapability(app, session, reply, "signals"))) return;
    const params = [session.tenant_id];
    const filters = ["tenant_id=$1", "record_type=ANY(ARRAY['CRM_SIGNAL','CRM_CAMPAIGN_SIGNAL'])", "is_active=true"];
    for (const field of ["signal_type", "provider", "source_channel"]) {
      if (normalizeOptionalText(req.query?.[field], 80)) {
        params.push(normalizeText(req.query[field]));
        filters.push(`payload->>'${field}'=$${params.length}`);
      }
    }
    for (const [field, operator] of [["date_from", ">="], ["date_to", "<="]]) {
      const rawDate = normalizeOptionalText(req.query?.[field], 30);
      if (!rawDate) continue;
      const parsedDate = Date.parse(rawDate);
      if (!Number.isFinite(parsedDate)) {
        return reply.code(400).send({ ok: false, error: "SIGNAL_DATE_FILTER_INVALID", field });
      }
      params.push(new Date(parsedDate).toISOString());
      filters.push(`created_at ${operator} $${params.length}::timestamptz`);
    }
    params.push(clampLimit(req.query?.limit), Number(req.query?.offset || 0));
    const result = await app.db.query(
      `SELECT id, record_type, title, description, payload, attrs, created_at, updated_at
       FROM eip_core.info_record WHERE ${filters.join(" AND ")}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return reply.send({ ok: true, items: result.rows, limit: params.at(-2), offset: params.at(-1) });
  });

  app.post("/signals", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_SIGNAL_WRITE");
    if (!session || !(await requireCapability(app, session, reply, "signals"))) return;
    const payload = normalizeSignalPayload(req.body || {});
    if (!payload.signal_type || !payload.source_channel || !payload.metric) {
      return reply.code(400).send({ ok: false, error: "SIGNAL_INPUT_INVALID" });
    }
    const governed = await validateDropdownValues(app.db, session.tenant_id, [
      ["CRM_SIGNAL_TYPE", payload.signal_type],
      ["CRM_SIGNAL_PROVIDER_CATEGORY", payload.provider_category],
      ["CRM_SIGNAL_SOURCE_CHANNEL", payload.source_channel]
    ]);
    if (!governed.ok) return reply.code(400).send({ ok: false, ...governed });
    const actorAgentId = await getPrimaryAgentId(app.db, session.tenant_id, session.identity_id);
    const result = await app.db.query(
      `
      INSERT INTO eip_core.info_record
        (tenant_id, record_type, title, description, payload, attrs, created_by_agent_id)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)
      RETURNING id, record_type, title, description, payload, attrs, created_at, updated_at
      `,
      [
        session.tenant_id,
        normalizeText(req.body?.record_type).toUpperCase() === "CRM_CAMPAIGN_SIGNAL" ? "CRM_CAMPAIGN_SIGNAL" : "CRM_SIGNAL",
        normalizeOptionalText(req.body?.title, 200) || `${payload.signal_type}: ${payload.metric}`,
        normalizeOptionalText(req.body?.description, 500),
        JSON.stringify(payload),
        JSON.stringify(sanitizeMetadata(req.body?.attrs || {})),
        actorAgentId
      ]
    );
    return reply.send({ ok: true, item: result.rows[0] });
  });

  app.get("/signals/:id", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_SIGNAL_READ");
    if (!session || !(await requireCapability(app, session, reply, "signals"))) return;
    const item = await ensureInfoRecord(app.db, session.tenant_id, req.params.id);
    if (!item || !["CRM_SIGNAL", "CRM_CAMPAIGN_SIGNAL"].includes(item.record_type)) {
      return reply.code(404).send({ ok: false, error: "SIGNAL_NOT_FOUND" });
    }
    return reply.send({ ok: true, item, links: await loadLinks(app.db, session.tenant_id, "info_record", item.id) });
  });

  app.post("/signals/:id/link", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_SIGNAL_WRITE");
    if (!session || !(await requireCapability(app, session, reply, "signals"))) return;
    const signal = await ensureInfoRecord(app.db, session.tenant_id, req.params.id);
    if (!signal || !["CRM_SIGNAL", "CRM_CAMPAIGN_SIGNAL"].includes(signal.record_type)) {
      return reply.code(404).send({ ok: false, error: "SIGNAL_NOT_FOUND" });
    }
    const result = await createGovernedLink(app.db, session.tenant_id, {
      ...(req.body || {}),
      src_kind: "info_record",
      src_id: signal.id
    }, SIGNAL_LINK_RELATIONS);
    return result.ok ? reply.send(result) : reply.code(result.status).send({ ok: false, error: result.error });
  });

  app.post("/signals/:id/promote", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_SIGNAL_WRITE");
    if (!session || !(await requireCapability(app, session, reply, "signals"))) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const signal = await ensureInfoRecord(client, session.tenant_id, req.params.id);
      if (!signal || !["CRM_SIGNAL", "CRM_CAMPAIGN_SIGNAL"].includes(signal.record_type)) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "SIGNAL_NOT_FOUND" });
      }
      const serviceObjectId = normalizeOptionalText(req.body?.service_object_id, 36);
      const serviceObject = await ensureServiceObject(client, session.tenant_id, serviceObjectId);
      if (!serviceObject) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "PROMOTION_TARGET_NOT_FOUND" });
      }
      const advanced = await advanceObjectProcess(client, app, {
        tenantId: session.tenant_id,
        identityId: session.identity_id,
        serviceObjectId,
        objectType: serviceObject.object_type,
        action: "task.create",
        payload: {
          task_type: normalizeOptionalText(req.body?.task_type, 80) || "FOLLOW_UP",
          title: normalizeOptionalText(req.body?.title, 200) || "Review CRM signal",
          description: normalizeOptionalText(req.body?.description, 2000),
          assigned_agent_id: normalizeOptionalText(req.body?.assigned_agent_id, 36),
          due_at: normalizeOptionalText(req.body?.due_at, 50),
          attrs: { source: "crm_signal_promotion", signal_id: signal.id }
        }
      });
      if (!advanced.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: advanced.error });
      }
      await insertLink(client, session.tenant_id, {
        src_kind: "info_record",
        src_id: signal.id,
        dst_kind: "service_object",
        dst_id: serviceObjectId,
        relation_type: "SIGNAL_PROMOTED_TO_WORK",
        attrs: { mode: "task.create" }
      });
      await client.query("COMMIT");
      return reply.send({ ok: true, created: advanced.entry?.effects_applied || [] });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_signal_promote_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.get("/intelligence/overview", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_INTELLIGENCE_READ");
    if (!session || !(await requireCapability(app, session, reply, "intelligence"))) return;
    const [segments, campaigns, signals, channels, campaignStatuses, segmentPriorities, connectors] = await Promise.all([
      app.db.query(`SELECT count(*)::int AS total FROM eip_core.agent WHERE tenant_id=$1 AND upper(agent_type)=ANY(ARRAY['SEGMENT','MARKET_GROUP']) AND is_active=true`, [session.tenant_id]),
      app.db.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE status='active')::int AS active FROM eip_core.service_object WHERE tenant_id=$1 AND object_type='CRM_CAMPAIGN'`, [session.tenant_id]),
      app.db.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS last_7_days FROM eip_core.info_record WHERE tenant_id=$1 AND record_type=ANY(ARRAY['CRM_SIGNAL','CRM_CAMPAIGN_SIGNAL']) AND is_active=true`, [session.tenant_id]),
      app.db.query(`SELECT COALESCE(payload->>'source_channel','unknown') AS code, count(*)::int AS count FROM eip_core.info_record WHERE tenant_id=$1 AND record_type=ANY(ARRAY['CRM_SIGNAL','CRM_CAMPAIGN_SIGNAL']) AND is_active=true GROUP BY 1 ORDER BY count DESC, code LIMIT 8`, [session.tenant_id]),
      app.db.query(`SELECT status AS code, count(*)::int AS count FROM eip_core.service_object WHERE tenant_id=$1 AND object_type='CRM_CAMPAIGN' GROUP BY status ORDER BY status`, [session.tenant_id]),
      app.db.query(`SELECT COALESCE(attrs->>'priority','unset') AS code, count(*)::int AS count FROM eip_core.agent WHERE tenant_id=$1 AND upper(agent_type)=ANY(ARRAY['SEGMENT','MARKET_GROUP']) AND is_active=true GROUP BY 1 ORDER BY count DESC, code`, [session.tenant_id]),
      loadConnectorReadiness(app.db, session.tenant_id)
    ]);
    const connectorItems = connectors.items || [];
    return reply.send({
      ok: true,
      kpis: {
        segment_count: Number(segments.rows[0]?.total || 0),
        campaign_count: Number(campaigns.rows[0]?.total || 0),
        active_campaign_count: Number(campaigns.rows[0]?.active || 0),
        signal_count: Number(signals.rows[0]?.total || 0),
        signals_last_7_days: Number(signals.rows[0]?.last_7_days || 0),
        connector_readiness: connectorItems.filter((item) => item.configured && item.enabled).length
      },
      top_signal_channels: channels.rows,
      campaigns_by_status: campaignStatuses.rows,
      segments_by_priority: segmentPriorities.rows,
      connector_readiness_summary: connectors.summary
    });
  });

  app.get("/intelligence/connectors", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_CONNECTOR_READ");
    if (!session || !(await requireCapability(app, session, reply, "connectors"))) return;
    return reply.send({ ok: true, ...(await loadConnectorReadiness(app.db, session.tenant_id)) });
  });
}

async function loadConnectorReadiness(client, tenantId) {
  const [tenantResult, catalogResult] = await Promise.all([
    client.query(`SELECT attrs FROM eip_core.tenant WHERE id=$1`, [tenantId]),
    client.query(
      `
      SELECT value.code, value.label, value.attrs
      FROM eip_core.dropdown_list list
      JOIN eip_core.dropdown_value value ON value.list_id=list.id AND value.is_active=true
      WHERE list.code='CRM_CONNECTOR_PROVIDER'
        AND list.is_active=true
        AND (list.tenant_id=$1 OR list.tenant_id IS NULL)
      ORDER BY (list.tenant_id IS NOT NULL) DESC, list.version DESC, value.sort_order, value.code
      `,
      [tenantId]
    )
  ]);
  const profiles = extractProfiles(tenantResult.rows[0]?.attrs || {});
  const configuredItems = profiles.map((profile) => {
    const identity = profile.identity || {};
    const sync = profile.sync || profile.attrs?.sync || {};
    const scopes = Array.isArray(profile.public_storefront?.scopes)
      ? profile.public_storefront.scopes
      : Array.isArray(identity.scopes)
        ? identity.scopes
        : [];
    const configured = Boolean(identity.connection_code);
    const enabled = identity.is_enabled === true;
    const provider = normalizeOptionalText(identity.provider_code || identity.connection_kind || profile.routing?.channel || "custom", 80);
    return {
      id: normalizeOptionalText(identity.connection_code || provider, 100),
      connection_code: normalizeOptionalText(identity.connection_code, 100),
      connection_name: normalizeOptionalText(identity.connection_name, 160),
      provider,
      provider_label: normalizeOptionalText(identity.connection_name || provider, 160),
      provider_category: normalizeOptionalText(profile.routing?.channel || identity.connection_kind || "custom", 80),
      available: true,
      configured,
      enabled,
      status: enabled ? "enabled" : configured ? "configured" : "available",
      direction: normalizeOptionalText(identity.direction, 20),
      scopes: scopes.map((scope) => normalizeText(scope)).filter(Boolean).slice(0, 50),
      last_sync_status: normalizeOptionalText(sync.last_sync_status, 80),
      last_sync_at: normalizeOptionalText(sync.last_sync_at, 50),
      data_category: normalizeOptionalText(sync.data_category || profile.routing?.channel, 80),
      module_dependency: normalizeOptionalText(sync.module_dependency || "crm", 80)
    };
  });
  const configuredByProvider = new Map(configuredItems.map((item) => [normalizeText(item.provider).toLowerCase(), item]));
  const catalogItems = [];
  const seenProviders = new Set();
  for (const row of catalogResult.rows) {
    const provider = normalizeText(row.code).toLowerCase();
    if (!provider || seenProviders.has(provider)) continue;
    seenProviders.add(provider);
    const configured = configuredByProvider.get(provider);
    catalogItems.push(configured || {
      id: provider,
      connection_code: null,
      connection_name: null,
      provider,
      provider_label: normalizeOptionalText(row.label, 160) || provider,
      provider_category: normalizeOptionalText(row.attrs?.category, 80) || "custom",
      available: true,
      configured: false,
      enabled: false,
      status: "available",
      direction: null,
      scopes: [],
      last_sync_status: null,
      last_sync_at: null,
      data_category: normalizeOptionalText(row.attrs?.category, 80),
      module_dependency: normalizeOptionalText(row.attrs?.module_dependency, 80) || "crm"
    });
  }
  const items = [...catalogItems, ...configuredItems.filter((item) => !seenProviders.has(normalizeText(item.provider).toLowerCase()))];
  return {
    items,
    summary: {
      available: items.length,
      configured: items.filter((item) => item.configured).length,
      enabled: items.filter((item) => item.enabled).length
    }
  };
}

export { CRM_INTELLIGENCE_CAPABILITIES, loadCapabilities, sanitizeMetadata };
