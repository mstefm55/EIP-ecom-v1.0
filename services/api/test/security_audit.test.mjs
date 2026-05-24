import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSecurityEvent,
  emitSecurityEvent,
  redactSecurityDetails
} from "../src/lib/securityAudit.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const IDENTITY_ID = "00000000-0000-4000-8000-000000000002";

test("security event builder standardizes shape and infers category", () => {
  const event = buildSecurityEvent("gateway.verification_failed", {
    tenantId: TENANT_ID,
    identityId: IDENTITY_ID,
    connectionCode: "storefront",
    suffix: "samara",
    outcome: "rejected",
    reason: "BAD_SIGNATURE",
    metadata: {
      headers: {
        authorization: "Bearer secret-token",
        "x-api-key": "live-key",
        origin: "https://store.test"
      }
    }
  });

  assert.equal(event.event_type, "gateway.verification_failed");
  assert.equal(event.category, "gateway");
  assert.equal(event.tenant_id, TENANT_ID);
  assert.equal(event.actor_identity_id, IDENTITY_ID);
  assert.equal(event.connection_code, "storefront");
  assert.equal(event.suffix, "samara");
  assert.equal(event.outcome, "rejected");
  assert.equal(event.metadata.headers.authorization, "[REDACTED]");
  assert.equal(event.metadata.headers["x-api-key"], "[REDACTED]");
  assert.equal(event.metadata.headers.origin, "https://store.test");
});

test("redaction removes nested secret material without dropping useful context", () => {
  const redacted = redactSecurityDetails({
    tenant: "tenant_a",
    body: {
      password: "super-secret",
      nested: {
        token: "abc",
        value: "kept"
      }
    },
    rows: [{ credential_id: "raw-credential", count: 1 }]
  });

  assert.equal(redacted.tenant, "tenant_a");
  assert.equal(redacted.body.password, "[REDACTED]");
  assert.equal(redacted.body.nested.token, "[REDACTED]");
  assert.equal(redacted.body.nested.value, "kept");
  assert.equal(redacted.rows[0].credential_id, "[REDACTED]");
  assert.equal(redacted.rows[0].count, 1);
});

test("emitSecurityEvent persists redacted metadata and does not expose raw secrets", async () => {
  let captured;
  const app = {
    log: {
      info() {},
      warn() {}
    },
    db: {
      async query(sql, params) {
        captured = { sql, params };
        return { rows: [{ id: "00000000-0000-4000-8000-000000000099" }] };
      }
    }
  };

  const event = await emitSecurityEvent(app, "connection.secret_rotated", {
    tenantId: TENANT_ID,
    actorIdentityId: IDENTITY_ID,
    connectionCode: "storefront",
    outcome: "success",
    metadata: {
      secret: "do-not-store",
      rotated: [{ secret_kind: "api_key", version: 2 }]
    }
  });

  assert.equal(event.id, "00000000-0000-4000-8000-000000000099");
  assert.match(captured.sql, /INSERT INTO eip_core\.security_event/);
  const serialized = JSON.stringify(captured.params);
  assert.equal(serialized.includes("do-not-store"), false);
  assert.equal(serialized.includes("[REDACTED]"), true);
  assert.equal(serialized.includes("api_key"), true);
});
