import crypto from "node:crypto";

const DIRECTIONS = ["inbound", "outbound", "both"];
const ENVIRONMENTS = ["sandbox", "production"];
const VERIFICATION_MODES = ["none", "api_key", "hmac_signature", "oauth2_jwt"];
const AUTH_MODES = [
  "none",
  "bearer_token",
  "api_key_header",
  "api_key_query",
  "basic",
  "oauth2_client_credentials"
];
const CHANNELS = [
  "website_intake",
  "edi",
  "banking",
  "payments",
  "social",
  "email",
  "custom"
];
const MAPPING_MODES = ["passthrough", "mapped"];
const LOG_LEVELS = ["error", "warn", "info", "debug"];
const HTTP_METHODS = ["POST", "PUT", "PATCH"];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function slugifyCode(value) {
  const base = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) return "conn";
  if (base.length < 3) return `${base}-conn`;
  return base.slice(0, 65);
}

function normalizeProfile(raw = {}, fallbackId) {
  const identity = raw.identity || {};
  const inbound = raw.inbound || {};
  const outbound = raw.outbound || {};
  const verification = raw.verification || {};
  const idempotency = raw.idempotency || {};
  const routing = raw.routing || {};
  const audit = raw.audit || {};

  const connectionName = normalizeText(identity.connection_name || raw.connection_name);
  const connectionCodeRaw = normalizeText(identity.connection_code || raw.connection_code);
  const connectionCode = connectionCodeRaw || slugifyCode(connectionName);
  const direction = DIRECTIONS.includes(identity.direction)
    ? identity.direction
    : DIRECTIONS.includes(raw.direction)
      ? raw.direction
      : "inbound";
  const environment = ENVIRONMENTS.includes(identity.environment)
    ? identity.environment
    : ENVIRONMENTS.includes(raw.environment)
      ? raw.environment
      : "production";

  return {
    id: raw.id || fallbackId || crypto.randomUUID(),
    identity: {
      connection_name: connectionName,
      connection_code: connectionCode,
      connection_kind: normalizeText(identity.connection_kind || raw.connection_kind || "custom"),
      frontend_url: normalizeText(identity.frontend_url || raw.frontend_url),
      portal_url: normalizeText(identity.portal_url || raw.portal_url),
      direction,
      environment,
      is_enabled: normalizeBool(
        identity.is_enabled ?? raw.is_enabled,
        true
      )
    },
    inbound: {
      inbound_path_suffix: normalizeText(inbound.inbound_path_suffix || raw.inbound_path_suffix),
      http_method: normalizeText(inbound.http_method || raw.http_method || "POST").toUpperCase(),
      expected_content_type: normalizeText(
        inbound.expected_content_type || raw.expected_content_type || "application/json"
      ),
      origin_allowlist: normalizeArray(inbound.origin_allowlist || raw.origin_allowlist),
      raw_body_required: normalizeBool(
        inbound.raw_body_required ?? raw.raw_body_required,
        true
      ),
      rate_limit: {
        max: normalizeNumber(inbound.rate_limit?.max ?? raw.rate_limit_max ?? raw.inbound_rate_limit_max),
        window_sec: normalizeNumber(
          inbound.rate_limit?.window_sec ?? raw.rate_limit_window_sec ?? raw.inbound_rate_limit_window_sec
        )
      }
    },
    outbound: {
      base_url: normalizeText(outbound.base_url || raw.base_url),
      path_prefix: normalizeText(outbound.path_prefix || raw.path_prefix || "/"),
      auth_mode: AUTH_MODES.includes(outbound.auth_mode || raw.auth_mode)
        ? outbound.auth_mode || raw.auth_mode
        : "none",
      auth: outbound.auth || raw.auth || {},
      default_headers: outbound.default_headers || raw.default_headers || {},
      timeout_ms: Number(outbound.timeout_ms || raw.timeout_ms || 8000),
      retry_policy: outbound.retry_policy || raw.retry_policy || { max_retries: 2, backoff_ms: 500 },
      healthcheck_path: normalizeText(outbound.healthcheck_path || raw.healthcheck_path || "/health"),
      test_request_method: normalizeText(outbound.test_request_method || raw.test_request_method || "GET").toUpperCase()
    },
    verification: {
      mode: VERIFICATION_MODES.includes(verification.mode || raw.verification_mode)
        ? verification.mode || raw.verification_mode
        : "none",
      allow_unverified: normalizeBool(
        verification.allow_unverified ?? raw.allow_unverified,
        false
      ),
      api_key: verification.api_key || raw.api_key || {},
      hmac_signature: {
        ...(verification.hmac_signature || raw.hmac_signature || {}),
        max_skew_sec: normalizeNumber(
          verification.hmac_signature?.max_skew_sec ?? raw.hmac_signature?.max_skew_sec,
          300
        )
      },
      oauth2_jwt: {
        ...(verification.oauth2_jwt || raw.oauth2_jwt || {}),
        max_skew_sec: normalizeNumber(
          verification.oauth2_jwt?.max_skew_sec ?? raw.oauth2_jwt?.max_skew_sec,
          300
        ),
        max_age_sec: normalizeNumber(
          verification.oauth2_jwt?.max_age_sec ?? raw.oauth2_jwt?.max_age_sec,
          null
        )
      }
    },
    idempotency: {
      event_id_location: normalizeText(idempotency.event_id_location || raw.event_id_location),
      event_id_key: normalizeText(idempotency.event_id_key || raw.event_id_key),
      idempotency_scope: normalizeText(idempotency.idempotency_scope || raw.idempotency_scope)
    },
    routing: {
      channel: normalizeText(routing.channel || raw.channel || "custom"),
      protocol: normalizeText(routing.protocol || raw.protocol),
      supported_message_types: normalizeArray(routing.supported_message_types || raw.supported_message_types),
      schema_version: normalizeText(routing.schema_version || raw.schema_version || "v1"),
      envelope_profile: normalizeText(routing.envelope_profile || raw.envelope_profile || "canonical_v1"),
      mapping_mode: MAPPING_MODES.includes(routing.mapping_mode || raw.mapping_mode)
        ? routing.mapping_mode || raw.mapping_mode
        : "passthrough",
      mapping_rules: routing.mapping_rules || raw.mapping_rules || null
    },
    audit: {
      audit_record_type: normalizeText(audit.audit_record_type || raw.audit_record_type || "GATEWAY_AUDIT"),
      redaction_policy: audit.redaction_policy || raw.redaction_policy || null,
      max_body_size: Number(audit.max_body_size || raw.max_body_size || 262144),
      ip_allowlist: normalizeArray(audit.ip_allowlist || raw.ip_allowlist),
      log_level: normalizeText(audit.log_level || raw.log_level || "info")
    }
  };
}

