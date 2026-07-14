// services/api/src/routes/gateway.js
import crypto from "node:crypto";
import { buildBootstrapPayload } from "../services/gateway/bootstrap.js";
import { sha256Hex } from "../auth/crypto.js";
import { hasPermission } from "../auth/perm.js";
import { fetchWithTimeout, buildOutboundAuth, assertOutboundUrlAllowed } from "../services/gateway/outbound.js";
import { persistConnectionTestHealth } from "../services/gateway/connectionHealth.js";
import {
  extractProfiles,
  hasSecretConfigured,
  normalizeProfile,
  maskSecrets,
  mergeSecrets,
  validateProfiles
} from "../services/gateway/connectionProfile.js";
import {
  SECRET_FIELD_SPECS,
  clearProfileSecretRefs,
  hydrateConnectionProfileSecrets,
  revokeConnectionSecrets,
  vaultConnectionProfileSecrets
} from "../services/gateway/secretStore.js";
import { resolveEipSurfaceAccess } from "../lib/surfaceAccess.js";
import { emitSecurityEvent } from "../lib/securityAudit.js";
import { requirePrivilegedStepUp as evaluatePrivilegedStepUp } from "../auth/privilegedStepUp.js";
import { buildRenderedDomScannerDiagnostic } from "../services/storefront/renderedDomScanner.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function buildApiKey() {
  return crypto.randomBytes(32).toString("base64url");
}

function connectionDiagnostic(profile, mappingProfile, scannerDiagnostic) {
  const origins = Array.isArray(profile?.inbound?.origin_allowlist)
    ? profile.inbound.origin_allowlist
    : [];
  const verificationMode = normalizeText(profile?.verification?.mode || "none");
  const apiKeySaved = verificationMode === "api_key"
    ? hasSecretConfigured(profile?.verification?.api_key, "secret")
    : null;
  return {
    connection_code: normalizeText(profile?.identity?.connection_code) || null,
    cors_ready:
      origins.length > 0 &&
      (profile?.identity?.environment === "sandbox" || !origins.includes("*")),
    verification_mode: verificationMode,
    api_key_saved: apiKeySaved,
    rendered_scan_ready: scannerDiagnostic.browser_found === true,
    loader_enabled: profile?.public_storefront?.loader_enabled === true,
    public_api_enabled: profile?.public_storefront?.public_api_enabled !== false,
    scan_allowed: profile?.public_storefront?.scan_allowed !== false,
    last_scan_result: mappingProfile?.last_scan_result || null
  };
}

function buildInboundUrl(baseUrl, suffix, channel) {
  const root = String(baseUrl || "").replace(/\/$/, "");
  if (channel === "edi") {
    return `${root}/api/edi/gateway/webhook/${suffix}`;
  }
  return `${root}/api/public/gateway/intake/${suffix}`;
}

