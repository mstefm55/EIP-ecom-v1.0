import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Package,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const DEFAULT_ACTIONS = {
  refresh: "Refresh",
  runReorder: "Run low-stock scan",
  adjust: "Adjust stock",
  policy: "Set reorder policy",
  movements: "View movements",
  createSuggestion: "Create reorder suggestion",
  approve: "Approve",
  ignore: "Ignore",
  createTask: "Create task",
  openProcurement: "Open in Procurement"
};

const DEFAULT_ENDPOINTS = {
  overview: "/api/eip/inventory/overview",
  materials: "/api/eip/inventory/materials",
  suggestions: "/api/eip/inventory/reorder-suggestions",
  workbench: "/api/eip/inventory/reorder-suggestions"
};

const STATUS_TONES = {
  healthy: "bg-emerald-50 text-emerald-700 border-emerald-100",
  in_stock: "bg-emerald-50 text-emerald-700 border-emerald-100",
  low_stock: "bg-amber-50 text-amber-700 border-amber-100",
  watch: "bg-amber-50 text-amber-700 border-amber-100",
  reorder_now: "bg-orange-50 text-orange-700 border-orange-100",
  stockout_predicted: "bg-orange-50 text-orange-700 border-orange-100",
  out_of_stock: "bg-rose-50 text-rose-700 border-rose-100",
  already_out_of_stock: "bg-rose-50 text-rose-700 border-rose-100",
  negative_stock: "bg-rose-100 text-rose-800 border-rose-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-100",
  ignored: "bg-slate-50 text-slate-600 border-slate-100",
  open: "bg-indigo-50 text-indigo-700 border-indigo-100",
  review: "bg-amber-50 text-amber-700 border-amber-100",
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

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "-";
  return number.toLocaleString("en-US", { maximumFractionDigits: 2 });
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
  const normalized = String(status || "untracked").toLowerCase();
  const tone = STATUS_TONES[normalized] || STATUS_TONES.untracked;
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

function Detail({ label, value }) {
  return (
    <span className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-xs text-ink-500">
      {label}
      <strong className="block text-sm font-semibold normal-case tracking-normal text-ink-800">{value ?? "-"}</strong>
    </span>
  );
}

function buildQueue(suggestions, stockAlerts) {
  const suggestionMaterialIds = new Set(suggestions.map((item) => item.material_id).filter(Boolean));
  const suggestionRows = suggestions.map((item) => ({
    key: `suggestion:${item.id}`,
    kind: "suggestion",
    id: item.id,
    material_id: item.material_id,
    label: item.material_name || item.title || item.code || "Inventory signal",
    code: item.material_code || item.code || "",
    status: item.status,
    risk_status: item.risk_status,
    summary: item.decision_card?.headline || item.reason || "Review stock signal.",
    suggested_qty: item.suggested_qty,
    unit_of_measure: item.attrs?.unit_of_measure,
    cash_required_for_reorder: item.cash_required_for_reorder,
    created_at: item.created_at
  }));
  const alertRows = stockAlerts
    .filter((item) => !suggestionMaterialIds.has(item.id))
    .map((item) => {
      const profile = item.stock_profile || {};
      return {
        key: `alert:${item.id}`,
        kind: "material_alert",
        id: item.id,
        material_id: item.id,
        label: item.name || item.code || "Material",
        code: item.code || "",
        status: profile.stock_status,
        risk_status: profile.risk_status,
        summary: profile.decision_card?.headline || "Create a reorder signal to start the governed review.",
        suggested_qty: profile.suggested_qty,
        unit_of_measure: profile.unit_of_measure,
        cash_required_for_reorder: profile.cash_required_for_reorder,
        created_at: item.updated_at || item.created_at
      };
    });
  return [...suggestionRows, ...alertRows];
}

export default function InventoryWorkspace({ node, ctx } = {}) {
  const props = node?.props || {};
  const endpoints = { ...DEFAULT_ENDPOINTS, ...(props.endpoints || {}) };
  const actions = { ...DEFAULT_ACTIONS, ...(props.actions || {}) };

  const [overview, setOverview] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedQueueKey, setSelectedQueueKey] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [workbench, setWorkbench] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [workbenchLoading, setWorkbenchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [policyForm, setPolicyForm] = useState({
    track_stock: true,
    reorder_point: "",
    reorder_qty: "",
    minimum_stock: "",
    maximum_stock: "",
    safety_stock: "",
    unit_of_measure: "pcs",
    lead_time_days: "",
    safety_lead_time_days: "",
    preferred_supplier_agent_id: "",
    abc_classification: "",
    daily_consumption_rate: "",
    minimum_order_qty: "",
    order_multiple: "",
    unit_cost: "",
    average_cost: "",
    freight_cost_estimate: "",
    approval_threshold_value: "",
    target_service_level: "",
    supplier_risk_level: "medium",
    single_source_risk: false,
    auto_reorder_enabled: false,
    approval_required: true
  });
  const [movementForm, setMovementForm] = useState({
    movement_type: "manual_adjustment",
    direction: "adjust",
    quantity: "",
    unit_of_measure: "pcs",
    reason: ""
  });

  const stockAlerts = overview?.stock_alerts || [];
  const queue = useMemo(() => buildQueue(suggestions, stockAlerts), [suggestions, stockAlerts]);
  const filteredQueue = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return queue;
    return queue.filter((item) => [item.label, item.code, item.status, item.risk_status].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [queue, query]);
  const selectedQueueItem = useMemo(
    () => queue.find((item) => item.key === selectedQueueKey) || queue[0] || null,
    [queue, selectedQueueKey]
  );
  const activeMaterial = useMemo(() => {
    if (workbench?.material?.id) {
      return materials.find((item) => item.id === workbench.material.id) || selectedDetail?.item || workbench.material;
    }
    if (selectedMaterialId) return materials.find((item) => item.id === selectedMaterialId) || selectedDetail?.item || null;
    return materials[0] || null;
  }, [materials, selectedMaterialId, selectedDetail, workbench]);
  const selectedProfile = selectedDetail?.item?.stock_profile || activeMaterial?.stock_profile || {};

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
        minimum_stock: profile.minimum_stock ?? "",
        maximum_stock: profile.maximum_stock ?? "",
        safety_stock: profile.safety_stock ?? "",
        unit_of_measure: profile.unit_of_measure || "pcs",
        lead_time_days: profile.lead_time_days ?? "",
        safety_lead_time_days: profile.safety_lead_time_days ?? "",
        preferred_supplier_agent_id: profile.preferred_supplier_agent_id || "",
        abc_classification: profile.abc_classification || "",
        daily_consumption_rate: profile.daily_consumption_rate ?? "",
        minimum_order_qty: profile.minimum_order_qty ?? "",
        order_multiple: profile.order_multiple ?? "",
        unit_cost: profile.unit_cost ?? "",
        average_cost: profile.average_cost ?? "",
        freight_cost_estimate: profile.freight_cost_estimate ?? "",
        approval_threshold_value: profile.approval_threshold_value ?? "",
        target_service_level: profile.target_service_level ?? "",
        supplier_risk_level: profile.supplier_risk_level || "medium",
        single_source_risk: profile.single_source_risk === true,
        auto_reorder_enabled: profile.auto_reorder_enabled === true,
        approval_required: profile.approval_required !== false
      });
      setMovementForm((current) => ({ ...current, unit_of_measure: profile.unit_of_measure || "pcs" }));
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  const loadWorkbench = async (suggestionId) => {
    if (!suggestionId) return;
    setWorkbenchLoading(true);
    setError("");
    try {
      const result = await apiFetch(`${endpoints.workbench || endpoints.suggestions}/${suggestionId}/workbench`);
      setWorkbench(result);
      if (result.material?.id) {
        setSelectedMaterialId(result.material.id);
        await loadSelectedDetail(result.material.id);
      }
    } catch (err) {
      setWorkbench(null);
      setError(parseApiError(err));
    } finally {
      setWorkbenchLoading(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewResult, materialsResult, suggestionsResult] = await Promise.all([
        apiFetch(endpoints.overview),
        apiFetch(`${endpoints.materials}?limit=200`),
        apiFetch(`${endpoints.suggestions}?limit=50`)
      ]);
      const nextMaterials = materialsResult.items || [];
      const nextSuggestions = suggestionsResult.items || [];
      setOverview(overviewResult);
      setMaterials(nextMaterials);
      setSuggestions(nextSuggestions);
      if (!selectedMaterialId && nextMaterials[0]?.id) setSelectedMaterialId(nextMaterials[0].id);
      if (!selectedQueueKey) {
        const firstKey = nextSuggestions[0]?.id
          ? `suggestion:${nextSuggestions[0].id}`
          : overviewResult.stock_alerts?.[0]?.id
            ? `alert:${overviewResult.stock_alerts[0].id}`
            : "";
        if (firstKey) setSelectedQueueKey(firstKey);
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedQueueItem) return;
    if (selectedQueueItem.kind === "suggestion") {
      loadWorkbench(selectedQueueItem.id);
      return;
    }
    setWorkbench(null);
    setSelectedMaterialId(selectedQueueItem.material_id);
    loadSelectedDetail(selectedQueueItem.material_id);
  }, [selectedQueueItem?.key]);

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
    if (!activeMaterial?.id) return;
    setActionLoading(true);
    setNotice("");
    setError("");
    try {
      await apiFetch(`${endpoints.materials}/${activeMaterial.id}/policy`, {
        method: "PATCH",
        body: {
          ...policyForm,
          reorder_point: policyForm.reorder_point === "" ? 0 : Number(policyForm.reorder_point),
          reorder_qty: policyForm.reorder_qty === "" ? 0 : Number(policyForm.reorder_qty),
          minimum_stock: policyForm.minimum_stock === "" ? 0 : Number(policyForm.minimum_stock),
          maximum_stock: policyForm.maximum_stock === "" ? 0 : Number(policyForm.maximum_stock),
          safety_stock: policyForm.safety_stock === "" ? 0 : Number(policyForm.safety_stock),
          lead_time_days: policyForm.lead_time_days === "" ? 0 : Number(policyForm.lead_time_days),
          safety_lead_time_days: policyForm.safety_lead_time_days === "" ? 0 : Number(policyForm.safety_lead_time_days),
          daily_consumption_rate: policyForm.daily_consumption_rate === "" ? 0 : Number(policyForm.daily_consumption_rate),
          minimum_order_qty: policyForm.minimum_order_qty === "" ? 0 : Number(policyForm.minimum_order_qty),
          order_multiple: policyForm.order_multiple === "" ? 0 : Number(policyForm.order_multiple),
          unit_cost: policyForm.unit_cost === "" ? 0 : Number(policyForm.unit_cost),
          average_cost: policyForm.average_cost === "" ? 0 : Number(policyForm.average_cost),
          freight_cost_estimate: policyForm.freight_cost_estimate === "" ? 0 : Number(policyForm.freight_cost_estimate),
          approval_threshold_value: policyForm.approval_threshold_value === "" ? 0 : Number(policyForm.approval_threshold_value),
          target_service_level: policyForm.target_service_level === "" ? 0 : Number(policyForm.target_service_level)
        }
      });
      setNotice("Inventory policy saved.");
      await loadAll();
      await loadSelectedDetail(activeMaterial.id);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const createMovement = async () => {
    if (!activeMaterial?.id) return;
    setActionLoading(true);
    setNotice("");
    setError("");
    try {
      await apiFetch(`${endpoints.materials}/${activeMaterial.id}/movements`, {
        method: "POST",
        body: {
          ...movementForm,
          quantity: Number(movementForm.quantity)
        }
      });
      setMovementForm((current) => ({ ...current, quantity: "", reason: "" }));
      setNotice("Stock movement recorded.");
      await loadAll();
      await loadSelectedDetail(activeMaterial.id);
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
      const selected = result.created?.[0] || result.existing?.[0] || null;
      if (selected?.id) setSelectedQueueKey(`suggestion:${selected.id}`);
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
      setNotice(action === "approve" ? "Purchase need approved." : "Inventory signal ignored.");
      await loadAll();
      await loadWorkbench(id);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const createSuggestionTask = async (id, body = {}) => {
    setActionLoading(true);
    setNotice("");
    setError("");
    try {
      await apiFetch(`${endpoints.suggestions}/${id}/tasks`, {
        method: "POST",
        body: { task_type: "SUPPLIER_CHECK", title: "Check supplier before purchase", ...body }
      });
      setNotice("Supplier check task created.");
      await loadWorkbench(id);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleWorkbenchAction = async (action) => {
    if (!action || actionLoading) return;
    if (action.code === "approve_reorder_suggestion" && workbench?.signal?.id) {
      await suggestionAction(workbench.signal.id, "approve");
      return;
    }
    if (action.code === "ignore_signal" && workbench?.signal?.id) {
      await suggestionAction(workbench.signal.id, "ignore");
      return;
    }
    if (action.code === "create_supplier_check_task" && workbench?.signal?.id) {
      await createSuggestionTask(workbench.signal.id, action.body || {});
      return;
    }
    if (action.code === "open_procurement_workbench") {
      ctx?.user?.setActiveTab?.("procurement");
      setNotice("Open the Procurement Purchase Need Workbench to continue supplier options, route, RFQ, and purchase preparation.");
      return;
    }
    if (action.code === "adjust_reorder_policy") {
      setNotice("Use the policy tools below to complete the material reorder policy.");
    }
  };

  const workbenchInventory = workbench?.inventory_state || selectedProfile || {};
  const workbenchActions = workbench?.next_actions || [];
  const policySource = workbench?.policy_source || {
    source: selectedProfile.policy_source,
    condition_codes: selectedProfile.policy_condition_codes || [],
    commercial_condition_governed: Boolean(selectedProfile.policy_condition_codes?.length)
  };
  const materialOverride = workbench?.material_override || {
    fields: selectedProfile.material_override_fields || [],
    values: {}
  };
  const recentMovements = workbench?.recent_movements || selectedDetail?.movements || overview?.recent_movements || [];

  return (
    <section className="space-y-5">
      <div className="glass-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-ink-400">Inventory</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink-900">{props.title || "Inventory"}</h1>
            <p className="mt-1 max-w-3xl text-sm text-ink-500">
              {props.subtitle || "Stock signal queue, policy-backed recommendation, procurement handoff, and timeline."}
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Low stock" value={overview?.stats?.low_stock} icon={TrendingDown} tone="text-amber-600" />
        <Metric label="Out of stock" value={overview?.stats?.out_of_stock} icon={AlertTriangle} tone="text-rose-600" />
        <Metric label="Stockout risk" value={overview?.stats?.stockout_predicted} icon={AlertTriangle} tone="text-orange-600" />
        <Metric label="Cash needed" value={formatMoney(overview?.stats?.estimated_cash_required_for_reorder)} icon={ClipboardList} tone="text-indigo-600" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <aside className="glass-panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Stock Signals Queue</h2>
              <p className="text-xs text-ink-500">Start from one risk signal, not a backend table.</p>
            </div>
            <button
              type="button"
              onClick={() => runReorder()}
              disabled={actionLoading}
              className="rounded-full bg-ink-900 px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-60"
            >
              Scan
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-2">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search material..."
              className="min-w-0 flex-1 bg-transparent text-sm text-ink-700 outline-none"
            />
          </div>
          <div className="mt-4 space-y-2">
            {filteredQueue.length ? filteredQueue.map((item) => {
              const selected = selectedQueueItem?.key === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedQueueKey(item.key)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    selected
                      ? "border-ink-900 bg-white shadow-soft"
                      : "border-white/70 bg-white/70 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">{item.label}</p>
                      <p className="truncate text-xs text-ink-400">{item.code || formatLabel(item.kind)}</p>
                    </div>
                    <StatusPill status={item.risk_status || item.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-ink-500">{item.summary}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-500">
                    <span>Suggest <strong className="block text-ink-800">{formatQty(item.suggested_qty, item.unit_of_measure)}</strong></span>
                    <span>Cash <strong className="block text-ink-800">{formatMoney(item.cash_required_for_reorder)}</strong></span>
                  </div>
                </button>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                No stock signals yet. Run the low-stock scan to create review work.
              </div>
            )}
          </div>
        </aside>

        <main className="space-y-4">
          <div className="glass-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">Inventory Signal Workbench</h2>
                <p className="text-sm text-ink-500">
                  {workbench?.signal?.label || selectedQueueItem?.label || "Select a stock signal to see the business journey."}
                </p>
              </div>
              {workbenchLoading ? <Loader2 className="h-5 w-5 animate-spin text-ink-400" /> : <StatusPill status={workbench?.signal?.status || selectedQueueItem?.status} />}
            </div>

            {workbench ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-white/70 bg-white/75 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{workbench.risk_explanation?.headline || "Review stock signal."}</p>
                      <p className="mt-1 text-sm text-ink-500">{workbench.risk_explanation?.reason || "Backend recommendation explains why this item needs attention."}</p>
                      {workbench.risk_explanation?.explanation?.length ? (
                        <ul className="mt-3 grid gap-1 text-xs text-ink-500 sm:grid-cols-2">
                          {workbench.risk_explanation.explanation.map((line) => <li key={line}>{line}</li>)}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Detail label="Current stock state" value={formatLabel(workbenchInventory.stock_status || workbenchInventory.risk_status)} />
                  <Detail label="Available" value={formatQty(workbenchInventory.available_qty, workbenchInventory.unit_of_measure)} />
                  <Detail label="Suggested reorder" value={formatQty(workbenchInventory.suggested_qty, workbenchInventory.unit_of_measure)} />
                  <Detail label="Cash impact" value={formatMoney(workbenchInventory.cash_required_for_reorder)} />
                  <Detail label="Days cover" value={workbenchInventory.days_of_cover ?? "-"} />
                  <Detail label="Stockout date" value={workbenchInventory.predicted_out_of_stock_date || "-"} />
                  <Detail label="Supplier risk" value={formatLabel(workbenchInventory.supplier_risk_level)} />
                  <Detail label="Material" value={workbench.material?.label || workbench.material?.name || "-"} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/70 bg-white/75 p-4">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                      <ShieldCheck className="h-4 w-4" />
                      Policy details
                    </h3>
                    <div className="mt-3 grid gap-2 text-xs text-ink-500">
                      <Detail label="Governed policy source" value={formatLabel(policySource.source || "not resolved")} />
                      <Detail label="Commercial condition codes" value={policySource.condition_codes?.length ? policySource.condition_codes.join(", ") : "-"} />
                      <Detail label="Material overrides" value={materialOverride.fields?.length ? materialOverride.fields.join(", ") : "-"} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/70 bg-white/75 p-4">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                      <ArrowRight className="h-4 w-4" />
                      Procurement bridge
                    </h3>
                    <p className="mt-2 text-sm text-ink-500">{workbench.procurement_bridge?.boundary}</p>
                    <div className="mt-3 grid gap-2 text-xs text-ink-500">
                      <Detail label="Bridge status" value={formatLabel(workbench.procurement_bridge?.status)} />
                      <Detail label="Requisition" value={workbench.procurement_bridge?.requisition?.label || "Not created"} />
                      <Detail label="RFQ" value={workbench.procurement_bridge?.rfq?.label || "Not started"} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/70 bg-white/75 p-4">
                    <h3 className="text-base font-semibold text-ink-900">Process timeline</h3>
                    <div className="mt-3 space-y-2">
                      {workbench.process_timeline?.length ? workbench.process_timeline.map((item) => (
                        <div key={`${item.code}:${item.timestamp || item.status || item.label}`} className="rounded-xl border border-ink-100 bg-white/70 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-ink-800">{item.label}</span>
                            <span className="text-xs text-ink-400">{formatDate(item.timestamp)}</span>
                          </div>
                          <p className="mt-1 text-xs text-ink-500">{formatLabel(item.status)}{item.detail ? ` - ${item.detail}` : ""}</p>
                        </div>
                      )) : <p className="text-sm text-ink-400">No timeline events yet.</p>}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/70 bg-white/75 p-4">
                    <h3 className="text-base font-semibold text-ink-900">Recent stock movements</h3>
                    <div className="mt-3 space-y-2">
                      {recentMovements.length ? recentMovements.slice(0, 6).map((item) => (
                        <div key={item.id} className="rounded-xl border border-ink-100 bg-white/70 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-ink-800">{formatLabel(item.movement_type || item.payload?.movement_type || item.title)}</span>
                            <span className="text-xs text-ink-400">{formatDate(item.created_at)}</span>
                          </div>
                          <p className="mt-1 text-xs text-ink-500">
                            {formatLabel(item.direction || item.payload?.direction)} {formatQty(item.quantity ?? item.payload?.quantity, item.unit_of_measure || item.payload?.unit_of_measure)}
                            {" "}- Balance {formatQty(item.balance_after ?? item.payload?.balance_after, item.unit_of_measure || item.payload?.unit_of_measure)}
                          </p>
                        </div>
                      )) : <p className="text-sm text-ink-400">No movements recorded yet.</p>}
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedQueueItem ? (
              <div className="mt-5 rounded-2xl border border-white/70 bg-white/75 p-4">
                <p className="text-sm font-semibold text-ink-900">{selectedQueueItem.summary}</p>
                <p className="mt-2 text-sm text-ink-500">
                  This stock signal needs a governed reorder suggestion before it can become a procurement purchase need.
                </p>
                <button
                  type="button"
                  onClick={() => runReorder(selectedQueueItem.material_id, true)}
                  disabled={actionLoading}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-60"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                  {actions.createSuggestion}
                </button>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-10 text-center text-sm text-ink-400">
                Run the low-stock scan to build the owner workbench.
              </div>
            )}
          </div>
        </main>

        <aside className="glass-panel p-4">
          <h2 className="text-base font-semibold text-ink-900">Action Rail</h2>
          <p className="mt-1 text-xs text-ink-500">One clear next owner action. Buying work stays in Procurement.</p>
          <div className="mt-4 space-y-2">
            {workbenchActions.length ? workbenchActions.map((action) => (
              <button
                key={action.code}
                type="button"
                onClick={() => handleWorkbenchAction(action)}
                disabled={actionLoading}
                className={`w-full rounded-2xl px-3 py-3 text-left text-sm font-semibold disabled:opacity-60 ${
                  action.tone === "danger"
                    ? "bg-rose-50 text-rose-700"
                    : action.tone === "primary"
                      ? "bg-ink-900 text-white"
                      : "border border-ink-100 bg-white text-ink-700"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  {action.label}
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                </span>
                <span className={`mt-1 block text-xs font-normal ${action.tone === "primary" ? "text-white/75" : "text-ink-500"}`}>{action.reason}</span>
              </button>
            )) : selectedQueueItem ? (
              <button
                type="button"
                onClick={() => runReorder(selectedQueueItem.material_id, true)}
                disabled={actionLoading}
                className="w-full rounded-2xl bg-ink-900 px-3 py-3 text-left text-sm font-semibold text-white disabled:opacity-60"
              >
                Create reorder suggestion
                <span className="mt-1 block text-xs font-normal text-white/75">Create a governed inventory signal before procurement handoff.</span>
              </button>
            ) : (
              <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                Select a stock signal for actions.
              </div>
            )}
          </div>
        </aside>
      </div>

      <details className="glass-panel p-5">
        <summary className="cursor-pointer text-base font-semibold text-ink-900">
          Material lookup and policy tools
        </summary>
        <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <div>
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
            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/70 bg-white/70">
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
                    const selected = activeMaterial?.id === item.id;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedMaterialId(item.id);
                          setWorkbench(null);
                          loadSelectedDetail(item.id);
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
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-soft">
              <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
                <SlidersHorizontal className="h-4 w-4" />
                Reorder policy
              </h3>
              <p className="mt-1 text-sm text-ink-500">{activeMaterial?.name || "Select a material"}</p>
              <div className="mt-3 grid gap-2 rounded-2xl border border-white/70 bg-white/70 p-3 text-xs text-ink-500">
                <div className="grid gap-2 sm:grid-cols-2">
                  <span>Governed policy source <strong className="block text-ink-800">{formatLabel(selectedProfile.policy_source || "not resolved")}</strong></span>
                  <span>Condition codes <strong className="block text-ink-800">{selectedProfile.policy_condition_codes?.length ? selectedProfile.policy_condition_codes.join(", ") : "-"}</strong></span>
                  <span>Material overrides <strong className="block text-ink-800">{selectedProfile.material_override_fields?.length ? selectedProfile.material_override_fields.join(", ") : "-"}</strong></span>
                  <span>Current stock state <strong className="block text-ink-800">{formatLabel(selectedProfile.stock_status || selectedProfile.risk_status || "unknown")}</strong></span>
                  <span>Calculated recommendation <strong className="block text-ink-800">{formatLabel(selectedProfile.recommendation?.action || "monitor")}</strong></span>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <Field label="Track stock" type="checkbox" value={policyForm.track_stock} onChange={(value) => setPolicyForm((current) => ({ ...current, track_stock: value }))} />
                <Field label="Reorder point" type="number" value={policyForm.reorder_point} onChange={(value) => setPolicyForm((current) => ({ ...current, reorder_point: value }))} />
                <Field label="Reorder quantity" type="number" value={policyForm.reorder_qty} onChange={(value) => setPolicyForm((current) => ({ ...current, reorder_qty: value }))} />
                <Field label="Safety stock" type="number" value={policyForm.safety_stock} onChange={(value) => setPolicyForm((current) => ({ ...current, safety_stock: value }))} />
                <Field label="Unit" value={policyForm.unit_of_measure} onChange={(value) => setPolicyForm((current) => ({ ...current, unit_of_measure: value }))} />
                <Field label="Lead time days" type="number" value={policyForm.lead_time_days} onChange={(value) => setPolicyForm((current) => ({ ...current, lead_time_days: value }))} />
                <Field label="Safety lead days" type="number" value={policyForm.safety_lead_time_days} onChange={(value) => setPolicyForm((current) => ({ ...current, safety_lead_time_days: value }))} />
                <Field label="Daily use/sales rate" type="number" value={policyForm.daily_consumption_rate} onChange={(value) => setPolicyForm((current) => ({ ...current, daily_consumption_rate: value }))} />
                <Field label="Minimum stock" type="number" value={policyForm.minimum_stock} onChange={(value) => setPolicyForm((current) => ({ ...current, minimum_stock: value }))} />
                <Field label="Maximum stock" type="number" value={policyForm.maximum_stock} onChange={(value) => setPolicyForm((current) => ({ ...current, maximum_stock: value }))} />
                <Field label="Minimum order quantity" type="number" value={policyForm.minimum_order_qty} onChange={(value) => setPolicyForm((current) => ({ ...current, minimum_order_qty: value }))} />
                <Field label="Order multiple" type="number" value={policyForm.order_multiple} onChange={(value) => setPolicyForm((current) => ({ ...current, order_multiple: value }))} />
                <Field label="Unit cost" type="number" value={policyForm.unit_cost} onChange={(value) => setPolicyForm((current) => ({ ...current, unit_cost: value }))} />
                <Field label="Average cost" type="number" value={policyForm.average_cost} onChange={(value) => setPolicyForm((current) => ({ ...current, average_cost: value }))} />
                <Field label="Freight estimate" type="number" value={policyForm.freight_cost_estimate} onChange={(value) => setPolicyForm((current) => ({ ...current, freight_cost_estimate: value }))} />
                <Field label="Approval threshold" type="number" value={policyForm.approval_threshold_value} onChange={(value) => setPolicyForm((current) => ({ ...current, approval_threshold_value: value }))} />
                <Field label="Target service level" type="number" value={policyForm.target_service_level} onChange={(value) => setPolicyForm((current) => ({ ...current, target_service_level: value }))} />
                <Field
                  label="ABC class"
                  type="select"
                  value={policyForm.abc_classification}
                  onChange={(value) => setPolicyForm((current) => ({ ...current, abc_classification: value }))}
                  options={[
                    { value: "", label: "Not set" },
                    { value: "A", label: "A" },
                    { value: "B", label: "B" },
                    { value: "C", label: "C" }
                  ]}
                />
                <Field
                  label="Supplier risk"
                  type="select"
                  value={policyForm.supplier_risk_level}
                  onChange={(value) => setPolicyForm((current) => ({ ...current, supplier_risk_level: value }))}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                    { value: "critical", label: "Critical" }
                  ]}
                />
                <Field label="Single source risk" type="checkbox" value={policyForm.single_source_risk} onChange={(value) => setPolicyForm((current) => ({ ...current, single_source_risk: value }))} />
                <Field label="Auto reorder proposals" type="checkbox" value={policyForm.auto_reorder_enabled} onChange={(value) => setPolicyForm((current) => ({ ...current, auto_reorder_enabled: value }))} />
                <Field label="Approval required" type="checkbox" value={policyForm.approval_required} onChange={(value) => setPolicyForm((current) => ({ ...current, approval_required: value }))} />
                <Field label="Preferred supplier reference" value={policyForm.preferred_supplier_agent_id} onChange={(value) => setPolicyForm((current) => ({ ...current, preferred_supplier_agent_id: value }))} />
                <button
                  type="button"
                  onClick={savePolicy}
                  disabled={!activeMaterial || actionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-60"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {actions.policy}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-soft">
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
                  disabled={!activeMaterial || actionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-60"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {actions.adjust}
                </button>
              </div>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
