# PERFECT_FIT_TECHNICAL_INTEGRATION_CANON

Status: **LOCKED ARCHITECTURE — ACTIVE ON EIP V1**

## 1. Current implementation target

The active implementation target is **EIP V1** in `mstefm55/EIP-ecom-v1.0`.

Perfect Fit is the current frontend development application and Sandbox/Workspace experience. All backend services, persistence, governance, workflow, integrations and external software adapters belong to EIP.

EIP V2 is a later migration target. This document does not authorize moving current Perfect Fit implementation work to V2.

## 2. Product ownership boundary

### Perfect Fit

Perfect Fit owns the user-facing development experience:

- Workspace / Sandbox UI
- Project, style and variant navigation
- Media UI
- Pattern Library UI
- Size Set UI
- Sewing UI
- Tech Pack UI
- Change History UI
- later measurement, fit, avatar/3D, materials, marker, costing and related development experiences

Perfect Fit must remain a frontend consumer of governed EIP services. It must not become a second backend or own durable integration/business rules that belong to EIP.

### EIP

EIP owns:

- backend API
- PostgreSQL data and durable business records
- authentication, tenant isolation and authorization
- assets and documents
- technical revision governance
- workflow and approvals
- audit/change history
- integration credentials and connection state
- EIP Gateway
- external CAD/3D/marker adapters
- synchronization jobs
- file transfer and transformation services
- manufacturing logic
- BOM, BOQ and material planning
- measurement/POM data
- operation bulletin, SAM/SMV and routing
- marker/cut planning
- production release and later ERP execution

The frontend may temporarily use mock/local data during UI development, but the target owner of durable state remains EIP.

## 3. System-of-record principle

**EIP is the system of record. Perfect Fit is a frontend. External technical applications are specialist engines.**

External applications must not define EIP's permanent domain model.

Examples of external engines include:

- CLO 3D
- Gerber / AccuMark
- Richpeace
- Optitex
- Lectra
- future CAD, marker, PLM, CAM, body-scan, rendering or manufacturing engines

CLO is the first planned deep integration, but EIP must remain vendor-neutral.

## 4. Gateway and adapter architecture

All external technical-system connectivity enters EIP through the **EIP Gateway**.

Canonical integration path:

`External technical application / plugin -> EIP Gateway -> EIP adapter/integration service -> governed EIP domain/services -> Perfect Fit or EIP ERP UI`

Perfect Fit must not connect directly to CLO, Gerber, Richpeace, Optitex, Lectra or another technical engine.

The browser must not own integration credentials, provider authentication, synchronization rules or provider-specific business logic.

Every external technical system connects behind the Gateway through an adapter or connector contract.

A provider may expose capabilities such as:

- pattern import/export
- native source-file transfer
- grading read/write
- size-range extraction
- POM/measurement extraction
- BOM extraction
- materials/fabrics
- colorways
- 3D assets
- avatars
- simulation
- fit evidence
- rendering
- animation
- tech-pack extraction
- nesting/marker functions
- production marker functions
- cut-planning functions

The UI requests a business operation such as `Open in CAD`, `Sync Measurements`, `Generate Size Set`, or `Generate Marker`; EIP selects/uses the connected provider capability behind the Gateway. Permanent UI/domain semantics must not be hardcoded to CLO.

The exact Gateway route contract is defined only when the integration implementation begins; it must not be invented prematurely in the frontend.

## 5. Technical digital thread

The connected technical lifecycle is:

`Project -> Style -> Variant -> Pattern Revision -> Grading -> Size Sets -> Measurements/POM -> Materials/BOM -> Sewing Construction -> Operations -> Marker -> Consumption -> BOQ/Cost -> Production Release`

Additional linked branches include:

`Variant -> 3D Garment -> Avatar/Fit -> Render/Animation -> Media`

and:

`Pattern Revision -> Change History -> dependency invalidation -> regenerated technical outputs`

Every implementation must be evaluated by how it participates in this larger digital thread.

## 6. Pattern terminology

### Pattern Catalogue

Customer-facing commercial catalogue used to browse, purchase or consume patterns.

### Pattern Library

Technical repository for a specific variant.

The Pattern Library owns technical source patterns, revisions and format-specific Size Sets. It is not the commercial Pattern Catalogue.

## 7. Pattern revision model

A technical pattern revision represents a change to authoritative technical pattern content.

Example:

`R001 -> R002 -> R003`

