# Commercial Conditions V1

Status: reference bridge
Date: 2026-06-08

`eip_core.commercial_condition` remains the physical V1 table for governed commercial conditions, business policies, and structured effect values.

The broader conceptual model is now documented in:

```text
docs/business_policy_condition_registry_v1.md
```

Recommended wording:

```text
commercial_condition table = current physical implementation
Business Policy & Condition Registry = conceptual/business architecture
Policies & Conditions = recommended UI label
```

## V1 Boundary

No table rename is required in V1. Existing Inventory, Procurement, Product Studio, public commerce, and template clone paths can continue reading and writing `eip_core.commercial_condition`.

The table is intentionally broad enough for:

- internal management policies
- external trade conditions
- regulation-derived operational classifications
- system calculation policies
- hybrid policies with human-approved overrides

It should not store raw legal or regulatory text. Store operational classifications and source-document references instead.

## Storage Guidance

Use the physical columns for compatibility:

```text
condition_type
condition_category
priority
valid_from
valid_to
is_active
scope
effect
attrs
```

Use structured JSON where future UI and process logic need clear meaning:

```text
attrs.classification
scope
effect
attrs.calculation
attrs.governance
attrs.explanation
```

Human summary text is useful for operators, but calculation-ready values belong in structured `effect` paths governed by field metadata.

## Next Implementation Wave

The next implementation wave should add or refine a central `Policies & Conditions` UI and effective-policy read model. That wave should reuse `commercial_condition`, `object_link`, dropdown metadata, process/task governance, and existing template clone support before proposing any new table.
