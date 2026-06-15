# CRM Management V1

CRM Management V1 is an operational module for accounts, contacts, opportunities, pipeline, activities, documents, safe communication summaries, policy context, and governed conversion intent. It uses the EIP kernel tables and adds no CRM-only customer/prospect tables or CRM-specific customer/prospect persistence tables.

## Kernel Tables

- `eip_core.agent`: CRM accounts as organizations or people.
- `eip_core.entity_contact`: account contact methods.
- `eip_core.service_object`: opportunities as `CRM_OPPORTUNITY` and backing activity objects when a task needs an account-only target.
- `eip_core.service_object_party`: opportunity-account links.
- `eip_core.task`: CRM follow-ups and activities.
- `eip_core.info_record`: note, communication, document, and attachment metadata.
- `eip_core.object_link`: account-document, account-activity, and service-object-document relationships.
- `eip_core.commercial_condition`: policy and commercial context used through the effective policy read model.
- `eip_core.dropdown_list` / `dropdown_value`: account status, opportunity status, task status, entity roles, entity kind, contact type, and task type values.

## Storage Model

Accounts are `agent` rows. V1-specific account metadata is stored under `attrs.crm_management_v1`.

Opportunities are `service_object` rows where `object_type = 'CRM_OPPORTUNITY'`. V1-specific opportunity metadata is stored under `attrs.crm_management_v1`.

Activities are `task` rows. If an activity is account-only, V1 creates a lightweight `CRM_ACTIVITY` service object as the required task target and links it back to the account.

The API returns curated read models and does not expose raw attrs, raw legal text, raw email bodies, secrets, tokens, credentials, or tenant override fields.

## Routes

Base path: `/api/eip/crm`

- `GET /accounts`
- `POST /accounts`
- `GET /accounts/:id`
- `PATCH /accounts/:id`
- `GET /accounts/:id/contacts`
- `POST /accounts/:id/contacts`
- `PATCH /accounts/:id/contacts/:contactId`
- `GET /opportunities`
- `POST /opportunities`
- `GET /opportunities/:id`
- `PATCH /opportunities/:id`
- `GET /activities`
- `POST /activities`
- `PATCH /activities/:id`
- `GET /accounts/:id/summary`
- `GET /pipeline`
- `POST /opportunities/:id/convert`
- `GET /governance/options`

Legacy CRM foundation endpoints for leads, intake, mailbox, cases, interactions, tasks, segments, campaigns, signals, connectors, and dashboards remain for compatibility.

## Permissions

- `crm.read`
- `crm.account.create`
- `crm.account.update`
- `crm.contact.manage`
- `crm.opportunity.create`
- `crm.opportunity.update`
- `crm.activity.create`
- `crm.activity.update`
- `crm.convert`
- `crm.policy.read`

Migration `0128_crm_management_v1.sql` grants these permissions to CRM/admin role templates and active roles.

## UI Surface

CRM is mounted in the dashboard through the generic `KernelModuleWorkspace`.

CRM-specific list fields, forms, tabs, collection bindings, row actions, labels, permission gates, and endpoints are stored in `module_catalog.attrs.ui_workspace` / `tenant_module_setting.attrs.ui_workspace` and returned by `/api/eip/crm/governance/options`.

The React surface mount is intentionally thin:

- module: `crm`
- config endpoint: `/api/eip/crm/governance/options`

Sections:

- Overview
- Profile
- Contacts
- Opportunities
- Pipeline
- Activities
- Commercial Terms
- Communications
- Documents
- Policies

## Conversion

`POST /opportunities/:id/convert` records governed conversion intent only. V1 does not fake a downstream order, quote, invoice, or fulfillment object. The conversion read model explicitly returns that no downstream object was created unless a later enabled kernel process handles it.

## Security Rules

- Requires authenticated EIP session.
- Tenant comes only from the session.
- Browser-supplied `tenant_id` is rejected.
- Reads and writes are tenant scoped.
- Mutations require CSRF through the existing route pattern.
- V1 rejects unknown fields and sensitive attrs keys.
- Safe 400/403/404/409 errors are returned.
- No hard delete route exists.
- No fake/demo data is seeded.

## Deferred Items

- Advanced CRM analytics and simulators.
- Automatic downstream sales-order or quote creation.
- Rich communication composer UI.
- V2 process-builder coverage for every CRM lifecycle transition.
