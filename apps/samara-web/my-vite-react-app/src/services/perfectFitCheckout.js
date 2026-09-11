import { EIP_CONFIG } from '../config/eip';
import { buildSuffixAwareCheckoutPath } from './publicCheckoutPath';
import { normalizePerfectFitOrderPayload } from './perfectFitCheckoutIdentity';

function buildCommerceRoot() {
  if (!String(EIP_CONFIG.endpoint || '').trim()) {
    throw new Error('Perfect Fit checkout is not connected to the EIP gateway.');
  }
  return buildSuffixAwareCheckoutPath(
    EIP_CONFIG.endpoint,
    '',
    EIP_CONFIG.connectionCode
  );
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

function normalizePublicPaymentMethodsPayload(payload = {}) {
  if (!Array.isArray(payload?.methods)) return payload;

  return {
    ...payload,
    methods: payload.methods.map((item) => ({
      ...item,
      code: item?.code || item?.methodCode || item?.method || item?.id || '',
      provider_code: item?.provider_code || item?.providerCode || ''
    }))
  };
}

export async function fetchPerfectFitPaymentMethods() {
  const payload = await callCommerce('/checkout/payment-methods');
  return normalizePublicPaymentMethodsPayload(payload);
}

export function createPerfectFitOrder(payload) {
  return callCommerce('/order', {
    method: 'POST',
    body: normalizePerfectFitOrderPayload(payload),
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
