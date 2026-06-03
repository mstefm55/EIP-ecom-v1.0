# Procurement Foundation V1

Status: implemented foundation
Date: 2026-06-04

## Purpose

Procurement V1 closes the gap between approved inventory reorder need and supplier-facing preparation:

```text
approved reorder suggestion
-> procurement policy resolution
-> supplier candidates
-> purchase requisition
-> RFQ / quote comparison when required
-> cash/shop purchase receipt for low-value purchases
```

It intentionally does not implement full purchase order execution, accounting, heavy MRP, supplier integrations, contract lifecycle management, production planning, or EDI transmission.

## Kernel Model

No procurement-specific persistence table was added.

| Capability | Kernel storage |
| --- | --- |
| Reorder, supplier, trade, purchasing, payment, freight, and cash-purchase policy | `eip_core.commercial_condition` |
| Material stock state and item override | `eip_core.material.attrs.inventory` |
| Material to supplier relationship/accreditation | `eip_core.object_link` with `relation_type='MATERIAL_SUPPLIER'` |
| Supplier/company/person record | `eip_core.agent` |
| Purchase requisition | `eip_core.service_object` with `object_type='PURCHASE_REQUISITION'` |
| RFQ | `eip_core.service_object` with `object_type='PURCHASE_RFQ'` |
| Cash purchase receipt | `eip_core.service_object` with `object_type='CASH_PURCHASE'` plus `info_record` evidence |
| Supplier quote and quote comparison evidence | `eip_core.info_record` |
| Workflow tasks | `eip_core.task` through `task_template` |
| Tenant enablement | `eip_core.tenant_module_setting` module `procurement`, code `operations` |

## Policy Ownership

Procurement policy is governed through `commercial_condition`, not hardcoded route logic and not buried as supplier-only attrs.

Condition types/categories seeded by `0111_procurement_foundation.sql`:

```text
PROCUREMENT_POLICY / PURCHASING
MATERIAL_SUPPLIER_CONDITION / PURCHASING
PAYMENT_TERM_CONDITION / FINANCE
FREIGHT_COST_CONDITION / LOGISTICS
CASH_PURCHASE_CONDITION / PURCHASING
```

Existing inventory condition families remain part of the resolver:

```text
INVENTORY_REORDER_POLICY / INVENTORY
SUPPLY_REORDER_CONDITION / SUPPLY
SUPPLIER_PURCHASE_CONDITION / PURCHASING
```

Runtime resolution:

```text
tenant commercial_condition defaults
-> scoped material/supplier/category commercial_condition rows
-> material inventory state and approved item override
-> material-supplier object_link metadata
-> procurement recommendation
-> process-engine parameters
```

## Supplier Links

Material-to-supplier links are stored as `object_link` rows:

```text
src_kind='material'
dst_kind='agent'
relation_type='MATERIAL_SUPPLIER'
```

Relationship attrs include:

```text
supplier_role
accreditation_status
is_accredited
priority
supplier_material_code
minimum_order_qty
order_multiple
lead_time_days
last_price
currency
payment_terms_code
payment_due_days
freight_cost_estimate
credit_available
cash_on_delivery
quality_rating
otif_score
supplier_risk_level
```

## Procurement Model Selection

The selector returns a decision card-ready recommendation:

```text
procurement_model
selection_reason
next_process
minimum_quote_count
approval_required
recommended_supplier_agent_id
candidate_suppliers
estimated_unit_cost
estimated_total_cost
estimated_freight_cost
estimated_landed_cost
cash_required
currency
payment_terms_code
risk_flags
policy_condition_codes
```

Supported procurement models:

```text
direct_purchase
formal_purchase_order
purchase_requisition_then_po
request_for_quote
multi_supplier_quote_comparison
cash_shop_purchase
marketplace_purchase
blanket_order_call_off
contract_supplier_purchase
emergency_purchase
manual_receipt_only
```

## Process And Task Governance

Migration `0111_procurement_foundation.sql` seeds:

```text
PURCHASE_REQUISITION_FLOW_V1
PURCHASE_RFQ_FLOW_V1
SUPPLIER_QUOTE_REVIEW_FLOW_V1
PURCHASE_ORDER_DRAFT_FLOW_V1
CASH_PURCHASE_FLOW_V1
```

