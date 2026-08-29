# Codex Implementation Brief — Perfect Fit Workspace Visual Rebuild + Pattern Library B1

Status: **ACTIVE IMPLEMENTATION BRIEF — EIP V1**

This brief is intentionally precise. Do not reinterpret the architecture, invent a new workspace, or replace working modules with generic UI.

## 0. Scope and repository

Work only in the active V1 repository:

`mstefm55/EIP-ecom-v1.0`

Current frontend application:

`apps/samara-web/my-vite-react-app`

Perfect Fit is the frontend. EIP owns backend/integration. Do not create CLO/EIP Gateway connectivity in this task.

Before editing, inspect the actual current Workspace implementation, metadata source, module registry and existing Media component. Do not assume paths from this document if the repository has moved them. Reuse the existing metadata-driven architecture rather than replacing it.

## 1. Primary objective

Rebuild the **visual shell and Overview experience of the current Perfect Fit Workspace** so that its desktop appearance closely matches the supplied reference screenshot while preserving Perfect Fit's existing information architecture and functionality.

The reference is a warm, restrained, premium fashion-development workspace with:

- warm off-white canvas
- very light warm-gray borders
- subtle surface separation instead of strong shadows
- compact spacing
- rounded but not bubbly controls/cards
- dark charcoal typography
- soft muted gray secondary text
- pale warm-gray selected states
- minimal color used only for status/priority/accent
- dense professional desktop layout

The visual match is more important than copying the reference content literally. Perfect Fit has different modules and fields; preserve our domain content while adopting the reference's proportions, spacing, hierarchy, borders, typography and component treatment.

## 2. Non-negotiable preservation rules

1. **Do not touch the Media module's internal UI or behavior.** Media is already accepted. Workspace-level shell/tab styling may naturally surround it, but do not rewrite `WorkspaceMedia`, its upload/editor logic, IndexedDB logic, placement roles, visibility rules, or its internal layout.
2. Preserve the existing metadata-driven Workspace architecture and single `workspaceMetadata.js` source.
3. Preserve the current Project -> Style -> Variant hierarchy.
4. Preserve module order exactly:
   `Overview | Media | Pattern Library | Size Set | Sewing | Tech Pack | Change History`.
5. Keep the stable Workspace storage key unchanged. Do not create a new storage version/key and do not reset the user's existing local data.
6. Do not create new backend endpoints or database work in this task.
7. Do not connect directly to CLO, Gerber, Richpeace, Optitex, Lectra or EIP Gateway in this task.
8. Manual upload in Pattern Library is permanent and must remain even after future integrations.
9. Do not expose internal EIP mapping keys, technical metadata keys, UUIDs, adapter keys or developer-only identifiers in the visible UI.
10. Do not introduce CDN imports or remote icon imports. Reuse the icon package/system already installed in the repo.
11. Workspace modules must use Tailwind utility classes. **Do not create a new standalone CSS stylesheet for Workspace or Pattern Library.** Existing global/app styles may remain untouched unless a very small safe adjustment is truly required.
12. Do not add TODO comments, roadmap comments or implementation notes to production JSX.

## 3. Reference visual measurements and style target

The supplied reference screenshot is approximately `1235 x 560` and shows a dense desktop workspace.

Use the following visual language as the target. These are implementation anchors, not a reason to hardcode one screen size.

### Color family

Use warm neutrals rather than blue/gray SaaS styling.

Recommended Tailwind arbitrary values where existing design tokens do not already provide the same values:

- page/canvas: `#F7F6F2` / `#F8F7F3`
- primary surface: `#FCFBF8` / near white
- selected/hover surface: `#EFEEE8`
- subtle secondary surface: `#F4F2ED`
- border: `#E5E2DA`
- stronger border/divider: `#D9D5CC`
- primary text: `#272622`
- secondary text: `#6F6C65`
- tertiary text: `#918D84`

Do not overuse pure white, black, saturated beige or visible gradients.

### Borders and shadows

- dominant card/shell border: 1px warm gray
- border radius around 10–14px for cards/shells
- controls around 8–10px radius
- tags/pills may be fully rounded
- shadows should be extremely subtle or absent; use border/surface hierarchy first
- no heavy drop shadows, glassmorphism, gradients or oversized floating cards

### Typography

Use the application's existing font stack.

Approximate hierarchy:

- main style title: 24–28px, semibold, compact line-height
- section title: 14–16px, semibold
- field label: 11–12px, medium/semibold, muted
- field value: 12–14px, normal/medium
- tab: 11–13px, medium
- body: 12–14px

Avoid oversized page titles or marketing-style typography.

### Density

The reference is compact. Prefer:

- 8px / 12px / 16px spacing rhythm
- 28–36px control heights
- 40–48px tab bar height
- cards with roughly 14–18px internal padding
- no giant empty states occupying the page

