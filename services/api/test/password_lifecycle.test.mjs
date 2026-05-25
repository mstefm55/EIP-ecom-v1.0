import assert from "node:assert/strict";
import test from "node:test";
import argon2 from "argon2";
import {
  checkIdentityLoginLock,
  checkPasswordHistory,
  evaluatePasswordStrength,
  generateStrongPassword,
  recordFailedLoginAttempt
} from "../src/auth/password.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const IDENTITY_ID = "00000000-0000-4000-8000-000000000002";

test("password history verifies proposed password against salted argon2 hashes", async () => {
  const oldHash = await argon2.hash("Correct Horse Battery 7!");
  const client = {
    async query() {
      return { rows: [{ secret_hash: oldHash, algorithm: "argon2id" }] };
    }
  };

  const reused = await checkPasswordHistory(client, TENANT_ID, IDENTITY_ID, "Correct Horse Battery 7!");
  assert.equal(reused.ok, false);
  assert.equal(reused.error, "PASSWORD_REUSE_NOT_ALLOWED");

  const fresh = await checkPasswordHistory(client, TENANT_ID, IDENTITY_ID, "Fresh Horse Battery 9!");
  assert.equal(fresh.ok, true);
});

test("failed login lock records durable expiry metadata instead of using process timers", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (/SELECT count\(\*\)::int AS attempt_count/.test(sql)) {
        return { rows: [{ attempt_count: 5 }] };
      }
      return { rows: [] };
    }
  };

  const result = await recordFailedLoginAttempt(
    client,
    TENANT_ID,
    IDENTITY_ID,
    "127.0.0.1",
    "node-test",
    "password_login_bad_password"
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "ACCOUNT_LOCKED");
  assert.match(result.locked_until, /^\d{4}-/);
  assert.equal(calls.some((call) => /auth_lock_expires_at/.test(call.sql)), true);
  assert.equal(calls.some((call) => /setTimeout/.test(call.sql)), false);
});

test("expired identity lock auto-unlocks through existing identity attrs", async () => {
  let updated = false;
  const client = {
    async query(sql) {
      if (/UPDATE eip_auth\.auth_identity/.test(sql)) updated = true;
      return { rows: [] };
    }
  };
  const identity = {
    id: IDENTITY_ID,
    is_active: true,
    is_locked: true,
    attrs: { auth_lock_expires_at: new Date(Date.now() - 1000).toISOString() }
  };

  const result = await checkIdentityLoginLock(client, TENANT_ID, identity);
  assert.equal(result.ok, true);
  assert.equal(result.unlocked, true);
  assert.equal(updated, true);
});

test("generated passwords use secure random and satisfy configured composition", () => {
  const password = generateStrongPassword(24);
  assert.equal(password.length, 24);
  assert.match(password, /[a-z]/);
  assert.match(password, /[A-Z]/);
  assert.match(password, /\d/);
  assert.match(password, /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/);
});

test("password policy blocks common passwords while allowing long passphrases", () => {
  const blocked = evaluatePasswordStrength("Password123456789!");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.feedback.some((item) => /common|dictionary|pattern/i.test(item)), true);

  const leetBlocked = evaluatePasswordStrength("P@ssw0rd2026!!");
  assert.equal(leetBlocked.ok, false);
  assert.equal(leetBlocked.feedback.some((item) => /common|pattern/i.test(item)), true);

  const seasonalBlocked = evaluatePasswordStrength("Winter2026!Admin");
  assert.equal(seasonalBlocked.ok, false);
  assert.equal(seasonalBlocked.feedback.some((item) => /common|dictionary|pattern/i.test(item)), true);

  const passphrase = evaluatePasswordStrength("correct horse battery staple 2026");
  assert.equal(passphrase.ok, true);
});
