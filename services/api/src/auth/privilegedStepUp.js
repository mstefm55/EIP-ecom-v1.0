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
    return { phishingResistant: app.config.REQUIRE_PASSKEY_FOR_PRIVILEGED_ACTIONS === true };
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
    phishingResistant:
      shouldRequirePhishingResistantStepUp(app.config, surfaceAccess) ||
      (
        isProduction(app.config) &&
        app.config.OWNER_ADMIN_PASSKEY_STEP_UP_REQUIRED !== false &&
        surfaceAccessFailed
      ),
    ownerAdmin: surfaceAccess?.is_owner_admin_session === true
  };
}

async function requirePrivilegedStepUp(app, req) {
  const policy = await resolvePrivilegedStepUpPolicy(app, req);
  const step = await app.requireStepUp(req, {
    phishingResistant: policy.phishingResistant === true
  });
  return { ...step, policy };
}

export {
  requirePrivilegedStepUp,
  resolvePrivilegedStepUpPolicy,
  shouldRequirePhishingResistantStepUp
};
