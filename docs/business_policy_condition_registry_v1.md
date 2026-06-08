# Business Policy & Condition Registry V1

Status: concept lock
Date: 2026-06-08

## 1. Why This Needs Rationalisation

The V1 physical table `eip_core.commercial_condition` began as a flexible place for commercial terms such as price, tax, discount, and payment terms. It has since become the natural authority for broader business rules:

- inventory reorder policy
- supplier purchase conditions
- procurement route thresholds
- payment and credit terms
- freight and landed-cost assumptions
- marketplace and selling rules
- product-linked structured condition values

That growth is healthy, but the wording is now too narrow. "Commercial condition" sounds like trade terms only, while the system is using the same governed structure for internal management policy and external trade conditions. Without a clearer architecture, future UI and process work would keep debating whether reorder policy, approval thresholds, marketplace commission, fiscal treatment, supplier MOQ, or credit terms belong in separate product, inventory, procurement, finance, or CRM screens.

The concept lock is:

```text
commercial_condition table = current physical implementation
Business Policy & Condition Registry = conceptual/business architecture
Policies & Conditions = recommended UI label
```

The registry is not a legal document store. Legal or regulatory requirements can influence operational policy classification, but raw contract clauses, statutes, legal opinions, and compliance text belong in legal documents, source-document references, or external legal systems.

## 2. Why The Physical Table Can Remain

The existing table already has V1-ready primitives:

```text
tenant_id
code
label
condition_type
condition_category
priority
valid_from / valid_to
is_active
scope jsonb
effect jsonb
attrs jsonb
```

It is tenant-scoped, indexed for JSONB scope/effect queries, and included in the canonical template clone path. Current Inventory and Procurement foundations already rely on it as the governed policy source. Product Studio structured fields already store calculation-ready values in `effect`.

For V1, the right move is not to rename the table or create parallel domain tables. The right move is to standardize the conceptual model and future UI language while preserving the working table:

```text
Business Policy & Condition Registry
-> represented in V1 by eip_core.commercial_condition
-> interpreted through classification, scope, effect, attrs, object_link, dropdown metadata, process governance
```

## 3. Recommended Labels

| Layer | Recommended label |
| --- | --- |
| Physical database table | `eip_core.commercial_condition` |
| Business architecture concept | Business Policy & Condition Registry |
| User-facing UI module | Policies & Conditions |
| Contextual mini panels | Product-linked Policies & Conditions, Effective Inventory Policy, Applicable Supplier / Procurement Conditions |

The UI should use plain language. Operators do not need to know the table is called `commercial_condition`.

## 4. Best-Practice Patterns Reviewed

This model adapts common ERP and supply-chain patterns without copying vendor UX:

- SCOR / ASCM thinking: structure business activity across Plan, Source, Make/Transform, Deliver/Fulfill, Return, and Enable, with policy and measurement supporting execution. References: [ASCM SCOR Digital Standard](https://www.ascm.org/corporate-transformation/standards-tools/scor-ds/) and [ASCM SCOR quick reference guide](https://www.ascm.org/globalassets/documents--files/corporate-transformation/scor-ds-digital-guide_final.pdf).
- SAP-style condition technique: use condition types, rules, calculation schemas, and access sequence ideas to resolve applicable price, freight, duty, tax, discount, and purchasing conditions. Reference: [SAP Help Portal, Condition Technique](https://help.sap.com/docs/SAP_ERP/16ec4da603a84f06bd1f544112c95577/db7fb65334e6b54ce10000000a174cb4.html).
- Dynamics 365 / ERP trade agreement patterns: separate base price, trade agreements, price groups, channel/customer applicability, and priority/specificity resolution. Reference: [Microsoft Dynamics 365 price management](https://learn.microsoft.com/en-us/dynamics365/commerce/price-management).
- Odoo / SME ERP patterns: use pricelists, customer/product/category applicability, discounts, and validity rules for practical SME-friendly configuration. Reference: [Odoo pricelists, discounts, and formulas](https://www.odoo.com/documentation/17.0/applications/sales/sales/products_prices/prices/pricing.html).
- Salesforce CPQ patterns: use list prices, price books, discount schedules, quote-line price waterfall, quantity/term-based discounting, and approvals for selling policy. Reference: [Salesforce CPQ discounts](https://help.salesforce.com/s/articleView?id=sales.cpq_discounts.htm&type=5).
- ASCM inventory concepts: ABC classification, safety stock, reorder point, service level, and inventory range are planning concepts, not just static reorder fields. References: [ASCM ABC/XYZ inventory classification discussion](https://www.ascm.org/ascm-insights/the-xyzs-of-inventory-management/) and [ASCM inventory basics discussion](https://www.ascm.org/ascm-insights-2/master-inventory-management-by-going-back-to-basics/).

EIP's adaptation remains:

```text
business signal
-> context
-> policy used
-> recommendation
-> governed action
-> task/process timeline
```

## 5. Policy Taxonomy

Top-level policy domains:

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

### PROCUREMENT

Procurement policies govern how buying needs become supplier action.

Examples:

```text
SUPPLIER_SELECTION
RFQ_POLICY
PURCHASE_REQUISITION
DIRECT_PURCHASE
CASH_PURCHASE
SUPPLIER_TERMS
LEAD_TIME_POLICY
FREIGHT_COST_POLICY
```

Typical questions:

- Is RFQ required?
- How many quotes are needed?
- Can direct purchase be used?
- Is cash/shop purchase allowed below a value?
- Which supplier is eligible or preferred?
- What MOQ, order multiple, lead time, payment term, freight cost, and supplier risk apply?

### SELLING

Selling policies govern price, discount, quote, return, warranty, and channel behavior.

Examples:

```text
PRICE_POLICY
DISCOUNT_POLICY
CUSTOMER_CREDIT
QUOTE_VALIDITY
RETURN_POLICY
WARRANTY_POLICY
SALES_CHANNEL_POLICY
```

Typical questions:

- What price or discount applies to this customer, product, channel, date, and quantity?
- How long is the quote valid?
- What return policy applies?
- Which sales channel is allowed?

### INVENTORY

Inventory policies govern stock holding, replenishment, service level, and control intensity.

Examples:

```text
REPLENISHMENT
SAFETY_STOCK
REORDER_POINT
ABC_CLASS_CONTROL
MAX_STOCK_VALUE
RESERVATION_POLICY
LOT_SERIAL_POLICY
STOCK_COUNT_POLICY
```

Typical questions:

- Is stock tracked?
- What review method applies?
- What safety stock, reorder point, reorder quantity, and max stock apply?
- Does ABC class require stronger control?
- Is approval required above a cash or stock-value threshold?

### FINANCE_APPROVAL

Finance and approval policies govern spend, credit, payment release, cashflow and approval thresholds.

Examples:

```text
APPROVAL_THRESHOLD
SPEND_LIMIT
CREDIT_LIMIT
PAYMENT_RELEASE
CASHFLOW_CONTROL
BUDGET_CONTROL
```

Typical questions:

- Who must approve a purchase or discount?
- What credit limit or payment term applies?
- Is payment release blocked until receipt or review?
- Does a transaction exceed budget/cash policy?

### TRADE_PARTY

Trade-party policies capture external terms linked to suppliers, customers, marketplaces, carriers, and partners.

Examples:

```text
INCOTERMS
PAYMENT_TERMS
CREDIT_TERMS
WARRANTY_TERMS
CONTRACT_VALIDITY
DELIVERY_RESPONSIBILITY
RISK_TRANSFER
```

Typical questions:

- What Incoterm, payment term, risk transfer point, warranty, or validity period applies?
- Is the trade term supplier-specific, customer-specific, contract-specific, or marketplace-specific?

### MARKETPLACE

Marketplace policies govern channel publication, commission, fulfillment, pricing, and return rules.

Examples:

```text
MARKETPLACE_PRICE
COMMISSION
PUBLISHING_RULE
CHANNEL_AVAILABILITY
FULFILLMENT_RULE
RETURN_RULE
```

Typical questions:

- Can this product be published to this marketplace?
- What commission or channel price applies?
- Who fulfills the order?
- What return rule applies to the channel?

### LOGISTICS_DELIVERY

Logistics and delivery policies govern freight, carrier, lead time, delivery window, packaging, and landed cost.

Examples:

```text
FREIGHT_METHOD
LEAD_TIME
DELIVERY_WINDOW
CARRIER_RULE
LANDED_COST
PACKAGING_REQUIREMENT
```

Typical questions:

- Which carrier or freight method applies?
- What delivery window, lead time, packaging requirement, or landed-cost rule applies?
- Should freight be included in supplier option comparison?

### FISCAL_TAX_TREATMENT

Fiscal and tax treatment policies store operational classification and calculation inputs, not raw legal text.

Examples:

```text
TAX_CATEGORY
VAT_TREATMENT
CUSTOMS_VALUE_BASIS
DUTY_TREATMENT
FISCAL_POSITION
```

Typical questions:

- Which tax category applies?
- What VAT treatment or fiscal position should operational logic use?
- Which customs value basis or duty treatment applies?

Raw tax law, legal memos, and statutory text must remain outside this registry. The registry can store an operational classification and a reference to the source document.

## 6. Classification Model

Every policy or condition should be classifiable by:

```text
policy_domain
policy_family
condition_type
condition_subtype
condition_nature
```

Example: supplier MOQ for a material:

```text
policy_domain = PROCUREMENT
policy_family = SUPPLIER_TERMS
condition_type = MOQ
condition_subtype = MINIMUM_ORDER_QUANTITY
condition_nature = EXTERNAL_TRADE_CONDITION
```

Example: service-level-based safety stock:

```text
policy_domain = INVENTORY
policy_family = REPLENISHMENT
condition_type = SAFETY_STOCK
condition_subtype = SERVICE_LEVEL_BASED
condition_nature = INTERNAL_MANAGEMENT_POLICY
```

Example: purchase value approval threshold:

```text
policy_domain = FINANCE_APPROVAL
policy_family = SPEND_CONTROL
condition_type = APPROVAL_THRESHOLD
condition_subtype = PURCHASE_VALUE_LIMIT
condition_nature = INTERNAL_FINANCIAL_POLICY
```

Condition nature values should include:

```text
INTERNAL_MANAGEMENT_POLICY
EXTERNAL_TRADE_CONDITION
REGULATION_DERIVED_OPERATIONAL_POLICY
SYSTEM_CALCULATION_POLICY
HYBRID_POLICY
```

V1 can store this classification in `attrs.classification` while preserving the existing `condition_type` and `condition_category` columns for compatibility.

## 7. Internal Policy Vs External Trade Condition

Internal policies are management controls chosen by the tenant.

Examples:

```text
max inventory value
approval thresholds
preferred replenishment method
maximum days of stock
stockout tolerance
ABC control level
RFQ required above amount
cash purchase allowed below amount
```

External trade conditions come from external relationships, contracts, marketplaces, supplier terms, customer terms, or market rules.

Examples:

```text
supplier MOQ
supplier price
supplier lead time
payment terms
credit terms
Incoterms
warranty
marketplace commission
customer-specific discount
contract price
freight responsibility
```

Both can live in `eip_core.commercial_condition` when properly classified. The distinction matters because an internal policy can usually be changed by management approval, while an external trade condition may require supplier/customer/marketplace renegotiation or source-document evidence.

## 8. Scope Model

A policy or condition must define where it applies. Potential scope dimensions:

```text
TENANT
BUSINESS_UNIT
SITE
MARKETPLACE
CUSTOMER
CUSTOMER_GROUP
SUPPLIER
SUPPLIER_GROUP
MATERIAL
MATERIAL_CATEGORY
PRODUCT
PRODUCT_CATEGORY
WAREHOUSE
LOCATION
COUNTRY
JURISDICTION
CURRENCY
ORDER_TYPE
PROCESS_TYPE
```

Examples:

Supplier MOQ for Oak Board:

```json
{
  "scope_kind": "SUPPLIER_MATERIAL",
  "supplier_agent_id": "supplier-id",
  "material_id": "material-id",
  "currency": "EUR"
}
```

Maximum inventory value for A-class raw materials:

```json
{
  "scope_kind": "MATERIAL_CATEGORY",
  "material_category": "RAW_MATERIAL_A_CLASS",
  "currency": "EUR"
}
```

Marketplace commission for digital patterns:

```json
{
  "scope_kind": "MARKETPLACE_PRODUCT_CATEGORY",
  "marketplace_agent_id": "marketplace-id",
  "product_category": "Digital Patterns",
  "currency": "EUR"
}
```

## 9. Linking And Assignment Model

Recommended architecture:

```text
condition definition
-> condition assignment / applicability
-> linked business object
```

For V1, avoid a new table unless later evidence proves it is necessary. The existing kernel can support assignment using:

```text
commercial_condition
object_link
attrs
```

Example:

```text
commercial_condition:
COND-000241 = Supplier MOQ policy

object_link:
material Oak Board -> condition COND-000241
supplier Wood Supplier A -> condition COND-000241
```

This avoids duplicating the same condition across Product Studio, Entity Definition, Inventory, and Procurement. Contextual screens should show and link conditions, not become the condition authority.

## 10. Static, Calculated, And Hybrid Values

Value modes:

```text
FIXED
CALCULATED
HYBRID
MANUAL_OVERRIDE
SYSTEM_RECOMMENDED
APPROVED_EFFECTIVE
```

Examples:

- Supplier MOQ can be fixed.
- Reorder quantity can be calculated.
- Procurement recommendation can be hybrid.
- A manager can approve an override.

Example calculation:

```text
supplier specified MOQ = 100 units
order multiple = 25 units
freight break = 500 kg
financial max order value = EUR 2,000
inventory target stock = 30 days
forecast demand = 8 units/day
current stock = 40 units
system proposed quantity = 175 units
rounded quantity = 200 units
approval required depending on financial policy
```

The free-text summary is explanatory only. Calculation-ready values should live in structured `effect` paths, governed by the field catalog where available.

## 11. Inventory Policy Calculation Model

Inventory policy is not just a static reorder quantity. It may include:

```text
reorder_method
review_method = CONTINUOUS | PERIODIC | MANUAL
service_level_target
safety_stock_method
lead_time_source
forecast_source
ABC_class
min_stock
max_stock
max_inventory_value
order_multiple
rounding_rule
stockout_tolerance
approval_required_above_value
```

Common inventory concepts:

```text
reorder point = demand during lead time + safety stock
safety stock depends on demand variability, supply variability, lead time, and service-level target
ABC classification drives different control intensity
```

EIP interpretation:

```text
stock signal
-> policy resolution
-> recommendation
-> purchase need
-> procurement process
```

Inventory surfaces should show the effective policy, source, calculated recommendation, and why the system recommends action. They should not become the central policy maintenance UI.

## 12. Procurement Policy Model

Procurement uses the registry to answer:

```text
what buying route applies?
which suppliers are eligible?
how many quotes are needed?
which supplier option is preferred?
which costs and risks matter?
what approval is required?
```

Typical effect paths:

```text
procurement_policy.procurement_model
procurement_policy.rfq_threshold_value
procurement_policy.direct_purchase_threshold_value
procurement_policy.minimum_quote_count
procurement_policy.approval_required
procurement_policy.approval_threshold_value
supplier_purchase.minimum_order_qty
supplier_purchase.order_multiple
supplier_policy.freight_cost_estimate
payment_terms.payment_terms_code
```

Procurement remains journey-first:

```text
purchase need
-> supplier options
-> procurement route
-> requisition / RFQ / quote comparison / cash receipt path
-> governed action
-> timeline
```

## 13. Selling Policy Model

Selling uses the registry to answer:

```text
what price applies?
what discount applies?
what customer-specific term applies?
what quote validity applies?
what return or warranty rule applies?
what channel policy applies?
```

Typical effect paths:

```text
selling.price_policy.base_price_source
selling.discount.percent
selling.discount.amount
selling.quote.validity_days
selling.return_policy.return_window_days
selling.warranty_policy.duration_days
customer_credit.credit_limit_amount
customer_credit.credit_limit_days
```

Product card data belongs to Product Studio. Selling policy belongs to the registry.

## 14. Financial And Approval Policy Model

Financial and approval policy should support:

```text
approval threshold
spend limit
credit limit
payment release
cashflow control
budget control
```

Typical questions:

- Does this purchase, refund, discount, credit, or cash action need approval?
- Is this user allowed to approve it?
- Does the current amount exceed policy?
- Does payment release depend on receipt, evidence, or reconciliation?

Approval policy should be resolved before the process engine creates or advances approval tasks. The policy determines the business requirement; the process engine governs the action.

## 15. Trade Party Policy Model

Trade-party policies belong with suppliers, customers, marketplaces, carriers, partners, and internal entities.

Examples:

```text
supplier terms
customer credit terms
payment terms
warranty terms
Incoterms
delivery responsibility
risk transfer
contract validity
```

The UI label for the broader entity workspace should be `Entity Definition`, even if the backend uses `agent`. Entity Definition can cover:

```text
internal organization entities
external partners
suppliers
customers
marketplaces
warehouses
storage zones
racks
bins
carriers
employees/contacts
```

## 16. Marketplace Policy Model

Marketplace policies govern external channel behavior:

```text
marketplace price
commission
publishing rule
channel availability
fulfillment rule
return rule
```

Marketplace policy can affect:

- public storefront payload eligibility
- product publication readiness
- price and discount shown by channel
- commission or cash forecast
- return/refund rules
- fulfillment route

Marketplace policy should be scoped to marketplace, connection, product/category, country, and date where needed.

## 17. Logistics And Delivery Policy Model

Logistics and delivery policies cover:

```text
freight method
lead time
delivery window
carrier rule
landed cost
packaging requirement
```

These policies can feed procurement supplier comparison, sales delivery promise, order fulfillment, landed-cost estimate, and inventory lead-time calculation. Freight cost should not be buried only in supplier attrs; it should be visible as an applicable condition or policy source.

## 18. Fiscal And Tax Treatment Policy Model

Fiscal and tax treatment policy stores operational classification:

```text
tax category
VAT treatment
customs value basis
duty treatment
fiscal position
```

It must not store raw legal text. Use source-document references for legal evidence:

```json
{
  "governance": {
    "source": "TAX_ADVISOR_CLASSIFICATION",
    "source_document_id": "document-id",
    "approved_by": "agent-id"
  }
}
```

## 19. Structured JSONB Attrs Model

Recommended `attrs` and `effect` shape for `commercial_condition`:

```json
{
  "classification": {
    "policy_domain": "PROCUREMENT",
    "policy_family": "SUPPLIER_TERMS",
    "condition_type": "MOQ",
    "condition_subtype": "MINIMUM_ORDER_QUANTITY",
    "condition_nature": "EXTERNAL_TRADE_CONDITION"
  },
  "scope": {
    "scope_kind": "SUPPLIER_MATERIAL",
    "supplier_agent_id": null,
    "material_id": null,
    "marketplace_agent_id": null,
    "customer_agent_id": null,
    "jurisdiction": null,
    "currency": "EUR"
  },
  "value": {
    "value_mode": "FIXED",
    "quantity": 100,
    "uom": "PCS",
    "money_amount": null,
    "currency": "EUR",
    "percentage": null
  },
  "calculation": {
    "calculation_mode": "NONE",
    "method": null,
    "inputs": [],
    "last_system_proposal": null,
    "approved_effective_value": 100
  },
  "validity": {
    "valid_from": "2026-01-01",
    "valid_to": "2026-12-31",
    "renewal_notice_days": 30
  },
  "governance": {
    "approval_required": true,
    "approved_by": null,
    "approval_task_id": null,
    "source": "SUPPLIER_CONTRACT",
    "source_document_id": null
  },
  "effects": {
    "affects": ["PROCUREMENT_RECOMMENDATION", "REORDER_CALCULATION"],
    "blocks_process_if_missing": false,
    "warning_if_expired": true
  },
  "explanation": {
    "summary": "Supplier requires minimum order quantity of 100 PCS for this material.",
    "business_reason": "Contractual supplier term."
  }
}
```

Recommended storage split in V1:

| Block | V1 storage |
| --- | --- |
| classification | `attrs.classification` plus compatible `condition_type` / `condition_category` |
| scope | `scope` column, optionally mirrored in `attrs.scope_summary` |
| value | `effect` for machine-readable values, `attrs.value` for UI metadata |
| calculation | `attrs.calculation` and process/resolver snapshots |
| validity | physical columns plus `attrs.validity` for renewal detail |
| governance | `attrs.governance` plus process/task links |
| effects | `effect` and `attrs.effects` |
| explanation | `attrs.explanation` |

## 20. Rule Resolution Algorithm

Recommended resolution order:

```text
1. Tenant default policy
2. Business unit / site policy
3. Category policy
4. Product/material policy
5. Supplier/customer/marketplace policy
6. Contract-specific condition
7. Manual override if approved
```

Conflict rule:

```text
Most specific valid condition wins unless priority explicitly says otherwise.
```

Evaluation must consider:

```text
tenant_id
validity
status / is_active
approval state
priority
specificity
scope match
effective date
condition_nature
currency / jurisdiction / channel
manual override approval
```

Pseudo-flow:

```text
load active tenant conditions for candidate domains/types
filter by validity and approval state
score each condition for scope specificity
sort by explicit priority, specificity, and effective date
merge compatible conditions by domain/family
flag conflicts and missing required policies
return effective policy, condition codes, explanation, warnings
```

## 21. Central UI Structure Recommendation

Recommended UI label:

```text
Policies & Conditions
```

Main sections:

```text
Overview
Policy Library
Condition Assignments
Expiring / Missing Conditions
Simulation / Effective Policy
Audit / History
```

Overview should answer:

```text
What policy is missing?
What condition is expiring?
What rule is blocking automation?
What policy creates financial risk?
Which policies affect procurement/inventory/sales?
```

Policy Library should show:

```text
Policy code
Domain
Family
Type
Scope
Status
Validity
Linked parties/objects
Effective value
Owner
```

Condition Assignments should show:

```text
Condition -> product/material
Condition -> supplier
Condition -> customer
Condition -> marketplace
Condition -> warehouse/location
Condition -> process
```

Simulation / Effective Policy should answer:

```text
For this material, supplier, customer, marketplace, location, order quantity and date:
what policy applies?
```

It should show:

```text
base policy
supplier condition
customer/marketplace condition
inventory policy
financial approval policy
effective result
reasoning
```

This is critical for SME usability. The owner should not inspect raw condition rows; EIP should explain which policy applies and what action it recommends.

## 22. Contextual Mini UI Panels

Contextual panels must not become the full policy maintenance UI. They should show the effective policy for the current object and provide links into Policies & Conditions.

### Product Studio / Material Master

Panel label:

```text
Product-linked Policies & Conditions
```

Tabs:

```text
Selling
Supplier / Procurement
Inventory Policy
Marketplace
Warnings
```

Actions:

```text
Link existing condition
Create condition from template
Open full Policies & Conditions center
View effective policy
```

### Entity Definition

Use UI label:

```text
Entity Definition
```

Entity Definition covers:

```text
internal organization entities
external partners
suppliers
customers
marketplaces
warehouses
storage zones
racks
bins
carriers
employees/contacts
```

Supplier-linked panels:

```text
supplier prices
MOQ
lead time
payment terms
Incoterms
freight terms
RFQ rules
preferred supplier/accreditation
```

Customer-linked panels:

```text
customer price
discount
credit terms
payment terms
warranty
return rules
marketplace/channel terms
```

### Inventory

Panel label:

```text
Effective Inventory Policy
```

Shows:

```text
reorder method
safety stock
lead time
ABC class
max inventory value
effective reorder quantity
policy source
calculation explanation
```

Action:

```text
Open policy in Policies & Conditions
```

### Procurement

Panel label:

```text
Applicable Supplier / Procurement Conditions
```

Shows:

```text
supplier terms
MOQ
order multiple
payment terms
lead time
freight/landed cost
RFQ threshold
approval threshold
```

Procurement should show the policy used for the buying recommendation. It should not become the full policy maintenance UI.

## 23. Entity Definition And Inventory Location Planning

Inventory location and storage should be planned under Entity Definition / operational structure.

Storage hierarchy:

```text
Company
-> Site
-> Warehouse
-> Zone
-> Rack
-> Bin
```

Technical backend may use `agent`, but UI should use "Entity Definition" for clarity.

Inventory transaction model should later support:

```text
transaction_type = IN | OUT | TRANSFER | ADJUSTMENT | COUNT_CORRECTION | RESERVATION | RELEASE | SCRAP
from_location_id
to_location_id
material_id
lot_id
serial_id
quantity
uom
source_process_id
source_document_id
created_by
timestamp
```

This is planning only. No implementation is included in this wave.

## 24. V1 Implementation Boundary

This concept lock does not implement code, UI, migrations, or table renames.

V1 should:

- keep `eip_core.commercial_condition` as the physical table
- keep `scope`, `effect`, and `attrs` as the flexible structured envelope
- use dropdown metadata for structured effect fields
- use `object_link` for assignments where practical
- use process/task governance for approval, renewal, override, and publish-like changes
- expose contextual mini panels in Product Studio, Inventory, Procurement, Entity Definition, and Settings only as views into the registry
- avoid a parallel policy table until evidence shows the existing kernel cannot support a needed integrity rule

V1 should not:

- rename `commercial_condition`
- create separate tables for every policy domain
- store raw legal/regulatory text in this registry
- bury policy only in React, route logic, product attrs, material attrs, or supplier attrs
- let contextual screens become independent policy authorities

## 25. V2 Improvement Path

Later improvements can be evaluated after V1 proves the registry in production:

- dedicated condition assignment table if `object_link` plus `scope` becomes too ambiguous
- stricter typed policy schemas by domain/family/type
- explicit resolution engine with explainability traces
- policy simulation sandbox
- policy lifecycle workflow with approval, renewal, supersession, and retirement
- policy versioning and effective-dated audit
- stronger source-document linking
- richer UI descriptor support for tenant-specific policy fields
- governance dashboards for missing, expired, conflicting, risky, or unapproved policies

These are not required in this docs-only V1 lock.

## 26. Current Category Mapping

Rationalisation guidance for current categories:

| Current category / language | Rationalised domain |
| --- | --- |
| trade area | `TRADE_PARTY` / `LOGISTICS_DELIVERY` / `MARKETPLACE` |
| pricing | `SELLING` / `TRADE_PARTY` / `MARKETPLACE` |
| marketplace | `MARKETPLACE` |
| customer | `SELLING` / `TRADE_PARTY` |
| inventory | `INVENTORY` |
| supplier purchase | `PROCUREMENT` / `TRADE_PARTY` |
| tax | `FISCAL_TAX_TREATMENT` |
| discount | `SELLING` / `MARKETPLACE` / customer-specific selling policy |

This is not an immediate migration. Existing rows can remain compatible while future create/edit UI starts writing `attrs.classification`.

## 27. Migration And Rationalisation Plan

Recommended non-disruptive plan:

1. Keep all current rows and table names.
2. Add documentation and UI labels first.
3. Normalize future create/edit UI to ask for domain, family, type, subtype, nature, scope, value mode, validity, and effect path.
4. Add a read-only classifier for existing rows:
   - `condition_category='INVENTORY'` -> `policy_domain='INVENTORY'`
   - `condition_category='PURCHASING'` -> `policy_domain='PROCUREMENT'`
   - `condition_category='FINANCE'` -> `policy_domain='FINANCE_APPROVAL'` or `TRADE_PARTY` depending on family
   - `condition_category='LOGISTICS'` -> `policy_domain='LOGISTICS_DELIVERY'`
   - `condition_category='PRICING'` -> `policy_domain='SELLING'`
5. Backfill `attrs.classification` only after a reviewed migration plan.
6. Update contextual panels to show `Policies & Conditions` wording.
7. Add simulation/read-composition endpoints after the central UI plan is accepted.
8. Keep process/task/effect governance as the authority for approvals and actions.

## 28. Architecture Summary

The registry should make EIP feel like a business assistant:

```text
signal: stock risk, customer quote, supplier quote, order issue, payment risk
context: product/material, supplier/customer, marketplace, site, date, amount, quantity
policy used: effective registry rows and condition codes
recommendation: reorder, RFQ, approve, reject, hold, discount, warn, renew
governed action: process transition, task, effect
timeline: evidence and audit trail
```

The registry gives the engine a single governed place to explain why it recommends an action. It keeps V1 tenant-agnostic because future tenants can change policies without React forks or route-owned business rules.
