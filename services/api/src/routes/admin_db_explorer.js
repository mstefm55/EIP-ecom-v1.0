// services/api/src/routes/admin_db_explorer.js
import { hasPermission } from "../auth/perm.js";
import { sha256Hex, timingSafeEqual } from "../auth/crypto.js";
import { requirePrivilegedStepUp } from "../auth/privilegedStepUp.js";
import { resolveEipSurfaceAccess } from "../lib/surfaceAccess.js";
import { auditSecurityEvent } from "../lib/securityAudit.js";

const MAX_LIMIT = 200;
const SAFE_SCHEMAS = new Set(["eip_core", "eip_auth", "eip_authz"]);
const SENSITIVE_TABLES = new Set([
  "eip_auth.auth_credential",
  "eip_auth.auth_session",
  "eip_auth.auth_event",
  "eip_auth.auth_otp_challenge",
  "eip_auth.auth_device",
  "eip_auth.auth_api_key",
  "eip_auth.auth_password_reset",
  "eip_auth.auth_recovery_token",
  "eip_auth.auth_recovery_request",
  "eip_auth.auth_passkey",
  "eip_core.connection_secret",
  "eip_core.security_event",
]);
const SENSITIVE_COLUMN_PATTERN =
  /(password|token|secret|hash|pepper|salt|key|credential|session|csrf|refresh|otp|totp|recovery|signature|cookie|api|private)/i;
const SENSITIVE_TOKEN_COOKIE = "eip_sensitive_token";
const SENSITIVE_GRANT_DEFAULT_TTL_MIN = 15;

function normalizeText(value) {
  return String(value || "").trim();
}

function clampLimit(value) {
  const n = Number(value || 50);
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, n));
}

function isSafeIdent(value) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value || "");
}

function normalizeOrigin(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  try {
    return new URL(raw).origin.toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/\/$/, "");
  }
}

