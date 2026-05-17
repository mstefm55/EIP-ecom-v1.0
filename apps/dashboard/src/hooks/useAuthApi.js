import { useState } from "react";
import { apiFetch } from "../services/apiClient";

function buildMessage(type, message) {
  return { type, message };
}

function parseApiError(error) {
  const message = error?.message || "";
  const match = message.match(/API \d+: (.*)$/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function friendlyErrorMessage(error) {
  const api = parseApiError(error);
  const code = api?.error;
  const map = {
    BAD_REQUEST: "Please check your details and try again.",
    TENANT_NOT_FOUND: "Organisation not found.",
    IDENTITY_NOT_FOUND: "User not found.",
    IDENTITY_DISABLED: "This account is disabled.",
    BAD_PASSWORD: "Incorrect password.",
    LOGIN_FAILED: "Incorrect email or password.",
    STEP_UP_REQUIRED: "Additional verification is required. Use OTP or TOTP to continue.",
    DEVICE_UNTRUSTED: "This device needs verification. Use OTP to continue.",
    OTP_RATE_LIMIT: "Too many requests. Try again in a few minutes.",
    INVALID_OTP: "Invalid OTP. Please try again.",
    OTP_EXPIRED: "OTP expired. Request a new code.",
    UNAUTHENTICATED: "Session expired. Please sign in again.",
    FORBIDDEN: "You do not have access to this action.",
    DEVICE_REVOKED: "This device access was revoked. Verify again with OTP.",
    TOTP_NOT_FOUND: "No TOTP setup was found for this account.",
    TOTP_ALREADY_ENABLED: "TOTP is already enabled for this account.",
    TOTP_UNAVAILABLE: "TOTP setup is temporarily unavailable.",
    TOTP_SECRET_INVALID: "TOTP setup is invalid. Start setup again.",
    INVALID_TOTP: "Invalid TOTP code. Please try again.",
    PASSWORD_WEAK: "Password does not meet the security requirements.",
    PASSWORD_REUSE_NOT_ALLOWED: "You cannot reuse a recent password.",
    RESET_INVALID: "Reset link is invalid.",
    RESET_EXPIRED: "Reset link has expired.",
    TOTP_REQUIRED: "TOTP is required for recovery.",
    RECOVERY_INVALID: "Recovery link is invalid.",
    RECOVERY_EXPIRED: "Recovery link has expired.",
  };
  return map[code] || error?.message || "Request failed.";
}

export function useAuthApi() {
  const [status, setStatus] = useState(null);
  const [orgStatus, setOrgStatus] = useState(null);
  const [organisations, setOrganisations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [enrollment, setEnrollment] = useState(null);

  function fail(message) {
    setStatus(buildMessage("error", message));
    return { ok: false, error: message };
  }

  async function run(action, successMessage) {
    setLoading(true);
    try {
      const result = await action();
      if (result?.ok === false) {
        let payload = "{}";
        try {
          payload = JSON.stringify(result);
        } catch {
          payload = "{\"ok\":false}";
        }
        throw new Error(`API 400: ${payload}`);
      }
      if (successMessage) {
        setStatus(buildMessage("success", successMessage));
      }
      return result;
    } catch (error) {
      setStatus(buildMessage("error", friendlyErrorMessage(error)));
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp({ tenantId, organisation, email, password }) {
    const tenantPayload = buildTenantPayload(tenantId || organisation);
    if (!email) return fail("Enter your email address.");
    if (!password) return fail("Enter your password.");
    if (!tenantPayload.tenantId && !tenantPayload.tenantCode) {
      return fail("Enter your organisation name or code.");
    }
    return run(
      () =>
        apiFetch("/api/eip/auth/request-otp", {
          method: "POST",
          body: { ...tenantPayload, email, password },
        }),
      "OTP sent. Check your email."
    );
  }

  async function verifyOtp({ tenantId, organisation, email, otp }) {
    const cleanOtp = String(otp || "").replace(/\s/g, "");
    const tenantPayload = buildTenantPayload(tenantId || organisation);
    if (!email) return fail("Enter your email address.");
    if (!tenantPayload.tenantId && !tenantPayload.tenantCode) {
      return fail("Enter your organisation name or code.");
    }
    if (!/^\d{6}$/.test(cleanOtp)) {
      return fail("Enter the 6-digit OTP code.");
    }
    return run(
      () =>
        apiFetch("/api/eip/auth/verify-otp", {
          method: "POST",
          body: { ...tenantPayload, email, otp: cleanOtp },
        }),
      "OTP verified. Session established."
    );
  }

  async function loginTotp({ tenantId, organisation, email, password, totp }) {
    const cleanTotp = String(totp || "").replace(/\s/g, "");
    const tenantPayload = buildTenantPayload(tenantId || organisation);
    if (!email) return fail("Enter your email address.");
    if (!password) return fail("Enter your password.");
    if (!tenantPayload.tenantId && !tenantPayload.tenantCode) {
      return fail("Enter your organisation name or code.");
    }
    if (!/^\d{6}$/.test(cleanTotp)) {
      return fail("Enter the 6-digit TOTP code.");
    }
    return run(
      () =>
        apiFetch("/api/eip/auth/totp/login", {
          method: "POST",
          body: { ...tenantPayload, email, password, token: cleanTotp },
        }),
      "TOTP verified. Session established."
    );
  }

  async function passwordLogin({ tenantId, organisation, email, password }) {
    const tenantPayload = buildTenantPayload(tenantId || organisation);
    if (!email) return fail("Enter your email address.");
    if (!password) return fail("Enter your password.");
    if (!tenantPayload.tenantId && !tenantPayload.tenantCode) {
      return fail("Enter your organisation name or code.");
    }
    return run(
      () =>
        apiFetch("/api/eip/auth/login", {
          method: "POST",
          body: { ...tenantPayload, email, password },
        }),
      "Logged in on trusted device."
    );
  }

  async function enrollTotp({ tenantId, organisation, email, password } = {}) {
    const tenantPayload = buildTenantPayload(tenantId || organisation);
    const login = String(email || "").trim().toLowerCase();
    const passwordValue = typeof password === "string" ? password : String(password || "");
    const canBootstrap =
      Boolean(login) &&
      Boolean(passwordValue) &&
      (tenantPayload.tenantId || tenantPayload.tenantCode);
    if (passwordValue && !login) return fail("Enter your email address.");
    if (passwordValue && !(tenantPayload.tenantId || tenantPayload.tenantCode)) {
      return fail("Enter your organisation name or code.");
    }

    const result = await run(
      () =>
        apiFetch(canBootstrap ? "/api/eip/auth/totp/bootstrap" : "/api/eip/auth/totp/enroll", {
          method: "POST",
          body: canBootstrap ? { ...tenantPayload, email: login, password: passwordValue } : {},
        }),
      "TOTP enrollment ready."
    );
    if (result?.secret && result?.uri) {
      setEnrollment({ secret: result.secret, uri: result.uri });
    }
    return result;
  }

  async function confirmTotp({ token, tenantId, organisation, email, password } = {}) {
    const clean = String(token || "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(clean)) {
      return fail("Enter the 6-digit TOTP code.");
    }
    const tenantPayload = buildTenantPayload(tenantId || organisation);
    const login = String(email || "").trim().toLowerCase();
    const passwordValue = typeof password === "string" ? password : String(password || "");
    const canBootstrap =
      Boolean(login) &&
      Boolean(passwordValue) &&
      (tenantPayload.tenantId || tenantPayload.tenantCode);
    if (passwordValue && !login) return fail("Enter your email address.");
    if (passwordValue && !(tenantPayload.tenantId || tenantPayload.tenantCode)) {
      return fail("Enter your organisation name or code.");
    }
    return run(
      () =>
        apiFetch(canBootstrap ? "/api/eip/auth/totp/confirm-setup" : "/api/eip/auth/totp/confirm", {
          method: "POST",
          body: canBootstrap
            ? { ...tenantPayload, email: login, password: passwordValue, token: clean }
            : { token: clean },
        }),
      "TOTP confirmed."
    );
  }

  async function requestAccess(payload) {
    if (!payload?.acceptTerms || !payload?.acceptPrivacy) {
      return fail("Please accept the terms and privacy policy.");
    }
    return run(
      () =>
        apiFetch("/api/public/tenant-requests", {
          method: "POST",
          body: payload,
        }),
      "Request submitted. We'll contact you shortly."
    );
  }

  async function requestPasswordReset({ tenantId, organisation, email }) {
    const tenantPayload = buildTenantPayload(tenantId || organisation);
    const login = String(email || "").trim().toLowerCase();
    if (!login) return fail("Enter your email address.");
    if (!tenantPayload.tenantId && !tenantPayload.tenantCode) {
      return fail("Enter your organisation name or code.");
    }
    return run(
      () =>
        apiFetch("/api/eip/auth/password/forgot", {
          method: "POST",
          body: { ...tenantPayload, email: login },
        }),
      "If the account exists, a reset link was sent."
    );
  }

  async function confirmPasswordReset({ token, password, confirmPassword }) {
    const cleanToken = String(token || "").trim();
    const passwordValue = typeof password === "string" ? password : String(password || "");
    const confirmValue = typeof confirmPassword === "string" ? confirmPassword : String(confirmPassword || "");
    if (!cleanToken) return fail("Reset link is missing.");
    if (!passwordValue) return fail("Enter your new password.");
    if (passwordValue !== confirmValue) return fail("Passwords do not match.");
    return run(
      () =>
        apiFetch("/api/eip/auth/password/reset", {
          method: "POST",
          body: { token: cleanToken, password: passwordValue },
        }),
      "Password updated. You can sign in now."
    );
  }

  async function requestRecovery({ tenantId, organisation, email, password, totp, totpLost }) {
    const tenantPayload = buildTenantPayload(tenantId || organisation);
    const login = String(email || "").trim().toLowerCase();
    const passwordValue = typeof password === "string" ? password : String(password || "");
    const token = String(totp || "").replace(/\s/g, "");
    if (!login) return fail("Enter your email address.");
    if (!passwordValue) return fail("Enter your password.");
    if (!tenantPayload.tenantId && !tenantPayload.tenantCode) {
      return fail("Enter your organisation name or code.");
    }
    if (totpLost) {
      return requestRecoveryLost({ tenantId, organisation, email: login, reason: "totp_lost" });
    }
    return run(
      () =>
        apiFetch("/api/eip/auth/recovery/request", {
          method: "POST",
          body: { ...tenantPayload, email: login, password: passwordValue, totp: token || undefined },
        }),
      "If eligible, a recovery link was sent."
    );
  }

  async function requestRecoveryLost({ tenantId, organisation, email, reason }) {
    const tenantPayload = buildTenantPayload(tenantId || organisation);
    const login = String(email || "").trim().toLowerCase();
    if (!login) return fail("Enter your email address.");
    if (!tenantPayload.tenantId && !tenantPayload.tenantCode) {
      return fail("Enter your organisation name or code.");
    }
    return run(
      () =>
        apiFetch("/api/eip/auth/recovery/request-lost", {
          method: "POST",
          body: { ...tenantPayload, email: login, reason },
        }),
      "Recovery request submitted for approval."
    );
  }

  async function consumeRecovery({ token }) {
    const cleanToken = String(token || "").trim();
    if (!cleanToken) return fail("Enter the recovery code.");
    return run(
      () =>
        apiFetch("/api/eip/auth/recovery/consume", {
          method: "POST",
          body: { token: cleanToken },
        }),
      "Recovery session established."
    );
  }

  async function resolveOrganisations({ email, password }) {
    const login = String(email || "").trim().toLowerCase();
    const passwordValue = typeof password === "string" ? password : String(password || "");
    if (!login) {
      setOrgStatus("Enter your email to load organisations.");
      return [];
    }
    try {
      const result = await run(
        () =>
          apiFetch("/api/eip/auth/organisations", {
            method: "POST",
            body: { email: login, password: passwordValue || undefined },
          }),
        null
      );
      const list = Array.isArray(result?.organisations) ? result.organisations : [];
      setOrganisations(list);
      setOrgStatus(list.length ? `Found ${list.length} organisation${list.length > 1 ? "s" : ""}.` : "No organisations found.");
      return list;
    } catch {
      setOrganisations([]);
      setOrgStatus("Unable to load organisations.");
      return [];
    }
  }

  return {
    status,
    orgStatus,
    organisations,
    loading,
    enrollment,
    requestOtp,
    verifyOtp,
    passwordLogin,
    enrollTotp,
    confirmTotp,
    requestAccess,
    requestPasswordReset,
    confirmPasswordReset,
    requestRecovery,
    requestRecoveryLost,
    consumeRecovery,
    resolveOrganisations,
    loginTotp,
    clearOrganisations: () => {
      setOrganisations([]);
      setOrgStatus(null);
    },
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildTenantPayload(raw) {
  const value = String(raw || "").trim();
  if (!value) return {};
  if (UUID_RE.test(value)) {
    return { tenantId: value };
  }
  return { tenantCode: value };
}
