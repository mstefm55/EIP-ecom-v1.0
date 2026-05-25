// services/api/src/auth/password.js

import crypto from "node:crypto";
import { promisify } from "node:util";
import argon2 from "argon2";
import { timingSafeEqual } from "./crypto.js";

/**
 * Password strength evaluation and policy enforcement
 */

const PASSWORD_POLICIES = {
  minLength: 15,
  maxLength: 128,
  requireUppercase: false,
  requireLowercase: false,
  requireNumbers: false,
  requireSymbols: false,
  preventReuse: 5, // Last N passwords
  maxAge: 0, // NIST-aligned default: no arbitrary rotation without compromise
  lockoutAfter: 5, // Failed attempts
  lockoutDuration: 30, // Minutes
  warnBeforeExpiry: 7 // Days
};

const SCRYPT_MAX_MEM = 64 * 1024 * 1024;
const scryptAsync = promisify(crypto.scrypt);
const COMMON_PASSWORD_BLOCKLIST = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "admin",
  "admin123",
  "administrator",
  "welcome",
  "welcome1",
  "welcome123",
  "letmein",
  "qwerty",
  "qwerty123",
  "123456",
  "12345678",
  "123456789",
  "111111",
  "iloveyou",
  "monkey",
  "dragon",
  "football",
  "baseball",
  "eip",
  "eipadmin",
  "changeme"
]);
const COMMON_PASSWORD_PATTERNS = [
  /password/i,
  /qwerty/i,
  /letmein/i,
  /welcome/i,
  /admin/i,
  /123456/,
  /000000/,
  /111111/
];

function parseScryptHash(value) {
  const parts = String(value || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (N <= 1 || r <= 0 || p <= 0) return null;

  const salt = Buffer.from(parts[4], "base64");
  const hash = Buffer.from(parts[5], "base64");
  if (!salt.length || !hash.length) return null;

  return { N, r, p, salt, hash };
}

async function verifyStoredPassword(password, credential) {
  if (!password || !credential?.secret_hash) return false;

  const hash = String(credential.secret_hash || "");
  const algorithm = String(credential.algorithm || "").toLowerCase();
  if (hash.startsWith("$argon2") || algorithm.startsWith("argon2")) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
  if (algorithm && algorithm !== "scrypt") return false;

  const parsed = parseScryptHash(hash);
  if (!parsed) return false;

  try {
    const derived = await scryptAsync(password, parsed.salt, parsed.hash.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
      maxmem: SCRYPT_MAX_MEM
    });
    return timingSafeEqual(derived, parsed.hash);
  } catch {
    return false;
  }
}

