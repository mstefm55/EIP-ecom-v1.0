import crypto from "node:crypto";
import { randomToken, sha256Hex, timingSafeEqual } from "../auth/crypto.js";
import { authCookieBase } from "../lib/authCookies.js";

/**
 * In-memory challenges (dev + single instance).
 * Map<challengeId, { tenantId, login, identityId, publicKeyPem, expiresAt }>
 */
const challenges = new Map();

function nowMs() {
  return Date.now();
}

function b64urlToBuf(b64url) {
  // base64url -> base64
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  return Buffer.from(b64, "base64");
}

function bufToB64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function verifyEd25519Signature({ publicKeyPem, messageB64url, signatureB64url }) {
  const publicKey = crypto.createPublicKey(publicKeyPem);
  const msgBuf = b64urlToBuf(messageB64url);
  const sigBuf = Buffer.from(signatureB64url, "base64"); // signature accepted as base64 (not url) for simplicity

  // For Ed25519, algorithm is null in Node
  return crypto.verify(null, msgBuf, publicKey, sigBuf);
}

async function upsertIdentity(app, client, { tenantId, login }) {
  // login is already normalized lowercase by caller
  const r = await client.query(
    `
    INSERT INTO eip_auth.auth_identity (tenant_id, login, login_type)
    VALUES ($1, $2, 'email')
    ON CONFLICT (tenant_id, login)
    DO UPDATE SET updated_at = now()
    RETURNING id, is_active, is_locked
    `,
    [tenantId, login]
  );

  const row = r.rows[0];
  if (!row.is_active || row.is_locked) {
    return { ok: false, error: "IDENTITY_DISABLED" };
  }
  return { ok: true, identityId: row.id };
}

async function upsertElectronDevice(app, client, { tenantId, identityId, publicKeyPem, label, req }) {
  const ua = String(req.headers["user-agent"] || "");
  const uaHash = sha256Hex(ua);

  const r = await client.query(
    `
    INSERT INTO eip_auth.auth_device
      (tenant_id, identity_id, device_kind, public_key_pem, label, last_seen_at, attrs)
    VALUES
      ($1, $2, 'electron', $3, $4, now(),
       jsonb_build_object('user_agent_hash', $5::text))
    ON CONFLICT (tenant_id, identity_id, device_kind, public_key_pem)
      WHERE device_kind='electron' AND public_key_pem IS NOT NULL
    DO UPDATE SET
      last_seen_at = now(),
      label = COALESCE(EXCLUDED.label, eip_auth.auth_device.label),
      attrs = COALESCE(eip_auth.auth_device.attrs,'{}'::jsonb) || EXCLUDED.attrs
    RETURNING id, trust_state
    `,
    [tenantId, identityId, publicKeyPem, label ?? null, uaHash]
  );

  return r.rows[0]; // { id, trust_state }
}

async function createSession(app, client, { tenantId, identityId, deviceId, req }) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h
  const csrf = randomToken(24);
  const csrfHash = sha256Hex(`${csrf}:${app.config.CSRF_PEPPER}`);
  const uaHash = sha256Hex(String(req.headers["user-agent"] || ""));

  await client.query(
    `
    INSERT INTO eip_auth.auth_session
      (id, tenant_id, identity_id, device_id,
       expires_at, csrf_secret_hash, ip_address, user_agent_hash)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `,
    [sessionId, tenantId, identityId, deviceId, expiresAt, csrfHash, req.ip, uaHash]
  );

  return { sessionId, csrf, expiresAt };
}

