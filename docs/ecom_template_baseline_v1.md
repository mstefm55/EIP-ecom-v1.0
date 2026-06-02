# EIP V1 Ecommerce Template Baseline

This note records the canonical `eip_ecom` clone source after the V1 template rebuild.

## Audit Summary

Already present:
- `tenant_template_ecom.sql` creates `eip_ecom`.
- `template_ecom_process.sql` seeds product, sales order, return, refund, and payment flows.
- Runtime handlers exist for governed effects including `STATUS_SET`, `JSON_MERGE`, `CHILD_SERVICE_OBJECT_CREATE`, `INSTANCE_START`, `ACCESS_GRANT_CREATE`, and `VARIANT_INVENTORY_VALIDATE`.
- Dashboard commerce actions are validated against seeded process actions.

Gaps found:
- `eip_ecom` was not explicitly marked as the canonical clone source.
- Order/payment flows used `AUTOMATION` node types, but the governed node taxonomy exposes `STEP` and `HUMAN_TASK`, not `AUTOMATION`.
- Order/payment had no active task templates, while clone tenants need a minimal operational task surface.
- Return/refund flows had review tasks but no receive/issue task templates.
- Child service object creation existed in the engine and taxonomy but was not represented in the ecom template process graph.
- Storefront content publication exists in migrations, but a fresh post-migration `eip_ecom` reseed could miss it because the template tenant is created after migrations.
- Effect governance depended only on the global process effect list; cloned ecommerce tenants did not receive a template-scoped effect policy.

## Canonical Object/Process Map

| Object | Process | Status model | Minimal task templates | Governed effects |
|---|---|---|---|---|
| `product` | `ECOM_PRODUCT_ONBOARDING` | `new`, `in_progress`, `done`, `cancelled` with material workflow attrs for review/publish stages | `PRODUCT_DRAFT_ENRICH`, `PRODUCT_QA_REVIEW` | `STATUS_SET`, `JSON_MERGE`, `VARIANT_INVENTORY_VALIDATE` |
| `sales_order` | `ECOM_SALES_ORDER_FLOW` | `new`, `in_progress`, `done`, `cancelled` with order workflow attrs for confirmed/packed/shipped/delivered/fulfilled | `ORDER_CONFIRM_TASK`, `ORDER_FULFILLMENT_TASK` | `STATUS_SET`, `JSON_MERGE`, `ACCESS_GRANT_CREATE`, `CHILD_SERVICE_OBJECT_CREATE`, `INSTANCE_START` |
| `payment` | `ECOM_PAYMENT_FLOW` | `new`, `in_progress`, `done`, `cancelled` with payment workflow attrs | `PAYMENT_REVIEW` | `STATUS_SET`, `JSON_MERGE` |
| `return_request` | `ECOM_RETURN_FLOW` | `new`, `in_progress`, `done`, `cancelled` with return workflow attrs | `RETURN_REVIEW`, `RETURN_RECEIVE_TASK` | `STATUS_SET`, `JSON_MERGE` |
| `refund_request` | `ECOM_REFUND_FLOW` | `new`, `in_progress`, `done`, `cancelled` with refund workflow attrs | `REFUND_REVIEW`, `REFUND_ISSUE_TASK` | `STATUS_SET`, `JSON_MERGE` |
| `storefront_content` | `ECOM_STOREFRONT_CONTENT_FLOW` | `new`, `review`, `approved`, `published`, `rejected`, `cancelled` | `CONTENT_REVIEW` | `STATUS_SET`, `JSON_MERGE` |

Shipment/fulfilment is intentionally modeled inside `ECOM_SALES_ORDER_FLOW` because current runtime routes use `sales_order` as the operational parent object. A separate shipment service object/process is deferred until logistics-specific runtime routes exist.

## Rebuilt Process Set

The canonical seed `services/api/db/seed/template_ecom_canonical_v1.sql` runs after the existing base seed and upserts:
- Product onboarding/review/publish.
- Sales order confirmation, fulfilment, shipment, delivery, cancellation, return-request creation, and refund-request creation.
- Payment review/authorization/capture/fail/cancel.
- Return review/receive/reject.
- Refund review/issue/reject.
- Storefront content draft/review/approve/publish/reject/cancel.

The seed is idempotent and updates process defs, task templates, bindings, tenant attrs, and template-scoped effect dropdown values.

The controlled template stage also runs `services/api/db/seed/template_crm_canonical_v1.sql`.
That seed refreshes the reusable CRM kernel metadata onto `eip_ecom` so Admin >
Templates remains the single governed clone path for future tenants. Global CRM
dropdowns and the published dashboard descriptor stay globally governed and are
inherited at read time. Tenant-scoped CRM capability metadata is cloned from the
canonical template.

## Smoke Clone Validation

Use `services/api/scripts/smoke_clone_ecom_template.mjs` through `npm run template:smoke-clone` to prove clone-path readiness without using the hardcoded manual clone SQL.

The smoke clone copies only:
- Target tenant smoke metadata.
- Template-scoped `PROCESS_ACTION` and `PROCESS_EFFECT_TYPE` governance.
- The six canonical process definitions.
- Active task templates for those process definitions.
- Active process bindings for the canonical ecommerce object types.

The verification checks for six processes, required active task templates, required process bindings, required governed effects, graph action governance, graph effect governance, and human-task template references.

Railway smoke clone command:

```bash
npm run template:smoke-clone -- --source-code eip_ecom --target-code eip_ecom_smoke --target-name "EIP Ecom Smoke Clone"
```

Railway verification-only command:

```bash
npm run template:smoke-clone -- --source-code eip_ecom --target-code eip_ecom_smoke --verify-only
```

## Deferred

- Dedicated shipment/fulfilment service object and process.
- Product review and blog post processes as canonical clone requirements; they remain migration-seeded runtime capabilities for now.
- Gateway/webhook side effects for publish, payment provider calls, shipping labels, and refund provider execution.
