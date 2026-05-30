import { useEffect, useMemo, useState } from "react";
import { Activity, FileText, LayoutGrid, RefreshCw } from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const DASHBOARD_CARDS = [
  {
    code: "active_modules",
    label: "Active modules",
    icon: LayoutGrid,
    helper: "Enabled module and surface areas"
  },
  {
    code: "open_tasks",
    label: "Open tasks",
    icon: Activity,
    helper: "Live open work from the task engine"
  },
  {
    code: "recent_reports",
    label: "Recent reports",
    icon: FileText,
    helper: "Reports and report-like records from the last 30 days"
  }
];

export default function UserDashboardPanel() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSummary = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch("/api/eip/user/dashboard/summary");
      setSummary(result);
    } catch (err) {
      setError("Unable to load live dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await apiFetch("/api/eip/user/dashboard/summary");
        if (active) setSummary(result);
      } catch {
        if (active) setError("Unable to load live dashboard metrics.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(
    () =>
      DASHBOARD_CARDS.map((card) => ({
        ...card,
        value: summary?.stats?.[card.code] ?? "—"
      })),
    [summary]
  );

  return (
    <section className="glass-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">User dashboard</h2>
          <p className="mt-1 text-sm text-ink-500">
            Live workspace modules, process tasks, and recent report activity.
          </p>
        </div>
        <button
          type="button"
          onClick={loadSummary}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 shadow-soft transition hover:text-ink-900 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.code} icon={card.icon} label={card.label} value={card.value} helper={card.helper} loading={loading} />
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <InfoPanel
          title="Active modules"
          empty="No active modules detected yet."
          items={(summary?.active_modules || []).map((item) => ({ label: item }))}
        />
        <InfoPanel
          title="Open task queue"
          empty="No open tasks."
          items={(summary?.recent_tasks || []).map((task) => ({
            label: task.title || task.task_type || "Task",
            meta: [task.status, task.due_at ? `Due ${formatDate(task.due_at)}` : null].filter(Boolean).join(" · ")
          }))}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-white/70 bg-white/80 px-4 py-4 text-sm text-ink-500 shadow-soft">
        These cards are live now. Card definitions are intentionally isolated in a descriptor-like array so they can later move into the UI surface tree without changing the dashboard renderer.
      </div>
    </section>
  );
}

function Card({ icon: Icon, label, value, helper, loading }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-soft">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-ink-400">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-ink-400" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-ink-900">{loading ? "…" : value}</p>
      <p className="mt-2 text-xs text-ink-400">{helper}</p>
    </div>
  );
}

function InfoPanel({ title, empty, items }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-soft">
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.slice(0, 6).map((item, index) => (
            <div key={`${item.label}-${index}`} className="rounded-xl border border-ink-100 bg-ink-50/70 px-3 py-2 text-sm">
              <p className="font-semibold text-ink-800">{item.label}</p>
              {item.meta ? <p className="mt-1 text-xs text-ink-400">{item.meta}</p> : null}
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-ink-200 bg-white/70 px-3 py-3 text-sm text-ink-400">{empty}</p>
        )}
      </div>
    </div>
  );
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}
