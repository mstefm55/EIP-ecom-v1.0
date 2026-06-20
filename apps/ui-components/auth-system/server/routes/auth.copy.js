// services/api/src/routes/auth.js
import { hasPermission } from "../auth/perm.js";

import crypto from "node:crypto";
import { promisify } from "node:util";
import argon2 from "argon2";
import { NobleCryptoPlugin, ScureBase32Plugin, TOTP } from "otplib";
import {
  randomDigits,
  randomToken,
  sha256Hex,
  timingSafeEqual
} from "../auth/crypto.js";
import { sendEmail } from "../lib/email.js";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  createUploadErrorHandler,
  safeUploadTarget,
  sendUploadFailure,
  uploadPartToBuffer,
  validateImageUpload,
  writeVerifiedUpload
} from "../lib/uploadSecurity.js";
import { ensureUploadDirectory, resolveAssetRoot } from "../services/assets/root.js";
import { evaluatePasswordStrength, generateStrongPassword, checkPasswordHistory } from "../auth/password.js";

const OTP_REQUEST_LIMIT_MAX = 5;
const OTP_REQUEST_LIMIT_WINDOW_MIN = 10;
const OTP_REQUEST_RATE_LIMIT = { max: 30, timeWindow: "1 minute" };
const OTP_VERIFY_RATE_LIMIT = { max: 60, timeWindow: "1 minute" };
const PASSWORD_LOGIN_RATE_LIMIT = { max: 20, timeWindow: "1 minute" };
const ORG_LOOKUP_RATE_LIMIT = { max: 10, timeWindow: "1 minute" };
const TOTP_BOOTSTRAP_RATE_LIMIT = { max: 10, timeWindow: "1 minute" };
const TOTP_LOGIN_RATE_LIMIT = { max: 30, timeWindow: "1 minute" };
const PASSWORD_RESET_RATE_LIMIT = { max: 15, timeWindow: "1 minute" };
const RECOVERY_REQUEST_RATE_LIMIT = { max: 10, timeWindow: "1 minute" };
const RECOVERY_CONSUME_RATE_LIMIT = { max: 10, timeWindow: "1 minute" };
const RECOVERY_LOST_RATE_LIMIT = { max: 10, timeWindow: "1 minute" };
const OTP_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const DEVICE_COOKIE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const RECOVERY_TOKEN_DEFAULT_TTL_MIN = 30;

function getRecoveryPepper(app) {
  const raw = String(app?.config?.RECOVERY_TOKEN_PEPPER || "").trim();
  if (raw) return raw;
  return String(app?.config?.API_KEY_PEPPER || "").trim();
}

function resolveRecoveryBase(app) {
  const explicit = String(app?.config?.RECOVERY_TOKEN_URL_BASE || "").trim();
  if (explicit) return explicit;
  const cors = String(app?.config?.CORS_ORIGIN || "").split(",")[0]?.trim();
  return cors || "";
}

function buildRecoveryLink(app, token) {
  const base = resolveRecoveryBase(app);
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.set("surface", "auth");
  url.searchParams.set("recovery", token);
  return url.toString();
}
const SCRYPT_MAX_MEM = 64 * 1024 * 1024;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LEN = 32;
const scryptAsync = promisify(crypto.scrypt);
const TOTP_WINDOW = 1;
const TOTP_PERIOD_SEC = 30;
const TOTP_EPOCH_TOLERANCE_SEC = TOTP_WINDOW * TOTP_PERIOD_SEC;

const totp = new TOTP({
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
  period: TOTP_PERIOD_SEC,
  epochTolerance: TOTP_EPOCH_TOLERANCE_SEC
});

function normalizeOtp(value) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return String(value).padStart(6, "0");
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

function parseScryptHash(value) {
  const parts = String(value || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (N <= 1 || r <= 0 || p <= 0) return null;

  const salt = Buffer.from(parts[4], "base64");
  const hash = Buffer.from(parts[5], "base64");
  if (!salt.length || !hash.length) return null;

  return { N, r, p, salt, hash };
}

async function verifyPassword(password, credential) {
  if (!password || !credential?.secret_hash) return false;

  const hash = String(credential.secret_hash);
  const algorithm = String(credential.algorithm || "").toLowerCase();
  if (hash.startsWith("$argon2") || algorithm.startsWith("argon2")) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
  if (algorithm && algorithm !== "scrypt") return false;

  const parsed = parseScryptHash(hash);
  if (!parsed) return false;

  try {
    const derived = await scryptAsync(password, parsed.salt, parsed.hash.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
      maxmem: SCRYPT_MAX_MEM
    });
    return timingSafeEqual(derived, parsed.hash);
  } catch {
    return false;
  }
}

async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

function getTotpSecretKey(app) {
  const raw = String(app?.config?.TOTP_SECRET_KEY || "").trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) return null;
  return key;
}

function getPasswordResetPepper(app) {
  const raw = String(app?.config?.PASSWORD_RESET_PEPPER || "").trim();
  if (raw) return raw;
  return String(app?.config?.API_KEY_PEPPER || "").trim();
}

function resolveResetBase(app) {
  const explicit = String(app?.config?.PASSWORD_RESET_URL_BASE || "").trim();
  if (explicit) return explicit;
  const cors = String(app?.config?.CORS_ORIGIN || "").split(",")[0]?.trim();
  return cors || "";
}

function buildResetLink(app, token) {
  const base = resolveResetBase(app);
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.set("surface", "auth");
  url.searchParams.set("reset", token);
  return url.toString();
}

async function resolveTenantIdByCode(client, tenantCode) {
  const code = String(tenantCode || "").trim();
  if (!code) return null;
  const r = await client.query(
    `
    SELECT id
    FROM eip_core.tenant
    WHERE lower(code) = lower($1) OR lower(name) = lower($1)
    ORDER BY (lower(code) = lower($1)) DESC, created_at DESC
    LIMIT 2
    `,
    [code]
  );
  if (r.rowCount !== 1) return null;
  return r.rows[0]?.id ?? null;
}

function encryptTotpSecret(secret, key) {
  if (!key) return secret;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("enc:"), iv, tag, ciphertext]);
}

function normalizeTotpSecret(value, key, log) {
  if (!value) return null;
  const buf = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  const prefix = Buffer.from("enc:");
  if (buf.length >= prefix.length && buf.subarray(0, prefix.length).equals(prefix)) {
    if (!key) {
      log?.warn({ event: "totp_secret_key_missing" });
      return null;
    }
    const iv = buf.subarray(prefix.length, prefix.length + 12);
    const tag = buf.subarray(prefix.length + 12, prefix.length + 28);
    const ciphertext = buf.subarray(prefix.length + 28);
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) return null;
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8").trim() || null;
    } catch {
      log?.warn({ event: "totp_secret_decrypt_failed" });
      return null;
    }
  }

  const asString = buf.toString("utf8").trim();
  return asString || null;
}

async function isAdminIdentity(client, { tenantId, identityId }) {
  const r = await client.query(
    `
    SELECT
      COUNT(*)::int AS role_count,
      bool_or(r.surface_code = 'ADMIN') AS is_admin
    FROM eip_authz.identity_role ir
    JOIN eip_authz.role r ON r.id = ir.role_id
    WHERE ir.tenant_id = $1
      AND ir.identity_id = $2
      AND r.is_active = true
    `,
    [tenantId, identityId]
  );

  return {
    roleCount: r.rows[0]?.role_count ?? 0,
    isAdmin: r.rows[0]?.is_admin === true
  };
}

async function loadIdentityAttrs(client, tenantId, identityId) {
  const r = await client.query(
    `
    SELECT attrs
    FROM eip_auth.auth_identity
    WHERE tenant_id=$1 AND id=$2
    LIMIT 1
    `,
    [tenantId, identityId]
  );
  return r.rows[0]?.attrs || {};
}

async function loadUserProfile(client, tenantId, identityId) {
  const r = await client.query(
    `
    SELECT id, tenant_id, identity_id, display_name, title, phone, locale, timezone, avatar_url, attrs
    FROM eip_core.user_profile
    WHERE tenant_id=$1 AND identity_id=$2
    LIMIT 1
    `,
    [tenantId, identityId]
  );
  return r.rows[0] || null;
}

