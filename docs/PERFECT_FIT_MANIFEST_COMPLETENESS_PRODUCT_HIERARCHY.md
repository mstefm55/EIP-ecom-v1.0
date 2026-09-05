# Perfect Fit ↔ EIP V1 Manifest Completeness and Product Hierarchy

Status: implementation gate
Date: 2026-09-05
Scope: EIP V1 only

This document extends `docs/PERFECT_FIT_EIP_KERNEL_ENGINE_REWORK.md` and is the mandatory Plan → Engine Mapping → Code gate for the Perfect Fit integration wave.

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

## Canon: Perfect Fit has no database of its own

Perfect Fit is a browser-only React/Vite application. EIP V1 is its backend and durable database authority through the public gateway.

Therefore:

- durable Perfect Fit business data is persisted in EIP V1;
- **expanded/dynamic Perfect Fit metadata is DB-backed EIP governance, not frontend hardcode**;
- `eip_commerce.socket_manifest` owns the published PF workspace field/tree/group contract;
- `eip_core.dropdown_list` / `dropdown_value` own controlled PF vocabularies and display labels;
- `eip_commerce.socket_alias_map` owns PF logical-field → canonical EIP vocabulary mappings;
- `schema_registry` / overrides / bundles validate canonical EIP field semantics;
- the browser does not generate, publish or send the authoritative manifest during Save;
- browser storage is cache/offline/outbox only and never the durable authority.

`perfectFitMetadata.js` may remain temporarily as a compatibility/bootstrap bundle while DB metadata is rolled out, but it is not governance and must shrink rather than expand. Once a published EIP Perfect Fit manifest exists, DB metadata replaces the dynamic workspace fields, field groups, tree structure, reference convention and dropdowns before React renders.

The lossless `PERFECT_FIT_WORKSPACE` `info_record` remains the durable private document representation while richer technical domains are progressively normalized into governed EIP objects/records.

## Product hierarchy canon

Perfect Fit has two distinct variant levels and they must not be collapsed.

### Level 0 — Style

Perfect Fit tree: `Project → Style`

EIP representation:

- `eip_core.material`, `material_type='PRODUCT'`
- role/classification: `STYLE_MASTER`
- the Style is the enterprise parent/master product definition.

### Level 1 — Style Variant

Perfect Fit tree: `Project → Style → Variant`

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

## Manifest completeness rule

"Complete mapping" does not mean forcing every Perfect Fit field into a `material` column or arbitrary JSONB path.

Every DB-published Perfect Fit field must have an explicit governed disposition:

- `ENTERPRISE_MAPPED` — projected to a governed EIP enterprise field/object.
- `WORKSPACE_ONLY` — durable in the private EIP-backed PF workspace document, with no enterprise projection required.
- `EIP_OWNED` — displayed/consumed by PF but ordinary PF Save cannot overwrite it.
- `DERIVED` — computed from governed EIP/PF inputs.
- `VALUE_MAPPING_REQUIRED` — field target is known but controlled values are not aligned.
- `OBJECT_MAPPING_REQUIRED` — the field belongs to an object/domain whose enterprise representation is not yet configured.
- `ADMIN_REVIEW` — ambiguous mapping requiring EIP administrator decision.

The completeness gate is reached only when no DB-published field is unaccounted for. Missing or ambiguous enterprise mappings remain visible to EIP Admin instead of being guessed.

## Metadata authority

### Authoritative runtime flow

```text
EIP DB
  socket_manifest
  dropdown_list / dropdown_value
  socket_alias_map
  schema_registry
        ↓
EIP public gateway
GET /perfect-fit/metadata
        ↓
Perfect Fit startup
replace dynamic workspace metadata before render
        ↓
Workspace UI
```

### Save flow

```text
Perfect Fit Save
        ↓
workspace business document only
        ↓
EIP Gateway
        ↓
server loads published PERFECT_FIT socket_manifest
+ DB dropdown/schema/alias governance
        ↓
lossless workspace save
        ↓
manifest completeness audit
        ↓
enterprise product projection
```

