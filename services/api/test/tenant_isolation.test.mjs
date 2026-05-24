import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import gatewayRoutes from "../src/routes/gateway.js";
import publicGatewayRoutes from "../src/routes/public_gateway.js";
import publicCommerceRoutes from "../src/routes/public_commerce.js";
import { sha256Hex } from "../src/auth/crypto.js";
import { sessionCanAccessAssetTenant } from "../src/services/assets/access.js";
import { buildSignedAssetUrl, verifyAssetToken } from "../src/services/assets/signing.js";
import { isTenantAssetPath, sanitizeAssetUrlForStorage } from "../src/services/assets/url_policy.js";

const OWNER_TENANT = "00000000-0000-4000-8000-0000000000aa";
const TENANT_A = "00000000-0000-4000-8000-0000000000a1";
const TENANT_B = "00000000-0000-4000-8000-0000000000b2";
const IDENTITY_A = "10000000-0000-4000-8000-0000000000a1";
const OWNER_IDENTITY = "10000000-0000-4000-8000-0000000000aa";

function profile({ code, suffix, origin, apiKey = "site-key", channel = "website_intake" }) {
  return {
    identity: {
      connection_name: code,
      connection_code: code,
      direction: "inbound",
      environment: "production",
      is_enabled: true
    },
    inbound: {
      inbound_path_suffix: suffix,
      http_method: "POST",
      expected_content_type: "application/json",
      origin_allowlist: [origin]
    },
    verification: {
      mode: "api_key",
      api_key: { header_name: "X-API-Key", secret: apiKey }
    },
    idempotency: {
      event_id_location: "header",
      event_id_key: "X-Event-Id",
      idempotency_scope: code
    },
    routing: { channel },
    audit: { audit_record_type: "GATEWAY_AUDIT", max_body_size: 262144 }
  };
}

const tenantAProfile = profile({
  code: "tenant-a-store",
  suffix: "tenant-a-store",
  origin: "https://tenant-a.test",
  apiKey: "tenant-a-key"
});
const tenantBProfile = profile({
  code: "tenant-b-store",
  suffix: "tenant-b-store",
  origin: "https://tenant-b.test",
  apiKey: "tenant-b-key"
});

function makeTenantRow(id, code, attrs = {}) {
  return {
    id,
    code,
    name: code,
    is_active: true,
    created_at: "2026-05-24T12:00:00Z",
    attrs
  };
}

function makeGatewayControlDb() {
  const calls = [];
  const tenants = new Map([
    [OWNER_TENANT, makeTenantRow(OWNER_TENANT, "owner", { tenant_kind: "owner_admin" })],
    [TENANT_A, makeTenantRow(TENANT_A, "tenant_a", { connection_profiles: [tenantAProfile] })],
    [TENANT_B, makeTenantRow(TENANT_B, "tenant_b", { connection_profiles: [tenantBProfile] })]
  ]);

  return {
    calls,
    async query(sql, params = []) {
      const text = String(sql);
      calls.push({ sql: text, params });

      if (text.includes("FROM eip_authz.identity_role") || text.includes("FROM eip_authz.identity_permission")) {
        return { rowCount: 1, rows: [{ "?column?": 1 }] };
      }

      if (text.includes("FROM eip_auth.auth_identity i") && text.includes("JOIN eip_core.tenant t")) {
        const tenant = tenants.get(params[0]);
        return {
          rowCount: tenant ? 1 : 0,
          rows: tenant
            ? [{
                login: "user@example.test",
                identity_attrs: {},
                tenant_id: tenant.id,
                tenant_code: tenant.code,
                tenant_name: tenant.name,
                tenant_attrs: tenant.attrs || {},
                tenant_logo_url: null
              }]
            : []
        };
      }

      if (text.includes("FROM eip_core.tenant t") && text.includes("GROUP BY t.id")) {
        const requestedTenant = params[0] || null;
        const rows = [...tenants.values()]
          .filter((tenant) => tenant.id !== OWNER_TENANT)
          .filter((tenant) => !requestedTenant || tenant.id === requestedTenant)
          .map((tenant) => ({
            ...tenant,
            last_handshake_at: null,
            handshake_7d: 0
          }));
        return { rowCount: rows.length, rows };
      }

      if (text.includes("FROM eip_core.tenant") && text.includes("WHERE id = $1::uuid")) {
        const tenant = tenants.get(params[0]);
        return { rowCount: tenant ? 1 : 0, rows: tenant ? [tenant] : [] };
      }

      if (text.includes("FROM eip_auth.auth_api_key")) {
        return { rowCount: 0, rows: [] };
      }

      if (text.includes("FROM eip_core.info_record")) {
        if (text.includes("count(*)")) {
          return { rowCount: 1, rows: [{ last_24h: 0, last_7d: 0, last_seen: null }] };
        }
        return { rowCount: 0, rows: [] };
      }

      throw new Error(`Unexpected SQL in gateway control isolation test: ${text}`);
    }
  };
}

