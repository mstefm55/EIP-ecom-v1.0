export default function AuthHero({ node }) {
  const { eyebrow, title, subtitle, badges = [], metrics = [], titleClass } = node.props || {};
  const headlineClass =
    titleClass ||
    "mt-4 text-4xl font-semibold leading-tight text-ink-900 md:text-5xl";

  return (
    <div className="flex h-full flex-col gap-8">
      <div className="glass-panel p-8">
        <p className="text-xs uppercase tracking-[0.4em] text-ink-400">{eyebrow}</p>
        <h1 className={headlineClass}>
          <span className="font-display">{title}</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-500 md:text-lg">{subtitle}</p>

        {badges.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-3">
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-ink-100/80 bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-ink-500"
              >
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {metrics.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="glass-panel p-5">
              <p className="text-sm text-ink-400">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-ink-800">{metric.value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
