import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  ListChecks,
  Search,
  ChevronDown,
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const RANGE_OPTIONS = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

const DEFAULT_KPIS = [
  {
    label: "Total Transactions",
    value: "12.5k",
    delta: "up 6% 24h",
    tone: "emerald",
  },
  {
    label: "Error Rate",
    value: "0.42%",
    delta: "up 0.08%",
    tone: "rose",
  },
  {
    label: "P95 Latency",
    value: "38 ms",
    delta: "down 6%",
    tone: "indigo",
  },
  {
    label: "Active Flows",
    value: "260",
    delta: "+12",
    tone: "cyan",
  },
];

const DEFAULT_VOLUME = {
  title: "EIP Transaction Volume",
  range: "24h",
  labels: ["04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00"],
  series: [
    { name: "Integration", color: "#67b7c5", data: [18, 24, 22, 19, 26, 28, 25, 27] },
    { name: "Transform", color: "#8b8df2", data: [10, 14, 16, 12, 18, 20, 16, 15] },
    { name: "Route", color: "#a8d7c0", data: [8, 12, 10, 9, 11, 14, 12, 13] },
  ],
};

const DEFAULT_LOG = {
  title: "EIP Transaction Log",
  columns: ["ID", "Flow", "Pattern", "State", "Latency", "Started", "Tenant"],
  rows: [
    ["#0022", "EDI-54", "Content Enricher", "Processing", "38 ms", "Jun 18, 2024", "TenantX"],
    ["#0022", "EDI-3303", "Partner ERP", "Processing", "96 ms", "Jun 18, 2024", "TenantX"],
    ["#0023", "API-3303", "Routing", "Processing", "84 ms", "Jun 18, 2024", "TenantX"],
    ["#0022", "API-3301", "Validation", "Processing", "71 ms", "Jun 18, 2024", "ArcadiaXpress"],
    ["#0021", "SFTP-3303", "Mapping", "Processing", "46 ms", "Jun 18, 2024", "CohenX"],
  ],
};

const DEFAULT_DETAILS = {
  title: "Transaction Details",
  id: "#PARTNER-ERP-00013945",
  status: "Processing",
  tabs: ["Trace", "Logs", "Inspector"],
  panels: {
    Trace: [
      { label: "Flow Type", value: "EDI Gateway" },
      { label: "Flow Pattern", value: "Content Enricher" },
      { label: "Integration Client", value: "TenantX -170-684" },
      { label: "Resource Topic", value: "/ingress" },
    ],
    Logs: [
      { label: "Last event", value: "Retry scheduled" },
      { label: "Last retry", value: "2m ago" },
      { label: "Attempts", value: "2 / 5" },
      { label: "Error code", value: "EIP-408" },
    ],
    Inspector: [
      { label: "Payload size", value: "42 KB" },
      { label: "Schema", value: "EDI 4010" },
      { label: "Source", value: "APAC Partner" },
      { label: "Correlation", value: "#APAC-ORD-6791" },
    ],
  },
  meta: [
    { label: "Flow Type", value: "EDI Gateway" },
    { label: "Flow Pattern", value: "Content Enricher" },
    { label: "Integration Client", value: "TenantX -170-684" },
    { label: "Resource Topic", value: "/ingress" },
  ],
};

const DEFAULT_TRACE = {
  title: "Transaction Trace",
  tabs: ["JSON", "Form", "Table", "XML"],
  payload:
    '{\n  "order_id": "10252",\n  "partner_order_ref": "ABC-67990",\n  "placed_at": "2024-04-27T16:16:23Z",\n  "currency": "USD",\n  "subtotal": "1299.95"\n}',
};

