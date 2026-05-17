# SERIAL_CONTEXT_003

## Title
Process engine / task engine continuity

## Purpose
This file defines the EIP V2 task naming and execution direction so Codex workers do not drift back into task-list explosion.

## Core rule
EIP V2 must avoid exploding task lists made of dozens or hundreds of single-use tasks.

The task system must move toward a compositional model based on:
- object
- effect
- object category or object type

## Naming direction
Task naming must carry business significance while remaining structurally reusable.

Conceptual pattern:
- `object_effect_objectCategory`

Examples:
- `document_create_PurchaseOrder`
- `asset_create_FinishingMachine`
- `document_amend_SalesInvoice`

Important:
- the object and object category/type are parameters
- the effect is the executable macro/action family
- this allows a small reusable set of effects to cover many business cases

## Why this matters
EIP V1 had too many narrow, single-use task names with weak business meaning.
EIP V2 must reduce task explosion by separating:
- business meaning
- object context
- executable effect behavior

## Process structure direction
Target conceptual chain:
- process flow
- task
- effect macro

Meaning:
1. the process flow expresses business flow
2. the task carries business-significant naming
3. the effect macro is what the process engine executes

## Effect macro rule
An effect macro is the executable script/action unit used by the engine to complete a task.

The effect macro should be selected through governed structures such as dropdown tables, task definitions, or controlled metadata, rather than hardcoded one-off task implementations.

## Design consequence
This model should allow:
- free generation of process flows with business-significant task names
- reuse of a limited set of effect macros
- avoidance of task-definition explosion
- more maintainable engine behavior
- better flexibility across industries and tenants

## Implementation guardrails
- Do not reintroduce long lists of single-use task definitions when composition can solve the problem.
- Do not hardcode business-specific tasks directly into the engine if the same outcome can be expressed through object + effect + category.
- Preserve business-significant task naming while keeping execution behavior reusable.
- Prefer governed metadata/dropdowns/configuration over static hardcoded task branching.

## Worker instruction
If a task touches process modeling, task taxonomy, workflow design, or executable engine behavior:
1. read `AGENTS.md`
2. read `AGENT_TASKS.md`
3. read `docs/codex/ARCHITECTURE_GUARDRAILS.md`
4. read this file before making changes