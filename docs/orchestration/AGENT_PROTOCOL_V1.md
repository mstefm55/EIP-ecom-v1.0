# EIP V1 Agent Protocol

This protocol is mandatory for every Codex agent working on EIP V1 or V2 planning in this repository.

## Start Rules

Every agent must:

1. Pull or fetch latest `main`.
2. Read these files before coding:
   - `docs/orchestration/AGENT_REGISTRY_V1.md`
   - `docs/orchestration/AGENT_PROTOCOL_V1.md`
   - `docs/orchestration/ACTIVE_WORKSTREAMS_V1.md`
   - `docs/orchestration/AGENT_HANDOFF_TEMPLATE_V1.md`
   - `docs/sme_operating_model_v1.md`
3. Confirm the assigned agent scope.
4. List files the agent expects to touch before coding.
5. Work on the assigned branch. No agent works directly on `main`.
6. Check for active migration reservations before creating a migration.
7. Stop and report if the working tree is dirty with unrelated changes.

## Branch Rules

- Agent 0 uses `orchestration/agent-registry-v1`.
- Agent 1 uses `agent/debug-integration-v1`.
- Agent 2 uses `agent/commercial-conditions-v1`.
- Agent 3 uses `agent/inventory-v1`.
- Agent 4 uses `agent/crm-v1`.
- Agent 5 uses `agent/procurement-v1`.
- Agent 6 uses `agent/v2-migration-governance`.

Agents may use a temporary branch only if Agent 0 records it in the registry.

## Scope Rules

No agent may:

- Modify another agent's scope without approval.
- Modify another agent's active branch.
- Add fake/demo production data.
- Add final Purchase Order execution unless explicitly assigned.
- Move business policy into React.
- Make routes business-process authorities.
- Modify Product Studio unless assigned.
- Modify V2 from a V1 worker scope.
- Modify V1 production behavior from a V2 worker scope.
- Create duplicate routes or duplicate domain models.
- Create new tables before checking existing kernel/governed structures.
- Add legal, regulatory, or compliance framework into `commercial_condition`; that table is for trade/commercial/contract terms unless existing governed data explicitly says otherwise.
- Add fake task, stock, supplier, customer, quote, condition, or inventory data to make a UI look populated.

## Engine-First Rules

Every agent must preserve the EIP architecture:

- Routes enforce session, CSRF, RBAC, validation, tenant scope, transactions, service calls, process engine calls, and responses.
- Routes do not own business workflow sequence, approval policy, transition validity, or next business step.
- Business process authority belongs to `process_def`, `process_binding`, `task_template`, task/effect governance, and the process engine.
- Commercial/trade policy authority belongs to `commercial_condition`.
- UI surfaces should use descriptors/metadata where practical.
- React components are reusable primitives. They do not become tenant-specific business authority.
- Tenant-specific behavior comes from metadata, schema/config, mapping profiles, connection profiles, process/task templates, dropdowns, and commercial conditions.

## Agent Scope Guardrails

### Agent 1 - Debug / Integration / UI Polish

Allowed:

- Command Center minor polish.
- Tasks module minor polish.
- Broken UI states.
- Broken endpoint wiring.
- Descriptor mismatch repairs.
- Build/test failures.
- Migration application issues.

Forbidden:

- New business modules.
- Product Studio feature work.
- Inventory, Procurement, or CRM feature expansion.
- V2 migration changes.
- Fake/demo data.
- Final Purchase Order execution.

Default task:

- Audit latest live Dashboard/Tasks UI and fix only confirmed defects such as unreadable task rows, unclear selected state, duplicate display references, broken buttons/chips, broken empty states, descriptor mismatch, and build/runtime errors.

Must preserve:

- Dashboard remains the business cockpit.
- Tasks remains detailed scheduling/delegation/workload.
- Product Studio remains untouched unless explicitly assigned.

### Agent 2 - Commercial Conditions

Allowed:

- Audit existing `commercial_condition` usage.
- Centralize condition type/category helpers if duplicated.
- Improve trade-condition display and empty states.
- Improve pricing, supplier/customer terms, MOQ, lead time, payment terms, credit terms, RFQ threshold, validity date, condition expiry, and renewal-task governance where already supported.
- Prepare Product Studio trade-condition modal plans if requested.

Forbidden:

- Product Studio UI implementation unless explicitly assigned.
- Inventory execution.
- Stock movements.
- RFQ execution ownership.
- Purchase Order execution.
- CRM ownership.
- Fake conditions.
- Tenant-specific hardcoding.
- Legal/regulatory/compliance frameworks inside `commercial_condition`.

Closure must state:

