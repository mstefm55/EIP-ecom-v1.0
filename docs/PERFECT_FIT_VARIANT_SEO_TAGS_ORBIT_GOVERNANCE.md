# Perfect Fit Variant SEO, Tags and Orbit Governance

Status: implementation plan for migration 0146.

## Plan

### Objective
Add SEO and merchandising/discovery tags to Perfect Fit at **Style Variant** level, reuse the existing EIP Product Studio JSONB model, and let a governed tag control Orbit/Signature Carousel eligibility without breaking the current catalogue while tenants adopt the new metadata.

### Scope
In scope:
- Variant-owned `seo.title`, `seo.description`, and `seo.slug` equivalents in the Perfect Fit Workspace.
- Variant-owned governed tags projected to EIP `material.attrs.taxonomy.tags`.
- EIP DB governance for allowed Perfect Fit tags.
- A dedicated governed `ORBIT_FEATURED` tag whose metadata declares Orbit/Signature Carousel surface eligibility.
- Safe catalogue fallback: if no eligible tagged products exist, keep the existing first-N carousel behavior so current production presentation does not disappear during migration.
- Existing Pattern Library category/filter behavior remains unchanged in this wave.

Out of scope:
- Replacing all Pattern Library filters with DB-driven tag facets in this wave.
- Changing category governance introduced by migration 0145.
- Publication lifecycle/process changes.
- New persistence tables.

### Touchpoints
- DB: `eip_core.dropdown_list`, `eip_core.dropdown_value`, `eip_commerce.socket_manifest`, `eip_commerce.socket_alias_map`.
- API projection: Perfect Fit workspace -> existing EIP `material.attrs.seo` and `material.attrs.taxonomy.tags`.
- UI: existing metadata-driven Workspace renderer and existing catalogue product presentation.
- Homepage: existing Signature Orbit Carousel input selection only; carousel rendering itself is unchanged.

## Engine Mapping

### UI Engine / metadata
- Perfect Fit dynamic field definitions remain in the published `PERFECT_FIT` socket manifest.
- Add a `VARIANT_TAG` logical dropdown binding backed by tenant-governed `PF_PRODUCT_TAG`.
- Add variant fields:
  - `variant.seo_title`
  - `variant.seo_description`
  - `variant.seo_slug`
  - `variant.tags`
- Add a metadata-driven `variantDiscoverySeo` field group used by Variant Overview.
- Extend the generic Workspace field renderer with a `multiselect` renderer. No tag values are hardcoded in the component.

### Process Engine
Not used. SEO and tags are ordinary product metadata, not business lifecycle transitions. Publication/release continues through the existing process/governance path.

### System Core / kernel
- Reuse `dropdown_list/value` for governed tag vocabulary.
- Reuse `socket_manifest` and `socket_alias_map` for field vocabulary/mapping.
- Reuse existing `material.attrs.seo` and `material.attrs.taxonomy.tags`; no product/tag/SEO table is introduced.
- Perfect Fit full workspace document remains lossless in its existing `PERFECT_FIT_WORKSPACE` info record path.

## Authority
Once a Perfect Fit Style Variant workspace exists:
- PF Variant is the editing authority for its SEO fields and selected merchandising tags.
- EIP stores the enterprise projection in the existing Product material JSONB.
- Existing pre-feature products are not cleared: if a legacy workspace has no `variant.tags`/SEO keys, projection leaves those EIP attributes untouched.
- When the PF fields are explicitly present, their values replace the PF-owned projection for that variant.

## Governed tag model
`PF_PRODUCT_TAG` contains stable codes and behavioral attrs. Initial values preserve the legacy catalogue vocabulary and add the explicit Orbit control:

- `NEW_RELEASE`
- `BEST_SELLER`
- `FREE_PATTERN`
- `PATTERN_OF_THE_DAY`
- `PREMIUM_BLUEPRINT`
- `BEGINNER_FRIENDLY`
- `EDITORIAL_PICK`
- `CURVE_PLUS`
- `ORBIT_FEATURED`

Behavior is metadata, not React branching. Examples:
- `ORBIT_FEATURED`: `surface_targets=["signature-orbit-carousel","orbit-carousel"]`.
- `BEST_SELLER`: `catalog_filter_id="best-sellers"`.
- `FREE_PATTERN`: `catalog_filter_id="free-patterns"`.
- `PATTERN_OF_THE_DAY`: `catalog_filter_id="pattern-of-the-day"`.
- `CURVE_PLUS`: `catalog_filter_id="curve-plus"`.

The category list and tag list remain separate. A garment category says what the product **is**; a tag says how/where it is **discovered or merchandised**.

## Orbit compatibility rule
Homepage selection is resolved from governed tag metadata. A product is Orbit-eligible when one of its selected governed tags declares a matching Orbit surface target.

Compatibility fallback:
1. If one or more eligible tagged products exist, use those products (existing display limit remains).
2. If none exist, keep the current first-N product behavior.

This prevents a blank/regressed carousel immediately after migration while allowing governance to become authoritative as products are tagged.

## EIP mapping
Perfect Fit fields map to existing canonical EIP JSONB paths:

- `variant.seo_title` -> `seo.title`
- `variant.seo_description` -> `seo.description`
- `variant.seo_slug` -> `seo.slug`
- `variant.tags` -> `taxonomy.tags`

The Style Master does not receive Variant SEO/tags. They are projected only to the `STYLE_VARIANT` Product material.

## Code

### Files
- `services/api/db/migrations/0146_perfect_fit_variant_seo_tags.sql`
- `services/api/src/services/perfectFit/workspaceProductProjection.js`
- `services/api/src/services/perfectFit/productGateway.js`
- `apps/samara-web/my-vite-react-app/src/components/Workspace.jsx`
- `apps/samara-web/my-vite-react-app/src/lib/workspaceProductPresentation.js`
- `apps/samara-web/my-vite-react-app/src/data/catalogTaxonomy.js`
- `apps/samara-web/my-vite-react-app/src/App.jsx`
- tests covering migration, projection and carousel selection.

### Migration/seed
Migration 0146 is additive and versioned. It does not modify or replay 0144 or 0145. It creates/updates the governed tag list, adds field aliases, and publishes the next `PERFECT_FIT` socket manifest version.

### Validation
- Metadata endpoint returns `VARIANT_TAG` binding and populated governed tags.
- Variant Overview renders SEO fields and governed tag selector.
- Workspace save persists values losslessly.
- Style Variant Product projection writes EIP `attrs.seo` and `attrs.taxonomy.tags` without changing Style Master.
- Legacy variants with absent fields do not clear existing EIP SEO/tags.
- Orbit uses eligible tagged products when present and legacy first-N fallback when none are tagged.
- Category/filter behavior from 0145 remains unchanged.
