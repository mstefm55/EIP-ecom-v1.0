import { emitSecurityEvent } from "../../lib/securityAudit.js";
import { allowedCodesFrom, loadDropdownCodeSets, loadModuleWorkspace } from "../moduleWorkspace.js";

export const ENTITY_PERMISSIONS = Object.freeze({
  read: "entities.read",
  create: "entities.create",
  update: "entities.update",
  manageAddresses: "entities.manage_addresses",
  manageContacts: "entities.manage_contacts",
  manageBankAccounts: "entities.manage_bank_accounts",
  manageRelationships: "entities.manage_relationships"
});

export const DEFAULT_ENTITY_ROLES = Object.freeze([
  "CUSTOMER",
  "SUPPLIER",
  "PARTNER",
  "INTERNAL_ORG",
  "EMPLOYEE",
  "CARRIER",
  "MARKETPLACE",
  "AUTHORITY",
  "OTHER"
]);

export const ENTITY_STATUSES = Object.freeze([
  "ACTIVE",
  "INACTIVE",
  "UNDER_REVIEW",
  "BLOCKED",
  "ARCHIVED"
]);

export const ENTITY_KINDS = Object.freeze([
  "ORG",
  "PERSON",
  "DIVISION",
  "DEPARTMENT",
  "TEAM",
  "SYSTEM",
  "OTHER"
]);

export const ENTITY_DROPDOWN_CODES = Object.freeze([
  "ENTITY_ROLE",
  "ENTITY_STATUS",
  "ENTITY_KIND",
  "ENTITY_ADDRESS_TYPE",
  "ENTITY_CONTACT_TYPE",
  "ENTITY_BANK_ACCOUNT_TYPE",
  "ENTITY_RELATIONSHIP_TYPE",
  "ENTITY_RELATIONSHIP_SCOPE",
  "ENTITY_STRUCTURE_CATEGORY"
]);

const MAX_LIMIT = 200;
const MUTATION_EVENTS = Object.freeze({
  create: "entities.entity_created",
  update: "entities.entity_updated",
  addressCreate: "entities.address_created",
  addressUpdate: "entities.address_updated",
  contactCreate: "entities.contact_created",
  contactUpdate: "entities.contact_updated",
  bankCreate: "entities.bank_account_created",
  bankUpdate: "entities.bank_account_updated",
  relationshipCreate: "entities.relationship_created",
  relationshipUpdate: "entities.relationship_updated",
  relationshipMove: "entities.relationship_moved"
});

const SENSITIVE_KEY_RE = /(password|secret|token|credential|authorization|cookie|signature|csrf|sid|api[_-]?key|private[_-]?key|account_number|iban|raw_legal|compliance_raw)/i;
const TENANT_OVERRIDE_RE = /^(tenant_id|tenantId)$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_RE = /^[A-Z0-9][A-Z0-9_.:-]{0,63}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

const ENTITY_MUTATION_KEYS = new Set([
  "entity_kind",
  "code",
  "display_name",
  "legal_name",
  "roles",
  "status",
  "registration_number",
  "tax_number",
  "country_code",
  "default_language",
  "currency_code",
  "website",
  "notes",
  "parent_entity_id",
  "attrs"
]);

const ADDRESS_KEYS = new Set([
  "address_type",
  "label",
  "line1",
  "line2",
  "city",
  "state_region",
  "postal_code",
  "country_code",
  "latitude",
  "longitude",
  "is_primary",
  "is_active",
  "attrs"
]);

const CONTACT_KEYS = new Set([
  "contact_type",
  "label",
  "value",
  "is_primary",
  "is_active",
  "attrs"
]);

const BANK_KEYS = new Set([
  "account_type",
  "label",
  "bank_name",
  "account_name",
  "account_number",
  "iban",
  "swift_bic",
  "currency_code",
  "is_primary",
  "is_active",
  "attrs"
]);

const RELATIONSHIP_KEYS = new Set([
  "related_entity_id",
  "relation_type",
  "direction",
  "relationship_scope",
  "structure_category",
  "valid_from",
  "valid_to",
  "mobile_affiliation",
  "movement_reason",
  "chart_x",
  "chart_y",
  "sort_order",
  "is_active",
  "attrs"
]);

const ORG_CHILD_TO_PARENT_RELATION_TYPES = Object.freeze([
  "MEMBER_OF",
  "DIVISION_OF",
  "DEPARTMENT_OF",
  "TEAM_OF",
  "SUBSIDIARY_OF",
  "AFFILIATED_TO",
  "REPORTS_TO",
  "PART_OF",
  "WORKS_FOR"
]);

const ORG_PARENT_TO_CHILD_RELATION_TYPES = Object.freeze([
  "PARENT_OF",
  "HAS_MEMBER",
  "OWNS",
  "MANAGES"
]);

const ORG_CHART_RELATION_TYPES = Object.freeze([
  ...ORG_CHILD_TO_PARENT_RELATION_TYPES,
  ...ORG_PARENT_TO_CHILD_RELATION_TYPES
]);

export class EntityInputError extends Error {
  constructor(code, details = null) {
    super(code);
    this.name = "EntityInputError";
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
  if (text.length > maxLength) throw new EntityInputError("TEXT_TOO_LONG");
  return text;
}

function normalizeCode(value, fallback = null) {
  const text = normalizeOptionalText(value, 80);
  if (!text) return fallback;
  const code = text.toUpperCase().replace(/\s+/g, "_");
  if (!CODE_RE.test(code)) throw new EntityInputError("INVALID_CODE", { code });
  return code;
}

function normalizeUuid(value, field) {
  const text = normalizeOptionalText(value, 64);
  if (!text) return null;
  if (!UUID_RE.test(text)) throw new EntityInputError("INVALID_UUID", { field });
  return text;
}

function normalizeCountry(value) {
  const text = normalizeOptionalText(value, 2);
  if (!text) return null;
  const country = text.toUpperCase();
  if (!COUNTRY_RE.test(country)) throw new EntityInputError("INVALID_COUNTRY_CODE");
  return country;
}

function normalizeCurrency(value) {
  const text = normalizeOptionalText(value, 3);
  if (!text) return null;
  const currency = text.toUpperCase();
  if (!CURRENCY_RE.test(currency)) throw new EntityInputError("INVALID_CURRENCY_CODE");
  return currency;
}

function normalizeDateTime(value, field) {
  const text = normalizeOptionalText(value, 80);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new EntityInputError("INVALID_DATE", { field });
  return date.toISOString();
}

function normalizeFiniteNumber(value, field, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new EntityInputError("INVALID_NUMBER", { field });
  return number;
}

function normalizeStatus(value, fallback = "ACTIVE", governance = null) {
  const status = normalizeCode(value, fallback);
  const allowed = allowedCodesFrom(governance, "ENTITY_STATUS", ENTITY_STATUSES);
  if (!allowed.includes(status)) throw new EntityInputError("INVALID_ENTITY_STATUS");
  return status;
}

function normalizeRoles(value, fallback = ["OTHER"], governance = null) {
  const roles = Array.isArray(value) ? value : value ? [value] : fallback;
  const normalized = [...new Set(roles.map((item) => normalizeCode(item, null)).filter(Boolean))];
  const allowed = allowedCodesFrom(governance, "ENTITY_ROLE", DEFAULT_ENTITY_ROLES);
  for (const role of normalized) {
    if (!allowed.includes(role)) throw new EntityInputError("INVALID_ENTITY_ROLE", { role });
  }
  return normalized.length ? normalized : fallback;
}

function normalizeEntityKind(value, fallback = "ORG", governance = null) {
  const entityKind = normalizeCode(value, fallback);
  const allowed = allowedCodesFrom(governance, "ENTITY_KIND", ENTITY_KINDS);
  if (allowed.length && !allowed.includes(entityKind)) throw new EntityInputError("INVALID_ENTITY_KIND", { entity_kind: entityKind });
  return entityKind;
}

function clampLimit(value) {
  const parsed = Number(value || 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function rejectUnknownKeys(body, allowed, label) {
  for (const key of Object.keys(body || {})) {
    if (TENANT_OVERRIDE_RE.test(key)) throw new EntityInputError("TENANT_OVERRIDE_NOT_ALLOWED");
    if (!allowed.has(key)) throw new EntityInputError("UNKNOWN_FIELD", { label, field: key });
  }
}

function rejectSensitiveAttrs(value, path = "attrs") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectSensitiveAttrs(item, `${path}.${index}`));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (TENANT_OVERRIDE_RE.test(key)) throw new EntityInputError("TENANT_OVERRIDE_NOT_ALLOWED", { path });
    if (SENSITIVE_KEY_RE.test(key)) throw new EntityInputError("SENSITIVE_FIELD_NOT_ALLOWED", { path, field: key });
    rejectSensitiveAttrs(item, `${path}.${key}`);
  }
}

