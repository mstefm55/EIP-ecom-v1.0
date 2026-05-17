import { useEffect, useState } from "react";
import { apiFetchWithMeta } from "../services/apiClient";

const surfaceCache = new Map();

export function useSurfaceLoader(code, fallbackSurface) {
  const [surface, setSurface] = useState(fallbackSurface);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!code) return;
      setLoading(true);
      setError(null);
      try {
        const endpointBase = code === "auth"
          ? `/api/public/ui/surfaces/${code}`
          : `/api/eip/ui/surfaces/${code}`;
        const search = new URLSearchParams(window.location.search);
        const tenantId = search.get("tenant_id");
        const tenantCode = search.get("tenant_code") || search.get("tenant");
        const query = new URLSearchParams();
        if (code === "auth") {
          if (tenantId) query.set("tenant_id", tenantId);
          if (tenantCode) query.set("tenant_code", tenantCode);
        }
        const endpoint = query.toString()
          ? `${endpointBase}?${query.toString()}`
          : endpointBase;
        const cacheKey = endpoint;
        const cached = surfaceCache.get(cacheKey);
        if (cached?.surface?.tree) {
          setSurface(cached.surface);
        }

        const headers = cached?.etag ? { "If-None-Match": cached.etag } : {};
        const result = await apiFetchWithMeta(endpoint, { headers });

        if (result.status === 304 && cached?.surface) {
          return;
        }

        const payload = result?.data?.surface || result?.data;
        if (payload?.tree) {
          const etag = result.headers?.get?.("etag");
          surfaceCache.set(cacheKey, { surface: payload, etag });
          if (active) setSurface(payload);
        }
      } catch (err) {
        if (active) {
          setError(err);
          if (fallbackSurface) setSurface(fallbackSurface);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [code, fallbackSurface]);

  return { surface, loading, error };
}
