# CRM Module V1

## Purpose

CRM is a reusable EIP module built on kernel primitives. It does not introduce customer, lead, opportunity, case, interaction, or CRM-task tables.

## Existing Foundation Continued

The module continues the existing `/api/eip/crm` route family and reuses:

- `eip_core.agent` for people, organizations, prospects, customers, and segments.
- `entity_contact`, `entity_address`, and `entity_bank_account` for structured agent details.
- `service_object` for `CRM_LEAD`, `CRM_INTERACTION`, `CRM_CASE`, and `CRM_OPPORTUNITY`.
- `service_object_party` and `object_link` for relationships.
- `task` and task status events for actionable follow-ups.
- `info_record` and `object_link` for notes and activity logs.
- `process_def`, `process_instance`, `process_binding`, and `task_template` for reusable workflows.

No CRM-specific persistence table is added.

## Completed Operations

The existing agent, interaction, case, opportunity, task, summary, and segment-note routes remain active. The completion route module adds:

- Lead create, list, detail, update, status transition, follow-up task, and conversion routes.
- Case and opportunity update routes.
- Generic CRM note creation and timeline retrieval.
- Agent overview with contacts, addresses, bank accounts, and linked service objects.
- Governed CRM dropdown retrieval.
- KPI overview for leads, pipeline, cases, follow-ups, activities, notes, and active agents.

## Lead Conversion

Lead conversion is a governed `convert` transition from `qualified` to `converted`.

The process engine performs:

1. Lead status update.
2. Child `CRM_OPPORTUNITY` creation.
3. `CONVERTED_FROM` object link.
4. Customer party link.
5. Opportunity follow-up task creation.
6. CRM activity log write.
7. Opportunity process start.

The API route validates tenant scope and supplies transition payload only. It does not implement conversion as an independent business workflow.

## Governed Dropdowns

- `CRM_LEAD_STATUS`
- `CRM_CASE_STATUS`
- `CRM_OPPORTUNITY_STATUS`
- `CRM_PRIORITY`
- `CRM_INTERACTION_CHANNEL`
- `CRM_INTERACTION_DIRECTION`
- `CRM_TASK_TYPE`
- `CRM_SOURCE`
- `CRM_REASON_LOST`

The core `SERVICE_OBJECT_STATUS` list remains the runtime status authority used by the process engine.

## Permissions

Existing permissions remain. Additive permissions are:

- `CRM_LEAD_READ`
- `CRM_LEAD_WRITE`
- `CRM_LEAD_CONVERT`
- `CRM_TIMELINE_READ`
- `CRM_NOTE_WRITE`

They are added to the appropriate CRM, admin, universal, full-access, and read-only bundles.

## Security

CRM routes require:

- EIP session
- CSRF validation, including reads for compatibility with the existing CRM security posture
- CRM permission
- session tenant scope in every query
- masked bank account and IBAN identifiers in agent overview reads

No route accepts tenant scope from the browser.

## Activation

The dashboard surface includes a CRM descriptor node. Its menu item is shown only when the tenant has an active `crm` module setting. Use the existing Admin Modules panel to enable CRM for a tenant.

## CRM Intelligence Foundation

The additive CRM Intelligence foundation is documented in:

```text
docs/crm_intelligence_foundation_v1.md
```

It continues the same kernel model:

- segments and market groups are agents
- campaigns are `CRM_CAMPAIGN` service objects
- normalized signals are sanitized information records
- campaign and signal relationships use object links
- connector readiness is secret-free metadata derived from existing connection profiles
- dashboard tabs are descriptor-driven and capability-gated

## CRM Intake Foundation

The additive CRM Intake foundation is documented in:

```text
docs/crm_intake_foundation_v1.md
```

It adds a review-based intake inbox over existing kernel primitives:

- sanitized source facts, proposals, and decisions are `info_record` rows
- review work is a process-bound `CRM_INTAKE_REVIEW` service object
- lineage is preserved with `object_link`
- target leads, opportunities, cases, interactions, signals, notes, and tasks reuse existing governed models
- the local rule-based extractor works without an external provider
- future AI extractors remain behind a disabled-by-default adapter policy

## Railway Restore

After deploying the API commit, run:

```bash
cd services/api
npm run migrate
```

Then redeploy the dashboard so its registry includes `CrmWorkspace`.