async function buildGatewayControlApp(session) {
  const app = Fastify({ logger: false });
  app.decorate("config", {
    PORT: 3000,
    API_KEY_PEPPER: "pepper",
    OWNER_TENANT_CODE: "owner",
    REQUIRE_PASSKEY_FOR_PRIVILEGED_ACTIONS: false
  });
  app.decorate("db", makeGatewayControlDb());
  app.decorate("requireSession", async () => ({ ok: true, session: { ...session, attrs: { realm: "EIP" }, realm: "EIP" } }));
  app.decorate("requireCsrf", async () => ({ ok: true }));
  app.decorate("requireStepUp", async () => ({ ok: true }));
  await app.register(gatewayRoutes, { prefix: "/api/eip" });
  await app.ready();
  return app;
}

function makePublicGatewayDb() {
  const tenants = new Map([
    [TENANT_A, makeTenantRow(TENANT_A, "tenant_a", { connection_profiles: [tenantAProfile] })],
    [TENANT_B, makeTenantRow(TENANT_B, "tenant_b", { connection_profiles: [tenantBProfile] })]
  ]);
  const keyHashA = sha256Hex("tenant-a-key:pepper");

  return {
    async query(sql, params = []) {
      const text = String(sql);

      if (text.includes("FROM eip_auth.auth_api_key")) {
        if (params[0] !== keyHashA) return { rowCount: 0, rows: [] };
        return {
          rowCount: 1,
          rows: [{ id: "key-a", tenant_id: TENANT_A, is_active: true, expires_at: null }]
        };
      }

      if (text.includes("FROM eip_core.tenant") && text.includes("WHERE id = $1")) {
        const tenant = tenants.get(params[0]);
        return { rowCount: tenant ? 1 : 0, rows: tenant ? [tenant] : [] };
      }

      if (text.includes("FROM eip_core.tenant") && text.includes("jsonb_array_elements")) {
        const suffix = params[0];
        const rows = [...tenants.values()].filter((tenant) =>
          (tenant.attrs.connection_profiles || []).some((item) => item.inbound?.inbound_path_suffix === suffix)
        );
        return { rowCount: rows.length, rows };
      }

      if (text.includes("FROM eip_core.connection_secret")) {
        return { rowCount: 0, rows: [] };
      }

      if (text.includes("INSERT INTO eip_core.info_record")) {
        return { rowCount: 1, rows: [{ id: "audit-denied" }] };
      }

      throw new Error(`Unexpected SQL in public gateway isolation test: ${text}`);
    }
  };
}

