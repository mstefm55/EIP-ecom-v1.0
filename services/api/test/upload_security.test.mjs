import assert from "node:assert/strict";
import test from "node:test";
import {
  scanUploadBuffer,
  validateEcomUpload,
  validateImageUpload
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
