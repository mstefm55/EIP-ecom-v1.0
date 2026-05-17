# EIP Process V2 Intent Baseline

Status: Draft (working baseline)  
Owner: Platform Engineering  
Scope: Backend architecture only (DB + server + process engine)

## 1) Purpose

Define the target intent before refactoring so implementation is controlled, reversible, and testable.

This baseline is the contract for the V2 backend clone ("surgical bypass" model):

- Keep current ECOM + CRM behavior running on legacy path.
- Build V2 backend path with the same public/internal API contracts.
- Cut over only after parity and rollback criteria are met.

## 2) Non-Negotiables

- No frontend breakage from V2.
- No route contract drift (request/response shape, status behavior).
- Legacy path remains available until V2 is proven.
- Every V2 write path is idempotent and observable.

## 3) Process Kernel Direction

Use a small, stable effect core plus parameterized execution matrix:

- `effect_type` (generic primitive)
- `operation` (mode)
- `object_type` (business target, parameterized)
- `policy_profile` (validation + security + execution rules)

Do not expand effect list with object-specific names like `DOCUMENT_FETCH_PO`. or `SERVICEOBJECT_CREATE_SALESORDER`
Use generic effects with object parameters instead.

### 3.1 Composite Macro Requirement

Add a macro/composite layer so one business action can execute an ordered combo of effects.

- Macro = named bundle of effects + parameter contract.
- Macro can be attached to a transition or task action.
- UI should expose macro names, not low-level effect internals, for most admins.
- Engine expands macro at runtime into deterministic effect steps.

Examples:

- `PO_SUBMIT_STANDARD` -> status set + task create + notify + audit record
- `SO_CONFIRM_STANDARD` -> status set + inventory reserve + payment intent + notify

Goal: reduce process-builder complexity and keep flows readable.

### 3.2 Task vs Effect Canon (Naming + Resolution)

- Task label is human/business-facing and may vary by organization or tenant.
- Effect is the reusable engine action capability (examples: Create, CreateChild, Fetch, Update, InventoryAmend).
- Canonical executable instance naming pattern: `ServiceObjectType_Effect_ServiceObjectCategory` (examples: `Assets_InventoryAmend_computers`, `SalesOrder_CreateChild_BatchNumber`).
- Naming examples are semantic patterns only. Implementations use generic effect codes with resolved runtime variables; do not create a unique hardcoded function per semantic instance.
- The API/service layer resolves concrete values and governed metadata for execution.
- Field headers used for validation and for building full data structures are governed by dropdown tables or approved metadata.
- Avoid task-list explosion by composing reusable effects with service object type and category rather than proliferating one-off task definitions.

## 4) Core Effect Set (V2 Target)

Freeze core effects to the smallest reusable set:

1. `STATUS_SET`
2. `JSON_MERGE`
3. `TASK_CREATE`
4. `TASK_UPDATE`
5. `LINK_CREATE`
6. `LINK_REMOVE`
7. `CHILD_SERVICE_OBJECT_CREATE`
8. `INFO_RECORD_WRITE`
9. `HTTP_REQUEST`
10. `INSTANCE_START`
11. `NOTIFY_SEND` (new)
12. `TIMER_SCHEDULE` (new)

Module-specific effects (inventory, access grant, finance-specific) stay in module packs unless proven cross-module.

## 5) Object Model Intent

Business classes in the domain include agent/entity, asset, material, document, and money. These classes may support, execute, constrain, or record a process. When any becomes the subject of an active workflow, it is represented as a service object.

Standardize object classes for policy and validation (orthogonal to the business classes above):

- `physical` (material, lot, shipment)
- `financial` (payment, receivable, payable, account movement)
- `document` (PO, SO, invoice, receipt)
- `control` (task, approval, reservation)
- `reference` (party, location, currency, tax profile)

Money is treated as a financial domain object with currency and accounting rules, not only a measurement unit; it can itself be the subject of a process and thus a service object.

## 6) Time and Distance Intent

Persist anchor timestamps (UTC):

- `created_at`, `recorded_at`, `started_at`, `ended_at`
- optional business anchors: `effective_at`, `planned_at`, `due_at`

Durations are computed dynamically by default.  
Cache/materialize only where needed for performance.

Distance/logistics dimensions should be explicit where applicable:

- `from_location_id`, `to_location_id`, `route_id`
- `distance_km`, `lead_time_hours` (or module-specific equivalents)

## 7) Role-Function-Permission Intent

Authorization should map:

- role -> function capability -> operation/object permission

Avoid one-off permission explosion.  
Use operation + object_type policy checks as the default model.

## 8) Engine Algorithm Contract (V2)

Each transition execution must follow this order:

1. Validate transition and action.
2. Enforce permission and policy profile.
3. Resolve idempotency key.
4. Execute effects in deterministic order.
5. Persist state and events atomically.
6. Emit structured trace with correlation id.

Error handling:

- typed errors (validation, permission, policy, execution, integration)
- retry policy only for retriable effects
- optional compensation strategy for cross-system writes

### Transition Policy (Keep vs Remove)

Transitions are still required and should remain the control-flow primitive.

- Keep transitions for routing, branching, guards, approvals, and terminal logic.
- Put heavy behavior inside macros/effects attached to transitions.
- Do not replace graph transitions with only task-level scripting.

Rule of use:

- Transition answers "where flow goes next".
- Macro answers "what business actions execute now".

## 9) Data Plan Constraints

V2 schema changes must be additive first:

- Add new metadata columns/tables before deprecating legacy fields.
- Keep backward compatibility adapters in engine layer.
- Migrations must support rollback and re-run safety.

