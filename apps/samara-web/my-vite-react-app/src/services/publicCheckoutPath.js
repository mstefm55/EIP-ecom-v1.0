export function buildSuffixAwareCheckoutPath(endpoint, path, params = {}) {
  const value = String(endpoint || "").trim();
  if (!value) throw new Error("Missing storefront endpoint.");

  const parsed = new URL(
    value,
    typeof window !== "undefined" ? window.location.origin : "http://localhost"
  );
  const marker = "/api/public/commerce/";
  const markerIndex = parsed.pathname.indexOf(marker);
  const explicitSuffix = String(params?.suffix || "").trim();
  const endpointSuffix = markerIndex >= 0
    ? decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length).split("/")[0] || "")
    : "";
  const suffix = endpointSuffix || explicitSuffix;
  if (!suffix) throw new Error("CONNECTION_SUFFIX_REQUIRED");

  const publicRoot = markerIndex >= 0
    ? parsed.pathname.slice(0, markerIndex + "/api/public".length)
    : parsed.pathname.replace(/\/+$/, "");
  const checkoutPath = String(path || "").startsWith("/") ? String(path) : `/${path}`;
  const queryParams = { ...(params || {}) };
  delete queryParams.suffix;
  const query = Object.keys(queryParams).length
    ? `?${new URLSearchParams(queryParams).toString()}`
    : "";

  return `${parsed.origin}${publicRoot}/commerce/${encodeURIComponent(suffix)}${checkoutPath}${query}`;
}
