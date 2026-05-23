// services/api/src/routes/tenant_admin_access.js
import { hasPermission } from "../auth/perm.js";
import { randomToken, sha256Hex } from "../auth/crypto.js";
import { auditSecurityEvent } from "../lib/securityAudit.js";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLevel(value) {
  const upper = String(value || "").trim().toUpperCase();
  if (upper === "EXEC" || upper === "ASSOC") return upper;
  return null;
}

async function requireTenantPerm(app, req, reply, permCode, opts = {}) {
  const guard = opts.csrf ? await app.requireCsrf(req) : await app.requireSession(req, { realm: "EIP" });
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

async function resolveOwnerAdminTenantId(app, fallbackTenantId = null) {
  const ownerCode = normalizeText(app.config.OWNER_TENANT_CODE);
  if (!ownerCode) return fallbackTenantId;

  const r = await app.db.query(
    "SELECT id FROM eip_core.tenant WHERE code = $1 AND is_active = true LIMIT 1",
    [ownerCode]
  );
  return r.rows[0]?.id || null;
}

async function resolveOwnerAdminIdentity(app, sourceTenantId, { adminLogin, adminIdentityId }) {
  if (!sourceTenantId) return null;

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
      [sourceTenantId, adminIdentityId]
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
      [sourceTenantId, adminLogin]
    );
    return r.rows[0] || null;
  }

  return null;
}

function createToken(app) {
  const raw = randomToken(32);
  const hash = sha256Hex(`${raw}:${app.config.API_KEY_PEPPER}`);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + TOKEN_TTL_MS);
  return { raw, hash, issuedAt, expiresAt };
}

