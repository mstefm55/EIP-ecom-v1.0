import { ShieldAlert } from "lucide-react";

export default function AuthSecurityNote({ node }) {
  const { title, points = [] } = node.props || {};

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-brand-700" />
        <h4 className="text-base font-semibold text-ink-700">{title}</h4>
      </div>
      <ul className="mt-3 space-y-2 text-sm text-ink-500">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-500" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
