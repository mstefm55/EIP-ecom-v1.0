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

- Maintain the multi-agent orchestration registry and protocol.

Closure must state:

- Registry/protocol updates were docs-only unless explicitly assigned otherwise.
- No production code or feature behavior changed.

## Agent 1 - Debug / Integration / UI Polish

Status: standby

Role:

- Fix live defects, integration mismatches, visual polish, build failures, Railway deployment issues, and merge conflicts.

Allowed scope:

- Command Center minor polish.
- Tasks module minor polish.
- Broken UI states.
- Broken endpoint wiring.
- Descriptor mismatch repairs.
- Build/test failures.
- Migration application issues.

Default task:

- Audit latest live Dashboard/Tasks UI and fix only confirmed defects: unreadable task rows, unclear selected states, duplicate display references, broken buttons/chips, broken empty states, descriptor mismatches, and build/runtime errors.

Forbidden:

- New business modules.
- Product Studio feature work.
- Inventory feature expansion.
- Procurement feature expansion.
- CRM feature expansion.
- V2 migration changes.
- Fake/demo data.
- Final PO execution.

Must preserve:

- Dashboard is the business cockpit.
- Tasks is detailed scheduling/delegation/workload.
- Product Studio is untouched unless explicitly assigned.

Recommended branch:

- `agent/debug-integration-v1`

Notes:

- If only five Codex workers are available, Agent 1 is merged into Agent 0.

## Agent 2 - Commercial Conditions

Status: planned

Role:

- Improve trade policy and `commercial_condition` governance.

Scope:

- `commercial_condition` usage.
- Trade condition display.
- Pricing conditions.
- Supplier/customer terms.
- MOQ.
- Lead time.
- Payment terms.
- Credit terms.
- RFQ threshold.
- Validity dates.
- Condition expiry.
- Renewal tasks if already supported.
- Trade-policy docs.

Allowed:

- Audit existing `commercial_condition` usage.
- Centralize condition type/category helpers if duplicated.
- Improve descriptors and empty states around trade conditions.
- Prepare Product Studio trade-condition modal plans if requested, but do not implement Product Studio UI unless explicitly assigned.
- Improve docs explaining `commercial_condition` boundaries.

Strict boundary:

- Trade conditions are for trade/commercial/contract terms.
- Do not dump legal/regulatory/compliance frameworks into `commercial_condition`.
- Legal/compliance is a future separate framework unless existing governed data exists.

Forbidden:

- Inventory execution.
- Stock movements.
- RFQ execution ownership.
- PO execution.
- CRM ownership.
- Fake conditions.
- Tenant-specific hardcoding.

Recommended branch:

- `agent/commercial-conditions-v1`

Closure must state:

- `commercial_condition` remains trade/commercial policy authority.
- Legal/compliance was not mixed into trade conditions.

## Agent 3 - Inventory

Status: planned

Role:

- Improve Inventory as production-backed operational stock management.

Scope:

- Inventory operational stock.
- Stock signals.
- Stock position.
- Stock movements.
- Reorder recommendation display.
- Policy display.
- `commercial_condition` policy source.
- Material override separation.
- Procurement bridge.
- Physical/digital behavior.
- Inventory docs/tests.

Default task:

- Make Inventory production-backed, clear, and useful with real data or empty states only: stock signal workbench, stock position view, movement view, policy view, procurement bridge, and actions that are governed or disabled with explanation.

Strict boundary:

- Inventory owns operational stock.
- Product Studio owns material setup.
- Procurement owns buying journey.
- Tasks owns scheduling/delegation.
- Dashboard owns urgent summary only.

Forbidden:

- Product Studio changes.
- Supplier quote/RFQ UI duplication.
- Final PO execution.
- Production planning.
- Fake inventory rows.
- Fake stock locations.
- Fake stock charts.

Recommended branch:

- `agent/inventory-v1`

Closure must state:

- No fake inventory/demo data was added.
- Inventory owns operational stock only.
- Product Studio was untouched.
- Procurement remains buying journey owner.
- `commercial_condition` remains policy authority.

## Agent 4 - CRM

Status: planned

Role:

- Improve CRM/intake/customer relationship flow using real data and process governance.

Scope:

- CRM intake.
- Mailbox.
- Reply drafts.
- Leads.
- Cases.
- Opportunities.
- Customer timeline.
- Campaigns/signals.
- AI-draft readiness where governed.
- CRM docs/tests.

Strict journey:

```text
incoming message/intake
-> extracted proposal
-> approve/ignore/convert
-> lead/case/opportunity/customer timeline
-> reply/task
```

Allowed:

- Improve CRM journey UI.
- Improve CRM workbench readability.
- Fix CRM task/intake integration.
- Improve production empty states.
- Ensure mailbox/intake/reply drafts do not feel disconnected.

Forbidden:

- Payments ownership.
- Procurement ownership.
- Inventory ownership.
- Fake customer/demo data.
- External AI provider calls unless already configured/governed.
- Ungoverned message sending.

Recommended branch:

- `agent/crm-v1`

Closure must state:

- CRM remains customer journey owner.
- Actions remain process/task governed.
- No fake CRM data was added.

## Agent 5 - Procurement

Status: planned

Role:

- Maintain and improve procurement buying journey without drifting into PO execution.

Scope:

- Purchase needs.
- Supplier options.
- Requisitions.
- RFQ.
- Supplier quote comparison.
- Cash/direct path.
- Procurement workbench.
- Supplier links.
- Procurement docs/tests.

Strict boundary:

- Inventory creates/raises stock need.
- Procurement owns buying decision.
- Product Studio owns supplier/trade setup.
- Final Purchase Order processing is deferred.

Allowed:

- Polish existing Procurement Workbench.
- Fix real data display.
- Improve empty states.
- Improve route thinness if drift appears.
- Improve tests/docs.

Forbidden:

- Final PO execution.
- Supplier outbound transmission.
- Invoice matching.
- Accounting ledger.
- Goods receipt finalization beyond existing cash receipt foundation.
- Inventory movement ownership.
- Fake supplier quotes.
- Fake procurement data.

Recommended branch:

- `agent/procurement-v1`

Closure must state:

- No PO execution was added.
- Procurement remains buying journey owner.
- Routes remain transport/orchestration.
- Process engine remains business process authority.

## Agent 6 - V2 Migration / Kernel Governance

Status: planned

Role:

- Work on V2 governance, migration strategy, effect/action library, document governance, and kernel hardening.

Scope:

- V2 repo only unless explicitly instructed otherwise.
- Effect library governance.
- Process/macro/effect catalog.
- Document governance.
- `service_object` canon.
- Hardcoding audit.
- V1-to-V2 migration strategy.
- V2 docs/tests.

Core rule:

- V2 improves governance without destabilizing V1 production.

Forbidden:

- V1 production modification.
- Speculative full rewrite.
- Unjustified new tables.
- Executable JS stored in DB.
- Broad feature expansion.

Recommended branch:

- `agent/v2-migration-governance`

Closure must state:

- V2 work did not modify V1 production.
- Effect/document/service-object governance status is clear.
- Remaining migration limitations are documented.

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
