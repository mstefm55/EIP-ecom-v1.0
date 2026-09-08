import { buildSignedAssetUrl } from "../services/assets/signing.js";
import { isTenantAssetPath, toLocalAssetPath } from "../services/assets/url_policy.js";
import {
  connectionAllowsStorefrontCapability,
  connectionAllowsStorefrontScope,
  extractProfiles
} from "../services/gateway/connectionProfile.js";
import { hydrateConnectionProfileSecrets } from "../services/gateway/secretStore.js";
import { connectionAllowsOrigin, verifyConnectionRequest } from "../services/gateway/verification.js";

const RATE_LIMIT = { max: 120, timeWindow: "1 minute" };
const PUBLICATION_RECORD_TYPE = "PERFECT_FIT_PUBLICATION_REQUEST";
const PUBLICATION_OBJECT_TYPE = "storefront_content";

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
  reply.header("Access-Control-Allow-Methods", "GET, OPTIONS");
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

  if (!connectionAllowsStorefrontCapability(profile, "perfect_fit")) {
    reply.code(403).send({ ok: false, error: "PERFECT_FIT_DISABLED" });
    return null;
  }
  if (!connectionAllowsStorefrontScope(profile, "perfect_fit.products.read")) {
    reply.code(403).send({ ok: false, error: "PERFECT_FIT_SCOPE_REQUIRED" });
    return null;
  }

  applyCors(reply, origin);
  return { tenant: resolved.tenant, profile };
}

function materialTags(attrs = {}) {
  const tags = attrs?.taxonomy?.tags;
  return Array.isArray(tags)
    ? [...new Set(tags.map(normalizeText).filter(Boolean))]
    : [];
}

function signProjectionAssets(value, app, tenantId, depth = 0) {
  if (depth > 12 || value === null || value === undefined) return value;
  if (typeof value === "string") {
    const localPath = toLocalAssetPath(value);
    if (!localPath) return value;
    if (!isTenantAssetPath(localPath, tenantId)) return "";
    const ttlSec = Number(app.config.ASSET_TOKEN_TTL_SEC || 604800);
    const exp = Math.floor(Date.now() / 1000) + (Number.isFinite(ttlSec) ? ttlSec : 604800);
    return buildSignedAssetUrl(localPath, exp, app.config.API_KEY_PEPPER);
  }
  if (Array.isArray(value)) {
    return value.map((item) => signProjectionAssets(item, app, tenantId, depth + 1));
  }
  if (typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      signProjectionAssets(item, app, tenantId, depth + 1)
    ])
  );
}

function toCatalogPattern(row, app, tenantId) {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : {};
  const identity = payload?.identity && typeof payload.identity === "object" ? payload.identity : {};
  const materialAttrs = row?.material_attrs && typeof row.material_attrs === "object" ? row.material_attrs : {};
  const projection = payload?.customer_projection && typeof payload.customer_projection === "object"
    ? payload.customer_projection
    : {};
  const tags = materialTags(materialAttrs);
  const seo = materialAttrs?.seo && typeof materialAttrs.seo === "object" ? materialAttrs.seo : {};

  const pattern = {
    ...projection,
    id: projection.id || identity.variant_id || row.material_id,
    materialId: row.material_id,
    materialCode: row.material_code,
    styleId: projection.styleId || identity.style_id || null,
    styleCode: projection.styleCode || identity.style_code || "",
    variantId: projection.variantId || identity.variant_id || null,
    variantCode: projection.variantCode || identity.variant_code || "",
    name: projection.name || identity.style_name || row.material_name || "Product",
    variantName: projection.variantName || identity.variant_name || "Variant",
    tags,
    collectionTags: tags,
    taxonomy: {
      ...(projection.taxonomy && typeof projection.taxonomy === "object" ? projection.taxonomy : {}),
      tags
    },
    seo: {
      ...(projection.seo && typeof projection.seo === "object" ? projection.seo : {}),
      ...seo
    },
    publicationStatus: "PUBLISHED",
    publicationAuthority: "EIP_PROCESS_ENGINE",
    publishedAt: payload?.moderation?.published_at || row.updated_at || row.created_at || null
  };

  return signProjectionAssets(pattern, app, tenantId);
}

export default async function registerPublicPerfectFitCatalogRoutes(app) {
  app.get(
    "/commerce/:suffix/perfect-fit/catalog",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;

      const limit = Math.max(1, Math.min(250, Number(req.query?.limit || 100)));
      const result = await app.db.query(
        `
        WITH ranked AS (
          SELECT
            ir.id AS info_record_id,
            ir.payload,
            ir.created_at,
            ir.updated_at,
            so.status AS service_object_status,
            m.id AS material_id,
            m.code AS material_code,
            m.name AS material_name,
            m.attrs AS material_attrs,
            ROW_NUMBER() OVER (
              PARTITION BY m.id
              ORDER BY ir.updated_at DESC, ir.created_at DESC
            ) AS rn
          FROM eip_core.info_record ir
          JOIN eip_core.service_object so
            ON so.tenant_id=ir.tenant_id
           AND so.id=(ir.payload->>'service_object_id')::uuid
           AND so.object_type=$3
          JOIN eip_core.material m
            ON m.tenant_id=ir.tenant_id
           AND m.id=(ir.payload->>'material_id')::uuid
           AND m.material_type='PRODUCT'
          WHERE ir.tenant_id=$1
            AND ir.record_type=$2
            AND ir.is_active=true
            AND so.status='published'
            AND COALESCE(m.attrs->'workflow'->>'publication_status','PUBLISHED')='PUBLISHED'
        )
        SELECT
          info_record_id,
          payload,
          created_at,
          updated_at,
          service_object_status,
          material_id,
          material_code,
          material_name,
          material_attrs
        FROM ranked
        WHERE rn=1
        ORDER BY COALESCE(payload->'moderation'->>'published_at', updated_at::text) DESC
        LIMIT $4
        `,
        [access.tenant.id, PUBLICATION_RECORD_TYPE, PUBLICATION_OBJECT_TYPE, limit]
      );

      const items = (result.rows || [])
        .map((row) => toCatalogPattern(row, app, access.tenant.id))
        .filter((item) => item?.id);

      return reply.send({
        ok: true,
        items,
        total: items.length,
        authority: "EIP_PUBLISHED_PRODUCT_PROJECTION"
      });
    }
  );
}