## 4. Workspace shell layout

Do not blindly recreate the reference's leftmost global application navigation if Perfect Fit already has app-level navigation. Do not duplicate existing global navigation.

Inside the current Workspace, visually create the equivalent of the reference's **project tree + main work surface**.

Desktop target:

- outer workspace canvas fills available content width/height
- project/tree rail: approximately 220–250px
- main workspace surface: remaining width
- 1px divider between rail and main area
- minimal/no gap between these two sections so they read as one integrated workstation
- outer shell has one subtle warm border and approximately 12–14px radius
- avoid nested card-on-card-on-card styling

### Project/tree rail

Match the screenshot's restrained hierarchy:

- warm near-white background
- compact search input at top
- small square add button beside search if current workspace has/needs project creation entry
- collection/project/style/variant hierarchy uses small indentation increments
- selected row has pale warm-gray background with 8–10px radius
- selected row should not use bright accent colors
- chevrons/dots/icons small and muted
- row height around 30–34px
- labels 12–13px
- enough indentation to make hierarchy clear without wasting width
- preserve all current tree actions/selection behavior

If a global app sidebar already exists outside Workspace, leave it alone.

## 5. Main workspace header

The main pane should begin with a compact **style/variant identity header**, visually like the reference.

Target arrangement:

```text
[thumbnail 72–84px]  Style / Variant Name                         [stage/status control] [more]
                     [small chips / descriptors]
```

Use current Perfect Fit data. Do not hardcode `Aurelia Wrap Dress` except where it already exists as mock data.

### Thumbnail

- approximately 76x86 or similar portrait crop
- radius 8–10px
- `object-cover`
- if no image exists, use a restrained placeholder rather than a large empty-state panel
- use existing Media/variant information if available; do not change Media persistence to achieve this

### Identity block

Display the current style/variant title prominently.

Below it show compact chips only for meaningful existing metadata such as category/product type, material family, difficulty/development stage, season, or other existing fields. Do not invent fake attributes solely to fill the header.

Chips should use:

- subtle border
- pale warm background
- 22–26px height
- 11–12px text
- optional tiny icon only if already available

### Right-side controls

If development status/stage exists, present it as a compact select/button resembling the reference. Keep existing update behavior if available.

Add a compact overflow button only if there are real existing actions. Do not add non-functional decorative menus.

## 6. Module tabs

Immediately below the identity header place the existing module tabs in a single compact horizontal strip:

`Overview | Media | Pattern Library | Size Set | Sewing | Tech Pack | Change History`

Visual target:

- background almost white
- thin top/bottom or bottom divider
- 42–46px height
- compact horizontal padding
- active tab uses pale warm-gray filled surface OR subtle filled surface plus a short dark underline, visually matching the reference
- inactive tabs remain text-only and quiet
- no bright colored active state
- keep horizontal scrolling graceful at narrower widths
- do not reorder or rename modules without metadata justification

## 7. Overview tab — significant redesign required

The Overview is currently the module that needs the largest visual/content presentation improvement.

Do not turn it into a dashboard of KPI cards. It should feel like a **fashion product development overview**.

### 7.1 Primary Product Overview card

Top of Overview content should be a broad bordered card with a compact header row:

```text
Product Overview                                              [Edit]
```

Only show Edit if current editing mechanics actually support it. Reuse current `onChange`/metadata behavior rather than implementing a separate editing subsystem.

Inside, use a responsive information grid similar to the reference.

Desktop target: 4 columns x 2 rows of concise properties.

Use existing metadata fields where available. Preferred semantic order:

Row 1:
- Style Code / Reference
- Category / Garment Type
- Season / Collection
- Development Stage / Status

Row 2:
- Designer
- Fit / Silhouette
- Size Range
- Priority

If exact fields differ in current metadata, map the closest existing governed fields. Do not invent database concepts just to mirror the screenshot.

Each item:

```text
Muted small label
Primary compact value
```

Status can be a restrained pill. Priority may use a tiny colored dot plus text, not a large badge.

### 7.2 Product image in Overview

At desktop widths, position a portrait product image on the right side of the overview area, approximately 145–175px wide and 210–250px high, similar to the reference.

The information grid occupies the larger left section.

At narrower widths, image may move below/above cleanly.

Use an existing variant/media image if available; otherwise render a tasteful neutral placeholder. Do not change `WorkspaceMedia` to achieve this.

### 7.3 Secondary cards

Below Product Overview, use a two-column row similar to the screenshot:

**Description**
- concise product/style description
- editable via existing field mechanics when supported

**Key Attributes**
- compact list/chips of meaningful existing attributes
- no fake lorem ipsum or generic AI-generated fashion phrases

