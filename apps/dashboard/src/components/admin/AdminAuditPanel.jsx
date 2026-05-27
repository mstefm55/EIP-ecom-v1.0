import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, FileClock, Filter, RefreshCw, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const PAGE_SIZE_OPTIONS = [12, 25, 50];
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_FILTERS = {
  event_type: "",
  tenant: "",
  outcome: "",
  severity: "",
};
const FILTER_CONTROL_CLASS =
  "mt-1 h-8 w-full rounded-lg border border-ink-100 bg-white/80 px-2.5 text-xs text-ink-700 outline-none focus:border-indigo-300";
const FILTER_BUTTON_CLASS =
  "mt-5 flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold uppercase tracking-[0.14em]";
const PAGER_CONTROL_CLASS =
  "h-8 rounded-full border border-ink-200 bg-white/80 px-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 outline-none hover:bg-white";
const PAGER_BUTTON_CLASS =
  "flex h-8 items-center gap-1.5 rounded-full border border-ink-200 bg-white/80 px-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 hover:bg-white disabled:opacity-50";
const DETAIL_COPY_BUTTON_CLASS =
  "inline-flex h-8 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-600 hover:bg-ink-50";
const SENSITIVE_DETAIL_KEY_PATTERN =
  /(authorization|cookie|set-cookie|x-api-key|api[_-]?key|secret|token|password|credential|signature|csrf|sid|did|otp|totp|recovery|private[_-]?key)/i;

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatEventLabel(value) {
  return String(value || "security.event").replaceAll("_", " ").replaceAll(".", " / ");
}

function displayValue(value) {
  const text = String(value || "").trim();
  return text || "-";
}

function redactDetailValue(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 8) return "[TRUNCATED_DEPTH]";
  if (Array.isArray(value)) return value.map((item) => redactDetailValue(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_DETAIL_KEY_PATTERN.test(key) ? "[REDACTED]" : redactDetailValue(item, depth + 1),
      ])
    );
  }
  if (typeof value === "string" && value.length > 4096) {
    return `${value.slice(0, 4096)}...[TRUNCATED]`;
  }
  return value;
}

function eventObjectReference(event) {
  const metadata = event?.metadata && typeof event.metadata === "object" ? event.metadata : {};
  return (
    metadata.object_reference ||
    metadata.object_ref ||
    metadata.object_id ||
    metadata.object_code ||
    metadata.service_object_id ||
    metadata.resource ||
    metadata.table ||
    metadata.path ||
    null
  );
}

function buildEventDetailPayload(event) {
  if (!event) return {};
  return redactDetailValue({
    id: event.id || null,
    event_type: event.event_type || null,
    occurred_at: event.occurred_at || null,
    severity: event.severity || null,
    outcome: event.outcome || null,
    reason: event.reason || null,
    tenant_id: event.tenant_id || null,
    tenant_code: event.tenant_code || null,
    actor_tenant_id: event.actor_tenant_id || null,
    actor_identity_id: event.actor_identity_id || null,
    target_tenant_id: event.target_tenant_id || null,
    target_identity_id: event.target_identity_id || null,
    connection_code: event.connection_code || null,
    suffix: event.suffix || null,
    object_reference: eventObjectReference(event),
    event_id: event.event_id || null,
    request_id: event.request_id || null,
    source: event.source || null,
    metadata: event.metadata || {},
  });
}

function eventDetailRows(event) {
  const payload = buildEventDetailPayload(event);
  return [
    ["Event id", payload.event_id || payload.id],
    ["Event type", payload.event_type],
    ["Timestamp", formatDate(payload.occurred_at)],
    ["Severity", payload.severity],
    ["Outcome", payload.outcome],
    ["Reason", payload.reason],
    ["Tenant", payload.tenant_code || payload.tenant_id],
    ["Actor tenant", payload.actor_tenant_id],
    ["Actor identity", payload.actor_identity_id],
    ["Target tenant", payload.target_tenant_id],
    ["Target identity", payload.target_identity_id],
    ["Connection", payload.connection_code || payload.suffix],
    ["Object reference", payload.object_reference],
    ["External event id", payload.event_id],
    ["Request id", payload.request_id],
    ["Source", payload.source],
  ];
}

