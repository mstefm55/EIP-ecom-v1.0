# Perfect Fit Keywords and Curation Separation

## Plan

Perfect Fit Style Variant discovery metadata is split into two deliberately different concerns:

1. **Search keywords** — free-entry designer-authored search terms.
2. **Curation & placement** — governed behavioral controls that can affect catalogue facets, badges and presentation surfaces such as Orbit.

This change corrects the earlier fixed-list-only UI without changing the Style → Style Variant → Size Variant product hierarchy or the governed garment-category model from migration 0145.

## Engine Mapping

### Search keywords

Perfect Fit logical field:

`variant.seo_keywords`

Canonical EIP Product JSONB:

`material.attrs.seo.keywords[]`

Rules:
- Style Variant owns the value.
- Free text is allowed.
- No dropdown list governs the vocabulary.
- UI supports Enter, comma and an explicit add button.
- Values are stored as a de-duplicated string array.

### Curation & placement

Perfect Fit keeps the existing logical key:

`variant.tags`

Canonical EIP Product JSONB:

`material.attrs.taxonomy.tags[]`

The key is retained for backward compatibility with 0146 workspaces. Its UI meaning is now explicitly **Curation & placement**.

The values remain governed by the existing EIP dropdown list `PF_PRODUCT_TAG`. Stable codes are not renamed or re-seeded under new codes, preventing catalogue and Orbit regressions.

Examples include:
- `BEST_SELLER`
- `FREE_PATTERN`
- `PATTERN_OF_THE_DAY`
- `CURVE_PLUS`
- `ORBIT_FEATURED`

Behavioral attrs on governed dropdown values continue to determine catalogue filters and eligible presentation surfaces.

### Category remains separate

Garment category continues to be governed through `PF_GARMENT_CATEGORY` from migration 0145.

Therefore:

- Category answers **what the garment is**.
- Keywords answer **what a user may search for**.
- Curation answers **how/where the product is merchandised**.

## DB Authority

Migration 0147 uses existing EIP governance mechanisms only:
- `eip_commerce.socket_manifest`
- `eip_commerce.socket_alias_map`
- `eip_core.dropdown_list`
- `eip_core.dropdown_value`

No Perfect Fit-specific persistence table is introduced.

The runtime manifest defines the free-entry keyword field and the governed curation field. The browser is a renderer/consumer and does not publish governance.

## Compatibility

- 0144, 0145 and 0146 are not modified.
- Existing `variant.tags` workspace data remains valid.
- Existing `PF_PRODUCT_TAG` stable codes remain valid.
- Existing Orbit behavior continues to use the governed curation codes and their `surface_targets` attrs.
- Search keywords are additive and do not overwrite curation tags.

## UI

Variant Overview → Discovery & SEO contains:
- SEO title
- SEO description
- SEO slug
- Search keywords: removable chips + text entry + explicit add button
- Curation & placement: governed selectable chips

The interaction borrows the useful chip-entry principle from EIP V1 while retaining Perfect Fit's own visual language.
