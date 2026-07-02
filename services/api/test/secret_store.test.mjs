import assert from "node:assert/strict";
import test from "node:test";
import {
  clearProfileSecretRefs,
  encryptSecret,
  hydrateConnectionProfileSecrets,
  migrateLegacyConnectionApiKeyHash,
  revokeConnectionSecrets,
  vaultConnectionProfileSecrets
} from "../src/services/gateway/secretStore.js";
import { maskSecrets, mergeSecrets, validateProfiles } from "../src/services/gateway/connectionProfile.js";
import { verifyConnectionRequest } from "../src/services/gateway/verification.js";
import { redactSecrets, redactSecretText } from "../src/lib/redaction.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const ACTOR_ID = "00000000-0000-4000-8000-000000000002";
const SECRET_SOURCE = {
  config: {
    SECRET_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
    SECRET_ENCRYPTION_KEY_ID: "test-key",
    API_KEY_PEPPER: "test-api-key-pepper"
  }
};

function buildProfile(overrides = {}) {
  return {
    id: "conn-1",
    identity: {
      connection_code: "storefront",
      direction: "both"
    },
    verification: {
      mode: "api_key",
      api_key: {
        header_name: "X-API-Key",
        secret: "api-key-v1"
      }
    },
    outbound: {
      auth_mode: "bearer_token",
      auth: {
        token: "bearer-v1"
      }
    },
    ...overrides
  };
}

class SecretStoreDb {
  rows = [];
  nextId = 1;

  async query(sql, params = []) {
    const text = String(sql).replace(/\s+/g, " ");

    if (text.includes("SELECT * FROM eip_core.connection_secret") && text.includes("secret_kind = $3")) {
      const [tenantId, connectionCode, kind] = params;
      const rows = this.rows
        .filter((row) =>
          row.tenant_id === tenantId &&
          row.connection_code === connectionCode &&
          row.secret_kind === kind &&
          row.status === "active"
        )
        .sort((a, b) => b.version - a.version);
      return { rowCount: rows.length ? 1 : 0, rows: rows.slice(0, 1) };
    }

    if (text.includes("SELECT COALESCE(max(version), 0)::int + 1 AS next_version")) {
      const [tenantId, connectionCode, kind] = params;
      const maxVersion = this.rows
        .filter((row) =>
          row.tenant_id === tenantId &&
          row.connection_code === connectionCode &&
          row.secret_kind === kind
        )
        .reduce((max, row) => Math.max(max, row.version), 0);
      return { rowCount: 1, rows: [{ next_version: maxVersion + 1 }] };
    }

    if (text.includes("UPDATE eip_core.connection_secret") && text.includes("status = 'superseded'")) {
      const [id] = params;
      const row = this.rows.find((item) => item.id === id);
      if (row) {
        row.status = "superseded";
        row.updated_at = new Date().toISOString();
      }
      return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
    }

    if (text.includes("INSERT INTO eip_core.connection_secret")) {
      const [
        tenantId,
        connectionCode,
        kind,
        version,
        algorithm,
        keyId,
        iv,
        tag,
        ciphertext,
        aad,
        fingerprint,
        rotatedFrom,
        actorIdentityId,
        attrsJson
      ] = params;
      const now = new Date().toISOString();
      const row = {
        id: `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, "0")}`,
        tenant_id: tenantId,
        connection_code: connectionCode,
        secret_kind: kind,
        version,
        status: "active",
        algorithm,
        key_id: keyId,
        iv,
        tag,
        ciphertext,
        aad,
        fingerprint,
        rotated_from: rotatedFrom,
        rotated_by: actorIdentityId,
        revoked_at: null,
        revoked_by: null,
        attrs: JSON.parse(attrsJson || "{}"),
        rotated_at: now,
        created_at: now,
        updated_at: now
      };
      this.rows.push(row);
      return { rowCount: 1, rows: [row] };
    }

    if (text.includes("SELECT * FROM eip_core.connection_secret") && text.includes("AND status = 'active'")) {
      const [tenantId, connectionCode] = params;
      const rows = this.rows.filter((row) =>
        row.tenant_id === tenantId &&
        row.connection_code === connectionCode &&
        row.status === "active"
      );
      return { rowCount: rows.length, rows };
    }

    if (text.includes("UPDATE eip_core.connection_secret") && text.includes("status = 'revoked'")) {
      const [tenantId, connectionCode, kinds, actorIdentityId] = params;
      const now = new Date().toISOString();
      const rows = this.rows.filter((row) =>
        row.tenant_id === tenantId &&
        row.connection_code === connectionCode &&
        kinds.includes(row.secret_kind) &&
        row.status === "active"
      );
      for (const row of rows) {
        row.status = "revoked";
        row.revoked_at = now;
        row.revoked_by = actorIdentityId;
        row.updated_at = now;
      }
      return { rowCount: rows.length, rows };
    }

    throw new Error(`Unexpected SQL in secret store test: ${text}`);
  }
}

