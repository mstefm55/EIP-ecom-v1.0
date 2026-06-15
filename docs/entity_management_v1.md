# Entity Management V1

Entity Management V1 is the production tenant entity registry for EIP Core. It uses the existing kernel backbone instead of adding new persistence tables:

- `eip_core.agent` for the universal entity profile.
- `eip_core.entity_address`, `eip_core.entity_contact`, and `eip_core.entity_bank_account` for structured child records.
- `eip_core.object_link` for entity-to-entity relationships and linked document records.
- `eip_core.info_record` for document summaries.
- `eip_core.commercial_condition` for policy summaries.
- `eip_core.service_object_party` and `eip_core.task` for activity summaries.

No new tables are introduced by V1.

## Scope

V1 supports entity list/search, create, update, lifecycle status, roles, classifications, addresses, contacts, bank account metadata, relationships, documents, scoped policy summary, activity/task summary, dashboard wiring, permissions, and audit/security events.

Assets are not entities. Operational cases remain service objects. Documents remain info records linked to agents or service objects.

## Entity Model

`agent` is the universal party/entity table. V1 stores profile fields in `agent` plus safe structured `attrs`:

- `agent_type` maps to `entity_kind`.
- `name` maps to `display_name`.
- `attrs.roles` stores entity roles.
- `attrs.status` stores lifecycle status.
- `attrs.entity_management_v1=true` marks rows created or normalized by this module.

Default roles are seeded as an extensible list: `CUSTOMER`, `SUPPLIER`, `PARTNER`, `INTERNAL_ORG`, `EMPLOYEE`, `CARRIER`, `MARKETPLACE`, `AUTHORITY`, and `OTHER`.

Lifecycle statuses are `ACTIVE`, `INACTIVE`, `UNDER_REVIEW`, `BLOCKED`, and `ARCHIVED`. V1 never hard-deletes entities or child rows; deactivation and archive are status updates.

## Relationships And Mobility

Entity relationships use `eip_core.object_link` as a tenant-scoped many-to-many graph. Ordinary relationships remain many-to-many: an entity can be linked to several customers, suppliers, partners, teams, departments, parent companies, or other parties when the business relationship is not marked as mobile.

Relationship rows expose governed metadata from `object_link.attrs`:

- `relationship_scope`, including `SELF` for the tenant's own structure.
- `structure_category`, including `SELF`, `GROUP`, `TEAM`, `LEGAL`, `COMMERCIAL`, and `OPERATIONAL`.
- `valid_from` and `valid_to` for time-bounded affiliation history.
- `mobile_affiliation` for relationships where the current parent can change over time.
- `movement_reason` and chart position metadata for audited moves.

When a mobile self-structure affiliation is moved, for example a division sold to another company or a person moved to another team, the service closes the previous active affiliation by setting `is_active=false` and `attrs.valid_to`. It then creates the new active relationship. This preserves historical affiliation rows while keeping the current org chart unambiguous.

Supported self-structure relationship types include `MEMBER_OF`, `DIVISION_OF`, `DEPARTMENT_OF`, `TEAM_OF`, `SUBSIDIARY_OF`, `REPORTS_TO`, `AFFILIATED_TO`, and compatible parent-to-child types such as `PARENT_OF`, `HAS_MEMBER`, `OWNS`, and `MANAGES`.

## API

Routes are mounted under `/api/eip/entities`:

- `GET /` list/search/filter entities.
- `POST /` create entity.
- `GET /:id` entity detail with child summaries.
- `PATCH /:id` update profile and lifecycle.
- `GET|POST /:id/addresses`, `PATCH /:id/addresses/:addressId`.
- `GET|POST /:id/contacts`, `PATCH /:id/contacts/:contactId`.
- `GET|POST /:id/bank-accounts`, `PATCH /:id/bank-accounts/:bankAccountId`.
- `GET|POST /:id/relationships`, `PATCH /:id/relationships/:relationshipId`.
- `GET /:id/org-chart` for the metadata-driven self-structure read model.
- `POST /:id/org-chart/move` to move a node under a new parent with backend validation.
- `GET /:id/documents`, `/policies`, `/activity`, and `/summary`.
- `GET /governance/options` for dropdown and permission metadata.

All routes resolve tenant identity from the EIP session. Mutations require CSRF and module permissions.

## Security

The service rejects browser-supplied `tenant_id`, unknown fields, nested sensitive attrs, and raw secret-like fields. Bank account reads return only masked `account_number_masked` and `iban_masked`; raw account and IBAN values are accepted only on create/update and are never returned by Entity Management V1.

Mutations emit `security_event` records through the existing audit helper with redacted metadata.

## Permissions

Migration `0124_entity_management_v1.sql` seeds:

- `entities.read`
- `entities.create`
- `entities.update`
- `entities.manage_addresses`
- `entities.manage_contacts`
- `entities.manage_bank_accounts`
- `entities.manage_relationships`

Read-only roles receive read permission only. Admin/universal/operational roles receive create/update and child-management permissions.

## Dashboard

The dashboard uses the generic `KernelModuleWorkspace` UI-engine primitive for the module-gated `Entities` menu entry with module code `entity-management`. Entity-specific list fields, forms, child collections, tabs, labels, and permission gates are stored as governed workspace metadata under `module_catalog.attrs.ui_workspace` / active `tenant_module_setting.attrs.ui_workspace` and are fetched through `/api/eip/entities/governance/options`.

The workspace includes list/search/filter, create/edit, child record management, and tabs for Overview, Profile, Addresses, Contacts, Bank Accounts, Relationships, Org Chart, Documents, Policies, and Activity. The org chart is rendered by the generic `KernelModuleWorkspace` `org_chart` tab type; entity-specific relationship semantics come from DB-owned workspace metadata and dropdown values.

## Migration

`0124_entity_management_v1.sql` is additive. It seeds permissions, role/template grants, dropdowns, module catalog/settings, indexes, and dashboard descriptor repair. It does not create tables, run data rewrites, merge branches, deploy, or execute Railway migrations.

`0131_entity_relationship_mobility_org_chart.sql` is also additive. It seeds relationship kind/scope/category dropdowns, adds relationship-scope indexes on `object_link`, and patches DB-owned Entity Management workspace metadata for mobile relationship forms and the org chart tab. It does not create module-owned tables.
