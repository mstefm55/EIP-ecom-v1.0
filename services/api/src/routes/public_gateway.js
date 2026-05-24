// services/api/src/routes/public_gateway.js
import { sha256Hex } from "../auth/crypto.js";
import { handlePublicIntake } from "../services/gateway/intake.js";
import { resolveTenantByCode } from "../services/gateway/tenantResolve.js";
import { registerRawBody, parseJsonBody } from "../services/gateway/rawBody.js";
import { insertGatewayAudit } from "../services/gateway/audit.js";
import { buildRequestHash, ensureIdempotency, finalizeIdempotency } from "../services/gateway/idempotency.js";
import { extractProfiles } from "../services/gateway/connectionProfile.js";
import { hydrateConnectionProfileSecrets } from "../services/gateway/secretStore.js";
import { connectionAllowsOrigin, extractEventId, verifyConnectionRequest } from "../services/gateway/verification.js";
import { emitSecurityEvent, redactSecurityDetails } from "../lib/securityAudit.js";
import { LRUCache } from "lru-cache";

const INTAKE_RATE_LIMIT = { max: 30, timeWindow: "1 minute" };
const INTAKE_BODY_LIMIT = 64 * 1024;
const BOOTSTRAP_BODY_LIMIT = 256 * 1024;
const INBOUND_BODY_LIMIT = 512 * 1024;
const INBOUND_RATE_CACHE = new LRUCache({ max: 20000 });

function normalizeText(value) {
  return String(value || "").trim();
}

function applyCors(reply, origin, requestHeaders) {
  if (!origin) return;
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Headers", requestHeaders || "Content-Type, X-API-Key, Authorization");
  reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function extractApiKey(req) {
  const headerKey = req.headers["x-api-key"];
  if (headerKey) return String(headerKey);
  const auth = String(req.headers.authorization || "");
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1];
  const queryKey = req.query?.api_key || req.query?.apiKey;
  if (queryKey) return String(queryKey);
  return "";
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
}

function applyRedaction(payload, policy) {
  if (!payload) return payload;
  const clone = redactSecurityDetails(payload);
  if (!policy) return clone;
  const redactPaths = Array.isArray(policy.paths) ? policy.paths : [];
  if (!redactPaths.length) return clone;
  for (const path of redactPaths) {
    const parts = path.split(".");
    const last = parts.pop();
    const parent = parts.reduce((acc, key) => (acc ? acc[key] : null), clone);
    if (parent && last in parent) {
      parent[last] = "[REDACTED]";
    }
  }
  return clone;
}

async function recordGatewaySecurityEvent(app, eventType, details = {}) {
  return emitSecurityEvent(app, eventType, {
    category: "gateway",
    source: "public_gateway",
    severity: details.severity || "warning",
    outcome: details.outcome || "rejected",
    ...details
  });
}

async function denyGateway(app, reply, status, error, details = {}) {
  await recordGatewaySecurityEvent(app, details.eventType || `gateway.${String(error || "denied").toLowerCase()}`, {
    ...details,
    outcome: details.outcome || (status >= 500 ? "error" : "rejected"),
    severity: details.severity || (status >= 500 ? "error" : "warning"),
    reason: error
  });
  return reply.code(status).send({ ok: false, error });
}

function connectionAllowsIp(profile, ip) {
  const allowlist = Array.isArray(profile?.audit?.ip_allowlist) ? profile.audit.ip_allowlist : [];
  if (!allowlist.length) return true;
  return allowlist.includes(ip);
}

function requiresInbound(profile) {
  return profile?.identity?.direction === "inbound" || profile?.identity?.direction === "both";
}

function requiresOutbound(profile) {
  return profile?.identity?.direction === "outbound" || profile?.identity?.direction === "both";
}

function selectConnection(profiles, predicate) {
  const list = Array.isArray(profiles) ? profiles : [];
  for (const item of list) {
    if (!predicate || predicate(item)) return item;
  }
  return list[0] || null;
}

function computeInboundUrls(baseUrl, suffix) {
  const safeBase = String(baseUrl || "").replace(/\/$/, "");
  return {
    public_url: `${safeBase}/api/public/gateway/intake/${suffix}`,
    edi_url: `${safeBase}/api/edi/gateway/webhook/${suffix}`
  };
}

