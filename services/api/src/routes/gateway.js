// services/api/src/routes/gateway.js
import crypto from "node:crypto";
import { sha256Hex, timingSafeEqual } from "../auth/crypto.js";
import { buildBootstrapPayload } from "../services/gateway/bootstrap.js";
import { hasPermission } from "../auth/perm.js";
import { fetchWithTimeout, buildOutboundAuth } from "../services/gateway/outbound.js";
import {
  extractProfiles,
  normalizeProfile,
  maskSecrets,
  mergeSecrets,
  validateProfiles
} from "../services/gateway/connectionProfile.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function buildApiKey() {
  return crypto.randomBytes(32).toString("base64url");
}

function buildInboundUrl(baseUrl, suffix, channel) {
  const root = String(baseUrl || "").replace(/\/$/, "");
  if (channel === "edi") {
    return `${root}/api/edi/gateway/webhook/${suffix}`;
  }
  return `${root}/api/public/gateway/intake/${suffix}`;
}

function buildJwtHs256(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encode = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const data = `${encode(header)}.${encode(payload)}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

function buildHmacSignature(config, rawBody) {
  const algorithm = String(config.algorithm || "sha256").toLowerCase();
  const encoding = String(config.encoding || "hex").toLowerCase();
  const payloadMode = String(config.payload_mode || "raw").toLowerCase();
  let payload = rawBody;
  if (payloadMode === "timestamp_sha256") {
    const timestamp = String(config.timestamp || "").trim();
    payload = `${timestamp}\n${crypto.createHash("sha256").update(rawBody).digest("hex")}`;
  }
  return crypto.createHmac(algorithm, config.secret).update(payload).digest(encoding);
}

async function requireSessionWithCsrf(app, req, reply) {
  const s = await app.requireSession(req, { realm: "EIP" });
  if (!s.ok) {
    reply.code(s.status).send({ ok: false, error: s.error });
    return null;
  }

  const c = await app.requireCsrf(req);
  if (!c.ok) {
    reply.code(c.status).send({ ok: false, error: c.error });
    return null;
  }

  const csrfCookie = req.cookies?.csrf;
  const csrfHeader = req.headers["x-csrf"];
  if (!csrfCookie || !csrfHeader) {
    reply.code(403).send({ ok: false, error: "CSRF_MISSING" });
    return null;
  }
  if (String(csrfHeader) !== String(csrfCookie)) {
    reply.code(403).send({ ok: false, error: "CSRF_MISMATCH" });
    return null;
  }
  const expected = sha256Hex(`${csrfCookie}:${app.config.CSRF_PEPPER}`);
  if (!s.session.csrf_secret_hash || !timingSafeEqual(expected, s.session.csrf_secret_hash)) {
    reply.code(403).send({ ok: false, error: "CSRF_INVALID" });
    return null;
  }

  return s.session;
}

export default async function gatewayRoutes(app) {
  app.get("/gateway/bootstrap", async (req, reply) => {
    const session = await requireSessionWithCsrf(app, req, reply);
    if (!session) return;

    const payload = await buildBootstrapPayload(app, session);
    return reply.send(payload);
  });

  // ============================================================
  // Admin: connection profiles & API keys (gateway control plane)
  // ============================================================
  app.get("/gateway/connections", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.read");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const r = await app.db.query(
      `
      SELECT
        t.id,
        t.code,
        t.name,
        t.is_active,
        t.attrs,
        max(ir.created_at) AS last_handshake_at,
        count(ir.id) FILTER (WHERE ir.created_at >= now() - interval '7 days')::int AS handshake_7d
      FROM eip_core.tenant t
      LEFT JOIN eip_core.info_record ir
        ON ir.tenant_id = t.id
       AND ir.record_type = 'gateway_handshake'
      GROUP BY t.id
      ORDER BY t.created_at DESC
      `
    );

    const items = r.rows.map((row) => {
      const connections = extractProfiles(row.attrs);
      const primary = connections[0] || null;
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        is_active: row.is_active,
        connection_count: connections.length,
        primary_connection_code: primary?.identity?.connection_code || null,
        direction: primary?.identity?.direction || null,
        environment: primary?.identity?.environment || null,
        is_enabled: primary?.identity?.is_enabled ?? null,
        last_handshake_at: row.last_handshake_at,
        handshake_7d: row.handshake_7d,
      };
    });

    return reply.send({ ok: true, items });
  });

  app.get("/gateway/connections/templates", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.template");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const r = await app.db.query(
      `
      SELECT DISTINCT code, title, tenant_id, is_public, is_published
      FROM eip_core.ui_surface
      WHERE is_active = true AND is_published = true
      ORDER BY code
      `
    );

    return reply.send({ ok: true, items: r.rows });
  });

  app.get("/gateway/connections/:tenantId", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.read");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const tenantId = req.params.tenantId;

    const tenantRes = await app.db.query(
      `
      SELECT id, code, name, is_active, attrs
      FROM eip_core.tenant
      WHERE id = $1::uuid
      `,
      [tenantId]
    );
    if (tenantRes.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

    const tenant = tenantRes.rows[0];
    const connections = extractProfiles(tenant.attrs);

    const keysRes = await app.db.query(
      `
      SELECT id, label, is_active, expires_at, created_at, attrs
      FROM eip_auth.auth_api_key
      WHERE tenant_id = $1::uuid
      ORDER BY created_at DESC
      `,
      [tenantId]
    );

    const logRes = await app.db.query(
      `
      SELECT id,
             payload->>'event_type' AS event_type,
             payload->>'template_code' AS template_code,
             payload->>'object_ref' AS object_ref,
             payload->>'origin' AS origin,
             created_at
      FROM eip_core.info_record
      WHERE tenant_id = $1::uuid
        AND record_type = 'gateway_handshake'
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [tenantId]
    );

    const healthRes = await app.db.query(
      `
      SELECT
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS last_24h,
        count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS last_7d,
        max(created_at) AS last_seen
      FROM eip_core.info_record
      WHERE tenant_id = $1::uuid
        AND record_type = 'gateway_handshake'
      `,
      [tenantId]
    );

    return reply.send({
      ok: true,
      tenant,
      connections: connections.map(maskSecrets),
      api_keys: keysRes.rows,
      logs: logRes.rows,
      health: healthRes.rows[0] || {}
    });
  });

  app.post("/gateway/connections/:tenantId/profile", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.write");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const tenantId = req.params.tenantId;
    const incomingConnections = Array.isArray(req.body?.connections) ? req.body.connections : [];

    const existingRes = await app.db.query(
      "SELECT attrs FROM eip_core.tenant WHERE id = $1::uuid",
      [tenantId]
    );
    const existingProfiles = extractProfiles(existingRes.rows[0]?.attrs || {});

    const normalizedConnections = incomingConnections.map((item, index) => {
      const normalized = normalizeProfile(item, item?.id || `conn-${index + 1}`);
      const existing = existingProfiles.find(
        (profile) => profile.identity?.connection_code === normalized.identity.connection_code
      );
      return mergeSecrets(existing, normalized);
    });

    const errors = validateProfiles(normalizedConnections);
    if (errors.length) {
      return reply.code(400).send({ ok: false, error: "VALIDATION_ERROR", details: errors });
    }

    for (const profile of normalizedConnections) {
      const suffix = profile.inbound?.inbound_path_suffix;
      if (!suffix) continue;
      const dup = await app.db.query(
        `
        SELECT id
        FROM eip_core.tenant
        WHERE id <> $1::uuid
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(attrs->'connection_profiles') = 'array'
                THEN attrs->'connection_profiles'
                ELSE '[]'::jsonb
              END
            ) AS profile
            WHERE profile->'inbound'->>'inbound_path_suffix' = $2
          )
        LIMIT 1
        `,
        [tenantId, suffix]
      );
      if (dup.rowCount > 0) {
        return reply.code(400).send({ ok: false, error: "DUPLICATE_SUFFIX", details: [suffix] });
      }
    }

    const r = await app.db.query(
      `
      UPDATE eip_core.tenant
      SET attrs = jsonb_set(
        COALESCE(attrs,'{}'::jsonb),
        '{connection_profiles}',
        $2::jsonb,
        true
      ),
      updated_at = now()
      WHERE id = $1::uuid
      RETURNING id, code, name, is_active, attrs
      `,
      [tenantId, JSON.stringify(normalizedConnections)]
    );

    const updatedTenant = r.rows[0];
    const updatedConnections = extractProfiles(updatedTenant?.attrs);

    return reply.send({ ok: true, connections: updatedConnections.map(maskSecrets) });
  });

  app.post("/gateway/connections/:tenantId/test/inbound", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.write");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const tenantId = req.params.tenantId;
    const connectionCode = normalizeText(req.body?.connection_code);
    if (!connectionCode) return reply.code(400).send({ ok: false, error: "MISSING_CONNECTION_CODE" });

    const tenantRes = await app.db.query(
      "SELECT attrs FROM eip_core.tenant WHERE id = $1::uuid",
      [tenantId]
    );
    if (tenantRes.rowCount === 0) return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
    const profiles = extractProfiles(tenantRes.rows[0].attrs || {});
    const profile = profiles.find((item) => item.identity?.connection_code === connectionCode);
    if (!profile) return reply.code(404).send({ ok: false, error: "CONNECTION_NOT_FOUND" });

    const suffix = profile.inbound?.inbound_path_suffix;
    const channel = profile.routing?.channel === "edi" ? "edi" : "public";
    const url = buildInboundUrl(`http://localhost:${app.config.PORT}`, suffix, channel);

    const eventId = `test-${Date.now()}`;
    const contentType = profile.inbound?.expected_content_type || "application/json";
    const bodyObject = {
      test: true,
      at: new Date().toISOString(),
      connection_code: connectionCode
    };

    const setBodyPath = (obj, path, value) => {
      if (!path) return;
      const parts = path.split(".");
      let cursor = obj;
      while (parts.length > 1) {
        const key = parts.shift();
        if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
        cursor = cursor[key];
      }
      cursor[parts[0]] = value;
    };

    const headers = { "Content-Type": contentType };

    const idem = profile.idempotency || {};
    const eventLocation = String(idem.event_id_location || "").toLowerCase();
    if (eventLocation === "header") {
      headers[String(idem.event_id_key)] = eventId;
    } else if (eventLocation === "body") {
      setBodyPath(bodyObject, idem.event_id_key || "event_id", eventId);
    } else {
      bodyObject.event_id = eventId;
    }

    const originAllowlist = profile.inbound?.origin_allowlist || [];
    if (originAllowlist.length) {
      headers.Origin = originAllowlist[0];
    }

    const ipAllowlist = profile.audit?.ip_allowlist || [];
    if (ipAllowlist.length) {
      headers["X-Forwarded-For"] = ipAllowlist[0];
    }

    if (profile.verification?.mode === "api_key") {
      const headerName = profile.verification.api_key?.header_name;
      if (!headerName) return reply.code(400).send({ ok: false, error: "API_KEY_HEADER_REQUIRED" });
      headers[String(headerName)] = profile.verification.api_key?.secret || "";
    }

    let rawBody = "";
    if (contentType.includes("json")) {
      rawBody = JSON.stringify(bodyObject);
    } else {
      rawBody = `TEST|${eventId}|${connectionCode}`;
    }
    const rawBuffer = Buffer.from(rawBody);

    if (profile.verification?.mode === "hmac_signature") {
      const hmac = { ...(profile.verification.hmac_signature || {}) };
      const timestampHeader = String(hmac.timestamp_header || "").trim();
      if (timestampHeader) {
        const timestamp = new Date().toISOString();
        headers[timestampHeader] = timestamp;
        hmac.timestamp = timestamp;
      }
      const signature = buildHmacSignature(hmac, rawBuffer);
      const headerName = hmac.header_name;
      if (!headerName) return reply.code(400).send({ ok: false, error: "SIGNATURE_HEADER_REQUIRED" });
      headers[String(headerName)] = signature;
    }

    if (profile.verification?.mode === "oauth2_jwt") {
      const headerName = profile.verification.oauth2_jwt?.header_name;
      if (!headerName) return reply.code(400).send({ ok: false, error: "JWT_HEADER_REQUIRED" });
      const tokenPrefix = String(profile.verification.oauth2_jwt?.token_prefix || "").trim();
      if (profile.verification.oauth2_jwt?.secret) {
        const token = buildJwtHs256(
          { iss: profile.verification.oauth2_jwt?.issuer, aud: profile.verification.oauth2_jwt?.audience },
          profile.verification.oauth2_jwt.secret
        );
        headers[headerName] = tokenPrefix ? `${tokenPrefix} ${token}` : token;
      } else if (req.body?.test_token) {
        headers[headerName] = String(req.body.test_token);
      } else {
        return reply.code(400).send({ ok: false, error: "TEST_TOKEN_REQUIRED" });
      }
    }

    try {
      const response = await fetchWithTimeout(testUrl, {
        method: profile.inbound?.http_method || "POST",
        headers,
        body: rawBody,
        timeout_ms: profile.outbound?.timeout_ms || 8000
      });

      const text = await response.text();
      return reply.send({
        ok: response.ok,
        status: response.status,
        response: text
      });
    } catch (err) {
      return reply.code(502).send({
        ok: false,
        error: "INBOUND_TEST_FAILED",
        detail: err?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR"
      });
    }
  });

  app.post("/gateway/connections/:tenantId/test/outbound", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.write");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const tenantId = req.params.tenantId;
    const connectionCode = normalizeText(req.body?.connection_code);
    if (!connectionCode) return reply.code(400).send({ ok: false, error: "MISSING_CONNECTION_CODE" });

    const tenantRes = await app.db.query(
      "SELECT attrs FROM eip_core.tenant WHERE id = $1::uuid",
      [tenantId]
    );
    if (tenantRes.rowCount === 0) return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
    const profiles = extractProfiles(tenantRes.rows[0].attrs || {});
    const profile = profiles.find((item) => item.identity?.connection_code === connectionCode);
    if (!profile) return reply.code(404).send({ ok: false, error: "CONNECTION_NOT_FOUND" });

    if (!profile.outbound?.base_url) {
      return reply.code(400).send({ ok: false, error: "OUTBOUND_NOT_CONFIGURED" });
    }

    const base = profile.outbound.base_url.replace(/\/$/, "");
    const prefix = profile.outbound.path_prefix || "/";
    const health = profile.outbound.healthcheck_path || "/";
    const url = `${base}${prefix}${health}`.replace(/\/\/+/g, "/").replace(":/", "://");

    let headers;
    let authQuery = {};
    try {
      const outboundAuth = await buildOutboundAuth(profile);
      headers = outboundAuth.headers || {};
      authQuery = outboundAuth.query && typeof outboundAuth.query === "object" ? outboundAuth.query : {};
    } catch (err) {
      return reply.code(400).send({ ok: false, error: err.message });
    }

    try {
      const method = profile.outbound.test_request_method || "GET";
      const testUrl = (() => {
        const urlObj = new URL(url);
        for (const [key, value] of Object.entries(authQuery)) {
          if (value === undefined || value === null) continue;
          urlObj.searchParams.set(String(key), String(value));
        }
        return urlObj.toString();
      })();
      const response = await fetchWithTimeout(testUrl, {
        method,
        headers,
        body: method === "GET" ? undefined : JSON.stringify({ test: true, at: new Date().toISOString() }),
        timeout_ms: profile.outbound.timeout_ms || 8000
      });

      const text = await response.text();
      return reply.send({
        ok: response.ok,
        status: response.status,
        response: text
      });
    } catch (err) {
      return reply.code(502).send({
        ok: false,
        error: "OUTBOUND_TEST_FAILED",
        detail: err?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR"
      });
    }
  });

  app.post("/gateway/connections/:tenantId/api-keys", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.api_key");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const tenantId = req.params.tenantId;
    const label = normalizeText(req.body?.label || "plug-play");
    const expiresInDays = Number(req.body?.expires_in_days || 365);
    const setPrimary = Boolean(req.body?.set_primary ?? true);

    const rawKey = buildApiKey();
    const keyHash = sha256Hex(`${rawKey}:${app.config.API_KEY_PEPPER}`);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const r = await app.db.query(
      `
      INSERT INTO eip_auth.auth_api_key
        (tenant_id, key_hash, label, is_active, expires_at, scopes, attrs)
      VALUES
        ($1::uuid, $2, $3, true, $4, '{}'::jsonb, jsonb_build_object('created_by', $5::uuid))
      RETURNING id, label, is_active, expires_at, created_at
      `,
      [tenantId, keyHash, label, expiresAt, s.session.identity_id]
    );

    if (setPrimary) {
      await app.db.query(
        `
        UPDATE eip_core.tenant
        SET attrs = jsonb_set(
          COALESCE(attrs,'{}'::jsonb),
          '{primary_api_key_id}',
          to_jsonb($2::uuid),
          true
        ),
        updated_at = now()
        WHERE id = $1::uuid
        `,
        [tenantId, r.rows[0].id]
      );
    }

    return reply.send({ ok: true, api_key: r.rows[0], raw_key: rawKey });
  });

  app.post("/gateway/connections/:tenantId/api-keys/:keyId/revoke", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.api_key");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const tenantId = req.params.tenantId;
    const keyId = req.params.keyId;

    await app.db.query(
      `
      UPDATE eip_auth.auth_api_key
      SET is_active = false, expires_at = now(), updated_at = now()
      WHERE tenant_id = $1::uuid AND id = $2::uuid
      `,
      [tenantId, keyId]
    );

    await app.db.query(
      `
      UPDATE eip_core.tenant
      SET attrs = jsonb_set(
        COALESCE(attrs,'{}'::jsonb),
        '{primary_api_key_id}',
        'null'::jsonb,
        true
      ),
      updated_at = now()
      WHERE id = $1::uuid
      `,
      [tenantId]
    );

    return reply.send({ ok: true });
  });

  app.post("/gateway/connections/:tenantId/api-keys/:keyId/rotate", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.api_key");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const tenantId = req.params.tenantId;
    const keyId = req.params.keyId;
    const label = normalizeText(req.body?.label || "plug-play");

    await app.db.query(
      `
      UPDATE eip_auth.auth_api_key
      SET is_active = false, expires_at = now(), updated_at = now()
      WHERE tenant_id = $1::uuid AND id = $2::uuid
      `,
      [tenantId, keyId]
    );

    const rawKey = buildApiKey();
    const keyHash = sha256Hex(`${rawKey}:${app.config.API_KEY_PEPPER}`);
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const r = await app.db.query(
      `
      INSERT INTO eip_auth.auth_api_key
        (tenant_id, key_hash, label, is_active, expires_at, scopes, attrs)
      VALUES
        ($1::uuid, $2, $3, true, $4, '{}'::jsonb, jsonb_build_object('rotated_from', $5::uuid))
      RETURNING id, label, is_active, expires_at, created_at
      `,
      [tenantId, keyHash, label, expiresAt, keyId]
    );

    await app.db.query(
      `
      UPDATE eip_core.tenant
      SET attrs = jsonb_set(
        COALESCE(attrs,'{}'::jsonb),
        '{primary_api_key_id}',
        to_jsonb($2::uuid),
        true
      ),
      updated_at = now()
      WHERE id = $1::uuid
      `,
      [tenantId, r.rows[0].id]
    );

    return reply.send({ ok: true, api_key: r.rows[0], raw_key: rawKey });
  });
}
