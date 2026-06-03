import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  ShoppingCart,
  Truck,
  WalletCards
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const DEFAULT_TABS = [
  { id: "workbench", label: "Purchase Need Workbench" },
  { id: "supplier-policy", label: "Supplier Policy" },
  { id: "history", label: "History" }
];

const DEFAULT_ACTIONS = {
  refresh: "Refresh",
  createRequisition: "Create requisition",
  approve: "Approve",
  ignore: "Ignore",
  createRfq: "Request quotes",
  addQuote: "Add supplier offer",
  compareQuotes: "Compare offers",
  approveQuote: "Approve recommended offer",
  saveSupplierLink: "Save supplier link",
  recordCashPurchase: "Record cash purchase"
};

const DEFAULT_ENDPOINTS = {
  overview: "/api/eip/procurement/overview",
  workbench: "/api/eip/procurement/purchase-needs",
  lookup: "/api/eip/procurement/lookup",
  supplierLinks: "/api/eip/procurement/supplier-links",
  requisitions: "/api/eip/procurement/requisitions",
  rfqs: "/api/eip/procurement/rfqs",
  cashPurchases: "/api/eip/procurement/cash-purchases"
};

const STATUS_TONES = {
  open: "bg-amber-50 text-amber-700 border-amber-100",
  review: "bg-amber-50 text-amber-700 border-amber-100",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-100",
  draft: "bg-slate-50 text-slate-700 border-slate-100",
  comparison_ready: "bg-indigo-50 text-indigo-700 border-indigo-100",
  supplier_selected: "bg-emerald-50 text-emerald-700 border-emerald-100",
  ignored: "bg-rose-50 text-rose-700 border-rose-100",
  recorded: "bg-emerald-50 text-emerald-700 border-emerald-100",
  closed: "bg-slate-100 text-slate-600 border-slate-200"
};

const RISK_TONES = {
  already_out_of_stock: "text-rose-700",
  stockout_predicted: "text-orange-700",
  reorder_now: "text-amber-700",
  watch: "text-blue-700",
  healthy: "text-emerald-700"
};

function formatLabel(value) {
  const text = String(value || "").replace(/_/g, " ").trim();
  return text ? text.replace(/\b\w/g, (char) => char.toUpperCase()) : "-";
}

function formatMoney(value, currency = "") {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "-";
  const amount = number.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${amount}${currency ? ` ${currency}` : ""}`;
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
    if (payload?.error === "FORBIDDEN") return "Access denied. Ask an admin to grant procurement permissions.";
    if (payload?.error === "PROCESS_BINDING_REQUIRED") return "Procurement workflow is not configured for this tenant.";
    if (payload?.error === "INVALID_TRANSITION") return "That procurement action is not allowed from the current status.";
    if (payload?.error) return formatLabel(payload.error);
  } catch {
    return match[2] || message;
  }
  return message;
}

function StatusPill({ status }) {
  const tone = STATUS_TONES[status] || STATUS_TONES.draft;
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

function ActionButton({ children, onClick, disabled, tone = "dark", icon: Icon }) {
  const toneClass = tone === "soft"
    ? "border border-ink-100 bg-white text-ink-600"
    : tone === "success"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "danger"
        ? "bg-rose-100 text-rose-700"
        : "bg-ink-900 text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] disabled:opacity-60 ${toneClass}`}
    >
      {Icon ? <Icon className={`h-4 w-4 ${Icon === Loader2 ? "animate-spin" : ""}`} /> : null}
      {children}
    </button>
  );
}

