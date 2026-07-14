import { useCallback, useEffect, useState } from "react";
import { ChevronDown, LogOut, UserCircle2 } from "lucide-react";
import EipMark from "../brand/EipMark";
import { apiFetch } from "../../services/apiClient";
import { useIdleLogout } from "../../hooks/useIdleLogout";
import { useUiVersion } from "../../hooks/useUiVersion";
import SidebarNav from "../engine/SidebarNav";
import { EipLanguageSwitcher, useEipLanguage } from "../../i18n/EipLanguageContext.jsx";

function normalizeModules(values) {
  return Array.isArray(values)
    ? values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
    : [];
}

export default function UserShell({ node, children, ctx }) {
  const { t } = useEipLanguage();
  const {
    brand = "EIP Core",
    nav = ["Dashboard", "Tasks", "Reports"],
    menu,
    helper = "Your workspace dashboard and activity overview.",
  } = node.props || {};

  const activeTab = ctx?.user?.activeTab || "dashboard";
  const setActiveTab = ctx?.user?.setActiveTab;
  const [collapsed, setCollapsed] = useState(false);
  const [activeModules, setActiveModules] = useState(null);
  const contentOffset = collapsed ? "6.5rem" : "17rem";
  const headerHeight = "5.75rem";
  const { uiVersion, toggleUiVersion } = useUiVersion();

  const resolvedMenu = Array.isArray(menu) && menu.length ? menu : nav;
  const menuItems = (Array.isArray(resolvedMenu) ? resolvedMenu : []).map((item) => {
    if (typeof item === "string") {
      return {
        code: item.toLowerCase().replace(/\s+/g, "-"),
        label: item,
      };
    }
    return {
      code: item.code || String(item.label || "").toLowerCase().replace(/\s+/g, "-"),
      label: item.label || item.code,
      icon: item.icon,
      module: item.module,
    };
  }).filter((item) => !item.module || activeModules?.includes(String(item.module).trim().toLowerCase()));

  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState({
    name: "User",
    email: "",
    tenantName: "",
    tenantLogoUrl: "",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [result, modules] = await Promise.all([
          apiFetch("/api/eip/auth/whoami"),
          apiFetch("/api/eip/user/dashboard/modules").catch(() =>
            apiFetch("/api/eip/user/dashboard/summary").catch(() => null)
          ),
        ]);
        if (!active) return;
        setActiveModules(normalizeModules(modules?.active_modules));
        const email = result?.login || "";
        const name = email ? email.split("@")[0] : "User";
        setUser({
          name,
          email,
          tenantName: result?.tenant_name || "",
          tenantLogoUrl: result?.tenant_logo_url || "",
        });
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

  const initial = (user.name || "U")[0]?.toUpperCase();

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

  return (
    <div
      className={`${uiVersion === "v1" ? "eip-v1-shell" : "eip-classic-shell"} eip-user-shell relative min-h-screen overflow-x-clip bg-mist-50 text-ink-900`}
      style={{
        "--eip-shell-header-offset": `calc(${headerHeight} + 0.75rem)`,
        "--eip-shell-content-offset": contentOffset,
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-auth-aurora opacity-70" />
      <div className="pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full bg-brand-200/40 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-10 h-96 w-96 rounded-full bg-cyan-200/50 blur-[140px]" />
      <div className="pointer-events-none absolute inset-0 bg-auth-grain opacity-40" />

      <header className="glass-panel fixed left-0 right-0 top-0 z-50 border-b border-white/60 px-6 py-4 shadow-strong">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white/80 text-brand-700 shadow-soft">
                  {user.tenantLogoUrl ? (
                    <img
                      src={user.tenantLogoUrl}
                      alt={`${user.tenantName || "Tenant"} logo`}
                      className="h-7 w-7 object-contain"
                      onError={() =>
                        setUser((prev) => ({ ...prev, tenantLogoUrl: "" }))
                      }
                    />
                  ) : (
                    <EipMark className="h-6 w-6" title="EIP" />
                  )}
                </div>
                <div>
                  <p className="text-[0.6rem] uppercase tracking-[0.35em] text-ink-400">{brand}</p>
                  <p className="text-lg font-semibold font-display">
                    {user.tenantName || t("Workspace")}
                  </p>
                </div>
              </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleUiVersion}
              className="rounded-full border border-white/60 bg-white/80 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink-600"
              aria-pressed={uiVersion === "v1"}
              title={t("Switch between the EIP V1 beta presentation and the unchanged classic presentation")}
            >
              {uiVersion === "v1" ? t("EIP V1 Beta") : t("Classic UI")}
            </button>
            <EipLanguageSwitcher compact />
            <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              className="flex items-center gap-3 rounded-full border border-white/60 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink-600"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
                {initial}
              </span>
              <span className="hidden text-left md:block">
                <span className="block text-[0.6rem] uppercase tracking-[0.35em] text-ink-400">
                  {user.name || "User"}
                </span>
                <span className="block text-[0.7rem] font-semibold normal-case text-ink-600">
                  {user.email || "user@eip.local"}
                </span>
              </span>
              <ChevronDown className="h-4 w-4" />
            </button>

            {profileOpen ? (
              <div className="absolute right-0 z-[80] mt-3 w-56 rounded-3xl border border-white/60 bg-white/95 p-4 shadow-strong">
                <div className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-ink-50/80 px-3 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
                    {initial}
                  </span>
                  <div className="text-sm">
                    <p className="font-semibold text-ink-900">{user.name || "User"}</p>
                    <p className="text-xs text-ink-400">{user.email || "user@eip.local"}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm text-ink-600">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab?.("security");
                      setProfileOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 hover:bg-ink-50"
                  >
                    <UserCircle2 className="h-4 w-4" />
                    {t("Account")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("Sign out")}
                  </button>
                </div>
              </div>
            ) : null}
            </div>
          </div>
        </div>
      </header>

      <SidebarNav
        brand={brand}
        title={t("Workspace")}
        menu={menuItems}
        activeItem={activeTab}
        onSelect={(code) => setActiveTab?.(code)}
        collapsed={collapsed}
        onToggle={() => setCollapsed((prev) => !prev)}
        topOffset={`calc(${headerHeight} + 0.75rem)`}
      />

      <main
        className="relative z-10 px-3 pb-16"
        style={{
          marginLeft: contentOffset,
          width: `calc(100% - ${contentOffset})`,
          paddingTop: `calc(${headerHeight} + 0.75rem)`,
          minWidth: 0
        }}
      >
        <div className="flex w-full max-w-none flex-col gap-5">
          <section className="glass-panel flex items-center gap-2 overflow-x-auto px-3 py-2 lg:hidden">
            {menuItems.map((tab) => {
              const isActive = activeTab ? activeTab === tab.code : false;
              return (
                <button
                  key={tab.code}
                  type="button"
                  onClick={() => setActiveTab?.(tab.code)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                    isActive
                      ? "bg-ink-900 text-white shadow-glow"
                      : "border border-white/60 bg-white/80 text-ink-500"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </section>
          {children}
        </div>
      </main>

      <footer
        className="relative z-10 px-3 pb-10 text-sm text-ink-400"
        style={{ marginLeft: contentOffset, width: `calc(100% - ${contentOffset})`, minWidth: 0 }}
      >
        <p className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          {t(helper)}
        </p>
      </footer>
    </div>
  );
}
