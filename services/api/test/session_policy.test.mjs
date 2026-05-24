import assert from "node:assert/strict";
import test from "node:test";
import { buildStepUpAttrs, evaluateStepUp } from "../src/auth/sessionPolicy.js";

test("step-up policy accepts recent OTP/TOTP assurance and rejects stale assurance", () => {
  const nowMs = Date.parse("2026-05-24T12:00:00.000Z");
  const recent = {
    attrs: {
      step_up_at: "2026-05-24T11:58:30.000Z",
      step_up_method: "totp",
      assurance: "high"
    }
  };
  assert.equal(evaluateStepUp(recent, { ttlMin: 5, nowMs }).ok, true);

  const stale = {
    attrs: {
      step_up_at: "2026-05-24T11:50:00.000Z",
      step_up_method: "otp",
      assurance: "high"
    }
  };
  assert.deepEqual(
    evaluateStepUp(stale, { ttlMin: 5, nowMs }),
    { ok: false, status: 403, error: "STEP_UP_REQUIRED" }
  );
});

test("privileged phishing-resistant mode requires passkey-backed step-up", () => {
  const nowMs = Date.parse("2026-05-24T12:00:00.000Z");
  const otp = {
    attrs: {
      step_up_at: "2026-05-24T11:59:00.000Z",
      step_up_method: "otp",
      step_up_phishing_resistant: false,
      assurance: "high"
    }
  };
  assert.deepEqual(
    evaluateStepUp(otp, { ttlMin: 5, nowMs, phishingResistant: true }),
    { ok: false, status: 403, error: "PASSKEY_STEP_UP_REQUIRED" }
  );

  const passkey = {
    attrs: {
      step_up_at: "2026-05-24T11:59:00.000Z",
      step_up_method: "passkey",
      step_up_phishing_resistant: true,
      assurance: "phishing_resistant"
    }
  };
  assert.equal(evaluateStepUp(passkey, { ttlMin: 5, nowMs, phishingResistant: true }).ok, true);
});

test("step-up attrs mark passkeys as phishing-resistant", () => {
  const attrs = buildStepUpAttrs("passkey");
  assert.equal(attrs.step_up_method, "passkey");
  assert.equal(attrs.step_up_phishing_resistant, true);
  assert.equal(attrs.assurance, "phishing_resistant");

  const otp = buildStepUpAttrs("otp");
  assert.equal(otp.step_up_phishing_resistant, false);
  assert.equal(otp.assurance, "high");
});
