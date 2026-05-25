import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  quarantineMetadataPath,
  scanUploadBuffer,
  validateEcomUpload,
  validateImageUpload,
  writeVerifiedUpload
} from "../src/lib/uploadSecurity.js";

const PNG_1X1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex"
);

test("image validation blocks malware test signature before publishing", () => {
  const buffer = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
  const result = validateImageUpload({
    buffer,
    filename: "avatar.png",
    mimetype: "image/png"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "MALWARE_SIGNATURE_DETECTED");
});

test("upload scanner rejects active content in text-like files", () => {
  const result = scanUploadBuffer({
    buffer: Buffer.from("<script>alert(1)</script>"),
    filename: "payload.txt",
    mimetype: "text/plain",
    assetKind: "document"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "ACTIVE_CONTENT_REJECTED");
});

test("valid image remains accepted after inline safety scan", () => {
  const result = validateImageUpload({
    buffer: PNG_1X1,
    filename: "avatar.png",
    mimetype: "image/png"
  });

  assert.equal(result.ok, true);
  assert.equal(result.safeExt, ".png");
  assert.equal(result.scan_status, "clean");
});

test("ecommerce document uploads retain signature checks after scan", () => {
  const result = validateEcomUpload({
    buffer: Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n"),
    filename: "spec.pdf",
    mimetype: "application/pdf",
    assetKind: "document",
    allowedDocumentExt: new Set([".pdf"]),
    allowedDocumentMime: new Set(["application/pdf"])
  });

  assert.equal(result.ok, true);
  assert.equal(result.safeExt, ".pdf");
});

test("external-required upload mode quarantines until a scanner returns clean", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eip-upload-security-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const targetPath = path.join(root, "tenant-a", "avatars", "avatar.png");

  const result = await writeVerifiedUpload({
    app: { config: { UPLOAD_SCAN_MODE: "external_required" } },
    targetPath,
    buffer: PNG_1X1,
    tenantId: "tenant-a",
    storedName: "avatar.png",
    assetKind: "media",
    category: "avatars",
    filename: "avatar.png",
    mimetype: "image/png"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "UPLOAD_SCAN_PENDING");
  assert.equal(fs.existsSync(targetPath), false);
  assert.equal(fs.existsSync(result.quarantine_path), true);
  assert.equal(fs.existsSync(result.quarantine_metadata_path), true);
  assert.equal(result.quarantine_metadata_path, quarantineMetadataPath(result.quarantine_path));

  const metadata = JSON.parse(fs.readFileSync(result.quarantine_metadata_path, "utf8"));
  assert.equal(metadata.status, "pending");
  assert.equal(metadata.tenant_id, "tenant-a");
  assert.equal(metadata.filename, "avatar.png");
  assert.equal(metadata.target_path, path.resolve(targetPath));
});
