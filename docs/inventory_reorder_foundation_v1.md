# Inventory & Reorder Foundation V1

Status: implemented foundation
Date: 2026-06-03

## Purpose

Inventory V1 gives SME tenants a lightweight operating view for stock, low-stock alerts, and human-reviewed purchase needs:

```text
material stock profile
-> stock movement evidence
-> low-stock detection
-> reorder suggestion service_object
-> review task / approval workflow
```

It does not implement purchase orders, accounting ledger, MRP, warehouse management, production planning, IBP, or S&OP.

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
  "unit_of_measure": "pcs",
  "preferred_supplier_agent_id": null,
  "lead_time_days": 7,
  "stock_status": "in_stock"
}
```

`track_inventory`, `on_hand`, and `available_qty` remain compatible with the current Product Studio and public commerce catalog behavior.

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
```

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

Low-stock detection creates idempotent suggestions as `INVENTORY_REORDER_SUGGESTION` service objects. Open/review/approved suggestions prevent duplicate open suggestions for the same material.

Approval does not create a purchase order in this wave. It marks the suggestion as ready for the future Purchase Order Foundation.

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

The API creates reorder suggestions and starts the governed process. Approve/ignore routes advance the active process instance with idempotency keys.

## Dashboard UI

Inventory is a generic dashboard module:

```text
Dashboard -> Inventory
```

Sections:

```text
Overview
Stock Alerts
Materials
Reorder Suggestions
Movements
```

The menu item is descriptor registered and module-gated by active `inventory` tenant settings. The React widget is a low-level reusable renderer for the descriptor-provided endpoints, tabs, labels, and actions.

## Payment And Order Boundary

This foundation prepares an inventory bridge but does not make payment confirmation reduce stock. Current public commerce order behavior that already consumes tracked inventory is preserved. Irreversible stock issue should be governed later by order/fulfillment or purchase/receiving flows, not payment alone.

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
