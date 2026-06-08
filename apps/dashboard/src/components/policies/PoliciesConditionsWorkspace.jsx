import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileClock,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const DEFAULT_ENDPOINTS = {
  list: "/api/eip/policies-conditions",
  detail: "/api/eip/policies-conditions/:id",
  overview: "/api/eip/policies-conditions/overview"
};

const DEFAULT_LABELS = {
  title: "Policies & Conditions",
  subtitle: "Read-only business rules that explain recommendations and approvals.",
  overview: "Overview",
  library: "Policy Library",
  needsReview: "Needs Review",
  search: "Search policies...",
  refresh: "Refresh",
  mapped: "Mapped",
  needs_review: "Needs review",
  legacy_ambiguous: "Legacy ambiguous",
  inactive: "Inactive",
  expired: "Expired",
  future: "Future",
  active: "Active",
  detailTitle: "Condition detail",
  noSelection: "Select a policy or condition to inspect the read model.",
  legacyType: "Legacy type",
  legacyCategory: "Legacy category",
  domain: "Domain",
  family: "Family",
  conditionType: "Condition type",
  nature: "Nature",
  scope: "Scope",
  values: "Values",
  validity: "Validity",
  warnings: "Warnings",
  readOnly: "Create/edit will be added in a later governed wave.",
  emptyTitle: "No policies or conditions yet",
  emptyMessage: "Create governed business rules before EIP can explain recommendations for this area.",
};

const STATUS_TONES = {
  active: "border-emerald-100 bg-emerald-50 text-emerald-700",
  inactive: "border-slate-100 bg-slate-50 text-slate-600",
  expired: "border-rose-100 bg-rose-50 text-rose-700",
  future: "border-sky-100 bg-sky-50 text-sky-700",
  needs_review: "border-amber-100 bg-amber-50 text-amber-700",
};

const MAPPING_TONES = {
  mapped: "border-emerald-100 bg-emerald-50 text-emerald-700",
  needs_review: "border-amber-100 bg-amber-50 text-amber-700",
  legacy_ambiguous: "border-orange-100 bg-orange-50 text-orange-700",
};

