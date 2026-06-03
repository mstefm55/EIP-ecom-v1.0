import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Package,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  TrendingDown
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const DEFAULT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "alerts", label: "Stock Alerts" },
  { id: "materials", label: "Materials" },
  { id: "suggestions", label: "Reorder Suggestions" },
  { id: "movements", label: "Movements" }
];

const DEFAULT_ACTIONS = {
  refresh: "Refresh",
  runReorder: "Run low-stock scan",
  adjust: "Adjust stock",
  policy: "Set reorder policy",
  movements: "View movements",
  createSuggestion: "Create reorder suggestion",
  approve: "Approve",
  ignore: "Ignore",
  createTask: "Create task"
};

const DEFAULT_ENDPOINTS = {
  overview: "/api/eip/inventory/overview",
  materials: "/api/eip/inventory/materials",
  suggestions: "/api/eip/inventory/reorder-suggestions"
};

const STATUS_TONES = {
  in_stock: "bg-emerald-50 text-emerald-700 border-emerald-100",
  low_stock: "bg-amber-50 text-amber-700 border-amber-100",
  out_of_stock: "bg-rose-50 text-rose-700 border-rose-100",
  negative_stock: "bg-rose-100 text-rose-800 border-rose-200",
  untracked: "bg-slate-50 text-slate-600 border-slate-100"
};

function formatLabel(value) {
  const text = String(value || "").replace(/_/g, " ").trim();
  return text ? text.replace(/\b\w/g, (char) => char.toUpperCase()) : "-";
}

function formatQty(value, unit) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  const rounded = Number(number.toFixed(3));
  return `${rounded}${unit ? ` ${unit}` : ""}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function parseApiError(error) {
  const message = error?.message || "";
  const match = message.match(/API\s+(\d+):\s*(.*)$/s);
  if (!match) return message || "Request failed.";
  try {
    const payload = JSON.parse(match[2]);
    if (payload?.error === "FORBIDDEN") return "Access denied. Ask an admin to grant inventory permissions.";
    if (payload?.error === "PROCESS_BINDING_REQUIRED") return "Inventory workflow is not configured for this tenant.";
    if (payload?.error === "INVALID_TRANSITION") return "That inventory action is not allowed from the current status.";
    if (payload?.error) return payload.error.replace(/_/g, " ");
  } catch {
    return match[2] || message;
  }
  return message;
}

function StatusPill({ status }) {
  const tone = STATUS_TONES[status] || STATUS_TONES.untracked;
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${tone}`}>
      {formatLabel(status)}
    </span>
  );
}

