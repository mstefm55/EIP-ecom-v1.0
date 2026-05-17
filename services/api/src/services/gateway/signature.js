import crypto from "node:crypto";
import { timingSafeEqual } from "../../auth/crypto.js";

function hmacSha256Base64(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64");
}

function hmacSha256Hex(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function verifySignature(actual, expected) {
  if (!actual || !expected) return false;
  return timingSafeEqual(String(actual), String(expected));
}

function normalizeHeader(req, name) {
  return String(req.headers?.[name.toLowerCase()] || "").trim();
}

function resolveSignatureHeader(req, provider) {
  if (provider === "shopify") {
    return normalizeHeader(req, "x-shopify-hmac-sha256");
  }
  return normalizeHeader(req, "x-signature");
}

function buildCanonicalWebhook(rawBody, timestamp) {
  if (timestamp) {
    return `${timestamp}\n${crypto.createHash("sha256").update(rawBody).digest("hex")}`;
  }
  return rawBody;
}

export {
  hmacSha256Base64,
  hmacSha256Hex,
  verifySignature,
  resolveSignatureHeader,
  normalizeHeader,
  buildCanonicalWebhook
};
