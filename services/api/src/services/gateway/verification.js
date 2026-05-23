import crypto from "node:crypto";
import { timingSafeEqual } from "../../auth/crypto.js";

const JWKS_CACHE = new Map();
const JWKS_TTL_MS = 10 * 60 * 1000;

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOrigin(origin) {
  if (!origin) return "";
  return origin.trim().toLowerCase();
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
  const sandbox = isSandbox(profile);
  if (!allowlist.length) return sandbox;
  if (!origin) {
    return allowlist.some((entry) => {
      const normalized = normalizeOrigin(entry);
      return normalized === "no-origin" || normalized === "server";
    });
  }
  const normalized = normalizeOrigin(origin);
  return allowlist.some((entry) => {
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
    if (!timingSafeEqual(provided, expected)) {
      return { ok: false, error: "INVALID_API_KEY" };
    }
    return { ok: true };
  }

  if (mode === "hmac_signature") {
    const config = verification.hmac_signature || {};
    const headerName = normalizeText(config.header_name);
    const expected = getHeader(req, headerName);
    if (!headerName || !expected) return { ok: false, error: "SIGNATURE_HEADER_MISSING" };
    if (!normalizeText(config.secret)) return { ok: false, error: "SIGNATURE_SECRET_MISSING" };

    const tsHeader = normalizeText(config.timestamp_header);
    if (!tsHeader) return { ok: false, error: "SIGNATURE_TIMESTAMP_CONFIG_REQUIRED" };
    const rawTs = getHeader(req, tsHeader);
    if (!rawTs) return { ok: false, error: "SIGNATURE_TIMESTAMP_MISSING" };
    const ts = normalizeEpochSeconds(rawTs);
    if (!ts) return { ok: false, error: "SIGNATURE_TIMESTAMP_INVALID" };
    const maxSkew = Number.isFinite(Number(config.max_skew_sec))
      ? Number(config.max_skew_sec)
      : 300;
    const nowSec = Number.isFinite(Number(opts.nowSec))
      ? Number(opts.nowSec)
      : Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - ts) > maxSkew) {
      return { ok: false, error: "SIGNATURE_TIMESTAMP_EXPIRED" };
    }

    const computed = buildHmacSignature({ ...config, timestamp: rawTs }, rawBody);
    if (!timingSafeEqual(expected, computed)) return { ok: false, error: "SIGNATURE_MISMATCH" };
    return { ok: true };
  }

  if (mode === "oauth2_jwt") {
    const config = verification.oauth2_jwt || {};
    const headerName = normalizeText(config.header_name);
    const headerValue = getHeader(req, headerName);
    if (!headerName || !headerValue) return { ok: false, error: "JWT_HEADER_MISSING" };
    const tokenPrefix = normalizeText(config.token_prefix || "");
    const expectedPrefix = tokenPrefix ? `${tokenPrefix} ` : "";
    if (expectedPrefix && !headerValue.startsWith(expectedPrefix)) {
      return { ok: false, error: "JWT_PREFIX_MISMATCH" };
    }
    const token = expectedPrefix ? headerValue.slice(expectedPrefix.length).trim() : headerValue;
    const ok = await verifyJwtSignature(
      token,
      {
        issuer: config.issuer,
        audience: config.audience,
        jwks_url: config.jwks_url,
        secret: config.secret,
        max_skew_sec: config.max_skew_sec,
        max_age_sec: config.max_age_sec
      },
      opts
    );
    if (!ok) return { ok: false, error: "JWT_INVALID" };
    return { ok: true };
  }

  return { ok: false, error: "VERIFICATION_MODE_UNSUPPORTED" };
}

function extractEventId(req, body, profile) {
  const idem = profile?.idempotency || {};
  const location = normalizeText(idem.event_id_location).toLowerCase();
  const key = normalizeText(idem.event_id_key);
  if (!location || !key) return null;
  if (location === "header") {
    return getHeader(req, key);
  }
  if (location === "body") {
    return normalizeText(getBodyPath(body, key));
  }
  return null;
}

export {
  buildHmacSignature,
  connectionAllowsOrigin,
  extractEventId,
  getHeader,
  normalizeEpochSeconds,
  verifyConnectionRequest,
  verifyJwtSignature
};
