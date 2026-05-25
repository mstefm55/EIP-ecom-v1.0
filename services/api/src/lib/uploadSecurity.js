import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const VIDEO_EXT = new Set([".mp4", ".m4v", ".mov", ".webm"]);
const ZIP_EXT = new Set([".zip", ".docx", ".xlsx", ".pptx", ".zprj", ".zpac"]);
const TEXT_EXT = new Set([".txt", ".csv", ".json", ".dxf"]);
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
const ACTIVE_CONTENT_PATTERN = /<\s*(script|iframe|object|embed|svg|link|meta)\b|javascript\s*:|on[a-z]+\s*=/i;
const DEFAULT_SCAN_TIMEOUT_MS = 5000;

function startsWith(buffer, bytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function hasAscii(buffer, offset, value) {
  return buffer.length >= offset + value.length && buffer.subarray(offset, offset + value.length).toString("ascii") === value;
}

export async function uploadPartToBuffer(filePart) {
  if (typeof filePart?.toBuffer === "function") {
    return filePart.toBuffer();
  }
  if (!filePart?.file) {
    throw new Error("FILE_REQUIRED");
  }
  const chunks = [];
  for await (const chunk of filePart.file) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function safeUploadTarget(rootDir, storedName) {
  const root = path.resolve(rootDir);
  const target = path.resolve(root, storedName);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (!target.startsWith(rootWithSep)) {
    throw new Error("UPLOAD_PATH_ESCAPE");
  }
  return target;
}

export function detectFileSignature(buffer) {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (hasAscii(buffer, 0, "GIF87a") || hasAscii(buffer, 0, "GIF89a")) return "gif";
  if (hasAscii(buffer, 0, "RIFF") && hasAscii(buffer, 8, "WEBP")) return "webp";
  if (hasAscii(buffer, 4, "ftyp")) return "mp4";
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf";
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buffer, [0x50, 0x4b, 0x05, 0x06])) return "zip";
  if (startsWith(buffer, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return "7z";
  if (startsWith(buffer, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) return "rar";
  return "unknown";
}

function isProbablyText(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  if (sample.includes(0)) return false;
  return true;
}

function normalizeScanMode(app) {
  return String(app?.config?.UPLOAD_SCAN_MODE || "inline_blocking").trim().toLowerCase();
}

function uploadScanEndpoint(app) {
  return String(app?.config?.UPLOAD_SCAN_ENDPOINT || "").trim();
}

async function requestExternalScan(app, { buffer, filename, mimetype, assetKind, tenantId }) {
  const endpoint = uploadScanEndpoint(app);
  if (!endpoint) return { ok: false, status: "pending", error: "UPLOAD_SCAN_PENDING" };

  const timeoutMs = Math.max(1000, Number(app?.config?.UPLOAD_SCAN_TIMEOUT_MS || DEFAULT_SCAN_TIMEOUT_MS));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(app?.config?.UPLOAD_SCAN_API_KEY ? { authorization: `Bearer ${app.config.UPLOAD_SCAN_API_KEY}` } : {})
      },
      body: JSON.stringify({
        filename: String(filename || ""),
        mimetype: String(mimetype || ""),
        asset_kind: String(assetKind || ""),
        tenant_id: String(tenantId || ""),
        sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
        content_base64: buffer.toString("base64")
      }),
      signal: controller.signal
    });
    if (!response.ok) return { ok: false, status: "pending", error: "UPLOAD_SCAN_PENDING" };
    const payload = await response.json().catch(() => ({}));
    const verdict = String(payload.verdict || payload.status || "").toLowerCase();
    if (payload.ok === true || verdict === "clean" || verdict === "allow") {
      return { ok: true, scan_status: "clean", scanner: payload.scanner || "external" };
    }
    if (verdict === "malicious" || verdict === "blocked" || payload.ok === false) {
      return { ok: false, status: "blocked", error: payload.error || "MALWARE_SIGNATURE_DETECTED" };
    }
    return { ok: false, status: "pending", error: "UPLOAD_SCAN_PENDING" };
  } catch {
    return { ok: false, status: "pending", error: "UPLOAD_SCAN_PENDING" };
  } finally {
    clearTimeout(timer);
  }
}

export async function writeVerifiedUpload({
  app,
  targetPath,
  buffer,
  tenantId,
  storedName,
  assetKind = "media",
  category = "uploads",
  filename,
  mimetype
}) {
  const finalDir = path.dirname(targetPath);
  fs.mkdirSync(finalDir, { recursive: true });
  const mode = normalizeScanMode(app);
  if (mode !== "external_required") {
    fs.writeFileSync(targetPath, buffer);
    return { ok: true, scan_status: "clean", scanner: "inline_v1" };
  }

  const marker = `${path.sep}${tenantId}${path.sep}`;
  const markerIndex = path.resolve(targetPath).indexOf(marker);
  const assetsRoot =
    markerIndex >= 0
      ? path.resolve(targetPath).slice(0, markerIndex)
      : path.resolve(finalDir, "..", "..");
  const quarantineDir = path.resolve(assetsRoot, "..", "upload-quarantine", String(tenantId || "unknown"), category);
  fs.mkdirSync(quarantineDir, { recursive: true });
  const quarantineName = `${crypto.randomUUID()}-${storedName || path.basename(targetPath)}`;
  const quarantinePath = safeUploadTarget(quarantineDir, quarantineName);
  fs.writeFileSync(quarantinePath, buffer);

  const scan = await requestExternalScan(app, { buffer, filename, mimetype, assetKind, tenantId });
  if (!scan.ok) {
    return {
      ok: false,
      error: scan.error || "UPLOAD_SCAN_PENDING",
      status: scan.status || "pending",
      scan_status: scan.status || "pending",
      quarantine_path: quarantinePath
    };
  }

  fs.renameSync(quarantinePath, targetPath);
  return scan;
}

