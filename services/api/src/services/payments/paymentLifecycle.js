const VERIFIED_PAID_STATUSES = new Set([
  "paid",
  "partially_refunded",
  "refund_pending",
  "refund_failed",
  "refunded"
]);

const FINAL_PAYMENT_STATUSES = new Set([
  "paid",
  "failed",
  "cancelled",
  "partially_refunded",
  "refunded",
  "refund_failed"
]);

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeAmount(value, fallback = 0) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : fallback;
}

export function isVerifiedPaidStatus(value) {
  return VERIFIED_PAID_STATUSES.has(normalizeText(value));
}

export function isFinalPaymentStatus(value) {
  return FINAL_PAYMENT_STATUSES.has(normalizeText(value));
}

export function paymentLifecycleState(value) {
  const status = normalizeText(value);
  if (status === "paid") return "PAID";
  if (status === "authorized") return "AUTHORIZED";
  if (status === "failed") return "FAILED";
  if (status === "cancelled") return "CANCELLED";
  if (status === "refund_pending") return "REFUND_PENDING";
  if (status === "partially_refunded") return "PARTIALLY_REFUNDED";
  if (status === "refunded") return "REFUNDED";
  if (status === "refund_failed") return "REFUND_FAILED";
  if (["approved", "created", "pending", "requires_action"].includes(status)) return "PENDING";
  return status ? status.toUpperCase() : "PENDING";
}

export function transitionPaymentLifecycle({
  currentStatus,
  currentRefundedAmount = 0,
  paymentAmount = 0,
  event = {}
} = {}) {
  const current = normalizeText(currentStatus) || "pending";
  const eventType = normalizeText(event.event_type || event.type);
  const eventStatus = normalizeText(event.status);
  const paidLike = isVerifiedPaidStatus(current);
  const result = {
    payment_status: current,
    refund_status: null,
    refunded_amount: normalizeAmount(currentRefundedAmount),
    verified_paid: false,
    changed: false
  };

  if (["payment_paid", "payment_capture_completed"].includes(eventType) || eventStatus === "paid") {
    result.payment_status = "paid";
    result.verified_paid = true;
  } else if (eventType === "payment_authorized" || eventStatus === "authorized") {
    result.payment_status = current === "paid" ? current : "authorized";
  } else if (["payment_failed", "payment_capture_denied", "payment_capture_failed"].includes(eventType) || eventStatus === "failed") {
    result.payment_status = paidLike ? current : "failed";
  } else if (eventType === "payment_cancelled" || eventStatus === "cancelled") {
    result.payment_status = paidLike ? current : "cancelled";
  } else if (eventType === "refund_pending" || eventStatus === "refund_pending") {
    result.payment_status = "refund_pending";
    result.refund_status = "refund_pending";
  } else if (eventType === "refund_failed" || eventStatus === "refund_failed") {
    result.payment_status = "refund_failed";
    result.refund_status = "refund_failed";
  } else if (["payment_refunded", "payment_partially_refunded"].includes(eventType) || ["refunded", "partially_refunded"].includes(eventStatus)) {
    const refundAmount = normalizeAmount(event.refund_amount ?? event.amount);
    const paymentTotal = normalizeAmount(paymentAmount);
    const nextRefunded = normalizeAmount(currentRefundedAmount) + refundAmount;
    const fullRefund = event.full_refund === true || eventStatus === "refunded" || (paymentTotal > 0 && nextRefunded >= paymentTotal);
    result.refunded_amount = nextRefunded;
    result.payment_status = fullRefund ? "refunded" : "partially_refunded";
    result.refund_status = result.payment_status;
  } else if (["payment_approved", "payment_pending"].includes(eventType) || ["approved", "pending"].includes(eventStatus)) {
    result.payment_status = paidLike ? current : "pending";
  }

  result.changed = result.payment_status !== current || result.refunded_amount !== normalizeAmount(currentRefundedAmount);
  return result;
}

export function orderLifecycleForPayment({ currentOrderStatus, paymentStatus } = {}) {
  const current = normalizeText(currentOrderStatus) || "pending_payment";
  const payment = normalizeText(paymentStatus);
  if (["confirmed", "paid", "fulfilled", "completed", "refunded"].includes(current)) {
    if (payment === "refunded") return "refunded";
    return current;
  }
  if (["paid", "partially_refunded", "refund_pending", "refund_failed"].includes(payment)) return "confirmed";
  if (payment === "refunded") return "refunded";
  return "pending_payment";
}
