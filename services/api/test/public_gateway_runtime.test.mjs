import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import Fastify from "fastify";
import publicGatewayRoutes from "../src/routes/public_gateway.js";
import { buildHmacSignature } from "../src/services/gateway/verification.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const HMAC_CONFIG = {
  header_name: "X-Signature",
  timestamp_header: "X-Timestamp",
  algorithm: "sha256",
  encoding: "hex",
  payload_mode: "timestamp_sha256",
  secret: "runtime-hmac-secret",
  max_skew_sec: 60
};

function baseProfile() {
  return {
    identity: {
      connection_name: "Runtime storefront",
      connection_code: "runtime-storefront",
      direction: "inbound",
      environment: "production",
      is_enabled: true
    },
    inbound: {
      inbound_path_suffix: "runtime-storefront",
      http_method: "POST",
      expected_content_type: "application/json",
      origin_allowlist: ["https://store.test"],
      rate_limit: { max: 1000, window_sec: 60 }
    },
    verification: {
      mode: "hmac_signature",
      hmac_signature: HMAC_CONFIG
    },
    idempotency: {
      event_id_location: "header",
      event_id_key: "X-Event-Id",
      idempotency_scope: "runtime-storefront"
    },
    routing: {
      channel: "custom",
      schema_version: "v1",
      envelope_profile: "canonical_v1"
    },
    audit: {
      audit_record_type: "GATEWAY_AUDIT",
      max_body_size: 262144,
      log_level: "info"
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

function makeDb(profile) {
  const idempotency = new Map();
  const audits = [];
  let auditCount = 0;

  return {
    audits,
    async query(sql, params = []) {
      const text = String(sql);

      if (text.includes("FROM eip_core.tenant") && text.includes("jsonb_array_elements")) {
        if (params[0] !== profile.inbound.inbound_path_suffix) return { rowCount: 0, rows: [] };
        return {
          rowCount: 1,
          rows: [{
            id: TENANT_ID,
            code: "runtime",
            name: "Runtime",
            attrs: { connection_profiles: [profile] }
          }]
        };
      }

      if (text.includes("FROM eip_core.connection_secret")) {
        return { rowCount: 0, rows: [] };
      }

      if (text.includes("INSERT INTO eip_core.idempotency_key")) {
        const key = `${params[0]}:${params[1]}:${params[2]}`;
        if (idempotency.has(key)) throw new Error("duplicate idempotency key");
        idempotency.set(key, {
          request_hash: params[3],
          status: "in_progress",
          response: null
        });
        return { rowCount: 1, rows: [] };
      }

      if (text.includes("SELECT request_hash, status, response") && text.includes("FROM eip_core.idempotency_key")) {
        const key = `${params[0]}:${params[1]}:${params[2]}`;
        const entry = idempotency.get(key);
        return entry ? { rowCount: 1, rows: [entry] } : { rowCount: 0, rows: [] };
      }

      if (text.includes("UPDATE eip_core.idempotency_key")) {
        const key = `${params[0]}:${params[1]}:${params[2]}`;
        const entry = idempotency.get(key);
        if (entry) {
          entry.response = JSON.parse(params[3] || "{}");
          entry.status = params[4] || "ok";
        }
        return { rowCount: entry ? 1 : 0, rows: [] };
      }

      if (text.includes("INSERT INTO eip_core.info_record")) {
        auditCount += 1;
        audits.push({
          payload: JSON.parse(params[2] || "{}"),
          attrs: JSON.parse(params[3] || "{}")
        });
        return { rowCount: 1, rows: [{ id: `audit-${auditCount}` }] };
      }

      throw new Error(`Unexpected SQL in gateway runtime test: ${text}`);
    }
  };
}

async function buildApp(profile = baseProfile()) {
  const app = Fastify({ logger: false });
  app.decorate("PUBLIC_ORIGINS", ["https://store.test"]);
  app.decorate("config", {
    INBOUND_RATE_LIMIT_MAX: 1000,
    INBOUND_RATE_LIMIT_WINDOW_SEC: 60
  });
  app.decorate("db", makeDb(profile));
  await app.register(publicGatewayRoutes, { prefix: "/api/public" });
  await app.ready();
  return app;
}

function signedRequestOptions({
  suffix = "runtime-storefront",
  origin = "https://store.test",
  eventId = "evt-1",
  body = { ok: true },
  timestamp = String(Math.floor(Date.now() / 1000)),
  signature
} = {}) {
  const payload = JSON.stringify(body);
  const computedSignature =
    signature === undefined
      ? buildHmacSignature({ ...HMAC_CONFIG, timestamp }, Buffer.from(payload))
      : signature;
  const headers = {
    "content-type": "application/json",
    origin,
    "x-timestamp": timestamp,
    "x-event-id": eventId
  };
  if (computedSignature !== null) headers["x-signature"] = computedSignature;
  return {
    method: "POST",
    url: `/api/public/gateway/intake/${suffix}`,
    headers,
    payload
  };
}

test("public gateway accepts a valid HMAC signed raw-body request", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const res = await app.inject(signedRequestOptions());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), {
    ok: true,
    accepted: true,
    intake_ref: "audit-1",
    event_id: "evt-1"
  });
});

