# CRM + Process Engine v1 (Backend)

## Scope
- Backend-only CRM on top of kernel tables.
- Process engine is core (kernel-level) and shared by all modules.
- No new customer tables; customers are `eip_core.agent`.
- Interactions, cases, opportunities, rentals, and MTO projects are `eip_core.service_object`.
- Status transitions are recorded in `eip_core.service_object_status_event` and `eip_core.task_status_event`.

## Data Model Summary
- Agents: `eip_core.agent` (agent_type PERSON/ORG/SEGMENT/etc).
- Contacts/addresses/bank accounts: `eip_core.entity_contact`, `eip_core.entity_address`, `eip_core.entity_bank_account`.
- Interactions: `service_object.object_type='CRM_INTERACTION'` + `service_object_party` links.
- Leads: `service_object.object_type='CRM_LEAD'` + process-governed conversion.
- Cases: `service_object.object_type='CRM_CASE'` + status events.
- Opportunities: `service_object.object_type='CRM_OPPORTUNITY'` + status events.
- Tasks: `eip_core.task` + task status events.
- Process engine (kernel): `process_def`, `process_instance`.
- Segment notes: `info_record.record_type='CRM_SEGMENT_NOTE'` + `object_link`.
- Segments and market groups: `agent.agent_type='SEGMENT'|'MARKET_GROUP'`.
- Master campaigns: `service_object.object_type='CRM_CAMPAIGN'`.
- Normalized CRM intelligence signals: `info_record.record_type='CRM_SIGNAL'|'CRM_CAMPAIGN_SIGNAL'`.
- CRM intake ledger: `info_record.record_type='CRM_INTAKE_RAW'|'CRM_INTAKE_PROPOSAL'|'CRM_INTAKE_DECISION'`.
- CRM intake review work: `service_object.object_type='CRM_INTAKE_REVIEW'`.

## Permissions
CRM permissions are separate from core process permissions:
- `CRM_AGENT_READ`, `CRM_AGENT_WRITE`
- `CRM_INTERACTION_READ`, `CRM_INTERACTION_WRITE`
- `CRM_CASE_READ`, `CRM_CASE_WRITE`
- `CRM_OPPORTUNITY_READ`, `CRM_OPPORTUNITY_WRITE`
- `CRM_TASK_READ`, `CRM_TASK_WRITE`
- `CRM_DASHBOARD_READ`
- `CRM_LEAD_READ`, `CRM_LEAD_WRITE`, `CRM_LEAD_CONVERT`
- `CRM_TIMELINE_READ`, `CRM_NOTE_WRITE`
- `CRM_SEGMENT_READ`, `CRM_SEGMENT_WRITE`
- `CRM_CAMPAIGN_READ`, `CRM_CAMPAIGN_WRITE`
- `CRM_SIGNAL_READ`, `CRM_SIGNAL_WRITE`
- `CRM_INTELLIGENCE_READ`, `CRM_CONNECTOR_READ`
- `CRM_INTAKE_READ`, `CRM_INTAKE_WRITE`, `CRM_INTAKE_APPROVE`, `CRM_INTAKE_CONVERT`

Core process permissions:
- `PROCESS_DEF_READ`, `PROCESS_DEF_WRITE`
- `PROCESS_INSTANCE_READ`, `PROCESS_INSTANCE_WRITE`

Demo tenant roles seeded:
- `CRM_ADMIN`: all CRM permissions
- `CRM_USER`: read + limited write (no opportunity or process write)
- `ADMIN_SUPER`: CRM permissions added for demo tenant

## Routes (prefix: /api/eip/crm)
Agents:
- GET /agents
- POST /agents
- GET /agents/:id
- PATCH /agents/:id
- POST /agents/:id/contacts
- POST /agents/:id/addresses
- POST /agents/:id/bank-accounts

Interactions:
- POST /interactions
- GET /interactions
- GET /interactions/:id
- PATCH /interactions/:id
- POST /interactions/:id/tasks

Cases:
- POST /cases
- GET /cases
- GET /cases/:id
- POST /cases/:id/status
- POST /cases/:id/tasks
- PATCH /cases/:id

Opportunities:
- POST /opportunities
- GET /opportunities
- GET /opportunities/:id
- POST /opportunities/:id/status
- POST /opportunities/:id/tasks
- PATCH /opportunities/:id

Leads:
- POST /leads
- GET /leads
- GET /leads/:id
- PATCH /leads/:id
- POST /leads/:id/status
- POST /leads/:id/tasks
- POST /leads/:id/convert

Tasks:
- GET /tasks
- POST /tasks
- POST /tasks/:id/status

