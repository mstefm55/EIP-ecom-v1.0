# Policies & Conditions Implementation Plan And Data Contract V1

Status: implementation plan / data contract
Date: 2026-06-08

## 1. Purpose And Non-Goals

This document translates the Business Policy & Condition Registry concept into a future implementation plan for a central `Policies & Conditions` surface and related mini-panels.

The physical V1 table remains:

```text
eip_core.commercial_condition
```

The conceptual model is:

```text
Business Policy & Condition Registry
```

The recommended UI label is:

```text
Policies & Conditions
```

This is a planning/data-contract wave only. It exists so the next implementation wave can build Phase 2 without inventing architecture.

Non-goals:

- no production backend implementation
- no React UI implementation
- no migration
- no seed change
- no new table
- no fake/demo data
- no raw legal text registry
- no final purchase order execution
- no future-version implementation or redesign of V1
- no replacement or rename of `commercial_condition` in V1

Core guardrails:

- React must not own business policy.
- Routes must remain transport/orchestration only.
- Effective policy resolution belongs backend-side in service helpers.
- Business process authority belongs to `process_def`, `process_binding`, `task_template`, task/effect governance, and the process engine.
- Commercial, trade, and business policy authority belongs to `commercial_condition` in V1.
- Raw legal/compliance text is excluded. Legal requirements can be translated into operational policy classifications and source references only.

## 2. Current Implementation Inventory

### Concept and operating docs

| Area | Evidence |
| --- | --- |
| Business Policy & Condition Registry concept | `docs/business_policy_condition_registry_v1.md` |
| `commercial_condition` reference bridge | `docs/commercial_conditions_v1.md` |
| SME ownership boundaries | `docs/sme_operating_model_v1.md` |
| Inventory policy boundary | `docs/inventory_reorder_foundation_v1.md` |
| Procurement policy boundary | `docs/procurement_foundation_v1.md` |
| Product Studio condition drawer boundary | `docs/product_studio_surface_v1.md` |
| Process engine first rule | `docs/PROCESS_ENGINE_POLICY.md` |
| Template/reseed inventory | `docs/reseed_inventory_v1.md` |
| Developer manual legacy condition notes | `docs/DEVELOPER_MANUAL.md` |
| Multi-agent governance around `commercial_condition` | `docs/orchestration/AGENT_REGISTRY_V1.md`, `docs/orchestration/AGENT_PROTOCOL_V1.md`, `docs/orchestration/ACTIVE_WORKSTREAMS_V1.md`, `docs/orchestration/AGENT_HANDOFF_TEMPLATE_V1.md` |

### Physical table

`services/api/db/migrations/0051_commercial_conditions.sql` creates:

```text
id uuid
tenant_id uuid
code text
label text
condition_type text
condition_category text
priority integer
valid_from timestamptz
valid_to timestamptz
is_active boolean
scope jsonb
effect jsonb
attrs jsonb
created_at timestamptz
updated_at timestamptz
```

Indexes:

```text
tenant_id + code unique
tenant/type/category/active/priority btree
scope jsonb GIN
effect jsonb GIN
attrs jsonb GIN
```

`services/api/db/migrations/0054_commercial_condition_patch.sql` confirms `condition_category`, `scope`, and `effect` compatibility.

### Template clone path

Commercial conditions are part of the governed clone path:

| Clone path | Evidence |
| --- | --- |
| Admin template clone copies conditions | `services/api/src/routes/admin_template_clone.js` copies `eip_core.commercial_condition` by tenant/code |
| SQL clone script copies conditions | `services/api/db/seed/clone_template_to_tenant.sql` includes section `-- 10) Commercial conditions` |
| Admin clone UI summary includes conditions | `apps/dashboard/src/components/admin/AdminTemplateClonePanel.jsx` shows `commercial_conditions` |

### Seeded/default condition families

| Source | Current values |
| --- | --- |
| Inventory policy seed | `INVENTORY_REORDER_POLICY / INVENTORY`, `SUPPLY_REORDER_CONDITION / SUPPLY`, `SUPPLIER_PURCHASE_CONDITION / PURCHASING` in `services/api/db/migrations/0110_inventory_commercial_condition_policy.sql` |
| Procurement policy seed | `PROCUREMENT_POLICY / PURCHASING`, `MATERIAL_SUPPLIER_CONDITION / PURCHASING`, `PAYMENT_TERM_CONDITION / FINANCE`, `FREIGHT_COST_CONDITION / LOGISTICS`, `CASH_PURCHASE_CONDITION / PURCHASING` in `services/api/db/migrations/0111_procurement_foundation.sql` |
| Structured field catalog | `ECOM_COMMERCIAL_CONDITION_FIELD` in `services/api/db/migrations/0120_commercial_condition_structured_fields.sql` and `services/api/src/routes/ecom.js` |
| FX sync | `FOREX_RATE / FOREX` in `services/api/src/services/fx/marketFxSync.js` |
| Legacy/developer docs | `PRICE`, `TAX`, `DISCOUNT`, `TERMS` and categories such as `base_price`, `VAT`, `installment`, `subscription` in `docs/DEVELOPER_MANUAL.md` |
| Product Studio UI defaults | `TRADE_TERMS`, `PRICE`, `DISCOUNT`, `TAX`, `PAYMENT_TERMS`, `SUPPLIER_PURCHASE_CONDITION`, `INVENTORY_REORDER_POLICY` with categories `TRADE`, `PRICING`, `MARKETPLACE`, and more in `apps/dashboard/src/components/ecom/EcomProductWorkspace.jsx` |

### Product Studio condition usage

| Capability | Evidence |
| --- | --- |
| Focus signal for missing trade conditions | `apps/dashboard/src/components/ecom/EcomProductWorkspace.jsx` uses `missing_trade_conditions` |
| Descriptor-backed labels/options | `apps/dashboard/src/engine/surfaces/dashboard.js` has `productStudio.tradeConditions` |
| Product-linked drawer calls condition routes | `apps/dashboard/src/components/ecom/EcomProductWorkspace.jsx` calls `/api/eip/ecom/commercial-condition-fields` and `/api/eip/ecom/commercial-conditions` |
| Drawer writes structured values | `apps/dashboard/src/components/ecom/EcomProductWorkspace.jsx` posts `structured_values` and creates field catalog entries |
| API lists/creates/updates product-scoped conditions | `services/api/src/routes/ecom.js` has `GET /commercial-conditions`, `POST /commercial-conditions`, `PATCH /commercial-conditions/:id` under the `/api/eip/ecom` route prefix |
| Permissions currently used | `ECOM_PRODUCT_READ` for reads; `ECOM_PRODUCT_WRITE` or `ECOM_SETTINGS_WRITE` for writes in `services/api/src/routes/ecom.js` |

