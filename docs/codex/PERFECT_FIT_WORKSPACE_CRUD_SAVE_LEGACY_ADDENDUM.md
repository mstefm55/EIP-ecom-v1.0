# Codex Addendum — Workspace Tree CRUD, Save Action, Legacy Workspace -> Workspace 2

Status: **REQUIRED ADDENDUM**

Apply this together with:

`docs/codex/PERFECT_FIT_WORKSPACE_VISUAL_REBUILD_AND_PATTERN_LIBRARY_B1.md`

This addendum overrides any earlier ambiguity about tree actions, save behavior and the old legacy workspace.

## 1. Project tree must support Create / Edit / Delete

The current project tree cannot be display-only.

The visible tree hierarchy remains:

`Project -> Style -> Variant`

Do not add new hierarchy levels in this task.

### 1.1 Required actions

Users must be able to:

- create a Project
- edit a Project
- delete a Project
- create a Style inside a Project
- edit a Style
- delete a Style
- create a Variant inside a Style
- edit a Variant
- delete a Variant

These are frontend Workspace actions for the current V1 prototype/state model. Do not create backend APIs in this task.

### 1.2 Action placement

Keep the tree visually clean and close to the approved warm-neutral reference.

At the top of the tree rail, beside the project search input, keep/add one compact square `+` button.

Behavior of the top `+` button:

- opens creation for a new **Project**
- does not directly create a Style or Variant because those require a parent context

For each Project and Style row, expose a compact contextual overflow action (`...`) on hover/focus/selected state.

Project row menu:

- Add Style
- Edit Project
- Delete Project

Style row menu:

- Add Variant
- Edit Style
- Delete Style

Variant row menu:

- Edit Variant
- Delete Variant

Do not permanently show large Edit/Delete buttons beside every row. Keep actions compact and contextual.

The currently selected dark Variant row must still have access to its overflow menu without breaking the selected-row visual.

### 1.3 Create/Edit modal behavior

Use one compact reusable modal/dialog pattern matching the Workspace visual system.

Do not create three unrelated oversized forms.

Project create/edit should expose only current meaningful Project fields already supported by metadata/state, with Name required.

Style create/edit should expose current meaningful Style fields, with Name required. Preserve existing style reference/code behavior; do not regenerate an existing stable reference simply because the display name is edited.

Variant create/edit should expose current meaningful Variant fields, with Name required. Preserve existing stable variant reference/code behavior on rename.

If existing metadata already defines fields used by Overview, reuse those definitions rather than inventing a parallel form schema.

### 1.4 Stable identity rule

Renaming a Project, Style or Variant changes its display data only.

It must **not** silently replace the internal object identity or an already-established stable human reference.

Creation may generate a new stable identity/reference using the existing convention.

### 1.5 Delete behavior

Deletion must require explicit confirmation.

Delete Variant confirmation must identify the Variant being deleted.

Delete Style confirmation must warn that its child Variants will also be removed from the current Workspace state.

Delete Project confirmation must warn that its child Styles and Variants will also be removed from the current Workspace state.

Do not silently cascade-delete without confirmation.

After deletion:

- remove deleted object(s) from the Workspace state
- clear invalid current selections
- select the nearest valid parent/sibling where practical
- do not leave the main pane pointing at an object that no longer exists

No backend deletion is required yet.

### 1.6 Empty tree behavior

If no Projects exist, still render the complete Workspace shell.

Show a compact message inside the tree area and keep the top `+` button available.

Do not replace the whole Workspace with a giant empty-state screen.

## 2. Add an explicit Save action to the Workspace module/tab header

The current module/tab area must include a clear Save action.

### 2.1 Placement

Place the Save button on the **right side of the module tab strip/header region**, visually aligned with the module navigation rather than floating inside individual module content.

Conceptually:

`Overview | Media | Pattern Library | Size Set | Sewing | Tech Pack | Change History                         [Save]`

At narrower widths, preserve tab scrolling and keep Save reachable; do not allow the button to disappear behind horizontal overflow.

### 2.2 Save semantics

For the current V1 frontend prototype, Save means:

- commit the current Workspace state through the existing Workspace persistence mechanism
- retain the existing stable `storageKey`
- persist metadata/state changes already represented by the Workspace
- do not attempt backend/EIP Gateway persistence in this task

Do not create a second persistence store merely for Save.

### 2.3 Dirty-state behavior

Track whether the Workspace contains unsaved metadata/state changes.

Required states:

- clean: Save button quiet/disabled or visually subdued
- dirty: Save button enabled and clearly available
- saving: short disabled/loading state if applicable
- saved: state returns to clean after successful local persistence

