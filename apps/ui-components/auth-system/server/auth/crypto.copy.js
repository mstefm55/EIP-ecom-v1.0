import crypto from "node:crypto";

/**
 * Secure random token (URL-safe)
 * Used for: device IDs, CSRF tokens, nonces
 */
export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

/**
 * Secure random digits (OTP)
 * Example: randomDigits(6) -> "483920"
 */
export function randomDigits(length = 6) {
  const max = 10 ** length;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(length, "0");
}

/**
 * SHA-256 hex digest
 * Used for: OTP hash, CSRF secret hash, token fingerprints
 */
export function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Timing-safe equality check
 * Prevents timing attacks on comparisons
 */
export function timingSafeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
