import { hasPermission } from "../auth/perm.js";
import { sha256Hex } from "../auth/crypto.js";
import { loadCapabilities, sanitizeMetadata } from "./crm_intelligence.js";

const MAX_LIMIT = 200;
const DEFAULT_AUTOMATION_POLICY = Object.freeze({
  automation_mode: "review_required",
  auto_create_threshold: 0.95,
  review_threshold: 0.6,
  human_review_required: true
});
const DEFAULT_AI_EXTRACTION_POLICY = Object.freeze({
  ai_extraction_enabled: false,
  provider: "",
  model: "",
  mode: "assistive",
  human_review_required: true,
  auto_convert_threshold: 0.98,
  pii_redaction_required: true
});
const INTAKE_SOURCE_TYPES = new Set([
  "email",
  "phone_call",
  "webform",
  "social_message",
  "chat",
  "analytics_signal",
  "payment_event",
  "manual"
]);
const PROPOSAL_STATUSES = new Set(["needs_review", "approved", "ignored", "converted", "failed"]);
const CONVERSION_TYPES = new Set([
  "CRM_LEAD",
  "CRM_OPPORTUNITY",
  "CRM_CASE",
  "CRM_INTERACTION",
  "CRM_SIGNAL",
  "TASK_ONLY",
  "NOTE_ONLY",
  "IGNORE"
]);
const PROCESS_OBJECT_TYPES = new Set(["CRM_LEAD", "CRM_OPPORTUNITY", "CRM_CASE", "CRM_INTERACTION"]);

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

function clampLimit(value) {
  const number = Number(value || 50);
  if (!Number.isFinite(number)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, number));
}

function sanitizeIntakeText(value, maxLength = 4000) {
  return normalizeText(value)
    .slice(0, maxLength)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, "[REDACTED_PHONE]");
}

