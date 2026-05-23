import path from "node:path";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const VIDEO_EXT = new Set([".mp4", ".m4v", ".mov", ".webm"]);
const ZIP_EXT = new Set([".zip", ".docx", ".xlsx", ".pptx", ".zprj", ".zpac"]);
const TEXT_EXT = new Set([".txt", ".csv", ".json", ".dxf"]);

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

export function validateImageUpload({ buffer, filename, mimetype }) {
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
  return { ok: true, safeExt: extension };
}

export function validateEcomUpload({ buffer, filename, mimetype, assetKind, allowedDocumentExt, allowedDocumentMime }) {
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
    return { ok: true, safeExt: extension };
  }

  if (!allowedDocumentExt.has(extension) || !allowedDocumentMime.has(mime)) {
    return { ok: false, error: "UNSUPPORTED_DOCUMENT" };
  }
  if (extension === ".pdf" && signature !== "pdf") return { ok: false, error: "FILE_SIGNATURE_MISMATCH" };
  if (ZIP_EXT.has(extension) && signature !== "zip") return { ok: false, error: "FILE_SIGNATURE_MISMATCH" };
  if (extension === ".7z" && signature !== "7z") return { ok: false, error: "FILE_SIGNATURE_MISMATCH" };
  if (extension === ".rar" && signature !== "rar") return { ok: false, error: "FILE_SIGNATURE_MISMATCH" };
  if (TEXT_EXT.has(extension) && !isProbablyText(buffer)) return { ok: false, error: "FILE_SIGNATURE_MISMATCH" };
  return { ok: true, safeExt: extension };
}
