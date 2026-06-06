# Product Studio Surface V1

## Purpose

Product Studio remains the operational product/material master surface. This wave adds descriptor-backed top tabs around the existing Studio so product work can be reviewed without turning Product Studio into Inventory or procurement execution.

## Tabs

- `Studio`: existing Product Studio lifecycle surface.
- `Focus`: product/master-data attention points.
- `Analytics`: lightweight catalog readiness metrics from currently loaded product data.
- `Workload`: product-related review queue and trade-condition work signals.

The tab labels and focus rules are carried in the dashboard `ui_surface` descriptor under `productStudio`.

## Focus Signals

Default focus rules:

- rejected products
- pending publish/review
- missing trade conditions
- missing category/type
- physical inventory setup before activation

These are read-composition checks over existing product attrs/status. They do not create new product tables and do not own business policy.

## Trade Conditions Drawer

The drawer is a reusable React primitive for existing governed data:

- marketplace conditions
- linked agents/suppliers/customers
- trade conditions
- pricing conditions
- supplier/customer terms
- validity and renewal metadata
- condition tasks/warnings when present

It reads condition-shaped data from existing product attrs and pricing structures. It does not create free-text-only condition records and does not replace `commercial_condition`.

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

- Product analytics uses currently loaded Product Studio data unless a future product analytics composition endpoint is added.
- Trade-condition editing remains a UI primitive over existing governed metadata. Full condition lifecycle review/renewal remains process/task governed.
