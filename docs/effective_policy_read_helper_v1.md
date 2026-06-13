# Effective Policy Read Helper v1

Status: Phase 3 production documentation

Owner surface: Policies & Conditions

Physical source: `eip_core.commercial_condition`

## Purpose

The effective-policy read helper answers which tenant-scoped policy or condition applies to a business context and explains why. It is read-only and explain-only. It does not create, update, approve, activate, retire, delete, deploy, backfill, or migrate policy rows.

The helper runs beside the existing Inventory, Procurement, Product Studio, and public commerce resolvers. Those legacy resolvers remain the operational authorities for their current workflows until a future parity-tested delegation is approved.

## Endpoint

```text
GET /api/eip/policies-conditions/effective
```

The route authenticates an EIP session, requires `policies_conditions.read_effective`, validates query parameters, passes the session tenant id to the service helper, and returns sanitized read-model summaries.

`tenant_id` is never accepted from the HTTP client and is not returned in the response.

## Input Contract

External request query parameters describe the business context. All fields are optional, but a narrow context produces clearer results.

```json
{
  "policy_domain": "INVENTORY",
  "policy_family": "REPLENISHMENT",
  "condition_type": "REORDER_POLICY",
  "condition_subtype": "FOB",
  "material_id": "00000000-0000-0000-0000-000000000001",
  "product_id": "00000000-0000-0000-0000-000000000002",
  "supplier_agent_id": "00000000-0000-0000-0000-000000000003",
  "customer_agent_id": "00000000-0000-0000-0000-000000000004",
  "marketplace_agent_id": "00000000-0000-0000-0000-000000000005",
  "warehouse_agent_id": "00000000-0000-0000-0000-000000000006",
  "jurisdiction": "MU",
  "channel": "B2B",
  "quantity": 100,
  "amount": 2500,
  "currency": "EUR",
  "effective_at": "2026-06-13T00:00:00.000Z",
  "process_type": "PURCHASE_REQUISITION",
  "process_id": "00000000-0000-0000-0000-000000000007",
  "task_type": "REORDER_REVIEW",
  "task_id": "00000000-0000-0000-0000-000000000008"
}
```

## Validation

- Reject client-supplied `tenant_id`.
- Validate UUID fields before database access.
- Normalize taxonomy and scope codes to uppercase safe codes where practical.
- Require ISO-like 3-letter uppercase currency when currency is present.
- Require finite numeric `quantity` and `amount`; negative values are invalid unless a future domain explicitly allows them.
- Require `effective_at` to parse as a date; default to the request date in UTC when omitted.
- Reject unknown or unsafe query keys instead of passing arbitrary JSON into scope matching.
- Return `400` for validation errors, `403` for missing permission, and `200` with warnings for valid contexts where no policy applies.

## Tenant Safety

Every database read must include the session tenant id. Scope matching, ignored-condition reporting, warning generation, and explanation text must be computed only from rows in that tenant.

The helper must not:

- look up another tenant by code, slug, or supplied UUID
- merge template-tenant rows at runtime unless a future explicit clone/inheritance design approves it
- cache results under keys that omit tenant id
- expose condition codes, labels, source references, or warnings from another tenant

## Precedence

The helper reads only rows from the authenticated tenant in `eip_core.commercial_condition`. It then considers only rows that are active, valid at `effective_at`, classification-compatible, scope-compatible, and not blocked by currency mismatch.

Precedence is deterministic:

1. Active and valid rows only.
2. Matching canonical domain, family, type, and subtype when requested.
3. Most specific matching scope wins.
4. Lower priority number wins when specificity ties.
5. Newer `updated_at` wins as the final deterministic tiebreaker.

## Scope Specificity

Specificity is based on matched scope dimensions, not on label length or row age. It considers tenant default, jurisdiction, marketplace or channel, warehouse or storage, supplier, customer, party, product or material, process, task, quantity, amount, and currency context.

A scoped row only matches when all scoped dimensions are satisfied. If the row is scoped to `supplier_agent_id` and the request has a different or missing supplier, the row is excluded with a scope reason. Unknown jurisdiction, channel, currency, or unit does not silently satisfy a jurisdiction-, channel-, currency-, or unit-specific condition.

## Stacking And Conflicts

Rows default to `exclusive`. If `attrs.resolution_mode` is `stackable`, compatible stackable rows are returned together in `applicable_conditions`.

Conflicts are returned when exclusive rows have equal authority, required scope context is missing, currency requirements conflict, classification is ambiguous, or a custom domain is requested without enough family or type context.

Ambiguous legacy rows are not silently treated as authoritative. If clear candidates exist, ambiguous candidates are excluded with `ambiguous_classification`. If only ambiguous candidates match, the response status is `needs_review`.

## Output Shape

Successful responses use the Phase 3 contract:

```json
{
  "ok": true,
  "resolution_status": "resolved",
  "requested_context": {},
  "selected_condition": null,
  "applicable_conditions": [],
  "excluded_conditions": [],
  "conflicts": [],
  "warnings": [],
  "fallback_used": false,
  "precedence_trace": [],
  "explanation": [],
  "validity": {},
  "source": {
    "physical_table": "eip_core.commercial_condition"
  },
  "mapping_status": "mapped"
}
```

Allowed `resolution_status` values are `resolved`, `no_match`, `conflict`, `needs_review`, and `invalid_context`. Validation failures use HTTP `400` with `INVALID_EFFECTIVE_POLICY_CONTEXT`.

Excluded-condition reasons are `domain_mismatch`, `family_mismatch`, `type_mismatch`, `subtype_mismatch`, `inactive`, `not_yet_valid`, `expired`, `scope_mismatch`, `lower_specificity`, `lower_priority`, `ambiguous_classification`, `conflicting_currency`, and `missing_context`.

## Security Redaction

The response never dumps raw `scope`, `effect`, or `attrs`. It returns condition ids, codes, labels, classification, safe scope summaries, safe value summaries, validity, priority, source, warnings, conflicts, and business-readable explanations.

Sensitive keys and values such as secrets, tokens, passwords, credentials, cookies, authorization headers, signatures, API keys, private keys, client secrets, raw legal text, and raw compliance text are not exposed.

## Legacy Compatibility

The physical authority remains `eip_core.commercial_condition`. The helper reads current rows and uses the Phase 2 read-model classification rules:

- `attrs.classification` when present
- legacy `condition_type` and `condition_category`
- compatibility mapping for known values
- `NEEDS_REVIEW` and warnings for ambiguous legacy values

Existing Inventory and Procurement resolvers remain valid until parity tests prove they can delegate to this helper. Existing fallbacks, such as material attrs or public commerce price data, may be returned only as labelled fallback sources, not as governed policy.

No compatibility behavior may rewrite legacy rows, invent placeholder conditions, or move tenant-specific business rules into React.

## Non-Goals

- No create, update, delete, approval, retirement, or migration behavior.
- No replacement of Inventory or Procurement policy resolvers without parity tests.
- No React-side final policy calculation.
- No cross-tenant inheritance or template fallback at runtime.
- No raw legal, regulatory, compliance, or secret material in responses.
- No process/task side effects, outbound calls, purchase order execution, invoice matching, or accounting payment execution.
- No tenant-specific hardcoding.
