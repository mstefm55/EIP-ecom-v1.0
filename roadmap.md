# EIP V2 Roadmap Checklist

Status: Draft  
Last updated: 2026-03-24  
Scope: Architecture, backend, frontend, security, quality, and cutover work for EIP V2 while keeping V1 live.

## How to use this file

- This is the execution checklist for V2.
- Do not mark an item done without evidence (PR, test run, migration ID, or report link).
- Keep V1 and V2 partitioned at all times.
- If an item changes scope, update this file before coding.

## Global gates (must stay true throughout)

- [ ] `GATE-001` V1 stays live and operational during all V2 work.
- [ ] `GATE-002` V2 changes are additive first; no destructive schema changes before cutover.
- [ ] `GATE-003` Public and internal API contracts remain stable during migration period.
- [ ] `GATE-004` No direct lifecycle mutation bypassing process engine for workflowed objects.
- [ ] `GATE-005` Shared code remains tenant-agnostic; tenant specifics stay in metadata/config/surfaces.

## Phase 0 - Decision lock and preparation

- [ ] `P0-001` Lock service object canon in architecture docs and team agreement.
Done when: service object is explicitly treated as both kernel concept and operational case instance.

- [ ] `P0-002` Lock business class mapping (agent/entity, asset, material, document, money) to service object execution model.
Done when: model is documented with examples and referenced by process and UI docs.

- [ ] `P0-003` Create missing V2 planning docs listed by intent baseline:
`docs/PROCESS_V2_TABLE_PLAN.md`, `docs/PROCESS_V2_ALGO_SPEC.md`, `docs/PROCESS_V2_CUTOVER_PLAN.md`.
Done when: all three docs exist and are approved.

- [ ] `P0-004` Define V1/V2 boundary document with module-by-module ownership.
Done when: each module is labeled keep/adapt/rewrite with owner and timeline.

- [ ] `P0-005` Define security acceptance criteria for V2 go-live (target score threshold and mandatory controls).
Done when: criteria are measurable and mapped to tests/checks.

- [ ] `P0-006` Align contributor guidance files to remove ambiguity:
`AGENTS.md`, `AGENT_TASKS.md`, codex context files, developer manual references.
Done when: no contradictory architecture instructions remain.

- [ ] `P0-007` Fix worker ownership map drift (`services/ui/**` mismatch) in planning docs.
Done when: worker scopes map to real repository paths.

## Phase 1 - V1/V2 partition and coexistence framework

- [ ] `P1-001` Implement runtime switch contract for process engine implementation (`legacy|v2`) with safe default.
Done when: boot config supports both implementations and can toggle without code edits.

- [ ] `P1-002` Introduce adapter layer so route contracts are shared while implementation switches under the hood.
Done when: same route handlers can call legacy or V2 engine path by flag.

- [ ] `P1-003` Define strict naming and folder convention for V2 modules to avoid accidental V1 edits.
Done when: all new V2 files follow a consistent namespace pattern.

- [ ] `P1-004` Add compatibility test harness that runs contract checks against legacy and V2.
Done when: both implementations are validated for request/response parity.

- [ ] `P1-005` Add rollback drill procedure using env switch and documented runbook.
Done when: rollback is tested and time-to-restore is recorded.

## Phase 2 - Process engine V2 core

- [ ] `P2-001` Freeze core reusable effects and remove implicit effect proliferation.
Done when: effect inventory matches approved V2 baseline.

- [ ] `P2-002` Add macro/composite execution layer over primitive effects.
Done when: one business action can execute deterministic ordered effect bundles.

- [ ] `P2-003` Enforce transition algorithm contract:
validate -> authorize -> idempotency -> execute effects -> atomic persist -> trace.
Done when: execution path follows this order in code and tests.

- [ ] `P2-004` Add typed error taxonomy for process engine failures.
Done when: validation/permission/policy/execution/integration errors are distinct and mapped.

- [ ] `P2-005` Enforce idempotency key requirement for all transition writes.
Done when: non-idempotent transition writes are rejected by default.

- [ ] `P2-006` Ensure task templates and on-enter behavior remain deterministic across retries.
Done when: replay cannot duplicate unintended side effects.

- [ ] `P2-007` Add capability tag model for process defs, transitions, effects, and macros.
Done when: include/exclude tag filtering can be used during clone/provisioning.

- [ ] `P2-008` Add clone manifest output for capability-filtered provisioning.
Done when: clone output includes included/excluded artifacts with reasons.

## Phase 3 - Remove architecture drift in lifecycle flows

- [ ] `P3-001` Replace direct `service_object.status` mutations in ecom workflowed paths with process transitions.
Done when: lifecycle state changes only via process engine for process-bound objects.

- [ ] `P3-002` Audit all routes for direct status changes that should be process-driven.
Done when: bypass list is empty or explicitly approved exceptions are documented.

