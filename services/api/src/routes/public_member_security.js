import argon2 from "argon2";
import { randomToken, sha256Hex } from "../auth/crypto.js";
import {
  checkPasswordHistory,
  clearFailedLoginAttempts,
  evaluatePasswordStrength
} from "../auth/password.js";
import { sendEmail } from "../lib/email.js";
import { extractProfiles } from "../services/gateway/connectionProfile.js";
import { hydrateConnectionProfileSecrets } from "../services/gateway/secretStore.js";
import { connectionAllowsOrigin, verifyConnectionRequest } from "../services/gateway/verification.js";

const RATE_LIMIT = { max: 12, timeWindow: "1 minute" };
const RESET_TTL_MS = 60 * 60 * 1000;

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function applyCors(reply, origin) {
  if (!origin) return;
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Credentials", "true");
  reply.header("Access-Control-Allow-Headers", "Content-Type, X-API-Key, X-Member-Csrf");
}

function resetPepper(app) {
  return normalizeText(app?.config?.PASSWORD_RESET_PEPPER || app?.config?.API_KEY_PEPPER);
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
  if (r.rowCount !== 1) return null;
  const tenant = r.rows[0];
  const profiles = extractProfiles(tenant.attrs);
  const profile = profiles.find((item) => item?.inbound?.inbound_path_suffix === suffix);
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
  profile = await hydrateConnectionProfileSecrets(app, app.db, resolved.tenant.id, profile);
  const raw = Buffer.from(JSON.stringify(req.body || {}));
  const verified = await verifyConnectionRequest(req, profile, raw);
  if (!verified.ok) {
    reply.code(401).send({ ok: false, error: verified.error });
    return null;
  }
  applyCors(reply, origin);
  return { tenant: resolved.tenant, profile, suffix, origin };
}

