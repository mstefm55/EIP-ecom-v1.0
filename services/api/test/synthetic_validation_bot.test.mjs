import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeTarget,
  buildPlan,
  parseArgs,
  redactHeaders
} from "../../../tools/synthetic/v1_validation_bot.mjs";

test("synthetic validation bot defaults to dry-run plan mode", () => {
  const options = parseArgs([], {});
  assert.equal(options.mode, "plan");
  assert.equal(options.baseUrl, "http://localhost:4000");
  assert.ok(buildPlan(options).some((item) => item.scenario === "public-gateway-invalid"));
});

test("synthetic validation bot refuses hosted Railway targets without explicit test scope", () => {
  const options = parseArgs(["--base-url", "https://eip-ecom-v1.up.railway.app"], {});
  assert.throws(() => assertSafeTarget(options), /HOSTED_TARGET_REQUIRES/);

  const allowed = parseArgs([
    "--base-url",
    "https://eip-ecom-v1.up.railway.app",
    "--allow-hosted",
    "--suffix",
    "synthetic-test"
  ], {});
  assert.equal(assertSafeTarget(allowed), true);
});

test("synthetic validation bot redacts secret-like request headers in output", () => {
  const redacted = redactHeaders({
    authorization: "Bearer secret",
    cookie: "sid=secret",
    "x-api-key": "key",
    origin: "https://store.test"
  });
  assert.equal(redacted.authorization, "[REDACTED]");
  assert.equal(redacted.cookie, "[REDACTED]");
  assert.equal(redacted["x-api-key"], "[REDACTED]");
  assert.equal(redacted.origin, "https://store.test");
});