- [ ] `P3-003` Add static guard script to fail CI when forbidden direct lifecycle updates are introduced.
Done when: CI blocks merge on forbidden patterns.

- [ ] `P3-004` Normalize product flow model:
material as product master, service object as active workflow case.
Done when: code and docs consistently reflect this model.

- [ ] `P3-005` Ensure process bindings are mandatory where policy says required.
Done when: required-binding flows fail safely if binding is missing.

## Phase 4 - UI engine and rendering alignment

- [ ] `P4-001` Make DB surface payloads authoritative for configurable module UI behavior.
Done when: hardcoded panel logic is reduced to engine primitives and controlled exceptions.

- [ ] `P4-002` Define controlled exceptions list (admin/auth only where approved).
Done when: exception list is explicit and audited.

- [ ] `P4-003` Add surface schema validation for `tree` and governed props before publish.
Done when: invalid surfaces cannot be published.

- [ ] `P4-004` Harden component registry governance (allowed components, versions, compatibility).
Done when: unknown/unsafe component types are blocked.

- [ ] `P4-005` Add UI engine tests for binding resolution, fallback behavior, and rendering safety.
Done when: major rendering contracts are covered by automated tests.

- [ ] `P4-006` Remove unsafe HTML rendering patterns in frontend code paths.
Done when: no untrusted `dangerouslySetInnerHTML` or unsafe `innerHTML` sinks remain.

## Phase 5 - Multi-tenant isolation and authorization hardening

- [ ] `P5-001` Enforce target-tenant authorization on every route using `:tenantId`.
Done when: route checks verify caller can act on the target tenant, not only session tenant permissions.

- [ ] `P5-002` Introduce shared helper for tenant-target guard to avoid per-route inconsistency.
Done when: all tenant-target routes use the same guard.

- [ ] `P5-003` Update permission resolver logic to enforce active roles consistently.
Done when: role activity status is considered uniformly in authz checks.

- [ ] `P5-004` Review and harden admin/portfolio access boundaries.
Done when: cross-tenant admin access paths are policy-consistent and tested.

- [ ] `P5-005` Decide and document DB-level tenant isolation strategy (app-layer only vs selective RLS).
Done when: decision is explicit with rationale and implementation plan.

## Phase 6 - Security remediation backlog

### Critical

- [ ] `SEC-001` Remove/replace unsafe HTML rendering in Samara product/content display flows.
Done when: rendering uses sanitization or safe text rendering only.

- [ ] `SEC-002` Remove unsafe `innerHTML` interpolation in dashboard embed error rendering.
Done when: error rendering is escaped/safe by default.

- [ ] `SEC-003` Stop returning unsanitized tenant attrs in public gateway responses.
Done when: public payloads expose only allowlisted non-sensitive fields.

- [ ] `SEC-004` Add explicit secret redaction policy for tenant connection profiles in all response paths.
Done when: secrets/tokens/keys/password-like fields cannot leak via API responses.

### High

- [ ] `SEC-005` Fix password history reuse control to compare plaintext candidate against prior hashes correctly.
Done when: policy actually blocks reuse of last N passwords.

- [ ] `SEC-006` Replace `Math.random` password generation with cryptographically secure RNG.
Done when: all security-sensitive random values use crypto-safe generators.

- [ ] `SEC-007` Harden upload validation beyond MIME/extension checks (content sniffing and policy limits).
Done when: upload pipeline validates type and blocks malformed payloads.

- [ ] `SEC-008` Resolve privacy logging column mismatch and confirm audit events persist correctly.
Done when: GDPR export access logging writes to correct schema fields.

- [ ] `SEC-009` Remove tenant-specific hardcoded user-facing text in shared backend flows.
Done when: shared flows are tenant-neutral and metadata-driven.

### Medium and operational

- [ ] `SEC-010` Review non-production debug response behavior and ensure strict production gating.
Done when: sensitive debug payloads are impossible in production mode.

- [ ] `SEC-011` Upgrade vulnerable dependencies and lock versions via policy.
Done when: high/moderate npm audit findings are addressed or formally risk-accepted.

- [ ] `SEC-012` Add security-focused static checks to CI (XSS sink checks, secret exposure patterns, forbidden query patterns).
Done when: CI blocks known high-risk patterns.

## Phase 7 - Data model and JSONB governance

- [ ] `P7-001` Define governed key policy for critical JSONB attrs (allowed keys, type semantics, ownership).
Done when: governance rules exist and are enforced.

- [ ] `P7-002` Ensure field headers used for validation/build are resolved from dropdown/governed metadata.
Done when: runtime flow does not rely on uncontrolled free-text headers for governed structures.

- [ ] `P7-003` Audit JSONB usage for core governed data that should be relational.
Done when: mis-modeled core data is identified and migration plan is documented.

- [ ] `P7-004` Add schema validation for process graph payloads, surface trees, and key config JSON structures.
Done when: malformed critical JSONB payloads are rejected at write time.

