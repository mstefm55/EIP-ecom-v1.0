# Perfect Fit ↔ EIP V1 Kernel/Engine Rework

Status: implementation gate
Date: 2026-09-04
Scope: EIP V1 only

This document is the mandatory Plan → Engine Mapping → Code gate for the Perfect Fit connection rework.

## Architecture baselines read before implementation

- `docs/DEVELOPER_MANUAL.md`
- `docs/PROCESS_V2_INTENT.md`
- `docs/PROCESS_ENGINE_POLICY.md`
- `docs/GATEWAY_OBJECTIVES.md`
- `docs/PERFECT_FIT_PUBLIC_GATEWAY_BOUNDARY.md`
- `services/api/db/migrations/0031_smart_socket_ss2.sql`

The rework must preserve the existing kernel-first, metadata-driven and process-first rules. No V2 repository/path is touched.

## Plan

### Objective

Make Perfect Fit saves durable in EIP V1 while translating Perfect Fit logical fields into tenant-governed EIP fields through existing manifest/alias/schema governance. A designer Save must not require a separate EIP sync button.

### Scope in

- Keep the lossless private Perfect Fit workspace snapshot for designer continuity.
- Use the existing public commerce gateway/member session boundary.
- Use existing `eip_commerce.socket_manifest` and `eip_commerce.socket_alias_map` as the external-vocabulary contract.
- Use existing schema/dropdown governance for validation and controlled values.
- Reuse the existing Perfect Fit product gateway service for enterprise product links/projections.
- Keep tenant derivation server-side from the connection; never accept a browser-selected tenant.
- Preserve owner/privacy boundaries.
- Keep IndexedDB as local media cache/staging, not the only durable copy once server upload is implemented.

### Scope out

- No new Perfect Fit mapping table.
- No new PF-specific `ui_surface` mapping registry.
- No direct browser knowledge of EIP table names or JSONB paths.
- No product lifecycle transitions from ordinary Save.
- No automatic PF_ADMIN access to another designer's private workspace.
- No V2 implementation work.

### Touchpoints

- PF workspace persistence bridge/client adapter.
- Public Perfect Fit workspace route.
- Generic socket alias/manifest resolver service.
- Existing Perfect Fit product gateway service.
- Existing schema/dropdown governance.
- Existing member upload/asset services in a later media sub-wave.

## Engine Mapping

### UI Engine

Perfect Fit remains its own browser UI. EIP Dashboard module UI rules remain surface-driven. This rework does not create a new hardcoded EIP module panel.

The mapping administration surface, when exposed in Dashboard, must be driven by existing Admin/Connections or a surface descriptor and must manage the existing alias/manifest records rather than a PF-only table.

### Manifest / Socket layer

Purpose: translate an external application's logical vocabulary into canonical EIP vocabulary.

Existing structures:

- `eip_commerce.socket_manifest`: versioned/publishable tenant contract.
- `eip_commerce.socket_alias_map`: `OBJECT | FIELD | EVENT` alias → canonical code.

Perfect Fit supplies logical keys such as `product.style_name`, `variant.code`, etc. The server resolves these against the tenant's active aliases. The browser never supplies storage targets.

Resolution order:

1. active tenant `socket_alias_map` exact alias,
2. published socket-manifest mapping/declared canonical hints if governed,
3. safe exact canonical match against effective governed schema,
4. otherwise `UNMAPPED` / `AMBIGUOUS` for administrator review.

No browser-submitted suggestion is automatically promoted to approved governance.

### Schema / Dropdown Governance

- `eip_core.schema_registry` defines allowed canonical fields and semantics.
- `eip_core.schema_override` applies tenant-specific patches.
- `eip_core.schema_bundle` remains the published/effective package where applicable.
- `eip_core.dropdown_list` / `dropdown_value` resolve controlled values by stable code, never display label.
- JSONB keys remain governed; no free uncontrolled PF path is written into EIP business objects.

### Kernel

Kernel persistence remains generic:

- `info_record` for lossless private PF workspace snapshot and integration records.
- `object_link` for relationships.
- `material` for the current ECOM Product Studio canonical product projection, through the existing product gateway service.
- `asset`/asset relationships for media when that sub-wave is implemented.

The gateway authenticates/routes only; field projection is delegated to services, not embedded as tenant-specific route logic.

### Process Engine

Ordinary draft/product metadata Save may update mapped draft data.

Business lifecycle actions such as review, approve, publish, reject, cancel, or any action creating workflow tasks/side effects must go through Process Engine transitions. Save must not directly mutate lifecycle status.

If creation of a governed business object requires an existing process binding, the integration must use it. Existing direct product registration is preserved only to the extent already allowed by the current V1 Product Studio integration contract; no new lifecycle bypass is introduced by this rework.

### System Core

Allowed core plumbing:

- tenant resolution from the connection suffix,
- member session/CSRF/idempotency,
- manifest/alias loading,
- schema/dropdown resolution,
- upload transport/security,
- lossless workspace persistence.

No tenant-specific business logic belongs in core plumbing.

## Data ownership

- Perfect Fit owns richer apparel/technical data.
- EIP owns enterprise execution fields.
- Shared fields follow existing Perfect Fit shared-field authority policies.
- A failed enterprise projection must never discard a successful PF workspace save.
- Unmapped PF-only technical fields remain in the lossless PF snapshot until governance maps them.

## Media direction

IndexedDB remains:

- preview cache,
- offline cache,
- camera/upload staging,
- retry/outbox storage.

It must not be the only durable binary location once a file is successfully saved to EIP. The later media wave will reuse the existing secured member upload route and existing asset/storage services, store canonical server asset references in workspace metadata, and link those references to the relevant PF/EIP objects. No blob is stored in JSONB.

## Code

### Remove/revert from the drifted wave

- `0143_perfect_fit_manifest_surface.sql`
- PF-specific manifest coordinator route/service/client
- PF-specific projection executor and its tests
- PF-specific mapping orchestration added to workspace Save

### Keep

- tenant/member-scoped `PERFECT_FIT_WORKSPACE` lossless persistence
- local pending-save outbox/replay
- background product integration behavior already present before the drifted manifest wave
- PF/EIP session separation

### Add/rework

- generic socket manifest/alias resolver service based on existing `socket_manifest` / `socket_alias_map`
- server-side PF projection adapter that consumes canonical alias resolutions and reuses existing `productGateway.js`
- non-destructive projection report (`mapped`, `unmapped`, `ambiguous`, `conflicts`)
- tests proving no PF-specific storage path/table names are exposed to the browser and that tenant alias resolution is isolated

### Migration impact

`0143` must be removed because it was never executed. This rework adds no new table migration. Any future seed of alias rows must use the already-existing `socket_alias_map` and be separately reviewed before execution.

### Validation

- Existing PF auth/session tests.
- Existing PF product integration tests.
- Existing workspace persistence tests.
- New generic alias resolver tests.
- New workspace projection tests using tenant aliases.
- Frontend build.
- API test suite relevant to public gateway/commerce/PF.
- Verify Railway statuses only after merge to `main`; do not claim deployment before success.
