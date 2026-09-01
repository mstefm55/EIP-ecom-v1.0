const configuredBaseUrl = String(import.meta.env?.VITE_EIP_API_BASE_URL || '').trim().replace(/\/$/, '');
let csrfToken = '';

export const isEipApiConfigured = () => Boolean(configuredBaseUrl);

async function parseResponse(response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `EIP request failed (${response.status})`);
    error.code = payload?.error || 'EIP_REQUEST_FAILED';
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function loadCsrf() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${configuredBaseUrl}/api/eip/auth/csrf`, {
    credentials: 'include',
    headers: { Accept: 'application/json' }
  });
  const payload = await parseResponse(response);
  csrfToken = String(payload?.csrf || '');
  return csrfToken;
}

async function request(path, options = {}) {
  if (!isEipApiConfigured()) {
    const error = new Error('EIP integration is not configured.');
    error.code = 'EIP_NOT_CONFIGURED';
    throw error;
  }
  const method = String(options.method || 'GET').toUpperCase();
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    headers['x-csrf'] = await loadCsrf();
  }
  const response = await fetch(`${configuredBaseUrl}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  if (response.status === 403 && method !== 'GET' && method !== 'HEAD') csrfToken = '';
  return parseResponse(response);
}

export const eipApiAdapter = Object.freeze({
  getCapability: () => request('/api/eip/ecom/perfect-fit/capability'),
  listProducts: (query = '') => request(`/api/eip/ecom/products?limit=100&q=${encodeURIComponent(query)}`),
  getProduct: (productId) => request(`/api/eip/ecom/products/${encodeURIComponent(productId)}`),
  getIntegration: (productId) => request(`/api/eip/ecom/products/${encodeURIComponent(productId)}/perfect-fit`),
  registerProduct: (body) => request('/api/eip/ecom/perfect-fit/products/register', { method: 'POST', body }),
  linkProduct: (productId, body) => request(`/api/eip/ecom/products/${encodeURIComponent(productId)}/perfect-fit/link`, { method: 'POST', body }),
  syncProduct: (productId, body) => request(`/api/eip/ecom/products/${encodeURIComponent(productId)}/perfect-fit/sync`, { method: 'POST', body }),
  unlinkProduct: (productId) => request(`/api/eip/ecom/products/${encodeURIComponent(productId)}/perfect-fit/link`, { method: 'DELETE' })
});
