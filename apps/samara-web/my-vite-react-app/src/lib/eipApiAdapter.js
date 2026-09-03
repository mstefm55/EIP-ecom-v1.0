const env = import.meta.env || {};
const canonicalEndpoint = String(env.VITE_EIP_ENDPOINT || '').trim().replace(/\/+$/, '');
const legacyDevelopmentEndpoint = env.DEV && env.VITE_EIP_API_BASE_URL && env.VITE_EIP_SUFFIX
  ? `${String(env.VITE_EIP_API_BASE_URL).trim().replace(/\/+$/, '')}/api/public/commerce/${encodeURIComponent(String(env.VITE_EIP_SUFFIX).trim())}`
  : '';
const configuredEndpoint = canonicalEndpoint || legacyDevelopmentEndpoint;
const connectionApiKey = String(env.VITE_EIP_API_KEY || '').trim();
let memberCsrfToken = '';

export const isEipApiConfigured = () => Boolean(configuredEndpoint && connectionApiKey);

function rememberMemberCsrf(payload) {
  if (payload?.csrf_token) memberCsrfToken = String(payload.csrf_token);
  if (payload?.authenticated === false) memberCsrfToken = '';
  return payload;
}

async function parseResponse(response) {
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `EIP request failed (${response.status})`);
    error.code = payload?.error || 'EIP_REQUEST_FAILED';
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return rememberMemberCsrf(payload);
}

async function refreshMemberSession() {
  const response = await fetch(`${configuredEndpoint}/member/auth/me`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'X-API-Key': connectionApiKey
    }
  });
  return parseResponse(response);
}

async function request(path, options = {}) {
  if (!isEipApiConfigured()) {
    const error = new Error('EIP integration is not configured.');
    error.code = 'EIP_NOT_CONFIGURED';
    throw error;
  }
  const method = String(options.method || 'GET').toUpperCase();
  const isWrite = method !== 'GET' && method !== 'HEAD';
  const headers = {
    Accept: 'application/json',
    'X-API-Key': connectionApiKey,
    ...(options.headers || {})
  };
  if (isWrite) {
    headers['Content-Type'] = 'application/json';
    if (options.memberCsrf !== false) {
      if (!memberCsrfToken) await refreshMemberSession();
      if (memberCsrfToken) headers['X-Member-Csrf'] = memberCsrfToken;
    }
    if (options.idempotent === true) {
      headers['X-Event-Id'] = crypto.randomUUID();
    }
  }
  const response = await fetch(`${configuredEndpoint}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  if (response.status === 401) memberCsrfToken = '';
  return parseResponse(response);
}

export const eipMemberAuth = Object.freeze({
  start: ({ credential, password, mode = 'signin', email, name, username, role } = {}) => request('/member/auth/start', {
    method: 'POST',
    memberCsrf: false,
    body: {
      credential,
      password,
      mode,
      email,
      name,
      username,
      metadata: { username, requested_role: role }
    }
  }),
  verify: ({ challengeId, token } = {}) => request('/member/auth/verify', {
    method: 'POST',
    memberCsrf: false,
    body: { challenge_id: challengeId, token }
  }),
  me: () => refreshMemberSession(),
  logout: async () => {
    const result = await request('/member/auth/logout', { method: 'POST' });
    memberCsrfToken = '';
    return result;
  }
});

export const eipApiAdapter = Object.freeze({
  getCapability: () => request('/perfect-fit/capability'),
  listProducts: (query = '') => request(`/perfect-fit/products?limit=100&q=${encodeURIComponent(query)}`),
  getProduct: (productId) => request(`/perfect-fit/products/${encodeURIComponent(productId)}`),
  getIntegration: (productId) => request(`/perfect-fit/products/${encodeURIComponent(productId)}/link`),
  registerProduct: (body) => request('/perfect-fit/products/register', { method: 'POST', body, idempotent: true }),
  linkProduct: (productId, body) => request(`/perfect-fit/products/${encodeURIComponent(productId)}/link`, { method: 'POST', body, idempotent: true }),
  syncProduct: (productId, body) => request(`/perfect-fit/products/${encodeURIComponent(productId)}/sync`, { method: 'POST', body, idempotent: true }),
  unlinkProduct: (productId) => request(`/perfect-fit/products/${encodeURIComponent(productId)}/link`, { method: 'DELETE', idempotent: true })
});
