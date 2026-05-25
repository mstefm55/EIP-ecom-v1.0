const BASE_URL = import.meta.env?.VITE_API_BASE_URL || "http://localhost:4000";
const CSRF_ENDPOINT = "/api/eip/auth/csrf";
const CSRF_ERROR_CODES = new Set(["CSRF_MISSING", "CSRF_MISMATCH", "CSRF_INVALID"]);
const SESSION_MUTATING_PATHS = new Set([
  "/api/eip/auth/login",
  "/api/eip/auth/verify-otp",
  "/api/eip/auth/totp/login",
  "/api/eip/auth/passkeys/login/verify",
  "/api/eip/auth/password/reset",
  "/api/eip/auth/recovery/consume",
  "/api/eip/auth/logout",
]);

let cachedCsrfToken = null;
let csrfTokenPromise = null;

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

export function resetCsrfToken() {
  cachedCsrfToken = null;
  csrfTokenPromise = null;
}

export async function getCsrfToken({ refresh = false } = {}) {
  if (!refresh) {
    if (cachedCsrfToken) return cachedCsrfToken;
    if (csrfTokenPromise) return csrfTokenPromise;
  } else {
    resetCsrfToken();
  }

  csrfTokenPromise = fetch(`${BASE_URL}${CSRF_ENDPOINT}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const payload = await response.json().catch(() => null);
      const token = payload?.csrf || payload?.csrfToken || null;
      cachedCsrfToken = token;
      return token;
    })
    .catch(() => null)
    .finally(() => {
      csrfTokenPromise = null;
    });

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

    return fetch(url, {
      method,
      headers,
      credentials: "include",
      body,
    });
  };

  let response = await performRequest();

  if (!response.ok) {
    const errorText = await response.text();
    const payload = parseErrorPayload(errorText);
    if (CSRF_ERROR_CODES.has(payload?.error)) {
      response = await performRequest({ refreshCsrf: true });
      if (response.ok) {
        const data = await response.json();
        if (shouldResetCsrfAfterSuccess(path, method)) resetCsrfToken();
        return { status: response.status, headers: response.headers, data };
      }
      resetCsrfToken();
      return handleErrorResponse(response);
    }
    return handleParsedError(response, errorText, payload);
  }

  if (response.status === 304) {
    return { status: 304, headers: response.headers, data: null };
  }

  const data = await response.json();
  if (shouldResetCsrfAfterSuccess(path, method)) resetCsrfToken();
  return { status: response.status, headers: response.headers, data };
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
  throw new Error(`API ${response.status}: ${errorText}`);
}
