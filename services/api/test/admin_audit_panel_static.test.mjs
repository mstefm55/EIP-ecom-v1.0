import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const auditPanelPath = path.resolve(__dirname, "../../../apps/dashboard/src/components/admin/AdminAuditPanel.jsx");

test("admin audit panel keeps event details in a centered modal with copy and redaction controls", () => {
  const source = fs.readFileSync(auditPanelPath, "utf8");

  assert.match(source, /selectedEvent/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /items-center justify-center/);
  assert.match(source, /max-h-\[calc\(100vh-3rem\)\]/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /buildEventDetailPayload/);
  assert.match(source, /redactDetailValue/);
  assert.match(source, /SENSITIVE_DETAIL_KEY_PATTERN/);
  assert.match(source, /Event id/);
  assert.match(source, /Event type/);
  assert.match(source, /Redacted JSON/);
  assert.match(source, /Redacted metadata/);
  assert.match(source, /navigator\.clipboard\.writeText/);
});
