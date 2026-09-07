function cleanUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function buildLegacyEndpoint() {
  const legacyBase = cleanUrl(
    import.meta.env.VITE_EIP_GATEWAY_BASE_URL ??
      import.meta.env.VITE_EIP_API_BASE_URL ??
      import.meta.env.VITE_API_BASE_URL
  );
  const legacySuffix = String(import.meta.env.VITE_EIP_SUFFIX || "").trim();
  if (!legacyBase || !legacySuffix) return "";
  return `${legacyBase}/api/public/commerce/${encodeURIComponent(legacySuffix)}`;
}

function buildConnectionKey(endpoint) {
  if (!endpoint) return "default";
  try {
    const parsed = new URL(endpoint, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    return `${parsed.hostname}${parsed.pathname}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "default";
  } catch {
    return String(endpoint).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "default";
  }
}

function buildGatewayBootstrapUrl(endpoint) {
  const explicit = cleanUrl(import.meta.env.VITE_EIP_GATEWAY_BOOTSTRAP_URL || "");
  if (explicit) return explicit;
  if (!endpoint) return "";
  try {
    const parsed = new URL(endpoint, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    return `${parsed.origin}/api/public/gateway/bootstrap`;
  } catch {
    return "";
  }
}

const endpoint = cleanUrl(
  import.meta.env.VITE_EIP_ENDPOINT ||
    import.meta.env.VITE_EIP_SITE_ENDPOINT ||
    buildLegacyEndpoint()
);

const apiKey =
  import.meta.env.VITE_EIP_API_KEY ||
  import.meta.env.VITE_EIP_GATEWAY_API_KEY ||
  import.meta.env.VITE_EIP_COMMERCE_VERIFICATION_KEY ||
  import.meta.env.VITE_EIP_PUBLIC_API_KEY ||
  "";

export const EIP_CONFIG = {
  endpoint,
  apiKey,
  apiKeyHeader: "X-API-Key",
  connectionCode: import.meta.env.VITE_EIP_CONNECTION_CODE || "",
  gatewayBootstrapUrl: buildGatewayBootstrapUrl(endpoint),
  connectionKey: buildConnectionKey(endpoint),
  materialType: import.meta.env.VITE_EIP_MATERIAL_TYPE || "PRODUCT",
  eventIdHeader: "X-Event-Id",
  clientSource: "perfect-fit-bureau",
  externalRefPrefix: "perfect-fit",
};
