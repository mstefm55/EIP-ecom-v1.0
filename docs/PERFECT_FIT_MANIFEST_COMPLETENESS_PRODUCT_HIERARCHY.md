# Perfect Fit ↔ EIP V1 Manifest Completeness and Product Hierarchy

Status: implementation gate
Date: 2026-09-04
Scope: EIP V1 only

This document extends `docs/PERFECT_FIT_EIP_KERNEL_ENGINE_REWORK.md` and is the mandatory Plan → Engine Mapping → Code gate for the next Perfect Fit integration wave.

## Architecture baselines re-read before implementation

- `docs/DEVELOPER_MANUAL.md`
- `docs/PROCESS_V2_INTENT.md`
- `docs/PROCESS_ENGINE_POLICY.md`
- `docs/GATEWAY_OBJECTIVES.md`
- `docs/PERFECT_FIT_PUBLIC_GATEWAY_BOUNDARY.md`
- `docs/PERFECT_FIT_EIP_KERNEL_ENGINE_REWORK.md`
- `docs/product_studio_surface_v1.md`
- `services/api/db/migrations/0031_smart_socket_ss2.sql`

No V2 repository/path is touched.

## Canon correction: Perfect Fit has no database

Perfect Fit is a browser application. It does not own a separate application database.

Therefore:

- durable Perfect Fit business data is persisted through EIP V1;
- dynamic metadata must move toward EIP DB authority;
- frontend metadata files are bootstrap/fallback definitions, not the long-term source of truth;
- tenant variation must be resolved from EIP schema/dropdown/manifest/UI governance;
- browser storage is cache/offline/outbox only and never the durable authority.

The lossless `PERFECT_FIT_WORKSPACE` `info_record` remains the durable private document representation while richer technical domains are progressively normalized into governed EIP objects/records.

## Product hierarchy canon

Perfect Fit has two distinct variant levels and they must not be collapsed.

### Level 0 — Style

Perfect Fit tree:

`Project → Style`

EIP representation:

- `eip_core.material`, `material_type='PRODUCT'`
- role/classification: `STYLE_MASTER`
- the Style is the enterprise parent/master product definition.

### Level 1 — Style Variant

Perfect Fit tree:

`Project → Style → Variant`

This is a development/product-definition variant. It can own its own technical modules such as measurement chart, pattern library, sewing, media, fit sessions and tech pack.

EIP representation:

- child `eip_core.material`, `material_type='PRODUCT'`
- role/classification: `STYLE_VARIANT`
- linked to the Style master using existing `eip_core.object_link`
- relation type: `STYLE_VARIANT_OF`
- stable PF style/variant IDs and codes are retained in the Perfect Fit integration record.

No new product or variant table is introduced.

### Level 2 — Size / sellable variant

Existing EIP V1 Product Studio variant behavior is retained:

- `material.attrs.variants.enabled`
- `material.attrs.variants.headers[]`
- `material.attrs.variants.items[]`
- variant headers governed by `ECOM_VARIANT_HEADER`

This level represents the sellable/size option matrix inside a Style Variant product. It does **not** replace the Perfect Fit Style Variant node.

Target hierarchy:

```text
Perfect Fit
Project
 └─ Style
     ├─ Style Variant A
     │   └─ Measurement Chart sizes / sellable sizes
     └─ Style Variant B
         └─ Measurement Chart sizes / sellable sizes

EIP V1
STYLE_MASTER material
 ├─ STYLE_VARIANT material A --attrs.variants--> size/sellable rows
 └─ STYLE_VARIANT material B --attrs.variants--> size/sellable rows
```

This preserves Perfect Fit richness and keeps the existing EIP size-variant implementation useful.

## Manifest completeness rule

"Complete mapping" does not mean forcing every Perfect Fit field into a `material` column or arbitrary JSONB path.

Every metadata-declared Perfect Fit field must have an explicit governed disposition:

- `ENTERPRISE_MAPPED` — projected to a governed EIP enterprise field/object.
- `WORKSPACE_ONLY` — durable in the private EIP-backed PF workspace document, with no enterprise projection required.
- `EIP_OWNED` — displayed/consumed by PF but ordinary PF Save cannot overwrite it.
- `DERIVED` — computed from governed EIP/PF inputs.
- `VALUE_MAPPING_REQUIRED` — field target is known but controlled values are not aligned.
- `OBJECT_MAPPING_REQUIRED` — the field belongs to an object/domain whose enterprise representation is not yet configured.
- `ADMIN_REVIEW` — ambiguous mapping requiring EIP administrator decision.