function normalizeAttrs(value) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new EntityInputError("ATTRS_MUST_BE_OBJECT");
  rejectSensitiveAttrs(value);
  return value;
}

function normalizeUrl(value) {
  const text = normalizeOptionalText(value, 300);
  if (!text) return null;
  if (!URL_RE.test(text)) throw new EntityInputError("INVALID_WEBSITE_URL");
  return text;
}

function lifecycleIsActive(status) {
  return !["INACTIVE", "ARCHIVED"].includes(status);
}

function maskIdentifier(value) {
  const text = normalizeText(value).replace(/\s+/g, "");
  if (!text) return null;
  const suffix = text.slice(-4);
  return `${"*".repeat(Math.max(4, Math.min(12, text.length - suffix.length)))}${suffix}`;
}

function safeJson(value) {
  if (!value || typeof value !== "object") return {};
  return value;
}

function mapEntityRow(row) {
  if (!row) return null;
  const attrs = safeJson(row.attrs);
  const status = normalizeStatus(attrs.status || (row.is_active ? "ACTIVE" : "INACTIVE"));
  return {
    id: row.id,
    entity_kind: row.agent_type,
    code: row.code,
    display_name: row.name,
    legal_name: attrs.legal_name || null,
    roles: Array.isArray(attrs.roles) ? attrs.roles : ["OTHER"],
    status,
    registration_number: attrs.registration_number || null,
    tax_number: attrs.tax_number || null,
    country_code: attrs.country_code || null,
    default_language: attrs.default_language || null,
    currency_code: attrs.currency_code || null,
    website: attrs.website || null,
    notes: attrs.notes || null,
    parent_entity_id: row.parent_agent_id || null,
    is_active: row.is_active === true,
    attrs: attrs.entity_attrs && typeof attrs.entity_attrs === "object" ? attrs.entity_attrs : {},
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapAddressRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    entity_id: row.entity_id,
    address_type: row.address_type,
    label: row.label,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state_region: row.state_region,
    postal_code: row.postal_code,
    country_code: row.country_code,
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    is_primary: row.is_primary === true,
    is_active: row.is_active === true,
    attrs: safeJson(row.attrs),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapContactRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    entity_id: row.entity_id,
    contact_type: row.contact_type,
    label: row.label,
    value: row.value,
    is_primary: row.is_primary === true,
    is_active: row.is_active === true,
    attrs: safeJson(row.attrs),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapBankRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    entity_id: row.entity_id,
    account_type: row.account_type,
    label: row.label,
    bank_name: row.bank_name,
    account_name: row.account_name,
    account_number_masked: row.account_number_masked || maskIdentifier(row.account_number),
    iban_masked: row.iban_masked || maskIdentifier(row.iban),
    swift_bic: row.swift_bic,
    currency_code: row.currency_code,
    is_primary: row.is_primary === true,
    is_active: row.is_active === true,
    attrs: safeJson(row.attrs),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapRelationshipRow(row, entityId) {
  if (!row) return null;
  const outgoing = String(row.src_id) === String(entityId);
  const attrs = safeJson(row.attrs);
  const chart = attrs.chart && typeof attrs.chart === "object" ? attrs.chart : {};
  return {
    id: row.id,
    entity_id: entityId,
    related_entity_id: outgoing ? row.dst_id : row.src_id,
    related_entity: {
      id: outgoing ? row.dst_id : row.src_id,
      code: outgoing ? row.dst_code : row.src_code,
      display_name: outgoing ? row.dst_name : row.src_name,
      entity_kind: outgoing ? row.dst_type : row.src_type
    },
    relation_type: row.relation_type,
    direction: outgoing ? "OUTGOING" : "INCOMING",
    relationship_scope: attrs.relationship_scope || "GENERAL",
    structure_category: attrs.structure_category || null,
    valid_from: attrs.valid_from || null,
    valid_to: attrs.valid_to || null,
    mobile_affiliation: attrs.mobile_affiliation === true,
    movement_reason: attrs.movement_reason || null,
    chart_x: chart.x ?? null,
    chart_y: chart.y ?? null,
    sort_order: row.sort_order,
    is_active: row.is_active === true,
    attrs,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function buildEntityAttrs(body, existingAttrs = {}, partial = false, governance = null) {
  const attrs = safeJson(existingAttrs);
  const entityAttrs = {
    ...(attrs.entity_attrs && typeof attrs.entity_attrs === "object" ? attrs.entity_attrs : {})
  };
  if (hasOwn(body, "attrs")) Object.assign(entityAttrs, normalizeAttrs(body.attrs));

  const next = {
    ...attrs,
    entity_management_v1: true,
    roles: hasOwn(body, "roles")
      ? normalizeRoles(body.roles, ["OTHER"], governance)
      : Array.isArray(attrs.roles)
        ? attrs.roles
        : partial
          ? ["OTHER"]
          : ["OTHER"],
    status: hasOwn(body, "status")
      ? normalizeStatus(body.status, "ACTIVE", governance)
      : attrs.status
        ? normalizeStatus(attrs.status, "ACTIVE", governance)
        : "ACTIVE",
    entity_attrs: entityAttrs
  };

  for (const [field, max] of [
    ["legal_name", 300],
    ["registration_number", 120],
    ["tax_number", 120],
    ["default_language", 12],
    ["notes", 2000]
  ]) {
    if (hasOwn(body, field)) next[field] = normalizeOptionalText(body[field], max);
  }
  if (hasOwn(body, "country_code")) next.country_code = normalizeCountry(body.country_code);
  if (hasOwn(body, "currency_code")) next.currency_code = normalizeCurrency(body.currency_code);
  if (hasOwn(body, "website")) next.website = normalizeUrl(body.website);

  return next;
}

async function ensureEntity(db, tenantId, entityId) {
  const id = normalizeUuid(entityId, "entity_id");
  if (!id) return null;
  const result = await db.query(
    `
    SELECT id, agent_type, code, name, attrs, parent_agent_id, is_active, created_at, updated_at
    FROM eip_core.agent
    WHERE tenant_id=$1 AND id=$2
    `,
    [tenantId, id]
  );
  return result.rows[0] || null;
}

async function emitMutation(app, session, eventType, metadata = {}) {
  await emitSecurityEvent(app, eventType, {
    category: "entity_management",
    source: "entities.v1",
    severity: "info",
    outcome: "success",
    tenantId: session.tenant_id,
    identityId: session.identity_id,
    metadata
  });
}

export async function listEntities(app, session, query = {}) {
  const tenantId = session.tenant_id;
  const governance = await loadDropdownCodeSets(app, tenantId, ["ENTITY_STATUS", "ENTITY_ROLE", "ENTITY_KIND"]);
  const limit = clampLimit(query.limit);
  const offset = Math.max(0, Number(query.offset || 0));
  const params = [tenantId];
  const filters = ["agent.tenant_id=$1"];

  if (normalizeOptionalText(query.q, 200)) {
    params.push(`%${normalizeText(query.q)}%`);
    filters.push(`(
      agent.name ILIKE $${params.length}
      OR agent.code ILIKE $${params.length}
      OR COALESCE(agent.attrs->>'legal_name','') ILIKE $${params.length}
      OR COALESCE(agent.attrs->>'registration_number','') ILIKE $${params.length}
      OR COALESCE(agent.attrs->>'tax_number','') ILIKE $${params.length}
    )`);
  }
  if (normalizeOptionalText(query.role, 80)) {
    params.push(normalizeRoles(query.role, ["OTHER"], governance)[0]);
    filters.push(`COALESCE(agent.attrs->'roles','[]'::jsonb) ? $${params.length}`);
  }
  if (normalizeOptionalText(query.status, 40)) {
    params.push(normalizeStatus(query.status, "ACTIVE", governance));
    filters.push(`COALESCE(agent.attrs->>'status', CASE WHEN agent.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END) = $${params.length}`);
  } else if (query.include_archived !== "true" && query.include_archived !== true) {
    filters.push(`COALESCE(agent.attrs->>'status', CASE WHEN agent.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END) <> 'ARCHIVED'`);
  }
  if (normalizeOptionalText(query.entity_kind, 50)) {
    params.push(normalizeEntityKind(query.entity_kind, "ORG", governance));
    filters.push(`agent.agent_type=$${params.length}`);
  }
  if (normalizeOptionalText(query.country_code, 2)) {
    params.push(normalizeCountry(query.country_code));
    filters.push(`agent.attrs->>'country_code'=$${params.length}`);
  }

  const countResult = await app.db.query(
    `
    SELECT count(*)::int AS total
    FROM eip_core.agent agent
    WHERE ${filters.join(" AND ")}
    `,
    params
  );
  params.push(limit, offset);
  const result = await app.db.query(
    `
    SELECT agent.id, agent.agent_type, agent.code, agent.name, agent.attrs, agent.parent_agent_id,
           agent.is_active, agent.created_at, agent.updated_at,
           count(contact.id) FILTER (WHERE contact.is_active=true)::int AS contact_count,
           count(address.id) FILTER (WHERE address.is_active=true)::int AS address_count
    FROM eip_core.agent agent
    LEFT JOIN eip_core.entity_contact contact
      ON contact.tenant_id=agent.tenant_id AND contact.entity_id=agent.id
    LEFT JOIN eip_core.entity_address address
      ON address.tenant_id=agent.tenant_id AND address.entity_id=agent.id
    WHERE ${filters.join(" AND ")}
    GROUP BY agent.id
    ORDER BY agent.updated_at DESC, agent.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );
  return {
    ok: true,
    items: result.rows.map((row) => ({
      ...mapEntityRow(row),
      summary: {
        contacts: Number(row.contact_count || 0),
        addresses: Number(row.address_count || 0)
      }
    })),
    total: Number(countResult.rows[0]?.total || 0),
    limit,
    offset
  };
}

export async function createEntity(app, session, body = {}) {
  rejectUnknownKeys(body, ENTITY_MUTATION_KEYS, "entity");
  const tenantId = session.tenant_id;
  const governance = await loadDropdownCodeSets(app, tenantId, ["ENTITY_STATUS", "ENTITY_ROLE", "ENTITY_KIND"]);
  const displayName = normalizeOptionalText(body.display_name, 300);
  if (!displayName) throw new EntityInputError("DISPLAY_NAME_REQUIRED");
  const entityKind = normalizeEntityKind(body.entity_kind, "ORG", governance);
  const code = body.code === undefined ? null : normalizeCode(body.code, null);
  const parentEntityId = normalizeUuid(body.parent_entity_id, "parent_entity_id");
  if (parentEntityId && !(await ensureEntity(app.db, tenantId, parentEntityId))) {
    throw new EntityInputError("PARENT_ENTITY_NOT_FOUND");
  }
  const attrs = buildEntityAttrs(body, {}, false, governance);
  const result = await app.db.query(
    `
    INSERT INTO eip_core.agent
      (tenant_id, agent_type, code, name, attrs, parent_agent_id, is_active)
    VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
    RETURNING id, agent_type, code, name, attrs, parent_agent_id, is_active, created_at, updated_at
    `,
    [tenantId, entityKind, code, displayName, JSON.stringify(attrs), parentEntityId, lifecycleIsActive(attrs.status)]
  );
  const item = mapEntityRow(result.rows[0]);
  await emitMutation(app, session, MUTATION_EVENTS.create, { entity_id: item.id, status: item.status, roles: item.roles });
  return { ok: true, item };
}

export async function getEntityDetail(app, session, entityId) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return null;
  const [addresses, contacts, bankAccounts, relationships, orgChart, documents, policies, activity] = await Promise.all([
    listEntityAddresses(app, session, entity.id),
    listEntityContacts(app, session, entity.id),
    listEntityBankAccounts(app, session, entity.id),
    listEntityRelationships(app, session, entity.id),
    getEntityOrgChart(app, session, entity.id),
    listEntityDocuments(app, session, entity.id),
    getEntityPolicySummary(app, session, entity.id),
    getEntityActivitySummary(app, session, entity.id)
  ]);
  return {
    ok: true,
    item: mapEntityRow(entity),
    addresses: addresses.items,
    contacts: contacts.items,
    bank_accounts: bankAccounts.items,
    relationships: relationships.items,
    org_chart: orgChart,
    documents: documents.items,
    policy_summary: policies.summary,
    activity_summary: activity.summary,
    summary: {
      addresses: addresses.items.length,
      contacts: contacts.items.length,
      bank_accounts: bankAccounts.items.length,
      relationships: relationships.items.length,
      documents: documents.items.length,
      policies: policies.summary.total,
      service_objects: activity.summary.service_objects.total,
      tasks: activity.summary.tasks.total
    }
  };
}

export async function updateEntity(app, session, entityId, body = {}) {
  rejectUnknownKeys(body, ENTITY_MUTATION_KEYS, "entity");
  const current = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!current) return null;
  const governance = await loadDropdownCodeSets(app, session.tenant_id, ["ENTITY_STATUS", "ENTITY_ROLE", "ENTITY_KIND"]);
  const nextAttrs = buildEntityAttrs(body, current.attrs, true, governance);
  const parentEntityId = hasOwn(body, "parent_entity_id")
    ? normalizeUuid(body.parent_entity_id, "parent_entity_id")
    : current.parent_agent_id;
  if (parentEntityId && parentEntityId !== current.parent_agent_id && !(await ensureEntity(app.db, session.tenant_id, parentEntityId))) {
    throw new EntityInputError("PARENT_ENTITY_NOT_FOUND");
  }
  const result = await app.db.query(
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
      current.id,
      hasOwn(body, "entity_kind") ? normalizeEntityKind(body.entity_kind, "ORG", governance) : current.agent_type,
      hasOwn(body, "code") ? normalizeCode(body.code, null) : current.code,
      hasOwn(body, "display_name") ? normalizeOptionalText(body.display_name, 300) : current.name,
      JSON.stringify(nextAttrs),
      parentEntityId,
      lifecycleIsActive(nextAttrs.status)
    ]
  );
  const item = mapEntityRow(result.rows[0]);
  await emitMutation(app, session, MUTATION_EVENTS.update, { entity_id: item.id, status: item.status, roles: item.roles });
  return { ok: true, item };
}

export async function listEntityAddresses(app, session, entityId) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return { ok: false, items: [] };
  const result = await app.db.query(
    `
    SELECT id, entity_id, address_type, label, line1, line2, city, state_region, postal_code,
           country_code, latitude, longitude, is_primary, is_active, attrs, created_at, updated_at
    FROM eip_core.entity_address
    WHERE tenant_id=$1 AND entity_id=$2
    ORDER BY is_primary DESC, is_active DESC, address_type ASC, updated_at DESC
    `,
    [session.tenant_id, entity.id]
  );
  return { ok: true, items: result.rows.map(mapAddressRow) };
}

function normalizeAddress(body, current = {}, partial = false) {
  rejectUnknownKeys(body, ADDRESS_KEYS, "address");
  const next = {
    address_type: hasOwn(body, "address_type") ? normalizeCode(body.address_type, "MAIN") : current.address_type || "MAIN",
    label: hasOwn(body, "label") ? normalizeOptionalText(body.label, 120) : current.label || null,
    line1: hasOwn(body, "line1") ? normalizeOptionalText(body.line1, 240) : current.line1 || null,
    line2: hasOwn(body, "line2") ? normalizeOptionalText(body.line2, 240) : current.line2 || null,
    city: hasOwn(body, "city") ? normalizeOptionalText(body.city, 120) : current.city || null,
    state_region: hasOwn(body, "state_region") ? normalizeOptionalText(body.state_region, 120) : current.state_region || null,
    postal_code: hasOwn(body, "postal_code") ? normalizeOptionalText(body.postal_code, 40) : current.postal_code || null,
    country_code: hasOwn(body, "country_code") ? normalizeCountry(body.country_code) : current.country_code || null,
    latitude: hasOwn(body, "latitude") ? body.latitude ?? null : current.latitude ?? null,
    longitude: hasOwn(body, "longitude") ? body.longitude ?? null : current.longitude ?? null,
    is_primary: hasOwn(body, "is_primary") ? body.is_primary === true : current.is_primary === true,
    is_active: hasOwn(body, "is_active") ? body.is_active !== false : current.is_active !== false,
    attrs: hasOwn(body, "attrs") ? normalizeAttrs(body.attrs) : safeJson(current.attrs)
  };
  if (!partial && !next.line1 && !next.city && !next.country_code) throw new EntityInputError("ADDRESS_DETAIL_REQUIRED");
  return next;
}

export async function createEntityAddress(app, session, entityId, body = {}) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return null;
  const input = normalizeAddress(body);
  if (input.is_primary) {
    await app.db.query(
      `UPDATE eip_core.entity_address SET is_primary=false, updated_at=now() WHERE tenant_id=$1 AND entity_id=$2 AND address_type=$3`,
      [session.tenant_id, entity.id, input.address_type]
    );
  }
  const result = await app.db.query(
    `
    INSERT INTO eip_core.entity_address
      (tenant_id, entity_id, address_type, label, line1, line2, city, state_region, postal_code,
       country_code, latitude, longitude, is_primary, is_active, attrs)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
    RETURNING id, entity_id, address_type, label, line1, line2, city, state_region, postal_code,
              country_code, latitude, longitude, is_primary, is_active, attrs, created_at, updated_at
    `,
    [
      session.tenant_id, entity.id, input.address_type, input.label, input.line1, input.line2, input.city,
      input.state_region, input.postal_code, input.country_code, input.latitude, input.longitude,
      input.is_primary, input.is_active, JSON.stringify(input.attrs)
    ]
  );
  const item = mapAddressRow(result.rows[0]);
  await emitMutation(app, session, MUTATION_EVENTS.addressCreate, { entity_id: entity.id, address_id: item.id, address_type: item.address_type });
  return { ok: true, item };
}

export async function updateEntityAddress(app, session, entityId, addressId, body = {}) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return null;
  const current = await app.db.query(
    `
    SELECT id, entity_id, address_type, label, line1, line2, city, state_region, postal_code,
           country_code, latitude, longitude, is_primary, is_active, attrs, created_at, updated_at
    FROM eip_core.entity_address
    WHERE tenant_id=$1 AND entity_id=$2 AND id=$3
    `,
    [session.tenant_id, entity.id, normalizeUuid(addressId, "address_id")]
  );
  if (current.rowCount === 0) return null;
  const input = normalizeAddress(body, current.rows[0], true);
  if (input.is_primary) {
    await app.db.query(
      `UPDATE eip_core.entity_address SET is_primary=false, updated_at=now() WHERE tenant_id=$1 AND entity_id=$2 AND address_type=$3 AND id<>$4`,
      [session.tenant_id, entity.id, input.address_type, current.rows[0].id]
    );
  }
  const result = await app.db.query(
    `
    UPDATE eip_core.entity_address
    SET address_type=$4, label=$5, line1=$6, line2=$7, city=$8, state_region=$9,
        postal_code=$10, country_code=$11, latitude=$12, longitude=$13, is_primary=$14,
        is_active=$15, attrs=$16::jsonb, updated_at=now()
    WHERE tenant_id=$1 AND entity_id=$2 AND id=$3
    RETURNING id, entity_id, address_type, label, line1, line2, city, state_region, postal_code,
              country_code, latitude, longitude, is_primary, is_active, attrs, created_at, updated_at
    `,
    [
      session.tenant_id, entity.id, current.rows[0].id, input.address_type, input.label, input.line1,
      input.line2, input.city, input.state_region, input.postal_code, input.country_code, input.latitude,
      input.longitude, input.is_primary, input.is_active, JSON.stringify(input.attrs)
    ]
  );
  const item = mapAddressRow(result.rows[0]);
  await emitMutation(app, session, MUTATION_EVENTS.addressUpdate, { entity_id: entity.id, address_id: item.id, is_active: item.is_active });
  return { ok: true, item };
}

export async function listEntityContacts(app, session, entityId) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return { ok: false, items: [] };
  const result = await app.db.query(
    `
    SELECT id, entity_id, contact_type, label, value, is_primary, is_active, attrs, created_at, updated_at
    FROM eip_core.entity_contact
    WHERE tenant_id=$1 AND entity_id=$2
    ORDER BY is_primary DESC, is_active DESC, contact_type ASC, updated_at DESC
    `,
    [session.tenant_id, entity.id]
  );
  return { ok: true, items: result.rows.map(mapContactRow) };
}

function normalizeContact(body, current = {}, partial = false) {
  rejectUnknownKeys(body, CONTACT_KEYS, "contact");
  const contactType = hasOwn(body, "contact_type") ? normalizeCode(body.contact_type, "EMAIL") : current.contact_type || "EMAIL";
  const value = hasOwn(body, "value") ? normalizeOptionalText(body.value, 300) : current.value || null;
  if (!partial && !value) throw new EntityInputError("CONTACT_VALUE_REQUIRED");
  if (value && contactType === "EMAIL" && !EMAIL_RE.test(value)) throw new EntityInputError("INVALID_EMAIL_CONTACT");
  if (value && contactType === "WEBSITE" && !URL_RE.test(value)) throw new EntityInputError("INVALID_WEBSITE_URL");
  return {
    contact_type: contactType,
    label: hasOwn(body, "label") ? normalizeOptionalText(body.label, 120) : current.label || null,
    value,
    is_primary: hasOwn(body, "is_primary") ? body.is_primary === true : current.is_primary === true,
    is_active: hasOwn(body, "is_active") ? body.is_active !== false : current.is_active !== false,
    attrs: hasOwn(body, "attrs") ? normalizeAttrs(body.attrs) : safeJson(current.attrs)
  };
}

export async function createEntityContact(app, session, entityId, body = {}) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return null;
  const input = normalizeContact(body);
  if (input.is_primary) {
    await app.db.query(
      `UPDATE eip_core.entity_contact SET is_primary=false, updated_at=now() WHERE tenant_id=$1 AND entity_id=$2 AND contact_type=$3`,
      [session.tenant_id, entity.id, input.contact_type]
    );
  }
  const result = await app.db.query(
    `
    INSERT INTO eip_core.entity_contact
      (tenant_id, entity_id, contact_type, label, value, is_primary, is_active, attrs)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    RETURNING id, entity_id, contact_type, label, value, is_primary, is_active, attrs, created_at, updated_at
    `,
    [session.tenant_id, entity.id, input.contact_type, input.label, input.value, input.is_primary, input.is_active, JSON.stringify(input.attrs)]
  );
  const item = mapContactRow(result.rows[0]);
  await emitMutation(app, session, MUTATION_EVENTS.contactCreate, { entity_id: entity.id, contact_id: item.id, contact_type: item.contact_type });
  return { ok: true, item };
}

export async function updateEntityContact(app, session, entityId, contactId, body = {}) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return null;
  const current = await app.db.query(
    `
    SELECT id, entity_id, contact_type, label, value, is_primary, is_active, attrs, created_at, updated_at
    FROM eip_core.entity_contact
    WHERE tenant_id=$1 AND entity_id=$2 AND id=$3
    `,
    [session.tenant_id, entity.id, normalizeUuid(contactId, "contact_id")]
  );
  if (current.rowCount === 0) return null;
  const input = normalizeContact(body, current.rows[0], true);
  if (input.is_primary) {
    await app.db.query(
      `UPDATE eip_core.entity_contact SET is_primary=false, updated_at=now() WHERE tenant_id=$1 AND entity_id=$2 AND contact_type=$3 AND id<>$4`,
      [session.tenant_id, entity.id, input.contact_type, current.rows[0].id]
    );
  }
  const result = await app.db.query(
    `
    UPDATE eip_core.entity_contact
    SET contact_type=$4, label=$5, value=$6, is_primary=$7, is_active=$8, attrs=$9::jsonb, updated_at=now()
    WHERE tenant_id=$1 AND entity_id=$2 AND id=$3
    RETURNING id, entity_id, contact_type, label, value, is_primary, is_active, attrs, created_at, updated_at
    `,
    [session.tenant_id, entity.id, current.rows[0].id, input.contact_type, input.label, input.value, input.is_primary, input.is_active, JSON.stringify(input.attrs)]
  );
  const item = mapContactRow(result.rows[0]);
  await emitMutation(app, session, MUTATION_EVENTS.contactUpdate, { entity_id: entity.id, contact_id: item.id, is_active: item.is_active });
  return { ok: true, item };
}

export async function listEntityBankAccounts(app, session, entityId) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return { ok: false, items: [] };
  const result = await app.db.query(
    `
    SELECT id, entity_id, account_type, label, bank_name, account_name,
           CASE WHEN account_number IS NULL THEN NULL ELSE '****' || right(regexp_replace(account_number, '\\s+', '', 'g'), 4) END AS account_number_masked,
           CASE WHEN iban IS NULL THEN NULL ELSE '****' || right(regexp_replace(iban, '\\s+', '', 'g'), 4) END AS iban_masked,
           swift_bic, currency_code, is_primary, is_active, attrs, created_at, updated_at
    FROM eip_core.entity_bank_account
    WHERE tenant_id=$1 AND entity_id=$2
    ORDER BY is_primary DESC, is_active DESC, account_type ASC, updated_at DESC
    `,
    [session.tenant_id, entity.id]
  );
  return { ok: true, items: result.rows.map(mapBankRow) };
}

function normalizeBank(body, current = {}, partial = false) {
  rejectUnknownKeys(body, BANK_KEYS, "bank_account");
  const input = {
    account_type: hasOwn(body, "account_type") ? normalizeCode(body.account_type, "BANK") : current.account_type || "BANK",
    label: hasOwn(body, "label") ? normalizeOptionalText(body.label, 120) : current.label || null,
    bank_name: hasOwn(body, "bank_name") ? normalizeOptionalText(body.bank_name, 160) : current.bank_name || null,
    account_name: hasOwn(body, "account_name") ? normalizeOptionalText(body.account_name, 240) : current.account_name || null,
    account_number: hasOwn(body, "account_number") ? normalizeOptionalText(body.account_number, 120) : current.account_number || null,
    iban: hasOwn(body, "iban") ? normalizeOptionalText(body.iban, 120) : current.iban || null,
    swift_bic: hasOwn(body, "swift_bic") ? normalizeCode(body.swift_bic, null) : current.swift_bic || null,
    currency_code: hasOwn(body, "currency_code") ? normalizeCurrency(body.currency_code) : current.currency_code || null,
    is_primary: hasOwn(body, "is_primary") ? body.is_primary === true : current.is_primary === true,
    is_active: hasOwn(body, "is_active") ? body.is_active !== false : current.is_active !== false,
    attrs: hasOwn(body, "attrs") ? normalizeAttrs(body.attrs) : safeJson(current.attrs)
  };
  if (!partial && !input.bank_name && !input.account_number && !input.iban) {
    throw new EntityInputError("BANK_ACCOUNT_DETAIL_REQUIRED");
  }
  return input;
}

export async function createEntityBankAccount(app, session, entityId, body = {}) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return null;
  const input = normalizeBank(body);
  if (input.is_primary) {
    await app.db.query(
      `UPDATE eip_core.entity_bank_account SET is_primary=false, updated_at=now() WHERE tenant_id=$1 AND entity_id=$2`,
      [session.tenant_id, entity.id]
    );
  }
  const result = await app.db.query(
    `
    INSERT INTO eip_core.entity_bank_account
      (tenant_id, entity_id, account_type, label, bank_name, account_name, account_number,
       iban, swift_bic, currency_code, is_primary, is_active, attrs)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
    RETURNING id, entity_id, account_type, label, bank_name, account_name,
              CASE WHEN account_number IS NULL THEN NULL ELSE '****' || right(regexp_replace(account_number, '\\s+', '', 'g'), 4) END AS account_number_masked,
              CASE WHEN iban IS NULL THEN NULL ELSE '****' || right(regexp_replace(iban, '\\s+', '', 'g'), 4) END AS iban_masked,
              swift_bic, currency_code, is_primary, is_active, attrs, created_at, updated_at
    `,
    [
      session.tenant_id, entity.id, input.account_type, input.label, input.bank_name, input.account_name,
      input.account_number, input.iban, input.swift_bic, input.currency_code, input.is_primary,
      input.is_active, JSON.stringify(input.attrs)
    ]
  );
  const item = mapBankRow(result.rows[0]);
  await emitMutation(app, session, MUTATION_EVENTS.bankCreate, { entity_id: entity.id, bank_account_id: item.id, account_type: item.account_type });
  return { ok: true, item };
}

export async function updateEntityBankAccount(app, session, entityId, bankAccountId, body = {}) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return null;
  const current = await app.db.query(
    `
    SELECT id, entity_id, account_type, label, bank_name, account_name, account_number,
           iban, swift_bic, currency_code, is_primary, is_active, attrs, created_at, updated_at
    FROM eip_core.entity_bank_account
    WHERE tenant_id=$1 AND entity_id=$2 AND id=$3
    `,
    [session.tenant_id, entity.id, normalizeUuid(bankAccountId, "bank_account_id")]
  );
  if (current.rowCount === 0) return null;
  const input = normalizeBank(body, current.rows[0], true);
  if (input.is_primary) {
    await app.db.query(
      `UPDATE eip_core.entity_bank_account SET is_primary=false, updated_at=now() WHERE tenant_id=$1 AND entity_id=$2 AND id<>$3`,
      [session.tenant_id, entity.id, current.rows[0].id]
    );
  }
  const result = await app.db.query(
    `
    UPDATE eip_core.entity_bank_account
    SET account_type=$4, label=$5, bank_name=$6, account_name=$7, account_number=$8,
        iban=$9, swift_bic=$10, currency_code=$11, is_primary=$12, is_active=$13,
        attrs=$14::jsonb, updated_at=now()
    WHERE tenant_id=$1 AND entity_id=$2 AND id=$3
    RETURNING id, entity_id, account_type, label, bank_name, account_name,
              CASE WHEN account_number IS NULL THEN NULL ELSE '****' || right(regexp_replace(account_number, '\\s+', '', 'g'), 4) END AS account_number_masked,
              CASE WHEN iban IS NULL THEN NULL ELSE '****' || right(regexp_replace(iban, '\\s+', '', 'g'), 4) END AS iban_masked,
              swift_bic, currency_code, is_primary, is_active, attrs, created_at, updated_at
    `,
    [
      session.tenant_id, entity.id, current.rows[0].id, input.account_type, input.label, input.bank_name,
      input.account_name, input.account_number, input.iban, input.swift_bic, input.currency_code,
      input.is_primary, input.is_active, JSON.stringify(input.attrs)
    ]
  );
  const item = mapBankRow(result.rows[0]);
  await emitMutation(app, session, MUTATION_EVENTS.bankUpdate, { entity_id: entity.id, bank_account_id: item.id, is_active: item.is_active });
  return { ok: true, item };
}

export async function listEntityRelationships(app, session, entityId) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return { ok: false, items: [] };
  const result = await app.db.query(
    `
    SELECT link.id, link.src_id, link.dst_id, link.relation_type, link.sort_order, link.attrs,
           link.is_active, link.created_at, link.updated_at,
           src.code AS src_code, src.name AS src_name, src.agent_type AS src_type,
           dst.code AS dst_code, dst.name AS dst_name, dst.agent_type AS dst_type
    FROM eip_core.object_link link
    JOIN eip_core.agent src ON src.tenant_id=link.tenant_id AND src.id=link.src_id AND link.src_kind='agent'
    JOIN eip_core.agent dst ON dst.tenant_id=link.tenant_id AND dst.id=link.dst_id AND link.dst_kind='agent'
    WHERE link.tenant_id=$1
      AND (link.src_id=$2 OR link.dst_id=$2)
    ORDER BY link.is_active DESC, link.sort_order ASC, link.updated_at DESC
    `,
    [session.tenant_id, entity.id]
  );
  return { ok: true, items: result.rows.map((row) => mapRelationshipRow(row, entity.id)) };
}

function normalizeRelationship(body, current = {}, partial = false) {
  rejectUnknownKeys(body, RELATIONSHIP_KEYS, "relationship");
  const currentAttrs = safeJson(current.attrs);
  const relatedEntityId = hasOwn(body, "related_entity_id")
    ? normalizeUuid(body.related_entity_id, "related_entity_id")
    : current.related_entity_id || current.dst_id || null;
  const relationType = hasOwn(body, "relation_type")
    ? normalizeCode(body.relation_type, "RELATED_TO")
    : current.relation_type || "RELATED_TO";
  if (!partial && !relatedEntityId) throw new EntityInputError("RELATED_ENTITY_REQUIRED");
  const direction = normalizeCode(body.direction || current.direction || "OUTGOING", "OUTGOING");
  if (!["OUTGOING", "INCOMING"].includes(direction)) throw new EntityInputError("INVALID_RELATIONSHIP_DIRECTION");
  const relationshipScope = hasOwn(body, "relationship_scope")
    ? normalizeCode(body.relationship_scope, "GENERAL")
    : currentAttrs.relationship_scope || current.relationship_scope || "GENERAL";
  const structureCategory = hasOwn(body, "structure_category")
    ? normalizeCode(body.structure_category, relationshipScope === "SELF" ? "SELF" : "GENERAL")
    : currentAttrs.structure_category || current.structure_category || (relationshipScope === "SELF" ? "SELF" : "GENERAL");
  const validFrom = hasOwn(body, "valid_from")
    ? normalizeDateTime(body.valid_from, "valid_from")
    : currentAttrs.valid_from || (!partial ? new Date().toISOString() : null);
  const validTo = hasOwn(body, "valid_to")
    ? normalizeDateTime(body.valid_to, "valid_to")
    : currentAttrs.valid_to || null;
  if (validFrom && validTo && new Date(validFrom).getTime() > new Date(validTo).getTime()) {
    throw new EntityInputError("INVALID_RELATIONSHIP_DATES");
  }
  const chartX = hasOwn(body, "chart_x")
    ? normalizeFiniteNumber(body.chart_x, "chart_x")
    : currentAttrs.chart?.x ?? null;
  const chartY = hasOwn(body, "chart_y")
    ? normalizeFiniteNumber(body.chart_y, "chart_y")
    : currentAttrs.chart?.y ?? null;
  const attrs = {
    ...currentAttrs,
    ...(hasOwn(body, "attrs") ? normalizeAttrs(body.attrs) : {})
  };
  attrs.relationship_scope = relationshipScope;
  attrs.structure_category = structureCategory;
  if (validFrom) attrs.valid_from = validFrom;
  if (validTo) attrs.valid_to = validTo;
  if (hasOwn(body, "mobile_affiliation")) attrs.mobile_affiliation = body.mobile_affiliation === true;
  else if (!hasOwn(attrs, "mobile_affiliation")) attrs.mobile_affiliation = false;
  if (hasOwn(body, "movement_reason")) attrs.movement_reason = normalizeOptionalText(body.movement_reason, 500);
  if (chartX !== null || chartY !== null) attrs.chart = { ...(attrs.chart && typeof attrs.chart === "object" ? attrs.chart : {}) };
  if (chartX !== null) attrs.chart.x = chartX;
  if (chartY !== null) attrs.chart.y = chartY;
  return {
    related_entity_id: relatedEntityId,
    relation_type: relationType,
    direction,
    relationship_scope: relationshipScope,
    structure_category: structureCategory,
    valid_from: validFrom,
    valid_to: validTo,
    mobile_affiliation: attrs.mobile_affiliation === true,
    movement_reason: attrs.movement_reason || null,
    sort_order: hasOwn(body, "sort_order")
      ? normalizeFiniteNumber(body.sort_order, "sort_order", 100)
      : normalizeFiniteNumber(current.sort_order, "sort_order", 100),
    is_active: hasOwn(body, "is_active") ? body.is_active !== false : current.is_active !== false,
    attrs
  };
}

function isChildToParentOrgRelation(relationType) {
  return ORG_CHILD_TO_PARENT_RELATION_TYPES.includes(String(relationType || "").toUpperCase());
}

function isParentToChildOrgRelation(relationType) {
  return ORG_PARENT_TO_CHILD_RELATION_TYPES.includes(String(relationType || "").toUpperCase());
}

async function closePriorMobileAffiliations(db, tenantId, childEntityId, input, excludeRelationshipId = null) {
  if (!input.mobile_affiliation || !isChildToParentOrgRelation(input.relation_type)) return;
  const closedAt = input.valid_from || new Date().toISOString();
  await db.query(
    `
    UPDATE eip_core.object_link
    SET is_active=false,
        attrs=COALESCE(attrs,'{}'::jsonb)
          || jsonb_build_object(
            'valid_to', $6::text,
            'superseded_by_entity_id', $7::text,
            'movement_reason', $8::text,
            'mobile_affiliation', true
          ),
        updated_at=now()
    WHERE tenant_id=$1
      AND src_kind='agent'
      AND dst_kind='agent'
      AND src_id=$2
      AND is_active=true
      AND relation_type = ANY($3::text[])
      AND COALESCE(attrs->>'relationship_scope','GENERAL')=$4
      AND COALESCE(attrs->>'structure_category','SELF')=$5
      AND ($9::uuid IS NULL OR id<>$9::uuid)
    `,
    [
      tenantId,
      childEntityId,
      ORG_CHILD_TO_PARENT_RELATION_TYPES,
      input.relationship_scope,
      input.structure_category,
      closedAt,
      input.related_entity_id,
      input.movement_reason || "Affiliation changed",
      excludeRelationshipId
    ]
  );
}

async function closeRelationshipById(db, tenantId, relationshipId, input) {
  await db.query(
    `
    UPDATE eip_core.object_link
    SET is_active=false,
        attrs=COALESCE(attrs,'{}'::jsonb)
          || jsonb_build_object(
            'valid_to', $3::text,
            'superseded_by_entity_id', $4::text,
            'movement_reason', $5::text,
            'mobile_affiliation', true
          ),
        updated_at=now()
    WHERE tenant_id=$1
      AND id=$2
      AND src_kind='agent'
      AND dst_kind='agent'
    `,
    [
      tenantId,
      relationshipId,
      input.valid_from || new Date().toISOString(),
      input.related_entity_id,
      input.movement_reason || "Affiliation changed"
    ]
  );
}

export async function createEntityRelationship(app, session, entityId, body = {}) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return null;
  const input = normalizeRelationship(body);
  const related = await ensureEntity(app.db, session.tenant_id, input.related_entity_id);
  if (!related) throw new EntityInputError("RELATED_ENTITY_NOT_FOUND");
  if (related.id === entity.id) throw new EntityInputError("SELF_RELATIONSHIP_NOT_ALLOWED");
  const srcId = input.direction === "INCOMING" ? related.id : entity.id;
  const dstId = input.direction === "INCOMING" ? entity.id : related.id;
  await closePriorMobileAffiliations(app.db, session.tenant_id, srcId, input);
  const result = await app.db.query(
    `
    INSERT INTO eip_core.object_link
      (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, sort_order, attrs, is_active)
    VALUES ($1,'agent',$2,'agent',$3,$4,$5,$6::jsonb,$7)
    ON CONFLICT (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type)
    DO UPDATE SET sort_order=EXCLUDED.sort_order, attrs=EXCLUDED.attrs, is_active=EXCLUDED.is_active, updated_at=now()
    RETURNING id, src_id, dst_id, relation_type, sort_order, attrs, is_active, created_at, updated_at
    `,
    [session.tenant_id, srcId, dstId, input.relation_type, input.sort_order, JSON.stringify(input.attrs), input.is_active]
  );
  const rows = await listEntityRelationships(app, session, entity.id);
  const item = rows.items.find((relationship) => relationship.id === result.rows[0].id) || mapRelationshipRow(result.rows[0], entity.id);
  await emitMutation(app, session, MUTATION_EVENTS.relationshipCreate, { entity_id: entity.id, relationship_id: item.id, relation_type: item.relation_type });
  return { ok: true, item };
}

export async function updateEntityRelationship(app, session, entityId, relationshipId, body = {}) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return null;
  const current = await app.db.query(
    `
    SELECT id, src_id, dst_id, relation_type, sort_order, attrs, is_active
    FROM eip_core.object_link
    WHERE tenant_id=$1 AND id=$2 AND src_kind='agent' AND dst_kind='agent' AND (src_id=$3 OR dst_id=$3)
    `,
    [session.tenant_id, normalizeUuid(relationshipId, "relationship_id"), entity.id]
  );
  if (current.rowCount === 0) return null;
  const currentRow = {
    ...current.rows[0],
    related_entity_id: current.rows[0].src_id === entity.id ? current.rows[0].dst_id : current.rows[0].src_id,
    direction: current.rows[0].src_id === entity.id ? "OUTGOING" : "INCOMING"
  };
  const input = normalizeRelationship(body, currentRow, true);
  const related = await ensureEntity(app.db, session.tenant_id, input.related_entity_id);
  if (!related) throw new EntityInputError("RELATED_ENTITY_NOT_FOUND");
  if (related.id === entity.id) throw new EntityInputError("SELF_RELATIONSHIP_NOT_ALLOWED");
  const srcId = input.direction === "INCOMING" ? related.id : entity.id;
  const dstId = input.direction === "INCOMING" ? entity.id : related.id;
  const mobileReparent = input.mobile_affiliation &&
    isChildToParentOrgRelation(input.relation_type) &&
    (String(current.rows[0].src_id) !== String(srcId) ||
      String(current.rows[0].dst_id) !== String(dstId) ||
      String(current.rows[0].relation_type) !== String(input.relation_type));
  if (mobileReparent) {
    await closePriorMobileAffiliations(app.db, session.tenant_id, srcId, input, current.rows[0].id);
    await closeRelationshipById(app.db, session.tenant_id, current.rows[0].id, input);
    const inserted = await app.db.query(
      `
      INSERT INTO eip_core.object_link
        (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, sort_order, attrs, is_active)
      VALUES ($1,'agent',$2,'agent',$3,$4,$5,$6::jsonb,$7)
      ON CONFLICT (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type)
      DO UPDATE SET sort_order=EXCLUDED.sort_order, attrs=EXCLUDED.attrs, is_active=EXCLUDED.is_active, updated_at=now()
      RETURNING id, src_id, dst_id, relation_type, sort_order, attrs, is_active, created_at, updated_at
      `,
      [session.tenant_id, srcId, dstId, input.relation_type, input.sort_order, JSON.stringify(input.attrs), input.is_active]
    );
    const rows = await listEntityRelationships(app, session, entity.id);
    const item = rows.items.find((relationship) => relationship.id === inserted.rows[0].id) || mapRelationshipRow(inserted.rows[0], entity.id);
    await emitMutation(app, session, MUTATION_EVENTS.relationshipMove, { entity_id: entity.id, relationship_id: item.id, is_active: item.is_active });
    return { ok: true, item };
  }
  await closePriorMobileAffiliations(app.db, session.tenant_id, srcId, input, current.rows[0].id);
  const result = await app.db.query(
    `
    UPDATE eip_core.object_link
    SET src_id=$4, dst_id=$5, relation_type=$6, sort_order=$7, attrs=$8::jsonb, is_active=$9, updated_at=now()
    WHERE tenant_id=$1 AND id=$2 AND (src_id=$3 OR dst_id=$3) AND src_kind='agent' AND dst_kind='agent'
    RETURNING id, src_id, dst_id, relation_type, sort_order, attrs, is_active, created_at, updated_at
    `,
    [session.tenant_id, current.rows[0].id, entity.id, srcId, dstId, input.relation_type, input.sort_order, JSON.stringify(input.attrs), input.is_active]
  );
  const rows = await listEntityRelationships(app, session, entity.id);
  const item = rows.items.find((relationship) => relationship.id === result.rows[0].id) || mapRelationshipRow(result.rows[0], entity.id);
  await emitMutation(app, session, MUTATION_EVENTS.relationshipUpdate, { entity_id: entity.id, relationship_id: item.id, is_active: item.is_active });
  return { ok: true, item };
}

function chartNodeFromAgent(row, prefix) {
  return {
    id: row[`${prefix}_id`],
    code: row[`${prefix}_code`],
    display_name: row[`${prefix}_name`],
    entity_kind: row[`${prefix}_type`],
    status: row[`${prefix}_status`] || null
  };
}

function orgEdgeFromRow(row) {
  const attrs = safeJson(row.attrs);
  const parentToChild = isParentToChildOrgRelation(row.relation_type);
  const parent = parentToChild ? chartNodeFromAgent(row, "src") : chartNodeFromAgent(row, "dst");
  const child = parentToChild ? chartNodeFromAgent(row, "dst") : chartNodeFromAgent(row, "src");
  const chart = attrs.chart && typeof attrs.chart === "object" ? attrs.chart : {};
  return {
    id: row.id,
    relationship_id: row.id,
    parent_entity_id: parent.id,
    child_entity_id: child.id,
    parent,
    child,
    relation_type: row.relation_type,
    relationship_scope: attrs.relationship_scope || "GENERAL",
    structure_category: attrs.structure_category || null,
    valid_from: attrs.valid_from || null,
    valid_to: attrs.valid_to || null,
    mobile_affiliation: attrs.mobile_affiliation === true,
    sort_order: row.sort_order,
    chart_x: chart.x ?? null,
    chart_y: chart.y ?? null
  };
}

async function loadOrgChartRows(db, tenantId, relationshipScope = "SELF", structureCategory = "SELF") {
  const result = await db.query(
    `
    SELECT link.id, link.src_id, link.dst_id, link.relation_type, link.sort_order, link.attrs,
           link.is_active, link.created_at, link.updated_at,
           src.id AS src_id, src.code AS src_code, src.name AS src_name, src.agent_type AS src_type,
           COALESCE(src.attrs->>'status', CASE WHEN src.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END) AS src_status,
           dst.id AS dst_id, dst.code AS dst_code, dst.name AS dst_name, dst.agent_type AS dst_type,
           COALESCE(dst.attrs->>'status', CASE WHEN dst.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END) AS dst_status
    FROM eip_core.object_link link
    JOIN eip_core.agent src ON src.tenant_id=link.tenant_id AND src.id=link.src_id AND link.src_kind='agent'
    JOIN eip_core.agent dst ON dst.tenant_id=link.tenant_id AND dst.id=link.dst_id AND link.dst_kind='agent'
    WHERE link.tenant_id=$1
      AND link.src_kind='agent'
      AND link.dst_kind='agent'
      AND link.is_active=true
      AND link.relation_type = ANY($2::text[])
      AND COALESCE(link.attrs->>'relationship_scope','GENERAL')=$3
      AND COALESCE(link.attrs->>'structure_category','SELF')=$4
      AND (
        link.attrs->>'valid_to' IS NULL
        OR (link.attrs->>'valid_to')::timestamptz >= now()
      )
    ORDER BY link.sort_order ASC, link.updated_at DESC
    `,
    [tenantId, ORG_CHART_RELATION_TYPES, relationshipScope, structureCategory]
  );
  return result.rows;
}

function buildOrgChart(rootEntity, rows) {
  const nodes = new Map();
  const edges = rows.map(orgEdgeFromRow);
  const neighbors = new Map();
  const incoming = new Map();

  function addNode(node, position = {}) {
    if (!node?.id) return;
    const current = nodes.get(node.id) || node;
    nodes.set(node.id, {
      ...current,
      ...node,
      chart_x: current.chart_x ?? position.x ?? null,
      chart_y: current.chart_y ?? position.y ?? null
    });
  }

  addNode({
    id: rootEntity.id,
    code: rootEntity.code,
    display_name: rootEntity.name,
    entity_kind: rootEntity.agent_type,
    status: safeJson(rootEntity.attrs).status || (rootEntity.is_active ? "ACTIVE" : "INACTIVE")
  }, { x: 0, y: 0 });

  for (const edge of edges) {
    addNode(edge.parent);
    addNode(edge.child, { x: edge.chart_x, y: edge.chart_y });
    neighbors.set(edge.parent_entity_id, [...(neighbors.get(edge.parent_entity_id) || []), edge.child_entity_id]);
    neighbors.set(edge.child_entity_id, [...(neighbors.get(edge.child_entity_id) || []), edge.parent_entity_id]);
    incoming.set(edge.child_entity_id, [...(incoming.get(edge.child_entity_id) || []), edge.parent_entity_id]);
  }

  const included = new Set();
  const queue = [rootEntity.id];
  while (queue.length) {
    const nodeId = queue.shift();
    if (!nodeId || included.has(nodeId)) continue;
    included.add(nodeId);
    for (const nextId of neighbors.get(nodeId) || []) {
      if (!included.has(nextId)) queue.push(nextId);
    }
  }

  const visibleEdges = edges.filter((edge) => included.has(edge.parent_entity_id) && included.has(edge.child_entity_id));
  const rootIds = [...included].filter((nodeId) => !(incoming.get(nodeId) || []).some((parentId) => included.has(parentId)));
  return {
    ok: true,
    root_id: rootEntity.id,
    roots: rootIds.length ? rootIds : [rootEntity.id],
    nodes: [...nodes.values()].filter((node) => included.has(node.id)),
    edges: visibleEdges
  };
}

function wouldCreateOrgCycle(rows, childEntityId, newParentEntityId) {
  const childrenByParent = new Map();
  for (const row of rows) {
    const edge = orgEdgeFromRow(row);
    childrenByParent.set(edge.parent_entity_id, [...(childrenByParent.get(edge.parent_entity_id) || []), edge.child_entity_id]);
  }
  const stack = [childEntityId];
  const visited = new Set();
  while (stack.length) {
    const nodeId = stack.pop();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);
    if (nodeId === newParentEntityId) return true;
    for (const childId of childrenByParent.get(nodeId) || []) stack.push(childId);
  }
  return false;
}

export async function getEntityOrgChart(app, session, entityId, query = {}) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return null;
  const relationshipScope = normalizeCode(query.relationship_scope || query.scope || "SELF", "SELF");
  const structureCategory = normalizeCode(query.structure_category || query.category || "SELF", "SELF");
  const rows = await loadOrgChartRows(app.db, session.tenant_id, relationshipScope, structureCategory);
  return buildOrgChart(entity, rows);
}

export async function moveEntityOrgChartNode(app, session, entityId, body = {}) {
  const root = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!root) return null;
  const child = await ensureEntity(app.db, session.tenant_id, body.node_id);
  if (!child) throw new EntityInputError("ORG_CHART_NODE_NOT_FOUND");
  const parent = await ensureEntity(app.db, session.tenant_id, body.new_parent_entity_id);
  if (!parent) throw new EntityInputError("ORG_CHART_PARENT_NOT_FOUND");
  if (child.id === parent.id) throw new EntityInputError("ORG_CHART_SELF_PARENT_NOT_ALLOWED");

  const relationshipScope = normalizeCode(body.relationship_scope || body.scope || "SELF", "SELF");
  const structureCategory = normalizeCode(body.structure_category || body.category || "SELF", "SELF");
  const relationType = normalizeCode(body.relation_type || "MEMBER_OF", "MEMBER_OF");
  if (!isChildToParentOrgRelation(relationType)) throw new EntityInputError("INVALID_ORG_CHART_RELATIONSHIP");

  const rows = await loadOrgChartRows(app.db, session.tenant_id, relationshipScope, structureCategory);
  if (wouldCreateOrgCycle(rows, child.id, parent.id)) throw new EntityInputError("ORG_CHART_CYCLE_NOT_ALLOWED");

  const input = normalizeRelationship({
    related_entity_id: parent.id,
    relation_type: relationType,
    direction: "OUTGOING",
    relationship_scope: relationshipScope,
    structure_category: structureCategory,
    valid_from: body.valid_from || new Date().toISOString(),
    mobile_affiliation: true,
    movement_reason: body.movement_reason,
    chart_x: body.chart_x,
    chart_y: body.chart_y,
    sort_order: body.sort_order,
    is_active: true,
    attrs: body.attrs
  });

  await closePriorMobileAffiliations(app.db, session.tenant_id, child.id, input);
  const result = await app.db.query(
    `
    INSERT INTO eip_core.object_link
      (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, sort_order, attrs, is_active)
    VALUES ($1,'agent',$2,'agent',$3,$4,$5,$6::jsonb,true)
    ON CONFLICT (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type)
    DO UPDATE SET sort_order=EXCLUDED.sort_order, attrs=EXCLUDED.attrs, is_active=true, updated_at=now()
    RETURNING id, src_id, dst_id, relation_type, sort_order, attrs, is_active, created_at, updated_at
    `,
    [session.tenant_id, child.id, parent.id, input.relation_type, input.sort_order, JSON.stringify(input.attrs)]
  );
  const relationshipRows = await listEntityRelationships(app, session, child.id);
  const item = relationshipRows.items.find((relationship) => relationship.id === result.rows[0].id) || mapRelationshipRow(result.rows[0], child.id);
  const orgChart = await getEntityOrgChart(app, session, root.id, { relationship_scope: relationshipScope, structure_category: structureCategory });
  await emitMutation(app, session, MUTATION_EVENTS.relationshipMove, {
    entity_id: child.id,
    parent_entity_id: parent.id,
    root_entity_id: root.id,
    relationship_id: item.id,
    relation_type: item.relation_type
  });
  return { ok: true, item, org_chart: orgChart };
}

export async function listEntityDocuments(app, session, entityId) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return { ok: false, items: [] };
  const result = await app.db.query(
    `
    SELECT info.id, info.record_type, info.title, info.mime_type, info.file_size,
           info.created_by_agent_id, info.is_active, info.created_at, info.updated_at,
           link.relation_type
    FROM eip_core.object_link link
    JOIN eip_core.info_record info
      ON info.tenant_id=link.tenant_id
     AND info.id = CASE WHEN link.src_kind='info_record' THEN link.src_id ELSE link.dst_id END
    WHERE link.tenant_id=$1
      AND link.is_active=true
      AND info.is_active=true
      AND (
        (link.src_kind='agent' AND link.src_id=$2 AND link.dst_kind='info_record')
        OR (link.dst_kind='agent' AND link.dst_id=$2 AND link.src_kind='info_record')
      )
    ORDER BY info.created_at DESC
    LIMIT 50
    `,
    [session.tenant_id, entity.id]
  );
  return {
    ok: true,
    items: result.rows.map((row) => ({
      id: row.id,
      record_type: row.record_type,
      title: row.title,
      mime_type: row.mime_type,
      file_size: row.file_size === null || row.file_size === undefined ? null : Number(row.file_size),
      created_by_agent_id: row.created_by_agent_id,
      relation_type: row.relation_type,
      is_active: row.is_active === true,
      created_at: row.created_at,
      updated_at: row.updated_at
    }))
  };
}

function classifyPolicyDomain(row) {
  const attrs = safeJson(row.attrs);
  const explicit = normalizeText(attrs.classification?.policy_domain).toUpperCase();
  if (explicit) return explicit;
  const category = normalizeText(row.condition_category).toUpperCase();
  const type = normalizeText(row.condition_type).toUpperCase();
  if (/INVENTORY|REORDER|STOCK/.test(`${category} ${type}`)) return "INVENTORY";
  if (/TAX|VAT|FISCAL/.test(`${category} ${type}`)) return "FISCAL_TAX_TREATMENT";
  if (/APPROVAL|AUTHORITY|DELEGATION/.test(`${category} ${type}`)) return "APPROVAL_FRAMEWORK";
  if (/LOGISTICS|FREIGHT|DELIVERY|CARRIER/.test(`${category} ${type}`)) return "LOGISTICS";
  if (/FINANC/.test(`${category} ${type}`)) return "FINANCIAL";
  if (/MARKETPLACE|CHANNEL/.test(`${category} ${type}`)) return "MARKETPLACE";
  return "COMMERCIAL";
}

export async function getEntityPolicySummary(app, session, entityId) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) return { ok: false, summary: { total: 0, by_domain: {}, needs_review: 0, items: [] } };
  const result = await app.db.query(
    `
    SELECT id, code, label, condition_type, condition_category, priority, scope, attrs, updated_at
    FROM eip_core.commercial_condition
    WHERE tenant_id=$1
      AND is_active=true
      AND (
        COALESCE(scope,'{}'::jsonb) @> $2::jsonb
        OR COALESCE(scope,'{}'::jsonb) @> $3::jsonb
        OR COALESCE(attrs,'{}'::jsonb) @> $4::jsonb
      )
    ORDER BY priority ASC, updated_at DESC
    LIMIT 50
    `,
    [
      session.tenant_id,
      JSON.stringify({ entity_id: entity.id }),
      JSON.stringify({ agent_id: entity.id }),
      JSON.stringify({ entity_id: entity.id })
    ]
  );
  const items = result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    condition_type: row.condition_type,
    condition_category: row.condition_category,
    priority: row.priority,
    policy_domain: classifyPolicyDomain(row),
    needs_review: safeJson(row.attrs).classification?.policy_domain === "NEEDS_REVIEW",
    updated_at: row.updated_at
  }));
  const byDomain = {};
  for (const item of items) byDomain[item.policy_domain] = (byDomain[item.policy_domain] || 0) + 1;
  return {
    ok: true,
    summary: {
      total: items.length,
      by_domain: byDomain,
      needs_review: items.filter((item) => item.needs_review).length,
      items
    }
  };
}

export async function getEntityActivitySummary(app, session, entityId) {
  const entity = await ensureEntity(app.db, session.tenant_id, entityId);
  if (!entity) {
    return { ok: false, summary: { service_objects: { total: 0, by_type: {} }, tasks: { total: 0, open: 0, overdue: 0 } } };
  }
  const [serviceObjects, tasks] = await Promise.all([
    app.db.query(
      `
      SELECT so.object_type, so.status, count(*)::int AS count
      FROM eip_core.service_object_party party
      JOIN eip_core.service_object so
        ON so.tenant_id=party.tenant_id AND so.id=party.service_object_id
      WHERE party.tenant_id=$1 AND party.agent_id=$2
      GROUP BY so.object_type, so.status
      ORDER BY so.object_type ASC, so.status ASC
      `,
      [session.tenant_id, entity.id]
    ),
    app.db.query(
      `
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE lower(status) NOT IN ('done','closed','cancelled','resolved'))::int AS open,
        count(*) FILTER (WHERE lower(status) NOT IN ('done','closed','cancelled','resolved') AND due_at IS NOT NULL AND due_at < now())::int AS overdue
      FROM eip_core.task
      WHERE tenant_id=$1 AND assigned_agent_id=$2
      `,
      [session.tenant_id, entity.id]
    )
  ]);
  const byType = {};
  const byStatus = {};
  for (const row of serviceObjects.rows) {
    byType[row.object_type] = (byType[row.object_type] || 0) + Number(row.count || 0);
    byStatus[row.status] = (byStatus[row.status] || 0) + Number(row.count || 0);
  }
  return {
    ok: true,
    summary: {
      service_objects: {
        total: serviceObjects.rows.reduce((sum, row) => sum + Number(row.count || 0), 0),
        by_type: byType,
        by_status: byStatus
      },
      tasks: {
        total: Number(tasks.rows[0]?.total || 0),
        open: Number(tasks.rows[0]?.open || 0),
        overdue: Number(tasks.rows[0]?.overdue || 0)
      }
    }
  };
}

export async function getEntityGovernanceOptions(app, session) {
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
    [session.tenant_id, ENTITY_DROPDOWN_CODES]
    ),
    loadModuleWorkspace(app, session.tenant_id, "entity-management")
  ]);
  const options = {};
  for (const row of result.rows) {
    options[row.list_code] = options[row.list_code] || [];
    options[row.list_code].push({
      code: row.code,
      label: row.label,
      sort_order: row.sort_order,
      attrs: safeJson(row.attrs)
    });
  }
  return {
    ok: true,
    options,
    defaults: {
      roles: DEFAULT_ENTITY_ROLES,
      statuses: ENTITY_STATUSES
    },
    workspace
  };
}
