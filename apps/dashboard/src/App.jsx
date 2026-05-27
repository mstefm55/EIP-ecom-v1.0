import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { EngineRenderer } from "./engine/renderer";
import { registry } from "./engine/registry.jsx";
import { authSurface } from "./engine/surfaces/auth";
import { adminSurface } from "./engine/surfaces/admin";
import { dashboardSurface } from "./engine/surfaces/dashboard";
import { useAuthApi } from "./hooks/useAuthApi";
import { useSurfaceLoader } from "./hooks/useSurfaceLoader";
import { apiFetch } from "./services/apiClient";

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

function normalizeSurfaceCode(code) {
  const normalized = String(code || "").trim().toLowerCase();
  if (normalized === "admin" || normalized === "dashboard" || normalized === "auth") {
    return normalized;
  }
  return "auth";
}

function isBootstrapPath() {
  return window.location.pathname.replace(/\/+$/, "") === "/bootstrap";
}

function readSurfaceCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return normalizeSurfaceCode(params.get("surface") || "auth");
}

function chooseDefaultSurface(access) {
  const allowed = Array.isArray(access?.allowed_surfaces) ? access.allowed_surfaces : [];
  return normalizeSurfaceCode(access?.default_surface || allowed[0] || "auth");
}

function isSurfaceAllowedByAccess(code, access) {
  const normalized = normalizeSurfaceCode(code);
  if (normalized === "auth") return true;
  const allowed = Array.isArray(access?.allowed_surfaces) ? access.allowed_surfaces : [];
  return allowed.map(normalizeSurfaceCode).includes(normalized);
}

