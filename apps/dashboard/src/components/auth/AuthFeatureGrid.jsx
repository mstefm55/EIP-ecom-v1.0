export default function AuthFeatureGrid({ node }) {
  const { items = [] } = node.props || {};

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className="glass-panel p-5">
          <p className="text-base font-semibold text-ink-700">{item.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">{item.desc}</p>
        </div>
      ))}
    </div>
  );
}