The completeness gate is reached only when **no metadata-declared field is unaccounted for**. `UNACCOUNTED` is not an acceptable final state.

## Metadata authority progression

### Current bootstrap

`perfectFitMetadata.js` provides the complete browser fallback needed to start the application.

### Target authority

Dynamic metadata is progressively published from EIP DB:

- field/object schema → `schema_registry` / `schema_override` / `schema_bundle`
- controlled vocabulary → `dropdown_list` / `dropdown_value`
- external PF vocabulary mapping → `socket_alias_map`
- versioned connection manifest → `socket_manifest`
- EIP Dashboard presentation → `ui_surface`

Perfect Fit may keep static fallback metadata for resilience, but when an authenticated published EIP manifest/bundle is available it is authoritative for dynamic fields/options/structure governed by EIP.

The browser cannot auto-publish governance. A PF-provided manifest contract may be compared with EIP governance and may generate suggestions, but only governed EIP configuration is authoritative.

## Plan

### Objective

1. Inventory all metadata-declared PF fields, vocabularies and hierarchy contracts.
2. Compare them automatically with EIP SmartSocket/schema/dropdown governance.
3. Remove unexplained mapping gaps.
4. Harmonize the two-level PF variant model with EIP without regressing the existing Product Studio size-variant model.
5. Add an enhanced Product Studio mode later, selected by governed capability/surface metadata, while retaining Standard Product Studio as fallback.

### Scope in — first development sequence

- Extend the PF metadata transport contract beyond six projection fields.
- Include PF tree/object hierarchy and controlled vocabulary declarations.
- Add server-side manifest completeness auditing.
- Report field and dropdown gaps without guessing mappings.
- Establish `STYLE_MASTER → STYLE_VARIANT → size/sellable rows` as the EIP product hierarchy contract.
- Keep current PF workspace persistence intact.

### Scope out — first development sequence

- No media binary migration yet.
- No new product/variant table.
- No tenant-code hardcoding.
- No hardcoded PF-only Product Studio panel.
- No lifecycle transition bypass.
- No automatic publication of browser-supplied metadata.

## Engine Mapping

### UI Engine

- Perfect Fit remains its own browser UI.
- EIP Product Studio Standard remains the default/fallback surface.
- A future Product Studio Enhanced view must be descriptor/capability driven through `ui_surface`, never `if (tenant === ...)` code.

### Manifest / Socket Engine

- PF sends logical metadata keys and structural declarations only.
- `socket_alias_map` resolves PF vocabulary to canonical EIP vocabulary.
- `socket_manifest` is the versioned DB-backed connection manifest.
- Browser hints are never silently promoted to approved governance.

### Schema / Dropdown Engine

- `schema_registry` describes canonical field/object shape.
- `schema_override` supplies tenant deltas.
- `schema_bundle` can become the efficient published PF/EIP metadata payload.
- dropdown values are matched by stable code only.
- PF local lists that do not exist in EIP are surfaced as governance gaps, not copied silently.

### Kernel

Reuse only existing generic structures:

- `material` for Style master and Style Variant enterprise product records;
- `object_link` for `STYLE_VARIANT_OF` hierarchy;
- `info_record` for lossless private workspace/integration records;
- existing `material.attrs.variants` for Level-2 size/sellable rows;
- `asset` and object links later for media.

### Process Engine

Ordinary draft metadata Save may create/update the governed draft representation already allowed by Product Studio. Review/publish/reject/release/lifecycle transitions remain process-driven.

### System Core

Tenant resolution, session/CSRF, manifest loading, field/dropdown comparison and persistence transport only. No tenant-specific business rules.

## Code sequence

1. Add a complete PF manifest transport builder derived from existing metadata.
2. Add server manifest-completeness auditor.
3. Return/persist non-destructive audit summaries with workspace Save.
4. Add tests for field coverage, dropdown coverage and two-level variant declaration.
5. Rework enterprise projection to create/reuse `STYLE_MASTER` and linked `STYLE_VARIANT` products.
6. Map Level-2 size/sellable variants into the existing EIP `attrs.variants` model.
7. Add governed Enhanced Product Studio descriptor/capability while keeping Standard mode untouched.
8. Then implement media upload/asset registration against the harmonized IDs.

## Migration rule

Any DB migration in this sequence must be additive, reusable for arbitrary tenants, and based on existing governance/kernel tables. No migration is executed until reviewed and deployed code is ready.
