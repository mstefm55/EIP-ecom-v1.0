import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_AI_EXTRACTION_POLICY,
  DEFAULT_AUTOMATION_POLICY,
  extractRuleBasedProposal,
  runIntakeExtraction,
  sanitizeIntakeText
} from "../src/routes/crm_intake.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const crm = read("../src/routes/crm.js");
const intake = read("../src/routes/crm_intake.js");
const intelligence = read("../src/routes/crm_intelligence.js");
const completion = read("../src/routes/crm_completion.js");
const migration = read("../db/migrations/0102_crm_intake_foundation.sql");
const seed = read("../db/seed/ui_surface_dashboard.sql");
const surface = read("../../../apps/dashboard/src/engine/surfaces/dashboard.js");
const workspace = read("../../../apps/dashboard/src/components/crm/CrmWorkspace.jsx");

test("CRM intake extends the existing CRM route family without new persistence tables", () => {
  assert.match(crm, /registerCrmIntakeRoutes/);
  assert.match(crm, /await registerCrmIntakeRoutes\(app\)/);
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i);
  assert.match(migration, /No CRM-specific persistence tables are introduced/);
});

test("manual rule-based intake redacts PII and creates a review-based proposal shape", () => {
  const proposal = extractRuleBasedProposal({
    source_type: "email",
    source_channel: "manual",
    subject: "Question about beginner sewing course",
    body: "Please email jane@example.com or call +230 5555 1234. I am interested in pricing.",
    from_name: "Jane",
    from_email: "jane@example.com",
    from_phone: "+230 5555 1234"
  }, {});
  assert.equal(proposal.suggested_object_type, "CRM_LEAD");
  assert.equal(proposal.proposal_status, "needs_review");
  assert.equal(proposal.extractor_type, "rule_based");
  assert.equal(proposal.automation_policy.automation_mode, "review_required");
  assert.equal(proposal.ai_extraction_policy.ai_extraction_enabled, false);
  assert.match(proposal.suggested_summary, /\[REDACTED_EMAIL\]/);
  assert.match(proposal.suggested_summary, /\[REDACTED_PHONE\]/);
  assert.notEqual(proposal.detected_contact.email_hash, "jane@example.com");
  assert.equal(proposal.detected_contact.email_masked, "j***@example.com");
});

test("raw intake text sanitizer removes email and phone values", () => {
  const text = sanitizeIntakeText("Reach alice@example.com at +1 (202) 555-0188.");
  assert.equal(text, "Reach [REDACTED_EMAIL] at [REDACTED_PHONE].");
  assert.match(intake, /description: sanitizeIntakeText\(attrs\.note, 500\)/);
});

