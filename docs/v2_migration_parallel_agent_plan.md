# V2 Migration Parallel Agent Plan

Status: planning only
Date: 2026-06-07

## Purpose

This document records migration-governance planning for a separate future branch. It does not modify V1 runtime behavior, production routes, database migrations, UI surfaces, or deployment settings.

The V1 stabilization lane remains the source of truth for current hosted production work.

## Planning Boundary

```text
Allowed in this wave:
- inventory / CRM / procurement / commercial-condition migration risk notes
- service_object, process, task, effect, and UI descriptor mapping guidance
- future branch sequencing recommendations

Not allowed in this wave:
- V2 production code changes
- V2 migrations
- V1 runtime changes for migration convenience
- schema drift without a V1 production need
```

## V1 Canon To Preserve

| Area | V1 authority to preserve |
| --- | --- |
| Product/material setup | Product Studio / material master metadata |
| Operational stock | Inventory routes and stock/reorder service objects |
| Trade/commercial policy | `eip_core.commercial_condition` |
| Buying journey | Procurement service objects and process flows |
| Customer journey | CRM `agent`, `service_object`, `task`, `info_record`, and `object_link` |
| Work scheduling | Kernel task model and Tasks surface |
| Business cockpit | Dashboard / Command Center |
| Process authority | `process_def`, `process_binding`, `task_template`, process engine |
| UI composition | UI surface descriptors and reusable React primitives |

## Parallel Agent Workstreams

Future migration work should run in separate branches with explicit handoffs:

```text
Agent A: kernel/service_object canon
Agent B: process/effect/task governance
Agent C: commercial_condition and pricing/trade policy
Agent D: UI descriptors and surface portability
Agent E: document/integration/security governance
Agent F: migration tests, fixtures, and cutover runbooks
```

Agents must not rewrite V1 production behavior while planning or validating migration paths.

## Inventory Migration Concerns

Inventory must stay operational-stock focused. Future work can expand warehouse execution only after preserving:

```text
material.attrs.inventory state
INVENTORY_REORDER_SUGGESTION service objects
INVENTORY_STOCK_MOVEMENT info_records
commercial_condition reorder policy
procurement handoff links
process-governed approve/ignore transitions
```

Deferred migration topics:

```text
warehouse/bin execution
lots and serial execution
valuation ledger
MRP and production planning
```

## Commercial Conditions Migration Concerns

`commercial_condition` remains the V1 trade/commercial policy authority. Migration must preserve:

```text
condition_type
condition_category
scope
effect structured values
validity dates
priority
active state
resolver semantics used by Inventory and Procurement
```

Legal, compliance, and document lifecycle should become separate governance models in future work. They should not be folded into commercial conditions during migration.

## CRM Migration Concerns

CRM currently uses kernel primitives rather than CRM-specific tables:

```text
agent
service_object
task
info_record
object_link
process_def / process_binding
task_template
```

Migration must preserve the intake journey:

```text
mailbox/intake fact
-> structured proposal
-> human approval / ignore / conversion
-> lead, case, opportunity, customer, task, reply, and timeline
```

Provider sync, autonomous replies, and external AI extraction remain future branches.

## Procurement Migration Concerns

Procurement owns the buying journey but not final PO execution in V1:

```text
purchase need
-> supplier options
-> requisition/RFQ/cash/direct route
-> quote comparison
-> governed approval
-> future purchase boundary
```

Migration must preserve the explicit boundary:

```text
No final PO execution
No supplier outbound transmission
No invoice matching
No accounting ledger
```

## Effect / Action Library Risks

Before migration implementation, audit:

```text
process_action codes
effect aliases
task template side effects
idempotency keys
transition names
route-level adapters that call process engine
```

Any renaming must include compatibility mapping and regression tests for existing V1 process instances.

## Document Governance Risks

Do not treat commercial conditions as document governance. Future document governance should cover:

```text
contract files
legal review
signed document evidence
regulated product attestations
privacy/legal holds
retention and audit policy
```

This should be planned as a separate governance surface with its own process and permission model.

## Recommended Branch Strategy

```text
1. Keep V1 stabilization on main and short-lived V1 branches.
2. Create a separate migration branch only after V1 closure.
3. Run schema/process/UI descriptor inventory before implementation.
4. Use fixtures cloned from canonical templates, not hand-built demo data.
5. Require parity tests for Inventory, CRM, Procurement, Tasks, Dashboard, and Commercial Conditions before cutover.
```

## Non-Goals

```text
No V1 runtime change.
No migration code in this wave.
No new table.
No Product Studio change.
No final Purchase Order execution.
```