async function buildPublicGatewayApp() {
  const app = Fastify({ logger: false });
  app.decorate("PUBLIC_ORIGINS", ["https://tenant-a.test", "https://tenant-b.test"]);
  app.decorate("config", {
    API_KEY_PEPPER: "pepper",
    INBOUND_RATE_LIMIT_MAX: 1000,
    INBOUND_RATE_LIMIT_WINDOW_SEC: 60
  });
  app.decorate("db", makePublicGatewayDb());
  await app.register(publicGatewayRoutes, { prefix: "/api/public" });
  await app.ready();
  return app;
}

function makePublicCommerceDb() {
  const storefrontTenant = makeTenantRow(TENANT_A, "tenant_a", { connection_profiles: [tenantAProfile] });

  return {
    async query(sql, params = []) {
      const text = String(sql);

      if (text.includes("FROM eip_core.tenant") && text.includes("jsonb_array_elements")) {
        const suffix = params[0];
        const rows = tenantAProfile.inbound.inbound_path_suffix === suffix ? [storefrontTenant] : [];
        return { rowCount: rows.length, rows };
      }

      if (text.includes("FROM eip_core.connection_secret")) {
        return { rowCount: 0, rows: [] };
      }

      if (text.includes("FROM eip_auth.auth_session")) {
        return {
          rowCount: 1,
          rows: [{
            id: params[0],
            tenant_id: OWNER_TENANT,
            identity_id: OWNER_IDENTITY,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            is_revoked: false,
            attrs: { realm: "EIP" },
            csrf_secret_hash: "unused"
          }]
        };
      }

      throw new Error(`Unexpected SQL in public commerce isolation test: ${text}`);
    }
  };
}

async function buildPublicCommerceApp() {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  app.decorate("config", {
    API_KEY_PEPPER: "pepper",
    CSRF_PEPPER: "csrf",
    AUTH_COOKIE_CROSS_SITE: false,
    NODE_ENV: "test",
    SECRET_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef"
  });
  app.decorate("db", makePublicCommerceDb());
  await app.register(publicCommerceRoutes, { prefix: "/api/public" });
  await app.ready();
  return app;
}

test("tenant connection control plane blocks tenant A from tenant B connections", async (t) => {
  const app = await buildGatewayControlApp({
    id: "session-a",
    tenant_id: TENANT_A,
    identity_id: IDENTITY_A
  });
  t.after(() => app.close());

  const read = await app.inject({
    method: "GET",
    url: `/api/eip/gateway/connections/${TENANT_B}`
  });
  assert.equal(read.statusCode, 403);
  assert.equal(read.json().error, "TENANT_SCOPE_FORBIDDEN");

  const write = await app.inject({
    method: "POST",
    url: `/api/eip/gateway/connections/${TENANT_B}/profile`,
    headers: { "content-type": "application/json" },
    payload: JSON.stringify({ connections: [] })
  });
  assert.equal(write.statusCode, 403);
  assert.equal(write.json().error, "TENANT_SCOPE_FORBIDDEN");
});

test("tenant connection list is tenant-scoped, while owner admin may inspect another tenant", async (t) => {
  const tenantApp = await buildGatewayControlApp({
    id: "session-a",
    tenant_id: TENANT_A,
    identity_id: IDENTITY_A
  });
  t.after(() => tenantApp.close());

  const list = await tenantApp.inject({ method: "GET", url: "/api/eip/gateway/connections" });
  assert.equal(list.statusCode, 200);
  assert.deepEqual(list.json().items.map((item) => item.id), [TENANT_A]);
  assert.equal(tenantApp.db.calls.some((call) => call.params[0] === TENANT_A), true);

  const ownerApp = await buildGatewayControlApp({
    id: "session-owner",
    tenant_id: OWNER_TENANT,
    identity_id: OWNER_IDENTITY
  });
  t.after(() => ownerApp.close());

  const readOther = await ownerApp.inject({
    method: "GET",
    url: `/api/eip/gateway/connections/${TENANT_B}`
  });
  assert.equal(readOther.statusCode, 200);
  assert.equal(readOther.json().tenant.id, TENANT_B);
});

