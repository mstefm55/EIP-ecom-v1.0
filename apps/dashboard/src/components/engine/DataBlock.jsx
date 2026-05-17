import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../services/apiClient";

export default function DataBlock({ node, ctx, children }) {
  const { endpoint, method = "GET", body, dataKey, pollMs } = node.props || {};
  const key = dataKey || endpoint || node.id || "data";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const requestBody = useMemo(() => body || null, [body]);

  useEffect(() => {
    if (!endpoint) return;
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFetch(endpoint, {
          method,
          body: requestBody,
        });
        if (active) {
          ctx?.data?.setData?.(key, result?.data ?? result);
        }
      } catch (err) {
        if (active) {
          setError(err);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    if (pollMs && Number.isFinite(Number(pollMs))) {
      const id = setInterval(load, Number(pollMs));
      return () => clearInterval(id);
    }

    return () => {
      active = false;
    };
  }, [endpoint, method, requestBody, pollMs, key, ctx]);

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="rounded-2xl border border-ink-200/60 bg-white/70 px-4 py-3 text-xs text-ink-400">
          Loading data...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
          {error.message || "Data fetch failed"}
        </div>
      ) : null}
      {children}
    </div>
  );
}