function escapeHtmlAttribute(value = "") {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function requestPublicOrigin(req) {
  const forwardedHost = normalizeText(req?.headers?.["x-forwarded-host"]).split(",")[0].trim();
  const host = forwardedHost || normalizeText(req?.headers?.host);
  const forwardedProto = normalizeText(req?.headers?.["x-forwarded-proto"]).split(",")[0].trim();
  const proto = forwardedProto || req?.protocol || "https";
  return `${proto}://${host}`;
}

function buildAdminStorefrontConnectorPatch(req, profile) {
  const origin = requestPublicOrigin(req);
  const connection = normalizeText(profile?.inbound?.inbound_path_suffix);
  const loaderUrl = `${origin}/api/public/commerce-loader/v1.js`;
  const refreshMs = 30000;
  const scriptTag = connection
    ? `<script async src="${escapeHtmlAttribute(loaderUrl)}" data-connection="${escapeHtmlAttribute(connection)}" data-api-base="${escapeHtmlAttribute(origin)}" data-refresh-ms="${refreshMs}"></script>`
    : "";
  return {
    ok: true,
    connector: "eip_storefront_connector",
    connector_version: "loader_polling_v1",
    connection,
    connection_code: normalizeText(profile?.identity?.connection_code),
    loader_enabled: profile?.public_storefront?.loader_enabled === true,
    public_api_enabled: profile?.public_storefront?.public_api_enabled !== false,
    public_api_base: origin,
    loader_url: loaderUrl,
    script_tag: scriptTag,
    install_location: "before </body> or in the connected website app shell",
    refresh: {
      mode: "manifest_version_poll",
      interval_ms: refreshMs,
      manifest_endpoint: connection ? `/api/public/commerce/${encodeURIComponent(connection)}/storefront/manifest?integration=loader` : null
    },
    receiver_contract: {
      manual_refresh_event: "document.dispatchEvent(new Event('eip:storefront:refresh'))",
      post_message: { type: "eip-storefront-refresh", connection },
      applied_event: "eip:storefront:applied",
      browser_api: "window.EIPStorefrontConnector.refresh()"
    },
    requirements: {
      mapping_required: true,
      publish_required: true,
      loader_must_be_enabled_on_connection_profile: true,
      origin_should_be_allowlisted: true,
      public_scopes_required: ["storefront.mapping.read", "storefront.content.read"]
    }
  };
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

  req.session = s.session;
  req.realm = s.session.realm;
  return s.session;
}

function getNested(obj, pathList) {
  return pathList.reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), obj);
}

function collectSubmittedSecretUpdates(profiles) {
  const updates = [];
  for (const profile of Array.isArray(profiles) ? profiles : []) {
    const connectionCode = normalizeText(profile?.identity?.connection_code);
    if (!connectionCode) continue;
    for (const spec of SECRET_FIELD_SPECS) {
      const target = getNested(profile, spec.path);
      if (target && typeof target === "object" && normalizeText(target[spec.key])) {
        updates.push({ connection_code: connectionCode, secret_kind: spec.kind });
      }
    }
  }
  return updates;
}

async function requirePrivilegedStepUp(app, req, reply) {
  const step = await evaluatePrivilegedStepUp(app, req);
  if (!step.ok) {
    reply.code(step.status).send({ ok: false, error: step.error });
    return null;
  }
  return step;
}

async function resolveConnectionControlScope(app, session) {
  const access = await resolveEipSurfaceAccess(app, session);
  return {
    ownerAdmin: access.is_owner_admin_session === true,
    defaultSurface: access.default_surface,
    allowedSurfaces: access.allowed_surfaces || []
  };
}

