import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import adminDbExplorerRoutes, {
  sanitizeRow,
  verifyBreakGlassGrant,
  verifySensitiveGrant
} from "../src/routes/admin_db_explorer.js";

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

      if (text.includes("FROM eip_authz.identity_role ir") && text.includes("r.code IN ('ADMIN_EXEC','ADMIN_SUPER')")) {
        return { rowCount: 1, rows: [{ "?column?": 1 }] };
      }

      if (text.includes("FROM information_schema.tables")) {
        return {
          rowCount: 1,
          rows: [{ table_schema: "eip_core", table_name: "tenant" }]
        };
      }

      if (text.includes("FROM information_schema.columns")) {
        return {
          rowCount: 2,
          rows: [
            { table_schema: "eip_core", table_name: "tenant", column_name: "id", data_type: "uuid", is_nullable: "NO", ordinal_position: 1 },
            { table_schema: "eip_core", table_name: "tenant", column_name: "name", data_type: "text", is_nullable: "YES", ordinal_position: 2 }
          ]
        };
      }

      if (text.includes("INSERT INTO eip_core.security_event")) {
        return { rowCount: 1, rows: [{ id: "security-event" }] };
      }

      if (text.includes("UPDATE eip_auth.auth_session")) {
        return { rowCount: 1, rows: [] };
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

test("admin DB explorer allows configured hosted dashboard origin with cross-site fetch metadata", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: "/api/eip/admin/db/schema",
    headers: headers({
      origin: "https://dashboard.test",
      "sec-fetch-site": "cross-site"
    })
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
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

test("admin DB explorer masks expanded sensitive column names", () => {
  const row = {
    id: "row-1",
    credential_id: "credential",
    session_id: "session",
    recovery_code: "recovery",
    display_name: "Visible"
  };
  const sanitized = sanitizeRow(row, Object.keys(row));
  assert.equal(sanitized.credential_id, "***");
  assert.equal(sanitized.session_id, "***");
  assert.equal(sanitized.recovery_code, "***");
  assert.equal(sanitized.display_name, "Visible");
});

test("admin DB explorer sensitive access uses session grants instead of raw token cookies", () => {
  const app = { config: { API_KEY_PEPPER: "pepper" } };
  const tenantAccess = {
    sensitive_allowed: true,
    sensitive_token_hash: "abc123",
    sensitive_token_expires_at: new Date(Date.now() + 60_000).toISOString(),
    sensitive_token_revoked_at: null
  };
  const session = {
    id: "00000000-0000-4000-8000-000000000001",
    attrs: { admin_db_sensitive_grants: {} }
  };

  const missing = verifySensitiveGrant(app, session, tenantAccess, "tenant-a");
  assert.equal(missing.ok, false);
  assert.equal(missing.error, "SENSITIVE_GRANT_REQUIRED");

  const hash = "89e52a21d6f487d3ee184639ae5da6ab498a405a57ce1e8ae87d13734e2e28e2";
  session.attrs.admin_db_sensitive_grants["tenant-a"] = {
    hash,
    expires_at: new Date(Date.now() + 60_000).toISOString()
  };
  const valid = verifySensitiveGrant(app, session, tenantAccess, "tenant-a");
  assert.equal(valid.ok, true);
});

test("admin DB explorer issues audited short-lived break-glass grants after step-up", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const res = await app.inject({
    method: "POST",
    url: "/api/eip/admin/db/break-glass/issue",
    headers: headers(),
    payload: {
      reason: "Investigate synthetic support case",
      ticket: "CASE-123"
    }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  assert.equal(res.json().grant.ticket, "CASE-123");
  assert.match(res.json().grant_expires_at, /^\d{4}-/);
});

test("admin DB explorer break-glass grants expire and remain tenant scoped", () => {
  const session = {
    attrs: {
      admin_db_break_glass: {
        id: "grant-1",
        target_tenant_id: "tenant-a",
        expires_at: new Date(Date.now() + 60_000).toISOString()
      }
    }
  };

  assert.equal(verifyBreakGlassGrant(session, { targetTenantId: "tenant-a" }).ok, true);
  const wrongTenant = verifyBreakGlassGrant(session, { targetTenantId: "tenant-b" });
  assert.equal(wrongTenant.ok, false);
  assert.equal(wrongTenant.error, "BREAK_GLASS_SCOPE_MISMATCH");

  session.attrs.admin_db_break_glass.expires_at = new Date(Date.now() - 1000).toISOString();
  const expired = verifyBreakGlassGrant(session, { targetTenantId: "tenant-a" });
  assert.equal(expired.ok, false);
  assert.equal(expired.error, "BREAK_GLASS_EXPIRED");
});
