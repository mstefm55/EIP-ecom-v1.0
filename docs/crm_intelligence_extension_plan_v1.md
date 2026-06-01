# CRM Intelligence Extension Plan V1

Status: planning baseline
Date: 2026-06-01
Scope: EIP Core V1 CRM continuation only

Implementation note: the controlled foundation described in Section 10 is implemented by migration `0101_crm_intelligence_foundation.sql`, route module `services/api/src/routes/crm_intelligence.js`, and the reusable CRM dashboard workspace. See `docs/crm_intelligence_foundation_v1.md` for the operational contract and deferred adapter scope.

## Purpose

This document records the current CRM state after the completion wave and defines the smallest safe continuation toward a more intelligence-aware CRM module. It is a gap analysis and implementation plan, not a request to replace the existing operational CRM.

The required architecture remains:

```text
Kernel primitives
-> governed dropdowns, schemas, process definitions, task templates, and effects
-> UI surface descriptors
-> reusable React primitives
```

No new persistence table is required for the proposed next wave. The existing EIP kernel can model segments, campaigns, and governed signals without introducing CRM-specific duplicate storage.

## 1. Current CRM State After Completion Wave

### 1.1 Existing kernel-backed operational coverage

The current CRM is a real reusable module, not a standalone hardcoded application.

| Capability | Current implementation | Kernel primitive |
| --- | --- | --- |
| Customers, prospects, companies, and contacts | Agent create, list, detail, and update routes | `eip_core.agent` |
| Contact details | Contact, address, and bank-account routes | `eip_core.entity_contact`, `eip_core.entity_address`, `eip_core.entity_bank_account` |
| Leads | Create, list, detail, update, status, task, and convert routes | `eip_core.service_object` with `CRM_LEAD` |
| Interactions | Create, list, detail, update, and task routes | `eip_core.service_object` with `CRM_INTERACTION` |
| Cases | Create, list, detail, update, status, and task routes | `eip_core.service_object` with `CRM_CASE` |
| Opportunities | Create, list, detail, update, status, and task routes | `eip_core.service_object` with `CRM_OPPORTUNITY` |
| Follow-ups and operational work | Task create, list, and status routes | `eip_core.task` |
| Notes and timeline | Generic note append and timeline reads | `eip_core.info_record`, `eip_core.object_link`, status-event tables |
| Relationships | Parties and graph links | `eip_core.service_object_party`, `eip_core.object_link` |
| KPIs | Legacy summary and comprehensive overview routes | Tenant-scoped aggregate queries over kernel tables |

Primary route implementation:

```text
services/api/src/routes/crm.js
services/api/src/routes/crm_completion.js
```

### 1.2 Process and task governance already present

Migration `services/api/db/migrations/0099_crm_module_completion.sql` adds governed CRM process definitions and bindings:

```text
CRM_INTERACTION_FLOW_V1
CRM_CASE_FLOW_V1
CRM_OPPORTUNITY_FLOW_V1
CRM_LEAD_FLOW_V1
```

The current lead conversion flow is already engine-first:

```text
qualified lead
-> governed conversion action
-> status change
-> CRM_OPPORTUNITY child object creation
-> party link creation
-> follow-up task creation
-> timeline info record write
-> process instance start
```

This is the pattern to continue for campaign and segment workflows.

### 1.3 Existing dropdown governance

The completion migration seeds governed values for:

```text
CRM_LEAD_STATUS
CRM_CASE_STATUS
CRM_OPPORTUNITY_STATUS
CRM_PRIORITY
CRM_INTERACTION_CHANNEL
CRM_INTERACTION_DIRECTION
CRM_TASK_TYPE
CRM_SOURCE
CRM_REASON_LOST
```

These lists should remain the source of truth. New segment, campaign, and signal vocabularies should extend the same dropdown model.

### 1.4 Existing permissions

Current CRM permissions cover operational access:

```text
CRM_AGENT_READ
CRM_AGENT_WRITE
CRM_LEAD_READ
CRM_LEAD_WRITE
CRM_LEAD_CONVERT
CRM_INTERACTION_READ
CRM_INTERACTION_WRITE
CRM_CASE_READ
CRM_CASE_WRITE
CRM_OPPORTUNITY_READ
CRM_OPPORTUNITY_WRITE
CRM_TASK_READ
CRM_TASK_WRITE
CRM_DASHBOARD_READ
CRM_TIMELINE_READ
CRM_NOTE_WRITE
CRM_PROCESS_DEF_READ
CRM_PROCESS_DEF_WRITE
```

