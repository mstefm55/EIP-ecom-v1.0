import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import gatewayRoutes from "../src/routes/gateway.js";
import { sha256Hex } from "../src/auth/crypto.js";

const TENANT_ID = "00000000-0000-4000-8000-0000000000a1";
const IDENTITY_ID = "10000000-0000-4000-8000-0000000000a1";

function buildDb() {
  const keys = [];
  const securityEvents = [];
  const calls = [];

  return {
    calls,
    keys,
    securityEvents,
    async query(sql, params = []) {
      const text = String(sql);
      calls.push({ sql: text, params });

      if (text.includes("FROM eip_authz.identity_role") || text.includes("FROM eip_authz.identity_permission")) {
        return { rowCount: 1, rows: [{ "?column?": 1 }] };
      }

      if (text.includes("INSERT INTO eip_auth.auth_api_key")) {
        const id = `00000000-0000-4000-8000-00000000000${keys.length + 1}`;
        const [tenantId, keyHash, label, expiresAt] = params;
        const row = {
          id,
          tenant_id: tenantId,
          key_hash: keyHash,
          label,
          is_active: true,
          expires_at: expiresAt,
          created_at: "2026-05-24T12:00:00.000Z",
          attrs: {}
        };
        keys.push(row);
        return {
          rowCount: 1,
          rows: [{
            id: row.id,
            label: row.label,
            is_active: row.is_active,
            expires_at: row.expires_at,
            created_at: row.created_at
          }]
        };
      }

      if (text.includes("UPDATE eip_auth.auth_api_key")) {
        const [, keyId] = params;
        const key = keys.find((item) => item.id === keyId);
        if (key) {
          key.is_active = false;
          key.expires_at = new Date().toISOString();
          key.attrs.status = text.includes("superseded") ? "superseded" : "revoked";
        }
        return { rowCount: key ? 1 : 0, rows: [] };
      }

      if (text.includes("UPDATE eip_core.tenant")) {
        return { rowCount: 1, rows: [] };
      }

      if (text.includes("INSERT INTO eip_core.security_event")) {
        securityEvents.push({ sql: text, params });
        return { rowCount: 1, rows: [{ id: `event-${securityEvents.length}` }] };
      }

      throw new Error(`Unexpected SQL in gateway API key test: ${text}`);
    }
  };
}

async function buildApp(db, logs = []) {
  const app = Fastify({ logger: false });
  app.decorate("config", {
    API_KEY_PEPPER: "pepper",
    OWNER_TENANT_CODE: "owner",
    REQUIRE_PASSKEY_FOR_PRIVILEGED_ACTIONS: false,
    PORT: 3000
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
  app.decorate("requireCsrf", async () => ({ ok: true }));
  app.decorate("requireStepUp", async () => ({ ok: true }));
  app.log.info = (payload) => logs.push({ level: "info", payload });
  app.log.warn = (payload) => logs.push({ level: "warn", payload });
  await app.register(gatewayRoutes, { prefix: "/api/eip" });
  await app.ready();
  return app;
}

test("gateway connection API keys can be created, rotated, and revoked without logging raw keys", async (t) => {
  const db = buildDb();
  const logs = [];
  const app = await buildApp(db, logs);
  t.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: `/api/eip/gateway/connections/${TENANT_ID}/api-keys`,
    headers: { "content-type": "application/json" },
    payload: JSON.stringify({ label: "plug-play", set_primary: true })
  });
  assert.equal(created.statusCode, 200);
  const createdBody = created.json();
  assert.equal(createdBody.ok, true);
  assert.equal(typeof createdBody.raw_key, "string");
  assert.ok(createdBody.raw_key.length >= 32);
  assert.equal(createdBody.api_key.key_hash, undefined);
  assert.equal(db.keys[0].key_hash, sha256Hex(`${createdBody.raw_key}:pepper`));
  assert.notEqual(db.keys[0].key_hash, createdBody.raw_key);

  const rotated = await app.inject({
    method: "POST",
    url: `/api/eip/gateway/connections/${TENANT_ID}/api-keys/${createdBody.api_key.id}/rotate`,
    headers: { "content-type": "application/json" },
    payload: JSON.stringify({ label: "plug-play-rotated" })
  });
  assert.equal(rotated.statusCode, 200);
  const rotatedBody = rotated.json();
  assert.equal(rotatedBody.ok, true);
  assert.equal(typeof rotatedBody.raw_key, "string");
  assert.notEqual(rotatedBody.raw_key, createdBody.raw_key);
  assert.equal(db.keys[0].is_active, false);
  assert.equal(db.keys[0].attrs.status, "superseded");
  assert.equal(db.keys[1].key_hash, sha256Hex(`${rotatedBody.raw_key}:pepper`));
  assert.equal(rotatedBody.api_key.key_hash, undefined);

  const revoked = await app.inject({
    method: "POST",
    url: `/api/eip/gateway/connections/${TENANT_ID}/api-keys/${rotatedBody.api_key.id}/revoke`
  });
  assert.equal(revoked.statusCode, 200);
  assert.deepEqual(revoked.json(), { ok: true });
  assert.equal(db.keys[1].is_active, false);
  assert.equal(db.keys[1].attrs.status, "revoked");

  const persistedEvents = JSON.stringify(db.securityEvents);
  const logEvents = JSON.stringify(logs);
  assert.equal(persistedEvents.includes(createdBody.raw_key), false);
  assert.equal(persistedEvents.includes(rotatedBody.raw_key), false);
  assert.equal(logEvents.includes(createdBody.raw_key), false);
  assert.equal(logEvents.includes(rotatedBody.raw_key), false);
  assert.equal(persistedEvents.includes(db.keys[0].key_hash), false);
  assert.equal(persistedEvents.includes(db.keys[1].key_hash), false);
});
