// services/api/src/routes/admin_portfolio.js
import { hasPermission } from "../auth/perm.js";

function normalizeText(value) {
  return String(value || "").trim();
}

async function requireAdminPerm(app, req, reply, permCode, opts = {}) {
  const guard = opts.csrf
    ? await app.requireCsrf(req)
    : await app.requireSession(req, { realm: "EIP" });
  if (!guard.ok) {
    reply.code(guard.status).send({ ok: false, error: guard.error });
    return null;
  }
  const session = req.session || guard.session;
  const allowed = await hasPermission(app, session.tenant_id, session.identity_id, permCode);
  if (!allowed) {
    reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    return null;
  }
  return session;
}

async function resolveEipTenantId(app) {
  const r = await app.db.query(
    "SELECT id FROM eip_core.tenant WHERE code = 'eip' LIMIT 1"
  );
  return r.rows[0]?.id || null;
}

async function resolveAdminIdentity(app, { adminIdentityId, adminLogin }) {
  const eipTenantId = await resolveEipTenantId(app);
  if (!eipTenantId) return null;

  if (adminIdentityId) {
    const r = await app.db.query(
      `
      SELECT i.id, i.login
      FROM eip_auth.auth_identity i
      JOIN eip_authz.identity_role ir ON ir.tenant_id = i.tenant_id AND ir.identity_id = i.id
      JOIN eip_authz.role r ON r.id = ir.role_id
      WHERE i.tenant_id = $1
        AND i.id = $2
        AND i.is_active = true
        AND r.code IN ('ADMIN_EXEC','ADMIN_ASSOC','ADMIN_SUPER')
      LIMIT 1
      `,
      [eipTenantId, adminIdentityId]
    );
    return r.rows[0] || null;
  }

  if (adminLogin) {
    const r = await app.db.query(
      `
      SELECT i.id, i.login
      FROM eip_auth.auth_identity i
      JOIN eip_authz.identity_role ir ON ir.tenant_id = i.tenant_id AND ir.identity_id = i.id
      JOIN eip_authz.role r ON r.id = ir.role_id
      WHERE i.tenant_id = $1
        AND i.login = $2
        AND i.is_active = true
        AND r.code IN ('ADMIN_EXEC','ADMIN_ASSOC','ADMIN_SUPER')
      LIMIT 1
      `,
      [eipTenantId, adminLogin]
    );
    return r.rows[0] || null;
  }

  return null;
}

async function loadPortfolio(app, portfolioId) {
  const r = await app.db.query(
    `
    SELECT id, admin_identity_id, code, name, is_active
    FROM eip_authz.admin_portfolio
    WHERE id = $1
    LIMIT 1
    `,
    [portfolioId]
  );
  return r.rows[0] || null;
}

