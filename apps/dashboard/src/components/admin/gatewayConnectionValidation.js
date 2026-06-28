const PAYMENT_PROVIDER_RULES = {
  paypal: {
    displayName: "PayPal",
    authMode: "oauth2_client_credentials",
    credentialFields: [
      { path: "outbound.auth.client_id", label: "Client ID reference", key: "client_id", secret: false },
      { path: "outbound.auth.client_secret", label: "Client secret reference", key: "client_secret", secret: true }
    ]
  },
  checkout_com: {
    displayName: "Checkout.com",
    authMode: "api_key_header",
    credentialFields: [
      { path: "outbound.auth.secret", label: "Secret key reference", key: "secret", secret: true }
    ]
  }
};

function text(value) {
  return String(value || "").trim();
}

function hasCredential(container, key) {
  return Boolean(
    text(container?.[key]) ||
    text(container?.[`${key}_ref`]) ||
    container?.[`${key}_set`] === true
  );
}

function addError(errors, profile, path, label, step, message = `${label} is required.`) {
  errors.push({
    connectionId: profile?.id || "connection",
    path,
    label,
    step,
    message
  });
}

export function isPaymentWebhookEnabled(profile) {
  return profile?.inbound?.webhook_enabled === true;
}

function validatePaymentProfile(profile, rules, errors) {
  const identity = profile?.identity || {};
  const outbound = profile?.outbound || {};
  const auth = outbound.auth || {};

  if (!text(identity.connection_name)) addError(errors, profile, "identity.connection_name", "Connection name", "identity");
  if (!text(identity.connection_code)) addError(errors, profile, "identity.connection_code", "Connection code", "identity");
  if (!text(identity.connection_kind)) addError(errors, profile, "identity.connection_kind", "Connection kind", "identity");
  if (!["sandbox", "production"].includes(identity.environment)) {
    addError(errors, profile, "identity.environment", "Environment", "identity", "Environment must be Sandbox or Production.");
  }
  if (identity.direction !== "outbound") {
    addError(errors, profile, "identity.direction", "Direction", "identity", "Payment provider direction must be Outbound.");
  }
  if (!text(outbound.base_url)) addError(errors, profile, "outbound.base_url", "Outbound base URL", "outbound");
  if (!text(outbound.path_prefix)) addError(errors, profile, "outbound.path_prefix", "Outbound path prefix", "outbound");
  if (outbound.auth_mode !== rules.authMode) {
    addError(
      errors,
      profile,
      "outbound.auth_mode",
      "Outbound authentication mode",
      "outbound",
      `${rules.displayName} requires ${rules.authMode}.`
    );
  }
  rules.credentialFields.forEach((field) => {
    const configured = field.secret ? hasCredential(auth, field.key) : Boolean(text(auth[field.key]));
    if (!configured) addError(errors, profile, field.path, field.label, "outbound");
  });
  if (rules.displayName === "PayPal" && /^[^@\s]+@[^@\s]+$/.test(text(auth.client_id))) {
    addError(
      errors,
      profile,
      "outbound.auth.client_id",
      "Client ID reference",
      "outbound",
      "Enter the PayPal REST app Client ID, not the sandbox account email."
    );
  }

  if (isPaymentWebhookEnabled(profile) && !text(profile?.inbound?.inbound_path_suffix)) {
    addError(errors, profile, "inbound.inbound_path_suffix", "Inbound path suffix", "inbound");
  }
}

