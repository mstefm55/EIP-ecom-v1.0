import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeOptionalUuid } from "../src/routes/crm_intake.js";
import {
  buildRedactedSnippet,
  getMailboxAdapter,
  normalizeMailboxMessage,
  summarizeMailboxMessage
} from "../src/services/crm/mailboxAdapters.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const crm = read("../src/routes/crm.js");
const intake = read("../src/routes/crm_intake.js");
const mailbox = read("../src/routes/crm_mailbox.js");
const adapter = read("../src/services/crm/mailboxAdapters.js");
const completion = read("../src/routes/crm_completion.js");
const intelligence = read("../src/routes/crm_intelligence.js");
const migration = read("../db/migrations/0104_crm_mailbox_intake_reply_foundation.sql");
const seed = read("../db/seed/ui_surface_dashboard.sql");
const surface = read("../../../apps/dashboard/src/engine/surfaces/dashboard.js");
const workspace = read("../../../apps/dashboard/src/components/crm/CrmWorkspace.jsx");

test("optional intake agent UUID normalization accepts omitted and empty values but rejects malformed input", () => {
  const valid = "18e6209d-155a-4932-9b7b-e11ad09aaf49";
  assert.deepEqual(normalizeOptionalUuid(undefined), { ok: true, value: null });
  assert.deepEqual(normalizeOptionalUuid(null), { ok: true, value: null });
  assert.deepEqual(normalizeOptionalUuid("  "), { ok: true, value: null });
  assert.deepEqual(normalizeOptionalUuid(valid), { ok: true, value: valid });
  assert.deepEqual(normalizeOptionalUuid("not-a-uuid"), { ok: false, error: "AGENT_ID_INVALID" });
  assert.match(intake, /status: 400, error: normalizedLinkedAgentId\.error/);
});

test("mailbox message normalization preserves protected readable text while list snippets redact contacts", () => {
  const result = normalizeMailboxMessage({
    provider: "manual_test",
    provider_message_id: "manual-001",
    provider_thread_id: "thread-001",
    direction: "inbound",
    subject: "Shipping question",
    body_text: "Please email jane@example.com or call +230 5555 1234 about my parcel.",
    from_name: "Jane",
    from_email: "jane@example.com",
    received_at: "2026-06-02T10:00:00.000Z"
  });
  assert.equal(result.ok, true);
  assert.match(result.item.body_text, /jane@example\.com/);
  assert.equal(result.item.from_email_masked, "j***@example.com");
  assert.notEqual(result.item.from_email_hash, "jane@example.com");
  assert.match(result.item.redacted_snippet, /\[REDACTED_EMAIL\]/);
  assert.match(result.item.redacted_snippet, /\[REDACTED_PHONE\]/);
  assert.equal(typeof result.item.fingerprint, "string");
  assert.equal(result.item.fingerprint.length, 64);

  const listItem = summarizeMailboxMessage({ id: "message-id", record_type: "CRM_MAILBOX_MESSAGE", payload: result.item });
  assert.doesNotMatch(listItem.description, /jane@example\.com/);
  assert.equal(listItem.body_text, undefined);
});

test("redacted snippets remove direct email and phone values", () => {
  assert.equal(
    buildRedactedSnippet("Reach alice@example.com at +1 (202) 555-0188."),
    "Reach [REDACTED_EMAIL] at [REDACTED_PHONE]."
  );
});

