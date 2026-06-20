import Fastify from "fastify";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import env from "@fastify/env";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import staticPlugin from "@fastify/static";
import multipart from "@fastify/multipart";
import { LRUCache } from "lru-cache";

import dbPlugin from "./plugins/db.js";
import { envSchema, parseRequiredAgreements } from "./config.js";
import { sessionTouchIntervalMs } from "./auth/sessionPolicy.js";

import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import authElectronRoutes from "./routes/auth_electron.js";
import authzRoutes from "./routes/authz.js";
import socketManifestRoutes from "./routes/socket/manifest.js";
import debugRoutes from "./routes/_debug.js";
import ediRoutes from "./routes/edi.js";
import tenantRequestsPublic from "./routes/tenant_requests_public.js";
import tenantRequestsAdmin from "./routes/tenant_requests_admin.js";
import tenantAdminAccessRoutes from "./routes/tenant_admin_access.js";
import adminMonitoringRoutes from "./routes/admin_monitoring.js";
import adminDbExplorerRoutes from "./routes/admin_db_explorer.js";
import adminPortfolioRoutes from "./routes/admin_portfolio.js";
import adminTemplateCloneRoutes from "./routes/admin_template_clone.js";
import adminAccessRoutes from "./routes/admin_access.js";
import bootstrapRoutes from "./routes/bootstrap.js";
import coreProcessRoutes from "./routes/process/core_process.js";
import crmRoutes from "./routes/crm.js";
import commerceOrdersRoutes from "./routes/commerce_orders.js";
import inventoryRoutes from "./routes/inventory.js";
import procurementRoutes from "./routes/procurement.js";
import ecomRoutes from "./routes/ecom.js";
import policiesConditionsRoutes from "./routes/policies_conditions.js";
import entitiesRoutes from "./routes/entities.js";
import gatewayRoutes from "./routes/gateway.js";
import publicCommercePreflightRoutes from "./routes/public_commerce_preflight.js";
import publicCommerceRoutes from "./routes/public_commerce.js";
import publicGatewayRoutes from "./routes/public_gateway.js";
import ediGatewayRoutes from "./routes/edi_gateway.js";
import privacyRoutes from "./routes/privacy.js";
import uiSurfaceRoutes from "./routes/ui_surface.js";

import { sha256Hex, timingSafeEqual } from "./auth/crypto.js";
import { evaluateStepUp } from "./auth/sessionPolicy.js";
import { getAuthCookie } from "./lib/authCookies.js";
import { resolveEipSurfaceAccess } from "./lib/surfaceAccess.js";
import { auditSecurityEvent } from "./lib/securityAudit.js";
import { advanceInstance, createInstance, findActiveInstance, updateTaskStatus } from "./core/core_process_engine.js";
import { verifyAssetToken } from "./services/assets/signing.js";
import { sessionCanAccessAssetTenant } from "./services/assets/access.js";
import { inspectUploadStorage } from "./services/assets/root.js";
import { DEFAULT_MAX_UPLOAD_BYTES } from "./lib/uploadSecurity.js";
import { syncAllTenantMarketplaceFx } from "./services/fx/marketFxSync.js";
import { buildRenderedDomScannerDiagnostic } from "./services/storefront/renderedDomScanner.js";

