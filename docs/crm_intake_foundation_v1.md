# CRM Intake Foundation V1

Status: implemented foundation
Date: 2026-06-01

## Purpose

CRM Intake moves the reusable CRM workspace toward a decision-first operating
model. Manual object creation remains available, but incoming communication can
now be captured as sanitized facts, structured as proposals, reviewed by a
human, and converted into governed CRM work.

Mailbox imports now feed the same intake primitive. See
`docs/crm_mailbox_intake_reply_foundation_v1.md`.

No CRM-specific persistence table was added.

## Intake Flow

```text
manual validation input or future verified gateway fact
-> CRM_INTAKE_RAW info_record
-> extraction adapter
-> CRM_INTAKE_PROPOSAL info_record
-> CRM_INTAKE_REVIEW process context
-> approve, ignore, or convert
-> CRM_INTAKE_DECISION info_record
-> linked CRM object, signal, note, or task
```

The default path is review-based. It does not auto-create business objects.

## Kernel Model

| Concept | Kernel storage | Type |
| --- | --- | --- |
| Sanitized source fact | `eip_core.info_record` | `CRM_INTAKE_RAW` |
| Structured proposal | `eip_core.info_record` | `CRM_INTAKE_PROPOSAL` |
| Review decision | `eip_core.info_record` | `CRM_INTAKE_DECISION` |
| Review execution context | `eip_core.service_object` | `CRM_INTAKE_REVIEW` |
| Lineage | `eip_core.object_link` | `STRUCTURED_AS`, `INTAKE_REVIEW_CONTEXT`, `INTAKE_DECISION`, `INTAKE_CONVERTED_TO`, `INTAKE_SOURCE_FOR` |
| Review follow-up | `eip_core.task` | Existing governed CRM task type |

## Routes

Prefix:

```text
/api/eip/crm
```

```text
GET    /intake
POST   /intake/manual
GET    /intake/overview
GET    /intake/:id
PATCH  /intake/:id
POST   /intake/:id/approve
POST   /intake/:id/ignore
POST   /intake/:id/convert
POST   /intake/:id/tasks
GET    /intake/:id/timeline
```

List filters:

```text
status
source_type
suggested_object_type
min_confidence
created_from
created_to
limit
offset
```

## Manual Validation Input

The manual route exists to validate the future connector workflow safely:

```json
{
  "source_type": "email",
  "source_channel": "manual",
  "subject": "Question about beginner sewing course",
  "body": "I am interested in the course and shipping options.",
  "from_name": "Jane",
  "from_email": "jane@example.com",
  "source_ref": "manual:test-001"
}
```

Repeated input with the same source reference is idempotent.

## Conversion Targets

An approved proposal may become:

```text
CRM_LEAD
CRM_OPPORTUNITY
CRM_CASE
CRM_INTERACTION
CRM_SIGNAL
TASK_ONLY
NOTE_ONLY
```

Service objects start their existing bound process. Suggested tasks are created
through the task effect on the target process. `TASK_ONLY` work is created
against the bound intake review context. The route never inserts a runtime task
directly.

Conversion is idempotent and preserves raw fact, proposal, decision, and created
object lineage through `object_link`.

The optional linked customer/contact value is normalized defensively. Omitted,
null, empty, and whitespace-only values become `null`, so a lead can be created
without an existing linked agent. A malformed non-empty UUID returns a clear
HTTP `400` error rather than reaching a PostgreSQL UUID cast.

## Security Boundary

All routes require:

```text
EIP session
CSRF
RBAC permission
active crm.intake capability
tenant-scoped lookup
validated input
```

Raw messages are truncated and redact email addresses and phone-like values.
Detected contact metadata stores masked values and SHA-256 hashes rather than
raw email or phone values. Secret-like metadata uses the existing recursive CRM
redaction helper.

Routes log only event name, tenant id, and error message. Raw source text,
credentials, tokens, and contact values are never written to logs.

## Governed Dropdowns

Migration `0102_crm_intake_foundation.sql` seeds:

