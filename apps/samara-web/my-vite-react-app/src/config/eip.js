function cleanUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function firstCleanUrl(...values) {
  for (const value of values) {
    const cleaned = cleanUrl(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function isEnabled(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function buildLegacyEndpoint() {
  const legacyBase = firstCleanUrl(
    import.meta.env.VITE_EIP_GATEWAY_BASE_URL,
    import.meta.env.VITE_EIP_API_BASE_URL,
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

const publicSiteUrl = firstCleanUrl(
  import.meta.env.VITE_PUBLIC_SITE_URL,
  import.meta.env.VITE_SITE_URL,
  import.meta.env.VITE_STORE_URL,
  import.meta.env.VITE_APP_URL
);

const endpoint = firstCleanUrl(
  import.meta.env.VITE_EIP_ENDPOINT,
  import.meta.env.VITE_EIP_SITE_ENDPOINT,
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
  publicSiteUrl,
  siteUrl: publicSiteUrl,
  siteTitle: firstText(
    import.meta.env.VITE_SITE_TITLE,
    import.meta.env.VITE_PUBLIC_SITE_NAME,
    "Perfect Fit Bureau"
  ),
  apiKeyHeader: "X-API-Key",
  connectionCode: import.meta.env.VITE_EIP_CONNECTION_CODE || "",
  gatewayBootstrapUrl: buildGatewayBootstrapUrl(endpoint),
  connectionKey: buildConnectionKey(endpoint),
  materialType: import.meta.env.VITE_EIP_MATERIAL_TYPE || "PRODUCT",
  featuredTag: import.meta.env.VITE_EIP_FEATURED_TAG || "featured",
  dropTag: import.meta.env.VITE_EIP_DROP_TAG || "drop",
  worthTag: import.meta.env.VITE_EIP_WORTH_TAG || "worth",
  heroTag: import.meta.env.VITE_EIP_HERO_TAG || "hero",
  heroMaxSlides: Number(import.meta.env.VITE_EIP_HERO_MAX_SLIDES || 5),
  dropMaxCards: Number(import.meta.env.VITE_EIP_DROP_MAX_CARDS || 48),
  dropGalleryMax: Number(import.meta.env.VITE_EIP_DROP_GALLERY_MAX || 8),
  worthMaxCards: Number(import.meta.env.VITE_EIP_WORTH_MAX_CARDS || 24),
  homeCatalogLimit: Number(import.meta.env.VITE_EIP_HOME_CATALOG_LIMIT || 96),
  refreshMs: Number(import.meta.env.VITE_EIP_REFRESH_MS || 0),
  pageSize: Number(import.meta.env.VITE_EIP_PAGE_SIZE || 12),
  eventIdHeader: "X-Event-Id",
  clientSource: "web-client",
  externalRefPrefix: "web",
  lookbookUrl: import.meta.env.VITE_EIP_LOOKBOOK_URL || "",
  enableCatalogVariant: isEnabled(import.meta.env.VITE_ENABLE_CATALOG_VARIANT),
  enableCheckoutVariant: isEnabled(import.meta.env.VITE_ENABLE_CHECKOUT_VARIANT),
  dropRenderer: String(
    import.meta.env.VITE_EIP_DROP_RENDERER ||
      (String(import.meta.env.VITE_EIP_DROP_CARD_CAROUSEL_TEST || "").trim().toLowerCase() === "true"
        ? "product_carousel"
        : "")
  ).trim().toLowerCase(),
  worthRenderer: String(
    import.meta.env.VITE_EIP_WORTH_RENDERER ||
      (String(import.meta.env.VITE_EIP_WORTH_CARD_CAROUSEL_TEST || "").trim().toLowerCase() === "true"
        ? "product_carousel"
        : "")
  ).trim().toLowerCase(),
};
