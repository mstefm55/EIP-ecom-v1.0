# Inventory & Reorder Foundation V1

Status: implemented foundation
Date: 2026-06-03

## Purpose

Inventory V1 gives SME tenants a lightweight operating view for stock, predicted stockout risk, low-stock alerts, and human-reviewed purchase needs:

```text
material stock profile
-> stock movement evidence
-> stockout/reorder recommendation
-> reorder suggestion service_object
-> review task / approval workflow
```

It does not implement purchase orders, accounting ledger, MRP, warehouse management, production planning, IBP, or S&OP.
It does establish the policy and recommendation foundation needed for those methods to be activated progressively.

## Kernel Model

No new persistence table was added.

| Capability | Kernel storage |
| --- | --- |
| Material/product stock profile | `eip_core.material.attrs.inventory` |
| Physical lot/batch support | Existing `eip_core.material_lot` and status events |
| Stock movement/audit evidence | `eip_core.info_record` with `record_type='INVENTORY_STOCK_MOVEMENT'` |
| Reorder suggestion | `eip_core.service_object` with `object_type='INVENTORY_REORDER_SUGGESTION'` |
| Stock review work | `eip_core.service_object` with `object_type='INVENTORY_STOCK_REVIEW'` |
| Reorder/stock review tasks | `eip_core.task` |
| Material to reorder lineage | `eip_core.object_link` with `relation_type='REORDER_FOR'` |
| Tenant enablement | `eip_core.tenant_module_setting` module `inventory`, code `operations` |

## Stock Profile

Flexible policy and current stock are stored under `material.attrs.inventory`:

```json
{
  "track_stock": true,
  "track_inventory": true,
  "stock_on_hand": 12,
  "on_hand": 12,
  "reserved_qty": 2,
  "available_qty": 10,
  "reorder_point": 5,
  "reorder_qty": 20,
  "minimum_stock": 3,
  "maximum_stock": 50,
  "safety_stock": 5,
  "unit_of_measure": "pcs",
  "preferred_supplier_agent_id": null,
  "fallback_supplier_agent_ids": [],
  "lead_time_days": 7,
  "safety_lead_time_days": 2,
  "daily_consumption_rate": 0.75,
  "minimum_order_qty": 10,
  "order_multiple": 5,
  "unit_cost": 12,
  "average_cost": 12,
  "freight_cost_estimate": 15,
  "approval_required": true,
  "approval_threshold_value": 200,
  "target_service_level": 0.95,
  "supplier_risk_level": "medium",
  "abc_classification": "A",
  "stock_status": "in_stock",
  "risk_status": "healthy"
}
```

`track_inventory`, `on_hand`, and `available_qty` remain compatible with the current Product Studio and public commerce catalog behavior.

## Professional Policy Fields

The policy envelope supports professional supply-chain methods without forcing a heavy planning screen on the owner:

```text
ABC classification: abc_classification
Stock policy: track_stock, stock_on_hand, reserved_qty, available_qty, reorder_point, reorder_qty,
  minimum_stock, maximum_stock, safety_stock, safety_lead_time_days, lead_time_days, unit_of_measure,
  preferred_supplier_agent_id, fallback_supplier_agent_ids, review_frequency_days,
  auto_reorder_enabled, approval_required, approval_threshold_value
Service policy: target_service_level, actual_service_level, otif_target, otif_actual,
  out_of_stock_count, missed_sales_opportunity_count, missed_sales_opportunity_value
Supply risk: supplier_risk_level, single_source_risk, lead_time_variability, supply_disruption_flag,
  alternative_supplier_available, minimum_order_qty, order_multiple, supplier_reliability_score
Financial metrics: inventory_value, unit_cost, average_cost, holding_cost_percent, holding_cost_value,
  reorder_transaction_cost, freight_cost_estimate, landed_cost_estimate, cash_required_for_reorder,
  projected_cash_impact, stockout_cost_estimate
Demand/risk: daily_consumption_rate, weekly_consumption_rate, open_customer_demand,
  days_of_cover, predicted_out_of_stock_date, risk_status
```

These values live in `material.attrs.inventory`. No table was added.

## Stock Status

Statuses are governed by `INVENTORY_STOCK_STATUS`:

```text
in_stock
low_stock
out_of_stock
untracked
negative_stock
```

Detection signals include:

```text
out_of_stock
below_reorder_point
available_below_reorder_point
negative_stock
stock_untracked
stockout_predicted
available_below_minimum_stock
```

Risk statuses are governed by `INVENTORY_RISK_STATUS`:

```text
healthy
watch
reorder_now
stockout_predicted
already_out_of_stock
```

## Recommendation Logic

The route runtime calculates recommendation-ready outputs from the stock profile:

```text
available_qty = stock_on_hand - reserved_qty unless explicitly supplied
daily_consumption_rate = configured daily rate, or weekly rate / 7
days_of_cover = available_qty / daily_consumption_rate
predicted_out_of_stock_date = today + days_of_cover
lead_time_with_safety = lead_time_days + safety_lead_time_days
lead_time_demand = daily_consumption_rate * lead_time_with_safety
target_stock = maximum_stock if set, otherwise max(reorder_point + reorder_qty, safety_stock + lead_time_demand + open_customer_demand, minimum_stock)
suggested_qty = max(reorder_qty, target_stock - available_qty, reorder_delta, minimum_order_qty)
suggested_qty is rounded up to order_multiple when configured
cash_required_for_reorder = suggested_qty * landed/average/unit cost + transaction/freight estimates
```

If there is no consumption rate yet, the system still produces policy-based recommendations from reorder point, minimum stock, and reorder quantity, and marks confidence as `policy_only`.

## Stock Movements

