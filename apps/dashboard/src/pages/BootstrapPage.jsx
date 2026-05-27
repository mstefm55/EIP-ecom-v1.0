import { useEffect, useMemo, useState } from "react";
import AuthTotpCard from "../components/auth/AuthTotpCard.jsx";
import { apiFetch } from "../services/apiClient";
import "../App.css";

function parseApiErrorCode(error) {
  const message = String(error?.message || "");
  const match = message.match(/"error"\s*:\s*"([A-Z0-9_]+)"/i);
  return match?.[1] || "";
}

function parseApiErrorPayload(error) {
  const message = String(error?.message || "");
  const match = message.match(/API \d+:\s*(\{.*\})/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function friendlyBootstrapError(error) {
  const code = parseApiErrorCode(error);
  const map = {
    INVALID_TOKEN: "This bootstrap link is invalid.",
    TOKEN_EXPIRED: "This bootstrap link has expired. Please request a new approval link.",
    TOKEN_USED: "This bootstrap link has already been used.",
    INVALID_STATUS: "This tenant request is not waiting for bootstrap.",
    DEVICE_REVOKED: "This device has been revoked and cannot be used for bootstrap.",
    BOOTSTRAP_INCOMPLETE: "Complete all required setup steps before finishing.",
    AGREEMENTS_REQUIRED: "Please accept the required agreements before finishing.",
    PASSWORD_WEAK: "Choose a stronger password.",
    WEAK_PASSWORD: "Choose a stronger password.",
    PASSWORD_REUSE_NOT_ALLOWED: "You cannot reuse a recent password.",
    INVALID_TOTP: "Invalid TOTP code. Please try again.",
    TOTP_NOT_FOUND: "Start TOTP enrollment before confirming the code.",
    TOTP_UNAVAILABLE: "TOTP setup is temporarily unavailable.",
    CSRF_MISSING: "Security token missing. Refresh and try again.",
    CSRF_INVALID: "Security token expired. Refresh and try again.",
  };
  return map[code] || error?.message || "Bootstrap failed.";
}

function removeBootstrapTokenFromUrl() {
  window.history.replaceState({}, "", `${window.location.origin}${window.location.pathname}`);
}

function statusBadge(done) {
  return done ? "Done" : "Required";
}

function mergeSteps(current, next) {
  if (!next || typeof next !== "object") return current;
  return { ...(current || {}), ...next };
}

export default function BootstrapPage() {
  const [phase, setPhase] = useState("checking");
  const [message, setMessage] = useState("Checking secure bootstrap link...");
  const [steps, setSteps] = useState(null);
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpEnrollment, setTotpEnrollment] = useState(null);
  const [agreements, setAgreements] = useState([]);
  const [acceptedAgreements, setAcceptedAgreements] = useState({});
  const [busy, setBusy] = useState(false);

  const allAgreementsAccepted = agreements.length === 0 || agreements.every((item) => {
    const key = `${item.code}:${item.version}`;
    return acceptedAgreements[key] === true;
  });

  const updateSteps = (nextSteps) => {
    if (nextSteps && typeof nextSteps === "object") {
      setSteps((prev) => mergeSteps(prev, nextSteps));
    }
  };

  const refreshChecklist = async () => {
    try {
      const who = await apiFetch("/api/eip/auth/whoami");
      updateSteps(who?.bootstrap?.steps);
      return who;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let active = true;

    async function consumeMagicLink() {
      const params = new URLSearchParams(window.location.search);
      const token = String(params.get("token") || "").trim();
      if (!token) {
        setPhase("manual");
        setMessage("Paste a valid bootstrap link or request a new approval email.");
        return;
      }

      try {
        setBusy(true);
        const result = await apiFetch("/api/eip/bootstrap/consume", {
          method: "POST",
          body: { token },
        });
        if (!active) return;
        updateSteps(result?.steps);
        removeBootstrapTokenFromUrl();
        setPhase("setup");
        setMessage("Secure bootstrap session started. Complete the required setup steps.");
      } catch (error) {
        if (!active) return;
        setPhase("error");
        setMessage(friendlyBootstrapError(error));
      } finally {
        if (active) setBusy(false);
      }
    }

    consumeMagicLink();
    return () => {
      active = false;
    };
  }, []);

  const runStep = async (action, successMessage, localStepPatch = null) => {
    try {
      setBusy(true);
      const result = await action();
      updateSteps(result?.steps);
      if (localStepPatch) updateSteps(localStepPatch);
      await refreshChecklist();
      setMessage(successMessage);
      setPhase("setup");
      return result;
    } catch (error) {
      const payload = parseApiErrorPayload(error);
      updateSteps(payload?.steps);
      if (Array.isArray(payload?.missing) && payload.missing.length > 0) {
        setAgreements(payload.missing);
        setPhase("agreements");
      }
      setMessage(friendlyBootstrapError(error));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const setPasswordStep = () => {
    const value = String(password || "");
    if (value.length < 12) {
      setMessage("Use a stronger password with at least 12 characters.");
      return null;
    }
    return runStep(
      () => apiFetch("/api/eip/bootstrap/password", { method: "POST", body: { password: value } }),
      "Password set.",
      { passwordSet: true }
    );
  };

  const enrollTotpStep = async () => {
    try {
      setBusy(true);
      const result = await apiFetch("/api/eip/bootstrap/totp/enroll", { method: "POST", body: {} });
      if (result?.secret || result?.uri) {
        setTotpEnrollment(result);
        setMessage("Scan the QR code with your authenticator app, then enter the 6-digit code to activate TOTP.");
      } else {
        setMessage("TOTP setup started, but no QR payload was returned. Please try again.");
      }
      return result;
    } catch (error) {
      setMessage(friendlyBootstrapError(error));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const confirmTotpStep = () => {
    const clean = String(totpCode || "").replace(/\s/g, "");
    if (!totpEnrollment) {
      setMessage("Generate the QR code before confirming TOTP.");
      return null;
    }
    if (!/^\d{6}$/.test(clean)) {
      setMessage("Enter the 6-digit TOTP code from your authenticator.");
      return null;
    }
    return runStep(
      () => apiFetch("/api/eip/bootstrap/totp/confirm", { method: "POST", body: { token: clean } }),
      "TOTP enabled.",
      { totpEnabled: true }
    );
  };

  const trustDeviceStep = () => runStep(
    () => apiFetch("/api/eip/bootstrap/device/trust", { method: "POST", body: {} }),
    "This device is now trusted for the tenant admin.",
    { deviceTrusted: true }
  );

  const acceptAgreementsStep = () => {
    if (!allAgreementsAccepted) {
      setMessage("Accept all required agreements before continuing.");
      return null;
    }
    return runStep(
      () => apiFetch("/api/eip/bootstrap/agreements/accept", {
        method: "POST",
        body: { agreements },
      }),
      "Required agreements accepted."
    );
  };

  const completeStep = async () => {
    try {
      setBusy(true);
      await apiFetch("/api/eip/bootstrap/complete", { method: "POST", body: {} });
      setPhase("complete");
      setMessage("Bootstrap complete. Sign in with the admin account you just configured.");
      window.history.replaceState({}, "", `${window.location.origin}${window.location.pathname}?surface=auth`);
    } catch (error) {
      const payload = parseApiErrorPayload(error);
      updateSteps(payload?.steps);
      if (Array.isArray(payload?.missing) && payload.missing.length > 0) {
        setAgreements(payload.missing);
        setPhase("agreements");
      }
      setMessage(friendlyBootstrapError(error));
    } finally {
      setBusy(false);
    }
  };

  const totpCtx = useMemo(() => ({
    totp: {
      enrollment: totpEnrollment,
      code: totpCode,
      setCode: setTotpCode,
      enroll: enrollTotpStep,
      confirm: confirmTotpStep,
    },
  }), [totpEnrollment, totpCode, busy]);

  const totpNode = useMemo(() => ({
    props: {
      title: "Authenticator setup",
      subtitle: "Generate the QR code, scan it with your authenticator app, then confirm with a 6-digit code.",
      issuer: "EIP Core",
      account: "Tenant admin",
      verifyAction: "Activate TOTP",
      backupAction: "Generate QR code",
      embedded: true,
      hideCredentials: true,
      startFirst: true,
      loading: busy,
    },
  }), [busy]);

  return (
    <main className="min-h-screen bg-auth-aurora px-6 py-10 text-ink-900">
      <section className="mx-auto max-w-3xl rounded-3xl border border-white/70 bg-white/85 p-8 shadow-strong backdrop-blur-xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">EIP Core</p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">Tenant bootstrap</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">{message}</p>
        </div>

        {phase === "checking" && (
          <div className="rounded-2xl border border-ink-100 bg-white p-5 text-sm text-ink-600">
            Starting secure bootstrap session...
          </div>
        )}

        {phase === "manual" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            This page expects a one-time bootstrap magic link. Ask an EIP administrator to resend the bootstrap link if it is missing or expired.
          </div>
        )}

        {phase === "error" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            {message}
          </div>
        )}

        {(phase === "setup" || phase === "agreements") && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <StatusCard label="Password" value={statusBadge(steps?.passwordSet)} />
              <StatusCard label="TOTP" value={statusBadge(steps?.totpEnabled)} />
              <StatusCard label="Device trust" value={statusBadge(steps?.deviceTrusted)} />
            </div>

            {!steps?.passwordSet && (
              <div className="rounded-2xl border border-ink-100 bg-white p-5">
                <h2 className="text-lg font-semibold">1. Set admin password</h2>
                <p className="mt-1 text-sm text-ink-600">Use a strong password. This creates the first tenant admin credential.</p>
                <input
                  className="mt-4 w-full rounded-xl border border-ink-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-400"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="New admin password"
                  autoComplete="new-password"
                />
                <button className="mt-4 rounded-xl bg-ink-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" onClick={setPasswordStep} disabled={busy}>Set password</button>
              </div>
            )}

            {!steps?.totpEnabled && (
              <div className="rounded-2xl border border-ink-100 bg-white p-5">
                <h2 className="text-lg font-semibold">2. Enable TOTP</h2>
                <p className="mt-1 text-sm text-ink-600">Register an authenticator app for secure step-up access.</p>
                <AuthTotpCard node={totpNode} ctx={totpCtx} />
              </div>
            )}

            {!steps?.deviceTrusted && (
              <div className="rounded-2xl border border-ink-100 bg-white p-5">
                <h2 className="text-lg font-semibold">3. Trust this device</h2>
                <p className="mt-1 text-sm text-ink-600">Trust the current browser/device for the initial tenant admin.</p>
                <button className="mt-4 rounded-xl bg-ink-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" onClick={trustDeviceStep} disabled={busy}>Trust device</button>
              </div>
            )}

            {phase === "agreements" && agreements.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h2 className="text-lg font-semibold">4. Required agreements</h2>
                <p className="mt-1 text-sm text-amber-900">Accept the required tenant agreements before completion.</p>
                <div className="mt-4 space-y-2">
                  {agreements.map((item) => {
                    const key = `${item.code}:${item.version}`;
                    return (
                      <label key={key} className="flex items-center gap-3 rounded-xl bg-white/80 p-3 text-sm">
                        <input
                          type="checkbox"
                          checked={acceptedAgreements[key] === true}
                          onChange={(event) => setAcceptedAgreements((prev) => ({ ...prev, [key]: event.target.checked }))}
                        />
                        <span>I accept {item.code} version {item.version}</span>
                      </label>
                    );
                  })}
                </div>
                <button className="mt-4 rounded-xl bg-ink-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" onClick={acceptAgreementsStep} disabled={busy || !allAgreementsAccepted}>Accept agreements</button>
              </div>
            )}

            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
              <h2 className="text-lg font-semibold">Finish bootstrap</h2>
              <p className="mt-1 text-sm text-ink-600">The backend activates the tenant only after all required bootstrap checks pass.</p>
              <button className="mt-4 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" onClick={completeStep} disabled={busy}>Complete bootstrap</button>
            </div>
          </div>
        )}

        {phase === "complete" && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-900">
            Bootstrap is complete. You can now sign in from the normal EIP access page.
          </div>
        )}
      </section>
    </main>
  );
}

function StatusCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