function resolveInboundRateLimit(app, profile) {
  const rate = profile?.inbound?.rate_limit || {};
  const max = Number.isFinite(Number(rate.max))
    ? Number(rate.max)
    : Number(app.config.INBOUND_RATE_LIMIT_MAX || 120);
  const windowSec = Number.isFinite(Number(rate.window_sec))
    ? Number(rate.window_sec)
    : Number(app.config.INBOUND_RATE_LIMIT_WINDOW_SEC || 60);
  return {
    max,
    windowMs: Math.max(1000, windowSec * 1000)
  };
}

function checkInboundRateLimit(app, key, profile) {
  const { max, windowMs } = resolveInboundRateLimit(app, profile);
  if (!Number.isFinite(max) || max <= 0) return { ok: true };
  const now = Date.now();
  const entry = INBOUND_RATE_CACHE.get(key);
  if (!entry || entry.resetAt <= now) {
    INBOUND_RATE_CACHE.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (entry.count >= max) {
    return { ok: false, retryAfterMs: entry.resetAt - now };
  }
  entry.count += 1;
  INBOUND_RATE_CACHE.set(key, entry);
  return { ok: true };
}

async function resolveTenantByApiKey(app, rawKey) {
  if (!rawKey) return null;
  const keyHash = sha256Hex(`${rawKey}:${app.config.API_KEY_PEPPER}`);
  const keyRes = await app.db.query(
    `
    SELECT id, tenant_id, is_active, expires_at
    FROM eip_auth.auth_api_key
    WHERE key_hash = $1
    LIMIT 1
    `,
    [keyHash]
  );
  if (keyRes.rowCount === 0) return null;
  const key = keyRes.rows[0];
  if (!key.is_active) return null;
  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) return null;

  const tenantRes = await app.db.query(
    `
    SELECT id, code, name, attrs, is_active
    FROM eip_core.tenant
    WHERE id = $1
    LIMIT 1
    `,
    [key.tenant_id]
  );
  if (tenantRes.rowCount === 0) return null;
  const tenant = tenantRes.rows[0];
  if (!tenant.is_active) return null;

  const profiles = extractProfiles(tenant.attrs);
  return { key, tenant, profiles };
}

