export default function Fallback({ node }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      Missing component for type: <strong>{node?.type || "unknown"}</strong>
    </div>
  );
}
