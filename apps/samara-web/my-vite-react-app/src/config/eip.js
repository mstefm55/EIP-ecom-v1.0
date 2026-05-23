const rawApiBaseUrl = import.meta.env.VITE_EIP_API_BASE_URL;
const fallbackApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export const EIP_CONFIG = {
  apiBaseUrl:
    rawApiBaseUrl !== undefined
      ? rawApiBaseUrl
      : fallbackApiBaseUrl ?? "http://localhost:4000",
  suffix: import.meta.env.VITE_EIP_SUFFIX || "samara",
  connectionCode: import.meta.env.VITE_EIP_CONNECTION_CODE || "samara",
  templateCode: import.meta.env.VITE_EIP_TEMPLATE_CODE || "",
  manifestObjectId: import.meta.env.VITE_EIP_MANIFEST_OBJECT_ID || "",
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
  publicApiKey: import.meta.env.VITE_EIP_PUBLIC_API_KEY || "",
  publicApiKeyHeader: import.meta.env.VITE_EIP_PUBLIC_API_KEY_HEADER || "X-API-Key",
  eventIdHeader: import.meta.env.VITE_EIP_EVENT_ID_HEADER || "X-Event-Id",
  clientSource: import.meta.env.VITE_EIP_CLIENT_SOURCE || "web-client",
  externalRefPrefix: import.meta.env.VITE_EIP_EXTERNAL_REF_PREFIX || "web",
  lookbookUrl: import.meta.env.VITE_EIP_LOOKBOOK_URL || "",
  dropCardCarouselTest: String(import.meta.env.VITE_EIP_DROP_CARD_CAROUSEL_TEST || "")
    .trim()
    .toLowerCase() === "true",
  worthCardCarouselTest: String(import.meta.env.VITE_EIP_WORTH_CARD_CAROUSEL_TEST || "")
    .trim()
    .toLowerCase() === "true",
};
