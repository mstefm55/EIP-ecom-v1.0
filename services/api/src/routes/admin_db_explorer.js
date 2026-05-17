// services/api/src/routes/admin_db_explorer.js
import { hasPermission } from "../auth/perm.js";
import { sha256Hex, timingSafeEqual } from "../auth/crypto.js";

const MAX_LIMIT = 200;
const SAFE_SCHEMAS = new Set(["eip_core", "eip_auth", "eip_authz"]);
const SENSITIVE_TABLES = new Set([
  "eip_auth.auth_credential",
  "eip_auth.auth_session",
  "eip_auth.auth_event",
  "eip_auth.auth_otp_challenge",
  "eip_auth.auth_device",
  "eip_auth.auth_api_key",
]);
const SENSITIVE_COLUMN_PATTERN = /(password|token|secret|hash|pepper|salt|key)/i;
const SENSITIVE_TOKEN_COOKIE = "eip_sensitive_token";

function clampLimit(value) {
  const n = Number(value || 50);
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, n));
}

function isSafeIdent(value) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value || "");
}

async function requireAdminDb(app, req, reply, permCode) {
  const session = await app.requireSession(req, { realm: "EIP" });
  if (!session.ok) {
    reply.code(session.status).send({ ok: false, error: session.error });
    return null;
  }
  const allowed = await hasPermission(app, session.session.tenant_id, session.session.identity_id, permCode);
  if (!allowed) {
    reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    return null;
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
    const session = await requireAdminDb(app, req, reply, "admin.db.read");
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
      const tokenCheck = await verifySensitiveToken(
        app,
        tenantAccess,
        String(req.cookies?.[SENSITIVE_TOKEN_COOKIE] || "")
      );
      if (!tokenCheck.ok) {
        return reply.code(403).send({ ok: false, error: tokenCheck.error });
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
    const session = await requireAdminDb(app, req, reply, "admin.db.export");
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
      const tokenCheck = await verifySensitiveToken(
        app,
        tenantAccess,
        String(req.cookies?.[SENSITIVE_TOKEN_COOKIE] || "")
      );
      if (!tokenCheck.ok) {
        return reply.code(403).send({ ok: false, error: tokenCheck.error });
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

    const stepUp = await app.requireStepUp(req);
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

    const expiresAt = tenantAccess.sensitive_token_expires_at
      ? new Date(tenantAccess.sensitive_token_expires_at)
      : null;
    const maxAgeMs = expiresAt ? Math.max(0, expiresAt.getTime() - Date.now()) : 0;
    const maxAgeSec = Math.floor(maxAgeMs / 1000);

    reply.setCookie(SENSITIVE_TOKEN_COOKIE, token, {
      path: "/api/eip/admin/db",
      httpOnly: true,
      sameSite: "lax",
      secure: app.config.NODE_ENV === "production",
      maxAge: maxAgeSec,
    });

    await app.db.query(
      `
      UPDATE eip_authz.admin_tenant_access
      SET sensitive_token_last_used_at = now(),
          updated_at = now()
      WHERE admin_identity_id=$1 AND tenant_id=$2
      `,
      [session.identity_id, tenantId]
    );

    return reply.send({ ok: true, token_expires_at: expiresAt });
  });

  app.post("/admin/db/sensitive/clear", async (req, reply) => {
    const csrf = await app.requireCsrf(req);
    if (!csrf.ok) {
      return reply.code(csrf.status).send({ ok: false, error: csrf.error });
    }

    const session = await requireAdminDb(app, req, reply, "admin.db.read_sensitive");
    if (!session) return;

    reply.clearCookie(SENSITIVE_TOKEN_COOKIE, { path: "/api/eip/admin/db" });
    return reply.send({ ok: true });
  });
}