- [ ] `P7-005` Add migration hygiene checks (idempotent, rerunnable, rollback-aware).
Done when: migration template and CI validation enforce standards.

## Phase 8 - Gateway and integration model hardening

- [ ] `P8-001` Separate internal admin gateway config APIs from public intake/bootstrap contracts.
Done when: trust boundaries and response data contracts are explicit.

- [ ] `P8-002` Add strict outbound request allowlist/policy profiles for engine-triggered HTTP effects.
Done when: effect-driven HTTP calls cannot target arbitrary hosts beyond policy.

- [ ] `P8-003` Add deterministic retry and compensation policy for integration effects.
Done when: retriable vs non-retriable behavior is explicit and tested.

- [ ] `P8-004` Standardize gateway audit payload redaction and retention policy.
Done when: sensitive inbound payload data is redacted consistently.

- [ ] `P8-005` Add integration contract tests for inbound verification modes and idempotency replay.
Done when: api_key, hmac, oauth2_jwt, and unverified policies are covered by tests.

## Phase 9 - Quality engineering and CI/CD

- [ ] `QA-001` Establish test pyramid baseline:
unit tests for core engine, integration tests for routes, contract tests for APIs.
Done when: minimal coverage thresholds are defined and enforced.

- [ ] `QA-002` Add parity suite for V1 vs V2 behavior on critical flows.
Done when: parity report is generated on every CI run for selected scenarios.

- [ ] `QA-003` Expand CI beyond process alignment:
lint, type checks (if adopted), tests, security checks, migration checks.
Done when: CI is a reliable release gate.

- [ ] `QA-004` Add smoke suites for core journeys:
auth, product lifecycle, order/payment, return/refund, gateway intake.
Done when: smoke tests run in pre-release and canary.

- [ ] `QA-005` Add regression fixtures for process graphs and task/effect combinations.
Done when: graph/effect regressions are detected before merge.

## Phase 10 - Observability, auditability, and operations

- [ ] `OPS-001` Add structured correlation IDs across API, process transitions, effect execution, and integrations.
Done when: one request/transition can be traced end-to-end.

- [ ] `OPS-002` Define dashboards for process throughput, error taxonomy, effect latency, and retry outcomes.
Done when: operational KPIs are visible for legacy and V2.

- [ ] `OPS-003` Add alerting for critical control failures:
authz denials anomaly, idempotency conflicts, integration failure spikes.
Done when: alert thresholds and runbooks exist.

- [ ] `OPS-004` Harden audit record standards for security-sensitive operations.
Done when: admin actions and tenant-boundary operations are audit-complete.

- [ ] `OPS-005` Define incident response checklist specific to V1/V2 dual operation period.
Done when: on-call runbook includes decision tree and rollback commands.

## Phase 11 - Cutover readiness and launch

- [ ] `CUT-001` Complete canary plan with tenant cohort selection and success metrics.
Done when: canary gates are objective and measurable.

- [ ] `CUT-002` Execute shadow runs comparing V1 and V2 outcomes for selected flows.
Done when: mismatch rate is within approved threshold.

- [ ] `CUT-003` Validate rollback drill from V2 to legacy in production-like environment.
Done when: rollback is proven and timed.

- [ ] `CUT-004` Run final security checklist and dependency baseline before go-live.
Done when: unresolved critical security items are zero.

- [ ] `CUT-005` Sign-off checklist:
architecture, security, QA, operations, product owners.
Done when: all required signatories approve.

## Phase 12 - Post-cutover stabilization

- [ ] `POST-001` Monitor first release window with elevated telemetry and response SLAs.
Done when: stabilization window closes without unresolved Sev-1/Sev-2 issues.

- [ ] `POST-002` Remove temporary migration shims once parity and stability criteria are met.
Done when: deprecation list is completed and validated.

- [ ] `POST-003` Archive V1-only paths according to retention and rollback policy.
Done when: V1 archive state is documented and reproducible.

- [ ] `POST-004` Publish final architecture baseline for ongoing feature delivery on V2.
Done when: new default development path is V2-only guidance.

## Open issues and uncertainties to resolve early

- [ ] `UNK-001` Confirm exact tenant isolation threat model and whether selective RLS is required.
- [ ] `UNK-002` Confirm which current direct status mutations are intentional exceptions vs unintended drift.
- [ ] `UNK-003` Confirm final object-family mapping for policy profiles across all modules.
- [ ] `UNK-004` Confirm acceptable parity tolerance between V1 and V2 for non-critical side effects.
- [ ] `UNK-005` Confirm target security score threshold and sign-off authority.

## Completion definition

- [ ] `DONE-001` All critical and high security checklist items complete.
- [ ] `DONE-002` All global gates satisfied.
- [ ] `DONE-003` V1/V2 parity and rollback criteria met.
- [ ] `DONE-004` Documentation, runbooks, and CI gates updated and enforced.
- [ ] `DONE-005` Formal go-live approval recorded.
