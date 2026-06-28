import { extractProfiles } from "./connectionProfile.js";
import { hydrateConnectionProfileSecrets } from "./secretStore.js";
import dns from "node:dns/promises";
import net from "node:net";

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

function isSandboxProfile(profile) {
  return normalizeText(profile?.identity?.environment).toLowerCase() === "sandbox";
}

function stripIpv6Brackets(value) {
  return String(value || "").replace(/^\[/, "").replace(/\]$/, "");
}

function parseIpv4(value) {
  const parts = String(value || "").split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map((part) => Number(part));
  if (bytes.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return bytes;
}

function isForbiddenIpv4(address) {
  const bytes = parseIpv4(address);
  if (!bytes) return false;
  const [a, b] = bytes;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function firstHextet(address) {
  const first = String(address || "").toLowerCase().split(":")[0];
  const value = Number.parseInt(first || "0", 16);
  return Number.isFinite(value) ? value : 0;
}

function isForbiddenIpv6(address) {
  const lower = String(address || "").toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isForbiddenIpv4(mapped[1]);
  if (lower === "::" || lower === "::1") return true;
  const first = firstHextet(lower);
  if (first >= 0xfc00 && first <= 0xfdff) return true;
  if (first >= 0xfe80 && first <= 0xfebf) return true;
  return false;
}

function isForbiddenAddress(address) {
  const normalized = stripIpv6Brackets(address);
  const family = net.isIP(normalized);
  if (family === 4) return isForbiddenIpv4(normalized);
  if (family === 6) return isForbiddenIpv6(normalized);
  return false;
}

function isInternalHostname(hostname) {
  const host = normalizeText(hostname).toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa") ||
    host === "metadata.google.internal"
  );
}

function insecureHttpAllowed(profile) {
  return isSandboxProfile(profile) && profile?.outbound?.allow_insecure_http === true;
}

async function assertOutboundUrlAllowed(rawUrl, profile, opts = {}) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("OUTBOUND_URL_INVALID");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("OUTBOUND_SCHEME_FORBIDDEN");
  }
  if (parsed.username || parsed.password) {
    throw new Error("OUTBOUND_URL_CREDENTIALS_FORBIDDEN");
  }
  if (parsed.protocol !== "https:" && !insecureHttpAllowed(profile)) {
    throw new Error("OUTBOUND_HTTPS_REQUIRED");
  }

  const hostname = stripIpv6Brackets(parsed.hostname);
  if (isInternalHostname(hostname)) {
    throw new Error("OUTBOUND_TARGET_HOST_FORBIDDEN");
  }

  if (net.isIP(hostname)) {
    if (isForbiddenAddress(hostname)) {
      throw new Error("OUTBOUND_TARGET_IP_FORBIDDEN");
    }
    return { ok: true, url: parsed.toString(), addresses: [hostname], purpose: opts.purpose || "request" };
  }

  let records;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("OUTBOUND_DNS_LOOKUP_FAILED");
  }
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("OUTBOUND_DNS_LOOKUP_FAILED");
  }
  const forbidden = records.find((record) => isForbiddenAddress(record.address));
  if (forbidden) {
    throw new Error("OUTBOUND_TARGET_IP_FORBIDDEN");
  }
  return {
    ok: true,
    url: parsed.toString(),
    addresses: records.map((record) => record.address),
    purpose: opts.purpose || "request"
  };
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

function oauthClientAuthenticationMethod(profile, auth = profile?.outbound?.auth || {}) {
  const configured = normalizeText(auth.client_auth_method).toLowerCase();
  if (["basic", "body"].includes(configured)) return configured;
  const providerCode = normalizeText(
    profile?.routing?.provider_code ||
    profile?.routing?.protocol ||
    profile?.identity?.connection_kind
  ).toLowerCase().replace(/[-.\s]+/g, "_");
  return providerCode === "paypal" ? "basic" : "body";
}

function buildOAuthClientCredentialsRequest(profile) {
  const outbound = profile?.outbound || {};
  const auth = outbound.auth || {};
  if (!auth.client_id || !auth.client_secret || !auth.token_url) {
    throw new Error("OAUTH_CLIENT_CONFIG_REQUIRED");
  }
  const method = oauthClientAuthenticationMethod(profile, auth);
  const params = new URLSearchParams();
  params.set("grant_type", "client_credentials");
  if (auth.scope) params.set("scope", auth.scope);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded"
  };
  if (method === "basic") {
    headers.Authorization = `Basic ${Buffer.from(`${auth.client_id}:${auth.client_secret}`).toString("base64")}`;
  } else {
    params.set("client_id", auth.client_id);
    params.set("client_secret", auth.client_secret);
  }
  return {
    url: auth.token_url,
    client_auth_method: method,
    options: {
      method: "POST",
      headers,
      body: params.toString(),
      timeout_ms: outbound.timeout_ms || 8000
    }
  };
}

async function fetchWithTimeout(url, options = {}) {
  const { timeout_ms: timeoutOption, signal: externalSignal, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = Math.max(1, Number(timeoutOption) || 8000);
  let timer = null;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (timer) clearTimeout(timer);
    externalSignal?.removeEventListener?.("abort", abortFromExternal);
  };
  const abortFromExternal = () => {
    if (!controller.signal.aborted) controller.abort(externalSignal?.reason);
    cleanup();
  };
  timer = setTimeout(() => {
    if (!controller.signal.aborted) controller.abort();
    cleanup();
  }, timeout);
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener?.("abort", abortFromExternal, { once: true });
  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    if (!response.body) {
      cleanup();
      return response;
    }
    for (const method of ["arrayBuffer", "blob", "formData", "json", "text"]) {
      const consume = response[method]?.bind(response);
      if (!consume) continue;
      Object.defineProperty(response, method, {
        configurable: true,
        value: async (...args) => {
          try {
            return await consume(...args);
          } finally {
            cleanup();
          }
        }
      });
    }
    return response;
  } catch (error) {
    cleanup();
    throw error;
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
    const tokenRequest = buildOAuthClientCredentialsRequest(profile);
    await assertOutboundUrlAllowed(tokenRequest.url, profile, { purpose: "oauth_token" });
    const tokenRes = await fetchWithTimeout(tokenRequest.url, tokenRequest.options);
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
  await assertOutboundUrlAllowed(requestUrl, profile, { purpose: "gateway_outbound" });
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
  buildOAuthClientCredentialsRequest,
  buildOutboundHeaders,
  buildOutboundAuth,
  executeGatewayOutboundRequest,
  assertOutboundUrlAllowed,
  isForbiddenAddress
};
