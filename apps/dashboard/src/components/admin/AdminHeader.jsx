import { ArrowUpRight } from "lucide-react";

export default function AdminHeader({ node }) {
  const { title, subtitle, badge, highlight } = node.props || {};

  return (
    <section className="glass-panel rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-3">
          {badge ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/70 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-500">
              {badge}
            </span>
          ) : null}
          <h1 className="text-2xl font-semibold text-ink-900 md:text-3xl">{title}</h1>
          <p className="max-w-2xl text-xs text-ink-500">{subtitle}</p>
        </div>
        {highlight ? (
          <div className="flex items-center gap-3 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-xs text-ink-600 shadow-soft">
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            <span>{highlight}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
