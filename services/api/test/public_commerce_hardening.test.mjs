import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import publicCommerceRoutes from "../src/routes/public_commerce.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000101";

function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const data = `${encode(header)}.${encode(payload)}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

function baseProfile(overrides = {}) {
  return {
    identity: {
      connection_name: "Storefront",
      connection_code: "storefront",
      direction: "inbound",
      environment: "production",
      is_enabled: true,
      ...(overrides.identity || {})
    },
    inbound: {
      inbound_path_suffix: "storefront",
      origin_allowlist: ["https://store.test"],
      ...(overrides.inbound || {})
    },
    verification: overrides.verification || {
      mode: "api_key",
      api_key: { header_name: "X-API-Key", secret: "key-123" }
    },
    routing: {
      channel: "website_intake",
      ...(overrides.routing || {})
    },
    audit: {
      max_body_size: 262144,
      ...(overrides.audit || {})
    }
  };
}

function makeDb(profile) {
  const tenant = {
    id: TENANT_ID,
    code: "store",
    name: "Store",
    attrs: { connection_profiles: [profile] }
  };

  return {
    async query(sql, params = []) {
      const text = String(sql);

      if (text.includes("FROM eip_core.tenant") && text.includes("jsonb_array_elements")) {
        const suffix = params[0];
        const rows = profile.inbound?.inbound_path_suffix === suffix ? [tenant] : [];
        return { rowCount: rows.length, rows };
      }

      if (text.includes("FROM eip_core.connection_secret")) {
        return { rowCount: 0, rows: [] };
      }

      if (text.includes("INSERT INTO eip_core.security_event")) {
        return { rowCount: 1, rows: [{ id: "security-event" }] };
      }

      throw new Error(`Unexpected SQL in public commerce hardening test: ${text}`);
    }
  };
}

async function buildApp(profile) {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  app.decorate("config", {
    API_KEY_PEPPER: "pepper",
    CSRF_PEPPER: "csrf",
    AUTH_COOKIE_CROSS_SITE: false,
    NODE_ENV: "test",
    SECRET_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef"
  });
  app.decorate("db", makeDb(profile));
  await app.register(publicCommerceRoutes, { prefix: "/api/public" });
  await app.ready();
  return app;
}

function commerceRequest({ query = "", headers = {}, payload = {} } = {}) {
  return {
    method: "POST",
    url: `/api/public/commerce/storefront/member/auth/start${query}`,
    headers: {
      origin: "https://store.test",
      "content-type": "application/json",
      "x-api-key": "key-123",
      ...headers
    },
    payload: JSON.stringify(payload)
  };
}

test("public commerce rejects production connections without verification", async (t) => {
  const app = await buildApp(baseProfile({ verification: { mode: "none" } }));
  t.after(() => app.close());

  const res = await app.inject(commerceRequest());
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, "VERIFICATION_REQUIRED");
});

test("suffix-aware payment session OPTIONS accepts Samara public checkout headers", async (t) => {
  const app = await buildApp(baseProfile());
  t.after(() => app.close());

  const response = await app.inject({
    method: "OPTIONS",
    url: "/api/public/commerce/storefront/checkout/payment-session",
    headers: {
      origin: "https://store.test",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type, x-api-key, x-event-id"
    }
  });

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["access-control-allow-origin"], "https://store.test");
  assert.match(response.headers["access-control-allow-methods"], /POST/);
  assert.match(response.headers["access-control-allow-headers"], /Content-Type/);
  assert.match(response.headers["access-control-allow-headers"], /X-API-Key/);
  assert.match(response.headers["access-control-allow-headers"], /X-Event-Id/);
});

test("public commerce requires production origin allowlists and rejects wildcard origins", async (t) => {
  const noOriginApp = await buildApp(baseProfile({ inbound: { origin_allowlist: [] } }));
  t.after(() => noOriginApp.close());

  const noOrigin = await noOriginApp.inject(commerceRequest());
  assert.equal(noOrigin.statusCode, 403);
  assert.equal(noOrigin.json().error, "ORIGIN_ALLOWLIST_REQUIRED");

  const wildcardApp = await buildApp(baseProfile({ inbound: { origin_allowlist: ["*"] } }));
  t.after(() => wildcardApp.close());

  const wildcard = await wildcardApp.inject(commerceRequest());
  assert.equal(wildcard.statusCode, 403);
  assert.equal(wildcard.json().error, "WILDCARD_ORIGIN_FORBIDDEN");
});

test("public commerce rejects query-string API keys before verification", async (t) => {
  const app = await buildApp(baseProfile());
  t.after(() => app.close());

  const res = await app.inject(commerceRequest({ query: "?api_key=key-123" }));
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error, "QUERY_API_KEY_REJECTED");
});

test("public commerce applies JWT lifetime validation through the shared verifier", async (t) => {
  const profile = baseProfile({
    verification: {
      mode: "oauth2_jwt",
      oauth2_jwt: {
        header_name: "Authorization",
        token_prefix: "Bearer",
        issuer: "issuer-a",
        audience: "aud-a",
        secret: "jwt-secret",
        max_skew_sec: 5,
        max_age_sec: 60
      }
    }
  });
  const app = await buildApp(profile);
  t.after(() => app.close());

  const nowSec = Math.floor(Date.now() / 1000);
  const expired = signJwt(
    { iss: "issuer-a", aud: "aud-a", iat: nowSec - 120, exp: nowSec - 30 },
    "jwt-secret"
  );
  const res = await app.inject(commerceRequest({
    headers: {
      authorization: `Bearer ${expired}`
    }
  }));
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error, "JWT_INVALID");
});
