# Multi-Agent Research And Design Gate V1

Status: checkpoint completed before implementation
Date: 2026-06-07
Branch: `agent/multi-agent-orchestration-v1`

## Missing Preflight Docs

The current `main` branch does not contain:

```text
docs/orchestration/AGENT_REGISTRY_V1.md
docs/orchestration/AGENT_PROTOCOL_V1.md
docs/orchestration/ACTIVE_WORKSTREAMS_V1.md
docs/orchestration/AGENT_HANDOFF_TEMPLATE_V1.md
docs/commercial_conditions_v1.md
```

Available doctrine/module docs were read and used instead:

```text
docs/sme_operating_model_v1.md
docs/command_center_surface_v1.md
docs/tasks_surface_v1.md
docs/inventory_reorder_foundation_v1.md
docs/procurement_foundation_v1.md
docs/crm_module_v1.md
docs/crm_intelligence_foundation_v1.md
docs/crm_intake_foundation_v1.md
```

## Market References Used For Structure

This checkpoint uses public market references only for structure, terminology, and completeness, not for copying vendor UI:

- Odoo reordering rules: minimum/maximum quantities, routes, replenishment, and RFQ creation.
  <https://www.odoo.com/documentation/master/applications/inventory_and_mrp/inventory/warehouses_storage/replenishment/reordering_rules.html>
- Oracle NetSuite inventory management: reorder point, preferred stock level, lead time, and safety stock concepts.
  <https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1504284487.html>
- SAP Business One purchasing process: purchase request, quotation, purchase order, goods receipt, and AP invoice sequence.
  <https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bf959a184d9c6727/450a572b37ca1f2ce10000000a1553f6.html>
- Microsoft Dynamics 365 RFQ overview: RFQ creation, vendor replies, bid acceptance, and requisition links.
  <https://learn.microsoft.com/en-us/dynamics365/supply-chain/procurement/request-quotations>
- Salesforce Sales Cloud guide: leads, accounts, contacts, opportunities, activities, routing, and approvals.
  <https://www.salesforce.com/sales/cloud/guide/>
- HubSpot timeline events: activity timeline model for contacts, companies, deals, and tickets.
  <https://developers.hubspot.com/docs/methods/timeline/timeline-overview>
- Zoho CRM deal structure: deal owner, amount, closing date, stage, activities, history, contacts, products, notes.
  <https://help.zoho.com/portal/kb/articles/create-deals>
- Asana calendar/workload concepts: calendar due-date planning and workload/capacity visibility.
  <https://help.asana.com/s/article/planning-with-asana-calendar>

## EIP Adaptation Rule

Every touched surface must follow:

```text
business signal
-> context
-> policy used
-> recommendation
-> governed action
-> task/process timeline
```

Visible UI items must be backed by real backend data, descriptor/config metadata, or a production empty state. React must not become the business policy authority.

## Inventory

### A. Market-Standard Structure

Successful inventory systems expose stock position, movements, reservations/allocations, locations, lots/serials, reorder points, safety stock, ABC class, inventory value, and replenishment suggestions. Odoo and NetSuite both separate item setup from replenishment logic and use min/max or reorder-point style controls.

### B. EIP-Adapted Structure

Inventory is operational stock only:

```text
Stock Signals
Stock Position
Movements
Locations / States where real data exists
Counts / Adjustments where governed
Policy View
Procurement Bridge
```

Product Studio owns product/material setup. `commercial_condition` owns reorder/supply/purchasing policy. Procurement owns supplier options, RFQ, and buying route.

### C. V1 Scope

Use current kernel data:

```text
eip_core.material
material.attrs.inventory
eip_core.commercial_condition
INVENTORY_REORDER_SUGGESTION service_object
INVENTORY_STOCK_MOVEMENT info_record
object_link procurement bridge
task/process state
```

### D. Deferred V2 Scope

Warehouse management, bin execution, serial/lot operations, MRP, IBP, S&OP, production planning, valuation ledger, supplier outbound, and final PO execution.

### E. UX Layout Recommendation