## 10) Cutover Strategy (Surgical Bypass)

- Runtime flag in server: `PROCESS_ENGINE_IMPL=legacy|v2`
- Run shadow/parity tests against both implementations.
- Canary rollout before full swap.
- Rollback = env switch to `legacy`.

## 11) Exit Criteria for V2 Go-Live

- Contract tests pass for all stable routes.
- Legacy vs V2 parity thresholds met.
- Error budget and latency budget met.
- Rollback drill validated.
- Observability dashboards cover full transition/effect timeline.

## 12) Immediate Next Docs

Create these follow-up documents (no coding before completion):

1. `docs/PROCESS_V2_TABLE_PLAN.md` (exact schema deltas)
2. `docs/PROCESS_V2_ALGO_SPEC.md` (execution details + error taxonomy)
3. `docs/PROCESS_V2_CUTOVER_PLAN.md` (test, canary, rollback runbook)

## 12.1 V2 Capability Tagging and Clone Filter (Locked)

For V2, cloning must support capability-based selection so tenants receive only needed functionality.

### Tag model

Add `capability_tags` as governed metadata on:

- process definitions, transitions, and macro bundles
- effect entries
- UI surface blocks/sections/actions
- dropdown templates and module default settings

Examples: `digital`, `physical`, `barcode`, `customs`, `logistics`, `returns`, `reviews`, `learning`.

### Clone behavior

Clone engine must accept:

- `include_tags[]` (required scope)
- `exclude_tags[]` (optional hard block)

Rules:

1. Resolve dependency graph for selected tags.
2. Block clone if required dependency tags are missing.
3. Emit a clone manifest with included/excluded artifacts and reasons.

### Process Builder impact

Admin console Process Builder must become tag-aware:

- display tag badges on transitions/effects/macros
- allow filtering by tag
- enforce tag compatibility before save/publish
- allow tenant profile presets (e.g., `digital_profile`, `physical_profile`)

Goal: preserve one full-capability EIP template while producing tenant-tailored process/UI payloads without hardcoded forks.

## 13) Locked Domain Intent (Service Object Model Canon)

This section captures the original architecture intent and is locked as baseline guidance.

### 13.1 Service object principle

Service object is the kernel concept of EIP: the generic unit of managed work a process acts upon.
It must be described at two levels simultaneously: conceptual/global kernel unit and operational/drilled-down case instance. These are the same concept at different abstraction levels.
Business classes include agent/entity, asset, material, document, and money. These classes may support, execute, constrain, or record a process; when any becomes the subject of an active workflow, it is represented as a service object.
The process engine acts on service objects, transforms them, and emits outputs. One process may pull multiple inputs (materials/documents/financial objects/agents/assets), mutate them, and produce one or more output objects.

### 13.2 Core object families (V2 target)

Use four primary families for execution policy:

1. `material` (physical stocks, lots, WIP, finished goods)
2. `document` (PO, SO, invoice, routing sheet, quantity sheet, signatures)
3. `financial` (money, payable/receivable state, settlement objects)
4. `agent` (human/org/workstation/asset hierarchy and operating entities)

Notes:

- Money is treated as financial service object behavior (not only a unit).
- Assets are tools in use; when actively managed in a workflow, they are represented as service objects and mapped into the execution families above.
- Agent hierarchy must support drill-down from organization to workstation and assigned assets/humans.
- Tenants can operate macro-level or micro-level depending on needed detail.

### 13.3 Mutation model

Favor reusable generic operations over object-specific effect proliferation:

- `FETCH`, `CREATE`, `AMEND`, `POST`, `COMPLETE`, `CANCEL`

Domain effects can compose these operations, but primitives stay small.

Interpretation:

- Some processes consume inputs and create a new output object (assembly pattern).
- Some processes preserve object identity and mutate attributes/status (transformation pattern).

### 13.4 Canonical examples

Assembly example (telephone):

- Inputs: motherboard + screen + casing (material objects)
- Step: assembly operation
- Output: input components consumed/completed, finished phone object created and posted to stock

Transformation example (fabric dyeing):

- Input: greige fabric material object
- Step: dyeing operation
- Output: same material identity, attributes/status changed (color/state/process route/time/location)

This same pattern must apply to CRM/healthcare/travel domains with domain-specific templates.

### 13.5 Document + process relationship

Documents can be:

- direct service objects (versioned, status-driven), and/or
- process descriptors attached as attributes (for example routing/quantity references).

If a routing definition is itself process-driven, store a stable reference in object attributes, not uncontrolled free JSON.

### 13.6 JSONB governance rule

JSONB remains a flexibility layer, but attribute keys must be governed:

- Dropdown/taxonomy controls allowed keys and value semantics.
- Free-text fields are explicit and scoped.
- Prevent uncontrolled key drift and tenant-by-tenant schema fragmentation.
- Field headers used for validation and for building full data structures are governed by dropdown tables or approved metadata.

### 13.7 Macro vs micro execution

- Macros bundle micro effects into business actions.
- Default authoring is macro-first for admin usability.
- Micro effects remain available for advanced controlled use.
- Avoid excessive micro-management in normal process design.

### 13.8 Delivery sequence (locked)

1. Finish and stabilize V01 sandbox (ECOM + CRM) for immediate commercial usage.
2. Build V2 in clone path with this canon as mandatory reference.
3. Cut over only after parity/testing criteria are met.

### 13.9 Continuity rule for new sessions/agents

Before any new module or process-engine change, contributors must read:

1. `docs/PROCESS_V2_INTENT.md`
2. `docs/DEVELOPER_MANUAL.md` (process guardrails section)

Any deviation requires explicit note in PR/task log with reason and impact.