Changes that should mark the Workspace dirty include at minimum:

- Project/Style/Variant create
- Project/Style/Variant edit
- Project/Style/Variant delete
- Overview field edits
- Pattern Library metadata changes
- module field changes made through the shared Workspace `onChange` path

Do not mark simple navigation/tab selection as dirty.

Media already has working binary/local persistence behavior. **Do not rewrite Media internals simply to force it through this Save button.** The common Workspace metadata/state may still participate in the existing Workspace persistence path.

### 2.4 Navigation with unsaved changes

Do not add aggressive browser confirmation prompts in this task unless the current application already has such a pattern.

The Save indicator/button is sufficient for now.

## 3. Move the old legacy Workspace completely to `Workspace 2`

There is still an old/legacy Workspace implementation visibly rendered on the current Workspace page. This must be separated now.

### 3.1 Required result

Primary `Workspace` route/page:

- renders only the new metadata-driven Perfect Fit Workspace
- does not render the old legacy/DynamicLayout Workspace above, below, behind or alongside it
- contains no duplicated legacy form/layout after the new Workspace content

`Workspace 2` route/page:

- owns/renders the old legacy Workspace implementation for comparison/reference
- keeps that old functionality intact as much as practical
- is clearly separated from the primary Workspace

Do **not** delete the legacy implementation unless it is an exact duplicate file proven unused after moving its render target.

### 3.2 How to perform the move

Before editing, inspect `App.jsx`, navigation descriptors, routes/view switching, Workspace components and any old `DynamicLayout`/legacy Workspace imports.

Find the exact legacy component/block currently being rendered on the primary Workspace page.

Then:

1. remove that legacy render/import dependency from the primary Workspace path;
2. attach it to the existing `Workspace 2` destination;
3. if `Workspace 2` already wraps a legacy component, ensure the old block is rendered there exactly once, not duplicated;
4. preserve existing navigation label `Workspace 2`;
5. do not rename the new primary Workspace to Workspace 2;
6. do not route Media or Pattern Library through the legacy component.

### 3.3 No visual contamination

Styles/classes from the legacy Workspace must not alter the new Workspace shell.

If legacy global selectors are causing visible contamination, scope the legacy wrapper/classes narrowly rather than redesigning the legacy UI.

Do not create a broad CSS rewrite for the legacy page.

## 4. Visual treatment of tree action controls

The supplied current tree screenshot is visually accepted as the base direction. Preserve its character:

- cream/warm-white card
- warm brown/charcoal typography
- dark selected Variant row
- outlined icon tiles
- uppercase small hierarchy labels
- generous but controlled indentation

Add CRUD controls without cluttering this presentation.

Recommended visual behavior:

- top create button: 30–34px square
- row overflow: 26–30px square, transparent by default
- overflow becomes visible on hover/focus/selected row
- dropdown menu: warm white, 1px warm border, ~10px radius, subtle shadow only
- destructive Delete action uses a restrained destructive text treatment; do not make entire menus bright red
- selected dark Variant row overflow control must use a light/neutral icon state with visible hover

## 5. Acceptance checks added by this addendum

Do not consider the Workspace task complete until all are true:

- top `+` creates a Project
- Project menu can Add Style / Edit / Delete
- Style menu can Add Variant / Edit / Delete
- Variant menu can Edit / Delete
- create/edit forms preserve stable references on rename
- destructive actions require confirmation
- selection remains valid after deletion
- Save is visible at the right of the module/tab header
- Save has clean/dirty behavior
- Save persists through the existing Workspace storage mechanism
- navigation alone does not mark dirty
- Media internals remain untouched
- primary Workspace no longer shows any legacy workspace content
- old legacy Workspace is accessible under Workspace 2
- legacy Workspace is not rendered twice
- build succeeds
- no new console errors are introduced

## 6. Required Codex execution order

1. inspect actual current V1 Workspace/App/navigation files;
2. identify the legacy render currently contaminating primary Workspace;
3. move legacy render to Workspace 2 and verify primary Workspace is clean;
4. add tree CRUD actions using existing Workspace state model;
5. add shared create/edit/delete modal/menus;
6. add dirty tracking and Save control;
7. verify Overview and Pattern Library still work;
8. regression-test Media without changing its internals;
9. run build and fix all errors.

## 7. Final Codex report addition

In addition to the prior brief's required final report, explicitly state:

- where the legacy Workspace was previously rendered;
- where it is now rendered under Workspace 2;
- how tree CRUD is implemented;
- how dirty state / Save persistence works;
- confirmation that stable references are not regenerated on rename;
- confirmation that Media internals were not modified.
