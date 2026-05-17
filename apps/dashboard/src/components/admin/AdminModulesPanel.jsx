import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Settings } from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const DEFAULT_LAYOUT = {
  title: "Tenant modules",
  subtitle: "Enable or disable tenant modules and track subscription status.",
  tenant: {
    title: "Tenant",
    placeholder: "Search tenant by name or code...",
    empty: "No tenants found.",
  },
  modules: {
    title: "Modules",
    empty: "No modules detected.",
  },
};

const DEFAULT_TRANSLATION_BILLING = {
  charge_mode: "pass_through",
  markup_percent: 0,
  fixed_fee_minor: 0,
  currency: "USD"
};

const TRANSLATION_CHARGE_MODES = [
  { code: "pass_through", label: "Pass-through" },
  { code: "platform_markup", label: "Platform markup" },
  { code: "fixed_fee", label: "Fixed fee" }
];


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

function formatTenantLabel(tenant) {
  if (!tenant) return "";
  const name = tenant.name || "Unnamed tenant";
  const code = tenant.code || tenant.id;
  return `${name} - ${code}`;
}

function formatModuleLabel(moduleCode, label) {
  return label || moduleCode;
}

function normalizeTranslationBilling(input) {
  const src = input && typeof input === "object" ? input : {};
  const charge_mode = String(src.charge_mode || DEFAULT_TRANSLATION_BILLING.charge_mode)
    .trim()
    .toLowerCase() || DEFAULT_TRANSLATION_BILLING.charge_mode;
  const markup_percent = Number.isFinite(Number(src.markup_percent))
    ? Math.max(0, Math.min(500, Number(src.markup_percent)))
    : DEFAULT_TRANSLATION_BILLING.markup_percent;
  const fixed_fee_minor = Number.isFinite(Number(src.fixed_fee_minor))
    ? Math.max(0, Math.round(Number(src.fixed_fee_minor)))
    : DEFAULT_TRANSLATION_BILLING.fixed_fee_minor;
  const currencyRaw = String(src.currency || DEFAULT_TRANSLATION_BILLING.currency).trim().toUpperCase();
  const currency = /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : DEFAULT_TRANSLATION_BILLING.currency;
  return {
    charge_mode,
    markup_percent,
    fixed_fee_minor,
    currency
  };
}