async function resolveTenantBySuffix(app, suffix) {
  const r = await app.db.query(
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
  if (r.rowCount === 0) return null;
  if (r.rowCount > 1) return { error: "DUPLICATE_SUFFIX" };
  const tenant = r.rows[0];
  const profiles = extractProfiles(tenant.attrs);
  const profile = profiles.find(
    (item) => item?.inbound?.inbound_path_suffix === suffix
  );
  return { tenant, profile, profiles };
}

async function handleInbound(app, req, reply, opts) {
  const { suffix, channel } = opts;
  const resolved = await resolveTenantBySuffix(app, suffix);
  if (!resolved) {
    return denyGateway(app, reply, 404, "ROUTING_NOT_FOUND", {
      eventType: "gateway.routing_not_found",
      suffix,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null,
      metadata: { channel }
    });
  }
  if (resolved.error) {
    return denyGateway(app, reply, 409, resolved.error, {
      eventType: "gateway.duplicate_suffix",
      suffix,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null,
      metadata: { channel }
    });
  }

  const { tenant } = resolved;
  let { profile } = resolved;
  if (!profile) {
    return denyGateway(app, reply, 404, "ROUTING_NOT_FOUND", {
      eventType: "gateway.routing_not_found",
      tenantId: tenant.id,
      suffix,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null,
      metadata: { channel }
    });
  }
  if (!profile.identity?.is_enabled) {
    return denyGateway(app, reply, 403, "CONNECTION_DISABLED", {
      eventType: "gateway.connection_disabled",
      tenantId: tenant.id,
      connectionCode: profile.identity?.connection_code,
      suffix,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null
    });
  }
  if (!requiresInbound(profile)) {
    return denyGateway(app, reply, 403, "INBOUND_NOT_ALLOWED", {
      eventType: "gateway.inbound_not_allowed",
      tenantId: tenant.id,
      connectionCode: profile.identity?.connection_code,
      suffix,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null
    });
  }

  const rateKey = `${suffix}:${req.ip || "unknown"}`;
  const rate = checkInboundRateLimit(app, rateKey, profile);
  if (!rate.ok) {
    const retry = Math.ceil((rate.retryAfterMs || 0) / 1000);
    reply.header("Retry-After", String(retry));
    return denyGateway(app, reply, 429, "RATE_LIMIT", {
      eventType: "gateway.rate_limited",
      tenantId: tenant.id,
      connectionCode: profile.identity?.connection_code,
      suffix,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null,
      metadata: { retry_after_sec: retry, rate_limit: resolveInboundRateLimit(app, profile) }
    });
  }

  if (channel === "edi" && profile.routing?.channel !== "edi") {
    return denyGateway(app, reply, 403, "CHANNEL_MISMATCH", {
      eventType: "gateway.channel_mismatch",
      tenantId: tenant.id,
      connectionCode: profile.identity?.connection_code,
      suffix,
      ip: req.ip,
      metadata: { requested_channel: channel, configured_channel: profile.routing?.channel }
    });
  }

  if (profile.inbound?.http_method && req.method !== profile.inbound.http_method) {
    return denyGateway(app, reply, 405, "METHOD_NOT_ALLOWED", {
      eventType: "gateway.method_not_allowed",
      tenantId: tenant.id,
      connectionCode: profile.identity?.connection_code,
      suffix,
      ip: req.ip,
      metadata: { method: req.method, expected_method: profile.inbound?.http_method }
    });
  }

  const contentType = String(req.headers["content-type"] || "");
  if (profile.inbound?.expected_content_type && !contentType.includes(profile.inbound.expected_content_type)) {
    return denyGateway(app, reply, 415, "UNSUPPORTED_CONTENT_TYPE", {
      eventType: "gateway.content_type_rejected",
      tenantId: tenant.id,
      connectionCode: profile.identity?.connection_code,
      suffix,
      ip: req.ip,
      metadata: { content_type: contentType, expected_content_type: profile.inbound?.expected_content_type }
    });
  }

  if (!connectionAllowsOrigin(profile, req.headers.origin)) {
    return denyGateway(app, reply, 403, "ORIGIN_NOT_ALLOWED", {
      eventType: "gateway.origin_rejected",
      tenantId: tenant.id,
      connectionCode: profile.identity?.connection_code,
      suffix,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null,
      metadata: { origin: req.headers.origin || null }
    });
  }

  if (!connectionAllowsIp(profile, req.ip)) {
    return denyGateway(app, reply, 403, "IP_NOT_ALLOWED", {
      eventType: "gateway.ip_rejected",
      tenantId: tenant.id,
      connectionCode: profile.identity?.connection_code,
      suffix,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null
    });
  }

  const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody || "");
  if (rawBody.length > Number(profile.audit?.max_body_size || 262144)) {
    return denyGateway(app, reply, 413, "PAYLOAD_TOO_LARGE", {
      eventType: "gateway.payload_too_large",
      tenantId: tenant.id,
      connectionCode: profile.identity?.connection_code,
      suffix,
      ip: req.ip,
      metadata: { bytes: rawBody.length, max_body_size: Number(profile.audit?.max_body_size || 262144) }
    });
  }

  try {
    profile = await hydrateConnectionProfileSecrets(app, app.db, tenant.id, profile);
  } catch (error) {
    app.log.error({ event: "gateway_secret_hydrate_failed", tenantId: tenant.id, connectionCode: profile.identity?.connection_code, error: error.message });
    return denyGateway(app, reply, 500, "CONNECTION_SECRET_UNAVAILABLE", {
      eventType: "gateway.secret_unavailable",
      tenantId: tenant.id,
      connectionCode: profile.identity?.connection_code,
      suffix,
      ip: req.ip,
      metadata: { error: error.message }
    });
  }

  const verify = await verifyConnectionRequest(req, profile, rawBody);
  if (!verify.ok) {
    return denyGateway(app, reply, 401, verify.error, {
      eventType: "gateway.verification_failed",
      tenantId: tenant.id,
      connectionCode: profile.identity?.connection_code,
      suffix,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null,
      metadata: {
        mode: profile.verification?.mode || null,
        origin: req.headers.origin || null
      }
    });
  }

  let body = {};
  try {
    if (contentType.includes("json")) {
      body = parseJsonBody(req);
    }
  } catch {
    return denyGateway(app, reply, 400, "INVALID_JSON", {
      eventType: "gateway.invalid_json",
      tenantId: tenant.id,
      connectionCode: profile.identity?.connection_code,
      suffix,
      ip: req.ip
    });
  }

  const eventId = extractEventId(req, body, profile);
  if (!eventId) {
    return denyGateway(app, reply, 400, "IDEMPOTENCY_REQUIRED", {
      eventType: "gateway.idempotency_missing",
      tenantId: tenant.id,
      connectionCode: profile.identity?.connection_code,
      suffix,
      ip: req.ip,
      metadata: { mode: profile.idempotency?.event_id_location || null }
    });
  }

  const scope = profile.idempotency?.idempotency_scope || `gateway.${profile.identity.connection_code}`;
  const requestHash = buildRequestHash(rawBody);
  const idem = await ensureIdempotency(app.db, {
    tenantId: tenant.id,
    scope,
    key: eventId,
    requestHash
  });
  if (!idem.ok) {
    return denyGateway(app, reply, 409, idem.error, {
      eventType: "gateway.idempotency_rejected",
      tenantId: tenant.id,
      connectionCode: profile.identity?.connection_code,
      suffix,
      eventId,
      ip: req.ip,
      metadata: { scope, request_hash: requestHash }
    });
  }
  if (idem.replay) {
    await recordGatewaySecurityEvent(app, "gateway.idempotency_replay", {
      tenantId: tenant.id,
      connectionCode: profile.identity?.connection_code,
      suffix,
      eventId,
      outcome: "success",
      severity: "info",
      ip: req.ip,
      metadata: { scope }
    });
    return reply.send(idem.response || { ok: true, replay: true });
  }

  const safePayload = applyRedaction(
    {
      headers: req.headers,
      query: req.query,
      body,
      raw_body: profile.audit?.include_raw_body === true
        ? rawBody.toString("utf8")
        : `[REDACTED_RAW_BODY ${rawBody.length} bytes]`
    },
    profile.audit?.redaction_policy
  );

  const auditId = await insertGatewayAudit(app.db, {
    tenantId: tenant.id,
    recordType: profile.audit?.audit_record_type,
    title: `gateway.inbound.${profile.identity.connection_code}`,
    payload: safePayload,
    attrs: {
      connection_code: profile.identity.connection_code,
      channel: profile.routing?.channel,
      suffix,
      method: req.method,
      content_type: contentType,
      event_id: eventId,
      request_hash: requestHash,
      source_ip: req.ip,
      user_agent: req.headers["user-agent"] || null
    }
  });

  const response = { ok: true, accepted: true, intake_ref: auditId, event_id: eventId };
  await recordGatewaySecurityEvent(app, "gateway.intake_accepted", {
    tenantId: tenant.id,
    connectionCode: profile.identity?.connection_code,
    suffix,
    eventId,
    outcome: "success",
    severity: "info",
    ip: req.ip,
    userAgent: req.headers["user-agent"] || null,
    metadata: {
      channel: profile.routing?.channel,
      method: req.method,
      content_type: contentType,
      audit_id: auditId
    }
  });
  await finalizeIdempotency(app.db, {
    tenantId: tenant.id,
    scope,
    key: eventId,
    response,
    status: "ok"
  });

  return reply.send(response);
}