function SelectField({ label, value, onChange, options, placeholder = "Select" }) {
  return (
    <label className="block text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-ink-400">
      {label}
      <select
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        className="mt-1 w-full rounded-xl border border-ink-100 bg-white px-3 py-2 text-sm normal-case tracking-normal text-ink-700"
      >
        <option value="">{placeholder}</option>
        {(options || []).map((option) => (
          <option key={option.id || option.value} value={option.id || option.value}>
            {option.label || option.name || option.code}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({ label, value, onChange, placeholder }) {
  return (
    <label className="block text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-ink-400">
      {label}
      <input
        type="number"
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-ink-100 bg-white px-3 py-2 text-sm normal-case tracking-normal text-ink-700"
      />
    </label>
  );
}

function TextField({ label, value, onChange, placeholder }) {
  return (
    <label className="block text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-ink-400">
      {label}
      <input
        type="text"
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-ink-100 bg-white px-3 py-2 text-sm normal-case tracking-normal text-ink-700"
      />
    </label>
  );
}

function InfoPair({ label, value, strong = false }) {
  return (
    <span className="text-xs text-ink-500">
      {label}
      <strong className={`block ${strong ? "text-ink-900" : "text-ink-800"}`}>{value ?? "-"}</strong>
    </span>
  );
}

function supplierLabel(candidate) {
  return candidate?.supplier_name || candidate?.supplier_code || candidate?.label || "Supplier";
}

export default function ProcurementWorkspace({ node } = {}) {
  const props = node?.props || {};
  const endpoints = { ...DEFAULT_ENDPOINTS, ...(props.endpoints || {}) };
  const actions = { ...DEFAULT_ACTIONS, ...(props.actions || {}) };
  const tabs = Array.isArray(props.tabs) && props.tabs.length ? props.tabs : DEFAULT_TABS;

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || "workbench");
  const [overview, setOverview] = useState(null);
  const [workbench, setWorkbench] = useState(null);
  const [supplierLinks, setSupplierLinks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedNeedId, setSelectedNeedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [workbenchLoading, setWorkbenchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [supplierForm, setSupplierForm] = useState({
    material_id: "",
    supplier_agent_id: "",
    supplier_role: "preferred",
    accreditation_status: "approved",
    last_price: "",
    currency: "EUR",
    lead_time_days: "",
    payment_terms_code: "NET_30"
  });
  const [quoteForm, setQuoteForm] = useState({
    supplier_agent_id: "",
    unit_price: "",
    quoted_qty: "",
    currency: "EUR",
    lead_time_days: "",
    freight_cost: "",
    payment_terms_code: "NET_30"
  });
  const [cashForm, setCashForm] = useState({
    supplier_agent_id: "",
    quantity: "",
    unit_cost: "",
    currency: "EUR",
    receipt_ref: ""
  });

  const purchaseNeeds = overview?.purchase_needs || [];
  const stats = overview?.stats || {};
  const selectedNeed = workbench?.purchase_need || null;
  const inventory = workbench?.inventory_state || {};
  const recommendation = workbench?.recommended_procurement_model || {};
  const candidates = workbench?.supplier_candidates || [];
  const rfq = workbench?.rfq || null;
  const requisition = workbench?.requisition || null;
  const quotes = workbench?.quotes || [];
  const quoteComparison = workbench?.quote_comparison || null;
  const cashOption = workbench?.cash_purchase_option || null;
  const timeline = workbench?.process_timeline || [];
  const nextActions = workbench?.next_actions || [];

  const candidateSupplierOptions = useMemo(() => {
    const candidateOptions = candidates
      .filter((candidate) => candidate.supplier_agent_id)
      .map((candidate) => ({
        id: candidate.supplier_agent_id,
        label: `${supplierLabel(candidate)} - ${formatLabel(candidate.supplier_role)} - ${formatMoney(candidate.estimated_landed_cost, candidate.currency)}`
      }));
    if (candidateOptions.length) return candidateOptions;
    return suppliers;
  }, [candidates, suppliers]);

  const supplierNameById = useMemo(() => {
    const map = new Map();
    candidates.forEach((candidate) => {
      if (candidate.supplier_agent_id) map.set(candidate.supplier_agent_id, supplierLabel(candidate));
    });
    suppliers.forEach((supplier) => {
      if (supplier.id) map.set(supplier.id, supplier.label || supplier.name || supplier.code || "Supplier");
    });
    return map;
  }, [candidates, suppliers]);

  const filteredNeeds = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return purchaseNeeds;
    return purchaseNeeds.filter((item) => {
      const attrs = item.attrs || {};
      return [item.code, item.title, item.status, attrs.material_name, attrs.material_code, attrs.risk_status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [purchaseNeeds, query]);

  const loadLookups = async () => {
    const [materialResult, supplierResult] = await Promise.all([
      apiFetch(`${endpoints.lookup}?kind=material&limit=50`),
      apiFetch(`${endpoints.lookup}?kind=supplier&limit=50`)
    ]);
    setMaterials(materialResult.items || []);
    setSuppliers(supplierResult.items || []);
  };

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewResult, supplierResult] = await Promise.all([
        apiFetch(endpoints.overview),
        apiFetch(`${endpoints.supplierLinks}?limit=200`)
      ]);
      setOverview(overviewResult);
      setSupplierLinks(supplierResult.items || []);
      await loadLookups();
      const firstNeed = overviewResult.purchase_needs?.[0]?.id || "";
      setSelectedNeedId((current) => current || firstNeed);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadWorkbench = async (needId) => {
    if (!needId) {
      setWorkbench(null);
      return;
    }
    setWorkbenchLoading(true);
    setError("");
    try {
      const result = await apiFetch(`${endpoints.workbench}/${needId}/workbench`);
      setWorkbench(result);
      const firstCandidate = result.supplier_candidates?.find((candidate) => candidate.supplier_agent_id);
      setQuoteForm((current) => ({
        ...current,
        supplier_agent_id: current.supplier_agent_id || firstCandidate?.supplier_agent_id || "",
        quoted_qty: current.quoted_qty || result.inventory_state?.suggested_qty || "",
        currency: current.currency || result.recommended_procurement_model?.currency || "EUR"
      }));
      setCashForm((current) => ({
        ...current,
        supplier_agent_id: current.supplier_agent_id || firstCandidate?.supplier_agent_id || "",
        quantity: current.quantity || result.cash_purchase_option?.quantity || result.inventory_state?.suggested_qty || "",
        unit_cost: current.unit_cost || result.recommended_procurement_model?.estimated_unit_cost || "",
        currency: current.currency || result.cash_purchase_option?.currency || result.recommended_procurement_model?.currency || "EUR"
      }));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setWorkbenchLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadWorkbench(selectedNeedId);
  }, [selectedNeedId]);

  const refreshAfterAction = async () => {
    await loadAll();
    if (selectedNeedId) await loadWorkbench(selectedNeedId);
  };

  const runEndpointAction = async (action, bodyOverride) => {
    if (!action?.endpoint) return;
    setActionLoading(action.code);
    setNotice("");
    setError("");
    try {
      await apiFetch(action.endpoint, {
        method: "POST",
        body: bodyOverride ?? action.body ?? {}
      });
      setNotice(action.label ? `${action.label} completed.` : "Action completed.");
      await refreshAfterAction();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setActionLoading("");
    }
  };

  const saveSupplierLink = async () => {
    setActionLoading("save_supplier_link");
    setNotice("");
    setError("");
    try {
      await apiFetch(endpoints.supplierLinks, {
        method: "POST",
        body: {
          ...supplierForm,
          last_price: supplierForm.last_price === "" ? 0 : Number(supplierForm.last_price),
          lead_time_days: supplierForm.lead_time_days === "" ? 0 : Number(supplierForm.lead_time_days)
        }
      });
      setNotice("Supplier link saved.");
      await refreshAfterAction();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setActionLoading("");
    }
  };

  const addQuote = async () => {
    if (!rfq?.id) return;
    await runEndpointAction(
      { code: "add_quote", label: actions.addQuote, endpoint: `${endpoints.rfqs}/${rfq.id}/quotes` },
      {
        ...quoteForm,
        unit_price: quoteForm.unit_price === "" ? 0 : Number(quoteForm.unit_price),
        quoted_qty: quoteForm.quoted_qty === "" ? 0 : Number(quoteForm.quoted_qty),
        lead_time_days: quoteForm.lead_time_days === "" ? 0 : Number(quoteForm.lead_time_days),
        freight_cost: quoteForm.freight_cost === "" ? 0 : Number(quoteForm.freight_cost)
      }
    );
  };

  const recordCashPurchase = async () => {
    if (!workbench?.material?.id) return;
    await runEndpointAction(
      { code: "record_cash_purchase", label: actions.recordCashPurchase, endpoint: endpoints.cashPurchases },
      {
        ...cashForm,
        material_id: workbench.material.id,
        quantity: cashForm.quantity === "" ? 0 : Number(cashForm.quantity),
        unit_cost: cashForm.unit_cost === "" ? 0 : Number(cashForm.unit_cost)
      }
    );
  };

  const renderNextActionButton = (action) => {
    if (action.code === "add_quote") {
      return (
        <ActionButton key={action.code} onClick={addQuote} disabled={Boolean(actionLoading) || !rfq?.id || !quoteForm.supplier_agent_id} icon={actionLoading === action.code ? Loader2 : CheckCircle2}>
          {action.label}
        </ActionButton>
      );
    }
    if (action.code === "record_cash_purchase") {
      return (
        <ActionButton key={action.code} onClick={recordCashPurchase} disabled={Boolean(actionLoading) || !workbench?.material?.id} icon={actionLoading === action.code ? Loader2 : WalletCards}>
          {action.label}
        </ActionButton>
      );
    }
    if (!action.endpoint) {
      return (
        <ActionButton key={action.code} disabled tone="soft" icon={CheckCircle2}>
          {action.label}
        </ActionButton>
      );
    }
    return (
      <ActionButton
        key={action.code}
        onClick={() => runEndpointAction(action)}
        disabled={Boolean(actionLoading)}
        tone={action.tone === "danger" ? "danger" : action.tone === "soft" ? "soft" : "dark"}
        icon={actionLoading === action.code ? Loader2 : ChevronRight}
      >
        {action.label}
      </ActionButton>
    );
  };

  return (
    <section className="space-y-5">
      <div className="glass-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-ink-400">Procurement</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink-900">{props.title || "Purchase Need Workbench"}</h1>
            <p className="mt-1 max-w-3xl text-sm text-ink-500">
              {props.subtitle || "A guided flow from stock need to supplier options, buying route, quote comparison, and owner approval."}
            </p>
          </div>
          <ActionButton onClick={loadAll} disabled={loading} tone="soft" icon={loading ? Loader2 : RefreshCw}>
            {actions.refresh}
          </ActionButton>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                activeTab === tab.id ? "bg-ink-900 text-white" : "border border-white/60 bg-white/80 text-ink-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="Supplier links" value={stats.supplier_links} icon={Truck} tone="text-indigo-600" />
        <Metric label="Purchase needs" value={stats.open_purchase_needs} icon={ClipboardList} tone="text-amber-600" />
        <Metric label="Requisitions" value={stats.purchase_requisitions} icon={ShoppingCart} tone="text-emerald-600" />
        <Metric label="Requests for quotes" value={stats.rfqs} icon={Scale} tone="text-blue-600" />
        <Metric label="Cash purchases" value={stats.cash_purchases} icon={WalletCards} tone="text-rose-600" />
      </div>

      {activeTab === "supplier-policy" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <div className="glass-panel p-5">
            <h2 className="text-lg font-semibold text-ink-900">Supplier options library</h2>
            <p className="mt-1 text-sm text-ink-500">These links become supplier options inside each purchase need workbench.</p>
            <div className="mt-4 space-y-3">
              {supplierLinks.length ? supplierLinks.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/70 bg-white/75 p-4 text-sm shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink-900">{item.supplier_name || item.supplier_code || "Supplier"}</p>
                      <p className="text-xs text-ink-400">{item.material_name || item.material_code || "Material"}</p>
                    </div>
                    <StatusPill status={item.attrs?.accreditation_status || "approved"} />
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-ink-500 sm:grid-cols-4">
                    <InfoPair label="Role" value={formatLabel(item.attrs?.supplier_role)} />
                    <InfoPair label="Last price" value={formatMoney(item.attrs?.last_price, item.attrs?.currency)} />
                    <InfoPair label="Lead time" value={`${item.attrs?.lead_time_days ?? "-"} days`} />
                    <InfoPair label="Payment" value={item.attrs?.payment_terms_code || "-"} />
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                  No supplier options are configured yet.
                </div>
              )}
            </div>
          </div>
          <div className="glass-panel p-5">
            <h3 className="text-base font-semibold text-ink-900">Add supplier option</h3>
            <p className="mt-1 text-sm text-ink-500">Choose readable material and supplier records; policy still stores governed references.</p>
            <div className="mt-4 grid gap-3">
              <SelectField label="Material" value={supplierForm.material_id} onChange={(value) => setSupplierForm((current) => ({ ...current, material_id: value }))} options={materials} placeholder="Select material" />
              <SelectField label="Supplier" value={supplierForm.supplier_agent_id} onChange={(value) => setSupplierForm((current) => ({ ...current, supplier_agent_id: value }))} options={suppliers} placeholder="Select supplier" />
              <SelectField
                label="Supplier role"
                value={supplierForm.supplier_role}
                onChange={(value) => setSupplierForm((current) => ({ ...current, supplier_role: value }))}
                options={[
                  { value: "preferred", label: "Preferred" },
                  { value: "backup", label: "Backup" },
                  { value: "contract", label: "Contract" },
                  { value: "cash_supplier", label: "Cash supplier" },
                  { value: "marketplace", label: "Marketplace" },
                  { value: "blocked", label: "Blocked" }
                ]}
              />
              <SelectField
                label="Accreditation"
                value={supplierForm.accreditation_status}
                onChange={(value) => setSupplierForm((current) => ({ ...current, accreditation_status: value }))}
                options={[
                  { value: "approved", label: "Approved" },
                  { value: "pending", label: "Pending" },
                  { value: "trial", label: "Trial" },
                  { value: "blocked", label: "Blocked" },
                  { value: "expired", label: "Expired" }
                ]}
              />
              <NumberField label="Last unit price" value={supplierForm.last_price} onChange={(value) => setSupplierForm((current) => ({ ...current, last_price: value }))} />
              <TextField label="Currency" value={supplierForm.currency} onChange={(value) => setSupplierForm((current) => ({ ...current, currency: value }))} />
              <NumberField label="Lead time days" value={supplierForm.lead_time_days} onChange={(value) => setSupplierForm((current) => ({ ...current, lead_time_days: value }))} />
              <TextField label="Payment terms" value={supplierForm.payment_terms_code} onChange={(value) => setSupplierForm((current) => ({ ...current, payment_terms_code: value }))} />
              <ActionButton onClick={saveSupplierLink} disabled={Boolean(actionLoading) || !supplierForm.material_id || !supplierForm.supplier_agent_id} icon={actionLoading === "save_supplier_link" ? Loader2 : CheckCircle2}>
                {actions.saveSupplierLink}
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "history" ? (
        <div className="glass-panel p-5">
          <h2 className="text-lg font-semibold text-ink-900">Procurement history</h2>
          <p className="mt-1 text-sm text-ink-500">Select a purchase need in the workbench to see its process timeline and related RFQ or offer history.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {timeline.length ? timeline.map((item) => (
              <div key={`${item.code}-${item.timestamp || item.status}`} className="rounded-2xl border border-white/70 bg-white/75 p-4 text-sm shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink-900">{item.label}</p>
                    <p className="text-xs text-ink-400">{item.detail || "-"}</p>
                  </div>
                  <StatusPill status={item.status} />
                </div>
                <p className="mt-3 text-xs text-ink-500">{formatDate(item.timestamp)}</p>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                No purchase need selected yet.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === "workbench" ? (
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
          <aside className="glass-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink-900">Purchase needs</h2>
                <p className="text-xs text-ink-500">Sorted by stock risk and urgency.</p>
              </div>
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-ink-400" /> : null}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-2">
              <Search className="h-4 w-4 text-ink-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search needs..."
                className="min-w-0 flex-1 bg-transparent text-sm text-ink-700 outline-none"
              />
            </div>
            <div className="mt-4 space-y-3">
              {filteredNeeds.length ? filteredNeeds.map((item) => {
                const attrs = item.attrs || {};
                const selected = selectedNeedId === item.id;
                const model = attrs.recommendation?.procurement_model || attrs.procurement_model || "purchase_requisition_then_po";
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedNeedId(item.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-ink-300 bg-white shadow-soft" : "border-white/70 bg-white/70 hover:bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{attrs.material_name || item.title || item.code}</p>
                        <p className="text-xs text-ink-400">{attrs.material_code || item.code || "Purchase need"}</p>
                      </div>
                      <StatusPill status={item.status} />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-ink-500">
                      <span>Qty <strong className="text-ink-800">{formatQty(attrs.suggested_qty || attrs.recommended_qty, attrs.unit_of_measure)}</strong></span>
                      <span>Risk <strong className={RISK_TONES[attrs.risk_status] || "text-ink-800"}>{formatLabel(attrs.risk_status || attrs.recommendation?.risk_status)}</strong></span>
                      <span>Buying route <strong className="text-ink-800">{formatLabel(model)}</strong></span>
                      <span>Cash impact <strong className="text-ink-800">{formatMoney(attrs.cash_required_for_reorder || attrs.recommendation?.cash_required, attrs.currency || attrs.recommendation?.currency)}</strong></span>
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                  No purchase needs are waiting.
                </div>
              )}
            </div>
          </aside>

          <main className="space-y-5">
            {workbenchLoading ? (
              <div className="glass-panel flex min-h-[360px] items-center justify-center p-6 text-sm text-ink-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading purchase need...
              </div>
            ) : selectedNeed ? (
              <>
                <div className="glass-panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-ink-400">Need summary</p>
                      <h2 className="mt-1 text-xl font-semibold text-ink-900">{workbench?.material?.label || selectedNeed.title || "Purchase need"}</h2>
                      <p className="mt-1 text-sm text-ink-500">{formatLabel(inventory.source_reason)} - {formatQty(inventory.suggested_qty, inventory.unit_of_measure)} needed</p>
                    </div>
                    <StatusPill status={selectedNeed.status} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoPair label="Why" value={formatLabel(inventory.source_reason || selectedNeed.attrs?.reason)} strong />
                    <InfoPair label="Required quantity" value={formatQty(inventory.suggested_qty, inventory.unit_of_measure)} strong />
                    <InfoPair label="Risk" value={formatLabel(inventory.risk_status)} strong />
                    <InfoPair label="Cash impact" value={formatMoney(recommendation.estimated_landed_cost || recommendation.cash_required, recommendation.currency)} strong />
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="glass-panel p-5">
                    <h3 className="text-base font-semibold text-ink-900">Inventory context</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <InfoPair label="Stock on hand" value={formatQty(inventory.stock_on_hand, inventory.unit_of_measure)} />
                      <InfoPair label="Available" value={formatQty(inventory.available_qty, inventory.unit_of_measure)} />
                      <InfoPair label="Reserved" value={formatQty(inventory.reserved_qty, inventory.unit_of_measure)} />
                      <InfoPair label="Days of cover" value={inventory.days_of_cover ?? "-"} />
                      <InfoPair label="Predicted out" value={inventory.predicted_out_of_stock_date || "-"} />
                      <InfoPair label="ABC class" value={inventory.abc_classification || "-"} />
                    </div>
                  </section>

                  <section className="glass-panel p-5">
                    <h3 className="text-base font-semibold text-ink-900">Recommended route</h3>
                    <div className="mt-4 rounded-2xl border border-white/70 bg-white/75 p-4">
                      <p className="text-lg font-semibold text-ink-900">{formatLabel(recommendation.procurement_model)}</p>
                      <p className="mt-1 text-sm text-ink-500">{formatLabel(recommendation.selection_reason)}</p>
                      <div className="mt-3 grid gap-2 text-xs text-ink-500 sm:grid-cols-2">
                        <InfoPair label="Rule used" value={recommendation.policy_condition_codes?.length ? recommendation.policy_condition_codes.join(", ") : recommendation.policy_source || "-"} />
                        <InfoPair label="Quotes needed" value={recommendation.minimum_quote_count ?? "-"} />
                        <InfoPair label="Estimated landed cost" value={formatMoney(recommendation.estimated_landed_cost, recommendation.currency)} />
                        <InfoPair label="Payment" value={recommendation.payment_terms_code || "-"} />
                      </div>
                    </div>
                  </section>
                </div>

                <section className="glass-panel p-5">
                  <h3 className="text-base font-semibold text-ink-900">Supplier options for this need</h3>
                  <p className="mt-1 text-sm text-ink-500">Suppliers are ranked from governed material-supplier policy and current buying rules.</p>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {candidates.length ? candidates.map((candidate) => {
                      const recommended = candidate.supplier_agent_id && candidate.supplier_agent_id === recommendation.recommended_supplier_agent_id;
                      return (
                        <div key={candidate.supplier_agent_id || supplierLabel(candidate)} className={`rounded-2xl border p-4 text-sm shadow-soft ${recommended ? "border-emerald-200 bg-emerald-50/70" : "border-white/70 bg-white/75"}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-ink-900">{supplierLabel(candidate)}</p>
                              <p className="text-xs text-ink-500">{formatLabel(candidate.supplier_role)} - {formatLabel(candidate.accreditation_status)}</p>
                            </div>
                            {recommended ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-emerald-700">Recommended</span> : null}
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-ink-500 sm:grid-cols-2">
                            <InfoPair label="Landed cost" value={formatMoney(candidate.estimated_landed_cost, candidate.currency)} />
                            <InfoPair label="Lead time" value={`${candidate.lead_time_days ?? "-"} days`} />
                            <InfoPair label="Payment" value={candidate.payment_terms_code || "-"} />
                            <InfoPair label="Risk" value={formatLabel(candidate.supplier_risk_level)} />
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                        No accredited supplier options are configured for this material.
                      </div>
                    )}
                  </div>
                </section>

                <section className="glass-panel p-5">
                  <h3 className="text-base font-semibold text-ink-900">Request quotes and supplier offers</h3>
                  <p className="mt-1 text-sm text-ink-500">RFQ is shown here as a phase of the selected purchase need.</p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/70 bg-white/75 p-4 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-ink-900">{rfq?.title || "No quote request yet"}</p>
                            <p className="text-xs text-ink-400">{rfq?.code || "Create one when the route requires supplier offers."}</p>
                          </div>
                          {rfq ? <StatusPill status={rfq.status} /> : null}
                        </div>
                        {quoteComparison ? (
                          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                            Recommended offer: {supplierNameById.get(quoteComparison.recommended_supplier_agent_id) || "Supplier offer"} at {formatMoney(quoteComparison.estimated_total_cost, quoteComparison.currency)}
                          </div>
                        ) : null}
                      </div>
                      {quotes.length ? quotes.map((quote) => {
                        const payload = quote.payload || {};
                        const supplierName = supplierNameById.get(payload.supplier_agent_id) || candidateSupplierOptions.find((option) => option.id === payload.supplier_agent_id)?.label || "Supplier offer";
                        return (
                          <div key={quote.id} className="rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-sm text-ink-600">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <strong className="text-ink-900">{supplierName}</strong>
                              <span className="text-xs text-ink-500">{formatMoney(payload.landed_cost, payload.currency)}</span>
                            </div>
                            <p className="mt-1 text-xs text-ink-500">
                              Unit {formatMoney(payload.unit_price, payload.currency)} - lead {payload.lead_time_days ?? "-"} days - {payload.payment_terms_code || "-"}
                            </p>
                          </div>
                        );
                      }) : (
                        <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                          No supplier offers recorded for this need yet.
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white/75 p-4">
                      <h4 className="text-sm font-semibold text-ink-900">Add supplier offer</h4>
                      <div className="mt-3 grid gap-3">
                        <SelectField label="Supplier" value={quoteForm.supplier_agent_id} onChange={(value) => setQuoteForm((current) => ({ ...current, supplier_agent_id: value }))} options={candidateSupplierOptions} placeholder="Select supplier option" />
                        <NumberField label="Unit price" value={quoteForm.unit_price} onChange={(value) => setQuoteForm((current) => ({ ...current, unit_price: value }))} />
                        <NumberField label="Quantity offered" value={quoteForm.quoted_qty} onChange={(value) => setQuoteForm((current) => ({ ...current, quoted_qty: value }))} />
                        <TextField label="Currency" value={quoteForm.currency} onChange={(value) => setQuoteForm((current) => ({ ...current, currency: value }))} />
                        <NumberField label="Lead time days" value={quoteForm.lead_time_days} onChange={(value) => setQuoteForm((current) => ({ ...current, lead_time_days: value }))} />
                        <NumberField label="Freight cost" value={quoteForm.freight_cost} onChange={(value) => setQuoteForm((current) => ({ ...current, freight_cost: value }))} />
                        <TextField label="Payment terms" value={quoteForm.payment_terms_code} onChange={(value) => setQuoteForm((current) => ({ ...current, payment_terms_code: value }))} />
                        <ActionButton onClick={addQuote} disabled={Boolean(actionLoading) || !rfq?.id || !quoteForm.supplier_agent_id} icon={actionLoading === "add_quote" ? Loader2 : CheckCircle2}>
                          {actions.addQuote}
                        </ActionButton>
                      </div>
                    </div>
                  </div>
                </section>

                {cashOption?.available ? (
                  <section className="glass-panel p-5">
                    <h3 className="text-base font-semibold text-ink-900">Cash/shop purchase option</h3>
                    <p className="mt-1 text-sm text-ink-500">Available when policy allows a low-value direct purchase.</p>
                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="rounded-2xl border border-white/70 bg-white/75 p-4 text-sm">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <InfoPair label="Recommended" value={cashOption.recommended ? "Yes" : "Fallback"} />
                          <InfoPair label="Cash required" value={formatMoney(cashOption.cash_required, cashOption.currency)} />
                          <InfoPair label="Payment" value={cashOption.payment_terms_code || "-"} />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white/75 p-4">
                        <div className="grid gap-3">
                          <SelectField label="Supplier or shop" value={cashForm.supplier_agent_id} onChange={(value) => setCashForm((current) => ({ ...current, supplier_agent_id: value }))} options={candidateSupplierOptions} placeholder="Select supplier option" />
                          <NumberField label="Quantity received" value={cashForm.quantity} onChange={(value) => setCashForm((current) => ({ ...current, quantity: value }))} />
                          <NumberField label="Unit cost" value={cashForm.unit_cost} onChange={(value) => setCashForm((current) => ({ ...current, unit_cost: value }))} />
                          <TextField label="Currency" value={cashForm.currency} onChange={(value) => setCashForm((current) => ({ ...current, currency: value }))} />
                          <TextField label="Receipt reference" value={cashForm.receipt_ref} onChange={(value) => setCashForm((current) => ({ ...current, receipt_ref: value }))} />
                          <ActionButton onClick={recordCashPurchase} disabled={Boolean(actionLoading) || !workbench?.material?.id || !cashForm.quantity} icon={actionLoading === "record_cash_purchase" ? Loader2 : WalletCards}>
                            {actions.recordCashPurchase}
                          </ActionButton>
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                <details className="glass-panel p-5 text-sm text-ink-600">
                  <summary className="cursor-pointer font-semibold text-ink-900">Policy details and structured parameters</summary>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <pre className="max-h-80 overflow-auto rounded-2xl bg-ink-950 p-4 text-xs text-white">{JSON.stringify(recommendation.effective_policy || {}, null, 2)}</pre>
                    <pre className="max-h-80 overflow-auto rounded-2xl bg-ink-950 p-4 text-xs text-white">{JSON.stringify(selectedNeed.attrs?.process_parameters || recommendation || {}, null, 2)}</pre>
                  </div>
                </details>
              </>
            ) : (
              <div className="glass-panel flex min-h-[360px] items-center justify-center p-6 text-center text-sm text-ink-500">
                <div>
                  <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-ink-300" />
                  No purchase need selected.
                </div>
              </div>
            )}
          </main>

          <aside className="space-y-5">
            <div className="glass-panel p-5">
              <h3 className="text-base font-semibold text-ink-900">Next best action</h3>
              <p className="mt-1 text-sm text-ink-500">Follow one governed step at a time.</p>
              <div className="mt-4 grid gap-3">
                {nextActions.length ? nextActions.map((action) => (
                  <div key={action.code} className="rounded-2xl border border-white/70 bg-white/75 p-3">
                    <p className="text-sm font-semibold text-ink-900">{action.label}</p>
                    <p className="mt-1 text-xs text-ink-500">{action.reason}</p>
                    <div className="mt-3">{renderNextActionButton(action)}</div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                    Select a purchase need to see the next action.
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel p-5">
              <h3 className="text-base font-semibold text-ink-900">Process timeline</h3>
              <div className="mt-4 space-y-3">
                {timeline.length ? timeline.map((item, index) => (
                  <div key={`${item.code}-${index}`} className="relative pl-5">
                    <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-ink-900" />
                    <p className="text-sm font-semibold text-ink-900">{item.label}</p>
                    <p className="text-xs text-ink-500">{item.detail || formatLabel(item.status)}</p>
                    <p className="text-[0.62rem] uppercase tracking-[0.18em] text-ink-300">{formatDate(item.timestamp)}</p>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                    Timeline appears after selecting a need.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
