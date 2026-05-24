import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from "@simplewebauthn/server";

function normalizeText(value) {
  return String(value || "").trim();
}

function toBase64Url(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value) {
  return new Uint8Array(Buffer.from(String(value || ""), "base64url"));
}

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function originHost(origin) {
  try {
    return new URL(origin).hostname;
  } catch {
    return "";
  }
}

function resolvePasskeyRp(app) {
  const origins = parseOrigins(app?.config?.WEBAUTHN_ORIGIN || app?.config?.CORS_ORIGIN);
  const rpID = normalizeText(app?.config?.WEBAUTHN_RP_ID) || originHost(origins[0]);
  const rpName = normalizeText(app?.config?.WEBAUTHN_RP_NAME) || "EIP";
  if (!rpID || origins.length === 0) {
    throw new Error("WEBAUTHN_RP_CONFIG_REQUIRED");
  }
  return { rpID, rpName, expectedOrigin: origins };
}

function uuidToUserId(value) {
  const hex = normalizeText(value).replace(/-/g, "");
  if (/^[0-9a-fA-F]{32}$/.test(hex)) return new Uint8Array(Buffer.from(hex, "hex"));
  return new TextEncoder().encode(normalizeText(value));
}

function credentialFromRow(row) {
  return {
    id: row.credential_id,
    publicKey: fromBase64Url(row.public_key),
    counter: Number(row.counter || 0),
    transports: Array.isArray(row.transports) ? row.transports : []
  };
}

function publicPasskey(row) {
  return {
    id: row.id,
    label: row.label || "Passkey",
    credential_id: row.credential_id,
    device_type: row.device_type || null,
    backed_up: row.backed_up === true,
    transports: Array.isArray(row.transports) ? row.transports : [],
    last_used_at: row.last_used_at || null,
    created_at: row.created_at || null,
    is_revoked: row.is_revoked === true
  };
}

async function loadActivePasskeys(client, tenantId, identityId) {
  const r = await client.query(
    `
    SELECT id, credential_id, public_key, counter, transports, device_type, backed_up,
           label, last_used_at, created_at, is_revoked
    FROM eip_auth.auth_passkey
    WHERE tenant_id=$1
      AND identity_id=$2
      AND is_revoked=false
    ORDER BY last_used_at DESC NULLS LAST, created_at DESC
    `,
    [tenantId, identityId]
  );
  return r.rows || [];
}

async function loadPasskeyByCredential(client, credentialId) {
  const r = await client.query(
    `
    SELECT p.id, p.tenant_id, p.identity_id, p.credential_id, p.public_key, p.counter,
           p.transports, p.device_type, p.backed_up, p.label, p.last_used_at,
           i.login, i.is_active, i.is_locked
    FROM eip_auth.auth_passkey p
    JOIN eip_auth.auth_identity i
      ON i.tenant_id = p.tenant_id
     AND i.id = p.identity_id
    WHERE p.credential_id=$1
      AND p.is_revoked=false
    LIMIT 1
    `,
    [credentialId]
  );
  return r.rows[0] || null;
}

async function storePasskeyChallenge(client, payload) {
  const r = await client.query(
    `
    INSERT INTO eip_auth.auth_webauthn_challenge
      (tenant_id, identity_id, session_id, challenge, challenge_type, expires_at, attrs)
    VALUES
      ($1, $2, $3, $4, $5, now() + ($6 * interval '1 second'), $7::jsonb)
    RETURNING id, challenge, expires_at
    `,
    [
      payload.tenantId,
      payload.identityId || null,
      payload.sessionId || null,
      payload.challenge,
      payload.challengeType,
      Number(payload.ttlSec || 300),
      JSON.stringify(payload.attrs || {})
    ]
  );
  return r.rows[0];
}

async function loadAndConsumePasskeyChallenge(client, payload) {
  const params = [
    payload.challengeId,
    payload.challengeType,
    payload.tenantId || null,
    payload.identityId || null,
    payload.sessionId || null
  ];
  const r = await client.query(
    `
    SELECT id, tenant_id, identity_id, session_id, challenge, challenge_type, expires_at, consumed_at, attrs
    FROM eip_auth.auth_webauthn_challenge
    WHERE id=$1::uuid
      AND challenge_type=$2
      AND consumed_at IS NULL
      AND expires_at > now()
      AND ($3::uuid IS NULL OR tenant_id=$3::uuid)
      AND ($4::uuid IS NULL OR identity_id=$4::uuid)
      AND ($5::uuid IS NULL OR session_id=$5::uuid)
    LIMIT 1
    FOR UPDATE
    `,
    params
  );
  const row = r.rows[0] || null;
  if (!row) return null;
  await client.query(
    "UPDATE eip_auth.auth_webauthn_challenge SET consumed_at=now() WHERE id=$1::uuid",
    [row.id]
  );
  return row;
}

async function buildRegistrationOptions(app, client, payload) {
  const rp = resolvePasskeyRp(app);
  const existing = await loadActivePasskeys(client, payload.tenantId, payload.identityId);
  const options = await generateRegistrationOptions({
    rpName: rp.rpName,
    rpID: rp.rpID,
    userName: payload.login,
    userID: uuidToUserId(payload.identityId),
    userDisplayName: payload.displayName || payload.login,
    attestationType: "none",
    excludeCredentials: existing.map((row) => ({
      id: row.credential_id,
      transports: Array.isArray(row.transports) ? row.transports : []
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required"
    },
    timeout: Number(app?.config?.WEBAUTHN_TIMEOUT_MS || 60000)
  });
  return { options, rp };
}

async function buildAuthenticationOptions(app, passkeys) {
  const rp = resolvePasskeyRp(app);
  const options = await generateAuthenticationOptions({
    rpID: rp.rpID,
    allowCredentials: passkeys.map((row) => ({
      id: row.credential_id,
      transports: Array.isArray(row.transports) ? row.transports : []
    })),
    userVerification: "required",
    timeout: Number(app?.config?.WEBAUTHN_TIMEOUT_MS || 60000)
  });
  return { options, rp };
}

async function verifyPasskeyRegistration(app, response, challenge) {
  const rp = resolvePasskeyRp(app);
  return verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: rp.expectedOrigin,
    expectedRPID: rp.rpID,
    requireUserVerification: true
  });
}

async function verifyPasskeyAuthentication(app, response, challenge, passkey) {
  const rp = resolvePasskeyRp(app);
  return verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: rp.expectedOrigin,
    expectedRPID: rp.rpID,
    credential: credentialFromRow(passkey),
    requireUserVerification: true
  });
}

export {
  buildAuthenticationOptions,
  buildRegistrationOptions,
  credentialFromRow,
  loadActivePasskeys,
  loadAndConsumePasskeyChallenge,
  loadPasskeyByCredential,
  publicPasskey,
  resolvePasskeyRp,
  storePasskeyChallenge,
  toBase64Url,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration
};