const DEFAULT_BODY_LIMIT = 1024 * 1024; // 1 MiB
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function originFromHeader(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

// Tenant validation cache (LRU: max 100 entries, 5 min TTL)
const tenantCache = new LRUCache({
  max: 100,
  ttl: 5 * 60 * 1000, // 5 minutes
});

async function buildServer() {
  const app = Fastify({ logger: true, bodyLimit: DEFAULT_BODY_LIMIT });

  // ---- env (must be first) ----
  await app.register(env, {
    schema: envSchema,
    dotenv: { path: path.join(__dirname, "../../../.env") }
  });
  app.log.info({
    event: "storefront_rendered_dom_scanner_diagnostic",
    ...buildRenderedDomScannerDiagnostic(app.config)
  });

  const requiredAgreements = parseRequiredAgreements(
    app.config.REQUIRED_TENANT_AGREEMENTS,
    app.config.NODE_ENV
  );
  app.decorate("REQUIRED_TENANT_AGREEMENTS", requiredAgreements);
  // Core process engine helpers (shared across route modules).
  app.decorate("coreProcess", { findActiveInstance, advanceInstance, updateTaskStatus, createInstance });

  // ---- db (needed by decorators + routes) ----
  await app.register(dbPlugin);

  // ---- cookies (needed by session auth) ----
  await app.register(cookie, {
    secret: app.config.COOKIE_SECRET,
    hook: "onRequest",
  });

  // ---- security + limits ----
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false, // Enable when ready for CORP
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
  });

  // ---- CORS ----
  const parseOrigins = (value, label) => {
    const origins = String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (origins.length === 0) {
      throw new Error(`${label}_EMPTY`);
    }
    if (origins.includes("*")) {
      throw new Error(`${label}_WILDCARD`);
    }
    return origins;
  };

  const eipOrigins = parseOrigins(app.config.CORS_ORIGIN, "CORS_ORIGIN");
  const publicOrigins = parseOrigins(
    app.config.CORS_ORIGIN_PUBLIC || app.config.CORS_ORIGIN,
    "CORS_ORIGIN_PUBLIC"
  );

  app.decorate("EIP_ORIGINS", eipOrigins);
  app.decorate("PUBLIC_ORIGINS", publicOrigins);

  await app.register(cors, {
    origin: eipOrigins,
    credentials: true,
  });

  // Browser state-changing EIP requests must come from an expected dashboard origin.
  app.addHook("onRequest", async (req, reply) => {
    const method = String(req.method || "GET").toUpperCase();
    const url = String(req.url || "");
    if (!STATE_CHANGING_METHODS.has(method) || !url.startsWith("/api/eip/")) return;

    const origin = originFromHeader(req.headers.origin);
    const refererOrigin = originFromHeader(req.headers.referer);
    const requestOrigin = origin || refererOrigin;
    const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
    const fetchMode = String(req.headers["sec-fetch-mode"] || "").toLowerCase();
    const allowed = requestOrigin && app.EIP_ORIGINS.includes(requestOrigin);
    const requireOrigin = app.config.NODE_ENV === "production" || app.config.EIP_ORIGIN_REQUIRED === true;

    if (origin && !app.EIP_ORIGINS.includes(origin)) {
      app.log.warn({ event: "eip_origin_rejected", origin, path: url, ip: req.ip });
      return reply.code(403).send({ ok: false, error: "ORIGIN_NOT_ALLOWED" });
    }
    if (!origin && refererOrigin && !app.EIP_ORIGINS.includes(refererOrigin)) {
      app.log.warn({ event: "eip_referer_rejected", refererOrigin, path: url, ip: req.ip });
      return reply.code(403).send({ ok: false, error: "ORIGIN_NOT_ALLOWED" });
    }
    if (!requestOrigin && requireOrigin) {
      app.log.warn({ event: "eip_origin_missing", path: url, ip: req.ip });
      return reply.code(403).send({ ok: false, error: "ORIGIN_REQUIRED" });
    }
    if (app.config.EIP_FETCH_METADATA_GUARD !== false) {
      if (fetchSite === "cross-site" && !allowed) {
        app.log.warn({ event: "eip_fetch_metadata_rejected", fetchSite, path: url, ip: req.ip });
        return reply.code(403).send({ ok: false, error: "ORIGIN_NOT_ALLOWED" });
      }
      if (fetchMode === "navigate") {
        app.log.warn({ event: "eip_fetch_navigate_rejected", path: url, ip: req.ip });
        return reply.code(403).send({ ok: false, error: "BROWSER_NAVIGATION_BLOCKED" });
      }
    }
  });

  // ---- static file serving for tenant websites ----
  await app.register(staticPlugin, {
    root: path.join(__dirname, "../public/sites"),
    prefix: "/public/",
    index: 'index.html',
    decorateReply: false,
    setHeaders: (res, filePath) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=3600");
    },
  });

  // ---- static file serving for local uploads (dev/local) ----
  const uploadStorage = inspectUploadStorage(app.config);
  const assetsRoot = uploadStorage.uploadRoot;
  app.decorate("ASSET_ROOT", assetsRoot);
  app.decorate("UPLOAD_STORAGE", uploadStorage);
  app.log.info({
    event: "upload_storage_diagnostic",
    UPLOAD_ROOT: uploadStorage.uploadRoot,
    DIRECTORY_EXISTS: uploadStorage.directoryExists,
    WRITABLE: uploadStorage.writable,
    STORAGE_MODE: uploadStorage.storageMode,
    error: uploadStorage.error?.code || null
  });
  if (uploadStorage.directoryExists) {
    await app.register(staticPlugin, {
      root: assetsRoot,
      prefix: "/assets/",
      decorateReply: false,
      setHeaders: (res) => {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Cache-Control", "public, max-age=3600");
      },
    });
  } else {
    app.log.error({
      event: "upload_storage_unavailable",
      error: uploadStorage.error?.code || "UPLOAD_DIRECTORY_NOT_FOUND",
      stack: uploadStorage.error?.stack
    });
  }

  // ---- multipart for file uploads ----
  await app.register(multipart, {
    attachFieldsToBody: true,
    limits: { fileSize: Number(app.config.UPLOAD_MAX_BYTES || DEFAULT_MAX_UPLOAD_BYTES) }
  });

  // ============================================================
  // REALMS
  // ============================================================
  const REALMS = Object.freeze({
    EIP: "EIP",
    MEMBER: "MEMBER",
    GATEWAY: "GATEWAY",
    INTEGRATION: "INTEGRATION",
  });
  app.decorate("REALMS", REALMS);

  // ============================================================
  // Request shape (so routes can rely on these existing)
  // ============================================================
  app.decorateRequest("session", null);
  app.decorateRequest("realm", null);
  app.decorateRequest("auth", null);
  app.decorateRequest("integration", null);

  // ============================================================
  // Tenant validation for public static routes
  // ============================================================
  if (app.config.PUBLIC_TENANT_GUARD !== false) {
    app.addHook("preHandler", async (req, reply) => {
      if (req.url.startsWith("/public/")) {
        const urlParts = req.url.split("/");
        const tenantSlug = urlParts[2]; // /public/:tenant/...
        if (!tenantSlug) return reply.code(400).send({ ok: false, error: "INVALID_TENANT" });

        // Check cache first
        let tenantId = tenantCache.get(tenantSlug);
        if (tenantId === undefined) {
          // DB lookup
          const result = await app.db.query(
            "SELECT id FROM eip_core.tenant WHERE code = $1 AND is_active = true",
            [tenantSlug]
          );
          if (result.rows.length === 0) {
            tenantCache.set(tenantSlug, null); // Cache miss
            return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
          }
          tenantId = result.rows[0].id;
          tenantCache.set(tenantSlug, tenantId);
        } else if (tenantId === null) {
          return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
        }

        // Audit access
        await app.db.query(
          "INSERT INTO eip_core.info_record (tenant_id, record_type, payload) VALUES ($1, $2, $3)",
          [tenantId, "gateway_access", { ip: req.ip, path: req.url, timestamp: new Date().toISOString() }]
        );
      }
    });
  } else {
    app.log.warn({ event: "public_tenant_guard_disabled" });
  }

  // ============================================================
  // INTEGRATION: API key guard
  // Authorization: Bearer <rawKey>
  // ============================================================
  app.decorate("requireIntegration", async function requireIntegration(req) {
    const authz = String(req.headers.authorization || "");
    const m = authz.match(/^Bearer\s+(.+)$/i);
    const rawKey = m ? m[1].trim() : null;

    if (!rawKey) return { ok: false, status: 401, error: "NO_API_KEY" };

    const keyHash = sha256Hex(`${rawKey}:${app.config.API_KEY_PEPPER}`);

    const r = await app.db.query(
      `
      SELECT id, tenant_id, is_active, expires_at, scopes, attrs
      FROM eip_auth.auth_api_key
      WHERE key_hash = $1
      LIMIT 1
      `,
      [keyHash]
    );

    if (r.rowCount === 0) return { ok: false, status: 401, error: "INVALID_API_KEY" };

    const k = r.rows[0];
    if (!k.is_active) return { ok: false, status: 401, error: "API_KEY_DISABLED" };
    if (k.expires_at && new Date(k.expires_at).getTime() <= Date.now()) {
      return { ok: false, status: 401, error: "API_KEY_EXPIRED" };
    }

    req.realm = REALMS.INTEGRATION;
    req.integration = {
      api_key_id: k.id,
      tenant_id: k.tenant_id,
      scopes: k.scopes ?? {},
      attrs: k.attrs ?? {},
    };

    // unify tenant resolution across the app
    req.auth = {
      tenant_id: k.tenant_id,
      realm: REALMS.INTEGRATION,
      principal_type: "api_key",
      principal_id: k.id,
    };

    return { ok: true };
  });

  // ============================================================
  // SESSION LOAD (cookie sid)
  // ============================================================
  app.decorate("loadSession", async function loadSession(req) {
    const sid = getAuthCookie(req, app, "sid");
    if (!sid) return null;

    const r = await app.db.query(
      `
      SELECT
        id,
        tenant_id,
        identity_id,
        device_id,
        is_revoked,
        issued_at,
        expires_at,
        COALESCE(attrs,'{}'::jsonb) AS attrs,
        csrf_secret_hash
      FROM eip_auth.auth_session
      WHERE id = $1::uuid
      `,
      [sid]
    );

    if (r.rowCount === 0) return null;

    const s = r.rows[0];
    if (s.is_revoked) return null;
    if (new Date(s.expires_at).getTime() <= Date.now()) return null;

    const idleTtlMin = Number(app.config.SESSION_IDLE_TTL_MIN || 0);
    const idleTtlMs = idleTtlMin > 0 ? idleTtlMin * 60 * 1000 : 0;
    if (idleTtlMs) {
      const lastSeenRaw = s.attrs?.last_seen_at;
      const lastSeenMs = lastSeenRaw ? new Date(lastSeenRaw).getTime() : new Date(s.issued_at).getTime();
      if (Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs > idleTtlMs) {
        await app.db.query(
          `
          UPDATE eip_auth.auth_session
          SET is_revoked = true,
              revoked_at = now(),
              attrs = jsonb_set(COALESCE(attrs,'{}'::jsonb), '{revoked_reason}', to_jsonb($2::text), true)
          WHERE id = $1
          `,
          [s.id, "idle_timeout"]
        );
        return null;
      }

      const touchIntervalMs = sessionTouchIntervalMs(idleTtlMin);
      if (!req._sessionTouched && (!Number.isFinite(lastSeenMs) || Date.now() - lastSeenMs >= touchIntervalMs)) {
        const nowIso = new Date().toISOString();
        await app.db.query(
          `
          UPDATE eip_auth.auth_session
          SET attrs = jsonb_set(COALESCE(attrs,'{}'::jsonb), '{last_seen_at}', to_jsonb($2::text), true)
          WHERE id = $1
          `,
          [s.id, nowIso]
        );
        s.attrs = { ...(s.attrs || {}), last_seen_at: nowIso };
        req._sessionTouched = true;
      }
    }

    const realm = String(s.attrs?.realm || REALMS.EIP);

    return { ...s, realm };
  });

  // ============================================================
  // Asset access control (signed URLs for tenant uploads)
  // ============================================================
  const assetTokenRequired =
    app.config.ASSET_TOKEN_REQUIRED ?? (app.config.NODE_ENV === "production");

  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/assets/")) return;
    const match = req.url.match(/^\/assets\/([0-9a-f-]{36})\/(?:products|avatars|blog)\/[^?]+/i);
    if (!match) return;
    if (!assetTokenRequired) return;

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const exp = url.searchParams.get("exp");
    const token = url.searchParams.get("token");
    const path = url.pathname;
    const hasToken = Boolean(token || exp);

    if (token && exp) {
      const ok = verifyAssetToken(path, exp, token, app.config.API_KEY_PEPPER);
      if (ok) return;
    }

    const s = req.session || (await app.loadSession(req));
    if (s && String(s.realm || REALMS.EIP) === REALMS.EIP) {
      const assetTenantId = match[1];
      let access = null;
      if (!sessionCanAccessAssetTenant(s, assetTenantId)) {
        try {
          access = await resolveEipSurfaceAccess(app, s);
        } catch (error) {
          app.log.warn({ event: "asset_surface_access_check_failed", sessionId: s.id, error: error.message });
        }
      }
      if (sessionCanAccessAssetTenant(s, assetTenantId, access)) {
        req.session = s;
        req.realm = s.realm;
        return;
      }
      return reply.code(403).send({ ok: false, error: "ASSET_TENANT_FORBIDDEN" });
    }

    reply.code(403).send({ ok: false, error: hasToken ? "ASSET_TOKEN_INVALID" : "ASSET_TOKEN_REQUIRED" });
  });

  // ============================================================
  // REQUIRE SESSION (single canonical contract)
  // ============================================================
  app.decorate("requireSession", async function requireSession(req, opts = {}) {
    const expectedRealm = opts.realm; // optional

    const s = req.session || (await app.loadSession(req));
    if (!s) return { ok: false, status: 401, error: "UNAUTHENTICATED" };

    if (expectedRealm && s.realm !== expectedRealm) {
      return { ok: false, status: 403, error: "WRONG_REALM", realm: s.realm };
    }

    req.session = s;
    req.realm = s.realm;

    // Also provide a consistent auth context for tenant resolution
    req.auth = {
      tenant_id: s.tenant_id,
      realm: s.realm,
      principal_type: "session",
      principal_id: s.id,
      identity_id: s.identity_id,
    };

    return { ok: true, session: s };
  });

  // ============================================================
  // REQUIRE REALM (canonical realm guard)
  // ============================================================
  app.decorate("requireRealm", async function requireRealm(req, expectedRealm) {
    if (!req.realm) {
      const s = await app.loadSession(req);
      if (s) {
        req.session = s;
        req.realm = s.realm;
      }
    }

    if (!req.realm) return { ok: false, status: 401, error: "UNAUTHENTICATED" };
    if (req.realm !== expectedRealm) {
      return { ok: false, status: 403, error: "WRONG_REALM", realm: req.realm };
    }
    return { ok: true };
  });

  // ============================================================
  // CSRF (state change only)
  // Uses: cookie csrf + header x-csrf + DB hash check
  // ============================================================
  app.decorate("requireCsrf", async function requireCsrf(req) {
    const m = (req.method || "GET").toUpperCase();
    const needs = m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
    if (!needs) return { ok: true };

    const csrfCookie = getAuthCookie(req, app, "csrf");
    const csrfHeader = req.headers["x-csrf"];

    if (!csrfCookie || !csrfHeader) {
      return { ok: false, status: 403, error: "CSRF_MISSING" };
    }
    if (String(csrfHeader) !== String(csrfCookie)) {
      return { ok: false, status: 403, error: "CSRF_MISMATCH" };
    }

    // ensure we have a session loaded
    const s = req.session || (await app.loadSession(req));
    if (!s) return { ok: false, status: 401, error: "UNAUTHENTICATED" };

    const expected = sha256Hex(`${csrfCookie}:${app.config.CSRF_PEPPER}`);
    if (!s.csrf_secret_hash || !timingSafeEqual(expected, s.csrf_secret_hash)) {
      return { ok: false, status: 403, error: "CSRF_INVALID" };
    }

    // attach hydrated session (so callers don’t need to call requireSession again)
    req.session = s;
    req.realm = s.realm;

    return { ok: true };
  });

  // ============================================================
  // REQUIRE STEP-UP (recent OTP/TOTP/passkey)
  // ============================================================
  app.decorate("requireStepUp", async function requireStepUp(req, opts = {}) {
    const s = req.session || (await app.loadSession(req));
    const ttlMin = Number(opts.ttlMin || app.config.STEP_UP_TTL_MIN || 5);
    const check = evaluateStepUp(s, {
      ttlMin,
      phishingResistant: opts.phishingResistant === true
    });
    if (!check.ok) {
      auditSecurityEvent(app, "auth.step_up_failed", {
        category: "auth",
        source: "server.requireStepUp",
        severity: "warning",
        outcome: "failure",
        tenantId: s?.tenant_id || null,
        identityId: s?.identity_id || null,
        reason: check.error || "STEP_UP_FAILED",
        ip: req.ip,
        userAgent: req.headers?.["user-agent"] || null,
        metadata: {
          ttl_min: ttlMin,
          phishing_resistant_required: opts.phishingResistant === true
        }
      });
      return check;
    }

    req.session = s;
    req.realm = s.realm;
    return { ok: true, ...check };
  });

  // ============================================================
  // BOOTSTRAP STAGE RESTRICTION (EIP only)
  // ============================================================
  app.addHook("preHandler", async (req, reply) => {
    const url = String(req.url || "").split("?")[0];
    if (!url.startsWith("/api/eip/")) return;

    const sid = getAuthCookie(req, app, "sid");
    if (!sid) return;

    const s = req.session || (await app.loadSession(req));
    if (!s) return;

    if (s.attrs?.stage !== "bootstrap") {
      req.session = s;
      req.realm = s.realm;
      return;
    }

    const allowed =
      url.startsWith("/api/eip/bootstrap/") ||
      url === "/api/eip/auth/logout" ||
      url === "/api/eip/auth/whoami";

    if (!allowed) {
      return reply.code(403).send({ ok: false, error: "BOOTSTRAP_RESTRICTED" });
    }

    req.session = s;
    req.realm = s.realm;
  });

  // ============================================================
  // ROUTES (after all decorators exist)
  // ============================================================
  await app.register(healthRoutes, { prefix: "/api/public" });
  await app.register(tenantRequestsPublic, { prefix: "/api/public" });
  await app.register(publicCommercePreflightRoutes, { prefix: "/api/public" });
  await app.register(publicCommerceRoutes, { prefix: "/api/public" });
  await app.register(publicGatewayRoutes, { prefix: "/api/public" });
  await app.register(uiSurfaceRoutes, { prefix: "/api/public", public: true });
  await app.register(authRoutes, { prefix: "/api/eip" });
  await app.register(authElectronRoutes, { prefix: "/api/eip" });
  await app.register(authzRoutes, { prefix: "/api/eip" });
  await app.register(gatewayRoutes, { prefix: "/api/eip" });
  await app.register(tenantRequestsAdmin, { prefix: "/api/eip" });
  await app.register(tenantAdminAccessRoutes, { prefix: "/api/eip" });
  await app.register(adminMonitoringRoutes, { prefix: "/api/eip" });
  await app.register(adminDbExplorerRoutes, { prefix: "/api/eip" });
  await app.register(adminPortfolioRoutes, { prefix: "/api/eip" });
  await app.register(adminTemplateCloneRoutes, { prefix: "/api/eip" });
  await app.register(adminAccessRoutes, { prefix: "/api/eip" });
  await app.register(bootstrapRoutes, { prefix: "/api/eip" });
  await app.register(coreProcessRoutes, { prefix: "/api/eip/core" });
  await app.register(coreProcessRoutes, { prefix: "/api/eip" });
  await app.register(crmRoutes, { prefix: "/api/eip/crm" });
  await app.register(commerceOrdersRoutes, { prefix: "/api/eip" });
  await app.register(inventoryRoutes, { prefix: "/api/eip/inventory" });
  await app.register(procurementRoutes, { prefix: "/api/eip/procurement" });
  await app.register(ecomRoutes, { prefix: "/api/eip/ecom" });
  await app.register(policiesConditionsRoutes, { prefix: "/api/eip/policies-conditions" });
  await app.register(entitiesRoutes, { prefix: "/api/eip/entities" });
  await app.register(ediRoutes, { prefix: "/api/edi" });
  await app.register(ediGatewayRoutes, { prefix: "/api/edi" });
  await app.register(privacyRoutes, { prefix: "/api/eip" });
  await app.register(socketManifestRoutes, { prefix: "/api" });
  await app.register(uiSurfaceRoutes, { prefix: "/api/eip" });
  const allowDebug =
    app.config.ENABLE_DEBUG_ROUTES === true && app.config.NODE_ENV !== "production";
  if (allowDebug) {
    await app.register(debugRoutes, { prefix: "/api/eip" });
  } else {
    app.log.info({ event: "debug_routes_disabled" });
  }

  if (app.config.FX_SYNC_ENABLED === true) {
    const intervalMin = Math.max(15, Number(app.config.FX_SYNC_INTERVAL_MIN || 1440));
    const intervalMs = intervalMin * 60 * 1000;
    let running = false;

    const runSync = async () => {
      if (running) return;
      running = true;
      try {
        const results = await syncAllTenantMarketplaceFx(app, { force: false });
        const okCount = results.filter((entry) => entry?.ok).length;
        const failCount = results.length - okCount;
        app.log.info({
          event: "fx_sync_tick",
          tenants: results.length,
          ok: okCount,
          failed: failCount
        });
      } catch (error) {
        app.log.error({ event: "fx_sync_tick_failed", error: error?.message || String(error) });
      } finally {
        running = false;
      }
    };

    const bootTimer = setTimeout(() => {
      runSync();
    }, 15000);
    bootTimer.unref?.();

    const intervalHandle = setInterval(() => {
      runSync();
    }, intervalMs);
    intervalHandle.unref?.();

    app.addHook("onClose", async () => {
      clearTimeout(bootTimer);
      clearInterval(intervalHandle);
    });

    app.log.info({ event: "fx_sync_scheduler_started", interval_min: intervalMin });
  } else {
    app.log.info({ event: "fx_sync_scheduler_disabled" });
  }

  return app;
}

const app = await buildServer();

try {
  await app.listen({ port: app.config.PORT, host: app.config.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
