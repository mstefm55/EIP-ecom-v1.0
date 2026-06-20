import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import {
  ensureUploadDirectory,
  inspectUploadStorage,
  resolveAssetRoot
} from "../src/services/assets/root.js";
import {
  createUploadErrorHandler,
  normalizeUploadError,
  safeUploadTarget,
  uploadPartToBuffer,
  validateEcomUpload,
  writeVerifiedUpload
} from "../src/lib/uploadSecurity.js";

const uploadErrorHandler = createUploadErrorHandler("test_upload_error");

const PNG_1X1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex"
);

function temporaryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eip-ecom-upload-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function replyRecorder() {
  return {
    statusCode: null,
    payload: null,
    code(value) {
      this.statusCode = value;
      return this;
    },
    send(value) {
      this.payload = value;
      return value;
    }
  };
}

test("successful product image upload writes a verified file", async (t) => {
  const root = temporaryRoot(t);
  const uploadDir = ensureUploadDirectory(root, ["tenant-a", "products"]);
  const targetPath = safeUploadTarget(uploadDir, "product.png");

  const result = await writeVerifiedUpload({
    app: { config: { UPLOAD_SCAN_MODE: "inline_blocking" } },
    targetPath,
    buffer: PNG_1X1,
    tenantId: "tenant-a",
    storedName: "product.png",
    filename: "product.png",
    mimetype: "image/png"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(fs.readFileSync(targetPath), PNG_1X1);
});

test("missing tenant upload directories are created automatically", (t) => {
  const root = temporaryRoot(t);
  const nested = path.join(root, "tenant-a", "products", "documents");
  assert.equal(fs.existsSync(nested), false);

  const result = ensureUploadDirectory(root, ["tenant-a", "products", "documents"]);

  assert.equal(result, nested);
  assert.equal(fs.statSync(nested).isDirectory(), true);
});

test("unwritable upload storage is classified without leaking filesystem details", (t) => {
  const root = temporaryRoot(t);
  const denied = Object.assign(new Error("permission denied at secret host path"), { code: "EACCES" });
  const fileSystem = {
    mkdirSync() {},
    accessSync() {
      throw denied;
    }
  };

  assert.throws(
    () => ensureUploadDirectory(root, ["tenant-a", "products"], fileSystem),
    (error) => error.code === "STORAGE_NOT_WRITABLE" && !error.message.includes("secret host path")
  );
});

test("invalid image MIME and signature combinations are rejected", () => {
  const result = validateEcomUpload({
    buffer: PNG_1X1,
    filename: "product.png",
    mimetype: "image/jpeg",
    assetKind: "media",
    allowedDocumentExt: new Set(),
    allowedDocumentMime: new Set()
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "UNSUPPORTED_MEDIA");
  assert.deepEqual(normalizeUploadError({ code: "INVALID_IMAGE" }), {
    code: "INVALID_IMAGE",
    statusCode: 415,
    message: "The selected file is not a valid supported image."
  });
});

test("upload target paths cannot escape the tenant directory", (t) => {
  const root = temporaryRoot(t);
  assert.throws(
    () => safeUploadTarget(root, "../outside.png"),
    /UPLOAD_PATH_ESCAPE/
  );
});

test("oversized files fail before storage", async () => {
  await assert.rejects(
    uploadPartToBuffer(
      { toBuffer: async () => Buffer.alloc(5) },
      { maxBytes: 4 }
    ),
    (error) => error.code === "FILE_TOO_LARGE"
  );
  assert.deepEqual(normalizeUploadError({ code: "FST_REQ_FILE_TOO_LARGE" }), {
    code: "FILE_TOO_LARGE",
    statusCode: 413,
    message: "The selected file exceeds the upload limit."
  });
});

test("multipart parser size failures use the structured upload error response", async (t) => {
  const app = Fastify({ logger: false });
  t.after(() => app.close());
  await app.register(multipart, {
    attachFieldsToBody: true,
    limits: { fileSize: 4 }
  });
  app.post("/upload", { errorHandler: uploadErrorHandler }, async () => ({ ok: true }));

  const form = new FormData();
  form.append("file", new Blob([Buffer.alloc(5)]), "oversized.png");
  const request = new Request("http://localhost/upload", { method: "POST", body: form });
  const response = await app.inject({
    method: "POST",
    url: "/upload",
    headers: Object.fromEntries(request.headers),
    payload: Buffer.from(await request.arrayBuffer())
  });

  assert.equal(response.statusCode, 413);
  assert.equal(response.json().error, "FILE_TOO_LARGE");
});

test("upload route errors include a safe code and retain stack diagnostics", () => {
  const logs = [];
  const request = {
    id: "req-upload-1",
    log: { error: (entry) => logs.push(entry) }
  };
  const reply = replyRecorder();
  const error = Object.assign(new Error("host path is read only"), { code: "EROFS" });

  uploadErrorHandler(error, request, reply);

  assert.equal(reply.statusCode, 503);
  assert.deepEqual(reply.payload, {
    ok: false,
    error: "STORAGE_NOT_WRITABLE",
    message: "Upload storage is not writable.",
    request_id: "req-upload-1"
  });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].err, error);
  assert.match(logs[0].stack, /host path is read only/);
});

test("startup diagnostics create and probe the configured upload root", (t) => {
  const root = path.join(temporaryRoot(t), "missing-assets");
  const diagnostic = inspectUploadStorage({ ASSET_ROOT: root });

  assert.equal(diagnostic.uploadRoot, path.resolve(root));
  assert.equal(diagnostic.directoryExists, true);
  assert.equal(diagnostic.writable, true);
  assert.equal(diagnostic.storageMode, "configured_filesystem");
  assert.equal(diagnostic.error, null);
});

test("Railway volume mount paths are used without changing public URLs", (t) => {
  const mount = temporaryRoot(t);
  assert.equal(
    resolveAssetRoot({ RAILWAY_VOLUME_MOUNT_PATH: mount }),
    path.resolve(mount, "eip-assets")
  );
});