### Inventory policy usage

| Capability | Evidence |
| --- | --- |
| Condition type filter | `services/api/src/services/inventory/inventoryFoundation.js` uses `INVENTORY_REORDER_POLICY`, `SUPPLY_REORDER_CONDITION`, `SUPPLIER_PURCHASE_CONDITION` |
| Category filter | `services/api/src/services/inventory/inventoryFoundation.js` uses `INVENTORY`, `SUPPLY`, `PURCHASING` |
| Resolver reads `effect` and `attrs` | `policyFromCondition()` in `services/api/src/services/inventory/inventoryFoundation.js` merges `effect.reorder_policy`, `effect.inventory_policy`, `effect.supply_policy`, root `effect`, and matching `attrs` blocks |
| Effective policy output | `resolveInventoryPolicy()` returns `policy_source`, `condition_codes`, `effective_policy`, `policy_inventory`, and `material_override_fields` |
| Route queries condition rows | `services/api/src/routes/inventory.js` selects `eip_core.commercial_condition` for inventory/material policy view |
| UI displays condition codes | `apps/dashboard/src/components/inventory/InventoryWorkspace.jsx` displays `policy_condition_codes` and `commercial_condition_governed` |
| Tests | `services/api/test/inventory_reorder_foundation.test.mjs` tests policy resolution, policy_condition_codes, route query, clone coverage |

### Procurement policy usage

| Capability | Evidence |
| --- | --- |
| Condition type filter | `services/api/src/services/procurement/procurementFoundation.js` uses `INVENTORY_REORDER_POLICY`, `SUPPLY_REORDER_CONDITION`, `SUPPLIER_PURCHASE_CONDITION`, `MATERIAL_SUPPLIER_CONDITION`, `PROCUREMENT_POLICY`, `PAYMENT_TERM_CONDITION`, `FREIGHT_COST_CONDITION`, `CASH_PURCHASE_CONDITION` |
| Category filter | `services/api/src/services/procurement/procurementFoundation.js` uses `INVENTORY`, `SUPPLY`, `PURCHASING`, `FINANCE`, `LOGISTICS` |
| Resolver reads `effect` and `attrs` | `policyFromCondition()` merges `procurement_policy`, `supplier_policy`, `payment_terms`, `cash_purchase_policy`, root `effect`, and matching `attrs` blocks |
| Effective policy output | `resolveProcurementPolicy()` returns `policy_source`, `condition_codes`, and `effective_policy` |
| Recommendation consumer | `buildProcurementRecommendation()` returns `policy_condition_codes`, `effective_policy`, `procurement_model`, supplier candidates, costs, and next process hints |
| Supplier relationship context | `services/api/src/services/procurement/procurementOperations.js` and `procurementWorkbench.js` use `object_link` relation `MATERIAL_SUPPLIER` |
| UI displays policy used | `apps/dashboard/src/components/procurement/ProcurementWorkspace.jsx` displays `Rule used`, payment terms, and raw `effective_policy` JSON |
| Tests | `services/api/test/procurement_foundation.test.mjs` tests scoped overrides/defaults and asserts route thinness around `commercial_condition` |

### Public commerce pricing/tax/discount/terms usage

| Capability | Evidence |
| --- | --- |
| Conditions loaded for public commerce | `loadConditions()` in `services/api/src/routes/public_commerce.js` selects active, valid `commercial_condition` rows |
| Category inference | `categorizeCondition()` maps raw type/category containing `PRICE`, `TAX`, `DISCOUNT`/`PROMO`, `TERM` to pricing buckets |
| Scope matching | `scopeMatches()` checks material, material type, channel, jurisdiction, currency, quantity ranges |
| Quote calculation | `computeLinePricing()` applies price, FX, discount, and tax conditions before falling back to material attrs |
| Terms output | `buildQuote()` returns matched terms conditions |
| FX support | `resolveFxRateFromConditions()` consumes `FOREX`/`FX` rows from commercial conditions |

### Object link usage related to conditions

| Relationship | Evidence | Status |
| --- | --- | --- |
| `MATERIAL_SUPPLIER` | `docs/procurement_foundation_v1.md`, `services/api/src/services/procurement/procurementOperations.js`, `procurementWorkbench.js`, `services/api/db/migrations/0111_procurement_foundation.sql` | implemented for supplier/material relationship context |
| `APPLIES_TO` | `docs/DEVELOPER_MANUAL.md` documents commercial condition links to material/agent | documented, not found in active route/service inspection |
| `JURISDICTION_SCOPE` | `docs/DEVELOPER_MANUAL.md` documents commercial condition/jurisdiction scope links | documented, not found in active route/service inspection |
| direct `commercial_condition` object_link assignment | not found in repo inspection outside docs | future plan item |

### UI descriptors

| Surface | Evidence |
| --- | --- |
| Product Studio trade condition descriptor | `apps/dashboard/src/engine/surfaces/dashboard.js`, `services/api/db/migrations/0115_command_center_product_studio_surface_polish.sql`, `0116_product_studio_focus_surface_correction.sql` |
| Inventory workspace descriptor | `apps/dashboard/src/engine/surfaces/dashboard.js`, inventory panel endpoints |
| Procurement workspace descriptor | `apps/dashboard/src/engine/surfaces/dashboard.js`, procurement panel endpoints |
| Admin template clone summary | `apps/dashboard/src/components/admin/AdminTemplateClonePanel.jsx` |
| Central `Policies & Conditions` surface | not found in repo inspection |
| Entity Definition mini-panel | not found in repo inspection |

### Permissions

Current condition management uses adjacent permissions, not dedicated policy permissions:

| Area | Current permissions |
| --- | --- |
| Product condition reads | `ECOM_PRODUCT_READ` |
| Product condition create/update | `ECOM_PRODUCT_WRITE` or `ECOM_SETTINGS_WRITE` |
| Inventory policy reads/actions | `INVENTORY_READ`, `INVENTORY_WRITE`, `INVENTORY_ADJUST`, `INVENTORY_REORDER_READ`, `INVENTORY_REORDER_WRITE`, `INVENTORY_REORDER_APPROVE` |
| Procurement policy/workbench reads/actions | `PROCUREMENT_READ`, `PROCUREMENT_WRITE`, `PROCUREMENT_REQUISITION_*`, `PROCUREMENT_RFQ_*`, `PROCUREMENT_QUOTE_REVIEW`, `PROCUREMENT_CASH_PURCHASE`, `SUPPLIER_LINK_READ`, `SUPPLIER_LINK_WRITE` |
| Template clone | admin template permissions plus step-up in `services/api/src/routes/admin_template_clone.js` |
| Dedicated `policies_conditions.*` permissions | not found in repo inspection |

