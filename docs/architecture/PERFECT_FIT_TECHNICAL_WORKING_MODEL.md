# PERFECT_FIT_TECHNICAL_WORKING_MODEL

Status: **ACTIVE WORKING MODEL — EIP V1**

Canonical architecture: `docs/architecture/PERFECT_FIT_TECHNICAL_INTEGRATION_CANON.md`

## 1. Delivery principle

**Holistic architecture, incremental implementation.**

Every feature is one connected element of the same technical digital thread. We implement the smallest working element, prove it, then connect the next dependency.

## 2. Active system boundary

### Perfect Fit

Perfect Fit is the frontend development application and Workspace/Sandbox.

It renders and orchestrates user interaction for:

- Project
- Style
- Variant
- Media
- Pattern Library
- Size Set
- Sewing
- Tech Pack
- Change History
- later Measurements/POM
- Materials/BOM
- Fit/Avatar/3D
- Marker
- Costing

### EIP V1

EIP V1 owns all backend and integration responsibilities:

- API
- PostgreSQL
- authentication/RBAC/tenant isolation
- governed technical records
- durable asset/document storage
- revisioning and audit
- workflow/approval
- external CAD/3D/marker connectors
- synchronization and file transfer
- manufacturing calculations and ERP services

Temporary browser/local persistence is acceptable only while a frontend element is being prototyped.

## 3. Vendor-neutral technical model

Permanent EIP objects are expressed in industry/business terms rather than provider terms.

Examples:

- Pattern Revision
- Base Reference Size
- Grading
- Size Set
- Measurement/POM
- Material/BOM
- BOQ
- Sewing Construction
- Operation Bulletin
- Marker Plan
- Lay Plan
- Cut Order
- 3D Asset
- Avatar/Fit Evidence
- Tech Pack
- Production Release

CLO, Gerber, Richpeace, Optitex, Lectra and future systems are providers/adapters, not permanent domain types.

## 4. Current Workspace hierarchy

`Workspace -> Project -> Style -> Variant`

Variant modules currently:

`Overview | Media | Pattern Library | Size Set | Sewing | Tech Pack | Change History`

Global sizing tools remain outside the style/variant hierarchy.

## 5. Pattern Library working model

Pattern Library is the technical pattern repository for one variant.

It must support:

- technical pattern revision
- explicit base/reference size
- authoritative/master pattern source
- supporting source files
- format-specific Size Sets
- physical files belonging to a Size Set
- provenance/source provider
- source and derived output distinction
- status/approval
- notes
- future sync status

### Size Set rule

One Size Set exists for each available output/file profile and represents all available graded sizes for that profile.

Example size range: `XS S M L XL`.

Possible Size Sets:

- PACX
- DXF-AAMA
- DXF-ASTM
- PDF A0
- PDF A4 tiled
- PDF Letter tiled
- Projector PDF

A Size Set can contain one physical file covering all sizes or multiple physical files covering individual/subsets of sizes.

### First integration proof

The first Pattern Library milestone is manual intake of a real CLO-originated pattern file.

The system must capture the file and vendor-neutral technical metadata correctly before automatic CLO transfer is introduced.

## 6. Provider adapter model

Each provider exposes a capability contract. Example capabilities include:

- source file import/export
- pattern geometry
- grading
- measurements/POM
- BOM/materials
- colorways
- 3D garment
- avatar
- fit/simulation
- rendering
- animation
- tech-pack extraction
- nesting
- marker
- cut planning

Perfect Fit requests business actions. EIP invokes the connected adapter.

## 7. CLO first, not CLO-only

CLO is the first deep technical integration because it can contribute pattern, grading, POM, BOM, materials, 3D, simulation, render, animation and technical output data.

CLO-specific integration belongs behind EIP. Perfect Fit must not embed CLO-specific persistence/business rules into Pattern Library or other permanent modules.

## 8. Industrial continuation

The larger thread extends beyond design:

`Pattern -> Grading -> Size Sets -> Measurements -> BOM -> Sewing -> Operations -> Marker -> Consumption -> BOQ/Cost -> Production Release`

EIP may use different specialist engines at different lifecycle stages. A style may begin in CLO and later use Gerber/Richpeace/Optitex/Lectra for industrial pattern/marker work while EIP preserves the digital thread.

## 9. Dependency rule

Changes to authoritative upstream technical objects can make downstream objects stale.

Example:

`Pattern R003 -> R004`

may require:

- regrading
- regeneration of Size Sets
- measurement review
- marker review/regeneration
- consumption recalculation
- costing recalculation
- Tech Pack update

The working model must leave room for dependency invalidation even if the first UI version does not automate it yet.

## 10. V2 migration

Do not implement current Perfect Fit work directly against V2.

Once the V1 contracts and behavior are proven, migrate them deliberately into the V2 kernel/engine model.