export default async function adminPortfolioRoutes(app) {
  app.get("/admin/portfolios", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.portfolio.read");
    if (!session) return;

    const eipTenantId = await resolveEipTenantId(app);
    if (!eipTenantId) {
      return reply.code(500).send({ ok: false, error: "EIP_TENANT_NOT_FOUND" });
    }

    const r = await app.db.query(
      `
      SELECT
        p.id,
        p.admin_identity_id,
        p.code,
        p.name,
        p.is_active,
        p.attrs,
        p.created_at,
        p.updated_at,
        i.login AS admin_login,
        array_agg(DISTINCT r.code ORDER BY r.code) FILTER (WHERE r.code IS NOT NULL) AS roles,
        COUNT(t.id) FILTER (WHERE t.is_active = true) AS tenant_count
      FROM eip_authz.admin_portfolio p
      JOIN eip_auth.auth_identity i ON i.id = p.admin_identity_id
      LEFT JOIN eip_authz.identity_role ir ON ir.tenant_id = i.tenant_id AND ir.identity_id = i.id
      LEFT JOIN eip_authz.role r ON r.id = ir.role_id
      LEFT JOIN eip_core.tenant t ON t.admin_portfolio_id = p.id
      WHERE i.tenant_id = $1
      GROUP BY p.id, i.login
      ORDER BY i.login
      `,
      [eipTenantId]
    );

    return reply.send({ ok: true, portfolios: r.rows || [] });
  });

  app.get("/admin/portfolios/admins", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.portfolio.read");
    if (!session) return;

    const eipTenantId = await resolveEipTenantId(app);
    if (!eipTenantId) {
      return reply.code(500).send({ ok: false, error: "EIP_TENANT_NOT_FOUND" });
    }

    const r = await app.db.query(
      `
      SELECT
        i.id,
        i.login,
        array_agg(DISTINCT r.code ORDER BY r.code) AS roles
      FROM eip_auth.auth_identity i
      JOIN eip_authz.identity_role ir ON ir.tenant_id = i.tenant_id AND ir.identity_id = i.id
      JOIN eip_authz.role r ON r.id = ir.role_id
      WHERE i.tenant_id = $1
        AND i.is_active = true
        AND r.code IN ('ADMIN_EXEC','ADMIN_ASSOC','ADMIN_SUPER')
      GROUP BY i.id, i.login
      ORDER BY i.login
      `,
      [eipTenantId]
    );

    return reply.send({ ok: true, admins: r.rows || [] });
  });

  app.get("/admin/portfolios/tenants", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.portfolio.read");
    if (!session) return;

    const query = normalizeText(req.query?.query);
    const params = [];
    const where = ["is_active = true"];
    if (query) {
      params.push(`%${query}%`);
      const idx = params.length;
      where.push(
        `(code ILIKE $${idx} OR name ILIKE $${idx} OR id::text ILIKE $${idx})`
      );
    }

    const r = await app.db.query(
      `
      SELECT id, code, name, admin_portfolio_id
      FROM eip_core.tenant
      WHERE ${where.join(" AND ")}
      ORDER BY name
      LIMIT 200
      `,
      params
    );

    return reply.send({ ok: true, tenants: r.rows || [] });
  });

  app.get("/admin/portfolios/:id/tenants", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.portfolio.read");
    if (!session) return;

    const portfolioId = normalizeText(req.params.id);
    const r = await app.db.query(
      `
      SELECT id, code, name
      FROM eip_core.tenant
      WHERE admin_portfolio_id = $1
        AND is_active = true
      ORDER BY name
      `,
      [portfolioId]
    );

    return reply.send({ ok: true, tenants: r.rows || [] });
  });

  app.post("/admin/portfolios", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.portfolio.write", {
      csrf: true,
    });
    if (!session) return;

    const adminIdentityId = normalizeText(req.body?.admin_identity_id);
    const adminLogin = normalizeText(req.body?.admin_login);
    const code = normalizeText(req.body?.code) || null;
    const name = normalizeText(req.body?.name) || null;
    const isActive = req.body?.is_active !== false;

    const adminIdentity = await resolveAdminIdentity(app, {
      adminIdentityId,
      adminLogin,
    });
    if (!adminIdentity) {
      return reply.code(404).send({ ok: false, error: "ADMIN_IDENTITY_NOT_FOUND" });
    }

    const r = await app.db.query(
      `
      INSERT INTO eip_authz.admin_portfolio (admin_identity_id, code, name, is_active)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (admin_identity_id)
      DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        is_active = EXCLUDED.is_active,
        updated_at = now()
      RETURNING id, admin_identity_id, code, name, is_active
      `,
      [adminIdentity.id, code, name, isActive]
    );

    return reply.send({ ok: true, portfolio: r.rows[0] });
  });

  app.patch("/admin/portfolios/:id", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.portfolio.write", {
      csrf: true,
    });
    if (!session) return;

    const portfolioId = normalizeText(req.params.id);
    const portfolio = await loadPortfolio(app, portfolioId);
    if (!portfolio) {
      return reply.code(404).send({ ok: false, error: "PORTFOLIO_NOT_FOUND" });
    }

    const code = normalizeText(req.body?.code) || portfolio.code;
    const name = normalizeText(req.body?.name) || portfolio.name;
    const isActive =
      typeof req.body?.is_active === "boolean" ? req.body.is_active : portfolio.is_active;

    const r = await app.db.query(
      `
      UPDATE eip_authz.admin_portfolio
      SET code = $2,
          name = $3,
          is_active = $4,
          updated_at = now()
      WHERE id = $1
      RETURNING id, admin_identity_id, code, name, is_active
      `,
      [portfolioId, code, name, isActive]
    );

    return reply.send({ ok: true, portfolio: r.rows[0] });
  });

  app.post("/admin/portfolios/:id/tenants", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.portfolio.assign", {
      csrf: true,
    });
    if (!session) return;

    const portfolioId = normalizeText(req.params.id);
    const tenantId = normalizeText(req.body?.tenant_id);
    if (!tenantId) {
      return reply.code(400).send({ ok: false, error: "TENANT_ID_REQUIRED" });
    }

    const portfolio = await loadPortfolio(app, portfolioId);
    if (!portfolio) {
      return reply.code(404).send({ ok: false, error: "PORTFOLIO_NOT_FOUND" });
    }

    await app.db.query(
      `
      UPDATE eip_core.tenant
      SET admin_portfolio_id = $1
      WHERE id = $2
      `,
      [portfolioId, tenantId]
    );

    return reply.send({ ok: true });
  });

  app.delete("/admin/portfolios/:id/tenants/:tenantId", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.portfolio.assign", {
      csrf: true,
    });
    if (!session) return;

    const portfolioId = normalizeText(req.params.id);
    const tenantId = normalizeText(req.params.tenantId);

    await app.db.query(
      `
      UPDATE eip_core.tenant
      SET admin_portfolio_id = NULL
      WHERE id = $2
        AND admin_portfolio_id = $1
      `,
      [portfolioId, tenantId]
    );

    return reply.send({ ok: true });
  });
}