test("public gateway accepts valid API key and JWT verification profiles at runtime", async (t) => {
  const apiKeyProfile = baseProfile();
  apiKeyProfile.verification = {
    mode: "api_key",
    api_key: { header_name: "X-API-Key", secret: "key-123" }
  };
  const apiKeyApp = await buildApp(apiKeyProfile);
  t.after(() => apiKeyApp.close());

  const apiKeyRes = await apiKeyApp.inject({
    method: "POST",
    url: "/api/public/gateway/intake/runtime-storefront",
    headers: {
      "content-type": "application/json",
      origin: "https://store.test",
      "x-event-id": "evt-api-key",
      "x-api-key": "key-123"
    },
    payload: JSON.stringify({ mode: "api_key" })
  });
  assert.equal(apiKeyRes.statusCode, 200);

  const jwtProfile = baseProfile();
  jwtProfile.verification = {
    mode: "oauth2_jwt",
    oauth2_jwt: {
      header_name: "Authorization",
      token_prefix: "Bearer",
      issuer: "issuer-a",
      audience: "aud-a",
      secret: "jwt-secret",
      max_skew_sec: 5,
      max_age_sec: 120
    }
  };
  const jwtApp = await buildApp(jwtProfile);
  t.after(() => jwtApp.close());

  const nowSec = Math.floor(Date.now() / 1000);
  const token = signJwt(
    { iss: "issuer-a", aud: "aud-a", iat: nowSec, exp: nowSec + 120 },
    "jwt-secret"
  );
  const jwtRes = await jwtApp.inject({
    method: "POST",
    url: "/api/public/gateway/intake/runtime-storefront",
    headers: {
      "content-type": "application/json",
      origin: "https://store.test",
      "x-event-id": "evt-jwt",
      authorization: `Bearer ${token}`
    },
    payload: JSON.stringify({ mode: "oauth2_jwt" })
  });
  assert.equal(jwtRes.statusCode, 200);
});

test("public gateway rejects missing and bad signatures", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const missing = await app.inject(signedRequestOptions({ signature: null }));
  assert.equal(missing.statusCode, 401);
  assert.equal(missing.json().error, "SIGNATURE_HEADER_MISSING");

  const bad = await app.inject(signedRequestOptions({ signature: "bad" }));
  assert.equal(bad.statusCode, 401);
  assert.equal(bad.json().error, "SIGNATURE_MISMATCH");
});

test("public gateway rejects expired timestamps and wrong origins before intake", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const expired = await app.inject(signedRequestOptions({ timestamp: String(Math.floor(Date.now() / 1000) - 120) }));
  assert.equal(expired.statusCode, 401);
  assert.equal(expired.json().error, "SIGNATURE_TIMESTAMP_EXPIRED");

  const wrongOrigin = await app.inject(signedRequestOptions({ origin: "https://evil.test" }));
  assert.equal(wrongOrigin.statusCode, 403);
  assert.equal(wrongOrigin.json().error, "ORIGIN_NOT_ALLOWED");
});

test("public gateway rejects duplicate event ids with different raw bodies", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const first = await app.inject(signedRequestOptions({ eventId: "evt-replay", body: { value: 1 } }));
  assert.equal(first.statusCode, 200);

  const replayConflict = await app.inject(signedRequestOptions({ eventId: "evt-replay", body: { value: 2 } }));
  assert.equal(replayConflict.statusCode, 409);
  assert.equal(replayConflict.json().error, "IDEMPOTENCY_CONFLICT");
});

test("public gateway rejects wrong suffix/profile routing", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const res = await app.inject(signedRequestOptions({ suffix: "missing-storefront" }));
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().error, "ROUTING_NOT_FOUND");
});

test("public gateway audit payload redacts headers, query values, body secrets, and raw body by default", async (t) => {
  const profile = baseProfile();
  profile.verification = {
    mode: "api_key",
    api_key: { header_name: "X-API-Key", secret: "key-123" }
  };
  profile.audit.include_raw_body = true;
  const app = await buildApp(profile);
  t.after(() => app.close());

  const body = {
    ok: true,
    password: "body-password",
    nested: {
      api_key: "nested-key",
      visible: "body-visible"
    }
  };
  const res = await app.inject({
    method: "POST",
    url: "/api/public/gateway/intake/runtime-storefront?customer=alice&token=query-secret",
    headers: {
      "content-type": "application/json",
      origin: "https://store.test",
      "x-event-id": "evt-audit-redaction",
      "x-api-key": "key-123",
      authorization: "Bearer bearer-secret",
      cookie: "sid=session-secret"
    },
    payload: JSON.stringify(body)
  });
  assert.equal(res.statusCode, 200);

  const auditPayload = app.db.audits[0].payload;
  const serialized = JSON.stringify(auditPayload);
  assert.equal(auditPayload.headers["x-api-key"], "[REDACTED]");
  assert.equal(auditPayload.headers.authorization, "[REDACTED]");
  assert.equal(auditPayload.headers.cookie, "[REDACTED]");
  assert.equal(auditPayload.query.customer, "[REDACTED]");
  assert.equal(auditPayload.query.token, "[REDACTED]");
  assert.equal(auditPayload.body.password, "[REDACTED]");
  assert.equal(auditPayload.body.nested.api_key, "[REDACTED]");
  assert.equal(auditPayload.body.nested.visible, "body-visible");
  assert.match(auditPayload.raw_body, /^\[REDACTED_RAW_BODY \d+ bytes\]$/);
  assert.equal(serialized.includes("key-123"), false);
  assert.equal(serialized.includes("bearer-secret"), false);
  assert.equal(serialized.includes("session-secret"), false);
  assert.equal(serialized.includes("query-secret"), false);
  assert.equal(serialized.includes("body-password"), false);
  assert.equal(serialized.includes("nested-key"), false);
});
