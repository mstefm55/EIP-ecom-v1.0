export default function UserPanel({ node, ctx, children }) {
  const tab = node.props?.tab || node.id;
  const activeTab = ctx?.user?.activeTab;
  if (tab && activeTab && tab !== activeTab) return null;
  return <div className="space-y-6">{children}</div>;
}