The Save request never supplies `manifest_contract`, `field_contract`, storage targets, SQL paths or JSONB paths.

### Bootstrap fallback

The legacy frontend metadata bundle is only a temporary resilience path while migration `0144` is not yet applied. If DB metadata exists but is incomplete, the runtime loader must not silently merge hardcoded missing fields back in. DB-owned dynamic domains are replaced so governance gaps stay visible.

## Plan

### Objective

1. Store the expanded PF workspace metadata contract in existing EIP DB governance.
2. Load it through the public gateway before PF renders.
3. Compare DB-published fields automatically with SmartSocket/schema/dropdown governance.
4. Remove unexplained mapping gaps.
5. Harmonize the two-level PF variant model with EIP without regressing the existing Product Studio size-variant model.
6. Add an Enhanced Product Studio mode later, selected by governed capability/surface metadata, while retaining Standard Product Studio as fallback.

### Scope in — current development sequence

- DB-backed PF workspace fields, field groups, tree hierarchy and reference convention.
- DB-backed PF workspace controlled vocabularies.
- Server-side manifest completeness auditing.
- `STYLE_MASTER → STYLE_VARIANT → size/sellable rows` enterprise hierarchy.
- Existing private PF workspace persistence.
- Existing SmartSocket alias mapping for enterprise fields.

### Scope out — current development sequence

- No media binary migration yet.
- No new product/variant table.
- No tenant-code hardcoding.
- No hardcoded PF-only Product Studio panel.
- No lifecycle transition bypass.
- No browser publication of governance.

## Engine Mapping

### UI Engine

- Perfect Fit remains its own browser UI.
- Dynamic PF workspace metadata is fetched from EIP before render.
- EIP Product Studio Standard remains the fallback surface.
- A future Product Studio Enhanced view must be descriptor/capability driven through `ui_surface`, never `if (tenant === ...)` code.

### Manifest / Socket Engine

- `socket_manifest` is the DB-published PF runtime contract.
- `socket_alias_map` resolves PF vocabulary to canonical EIP vocabulary.
- the frontend does not create a second manifest.
- browser values/hints are never promoted to governance.

### Schema / Dropdown Engine

- `schema_registry` describes canonical field/object shape.
- `schema_override` supplies tenant deltas.
- `schema_bundle` remains available for efficient effective bundles.
- PF controlled values live in `dropdown_list` / `dropdown_value` and are matched by stable code only.
- missing lists/values are surfaced as governance gaps.

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

Tenant resolution, session/CSRF, DB manifest loading, field/dropdown comparison and persistence transport only. No tenant-specific business rules.

## Code sequence

1. **DB metadata authority** — migration `0144` seeds existing `socket_manifest`, `dropdown_*` and `socket_alias_map` structures for PF-enabled tenants.
2. **Runtime metadata loader** — PF loads published DB metadata through `/perfect-fit/metadata` before render.
3. **Save authority correction** — browser sends workspace only; server reloads DB contract for audit/projection.
4. **Manifest completeness** — produce field/dropdown/hierarchy gap report from DB authority.
5. **Product hierarchy** — create/reuse `STYLE_MASTER` and linked `STYLE_VARIANT` products.
6. **Size variants** — map Measurement Chart sizes into existing EIP `attrs.variants` model without destroying stock/price state.
7. **Standard Studio compatibility** — keep legacy/non-hierarchical Product Studio behavior available.
8. **Enhanced Product Studio** — descriptor/capability-driven hierarchical view.
9. **Media** — upload/asset registration against harmonized IDs.

## Migration rule

- retired `0143` stays absent and unexecuted;
- `0144` uses existing governance/kernel tables only and creates no PF-specific table;
- it targets PF-enabled connections generically, not a hardcoded Samara tenant code;
- it does not overwrite an existing manually-created `PERFECT_FIT` manifest;
- migration is not executed until code review/validation and deployment readiness are complete.
