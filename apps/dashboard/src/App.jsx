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

export default function App() {
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
  const [surfaceCode, setSurfaceCode] = useState(readSurfaceCodeFromUrl);
  const [surfaceAccess, setSurfaceAccess] = useState(null);
  const [surfaceAccessLoading, setSurfaceAccessLoading] = useState(() => readSurfaceCodeFromUrl() !== "auth");
  const [dataStore, setDataStore] = useState({});
  const [resetReady, setResetReady] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const surfaceLoaderEnabled =
    surfaceCode === "auth" ||
    (!surfaceAccessLoading && isSurfaceAllowedByAccess(surfaceCode, surfaceAccess));

  const fallbackSurface =
    !surfaceLoaderEnabled
      ? null
      : surfaceCode === "admin"
      ? adminSurface
      : surfaceCode === "dashboard"
        ? dashboardSurface
        : authSurface;
  const surfaceState = useSurfaceLoader(surfaceLoaderEnabled ? surfaceCode : null, fallbackSurface);

  const applySurfaceCode = (code) => {
    const next = normalizeSurfaceCode(code);
    if (next === "auth") {
      setSurfaceAccess(null);
    }
    setSurfaceCode(next);
    const url = new URL(window.location.href);
    url.searchParams.set("surface", next);
    window.history.replaceState({}, "", url);
  };

  const redirectToSurface = (code) => {
    const requested = normalizeSurfaceCode(code || "dashboard");
    const next =
      surfaceAccess && requested !== "auth" && !isSurfaceAllowedByAccess(requested, surfaceAccess)
        ? chooseDefaultSurface(surfaceAccess)
        : requested;
    applySurfaceCode(next);
  };

  const resolvePostAuthSurface = async () => {
    try {
      const who = await apiFetch("/api/eip/auth/whoami");
      setSurfaceAccess(who);
      setSurfaceAccessLoading(false);
      return chooseDefaultSurface(who);
    } catch {
      setSurfaceAccess(null);
      setSurfaceAccessLoading(false);
      return "auth";
    }
  };

  const redirectAfterAuth = async () => {
    const target = await resolvePostAuthSurface();
    redirectToSurface(target);
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

    async function resolveSurfaceAccess() {
      if (surfaceCode === "auth") {
        setSurfaceAccessLoading(false);
        return;
      }

      setSurfaceAccessLoading(true);
      try {
        const who = await apiFetch("/api/eip/auth/whoami");
        if (!active) return;
        setSurfaceAccess(who);
        const next = isSurfaceAllowedByAccess(surfaceCode, who)
          ? surfaceCode
          : chooseDefaultSurface(who);
        if (next !== surfaceCode) {
          applySurfaceCode(next);
        }
      } catch {
        if (!active) return;
        setSurfaceAccess(null);
        applySurfaceCode("auth");
      } finally {
        if (active) setSurfaceAccessLoading(false);
      }
    }

    resolveSurfaceAccess();
    return () => {
      active = false;
    };
  }, [surfaceCode]);

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
        loading: surfaceState.loading,
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
    <EngineRenderer surface={surfaceState.surface} registry={registry} ctx={engineCtx} />
  );
}