test("public gateway API key cannot select another tenant's connection and rejects bad keys/origins", async (t) => {
  const app = await buildPublicGatewayApp();
  t.after(() => app.close());

  const queryKey = await app.inject({
    method: "GET",
    url: "/api/public/gateway/bootstrap?connection_code=tenant-a-store&api_key=tenant-a-key",
    headers: {
      origin: "https://tenant-a.test"
    }
  });
  assert.equal(queryKey.statusCode, 401);
  assert.equal(queryKey.json().error, "QUERY_API_KEY_REJECTED");

  const badKey = await app.inject({
    method: "GET",
    url: "/api/public/gateway/bootstrap?connection_code=tenant-a-store",
    headers: {
      origin: "https://tenant-a.test",
      "x-api-key": "wrong-key"
    }
  });
  assert.equal(badKey.statusCode, 401);
  assert.equal(badKey.json().error, "INVALID_API_KEY");

  const wrongConnection = await app.inject({
    method: "GET",
    url: "/api/public/gateway/bootstrap?connection_code=tenant-b-store",
    headers: {
      origin: "https://tenant-a.test",
      "x-api-key": "tenant-a-key"
    }
  });
  assert.equal(wrongConnection.statusCode, 404);
  assert.equal(wrongConnection.json().error, "CONNECTION_NOT_FOUND");

  const wrongOrigin = await app.inject({
    method: "GET",
    url: "/api/public/gateway/bootstrap?connection_code=tenant-a-store",
    headers: {
      origin: "https://tenant-b.test",
      "x-api-key": "tenant-a-key"
    }
  });
  assert.equal(wrongOrigin.statusCode, 403);
  assert.equal(wrongOrigin.json().error, "ORIGIN_NOT_ALLOWED");
});

test("owner EIP session cookie cannot authenticate as a storefront member", async (t) => {
  const app = await buildPublicCommerceApp();
  t.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: "/api/public/commerce/tenant-a-store/member/auth/me",
    headers: {
      origin: "https://tenant-a.test",
      "x-api-key": "tenant-a-key",
      cookie: "member_sid=owner-session"
    }
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true, authenticated: false, member: null });
});

test("signed asset URLs and stored media paths are tenant-bound", () => {
  const exp = Math.floor(Date.now() / 1000) + 300;
  const tenantAPath = `/assets/${TENANT_A}/products/photo.png`;
  const signed = buildSignedAssetUrl(tenantAPath, exp, "asset-pepper");
  const signedUrl = new URL(signed, "http://local");

  assert.equal(verifyAssetToken(tenantAPath, signedUrl.searchParams.get("exp"), signedUrl.searchParams.get("token"), "asset-pepper"), true);

  const tenantBPath = `/assets/${TENANT_B}/products/photo.png`;
  assert.equal(verifyAssetToken(tenantBPath, signedUrl.searchParams.get("exp"), signedUrl.searchParams.get("token"), "asset-pepper"), false);
  assert.equal(isTenantAssetPath(tenantAPath, TENANT_A), true);
  assert.equal(isTenantAssetPath(tenantBPath, TENANT_A), false);
  assert.equal(sessionCanAccessAssetTenant({ tenant_id: TENANT_A, realm: "EIP" }, TENANT_A), true);
  assert.equal(sessionCanAccessAssetTenant({ tenant_id: TENANT_B, realm: "EIP" }, TENANT_A), false);
  assert.equal(
    sessionCanAccessAssetTenant(
      { tenant_id: OWNER_TENANT, realm: "EIP" },
      TENANT_A,
      { is_owner_admin_session: true }
    ),
    true
  );
  assert.equal(sessionCanAccessAssetTenant({ tenant_id: TENANT_A, realm: "MEMBER" }, TENANT_A), false);
  assert.throws(
    () => sanitizeAssetUrlForStorage(tenantBPath, TENANT_A),
    /ASSET_TENANT_MISMATCH/
  );
});
