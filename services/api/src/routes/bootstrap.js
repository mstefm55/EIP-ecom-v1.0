// services/api/src/routes/bootstrap.js
import crypto from "node:crypto";
import argon2 from "argon2";
import { NobleCryptoPlugin, ScureBase32Plugin, TOTP } from "otplib";
import { randomToken, sha256Hex } from "../auth/crypto.js";
import {
  clearAuthCookie,
  deviceCookieTtlMs,
  getAuthCookie,
  setAuthCookie,
  sessionTtlMs
} from "../lib/authCookies.js";
import { evaluatePasswordStrength } from "../auth/password.js";
import { auditSecurityEvent } from "../lib/securityAudit.js";

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

function auditBootstrapEvent(app, action, session, req, metadata = {}) {
  auditSecurityEvent(app, action, {
    category: "bootstrap",
    source: "bootstrap",
    severity: "info",
    outcome: "success",
    tenantId: session?.tenant_id || null,
    identityId: session?.identity_id || null,
    ip: req.ip,
    userAgent: req.headers?.["user-agent"] || null,
    metadata
  });
}

function normalizeAgreementEntry(entry) {
  const code = String(entry?.code || "").trim().toUpperCase();
  const version = String(entry?.version || "").trim();
  if (!code || !version) return null;
  if (code.length > 64 || version.length > 64) return null;
  return { code, version };
}

function getTotpSecretKey(app) {
  const raw = String(app?.config?.TOTP_SECRET_KEY || "").trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) return null;
  return key;
}

