// services/api/src/routes/admin_access.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { hasPermission } from "../auth/perm.js";
import { evaluatePasswordStrength } from "../auth/password.js";
import { auditSecurityEvent } from "../lib/securityAudit.js";
import { safeUploadTarget, uploadPartToBuffer, validateImageUpload } from "../lib/uploadSecurity.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSET_ROOT = path.join(__dirname, "../../assets");
const DEFAULT_TRANSLATION_BILLING = {
  charge_mode: "pass_through",
  markup_percent: 0,
  fixed_fee_minor: 0,
  currency: "USD"
};

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeCurrency(value, fallback = "USD") {
  const upper = String(value || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(upper) ? upper : fallback;
}

function normalizePercentage(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(500, n));
}

function normalizeNonNegativeInteger(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function normalizeChargeMode(value, fallback = "pass_through") {
  const mode = String(value || "").trim().toLowerCase();
  if (!mode) return fallback;
  return mode;
}

function normalizeTranslationBilling(input, fallback = DEFAULT_TRANSLATION_BILLING) {
  const base = fallback && typeof fallback === "object" ? fallback : DEFAULT_TRANSLATION_BILLING;
  const src = input && typeof input === "object" ? input : {};
  return {
    charge_mode: normalizeChargeMode(src.charge_mode, normalizeChargeMode(base.charge_mode, "pass_through")),
    markup_percent: normalizePercentage(src.markup_percent, normalizePercentage(base.markup_percent, 0)),
    fixed_fee_minor: normalizeNonNegativeInteger(
      src.fixed_fee_minor,
      normalizeNonNegativeInteger(base.fixed_fee_minor, 0)
    ),
    currency: normalizeCurrency(src.currency, normalizeCurrency(base.currency, "USD"))
  };
}

function mergeTranslationBillingIntoAttrs(attrs, billingPatch) {
  const safeAttrs = attrs && typeof attrs === "object" ? { ...attrs } : {};
  const translation = safeAttrs.translation && typeof safeAttrs.translation === "object"
    ? { ...safeAttrs.translation }
    : {};
  const existingBilling = translation.billing && typeof translation.billing === "object"
    ? translation.billing
    : DEFAULT_TRANSLATION_BILLING;
  translation.billing = normalizeTranslationBilling(billingPatch, existingBilling);
  safeAttrs.translation = translation;
  return safeAttrs;
}

async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
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

async function loadTenant(app, tenantId) {
  const r = await app.db.query(
    `
    SELECT id, code, name, is_active
    FROM eip_core.tenant
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [tenantId]
  );
  return r.rows[0] || null;
}

async function loadIdentity(app, tenantId, identityId) {
  const r = await app.db.query(
    `
    SELECT id, login, is_active
    FROM eip_auth.auth_identity
    WHERE tenant_id = $1::uuid AND id = $2::uuid
    LIMIT 1
    `,
    [tenantId, identityId]
  );
  return r.rows[0] || null;
}

async function loadProfile(app, tenantId, identityId) {
  const r = await app.db.query(
    `
    SELECT id, tenant_id, identity_id, display_name, title, phone, locale, timezone, avatar_url, attrs
    FROM eip_core.user_profile
    WHERE tenant_id = $1::uuid AND identity_id = $2::uuid
    LIMIT 1
    `,
    [tenantId, identityId]
  );
  return r.rows[0] || null;
}

async function upsertProfile(app, tenantId, identityId, payload = {}) {
  const data = payload && typeof payload === "object" ? payload : {};
  const r = await app.db.query(
    `
    INSERT INTO eip_core.user_profile
      (tenant_id, identity_id, display_name, title, phone, locale, timezone, avatar_url, attrs)
    VALUES
      ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb)
    ON CONFLICT (tenant_id, identity_id) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          title = EXCLUDED.title,
          phone = EXCLUDED.phone,
          locale = EXCLUDED.locale,
          timezone = EXCLUDED.timezone,
          avatar_url = COALESCE(EXCLUDED.avatar_url, eip_core.user_profile.avatar_url),
          attrs = EXCLUDED.attrs,
          updated_at = now()
    RETURNING id, tenant_id, identity_id, display_name, title, phone, locale, timezone, avatar_url, attrs
    `,
    [
      tenantId,
      identityId,
      data.display_name || null,
      data.title || null,
      data.phone || null,
      data.locale || null,
      data.timezone || null,
      data.avatar_url || null,
      JSON.stringify(data.attrs || {})
    ]
  );
  return r.rows[0] || null;
}

export default async function adminAccessRoutes(app) {
  app.get("/admin/tenants", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.user.read");
    if (!session) return;

    const query = normalizeText(req.query?.query);
    const params = [];
    const where = [];
    if (query) {
      params.push(`%${query}%`);
      const idx = params.length;
      where.push(
        `(code ILIKE $${idx} OR name ILIKE $${idx} OR id::text ILIKE $${idx})`
      );
    }

    const r = await app.db.query(
      `
      SELECT id, code, name, is_active
      FROM eip_core.tenant
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY name
      LIMIT 200
      `,
      params
    );

    return reply.send({ ok: true, tenants: r.rows || [] });
  });

  app.get("/admin/tenants/:tenantId/users", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.user.read");
    if (!session) return;

    const tenantId = normalizeText(req.params.tenantId);
    const tenant = await loadTenant(app, tenantId);
    if (!tenant) {
      return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
    }

    const r = await app.db.query(
      `
      SELECT
        i.id,
        i.login,
        i.is_active,
        i.created_at,
        up.display_name,
        up.title,
        up.phone,
        up.locale,
        up.timezone,
        up.avatar_url,
        array_agg(DISTINCT r.code ORDER BY r.code) FILTER (WHERE r.code IS NOT NULL) AS roles,
        array_agg(DISTINCT r.id ORDER BY r.id) FILTER (WHERE r.id IS NOT NULL) AS role_ids,
        array_agg(DISTINCT ip.permission_code ORDER BY ip.permission_code)
          FILTER (WHERE ip.permission_code IS NOT NULL) AS permissions
      FROM eip_auth.auth_identity i
      LEFT JOIN eip_core.user_profile up
        ON up.tenant_id = i.tenant_id AND up.identity_id = i.id
      LEFT JOIN eip_authz.identity_role ir
        ON ir.tenant_id = i.tenant_id AND ir.identity_id = i.id
      LEFT JOIN eip_authz.role r ON r.id = ir.role_id
      LEFT JOIN eip_authz.identity_permission ip
        ON ip.tenant_id = i.tenant_id AND ip.identity_id = i.id
      WHERE i.tenant_id = $1::uuid
      GROUP BY i.id, up.display_name, up.title, up.phone, up.locale, up.timezone, up.avatar_url
      ORDER BY i.login
      `,
      [tenantId]
    );

    return reply.send({ ok: true, users: r.rows || [] });
  });

  app.get("/admin/tenants/:tenantId/roles", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.user.read");
    if (!session) return;

    const tenantId = normalizeText(req.params.tenantId);
    const tenant = await loadTenant(app, tenantId);
    if (!tenant) {
      return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
    }

    const r = await app.db.query(
      `
      SELECT id, code, label, surface_code, is_system, is_active
      FROM eip_authz.role
      WHERE tenant_id = $1::uuid
      ORDER BY code
      `,
      [tenantId]
    );

    return reply.send({ ok: true, roles: r.rows || [] });
  });

  app.get("/admin/tenants/:tenantId/permissions", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.user.read");
    if (!session) return;

    const tenantId = normalizeText(req.params.tenantId);
    const tenant = await loadTenant(app, tenantId);
    if (!tenant) {
      return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
    }

    const query = normalizeText(req.query?.query);
    const params = [];
    const where = [];
    if (query) {
      params.push(`%${query}%`);
      const idx = params.length;
      where.push(`(code ILIKE $${idx} OR label ILIKE $${idx} OR description ILIKE $${idx})`);
    }

    const r = await app.db.query(
      `
      SELECT code, label, description
      FROM eip_authz.permission
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY code
      `,
      params
    );

    return reply.send({ ok: true, permissions: r.rows || [] });
  });

  app.post("/admin/tenants/:tenantId/users", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.user.write", { csrf: true });
    if (!session) return;

    const tenantId = normalizeText(req.params.tenantId);
    const tenant = await loadTenant(app, tenantId);
    if (!tenant) {
      return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
    }

    const email = normalizeText(req.body?.email).toLowerCase();
    const passwordValue = typeof req.body?.password === "string" ? req.body.password : String(req.body?.password || "");
    const roleIds = [];
    const roleId = normalizeText(req.body?.role_id);
    const profileRoleId = normalizeText(req.body?.profile_role_id);
    const accessRoleId = normalizeText(req.body?.access_role_id);
    const extraRoleIds = Array.isArray(req.body?.role_ids) ? req.body.role_ids : [];
    if (roleId) roleIds.push(roleId);
    if (profileRoleId) roleIds.push(profileRoleId);
    if (accessRoleId) roleIds.push(accessRoleId);
    extraRoleIds.forEach((id) => roleIds.push(normalizeText(id)));
    const uniqueRoleIds = Array.from(new Set(roleIds.filter(Boolean)));

    const permissionCodes = [];
    const permissionCode = normalizeText(req.body?.permission_code);
    const extraPermissionCodes = Array.isArray(req.body?.permission_codes) ? req.body.permission_codes : [];
    if (permissionCode) permissionCodes.push(permissionCode);
    extraPermissionCodes.forEach((code) => permissionCodes.push(normalizeText(code)));
    const uniquePermissionCodes = Array.from(new Set(permissionCodes.filter(Boolean)));

    if (!email || !email.includes("@")) {
      return reply.code(400).send({ ok: false, error: "EMAIL_REQUIRED" });
    }
    if (!passwordValue) {
      return reply.code(400).send({ ok: false, error: "PASSWORD_REQUIRED" });
    }
    const strength = evaluatePasswordStrength(passwordValue);
    if (!strength.ok) {
      return reply.code(400).send({ ok: false, error: "WEAK_PASSWORD", feedback: strength.feedback });
    }

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      const identityRes = await client.query(
        `
        INSERT INTO eip_auth.auth_identity (tenant_id, login, login_type, attrs)
        VALUES ($1::uuid, $2, 'email', $3::jsonb)
        RETURNING id, login, is_active, created_at
        `,
        [tenantId, email, JSON.stringify({ created_by_admin: true })]
      );

      const identity = identityRes.rows[0];
      const secretHash = await hashPassword(passwordValue);
      await client.query(
        `
        INSERT INTO eip_auth.auth_credential
          (tenant_id, identity_id, credential_type, secret_hash, algorithm, meta, valid_from, is_revoked)
        VALUES
          ($1::uuid, $2::uuid, 'password', $3, 'argon2id', '{}'::jsonb, now(), false)
        `,
        [tenantId, identity.id, secretHash]
      );

      const defaultName = identity.login ? identity.login.split("@")[0] : null;
      await client.query(
        `
        INSERT INTO eip_core.user_profile (tenant_id, identity_id, display_name)
        VALUES ($1::uuid, $2::uuid, $3)
        ON CONFLICT (tenant_id, identity_id) DO NOTHING
        `,
        [tenantId, identity.id, defaultName || null]
      );

      if (uniqueRoleIds.length) {
        const roleRes = await client.query(
          `
          SELECT id
          FROM eip_authz.role
          WHERE tenant_id = $1::uuid
            AND id = ANY($2::uuid[])
            AND is_active = true
          `,
          [tenantId, uniqueRoleIds]
        );
        if (roleRes.rowCount !== uniqueRoleIds.length) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "ROLE_NOT_FOUND" });
        }
        const grantedBy = session.tenant_id === tenantId ? session.identity_id : null;
        await Promise.all(
          uniqueRoleIds.map((rid) =>
            client.query(
              `
              INSERT INTO eip_authz.identity_role (tenant_id, identity_id, role_id, granted_by_identity_id)
              VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid)
              ON CONFLICT DO NOTHING
              `,
              [tenantId, identity.id, rid, grantedBy]
            )
          )
        );
      }

      if (uniquePermissionCodes.length) {
        const permRes = await client.query(
          `
          SELECT code
          FROM eip_authz.permission
          WHERE code = ANY($1::text[])
          `,
          [uniquePermissionCodes]
        );
        if (permRes.rowCount !== uniquePermissionCodes.length) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "PERMISSION_NOT_FOUND" });
        }
        const grantedBy = session.tenant_id === tenantId ? session.identity_id : null;
        await Promise.all(
          uniquePermissionCodes.map((code) =>
            client.query(
              `
              INSERT INTO eip_authz.identity_permission (tenant_id, identity_id, permission_code, granted_by_identity_id)
              VALUES ($1::uuid, $2::uuid, $3, $4::uuid)
              ON CONFLICT DO NOTHING
              `,
              [tenantId, identity.id, code, grantedBy]
            )
          )
        );
      }

      await client.query("COMMIT");
      return reply.send({ ok: true, user: identity });
    } catch (err) {
      await client.query("ROLLBACK");
      if (String(err?.code) === "23505") {
        return reply.code(409).send({ ok: false, error: "IDENTITY_EXISTS" });
      }
      app.log.error({ event: "admin_user_create_error", error: err.message });
      return reply.code(500).send({ ok: false, error: "CREATE_FAILED" });
    } finally {
      client.release();
    }
  });

  app.get("/admin/tenants/:tenantId/users/:identityId/profile", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.user.read");
    if (!session) return;

    const tenantId = normalizeText(req.params.tenantId);
    const identityId = normalizeText(req.params.identityId);
    const tenant = await loadTenant(app, tenantId);
    if (!tenant) {
      return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
    }
    const identity = await loadIdentity(app, tenantId, identityId);
    if (!identity) {
      return reply.code(404).send({ ok: false, error: "IDENTITY_NOT_FOUND" });
    }

    let profile = await loadProfile(app, tenantId, identityId);
    if (!profile) {
      const defaultName = identity.login ? identity.login.split("@")[0] : null;
      profile = await upsertProfile(app, tenantId, identityId, {
        display_name: defaultName || null
      });
    }
    return reply.send({ ok: true, profile, login: identity.login });
  });

  app.put("/admin/tenants/:tenantId/users/:identityId/profile", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.user.write", { csrf: true });
    if (!session) return;

    const tenantId = normalizeText(req.params.tenantId);
    const identityId = normalizeText(req.params.identityId);
    const tenant = await loadTenant(app, tenantId);
    if (!tenant) {
      return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
    }
    const identity = await loadIdentity(app, tenantId, identityId);
    if (!identity) {
      return reply.code(404).send({ ok: false, error: "IDENTITY_NOT_FOUND" });
    }

    const payload = {
      display_name: normalizeText(req.body?.display_name) || null,
      title: normalizeText(req.body?.title) || null,
      phone: normalizeText(req.body?.phone) || null,
      locale: normalizeText(req.body?.locale) || null,
      timezone: normalizeText(req.body?.timezone) || null,
      avatar_url: normalizeText(req.body?.avatar_url) || null,
      attrs: req.body?.attrs && typeof req.body.attrs === "object" ? req.body.attrs : {}
    };

    const profile = await upsertProfile(app, tenantId, identityId, payload);
    auditSecurityEvent(app, "admin_profile_update", {
      actorTenantId: session.tenant_id,
      actorIdentityId: session.identity_id,
      targetTenantId: tenantId,
      targetIdentityId: identityId,
      outcome: "success",
      ip: req.ip
    });
    return reply.send({ ok: true, profile });
  });

  app.post("/admin/tenants/:tenantId/users/:identityId/avatar", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.user.write", { csrf: true });
    if (!session) return;

    if (!req.isMultipart()) {
      return reply.code(415).send({ ok: false, error: "MULTIPART_REQUIRED" });
    }

    const tenantId = normalizeText(req.params.tenantId);
    const identityId = normalizeText(req.params.identityId);
    const tenant = await loadTenant(app, tenantId);
    if (!tenant) {
      return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
    }
    const identity = await loadIdentity(app, tenantId, identityId);
    if (!identity) {
      return reply.code(404).send({ ok: false, error: "IDENTITY_NOT_FOUND" });
    }

    const bodyFile = req.body?.file;
    let filePart = bodyFile;
    if (!filePart?.file && typeof filePart?.toBuffer !== "function") {
      filePart = await req.file();
    }
    if (!filePart || (!filePart.file && typeof filePart.toBuffer !== "function")) {
      return reply.code(400).send({ ok: false, error: "FILE_REQUIRED" });
    }

    const { filename, mimetype } = filePart;
    const buffer = await uploadPartToBuffer(filePart);
    const validation = validateImageUpload({ buffer, filename, mimetype });
    if (!validation.ok) {
      return reply.code(415).send({ ok: false, error: validation.error });
    }

    const uploadDir = path.join(ASSET_ROOT, tenantId, "avatars");
    fs.mkdirSync(uploadDir, { recursive: true });

    const storedName = `${identityId}-${randomUUID()}${validation.safeExt}`;
    const targetPath = safeUploadTarget(uploadDir, storedName);

    try {
      fs.writeFileSync(targetPath, buffer);
    } catch (err) {
      app.log.error({ event: "profile_avatar_upload_error", error: err.message });
      return reply.code(500).send({ ok: false, error: "UPLOAD_FAILED" });
    }

    const rawUrl = `/assets/${tenantId}/avatars/${storedName}`;
    const profile = await upsertProfile(app, tenantId, identityId, {
      avatar_url: rawUrl
    });
    auditSecurityEvent(app, "admin_avatar_upload", {
      actorTenantId: session.tenant_id,
      actorIdentityId: session.identity_id,
      targetTenantId: tenantId,
      targetIdentityId: identityId,
      outcome: "success",
      ip: req.ip
    });

    return reply.send({ ok: true, avatar_url: rawUrl, profile });
  });

  app.post("/admin/tenants/:tenantId/users/:identityId/roles", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.user.write", { csrf: true });
    if (!session) return;

    const tenantId = normalizeText(req.params.tenantId);
    const identityId = normalizeText(req.params.identityId);
    const roleId = normalizeText(req.body?.role_id);
    if (!roleId) {
      return reply.code(400).send({ ok: false, error: "ROLE_ID_REQUIRED" });
    }

    const identity = await app.db.query(
      `
      SELECT id
      FROM eip_auth.auth_identity
      WHERE tenant_id = $1::uuid AND id = $2::uuid
      `,
      [tenantId, identityId]
    );
    if (identity.rowCount === 0) {
      return reply.code(404).send({ ok: false, error: "IDENTITY_NOT_FOUND" });
    }

    const role = await app.db.query(
      `
      SELECT id
      FROM eip_authz.role
      WHERE tenant_id = $1::uuid AND id = $2::uuid AND is_active = true
      `,
      [tenantId, roleId]
    );
    if (role.rowCount === 0) {
      return reply.code(404).send({ ok: false, error: "ROLE_NOT_FOUND" });
    }

    const grantedBy = session.tenant_id === tenantId ? session.identity_id : null;
    await app.db.query(
      `
      INSERT INTO eip_authz.identity_role (tenant_id, identity_id, role_id, granted_by_identity_id)
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid)
      ON CONFLICT DO NOTHING
      `,
      [tenantId, identityId, roleId, grantedBy]
    );

    return reply.send({ ok: true });
  });

  app.delete(
    "/admin/tenants/:tenantId/users/:identityId/roles/:roleId",
    async (req, reply) => {
      const session = await requireAdminPerm(app, req, reply, "admin.user.write", { csrf: true });
      if (!session) return;

      const tenantId = normalizeText(req.params.tenantId);
      const identityId = normalizeText(req.params.identityId);
      const roleId = normalizeText(req.params.roleId);

      await app.db.query(
        `
        DELETE FROM eip_authz.identity_role
        WHERE tenant_id = $1::uuid
          AND identity_id = $2::uuid
          AND role_id = $3::uuid
        `,
        [tenantId, identityId, roleId]
      );

      return reply.send({ ok: true });
    }
  );

  app.post("/admin/tenants/:tenantId/users/:identityId/permissions", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.user.write", { csrf: true });
    if (!session) return;

    const tenantId = normalizeText(req.params.tenantId);
    const identityId = normalizeText(req.params.identityId);
    const permissionCode = normalizeText(req.body?.permission_code);
    if (!permissionCode) {
      return reply.code(400).send({ ok: false, error: "PERMISSION_REQUIRED" });
    }

    const identity = await app.db.query(
      `
      SELECT id
      FROM eip_auth.auth_identity
      WHERE tenant_id = $1::uuid AND id = $2::uuid
      `,
      [tenantId, identityId]
    );
    if (identity.rowCount === 0) {
      return reply.code(404).send({ ok: false, error: "IDENTITY_NOT_FOUND" });
    }

    const perm = await app.db.query(
      `
      SELECT code
      FROM eip_authz.permission
      WHERE code = $1
      `,
      [permissionCode]
    );
    if (perm.rowCount === 0) {
      return reply.code(404).send({ ok: false, error: "PERMISSION_NOT_FOUND" });
    }

    const grantedBy = session.tenant_id === tenantId ? session.identity_id : null;
    await app.db.query(
      `
      INSERT INTO eip_authz.identity_permission (tenant_id, identity_id, permission_code, granted_by_identity_id)
      VALUES ($1::uuid, $2::uuid, $3, $4::uuid)
      ON CONFLICT DO NOTHING
      `,
      [tenantId, identityId, permissionCode, grantedBy]
    );

    return reply.send({ ok: true });
  });

  app.delete(
    "/admin/tenants/:tenantId/users/:identityId/permissions/:permissionCode",
    async (req, reply) => {
      const session = await requireAdminPerm(app, req, reply, "admin.user.write", { csrf: true });
      if (!session) return;

      const tenantId = normalizeText(req.params.tenantId);
      const identityId = normalizeText(req.params.identityId);
      const permissionCode = normalizeText(req.params.permissionCode);

      await app.db.query(
        `
        DELETE FROM eip_authz.identity_permission
        WHERE tenant_id = $1::uuid
          AND identity_id = $2::uuid
          AND permission_code = $3
        `,
        [tenantId, identityId, permissionCode]
      );

      return reply.send({ ok: true });
    }
  );

  app.get("/admin/tenants/:tenantId/modules", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.module.read");
    if (!session) return;

    const tenantId = normalizeText(req.params.tenantId);
    const tenant = await loadTenant(app, tenantId);
    if (!tenant) {
      return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
    }

    const bundleRes = await app.db.query(
      `
      SELECT DISTINCT module
      FROM eip_core.schema_bundle
      WHERE tenant_id = $1::uuid
        AND is_published = true
      `,
      [tenantId]
    );

    const settingRes = await app.db.query(
      `
      SELECT module, attrs, is_active, updated_at
      FROM eip_core.tenant_module_setting
      WHERE tenant_id = $1::uuid
        AND code = 'subscription'
      `,
      [tenantId]
    );

    const catalogRes = await app.db.query(
      `
      SELECT code, label, description, is_active, attrs
      FROM eip_core.module_catalog
      `
    );
    const catalogMap = new Map(
      (catalogRes.rows || []).map((row) => [row.code, row])
    );

    const modules = new Map();
    (bundleRes.rows || []).forEach((row) => {
      const catalog = catalogMap.get(row.module) || {};
      modules.set(row.module, {
        module: row.module,
        enabled: true,
        explicit: false,
        source: "bundle",
        label: catalog.label,
        description: catalog.description,
        catalog_active: catalog.is_active,
      });
    });
    (settingRes.rows || []).forEach((row) => {
      const existing = modules.get(row.module) || {};
      const catalog = catalogMap.get(row.module) || {};
      modules.set(row.module, {
        module: row.module,
        enabled: row.is_active === true,
        explicit: true,
        source: "setting",
        attrs: row.attrs || {},
        updated_at: row.updated_at,
        inferred: existing.explicit === false ? true : false,
        label: catalog.label || existing.label,
        description: catalog.description || existing.description,
        catalog_active: catalog.is_active ?? existing.catalog_active,
      });
    });

    const items = Array.from(modules.values()).sort((a, b) =>
      String(a.module).localeCompare(String(b.module))
    );

    return reply.send({ ok: true, modules: items });
  });

  app.get("/admin/modules/catalog", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.module.read");
    if (!session) return;

    const query = normalizeText(req.query?.query);
    const params = [];
    const where = [];
    if (query) {
      params.push(`%${query}%`);
      const idx = params.length;
      where.push(`(code ILIKE $${idx} OR label ILIKE $${idx} OR description ILIKE $${idx})`);
    }

    const r = await app.db.query(
      `
      SELECT code, label, description, is_active, attrs
      FROM eip_core.module_catalog
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY label, code
      `,
      params
    );

    return reply.send({ ok: true, modules: r.rows || [] });
  });

  app.post("/admin/modules/catalog", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.module.write", { csrf: true });
    if (!session) return;

    const code = normalizeText(req.body?.code).toLowerCase();
    const label = normalizeText(req.body?.label);
    const description = normalizeText(req.body?.description);
    const attrs = req.body?.attrs && typeof req.body.attrs === "object" ? req.body.attrs : {};
    const isActive = req.body?.is_active !== false;

    if (!code) {
      return reply.code(400).send({ ok: false, error: "CODE_REQUIRED" });
    }

    const labelForInsert = label || code;
    const labelProvided = Boolean(label);
    const descriptionProvided = Boolean(description);

    const r = await app.db.query(
      `
      INSERT INTO eip_core.module_catalog (code, label, description, attrs, is_active)
      VALUES ($1, $2, $3, $4::jsonb, $5)
      ON CONFLICT (code) DO UPDATE
        SET label = CASE WHEN $6 THEN EXCLUDED.label ELSE eip_core.module_catalog.label END,
            description = CASE WHEN $7 THEN EXCLUDED.description ELSE eip_core.module_catalog.description END,
            attrs = eip_core.module_catalog.attrs || EXCLUDED.attrs,
            is_active = EXCLUDED.is_active,
            updated_at = now()
      RETURNING code, label, description, is_active, attrs
      `,
      [
        code,
        labelForInsert,
        description || null,
        JSON.stringify(attrs || {}),
        isActive,
        labelProvided,
        descriptionProvided
      ]
    );

    return reply.send({ ok: true, module: r.rows[0] });
  });

  app.post("/admin/tenants/:tenantId/modules", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.module.write", { csrf: true });
    if (!session) return;

    const tenantId = normalizeText(req.params.tenantId);
    const tenant = await loadTenant(app, tenantId);
    if (!tenant) {
      return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
    }

    const moduleCode = normalizeText(req.body?.module);
    if (!moduleCode) {
      return reply.code(400).send({ ok: false, error: "MODULE_REQUIRED" });
    }

    const enabled = req.body?.enabled !== false;
    const attrs = req.body?.attrs && typeof req.body.attrs === "object" ? req.body.attrs : {};
    const label = normalizeText(req.body?.label);
    const description = normalizeText(req.body?.description);

    const r = await app.db.query(
      `
      INSERT INTO eip_core.tenant_module_setting
        (tenant_id, module, code, attrs, is_active)
      VALUES
        ($1::uuid, $2, 'subscription', $3::jsonb, $4)
      ON CONFLICT (tenant_id, module, code) DO UPDATE
        SET attrs = EXCLUDED.attrs,
            is_active = EXCLUDED.is_active,
            updated_at = now()
      RETURNING module, attrs, is_active, updated_at
      `,
      [tenantId, moduleCode, JSON.stringify(attrs || {}), enabled]
    );

    if (moduleCode) {
      const labelForInsert = label || moduleCode;
      const labelProvided = Boolean(label);
      const descriptionProvided = Boolean(description);
      await app.db.query(
        `
        INSERT INTO eip_core.module_catalog (code, label, description, attrs, is_active)
        VALUES ($1, $2, $3, $4::jsonb, true)
        ON CONFLICT (code) DO UPDATE
          SET label = CASE WHEN $5 THEN EXCLUDED.label ELSE eip_core.module_catalog.label END,
              description = CASE WHEN $6 THEN EXCLUDED.description ELSE eip_core.module_catalog.description END,
              attrs = eip_core.module_catalog.attrs || EXCLUDED.attrs,
              is_active = true,
              updated_at = now()
        `,
        [
          moduleCode,
          labelForInsert,
          description || null,
          JSON.stringify(attrs || {}),
          labelProvided,
          descriptionProvided
        ]
      );
    }

    return reply.send({ ok: true, module: r.rows[0] });
  });

  app.get("/admin/tenants/:tenantId/ecom/translation/billing", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.module.read");
    if (!session) return;

    const tenantId = normalizeText(req.params.tenantId);
    const tenant = await loadTenant(app, tenantId);
    if (!tenant) {
      return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
    }

    const r = await app.db.query(
      `
      SELECT attrs
      FROM eip_core.tenant_module_setting
      WHERE tenant_id = $1::uuid
        AND module = 'ecom'
        AND code = 'commerce'
      LIMIT 1
      `,
      [tenantId]
    );

    const attrs = r.rows[0]?.attrs && typeof r.rows[0].attrs === "object" ? r.rows[0].attrs : {};
    const translation = attrs.translation && typeof attrs.translation === "object" ? attrs.translation : {};
    const billing = normalizeTranslationBilling(
      translation.billing && typeof translation.billing === "object" ? translation.billing : {},
      DEFAULT_TRANSLATION_BILLING
    );

    return reply.send({ ok: true, billing });
  });

  app.put(
    "/admin/tenants/:tenantId/ecom/translation/billing",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            charge_mode: { type: "string", maxLength: 64 },
            markup_percent: { type: "number" },
            fixed_fee_minor: { type: "integer", minimum: 0 },
            currency: { type: "string", minLength: 3, maxLength: 3 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireAdminPerm(app, req, reply, "admin.module.write", { csrf: true });
      if (!session) return;

      const tenantId = normalizeText(req.params.tenantId);
      const tenant = await loadTenant(app, tenantId);
      if (!tenant) {
        return reply.code(404).send({ ok: false, error: "TENANT_NOT_FOUND" });
      }

      const r = await app.db.query(
        `
        SELECT attrs
        FROM eip_core.tenant_module_setting
        WHERE tenant_id = $1::uuid
          AND module = 'ecom'
          AND code = 'commerce'
        LIMIT 1
        `,
        [tenantId]
      );
      const currentAttrs = r.rows[0]?.attrs && typeof r.rows[0].attrs === "object" ? r.rows[0].attrs : {};
      const nextAttrs = mergeTranslationBillingIntoAttrs(currentAttrs, req.body || {});
      const billing = normalizeTranslationBilling(
        nextAttrs?.translation?.billing && typeof nextAttrs.translation.billing === "object"
          ? nextAttrs.translation.billing
          : {},
        DEFAULT_TRANSLATION_BILLING
      );

      await app.db.query(
        `
        INSERT INTO eip_core.tenant_module_setting
          (tenant_id, module, code, attrs, is_active)
        VALUES
          ($1::uuid, 'ecom', 'commerce', $2::jsonb, true)
        ON CONFLICT (tenant_id, module, code) DO UPDATE
          SET attrs = EXCLUDED.attrs,
              is_active = true,
              updated_at = now()
        `,
        [tenantId, JSON.stringify(nextAttrs)]
      );

      return reply.send({ ok: true, billing });
    }
  );
}
