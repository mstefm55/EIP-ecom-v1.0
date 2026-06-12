# Policies & Conditions Source Mapping v1

Status: Phase 2 read-only extension

This document records how released legacy policy and condition classifications are interpreted by the Policies & Conditions read model. It is documentation only. It does not define runtime precedence, does not create editable policy workflows, and does not change the physical `commercial_condition` records.

## Source Hierarchy

| Source | Runtime role | Notes |
| --- | --- | --- |
| `commercial_condition.condition_type` | Legacy physical type | Preserved in `legacy.condition_type`. |
| `commercial_condition.condition_category` | Legacy physical category | Preserved in `legacy.condition_category`. |
| `commercial_condition.attrs.classification` | Explicit classification override when present | Preserved in `legacy.attrs_classification`, then canonicalized for read output. |
| Built-in read model compatibility mapping | Read-time canonicalization | Used only when explicit classification is absent or needs compatibility mapping. |
| Dropdown taxonomy | Read-only filter/options metadata | Seeds default domain options and allows tenant custom taxonomy values. |
| Professional and academic references | Documentation authority | Used to justify lexicon boundaries, not to override data. |

The implementation intentionally does not add source-priority mechanics for effective policy resolution. That belongs to a future governed write/effective-policy phase.

## Default Domain Mapping

| Legacy value | Canonical read-domain behavior |
| --- | --- |
| `SELLING` | `COMMERCIAL` |
| `PROCUREMENT` | `COMMERCIAL` |
| `TRADE_PARTY` | `COMMERCIAL` |
| `LOGISTICS_DELIVERY` | `LOGISTICS` |
| `INVENTORY` | `INVENTORY` |
| `MARKETPLACE` | `MARKETPLACE` |
| `FISCAL_TAX_TREATMENT` | `FISCAL_TAX_TREATMENT` |
| Tenant custom domain | Preserved as a custom domain. |

`NEEDS_REVIEW` is a review state, not one of the seven default business domains.

## Finance Approval Compatibility

Legacy `FINANCE_APPROVAL` is overloaded. The read model maps it by condition meaning, not by name alone.

| Meaning | Canonical domain | Example condition types or families |
| --- | --- | --- |
| Commercial trade terms | `COMMERCIAL` | `PAYMENT_TERM_CONDITION`, `PAYMENT_TERMS`, `TRADE_TERMS`, `TRADE_CREDIT`, `SETTLEMENT_TERMS`, `PRICE`, `DISCOUNT`, `INCOTERM` |
| Internal finance policy | `FINANCIAL` | `CASH_POLICY`, `LIQUIDITY_POLICY`, `DEBT_LIMIT`, `CAPITAL_STRUCTURE`, `FINANCIAL_RATIO`, `INVESTMENT_POLICY`, `BORROWING_POLICY` |
| Decision rights | `APPROVAL_FRAMEWORK` | `PURCHASE_APPROVAL`, `EXPENDITURE_APPROVAL`, `DISCOUNT_APPROVAL`, `FINANCIAL_APPROVAL`, `APPROVAL_MATRIX`, `DELEGATION_OF_AUTHORITY` |
| Ambiguous legacy value | `NEEDS_REVIEW` | Any legacy `FINANCE_APPROVAL` row whose type/family does not make the business meaning clear. |

Rows that map to `NEEDS_REVIEW` carry `mapping_status: legacy_ambiguous` so they remain visible and reviewable.

## Incoterms Mapping

Incoterms are commercial terms of sale. The canonical mapping is:

| Field | Value |
| --- | --- |
| `policy_domain` | `COMMERCIAL` |
| `policy_family` | `INCOTERMS` |
| `condition_type` | `INCOTERM` |
| `condition_subtype` | `EXW`, `FCA`, `CPT`, `CIP`, `DAP`, `DPU`, `DDP`, `FAS`, `FOB`, `CFR`, or `CIF` |

The read model recognizes Incoterms from explicit classification, row type/category, and safe structured fields such as `attrs.incoterm`, `effect.incoterm`, `effect.trade_terms.incoterm`, `effect.payment_terms.incoterm`, or `scope.incoterm`.

Logistics consumes the obligations associated with Incoterms, but the Incoterm itself remains Commercial.

## Read Model Mapping Examples

| Legacy type/category | Canonical output |
| --- | --- |
| `PROCUREMENT_POLICY` / `PURCHASING` | `COMMERCIAL`, family `PURCHASE_REQUISITION`, type `PROCUREMENT_ROUTE` |
| `SUPPLIER_PURCHASE_CONDITION` / `PURCHASING` | `COMMERCIAL`, family `SUPPLIER_TERMS` |
| `PAYMENT_TERM_CONDITION` / `FINANCE` | `COMMERCIAL`, family `PAYMENT_TERMS` |
| `PRICE` | `COMMERCIAL`, family `PRICE_POLICY` |
| `DISCOUNT` | `COMMERCIAL`, family `DISCOUNT_POLICY` |
| `FREIGHT_COST_CONDITION` / `LOGISTICS` | `LOGISTICS`, family `LANDED_COST` |
| `INVENTORY_REORDER_POLICY` / `INVENTORY` | `INVENTORY`, family `REPLENISHMENT` |
| `TAX` | `FISCAL_TAX_TREATMENT`, family `TAX_CATEGORY` |
| `TRADE_TERMS` | `COMMERCIAL`, but `mapping_status: legacy_ambiguous` unless further classified |
| `CASH_PURCHASE_CONDITION` / `PURCHASING` | `NEEDS_REVIEW`, because the released legacy meaning can mix purchase execution, cash control, and approval policy |
| `FOREX_RATE` / `FOREX` | `NEEDS_REVIEW`, because it may represent system calculation, treasury policy, or trade pricing context |

