# EIP Mandatory Engine-First Rule

Date: 2026-05-29  
Scope: All future EIP implementation waves, including V1 stabilization, V2/V24 design, Process Studio, Admin Console, Commerce, CRM, Scheduler, Gateway, and tenant/custom UI surfaces.

## Executive rule

All EIP functionality must be built on top of the **UI engine** and the **process engine** by default.

This is not optional guidance. It is a mandatory architecture rule.

```text
Backend-governed metadata
-> Process engine / task engine / effect governance
-> UI engine / surface renderer
-> Specialized React widgets only where necessary
```

Any implementation that bypasses these engines must be treated as architectural drift unless it is a narrowly justified low-level primitive.

## Why this rule exists

EIP is intended to be a configurable ERP platform, not a set of hardcoded application screens.

If features are implemented as fixed React screens and route-specific business logic, future customer customization will require:

- React forks
- tenant-specific patches
- duplicated screens
- fragile conditionals
- hardcoded process logic
- inconsistent business semantics
- expensive refactoring later

That would undermine EIP’s core market position as a process-driven, metadata-governed, adaptable ERP kernel.

## Mandatory default architecture

Every feature must ask these questions first:

1. Can this screen be represented as a UI engine surface/descriptor?
2. Can this workflow be represented as a process definition, task template, process binding, trigger, effect, or governed metadata?
3. Can tenant-specific variation be expressed as metadata rather than code?
4. Can role visibility and actions be controlled by descriptors/RBAC rather than hardcoded React conditionals?
5. Can labels, sections, node categories, actions, validations, and panels be configured without forking components?

If the answer is yes, Codex must use the UI/process engine path.

## UI engine mandatory responsibilities

The UI engine / surface renderer should govern as much as possible, including:

- screen layout
- panel composition
- card composition
- tabs
- toolbar actions
- menu visibility
- route surface selection
- role-based visibility
- tenant-specific labels
- tenant-specific enabled/disabled actions
- theme and density tokens
- form fields
- inspector fields
- validation display blocks
- runtime status panels
- empty states
- table/list/card rendering strategy
- dashboard widgets
- process studio side panels
- process studio toolbar actions
- builder library categories
- modal content composition around low-level widgets

## Process engine mandatory responsibilities

The process engine / task engine / effect governance layer must govern business behavior, including:

- process definitions
- process bindings
- trigger events
- task templates
- task lifecycle
- effect catalog
- effect aliases where needed
- effect applicability
- allowed parameters
- service object applicability
- service object category applicability
- document category/schema/lifecycle
- workflow transitions
- approval rules
- validation gates
- runtime execution
- audit events
- error routing
- integration handoffs

Routes must remain transport/orchestration only. React components must remain rendering/editing tools only.

## Acceptable hardcoded code

Hardcoded implementation is allowed only for low-level primitives that cannot reasonably be metadata-only, such as:

- graph rendering primitive
- drag/drop mechanics
- pan/zoom mechanics
- modal drag mechanics
- low-level visual node component primitive
- low-level edge component primitive
- generic handler implementation code
- generic transaction execution shell
- generic API client utilities
- security middleware
- validation execution code

Even then, what these primitives display or execute should be driven by governed metadata wherever practical.

## Not acceptable

Do not hardcode:

- tenant-specific screen composition
- tenant-specific process flow
- industry-specific task semantics
- document types
- service object categories
- effect catalog as UI-only constants
- process lifecycle rules
- publish authority
- trigger semantics
- workflow transitions
- menu/role/action availability when a descriptor/RBAC path exists
- process builder inspector fields when metadata can drive them
- scheduler/workcenter semantics when process/resource metadata can drive them

## Process Studio implication

For Process Studio specifically:

```text
Main view = Process Network
Micro view = modal Process Builder
Graph canvas = specialized widget
Screen/panels/actions/labels/visibility = UI engine descriptors
Business/process semantics = process engine/governed metadata
```

React Flow / xyflow may be used, but only as a graph widget. It must not become the owner of process semantics or the whole UI surface.

## Scheduler implication

The scheduler may use specialized timeline/drag primitives, but:

- workcenter/resource definitions must come from governed resource/process metadata
- job/task meaning must come from process/task metadata
- UI layout/panels/actions must be descriptor-driven where practical
- visual drag actions must not silently become semantic production changes without backend validation

## Commerce/Admin/CRM implication

Admin, commerce, CRM, gateway, and tenant screens must not become isolated hardcoded React modules. They should be rendered as UI-engine surfaces with specialized widgets only where justified.

## Migration and GitHub main rule

When a wave adds a database migration that the user must run from Railway, the migration is not deliverable until it is present on GitHub `main`.

Codex must not stop at a local commit or a pushed feature branch when the user has asked to run the migration from Railway. Railway follows the GitHub repo, so the release path must make the migration visible from `main` before telling the user it is ready to run.

Required final checks for any migration-bearing wave:

1. Confirm the migration file exists locally.
2. Commit and push the feature branch.
3. Merge or fast-forward the accepted branch into `main` when the user needs Railway to run it.
4. Push `main` to GitHub.
5. Confirm the migration file exists on GitHub `main`.
6. Report clearly whether the migration is only on a branch or already on `main`.

## Mandatory Codex deliverable for every wave

Every Codex implementation wave must end with an **Engine-first drift check**:

```text
Engine-first drift check:
1. Which parts are UI-engine/surface-descriptor driven?
2. Which parts are process-engine/task-engine/effect-governance driven?
3. Which parts remain hardcoded React or hardcoded route logic?
4. Why is each hardcoded part justified as a low-level primitive?
5. What must move to UI descriptors before production?
6. What must move to process/effect/task governance before production?
7. Did this wave increase or reduce future tenant customization risk?
8. Final yes/no: is this wave aligned with EIP engine-first architecture?
```

Do not mark a wave complete if it creates a large hardcoded surface or business workflow that would require future tenant-specific React/code forks.

## Red-flag examples

Red flags that must be corrected or explicitly justified:

```text
A component contains many tenant-specific if/else blocks.
A route owns process lifecycle instead of calling the process engine.
A UI screen hardcodes effect names that should come from an effect catalog.
A builder inspector hardcodes fields per node type instead of reading metadata.
A scheduler directly changes business state without backend validation.
A dashboard is built as a one-off fixed screen when it could be descriptor-driven.
A process map edge creates real process binding without governance validation.
```

## Codex short instruction

Use this short instruction in future prompts:

```text
Build this feature engine-first. Use the UI engine/surface descriptors for screen composition and the process/task/effect engine for business behavior. Specialized React widgets are allowed only for low-level primitives such as graph rendering, drag/drop, timeline rendering, or modal dragging. Do not hardcode tenant-specific UI, process semantics, effect catalog, task lifecycle, document types, service object categories, or publish authority. End with an engine-first drift check.
```