async function logGatewayDenied(app, payload) {
  try {
    await app.db.query(
      `
      INSERT INTO eip_core.info_record
        (tenant_id, record_type, payload)
      VALUES ($1, $2, $3::jsonb)
      `,
      [
        payload.tenantId,
        "gateway_handshake_denied",
        {
          reason: payload.reason,
          event_type: payload.eventType,
          template_code: payload.templateCode || null,
          object_ref: payload.objectRef || null,
          origin: payload.origin || null,
          ip: payload.ip || null,
          user_agent: payload.userAgent || null,
          attrs: payload.attrs || {}
        }
      ]
    );
  } catch (error) {
    app.log.warn({ event: "handshake_denied_log_failed", error: error.message });
  }
  await recordGatewaySecurityEvent(app, "gateway.handshake_denied", {
    tenantId: payload.tenantId,
    connectionCode: payload.connectionCode || null,
    suffix: payload.suffix || null,
    reason: payload.reason,
    outcome: "denied",
    severity: "warning",
    ip: payload.ip || null,
    userAgent: payload.userAgent || null,
    metadata: {
      event_type: payload.eventType,
      template_code: payload.templateCode || null,
      object_ref: payload.objectRef || null,
      origin: payload.origin || null,
      attrs: payload.attrs || {}
    }
  });
}

