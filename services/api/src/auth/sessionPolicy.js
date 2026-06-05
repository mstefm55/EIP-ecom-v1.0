function normalizeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function buildStepUpAttrs(method, extra = {}) {
  const normalized = String(method || "").trim().toLowerCase() || "unknown";
  const phishingResistant = normalized === "passkey" || extra.phishing_resistant === true;
  return {
    step_up_at: new Date().toISOString(),
    step_up_method: normalized,
    step_up_phishing_resistant: phishingResistant,
    assurance: phishingResistant ? "phishing_resistant" : "high"
  };
}

function evaluateStepUp(session, opts = {}) {
  if (!session) return { ok: false, status: 401, error: "UNAUTHENTICATED" };

  const attrs = session.attrs || {};
  const stepAt = attrs.step_up_at;
  if (!stepAt) return { ok: false, status: 403, error: "STEP_UP_REQUIRED" };

  const stepMs = new Date(stepAt).getTime();
  if (!Number.isFinite(stepMs)) {
    return { ok: false, status: 403, error: "STEP_UP_REQUIRED" };
  }

  const ttlMin = normalizeNumber(opts.ttlMin, 5);
  const nowMs = Number.isFinite(Number(opts.nowMs)) ? Number(opts.nowMs) : Date.now();
  if (nowMs - stepMs > ttlMin * 60 * 1000) {
    return { ok: false, status: 403, error: "STEP_UP_REQUIRED" };
  }

  if (opts.phishingResistant === true && attrs.step_up_phishing_resistant !== true) {
    return { ok: false, status: 403, error: "PASSKEY_STEP_UP_REQUIRED" };
  }

  return {
    ok: true,
    method: attrs.step_up_method || "legacy",
    phishing_resistant: attrs.step_up_phishing_resistant === true
  };
}

function sessionTouchIntervalMs(idleTtlMin) {
  const idleMs = normalizeNumber(idleTtlMin, 0) * 60 * 1000;
  if (!idleMs) return 0;
  const minimum = 30 * 1000;
  const maximum = 5 * 60 * 1000;
  return Math.min(maximum, Math.max(minimum, Math.floor(idleMs / 3)));
}

export { buildStepUpAttrs, evaluateStepUp, sessionTouchIntervalMs };
