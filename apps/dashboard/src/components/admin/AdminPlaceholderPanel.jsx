export default function AdminPlaceholderPanel({ node }) {
  const { title = "Module", subtitle = "Module is not configured yet." } = node.props || {};
  return (
    <section className="glass-panel p-6">
      <h2 className="text-xl font-semibold text-ink-900">{title}</h2>
      <p className="mt-2 text-sm text-ink-500">{subtitle}</p>
    </section>
  );
}
