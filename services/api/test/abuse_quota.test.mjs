import assert from "node:assert/strict";
import test from "node:test";
import { enforceConnectionQuota, resolveQuota } from "../src/lib/abuseQuota.js";
import { shouldRequirePhishingResistantStepUp } from "../src/auth/privilegedStepUp.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

test("connection quotas use profile override before app defaults", () => {
  const quota = resolveQuota({
    category: "gateway",
    config: { PUBLIC_GATEWAY_QUOTA_MAX: 3000, PUBLIC_GATEWAY_QUOTA_WINDOW_SEC: 3600 },
    profile: { inbound: { quota: { max: 25, window_sec: 60 } } }
  });

  assert.deepEqual(quota, { max: 25, windowSec: 60 });
});

test("security-event backed quota rejects over-limit connection traffic", async () => {
  const app = {
    config: { PUBLIC_GATEWAY_QUOTA_MAX: 10, PUBLIC_GATEWAY_QUOTA_WINDOW_SEC: 60 },
    db: {
      async query(sql, params) {
        assert.match(sql, /FROM eip_core\.security_event/);
        assert.equal(params[0], TENANT_ID);
        assert.equal(params[1], "gateway");
        assert.equal(params[3], "storefront");
        assert.equal(params[4], "samara");
        return { rows: [{ event_count: 10 }] };
      }
    }
  };

  const result = await enforceConnectionQuota(app, {
    tenantId: TENANT_ID,
    category: "gateway",
    profile: {},
    connectionCode: "storefront",
    suffix: "samara"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "QUOTA_EXCEEDED");
});

test("owner admin privileged actions require phishing-resistant step-up in production", () => {
  assert.equal(
    shouldRequirePhishingResistantStepUp(
      { NODE_ENV: "production", OWNER_ADMIN_PASSKEY_STEP_UP_REQUIRED: true },
      { is_owner_admin_session: true }
    ),
    true
  );

  assert.equal(
    shouldRequirePhishingResistantStepUp(
      { NODE_ENV: "development", OWNER_ADMIN_PASSKEY_STEP_UP_REQUIRED: true },
      { is_owner_admin_session: true }
    ),
    false
  );

  assert.equal(
    shouldRequirePhishingResistantStepUp(
      { NODE_ENV: "production", REQUIRE_PASSKEY_FOR_PRIVILEGED_ACTIONS: true },
      { is_owner_admin_session: false }
    ),
    true
  );
});
