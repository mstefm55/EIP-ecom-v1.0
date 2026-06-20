// src/services/api.js

import { EIP_CONFIG } from "../config/eip";

export async function callEndpoint(endpoint, options = {}) {
  const baseUrl = EIP_CONFIG.endpoint;
  if (!baseUrl) {
    throw new Error("Missing VITE_EIP_ENDPOINT. Configure the storefront endpoint from Admin > Connections.");
  }
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
  if (EIP_CONFIG.apiKey) {
    defaultHeaders[EIP_CONFIG.apiKeyHeader] = EIP_CONFIG.apiKey;
  }

  const config = {
    headers: { ...defaultHeaders, ...options.headers },
    method,
    credentials: options.credentials || "omit",
  };

  if (hasBody) {
    config.body = isFormData ? options.body : JSON.stringify(options.body);
  }

  const target = /^https?:\/\//i.test(String(endpoint || ""))
    ? endpoint
    : `${baseUrl}${endpoint}`;
  const response = await fetch(target, config);

  if (!response.ok) {
    const errorText = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(errorText);
    } catch {
      payload = null;
    }
    const message = payload?.message || payload?.error || `Request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.code = payload?.error || null;
    error.payload = payload;
    throw error;
  }

  return await response.json();
}

function buildEventId(prefix) {
  const base = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now()}-${base}`;
}

function buildPublicCommercePath(path, params) {
  if (!EIP_CONFIG.endpoint) {
    throw new Error("Missing VITE_EIP_ENDPOINT. Configure the storefront endpoint from Admin > Connections.");
  }
  const query = params && Object.keys(params).length
    ? `?${new URLSearchParams(params).toString()}`
    : "";
  return `${path}${query}`;
}