function encryptTotpSecret(secret, key) {
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

async function requireBootstrapSession(app, req, reply) {
  const s = await app.requireSession(req, { realm: "EIP" });
  if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

  const stage = s.session?.attrs?.stage;
  if (stage !== "bootstrap") {
    return reply.code(403).send({ ok: false, error: "BOOTSTRAP_REQUIRED" });
  }

  // Treat bootstrap token possession as step-up; refresh the window to avoid TTL expiry mid-bootstrap.
  const stepUpAt = new Date().toISOString();
  await app.db.query(
    `
    UPDATE eip_auth.auth_session
    SET attrs = COALESCE(attrs,'{}'::jsonb)
      || jsonb_build_object('step_up_at', now(), 'assurance', 'bootstrap')
    WHERE id=$1::uuid
    `,
    [s.session.id]
  );
  s.session.attrs = { ...(s.session.attrs || {}), step_up_at: stepUpAt, assurance: "bootstrap" };

  return s.session;
}

async function fetchBootstrapChecklist(client, tenantId, identityId, deviceId) {
  const pwRes = await client.query(
    `
    SELECT 1
    FROM eip_auth.auth_credential
    WHERE tenant_id=$1
      AND identity_id=$2
      AND credential_type='password'
      AND is_revoked=false
      AND (valid_to IS NULL OR valid_to > now())
    LIMIT 1
    `,
    [tenantId, identityId]
  );

  const totpRes = await client.query(
    `
    SELECT 1
    FROM eip_auth.auth_credential
    WHERE tenant_id=$1
      AND identity_id=$2
      AND credential_type='totp'
      AND is_revoked=false
      AND (valid_to IS NULL OR valid_to > now())
    LIMIT 1
    `,
    [tenantId, identityId]
  );

  let deviceTrusted = false;
  if (deviceId) {
    const devRes = await client.query(
      `
      SELECT trust_state
      FROM eip_auth.auth_device
      WHERE tenant_id=$1 AND id=$2 AND identity_id=$3
      `,
      [tenantId, deviceId, identityId]
    );
    deviceTrusted = devRes.rowCount > 0 && devRes.rows[0].trust_state === "trusted";
  }

  return {
    passwordSet: pwRes.rowCount > 0,
    totpEnabled: totpRes.rowCount > 0,
    deviceTrusted
  };
}

async function findMissingAgreements(client, tenantId, required) {
  if (!Array.isArray(required) || required.length === 0) return [];

  const params = [tenantId];
  const tuples = required.map((entry, idx) => {
    params.push(entry.code, entry.version);
    return `($${idx * 2 + 2}, $${idx * 2 + 3})`;
  });

  const r = await client.query(
    `
    SELECT agreement_code, agreement_version
    FROM eip_core.tenant_agreement
    WHERE tenant_id=$1
      AND status_code='ACCEPTED'
      AND (agreement_code, agreement_version) IN (${tuples.join(",")})
    `,
    params
  );

  const accepted = new Set(
    r.rows.map((row) => `${row.agreement_code}:${row.agreement_version}`)
  );
  return required.filter(
    (entry) => !accepted.has(`${entry.code}:${entry.version}`)
  );
}

export default async function bootstrapRoutes(app) {
  app.post(
    "/bootstrap/consume",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      bodyLimit: 4096,
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["token"],
          properties: { token: { type: "string", minLength: 16, maxLength: 256 } }
        }
      }
    },
    async (req, reply) => {
      const rawToken = String(req.body?.token || "").trim();
      if (!rawToken) return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });

      const tokenHash = sha256Hex(`${rawToken}:${app.config.BOOTSTRAP_TOKEN_PEPPER}`);

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const r = await client.query(
          `
          SELECT id, tenant_id, admin_identity_id, status_code,
                 bootstrap_expires_at, bootstrap_used_at
          FROM eip_core.tenant_request
          WHERE bootstrap_token_hash = $1
          FOR UPDATE
          `,
          [tokenHash]
        );

        if (r.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.code(401).send({ ok: false, error: "INVALID_TOKEN" });
        }

        const row = r.rows[0];
        if (row.status_code !== "BOOTSTRAP_PENDING") {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: "INVALID_STATUS" });
        }
        if (row.bootstrap_used_at) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: "TOKEN_USED" });
        }
        if (row.bootstrap_expires_at && new Date(row.bootstrap_expires_at).getTime() <= Date.now()) {
          await client.query("ROLLBACK");
          return reply.code(401).send({ ok: false, error: "TOKEN_EXPIRED" });
        }
        if (!row.tenant_id || !row.admin_identity_id) {
          await client.query("ROLLBACK");
          return reply.code(500).send({ ok: false, error: "BOOTSTRAP_STATE_INVALID" });
        }

        const deviceToken = getAuthCookie(req, app, "did") || randomToken(24);
        const deviceRow = await upsertBrowserDevice(app, client, {
          tenantId: row.tenant_id,
          identityId: row.admin_identity_id,
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

        const sessionId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + sessionTtlMs(app));
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
             jsonb_build_object('realm', $9::text, 'stage', 'bootstrap', 'assurance', 'bootstrap', 'step_up_at', now()))
          `,
          [
            sessionId,
            row.tenant_id,
            row.admin_identity_id,
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
          UPDATE eip_core.tenant_request
          SET bootstrap_used_at = now(),
              attrs = COALESCE(attrs,'{}'::jsonb) || jsonb_build_object(
                'bootstrap_consumed_at', now(),
                'email_verified_at', now()
              )
          WHERE id=$1::uuid
          `,
          [row.id]
        );

        const steps = await fetchBootstrapChecklist(client, row.tenant_id, row.admin_identity_id, deviceRow.id);

        await client.query("COMMIT");

        const sessionExpires = expiresAt;
        const deviceExpires = new Date(Date.now() + deviceCookieTtlMs(app));

        setAuthCookie(reply, app, "sid", sessionId, { httpOnly: true, expires: sessionExpires });
        setAuthCookie(reply, app, "csrf", csrf, { httpOnly: true, expires: sessionExpires });
        setAuthCookie(reply, app, "did", deviceToken, { httpOnly: true, expires: deviceExpires });
        auditBootstrapEvent(app, "bootstrap.consumed", {
          tenant_id: row.tenant_id,
          identity_id: row.admin_identity_id
        }, req, { request_id: row.id });

        return reply.send({
          ok: true,
          stage: "bootstrap",
          tenantId: row.tenant_id,
          identityId: row.admin_identity_id,
          csrf,
          csrfToken: csrf,
          steps
        });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "bootstrap_consume_error", ip: req.ip, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.post("/bootstrap/password", async (req, reply) => {
    const session = await requireBootstrapSession(app, req, reply);
    if (!session) return;

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const passwordValue = typeof req.body?.password === "string" ? req.body.password : String(req.body?.password || "");
    if (!passwordValue || passwordValue.length > 256) {
      return reply.code(400).send({ ok: false, error: "WEAK_PASSWORD" });
    }
    const strength = evaluatePasswordStrength(passwordValue);
    if (!strength.ok) {
      return reply.code(400).send({ ok: false, error: "WEAK_PASSWORD", ...strength });
    }

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `
        UPDATE eip_auth.auth_credential
        SET is_revoked=true, valid_to=now()
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='password'
          AND is_revoked=false
        `,
        [session.tenant_id, session.identity_id]
      );

      const secretHash = await argon2.hash(passwordValue, { type: argon2.argon2id });
      await client.query(
        `
        INSERT INTO eip_auth.auth_credential
          (tenant_id, identity_id, credential_type, secret_hash, algorithm, valid_from, is_revoked)
        VALUES
          ($1,$2,'password',$3,'argon2id',now(),false)
        `,
        [session.tenant_id, session.identity_id, secretHash]
      );

      await client.query(
        `
        UPDATE eip_core.tenant_request
        SET attrs = COALESCE(attrs,'{}'::jsonb) || jsonb_build_object('password_set_at', now())
        WHERE tenant_id=$1 AND admin_identity_id=$2
        `,
        [session.tenant_id, session.identity_id]
      );

      await client.query("COMMIT");
      app.log.info({ event: "bootstrap_password_set", tenantId: session.tenant_id, identityId: session.identity_id, ip: req.ip });
      auditBootstrapEvent(app, "bootstrap.password_set", session, req);
      return reply.send({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "bootstrap_password_error", tenantId: session.tenant_id, identityId: session.identity_id, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.post("/bootstrap/totp/enroll", async (req, reply) => {
    const session = await requireBootstrapSession(app, req, reply);
    if (!session) return;

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const totpKey = getTotpSecretKey(app);
    if (!totpKey) {
      app.log.error({ event: "totp_secret_key_invalid", tenantId: session.tenant_id, identityId: session.identity_id });
      return reply.code(500).send({ ok: false, error: "TOTP_UNAVAILABLE" });
    }

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      const loginRes = await client.query(
        `
        SELECT login
        FROM eip_auth.auth_identity
        WHERE tenant_id=$1 AND id=$2
        `,
        [session.tenant_id, session.identity_id]
      );
      const label = loginRes.rows[0]?.login ?? String(session.identity_id);

      await client.query(
        `
        UPDATE eip_auth.auth_credential
        SET is_revoked=true, valid_to=now()
        WHERE tenant_id=$1
          AND identity_id=$2
          AND credential_type='totp'
          AND is_revoked=false
        `,
        [session.tenant_id, session.identity_id]
      );

      const secret = totp.generateSecret();
      const secretEnc = encryptTotpSecret(secret, totpKey);

      await client.query(
        `
        INSERT INTO eip_auth.auth_credential
          (tenant_id, identity_id, credential_type, secret_enc, algorithm, meta, valid_from, is_revoked)
        VALUES
          ($1,$2,'totp',$3,'totp',$4::jsonb,now(),true)
        `,
        [session.tenant_id, session.identity_id, secretEnc, JSON.stringify({ pending: true })]
      );

      await client.query("COMMIT");

      const issuer = String(app.config.TOTP_ISSUER || "EIP");
      const uri = totp.toURI({ label, issuer, secret });

      return reply.send({ ok: true, secret, uri });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "bootstrap_totp_enroll_error", tenantId: session.tenant_id, identityId: session.identity_id, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.post("/bootstrap/totp/confirm", async (req, reply) => {
    const session = await requireBootstrapSession(app, req, reply);
    if (!session) return;

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const token = normalizeOtp(req.body?.token);
    if (!token || !/^\d{6}$/.test(token)) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }

    const totpKey = getTotpSecretKey(app);
    if (!totpKey) {
      app.log.error({ event: "totp_secret_key_invalid", tenantId: session.tenant_id, identityId: session.identity_id });
      return reply.code(500).send({ ok: false, error: "TOTP_UNAVAILABLE" });
    }

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
        [session.tenant_id, session.identity_id]
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

      await client.query(
        `
        UPDATE eip_core.tenant_request
        SET attrs = COALESCE(attrs,'{}'::jsonb) || jsonb_build_object('totp_enabled_at', now())
        WHERE tenant_id=$1 AND admin_identity_id=$2
        `,
        [session.tenant_id, session.identity_id]
      );

      await client.query("COMMIT");
      app.log.info({ event: "bootstrap_totp_enabled", tenantId: session.tenant_id, identityId: session.identity_id, ip: req.ip });
      auditBootstrapEvent(app, "bootstrap.totp_enabled", session, req);
      return reply.send({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "bootstrap_totp_confirm_error", tenantId: session.tenant_id, identityId: session.identity_id, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  app.post("/bootstrap/device/trust", async (req, reply) => {
    const session = await requireBootstrapSession(app, req, reply);
    if (!session) return;

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    if (!session.device_id) {
      return reply.code(400).send({ ok: false, error: "DEVICE_REQUIRED" });
    }

    const r = await app.db.query(
      `
      UPDATE eip_auth.auth_device
      SET trust_state='trusted', updated_at=now()
      WHERE tenant_id=$1 AND id=$2 AND identity_id=$3
      RETURNING id, trust_state
      `,
      [session.tenant_id, session.device_id, session.identity_id]
    );

    if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

    await app.db.query(
      `
      UPDATE eip_core.tenant_request
      SET attrs = COALESCE(attrs,'{}'::jsonb) || jsonb_build_object('device_trusted_at', now())
      WHERE tenant_id=$1 AND admin_identity_id=$2
      `,
      [session.tenant_id, session.identity_id]
    );

    app.log.info({ event: "bootstrap_device_trusted", tenantId: session.tenant_id, identityId: session.identity_id, deviceId: session.device_id, ip: req.ip });
    auditBootstrapEvent(app, "bootstrap.device_trusted", session, req, { device_id: session.device_id });
    return reply.send({ ok: true, device: r.rows[0] });
  });

  app.post(
    "/bootstrap/agreements/accept",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["agreements"],
          properties: {
            agreements: {
              type: "array",
              minItems: 1,
              maxItems: 20,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["code", "version"],
                properties: {
                  code: { type: "string", minLength: 1, maxLength: 64 },
                  version: { type: "string", minLength: 1, maxLength: 64 }
                }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requireBootstrapSession(app, req, reply);
      if (!session) return;

      const c = await app.requireCsrf(req);
      if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

      const step = await app.requireStepUp(req);
      if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

      const raw = Array.isArray(req.body?.agreements) ? req.body.agreements : [];
      if (raw.length === 0 || raw.length > 20) {
        return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
      }

      const normalized = [];
      const seenCodes = new Set();
      for (const entry of raw) {
        const item = normalizeAgreementEntry(entry);
        if (!item) {
          return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
        }
        if (seenCodes.has(item.code)) {
          return reply.code(400).send({ ok: false, error: "DUPLICATE_AGREEMENT" });
        }
        seenCodes.add(item.code);
        normalized.push(item);
      }

      const uaHash = sha256Hex(String(req.headers["user-agent"] || ""));
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        await client.query(
          `
          UPDATE eip_core.tenant_agreement
          SET status_code='SUPERSEDED', updated_at=now()
          WHERE tenant_id=$1
            AND status_code='ACCEPTED'
            AND agreement_code = ANY($2::text[])
          `,
          [session.tenant_id, normalized.map((item) => item.code)]
        );

        for (const item of normalized) {
          await client.query(
            `
            INSERT INTO eip_core.tenant_agreement
              (tenant_id, agreement_code, agreement_version, status_code,
               accepted_by_identity_id, ip_address, user_agent_hash)
            VALUES
              ($1,$2,$3,'ACCEPTED',$4,$5,$6)
            ON CONFLICT (tenant_id, agreement_code, agreement_version)
            DO UPDATE SET
              status_code='ACCEPTED',
              accepted_at=now(),
              accepted_by_identity_id=EXCLUDED.accepted_by_identity_id,
              ip_address=EXCLUDED.ip_address,
              user_agent_hash=EXCLUDED.user_agent_hash
            `,
            [
              session.tenant_id,
              item.code,
              item.version,
              session.identity_id,
              req.ip,
              uaHash
            ]
          );
        }

        await client.query("COMMIT");
        app.log.info({ event: "bootstrap_agreements_accepted", tenantId: session.tenant_id, identityId: session.identity_id, count: normalized.length, ip: req.ip });
        auditBootstrapEvent(app, "bootstrap.agreements_accepted", session, req, {
          agreement_count: normalized.length,
          agreement_codes: normalized.map((item) => item.code)
        });
        return reply.send({ ok: true });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "bootstrap_agreements_accept_error", tenantId: session.tenant_id, identityId: session.identity_id, ip: req.ip, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.post("/bootstrap/complete", async (req, reply) => {
    const session = await requireBootstrapSession(app, req, reply);
    if (!session) return;

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      const steps = await fetchBootstrapChecklist(client, session.tenant_id, session.identity_id, session.device_id);
      if (!steps.passwordSet || !steps.totpEnabled || !steps.deviceTrusted) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: "BOOTSTRAP_INCOMPLETE", steps });
      }

      const required = app.REQUIRED_TENANT_AGREEMENTS || [];
      const missing = await findMissingAgreements(client, session.tenant_id, required);
      if (missing.length > 0) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: "AGREEMENTS_REQUIRED", missing });
      }

      await client.query(
        `
        UPDATE eip_core.tenant
        SET is_active=true, status_code='ACTIVE', updated_at=now()
        WHERE id=$1::uuid
        `,
        [session.tenant_id]
      );

      await client.query(
        `
        UPDATE eip_core.tenant_request
        SET status_code='ACTIVE',
            attrs = COALESCE(attrs,'{}'::jsonb) || jsonb_build_object('bootstrap_completed_at', now())
        WHERE tenant_id=$1 AND admin_identity_id=$2
        `,
        [session.tenant_id, session.identity_id]
      );

      await client.query(
        `
        UPDATE eip_auth.auth_session
        SET is_revoked=true, revoked_at=now()
        WHERE tenant_id=$1
          AND (attrs->>'stage') = 'bootstrap'
          AND is_revoked=false
        `,
        [session.tenant_id]
      );

      await client.query("COMMIT");

      clearAuthCookie(reply, app, "sid");
      clearAuthCookie(reply, app, "csrf");

      app.log.info({ event: "bootstrap_completed", tenantId: session.tenant_id, identityId: session.identity_id, ip: req.ip });
      auditBootstrapEvent(app, "bootstrap.completed", session, req);
      return reply.code(204).send();
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "bootstrap_complete_error", tenantId: session.tenant_id, identityId: session.identity_id, ip: req.ip, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });
}
