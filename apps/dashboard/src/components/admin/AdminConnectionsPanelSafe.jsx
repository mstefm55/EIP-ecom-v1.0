import { cloneElement, isValidElement, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, Copy, EyeOff, Plus, RefreshCw, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { apiFetch } from "../../services/apiClient";
import ActionMiniModal from "../shared/ActionMiniModal";
import {
  fieldErrorMap,
  gatewayServerValidationErrors,
  validateGatewayConnections
} from "./gatewayConnectionValidation";

const KIND_OPTIONS = [
  { value: "website", label: "Website" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "payments", label: "Payments" },
  { value: "paypal", label: "PayPal" },
  { value: "checkout_com", label: "Checkout.com" },
  { value: "banking", label: "Banking" },
  { value: "edi", label: "EDI" },
  { value: "social", label: "Social" },
  { value: "email", label: "Email" },
  { value: "custom", label: "Custom" }
];

const DIRECTION_OPTIONS = [
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
  { value: "both", label: "Both" }
];

const ENV_OPTIONS = [
  { value: "sandbox", label: "Sandbox" },
  { value: "production", label: "Production" }
];

const VERIFICATION_MODES = [
  { value: "none", label: "None" },
  { value: "api_key", label: "API Key" },
  { value: "hmac_signature", label: "HMAC Signature" },
  { value: "oauth2_jwt", label: "OAuth2 JWT" }
];

const CHANNEL_OPTIONS = [
  { value: "website_intake", label: "Website Intake" },
  { value: "edi", label: "EDI" },
  { value: "banking", label: "Banking" },
  { value: "payments", label: "Payments" },
  { value: "social", label: "Social" },
  { value: "email", label: "Email" },
  { value: "custom", label: "Custom" }
];

const MAPPING_MODES = [
  { value: "passthrough", label: "Passthrough" },
  { value: "mapped", label: "Mapped" }
];

const LOG_LEVELS = ["error", "warn", "info", "debug"];
const HTTP_METHODS = ["POST", "PUT", "PATCH"];

const PAYMENT_PROVIDER_SETUP = {
  paypal: {
    title: "PayPal provider setup",
    displayName: "PayPal",
    providerCode: "paypal",
    authMode: "oauth2_client_credentials",
    clientAuthMethod: "basic",
    baseUrls: {
      sandbox: "https://api-m.sandbox.paypal.com",
      production: "https://api-m.paypal.com"
    },
    tokenUrls: {
      sandbox: "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      production: "https://api-m.paypal.com/v1/oauth2/token"
    },
    healthcheckPath: "/v1/oauth2/token",
    supportedMethods: ["PAYPAL"],
    signatureHeader: "paypal-transmission-sig",
    timestampHeader: "paypal-transmission-time",
    eventIdKey: "paypal-transmission-id"
  },
  checkout_com: {
    title: "Checkout.com provider setup",
    displayName: "Checkout.com",
    providerCode: "checkout_com",
    authMode: "api_key_header",
    authHeader: "Authorization",
    baseUrls: {
      sandbox: "https://api.sandbox.checkout.com",
      production: "https://api.checkout.com"
    },
    healthcheckPath: "/",
    supportedMethods: ["CARD", "GOOGLE_PAY", "APPLE_PAY"],
    signatureHeader: "cko-signature",
    timestampHeader: "cko-request-id",
    eventIdKey: "cko-request-id"
  }
};

function normalizeList(text) {
  return String(text || "")
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function slugifyCode(value) {
  const base = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) return "conn";
  if (base.length < 3) return `${base}-conn`;
  return base.slice(0, 65);
}

function normalizeJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function hasStoredSecret(container, key) {
  return Boolean(container?.[key] || container?.[`${key}_ref`] || container?.[`${key}_set`]);
}

function paymentEnvironmentValue(setup, environment, key) {
  const mode = environment === "production" ? "production" : "sandbox";
  return setup?.[key]?.[mode] || "";
}

function isPaymentConnection(connection) {
  return Boolean(PAYMENT_PROVIDER_SETUP[connection?.identity?.connection_kind]);
}

function buildProfile(id, overrides = {}) {
  return {
    id: id || `conn-${Date.now()}`,
    identity: {
      connection_name: "",
      connection_code: "",
      connection_kind: "custom",
      frontend_url: "",
      portal_url: "",
      direction: "inbound",
      environment: "production",
      is_enabled: true
    },
    inbound: {
      inbound_path_suffix: "",
      webhook_enabled: false,
      http_method: "POST",
      expected_content_type: "application/json",
      origin_allowlist_text: "",
      raw_body_required: true,
      rate_limit_max: 3000,
      rate_limit_window_sec: 3600
    },
    verification: {
      mode: "none",
      allow_unverified: false,
      api_key: { header_name: "X-API-Key", secret: "", secret_set: false },
      hmac_signature: {
        header_name: "",
        algorithm: "sha256",
        encoding: "hex",
        secret: "",
        secret_set: false,
        webhook_id_ref: "",
        payload_mode: "raw",
        timestamp_header: "x-timestamp",
        max_skew_sec: 300
      },
      oauth2_jwt: {
        header_name: "Authorization",
        token_prefix: "Bearer",
        issuer: "",
        audience: "",
        jwks_url: "",
        secret: "",
        secret_set: false,
        test_token: "",
        max_skew_sec: 300,
        max_age_sec: 900
      }
    },
    idempotency: {
      event_id_location: "header",
      event_id_key: "X-Event-Id",
      idempotency_scope: "connection"
    },
    outbound: {
      base_url: "",
      path_prefix: "/",
      auth_mode: "none",
      auth: {
        header_name: "",
        query_param_name: "",
        secret: "",
        secret_set: false,
        public_key_ref: "",
        token: "",
        token_set: false,
        username: "",
        password: "",
        password_set: false,
        client_id: "",
        client_secret: "",
        client_secret_set: false,
        client_auth_method: "",
        token_url: "",
        scope: ""
      },
      default_headers_text: "",
      timeout_ms: 8000,
      retry_policy: { max_retries: 2, backoff_ms: 500 },
      healthcheck_path: "/health",
      test_request_method: "GET"
    },
    routing: {
      channel: "custom",
      protocol: "",
      provider_code: "",
      health_status: "healthy",
      provider_available: true,
      health_mode: "production",
      health_checked_at: "",
      last_successful_test_at: "",
      health_error: "",
      apple_pay_domain_status: "",
      domain_validation_status: "",
      supported_payment_methods_text: "",
      supported_message_types_text: "",
      payment_provider: null,
      schema_version: "v1",
      envelope_profile: "canonical_v1",
      mapping_mode: "passthrough",
      mapping_rules_text: ""
    },
    public_storefront: {
      scan_allowed: true,
      loader_enabled: false,
      public_api_enabled: true,
      google_pay_enabled: false,
      apple_pay_domain_status: "",
      allowed_scan_modes: ["auto", "rendered", "generic", "tagged"],
      scopes: [
        "storefront.mapping.read",
        "storefront.content.read",
        "storefront.catalog.read"
      ]
    },
    audit: {
      audit_record_type: "GATEWAY_AUDIT",
      redaction_policy_text: "",
      max_body_size: 262144,
      ip_allowlist_text: "",
      log_level: "info"
    },
    ...overrides
  };
}

function fromApiProfile(profile) {
  return buildProfile(profile.id, {
    identity: {
      connection_name: profile.identity?.connection_name || "",
      connection_code: profile.identity?.connection_code || "",
      connection_kind: profile.identity?.connection_kind || "custom",
      frontend_url: profile.identity?.frontend_url || "",
      portal_url: profile.identity?.portal_url || "",
      direction: profile.identity?.direction || "inbound",
      environment: profile.identity?.environment || "production",
      is_enabled: profile.identity?.is_enabled ?? true
    },
    inbound: {
      inbound_path_suffix: profile.inbound?.inbound_path_suffix || "",
      webhook_enabled: profile.inbound?.webhook_enabled === true,
      http_method: profile.inbound?.http_method || "POST",
      expected_content_type: profile.inbound?.expected_content_type || "application/json",
      origin_allowlist_text: Array.isArray(profile.inbound?.origin_allowlist) ? profile.inbound.origin_allowlist.join("\n") : "",
      raw_body_required: profile.inbound?.raw_body_required ?? true,
      rate_limit_max: profile.inbound?.rate_limit?.max ?? 3000,
      rate_limit_window_sec: profile.inbound?.rate_limit?.window_sec ?? 3600
    },
    verification: {
      mode: profile.verification?.mode || "none",
      allow_unverified: profile.verification?.allow_unverified ?? false,
      api_key: {
        header_name: profile.verification?.api_key?.header_name || "X-API-Key",
        secret: "",
        secret_set: Boolean(profile.verification?.api_key?.secret_set)
      },
      hmac_signature: {
        header_name: profile.verification?.hmac_signature?.header_name || "",
        algorithm: profile.verification?.hmac_signature?.algorithm || "sha256",
        encoding: profile.verification?.hmac_signature?.encoding || "hex",
        secret: "",
        secret_set: Boolean(profile.verification?.hmac_signature?.secret_set),
        webhook_id_ref: profile.verification?.hmac_signature?.webhook_id_ref || "",
        payload_mode: profile.verification?.hmac_signature?.payload_mode || "raw",
        timestamp_header: profile.verification?.hmac_signature?.timestamp_header || "x-timestamp",
        max_skew_sec: profile.verification?.hmac_signature?.max_skew_sec ?? 300
      },
      oauth2_jwt: {
        header_name: profile.verification?.oauth2_jwt?.header_name || "Authorization",
        token_prefix: profile.verification?.oauth2_jwt?.token_prefix || "Bearer",
        issuer: profile.verification?.oauth2_jwt?.issuer || "",
        audience: profile.verification?.oauth2_jwt?.audience || "",
        jwks_url: profile.verification?.oauth2_jwt?.jwks_url || "",
        secret: "",
        secret_set: Boolean(profile.verification?.oauth2_jwt?.secret_set),
        test_token: "",
        max_skew_sec: profile.verification?.oauth2_jwt?.max_skew_sec ?? 300,
        max_age_sec: profile.verification?.oauth2_jwt?.max_age_sec ?? 900
      }
    },
    idempotency: {
      event_id_location: profile.idempotency?.event_id_location || "header",
      event_id_key: profile.idempotency?.event_id_key || "X-Event-Id",
      idempotency_scope: profile.idempotency?.idempotency_scope || "connection"
    },
    outbound: {
      base_url: profile.outbound?.base_url || "",
      path_prefix: profile.outbound?.path_prefix || "/",
      auth_mode: profile.outbound?.auth_mode || "none",
      auth: {
        header_name: profile.outbound?.auth?.header_name || "",
        query_param_name: profile.outbound?.auth?.query_param_name || "",
        secret: "",
        secret_set: Boolean(profile.outbound?.auth?.secret_set),
        public_key_ref: profile.outbound?.auth?.public_key_ref || "",
        token: "",
        token_set: Boolean(profile.outbound?.auth?.token_set),
        username: profile.outbound?.auth?.username || "",
        password: "",
        password_set: Boolean(profile.outbound?.auth?.password_set),
        client_id: profile.outbound?.auth?.client_id || "",
        client_secret: "",
        client_secret_set: Boolean(profile.outbound?.auth?.client_secret_set),
        client_auth_method: profile.outbound?.auth?.client_auth_method || "",
        token_url: profile.outbound?.auth?.token_url || "",
        scope: profile.outbound?.auth?.scope || ""
      },
      default_headers_text: profile.outbound?.default_headers ? JSON.stringify(profile.outbound.default_headers, null, 2) : "",
      timeout_ms: profile.outbound?.timeout_ms || 8000,
      retry_policy: profile.outbound?.retry_policy || { max_retries: 2, backoff_ms: 500 },
      healthcheck_path: profile.outbound?.healthcheck_path || "/health",
      test_request_method: profile.outbound?.test_request_method || "GET"
    },
    routing: {
      channel: profile.routing?.channel || "custom",
      protocol: profile.routing?.protocol || "",
      provider_code: profile.routing?.provider_code || "",
      health_status: profile.routing?.health_status || "healthy",
      provider_available: profile.routing?.provider_available === true,
      health_mode: profile.routing?.health_mode || profile.identity?.environment || "production",
      health_checked_at: profile.routing?.health_checked_at || "",
      last_successful_test_at: profile.routing?.last_successful_test_at || "",
      health_error: profile.routing?.health_error || "",
      apple_pay_domain_status: profile.routing?.apple_pay_domain_status || "",
      domain_validation_status: profile.routing?.domain_validation_status || "",
      supported_payment_methods_text: Array.isArray(profile.routing?.supported_payment_methods)
        ? profile.routing.supported_payment_methods.join("\n")
        : Array.isArray(profile.routing?.supported_message_types)
          ? profile.routing.supported_message_types.join("\n")
          : "",
      supported_message_types_text: Array.isArray(profile.routing?.supported_message_types) ? profile.routing.supported_message_types.join("\n") : "",
      payment_provider: profile.routing?.payment_provider && typeof profile.routing.payment_provider === "object"
        ? profile.routing.payment_provider
        : null,
      schema_version: profile.routing?.schema_version || "v1",
      envelope_profile: profile.routing?.envelope_profile || "canonical_v1",
      mapping_mode: profile.routing?.mapping_mode || "passthrough",
      mapping_rules_text: profile.routing?.mapping_rules ? JSON.stringify(profile.routing.mapping_rules, null, 2) : ""
    },
    public_storefront: {
      scan_allowed: profile.public_storefront?.scan_allowed !== false,
      loader_enabled: profile.public_storefront?.loader_enabled === true,
      public_api_enabled: profile.public_storefront?.public_api_enabled !== false,
      google_pay_enabled: profile.public_storefront?.google_pay_enabled === true,
      apple_pay_domain_status:
        profile.public_storefront?.apple_pay_domain_status ||
        profile.routing?.apple_pay_domain_status ||
        "",
      allowed_scan_modes: Array.isArray(profile.public_storefront?.allowed_scan_modes)
        ? profile.public_storefront.allowed_scan_modes
        : ["auto", "rendered", "generic", "tagged"],
      scopes: Array.isArray(profile.public_storefront?.scopes)
        ? profile.public_storefront.scopes
        : ["storefront.mapping.read", "storefront.content.read", "storefront.catalog.read"]
    },
    audit: {
      audit_record_type: profile.audit?.audit_record_type || "GATEWAY_AUDIT",
      redaction_policy_text: profile.audit?.redaction_policy ? JSON.stringify(profile.audit.redaction_policy, null, 2) : "",
      max_body_size: profile.audit?.max_body_size || 262144,
      ip_allowlist_text: Array.isArray(profile.audit?.ip_allowlist) ? profile.audit.ip_allowlist.join("\n") : "",
      log_level: profile.audit?.log_level || "info"
    }
  });
}

function toApiProfile(profile) {
  const paymentSetup = PAYMENT_PROVIDER_SETUP[profile.identity.connection_kind] || null;
  const supportedPaymentMethods = paymentSetup
    ? normalizeList(profile.routing.supported_payment_methods_text || profile.routing.supported_message_types_text)
        .map((method) => method.toUpperCase())
    : [];
  const paymentProviderMetadata = paymentSetup
    ? {
        ...(profile.routing.payment_provider && typeof profile.routing.payment_provider === "object"
          ? profile.routing.payment_provider
          : {}),
        code: paymentSetup.providerCode,
        label: profile.identity.connection_name || paymentSetup.displayName,
        enabled: profile.identity.is_enabled !== false,
        visible: true,
        adapter_code: paymentSetup.providerCode,
        methods: supportedPaymentMethods.map((method, index) => ({
          code: method,
          label: method.replace(/_/g, " "),
          enabled: method !== "GOOGLE_PAY" || profile.public_storefront.google_pay_enabled === true,
          visible: true,
          priority: (index + 1) * 10
        }))
      }
    : profile.routing.payment_provider;
  return {
    id: profile.id,
    identity: { ...profile.identity },
    inbound: {
      inbound_path_suffix: profile.inbound.inbound_path_suffix,
      webhook_enabled: profile.inbound.webhook_enabled === true,
      http_method: profile.inbound.http_method,
      expected_content_type: profile.inbound.expected_content_type,
      origin_allowlist: normalizeList(profile.inbound.origin_allowlist_text),
      raw_body_required: profile.inbound.raw_body_required,
      rate_limit: {
        max: Number(profile.inbound.rate_limit_max || 0) || null,
        window_sec: Number(profile.inbound.rate_limit_window_sec || 0) || null
      }
    },
    verification: {
      mode: profile.verification.mode,
      allow_unverified: profile.verification.allow_unverified,
      api_key: {
        header_name: profile.verification.api_key.header_name,
        secret: profile.verification.api_key.secret
      },
      hmac_signature: {
        header_name: profile.verification.hmac_signature.header_name,
        algorithm: profile.verification.hmac_signature.algorithm,
        encoding: profile.verification.hmac_signature.encoding,
        secret: profile.verification.hmac_signature.secret,
        webhook_id_ref: profile.verification.hmac_signature.webhook_id_ref,
        payload_mode: profile.verification.hmac_signature.payload_mode,
        timestamp_header: profile.verification.hmac_signature.timestamp_header,
        max_skew_sec: Number(profile.verification.hmac_signature.max_skew_sec || 300)
      },
      oauth2_jwt: {
        header_name: profile.verification.oauth2_jwt.header_name,
        token_prefix: profile.verification.oauth2_jwt.token_prefix,
        issuer: profile.verification.oauth2_jwt.issuer,
        audience: profile.verification.oauth2_jwt.audience,
        jwks_url: profile.verification.oauth2_jwt.jwks_url,
        secret: profile.verification.oauth2_jwt.secret,
        max_skew_sec: Number(profile.verification.oauth2_jwt.max_skew_sec || 300),
        max_age_sec: Number(profile.verification.oauth2_jwt.max_age_sec || 0) || null
      }
    },
    idempotency: { ...profile.idempotency },
    outbound: {
      base_url: profile.outbound.base_url,
      path_prefix: profile.outbound.path_prefix,
      auth_mode: profile.outbound.auth_mode,
      auth: { ...profile.outbound.auth },
      default_headers: normalizeJson(profile.outbound.default_headers_text) || {},
      timeout_ms: Number(profile.outbound.timeout_ms || 8000),
      retry_policy: profile.outbound.retry_policy,
      healthcheck_path: profile.outbound.healthcheck_path,
      test_request_method: profile.outbound.test_request_method
    },
    routing: {
      channel: profile.routing.channel,
      protocol: profile.routing.protocol,
      provider_code: profile.routing.provider_code,
      health_status: profile.routing.health_status || "healthy",
      provider_available: profile.routing.provider_available === true,
      health_mode: profile.routing.health_mode || profile.identity.environment,
      health_checked_at: profile.routing.health_checked_at || "",
      last_successful_test_at: profile.routing.last_successful_test_at || "",
      health_error: profile.routing.health_error || "",
      apple_pay_domain_status: profile.routing.apple_pay_domain_status || "",
      domain_validation_status: profile.routing.domain_validation_status || "",
      supported_payment_methods: supportedPaymentMethods,
      supported_message_types: normalizeList(profile.routing.supported_message_types_text),
      payment_provider: paymentProviderMetadata || null,
      schema_version: profile.routing.schema_version,
      envelope_profile: profile.routing.envelope_profile,
      mapping_mode: profile.routing.mapping_mode,
      mapping_rules: normalizeJson(profile.routing.mapping_rules_text)
    },
    public_storefront: {
      ...profile.public_storefront,
      apple_pay_domain_status:
        profile.public_storefront.apple_pay_domain_status ||
        profile.routing.apple_pay_domain_status ||
        ""
    },
    audit: {
      audit_record_type: profile.audit.audit_record_type,
      redaction_policy: normalizeJson(profile.audit.redaction_policy_text),
      max_body_size: Number(profile.audit.max_body_size || 262144),
      ip_allowlist: normalizeList(profile.audit.ip_allowlist_text),
      log_level: profile.audit.log_level
    }
  };
}

function apiErrorPayload(err) {
  const message = err?.message || "";
  const match = message.match(/API \d+: (.*)$/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
  return err?.payload && typeof err.payload === "object" ? err.payload : null;
}

function friendlyError(err, fallback) {
  const message = err?.message || "";
  const payload = apiErrorPayload(err);
  if (payload) {
    try {
      const code = payload?.error;
      const map = {
        STEP_UP_REQUIRED: "Step-up required. Verify using OTP/TOTP/passkey, then try again.",
        FORBIDDEN: "You do not have permission for this action.",
        TENANT_NOT_FOUND: "Tenant not found.",
        CONNECTION_NOT_FOUND: "Connection not found.",
        DUPLICATE_SUFFIX: "Inbound path suffix already in use.",
        VALIDATION_ERROR: "Validation failed. Review required fields.",
        OAUTH_TOKEN_FAILED: "PayPal rejected the credentials. Verify the Client ID, Client Secret, and sandbox/production mode.",
        OAUTH_TOKEN_MISSING: "PayPal authenticated but did not return an access token.",
        OAUTH_CLIENT_CONFIG_REQUIRED: "PayPal Client ID, Client Secret, or token URL is missing.",
        OAUTH_CLIENT_ID_INVALID: "Enter the PayPal REST app Client ID, not the sandbox account email.",
        ORIGIN_NOT_ALLOWED: "Origin not allowed for this connection."
      };
      return map[code] || code || fallback;
    } catch { return message; }
  }
  return message || fallback;
}

export default function AdminConnectionsPanelSafe() {
  const [items, setItems] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [connections, setConnections] = useState([buildProfile("conn-1")]);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [activeStep, setActiveStep] = useState("identity");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [validationSummary, setValidationSummary] = useState([]);
  const [rawKey, setRawKey] = useState(null);
  const [rawKeyMeta, setRawKeyMeta] = useState(null);
  const [miniModalRequest, setMiniModalRequest] = useState(null);

  const selectedTenant = items.find((item) => item.id === selectedTenantId) || detail?.tenant || null;
  const selectedConnection = connections.find((item) => item.id === selectedConnectionId) || connections[0] || null;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
  const inboundUrls = selectedConnection?.inbound?.inbound_path_suffix
    ? {
        storefront: `${apiBaseUrl}/api/public/commerce/${selectedConnection.inbound.inbound_path_suffix}`,
        public: `${apiBaseUrl}/api/public/gateway/intake/${selectedConnection.inbound.inbound_path_suffix}`,
        edi: `${apiBaseUrl}/api/edi/gateway/webhook/${selectedConnection.inbound.inbound_path_suffix}`
      }
    : null;
  const selectedFieldError = (path) => (
    selectedConnection ? fieldErrors[`${selectedConnection.id}:${path}`] || "" : ""
  );

  const visibleSteps = useMemo(() => {
    const base = [
      { id: "identity", label: "Identity" },
      { id: "inbound", label: "Inbound" },
      { id: "verification", label: "Security" },
      { id: "idempotency", label: "Idempotency" },
      { id: "routing", label: "Routing" },
      { id: "storefront", label: "Storefront" },
      { id: "audit", label: "Audit" }
    ];
    if (selectedConnection?.identity?.direction !== "inbound") {
      base.splice(2, 0, { id: "outbound", label: "Outbound" });
    }
    return base;
  }, [selectedConnection?.identity?.direction]);

  useEffect(() => {
    let active = true;
    async function loadTenants() {
      try {
        setLoading(true);
        const list = await apiFetch("/api/eip/gateway/connections");
        if (!active) return;
        setItems(list.items || []);
        if (!selectedTenantId && list.items?.length) setSelectedTenantId(list.items[0].id);
      } catch (err) {
        if (active) setError(friendlyError(err, "Failed to load tenants"));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadTenants();
    return () => { active = false; };
  }, [selectedTenantId]);

  useEffect(() => {
    let active = true;
    async function loadDetail() {
      if (!selectedTenantId) return;
      try {
        setLoading(true);
        const result = await apiFetch(`/api/eip/gateway/connections/${selectedTenantId}`);
        if (!active) return;
        setDetail(result);
        const list = Array.isArray(result.connections) && result.connections.length ? result.connections.map(fromApiProfile) : [buildProfile("conn-1")];
        setConnections(list);
        setSelectedConnectionId(list[0]?.id || null);
        setFieldErrors({});
        setValidationSummary([]);
        setRawKey(null);
        setRawKeyMeta(null);
      } catch (err) {
        if (active) setError(friendlyError(err, "Failed to load tenant profile"));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadDetail();
    return () => { active = false; };
  }, [selectedTenantId]);

  const refreshDetail = async ({ clearRaw = false } = {}) => {
    if (!selectedTenantId) return null;
    const result = await apiFetch(`/api/eip/gateway/connections/${selectedTenantId}`);
    setDetail(result);
    if (clearRaw) {
      setRawKey(null);
      setRawKeyMeta(null);
    }
    return result;
  };

  const requestConfirm = ({ title, message, confirmLabel = "Confirm", confirmTone = "default" }) => new Promise((resolve) => {
    setMiniModalRequest({ title, message, confirmLabel, confirmTone, resolve });
  });

  const closeMiniModal = (confirmed) => {
    if (miniModalRequest?.resolve) miniModalRequest.resolve(Boolean(confirmed));
    setMiniModalRequest(null);
  };

  const clearValidationPaths = (connectionId, paths = []) => {
    if (!connectionId || !paths.length) return;
    setFieldErrors((current) => {
      const next = { ...current };
      paths.forEach((path) => delete next[`${connectionId}:${path}`]);
      return next;
    });
    setValidationSummary((current) => current.filter(
      (item) => item.connectionId !== connectionId || !paths.includes(item.path)
    ));
  };

  const updateSection = (section, patch) => {
    if (!selectedConnection) return;
    clearValidationPaths(
      selectedConnection.id,
      Object.keys(patch || {}).map((key) => `${section}.${key}`)
    );
    setConnections((prev) => prev.map((item) => item.id === selectedConnection.id ? { ...item, [section]: { ...item[section], ...patch } } : item));
  };

  const updateNested = (section, key, patch) => {
    if (!selectedConnection) return;
    clearValidationPaths(
      selectedConnection.id,
      Object.keys(patch || {}).map((field) => `${section}.${key}.${field}`)
    );
    setConnections((prev) => prev.map((item) => item.id === selectedConnection.id ? { ...item, [section]: { ...item[section], [key]: { ...item[section][key], ...patch } } } : item));
  };

  useEffect(() => {
    if (!selectedConnection) return;
    const kind = selectedConnection.identity?.connection_kind;
    const map = {
      website: "website_intake",
      ecommerce: "website_intake",
      edi: "edi",
      banking: "banking",
      payments: "payments",
      paypal: "payments",
      checkout_com: "payments",
      social: "social",
      email: "email"
    };
    const providerCode = kind === "paypal" ? "paypal" : kind === "checkout_com" ? "checkout_com" : "";
    const setup = PAYMENT_PROVIDER_SETUP[kind];
    const targetChannel = map[kind];
    const patch = {};
    if (targetChannel && selectedConnection.routing?.channel !== targetChannel) patch.channel = targetChannel;
    if (providerCode && selectedConnection.routing?.provider_code !== providerCode) patch.provider_code = providerCode;
    if (providerCode && selectedConnection.routing?.protocol !== providerCode) patch.protocol = providerCode;
    if (setup && !selectedConnection.routing?.supported_message_types_text) {
      patch.supported_message_types_text = setup.supportedMethods.join("\n");
    }
    if (setup && !selectedConnection.routing?.supported_payment_methods_text) {
      patch.supported_payment_methods_text = setup.supportedMethods.join("\n");
    }
    if (setup) {
      patch.payment_provider = {
        ...(selectedConnection.routing?.payment_provider || {}),
        code: setup.providerCode,
        label: selectedConnection.identity?.connection_name || setup.displayName,
        enabled: selectedConnection.identity?.is_enabled !== false,
        visible: true,
        adapter_code: setup.providerCode,
        methods: setup.supportedMethods.map((method, index) => ({
          code: method,
          label: method.replace(/_/g, " "),
          enabled: method !== "GOOGLE_PAY" || selectedConnection.public_storefront?.google_pay_enabled === true,
          visible: true,
          priority: (index + 1) * 10
        }))
      };
    }
    if (Object.keys(patch).length) updateSection("routing", patch);
    if (setup) {
      const identityPatch = {};
      if (selectedConnection.identity?.direction !== "outbound") identityPatch.direction = "outbound";
      if (selectedConnection.identity?.environment !== "sandbox") identityPatch.environment = "sandbox";
      if (Object.keys(identityPatch).length) updateSection("identity", identityPatch);

      const outboundPatch = {};
      if (!selectedConnection.outbound?.base_url) {
        outboundPatch.base_url = paymentEnvironmentValue(setup, "sandbox", "baseUrls");
      }
      if (!selectedConnection.outbound?.path_prefix) outboundPatch.path_prefix = "/";
      if (selectedConnection.outbound?.auth_mode !== setup.authMode) outboundPatch.auth_mode = setup.authMode;
      if (!selectedConnection.outbound?.healthcheck_path || selectedConnection.outbound.healthcheck_path === "/health") {
        outboundPatch.healthcheck_path = setup.healthcheckPath;
      }
      if (Object.keys(outboundPatch).length) updateSection("outbound", outboundPatch);

      const authPatch = {};
      if (setup.authHeader && !selectedConnection.outbound?.auth?.header_name) authPatch.header_name = setup.authHeader;
      if (setup.tokenUrls && !selectedConnection.outbound?.auth?.token_url) {
        authPatch.token_url = paymentEnvironmentValue(setup, "sandbox", "tokenUrls");
      }
      if (setup.clientAuthMethod && selectedConnection.outbound?.auth?.client_auth_method !== setup.clientAuthMethod) {
        authPatch.client_auth_method = setup.clientAuthMethod;
      }
      if (Object.keys(authPatch).length) updateNested("outbound", "auth", authPatch);

      const hmacPatch = {};
      if (!selectedConnection.verification?.hmac_signature?.header_name) hmacPatch.header_name = setup.signatureHeader;
      if (!selectedConnection.verification?.hmac_signature?.timestamp_header) hmacPatch.timestamp_header = setup.timestampHeader;
      if (Object.keys(hmacPatch).length) updateNested("verification", "hmac_signature", hmacPatch);
      if (selectedConnection.verification?.mode === "none") {
        updateSection("verification", { mode: "hmac_signature", allow_unverified: false });
      }

      const idempotencyPatch = {};
      if (selectedConnection.idempotency?.event_id_location !== "header") idempotencyPatch.event_id_location = "header";
      if (!selectedConnection.idempotency?.event_id_key || selectedConnection.idempotency.event_id_key === "X-Event-Id") {
        idempotencyPatch.event_id_key = setup.eventIdKey;
      }
      if (Object.keys(idempotencyPatch).length) updateSection("idempotency", idempotencyPatch);

      updateSection("public_storefront", {
        scan_allowed: false,
        loader_enabled: false,
        public_api_enabled: false,
        google_pay_enabled: selectedConnection.public_storefront?.google_pay_enabled === true,
        apple_pay_domain_status:
          selectedConnection.public_storefront?.apple_pay_domain_status ||
          selectedConnection.routing?.apple_pay_domain_status ||
          ""
      });
    }
  }, [selectedConnection?.identity?.connection_kind]);

  useEffect(() => {
    if (!selectedConnection) return;
    const setup = PAYMENT_PROVIDER_SETUP[selectedConnection.identity?.connection_kind];
    if (!setup) return;
    const environment = selectedConnection.identity?.environment === "production" ? "production" : "sandbox";
    const knownBaseUrls = Object.values(setup.baseUrls || {});
    const nextBaseUrl = paymentEnvironmentValue(setup, environment, "baseUrls");
    if (!selectedConnection.outbound?.base_url || knownBaseUrls.includes(selectedConnection.outbound.base_url)) {
      if (nextBaseUrl && selectedConnection.outbound.base_url !== nextBaseUrl) {
        updateSection("outbound", { base_url: nextBaseUrl });
      }
    }
    const knownTokenUrls = Object.values(setup.tokenUrls || {});
    const nextTokenUrl = paymentEnvironmentValue(setup, environment, "tokenUrls");
    if (
      nextTokenUrl &&
      (!selectedConnection.outbound?.auth?.token_url || knownTokenUrls.includes(selectedConnection.outbound.auth.token_url)) &&
      selectedConnection.outbound.auth.token_url !== nextTokenUrl
    ) {
      updateNested("outbound", "auth", { token_url: nextTokenUrl });
    }
  }, [selectedConnection?.identity?.connection_kind, selectedConnection?.identity?.environment]);

  const buildUniqueCode = (name, currentId, avoidCode = null) => {
    const base = slugifyCode(name);
    const exists = (code) => connections.some((conn) => conn.id !== currentId && conn.identity?.connection_code === code);
    let candidate = base;
    let idx = 2;
    if (avoidCode && candidate === avoidCode) candidate = `${base}-${idx++}`;
    while (exists(candidate) || (avoidCode && candidate === avoidCode)) candidate = `${base}-${idx++}`;
    return candidate;
  };

  const handleConnectionNameChange = (event) => {
    if (!selectedConnection) return;
    const nextName = event.target.value;
    clearValidationPaths(selectedConnection.id, ["identity.connection_name", "identity.connection_code"]);
    setConnections((prev) => prev.map((item) => {
      if (item.id !== selectedConnection.id) return item;
      const connectionCode = nextName ? item.identity.connection_code || buildUniqueCode(nextName, item.id) : "";
      const paymentConnection = Boolean(PAYMENT_PROVIDER_SETUP[item.identity.connection_kind]);
      return {
        ...item,
        identity: {
          ...item.identity,
          connection_name: nextName,
          connection_code: connectionCode
        },
        routing: paymentConnection
          ? {
              ...item.routing,
              payment_provider: {
                ...(item.routing.payment_provider || {}),
                label: nextName || PAYMENT_PROVIDER_SETUP[item.identity.connection_kind].displayName
              }
            }
          : item.routing
      };
    }));
  };

  const handleConnectionKindChange = (event) => {
    if (!selectedConnection) return;
    const nextKind = event.target.value;
    const changedProvider = nextKind !== selectedConnection.identity?.connection_kind;
    updateSection("identity", { connection_kind: nextKind });
    if (changedProvider && PAYMENT_PROVIDER_SETUP[nextKind]) {
      updateSection("routing", {
        health_status: "pending",
        provider_available: false,
        health_mode: selectedConnection.identity?.environment || "sandbox",
        health_checked_at: "",
        last_successful_test_at: "",
        health_error: ""
      });
    }
  };

  const handleAddConnection = () => {
    const next = buildProfile(`conn-${Date.now()}`);
    setConnections((prev) => [...prev, next]);
    setSelectedConnectionId(next.id);
    setActiveStep("identity");
  };

  const handleRemoveConnection = (id) => {
    setConnections((prev) => prev.filter((item) => item.id !== id));
    setFieldErrors((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => !key.startsWith(`${id}:`))
    ));
    setValidationSummary((current) => current.filter((item) => item.connectionId !== id));
    if (selectedConnectionId === id) setSelectedConnectionId(connections[0]?.id || null);
  };

  const handleSaveProfile = async () => {
    if (!selectedTenantId) return;
    setSaving(true);
    setError(null);
    try {
      const validations = validateGatewayConnections(connections);
      if (validations.length) {
        setFieldErrors(fieldErrorMap(validations));
        setValidationSummary(validations);
        setSelectedConnectionId(validations[0].connectionId);
        setActiveStep(validations[0].step || "identity");
        return;
      }
      setFieldErrors({});
      setValidationSummary([]);
      const result = await apiFetch(`/api/eip/gateway/connections/${selectedTenantId}/profile`, {
        method: "POST",
        body: { connections: connections.map(toApiProfile) }
      });
      const list = Array.isArray(result.connections) && result.connections.length ? result.connections.map(fromApiProfile) : [buildProfile("conn-1")];
      setConnections(list);
      setSelectedConnectionId(list[0]?.id || null);
      setRawKey(null);
      setRawKeyMeta(null);
      await refreshDetail({ clearRaw: true });
    } catch (err) {
      const payload = apiErrorPayload(err);
      if (payload?.error === "VALIDATION_ERROR" && Array.isArray(payload.details)) {
        const serverErrors = gatewayServerValidationErrors(payload.details, selectedConnection?.id);
        setFieldErrors(fieldErrorMap(serverErrors));
        setValidationSummary(serverErrors);
        setSelectedConnectionId(serverErrors[0]?.connectionId || selectedConnection?.id || null);
        setActiveStep(serverErrors[0]?.step || "identity");
      } else {
        setError(friendlyError(err, "Failed to save profile"));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCreateKey = async () => {
    if (!selectedTenantId) return;
    setError(null);
    try {
      const result = await apiFetch(`/api/eip/gateway/connections/${selectedTenantId}/api-keys`, {
        method: "POST",
        body: { label: "plug-play", set_primary: true }
      });
      setRawKey(result.raw_key || null);
      setRawKeyMeta({ action: "created", id: result.api_key?.id || null, label: result.api_key?.label || "plug-play" });
      await refreshDetail({ clearRaw: false });
    } catch (err) {
      setError(friendlyError(err, "Failed to create API key"));
    }
  };

  const handleRotateKey = async (keyId) => {
    if (!selectedTenantId || !keyId) return;
    const confirmed = await requestConfirm({ title: "Rotate API key", message: "Rotate this API key? The old key will be revoked.", confirmLabel: "Rotate", confirmTone: "danger" });
    if (!confirmed) return;
    setError(null);
    try {
      const result = await apiFetch(`/api/eip/gateway/connections/${selectedTenantId}/api-keys/${keyId}/rotate`, {
        method: "POST",
        body: { label: "plug-play" }
      });
      setRawKey(result.raw_key || null);
      setRawKeyMeta({ action: "rotated", id: result.api_key?.id || null, label: result.api_key?.label || "plug-play" });
      await refreshDetail({ clearRaw: false });
    } catch (err) {
      setError(friendlyError(err, "Failed to rotate API key"));
    }
  };

  const handleRevokeKey = async (keyId) => {
    if (!selectedTenantId || !keyId) return;
    const confirmed = await requestConfirm({ title: "Revoke API key", message: "Revoke this API key? This cannot be undone.", confirmLabel: "Revoke", confirmTone: "danger" });
    if (!confirmed) return;
    setError(null);
    try {
      await apiFetch(`/api/eip/gateway/connections/${selectedTenantId}/api-keys/${keyId}/revoke`, { method: "POST" });
      setRawKey(null);
      setRawKeyMeta(null);
      await refreshDetail({ clearRaw: true });
    } catch (err) {
      setError(friendlyError(err, "Failed to revoke API key"));
    }
  };

  const handleClearConnectionSecret = async (secretKind, label) => {
    const connectionCode = selectedConnection?.identity?.connection_code;
    if (!selectedTenantId || !connectionCode || !secretKind) return;
    const confirmed = await requestConfirm({
      title: `Clear ${label || "secret"}`,
      message: "Clear this stored secret? The connection may stop working immediately. Empty fields never clear secrets.",
      confirmLabel: "Clear secret",
      confirmTone: "danger"
    });
    if (!confirmed) return;
    setError(null);
    try {
      const result = await apiFetch(
        `/api/eip/gateway/connections/${selectedTenantId}/profile/${encodeURIComponent(connectionCode)}/secrets/revoke`,
        { method: "POST", body: { secret_kind: secretKind } }
      );
      const list = Array.isArray(result.connections) ? result.connections.map(fromApiProfile) : [];
      if (list.length) setConnections(list);
      await refreshDetail({ clearRaw: true });
    } catch (err) {
      setError(friendlyError(err, "Failed to clear stored secret"));
    }
  };

  const handleCopyRawKey = async () => {
    if (!rawKey) return;
    try {
      await navigator.clipboard?.writeText?.(rawKey);
      setRawKeyMeta((prev) => ({ ...(prev || {}), copied: true }));
    } catch {
      setError("Could not copy the API key automatically. Select and copy it manually now.");
    }
  };

  const handleTest = async (type) => {
    if (!selectedTenantId || !selectedConnection) return;
    const validationErrors = validateGatewayConnections([selectedConnection]);
    if (validationErrors.length) {
      setFieldErrors(fieldErrorMap(validationErrors));
      setValidationSummary(validationErrors);
      setActiveStep(validationErrors[0].step || "identity");
      setError(null);
      return;
    }
    setTesting(type);
    setError(null);
    setTestResult(null);
    try {
      const result = await apiFetch(`/api/eip/gateway/connections/${selectedTenantId}/test/${type}`, {
        method: "POST",
        body: { connection_code: selectedConnection.identity.connection_code }
      });
      if (type === "outbound" && result.connection) {
        const persisted = fromApiProfile(result.connection);
        setConnections((current) => current.map((item) =>
          item.identity?.connection_code === persisted.identity?.connection_code ? persisted : item
        ));
      }
      setTestResult({ tone: result.ok ? "success" : "error", text: `${type === "outbound" ? "Outbound" : "Inbound"} test ${result.ok ? "passed" : "failed"} (HTTP ${result.status}).` });
    } catch (err) {
      if (type === "outbound" && err?.payload?.connection) {
        const persisted = fromApiProfile(err.payload.connection);
        setConnections((current) => current.map((item) =>
          item.identity?.connection_code === persisted.identity?.connection_code ? persisted : item
        ));
      }
      setError(friendlyError(err, "Failed to test connection"));
    } finally {
      setTesting(null);
    }
  };

  const apiKeys = detail?.api_keys || [];
  const selectedStorefrontDiagnostic = detail?.storefront_diagnostics?.connections?.find(
    (item) => item.connection_code === selectedConnection?.identity?.connection_code
  ) || null;
  const mappingStudioHref = selectedConnection?.identity?.connection_code
    ? `?surface=dashboard&module=content&storefront_connection=${encodeURIComponent(selectedConnection.identity.connection_code)}`
    : "?surface=dashboard&module=content";
  const paymentSetup = PAYMENT_PROVIDER_SETUP[selectedConnection?.identity?.connection_kind] || null;
  const paymentAuth = selectedConnection?.outbound?.auth || {};
  const paymentHmac = selectedConnection?.verification?.hmac_signature || {};
  const paymentChecks = paymentSetup ? [
    {
      label: selectedConnection.identity.connection_kind === "paypal" ? "Client ID reference" : "Secret key reference",
      ok: selectedConnection.identity.connection_kind === "paypal"
        ? Boolean(paymentAuth.client_id)
        : hasStoredSecret(paymentAuth, "secret")
    },
    ...(selectedConnection.identity.connection_kind === "paypal"
      ? [{ label: "Client secret reference", ok: hasStoredSecret(paymentAuth, "client_secret") }]
      : []),
    {
      label: "Health status",
      ok: ["healthy", "configured", "ready"].includes(String(selectedConnection.routing?.health_status || "").toLowerCase())
    },
    {
      label: "Supported methods",
      ok: paymentSetup.supportedMethods.every((method) =>
        normalizeList(selectedConnection.routing?.supported_message_types_text).map((item) => item.toUpperCase()).includes(method)
      )
    }
  ] : [];
  if (paymentSetup?.providerCode === "paypal") {
    paymentChecks.push(
      { label: "Webhook ID (optional)", ok: Boolean(paymentHmac.webhook_id_ref), optional: true },
      { label: "Webhook signing (optional)", ok: hasStoredSecret(paymentHmac, "secret"), optional: true }
    );
  }
  if (paymentSetup?.providerCode === "checkout_com") {
    paymentChecks.push(
      { label: "Webhook signing (optional)", ok: hasStoredSecret(paymentHmac, "secret"), optional: true },
      {
        label: "Apple Pay domain",
        ok: ["validated", "verified", "active", "configured", "ready"].includes(
          String(selectedConnection.routing?.apple_pay_domain_status || "").toLowerCase()
        )
      },
      { label: "Google Pay metadata", ok: selectedConnection.public_storefront?.google_pay_enabled === true }
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <datalist id="payment-provider-codes">
        <option value="paypal" />
        <option value="checkout_com" />
      </datalist>
      <div className="glass-panel rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-ink-900">Tenants</h3>
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedTenantId(item.id)}
              className={`w-full rounded-2xl border px-3 py-3 text-left text-sm ${item.id === selectedTenantId ? "border-ink-900/10 bg-white shadow-soft" : "border-white/60 bg-white/70 text-ink-500 hover:bg-white"}`}
            >
              <p className="font-semibold text-ink-900">{item.name}</p>
              <p className="text-xs uppercase tracking-[0.25em] text-ink-400">{item.code}</p>
              <p className="mt-2 text-xs text-ink-500">{item.connection_count || 0} connection{item.connection_count === 1 ? "" : "s"}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Gateway Connection Profiles</p>
              <h3 className="text-base font-semibold text-ink-900">{selectedTenant?.name || "Select tenant"}</h3>
              <p className="text-xs text-ink-500">{selectedTenant?.code}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => refreshDetail({ clearRaw: true })} className="rounded-full border border-ink-200/70 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-600">
                <RefreshCw className="mr-1 inline h-4 w-4" />Refresh
              </button>
              <button type="button" onClick={handleAddConnection} className="rounded-full border border-ink-200/70 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-600">
                <Plus className="mr-1 inline h-4 w-4" />Add
              </button>
              <button type="button" onClick={handleSaveProfile} disabled={saving || !selectedTenantId} className="rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-glow disabled:opacity-60">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {loading ? <Notice>Loading...</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
          {validationSummary.length ? (
            <Notice tone="error">
              <p className="font-semibold">Validation failed. Review these fields:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {validationSummary.map((item, index) => {
                  const connection = connections.find((entry) => entry.id === item.connectionId);
                  return (
                    <li key={`${item.connectionId}:${item.path}:${index}`}>
                      {connections.length > 1 ? `${connection?.identity?.connection_name || "Connection"}: ` : ""}
                      {item.label}
                    </li>
                  );
                })}
              </ul>
            </Notice>
          ) : null}
          {testResult ? <Notice tone={testResult.tone}>{testResult.text}</Notice> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {connections.map((conn) => (
              <button key={conn.id} type="button" onClick={() => setSelectedConnectionId(conn.id)} className={`rounded-xl border px-3 py-2 text-left text-[0.7rem] ${validationSummary.some((item) => item.connectionId === conn.id) ? "border-rose-300 bg-rose-50/70" : conn.id === selectedConnection?.id ? "border-ink-900/10 bg-white shadow-soft" : "border-white/60 bg-white/70 text-ink-500"}`}>
                <p className="font-semibold text-ink-900">{conn.identity.connection_name || "New connection"}</p>
                <p className="uppercase tracking-[0.2em] text-ink-400">{conn.identity.connection_code || "auto-generated"}</p>
                <p className="mt-1 text-[0.6rem] uppercase tracking-[0.2em] text-ink-400">{conn.identity.connection_kind || "custom"}</p>
              </button>
            ))}
          </div>
          {!connections.some(isPaymentConnection) ? (
            <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-800">
              No payment provider connection configured. Add PayPal or Checkout.com in Admin Console → Gateway Connection Profiles.
            </div>
          ) : null}
        </div>

        {selectedConnection ? (
          <div className="glass-panel rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Connection</p>
                <h3 className="text-base font-semibold text-ink-900">{selectedConnection.identity.connection_name || "Untitled"}</h3>
                <p className="text-xs text-ink-500">{selectedConnection.identity.connection_code || "auto-generated"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => handleRemoveConnection(selectedConnection.id)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[0.6rem] uppercase tracking-[0.2em] text-rose-500"><Trash2 className="mr-1 inline h-3 w-3" />Remove</button>
                {!paymentSetup || selectedConnection.inbound.webhook_enabled === true ? <button type="button" onClick={() => handleTest("inbound")} disabled={Boolean(testing)} className="rounded-full border border-ink-200/70 bg-white px-3 py-2 text-[0.6rem] uppercase tracking-[0.2em] text-ink-600">{testing === "inbound" ? "Testing..." : "Test inbound"}</button> : null}
                {selectedConnection.identity.direction !== "inbound" ? <button type="button" onClick={() => handleTest("outbound")} disabled={Boolean(testing)} className="rounded-full border border-ink-200/70 bg-white px-3 py-2 text-[0.6rem] uppercase tracking-[0.2em] text-ink-600">{testing === "outbound" ? "Testing..." : "Test outbound"}</button> : null}
              </div>
            </div>

            {paymentSetup ? (
              <div className="mt-4 rounded-xl border border-ink-100 bg-white/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-400">{paymentSetup.title}</p>
                    <p className="mt-1 text-xs text-ink-500">Complete provider setup in the existing tabs below. Raw secret values are never displayed after save.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {paymentChecks.map((check) => (
                      <StatusPill key={check.label} ok={check.optional || check.ok}>{check.label}: {check.ok ? "ready" : check.optional ? "not configured" : "missing"}</StatusPill>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {visibleSteps.map((step) => <TabButton key={step.id} active={activeStep === step.id} onClick={() => setActiveStep(step.id)}>{step.label}</TabButton>)}
            </div>

            {activeStep === "identity" ? (
              <Grid>
                <Field label={paymentSetup ? "Provider name" : "Connection name"} error={selectedFieldError("identity.connection_name")}><input value={selectedConnection.identity.connection_name} onChange={handleConnectionNameChange} placeholder={paymentSetup?.displayName || ""} className={inputClass} /></Field>
                <Field label="Connection code" error={selectedFieldError("identity.connection_code")}><input value={selectedConnection.identity.connection_code} readOnly placeholder="auto-generated" className={`${inputClass} bg-slate-50 text-ink-600`} /></Field>
                <Field label="Connection kind" error={selectedFieldError("identity.connection_kind")}><select value={selectedConnection.identity.connection_kind} onChange={handleConnectionKindChange} className={inputClass}>{KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                <Field label="Direction" error={selectedFieldError("identity.direction")}>
                  {paymentSetup
                    ? <input readOnly value="outbound" className={`${inputClass} bg-slate-50 text-ink-600`} />
                    : <select value={selectedConnection.identity.direction} onChange={(e) => updateSection("identity", { direction: e.target.value })} className={inputClass}>{DIRECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}
                </Field>
                <Field label={paymentSetup ? "Provider mode" : "Environment"} error={selectedFieldError("identity.environment")}><select value={selectedConnection.identity.environment} onChange={(e) => updateSection("identity", { environment: e.target.value })} className={inputClass}>{ENV_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                {!paymentSetup ? <Field label="Frontend URL" error={selectedFieldError("identity.frontend_url")}><input value={selectedConnection.identity.frontend_url} onChange={(e) => { updateSection("identity", { frontend_url: e.target.value }); if (!selectedConnection.inbound.origin_allowlist_text) updateSection("inbound", { origin_allowlist_text: e.target.value }); }} placeholder="https://storefront.example.com" className={inputClass} /></Field> : null}
                {!paymentSetup ? <Field label="Portal URL"><input value={selectedConnection.identity.portal_url} onChange={(e) => updateSection("identity", { portal_url: e.target.value })} className={inputClass} /></Field> : null}
                <label className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400"><input type="checkbox" checked={selectedConnection.identity.is_enabled} onChange={(e) => updateSection("identity", { is_enabled: e.target.checked })} />Enabled</label>
              </Grid>
            ) : null}

            {activeStep === "inbound" ? (
              <div className="mt-4 space-y-4">
                <Grid>
                  <Field label={paymentSetup ? "Webhook path suffix" : "Path suffix"} error={selectedFieldError("inbound.inbound_path_suffix")}><input value={selectedConnection.inbound.inbound_path_suffix} onChange={(e) => updateSection("inbound", { inbound_path_suffix: e.target.value })} placeholder={paymentSetup ? "Optional until webhook is enabled" : "tenant-storefront"} className={inputClass} /></Field>
                  <Field label="HTTP method"><select value={selectedConnection.inbound.http_method} onChange={(e) => updateSection("inbound", { http_method: e.target.value })} className={inputClass}>{HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
                  <Field label="Expected content type"><input value={selectedConnection.inbound.expected_content_type} onChange={(e) => updateSection("inbound", { expected_content_type: e.target.value })} className={inputClass} /></Field>
                  <Field label="Rate limit max"><input type="number" value={selectedConnection.inbound.rate_limit_max} onChange={(e) => updateSection("inbound", { rate_limit_max: e.target.value })} className={inputClass} /></Field>
                  <Field label="Rate limit window sec"><input type="number" value={selectedConnection.inbound.rate_limit_window_sec} onChange={(e) => updateSection("inbound", { rate_limit_window_sec: e.target.value })} className={inputClass} /></Field>
                </Grid>
                <Field label="Origin allowlist" error={selectedFieldError("inbound.origin_allowlist_text")}><textarea value={selectedConnection.inbound.origin_allowlist_text} onChange={(e) => updateSection("inbound", { origin_allowlist_text: e.target.value })} placeholder="https://storefront.example.com" className={`${inputClass} min-h-[80px]`} /></Field>
                {inboundUrls ? <EndpointGrid urls={inboundUrls} /> : null}
              </div>
            ) : null}

            {activeStep === "verification" ? (
              <div className="mt-4 space-y-4">
                {paymentSetup ? (
                  <Grid>
                    <label className="flex items-center gap-2 rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <input type="checkbox" checked={selectedConnection.inbound.webhook_enabled === true} onChange={(event) => { updateSection("inbound", { webhook_enabled: event.target.checked }); if (!event.target.checked) clearValidationPaths(selectedConnection.id, ["inbound.inbound_path_suffix"]); }} />
                      Enable inbound webhook
                    </label>
                    {paymentSetup.providerCode === "paypal" ? (
                      <Field label="Webhook ID / reference"><input value={selectedConnection.verification.hmac_signature.webhook_id_ref || ""} onChange={(event) => updateNested("verification", "hmac_signature", { webhook_id_ref: event.target.value })} placeholder="PayPal webhook ID reference" className={inputClass} /></Field>
                    ) : null}
                    <SecretField
                      label="Webhook signing secret reference"
                      value={selectedConnection.verification.hmac_signature.secret}
                      stored={selectedConnection.verification.hmac_signature.secret_set}
                      onChange={(value) => updateNested("verification", "hmac_signature", { secret: value })}
                      onClear={() => handleClearConnectionSecret("verification.hmac_signature.secret", "webhook signing secret")}
                    />
                    <Field label="Webhook signing status"><input readOnly value={hasStoredSecret(selectedConnection.verification.hmac_signature, "secret") ? "Stored securely" : "Missing"} className={`${inputClass} bg-slate-50 text-ink-600`} /></Field>
                    <Field label="Signature header"><input readOnly value={selectedConnection.verification.hmac_signature.header_name} className={`${inputClass} bg-slate-50 text-ink-600`} /></Field>
                  </Grid>
                ) : (
                  <>
                    <Grid>
                      <Field label="Verification mode" error={selectedFieldError("verification.mode")}><select value={selectedConnection.verification.mode} onChange={(e) => updateSection("verification", { mode: e.target.value })} className={inputClass}>{VERIFICATION_MODES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                      <label className="flex items-center gap-2 rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400"><input type="checkbox" checked={selectedConnection.verification.allow_unverified} onChange={(e) => updateSection("verification", { allow_unverified: e.target.checked })} />Allow unverified (sandbox only)</label>
                    </Grid>
                    {selectedConnection.verification.mode === "api_key" ? (
                      <Grid>
                        <Field label="API key header name" error={selectedFieldError("verification.api_key.header_name")}><input value={selectedConnection.verification.api_key.header_name} onChange={(e) => updateNested("verification", "api_key", { header_name: e.target.value })} placeholder="X-API-Key" className={inputClass} /></Field>
                        <SecretField label="API key secret" value={selectedConnection.verification.api_key.secret} stored={selectedConnection.verification.api_key.secret_set} onChange={(value) => updateNested("verification", "api_key", { secret: value })} onClear={() => handleClearConnectionSecret("verification.api_key.secret", "API key secret")} error={selectedFieldError("verification.api_key.secret")} />
                      </Grid>
                    ) : null}
                    {selectedConnection.verification.mode === "hmac_signature" ? (
                      <Grid>
                        <Field label="Signature header"><input value={selectedConnection.verification.hmac_signature.header_name} onChange={(e) => updateNested("verification", "hmac_signature", { header_name: e.target.value })} className={inputClass} /></Field>
                        <Field label="Timestamp header"><input value={selectedConnection.verification.hmac_signature.timestamp_header} onChange={(e) => updateNested("verification", "hmac_signature", { timestamp_header: e.target.value })} className={inputClass} /></Field>
                        <SecretField label="HMAC secret" value={selectedConnection.verification.hmac_signature.secret} stored={selectedConnection.verification.hmac_signature.secret_set} onChange={(value) => updateNested("verification", "hmac_signature", { secret: value })} onClear={() => handleClearConnectionSecret("verification.hmac_signature.secret", "HMAC secret")} />
                      </Grid>
                    ) : null}
                    {selectedConnection.verification.mode === "oauth2_jwt" ? (
                      <Grid>
                        <Field label="Header name"><input value={selectedConnection.verification.oauth2_jwt.header_name} onChange={(e) => updateNested("verification", "oauth2_jwt", { header_name: e.target.value })} className={inputClass} /></Field>
                        <Field label="Token prefix"><input value={selectedConnection.verification.oauth2_jwt.token_prefix} onChange={(e) => updateNested("verification", "oauth2_jwt", { token_prefix: e.target.value })} className={inputClass} /></Field>
                        <Field label="Issuer"><input value={selectedConnection.verification.oauth2_jwt.issuer} onChange={(e) => updateNested("verification", "oauth2_jwt", { issuer: e.target.value })} className={inputClass} /></Field>
                        <Field label="Audience"><input value={selectedConnection.verification.oauth2_jwt.audience} onChange={(e) => updateNested("verification", "oauth2_jwt", { audience: e.target.value })} className={inputClass} /></Field>
                        <Field label="JWKS URL"><input value={selectedConnection.verification.oauth2_jwt.jwks_url} onChange={(e) => updateNested("verification", "oauth2_jwt", { jwks_url: e.target.value })} className={inputClass} /></Field>
                        <SecretField label="Shared secret optional" value={selectedConnection.verification.oauth2_jwt.secret} stored={selectedConnection.verification.oauth2_jwt.secret_set} onChange={(value) => updateNested("verification", "oauth2_jwt", { secret: value })} onClear={() => handleClearConnectionSecret("verification.oauth2_jwt.secret", "JWT shared secret")} />
                      </Grid>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {activeStep === "outbound" ? (
              paymentSetup ? (
                <Grid>
                  <Field label={`${paymentSetup.displayName} API base mode`} error={selectedFieldError("identity.environment")}><select value={selectedConnection.identity.environment} onChange={(event) => updateSection("identity", { environment: event.target.value })} className={inputClass}>{ENV_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                  <Field label="API base URL" error={selectedFieldError("outbound.base_url")}><input readOnly value={selectedConnection.outbound.base_url} className={`${inputClass} bg-slate-50 text-ink-600`} /></Field>
                  <Field label="Path prefix" error={selectedFieldError("outbound.path_prefix")}><input value={selectedConnection.outbound.path_prefix} onChange={(event) => updateSection("outbound", { path_prefix: event.target.value })} className={inputClass} /></Field>
                  <Field label="Authentication mode" error={selectedFieldError("outbound.auth_mode")}><input readOnly value={selectedConnection.outbound.auth_mode} className={`${inputClass} bg-slate-50 text-ink-600`} /></Field>
                  {paymentSetup.providerCode === "paypal" ? (
                    <>
                      <Field label="Client ID reference / status" error={selectedFieldError("outbound.auth.client_id")}><input value={selectedConnection.outbound.auth.client_id} onChange={(event) => updateNested("outbound", "auth", { client_id: event.target.value })} placeholder="PayPal client ID reference" className={inputClass} /></Field>
                      <SecretField label="Client secret reference / status" value={selectedConnection.outbound.auth.client_secret} stored={selectedConnection.outbound.auth.client_secret_set} onChange={(value) => updateNested("outbound", "auth", { client_secret: value })} onClear={() => handleClearConnectionSecret("outbound.auth.client_secret", "client secret")} error={selectedFieldError("outbound.auth.client_secret")} />
                      <Field label="OAuth token URL"><input readOnly value={selectedConnection.outbound.auth.token_url} className={`${inputClass} bg-slate-50 text-ink-600`} /></Field>
                    </>
                  ) : (
                    <>
                      <SecretField label="Secret key reference / status" value={selectedConnection.outbound.auth.secret} stored={selectedConnection.outbound.auth.secret_set} onChange={(value) => updateNested("outbound", "auth", { secret: value })} onClear={() => handleClearConnectionSecret("outbound.auth.secret", "provider secret key")} error={selectedFieldError("outbound.auth.secret")} />
                      <Field label="Public key / safe reference"><input value={selectedConnection.outbound.auth.public_key_ref || ""} onChange={(event) => updateNested("outbound", "auth", { public_key_ref: event.target.value })} placeholder="Checkout.com public key reference" className={inputClass} /></Field>
                    </>
                  )}
                  <Field label="Healthcheck path"><input value={selectedConnection.outbound.healthcheck_path} onChange={(event) => updateSection("outbound", { healthcheck_path: event.target.value })} className={inputClass} /></Field>
                </Grid>
              ) : (
                <Grid>
                  <Field label="Base URL" error={selectedFieldError("outbound.base_url")}><input value={selectedConnection.outbound.base_url} onChange={(e) => updateSection("outbound", { base_url: e.target.value })} className={inputClass} /></Field>
                  <Field label="Path prefix"><input value={selectedConnection.outbound.path_prefix} onChange={(e) => updateSection("outbound", { path_prefix: e.target.value })} className={inputClass} /></Field>
                  <Field label="Auth mode"><input value={selectedConnection.outbound.auth_mode} onChange={(e) => updateSection("outbound", { auth_mode: e.target.value })} className={inputClass} /></Field>
                  <Field label="Healthcheck path"><input value={selectedConnection.outbound.healthcheck_path} onChange={(e) => updateSection("outbound", { healthcheck_path: e.target.value })} className={inputClass} /></Field>
                </Grid>
              )
            ) : null}

            {activeStep === "idempotency" ? (
              <Grid>
                <Field label="Event ID location" error={selectedFieldError("idempotency.event_id_location")}><input value={selectedConnection.idempotency.event_id_location} onChange={(e) => updateSection("idempotency", { event_id_location: e.target.value })} className={inputClass} /></Field>
                <Field label="Event ID key" error={selectedFieldError("idempotency.event_id_key")}><input value={selectedConnection.idempotency.event_id_key} onChange={(e) => updateSection("idempotency", { event_id_key: e.target.value })} className={inputClass} /></Field>
                <Field label="Idempotency scope"><input value={selectedConnection.idempotency.idempotency_scope} onChange={(e) => updateSection("idempotency", { idempotency_scope: e.target.value })} className={inputClass} /></Field>
              </Grid>
            ) : null}

            {activeStep === "routing" ? (
              paymentSetup ? (
                <Grid>
                  <Field label="Provider code"><input readOnly value={selectedConnection.routing.provider_code || paymentSetup.providerCode} className={`${inputClass} bg-slate-50 text-ink-600`} /></Field>
                  <Field label="Channel"><input readOnly value={selectedConnection.routing.channel || "payments"} className={`${inputClass} bg-slate-50 text-ink-600`} /></Field>
                  <Field label="Supported payment methods"><textarea readOnly value={selectedConnection.routing.supported_payment_methods_text || paymentSetup.supportedMethods.join("\n")} className={`${inputClass} min-h-[90px] bg-slate-50 text-ink-600`} /></Field>
                  <Field label="Health status"><input readOnly value={selectedConnection.routing.health_status || "pending"} className={`${inputClass} bg-slate-50 text-ink-600`} /></Field>
                </Grid>
              ) : (
                <Grid>
                  <Field label="Channel" error={selectedFieldError("routing.channel")}><select value={selectedConnection.routing.channel} onChange={(e) => updateSection("routing", { channel: e.target.value })} className={inputClass}>{CHANNEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="Protocol"><input value={selectedConnection.routing.protocol} onChange={(e) => updateSection("routing", { protocol: e.target.value })} className={inputClass} /></Field>
                  <Field label="Provider code"><input list="payment-provider-codes" value={selectedConnection.routing.provider_code || ""} onChange={(e) => updateSection("routing", { provider_code: e.target.value })} className={inputClass} /></Field>
                  <Field label="Health status"><select value={selectedConnection.routing.health_status || "pending"} onChange={(e) => updateSection("routing", { health_status: e.target.value })} className={inputClass}><option value="pending">Pending</option><option value="healthy">Healthy</option><option value="unknown">Unknown</option><option value="unhealthy">Unhealthy</option><option value="failed">Failed</option><option value="disabled">Disabled</option></select></Field>
                  <Field label="Schema version" error={selectedFieldError("routing.schema_version")}><input value={selectedConnection.routing.schema_version} onChange={(e) => updateSection("routing", { schema_version: e.target.value })} className={inputClass} /></Field>
                  <Field label="Envelope profile" error={selectedFieldError("routing.envelope_profile")}><input value={selectedConnection.routing.envelope_profile} onChange={(e) => updateSection("routing", { envelope_profile: e.target.value })} className={inputClass} /></Field>
                  <Field label="Mapping mode"><select value={selectedConnection.routing.mapping_mode} onChange={(e) => updateSection("routing", { mapping_mode: e.target.value })} className={inputClass}>{MAPPING_MODES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
                  <Field label="Supported message types"><textarea value={selectedConnection.routing.supported_message_types_text} onChange={(e) => updateSection("routing", { supported_message_types_text: e.target.value })} className={`${inputClass} min-h-[70px]`} /></Field>
                </Grid>
              )
            ) : null}

            {activeStep === "storefront" ? (
              paymentSetup?.providerCode === "checkout_com" ? (
                <Grid>
                  <Field label="Apple Pay domain validation status"><select value={selectedConnection.routing.apple_pay_domain_status || ""} onChange={(event) => { const status = event.target.value; updateSection("routing", { apple_pay_domain_status: status, domain_validation_status: status }); updateSection("public_storefront", { apple_pay_domain_status: status }); }} className={inputClass}><option value="">Missing</option><option value="pending">Pending</option><option value="validated">Validated</option><option value="failed">Failed</option></select></Field>
                  <label className="flex items-center gap-2 rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400"><input type="checkbox" checked={selectedConnection.public_storefront.google_pay_enabled === true} onChange={(event) => updateSection("public_storefront", { google_pay_enabled: event.target.checked })} />Google Pay enabled metadata</label>
                </Grid>
              ) : paymentSetup ? (
                <div className="mt-4 rounded-xl border border-dashed border-ink-200 bg-white/70 px-4 py-3 text-xs text-ink-500">
                  PayPal does not require additional storefront metadata. Configure credentials in Outbound and webhook trust in Security.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <Grid>
                    <label className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400"><input type="checkbox" checked={selectedConnection.public_storefront.scan_allowed} onChange={(e) => updateSection("public_storefront", { scan_allowed: e.target.checked })} />Scanner enabled</label>
                    <label className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400"><input type="checkbox" checked={selectedConnection.public_storefront.loader_enabled} onChange={(e) => updateSection("public_storefront", { loader_enabled: e.target.checked })} />Loader script enabled</label>
                    <label className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400"><input type="checkbox" checked={selectedConnection.public_storefront.public_api_enabled} onChange={(e) => updateSection("public_storefront", { public_api_enabled: e.target.checked })} />Public API enabled</label>
                  </Grid>
                  <Field label="Allowed scan modes" error={selectedFieldError("public_storefront.allowed_scan_modes")}>
                    <div className="flex flex-wrap gap-2 rounded-lg border border-ink-200/70 bg-white px-3 py-2">
                      {["auto", "rendered", "generic", "tagged"].map((mode) => (
                        <label key={mode} className="flex items-center gap-1.5 text-[0.62rem] normal-case tracking-normal text-ink-600">
                          <input type="checkbox" checked={selectedConnection.public_storefront.allowed_scan_modes.includes(mode)} onChange={(event) => updateSection("public_storefront", { allowed_scan_modes: event.target.checked ? [...new Set([...selectedConnection.public_storefront.allowed_scan_modes, mode])] : selectedConnection.public_storefront.allowed_scan_modes.filter((item) => item !== mode) })} />
                          {mode}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field label="Public storefront scopes" error={selectedFieldError("public_storefront.scopes")}>
                    <div className="flex flex-wrap gap-2 rounded-lg border border-ink-200/70 bg-white px-3 py-2">
                      {["storefront.mapping.read", "storefront.content.read", "storefront.catalog.read"].map((scope) => (
                        <label key={scope} className="flex items-center gap-1.5 text-[0.62rem] normal-case tracking-normal text-ink-600">
                          <input type="checkbox" checked={selectedConnection.public_storefront.scopes.includes(scope)} onChange={(event) => updateSection("public_storefront", { scopes: event.target.checked ? [...new Set([...selectedConnection.public_storefront.scopes, scope])] : selectedConnection.public_storefront.scopes.filter((item) => item !== scope) })} />
                          {scope}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <a href={mappingStudioHref} className="inline-flex rounded-full border border-ink-200/70 bg-white px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-600">Open Mapping Studio</a>
                </div>
              )
            ) : null}

            {activeStep === "audit" ? (
              <div className="mt-4 space-y-4">
                {paymentSetup ? (
                  <div className="rounded-xl border border-ink-100 bg-white/80 p-3">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-400">Payment provider health and readiness</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {paymentChecks.map((check) => <StatusPill key={`audit-${check.label}`} ok={check.optional || check.ok}>{check.label}: {check.ok ? "ready" : check.optional ? "not configured" : "missing"}</StatusPill>)}
                      <StatusPill ok={selectedConnection.identity.is_enabled !== false}>Provider: {selectedConnection.identity.is_enabled !== false ? "enabled" : "disabled"}</StatusPill>
                      <StatusPill ok={["healthy", "configured", "ready"].includes(String(selectedConnection.routing.health_status || "").toLowerCase())}>Readiness: {selectedConnection.routing.health_status || "pending"}</StatusPill>
                    </div>
                    <p className="mt-3 text-xs text-ink-500">
                      Mode: {selectedConnection.routing.health_mode || selectedConnection.identity.environment || "not tested"} · Last successful test: {selectedConnection.routing.last_successful_test_at || "never"}
                    </p>
                  </div>
                ) : null}
                <Grid>
                  <Field label="Audit record type" error={selectedFieldError("audit.audit_record_type")}><input value={selectedConnection.audit.audit_record_type} onChange={(e) => updateSection("audit", { audit_record_type: e.target.value })} className={inputClass} /></Field>
                  <Field label="Max body size"><input type="number" value={selectedConnection.audit.max_body_size} onChange={(e) => updateSection("audit", { max_body_size: Number(e.target.value) })} className={inputClass} /></Field>
                  <Field label="Log level"><select value={selectedConnection.audit.log_level} onChange={(e) => updateSection("audit", { log_level: e.target.value })} className={inputClass}>{LOG_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select></Field>
                  <Field label="IP allowlist"><textarea value={selectedConnection.audit.ip_allowlist_text} onChange={(e) => updateSection("audit", { ip_allowlist_text: e.target.value })} className={`${inputClass} min-h-[70px]`} /></Field>
                </Grid>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass-panel rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink-900">API Keys</h3>
                <p className="mt-1 text-xs text-ink-500">Raw keys are displayed once only. Saved keys show safe status metadata.</p>
              </div>
              <button type="button" onClick={handleCreateKey} className="rounded-full bg-ink-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-glow">New key</button>
            </div>

            {rawKey ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold uppercase tracking-[0.2em]">One-time raw key</p>
                    <p className="mt-1">Copy it into the external storefront now. It will be hidden after you copy/hide, refresh, or save.</p>
                    <p className="mt-2 break-all rounded-xl bg-white/80 px-3 py-2 font-mono text-[0.72rem] text-ink-800">{rawKey}</p>
                    {rawKeyMeta?.copied ? <p className="mt-2 text-emerald-700">Copied. You can now hide it safely.</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button type="button" onClick={handleCopyRawKey} className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em]"><Clipboard className="mr-1 inline h-3 w-3" />Copy</button>
                    <button type="button" onClick={() => { setRawKey(null); setRawKeyMeta(null); }} className="rounded-full border border-ink-200 bg-white px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em]"><EyeOff className="mr-1 inline h-3 w-3" />Hide</button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-3 space-y-2 text-xs text-ink-600">
              {apiKeys.length === 0 ? <Notice>No API keys yet.</Notice> : null}
              {apiKeys.map((key) => (
                <div key={key.id} className="rounded-2xl border border-white/60 bg-white/80 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink-900">{key.label || "API key"}</p>
                      <p className="text-[0.65rem] text-ink-400">ID: {key.id}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[0.6rem] uppercase tracking-[0.18em]">
                        <StatusPill ok={Boolean(key.is_active)}>{key.is_active ? "Active" : "Revoked"}</StatusPill>
                        <StatusPill ok>Stored server-side</StatusPill>
                        <StatusPill ok={Boolean(key.expires_at)}>{key.expires_at ? `Expires ${formatDate(key.expires_at)}` : "No expiry"}</StatusPill>
                      </div>
                      <p className="mt-2 text-[0.65rem] text-ink-400">Created: {formatDate(key.created_at)}</p>
                      {key.attrs?.fingerprint ? <p className="mt-1 text-[0.65rem] text-ink-400">Fingerprint: {key.attrs.fingerprint}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {key.is_active ? (
                        <>
                          <button type="button" onClick={() => handleRotateKey(key.id)} className="rounded-full border border-ink-200/60 bg-white px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-900">Rotate</button>
                          <button type="button" onClick={() => handleRevokeKey(key.id)} className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-rose-500 hover:text-rose-700">Revoke</button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-ink-900">Connection Health</h3>
            <div className="mt-3 grid gap-2 text-xs text-ink-600">
              <HealthRow label="Last 24h handshakes" value={detail?.health?.last_24h ?? 0} />
              <HealthRow label="Last 7d handshakes" value={detail?.health?.last_7d ?? 0} />
              <HealthRow label="Last seen" value={detail?.health?.last_seen ? formatDate(detail.health.last_seen) : "?"} />
              <HealthRow label="Last verified at" value={detail?.health?.last_seen ? formatDate(detail.health.last_seen) : "-"} />
              <HealthRow label="CORS ready" value={selectedStorefrontDiagnostic?.cors_ready ? "Yes" : "No"} />
              <HealthRow label="Verification key saved" value={selectedStorefrontDiagnostic?.api_key_saved === null ? "N/A" : selectedStorefrontDiagnostic?.api_key_saved ? "Yes" : "No"} />
              <HealthRow label="Rendered scanner ready" value={selectedStorefrontDiagnostic?.rendered_scan_ready ? "Yes" : "No"} />
              <HealthRow label="Last scan usable zones" value={selectedStorefrontDiagnostic?.last_scan_result?.usable_candidate_count ?? "-"} />
            </div>
          </div>
        </div>
      </div>

      <ActionMiniModal
        open={Boolean(miniModalRequest)}
        mode="confirm"
        title={miniModalRequest?.title || "Confirm action"}
        message={miniModalRequest?.message || ""}
        confirmLabel={miniModalRequest?.confirmLabel || "Confirm"}
        cancelLabel="Cancel"
        confirmTone={miniModalRequest?.confirmTone || "default"}
        onCancel={() => closeMiniModal(false)}
        onConfirm={() => closeMiniModal(true)}
      />
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs";

function Grid({ children }) {
  return <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div>;
}

function Field({ label, children, error = "" }) {
  const control = isValidElement(children)
    ? cloneElement(children, {
        className: `${children.props.className || ""}${error ? " border-rose-400 bg-rose-50/40 ring-1 ring-rose-200" : ""}`,
        "aria-invalid": error ? "true" : undefined,
        "aria-describedby": error ? `${String(label || "field").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-error` : undefined
      })
    : children;
  return (
    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
      <span className="mb-1 block">{label}</span>
      {control}
      {error ? (
        <span id={`${String(label || "field").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-error`} className="mt-1 block text-[0.58rem] normal-case tracking-normal text-rose-600">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function SecretField({ label, value, stored, onChange, onClear, error = "" }) {
  return (
    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
      <span className="mb-1 flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="flex items-center gap-2">
          {stored && onClear ? <button type="button" onClick={onClear} className="text-[0.52rem] text-rose-600 underline">Clear</button> : null}
          {stored ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.55rem] text-emerald-700"><ShieldCheck className="h-3 w-3" />Stored</span> : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[0.55rem] text-amber-700">Not stored</span>}
        </span>
      </span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={stored ? "Stored secret hidden — enter a new value only to rotate" : "Enter secret"}
        className={`${inputClass}${error ? " border-rose-400 bg-rose-50/40 ring-1 ring-rose-200" : ""}`}
        aria-invalid={error ? "true" : undefined}
      />
      {error ? <span className="mt-1 block text-[0.58rem] normal-case tracking-normal text-rose-600">{error}</span> : null}
      <span className="mt-1 block text-[0.55rem] normal-case tracking-normal text-ink-400">
        {stored ? "Saved securely on the server. The raw value is not displayed again." : "Secret will be vaulted on save."}
      </span>
    </label>
  );
}

function EndpointGrid({ urls }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {Object.entries(urls).map(([label, url]) => (
        <div key={label} className="rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs">
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ink-400">{label} endpoint</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-ink-700">{url}</span>
            <button type="button" onClick={() => navigator.clipboard?.writeText?.(url)} className="rounded-full border border-ink-200/70 px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em]"><Copy className="mr-1 inline h-3 w-3" />Copy</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ ok, children }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>{ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}{children}</span>;
}

function HealthRow({ label, value }) {
  return <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/80 px-3 py-2"><span>{label}</span><span className="font-semibold">{value}</span></div>;
}

function Notice({ children, tone = "neutral" }) {
  const cls = tone === "error" ? "border-rose-200 bg-rose-50 text-rose-600" : tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-ink-200/60 bg-white/70 text-ink-500";
  return <div className={`mt-3 rounded-2xl border px-4 py-3 text-xs ${cls}`}>{children}</div>;
}

function TabButton({ active, onClick, children }) {
  return <button type="button" onClick={onClick} className={`rounded-full px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] ${active ? "bg-ink-900 text-white" : "border border-ink-200/70 bg-white text-ink-500"}`}>{children}</button>;
}
