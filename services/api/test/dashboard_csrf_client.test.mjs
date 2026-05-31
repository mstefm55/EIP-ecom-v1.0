import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiClientPath = path.resolve(__dirname, "../../../apps/dashboard/src/services/apiClient.js");

test("dashboard API client resets cached CSRF after session-changing auth responses", () => {
  const source = fs.readFileSync(apiClientPath, "utf8");
  assert.match(source, /SESSION_MUTATING_PATHS/);
  assert.match(source, /\/api\/eip\/auth\/verify-otp/);
  assert.match(source, /\/api\/eip\/auth\/passkeys\/login\/verify/);
  assert.match(source, /shouldResetCsrfAfterSuccess\(path, method\)/);
  assert.match(source, /if \(shouldResetCsrfAfterSuccess\(path, method\) && !hasPayloadToken\)/);
  assert.match(source, /resetCsrfToken\(\)/);
});
