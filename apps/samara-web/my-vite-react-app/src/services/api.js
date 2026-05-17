// src/services/api.js

import { EIP_CONFIG } from "../config/eip";

export async function callEndpoint(endpoint, options = {}) {
  const baseUrl = EIP_CONFIG.apiBaseUrl;
  const method = String(options.method || "GET").toUpperCase();
  const hasBody = options.body !== undefined;
  const isFormData =
    hasBody &&
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  const defaultHeaders = {};
  if (hasBody && !isFormData) {
    defaultHeaders["Content-Type"] = "application/json";
  }
  if (EIP_CONFIG.publicApiKey) {
    defaultHeaders[EIP_CONFIG.publicApiKeyHeader || "X-API-Key"] = EIP_CONFIG.publicApiKey;
  }

  const config = {
    headers: { ...defaultHeaders, ...options.headers },
    method,
    credentials: options.credentials || "include",
  };

  if (hasBody) {
    config.body = isFormData ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${endpoint}`, config);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

function buildEventId(prefix) {
  const base = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now()}-${base}`;
}

async function callGateway(endpoint) {
  const baseUrl = EIP_CONFIG.apiBaseUrl;
  const headers = {};
  if (EIP_CONFIG.publicApiKey) {
    headers["X-API-Key"] = EIP_CONFIG.publicApiKey;
  }
  const response = await fetch(`${baseUrl}${endpoint}`, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gateway Error (${response.status}): ${errorText}`);
  }
  return await response.json();
}

function buildPublicCommercePath(suffix, path, params) {
  const cleanSuffix = String(suffix || "").trim();
  if (!cleanSuffix) {
    throw new Error("Missing VITE_EIP_SUFFIX. Configure the tenant connection suffix.");
  }
  const query = params && Object.keys(params).length
    ? `?${new URLSearchParams(params).toString()}`
    : "";
  return `/api/public/commerce/${cleanSuffix}${path}${query}`;
}

export async function fetchCatalog({ suffix, materialType, q, limit, offset } = {}) {
  const params = {};
  if (materialType) params.material_type = materialType;
  if (q) params.q = q;
  if (limit) params.limit = String(limit);
  if (offset) params.offset = String(offset);
  return callEndpoint(buildPublicCommercePath(suffix, "/catalog", params));
}

export async function fetchCountries({ suffix } = {}) {
  return callEndpoint(buildPublicCommercePath(suffix, "/meta/countries"));
}

export async function fetchTradeConditions({ suffix, channel = "WEB", jurisdiction = "", currency = "" } = {}) {
  const params = {};
  if (channel) params.channel = channel;
  if (jurisdiction) params.jurisdiction = jurisdiction;
  if (currency) params.currency = currency;
  return callEndpoint(buildPublicCommercePath(suffix, "/meta/trade-conditions", params));
}

export async function fetchCheckoutConfig({ suffix } = {}) {
  return callEndpoint(buildPublicCommercePath(suffix, "/meta/checkout-config"));
}

export async function fetchStorefrontLocales({ suffix } = {}) {
  return callEndpoint(buildPublicCommercePath(suffix, "/meta/locales"));
}

export async function fetchStorefrontFx({ suffix } = {}) {
  return callEndpoint(buildPublicCommercePath(suffix, "/meta/fx"));
}

export async function fetchStorefrontContent({
  suffix,
  slot = "home.hero",
  activeOnly = true,
  publishedOnly = true
} = {}) {
  const params = {};
  if (slot) params.slot = slot;
  if (!activeOnly) params.active_only = "false";
  if (!publishedOnly) params.published_only = "false";
  return callEndpoint(buildPublicCommercePath(suffix, "/content", params));
}

export async function fetchStorefrontContentList({
  suffix,
  slot,
  page,
  contentModel,
  activeOnly = true,
  publishedOnly = true,
  limit = 20,
  offset = 0
} = {}) {
  const params = {};
  if (slot) params.slot = slot;
  if (page) params.page = page;
  if (contentModel) params.content_model = contentModel;
  if (!activeOnly) params.active_only = "false";
  if (!publishedOnly) params.published_only = "false";
  if (limit) params.limit = String(limit);
  if (offset) params.offset = String(offset);
  return callEndpoint(buildPublicCommercePath(suffix, "/content/list", params));
}

export async function fetchBlogPosts({ suffix, q, limit = 20, offset = 0 } = {}) {
  const params = {};
  if (q) params.q = String(q);
  if (limit) params.limit = String(limit);
  if (offset) params.offset = String(offset);
  return callEndpoint(buildPublicCommercePath(suffix, "/blog/posts", params));
}

export async function createBlogPost({ suffix, csrf, payload } = {}) {
  return callEndpoint(buildPublicCommercePath(suffix, "/blog/posts"), {
    method: "POST",
    headers: csrf ? { "X-Member-Csrf": csrf } : {},
    body: payload || {},
  });
}

export async function uploadMemberBlogAsset({ suffix, csrf, file } = {}) {
  if (!file) throw new Error("Image file required.");
  const formData = new FormData();
  formData.append("file", file);
  return callEndpoint(buildPublicCommercePath(suffix, "/member/uploads"), {
    method: "POST",
    headers: csrf ? { "X-Member-Csrf": csrf } : {},
    body: formData,
  });
}

export async function deleteBlogPost({ suffix, csrf, postId } = {}) {
  if (!postId) throw new Error("Post ID required.");
  return callEndpoint(buildPublicCommercePath(suffix, `/blog/posts/${encodeURIComponent(postId)}`), {
    method: "DELETE",
    headers: csrf ? { "X-Member-Csrf": csrf } : {},
  });
}

export async function fetchProductByCode({ suffix, code } = {}) {
  if (!code) throw new Error("Product code required.");
  return callEndpoint(buildPublicCommercePath(suffix, `/product/${code}`));
}

export async function fetchProductReviews({ suffix, code, limit, offset } = {}) {
  if (!code) throw new Error("Product code required.");
  const params = {};
  if (limit) params.limit = String(limit);
  if (offset) params.offset = String(offset);
  return callEndpoint(buildPublicCommercePath(suffix, `/product/${code}/reviews`, params));
}

export async function fetchGatewayBootstrap({ connectionCode, templateCode } = {}) {
  const params = new URLSearchParams();
  if (connectionCode) params.set("connection_code", connectionCode);
  if (templateCode) params.set("template_code", templateCode);
  const query = params.toString();
  return callGateway(`/api/public/gateway/bootstrap${query ? `?${query}` : ""}`);
}

export async function fetchGatewayManifest({ templateCode, objectId, connectionCode } = {}) {
  if (!templateCode) throw new Error("Missing template code for gateway manifest.");
  const params = new URLSearchParams();
  if (connectionCode) params.set("connection_code", connectionCode);
  const query = params.toString();
  const encodedTemplate = encodeURIComponent(templateCode);
  const encodedObject = objectId ? `/${encodeURIComponent(objectId)}` : "";
  return callGateway(`/api/public/gateway/manifest/${encodedTemplate}${encodedObject}${query ? `?${query}` : ""}`);
}

export async function createSubscriber({ suffix, payload } = {}) {
  const eventIdHeader = EIP_CONFIG.eventIdHeader || "X-Event-Id";
  return callEndpoint(buildPublicCommercePath(suffix, "/subscribe"), {
    method: "POST",
    headers: { [eventIdHeader]: buildEventId("subscribe") },
    body: payload || {},
  });
}

export async function createOrder({ suffix, payload } = {}) {
  const eventIdHeader = EIP_CONFIG.eventIdHeader || "X-Event-Id";
  return callEndpoint(buildPublicCommercePath(suffix, "/order"), {
    method: "POST",
    headers: { [eventIdHeader]: buildEventId("order") },
    body: payload || {},
  });
}

export async function createPayment({ suffix, payload } = {}) {
  const eventIdHeader = EIP_CONFIG.eventIdHeader || "X-Event-Id";
  return callEndpoint(buildPublicCommercePath(suffix, "/payment"), {
    method: "POST",
    headers: { [eventIdHeader]: buildEventId("payment") },
    body: payload || {},
  });
}

export async function createProductReview({ suffix, payload } = {}) {
  return callEndpoint(buildPublicCommercePath(suffix, "/reviews"), {
    method: "POST",
    body: payload || {},
  });
}

export async function startMemberAuth({ suffix, payload } = {}) {
  return callEndpoint(buildPublicCommercePath(suffix, "/member/auth/start"), {
    method: "POST",
    body: payload || {},
  });
}

export async function verifyMemberAuth({ suffix, payload } = {}) {
  return callEndpoint(buildPublicCommercePath(suffix, "/member/auth/verify"), {
    method: "POST",
    body: payload || {},
  });
}

export async function fetchMemberMe({ suffix } = {}) {
  return callEndpoint(buildPublicCommercePath(suffix, "/member/auth/me"));
}

export async function logoutMember({ suffix, csrf } = {}) {
  return callEndpoint(buildPublicCommercePath(suffix, "/member/auth/logout"), {
    method: "POST",
    headers: csrf ? { "X-Member-Csrf": csrf } : {},
    body: {},
  });
}

export async function updateMemberProfile({ suffix, csrf, payload } = {}) {
  return callEndpoint(buildPublicCommercePath(suffix, "/member/profile"), {
    method: "PATCH",
    headers: csrf ? { "X-Member-Csrf": csrf } : {},
    body: payload || {},
  });
}

export async function fetchMemberHistory({ suffix, limit = 20 } = {}) {
  return callEndpoint(buildPublicCommercePath(suffix, "/member/history", { limit: String(limit) }));
}

export function resolveAssetUrl(url) {
  if (!url) return "";
  const value = String(url);
  if (value.startsWith("http")) return value;
  if (value.startsWith("blob:") || value.startsWith("data:")) return value;
  const base = new URL(EIP_CONFIG.apiBaseUrl, window.location.origin).origin;
  if (value.startsWith("/")) return `${base}${value}`;
  return `${base}/${value}`;
}

export { buildEventId };