function buildPublicCheckoutPath(path, params = {}) {
  const nextParams = { ...(params || {}) };
  try {
    const parsed = new URL(EIP_CONFIG.endpoint, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const marker = "/api/public/commerce/";
    const index = parsed.pathname.indexOf(marker);
    if (index >= 0) {
      const suffix = decodeURIComponent(parsed.pathname.slice(index + marker.length).split("/")[0] || "");
      if (suffix && !nextParams.suffix) nextParams.suffix = suffix;
      const rootPath = `${parsed.pathname.slice(0, index)}/api/public`;
      const query = Object.keys(nextParams).length ? `?${new URLSearchParams(nextParams).toString()}` : "";
      return `${parsed.origin}${rootPath}${path}${query}`;
    }
  } catch {
    // Fall back to the configured commerce endpoint.
  }
  return buildPublicCommercePath(path, nextParams);
}

export async function fetchCatalog({ materialType, q, limit, offset } = {}) {
  const params = {};
  if (materialType) params.material_type = materialType;
  if (q) params.q = q;
  if (limit) params.limit = String(limit);
  if (offset) params.offset = String(offset);
  return callEndpoint(buildPublicCommercePath("/catalog", params));
}

export async function fetchCountries() {
  return callEndpoint(buildPublicCommercePath("/meta/countries"));
}

export async function fetchTradeConditions({ channel = "WEB", jurisdiction = "", currency = "" } = {}) {
  const params = {};
  if (channel) params.channel = channel;
  if (jurisdiction) params.jurisdiction = jurisdiction;
  if (currency) params.currency = currency;
  return callEndpoint(buildPublicCommercePath("/meta/trade-conditions", params));
}

export async function fetchCheckoutConfig() {
  return callEndpoint(buildPublicCommercePath("/meta/checkout-config"));
}

export async function fetchPaymentMethods() {
  return callEndpoint(buildPublicCheckoutPath("/checkout/payment-methods"));
}

export async function fetchStorefrontLocales() {
  return callEndpoint(buildPublicCommercePath("/meta/locales"));
}

export async function fetchStorefrontFx() {
  return callEndpoint(buildPublicCommercePath("/meta/fx"));
}

export async function fetchStorefrontContent({
  slot = "home.hero",
  activeOnly = true,
  publishedOnly = true
} = {}) {
  const params = {};
  if (slot) params.slot = slot;
  if (!activeOnly) params.active_only = "false";
  if (!publishedOnly) params.published_only = "false";
  return callEndpoint(buildPublicCommercePath("/content", params));
}

export async function fetchStorefrontContentList({
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
  return callEndpoint(buildPublicCommercePath("/content/list", params));
}

export async function fetchBlogPosts({ q, limit = 20, offset = 0 } = {}) {
  const params = {};
  if (q) params.q = String(q);
  if (limit) params.limit = String(limit);
  if (offset) params.offset = String(offset);
  return callEndpoint(buildPublicCommercePath("/blog/posts", params));
}

export async function createBlogPost({ csrf, payload } = {}) {
  return callEndpoint(buildPublicCommercePath("/blog/posts"), {
    method: "POST",
    headers: csrf ? { "X-Member-Csrf": csrf } : {},
    credentials: "include",
    body: payload || {},
  });
}

export async function uploadMemberBlogAsset({ csrf, file } = {}) {
  if (!file) throw new Error("Image file required.");
  const formData = new FormData();
  formData.append("file", file);
  return callEndpoint(buildPublicCommercePath("/member/uploads"), {
    method: "POST",
    headers: csrf ? { "X-Member-Csrf": csrf } : {},
    credentials: "include",
    body: formData,
  });
}

export async function deleteBlogPost({ csrf, postId } = {}) {
  if (!postId) throw new Error("Post ID required.");
  return callEndpoint(buildPublicCommercePath(`/blog/posts/${encodeURIComponent(postId)}`), {
    method: "DELETE",
    headers: csrf ? { "X-Member-Csrf": csrf } : {},
    credentials: "include",
  });
}

export async function fetchProductByCode({ code } = {}) {
  if (!code) throw new Error("Product code required.");
  return callEndpoint(buildPublicCommercePath(`/product/${code}`));
}

export async function fetchProductReviews({ code, limit, offset } = {}) {
  if (!code) throw new Error("Product code required.");
  const params = {};
  if (limit) params.limit = String(limit);
  if (offset) params.offset = String(offset);
  return callEndpoint(buildPublicCommercePath(`/product/${code}/reviews`, params));
}

export async function createSubscriber({ payload } = {}) {
  const eventIdHeader = EIP_CONFIG.eventIdHeader || "X-Event-Id";
  return callEndpoint(buildPublicCommercePath("/subscribe"), {
    method: "POST",
    headers: { [eventIdHeader]: buildEventId("subscribe") },
    body: payload || {},
  });
}

export async function createOrder({ payload } = {}) {
  const eventIdHeader = EIP_CONFIG.eventIdHeader || "X-Event-Id";
  return callEndpoint(buildPublicCommercePath("/order"), {
    method: "POST",
    headers: { [eventIdHeader]: buildEventId("order") },
    credentials: "include",
    body: payload || {},
  });
}

export async function createPayment({ payload } = {}) {
  return createCheckoutSession({ payload });
}

export async function createCheckoutSession({ payload } = {}) {
  const eventIdHeader = EIP_CONFIG.eventIdHeader || "X-Event-Id";
  return callEndpoint(buildPublicCheckoutPath("/checkout/payment-session"), {
    method: "POST",
    headers: { [eventIdHeader]: buildEventId("payment") },
    body: payload || {},
  });
}

export async function fetchCheckoutSession({ paymentId } = {}) {
  if (!paymentId) throw new Error("Payment reference required.");
  return callEndpoint(buildPublicCommercePath(`/checkout/session/${encodeURIComponent(paymentId)}`));
}

export async function confirmCheckoutSession({ payload } = {}) {
  const eventIdHeader = EIP_CONFIG.eventIdHeader || "X-Event-Id";
  return callEndpoint(buildPublicCommercePath("/checkout/confirm"), {
    method: "POST",
    headers: { [eventIdHeader]: buildEventId("payment-confirm") },
    body: payload || {},
  });
}

export async function createProductReview({ payload } = {}) {
  return callEndpoint(buildPublicCommercePath("/reviews"), {
    method: "POST",
    credentials: "include",
    body: payload || {},
  });
}

export async function startMemberAuth({ payload } = {}) {
  return callEndpoint(buildPublicCommercePath("/member/auth/start"), {
    method: "POST",
    credentials: "include",
    body: payload || {},
  });
}

export async function verifyMemberAuth({ payload } = {}) {
  return callEndpoint(buildPublicCommercePath("/member/auth/verify"), {
    method: "POST",
    credentials: "include",
    body: payload || {},
  });
}

export async function fetchMemberMe() {
  return callEndpoint(buildPublicCommercePath("/member/auth/me"), {
    credentials: "include",
  });
}

export async function logoutMember({ csrf } = {}) {
  return callEndpoint(buildPublicCommercePath("/member/auth/logout"), {
    method: "POST",
    headers: csrf ? { "X-Member-Csrf": csrf } : {},
    credentials: "include",
    body: {},
  });
}

export async function updateMemberProfile({ csrf, payload } = {}) {
  return callEndpoint(buildPublicCommercePath("/member/profile"), {
    method: "PATCH",
    headers: csrf ? { "X-Member-Csrf": csrf } : {},
    credentials: "include",
    body: payload || {},
  });
}

export async function fetchMemberHistory({ limit = 20 } = {}) {
  return callEndpoint(buildPublicCommercePath("/member/history", { limit: String(limit) }), {
    credentials: "include",
  });
}

export function resolveAssetUrl(url) {
  if (!url) return "";
  const value = String(url);
  if (value.startsWith("http")) return value;
  if (value.startsWith("blob:") || value.startsWith("data:")) return value;
  const base = new URL(EIP_CONFIG.endpoint || window.location.origin, window.location.origin).origin;
  if (value.startsWith("/")) return `${base}${value}`;
  return `${base}/${value}`;
}

export { buildEventId };
