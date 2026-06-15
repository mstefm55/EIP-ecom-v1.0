# Cross-Module Hardening V1

Base main: `ac489141eac0a73f47a7d576cbba4cb3f0d44c92`

Scope: Policies & Conditions, Entity Management, Inventory Management, Procurement Management, and CRM Management.

## Result

This wave keeps the released V1 modules on the shared EIP backbone:

- parties remain in `eip_core.agent` and entity subtables;
- materials remain in `eip_core.material` and inventory lot/status tables;
- procurement requests remain service objects linked to materials and supplier agents;
- CRM accounts remain agents, contacts remain `entity_contact`, and opportunities remain service objects;
- policies remain resolved through the Policies & Conditions read model and effective-policy helper.

Migration `0129_cross_module_hardening_v1.sql` was added. No applied migration was edited.

## Fixes

- CRM read routes now follow the same CSRF pattern as Entity, Inventory, and Procurement: reads require session and permission, mutations additionally require CSRF.
- Legacy CRM bank-account creation now returns masked account and IBAN identifiers only.
- CRM parent, owner, and assignee references are now resolved through tenant-scoped agent lookups before account, opportunity, and activity writes.
- Procurement RFQ supplier quotes now validate the supplier agent inside the tenant before creating quote records or links.
- Policies & Conditions governance metadata now reports `policies_conditions.read_effective` when the session has it.
- The source dashboard descriptor for Procurement now uses the same workspace id as the released DB seed and migration.
- Entity relationship dropdown metadata now includes the supplier/customer relationship values exposed by the UI fallback descriptors.

## Verification Focus

The cross-module regression test covers:

- released migration presence and idempotency markers;
- ADMIN_SUPER permission coverage for released V1 permissions;
- dashboard/menu/workspace descriptor uniqueness;
- Entity, Inventory, Procurement, CRM, and Policies table-boundary contracts;
- effective-policy helper use in Inventory, Procurement, and CRM;
- Commercial classification for payment terms and Incoterms;
- Approval Framework classification for approvals;
- CRM read CSRF behavior and mutation CSRF behavior;
- CRM tenant-scoped reference validation for parent, owner, and assignee fields;
- Procurement tenant-scoped supplier validation for RFQ quote creation;
- sensitive bank-output masking;
- no hard-delete routes in released module surfaces;
- no fake/demo data markers in released V1 production files.