Existing bundles remain additive and reusable across `ADMIN_SUPER`, universal access, CRM admin, CRM user, CRM full access, and read-only access roles.

### 1.5 Existing UI surface coverage

The dashboard CRM workspace is registered through the generic dashboard surface descriptor:

```text
services/api/db/seed/ui_surface_dashboard.sql
services/api/db/migrations/0099_crm_module_completion.sql
services/api/db/migrations/0100_crm_dashboard_descriptor_repair.sql
apps/dashboard/src/engine/surfaces/dashboard.js
apps/dashboard/src/components/crm/CrmWorkspace.jsx
```

The current reusable CRM workspace exposes:

```text
Overview
Leads
Customers / agents
Opportunities
Cases
Interactions
Tasks
```

The React workspace is generic and tenant-agnostic. It uses descriptor-supplied tabs, labels, endpoint configuration, permission checks, KPI labels, actions, and governed option lists. It still contains fallback constants for resilience; those are reviewed in Section 7.

### 1.6 Existing segment starting point

The current model already permits segment-like agents because `eip_core.agent` is the governed party primitive. A segment note route also exists:

```text
POST /api/eip/crm/segments/:id/notes
```

It validates an agent with `agent_type = SEGMENT`, writes a `CRM_SEGMENT_NOTE` info record, and links it through `eip_core.object_link`.

The missing work is not a new segment table. The missing work is a complete governed segment lifecycle, UI, signal intake model, links, KPIs, and controlled promotion flows.

## 2. Salesforce Baseline Coverage

The current module is a credible operational baseline. The following table separates implemented capability from the most useful next refinement.

| Area | Coverage | Current strength | Remaining gap |
| --- | --- | --- | --- |
| Accounts and contacts | Implemented | Agent master records and entity contact details | Better company/contact relationship UX, selectors, and linked timeline |
| Leads | Implemented | Governed lifecycle, tasks, notes, and conversion | More lead-source analysis and optional campaign attribution |
| Opportunities | Implemented | Governed lifecycle, values, probability, owner, next action | Pipeline board, grouped forecast slices, time filters |
| Cases | Implemented | Create, update, assign, transition, task, and timeline | Optional SLA and escalation policy |
| Activities | Implemented | Shared task queue and task status events | Calendar-oriented views and bulk queue operations |
| Interaction history | Implemented | Interaction objects, notes, and generic timeline | Richer unified account activity timeline |
| Assignment and ownership | Implemented | Owner fields and tenant-scoped routes | Human-friendly owner picker instead of typed identifiers |
| KPIs | Implemented | Lead, opportunity, case, task, note, and activity aggregates | Configurable KPI slices by owner, source, segment, and period |
| Campaigns | Missing | Lead source dropdown exists | Governed campaign object, links, status process, UI |
| Segments | Partial | Segment agent representation and segment notes exist | Segment workspace, lifecycle, links, signal summaries |
| Signals | Missing as a CRM capability | Kernel info records and gateway intake patterns exist | Governed signal taxonomy, redacted intake, controlled promotion |
| Forecasting | Partial | Weighted pipeline aggregate exists | Forecast cases and review workflow are optional later additions |

### Baseline conclusion

The operational CRM should be preserved. The next work should add intelligence-aware classification and orchestration around the current objects, not rebuild account, lead, opportunity, task, or timeline behavior.

## 3. Segment / Market CRM Gap Analysis

### 3.1 Required segment model

Segments and market groups should remain agent records:

```text
eip_core.agent
agent_type = SEGMENT | MARKET_GROUP
attrs = governed optional segment metadata
```

Suggested governed attributes:

```json
{
  "segment_type": "market | cohort | account_group | product_interest | geography",
  "status": "draft | active | paused | archived",
  "description": "",
  "owner_agent_id": "",
  "priority": "",
  "source": "",
  "criteria_summary": "",
  "effective_from": "",
  "effective_to": ""
}
```

### 3.2 Current gap table

