import { EIP_CONFIG } from '../config/eip';

function cleanUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function buildCommerceRoot() {
  const endpoint = cleanUrl(EIP_CONFIG.endpoint);
  if (!endpoint) {
    throw new Error('Perfect Fit checkout is not connected to the EIP gateway.');
  }

  const parsed = new URL(
    endpoint,
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  );
  const marker = '/api/public/commerce/';
  const markerIndex = parsed.pathname.indexOf(marker);

  if (markerIndex >= 0) {
    const suffix = decodeURIComponent(
      parsed.pathname.slice(markerIndex + marker.length).split('/')[0] || ''
    );
    if (!suffix) throw new Error('CONNECTION_SUFFIX_REQUIRED');
    const prefix = parsed.pathname.slice(0, markerIndex);
    return `${parsed.origin}${prefix}${marker}${encodeURIComponent(suffix)}`;
  }

  const suffix = String(EIP_CONFIG.connectionCode || '').trim();
  if (!suffix) throw new Error('CONNECTION_SUFFIX_REQUIRED');

  const publicIndex = parsed.pathname.indexOf('/api/public');
  const prefix = publicIndex >= 0
    ? parsed.pathname.slice(0, publicIndex)
    : parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${prefix}/api/public/commerce/${encodeURIComponent(suffix)}`;
}

function eventId(prefix) {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now()}-${random}`;
}

async function callCommerce(path, {
  method = 'GET',
  body,
  idempotencyPrefix,
  credentials = 'include'
} = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (EIP_CONFIG.apiKey) {
    headers[EIP_CONFIG.apiKeyHeader || 'X-API-Key'] = EIP_CONFIG.apiKey;
  }
  if (idempotencyPrefix) {
    headers[EIP_CONFIG.eventIdHeader || 'X-Event-Id'] = eventId(idempotencyPrefix);
  }

  const response = await fetch(`${buildCommerceRoot()}${path}`, {
    method,
    credentials,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.message || payload?.error || `Checkout request failed (${response.status}).`
    );
    error.status = response.status;
    error.code = payload?.error || null;
    error.payload = payload;
    throw error;
  }

  return payload || {};
}

export function fetchPerfectFitPaymentMethods() {
  return callCommerce('/checkout/payment-methods');
}

export function createPerfectFitOrder(payload) {
  return callCommerce('/order', {
    method: 'POST',
    body: payload,
    idempotencyPrefix: 'perfect-fit-order'
  });
}

export function createPerfectFitPaymentSession(payload) {
  return callCommerce('/checkout/payment-session', {
    method: 'POST',
    body: payload,
    idempotencyPrefix: 'perfect-fit-payment'
  });
}

export function fetchPerfectFitPaymentSession(paymentRef) {
  const ref = String(paymentRef || '').trim();
  if (!ref) throw new Error('PAYMENT_REFERENCE_REQUIRED');
  return callCommerce(`/checkout/payment-session/${encodeURIComponent(ref)}`);
}

export function confirmPerfectFitPaymentSession(payload) {
  return callCommerce('/checkout/confirm', {
    method: 'POST',
    body: payload,
    idempotencyPrefix: 'perfect-fit-payment-confirm'
  });
}

export function cancelPerfectFitPaymentSession(paymentRef, payload = {}) {
  const ref = String(paymentRef || '').trim();
  if (!ref) throw new Error('PAYMENT_REFERENCE_REQUIRED');
  return callCommerce(`/checkout/payment-session/${encodeURIComponent(ref)}/cancel`, {
    method: 'POST',
    body: payload,
    idempotencyPrefix: 'perfect-fit-payment-cancel'
  });
}

export function fetchPerfectFitMemberHistory(limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  return callCommerce(`/member/history?limit=${safeLimit}`);
}
