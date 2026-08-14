# PERFECT_FIT_TECHNICAL_WORKING_PLAN

Status: **ACTIVE IMPLEMENTATION PLAN — EIP V1**

Canonical architecture: `docs/architecture/PERFECT_FIT_TECHNICAL_INTEGRATION_CANON.md`

Working model: `docs/architecture/PERFECT_FIT_TECHNICAL_WORKING_MODEL.md`

## Principle

Build one connected element at a time. Do not treat modules as standalone products. Each implementation must fit the larger technical digital thread and preserve the EIP backend/integration boundary.

## Phase A — Workspace foundation

Current status:

- Project / Style / Variant hierarchy: established
- Metadata-driven module navigation: established
- Media: working frontend model established
- Stable reference convention: established
- Pattern Library: next active element

## Phase B — Pattern Library B1

Build `WorkspacePatternLibrary` in Perfect Fit using the same compact one-viewport design principles as Media.

B1 is **frontend/manual-first** and does not depend on a CLO licence or automated CAD integration.

Required first-version concepts:

- Pattern Library header
- active technical revision
- base/reference size
- Master Pattern view
- Size Sets view
- Other/Supporting Files view when useful
- selected-file inspector
- manual upload
- replace/delete/download interactions
- file status
- authoritative/supporting distinction
- provider/provenance
- intake method
- technical notes
- compact completeness information

Manual upload remains a permanent supported workflow after integrations exist.

The UI must not expose internal EIP mapping keys.

## Phase C — Continue Workspace modules

After Pattern Library B1 is coherent, move forward through the other Workspace modules rather than waiting for CLO connectivity.

Priority connected areas include:

- dedicated Size Set
- Sewing
- Tech Pack
- Change History
- then Measurements/POM
- Materials/BOM
- Fit/Avatar/3D
- Marker
- Costing as the connected model matures

Each module remains a piece of the same digital thread.

## Phase D — Pattern Library / Size Set refinement

As the neighbouring modules clarify the technical model, return to Pattern Library where necessary to refine relationships without introducing provider-specific assumptions.

A Size Set remains format-specific and represents the complete graded size range for that profile.

Support both physical packaging patterns:

- one file contains all sizes
- several physical files collectively cover all sizes

Display coverage such as `5 / 5 sizes` and identify missing sizes.

## Phase E — EIP V1 backend persistence

Once the frontend/domain contracts are sufficiently proven, define the minimum EIP V1 API and persistence required for durable storage.

Backend belongs to EIP, not Perfect Fit.

Manual-upload production path:

`Perfect Fit -> EIP Gateway/API boundary -> governed EIP technical/asset services`

Reuse existing EIP V1 governed structures where practical and add only what the proven working contract requires.

## Phase F — External provider integrations through EIP Gateway

Provider connectivity is intentionally deferred until licence/access and proven domain contracts are available.

All automated technical-software integration enters through the **EIP Gateway**.

Canonical flow:

`provider application/plugin -> EIP Gateway -> provider adapter -> governed EIP domain -> Perfect Fit/EIP UI`

Perfect Fit never connects directly to CLO, Gerber, Richpeace, Optitex, Lectra or another provider.

### CLO integration

When a CLO licence becomes available, implement the first CLO adapter against the already-proven contracts.

Initial CLO goals may include:

- identify linked variant/revision
- push/pull pattern source files
- transfer format/type metadata
- transfer grading/size information where available
- later POM, BOM, materials, 3D, render, animation and Tech Pack data
- update synchronization/provenance status

The CLO connector must not replace manual upload.

### Additional adapters

After the adapter contract is proven, add providers without changing the permanent domain model:

- Gerber / AccuMark
- Richpeace
- Optitex
- Lectra
- others as required

Provider capability discovery determines which automated actions are available.

## Phase G — Industrial continuation

Keep the domain distinctions clear as the Workspace expands:

`Pattern -> Grading -> Size Sets -> Measurements/POM -> BOM -> Sewing -> Operations -> Marker -> Consumption -> BOQ/Cost -> Production Release`

External engines can contribute technical data or specialist processing; EIP owns governance, manufacturing interpretation and ERP execution.

## Phase H — V2 migration

Only after the V1 technical workflow is proven:

- map proven contracts into V2 kernel concepts
- migrate backend/integration logic deliberately
- migrate Perfect Fit/EIP frontend surfaces as appropriate
- preserve references, provenance and revision semantics

Do not interrupt the current V1 build to prematurely duplicate incomplete functionality in V2.

## Immediate next task

Implement **Pattern Library B1 with manual upload and vendor-neutral metadata**. Do not build CLO connectivity now. Once B1 is complete, continue to the next Workspace section and return to external integrations later through the EIP Gateway.
