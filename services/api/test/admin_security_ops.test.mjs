import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import adminMonitoringRoutes from "../src/routes/admin_monitoring.js";

const TENANT_ID = "00000000-0000-4000-8000-0000000000a1";
const IDENTITY_ID = "10000000-0000-4000-8000-0000000000a1";

function buildDb() {
  const calls = [];
  const recentEvents = Array.from({ length: 5 }, (_, idx) => ({
    id: `evt-${idx + 1}`,
    occurred_at: new Date(Date.now() - idx * 60_000).toISOString(),
    event_type: "gateway.verification_failed",
    category: "gateway",
    severity: "warning",
    outcome: "rejected",
    reason: "BAD_SIGNATURE",
    tenant_id: TENANT_ID,
    tenant_code: "tenant_a",
    actor_tenant_id: null,
    actor_identity_id: null,
    target_tenant_id: null,
    target_identity_id: null,
    connection_code: "tenant-a-store",
    suffix: "tenant-a-store",
    event_id: `external-${idx + 1}`,
    ip: "203.0.113.10",
    source: "public_gateway",
    metadata: { redacted: true }
  }));

  return {
    calls,
    async query(sql, params = []) {
      const text = String(sql);
      calls.push({ sql: text, params });

      if (text.includes("FROM eip_authz.identity_role") || text.includes("FROM eip_authz.identity_permission")) {
        return { rowCount: 1, rows: [{ "?column?": 1 }] };
      }

      if (text.includes("SELECT to_regclass('eip_core.security_event')")) {
        return { rowCount: 1, rows: [{ name: "eip_core.security_event" }] };
      }

      if (text.includes("FROM eip_auth.auth_identity i") && text.includes("JOIN eip_core.tenant t")) {
        return {
          rowCount: 1,
          rows: [{
            login: "tenant-admin@example.test",
            identity_attrs: {},
            tenant_id: TENANT_ID,
            tenant_code: "tenant_a",
            tenant_name: "Tenant A",
            tenant_attrs: {},
            tenant_logo_url: null
          }]
        };
      }

      if (text.includes("AS total_events") && text.includes("FROM eip_core.security_event se")) {
        return {
          rowCount: 1,
          rows: [{
            total_events: 6,
            total_failures: 6,
            high_severity: 0,
            auth_failures: 0,
            gateway_failures: 6,
            upload_rejections: 0,
            secret_changes: 0,
            last_event_at: recentEvents[0].occurred_at
          }]
        };
      }

      if (text.includes("GROUP BY se.event_type, se.category, se.reason, se.severity")) {
        return { rowCount: 0, rows: [] };
      }

      if (text.includes("GROUP BY se.tenant_id, t.code, t.name, se.connection_code, se.suffix")) {
        return { rowCount: 0, rows: [] };
      }

      if (text.includes("GROUP BY se.event_type") && text.includes("ORDER BY count DESC, se.event_type")) {
        return {
          rowCount: 1,
          rows: [{ event_type: "gateway.verification_failed", count: recentEvents.length }]
        };
      }

      if (text.includes("GROUP BY se.tenant_id, t.code, t.name") && text.includes("ORDER BY count DESC, t.code")) {
        return {
          rowCount: 1,
          rows: [{
            tenant_id: TENANT_ID,
            tenant_code: "tenant_a",
            tenant_name: "Tenant A",
            count: recentEvents.length
          }]
        };
      }

      if (text.includes("SELECT count(*)::int AS total") && text.includes("FROM eip_core.security_event se")) {
        return { rowCount: 1, rows: [{ total: recentEvents.length }] };
      }

      if (text.includes("SELECT") && text.includes("se.id") && text.includes("ORDER BY se.occurred_at DESC")) {
        const limit = Number(params[params.length - 2]);
        const offset = Number(params[params.length - 1]);
        const rows = recentEvents.slice(offset, offset + limit);
        return { rowCount: rows.length, rows };
      }

      throw new Error(`Unexpected SQL in admin security ops test: ${text}`);
    }
  };
}

async function buildApp(db, config = {}) {
  const app = Fastify({ logger: false });
  app.decorate("EIP_ORIGINS", ["https://dashboard.test"]);
  app.decorate("config", {
    OWNER_TENANT_CODE: "owner",
    NODE_ENV: config.NODE_ENV || "test",
    CORS_ORIGIN: "https://dashboard.test",
    EIP_ORIGIN_REQUIRED: config.EIP_ORIGIN_REQUIRED === true
  });
  app.decorate("db", db);
  app.decorate("requireSession", async () => ({
    ok: true,
    session: {
      id: "session-a",
      tenant_id: TENANT_ID,
      identity_id: IDENTITY_ID,
      attrs: { realm: "EIP" },
      realm: "EIP"
    }
  }));
  await app.register(adminMonitoringRoutes, { prefix: "/api/eip" });
  await app.ready();
  return app;
}

test("admin security ops paginates and filters recent events server-side", async (t) => {
  const db = buildDb();
  const app = await buildApp(db);
  t.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: "/api/eip/admin/security/ops?window=24h&page=2&page_size=2&event_type=gateway.verification_failed&tenant=tenant_a&outcome=rejected&severity=warning"
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.ok, true);
  assert.equal(body.summary.total_events, 6);
  assert.deepEqual(body.recent_events.map((event) => event.id), ["evt-3", "evt-4"]);
  assert.deepEqual(body.recent_events_pagination, {
    page: 2,
    page_size: 2,
    total: 5,
    total_pages: 3
  });
  assert.deepEqual(body.recent_event_filters, {
    event_type: "gateway.verification_failed",
    tenant: "tenant_a",
    outcome: "rejected",
    severity: "warning"
  });
  assert.deepEqual(body.recent_event_filter_options, {
    event_types: [{
      value: "gateway.verification_failed",
      label: "gateway.verification_failed",
      count: 5
    }],
    tenants: [{
      value: TENANT_ID,
      label: "tenant_a",
      code: "tenant_a",
      name: "Tenant A",
      count: 5
    }]
  });

  const recentSql = db.calls.find((call) => call.sql.includes("ORDER BY se.occurred_at DESC"));
  assert.ok(recentSql.sql.includes("se.event_type = $3"));
  assert.ok(recentSql.sql.includes("t.code ILIKE $5"));
  assert.ok(recentSql.sql.includes("se.outcome = $6"));
  assert.ok(recentSql.sql.includes("se.severity = $7"));
  assert.ok(recentSql.sql.includes("LIMIT $8"));
  assert.ok(recentSql.sql.includes("OFFSET $9"));
});

test("admin security ops rejects cross-site browser-triggered reads in production", async (t) => {
  const db = buildDb();
  const app = await buildApp(db, { NODE_ENV: "production" });
  t.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: "/api/eip/admin/security/ops?window=24h",
    headers: {
      origin: "https://evil.test",
      "sec-fetch-site": "cross-site",
      "sec-fetch-mode": "cors"
    }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, "ORIGIN_NOT_ALLOWED");
});

test("admin security ops allows configured hosted dashboard origin even when fetch metadata is cross-site", async (t) => {
  const db = buildDb();
  const app = await buildApp(db, { NODE_ENV: "production" });
  t.after(() => app.close());

  const res = await app.inject({
    method: "GET",
    url: "/api/eip/admin/security/ops?window=24h&page_size=2",
    headers: {
      origin: "https://dashboard.test",
      "sec-fetch-site": "cross-site",
      "sec-fetch-mode": "cors"
    }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
});