test("connection profile secrets are encrypted, masked, and hydrated for runtime use", async () => {
  const db = new SecretStoreDb();
  const [vaulted] = await vaultConnectionProfileSecrets(
    SECRET_SOURCE,
    db,
    TENANT_ID,
    [buildProfile()],
    ACTOR_ID
  );

  assert.equal(vaulted.verification.api_key.secret, undefined);
  assert.equal(vaulted.verification.api_key.secret_set, true);
  assert.equal(vaulted.outbound.auth.token, undefined);
  assert.equal(vaulted.outbound.auth.token_set, true);
  assert.equal(db.rows.length, 2);
  assert.equal(JSON.stringify(db.rows).includes("api-key-v1"), false);
  assert.equal(JSON.stringify(vaulted).includes("bearer-v1"), false);
  const inboundKeyRow = db.rows.find((row) => row.secret_kind === "verification.api_key.secret");
  assert.equal(inboundKeyRow.algorithm, "sha256-peppered");
  assert.equal(inboundKeyRow.iv, "");
  assert.equal(inboundKeyRow.tag, "");
  assert.match(inboundKeyRow.ciphertext, /^[a-f0-9]{64}$/);

  const masked = maskSecrets(vaulted);
  assert.equal(masked.verification.api_key.secret_ref, undefined);
  assert.equal(masked.verification.api_key.secret_set, true);

  const hydrated = await hydrateConnectionProfileSecrets(SECRET_SOURCE, db, TENANT_ID, vaulted);
  assert.equal(hydrated.verification.api_key.secret, undefined);
  assert.equal(hydrated.verification.api_key.secret_hash, inboundKeyRow.ciphertext);
  assert.equal(hydrated.verification.api_key.secret_hash_algorithm, "sha256-peppered");
  assert.equal(hydrated.outbound.auth.token, "bearer-v1");
});

test("connection profile secret rotation versions new values and supersedes old active rows", async () => {
  const db = new SecretStoreDb();
  const [vaulted] = await vaultConnectionProfileSecrets(
    SECRET_SOURCE,
    db,
    TENANT_ID,
    [buildProfile()],
    ACTOR_ID
  );

  const next = structuredClone(vaulted);
  next.verification.api_key.secret = "api-key-v2";
  const [rotated] = await vaultConnectionProfileSecrets(SECRET_SOURCE, db, TENANT_ID, [next], ACTOR_ID);

  assert.equal(rotated.verification.api_key.secret_version, 2);
  assert.equal(rotated.verification.api_key.secret_set, true);
  assert.equal(
    db.rows.find((row) => row.secret_kind === "verification.api_key.secret" && row.version === 1).status,
    "superseded"
  );
  assert.equal(
    db.rows.find((row) => row.secret_kind === "verification.api_key.secret" && row.version === 2).status,
    "active"
  );

  const hydrated = await hydrateConnectionProfileSecrets(SECRET_SOURCE, db, TENANT_ID, rotated);
  assert.equal(hydrated.verification.api_key.secret, undefined);
  assert.equal(
    hydrated.verification.api_key.secret_hash,
    db.rows.find((row) => row.secret_kind === "verification.api_key.secret" && row.version === 2).ciphertext
  );
});