Generating a new derivative/output format does not by itself create a new technical revision.

The approved base/reference size is explicit and belongs to the technical development context.

## 8. Size Set model

A **Size Set is format-specific and represents the complete available graded size range for that format**.

Example for sizes `XS S M L XL`:

- PACX Size Set: XS–XL
- DXF-AAMA Size Set: XS–XL
- DXF-ASTM Size Set: XS–XL
- PDF A0 Size Set: XS–XL
- PDF A4 tiled Size Set: XS–XL
- PDF Letter tiled Size Set: XS–XL
- Projector PDF Size Set: XS–XL

A Size Set may be physically packaged as one file containing all sizes or multiple files where each file covers one or more sizes. EIP models the set independently from physical packaging.

## 9. Source and provenance

Technical assets must be able to retain vendor-neutral provenance including:

- source provider
- intake method
- external/source reference where applicable
- source revision
- EIP revision
- source file type
- derivative/output type
- sync direction where applicable
- sync status where applicable
- last synchronization where applicable
- who initiated the upload/synchronization
- files generated/received
- dependency/revision relationship

Typical source providers include `MANUAL`, `CLO`, `GERBER`, `RICHPEACE`, `OPTITEX`, `LECTRA`, and `OTHER`.

Manual upload is a first-class intake path. It must remain available even after automated provider integrations are introduced.

## 10. CLO integration model

CLO integration belongs to EIP, while Perfect Fit exposes the user experience.

There is **no active CLO integration dependency during the current frontend build** because a CLO licence is not yet available.

Current phase:

`Perfect Fit manual upload -> Pattern Library frontend model`

Future production/manual-upload path:

`Perfect Fit -> EIP Gateway -> governed EIP asset/technical services`

Future CLO-authoring path:

`CLO EIP plugin/adapter -> EIP Gateway -> EIP integration services -> governed EIP technical domain`

A Python plug-in/service may later act as the CLO-specific adapter, but Fastify/EIP remains the authoritative business API and system of record.

CLO integration is deferred until the Workspace technical modules and their vendor-neutral contracts are sufficiently proven.

## 11. Licensing/business boundary

EIP never shares or sublicenses a CLO licence.

- Perfect Fit development-service work may be performed by the licensed Perfect Fit operator using their own valid CLO licence and delivered to clients through EIP/Perfect Fit.
- Freelance designers who author in CLO connect their own eligible CLO licence.
- Brands/factories that author in CLO connect their own appropriate CLO licence.
- EIP-only collaborators consume synchronized technical data and outputs without being given access to another user's CLO licence.
- Automated multi-tenant use of a single CLO installation is not assumed to be licensed and must not be implemented as a commercial entitlement without written CLO authorization.

## 12. Industrial boundaries

The architecture must preserve fashion-industry distinctions.

- graded size range != physical output file
- Size Set != marker
- print layout != industrial marker
- marker != lay plan
- lay plan != cut order
- seam relationship != factory sewing operation
- BOM != BOQ
- POM/measurement specification != body-size recommendation
- technical 3D simulation != AI marketing try-on

CLO or another CAD/3D engine may supply technical inputs, but EIP owns the manufacturing and ERP interpretation.

## 13. Holistic implementation rule

Implementation is incremental but never isolated.

For each new element:

1. define its place in the digital thread;
2. define vendor-neutral data semantics;
3. build the smallest working Perfect Fit UI;
4. support manual data/file intake where the provider integration is not yet available;
5. preserve the future EIP Gateway/API/integration boundary;
6. move to the next connected Workspace element once the current UI contract is coherent;
7. return later to provider integration without redesigning the frontend/domain contract;
8. avoid speculative tables/services unless the next working step requires them.

## 14. Current next element

The next element is **Pattern Library B1**.

B1 must provide a complete frontend working model including manual upload. It must be capable of representing files that could later originate from CLO, Gerber, Richpeace, Optitex, Lectra or another provider without requiring an active integration.

We will not wait for a CLO licence and we will not make CLO connectivity a dependency of completing B1.

After B1 is coherent, development moves to the other Workspace sections. Automated technical-software connectivity is a later integration pass through the EIP Gateway.

## 15. V2 migration rule

V1 is the active implementation source.

When EIP V2 migration begins, the domain contracts and proven behavior from V1 are migrated deliberately into V2's kernel/engine architecture. Current Perfect Fit work must not be prematurely rebuilt against V2 merely because V2 exists.
