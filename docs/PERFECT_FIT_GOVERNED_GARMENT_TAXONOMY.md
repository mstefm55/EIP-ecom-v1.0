# Perfect Fit governed garment taxonomy

Status: implementation plan for migration 0145.

## Problem

Perfect Fit `product.category` is a governed JSONB attribute. Its runtime dropdown is therefore owned by EIP dropdown governance (`eip_core.dropdown_list` / `eip_core.dropdown_value`).

The Pattern Library catalogue currently contains a mixture of true garment/style categories and catalogue-only facets. The workspace Style Category field must not accept merchandising or filter facets as product categories.

## Canonical rule

`PF_GARMENT_CATEGORY` is the canonical Perfect Fit style/product category vocabulary.

Both of these consumers must use that same governed list for real style categories:

1. Perfect Fit Workspace `product.category` dropdown.
2. Pattern Library catalogue style-category filters.

The browser is a consumer only. It must not redefine the category list.

## Filter-only items

The following Pattern Library entries are not `product.category` values and must be excluded from `PF_GARMENT_CATEGORY`:

- Pattern of the Day — merchandising/editorial facet.
- Free Patterns — pricing/promotional facet.
- Curve & Plus Sizes — sizing/market-segment facet.
- Best Sellers — merchandising/ranking facet.

They may remain visible in the Pattern Library filter, but they are not valid values for the workspace Style Category field.

## Governed style categories

The governed list mirrors the actual style-category part of the current Pattern Library taxonomy. Existing stable codes are preserved where already in use so saved workspaces are not rewritten.

| Stable code | Label | Catalogue id | Audience |
|---|---|---|---|
| DRESS | Dresses | dresses | women |
| TOP | Tops | tops | women |
| CORSET | Corsets | corsets | women |
| TROUSER | Pants & Shorts | pants-shorts | women |
| SKIRT | Skirts | skirts | women |
| JUMPSUIT | Jumpsuits | jumpsuits | women |
| JACKET_VEST | Jackets & Vests | jackets-vests | women |
| COAT | Coats & Capes | coats-capes | women |
| EVENING_PARTY | Evening & Party Looks | evening-party | women |
| ACCESSORY | Accessories | accessories | women |
| LINGERIE | Lingerie | lingerie | women |
| SWIMWEAR_ACTIVEWEAR | Swimwear & Activewear | swimwear-activewear | men |
| HOMEWEAR_SLEEPWEAR | Homewear & Sleepwear | homewear-sleepwear | men |
| INFANTS_TODDLERS | Infants & Toddlers | infants-toddlers | kids |
| CHILDREN | Children | children | kids |
| GIRLS | Girls | girls | kids |
| BOYS | Boys | boys | kids |

Each governed dropdown value carries catalogue mapping attributes (`catalog_category_id`, `catalog_audience`, `catalog_sort_order`, `taxonomy_role`) so catalogue presentation can consume the same authority without hardcoded category translation.

## Engine mapping

- Field governance: `product.category` -> logical `GARMENT_CATEGORY` -> `PF_GARMENT_CATEGORY`.
- Storage: existing `eip_core.dropdown_list` / `eip_core.dropdown_value` only.
- Runtime delivery: existing Perfect Fit metadata endpoint and `metadataManifest.js`.
- Workspace UI: existing metadata-driven `WorkspaceField` select renderer.
- Catalogue UI: `catalogTaxonomy.js` reads the hydrated `GARMENT_CATEGORY` values and maps them to Pattern Library audience/category ids from dropdown-value attrs.
- Workspace-to-catalogue projection: `workspaceProductPresentation.js` uses the governed `catalog_category_id` mapping instead of category-name hardcoding.

## Migration policy

Migration 0144 has already been executed and must not be edited or replayed for this change.

Migration 0145 is additive/idempotent. It extends the existing `PF_GARMENT_CATEGORY` list and updates labels/attrs for the already-existing stable codes. No new business table is introduced.

## Compatibility

Existing saved values `DRESS`, `TOP`, `SKIRT`, `TROUSER`, and `COAT` remain valid stable codes. Only their presentation labels and catalogue mapping attrs are enriched.

The static catalogue taxonomy remains an emergency/bootstrap fallback. When EIP DB metadata is hydrated, governed style categories take precedence.