- `commercial_condition` remains trade/commercial policy authority.
- Legal/compliance was not mixed into trade conditions.

### Agent 3 - Inventory

Allowed:

- Operational stock.
- Stock signals.
- Stock position.
- Stock movements.
- Reorder recommendation display.
- Policy display from `commercial_condition`.
- Material override separation.
- Procurement bridge.
- Physical/digital behavior.
- Inventory docs/tests.

Forbidden:

- Product Studio changes.
- Supplier quote/RFQ UI duplication.
- Final Purchase Order execution.
- Production planning.
- Fake inventory rows.
- Fake stock locations.
- Fake stock charts.

Closure must state:

- No fake inventory/demo data was added.
- Inventory owns operational stock only.
- Product Studio was untouched.
- Procurement remains buying journey owner.
- `commercial_condition` remains policy authority.

### Agent 4 - CRM

Allowed:

- CRM journey UI.
- CRM workbench readability.
- CRM task/intake integration.
- Production empty states.
- Mailbox/intake/reply-draft connection.

Forbidden:

- Payments ownership.
- Procurement ownership.
- Inventory ownership.
- Fake customer/demo data.
- External AI provider calls unless already configured and governed.
- Ungoverned message sending.

Closure must state:

- CRM remains customer journey owner.
- Actions remain process/task governed.
- No fake CRM data was added.

### Agent 5 - Procurement

Allowed:

- Existing Procurement Workbench polish.
- Real data display.
- Empty states.
- Route thinness if drift appears.
- Procurement tests/docs.

Forbidden:

- Final Purchase Order execution.
- Supplier outbound transmission.
- Invoice matching.
- Accounting ledger.
- Goods receipt finalization beyond existing cash receipt foundation.
- Inventory movement ownership.
- Fake supplier quotes.
- Fake procurement data.

Closure must state:

- No PO execution was added.
- Procurement remains buying journey owner.
- Routes remain transport/orchestration.
- Process engine remains business process authority.

### Agent 6 - V2 Migration / Kernel Governance

Allowed:

- V2 governance.
- Effect/action library.
- Document governance.
- `service_object` canon.
- Migration strategy.
- Hardcoding audit.
- V1-to-V2 migration strategy.
- V2 docs/tests.

Forbidden:

- V1 production modification.
- Speculative full rewrite.
- Unjustified new tables.
- Executable JavaScript stored in DB.
- Broad feature expansion.

Closure must state:

- V2 work did not modify V1 production.
- Effect/document/service-object governance status is clear.
- Remaining migration limitations are documented.

## Shared File Rules

The following files are shared/high-risk and require coordination before editing:

- `apps/dashboard/src/engine/registry.jsx`
- `apps/dashboard/src/engine/surfaces/dashboard.js`
- `services/api/src/server.js`
- `services/api/db/seed/ui_surface_dashboard.sql`
- `services/api/db/migrations/*`
- `services/api/package.json`
- `apps/dashboard/package.json`
- `docs/sme_operating_model_v1.md`

Any agent touching these must include the reason, risk, and validation in the closure report.

## Migration Reservation Protocol

Before creating a migration:

1. Check latest migration number on latest `main`.
2. Reserve the next migration number in `AGENT_REGISTRY_V1.md`.
3. State the migration purpose.
4. Confirm no other agent has reserved the same number.
5. Keep the migration additive.
6. Do not create migrations for fake/demo production data.
7. Mention the migration in the closure report.

If the migration is no longer needed, Agent 0 must clear or mark the reservation as abandoned.

## Merge Discipline

1. Agent finishes work.
2. Agent runs tests/build for its scope.
3. Agent outputs closure report using `AGENT_HANDOFF_TEMPLATE_V1.md`.
4. Orchestrator reviews conflict risk.
5. Orchestrator merges one branch at a time.
6. After merge, registry is updated.
7. Other agents rebase/merge latest `main` before continuing.

No branch is merged if:

- Tests expected for that scope were skipped without explanation.
- Migration reservation conflicts exist.
- Shared files were modified without a coordination note.
- Engine-first drift check fails.
- Production security is weakened.

## Validation Baseline

For docs-only orchestration work:

```bash
git status
git diff --check
```

For feature work, the agent must run the narrowest meaningful tests plus any affected build. Agent 0 may require broader tests before merge.

## Stop Conditions

An agent must stop and report before continuing when:

- The drive/workspace is unstable or unavailable.
- The working tree contains unrelated dirty files.
- A migration number conflict is found.
- A requested change crosses another agent's active ownership.
- A route would need to become business-process authority.
- A React change would encode tenant-specific policy.
- A requested action would destabilize V1 production from V2 planning work.
