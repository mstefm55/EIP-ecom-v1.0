import crypto from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHmacSignature,
  connectionAllowsOrigin,
  verifyConnectionRequest
} from "../src/services/gateway/verification.js";

const NOW_SEC = 1_700_000_000;
const RAW_BODY = Buffer.from(JSON.stringify({ event: "created", amount: 42 }));

function req(headers = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }
  return { headers: normalized };
}

function profile({ environment = "production", verification, originAllowlist = ["https://store.test"] } = {}) {
  return {
    identity: {
      environment,
      direction: "inbound",
      is_enabled: true,
      connection_code: "storefront"
    },
    inbound: {
      origin_allowlist: originAllowlist
    },
    verification: verification || {
      mode: "api_key",
      api_key: { header_name: "X-API-Key", secret: "key-123" }
    }
  };
}

function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const data = `${encode(header)}.${encode(payload)}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

test("api_key mode accepts the configured header and rejects missing or bad keys", async () => {
  const p = profile();

  assert.deepEqual(
    await verifyConnectionRequest(req({ "X-API-Key": "key-123" }), p, RAW_BODY, { nowSec: NOW_SEC }),
    { ok: true }
  );
  assert.equal(
    (await verifyConnectionRequest(req(), p, RAW_BODY, { nowSec: NOW_SEC })).error,
    "INVALID_API_KEY"
  );
  assert.equal(
    (await verifyConnectionRequest(req({ "X-API-Key": "wrong" }), p, RAW_BODY, { nowSec: NOW_SEC })).error,
    "INVALID_API_KEY"
  );
});

test("hmac_signature mode signs the raw body with a fresh timestamp", async () => {
  const hmac = {
    header_name: "X-Signature",
    timestamp_header: "X-Timestamp",
    algorithm: "sha256",
    encoding: "hex",
    payload_mode: "timestamp_sha256",
    secret: "hmac-secret",
    max_skew_sec: 60
  };
  const timestamp = new Date(NOW_SEC * 1000).toISOString();
  const signature = buildHmacSignature({ ...hmac, timestamp }, RAW_BODY);
  const p = profile({ verification: { mode: "hmac_signature", hmac_signature: hmac } });

  assert.deepEqual(
    await verifyConnectionRequest(
      req({ "X-Timestamp": timestamp, "X-Signature": signature }),
      p,
      RAW_BODY,
      { nowSec: NOW_SEC }
    ),
    { ok: true }
  );
  assert.equal(
    (await verifyConnectionRequest(req({ "X-Timestamp": timestamp }), p, RAW_BODY, { nowSec: NOW_SEC })).error,
    "SIGNATURE_HEADER_MISSING"
  );
  assert.equal(
    (await verifyConnectionRequest(
      req({ "X-Timestamp": timestamp, "X-Signature": "bad" }),
      p,
      RAW_BODY,
      { nowSec: NOW_SEC }
    )).error,
    "SIGNATURE_MISMATCH"
  );

  const oldTimestamp = String(NOW_SEC - 120);
  const oldSignature = buildHmacSignature({ ...hmac, timestamp: oldTimestamp }, RAW_BODY);
  assert.equal(
    (await verifyConnectionRequest(
      req({ "X-Timestamp": oldTimestamp, "X-Signature": oldSignature }),
      p,
      RAW_BODY,
      { nowSec: NOW_SEC }
    )).error,
    "SIGNATURE_TIMESTAMP_EXPIRED"
  );
});

test("oauth2_jwt mode requires issuer, audience, prefix, expiry, and max age", async () => {
  const jwtConfig = {
    header_name: "Authorization",
    token_prefix: "Bearer",
    issuer: "issuer-a",
    audience: "aud-a",
    secret: "jwt-secret",
    max_skew_sec: 5,
    max_age_sec: 120
  };
  const p = profile({ verification: { mode: "oauth2_jwt", oauth2_jwt: jwtConfig } });
  const token = signJwt(
    { iss: "issuer-a", aud: "aud-a", iat: NOW_SEC - 10, exp: NOW_SEC + 30 },
    "jwt-secret"
  );

  assert.deepEqual(
    await verifyConnectionRequest(req({ Authorization: `Bearer ${token}` }), p, RAW_BODY, { nowSec: NOW_SEC }),
    { ok: true }
  );
  assert.equal(
    (await verifyConnectionRequest(req({ Authorization: token }), p, RAW_BODY, { nowSec: NOW_SEC })).error,
    "JWT_PREFIX_MISMATCH"
  );

  const expired = signJwt(
    { iss: "issuer-a", aud: "aud-a", iat: NOW_SEC - 300, exp: NOW_SEC - 30 },
    "jwt-secret"
  );
  assert.equal(
    (await verifyConnectionRequest(req({ Authorization: `Bearer ${expired}` }), p, RAW_BODY, { nowSec: NOW_SEC })).error,
    "JWT_INVALID"
  );
});

test("origin and unverified-mode runtime rules are production safe", async () => {
  assert.equal(connectionAllowsOrigin(profile(), "https://store.test"), true);
  assert.equal(connectionAllowsOrigin(profile(), "https://evil.test"), false);
  assert.equal(
    connectionAllowsOrigin(profile({ originAllowlist: ["*"], environment: "production" }), "https://store.test"),
    false
  );
  assert.equal(
    connectionAllowsOrigin(profile({ originAllowlist: ["*"], environment: "sandbox" }), "https://store.test"),
    true
  );
  assert.equal(
    connectionAllowsOrigin(profile({ originAllowlist: ["server"], environment: "production" }), ""),
    true
  );

  const none = { mode: "none", allow_unverified: true };
  assert.equal(
    (await verifyConnectionRequest(req(), profile({ verification: none, environment: "production" }), RAW_BODY)).error,
    "VERIFICATION_REQUIRED"
  );
  assert.deepEqual(
    await verifyConnectionRequest(req(), profile({ verification: none, environment: "sandbox" }), RAW_BODY),
    { ok: true }
  );
});
