
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Copy, Play } from "lucide-react";
import { apiFetch } from "../../services/apiClient";
import { ActionMiniModal } from "../../../../ui-components/src/index.js";

const STEPS = [
  { id: "identity", label: "Identity" },
  { id: "inbound", label: "Inbound" },
  { id: "outbound", label: "Outbound" },
  { id: "verification", label: "Security" },
  { id: "idempotency", label: "Idempotency" },
  { id: "routing", label: "Routing" },
  { id: "audit", label: "Audit" }
];

const KIND_OPTIONS = [
  { value: "website", label: "Website" },
  { value: "ecommerce", label: "E-commerce" },
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

const AUTH_MODES = [
  { value: "none", label: "None" },
  { value: "bearer_token", label: "Bearer Token" },
  { value: "api_key_header", label: "API Key Header" },
  { value: "api_key_query", label: "API Key Query Param" },
  { value: "basic", label: "Basic" },
  { value: "oauth2_client_credentials", label: "OAuth2 Client Credentials" }
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

const LOG_LEVELS = [
  { value: "error", label: "Error" },
  { value: "warn", label: "Warn" },
  { value: "info", label: "Info" },
  { value: "debug", label: "Debug" }
];

const HTTP_METHODS = ["POST", "PUT", "PATCH"];
function normalizeList(text) {
  if (!text) return [];
  return text
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
      http_method: "POST",
      expected_content_type: "application/json",
      origin_allowlist_text: "",
      raw_body_required: true,
      rate_limit_max: 120,
      rate_limit_window_sec: 60
    },
    verification: {
      mode: "none",
      allow_unverified: false,
      api_key: { header_name: "", secret: "", secret_set: false },
      hmac_signature: {
        header_name: "",
        algorithm: "sha256",
        encoding: "hex",
        secret: "",
        secret_set: false,
        payload_mode: "raw",
        timestamp_header: "x-timestamp",
        max_skew_sec: 300
      },
      oauth2_jwt: {
        header_name: "",
        token_prefix: "",
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
      idempotency_scope: ""
    },
    outbound: {
      base_url: "",
      path_prefix: "/",
      auth_mode: "none",
      auth: {
        header_name: "",
        query_param_name: "",
        secret: "",
        token: "",
        username: "",
        password: "",
        client_id: "",
        client_secret: "",
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
      supported_message_types_text: "",
      schema_version: "v1",
      envelope_profile: "canonical_v1",
      mapping_mode: "passthrough",
      mapping_rules_text: ""
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
  const next = buildProfile(profile.id, {
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
      http_method: profile.inbound?.http_method || "POST",
      expected_content_type: profile.inbound?.expected_content_type || "application/json",
      origin_allowlist_text: Array.isArray(profile.inbound?.origin_allowlist)
        ? profile.inbound.origin_allowlist.join("\n")
        : "",
      raw_body_required: profile.inbound?.raw_body_required ?? true,
      rate_limit_max: profile.inbound?.rate_limit?.max ?? 120,
      rate_limit_window_sec: profile.inbound?.rate_limit?.window_sec ?? 60
    },
    verification: {
      mode: profile.verification?.mode || "none",
      allow_unverified: profile.verification?.allow_unverified ?? false,
      api_key: {
        header_name: profile.verification?.api_key?.header_name || "",
        secret: "",
        secret_set: Boolean(profile.verification?.api_key?.secret_set)
      },
      hmac_signature: {
        header_name: profile.verification?.hmac_signature?.header_name || "",
        algorithm: profile.verification?.hmac_signature?.algorithm || "sha256",
        encoding: profile.verification?.hmac_signature?.encoding || "hex",
        secret: "",
        secret_set: Boolean(profile.verification?.hmac_signature?.secret_set),
        payload_mode: profile.verification?.hmac_signature?.payload_mode || "raw",
        timestamp_header: profile.verification?.hmac_signature?.timestamp_header || "x-timestamp",
        max_skew_sec: profile.verification?.hmac_signature?.max_skew_sec ?? 300
      },
      oauth2_jwt: {
        header_name: profile.verification?.oauth2_jwt?.header_name || "",
        token_prefix: profile.verification?.oauth2_jwt?.token_prefix || "",
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
      idempotency_scope: profile.idempotency?.idempotency_scope || ""
    },
    outbound: {
      base_url: profile.outbound?.base_url || "",
      path_prefix: profile.outbound?.path_prefix || "/",
      auth_mode: profile.outbound?.auth_mode || "none",
      auth: {
        header_name: profile.outbound?.auth?.header_name || "",
        query_param_name: profile.outbound?.auth?.query_param_name || "",
        secret: "",
        token: "",
        username: profile.outbound?.auth?.username || "",
        password: "",
        client_id: profile.outbound?.auth?.client_id || "",
        client_secret: "",
        token_url: profile.outbound?.auth?.token_url || "",
        scope: profile.outbound?.auth?.scope || ""
      },
      default_headers_text: profile.outbound?.default_headers
        ? JSON.stringify(profile.outbound.default_headers, null, 2)
        : "",
      timeout_ms: profile.outbound?.timeout_ms || 8000,
      retry_policy: profile.outbound?.retry_policy || { max_retries: 2, backoff_ms: 500 },
      healthcheck_path: profile.outbound?.healthcheck_path || "/health",
      test_request_method: profile.outbound?.test_request_method || "GET"
    },
    routing: {
      channel: profile.routing?.channel || "custom",
      protocol: profile.routing?.protocol || "",
      supported_message_types_text: Array.isArray(profile.routing?.supported_message_types)
        ? profile.routing.supported_message_types.join("\n")
        : "",
      schema_version: profile.routing?.schema_version || "v1",
      envelope_profile: profile.routing?.envelope_profile || "canonical_v1",
      mapping_mode: profile.routing?.mapping_mode || "passthrough",
      mapping_rules_text: profile.routing?.mapping_rules
        ? JSON.stringify(profile.routing.mapping_rules, null, 2)
        : ""
    },
    audit: {
      audit_record_type: profile.audit?.audit_record_type || "GATEWAY_AUDIT",
      redaction_policy_text: profile.audit?.redaction_policy
        ? JSON.stringify(profile.audit.redaction_policy, null, 2)
        : "",
      max_body_size: profile.audit?.max_body_size || 262144,
      ip_allowlist_text: Array.isArray(profile.audit?.ip_allowlist)
        ? profile.audit.ip_allowlist.join("\n")
        : "",
      log_level: profile.audit?.log_level || "info"
    }
  });
  return next;
}

function toApiProfile(profile) {
  const outboundHeaders = normalizeJson(profile.outbound.default_headers_text) || {};
  const mappingRules = normalizeJson(profile.routing.mapping_rules_text);
  const redactionPolicy = normalizeJson(profile.audit.redaction_policy_text);

  return {
    id: profile.id,
    identity: {
      connection_name: profile.identity.connection_name,
      connection_code: profile.identity.connection_code,
      connection_kind: profile.identity.connection_kind,
      frontend_url: profile.identity.frontend_url,
      portal_url: profile.identity.portal_url,
      direction: profile.identity.direction,
      environment: profile.identity.environment,
      is_enabled: profile.identity.is_enabled
    },
    inbound: {
      inbound_path_suffix: profile.inbound.inbound_path_suffix,
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
    idempotency: {
      event_id_location: profile.idempotency.event_id_location,
      event_id_key: profile.idempotency.event_id_key,
      idempotency_scope: profile.idempotency.idempotency_scope
    },
    outbound: {
      base_url: profile.outbound.base_url,
      path_prefix: profile.outbound.path_prefix,
      auth_mode: profile.outbound.auth_mode,
      auth: {
        header_name: profile.outbound.auth.header_name,
        query_param_name: profile.outbound.auth.query_param_name,
        secret: profile.outbound.auth.secret,
        token: profile.outbound.auth.token,
        username: profile.outbound.auth.username,
        password: profile.outbound.auth.password,
        client_id: profile.outbound.auth.client_id,
        client_secret: profile.outbound.auth.client_secret,
        token_url: profile.outbound.auth.token_url,
        scope: profile.outbound.auth.scope
      },
      default_headers: outboundHeaders,
      timeout_ms: profile.outbound.timeout_ms,
      retry_policy: profile.outbound.retry_policy,
      healthcheck_path: profile.outbound.healthcheck_path,
      test_request_method: profile.outbound.test_request_method
    },
    routing: {
      channel: profile.routing.channel,
      protocol: profile.routing.protocol,
      supported_message_types: normalizeList(profile.routing.supported_message_types_text),
      schema_version: profile.routing.schema_version,
      envelope_profile: profile.routing.envelope_profile,
      mapping_mode: profile.routing.mapping_mode,
      mapping_rules: mappingRules
    },
    audit: {
      audit_record_type: profile.audit.audit_record_type,
      redaction_policy: redactionPolicy,
      max_body_size: Number(profile.audit.max_body_size || 0),
      ip_allowlist: normalizeList(profile.audit.ip_allowlist_text),
      log_level: profile.audit.log_level
    }
  };
}

function validateProfile(profile) {
  const errors = [];
  if (!profile.identity.connection_name) errors.push("Connection name is required");
  if (!profile.identity.connection_code) errors.push("Connection code is required");

  const kind = profile.identity.connection_kind;
  if ((kind === "website" || kind === "ecommerce") && profile.identity.direction !== "outbound") {
    if (!profile.identity.frontend_url) {
      errors.push("Frontend URL is required for website/e-commerce connections");
    }
  }

  if (profile.identity.direction !== "outbound") {
    if (!profile.inbound.inbound_path_suffix) errors.push("Inbound path suffix is required");
    if (!profile.inbound.expected_content_type) errors.push("Expected content type is required");
    if (!profile.inbound.origin_allowlist_text) {
      errors.push("Origin allowlist is required for inbound connections");
    }
    const inboundMax = Number(profile.inbound.rate_limit_max);
    if (!Number.isFinite(inboundMax) || inboundMax <= 0) {
      errors.push("Inbound rate limit max must be a positive number");
    }
    const inboundWindow = Number(profile.inbound.rate_limit_window_sec);
    if (!Number.isFinite(inboundWindow) || inboundWindow <= 0) {
      errors.push("Inbound rate limit window (sec) must be a positive number");
    }
  }

  if (profile.identity.direction !== "inbound") {
    if (!profile.outbound.base_url) errors.push("Outbound base URL is required");
    if (!profile.outbound.path_prefix) errors.push("Outbound path prefix is required");
    if (profile.outbound.auth_mode === "api_key_header") {
      if (!profile.outbound.auth.header_name) errors.push("Outbound API key header name is required");
      if (!profile.outbound.auth.secret) errors.push("Outbound API key secret is required");
    }
    if (profile.outbound.auth_mode === "api_key_query") {
      if (!profile.outbound.auth.query_param_name) errors.push("Outbound API key query parameter is required");
      if (!profile.outbound.auth.secret) errors.push("Outbound API key secret is required");
    }
    if (profile.outbound.auth_mode === "bearer_token" && !profile.outbound.auth.token) {
      errors.push("Outbound bearer token is required");
    }
    if (profile.outbound.auth_mode === "basic") {
      if (!profile.outbound.auth.username) errors.push("Outbound basic auth username is required");
      if (!profile.outbound.auth.password) errors.push("Outbound basic auth password is required");
    }
    if (profile.outbound.auth_mode === "oauth2_client_credentials") {
      if (!profile.outbound.auth.client_id) errors.push("Outbound OAuth client ID is required");
      if (!profile.outbound.auth.client_secret) errors.push("Outbound OAuth client secret is required");
      if (!profile.outbound.auth.token_url) errors.push("Outbound OAuth token URL is required");
    }
  }

  if (profile.verification.mode === "api_key") {
    if (!profile.verification.api_key.header_name) errors.push("API key header name is required");
    if (!profile.verification.api_key.secret && !profile.verification.api_key.secret_set) {
      errors.push("API key secret is required");
    }
  }
  if (profile.verification.mode === "hmac_signature") {
    if (!profile.verification.hmac_signature.header_name) errors.push("HMAC header name is required");
    if (!profile.verification.hmac_signature.timestamp_header) {
      errors.push("HMAC timestamp header is required");
    }
    if (!profile.verification.hmac_signature.secret && !profile.verification.hmac_signature.secret_set) {
      errors.push("HMAC secret is required");
    }
    const skew = Number(profile.verification.hmac_signature.max_skew_sec);
    if (!Number.isFinite(skew) || skew < 0) errors.push("HMAC max skew (sec) must be a positive number");
  }
  if (profile.verification.mode === "oauth2_jwt") {
    if (!profile.verification.oauth2_jwt.header_name) errors.push("JWT header name is required");
    if (!profile.verification.oauth2_jwt.issuer) errors.push("JWT issuer is required");
    if (!profile.verification.oauth2_jwt.audience) errors.push("JWT audience is required");
    const jwtSkew = Number(profile.verification.oauth2_jwt.max_skew_sec);
    if (!Number.isFinite(jwtSkew) || jwtSkew < 0) errors.push("JWT max skew (sec) must be a positive number");
    const maxAge = profile.verification.oauth2_jwt.max_age_sec;
    if (maxAge !== null && maxAge !== undefined && maxAge !== "") {
      const maxAgeNum = Number(maxAge);
      if (!Number.isFinite(maxAgeNum) || maxAgeNum < 0) errors.push("JWT max age (sec) must be a positive number");
    }
  }
  if (
    profile.verification.mode === "none" &&
    profile.identity.environment !== "sandbox" &&
    profile.verification.allow_unverified !== true
  ) {
    errors.push("Verification is required for production (enable allow unverified to override)");
  }

  if (!profile.idempotency.event_id_location) errors.push("Idempotency location is required");
  if (!profile.idempotency.event_id_key) errors.push("Idempotency key is required");

  if (!profile.routing.channel) errors.push("Routing channel is required");
  if (
    ["edi", "banking", "payments"].includes(profile.routing.channel) &&
    !profile.routing.protocol
  ) {
    errors.push("Protocol is required for EDI, banking, or payments connections");
  }
  if (!profile.routing.schema_version) errors.push("Schema version is required");
  if (!profile.routing.envelope_profile) errors.push("Envelope profile is required");

  if (!profile.audit.audit_record_type) errors.push("Audit record type is required");

  const headersJson = profile.outbound.default_headers_text;
  if (headersJson && !normalizeJson(headersJson)) errors.push("Outbound headers JSON is invalid");
  const mapJson = profile.routing.mapping_rules_text;
  if (mapJson && !normalizeJson(mapJson)) errors.push("Mapping rules JSON is invalid");
  const redactionJson = profile.audit.redaction_policy_text;
  if (redactionJson && !normalizeJson(redactionJson)) errors.push("Redaction policy JSON is invalid");

  return errors;
}
export default function AdminConnectionsPanel() {
  const [items, setItems] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [connections, setConnections] = useState([buildProfile("conn-1")]);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [activeStep, setActiveStep] = useState("identity");
  const [error, setError] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [rawKey, setRawKey] = useState(null);
  const [detail, setDetail] = useState(null);
  const [miniModalRequest, setMiniModalRequest] = useState(null);

  const selectedTenant = useMemo(
    () => items.find((item) => item.id === selectedTenantId),
    [items, selectedTenantId]
  );

  const selectedConnection = useMemo(
    () => connections.find((conn) => conn.id === selectedConnectionId) || connections[0],
    [connections, selectedConnectionId]
  );
  const selectedKind = selectedConnection?.identity?.connection_kind;
  const selectedChannel = selectedConnection?.routing?.channel;

  const requestConfirm = ({ title, message, confirmLabel = "Confirm", confirmTone = "default" }) =>
    new Promise((resolve) => {
      setMiniModalRequest({
        mode: "confirm",
        title,
        message,
        confirmLabel,
        confirmTone,
        resolve,
      });
    });

  const closeMiniModal = (confirmed) => {
    if (miniModalRequest?.resolve) {
      miniModalRequest.resolve(Boolean(confirmed));
    }
    setMiniModalRequest(null);
  };

  const visibleSteps = useMemo(() => {
    if (!selectedConnection) return STEPS;
    const direction = selectedConnection.identity?.direction || "inbound";
    const filtered = STEPS.filter((step) => {
      if (step.id === "inbound") return direction !== "outbound";
      if (step.id === "outbound") return direction !== "inbound";
      if (step.id === "idempotency") {
        return direction !== "outbound";
      }
      return true;
    });
    // Security verification must always stay available for every direction.
    if (!filtered.some((step) => step.id === "verification")) {
      const securityStep = STEPS.find((step) => step.id === "verification");
      if (securityStep) {
        filtered.splice(3, 0, securityStep);
      }
    }
    return filtered;
  }, [selectedConnection]);

  useEffect(() => {
    if (!selectedConnection) return;
    if (!visibleSteps.some((step) => step.id === activeStep)) {
      setActiveStep(visibleSteps[0]?.id || "identity");
    }
  }, [selectedConnection, visibleSteps, activeStep]);

  useEffect(() => {
    if (!selectedConnection) return;
    const kind = selectedConnection.identity?.connection_kind;
    const map = {
      website: "website_intake",
      ecommerce: "website_intake",
      edi: "edi",
      banking: "banking",
      payments: "payments",
      social: "social",
      email: "email"
    };
    const targetChannel = map[kind];
    if (targetChannel && selectedConnection.routing?.channel !== targetChannel) {
      updateSection("routing", { channel: targetChannel });
    }
  }, [selectedConnection?.identity?.connection_kind]);

  const toFriendlyError = (err, fallback) => {
    const message = err?.message || "";
    const match = message.match(/API \d+: (.*)$/);
    let payload = null;
    if (match) {
      try {
        payload = JSON.parse(match[1]);
      } catch {
        payload = null;
      }
    }
    const code = payload?.error || message;
    const map = {
      STEP_UP_REQUIRED: "Step-up required. Use profile menu to verify OTP/TOTP.",
      FORBIDDEN: "You do not have permission for this action.",
      TENANT_NOT_FOUND: "Tenant not found.",
      CONNECTION_NOT_FOUND: "Connection not found.",
      DUPLICATE_SUFFIX: "Inbound path suffix already in use.",
      VALIDATION_ERROR: "Validation failed. Review required fields.",
      ORIGIN_NOT_ALLOWED: "Origin not allowed for this connection."
    };
    if (map[code]) return map[code];
    return payload?.error || message || fallback;
  };

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const list = await apiFetch("/api/eip/gateway/connections");
        if (!active) return;
        setItems(list.items || []);
        if (!selectedTenantId && list.items?.length) {
          setSelectedTenantId(list.items[0].id);
        }
      } catch (err) {
        if (!active) return;
        setError(toFriendlyError(err, "Failed to load tenants"));
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [selectedTenantId]);

  useEffect(() => {
    let active = true;
    async function loadDetail() {
      if (!selectedTenantId) return;
      try {
        const result = await apiFetch(`/api/eip/gateway/connections/${selectedTenantId}`);
        if (!active) return;
        setDetail(result);
        const list = Array.isArray(result.connections) ? result.connections : [];
        const next = list.length ? list.map(fromApiProfile) : [buildProfile("conn-1")];
        setConnections(next);
        setSelectedConnectionId(next[0]?.id || null);
        setRawKey(null);
      } catch (err) {
        if (!active) return;
        setError(toFriendlyError(err, "Failed to load tenant profile"));
      }
    }
    loadDetail();
    return () => {
      active = false;
    };
  }, [selectedTenantId]);

  const updateSection = (section, patch) => {
    if (!selectedConnection) return;
    setConnections((prev) =>
      prev.map((item) =>
        item.id === selectedConnection.id ? { ...item, [section]: { ...item[section], ...patch } } : item
      )
    );
  };

  const buildUniqueCode = (name, currentId, list = connections, avoidCode = null) => {
    const base = slugifyCode(name);
    const exists = (code) =>
      list.some((conn) => conn.id !== currentId && conn.identity?.connection_code === code);
    let candidate = base;
    let idx = 2;
    if (avoidCode && candidate === avoidCode) {
      candidate = `${base}-${idx}`;
      idx += 1;
    }
    while (exists(candidate) || (avoidCode && candidate === avoidCode)) {
      candidate = `${base}-${idx}`;
      idx += 1;
    }
    return candidate;
  };

  const handleConnectionNameChange = (event) => {
    if (!selectedConnection) return;
    const nextName = event.target.value;
    setConnections((prev) =>
      prev.map((item) => {
        if (item.id !== selectedConnection.id) return item;
        const existingCode = item.identity.connection_code;
        const nextCode = nextName
          ? existingCode || buildUniqueCode(nextName, item.id, prev)
          : "";
        return {
          ...item,
          identity: { ...item.identity, connection_name: nextName, connection_code: nextCode }
        };
      })
    );
  };

  const handleRegenerateCode = () => {
    if (!selectedConnection) return;
    const baseName =
      selectedConnection.identity.connection_name ||
      selectedConnection.identity.connection_kind ||
      "connection";
    const nextCode = buildUniqueCode(
      baseName,
      selectedConnection.id,
      connections,
      selectedConnection.identity.connection_code
    );
    if (!nextCode) return;
    updateSection("identity", { connection_code: nextCode });
  };

  const updateNested = (section, key, patch) => {
    if (!selectedConnection) return;
    setConnections((prev) =>
      prev.map((item) =>
        item.id === selectedConnection.id
          ? { ...item, [section]: { ...item[section], [key]: { ...item[section][key], ...patch } } }
          : item
      )
    );
  };

  const handleAddConnection = () => {
    const next = buildProfile(`conn-${connections.length + 1}`);
    setConnections((prev) => [...prev, next]);
    setSelectedConnectionId(next.id);
    setActiveStep("identity");
  };

  const handleRemoveConnection = (id) => {
    setConnections((prev) => prev.filter((item) => item.id !== id));
    if (selectedConnectionId === id) {
      setSelectedConnectionId(connections[0]?.id || null);
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedTenantId) return;
    setSaving(true);
    setError(null);
    try {
      const validations = connections.flatMap((conn) => validateProfile(conn));
      if (validations.length) {
        setError(validations[0]);
        setSaving(false);
        return;
      }
      const payload = {
        connections: connections.map(toApiProfile)
      };
      const result = await apiFetch(`/api/eip/gateway/connections/${selectedTenantId}/profile`, {
        method: "POST",
        body: payload
      });
      const list = Array.isArray(result.connections) ? result.connections : [];
      const next = list.length ? list.map(fromApiProfile) : [buildProfile("conn-1")];
      setConnections(next);
      setSelectedConnectionId(next[0]?.id || null);
    } catch (err) {
      setError(toFriendlyError(err, "Failed to save profile"));
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
      setRawKey(result.raw_key);
      const detailRefresh = await apiFetch(`/api/eip/gateway/connections/${selectedTenantId}`);
      setDetail(detailRefresh);
    } catch (err) {
      setError(toFriendlyError(err, "Failed to create API key"));
    }
  };

  const handleRevokeKey = async (keyId) => {
    if (!selectedTenantId || !keyId) return;
    const confirmed = await requestConfirm({
      title: "Revoke API key",
      message: "Revoke this API key? This cannot be undone.",
      confirmLabel: "Revoke",
      confirmTone: "danger",
    });
    if (!confirmed) return;
    setError(null);
    try {
      await apiFetch(`/api/eip/gateway/connections/${selectedTenantId}/api-keys/${keyId}/revoke`, {
        method: "POST"
      });
      const detailRefresh = await apiFetch(`/api/eip/gateway/connections/${selectedTenantId}`);
      setDetail(detailRefresh);
    } catch (err) {
      setError(toFriendlyError(err, "Failed to revoke API key"));
    }
  };

  const handleRotateKey = async (keyId) => {
    if (!selectedTenantId || !keyId) return;
    const confirmed = await requestConfirm({
      title: "Rotate API key",
      message: "Rotate this API key? The old key will be revoked.",
      confirmLabel: "Rotate",
      confirmTone: "danger",
    });
    if (!confirmed) return;
    setError(null);
    try {
      const result = await apiFetch(`/api/eip/gateway/connections/${selectedTenantId}/api-keys/${keyId}/rotate`, {
        method: "POST",
        body: { label: "plug-play" }
      });
      setRawKey(result.raw_key);
      const detailRefresh = await apiFetch(`/api/eip/gateway/connections/${selectedTenantId}`);
      setDetail(detailRefresh);
    } catch (err) {
      setError(toFriendlyError(err, "Failed to rotate API key"));
    }
  };

  const handleTest = async (type) => {
    if (!selectedTenantId || !selectedConnection) return;
    setTesting(type);
    setError(null);
    setTestResult(null);
    try {
      const extra =
        type === "inbound" &&
        selectedConnection.verification.mode === "oauth2_jwt" &&
        selectedConnection.verification.oauth2_jwt.test_token
          ? { test_token: selectedConnection.verification.oauth2_jwt.test_token }
          : {};
      const result = await apiFetch(`/api/eip/gateway/connections/${selectedTenantId}/test/${type}`, {
        method: "POST",
        body: { connection_code: selectedConnection.identity.connection_code, ...extra }
      });
      const testTypeLabel = type === "outbound" ? "Outbound" : "Inbound";
      const responsePreview = String(result.response || "").slice(0, 180);
      if (result.ok) {
        setTestResult({
          tone: "success",
          text: `${testTypeLabel} test passed (HTTP ${result.status}).`
        });
      } else {
        setTestResult({
          tone: "error",
          text: responsePreview
            ? `${testTypeLabel} test failed (HTTP ${result.status}): ${responsePreview}`
            : `${testTypeLabel} test failed (HTTP ${result.status}).`
        });
      }
    } catch (err) {
      setError(toFriendlyError(err, "Failed to test connection"));
      setTestResult({
        tone: "error",
        text: type === "outbound" ? "Outbound test failed." : "Inbound test failed."
      });
    } finally {
      setTesting(null);
    }
  };

  const inboundUrls = selectedConnection?.inbound?.inbound_path_suffix
    ? {
        public: `${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"}/api/public/gateway/intake/${selectedConnection.inbound.inbound_path_suffix}`,
        edi: `${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"}/api/edi/gateway/webhook/${selectedConnection.inbound.inbound_path_suffix}`
      }
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <datalist id="gateway-protocols">
        <option value="HTTPS" />
        <option value="SFTP" />
        <option value="AS2" />
        <option value="FTP" />
        <option value="MQ" />
        <option value="SMTP" />
        <option value="WebSocket" />
      </datalist>
      <div className="glass-panel rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-ink-900">Tenants</h3>
        <div className="mt-3 space-y-2">
          {items.map((item) => {
            const active = item.id === selectedTenantId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedTenantId(item.id)}
                className={`w-full rounded-2xl border px-3 py-3 text-left text-sm ${
                  active
                    ? "border-ink-900/10 bg-white shadow-soft"
                    : "border-white/60 bg-white/70 text-ink-500 hover:bg-white"
                }`}
              >
                <p className="font-semibold text-ink-900">{item.name}</p>
                <p className="text-xs uppercase tracking-[0.25em] text-ink-400">{item.code}</p>
                <p className="mt-2 text-xs text-ink-500">
                  {item.connection_count || 0} connection{item.connection_count === 1 ? "" : "s"}
                </p>
              </button>
            );
          })}
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddConnection}
                className="rounded-full border border-ink-200/70 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-600"
              >
                <Plus className="mr-1 inline h-4 w-4" />
                Add
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saving || !selectedTenantId}
                className="rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-glow disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
              {error}
            </div>
          ) : null}
          {testResult ? (
            <div
              className={`mt-3 rounded-2xl px-4 py-3 text-xs ${
                testResult.tone === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {testResult.text}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {connections.map((conn) => {
              const active = conn.id === selectedConnection?.id;
              return (
                <button
                  key={conn.id}
                  type="button"
                  onClick={() => setSelectedConnectionId(conn.id)}
                  className={`rounded-xl border px-3 py-2 text-left text-[0.7rem] ${
                    active
                      ? "border-ink-900/10 bg-white shadow-soft"
                      : "border-white/60 bg-white/70 text-ink-500"
                  }`}
                >
                  <p className="font-semibold text-ink-900">{conn.identity.connection_name || "New connection"}</p>
                  <p className="uppercase tracking-[0.2em] text-ink-400">
                    {conn.identity.connection_code || "auto-generated"}
                  </p>
                  <p className="mt-1 text-[0.6rem] uppercase tracking-[0.2em] text-ink-400">
                    {conn.identity.connection_kind || "custom"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
        {selectedConnection ? (
          <div className="glass-panel rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Connection</p>
                <h3 className="text-base font-semibold text-ink-900">{selectedConnection.identity.connection_name || "Untitled"}</h3>
                <p className="text-xs text-ink-500">
                  {selectedConnection.identity.connection_code || "auto-generated"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRemoveConnection(selectedConnection.id)}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[0.6rem] uppercase tracking-[0.2em] text-rose-500"
                >
                  <Trash2 className="mr-1 inline h-3 w-3" />
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => handleTest("inbound")}
                  disabled={Boolean(testing)}
                  className="rounded-full border border-ink-200/70 bg-white px-3 py-2 text-[0.6rem] uppercase tracking-[0.2em] text-ink-600"
                >
                  <Play className="mr-1 inline h-3 w-3" />
                  {testing === "inbound" ? "Testing..." : "Test inbound"}
                </button>
                <button
                  type="button"
                  onClick={() => handleTest("outbound")}
                  disabled={Boolean(testing)}
                  className="rounded-full border border-ink-200/70 bg-white px-3 py-2 text-[0.6rem] uppercase tracking-[0.2em] text-ink-600"
                >
                  <Play className="mr-1 inline h-3 w-3" />
                  {testing === "outbound" ? "Testing..." : "Test outbound"}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {visibleSteps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={`rounded-full px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] ${
                    activeStep === step.id
                      ? "bg-ink-900 text-white"
                      : "border border-ink-200/70 bg-white text-ink-500"
                  }`}
                >
                  {step.label}
                </button>
              ))}
            </div>

            {activeStep === "identity" ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 block">Connection name</span>
                  <input
                    value={selectedConnection.identity.connection_name}
                    onChange={handleConnectionNameChange}
                    className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  />
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 flex items-center justify-between gap-2">
                    <span>Connection code</span>
                    <button
                      type="button"
                      onClick={handleRegenerateCode}
                      className="rounded-full border border-ink-200/70 px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.2em] text-ink-500"
                    >
                      Regenerate
                    </button>
                  </span>
                  <input
                    value={selectedConnection.identity.connection_code}
                    readOnly
                    placeholder="auto-generated"
                    className="w-full rounded-lg border border-ink-200/70 bg-slate-50 px-3 py-2 text-xs text-ink-600"
                  />
                  <span className="mt-1 block text-[0.55rem] text-ink-400">
                    System-generated, URL-safe identifier used in gateway routes and references.
                  </span>
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 block">Connection kind</span>
                  <select
                    value={selectedConnection.identity.connection_kind}
                    onChange={(event) => updateSection("identity", { connection_kind: event.target.value })}
                    className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  >
                    {KIND_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                {["website", "ecommerce"].includes(selectedConnection.identity.connection_kind) ? (
                  <>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Frontend URL</span>
                      <input
                        value={selectedConnection.identity.frontend_url}
                        onChange={(event) => {
                          const next = event.target.value;
                          updateSection("identity", { frontend_url: next });
                          if (!selectedConnection.inbound.origin_allowlist_text) {
                            updateSection("inbound", { origin_allowlist_text: next });
                          }
                        }}
                        placeholder="https://tenant-site.com"
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Portal URL</span>
                      <input
                        value={selectedConnection.identity.portal_url}
                        onChange={(event) => updateSection("identity", { portal_url: event.target.value })}
                        placeholder="https://portal.tenant-site.com"
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                  </>
                ) : null}
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 block">Direction</span>
                  <select
                    value={selectedConnection.identity.direction}
                    onChange={(event) => updateSection("identity", { direction: event.target.value })}
                    className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  >
                    {DIRECTION_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 block">Environment</span>
                  <select
                    value={selectedConnection.identity.environment}
                    onChange={(event) => updateSection("identity", { environment: event.target.value })}
                    className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  >
                    {ENV_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <input
                    type="checkbox"
                    checked={selectedConnection.identity.is_enabled}
                    onChange={(event) => updateSection("identity", { is_enabled: event.target.checked })}
                  />
                  Enabled
                </label>
              </div>
            ) : null}
            {activeStep === "inbound" ? (
              <div className="mt-4 space-y-4">
                {selectedChannel === "edi" ? (
                  <p className="text-xs text-ink-500">
                    EDI inbound typically uses strict content types and idempotency. Confirm the expected EDI format and event ID source.
                  </p>
                ) : null}
                {selectedKind === "website" || selectedKind === "ecommerce" ? (
                  <p className="text-xs text-ink-500">
                    For web or e-commerce intakes, use the frontend URL (Identity step) to populate the origin allowlist.
                  </p>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                    <span className="mb-1 block">Path suffix</span>
                    <input
                      value={selectedConnection.inbound.inbound_path_suffix}
                      onChange={(event) => updateSection("inbound", { inbound_path_suffix: event.target.value })}
                      placeholder="partner-intake"
                      className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                    />
                  </label>
                  <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                    <span className="mb-1 block">HTTP method</span>
                    <select
                      value={selectedConnection.inbound.http_method}
                      onChange={(event) => updateSection("inbound", { http_method: event.target.value })}
                      className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                    >
                      {HTTP_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                    <span className="mb-1 block">Expected content type</span>
                    <input
                      value={selectedConnection.inbound.expected_content_type}
                      onChange={(event) => updateSection("inbound", { expected_content_type: event.target.value })}
                      placeholder={selectedChannel === "edi" ? "application/edi-x12" : "application/json"}
                      className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                    />
                  </label>
                </div>

                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 block">Origin allowlist</span>
                  <textarea
                    value={selectedConnection.inbound.origin_allowlist_text}
                    onChange={(event) => updateSection("inbound", { origin_allowlist_text: event.target.value })}
                    placeholder="https://tenant-site.com&#10;no-origin"
                    className="min-h-[80px] w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                    <span className="mb-1 block">Rate limit max</span>
                    <input
                      type="number"
                      value={selectedConnection.inbound.rate_limit_max}
                      onChange={(event) => updateSection("inbound", { rate_limit_max: event.target.value })}
                      className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                    />
                  </label>
                  <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                    <span className="mb-1 block">Rate limit window (sec)</span>
                    <input
                      type="number"
                      value={selectedConnection.inbound.rate_limit_window_sec}
                      onChange={(event) => updateSection("inbound", { rate_limit_window_sec: event.target.value })}
                      className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                    />
                  </label>
                </div>

                {inboundUrls ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs">
                      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ink-400">Public intake URL</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate text-ink-700">{inboundUrls.public}</span>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText?.(inboundUrls.public)}
                          title="Copy URL"
                          aria-label="Copy public intake URL"
                          className="rounded-full border border-ink-200/70 px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em]"
                        >
                          <Copy className="mr-1 inline h-3 w-3" />
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs">
                      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ink-400">EDI webhook URL</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate text-ink-700">{inboundUrls.edi}</span>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText?.(inboundUrls.edi)}
                          title="Copy URL"
                          aria-label="Copy EDI webhook URL"
                          className="rounded-full border border-ink-200/70 px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em]"
                        >
                          <Copy className="mr-1 inline h-3 w-3" />
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {activeStep === "outbound" ? (
              <div className="mt-4 space-y-4">
                {selectedChannel === "banking" || selectedChannel === "payments" ? (
                  <p className="text-xs text-ink-500">
                    Banking and payments integrations should use strict auth, retry, and idempotency controls.
                  </p>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                    <span className="mb-1 block">Base URL</span>
                    <input
                      value={selectedConnection.outbound.base_url}
                      onChange={(event) => updateSection("outbound", { base_url: event.target.value })}
                      className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                    />
                  </label>
                  <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                    <span className="mb-1 block">Path prefix</span>
                    <input
                      value={selectedConnection.outbound.path_prefix}
                      onChange={(event) => updateSection("outbound", { path_prefix: event.target.value })}
                      className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                    />
                  </label>
                </div>

                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 block">Auth mode</span>
                  <select
                    value={selectedConnection.outbound.auth_mode}
                    onChange={(event) => updateSection("outbound", { auth_mode: event.target.value })}
                    className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  >
                    {AUTH_MODES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedConnection.outbound.auth_mode === "api_key_header" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Header name</span>
                      <input
                        value={selectedConnection.outbound.auth.header_name}
                        onChange={(event) => updateNested("outbound", "auth", { header_name: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Secret</span>
                      <input
                        type="password"
                        value={selectedConnection.outbound.auth.secret}
                        onChange={(event) => updateNested("outbound", "auth", { secret: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                  </div>
                ) : null}

                {selectedConnection.outbound.auth_mode === "api_key_query" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Query parameter</span>
                      <input
                        value={selectedConnection.outbound.auth.query_param_name}
                        onChange={(event) =>
                          updateNested("outbound", "auth", { query_param_name: event.target.value })
                        }
                        placeholder="app_id"
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Secret</span>
                      <input
                        type="password"
                        value={selectedConnection.outbound.auth.secret}
                        onChange={(event) => updateNested("outbound", "auth", { secret: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                  </div>
                ) : null}

                {selectedConnection.outbound.auth_mode === "bearer_token" ? (
                  <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                    <span className="mb-1 block">Bearer token</span>
                    <input
                      type="password"
                      value={selectedConnection.outbound.auth.token}
                      onChange={(event) => updateNested("outbound", "auth", { token: event.target.value })}
                      className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                    />
                  </label>
                ) : null}

                {selectedConnection.outbound.auth_mode === "basic" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Username</span>
                      <input
                        value={selectedConnection.outbound.auth.username}
                        onChange={(event) => updateNested("outbound", "auth", { username: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Password</span>
                      <input
                        type="password"
                        value={selectedConnection.outbound.auth.password}
                        onChange={(event) => updateNested("outbound", "auth", { password: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                  </div>
                ) : null}

                {selectedConnection.outbound.auth_mode === "oauth2_client_credentials" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Client ID</span>
                      <input
                        value={selectedConnection.outbound.auth.client_id}
                        onChange={(event) => updateNested("outbound", "auth", { client_id: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Client secret</span>
                      <input
                        type="password"
                        value={selectedConnection.outbound.auth.client_secret}
                        onChange={(event) => updateNested("outbound", "auth", { client_secret: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Token URL</span>
                      <input
                        value={selectedConnection.outbound.auth.token_url}
                        onChange={(event) => updateNested("outbound", "auth", { token_url: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Scope</span>
                      <input
                        value={selectedConnection.outbound.auth.scope}
                        onChange={(event) => updateNested("outbound", "auth", { scope: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                  </div>
                ) : null}
                <details className="rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs">
                  <summary className="cursor-pointer text-[0.65rem] uppercase tracking-[0.2em] text-ink-400">
                    Advanced settings
                  </summary>
                  <div className="mt-3 space-y-3">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Default headers (JSON)</span>
                      <textarea
                        value={selectedConnection.outbound.default_headers_text}
                        onChange={(event) => updateSection("outbound", { default_headers_text: event.target.value })}
                        className="min-h-[80px] w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                        <span className="mb-1 block">Timeout (ms)</span>
                        <input
                          type="number"
                          value={selectedConnection.outbound.timeout_ms}
                          onChange={(event) => updateSection("outbound", { timeout_ms: Number(event.target.value) })}
                          className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                        />
                      </label>
                      <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                        <span className="mb-1 block">Retry max</span>
                        <input
                          type="number"
                          value={selectedConnection.outbound.retry_policy.max_retries}
                          onChange={(event) =>
                            updateSection("outbound", {
                              retry_policy: {
                                ...selectedConnection.outbound.retry_policy,
                                max_retries: Number(event.target.value)
                              }
                            })
                          }
                          className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                        />
                      </label>
                      <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                        <span className="mb-1 block">Backoff (ms)</span>
                        <input
                          type="number"
                          value={selectedConnection.outbound.retry_policy.backoff_ms}
                          onChange={(event) =>
                            updateSection("outbound", {
                              retry_policy: {
                                ...selectedConnection.outbound.retry_policy,
                                backoff_ms: Number(event.target.value)
                              }
                            })
                          }
                          className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                        />
                      </label>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                        <span className="mb-1 block">Healthcheck path</span>
                        <input
                          value={selectedConnection.outbound.healthcheck_path}
                          onChange={(event) => updateSection("outbound", { healthcheck_path: event.target.value })}
                          className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                        />
                      </label>
                      <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                        <span className="mb-1 block">Test method</span>
                        <input
                          value={selectedConnection.outbound.test_request_method}
                          onChange={(event) => updateSection("outbound", { test_request_method: event.target.value })}
                          className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                        />
                      </label>
                    </div>
                  </div>
                </details>
              </div>
            ) : null}
            {activeStep === "verification" ? (
              <div className="mt-4 space-y-4">
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 block">Verification mode</span>
                  <select
                    value={selectedConnection.verification.mode}
                    onChange={(event) => updateSection("verification", { mode: event.target.value })}
                    className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  >
                    {VERIFICATION_MODES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <input
                    type="checkbox"
                    checked={selectedConnection.verification.allow_unverified}
                    onChange={(event) => updateSection("verification", { allow_unverified: event.target.checked })}
                  />
                  Allow unverified (production override)
                </label>

                {selectedConnection.verification.mode === "api_key" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Header name</span>
                      <input
                        value={selectedConnection.verification.api_key.header_name}
                        onChange={(event) => updateNested("verification", "api_key", { header_name: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Secret</span>
                      <input
                        type="password"
                        value={selectedConnection.verification.api_key.secret}
                        onChange={(event) => updateNested("verification", "api_key", { secret: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                  </div>
                ) : null}

                {selectedConnection.verification.mode === "hmac_signature" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Signature header</span>
                      <input
                        value={selectedConnection.verification.hmac_signature.header_name}
                        onChange={(event) => updateNested("verification", "hmac_signature", { header_name: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Timestamp header</span>
                      <input
                        value={selectedConnection.verification.hmac_signature.timestamp_header}
                        onChange={(event) => updateNested("verification", "hmac_signature", { timestamp_header: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Secret</span>
                      <input
                        type="password"
                        value={selectedConnection.verification.hmac_signature.secret}
                        onChange={(event) => updateNested("verification", "hmac_signature", { secret: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Algorithm</span>
                      <input
                        value={selectedConnection.verification.hmac_signature.algorithm}
                        onChange={(event) => updateNested("verification", "hmac_signature", { algorithm: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Encoding</span>
                      <input
                        value={selectedConnection.verification.hmac_signature.encoding}
                        onChange={(event) => updateNested("verification", "hmac_signature", { encoding: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Max skew (sec)</span>
                      <input
                        type="number"
                        value={selectedConnection.verification.hmac_signature.max_skew_sec}
                        onChange={(event) => updateNested("verification", "hmac_signature", { max_skew_sec: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                  </div>
                ) : null}

                {selectedConnection.verification.mode === "oauth2_jwt" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Header name</span>
                      <input
                        value={selectedConnection.verification.oauth2_jwt.header_name}
                        onChange={(event) => updateNested("verification", "oauth2_jwt", { header_name: event.target.value })}
                        placeholder="Authorization"
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Token prefix</span>
                      <input
                        value={selectedConnection.verification.oauth2_jwt.token_prefix}
                        onChange={(event) => updateNested("verification", "oauth2_jwt", { token_prefix: event.target.value })}
                        placeholder="Bearer"
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Issuer</span>
                      <input
                        value={selectedConnection.verification.oauth2_jwt.issuer}
                        onChange={(event) => updateNested("verification", "oauth2_jwt", { issuer: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Audience</span>
                      <input
                        value={selectedConnection.verification.oauth2_jwt.audience}
                        onChange={(event) => updateNested("verification", "oauth2_jwt", { audience: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">JWKS URL</span>
                      <input
                        value={selectedConnection.verification.oauth2_jwt.jwks_url}
                        onChange={(event) => updateNested("verification", "oauth2_jwt", { jwks_url: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Shared secret (optional)</span>
                      <input
                        type="password"
                        value={selectedConnection.verification.oauth2_jwt.secret}
                        onChange={(event) => updateNested("verification", "oauth2_jwt", { secret: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Max skew (sec)</span>
                      <input
                        type="number"
                        value={selectedConnection.verification.oauth2_jwt.max_skew_sec}
                        onChange={(event) => updateNested("verification", "oauth2_jwt", { max_skew_sec: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Max age (sec)</span>
                      <input
                        type="number"
                        value={selectedConnection.verification.oauth2_jwt.max_age_sec}
                        onChange={(event) => updateNested("verification", "oauth2_jwt", { max_age_sec: event.target.value })}
                        className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400 md:col-span-2">
                      <span className="mb-1 block">Test JWT (optional)</span>
                      <textarea
                        value={selectedConnection.verification.oauth2_jwt.test_token}
                        onChange={(event) => updateNested("verification", "oauth2_jwt", { test_token: event.target.value })}
                        placeholder="Paste a signed JWT if JWKS is used."
                        className="min-h-[70px] w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeStep === "idempotency" ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 block">Event ID location</span>
                  <select
                    value={selectedConnection.idempotency.event_id_location}
                    onChange={(event) => updateSection("idempotency", { event_id_location: event.target.value })}
                    className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  >
                    <option value="header">Header</option>
                    <option value="body">Body path</option>
                  </select>
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 block">Event ID key</span>
                  <input
                    value={selectedConnection.idempotency.event_id_key}
                    onChange={(event) => updateSection("idempotency", { event_id_key: event.target.value })}
                    className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  />
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 block">Idempotency scope</span>
                  <input
                    value={selectedConnection.idempotency.idempotency_scope}
                    onChange={(event) => updateSection("idempotency", { idempotency_scope: event.target.value })}
                    className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  />
                </label>
              </div>
            ) : null}
            {activeStep === "routing" ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 block">Channel</span>
                  <select
                    value={selectedConnection.routing.channel}
                    onChange={(event) => updateSection("routing", { channel: event.target.value })}
                    className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  >
                    {CHANNEL_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 block">Protocol</span>
                  <input
                    list="gateway-protocols"
                    value={selectedConnection.routing.protocol}
                    onChange={(event) => updateSection("routing", { protocol: event.target.value })}
                    placeholder="HTTPS, AS2, SFTP..."
                    className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  />
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 block">Schema version</span>
                  <input
                    value={selectedConnection.routing.schema_version}
                    onChange={(event) => updateSection("routing", { schema_version: event.target.value })}
                    className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  />
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 block">Envelope profile</span>
                  <input
                    value={selectedConnection.routing.envelope_profile}
                    onChange={(event) => updateSection("routing", { envelope_profile: event.target.value })}
                    className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  />
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  <span className="mb-1 block">Mapping mode</span>
                  <select
                    value={selectedConnection.routing.mapping_mode}
                    onChange={(event) => updateSection("routing", { mapping_mode: event.target.value })}
                    className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  >
                    {MAPPING_MODES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400 md:col-span-2">
                  <span className="mb-1 block">Supported message types</span>
                  <textarea
                    value={selectedConnection.routing.supported_message_types_text}
                    onChange={(event) => updateSection("routing", { supported_message_types_text: event.target.value })}
                    className="min-h-[70px] w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  />
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400 md:col-span-2">
                  <span className="mb-1 block">Mapping rules (JSON)</span>
                  <textarea
                    value={selectedConnection.routing.mapping_rules_text}
                    onChange={(event) => updateSection("routing", { mapping_rules_text: event.target.value })}
                    className="min-h-[80px] w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                  />
                </label>
              </div>
            ) : null}

            {activeStep === "audit" ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                    <span className="mb-1 block">Audit record type</span>
                    <input
                      value={selectedConnection.audit.audit_record_type}
                      onChange={(event) => updateSection("audit", { audit_record_type: event.target.value })}
                      className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                    />
                  </label>
                  <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                    <span className="mb-1 block">Max body size</span>
                    <input
                      type="number"
                      value={selectedConnection.audit.max_body_size}
                      onChange={(event) => updateSection("audit", { max_body_size: Number(event.target.value) })}
                      className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                    />
                  </label>
                  <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                    <span className="mb-1 block">Log level</span>
                    <select
                      value={selectedConnection.audit.log_level}
                      onChange={(event) => updateSection("audit", { log_level: event.target.value })}
                      className="w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                    >
                      {LOG_LEVELS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <details className="rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs">
                  <summary className="cursor-pointer text-[0.65rem] uppercase tracking-[0.2em] text-ink-400">
                    Advanced settings
                  </summary>
                  <div className="mt-3 space-y-3">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">IP allowlist</span>
                      <textarea
                        value={selectedConnection.audit.ip_allowlist_text}
                        onChange={(event) => updateSection("audit", { ip_allowlist_text: event.target.value })}
                        className="min-h-[70px] w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
                      <span className="mb-1 block">Redaction policy (JSON)</span>
                      <textarea
                        value={selectedConnection.audit.redaction_policy_text}
                        onChange={(event) => updateSection("audit", { redaction_policy_text: event.target.value })}
                        className="min-h-[80px] w-full rounded-lg border border-ink-200/70 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                  </div>
                </details>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass-panel rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">API Keys</h3>
              <button
                type="button"
                onClick={handleCreateKey}
                className="rounded-full bg-ink-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-glow"
              >
                New key
              </button>
            </div>
            {rawKey ? (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                Raw key (copy now): <span className="font-mono">{rawKey}</span>
              </div>
            ) : null}
            <div className="mt-3 space-y-2 text-xs text-ink-600">
              {(detail?.api_keys || []).map((key) => (
                <div key={key.id} className="rounded-2xl border border-white/60 bg-white/80 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-ink-900">{key.label}</p>
                      <p className="text-[0.65rem] text-ink-400">{key.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {key.is_active ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRotateKey(key.id)}
                            className="rounded-full border border-ink-200/60 bg-white px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-900"
                          >
                            Rotate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevokeKey(key.id)}
                            className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-rose-500 hover:text-rose-700"
                          >
                            Revoke
                          </button>
                        </>
                      ) : null}
                      <span className={`text-[0.6rem] uppercase tracking-[0.2em] ${key.is_active ? "text-emerald-500" : "text-rose-400"}`}>
                        {key.is_active ? "active" : "revoked"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-ink-900">Connection Health</h3>
            <div className="mt-3 grid gap-2 text-xs text-ink-600">
              <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/80 px-3 py-2">
                <span>Last 24h handshakes</span>
                <span className="font-semibold">{detail?.health?.last_24h ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/80 px-3 py-2">
                <span>Last 7d handshakes</span>
                <span className="font-semibold">{detail?.health?.last_7d ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/80 px-3 py-2">
                <span>Last seen</span>
                <span className="font-semibold">
                  {detail?.health?.last_seen ? new Date(detail.health.last_seen).toLocaleString() : "?"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <ActionMiniModal
          open={Boolean(miniModalRequest)}
          mode={miniModalRequest?.mode || "confirm"}
          title={miniModalRequest?.title || "Confirm action"}
          message={miniModalRequest?.message || ""}
          confirmLabel={miniModalRequest?.confirmLabel || "Confirm"}
          cancelLabel="Cancel"
          confirmTone={miniModalRequest?.confirmTone || "default"}
          onCancel={() => closeMiniModal(false)}
          onConfirm={() => closeMiniModal(true)}
        />
      </div>
    </div>
  );
}
