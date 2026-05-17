import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, RefreshCw, Ban, KeyRound } from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const DEFAULT_LAYOUT = {
  title: "Admin access approvals",
  subtitle:
    "Grant EIP administrators access to this tenant. Sensitive data requires a time-limited token.",
  form: {
    adminLabel: "EIP admin",
    adminPlaceholder: "Select admin",
    accessLabel: "Access level",
    sensitiveLabel: "Allow sensitive access (token required)",
    grant: "Grant / Update",
    rotate: "Rotate token",
    revoke: "Revoke token",
    tokenLabel: "New token",
    tokenHint: "Share securely. Token expires in 24 hours.",
    tokenExpires: "Expires",
  },
  list: {
    title: "Granted admins",
    empty: "No admin access grants yet.",
  },
  status: {
    forbidden: "Tenant admin access only.",
  },
};

function mergeLayout(base, override) {
  if (!override || typeof override !== "object") return base;
  const output = Array.isArray(base) ? [...base] : { ...base };
  Object.keys(override).forEach((key) => {
    const baseValue = base ? base[key] : undefined;
    const overrideValue = override[key];
    if (
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue) &&
      overrideValue &&
      typeof overrideValue === "object" &&
      !Array.isArray(overrideValue)
    ) {
      output[key] = mergeLayout(baseValue, overrideValue);
    } else {
      output[key] = overrideValue;
    }
  });
  return output;
}

