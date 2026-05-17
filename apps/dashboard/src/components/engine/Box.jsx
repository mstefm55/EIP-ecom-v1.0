export default function Box({ node, children }) {
  const { as = "div", className = "", style, title, subtitle } = node.props || {};
  const Tag = as;
  return (
    <Tag className={className} style={style}>
      {title ? <h3 className="text-base font-semibold text-ink-900">{title}</h3> : null}
      {subtitle ? <p className="mt-1 text-sm text-ink-400">{subtitle}</p> : null}
      {children}
    </Tag>
  );
}