function Metric({ label, value, icon: Icon, tone = "text-ink-700" }) {
  return (
    <div className="rounded-xl border border-white/60 bg-white/75 p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-ink-400">{label}</p>
        {Icon ? <Icon className={`h-4 w-4 ${tone}`} /> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-ink-900">{value ?? 0}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", options, placeholder, rows = 3 }) {
  if (type === "select") {
    return (
      <label className="block text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-ink-400">
        {label}
        <select
          value={value ?? ""}
          onChange={(event) => onChange?.(event.target.value)}
          className="mt-1 w-full rounded-xl border border-ink-100 bg-white px-3 py-2 text-sm normal-case tracking-normal text-ink-700"
        >
          {(options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (type === "textarea") {
    return (
      <label className="block text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-ink-400">
        {label}
        <textarea
          value={value ?? ""}
          onChange={(event) => onChange?.(event.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="mt-1 w-full rounded-xl border border-ink-100 bg-white px-3 py-2 text-sm normal-case tracking-normal text-ink-700"
        />
      </label>
    );
  }
  if (type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ink-500">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange?.(event.target.checked)}
          className="h-4 w-4 rounded border-ink-300 text-ink-900"
        />
        {label}
      </label>
    );
  }
  return (
    <label className="block text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-ink-400">
      {label}
      <input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-ink-100 bg-white px-3 py-2 text-sm normal-case tracking-normal text-ink-700"
      />
    </label>
  );
}

export default function InventoryWorkspace({ node } = {}) {
  const props = node?.props || {};
  const endpoints = { ...DEFAULT_ENDPOINTS, ...(props.endpoints || {}) };
  const actions = { ...DEFAULT_ACTIONS, ...(props.actions || {}) };
  const tabs = Array.isArray(props.tabs) && props.tabs.length ? props.tabs : DEFAULT_TABS;

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || "overview");
  const [overview, setOverview] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [policyForm, setPolicyForm] = useState({
    track_stock: true,
    reorder_point: "",
    reorder_qty: "",
    unit_of_measure: "pcs",
    lead_time_days: "",
    preferred_supplier_agent_id: ""
  });
  const [movementForm, setMovementForm] = useState({
    movement_type: "manual_adjustment",
    direction: "adjust",
    quantity: "",
    unit_of_measure: "pcs",
    reason: ""
  });

  const selectedMaterial = useMemo(
    () => materials.find((item) => item.id === selectedMaterialId) || materials[0] || null,
    [materials, selectedMaterialId]
  );

  const stockAlerts = overview?.stock_alerts || [];
  const recentMovements = selectedDetail?.movements || overview?.recent_movements || [];

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewResult, materialsResult, suggestionsResult] = await Promise.all([
        apiFetch(endpoints.overview),
        apiFetch(`${endpoints.materials}?limit=200`),
        apiFetch(`${endpoints.suggestions}?limit=50`)
      ]);
      setOverview(overviewResult);
      setMaterials(materialsResult.items || []);
      setSuggestions(suggestionsResult.items || []);
      if (!selectedMaterialId && materialsResult.items?.[0]?.id) {
        setSelectedMaterialId(materialsResult.items[0].id);
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedDetail = async (materialId) => {
    if (!materialId) return;
    try {
      const detail = await apiFetch(`${endpoints.materials}/${materialId}`);
      setSelectedDetail(detail);
      const profile = detail.item?.stock_profile || {};
      setPolicyForm({
        track_stock: profile.track_stock === true,
        reorder_point: profile.reorder_point ?? "",
        reorder_qty: profile.reorder_qty ?? "",
        unit_of_measure: profile.unit_of_measure || "pcs",
        lead_time_days: profile.lead_time_days ?? "",
        preferred_supplier_agent_id: profile.preferred_supplier_agent_id || ""
      });
      setMovementForm((current) => ({ ...current, unit_of_measure: profile.unit_of_measure || "pcs" }));
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (selectedMaterial?.id) {
      loadSelectedDetail(selectedMaterial.id);
    }
  }, [selectedMaterial?.id]);

  const filteredMaterials = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return materials;
    return materials.filter((item) => {
      const haystack = [item.name, item.code, item.material_type, item.stock_profile?.stock_status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [materials, query]);

  const savePolicy = async () => {
    if (!selectedMaterial?.id) return;
    setActionLoading(true);
    setNotice("");
    setError("");
    try {
      await apiFetch(`${endpoints.materials}/${selectedMaterial.id}/policy`, {
        method: "PATCH",
        body: {
          ...policyForm,
          reorder_point: policyForm.reorder_point === "" ? 0 : Number(policyForm.reorder_point),
          reorder_qty: policyForm.reorder_qty === "" ? 0 : Number(policyForm.reorder_qty),
          lead_time_days: policyForm.lead_time_days === "" ? 0 : Number(policyForm.lead_time_days)
        }
      });
      setNotice("Inventory policy saved.");
      await loadAll();
      await loadSelectedDetail(selectedMaterial.id);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const createMovement = async () => {
    if (!selectedMaterial?.id) return;
    setActionLoading(true);
    setNotice("");
    setError("");
    try {
      await apiFetch(`${endpoints.materials}/${selectedMaterial.id}/movements`, {
        method: "POST",
        body: {
          ...movementForm,
          quantity: Number(movementForm.quantity)
        }
      });
      setMovementForm((current) => ({ ...current, quantity: "", reason: "" }));
      setNotice("Stock movement recorded.");
      await loadAll();
      await loadSelectedDetail(selectedMaterial.id);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const runReorder = async (materialId, force = false) => {
    setActionLoading(true);
    setNotice("");
    setError("");
    try {
      const result = await apiFetch(`${endpoints.suggestions}/run`, {
        method: "POST",
        body: materialId ? { material_id: materialId, force } : {}
      });
      const created = result.created?.length || 0;
      const existing = result.existing?.length || 0;
      setNotice(`${created} reorder suggestion${created === 1 ? "" : "s"} created, ${existing} already open.`);
      await loadAll();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const suggestionAction = async (id, action) => {
    setActionLoading(true);
    setNotice("");
    setError("");
    try {
      await apiFetch(`${endpoints.suggestions}/${id}/${action}`, { method: "POST", body: {} });
      setNotice(action === "approve" ? "Reorder approved." : "Reorder ignored.");
      await loadAll();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const createSuggestionTask = async (id) => {
    setActionLoading(true);
    setNotice("");
    setError("");
    try {
      await apiFetch(`${endpoints.suggestions}/${id}/tasks`, {
        method: "POST",
        body: { task_type: "SUPPLIER_CHECK", title: "Check supplier before purchase" }
      });
      setNotice("Supplier check task created.");
      await loadAll();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="glass-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-ink-400">Inventory</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink-900">{props.title || "Inventory"}</h1>
            <p className="mt-1 max-w-3xl text-sm text-ink-500">
              {props.subtitle || "Stock alerts, material balances, movements, and reorder suggestions."}
            </p>
          </div>
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-ink-100 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-600 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {actions.refresh}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                activeTab === tab.id
                  ? "bg-ink-900 text-white"
                  : "border border-white/60 bg-white/80 text-ink-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {activeTab === "overview" || activeTab === "alerts" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Low stock" value={overview?.stats?.low_stock} icon={TrendingDown} tone="text-amber-600" />
          <Metric label="Out of stock" value={overview?.stats?.out_of_stock} icon={AlertTriangle} tone="text-rose-600" />
          <Metric label="Reorder suggestions" value={overview?.stats?.open_reorder_suggestions} icon={ClipboardList} tone="text-indigo-600" />
          <Metric label="Active materials" value={overview?.stats?.total_active_materials} icon={Package} tone="text-ink-500" />
        </div>
      ) : null}

      {activeTab === "overview" || activeTab === "alerts" ? (
        <div className="glass-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-900">Stock alerts</h2>
              <p className="text-sm text-ink-500">Human-reviewed reorder decisions before purchase commitment.</p>
            </div>
            <button
              type="button"
              onClick={() => runReorder()}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-60"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {actions.runReorder}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {stockAlerts.length ? stockAlerts.map((item) => {
              const profile = item.stock_profile || {};
              return (
                <div key={item.id} className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{item.name || item.code}</p>
                      <p className="text-xs text-ink-400">{item.code || item.material_type || "-"}</p>
                    </div>
                    <StatusPill status={profile.stock_status} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-ink-500">
                    <span>Available <strong className="block text-ink-800">{formatQty(profile.available_qty, profile.unit_of_measure)}</strong></span>
                    <span>Reorder <strong className="block text-ink-800">{formatQty(profile.reorder_point, profile.unit_of_measure)}</strong></span>
                    <span>Suggest <strong className="block text-ink-800">{formatQty(profile.suggested_qty, profile.unit_of_measure)}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => runReorder(item.id, true)}
                    disabled={actionLoading}
                    className="mt-4 rounded-full border border-ink-100 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-600 disabled:opacity-60"
                  >
                    {actions.createSuggestion}
                  </button>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                No low-stock alerts right now.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === "materials" || activeTab === "movements" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <div className="glass-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink-900">Materials</h2>
              <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-2">
                <Search className="h-4 w-4 text-ink-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search stock..."
                  className="w-48 bg-transparent text-sm text-ink-700 outline-none"
                />
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[0.62rem] uppercase tracking-[0.2em] text-ink-400">
                  <tr>
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2">On hand</th>
                    <th className="px-3 py-2">Reserved</th>
                    <th className="px-3 py-2">Available</th>
                    <th className="px-3 py-2">Reorder</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100/70">
                  {filteredMaterials.map((item) => {
                    const profile = item.stock_profile || {};
                    const selected = selectedMaterial?.id === item.id;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedMaterialId(item.id);
                          setActiveTab(activeTab === "movements" ? "movements" : "materials");
                        }}
                        className={`cursor-pointer ${selected ? "bg-white/90" : "hover:bg-white/60"}`}
                      >
                        <td className="px-3 py-3">
                          <p className="font-semibold text-ink-800">{item.name || item.code}</p>
                          <p className="text-xs text-ink-400">{item.code || item.material_type || "-"}</p>
                        </td>
                        <td className="px-3 py-3 text-ink-600">{formatQty(profile.stock_on_hand, profile.unit_of_measure)}</td>
                        <td className="px-3 py-3 text-ink-600">{formatQty(profile.reserved_qty, profile.unit_of_measure)}</td>
                        <td className="px-3 py-3 text-ink-600">{formatQty(profile.available_qty, profile.unit_of_measure)}</td>
                        <td className="px-3 py-3 text-ink-600">{formatQty(profile.reorder_point, profile.unit_of_measure)}</td>
                        <td className="px-3 py-3"><StatusPill status={profile.stock_status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filteredMaterials.length ? (
                <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-center text-sm text-ink-400">
                  No materials match the current search.
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass-panel p-5">
              <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                <SlidersHorizontal className="h-4 w-4" />
                Reorder policy
              </h3>
              <p className="mt-1 text-sm text-ink-500">{selectedMaterial?.name || "Select a material"}</p>
              <div className="mt-4 grid gap-3">
                <Field label="Track stock" type="checkbox" value={policyForm.track_stock} onChange={(value) => setPolicyForm((current) => ({ ...current, track_stock: value }))} />
                <Field label="Reorder point" type="number" value={policyForm.reorder_point} onChange={(value) => setPolicyForm((current) => ({ ...current, reorder_point: value }))} />
                <Field label="Reorder quantity" type="number" value={policyForm.reorder_qty} onChange={(value) => setPolicyForm((current) => ({ ...current, reorder_qty: value }))} />
                <Field label="Unit" value={policyForm.unit_of_measure} onChange={(value) => setPolicyForm((current) => ({ ...current, unit_of_measure: value }))} />
                <Field label="Lead time days" type="number" value={policyForm.lead_time_days} onChange={(value) => setPolicyForm((current) => ({ ...current, lead_time_days: value }))} />
                <Field label="Preferred supplier agent id" value={policyForm.preferred_supplier_agent_id} onChange={(value) => setPolicyForm((current) => ({ ...current, preferred_supplier_agent_id: value }))} />
                <button
                  type="button"
                  onClick={savePolicy}
                  disabled={!selectedMaterial || actionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-60"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {actions.policy}
                </button>
              </div>
            </div>

            <div className="glass-panel p-5">
              <h3 className="text-base font-semibold text-ink-900">Stock movement</h3>
              <div className="mt-4 grid gap-3">
                <Field
                  label="Movement type"
                  type="select"
                  value={movementForm.movement_type}
                  onChange={(value) => setMovementForm((current) => ({ ...current, movement_type: value }))}
                  options={[
                    { value: "opening_balance", label: "Opening balance" },
                    { value: "manual_adjustment", label: "Manual adjustment" },
                    { value: "sale_reservation", label: "Sale reservation" },
                    { value: "sale_issue", label: "Sale issue" },
                    { value: "return_in", label: "Return in" },
                    { value: "purchase_receipt", label: "Purchase receipt" },
                    { value: "stock_count_adjustment", label: "Stock count adjustment" }
                  ]}
                />
                <Field
                  label="Direction"
                  type="select"
                  value={movementForm.direction}
                  onChange={(value) => setMovementForm((current) => ({ ...current, direction: value }))}
                  options={[
                    { value: "in", label: "In" },
                    { value: "out", label: "Out" },
                    { value: "reserve", label: "Reserve" },
                    { value: "release", label: "Release" },
                    { value: "adjust", label: "Adjust" }
                  ]}
                />
                <Field label="Quantity" type="number" value={movementForm.quantity} onChange={(value) => setMovementForm((current) => ({ ...current, quantity: value }))} />
                <Field label="Reason" type="textarea" value={movementForm.reason} onChange={(value) => setMovementForm((current) => ({ ...current, reason: value }))} />
                <button
                  type="button"
                  onClick={createMovement}
                  disabled={!selectedMaterial || actionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-60"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {actions.adjust}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "suggestions" ? (
        <div className="glass-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink-900">Reorder suggestions</h2>
            <button
              type="button"
              onClick={() => runReorder()}
              disabled={actionLoading}
              className="rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-60"
            >
              {actions.runReorder}
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            {suggestions.length ? suggestions.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{item.material_name || item.title || item.code}</p>
                    <p className="text-xs text-ink-400">
                      {formatQty(item.suggested_qty, item.attrs?.unit_of_measure)} · {item.reason || "Review stock policy"}
                    </p>
                  </div>
                  <StatusPill status={item.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => suggestionAction(item.id, "approve")} disabled={actionLoading || item.status === "approved"} className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 disabled:opacity-60">{actions.approve}</button>
                  <button type="button" onClick={() => suggestionAction(item.id, "ignore")} disabled={actionLoading || item.status === "ignored"} className="rounded-full bg-rose-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 disabled:opacity-60">{actions.ignore}</button>
                  <button type="button" onClick={() => createSuggestionTask(item.id)} disabled={actionLoading} className="rounded-full border border-ink-100 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-600 disabled:opacity-60">{actions.createTask}</button>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                No reorder suggestions yet. Run the low-stock scan to create review work.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === "movements" ? (
        <div className="glass-panel p-5">
          <h2 className="text-lg font-semibold text-ink-900">Movements</h2>
          <p className="mt-1 text-sm text-ink-500">{selectedMaterial?.name || "Select a material"} movement history.</p>
          <div className="mt-4 space-y-2">
            {recentMovements.length ? recentMovements.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-sm text-ink-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-ink-900">{formatLabel(item.payload?.movement_type || item.title)}</span>
                  <span className="text-xs text-ink-400">{formatDate(item.created_at)}</span>
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  {formatLabel(item.payload?.direction)} {formatQty(item.payload?.quantity, item.payload?.unit_of_measure)}
                  {" "}· Balance {formatQty(item.payload?.balance_after, item.payload?.unit_of_measure)}
                </p>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                No movements recorded yet.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