function allowedEipOrigins(app) {
  if (Array.isArray(app.EIP_ORIGINS)) {
    return app.EIP_ORIGINS.map(normalizeOrigin).filter(Boolean);
  }
  return normalizeText(app.config?.CORS_ORIGIN)
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

function requestOrigin(req) {
  const origin = normalizeOrigin(req.headers.origin);
  if (origin) return origin;
  const referer = normalizeText(req.headers.referer || req.headers.referrer);
  if (!referer) return "";
  return normalizeOrigin(referer);
}

function dbExplorerEnabled(app) {
  if (String(app.config?.NODE_ENV || "").toLowerCase() !== "production") return true;
  return app.config?.ENABLE_ADMIN_DB_EXPLORER === true;
}

function validateBrowserReadGuard(app, req) {
  const allowed = allowedEipOrigins(app);
  const origin = requestOrigin(req);
  const fetchSite = normalizeText(req.headers["sec-fetch-site"]).toLowerCase();
  const fetchMode = normalizeText(req.headers["sec-fetch-mode"]).toLowerCase();
  const requiresOrigin =
    String(app.config?.NODE_ENV || "").toLowerCase() === "production" ||
    app.config?.EIP_ORIGIN_REQUIRED === true;

  if (fetchSite === "cross-site") {
    return { ok: false, status: 403, error: "ORIGIN_NOT_ALLOWED" };
  }
  if (fetchMode === "navigate") {
    return { ok: false, status: 403, error: "BROWSER_NAVIGATION_BLOCKED" };
  }
  if (!origin) {
    return requiresOrigin
      ? { ok: false, status: 403, error: "ORIGIN_REQUIRED" }
      : { ok: true };
  }
  if (!allowed.includes(origin)) {
    return { ok: false, status: 403, error: "ORIGIN_NOT_ALLOWED" };
  }
  return { ok: true };
}

async function denyAdminDb(app, req, reply, status, error, details = {}) {
  auditSecurityEvent(app, details.eventType || `admin_db_explorer.${String(error || "denied").toLowerCase()}`, {
    category: "admin",
    source: "admin_db_explorer",
    severity: status >= 500 ? "error" : "warning",
    outcome: status >= 500 ? "error" : "rejected",
    reason: error,
    ip: req.ip,
    userAgent: req.headers["user-agent"] || null,
    ...details
  });
  reply.code(status).send({ ok: false, error });
  return null;
}

async function requireAdminDb(app, req, reply, permCode, opts = {}) {
  if (!dbExplorerEnabled(app)) {
    return denyAdminDb(app, req, reply, 404, "DB_EXPLORER_DISABLED", {
      eventType: "admin_db_explorer.disabled"
    });
  }

  const browserGuard = validateBrowserReadGuard(app, req);
  if (!browserGuard.ok) {
    return denyAdminDb(app, req, reply, browserGuard.status, browserGuard.error, {
      eventType: "admin_db_explorer.browser_guard_rejected",
      metadata: {
        sec_fetch_site: req.headers["sec-fetch-site"] || null,
        sec_fetch_mode: req.headers["sec-fetch-mode"] || null,
        origin: req.headers.origin || null,
        referer: req.headers.referer || req.headers.referrer || null
      }
    });
  }

  const session = await app.requireSession(req, { realm: "EIP" });
  if (!session.ok) {
    reply.code(session.status).send({ ok: false, error: session.error });
    return null;
  }
  const surfaceAccess = await resolveEipSurfaceAccess(app, session.session);
  req.session = session.session;
  req.realm = session.session.realm;
  req._eipSurfaceAccess = surfaceAccess;
  if (!surfaceAccess?.is_owner_admin_session) {
    return denyAdminDb(app, req, reply, 403, "OWNER_ADMIN_REQUIRED", {
      eventType: "admin_db_explorer.owner_admin_required",
      tenantId: session.session.tenant_id,
      identityId: session.session.identity_id,
      metadata: {
        tenant_code: surfaceAccess?.tenant_code || null,
        classification: surfaceAccess?.surface_classification || null
      }
    });
  }

  const allowed = await hasPermission(app, session.session.tenant_id, session.session.identity_id, permCode);
  if (!allowed) {
    reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    return null;
  }
  if (opts.stepUp === true) {
    if (typeof app.requireStepUp !== "function") {
      return denyAdminDb(app, req, reply, 403, "STEP_UP_REQUIRED", {
        eventType: "admin_db_explorer.step_up_missing",
        tenantId: session.session.tenant_id,
        identityId: session.session.identity_id
      });
    }
    const stepUp = await requirePrivilegedStepUp(app, req);
    if (!stepUp.ok) {
      reply.code(stepUp.status).send({ ok: false, error: stepUp.error });
      return null;
    }
  }
  return session.session;
}

async function isAdminExec(app, tenantId, identityId) {
  const r = await app.db.query(
    `
    SELECT 1
    FROM eip_authz.identity_role ir
    JOIN eip_authz.role r ON r.id = ir.role_id
    WHERE ir.tenant_id=$1
      AND ir.identity_id=$2
      AND r.is_active=true
      AND r.code IN ('ADMIN_EXEC','ADMIN_SUPER')
    LIMIT 1
    `,
    [tenantId, identityId]
  );
  return r.rowCount > 0;
}

async function loadTenantAccess(app, identityId, tenantId) {
  const r = await app.db.query(
    `
    SELECT access_level,
           sensitive_allowed,
           sensitive_token_hash,
           sensitive_token_expires_at,
           sensitive_token_revoked_at
    FROM eip_authz.admin_tenant_access
    WHERE admin_identity_id=$1
      AND tenant_id=$2
      AND is_active=true
    LIMIT 1
    `,
    [identityId, tenantId]
  );
  return r.rows[0] || null;
}

async function loadAdminPortfolioId(app, identityId) {
  const r = await app.db.query(
    `
    SELECT id
    FROM eip_authz.admin_portfolio
    WHERE admin_identity_id=$1 AND is_active=true
    LIMIT 1
    `,
    [identityId]
  );
  return r.rows[0]?.id || null;
}

async function hasPortfolioAccess(app, identityId, tenantId) {
  const r = await app.db.query(
    `
    SELECT 1
    FROM eip_core.tenant t
    JOIN eip_authz.admin_portfolio p ON p.id = t.admin_portfolio_id
    WHERE t.id=$1
      AND p.admin_identity_id=$2
      AND p.is_active=true
    LIMIT 1
    `,
    [tenantId, identityId]
  );
  return r.rowCount > 0;
}

function buildTokenHash(app, rawToken) {
  return sha256Hex(`${rawToken}:${app.config.API_KEY_PEPPER}`);
}

function sensitiveGrantTtlMs(app, tenantAccess) {
  const configuredMin = Number(app.config?.ADMIN_DB_SENSITIVE_GRANT_TTL_MIN || SENSITIVE_GRANT_DEFAULT_TTL_MIN);
  const ttlMs = Math.max(1, configuredMin) * 60 * 1000;
  const tokenExpiresAt = tenantAccess?.sensitive_token_expires_at
    ? new Date(tenantAccess.sensitive_token_expires_at).getTime()
    : 0;
  if (!Number.isFinite(tokenExpiresAt) || tokenExpiresAt <= 0) return ttlMs;
  return Math.max(0, Math.min(ttlMs, tokenExpiresAt - Date.now()));
}

function buildSensitiveGrantHash(app, session, tenantId, tenantAccess) {
  return sha256Hex(
    [
      String(session?.id || ""),
      String(tenantId || ""),
      String(tenantAccess?.sensitive_token_hash || ""),
      String(app.config?.API_KEY_PEPPER || "")
    ].join(":")
  );
}

async function grantSensitiveAccess(app, session, tenantId, tenantAccess) {
  const ttlMs = sensitiveGrantTtlMs(app, tenantAccess);
  if (!ttlMs) return { ok: false, error: "SENSITIVE_TOKEN_EXPIRED" };
  const expiresAt = new Date(Date.now() + ttlMs);
  const grant = {
    hash: buildSensitiveGrantHash(app, session, tenantId, tenantAccess),
    expires_at: expiresAt.toISOString(),
    granted_at: new Date().toISOString()
  };

  await app.db.query(
    `
    UPDATE eip_auth.auth_session
    SET attrs = jsonb_set(
      COALESCE(attrs,'{}'::jsonb),
      '{admin_db_sensitive_grants}',
      COALESCE(attrs->'admin_db_sensitive_grants','{}'::jsonb)
        || jsonb_build_object($2::text, $3::jsonb),
      true
    )
    WHERE id = $1::uuid
    `,
    [session.id, tenantId, JSON.stringify(grant)]
  );

  session.attrs = {
    ...(session.attrs || {}),
    admin_db_sensitive_grants: {
      ...(session.attrs?.admin_db_sensitive_grants || {}),
      [tenantId]: grant
    }
  };
  return { ok: true, expiresAt };
}

async function clearSensitiveAccessGrant(app, session, tenantId = null) {
  if (!session?.id) return;
  if (tenantId) {
    await app.db.query(
      `
      UPDATE eip_auth.auth_session
      SET attrs = jsonb_set(
        COALESCE(attrs,'{}'::jsonb),
        '{admin_db_sensitive_grants}',
        COALESCE(attrs->'admin_db_sensitive_grants','{}'::jsonb) - $2::text,
        true
      )
      WHERE id = $1::uuid
      `,
      [session.id, tenantId]
    );
    if (session.attrs?.admin_db_sensitive_grants) {
      delete session.attrs.admin_db_sensitive_grants[tenantId];
    }
    return;
  }

  await app.db.query(
    `
    UPDATE eip_auth.auth_session
    SET attrs = COALESCE(attrs,'{}'::jsonb) - 'admin_db_sensitive_grants'
    WHERE id = $1::uuid
    `,
    [session.id]
  );
  session.attrs = { ...(session.attrs || {}) };
  delete session.attrs.admin_db_sensitive_grants;
}

function verifySensitiveGrant(app, session, tenantAccess, tenantId) {
  if (!tenantAccess?.sensitive_allowed) {
    return { ok: false, error: "TENANT_SENSITIVE_DENIED" };
  }
  if (!tenantAccess?.sensitive_token_hash) {
    return { ok: false, error: "SENSITIVE_TOKEN_REQUIRED" };
  }
  const now = Date.now();
  const tokenExpiresAt = tenantAccess.sensitive_token_expires_at
    ? new Date(tenantAccess.sensitive_token_expires_at).getTime()
    : 0;
  if (tokenExpiresAt && now > tokenExpiresAt) {
    return { ok: false, error: "SENSITIVE_TOKEN_EXPIRED" };
  }
  if (tenantAccess.sensitive_token_revoked_at) {
    return { ok: false, error: "SENSITIVE_TOKEN_REVOKED" };
  }

  const grant = session?.attrs?.admin_db_sensitive_grants?.[tenantId];
  if (!grant?.hash || !grant?.expires_at) {
    return { ok: false, error: "SENSITIVE_GRANT_REQUIRED" };
  }
  const grantExpiresAt = new Date(grant.expires_at).getTime();
  if (!Number.isFinite(grantExpiresAt) || now > grantExpiresAt) {
    return { ok: false, error: "SENSITIVE_GRANT_EXPIRED" };
  }
  const expected = buildSensitiveGrantHash(app, session, tenantId, tenantAccess);
  if (!timingSafeEqual(expected, String(grant.hash || ""))) {
    return { ok: false, error: "SENSITIVE_GRANT_INVALID" };
  }
  return { ok: true };
}

async function verifySensitiveToken(app, tenantAccess, rawToken) {
  if (!tenantAccess?.sensitive_allowed) {
    return { ok: false, error: "TENANT_SENSITIVE_DENIED" };
  }
  if (!rawToken || !tenantAccess.sensitive_token_hash) {
    return { ok: false, error: "SENSITIVE_TOKEN_REQUIRED" };
  }

  const now = Date.now();
  const expiresAt = tenantAccess.sensitive_token_expires_at
    ? new Date(tenantAccess.sensitive_token_expires_at).getTime()
    : 0;
  if (expiresAt && now > expiresAt) {
    return { ok: false, error: "SENSITIVE_TOKEN_EXPIRED" };
  }
  if (tenantAccess.sensitive_token_revoked_at) {
    return { ok: false, error: "SENSITIVE_TOKEN_REVOKED" };
  }

  const hashed = buildTokenHash(app, rawToken);
  if (!timingSafeEqual(hashed, tenantAccess.sensitive_token_hash)) {
    return { ok: false, error: "SENSITIVE_TOKEN_INVALID" };
  }
  return { ok: true };
}

function maskSensitive(value) {
  if (value === null || value === undefined) return value;
  return "***";
}

function sanitizeRow(row, columns) {
  const output = {};
  columns.forEach((col) => {
    if (SENSITIVE_COLUMN_PATTERN.test(col)) {
      output[col] = maskSensitive(row[col]);
    } else {
      output[col] = row[col];
    }
  });
  return output;
}

function auditSensitiveDbAccess(app, req, {
  eventType,
  session,
  tableKey,
  tenantId,
  format = null,
  rowCount = null,
  limit = null,
  offset = null
}) {
  auditSecurityEvent(app, eventType, {
    category: "admin",
    source: "admin_db_explorer",
    severity: "warning",
    outcome: "success",
    actorTenantId: session?.tenant_id,
    actorIdentityId: session?.identity_id,
    targetTenantId: tenantId || null,
    ip: req.ip,
    userAgent: req.headers["user-agent"] || null,
    metadata: {
      table: tableKey,
      format,
      row_count: rowCount,
      limit,
      offset
    }
  });
}

export default async function adminDbExplorerRoutes(app) {
  app.get("/admin/db/schema", async (req, reply) => {
    const session = await requireAdminDb(app, req, reply, "admin.db.read");
    if (!session) return;

    const includeColumns = String(req.query?.include_columns || "true") !== "false";
    const tenantId = session.tenant_id;
    const identityId = session.identity_id;
    const exec = await isAdminExec(app, tenantId, identityId);

    const schemaList = Array.from(SAFE_SCHEMAS);
    const tablesRes = await app.db.query(
      `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema = ANY($1)
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
      `,
      [schemaList]
    );

    const columnsRes = includeColumns
      ? await app.db.query(
          `
          SELECT table_schema, table_name, column_name, data_type, is_nullable, ordinal_position
          FROM information_schema.columns
          WHERE table_schema = ANY($1)
          ORDER BY table_schema, table_name, ordinal_position
          `,
          [schemaList]
        )
      : { rows: [] };

    const columnMap = new Map();
    if (includeColumns) {
      for (const col of columnsRes.rows) {
        const key = `${col.table_schema}.${col.table_name}`;
        if (!columnMap.has(key)) columnMap.set(key, []);
        columnMap.get(key).push({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === "YES",
        });
      }
    }

    const schemaMap = new Map();
    for (const row of tablesRes.rows) {
      const key = `${row.table_schema}.${row.table_name}`;
      if (!schemaMap.has(row.table_schema)) {
        schemaMap.set(row.table_schema, []);
      }
      schemaMap.get(row.table_schema).push({
        name: row.table_name,
        columns: includeColumns ? columnMap.get(key) || [] : [],
        sensitive: SENSITIVE_TABLES.has(key),
      });
    }

    const schemas = Array.from(schemaMap.entries()).map(([schema, tables]) => ({
      schema,
      tables,
    }));

    return reply.send({ ok: true, schemas, is_exec: exec });
  });

  app.get("/admin/db/tenants", async (req, reply) => {
    const session = await requireAdminDb(app, req, reply, "admin.db.read");
    if (!session) return;

    const query = String(req.query?.query || "").trim();
    const exec = await isAdminExec(app, session.tenant_id, session.identity_id);

    const params = [];
    const where = ["t.is_active=true"];
    if (query) {
      params.push(`%${query}%`);
      const idx = params.length;
      where.push(
        `(t.code ILIKE $${idx} OR t.name ILIKE $${idx} OR t.id::text ILIKE $${idx})`
      );
    }

    if (!exec) {
      params.push(session.identity_id);
      const idx = params.length;
      where.push(
        `(t.admin_portfolio_id IN (
            SELECT p.id
            FROM eip_authz.admin_portfolio p
            WHERE p.admin_identity_id=$${idx} AND p.is_active=true
          )
          OR EXISTS (
            SELECT 1
            FROM eip_authz.admin_tenant_access ata
            WHERE ata.admin_identity_id=$${idx}
              AND ata.tenant_id=t.id
              AND ata.is_active=true
          ))`
      );
    }

    const r = await app.db.query(
      `
      SELECT t.id, t.code, t.name
      FROM eip_core.tenant t
      WHERE ${where.join(" AND ")}
      ORDER BY t.name
      LIMIT 200
      `,
      params
    );

    return reply.send({ ok: true, tenants: r.rows || [] });
  });

  app.get("/admin/db/table", async (req, reply) => {
    const session = await requireAdminDb(app, req, reply, "admin.db.read", { stepUp: true });
    if (!session) return;

    const schema = String(req.query?.schema || "");
    const table = String(req.query?.table || "");
    const limit = clampLimit(req.query?.limit);
    const offset = Number(req.query?.offset || 0);
    const orderBy = String(req.query?.order_by || "");
    const tenantFilter = req.query?.tenant_id ? String(req.query.tenant_id) : null;

    if (!SAFE_SCHEMAS.has(schema) || !isSafeIdent(schema) || !isSafeIdent(table)) {
      return reply.code(400).send({ ok: false, error: "INVALID_TABLE" });
    }

    const tableKey = `${schema}.${table}`;
    const exec = await isAdminExec(app, session.tenant_id, session.identity_id);
    const canSensitive =
      exec ||
      (await hasPermission(app, session.tenant_id, session.identity_id, "admin.db.read_sensitive"));

    if (SENSITIVE_TABLES.has(tableKey) && !canSensitive) {
      return reply.code(403).send({ ok: false, error: "SENSITIVE_FORBIDDEN" });
    }

    const exists = await app.db.query(
      `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema=$1 AND table_name=$2
        AND table_type='BASE TABLE'
      `,
      [schema, table]
    );
    if (exists.rowCount === 0) {
      return reply.code(404).send({ ok: false, error: "TABLE_NOT_FOUND" });
    }

    const columnsRes = await app.db.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema=$1 AND table_name=$2
      ORDER BY ordinal_position
      `,
      [schema, table]
    );
    const columns = columnsRes.rows.map((row) => row.column_name);
    const hasTenantColumn = columns.includes("tenant_id");

    let tenantAccess = null;
    if (hasTenantColumn) {
      if (!tenantFilter && !exec) {
        return reply.code(400).send({ ok: false, error: "TENANT_REQUIRED" });
      }
      if (tenantFilter) {
        if (tenantFilter !== session.tenant_id) {
          tenantAccess = await loadTenantAccess(app, session.identity_id, tenantFilter);
          if (!exec) {
            const portfolioAllowed = await hasPortfolioAccess(
              app,
              session.identity_id,
              tenantFilter
            );
            if (!portfolioAllowed && !tenantAccess) {
              return reply.code(403).send({ ok: false, error: "TENANT_ACCESS_REQUIRED" });
            }
          }
        } else {
          tenantAccess = await loadTenantAccess(app, session.identity_id, tenantFilter);
        }
      }
    }

    if (SENSITIVE_TABLES.has(tableKey) && !exec) {
      if (!tenantFilter) {
        return reply.code(400).send({ ok: false, error: "TENANT_REQUIRED" });
      }
      const grantCheck = verifySensitiveGrant(app, session, tenantAccess, tenantFilter);
      if (!grantCheck.ok) {
        auditSecurityEvent(app, "admin_db_explorer.sensitive_grant_rejected", {
          category: "admin",
          source: "admin_db_explorer",
          severity: "warning",
          outcome: "rejected",
          actorTenantId: session.tenant_id,
          actorIdentityId: session.identity_id,
          targetTenantId: tenantFilter,
          reason: grantCheck.error,
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null,
          metadata: { table: tableKey }
        });
        return reply.code(403).send({ ok: false, error: grantCheck.error });
      }
    }

    const orderColumn = columns.includes(orderBy) ? orderBy : columns[0];
    const orderClause = orderColumn ? `"${orderColumn}"` : null;
    const qualified = `"${schema}"."${table}"`;

    const params = [];
    let whereClause = "";
    if (hasTenantColumn && tenantFilter) {
      params.push(tenantFilter);
      whereClause = `WHERE tenant_id = $${params.length}`;
    }
    params.push(limit);
    params.push(offset);

    const query = `
      SELECT ${columns.map((col) => `"${col}"`).join(", ")}
      FROM ${qualified}
      ${whereClause}
      ${orderClause ? `ORDER BY ${orderClause}` : ""}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const dataRes = await app.db.query(query, params);
    const rows = dataRes.rows.map((row) => sanitizeRow(row, columns));
    if (SENSITIVE_TABLES.has(tableKey)) {
      auditSensitiveDbAccess(app, req, {
        eventType: "admin_db_explorer.sensitive_table_read",
        session,
        tableKey,
        tenantId: tenantFilter,
        rowCount: rows.length,
        limit,
        offset
      });
    }

    const countParams = [];
    let countWhere = "";
    if (hasTenantColumn && tenantFilter) {
      countParams.push(tenantFilter);
      countWhere = `WHERE tenant_id = $1`;
    }
    const countRes = await app.db.query(
      `
      SELECT count(*)::int AS total_count
      FROM ${qualified}
      ${countWhere}
      `,
      countParams
    );
    const totalCount = countRes.rows[0]?.total_count ?? 0;

    return reply.send({ ok: true, columns, rows, limit, offset, total_count: totalCount });
  });

  app.get("/admin/db/export", async (req, reply) => {
    const session = await requireAdminDb(app, req, reply, "admin.db.export", { stepUp: true });
    if (!session) return;

    const schema = String(req.query?.schema || "");
    const table = String(req.query?.table || "");
    const format = String(req.query?.format || "json").toLowerCase();
    const tenantFilter = req.query?.tenant_id ? String(req.query.tenant_id) : null;

    if (!SAFE_SCHEMAS.has(schema) || !isSafeIdent(schema) || !isSafeIdent(table)) {
      return reply.code(400).send({ ok: false, error: "INVALID_TABLE" });
    }

    const tableKey = `${schema}.${table}`;
    const exec = await isAdminExec(app, session.tenant_id, session.identity_id);
    const canSensitive =
      exec ||
      (await hasPermission(app, session.tenant_id, session.identity_id, "admin.db.read_sensitive"));
    if (SENSITIVE_TABLES.has(tableKey) && !canSensitive) {
      return reply.code(403).send({ ok: false, error: "SENSITIVE_FORBIDDEN" });
    }

    const columnsRes = await app.db.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema=$1 AND table_name=$2
      ORDER BY ordinal_position
      `,
      [schema, table]
    );
    const columns = columnsRes.rows.map((row) => row.column_name);
    const hasTenantColumn = columns.includes("tenant_id");

    let tenantAccess = null;
    if (hasTenantColumn) {
      if (!tenantFilter && !exec) {
        return reply.code(400).send({ ok: false, error: "TENANT_REQUIRED" });
      }
      if (tenantFilter) {
        if (tenantFilter !== session.tenant_id) {
          tenantAccess = await loadTenantAccess(app, session.identity_id, tenantFilter);
          if (!exec) {
            const portfolioAllowed = await hasPortfolioAccess(
              app,
              session.identity_id,
              tenantFilter
            );
            if (!portfolioAllowed && !tenantAccess) {
              return reply.code(403).send({ ok: false, error: "TENANT_ACCESS_REQUIRED" });
            }
          }
        } else {
          tenantAccess = await loadTenantAccess(app, session.identity_id, tenantFilter);
        }
      }
    }

    if (SENSITIVE_TABLES.has(tableKey) && !exec) {
      if (!tenantFilter) {
        return reply.code(400).send({ ok: false, error: "TENANT_REQUIRED" });
      }
      const grantCheck = verifySensitiveGrant(app, session, tenantAccess, tenantFilter);
      if (!grantCheck.ok) {
        auditSecurityEvent(app, "admin_db_explorer.sensitive_grant_rejected", {
          category: "admin",
          source: "admin_db_explorer",
          severity: "warning",
          outcome: "rejected",
          actorTenantId: session.tenant_id,
          actorIdentityId: session.identity_id,
          targetTenantId: tenantFilter,
          reason: grantCheck.error,
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null,
          metadata: { table: tableKey, export_format: format }
        });
        return reply.code(403).send({ ok: false, error: grantCheck.error });
      }
    }

    const qualified = `"${schema}"."${table}"`;
    const params = [];
    let whereClause = "";
    if (hasTenantColumn && tenantFilter) {
      params.push(tenantFilter);
      whereClause = `WHERE tenant_id = $${params.length}`;
    }

    const dataRes = await app.db.query(
      `
      SELECT ${columns.map((col) => `"${col}"`).join(", ")}
      FROM ${qualified}
      ${whereClause}
      `,
      params
    );
    const rows = dataRes.rows.map((row) => sanitizeRow(row, columns));
    if (SENSITIVE_TABLES.has(tableKey)) {
      auditSensitiveDbAccess(app, req, {
        eventType: "admin_db_explorer.sensitive_export",
        session,
        tableKey,
        tenantId: tenantFilter,
        format,
        rowCount: rows.length
      });
    }

    if (format === "csv") {
      const header = columns.join(",");
      const lines = rows.map((row) =>
        columns
          .map((col) => {
            const value = row[col];
            if (value === null || value === undefined) return "";
            const text = String(value).replace(/"/g, '""');
            return `"${text}"`;
          })
          .join(",")
      );
      const csv = [header, ...lines].join("\n");
      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", `attachment; filename="${table}.csv"`);
      return reply.send(csv);
    }

    reply.header("Content-Type", "application/json");
    reply.header("Content-Disposition", `attachment; filename="${table}.json"`);
    return reply.send(rows);
  });

  app.post("/admin/db/sensitive/consume", async (req, reply) => {
    const csrf = await app.requireCsrf(req);
    if (!csrf.ok) {
      return reply.code(csrf.status).send({ ok: false, error: csrf.error });
    }

    const session = await requireAdminDb(app, req, reply, "admin.db.read_sensitive");
    if (!session) return;

    const stepUp = await requirePrivilegedStepUp(app, req);
    if (!stepUp.ok) {
      return reply.code(stepUp.status).send({ ok: false, error: stepUp.error });
    }

    const tenantId = String(req.body?.tenant_id || "");
    const token = String(req.body?.token || "");
    if (!tenantId || !token) {
      return reply.code(400).send({ ok: false, error: "TOKEN_REQUIRED" });
    }

    const tenantAccess = await loadTenantAccess(app, session.identity_id, tenantId);
    if (!tenantAccess) {
      return reply.code(403).send({ ok: false, error: "TENANT_ACCESS_REQUIRED" });
    }

    const tokenCheck = await verifySensitiveToken(app, tenantAccess, token);
    if (!tokenCheck.ok) {
      return reply.code(403).send({ ok: false, error: tokenCheck.error });
    }

    const grant = await grantSensitiveAccess(app, session, tenantId, tenantAccess);
    if (!grant.ok) {
      return reply.code(403).send({ ok: false, error: grant.error });
    }
    reply.clearCookie(SENSITIVE_TOKEN_COOKIE, { path: "/api/eip/admin/db" });

    await app.db.query(
      `
      UPDATE eip_authz.admin_tenant_access
      SET sensitive_token_last_used_at = now(),
          updated_at = now()
      WHERE admin_identity_id=$1 AND tenant_id=$2
      `,
      [session.identity_id, tenantId]
    );

    auditSecurityEvent(app, "admin_db_explorer.sensitive_grant_created", {
      category: "admin",
      source: "admin_db_explorer",
      severity: "warning",
      outcome: "success",
      actorTenantId: session.tenant_id,
      actorIdentityId: session.identity_id,
      targetTenantId: tenantId,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null,
      metadata: { expires_at: grant.expiresAt.toISOString() }
    });

    return reply.send({ ok: true, grant_expires_at: grant.expiresAt });
  });

  app.post("/admin/db/sensitive/clear", async (req, reply) => {
    const csrf = await app.requireCsrf(req);
    if (!csrf.ok) {
      return reply.code(csrf.status).send({ ok: false, error: csrf.error });
    }

    const session = await requireAdminDb(app, req, reply, "admin.db.read_sensitive");
    if (!session) return;

    await clearSensitiveAccessGrant(app, session);
    reply.clearCookie(SENSITIVE_TOKEN_COOKIE, { path: "/api/eip/admin/db" });
    auditSecurityEvent(app, "admin_db_explorer.sensitive_grant_cleared", {
      category: "admin",
      source: "admin_db_explorer",
      severity: "info",
      outcome: "success",
      actorTenantId: session.tenant_id,
      actorIdentityId: session.identity_id,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || null
    });
    return reply.send({ ok: true });
  });
}

export {
  sanitizeRow,
  verifySensitiveGrant,
  grantSensitiveAccess,
  clearSensitiveAccessGrant
};
