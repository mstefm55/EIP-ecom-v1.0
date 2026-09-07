import crypto from "node:crypto";
import { sha256Hex, timingSafeEqual } from "../auth/crypto.js";
import { buildSignedAssetUrl } from "../services/assets/signing.js";
import { isTenantAssetPath, toLocalAssetPath } from "../services/assets/url_policy.js";
import {
  extractProfiles
} from "../services/gateway/connectionProfile.js";
import { hydrateConnectionProfileSecrets } from "../services/gateway/secretStore.js";
import {
  connectionAllowsOrigin,
  extractEventId,
  verifyConnectionRequest
} from "../services/gateway/verification.js";
import {
  buildRequestHash,
  ensureIdempotency,
  finalizeIdempotency
} from "../services/gateway/idempotency.js";

const RATE_LIMIT = { max: 90, timeWindow: "1 minute" };
const COMMUNITY_POST_MARKER = "pf-community-feedback";
const COMMUNITY_NOTICE_RECORD = "PF_COMMUNITY_MODERATION_NOTICE";
const COMMUNITY_ALERT_RECORD = "PF_COMMUNITY_MODERATION_ALERT";
const COMMUNITY_DELETE_RECORD = "PF_COMMUNITY_MODERATION_DELETE";
const BLOG_POST_OBJECT_TYPE = "blog_post";
const PUBLIC_STATUSES = ["published", "approved", "visible"];
const ADMIN_REASON_CODES = new Set([
  "abusive_language",
  "harassment_or_insult",
  "threatening_language",
  "spam_or_off_topic",
  "privacy_or_personal_data",
  "copyright_or_unauthorized_content",
  "other"
]);

const AUTOMATED_RULES = [
  {
    code: "abusive_language",
    label: "Profanity or abusive language",
    expressions: [
      /\b(fuck|shit|asshole|bastard)\b/i
    ]
  },
  {
    code: "harassment_or_insult",
    label: "Insulting or degrading language directed at another person",
    expressions: [
      /\b(idiot|moron|stupid|dumb|loser)\b/i,
      /\byou\s+(?:are|'re)\s+(?:trash|pathetic|worthless)\b/i
    ]
  },
  {
    code: "threatening_language",
    label: "Threatening or harmful language",
    expressions: [
      /\b(?:i(?:'ll|\s+will)\s+)?kill\s+you\b/i,
      /\bgo\s+(?:and\s+)?die\b/i,
      /\bkill\s+yourself\b/i
    ]
  }
];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeReasonCode(value) {
  const code = normalizeText(value).toLowerCase();
  return ADMIN_REASON_CODES.has(code) ? code : "other";
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeText).filter(Boolean))].slice(0, 40);
}

function normalizeImageUrls(value) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.map(normalizeText).filter(Boolean))].slice(0, 10);
}

