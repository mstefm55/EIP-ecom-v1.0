import { randomBytes } from "node:crypto";
import { emitSecurityEvent } from "../../lib/securityAudit.js";
import { allowedCodesFrom, loadDropdownCodeSets, loadModuleWorkspace } from "../moduleWorkspace.js";
import {
  EffectivePolicyInputError,
  normalizeEffectivePolicyQuery,
  resolveEffectivePolicy
} from "../policiesConditions/effectivePolicy.js";

const MAX_LIMIT = 200;
const TENANT_OVERRIDE_RE = /^tenant(_id)?$/i;
const SENSITIVE_KEY_RE = /(secret|token|password|credential|cookie|authorization|signature|api[_-]?key|private[_-]?key|client[_-]?secret|raw[_-]?legal|legal[_-]?text|compliance[_-]?text|raw[_-]?email|email[_-]?body|body[_-]?raw)/i;

export const CRM_MANAGEMENT_PERMISSIONS = Object.freeze({
  read: "crm.read",
  accountCreate: "crm.account.create",
  accountUpdate: "crm.account.update",
  contactManage: "crm.contact.manage",
  opportunityCreate: "crm.opportunity.create",
  opportunityUpdate: "crm.opportunity.update",
  activityCreate: "crm.activity.create",
  activityUpdate: "crm.activity.update",
  convert: "crm.convert",
  policyRead: "crm.policy.read"
});

export const CRM_ACCOUNT_STATUSES = Object.freeze([
  "PROSPECT",
  "ACTIVE_CUSTOMER",
  "INACTIVE_CUSTOMER",
  "UNDER_REVIEW",
  "BLOCKED",
  "ARCHIVED"
]);

export const CRM_OPPORTUNITY_STATUSES = Object.freeze([
  "NEW",
  "QUALIFYING",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
  "CANCELLED",
  "ARCHIVED"
]);

export const CRM_ACTIVITY_STATUSES = Object.freeze([
  "OPEN",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
  "BLOCKED"
]);

const CRM_DROPDOWN_CODES = Object.freeze([
  "CRM_ACCOUNT_STATUS",
  "ENTITY_ROLE",
  "ENTITY_KIND",
  "ENTITY_CONTACT_TYPE",
  "CRM_OPPORTUNITY_STATUS",
  "TASK_STATUS",
  "CRM_TASK_TYPE"
]);

const ACCOUNT_FIELDS = new Set([
  "entity_kind",
  "account_type",
  "code",
  "name",
  "display_name",
  "legal_name",
  "roles",
  "status",
  "source",
  "website",
  "country_code",
  "currency_code",
  "notes",
  "parent_agent_id",
  "attrs"
]);

const CONTACT_FIELDS = new Set([
  "contact_type",
  "label",
  "value",
  "is_primary",
  "is_active",
  "attrs"
]);

const OPPORTUNITY_FIELDS = new Set([
  "account_id",
  "customer_agent_id",
  "owner_agent_id",
  "code",
  "title",
  "description",
  "status",
  "stage",
  "value_amount",
  "amount",
  "value",
  "currency",
  "value_currency",
  "probability",
  "expected_close_at",
  "expected_close_date",
  "source",
  "next_step",
  "attrs"
]);

const ACTIVITY_FIELDS = new Set([
  "account_id",
  "opportunity_id",
  "service_object_id",
  "task_type",
  "status",
  "title",
  "description",
  "assigned_agent_id",
  "due_at",
  "notes",
  "attrs",
  "payload"
]);

const CONVERT_FIELDS = new Set(["note", "reason_code", "next_step", "idempotency_key"]);

