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
-> Procurement Purchase Need Workbench handoff
```

It does not implement purchase orders, supplier outbound transmission, accounting ledger, MRP, warehouse management, production planning, IBP, or S&OP.
It does establish the policy and recommendation foundation needed for those methods to be activated progressively.

## Kernel Model

No new persistence table was added.

| Capability | Kernel storage |
| --- | --- |
| Governed reorder/supply/purchase policy | `eip_core.commercial_condition` |
| Material/product stock state, item override, and output snapshot | `eip_core.material.attrs.inventory` |
| Physical lot/batch support | Existing `eip_core.material_lot` and status events |
| Stock movement/audit evidence | `eip_core.info_record` with `record_type='INVENTORY_STOCK_MOVEMENT'` |
| Reorder suggestion | `eip_core.service_object` with `object_type='INVENTORY_REORDER_SUGGESTION'` |
| Stock review work | `eip_core.service_object` with `object_type='INVENTORY_STOCK_REVIEW'` |
| Reorder/stock review tasks | `eip_core.task` |
| Material to reorder lineage | `eip_core.object_link` with `relation_type='REORDER_FOR'` |
| Tenant enablement | `eip_core.tenant_module_setting` module `inventory`, code `operations` |

## Stock Profile

Governed reorder, supply, and purchasing policy lives in `eip_core.commercial_condition`. `material.attrs.inventory` stores current stock state, material-specific overrides, and the latest calculated output snapshot:

```json
{
  "track_stock": true,
  "track_inventory": true,
  "stock_on_hand": 12,
  "on_hand": 12,
  "reserved_qty": 2,
  "available_qty": 10,
  "reorder_qty": 20,
  "minimum_stock": 3,
  "unit_of_measure": "pcs",
  "preferred_supplier_agent_id": null,
  "daily_consumption_rate": 0.75,
  "stock_status": "in_stock",
  "risk_status": "healthy",
  "policy_source": "commercial_condition",
  "policy_condition_codes": ["INV_REORDER_DEFAULT"],
  "effective_policy": {},
  "recommendation_snapshot": {}
}
```

`track_inventory`, `on_hand`, and `available_qty` remain compatible with the current Product Studio and public commerce catalog behavior.

## Professional Policy Fields

The policy envelope supports professional supply-chain methods without forcing a heavy planning screen on the owner:

```text
Stock state and material overrides: track_stock, stock_on_hand, reserved_qty, available_qty,
  unit_of_measure, preferred_supplier_agent_id, daily_consumption_rate
Governed reorder policy: planning_method, abc_classification, service_level_target,
  reorder_point_qty, reorder_qty, minimum_stock_qty, maximum_stock_qty, safety_stock_qty,
  safety_lead_time_days, lead_time_days, review_frequency_days, auto_reorder_enabled,
  approval_required, approval_threshold_value
Service policy signals: target_service_level, actual_service_level, otif_target, otif_actual,
  out_of_stock_count, missed_sales_opportunity_count, missed_sales_opportunity_value
Supply risk: supplier_risk_level, single_source_risk, lead_time_variability, supply_disruption_flag,
  alternative_supplier_available, minimum_order_qty, order_multiple, supplier_reliability_score
Financial metrics: inventory_value, unit_cost, average_cost, holding_cost_percent, holding_cost_value,
  reorder_transaction_cost, freight_cost_estimate, landed_cost_estimate, cash_required_for_reorder,
  projected_cash_impact, stockout_cost_estimate
Demand/risk: daily_consumption_rate, weekly_consumption_rate, open_customer_demand,
  days_of_cover, predicted_out_of_stock_date, risk_status
