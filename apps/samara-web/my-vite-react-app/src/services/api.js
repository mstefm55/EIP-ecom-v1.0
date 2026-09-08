import { buildSuffixAwareCheckoutPath } from './publicCheckoutPath';
import {
  cancelPerfectFitPaymentSession,
  confirmPerfectFitPaymentSession,
  createPerfectFitOrder,
  createPerfectFitPaymentSession,
  fetchPerfectFitMemberHistory,
  fetchPerfectFitPaymentMethods,
  fetchPerfectFitPaymentSession
} from './perfectFitCheckout';

/**
 * Compatibility facade for older PF integration consumers and regression
 * coverage. Network authority remains `perfectFitCheckout`; this module does
 * not implement a second transport or persistence path.
 */
export { buildSuffixAwareCheckoutPath };

export const PERFECT_FIT_CHECKOUT_PATHS = Object.freeze({
  paymentMethods: '/checkout/payment-methods',
  paymentSession: '/checkout/payment-session',
  paymentConfirm: '/checkout/confirm'
});

export const fetchPaymentMethods = fetchPerfectFitPaymentMethods;
export const createOrder = createPerfectFitOrder;
export const createPaymentSession = createPerfectFitPaymentSession;
export const fetchPaymentSession = fetchPerfectFitPaymentSession;
export const confirmPaymentSession = confirmPerfectFitPaymentSession;
export const cancelPaymentSession = cancelPerfectFitPaymentSession;
export const fetchMemberHistory = fetchPerfectFitMemberHistory;

export function resolveApiErrorMessage(payload, fallback = 'Request failed.') {
  return payload?.message || payload?.error || fallback;
}