function maskEmail(value) {
  const email = normalizeOptionalText(value, 254);
  if (!email || !email.includes("@")) return null;
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1) || "*"}***@${domain}`;
}

function maskPhone(value) {
  const phone = normalizeOptionalText(value, 40);
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits ? `***${digits.slice(-4)}` : null;
}

function hashOptional(value) {
  const text = normalizeOptionalText(value, 1000);
  return text ? sha256Hex(text.toLowerCase()) : null;
}

function mergePolicy(configured, defaults) {
  return {
    ...defaults,
    ...(configured && typeof configured === "object" && !Array.isArray(configured) ? configured : {})
  };
}

function buildDetectedContact(input) {
  return {
    name: normalizeOptionalText(input.from_name, 120),
    email_masked: maskEmail(input.from_email),
    email_hash: hashOptional(input.from_email),
    phone_masked: maskPhone(input.from_phone),
    phone_hash: hashOptional(input.from_phone)
  };
}

function inferSuggestedObjectType(sourceType, content) {
  if (sourceType === "analytics_signal" || /\b(view|click|traffic|conversion rate|analytics)\b/i.test(content)) {
    return { object_type: "CRM_SIGNAL", confidence: 0.78, reason: "signal-like source or metric language" };
  }
  if (sourceType === "payment_event" || /\b(refund|chargeback|payment failed|dispute)\b/i.test(content)) {
    return { object_type: "CRM_CASE", confidence: 0.84, reason: "payment or support issue language" };
  }
  if (/\b(problem|complaint|support|help|broken|return|cancel)\b/i.test(content)) {
    return { object_type: "CRM_CASE", confidence: 0.82, reason: "support or case language" };
  }
  if (/\b(interested|inquiry|enquiry|quote|buy|purchase|ship|pricing|price|course|demo)\b/i.test(content)) {
    return { object_type: "CRM_LEAD", confidence: 0.87, reason: "buying or inquiry intent" };
  }
  return { object_type: "CRM_INTERACTION", confidence: 0.65, reason: "general inbound communication" };
}

function extractRuleBasedProposal(input, policies = {}) {
  const sourceType = normalizeStatus(input.source_type) || "manual";
  const subject = sanitizeIntakeText(input.subject || input.title || "Incoming CRM intake", 200);
  const body = sanitizeIntakeText(input.body || input.message || input.description, 4000);
  const inferred = inferSuggestedObjectType(sourceType, `${subject} ${body}`);
  return {
    source_type: sourceType,
    source_channel: normalizeStatus(input.source_channel) || "manual",
    source_ref_hash: hashOptional(input.source_ref),
    raw_record_id: normalizeOptionalText(input.raw_record_id, 36),
    suggested_object_type: inferred.object_type,
    suggested_title: subject || "Incoming CRM intake",
    suggested_summary: body.slice(0, 500),
    detected_contact: buildDetectedContact(input),
    detected_agent_id: normalizeOptionalText(input.detected_agent_id, 36),
    detected_segment_ids: [],
    detected_campaign_ids: [],
    detected_product_ids: [],
    suggested_priority: inferred.object_type === "CRM_CASE" ? "HIGH" : "MEDIUM",
    suggested_status: "new",
    suggested_tasks: [{
      task_type: "FOLLOW_UP",
      title: inferred.object_type === "CRM_CASE" ? "Review incoming case" : "Review incoming inquiry",
      due_at: null
    }],
    confidence: inferred.confidence,
    confidence_reasons: [inferred.reason, "rule-based extractor"],
    extractor_type: "rule_based",
    automation_policy: mergePolicy(policies.automation_policy, DEFAULT_AUTOMATION_POLICY),
    ai_extraction_policy: mergePolicy(policies.ai_extraction_policy, DEFAULT_AI_EXTRACTION_POLICY),
    human_reviewed: false,
    proposal_status: "needs_review"
  };
}

const EXTRACTION_ADAPTERS = new Map([["rule_based", extractRuleBasedProposal]]);

function registerIntakeExtractionAdapter(code, adapter) {
  const normalized = normalizeStatus(code);
  if (!normalized || typeof adapter !== "function") throw new Error("INTAKE_EXTRACTION_ADAPTER_INVALID");
  EXTRACTION_ADAPTERS.set(normalized, adapter);
}

function runIntakeExtraction({ adapter = "rule_based", input, policies = {} }) {
  const adapterCode = normalizeStatus(adapter) || "rule_based";
  const extractor = EXTRACTION_ADAPTERS.get(adapterCode);
  if (!extractor) return { ok: false, error: "INTAKE_EXTRACTION_ADAPTER_NOT_AVAILABLE" };
  if (adapterCode !== "rule_based" && policies.ai_extraction_policy?.ai_extraction_enabled !== true) {
    return { ok: false, error: "AI_EXTRACTION_DISABLED" };
  }
  return { ok: true, adapter: adapterCode, proposal: extractor(input || {}, policies) };
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

async function requireIntakeCapability(app, session, reply) {
  const capabilities = await loadCapabilities(app.db, session.tenant_id);
  if (capabilities.intake !== true) {
    reply.code(403).send({ ok: false, error: "CRM_CAPABILITY_DISABLED", capability: "intake" });
    return false;
  }
  return true;
}

async function loadIntakePolicies(client, tenantId) {
  const result = await client.query(
    `SELECT attrs FROM eip_core.tenant_module_setting
     WHERE tenant_id=$1 AND module='crm' AND code='subscription' AND is_active=true LIMIT 1`,
    [tenantId]
  );
  const attrs = result.rows[0]?.attrs || {};
  return {
    automation_policy: mergePolicy(attrs.intake_policy, DEFAULT_AUTOMATION_POLICY),
    ai_extraction_policy: mergePolicy(attrs.ai_extraction_policy, DEFAULT_AI_EXTRACTION_POLICY)
  };
}

async function getPrimaryAgentId(client, tenantId, identityId) {
  const result = await client.query(
    `SELECT agent_id FROM eip_auth.auth_identity_agent
     WHERE tenant_id=$1 AND identity_id=$2 AND is_primary=true AND is_active=true LIMIT 1`,
    [tenantId, identityId]
  );
  return result.rows[0]?.agent_id || null;
}

async function ensureAgent(client, tenantId, agentId) {
  if (!agentId) return null;
  const result = await client.query(`SELECT id, agent_type, name FROM eip_core.agent WHERE tenant_id=$1 AND id=$2`, [tenantId, agentId]);
  return result.rows[0] || null;
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

async function ensureServiceObject(client, tenantId, serviceObjectId, objectType = null) {
  if (!serviceObjectId) return null;
  const result = await client.query(
    `SELECT id, object_type, status, title, attrs, owner_agent_id
     FROM eip_core.service_object
     WHERE tenant_id=$1 AND id=$2 AND ($3::text IS NULL OR object_type=$3)`,
    [tenantId, serviceObjectId, objectType]
  );
  return result.rows[0] || null;
}

async function validateDropdownValue(client, tenantId, listCode, value) {
  const code = normalizeOptionalText(value, 120);
  if (!code) return { ok: true };
  const result = await client.query(
    `SELECT 1
     FROM eip_core.dropdown_list list
     JOIN eip_core.dropdown_value value ON value.list_id=list.id AND value.is_active=true
     WHERE list.code=$1 AND list.is_active=true AND (list.tenant_id=$2 OR list.tenant_id IS NULL)
       AND value.code=$3
     ORDER BY (list.tenant_id IS NOT NULL) DESC, list.version DESC
     LIMIT 1`,
    [listCode, tenantId, code]
  );
  return result.rowCount ? { ok: true } : { ok: false, error: "DROPDOWN_VALUE_INVALID", list_code: listCode, value: code };
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

async function advanceObjectProcess(client, app, input) {
  const instance = await app.coreProcess.findActiveInstance(client, input.tenantId, input.serviceObjectId);
  if (!instance) return { ok: false, error: "PROCESS_INSTANCE_REQUIRED" };
  return app.coreProcess.advanceInstance(client, {
    tenantId: input.tenantId,
    identityId: input.identityId,
    instanceId: instance.id,
    action: input.action,
    payload: input.payload || {},
    idempotencyKey: input.idempotencyKey || sha256Hex(`crm-intake:${input.serviceObjectId}:${input.action}:${JSON.stringify(input.payload || {})}`)
  });
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
      normalizeOptionalText(input.title, 200),
      normalizeOptionalText(input.description, 1000),
      JSON.stringify(input.payload || {}),
      JSON.stringify(sanitizeMetadata(input.attrs || {})),
      actorAgentId
    ]
  );
  return result.rows[0];
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

async function updateProposalPayload(client, tenantId, proposalId, patch) {
  const result = await client.query(
    `UPDATE eip_core.info_record
     SET payload=COALESCE(payload,'{}'::jsonb) || $3::jsonb, updated_at=now()
     WHERE tenant_id=$1 AND id=$2 AND record_type='CRM_INTAKE_PROPOSAL' AND is_active=true
     RETURNING id, record_type, title, description, payload, attrs, created_at, updated_at`,
    [tenantId, proposalId, JSON.stringify(patch)]
  );
  return result.rows[0] || null;
}

async function loadProposalContext(client, tenantId, proposalId) {
  const proposal = await ensureInfoRecord(client, tenantId, proposalId, "CRM_INTAKE_PROPOSAL");
  if (!proposal) return null;
  const links = await client.query(
    `SELECT id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs, created_at
     FROM eip_core.object_link
     WHERE tenant_id=$1 AND is_active=true
       AND ((src_kind='info_record' AND src_id=$2) OR (dst_kind='info_record' AND dst_id=$2))
     ORDER BY created_at ASC`,
    [tenantId, proposalId]
  );
  const rawLink = links.rows.find((item) => item.relation_type === "STRUCTURED_AS" && item.dst_id === proposalId);
  const reviewLink = links.rows.find((item) => item.relation_type === "INTAKE_REVIEW_CONTEXT" && item.src_id === proposalId);
  const convertedLink = links.rows.find((item) => item.relation_type === "INTAKE_CONVERTED_TO" && item.src_id === proposalId);
  return {
    proposal,
    links: links.rows,
    raw_record_id: rawLink?.src_id || proposal.payload?.raw_record_id || null,
    review_object_id: reviewLink?.dst_id || proposal.payload?.review_object_id || null,
    converted: convertedLink || null
  };
}

async function appendDecision(client, tenantId, actorAgentId, proposalId, decision, attrs = {}) {
  const item = await insertInfoRecord(client, tenantId, actorAgentId, {
    record_type: "CRM_INTAKE_DECISION",
    title: `CRM intake ${decision}`,
    description: sanitizeIntakeText(attrs.note, 500),
    payload: {
      proposal_id: proposalId,
      decision,
      decided_at: new Date().toISOString(),
      human_reviewed: true,
      converted_kind: normalizeOptionalText(attrs.converted_kind, 80),
      converted_id: normalizeOptionalText(attrs.converted_id, 36)
    }
  });
  await insertLink(client, tenantId, {
    src_kind: "info_record",
    src_id: proposalId,
    dst_kind: "info_record",
    dst_id: item.id,
    relation_type: "INTAKE_DECISION"
  });
  return item;
}

async function advanceReview(client, app, session, context, action, payload = {}) {
  if (!context.review_object_id) return { ok: false, error: "INTAKE_REVIEW_CONTEXT_REQUIRED" };
  return advanceObjectProcess(client, app, {
    tenantId: session.tenant_id,
    identityId: session.identity_id,
    serviceObjectId: context.review_object_id,
    action,
    payload,
    idempotencyKey: sha256Hex(`crm-intake-review:${context.proposal.id}:${action}`)
  });
}

async function ensureIntakeReviewContext(client, app, session, raw, proposal) {
  const started = await startObjectProcess(client, app, {
    tenantId: session.tenant_id,
    identityId: session.identity_id,
    objectType: "CRM_INTAKE_REVIEW",
    idempotencyKey: `crm-intake-review:${proposal.id}`,
    serviceObject: {
      object_type: "CRM_INTAKE_REVIEW",
      status: "captured",
      title: proposal.title || "CRM intake review",
      attrs: {
        raw_record_id: raw.id,
        proposal_id: proposal.id,
        source_type: proposal.payload?.source_type,
        extractor_type: proposal.payload?.extractor_type
      }
    }
  });
  if (!started.ok) return started;
  await insertLink(client, session.tenant_id, {
    src_kind: "info_record",
    src_id: raw.id,
    dst_kind: "service_object",
    dst_id: started.service_object.id,
    relation_type: "INTAKE_REVIEW_CONTEXT"
  });
  await insertLink(client, session.tenant_id, {
    src_kind: "info_record",
    src_id: proposal.id,
    dst_kind: "service_object",
    dst_id: started.service_object.id,
    relation_type: "INTAKE_REVIEW_CONTEXT"
  });
  for (const action of ["structured", "needs_review"]) {
    const advanced = await advanceObjectProcess(client, app, {
      tenantId: session.tenant_id,
      identityId: session.identity_id,
      serviceObjectId: started.service_object.id,
      action,
      idempotencyKey: sha256Hex(`crm-intake-review:${proposal.id}:${action}`)
    });
    if (!advanced.ok) return advanced;
  }
  return { ok: true, service_object: started.service_object };
}

async function createTaskForObject(client, app, session, serviceObjectId, task, keyPrefix) {
  const serviceObject = await ensureServiceObject(client, session.tenant_id, serviceObjectId);
  if (!serviceObject) return { ok: false, error: "TASK_TARGET_NOT_FOUND" };
  return advanceObjectProcess(client, app, {
    tenantId: session.tenant_id,
    identityId: session.identity_id,
    serviceObjectId,
    action: "task.create",
    payload: {
      task_type: normalizeOptionalText(task.task_type, 80) || "FOLLOW_UP",
      title: normalizeOptionalText(task.title, 200) || "Review CRM intake",
      description: normalizeOptionalText(task.description, 1000),
      assigned_agent_id: normalizeOptionalText(task.assigned_agent_id, 36),
      due_at: normalizeOptionalText(task.due_at, 50),
      attrs: { source: "crm_intake", ...sanitizeMetadata(task.attrs || {}) }
    },
    idempotencyKey: sha256Hex(`${keyPrefix}:${JSON.stringify(task || {})}`)
  });
}

async function convertProposal(client, app, session, context, body = {}) {
  const proposal = context.proposal;
  if (proposal.payload?.proposal_status === "converted" && context.converted) {
    return { ok: true, reused: true, converted: context.converted };
  }
  if (proposal.payload?.proposal_status !== "approved") return { ok: false, status: 409, error: "INTAKE_APPROVAL_REQUIRED" };
  const targetType = normalizeText(body.suggested_object_type || proposal.payload?.suggested_object_type).toUpperCase();
  if (!CONVERSION_TYPES.has(targetType)) return { ok: false, status: 400, error: "INTAKE_CONVERSION_TYPE_INVALID" };
  if (targetType === "IGNORE") return { ok: false, status: 400, error: "USE_INTAKE_IGNORE" };

  const actorAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
  const linkedAgentId = normalizeOptionalText(body.agent_id || proposal.payload?.detected_agent_id, 36);
  const linkedAgent = linkedAgentId ? await ensureAgent(client, session.tenant_id, linkedAgentId) : null;
  if (linkedAgentId && !linkedAgent) return { ok: false, status: 404, error: "DETECTED_AGENT_NOT_FOUND" };
  let convertedKind = null;
  let convertedId = null;
  let taskTargetId = context.review_object_id;

  if (PROCESS_OBJECT_TYPES.has(targetType)) {
    const role = targetType === "CRM_CASE" ? "REQUESTER" : targetType === "CRM_INTERACTION" ? "CONTACT" : "PROSPECT";
    const started = await startObjectProcess(client, app, {
      tenantId: session.tenant_id,
      identityId: session.identity_id,
      objectType: targetType,
      idempotencyKey: `crm-intake-convert:${proposal.id}:${targetType}`,
      serviceObject: {
        object_type: targetType,
        status: "new",
        title: normalizeOptionalText(body.title || proposal.payload?.suggested_title, 200) || "CRM intake",
        attrs: {
          description: normalizeOptionalText(body.description || proposal.payload?.suggested_summary, 1000),
          source: "crm_intake",
          source_type: proposal.payload?.source_type,
          intake_proposal_id: proposal.id,
          priority: normalizeOptionalText(body.priority || proposal.payload?.suggested_priority, 80)
        },
        owner_agent_id: actorAgentId,
        parties: linkedAgent ? [{ role, agent_id: linkedAgent.id }] : []
      }
    });
    if (!started.ok) return { ok: false, status: 409, error: started.error };
    convertedKind = "service_object";
    convertedId = started.service_object.id;
    taskTargetId = convertedId;
  } else if (targetType === "CRM_SIGNAL") {
    const signal = await insertInfoRecord(client, session.tenant_id, actorAgentId, {
      record_type: "CRM_SIGNAL",
      title: normalizeOptionalText(body.title || proposal.payload?.suggested_title, 200),
      description: normalizeOptionalText(body.description || proposal.payload?.suggested_summary, 1000),
      payload: {
        signal_type: "manual_observation",
        source_channel: normalizeOptionalText(proposal.payload?.source_channel, 80) || "manual",
        metric: "crm_intake",
        value: 1,
        unit: "count",
        observed_at: new Date().toISOString(),
        confidence: proposal.payload?.confidence,
        redacted: true,
        intake_proposal_id: proposal.id
      }
    });
    convertedKind = "info_record";
    convertedId = signal.id;
  } else if (targetType === "NOTE_ONLY") {
    const note = await insertInfoRecord(client, session.tenant_id, actorAgentId, {
      record_type: "CRM_ACTIVITY_LOG",
      title: normalizeOptionalText(body.title || proposal.payload?.suggested_title, 200),
      description: normalizeOptionalText(body.description || proposal.payload?.suggested_summary, 1000),
      payload: { intake_proposal_id: proposal.id, source: "crm_intake" }
    });
    convertedKind = "info_record";
    convertedId = note.id;
  } else if (targetType === "TASK_ONLY") {
    const task = body.task || proposal.payload?.suggested_tasks?.[0] || {};
    const advanced = await createTaskForObject(client, app, session, context.review_object_id, task, `crm-intake-task-only:${proposal.id}`);
    if (!advanced.ok) return { ok: false, status: 409, error: advanced.error };
    const effect = (advanced.entry?.effects_applied || []).find((item) => item.type === "TASK_CREATE");
    convertedKind = "task";
    convertedId = effect?.task_id || null;
  }

  if (!convertedId) return { ok: false, status: 409, error: "INTAKE_CONVERSION_FAILED" };
  await insertLink(client, session.tenant_id, {
    src_kind: "info_record",
    src_id: proposal.id,
    dst_kind: convertedKind,
    dst_id: convertedId,
    relation_type: "INTAKE_CONVERTED_TO",
    attrs: { suggested_object_type: targetType }
  });
  if (context.raw_record_id) {
    await insertLink(client, session.tenant_id, {
      src_kind: "info_record",
      src_id: context.raw_record_id,
      dst_kind: convertedKind,
      dst_id: convertedId,
      relation_type: "INTAKE_SOURCE_FOR"
    });
  }

  if (PROCESS_OBJECT_TYPES.has(targetType) && body.create_suggested_tasks !== false) {
    for (const [index, task] of (proposal.payload?.suggested_tasks || []).slice(0, 10).entries()) {
      const advanced = await createTaskForObject(client, app, session, taskTargetId, task, `crm-intake-suggested-task:${proposal.id}:${index}`);
      if (!advanced.ok) return { ok: false, status: 409, error: advanced.error };
    }
  }

  const advanced = await advanceReview(client, app, session, context, "converted", { converted_kind: convertedKind, converted_id: convertedId });
  if (!advanced.ok) return { ok: false, status: 409, error: advanced.error };
  const updated = await updateProposalPayload(client, session.tenant_id, proposal.id, {
    proposal_status: "converted",
    human_reviewed: true,
    converted_kind: convertedKind,
    converted_id: convertedId,
    converted_at: new Date().toISOString()
  });
  await appendDecision(client, session.tenant_id, actorAgentId, proposal.id, "converted", {
    converted_kind: convertedKind,
    converted_id: convertedId,
    note: body.note
  });
  return { ok: true, item: updated, converted: { dst_kind: convertedKind, dst_id: convertedId }, reused: false };
}

export default async function registerCrmIntakeRoutes(app) {
  app.get("/intake/overview", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_INTAKE_READ");
    if (!session || !(await requireIntakeCapability(app, session, reply))) return;
    const [statuses, suggested, recent] = await Promise.all([
      app.db.query(
        `SELECT COALESCE(payload->>'proposal_status','needs_review') AS code, count(*)::int AS count
         FROM eip_core.info_record WHERE tenant_id=$1 AND record_type='CRM_INTAKE_PROPOSAL' AND is_active=true
         GROUP BY 1 ORDER BY 1`,
        [session.tenant_id]
      ),
      app.db.query(
        `SELECT COALESCE(payload->>'suggested_object_type','UNKNOWN') AS code, count(*)::int AS count
         FROM eip_core.info_record WHERE tenant_id=$1 AND record_type='CRM_INTAKE_PROPOSAL' AND is_active=true
         GROUP BY 1 ORDER BY count DESC, code`,
        [session.tenant_id]
      ),
      app.db.query(
        `SELECT id, title, description, payload, created_at
         FROM eip_core.info_record WHERE tenant_id=$1 AND record_type='CRM_INTAKE_PROPOSAL' AND is_active=true
         ORDER BY created_at DESC LIMIT 8`,
        [session.tenant_id]
      )
    ]);
    const byStatus = Object.fromEntries(statuses.rows.map((item) => [item.code, Number(item.count || 0)]));
    return reply.send({
      ok: true,
      kpis: {
        needs_review: byStatus.needs_review || 0,
        approved: byStatus.approved || 0,
        converted: byStatus.converted || 0,
        ignored: byStatus.ignored || 0
      },
      by_status: statuses.rows,
      by_suggested_object_type: suggested.rows,
      recent: recent.rows
    });
  });

  app.get("/intake", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_INTAKE_READ");
    if (!session || !(await requireIntakeCapability(app, session, reply))) return;
    const params = [session.tenant_id];
    const filters = ["tenant_id=$1", "record_type='CRM_INTAKE_PROPOSAL'", "is_active=true"];
    for (const [queryKey, payloadKey] of [["status", "proposal_status"], ["source_type", "source_type"], ["suggested_object_type", "suggested_object_type"]]) {
      const value = normalizeOptionalText(req.query?.[queryKey], 100);
      if (!value) continue;
      params.push(queryKey === "suggested_object_type" ? value.toUpperCase() : value.toLowerCase());
      filters.push(`payload->>'${payloadKey}'=$${params.length}`);
    }
    if (req.query?.min_confidence !== undefined) {
      const confidence = Number(req.query.min_confidence);
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return reply.code(400).send({ ok: false, error: "MIN_CONFIDENCE_INVALID" });
      params.push(confidence);
      filters.push(`COALESCE((payload->>'confidence')::numeric,0) >= $${params.length}`);
    }
    for (const [field, operator] of [["created_from", ">="], ["created_to", "<="]]) {
      const rawDate = normalizeOptionalText(req.query?.[field], 40);
      if (!rawDate) continue;
      const parsedDate = Date.parse(rawDate);
      if (!Number.isFinite(parsedDate)) return reply.code(400).send({ ok: false, error: "INTAKE_DATE_FILTER_INVALID", field });
      params.push(new Date(parsedDate).toISOString());
      filters.push(`created_at ${operator} $${params.length}::timestamptz`);
    }
    params.push(clampLimit(req.query?.limit), Math.max(0, Number(req.query?.offset || 0)));
    const result = await app.db.query(
      `SELECT id, record_type, title, description, payload, attrs,
              payload->>'proposal_status' AS status,
              payload->>'source_type' AS source_type,
              payload->>'suggested_object_type' AS suggested_object_type,
              created_at, updated_at
       FROM eip_core.info_record WHERE ${filters.join(" AND ")}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return reply.send({ ok: true, items: result.rows, limit: params.at(-2), offset: params.at(-1) });
  });

  app.post("/intake/manual", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_INTAKE_WRITE");
    if (!session || !(await requireIntakeCapability(app, session, reply))) return;
    const body = req.body || {};
    const sourceType = normalizeStatus(body.source_type) || "manual";
    if (!INTAKE_SOURCE_TYPES.has(sourceType)) return reply.code(400).send({ ok: false, error: "INTAKE_SOURCE_TYPE_INVALID" });
    if (!normalizeOptionalText(body.subject || body.title || body.body || body.message, 4000)) {
      return reply.code(400).send({ ok: false, error: "INTAKE_CONTENT_REQUIRED" });
    }
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const governed = await validateDropdownValue(client, session.tenant_id, "CRM_INTAKE_SOURCE_TYPE", sourceType);
      if (!governed.ok) {
        await client.query("ROLLBACK");
        return reply.code(400).send({ ok: false, ...governed });
      }
      const actorAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
      const sourceRefHash = sha256Hex(normalizeOptionalText(body.source_ref, 1000) || JSON.stringify({
        source_type: sourceType,
        subject: normalizeOptionalText(body.subject || body.title, 200),
        body: normalizeOptionalText(body.body || body.message, 4000),
        from_email: normalizeOptionalText(body.from_email, 254),
        from_phone: normalizeOptionalText(body.from_phone, 40)
      }));
      const duplicate = await client.query(
        `SELECT proposal.id, proposal.record_type, proposal.title, proposal.description, proposal.payload, proposal.attrs, proposal.created_at, proposal.updated_at
         FROM eip_core.info_record raw
         JOIN eip_core.object_link link ON link.tenant_id=raw.tenant_id AND link.src_kind='info_record' AND link.src_id=raw.id
           AND link.dst_kind='info_record' AND link.relation_type='STRUCTURED_AS' AND link.is_active=true
         JOIN eip_core.info_record proposal ON proposal.tenant_id=link.tenant_id AND proposal.id=link.dst_id
           AND proposal.record_type='CRM_INTAKE_PROPOSAL' AND proposal.is_active=true
         WHERE raw.tenant_id=$1 AND raw.record_type='CRM_INTAKE_RAW' AND raw.is_active=true
           AND raw.payload->>'source_ref_hash'=$2 LIMIT 1`,
        [session.tenant_id, sourceRefHash]
      );
      if (duplicate.rowCount) {
        await client.query("ROLLBACK");
        return reply.send({ ok: true, reused: true, item: duplicate.rows[0] });
      }
      const policies = await loadIntakePolicies(client, session.tenant_id);
      const rawPayload = {
        source_type: sourceType,
        source_channel: normalizeStatus(body.source_channel) || "manual",
        source_ref_hash: sourceRefHash,
        subject: sanitizeIntakeText(body.subject || body.title, 200),
        body: sanitizeIntakeText(body.body || body.message, 4000),
        detected_contact: buildDetectedContact(body),
        received_at: new Date().toISOString(),
        redacted: true
      };
      const raw = await insertInfoRecord(client, session.tenant_id, actorAgentId, {
        record_type: "CRM_INTAKE_RAW",
        title: rawPayload.subject || "Incoming CRM intake",
        description: rawPayload.body,
        payload: rawPayload
      });
      const extraction = runIntakeExtraction({
        adapter: normalizeStatus(body.extractor_type) || "rule_based",
        input: { ...body, source_type: sourceType, source_ref: sourceRefHash, raw_record_id: raw.id },
        policies
      });
      if (!extraction.ok) {
        await client.query("ROLLBACK");
        return reply.code(400).send(extraction);
      }
      const proposalPayload = { ...extraction.proposal, source_ref_hash: sourceRefHash, raw_record_id: raw.id };
      const proposal = await insertInfoRecord(client, session.tenant_id, actorAgentId, {
        record_type: "CRM_INTAKE_PROPOSAL",
        title: proposalPayload.suggested_title,
        description: proposalPayload.suggested_summary,
        payload: proposalPayload,
        attrs: { extractor_type: extraction.adapter }
      });
      await insertLink(client, session.tenant_id, {
        src_kind: "info_record",
        src_id: raw.id,
        dst_kind: "info_record",
        dst_id: proposal.id,
        relation_type: "STRUCTURED_AS"
      });
      const review = await ensureIntakeReviewContext(client, app, session, raw, proposal);
      if (!review.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: review.error });
      }
      const updated = await updateProposalPayload(client, session.tenant_id, proposal.id, { review_object_id: review.service_object.id });
      await client.query("COMMIT");
      return reply.send({ ok: true, reused: false, item: updated, raw_record_id: raw.id, review_object_id: review.service_object.id });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_intake_manual_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.get("/intake/:id", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_INTAKE_READ");
    if (!session || !(await requireIntakeCapability(app, session, reply))) return;
    const context = await loadProposalContext(app.db, session.tenant_id, req.params.id);
    if (!context) return reply.code(404).send({ ok: false, error: "INTAKE_PROPOSAL_NOT_FOUND" });
    const raw = context.raw_record_id ? await ensureInfoRecord(app.db, session.tenant_id, context.raw_record_id, "CRM_INTAKE_RAW") : null;
    return reply.send({ ok: true, item: context.proposal, raw, links: context.links });
  });

  app.patch("/intake/:id", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_INTAKE_WRITE");
    if (!session || !(await requireIntakeCapability(app, session, reply))) return;
    const context = await loadProposalContext(app.db, session.tenant_id, req.params.id);
    if (!context) return reply.code(404).send({ ok: false, error: "INTAKE_PROPOSAL_NOT_FOUND" });
    if (["ignored", "converted"].includes(context.proposal.payload?.proposal_status)) {
      return reply.code(409).send({ ok: false, error: "INTAKE_PROPOSAL_FINAL" });
    }
    const targetType = normalizeText(req.body?.suggested_object_type || context.proposal.payload?.suggested_object_type).toUpperCase();
    if (!CONVERSION_TYPES.has(targetType)) return reply.code(400).send({ ok: false, error: "INTAKE_CONVERSION_TYPE_INVALID" });
    const priority = normalizeText(req.body?.suggested_priority || context.proposal.payload?.suggested_priority).toUpperCase();
    const governed = await validateDropdownValue(app.db, session.tenant_id, "CRM_PRIORITY", priority);
    if (!governed.ok) return reply.code(400).send({ ok: false, ...governed });
    const item = await updateProposalPayload(app.db, session.tenant_id, req.params.id, {
      suggested_object_type: targetType,
      suggested_title: normalizeOptionalText(req.body?.suggested_title || context.proposal.payload?.suggested_title, 200),
      suggested_summary: sanitizeIntakeText(req.body?.suggested_summary || context.proposal.payload?.suggested_summary, 1000),
      suggested_priority: priority,
      suggested_tasks: Array.isArray(req.body?.suggested_tasks) ? sanitizeMetadata(req.body.suggested_tasks).slice(0, 10) : context.proposal.payload?.suggested_tasks || []
    });
    return reply.send({ ok: true, item });
  });

  app.post("/intake/:id/approve", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_INTAKE_APPROVE");
    if (!session || !(await requireIntakeCapability(app, session, reply))) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const context = await loadProposalContext(client, session.tenant_id, req.params.id);
      if (!context) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "INTAKE_PROPOSAL_NOT_FOUND" });
      }
      if (["ignored", "converted"].includes(context.proposal.payload?.proposal_status)) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: "INTAKE_PROPOSAL_FINAL" });
      }
      const actorAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
      if (context.proposal.payload?.proposal_status !== "approved") {
        const advanced = await advanceReview(client, app, session, context, "approved");
        if (!advanced.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: advanced.error });
        }
        await updateProposalPayload(client, session.tenant_id, req.params.id, {
          proposal_status: "approved",
          human_reviewed: true,
          approved_at: new Date().toISOString()
        });
        await appendDecision(client, session.tenant_id, actorAgentId, req.params.id, "approved", { note: req.body?.note });
      }
      const refreshed = await loadProposalContext(client, session.tenant_id, req.params.id);
      const converted = req.body?.convert === true ? await convertProposal(client, app, session, refreshed, req.body) : null;
      if (converted && !converted.ok) {
        await client.query("ROLLBACK");
        return reply.code(converted.status || 409).send({ ok: false, error: converted.error });
      }
      await client.query("COMMIT");
      return reply.send({ ok: true, item: converted?.item || refreshed.proposal, converted: converted?.converted || null });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_intake_approve_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.post("/intake/:id/ignore", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_INTAKE_APPROVE");
    if (!session || !(await requireIntakeCapability(app, session, reply))) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const context = await loadProposalContext(client, session.tenant_id, req.params.id);
      if (!context) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "INTAKE_PROPOSAL_NOT_FOUND" });
      }
      if (context.proposal.payload?.proposal_status === "converted") {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: "INTAKE_PROPOSAL_FINAL" });
      }
      if (context.proposal.payload?.proposal_status !== "ignored") {
        const advanced = await advanceReview(client, app, session, context, "ignored");
        if (!advanced.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: advanced.error });
        }
        const actorAgentId = await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
        await updateProposalPayload(client, session.tenant_id, req.params.id, {
          proposal_status: "ignored",
          human_reviewed: true,
          ignored_at: new Date().toISOString()
        });
        await appendDecision(client, session.tenant_id, actorAgentId, req.params.id, "ignored", { note: req.body?.note });
      }
      await client.query("COMMIT");
      return reply.send({ ok: true });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_intake_ignore_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.post("/intake/:id/convert", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_INTAKE_CONVERT");
    if (!session || !(await requireIntakeCapability(app, session, reply))) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const context = await loadProposalContext(client, session.tenant_id, req.params.id);
      if (!context) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "INTAKE_PROPOSAL_NOT_FOUND" });
      }
      const converted = await convertProposal(client, app, session, context, req.body || {});
      if (!converted.ok) {
        await client.query("ROLLBACK");
        return reply.code(converted.status || 409).send({ ok: false, error: converted.error });
      }
      await client.query("COMMIT");
      return reply.send(converted);
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_intake_convert_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.post("/intake/:id/tasks", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_INTAKE_WRITE");
    if (!session || !(await requireIntakeCapability(app, session, reply))) return;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const context = await loadProposalContext(client, session.tenant_id, req.params.id);
      if (!context) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "INTAKE_PROPOSAL_NOT_FOUND" });
      }
      const serviceObjectId = context.converted?.dst_kind === "service_object" ? context.converted.dst_id : context.review_object_id;
      const advanced = await createTaskForObject(client, app, session, serviceObjectId, req.body || {}, `crm-intake-task:${context.proposal.id}`);
      if (!advanced.ok) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: advanced.error });
      }
      await client.query("COMMIT");
      return reply.send({ ok: true, effects: advanced.entry?.effects_applied || [], reused: advanced.reused === true });
    } catch (error) {
      await client.query("ROLLBACK");
      app.log.error({ event: "crm_intake_task_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.get("/intake/:id/timeline", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_INTAKE_READ");
    if (!session || !(await requireIntakeCapability(app, session, reply))) return;
    const context = await loadProposalContext(app.db, session.tenant_id, req.params.id);
    if (!context) return reply.code(404).send({ ok: false, error: "INTAKE_PROPOSAL_NOT_FOUND" });
    const linkedIds = [context.proposal.id, context.raw_record_id, ...context.links.filter((item) => item.dst_kind === "info_record").map((item) => item.dst_id)].filter(Boolean);
    const result = await app.db.query(
      `SELECT id, record_type, title, description, payload, attrs, created_at
       FROM eip_core.info_record WHERE tenant_id=$1 AND id=ANY($2::uuid[]) AND is_active=true
       ORDER BY created_at DESC`,
      [session.tenant_id, [...new Set(linkedIds)]]
    );
    return reply.send({ ok: true, items: result.rows.map((item) => ({ kind: item.record_type.toLowerCase(), ...item, occurred_at: item.created_at })) });
  });
}

export {
  DEFAULT_AI_EXTRACTION_POLICY,
  DEFAULT_AUTOMATION_POLICY,
  extractRuleBasedProposal,
  registerIntakeExtractionAdapter,
  runIntakeExtraction,
  sanitizeIntakeText
};
