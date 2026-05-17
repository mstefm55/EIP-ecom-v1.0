import crypto from "node:crypto";
import { timingSafeEqual } from "../../auth/crypto.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function canonicalAssetPath(path) {
  const parsed = new URL(normalizeText(path), "http://local");
  return parsed.pathname;
}

function toBase64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function buildAssetSignature(path, expiresAt, pepper) {
  const payload = `${canonicalAssetPath(path)}:${Number(expiresAt)}`;
  return crypto.createHmac("sha256", pepper).update(payload).digest("base64url");
}

function buildSignedAssetUrl(path, expiresAt, pepper) {
  const exp = Number(expiresAt);
  if (!exp || !Number.isFinite(exp)) {
    throw new Error("ASSET_EXPIRES_REQUIRED");
  }
  const canonicalPath = canonicalAssetPath(path);
  const token = buildAssetSignature(canonicalPath, exp, pepper);
  const url = new URL(canonicalPath, "http://local");
  url.searchParams.set("exp", String(exp));
  url.searchParams.set("token", token);
  return url.pathname + url.search;
}

function verifyAssetToken(path, expiresAt, token, pepper) {
  const exp = Number(expiresAt);
  if (!exp || !Number.isFinite(exp)) return false;
  if (Date.now() > exp * 1000) return false;
  const expected = buildAssetSignature(path, exp, pepper);
  return timingSafeEqual(expected, String(token || ""));
}

export {
  buildSignedAssetUrl,
  verifyAssetToken
};
