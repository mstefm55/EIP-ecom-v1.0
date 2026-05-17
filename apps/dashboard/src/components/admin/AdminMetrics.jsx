import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Clock, Users, CheckCircle2 } from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const metricSeries = {
  pending: [6, 9, 8, 7, 10, 9, 11],
  approval: [42, 48, 55, 52, 61, 64, 70],
  time: [18, 16, 15, 14, 13, 12, 11],
  active: [12, 15, 18, 20, 24, 26, 30],
};

function Sparkline({ data, stroke }) {
  const points = data
    .map((value, index) => `${index * 18},${40 - value * 0.4}`)
    .join(" ");
  return (
    <svg viewBox="0 0 120 40" className="h-10 w-full">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function AdminMetrics({ node }) {
  const { endpoint = "/api/eip/admin/tenant-requests" } = node.props || {};
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await apiFetch(`${endpoint}?limit=200`);
        if (active) setItems(Array.isArray(result?.items) ? result.items : []);
      } catch {
        if (active) setItems([]);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [endpoint]);

  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((i) => i.status_code === "PENDING").length;
    const active = items.filter((i) => i.status_code === "ACTIVE").length;
    const bootstrap = items.filter((i) => i.status_code === "BOOTSTRAP_PENDING").length;
    const approvalRate = total ? Math.round((active / total) * 100) : 0;
    return { total, pending, active, bootstrap, approvalRate };
  }, [items]);

  return (
    <section className="glass-panel p-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Pending reviews"
          value={stats.pending}
          icon={Clock}
          tone="text-amber-600"
          chart={<Sparkline data={metricSeries.pending} stroke="#f59e0b" />}
        />
        <MetricCard
          label="Approval rate"
          value={`${stats.approvalRate}%`}
          icon={TrendingUp}
          tone="text-emerald-600"
          chart={<Sparkline data={metricSeries.approval} stroke="#10b981" />}
        />
        <MetricCard
          label="Bootstrap queued"
          value={stats.bootstrap}
          icon={Users}
          tone="text-indigo-600"
          chart={<Sparkline data={metricSeries.time} stroke="#6366f1" />}
        />
        <MetricCard
          label="Active tenants"
          value={stats.active}
          icon={CheckCircle2}
          tone="text-emerald-600"
          chart={<Sparkline data={metricSeries.active} stroke="#22c55e" />}
        />
      </div>
    </section>
  );
}

function MetricCard({ label, value, icon: Icon, tone, chart }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-soft">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-ink-400">
        <span>{label}</span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold text-ink-900">{value}</p>
        <div className="flex-1">{chart}</div>
      </div>
    </div>
  );
}
