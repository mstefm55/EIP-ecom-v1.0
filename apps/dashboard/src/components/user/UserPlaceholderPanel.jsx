export default function UserPlaceholderPanel({ node }) {
  const title = node?.props?.title || "Workspace panel";
  const subtitle = node?.props?.subtitle || "Content will appear here once enabled.";
  return (
    <section className="glass-panel p-6">
      <h2 className="text-xl font-semibold text-ink-900">{title}</h2>
      <p className="mt-2 text-sm text-ink-500">{subtitle}</p>
    </section>
  );
}