export class CrmInputError extends Error {
  constructor(code, details = null) {
    super(code);
    this.name = "CrmInputError";
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
  if (!text) return null;
  return text.slice(0, maxLength);
}

function normalizeCode(value, fallback = null) {
  const text = normalizeText(value || fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return text || fallback;
}

function toStoredStatus(value, fallback, governance, listCode, allowedStatuses) {
  const status = normalizeCode(value, fallback);
  const allowed = allowedCodesFrom(governance, listCode, allowedStatuses);
  if (!allowed.includes(status)) throw new CrmInputError("INVALID_STATUS", { status, listCode });
  return status.toLowerCase();
}

function toApiStatus(value, fallback = null) {
  return normalizeCode(value, fallback);
}

function finiteNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampLimit(value) {
  const parsed = Number(value || 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
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
    if (TENANT_OVERRIDE_RE.test(key)) throw new CrmInputError("TENANT_OVERRIDE_NOT_ALLOWED", { path });
    if (SENSITIVE_KEY_RE.test(key)) throw new CrmInputError("SENSITIVE_FIELD_NOT_ALLOWED", { path, field: key });
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
    if (TENANT_OVERRIDE_RE.test(key)) throw new CrmInputError("TENANT_OVERRIDE_NOT_ALLOWED");
    if (!allowed.has(key)) throw new CrmInputError("UNKNOWN_FIELD", { label, field: key });
  }
}

function rejectTenantQuery(query = {}) {
  for (const key of Object.keys(query || {})) {
    if (TENANT_OVERRIDE_RE.test(key)) throw new CrmInputError("TENANT_OVERRIDE_NOT_ALLOWED");
  }
}

function normalizeRoles(value, fallback = ["PROSPECT"], governance = null) {
  const roles = Array.isArray(value) ? value : value ? [value] : fallback;
  const allowed = allowedCodesFrom(governance, "ENTITY_ROLE", []);
  return [...new Set(roles.map((item) => normalizeCode(item, null)).filter(Boolean))]
    .filter((role) => !allowed.length || allowed.includes(role) || ["PROSPECT", "CUSTOMER", "PARTNER", "LEAD_SOURCE", "OTHER"].includes(role))
    .slice(0, 20);
}

function buildCode(prefix) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function displayLabel(code) {
  const text = normalizeText(code).replace(/_/g, " ").toLowerCase();
  return text ? text.replace(/\b\w/g, (char) => char.toUpperCase()) : null;
}

async function emitMutation(app, session, eventType, metadata = {}) {
  await emitSecurityEvent(app, eventType, {
    category: "crm",
    source: "crm.management.v1",
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

async function fetchAccount(client, tenantId, accountId) {
  const result = await client.query(
    `
    SELECT id, agent_type, code, name, attrs, parent_agent_id, is_active, created_at, updated_at
    FROM eip_core.agent
    WHERE tenant_id=$1 AND id=$2
    `,
    [tenantId, accountId]
  );
  return result.rows[0] || null;
}

async function fetchOpportunity(client, tenantId, opportunityId) {
  const result = await client.query(
    `
    SELECT so.id, so.object_type, so.status, so.code, so.title, so.attrs, so.owner_agent_id, so.created_at, so.updated_at,
           customer.agent_id AS account_id,
           account.name AS account_name
    FROM eip_core.service_object so
    LEFT JOIN LATERAL (
      SELECT sop.agent_id
      FROM eip_core.service_object_party sop
      WHERE sop.tenant_id=so.tenant_id
        AND sop.service_object_id=so.id
        AND sop.role IN ('CUSTOMER','PROSPECT','ACCOUNT')
      ORDER BY CASE sop.role WHEN 'CUSTOMER' THEN 0 WHEN 'ACCOUNT' THEN 1 ELSE 2 END, sop.created_at ASC
      LIMIT 1
    ) customer ON true
    LEFT JOIN eip_core.agent account
      ON account.tenant_id=so.tenant_id AND account.id=customer.agent_id
    WHERE so.tenant_id=$1
      AND so.id=$2
      AND so.object_type='CRM_OPPORTUNITY'
    `,
    [tenantId, opportunityId]
  );
  return result.rows[0] || null;
}

function safeAccount(row = {}) {
  const attrs = asObject(row.attrs);
  const crm = asObject(attrs.crm_management_v1);
  const roles = Array.isArray(crm.roles) ? crm.roles : Array.isArray(attrs.roles) ? attrs.roles : [];
  return {
    id: row.id,
    entity_kind: crm.entity_kind || row.agent_type || "ORG",
    account_type: row.agent_type || "ORG",
    code: row.code || null,
    display_name: row.name || crm.display_name || null,
    name: row.name || null,
    legal_name: crm.legal_name || attrs.legal_name || null,
    roles,
    status: toApiStatus(crm.status || attrs.status || (row.is_active === false ? "ARCHIVED" : "PROSPECT"), "PROSPECT"),
    source: crm.source || null,
    website: crm.website || null,
    country_code: crm.country_code || null,
    currency_code: crm.currency_code || null,
    notes: crm.notes || null,
    parent_agent_id: row.parent_agent_id || null,
    is_active: row.is_active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function safeOpportunity(row = {}) {
  const attrs = asObject(row.attrs);
  const crm = asObject(attrs.crm_management_v1);
  const value = asObject(crm.value || attrs.value);
  return {
    id: row.id,
    object_type: row.object_type || "CRM_OPPORTUNITY",
    code: row.code || null,
    title: row.title || null,
    status: toApiStatus(row.status, "NEW"),
    account_id: row.account_id || crm.account_id || null,
    account_name: row.account_name || crm.account_name || null,
    owner_agent_id: row.owner_agent_id || null,
    description: crm.description || attrs.description || null,
    value_amount: finiteNumber(value.amount ?? crm.value_amount ?? attrs.value_amount, null),
    currency: crm.currency || value.currency || attrs.currency || null,
    probability: finiteNumber(crm.probability ?? attrs.probability, null),
    expected_close_at: crm.expected_close_at || attrs.expected_close_at || attrs.expected_close_date || null,
    source: crm.source || attrs.source || null,
    next_step: crm.next_step || null,
    conversion_status: crm.conversion_status || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function safeContact(row = {}) {
  return {
    id: row.id,
    contact_type: toApiStatus(row.contact_type, "EMAIL"),
    label: row.label || null,
    value: row.value || null,
    is_primary: row.is_primary === true,
    is_active: row.is_active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function safeActivity(row = {}) {
  const attrs = asObject(row.attrs);
  const crm = asObject(attrs.crm_management_v1);
  return {
    id: row.id,
    service_object_id: row.service_object_id || null,
    task_type: row.task_type || null,
    status: toApiStatus(row.status, "OPEN"),
    title: row.title || null,
    description: row.description || null,
    assigned_agent_id: row.assigned_agent_id || null,
    due_at: row.due_at || null,
    completed_at: row.completed_at || null,
    account_id: crm.account_id || null,
    opportunity_id: crm.opportunity_id || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function safeInfo(row = {}) {
  return {
    id: row.id,
    record_type: row.record_type,
    title: row.title,
    description: row.description ? row.description.slice(0, 240) : null,
    mime_type: row.mime_type || null,
    file_size: row.file_size || null,
    relation_type: row.relation_type || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function safeCommercialCondition(row = {}) {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    condition_type: row.condition_type,
    condition_category: row.condition_category,
    priority: row.priority,
    valid_from: row.valid_from || null,
    valid_to: row.valid_to || null,
    updated_at: row.updated_at
  };
}

async function listAccountContacts(client, tenantId, accountId) {
  const result = await client.query(
    `
    SELECT id, contact_type, label, value, is_primary, is_active, attrs, created_at, updated_at
    FROM eip_core.entity_contact
    WHERE tenant_id=$1
      AND entity_id=$2
    ORDER BY is_primary DESC, created_at DESC
    `,
    [tenantId, accountId]
  );
  return result.rows.map(safeContact);
}

async function listAccountOpportunities(client, tenantId, accountId) {
  const result = await client.query(
    `
    SELECT so.id, so.object_type, so.status, so.code, so.title, so.attrs, so.owner_agent_id, so.created_at, so.updated_at,
           $2::uuid AS account_id
    FROM eip_core.service_object_party sop
    JOIN eip_core.service_object so
      ON so.tenant_id=sop.tenant_id AND so.id=sop.service_object_id
    WHERE sop.tenant_id=$1
      AND sop.agent_id=$2
      AND sop.role IN ('CUSTOMER','PROSPECT','ACCOUNT')
      AND so.object_type='CRM_OPPORTUNITY'
    ORDER BY so.created_at DESC
    LIMIT 100
    `,
    [tenantId, accountId]
  );
  return result.rows.map(safeOpportunity);
}

async function listAccountActivities(client, tenantId, accountId) {
  const result = await client.query(
    `
    SELECT id, service_object_id, task_type, status, title, description, assigned_agent_id,
           due_at, completed_at, payload, attrs, created_at, updated_at
    FROM eip_core.task
    WHERE tenant_id=$1
      AND attrs->'crm_management_v1'->>'account_id'=$2
    ORDER BY COALESCE(due_at, updated_at, created_at) DESC
    LIMIT 100
    `,
    [tenantId, accountId]
  );
  return result.rows.map(safeActivity);
}

async function listLinkedInfo(client, tenantId, kind, id) {
  const result = await client.query(
    `
    SELECT info.id, info.record_type, info.title, info.description, info.mime_type, info.file_size,
           info.created_at, info.updated_at, link.relation_type
    FROM eip_core.object_link link
    JOIN eip_core.info_record info
      ON info.tenant_id=link.tenant_id
     AND info.id=link.dst_id
     AND info.is_active=true
    WHERE link.tenant_id=$1
      AND link.src_kind=$2
      AND link.src_id=$3
      AND link.dst_kind='info_record'
      AND link.is_active=true
      AND link.relation_type IN ('NOTE','COMMUNICATION','EMAIL_SUMMARY','CALL_SUMMARY','MEETING_SUMMARY','DOCUMENT','ATTACHMENT','CONTRACT_REFERENCE')
    ORDER BY info.created_at DESC
    LIMIT 100
    `,
    [tenantId, kind, id]
  );
  return result.rows.map(safeInfo);
}

async function listAccountCommercialConditions(client, tenantId, accountId) {
  const result = await client.query(
    `
    SELECT id, code, label, condition_type, condition_category, priority, valid_from, valid_to, updated_at
    FROM eip_core.commercial_condition
    WHERE tenant_id=$1
      AND is_active=true
      AND (
        scope @> jsonb_build_object('account_id', $2::text)
        OR scope @> jsonb_build_object('customer_agent_id', $2::text)
        OR scope @> jsonb_build_object('agent_id', $2::text)
        OR attrs->'crm_management_v1'->>'account_id'=$2
      )
    ORDER BY priority ASC, updated_at DESC
    LIMIT 50
    `,
    [tenantId, accountId]
  );
  return result.rows.map(safeCommercialCondition);
}

async function resolvePolicyDomain(app, session, domain, account = null) {
  try {
    return await resolveEffectivePolicy(app, session, normalizeEffectivePolicyQuery({
      policy_domain: domain,
      process_type: "CRM",
      customer_agent_id: account?.id || undefined,
      account_id: account?.id || undefined,
      currency: account?.currency_code || undefined
    }));
  } catch (error) {
    if (error instanceof EffectivePolicyInputError) {
      return { ok: false, resolution_status: "invalid_context", warnings: [], conflicts: [], explanation: [] };
    }
    throw error;
  }
}

async function buildPolicySummary(app, session, accountRow) {
  const account = safeAccount(accountRow);
  const [commercial, approval] = await Promise.all([
    resolvePolicyDomain(app, session, "COMMERCIAL", account),
    resolvePolicyDomain(app, session, "APPROVAL_FRAMEWORK", account)
  ]);
  return {
    commercial_terms: {
      resolution_status: commercial.resolution_status || "unavailable",
      selected_condition: commercial.selected_condition || null,
      warnings: commercial.warnings || [],
      conflicts: commercial.conflicts || [],
      explanation: commercial.explanation || []
    },
    approval_framework: {
      resolution_status: approval.resolution_status || "unavailable",
      selected_condition: approval.selected_condition || null,
      warnings: approval.warnings || [],
      conflicts: approval.conflicts || [],
      explanation: approval.explanation || []
    },
    account_flags: {
      blocked: account.status === "BLOCKED",
      needs_review: account.status === "UNDER_REVIEW"
    }
  };
}

export async function listCrmAccounts(app, session, query = {}) {
  rejectTenantQuery(query);
  const q = normalizeOptionalText(query.q, 200);
  const status = normalizeOptionalText(query.status, 80);
  const role = normalizeOptionalText(query.role, 80);
  const limit = clampLimit(query.limit);
  const offset = Math.max(0, Number(query.offset || 0));
  const params = [session.tenant_id];
  const filters = ["tenant_id=$1"];
  if (q) {
    params.push(`%${q}%`);
    filters.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status.toUpperCase());
    filters.push(`UPPER(COALESCE(attrs->'crm_management_v1'->>'status', attrs->>'status', 'PROSPECT'))=$${params.length}`);
  }
  if (role) {
    params.push(role.toUpperCase());
    filters.push(`(attrs->'crm_management_v1'->'roles' ? $${params.length} OR attrs->'roles' ? $${params.length})`);
  }
  params.push(limit, offset);
  const result = await app.db.query(
    `
    SELECT id, agent_type, code, name, attrs, parent_agent_id, is_active, created_at, updated_at
    FROM eip_core.agent
    WHERE ${filters.join(" AND ")}
      AND (
        attrs ? 'crm_management_v1'
        OR attrs ? 'roles'
        OR UPPER(agent_type) IN ('ORG','PERSON','CUSTOMER','PROSPECT','PARTNER')
      )
    ORDER BY updated_at DESC, created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );
  return { ok: true, items: result.rows.map(safeAccount), limit, offset };
}

export async function createCrmAccount(app, session, body = {}) {
  rejectUnknownKeys(body, ACCOUNT_FIELDS, "crm_account");
  return withTransaction(app, async (client) => {
    const governance = await loadDropdownCodeSets(client, session.tenant_id, ["CRM_ACCOUNT_STATUS", "ENTITY_ROLE", "ENTITY_KIND"]);
    const roles = normalizeRoles(body.roles, ["PROSPECT"], governance);
    const status = toApiStatus(toStoredStatus(body.status, "PROSPECT", governance, "CRM_ACCOUNT_STATUS", CRM_ACCOUNT_STATUSES), "PROSPECT");
    const name = normalizeOptionalText(body.display_name || body.name, 300);
    if (!name) throw new CrmInputError("ACCOUNT_NAME_REQUIRED");
    const attrs = {
      ...normalizeAttrs(body.attrs),
      roles,
      status,
      crm_management_v1: {
        entity_kind: normalizeCode(body.entity_kind || body.account_type, "ORG"),
        legal_name: normalizeOptionalText(body.legal_name, 300),
        roles,
        status,
        source: normalizeOptionalText(body.source, 120),
        website: normalizeOptionalText(body.website, 300),
        country_code: normalizeCode(body.country_code, null),
        currency_code: normalizeCode(body.currency_code, null),
        notes: normalizeOptionalText(body.notes, 1000),
        created_from: "crm_management_v1"
      }
    };
    const result = await client.query(
      `
      INSERT INTO eip_core.agent
        (tenant_id, agent_type, code, name, attrs, parent_agent_id, is_active)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
      RETURNING id, agent_type, code, name, attrs, parent_agent_id, is_active, created_at, updated_at
      `,
      [
        session.tenant_id,
        normalizeCode(body.entity_kind || body.account_type, "ORG"),
        normalizeOptionalText(body.code, 64) || buildCode("CRM-ACC"),
        name,
        JSON.stringify(attrs),
        normalizeOptionalText(body.parent_agent_id, 64),
        status !== "ARCHIVED"
      ]
    );
    await emitMutation(app, session, "crm.account_created", { account_id: result.rows[0].id });
    return { ok: true, item: safeAccount(result.rows[0]) };
  });
}

export async function getCrmAccount(app, session, accountId) {
  const row = await fetchAccount(app.db, session.tenant_id, accountId);
  if (!row) return null;
  const [contacts, opportunities, activities, documents, commercialConditions, policySummary] = await Promise.all([
    listAccountContacts(app.db, session.tenant_id, accountId),
    listAccountOpportunities(app.db, session.tenant_id, accountId),
    listAccountActivities(app.db, session.tenant_id, accountId),
    listLinkedInfo(app.db, session.tenant_id, "agent", accountId),
    listAccountCommercialConditions(app.db, session.tenant_id, accountId),
    buildPolicySummary(app, session, row)
  ]);
  const openOpportunities = opportunities.filter((item) => !["WON", "LOST", "CANCELLED", "ARCHIVED"].includes(item.status));
  const pipelineValue = openOpportunities.reduce((sum, item) => sum + Number(item.value_amount || 0), 0);
  const weightedPipelineValue = openOpportunities.reduce((sum, item) => {
    const probability = Number.isFinite(Number(item.probability)) ? Number(item.probability) : 0;
    return sum + Number(item.value_amount || 0) * probability;
  }, 0);
  const opportunityStatuses = opportunities.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  return {
    ok: true,
    item: safeAccount(row),
    contacts,
    opportunities,
    activities,
    communications: documents.filter((item) => ["NOTE", "COMMUNICATION", "EMAIL_SUMMARY", "CALL_SUMMARY", "MEETING_SUMMARY"].includes(item.relation_type)),
    documents: documents.filter((item) => ["DOCUMENT", "ATTACHMENT", "CONTRACT_REFERENCE"].includes(item.relation_type)),
    commercial_conditions: commercialConditions,
    policy_summary: policySummary,
    summary: {
      contacts: contacts.length,
      opportunities: opportunities.length,
      open_opportunities: openOpportunities.length,
      opportunity_statuses: opportunityStatuses,
      pipeline_value: pipelineValue,
      weighted_pipeline_value: weightedPipelineValue,
      activities: activities.length,
      open_activities: activities.filter((item) => !["DONE", "CANCELLED"].includes(item.status)).length,
      commercial_conditions: commercialConditions.length
    }
  };
}

export async function updateCrmAccount(app, session, accountId, body = {}) {
  rejectUnknownKeys(body, ACCOUNT_FIELDS, "crm_account");
  return withTransaction(app, async (client) => {
    const current = await fetchAccount(client, session.tenant_id, accountId);
    if (!current) return { ok: false, status: 404, error: "NOT_FOUND" };
    const currentSafe = safeAccount(current);
    const governance = await loadDropdownCodeSets(client, session.tenant_id, ["CRM_ACCOUNT_STATUS", "ENTITY_ROLE", "ENTITY_KIND"]);
    const roles = body.roles !== undefined ? normalizeRoles(body.roles, currentSafe.roles, governance) : currentSafe.roles;
    const status = body.status !== undefined
      ? toApiStatus(toStoredStatus(body.status, currentSafe.status, governance, "CRM_ACCOUNT_STATUS", CRM_ACCOUNT_STATUSES), currentSafe.status)
      : currentSafe.status;
    const attrs = {
      ...asObject(current.attrs),
      ...normalizeAttrs(body.attrs),
      roles,
      status,
      crm_management_v1: {
        ...asObject(current.attrs?.crm_management_v1),
        entity_kind: normalizeCode(body.entity_kind || body.account_type, currentSafe.entity_kind),
        legal_name: body.legal_name !== undefined ? normalizeOptionalText(body.legal_name, 300) : currentSafe.legal_name,
        roles,
        status,
        source: body.source !== undefined ? normalizeOptionalText(body.source, 120) : currentSafe.source,
        website: body.website !== undefined ? normalizeOptionalText(body.website, 300) : currentSafe.website,
        country_code: body.country_code !== undefined ? normalizeCode(body.country_code, null) : currentSafe.country_code,
        currency_code: body.currency_code !== undefined ? normalizeCode(body.currency_code, null) : currentSafe.currency_code,
        notes: body.notes !== undefined ? normalizeOptionalText(body.notes, 1000) : currentSafe.notes,
        updated_from: "crm_management_v1"
      }
    };
    const result = await client.query(
      `
      UPDATE eip_core.agent
      SET agent_type=$3,
          code=$4,
          name=$5,
          attrs=$6::jsonb,
          parent_agent_id=$7,
          is_active=$8,
          updated_at=now()
      WHERE tenant_id=$1 AND id=$2
      RETURNING id, agent_type, code, name, attrs, parent_agent_id, is_active, created_at, updated_at
      `,
      [
        session.tenant_id,
        accountId,
        normalizeCode(body.entity_kind || body.account_type, current.agent_type),
        body.code !== undefined ? normalizeOptionalText(body.code, 64) : current.code,
        body.display_name !== undefined || body.name !== undefined ? normalizeOptionalText(body.display_name || body.name, 300) : current.name,
        JSON.stringify(attrs),
        body.parent_agent_id !== undefined ? normalizeOptionalText(body.parent_agent_id, 64) : current.parent_agent_id,
        status !== "ARCHIVED"
      ]
    );
    await emitMutation(app, session, "crm.account_updated", { account_id: accountId, status });
    return { ok: true, item: safeAccount(result.rows[0]) };
  });
}

export async function listCrmAccountContacts(app, session, accountId) {
  const account = await fetchAccount(app.db, session.tenant_id, accountId);
  if (!account) return { ok: false, status: 404, error: "NOT_FOUND" };
  return { ok: true, items: await listAccountContacts(app.db, session.tenant_id, accountId) };
}

export async function createCrmContact(app, session, accountId, body = {}) {
  rejectUnknownKeys(body, CONTACT_FIELDS, "crm_contact");
  return withTransaction(app, async (client) => {
    const account = await fetchAccount(client, session.tenant_id, accountId);
    if (!account) return { ok: false, status: 404, error: "NOT_FOUND" };
    const contactType = normalizeCode(body.contact_type, "EMAIL");
    const value = normalizeOptionalText(body.value, 300);
    if (!value) throw new CrmInputError("CONTACT_VALUE_REQUIRED");
    if (body.is_primary === true) {
      await client.query(
        "UPDATE eip_core.entity_contact SET is_primary=false, updated_at=now() WHERE tenant_id=$1 AND entity_id=$2 AND contact_type=$3",
        [session.tenant_id, accountId, contactType]
      );
    }
    const result = await client.query(
      `
      INSERT INTO eip_core.entity_contact
        (tenant_id, entity_id, contact_type, label, value, is_primary, is_active, attrs)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
      RETURNING id, contact_type, label, value, is_primary, is_active, attrs, created_at, updated_at
      `,
      [
        session.tenant_id,
        accountId,
        contactType,
        normalizeOptionalText(body.label, 120),
        value,
        body.is_primary === true,
        body.is_active !== false,
        JSON.stringify(normalizeAttrs(body.attrs))
      ]
    );
    await emitMutation(app, session, "crm.contact_created", { account_id: accountId, contact_id: result.rows[0].id });
    return { ok: true, item: safeContact(result.rows[0]) };
  });
}

export async function updateCrmContact(app, session, accountId, contactId, body = {}) {
  rejectUnknownKeys(body, CONTACT_FIELDS, "crm_contact");
  return withTransaction(app, async (client) => {
    const account = await fetchAccount(client, session.tenant_id, accountId);
    if (!account) return { ok: false, status: 404, error: "NOT_FOUND" };
    const current = await client.query(
      `
      SELECT id, contact_type, label, value, is_primary, is_active, attrs
      FROM eip_core.entity_contact
      WHERE tenant_id=$1 AND entity_id=$2 AND id=$3
      `,
      [session.tenant_id, accountId, contactId]
    );
    if (!current.rowCount) return { ok: false, status: 404, error: "NOT_FOUND" };
    const nextType = body.contact_type !== undefined ? normalizeCode(body.contact_type, current.rows[0].contact_type) : current.rows[0].contact_type;
    const nextPrimary = body.is_primary !== undefined ? body.is_primary === true : current.rows[0].is_primary === true;
    if (nextPrimary) {
      await client.query(
        "UPDATE eip_core.entity_contact SET is_primary=false, updated_at=now() WHERE tenant_id=$1 AND entity_id=$2 AND contact_type=$3 AND id<>$4",
        [session.tenant_id, accountId, nextType, contactId]
      );
    }
    const result = await client.query(
      `
      UPDATE eip_core.entity_contact
      SET contact_type=$4,
          label=$5,
          value=$6,
          is_primary=$7,
          is_active=$8,
          attrs=COALESCE(attrs,'{}'::jsonb) || $9::jsonb,
          updated_at=now()
      WHERE tenant_id=$1 AND entity_id=$2 AND id=$3
      RETURNING id, contact_type, label, value, is_primary, is_active, attrs, created_at, updated_at
      `,
      [
        session.tenant_id,
        accountId,
        contactId,
        nextType,
        body.label !== undefined ? normalizeOptionalText(body.label, 120) : current.rows[0].label,
        body.value !== undefined ? normalizeOptionalText(body.value, 300) : current.rows[0].value,
        nextPrimary,
        body.is_active !== undefined ? body.is_active !== false : current.rows[0].is_active !== false,
        JSON.stringify(normalizeAttrs(body.attrs))
      ]
    );
    await emitMutation(app, session, "crm.contact_updated", { account_id: accountId, contact_id: contactId });
    return { ok: true, item: safeContact(result.rows[0]) };
  });
}

export async function listCrmOpportunities(app, session, query = {}) {
  rejectTenantQuery(query);
  const params = [session.tenant_id];
  const filters = ["so.tenant_id=$1", "so.object_type='CRM_OPPORTUNITY'"];
  if (normalizeOptionalText(query.status)) {
    params.push(String(query.status).toLowerCase());
    filters.push(`so.status=$${params.length}`);
  }
  const accountId = normalizeOptionalText(query.account_id || query.customer_agent_id || query.agent_id, 64);
  if (accountId) {
    params.push(accountId);
    filters.push(`EXISTS (
      SELECT 1 FROM eip_core.service_object_party sop
      WHERE sop.tenant_id=so.tenant_id
        AND sop.service_object_id=so.id
        AND sop.agent_id=$${params.length}
        AND sop.role IN ('CUSTOMER','PROSPECT','ACCOUNT')
    )`);
  }
  if (normalizeOptionalText(query.q, 200)) {
    params.push(`%${normalizeText(query.q)}%`);
    filters.push(`(so.title ILIKE $${params.length} OR so.code ILIKE $${params.length})`);
  }
  const limit = clampLimit(query.limit);
  const offset = Math.max(0, Number(query.offset || 0));
  params.push(limit, offset);
  const result = await app.db.query(
    `
    SELECT so.id, so.object_type, so.status, so.code, so.title, so.attrs, so.owner_agent_id, so.created_at, so.updated_at,
           customer.agent_id AS account_id,
           account.name AS account_name
    FROM eip_core.service_object so
    LEFT JOIN LATERAL (
      SELECT sop.agent_id
      FROM eip_core.service_object_party sop
      WHERE sop.tenant_id=so.tenant_id
        AND sop.service_object_id=so.id
        AND sop.role IN ('CUSTOMER','PROSPECT','ACCOUNT')
      ORDER BY CASE sop.role WHEN 'CUSTOMER' THEN 0 WHEN 'ACCOUNT' THEN 1 ELSE 2 END, sop.created_at ASC
      LIMIT 1
    ) customer ON true
    LEFT JOIN eip_core.agent account
      ON account.tenant_id=so.tenant_id AND account.id=customer.agent_id
    WHERE ${filters.join(" AND ")}
    ORDER BY so.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );
  return { ok: true, items: result.rows.map(safeOpportunity), limit, offset };
}

export async function createCrmOpportunity(app, session, body = {}) {
  rejectUnknownKeys(body, OPPORTUNITY_FIELDS, "crm_opportunity");
  return withTransaction(app, async (client) => {
    const accountId = normalizeOptionalText(body.account_id || body.customer_agent_id, 64);
    if (!accountId) throw new CrmInputError("ACCOUNT_REQUIRED");
    const account = await fetchAccount(client, session.tenant_id, accountId);
    if (!account) return { ok: false, status: 404, error: "ACCOUNT_NOT_FOUND" };
    const governance = await loadDropdownCodeSets(client, session.tenant_id, ["CRM_OPPORTUNITY_STATUS"]);
    const status = toStoredStatus(body.status || body.stage, "NEW", governance, "CRM_OPPORTUNITY_STATUS", CRM_OPPORTUNITY_STATUSES);
    const ownerAgentId = normalizeOptionalText(body.owner_agent_id, 64) || await getPrimaryAgentId(client, session.tenant_id, session.identity_id);
    const amount = finiteNumber(body.value_amount ?? body.amount ?? body.value?.amount, null);
    const currency = normalizeCode(body.currency || body.value_currency || body.value?.currency, "EUR");
    const attrs = {
      ...normalizeAttrs(body.attrs),
      crm_management_v1: {
        account_id: accountId,
        account_name: account.name || null,
        description: normalizeOptionalText(body.description, 1000),
        value: { amount, currency },
        probability: finiteNumber(body.probability, null),
        expected_close_at: normalizeOptionalText(body.expected_close_at || body.expected_close_date, 80),
        source: normalizeOptionalText(body.source, 120),
        next_step: normalizeOptionalText(body.next_step, 500),
        created_from: "crm_management_v1"
      }
    };
    const result = await client.query(
      `
      INSERT INTO eip_core.service_object
        (tenant_id, object_type, status, code, title, attrs, owner_agent_id)
      VALUES ($1,'CRM_OPPORTUNITY',$2,$3,$4,$5::jsonb,$6)
      RETURNING id, object_type, status, code, title, attrs, owner_agent_id, created_at, updated_at
      `,
      [
        session.tenant_id,
        status,
        normalizeOptionalText(body.code, 64) || buildCode("CRM-OPP"),
        normalizeOptionalText(body.title, 300) || "Opportunity",
        JSON.stringify(attrs),
        ownerAgentId
      ]
    );
    await client.query(
      `
      INSERT INTO eip_core.service_object_party (tenant_id, service_object_id, agent_id, role, attrs)
      VALUES ($1,$2,$3,'CUSTOMER',$4::jsonb)
      ON CONFLICT DO NOTHING
      `,
      [session.tenant_id, result.rows[0].id, accountId, JSON.stringify({ module: "crm", source: "crm_management_v1" })]
    );
    await emitMutation(app, session, "crm.opportunity_created", { opportunity_id: result.rows[0].id, account_id: accountId });
    return { ok: true, item: safeOpportunity({ ...result.rows[0], account_id: accountId, account_name: account.name }) };
  });
}

export async function getCrmOpportunity(app, session, opportunityId) {
  const row = await fetchOpportunity(app.db, session.tenant_id, opportunityId);
  if (!row) return null;
  const [activities, documents] = await Promise.all([
    listCrmActivities(app, session, { opportunity_id: opportunityId, limit: 100 }),
    listLinkedInfo(app.db, session.tenant_id, "service_object", opportunityId)
  ]);
  return {
    ok: true,
    item: safeOpportunity(row),
    activities: activities.items,
    communications: documents.filter((item) => ["NOTE", "COMMUNICATION", "EMAIL_SUMMARY", "CALL_SUMMARY", "MEETING_SUMMARY"].includes(item.relation_type)),
    documents: documents.filter((item) => ["DOCUMENT", "ATTACHMENT", "CONTRACT_REFERENCE"].includes(item.relation_type)),
    summary: {
      open_activities: activities.items.filter((item) => !["DONE", "CANCELLED"].includes(item.status)).length,
      next_action: ["WON", "LOST", "CANCELLED", "ARCHIVED"].includes(toApiStatus(row.status)) ? "No active conversion action" : "Conversion intent can be recorded"
    }
  };
}

export async function updateCrmOpportunity(app, session, opportunityId, body = {}) {
  rejectUnknownKeys(body, OPPORTUNITY_FIELDS, "crm_opportunity");
  return withTransaction(app, async (client) => {
    const current = await fetchOpportunity(client, session.tenant_id, opportunityId);
    if (!current) return { ok: false, status: 404, error: "NOT_FOUND" };
    const currentSafe = safeOpportunity(current);
    const governance = await loadDropdownCodeSets(client, session.tenant_id, ["CRM_OPPORTUNITY_STATUS"]);
    const nextStatus = body.status !== undefined || body.stage !== undefined
      ? toStoredStatus(body.status || body.stage, currentSafe.status, governance, "CRM_OPPORTUNITY_STATUS", CRM_OPPORTUNITY_STATUSES)
      : current.status;
    const nextAccountId = normalizeOptionalText(body.account_id || body.customer_agent_id, 64) || currentSafe.account_id;
    if (nextAccountId && nextAccountId !== currentSafe.account_id) {
      const account = await fetchAccount(client, session.tenant_id, nextAccountId);
      if (!account) return { ok: false, status: 404, error: "ACCOUNT_NOT_FOUND" };
      await client.query(
        `
        INSERT INTO eip_core.service_object_party (tenant_id, service_object_id, agent_id, role, attrs)
        VALUES ($1,$2,$3,'CUSTOMER',$4::jsonb)
        ON CONFLICT DO NOTHING
        `,
        [session.tenant_id, opportunityId, nextAccountId, JSON.stringify({ module: "crm", source: "crm_management_v1" })]
      );
    }
    const amount = finiteNumber(body.value_amount ?? body.amount ?? body.value?.amount, currentSafe.value_amount);
    const currency = normalizeCode(body.currency || body.value_currency || body.value?.currency, currentSafe.currency || "EUR");
    const attrs = {
      ...asObject(current.attrs),
      ...normalizeAttrs(body.attrs),
      crm_management_v1: {
        ...asObject(current.attrs?.crm_management_v1),
        account_id: nextAccountId,
        description: body.description !== undefined ? normalizeOptionalText(body.description, 1000) : currentSafe.description,
        value: { amount, currency },
        probability: finiteNumber(body.probability, currentSafe.probability),
        expected_close_at: body.expected_close_at !== undefined || body.expected_close_date !== undefined
          ? normalizeOptionalText(body.expected_close_at || body.expected_close_date, 80)
          : currentSafe.expected_close_at,
        source: body.source !== undefined ? normalizeOptionalText(body.source, 120) : currentSafe.source,
        next_step: body.next_step !== undefined ? normalizeOptionalText(body.next_step, 500) : currentSafe.next_step,
        updated_from: "crm_management_v1"
      }
    };
    const result = await client.query(
      `
      UPDATE eip_core.service_object
      SET status=$3,
          code=$4,
          title=$5,
          attrs=$6::jsonb,
          owner_agent_id=$7,
          updated_at=now()
      WHERE tenant_id=$1 AND id=$2 AND object_type='CRM_OPPORTUNITY'
      RETURNING id, object_type, status, code, title, attrs, owner_agent_id, created_at, updated_at
      `,
      [
        session.tenant_id,
        opportunityId,
        nextStatus,
        body.code !== undefined ? normalizeOptionalText(body.code, 64) : current.code,
        body.title !== undefined ? normalizeOptionalText(body.title, 300) : current.title,
        JSON.stringify(attrs),
        body.owner_agent_id !== undefined ? normalizeOptionalText(body.owner_agent_id, 64) : current.owner_agent_id
      ]
    );
    await emitMutation(app, session, "crm.opportunity_updated", { opportunity_id: opportunityId, status: toApiStatus(nextStatus) });
    return { ok: true, item: safeOpportunity({ ...result.rows[0], account_id: nextAccountId }) };
  });
}

export async function listCrmActivities(app, session, query = {}) {
  rejectTenantQuery(query);
  const params = [session.tenant_id];
  const filters = ["tenant_id=$1"];
  if (normalizeOptionalText(query.status)) {
    params.push(String(query.status).toLowerCase());
    filters.push(`status=$${params.length}`);
  }
  if (normalizeOptionalText(query.account_id, 64)) {
    params.push(normalizeText(query.account_id));
    filters.push(`attrs->'crm_management_v1'->>'account_id'=$${params.length}`);
  }
  if (normalizeOptionalText(query.opportunity_id || query.service_object_id, 64)) {
    params.push(normalizeText(query.opportunity_id || query.service_object_id));
    filters.push(`(service_object_id=$${params.length} OR attrs->'crm_management_v1'->>'opportunity_id'=$${params.length})`);
  }
  const limit = clampLimit(query.limit);
  const offset = Math.max(0, Number(query.offset || 0));
  params.push(limit, offset);
  const result = await app.db.query(
    `
    SELECT id, service_object_id, task_type, status, title, description, assigned_agent_id,
           due_at, completed_at, payload, attrs, created_at, updated_at
    FROM eip_core.task
    WHERE ${filters.join(" AND ")}
    ORDER BY COALESCE(due_at, updated_at, created_at) DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );
  return { ok: true, items: result.rows.map(safeActivity), limit, offset };
}

async function resolveActivityServiceObject(client, session, body) {
  const serviceObjectId = normalizeOptionalText(body.service_object_id || body.opportunity_id, 64);
  if (serviceObjectId) {
    const result = await client.query(
      `
      SELECT so.id, so.object_type, customer.agent_id AS account_id
      FROM eip_core.service_object so
      LEFT JOIN LATERAL (
        SELECT sop.agent_id
        FROM eip_core.service_object_party sop
        WHERE sop.tenant_id=so.tenant_id
          AND sop.service_object_id=so.id
          AND sop.role IN ('CUSTOMER','PROSPECT','ACCOUNT')
        ORDER BY CASE sop.role WHEN 'CUSTOMER' THEN 0 WHEN 'ACCOUNT' THEN 1 ELSE 2 END, sop.created_at ASC
        LIMIT 1
      ) customer ON true
      WHERE so.tenant_id=$1 AND so.id=$2
      `,
      [session.tenant_id, serviceObjectId]
    );
    if (!result.rowCount) return { ok: false, status: 404, error: "SERVICE_OBJECT_NOT_FOUND" };
    return { ok: true, id: serviceObjectId, object_type: result.rows[0].object_type, account_id: result.rows[0].account_id || null };
  }
  const accountId = normalizeOptionalText(body.account_id, 64);
  if (!accountId) throw new CrmInputError("ACTIVITY_TARGET_REQUIRED");
  const account = await fetchAccount(client, session.tenant_id, accountId);
  if (!account) return { ok: false, status: 404, error: "ACCOUNT_NOT_FOUND" };
  const backing = await client.query(
    `
    INSERT INTO eip_core.service_object
      (tenant_id, object_type, status, code, title, attrs, owner_agent_id)
    VALUES ($1,'CRM_ACTIVITY','open',$2,$3,$4::jsonb,$5)
    RETURNING id, object_type
    `,
    [
      session.tenant_id,
      buildCode("CRM-ACT"),
      normalizeOptionalText(body.title, 300) || "CRM activity",
      JSON.stringify({ crm_management_v1: { account_id: accountId, backing_for: "task", created_from: "crm_management_v1" } }),
      await getPrimaryAgentId(client, session.tenant_id, session.identity_id)
    ]
  );
  await client.query(
    `
    INSERT INTO eip_core.object_link (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs)
    VALUES ($1,'agent',$2,'service_object',$3,'CRM_ACTIVITY_FOR',$4::jsonb)
    ON CONFLICT DO NOTHING
    `,
    [session.tenant_id, accountId, backing.rows[0].id, JSON.stringify({ module: "crm", source: "crm_management_v1" })]
  );
  return { ok: true, id: backing.rows[0].id, object_type: backing.rows[0].object_type };
}

export async function createCrmActivity(app, session, body = {}) {
  rejectUnknownKeys(body, ACTIVITY_FIELDS, "crm_activity");
  return withTransaction(app, async (client) => {
    const target = await resolveActivityServiceObject(client, session, body);
    if (!target.ok) return target;
    const governance = await loadDropdownCodeSets(client, session.tenant_id, ["TASK_STATUS"]);
    const status = toStoredStatus(body.status, "OPEN", governance, "TASK_STATUS", CRM_ACTIVITY_STATUSES);
    const accountId = normalizeOptionalText(body.account_id, 64) || target.account_id || null;
    const attrs = {
      ...normalizeAttrs(body.attrs),
      crm_management_v1: {
        account_id: accountId,
        opportunity_id: normalizeOptionalText(body.opportunity_id || body.service_object_id, 64),
        notes: normalizeOptionalText(body.notes, 1000),
        created_from: "crm_management_v1"
      }
    };
    const result = await client.query(
      `
      INSERT INTO eip_core.task
        (tenant_id, service_object_id, task_type, status, title, description, assigned_agent_id, due_at, payload, attrs)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)
      RETURNING id, service_object_id, task_type, status, title, description, assigned_agent_id,
                due_at, completed_at, payload, attrs, created_at, updated_at
      `,
      [
        session.tenant_id,
        target.id,
        normalizeCode(body.task_type, "FOLLOW_UP"),
        status,
        normalizeOptionalText(body.title, 300) || "Follow up",
        normalizeOptionalText(body.description, 1000),
        normalizeOptionalText(body.assigned_agent_id, 64),
        normalizeOptionalText(body.due_at, 80),
        JSON.stringify(asObject(body.payload)),
        JSON.stringify(attrs)
      ]
    );
    await emitMutation(app, session, "crm.activity_created", { activity_id: result.rows[0].id, service_object_id: target.id });
    return { ok: true, item: safeActivity(result.rows[0]) };
  });
}

export async function updateCrmActivity(app, session, activityId, body = {}) {
  rejectUnknownKeys(body, ACTIVITY_FIELDS, "crm_activity");
  return withTransaction(app, async (client) => {
    const current = await client.query(
      `
      SELECT id, service_object_id, task_type, status, title, description, assigned_agent_id, due_at, payload, attrs
      FROM eip_core.task
      WHERE tenant_id=$1 AND id=$2
      `,
      [session.tenant_id, activityId]
    );
    if (!current.rowCount) return { ok: false, status: 404, error: "NOT_FOUND" };
    const governance = await loadDropdownCodeSets(client, session.tenant_id, ["TASK_STATUS"]);
    const currentAttrs = asObject(current.rows[0].attrs);
    const result = await client.query(
      `
      UPDATE eip_core.task
      SET task_type=$3,
          status=$4,
          title=$5,
          description=$6,
          assigned_agent_id=$7,
          due_at=$8,
          completed_at=CASE WHEN $4 IN ('done','cancelled') THEN COALESCE(completed_at, now()) ELSE completed_at END,
          payload=COALESCE($9::jsonb, payload),
          attrs=$10::jsonb,
          updated_at=now()
      WHERE tenant_id=$1 AND id=$2
      RETURNING id, service_object_id, task_type, status, title, description, assigned_agent_id,
                due_at, completed_at, payload, attrs, created_at, updated_at
      `,
      [
        session.tenant_id,
        activityId,
        body.task_type !== undefined ? normalizeCode(body.task_type, current.rows[0].task_type) : current.rows[0].task_type,
        body.status !== undefined ? toStoredStatus(body.status, current.rows[0].status, governance, "TASK_STATUS", CRM_ACTIVITY_STATUSES) : current.rows[0].status,
        body.title !== undefined ? normalizeOptionalText(body.title, 300) : current.rows[0].title,
        body.description !== undefined ? normalizeOptionalText(body.description, 1000) : current.rows[0].description,
        body.assigned_agent_id !== undefined ? normalizeOptionalText(body.assigned_agent_id, 64) : current.rows[0].assigned_agent_id,
        body.due_at !== undefined ? normalizeOptionalText(body.due_at, 80) : current.rows[0].due_at,
        body.payload !== undefined ? JSON.stringify(asObject(body.payload)) : null,
        JSON.stringify({
          ...currentAttrs,
          ...normalizeAttrs(body.attrs),
          crm_management_v1: {
            ...asObject(currentAttrs.crm_management_v1),
            account_id: body.account_id !== undefined ? normalizeOptionalText(body.account_id, 64) : currentAttrs.crm_management_v1?.account_id,
            opportunity_id: body.opportunity_id !== undefined ? normalizeOptionalText(body.opportunity_id, 64) : currentAttrs.crm_management_v1?.opportunity_id,
            notes: body.notes !== undefined ? normalizeOptionalText(body.notes, 1000) : currentAttrs.crm_management_v1?.notes,
            updated_from: "crm_management_v1"
          }
        })
      ]
    );
    await emitMutation(app, session, "crm.activity_updated", { activity_id: activityId, status: toApiStatus(result.rows[0].status) });
    return { ok: true, item: safeActivity(result.rows[0]) };
  });
}

export async function getCrmAccountSummary(app, session, accountId) {
  const detail = await getCrmAccount(app, session, accountId);
  if (!detail) return { ok: false, status: 404, error: "NOT_FOUND" };
  return detail;
}

export async function getCrmPipeline(app, session, query = {}) {
  rejectTenantQuery(query);
  const result = await app.db.query(
    `
    WITH opportunities AS (
      SELECT status,
             CASE
               WHEN COALESCE(attrs#>>'{crm_management_v1,value,amount}','') ~ '^[0-9]+([.][0-9]+)?$'
                 THEN (attrs#>>'{crm_management_v1,value,amount}')::numeric
               WHEN COALESCE(attrs#>>'{value,amount}','') ~ '^[0-9]+([.][0-9]+)?$'
                 THEN (attrs#>>'{value,amount}')::numeric
               ELSE 0
             END AS value_amount
      FROM eip_core.service_object
      WHERE tenant_id=$1 AND object_type='CRM_OPPORTUNITY'
    )
    SELECT status, count(*)::int AS count, COALESCE(sum(value_amount),0)::numeric AS value_amount
    FROM opportunities
    GROUP BY status
    ORDER BY status
    `,
    [session.tenant_id]
  );
  const stages = result.rows.map((row) => ({
    status: toApiStatus(row.status, "NEW"),
    count: Number(row.count || 0),
    value_amount: Number(row.value_amount || 0)
  }));
  return {
    ok: true,
    stages,
    totals: {
      opportunities: stages.reduce((sum, item) => sum + item.count, 0),
      open: stages.filter((item) => !["WON", "LOST", "CANCELLED", "ARCHIVED"].includes(item.status)).reduce((sum, item) => sum + item.count, 0),
      value_amount: stages.reduce((sum, item) => sum + item.value_amount, 0)
    }
  };
}

export async function convertCrmOpportunity(app, session, opportunityId, body = {}) {
  rejectUnknownKeys(body, CONVERT_FIELDS, "crm_opportunity_conversion");
  return withTransaction(app, async (client) => {
    const current = await fetchOpportunity(client, session.tenant_id, opportunityId);
    if (!current) return { ok: false, status: 404, error: "NOT_FOUND" };
    const mapped = safeOpportunity(current);
    if (["WON", "LOST", "CANCELLED", "ARCHIVED"].includes(mapped.status)) {
      return { ok: false, status: 409, error: "OPPORTUNITY_NOT_CONVERTIBLE" };
    }
    const attrs = {
      ...asObject(current.attrs),
      crm_management_v1: {
        ...asObject(current.attrs?.crm_management_v1),
        conversion_status: "INTENT_RECORDED",
        conversion_requested_at: new Date().toISOString(),
        conversion_note: normalizeOptionalText(body.note, 500),
        next_step: normalizeOptionalText(body.next_step, 500) || "Manual next operational flow selection required.",
        converted_by_identity_id: session.identity_id
      }
    };
    const result = await client.query(
      `
      UPDATE eip_core.service_object
      SET attrs=$3::jsonb, updated_at=now()
      WHERE tenant_id=$1 AND id=$2 AND object_type='CRM_OPPORTUNITY'
      RETURNING id, object_type, status, code, title, attrs, owner_agent_id, created_at, updated_at
      `,
      [session.tenant_id, opportunityId, JSON.stringify(attrs)]
    );
    await client.query(
      `
      INSERT INTO eip_core.info_record
        (tenant_id, record_type, title, description, payload, attrs, created_by_agent_id)
      VALUES ($1,'CRM_CONVERSION_INTENT',$2,$3,$4::jsonb,$5::jsonb,$6)
      RETURNING id
      `,
      [
        session.tenant_id,
        "CRM opportunity conversion intent",
        normalizeOptionalText(body.note, 500),
        JSON.stringify({ opportunity_id: opportunityId, account_id: mapped.account_id, next_step: attrs.crm_management_v1.next_step }),
        JSON.stringify({ module: "crm", safe_summary: true, source: "crm_management_v1" }),
        await getPrimaryAgentId(client, session.tenant_id, session.identity_id)
      ]
    );
    await emitMutation(app, session, "crm.opportunity_conversion_recorded", { opportunity_id: opportunityId });
    return {
      ok: true,
      item: safeOpportunity({ ...result.rows[0], account_id: mapped.account_id, account_name: mapped.account_name }),
      conversion: {
        status: "INTENT_RECORDED",
        downstream_created: false,
        next_step: attrs.crm_management_v1.next_step,
        explanation: "CRM V1 records governed conversion intent. No downstream sales order is created without an enabled kernel process."
      }
    };
  });
}

export async function getCrmGovernanceOptions(app, session) {
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
      [session.tenant_id, CRM_DROPDOWN_CODES]
    ),
    loadModuleWorkspace(app, session.tenant_id, "crm")
  ]);
  const options = {};
  for (const row of optionsResult.rows || []) {
    options[row.list_code] = options[row.list_code] || [];
    options[row.list_code].push({ code: row.code, label: row.label || displayLabel(row.code) });
  }
  if (!options.CRM_ACCOUNT_STATUS?.length) {
    options.CRM_ACCOUNT_STATUS = CRM_ACCOUNT_STATUSES.map((code) => ({ code, label: displayLabel(code) }));
  }
  if (!options.CRM_OPPORTUNITY_STATUS?.length) {
    options.CRM_OPPORTUNITY_STATUS = CRM_OPPORTUNITY_STATUSES.map((code) => ({ code, label: displayLabel(code) }));
  }
  if (!options.TASK_STATUS?.length) {
    options.TASK_STATUS = CRM_ACTIVITY_STATUSES.map((code) => ({ code, label: displayLabel(code) }));
  }
  return {
    ok: true,
    options,
    defaults: {
      account_statuses: CRM_ACCOUNT_STATUSES,
      opportunity_statuses: CRM_OPPORTUNITY_STATUSES,
      activity_statuses: CRM_ACTIVITY_STATUSES,
      account_roles: ["PROSPECT", "CUSTOMER", "PARTNER", "LEAD_SOURCE", "OTHER"]
    },
    workspace
  };
}