```

These values are resolved from governed commercial conditions first. Material attrs can still carry item-specific overrides for allowed policy fields and remain backward-compatible for tenants that already stored reorder values there.

## Governed Policy Resolution

Migration `0110_inventory_commercial_condition_policy.sql` seeds default commercial conditions without adding tables:

```text
INVENTORY_REORDER_POLICY / INVENTORY
SUPPLY_REORDER_CONDITION / SUPPLY
SUPPLIER_PURCHASE_CONDITION / PURCHASING
```

At runtime, inventory resolves policy in this order:

```text
tenant commercial_condition defaults
-> scoped category/supplier/material commercial_condition
-> allowed material inventory override
-> normalized effective policy
-> reorder recommendation
-> process-engine-ready parameters
```

The resolver returns:

```text
policy_source
condition_codes
effective_policy
material_override_fields
```

This keeps `commercial_condition` as the governed business/trade/supply policy authority while preserving existing `material.attrs.inventory` data as state, overrides, and calculated snapshots.

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

The inventory service helpers calculate recommendation-ready outputs from the stock profile. Routes enforce session, CSRF/RBAC where needed, tenant scope, transactions, and response orchestration; they do not own the business workflow sequence.

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

## Inventory Signal Workbench

The dashboard now uses a journey-first layout:

```text
Stock Signals Queue -> Inventory Signal Workbench -> Action Rail -> Timeline
```

The production workspace is organized as operational stock views:

```text
Inventory Operations
-> Stock Signals
-> Stock Position
-> Movements
-> Locations / States
-> Counts / Adjustments
-> Policy View
```

The workbench starts from one stock signal or reorder suggestion and composes a read model from existing kernel data:

```text
material
material.attrs.inventory current state and material overrides
commercial_condition effective reorder/supply policy
INVENTORY_REORDER_SUGGESTION service_object
INVENTORY_STOCK_MOVEMENT info_records
linked procurement requisition/RFQ records where present
active process/task state
```

The route is:

```text
GET /api/eip/inventory/reorder-suggestions/:id/workbench
```

The response includes:

```text
signal
material
inventory_state
risk_explanation
effective_policy
policy_source
material_override
reorder_recommendation
procurement_bridge
recent_movements
process_timeline
next_actions
```

`next_actions` is a display/action read model derived from the current suggestion status, active process state, open tasks, policy-backed recommendation, and linked procurement state. Inventory actions approve/ignore the reorder suggestion through the process engine, create follow-up tasks, or hand off to Procurement. Inventory does not execute PO lifecycle work or supplier outbound transmission.

Rejected materials are displayed as `Rejected` and are not counted as out of stock. Digital/download/service/virtual products are excluded from physical stock signals unless stock tracking is explicitly configured on the material.

Stock Position is material-level when only `material.attrs.inventory` exists. Location/state rows render only when real tenant data such as `locations`, `stock_by_location`, `stock_states`, or material-level state fields exist. The UI does not fabricate warehouse, bin, WIP, in-transit, lot, or serial rows.

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

Counts / Adjustments exposes the existing movement path for physical inventory. A future stock-count task workflow is shown as unavailable until process/task governance is configured; it is not simulated in the UI.

## Reorder Suggestions

Low-stock and predicted-stockout detection create idempotent suggestions as `INVENTORY_REORDER_SUGGESTION` service objects. Open/review/approved suggestions prevent duplicate open suggestions for the same material.

Approval does not create a purchase order in this wave. It marks the suggestion as ready for the Procurement Foundation, where it can become a requisition, RFQ, or cash/shop purchase receipt.

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
structured process parameters
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
GET    /api/eip/inventory/reorder-suggestions/:id/workbench
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

Migration `0110_inventory_commercial_condition_policy.sql` adds governed commercial-condition defaults for inventory reorder, supply, and purchasing policy. Future template clones already receive these rows because `eip_core.commercial_condition` is part of the canonical tenant clone path.

The API creates reorder suggestions and starts the governed process. Approve/ignore routes advance the active process instance with idempotency keys.

## Dashboard UI

Inventory is a generic dashboard module:

```text
Dashboard -> Inventory
```

Sections:

```text
Stock Signals
Stock Position
Movements
Locations / States
Counts / Adjustments
Policy View
```

The menu item is descriptor registered and module-gated by active `inventory` tenant settings. The React widget is a low-level reusable renderer for the descriptor-provided endpoints, tabs, labels, and actions.

The default UI is journey-led, not a technical planning table. It starts from one stock signal, explains the material risk, shows the governed policy source, separates material overrides from commercial-condition policy, presents one action rail, and hands the buying journey to Procurement. Policy View shows the effective commercial-condition policy and keeps material override editing collapsed. Raw JSON is not dumped into the main UI, and raw UUIDs are not primary labels where material names, codes, suggestion titles, or condition codes exist.

## Payment And Order Boundary

This foundation prepares an inventory bridge but does not make payment confirmation reduce stock. Current public commerce order behavior that already consumes tracked inventory is preserved. Irreversible stock issue should be governed later by order/fulfillment or purchase/receiving flows, not payment alone.

## Purchase Requisition Bridge

The procurement foundation now consumes this path without creating final purchase orders:

```text
low stock / predicted stockout
-> reorder suggestion
-> purchase requisition draft
-> RFQ / quote review when policy requires
-> cash/shop purchase capture for low-value purchases
-> future governed purchase commitment boundary
```

The policy bridge is documented in `docs/procurement_foundation_v1.md`. Human approval remains required for purchase commitment, supplier changes, high-value reorder, unusual quantities, risky suppliers, and cash-impacting actions. Inventory itself does not expose final PO lifecycle UI, PO sending, supplier outbound transmission, invoice matching, ledger posting, or payment execution.

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
6. Verify Stock Signals, Stock Position, Movements, Locations / States, Counts / Adjustments, and Policy View are visible.
7. Run low-stock scan if no signals exist.
8. Select one stock signal and verify material context, effective policy, material overrides, recommendation, recent movements, and procurement bridge display.
9. Confirm digital/untracked products do not show physical stock actions unless explicitly tracked.
10. Confirm rejected items show as Rejected and not Out of stock.
11. Approve or ignore the created reorder suggestion.
12. Use Open in Procurement to continue the purchase need journey.
13. Use Counts / Adjustments only for backed stock movement recording.

## Known Limitations

```text
No purchase order creation.
Supplier quotation is foundation-level through RFQ/quote comparison; final supplier transmission remains deferred.
No accounting ledger or stock valuation.
No advanced warehouse/location/bin model.
No production consumption/output planning.
Inventory settings UI is deferred; operational stock policy is available in the Inventory workspace.
Sales velocity is currently policy/config based; automated velocity calculation from order history is a future enhancement.
Cashflow forecast is represented as recommendation metadata only; no ledger or payment advice is generated in this wave.
```

## Next Recommended Wave

Purchase Order Execution Foundation:

```text
approved reorder suggestion
-> purchase requisition / selected quote
-> purchase order draft
-> supplier transmission adapter
-> receiving movement
-> purchase_receipt inventory movement
```
