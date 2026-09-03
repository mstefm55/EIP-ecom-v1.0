import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import publicCommerceRoutes from "../src/routes/public_commerce.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000701";
const OTHER_TENANT_ID = "00000000-0000-4000-8000-000000000702";
const IDENTITY_ID = "00000000-0000-4000-8000-000000000711";
const SESSION_ID = "00000000-0000-4000-8000-000000000712";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000721";
const CSRF = "member-csrf-token";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function profile(overrides = {}) {
  return {
    identity: {
      connection_name: "Perfect Fit storefront",
      connection_code: "perfect-fit-storefront",
      direction: "inbound",
      environment: "production",
      is_enabled: true
    },
    inbound: {
      inbound_path_suffix: "perfect-fit",
      origin_allowlist: ["https://perfect-fit.test"]
    },
    verification: {
      mode: "api_key",
      api_key: { header_name: "X-API-Key", secret: "browser-key" }
    },
    routing: { channel: "website_intake" },
    public_storefront: {
      public_api_enabled: true,
      perfect_fit_enabled: true,
      scopes: ["perfect_fit.products.read", "perfect_fit.products.write"]
    },
    audit: { max_body_size: 262144 },
    ...overrides
  };
}

function createDb(connectionProfile, tenantId = TENANT_ID) {
  const idempotency = new Map();
  const productTenantParams = [];
  const db = {
    productTenantParams,
    async query(sql, params = []) {
      const text = String(sql);
      if (text.includes("FROM eip_core.tenant") && text.includes("jsonb_array_elements")) {
        return params[0] === "perfect-fit"
          ? { rowCount: 1, rows: [{ id: tenantId, code: "pf", name: "PF", attrs: { connection_profiles: [connectionProfile] } }] }
          : { rowCount: 0, rows: [] };
      }
      if (text.includes("FROM eip_core.connection_secret")) return { rowCount: 0, rows: [] };
      if (text.includes("FROM eip_auth.auth_session")) {
        if (params[0] !== SESSION_ID) return { rowCount: 0, rows: [] };
        return {
          rowCount: 1,
          rows: [{
            id: SESSION_ID,
            tenant_id: tenantId,
            identity_id: IDENTITY_ID,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            is_revoked: false,
            attrs: { realm: "MEMBER", connection_suffix: "perfect-fit" },
            csrf_secret_hash: sha256(`${CSRF}:csrf-pepper`)
          }]
        };
      }
      if (text.includes("FROM eip_auth.auth_identity i") && text.includes("LEFT JOIN eip_core.user_profile")) {
        return {
          rowCount: 1,
          rows: [{
            identity_id: IDENTITY_ID,
            login: "member@perfect-fit.test",
            identity_attrs: { category: "MEMBER", member_code: "MEM-1", username: "maker" },
            display_name: "Member Maker",
            profile_attrs: {},
            avatar_url: null
          }]
        };
      }
      if (text.includes("FROM eip_core.material") && text.includes("ORDER BY updated_at")) {
        productTenantParams.push(params[0]);
        return {
          rowCount: 1,
          rows: [{
            id: PRODUCT_ID,
            code: "PRD-1",
            title: tenantId === OTHER_TENANT_ID ? "Other tenant product" : "Tenant product",
            attrs: { content: { summary: "Safe projection" }, private_cost: 999 },
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z"
          }]
        };
      }
      if (text.includes("INSERT INTO eip_core.idempotency_key")) {
        idempotency.set(`${params[0]}:${params[1]}:${params[2]}`, { request_hash: params[3], status: "in_progress" });
        return { rowCount: 1, rows: [] };
      }
      if (text.includes("SELECT request_hash, status, response") && text.includes("eip_core.idempotency_key")) {
        const value = idempotency.get(`${params[0]}:${params[1]}:${params[2]}`);
        return value ? { rowCount: 1, rows: [value] } : { rowCount: 0, rows: [] };
      }
      if (text.includes("UPDATE eip_core.idempotency_key")) return { rowCount: 1, rows: [] };
      if (text.includes("INSERT INTO eip_core.security_event")) return { rowCount: 1, rows: [{ id: crypto.randomUUID() }] };
      throw new Error(`Unexpected SQL: ${text}`);
    },
    async connect() {
      return {
        query: async (sql, params = []) => {
          const text = String(sql);
          if (["BEGIN", "COMMIT", "ROLLBACK"].includes(text)) return { rowCount: 0, rows: [] };
          if (text.includes("FROM eip_core.object_link ol")) return { rowCount: 0, rows: [] };
          return db.query(sql, params);
        },
        release() {}
      };
    }
  };
  return db;
}

async function buildApp(connectionProfile = profile(), tenantId = TENANT_ID) {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  app.decorate("config", {
    API_KEY_PEPPER: "api-pepper",
    CSRF_PEPPER: "csrf-pepper",
    AUTH_COOKIE_CROSS_SITE: true,
    NODE_ENV: "test",
    SECRET_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef"
  });
  app.decorate("db", createDb(connectionProfile, tenantId));
  await app.register(publicCommerceRoutes, { prefix: "/api/public" });
  await app.ready();
  return app;
}

