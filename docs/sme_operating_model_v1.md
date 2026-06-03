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
| Inventory | Material stock profile, stock movements, low-stock alerts, reorder suggestions, stock review tasks | Purchase order commitment, accounting valuation, MRP |
| Settings | Tenant-local business preferences and readiness panels | Provider secrets, raw credentials, operational queues |
| Admin Console -> Connections | Technical connector setup, provider credentials, keys, webhook secrets, rotation, health checks | Operational payment/refund/order work |

## Inventory/Reorder Position

The Inventory & Reorder Foundation adds the lightweight stock layer needed before purchase orders:

```text
material.attrs.inventory
-> INVENTORY_STOCK_MOVEMENT info_record
-> INVENTORY_REORDER_SUGGESTION service_object
-> governed review task
-> approved purchase preparation later
```

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

## Next Operating Wave

Purchase Order Foundation should build on approved reorder suggestions:

```text
approved reorder suggestion
-> purchase request / order process
-> supplier check
-> receiving
-> purchase_receipt inventory movement
```
