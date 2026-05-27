import { resolveEipSurfaceAccess } from "../lib/surfaceAccess.js";

function isProduction(config = {}) {
  return String(config.NODE_ENV || "").toLowerCase() === "production";
}

function shouldRequirePhishingResistantStepUp(config = {}, surfaceAccess = {}) {
  if (config.REQUIRE_PASSKEY_FOR_PRIVILEGED_ACTIONS === true) return true;
  if (
    isProduction(config) &&
    config.OWNER_ADMIN_PASSKEY_STEP_UP_REQUIRED !== false &&
    surfaceAccess?.is_owner_admin_session === true
  ) {
    return true;
  }
  return false;
}

async function resolvePrivilegedStepUpPolicy(app, req) {
  const session = req?.session || (typeof app.loadSession === "function" ? await app.loadSession(req) : null);
  if (!session || String(session.realm || "EIP") !== "EIP") {
    return {
      anyMethodAllowed: true,
      configuredPhishingResistantPreference: app.config.REQUIRE_PASSKEY_FOR_PRIVILEGED_ACTIONS === true,
      enforcedPhishingResistant: false,
      ownerAdmin: false,
      availableMethods: ["otp", "totp", "passkey"]
    };
  }

  let surfaceAccess = req?._eipSurfaceAccess || null;
  let surfaceAccessFailed = false;
  try {
    if (!surfaceAccess) surfaceAccess = await resolveEipSurfaceAccess(app, session);
  } catch (error) {
    surfaceAccessFailed = true;
    app.log?.warn?.({
      event: "privileged_step_up_surface_check_failed",
      tenantId: session.tenant_id,
      identityId: session.identity_id,
      error: error?.message
    });
  }

  return {
    anyMethodAllowed: true,
    configuredPhishingResistantPreference:
      shouldRequirePhishingResistantStepUp(app.config, surfaceAccess) ||
      (
        isProduction(app.config) &&
        app.config.OWNER_ADMIN_PASSKEY_STEP_UP_REQUIRED !== false &&
        surfaceAccessFailed
      ),
    enforcedPhishingResistant: false,
    ownerAdmin: surfaceAccess?.is_owner_admin_session === true,
    availableMethods: ["otp", "totp", "passkey"]
  };
}

async function requirePrivilegedStepUp(app, req, opts = {}) {
  const policy = await resolvePrivilegedStepUpPolicy(app, req);

  // EIP V1 policy: privileged actions require one fresh high-assurance step-up.
  // OTP, TOTP, and passkey are alternative methods. Do not chain OTP -> passkey.
  // Passkey-only enforcement must be requested explicitly by a specific route via
  // opts.passkeyOnly; it must not be inferred globally from owner/admin status.
  const enforcePasskeyOnly = opts.passkeyOnly === true;
  const step = await app.requireStepUp(req, {
    ttlMin: opts.ttlMin,
    phishingResistant: enforcePasskeyOnly
  });

  if (!step.ok && (step.error === "STEP_UP_REQUIRED" || step.error === "PASSKEY_STEP_UP_REQUIRED")) {
    return {
      ...step,
      error: enforcePasskeyOnly ? step.error : "STEP_UP_REQUIRED",
      availableMethods: enforcePasskeyOnly ? ["passkey"] : policy.availableMethods,
      policy: { ...policy, enforcedPhishingResistant: enforcePasskeyOnly, anyMethodAllowed: !enforcePasskeyOnly }
    };
  }

  return {
    ...step,
    policy: { ...policy, enforcedPhishingResistant: enforcePasskeyOnly, anyMethodAllowed: !enforcePasskeyOnly }
  };
}

export {
  requirePrivilegedStepUp,
  resolvePrivilegedStepUpPolicy,
  shouldRequirePhishingResistantStepUp
};
