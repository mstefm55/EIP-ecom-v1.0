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

async function loadPerfectFitContext() {
  const response = await fetch(`${configuredEndpoint}/member/auth/pf-context`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'X-API-Key': connectionApiKey
    }
  });
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function enrichPerfectFitMember(payload) {
  if (!payload?.member) return payload;
  try {
    const context = await loadPerfectFitContext();
    if (context?.pf_role === 'administrator') {
      const currentCode = String(payload.member.member_code || 'MEMBER');
      payload.member = {
        ...payload.member,
        member_code: currentCode.startsWith('PFADMIN:') ? currentCode : `PFADMIN:${currentCode}`,
        pf_role: 'administrator'
      };
    }
  } catch {
    // Member authentication remains usable even if PF context enrichment is unavailable.
  }
  return payload;
}

async function refreshMemberSession() {
  const response = await fetch(`${configuredEndpoint}/member/auth/me`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'X-API-Key': connectionApiKey
    }
  });
  const payload = await parseResponse(response);
  return enrichPerfectFitMember(payload);
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
  start: async ({ credential, password, mode = 'signin', email, name, username, role } = {}) => {
    const payload = await request('/member/auth/start', {
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
    });
    return enrichPerfectFitMember(payload);
  },
  verify: async ({ challengeId, token } = {}) => {
    const payload = await request('/member/auth/verify', {
      method: 'POST',
      memberCsrf: false,
      body: { challenge_id: challengeId, token }
    });
    return enrichPerfectFitMember(payload);
  },
  me: () => refreshMemberSession(),
  forgotPassword: ({ email } = {}) => request('/member/auth/password/forgot', {
    method: 'POST',
    memberCsrf: false,
    body: { email }
  }),
  resetPassword: ({ token, password } = {}) => request('/member/auth/password/reset', {
    method: 'POST',
    memberCsrf: false,
    body: { token, password }
  }),
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
