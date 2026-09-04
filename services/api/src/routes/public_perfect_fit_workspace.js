import { extractProfiles } from "../services/gateway/connectionProfile.js";
import { hydrateConnectionProfileSecrets } from "../services/gateway/secretStore.js";
import { connectionAllowsOrigin, verifyConnectionRequest } from "../services/gateway/verification.js";

const RATE_LIMIT = { max: 60, timeWindow: "1 minute" };
const WORKSPACE_RECORD_TYPE = "PERFECT_FIT_WORKSPACE";
const MAX_WORKSPACE_BYTES = 900 * 1024;

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

  const attrs = session.attrs && typeof session.attrs === "object"
    ? session.attrs
    : {};
  if (String(attrs.realm || "").toUpperCase() !== "MEMBER") return null;
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

function normalizeWorkspace(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!Array.isArray(value.projects)) return null;
  return value;
}

async function loadWorkspaceRecord(db, tenantId, identityId) {
  const result = await db.query(
    `
    SELECT id, payload, attrs, created_at, updated_at
    FROM eip_core.info_record
    WHERE tenant_id = $1
      AND record_type = $2
      AND is_active = true
      AND attrs->>'owner_identity_id' = $3
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
    `,
    [tenantId, WORKSPACE_RECORD_TYPE, String(identityId)]
  );
  return result.rows[0] || null;
}

export default async function registerPublicPerfectFitWorkspaceRoutes(app) {
  app.get(
    "/commerce/:suffix/perfect-fit/workspace",
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
        return reply.code(401).send({
          ok: false,
          error: "MEMBER_UNAUTHENTICATED"
        });
      }

      const row = await loadWorkspaceRecord(
        app.db,
        access.tenant.id,
        session.identity_id
      );
      const payload = row?.payload && typeof row.payload === "object"
        ? row.payload
        : {};

      return reply.send({
        ok: true,
        workspace: payload.workspace || null,
        revision: Number(payload.revision || 0),
        updated_at: row?.updated_at || null,
        identity_id: session.identity_id,
        tenant_code: access.tenant.code
      });
    }
  );

  app.put(
    "/commerce/:suffix/perfect-fit/workspace",
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
        return reply.code(401).send({
          ok: false,
          error: "MEMBER_UNAUTHENTICATED"
        });
      }
      if (!requireMemberCsrf(req, reply)) return;

      const workspace = normalizeWorkspace(req.body?.workspace);
      if (!workspace) {
        return reply.code(400).send({
          ok: false,
          error: "WORKSPACE_INVALID"
        });
      }

      const serializedWorkspace = JSON.stringify(workspace);
      if (Buffer.byteLength(serializedWorkspace, "utf8") > MAX_WORKSPACE_BYTES) {
        return reply.code(413).send({
          ok: false,
          error: "WORKSPACE_TOO_LARGE",
          max_bytes: MAX_WORKSPACE_BYTES
        });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const currentResult = await client.query(
          `
          SELECT id, payload
          FROM eip_core.info_record
          WHERE tenant_id = $1
            AND record_type = $2
            AND is_active = true
            AND attrs->>'owner_identity_id' = $3
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 1
          FOR UPDATE
          `,
          [
            access.tenant.id,
            WORKSPACE_RECORD_TYPE,
            String(session.identity_id)
          ]
        );

        const current = currentResult.rows[0] || null;
        const currentPayload = current?.payload && typeof current.payload === "object"
          ? current.payload
          : {};
        const revision = Number(currentPayload.revision || 0) + 1;
        const savedAt = new Date().toISOString();
        const payload = {
          workspace,
          revision,
          saved_at: savedAt,
          owner_identity_id: String(session.identity_id),
          schema_version: workspace?.schemaVersion || workspace?.version || null
        };
        const attrs = {
          application: "perfect_fit",
          owner_identity_id: String(session.identity_id),
          privacy: "private",
          contains_private_technical_data: true
        };

        let recordId;
        if (current) {
          const updated = await client.query(
            `
            UPDATE eip_core.info_record
            SET title = $3,
                payload = $4::jsonb,
                attrs = COALESCE(attrs, '{}'::jsonb) || $5::jsonb,
                updated_at = now()
            WHERE tenant_id = $1 AND id = $2
            RETURNING id
            `,
            [
              access.tenant.id,
              current.id,
              "Perfect Fit Workspace",
              JSON.stringify(payload),
              JSON.stringify(attrs)
            ]
          );
          recordId = updated.rows[0]?.id || current.id;
        } else {
          const inserted = await client.query(
            `
            INSERT INTO eip_core.info_record
              (tenant_id, record_type, title, payload, attrs)
            VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
            RETURNING id
            `,
            [
              access.tenant.id,
              WORKSPACE_RECORD_TYPE,
              "Perfect Fit Workspace",
              JSON.stringify(payload),
              JSON.stringify(attrs)
            ]
          );
          recordId = inserted.rows[0]?.id || null;
        }

        await client.query("COMMIT");

        return reply.send({
          ok: true,
          workspace,
          record_id: recordId,
          revision,
          saved_at: savedAt,
          identity_id: session.identity_id,
          tenant_code: access.tenant.code
        });
      } catch (error) {
        await client.query("ROLLBACK");
        app.log.error({
          event: "perfect_fit_workspace_save_failed",
          tenant_id: access.tenant.id,
          identity_id: session.identity_id,
          error: error?.message || String(error)
        });
        return reply.code(500).send({
          ok: false,
          error: "WORKSPACE_SAVE_FAILED"
        });
      } finally {
        client.release();
      }
    }
  );
}