| Segment capability | Current state | Recommended closure |
| --- | --- | --- |
| Segment record | Partial | Continue using `agent` with governed type and attrs |
| Segment create, edit, archive | Missing dedicated workflow | Add thin tenant-scoped routes over `agent` |
| Segment list and detail UI | Missing | Add descriptor-gated CRM workspace tabs |
| Segment notes | Implemented starting point | Keep `CRM_SEGMENT_NOTE` info records |
| Segment membership | Missing governed UX | Use `object_link` relation types, not duplicate join tables |
| Segment signals | Missing | Append redacted `CRM_SIGNAL` info records and link to segment |
| Segment KPI summary | Missing | Add tenant-scoped aggregates over links and info records |
| Segment follow-up work | Missing | Use shared `task` with segment link |
| Segment-to-lead promotion | Missing | Add explicit governed action, never automatic route-side mutation |
| Segment product/content interest | Missing | Use graph links to generic governed object references |

### 3.3 Signal intake boundary

Signal intake must remain separated from CRM mutation:

```text
external request
-> gateway verification and normalization
-> append-only, redacted signal intake record
-> governed CRM consumer or operator review
-> optional process action to create or link a lead, interaction, task, or campaign
```

The gateway remains border control. It must not silently create leads or modify opportunities.

## 4. Optional Strategic CRM / IBP / S&OP Gap Analysis

This layer is useful but must remain optional and hidden by default until the operational CRM and segment/campaign foundation are stable.

| Strategic concept | Kernel-first representation | Immediate action |
| --- | --- | --- |
| Strategic account plan | `service_object` with type `CRM_STRATEGIC_ACCOUNT_PLAN` | Defer |
| Market segment plan | `service_object` with type `CRM_MARKET_SEGMENT_PLAN` | Defer |
| Campaign forecast | `service_object` with type `CRM_CAMPAIGN_FORECAST` | Defer |
| Demand signal | `info_record` with type `CRM_DEMAND_SIGNAL`; promote only when workflow is required | Define vocabulary only if needed by the next wave |
| Revenue forecast case | `service_object` with type `CRM_REVENUE_FORECAST_CASE` | Defer |
| IBP review | `service_object` with type `CRM_IBP_REVIEW` | Defer |
| S&OP action | Shared `task` by default; use a service object only for multi-party lifecycle governance | Defer |
| Risk or upside | `info_record` for observation; service object only for governed lifecycle | Defer |
| Decision log | `info_record` linked to the governed review object | Defer |

### Strategic boundary

Do not build demand planning, supply planning, capacity simulation, advanced forecast algorithms, marketing automation, identity stitching, or a broad event warehouse in the next wave.

## 5. Kernel Modeling Proposal

### 5.1 Proposed object map

| Business concept | Kernel storage | Object or record type | Links | New table required |
| --- | --- | --- | --- | --- |
| Segment | `eip_core.agent` | `agent_type = SEGMENT` | `object_link` | No |
| Market group | `eip_core.agent` | `agent_type = MARKET_GROUP` | `object_link` | No |
| Campaign, hook, or initiative | `eip_core.service_object` | `CRM_CAMPAIGN` | `service_object_party`, `object_link` | No |
| Raw CRM signal | `eip_core.info_record` | `CRM_SIGNAL` | `object_link` | No |
| Demand signal | `eip_core.info_record` | `CRM_DEMAND_SIGNAL` | `object_link` | No |
| Qualified actionable signal | Existing operational object created by governed action | `CRM_LEAD`, `CRM_INTERACTION`, or linked task | Existing links | No |
| Anonymous cohort | Segment agent plus aggregate signal records | Governed segment attrs | Pseudonymous references only where required | No |
| Segment note | `eip_core.info_record` | `CRM_SEGMENT_NOTE` | Existing note link | No |
| Campaign note | `eip_core.info_record` | `CRM_CAMPAIGN_NOTE` | Existing note link | No |

### 5.2 Recommended relation vocabulary

Use governed `object_link.relation_type` values such as:

```text
SEGMENT_MEMBER
SEGMENT_INTEREST
SIGNAL_FOR_SEGMENT
SIGNAL_FOR_AGENT
SIGNAL_FOR_CAMPAIGN
CAMPAIGN_TARGETS_SEGMENT
CAMPAIGN_SOURCE_FOR_LEAD
CAMPAIGN_RELATED_OBJECT
```