Authenticated operators can record movements. Each movement updates `material.attrs.inventory` and writes an `INVENTORY_STOCK_MOVEMENT` information record.

Governed movement types:

```text
opening_balance
manual_adjustment
sale_reservation
sale_issue
return_in
purchase_receipt
stock_count_adjustment
```

Governed directions:

```text
in
out
reserve
release
adjust
```

## Reorder Suggestions

Low-stock and predicted-stockout detection create idempotent suggestions as `INVENTORY_REORDER_SUGGESTION` service objects. Open/review/approved suggestions prevent duplicate open suggestions for the same material.

Approval does not create a purchase order in this wave. It marks the suggestion as ready for the future Purchase Order Foundation.

Suggestion payloads include:

```text
stock status
risk status
days of cover
predicted out-of-stock date
reorder recommendation
reorder reason
estimated cash impact
supplier risk/status fields
service-level placeholders
purchase requisition bridge metadata
decision-card-ready text
action proposals
```

Example decision card:

```text
Oak board will run out in about 8 days.
Lead time is 10 days plus 2 safety days.
Suggested reorder: 25 pcs.
Estimated cash needed: 420.
```

## Routes

Authenticated inventory routes:

```text
GET    /api/eip/inventory/overview
GET    /api/eip/inventory/materials
GET    /api/eip/inventory/materials/:id
PATCH  /api/eip/inventory/materials/:id/policy
GET    /api/eip/inventory/materials/:id/movements
POST   /api/eip/inventory/materials/:id/movements

GET    /api/eip/inventory/reorder-suggestions
POST   /api/eip/inventory/reorder-suggestions/run
GET    /api/eip/inventory/reorder-suggestions/:id
POST   /api/eip/inventory/reorder-suggestions/:id/approve
POST   /api/eip/inventory/reorder-suggestions/:id/ignore
POST   /api/eip/inventory/reorder-suggestions/:id/tasks
```

Reads require session, tenant scope, and RBAC. Writes additionally require CSRF.

## Permissions

```text
INVENTORY_READ
INVENTORY_WRITE
INVENTORY_ADJUST
INVENTORY_REORDER_READ
INVENTORY_REORDER_WRITE
INVENTORY_REORDER_APPROVE
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

Future cloned tenants inherit the grants through `role_template_permission`.

## Process And Task Governance

Migration `0108_inventory_reorder_foundation.sql` seeds:

```text
INVENTORY_REORDER_FLOW_V1
INVENTORY_STOCK_REVIEW_FLOW_V1
```

Task templates:

```text
REORDER_REVIEW
SUPPLIER_CHECK
STOCK_REVIEW
STOCK_COUNT
```

Migration `0109_inventory_recommendation_policy_addendum.sql` adds governed dropdowns and metadata for:

```text
INVENTORY_ABC_CLASS
INVENTORY_RISK_STATUS
INVENTORY_SUPPLIER_RISK_LEVEL
INVENTORY_RECOMMENDED_ACTION
PURCHASE_REQUISITION_REVIEW
recommendations / decision cards / cash impact / supplier risk capabilities
```

The API creates reorder suggestions and starts the governed process. Approve/ignore routes advance the active process instance with idempotency keys.

## Dashboard UI

Inventory is a generic dashboard module:

```text
Dashboard -> Inventory
```

Sections:

```text
Overview
Stock Alerts / Decision Cards
Materials
Reorder Suggestions
Movements
```

The menu item is descriptor registered and module-gated by active `inventory` tenant settings. The React widget is a low-level reusable renderer for the descriptor-provided endpoints, tabs, labels, and actions.

The default UI shows decision cards, not a technical planning table. Advanced fields appear in the selected material policy panel for operators who need to tune reorder behavior.

## Payment And Order Boundary

This foundation prepares an inventory bridge but does not make payment confirmation reduce stock. Current public commerce order behavior that already consumes tracked inventory is preserved. Irreversible stock issue should be governed later by order/fulfillment or purchase/receiving flows, not payment alone.

## Purchase Requisition Bridge

The system now prepares this path without creating final purchase orders:

```text
low stock / predicted stockout
-> reorder suggestion
-> purchase requisition draft/proposal metadata
-> human review
-> future purchase order generation
-> future supplier email / API JSON / EDI-like transmission
```

Human approval is required for purchase commitment, supplier changes, high-value reorder, unusual quantities, risky suppliers, and cash-impacting actions.

## Settings Boundary

Operational actions live in Dashboard -> Inventory. Tenant-wide inventory preferences such as default unit, negative-stock policy, auto-create reorder suggestions, review mode, and approval thresholds are stored as module metadata and can move into Dashboard -> Settings in a later settings wave.

## Local Verification

```bash
cd services/api
npm run migrate
node --test test/inventory_reorder_foundation.test.mjs
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
4. Ensure the tenant has the Inventory module enabled.
5. Open Dashboard -> Inventory.
6. Verify overview, materials, and alerts load.
7. Select a material, set reorder policy, and record a manual movement.
8. Run low-stock scan.
9. Approve or ignore the created reorder suggestion.
10. Create a supplier check task from the suggestion.

## Known Limitations

```text
No purchase order creation.
No supplier quotation workflow.
No accounting ledger or stock valuation.
No advanced warehouse/location/bin model.
No production consumption/output planning.
Inventory settings UI is deferred; operational stock policy is available in the Inventory workspace.
Sales velocity is currently policy/config based; automated velocity calculation from order history is a future enhancement.
Cashflow forecast is represented as recommendation metadata only; no ledger or payment advice is generated in this wave.
```

## Next Recommended Wave

Purchase Order Foundation:

```text
approved reorder suggestion
-> purchase request / purchase order service_object
-> supplier review task
-> receiving movement
-> inventory update
```
