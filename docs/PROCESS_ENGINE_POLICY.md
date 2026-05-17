# Process Engine First (Ecom Policy)

Date: 2026-02-16

## Decision
All operational changes must go through the process engine. This is mandatory for flexibility and for automated tasks to execute reliably.

## Scope
- Product lifecycle actions (review, approve, publish, reject, cancel).
- Order and payment workflows.
- Any workflow step that triggers automation, tasks, or status transitions.

## Rationale
Bypassing the process engine prevents automated tasks and state transitions from running, which breaks the core workflow model and causes deployment regressions.

## Implementation Rules
- UI must send action requests to the API that trigger process engine transitions.
- Direct DB updates for workflow/state changes are not allowed.
- API endpoints must call the process engine for any transition that should create tasks or side effects.

## UI Engine Policy (Related)
- New module UIs must be fully UI-engine driven (surface JSON as source of truth; no hardcoded panels). Exception: Admin Console and Authentication/Authorization modules.
- Layout copy, labels, and placeholders live in `props.layout` within surface JSON.

## Notes
- Material data can be saved as drafts, but publish/transition actions must be process-driven.
- Keep process definitions, API contracts, and UI actions aligned to avoid deployment glitches.