async function logHandshake(app, payload) {
  try {
    await app.db.query(
      `
      INSERT INTO eip_core.info_record
        (tenant_id, record_type, payload)
      VALUES ($1, $2, $3::jsonb)
      `,
      [
        payload.tenantId,
        "gateway_handshake",
        {
          event_type: payload.eventType,
          template_code: payload.templateCode || null,
          object_ref: payload.objectRef || null,
          origin: payload.origin || null,
          ip: payload.ip || null,
          user_agent: payload.userAgent || null,
          attrs: payload.attrs || {}
        }
      ]
    );
  } catch (error) {
    app.log.warn({ event: "handshake_log_failed", error: error.message });
  }
}

async function resolveMappingFromSurface(app, tenantId, templateCode) {
  if (!templateCode) return {};
  const surfaceRes = await app.db.query(
    `
    SELECT attrs
    FROM eip_core.ui_surface
    WHERE code = $1
      AND is_active = true
      AND is_published = true
      AND (tenant_id = $2 OR tenant_id IS NULL)
    ORDER BY (tenant_id IS NULL) ASC, version DESC, updated_at DESC
    LIMIT 1
    `,
    [templateCode, tenantId]
  );
  return surfaceRes.rows[0]?.attrs?.mapping || {};
}

export default async function publicGatewayRoutes(app) {
  registerRawBody(app);

  app.options("/gateway/*", async (req, reply) => {
    const origin = req.headers.origin;
    applyCors(reply, origin, req.headers["access-control-request-headers"]);
    return reply.code(204).send();
  });

  app.post(
    "/gateway/intake",
    {
      config: {
        rateLimit: INTAKE_RATE_LIMIT,
        cors: { origin: app.PUBLIC_ORIGINS, credentials: false }
      },
      bodyLimit: INTAKE_BODY_LIMIT,
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["source", "form", "payload"],
          properties: {
            tenant_code: { type: "string", maxLength: 64 },
            source: { type: "string", minLength: 2, maxLength: 64 },
            form: { type: "string", minLength: 2, maxLength: 64 },
            payload: { type: "object" },
            correlation_id: { type: "string", maxLength: 100 }
          }
        }
      }
    },
    async (req, reply) => {
      const body = req.body || {};
      const apiKey = extractApiKey(req);
      const resolved = await resolveTenantByApiKey(app, apiKey);
      if (!resolved) {
        return denyGateway(app, reply, 401, "INVALID_API_KEY", {
          eventType: "gateway.legacy_intake_invalid_api_key",
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null
        });
      }

      const headerCode = normalizeText(req.headers["x-tenant-code"]);
      const tenantCode = headerCode || normalizeText(body.tenant_code);

      if (tenantCode && normalizeText(tenantCode) !== normalizeText(resolved.tenant.code)) {
        return denyGateway(app, reply, 403, "TENANT_MISMATCH", {
          eventType: "gateway.legacy_intake_tenant_mismatch",
          tenantId: resolved.tenant.id,
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null,
          metadata: { requested_tenant_code: tenantCode }
        });
      }

      const tenant = resolved.tenant;

      const response = await handlePublicIntake(app, {
        tenantId: tenant.id,
        tenantCode: tenant.code,
        source: normalizeText(body.source),
        form: normalizeText(body.form),
        payload: body.payload || {},
        correlationId: normalizeText(body.correlation_id),
        req
      });

      return reply.send(response);
    }
  );

  app.all(
    "/gateway/intake/:suffix",
    { bodyLimit: INBOUND_BODY_LIMIT },
    async (req, reply) => {
      return handleInbound(app, req, reply, { suffix: req.params.suffix, channel: "public" });
    }
  );

  app.all(
    "/edi/gateway/webhook/:suffix",
    { bodyLimit: INBOUND_BODY_LIMIT },
    async (req, reply) => {
      return handleInbound(app, req, reply, { suffix: req.params.suffix, channel: "edi" });
    }
  );

  app.get(
    "/gateway/bootstrap",
    {
      config: { cors: false },
      bodyLimit: BOOTSTRAP_BODY_LIMIT
    },
    async (req, reply) => {
      const apiKey = extractApiKey(req);
      const resolved = await resolveTenantByApiKey(app, apiKey);
      if (!resolved) {
        return denyGateway(app, reply, 401, "INVALID_API_KEY", {
          eventType: "gateway.bootstrap_invalid_api_key",
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null
        });
      }

      const origin = req.headers.origin;
      const connectionCode = normalizeText(req.query?.connection_code || req.query?.connectionCode);
      const profiles = resolved.profiles;
      const selected = connectionCode
        ? profiles.find((item) => item.identity?.connection_code === connectionCode)
        : selectConnection(profiles, (item) => item.identity?.is_enabled && requiresInbound(item));

      if (!selected) {
        return denyGateway(app, reply, 404, "CONNECTION_NOT_FOUND", {
          eventType: "gateway.bootstrap_connection_not_found",
          tenantId: resolved.tenant.id,
          connectionCode,
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null
        });
      }
      if (!selected.identity?.is_enabled) {
        return denyGateway(app, reply, 403, "CONNECTION_DISABLED", {
          eventType: "gateway.bootstrap_connection_disabled",
          tenantId: resolved.tenant.id,
          connectionCode: selected.identity?.connection_code,
          suffix: selected.inbound?.inbound_path_suffix || null,
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null
        });
      }
      if (!connectionAllowsOrigin(selected, origin)) {
        await logGatewayDenied(app, {
          tenantId: resolved.tenant.id,
          connectionCode: selected.identity?.connection_code,
          suffix: selected.inbound?.inbound_path_suffix || null,
          eventType: "bootstrap",
          origin,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          reason: "ORIGIN_NOT_ALLOWED"
        });
        return reply.code(403).send({ ok: false, error: "ORIGIN_NOT_ALLOWED" });
      }

      if (!connectionAllowsIp(selected, req.ip)) {
        return denyGateway(app, reply, 403, "IP_NOT_ALLOWED", {
          eventType: "gateway.bootstrap_ip_rejected",
          tenantId: resolved.tenant.id,
          connectionCode: selected.identity?.connection_code,
          suffix: selected.inbound?.inbound_path_suffix || null,
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null
        });
      }

      applyCors(reply, origin);

      const templateCode = String(req.query?.template_code || req.query?.templateCode || "");
      const dictionary = await resolveMappingFromSurface(app, resolved.tenant.id, templateCode);

      await logHandshake(app, {
        tenantId: resolved.tenant.id,
        apiKeyId: resolved.key.id,
        eventType: "bootstrap",
        templateCode,
        origin,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        attrs: { query: req.query || {} }
      });

      return reply.send({
        ok: true,
        tenant: {
          id: resolved.tenant.id,
          code: resolved.tenant.code,
          name: resolved.tenant.name,
          attrs: resolved.tenant.attrs || {}
        },
        connection: {
          code: selected.identity?.connection_code,
          name: selected.identity?.connection_name,
          kind: selected.identity?.connection_kind,
          direction: selected.identity?.direction,
          environment: selected.identity?.environment
        },
        inbound_urls: computeInboundUrls(
          `${req.headers["x-forwarded-proto"] || req.protocol || "http"}://${req.headers.host}`,
          selected.inbound?.inbound_path_suffix
        ),
        dictionary
      });
    }
  );

  app.get(
    "/gateway/manifest/:templateCode/:objectId?",
    {
      config: { cors: false },
      bodyLimit: BOOTSTRAP_BODY_LIMIT
    },
    async (req, reply) => {
      const apiKey = extractApiKey(req);
      const resolved = await resolveTenantByApiKey(app, apiKey);
      if (!resolved) {
        return denyGateway(app, reply, 401, "INVALID_API_KEY", {
          eventType: "gateway.manifest_invalid_api_key",
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null
        });
      }

      const origin = req.headers.origin;
      const connectionCode = normalizeText(req.query?.connection_code || req.query?.connectionCode);
      const profiles = resolved.profiles;
      const selected = connectionCode
        ? profiles.find((item) => item.identity?.connection_code === connectionCode)
        : selectConnection(profiles, (item) => item.identity?.is_enabled && requiresInbound(item));

      if (!selected) {
        return denyGateway(app, reply, 404, "CONNECTION_NOT_FOUND", {
          eventType: "gateway.manifest_connection_not_found",
          tenantId: resolved.tenant.id,
          connectionCode,
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null
        });
      }
      if (!selected.identity?.is_enabled) {
        return denyGateway(app, reply, 403, "CONNECTION_DISABLED", {
          eventType: "gateway.manifest_connection_disabled",
          tenantId: resolved.tenant.id,
          connectionCode: selected.identity?.connection_code,
          suffix: selected.inbound?.inbound_path_suffix || null,
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null
        });
      }
      if (!connectionAllowsOrigin(selected, origin)) {
        await logGatewayDenied(app, {
          tenantId: resolved.tenant.id,
          connectionCode: selected.identity?.connection_code,
          suffix: selected.inbound?.inbound_path_suffix || null,
          eventType: "manifest",
          origin,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          reason: "ORIGIN_NOT_ALLOWED"
        });
        return reply.code(403).send({ ok: false, error: "ORIGIN_NOT_ALLOWED" });
      }

      if (!connectionAllowsIp(selected, req.ip)) {
        return denyGateway(app, reply, 403, "IP_NOT_ALLOWED", {
          eventType: "gateway.manifest_ip_rejected",
          tenantId: resolved.tenant.id,
          connectionCode: selected.identity?.connection_code,
          suffix: selected.inbound?.inbound_path_suffix || null,
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null
        });
      }

      applyCors(reply, origin);

      const templateCode = String(req.params.templateCode || "");
      const objectId = String(req.params.objectId || req.query?.object_id || req.query?.objectId || "");

      const surfaceRes = await app.db.query(
        `
        SELECT id, tenant_id, code, title, version, is_active, is_published, is_public, tree, attrs
        FROM eip_core.ui_surface
        WHERE code = $1
          AND is_active = true
          AND is_published = true
          AND (tenant_id = $2 OR tenant_id IS NULL)
        ORDER BY (tenant_id IS NULL) ASC, version DESC, updated_at DESC
        LIMIT 1
        `,
        [templateCode, resolved.tenant.id]
      );

      if (surfaceRes.rowCount === 0) {
        return denyGateway(app, reply, 404, "TEMPLATE_NOT_FOUND", {
          eventType: "gateway.manifest_template_not_found",
          tenantId: resolved.tenant.id,
          connectionCode: selected.identity?.connection_code,
          suffix: selected.inbound?.inbound_path_suffix || null,
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null,
          metadata: { template_code: templateCode }
        });
      }

      let serviceObject = null;
      if (objectId) {
        if (isUuid(objectId)) {
          const soRes = await app.db.query(
            `
            SELECT id, tenant_id, object_type, status, code, title, attrs, created_at, updated_at
            FROM eip_core.service_object
            WHERE tenant_id = $1
              AND id = $2::uuid
            LIMIT 1
            `,
            [resolved.tenant.id, objectId]
          );
          serviceObject = soRes.rows[0] || null;
        } else {
          const soRes = await app.db.query(
            `
            SELECT id, tenant_id, object_type, status, code, title, attrs, created_at, updated_at
            FROM eip_core.service_object
            WHERE tenant_id = $1
              AND code = $2
            LIMIT 1
            `,
            [resolved.tenant.id, objectId]
          );
          serviceObject = soRes.rows[0] || null;
        }
      }

      const dictionary = surfaceRes.rows[0]?.attrs?.mapping || {};
      const surface = surfaceRes.rows[0];

      await logHandshake(app, {
        tenantId: resolved.tenant.id,
        apiKeyId: resolved.key.id,
        eventType: "manifest",
        templateCode,
        objectRef: objectId || null,
        origin,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        attrs: { query: req.query || {} }
      });

      return reply.send({
        ok: true,
        tenant: {
          id: resolved.tenant.id,
          code: resolved.tenant.code,
          name: resolved.tenant.name,
          attrs: resolved.tenant.attrs || {}
        },
        connection: {
          code: selected.identity?.connection_code,
          name: selected.identity?.connection_name,
          kind: selected.identity?.connection_kind,
          direction: selected.identity?.direction,
          environment: selected.identity?.environment
        },
        dictionary,
        surface: {
          id: surface.id,
          code: surface.code,
          title: surface.title,
          version: surface.version,
          tree: surface.tree,
          attrs: surface.attrs || {}
        },
        data: {
          object: serviceObject
        }
      });
    }
  );
}