export default function TenantAdminAccessPanel({ node }) {
  const layout = useMemo(
    () => mergeLayout(DEFAULT_LAYOUT, node?.props?.layout),
    [node?.props?.layout]
  );
  const [admins, setAdmins] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [form, setForm] = useState({
    adminId: "",
    accessLevel: "ASSOC",
    sensitiveAllowed: false,
  });
  const [tokenInfo, setTokenInfo] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);
    try {
      const [adminsResult, grantsResult] = await Promise.all([
        apiFetch("/api/eip/tenant/admin-access/admins"),
        apiFetch("/api/eip/tenant/admin-access"),
      ]);
      setAdmins(adminsResult.admins || []);
      setGrants(grantsResult.grants || []);
    } catch (err) {
      const message = err?.message || "Failed to load admin access.";
      if (message.includes("API 403") || message.includes("FORBIDDEN")) {
        setAccessDenied(true);
        setAdmins([]);
        setGrants([]);
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGrant = async () => {
    if (!form.adminId) return;
    if (accessDenied) return;
    setError(null);
    setTokenInfo(null);
    try {
      const result = await apiFetch("/api/eip/tenant/admin-access/grant", {
        method: "POST",
        body: {
          admin_identity_id: form.adminId,
          access_level: form.accessLevel,
          sensitive_allowed: form.sensitiveAllowed,
        },
      });
      if (result?.token) {
        setTokenInfo({
          token: result.token,
          expires: result.token_expires_at,
        });
      }
      await loadData();
    } catch (err) {
      setError(err.message || "Grant failed.");
    }
  };

  const handleRotate = async () => {
    if (!form.adminId) return;
    if (accessDenied) return;
    setError(null);
    setTokenInfo(null);
    try {
      const result = await apiFetch("/api/eip/tenant/admin-access/rotate", {
        method: "POST",
        body: {
          admin_identity_id: form.adminId,
        },
      });
      if (result?.token) {
        setTokenInfo({
          token: result.token,
          expires: result.token_expires_at,
        });
      }
      await loadData();
    } catch (err) {
      setError(err.message || "Rotate failed.");
    }
  };

  const handleRevoke = async () => {
    if (!form.adminId) return;
    if (accessDenied) return;
    setError(null);
    setTokenInfo(null);
    try {
      await apiFetch("/api/eip/tenant/admin-access/revoke", {
        method: "POST",
        body: {
          admin_identity_id: form.adminId,
        },
      });
      await loadData();
    } catch (err) {
      setError(err.message || "Revoke failed.");
    }
  };

  const handleSelectGrant = (grant) => {
    setForm({
      adminId: grant.admin_identity_id,
      accessLevel: grant.access_level || "ASSOC",
      sensitiveAllowed: Boolean(grant.sensitive_allowed),
    });
    setTokenInfo(null);
  };

  return (
    <section className="glass-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.35em] text-ink-400">
            {layout.title}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink-900">Tenant admin approvals</h2>
          <p className="mt-2 text-xs text-ink-500">{layout.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-ink-600 shadow-soft hover:bg-white"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
          {error.includes("FORBIDDEN") ? layout.status.forbidden : error}
        </div>
      ) : null}

      {accessDenied ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          <p className="font-semibold">{layout.status.forbidden}</p>
          <p className="mt-1 text-xs text-amber-700">
            Ask a tenant super admin to grant <code>tenant.admin_access.read</code> (and
            <code> tenant.admin_access.write</code> if you need grant/revoke actions).
          </p>
        </div>
      ) : null}

      <div
        className={`mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] ${
          accessDenied ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <div className="rounded-2xl border border-ink-100 bg-white/90 p-4">
          <h3 className="text-sm font-semibold text-ink-900">{layout.list.title}</h3>
          <div className="mt-3 space-y-2 text-xs text-ink-600">
            {loading ? (
              <div className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-500">
                Loading...
              </div>
            ) : null}
            {!loading && grants.length === 0 ? (
              <div className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-500">
                {layout.list.empty}
              </div>
            ) : null}
            {grants.map((grant) => (
              <button
                key={grant.admin_identity_id}
                type="button"
                onClick={() => handleSelectGrant(grant)}
                className={`flex w-full flex-col rounded-xl border px-3 py-2 text-left ${
                  grant.admin_identity_id === form.adminId
                    ? "border-ink-900 bg-ink-900 text-white"
                    : "border-ink-100 bg-white text-ink-700 hover:bg-ink-50"
                }`}
              >
                <span className="text-xs font-semibold">
                  {grant.admin_login || grant.admin_identity_id}
                </span>
                <span className="text-[0.6rem] uppercase tracking-[0.2em] opacity-70">
                  {grant.access_level}
                  {grant.sensitive_allowed ? " · sensitive" : ""}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white/90 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-[0.25em] text-ink-400">
              <span className="mb-1 block">{layout.form.adminLabel}</span>
              <select
                value={form.adminId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, adminId: event.target.value }))
                }
                className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
              >
                <option value="">{layout.form.adminPlaceholder}</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.login} ({admin.roles?.join(", ")})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold uppercase tracking-[0.25em] text-ink-400">
              <span className="mb-1 block">{layout.form.accessLabel}</span>
              <select
                value={form.accessLevel}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, accessLevel: event.target.value }))
                }
                className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
              >
                <option value="ASSOC">ASSOC</option>
                <option value="EXEC">EXEC</option>
              </select>
            </label>
          </div>

          <label className="mt-4 flex items-center gap-3 rounded-xl border border-ink-100 bg-ink-50/80 px-3 py-2 text-xs text-ink-600">
            <input
              type="checkbox"
              checked={form.sensitiveAllowed}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, sensitiveAllowed: event.target.checked }))
              }
              className="h-4 w-4 rounded border-ink-300 text-ink-900"
            />
            {layout.form.sensitiveLabel}
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGrant}
              className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-white shadow-glow"
            >
              <ShieldCheck className="h-4 w-4" />
              {layout.form.grant}
            </button>
            <button
              type="button"
              onClick={handleRotate}
              className="inline-flex items-center gap-2 rounded-full border border-ink-200/70 bg-white px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-600"
            >
              <KeyRound className="h-4 w-4" />
              {layout.form.rotate}
            </button>
            <button
              type="button"
              onClick={handleRevoke}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-rose-600"
            >
              <Ban className="h-4 w-4" />
              {layout.form.revoke}
            </button>
          </div>

          {tokenInfo?.token ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
              <p className="text-[0.6rem] uppercase tracking-[0.3em] text-emerald-600">
                {layout.form.tokenLabel}
              </p>
              <p className="mt-2 break-all font-semibold text-emerald-800">{tokenInfo.token}</p>
              <p className="mt-2 text-[0.65rem] text-emerald-700">
                {layout.form.tokenHint}
              </p>
              {tokenInfo.expires ? (
                <p className="mt-1 text-[0.6rem] uppercase tracking-[0.2em] text-emerald-600">
                  {layout.form.tokenExpires}: {new Date(tokenInfo.expires).toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