### Tests found

| Test file | Coverage |
| --- | --- |
| `services/api/test/product_studio_surface_alignment.test.mjs` | governed `commercial_condition` rows, routes, structured field catalog, no visible DB jargon |
| `services/api/test/inventory_reorder_foundation.test.mjs` | inventory policy resolution, condition codes, clone coverage, route/service evidence |
| `services/api/test/procurement_foundation.test.mjs` | procurement policy resolution, scoped overrides, route thinness, clone/template coverage |

## 3. Existing Category/Type Mapping

This table maps discovered current values to the new taxonomy. It is planning only. Do not rename or delete current values in this wave.

| Current value | Current category | policy_domain | policy_family | condition_type | condition_subtype | condition_nature | Expected scope | Expected value block | Expected calculation block | Consumer surface | Migration confidence | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `INVENTORY_REORDER_POLICY` | `INVENTORY` | `INVENTORY` | `REPLENISHMENT` | `REORDER_POINT` / `REORDER_POLICY` | depends on effect fields | `INTERNAL_MANAGEMENT_POLICY` or `SYSTEM_CALCULATION_POLICY` | tenant, material, material category, site/location | qty, lead days, service level, thresholds | reorder point, safety stock, rounding, approval threshold | Inventory effective policy, Procurement bridge | HIGH | Medium if material attrs override remains ambiguous |
| `SUPPLY_REORDER_CONDITION` | `SUPPLY` | `LOGISTICS_DELIVERY` / `PROCUREMENT` | `LEAD_TIME_POLICY` / `SUPPLY_RISK` | `SUPPLY_REORDER` | lead time/risk/freight | `HYBRID_POLICY` | supplier, material, category, country | lead time, freight, risk, reliability | landed-cost and risk scoring | Inventory, Procurement | MEDIUM | Domain split needs review |
| `SUPPLIER_PURCHASE_CONDITION` | `PURCHASING` | `PROCUREMENT` / `TRADE_PARTY` | `SUPPLIER_TERMS` | `SUPPLIER_PURCHASE` | MOQ/order multiple/payment hint | `EXTERNAL_TRADE_CONDITION` | supplier, material, category | MOQ, order multiple, payment/currency | supplier option scoring | Procurement, Inventory | HIGH | May duplicate supplier link attrs if not normalized |
| `PROCUREMENT_POLICY` | `PURCHASING` | `PROCUREMENT` | `PURCHASE_REQUISITION` / `RFQ_POLICY` | `PROCUREMENT_ROUTE` | threshold/quote count/strategy | `INTERNAL_MANAGEMENT_POLICY` | tenant, business unit, material/category, process type | thresholds, quote count, strategy, currency | route recommendation and approval rule | Procurement workbench | HIGH | Route helpers must not become process authority |
| `MATERIAL_SUPPLIER_CONDITION` | `PURCHASING` | `PROCUREMENT` / `TRADE_PARTY` | `SUPPLIER_SELECTION` / `SUPPLIER_TERMS` | `MATERIAL_SUPPLIER` | supplier eligibility/relationship | `EXTERNAL_TRADE_CONDITION` or `HYBRID_POLICY` | material + supplier via `object_link` | accreditation, supplier role, supplier item code, terms | supplier scoring | Procurement, Entity Definition | HIGH | Needs object_link assignment clarity |
| `PAYMENT_TERM_CONDITION` | `FINANCE` | `TRADE_PARTY` / `FINANCE_APPROVAL` | `PAYMENT_TERMS` / `CREDIT_TERMS` | `PAYMENT_TERMS` | due days/credit limit | `EXTERNAL_TRADE_CONDITION` or `INTERNAL_FINANCIAL_POLICY` | supplier/customer/tenant/channel | due days, credit limit, credit flag | cashflow and approval checks | Product Studio, Procurement, Entity Definition | MEDIUM | Nature depends on source |
| `FREIGHT_COST_CONDITION` | `LOGISTICS` | `LOGISTICS_DELIVERY` | `FREIGHT_COST_POLICY` / `LANDED_COST` | `FREIGHT_COST` | estimate/cost basis | `EXTERNAL_TRADE_CONDITION` or `SYSTEM_CALCULATION_POLICY` | supplier, marketplace, material, route/country | freight amount/rate, currency | landed-cost calculation | Procurement, Inventory | HIGH | Needs source clarity |
| `CASH_PURCHASE_CONDITION` | `PURCHASING` | `FINANCE_APPROVAL` / `PROCUREMENT` | `CASHFLOW_CONTROL` / `DIRECT_PURCHASE` | `CASH_PURCHASE_LIMIT` | low-value buying | `INTERNAL_MANAGEMENT_POLICY` | tenant, site, category, process type | amount threshold, payment terms | route selection and approval | Procurement | HIGH | Must not enable final PO/payment execution |
| `TRADE_TERMS` | `TRADE` | `TRADE_PARTY` | `CONTRACT_VALIDITY` / `PAYMENT_TERMS` / `WARRANTY_TERMS` | NEEDS_REVIEW | NEEDS_REVIEW | `EXTERNAL_TRADE_CONDITION` | supplier/customer/marketplace/material | structured terms | none or resolver-specific | Product Studio, Entity Definition | LOW | LEGACY_AMBIGUOUS, DO_NOT_AUTO_MIGRATE blindly |
| `PAYMENT_TERMS` | `FINANCE` or `TRADE` | `TRADE_PARTY` / `FINANCE_APPROVAL` | `PAYMENT_TERMS` / `CREDIT_TERMS` | `PAYMENT_TERMS` | due days/credit terms | `EXTERNAL_TRADE_CONDITION` or `INTERNAL_FINANCIAL_POLICY` | supplier/customer/tenant | due days, credit amount/days | cashflow/approval | Product Studio, Procurement | MEDIUM | Nature source-dependent |
| `PRICE` | `PRICING` or legacy category | `SELLING` / `MARKETPLACE` | `PRICE_POLICY` | `PRICE` | base/channel/customer | `EXTERNAL_TRADE_CONDITION` or `INTERNAL_MANAGEMENT_POLICY` | product, customer, marketplace, channel, jurisdiction | unit price, currency, tier | price selection | Public commerce, Product Studio | MEDIUM | Material attrs fallback still exists |
| `DISCOUNT` | `PRICING` | `SELLING` / `MARKETPLACE` | `DISCOUNT_POLICY` | `DISCOUNT` | percent/amount/promo | `INTERNAL_MANAGEMENT_POLICY` or `EXTERNAL_TRADE_CONDITION` | product/customer/channel/qty/date | percent or amount | stacking/exclusivity | Public commerce, Product Studio | MEDIUM | Stacking rules not formalized |
| `TAX` | legacy/PRICING | `FISCAL_TAX_TREATMENT` | `TAX_CATEGORY` / `VAT_TREATMENT` | `TAX` | rate/classification | `REGULATION_DERIVED_OPERATIONAL_POLICY` | jurisdiction/product/customer/channel | rate/category | tax calculation | Public commerce | MEDIUM | Must not store raw legal text |
| `TERMS` | legacy | `TRADE_PARTY` | `CONTRACT_VALIDITY` / `PAYMENT_TERMS` | `TERMS` | text/operational term | `EXTERNAL_TRADE_CONDITION` | channel/jurisdiction/customer/supplier | structured term or safe summary | none | Public commerce terms output | LOW | LEGACY_AMBIGUOUS if free text only |
| `FOREX_RATE` | `FOREX` | `FINANCE_APPROVAL` / `MARKETPLACE` | `CURRENCY_CONVERSION` | `FOREX_RATE` | provider sync | `SYSTEM_CALCULATION_POLICY` | jurisdiction + quote currency | rate, base/quote currency | currency conversion | Public commerce quote | HIGH | Provider freshness/approval later |
| `MARKETPLACE` category | `MARKETPLACE` | `MARKETPLACE` | `CHANNEL_AVAILABILITY` / `COMMISSION` / `PUBLISHING_RULE` | NEEDS_REVIEW | NEEDS_REVIEW | `HYBRID_POLICY` | marketplace + product/category | channel policy values | channel resolver | Product Studio, Storefront | LOW | NEEDS_REVIEW |
| `base_price`, `VAT`, `installment`, `subscription` | legacy docs | `SELLING` / `FISCAL_TAX_TREATMENT` / `FINANCE_APPROVAL` | varies | NEEDS_REVIEW | NEEDS_REVIEW | NEEDS_REVIEW | product/customer/jurisdiction/order type | varies | varies | Developer manual / historical | LOW | DO_NOT_AUTO_MIGRATE |