test("connection profile secret revocation disables runtime hydration and clears profile refs", async () => {
  const db = new SecretStoreDb();
  const [vaulted] = await vaultConnectionProfileSecrets(
    SECRET_SOURCE,
    db,
    TENANT_ID,
    [buildProfile()],
    ACTOR_ID
  );

  const revoked = await revokeConnectionSecrets(db, {
    tenantId: TENANT_ID,
    connectionCode: "storefront",
    kinds: ["verification.api_key.secret"],
    actorIdentityId: ACTOR_ID
  });
  const [cleared] = clearProfileSecretRefs([vaulted], "storefront", ["verification.api_key.secret"]);

  assert.equal(revoked.length, 1);
  assert.equal(revoked[0].status, "revoked");
  assert.equal(cleared.verification.api_key.secret_set, false);
  assert.equal(cleared.verification.api_key.secret_status, "revoked");

  const hydrated = await hydrateConnectionProfileSecrets(SECRET_SOURCE, db, TENANT_ID, cleared);
  assert.equal(hydrated.verification.api_key.secret, undefined);
  assert.equal(hydrated.outbound.auth.token, "bearer-v1");
});

test("empty secret updates preserve existing vaulted values and only new values rotate", async () => {
  const db = new SecretStoreDb();
  const [vaulted] = await vaultConnectionProfileSecrets(
    SECRET_SOURCE,
    db,
    TENANT_ID,
    [buildProfile()],
    ACTOR_ID
  );
  const incoming = maskSecrets(vaulted);
  incoming.verification.api_key.secret = "";
  incoming.outbound.auth.token = "";
  const merged = mergeSecrets(vaulted, incoming);
  const [preserved] = await vaultConnectionProfileSecrets(SECRET_SOURCE, db, TENANT_ID, [merged], ACTOR_ID);

  assert.equal(db.rows.length, 2);
  assert.equal(preserved.verification.api_key.secret_version, 1);
  assert.equal(preserved.outbound.auth.token_version, 1);
  const hydrated = await hydrateConnectionProfileSecrets(SECRET_SOURCE, db, TENANT_ID, preserved);
  assert.equal(hydrated.outbound.auth.token, "bearer-v1");
});

test("all governed connection credentials are absent from stored profile JSON and API display", async () => {
  const db = new SecretStoreDb();
  const rawValues = [
    "inbound-api-key",
    "webhook-signing-secret",
    "jwt-shared-secret",
    "outbound-secret-key",
    "outbound-bearer-token",
    "basic-auth-password",
    "oauth-client-secret"
  ];
  const profile = buildProfile({
    verification: {
      mode: "api_key",
      api_key: { header_name: "X-API-Key", secret: rawValues[0] },
      hmac_signature: { secret: rawValues[1] },
      oauth2_jwt: { secret: rawValues[2] }
    },
    outbound: {
      auth_mode: "oauth2_client_credentials",
      auth: {
        secret: rawValues[3],
        token: rawValues[4],
        password: rawValues[5],
        client_secret: rawValues[6]
      }
    }
  });
  const [vaulted] = await vaultConnectionProfileSecrets(SECRET_SOURCE, db, TENANT_ID, [profile], ACTOR_ID);
  const masked = maskSecrets(vaulted);
  const storedJson = JSON.stringify(vaulted);
  const responseJson = JSON.stringify(masked);

  for (const raw of rawValues) {
    assert.doesNotMatch(storedJson, new RegExp(raw));
    assert.doesNotMatch(responseJson, new RegExp(raw));
  }
  assert.equal(db.rows.length, 7);
  assert.equal(db.rows.find((row) => row.secret_kind === "verification.api_key.secret").algorithm, "sha256-peppered");
  assert.equal(db.rows.filter((row) => row.secret_kind !== "verification.api_key.secret").every((row) => row.algorithm === "aes-256-gcm"), true);
  assert.doesNotMatch(responseJson, /secret_ref|secret_hash|ciphertext|client_secret_version/);
  assert.equal(masked.verification.api_key.secret_set, true);
  assert.equal(masked.verification.hmac_signature.secret_set, true);
  assert.equal(masked.outbound.auth.client_secret_set, true);
});

test("hash-only inbound connection API keys verify without runtime plaintext hydration", async () => {
  const db = new SecretStoreDb();
  const [vaulted] = await vaultConnectionProfileSecrets(SECRET_SOURCE, db, TENANT_ID, [buildProfile()], ACTOR_ID);
  const hydrated = await hydrateConnectionProfileSecrets(SECRET_SOURCE, db, TENANT_ID, vaulted);
  const request = { headers: { "x-api-key": "api-key-v1" } };
  const invalidRequest = { headers: { "x-api-key": "wrong-key" } };

  assert.equal(hydrated.verification.api_key.secret, undefined);
  assert.deepEqual(
    await verifyConnectionRequest(request, hydrated, Buffer.alloc(0), { secretSource: SECRET_SOURCE }),
    { ok: true }
  );
  assert.equal(
    (await verifyConnectionRequest(invalidRequest, hydrated, Buffer.alloc(0), { secretSource: SECRET_SOURCE })).error,
    "INVALID_API_KEY"
  );
});