async function upsertUserProfile(client, tenantId, identityId, payload = {}) {
  const data = payload && typeof payload === "object" ? payload : {};
  const r = await client.query(
    `
    INSERT INTO eip_core.user_profile
      (tenant_id, identity_id, display_name, title, phone, locale, timezone, avatar_url, attrs)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
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

/* ============================================================
   DEVICE UPSERT (browser)
   ============================================================ */
async function upsertBrowserDevice(app, client, { tenantId, identityId, deviceToken, req }) {
  const ua = String(req.headers["user-agent"] || "");
  const uaHash = sha256Hex(ua);

  const r = await client.query(
    `
    INSERT INTO eip_auth.auth_device
      (tenant_id, identity_id, device_kind, device_id, last_seen_at, attrs)
    VALUES
      ($1, $2, 'browser', $3, now(),
       jsonb_build_object('user_agent_hash', $4::text))
    ON CONFLICT (tenant_id, identity_id, device_kind, device_id)
      WHERE device_kind='browser' AND device_id IS NOT NULL
    DO UPDATE SET
      last_seen_at = now(),
      attrs = COALESCE(eip_auth.auth_device.attrs,'{}'::jsonb) || EXCLUDED.attrs
    RETURNING id, trust_state
    `,
    [tenantId, identityId, deviceToken, uaHash]
  );

  return r.rows[0];
}

/* ============================================================
   ROUTES
   ============================================================ */
export default async function authRoutes(app) {
  /* ===================== REQUEST OTP ===================== */
  app.post("/auth/request-otp", { config: { rateLimit: OTP_REQUEST_RATE_LIMIT } }, async (req, reply) => {
    const { tenantId: tenantIdRaw, tenantCode, email, password } = req.body || {};
    const login = String(email || "").trim().toLowerCase();
    const passwordValue = typeof password === "string" ? password : String(password || "");
    const strictErrors = app.config.NODE_ENV !== "production";

    if (!login || !passwordValue) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const tenantId = tenantIdRaw || (await resolveTenantIdByCode(client, tenantCode));
      if (!tenantId) {
        await client.query("COMMIT");
        if (strictErrors) {
          return reply.code(400).send({ ok: false, error: "TENANT_NOT_FOUND" });
        }
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      const idRes = await client.query(
        `
        SELECT id, is_active, is_locked
        FROM eip_auth.auth_identity
        WHERE tenant_id=$1 AND login=$2
        FOR UPDATE
        `,
        [tenantId, login]
      );
      if (idRes.rowCount === 0) {
        await client.query("COMMIT");
        app.log.warn({ event: "otp_request_unknown_identity", tenantId, login: login.substring(0, 3) + "...", ip: req.ip });
        if (strictErrors) {
          return reply.code(404).send({ ok: false, error: "IDENTITY_NOT_FOUND" });
        }
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      const identity = idRes.rows[0];
      if (!identity.is_active || identity.is_locked) {
        await client.query("COMMIT");
        app.log.warn({ event: "otp_request_disabled_identity", tenantId, login: login.substring(0, 3) + "...", ip: req.ip });
        if (strictErrors) {
          return reply.code(403).send({ ok: false, error: "IDENTITY_DISABLED" });
        }
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      const credRes = await client.query(
        `
        SELECT secret_hash, algorithm
        FROM eip_auth.auth_credential
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='password'
          AND is_revoked=false
          AND (valid_to IS NULL OR valid_to > now())
        ORDER BY valid_from DESC NULLS LAST, created_at DESC
        LIMIT 1
        `,
        [tenantId, identity.id]
      );

      const credential = credRes.rows[0];
      const passwordOk = await verifyPassword(passwordValue, credential);
      if (!passwordOk) {
        await client.query("COMMIT");
        app.log.warn({ event: "otp_request_bad_password", tenantId, login: login.substring(0, 3) + "...", ip: req.ip });
        if (strictErrors) {
          return reply.code(401).send({ ok: false, error: "BAD_PASSWORD" });
        }
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      const recentRes = await client.query(
        `
        SELECT count(*)::int AS recent_count
        FROM eip_auth.auth_otp_challenge
        WHERE tenant_id=$1
          AND identity_id=$2
          AND created_at > now() - ($3 * interval '1 minute')
        `,
        [tenantId, identity.id, OTP_REQUEST_LIMIT_WINDOW_MIN]
      );
      if (recentRes.rows[0].recent_count >= OTP_REQUEST_LIMIT_MAX) {
        await client.query("COMMIT");
        if (strictErrors) {
          return reply.code(429).send({ ok: false, error: "OTP_RATE_LIMIT" });
        }
        return reply.code(429).send({ ok: false, error: "OTP_RATE_LIMIT" });
      }

      const otp = randomDigits(6);
      const challengeId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + OTP_TTL_MS);

      const otpExpiresMin = Math.max(1, Math.round(OTP_TTL_MS / 60000));
      // DEV OTP LOG (explicitly gated)
      if (app.config.LOG_DEV_OTP === true && app.config.NODE_ENV !== "production") {
        console.log("[DEV OTP]", otp, "email:", login, "tenant:", tenantId);
      }

      const otpHash = sha256Hex(`${otp}:${app.config.OTP_PEPPER}:${challengeId}`);

      await client.query(
        `
        INSERT INTO eip_auth.auth_otp_challenge
          (id, tenant_id, identity_id, channel, otp_hash, expires_at)
        VALUES ($1,$2,$3,'email',$4,$5)
        `,
        [challengeId, tenantId, identity.id, otpHash, expiresAt]
      );

      await client.query("COMMIT");
      if (app.config.NODE_ENV === "production") {
        const subject = "Your EIP one-time code";
        const text = `Your EIP one-time code is ${otp}. It expires in ${otpExpiresMin} minutes. If you did not request this, you can ignore this email.`;
        const html = `<p>Your EIP one-time code is <strong>${otp}</strong>.</p><p>It expires in ${otpExpiresMin} minutes.</p><p>If you did not request this, you can ignore this email.</p>`;
        void sendEmail(app, login, subject, text, html).catch((err) => {
          app.log.error({
            event: "otp_email_failed",
            tenantId,
            login: login.substring(0, 3) + "...",
            ip: req.ip,
            error: err.message
          });
        });
      }
      return reply.send({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error(e);
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== PASSWORD-ONLY LOGIN (LOW ASSURANCE) ===================== */
  // Policy: non-admin + trusted device only; never grants step-up freshness.
  app.post("/auth/login", { config: { rateLimit: PASSWORD_LOGIN_RATE_LIMIT } }, async (req, reply) => {
    const { tenantId: tenantIdRaw, tenantCode, email, password } = req.body || {};
    const login = String(email || "").trim().toLowerCase();
    const passwordValue = typeof password === "string" ? password : String(password || "");

    if (!login || !passwordValue) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }

    const deviceToken = req.cookies?.did;
    if (!deviceToken) {
      return reply.code(403).send({ ok: false, error: "STEP_UP_REQUIRED" });
    }

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const tenantId = tenantIdRaw || (await resolveTenantIdByCode(client, tenantCode));
      if (!tenantId) {
        await client.query("COMMIT");
        return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
      }

      const idRes = await client.query(
        `
        SELECT id, is_active, is_locked
        FROM eip_auth.auth_identity
        WHERE tenant_id=$1 AND login=$2
        FOR UPDATE
        `,
        [tenantId, login]
      );
      if (idRes.rowCount === 0) {
        await client.query("COMMIT");
        app.log.warn({ event: "password_login_unknown_identity", tenantId, login: login.substring(0, 3) + "...", ip: req.ip });
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      const identity = idRes.rows[0];
      if (!identity.is_active || identity.is_locked) {
        await client.query("COMMIT");
        app.log.warn({ event: "password_login_disabled_identity", tenantId, login: login.substring(0, 3) + "...", ip: req.ip });
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      const credRes = await client.query(
        `
        SELECT secret_hash, algorithm
        FROM eip_auth.auth_credential
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='password'
          AND is_revoked=false
          AND (valid_to IS NULL OR valid_to > now())
        ORDER BY valid_from DESC NULLS LAST, created_at DESC
        LIMIT 1
        `,
        [tenantId, identity.id]
      );

      const credential = credRes.rows[0];
      const passwordOk = await verifyPassword(passwordValue, credential);
      if (!passwordOk) {
        await client.query("COMMIT");
        app.log.warn({ event: "password_login_bad_password", tenantId, login: login.substring(0, 3) + "...", ip: req.ip });
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      const deviceRes = await client.query(
        `
        SELECT id, trust_state
        FROM eip_auth.auth_device
        WHERE tenant_id=$1
          AND identity_id=$2
          AND device_kind='browser'
          AND device_id=$3
        LIMIT 1
        `,
        [tenantId, identity.id, deviceToken]
      );

      if (deviceRes.rowCount === 0 || deviceRes.rows[0].trust_state !== "trusted") {
        await client.query("COMMIT");
        return reply.code(403).send({ ok: false, error: "STEP_UP_REQUIRED" });
      }

      const adminCheck = await isAdminIdentity(client, { tenantId, identityId: identity.id });
      if (adminCheck.roleCount === 0) {
        await client.query("COMMIT");
        app.log.warn({ event: "password_login_no_roles", tenantId, identityId: identity.id, ip: req.ip });
        return reply.code(403).send({ ok: false, error: "STEP_UP_REQUIRED" });
      }
      if (adminCheck.isAdmin) {
        await client.query("COMMIT");
        return reply.code(403).send({ ok: false, error: "STEP_UP_REQUIRED" });
      }

      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

      const csrf = randomToken(24);
      const csrfHash = sha256Hex(`${csrf}:${app.config.CSRF_PEPPER}`);
      const uaHash = sha256Hex(String(req.headers["user-agent"] || ""));

      await client.query(
        `
        INSERT INTO eip_auth.auth_session
          (id, tenant_id, identity_id, device_id,
           expires_at, csrf_secret_hash, ip_address, user_agent_hash, attrs)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,
           jsonb_build_object('realm', $9::text, 'assurance', 'low'))
        `,
        [
          sessionId,
          tenantId,
          identity.id,
          deviceRes.rows[0].id,
          expiresAt,
          csrfHash,
          req.ip,
          uaHash,
          "EIP"
        ]
      );

      await client.query("COMMIT");

      app.log.info({ event: "password_login_success", tenantId, identityId: identity.id, deviceId: deviceRes.rows[0].id, ip: req.ip });

      const isProd = app.config.NODE_ENV === "production";
      const cookieBase = { path: "/", sameSite: "lax", secure: isProd };
      const sessionExpires = expiresAt;

      reply.setCookie("sid", sessionId, { ...cookieBase, httpOnly: true, expires: sessionExpires });
      reply.setCookie("csrf", csrf, { ...cookieBase, expires: sessionExpires });

      return reply.send({ ok: true, assurance: "low" });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "password_login_error", tenantId, login, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== PASSWORD STRENGTH ===================== */
  app.post("/auth/password/strength", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { password, generate, length } = req.body || {};
    if (generate === true) {
      const size = Number.isFinite(Number(length)) ? Number(length) : 16;
      return reply.send({ ok: true, generated: generateStrongPassword(size) });
    }
    const value = typeof password === "string" ? password : String(password || "");
    if (!value) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }
    const result = evaluatePasswordStrength(value);
    return reply.send({ ok: true, ...result });
  });

  /* ===================== SET PASSWORD (ADMIN/INTEGRATION) ===================== */
  app.post("/auth/password/set", async (req, reply) => {
    const { tenantId, email, password } = req.body || {};
    const login = String(email || "").trim().toLowerCase();
    const passwordValue = typeof password === "string" ? password : String(password || "");

    if (!login || !passwordValue) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }
    if (passwordValue.length > 256) {
      return reply.code(400).send({ ok: false, error: "WEAK_PASSWORD" });
    }
    const strength = evaluatePasswordStrength(passwordValue);
    if (!strength.ok) {
      return reply.code(400).send({ ok: false, error: "WEAK_PASSWORD", ...strength });
    }

    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "auth.password.write");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const actorTenantId = s.session.tenant_id;
    const actorIdentityId = s.session.identity_id;
    const actorKind = "session";

    if (tenantId && String(tenantId) !== String(actorTenantId)) {
      return reply.code(403).send({ ok: false, error: "TENANT_MISMATCH" });
    }

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      const idRes = await client.query(
        `
        INSERT INTO eip_auth.auth_identity (tenant_id, login, login_type)
        VALUES ($1,$2,'email')
        ON CONFLICT (tenant_id, login)
        DO UPDATE SET updated_at=now()
        RETURNING id, is_active, is_locked
        `,
        [actorTenantId, login]
      );

      const identity = idRes.rows[0];
      if (!identity?.id) throw new Error("IDENTITY_NOT_FOUND");
      if (!identity.is_active || identity.is_locked) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: "IDENTITY_DISABLED" });
      }

      await client.query(
        `
        UPDATE eip_auth.auth_credential
        SET is_revoked=true, valid_to=now()
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='password'
          AND is_revoked=false
        `,
        [actorTenantId, identity.id]
      );

      const secretHash = await hashPassword(passwordValue);
      await client.query(
        `
        INSERT INTO eip_auth.auth_credential
          (tenant_id, identity_id, credential_type, secret_hash, algorithm, valid_from, is_revoked)
        VALUES
          ($1,$2,'password',$3,'argon2id',now(),false)
        `,
        [actorTenantId, identity.id, secretHash]
      );

      await client.query("COMMIT");
      app.log.info({
        event: "password_set",
        tenantId: actorTenantId,
        identityId: identity.id,
        actorKind,
        actorIdentityId,
        ip: req.ip
      });
      return reply.send({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "password_set_error", tenantId: actorTenantId, login, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== PASSWORD RESET REQUEST (PUBLIC) ===================== */
  app.post("/auth/password/forgot", { config: { rateLimit: PASSWORD_RESET_RATE_LIMIT } }, async (req, reply) => {
    const { email, organisation, tenantId: tenantIdRaw, tenantCode } = req.body || {};
    const login = String(email || "").trim().toLowerCase();
    const orgValue = tenantIdRaw || tenantCode || organisation;
    if (!login || !orgValue) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const tenantId = tenantIdRaw || (await resolveTenantIdByCode(client, orgValue));
      if (!tenantId) {
        await client.query("COMMIT");
        return reply.send({ ok: true });
      }

      const idRes = await client.query(
        `
        SELECT id, is_active, is_locked
        FROM eip_auth.auth_identity
        WHERE tenant_id=$1 AND login=$2
        LIMIT 1
        `,
        [tenantId, login]
      );

      if (idRes.rowCount === 0) {
        await client.query("COMMIT");
        return reply.send({ ok: true });
      }

      const identity = idRes.rows[0];
      if (!identity.is_active || identity.is_locked) {
        await client.query("COMMIT");
        return reply.send({ ok: true });
      }

      const token = randomToken(32);
      const pepper = getPasswordResetPepper(app);
      const tokenHash = sha256Hex(`${token}:${pepper}`);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
      const resetId = crypto.randomUUID();

      await client.query(
        `
        INSERT INTO eip_auth.auth_password_reset
          (id, tenant_id, identity_id, token_hash, expires_at, requested_ip, requested_user_agent)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          resetId,
          tenantId,
          identity.id,
          tokenHash,
          expiresAt,
          req.ip,
          String(req.headers["user-agent"] || "").slice(0, 255)
        ]
      );

      await client.query("COMMIT");

      const link = buildResetLink(app, token);
      const subject = "Reset your EIP password";
      const text = link
        ? `Use this link to reset your password:\n\n${link}\n\nThis link expires in 60 minutes.`
        : `Use this token to reset your password:\n\n${token}\n\nThis token expires in 60 minutes.`;
      const html = link
        ? `<p>Use this link to reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 60 minutes.</p>`
        : `<p>Use this token to reset your password:</p><p><strong>${token}</strong></p><p>This token expires in 60 minutes.</p>`;

      await sendEmail(app, login, subject, text, html);

      return reply.send({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "password_reset_request_error", login, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== PASSWORD RESET CONFIRM (PUBLIC) ===================== */
  app.post("/auth/password/reset", { config: { rateLimit: PASSWORD_RESET_RATE_LIMIT } }, async (req, reply) => {
    const { token, password } = req.body || {};
    const cleanToken = String(token || "").trim();
    const passwordValue = typeof password === "string" ? password : String(password || "");
    if (!cleanToken || !passwordValue) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }

    const strength = evaluatePasswordStrength(passwordValue);
    if (!strength.ok) {
      return reply.code(400).send({ ok: false, error: "PASSWORD_WEAK", feedback: strength.feedback });
    }

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      const pepper = getPasswordResetPepper(app);
      const tokenHash = sha256Hex(`${cleanToken}:${pepper}`);

      const resetRes = await client.query(
        `
        SELECT id, tenant_id, identity_id, expires_at, consumed_at
        FROM eip_auth.auth_password_reset
        WHERE token_hash = $1
        LIMIT 1
        `,
        [tokenHash]
      );

      if (resetRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return reply.code(401).send({ ok: false, error: "RESET_INVALID" });
      }

      const reset = resetRes.rows[0];
      if (reset.consumed_at || new Date(reset.expires_at).getTime() <= Date.now()) {
        await client.query("ROLLBACK");
        return reply.code(401).send({ ok: false, error: "RESET_EXPIRED" });
      }

      const newHash = await hashPassword(passwordValue);
      const historyCheck = await checkPasswordHistory(client, reset.tenant_id, reset.identity_id, newHash);
      if (!historyCheck.ok) {
        await client.query("ROLLBACK");
        return reply.code(400).send({ ok: false, error: historyCheck.error || "PASSWORD_REUSE" });
      }

      await client.query(
        `
        UPDATE eip_auth.auth_credential
        SET is_revoked = true,
            valid_to = now()
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='password'
          AND is_revoked=false
        `,
        [reset.tenant_id, reset.identity_id]
      );

      await client.query(
        `
        INSERT INTO eip_auth.auth_credential
          (tenant_id, identity_id, credential_type, secret_hash, algorithm, valid_from, is_revoked)
        VALUES
          ($1,$2,'password',$3,'argon2id',now(),false)
        `,
        [reset.tenant_id, reset.identity_id, newHash]
      );

      await client.query(
        `
        UPDATE eip_auth.auth_password_reset
        SET consumed_at = now()
        WHERE id=$1
        `,
        [reset.id]
      );

      await client.query("COMMIT");
      return reply.send({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "password_reset_confirm_error", ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== RECOVERY TOKEN REQUEST (PUBLIC, EIP ADMIN) ===================== */
  app.post("/auth/recovery/request", { config: { rateLimit: RECOVERY_REQUEST_RATE_LIMIT } }, async (req, reply) => {
    const { email, organisation, tenantId: tenantIdRaw, tenantCode, password, totp: token } = req.body || {};
    const login = String(email || "").trim().toLowerCase();
    const passwordValue = typeof password === "string" ? password : String(password || "");
    const orgValue = tenantIdRaw || tenantCode || organisation;
    if (!login || !orgValue || !passwordValue) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }

    const cleanToken = String(token || "").replace(/\s/g, "");
    const allowNoTotp = app.config.ALLOW_RECOVERY_NO_TOTP === true && app.config.NODE_ENV !== "production";

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const tenantId = tenantIdRaw || (await resolveTenantIdByCode(client, orgValue));
      if (!tenantId) {
        await client.query("COMMIT");
        return reply.send({ ok: true });
      }

      const idRes = await client.query(
        `
        SELECT id, is_active, is_locked, attrs
        FROM eip_auth.auth_identity
        WHERE tenant_id=$1 AND login=$2
        LIMIT 1
        `,
        [tenantId, login]
      );

      if (idRes.rowCount === 0) {
        await client.query("COMMIT");
        return reply.send({ ok: true });
      }

      const identity = idRes.rows[0];
      const isSystemAdmin = Boolean(identity?.attrs?.system_admin);
      if (!isSystemAdmin) {
        await client.query("ROLLBACK");
        return reply.code(403).send({ ok: false, error: "FORBIDDEN" });
      }

      if (!identity.is_active || identity.is_locked) {
        await client.query("COMMIT");
        return reply.send({ ok: true });
      }

      const credRes = await client.query(
        `
        SELECT secret_hash, algorithm
        FROM eip_auth.auth_credential
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='password'
          AND is_revoked=false
          AND (valid_to IS NULL OR valid_to > now())
        ORDER BY valid_from DESC NULLS LAST, created_at DESC
        LIMIT 1
        `,
        [tenantId, identity.id]
      );

      const credential = credRes.rows[0];
      const passwordOk = await verifyPassword(passwordValue, credential);
      if (!passwordOk) {
        await client.query("COMMIT");
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      const totpKey = getTotpSecretKey(app);
      const totpRes = await client.query(
        `
        SELECT secret_enc
        FROM eip_auth.auth_credential
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='totp'
          AND is_revoked=false
          AND (valid_to IS NULL OR valid_to > now())
        ORDER BY valid_from DESC NULLS LAST, created_at DESC
        LIMIT 1
        `,
        [tenantId, identity.id]
      );

      const totpSecret = normalizeTotpSecret(totpRes.rows[0]?.secret_enc, totpKey, app.log);
      if (!totpSecret) {
        if (!allowNoTotp) {
          await client.query("ROLLBACK");
          return reply.code(403).send({ ok: false, error: "TOTP_REQUIRED" });
        }
      } else {
        if (!/^\d{6}$/.test(cleanToken)) {
          await client.query("ROLLBACK");
          return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
        }
        let valid = false;
        try {
          const result = await totp.verify(cleanToken, { secret: totpSecret });
          valid = result?.valid === true;
        } catch {
          valid = false;
        }
        if (!valid) {
          await client.query("ROLLBACK");
          return reply.code(401).send({ ok: false, error: "INVALID_TOTP" });
        }
      }

      const ttlMin = Number(app.config.RECOVERY_TOKEN_TTL_MIN || RECOVERY_TOKEN_DEFAULT_TTL_MIN);
      const expiresAt = new Date(Date.now() + Math.max(ttlMin, 5) * 60 * 1000);
      const tokenPlain = randomToken(32);
      const tokenHash = sha256Hex(`${tokenPlain}:${getRecoveryPepper(app)}`);

      await client.query(
        `
        INSERT INTO eip_auth.auth_recovery_token
          (id, tenant_id, identity_id, token_hash, expires_at, requested_ip, requested_user_agent)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          crypto.randomUUID(),
          tenantId,
          identity.id,
          tokenHash,
          expiresAt,
          req.ip,
          String(req.headers["user-agent"] || "").slice(0, 255)
        ]
      );

      await client.query("COMMIT");

      const link = buildRecoveryLink(app, tokenPlain);
      const subject = "EIP admin recovery link";
      const text = link
        ? `Use this recovery link to regain access:\n\n${link}\n\nThis link expires in ${Math.max(ttlMin, 5)} minutes.`
        : `Use this recovery token to regain access:\n\n${tokenPlain}\n\nThis token expires in ${Math.max(ttlMin, 5)} minutes.`;
      const html = link
        ? `<p>Use this recovery link to regain access:</p><p><a href="${link}">${link}</a></p><p>This link expires in ${Math.max(ttlMin, 5)} minutes.</p>`
        : `<p>Use this recovery token to regain access:</p><p><strong>${tokenPlain}</strong></p><p>This token expires in ${Math.max(ttlMin, 5)} minutes.</p>`;

      await sendEmail(app, login, subject, text, html);

      return reply.send({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "recovery_request_error", login, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== RECOVERY REQUEST (TOTP LOST) ===================== */
  app.post("/auth/recovery/request-lost", { config: { rateLimit: RECOVERY_LOST_RATE_LIMIT } }, async (req, reply) => {
    const { email, organisation, tenantId: tenantIdRaw, tenantCode, reason } = req.body || {};
    const login = String(email || "").trim().toLowerCase();
    const orgValue = tenantIdRaw || tenantCode || organisation;
    if (!login || !orgValue) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const tenantId = tenantIdRaw || (await resolveTenantIdByCode(client, orgValue));
      if (!tenantId) {
        await client.query("COMMIT");
        return reply.send({ ok: true });
      }

      const idRes = await client.query(
        `
        SELECT id, is_active, is_locked
        FROM eip_auth.auth_identity
        WHERE tenant_id=$1 AND login=$2
        LIMIT 1
        `,
        [tenantId, login]
      );

      if (idRes.rowCount === 0) {
        await client.query("COMMIT");
        return reply.send({ ok: true });
      }

      const identity = idRes.rows[0];
      if (!identity.is_active || identity.is_locked) {
        await client.query("COMMIT");
        return reply.send({ ok: true });
      }

      await client.query(
        `
        INSERT INTO eip_auth.auth_recovery_request
          (id, tenant_id, identity_id, login, status, reason, requested_ip, requested_user_agent)
        VALUES
          ($1,$2,$3,$4,'PENDING',$5,$6,$7)
        `,
        [
          crypto.randomUUID(),
          tenantId,
          identity.id,
          login,
          reason ? String(reason).slice(0, 500) : null,
          req.ip,
          String(req.headers["user-agent"] || "").slice(0, 255)
        ]
      );

      await client.query("COMMIT");
      return reply.send({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "recovery_request_lost_error", login, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== RECOVERY TOKEN CONSUME (PUBLIC, EIP ADMIN) ===================== */
  app.post("/auth/recovery/consume", { config: { rateLimit: RECOVERY_CONSUME_RATE_LIMIT } }, async (req, reply) => {
    const { token } = req.body || {};
    const cleanToken = String(token || "").trim();
    if (!cleanToken) return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      const tokenHash = sha256Hex(`${cleanToken}:${getRecoveryPepper(app)}`);
      const r = await client.query(
        `
        SELECT id, tenant_id, identity_id, expires_at, consumed_at
        FROM eip_auth.auth_recovery_token
        WHERE token_hash=$1
        LIMIT 1
        `,
        [tokenHash]
      );

      if (r.rowCount === 0) {
        await client.query("ROLLBACK");
        return reply.code(401).send({ ok: false, error: "RECOVERY_INVALID" });
      }

      const row = r.rows[0];
      if (row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) {
        await client.query("ROLLBACK");
        return reply.code(401).send({ ok: false, error: "RECOVERY_EXPIRED" });
      }

      const idRes = await client.query(
        `
        SELECT attrs, is_active, is_locked
        FROM eip_auth.auth_identity
        WHERE tenant_id=$1 AND id=$2
        LIMIT 1
        `,
        [row.tenant_id, row.identity_id]
      );
      const identity = idRes.rows[0];
      if (!identity || !identity.is_active || identity.is_locked) {
        await client.query("ROLLBACK");
        return reply.code(403).send({ ok: false, error: "IDENTITY_DISABLED" });
      }
      const isSystemAdmin = Boolean(identity?.attrs?.system_admin);
      if (!isSystemAdmin) {
        await client.query("ROLLBACK");
        return reply.code(403).send({ ok: false, error: "FORBIDDEN" });
      }

      const deviceToken = req.cookies?.did || crypto.randomUUID();
      let deviceRow = await upsertBrowserDevice(app, client, {
        tenantId: row.tenant_id,
        identityId: row.identity_id,
        deviceToken,
        req
      });
      if (!deviceRow) throw new Error("DEVICE_UPSERT_FAILED");
      if (deviceRow.trust_state === "revoked") {
        await client.query("ROLLBACK");
        return reply.code(401).send({ ok: false, error: "DEVICE_REVOKED" });
      }
      if (deviceRow.trust_state === "untrusted") {
        const trustRes = await client.query(
          `
          UPDATE eip_auth.auth_device
          SET trust_state='trusted', updated_at=now()
          WHERE tenant_id=$1 AND id=$2 AND trust_state='untrusted'
          RETURNING trust_state
          `,
          [row.tenant_id, deviceRow.id]
        );
        if (trustRes.rowCount > 0) {
          deviceRow = { ...deviceRow, trust_state: trustRes.rows[0].trust_state };
          app.log.info({ event: "device_trusted_via_recovery", tenantId: row.tenant_id, identityId: row.identity_id, deviceId: deviceRow.id, ip: req.ip });
        }
      }

      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      const csrf = randomToken(24);
      const csrfHash = sha256Hex(`${csrf}:${app.config.CSRF_PEPPER}`);
      const uaHash = sha256Hex(String(req.headers["user-agent"] || ""));

      await client.query(
        `
        INSERT INTO eip_auth.auth_session
          (id, tenant_id, identity_id, device_id,
           expires_at, csrf_secret_hash, ip_address, user_agent_hash, attrs)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,
           jsonb_build_object('realm', $9::text, 'step_up_at', now(), 'assurance', 'recovery'))
        `,
        [
          sessionId,
          row.tenant_id,
          row.identity_id,
          deviceRow.id,
          expiresAt,
          csrfHash,
          req.ip,
          uaHash,
          "EIP"
        ]
      );

      await client.query(
        `
        UPDATE eip_auth.auth_recovery_token
        SET consumed_at = now()
        WHERE id=$1
        `,
        [row.id]
      );

      await client.query("COMMIT");

      const isProd = app.config.NODE_ENV === "production";
      const cookieBase = { path: "/", sameSite: "lax", secure: isProd };
      const deviceExpires = new Date(Date.now() + DEVICE_COOKIE_TTL_MS);
      reply.setCookie("sid", sessionId, { ...cookieBase, httpOnly: true, expires: expiresAt });
      reply.setCookie("csrf", csrf, { ...cookieBase, expires: expiresAt });
      reply.setCookie("did", deviceToken, { ...cookieBase, httpOnly: true, expires: deviceExpires });

      return reply.send({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "recovery_consume_error", ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== RECOVERY REQUESTS (ADMIN) ===================== */
  app.get("/auth/recovery/requests", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const { tenant_id, identity_id } = s.session;
    const attrs = await loadIdentityAttrs(app.db, tenant_id, identity_id);
    const isSystemAdmin = Boolean(attrs?.system_admin);
    const adminCheck = await isAdminIdentity(app.db, { tenantId: tenant_id, identityId: identity_id });
    if (!isSystemAdmin && adminCheck.roleCount === 0) {
      return reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    }

    const status = String(req.query?.status || "PENDING").toUpperCase();
    const params = [];
    const filters = [];
    if (!isSystemAdmin) {
      params.push(tenant_id);
      filters.push(`tenant_id = $${params.length}`);
    }
    if (status && status !== "ALL") {
      params.push(status);
      filters.push(`status = $${params.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    try {
      const r = await app.db.query(
        `
        SELECT id, tenant_id, identity_id, login, status, reason, requested_at, decided_at, decided_by, decision_reason
        FROM eip_auth.auth_recovery_request
        ${where}
        ORDER BY requested_at DESC
        LIMIT 200
        `,
        params
      );
      return reply.send({ ok: true, requests: r.rows || [] });
    } catch (e) {
      if (e?.code === "42P01") {
        app.log.warn({ event: "recovery_request_table_missing", error: e.message });
        return reply.send({ ok: true, requests: [], warning: "RECOVERY_TABLE_MISSING" });
      }
      app.log.error({ event: "recovery_request_list_error", error: e.message });
      return reply.code(500).send({ ok: false });
    }
  });

  app.post("/auth/recovery/requests/:id/approve", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });
    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });
    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const { tenant_id, identity_id } = s.session;
    const attrs = await loadIdentityAttrs(app.db, tenant_id, identity_id);
    const isSystemAdmin = Boolean(attrs?.system_admin);
    const adminCheck = await isAdminIdentity(app.db, { tenantId: tenant_id, identityId: identity_id });
    if (!isSystemAdmin && adminCheck.roleCount === 0) {
      return reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    }

    const requestId = req.params.id;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const reqRes = await client.query(
        `
        SELECT *
        FROM eip_auth.auth_recovery_request
        WHERE id=$1::uuid
        FOR UPDATE
        `,
        [requestId]
      );
      if (reqRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      }
      const row = reqRes.rows[0];
      if (!isSystemAdmin && String(row.tenant_id) !== String(tenant_id)) {
        await client.query("ROLLBACK");
        return reply.code(403).send({ ok: false, error: "FORBIDDEN" });
      }
      if (row.status !== "PENDING") {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: "INVALID_STATUS" });
      }

      const ttlMin = Number(app.config.RECOVERY_TOKEN_TTL_MIN || RECOVERY_TOKEN_DEFAULT_TTL_MIN);
      const expiresAt = new Date(Date.now() + Math.max(ttlMin, 5) * 60 * 1000);
      const tokenPlain = randomToken(32);
      const tokenHash = sha256Hex(`${tokenPlain}:${getRecoveryPepper(app)}`);

      await client.query(
        `
        INSERT INTO eip_auth.auth_recovery_token
          (id, tenant_id, identity_id, token_hash, expires_at, requested_ip, requested_user_agent)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          crypto.randomUUID(),
          row.tenant_id,
          row.identity_id,
          tokenHash,
          expiresAt,
          req.ip,
          String(req.headers["user-agent"] || "").slice(0, 255)
        ]
      );

      await client.query(
        `
        UPDATE eip_auth.auth_recovery_request
        SET status='APPROVED',
            decided_at=now(),
            decided_by=$2::uuid
        WHERE id=$1::uuid
        `,
        [row.id, identity_id]
      );

      await client.query("COMMIT");

      const link = buildRecoveryLink(app, tokenPlain);
      const subject = "EIP recovery approved";
      const text = link
        ? `Your recovery request was approved. Use this link:\n\n${link}\n\nThis link expires in ${Math.max(ttlMin, 5)} minutes.`
        : `Your recovery request was approved. Use this token:\n\n${tokenPlain}\n\nThis token expires in ${Math.max(ttlMin, 5)} minutes.`;
      const html = link
        ? `<p>Your recovery request was approved. Use this link:</p><p><a href="${link}">${link}</a></p><p>This link expires in ${Math.max(ttlMin, 5)} minutes.</p>`
        : `<p>Your recovery request was approved. Use this token:</p><p><strong>${tokenPlain}</strong></p><p>This token expires in ${Math.max(ttlMin, 5)} minutes.</p>`;

      await sendEmail(app, row.login, subject, text, html);

      return reply.send({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "recovery_request_approve_error", requestId, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.post("/auth/recovery/requests/:id/reject", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });
    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });
    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const { tenant_id, identity_id } = s.session;
    const attrs = await loadIdentityAttrs(app.db, tenant_id, identity_id);
    const isSystemAdmin = Boolean(attrs?.system_admin);
    const adminCheck = await isAdminIdentity(app.db, { tenantId: tenant_id, identityId: identity_id });
    if (!isSystemAdmin && adminCheck.roleCount === 0) {
      return reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    }

    const requestId = req.params.id;
    const reason = String(req.body?.reason || "").slice(0, 500);
    const r = await app.db.query(
      `
      UPDATE eip_auth.auth_recovery_request
      SET status='REJECTED',
          decided_at=now(),
          decided_by=$2::uuid,
          decision_reason=$3
      WHERE id=$1::uuid
      RETURNING id
      `,
      [requestId, identity_id, reason || null]
    );
    if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

    return reply.send({ ok: true });
  });

  /* ===================== TOTP ENROLL (EIP) ===================== */
  app.post("/auth/totp/enroll", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const { tenant_id, identity_id } = s.session;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      const loginRes = await client.query(
        `
        SELECT login
        FROM eip_auth.auth_identity
        WHERE tenant_id=$1 AND id=$2
        `,
        [tenant_id, identity_id]
      );
      const label = loginRes.rows[0]?.login ?? String(identity_id);

      await client.query(
        `
        UPDATE eip_auth.auth_credential
        SET is_revoked=true, valid_to=now()
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='totp'
          AND is_revoked=false
        `,
        [tenant_id, identity_id]
      );

      const totpKey = getTotpSecretKey(app);
      if (!totpKey) {
        await client.query("ROLLBACK");
        app.log.error({ event: "totp_secret_key_invalid", tenantId: tenant_id, identityId: identity_id });
        return reply.code(500).send({ ok: false, error: "TOTP_UNAVAILABLE" });
      }

      const secret = totp.generateSecret();
      const secretEnc = encryptTotpSecret(secret, totpKey);

      await client.query(
        `
        INSERT INTO eip_auth.auth_credential
          (tenant_id, identity_id, credential_type, secret_enc, algorithm, meta, valid_from, is_revoked)
        VALUES
          ($1,$2,'totp',$3,'totp',$4::jsonb,now(),true)
        `,
        [tenant_id, identity_id, secretEnc, JSON.stringify({ pending: true })]
      );

      await client.query("COMMIT");

      const issuer = String(app.config.TOTP_ISSUER || "EIP");
      const uri = totp.toURI({ label, issuer, secret });

      return reply.send({ ok: true, secret, uri });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "totp_enroll_error", tenantId: tenant_id, identityId: identity_id, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== TOTP BOOTSTRAP (PRE-LOGIN) ===================== */
  app.post("/auth/totp/bootstrap", { config: { rateLimit: TOTP_BOOTSTRAP_RATE_LIMIT } }, async (req, reply) => {
    const { tenantId: tenantIdRaw, tenantCode, email, password } = req.body || {};
    const login = String(email || "").trim().toLowerCase();
    const passwordValue = typeof password === "string" ? password : String(password || "");

    if (!login || !passwordValue) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const tenantId = tenantIdRaw || (await resolveTenantIdByCode(client, tenantCode));
      if (!tenantId) {
        await client.query("COMMIT");
        return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
      }

      const idRes = await client.query(
        `
        SELECT id, is_active, is_locked
        FROM eip_auth.auth_identity
        WHERE tenant_id=$1 AND login=$2
        FOR UPDATE
        `,
        [tenantId, login]
      );
      if (idRes.rowCount === 0) {
        await client.query("COMMIT");
        app.log.warn({ event: "totp_bootstrap_unknown_identity", tenantId, login: login.substring(0, 3) + "...", ip: req.ip });
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      const identity = idRes.rows[0];
      if (!identity.is_active || identity.is_locked) {
        await client.query("COMMIT");
        app.log.warn({ event: "totp_bootstrap_disabled_identity", tenantId, login: login.substring(0, 3) + "...", ip: req.ip });
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      const credRes = await client.query(
        `
        SELECT secret_hash, algorithm
        FROM eip_auth.auth_credential
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='password'
          AND is_revoked=false
          AND (valid_to IS NULL OR valid_to > now())
        ORDER BY valid_from DESC NULLS LAST, created_at DESC
        LIMIT 1
        `,
        [tenantId, identity.id]
      );

      const credential = credRes.rows[0];
      const passwordOk = await verifyPassword(passwordValue, credential);
      if (!passwordOk) {
        await client.query("COMMIT");
        app.log.warn({ event: "totp_bootstrap_bad_password", tenantId, login: login.substring(0, 3) + "...", ip: req.ip });
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      await client.query(
        `
        UPDATE eip_auth.auth_credential
        SET is_revoked=true, valid_to=now()
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='totp'
          AND is_revoked=false
        `,
        [tenantId, identity.id]
      );

      const totpKey = getTotpSecretKey(app);
      if (!totpKey) {
        await client.query("ROLLBACK");
        app.log.error({ event: "totp_secret_key_invalid", tenantId, identityId: identity.id });
        return reply.code(500).send({ ok: false, error: "TOTP_UNAVAILABLE" });
      }

      const secret = totp.generateSecret();
      const secretEnc = encryptTotpSecret(secret, totpKey);

      await client.query(
        `
        INSERT INTO eip_auth.auth_credential
          (tenant_id, identity_id, credential_type, secret_enc, algorithm, meta, valid_from, is_revoked)
        VALUES
          ($1,$2,'totp',$3,'totp',$4::jsonb,now(),true)
        `,
        [tenantId, identity.id, secretEnc, JSON.stringify({ pending: true })]
      );

      await client.query("COMMIT");

      const issuer = String(app.config.TOTP_ISSUER || "EIP");
      const uri = totp.toURI({ label: login, issuer, secret });
      return reply.send({ ok: true, secret, uri });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "totp_bootstrap_error", login, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== TOTP CONFIRM (EIP) ===================== */
  app.post("/auth/totp/confirm", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const token = normalizeOtp(req.body?.token);
    if (!token || !/^\d{6}$/.test(token)) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }

    const { tenant_id, identity_id } = s.session;
    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      const r = await client.query(
        `
        SELECT id, secret_enc, is_revoked, meta
        FROM eip_auth.auth_credential
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='totp'
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
        `,
        [tenant_id, identity_id]
      );

      if (r.rowCount === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "TOTP_NOT_FOUND" });
      }

      const row = r.rows[0];
      if (!row.is_revoked && row.meta?.pending !== true) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: "TOTP_ALREADY_ENABLED" });
      }

      const totpKey = getTotpSecretKey(app);
      if (!totpKey) {
        await client.query("ROLLBACK");
        app.log.error({ event: "totp_secret_key_invalid", tenantId: tenant_id, identityId: identity_id });
        return reply.code(500).send({ ok: false, error: "TOTP_UNAVAILABLE" });
      }

      const secret = normalizeTotpSecret(row.secret_enc, totpKey, app.log);
      if (!secret) {
        await client.query("ROLLBACK");
        return reply.code(500).send({ ok: false, error: "TOTP_SECRET_INVALID" });
      }

      let valid = false;
      try {
        const result = await totp.verify(token, { secret });
        valid = result?.valid === true;
      } catch {
        valid = false;
      }

      if (!valid) {
        await client.query("ROLLBACK");
        return reply.code(401).send({ ok: false, error: "INVALID_TOTP" });
      }

      await client.query(
        `
        UPDATE eip_auth.auth_credential
        SET is_revoked=false,
            valid_from=now(),
            meta=COALESCE(meta,'{}'::jsonb) - 'pending'
        WHERE id=$1
        `,
        [row.id]
      );

      await client.query("COMMIT");
      app.log.info({ event: "totp_enabled", tenantId: tenant_id, identityId: identity_id, ip: req.ip });
      return reply.send({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "totp_confirm_error", tenantId: tenant_id, identityId: identity_id, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== TOTP CONFIRM (PRE-LOGIN) ===================== */
  app.post("/auth/totp/confirm-setup", { config: { rateLimit: TOTP_BOOTSTRAP_RATE_LIMIT } }, async (req, reply) => {
    const { tenantId: tenantIdRaw, tenantCode, email, password, token } = req.body || {};
    const login = String(email || "").trim().toLowerCase();
    const passwordValue = typeof password === "string" ? password : String(password || "");
    const cleanToken = normalizeOtp(token);

    if (!login || !passwordValue || !cleanToken || !/^\d{6}$/.test(cleanToken)) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const tenantId = tenantIdRaw || (await resolveTenantIdByCode(client, tenantCode));
      if (!tenantId) {
        await client.query("COMMIT");
        return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
      }

      const idRes = await client.query(
        `
        SELECT id, is_active, is_locked
        FROM eip_auth.auth_identity
        WHERE tenant_id=$1 AND login=$2
        FOR UPDATE
        `,
        [tenantId, login]
      );
      if (idRes.rowCount === 0) {
        await client.query("COMMIT");
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }
      const identity = idRes.rows[0];
      if (!identity.is_active || identity.is_locked) {
        await client.query("COMMIT");
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      const credRes = await client.query(
        `
        SELECT secret_hash, algorithm
        FROM eip_auth.auth_credential
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='password'
          AND is_revoked=false
          AND (valid_to IS NULL OR valid_to > now())
        ORDER BY valid_from DESC NULLS LAST, created_at DESC
        LIMIT 1
        `,
        [tenantId, identity.id]
      );

      const credential = credRes.rows[0];
      const passwordOk = await verifyPassword(passwordValue, credential);
      if (!passwordOk) {
        await client.query("COMMIT");
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      const r = await client.query(
        `
        SELECT id, secret_enc, is_revoked, meta
        FROM eip_auth.auth_credential
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='totp'
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
        `,
        [tenantId, identity.id]
      );

      if (r.rowCount === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "TOTP_NOT_FOUND" });
      }

      const row = r.rows[0];
      if (!row.is_revoked && row.meta?.pending !== true) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: "TOTP_ALREADY_ENABLED" });
      }

      const totpKey = getTotpSecretKey(app);
      if (!totpKey) {
        await client.query("ROLLBACK");
        app.log.error({ event: "totp_secret_key_invalid", tenantId, identityId: identity.id });
        return reply.code(500).send({ ok: false, error: "TOTP_UNAVAILABLE" });
      }

      const secret = normalizeTotpSecret(row.secret_enc, totpKey, app.log);
      if (!secret) {
        await client.query("ROLLBACK");
        return reply.code(500).send({ ok: false, error: "TOTP_SECRET_INVALID" });
      }

      let valid = false;
      try {
        const result = await totp.verify(cleanToken, { secret });
        valid = result?.valid === true;
      } catch {
        valid = false;
      }

      if (!valid) {
        await client.query("ROLLBACK");
        return reply.code(401).send({ ok: false, error: "INVALID_TOTP" });
      }

      await client.query(
        `
        UPDATE eip_auth.auth_credential
        SET is_revoked=false,
            valid_from=now(),
            meta=COALESCE(meta,'{}'::jsonb) - 'pending'
        WHERE id=$1
        `,
        [row.id]
      );

      await client.query("COMMIT");
      app.log.info({ event: "totp_enabled_prelogin", tenantId, identityId: identity.id, ip: req.ip });
      return reply.send({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "totp_confirm_prelogin_error", login, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== ORG LOOKUP (EMAIL + PASSWORD) ===================== */
  app.post("/auth/organisations", { config: { rateLimit: ORG_LOOKUP_RATE_LIMIT } }, async (req, reply) => {
    const { email, password } = req.body || {};
    const login = String(email || "").trim().toLowerCase();
    const passwordValue = typeof password === "string" ? password : String(password || "");

    if (!login) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }

    const identities = await app.db.query(
      `
      SELECT i.id, i.tenant_id, t.code, t.name
      FROM eip_auth.auth_identity i
      JOIN eip_core.tenant t ON t.id = i.tenant_id
      WHERE i.login = $1
        AND i.is_active = true
        AND i.is_locked = false
        AND t.is_active = true
      ORDER BY t.created_at DESC
      LIMIT 10
      `,
      [login]
    );

    const organisations = [];

    for (const row of identities.rows) {
      if (passwordValue) {
        const credRes = await app.db.query(
          `
          SELECT secret_hash, algorithm
          FROM eip_auth.auth_credential
          WHERE tenant_id=$1
            AND identity_id=$2
            AND credential_type='password'
            AND is_revoked=false
            AND (valid_to IS NULL OR valid_to > now())
          ORDER BY valid_from DESC NULLS LAST, created_at DESC
          LIMIT 1
          `,
          [row.tenant_id, row.id]
        );
        const credential = credRes.rows[0];
        const passwordOk = await verifyPassword(passwordValue, credential);
        if (!passwordOk) continue;
      }
      organisations.push({
        id: row.tenant_id,
        code: row.code,
        name: row.name
      });
    }

    return reply.send({ ok: true, organisations });
  });

  /* ===================== VERIFY OTP ===================== */
  app.post("/auth/verify-otp", { config: { rateLimit: OTP_VERIFY_RATE_LIMIT } }, async (req, reply) => {
    const { tenantId: tenantIdRaw, tenantCode, email, otp } = req.body || {};
    const login = String(email || "").trim().toLowerCase();
    const otpValue = normalizeOtp(otp);

    if (!login || !otpValue) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }
    if (!/^\d{6}$/.test(otpValue)) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const tenantId = tenantIdRaw || (await resolveTenantIdByCode(client, tenantCode));
      if (!tenantId) {
        await client.query("COMMIT");
        return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
      }

      const idRes = await client.query(
        `
        SELECT id, is_active, is_locked
        FROM eip_auth.auth_identity
        WHERE tenant_id=$1 AND login=$2
        `,
        [tenantId, login]
      );
      if (idRes.rowCount === 0) throw new Error("INVALID");

      const identityRow = idRes.rows[0];
      if (!identityRow.is_active || identityRow.is_locked) throw new Error("IDENTITY_DISABLED");

      const identityId = identityRow.id;

      const chRes = await client.query(
        `
        SELECT id, otp_hash, attempt_count, max_attempts
        FROM eip_auth.auth_otp_challenge
        WHERE tenant_id=$1
          AND identity_id=$2
          AND is_consumed=false
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
        `,
        [tenantId, identityId]
      );
      if (chRes.rowCount === 0) throw new Error("OTP_EXPIRED");

      const ch = chRes.rows[0];
      const calc = sha256Hex(`${otpValue}:${app.config.OTP_PEPPER}:${ch.id}`);
      if (!timingSafeEqual(calc, ch.otp_hash)) {
        let totpOk = false;
        const totpKey = getTotpSecretKey(app);
        const totpRes = await client.query(
          `
          SELECT secret_enc
          FROM eip_auth.auth_credential
          WHERE tenant_id=$1
            AND identity_id=$2
            AND credential_type='totp'
            AND is_revoked=false
            AND (valid_to IS NULL OR valid_to > now())
          ORDER BY valid_from DESC NULLS LAST, created_at DESC
          LIMIT 1
          `,
          [tenantId, identityId]
        );

        const totpSecret = normalizeTotpSecret(totpRes.rows[0]?.secret_enc, totpKey, app.log);
        if (totpSecret) {
          try {
            const result = await totp.verify(otpValue, { secret: totpSecret });
            totpOk = result?.valid === true;
          } catch {
            totpOk = false;
          }
        }

        if (totpOk) {
          app.log.info({ event: "totp_verify_success", tenantId, identityId, ip: req.ip });
        } else {
          if (ch.attempt_count >= ch.max_attempts) {
            await client.query(
              `
              UPDATE eip_auth.auth_otp_challenge
              SET is_consumed=true, consumed_at=now()
              WHERE id=$1
              `,
              [ch.id]
            );
            await client.query("COMMIT");
            return reply.code(401).send({ ok: false, error: "INVALID_OTP" });
          }
          const nextCount = ch.attempt_count + 1;
          const exhausted = nextCount >= ch.max_attempts;
          await client.query(
            `
            UPDATE eip_auth.auth_otp_challenge
            SET attempt_count=$2,
                is_consumed=CASE WHEN $3 THEN true ELSE is_consumed END,
                consumed_at=CASE WHEN $3 THEN now() ELSE consumed_at END
            WHERE id=$1
            `,
            [ch.id, nextCount, exhausted]
          );
          await client.query("COMMIT");
          return reply.code(401).send({ ok: false, error: "INVALID_OTP" });
        }
      }

      await client.query(
        `
        UPDATE eip_auth.auth_otp_challenge
        SET is_consumed=true, consumed_at=now()
        WHERE tenant_id=$1 AND identity_id=$2 AND is_consumed=false
        `,
        [tenantId, identityId]
      );

      // If an existing session matches this identity, treat this as step-up completion.
      const existingSid = req.cookies?.sid;
      if (existingSid) {
        const sRes = await client.query(
          `
          SELECT id, tenant_id, identity_id
          FROM eip_auth.auth_session
          WHERE id=$1::uuid
            AND is_revoked=false
            AND expires_at > now()
          LIMIT 1
          `,
          [existingSid]
        );

        if (
          sRes.rowCount === 1 &&
          String(sRes.rows[0].tenant_id) === String(tenantId) &&
          String(sRes.rows[0].identity_id) === String(identityId)
        ) {
          await client.query(
            `
            UPDATE eip_auth.auth_session
            SET attrs = COALESCE(attrs,'{}'::jsonb)
              || jsonb_build_object('step_up_at', now(), 'assurance', 'high')
            WHERE id=$1::uuid
            `,
            [sRes.rows[0].id]
          );

          await client.query("COMMIT");
          app.log.info({ event: "step_up_success", tenantId, identityId, sessionId: sRes.rows[0].id, ip: req.ip });
          return reply.send({ ok: true, step_up: true });
        }
      }

      /* ---- DEVICE ---- */
      const deviceToken = req.cookies?.did || crypto.randomUUID();
      let deviceRow = await upsertBrowserDevice(app, client, {
        tenantId,
        identityId,
        deviceToken,
        req
      });
      if (!deviceRow) {
        throw new Error("DEVICE_UPSERT_FAILED");
      }

        if (deviceRow.trust_state === "revoked") {
          await client.query("ROLLBACK");
          return reply.code(401).send({ ok: false, error: "DEVICE_REVOKED" });
        }

        if (deviceRow.trust_state === "untrusted") {
          const trustRes = await client.query(
            `
            UPDATE eip_auth.auth_device
            SET trust_state='trusted', updated_at=now()
            WHERE tenant_id=$1 AND id=$2 AND trust_state='untrusted'
            RETURNING trust_state
            `,
            [tenantId, deviceRow.id]
          );
          if (trustRes.rowCount > 0) {
            deviceRow = { ...deviceRow, trust_state: trustRes.rows[0].trust_state };
            app.log.info({ event: "device_trusted_via_otp", tenantId, identityId, deviceId: deviceRow.id, ip: req.ip });
          }
        }

        if (app.config.REQUIRE_TRUSTED_DEVICE && deviceRow.trust_state !== "trusted") {
          const trustedRes = await client.query(
            `
            SELECT 1
            FROM eip_auth.auth_device
          WHERE tenant_id=$1 AND identity_id=$2 AND trust_state='trusted'
          LIMIT 1
          `,
          [tenantId, identityId]
        );

        if (trustedRes.rowCount === 0 && deviceRow.trust_state === "untrusted") {
          const trustRes = await client.query(
            `
            UPDATE eip_auth.auth_device
            SET trust_state='trusted', updated_at=now()
            WHERE tenant_id=$1 AND id=$2 AND trust_state='untrusted'
            RETURNING trust_state
            `,
            [tenantId, deviceRow.id]
          );

          if (trustRes.rowCount > 0) {
            deviceRow = { ...deviceRow, trust_state: trustRes.rows[0].trust_state };
            app.log.info({ event: "device_autotrusted", tenantId, identityId, deviceId: deviceRow.id, ip: req.ip });
          }
        }

        if (deviceRow.trust_state !== "trusted") {
          await client.query("COMMIT");
          const isProd = app.config.NODE_ENV === "production";
          const cookieBase = { path: "/", sameSite: "lax", secure: isProd };
          const deviceExpires = new Date(Date.now() + DEVICE_COOKIE_TTL_MS);
          reply.setCookie("did", deviceToken, { ...cookieBase, httpOnly: true, expires: deviceExpires });
          return reply.code(401).send({ ok: false, error: "DEVICE_UNTRUSTED", deviceId: deviceRow.id });
        }
      }

      const deviceId = deviceRow.id;

      /* ---- SESSION ---- */
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

      const csrf = randomToken(24);
      const csrfHash = sha256Hex(`${csrf}:${app.config.CSRF_PEPPER}`);
      const uaHash = sha256Hex(String(req.headers["user-agent"] || ""));

      await client.query(
        `
        INSERT INTO eip_auth.auth_session
          (id, tenant_id, identity_id, device_id,
           expires_at, csrf_secret_hash, ip_address, user_agent_hash, attrs)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,
           jsonb_build_object('realm', $9::text, 'step_up_at', now(), 'assurance', 'high'))
        `,
        [
          sessionId,
          tenantId,
          identityId,
          deviceId,
          expiresAt,
          csrfHash,
          req.ip,
          uaHash,
          "EIP"
        ]
      );

      await client.query("COMMIT");

      app.log.info({ event: "otp_verify_success", tenantId, identityId, deviceId, ip: req.ip });

      const isProd = app.config.NODE_ENV === "production";
      const cookieBase = { path: "/", sameSite: "lax", secure: isProd };
      const sessionExpires = expiresAt;
      const deviceExpires = new Date(Date.now() + DEVICE_COOKIE_TTL_MS);

      reply.setCookie("sid", sessionId, { ...cookieBase, httpOnly: true, expires: sessionExpires });
      reply.setCookie("csrf", csrf, { ...cookieBase, expires: sessionExpires });
      reply.setCookie("did", deviceToken, { ...cookieBase, httpOnly: true, expires: deviceExpires });

      return reply.send({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      if (e.message === "OTP_EXPIRED" || e.message === "INVALID" || e.message === "IDENTITY_DISABLED") {
        app.log.warn({ event: "otp_verify_failed", tenantId, login: login.substring(0, 3) + '...', ip: req.ip, reason: e.message });
        return reply.code(401).send({ ok: false, error: "INVALID_OTP" });
      }
      app.log.error({ event: "otp_verify_error", tenantId, login, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== WHOAMI (EIP) ===================== */
  app.get("/auth/whoami", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const { tenant_id, identity_id } = s.session;

    const r = await app.db.query(
      `
      SELECT
        i.login,
        i.attrs,
        t.code AS tenant_code,
        t.name AS tenant_name,
        COALESCE(
          t.attrs->'branding'->>'logo_url',
          t.attrs->'branding'->>'logo',
          t.attrs->>'logo_url',
          t.attrs->>'logo',
          t.attrs->>'brand_logo_url'
        ) AS tenant_logo_url
      FROM eip_auth.auth_identity i
      JOIN eip_core.tenant t ON t.id = i.tenant_id
      WHERE i.tenant_id=$1 AND i.id=$2
      `,
      [tenant_id, identity_id]
    );

    const row = r.rows[0] || {};
    const attrs = row.attrs || {};
    const isSystemAdmin = Boolean(attrs?.system_admin);

    return reply.send({
      ok: true,
      tenant_id,
      tenant_code: row.tenant_code || null,
      tenant_name: row.tenant_name || null,
      tenant_logo_url: row.tenant_logo_url || null,
      identity_id,
      login: row.login ?? null,
      is_system_admin: isSystemAdmin,
      session: s.session
    });
  });

  /* ===================== PROFILE (EIP) ===================== */
  app.get("/auth/profile", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const { tenant_id, identity_id } = s.session;
    let profile = await loadUserProfile(app.db, tenant_id, identity_id);
    if (!profile) {
      const r = await app.db.query(
        `
        SELECT login
        FROM eip_auth.auth_identity
        WHERE tenant_id=$1 AND id=$2
        LIMIT 1
        `,
        [tenant_id, identity_id]
      );
      const login = r.rows[0]?.login || "";
      const defaultName = login ? login.split("@")[0] : null;
      profile = await upsertUserProfile(app.db, tenant_id, identity_id, {
        display_name: defaultName || null
      });
    }
    return reply.send({ ok: true, profile });
  });

  app.put("/auth/profile", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });
    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const { tenant_id, identity_id } = s.session;
    const payload = {
      display_name: normalizeText(req.body?.display_name) || null,
      title: normalizeText(req.body?.title) || null,
      phone: normalizeText(req.body?.phone) || null,
      locale: normalizeText(req.body?.locale) || null,
      timezone: normalizeText(req.body?.timezone) || null,
      avatar_url: normalizeText(req.body?.avatar_url) || null,
      attrs: req.body?.attrs && typeof req.body.attrs === "object" ? req.body.attrs : {}
    };

    const profile = await upsertUserProfile(app.db, tenant_id, identity_id, payload);
    return reply.send({ ok: true, profile });
  });

  app.post(
    "/auth/profile/avatar",
    { errorHandler: createUploadErrorHandler("profile_avatar_upload_request_error") },
    async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });
    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const { tenant_id, identity_id } = s.session;
    let storedName;

    try {
      if (!req.isMultipart()) {
        return reply.code(415).send({
          ok: false,
          error: "MULTIPART_REQUIRED",
          message: "Upload requests must use multipart form data."
        });
      }

      const bodyFile = req.body?.file;
      let filePart = bodyFile;
      if (!filePart?.file && typeof filePart?.toBuffer !== "function") {
        filePart = await req.file();
      }
      if (!filePart || (!filePart.file && typeof filePart.toBuffer !== "function")) {
        return reply.code(400).send({
          ok: false,
          error: "FILE_REQUIRED",
          message: "Select an image to upload."
        });
      }

      const { filename, mimetype } = filePart;
      const buffer = await uploadPartToBuffer(filePart, {
        maxBytes: Number(app.config.UPLOAD_MAX_BYTES || DEFAULT_MAX_UPLOAD_BYTES)
      });
      const validation = validateImageUpload({ buffer, filename, mimetype });
      if (!validation.ok) {
        return reply.code(415).send({
          ok: false,
          error: "INVALID_IMAGE",
          reason: validation.error,
          message: "The selected file is not a valid supported image."
        });
      }

      const uploadDir = ensureUploadDirectory(
        resolveAssetRoot(app.config),
        [tenant_id, "avatars"]
      );
      storedName = `${identity_id}-${crypto.randomUUID()}${validation.safeExt}`;
      const targetPath = safeUploadTarget(uploadDir, storedName);
      const stored = await writeVerifiedUpload({
        app,
        targetPath,
        buffer,
        tenantId: tenant_id,
        storedName,
        assetKind: "media",
        category: "avatars",
        filename,
        mimetype
      });
      if (!stored.ok) {
        return reply.code(stored.status === "blocked" ? 415 : 202).send({
          ok: false,
          error: stored.error,
          scan_status: stored.scan_status
        });
      }
    } catch (error) {
      return sendUploadFailure(req, reply, error, {
        event: "profile_avatar_upload_error",
        context: { tenantId: tenant_id, identityId: identity_id }
      });
    }

    const rawUrl = `/assets/${tenant_id}/avatars/${storedName}`;
    const profile = await upsertUserProfile(app.db, tenant_id, identity_id, {
      avatar_url: rawUrl
    });

    return reply.send({ ok: true, avatar_url: rawUrl, profile });
    }
  );

  /* ===================== DEVICES LIST (EIP) ===================== */
  app.get("/auth/devices", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const { tenant_id, identity_id } = s.session;

    const allowed = await hasPermission(app, tenant_id, identity_id, "auth.device.read");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const dRes = await app.db.query(
      `
      SELECT id, device_kind, trust_state, label, last_seen_at, created_at
      FROM eip_auth.auth_device
      WHERE tenant_id=$1 AND identity_id=$2
      ORDER BY last_seen_at DESC NULLS LAST, created_at DESC
      `,
      [tenant_id, identity_id]
    );

    return reply.send({ ok: true, devices: dRes.rows });
  });

  /* ===================== TOTP LOGIN (PASSWORD + TOTP) ===================== */
  app.post("/auth/totp/login", { config: { rateLimit: TOTP_LOGIN_RATE_LIMIT } }, async (req, reply) => {
    const { tenantId: tenantIdRaw, tenantCode, email, password, token } = req.body || {};
    const login = String(email || "").trim().toLowerCase();
    const passwordValue = typeof password === "string" ? password : String(password || "");
    const cleanToken = normalizeOtp(token);

    if (!login || !passwordValue || !cleanToken || !/^\d{6}$/.test(cleanToken)) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");
      const tenantId = tenantIdRaw || (await resolveTenantIdByCode(client, tenantCode));
      if (!tenantId) {
        await client.query("COMMIT");
        return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
      }

      const idRes = await client.query(
        `
        SELECT id, is_active, is_locked
        FROM eip_auth.auth_identity
        WHERE tenant_id=$1 AND login=$2
        FOR UPDATE
        `,
        [tenantId, login]
      );
      if (idRes.rowCount === 0) {
        await client.query("COMMIT");
        app.log.warn({ event: "totp_login_unknown_identity", tenantId, login: login.substring(0, 3) + "...", ip: req.ip });
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      const identity = idRes.rows[0];
      if (!identity.is_active || identity.is_locked) {
        await client.query("COMMIT");
        app.log.warn({ event: "totp_login_disabled_identity", tenantId, login: login.substring(0, 3) + "...", ip: req.ip });
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      const credRes = await client.query(
        `
        SELECT secret_hash, algorithm
        FROM eip_auth.auth_credential
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='password'
          AND is_revoked=false
          AND (valid_to IS NULL OR valid_to > now())
        ORDER BY valid_from DESC NULLS LAST, created_at DESC
        LIMIT 1
        `,
        [tenantId, identity.id]
      );

      const credential = credRes.rows[0];
      const passwordOk = await verifyPassword(passwordValue, credential);
      if (!passwordOk) {
        await client.query("COMMIT");
        app.log.warn({ event: "totp_login_bad_password", tenantId, login: login.substring(0, 3) + "...", ip: req.ip });
        return reply.code(401).send({ ok: false, error: "LOGIN_FAILED" });
      }

      const totpRes = await client.query(
        `
        SELECT secret_enc
        FROM eip_auth.auth_credential
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='totp'
          AND is_revoked=false
          AND (valid_to IS NULL OR valid_to > now())
        ORDER BY valid_from DESC NULLS LAST, created_at DESC
        LIMIT 1
        `,
        [tenantId, identity.id]
      );

      if (totpRes.rowCount === 0) {
        await client.query("COMMIT");
        return reply.code(404).send({ ok: false, error: "TOTP_NOT_FOUND" });
      }

      const totpKey = getTotpSecretKey(app);
      if (!totpKey) {
        await client.query("ROLLBACK");
        app.log.error({ event: "totp_secret_key_invalid", tenantId, identityId: identity.id });
        return reply.code(500).send({ ok: false, error: "TOTP_UNAVAILABLE" });
      }

      const secret = normalizeTotpSecret(totpRes.rows[0]?.secret_enc, totpKey, app.log);
      if (!secret) {
        await client.query("ROLLBACK");
        return reply.code(500).send({ ok: false, error: "TOTP_SECRET_INVALID" });
      }

      let valid = false;
      try {
        const result = await totp.verify(cleanToken, { secret });
        valid = result?.valid === true;
      } catch {
        valid = false;
      }

      if (!valid) {
        await client.query("COMMIT");
        return reply.code(401).send({ ok: false, error: "INVALID_TOTP" });
      }

      // If an existing session matches this identity, treat this as step-up completion.
      const existingSid = req.cookies?.sid;
      if (existingSid) {
        const sRes = await client.query(
          `
          SELECT id, tenant_id, identity_id
          FROM eip_auth.auth_session
          WHERE id=$1::uuid
            AND is_revoked=false
            AND expires_at > now()
          LIMIT 1
          `,
          [existingSid]
        );

        if (
          sRes.rowCount === 1 &&
          String(sRes.rows[0].tenant_id) === String(tenantId) &&
          String(sRes.rows[0].identity_id) === String(identity.id)
        ) {
          await client.query(
            `
            UPDATE eip_auth.auth_session
            SET attrs = COALESCE(attrs,'{}'::jsonb)
              || jsonb_build_object('step_up_at', now(), 'assurance', 'high')
            WHERE id=$1::uuid
            `,
            [sRes.rows[0].id]
          );

          await client.query("COMMIT");
          app.log.info({ event: "totp_step_up_success", tenantId, identityId: identity.id, sessionId: sRes.rows[0].id, ip: req.ip });
          return reply.send({ ok: true, step_up: true });
        }
      }

      /* ---- DEVICE ---- */
      const deviceToken = req.cookies?.did || crypto.randomUUID();
      let deviceRow = await upsertBrowserDevice(app, client, {
        tenantId,
        identityId: identity.id,
        deviceToken,
        req
      });
      if (!deviceRow) {
        throw new Error("DEVICE_UPSERT_FAILED");
      }

        if (deviceRow.trust_state === "revoked") {
          await client.query("ROLLBACK");
          return reply.code(401).send({ ok: false, error: "DEVICE_REVOKED" });
        }

        if (deviceRow.trust_state === "untrusted") {
          const trustRes = await client.query(
            `
            UPDATE eip_auth.auth_device
            SET trust_state='trusted', updated_at=now()
            WHERE tenant_id=$1 AND id=$2 AND trust_state='untrusted'
            RETURNING trust_state
            `,
            [tenantId, deviceRow.id]
          );
          if (trustRes.rowCount > 0) {
            deviceRow = { ...deviceRow, trust_state: trustRes.rows[0].trust_state };
            app.log.info({ event: "device_trusted_via_totp", tenantId, identityId: identity.id, deviceId: deviceRow.id, ip: req.ip });
          }
        }

        if (app.config.REQUIRE_TRUSTED_DEVICE && deviceRow.trust_state !== "trusted") {
          const trustedRes = await client.query(
            `
            SELECT 1
            FROM eip_auth.auth_device
          WHERE tenant_id=$1 AND identity_id=$2 AND trust_state='trusted'
          LIMIT 1
          `,
          [tenantId, identity.id]
        );

        if (trustedRes.rowCount === 0 && deviceRow.trust_state === "untrusted") {
          const trustRes = await client.query(
            `
            UPDATE eip_auth.auth_device
            SET trust_state='trusted', updated_at=now()
            WHERE tenant_id=$1 AND id=$2 AND trust_state='untrusted'
            RETURNING trust_state
            `,
            [tenantId, deviceRow.id]
          );

          if (trustRes.rowCount > 0) {
            deviceRow = { ...deviceRow, trust_state: trustRes.rows[0].trust_state };
            app.log.info({ event: "device_autotrusted", tenantId, identityId: identity.id, deviceId: deviceRow.id, ip: req.ip });
          }
        }

        if (deviceRow.trust_state !== "trusted") {
          await client.query("COMMIT");
          const isProd = app.config.NODE_ENV === "production";
          const cookieBase = { path: "/", sameSite: "lax", secure: isProd };
          const deviceExpires = new Date(Date.now() + DEVICE_COOKIE_TTL_MS);
          reply.setCookie("did", deviceToken, { ...cookieBase, httpOnly: true, expires: deviceExpires });
          return reply.code(401).send({ ok: false, error: "DEVICE_UNTRUSTED", deviceId: deviceRow.id });
        }
      }

      const deviceId = deviceRow.id;

      /* ---- SESSION ---- */
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

      const csrf = randomToken(24);
      const csrfHash = sha256Hex(`${csrf}:${app.config.CSRF_PEPPER}`);
      const uaHash = sha256Hex(String(req.headers["user-agent"] || ""));

      await client.query(
        `
        INSERT INTO eip_auth.auth_session
          (id, tenant_id, identity_id, device_id,
           expires_at, csrf_secret_hash, ip_address, user_agent_hash, attrs)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,
           jsonb_build_object('realm', $9::text, 'step_up_at', now(), 'assurance', 'high'))
        `,
        [
          sessionId,
          tenantId,
          identity.id,
          deviceId,
          expiresAt,
          csrfHash,
          req.ip,
          uaHash,
          "EIP"
        ]
      );

      await client.query("COMMIT");

      app.log.info({ event: "totp_login_success", tenantId, identityId: identity.id, deviceId, ip: req.ip });

      const isProd = app.config.NODE_ENV === "production";
      const cookieBase = { path: "/", sameSite: "lax", secure: isProd };
      const sessionExpires = expiresAt;
      const deviceExpires = new Date(Date.now() + DEVICE_COOKIE_TTL_MS);

      reply.setCookie("sid", sessionId, { ...cookieBase, httpOnly: true, expires: sessionExpires });
      reply.setCookie("csrf", csrf, { ...cookieBase, expires: sessionExpires });
      reply.setCookie("did", deviceToken, { ...cookieBase, httpOnly: true, expires: deviceExpires });

      return reply.send({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "totp_login_error", tenantId: tenantIdRaw, login, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== TRUST DEVICE (EIP) ===================== */
  app.post("/auth/devices/:deviceId/trust", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const { tenant_id, identity_id } = s.session;

    const allowed = await hasPermission(app, tenant_id, identity_id, "auth.device.trust");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const deviceId = req.params.deviceId;

    const r = await app.db.query(
      `
      UPDATE eip_auth.auth_device
      SET trust_state='trusted', updated_at=now()
      WHERE tenant_id=$1 AND id=$2 AND identity_id=$3
      RETURNING id, trust_state
      `,
      [tenant_id, deviceId, identity_id]
    );

    if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

    app.log.info({ event: "device_trusted", tenantId: tenant_id, identityId: identity_id, deviceId, ip: req.ip });

    return reply.send({ ok: true, device: r.rows[0] });
  });

  /* ===================== REVOKE DEVICE (EIP) ===================== */
  app.post("/auth/devices/:deviceId/revoke", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const { tenant_id, identity_id } = s.session;

    const allowed = await hasPermission(app, tenant_id, identity_id, "auth.device.revoke");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const deviceId = req.params.deviceId;

    const r = await app.db.query(
      `
      UPDATE eip_auth.auth_device
      SET trust_state='revoked', updated_at=now()
      WHERE tenant_id=$1 AND id=$2 AND identity_id=$3
      RETURNING id, trust_state
      `,
      [tenant_id, deviceId, identity_id]
    );

    if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

    // revoke sessions linked to this device
    await app.db.query(
      `
      UPDATE eip_auth.auth_session
      SET is_revoked=true, revoked_at=now()
      WHERE tenant_id=$1 AND device_id=$2 AND is_revoked=false
      `,
      [tenant_id, deviceId]
    );

    app.log.info({ event: "device_revoked", tenantId: tenant_id, identityId: identity_id, deviceId, ip: req.ip });

    return reply.send({ ok: true, device: r.rows[0] });
  });

  /* ===================== LOGOUT ===================== */
  app.post("/auth/logout", async (req, reply) => {
    // use server-level CSRF guard
    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    // require session (and attach req.session)
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    await app.db.query(
      `
      UPDATE eip_auth.auth_session
      SET is_revoked=true, revoked_at=now()
      WHERE id=$1::uuid
      `,
      [s.session.id]
    );

    app.log.info({ event: "logout", tenantId: s.session.tenant_id, identityId: s.session.identity_id, sessionId: s.session.id, ip: req.ip });

    const isProd = app.config.NODE_ENV === "production";
    const clearOpts = { path: "/", sameSite: "lax", secure: isProd };

    reply.clearCookie("sid", clearOpts);
    reply.clearCookie("csrf", clearOpts);

    return reply.send({ ok: true });
  });


}