function buildPath(data, width, height) {
  if (!data.length) return "";
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  return data
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

export default function AdminMonitoringDashboard({ node }) {
  const {
    kpis = DEFAULT_KPIS,
    volume = DEFAULT_VOLUME,
    log = DEFAULT_LOG,
    details = DEFAULT_DETAILS,
    trace = DEFAULT_TRACE,
    endpoint,
  } = node.props || {};

  const [remote, setRemote] = useState(null);
  const [rangeValue, setRangeValue] = useState("24h");
  const [rangeOpen, setRangeOpen] = useState(false);
  const rangeRef = useRef(null);

  const endpointUrl = useMemo(() => {
    if (!endpoint) return null;
    const sep = endpoint.includes("?") ? "&" : "?";
    return `${endpoint}${sep}window=${encodeURIComponent(rangeValue)}`;
  }, [endpoint, rangeValue]);

  useEffect(() => {
    let active = true;
    if (!endpointUrl) return () => {};
    apiFetch(endpointUrl)
      .then((data) => {
        if (!active || !data?.ok) return;
        setRemote(data);
      })
      .catch(() => {
        if (!active) return;
        setRemote(null);
      });
    return () => {
      active = false;
    };
  }, [endpointUrl]);

  useEffect(() => {
    if (!rangeOpen) return () => {};
    const handleClick = (event) => {
      if (!rangeRef.current) return;
      if (!rangeRef.current.contains(event.target)) {
        setRangeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [rangeOpen]);

  const resolved = remote?.ok ? remote : null;
  const resolvedKpis = resolved?.kpis || kpis;
  const resolvedVolume = resolved?.volume || volume;
  const resolvedLog = resolved?.log || log;
  const resolvedDetails = resolved?.details || details;
  const resolvedTrace = resolved?.trace || trace;
  const notes = resolved?.notes || {};
  const logItems = Array.isArray(resolvedLog.items) ? resolvedLog.items : null;
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!logItems?.length) return;
    setSelectedId((prev) => (prev && logItems.find((item) => item.id === prev) ? prev : logItems[0].id));
  }, [logItems]);

  const volumeLabels = Array.isArray(resolvedVolume.labels) ? resolvedVolume.labels : [];
  const volumeSeries = Array.isArray(resolvedVolume.series) ? resolvedVolume.series : [];

  useEffect(() => {
    if (!volumeLabels.length) return;
    setSelectedIndex((prev) => (prev >= volumeLabels.length ? volumeLabels.length - 1 : prev));
  }, [volumeLabels]);

  const selectedItem = logItems?.find((item) => item.id === selectedId) || null;
  const activeDetails = selectedItem?.details || resolvedDetails;
  const activeTrace = selectedItem?.trace || resolvedTrace;

  const detailTabs = Array.isArray(activeDetails.tabs) && activeDetails.tabs.length ? activeDetails.tabs : ["Trace"];
  const [detailTab, setDetailTab] = useState(detailTabs[0]);
  const [traceTab, setTraceTab] = useState(activeTrace.tabs?.[0] || "JSON");

  const detailPanels = activeDetails.panels || {};
  const detailItems = detailPanels[detailTab] || activeDetails.meta || [];

  useEffect(() => {
    if (!detailTabs.includes(detailTab)) {
      setDetailTab(detailTabs[0]);
    }
  }, [detailTabs, detailTab]);

  useEffect(() => {
    const traceTabs = activeTrace.tabs || [];
    if (traceTabs.length && !traceTabs.includes(traceTab)) {
      setTraceTab(traceTabs[0]);
    }
  }, [activeTrace.tabs, traceTab]);

  const chartPaths = useMemo(() => {
    const width = 260;
    const height = 80;
    return (resolvedVolume.series || []).map((series) => ({
      name: series.name,
      color: series.color,
      path: buildPath(series.data || [], width, height),
    }));
  }, [resolvedVolume]);

  const drilldown = useMemo(() => {
    if (!volumeLabels.length || !volumeSeries.length) {
      return { label: "--", total: 0, rows: [] };
    }
    const label = volumeLabels[selectedIndex] || "--";
    const rows = volumeSeries.map((series) => ({
      name: series.name,
      value: series.data?.[selectedIndex] ?? 0,
      color: series.color,
    }));
    const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
    return { label, total, rows };
  }, [volumeLabels, volumeSeries, selectedIndex]);

  const volumeMeta = resolvedVolume.meta || {};
  const volumeTotal =
    volumeMeta.total ??
    volumeSeries.reduce(
      (sum, series) => sum + (series.data || []).reduce((seriesSum, value) => seriesSum + Number(value || 0), 0),
      0
    );
  const lastDataLabel = volumeMeta.lastDataAt
    ? new Date(volumeMeta.lastDataAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  const hasVolumeData = volumeTotal > 0;

  const rangeLabel = resolvedVolume.range || rangeValue;

  const tableRows = useMemo(() => {
    if (logItems?.length) {
      return logItems.map((item, index) => ({
        key: `${item.id}-${index}`,
        id: item.id,
        selectable: true,
        cells: [
          item.id,
          item.flow,
          item.pattern,
          item.state,
          item.latency,
          item.started,
          item.tenant,
        ],
      }));
    }
    return (resolvedLog.rows || []).map((row, index) => ({
      key: `row-${index}`,
      id: null,
      selectable: false,
      cells: row,
    }));
  }, [logItems, resolvedLog.rows]);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-4">
        {resolvedKpis.map((kpi) => {
          const toneClass = {
            emerald: "text-emerald-500 bg-emerald-100 text-emerald-700",
            rose: "text-rose-500 bg-rose-100 text-rose-700",
            indigo: "text-indigo-500 bg-indigo-100 text-indigo-700",
            cyan: "text-cyan-500 bg-cyan-100 text-cyan-700",
          }[kpi.tone] || "text-ink-500 bg-ink-100 text-ink-700";
          const iconClass = toneClass.split(" ")[0];
          const badgeClass = toneClass.split(" ").slice(1).join(" ");
          return (
            <div key={kpi.label} className="rounded-xl border border-white/70 bg-white/80 px-4 py-3 shadow-soft">
              <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                <span>{kpi.label}</span>
                <Activity className={`h-4 w-4 ${iconClass}`} />
              </div>
              <div className="mt-2 flex items-end justify-between">
                <p className="text-xl font-semibold text-ink-900">{kpi.value}</p>
                <span className={`rounded-full px-2 py-1 text-[0.55rem] font-semibold ${badgeClass}`}>
                  {kpi.delta}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="glass-panel rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-ink-900">{resolvedVolume.title}</h3>
                <p className="mt-1 text-[0.65rem] text-ink-400">Volume</p>
              </div>
              <div ref={rangeRef} className="relative z-20">
                <button
                  type="button"
                  onClick={() => setRangeOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/70 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-ink-500"
                >
                  {rangeLabel}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {rangeOpen ? (
                  <div className="absolute right-0 z-40 mt-2 w-24 rounded-2xl border border-white/60 bg-white/95 p-2 text-[0.55rem] uppercase tracking-[0.25em] text-ink-500 shadow-soft">
                    {RANGE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setRangeValue(option.value);
                          setRangeOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-2 py-1 text-left ${
                          rangeValue === option.value ? "bg-ink-100 text-ink-700" : "hover:bg-ink-50"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4">
              <div className="relative h-24 w-full">
                <svg viewBox="0 0 260 80" className="h-full w-full">
                  {chartPaths.map((series) => (
                    <g key={series.name}>
                      <path d={series.path} fill="none" stroke={series.color} strokeWidth="2.5" />
                    </g>
                  ))}
                </svg>
                {volumeLabels.length ? (
                  <div
                    className="absolute inset-0 grid"
                    style={{ gridTemplateColumns: `repeat(${volumeLabels.length}, minmax(0, 1fr))` }}
                  >
                    {volumeLabels.map((label, idx) => {
                      const active = idx === selectedIndex;
                      return (
                        <button
                          key={`${label}-${idx}`}
                          type="button"
                          onClick={() => setSelectedIndex(idx)}
                          className="group relative focus:outline-none"
                          title={`Bucket ${label}`}
                        >
                          {active ? (
                            <span className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-ink-200/80" />
                          ) : null}
                          <span
                            className={`absolute bottom-2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                              active ? "bg-ink-900" : "bg-ink-300/70 group-hover:bg-ink-500"
                            }`}
                          />
                          <span className="sr-only">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[0.65rem] text-ink-400">
                {(resolvedVolume.series || []).map((series) => (
                  <span key={series.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: series.color }} />
                    {series.name}
                  </span>
                ))}
              </div>
              {!hasVolumeData ? (
                <p className="mt-2 text-[0.65rem] text-ink-400">
                  No transaction activity in this range.
                  {lastDataLabel ? ` Last activity ${lastDataLabel}.` : ""}
                </p>
              ) : (
                <p className="mt-2 text-[0.65rem] text-ink-400">Window total {volumeTotal} transactions.</p>
              )}
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink-900">Volume Drilldown</h3>
                <p className="mt-1 text-[0.65rem] text-ink-400">Bucket {drilldown.label}</p>
              </div>
              <span className="rounded-full border border-ink-200/70 bg-white/70 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-ink-500">
                Total {drilldown.total}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {drilldown.rows.map((row) => (
                <div key={row.name} className="flex items-center justify-between rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-[0.65rem] text-ink-500">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                    {row.name}
                  </span>
                  <span className="font-semibold text-ink-700">{row.value}</span>
                </div>
              ))}
            </div>
            {drilldown.total ? (
              <p className="mt-3 text-[0.6rem] text-ink-400">Click a point on the chart to drill down.</p>
            ) : (
              <p className="mt-3 text-[0.6rem] text-ink-400">No transactions in this range.</p>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-ink-900">{resolvedLog.title}</h3>
            <div className="flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/70 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-ink-500">
              <Search className="h-3.5 w-3.5" />
              Search
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-white/60 bg-white/70">
            <div className="grid min-w-0 grid-cols-[84px_160px_160px_120px_120px_140px_minmax(140px,1fr)] gap-2 border-b border-white/70 px-4 py-2 text-[0.55rem] uppercase tracking-[0.3em] text-ink-400">
              {resolvedLog.columns?.map((col) => (
                <span key={col}>{col}</span>
              ))}
            </div>
            <div className="divide-y divide-white/70">
              {tableRows.map((row) => {
                const isSelected = row.selectable ? row.id === selectedId : false;
                return (
                  <div
                    key={row.key}
                    role={row.selectable ? "button" : undefined}
                    tabIndex={row.selectable ? 0 : undefined}
                    onClick={() => {
                      if (!row.selectable) return;
                      setSelectedId(row.id);
                    }}
                    onKeyDown={(event) => {
                      if (!row.selectable) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(row.id);
                      }
                    }}
                    className={`grid min-w-0 grid-cols-[84px_160px_160px_120px_120px_140px_minmax(140px,1fr)] gap-2 px-4 py-2 text-[0.7rem] text-ink-600 ${
                      row.selectable ? "cursor-pointer transition hover:bg-white/80" : ""
                    } ${isSelected ? "bg-white/90 ring-1 ring-ink-900/10" : ""}`}
                  >
                    {row.cells.map((cell, cellIdx) => {
                      const shouldTruncate = cellIdx === 1 || cellIdx === 2 || cellIdx === 6;
                      const baseClass = shouldTruncate ? "min-w-0 truncate" : "min-w-0 whitespace-nowrap";
                      if (cellIdx === 3) {
                        return (
                          <span
                            key={cellIdx}
                            className="min-w-0 rounded-full bg-ink-100 px-2 py-0.5 text-center text-[0.55rem] font-semibold text-ink-600"
                          >
                            {cell}
                          </span>
                        );
                      }
                      return (
                        <span key={cellIdx} className={baseClass} title={shouldTruncate ? cell : undefined}>
                          {cell}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink-900">{activeDetails.title}</h3>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                {activeDetails.status}
              </span>
            </div>
            <p className="mt-1 text-[0.7rem] text-ink-500">{activeDetails.id}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {detailTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={`rounded-full px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.25em] ${
                    detailTab === tab
                      ? "bg-ink-900 text-white shadow-glow"
                      : "border border-white/60 bg-white/70 text-ink-500"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              {(detailItems || []).map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-[0.65rem] text-ink-500">
                  <span>{item.label}</span>
                  <span className="font-semibold text-ink-700">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink-900">{activeTrace.title}</h3>
              <div className="flex items-center gap-2">
                {activeTrace.tabs?.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setTraceTab(tab)}
                    className={`rounded-full px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.25em] ${
                      traceTab === tab
                        ? "bg-ink-900 text-white shadow-glow"
                        : "border border-white/60 bg-white/70 text-ink-500"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/70 bg-ink-900/90 p-4 text-[0.65rem] text-ink-100 shadow-soft">
              <pre className="whitespace-pre-wrap font-mono">{activeTrace.payload}</pre>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[0.65rem] text-ink-400">
              <ListChecks className="h-4 w-4" />
              {traceTab} view selected
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/70 bg-white/80 px-4 py-3 shadow-soft">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-ink-400" />
            <p className="text-[0.7rem] text-ink-500">{notes.lastSync || "Last sync 2 minutes ago"}</p>
          </div>
          <div className="mt-2 text-[0.65rem] text-ink-400">
            Active tenants {notes.activeTenants ?? "-"} | Active sessions {notes.activeSessions ?? "-"}
          </div>
          {notes.newTenants !== undefined ? (
            <div className="mt-1 text-[0.6rem] text-ink-300">
              New tenants (7d) {notes.newTenants}
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-white/70 bg-rose-50/70 px-4 py-3 text-[0.7rem] text-rose-600 shadow-soft">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4" />
            {notes.alert || "No elevated errors detected"}
          </div>
          <div className="mt-2 text-[0.65rem] text-rose-500">
            Pending onboarding {notes.pendingOnboarding ?? 0} | Failed logins {notes.failedLogins ?? 0}
          </div>
          <div className="mt-1 text-[0.6rem] text-rose-400">
            OTP requests {notes.otpRequests ?? 0}
          </div>
        </div>
      </div>
    </section>
  );
}
