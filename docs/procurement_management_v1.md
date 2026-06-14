# Procurement Management V1

Procurement Management V1 is an operational module for purchase needs, supplier selection, buying recommendations, commercial terms, approvals, documents, and activity. It uses the EIP kernel tables and does not add procurement-specific persistence tables.

## Kernel Tables

- `eip_core.service_object`: purchase needs and buying requests as `PURCHASE_REQUISITION`.
- `eip_core.task`: approval and workflow tasks.
- `eip_core.agent`: buyers, suppliers, and selected supplier entities.
- `eip_core.material`: requested materials and inventory context.
- `eip_core.material_lot`: only for lot-specific procurement/receipt context from existing inventory flows.
- `eip_core.commercial_condition`: supplier, payment, Incoterm, freight, commercial, and approval policy metadata.
- `eip_core.info_record`: quote, supplier document, contract reference, purchase note, and attachment metadata.
- `eip_core.object_link`: request-material, request-supplier, request-document, and supplier-material relationships.
- `eip_core.dropdown_list` / `dropdown_value`: governed statuses, payment terms, Incoterms, supplier roles, and procurement model values.

## Service Object Model

Procurement requests are stored as `service_object.object_type = 'PURCHASE_REQUISITION'`.

V1-specific safe fields live under `attrs.procurement_management_v1`. The API returns a curated read model and does not expose raw attrs, raw legal text, secrets, or raw compliance text.

Statuses:

- `DRAFT`
- `NEEDS_REVIEW`
- `PENDING_APPROVAL`
- `APPROVED`
- `REJECTED`
- `SOURCING`
- `ORDER_PREPARATION`
- `COMPLETED`
- `CANCELLED`
- `ARCHIVED`

No hard delete route exists. Archival is lifecycle status only.

## Routes

Base path: `/api/eip/procurement`

- `GET /requests`
- `POST /requests`
- `GET /requests/:id`
- `PATCH /requests/:id`
- `GET /requests/:id/summary`
- `GET /requests/:id/supplier-options`
- `GET /recommendations`
- `GET /policies/effective`
- `POST /requests/:id/submit`
- `POST /requests/:id/approve`
- `POST /requests/:id/reject`
- `GET /governance/options`

Legacy foundation endpoints remain for compatibility: supplier links, reorder-to-requisition, RFQ, quote comparison, and cash purchase flows.

## Permissions

- `procurement.read`
- `procurement.request.create`
- `procurement.request.update`
- `procurement.request.submit`
- `procurement.request.approve`
- `procurement.recommendation.read`
- `procurement.policy.read`

Migration `0127_procurement_management_v1.sql` grants these at minimum to `ADMIN_SUPER`.

## Supplier Selection

Supplier selection uses `agent` records with supplier roles and `object_link` supplier-material relationships. No Supplier table is created.

Selection sources:

- supplier/entity role `SUPPLIER`;
- `MATERIAL_SUPPLIER` links;
- supplier commercial conditions;
- effective policy helper where feasible;
- manual supplier selection fallback.

## Commercial Terms

Payment terms and trade credit are classified as `COMMERCIAL`.

Incoterms are classified as `COMMERCIAL / INCOTERMS / INCOTERM`.

Financial policies remain internal cash, liquidity, debt, ratio, and capital policy. Payment terms are not treated as Financial policy.

Approval rules are classified under `APPROVAL_FRAMEWORK`.

## Recommendation Output

The recommendation read model includes:

- requested material or service;
- requested quantity and unit;
- candidate suppliers;
- selected commercial condition when available;
- payment terms;
- Incoterm;
- approval requirement;
- warnings;
- reason and explanation;
- missing data.

When exact computation is not possible, V1 returns a partial safe recommendation with explicit warnings and missing-data fields. It does not fake values.

## Documents

Documents use `info_record` plus `object_link` summaries for:

- quote;
- supplier document;
- contract reference;
- purchase note;
- attachment metadata.

The API returns metadata only and does not expose raw legal or compliance text.

## UI Surface

Procurement is mounted in the dashboard through `KernelModuleWorkspace` and metadata from `module_catalog.attrs.ui_workspace` / `tenant_module_setting.attrs.ui_workspace`.

The source descriptor is `procurementKernelWorkspaceNode` in `apps/dashboard/src/engine/surfaces/kernelModuleDescriptors.js`.

Sections:

- Overview
- Purchase Needs
- Recommendations
- Suppliers
- Commercial Terms
- Approvals
- Documents
- Activity

Create/update forms use reusable kernel fields, including lookup fields for material and supplier search. Submit, approve, and reject use reusable row actions.

## Security Rules

- Requires authenticated EIP session.
- Tenant comes only from session.
- Browser-supplied `tenant_id` is rejected.
- All reads and writes are tenant scoped.
- Mutations require CSRF through the existing route pattern.
- Safe 400/403 errors are returned for invalid input and permission denial.
- No raw attrs dump.
- No secrets.
- No raw legal or compliance text.
- No hard delete.

## Deferred Items

- Supplier outbound communication.
- Final purchase order execution and transmission.
- Invoice matching and accounting handoff.
- Advanced analytics and simulators.
- Extended V2 process-engine CRUD effects for every master-data mutation.