## 4. Canonical Taxonomy V1

Policy domains:

```text
PROCUREMENT
SELLING
INVENTORY
FINANCE_APPROVAL
TRADE_PARTY
MARKETPLACE
LOGISTICS_DELIVERY
FISCAL_TAX_TREATMENT
```

Classification model:

```text
policy_domain
policy_family
condition_type
condition_subtype
condition_nature
```

Condition nature:

```text
INTERNAL_MANAGEMENT_POLICY
EXTERNAL_TRADE_CONDITION
REGULATION_DERIVED_OPERATIONAL_POLICY
SYSTEM_CALCULATION_POLICY
HYBRID_POLICY
```

Operational rule:

```text
condition_type and condition_category remain compatibility columns.
attrs.classification becomes the normalized future classification block.
scope, effect, and attrs remain the V1 flexible envelope.
```

## 5. Canonical Data Contract V1

Future read payload shape:

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "code": "PROCUREMENT_POLICY_DEFAULT",
  "label": "Default procurement policy",
  "status": "active",
  "classification": {
    "policy_domain": "PROCUREMENT",
    "policy_family": "RFQ_POLICY",
    "condition_type": "PROCUREMENT_ROUTE",
    "condition_subtype": "RFQ_THRESHOLD",
    "condition_nature": "INTERNAL_MANAGEMENT_POLICY",
    "legacy_condition_type": "PROCUREMENT_POLICY",
    "legacy_condition_category": "PURCHASING",
    "migration_status": "mapped"
  },
  "scope": {
    "scope_kind": "TENANT",
    "tenant_id": "uuid",
    "material_id": null,
    "product_id": null,
    "entity_agent_id": null,
    "supplier_agent_id": null,
    "customer_agent_id": null,
    "marketplace_agent_id": null,
    "warehouse_agent_id": null,
    "jurisdiction": null,
    "currency": "EUR",
    "process_type": null
  },
  "value": {
    "value_type": "THRESHOLD",
    "amount": 250,
    "percentage": null,
    "quantity": null,
    "unit": null,
    "currency": "EUR",
    "threshold": 250,
    "min": null,
    "max": null,
    "structured_terms": []
  },
  "calculation": {
    "formula_code": "PROCUREMENT_ROUTE_DEFAULT",
    "calculation_method": "priority_scope_merge",
    "rounding": null,
    "priority": 80,
    "stacking": "exclusive_by_family",
    "conflict_resolution": "most_specific_valid_condition_wins"
  },
  "validity": {
    "valid_from": null,
    "valid_to": null,
    "timezone": "UTC",
    "is_active": true,
    "validity_status": "currently_valid",
    "version_note": "V1 uses row update; later phases may add explicit versioning"
  },
  "governance": {
    "owner_surface": "Policies & Conditions",
    "approval_required": true,
    "edit_permission": "policies_conditions.manage",
    "source_classification": "TENANT_POLICY",
    "source_document_id": null,
    "lifecycle_status": "draft|active|expired|retired|needs_review",
    "audit_expected": true
  },
  "effects": {
    "intended_read_consumers": ["procurement", "inventory"],
    "process_implications": ["approval_task_required"],
    "warning_behavior": ["warn_if_expired"],
    "blocking_behavior": [],
    "ui_visibility": {
      "product_studio": true,
      "inventory": true,
      "procurement": true
    }
  },
  "explanation": {
    "summary": "RFQ is required above EUR 250.",
    "operational_rationale": "Tenant buying policy.",
    "regulation_derived_summary": null,
    "raw_legal_text_stored": false
  },
  "source": {
    "physical_table": "eip_core.commercial_condition",
    "legacy_source": "commercial_condition",
    "created_from": "manual_ui|migration|template_clone|fx_sync|system_seed"
  },
  "links": [],
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

Block definitions:

