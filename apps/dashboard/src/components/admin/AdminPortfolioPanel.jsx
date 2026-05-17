import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, UserPlus, Users, X } from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const DEFAULT_LAYOUT = {
  title: "Admin portfolios",
  subtitle: "Assign tenants to admin portfolios and manage associate scope.",
  create: {
    title: "Create portfolio",
    adminPlaceholder: "Select admin",
    codePlaceholder: "Portfolio code",
    namePlaceholder: "Portfolio name",
    createLabel: "Create"
  },
  list: {
    title: "Portfolios",
    empty: "No portfolios yet."
  },
  detail: {
    title: "Assigned tenants",
    empty: "No tenants assigned."
  },
  assign: {
    placeholder: "Search tenant...",
    add: "Assign tenant"
  }
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

export default function AdminPortfolioPanel({ node }) {
  const layout = useMemo(
    () => mergeLayout(DEFAULT_LAYOUT, node?.props?.layout),
    [node?.props?.layout]
  );
  const [portfolios, setPortfolios] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [admins, setAdmins] = useState([]);
  const [assignedTenants, setAssignedTenants] = useState([]);
  const [tenantOptions, setTenantOptions] = useState([]);
  const [tenantQuery, setTenantQuery] = useState("");
  const [tenantInput, setTenantInput] = useState("");
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({
    admin_identity_id: "",
    code: "",
    name: "",
  });

  const selectedPortfolio = useMemo(() => {
    if (!portfolios.length) return null;
    return portfolios.find((item) => item.id === selectedId) || portfolios[0];
  }, [portfolios, selectedId]);

  const loadPortfolios = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch("/api/eip/admin/portfolios");
      setPortfolios(result.portfolios || []);
      if (!selectedId && result.portfolios?.length) {
        setSelectedId(result.portfolios[0].id);
      }
    } catch (err) {
      setError(err.message || "Failed to load portfolios.");
    } finally {
      setLoading(false);
    }
  };

  const loadAdmins = async () => {
    try {
      const result = await apiFetch("/api/eip/admin/portfolios/admins");
      setAdmins(result.admins || []);
    } catch (err) {
      setAdmins([]);
    }
  };

  const loadAssignedTenants = async (portfolioId) => {
    if (!portfolioId) return;
    try {
      const result = await apiFetch(`/api/eip/admin/portfolios/${portfolioId}/tenants`);
      setAssignedTenants(result.tenants || []);
    } catch (err) {
      setAssignedTenants([]);
    }
  };

  const loadTenants = async (query) => {
    setLoadingTenants(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      const result = await apiFetch(`/api/eip/admin/portfolios/tenants?${params.toString()}`);
      setTenantOptions(result.tenants || []);
    } catch (err) {
      setTenantOptions([]);
    } finally {
      setLoadingTenants(false);
    }
  };

  const handleCreate = async () => {
    setError(null);
    setNotice(null);
    if (!form.admin_identity_id) {
      setError("Select an admin identity first.");
      return;
    }
    try {
      await apiFetch("/api/eip/admin/portfolios", {
        method: "POST",
        body: {
          admin_identity_id: form.admin_identity_id,
          code: form.code,
          name: form.name,
        },
      });
      setForm({ admin_identity_id: "", code: "", name: "" });
      setNotice("Portfolio saved.");
      await loadPortfolios();
      await loadAdmins();
    } catch (err) {
      setError(err.message || "Failed to save portfolio.");
    }
  };

  const handleAssignTenant = async (tenant) => {
    if (!selectedPortfolio || !tenant) return;
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/eip/admin/portfolios/${selectedPortfolio.id}/tenants`, {
        method: "POST",
        body: { tenant_id: tenant.id },
      });
      setTenantInput("");
      setTenantQuery("");
      setTenantOptions([]);
      setSelectedTenant(null);
      setTenantMenuOpen(false);
      setNotice("Tenant assigned.");
      await loadAssignedTenants(selectedPortfolio.id);
      await loadPortfolios();
    } catch (err) {
      setError(err.message || "Failed to assign tenant.");
    }
  };

  const handleRemoveTenant = async (tenantId) => {
    if (!selectedPortfolio || !tenantId) return;
    setError(null);
    setNotice(null);
    try {
      await apiFetch(
        `/api/eip/admin/portfolios/${selectedPortfolio.id}/tenants/${tenantId}`,
        { method: "DELETE", body: {} }
      );
      setNotice("Tenant removed.");
      await loadAssignedTenants(selectedPortfolio.id);
      await loadPortfolios();
    } catch (err) {
      setError(err.message || "Failed to remove tenant.");
    }
  };

  useEffect(() => {
    loadPortfolios();
    loadAdmins();
  }, []);

  useEffect(() => {
    if (!selectedPortfolio?.id) return;
    loadAssignedTenants(selectedPortfolio.id);
  }, [selectedPortfolio?.id]);

  useEffect(() => {
    if (!tenantMenuOpen) return undefined;
    const handle = setTimeout(() => {
      loadTenants(tenantQuery.trim());
    }, 200);
    return () => clearTimeout(handle);
  }, [tenantMenuOpen, tenantQuery]);

  return (
    <section className="glass-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">{layout.title}</h2>
          <p className="mt-1 text-sm text-ink-500">{layout.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={loadPortfolios}
          className="flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 hover:bg-white"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-ink-100 bg-white/90 p-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-ink-500" />
          <h3 className="text-sm font-semibold text-ink-900">{layout.create.title}</h3>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <select
            value={form.admin_identity_id}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, admin_identity_id: event.target.value }))
            }
            className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
          >
            <option value="">{layout.create.adminPlaceholder}</option>
            {admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.login} ({(admin.roles || []).join(", ")})
              </option>
            ))}
          </select>
          <input
            value={form.code}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, code: event.target.value }))
            }
            placeholder={layout.create.codePlaceholder}
            className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
          />
          <input
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder={layout.create.namePlaceholder}
            className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-white shadow-glow"
          >
            <Plus className="h-4 w-4" />
            {layout.create.createLabel}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-ink-100 bg-white/90 p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-ink-500" />
            <h3 className="text-sm font-semibold text-ink-900">{layout.list.title}</h3>
          </div>
          <div className="mt-3 space-y-2">
            {loading ? (
              <div className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-500">
                Loading portfolios...
              </div>
            ) : null}
            {!loading && portfolios.length === 0 ? (
              <div className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-500">
                {layout.list.empty}
              </div>
            ) : null}
            {portfolios.map((portfolio) => {
              const active = portfolio.id === selectedPortfolio?.id;
              return (
                <button
                  key={portfolio.id}
                  type="button"
                  onClick={() => setSelectedId(portfolio.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${
                    active
                      ? "border-ink-900 bg-ink-900 text-white"
                      : "border-ink-100 bg-white text-ink-700 hover:bg-ink-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{portfolio.name || portfolio.code || "Portfolio"}</span>
                    <span className="text-[0.6rem] uppercase tracking-[0.2em] opacity-60">
                      {portfolio.tenant_count ?? 0} tenants
                    </span>
                  </div>
                  <div className="mt-1 text-[0.65rem] opacity-70">
                    {portfolio.admin_login}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white/90 p-4">
          <h3 className="text-sm font-semibold text-ink-900">{layout.detail.title}</h3>
          {selectedPortfolio ? (
            <div className="mt-2 text-[0.7rem] text-ink-500">
              {selectedPortfolio.name || selectedPortfolio.code || "Portfolio"} ·{" "}
              {selectedPortfolio.admin_login}
            </div>
          ) : null}

          <div className="mt-4">
            <div className="relative max-w-lg">
              <input
                value={tenantInput}
                onChange={(event) => {
                  setTenantInput(event.target.value);
                  setTenantQuery(event.target.value);
                  setSelectedTenant(null);
                  setTenantMenuOpen(true);
                }}
                onFocus={() => setTenantMenuOpen(true)}
                onBlur={() => setTimeout(() => setTenantMenuOpen(false), 150)}
                placeholder={layout.assign.placeholder}
                className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
              />
              <button
                type="button"
                onClick={() => handleAssignTenant(selectedTenant)}
                disabled={!selectedTenant}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-ink-200/70 bg-white px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-600 disabled:opacity-50"
              >
                {layout.assign.add}
              </button>
              {tenantMenuOpen ? (
                <div className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-ink-200/70 bg-white p-2 text-[0.7rem] text-ink-700 shadow-lg">
                  {loadingTenants ? (
                    <div className="rounded-lg bg-ink-50 px-3 py-2 text-[0.65rem] text-ink-500">
                      Loading...
                    </div>
                  ) : null}
                  {!loadingTenants && tenantOptions.length === 0 ? (
                    <div className="rounded-lg bg-ink-50 px-3 py-2 text-[0.65rem] text-ink-500">
                      No tenants found.
                    </div>
                  ) : null}
                  {tenantOptions.map((tenant) => (
                    <button
                      key={tenant.id}
                      type="button"
                      onClick={() => {
                        setTenantInput(
                          tenant.name && tenant.code
                            ? `${tenant.name} (${tenant.code})`
                            : tenant.name || tenant.code || tenant.id
                        );
                        setSelectedTenant(tenant);
                        setTenantMenuOpen(false);
                      }}
                      className="flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left hover:bg-ink-50"
                    >
                      <span className="text-[0.75rem] font-semibold text-ink-900">
                        {tenant.name && tenant.code
                          ? `${tenant.name} (${tenant.code})`
                          : tenant.name || tenant.code || tenant.id}
                      </span>
                      <span className="text-[0.6rem] uppercase tracking-[0.2em] text-ink-400">
                        {tenant.id}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {assignedTenants.length === 0 ? (
              <div className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-500">
                {layout.detail.empty}
              </div>
            ) : null}
            {assignedTenants.map((tenant) => (
              <div
                key={tenant.id}
                className="flex items-center justify-between rounded-xl border border-ink-100 bg-white px-3 py-2 text-xs text-ink-700"
              >
                <div>
                  <div className="font-semibold">
                    {tenant.name && tenant.code
                      ? `${tenant.name} (${tenant.code})`
                      : tenant.name || tenant.code || tenant.id}
                  </div>
                  <div className="text-[0.6rem] uppercase tracking-[0.2em] text-ink-400">
                    {tenant.id}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveTenant(tenant.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-100 bg-white px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-500"
                >
                  <X className="h-3 w-3" />
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
