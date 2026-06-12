# Policies & Conditions Business Lexicon v1

Status: Phase 2 read-only extension

Owner surface: Policies & Conditions

Physical source: `eip_core.commercial_condition`

This lexicon defines the default business taxonomy used by the read-only Policies & Conditions center. It does not create a new policy table, does not rewrite released `commercial_condition` rows, and does not change the Phase 2 read-only release. The taxonomy is deliberately governed but extensible: tenants may add custom domains, families, condition types, and condition subtypes through the shared dropdown infrastructure when future write workflows are approved.

## Default Domains

| Code | Label | Boundary |
| --- | --- | --- |
| `COMMERCIAL` | Commercial | Buying, selling, payment, price, discount, credit, settlement, Incoterms, and trading-party commercial conditions. |
| `FINANCIAL` | Financial | Internal cash, liquidity, debt, capital structure, financial ratio, investment, and borrowing policy. |
| `APPROVAL_FRAMEWORK` | Approval Framework | Approval thresholds, approval matrices, delegation of authority, and purchasing, expenditure, discount, borrowing, or investment approvals. |
| `INVENTORY` | Inventory | Reorder, safety stock, threshold, reservation, release, and storage policy. |
| `FISCAL_TAX_TREATMENT` | Fiscal & Tax Treatment | VAT, sales tax, tax classification, exemption, withholding, and fiscal jurisdiction treatment. |
| `MARKETPLACE` | Marketplace | Marketplace commissions, platform eligibility, channel pricing, channel conditions, and publication rules. |
| `LOGISTICS` | Logistics | Carrier selection, routing, dispatch, warehouse handling, delivery execution, transport rules, and operational lead-time rules. |

These seven values are defaults, not a closed enum. Read paths preserve tenant custom domains and show old ambiguous values as reviewable when they cannot be canonicalized safely.

## Taxonomy Levels

The dropdown-backed taxonomy uses four governed lists:

| List code | Meaning | Default seeding |
| --- | --- | --- |
| `POLICY_DOMAIN` | Top-level domain used for filtering, summaries, and executive grouping. | Seven defaults seeded in migration `0122`. |
| `POLICY_FAMILY` | Business family inside a domain, for example `PAYMENT_TERMS` or `REPLENISHMENT`. | List is created but values are tenant-extensible. |
| `POLICY_CONDITION_TYPE` | Normalized condition type, for example `INCOTERM`, `PRICE`, or `FINANCIAL_RATIO`. | List is created but values are tenant-extensible. |
| `POLICY_CONDITION_SUBTYPE` | Optional subtype, for example an Incoterms rule code. | List is created but values are tenant-extensible. |

The read model returns canonical taxonomy fields while preserving the original legacy fields:

- `legacy.condition_type`
- `legacy.condition_category`
- `legacy.attrs_classification`
- `classification.policy_domain`
- `classification.policy_family`
- `classification.condition_type`
- `classification.condition_subtype`
- `classification.condition_nature`
- `classification.mapping_status`
- `classification.mapping_source`

## Commercial Domain

Commercial covers trade terms between parties, including:

- Prices and price rules.
- Discounts and commercial concessions.
- Payment terms and settlement terms.
- Trade credit when expressed as trading-party terms.
- Supplier/customer commercial terms.
- Incoterms.

Legacy `SELLING`, `PROCUREMENT`, and `TRADE_PARTY` domain labels canonicalize to `COMMERCIAL` in the read layer. The physical row remains unchanged.

## Incoterms Placement

Incoterms belong under Commercial:

- `policy_domain`: `COMMERCIAL`
- `policy_family`: `INCOTERMS`
- `condition_type`: `INCOTERM`
- `condition_subtype`: one of `EXW`, `FCA`, `CPT`, `CIP`, `DAP`, `DPU`, `DDP`, `FAS`, `FOB`, `CFR`, `CIF`

Logistics consumes Incoterms obligations, for example shipment handoff, freight, insurance, customs, and delivery execution, but Logistics does not own the Incoterm classification. This preserves the commercial/legal nature of the sale term while still allowing operational processes to use the obligation data.

## Financial Domain

Financial covers internal financial management policy:

- Cash policy.
- Liquidity policy.
- Debt limits.
- Capital structure.
- Financial ratios.
- Investment policy.
- Borrowing policy.

Legacy `FINANCE_APPROVAL` rows are not blindly mapped to Financial. They are mapped by meaning:

