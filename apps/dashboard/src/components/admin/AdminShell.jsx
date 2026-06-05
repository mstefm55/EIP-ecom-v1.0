import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  LayoutGrid,
  ClipboardList,
  Users,
  Shield,
  FileClock,
  Activity,
  Plug,
  BarChart3,
  Briefcase,
  Copy,
  Settings,
  GitBranch,
  Database,
  ChevronDown,
  LogOut,
  UserCircle2,
  IdCard,
  Image,
  Pencil,
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";
import { runAction } from "../../engine/actions";
import { useIdleLogout } from "../../hooks/useIdleLogout";
import { useAuthApi } from "../../hooks/useAuthApi";
import SidebarNav from "../engine/SidebarNav";

const DEFAULT_MENU = [
  { code: "dashboard", label: "Dashboard", icon: "LayoutGrid" },
  { code: "tenant-requests", label: "Tenant Requests", icon: "ClipboardList" },
  { code: "processes", label: "Processes", icon: "GitBranch" },
  { code: "connections", label: "Connections", icon: "Plug" },
  { code: "tasks", label: "Tasks & Follow-up", icon: "Activity" },
  { code: "users", label: "Users & Roles", icon: "Users" },
  { code: "portfolios", label: "Portfolios", icon: "Briefcase" },
  { code: "templates", label: "Templates", icon: "Copy" },
  { code: "security", label: "Security", icon: "Shield" },
  { code: "audit", label: "Audit", icon: "FileClock" },
  { code: "data-explorer", label: "Data Explorer", icon: "Database" },
  { code: "integrations", label: "Integrations", icon: "Plug" },
  { code: "reports", label: "Reports", icon: "BarChart3" },
  { code: "settings", label: "Settings", icon: "Settings" },
];

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function resolveAssetUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${BASE_URL}${url}`;
}

export default function AdminShell({ node, children, ctx }) {
  const {
    brand = "EIP Core",
    nav = ["Tenant Requests", "Security", "Audit"],
    helper = "Admin control plane for tenant onboarding.",
    actionLabel,
    actionEvent,
    scale = 1,
    menu = DEFAULT_MENU,
  } = node.props || {};

  const [collapsed, setCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [user, setUser] = useState({ name: "Admin", email: "", tenantId: "" });
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpStage, setStepUpStage] = useState("request");
  const [stepUpForm, setStepUpForm] = useState({ password: "", otp: "" });
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    display_name: "",
    title: "",
    phone: "",
    locale: "",
    timezone: "",
    avatar_url: "",
    avatar_display_url: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const { status: stepUpStatus, requestOtp, verifyOtp, loading: stepUpLoading } = useAuthApi();

  const activeTab = ctx?.admin?.activeTab || "tenant-requests";
  const setActiveTab = ctx?.admin?.setActiveTab;

  const [header, ...panels] = children || [];

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const result = await apiFetch("/api/eip/auth/whoami");
        if (!active) return;
        const email = result?.login || "";
        const name = email ? email.split("@")[0] : "Admin";
        setUser({ name, email, tenantId: result?.tenant_id || "" });
      } catch (err) {
        if (!active) return;
        const message = err.message || "";
        if (message.includes("UNAUTHENTICATED")) {
          ctx?.surface?.setCode?.("auth");
          const url = new URL(window.location.href);
          url.searchParams.set("surface", "auth");
          window.history.replaceState({}, "", url);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [ctx]);

  const scaleStyle = useMemo(() => {
    const value = Number(scale);
    if (!Number.isFinite(value) || value === 1) return undefined;
    return {
      transform: `scale(${value})`,
      transformOrigin: "top left",
      width: `${100 / value}%`,
    };
  }, [scale]);

  const contentOffset = collapsed ? "6.75rem" : "19.5rem";

  const tabs = useMemo(
    () =>
      nav.map((item) => ({
        code: item.toLowerCase().replace(/\s+/g, "-"),
        label: item,
      })),
    [nav]
  );

  const initial = (user.name || "E")[0]?.toUpperCase();
  const profileAvatarSrc = resolveAssetUrl(profileForm.avatar_display_url || profileForm.avatar_url);

  const handleSignOut = useCallback(async () => {
    try {
      await apiFetch("/api/eip/auth/logout", { method: "POST", body: {} });
    } finally {
      ctx?.surface?.setCode?.("auth");
      const url = new URL(window.location.href);
      url.searchParams.set("surface", "auth");
      window.history.replaceState({}, "", url);
    }
  }, [ctx]);

  const keepSessionAlive = useCallback(() => {
    return apiFetch("/api/eip/auth/whoami").catch(() => {});
  }, []);

  const idleMinutes = Number(import.meta.env.VITE_SESSION_IDLE_MIN || 120);
  useIdleLogout({ idleMinutes, enabled: true, onTimeout: handleSignOut, onActivityPing: keepSessionAlive });

  useEffect(() => {
    function handleStepUpEvent() {
      setStepUpOpen(true);
      setStepUpStage("request");
    }
    window.addEventListener("eip-step-up-required", handleStepUpEvent);
    return () => window.removeEventListener("eip-step-up-required", handleStepUpEvent);
  }, []);

  const handleRequestStepUp = useCallback(async () => {
    if (!user.email || !user.tenantId) return;
    await requestOtp({
      tenantId: user.tenantId,
      email: user.email,
      password: stepUpForm.password,
    });
    setStepUpStage("verify");
  }, [requestOtp, user, stepUpForm.password]);

  const handleVerifyStepUp = useCallback(async () => {
    if (!user.email || !user.tenantId) return;
    await verifyOtp({
      tenantId: user.tenantId,
      email: user.email,
      otp: stepUpForm.otp,
    });
    setStepUpOpen(false);
    setStepUpStage("request");
    setStepUpForm({ password: "", otp: "" });
  }, [verifyOtp, user, stepUpForm.otp]);

  const closeStepUp = () => {
    setStepUpOpen(false);
    setStepUpStage("request");
    setStepUpForm({ password: "", otp: "" });
  };

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    setProfileNotice(null);
    try {
      const result = await apiFetch("/api/eip/auth/profile");
      const profile = result.profile || {};
      if (profile.display_name) {
        setUser((prev) => ({ ...prev, name: profile.display_name }));
      }
      setProfileForm({
        display_name: profile.display_name || "",
        title: profile.title || "",
        phone: profile.phone || "",
        locale: profile.locale || "",
        timezone: profile.timezone || "",
        avatar_url: profile.avatar_url || "",
        avatar_display_url: profile.avatar_display_url || profile.avatar_url || "",
      });
    } catch (err) {
      setProfileError(err.message || "Unable to load profile.");
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user.email) return;
    void loadProfile();
  }, [user.email, loadProfile]);

  const openProfile = useCallback(() => {
    setProfileOpen(true);
    void loadProfile();
  }, [loadProfile]);

  const handleSaveProfile = useCallback(async () => {
    setProfileSaving(true);
    setProfileError(null);
    setProfileNotice(null);
    try {
      const result = await apiFetch("/api/eip/auth/profile", {
        method: "PUT",
        body: {
          display_name: profileForm.display_name,
          title: profileForm.title,
          phone: profileForm.phone,
          locale: profileForm.locale,
          timezone: profileForm.timezone,
          avatar_url: profileForm.avatar_url,
        },
      });
      const profile = result.profile || {};
      setProfileForm((prev) => ({
        ...prev,
        display_name: profile.display_name || prev.display_name,
        title: profile.title || "",
        phone: profile.phone || "",
        locale: profile.locale || "",
        timezone: profile.timezone || "",
        avatar_url: profile.avatar_url || prev.avatar_url,
        avatar_display_url: profile.avatar_display_url || profile.avatar_url || prev.avatar_display_url,
      }));
      if (profile.display_name || profileForm.display_name) {
        setUser((prev) => ({ ...prev, name: profile.display_name || profileForm.display_name }));
      }
      setProfileNotice("Profile saved.");
    } catch (err) {
      setProfileError(err.message || "Failed to save profile.");
    } finally {
      setProfileSaving(false);
    }
  }, [profileForm]);

  const handleAvatarUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProfileError(null);
    setProfileNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await apiFetch("/api/eip/auth/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const profile = data.profile || {};
      setProfileForm((prev) => ({
        ...prev,
        avatar_url: data.avatar_url || profile.avatar_url || prev.avatar_url,
        avatar_display_url:
          data.avatar_display_url || profile.avatar_display_url || data.avatar_url || prev.avatar_display_url,
      }));
      setProfileNotice("Avatar updated.");
    } catch (err) {
      setProfileError(err.message || "Failed to upload avatar.");
    } finally {
      event.target.value = "";
    }
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-mist-50 text-ink-900">
      <div className="pointer-events-none absolute inset-0 bg-auth-aurora opacity-70" />
      <div className="pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full bg-brand-200/40 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-10 h-96 w-96 rounded-full bg-cyan-200/50 blur-[140px]" />
      <div className="pointer-events-none absolute inset-0 bg-auth-grain opacity-40" />

      <div className="relative z-10 w-full px-6 py-6">
        <SidebarNav
          brand={brand}
          title="Admin Console"
          menu={menu}
          activeItem={activeTab}
          onSelect={(code) => setActiveTab?.(code)}
          collapsed={collapsed}
          onToggle={() => setCollapsed((prev) => !prev)}
        />

        <div className="flex flex-1 flex-col gap-6" style={{ ...scaleStyle, marginLeft: contentOffset }}>
          <header className="glass-panel relative z-40 flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-brand-700 shadow-soft">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[0.6rem] uppercase tracking-[0.35em] text-ink-400">{brand}</p>
                  <p className="text-sm font-semibold font-display">Admin Console</p>
                </div>
              </div>
              <nav className="flex items-center gap-2">
                {tabs.map((tab) => {
                  const active = activeTab === tab.code;
                  return (
                    <button
                      key={tab.code}
                      type="button"
                      onClick={() => setActiveTab?.(tab.code)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                        active
                          ? "bg-ink-900 text-white shadow-glow"
                          : "border border-white/60 bg-white/70 text-ink-500 hover:bg-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {actionLabel ? (
                <button
                  type="button"
                  onClick={() => runAction(actionEvent, ctx)}
                  className="rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-glow hover:bg-ink-800"
                >
                  {actionLabel}
                </button>
              ) : null}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="flex items-center gap-3 rounded-full border border-white/60 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink-600"
                >
                  <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-ink-900 text-xs font-semibold text-white">
                    {profileAvatarSrc ? (
                      <img
                        src={profileAvatarSrc}
                        alt="avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initial
                    )}
                  </span>
                  <span className="hidden text-left md:block">
                    <span className="block text-[0.6rem] uppercase tracking-[0.35em] text-ink-400">
                      {user.name || "Admin"}
                    </span>
                    <span className="block text-[0.7rem] font-semibold normal-case text-ink-600">
                      {user.email || "admin@eip.local"}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>

                {profileMenuOpen ? (
                  <div className="absolute right-0 z-[70] mt-3 w-64 rounded-3xl border border-white/60 bg-white/95 p-4 shadow-strong">
                    <div className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-ink-50/80 px-3 py-3">
                      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-ink-900 text-sm font-semibold text-white">
                        {profileAvatarSrc ? (
                          <img
                            src={profileAvatarSrc}
                            alt="avatar"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initial
                        )}
                      </span>
                      <div className="text-sm">
                        <p className="font-semibold text-ink-900">{user.name || "Admin"}</p>
                        <p className="text-xs text-ink-400">{user.email || "admin@eip.local"}</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-ink-600">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          openProfile();
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 hover:bg-ink-50"
                      >
                        <UserCircle2 className="h-4 w-4" />
                        Account management
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          openProfile();
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 hover:bg-ink-50"
                      >
                        <IdCard className="h-4 w-4" />
                        Profile details
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          setStepUpOpen(true);
                          setStepUpStage("request");
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 hover:bg-ink-50"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Step-up access
                      </button>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-rose-600 hover:bg-rose-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          {header}
          {panels}
        </div>
      </div>

      <footer className="relative z-10 w-full px-6 pb-10 text-sm text-ink-400" style={{ marginLeft: contentOffset }}>
        <p className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          {helper}
        </p>
      </footer>

      {stepUpOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink-900/40 px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/95 p-6 shadow-strong">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-ink-400">Step-up verification</p>
                <h3 className="text-lg font-semibold text-ink-900">Confirm admin action</h3>
                <p className="mt-1 text-xs text-ink-500">
                  Use OTP or TOTP to elevate this session.
                </p>
              </div>
              <button
                type="button"
                onClick={closeStepUp}
                className="rounded-full border border-ink-200/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink-500"
              >
                Close
              </button>
            </div>

            {stepUpStatus?.message ? (
              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-xs ${
                  stepUpStatus.type === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-600"
                    : "border-emerald-200 bg-emerald-50 text-emerald-600"
                }`}
              >
                {stepUpStatus.message}
              </div>
            ) : null}

            <div className="mt-4 space-y-3 text-xs text-ink-500">
              <div>
                <p className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">Email</p>
                <p className="mt-1 rounded-xl border border-ink-200/60 bg-ink-50 px-3 py-2 text-sm text-ink-700">
                  {user.email || "admin@eip.local"}
                </p>
              </div>
            </div>

            {stepUpStage === "request" ? (
              <div className="mt-4 space-y-4">
                <label className="text-xs font-semibold uppercase tracking-[0.25em] text-ink-400">
                  <span className="mb-1 block">Password</span>
                  <input
                    type="password"
                    value={stepUpForm.password}
                    onChange={(event) => setStepUpForm((prev) => ({ ...prev, password: event.target.value }))}
                    className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleRequestStepUp}
                  disabled={stepUpLoading}
                  className="mt-2 w-full rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-glow disabled:opacity-60"
                >
                  {stepUpLoading ? "Sending..." : "Send OTP"}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="text-xs font-semibold uppercase tracking-[0.25em] text-ink-400">
                  <span className="mb-1 block">OTP / TOTP Code</span>
                  <input
                    type="text"
                    value={stepUpForm.otp}
                    onChange={(event) => setStepUpForm((prev) => ({ ...prev, otp: event.target.value }))}
                    className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleVerifyStepUp}
                  disabled={stepUpLoading}
                  className="w-full rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-glow disabled:opacity-60"
                >
                  {stepUpLoading ? "Verifying..." : "Verify"}
                </button>
                <button
                  type="button"
                  onClick={() => setStepUpStage("request")}
                  className="w-full rounded-full border border-ink-200/70 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500"
                >
                  Back
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {profileOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink-900/40 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/60 bg-white/95 p-6 shadow-strong">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-ink-400">Account management</p>
                <h3 className="text-lg font-semibold text-ink-900">Profile details</h3>
                <p className="mt-1 text-xs text-ink-500">Update your display name and avatar.</p>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="rounded-full border border-ink-200/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink-500"
              >
                Close
              </button>
            </div>

            {profileError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
                {profileError}
              </div>
            ) : null}
            {profileNotice ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                {profileNotice}
              </div>
            ) : null}

            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-ink-100 bg-ink-50 text-ink-400">
                {profileAvatarSrc ? (
                  <img
                    src={profileAvatarSrc}
                    alt="avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Image className="h-6 w-6" />
                )}
              </div>
              <div>
                <label className="inline-flex items-center gap-2 rounded-full border border-ink-200/70 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-500 hover:bg-ink-50">
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  Upload avatar
                </label>
                <p className="mt-2 text-[0.65rem] text-ink-400">PNG/JPG up to 15MB.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Display name
                <input
                  value={profileForm.display_name}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, display_name: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                />
              </label>
              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Title
                <input
                  value={profileForm.title}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                />
              </label>
              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Phone
                <input
                  value={profileForm.phone}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                />
              </label>
              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Locale
                <input
                  value={profileForm.locale}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, locale: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                />
              </label>
              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Timezone
                <input
                  value={profileForm.timezone}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, timezone: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={profileSaving || profileLoading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-glow disabled:bg-ink-300"
            >
              <Pencil className="h-4 w-4" />
              {profileSaving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </div>
      ) : null}

    </div>
  );
}