async function loadMemberSession(app, req, tenantId, suffix) {
  const sid = normalizeText(req.cookies?.member_sid);
  if (!sid) return null;
  const r = await app.db.query(
    `
    SELECT id, tenant_id, identity_id, expires_at, is_revoked, attrs
    FROM eip_auth.auth_session
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [sid]
  );
  if (r.rowCount !== 1) return null;
  const session = r.rows[0];
  if (session.is_revoked || new Date(session.expires_at).getTime() <= Date.now()) return null;
  if (String(session.tenant_id) !== String(tenantId)) return null;
  const attrs = session.attrs && typeof session.attrs === "object" ? session.attrs : {};
  if (String(attrs.realm || "").toUpperCase() !== "MEMBER") return null;
  if (normalizeText(attrs.connection_suffix) !== normalizeText(suffix)) return null;
  return session;
}

export default async function registerPublicMemberSecurityRoutes(app) {
  app.get(
    "/commerce/:suffix/member/auth/pf-context",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      const session = await loadMemberSession(app, req, access.tenant.id, access.suffix);
      if (!session) return reply.code(401).send({ ok: false, error: "MEMBER_UNAUTHENTICATED" });

      const roleRes = await app.db.query(
        `
        SELECT r.code
        FROM eip_authz.identity_role ir
        JOIN eip_authz.role r ON r.id = ir.role_id
        WHERE ir.tenant_id = $1
          AND ir.identity_id = $2
          AND r.is_active = true
          AND r.code = 'PF_ADMIN'
        LIMIT 1
        `,
        [access.tenant.id, session.identity_id]
      );

      return reply.send({
        ok: true,
        pf_role: roleRes.rowCount ? "administrator" : "member",
        identity_id: session.identity_id
      });
    }
  );

  app.post(
    "/commerce/:suffix/member/auth/password/forgot",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      const email = normalizeEmail(req.body?.email);
      if (!email) return reply.code(400).send({ ok: false, error: "EMAIL_REQUIRED" });

      const generic = { ok: true, message: "If the account exists, a secure reset link has been sent." };
      const idRes = await app.db.query(
        `
        SELECT id, is_active, is_locked
        FROM eip_auth.auth_identity
        WHERE tenant_id = $1 AND lower(login) = $2
        LIMIT 1
        `,
        [access.tenant.id, email]
      );
      if (idRes.rowCount !== 1 || !idRes.rows[0].is_active || idRes.rows[0].is_locked) {
        return reply.send(generic);
      }

      const token = randomToken(32);
      const tokenHash = sha256Hex(`${token}:${resetPepper(app)}`);
      const expiresAt = new Date(Date.now() + RESET_TTL_MS);
      await app.db.query(
        `
        INSERT INTO eip_auth.auth_password_reset
          (id, tenant_id, identity_id, token_hash, expires_at, requested_ip, requested_user_agent)
        VALUES
          (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
        `,
        [
          access.tenant.id,
          idRes.rows[0].id,
          tokenHash,
          expiresAt,
          req.ip,
          String(req.headers["user-agent"] || "").slice(0, 255)
        ]
      );

      const origin = new URL(access.origin).origin;
      const resetUrl = new URL(origin);
      resetUrl.searchParams.set("pf_reset_token", token);
      const subject = "Reset your Perfect Fit password";
      const text = `Use this secure link to reset your Perfect Fit password:\n\n${resetUrl.toString()}\n\nThis link expires in 60 minutes.`;
      const html = `<p>Use this secure link to reset your Perfect Fit password:</p><p><a href="${resetUrl.toString()}">${resetUrl.toString()}</a></p><p>This link expires in 60 minutes.</p>`;
      try {
        await sendEmail(app, email, subject, text, html);
      } catch (error) {
        app.log.error({ event: "pf_password_reset_email_failed", error: error.message });
      }
      return reply.send(generic);
    }
  );

  app.post(
    "/commerce/:suffix/member/auth/password/reset",
    { config: { rateLimit: RATE_LIMIT, cors: false } },
    async (req, reply) => {
      const access = await resolveAccess(app, req, reply);
      if (!access) return;
      const token = normalizeText(req.body?.token);
      const password = String(req.body?.password || "");
      if (!token || !password) return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });

      const strength = evaluatePasswordStrength(password);
      if (!strength.ok) {
        return reply.code(400).send({ ok: false, error: "PASSWORD_WEAK", feedback: strength.feedback });
      }

      const tokenHash = sha256Hex(`${token}:${resetPepper(app)}`);
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const resetRes = await client.query(
          `
          SELECT id, tenant_id, identity_id, expires_at, consumed_at
          FROM eip_auth.auth_password_reset
          WHERE token_hash = $1 AND tenant_id = $2
          LIMIT 1
          FOR UPDATE
          `,
          [tokenHash, access.tenant.id]
        );
        if (resetRes.rowCount !== 1) {
          await client.query("ROLLBACK");
          return reply.code(401).send({ ok: false, error: "RESET_INVALID" });
        }
        const reset = resetRes.rows[0];
        if (reset.consumed_at || new Date(reset.expires_at).getTime() <= Date.now()) {
          await client.query("ROLLBACK");
          return reply.code(401).send({ ok: false, error: "RESET_EXPIRED" });
        }

        const history = await checkPasswordHistory(client, reset.tenant_id, reset.identity_id, password);
        if (!history.ok) {
          await client.query("ROLLBACK");
          return reply.code(400).send({ ok: false, error: history.error || "PASSWORD_REUSE" });
        }

        const newHash = await argon2.hash(password, { type: argon2.argon2id });
        await client.query(
          `
          UPDATE eip_auth.auth_credential
          SET is_revoked = true, valid_to = now()
          WHERE tenant_id = $1
            AND identity_id = $2
            AND credential_type = 'password'
            AND is_revoked = false
          `,
          [reset.tenant_id, reset.identity_id]
        );
        await client.query(
          `
          INSERT INTO eip_auth.auth_credential
            (tenant_id, identity_id, credential_type, secret_hash, algorithm, valid_from, is_revoked)
          VALUES ($1, $2, 'password', $3, 'argon2id', now(), false)
          `,
          [reset.tenant_id, reset.identity_id, newHash]
        );
        await client.query(
          "UPDATE eip_auth.auth_password_reset SET consumed_at = now() WHERE id = $1",
          [reset.id]
        );
        await client.query(
          `
          UPDATE eip_auth.auth_session
          SET is_revoked = true, revoked_at = now()
          WHERE tenant_id = $1 AND identity_id = $2 AND is_revoked = false
          `,
          [reset.tenant_id, reset.identity_id]
        );
        await client.query("COMMIT");
        await clearFailedLoginAttempts(app.db, reset.tenant_id, reset.identity_id);
        return reply.send({ ok: true });
      } catch (error) {
        await client.query("ROLLBACK");
        app.log.error({ event: "pf_password_reset_failed", error: error.message });
        return reply.code(500).send({ ok: false, error: "RESET_FAILED" });
      } finally {
        client.release();
      }
    }
  );
}
