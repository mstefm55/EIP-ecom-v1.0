import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import adminDbExplorerRoutes from "../src/routes/admin_db_explorer.js";

const OWNER_TENANT = "00000000-0000-4000-8000-0000000000aa";
const IDENTITY_ID = "10000000-0000-4000-8000-0000000000aa";

function makeDb({ tenantCode = "owner", tenantKind = "owner_admin", permission = true } = {}) {
  return {
    async query(sql) {
      const text = String(sql);

      if (text.includes("FROM eip_auth.auth_identity i") && text.includes("JOIN eip_core.tenant t")) {
        return {
          rowCount: 1,
          rows: [{
            login: "owner@example.test",
            identity_attrs: {},
            tenant_id: OWNER_TENANT,
            tenant_code: tenantCode,
            tenant_name: "Owner",
            tenant_attrs: { tenant_kind: tenantKind },
            tenant_logo_url: null
          }]
        };
      }

      if (text.includes("FROM eip_authz.identity_role ir") && text.includes("rp.permission_code")) {
        return { rowCount: permission ? 1 : 0, rows: permission ? [{ "?column?": 1 }] : [] };
      }

      if (text.includes("INSERT INTO eip_core.security_event")) {
        return { rowCount: 1, rows: [{ id: "security-event" }] };
      }

      throw new Error(`Unexpected SQL in admin DB explorer security test: ${text}`);
    }
  };
}

async function buildApp({
  enabled = true,
  tenantCode = "owner",
  tenantKind = "owner_admin",
  stepUp = { ok: true }
} = {}) {
  const app = Fastify({ logger: false });
  app.decorate("EIP_ORIGINS", ["https://dashboard.test"]);
  app.decorate("config", {
    NODE_ENV: "production",
    CORS_ORIGIN: "https://dashboard.test",
    EIP_ORIGIN_REQUIRED: true,
    ENABLE_ADMIN_DB_EXPLORER: enabled,
    OWNER_TENANT_CODE: "owner",
    API_KEY_PEPPER: "pepper"
  });
  app.decorate("db", makeDb({ tenantCode, tenantKind }));
  app.decorate("requireSession", async () => ({
    ok: true,
    session: {
      id: "session",
      tenant_id: OWNER_TENANT,
      identity_id: IDENTITY_ID,
      realm: "EIP",
      attrs: { realm: "EIP" }
    }
  }));
  app.decorate("requireCsrf", async () => ({ ok: true }));
  app.decorate("requireStepUp", async () => stepUp);
  await app.register(adminDbExplorerRoutes, { prefix: "/api/eip" });
  await app.ready();
  return app;
}

function headers(overrides = {}) {
  return {
    origin: "https://dashboard.test",
    "sec-fetch-site": "same-site",
    "sec-fetch-mode": "cors",
    ...overrides
  };
}

test("admin DB explorer is disabled by default in production", async (t) => {
  const app = await buildApp({ enabled: false });
  t.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: "/api/eip/admin/db/schema",
    headers: headers()
  });
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().error, "DB_EXPLORER_DISABLED");
});

test("admin DB explorer rejects cross-site browser-triggered reads", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: "/api/eip/admin/db/schema",
    headers: headers({
      origin: "https://evil.test",
      "sec-fetch-site": "cross-site"
    })
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, "ORIGIN_NOT_ALLOWED");
});

test("admin DB explorer requires owner/admin session classification", async (t) => {
  const app = await buildApp({ tenantCode: "tenant_a", tenantKind: "customer" });
  t.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: "/api/eip/admin/db/schema",
    headers: headers()
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, "OWNER_ADMIN_REQUIRED");
});

test("admin DB explorer requires recent step-up for table reads and exports", async (t) => {
  const app = await buildApp({
    stepUp: { ok: false, status: 403, error: "STEP_UP_REQUIRED" }
  });
  t.after(() => app.close());

  const table = await app.inject({
    method: "GET",
    url: "/api/eip/admin/db/table?schema=eip_core&table=tenant",
    headers: headers()
  });
  assert.equal(table.statusCode, 403);
  assert.equal(table.json().error, "STEP_UP_REQUIRED");

  const exported = await app.inject({
    method: "GET",
    url: "/api/eip/admin/db/export?schema=eip_core&table=tenant&format=json",
    headers: headers()
  });
  assert.equal(exported.statusCode, 403);
  assert.equal(exported.json().error, "STEP_UP_REQUIRED");
});
