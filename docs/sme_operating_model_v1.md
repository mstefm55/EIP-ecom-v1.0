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
| Inventory | Material stock profile, stock movements, stockout prediction, decision cards, reorder suggestions, stock review tasks | Purchase order commitment, accounting valuation, MRP |
| Procurement | Supplier policy links, purchase requisitions, RFQs, supplier quote comparison, low-value cash/shop purchase receipt | Full PO execution, supplier integrations, accounting ledger, MRP |
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
-> approved purchase preparation later
```

Inventory is recommendation-led rather than table-led:

```text
stock profile
-> decision card
-> reorder suggestion
-> purchase requisition bridge
-> human approval before commitment
```

Machine actions may detect stockout risk, calculate suggested quantity, warn about cash impact, flag supplier risk, and prepare purchase-requisition metadata. Human approval remains required for purchase commitment, supplier changes, high-value reorders, risky supplier decisions, and cash-impacting actions.

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
-> material-supplier object_link candidates
-> commercial_condition procurement policy
-> purchase requisition
-> RFQ / quote review where needed
-> cash/shop purchase receipt for low-value buys
```

Supplier accreditation and supplier-material terms are relationship metadata on `object_link`; the business rules for how those relationships are selected live in `commercial_condition`.

It deliberately avoids:

```text
final purchase order execution
supplier outbound integration
invoice matching
accounting ledger
heavy MRP
```

## Next Operating Wave

Purchase Order Execution Foundation should build on approved requisitions and selected quotes:

```text
approved reorder suggestion
-> purchase requisition / selected quote
-> purchase order draft
-> supplier transmission adapter
-> receiving
-> purchase_receipt inventory movement
```
