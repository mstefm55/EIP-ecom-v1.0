import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileClock, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { apiFetch } from "../../services/apiClient";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatEventLabel(value) {
  return String(value || "security.event").replaceAll("_", " ").replaceAll(".", " / ");
}

export default function AdminAuditPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch("/api/eip/admin/security/ops?window=24h");
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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

  return (
    <section className="glass-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">Audit trail</h2>
          <p className="mt-1 text-sm text-ink-500">
            Security operations, connection health, and recent anomalies.
          </p>
        </div>
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
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <FileClock className="h-4 w-4 text-ink-500" />
          Recent events
        </div>
        <div className="mt-4 space-y-3">
          {recentEvents.length === 0 && !loading ? (
            <p className="text-sm text-ink-500">No security events recorded in the selected window.</p>
          ) : null}
          {recentEvents.map((event) => (
            <div key={event.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-ink-100 bg-white/70 px-3 py-3">
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
