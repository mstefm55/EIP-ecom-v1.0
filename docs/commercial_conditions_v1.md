# Commercial Conditions V1

Status: governance boundary documented
Date: 2026-06-07

## Purpose

`eip_core.commercial_condition` is the V1 authority for trade and commercial policy. It is not a legal, regulatory, or compliance dumping ground.

Commercial conditions answer questions such as:

```text
What price/discount/payment term applies?
What credit term or credit limit applies?
What supplier MOQ, order multiple, or lead time applies?
What freight or landed-cost assumption applies?
When does this commercial rule start, expire, or need review?
Which product, material, supplier, customer, category, or process scope does it affect?
```

## Kernel Model

No new table is required for V1 commercial conditions.

| Capability | Kernel storage |
| --- | --- |
| Trade/commercial policy row | `eip_core.commercial_condition` |
| Calculation-ready values | `commercial_condition.effect` |
| Human/operator explanation | `commercial_condition.attrs.summary` |
| Scope | `commercial_condition.scope` |
| Validity | `valid_from`, `valid_to`, `is_active` |
| Field catalog | `dropdown_list` / `dropdown_value` code `ECOM_COMMERCIAL_CONDITION_FIELD` |

## Allowed V1 Condition Families

Allowed V1 commercial/trade concepts include:

```text
prices
discounts
marketplace price
B2B customer price
supplier price
MOQ
order multiple
lead time
payment terms
credit terms
credit limits
freight and landed-cost assumptions
RFQ thresholds
procurement model rules
supplier/customer contract term references
validity periods
renewal behavior
```

The current seeded/default families include, but are not limited to:

```text
TRADE_TERMS
PAYMENT_TERM_CONDITION
SUPPLIER_PURCHASE_CONDITION
MATERIAL_SUPPLIER_CONDITION
PROCUREMENT_POLICY
CASH_PURCHASE_CONDITION
INVENTORY_REORDER_POLICY
SUPPLY_REORDER_CONDITION
DISCOUNT
```

## Structured Values

Human summary text is useful, but it is not calculation authority. Structured values must be stored in `effect` through the governed field catalog.

Examples:

```text
credit_limit_days = 70
-> effect.payment_terms.credit_limit_days

payment_due_days = 30
-> effect.payment_terms.payment_due_days

minimum_order_qty = 12
-> effect.supplier_purchase.minimum_order_qty

approval_threshold_value = 250
-> effect.procurement_policy.approval_threshold_value

reorder_point_qty = 12
-> effect.reorder_policy.reorder_point_qty
```

Custom fields may be created through the field catalog. When no configured effect path exists, values should land under `effect.custom.<field_code>` until a resolver/process explicitly consumes them.

## Ownership Boundaries

```text
commercial_condition table
= trade/commercial policy authority

service helpers
= resolve effective policy, calculate recommendation inputs, normalize scope

routes
= session/CSRF/RBAC, request validation, tenant scoping, transaction control, response orchestration

React
= safe form/display primitive, not business policy authority
```

## Module Consumption

Inventory consumes commercial conditions for:

```text
reorder point
safety stock
lead time
service-level target
MOQ / order multiple
supplier risk and cash impact assumptions
```

Procurement consumes commercial conditions for:

```text
supplier terms
payment terms
RFQ threshold
cash/direct buying rules
quote comparison inputs
approval threshold
```

Product Studio may create product/material-scoped trade-condition rows, but Product Studio does not own operational inventory execution or procurement decision flow.

Public commerce may consume only safe public projections of commercial policy. Secrets, private contract notes, and internal approval metadata must not leak to public storefront payloads.

## Legal / Compliance Boundary

Legal, regulatory, audit, tax filing, privacy, and compliance frameworks belong in future dedicated governance models or existing document/audit primitives where applicable. They should not be stored in commercial conditions merely because they affect commerce.

Examples deferred from commercial conditions:

```text
GDPR/legal basis
regulated product compliance attestations
tax filing evidence
formal legal document lifecycle
incident/legal hold workflow
```

## UI Guidance

The UI should use plain language:

```text
Payment days
Credit limit days
Minimum order quantity
Reorder point
Approval threshold
Discount percent
Valid until
```

Avoid developer-facing labels in user UI unless they are part of a technical admin screen. The drawer/form must keep controls visible for long condition sets and must not hide Save/Close actions below the fold.

## Known Limits

```text
No full contract lifecycle management.
No legal/compliance framework in commercial_condition.
Custom structured fields affect calculations only when a resolver/process is configured to consume them.
Condition lifecycle review/renewal can be task/process governed in a later wave.
```
