# EIP V1 Agent Registry

Last updated: 2026-06-07
Last known main commit: `38c654b5b fix: simplify trade condition rule workflow`
Registry keeper branch: `orchestration/agent-registry-v1`
Registry owner: Agent 0 - Lead Orchestrator / Registry Keeper

This registry coordinates parallel Codex agents for EIP V1 stabilization and V2 planning. It is a coordination document only. It does not authorize production code changes by itself.

## Core Doctrine

Every agent must preserve this architecture:

- Modules are commercial/product surfaces, not independent ERP mini-applications.
- The real architecture is kernel tables, process engine, task engine, effect/action governance, `commercial_condition`, UI surface descriptors, schema/dynamic attrs, `service_object`, and the `agent` model.
- Tenant customization must be metadata-driven, not code-fork driven.
- Routes must remain transport/orchestration only.
- React must remain reusable UI primitives and must not become business policy authority.
- Business process authority belongs to `process_def`, `process_binding`, `task_template`, task/effect governance, and the process engine.
- Commercial/trade policy authority belongs to `commercial_condition`.
- Inventory owns operational stock.
- Procurement owns the buying journey.
- CRM owns customer relationship, intake, sales, and support journeys.
- Tasks owns scheduling, delegation, and workload.
- Dashboard/Command Center is a business cockpit, not a full scheduler.
- Product Studio/Material Master owns product/material setup, not operational inventory execution.
- V2 migration work must not destabilize V1 production.

## Active Agents

| Agent | Scope | Branch | Primary files/directories | Shared files | Forbidden areas | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Agent 0 - Lead Orchestrator / Registry Keeper | Registry, merge order, conflict review, live defect triage if Agent 1 is unavailable | `orchestration/agent-registry-v1` | `docs/orchestration/*`, closure review notes | All shared/high-risk files listed below | Feature implementation unless explicitly assigned | Active |
| Agent 1 - Debug / Integration / UI Polish | Live defects, integration fixes, visual polish, merge conflict repair | `agent/debug-integration-v1` | Targeted files assigned in registry before work | Dashboard surfaces, route registrations, tests | New domain features, migrations without reservation, final PO execution | Standby |
| Agent 2 - Commercial Conditions | `commercial_condition` governance, trade policy UI/logic, pricing/payment/MOQ/lead-time/RFQ thresholds | `agent/commercial-conditions-v1` | `services/api/src/routes/ecom.js`, commercial condition services/tests/docs, Product Studio trade condition primitives when assigned | Dashboard surface descriptors, migrations, Product Studio files | Inventory execution, Procurement process authority, CRM, V2 production changes | Planned |
| Agent 3 - Inventory | Operational stock, stock position, movement views, reorder signals, procurement bridge | `agent/inventory-v1` | Inventory routes/services/tests/docs, inventory dashboard primitives | Dashboard descriptors, migrations, `commercial_condition` policy reads | Procurement buying execution, Product Studio setup ownership, final PO execution | Planned |
| Agent 4 - CRM | Intake, mailbox, leads, cases, customer timeline, campaigns/signals, governed AI-draft readiness | `agent/crm-v1` | CRM routes/services/tests/docs, CRM dashboard primitives | Dashboard descriptors, migrations, server route registration | Procurement, Inventory execution, Product Studio, V2 production changes | Planned |
| Agent 5 - Procurement | Purchase needs, supplier options, requisitions, RFQs, quote comparison, cash/direct path; no final PO | `agent/procurement-v1` | Procurement routes/services/tests/docs, buying workbench UI primitives | Dashboard descriptors, migrations, `commercial_condition` policy reads | Final Purchase Order processing, PO sending, invoice matching, accounting ledger, payment execution | Planned |
| Agent 6 - V2 Migration / Kernel Governance | V2 governance, effect/action library, document governance, `service_object` canon, migration strategy | `agent/v2-migration-governance` | V2 planning docs, kernel governance docs when assigned | Architecture docs, migration strategy docs | V1 production behavior, V1 runtime routes/UI, V1 migrations unless explicitly approved | Planned |

If only five Codex workers are available, Agent 1 is merged into Agent 0. Otherwise keep all six worker streams separate.

## Shared / High-Risk Files Requiring Coordination

Any agent touching these files must declare intent before coding and mention the change in the closure report:

- `apps/dashboard/src/engine/registry.jsx`
- `apps/dashboard/src/engine/surfaces/dashboard.js`
- `services/api/src/server.js`
- `services/api/db/seed/ui_surface_dashboard.sql`
- `services/api/db/migrations/*`
- `services/api/package.json`
- `apps/dashboard/package.json`
- `docs/sme_operating_model_v1.md`

## Forbidden Overlap Zones

- No two agents may edit the same route family at the same time.
- No two agents may edit the same dashboard workspace component at the same time.
- No two agents may add or modify migrations without registry reservation.
- No agent may modify another agent's active branch or assigned scope.
- No V1 worker may modify V2 work unless the registry explicitly assigns it.
- No V2 worker may modify V1 production behavior.
- No agent may introduce fake/demo production data.
- No agent may add final Purchase Order execution unless explicitly assigned in a future registry update.

## Current Branch Plan

| Agent | Branch |
| --- | --- |
| Agent 0 | `orchestration/agent-registry-v1` |
| Agent 1 | `agent/debug-integration-v1` |
| Agent 2 | `agent/commercial-conditions-v1` |
| Agent 3 | `agent/inventory-v1` |
| Agent 4 | `agent/crm-v1` |
| Agent 5 | `agent/procurement-v1` |
| Agent 6 | `agent/v2-migration-governance` |

## Migration Number Reservations

Current latest known migration at registry creation: `0120_commercial_condition_structured_fields.sql`

| Reserved number | Agent | Purpose | Status |
| --- | --- | --- | --- |
| None | None | None | Open |

Reservation rule:

1. Before creating a migration, the agent must check the latest migration number on latest `main`.
2. The agent must reserve the next number in this registry before coding.
3. The migration must be additive and justified.
4. No migration may be created for fake/demo data.
5. If a reserved migration is abandoned, Agent 0 must clear or mark the reservation.

## Surface Descriptor Ownership

| Surface area | Primary owner | Coordination required |
| --- | --- | --- |
| Command Center / Tasks cockpit | Agent 1 or Agent 0 | Yes, with all module agents |
| Product Studio / Material Master | Agent 2 when commercial conditions are assigned; otherwise Agent 0 | Yes, with Inventory and Procurement |
| Inventory workspace | Agent 3 | Yes, with Procurement and Commercial Conditions |
| CRM workspace | Agent 4 | Yes, with Tasks and Debug/Integration |
| Procurement workspace | Agent 5 | Yes, with Inventory and Commercial Conditions |
| Admin / Connections / Security | Agent 0 or explicitly assigned agent | Yes, high-risk |

## Route Ownership

| Route family | Primary owner | Notes |
| --- | --- | --- |
| `/api/eip/ecom` | Agent 2 for commercial condition/product policy work; Agent 0 for integration repair | Coordinate with Product Studio, Inventory, Procurement |
| `/api/eip/inventory` | Agent 3 | Must not own procurement process authority |
| `/api/eip/crm` | Agent 4 | Must remain tenant-scoped, CSRF/RBAC protected |
| `/api/eip/procurement` | Agent 5 | Routes stay thin; process authority remains process engine |
| `/api/eip/tasks` and scheduling/workload routes | Agent 1 or Agent 0 | Coordinate with Command Center |
| Auth/security/admin routes | Agent 0 unless assigned | High-risk |

## Test Ownership

| Test area | Primary owner |
| --- | --- |
| Product Studio / commercial condition tests | Agent 2 |
| Inventory tests | Agent 3 |
| CRM tests | Agent 4 |
| Procurement tests | Agent 5 |
| Command Center / Task Browser / integration UI tests | Agent 1 or Agent 0 |
| Security, tenant isolation, gateway, auth tests | Agent 0 unless assigned |

## Documentation Ownership

| Document area | Primary owner |
| --- | --- |
| `docs/orchestration/*` | Agent 0 |
| Commercial policy docs | Agent 2 |
| Inventory docs | Agent 3 |
| CRM docs | Agent 4 |
| Procurement docs | Agent 5 |
| V2 migration/governance planning docs | Agent 6 |

## Merge Order

Default merge order:

1. Agent 0 orchestration docs
2. Agent 1 debug/integration fixes
3. Agent 2 commercial conditions
4. Agent 3 inventory
5. Agent 5 procurement
6. Agent 4 CRM
7. Agent 6 V2 planning docs

Agent 0 may change merge order when live defects, migration reservations, or descriptor conflicts require it.

## Current Blockers

- No migration reservations are active.
- No feature branches are registered as active yet.
- Agents must not start coding until they declare intended files and confirm latest `main`.
