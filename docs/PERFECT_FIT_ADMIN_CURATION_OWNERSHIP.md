# Perfect Fit Admin Curation Ownership

Status: implementation plan for migration 0148.

## Plan

### Objective
Correct the ownership boundary introduced by 0146/0147: free SEO/search metadata remains editable by the Perfect Fit designer at Style Variant level, while website-wide merchandising/curation tags are assignable only by merchandising administration surfaces.

### Required behavior
- Ordinary Perfect Fit designers can edit Variant SEO title, description, slug, and free search keywords.
- Ordinary Perfect Fit designers cannot assign behavioral website tags such as `ORBIT_FEATURED`, `BEST_SELLER`, `PATTERN_OF_THE_DAY`, `FREE_PATTERN`, or `CURVE_PLUS`.
- Perfect Fit Admin can assign the governed curation tags through the Perfect Fit public gateway using the existing MEMBER realm plus explicit `PF_ADMIN` authorization and CSRF on writes.
- EIP Product Studio remains the enterprise administration surface for the same canonical Product JSONB `material.attrs.taxonomy.tags`.
- Storefront/catalogue/Orbit continue consuming the same canonical tags and governed behavior attrs. No new tag storage is introduced.
- Existing workspace snapshots containing historical `variant.tags` remain lossless, but an ordinary designer Save must no longer project those values into enterprise `taxonomy.tags`.

### Compatibility
- Do not modify migrations 0144-0147.
- Keep `PF_PRODUCT_TAG` and all existing stable codes/behavior attrs.
- Keep `variant.tags` as a compatibility descriptor if needed for old workspace data, but remove it from the ordinary Variant Overview editing group.
- Preserve the 0145 garment-category vocabulary and the 0147 free keyword behavior.
- Preserve existing Product Studio and storefront tag readers.

## Engine Mapping

### EIP governance
Existing `eip_core.dropdown_list` / `eip_core.dropdown_value` remain the vocabulary authority for `PF_PRODUCT_TAG`.

Migration 0148 changes governance metadata, not storage:
- `workspace_selectable = false`
- `admin_selectable = true`
- `product_studio_selectable = true`
- `assignment_authority = MERCHANDISING_ADMIN`
- existing `surface_targets`, `catalog_filter_id`, `legacy_tag_id`, and stable codes remain intact.

### SmartSocket / Perfect Fit manifest
The published `PERFECT_FIT` manifest successor:
- keeps SEO title/description/slug and `variant.seo_keywords` in `variantDiscoverySeo`;
- removes `variant.tags` from the ordinary Variant Overview field group;
- marks the compatibility `variant.tags` descriptor admin-owned / non-workspace-editable;
- declares curation assignment surfaces as `PF_ADMIN` and `EIP_PRODUCT_STUDIO`.

### Perfect Fit ordinary workspace projection
`projectPerfectFitWorkspaceProducts` must not treat `taxonomy.tags` as designer-writeable.

Normal workspace Save may continue projecting the Variant-owned SEO fields, including `seo.keywords`, but must leave existing enterprise `material.attrs.taxonomy.tags` untouched.

### Perfect Fit Admin public boundary
Reuse the existing public commerce gateway and MEMBER session model. No `/api/eip/*` access is granted to Perfect Fit sessions.

Admin curation endpoints require:
1. enabled Perfect Fit storefront connection and appropriate public scope;
2. valid MEMBER session for the same tenant/connection;
3. explicit `PF_ADMIN` role assignment;
4. member CSRF for writes;
5. governed `PF_PRODUCT_TAG` validation before writing.

The endpoint reads/writes only projected Style Variant Product identity/presentation metadata; it does not expose another designer's private technical workspace.

### Product Studio
EIP Product Studio continues to administer the same canonical `material.attrs.taxonomy.tags`. No duplicate PF tag table or PF-only enterprise tag field is added.

### Storefront / Orbit
Existing storefront resolution and Orbit selection continue reading `taxonomy.tags` and governed dropdown behavior. Ownership changes do not alter rendering semantics.

### Process Engine
Not used. Tag assignment is governed product/merchandising metadata, not a lifecycle transition.

## Code

### Migration
Add `0148_perfect_fit_admin_curation_ownership.sql` as an additive successor to 0147.

### API / services
- Remove `taxonomy.tags` from ordinary PF workspace projection ownership.
- Ensure ordinary Variant presentation sync cannot overwrite tags.
- Add a dedicated admin-curation write helper that only changes `taxonomy.tags` and preserves unrelated Product attrs.
- Add PF-admin public read/write routes with explicit role and CSRF checks.

### Perfect Fit UI
- Variant Overview: no curation selector; keep SEO + free keyword chip entry.
- PF Admin: expose a product-curation editor backed by the public PF-admin endpoint and DB-governed tag vocabulary.

### Tests
Regression coverage must prove:
- ordinary PF Save cannot change `taxonomy.tags`;
- SEO keywords still project;
- non-PF_ADMIN cannot use admin curation endpoints;
- PF_ADMIN writes are CSRF protected and governed;
- admin tag updates preserve unrelated Product attrs;
- Product Studio/storefront continue using canonical `taxonomy.tags`;
- migration 0148 does not modify historical migrations.

## Deployment gate
0148 must not be executed until this implementation is merged to `main` and the Railway API deployment reports SUCCESS.