function hasCommunityMarker(attrs = {}) {
  return Array.isArray(attrs?.tags) && attrs.tags.includes(COMMUNITY_POST_MARKER);
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
  reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
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
  if (!profile?.identity?.is_enabled) {
    reply.code(403).send({ ok: false, error: "CONNECTION_DISABLED" });
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

async function loadMemberSession(app, req, tenantId, suffix) {
  const sid = normalizeText(req.cookies?.member_sid);
  if (!sid) return null;
  const result = await app.db.query(
    `
    SELECT id, tenant_id, identity_id, expires_at, is_revoked, attrs, csrf_secret_hash
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
  if (String(attrs.realm || "").toUpperCase() !== "MEMBER") return null;
  if (normalizeText(attrs.connection_suffix) !== normalizeText(suffix)) return null;
  return session;
}

function requireMemberCsrf(app, session, req, reply) {
  const csrfCookie = normalizeText(req.cookies?.member_csrf);
  const csrfHeader = normalizeText(req.headers["x-member-csrf"]);
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    reply.code(403).send({ ok: false, error: "MEMBER_CSRF_REQUIRED" });
    return false;
  }
  const expectedHash = sha256Hex(`${csrfCookie}:${app.config.CSRF_PEPPER}`);
  if (!session.csrf_secret_hash || !timingSafeEqual(expectedHash, session.csrf_secret_hash)) {
    reply.code(403).send({ ok: false, error: "MEMBER_CSRF_INVALID" });
    return false;
  }
  return true;
}

async function requireAdminSession(app, req, reply, access) {
  const session = await loadMemberSession(app, req, access.tenant.id, access.suffix);
  if (!session) {
    reply.code(401).send({ ok: false, error: "MEMBER_UNAUTHENTICATED" });
    return null;
  }
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
    return null;
  }
  return session;
}

async function resolveProcessBinding(client, tenantId) {
  const result = await client.query(
    `
    SELECT process_def_id
    FROM eip_core.process_binding
    WHERE tenant_id = $1
      AND service_object_type = $2
      AND is_active = true
    ORDER BY priority ASC, created_at DESC
    LIMIT 1
    `,
    [tenantId, BLOG_POST_OBJECT_TYPE]
  );
  return result.rows[0] || null;
}

async function createBlogProcess(client, app, { tenantId, identityId, serviceObject }) {
  const binding = await resolveProcessBinding(client, tenantId);
  if (!binding) return { ok: false, error: "PROCESS_BINDING_REQUIRED" };
  const result = await app.coreProcess.createInstance(client, {
    tenantId,
    identityId: identityId || null,
    processDefId: binding.process_def_id,
    serviceObject,
    idempotencyKey: `community:create:${serviceObject.code}`
  });
  if (!result.ok) return result;
  return {
    ok: true,
    instance: result.item,
    serviceObject: result.service_object
  };
}

async function loadProcessInstance(client, tenantId, serviceObjectId) {
  const result = await client.query(
    `
    SELECT id, status, cursor_json
    FROM eip_core.process_instance
    WHERE tenant_id = $1
      AND service_object_id = $2
      AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
    `,
    [tenantId, serviceObjectId]
  );
  return result.rows[0] || null;
}

async function advance(client, app, { tenantId, identityId, instanceId, action, postId, code }) {
  return app.coreProcess.advanceInstance(client, {
    tenantId,
    identityId: identityId || null,
    instanceId,
    action,
    payload: {
      service_object_id: postId,
      post_code: code,
      channel: "perfect_fit_community"
    },
    idempotencyKey: sha256Hex(`community:${action}:${postId}:${Date.now()}`)
  });
}

function runAutomatedCommunityReview(title, body) {
  const text = `${normalizeText(title)}\n${normalizeText(body)}`;
  const matches = [];
  for (const rule of AUTOMATED_RULES) {
    if (rule.expressions.some((expression) => expression.test(text))) {
      matches.push({ code: rule.code, label: rule.label });
    }
  }
  const criteria = [...new Map(matches.map((item) => [item.code, item])).values()];
  if (!criteria.length) {
    return {
      decision: "publish",
      engine: "automated-rules-v1",
      criteria: [],
      message: null
    };
  }
  const labels = criteria.map((item) => item.label).join("; ");
  return {
    decision: "hold",
    engine: "automated-rules-v1",
    criteria,
    message: `Your feedback has not been published yet because our automated safety review detected content that may violate the community standard: ${labels}. It has been sent to an administrator for review. You can revise the wording and submit again if you believe this was a false positive.`
  };
}

function signAssetUrl(url, app, tenantId) {
  const raw = normalizeText(url);
  if (!raw) return "";
  const localPath = toLocalAssetPath(raw);
  if (!localPath) return raw;
  if (!isTenantAssetPath(localPath, tenantId)) return "";
  const ttlSec = Number(app.config.ASSET_TOKEN_TTL_SEC || 604800);
  const exp = Math.floor(Date.now() / 1000) + (Number.isFinite(ttlSec) ? ttlSec : 604800);
  return buildSignedAssetUrl(localPath, exp, app.config.API_KEY_PEPPER);
}

function publicPost(row, app, tenantId, { includeModeration = false } = {}) {
  const attrs = row?.attrs && typeof row.attrs === "object" ? row.attrs : {};
  const author = attrs.author && typeof attrs.author === "object" ? attrs.author : {};
  const imageUrls = normalizeImageUrls(attrs.image_urls || attrs.images || []);
  const primary = normalizeText(attrs.image_url || attrs.image);
  if (primary && !imageUrls.includes(primary)) imageUrls.unshift(primary);
  const signedImages = imageUrls.map((url) => signAssetUrl(url, app, tenantId)).filter(Boolean);
  const moderation = attrs.moderation && typeof attrs.moderation === "object" ? attrs.moderation : {};
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    title: normalizeText(attrs.title || row.title),
    body: normalizeText(attrs.body),
    image_url: signedImages[0] || "",
    image_urls: signedImages,
    tags: normalizeTags(attrs.tags || []),
    author: {
      name: normalizeText(author.name) || "Perfect Fit Member",
      role: normalizeText(author.role) || "Community member",
      identity_id: normalizeText(author.identity_id) || null
    },
    reactions: attrs.reactions && typeof attrs.reactions === "object"
      ? attrs.reactions
      : { likes: 0, dislikes: 0, comments: 0 },
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...(includeModeration ? { moderation } : {})
  };
}

async function createAdminAlert(client, { tenantId, postId, postCode, review, authorIdentityId }) {
  await client.query(
    `
    INSERT INTO eip_core.info_record
      (tenant_id, record_type, title, payload, attrs)
    VALUES
      ($1, $2, $3, $4::jsonb, $5::jsonb)
    `,
    [
      tenantId,
      COMMUNITY_ALERT_RECORD,
      `Community post held: ${postCode}`,
      JSON.stringify({
        post_id: postId,
        post_code: postCode,
        author_identity_id: authorIdentityId || null,
        criteria: review.criteria,
        engine: review.engine,
        message: review.message,
        created_at: new Date().toISOString()
      }),
      JSON.stringify({ status: "open", surface: "PF_ADMIN", module: "community" })
    ]
  );
}

async function createAuthorNotice(client, {
  tenantId,
  identityId,
  postId,
  postCode,
  title,
  action,
  reasonCode,
  reasonDetail,
  actorIdentityId
}) {
  if (!identityId) return;
  const actionText = action === "delete"
    ? "permanently removed"
    : action === "unpublish"
      ? "unpublished"
      : "restored";
  const criterion = reasonDetail || reasonCode.replace(/_/g, " ");
  const message = action === "restore"
    ? `Your community feedback “${title || postCode}” has been restored and is public again.`
    : `Your community feedback “${title || postCode}” was ${actionText} by Perfect Fit moderation. Reason: ${criterion}.`;
  await client.query(
    `
    INSERT INTO eip_core.info_record
      (tenant_id, record_type, title, payload, attrs)
    VALUES
      ($1, $2, $3, $4::jsonb, $5::jsonb)
    `,
    [
      tenantId,
      COMMUNITY_NOTICE_RECORD,
      `Community moderation: ${postCode}`,
      JSON.stringify({
        identity_id: identityId,
        post_id: postId,
        post_code: postCode,
        post_title: title || null,
        action,
        reason_code: reasonCode,
        reason_detail: reasonDetail || null,
        message,
        actor_identity_id: actorIdentityId || null,
        created_at: new Date().toISOString()
      }),
      JSON.stringify({ surface: "PERFECT_FIT", module: "community" })
    ]
  );
}

async function beginIdempotency(app, req, access, body, action) {
  const eventId = extractEventId(req, body, access.profile);
  if (!eventId) return { ok: false, error: "IDEMPOTENCY_REQUIRED" };
  const requestHash = buildRequestHash(Buffer.from(JSON.stringify(body || {})));
  const scope = `${access.profile?.idempotency?.idempotency_scope || "perfect_fit.community"}.${action}`;
  return ensureIdempotency(app.db, {
    tenantId: access.tenant.id,
    scope,
    key: eventId,
    requestHash
  });
}

async function findCommunityPost(client, tenantId, postId, { forUpdate = false } = {}) {
  const result = await client.query(
    `
    SELECT id, code, title, status, attrs, created_at, updated_at
    FROM eip_core.service_object
    WHERE tenant_id = $1
      AND object_type = $2
      AND (id::text = $3 OR code = $3)
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(attrs->'tags') = 'array' THEN attrs->'tags' ELSE '[]'::jsonb END
        ) AS tag(value)
        WHERE tag.value = $4
      )
    LIMIT 1
    ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [tenantId, BLOG_POST_OBJECT_TYPE, postId, COMMUNITY_POST_MARKER]
  );
  return result.rows[0] || null;
}