function headers(overrides = {}) {
  return {
    origin: "https://perfect-fit.test",
    "x-api-key": "browser-key",
    cookie: `member_sid=${SESSION_ID}; member_csrf=${CSRF}`,
    ...overrides
  };
}

const basePath = "/api/public/commerce/perfect-fit/perfect-fit";

test("Perfect Fit public capability requires exact key, origin, and member session", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const valid = await app.inject({ method: "GET", url: `${basePath}/capability`, headers: headers() });
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.json().capability.available, true);
  assert.equal(valid.json().capability.member.identity_id, IDENTITY_ID);
  assert.equal(valid.json().capability.tenant_id, undefined);

  const noSession = await app.inject({
    method: "GET",
    url: `${basePath}/capability`,
    headers: headers({ cookie: "" })
  });
  assert.equal(noSession.statusCode, 401);
  assert.equal(noSession.json().error, "MEMBER_UNAUTHENTICATED");

  const badKey = await app.inject({
    method: "GET",
    url: `${basePath}/capability`,
    headers: headers({ "x-api-key": "wrong" })
  });
  assert.equal(badKey.statusCode, 401);

  const badOrigin = await app.inject({
    method: "GET",
    url: `${basePath}/capability`,
    headers: headers({ origin: "https://attacker.test" })
  });
  assert.equal(badOrigin.statusCode, 403);
  assert.equal(badOrigin.json().error, "ORIGIN_NOT_ALLOWED");
});

test("Perfect Fit product projection is member-only and tenant-derived", async (t) => {
  const app = await buildApp(profile(), OTHER_TENANT_ID);
  t.after(() => app.close());
  const response = await app.inject({ method: "GET", url: `${basePath}/products?q=tenant`, headers: headers() });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(app.db.productTenantParams, [OTHER_TENANT_ID]);
  assert.equal(response.json().items[0].title, "Other tenant product");
  assert.equal(response.json().items[0].attrs, undefined);
  assert.equal(response.json().items[0].shared_metadata.description, "Safe projection");
});

test("Perfect Fit writes require dedicated scope, member CSRF, and idempotency", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());
  const url = `${basePath}/products/${PRODUCT_ID}/link`;

  const missingCsrf = await app.inject({
    method: "DELETE",
    url,
    headers: headers({ "x-member-csrf": "" })
  });
  assert.equal(missingCsrf.statusCode, 403);
  assert.equal(missingCsrf.json().error, "CSRF_MISSING");

  const missingIdempotency = await app.inject({
    method: "DELETE",
    url,
    headers: headers({ "x-member-csrf": CSRF })
  });
  assert.equal(missingIdempotency.statusCode, 400);
  assert.equal(missingIdempotency.json().error, "IDEMPOTENCY_REQUIRED");

  const valid = await app.inject({
    method: "DELETE",
    url,
    headers: headers({ "x-member-csrf": CSRF, "x-event-id": "unlink-1" })
  });
  assert.equal(valid.statusCode, 200);
  assert.deepEqual(valid.json(), { ok: true, unlinked: false, records_deleted: false });

  const tenantOverride = await app.inject({
    method: "POST",
    url: `${basePath}/products/register`,
    headers: headers({
      "content-type": "application/json",
      "x-member-csrf": CSRF,
      "x-event-id": "register-override"
    }),
    payload: JSON.stringify({ tenant_id: OTHER_TENANT_ID })
  });
  assert.equal(tenantOverride.statusCode, 400);
  assert.equal(tenantOverride.json().error, "TENANT_OVERRIDE_FORBIDDEN");

  const noWriteProfile = profile({
    public_storefront: {
      public_api_enabled: true,
      perfect_fit_enabled: true,
      scopes: ["perfect_fit.products.read"]
    }
  });
  const readOnlyApp = await buildApp(noWriteProfile);
  t.after(() => readOnlyApp.close());
  const forbidden = await readOnlyApp.inject({
    method: "DELETE",
    url,
    headers: headers({ "x-member-csrf": CSRF, "x-event-id": "unlink-2" })
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error, "STOREFRONT_SCOPE_FORBIDDEN");
});

test("Perfect Fit browser adapter uses only the public commerce boundary", () => {
  const source = readFileSync(
    new URL("../../../apps/samara-web/my-vite-react-app/src/lib/eipApiAdapter.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /VITE_EIP_ENDPOINT/);
  assert.match(source, /VITE_EIP_API_KEY/);
  assert.match(source, /X-Member-Csrf/);
  assert.match(source, /credentials:\s*'include'/);
  assert.doesNotMatch(source, /\/api\/eip\//);
  assert.doesNotMatch(source, /auth\/csrf/);
});
