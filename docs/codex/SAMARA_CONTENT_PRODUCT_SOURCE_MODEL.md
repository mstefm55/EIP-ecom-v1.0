# Storefront Content And Product Source Model

This V1 model applies to Samara and to any future tenant storefront. Samara is a validating tenant, not a backend special case.

## Ownership

```text
Product Studio owns product card data.
Content Studio owns section placement, source rule, and overrides.
The public commerce API resolves published render-ready payloads.
The storefront renders the resolved payload.
```

Content Studio must not copy product titles, pricing, media, inventory, or card metadata into content records. Product-driven slots store references and selection rules only.

## Product-Driven Slot Modes

- `manual_products`: resolve an ordered list of Product Studio product codes.
- `product_tag`: resolve published Product Studio products carrying a governed tag.
- `collection_or_drop`: resolve published Product Studio products carrying a configured collection/drop code.
- `hybrid_tag_overrides`: resolve configured include codes first, then matching tagged products, while applying exclusions.

## Editorial Slots

Editorial slots store governed content such as hero slides, article cards, CTA copy, page content, newsletter copy, and footer copy. Publishing continues through the existing storefront-content process binding.

## Rendering Contract

The public commerce endpoint returns the renderer descriptor and the already-resolved payload. Storefront React components remain low-level renderers and fallbacks only.
