const DEFAULT_REDACTION = "[REDACTED]";
const SAFE_SENSITIVE_METADATA = new Set([
  "api_key_saved",
  "client_secret_set",
  "secret_kind",
  "secret_kinds",
  "secret_set",
  "secret_status",
  "secret_version",
  "secret_versions",
  "token_prefix",
  "token_url"
]);

function normalizeKey(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[.\s-]+/g, "_");
}

export function isSensitiveFieldName(value) {
  const key = normalizeKey(value);
  if (!key || SAFE_SENSITIVE_METADATA.has(key)) return false;
  if (/_(?:set|ref|status|version|last_rotated_at|rotated_by)$/.test(key)) return false;
  if (/^(?:signature|api_key)_(?:header|header_name|query_param_name)$/.test(key)) return false;
  if (/^(?:algorithm|encoding|key_id|fingerprint)$/.test(key)) return false;
  return /^(?:authorization|proxy_authorization|cookie|set_cookie|x_api_key|api_key|apikey|secret|client_secret|hmac_secret|webhook_secret|token|access_token|refresh_token|bearer_token|password|passphrase|private_key|signature|credential|csrf|sid|did|otp|totp|recovery)$/.test(key) ||
    /(?:_secret|_token|_password|_passphrase|_private_key|_signature|_api_key)$/.test(key) ||
    /(?:^|_)(?:credential|csrf|otp|totp|recovery)(?:_|$)/.test(key);
}

export function redactSecrets(value, options = {}, depth = 0) {
  const replacement = options.replacement || DEFAULT_REDACTION;
  const maxDepth = Number.isFinite(Number(options.maxDepth)) ? Number(options.maxDepth) : 10;
  const maxStringLength = Number.isFinite(Number(options.maxStringLength))
    ? Number(options.maxStringLength)
    : 4096;
  const maxArrayLength = Number.isFinite(Number(options.maxArrayLength))
    ? Number(options.maxArrayLength)
    : 200;

  if (value === null || value === undefined) return value;
  if (Buffer.isBuffer(value)) return `[BUFFER ${value.length} bytes]`;
  if (depth > maxDepth) return "[TRUNCATED_DEPTH]";
  if (typeof value === "string") {
    return value.length > maxStringLength
      ? `${value.slice(0, maxStringLength)}...[TRUNCATED]`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, maxArrayLength).map((item) => redactSecrets(item, options, depth + 1));
  }
  if (typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      const nestedContainer = item && typeof item === "object";
      output[key] = isSensitiveFieldName(key) && !nestedContainer
        ? replacement
        : redactSecrets(item, options, depth + 1);
    }
    return output;
  }
  return String(value);
}

export function redactSecretText(value) {
  const text = String(value || "");
  if (!text) return text;
  try {
    return JSON.stringify(redactSecrets(JSON.parse(text)));
  } catch {
    return text
      .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/-]+=*/gi, "$1 [REDACTED]")
      .replace(/\b(secret|client_secret|api[_-]?key|token|password|signature)=([^\s&]+)/gi, "$1=[REDACTED]");
  }
}
