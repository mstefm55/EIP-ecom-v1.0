import {
  connectionAllowsStorefrontCapability,
  connectionAllowsStorefrontScope,
  extractProfiles
} from "../services/gateway/connectionProfile.js";
import { hydrateConnectionProfileSecrets } from "../services/gateway/secretStore.js";
import { connectionAllowsOrigin, verifyConnectionRequest } from "../services/gateway/verification.js";

const RATE_LIMIT = { max: 60, timeWindow: "1 minute" };
const PUBLICATION_RECORD_TYPE = "PERFECT_FIT_PUBLICATION_REQUEST";
const PUBLICATION_PROCESS_CODE = "ECOM_STOREFRONT_CONTENT_FLOW";
const PUBLICATION_OBJECT_TYPE = "storefront_content";
const MAX_PUBLICATION_SNAPSHOT_BYTES = 500 * 1024;

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function applyCors(reply, origin) {
  if (!origin) return;
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Credentials", "true");
  reply.header(
    "Access-Control-Allow-Headers",
    "Content-Type, X-API-Key, Authorization, X-Event-Id, X-Member-Csrf"
  );
  reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

async function resolveTenantBySuffix(app, suffix) {
  const result = await app.db.query(
    `
    SELECT id, code, name, attrs
    FROM eip_core.tenant
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(attrs->'connection_profiles') = 'array'
          THEN attrs->'connection_profiles'
          ELSE '[]'::jsonb
        END
      ) AS profile
      WHERE profile->'inbound'->>'inbound_path_suffix' = $1
    )
    LIMIT 2
    `,
    [suffix]
  );
  if (result.rowCount !== 1) return null;
  const tenant = result.rows[0];
  const profiles = extractProfiles(tenant.attrs);
  const profile = profiles.find((item) => item?.inbound?.inbound_path_suffix === suffix);
  return profile ? { tenant, profile } : null;
}

async function resolveAccess(app, req, reply) {
  const suffix = normalizeText(req.params?.suffix);
  if (!suffix) {
    reply.code(400).send({ ok: false, error: "CONNECTION_SUFFIX_REQUIRED" });
    return null;
  }

  const resolved = await resolveTenantBySuffix(app, suffix);
  if (!resolved) {
    reply.code(404).send({ ok: false, error: "ROUTING_NOT_FOUND" });
    return null;
  }

  let { profile } = resolved;
  if (!profile.identity?.is_enabled) {
    reply.code(403).send({ ok: false, error: "CONNECTION_DISABLED" });
    return null;
  }

  const direction = normalizeText(profile.identity?.direction).toLowerCase();
  if (direction !== "inbound" && direction !== "both") {
    reply.code(403).send({ ok: false, error: "INBOUND_NOT_ALLOWED" });
    return null;
  }

  const origin = normalizeText(req.headers.origin);
  if (!connectionAllowsOrigin(profile, origin)) {
    reply.code(403).send({ ok: false, error: "ORIGIN_NOT_ALLOWED" });
    return null;
  }

  profile = await hydrateConnectionProfileSecrets(app, app.db, resolved.tenant.id, profile);
  const rawBody = Buffer.from(JSON.stringify(req.body || {}));
  const verified = await verifyConnectionRequest(req, profile, rawBody);
  if (!verified.ok) {
    reply.code(401).send({ ok: false, error: verified.error });
    return null;
  }

  applyCors(reply, origin);
  return { tenant: resolved.tenant, profile, suffix, origin };
}

function requirePerfectFitScope(access, reply, scope) {
  if (!connectionAllowsStorefrontCapability(access.profile, "perfect_fit")) {
    reply.code(403).send({ ok: false, error: "PERFECT_FIT_DISABLED" });
    return false;
  }
  if (!connectionAllowsStorefrontScope(access.profile, scope)) {
    reply.code(403).send({ ok: false, error: "PERFECT_FIT_SCOPE_REQUIRED" });
    return false;
  }
  return true;
}

async function loadMemberSession(app, req, tenantId, suffix) {
  const sid = normalizeText(req.cookies?.member_sid);
  if (!sid) return null;

  const result = await app.db.query(
    `
    SELECT id, tenant_id, identity_id, expires_at, is_revoked, attrs
    FROM eip_auth.auth_session
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [sid]
  );
  if (result.rowCount !== 1) return null;
  const session = result.rows[0];
  if (session.is_revoked || new Date(session.expires_at).getTime() <= Date.now()) return null;
  if (String(session.tenant_id) !== String(tenantId)) return null;
  const attrs = session.attrs && typeof session.attrs === "object" ? session.attrs : {};
  if (normalizeUpper(attrs.realm) !== "MEMBER") return null;
  if (normalizeText(attrs.connection_suffix) !== normalizeText(suffix)) return null;
  return session;
}

function requireMemberCsrf(req, reply) {
  const csrfCookie = normalizeText(req.cookies?.member_csrf);
  const csrfHeader = normalizeText(req.headers["x-member-csrf"]);
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    reply.code(403).send({ ok: false, error: "MEMBER_CSRF_REQUIRED" });
    return false;
  }
  return true;
}

async function requireMemberSession(app, req, reply, access) {
  const session = await loadMemberSession(app, req, access.tenant.id, access.suffix);
  if (!session) {
    reply.code(401).send({ ok: false, error: "MEMBER_UNAUTHENTICATED" });
    return null;
  }
  return session;
}

async function requirePfAdmin(app, access, session, reply) {
  const role = await app.db.query(
    `
    SELECT 1
    FROM eip_authz.identity_role ir
    JOIN eip_authz.role r ON r.id = ir.role_id
    WHERE ir.tenant_id = $1
      AND ir.identity_id = $2
      AND r.is_active = true
      AND r.code = 'PF_ADMIN'
    LIMIT 1
    `,
    [access.tenant.id, session.identity_id]
  );
  if (!role.rowCount) {
    reply.code(403).send({ ok: false, error: "PF_ADMIN_REQUIRED" });
    return false;
  }
  return true;
}

async function requireAdminSession(app, req, reply, access) {
  const session = await requireMemberSession(app, req, reply, access);
  if (!session) return null;
  if (!(await requirePfAdmin(app, access, session, reply))) return null;
  return session;
}

function forbiddenProjectionKey(key) {
  const normalized = String(key || "").trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith("workspace")) return true;
  return new Set([
    "raw",
    "source",
    "attrs",
    "values",
    "children",
    "ownership",
    "messagingowner",
    "primarymediaasset",
    "technicalsketchasset",
    "gallerymediaassets",
    "stablejoinkeys",
    "privaterouting",
    "token",
    "accesstoken",
    "refreshtoken",
    "filehandle",
    "file_handle"
  ]).has(normalized);
}

function sanitizeCustomerProjection(value, depth = 0) {
  if (depth > 10 || value === null || value === undefined) return null;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    const text = value.slice(0, 12000);
    if (/^(blob:|file:|data:)/i.test(text)) return "";
    return text;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 250).map((item) => sanitizeCustomerProjection(item, depth + 1));
  }
  if (typeof value !== "object") return null;

  const output = {};
  for (const [key, entry] of Object.entries(value).slice(0, 250)) {
    if (forbiddenProjectionKey(key)) continue;
    output[key] = sanitizeCustomerProjection(entry, depth + 1);
  }
  return output;
}

function publicationStatusFromServiceObject(status, node) {
  const normalizedStatus = normalizeText(status).toLowerCase();
  const normalizedNode = normalizeText(node).toLowerCase();
  if (normalizedStatus === "published" || normalizedNode === "content_published") return "PUBLISHED";
  if (normalizedStatus === "rejected" || normalizedNode === "content_rejected") return "RETURNED_BY_MODERATOR";
  if (normalizedStatus === "review" || normalizedNode === "content_review") return "AWAITING_MODERATOR_RELEASE";
  if (normalizedStatus === "approved" || normalizedNode === "content_approved") return "APPROVED";
  if (normalizedStatus === "cancelled" || normalizedNode === "content_closed") return "UNPUBLISHED";
  return "SUBMISSION_PROCESSING";
}

async function loadIdentityDisplay(client, tenantId, identityId) {
  const result = await client.query(
    `
    SELECT login, attrs
    FROM eip_auth.auth_identity
    WHERE tenant_id=$1 AND id=$2
    LIMIT 1
    `,
    [tenantId, identityId]
  );
  const row = result.rows[0] || {};
  const attrs = row.attrs && typeof row.attrs === "object" ? row.attrs : {};
  const name = normalizeText(
    attrs.display_name || attrs.full_name || attrs.name || attrs.username || row.login || "Designer"
  );
  return {
    identity_id: identityId,
    login: normalizeText(row.login),
    name: name || "Designer"
  };
}

async function loadPrivateOwnerWorkspace(client, tenantId, identityId) {
  const result = await client.query(
    `
    SELECT payload->'workspace' AS workspace
    FROM eip_core.info_record
    WHERE tenant_id=$1
      AND record_type='PERFECT_FIT_WORKSPACE'
      AND is_active=true
      AND attrs->>'owner_identity_id'=$2
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [tenantId, String(identityId)]
  );
  const workspace = result.rows[0]?.workspace;
  return workspace && typeof workspace === "object" ? workspace : null;
}

function findOwnedVariantContext(workspace, { variantId, variantCode }) {
  const targetId = normalizeText(variantId);
  const targetCode = normalizeText(variantCode);
  for (const project of Array.isArray(workspace?.projects) ? workspace.projects : []) {
    if (project?.nodeType !== "project") continue;
    for (const style of Array.isArray(project?.children) ? project.children : []) {
      if (style?.nodeType !== "product") continue;
      for (const variant of Array.isArray(style?.children) ? style.children : []) {
        if (variant?.nodeType !== "variant") continue;
        const code = normalizeText(variant?.values?.["variant.code"]);
        if ((targetId && String(variant.id) === targetId) || (targetCode && code === targetCode)) {
          return { project, style, variant };
        }
      }
    }
  }
  return null;
}

async function resolveLinkedMaterial(client, tenantId, context) {
  const variantId = normalizeText(context?.variant?.id);
  const variantCode = normalizeText(context?.variant?.values?.["variant.code"]);
  const result = await client.query(
    `
    SELECT m.id, m.code, m.name, m.attrs,
           ir.payload->'perfect_fit' AS perfect_fit
    FROM eip_core.material m
    JOIN eip_core.object_link ol
      ON ol.tenant_id=m.tenant_id
     AND ol.src_kind='material'
     AND ol.src_id=m.id
     AND ol.dst_kind='info_record'
     AND ol.relation_type='PERFECT_FIT_PRODUCT'
     AND ol.is_active=true
    JOIN eip_core.info_record ir
      ON ir.tenant_id=ol.tenant_id
     AND ir.id=ol.dst_id
     AND ir.record_type='PERFECT_FIT_PRODUCT_LINK'
     AND ir.is_active=true
    WHERE m.tenant_id=$1
      AND m.material_type='PRODUCT'
      AND COALESCE(m.attrs->'product_hierarchy'->>'level','')='STYLE_VARIANT'
      AND (
        ($2 <> '' AND ir.payload->'perfect_fit'->>'variant_id'=$2)
        OR ($3 <> '' AND ir.payload->'perfect_fit'->>'variant_code'=$3)
      )
    ORDER BY CASE WHEN ir.payload->'perfect_fit'->>'variant_id'=$2 THEN 0 ELSE 1 END,
             ol.updated_at DESC
    LIMIT 2
    `,
    [tenantId, variantId, variantCode]
  );
  if (result.rowCount !== 1) return null;
  return result.rows[0];
}

async function resolvePublicationProcessBinding(client, tenantId) {
  const result = await client.query(
    `
    SELECT pb.process_def_id
    FROM eip_core.process_binding pb
    JOIN eip_core.process_def pd
      ON pd.tenant_id=pb.tenant_id
     AND pd.id=pb.process_def_id
     AND pd.is_active=true
    WHERE pb.tenant_id=$1
      AND pb.service_object_type=$2
      AND pb.is_active=true
      AND pd.code=$3
    ORDER BY pb.priority ASC, pb.created_at DESC
    LIMIT 1
    `,
    [tenantId, PUBLICATION_OBJECT_TYPE, PUBLICATION_PROCESS_CODE]
  );
  return result.rows[0] || null;
}

async function loadPublicationRecord(client, tenantId, requestId, options = {}) {
  const params = [tenantId, PUBLICATION_RECORD_TYPE, requestId];
  const ownerFilter = options.ownerIdentityId
    ? `AND ir.attrs->>'owner_identity_id'=$4`
    : "";
  if (options.ownerIdentityId) params.push(String(options.ownerIdentityId));
  const lockSql = options.forUpdate ? "FOR UPDATE OF ir, so" : "";

  const result = await client.query(
    `
    SELECT ir.id AS info_record_id,
           ir.payload,
           ir.attrs AS record_attrs,
           ir.created_at,
           ir.updated_at,
           so.id AS service_object_id,
           so.status AS service_object_status,
           so.attrs AS service_object_attrs,
           pi.id AS process_instance_id,
           pi.cursor_json,
           pi.status AS process_status,
           pi.ended_at,
           m.id AS material_id,
           m.code AS material_code,
           m.name AS material_name
    FROM eip_core.info_record ir
    JOIN eip_core.service_object so
      ON so.tenant_id=ir.tenant_id
     AND so.id=(ir.payload->>'service_object_id')::uuid
    LEFT JOIN eip_core.process_instance pi
      ON pi.tenant_id=so.tenant_id
     AND pi.service_object_id=so.id
     AND pi.ended_at IS NULL
     AND pi.status='active'
    JOIN eip_core.material m
      ON m.tenant_id=ir.tenant_id
     AND m.id=(ir.payload->>'material_id')::uuid
    WHERE ir.tenant_id=$1
      AND ir.record_type=$2
      AND ir.is_active=true
      AND ir.attrs->>'request_id'=$3
      ${ownerFilter}
    ORDER BY ir.updated_at DESC
    LIMIT 1
    ${lockSql}
    `,
    params
  );
  return result.rows[0] || null;
}

async function updateMaterialPublicationProjection(client, {
  tenantId,
  materialId,
  status,
  requestId,
  actorIdentityId,
  note = ""
}) {
  const now = new Date().toISOString();
  const normalizedStatus = normalizeUpper(status);
  const patch = {
    publication_status: normalizedStatus,
    publication_request_id: requestId,
    publication_updated_at: now,
    publication_updated_by_identity_id: actorIdentityId || null
  };
  if (normalizedStatus === "PUBLISHED") patch.published_at = now;
  if (normalizedStatus === "REVIEW") patch.submitted_at = now;
  if (normalizedStatus === "REJECTED") {
    patch.returned_at = now;
    patch.moderator_note = normalizeText(note).slice(0, 4000);
  } else {
    patch.moderator_note = null;
  }

  await client.query(
    `
    UPDATE eip_core.material
    SET attrs = jsonb_set(
          COALESCE(attrs,'{}'::jsonb),
          '{workflow}',
          COALESCE(attrs->'workflow','{}'::jsonb) || $3::jsonb,
          true
        ),
        updated_at=now()
    WHERE tenant_id=$1 AND id=$2
    `,
    [tenantId, materialId, JSON.stringify(patch)]
  );
}

async function advancePublicationToReview(client, app, {
  tenantId,
  identityId,
  serviceObjectId,
  requestId
}) {
  let instance = await app.coreProcess.findActiveInstance(client, tenantId, serviceObjectId);
  if (!instance) return { ok: false, error: "PUBLICATION_PROCESS_INSTANCE_REQUIRED" };
  let node = normalizeText(instance.cursor_json?.node);
  const advance = async (action, suffix) => {
    const result = await app.coreProcess.advanceInstance(client, {
      tenantId,
      identityId,
      instanceId: instance.id,
      action,
      payload: { request_id: requestId },
      idempotencyKey: `pf-publication:${requestId}:${suffix}`
    });
    if (!result.ok) return result;
    node = normalizeText(result.entry?.to || node);
    return result;
  };

  if (node === "content_review") return { ok: true, instance_id: instance.id, node };
  if (node === "content_intake" || node === "content_rejected" || node === "content_published") {
    const intake = await advance("INTAKE", `intake:${Date.now()}`);
    if (!intake.ok) return intake;
  }
  if (node === "content_draft") {
    const ready = await advance("DRAFT_READY", `review:${Date.now()}`);
    if (!ready.ok) return ready;
  }
  if (node !== "content_review") {
    return { ok: false, error: "PUBLICATION_PROCESS_NOT_REVIEWABLE", node };
  }
  return { ok: true, instance_id: instance.id, node };
}

async function createPublicationProcess(client, app, {
  tenantId,
  identityId,
  requestId,
  material,
  styleName,
  variantName
}) {
  const binding = await resolvePublicationProcessBinding(client, tenantId);
  if (!binding) return { ok: false, error: "PUBLICATION_PROCESS_BINDING_REQUIRED" };

  const created = await app.coreProcess.createInstance(client, {
    tenantId,
    identityId,
    processDefId: binding.process_def_id,
    idempotencyKey: `pf-publication:create:${requestId}`,
    serviceObject: {
      object_type: PUBLICATION_OBJECT_TYPE,
      status: "new",
      code: `PF-PUB-${requestId}`.slice(0, 120),
      title: [styleName, variantName].filter(Boolean).join(" — ").slice(0, 500),
      attrs: {
        module: "ecom",
        source: "PERFECT_FIT",
        publication_kind: "CUSTOMER_CATALOGUE",
        request_id: requestId,
        material_id: material.id,
        private_workspace_access: false
      }
    }
  });
  if (!created.ok) return created;
  return {
    ok: true,
    service_object_id: created.service_object?.id,
    process_instance_id: created.item?.id
  };
}

function serializePublicationRow(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  const node = normalizeText(row.cursor_json?.node);
  return {
    id: payload.request_id || row.record_attrs?.request_id || row.info_record_id,
    requestId: payload.request_id || row.record_attrs?.request_id || row.info_record_id,
    status: publicationStatusFromServiceObject(row.service_object_status, node),
    materialId: row.material_id,
    materialCode: row.material_code,
    styleId: payload.identity?.style_id || null,
    styleCode: payload.identity?.style_code || "",
    styleName: payload.identity?.style_name || row.material_name || "Product",
    variantId: payload.identity?.variant_id || null,
    variantCode: payload.identity?.variant_code || "",
    variantName: payload.identity?.variant_name || "Variant",
    projectId: payload.identity?.project_id || null,
    projectName: payload.identity?.project_name || "",
    submittedAt: payload.submitted_at || row.created_at || null,
    submittedBy: payload.submitted_by || null,
    moderatorNote: payload.moderation?.note || "",
    publishedAt: payload.moderation?.published_at || null,
    publishedBy: payload.moderation?.published_by || null,
    pattern: payload.customer_projection || null,
    revision: Number(payload.submission_revision || 1),
    authority: "EIP_PROCESS_ENGINE"
  };
}

async function upsertPublicationRecord(client, {
  tenantId,
  identityId,
  requestId,
  materialId,
  serviceObjectId,
  processInstanceId,
  identity,
  submittedBy,
  customerProjection,
  existing
}) {
  const now = new Date().toISOString();
  const previousPayload = existing?.payload && typeof existing.payload === "object" ? existing.payload : {};
  const payload = {
    ...previousPayload,
    schema_version: 1,
    request_id: requestId,
    material_id: materialId,
    service_object_id: serviceObjectId,
    process_instance_id: processInstanceId,
    identity,
    submitted_by: submittedBy,
    submitted_at: now,
    submission_revision: Number(previousPayload.submission_revision || 0) + 1,
    customer_projection: customerProjection,
    updated_at: now
  };
  const attrs = {
    application: "perfect_fit",
    purpose: "publication_moderation",
    privacy: "moderation_projection",
    contains_private_technical_data: false,
    owner_identity_id: String(identityId),
    request_id: requestId
  };

  if (existing?.info_record_id) {
    const updated = await client.query(
      `
      UPDATE eip_core.info_record
      SET title=$3,
          payload=$4::jsonb,
          attrs=COALESCE(attrs,'{}'::jsonb) || $5::jsonb,
          updated_at=now()
      WHERE tenant_id=$1 AND id=$2
      RETURNING id
      `,
      [tenantId, existing.info_record_id, `${identity.style_name || "Product"} publication`, JSON.stringify(payload), JSON.stringify(attrs)]
    );
    return updated.rows[0]?.id || existing.info_record_id;
  }

  const inserted = await client.query(
    `
    INSERT INTO eip_core.info_record
      (tenant_id, record_type, title, payload, attrs)
    VALUES
      ($1,$2,$3,$4::jsonb,$5::jsonb)
    RETURNING id
    `,
    [tenantId, PUBLICATION_RECORD_TYPE, `${identity.style_name || "Product"} publication`, JSON.stringify(payload), JSON.stringify(attrs)]
  );
  return inserted.rows[0]?.id || null;
}

async function ensurePublicationLinks(client, tenantId, {
  materialId,
  serviceObjectId,
  infoRecordId,
  requestId
}) {
  const links = [
    ["material", materialId, "info_record", infoRecordId, "PERFECT_FIT_PUBLICATION_REQUEST"],
    ["service_object", serviceObjectId, "info_record", infoRecordId, "PUBLICATION_SNAPSHOT"],
    ["service_object", serviceObjectId, "material", materialId, "PUBLICATION_PRODUCT"]
  ];
  for (const [srcKind, srcId, dstKind, dstId, relationType] of links) {
    // eslint-disable-next-line no-await-in-loop
    await client.query(
      `
      INSERT INTO eip_core.object_link
        (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs)
      SELECT $1,$2,$3,$4,$5,$6,$7::jsonb
      WHERE NOT EXISTS (
        SELECT 1
        FROM eip_core.object_link
        WHERE tenant_id=$1
          AND src_kind=$2
          AND src_id=$3
          AND dst_kind=$4
          AND dst_id=$5
          AND relation_type=$6
          AND is_active=true
      )
      `,
      [tenantId, srcKind, srcId, dstKind, dstId, relationType, JSON.stringify({ request_id: requestId })]
    );
  }
}

async function updateModerationRecord(client, row, {
  action,
  actorIdentityId,
  actorDisplay,
  note = ""
}) {
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  const now = new Date().toISOString();
  const moderation = {
    ...(payload.moderation || {}),
    last_action: action,
    updated_at: now,
    updated_by: actorDisplay
  };
  if (action === "PUBLISH") {
    moderation.published_at = now;
    moderation.published_by = actorDisplay;
    moderation.note = "";
  }
  if (action === "RETURN") {
    moderation.returned_at = now;
    moderation.returned_by = actorDisplay;
    moderation.note = normalizeText(note).slice(0, 4000);
  }
  await client.query(
    `
    UPDATE eip_core.info_record
    SET payload=jsonb_set(
          COALESCE(payload,'{}'::jsonb),
          '{moderation}',
          $3::jsonb,
          true
        ),
        updated_at=now()
    WHERE tenant_id=$1 AND id=$2
    `,
    [row.record_attrs?.tenant_id || row.tenant_id || null, row.info_record_id, JSON.stringify(moderation)]
  );
}

export default async function registerPublicPerfectFitPublicationRoutes(app) {
  app.post(
    "/commerce/:suffix/perfect-fit/publication-requests",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      if (!requirePerfectFitScope(access, reply, "perfect_fit.products.write")) return;
      const session = await requireMemberSession(app, req, reply, access);
      if (!session) return;
      if (!requireMemberCsrf(req, reply)) return;

      const requestId = normalizeText(req.body?.request_id || req.body?.requestId).slice(0, 160);
      const variantId = normalizeText(req.body?.variant_id || req.body?.variantId).slice(0, 240);
      const variantCode = normalizeText(req.body?.variant_code || req.body?.variantCode).slice(0, 160);
      if (!requestId || (!variantId && !variantCode)) {
        return reply.code(400).send({ ok: false, error: "PUBLICATION_REQUEST_IDENTITY_REQUIRED" });
      }

      const customerProjection = sanitizeCustomerProjection(req.body?.pattern || req.body?.customer_projection || {});
      const projectionBytes = Buffer.byteLength(JSON.stringify(customerProjection || {}), "utf8");
      if (!customerProjection || projectionBytes > MAX_PUBLICATION_SNAPSHOT_BYTES) {
        return reply.code(413).send({ ok: false, error: "PUBLICATION_SNAPSHOT_TOO_LARGE" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const workspace = await loadPrivateOwnerWorkspace(client, access.tenant.id, session.identity_id);
        const context = findOwnedVariantContext(workspace, { variantId, variantCode });
        if (!context) {
          await client.query("ROLLBACK");
          return reply.code(403).send({ ok: false, error: "PUBLICATION_VARIANT_NOT_OWNED" });
        }

        const material = await resolveLinkedMaterial(client, access.tenant.id, context);
        if (!material) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: "PUBLICATION_EIP_PRODUCT_LINK_REQUIRED" });
        }

        const existing = await loadPublicationRecord(client, access.tenant.id, requestId, {
          ownerIdentityId: session.identity_id,
          forUpdate: true
        });

        let serviceObjectId = existing?.service_object_id || null;
        let processInstanceId = existing?.process_instance_id || null;
        const styleName = normalizeText(context.style?.values?.["product.style_name"] || req.body?.style_name || req.body?.styleName || material.name).slice(0, 500);
        const variantName = normalizeText(context.variant?.values?.["variant.name"] || req.body?.variant_name || req.body?.variantName || "Variant").slice(0, 300);

        if (!serviceObjectId) {
          const created = await createPublicationProcess(client, app, {
            tenantId: access.tenant.id,
            identityId: session.identity_id,
            requestId,
            material,
            styleName,
            variantName
          });
          if (!created.ok) {
            await client.query("ROLLBACK");
            return reply.code(409).send(created);
          }
          serviceObjectId = created.service_object_id;
          processInstanceId = created.process_instance_id;
        }

        const review = await advancePublicationToReview(client, app, {
          tenantId: access.tenant.id,
          identityId: session.identity_id,
          serviceObjectId,
          requestId
        });
        if (!review.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send(review);
        }
        processInstanceId = review.instance_id || processInstanceId;

        const submittedBy = await loadIdentityDisplay(client, access.tenant.id, session.identity_id);
        const identity = {
          project_id: context.project?.id || null,
          project_name: normalizeText(context.project?.values?.["project.name"] || context.project?.title),
          style_id: context.style?.id || null,
          style_code: normalizeText(context.style?.values?.["product.style_code"]),
          style_name: styleName,
          variant_id: context.variant?.id || null,
          variant_code: normalizeText(context.variant?.values?.["variant.code"]),
          variant_name: variantName
        };

        const infoRecordId = await upsertPublicationRecord(client, {
          tenantId: access.tenant.id,
          identityId: session.identity_id,
          requestId,
          materialId: material.id,
          serviceObjectId,
          processInstanceId,
          identity,
          submittedBy,
          customerProjection,
          existing
        });
        await ensurePublicationLinks(client, access.tenant.id, {
          materialId: material.id,
          serviceObjectId,
          infoRecordId,
          requestId
        });
        await updateMaterialPublicationProjection(client, {
          tenantId: access.tenant.id,
          materialId: material.id,
          status: "REVIEW",
          requestId,
          actorIdentityId: session.identity_id
        });
        await client.query("COMMIT");

        return reply.send({
          ok: true,
          request_id: requestId,
          status: "AWAITING_MODERATOR_RELEASE",
          material_id: material.id,
          service_object_id: serviceObjectId,
          process_instance_id: processInstanceId,
          privacy: "MODERATION_PROJECTION_ONLY"
        });
      } catch (error) {
        await client.query("ROLLBACK");
        req.log?.error?.({ event: "perfect_fit_publication_submit_failed", error: error.message });
        return reply.code(500).send({ ok: false, error: "PUBLICATION_SUBMIT_FAILED" });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/commerce/:suffix/perfect-fit/publication-requests/mine",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      if (!requirePerfectFitScope(access, reply, "perfect_fit.products.read")) return;
      const session = await requireMemberSession(app, req, reply, access);
      if (!session) return;

      const result = await app.db.query(
        `
        SELECT ir.id AS info_record_id, ir.payload, ir.attrs AS record_attrs,
               ir.created_at, ir.updated_at,
               so.id AS service_object_id, so.status AS service_object_status,
               pi.id AS process_instance_id, pi.cursor_json, pi.status AS process_status, pi.ended_at,
               m.id AS material_id, m.code AS material_code, m.name AS material_name
        FROM eip_core.info_record ir
        JOIN eip_core.service_object so
          ON so.tenant_id=ir.tenant_id
         AND so.id=(ir.payload->>'service_object_id')::uuid
        LEFT JOIN eip_core.process_instance pi
          ON pi.tenant_id=so.tenant_id
         AND pi.service_object_id=so.id
         AND pi.ended_at IS NULL
         AND pi.status='active'
        JOIN eip_core.material m
          ON m.tenant_id=ir.tenant_id
         AND m.id=(ir.payload->>'material_id')::uuid
        WHERE ir.tenant_id=$1
          AND ir.record_type=$2
          AND ir.is_active=true
          AND ir.attrs->>'owner_identity_id'=$3
        ORDER BY ir.updated_at DESC
        LIMIT 200
        `,
        [access.tenant.id, PUBLICATION_RECORD_TYPE, String(session.identity_id)]
      );
      return reply.send({
        ok: true,
        requests: result.rows.map((row) => {
          const serialized = serializePublicationRow(row);
          return {
            requestId: serialized.requestId,
            status: serialized.status,
            moderatorNote: serialized.moderatorNote,
            publishedAt: serialized.publishedAt,
            revision: serialized.revision
          };
        })
      });
    }
  );

  app.get(
    "/commerce/:suffix/perfect-fit/admin/publication-requests",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      if (!requirePerfectFitScope(access, reply, "perfect_fit.products.read")) return;
      const session = await requireAdminSession(app, req, reply, access);
      if (!session) return;

      const result = await app.db.query(
        `
        SELECT ir.id AS info_record_id, ir.payload, ir.attrs AS record_attrs,
               ir.created_at, ir.updated_at,
               so.id AS service_object_id, so.status AS service_object_status,
               pi.id AS process_instance_id, pi.cursor_json, pi.status AS process_status, pi.ended_at,
               m.id AS material_id, m.code AS material_code, m.name AS material_name
        FROM eip_core.info_record ir
        JOIN eip_core.service_object so
          ON so.tenant_id=ir.tenant_id
         AND so.id=(ir.payload->>'service_object_id')::uuid
        LEFT JOIN eip_core.process_instance pi
          ON pi.tenant_id=so.tenant_id
         AND pi.service_object_id=so.id
         AND pi.ended_at IS NULL
         AND pi.status='active'
        JOIN eip_core.material m
          ON m.tenant_id=ir.tenant_id
         AND m.id=(ir.payload->>'material_id')::uuid
        WHERE ir.tenant_id=$1
          AND ir.record_type=$2
          AND ir.is_active=true
        ORDER BY ir.updated_at DESC
        LIMIT 200
        `,
        [access.tenant.id, PUBLICATION_RECORD_TYPE]
      );

      return reply.send({
        ok: true,
        requests: result.rows.map(serializePublicationRow),
        identity_id: session.identity_id,
        privacy: "MODERATION_PROJECTION_ONLY"
      });
    }
  );

  app.post(
    "/commerce/:suffix/perfect-fit/admin/publication-requests/:requestId/actions",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      if (!requirePerfectFitScope(access, reply, "perfect_fit.products.write")) return;
      const session = await requireAdminSession(app, req, reply, access);
      if (!session) return;
      if (!requireMemberCsrf(req, reply)) return;

      const requestId = normalizeText(req.params?.requestId).slice(0, 160);
      const action = normalizeUpper(req.body?.action);
      const note = normalizeText(req.body?.note).slice(0, 4000);
      if (!requestId || !["PUBLISH", "RETURN"].includes(action)) {
        return reply.code(400).send({ ok: false, error: "PUBLICATION_ACTION_INVALID" });
      }
      if (action === "RETURN" && !note) {
        return reply.code(400).send({ ok: false, error: "PUBLICATION_RETURN_NOTE_REQUIRED" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const row = await loadPublicationRecord(client, access.tenant.id, requestId, { forUpdate: true });
        if (!row) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "PUBLICATION_REQUEST_NOT_FOUND" });
        }
        if (!row.process_instance_id) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: "PUBLICATION_PROCESS_INSTANCE_REQUIRED" });
        }

        let node = normalizeText(row.cursor_json?.node);
        const advance = async (transitionAction, suffix) => {
          const result = await app.coreProcess.advanceInstance(client, {
            tenantId: access.tenant.id,
            identityId: session.identity_id,
            instanceId: row.process_instance_id,
            action: transitionAction,
            payload: {
              request_id: requestId,
              material_id: row.material_id,
              moderator_note: note || null
            },
            idempotencyKey: `pf-publication:${requestId}:${suffix}`
          });
          if (result.ok) node = normalizeText(result.entry?.to || node);
          return result;
        };

        if (action === "PUBLISH") {
          if (node === "content_published") {
            await client.query("COMMIT");
            return reply.send({ ok: true, request_id: requestId, status: "PUBLISHED", reused: true });
          }
          if (node !== "content_review" && node !== "content_approved") {
            await client.query("ROLLBACK");
            return reply.code(409).send({ ok: false, error: "PUBLICATION_NOT_AWAITING_MODERATION", node });
          }
          if (node === "content_review") {
            const approved = await advance("APPROVE", `approve:${row.payload?.submission_revision || 1}`);
            if (!approved.ok) {
              await client.query("ROLLBACK");
              return reply.code(409).send(approved);
            }
          }
          const published = await advance("PUBLISH", `publish:${row.payload?.submission_revision || 1}`);
          if (!published.ok) {
            await client.query("ROLLBACK");
            return reply.code(409).send(published);
          }
          await updateMaterialPublicationProjection(client, {
            tenantId: access.tenant.id,
            materialId: row.material_id,
            status: "PUBLISHED",
            requestId,
            actorIdentityId: session.identity_id
          });
        } else {
          if (node === "content_rejected") {
            await client.query("COMMIT");
            return reply.send({ ok: true, request_id: requestId, status: "RETURNED_BY_MODERATOR", reused: true });
          }
          if (node !== "content_review") {
            await client.query("ROLLBACK");
            return reply.code(409).send({ ok: false, error: "PUBLICATION_NOT_AWAITING_MODERATION", node });
          }
          const returned = await advance("REJECT", `return:${row.payload?.submission_revision || 1}`);
          if (!returned.ok) {
            await client.query("ROLLBACK");
            return reply.code(409).send(returned);
          }
          await updateMaterialPublicationProjection(client, {
            tenantId: access.tenant.id,
            materialId: row.material_id,
            status: "REJECTED",
            requestId,
            actorIdentityId: session.identity_id,
            note
          });
        }

        const actorDisplay = await loadIdentityDisplay(client, access.tenant.id, session.identity_id);
        const moderation = {
          ...(row.payload?.moderation || {}),
          last_action: action,
          note: action === "RETURN" ? note : "",
          updated_at: new Date().toISOString(),
          updated_by: actorDisplay,
          ...(action === "PUBLISH"
            ? { published_at: new Date().toISOString(), published_by: actorDisplay }
            : { returned_at: new Date().toISOString(), returned_by: actorDisplay })
        };
        await client.query(
          `
          UPDATE eip_core.info_record
          SET payload=jsonb_set(COALESCE(payload,'{}'::jsonb), '{moderation}', $3::jsonb, true),
              updated_at=now()
          WHERE tenant_id=$1 AND id=$2
          `,
          [access.tenant.id, row.info_record_id, JSON.stringify(moderation)]
        );
        await client.query("COMMIT");

        return reply.send({
          ok: true,
          request_id: requestId,
          status: action === "PUBLISH" ? "PUBLISHED" : "RETURNED_BY_MODERATOR",
          authority: "EIP_PROCESS_ENGINE",
          private_workspace_access: false
        });
      } catch (error) {
        await client.query("ROLLBACK");
        req.log?.error?.({ event: "perfect_fit_publication_action_failed", requestId, action, error: error.message });
        return reply.code(500).send({ ok: false, error: "PUBLICATION_ACTION_FAILED" });
      } finally {
        client.release();
      }
    }
  );
}