The exact vocabulary should be seeded through governance and documented before route implementation. Do not scatter relation strings across React components.

### 5.3 Recommended dropdown additions

The next wave should seed:

```text
CRM_SEGMENT_TYPE
CRM_SEGMENT_STATUS
CRM_CAMPAIGN_TYPE
CRM_CAMPAIGN_STATUS
CRM_SIGNAL_TYPE
CRM_SIGNAL_SOURCE
CRM_SIGNAL_STATUS
CRM_HOOK_TYPE
```

Keep values intentionally small at first. Tenant-specific language and permitted values can later use schema overrides and tenant UI descriptors.

### 5.4 Schema governance

Use the existing schema registry structures:

```text
eip_core.schema_registry
eip_core.schema_bundle
eip_core.schema_override
eip_core.dropdown_list
eip_core.dropdown_value
```

These should govern:

```text
field labels
required fields
optional attrs
validation rules
visible fields
renderer hints
tenant wording overrides
allowed dropdown values
```

## 6. UI / UX Gap Analysis

### 6.1 Current reusable UI primitives

The existing `CrmWorkspace` already provides reusable low-level primitives:

```text
KPI cards
tab navigation
search and filter controls
list and table rendering
status pills
detail panel
timeline panel
task list
modal forms
loading, empty, and error states
```

These should be extended rather than replaced.

### 6.2 Operational UX gaps

| UX area | Current state | Recommended refinement |
| --- | --- | --- |
| Account relationships | Functional but identifier-heavy | Add tenant-scoped search selectors and linked-record summaries |
| Owner assignment | Functional but identifier-heavy | Add reusable agent picker |
| Opportunity pipeline | List view | Add optional descriptor-driven stage board |
| Timeline | Object-level timeline exists | Add unified account timeline over linked objects |
| Forecasting | KPI aggregate only | Add optional filters by owner, source, segment, and date range |
| Segments | No dedicated UI | Add segment list, detail, signals, members, and notes |
| Campaigns | No dedicated UI | Add campaign list, detail, status, segment links, notes, and tasks |
| Signals | No operator UI | Add read-only signal review and explicit promotion actions |

### 6.3 UI posture for the next wave

The next UI addition should be lean:

```text
CRM
-> Segments
-> Campaigns
-> Signals
```

Each tab should reuse the existing workspace primitives and be enabled by descriptor metadata and module capability flags. Do not build a separate CRM application shell.

## 7. UI Engine / Descriptor Requirements

### 7.1 What is already descriptor-driven

Current descriptor integration already governs:

```text
workspace registration
module visibility
tab labels and ordering
endpoint metadata
permission metadata
KPI labels and formats
common actions
surface availability for enabled tenants
```

### 7.2 What remains hardcoded React

The current React workspace retains fallback configuration:

```text
FALLBACK_TABS
FALLBACK_KPIS
STATUS_LISTS
WRITE_PERMISSIONS
CREATE_FORMS
ICONS
status-color mapping
some endpoint branching
fixed currency formatting assumptions
```

These fallbacks are acceptable as low-level resilience behavior, but they must not become the commercial customization source of truth.

### 7.3 Required descriptor expansion

Before broad tenant rollout, move these into descriptor or schema metadata where practical:

```text
segment, campaign, and signal tabs
field definitions
requiredness
dropdown references
visible columns
filter presets
allowed actions
relation types
status color tokens
currency formatting source
empty-state text
KPI definitions and grouping
board stage configuration
```

React should remain responsible for rendering primitives and interactions, not tenant-specific vocabulary.

## 8. Process Engine Requirements

### 8.1 Keep existing governed behavior

Continue using shared process and task primitives:

```text
eip_core.process_def
eip_core.process_binding
eip_core.process_instance
eip_core.task_template
eip_core.task
eip_core.service_object_status_event
eip_core.task_status_event
```

### 8.2 Add campaign workflow

The smallest new process definition should be:

```text
CRM_CAMPAIGN_FLOW_V1
```

Suggested statuses:

```text
draft
review
approved
active
paused
completed
cancelled
```

Suggested governed actions:

```text
submit_for_review
approve
activate
pause
complete
cancel
```

Campaign state changes must use a bound process instance and status events. Routes should remain transport orchestration only.

### 8.3 Segment lifecycle