async function requireConnectionTargetAccess(app, session, targetTenantId, reply, req = null) {
  if (String(session.tenant_id) === String(targetTenantId)) {
    return { ok: true, ownerAdmin: false };
  }

  const scope = await resolveConnectionControlScope(app, session);
  if (scope.ownerAdmin) return { ok: true, ownerAdmin: true };

  await emitSecurityEvent(app, "tenant.connection_scope_forbidden", {
    category: "tenant_isolation",
    source: "gateway_admin",
    severity: "warning",
    outcome: "denied",
    actorTenantId: session.tenant_id,
    actorIdentityId: session.identity_id,
    targetTenantId,
    reason: "TENANT_SCOPE_FORBIDDEN",
    ip: req?.ip || null,
    userAgent: req?.headers?.["user-agent"] || null
  });
  reply.code(403).send({ ok: false, error: "TENANT_SCOPE_FORBIDDEN" });
  return null;
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

    const scope = await resolveConnectionControlScope(app, s.session);
    const params = scope.ownerAdmin ? [] : [s.session.tenant_id];
    const tenantFilter = scope.ownerAdmin ? "" : "WHERE t.id = $1::uuid";

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
      ${tenantFilter}
      GROUP BY t.id
      ORDER BY t.created_at DESC
      `,
      params
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
    const target = await requireConnectionTargetAccess(app, s.session, tenantId, reply, req);
    if (!target) return;

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
    let structureRes = { rows: [] };
    try {
      structureRes = await app.db.query(
        `
        SELECT attrs
        FROM eip_core.service_object
        WHERE tenant_id = $1::uuid
          AND object_type = 'storefront_structure'
          AND attrs->>'scope' = 'auto_scan'
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
        `,
        [tenantId]
      );
    } catch (error) {
      app.log.warn({
        event: "storefront_connection_diagnostic_unavailable",
        tenant_id: tenantId,
        error: error?.message || String(error)
      });
    }
    const structureAttrs =
      structureRes?.rows?.[0]?.attrs && typeof structureRes.rows[0].attrs === "object"
        ? structureRes.rows[0].attrs
        : {};
    const mappingProfiles = Array.isArray(structureAttrs.mapping_profiles)
      ? structureAttrs.mapping_profiles
      : [];
    const scannerDiagnostic = buildRenderedDomScannerDiagnostic(app.config);
    const connectionDiagnostics = connections.map((profile) => {
      const mappingProfile = mappingProfiles.find(
        (item) => normalizeText(item?.connection_code) === normalizeText(profile?.identity?.connection_code)
      ) || (
        normalizeText(structureAttrs.mapping_profile?.connection_code) === normalizeText(profile?.identity?.connection_code)
          ? structureAttrs.mapping_profile
          : null
      );
      return connectionDiagnostic(profile, mappingProfile, scannerDiagnostic);
    });

    return reply.send({
      ok: true,
      tenant,
      connections: connections.map(maskSecrets),
      api_keys: keysRes.rows,
      logs: logRes.rows,
      health: healthRes.rows[0] || {},
      storefront_diagnostics: {
        rendered_scanner: scannerDiagnostic,
        connections: connectionDiagnostics
      }
    });
  });

  app.get("/gateway/connections/:tenantId/profile/:connectionCode/storefront/connector-patch", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.read");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const tenantId = req.params.tenantId;
    const target = await requireConnectionTargetAccess(app, s.session, tenantId, reply, req);
    if (!target) return;

    const tenantRes = await app.db.query(
      `
      SELECT attrs
      FROM eip_core.tenant
      WHERE id = $1::uuid
      `,
      [tenantId]
    );
    if (tenantRes.rowCount === 0) return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });

    const connectionCode = normalizeText(req.params.connectionCode);
    const profiles = extractProfiles(tenantRes.rows[0]?.attrs || {});
    const profile = profiles.find((item) => normalizeText(item?.identity?.connection_code) === connectionCode);
    if (!profile) return reply.code(404).send({ ok: false, error: "CONNECTION_NOT_FOUND" });
    if (!["website", "ecommerce"].includes(profile.identity?.connection_kind)) {
      return reply.code(400).send({ ok: false, error: "CONNECTOR_PATCH_REQUIRES_WEBSITE_CONNECTION" });
    }
    if (!profile.inbound?.inbound_path_suffix) {
      return reply.code(400).send({ ok: false, error: "INBOUND_SUFFIX_REQUIRED" });
    }

    return reply.send(buildAdminStorefrontConnectorPatch(req, profile));
  });

  app.post("/gateway/connections/:tenantId/profile", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await requirePrivilegedStepUp(app, req, reply);
    if (!step) return;

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.write");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const tenantId = req.params.tenantId;
    const target = await requireConnectionTargetAccess(app, s.session, tenantId, reply, req);
    if (!target) return;

    const incomingConnections = Array.isArray(req.body?.connections) ? req.body.connections : [];
    const submittedSecretUpdates = collectSubmittedSecretUpdates(incomingConnections);

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      const existingRes = await client.query(
        "SELECT attrs FROM eip_core.tenant WHERE id = $1::uuid FOR UPDATE",
        [tenantId]
      );
      if (existingRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
      }
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
        await client.query("ROLLBACK");
        return reply.code(400).send({ ok: false, error: "VALIDATION_ERROR", details: errors });
      }

      for (const profile of normalizedConnections) {
        const suffix = profile.inbound?.inbound_path_suffix;
        if (!suffix) continue;
        const dup = await client.query(
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
          await client.query("ROLLBACK");
          await emitSecurityEvent(app, "connection.duplicate_suffix_rejected", {
            category: "connection",
            source: "gateway_admin",
            severity: "warning",
            outcome: "rejected",
            actorTenantId: s.session.tenant_id,
            actorIdentityId: s.session.identity_id,
            targetTenantId: tenantId,
            suffix,
            reason: "DUPLICATE_SUFFIX",
            ip: req.ip,
            userAgent: req.headers["user-agent"] || null
          });
          return reply.code(400).send({ ok: false, error: "DUPLICATE_SUFFIX", details: [suffix] });
        }
      }

      const vaultedConnections = await vaultConnectionProfileSecrets(
        app,
        client,
        tenantId,
        normalizedConnections,
        s.session.identity_id
      );

      const r = await client.query(
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
        [tenantId, JSON.stringify(vaultedConnections)]
      );

      await client.query("COMMIT");
      const updatedTenant = r.rows[0];
      const updatedConnections = extractProfiles(updatedTenant?.attrs);

      await emitSecurityEvent(app, "connection.profile_saved", {
        category: "connection",
        source: "gateway_admin",
        severity: "info",
        outcome: "success",
        actorTenantId: s.session.tenant_id,
        actorIdentityId: s.session.identity_id,
        targetTenantId: tenantId,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
        metadata: {
          connection_count: updatedConnections.length,
          connection_codes: updatedConnections.map((profile) => profile.identity?.connection_code).filter(Boolean)
        }
      });
      if (submittedSecretUpdates.length) {
        await emitSecurityEvent(app, "connection.secret_rotated", {
          category: "connection",
          source: "gateway_admin",
          severity: "info",
          outcome: "success",
          actorTenantId: s.session.tenant_id,
          actorIdentityId: s.session.identity_id,
          targetTenantId: tenantId,
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null,
          metadata: {
            rotated: submittedSecretUpdates
          }
        });
      }

      return reply.send({ ok: true, connections: updatedConnections.map(maskSecrets) });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      app.log.error({ event: "connection_profile_save_failed", tenantId, error: error.message });
      await emitSecurityEvent(app, "connection.profile_save_failed", {
        category: "connection",
        source: "gateway_admin",
        severity: "error",
        outcome: "error",
        actorTenantId: s.session.tenant_id,
        actorIdentityId: s.session.identity_id,
        targetTenantId: tenantId,
        reason: "CONNECTION_PROFILE_SAVE_FAILED",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
        metadata: { error: error.message }
      });
      return reply.code(500).send({ ok: false, error: "CONNECTION_PROFILE_SAVE_FAILED" });
    } finally {
      client.release();
    }
  });

  app.post("/gateway/connections/:tenantId/profile/:connectionCode/secrets/revoke", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await requirePrivilegedStepUp(app, req, reply);
    if (!step) return;

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.write");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const tenantId = req.params.tenantId;
    const target = await requireConnectionTargetAccess(app, s.session, tenantId, reply, req);
    if (!target) return;

    const connectionCode = normalizeText(req.params.connectionCode);
    const requestedKinds = Array.isArray(req.body?.secret_kinds)
      ? req.body.secret_kinds.map(normalizeText).filter(Boolean)
      : normalizeText(req.body?.secret_kind)
        ? [normalizeText(req.body.secret_kind)]
        : SECRET_FIELD_SPECS.map((spec) => spec.kind);
    const validKinds = new Set(SECRET_FIELD_SPECS.map((spec) => spec.kind));
    if (!connectionCode || requestedKinds.some((kind) => !validKinds.has(kind))) {
      return reply.code(400).send({ ok: false, error: "INVALID_SECRET_KIND" });
    }

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const tenantRes = await client.query(
        "SELECT attrs FROM eip_core.tenant WHERE id = $1::uuid FOR UPDATE",
        [tenantId]
      );
      if (tenantRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
      }
      const profiles = extractProfiles(tenantRes.rows[0].attrs || {});
      if (!profiles.some((profile) => profile.identity?.connection_code === connectionCode)) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "CONNECTION_NOT_FOUND" });
      }

      const revoked = await revokeConnectionSecrets(client, {
        tenantId,
        connectionCode,
        kinds: requestedKinds,
        actorIdentityId: s.session.identity_id
      });
      const nextProfiles = clearProfileSecretRefs(profiles, connectionCode, requestedKinds);
      const r = await client.query(
        `
        UPDATE eip_core.tenant
        SET attrs = jsonb_set(COALESCE(attrs,'{}'::jsonb), '{connection_profiles}', $2::jsonb, true),
            updated_at = now()
        WHERE id = $1::uuid
        RETURNING attrs
        `,
        [tenantId, JSON.stringify(nextProfiles)]
      );

      await client.query("COMMIT");
      await emitSecurityEvent(app, "connection.secret_revoked", {
        category: "connection",
        source: "gateway_admin",
        severity: "warning",
        outcome: "success",
        actorTenantId: s.session.tenant_id,
        actorIdentityId: s.session.identity_id,
        targetTenantId: tenantId,
        connectionCode,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
        metadata: {
          secret_kinds: requestedKinds,
          revoked_count: revoked.length
        }
      });
      return reply.send({
        ok: true,
        revoked: revoked.map((row) => ({
          id: row.id,
          secret_kind: row.secret_kind,
          version: row.version,
          revoked_at: row.revoked_at
        })),
        connections: extractProfiles(r.rows[0]?.attrs || {}).map(maskSecrets)
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      app.log.error({ event: "connection_secret_revoke_failed", tenantId, connectionCode, error: error.message });
      await emitSecurityEvent(app, "connection.secret_revoke_failed", {
        category: "connection",
        source: "gateway_admin",
        severity: "error",
        outcome: "error",
        actorTenantId: s.session.tenant_id,
        actorIdentityId: s.session.identity_id,
        targetTenantId: tenantId,
        connectionCode,
        reason: "CONNECTION_SECRET_REVOKE_FAILED",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
        metadata: { error: error.message }
      });
      return reply.code(500).send({ ok: false, error: "CONNECTION_SECRET_REVOKE_FAILED" });
    } finally {
      client.release();
    }
  });

  app.post("/gateway/connections/:tenantId/test/inbound", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await requirePrivilegedStepUp(app, req, reply);
    if (!step) return;

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.write");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const tenantId = req.params.tenantId;
    const target = await requireConnectionTargetAccess(app, s.session, tenantId, reply, req);
    if (!target) return;

    const connectionCode = normalizeText(req.body?.connection_code);
    if (!connectionCode) return reply.code(400).send({ ok: false, error: "MISSING_CONNECTION_CODE" });

    const tenantRes = await app.db.query(
      "SELECT attrs FROM eip_core.tenant WHERE id = $1::uuid",
      [tenantId]
    );
    if (tenantRes.rowCount === 0) return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
    const profiles = extractProfiles(tenantRes.rows[0].attrs || {});
    let profile = profiles.find((item) => item.identity?.connection_code === connectionCode);
    if (!profile) return reply.code(404).send({ ok: false, error: "CONNECTION_NOT_FOUND" });
    profile = await hydrateConnectionProfileSecrets(app, app.db, tenantId, profile);

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
        const nowSec = Math.floor(Date.now() / 1000);
        const token = buildJwtHs256(
          {
            iss: profile.verification.oauth2_jwt?.issuer,
            aud: profile.verification.oauth2_jwt?.audience,
            iat: nowSec,
            exp: nowSec + 300
          },
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
      const response = await fetchWithTimeout(url, {
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

    const step = await requirePrivilegedStepUp(app, req, reply);
    if (!step) return;

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.write");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const tenantId = req.params.tenantId;
    const target = await requireConnectionTargetAccess(app, s.session, tenantId, reply, req);
    if (!target) return;

    const connectionCode = normalizeText(req.body?.connection_code);
    if (!connectionCode) return reply.code(400).send({ ok: false, error: "MISSING_CONNECTION_CODE" });

    const tenantRes = await app.db.query(
      "SELECT attrs FROM eip_core.tenant WHERE id = $1::uuid",
      [tenantId]
    );
    if (tenantRes.rowCount === 0) return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
    const profiles = extractProfiles(tenantRes.rows[0].attrs || {});
    let profile = profiles.find((item) => item.identity?.connection_code === connectionCode);
    if (!profile) return reply.code(404).send({ ok: false, error: "CONNECTION_NOT_FOUND" });
    profile = await hydrateConnectionProfileSecrets(app, app.db, tenantId, profile);

    const recordHealth = async (ok, error = "") => maskSecrets(await persistConnectionTestHealth(
      app.db,
      tenantId,
      connectionCode,
      {
        ok,
        mode: profile.identity?.environment,
        error
      }
    ));

    if (!profile.outbound?.base_url) {
      const connection = await recordHealth(false, "OUTBOUND_NOT_CONFIGURED");
      return reply.code(400).send({ ok: false, error: "OUTBOUND_NOT_CONFIGURED", connection });
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
      const connection = await recordHealth(false, err.message);
      return reply.code(400).send({ ok: false, error: err.message, connection });
    }

    const providerCode = normalizeText(
      profile.routing?.provider_code ||
      profile.routing?.protocol ||
      profile.identity?.connection_kind
    ).toLowerCase().replace(/[-.\s]+/g, "_");
    if (providerCode === "paypal" && profile.outbound?.auth_mode === "oauth2_client_credentials") {
      const connection = await recordHealth(true);
      return reply.send({
        ok: true,
        status: 200,
        response: "PayPal OAuth token acquired successfully.",
        connection
      });
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
      try {
        await assertOutboundUrlAllowed(testUrl, profile, { purpose: "gateway_outbound_test" });
      } catch (err) {
        const connection = await recordHealth(false, err.message);
        return reply.code(400).send({ ok: false, error: err.message, connection });
      }
      const response = await fetchWithTimeout(testUrl, {
        method,
        headers,
        body: method === "GET" ? undefined : JSON.stringify({ test: true, at: new Date().toISOString() }),
        timeout_ms: profile.outbound.timeout_ms || 8000
      });

      const text = await response.text();
      const connection = await recordHealth(response.ok, response.ok ? "" : `HTTP_${response.status}`);
      return reply.send({
        ok: response.ok,
        status: response.status,
        response: text,
        connection
      });
    } catch (err) {
      const detail = err?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR";
      const connection = await recordHealth(false, detail);
      return reply.code(502).send({
        ok: false,
        error: "OUTBOUND_TEST_FAILED",
        detail,
        connection
      });
    }
  });

  app.post("/gateway/connections/:tenantId/api-keys", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await requirePrivilegedStepUp(app, req, reply);
    if (!step) return;

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.api_key");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const tenantId = req.params.tenantId;
    const target = await requireConnectionTargetAccess(app, s.session, tenantId, reply, req);
    if (!target) return;

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
        ($1::uuid, $2, $3, true, $4, '{}'::jsonb,
         jsonb_build_object(
           'created_by', $5::uuid,
           'rotated_by', $5::uuid,
           'last_rotated_at', now(),
           'fingerprint', $6,
           'status', 'active'
         ))
      RETURNING id, label, is_active, expires_at, created_at
      `,
      [tenantId, keyHash, label, expiresAt, s.session.identity_id, keyHash.slice(0, 12)]
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

    await emitSecurityEvent(app, "connection.api_key_created", {
      category: "connection",
      source: "gateway_admin",
      severity: "warning",
      outcome: "success",
      actorTenantId: s.session.tenant_id,
      actorIdentityId: s.session.identity_id,
      targetTenantId: tenantId,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null,
      metadata: {
        key_id: r.rows[0].id,
        label,
        set_primary: setPrimary,
        expires_at: expiresAt.toISOString()
      }
    });

    return reply.send({ ok: true, api_key: r.rows[0], raw_key: rawKey });
  });

  app.post("/gateway/connections/:tenantId/api-keys/:keyId/revoke", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await requirePrivilegedStepUp(app, req, reply);
    if (!step) return;

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.api_key");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const tenantId = req.params.tenantId;
    const target = await requireConnectionTargetAccess(app, s.session, tenantId, reply, req);
    if (!target) return;

    const keyId = req.params.keyId;

    await app.db.query(
      `
      UPDATE eip_auth.auth_api_key
      SET is_active = false,
          expires_at = now(),
          attrs = COALESCE(attrs,'{}'::jsonb) || jsonb_build_object(
            'revoked_by', $3::uuid,
            'revoked_at', now(),
            'status', 'revoked'
          ),
          updated_at = now()
      WHERE tenant_id = $1::uuid AND id = $2::uuid
      `,
      [tenantId, keyId, s.session.identity_id]
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

    await emitSecurityEvent(app, "connection.api_key_revoked", {
      category: "connection",
      source: "gateway_admin",
      severity: "warning",
      outcome: "success",
      actorTenantId: s.session.tenant_id,
      actorIdentityId: s.session.identity_id,
      targetTenantId: tenantId,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null,
      metadata: {
        key_id: keyId
      }
    });

    return reply.send({ ok: true });
  });

  app.post("/gateway/connections/:tenantId/api-keys/:keyId/rotate", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await requirePrivilegedStepUp(app, req, reply);
    if (!step) return;

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.connection.api_key");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const tenantId = req.params.tenantId;
    const target = await requireConnectionTargetAccess(app, s.session, tenantId, reply, req);
    if (!target) return;

    const keyId = req.params.keyId;
    const label = normalizeText(req.body?.label || "plug-play");

    await app.db.query(
      `
      UPDATE eip_auth.auth_api_key
      SET is_active = false,
          expires_at = now(),
          attrs = COALESCE(attrs,'{}'::jsonb) || jsonb_build_object(
            'rotated_by', $3::uuid,
            'rotated_at', now(),
            'status', 'superseded'
          ),
          updated_at = now()
      WHERE tenant_id = $1::uuid AND id = $2::uuid
      `,
      [tenantId, keyId, s.session.identity_id]
    );

    const rawKey = buildApiKey();
    const keyHash = sha256Hex(`${rawKey}:${app.config.API_KEY_PEPPER}`);
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const r = await app.db.query(
      `
      INSERT INTO eip_auth.auth_api_key
        (tenant_id, key_hash, label, is_active, expires_at, scopes, attrs)
      VALUES
        ($1::uuid, $2, $3, true, $4, '{}'::jsonb,
         jsonb_build_object(
           'rotated_from', $5::uuid,
           'rotated_by', $6::uuid,
           'last_rotated_at', now(),
           'fingerprint', $7,
           'status', 'active'
         ))
      RETURNING id, label, is_active, expires_at, created_at
      `,
      [tenantId, keyHash, label, expiresAt, keyId, s.session.identity_id, keyHash.slice(0, 12)]
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

    await emitSecurityEvent(app, "connection.api_key_rotated", {
      category: "connection",
      source: "gateway_admin",
      severity: "warning",
      outcome: "success",
      actorTenantId: s.session.tenant_id,
      actorIdentityId: s.session.identity_id,
      targetTenantId: tenantId,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null,
      metadata: {
        rotated_from_key_id: keyId,
        new_key_id: r.rows[0].id,
        label,
        expires_at: expiresAt.toISOString()
      }
    });

    return reply.send({ ok: true, api_key: r.rows[0], raw_key: rawKey });
  });
}