test("manual mailbox adapter is safe by default and never sends externally", async () => {
  const manual = getMailboxAdapter("manual_test");
  assert.equal(manual.code, "manual_test");
  assert.equal(manual.supports.send_reply, false);
  assert.deepEqual(await manual.sendReply({ reply_id: "test" }), {
    ok: false,
    pending: true,
    error: "CRM_MAILBOX_PROVIDER_SEND_DISABLED"
  });
  assert.doesNotMatch(adapter, /nodemailer|fetch\(|smtp|graph\.microsoft|googleapis/i);
});

test("mailbox routes extend CRM with protected import, intake, thread, draft, approve, and safe send-request paths", () => {
  assert.match(crm, /registerCrmMailboxRoutes/);
  assert.match(crm, /await registerCrmMailboxRoutes\(app\)/);
  for (const route of [
    '"/mailbox/readiness"',
    '"/mailbox/messages"',
    '"/mailbox/messages/import-manual"',
    '"/mailbox/messages/:id"',
    '"/mailbox/messages/:id/create-intake"',
    '"/mailbox/threads/:threadId"',
    '"/mailbox/replies"',
    '"/mailbox/replies/draft"',
    '"/mailbox/replies/:id"',
    '"/mailbox/replies/:id/approve"',
    '"/mailbox/replies/:id/send"'
  ]) {
    assert.match(mailbox, new RegExp(route.replace(/[/:]/g, "\\$&")));
  }
  assert.match(mailbox, /createIntakeProposal/);
  assert.match(adapter, /CRM_MAILBOX_PROVIDER_SEND_DISABLED/);
  assert.match(mailbox, /reply\.code\(202\)\.send/);
});

test("mailbox routes preserve tenant scope, session, CSRF, RBAC, capability gating, and idempotency", () => {
  assert.match(mailbox, /app\.requireSession\(req, \{ realm: "EIP" \}\)/);
  assert.match(mailbox, /app\.requireCsrf\(req\)/);
  assert.match(mailbox, /hasPermission\(/);
  assert.match(mailbox, /CRM_CAPABILITY_DISABLED/);
  assert.match(mailbox, /tenant_id=\$1/);
  assert.match(mailbox, /payload->>'fingerprint'/);
  assert.match(mailbox, /reused: true/);
  assert.match(mailbox, /secrets_exposed: false/);
});

test("mailbox migration reuses the kernel and seeds governance without a mailbox-specific table", () => {
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i);
  assert.match(migration, /No CRM-specific persistence tables are introduced/);
  for (const value of [
    "CRM_MAILBOX_PROVIDER",
    "CRM_MAILBOX_MESSAGE_STATUS",
    "CRM_MAILBOX_DIRECTION",
    "CRM_REPLY_STATUS",
    "CRM_MAILBOX_MESSAGE_FLOW_V1",
    "CRM_REPLY_REVIEW_FLOW_V1",
    "CRM_MAILBOX_READ",
    "CRM_MAILBOX_WRITE",
    "CRM_MAILBOX_REPLY_DRAFT",
    "CRM_MAILBOX_REPLY_SEND",
    "INSERT INTO eip_authz.role_template_permission",
    "INSERT INTO eip_core.process_binding",
    "INSERT INTO eip_core.task_template"
  ]) {
    assert.match(migration, new RegExp(value));
  }
  assert.match(migration, /'CRM_USER','CRM_MAILBOX_REPLY_DRAFT'/);
  assert.doesNotMatch(migration, /'CRM_USER','CRM_MAILBOX_REPLY_SEND'/);
  assert.match(migration, /'ACCESS_READ_ONLY','CRM_MAILBOX_READ'/);
  assert.doesNotMatch(migration, /'ACCESS_READ_ONLY','CRM_MAILBOX_WRITE'/);
});

test("mailbox tabs and actions remain descriptor-backed reusable CRM workspace behavior", () => {
  for (const source of [migration, seed, surface, workspace]) {
    assert.match(source, /mailbox/);
    assert.match(source, /CRM_MAILBOX_READ/);
  }
  assert.match(workspace, /No linked contact yet/);
  assert.match(workspace, /Search by name or reference/);
  assert.doesNotMatch(workspace, /Linked agent id/);
  assert.match(workspace, /CRM_MAILBOX_REPLY_DRAFT/);
  assert.match(workspace, /CRM_MAILBOX_REPLY_SEND/);
  assert.match(completion, /"CRM_MAILBOX_PROVIDER"/);
  assert.match(intelligence, /mailbox: row\?\.is_active === true && configured\.mailbox === true/);
});

test("mailbox foundation remains tenant agnostic", () => {
  const touched = `${mailbox}\n${adapter}\n${migration}\n${surface}\n${workspace}`;
  assert.doesNotMatch(touched, /samarapattern|samara-web-storefront|samara/i);
});