test("legacy encrypted inbound API keys migrate to hash-only rows without external rotation", async () => {
  const db = new SecretStoreDb();
  const kind = "verification.api_key.secret";
  const aad = `${TENANT_ID}:storefront:${kind}:v1`;
  const encrypted = encryptSecret(SECRET_SOURCE, "legacy-inbound-key", aad);
  db.rows.push({
    id: "30000000-0000-4000-8000-000000000001",
    tenant_id: TENANT_ID,
    connection_code: "storefront",
    secret_kind: kind,
    version: 1,
    status: "active",
    ...encrypted,
    fingerprint: "legacy-fingerprint",
    attrs: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
  });

  const migrated = await migrateLegacyConnectionApiKeyHash(
    SECRET_SOURCE,
    db,
    TENANT_ID,
    "storefront",
    ACTOR_ID
  );
  assert.equal(migrated.algorithm, "sha256-peppered");
  assert.equal(migrated.version, 2);
  assert.equal(db.rows[0].status, "superseded");
  assert.doesNotMatch(JSON.stringify(db.rows), /legacy-inbound-key/);

  const hydrated = await hydrateConnectionProfileSecrets(SECRET_SOURCE, db, TENANT_ID, buildProfile({
    verification: { mode: "api_key", api_key: { header_name: "X-API-Key", secret_set: true } }
  }));
  assert.equal(hydrated.verification.api_key.secret, undefined);
  assert.equal(hydrated.verification.api_key.secret_hash, migrated.ciphertext);
});

test("recursive redaction covers credentials in objects, logs, and serialized provider responses", () => {
  const payload = {
    clientSecret: "paypal-secret",
    nested: {
      apiKey: "checkout-key",
      password: "basic-password",
      signature: "webhook-signature",
      token_url: "https://provider.example/token",
      secret_set: true
    }
  };
  const redacted = redactSecrets(payload);
  assert.equal(redacted.clientSecret, "[REDACTED]");
  assert.equal(redacted.nested.apiKey, "[REDACTED]");
  assert.equal(redacted.nested.password, "[REDACTED]");
  assert.equal(redacted.nested.signature, "[REDACTED]");
  assert.equal(redacted.nested.token_url, "https://provider.example/token");
  assert.equal(redacted.nested.secret_set, true);
  assert.equal(redactSecretText("Authorization: Bearer abc.def.ghi"), "Authorization: Bearer [REDACTED]");
  assert.doesNotMatch(redactSecretText(JSON.stringify(payload)), /paypal-secret|checkout-key|basic-password|webhook-signature/);
});

test("connection validation rejects credentials hidden in unmanaged metadata fields", () => {
  const profile = buildProfile({
    identity: {
      connection_name: "Storefront",
      connection_code: "storefront",
      connection_kind: "website",
      direction: "both",
      environment: "sandbox",
      is_enabled: true,
      frontend_url: "https://store.example"
    },
    inbound: {
      inbound_path_suffix: "storefront",
      http_method: "POST",
      expected_content_type: "application/json",
      origin_allowlist: ["https://store.example"]
    },
    idempotency: { event_id_location: "header", event_id_key: "X-Event-Id" },
    outbound: {
      base_url: "https://provider.example",
      path_prefix: "/",
      auth_mode: "bearer_token",
      auth: { token: "governed-token" },
      default_headers: { Authorization: "Bearer unmanaged-token" }
    },
    routing: { channel: "custom", schema_version: "v1", envelope_profile: "canonical_v1", mapping_mode: "passthrough" },
    public_storefront: { scan_allowed: true, loader_enabled: true, public_api_enabled: true, allowed_scan_modes: ["auto"], scopes: ["storefront.mapping.read"] },
    audit: { audit_record_type: "GATEWAY_AUDIT", log_level: "info" }
  });
  assert.match(validateProfiles([profile]).join("\n"), /unmanaged credential field outbound\.default_headers\.Authorization/);
});
