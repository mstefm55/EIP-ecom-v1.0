const BASE_URL = import.meta.env?.VITE_API_BASE_URL || "http://localhost:4000";
const CSRF_ENDPOINT = "/api/eip/auth/csrf";
const CSRF_ERROR_CODES = new Set(["CSRF_MISSING", "CSRF_MISMATCH", "CSRF_INVALID"]);
const DEFAULT_CSRF_TIMEOUT_MS = 15000;
const SESSION_MUTATING_PATHS = new Set([
  "/api/eip/auth/login",
  "/api/eip/auth/verify-otp",
  "/api/eip/auth/totp/login",
  "/api/eip/auth/passkeys/login/verify",
  "/api/eip/auth/password/reset",
  "/api/eip/auth/recovery/consume",
  "/api/eip/bootstrap/consume",
  "/api/eip/bootstrap/complete",
  "/api/eip/auth/logout",
]);

let cachedCsrfToken = null;
let csrfTokenPromise = null;

function normalizeTimeoutMs(value) {
  const timeoutMs = Number(value);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.round(timeoutMs) : 0;
}

function createTimeoutController(timeoutMs, externalSignal) {
  const normalizedTimeoutMs = normalizeTimeoutMs(timeoutMs);
  if (!normalizedTimeoutMs && !externalSignal) {
    return {
      signal: undefined,
      timedOut: false,
      cleanup: () => {},
    };
  }

  const controller = new AbortController();
  const state = {
    signal: controller.signal,
    timedOut: false,
    cleanup: () => {},
  };

  const abortFromExternalSignal = () => {
    if (!controller.signal.aborted) controller.abort(externalSignal?.reason);
  };
  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromExternalSignal();
    } else {
      externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }
  }

  const timer = normalizedTimeoutMs
    ? globalThis.setTimeout(() => {
        state.timedOut = true;
        if (!controller.signal.aborted) controller.abort();
      }, normalizedTimeoutMs)
    : null;

  state.cleanup = () => {
    if (timer) globalThis.clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", abortFromExternalSignal);
    }
  };

  return state;
}

function createRequestTimeoutError(path, timeoutMs) {
  const seconds = Math.max(1, Math.round((Number(timeoutMs) || 0) / 1000));
  const error = new Error(`API request timed out after ${seconds}s: ${path}`);
  error.status = 408;
  error.code = "REQUEST_TIMEOUT";
  error.payload = {
    ok: false,
    error: "REQUEST_TIMEOUT",
    message: `The request took longer than ${seconds}s and was stopped. Please try again.`,
  };
  error.userMessage = error.payload.message;
  return error;
}

function createNetworkRequestError(path, cause) {
  const error = new Error(`API request failed: ${path}`);
  error.status = 0;
  error.code = "NETWORK_REQUEST_FAILED";
  error.payload = {
    ok: false,
    error: "NETWORK_REQUEST_FAILED",
    message: "The request could not complete. Check your connection and try again.",
  };
  error.userMessage = error.payload.message;
  error.cause = cause;
  return error;
}

function normalizeRequestFailure(error, timeoutState, path, timeoutMs) {
  if (timeoutState?.timedOut) return createRequestTimeoutError(path, timeoutMs);
  if (error?.payload || error?.status || error?.code) return error;
  return createNetworkRequestError(path, error);
}

function isFormDataBody(body) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function normalizeHeaders(headers = {}) {
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  return { ...headers };
}

function parseErrorPayload(errorText) {
  try {
    return JSON.parse(errorText);
  } catch {
    return null;
  }
}

function shouldResetCsrfAfterSuccess(path, method) {
  if (method === "GET" || method === "HEAD") return false;
  return SESSION_MUTATING_PATHS.has(path);
}

