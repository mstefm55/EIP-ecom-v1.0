import {
  assertOutboundUrlAllowed,
  buildOutboundAuth,
  fetchWithTimeout
} from "../gateway/outbound.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function paypalApiUrl(profile, path) {
  const baseUrl = normalizeText(profile?.outbound?.base_url).replace(/\/+$/, "");
  if (!baseUrl) throw new Error("PAYPAL_BASE_URL_REQUIRED");
  return `${baseUrl}/${String(path || "").replace(/^\/+/, "")}`;
}

function paypalAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("PAYPAL_AMOUNT_INVALID");
  return amount.toFixed(2);
}

function safeProviderError(operation, status) {
  const suffix = Number.isInteger(status) ? `_${status}` : "";
  return `PAYPAL_${operation}_FAILED${suffix}`;
}

async function paypalRequest(profile, { path, method = "POST", body, requestId, operation }) {
  const url = paypalApiUrl(profile, path);
  await assertOutboundUrlAllowed(url, profile, { purpose: `paypal_${operation.toLowerCase()}` });
  const auth = await buildOutboundAuth(profile);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...(auth.headers || {})
  };
  if (requestId) headers["PayPal-Request-Id"] = normalizeText(requestId).slice(0, 108);

  const response = await fetchWithTimeout(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    timeout_ms: profile?.outbound?.timeout_ms || 10000
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    return { ok: false, error: safeProviderError(operation, response.status) };
  }
  return { ok: true, payload };
}

function paypalExperienceContext(input = {}) {
  const returnUrl = normalizeText(input.returnUrl);
  const cancelUrl = normalizeText(input.cancelUrl);
  if (!returnUrl || !cancelUrl) return null;
  return {
    return_url: returnUrl,
    cancel_url: cancelUrl,
    user_action: "PAY_NOW",
    shipping_preference: "NO_SHIPPING"
  };
}

function approvalUrl(payload = {}) {
  const links = Array.isArray(payload.links) ? payload.links : [];
  return normalizeText(
    links.find((link) => ["payer-action", "approve"].includes(normalizeText(link?.rel).toLowerCase()))?.href
  );
}

function paypalEventId(payload = {}) {
  const purchaseUnits = Array.isArray(payload.purchase_units) ? payload.purchase_units : [];
  for (const unit of purchaseUnits) {
    const payments = unit?.payments || {};
    for (const key of ["captures", "authorizations"]) {
      const records = Array.isArray(payments[key]) ? payments[key] : [];
      const id = normalizeText(records[0]?.id);
      if (id) return id;
    }
  }
  return normalizeText(payload.id);
}

function mapPaypalRuntimeError(error) {
  const code = normalizeText(error?.message);
  if (code.startsWith("OAUTH_")) return "PAYPAL_AUTH_FAILED";
  if (error?.name === "AbortError") return "PAYPAL_REQUEST_TIMEOUT";
  if (code.startsWith("PAYPAL_")) return code;
  return "PAYPAL_CHECKOUT_UNAVAILABLE";
}

export async function createPaypalCheckoutSession(input = {}) {
  const profile = input.connectionProfile || null;
  try {
    const experienceContext = paypalExperienceContext(input);
    if (!experienceContext) return { ok: false, error: "PAYPAL_RETURN_URL_REQUIRED" };
    const body = {
      intent: input.captureMode === "manual" ? "AUTHORIZE" : "CAPTURE",
      purchase_units: [{
        reference_id: normalizeText(input.paymentCode).slice(0, 256),
        amount: {
          currency_code: normalizeText(input.currency).toUpperCase(),
          value: paypalAmount(input.amount)
        }
      }],
      payment_source: {
        paypal: { experience_context: experienceContext }
      }
    };
    const result = await paypalRequest(profile, {
      path: "/v2/checkout/orders",
      body,
      requestId: input.paymentCode,
      operation: "ORDER_CREATE"
    });
    if (!result.ok) return result;

    const providerSessionId = normalizeText(result.payload?.id);
    const redirectUrl = approvalUrl(result.payload);
    if (!providerSessionId || !redirectUrl) {
      return { ok: false, error: "PAYPAL_ORDER_RESPONSE_INVALID" };
    }
    return {
      ok: true,
      session: {
        provider_code: "paypal",
        provider_session_id: providerSessionId,
        provider_payment_id: providerSessionId,
        status: normalizeText(result.payload?.status).toLowerCase() || "created",
        amount: Number(input.amount),
        currency: normalizeText(input.currency).toUpperCase(),
        capture_mode: input.captureMode === "manual" ? "manual" : "automatic",
        redirect_url: redirectUrl,
        client_action: "redirect"
      }
    };
  } catch (error) {
    return { ok: false, error: mapPaypalRuntimeError(error) };
  }
}

export async function confirmPaypalCheckoutSession(input = {}) {
  const profile = input.connectionProfile || null;
  const providerSessionId = normalizeText(input.providerSessionId);
  if (!providerSessionId) return { ok: false, error: "PAYPAL_ORDER_ID_REQUIRED" };
  const manual = input.captureMode === "manual";
  const operation = manual ? "AUTHORIZE" : "CAPTURE";
  try {
    const result = await paypalRequest(profile, {
      path: `/v2/checkout/orders/${encodeURIComponent(providerSessionId)}/${manual ? "authorize" : "capture"}`,
      body: {},
      requestId: input.paymentCode || `${providerSessionId}-${operation.toLowerCase()}`,
      operation
    });
    if (!result.ok) return result;
    return {
      ok: true,
      event: {
        provider_code: "paypal",
        provider_event_id: paypalEventId(result.payload) || providerSessionId,
        event_type: manual ? "payment_authorized" : "payment_paid",
        status: manual ? "authorized" : "paid"
      }
    };
  } catch (error) {
    return { ok: false, error: mapPaypalRuntimeError(error) };
  }
}