Process engine (core, shared):
- See `/api/eip/core/process/*`

Dashboard:
- GET /dashboard/summary
- GET /dashboard/overview

Governance and timeline:
- GET /governance/options
- GET /timeline?object_kind=agent|service_object|task&object_id=...
- POST /notes
- GET /agents/:id/overview

Segment notes:
- POST /segments/:id/notes

CRM Intelligence foundation:
- GET /segments
- POST /segments
- GET /segments/:id
- PATCH /segments/:id
- POST /segments/:id/link
- POST /segments/:id/tasks
- GET /segments/:id/timeline
- GET /campaigns
- POST /campaigns
- GET /campaigns/:id
- PATCH /campaigns/:id
- POST /campaigns/:id/status
- POST /campaigns/:id/link
- POST /campaigns/:id/tasks
- POST /campaigns/:id/notes
- GET /campaigns/:id/timeline
- POST /campaigns/:id/channel-variants
- PATCH /campaigns/:id/channel-variants/:variantId
- GET /signals
- POST /signals
- GET /signals/:id
- POST /signals/:id/link
- POST /signals/:id/promote
- GET /intelligence/capabilities
- GET /intelligence/overview
- GET /intelligence/connectors

CRM Intake foundation:
- GET /intake
- POST /intake/manual
- GET /intake/overview
- GET /intake/:id
- PATCH /intake/:id
- POST /intake/:id/approve
- POST /intake/:id/ignore
- POST /intake/:id/convert
- POST /intake/:id/tasks
- GET /intake/:id/timeline

## Status Governance
- CRM statuses are stored in `SERVICE_OBJECT_STATUS` (core list) with scoped attrs.
- Case values: new, in_progress, on_hold, resolved, closed, cancelled.
- Opportunity values: new, qualified, proposal, negotiation, won, lost.
- Lead values: new, contacted, qualified, unqualified, converted, archived.
- `TASK_STATUS` exists in core; validation enforced on task status changes.
- Case/opportunity status endpoints require an active process instance and dispatch to the core engine.

## Migrations
- `db/migrations/0039_crm_process_v1.sql`
  - Adds CRM dropdown lists/values
  - Adds CRM indexes
- `db/migrations/0040_authz_crm_permissions.sql`
  - Adds CRM permissions
  - Seeds CRM roles for demo tenant
- `db/migrations/0041_core_process_permissions.sql`
  - Adds core process permissions
- `db/migrations/0042_dropdown_values_patch.sql`
  - Adds missing dropdown values to existing lists (no new lists)
- `db/migrations/0099_crm_module_completion.sql`
  - Adds governed CRM dropdown lists, lead status values, additive permissions, reusable process definitions, process bindings, follow-up templates, and dashboard UI descriptors.
  - Adds no CRM-specific persistence table.
- `db/migrations/0101_crm_intelligence_foundation.sql`
  - Adds governed segment, campaign, signal, and connector-readiness vocabularies.
  - Adds `CRM_CAMPAIGN_FLOW_V1`, `CRM_SEGMENT_REVIEW_FLOW_V1`, bindings, task templates, additive permissions, capability defaults, and descriptor tabs.
  - Adds no CRM-specific persistence table.
- `db/migrations/0102_crm_intake_foundation.sql`
  - Adds governed CRM intake vocabularies, permissions, review process binding, follow-up template, safe policy metadata, indexes, and dashboard descriptor repair.
  - Adds no CRM-specific persistence table.
- `db/migrations/0103_crm_intake_role_template_backfill.sql`
  - Adds CRM intake grants to governed role templates and repairs existing tenant role permissions.
  - Preserves read-only access without granting intake writes.

## Scripts
- `scripts/crm_happy_path.sh`
- `scripts/core_process_happy_path.sh`

## Notes
- All endpoints require session + CSRF + permission checks (including GET).
- All queries are tenant-scoped using session.tenant_id.
- Status transitions insert into event tables through the core engine.
- Lead conversion is a core process transition. It creates a linked opportunity, links the customer party, creates the opportunity follow-up task, records an activity note, and starts the opportunity process.
- Dashboard visibility is descriptor-driven and gated by the active `crm` tenant module setting.
- CRM Intelligence tabs are descriptor-driven and gated by capabilities under the active `crm` subscription setting.
- CRM Signals are sanitized append-only information records. External references are hashed by default.
- Connector readiness is secret-free metadata derived from existing connection profiles. Technical setup remains in Admin Console.
- CRM Intake stores sanitized raw facts, structured proposals, review decisions, and lineage without adding a CRM-specific table.
- CRM Intake defaults to human review and uses a local rule-based extractor. External AI adapters remain disabled until explicitly governed.
