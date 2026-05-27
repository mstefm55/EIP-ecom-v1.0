import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CircleDashed, CircleDot, Clipboard, RefreshCw, Search, Send, XCircle } from "lucide-react";
import { apiFetch } from "../../services/apiClient";
import ActionMiniModal from "../shared/ActionMiniModal";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "BOOTSTRAP_PENDING", label: "Bootstrap" },
  { value: "ACTIVE", label: "Active" },
  { value: "REJECTED", label: "Rejected" },
];
const STATUS_STYLES = { PENDING: "bg-amber-100 text-amber-700", BOOTSTRAP_PENDING: "bg-indigo-100 text-indigo-700", ACTIVE: "bg-emerald-100 text-emerald-700", REJECTED: "bg-rose-100 text-rose-600", DEFAULT: "bg-ink-100 text-ink-500" };
const APPROVABLE = new Set(["PENDING", "SUBMITTED", "UNDER_REVIEW", "APPROVED"]);
const TERMINAL = new Set(["BOOTSTRAP_PENDING", "ACTIVE", "REJECTED", "EXPIRED", "CANCELLED"]);

function normalizeStatus(value) { return String(value || "").trim().toUpperCase(); }
function formatStatus(value) { return String(value || "").replace(/_/g, " "); }
function canApprove(item) { return APPROVABLE.has(normalizeStatus(item?.status_code)); }
function canResend(item) { return normalizeStatus(item?.status_code) === "BOOTSTRAP_PENDING"; }
function canReject(item) { return !TERMINAL.has(normalizeStatus(item?.status_code)); }
function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
function statusSummary(items) {
  return items.reduce((acc, item) => {
    const status = normalizeStatus(item.status_code);
    acc.total += 1;
    if (["PENDING", "SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(status)) acc.pending += 1;
    else if (status === "BOOTSTRAP_PENDING") acc.bootstrap += 1;
    else if (status === "ACTIVE") acc.active += 1;
    else if (status === "REJECTED") acc.rejected += 1;
    return acc;
  }, { total: 0, pending: 0, bootstrap: 0, active: 0, rejected: 0 });
}
function extractActionValue(message) {
  const match = String(message || "").match(/(?:token|link)(?: resent)?:\s*(\S+)/i);
  return match?.[1] || "";
}

export default function TenantRequestBoard({ node }) {
  const { endpoint = "/api/eip/admin/tenant-requests", limit = 200 } = node.props || {};
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionStatus, setActionStatus] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [miniModalRequest, setMiniModalRequest] = useState(null);

  const requestConfirm = ({ title, message, confirmLabel = "Confirm", confirmTone = "default" }) => new Promise((resolve) => setMiniModalRequest({ mode: "confirm", title, message, confirmLabel, confirmTone, resolve }));
  const requestPrompt = ({ title, message, inputLabel = "Input", inputPlaceholder = "", defaultValue = "", confirmLabel = "Save", required = false }) => new Promise((resolve) => setMiniModalRequest({ mode: "prompt", title, message, inputLabel, inputPlaceholder, defaultValue, confirmLabel, required, resolve }));
  const closeMiniModal = (confirmed, value = "") => {
    if (miniModalRequest?.resolve) miniModalRequest.resolve(!confirmed ? null : miniModalRequest.mode === "prompt" ? String(value || "") : true);
    setMiniModalRequest(null);
  };

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError(null);
      try {
        const qs = new URLSearchParams();
        const effectiveLimit = Number.isFinite(Number(pageSize)) ? pageSize : limit;
        qs.set("limit", String(effectiveLimit));
        qs.set("offset", String((page - 1) * effectiveLimit));
        if (statusFilter && statusFilter !== "ALL") qs.set("status", statusFilter);
        if (query.trim()) qs.set("q", query.trim());
        const result = await apiFetch(`${endpoint}?${qs.toString()}`, { method: "GET" });
        const list = Array.isArray(result?.items) ? result.items : [];
        if (active) { setItems(list); setTotal(Number.isFinite(Number(result?.total)) ? Number(result.total) : list.length); }
      } catch (err) { if (active) setError(err); }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [endpoint, limit, refreshKey, statusFilter, query, page, pageSize]);

  const stats = useMemo(() => statusSummary(items), [items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => !q || [item.legal_name, item.email, item.country, item.ref_code].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)));
  }, [items, query]);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const pageNumbers = useMemo(() => Array.from({ length: Math.min(5, totalPages) }, (_, i) => Math.max(1, Math.min(totalPages - Math.min(4, totalPages - 1), page - 2)) + i).filter((n, i, a) => n <= totalPages && a.indexOf(n) === i), [page, totalPages]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const showResult = (result, prefix) => {
    const link = result?.bootstrapLink;
    const token = result?.bootstrapToken;
    setActionStatus({ type: "success", message: link ? `${prefix} link: ${link}` : token ? `${prefix} token: ${token}` : `${prefix} email sent.` });
  };

  const handleApprove = async (item) => {
    if (!item?.id || !canApprove(item)) return;
    const ok = await requestConfirm({ title: "Approve tenant request", message: `Approve tenant request for ${item.legal_name || item.email}?`, confirmLabel: "Approve" });
    if (!ok) return;
    setActionStatus(null);
    try { showResult(await apiFetch(`/api/eip/admin/tenant-requests/${item.id}/approve`, { method: "POST", body: {} }), "Approved. Bootstrap"); setRefreshKey((p) => p + 1); }
    catch (err) { setActionStatus({ type: "error", message: err.message || "Approval failed" }); }
  };

  const handleResendBootstrap = async (item) => {
    if (!item?.id || !canResend(item)) return;
    const ok = await requestConfirm({ title: "Resend bootstrap link", message: `Generate a new one-time bootstrap link for ${item.legal_name || item.email}? The previous link and unfinished bootstrap session will be invalidated.`, confirmLabel: "Resend Link" });
    if (!ok) return;
    setActionStatus(null);
    try { showResult(await apiFetch(`/api/eip/admin/tenant-requests/${item.id}/resend-bootstrap`, { method: "POST", body: {} }), "Bootstrap link resent"); setRefreshKey((p) => p + 1); }
    catch (err) { setActionStatus({ type: "error", message: err.message || "Resend failed" }); }
  };

  const handleReject = async (item) => {
    if (!item?.id || !canReject(item)) return;
    const reason = await requestPrompt({ title: "Reject tenant request", message: `Provide an optional reason for rejecting ${item.legal_name || item.email}.`, inputLabel: "Reason (optional)", inputPlaceholder: "Reason", confirmLabel: "Reject" });
    if (reason === null) return;
    setActionStatus(null);
    try { await apiFetch(`/api/eip/admin/tenant-requests/${item.id}/reject`, { method: "POST", body: { reason } }); setActionStatus({ type: "success", message: "Request rejected." }); setRefreshKey((p) => p + 1); }
    catch (err) { setActionStatus({ type: "error", message: err.message || "Rejection failed" }); }
  };

  const handleCopy = async () => {
    const value = extractActionValue(actionStatus?.message);
    if (!value) return;
    try { await navigator.clipboard.writeText(value); setActionStatus({ type: "success", message: "Bootstrap value copied." }); }
    catch { setActionStatus({ type: "error", message: "Unable to copy value." }); }
  };

  return (
    <section className="glass-panel p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-xl font-semibold text-ink-900">Tenant Requests</h2><p className="mt-1 text-sm text-ink-500">Review onboarding submissions, approve tenants, and resend bootstrap links when needed.</p></div>
        <button type="button" onClick={() => setRefreshKey((p) => p + 1)} className="flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 hover:bg-white"><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-5"><StatCard label="Total" value={stats.total} icon={CircleDashed} /><StatCard label="Pending" value={stats.pending} icon={CircleDot} tone="amber" /><StatCard label="Bootstrap" value={stats.bootstrap} icon={Send} tone="indigo" /><StatCard label="Active" value={stats.active} icon={CheckCircle2} tone="emerald" /><StatCard label="Rejected" value={stats.rejected} icon={XCircle} tone="rose" /></div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">{STATUS_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => { setStatusFilter(option.value); setPage(1); }} className={statusFilter === option.value ? "rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white" : "rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500"}>{option.label}</button>)}</div>
        <label className="flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-sm text-ink-500"><Search className="h-4 w-4" /><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search legal name, email, ref" className="bg-transparent text-sm text-ink-600 placeholder:text-ink-400 focus:outline-none" /></label>
      </div>
      {actionStatus ? <div className={actionStatus.type === "error" ? "mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600" : "mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"}><div className="flex flex-wrap items-center justify-between gap-3"><span>{actionStatus.message}</span>{extractActionValue(actionStatus.message) ? <button type="button" onClick={handleCopy} className="flex items-center gap-2 rounded-full border border-emerald-200/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700"><Clipboard className="h-4 w-4" />Copy</button> : null}</div></div> : null}
      <div className="mt-6 space-y-4">
        {loading ? <Notice>Loading requests...</Notice> : null}
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error.message || "Unable to load requests."}</div> : null}
        {!loading && !error && filtered.length === 0 ? <Notice>No requests found.</Notice> : null}
        {filtered.map((item) => <RequestCard key={item.id} item={item} onApprove={handleApprove} onResend={handleResendBootstrap} onReject={handleReject} />)}
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-sm text-ink-500"><div className="flex items-center gap-3"><span className="text-xs uppercase tracking-[0.3em] text-ink-400">Rows</span><select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-full border border-ink-200/70 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500">{[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select><span className="text-xs text-ink-400">Total {total}</span></div><div className="flex items-center gap-2"><PageButton onClick={() => setPage(1)} disabled={page === 1} icon={ChevronsLeft} /><PageButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} icon={ChevronLeft} />{pageNumbers.map((number) => <button key={number} type="button" onClick={() => setPage(number)} className={number === page ? "rounded-full bg-ink-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-glow" : "rounded-full border border-ink-200/70 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 hover:bg-white"}>{number}</button>)}<PageButton onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} icon={ChevronRight} /><PageButton onClick={() => setPage(totalPages)} disabled={page >= totalPages} icon={ChevronsRight} /></div></div>
      <ActionMiniModal open={Boolean(miniModalRequest)} mode={miniModalRequest?.mode || "confirm"} title={miniModalRequest?.title || "Confirm action"} message={miniModalRequest?.message || ""} inputLabel={miniModalRequest?.inputLabel || "Input"} inputPlaceholder={miniModalRequest?.inputPlaceholder || ""} defaultValue={miniModalRequest?.defaultValue || ""} required={Boolean(miniModalRequest?.required)} confirmLabel={miniModalRequest?.confirmLabel || "Confirm"} cancelLabel="Cancel" confirmTone={miniModalRequest?.confirmTone || "default"} onCancel={() => closeMiniModal(false)} onConfirm={(value) => closeMiniModal(true, value)} />
    </section>
  );
}

