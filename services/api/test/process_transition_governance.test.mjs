import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

test("process engine reports invalid transitions with available actions instead of opaque failures", () => {
  const engine = read("services/api/src/core/core_process_engine.js");
  const route = read("services/api/src/routes/process/core_process.js");

  assert.match(engine, /availableTransitions = transitions/);
  assert.match(engine, /normalizeOptionalText\(t\.from\) === currentNode/);
  assert.match(engine, /normalizeOptionalText\(t\.action\) === requestedAction/);
  assert.match(engine, /error: "INVALID_TRANSITION"/);
  assert.match(engine, /available_transitions: availableTransitions/);
  assert.match(route, /available_transitions: result\.available_transitions/);
  assert.match(route, /result\.error === "NOT_FOUND" \|\| result\.error === "PROCESS_DEF_NOT_FOUND"/);
});

test("process transition permissions are part of governed profile/access role templates", () => {
  const migration = read("services/api/db/migrations/0117_process_transition_permission_backfill.sql");
  const clone = read("services/api/db/seed/clone_template_to_tenant.sql");

  for (const permission of [
    "PROCESS_DEF_READ",
    "PROCESS_DEF_WRITE",
    "PROCESS_INSTANCE_READ",
    "PROCESS_INSTANCE_WRITE",
    "CRM_PROCESS_DEF_READ",
    "CRM_PROCESS_DEF_WRITE"
  ]) {
    assert.match(migration, new RegExp(permission));
  }

  for (const role of [
    "ADMIN_SUPER",
    "ACCESS_UNIVERSAL",
    "ECOM_ADMIN",
    "ACCESS_ECOM_FULL",
    "ACCESS_ECOM_CATALOG",
    "ACCESS_ECOM_ORDERS",
    "CRM_ADMIN",
    "CRM_USER",
    "ACCESS_CRM_FULL",
    "ACCESS_READ_ONLY"
  ]) {
    assert.match(migration, new RegExp(role));
  }

  assert.match(migration, /INSERT INTO eip_authz\.role_template_permission/);
  assert.match(migration, /INSERT INTO eip_authz\.role_permission/);
  assert.match(clone, /role_template_permission/);
});
