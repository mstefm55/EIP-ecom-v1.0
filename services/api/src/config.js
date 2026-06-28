export const envSchema = {
  type: "object",
  required: [
    "NODE_ENV", 
    "PORT", 
    "HOST", 
    "CORS_ORIGIN", 
     "COOKIE_SECRET",
    "DB_HOST", 
    "DB_USER", 
    "DB_PASSWORD", 
    "DB_DATABASE",
    "API_KEY_PEPPER",
    "OTP_PEPPER",
    "CSRF_PEPPER",
    "BOOTSTRAP_TOKEN_PEPPER",
    "REQUIRE_TRUSTED_DEVICE",
    "ELECTRON_CHALLENGE_TTL_SEC",
    "ELECTRON_DEVICE_REQUIRE_TRUSTED",
    "TOTP_SECRET_KEY",
   // "PG_POOL_MAX ",//
  ],
  properties: {
    NODE_ENV: { type: "string", default: "development" },
    PORT: { type: "integer", default: 4000 },
    HOST: { type: "string", default: "0.0.0.0" },
    CORS_ORIGIN: { type: "string", default: "http://localhost:5173,http://localhost:5174" },
    CORS_ORIGIN_PUBLIC: { type: "string" },
    COOKIE_SECRET: { type: "string", minLength: 1 },
    AUTH_COOKIE_CROSS_SITE: { type: "boolean", default: false },
    AUTH_COOKIE_PREFIX: { type: "string", default: "" },
    EIP_ORIGIN_REQUIRED: { type: "boolean", default: false },
    EIP_FETCH_METADATA_GUARD: { type: "boolean", default: true },
    OWNER_TENANT_CODE: { type: "string", default: "" },
    SECRET_ENCRYPTION_KEY: { type: "string", default: "" },
    SECRET_ENCRYPTION_KEY_ID: { type: "string", default: "default" },
    API_KEY_PEPPER: { type: "string", minLength: 1 },
    ACCESS_GRANT_PEPPER: { type: "string" },
    CSRF_PEPPER: { type: "string", minLength: 1 },
    BOOTSTRAP_TOKEN_PEPPER: { type: "string", minLength: 1 },
    BOOTSTRAP_URL_BASE: { type: "string", default: "" },
    REQUIRE_TRUSTED_DEVICE: { type: "boolean", default: true },
    ELECTRON_CHALLENGE_TTL_SEC: { type: "integer", default: 120 },
    ELECTRON_DEVICE_REQUIRE_TRUSTED: { type: "boolean", default: true },
    AUTH_AUTO_TRUST_ON_STEP_UP: { type: "boolean", default: true },
    ENABLE_DEBUG_ROUTES: { type: "boolean", default: false },
    ENABLE_ADMIN_DB_EXPLORER: { type: "boolean", default: false },
    ENABLE_PUBLIC_DB_HEALTH: { type: "boolean", default: false },
    LOG_DEV_OTP: { type: "boolean", default: false },
    PUBLIC_TENANT_GUARD: { type: "boolean", default: true },
    SESSION_IDLE_TTL_MIN: { type: "integer", default: 15 },
    SESSION_ABSOLUTE_TTL_HOURS: { type: "integer", default: 4 },
    STEP_UP_TTL_MIN: { type: "integer", default: 5 },
    REQUIRE_PASSKEY_FOR_PRIVILEGED_ACTIONS: { type: "boolean", default: false },
    WEBAUTHN_RP_ID: { type: "string", default: "" },
    WEBAUTHN_RP_NAME: { type: "string", default: "EIP" },
    WEBAUTHN_ORIGIN: { type: "string", default: "" },
    WEBAUTHN_TIMEOUT_MS: { type: "integer", default: 60000 },
    DEVICE_COOKIE_TTL_DAYS: { type: "integer", default: 14 },
    ASSET_ROOT: { type: "string", default: "" },
    ASSET_TOKEN_REQUIRED: { type: "boolean", default: true },
    ASSET_TOKEN_TTL_SEC: { type: "integer", default: 604800 },
    UPLOAD_MAX_BYTES: { type: "integer", default: 15728640 },
    UPLOAD_SCAN_MODE: { type: "string", default: "inline_blocking" },
    UPLOAD_SCAN_ENDPOINT: { type: "string", default: "" },
    UPLOAD_SCAN_API_KEY: { type: "string", default: "" },
    UPLOAD_SCAN_TIMEOUT_MS: { type: "integer", default: 5000 },
    ADMIN_DB_BREAK_GLASS_TTL_MIN: { type: "integer", default: 15 },
    ADMIN_DB_SENSITIVE_GRANT_TTL_MIN: { type: "integer", default: 15 },
    PASSWORD_BLOCKLIST_PATH: { type: "string", default: "" },
    INBOUND_RATE_LIMIT_MAX: { type: "integer", default: 120 },
    INBOUND_RATE_LIMIT_WINDOW_SEC: { type: "integer", default: 60 },
    PUBLIC_GATEWAY_QUOTA_MAX: { type: "integer", default: 3000 },
    PUBLIC_GATEWAY_QUOTA_WINDOW_SEC: { type: "integer", default: 3600 },
    PUBLIC_COMMERCE_QUOTA_MAX: { type: "integer", default: 5000 },
    PUBLIC_COMMERCE_QUOTA_WINDOW_SEC: { type: "integer", default: 3600 },
    OWNER_ADMIN_PASSKEY_STEP_UP_REQUIRED: { type: "boolean", default: true },
    STOREFRONT_RENDERED_SCAN_ENABLED: { type: "boolean", default: true },
    STOREFRONT_RENDERED_SCAN_EXECUTABLE_PATH: { type: "string", default: "" },
    STOREFRONT_RENDERED_SCAN_TIMEOUT_MS: { type: "integer", default: 15000 },
    STOREFRONT_RENDERED_SCAN_WAIT_MS: { type: "integer", default: 900 },
    STOREFRONT_STRUCTURE_SCAN_TIMEOUT_MS: { type: "integer", default: 30000 },
    STOREFRONT_RENDERED_SCAN_MAX_HTML_CHARS: { type: "integer", default: 1048576 },
    STOREFRONT_RENDERED_SCAN_MAX_REQUESTS: { type: "integer", default: 300 },
    STOREFRONT_RENDERED_SCAN_ALLOW_NO_SANDBOX: { type: "boolean", default: false },

    // 2. Define the types for your DB variables
    DB_HOST: { type: "string", default: "localhost" },
    DB_PORT: { type: "integer", default: 5432 },
    DB_USER: { type: "string" },
    DB_PASSWORD: { type: "string" },
    DB_DATABASE: { type: "string" },
    OTP_PEPPER: { type: "string", minLength: 1 },
    TOTP_ISSUER: { type: "string", default: "EIP" },
    TOTP_SECRET_KEY: { type: "string", minLength: 64, maxLength: 64, pattern: "^[0-9a-fA-F]+$" },
    REQUIRED_TENANT_AGREEMENTS: { type: "string", default: "" },

    EMAIL_PROVIDER: { type: "string", default: "" },
    EMAIL_API_KEY: { type: "string", default: "" },
    EMAIL_API_BASE_URL: { type: "string", default: "https://api.brevo.com/v3/smtp/email" },
    EMAIL_FROM: { type: "string", default: "noreply@eip-core.com" },
    EMAIL_FROM_NAME: { type: "string", default: "" },
    BREVO_API_KEY: { type: "string", default: "" },

    // Email SMTP fallback settings
    SMTP_HOST: { type: "string" },
    SMTP_PORT: { type: "integer", default: 587 },
    SMTP_SECURE: { type: "boolean", default: false },
    SMTP_USER: { type: "string" },
    SMTP_PASS: { type: "string" },
    SMTP_FROM: { type: "string", default: "" },

    PASSWORD_RESET_URL_BASE: { type: "string" },
    PASSWORD_RESET_PEPPER: { type: "string" },
    RECOVERY_TOKEN_URL_BASE: { type: "string" },
    RECOVERY_TOKEN_PEPPER: { type: "string" },
    RECOVERY_TOKEN_TTL_MIN: { type: "integer", default: 30 },
    ALLOW_RECOVERY_NO_TOTP: { type: "boolean", default: false },
    // 3. Add PG_POOL_MAX as an integer
    PG_POOL_MAX: { type: "integer", default: 10 },
    TRANSLATION_PROVIDER_ENABLED: { type: "boolean", default: false },
    TRANSLATION_PROVIDER_CODE: { type: "string", default: "" },
    TRANSLATION_PROVIDER_BASE_URL: { type: "string", default: "" },
    TRANSLATION_PROVIDER_API_KEY: { type: "string", default: "" },
    TRANSLATION_PROVIDER_API_REGION: { type: "string", default: "" },
    TRANSLATION_PROVIDER_MODEL: { type: "string", default: "" },
    TRANSLATION_PROVIDER_TIMEOUT_MS: { type: "integer", default: 15000 },
    TRANSLATION_SOURCE_LANG: { type: "string", default: "en" },
    TRANSLATION_TARGET_LANGS: { type: "string", default: "" },
    OPENAI_API_KEY: { type: "string", default: "" },
    OPENAI_MODEL_DEFAULT: { type: "string", default: "" },
    FX_SYNC_ENABLED: { type: "boolean", default: true },
    FX_SYNC_INTERVAL_MIN: { type: "integer", default: 1440 },
    FX_SYNC_FRESHNESS_HOURS: { type: "integer", default: 24 },
    FX_BASE_CURRENCY: { type: "string", default: "USD" },
    FX_PRIMARY_PROVIDER: { type: "string", default: "openexchangerates" },
    FX_FALLBACK_PROVIDER: { type: "string", default: "ecb" },
    FX_PROVIDER_PRIORITY: { type: "string", default: "" },
    FX_TIMEOUT_MS: { type: "integer", default: 12000 },
    FX_OPENEXCHANGERATES_APP_ID: { type: "string", default: "" },
    FX_OPENEXCHANGERATES_CONNECTION_CODE: { type: "string", default: "" },
    FX_ECB_CONNECTION_CODE: { type: "string", default: "" }
  }
};

