import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { classifyStorageError, STORAGE_ERROR_CODES } from "../services/assets/root.js";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const VIDEO_EXT = new Set([".mp4", ".m4v", ".mov", ".webm"]);
const IMAGE_MIME_BY_EXT = new Map([
  [".jpg", new Set(["image/jpeg"])],
  [".jpeg", new Set(["image/jpeg"])],
  [".png", new Set(["image/png"])],
  [".gif", new Set(["image/gif"])],
  [".webp", new Set(["image/webp"])]
]);
const VIDEO_MIME_BY_EXT = new Map([
  [".mp4", new Set(["video/mp4"])],
  [".m4v", new Set(["video/mp4", "video/x-m4v"])],
  [".mov", new Set(["video/quicktime"])],
  [".webm", new Set(["video/webm"])]
]);
const ZIP_EXT = new Set([".zip", ".docx", ".xlsx", ".pptx", ".zprj", ".zpac"]);
const TEXT_EXT = new Set([".txt", ".csv", ".json", ".dxf"]);
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
const ACTIVE_CONTENT_PATTERN = /<\s*(script|iframe|object|embed|svg|link|meta)\b|javascript\s*:|on[a-z]+\s*=/i;
const DEFAULT_SCAN_TIMEOUT_MS = 5000;
const DEFAULT_MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const UPLOAD_RESPONSE = Object.freeze({
  FILE_TOO_LARGE: { statusCode: 413, message: "The selected file exceeds the upload limit." },
  INVALID_IMAGE: { statusCode: 415, message: "The selected file is not a valid supported image." },
  UPLOAD_DIRECTORY_NOT_FOUND: { statusCode: 503, message: "Upload storage is not available." },
  STORAGE_NOT_WRITABLE: { statusCode: 503, message: "Upload storage is not writable." },
  UPLOAD_WRITE_FAILED: { statusCode: 500, message: "The file could not be stored." }
});

class UploadRequestError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "UploadRequestError";
    this.code = code;
  }
}

function startsWith(buffer, bytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function hasAscii(buffer, offset, value) {
  return buffer.length >= offset + value.length && buffer.subarray(offset, offset + value.length).toString("ascii") === value;
}

function isFileTooLargeError(error) {
  const code = String(error?.code || "").toUpperCase();
  return (
    code === "FST_REQ_FILE_TOO_LARGE" ||
    code === "FILE_TOO_LARGE" ||
    error?.name === "RequestFileTooLargeError"
  );
}

export function normalizeUploadError(error) {
  let code = String(error?.code || "").toUpperCase();
  if (isFileTooLargeError(error)) code = "FILE_TOO_LARGE";
  if (["EACCES", "EPERM", "EROFS", "ENOENT", "ENOTDIR"].includes(code)) {
    code = classifyStorageError(error).code;
  }
  if (!UPLOAD_RESPONSE[code]) {
    code = Object.values(STORAGE_ERROR_CODES).includes(code)
      ? code
      : "UPLOAD_WRITE_FAILED";
  }
  return { code, ...UPLOAD_RESPONSE[code] };
}

export function sendUploadFailure(req, reply, error, { event = "upload_error", context = {} } = {}) {
  const failure = normalizeUploadError(error);
  req.log.error({
    event,
    ...context,
    err: error,
    stack: error?.stack || null,
    upload_error: failure.code,
    request_id: req.id
  });
  return reply.code(failure.statusCode).send({
    ok: false,
    error: failure.code,
    message: failure.message,
    request_id: req.id
  });
}

export function createUploadErrorHandler(event = "upload_request_error") {
  return function uploadErrorHandler(error, req, reply) {
    return sendUploadFailure(req, reply, error, { event });
  };
}

export async function uploadPartToBuffer(filePart, { maxBytes = DEFAULT_MAX_UPLOAD_BYTES } = {}) {
  const limit = Math.max(1, Number(maxBytes) || DEFAULT_MAX_UPLOAD_BYTES);
  try {
    if (typeof filePart?.toBuffer === "function") {
      const buffer = await filePart.toBuffer();
      if (filePart?.file?.truncated || buffer.length > limit) {
        throw new UploadRequestError("FILE_TOO_LARGE", "Upload exceeds the configured size limit.");
      }
      return buffer;
    }
    if (!filePart?.file) {
      throw new UploadRequestError("FILE_REQUIRED", "A file is required.");
    }
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of filePart.file) {
      const bufferedChunk = Buffer.from(chunk);
      totalBytes += bufferedChunk.length;
      if (totalBytes > limit) {
        throw new UploadRequestError("FILE_TOO_LARGE", "Upload exceeds the configured size limit.");
      }
      chunks.push(bufferedChunk);
    }
    if (filePart.file.truncated) {
      throw new UploadRequestError("FILE_TOO_LARGE", "Upload exceeds the configured size limit.");
    }
    return Buffer.concat(chunks);
  } catch (error) {
    if (isFileTooLargeError(error)) {
      throw new UploadRequestError("FILE_TOO_LARGE", "Upload exceeds the configured size limit.", error);
    }
    throw error;
  }
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

function quarantineMetadataPath(quarantinePath) {
  return `${quarantinePath}.json`;
}

function writeQuarantineMetadata(quarantinePath, metadata) {
  fs.writeFileSync(
    quarantineMetadataPath(quarantinePath),
    `${JSON.stringify(metadata, null, 2)}\n`,
    { flag: "w" }
  );
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
    fs.writeFileSync(targetPath, buffer, { flag: "wx" });
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
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  fs.writeFileSync(quarantinePath, buffer, { flag: "wx" });
  writeQuarantineMetadata(quarantinePath, {
    status: "pending",
    tenant_id: String(tenantId || ""),
    asset_kind: String(assetKind || ""),
    category: String(category || ""),
    filename: String(filename || ""),
    mimetype: String(mimetype || ""),
    stored_name: String(storedName || ""),
    target_path: path.resolve(targetPath),
    quarantine_path: quarantinePath,
    sha256,
    created_at: new Date().toISOString()
  });

  const scan = await requestExternalScan(app, { buffer, filename, mimetype, assetKind, tenantId });
  if (!scan.ok) {
    writeQuarantineMetadata(quarantinePath, {
      status: scan.status || "pending",
      error: scan.error || "UPLOAD_SCAN_PENDING",
      tenant_id: String(tenantId || ""),
      asset_kind: String(assetKind || ""),
      category: String(category || ""),
      filename: String(filename || ""),
      mimetype: String(mimetype || ""),
      stored_name: String(storedName || ""),
      target_path: path.resolve(targetPath),
      quarantine_path: quarantinePath,
      sha256,
      updated_at: new Date().toISOString()
    });
    return {
      ok: false,
      error: scan.error || "UPLOAD_SCAN_PENDING",
      status: scan.status || "pending",
      scan_status: scan.status || "pending",
      quarantine_path: quarantinePath,
      quarantine_metadata_path: quarantineMetadataPath(quarantinePath)
    };
  }

  fs.renameSync(quarantinePath, targetPath);
  fs.rmSync(quarantineMetadataPath(quarantinePath), { force: true });
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
  if (!IMAGE_EXT.has(extension) || !IMAGE_MIME_BY_EXT.get(extension)?.has(mime)) {
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
    if (!VIDEO_MIME_BY_EXT.get(extension)?.has(mime)) {
      return { ok: false, error: "UNSUPPORTED_MEDIA" };
    }
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

export {
  DEFAULT_MAX_UPLOAD_BYTES,
  UploadRequestError,
  quarantineMetadataPath
};
