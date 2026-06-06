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

The drawer is a reusable React primitive for existing governed data:

- marketplace conditions
- linked agents/suppliers/customers
- trade conditions
- pricing conditions
- supplier/customer terms
- validity and renewal metadata
- condition tasks/warnings when present

It reads condition-shaped data from existing product attrs and pricing structures. It does not create free-text-only condition records and does not replace `commercial_condition`.

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

- Trade-condition editing remains a UI primitive over existing governed metadata. Full condition lifecycle review/renewal remains process/task governed.
- Broader product analytics should live in a later product intelligence composition, not as a copied Command Center tab.