- Commercial when the condition is about payment terms, trade terms, price, discount, trade credit, settlement terms, or Incoterms.
- Financial when the condition is about cash, liquidity, debt, capital structure, ratios, investment, or borrowing.
- Approval Framework when the condition is about approval matrices, delegation, expenditure approval, purchase approval, discount approval, or financial approval authority.
- `NEEDS_REVIEW` when the legacy value is ambiguous.

## Approval Framework Domain

Approval Framework covers authority, limits, and workflow policy. It is distinct from Financial because an approval threshold for spending or borrowing is about decision rights, even when the object being approved has financial impact.

Examples:

- Purchase approval.
- Expenditure approval.
- Discount approval.
- Financial approval.
- Approval matrix.
- Delegation of authority.

## Inventory Domain

Inventory covers stock policy and material availability controls:

- Reorder point and reorder quantity.
- Safety stock.
- Stock reservation and release.
- Storage policy.
- Stock threshold and alert policy.

Inventory remains separate from Procurement. A reorder policy can trigger procurement work, but the stock policy itself is inventory governance.

## Fiscal & Tax Treatment Domain

Fiscal & Tax Treatment covers regulatory or fiscal classification:

- VAT and sales tax treatment.
- Withholding.
- Tax exemptions.
- Fiscal jurisdiction.
- Tax category and tax applicability.

## Marketplace Domain

Marketplace covers rules owned by marketplace/channel participation:

- Platform eligibility.
- Marketplace commission policy.
- Channel publication rules.
- Channel-specific conditions.
- Marketplace price or fee overlays.

## Logistics Domain

Logistics covers execution policy for physical movement and handling:

- Carrier selection.
- Routing.
- Dispatch.
- Warehouse handling.
- Delivery execution.
- Transport rules.
- Operational lead-time rules.

`LOGISTICS_DELIVERY` canonicalizes to `LOGISTICS`. Incoterms remain Commercial even when their obligations are operationally consumed by Logistics.

## ASCM/SCOR Review

ASCM SCOR Digital Standard is a supply chain performance and improvement model, not a business policy domain taxonomy. It is useful reference context because it provides:

- A process hierarchy for analyzing supply chain work.
- Performance attributes and metric decomposition.
- Practice and people/competency views.
- Benchmarking and improvement methods.

SCOR performance attributes include Reliability, Responsiveness, Agility, Cost, Profit, Assets, Environmental, and Social in current SCOR Digital Standard public material. These attributes are valuable for scorecards and root-cause analysis, but they should not become top-level Policies & Conditions domains.

SCOR processes such as Plan, Source, Make, Deliver, Return, and Enable describe supply chain operating processes. They are intentionally not seeded as policy domains. A policy may influence a SCOR process, and SCOR metrics may evaluate the impact of a policy, but the policy taxonomy remains business-rule oriented.

ASCM practices, people/competency references, balanced scorecard work, gap analysis, SCORmark benchmarking, SCOR Racetrack, segmentation, and network scenario modeling are useful for later analytics and improvement workflows. They are out of scope for this Phase 2 read-only taxonomy.

## Governance Rules

- `commercial_condition` remains the source table for released Phase 2.
- Migration `0121` remains unchanged.
- Migration `0122` seeds dropdown taxonomy and patches the dashboard descriptor only.
- The dashboard reads taxonomy from `/api/eip/policies-conditions/taxonomy`.
- There are no create, update, delete, migration-run, or deployment actions in this wave.
- The read model canonicalizes legacy domains only at read time.
- Tenant custom taxonomy values are preserved.
- Ambiguous legacy values remain visible and reviewable.

## Primary References

- ASCM, SCOR Digital Standard: https://www.ascm.org/corporate-solutions/standards-tools/scor-ds/
- ASCM, SCOR Digital Standard introductory PDF: https://www.ascm.org/globalassets/ascm_website_assets/docs/intro-and-front-matter-scor-digital-standard2.pdf
- ICC, Incoterms rules: https://iccwbo.org/business-solutions/incoterms-rules/
- ICC, Incoterms 2020: https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/
- International Trade Administration, Know Your Incoterms: https://www.trade.gov/know-your-incoterms
- CSCMP, What is Supply Chain Management: https://cscmp.org/CSCMP/CSCMP/Certify/Fundamentals/What_is_Supply_Chain_Management.aspx
- CIPS, Glossary of Procurement and Supply Chain Terms: https://www.cips.org/intelligence-hub/glossary-of-terms
- OpenStax, Principles of Finance, Ratio Analysis and Liquidity: https://openstax.org/books/principles-finance/pages/6-1-ratios-condensing-information-into-smaller-pieces
