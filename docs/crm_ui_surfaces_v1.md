# CRM UI Surfaces V1

## Surface Registration

CRM is registered in the reusable tenant dashboard descriptor:

```text
UserShell
  -> UserPanel(tab=crm)
    -> CrmWorkspace(module=crm)
```

The registration is present in:

- `services/api/db/seed/ui_surface_dashboard.sql`
- `services/api/db/migrations/0099_crm_module_completion.sql`
- `apps/dashboard/src/engine/surfaces/dashboard.js`
- `apps/dashboard/src/engine/registry.jsx`

## Descriptor-Driven Parts

The dashboard descriptor supplies:

- CRM module code
- menu visibility metadata
- workspace title and subtitle
- tabs, labels, object kinds, endpoints, and required read permissions
- KPI labels and formats
- common action labels

DB dropdown governance supplies:

- statuses
- priorities
- channels
- directions
- task types
- lead sources
- lost reasons

## Reusable React Primitive

`CrmWorkspace` is a tenant-agnostic low-level renderer. It provides:

- KPI cards
- tabbed object lists
- search
- detail panel
- status pills
- timeline
- create and edit modals
- notes
- follow-up creation
- lead conversion
- agent contact, address, and bank-account actions

It contains no tenant-specific condition and no tenant code.

## Tenant Customization

Tenant behavior should continue to move into:

- UI surface descriptors for labels, tabs, visible actions, and form configuration
- dropdown lists for controlled vocabularies
- schema bundles and overrides for tenant-specific fields
- process definitions, task templates, and effects for workflow differences
- module settings for visibility

The current React primitive keeps fallback form definitions for resilience. Before commercial customization expands, move each form schema into UI descriptor or schema-bundle metadata so tenants can hide, rename, or require fields without a frontend build.

## Process Compliance

Status transitions, task creation, task updates, and lead conversion use core process instances and governed effects. Notes are a low-level kernel write to `info_record` plus `object_link`.

## Local Test

```bash
cd services/api
node --test test/crm_module_completion.test.mjs

cd ../../apps/dashboard
npm run build
```

On Windows PowerShell with script execution disabled, use `npm.cmd run build`.

## Module visibility

The tenant shell loads `/api/eip/user/dashboard/modules` before showing
module-gated menu items. The endpoint is intentionally narrower than the live
dashboard KPI summary so an unrelated report or task metric failure cannot hide
an enabled module.

Run `npm run migrate` after deploying the API. Migration
`0100_crm_dashboard_descriptor_repair.sql` restores the reusable CRM menu item
and workspace panel on published dashboard descriptors that were created or
cloned before CRM registration.