test("extractor adapter boundary defaults locally and refuses unavailable AI adapters", () => {
  assert.equal(DEFAULT_AUTOMATION_POLICY.human_review_required, true);
  assert.equal(DEFAULT_AI_EXTRACTION_POLICY.ai_extraction_enabled, false);
  assert.equal(runIntakeExtraction({ input: { subject: "Need help" } }).ok, true);
  assert.deepEqual(
    runIntakeExtraction({ adapter: "ai_adapter", input: { subject: "Need help" } }),
    { ok: false, error: "INTAKE_EXTRACTION_ADAPTER_NOT_AVAILABLE" }
  );
  assert.doesNotMatch(intake, /openai|anthropic|gemini|fetch\(/i);
});

test("intake routes expose list, manual capture, review decisions, conversion, task, timeline, and overview", () => {
  for (const route of [
    '"/intake"',
    '"/intake/manual"',
    '"/intake/overview"',
    '"/intake/:id"',
    '"/intake/:id/approve"',
    '"/intake/:id/ignore"',
    '"/intake/:id/convert"',
    '"/intake/:id/tasks"',
    '"/intake/:id/timeline"'
  ]) {
    assert.match(intake, new RegExp(route.replace(/[/:]/g, "\\$&")));
  }
});

test("intake routes preserve session, CSRF, RBAC, capability, tenant scope, and idempotency", () => {
  assert.match(intake, /app\.requireSession\(req, \{ realm: "EIP" \}\)/);
  assert.match(intake, /app\.requireCsrf\(req\)/);
  assert.match(intake, /hasPermission\(/);
  assert.match(intake, /CRM_CAPABILITY_DISABLED/);
  assert.match(intake, /tenant_id=\$1/);
  assert.match(intake, /source_ref_hash/);
  assert.match(intake, /reused: true/);
});

test("manual intake writes raw and proposal facts with lineage and creates governed review work", () => {
  assert.match(intake, /record_type: "CRM_INTAKE_RAW"/);
  assert.match(intake, /record_type: "CRM_INTAKE_PROPOSAL"/);
  assert.match(intake, /relation_type: "STRUCTURED_AS"/);
  assert.match(intake, /objectType: "CRM_INTAKE_REVIEW"/);
  assert.match(intake, /action,\s*\n\s*idempotencyKey/);
  assert.match(intake, /\["structured", "needs_review"\]/);
});

test("conversion supports governed object, task, note, and signal targets with lineage", () => {
  for (const value of ["CRM_LEAD", "CRM_OPPORTUNITY", "CRM_CASE", "CRM_INTERACTION", "CRM_SIGNAL", "TASK_ONLY", "NOTE_ONLY"]) {
    assert.match(intake, new RegExp(value));
  }
  assert.match(intake, /startObjectProcess/);
  assert.match(intake, /action: "task\.create"/);
  assert.match(intake, /relation_type: "INTAKE_CONVERTED_TO"/);
  assert.match(intake, /relation_type: "INTAKE_SOURCE_FOR"/);
  assert.match(intake, /INTAKE_APPROVAL_REQUIRED/);
});

test("migration seeds intake dropdowns, permissions, process binding, policy metadata, and descriptor repair", () => {
  for (const value of [
    "CRM_INTAKE_SOURCE_TYPE",
    "CRM_INTAKE_PROPOSAL_STATUS",
    "CRM_INTAKE_SUGGESTED_OBJECT_TYPE",
    "CRM_INTAKE_REVIEW_FLOW_V1",
    "CRM_INTAKE_READ",
    "CRM_INTAKE_WRITE",
    "CRM_INTAKE_APPROVE",
    "CRM_INTAKE_CONVERT",
    "ai_extraction_enabled",
    "human_review_required",
    "review_required"
  ]) {
    assert.match(migration, new RegExp(value));
  }
  assert.match(migration, /INSERT INTO eip_core\.process_binding/);
  assert.match(migration, /INSERT INTO eip_core\.task_template/);
  assert.match(migration, /UPDATE eip_core\.tenant_module_setting/);
  assert.match(migration, /jsonb_build_array\(intake_tab\) \|\| tabs/);
});

test("intake Inbox is descriptor and capability gated in the reusable CRM workspace", () => {
  assert.match(surface, /id: "intake", label: "Intake Inbox"/);
  assert.match(seed, /"id": "intake", "label": "Intake Inbox"/);
  assert.match(workspace, /Review incoming messages and signals before EIP creates leads, cases, opportunities, or tasks\./);
  assert.match(workspace, /<th className="px-2 py-2">Confidence<\/th>/);
  assert.match(workspace, /item\.payload\?\.suggested_tasks/);
  assert.match(workspace, /CRM_INTAKE_APPROVE/);
  assert.match(workspace, /CRM_INTAKE_CONVERT/);
  assert.match(workspace, /CRM_INTAKE_SUGGESTED_OBJECT_TYPE/);
  assert.match(intelligence, /intake: row\?\.is_active === true && configured\.intake === true/);
  assert.match(completion, /"CRM_INTAKE_SOURCE_TYPE"/);
});

test("CRM intake remains tenant agnostic and provider independent", () => {
  const touched = `${intake}\n${migration}\n${surface}\n${workspace}`;
  assert.doesNotMatch(touched, /samarapattern|samara-web-storefront|samara/i);
  assert.doesNotMatch(touched, /gmail|paypal|stripe|graph\.facebook|analyticsdata\.googleapis/i);
});
