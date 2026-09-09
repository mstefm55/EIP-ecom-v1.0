import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { sha256Hex } from "../src/auth/crypto.js";
import { ensureIdempotency } from "../src/services/gateway/idempotency.js";
import {
  requireSessionBoundMemberCsrf
} from "../src/services/perfectFit/writeSecurity.js";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const adminRoute = read("../src/routes/public_perfect_fit_admin.js");
const workspaceRoute = read("../src/routes/public_perfect_fit_workspace.js");
const publicationRoute = read("../src/routes/public_perfect_fit_publication.js");
const communityRoute = read("../src/routes/public_perfect_fit_community.js");
const adapter = read("../../../apps/samara-web/my-vite-react-app/src/lib/eipApiAdapter.js");

function makeReply() {
  return {
    statusCode: 200,
    payload: null,
    code(value) {
      this.statusCode = value;
      return this;
    },
    send(value) {
      this.payload = value;
      return this;
    }
  };
}

test("session-bound Perfect Fit CSRF rejects a matching cookie/header pair that is not bound to the session", () => {
  const app = { config: { CSRF_PEPPER: "pepper" } };
  const req = {
    cookies: { member_csrf: "csrf-token" },
    headers: { "x-member-csrf": "csrf-token" }
  };
  const reply = makeReply();
  const session = { csrf_secret_hash: sha256Hex("different-token:pepper") };

  assert.equal(requireSessionBoundMemberCsrf(app, session, req, reply), false);
  assert.equal(reply.statusCode, 403);
  assert.deepEqual(reply.payload, { ok: false, error: "MEMBER_CSRF_INVALID" });
});

test("session-bound Perfect Fit CSRF accepts the token issued for the authenticated member session", () => {
  const app = { config: { CSRF_PEPPER: "pepper" } };
  const req = {
    cookies: { member_csrf: "csrf-token" },
    headers: { "x-member-csrf": "csrf-token" }
  };
  const reply = makeReply();
  const session = { csrf_secret_hash: sha256Hex("csrf-token:pepper") };

  assert.equal(requireSessionBoundMemberCsrf(app, session, req, reply), true);
  assert.equal(reply.statusCode, 200);
  assert.equal(reply.payload, null);
});

test("idempotency reservations return their scope and key so callers can finalize the ledger", async () => {
  const db = {
    async query(sql) {
      assert.match(sql, /INSERT INTO eip_core\.idempotency_key/);
      return { rowCount: 1, rows: [] };
    }
  };

  const result = await ensureIdempotency(db, {
    tenantId: "tenant-1",
    scope: "perfect_fit.community.create",
    key: "event-1",
    requestHash: "hash-1"
  });

  assert.deepEqual(result, {
    ok: true,
    created: true,
    scope: "perfect_fit.community.create",
    key: "event-1"
  });
});

test("idempotency replay also preserves scope and key for deterministic finalization/replay", async () => {
  let calls = 0;
  const db = {
    async query(sql) {
      calls += 1;
      if (calls === 1) throw new Error("duplicate key");
      assert.match(sql, /SELECT request_hash, status, response/);
      return {
        rowCount: 1,
        rows: [{ request_hash: "hash-1", status: "ok", response: { ok: true } }]
      };
    }
  };

  const result = await ensureIdempotency(db, {
    tenantId: "tenant-1",
    scope: "perfect_fit.community.create",
    key: "event-1",
    requestHash: "hash-1"
  });

  assert.equal(result.ok, true);
  assert.equal(result.replay, true);
  assert.equal(result.scope, "perfect_fit.community.create");
  assert.equal(result.key, "event-1");
  assert.deepEqual(result.response, { ok: true });
});

test("all Perfect Fit private/admin publication write routes use session-bound CSRF", () => {
  for (const source of [adminRoute, workspaceRoute, publicationRoute]) {
    assert.match(source, /csrf_secret_hash/);
    assert.match(source, /requireSessionBoundMemberCsrf\(app, session, req, reply\)/);
    assert.doesNotMatch(source, /function requireMemberCsrf\(/);
  }
});

test("Perfect Fit workspace, admin curation and publication writes enforce and finalize gateway idempotency", () => {
  for (const source of [adminRoute, workspaceRoute, publicationRoute]) {
    assert.match(source, /beginPerfectFitWriteIdempotency/);
    assert.match(source, /finalizePerfectFitWriteIdempotency/);
    assert.match(source, /sendPerfectFitIdempotencyReplay/);
  }
  assert.match(adminRoute, /action:\s*"admin\.curation\.save"/);
  assert.match(workspaceRoute, /action:\s*"workspace\.save"/);
  assert.match(publicationRoute, /action:\s*"publication\.submit"/);
  assert.match(publicationRoute, /action:\s*"publication\.admin\.action"/);
});

test("existing PF browser transport already sends event IDs for workspace and admin curation writes", () => {
  assert.match(
    adapter,
    /saveWorkspace:[\s\S]*?idempotent:\s*true/
  );
  assert.match(
    adapter,
    /saveAdminCuration:[\s\S]*?idempotent:\s*true/
  );
  assert.match(adapter, /headers\['X-Event-Id'\]\s*=\s*crypto\.randomUUID\(\)/);
});

test("community idempotency finalization still uses the shared reservation scope and key", () => {
  assert.match(communityRoute, /const idem = await beginIdempotency/);
  assert.match(communityRoute, /scope:\s*idem\.scope/);
  assert.match(communityRoute, /key:\s*idem\.key/);
});
