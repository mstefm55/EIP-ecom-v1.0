import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
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
  { id: "overview", label: "Overview" },
  { id: "needs", label: "Purchase Needs" },
  { id: "suppliers", label: "Suppliers" },
  { id: "requisitions", label: "Requisitions" },
  { id: "rfqs", label: "RFQs" },
  { id: "cash", label: "Cash Purchase" }
];

const DEFAULT_ACTIONS = {
  refresh: "Refresh",
  createRequisition: "Create requisition",
  approve: "Approve",
  ignore: "Ignore",
  createRfq: "Create RFQ",
  addQuote: "Add quote",
  compareQuotes: "Compare quotes",
  approveQuote: "Approve quote",
  saveSupplierLink: "Save supplier link",
  recordCashPurchase: "Record cash purchase"
};

const DEFAULT_ENDPOINTS = {
  overview: "/api/eip/procurement/overview",
  supplierLinks: "/api/eip/procurement/supplier-links",
  requisitions: "/api/eip/procurement/requisitions",
  rfqs: "/api/eip/procurement/rfqs",
  cashPurchases: "/api/eip/procurement/cash-purchases"
};

const STATUS_TONES = {
  draft: "bg-slate-50 text-slate-700 border-slate-100",
  review: "bg-amber-50 text-amber-700 border-amber-100",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-100",
  comparison_ready: "bg-indigo-50 text-indigo-700 border-indigo-100",
  supplier_selected: "bg-emerald-50 text-emerald-700 border-emerald-100",
  ignored: "bg-rose-50 text-rose-700 border-rose-100",
  recorded: "bg-emerald-50 text-emerald-700 border-emerald-100",
  closed: "bg-slate-100 text-slate-600 border-slate-200"
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

function Field({ label, value, onChange, type = "text", options, placeholder }) {
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
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export default function ProcurementWorkspace({ node } = {}) {
  const props = node?.props || {};
  const endpoints = { ...DEFAULT_ENDPOINTS, ...(props.endpoints || {}) };
  const actions = { ...DEFAULT_ACTIONS, ...(props.actions || {}) };
  const tabs = Array.isArray(props.tabs) && props.tabs.length ? props.tabs : DEFAULT_TABS;

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || "overview");
  const [overview, setOverview] = useState(null);
  const [supplierLinks, setSupplierLinks] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [rfqDetail, setRfqDetail] = useState(null);
  const [selectedRfqId, setSelectedRfqId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
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
    material_id: "",
    supplier_agent_id: "",
    quantity: "",
    unit_cost: "",
    currency: "EUR",
    receipt_ref: ""
  });

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewResult, supplierResult, requisitionResult, rfqResult] = await Promise.all([
        apiFetch(endpoints.overview),
        apiFetch(`${endpoints.supplierLinks}?limit=200`),
        apiFetch(`${endpoints.requisitions}?limit=100`),
        apiFetch(`${endpoints.rfqs}?limit=100`)
      ]);
      setOverview(overviewResult);
      setSupplierLinks(supplierResult.items || []);
      setRequisitions(requisitionResult.items || []);
      setRfqs(rfqResult.items || []);
      const firstRfq = rfqResult.items?.[0]?.id || "";
      if (!selectedRfqId && firstRfq) setSelectedRfqId(firstRfq);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadRfqDetail = async (id) => {
    if (!id) {
      setRfqDetail(null);
      return;
    }
    try {
      const result = await apiFetch(`${endpoints.rfqs}/${id}`);
      setRfqDetail(result);
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadRfqDetail(selectedRfqId);
  }, [selectedRfqId]);

  const purchaseNeeds = overview?.purchase_needs || [];
  const stats = overview?.stats || {};

  const filteredRequisitions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return requisitions;
    return requisitions.filter((item) => [item.code, item.title, item.status, item.attrs?.material_name, item.attrs?.procurement_model].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [query, requisitions]);

  const filteredRfqs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rfqs;
    return rfqs.filter((item) => [item.code, item.title, item.status, item.attrs?.material_id].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [query, rfqs]);

  const runAction = async (fn, successMessage) => {
    setActionLoading(true);
    setNotice("");
    setError("");
    try {
      await fn();
      setNotice(successMessage);
      await loadAll();
      if (selectedRfqId) await loadRfqDetail(selectedRfqId);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const createRequisition = (reorderSuggestionId) => runAction(
    () => apiFetch(`${endpoints.requisitions}/from-reorder`, {
      method: "POST",
      body: { reorder_suggestion_id: reorderSuggestionId }
    }),
    "Purchase requisition created."
  );

  const requisitionAction = (id, action) => runAction(
    () => apiFetch(`${endpoints.requisitions}/${id}/${action}`, { method: "POST", body: {} }),
    action === "approve" ? "Requisition approved." : "Requisition ignored."
  );

  const createRfq = (requisitionId) => runAction(
    async () => {
      const result = await apiFetch(`${endpoints.rfqs}/from-requisition`, {
        method: "POST",
        body: { requisition_id: requisitionId }
      });
      if (result.item?.id) setSelectedRfqId(result.item.id);
    },
    "RFQ created."
  );

  const saveSupplierLink = () => runAction(
    () => apiFetch(endpoints.supplierLinks, {
      method: "POST",
      body: {
        ...supplierForm,
        last_price: supplierForm.last_price === "" ? 0 : Number(supplierForm.last_price),
        lead_time_days: supplierForm.lead_time_days === "" ? 0 : Number(supplierForm.lead_time_days)
      }
    }),
    "Supplier link saved."
  );

  const addQuote = () => {
    if (!selectedRfqId) return;
    return runAction(
      () => apiFetch(`${endpoints.rfqs}/${selectedRfqId}/quotes`, {
        method: "POST",
        body: {
          ...quoteForm,
          unit_price: quoteForm.unit_price === "" ? 0 : Number(quoteForm.unit_price),
          quoted_qty: quoteForm.quoted_qty === "" ? 0 : Number(quoteForm.quoted_qty),
          lead_time_days: quoteForm.lead_time_days === "" ? 0 : Number(quoteForm.lead_time_days),
          freight_cost: quoteForm.freight_cost === "" ? 0 : Number(quoteForm.freight_cost)
        }
      }),
      "Supplier quote added."
    );
  };

  const compareQuotes = () => {
    if (!selectedRfqId) return;
    return runAction(
      () => apiFetch(`${endpoints.rfqs}/${selectedRfqId}/compare`, { method: "POST", body: {} }),
      "Quotes compared."
    );
  };

  const approveQuote = () => {
    if (!selectedRfqId) return;
    return runAction(
      () => apiFetch(`${endpoints.rfqs}/${selectedRfqId}/approve-quote`, { method: "POST", body: {} }),
      "Quote approved."
    );
  };

  const recordCashPurchase = () => runAction(
    () => apiFetch(endpoints.cashPurchases, {
      method: "POST",
      body: {
        ...cashForm,
        quantity: cashForm.quantity === "" ? 0 : Number(cashForm.quantity),
        unit_cost: cashForm.unit_cost === "" ? 0 : Number(cashForm.unit_cost)
      }
    }),
    "Cash purchase recorded."
  );

  return (
    <section className="space-y-5">
      <div className="glass-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-ink-400">Procurement</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink-900">{props.title || "Procurement"}</h1>
            <p className="mt-1 max-w-3xl text-sm text-ink-500">
              {props.subtitle || "Purchase needs, supplier policy, RFQs, quotes, and cash/shop purchase capture."}
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

      {activeTab === "overview" ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Metric label="Supplier links" value={stats.supplier_links} icon={Truck} tone="text-indigo-600" />
            <Metric label="Purchase needs" value={stats.open_purchase_needs} icon={ClipboardList} tone="text-amber-600" />
            <Metric label="Requisitions" value={stats.purchase_requisitions} icon={ShoppingCart} tone="text-emerald-600" />
            <Metric label="RFQs" value={stats.rfqs} icon={Scale} tone="text-blue-600" />
            <Metric label="Cash purchases" value={stats.cash_purchases} icon={WalletCards} tone="text-rose-600" />
          </div>
          <div className="glass-panel p-5">
            <h2 className="text-lg font-semibold text-ink-900">Governed procurement model</h2>
            <p className="mt-1 text-sm text-ink-500">
              Supplier choice, RFQ thresholds, payment terms, freight estimates, and cash purchase limits resolve from commercial conditions and material-supplier links.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4 text-sm text-ink-600">
                <strong className="block text-ink-900">Policy source</strong>
                commercial_condition plus material inventory state
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4 text-sm text-ink-600">
                <strong className="block text-ink-900">Supplier relationship</strong>
                object_link material to supplier with accreditation metadata
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4 text-sm text-ink-600">
                <strong className="block text-ink-900">Workflow</strong>
                purchase requisition, RFQ, quote review, and cash purchase process flows
              </div>
            </div>
          </div>
        </>
      ) : null}

      {activeTab === "needs" ? (
        <div className="glass-panel p-5">
          <h2 className="text-lg font-semibold text-ink-900">Purchase needs from inventory</h2>
          <p className="mt-1 text-sm text-ink-500">Approved reorder suggestions can become purchase requisitions without committing a supplier order.</p>
          <div className="mt-4 grid gap-3">
            {purchaseNeeds.length ? purchaseNeeds.map((item) => {
              const attrs = item.attrs || {};
              const recommendation = attrs.recommendation || item.recommendation || {};
              return (
                <div key={item.id} className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{attrs.material_name || item.title || item.code}</p>
                      <p className="text-xs text-ink-400">{item.code || attrs.material_code || item.id}</p>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-ink-500 sm:grid-cols-4">
                    <span>Qty <strong className="block text-ink-800">{formatQty(attrs.suggested_qty || recommendation.requested_qty, attrs.unit_of_measure)}</strong></span>
                    <span>Model <strong className="block text-ink-800">{formatLabel(recommendation.procurement_model)}</strong></span>
                    <span>Cash need <strong className="block text-ink-800">{formatMoney(recommendation.cash_required, recommendation.currency)}</strong></span>
                    <span>Policy <strong className="block text-ink-800">{(recommendation.policy_condition_codes || []).join(", ") || "-"}</strong></span>
                  </div>
                  <div className="mt-3">
                    <ActionButton onClick={() => createRequisition(item.id)} disabled={actionLoading} icon={ShoppingCart}>
                      {actions.createRequisition}
                    </ActionButton>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                No approved purchase needs are waiting.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === "suppliers" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <div className="glass-panel p-5">
            <h2 className="text-lg font-semibold text-ink-900">Material-supplier links</h2>
            <p className="mt-1 text-sm text-ink-500">Supplier role, accreditation, lead time, price, and terms are relationship metadata.</p>
            <div className="mt-4 space-y-3">
              {supplierLinks.length ? supplierLinks.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/70 bg-white/75 p-4 text-sm shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink-900">{item.supplier_name || item.supplier_agent_id}</p>
                      <p className="text-xs text-ink-400">{item.material_name || item.material_id}</p>
                    </div>
                    <StatusPill status={item.attrs?.accreditation_status || "approved"} />
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-ink-500 sm:grid-cols-4">
                    <span>Role <strong className="block text-ink-800">{formatLabel(item.attrs?.supplier_role)}</strong></span>
                    <span>Last price <strong className="block text-ink-800">{formatMoney(item.attrs?.last_price, item.attrs?.currency)}</strong></span>
                    <span>Lead time <strong className="block text-ink-800">{item.attrs?.lead_time_days ?? "-"} days</strong></span>
                    <span>Terms <strong className="block text-ink-800">{item.attrs?.payment_terms_code || "-"}</strong></span>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                  No material-supplier links yet.
                </div>
              )}
            </div>
          </div>
          <div className="glass-panel p-5">
            <h3 className="text-base font-semibold text-ink-900">Add supplier policy link</h3>
            <div className="mt-4 grid gap-3">
              <Field label="Material id" value={supplierForm.material_id} onChange={(value) => setSupplierForm((current) => ({ ...current, material_id: value }))} />
              <Field label="Supplier agent id" value={supplierForm.supplier_agent_id} onChange={(value) => setSupplierForm((current) => ({ ...current, supplier_agent_id: value }))} />
              <Field
                label="Supplier role"
                type="select"
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
              <Field
                label="Accreditation"
                type="select"
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
              <Field label="Last unit price" type="number" value={supplierForm.last_price} onChange={(value) => setSupplierForm((current) => ({ ...current, last_price: value }))} />
              <Field label="Currency" value={supplierForm.currency} onChange={(value) => setSupplierForm((current) => ({ ...current, currency: value }))} />
              <Field label="Lead time days" type="number" value={supplierForm.lead_time_days} onChange={(value) => setSupplierForm((current) => ({ ...current, lead_time_days: value }))} />
              <Field label="Payment terms" value={supplierForm.payment_terms_code} onChange={(value) => setSupplierForm((current) => ({ ...current, payment_terms_code: value }))} />
              <ActionButton onClick={saveSupplierLink} disabled={actionLoading || !supplierForm.material_id || !supplierForm.supplier_agent_id} icon={CheckCircle2}>
                {actions.saveSupplierLink}
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "requisitions" ? (
        <div className="glass-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink-900">Purchase requisitions</h2>
            <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-2">
              <Search className="h-4 w-4 text-ink-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search requisitions..." className="w-52 bg-transparent text-sm text-ink-700 outline-none" />
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {filteredRequisitions.length ? filteredRequisitions.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{item.title || item.code}</p>
                    <p className="text-xs text-ink-400">{item.code || item.id}</p>
                  </div>
                  <StatusPill status={item.status} />
                </div>
                <div className="mt-3 grid gap-2 text-xs text-ink-500 sm:grid-cols-5">
                  <span>Material <strong className="block text-ink-800">{item.attrs?.material_name || item.attrs?.material_code || "-"}</strong></span>
                  <span>Qty <strong className="block text-ink-800">{formatQty(item.attrs?.requested_qty, item.attrs?.unit_of_measure)}</strong></span>
                  <span>Model <strong className="block text-ink-800">{formatLabel(item.attrs?.procurement_model)}</strong></span>
                  <span>Landed cost <strong className="block text-ink-800">{formatMoney(item.attrs?.estimated_landed_cost, item.attrs?.currency)}</strong></span>
                  <span>Payment <strong className="block text-ink-800">{item.attrs?.payment_terms_code || "-"}</strong></span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton onClick={() => requisitionAction(item.id, "approve")} disabled={actionLoading || item.status === "approved"} tone="success">{actions.approve}</ActionButton>
                  <ActionButton onClick={() => requisitionAction(item.id, "ignore")} disabled={actionLoading || item.status === "ignored"} tone="danger">{actions.ignore}</ActionButton>
                  <ActionButton onClick={() => createRfq(item.id)} disabled={actionLoading} tone="soft" icon={Scale}>{actions.createRfq}</ActionButton>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                No requisitions match the current view.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === "rfqs" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="glass-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink-900">RFQs</h2>
              <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-2">
                <Search className="h-4 w-4 text-ink-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search RFQs..." className="w-44 bg-transparent text-sm text-ink-700 outline-none" />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {filteredRfqs.length ? filteredRfqs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedRfqId(item.id)}
                  className={`w-full rounded-2xl border p-4 text-left shadow-soft ${selectedRfqId === item.id ? "border-ink-300 bg-white" : "border-white/70 bg-white/75"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{item.title || item.code}</p>
                      <p className="text-xs text-ink-400">{item.code || item.id}</p>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-ink-500 sm:grid-cols-3">
                    <span>Qty <strong className="block text-ink-800">{formatQty(item.attrs?.requested_qty, item.attrs?.unit_of_measure)}</strong></span>
                    <span>Minimum quotes <strong className="block text-ink-800">{item.attrs?.minimum_quote_count ?? "-"}</strong></span>
                    <span>Currency <strong className="block text-ink-800">{item.attrs?.currency || "-"}</strong></span>
                  </div>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                  No RFQs yet.
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <div className="glass-panel p-5">
              <h3 className="text-base font-semibold text-ink-900">Quote intake</h3>
              <p className="mt-1 text-sm text-ink-500">{rfqDetail?.item?.title || "Select an RFQ"}</p>
              <div className="mt-4 grid gap-3">
                <Field label="Supplier agent id" value={quoteForm.supplier_agent_id} onChange={(value) => setQuoteForm((current) => ({ ...current, supplier_agent_id: value }))} />
                <Field label="Unit price" type="number" value={quoteForm.unit_price} onChange={(value) => setQuoteForm((current) => ({ ...current, unit_price: value }))} />
                <Field label="Quoted quantity" type="number" value={quoteForm.quoted_qty} onChange={(value) => setQuoteForm((current) => ({ ...current, quoted_qty: value }))} />
                <Field label="Currency" value={quoteForm.currency} onChange={(value) => setQuoteForm((current) => ({ ...current, currency: value }))} />
                <Field label="Lead time days" type="number" value={quoteForm.lead_time_days} onChange={(value) => setQuoteForm((current) => ({ ...current, lead_time_days: value }))} />
                <Field label="Freight cost" type="number" value={quoteForm.freight_cost} onChange={(value) => setQuoteForm((current) => ({ ...current, freight_cost: value }))} />
                <Field label="Payment terms" value={quoteForm.payment_terms_code} onChange={(value) => setQuoteForm((current) => ({ ...current, payment_terms_code: value }))} />
                <div className="flex flex-wrap gap-2">
                  <ActionButton onClick={addQuote} disabled={actionLoading || !selectedRfqId || !quoteForm.supplier_agent_id} icon={CheckCircle2}>{actions.addQuote}</ActionButton>
                  <ActionButton onClick={compareQuotes} disabled={actionLoading || !selectedRfqId} tone="soft" icon={Scale}>{actions.compareQuotes}</ActionButton>
                  <ActionButton onClick={approveQuote} disabled={actionLoading || !selectedRfqId} tone="success">{actions.approveQuote}</ActionButton>
                </div>
              </div>
            </div>
            <div className="glass-panel p-5">
              <h3 className="text-base font-semibold text-ink-900">Quotes</h3>
              <div className="mt-3 space-y-2">
                {rfqDetail?.quotes?.length ? rfqDetail.quotes.map((quote) => {
                  const payload = quote.payload || {};
                  return (
                    <div key={quote.id} className="rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-sm text-ink-600">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-ink-900">{payload.supplier_agent_id || "Supplier"}</strong>
                        <span className="text-xs text-ink-400">{formatMoney(payload.landed_cost, payload.currency)}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-500">
                        Unit {formatMoney(payload.unit_price, payload.currency)} - lead {payload.lead_time_days ?? "-"} days - {payload.payment_terms_code || "-"}
                      </p>
                    </div>
                  );
                }) : (
                  <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-sm text-ink-400">
                    No quotes recorded for the selected RFQ.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "cash" ? (
        <div className="glass-panel max-w-2xl p-5">
          <h2 className="text-lg font-semibold text-ink-900">Cash/shop purchase receipt</h2>
          <p className="mt-1 text-sm text-ink-500">Record a low-value cash purchase and create the inventory receipt movement in one governed action.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Material id" value={cashForm.material_id} onChange={(value) => setCashForm((current) => ({ ...current, material_id: value }))} />
            <Field label="Supplier agent id" value={cashForm.supplier_agent_id} onChange={(value) => setCashForm((current) => ({ ...current, supplier_agent_id: value }))} />
            <Field label="Quantity" type="number" value={cashForm.quantity} onChange={(value) => setCashForm((current) => ({ ...current, quantity: value }))} />
            <Field label="Unit cost" type="number" value={cashForm.unit_cost} onChange={(value) => setCashForm((current) => ({ ...current, unit_cost: value }))} />
            <Field label="Currency" value={cashForm.currency} onChange={(value) => setCashForm((current) => ({ ...current, currency: value }))} />
            <Field label="Receipt reference" value={cashForm.receipt_ref} onChange={(value) => setCashForm((current) => ({ ...current, receipt_ref: value }))} />
          </div>
          <div className="mt-4">
            <ActionButton onClick={recordCashPurchase} disabled={actionLoading || !cashForm.material_id || !cashForm.quantity} icon={WalletCards}>
              {actions.recordCashPurchase}
            </ActionButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}
