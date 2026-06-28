import assert from "node:assert/strict";
import test from "node:test";

import {
  fieldErrorMap,
  gatewayServerValidationErrors,
  validateGatewayConnection
} from "../src/components/admin/gatewayConnectionValidation.js";

function paymentProfile(kind = "paypal") {
  const paypal = kind === "paypal";
  return {
    id: `${kind}-profile`,
    identity: {
      connection_name: paypal ? "PayPal" : "Checkout.com",
      connection_code: paypal ? "paypal-sandbox" : "checkout-sandbox",
      connection_kind: kind,
      direction: "outbound",
      environment: "sandbox"
    },
    inbound: { inbound_path_suffix: "" },
    verification: { mode: "hmac_signature", hmac_signature: { webhook_id_ref: "", secret: "", secret_set: false } },
    outbound: {
      base_url: paypal ? "https://api-m.sandbox.paypal.com" : "https://api.sandbox.checkout.com",
      path_prefix: "/",
      auth_mode: paypal ? "oauth2_client_credentials" : "api_key_header",
      auth: paypal
        ? { client_id: "paypal-client-reference", client_secret: "", client_secret_set: true }
        : { secret: "", secret_set: true }
    }
  };
}

test("PayPal and Checkout.com save without an inbound suffix when webhook setup is absent", () => {
  assert.deepEqual(validateGatewayConnection(paymentProfile("paypal")), []);
  assert.deepEqual(validateGatewayConnection(paymentProfile("checkout_com")), []);
});

test("payment webhook setup requires an inbound suffix only after webhook credentials are configured", () => {
  const paypal = paymentProfile("paypal");
  paypal.identity.direction = "both";
  paypal.verification.hmac_signature.webhook_id_ref = "paypal-webhook-reference";

  const errors = validateGatewayConnection(paypal);
  assert.deepEqual(errors.map((error) => error.path), ["inbound.inbound_path_suffix"]);
});

test("missing PayPal credentials produce exact field-level errors and labels", () => {
  const paypal = paymentProfile("paypal");
  paypal.outbound.auth.client_id = "";
  paypal.outbound.auth.client_secret_set = false;

  const errors = validateGatewayConnection(paypal);
  assert.deepEqual(errors.map((error) => error.label), ["Client ID reference", "Client secret reference"]);
  assert.deepEqual(fieldErrorMap(errors), {
    "paypal-profile:outbound.auth.client_id": "Client ID reference is required.",
    "paypal-profile:outbound.auth.client_secret": "Client secret reference is required."
  });
});

test("backend validation details map back to the exact PayPal fields", () => {
  const errors = gatewayServerValidationErrors([
    "paypal-profile: oauth client_id required",
    "paypal-profile: oauth client_secret required"
  ]);
  assert.deepEqual(errors.map((error) => error.path), [
    "outbound.auth.client_id",
    "outbound.auth.client_secret"
  ]);
});

test("Website inbound validation remains unchanged", () => {
  const website = {
    id: "website-profile",
    identity: {
      connection_name: "Website",
      connection_code: "website-main",
      connection_kind: "website",
      direction: "inbound",
      environment: "production",
      frontend_url: "https://store.example"
    },
    inbound: { inbound_path_suffix: "", origin_allowlist_text: "" },
    outbound: {},
    verification: { mode: "none", api_key: {} },
    idempotency: { event_id_location: "header", event_id_key: "X-Event-Id" },
    routing: { channel: "website_intake", schema_version: "v1", envelope_profile: "canonical_v1" },
    public_storefront: {
      allowed_scan_modes: ["auto"],
      scopes: ["storefront.content.read"]
    },
    audit: { audit_record_type: "GATEWAY_AUDIT" }
  };

  const paths = validateGatewayConnection(website).map((error) => error.path);
  assert.ok(paths.includes("inbound.inbound_path_suffix"));
  assert.ok(paths.includes("inbound.origin_allowlist_text"));
  assert.ok(paths.includes("verification.mode"));
});