If existing metadata contains technical summary, designer notes, construction intent, silhouette or target user fields, surface the most useful ones here rather than adding unrelated mock content.

### 7.4 Additional existing Overview fields

Do not delete valid existing Overview data. If current Overview contains fields not covered above, organize them below in restrained sections/cards using the same visual language.

Avoid long forms being visible all at once unless the current editing mode requires them.

## 8. Media module

**DO NOT REBUILD MEDIA.**

Required behavior:

- Existing Media workstation remains functionally and visually intact internally.
- Existing upload, inspector, roles, visibility, crop/resize, IndexedDB persistence and local metadata behavior remain unchanged.
- Only the common Workspace header/tab/shell around it may change.
- Regression-test navigation away from Media and back, browser refresh, selected image, download/edit/delete, role assignments and persistent previews if current component supports them.

## 9. Pattern Library B1 — create/complete manually in this task

Pattern Library is a permanent technical module, not a temporary placeholder for CLO.

It must work today with **manual upload**. Later EIP Gateway/provider integrations add other intake channels without replacing manual upload.

### 9.1 Domain principles

- `Pattern Catalogue` is commercial/public. This module is `Pattern Library`, the technical repository for one variant.
- One technical revision can have an explicit Base Reference Size.
- A technical revision changes when authoritative pattern content changes.
- Generating another output file/profile does not itself create a new technical pattern revision.
- Manual upload remains permanently available.
- EIP/provider integrations are deferred. No API calls in this task.

### 9.2 Pattern Library top bar

Use the same visual language as the rebuilt Workspace.

Compact top row:

```text
Pattern Library                 Revision R001   Base M                [Upload Pattern]
```

Where possible, Revision and Base Reference Size should be governed controls or derived from existing variant metadata rather than hardcoded.

Do not create a giant empty-state page when no files exist. Render the full workstation and show a compact empty message in the relevant list region.

### 9.3 Internal tabs

Use exactly these conceptual views unless the current metadata naming already provides an equivalent:

`Master Pattern | Size Sets | Supporting Files`

Do not use the old `Master / Graded / Output Files` model.

#### Master Pattern

Purpose: authoritative technical pattern source plus optional supporting source files for the active revision.

Rules:

- at most one authoritative master for one active technical revision
- files may be native/editable source types such as PACX or technical DXF depending on workflow
- authority is a governed role, not derived only from extension

#### Size Sets

A Size Set is format/output-profile-specific and represents the full available size range.

Example:

```text
DXF-AAMA                 5 / 5 complete
PDF · A0                 5 / 5 complete
PDF · A4 tiled           5 / 5 complete
PDF · Letter tiled       4 / 5 · XL missing
PDF · Projector          5 / 5 complete
```

A Size Set may contain:

- one physical file covering all sizes, OR
- several physical files whose combined coverage equals the complete size range.

A0/A4/Letter/Projector are output profiles, not standalone file-format concepts. Model as PDF + output profile where possible.

Do not duplicate the top-level Variant `Size Set` module. Pattern Library's Size Sets represent technical file/output containers; the dedicated Size Set module represents governed available sizing/grading state.

#### Supporting Files

For reference/supporting technical assets that are not the authoritative Master and not a format-specific Size Set container.

Examples may include AI technical artwork, 1:1 reference PNG, archive ZIP, supplier reference, or other technical support files.

### 9.4 Pattern Library workstation layout

Desktop target:

- compact summary/top bar
- internal tab row
- main body split approximately 65–70% list/table and 30–35% selected-item inspector
- one dense viewport-style workstation, consistent with Media

Left side should be a clean table/list, not oversized cards.

Recommended columns depending on active view:

- Reference / File
- Type / Format
- Coverage (Size Sets)
- Status
- Updated

Use subtle row separators and warm selected-row background.

Right inspector for selected master/file/set:

- stable human reference
- original filename
- technical role
- format
- output profile if relevant
- source provider
- intake method
- covered sizes
- status
- authoritative/supporting state where relevant
- technical notes
- created/updated information
- actions: Download / Replace / Delete as applicable

Do not expose local IndexedDB IDs or internal object keys.

### 9.5 Manual upload flow

`Upload Pattern` must open a compact modal/drawer matching the workspace visual language.

Required fields/behavior:

1. File picker / drag-drop area
2. Destination:
   - Master Pattern
   - Existing/new Size Set
   - Supporting Files
3. Source provider dropdown:
   - Manual / Unspecified
   - CLO
   - Gerber / AccuMark
   - Richpeace
   - Optitex
   - Lectra
   - Other
4. Intake method is internally `MANUAL_UPLOAD` for every manually selected local file even when `sourceProvider = CLO`.
5. Technical type/format classification. Support at minimum:
   - CLO Project `.zprj`
   - CLO Garment `.zpac`
   - CLO Pattern `.pacx`
   - DXF-AAMA
   - DXF-ASTM
   - Adobe Illustrator `.ai`
   - PDF + A0
   - PDF + A4 tiled
   - PDF + Letter tiled
   - PDF + Projector
   - PNG 1:1 reference
   - ZIP
   - Other