| Block | Purpose | V1 source |
| --- | --- | --- |
| `classification` | Normalized taxonomy plus legacy compatibility | `attrs.classification`, `condition_type`, `condition_category` |
| `scope` | Applicability dimensions | `scope`, `object_link`, selected object context |
| `value` | Operator-facing structured value summary | `effect`, `attrs.structured_values`, field catalog |
| `calculation` | How the value is calculated/resolved | `effect`, `attrs.calculation`, resolver metadata |
| `validity` | Effective dates and derived status | physical `valid_from`, `valid_to`, `is_active`; future attrs |
| `governance` | Ownership, approval, lifecycle, source | `attrs.governance`, process/task links, audit records |
| `effects` | Downstream consumers and warnings | `effect`, `attrs.effects`, resolver hints |
| `explanation` | Plain-language explanation without raw legal text | `attrs.summary`, `attrs.explanation` |
| `source` | Traceability | route/source metadata |
| `links` | Related product/material/entity/location/process | `object_link` and scope fields |

## 6. Read Model V1

### Central Policies & Conditions list

Purpose: operator-facing library of governed policies/conditions.

Source tables:

```text
eip_core.commercial_condition
eip_core.object_link
eip_core.dropdown_list / dropdown_value
eip_core.info_record for audit/history where available
eip_core.task for renewal/approval tasks where linked
```

Filters:

```text
policy_domain
policy_family
condition_type
condition_nature
status
scope_kind
linked object
validity window
warning state
text search
```

Sorting:

```text
warnings first
expiring soon
priority
most recently updated
code
```

Permissions:

```text
policies_conditions.read
```

Fields returned:

```text
id, code, label, status, classification, scope summary, effective value summary,
validity status, source, warnings, linked object labels, created_at, updated_at
```

Empty state:

```json
{
  "ok": true,
  "items": [],
  "empty_state": {
    "title": "No policies or conditions yet",
    "message": "Create governed business rules before EIP can explain recommendations for this area.",
    "next_action": "create_policy_condition"
  }
}
```

Ambiguity/conflict behavior:

- return `warnings` for overlapping active rows
- return `mapping_status: NEEDS_REVIEW` for legacy rows without clear taxonomy
- never silently auto-migrate ambiguous legacy rows

Deferred:

- explicit policy version table
- full simulator
- source-document UI

### Product-linked Policies & Conditions mini panel

Purpose: show policy/condition coverage for a product/material without turning Product Studio into the policy center.

Sources:

```text
commercial_condition filtered by scope product/material
object_link for product/material -> condition when implemented
material attrs only as legacy display fallback
ECOM_COMMERCIAL_CONDITION_FIELD catalog
```

Filters:

```text
product_id/material_id
domains SELLING, TRADE_PARTY, PROCUREMENT, INVENTORY, MARKETPLACE, FISCAL_TAX_TREATMENT
```

Fields:

```text
selling summary
supplier/procurement summary
inventory summary
marketplace summary
warnings
missing required conditions
```

Empty state:

```text
No product-linked policies. Product setup can continue, but EIP may not be able to calculate governed recommendations for this product.
```

Deferred:

- create/edit is Phase 7
- raw price fallback from material attrs must remain compatibility only

### Entity Definition partner-linked Policies & Conditions mini panel

Purpose: show supplier/customer/marketplace/warehouse policy context under the future Entity Definition surface.

Sources:

```text
eip_core.agent
eip_core.object_link
commercial_condition scope supplier_agent_id/customer_agent_id/marketplace_agent_id/warehouse_agent_id
```

Filters:

```text
entity_agent_id
entity role = supplier/customer/marketplace/warehouse/carrier
policy_domain
```

Fields:

```text
trade terms
payment/credit terms
supplier MOQ/lead time/freight
marketplace commission/channel policy
jurisdiction applicability
restriction/warning summary
```

Empty state:

```text
No partner-linked policies. Link conditions before relying on this partner for automatic recommendations.
```

Deferred:

- Entity Definition UI does not exist in current repo inspection.

### Inventory effective policy mini panel

Purpose: explain what inventory policy applies to a material/stock signal.

Sources:

```text
commercial_condition
material.attrs.inventory as current state/legacy override
inventory resolver output
service_object inventory reorder suggestion
task/process state
```

Fields:

```text
policy_source
policy_condition_codes
effective_policy
material_override_fields
calculation explanation
stock signal input
warnings
open policy link
```

Empty state:

```text
No governed inventory policy found. EIP is using material defaults or legacy attrs until a policy is linked.
```

Ambiguity:

- if multiple policies match, show condition codes and resolver explanation
- if material attrs override condition values, flag `material_override_fields`

### Procurement applicable supplier/condition mini panel

Purpose: explain why a procurement route or supplier option was recommended.

Sources:

```text
commercial_condition
object_link MATERIAL_SUPPLIER
procurement resolver output
purchase need workbench
requisition/RFQ/quote service objects
```

Fields:

```text
MOQ
order multiple
payment terms
lead time
freight / landed cost
RFQ threshold
approval threshold
minimum quote count
supplier risk
policy_condition_codes
recommended route
```

Empty state:

```text
No applicable supplier/procurement conditions. EIP can prepare a purchase need, but supplier recommendation confidence is low.
```

Deferred:

- final PO execution remains out of scope.

### Future Effective Policy Simulator

Purpose: answer "What policy applies for this object and scenario?"

Input:

```text
policy_domain
material/product
supplier/customer/marketplace
quantity
amount
currency
jurisdiction
channel
date
process_type
```

Output:

```text
effective result
applied conditions
ignored/nonmatching conditions with reasons
conflicts
warnings
recommended next action
```

Empty state:

```text
No matching policy found for this scenario.
```

## 7. API Contract V1

All routes are future contracts only. This wave does not implement them.

### GET /api/eip/policies-conditions

Purpose: central list.

Auth:

```text
EIP session required
permission: policies_conditions.read
tenant scoped
```

Query params:

```text
page
page_size
q
policy_domain
policy_family
condition_type
condition_nature
status
scope_kind
linked_kind
linked_id
validity = active | expired | future | expiring
include_legacy = true|false
```

Response:

```json
{
  "ok": true,
  "items": [],
  "page": 1,
  "page_size": 25,
  "total": 0,
  "total_pages": 0,
  "filters": {},
  "empty_state": {}
}
```

Error cases:

```text
401 unauthenticated
403 missing permission
400 invalid query
```

Transport/orchestration boundary: route loads scoped rows and calls a read-model helper. It does not decide business policy.

### GET /api/eip/policies-conditions/:id

Purpose: detail record with links and explainability.

Auth:

```text
permission: policies_conditions.read
```

Response:

```json
{
  "ok": true,
  "item": {},
  "links": [],
  "history": [],
  "warnings": []
}
```

Empty/error:

```text
404 if id not found in tenant
```

### GET /api/eip/policies-conditions/effective

Purpose: effective policy resolver endpoint.

Auth:

```text
permission: policies_conditions.read_effective
```

Query params:

```text
policy_domain
material_id/product_id
entity_agent_id
supplier_agent_id
customer_agent_id
marketplace_agent_id
warehouse_agent_id
quantity
amount
currency
jurisdiction
channel
effective_date
process_type
```

Response:

```json
{
  "ok": true,
  "effective_policy": {},
  "applied_conditions": [],
  "ignored_conditions": [],
  "conflicts": [],
  "warnings": [],
  "explanation": []
}
```

Route boundary: route validates params and calls the effective-policy service helper.

### GET /api/eip/products/:id/policies-conditions

Purpose: Product Studio mini-panel read model.

Auth:

```text
permission: policies_conditions.read or ECOM_PRODUCT_READ
```

Query params:

```text
domains
include_warnings
include_effective
```

Response:

```json
{
  "ok": true,
  "product": { "id": "uuid", "code": "SKU", "label": "Name" },
  "sections": {
    "selling": [],
    "supplier_procurement": [],
    "inventory_policy": [],
    "marketplace": [],
    "warnings": []
  },
  "empty_state": null
}
```

### GET /api/eip/entities/:id/policies-conditions

Purpose: Entity Definition mini-panel.

Auth:

```text
permission: policies_conditions.read
```

Query params:

```text
entity_role
domains
include_inactive
```

Response:

```json
{
  "ok": true,
  "entity": {},
  "sections": {
    "trade_terms": [],
    "restrictions": [],
    "approval_conditions": [],
    "jurisdictions": []
  }
}
```

### GET /api/eip/inventory/policies/effective

Purpose: effective inventory policy panel.

Auth:

```text
permission: INVENTORY_READ or policies_conditions.read_effective
```

Query params:

```text
material_id
suggestion_id
warehouse_agent_id
effective_date
```

Response:

```json
{
  "ok": true,
  "material": {},
  "policy_source": "commercial_condition|material_attrs_legacy|none",
  "policy_condition_codes": [],
  "effective_policy": {},
  "material_override_fields": [],
  "calculation_explanation": [],
  "warnings": []
}
```

### GET /api/eip/procurement/conditions/applicable

Purpose: procurement supplier/condition panel.

Auth:

```text
permission: PROCUREMENT_READ or policies_conditions.read_effective
```

Query params:

```text
purchase_need_id
material_id
supplier_agent_id
quantity
amount
currency
```

Response:

```json
{
  "ok": true,
  "purchase_need": {},
  "applicable_conditions": [],
  "supplier_options": [],
  "effective_policy": {},
  "recommended_route": {},
  "warnings": []
}
```

No endpoint should expose raw legal text, raw secrets, or unapproved internal diagnostics.

## 8. UI Descriptor Contract V1

React can render resolved policy data. React must not calculate final policy authority.

### Central Policies & Conditions descriptor

Required descriptor fields:

```json
{
  "id": "policies-conditions-workspace",
  "type": "PoliciesConditionsWorkspace",
  "props": {
    "title": "Policies & Conditions",
    "subtitle": "Business rules that explain recommendations and approvals.",
    "endpoints": {
      "overview": "/api/eip/policies-conditions/overview",
      "list": "/api/eip/policies-conditions",
      "detail": "/api/eip/policies-conditions/:id",
      "effective": "/api/eip/policies-conditions/effective"
    },
    "tabs": [
      { "id": "overview", "label": "Overview" },
      { "id": "library", "label": "Policy Library" },
      { "id": "assignments", "label": "Condition Assignments" },
      { "id": "alerts", "label": "Expiring / Missing" },
      { "id": "simulator", "label": "Effective Policy" },
      { "id": "history", "label": "Audit / History" }
    ],
    "emptyStates": {},
    "actions": {}
  }
}
```

Descriptor-owned:

- labels
- tab order
- endpoint URLs
- filter labels
- empty-state copy
- allowed renderer sections
- action labels

React primitive-owned:

- table/card rendering
- filter widgets
- drawers/modals
- loading and error layouts
- copy buttons

### Product Studio mini-panel descriptor

Product Studio should receive a descriptor block:

```json
{
  "productPolicies": {
    "title": "Product-linked Policies & Conditions",
    "sections": [
      "selling",
      "supplier_procurement",
      "inventory_policy",
      "marketplace",
      "warnings"
    ],
    "endpoint": "/api/eip/products/:id/policies-conditions"
  }
}
```

### Entity Definition mini-panel descriptor

```json
{
  "entityPolicies": {
    "title": "Partner-linked Policies & Conditions",
    "endpoint": "/api/eip/entities/:id/policies-conditions",
    "sections": ["trade_terms", "restrictions", "approval_conditions", "jurisdictions"]
  }
}
```

### Inventory Policy View descriptor

```json
{
  "inventoryPolicy": {
    "title": "Effective Inventory Policy",
    "endpoint": "/api/eip/inventory/policies/effective",
    "showConditionCodes": true,
    "showMaterialOverrides": true
  }
}
```

### Procurement supplier condition descriptor

```json
{
  "procurementConditions": {
    "title": "Applicable Supplier / Procurement Conditions",
    "endpoint": "/api/eip/procurement/conditions/applicable",
    "showSupplierOptions": true,
    "showRecommendedRoute": true,
    "poExecutionEnabled": false
  }
}
```

### Dashboard / Command Center signal contract

Policy warnings can later feed Command Center as backend-returned signals:

```text
missing policy
expired condition
conflicting policy
approval threshold missing
supplier condition expired
tax classification missing
```

The dashboard should display these signals only if returned by an API/read model. It must not invent them from React-only heuristics.

Empty/loading/error rules:

- no fake data
- production empty states only
- errors must show recovery action and permission context where safe
- unknown legacy mappings show `Needs review`, not fake taxonomy

## 9. Permissions Model

Recommended permission names:

```text
policies_conditions.read
policies_conditions.read_effective
policies_conditions.manage
policies_conditions.approve
policies_conditions.simulate
```

Proposed access boundaries:

| Permission | Capability | Example role |
| --- | --- | --- |
| `policies_conditions.read` | View central library and mini-panels | read-only users, managers |
| `policies_conditions.read_effective` | Run effective-policy read/simulation without changing data | operators, managers |
| `policies_conditions.manage` | Create/edit draft policy rows | managers, admins |
| `policies_conditions.approve` | Approve policy activation/override/retirement | approvers, owner/admin |
| `policies_conditions.simulate` | Use simulator with hypothetical scenarios | managers, admins |

Mapping to modules:

| Surface | Read | Write/manage |
| --- | --- | --- |
| Product Studio | `policies_conditions.read` or `ECOM_PRODUCT_READ` | `policies_conditions.manage` plus existing `ECOM_PRODUCT_WRITE` compatibility |
| Entity Definition | `policies_conditions.read` | `policies_conditions.manage` |
| Inventory | `INVENTORY_READ` can view effective policy; central management requires `policies_conditions.manage` |
| Procurement | `PROCUREMENT_READ` can view applicable conditions; central management requires `policies_conditions.manage` |
| Settings/Admin | admin may configure descriptor/capability; raw provider secrets stay in Connections |

V1 compatibility:

- existing Product Studio condition routes currently use `ECOM_PRODUCT_READ`, `ECOM_PRODUCT_WRITE`, `ECOM_SETTINGS_WRITE`
- do not remove existing permissions until compatibility migration is planned

## 10. Validation And Governance Rules

Future validation rules:

- `classification.policy_domain` required
- `classification.policy_family` required
- `classification.condition_type` required
- `classification.condition_nature` required
- `scope.scope_kind` required unless tenant-default policy
- value block required depending on condition type
- numeric values must validate by field catalog data type
- currency fields must be ISO-like uppercase 3-letter codes
- quantity/unit pairs must be complete where quantity is present
- percent values must define whether stored as `0.15` or `15`; recommended read model normalizes to decimal plus display percent
- `valid_from <= valid_to` when both exist
- active validity status derived from dates and `is_active`
- overlapping active policy rows in same family/scope must be flagged
- duplicate tenant/code remains blocked by existing unique index
- priority conflicts must be shown, not hidden
- jurisdiction-scoped policy must not be applied when jurisdiction is unknown unless explicitly tenant default
- regulation-derived policy must include operational summary and source reference, not raw legal text
- lifecycle status must be explicit in read model
- create/edit must write audit/security events in the implementation wave
- dropdown/schema governance must own allowed values where practical
- no hardcoded category invention in React

Governed lifecycle statuses:

```text
draft
active
scheduled
expired
needs_review
retired
blocked
```

## 11. Mini-Panel Contracts

### A. Product Studio / Material Master

Purpose:

```text
Show product/material policy coverage and missing setup signals.
```

Must include:

- product/material policy summary
- missing trade-condition focus signal
- initial inventory setup hints for physical products only
- product-specific purchase/sell/inventory rules
- marketplace/channel rules
- warnings and expired conditions

Must not include:

- operational inventory movements
- final stock movement ownership
- final procurement/PO execution
- duplicated product card data

Input:

```text
product_id or material_id
domains optional
```

Output:

```text
selling section
supplier/procurement section
inventory policy section
marketplace section
warnings
open central policy link
```

### B. Entity Definition

Purpose:

```text
Show supplier/customer/partner policy context under Entity Definition.
```

Must include:

- supplier/customer/partner policy summary
- trade terms
- restrictions
- approval conditions
- jurisdiction applicability
- object_link relationship context

Input:

```text
entity_agent_id
entity_role
```

Output:

```text
payment terms
credit terms
supplier MOQ/lead time
freight responsibility
marketplace commission
carrier/delivery rules
warnings
```

### C. Inventory

Purpose:

```text
Explain stock signal inputs and effective inventory policy.
```

Must include:

- reorder policy
- stock threshold
- reservation/release behavior where configured
- storage policy when available
- digital/rejected product exclusion status
- stock signal input only; no fake data
- policy source and condition codes

Must not include:

- supplier quote execution
- final PO lifecycle
- fake stock values

### D. Procurement

Purpose:

```text
Explain buying-route and supplier option recommendation.
```

Must include:

- applicable supplier conditions
- RFQ/quote comparison policy hints
- direct/cash route policy hints
- supplier risk/credit/freight/payment terms
- policy condition codes
- no final PO execution

Must not include:

- PO sending
- invoice matching
- accounting payment execution
- supplier outbound transmission

## 12. Effective Policy Resolution Plan

Future helper:

```text
resolveEffectivePolicy(context)
```

Input parameters:

```json
{
  "tenant_id": "uuid",
  "policy_domain": "PROCUREMENT",
  "policy_family": "RFQ_POLICY",
  "material_id": null,
  "product_id": null,
  "supplier_agent_id": null,
  "customer_agent_id": null,
  "marketplace_agent_id": null,
  "warehouse_agent_id": null,
  "jurisdiction": null,
  "channel": null,
  "quantity": null,
  "amount": null,
  "currency": "EUR",
  "effective_date": "2026-06-08",
  "process_type": null
}
```

Scope resolution order:

```text
1. Tenant default policy
2. Business unit / site policy
3. Category policy
4. Product/material policy
5. Supplier/customer/marketplace policy
6. Contract-specific condition
7. Manual override if approved
```

Precedence:

```text
valid and approved rows only
most specific scope wins unless priority says otherwise
lower priority number wins when specificity ties
newer updated_at wins only as last tiebreaker
```

Conflict rules:

- exclusive families must return one effective row and conflict warnings for other matching rows
- stackable families can merge in deterministic order
- missing required policy returns `missing_policy` warning
- invalid currency/unit returns validation warning before calculation

Fallback rules:

- existing Inventory can use material attrs as `material_attrs_legacy` fallback
- public commerce can use material attrs price fallback until price policy is normalized
- fallbacks must be labelled as fallback, not governed policy

Output:

```json
{
  "policy_source": "commercial_condition",
  "effective_policy": {},
  "condition_codes": [],
  "applied_conditions": [],
  "ignored_conditions": [
    { "code": "COND", "reason": "scope_mismatch" }
  ],
  "conflicts": [],
  "warnings": [],
  "explanation": [
    "Tenant default applied.",
    "Material-specific override changed reorder point."
  ]
}
```

Performance considerations:

- index by `tenant_id`, `condition_type`, `condition_category`, `is_active`, `priority`
- use JSONB GIN for scope/effect
- prefilter by domain/category/type before scope scoring
- paginate central list
- cache read-only field catalog and taxonomy metadata per tenant

Backend-side rationale:

```text
React cannot be the policy authority because it cannot enforce tenant isolation, RBAC,
approval status, validity, conflict resolution, audit, or process/task side effects.
```

## 13. Migration / Compatibility Plan

No migration in this wave.

Future migration path:

1. Discovery step:
   - enumerate current `condition_type`, `condition_category`, scope/effect shapes per tenant
   - identify rows created by Product Studio, inventory seeds, procurement seeds, FX sync, public commerce, and legacy imports
2. Legacy mapping step:
   - map obvious values to canonical taxonomy
   - mark ambiguous values as `NEEDS_REVIEW`
   - mark unstructured legacy rows as `LEGACY_AMBIGUOUS`