export function validateGatewayConnection(profile) {
  const errors = [];
  const kind = text(profile?.identity?.connection_kind);
  const paymentRules = PAYMENT_PROVIDER_RULES[kind];
  if (paymentRules) {
    validatePaymentProfile(profile, paymentRules, errors);
    return errors;
  }

  if (!text(profile?.identity?.connection_name)) addError(errors, profile, "identity.connection_name", "Connection name", "identity");
  if (!text(profile?.identity?.connection_code)) addError(errors, profile, "identity.connection_code", "Connection code", "identity");
  if (!text(profile?.identity?.connection_kind)) addError(errors, profile, "identity.connection_kind", "Connection kind", "identity");
  if (["website", "ecommerce"].includes(kind) && profile.identity.direction !== "outbound" && !text(profile.identity.frontend_url)) {
    addError(errors, profile, "identity.frontend_url", "Frontend URL", "identity");
  }
  if (profile.identity.direction !== "outbound") {
    if (!text(profile?.inbound?.inbound_path_suffix)) addError(errors, profile, "inbound.inbound_path_suffix", "Inbound path suffix", "inbound");
    if (!text(profile?.inbound?.origin_allowlist_text) && profile.identity.environment !== "sandbox") {
      addError(errors, profile, "inbound.origin_allowlist_text", "Origin allowlist", "inbound");
    }
  }
  if (profile.identity.direction !== "inbound" && !text(profile?.outbound?.base_url)) {
    addError(errors, profile, "outbound.base_url", "Outbound base URL", "outbound");
  }
  if (profile?.verification?.mode === "api_key") {
    if (!text(profile.verification.api_key?.header_name)) addError(errors, profile, "verification.api_key.header_name", "API key header name", "verification");
    if (!hasCredential(profile.verification.api_key, "secret")) addError(errors, profile, "verification.api_key.secret", "API key secret", "verification");
  }
  if (profile?.verification?.mode === "none" && profile.identity.environment !== "sandbox") {
    addError(errors, profile, "verification.mode", "Verification mode", "verification", "Verification is required for production connections.");
  }
  if (!text(profile?.idempotency?.event_id_location)) addError(errors, profile, "idempotency.event_id_location", "Idempotency location", "idempotency");
  if (!text(profile?.idempotency?.event_id_key)) addError(errors, profile, "idempotency.event_id_key", "Idempotency key", "idempotency");
  if (!text(profile?.routing?.channel)) addError(errors, profile, "routing.channel", "Routing channel", "routing");
  if (!text(profile?.routing?.schema_version)) addError(errors, profile, "routing.schema_version", "Schema version", "routing");
  if (!text(profile?.routing?.envelope_profile)) addError(errors, profile, "routing.envelope_profile", "Envelope profile", "routing");
  if (!Array.isArray(profile?.public_storefront?.allowed_scan_modes) || !profile.public_storefront.allowed_scan_modes.length) {
    addError(errors, profile, "public_storefront.allowed_scan_modes", "Allowed scan modes", "storefront", "At least one storefront scan mode is required.");
  }
  if (!Array.isArray(profile?.public_storefront?.scopes) || !profile.public_storefront.scopes.length) {
    addError(errors, profile, "public_storefront.scopes", "Public storefront scopes", "storefront", "At least one public storefront scope is required.");
  }
  if (!text(profile?.audit?.audit_record_type)) addError(errors, profile, "audit.audit_record_type", "Audit record type", "audit");
  return errors;
}

export function validateGatewayConnections(profiles = []) {
  return profiles.flatMap(validateGatewayConnection);
}

export function fieldErrorMap(errors = []) {
  return Object.fromEntries(
    errors.map((error) => [`${error.connectionId}:${error.path}`, error.message])
  );
}

const SERVER_DETAIL_FIELDS = [
  [/connection_name/i, "identity.connection_name", "Connection name", "identity"],
  [/connection_code/i, "identity.connection_code", "Connection code", "identity"],
  [/\benvironment\b/i, "identity.environment", "Environment", "identity"],
  [/\bdirection\b/i, "identity.direction", "Direction", "identity"],
  [/frontend_url/i, "identity.frontend_url", "Frontend URL", "identity"],
  [/inbound_path_suffix/i, "inbound.inbound_path_suffix", "Inbound path suffix", "inbound"],
  [/origin_allowlist/i, "inbound.origin_allowlist_text", "Origin allowlist", "inbound"],
  [/outbound base_url/i, "outbound.base_url", "Outbound base URL", "outbound"],
  [/outbound path_prefix/i, "outbound.path_prefix", "Outbound path prefix", "outbound"],
  [/auth_mode/i, "outbound.auth_mode", "Outbound authentication mode", "outbound"],
  [/oauth client_id/i, "outbound.auth.client_id", "Client ID reference", "outbound"],
  [/oauth client_secret/i, "outbound.auth.client_secret", "Client secret reference", "outbound"],
  [/api key secret/i, "outbound.auth.secret", "Secret key reference", "outbound"],
  [/event_id_location/i, "idempotency.event_id_location", "Idempotency location", "idempotency"],
  [/event_id_key/i, "idempotency.event_id_key", "Idempotency key", "idempotency"],
  [/schema_version/i, "routing.schema_version", "Schema version", "routing"],
  [/envelope_profile/i, "routing.envelope_profile", "Envelope profile", "routing"],
  [/audit_record_type/i, "audit.audit_record_type", "Audit record type", "audit"]
];

export function gatewayServerValidationErrors(details = [], fallbackConnectionId = "connection") {
  return details.map((detail, index) => {
    const message = String(detail || "Validation failed");
    const separator = message.indexOf(":");
    const connectionId = separator > 0 ? message.slice(0, separator).trim() : fallbackConnectionId;
    const field = SERVER_DETAIL_FIELDS.find(([pattern]) => pattern.test(message));
    return {
      connectionId: connectionId || fallbackConnectionId,
      path: field?.[1] || `server.${index}`,
      label: field?.[2] || message.replace(/^[^:]+:\s*/, ""),
      step: field?.[3] || "identity",
      message
    };
  });
}
