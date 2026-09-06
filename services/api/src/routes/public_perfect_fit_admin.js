import {
  connectionAllowsStorefrontCapability,
  connectionAllowsStorefrontScope,
  extractProfiles
} from "../services/gateway/connectionProfile.js";
import { hydrateConnectionProfileSecrets } from "../services/gateway/secretStore.js";
import { connectionAllowsOrigin, verifyConnectionRequest } from "../services/gateway/verification.js";
import { validateGovernedDropdownValue } from "../services/socket/fieldAliasResolver.js";
import { syncPerfectFitAdminCuration } from "../services/perfectFit/productGateway.js";

const RATE_LIMIT = { max: 60, timeWindow: "1 minute" };
const CURATION_LIST_CODE = "PF_PRODUCT_TAG";

function normalizeText(value) {
  return String(value || "").trim();
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
  reply.header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
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
  if (String(attrs.realm || "").toUpperCase() !== "MEMBER") return null;
  if (normalizeText(attrs.connection_suffix) !== normalizeText(suffix)) return null;
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

function requireMemberCsrf(req, reply) {
  const csrfCookie = normalizeText(req.cookies?.member_csrf);
  const csrfHeader = normalizeText(req.headers["x-member-csrf"]);
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    reply.code(403).send({ ok: false, error: "MEMBER_CSRF_REQUIRED" });
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
  if (!(await requirePfAdmin(app, access, session, reply))) return null;
  return session;
}

async function ensureCurationStyleVariant(app, tenantId, productId) {
  const result = await app.db.query(
    `
    SELECT m.id,
           COALESCE(m.attrs->'product_hierarchy'->>'level', '') AS hierarchy_level,
           pf.perfect_fit
    FROM eip_core.material m
    LEFT JOIN LATERAL (
      SELECT ir.payload->'perfect_fit' AS perfect_fit
      FROM eip_core.object_link ol
      JOIN eip_core.info_record ir
        ON ir.tenant_id = ol.tenant_id
       AND ir.id = ol.dst_id
       AND ir.record_type = 'PERFECT_FIT_PRODUCT_LINK'
       AND ir.is_active = true
      WHERE ol.tenant_id = m.tenant_id
        AND ol.src_kind = 'material'
        AND ol.src_id = m.id
        AND ol.dst_kind = 'info_record'
        AND ol.relation_type = 'PERFECT_FIT_PRODUCT'
        AND ol.is_active = true
      ORDER BY ol.updated_at DESC
      LIMIT 1
    ) pf ON true
    WHERE m.tenant_id = $1
      AND m.id = $2
      AND m.material_type = 'PRODUCT'
    LIMIT 1
    `,
    [tenantId, productId]
  );

  if (result.rowCount !== 1) {
    return { ok: false, status: 404, error: "STYLE_VARIANT_NOT_FOUND" };
  }

  const row = result.rows[0];
  const hierarchyLevel = normalizeText(row.hierarchy_level).toUpperCase();
  const perfectFit = row.perfect_fit && typeof row.perfect_fit === "object"
    ? row.perfect_fit
    : {};
  const linkedLevel = normalizeText(perfectFit.entity_level).toUpperCase();
  const hasVariantIdentity = Boolean(normalizeText(perfectFit.variant_id));
  const isStyleVariant =
    hierarchyLevel === "STYLE_VARIANT" ||
    hierarchyLevel === "VARIANT" ||
    linkedLevel === "STYLE_VARIANT" ||
    linkedLevel === "VARIANT" ||
    hasVariantIdentity;

  if (!isStyleVariant) {
    return { ok: false, status: 404, error: "STYLE_VARIANT_NOT_FOUND" };
  }

  if (hierarchyLevel !== "STYLE_VARIANT") {
    await app.db.query(
      `
      UPDATE eip_core.material
      SET attrs = jsonb_set(
            COALESCE(attrs, '{}'::jsonb),
            '{product_hierarchy,level}',
            to_jsonb('STYLE_VARIANT'::text),
            true
          ),
          updated_at = now()
      WHERE tenant_id = $1
        AND id = $2
        AND material_type = 'PRODUCT'
      `,
      [tenantId, productId]
    );
  }

  return { ok: true };
}

export default async function registerPublicPerfectFitAdminRoutes(app) {
  app.get(
    "/commerce/:suffix/perfect-fit/admin/curation/products",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      if (!requirePerfectFitScope(access, reply, "perfect_fit.products.read")) return;
      const session = await requireAdminSession(app, req, reply, access);
      if (!session) return;

      const q = normalizeText(req.query?.q).toLowerCase();
      const limit = Math.max(1, Math.min(200, Number(req.query?.limit || 100)));
      const params = [access.tenant.id, limit];
      let searchSql = "";
      if (q) {
        params.push(`%${q}%`);
        searchSql = `AND (
          lower(m.name) LIKE $3
          OR lower(m.code) LIKE $3
          OR lower(COALESCE(pf.perfect_fit->>'variant_code', '')) LIKE $3
          OR lower(COALESCE(pf.perfect_fit->>'style_code', '')) LIKE $3
          OR lower(COALESCE(pf.perfect_fit->>'variant_id', '')) LIKE $3
          OR lower(COALESCE(pf.perfect_fit->>'style_id', '')) LIKE $3
        )`;
      }

      const result = await app.db.query(
        `
        SELECT m.id, m.code, m.name, m.attrs, m.updated_at, pf.perfect_fit
        FROM eip_core.material m
        LEFT JOIN LATERAL (
          SELECT ir.payload->'perfect_fit' AS perfect_fit
          FROM eip_core.object_link ol
          JOIN eip_core.info_record ir
            ON ir.tenant_id = ol.tenant_id
           AND ir.id = ol.dst_id
           AND ir.record_type = 'PERFECT_FIT_PRODUCT_LINK'
           AND ir.is_active = true
          WHERE ol.tenant_id = m.tenant_id
            AND ol.src_kind = 'material'
            AND ol.src_id = m.id
            AND ol.dst_kind = 'info_record'
            AND ol.relation_type = 'PERFECT_FIT_PRODUCT'
            AND ol.is_active = true
          ORDER BY ol.updated_at DESC
          LIMIT 1
        ) pf ON true
        WHERE m.tenant_id = $1
          AND m.material_type = 'PRODUCT'
          AND (
            COALESCE(m.attrs->'product_hierarchy'->>'level', '') IN ('STYLE_VARIANT', 'VARIANT')
            OR COALESCE(pf.perfect_fit->>'entity_level', '') IN ('STYLE_VARIANT', 'VARIANT')
            OR COALESCE(pf.perfect_fit->>'variant_id', '') <> ''
          )
          ${searchSql}
        ORDER BY lower(m.name), lower(m.code)
        LIMIT $2
        `,
        params
      );

      return reply.send({
        ok: true,
        products: result.rows.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          tags: Array.isArray(row.attrs?.taxonomy?.tags) ? row.attrs.taxonomy.tags : [],
          perfect_fit: row.perfect_fit && typeof row.perfect_fit === 'object'
            ? {
                variant_id: row.perfect_fit.variant_id || null,
                variant_code: row.perfect_fit.variant_code || null,
                style_id: row.perfect_fit.style_id || null,
                style_code: row.perfect_fit.style_code || null,
                entity_level: row.perfect_fit.entity_level || null
              }
            : null,
          product_level:
            row.attrs?.product_hierarchy?.level ||
            (row.perfect_fit?.variant_id ? 'STYLE_VARIANT' : row.perfect_fit?.entity_level) ||
            null,
          updated_at: row.updated_at
        })),
        identity_id: session.identity_id,
        tenant_code: access.tenant.code
      });
    }
  );

  app.put(
    "/commerce/:suffix/perfect-fit/admin/curation/products/:id",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      if (!requirePerfectFitScope(access, reply, "perfect_fit.products.write")) return;
      const session = await requireAdminSession(app, req, reply, access);
      if (!session) return;
      if (!requireMemberCsrf(req, reply)) return;

      const productId = normalizeText(req.params?.id);
      const rawTags = Array.isArray(req.body?.tags) ? req.body.tags : null;
      if (!productId || !rawTags) {
        return reply.code(400).send({ ok: false, error: "CURATION_PAYLOAD_INVALID" });
      }
      const tags = [...new Set(rawTags.map(normalizeText).filter(Boolean))];
      if (tags.length > 50) {
        return reply.code(400).send({ ok: false, error: "CURATION_TAG_LIMIT_EXCEEDED" });
      }

      for (const tag of tags) {
        // eslint-disable-next-line no-await-in-loop
        const governed = await validateGovernedDropdownValue(app.db, {
          tenantId: access.tenant.id,
          listCode: CURATION_LIST_CODE,
          value: tag
        });
        if (!governed.ok) {
          return reply.code(400).send({
            ok: false,
            error: "CURATION_TAG_NOT_GOVERNED",
            tag,
            reason: governed.reason || null
          });
        }
      }

      const eligible = await ensureCurationStyleVariant(
        app,
        access.tenant.id,
        productId
      );
      if (!eligible.ok) {
        return reply.code(eligible.status || 404).send(eligible);
      }

      const result = await syncPerfectFitAdminCuration(app.db, {
        tenantId: access.tenant.id,
        productId,
        tags,
        actorIdentityId: session.identity_id
      });
      if (!result?.ok) {
        return reply.code(result?.status || 400).send(result);
      }

      return reply.send({
        ...result,
        authority: "MERCHANDISING_ADMIN",
        tenant_code: access.tenant.code
      });
    }
  );
}