export default async function registerPublicPerfectFitCommunityRoutes(app) {
  app.get(
    "/commerce/:suffix/community/posts",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      const limit = Math.max(1, Math.min(100, Number(req.query?.limit || 50)));
      const q = normalizeText(req.query?.q);
      const params = [access.tenant.id, BLOG_POST_OBJECT_TYPE, PUBLIC_STATUSES, COMMUNITY_POST_MARKER, limit];
      let searchSql = "";
      if (q) {
        params.push(`%${q}%`);
        searchSql = `AND (COALESCE(title, '') ILIKE $6 OR COALESCE(attrs->>'body', '') ILIKE $6)`;
      }
      const result = await app.db.query(
        `
        SELECT id, code, title, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = $2
          AND status = ANY($3::text[])
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(attrs->'tags') = 'array' THEN attrs->'tags' ELSE '[]'::jsonb END
            ) AS tag(value)
            WHERE tag.value = $4
          )
          ${searchSql}
        ORDER BY created_at DESC
        LIMIT $5
        `,
        params
      );
      return reply.send({
        ok: true,
        items: result.rows.map((row) => publicPost(row, app, access.tenant.id)),
        total: result.rowCount
      });
    }
  );

  app.post(
    "/commerce/:suffix/community/posts",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const title = normalizeText(body.title).slice(0, 160);
      const postBody = normalizeText(body.body || body.content).slice(0, 6000);
      if (!title) return reply.code(400).send({ ok: false, error: "TITLE_REQUIRED" });
      if (!postBody) return reply.code(400).send({ ok: false, error: "BODY_REQUIRED" });

      const imageUrls = normalizeImageUrls(body.image_urls || body.images || []);
      const primaryImage = normalizeText(body.image_url || body.image);
      if (primaryImage && !imageUrls.includes(primaryImage)) imageUrls.unshift(primaryImage);
      for (const candidate of imageUrls) {
        const localPath = toLocalAssetPath(candidate);
        if (localPath && !isTenantAssetPath(localPath, access.tenant.id)) {
          return reply.code(400).send({ ok: false, error: "ASSET_TENANT_MISMATCH" });
        }
      }

      const session = await loadMemberSession(app, req, access.tenant.id, access.suffix);
      if (session && !requireMemberCsrf(app, session, req, reply)) return;
      const authorName = normalizeText(body.author_name || body.authorName || "Community member").slice(0, 120);
      const tags = normalizeTags([COMMUNITY_POST_MARKER, ...(Array.isArray(body.tags) ? body.tags : [])]);
      const review = runAutomatedCommunityReview(title, postBody);
      const idem = await beginIdempotency(app, req, access, body, "create");
      if (!idem.ok) return reply.code(idem.error === "IDEMPOTENCY_CONFLICT" ? 409 : 400).send({ ok: false, error: idem.error });
      if (idem.replay) return reply.code(idem.status === "error" ? 409 : 200).send(idem.response || { ok: true, replay: true });

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const code = `CFB-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
        const started = await createBlogProcess(client, app, {
          tenantId: access.tenant.id,
          identityId: session?.identity_id || null,
          serviceObject: {
            object_type: BLOG_POST_OBJECT_TYPE,
            status: "new",
            code,
            title,
            attrs: {
              title,
              body: postBody,
              image_url: imageUrls[0] || null,
              image_urls: imageUrls,
              tags,
              author: {
                identity_id: session?.identity_id || null,
                name: authorName || "Community member",
                role: session ? "Member" : "Guest"
              },
              reactions: { likes: 0, dislikes: 0, comments: 0 },
              moderation: {
                state: review.decision === "hold" ? "pending_review" : "clear",
                automated_decision: review.decision,
                engine: review.engine,
                criteria: review.criteria,
                message: review.message,
                reviewed_at: new Date().toISOString()
              },
              workflow: { stage: "draft", outcome: null },
              created_by_identity_id: session?.identity_id || null
            }
          }
        });
        if (!started.ok || !started.instance?.id || !started.serviceObject?.id) {
          throw new Error(started.error || "COMMUNITY_POST_CREATE_FAILED");
        }

        const intake = await advance(client, app, {
          tenantId: access.tenant.id,
          identityId: session?.identity_id || null,
          instanceId: started.instance.id,
          action: "INTAKE",
          postId: started.serviceObject.id,
          code
        });
        if (!intake.ok && intake.error !== "INVALID_TRANSITION") {
          throw new Error(intake.error || "COMMUNITY_POST_CREATE_FAILED");
        }

        if (review.decision === "publish") {
          const publish = await advance(client, app, {
            tenantId: access.tenant.id,
            identityId: session?.identity_id || null,
            instanceId: started.instance.id,
            action: "PUBLISH",
            postId: started.serviceObject.id,
            code
          });
          if (!publish.ok && publish.error !== "INVALID_TRANSITION") {
            throw new Error(publish.error || "COMMUNITY_POST_CREATE_FAILED");
          }
        } else {
          await createAdminAlert(client, {
            tenantId: access.tenant.id,
            postId: started.serviceObject.id,
            postCode: code,
            review,
            authorIdentityId: session?.identity_id || null
          });
        }

        const persisted = await client.query(
          `
          SELECT id, code, title, status, attrs, created_at, updated_at
          FROM eip_core.service_object
          WHERE tenant_id = $1 AND id = $2 AND object_type = $3
          LIMIT 1
          `,
          [access.tenant.id, started.serviceObject.id, BLOG_POST_OBJECT_TYPE]
        );
        if (!persisted.rowCount) throw new Error("COMMUNITY_POST_CREATE_FAILED");
        await client.query("COMMIT");

        const response = {
          ok: true,
          item: publicPost(persisted.rows[0], app, access.tenant.id, { includeModeration: true }),
          moderation: {
            held: review.decision === "hold",
            decision: review.decision,
            engine: review.engine,
            criteria: review.criteria,
            message: review.message
          }
        };
        await finalizeIdempotency(app.db, {
          tenantId: access.tenant.id,
          scope: idem.scope,
          key: idem.key,
          response,
          status: "ok"
        });
        return reply.code(review.decision === "hold" ? 202 : 200).send(response);
      } catch (error) {
        await client.query("ROLLBACK");
        const response = { ok: false, error: "COMMUNITY_POST_CREATE_FAILED" };
        await finalizeIdempotency(app.db, {
          tenantId: access.tenant.id,
          scope: idem.scope,
          key: idem.key,
          response,
          status: "error"
        });
        app.log.error({ event: "community_post_create_failed", error: error?.message || String(error) });
        return reply.code(500).send(response);
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/commerce/:suffix/community/notices",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      const session = await loadMemberSession(app, req, access.tenant.id, access.suffix);
      if (!session) return reply.code(401).send({ ok: false, error: "MEMBER_UNAUTHENTICATED" });
      const result = await app.db.query(
        `
        SELECT id, title, payload, created_at
        FROM eip_core.info_record
        WHERE tenant_id = $1
          AND record_type = $2
          AND is_active = true
          AND payload->>'identity_id' = $3
        ORDER BY created_at DESC
        LIMIT 30
        `,
        [access.tenant.id, COMMUNITY_NOTICE_RECORD, String(session.identity_id)]
      );
      return reply.send({ ok: true, notices: result.rows });
    }
  );

  app.get(
    "/commerce/:suffix/perfect-fit/admin/community/posts",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      const session = await requireAdminSession(app, req, reply, access);
      if (!session) return;
      const filter = normalizeText(req.query?.filter || "all").toLowerCase();
      const q = normalizeText(req.query?.q);
      const params = [access.tenant.id, BLOG_POST_OBJECT_TYPE, COMMUNITY_POST_MARKER];
      let filterSql = "";
      if (filter === "pending") {
        filterSql = "AND COALESCE(attrs->'moderation'->>'state', '') = 'pending_review'";
      } else if (filter === "published") {
        filterSql = "AND status = 'published'";
      } else if (filter === "unpublished") {
        filterSql = "AND status IN ('rejected', 'cancelled')";
      }
      let searchSql = "";
      if (q) {
        params.push(`%${q}%`);
        searchSql = `AND (COALESCE(title, '') ILIKE $4 OR COALESCE(attrs->>'body', '') ILIKE $4 OR COALESCE(attrs->'author'->>'name', '') ILIKE $4)`;
      }
      const result = await app.db.query(
        `
        SELECT id, code, title, status, attrs, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id = $1
          AND object_type = $2
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(attrs->'tags') = 'array' THEN attrs->'tags' ELSE '[]'::jsonb END
            ) AS tag(value)
            WHERE tag.value = $3
          )
          ${filterSql}
          ${searchSql}
        ORDER BY CASE WHEN COALESCE(attrs->'moderation'->>'state', '') = 'pending_review' THEN 0 ELSE 1 END, created_at DESC
        LIMIT 200
        `,
        params
      );
      const pendingCount = result.rows.filter((row) => row.attrs?.moderation?.state === "pending_review").length;
      return reply.send({
        ok: true,
        posts: result.rows.map((row) => publicPost(row, app, access.tenant.id, { includeModeration: true })),
        pending_count: pendingCount,
        identity_id: session.identity_id
      });
    }
  );

  app.put(
    "/commerce/:suffix/perfect-fit/admin/community/posts/:id",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      const session = await requireAdminSession(app, req, reply, access);
      if (!session) return;
      if (!requireMemberCsrf(app, session, req, reply)) return;
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const action = normalizeText(body.action).toLowerCase();
      if (!["publish", "restore", "unpublish"].includes(action)) {
        return reply.code(400).send({ ok: false, error: "COMMUNITY_MODERATION_ACTION_INVALID" });
      }
      const reasonCode = normalizeReasonCode(body.reason_code || body.reasonCode);
      const reasonDetail = normalizeText(body.reason_detail || body.reasonDetail).slice(0, 600);
      if (action === "unpublish" && !reasonDetail && !normalizeText(body.reason_code || body.reasonCode)) {
        return reply.code(400).send({ ok: false, error: "COMMUNITY_MODERATION_REASON_REQUIRED" });
      }
      const idem = await beginIdempotency(app, req, access, body, `moderate.${action}`);
      if (!idem.ok) return reply.code(idem.error === "IDEMPOTENCY_CONFLICT" ? 409 : 400).send({ ok: false, error: idem.error });
      if (idem.replay) return reply.send(idem.response || { ok: true, replay: true });

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const post = await findCommunityPost(client, access.tenant.id, normalizeText(req.params?.id), { forUpdate: true });
        if (!post) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "COMMUNITY_POST_NOT_FOUND" });
        }
        const instance = await loadProcessInstance(client, access.tenant.id, post.id);
        if (!instance) throw new Error("PROCESS_INSTANCE_REQUIRED");

        const normalizedAction = action === "restore" ? "publish" : action;
        if (normalizedAction === "unpublish") {
          const rejected = await advance(client, app, {
            tenantId: access.tenant.id,
            identityId: session.identity_id,
            instanceId: instance.id,
            action: "REJECT",
            postId: post.id,
            code: post.code
          });
          if (!rejected.ok && rejected.error !== "INVALID_TRANSITION") throw new Error(rejected.error);
        } else {
          if (post.status === "rejected") {
            const intake = await advance(client, app, {
              tenantId: access.tenant.id,
              identityId: session.identity_id,
              instanceId: instance.id,
              action: "INTAKE",
              postId: post.id,
              code: post.code
            });
            if (!intake.ok && intake.error !== "INVALID_TRANSITION") throw new Error(intake.error);
          }
          const published = await advance(client, app, {
            tenantId: access.tenant.id,
            identityId: session.identity_id,
            instanceId: instance.id,
            action: "PUBLISH",
            postId: post.id,
            code: post.code
          });
          if (!published.ok && published.error !== "INVALID_TRANSITION") throw new Error(published.error);
        }

        const moderationState = normalizedAction === "unpublish" ? "unpublished" : "clear";
        await client.query(
          `
          UPDATE eip_core.service_object
          SET attrs = COALESCE(attrs, '{}'::jsonb) || jsonb_build_object(
                'moderation',
                COALESCE(attrs->'moderation', '{}'::jsonb) || jsonb_build_object(
                  'state', $3::text,
                  'manual_action', $4::text,
                  'reason_code', $5::text,
                  'reason_detail', NULLIF($6::text, ''),
                  'moderated_by_identity_id', $7::text,
                  'moderated_at', now()::text
                )
              ),
              updated_at = now()
          WHERE tenant_id = $1 AND id = $2
          `,
          [access.tenant.id, post.id, moderationState, action, reasonCode, reasonDetail, String(session.identity_id)]
        );

        const authorIdentityId = normalizeText(post.attrs?.author?.identity_id || post.attrs?.created_by_identity_id);
        await createAuthorNotice(client, {
          tenantId: access.tenant.id,
          identityId: authorIdentityId || null,
          postId: post.id,
          postCode: post.code,
          title: post.title || post.attrs?.title,
          action: normalizedAction === "unpublish" ? "unpublish" : "restore",
          reasonCode,
          reasonDetail,
          actorIdentityId: session.identity_id
        });

        const updated = await findCommunityPost(client, access.tenant.id, post.id);
        await client.query("COMMIT");
        const response = {
          ok: true,
          post: publicPost(updated, app, access.tenant.id, { includeModeration: true })
        };
        await finalizeIdempotency(app.db, {
          tenantId: access.tenant.id,
          scope: idem.scope,
          key: idem.key,
          response,
          status: "ok"
        });
        return reply.send(response);
      } catch (error) {
        await client.query("ROLLBACK");
        const response = { ok: false, error: error?.message || "COMMUNITY_MODERATION_FAILED" };
        await finalizeIdempotency(app.db, {
          tenantId: access.tenant.id,
          scope: idem.scope,
          key: idem.key,
          response,
          status: "error"
        });
        return reply.code(409).send(response);
      } finally {
        client.release();
      }
    }
  );

  app.delete(
    "/commerce/:suffix/perfect-fit/admin/community/posts/:id",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      const session = await requireAdminSession(app, req, reply, access);
      if (!session) return;
      if (!requireMemberCsrf(app, session, req, reply)) return;
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const reasonCode = normalizeReasonCode(body.reason_code || body.reasonCode);
      const reasonDetail = normalizeText(body.reason_detail || body.reasonDetail).slice(0, 600);
      if (!reasonDetail && !normalizeText(body.reason_code || body.reasonCode)) {
        return reply.code(400).send({ ok: false, error: "COMMUNITY_MODERATION_REASON_REQUIRED" });
      }
      const idem = await beginIdempotency(app, req, access, body, "delete");
      if (!idem.ok) return reply.code(idem.error === "IDEMPOTENCY_CONFLICT" ? 409 : 400).send({ ok: false, error: idem.error });
      if (idem.replay) return reply.send(idem.response || { ok: true, replay: true });

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const post = await findCommunityPost(client, access.tenant.id, normalizeText(req.params?.id), { forUpdate: true });
        if (!post) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "COMMUNITY_POST_NOT_FOUND" });
        }
        const authorIdentityId = normalizeText(post.attrs?.author?.identity_id || post.attrs?.created_by_identity_id);
        await createAuthorNotice(client, {
          tenantId: access.tenant.id,
          identityId: authorIdentityId || null,
          postId: post.id,
          postCode: post.code,
          title: post.title || post.attrs?.title,
          action: "delete",
          reasonCode,
          reasonDetail,
          actorIdentityId: session.identity_id
        });
        await client.query(
          `
          INSERT INTO eip_core.info_record
            (tenant_id, record_type, title, payload, attrs)
          VALUES
            ($1, $2, $3, $4::jsonb, $5::jsonb)
          `,
          [
            access.tenant.id,
            COMMUNITY_DELETE_RECORD,
            `Community post deleted: ${post.code}`,
            JSON.stringify({
              post_id: post.id,
              post_code: post.code,
              post_title: post.title || post.attrs?.title || null,
              author_identity_id: authorIdentityId || null,
              content_hash: sha256Hex(normalizeText(post.attrs?.body)),
              reason_code: reasonCode,
              reason_detail: reasonDetail || null,
              deleted_by_identity_id: session.identity_id,
              deleted_at: new Date().toISOString()
            }),
            JSON.stringify({ surface: "PF_ADMIN", module: "community", irreversible: true })
          ]
        );
        await client.query(
          `DELETE FROM eip_core.service_object WHERE tenant_id = $1 AND id = $2 AND object_type = $3`,
          [access.tenant.id, post.id, BLOG_POST_OBJECT_TYPE]
        );
        await client.query("COMMIT");
        const response = { ok: true, deleted: true, post_id: post.id, post_code: post.code };
        await finalizeIdempotency(app.db, {
          tenantId: access.tenant.id,
          scope: idem.scope,
          key: idem.key,
          response,
          status: "ok"
        });
        return reply.send(response);
      } catch (error) {
        await client.query("ROLLBACK");
        const response = { ok: false, error: "COMMUNITY_DELETE_FAILED" };
        await finalizeIdempotency(app.db, {
          tenantId: access.tenant.id,
          scope: idem.scope,
          key: idem.key,
          response,
          status: "error"
        });
        app.log.error({ event: "community_delete_failed", error: error?.message || String(error) });
        return reply.code(500).send(response);
      } finally {
        client.release();
      }
    }
  );
}
