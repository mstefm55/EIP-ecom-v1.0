# Perfect Fit Variant SEO, Keywords, Curation and Orbit Governance

Status: migration 0146 deployed; corrective follow-up planned as migration 0147.

## Plan

### Objective
Keep SEO and merchandising metadata at **Style Variant** level, but separate two concepts that migration 0146 combined too tightly:

1. **SEO/search keywords**: free-entry designer keywords, rendered as removable chips with Enter/comma/Add behavior.
2. **Curation & placement**: EIP DB-governed stable values whose metadata can drive catalogue facets, badges, collections and Orbit/Signature Carousel eligibility.

The correction must preserve migration 0146 data and the garment-category governance introduced by 0145. Executed migrations 0144, 0145 and 0146 are immutable.

### Scope
In scope:
- Keep Variant-owned `seo.title`, `seo.description`, and `seo.slug`.
- Add Variant-owned free `seo.keywords`.
- Keep governed curation values projected to EIP `material.attrs.taxonomy.tags`.
- Rename the PF presentation of governed tags to **Curation & placement** so they are not confused with free keywords.
- Preserve `ORBIT_FEATURED` behavior and all existing governed values from 0146.
- Preserve the existing catalogue/category behavior; do not harmonize all catalogue filters in this wave.

Out of scope:
- Replacing all Pattern Library/catalogue filters with DB-driven facets.
- Removing or renaming existing governed codes.
- Publication lifecycle/process changes.
- New persistence tables.

### Interaction model
Variant Overview `Discovery & SEO` contains:

- SEO title
- SEO description
- SEO slug
- **Keywords**: free-entry chip input; Enter, comma or Add button commits a keyword; chips are removable.
- **Curation & placement**: governed selectable chips sourced from `PF_PRODUCT_TAG`.

The visual treatment may take interaction inspiration from EIP V1, but remains Perfect Fit-specific and does not copy EIP layout exactly.

## Engine Mapping

### UI Engine / metadata
Perfect Fit dynamic field definitions remain in the published `PERFECT_FIT` socket manifest.

Migration 0147 will:
- add `variant.seo_keywords` mapped to canonical `seo.keywords`;
- define `variant.seo_keywords` as a free-entry metadata field (`taginput`), not a dropdown;
- keep `variant.tags` bound to `VARIANT_TAG` / `PF_PRODUCT_TAG`;
- change the presentation label/help for `variant.tags` to `Curation & placement`;
- publish a versioned successor manifest without overwriting manifest history.

The Workspace renderer adds a generic `taginput` renderer. No keywords are hardcoded in React.

### Process Engine
Not used. SEO, keywords and curation are ordinary product metadata, not lifecycle transitions.

### System Core / kernel
Reuse existing kernel/storage:
- `eip_core.dropdown_list/value` for governed curation vocabulary only;
- `eip_commerce.socket_manifest` and `socket_alias_map` for runtime field vocabulary/mapping;
- existing `material.attrs.seo` for SEO title/description/slug/keywords;
- existing `material.attrs.taxonomy.tags` for governed merchandising/curation codes;
- existing `PERFECT_FIT_WORKSPACE` info-record path for the complete lossless PF document.

No PF-specific product, SEO, keyword or tag table is introduced.

## Authority
Once a Perfect Fit Style Variant exists:
- PF Variant is the editing authority for its SEO fields, free keywords, and selected governed curation values.
- EIP stores the enterprise projection in the existing Product material JSONB.
- Legacy workspaces with absent fields do not clear corresponding EIP values.
- Explicitly present empty fields clear only the PF-owned property, not unrelated EIP metadata.

## Semantic separation

### Category
`PF_GARMENT_CATEGORY` answers **what the garment is**.

Examples: Dress, Top, Corset, Skirt.

### Keywords
`variant.seo_keywords` / `seo.keywords` answer **what users may search for**.

Examples: `bias cut`, `summer dress`, `linen`, `wedding guest`.

Keywords are deliberately free-entry and are not constrained by EIP dropdown governance.

### Curation & placement
`variant.tags` / `taxonomy.tags` answer **how or where the product is merchandised/discovered**.

The governed list remains `PF_PRODUCT_TAG` and preserves all 0146 values:
- `NEW_RELEASE`
- `BEST_SELLER`
- `FREE_PATTERN`
- `PATTERN_OF_THE_DAY`
- `PREMIUM_BLUEPRINT`
- `BEGINNER_FRIENDLY`
- `EDITORIAL_PICK`
- `CURVE_PLUS`
- `ORBIT_FEATURED`

Behavior remains metadata-driven. For example:
- `ORBIT_FEATURED`: `surface_targets=["signature-orbit-carousel","orbit-carousel"]`.
- `BEST_SELLER`: `catalog_filter_id="best-sellers"`.
- `FREE_PATTERN`: `catalog_filter_id="free-patterns"`.
- `PATTERN_OF_THE_DAY`: `catalog_filter_id="pattern-of-the-day"`.
- `CURVE_PLUS`: `catalog_filter_id="curve-plus"`.

## Orbit compatibility rule
Homepage selection continues to resolve from governed curation metadata.

1. If one or more products are eligible for the requested surface, use those products up to the existing display limit.
2. If none are eligible, keep the current first-N fallback until catalogue migration is completed deliberately.

Free SEO keywords never grant Orbit eligibility.

## EIP mapping
Perfect Fit Style Variant fields map to canonical EIP JSONB paths:

- `variant.seo_title` -> `seo.title`
- `variant.seo_description` -> `seo.description`
- `variant.seo_slug` -> `seo.slug`
- `variant.seo_keywords` -> `seo.keywords`
- `variant.tags` -> `taxonomy.tags`

The Style Master does not receive Variant SEO/keywords/curation.

## Code

### Corrective migration 0147
Migration `0147_perfect_fit_variant_keywords_curation.sql` is additive and must:
- target PF-enabled tenants using the existing connection-profile contract;
- add the FIELD alias `variant.seo_keywords -> seo.keywords`;
- publish the next `PERFECT_FIT` manifest version with the new tag-input field and corrected curation label;
- preserve `PF_PRODUCT_TAG` values and behavioral attrs from 0146;
- not modify/replay 0144, 0145 or 0146.

### Application changes
- `Workspace.jsx`: metadata-driven `taginput` renderer with removable chips and Enter/comma/Add behavior.
- `workspaceProductProjection.js`: recognize `seo.keywords` only from Style Variant scope.
- `productGateway.js`: project keyword arrays into `material.attrs.seo.keywords` without disturbing other SEO attributes.
- `workspaceProductPresentation.js`: expose Variant keywords to catalogue presentation.
- `PatternSEO.jsx`: use explicit Variant keywords for `<meta name="keywords">`; retain generated legacy fallback when no explicit keywords exist.
- tests: separation of keywords from curation, no Orbit eligibility from keywords, backward-compatible clearing/presence semantics.

## Validation
- Metadata endpoint returns the new manifest version and `variant.seo_keywords` field.
- Keywords accept arbitrary text and survive Save + hard refresh.
- Keywords are not restricted to `PF_PRODUCT_TAG`.
- Curation remains a governed fixed choice and retains all existing 0146 options.
- `ORBIT_FEATURED` still controls Orbit eligibility; a matching free keyword does not.
- Style Variant projection stores `seo.keywords` and `taxonomy.tags` separately.
- Existing categories and catalogue filters do not regress.
- Old Variants without the new keyword field do not clear pre-existing EIP SEO data.