```text
CRM_INTAKE_SOURCE_TYPE
CRM_INTAKE_PROPOSAL_STATUS
CRM_INTAKE_SUGGESTED_OBJECT_TYPE
```

Existing `CRM_PRIORITY`, `CRM_TASK_TYPE`, `SERVICE_OBJECT_STATUS`, and
`PROCESS_ACTION` governance is reused.

Migration `0103_crm_intake_role_template_backfill.sql` keeps these intake
permissions in the governed role templates and repairs existing tenant roles.
Read-only access remains read-only.

## Permissions

```text
CRM_INTAKE_READ
CRM_INTAKE_WRITE
CRM_INTAKE_APPROVE
CRM_INTAKE_CONVERT
```

Read-only roles receive read access only. `CRM_USER` can capture intake and
create review work, but approval and conversion remain with the stronger
existing CRM and admin bundles.

## Process Governance

Migration `0102` seeds:

```text
CRM_INTAKE_REVIEW_FLOW_V1
```

Review flow:

```text
captured -> structured -> needs_review -> approved -> converted
                                  |          |
                                  +-> ignored+
                                  |
                                  +-> failed
```

Review tasks are process effects. Raw intake and proposals remain append-only
facts. Route-side conversion is a low-level orchestration primitive that starts
the already governed target process and records an auditable decision.

## Automation Policy Placeholder

The existing tenant CRM subscription metadata stores safe defaults:

```json
{
  "intake_policy": {
    "automation_mode": "review_required",
    "auto_create_threshold": 0.95,
    "review_threshold": 0.6,
    "human_review_required": true
  }
}
```

No automatic conversion is implemented in this wave.

## AI Extraction Readiness

CRM intake includes an extractor adapter boundary:

```text
raw intake
-> extraction adapter
-> structured proposal
-> confidence score and reasons
-> human review
-> governed conversion
```

The built-in adapter is:

```text
rule_based
```

It runs locally without a provider and infers a basic proposal type, summary,
priority, follow-up task, confidence, and confidence reasons.

Tenant CRM metadata stores a disabled-by-default AI policy placeholder:

```json
{
  "ai_extraction_policy": {
    "ai_extraction_enabled": false,
    "provider": "",
    "model": "",
    "mode": "assistive",
    "human_review_required": true,
    "auto_convert_threshold": 0.98,
    "pii_redaction_required": true
  }
}
```

No external AI API is called. Future provider-specific extraction code must
register behind the generic adapter boundary and preserve the same proposal and
review contract. AI output remains a suggestion, never unquestioned truth.

## Dashboard UI

The descriptor-gated `Intake Inbox` tab appears near the CRM overview. It shows:

```text
needs-review, approved, converted, and ignored counts
proposal source and suggested target
sanitized proposal payload
manual validation intake form
approve, convert, ignore, and add-review-task actions
timeline
```

The existing manual CRM object tabs remain available.

The intake conversion modal uses an existing customer/contact lookup and an
explicit `No linked contact yet` option. Operators no longer type raw agent
UUIDs into the modal.

## Gateway Boundary

The public gateway remains border control only. This wave does not change a
public gateway route and does not add a provider connector. A future controlled
consumer may append sanitized raw intake facts from verified gateway records,
but gateway verification must never directly create CRM leads, cases,
opportunities, or tasks.

## Railway Deployment

After API deployment:

```bash
cd services/api
npm run migrate
```

Then redeploy the API and dashboard services.

## Local Verification

```bash
cd services/api
npm test
npm run test:security

cd ../../apps/dashboard
npm run build
```

## Known Limitations

This wave intentionally does not add provider connectors, external AI calls,
reply sending, campaign publishing, automatic conversion, identity stitching,
or duplicate scoring beyond deterministic source-reference idempotency.

## Next Recommended Wave

Add a controlled internal consumer that turns verified gateway facts into
sanitized raw intake records, then expand UI descriptor metadata for
tenant-configurable intake forms, columns, filters, and action labels.
