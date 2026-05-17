// services/api/src/auth/password.js

/**
 * Password strength evaluation and policy enforcement
 */

const PASSWORD_POLICIES = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
  preventReuse: 5, // Last N passwords
  maxAge: 90, // Days
  lockoutAfter: 5, // Failed attempts
  lockoutDuration: 30, // Minutes
  warnBeforeExpiry: 7 // Days
};

function evaluatePasswordStrength(password) {
  if (!password || typeof password !== "string") {
    return { ok: false, score: 0, feedback: ["Password is required"] };
  }

  const feedback = [];
  let score = 0;

  // Length check
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length < PASSWORD_POLICIES.minLength) {
    feedback.push(`Password must be at least ${PASSWORD_POLICIES.minLength} characters long`);
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

  // Common patterns to avoid
  const commonPatterns = [
    /^password/i,
    /^123456/,
    /^qwerty/i,
    /^admin/i,
    /^user/i
  ];

  for (const pattern of commonPatterns) {
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

  const ok = feedback.length === 0 && score >= 4;

  return {
    ok,
    score: Math.min(5, score),
    strength: score >= 4 ? "strong" : score >= 3 ? "medium" : "weak",
    feedback
  };
}

async function checkPasswordHistory(client, tenantId, identityId, newPasswordHash) {
  if (!PASSWORD_POLICIES.preventReuse) return { ok: true };

  const history = await client.query(
    `
    SELECT secret_hash
    FROM eip_auth.auth_credential
    WHERE tenant_id = $1
      AND identity_id = $2
      AND credential_type = 'password'
      AND is_revoked = false
    ORDER BY created_at DESC
    LIMIT $3
    `,
    [tenantId, identityId, PASSWORD_POLICIES.preventReuse]
  );

  // Check if new password matches any recent passwords
  for (const row of history.rows) {
    if (row.secret_hash === newPasswordHash) {
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

async function recordFailedLoginAttempt(client, tenantId, identityId, ipAddress, userAgent) {
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
    // Lock the account
    await client.query(
      `
      UPDATE eip_auth.auth_identity
      SET is_locked = true,
          locked_at = now(),
          lock_reason = 'too_many_failed_attempts'
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, identityId]
    );

    // Schedule unlock
    setTimeout(async () => {
      try {
        await client.query(
          `
          UPDATE eip_auth.auth_identity
          SET is_locked = false,
              locked_at = null,
              lock_reason = null
          WHERE tenant_id = $1 AND id = $2
          `,
          [tenantId, identityId]
        );
      } catch (error) {
        console.error('Failed to unlock account:', error);
      }
    }, PASSWORD_POLICIES.lockoutDuration * 60 * 1000);

    return {
      ok: false,
      error: "ACCOUNT_LOCKED",
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
}

function generateStrongPassword(length = 16) {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const allChars = lowercase + uppercase + numbers + symbols;
  let password = '';

  // Ensure at least one character from each required set
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export {
  PASSWORD_POLICIES,
  evaluatePasswordStrength,
  checkPasswordHistory,
  checkPasswordExpiry,
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
  generateStrongPassword
};