Use a bounded category queue and selected signal workbench. Add separate views for Stock Position, Movements, Locations / States, Counts / Adjustments, and Policy View. Unsupported views must show useful production empty states.

### F. Real Data / Backend Source

Current inventory routes and services already expose materials, overview, movements, reorder suggestions, and signal workbench composition.

### G. Process-Engine Involvement

Approve/ignore reorder suggestions must continue through `process_instance` and process engine transitions.

### H. UI-Engine Descriptor Involvement

Inventory views, labels, endpoints, and action labels should remain registered in dashboard surface descriptors and UI seed metadata.

### I. Risk Of Messy Rendering

High if the UI tries to show warehouse/locations/counts without real data. Mitigation: render empty states and disable unsupported actions.

### J. Implementation Plan

Carry forward the inventory production surface hardening already validated on the dedicated Inventory branch: view-based workspace, real category counts, bounded lists, digital/rejected item handling, no Product Studio edits, no migration.

## Commercial Conditions

### A. Market-Standard Structure

ERP trade-condition systems normally cover prices, discounts, payment terms, credit terms, MOQ, order multiples, lead time, freight/landed cost assumptions, supplier/customer terms, validity dates, and contract references.

### B. EIP-Adapted Structure

`commercial_condition` remains the trade/commercial policy authority. It should not become a legal/regulatory/compliance dumping ground.

### C. V1 Scope

Clarify documentation and verify existing routes/helpers preserve:

```text
commercial_condition table = policy authority
service helpers = resolvers/calculators
routes = transport/orchestration
React = display and safe editing primitives
```

### D. Deferred V2 Scope

Legal compliance framework, document governance, regulatory controls, advanced contract lifecycle, and calculation engines that require new governed process models.

### E. UX Layout Recommendation

Plain-language condition creation/editing. Structured effect values remain calculation-ready. Summary text is explanatory only.

### F. Real Data / Backend Source

Existing `eip_core.commercial_condition`, structured field catalog, and ECOM commercial condition routes.

### G. Process-Engine Involvement

Processes consume resolved policy outputs; condition creation itself remains governed metadata editing unless a later approval process is configured.

### H. UI-Engine Descriptor Involvement

Condition field catalogs and allowed condition types should be metadata-backed.

### I. Risk Of Messy Rendering

Medium if developer-facing field names leak into user UI. Mitigation: docs and tests should preserve structured values while requiring plain-language labels.

### J. Implementation Plan

Do not broaden Product Studio trade-condition editing in this wave. Add or update a commercial conditions doc if needed to make boundaries explicit.

## CRM

### A. Market-Standard Structure

CRM systems commonly separate inbox/intake, leads, contacts/accounts, opportunities/deals, cases/tickets, activities, notes, timeline, and follow-up tasks. Salesforce, Zoho, and HubSpot all make activity/timeline central.

### B. EIP-Adapted Structure

CRM journey:

```text
message/intake
-> extracted proposal
-> approve/ignore/convert
-> lead/case/opportunity/customer
-> reply/task
-> timeline
```

### C. V1 Scope

Audit only. Current docs show CRM already uses `agent`, `service_object`, `task`, `info_record`, `object_link`, and process definitions without CRM-specific tables.

### D. Deferred V2 Scope

Advanced forecasting, marketing automation, external AI extraction, autonomous replies, multi-channel provider sync, and heavy sales analytics.

### E. UX Layout Recommendation

Keep intake/mailbox/reply and timeline connected. Avoid disconnected table-only tabs where possible, but do not rewrite unless live issues are found.

### F. Real Data / Backend Source

`eip_core.agent`, `service_object`, `info_record`, `task`, `object_link`, mailbox/intake records.

### G. Process-Engine Involvement

Intake review, conversion, campaign flows, mailbox reply approval, and lead conversion remain process/task governed.

### H. UI-Engine Descriptor Involvement

CRM tabs and capabilities are descriptor/capability gated in the reusable `CrmWorkspace`.

### I. Risk Of Messy Rendering

Medium if all CRM object tabs are shown without journey context. Mitigation: only minor polish or document no change if current surface is acceptable.

