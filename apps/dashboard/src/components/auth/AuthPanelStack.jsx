export default function AuthPanelStack({ node, children }) {
  const { title, tag } = node.props || {};

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink-700">{title}</h2>
        {tag ? (
          <span className="text-xs uppercase tracking-[0.3em] text-ink-400">{tag}</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