Keep segment creation and master-data edits as tenant-scoped low-level agent writes. If segment status begins to control publication, campaign targeting, or downstream actions, bind it to a governed review flow:

```text
CRM_SEGMENT_REVIEW_FLOW_V1
```

Do not introduce that process until the business rule requires approval.

### 8.4 Signal promotion

Signal intake is append-only. Promotion must be explicit:

```text
signal review
-> governed action
-> link existing CRM object or create CRM_LEAD / CRM_INTERACTION / task
-> timeline info record
```

No gateway request should bypass this separation.

## 9. Module Gating Proposal

### 9.1 Preserve compatibility

Keep the existing root CRM module:

```text
crm
```

Use additive capability flags or settings under the same module governance model:

```text
crm.basic
crm.segments
crm.campaigns
crm.signals
crm.strategic_accounts
crm.ibp_bridge
crm.sop_review
```

### 9.2 Default packaging

| Capability | Default state | Reason |
| --- | --- | --- |
| `crm.basic` | Enabled with CRM module | Existing operational baseline |
| `crm.segments` | Optional | Useful first intelligence extension |
| `crm.campaigns` | Optional | Useful with segments and lead attribution |
| `crm.signals` | Optional | Requires controlled intake and review |
| `crm.strategic_accounts` | Disabled | Later operational expansion |
| `crm.ibp_bridge` | Disabled | Later cross-functional workflow |
| `crm.sop_review` | Disabled | Later review workflow |

Descriptor conditions should hide disabled workspaces. Routes must enforce capability checks independently; UI visibility alone is never authorization.

## 10. Next Smallest Implementation Wave

### Recommended wave: CRM Segment and Campaign Intelligence Foundation

This is the smallest meaningful extension because it adds a reusable intelligence layer without introducing a large event platform or strategic planning suite.

### 10.1 Backend scope

Add thin, tenant-scoped routes:

```text
GET    /api/eip/crm/segments
POST   /api/eip/crm/segments
GET    /api/eip/crm/segments/:id
PATCH  /api/eip/crm/segments/:id
GET    /api/eip/crm/segments/:id/signals
POST   /api/eip/crm/segments/:id/notes

GET    /api/eip/crm/campaigns
POST   /api/eip/crm/campaigns
GET    /api/eip/crm/campaigns/:id
PATCH  /api/eip/crm/campaigns/:id
POST   /api/eip/crm/campaigns/:id/status
POST   /api/eip/crm/campaigns/:id/tasks

POST   /api/eip/crm/signals/intake
GET    /api/eip/crm/signals
POST   /api/eip/crm/signals/:id/promote
```

The signal intake route must be protected and normalized. Public gateway integration should append through controlled internal orchestration, not expose a public CRM mutation route.

### 10.2 Governance scope

Add:

```text
governed dropdown values
CRM_CAMPAIGN_FLOW_V1
campaign process binding
campaign follow-up task templates
relation-type vocabulary
CRM segment, campaign, and signal permissions
role-bundle additions
schema bundles for segment and campaign attrs
descriptor tabs and field metadata
```

### 10.3 UI scope

Extend the existing CRM workspace with:

```text
Segments tab
Campaigns tab
Signals tab
segment detail with members, signals, notes, and linked work
campaign detail with segments, tasks, notes, and governed status actions
signal review list with explicit promote action
```

### 10.4 Test scope

Add focused tests for:

```text
tenant isolation
permission enforcement
CSRF enforcement for writes
module capability gating
dropdown validation
campaign process transition enforcement
segment note reuse
signal redaction
signal append-only behavior
explicit signal promotion
no gateway-side implicit lead creation
descriptor registration
dashboard production build
```

### 10.5 Explicit exclusions

Do not include:

```text
new CRM-specific tables
bulk marketing automation
email synchronization
identity stitching
ad tracking
broad analytics warehouse
advanced forecast algorithms
demand or supply planning engine
```

## 11. Risks / Anti-patterns to Avoid

