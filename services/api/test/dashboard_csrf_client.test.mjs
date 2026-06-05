import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiClientPath = path.resolve(__dirname, "../../../apps/dashboard/src/services/apiClient.js");
const idleHookPath = path.resolve(__dirname, "../../../apps/dashboard/src/hooks/useIdleLogout.js");
const adminShellPath = path.resolve(__dirname, "../../../apps/dashboard/src/components/admin/AdminShell.jsx");
const userShellPath = path.resolve(__dirname, "../../../apps/dashboard/src/components/user/UserShell.jsx");

test("dashboard API client resets cached CSRF after session-changing auth responses", () => {
  const source = fs.readFileSync(apiClientPath, "utf8");
  assert.match(source, /SESSION_MUTATING_PATHS/);
  assert.match(source, /\/api\/eip\/auth\/verify-otp/);
  assert.match(source, /\/api\/eip\/auth\/passkeys\/login\/verify/);
  assert.match(source, /shouldResetCsrfAfterSuccess\(path, method\)/);
  assert.match(source, /if \(shouldResetCsrfAfterSuccess\(path, method\) && !hasPayloadToken\)/);
  assert.match(source, /resetCsrfToken\(\)/);
});

test("dashboard active-user idle handling refreshes backend session without blind keepalive", () => {
  const hook = fs.readFileSync(idleHookPath, "utf8");
  const adminShell = fs.readFileSync(adminShellPath, "utf8");
  const userShell = fs.readFileSync(userShellPath, "utf8");

  assert.match(hook, /onActivityPing/);
  assert.match(hook, /lastActivityPingRef/);
  assert.match(hook, /defaultActivityPingIntervalMs/);
  assert.match(hook, /window\.addEventListener\(eventName, markActivity/);
  assert.doesNotMatch(hook, /setInterval\(\(\)\s*=>\s*.*onActivityPing/s);

  for (const shell of [adminShell, userShell]) {
    assert.match(shell, /keepSessionAlive/);
    assert.match(shell, /apiFetch\("\/api\/eip\/auth\/whoami"\)/);
    assert.match(shell, /onActivityPing: keepSessionAlive/);
  }
});
