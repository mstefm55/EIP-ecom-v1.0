import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import Fastify from "fastify";
import gatewayRoutes from "../src/routes/gateway.js";

const TENANT_ID = "00000000-0000-4000-8000-0000000000b1";
const IDENTITY_ID = "10000000-0000-4000-8000-0000000000b1";

function secretBearingTenant() {
  return {
    id: TENANT_ID,
    code: "secret-audit",
    name: "Secret audit",
    is_active: true,
    attrs: {
      internal_secret: "tenant-attrs-secret",
      connection_profiles: [
        {
          id: "paypal",
          identity: { connection_code: "paypal", connection_kind: "paypal", direction: "outbound", environment: "sandbox", is_enabled: true },
          outbound: { auth_mode: "oauth2_client_credentials", auth: { client_id: "client-id", client_secret: "paypal-client-secret" } },
          verification: { hmac_signature: { secret: "paypal-webhook-secret" } },
          routing: { channel: "payments", provider_code: "paypal" }
        },
        {
          id: "checkout",
          identity: { connection_code: "checkout", connection_kind: "checkout_com", direction: "outbound", environment: "sandbox", is_enabled: true },
          outbound: { auth_mode: "api_key_header", auth: { secret: "checkout-secret-key" } },
          routing: { channel: "payments", provider_code: "checkout_com" }
        },
        {
          id: "website",
          identity: { connection_code: "website", connection_kind: "website", direction: "inbound", environment: "sandbox", is_enabled: true },
          inbound: { inbound_path_suffix: "website" },
          verification: { mode: "api_key", api_key: { header_name: "X-API-Key", secret: "inbound-profile-key" } },
          routing: { channel: "website_intake" }
        }
      ]
    }
  };
}

function buildDb() {
  const tenant = secretBearingTenant();
  return {
    async query(sql) {
      const text = String(sql).replace(/\s+/g, " ");
      if (text.includes("FROM eip_authz.identity_role") || text.includes("FROM eip_authz.identity_permission")) {
        return { rowCount: 1, rows: [{ "?column?": 1 }] };
      }
      if (text.includes("SELECT id, code, name, is_active, attrs") && text.includes("FROM eip_core.tenant")) {
        return { rowCount: 1, rows: [tenant] };
      }
      if (text.includes("FROM eip_auth.auth_api_key")) {
        return {
          rowCount: 1,
          rows: [{
            id: "20000000-0000-4000-8000-0000000000b1",
            label: "public",
            is_active: true,
            expires_at: null,
            created_at: "2026-07-02T00:00:00.000Z",
            attrs: { status: "active", fingerprint: "abcdef123456", secret: "legacy-api-key-attrs-secret" }
          }]
        };
      }
      if (text.includes("record_type = 'gateway_handshake'") && text.includes("LIMIT 50")) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes("count(*) FILTER") && text.includes("gateway_handshake")) {
        return { rowCount: 1, rows: [{ last_24h: 0, last_7d: 0, last_seen: null }] };
      }
      if (text.includes("object_type = 'storefront_structure'")) {
        return { rowCount: 0, rows: [] };
      }
      throw new Error(`Unexpected SQL in gateway secret governance test: ${text}`);
    }
  };
}

async function buildApp() {
  const app = Fastify({ logger: false });
  app.decorate("config", {
    OWNER_TENANT_CODE: "owner",
    REQUIRE_PASSKEY_FOR_PRIVILEGED_ACTIONS: false,
    PORT: 3000
  });
  app.decorate("db", buildDb());
  app.decorate("requireSession", async () => ({
    ok: true,
    session: { tenant_id: TENANT_ID, identity_id: IDENTITY_ID, realm: "EIP", attrs: { realm: "EIP" } }
  }));
  app.decorate("requireCsrf", async () => ({ ok: true }));
  app.decorate("requireStepUp", async () => ({ ok: true }));
  await app.register(gatewayRoutes, { prefix: "/api/eip" });
  await app.ready();
  return app;
}

test("gateway connection detail returns status-only secrets and omits tenant attrs", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());
  const response = await app.inject({
    method: "GET",
    url: `/api/eip/gateway/connections/${TENANT_ID}`
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  const serialized = JSON.stringify(body);
  assert.equal(body.tenant.attrs, undefined);
  assert.doesNotMatch(serialized, /tenant-attrs-secret|paypal-client-secret|paypal-webhook-secret|checkout-secret-key|inbound-profile-key|legacy-api-key-attrs-secret/);
  assert.doesNotMatch(serialized, /secret_ref|secret_hash|key_hash|ciphertext/);

  const paypal = body.connections.find((profile) => profile.identity.connection_code === "paypal");
  const checkout = body.connections.find((profile) => profile.identity.connection_code === "checkout");
  const website = body.connections.find((profile) => profile.identity.connection_code === "website");
  assert.equal(paypal.outbound.auth.client_secret, undefined);
  assert.equal(paypal.outbound.auth.client_secret_set, true);
  assert.equal(paypal.verification.hmac_signature.secret_set, true);
  assert.equal(checkout.outbound.auth.secret, undefined);
  assert.equal(checkout.outbound.auth.secret_set, true);
  assert.equal(website.verification.api_key.secret, undefined);
  assert.equal(website.verification.api_key.secret_set, true);
  assert.deepEqual(Object.keys(body.api_keys[0].attrs).sort(), ["fingerprint", "last_rotated_at", "status"]);
});

test("runtime and migration sources do not fall back to raw provider secrets in API-key attrs", () => {
  const tenantResolveSource = fs.readFileSync(new URL("../src/services/gateway/tenantResolve.js", import.meta.url), "utf8");
  const migrationSource = fs.readFileSync(new URL("../scripts/migrate_connection_secrets.mjs", import.meta.url), "utf8");
  const gatewaySource = fs.readFileSync(new URL("../src/routes/gateway.js", import.meta.url), "utf8");
  const serverSource = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const adminConnectionsSource = fs.readFileSync(
    new URL("../../../apps/dashboard/src/components/admin/AdminConnectionsPanelSafe.jsx", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(tenantResolveSource, /attrs\.(?:hmac_secret|secret|secret_enc)/);
  assert.match(migrationSource, /attrs - 'hmac_secret' - 'secret' - 'secret_enc'/);
  assert.match(migrationSource, /migrateLegacyConnectionApiKeyHash/);
  assert.match(gatewaySource, /Cache-Control", "no-store/);
  assert.match(gatewaySource, /tenant:\s*\{[\s\S]*?id: tenant\.id/);
  assert.match(serverSource, /req\.headers\.authorization/);
  assert.match(serverSource, /redactSecretText\(request\.url\)/);
  assert.match(adminConnectionsSource, /Empty fields never clear secrets/);
  assert.match(adminConnectionsSource, /secrets\/revoke/);
  assert.match(adminConnectionsSource, /Clear secret/);
});
