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

The product should feel like a practical operating system, not an enterprise planning suite.

## Module Ownership

| Workspace | Owns | Does not own |
| --- | --- | --- |
| CRM | Customers, leads, interactions, cases, opportunities, intake, mailbox, CRM signals | Stock quantities, payment credentials, purchase orders |
| Orders & Payments | Sales orders, payment records, returns, refunds, operational actions | Payment provider secrets, tenant payment preferences, stock planning |
| Inventory | Stock Signals Queue, material stock profile, stock movements, stockout prediction, policy-backed reorder suggestions, stock review tasks, Procurement handoff | Purchase order commitment, supplier outbound transmission, accounting valuation, MRP |
| Procurement | Purchase Need Workbench, supplier options, governed buying-route recommendation, requisition review, RFQ/supplier offer comparison, low-value cash/shop purchase receipt | Full PO execution, supplier integrations, accounting ledger, MRP |
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

## Procurement Position

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