### J. Implementation Plan

Audit CRM after Inventory and Commercial Conditions. Fix only narrow production alignment issues; otherwise document no change.

## Procurement

### A. Market-Standard Structure

Procurement systems typically move from purchase request/requisition to RFQ, supplier replies, bid comparison, selected offer, purchase order, goods receipt, and invoice. SAP Business One and Dynamics 365 make requisition and RFQ explicit phases.

### B. EIP-Adapted Structure

Procurement journey:

```text
purchase need
-> supplier options
-> procurement route
-> requisition/RFQ/cash/direct path
-> quote comparison
-> governed approval
-> future PO boundary
```

### C. V1 Scope

Protect the boundary and polish only narrow issues. Purchase Need Workbench remains the center.

### D. Deferred V2 Scope

Final PO lifecycle, supplier transmission, EDI/API/email outbound, receiving automation, invoice matching, accounting ledger, MRP.

### E. UX Layout Recommendation

One selected purchase need should show supplier options, route recommendation, RFQ/quote state, policy used, and next governed action.

### F. Real Data / Backend Source

`service_object` purchase requisitions/RFQs/cash purchases, `object_link` supplier links, `agent` suppliers, `info_record` quotes, `commercial_condition` procurement policy, process/task state.

### G. Process-Engine Involvement

Approval, ignore, RFQ, quote review, and cash purchase review remain process-governed.

### H. UI-Engine Descriptor Involvement

Procurement workspace is descriptor registered and module gated.

### I. Risk Of Messy Rendering

High if PO wording/action implies execution exists. Mitigation: keep PO execution disabled/future only.

### J. Implementation Plan

Audit and only fix clear boundary/wording/display issues. Do not implement final PO.

## Dashboard / Tasks

### A. Market-Standard Structure

Task systems separate inbox/list, calendar, delegation, workload, due dates, filters, and capacity views. Asana uses calendar for due-date planning and workload for capacity visibility.

### B. EIP-Adapted Structure

Dashboard is the cockpit. Tasks is the detailed scheduling/delegation/workload module.

### C. V1 Scope

Only debug/integration fixes caused by this branch. Do not duplicate full task lists in Dashboard.

### D. Deferred V2 Scope

External Google/Outlook sync, resource capacity planning, automated workload balancing, cross-system task sync.

### E. UX Layout Recommendation

Dashboard Task Browser stays compact and opens governed module workspaces. Tasks sidebar module owns calendar/workload.

### F. Real Data / Backend Source

`GET /api/eip/user/dashboard/command-center`, `eip_core.task`, `task_status_event`, UI surface descriptors.

### G. Process-Engine Involvement

Business-specific task actions remain in modules. Scheduling/delegation are kernel task operations.

### H. UI-Engine Descriptor Involvement

Task views, labels, endpoint, default view, theme/density are descriptor controlled.

### I. Risk Of Messy Rendering

High if dashboard and task module duplicate each other. Mitigation: only integration fixes, no new full scheduler in Dashboard.

### J. Implementation Plan

No feature changes unless build/test/audit reveals branch-caused issues.

## V2 Migration Planning

### A. Market-Standard Structure

Large ERP migrations usually separate master-data canon, process catalog, permission catalog, document governance, integration contracts, and cutover sequencing.

### B. EIP-Adapted Structure

Plan only. V2 must map V1 kernel primitives, processes, effects, commercial conditions, service objects, documents, and UI descriptors without destabilizing V1.

### C. V1 Scope

Create or update a planning doc only.

### D. Deferred V2 Scope

Any V2 production code, migrations, or repository changes outside docs.

### E. UX Layout Recommendation

Not applicable for this wave.

### F. Real Data / Backend Source

V1 metadata and route/schema inventory only.

### G. Process-Engine Involvement

Document migration risks around process/effect/task governance.

### H. UI-Engine Descriptor Involvement

Document migration risks around reusable surface descriptors.

### I. Risk Of Messy Rendering

Low if planning remains documentation-only.

### J. Implementation Plan

Add `docs/v2_migration_parallel_agent_plan.md` if it is not already present.
