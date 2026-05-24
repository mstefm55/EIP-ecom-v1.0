const MAX_STRING_LENGTH = 2048;
const MAX_ARRAY_LENGTH = 100;
const MAX_DEPTH = 8;

const FIELD_MAP = {
  tenantId: "tenant_id",
  identityId: "actor_identity_id",
  actorTenantId: "actor_tenant_id",
  actorIdentityId: "actor_identity_id",
  targetTenantId: "target_tenant_id",
  targetIdentityId: "target_identity_id",
  connectionCode: "connection_code",
  connection_code: "connection_code",
  suffix: "suffix",
  eventId: "event_id",
  event_id: "event_id",
  requestId: "request_id",
  request_id: "request_id",
  ip: "ip",
  userAgent: "user_agent",
  user_agent: "user_agent",
  reason: "reason",
  category: "category",
  severity: "severity",
  outcome: "outcome",
  source: "source"
};

const SAFE_SENSITIVE_LIKE_KEYS = new Set([
  "secret_kind",
  "secret_kinds",
  "secret_status",
  "secret_version",
  "secret_versions"
]);
const SENSITIVE_KEY_TOKENS = [
  "authorization",
  "cookie",
  "set_cookie",
  "x_api_key",
  "api_key",
  "apikey",
  "secret",
  "token",
  "password",
  "credential",
  "public_key",
  "private_key",
  "signature",
  "csrf",
  "sid",
  "did",
  "otp",
  "totp",
  "recovery"
];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeSeverity(value) {
  const severity = normalizeText(value || "info").toLowerCase();
  if (["debug", "info", "warning", "error", "critical"].includes(severity)) return severity;
  return "info";
}

function normalizeOutcome(value) {
  const outcome = normalizeText(value || "observed").toLowerCase();
  if (["success", "failure", "denied", "rejected", "blocked", "error", "observed"].includes(outcome)) {
    return outcome;
  }
  return "observed";
}

function inferCategory(eventType) {
  const value = normalizeText(eventType).toLowerCase();
  if (value.startsWith("gateway.") || value.startsWith("connection.")) return "gateway";
  if (value.startsWith("commerce.")) return "public_commerce";
  if (value.startsWith("passkey.") || value.startsWith("login_") || value.startsWith("auth.")) return "auth";
  if (value.startsWith("recovery.")) return "recovery";
  if (value.startsWith("bootstrap.")) return "bootstrap";
  if (value.startsWith("tenant_onboarding.")) return "onboarding";
  if (value.startsWith("template.")) return "template";
  if (value.startsWith("upload.")) return "upload";
  if (value.startsWith("tenant.")) return "tenant_isolation";
  return "security";
}

function isSensitiveKey(key) {
  const normalized = String(key || "").toLowerCase().replace(/[.-]/g, "_");
  if (SAFE_SENSITIVE_LIKE_KEYS.has(normalized)) return false;
  return SENSITIVE_KEY_TOKENS.some((token) => normalized === token || normalized.includes(token));
}

export function redactSecurityDetails(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (Buffer.isBuffer(value)) return `[BUFFER ${value.length} bytes]`;
  if (depth > MAX_DEPTH) return "[TRUNCATED_DEPTH]";
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...[TRUNCATED]`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => redactSecurityDetails(item, depth + 1));
  }
  if (typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = isSensitiveKey(key) ? "[REDACTED]" : redactSecurityDetails(item, depth + 1);
    }
    return output;
  }
  return String(value);
}

export function buildSecurityEvent(eventType, details = {}) {
  const input = details && typeof details === "object" ? details : {};
  const resolvedType = normalizeText(eventType || input.event_type || input.action || "security.event");
  const metadata = redactSecurityDetails(input.metadata || input.attrs || {});
  const event = {
    event_type: resolvedType,
    category: normalizeText(input.category || inferCategory(resolvedType)),
    severity: normalizeSeverity(input.severity),
    outcome: normalizeOutcome(input.outcome),
    tenant_id: null,
    actor_tenant_id: null,
    actor_identity_id: null,
    target_tenant_id: null,
    target_identity_id: null,
    connection_code: null,
    suffix: null,
    event_id: null,
    request_id: null,
    ip: null,
    user_agent: null,
    reason: null,
    source: normalizeText(input.source || "api"),
    metadata
  };

  for (const [key, column] of Object.entries(FIELD_MAP)) {
    const value = input[key];
    if (value === undefined || value === null || value === "") continue;
    event[column] = redactSecurityDetails(value);
  }

  if (!event.tenant_id) {
    event.tenant_id = event.target_tenant_id || event.actor_tenant_id || null;
  }

  return event;
}

async function persistSecurityEvent(app, event) {
  if (!app?.db?.query) return null;
  try {
    const r = await app.db.query(
      `
      INSERT INTO eip_core.security_event
        (event_type, category, severity, outcome,
         tenant_id, actor_tenant_id, actor_identity_id,
         target_tenant_id, target_identity_id,
         connection_code, suffix, event_id, request_id,
         ip, user_agent, reason, source, metadata)
      VALUES
        ($1,$2,$3,$4,
         $5::uuid,$6::uuid,$7::uuid,
         $8::uuid,$9::uuid,
         $10,$11,$12,$13,
         $14,$15,$16,$17,$18::jsonb)
      RETURNING id
      `,
      [
        event.event_type,
        event.category,
        event.severity,
        event.outcome,
        event.tenant_id,
        event.actor_tenant_id,
        event.actor_identity_id,
        event.target_tenant_id,
        event.target_identity_id,
        event.connection_code,
        event.suffix,
        event.event_id,
        event.request_id,
        event.ip,
        event.user_agent,
        event.reason,
        event.source,
        JSON.stringify(event.metadata || {})
      ]
    );
    return r.rows[0]?.id || null;
  } catch (error) {
    app?.log?.warn?.({
      event: "security_event_persist_failed",
      event_type: event.event_type,
      error: error?.message
    });
    return null;
  }
}

function logSecurityEvent(app, event) {
  app?.log?.info?.({
    event: "security_audit",
    ...event
  });
}

export async function emitSecurityEvent(app, eventType, details = {}) {
  const event = buildSecurityEvent(eventType, details);
  logSecurityEvent(app, event);
  event.id = await persistSecurityEvent(app, event);
  return event;
}

export function auditSecurityEvent(app, action, details = {}) {
  const event = buildSecurityEvent(action, details);
  logSecurityEvent(app, event);
  void persistSecurityEvent(app, event);
  return event;
}