Task templates:

```text
PURCHASE_REQUISITION_REVIEW
RFQ_PREPARE
SUPPLIER_QUOTE_INTAKE
SUPPLIER_QUOTE_REVIEW
PURCHASE_ORDER_PREPARE
CASH_PURCHASE_REVIEW
```

The API creates service objects and starts the configured process binding. Approve/ignore/quote-approve actions advance the process engine. Full purchase order execution is seeded as a draft flow only and remains intentionally deferred.

## Routes

Authenticated procurement routes:

```text
GET    /api/eip/procurement/overview

GET    /api/eip/procurement/supplier-links
POST   /api/eip/procurement/supplier-links
PATCH  /api/eip/procurement/supplier-links/:id

GET    /api/eip/procurement/requisitions
GET    /api/eip/procurement/requisitions/:id
POST   /api/eip/procurement/requisitions/from-reorder
POST   /api/eip/procurement/requisitions/:id/approve
POST   /api/eip/procurement/requisitions/:id/ignore

GET    /api/eip/procurement/rfqs
GET    /api/eip/procurement/rfqs/:id
POST   /api/eip/procurement/rfqs/from-requisition
POST   /api/eip/procurement/rfqs/:id/quotes
POST   /api/eip/procurement/rfqs/:id/compare
POST   /api/eip/procurement/rfqs/:id/approve-quote

POST   /api/eip/procurement/cash-purchases
```

Reads require EIP session, tenant scope, and RBAC. Writes additionally require CSRF.

## Permissions

```text
PROCUREMENT_READ
PROCUREMENT_WRITE
PROCUREMENT_REQUISITION_READ
PROCUREMENT_REQUISITION_WRITE
PROCUREMENT_REQUISITION_APPROVE
PROCUREMENT_RFQ_READ
PROCUREMENT_RFQ_WRITE
PROCUREMENT_QUOTE_REVIEW
PROCUREMENT_CASH_PURCHASE
SUPPLIER_LINK_READ
SUPPLIER_LINK_WRITE
```

Permissions are granted additively through role templates and existing tenant roles for:

```text
ADMIN_SUPER
ACCESS_UNIVERSAL
ECOM_ADMIN
ECOM_USER
ACCESS_ECOM_FULL
ACCESS_READ_ONLY
```

## Dashboard UI

Procurement is a generic dashboard module:

```text
Dashboard -> Procurement
```

Sections:

```text
Overview
Purchase Needs
Suppliers
Requisitions
RFQs
Cash Purchase
```

The menu item and workspace are descriptor registered and module-gated by active `procurement` tenant settings. The React component is a reusable renderer for descriptor-provided endpoints, tabs, labels, and actions.

## Boundaries

This wave deliberately avoids:

```text
full purchase order execution
supplier email/API/EDI transmission
accounting ledger
advanced MRP/MPS/IBP/S&OP
warehouse/bin planning
contract lifecycle management
supplier portal
```

## Local Verification

```bash
cd services/api
npm run migrate
node --test test/procurement_foundation.test.mjs
npm test
npm run test:security

cd ../../apps/dashboard
npm run build
```

## Railway Test Sequence

1. Redeploy API.
2. In Railway API shell:

   ```bash
   cd services/api
   npm run migrate
   ```

3. Redeploy dashboard.
4. Ensure the tenant has Inventory and Procurement modules enabled.
5. Open Dashboard -> Procurement.
6. Create or verify material-supplier links.
7. Approve a reorder suggestion in Dashboard -> Inventory.
8. In Dashboard -> Procurement -> Purchase Needs, create a requisition.
9. Approve the requisition.
10. Create an RFQ, add quotes, compare quotes, and approve the selected quote.
11. Record a low-value cash/shop purchase and verify stock receipt movement is written.

## Known Limitations

```text
No final purchase order execution.
No supplier outbound transmission.
No invoice matching or accounting ledger.
No supplier search picker yet; initial UI accepts IDs for material and supplier selection.
Cash purchase records a receipt and stock movement but does not create a finance ledger entry.
```

## Next Recommended Wave

Purchase Order Execution Foundation:

```text
approved requisition or selected quote
-> PO draft
-> supplier transmission adapter
-> receipt confirmation
-> invoice/evidence link
-> governed receiving and accounting handoff
```
