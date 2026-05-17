export default function StatCard({ node }) {
  const { label, value, delta, tone = "ink", className = "" } = node.props || {};
  const tones = {
    emerald: "text-emerald-700 bg-emerald-100",
    rose: "text-rose-700 bg-rose-100",
    indigo: "text-indigo-700 bg-indigo-100",
    cyan: "text-cyan-700 bg-cyan-100",
    ink: "text-ink-700 bg-ink-100",
  };

  return (
    <div className={`rounded-xl border border-white/70 bg-white/80 px-4 py-3 shadow-soft ${className}`.trim()}>
      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">{label}</p>
      <div className="mt-2 flex items-end justify-between">
        <p className="text-xl font-semibold text-ink-900">{value}</p>
        {delta ? (
          <span className={`rounded-full px-2 py-1 text-[0.55rem] font-semibold ${tones[tone] || tones.ink}`}>
            {delta}
          </span>
        ) : null}
      </div>
    </div>
  );
}