| Risk | Avoidance rule |
| --- | --- |
| Rebuilding CRM in new tables | Continue using `agent`, `service_object`, `task`, `info_record`, and `object_link` |
| Gateway mutating CRM state | Keep gateway as verified intake only; use governed promotion actions |
| React becoming business authority | Move tenant language, fields, options, and actions into descriptors and schema governance |
| Hardcoded status strings spreading | Seed dropdowns and process actions centrally |
| Segment membership table drift | Use governed links unless a proven integrity constraint requires more |
| Raw browser identity storage | Keep aggregate or pseudonymous references only where justified |
| Signals becoming noisy event storage | Store only governed, useful CRM signals with retention guidance |
| Automatic lead creation from weak signals | Require explicit promotion policy or operator action |
| Strategic scope crowding operational work | Keep optional capability flags disabled until requested |
| Cross-tenant leakage | Enforce tenant scope in every route and test negative paths |

## 12. Recommended Acceptance Criteria

The next wave is complete only when:

```text
No new CRM-specific persistence tables are introduced.
Segments are modeled as governed agent records.
Campaigns are modeled as CRM_CAMPAIGN service objects.
Signals are stored as redacted append-only CRM_SIGNAL info records.
Signal promotion is explicit and governed.
Campaign transitions use process bindings and status events.
Segment, campaign, and signal UI tabs are descriptor-gated.
Feature visibility is controlled by module capability settings.
Routes enforce session, CSRF for writes, RBAC, and tenant scope.
Tenant isolation negative tests pass.
Gateway intake cannot implicitly create a lead or opportunity.
Dropdown and schema governance are the source of truth.
Existing CRM operational behavior remains intact.
Dashboard production build passes.
```

## 13. Engine-first Drift Check

### 1. Which parts are UI-engine/surface-descriptor driven?

The CRM workspace registration, module visibility, tabs, labels, endpoint metadata, permissions, common actions, and KPI presentation are descriptor-driven. The next wave should add segment, campaign, and signal descriptors through the same dashboard surface mechanism.

### 2. Which parts are process-engine/task-engine/effect-governance driven?

Lead, case, interaction, and opportunity lifecycles already use shared process primitives. Lead conversion uses governed status, child-object, link, task, info-record, and process-start effects. Campaign transitions and signal promotion should follow the same model.

### 3. Which parts remain hardcoded React or route logic?

React still contains fallback tabs, KPI definitions, form fields, status lists, icons, status colors, endpoint branching, and formatting defaults. Routes still contain low-level validation, tenant-scoped SQL orchestration, master-data writes, and append-only note handling.

### 4. Why is each hardcoded part justified as a low-level primitive?

Fallback UI constants keep the workspace usable when descriptor data is unavailable. Route validation and low-level persistence orchestration protect kernel integrity. Master-data updates and append-only notes do not require a heavyweight process instance unless a tenant policy adds one.

### 5. What must move to UI descriptors before production rollout?

Move commercial customization data into descriptors and schema bundles: fields, requiredness, labels, tabs, columns, filters, allowed actions, relation labels, KPI grouping, board stages, status tokens, and currency source.

### 6. What must move to process/effect/task governance before production rollout?

Govern campaign transitions, campaign follow-up templates, any segment review approval, and signal promotion actions. Keep gateway intake append-only and separated from business mutation.

### 7. Did this plan increase or reduce future tenant customization risk?

It reduces risk by extending the existing kernel and descriptor model instead of introducing tenant-specific tables, route forks, or React branches.

### 8. Final yes/no: is this plan aligned with EIP engine-first architecture?

Yes.

## Source Files Audited

```text
docs/codex/EIP_ENGINE_FIRST_MANDATORY_RULE.md
CONSTITUTION.md
services/api/docs/CRM_PROCESS_V1.md
services/api/docs/CORE_PROCESS_V1.md
services/api/src/routes/crm.js
services/api/src/routes/crm_completion.js
services/api/src/routes/ui_surface.js
services/api/db/migrations/0039_crm_process_v1.sql
services/api/db/migrations/0040_authz_crm_permissions.sql
services/api/db/migrations/0043_authz_crm_role_bundles.sql
services/api/db/migrations/0099_crm_module_completion.sql
services/api/db/migrations/0100_crm_dashboard_descriptor_repair.sql
services/api/db/migrations/0005_governance_registry_dropdown_bundle.sql
services/api/db/migrations/0019_object_link.sql
services/api/db/seed/ui_surface_dashboard.sql
apps/dashboard/src/engine/surfaces/dashboard.js
apps/dashboard/src/components/crm/CrmWorkspace.jsx
docs/crm_module_v1.md
docs/crm_ui_surfaces_v1.md
```
