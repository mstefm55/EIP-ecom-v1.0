function normalizeText(value) {
  return String(value || '').trim();
}

function resolveOrigin(endpoint) {
  const normalized = normalizeText(endpoint);
  if (!normalized) return '';
  try {
    return new URL(normalized, 'http://localhost').origin;
  } catch {
    return '';
  }
}

/**
 * Resolve only EIP-owned asset paths against the configured EIP origin.
 *
 * Perfect Fit remains the primary product/workspace authority. This helper is
 * read-side transport normalization only: it does not change product authority,
 * persistence, sync rules, or asset storage.
 */
export function resolveEipAssetUrl(value, endpoint) {
  const normalized = normalizeText(value);
  if (!normalized || !normalized.startsWith('/assets/')) return normalized;
  const origin = resolveOrigin(endpoint);
  return origin ? `${origin}${normalized}` : normalized;
}

/**
 * Normalize EIP read projections without touching non-EIP URLs or PF-local
 * media. Only strings beginning with the canonical EIP `/assets/` namespace
 * are rewritten.
 */
export function resolveEipAssetReferences(value, endpoint) {
  if (Array.isArray(value)) {
    return value.map((item) => resolveEipAssetReferences(item, endpoint));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveEipAssetReferences(item, endpoint)
      ])
    );
  }
  if (typeof value === 'string') {
    return resolveEipAssetUrl(value, endpoint);
  }
  return value;
}