function lockExpiresAtFromIdentity(identity) {
  const raw = identity?.attrs?.auth_lock_expires_at;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

async function checkIdentityLoginLock(client, tenantId, identity) {
  if (!identity?.id) return { ok: false, error: "IDENTITY_DISABLED" };
  if (!identity.is_active) return { ok: false, error: "IDENTITY_DISABLED" };
  if (!identity.is_locked) return { ok: true };

  const expiresAt = lockExpiresAtFromIdentity(identity);
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    await client.query(
      `
      UPDATE eip_auth.auth_identity
      SET is_locked = false,
          attrs = COALESCE(attrs,'{}'::jsonb)
            - 'auth_lock_expires_at'
            - 'auth_lock_reason'
            - 'auth_lock_source'
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, identity.id]
    );
    identity.is_locked = false;
    identity.attrs = {
      ...(identity.attrs || {}),
      auth_lock_expires_at: undefined,
      auth_lock_reason: undefined,
      auth_lock_source: undefined
    };
    return { ok: true, unlocked: true };
  }

  return {
    ok: false,
    error: "ACCOUNT_LOCKED",
    locked_until: expiresAt ? expiresAt.toISOString() : null
  };
}

function evaluatePasswordStrength(password) {
  if (!password || typeof password !== "string") {
    return { ok: false, score: 0, feedback: ["Password is required"] };
  }

  const feedback = [];
  let score = 0;

  // Length check
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= PASSWORD_POLICIES.minLength) score += 1;
  if (password.length >= 20) score += 1;
  if (password.length < PASSWORD_POLICIES.minLength) {
    feedback.push(`Password must be at least ${PASSWORD_POLICIES.minLength} characters long`);
  }
  if (password.length > PASSWORD_POLICIES.maxLength) {
    feedback.push(`Password must be no more than ${PASSWORD_POLICIES.maxLength} characters long`);
  }

  // Character variety
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (hasLower) score += 1;
  if (hasUpper) score += 1;
  if (hasNumber) score += 1;
  if (hasSymbol) score += 1;

  // Policy checks
  if (PASSWORD_POLICIES.requireLowercase && !hasLower) {
    feedback.push("Password must contain at least one lowercase letter");
  }
  if (PASSWORD_POLICIES.requireUppercase && !hasUpper) {
    feedback.push("Password must contain at least one uppercase letter");
  }
  if (PASSWORD_POLICIES.requireNumbers && !hasNumber) {
    feedback.push("Password must contain at least one number");
  }
  if (PASSWORD_POLICIES.requireSymbols && !hasSymbol) {
    feedback.push("Password must contain at least one special character");
  }

  const normalized = password.toLowerCase().replace(/\s+/g, "");
  if (COMMON_PASSWORD_BLOCKLIST.has(normalized)) {
    feedback.push("Password appears on the common-password blocklist");
    score = 0;
  }

  for (const pattern of COMMON_PASSWORD_PATTERNS) {
    if (pattern.test(password)) {
      feedback.push("Password contains common patterns that are easily guessed");
      score = Math.max(0, score - 2);
      break;
    }
  }

  // Sequential characters
  if (/(.)\1{2,}/.test(password)) {
    feedback.push("Password should not contain repeated characters");
    score = Math.max(0, score - 1);
  }

  // Dictionary words (basic check)
  const dictionaryWords = ["password", "admin", "user", "login", "welcome"];
  const lowerPassword = password.toLowerCase();
  for (const word of dictionaryWords) {
    if (lowerPassword.includes(word)) {
      feedback.push("Password should not contain common dictionary words");
      score = Math.max(0, score - 1);
      break;
    }
  }

  const ok = feedback.length === 0;

  return {
    ok,
    score: Math.min(5, score),
    strength: score >= 4 ? "strong" : score >= 3 ? "medium" : "weak",
    feedback
  };
}

async function checkPasswordHistory(client, tenantId, identityId, proposedPassword) {
  if (!PASSWORD_POLICIES.preventReuse) return { ok: true };
  if (!proposedPassword) return { ok: true };

  const history = await client.query(
    `
    SELECT secret_hash, algorithm
    FROM eip_auth.auth_credential
    WHERE tenant_id = $1
      AND identity_id = $2
      AND credential_type = 'password'
    ORDER BY created_at DESC
    LIMIT $3
    `,
    [tenantId, identityId, PASSWORD_POLICIES.preventReuse]
  );

  for (const row of history.rows) {
    if (await verifyStoredPassword(proposedPassword, row)) {
      return {
        ok: false,
        error: "PASSWORD_REUSE_NOT_ALLOWED",
        message: `Password cannot be the same as your last ${PASSWORD_POLICIES.preventReuse} passwords`
      };
    }
  }

  return { ok: true };
}

async function checkPasswordExpiry(client, tenantId, identityId) {
  const result = await client.query(
    `
    SELECT valid_from, valid_to
    FROM eip_auth.auth_credential
    WHERE tenant_id = $1
      AND identity_id = $2
      AND credential_type = 'password'
      AND is_revoked = false
      AND (valid_to IS NULL OR valid_to > now())
    ORDER BY valid_from DESC
    LIMIT 1
    `,
    [tenantId, identityId]
  );

  if (result.rowCount === 0) return { ok: true };

  const credential = result.rows[0];
  const now = new Date();
  const validFrom = new Date(credential.valid_from);

  // Check if password is expired
  if (credential.valid_to && new Date(credential.valid_to) < now) {
    return {
      ok: false,
      error: "PASSWORD_EXPIRED",
      message: "Your password has expired and must be changed"
    };
  }

  // Check if password is about to expire
  if (PASSWORD_POLICIES.maxAge) {
    const expiryDate = new Date(validFrom);
    expiryDate.setDate(expiryDate.getDate() + PASSWORD_POLICIES.maxAge);

    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= PASSWORD_POLICIES.warnBeforeExpiry && daysUntilExpiry > 0) {
      return {
        ok: true,
        warning: "PASSWORD_EXPIRING_SOON",
        message: `Your password will expire in ${daysUntilExpiry} days`,
        daysUntilExpiry
      };
    }
  }

  return { ok: true };
}

async function recordFailedLoginAttempt(client, tenantId, identityId, ipAddress, userAgent, failureType = "login_failed") {
  await client.query(
    `
    INSERT INTO eip_auth.auth_failed_attempt
      (tenant_id, identity_id, ip_address, user_agent, attempted_at)
    VALUES
      ($1, $2, $3, $4, now())
    `,
    [tenantId, identityId, ipAddress, userAgent]
  );

  // Check if account should be locked
  const recentAttempts = await client.query(
    `
    SELECT count(*)::int AS attempt_count
    FROM eip_auth.auth_failed_attempt
    WHERE tenant_id = $1
      AND identity_id = $2
      AND attempted_at > now() - interval '15 minutes'
    `,
    [tenantId, identityId]
  );

  if (recentAttempts.rows[0].attempt_count >= PASSWORD_POLICIES.lockoutAfter) {
    const lockExpiresAt = new Date(Date.now() + PASSWORD_POLICIES.lockoutDuration * 60 * 1000);
    await client.query(
      `
      UPDATE eip_auth.auth_identity
      SET is_locked = true,
          attrs = COALESCE(attrs,'{}'::jsonb)
            || jsonb_build_object(
              'auth_lock_reason', 'too_many_failed_attempts',
              'auth_lock_source', $3::text,
              'auth_lock_expires_at', $4::text
            )
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, identityId, failureType, lockExpiresAt.toISOString()]
    );

    return {
      ok: false,
      error: "ACCOUNT_LOCKED",
      locked_until: lockExpiresAt.toISOString(),
      message: `Account locked due to too many failed attempts. Try again in ${PASSWORD_POLICIES.lockoutDuration} minutes.`
    };
  }

  return { ok: true };
}

