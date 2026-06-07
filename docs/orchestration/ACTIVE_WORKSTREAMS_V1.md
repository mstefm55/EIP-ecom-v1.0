# EIP V1 Active Workstreams

Last updated: 2026-06-07
Last known main commit: `38c654b5b fix: simplify trade condition rule workflow`

This file tracks current and planned parallel workstreams. It is a planning document and does not authorize agents to bypass the registry or protocol.

## Agent 0 - Lead Orchestrator / Registry Keeper

Status: active

Scope:

- Maintain `docs/orchestration/*`.
- Coordinate branch ownership, migration reservations, merge order, and conflict review.
- Handle live defects and integration conflicts when Agent 1 is unavailable.

Current branch:

- `orchestration/agent-registry-v1`

Current deliverable:

- Create initial multi-agent orchestration registry and protocol.

## Agent 1 - Debug / Integration / UI Polish

Status: standby

Scope:

- Live defects.
- Merge conflicts.
- UI polish where explicitly assigned.
- Regression fixes caused by parallel streams.

Recommended branch:

- `agent/debug-integration-v1`

Notes:

- If only five Codex workers are available, Agent 1 is merged into Agent 0.
- Agent 1 must not add broad new features.

## Agent 2 - Commercial Conditions

Status: planned

Scope:

- `commercial_condition` governance.
- Trade policy UI/logic.
- Pricing, payment, MOQ, lead time, RFQ thresholds.
- Structured business values used by workbenches and process decisions.

Recommended branch:

- `agent/commercial-conditions-v1`

Guardrails:

- Commercial/trade policy authority remains `commercial_condition`.
- Product Studio may be touched only for assigned commercial-condition UI primitives.
- Inventory and procurement execution remain outside this agent's ownership.

## Agent 3 - Inventory

Status: planned

Scope:

- Operational stock.
- Stock position.
- Movement views.
- Reorder signals.
- Procurement bridge.

Recommended branch:

- `agent/inventory-v1`

Guardrails:

- Inventory owns stock execution.
- Reorder policy may read `commercial_condition`, but Inventory must not own procurement buying workflow.

## Agent 4 - CRM

Status: planned

Scope:

- Intake.
- Mailbox.
- Leads.
- Cases.
- Customer timeline.
- Campaigns/signals.
- Governed AI-draft readiness where assigned.

Recommended branch:

- `agent/crm-v1`

Guardrails:

- CRM owns customer relationship/intake/sales/support journeys.
- CRM must remain kernel/process driven and tenant-scoped.

## Agent 5 - Procurement

Status: planned

Scope:

- Purchase needs.
- Supplier options.
- Requisitions.
- RFQs.
- Quote comparison.
- Cash/direct path.

Recommended branch:

- `agent/procurement-v1`

Guardrails:

- No final Purchase Order processing.
- No PO lifecycle UI.
- No supplier outbound transmission.
- No invoice matching, accounting ledger, or payment execution.
- Procurement routes remain thin; process engine owns business process authority.

## Agent 6 - V2 Migration / Kernel Governance

Status: planned

Scope:

- V2 governance.
- Effect/action library.
- Document governance.
- `service_object` canon.
- Migration strategy.

Recommended branch:

- `agent/v2-migration-governance`

Guardrails:

- No V1 production changes.
- V2 planning must not destabilize V1 production.

## Initial Shared Files Requiring Coordination

- `apps/dashboard/src/engine/registry.jsx`
- `apps/dashboard/src/engine/surfaces/dashboard.js`
- `services/api/src/server.js`
- `services/api/db/seed/ui_surface_dashboard.sql`
- `services/api/db/migrations/*`
- `services/api/package.json`
- `apps/dashboard/package.json`
- `docs/sme_operating_model_v1.md`

## Next Recommended Agent To Launch

Agent 2 - Commercial Conditions.

Reason:

- Recent work introduced structured commercial-condition values.
- The next safe stream is to refine governed trade policies and ensure workbenches consume them without moving policy into React or routes.
