import { extractProfiles } from "./connectionProfile.js";
import { hydrateConnectionProfileSecrets } from "./secretStore.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeHeaders(input) {
  if (!input || typeof input !== "object") return {};
  const headers = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    headers[String(key)] = String(value);
  }
  return headers;
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function buildUrlWithQuery(rawUrl, query) {
  if (!query || typeof query !== "object") return rawUrl;
  const url = new URL(rawUrl);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue;
        url.searchParams.append(key, String(item));
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function buildOutboundUrl(profile, endpoint) {
  const base = normalizeText(profile?.outbound?.base_url).replace(/\/$/, "");
  const prefixRaw = normalizeText(profile?.outbound?.path_prefix || "/");
  const prefix = prefixRaw.startsWith("/") ? prefixRaw : `/${prefixRaw}`;
  const endpointRaw = normalizeText(endpoint || "");
  const suffix = endpointRaw ? (endpointRaw.startsWith("/") ? endpointRaw : `/${endpointRaw}`) : "";
  return `${base}${prefix}${suffix}`.replace(/\/\/+/g, "/").replace(":/", "://");
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = options.timeout_ms || 8000;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function buildOutboundAuth(profile) {
  const outbound = profile.outbound || {};
  const headers = { ...(outbound.default_headers || {}) };
  const query = {};
  const mode = outbound.auth_mode || "none";
  const auth = outbound.auth || {};
  if (mode === "bearer_token") {
    if (!auth.token) {
      throw new Error("BEARER_TOKEN_REQUIRED");
    }
    headers.Authorization = `Bearer ${auth.token}`;
  } else if (mode === "api_key_header") {
    if (!auth.header_name || !auth.secret) {
      throw new Error("API_KEY_CONFIG_REQUIRED");
    }
    headers[auth.header_name] = auth.secret;
  } else if (mode === "api_key_query") {
    if (!auth.query_param_name || !auth.secret) {
      throw new Error("API_KEY_CONFIG_REQUIRED");
    }
    query[String(auth.query_param_name)] = String(auth.secret);
  } else if (mode === "basic") {
    if (!auth.username || !auth.password) {
      throw new Error("BASIC_AUTH_REQUIRED");
    }
    const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
    headers.Authorization = `Basic ${encoded}`;
  } else if (mode === "oauth2_client_credentials") {
    if (!auth.client_id || !auth.client_secret || !auth.token_url) {
      throw new Error("OAUTH_CLIENT_CONFIG_REQUIRED");
    }
    const params = new URLSearchParams();
    params.set("grant_type", "client_credentials");
    params.set("client_id", auth.client_id);
    params.set("client_secret", auth.client_secret);
    if (auth.scope) params.set("scope", auth.scope);
    const tokenRes = await fetchWithTimeout(auth.token_url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      timeout_ms: outbound.timeout_ms || 8000
    });
    if (!tokenRes.ok) {
      throw new Error("OAUTH_TOKEN_FAILED");
    }
    const tokenPayload = await tokenRes.json();
    if (!tokenPayload.access_token) {
      throw new Error("OAUTH_TOKEN_MISSING");
    }
    headers.Authorization = `Bearer ${tokenPayload.access_token}`;
  }
  return { headers, query };
}

async function buildOutboundHeaders(profile) {
  const auth = await buildOutboundAuth(profile);
  return auth.headers || {};
}

async function resolveOutboundProfile(client, tenantId, connectionCode) {
  const tenantRes = await client.query(
    "SELECT attrs FROM eip_core.tenant WHERE id = $1::uuid",
    [tenantId]
  );
  if (tenantRes.rowCount === 0) throw new Error("TENANT_NOT_FOUND");
  const profiles = extractProfiles(tenantRes.rows[0].attrs || {});
  const profile = profiles.find((item) => item.identity?.connection_code === connectionCode);
  if (!profile) throw new Error("CONNECTION_NOT_FOUND");
  if (!profile.identity?.is_enabled) throw new Error("CONNECTION_DISABLED");
  if (!["outbound", "both"].includes(profile.identity?.direction)) {
    throw new Error("CONNECTION_OUTBOUND_NOT_ALLOWED");
  }
  if (!normalizeText(profile.outbound?.base_url)) {
    throw new Error("OUTBOUND_NOT_CONFIGURED");
  }
  return profile;
}

async function executeGatewayOutboundRequest(client, ctx, request = {}) {
  const connectionCode = normalizeText(
    request.connection_code || request.connectionCode || request.gateway_connection_code
  );
  const endpoint = normalizeText(request.endpoint || request.path || "");
  const urlValue = normalizeText(request.url || "");
  const headersInput = normalizeHeaders(request.headers);
  const timeoutValue = normalizeNumber(request.timeout_ms);
  const query = request.query;
  let url = urlValue;
  let headers = headersInput;
  let timeoutMs = timeoutValue;
  let profile = null;

  if (!connectionCode) {
    throw new Error("GATEWAY_CONNECTION_REQUIRED");
  }

  profile = await resolveOutboundProfile(client, ctx.tenantId, connectionCode);
  profile = await hydrateConnectionProfileSecrets(ctx?.secretSource || {}, client, ctx.tenantId, profile);
  if ((endpoint && isAbsoluteUrl(endpoint)) || (urlValue && isAbsoluteUrl(urlValue))) {
    throw new Error("GATEWAY_ENDPOINT_RELATIVE_REQUIRED");
  }
  url = buildOutboundUrl(profile, endpoint || urlValue);
  const outboundAuth = await buildOutboundAuth(profile);
  const authHeaders = outboundAuth.headers || {};
  const authQuery = outboundAuth.query && typeof outboundAuth.query === "object" ? outboundAuth.query : {};
  const defaultHeaders = normalizeHeaders(profile.outbound?.default_headers);
  headers = { ...defaultHeaders, ...headers, ...authHeaders };
  if (!Number.isFinite(timeoutMs)) {
    timeoutMs = normalizeNumber(profile.outbound?.timeout_ms);
  }

  if (!url) throw new Error("HTTP_REQUEST_URL_REQUIRED");

  const requestUrl = buildUrlWithQuery(url, { ...(query || {}), ...authQuery });
  const methodRaw = normalizeText(request.method || "");
  const method = methodRaw ? methodRaw.toUpperCase() : request.body ? "POST" : "GET";

  const options = {
    method,
    headers,
    timeout_ms: Number.isFinite(timeoutMs) ? timeoutMs : 8000
  };

  const bodyValue = request.body;
  if (bodyValue !== undefined && bodyValue !== null && method !== "GET" && method !== "HEAD") {
    if (typeof bodyValue === "object") {
      options.body = JSON.stringify(bodyValue);
      if (!options.headers["Content-Type"] && !options.headers["content-type"]) {
        options.headers["Content-Type"] = "application/json";
      }
    } else {
      options.body = String(bodyValue);
    }
  }

  const response = await fetchWithTimeout(requestUrl, options);
  const text = response.status === 204 ? "" : await response.text();
  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key.toLowerCase()] = value;
  });

  return {
    ok: response.ok,
    status: response.status,
    headers: responseHeaders,
    text,
    url: requestUrl,
    method,
    connection_code: connectionCode || null,
    profile_id: profile?.id || null
  };
}

export {
  fetchWithTimeout,
  buildOutboundHeaders,
  buildOutboundAuth,
  executeGatewayOutboundRequest
};