3. Compatibility read layer:
   - central read model derives classification from existing columns when `attrs.classification` is absent
   - no data rewrite required for read-only Phase 2
4. Backfill strategy:
   - only after mapping review
   - backfill `attrs.classification`
   - preserve original `condition_type` and `condition_category`
5. Ambiguous review queue:
   - surface rows where type/category/value source is unclear
6. High-risk values:
   - tax/fiscal classification
   - free-text terms
   - payment/credit terms where internal/external nature is unclear
   - price/discount stacking
7. Rollback:
   - because no table rename is planned, rollback can remove/ignore `attrs.classification` without data loss
8. Tenant safety:
   - never cross-tenant clone or read rows except through governed template clone
   - do not auto-migrate tenant-specific meaning without review

## 14. Phased Implementation Plan

### Phase 1: Implementation Plan + Data Contract

Goal: this document.

Files touched:

```text
docs/policies_conditions_implementation_plan_v1.md
```

Tests:

```text
git diff --check
```

No-go:

- any production code change
- any migration

### Phase 2: Read-only Policies & Conditions Center

Goal: central read-only list and detail.

Likely files:

```text
services/api/src/routes/policies_conditions.js
services/api/src/services/policiesConditions/readModel.js
apps/dashboard/src/components/policies/PoliciesConditionsWorkspace.jsx
apps/dashboard/src/engine/surfaces/dashboard.js
services/api/db/seed/ui_surface_dashboard.sql or a descriptor migration
services/api/test/policies_conditions_read_model.test.mjs
```

Boundaries:

- read-only
- no create/edit
- no new table unless separately approved

Tests:

- tenant isolation
- permission enforcement
- pagination
- mapping of legacy condition rows
- no raw legal text field

No-go:

- hardcoded tenant behavior
- fake condition rows

### Phase 3: Effective-policy read helper

Goal: backend service helper and read endpoint for effective policy.

Likely files:

```text
services/api/src/services/policiesConditions/effectivePolicy.js
services/api/src/routes/policies_conditions.js
services/api/test/policies_conditions_effective_policy.test.mjs
```

Boundaries:

- read and explain only
- do not replace existing inventory/procurement resolvers until tests prove parity

Tests:

- specificity
- priority
- validity
- conflict warnings
- no React-side calculation

### Phase 4: Product Studio mini panel

Goal: replace Product Studio-specific trade drawer logic with central read model where safe.

Likely files:

```text
apps/dashboard/src/components/ecom/EcomProductWorkspace.jsx
apps/dashboard/src/components/policies/ProductPoliciesPanel.jsx
services/api/test/product_studio_surface_alignment.test.mjs
```

Boundaries:

- Product Studio stays product setup owner
- operational inventory stays Inventory

### Phase 5: Entity Definition mini panel

Goal: add partner/entity condition summary once Entity Definition surface is available.

Likely files:

```text
apps/dashboard/src/components/entities/*
services/api/src/routes/entities*.js
services/api/src/services/policiesConditions/readModel.js
```

No-go:

- do not invent a parallel agent model

### Phase 6: Inventory/Procurement mini panels

Goal: use central read model while preserving existing resolver outputs.

Likely files:

```text
apps/dashboard/src/components/inventory/InventoryWorkspace.jsx
apps/dashboard/src/components/procurement/ProcurementWorkspace.jsx
services/api/src/services/inventory/inventoryFoundation.js
services/api/src/services/procurement/procurementFoundation.js
```

Boundaries:

- Inventory remains stock signal owner
- Procurement remains buying journey owner
- no final PO execution

### Phase 7: Governed create/edit modal

Goal: central create/edit lifecycle with structured classification.

Likely files:

```text
services/api/src/routes/policies_conditions.js
apps/dashboard/src/components/policies/PolicyConditionEditor.jsx
process/task definitions if approval required
```

Tests:

- validation
- CSRF
- RBAC
- audit
- duplicate prevention
- no raw legal text

No-go:

- bypassing approval workflow for policies that require approval

### Phase 8: Effective Policy Simulator

Goal: interactive simulator over backend resolver.

Likely files:

```text
apps/dashboard/src/components/policies/EffectivePolicySimulator.jsx
services/api/src/routes/policies_conditions.js
services/api/src/services/policiesConditions/effectivePolicy.js
```

Tests:

- no writes
- explainability output
- tenant isolation
- high-risk tax/credit cases

## 15. Drift Risks And Guardrails

Risks:

- React becoming business policy authority
- routes becoming policy engines
- `commercial_condition` becoming an unclassified dumping ground
- raw legal text creeping into the registry
- Product Studio becoming inventory owner
- Procurement accidentally executing final PO
- fake/demo data returning to production UI
- future-version concepts modifying V1 production without explicit plan
- Codex inventing categories/types without governed taxonomy
- tenant-specific policy behavior hardcoded in runtime
- policy values stored only in material attrs or supplier attrs instead of governed condition rows
- public commerce material-attrs price fallback being mistaken for governed price policy
- free-text `TRADE_TERMS` being treated as calculation-ready

Guardrails:

- require `attrs.classification` for new central create/edit after Phase 7
- keep legacy rows read-compatible but marked when ambiguous
- keep routes thin; service helpers resolve effective policy
- require backend read-model output before UI renders recommendations
- show condition codes and source in decision cards
- use production empty states only
- keep legal text out; store source references and operational classifications
- keep final PO execution explicitly disabled until a separate governed wave

## 16. Final Readiness Checklist For Phase 2

Before implementation starts:

- prerequisite docs merged to `main`
- taxonomy approved
- current condition mapping reviewed
- ambiguous legacy values flagged
- API contract approved
- UI descriptor contract approved
- permissions approved
- no fake data path confirmed
- migration risk understood
- security/tenant isolation boundaries preserved
- no secret or raw legal text leakage
- Product Studio / Inventory / Procurement ownership boundaries confirmed
- tests planned
- effective-policy helper shape accepted
- route ownership remains transport/orchestration only

## 17. Summary For Next Codex Wave

The Phase 2 implementation should begin with a read-only central `Policies & Conditions` workspace backed by a `commercial_condition` read model. It should not implement create/edit or migration first.

Minimum Phase 2 success criteria:

```text
Central list loads real tenant commercial_condition rows.
Rows are mapped to canonical taxonomy or marked ambiguous.
Pagination and filters work.
No fake rows are returned.
Tenant isolation and permissions are enforced.
UI labels/descriptors say Policies & Conditions.
commercial_condition remains physical V1 table.
```
