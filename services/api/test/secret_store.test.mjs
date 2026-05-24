import assert from "node:assert/strict";
import test from "node:test";
import {
  clearProfileSecretRefs,
  hydrateConnectionProfileSecrets,
  revokeConnectionSecrets,
  vaultConnectionProfileSecrets
} from "../src/services/gateway/secretStore.js";
import { maskSecrets } from "../src/services/gateway/connectionProfile.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const ACTOR_ID = "00000000-0000-4000-8000-000000000002";
const SECRET_SOURCE = {
  config: {
    SECRET_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
    SECRET_ENCRYPTION_KEY_ID: "test-key"
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

  const masked = maskSecrets(vaulted);
  assert.equal(masked.verification.api_key.secret_ref, undefined);
  assert.equal(masked.verification.api_key.secret_set, true);

  const hydrated = await hydrateConnectionProfileSecrets(SECRET_SOURCE, db, TENANT_ID, vaulted);
  assert.equal(hydrated.verification.api_key.secret, "api-key-v1");
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
  assert.equal(hydrated.verification.api_key.secret, "api-key-v2");
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
