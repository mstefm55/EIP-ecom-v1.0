# SME Operating Model V1

Status: baseline
Date: 2026-06-03

## V1 Promise

EIP Core V1 is aimed at SME owners and small teams:

```text
customer messages
-> leads and follow-ups
-> orders and payments
-> stock and reorder needs
-> daily governed tasks
```

The product should feel like a practical operating system, not an enterprise planning suite. The dashboard is organized around:

```text
Command Center -> Workload/Scheduling -> Module Workbench -> Timeline/Tasks
```

## Command Center

Command Center is the cockpit:

- business statistics on top
- Burning Topics for urgent pinned categories
- Task Browser for all user actionables
- Workload tab for due dates, delegation, and scheduling
- Analytics tab for lightweight signal graphs

The Task Browser opens governed module workspaces for business actions. It does not own approvals, replies, purchasing, or stock policy.

## Module Ownership

| Workspace | Owns | Does not own |
| --- | --- | --- |
| CRM | Customers, leads, interactions, cases, opportunities, intake, mailbox, CRM signals | Stock quantities, payment credentials, purchase orders |
| Orders & Payments | Sales orders, payment records, returns, refunds, operational actions | Payment provider secrets, tenant payment preferences, stock planning |
| Inventory | Stock Signals Queue, material stock profile, stock movements, stockout prediction, policy-backed reorder suggestions, stock review tasks, Procurement handoff | Purchase order commitment, supplier outbound transmission, accounting valuation, MRP |
| Procurement | Purchase Need Workbench, supplier options, governed buying-route recommendation, requisition review, RFQ/supplier offer comparison, low-value cash/shop purchase receipt | Full PO execution, supplier integrations, accounting ledger, MRP |
| Product Studio | Product setup, product card data, product/media/category attrs, pricing visibility, trade-condition visibility, initial inventory setup before activation | Operational inventory movements, warehouse execution, purchase commitment, supplier outbound transmission |
| Settings | Tenant-local business preferences and readiness panels | Provider secrets, raw credentials, operational queues |
| Admin Console -> Connections | Technical connector setup, provider credentials, keys, webhook secrets, rotation, health checks | Operational payment/refund/order work |

## Inventory/Reorder Position

The Inventory & Reorder Foundation adds the lightweight stock layer needed before purchase orders:

```text
commercial_condition reorder/supply policy
-> material.attrs.inventory state, item overrides, and output snapshot
-> INVENTORY_STOCK_MOVEMENT info_record
-> days-of-cover and stockout recommendation
-> INVENTORY_REORDER_SUGGESTION service_object
-> governed review task
-> Procurement Purchase Need Workbench handoff
```

Inventory is recommendation-led rather than table-led:

```text
stock signal
-> material risk context
-> effective commercial_condition policy
-> reorder recommendation
-> Action Rail
-> Procurement Purchase Need Workbench handoff
```

Machine actions may detect stockout risk, calculate suggested quantity, warn about cash impact, flag supplier risk, and prepare purchase-need metadata. Human approval remains required for purchase commitment, supplier changes, high-value reorders, risky supplier decisions, and cash-impacting actions. Inventory does not own supplier selection, RFQ/direct/cash route decisions, purchase order execution, or supplier outbound transmission; those belong to Procurement and later governed purchase execution waves.

Reorder, supplier, trade, purchasing, payment, freight, and low-value cash purchase policy belongs in governed `eip_core.commercial_condition` rows. Material attrs keep current stock quantities, item-specific overrides, and calculated recommendation snapshots so tenant policy can be cloned, governed, and changed without turning product stock records into the policy authority.

This deliberately avoids:

```text
MRP
IBP
S&OP
finite capacity scheduling
warehouse/bin complexity
accounting ledger
purchase order creation
supplier outbound transmission
```

## Process Boundaries

Modules prepare intent and context. Durable business state changes should use:

```text
process_def
process_instance
process_binding
task_template
task
effect governance
info_record evidence
```

Low-level route logic may normalize and validate payloads, but workflow transitions remain process-governed where configured.

## Procurement | Purchase Need Workbench

The Procurement Foundation continues the inventory approval path:

```text
approved reorder suggestion
-> purchase need workbench
-> material-supplier object_link candidates
-> commercial_condition procurement policy
-> supplier options and buying-route recommendation
-> purchase requisition
-> RFQ / supplier offer review where needed
-> cash/shop purchase receipt for low-value buys
```

Procurement should be journey-first: purchase need -> supplier options -> procurement route -> RFQ/quote review, direct purchase, or cash/shop purchase recommendation -> approval/task action -> timeline.

The workbench belongs under `Dashboard -> Procurement` and presents RFQ as one phase of the buying journey, not as a disconnected table. Supplier options are contextual to the selected material or purchase need.

Supplier accreditation and supplier-material terms are relationship metadata on `object_link`; the business rules for how those relationships are selected live in `commercial_condition`.

The owner UX is decision-first: EIP shows what needs buying, why, supplier options, expected cost/cash impact, the recommended procurement route, and the next governed action in one selected purchase need context.

It deliberately avoids:

```text
final purchase order execution
supplier outbound integration
invoice matching
accounting ledger
heavy MRP
```

## Scheduling

Scheduling is internal EIP task scheduling, not Google Calendar integration. It uses:

- `eip_core.task.due_at`
- `eip_core.task.started_at`
- `eip_core.task.attrs` for planned end, reminder, priority, and scheduling audit metadata
- `eip_core.task_status_event` for scheduling events

Writes are session, CSRF, RBAC, and tenant scoped.

## Product Studio

Product Studio follows the same tabbed surface idea without becoming another Command Center:

- `Studio`: existing product editor
- `Focus`: product master-data issues
- `Analytics`: product readiness metrics from existing data
- `Workload`: product review and condition work signals

Product Studio owns product setup, product card data, categorization, media, pricing entries, trade-condition visibility, and initial inventory setup before activation.

Inventory owns operational stock movements and audit. Physical products can surface initial inventory setup before activation; digital products should not show physical inventory setup or stock-operation fields.

## Theme

The default theme remains `eip_v1`. The dormant `light_glass_ready` map is a future theme-token path only; it is not active in production.

## Next Operating Wave

Purchase Order Execution Foundation should be designed later as its own governed wave. The current V1 foundation preserves future readiness from approved requisitions and selected quotes, but it does not enable final PO execution, supplier outbound transmission, invoice matching, or payment execution.

```text
approved reorder suggestion
-> purchase requisition / selected quote
-> dedicated PO process and UI design
-> supplier communication requirements
-> receiving requirements
-> invoice/evidence requirements
```

## Drift Check

- UI descriptors own tabs, labels, focus rules, task filters, and theme tokens where practical.
- React primitives render reusable shells, cards, modals, drawers, task rows, and calendar-like scheduling controls.
- Process/task engine remains the authority for operational transitions.
- Commercial policy belongs in governed metadata such as `commercial_condition`, not React.
