# Inventory Management V1

Inventory Management V1 is an operational module for tenant-scoped material and lot control. It reuses the EIP kernel and does not add new tables.

## Kernel Tables Reused

- `eip_core.material` for material master data.
- `eip_core.material_lot` for lot/batch records.
- `eip_core.material_lot_status_event` for append-only lot lifecycle history.
- `eip_core.agent` for supplier/entity references.
- `eip_core.commercial_condition` for inventory, reorder, safety-stock, threshold, reservation, release, and storage policies.
- `eip_core.info_record` for document and activity summaries.
- `eip_core.object_link` for material/lot/entity/document relationships.
- `eip_core.service_object` and `eip_core.task` remain available for reorder workflow integration.

No new tables were introduced.

## Routes

Routes are registered under `/api/eip/inventory`:

- `GET /materials`
- `POST /materials`
- `GET /materials/:id`
- `PATCH /materials/:id`
- `GET /materials/:id/lots`
- `POST /materials/:id/lots`
- `GET /lots/:id`
- `PATCH /lots/:id`
- `GET /materials/:id/summary`
- `GET /reorder-recommendations`
- `GET /policies/effective`
- `GET /governance/options`

Existing reorder foundation routes remain available, including `/reorder-suggestions` and stock movement endpoints.

## Permissions

Migration `0125_inventory_management_v1.sql` adds:

- `inventory.read`
- `inventory.material.create`
- `inventory.material.update`
- `inventory.lot.create`
- `inventory.lot.update`
- `inventory.recommendation.read`
- `inventory.policy.read`

`ADMIN_SUPER` receives all permissions. Operational admin templates and active roles also receive appropriate read/write grants; read-only roles receive read, recommendation, and policy read permissions.

## Material Model

Material profile fields are stored on `eip_core.material`:

- `code`
- `name`
- `material_type`
- `is_active`
- `attrs.inventory_management_v1.status`
- `attrs.inventory_management_v1.unit_of_measure`
- `attrs.inventory_management_v1.category`
- `attrs.inventory_management_v1.family`
- `attrs.inventory_management_v1.default_supplier_entity_id`
- `attrs.inventory_management_v1.notes`
- `attrs.inventory_management_v1.safe_attrs`

Inventory override fields that feed reorder logic remain under `attrs.inventory`, preserving compatibility with the existing reorder foundation.

Supported V1 material statuses are `ACTIVE`, `INACTIVE`, `UNDER_REVIEW`, `BLOCKED`, and `ARCHIVED`. The module never hard-deletes materials.

## Lot Model

Lots use `eip_core.material_lot`:

- `lot_code`
- `material_id`
- `quantity`
- `uom`
- `status`
- `owner_agent_id`
- `attrs.inventory_management_v1.received_date`
- `attrs.inventory_management_v1.expiry_date`
- `attrs.inventory_management_v1.location_ref`
- `attrs.inventory_management_v1.supplier_agent_id`
- `attrs.inventory_management_v1.notes`
- `attrs.inventory_management_v1.safe_attrs`

Supported V1 lot statuses are `AVAILABLE`, `RESERVED`, `BLOCKED`, `QUARANTINE`, `CONSUMED`, `EXPIRED`, and `ARCHIVED`. Status changes write `material_lot_status_event`.

## Stock And Reorder Logic

Stock visibility is derived from active lots first:

- `AVAILABLE` contributes to on-hand and available stock.
- `RESERVED` contributes to on-hand and reserved stock.
- `BLOCKED` and `QUARANTINE` contribute to on-hand and warning buckets.
- `CONSUMED`, `EXPIRED`, and `ARCHIVED` do not contribute to available stock.

If active lots do not exist, V1 falls back to the existing `material.attrs.inventory` stock profile. Reorder recommendations reuse the existing inventory foundation functions, returning current stock, thresholds, suggested action, suggested quantity, policy source, condition codes, explanations, and warnings when stock cannot be fully computed.

## Policy Integration

Policy summaries use `eip_core.commercial_condition` and the Policies & Conditions effective-policy helper where feasible. Inventory calls the helper with `policy_domain=INVENTORY`, `condition_type=REORDER_POLICY`, optional `material_id`, and optional supplier context.

Responses expose safe read-model output only: selected condition summary, fallback state, warnings, conflicts, explanation, and source metadata. Raw condition attrs, raw legal text, and secrets are not exposed.

## Entity And Document Summaries

Supplier/entity summaries use `eip_core.agent` and `eip_core.object_link`; V1 does not create supplier/customer tables. Document summaries use linked `info_record` metadata only: title, record type, MIME type, file size, status, relation type, and timestamps.

## UI

`InventoryManagementWorkspace` is registered in the dashboard engine and wired from dashboard descriptors. Sections include Overview, Materials, Lots, Reorder, Policies, Documents, and Activity. Create/update buttons use real API calls or are disabled by permission state.

## Security

- Tenant id comes only from the authenticated EIP session.
- `tenant_id` and `tenantId` request overrides are rejected.
- Mutations require CSRF.
- Routes enforce inventory permissions.
- Inputs reject unknown fields and sensitive attrs.
- Outputs expose safe attrs and summaries, not raw secrets, raw legal text, or raw compliance text.
- Materials and lots are lifecycle-updated, not hard-deleted.
- Mutations emit security audit events.

## Deferred

No core V1 workflow is deferred. Optional future work may include advanced simulator forecasting, richer warehouse/bin modeling, and analytics beyond the operational reorder explanation already provided.
