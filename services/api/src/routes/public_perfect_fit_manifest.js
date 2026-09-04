import { extractProfiles } from "../services/gateway/connectionProfile.js";
import { hydrateConnectionProfileSecrets } from "../services/gateway/secretStore.js";
import { connectionAllowsOrigin, verifyConnectionRequest } from "../services/gateway/verification.js";
import { buildPerfectFitCoordinatorManifest } from "../services/perfectFit/manifestCoordinator.js";

const RATE_LIMIT = { max: 60, timeWindow: "1 minute" };
const MAX_MANIFEST_BYTES = 512 * 1024;

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
  const profile = profiles.find(
    (item) => item?.inbound?.inbound_path_suffix === suffix
  );
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

  profile = await hydrateConnectionProfileSecrets(
    app,
    app.db,
    resolved.tenant.id,
    profile
  );

  const rawBody = Buffer.from(JSON.stringify(req.body || {}));
  const verified = await verifyConnectionRequest(req, profile, rawBody);
  if (!verified.ok) {
    reply.code(401).send({ ok: false, error: verified.error });
    return null;
  }

  applyCors(reply, origin);
  return {
    tenant: resolved.tenant,
    profile,
    suffix,
    origin
  };
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
  if (session.is_revoked || new Date(session.expires_at).getTime() <= Date.now()) {
    return null;
  }
  if (String(session.tenant_id) !== String(tenantId)) return null;
  const attrs = session.attrs && typeof session.attrs === "object" ? session.attrs : {};
  if (String(attrs.realm || "").toUpperCase() !== "MEMBER") return null;
  if (normalizeText(attrs.connection_suffix) !== normalizeText(suffix)) return null;
  return session;
}

function requireMemberCsrf(req, reply) {
  const cookie = normalizeText(req.cookies?.member_csrf);
  const header = normalizeText(req.headers["x-member-csrf"]);
  if (!cookie || !header || cookie !== header) {
    reply.code(403).send({ ok: false, error: "MEMBER_CSRF_REQUIRED" });
    return false;
  }
  return true;
}

export default async function registerPublicPerfectFitManifestRoutes(app) {
  app.get(
    "/commerce/:suffix/perfect-fit/manifest",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      const session = await loadMemberSession(
        app,
        req,
        access.tenant.id,
        access.suffix
      );
      if (!session) {
        return reply.code(401).send({ ok: false, error: "MEMBER_UNAUTHENTICATED" });
      }

      const manifest = await buildPerfectFitCoordinatorManifest(app.db, {
        tenantId: access.tenant.id
      });

      return reply.send({
        ok: true,
        tenant_code: access.tenant.code,
        identity_id: session.identity_id,
        manifest
      });
    }
  );

  app.post(
    "/commerce/:suffix/perfect-fit/manifest/reconcile",
    {
      config: { rateLimit: RATE_LIMIT, cors: false },
      bodyLimit: MAX_MANIFEST_BYTES
    },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      const session = await loadMemberSession(
        app,
        req,
        access.tenant.id,
        access.suffix
      );
      if (!session) {
        return reply.code(401).send({ ok: false, error: "MEMBER_UNAUTHENTICATED" });
      }
      if (!requireMemberCsrf(req, reply)) return;

      const clientManifest = req.body?.manifest;
      if (!clientManifest || !Array.isArray(clientManifest.fields)) {
        return reply.code(400).send({ ok: false, error: "PF_MANIFEST_INVALID" });
      }

      const serialized = JSON.stringify(clientManifest);
      if (Buffer.byteLength(serialized, "utf8") > MAX_MANIFEST_BYTES) {
        return reply.code(413).send({
          ok: false,
          error: "PF_MANIFEST_TOO_LARGE",
          max_bytes: MAX_MANIFEST_BYTES
        });
      }

      const manifest = await buildPerfectFitCoordinatorManifest(app.db, {
        tenantId: access.tenant.id,
        clientManifest
      });

      return reply.send({
        ok: true,
        tenant_code: access.tenant.code,
        identity_id: session.identity_id,
        manifest
      });
    }
  );
}
