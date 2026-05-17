# Ecom Process-Engine Strategy

Date: 2026-02-16
Owner: EIP Core

## Goal
Ensure fast, safe deployments by keeping database schema, process engine, process definitions, and UI strictly aligned. All workflow transitions must run through the process engine so automated tasks and side effects always fire.

## Non-Negotiables
- All operational transitions (review, approve, publish, reject, cancel, refund, return, etc.) are executed by the process engine.
- UI only requests actions; it does not directly mutate workflow/state.
- Direct DB writes are permitted only for draft data entry (no transitions, no side effects).
- New module UIs must be fully UI-engine driven (surface JSON as source of truth; no hardcoded panels). Exception: Admin Console and Authentication/Authorization modules.

## Source of Truth
- Product data: eip_core.material (draft and live states tracked in attrs.workflow.stage).
- Order/payment cases: eip_core.service_object (process-driven instances).

## Contracts First
Before building UI or APIs:
- Define action names and their effects (data fields changed, tasks created, events emitted).
- Define API contracts: request/response payloads, error codes, and idempotency behavior.
- Define process definition nodes/transitions with the exact action strings used by UI.

## Process-Driven Update Model
- UI sends an action request (e.g., APPROVE, PUBLISH).
- API triggers process engine transition.
- Process engine applies effects to data (material/service_object) and creates tasks/events.
- UI refreshes state from the authoritative data source.

## Alignment Checklist (Pre-Execution)
1) Process definitions include all UI actions.
2) API endpoints exist for each action and validate idempotency.
3) DB schema contains all fields required by effects.
4) UI only calls action endpoints (no direct transition writes).
5) Error codes are standardized and mapped to UI messages.

## Deployment Safety
- Add a pre-deploy validation script to check:
  - Process definition actions vs UI action buttons.
  - API endpoints exist for required actions.
  - DB columns/attrs referenced by effects exist.
- Run smoke tests:
  - Product: Create -> Review -> Approve -> Publish
  - Order: Intake -> Confirm -> Fulfill

## Ownership and Change Control
- Any change to workflow requires updates to:
  - Process definition
  - API contract
  - UI actions
- No single layer changes alone.

## Notes
- Publish means live data is pushed to the ecom website through a process effect (queue/job/webhook).
- Draft saves are allowed to write directly to material; publish/review/reject/cancel must be process-driven.