export default function AdminModulesPanel({ node }) {
  const layout = useMemo(
    () => mergeLayout(DEFAULT_LAYOUT, node?.props?.layout),
    [node?.props?.layout]
  );

  const [tenantOptions, setTenantOptions] = useState([]);
  const [tenantQuery, setTenantQuery] = useState("");
  const [tenantInput, setTenantInput] = useState("");
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(false);

  const [modules, setModules] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [newModule, setNewModule] = useState({
    code: "",
    enabled: true,
    mode: "catalog",
    label: "",
    description: "",
    catalogCode: "",
  });
  const [creating, setCreating] = useState(false);
  const [createNotice, setCreateNotice] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [billing, setBilling] = useState(DEFAULT_TRANSLATION_BILLING);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingError, setBillingError] = useState(null);
  const [billingNotice, setBillingNotice] = useState(null);

  const tenantDisplay = tenantMenuOpen
    ? tenantInput
    : tenantInput || (selectedTenant ? formatTenantLabel(selectedTenant) : "");

  const loadTenants = async (query) => {
    setTenantLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      const result = await apiFetch(`/api/eip/admin/tenants?${params.toString()}`);
      setTenantOptions(result.tenants || []);
    } catch (err) {
      setTenantOptions([]);
    } finally {
      setTenantLoading(false);
    }
  };

  const loadModules = async (tenantId) => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch(`/api/eip/admin/tenants/${tenantId}/modules`);
      setModules(result.modules || []);
    } catch (err) {
      setError(err.message || "Unable to load modules.");
      setModules([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTranslationBilling = async (tenantId) => {
    if (!tenantId) {
      setBilling(normalizeTranslationBilling(DEFAULT_TRANSLATION_BILLING));
      return;
    }
    setBillingLoading(true);
    setBillingError(null);
    try {
      const result = await apiFetch(`/api/eip/admin/tenants/${tenantId}/ecom/translation/billing`);
      setBilling(normalizeTranslationBilling(result?.billing || DEFAULT_TRANSLATION_BILLING));
    } catch (err) {
      setBilling(normalizeTranslationBilling(DEFAULT_TRANSLATION_BILLING));
      setBillingError(err.message || "Unable to load translation pricing.");
    } finally {
      setBillingLoading(false);
    }
  };

  const loadCatalog = async (query) => {
    setCatalogLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      const result = await apiFetch(`/api/eip/admin/modules/catalog?${params.toString()}`);
      setCatalog(result.modules || []);
    } catch (err) {
      setCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleTenantPick = (tenant) => {
    setSelectedTenant(tenant);
    setTenantInput(formatTenantLabel(tenant));
    setTenantQuery("");
    setTenantMenuOpen(false);
    setNewModule({
      code: "",
      enabled: true,
      mode: "catalog",
      label: "",
      description: "",
      catalogCode: "",
    });
    setCreateNotice(null);
    setBillingNotice(null);
    setBillingError(null);
    loadModules(tenant.id);
    loadTranslationBilling(tenant.id);
  };

  const handleToggle = async (item) => {
    if (!selectedTenant) return;
    setUpdating(item.module);
    setError(null);
    try {
      await apiFetch(`/api/eip/admin/tenants/${selectedTenant.id}/modules`, {
        method: "POST",
        body: {
          module: item.module,
          enabled: !item.enabled,
          attrs: item.attrs || {},
        },
      });
      await loadModules(selectedTenant.id);
    } catch (err) {
      setError(err.message || "Failed to update module.");
    } finally {
      setUpdating(null);
    }
  };

  const handleCreateModule = async () => {
    if (!selectedTenant) return;
    const mode = newModule.mode || "catalog";
    const moduleCode =
      mode === "catalog"
        ? String(newModule.catalogCode || "").trim().toLowerCase()
        : newModule.code.trim().toLowerCase();
    if (!moduleCode) {
      setError("Module code is required.");
      return;
    }
    setCreating(true);
    setError(null);
    setCreateNotice(null);
    try {
      const catalogEntry = catalog.find((item) => item.code === moduleCode);
      const label = mode === "new" ? newModule.label.trim() : catalogEntry?.label || "";
      const description =
        mode === "new" ? newModule.description.trim() : catalogEntry?.description || "";
      await apiFetch(`/api/eip/admin/tenants/${selectedTenant.id}/modules`, {
        method: "POST",
        body: {
          module: moduleCode,
          enabled: newModule.enabled,
          label: label || undefined,
          description: description || undefined,
          attrs: {},
        },
      });
      if (mode === "new") {
        await apiFetch(`/api/eip/admin/modules/catalog`, {
          method: "POST",
          body: {
            code: moduleCode,
            label: label || moduleCode,
            description: description || undefined,
            is_active: true,
          },
        });
        await loadCatalog("");
      }
      await loadModules(selectedTenant.id);
      setNewModule({
        code: "",
        enabled: true,
        mode: "catalog",
        label: "",
        description: "",
        catalogCode: "",
      });
      setCreateNotice(`Module ${moduleCode} added.`);
    } catch (err) {
      setError(err.message || "Failed to add module.");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveBilling = async () => {
    if (!selectedTenant?.id) return;
    setBillingSaving(true);
    setBillingNotice(null);
    setBillingError(null);
    try {
      const result = await apiFetch(
        `/api/eip/admin/tenants/${selectedTenant.id}/ecom/translation/billing`,
        {
          method: "PUT",
          body: normalizeTranslationBilling(billing)
        }
      );
      setBilling(normalizeTranslationBilling(result?.billing || billing));
      setBillingNotice("Translation pricing saved.");
    } catch (err) {
      setBillingError(err.message || "Failed to save translation pricing.");
    } finally {
      setBillingSaving(false);
    }
  };

  useEffect(() => {
    loadTenants("");
    loadCatalog("");
  }, []);

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
          onClick={() => {
            if (selectedTenant?.id) {
              loadModules(selectedTenant.id);
              loadTranslationBilling(selectedTenant.id);
            }
          }}
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

      <div className="mt-6 rounded-2xl border border-ink-100 bg-white/90 p-4">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-ink-500" />
          <h3 className="text-sm font-semibold text-ink-900">{layout.tenant.title}</h3>
        </div>
        <div className="relative mt-3">
          <input
            value={tenantDisplay}
            onChange={(event) => {
              setTenantInput(event.target.value);
              setTenantQuery(event.target.value);
              setSelectedTenant(null);
              setTenantMenuOpen(true);
            }}
            onFocus={() => setTenantMenuOpen(true)}
            onBlur={() => setTimeout(() => setTenantMenuOpen(false), 150)}
            placeholder={layout.tenant.placeholder}
            className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
          />
          {tenantMenuOpen ? (
            <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-ink-100 bg-white p-1 shadow-lg">
              {tenantLoading ? (
                <div className="px-3 py-2 text-xs text-ink-500">Loading...</div>
              ) : null}
              {!tenantLoading && tenantOptions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-ink-500">{layout.tenant.empty}</div>
              ) : null}
              {tenantOptions.map((tenant) => (
                <button
                  type="button"
                  key={tenant.id}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleTenantPick(tenant);
                  }}
                  onClick={() => handleTenantPick(tenant)}
                  className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-xs text-ink-700 hover:bg-ink-50"
                >
                  <span className="font-semibold">{tenant.name || tenant.code || tenant.id}</span>
                  <span className="text-[0.65rem] text-ink-400">{tenant.code}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-ink-100 bg-white/90 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-900">{layout.modules.title}</h3>
          {loading ? <span className="text-xs text-ink-400">Loading...</span> : null}
        </div>
        <div className="mt-4 rounded-2xl border border-dashed border-ink-200 bg-white/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ink-400">
            Add module
          </p>
          {createNotice ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {createNotice}
            </div>
          ) : null}
          <div className="mt-3 grid gap-3">
            <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
              Source
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewModule((prev) => ({ ...prev, mode: "catalog" }))}
                  className={`rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] ${
                    newModule.mode !== "new"
                      ? "bg-ink-900 text-white"
                      : "border border-ink-200/70 bg-white text-ink-500"
                  }`}
                >
                  Catalog
                </button>
                <button
                  type="button"
                  onClick={() => setNewModule((prev) => ({ ...prev, mode: "new" }))}
                  className={`rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] ${
                    newModule.mode === "new"
                      ? "bg-ink-900 text-white"
                      : "border border-ink-200/70 bg-white text-ink-500"
                  }`}
                >
                  New
                </button>
              </div>
            </label>
            {newModule.mode !== "new" ? (
              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Catalog module
                <select
                  value={newModule.catalogCode || ""}
                  onChange={(event) =>
                    setNewModule((prev) => ({ ...prev, catalogCode: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                >
                  <option value="">
                    {catalogLoading ? "Loading catalog..." : "Select module"}
                  </option>
                  {catalog.map((item) => (
                    <option key={item.code} value={item.code}>
                      {formatModuleLabel(item.code, item.label)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                  Module code
                  <input
                    value={newModule.code}
                    onChange={(event) => setNewModule((prev) => ({ ...prev, code: event.target.value }))}
                    placeholder="core, crm, ecom"
                    className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                  />
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                  Label
                  <input
                    value={newModule.label || ""}
                    onChange={(event) => setNewModule((prev) => ({ ...prev, label: event.target.value }))}
                    placeholder="Module label"
                    className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                  />
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                  Description
                  <input
                    value={newModule.description || ""}
                    onChange={(event) =>
                      setNewModule((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="Short description"
                    className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                  />
                </label>
              </>
            )}
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Status
                <select
                  value={newModule.enabled ? "enabled" : "disabled"}
                  onChange={(event) =>
                    setNewModule((prev) => ({ ...prev, enabled: event.target.value === "enabled" }))
                  }
                  className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                >
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
              <button
                type="button"
                onClick={handleCreateModule}
                disabled={!selectedTenant || creating}
                className="mt-6 h-10 rounded-full bg-ink-900 px-5 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-white shadow-glow disabled:bg-ink-300"
              >
                {creating ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {!loading && selectedTenant && modules.length === 0 ? (
            <div className="rounded-xl border border-ink-100 bg-ink-50/60 px-3 py-2 text-xs text-ink-500">
              {layout.modules.empty}
            </div>
          ) : null}
          {modules.map((item) => {
            const disabled = updating === item.module;
            return (
              <div
                key={item.module}
                className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white/95 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    {formatModuleLabel(item.module, item.label)}
                  </p>
                  <p className="text-xs text-ink-400">
                    {item.explicit ? "Subscription" : "Inferred from bundle"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  disabled={disabled}
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${
                    item.enabled
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-ink-100 text-ink-500"
                  } ${disabled ? "opacity-60" : "hover:opacity-90"}`}
                >
                  {item.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-ink-100 bg-white/90 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink-900">Translation pricing</h3>
          {billingLoading ? <span className="text-xs text-ink-400">Loading...</span> : null}
        </div>
        <p className="mt-1 text-xs text-ink-500">
          Managed by EIP admin. Tenant workspace can view this information only.
        </p>

        {billingError ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {billingError}
          </div>
        ) : null}
        {billingNotice ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {billingNotice}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
            Charge mode
            <select
              value={billing.charge_mode}
              onChange={(event) =>
                setBilling((prev) => ({ ...prev, charge_mode: event.target.value }))
              }
              disabled={!selectedTenant}
              className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700 disabled:bg-ink-50"
            >
              {TRANSLATION_CHARGE_MODES.map((mode) => (
                <option key={mode.code} value={mode.code}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
            Markup %
            <input
              type="number"
              min={0}
              max={500}
              step="0.1"
              value={billing.markup_percent}
              onChange={(event) =>
                setBilling((prev) => ({ ...prev, markup_percent: event.target.value }))
              }
              disabled={!selectedTenant}
              className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700 disabled:bg-ink-50"
            />
          </label>

          <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
            Fixed fee (minor unit)
            <input
              type="number"
              min={0}
              step="1"
              value={billing.fixed_fee_minor}
              onChange={(event) =>
                setBilling((prev) => ({ ...prev, fixed_fee_minor: event.target.value }))
              }
              disabled={!selectedTenant}
              className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700 disabled:bg-ink-50"
            />
          </label>

          <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
            Currency
            <input
              value={billing.currency}
              maxLength={3}
              onChange={(event) =>
                setBilling((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
              }
              disabled={!selectedTenant}
              className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700 disabled:bg-ink-50"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSaveBilling}
            disabled={!selectedTenant || billingSaving}
            className="rounded-full bg-ink-900 px-5 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-white shadow-glow disabled:bg-ink-300"
          >
            {billingSaving ? "Saving..." : "Save pricing"}
          </button>
        </div>
      </div>
    </section>
  );
}
