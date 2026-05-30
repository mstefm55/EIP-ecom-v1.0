import crypto from "node:crypto";
import { timingSafeEqual } from "../../auth/crypto.js";

const JWKS_CACHE = new Map();
const JWKS_TTL_MS = 10 * 60 * 1000;

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOrigin(origin) {
  if (!origin) return "";
  const raw = String(origin || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.origin.toLowerCase();
  } catch {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
}

function originFromUrl(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  try {
    return new URL(raw).origin.toLowerCase();
  } catch {
    return "";
  }
}

function getHeader(req, name) {
  if (!name) return "";
  const key = String(name).toLowerCase();
  return String(req.headers?.[key] || "").trim();
}

function getBodyPath(body, path) {
  if (!body || !path) return null;
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), body);
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (value.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function decodeJwt(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(base64UrlDecode(headerB64).toString("utf8"));
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));
    return {
      header,
      payload,
      signature: signatureB64,
      data: `${headerB64}.${payloadB64}`
    };
  } catch {
    return null;
  }
}

function normalizeEpochSeconds(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
  }
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return null;
  return Math.floor(parsed / 1000);
}

async function fetchJwks(url) {
  const cached = JWKS_CACHE.get(url);
  if (cached && cached.expires > Date.now()) return cached.keys;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) throw new Error("JWKS_FETCH_FAILED");
  const data = await response.json();
  const keys = Array.isArray(data.keys) ? data.keys : [];
  JWKS_CACHE.set(url, { keys, expires: Date.now() + JWKS_TTL_MS });
  return keys;
}

async function verifyJwtSignature(token, config = {}, opts = {}) {
  const decoded = decodeJwt(token);
  if (!decoded) return false;
  const { header, payload, signature, data } = decoded;

  if (config.issuer && payload.iss !== config.issuer) return false;
  if (config.audience) {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(config.audience)) return false;
  }

  const nowSec = Number.isFinite(Number(opts.nowSec))
    ? Number(opts.nowSec)
    : Math.floor(Date.now() / 1000);
  const skewSec = Number.isFinite(Number(config.max_skew_sec))
    ? Number(config.max_skew_sec)
    : 300;
  const exp = normalizeEpochSeconds(payload.exp);
  if (!exp) return false;
  if (nowSec > exp + skewSec) return false;

  const nbf = normalizeEpochSeconds(payload.nbf);
  if (nbf && nowSec + skewSec < nbf) return false;

  const iat = normalizeEpochSeconds(payload.iat);
  if (Number.isFinite(Number(config.max_age_sec))) {
    if (!iat) return false;
    if (nowSec - iat > Number(config.max_age_sec) + skewSec) return false;
  }

  const alg = String(header.alg || "").toUpperCase();
  if (alg === "HS256") {
    const secret = config.secret || "";
    if (!secret) return false;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64url");
    return timingSafeEqual(signature, expected);
  }

  if (alg === "RS256") {
    if (!config.jwks_url) return false;
    const keys = await fetchJwks(config.jwks_url);
    const jwk = keys.find((item) => item.kid === header.kid) || keys[0];
    if (!jwk) return false;
    const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
    const sig = base64UrlDecode(signature);
    return crypto.verify("RSA-SHA256", Buffer.from(data), key, sig);
  }

  return false;
}

function buildHmacSignature(config, rawBody) {
  const algorithm = String(config.algorithm || "sha256").toLowerCase();
  const encoding = String(config.encoding || "hex").toLowerCase();
  const payloadMode = String(config.payload_mode || "raw").toLowerCase();
  let payload = rawBody;
  if (payloadMode === "timestamp_sha256") {
    const timestamp = normalizeText(config.timestamp || "");
    payload = `${timestamp}\n${crypto.createHash("sha256").update(rawBody).digest("hex")}`;
  }
  return crypto.createHmac(algorithm, config.secret).update(payload).digest(encoding);
}

function isSandbox(profile) {
  return normalizeText(profile?.identity?.environment).toLowerCase() === "sandbox";
}

function connectionAllowsOrigin(profile, origin) {
  const allowlist = Array.isArray(profile?.inbound?.origin_allowlist)
    ? profile.inbound.origin_allowlist
    : [];
  const derivedOrigins = [
    originFromUrl(profile?.identity?.frontend_url),
    originFromUrl(profile?.identity?.portal_url)
  ].filter(Boolean);
  const effectiveAllowlist = [...allowlist, ...derivedOrigins];
  const sandbox = isSandbox(profile);
  if (!effectiveAllowlist.length) return sandbox;
  if (!origin) {
    return effectiveAllowlist.some((entry) => {
      const normalized = normalizeOrigin(entry);
      return normalized === "no-origin" || normalized === "server";
    });
  }
  const normalized = normalizeOrigin(origin);
  return effectiveAllowlist.some((entry) => {
    const allowed = normalizeOrigin(entry);
    if (allowed === "*") return sandbox;
    return allowed === normalized;
  });
}

async function verifyConnectionRequest(req, profile, rawBody, opts = {}) {
  const verification = profile?.verification || {};
  const mode = normalizeText(verification.mode || "none").toLowerCase();

  if (mode === "none") {
    if (isSandbox(profile)) return { ok: true };
    return { ok: false, error: "VERIFICATION_REQUIRED" };
  }

  if (mode === "api_key") {
    const headerName = verification.api_key?.header_name;
    const provided = getHeader(req, headerName);
    const expected = normalizeText(verification.api_key?.secret);
    if (!headerName || !expected) return { ok: false, error: "MISSING_API_KEY_CONFIG" };
    if (!provided || !timingSafeEqual(provided, expected)) return { ok: false, error: "INVALID_API_KEY" };
    return { ok: true };
  }

  if (mode === "hmac_signature") {
    const config = verification.hmac_signature || {};
    const headerName = config.header_name || "x-signature";
    const provided = getHeader(req, headerName);
    if (!provided || !config.secret) return { ok: false, error: "MISSING_SIGNATURE" };
    const timestampHeader = config.timestamp_header_name ? getHeader(req, config.timestamp_header_name) : "";
    const maxSkew = Number(config.max_skew_sec || 300);
    if (timestampHeader) {
      const timestampMs = Number(timestampHeader) > 1e12 ? Number(timestampHeader) : Number(timestampHeader) * 1000;
      if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > maxSkew * 1000) {
        return { ok: false, error: "SIGNATURE_TIMESTAMP_INVALID" };
      }
    }
    const expected = buildHmacSignature({ ...config, timestamp: timestampHeader }, rawBody);
    if (!timingSafeEqual(provided.replace(/^sha256=/i, ""), expected)) return { ok: false, error: "SIGNATURE_INVALID" };
    return { ok: true };
  }

  if (mode === "oauth2_jwt") {
    const config = verification.oauth2_jwt || {};
    const token = getHeader(req, config.header_name || "authorization").replace(/^Bearer\s+/i, "");
    const ok = await verifyJwtSignature(token, config, opts);
    return ok ? { ok: true } : { ok: false, error: "JWT_INVALID" };
  }

  return { ok: false, error: "UNSUPPORTED_VERIFICATION_MODE" };
}

function extractEventId(req, body, profile) {
  const idempotency = profile?.idempotency || {};
  const location = normalizeText(idempotency.event_id_location || "header").toLowerCase();
  const key = normalizeText(idempotency.event_id_key || "x-event-id");
  if (location === "body") return normalizeText(getBodyPath(body, key));
  if (location === "query") return normalizeText(req.query?.[key]);
  return normalizeText(getHeader(req, key));
}

export { connectionAllowsOrigin, extractEventId, verifyConnectionRequest };