function extractProfiles(attrs) {
  const list = Array.isArray(attrs?.connection_profiles) ? attrs.connection_profiles : [];
  return list.map((item, index) => normalizeProfile(item, item?.id || `conn-${index + 1}`));
}

function maskSecrets(profile) {
  const masked = JSON.parse(JSON.stringify(profile));
  if (masked.verification?.api_key?.secret) {
    masked.verification.api_key.secret = null;
    masked.verification.api_key.secret_set = true;
  }
  if (masked.verification?.hmac_signature?.secret) {
    masked.verification.hmac_signature.secret = null;
    masked.verification.hmac_signature.secret_set = true;
  }
  if (masked.verification?.oauth2_jwt?.secret) {
    masked.verification.oauth2_jwt.secret = null;
    masked.verification.oauth2_jwt.secret_set = true;
  }
  if (masked.outbound?.auth?.secret) {
    masked.outbound.auth.secret = null;
    masked.outbound.auth.secret_set = true;
  }
  if (masked.outbound?.auth?.token) {
    masked.outbound.auth.token = null;
    masked.outbound.auth.token_set = true;
  }
  if (masked.outbound?.auth?.password) {
    masked.outbound.auth.password = null;
    masked.outbound.auth.password_set = true;
  }
  if (masked.outbound?.auth?.client_secret) {
    masked.outbound.auth.client_secret = null;
    masked.outbound.auth.client_secret_set = true;
  }
  return masked;
}

function mergeSecrets(existing, incoming) {
  const merged = JSON.parse(JSON.stringify(incoming));
  const existingSafe = existing || {};

  const applySecret = (path, key) => {
    const parts = path.split(".");
    let target = merged;
    let source = existingSafe;
    for (const part of parts) {
      if (target[part] === undefined) target[part] = {};
      target = target[part];
      source = source?.[part] || {};
    }
    if (!normalizeText(target[key])) {
      if (source?.[key]) target[key] = source[key];
    }
  };

  applySecret("verification.api_key", "secret");
  applySecret("verification.hmac_signature", "secret");
  applySecret("verification.oauth2_jwt", "secret");
  applySecret("outbound.auth", "secret");
  applySecret("outbound.auth", "token");
  applySecret("outbound.auth", "password");
  applySecret("outbound.auth", "client_secret");

  return merged;
}