export default function AdminAuditPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [windowKey, setWindowKey] = useState("24h");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        window: windowKey,
        page: String(page),
        page_size: String(pageSize),
      });
      Object.entries(filters).forEach(([key, value]) => {
        const text = String(value || "").trim();
        if (text) params.set(key, text);
      });
      const result = await apiFetch(`/api/eip/admin/security/ops?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize, windowKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedEvent) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSelectedEvent(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEvent]);

  function updateDraftFilter(key, value) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    setPage(1);
    setFilters({
      event_type: draftFilters.event_type.trim(),
      tenant: draftFilters.tenant.trim(),
      outcome: draftFilters.outcome,
      severity: draftFilters.severity,
    });
  }

  function clearFilters() {
    setPage(1);
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
  }

  async function copyDetail(value, label) {
    const text = String(value || "");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(`${label} copied`);
      window.setTimeout(() => setCopyStatus(""), 1800);
    } catch {
      setCopyStatus("Copy unavailable");
      window.setTimeout(() => setCopyStatus(""), 1800);
    }
  }

  const metrics = useMemo(() => {
    const summary = data?.summary || {};
    return [
      { label: "Events", value: summary.total_events ?? 0 },
      { label: "Failures", value: summary.total_failures ?? 0 },
      { label: "Auth failures", value: summary.auth_failures ?? 0 },
      { label: "Gateway failures", value: summary.gateway_failures ?? 0 },
      { label: "Upload rejects", value: summary.upload_rejections ?? 0 },
      { label: "Secret changes", value: summary.secret_changes ?? 0 },
    ];
  }, [data]);

  const topFailures = Array.isArray(data?.top_failures) ? data.top_failures : [];
  const recentEvents = Array.isArray(data?.recent_events) ? data.recent_events : [];
  const connectionHealth = Array.isArray(data?.connection_health) ? data.connection_health : [];
  const filterOptions = data?.recent_event_filter_options || {};
  const eventTypeOptions = Array.isArray(filterOptions.event_types) ? filterOptions.event_types : [];
  const tenantOptions = Array.isArray(filterOptions.tenants) ? filterOptions.tenants : [];
  const hasDraftEventTypeOption = !draftFilters.event_type
    || eventTypeOptions.some((option) => option.value === draftFilters.event_type);
  const hasDraftTenantOption = !draftFilters.tenant
    || tenantOptions.some((option) => option.value === draftFilters.tenant);
  const pagination = data?.recent_events_pagination || {
    page,
    page_size: pageSize,
    total: recentEvents.length,
    total_pages: recentEvents.length > 0 ? 1 : 0,
  };
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const canGoPrevious = pagination.page > 1 && !loading;
  const canGoNext = pagination.total_pages > pagination.page && !loading;
  const selectedPayload = selectedEvent ? buildEventDetailPayload(selectedEvent) : null;
  const selectedPayloadJson = selectedPayload ? JSON.stringify(selectedPayload, null, 2) : "";
  const selectedMetadataJson = selectedPayload ? JSON.stringify(selectedPayload.metadata || {}, null, 2) : "{}";

  return (
    <section className="glass-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">Audit trail</h2>
          <p className="mt-1 text-sm text-ink-500">
            Security operations, connection health, and recent anomalies.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={windowKey}
            onChange={(event) => {
              setWindowKey(event.target.value);
              setPage(1);
            }}
            className="rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-500 outline-none hover:bg-white"
          >
            <option value="24h">24h</option>
            <option value="7d">7d</option>
            <option value="30d">30d</option>
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 hover:bg-white disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          <ShieldAlert className="h-4 w-4" />
          {error.message || "Unable to load security operations."}
        </div>
      ) : null}

      {data?.warning ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          Security event storage has not been migrated yet.
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {metrics.map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-ink-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            Top failures
          </div>
          <div className="mt-4 space-y-3">
            {topFailures.length === 0 ? (
              <p className="text-sm text-ink-500">No security failures in the selected window.</p>
            ) : null}
            {topFailures.map((item) => (
              <div key={`${item.event_type}:${item.reason || ""}`} className="rounded-xl border border-ink-100 bg-white/70 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink-900">{formatEventLabel(item.event_type)}</p>
                  <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">{item.count}</span>
                </div>
                <p className="mt-1 text-xs text-ink-500">{item.reason || item.category}</p>
                <p className="mt-1 text-xs text-ink-400">Last seen {formatDate(item.last_seen_at)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Connection health
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-ink-400">
                <tr>
                  <th className="px-2 py-2">Tenant</th>
                  <th className="px-2 py-2">Connection</th>
                  <th className="px-2 py-2">Failures</th>
                  <th className="px-2 py-2">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {connectionHealth.length === 0 ? (
                  <tr>
                    <td className="px-2 py-3 text-ink-500" colSpan={4}>No connection security events yet.</td>
                  </tr>
                ) : null}
                {connectionHealth.map((item) => (
                  <tr key={`${item.tenant_id}:${item.connection_code}:${item.suffix}`} className="border-t border-ink-100">
                    <td className="px-2 py-3 text-ink-700">{item.tenant_code || item.tenant_id || "-"}</td>
                    <td className="px-2 py-3 text-ink-700">{item.connection_code || item.suffix || "-"}</td>
                    <td className="px-2 py-3 text-ink-700">{item.failure_events ?? 0}</td>
                    <td className="px-2 py-3 text-ink-500">{formatDate(item.last_seen_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <FileClock className="h-4 w-4 text-ink-500" />
            Recent events
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                {activeFilterCount} filtered
              </span>
            ) : null}
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
            {pagination.total ?? 0} events
          </div>
        </div>

        <form onSubmit={applyFilters} className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_1fr_0.8fr_0.8fr_auto_auto]">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Event type</span>
            <select
              value={draftFilters.event_type}
              onChange={(event) => updateDraftFilter("event_type", event.target.value)}
              className={FILTER_CONTROL_CLASS}
            >
              <option value="">All</option>
              {!hasDraftEventTypeOption ? (
                <option value={draftFilters.event_type}>{formatEventLabel(draftFilters.event_type)}</option>
              ) : null}
              {eventTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {formatEventLabel(option.label || option.value)} ({option.count ?? 0})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Tenant</span>
            <select
              value={draftFilters.tenant}
              onChange={(event) => updateDraftFilter("tenant", event.target.value)}
              className={FILTER_CONTROL_CLASS}
            >
              <option value="">All</option>
              {!hasDraftTenantOption ? (
                <option value={draftFilters.tenant}>{draftFilters.tenant}</option>
              ) : null}
              {tenantOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label || option.value} ({option.count ?? 0})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Outcome</span>
            <select
              value={draftFilters.outcome}
              onChange={(event) => updateDraftFilter("outcome", event.target.value)}
              className={FILTER_CONTROL_CLASS}
            >
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="denied">Denied</option>
              <option value="rejected">Rejected</option>
              <option value="blocked">Blocked</option>
              <option value="error">Error</option>
              <option value="observed">Observed</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Severity</span>
            <select
              value={draftFilters.severity}
              onChange={(event) => updateDraftFilter("severity", event.target.value)}
              className={FILTER_CONTROL_CLASS}
            >
              <option value="">All</option>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <button
            type="submit"
            className={`${FILTER_BUTTON_CLASS} bg-ink-900 text-white hover:bg-ink-800`}
          >
            <Filter className="h-3.5 w-3.5" />
            Apply
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className={`${FILTER_BUTTON_CLASS} border border-ink-200 bg-white/70 text-ink-500 hover:bg-white`}
          >
            Clear
          </button>
        </form>

        <div className="mt-4 space-y-3">
          {recentEvents.length === 0 && !loading ? (
            <p className="text-sm text-ink-500">
              {activeFilterCount > 0
                ? "No security events match the selected filters."
                : "No security events recorded in the selected window."}
            </p>
          ) : null}
          {recentEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => {
                setSelectedEvent(event);
                setCopyStatus("");
              }}
              className="flex w-full flex-wrap items-start justify-between gap-3 rounded-xl border border-ink-100 bg-white/70 px-3 py-3 text-left transition hover:border-indigo-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <div>
                <p className="text-sm font-semibold text-ink-900">{formatEventLabel(event.event_type)}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {event.tenant_code || event.tenant_id || "global"} / {event.connection_code || event.suffix || event.category}
                </p>
                {event.reason ? <p className="mt-1 text-xs text-rose-600">{event.reason}</p> : null}
              </div>
              <div className="text-right text-xs text-ink-400">
                <p>{event.outcome}</p>
                <p>{formatDate(event.occurred_at)}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
            {pagination.total_pages > 0
              ? `Page ${pagination.page} of ${pagination.total_pages}`
              : "No pages"}
          </p>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className={PAGER_CONTROL_CLASS}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option} / page</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setPage(Math.max(1, pagination.page - 1))}
              disabled={!canGoPrevious}
              className={PAGER_BUTTON_CLASS}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage(pagination.page + 1)}
              disabled={!canGoNext}
              className={PAGER_BUTTON_CLASS}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {selectedEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close event details"
            className="absolute inset-0 cursor-default"
            onClick={() => setSelectedEvent(null)}
          />
          <aside className="relative z-10 flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">Security event</p>
                <h3 className="mt-1 text-lg font-semibold text-ink-900">{formatEventLabel(selectedEvent.event_type)}</h3>
                <p className="mt-1 text-xs text-ink-500">{formatDate(selectedEvent.occurred_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-full border border-ink-100 bg-white p-2 text-ink-500 hover:bg-ink-50"
                aria-label="Close event details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto px-5 py-5">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyDetail(selectedEvent.event_id || selectedEvent.id, "Event id")}
                  className={DETAIL_COPY_BUTTON_CLASS}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Event id
                </button>
                <button
                  type="button"
                  onClick={() => copyDetail(selectedEvent.event_type, "Event type")}
                  className={DETAIL_COPY_BUTTON_CLASS}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Event type
                </button>
                <button
                  type="button"
                  onClick={() => copyDetail(selectedPayloadJson, "Redacted JSON")}
                  className={DETAIL_COPY_BUTTON_CLASS}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Redacted JSON
                </button>
                {copyStatus ? (
                  <span className="inline-flex h-8 items-center rounded-full bg-emerald-50 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    {copyStatus}
                  </span>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {eventDetailRows(selectedEvent).map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-ink-100 bg-ink-50/70 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">{label}</p>
                    <p className="mt-1 break-all text-sm font-semibold text-ink-800">{displayValue(value)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl border border-ink-100 bg-ink-950 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">Redacted metadata</p>
                  <button
                    type="button"
                    onClick={() => copyDetail(selectedMetadataJson, "Metadata JSON")}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white hover:bg-white/15"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                </div>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-ink-100">
                  {selectedMetadataJson}
                </pre>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

export {
  buildEventDetailPayload,
  redactDetailValue
};