export default async function tenantAdminAccessRoutes(app) {
  app.get("/tenant/admin-access", async (req, reply) => {
    const session = await requireTenantPerm(app, req, reply, "tenant.admin_access.read");
    if (!session) return;

    const r = await app.db.query(
      `
      SELECT
        a.admin_identity_id,
        i.login AS admin_login,
        a.access_level,
        a.sensitive_allowed,
        a.is_active,
        a.sensitive_token_issued_at,
        a.sensitive_token_expires_at,
        a.sensitive_token_revoked_at,
        a.sensitive_token_last_used_at
      FROM eip_authz.admin_tenant_access a
      LEFT JOIN eip_auth.auth_identity i ON i.id = a.admin_identity_id
      WHERE a.tenant_id = $1
      ORDER BY i.login NULLS LAST
      `,
      [session.tenant_id]
    );

    return reply.send({ ok: true, grants: r.rows });
  });

  app.get("/tenant/admin-access/admins", async (req, reply) => {
    const session = await requireTenantPerm(app, req, reply, "tenant.admin_access.read");
    if (!session) return;

    const ownerTenantId = await resolveOwnerAdminTenantId(app, session.tenant_id);
    if (!ownerTenantId) {
      return reply.code(500).send({ ok: false, error: "OWNER_TENANT_NOT_FOUND" });
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
      [ownerTenantId]
    );

    return reply.send({ ok: true, admins: r.rows });
  });

  app.post("/tenant/admin-access/grant", async (req, reply) => {
    const session = await requireTenantPerm(app, req, reply, "tenant.admin_access.write", { csrf: true });
    if (!session) return;

    const adminLogin = normalizeText(req.body?.admin_login);
    const adminIdentityId = normalizeText(req.body?.admin_identity_id);
    const accessLevel = normalizeLevel(req.body?.access_level) || "ASSOC";
    const sensitiveAllowed = Boolean(req.body?.sensitive_allowed);

    const ownerTenantId = await resolveOwnerAdminTenantId(app, session.tenant_id);
    const adminIdentity = await resolveOwnerAdminIdentity(app, ownerTenantId, {
      adminLogin,
      adminIdentityId,
    });
    if (!adminIdentity) {
      return reply.code(404).send({ ok: false, error: "ADMIN_IDENTITY_NOT_FOUND" });
    }

    let tokenResult = null;
    let issuedBy = session.identity_id;
    let revokedAt = null;

    if (sensitiveAllowed) {
      tokenResult = createToken(app);
    } else {
      revokedAt = new Date();
    }

    await app.db.query(
      `
      INSERT INTO eip_authz.admin_tenant_access (
        admin_identity_id,
        tenant_id,
        access_level,
        sensitive_allowed,
        sensitive_token_hash,
        sensitive_token_issued_at,
        sensitive_token_expires_at,
        sensitive_token_revoked_at,
        sensitive_token_issued_by,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
      ON CONFLICT (admin_identity_id, tenant_id)
      DO UPDATE SET
        access_level = EXCLUDED.access_level,
        sensitive_allowed = EXCLUDED.sensitive_allowed,
        sensitive_token_hash = EXCLUDED.sensitive_token_hash,
        sensitive_token_issued_at = EXCLUDED.sensitive_token_issued_at,
        sensitive_token_expires_at = EXCLUDED.sensitive_token_expires_at,
        sensitive_token_revoked_at = EXCLUDED.sensitive_token_revoked_at,
        sensitive_token_issued_by = EXCLUDED.sensitive_token_issued_by,
        is_active = true,
        updated_at = now()
      `,
      [
        adminIdentity.id,
        session.tenant_id,
        accessLevel,
        sensitiveAllowed,
        tokenResult?.hash || null,
        tokenResult?.issuedAt || null,
        tokenResult?.expiresAt || null,
        revokedAt,
        issuedBy,
      ]
    );
    auditSecurityEvent(app, "tenant_admin_access_grant", {
      actorTenantId: session.tenant_id,
      actorIdentityId: session.identity_id,
      targetTenantId: session.tenant_id,
      adminIdentityId: adminIdentity.id,
      accessLevel,
      sensitiveAllowed,
      outcome: "success",
      ip: req.ip
    });

    return reply.send({
      ok: true,
      admin_identity_id: adminIdentity.id,
      admin_login: adminIdentity.login,
      access_level: accessLevel,
      sensitive_allowed: sensitiveAllowed,
      token: tokenResult?.raw || null,
      token_expires_at: tokenResult?.expiresAt || null,
    });
  });

  app.post("/tenant/admin-access/rotate", async (req, reply) => {
    const session = await requireTenantPerm(app, req, reply, "tenant.admin_access.write", { csrf: true });
    if (!session) return;

    const adminLogin = normalizeText(req.body?.admin_login);
    const adminIdentityId = normalizeText(req.body?.admin_identity_id);
    const ownerTenantId = await resolveOwnerAdminTenantId(app, session.tenant_id);
    const adminIdentity = await resolveOwnerAdminIdentity(app, ownerTenantId, {
      adminLogin,
      adminIdentityId,
    });
    if (!adminIdentity) {
      return reply.code(404).send({ ok: false, error: "ADMIN_IDENTITY_NOT_FOUND" });
    }

    const access = await app.db.query(
      `
      SELECT sensitive_allowed
      FROM eip_authz.admin_tenant_access
      WHERE admin_identity_id=$1 AND tenant_id=$2 AND is_active=true
      LIMIT 1
      `,
      [adminIdentity.id, session.tenant_id]
    );
    if (access.rowCount === 0) {
      return reply.code(404).send({ ok: false, error: "ACCESS_NOT_FOUND" });
    }
    if (!access.rows[0].sensitive_allowed) {
      return reply.code(400).send({ ok: false, error: "SENSITIVE_NOT_ENABLED" });
    }

    const tokenResult = createToken(app);
    await app.db.query(
      `
      UPDATE eip_authz.admin_tenant_access
      SET sensitive_token_hash = $3,
          sensitive_token_issued_at = $4,
          sensitive_token_expires_at = $5,
          sensitive_token_revoked_at = NULL,
          sensitive_token_issued_by = $6,
          updated_at = now()
      WHERE admin_identity_id=$1 AND tenant_id=$2
      `,
      [
        adminIdentity.id,
        session.tenant_id,
        tokenResult.hash,
        tokenResult.issuedAt,
        tokenResult.expiresAt,
        session.identity_id,
      ]
    );
    auditSecurityEvent(app, "tenant_admin_access_rotate", {
      actorTenantId: session.tenant_id,
      actorIdentityId: session.identity_id,
      targetTenantId: session.tenant_id,
      adminIdentityId: adminIdentity.id,
      outcome: "success",
      ip: req.ip
    });

    return reply.send({
      ok: true,
      admin_identity_id: adminIdentity.id,
      admin_login: adminIdentity.login,
      token: tokenResult.raw,
      token_expires_at: tokenResult.expiresAt,
    });
  });

  app.post("/tenant/admin-access/revoke", async (req, reply) => {
    const session = await requireTenantPerm(app, req, reply, "tenant.admin_access.write", { csrf: true });
    if (!session) return;

    const adminLogin = normalizeText(req.body?.admin_login);
    const adminIdentityId = normalizeText(req.body?.admin_identity_id);
    const revokeAll = Boolean(req.body?.revoke_all);

    const ownerTenantId = await resolveOwnerAdminTenantId(app, session.tenant_id);
    const adminIdentity = await resolveOwnerAdminIdentity(app, ownerTenantId, {
      adminLogin,
      adminIdentityId,
    });
    if (!adminIdentity) {
      return reply.code(404).send({ ok: false, error: "ADMIN_IDENTITY_NOT_FOUND" });
    }

    await app.db.query(
      `
      UPDATE eip_authz.admin_tenant_access
      SET sensitive_allowed = false,
          sensitive_token_hash = NULL,
          sensitive_token_issued_at = NULL,
          sensitive_token_expires_at = NULL,
          sensitive_token_revoked_at = now(),
          sensitive_token_issued_by = $3,
          is_active = CASE WHEN $4::boolean THEN false ELSE is_active END,
          updated_at = now()
      WHERE admin_identity_id=$1 AND tenant_id=$2
      `,
      [adminIdentity.id, session.tenant_id, session.identity_id, revokeAll]
    );
    auditSecurityEvent(app, "tenant_admin_access_revoke", {
      actorTenantId: session.tenant_id,
      actorIdentityId: session.identity_id,
      targetTenantId: session.tenant_id,
      adminIdentityId: adminIdentity.id,
      revokeAll,
      outcome: "success",
      ip: req.ip
    });

    return reply.send({
      ok: true,
      admin_identity_id: adminIdentity.id,
      admin_login: adminIdentity.login,
      revoked_all: revokeAll,
    });
  });
}