export function scanUploadBuffer({ buffer, filename, mimetype, assetKind } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, error: "UPLOAD_EMPTY" };
  }
  const extension = path.extname(filename || "").toLowerCase();
  const mime = String(mimetype || "").toLowerCase();
  const sample = buffer.subarray(0, Math.min(buffer.length, 65536)).toString("latin1");

  if (sample.includes(EICAR)) {
    return { ok: false, error: "MALWARE_SIGNATURE_DETECTED", scan_status: "blocked" };
  }

  const textLike =
    TEXT_EXT.has(extension) ||
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.includes("xml") ||
    mime.includes("svg");
  if (textLike && ACTIVE_CONTENT_PATTERN.test(sample)) {
    return { ok: false, error: "ACTIVE_CONTENT_REJECTED", scan_status: "blocked" };
  }

  if (assetKind === "document" && (mime.includes("html") || extension === ".html" || extension === ".htm")) {
    return { ok: false, error: "ACTIVE_CONTENT_REJECTED", scan_status: "blocked" };
  }

  return { ok: true, scan_status: "clean", scanner: "inline_v1" };
}

export function validateImageUpload({ buffer, filename, mimetype }) {
  const scan = scanUploadBuffer({ buffer, filename, mimetype, assetKind: "media" });
  if (!scan.ok) return scan;
  const extension = path.extname(filename || "").toLowerCase();
  const mime = String(mimetype || "").toLowerCase();
  if (!IMAGE_EXT.has(extension) || !mime.startsWith("image/")) {
    return { ok: false, error: "UNSUPPORTED_MEDIA" };
  }
  const signature = detectFileSignature(buffer);
  const expected = extension === ".jpg" || extension === ".jpeg" ? "jpg" : extension.slice(1);
  if (signature !== expected) {
    return { ok: false, error: "FILE_SIGNATURE_MISMATCH" };
  }
  return { ok: true, safeExt: extension, scan_status: scan.scan_status };
}

export function validateEcomUpload({ buffer, filename, mimetype, assetKind, allowedDocumentExt, allowedDocumentMime }) {
  const scan = scanUploadBuffer({ buffer, filename, mimetype, assetKind });
  if (!scan.ok) return scan;
  const extension = path.extname(filename || "").toLowerCase();
  const mime = String(mimetype || "").toLowerCase();
  const signature = detectFileSignature(buffer);

  if (assetKind === "media") {
    if (!mime.startsWith("image/") && !mime.startsWith("video/")) {
      return { ok: false, error: "UNSUPPORTED_MEDIA" };
    }
    if (!IMAGE_EXT.has(extension) && !VIDEO_EXT.has(extension)) {
      return { ok: false, error: "UNSUPPORTED_MEDIA" };
    }
    if (IMAGE_EXT.has(extension)) return validateImageUpload({ buffer, filename, mimetype });
    if (extension === ".webm" && signature !== "webm") return { ok: false, error: "FILE_SIGNATURE_MISMATCH" };
    if ((extension === ".mp4" || extension === ".m4v" || extension === ".mov") && signature !== "mp4") {
      return { ok: false, error: "FILE_SIGNATURE_MISMATCH" };
    }
    return { ok: true, safeExt: extension, scan_status: scan.scan_status };
  }

  if (!allowedDocumentExt.has(extension) || !allowedDocumentMime.has(mime)) {
    return { ok: false, error: "UNSUPPORTED_DOCUMENT" };
  }
  if (extension === ".pdf" && signature !== "pdf") return { ok: false, error: "FILE_SIGNATURE_MISMATCH" };
  if (ZIP_EXT.has(extension) && signature !== "zip") return { ok: false, error: "FILE_SIGNATURE_MISMATCH" };
  if (extension === ".7z" && signature !== "7z") return { ok: false, error: "FILE_SIGNATURE_MISMATCH" };
  if (extension === ".rar" && signature !== "rar") return { ok: false, error: "FILE_SIGNATURE_MISMATCH" };
  if (TEXT_EXT.has(extension) && !isProbablyText(buffer)) return { ok: false, error: "FILE_SIGNATURE_MISMATCH" };
  return { ok: true, safeExt: extension, scan_status: scan.scan_status };
}