function formatLabel(value) {
  const text = String(value || "").replace(/_/g, " ").trim();
  return text ? text.replace(/\b\w/g, (char) => char.toUpperCase()) : "-";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function parseApiError(error) {
  const message = error?.message || "";
  const match = message.match(/API\s+(\d+):\s*(.*)$/s);
  if (!match) return message || "Request failed.";
  try {
    const payload = JSON.parse(match[2]);
    if (payload?.error === "FORBIDDEN") return "Access denied. Ask an admin to grant Policies & Conditions read access.";
    if (payload?.error) return payload.error.replace(/_/g, " ");
  } catch {
    return match[2] || message;
  }
  return message;
}

function Pill({ value, tones = STATUS_TONES, labels = DEFAULT_LABELS }) {
  const normalized = String(value || "").trim().toLowerCase();
  const tone = tones[normalized] || "border-ink-100 bg-white text-ink-500";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${tone}`}>
      {labels[normalized] || formatLabel(value)}
    </span>
  );
}
function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-400">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-brand-500" /> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-ink-900">{value ?? 0}</p>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white/75 px-3 py-2">
      <p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-ink-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-ink-800">{value || "-"}</p>
    </div>
  );
}

function JsonBlock({ value }) {
  const hasValue = value && (Array.isArray(value) ? value.length : Object.keys(value || {}).length);
  return (
    <pre className="max-h-52 overflow-auto rounded-2xl border border-ink-100 bg-ink-950 p-3 text-xs text-white">
      {hasValue ? JSON.stringify(value, null, 2) : "{}"}
    </pre>
  );
}

function buildQuery({ page, pageSize, query, tab, filters }) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (query.trim()) params.set("q", query.trim());
  if (tab === "needs_review") params.set("status", "needs_review");
  for (const [key, value] of Object.entries(filters || {})) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export default function PoliciesConditionsWorkspace({ node } = {}) {
  const props = node?.props || {};
  const endpoints = { ...DEFAULT_ENDPOINTS, ...(props.endpoints || {}) };
  const labels = { ...DEFAULT_LABELS, ...(props.labels || {}) };
  const tabs = props.tabs || [
    { id: "overview", label: labels.overview },
    { id: "library", label: labels.library },
    { id: "needs_review", label: labels.needsReview },
  ];
  const pageSizes = props.pageSizes || [12, 25, 50];

  const [tab, setTab] = useState(tabs[0]?.id || "overview");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    policy_domain: "",
    condition_type: "",
    condition_category: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [payload, setPayload] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const items = payload?.items || [];
  const summary = payload?.summary || {};
  const emptyState = payload?.empty_state || {
    title: labels.emptyTitle,
    message: labels.emptyMessage,
  };
  const totalPages = payload?.total_pages || 0;

  const domainOptions = useMemo(() => {
    const values = new Set(items.map((item) => item.classification?.policy_domain).filter(Boolean));
    return [...values].sort();
  }, [items]);

  const loadList = async () => {
    setLoading(true);
    setError("");
    try {
      const qs = buildQuery({ page, pageSize, query, tab, filters });
      const result = await apiFetch(`${endpoints.list}?${qs}`);
      setPayload(result);
      if (selectedId && !result.items?.some((item) => item.id === selectedId)) {
        setSelectedId("");
        setDetail(null);
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id) => {
    if (!id) return;
    setSelectedId(id);
    setDetailLoading(true);
    setError("");
    try {
      const path = endpoints.detail.includes(":id")
        ? endpoints.detail.replace(":id", encodeURIComponent(id))
        : `${endpoints.detail}/${encodeURIComponent(id)}`;
      const result = await apiFetch(path);
      setDetail(result?.item || null);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, tab, filters.policy_domain, filters.condition_type, filters.condition_category]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1);
      loadList();
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const selected = detail || items.find((item) => item.id === selectedId) || null;

  return (
    <section className="min-h-[calc(100vh-8rem)] space-y-5 rounded-[2rem] border border-white/75 bg-white/90 p-5 shadow-soft">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-brand-500">Business rules</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink-900">{props.title || labels.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-500">{props.subtitle || labels.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setPage(1);
              }}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                tab === item.id
                  ? "border-ink-900 bg-ink-900 text-white"
                  : "border-ink-100 bg-white/80 text-ink-500 hover:bg-white"
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={loadList}
            className="inline-flex items-center gap-2 rounded-full border border-ink-100 bg-white px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {labels.refresh}
          </button>
        </div>
      </header>

      <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm font-semibold text-amber-800">
        {labels.readOnly}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Total" value={summary.total || 0} icon={FileClock} />
        <Metric label="Active" value={summary.active || 0} icon={CheckCircle2} />
        <Metric label="Expired" value={summary.expired || 0} icon={Clock3} />
        <Metric label="Needs review" value={summary.needs_review || 0} icon={AlertTriangle} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="rounded-[1.5rem] border border-white/70 bg-white/75 p-4 shadow-soft">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder={labels.search}
                className="w-full rounded-full border border-ink-100 bg-white px-9 py-2 text-sm text-ink-700 outline-none focus:border-brand-300"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <select
                value={filters.policy_domain}
                onChange={(event) => {
                  setFilters((prev) => ({ ...prev, policy_domain: event.target.value }));
                  setPage(1);
                }}
                className="rounded-full border border-ink-100 bg-white px-3 py-2 text-sm font-semibold text-ink-500"
              >
                <option value="">All domains</option>
                {domainOptions.map((value) => (
                  <option key={value} value={value}>{formatLabel(value)}</option>
                ))}
              </select>
              <input
                value={filters.condition_type}
                onChange={(event) => {
                  setFilters((prev) => ({ ...prev, condition_type: event.target.value }));
                  setPage(1);
                }}
                placeholder="Condition type"
                className="w-40 rounded-full border border-ink-100 bg-white px-3 py-2 text-sm font-semibold text-ink-500"
              />
              <input
                value={filters.condition_category}
                onChange={(event) => {
                  setFilters((prev) => ({ ...prev, condition_category: event.target.value }));
                  setPage(1);
                }}
                placeholder="Legacy category"
                className="w-40 rounded-full border border-ink-100 bg-white px-3 py-2 text-sm font-semibold text-ink-500"
              />
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-2xl border border-ink-100 bg-white">
            <div className="grid grid-cols-[minmax(16rem,1.4fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)_8rem] gap-3 border-b border-ink-100 bg-ink-50/80 px-4 py-3 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
              <span>Condition</span>
              <span>Classification</span>
              <span>Legacy</span>
              <span>Status</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm font-semibold text-ink-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading policies...
              </div>
            ) : items.length ? (
              <div className="divide-y divide-ink-100">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => loadDetail(item.id)}
                    className={`grid w-full grid-cols-[minmax(16rem,1.4fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)_8rem] gap-3 px-4 py-3 text-left transition hover:bg-brand-50/60 ${
                      selectedId === item.id ? "bg-brand-50" : "bg-white"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-semibold text-ink-900">{item.label || item.code}</span>
                      <span className="mt-1 block text-xs text-ink-400">{item.code}</span>
                    </span>
                    <span className="space-y-1">
                      <span className="block text-sm font-semibold text-ink-700">{formatLabel(item.classification?.policy_domain)}</span>
                      <Pill value={item.classification?.mapping_status} tones={MAPPING_TONES} labels={labels} />
                    </span>
                    <span className="text-xs text-ink-500">
                      <strong className="block text-sm text-ink-700">{item.legacy?.condition_type || "-"}</strong>
                      {item.legacy?.condition_category || "-"}
                    </span>
                    <span>
                      <Pill value={item.status} labels={labels} />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-12 text-center">
                <p className="text-lg font-semibold text-ink-800">{emptyState.title || labels.emptyTitle}</p>
                <p className="mt-1 text-sm text-ink-500">{emptyState.message || labels.emptyMessage}</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-500">
            <span>
              Page {payload?.page || 1} of {totalPages || 1} - {payload?.total || 0} records
            </span>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-full border border-ink-100 bg-white px-3 py-2 text-sm font-semibold text-ink-500"
              >
                {pageSizes.map((size) => (
                  <option key={size} value={size}>{size} per page</option>
                ))}
              </select>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-full border border-ink-100 bg-white px-3 py-2 font-semibold disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={!totalPages || page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-full border border-ink-100 bg-white px-3 py-2 font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <aside className="rounded-[1.5rem] border border-white/70 bg-white/80 p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-500" />
            <h2 className="text-lg font-semibold text-ink-900">{labels.detailTitle}</h2>
          </div>
          {detailLoading ? (
            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-ink-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading detail...
            </div>
          ) : selected ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xl font-semibold text-ink-900">{selected.label || selected.code}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">{selected.code}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill value={selected.status} labels={labels} />
                <Pill value={selected.classification?.mapping_status} tones={MAPPING_TONES} labels={labels} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <DetailRow label={labels.domain} value={formatLabel(selected.classification?.policy_domain)} />
                <DetailRow label={labels.family} value={formatLabel(selected.classification?.policy_family)} />
                <DetailRow label={labels.conditionType} value={selected.classification?.condition_type} />
                <DetailRow label={labels.nature} value={formatLabel(selected.classification?.condition_nature)} />
                <DetailRow label={labels.legacyType} value={selected.legacy?.condition_type} />
                <DetailRow label={labels.legacyCategory} value={selected.legacy?.condition_category} />
                <DetailRow label={labels.scope} value={formatLabel(selected.scope_summary?.scope_kind)} />
                <DetailRow label={labels.validity} value={`${formatLabel(selected.validity?.status)} (${formatDate(selected.validity?.valid_from)} - ${formatDate(selected.validity?.valid_to)})`} />
              </div>
              <div>
                <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-400">{labels.values}</p>
                <JsonBlock value={selected.value_summary} />
              </div>
              {selected.safe_machine_fields ? (
                <div>
                  <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-400">Safe machine fields</p>
                  <JsonBlock value={selected.safe_machine_fields} />
                </div>
              ) : null}
              <div>
                <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink-400">{labels.warnings}</p>
                {selected.warnings?.length ? (
                  <div className="space-y-2">
                    {selected.warnings.map((warning) => (
                      <div key={warning.code} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        <strong>{warning.code}</strong>
                        <span className="block text-xs">{warning.message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    No warnings.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-6 rounded-2xl border border-ink-100 bg-ink-50 px-4 py-5 text-sm text-ink-500">
              {labels.noSelection}
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
