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

## Phase B — Pattern Library

### B1. Vendor-neutral frontend model

Build `WorkspacePatternLibrary` in Perfect Fit using the same compact one-viewport design principles as Media.

Required first-version concepts:

- Pattern Library header
- active technical revision
- base/reference size
- Master Pattern view
- Size Sets view
- Other/Supporting Files view if required
- selected-file inspector
- upload/replace/delete/download interactions
- file status
- authoritative/supporting distinction
- source provider/provenance
- technical notes
- compact completeness information

Do not expose internal EIP mapping keys in the designer-facing UI.

### B2. Real CLO-originated manual file proof

Use a real file exported/saved from CLO and prove that the Pattern Library can host it correctly.

For the first proof capture:

- variant
- pattern revision
- base/reference size
- source provider = CLO
- source/native type
- technical role
- file name
- governed format/profile
- covered sizes where applicable
- authoritative/supporting status
- created/updated timestamps

The first proof is manual intake. No CLO API automation is required yet.

### B3. Size Set model

Implement one Size Set per supported format/output profile. Each Size Set represents the complete available size range.

Support both packaging patterns:

- one file contains all sizes
- several physical files collectively cover all sizes

Display coverage such as `5 / 5 sizes` and identify missing sizes.

### B4. V1 backend contract

After the frontend/data model is proven, define the minimum EIP V1 API and persistence contract required for durable Pattern Library storage.

Backend belongs to EIP, not Perfect Fit.

Avoid premature schema expansion: reuse existing EIP V1 asset/document/governed structures where practical and add only what the working contract requires.

### B5. CLO connector proof

Build the first CLO integration only after B1–B4 are stable.

Target flow:

`CLO -> EIP adapter/plugin -> EIP API -> Pattern Library`

Initial automatic capabilities should focus on:

- identify linked variant/revision
- push a pattern/source file
- transfer format/type metadata
- transfer size/grading information where available
- update sync status

The same Pattern Library contract must continue to support manual files and future Gerber/Richpeace/Optitex/Lectra adapters.

## Phase C — Size Set

Connect Pattern Library grading/format coverage to the dedicated Size Set module.

The Size Set module must not duplicate Pattern Library files. It represents the technical available size range and its governed relationship to the approved base/reference size and grading state.

## Phase D — Measurements / POM

Introduce measurement specifications and CLO/provider extraction after pattern/size semantics are stable.

Prepare for:

- POM definition
- target measurement
- tolerance
- size values
- provider-extracted measurements
- revision comparison
- fit/QC use

## Phase E — Materials / BOM

Connect design materials to EIP material masters.

Prepare for:

- fabric/trims
- colorways
- supplier/material mapping
- BOM revisions
- provider extraction
- later inventory/cost sourcing

## Phase F — Sewing / operations

Keep the distinction:

`CAD seam/construction relationship -> EIP sewing construction -> factory operation bulletin`.

Later add:

- machine class
- attachments
- SAM/SMV
- skills
- precedence
- quality checkpoints
- routing

## Phase G — 3D / avatar / fit / media generation

Use external engines as sources for:

- 3D garment
- avatars
- simulation evidence
- fit review
- renders
- animation

Perfect Fit/EIP governs the resulting asset, role, visibility and revision context.

## Phase H — Marker / cutting

Build EIP's marker/cutting domain independently of any single nesting engine.

External providers can supply nesting/marker capabilities, but EIP must own:

- marker plan identity/revision
- size ratio
- fabric width/rules
- marker consumption
- production quantity relationship
- later lay plan
- roll/shade allocation
- cut order

## Phase I — BOQ / costing / production dependency

Combine technical inputs with ERP data:

- BOM
- order quantity
- size/color mix
- marker consumption
- waste/shrinkage
- material inventory/prices
- labor routing

Generate BOQ, shortages and cost implications in EIP.

## Phase J — Additional technical adapters

After the CLO adapter contract works, add providers without changing the permanent domain model:

- Gerber / AccuMark
- Richpeace
- Optitex
- Lectra
- others as required

Provider capability discovery determines which actions are available.

## Phase K — V2 migration

Only after the V1 technical workflow is proven:

- map proven contracts into V2 kernel concepts
- migrate backend/integration logic deliberately
- migrate Perfect Fit/EIP frontend surfaces as appropriate
- preserve references, provenance and revision semantics

Do not interrupt the current V1 build to prematurely duplicate incomplete functionality in V2.

## Immediate next task

Design and implement **Pattern Library B1**, prepared to host the first real CLO-originated pattern file in B2.