function validateProfile(profile) {
  const errors = [];
  const id = profile?.id || "connection";
  const identity = profile?.identity || {};

  if (!identity.connection_name) errors.push(`${id}: connection_name required`);
  if (!identity.connection_code) errors.push(`${id}: connection_code required`);
  if (!/^[a-z0-9][a-z0-9-_]{2,64}$/i.test(identity.connection_code || "")) {
    errors.push(`${id}: connection_code must be URL-safe (3-65 chars)`);
  }
  if (!DIRECTIONS.includes(identity.direction)) errors.push(`${id}: direction invalid`);
  if (!ENVIRONMENTS.includes(identity.environment)) errors.push(`${id}: environment invalid`);

  if (identity.frontend_url && !/^https?:\/\//i.test(identity.frontend_url)) {
    errors.push(`${id}: frontend_url must be an http(s) URL`);
  }
  if (identity.portal_url && !/^https?:\/\//i.test(identity.portal_url)) {
    errors.push(`${id}: portal_url must be an http(s) URL`);
  }

  if (identity.direction === "inbound" || identity.direction === "both") {
    const inbound = profile?.inbound || {};
    if (!inbound.inbound_path_suffix) errors.push(`${id}: inbound_path_suffix required`);
    if (!/^[a-z0-9][a-z0-9-_]{2,64}$/i.test(inbound.inbound_path_suffix || "")) {
      errors.push(`${id}: inbound_path_suffix must be URL-safe (3-65 chars)`);
    }
    if (!HTTP_METHODS.includes(inbound.http_method)) {
      errors.push(`${id}: inbound http_method must be POST/PUT/PATCH`);
    }
    if (!inbound.expected_content_type) errors.push(`${id}: expected_content_type required`);
    if (!inbound.origin_allowlist || inbound.origin_allowlist.length === 0) {
      if (identity.environment !== "sandbox") {
        errors.push(`${id}: origin_allowlist required for inbound connections`);
      }
    }
    if (Array.isArray(inbound.origin_allowlist) && inbound.origin_allowlist.includes("*")) {
      if (identity.environment !== "sandbox") {
        errors.push(`${id}: wildcard origin not allowed in production`);
      }
    }

    const verification = profile?.verification || {};
    if (!VERIFICATION_MODES.includes(verification.mode)) {
      errors.push(`${id}: verification mode invalid`);
    }
    if (
      verification.mode === "none" &&
      identity.environment !== "sandbox"
    ) {
      errors.push(`${id}: verification required for production`);
    }
    if (verification.mode === "api_key") {
      if (!normalizeText(verification.api_key?.header_name)) {
        errors.push(`${id}: api_key header_name required`);
      }
      if (!normalizeText(verification.api_key?.secret)) {
        errors.push(`${id}: api_key secret required`);
      }
    }
    if (verification.mode === "hmac_signature") {
      if (!normalizeText(verification.hmac_signature?.header_name)) {
        errors.push(`${id}: hmac signature header_name required`);
      }
      if (!normalizeText(verification.hmac_signature?.timestamp_header)) {
        errors.push(`${id}: hmac timestamp_header required`);
      }
      if (!normalizeText(verification.hmac_signature?.algorithm)) {
        errors.push(`${id}: hmac algorithm required`);
      }
      if (!normalizeText(verification.hmac_signature?.encoding)) {
        errors.push(`${id}: hmac encoding required`);
      }
      if (!normalizeText(verification.hmac_signature?.secret)) {
        errors.push(`${id}: hmac secret required`);
      }
      const skew = Number(verification.hmac_signature?.max_skew_sec);
      if (!Number.isFinite(skew) || skew < 0) {
        errors.push(`${id}: hmac max_skew_sec must be a positive number`);
      }
    }
    if (verification.mode === "oauth2_jwt") {
      if (!normalizeText(verification.oauth2_jwt?.header_name)) {
        errors.push(`${id}: jwt header_name required`);
      }
      if (!normalizeText(verification.oauth2_jwt?.issuer)) {
        errors.push(`${id}: jwt issuer required`);
      }
      if (!normalizeText(verification.oauth2_jwt?.audience)) {
        errors.push(`${id}: jwt audience required`);
      }
      if (!normalizeText(verification.oauth2_jwt?.jwks_url) && !normalizeText(verification.oauth2_jwt?.secret)) {
        errors.push(`${id}: jwt requires jwks_url or shared secret`);
      }
      const jwtSkew = Number(verification.oauth2_jwt?.max_skew_sec);
      if (!Number.isFinite(jwtSkew) || jwtSkew < 0) {
        errors.push(`${id}: jwt max_skew_sec must be a positive number`);
      }
      const jwtMaxAge = verification.oauth2_jwt?.max_age_sec;
      if (jwtMaxAge !== null && jwtMaxAge !== undefined && jwtMaxAge !== "") {
        const maxAgeNum = Number(jwtMaxAge);
        if (!Number.isFinite(maxAgeNum) || maxAgeNum < 0) {
          errors.push(`${id}: jwt max_age_sec must be a positive number`);
        }
      }
    }

    const idem = profile?.idempotency || {};
    if (!normalizeText(idem.event_id_location)) errors.push(`${id}: event_id_location required`);
    if (!normalizeText(idem.event_id_key)) errors.push(`${id}: event_id_key required`);

    const rate = inbound.rate_limit || {};
    if (rate.max !== null && rate.max !== undefined) {
      if (!Number.isFinite(Number(rate.max)) || Number(rate.max) <= 0) {
        errors.push(`${id}: inbound rate_limit max must be a positive number`);
      }
    }
    if (rate.window_sec !== null && rate.window_sec !== undefined) {
      if (!Number.isFinite(Number(rate.window_sec)) || Number(rate.window_sec) <= 0) {
        errors.push(`${id}: inbound rate_limit window_sec must be a positive number`);
      }
    }
  }

  if (identity.direction === "outbound" || identity.direction === "both") {
    const outbound = profile?.outbound || {};
    if (!normalizeText(outbound.base_url)) errors.push(`${id}: outbound base_url required`);
    if (!normalizeText(outbound.path_prefix)) errors.push(`${id}: outbound path_prefix required`);
    if (!AUTH_MODES.includes(outbound.auth_mode)) errors.push(`${id}: auth_mode invalid`);
    if (outbound.auth_mode === "api_key_header") {
      if (!normalizeText(outbound.auth?.header_name)) errors.push(`${id}: api key header_name required`);
      if (!normalizeText(outbound.auth?.secret)) errors.push(`${id}: api key secret required`);
    }
    if (outbound.auth_mode === "api_key_query") {
      if (!normalizeText(outbound.auth?.query_param_name)) errors.push(`${id}: api key query_param_name required`);
      if (!normalizeText(outbound.auth?.secret)) errors.push(`${id}: api key secret required`);
    }
    if (outbound.auth_mode === "bearer_token") {
      if (!normalizeText(outbound.auth?.token)) errors.push(`${id}: bearer token required`);
    }
    if (outbound.auth_mode === "basic") {
      if (!normalizeText(outbound.auth?.username)) errors.push(`${id}: basic username required`);
      if (!normalizeText(outbound.auth?.password)) errors.push(`${id}: basic password required`);
    }
    if (outbound.auth_mode === "oauth2_client_credentials") {
      if (!normalizeText(outbound.auth?.client_id)) errors.push(`${id}: oauth client_id required`);
      if (!normalizeText(outbound.auth?.client_secret)) errors.push(`${id}: oauth client_secret required`);
      if (!normalizeText(outbound.auth?.token_url)) errors.push(`${id}: oauth token_url required`);
    }
  }

  const routing = profile?.routing || {};
  if (!CHANNELS.includes(routing.channel)) errors.push(`${id}: routing channel invalid`);
  if (!normalizeText(routing.schema_version)) errors.push(`${id}: schema_version required`);
  if (!normalizeText(routing.envelope_profile)) errors.push(`${id}: envelope_profile required`);
  if (!MAPPING_MODES.includes(routing.mapping_mode)) errors.push(`${id}: mapping_mode invalid`);

  const audit = profile?.audit || {};
  if (!normalizeText(audit.audit_record_type)) errors.push(`${id}: audit_record_type required`);
  if (!LOG_LEVELS.includes(audit.log_level)) errors.push(`${id}: log_level invalid`);

  return errors;
}

function validateProfiles(profiles) {
  const errors = [];
  const codes = new Set();
  for (const profile of profiles) {
    errors.push(...validateProfile(profile));
    const code = profile?.identity?.connection_code;
    if (code) {
      if (codes.has(code)) {
        errors.push(`${profile.id}: duplicate connection_code`);
      }
      codes.add(code);
    }
  }
  return errors;
}

export {
  normalizeProfile,
  extractProfiles,
  maskSecrets,
  mergeSecrets,
  validateProfiles,
  normalizeArray,
  normalizeJson
};
