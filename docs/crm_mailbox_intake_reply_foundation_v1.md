# CRM Mailbox Intake And Reply Foundation V1

Status: implemented foundation
Date: 2026-06-02

## Purpose

EIP owns mailbox intelligence, CRM linkage, workflow, and governed reply
orchestration. It does not own mail transport. A mailbox provider remains the
source of truth for delivery, threading, and provider-side message state.

The first adapter is `manual_test`. It validates the operating model without a
live provider integration. Provider sending is disabled by default.

No CRM-specific persistence table was added.

## Kernel Model

| Concept | Kernel storage | Type |
| --- | --- | --- |
| Protected readable inbound message | `eip_core.info_record` | `CRM_MAILBOX_MESSAGE` |
| Mailbox thread metadata | `eip_core.info_record` | `CRM_MAILBOX_THREAD` |
| Protected reply draft | `eip_core.info_record` | `CRM_MAILBOX_REPLY_DRAFT` |
| Reply approval evidence | `eip_core.info_record` | `CRM_MAILBOX_REPLY_DECISION` |
| Message review work | `eip_core.service_object` | `CRM_MAILBOX_MESSAGE_REVIEW` |
| Reply review work | `eip_core.service_object` | `CRM_MAILBOX_REPLY_REVIEW` |
| Lineage | `eip_core.object_link` | Mailbox, intake, review, and decision relations |

List routes return redacted snippets. Authorized message detail routes return
the protected readable body. Contact metadata stores masked values and hashes
where appropriate. Raw message bodies are never written to logs.

## Adapter Boundary

Provider adapters live under:

```text
services/api/src/services/crm/mailboxAdapters.js
```

The boundary supports:

```text
listMessages
fetchMessage
createDraft
sendReply
markProcessed
```

Planned provider codes are governed dropdown values:

```text
gmail
microsoft_graph
imap
manual_test
```

Only `manual_test` is active in this foundation. It does not send externally.

## Routes

Prefix:

```text
/api/eip/crm
```

```text
GET    /mailbox/readiness
GET    /mailbox/messages
POST   /mailbox/messages/import-manual
GET    /mailbox/messages/:id
POST   /mailbox/messages/:id/create-intake
GET    /mailbox/threads/:threadId

GET    /mailbox/replies
POST   /mailbox/replies/draft
GET    /mailbox/replies/:id
PATCH  /mailbox/replies/:id
POST   /mailbox/replies/:id/approve
POST   /mailbox/replies/:id/send
```

All routes require an EIP session, CSRF, an explicit mailbox permission, the
active `crm.mailbox` capability, and tenant-scoped lookups.

## Intake Flow

```text
manual provider import
-> protected CRM_MAILBOX_MESSAGE
-> CRM_MAILBOX_THREAD linkage
-> sanitized CRM_INTAKE_RAW
-> structured CRM_INTAKE_PROPOSAL
-> CRM_INTAKE_REVIEW process
-> human approval and governed conversion
```

Import and intake creation are idempotent. Mailbox evidence feeds the existing
intake pipeline rather than a separate conversion route.

## Reply Flow

```text
inbound mailbox message
-> protected reply draft
-> CRM_MAILBOX_REPLY_REVIEW process
-> explicit human approval
-> send request
-> send_pending until a governed provider adapter delivers
```

The manual adapter returns HTTP `202` with a safe pending response. It never
sends email. Production provider delivery must be implemented behind the
adapter boundary and configured through the technical connection surface.

## Permissions

```text
CRM_MAILBOX_READ
CRM_MAILBOX_WRITE
CRM_MAILBOX_REPLY_DRAFT
CRM_MAILBOX_REPLY_SEND
```

`CRM_MAILBOX_REPLY_SEND` remains separate from read and draft rights. The
standard CRM user bundle can read, import, and draft, but cannot request send.
Read-only bundles receive mailbox read access only.

## Governed Dropdowns

Migration `0104_crm_mailbox_intake_reply_foundation.sql` seeds:

```text
CRM_MAILBOX_PROVIDER
CRM_MAILBOX_MESSAGE_STATUS
CRM_MAILBOX_DIRECTION
CRM_REPLY_STATUS
```

## Process Governance

Migration `0104` seeds:

```text
CRM_MAILBOX_MESSAGE_FLOW_V1
CRM_REPLY_REVIEW_FLOW_V1
```

The controlled template reseed stage runs
`services/api/db/seed/template_crm_canonical_v1.sql` after the ecommerce
canonical seed. That refreshes both mailbox flows, their related task templates
and bindings, and the `crm.mailbox` capability onto `eip_ecom`. New tenants then
receive tenant-scoped metadata through Admin > Templates while inheriting the
published global CRM descriptor and global dropdown lists.

Message review:

```text
imported -> intake_created -> linked
        \-> archived
        \-> ignored
```

Reply review:

```text
draft -> review -> approved -> send_pending -> sent
                                      \-> send_failed
draft, review, approved -> cancelled
```

## UI Placement

The reusable CRM workspace registers descriptor-backed tabs:

```text
Mailbox
Reply Drafts
```

The Mailbox tab supports manual validation import, protected message detail,
intake creation, and reply draft creation. The Reply Drafts tab supports edit,
approve, and guarded send-request actions.

Technical provider secrets remain outside the tenant CRM workspace.

## Local Validation

```bash
cd services/api
node --test test/crm_mailbox_foundation.test.mjs test/crm_template_clone_path.test.mjs

cd ../../apps/dashboard
npm run build
```

## Railway Validation

After API deploy:

```bash
cd services/api
npm run migrate
npm run reseed:post-migration -- --stage template-tenant
```

Then open the tenant dashboard CRM workspace:

1. Confirm `Mailbox` and `Reply Drafts` tabs appear for an enabled CRM tenant.
2. Import a manual test message.
3. Confirm the list shows a redacted snippet.
4. Open detail and confirm an authorized user can read the protected message.
5. Confirm an intake proposal exists.
6. Draft and approve a reply.
7. Request send and confirm the safe `send_pending` response.

## Deferred Provider Work

Live Gmail, Microsoft Graph, and IMAP adapters remain intentionally deferred.
They must be implemented behind the provider adapter boundary with governed
connection secrets, provider-specific scopes, provider audit events, and
delivery reconciliation.