function BootstrapPage() {
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
    if (nextSteps) setSteps(nextSteps);
  };

  const friendlyBootstrapError = (error) => {
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
      INVALID_TOTP: "Invalid TOTP code. Please try again.",
      TOTP_NOT_FOUND: "Start TOTP enrollment before confirming the code.",
      TOTP_UNAVAILABLE: "TOTP setup is temporarily unavailable.",
      CSRF_MISSING: "Security token missing. Refresh and try again.",
      CSRF_INVALID: "Security token expired. Refresh and try again.",
    };
    return map[code] || error?.message || "Bootstrap failed.";
  };

  const refreshChecklist = async () => {
    try {
      const who = await apiFetch("/api/eip/auth/whoami");
      if (who?.bootstrap?.steps) updateSteps(who.bootstrap.steps);
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
        const cleanUrl = `${window.location.origin}${window.location.pathname}`;
        window.history.replaceState({}, "", cleanUrl);
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

  const runStep = async (action, successMessage) => {
    try {
      setBusy(true);
      const result = await action();
      updateSteps(result?.steps);
      await refreshChecklist();
      setMessage(successMessage);
      setPhase("setup");
      return result;
    } catch (error) {
      const payload = parseApiErrorPayload(error);
      if (payload?.steps) updateSteps(payload.steps);
      if (payload?.missing) {
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
      return;
    }
    return runStep(
      () => apiFetch("/api/eip/bootstrap/password", { method: "POST", body: { password: value } }),
      "Password set."
    );
  };

  const enrollTotpStep = async () => {
    const result = await runStep(
      () => apiFetch("/api/eip/bootstrap/totp/enroll", { method: "POST", body: {} }),
      "TOTP enrollment started. Add the secret to your authenticator, then confirm the code."
    );
    if (result?.secret || result?.uri) setTotpEnrollment(result);
  };

  const confirmTotpStep = () => {
    const clean = String(totpCode || "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(clean)) {
      setMessage("Enter the 6-digit TOTP code from your authenticator.");
      return;
    }
    return runStep(
      () => apiFetch("/api/eip/bootstrap/totp/confirm", { method: "POST", body: { token: clean } }),
      "TOTP enabled."
    );
  };

  const trustDeviceStep = () => runStep(
    () => apiFetch("/api/eip/bootstrap/device/trust", { method: "POST", body: {} }),
    "This device is now trusted for the tenant admin."
  );

  const acceptAgreementsStep = () => {
    if (!allAgreementsAccepted) {
      setMessage("Accept all required agreements before continuing.");
      return;
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
      if (payload?.steps) updateSteps(payload.steps);
      if (payload?.missing) {
        setAgreements(payload.missing);
        setPhase("agreements");
      }
      setMessage(friendlyBootstrapError(error));
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = (done) => done ? "Done" : "Required";

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
            This page expects a one-time bootstrap magic link. Ask an EIP administrator to approve the tenant request again if the link is missing or expired.
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
              <div className="rounded-2xl border border-ink-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Password</p>
                <p className="mt-2 text-lg font-semibold">{statusBadge(steps?.passwordSet)}</p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">TOTP</p>
                <p className="mt-2 text-lg font-semibold">{statusBadge(steps?.totpEnabled)}</p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Device trust</p>
                <p className="mt-2 text-lg font-semibold">{statusBadge(steps?.deviceTrusted)}</p>
              </div>
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
                <button className="mt-4 rounded-xl bg-ink-900 px-5 py-3 text-sm font-semibold text-white" onClick={setPasswordStep} disabled={busy}>Set password</button>
              </div>
            )}

            {!steps?.totpEnabled && (
              <div className="rounded-2xl border border-ink-100 bg-white p-5">
                <h2 className="text-lg font-semibold">2. Enable TOTP</h2>
                <p className="mt-1 text-sm text-ink-600">Register an authenticator app for secure step-up access.</p>
                {!totpEnrollment ? (
                  <button className="mt-4 rounded-xl bg-ink-900 px-5 py-3 text-sm font-semibold text-white" onClick={enrollTotpStep} disabled={busy}>Start TOTP setup</button>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-ink-100 bg-mist-50 p-4 text-sm">
                      <p className="font-semibold">Manual secret</p>
                      <p className="mt-2 break-all font-mono text-xs">{totpEnrollment.secret}</p>
                      {totpEnrollment.uri && <p className="mt-2 break-all text-xs text-ink-500">{totpEnrollment.uri}</p>}
                    </div>
                    <input
                      className="w-full rounded-xl border border-ink-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-400"
                      value={totpCode}
                      onChange={(event) => setTotpCode(event.target.value)}
                      placeholder="123 456"
                      inputMode="numeric"
                    />
                    <button className="rounded-xl bg-ink-900 px-5 py-3 text-sm font-semibold text-white" onClick={confirmTotpStep} disabled={busy}>Confirm TOTP</button>
                  </div>
                )}
              </div>
            )}

            {!steps?.deviceTrusted && (
              <div className="rounded-2xl border border-ink-100 bg-white p-5">
                <h2 className="text-lg font-semibold">3. Trust this device</h2>
                <p className="mt-1 text-sm text-ink-600">Trust the current browser/device for the initial tenant admin.</p>
                <button className="mt-4 rounded-xl bg-ink-900 px-5 py-3 text-sm font-semibold text-white" onClick={trustDeviceStep} disabled={busy}>Trust device</button>
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
                <button className="mt-4 rounded-xl bg-ink-900 px-5 py-3 text-sm font-semibold text-white" onClick={acceptAgreementsStep} disabled={busy || !allAgreementsAccepted}>Accept agreements</button>
              </div>
            )}

            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
              <h2 className="text-lg font-semibold">Finish bootstrap</h2>
              <p className="mt-1 text-sm text-ink-600">After all required steps are complete, activate the tenant and end the temporary bootstrap session.</p>
              <button className="mt-4 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white" onClick={completeStep} disabled={busy}>Complete bootstrap</button>
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

export default function App() {
  const initialUrlSurface = readSurfaceCodeFromUrl();
  const [modalId, setModalId] = useState(null);
  const [form, setForm] = useState({ organisation: "", email: "", password: "", totp: "", totpLost: false });
  const [otpCode, setOtpCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [adminTab, setAdminTab] = useState("dashboard");
  const [userTab, setUserTab] = useState("dashboard");
  const [requestForm, setRequestForm] = useState({
    applicantType: "business",
    legalName: "",
    businessRegNo: "",
    personalIdNo: "",
    email: "",
    phone: "",
    country: "",
    timezone: "",
    acceptTerms: false,
    acceptPrivacy: false,
    termsVersion: "v1",
    privacyVersion: "v1",
  });
  const [resetForm, setResetForm] = useState({ token: "", password: "", confirmPassword: "" });
  const [recoveryForm, setRecoveryForm] = useState({ token: "" });
  const authApi = useAuthApi();
  const [pendingSurfaceRequest, setPendingSurfaceRequest] = useState(initialUrlSurface);
  const [surfaceCode, setSurfaceCode] = useState(() => (initialUrlSurface === "auth" ? "auth" : null));
  const [surfaceAccess, setSurfaceAccess] = useState(null);
  const [surfaceAccessLoading, setSurfaceAccessLoading] = useState(initialUrlSurface !== "auth");
  const [dataStore, setDataStore] = useState({});
  const [resetReady, setResetReady] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const surfaceLoaderEnabled = Boolean(surfaceCode);

  if (isBootstrapPath()) {
    return <BootstrapPage />;
  }

  const fallbackSurface =
    !surfaceLoaderEnabled
      ? null
      : surfaceCode === "admin"
      ? adminSurface
      : surfaceCode === "dashboard"
        ? dashboardSurface
        : authSurface;
  const surfaceState = useSurfaceLoader(surfaceLoaderEnabled ? surfaceCode : null, fallbackSurface);
  const loadedSurfaceCode = normalizeSurfaceCode(surfaceState.surface?.code || surfaceState.surface?.id);
  const renderSurface = surfaceCode
    ? loadedSurfaceCode === surfaceCode
      ? surfaceState.surface
      : fallbackSurface
    : null;

  const writeSurfaceToUrl = (code) => {
    const next = normalizeSurfaceCode(code);
    const url = new URL(window.location.href);
    url.searchParams.set("surface", next);
    window.history.replaceState({}, "", url);
  };

  const renderCanonicalSurface = (code) => {
    const next = normalizeSurfaceCode(code);
    if (next === "auth") {
      setSurfaceAccess(null);
      setSurfaceAccessLoading(false);
    }
    setPendingSurfaceRequest(next);
    setSurfaceCode(next);
    writeSurfaceToUrl(next);
  };

  const redirectToSurface = (code) => {
    const requested = normalizeSurfaceCode(code || "dashboard");
    if (requested === "auth") {
      renderCanonicalSurface("auth");
      return;
    }

    const next =
      surfaceAccess && requested !== "auth" && !isSurfaceAllowedByAccess(requested, surfaceAccess)
        ? chooseDefaultSurface(surfaceAccess)
        : requested;
    if (surfaceAccess && isSurfaceAllowedByAccess(next, surfaceAccess)) {
      renderCanonicalSurface(next);
      return;
    }

    setPendingSurfaceRequest(next);
    setSurfaceCode(null);
    setSurfaceAccessLoading(true);
    writeSurfaceToUrl(next);
  };

  const resolvePostAuthSurface = async (requestedSurface = "dashboard") => {
    try {
      const who = await apiFetch("/api/eip/auth/whoami");
      setSurfaceAccess(who);
      setSurfaceAccessLoading(false);
      const requested = normalizeSurfaceCode(requestedSurface);
      return requested !== "auth" && isSurfaceAllowedByAccess(requested, who)
        ? requested
        : chooseDefaultSurface(who);
    } catch {
      setSurfaceAccess(null);
      setSurfaceAccessLoading(false);
      return "auth";
    }
  };

  const redirectAfterAuth = async () => {
    const target = await resolvePostAuthSurface(pendingSurfaceRequest);
    renderCanonicalSurface(target);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset");
    if (token) {
      setResetForm((prev) => ({ ...prev, token }));
      setModalId("reset-password-modal");
      setResetReady(true);
    }
    const recoveryToken = params.get("recovery");
    if (recoveryToken) {
      setRecoveryForm({ token: recoveryToken });
      setModalId("recovery-consume-modal");
      setRecoveryReady(true);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrapAuthenticatedSurface() {
      const requested = normalizeSurfaceCode(pendingSurfaceRequest);
      if (requested === "auth") {
        setSurfaceCode("auth");
        setSurfaceAccessLoading(false);
        return;
      }
      if (surfaceAccess && isSurfaceAllowedByAccess(requested, surfaceAccess)) {
        setSurfaceCode(requested);
        setSurfaceAccessLoading(false);
        writeSurfaceToUrl(requested);
        return;
      }

      setSurfaceAccessLoading(true);
      setSurfaceCode(null);
      try {
        const who = await apiFetch("/api/eip/auth/whoami");
        if (!active) return;
        setSurfaceAccess(who);
        const next = isSurfaceAllowedByAccess(requested, who)
          ? requested
          : chooseDefaultSurface(who);
        setSurfaceCode(next);
        setPendingSurfaceRequest(next);
        writeSurfaceToUrl(next);
      } catch {
        if (!active) return;
        setSurfaceAccess(null);
        setSurfaceCode("auth");
        setPendingSurfaceRequest("auth");
        writeSurfaceToUrl("auth");
      } finally {
        if (active) setSurfaceAccessLoading(false);
      }
    }

    bootstrapAuthenticatedSurface();
    return () => {
      active = false;
    };
  }, [pendingSurfaceRequest, surfaceAccess]);

  useEffect(() => {
    if (!surfaceState.error || surfaceCode === "auth") return;
    const errorCode = parseApiErrorCode(surfaceState.error);
    if (errorCode === "SURFACE_FORBIDDEN") {
      const payload = parseApiErrorPayload(surfaceState.error);
      redirectToSurface(payload?.default_surface || chooseDefaultSurface(surfaceAccess));
      return;
    }
    if (errorCode === "UNAUTHENTICATED" || errorCode === "WRONG_REALM") {
      redirectToSurface("auth");
    }
  }, [surfaceCode, surfaceState.error]);

  const engineCtx = useMemo(
    () => ({
      modal: {
        id: modalId,
        open: (id) => setModalId(id),
        close: () => setModalId(null),
      },
      surface: {
        code: surfaceCode,
        setCode: redirectToSurface,
        loading: surfaceAccessLoading || surfaceState.loading,
        error: surfaceState.error,
      },
      data: {
        store: dataStore,
        setData: (key, value) =>
          setDataStore((prev) => ({ ...prev, [key]: value })),
      },
      auth: {
        form,
        setField: (key, value) =>
          setForm((prev) => {
            if (key === "email") {
              authApi.clearOrganisations?.();
            }
            return { ...prev, [key]: value };
          }),
        status: authApi.status,
        orgStatus: authApi.orgStatus,
        organisations: authApi.organisations,
        resolveOrganisations: () =>
          authApi.resolveOrganisations({ email: form.email, password: form.password }),
        loading: authApi.loading,
        requestOtp: () => authApi.requestOtp(form),
        passwordLogin: async () => {
          const result = await authApi.passwordLogin(form);
          if (result?.ok) await redirectAfterAuth();
          return result;
        },
        verifyTotp: async () => {
          const result = await authApi.loginTotp({
            organisation: form.organisation,
            email: form.email,
            password: form.password,
            totp: form.totp,
          });
          if (result?.ok) await redirectAfterAuth();
          return result;
        },
        passkeyLogin: async () => {
          const result = await authApi.passkeyLogin({
            organisation: form.organisation,
            email: form.email,
          });
          if (result?.ok) await redirectAfterAuth();
          return result;
        },
        requestPasswordReset: () =>
          authApi.requestPasswordReset({
            organisation: form.organisation,
            email: form.email,
          }),
        requestRecovery: () =>
          authApi.requestRecovery({
            organisation: form.organisation,
            email: form.email,
            password: form.password,
            totp: form.totp,
            totpLost: form.totpLost,
          }),
      },
      admin: {
        activeTab: adminTab,
        setActiveTab: setAdminTab,
      },
      user: {
        activeTab: userTab,
        setActiveTab: setUserTab,
      },
      otp: {
        code: otpCode,
        setCode: setOtpCode,
        verify: async () => {
          const result = await authApi.verifyOtp({
            organisation: form.organisation,
            email: form.email,
            otp: otpCode,
          });
          setModalId(null);
          if (result?.ok) await redirectAfterAuth();
          return result;
        },
      },
      totp: {
        code: totpCode,
        setCode: setTotpCode,
        enrollment: authApi.enrollment,
        enroll: () =>
          authApi.enrollTotp({
            organisation: form.organisation,
            email: form.email,
            password: form.password,
          }),
        confirm: () =>
          authApi.confirmTotp({
            token: totpCode,
            organisation: form.organisation,
            email: form.email,
            password: form.password,
          }),
      },
      requestAccess: {
        form: requestForm,
        setField: (key, value) =>
          setRequestForm((prev) => ({ ...prev, [key]: value })),
        status: authApi.status,
        submit: () => authApi.requestAccess(requestForm),
      },
      reset: {
        form: resetForm,
        setField: (key, value) =>
          setResetForm((prev) => ({ ...prev, [key]: value })),
        status: authApi.status,
        submit: () => authApi.confirmPasswordReset(resetForm),
        ready: resetReady,
      },
      recovery: {
        form: recoveryForm,
        setField: (key, value) =>
          setRecoveryForm((prev) => ({ ...prev, [key]: value })),
        status: authApi.status,
        submit: async () => {
          const result = await authApi.consumeRecovery(recoveryForm);
          if (result?.ok) await redirectAfterAuth();
          return result;
        },
        ready: recoveryReady,
      },
    }),
    [
      modalId,
      form,
      otpCode,
      totpCode,
      authApi,
      surfaceCode,
      surfaceState,
      dataStore,
      requestForm,
      resetForm,
      resetReady,
      recoveryForm,
      recoveryReady,
    ]
  );

  return (
    <EngineRenderer surface={renderSurface} registry={registry} ctx={engineCtx} />
  );
}