export function parseRequiredAgreements(rawValue, nodeEnv) {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    if (String(nodeEnv || "").toLowerCase() === "production") {
      throw new Error("REQUIRED_TENANT_AGREEMENTS_EMPTY");
    }
    return [];
  }

  let entries = [];
  if (raw.startsWith("[")) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("REQUIRED_TENANT_AGREEMENTS_INVALID_JSON");
    }
    if (!Array.isArray(parsed)) {
      throw new Error("REQUIRED_TENANT_AGREEMENTS_INVALID_JSON");
    }
    entries = parsed.map((item) => {
      if (typeof item === "string") {
        const [code, version] = item.split(":");
        return { code, version };
      }
      return item || {};
    });
  } else {
    entries = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [code, version] = item.split(":");
        return { code, version };
      });
  }

  const out = [];
  const seen = new Set();
  const seenCodes = new Set();
  for (const entry of entries) {
    const code = String(entry.code || "").trim().toUpperCase();
    const version = String(entry.version || "").trim();
    if (!code || !version) {
      throw new Error("REQUIRED_TENANT_AGREEMENTS_INVALID_ENTRY");
    }
    if (code.length > 64 || version.length > 64) {
      throw new Error("REQUIRED_TENANT_AGREEMENTS_INVALID_ENTRY");
    }
    const key = `${code}:${version}`;
    if (seen.has(key)) continue;
    if (seenCodes.has(code)) {
      throw new Error("REQUIRED_TENANT_AGREEMENTS_DUPLICATE_CODE");
    }
    seen.add(key);
    seenCodes.add(code);
    out.push({ code, version });
  }

  if (out.length === 0) {
    throw new Error("REQUIRED_TENANT_AGREEMENTS_EMPTY");
  }

  return out;
}