export default async function authElectronRoutes(app) {
  /**
   * POST /api/eip/auth/electron/challenge
   * Body: { tenantId, email, publicKeyPem, label? }
   * Returns: { ok, challengeId, challenge, expiresAt }
   */
  app.post("/auth/electron/challenge", async (req, reply) => {
    const { tenantId, email, publicKeyPem, label } = req.body || {};
    const login = String(email || "").trim().toLowerCase();

    if (!tenantId || !login || !publicKeyPem) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }

    const ttlSec = Number(app.config.ELECTRON_CHALLENGE_TTL_SEC ?? 120);
    const expiresAtMs = nowMs() + Math.max(30, ttlSec) * 1000;

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      const ident = await upsertIdentity(app, client, { tenantId, login });
      if (!ident.ok) {
        await client.query("ROLLBACK");
        return reply.code(401).send({ ok: false, error: ident.error });
      }

      const challengeId = crypto.randomUUID();
      const rawChallenge = crypto.randomBytes(32);
      const challenge = bufToB64url(rawChallenge); // base64url string

      // store in memory
      challenges.set(challengeId, {
        tenantId,
        login,
        identityId: ident.identityId,
        publicKeyPem,
        label: label ?? null,
        challenge,
        expiresAtMs,
      });

      await client.query("COMMIT");

      return reply.send({
        ok: true,
        challengeId,
        challenge,
        expiresAt: new Date(expiresAtMs).toISOString(),
      });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error(e);
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /**
   * POST /api/eip/auth/electron/attest
   * Body: { tenantId, email, challengeId, signatureBase64 }
   * Verifies signature(challenge) with provided publicKeyPem from challenge step.
   * If device trusted (or policy allows), creates session + sets cookies sid/csrf/did.
   */
  app.post("/auth/electron/attest", async (req, reply) => {
    const { tenantId, email, challengeId, signatureBase64 } = req.body || {};
    const login = String(email || "").trim().toLowerCase();

    if (!tenantId || !login || !challengeId || !signatureBase64) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
    }

    const ch = challenges.get(challengeId);
    if (!ch) return reply.code(401).send({ ok: false, error: "CHALLENGE_NOT_FOUND" });

    // hard match tenant/login to prevent replay across identities
    if (ch.tenantId !== tenantId || ch.login !== login) {
      return reply.code(401).send({ ok: false, error: "CHALLENGE_MISMATCH" });
    }

    if (nowMs() > ch.expiresAtMs) {
      challenges.delete(challengeId);
      return reply.code(401).send({ ok: false, error: "CHALLENGE_EXPIRED" });
    }

    let okSig = false;
    try {
      okSig = verifyEd25519Signature({
        publicKeyPem: ch.publicKeyPem,
        messageB64url: ch.challenge,
        signatureB64url: signatureBase64,
      });
    } catch (e) {
      okSig = false;
    }

    if (!okSig) return reply.code(401).send({ ok: false, error: "BAD_SIGNATURE" });

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      // ensure identity still exists/active
      const ident = await upsertIdentity(app, client, { tenantId, login });
      if (!ident.ok) {
        await client.query("ROLLBACK");
        return reply.code(401).send({ ok: false, error: ident.error });
      }

      const deviceRow = await upsertElectronDevice(app, client, {
        tenantId,
        identityId: ident.identityId,
        publicKeyPem: ch.publicKeyPem,
        label: ch.label,
        req,
      });

      // consume challenge (one-time)
      challenges.delete(challengeId);

      if (deviceRow.trust_state === "revoked") {
        await client.query("ROLLBACK");
        return reply.code(401).send({ ok: false, error: "DEVICE_REVOKED" });
      }

      const requireTrusted = Boolean(app.config.ELECTRON_DEVICE_REQUIRE_TRUSTED ?? true);
      if (requireTrusted && deviceRow.trust_state !== "trusted") {
        await client.query("COMMIT");
        return reply.send({
          ok: true,
          device: { id: deviceRow.id, trust_state: deviceRow.trust_state },
          requiresApproval: true,
        });
      }

      // create session (same model as browser)
      const sess = await createSession(app, client, {
        tenantId,
        identityId: ident.identityId,
        deviceId: deviceRow.id,
        req,
      });

      await client.query("COMMIT");

      // Cookies for parity with browser flow
      const cookieBase = { ...authCookieBase(app), expires: sess.expiresAt };

      reply.setCookie("sid", sess.sessionId, { ...cookieBase, httpOnly: true });
      reply.setCookie("csrf", sess.csrf, { ...cookieBase });
      reply.setCookie("did", deviceRow.id, { ...cookieBase, httpOnly: true });

      return reply.send({
        ok: true,
        device: { id: deviceRow.id, trust_state: deviceRow.trust_state },
        session: { sid: sess.sessionId, expiresAt: sess.expiresAt.toISOString() },
      });
    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error(e);
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });
}