function extractCsrfFromPayload(payload) {
  const token = payload?.csrf || payload?.csrfToken || payload?.csrf_token || null;
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

function cacheCsrfFromPayload(payload) {
  const token = extractCsrfFromPayload(payload);
  if (!token) return false;
  cachedCsrfToken = token;
  return true;
}

function handleSuccessfulResponseSideEffects(path, method, data) {
  const hasPayloadToken = cacheCsrfFromPayload(data);
  if (shouldResetCsrfAfterSuccess(path, method) && !hasPayloadToken) {
    resetCsrfToken();
  }
}

function readCookie(name) {
  if (typeof document === "undefined") return null;
  const parts = String(document.cookie || "").split(";");
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function readCsrfCookie() {
  return readCookie("csrf") || readCookie("__Host-csrf") || null;
}

export function resetCsrfToken() {
  cachedCsrfToken = null;
  csrfTokenPromise = null;
}

export async function getCsrfToken({ refresh = false } = {}) {
  if (!refresh) {
    if (cachedCsrfToken) return cachedCsrfToken;
    const cookieToken = readCsrfCookie();
    if (cookieToken) {
      cachedCsrfToken = cookieToken;
      return cookieToken;
    }
    if (csrfTokenPromise) return csrfTokenPromise;
  } else {
    resetCsrfToken();
    const cookieToken = readCsrfCookie();
    if (cookieToken) {
      cachedCsrfToken = cookieToken;
      return cookieToken;
    }
  }

  csrfTokenPromise = (async () => {
    const timeout = createTimeoutController(DEFAULT_CSRF_TIMEOUT_MS);
    try {
      const response = await fetch(`${BASE_URL}${CSRF_ENDPOINT}`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: timeout.signal,
      });
      if (!response.ok) return readCsrfCookie();
      const payload = await response.json().catch(() => null);
      const token = extractCsrfFromPayload(payload) || readCsrfCookie() || null;
      cachedCsrfToken = token;
      return token;
    } catch {
      return readCsrfCookie();
    } finally {
      timeout.cleanup();
      csrfTokenPromise = null;
    }
  })();

  return csrfTokenPromise;
}

export async function apiFetch(path, options = {}) {
  const { data } = await apiFetchWithMeta(path, options);
  return data;
}

export async function apiFetchWithMeta(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const method = options.method || "GET";
  const hasBody = options.body !== undefined;
  const isFormData = isFormDataBody(options.body);
  const body = hasBody ? (isFormData ? options.body : JSON.stringify(options.body)) : undefined;
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);

  const performRequest = async ({ refreshCsrf = false } = {}) => {
    const headers = normalizeHeaders(options.headers);
    if (hasBody && !isFormData && !headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (method !== "GET" && method !== "HEAD") {
      const csrf = await getCsrfToken({ refresh: refreshCsrf });
      if (csrf) {
        headers["x-csrf"] = csrf;
      }
    }

    const timeout = createTimeoutController(timeoutMs, options.signal);
    try {
      const response = await fetch(url, {
        method,
        headers,
        credentials: "include",
        body,
        signal: timeout.signal,
      });
      return { response, timeout };
    } catch (error) {
      timeout.cleanup();
      throw normalizeRequestFailure(error, timeout, path, timeoutMs);
    }
  };

  let attempt = null;
  try {
    attempt = await performRequest();
    let response = attempt.response;

    if (!response.ok) {
      const errorText = await response.text();
      const payload = parseErrorPayload(errorText);
      if (CSRF_ERROR_CODES.has(payload?.error)) {
        attempt.timeout.cleanup();
        attempt = await performRequest({ refreshCsrf: true });
        response = attempt.response;
        if (response.ok) {
          const data = await parseSuccessPayload(response);
          handleSuccessfulResponseSideEffects(path, method, data);
          return { status: response.status, headers: response.headers, data };
        }
        resetCsrfToken();
        return handleErrorResponse(response);
      }
      return handleParsedError(response, errorText, payload);
    }

    const data = await parseSuccessPayload(response);
    handleSuccessfulResponseSideEffects(path, method, data);
    return { status: response.status, headers: response.headers, data };
  } catch (error) {
    throw normalizeRequestFailure(error, attempt?.timeout, path, timeoutMs);
  } finally {
    attempt?.timeout?.cleanup();
  }
}

async function parseSuccessPayload(response) {
  if (response.status === 204 || response.status === 205) return { ok: true };
  const text = await response.text();
  if (!text) return { ok: true };
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function handleErrorResponse(response) {
  const errorText = await response.text();
  return handleParsedError(response, errorText, parseErrorPayload(errorText));
}

function handleParsedError(response, errorText, payload) {
  if (payload?.error === "STEP_UP_REQUIRED") {
    window.dispatchEvent(
      new CustomEvent("eip-step-up-required", { detail: payload })
    );
  }
  if (response.status === 401) {
    resetCsrfToken();
  }
  const error = new Error(`API ${response.status}: ${errorText}`);
  error.status = response.status;
  error.code = payload?.error || null;
  error.payload = payload;
  error.userMessage = typeof payload?.message === "string" ? payload.message : "";
  throw error;
}
