function cleanUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function cleanRequestPath(value) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === '/') return '';
  return `/${normalized.replace(/^\/+/, '')}`;
}

/**
 * Build a Perfect Fit public-commerce path from the configured EIP endpoint.
 *
 * The connection suffix is resolved from the canonical endpoint when present;
 * the explicit connection code is only used for legacy development endpoint
 * shapes. Tenant identity remains gateway/connection-derived on the server.
 */
export function buildSuffixAwareCheckoutPath(endpoint, requestPath = '', connectionCode = '') {
  const normalizedEndpoint = cleanUrl(endpoint);
  if (!normalizedEndpoint) throw new Error('EIP_ENDPOINT_REQUIRED');

  const parsed = new URL(
    normalizedEndpoint,
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  );
  const marker = '/api/public/commerce/';
  const markerIndex = parsed.pathname.indexOf(marker);
  let root;

  if (markerIndex >= 0) {
    const suffix = decodeURIComponent(
      parsed.pathname.slice(markerIndex + marker.length).split('/')[0] || ''
    );
    if (!suffix) throw new Error('CONNECTION_SUFFIX_REQUIRED');
    const prefix = parsed.pathname.slice(0, markerIndex);
    root = `${parsed.origin}${prefix}${marker}${encodeURIComponent(suffix)}`;
  } else {
    const suffix = String(connectionCode || '').trim();
    if (!suffix) throw new Error('CONNECTION_SUFFIX_REQUIRED');
    const publicIndex = parsed.pathname.indexOf('/api/public');
    const prefix = publicIndex >= 0
      ? parsed.pathname.slice(0, publicIndex)
      : parsed.pathname.replace(/\/+$/, '');
    root = `${parsed.origin}${prefix}/api/public/commerce/${encodeURIComponent(suffix)}`;
  }

  return `${root}${cleanRequestPath(requestPath)}`;
}
