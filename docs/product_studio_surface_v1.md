# Product Studio Surface V1

## Purpose

Product Studio remains the operational product/material master surface. It has a small descriptor-backed tab shell around the existing Studio so incomplete product setup work can be completed without turning Product Studio into Command Center, Inventory, or procurement execution.

## Tabs

- `Studio`: existing Product Studio lifecycle surface.
- `Focus`: product/master-data attention points that are incomplete and need completion.

The tab labels and focus rules are carried in the dashboard `ui_surface` descriptor under `productStudio`.

## Focus Signals

Default focus rules:

- rejected products
- pending publish/review
- missing trade conditions
- missing category/type
- physical inventory setup before activation

These are read-composition checks over existing product attrs/status. They do not create new product tables and do not own business policy.

Focus is not a duplicate task browser. It is a product setup completion workbench: choose a focus reason, open the affected product, and complete the missing setup step in Studio or the governed trade-condition drawer.

## Trade Conditions Drawer

The drawer is a reusable React primitive for governed commercial-condition data:

- marketplace conditions
- linked agents/suppliers/customers
- trade conditions
- pricing conditions
- supplier/customer terms
- validity and renewal metadata
- condition tasks/warnings when present

The canonical data structure is the existing `eip_core.commercial_condition` table. The drawer can create product-scoped rows through:

```text
GET /api/eip/ecom/commercial-conditions?product_id=...
POST /api/eip/ecom/commercial-conditions
PATCH /api/eip/ecom/commercial-conditions/:id
```

Product rows are hydrated with governed commercial-condition records for display and focus detection. Product attrs may still provide backward-compatible display fallback data, but attrs are not the policy authority and the drawer does not create free-text-only condition records.

## Structured Commercial Values

Human summary text is only explanatory. Calculation-ready values are stored in `commercial_condition.effect` through a governed field catalog:

```text
dropdown_list.code = ECOM_COMMERCIAL_CONDITION_FIELD
dropdown_value.attrs.effect_path = payment_terms.credit_limit_days
dropdown_value.attrs.data_type = integer
dropdown_value.attrs.unit = days
```

Examples:

- `credit_limit_days = 70` -> `effect.payment_terms.credit_limit_days`
- `payment_due_days = 30` -> `effect.payment_terms.payment_due_days`
- `credit_available = true` -> `effect.payment_terms.credit_available`
- `approval_threshold_value = 250` -> `effect.procurement_policy.approval_threshold_value`
- `reorder_point_qty = 12` -> `effect.reorder_policy.reorder_point_qty`

The field catalog is metadata-driven and tenant-scoped. Users can create additional fields in the drawer, similar to variant headers. Custom fields are stored under `effect.custom.<field_code>` unless a specific effect path is configured; they become process-consumable when a process/template or resolver is configured to read that path.

Migration `0120_commercial_condition_structured_fields.sql` seeds the default field catalog without adding tables.

The drawer has a fixed header, scrollable body, and visible footer with a Close action so long condition sets do not hide the controls.

## Inventory Boundary

Product Studio can show initial inventory setup for physical products before activation. Operational inventory remains in the Inventory module:

- stock movements
- lots/serials
- WIP
- in-transit
- dispatch zones
- reservations
- adjustments
- transactional stock audit

Digital products hide physical inventory setup in Product Studio.

## Status Boundary

Rejected products render as `Rejected`. They are not shown as `Out of stock` merely because quantity is zero.

## Test Procedure

```bash
cd services/api
npm test -- test/product_studio_surface_alignment.test.mjs
cd ../../apps/dashboard
npm run build
```

## Known Limits

- Trade-condition create/edit is available as a UI primitive over existing governed metadata. Full condition lifecycle review/renewal remains process/task governed.
- Custom structured fields under `effect.custom` are stored safely but require process/template configuration before they influence business decisions.
- Broader product analytics should live in a later product intelligence composition, not as a copied Command Center tab.
