export default function Text({ node, children }) {
  const { as = "p", className = "", text } = node.props || {};
  const Tag = as;
  return <Tag className={className}>{text ?? children}</Tag>;
}