async function clearFailedLoginAttempts(client, tenantId, identityId) {
  await client.query(
    `
    DELETE FROM eip_auth.auth_failed_attempt
    WHERE tenant_id = $1 AND identity_id = $2
    `,
    [tenantId, identityId]
  );
  await client.query(
    `
    UPDATE eip_auth.auth_identity
    SET is_locked = false,
        attrs = COALESCE(attrs,'{}'::jsonb)
          - 'auth_lock_expires_at'
          - 'auth_lock_reason'
          - 'auth_lock_source'
    WHERE tenant_id = $1
      AND id = $2
      AND (
        is_locked = true
        OR attrs ? 'auth_lock_expires_at'
        OR attrs ? 'auth_lock_reason'
        OR attrs ? 'auth_lock_source'
      )
    `,
    [tenantId, identityId]
  );
}

function randomChar(chars) {
  return chars[crypto.randomInt(0, chars.length)];
}

function shuffleChars(value) {
  const chars = value.split("");
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function generateStrongPassword(length = 16) {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const allChars = lowercase + uppercase + numbers + symbols;
  let password = '';

  // Ensure at least one character from each required set
  password += randomChar(lowercase);
  password += randomChar(uppercase);
  password += randomChar(numbers);
  password += randomChar(symbols);

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += randomChar(allChars);
  }

  return shuffleChars(password);
}

export {
  PASSWORD_POLICIES,
  evaluatePasswordStrength,
  verifyStoredPassword,
  checkPasswordHistory,
  checkPasswordExpiry,
  checkIdentityLoginLock,
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
  generateStrongPassword
};