## Source Reference Mapping

| Source | Used for | Mapping impact |
| --- | --- | --- |
| ICC Incoterms rules | Confirms Incoterms are commercial trade terms maintained by ICC. | Incoterms are placed under Commercial. |
| International Trade Administration, Know Your Incoterms | Confirms the 11 Incoterms and buyer/seller responsibility framing. | The eleven subtypes are recognized. |
| CSCMP supply chain management definition | Confirms supply chain spans sourcing/procurement, conversion, logistics, and partner coordination. | Supports keeping policy domains business-rule oriented instead of making supply chain functions the whole taxonomy. |
| CIPS glossary | Professional procurement and supply terminology reference. | Supports Commercial/Approval/Procurement boundary language. |
| OpenStax finance and accounting references | Finance ratios, liquidity, solvency, efficiency, profitability, and statement-analysis concepts. | Supports the Financial domain boundary. |
| ASCM SCOR Digital Standard | Process, performance, practice, benchmarking, and people/skills framework. | Used as analytical context, not as domain seed data. |

## ASCM/SCOR Applicability Review

SCOR is valuable for analysis because it connects process, performance, practices, people, and improvement methods. Public ASCM material describes SCOR Digital Standard as a framework for analyzing, measuring, and improving supply chain performance. Public introductory material also identifies metric coding around performance attributes including Reliability, Responsiveness, Agility, Profit, Cost, Assets, Environmental, and Social.

For EIP Policies & Conditions, SCOR should be used as follows:

- Process hierarchy: useful for understanding where a policy applies in operations.
- Performance attributes: useful for KPI and balanced-scorecard views.
- Metrics and decomposition: useful for root-cause analysis and policy-impact measurement.
- Practices: useful for future recommendation libraries.
- People/competency: useful for operating model and role readiness.
- Gap analysis: useful for improvement planning.
- SCOR Racetrack and SCORmark: useful for benchmarking and roadmap work when licensed/available.
- Segmentation and network scenario modeling: useful for future analytics and simulation.

SCOR should not be used as follows:

- Do not seed `PLAN`, `SOURCE`, `MAKE`, `DELIVER`, `RETURN`, or `ENABLE` as policy domains.
- Do not use Reliability, Responsiveness, Agility, Cost, Profit, Assets, Environmental, Social, Practices, or People as top-level policy domains.
- Do not infer effective policy precedence from SCOR metrics.
- Do not implement ASCM tooling, benchmarking workflows, or SCORmark mechanics in Phase 2.

## Source Caveat

Public source access is partial. ICC, ITA, CSCMP, CIPS, OpenStax, and ASCM public pages provide enough authority for the Phase 2 taxonomy boundaries. Full standards publications, licensed benchmark content, training materials, or paid digital-standard tooling may contain additional detail and should be reviewed before implementing deeper SCOR analytics or industry-specific benchmarking.

## References

- ASCM, SCOR Digital Standard: https://www.ascm.org/corporate-solutions/standards-tools/scor-ds/
- ASCM, SCOR Digital Standard open-access guidance: https://www.ascm.org/corporate-solutions/standards-tools/scor-ds/open-access-guidance/
- ASCM, SCOR Digital Standard introductory PDF: https://www.ascm.org/globalassets/ascm_website_assets/docs/intro-and-front-matter-scor-digital-standard2.pdf
- Frontiers in Sustainability, critical review of SCOR Digital Standard: https://www.frontiersin.org/journals/sustainability/articles/10.3389/frsus.2026.1769304/full
- ICC, Incoterms rules: https://iccwbo.org/business-solutions/incoterms-rules/
- ICC, Incoterms 2020: https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/
- International Trade Administration, Know Your Incoterms: https://www.trade.gov/know-your-incoterms
- CSCMP, What is Supply Chain Management: https://cscmp.org/CSCMP/CSCMP/Certify/Fundamentals/What_is_Supply_Chain_Management.aspx
- CSCMP, Frequently Asked Questions: https://cscmp.org/CSCMP/CSCMP/Develop/Starting_Your_Career/Frequently_Asked_Questions.aspx
- CIPS, Glossary of Procurement and Supply Chain Terms: https://www.cips.org/intelligence-hub/glossary-of-terms
- OpenStax, Principles of Finance, Ratio analysis: https://openstax.org/books/principles-finance/pages/6-1-ratios-condensing-information-into-smaller-pieces
- OpenStax, Principles of Finance, Liquidity ratios: https://openstax.org/books/principles-finance/pages/6-summary
- OpenStax, Principles of Financial Accounting, financial statement analysis: https://openstax.org/books/principles-financial-accounting/pages/a-financial-statement-analysis
