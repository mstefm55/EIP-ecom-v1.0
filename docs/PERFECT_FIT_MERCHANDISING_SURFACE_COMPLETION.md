# Perfect Fit Merchandising Surface Completion

## Purpose

Complete the consumer side of the governed Perfect Fit merchandising model introduced by migrations 0146-0148. This change does not add a schema, table, tag store, or migration.

Canonical enterprise storage remains:

`eip_core.material.attrs.taxonomy.tags`

The governed vocabulary remains the existing `PF_PRODUCT_TAG` dropdown. Perfect Fit Admin and EIP Product Studio remain the assignment authorities. Ordinary designer Workspace users do not own or write these website-level curation tags.

## Catalogue behavior

Catalogue-only merchandising facets are resolved from the governed tag option metadata `attrs.catalog_filter_id` rather than by treating those values as garment categories.

Examples already governed in `PF_PRODUCT_TAG` include:

- `BEST_SELLER` -> `best-sellers`
- `FREE_PATTERN` -> `free-patterns`
- `PATTERN_OF_THE_DAY` -> `pattern-of-the-day`
- `CURVE_PLUS` -> `curve-plus`

The catalogue product filter and sidebar counts now derive these facet ids from the Product's canonical tags. Normal garment-category filtering remains unchanged and distinct from merchandising facets.

## Homepage behavior

Homepage featured placement is resolved from governed tag option metadata `attrs.surface_targets`.

`ORBIT_FEATURED` currently targets:

- `signature-orbit-carousel`
- `orbit-carousel`

All current Signature/Orbit product renderers use the shared `selectPatternsForSurface` resolver. The resolver preserves the existing safe first-N fallback when no products are tagged for a surface, so an empty merchandising assignment does not blank the homepage.

## Publication moderation

Publication approval and curation are owned by PF Admin, not the designer Workspace. The merged publication moderation implementation provides:

- `Approve & Publish` for a pending moderation request.
- Inline governed website curation/placement tags on the moderation card.
- The existing `MODERATOR_PUBLISH` workflow transition rather than a duplicate publication mutation.
- A server-backed publication request/snapshot flow using existing EIP kernel primitives (`info_record`, `service_object`, `process_instance`) and the existing storefront content process.
- No moderator access to Project Journal, source pattern files, technical drawings, Sewing, Time & Motion, internal Media, or other private designer Workspace modules.

## Architectural boundary

This completion is deliberately metadata-driven:

- Assignment authority: `PF_ADMIN` / EIP Product Studio.
- Canonical tag storage: Product JSONB `taxonomy.tags`.
- Catalogue placement/filter behavior: governed `catalog_filter_id` metadata.
- Homepage placement behavior: governed `surface_targets` metadata.
- Publication state: existing EIP process/service-object/info-record kernel.

React components consume governed behavior metadata; they do not hard-code business tag names as branching rules.
