import { LayoutGrid, Activity, FileText } from "lucide-react";

export default function UserDashboardPanel() {
  return (
    <section className="glass-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">User dashboard</h2>
          <p className="mt-1 text-sm text-ink-500">
            Workspaces, tasks, and operational insights will appear here.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card icon={LayoutGrid} label="Active modules" value="3" />
        <Card icon={Activity} label="Open tasks" value="12" />
        <Card icon={FileText} label="Recent reports" value="4" />
      </div>

      <div className="mt-6 rounded-2xl border border-white/70 bg-white/80 px-4 py-4 text-sm text-ink-500 shadow-soft">
        This dashboard will be wired to tenant modules once ERP surfaces are enabled.
      </div>
    </section>
  );
}

function Card({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-soft">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-ink-400">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-ink-400" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-ink-900">{value}</p>
    </div>
  );
}
