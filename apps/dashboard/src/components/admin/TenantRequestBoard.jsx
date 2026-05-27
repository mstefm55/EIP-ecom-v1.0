import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  CircleDashed,
  CircleDot,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Search,
  Send,
  XCircle
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";
import ActionMiniModal from "../shared/ActionMiniModal";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "BOOTSTRAP_PENDING", label: "Bootstrap" },
  { value: "ACTIVE", label: "Active" },
  { value: "REJECTED", label: "Rejected" },
];

const STATUS_STYLES = {
  PENDING: "bg-amber-100 text-amber-700",
  BOOTSTRAP_PENDING: "bg-indigo-100 text-indigo-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-600",
  DEFAULT: "bg-ink-100 text-ink-500",
};

const APPROVABLE_STATUSES = new Set(["PENDING", "SUBMITTED", "UNDER_REVIEW", "APPROVED"]);
const TERMINAL_OR_BOOTSTRAP_STATUSES = new Set(["BOOTSTRAP_PENDING", "ACTIVE", "REJECTED", "EXPIRED", "CANCELLED"]);

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function formatStatus(value) {
  return String(value || "").replace(/_/g, " ");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function canApproveRequest(item) {
  return APPROVABLE_STATUSES.has(normalizeStatus(item?.status_code));
}

function canRejectRequest(item) {
  return !TERMINAL_OR_BOOTSTRAP_STATUSES.has(normalizeStatus(item?.status_code));
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

  const requestConfirm = ({ title, message, confirmLabel = "Confirm", confirmTone = "default" }) =>
    new Promise((resolve) => {
      setMiniModalRequest({
        mode: "confirm",
        title,
        message,
        confirmLabel,
        confirmTone,
        resolve,
      });
    });

  const requestPrompt = ({
    title,
    message,
    inputLabel = "Input",
    inputPlaceholder = "",
    defaultValue = "",
    confirmLabel = "Save",
    required = false,
  }) =>
    new Promise((resolve) => {
      setMiniModalRequest({
        mode: "prompt",
        title,
        message,
        inputLabel,
        inputPlaceholder,
        defaultValue,
        confirmLabel,
        required,
        resolve,
      });
    });

  const closeMiniModal = (confirmed, value = "") => {
    if (miniModalRequest?.resolve) {
      if (!confirmed) {
        miniModalRequest.resolve(null);
      } else if (miniModalRequest.mode === "prompt") {
        miniModalRequest.resolve(String(value || ""));
      } else {
        miniModalRequest.resolve(true);
      }
    }
    setMiniModalRequest(null);
  };

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        const effectiveLimit = Number.isFinite(Number(pageSize)) ? pageSize : limit;
        const offset = (page - 1) * effectiveLimit;
        if (Number.isFinite(Number(effectiveLimit))) qs.set("limit", String(effectiveLimit));
        qs.set("offset", String(offset));
        if (statusFilter && statusFilter !== "ALL") qs.set("status", statusFilter);
        if (query.trim()) qs.set("q", query.trim());
        const url = qs.toString() ? `${endpoint}?${qs.toString()}` : endpoint;
        const result = await apiFetch(url, { method: "GET" });
        const list = Array.isArray(result?.items) ? result.items : [];
        if (active) {
          setItems(list);
          if (Number.isFinite(Number(result?.total))) {
            setTotal(Number(result.total));
          } else {
            setTotal(list.length);
          }
        }
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [endpoint, limit, refreshKey, statusFilter, query, page, pageSize]);

  const stats = useMemo(() => {
    const summary = { total: items.length, pending: 0, bootstrap: 0, active: 0, rejected: 0 };
    items.forEach((item) => {
      switch (normalizeStatus(item.status_code)) {
        case "PENDING":
        case "SUBMITTED":
        case "UNDER_REVIEW":
        case "APPROVED":
          summary.pending += 1;
          break;
        case "BOOTSTRAP_PENDING":
          summary.bootstrap += 1;
          break;
        case "ACTIVE":
          summary.active += 1;
          break;
        case "REJECTED":
          summary.rejected += 1;
          break;
        default:
          break;
      }
    });
    return summary;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!q) return true;
      const fields = [item.legal_name, item.email, item.country, item.ref_code].filter(Boolean);
      return fields.some((value) => String(value).toLowerCase().includes(q));
    });
  }, [items, query]);

  const totalPages = useMemo(() => {
    if (!pageSize) return 1;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [total, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxPages = 5;
    const start = Math.max(1, page - Math.floor(maxPages / 2));
    const end = Math.min(totalPages, start + maxPages - 1);
    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }
    return pages;
  }, [page, totalPages]);

  const handleApprove = async (item) => {
    if (!item?.id) return;
    if (!canApproveRequest(item)) {
      setActionStatus({
        type: "error",
        message:
          normalizeStatus(item.status_code) === "BOOTSTRAP_PENDING"
            ? "This request is already approved and waiting for bootstrap. Use a resend-bootstrap action when available."
            : "This request cannot be approved in its current status.",
      });
      return;
    }
    const confirmed = await requestConfirm({
      title: "Approve tenant request",
      message: `Approve tenant request for ${item.legal_name || item.email}?`,
      confirmLabel: "Approve",
    });
    if (!confirmed) return;
    setActionStatus(null);
    try {
      const result = await apiFetch(`/api/eip/admin/tenant-requests/${item.id}/approve`, {
        method: "POST",
        body: {},
      });
      const token = result?.bootstrapToken;
      const link = result?.bootstrapLink;
      setActionStatus({
        type: "success",
        message: link
          ? `Approved. Bootstrap link: ${link}`
          : token
            ? `Approved. Bootstrap token: ${token}`
            : "Approved. Bootstrap email sent.",
      });
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      setActionStatus({ type: "error", message: err.message || "Approval failed" });
    }
  };

  const handleReject = async (item) => {
    if (!item?.id || !canRejectRequest(item)) return;
    const reason = await requestPrompt({
      title: "Reject tenant request",
      message: `Provide an optional reason for rejecting ${item.legal_name || item.email}.`,
      inputLabel: "Reason (optional)",
      inputPlaceholder: "Reason",
      confirmLabel: "Reject",
    });
    if (reason === null) return;
    setActionStatus(null);
    try {
      await apiFetch(`/api/eip/admin/tenant-requests/${item.id}/reject`, {
        method: "POST",
        body: { reason },
      });
      setActionStatus({ type: "success", message: "Request rejected." });
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      setActionStatus({ type: "error", message: err.message || "Rejection failed" });
    }
  };

  const handleCopyToken = async () => {
    if (!actionStatus?.message) return;
    const match = actionStatus.message.match(/(?:token|link):\s*(\S+)/i);
    if (!match?.[1]) return;
    try {
      await navigator.clipboard.writeText(match[1]);
      setActionStatus({ type: "success", message: "Bootstrap value copied." });
    } catch {
      setActionStatus({ type: "error", message: "Unable to copy value." });
    }
  };

  return (
    <section className="glass-panel p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">Tenant Requests</h2>
          <p className="mt-1 text-sm text-ink-500">
            Review onboarding submissions and approve to generate bootstrap links.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((prev) => prev + 1)}
          className="flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 hover:bg-white"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <StatCard label="Total" value={stats.total} icon={CircleDashed} />
        <StatCard label="Pending" value={stats.pending} icon={CircleDot} tone="amber" />
        <StatCard label="Bootstrap" value={stats.bootstrap} icon={Send} tone="indigo" />
        <StatCard label="Active" value={stats.active} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Rejected" value={stats.rejected} icon={XCircle} tone="rose" />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => {
            const active = statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setStatusFilter(option.value);
                  setPage(1);
                }}
                className={
                  active
                    ? "rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white"
                    : "rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500"
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-sm text-ink-500">
          <Search className="h-4 w-4" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search legal name, email, ref"
            className="bg-transparent text-sm text-ink-600 placeholder:text-ink-400 focus:outline-none"
          />
        </label>
      </div>

      {actionStatus ? (
        <div
          className={
            actionStatus.type === "error"
              ? "mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600"
              : "mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{actionStatus.message}</span>
            {/(token|link):/i.test(actionStatus.message || "") ? (
              <button
                type="button"
                onClick={handleCopyToken}
                className="flex items-center gap-2 rounded-full border border-emerald-200/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700"
              >
                <Clipboard className="h-4 w-4" />
                Copy
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-ink-200/60 bg-white/70 px-4 py-3 text-sm text-ink-500">
            Loading requests...
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error.message || "Unable to load requests."}
          </div>
        ) : null}
        {!loading && !error && filtered.length === 0 ? (
          <div className="rounded-2xl border border-ink-200/60 bg-white/70 px-4 py-3 text-sm text-ink-500">
            No requests found.
          </div>
        ) : null}

        {filtered.map((item) => {
          const status = normalizeStatus(item.status_code);
          const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.DEFAULT;
          const approveDisabled = !canApproveRequest(item);
          const rejectDisabled = !canRejectRequest(item);
          const approveLabel = status === "BOOTSTRAP_PENDING" ? "Approved" : "Approve";
          return (
            <div key={item.id} className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-ink-900">{item.legal_name || "Unnamed request"}</p>
                  <p className="mt-1 text-sm text-ink-500">{item.email}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-400">
                    <span>{item.applicant_type || "-"}</span>
                    <span>{item.country || "-"}</span>
                    <span>{item.timezone || "-"}</span>
                    <span>Ref: {item.ref_code || "-"}</span>
                  </div>
                </div>
                <div className="space-y-3 text-right">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusStyle}`}>
                    {formatStatus(item.status_code || "")}
                  </span>
                  <p className="text-xs text-ink-400">Submitted {formatDate(item.created_at)}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-ink-500 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Identifiers</p>
                  <p className="mt-2">Business Reg: {item.business_reg_no || "-"}</p>
                  <p>Personal ID: {item.personal_id_no || "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Contact</p>
                  <p className="mt-2">Phone: {item.phone || "-"}</p>
                  <p>Tenant ID: {item.tenant_id || "-"}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleApprove(item)}
                  disabled={approveDisabled}
                  title={status === "BOOTSTRAP_PENDING" ? "Already approved. A separate resend-bootstrap action is required." : undefined}
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] ${
                    approveDisabled
                      ? "cursor-not-allowed bg-ink-200 text-ink-400"
                      : "bg-ink-900 text-white shadow-glow hover:bg-ink-800"
                  }`}
                >
                  {approveLabel}
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(item)}
                  disabled={rejectDisabled}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] ${
                    rejectDisabled
                      ? "cursor-not-allowed border-ink-100 bg-ink-100 text-ink-300"
                      : "border-ink-200/70 bg-white/70 text-ink-500 hover:bg-white"
                  }`}
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-sm text-ink-500">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-[0.3em] text-ink-400">Rows</span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-full border border-ink-200/70 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500"
          >
            {[25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-xs text-ink-400">Total {total}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="flex items-center gap-1 rounded-full border border-ink-200/70 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 rounded-full border border-ink-200/70 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pageNumbers.map((number) => (
            <button
              key={number}
              type="button"
              onClick={() => setPage(number)}
              className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] ${
                number === page
                  ? "bg-ink-900 text-white shadow-glow"
                  : "border border-ink-200/70 bg-white/70 text-ink-500 hover:bg-white"
              }`}
            >
              {number}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-full border border-ink-200/70 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-full border border-ink-200/70 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <ActionMiniModal
        open={Boolean(miniModalRequest)}
        mode={miniModalRequest?.mode || "confirm"}
        title={miniModalRequest?.title || "Confirm action"}
        message={miniModalRequest?.message || ""}
        inputLabel={miniModalRequest?.inputLabel || "Input"}
        inputPlaceholder={miniModalRequest?.inputPlaceholder || ""}
        defaultValue={miniModalRequest?.defaultValue || ""}
        required={Boolean(miniModalRequest?.required)}
        confirmLabel={miniModalRequest?.confirmLabel || "Confirm"}
        cancelLabel="Cancel"
        confirmTone={miniModalRequest?.confirmTone || "default"}
        onCancel={() => closeMiniModal(false)}
        onConfirm={(value) => closeMiniModal(true, value)}
      />
    </section>
  );
}

function StatCard({ label, value, icon: Icon, tone }) {
  const toneClass = {
    amber: "text-amber-600",
    indigo: "text-indigo-600",
    emerald: "text-emerald-600",
    rose: "text-rose-600",
    default: "text-ink-500",
  }[tone] || "text-ink-500";
  return (
    <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-4 shadow-soft">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-ink-400">
        <span>{label}</span>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </div>
      <p className="mt-3 text-2xl font-semibold text-ink-900">{value}</p>
    </div>
  );
}