6. Do not infer AAMA vs ASTM solely from `.dxf`; user must be able to choose/correct it.
7. Do not infer A0/A4/Letter/Projector solely from `.pdf`; user must choose/correct output profile.
8. For Size Set uploads, show variant expected sizes and allow assigning covered sizes. Support one file covering all sizes or subset coverage.
9. For Master Pattern, allow `Authoritative` vs `Supporting` role. Enforce one authoritative Master per revision.
10. Status options:
    - Draft
    - In Review
    - Approved
    - Superseded
11. Technical Notes textarea
12. Confirm upload

### 9.6 Stable references

Use stable human-readable references derived from the existing style/variant reference convention.

Example:

`AM-AUR-001-V01-PAT-001`

Do not encode mutable role, revision, format or source provider into the permanent file identity unless the current established reference convention explicitly requires it.

The internal UUID/object ID and human reference are separate concepts.

### 9.7 Frontend persistence for B1

Until EIP backend storage is connected:

- Pattern Library metadata may use the existing Workspace local state/localStorage model.
- Actual manually uploaded file binaries should use IndexedDB, following the same prototype persistence principle already used for Media.
- Do not store raw `File` objects or blob URLs in localStorage.
- Regenerate download/blob URLs from IndexedDB when needed.
- Deleting a Pattern Library file must delete its stored binary too.
- Replacing a file must update the binary without destroying the stable Pattern Library identity unless the user intentionally creates a new technical revision.

Do not change the existing global Workspace storage key.

### 9.8 Future integration readiness — no implementation yet

The B1 model must leave room for:

- `sourceProvider`
- `intakeMethod`
- external/source reference
- sync status
- last synchronization

But do not show meaningless sync controls while no integration exists and do not call the EIP Gateway.

Future route is:

`CLO/Gerber/Richpeace/Optitex/Lectra -> EIP Gateway -> EIP adapter/services -> governed Pattern Library`

Manual upload continues alongside that future path.

## 10. Metadata requirements

Continue using the single existing `workspaceMetadata.js`.

Add/update locale labels and governed option codes there rather than creating `patternMetadata.js` or another metadata file.

Visible labels must come through the existing localization pattern where the Workspace already supports it.

Governed dropdown values should use stable code + label semantics. User-entered notes/descriptions remain free text.

Do not rename/change the existing stable `storageKey`.

## 11. Responsive behavior

Primary target is desktop professional use.

At medium widths:

- project rail may narrow
- module tabs may horizontally scroll
- Overview image may move below information grid
- Pattern Library inspector may stack below table

Do not collapse desktop into a mobile-card layout at normal laptop widths.

## 12. Implementation method

Before coding:

1. inspect current Workspace, Overview rendering, metadata, module registry, App integration and Media component;
2. identify the smallest file set required;
3. preserve working behavior;
4. implement shell + Overview;
5. regression-test Media;
6. implement Pattern Library B1;
7. build/run and fix all console/build errors.

Do not perform broad unrelated refactors.

## 13. Acceptance criteria

The task is complete only when all of the following are true:

- Workspace visually reads like the supplied premium warm-neutral reference rather than a generic SaaS dashboard.
- Main workspace header, project tree, tabs, borders, spacing and typography closely follow the reference visual language.
- Overview is substantially improved and looks like a professional fashion product-development overview.
- Existing Overview data/metadata behavior is preserved.
- Media internal UI/behavior has not been rewritten or regressed.
- Module order is unchanged.
- Pattern Library renders as a full compact workstation even with zero files.
- Manual upload works without CLO.
- Pattern Library supports Master Pattern, format-specific Size Sets and Supporting Files.
- One authoritative Master per active technical revision is enforced.
- Size Set coverage supports one combined file or multiple physical files.
- Ambiguous DXF/PDF classifications are user-correctable.
- Pattern Library binary persists across refresh using IndexedDB during the prototype phase.
- No EIP Gateway/CLO integration is implemented yet.
- No duplicate metadata file is introduced.
- Stable Workspace storage key is unchanged.
- No CDN dependency is introduced.
- No new standalone Workspace/Pattern Library CSS file is created.
- Project builds successfully and browser console is free from new errors.

## 14. Final Codex response required

When finished, report only:

1. files changed/created;
2. concise explanation of what changed in Workspace shell, Overview and Pattern Library;
3. confirmation Media internals were not modified;
4. build/test command run and result;
5. any genuinely unresolved issue.

Do not return a future roadmap or propose additional refactors unless a blocking issue requires one.