function RequestCard({ item, onApprove, onResend, onReject }) {
  const status = normalizeStatus(item.status_code);
  const showResend = canResend(item);
  const rejectDisabled = !canReject(item);
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.DEFAULT;
  return <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-soft"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-lg font-semibold text-ink-900">{item.legal_name || "Unnamed request"}</p><p className="mt-1 text-sm text-ink-500">{item.email}</p><div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-400"><span>{item.applicant_type || "-"}</span><span>{item.country || "-"}</span><span>{item.timezone || "-"}</span><span>Ref: {item.ref_code || "-"}</span></div></div><div className="space-y-3 text-right"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusStyle}`}>{formatStatus(item.status_code || "")}</span><p className="text-xs text-ink-400">Submitted {formatDate(item.created_at)}</p></div></div><div className="mt-5 grid gap-3 text-sm text-ink-500 md:grid-cols-2"><div><p className="text-xs uppercase tracking-[0.3em] text-ink-400">Identifiers</p><p className="mt-2">Business Reg: {item.business_reg_no || "-"}</p><p>Personal ID: {item.personal_id_no || "-"}</p></div><div><p className="text-xs uppercase tracking-[0.3em] text-ink-400">Contact</p><p className="mt-2">Phone: {item.phone || "-"}</p><p>Tenant ID: {item.tenant_id || "-"}</p></div></div><div className="mt-6 flex flex-wrap items-center gap-3">{showResend ? <button type="button" onClick={() => onResend(item)} className="rounded-full bg-indigo-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-glow hover:bg-indigo-800">Resend Bootstrap Link</button> : <button type="button" onClick={() => onApprove(item)} disabled={!canApprove(item)} className={!canApprove(item) ? "cursor-not-allowed rounded-full bg-ink-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-400" : "rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-glow hover:bg-ink-800"}>Approve</button>}<button type="button" onClick={() => onReject(item)} disabled={rejectDisabled} className={rejectDisabled ? "cursor-not-allowed rounded-full border border-ink-100 bg-ink-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-300" : "rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 hover:bg-white"}>Reject</button></div></div>;
}
function Notice({ children }) { return <div className="rounded-2xl border border-ink-200/60 bg-white/70 px-4 py-3 text-sm text-ink-500">{children}</div>; }
function PageButton({ onClick, disabled, icon: Icon }) { return <button type="button" onClick={onClick} disabled={disabled} className="flex items-center gap-1 rounded-full border border-ink-200/70 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 disabled:cursor-not-allowed disabled:opacity-40"><Icon className="h-4 w-4" /></button>; }
function StatCard({ label, value, icon: Icon, tone }) { const toneClass = { amber: "text-amber-600", indigo: "text-indigo-600", emerald: "text-emerald-600", rose: "text-rose-600", default: "text-ink-500" }[tone] || "text-ink-500"; return <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-4 shadow-soft"><div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-ink-400"><span>{label}</span><Icon className={`h-4 w-4 ${toneClass}`} /></div><p className="mt-3 text-2xl font-semibold text-ink-900">{value}</p></div>; }
