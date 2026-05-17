const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function apiFetch(path, options = {}) {
  const { data } = await apiFetchWithMeta(path, options);
  return data;
}

export async function apiFetchWithMeta(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const method = options.method || "GET";
  const headers = {
    ...(options.headers || {}),
  };
  const hasBody = options.body !== undefined;
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  if (method !== "GET" && method !== "HEAD") {
    const csrf = readCookie("csrf");
    if (csrf) {
      headers["x-csrf"] = csrf;
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    credentials: "include",
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 304) {
    return { status: 304, headers: response.headers, data: null };
  }

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const payload = JSON.parse(errorText);
      if (payload?.error === "STEP_UP_REQUIRED") {
        window.dispatchEvent(
          new CustomEvent("eip-step-up-required", { detail: payload })
        );
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(`API ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return { status: response.status, headers: response.headers, data };
}
