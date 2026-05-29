# EIP Process Studio — Network View + Micro Builder Specification

Date: 2026-05-29  
Scope: EIP UI architecture and future implementation guidance  
Target: V1 preview/prototype first, V2/V24 governed production implementation later  
Status: Concept approved by user; do not implement blindly without staging.

## Executive decision

EIP Process Studio must have two complementary views:

1. **Process Network View** — the main/default view.
   - A neural-network-style enterprise process map.
   - Shows multiple processes and their trigger relationships.
   - Similar interaction feel to n8n / Visio / process intelligence maps.
   - Process nodes can be dragged visually.
   - Connections show triggers, creates/updates, reads/uses, notifications, conditions, API calls, document flows, object flows, and runtime state.

2. **Micro Process Builder View** — opened inside a modal.
   - User clicks a builder/edit icon on a process node in the network.
   - Opens a draggable modal about 70% viewport width and height.
   - Modal contains a single-process builder for the selected process.
   - Inside the modal, nodes are draggable and connectable.
   - Similar to n8n/Visio but governed by EIP backend metadata.

The main page is **not** the micro builder. The main page is the neural process network.

## Why this matters

EIP is not a traditional transaction-based ERP. The differentiator is that the business is represented as a process network:

```text
Object -> process -> trigger -> task/effect -> next process
```

The UI should show this as a live process nervous system:

```text
Customer Signup
  -> Account Verification
  -> KYC Verification
  -> Customer Onboarding
  -> Customer Portal Access

Payment Confirmed
  -> Order Fulfillment
  -> Create Access Grant
  -> Generate Download
  -> Notify Customer
```

The process network view must help users understand how the entire tenant operates, not only edit one workflow.

## Mandatory architecture rule

The React UI is only a visual editor. It must never become the source of business/process truth.

Backend/governed metadata must remain the authority for:

- process definitions
- trigger definitions
- process bindings
- task templates
- effect catalog
- effect parameters
- service object and service object category applicability
- document category/schema/lifecycle
- validation rules
- publishing rules
- runtime execution

The frontend may own only:

- visual layout position
- canvas zoom/pan state
- selected node state
- draft UI state before validation

## Two levels of interaction

### Level 1 — Process Network View

Default route/screen under Process Studio.

Purpose:

- Show all major processes in the tenant.
- Show how they connect through events/triggers and object/document/API flows.
- Show live runtime state overlay if available.
- Let user select a process and inspect its incoming/outgoing dependencies.
- Let user click a builder icon to open the Micro Builder modal.

User interactions:

```text
Single click process node
-> select node and show details panel

Double click process node
-> optional shortcut to open micro builder modal

Click builder/edit icon on process node
-> preferred method: open micro builder modal

Drag process node
-> update visual layout only, not process semantics

Drag a connection between process nodes
-> create draft/proposed trigger binding only
-> must not publish until backend validates

Click connection line
-> show trigger/relationship details

Zoom/pan canvas
-> local/canvas state
```

### Level 2 — Micro Process Builder Modal

Opened from the network by clicking the builder/edit icon on a process node.

Initial modal dimensions:

```text
Width: 70vw
Height: 70vh
Initial position: centered
Header: draggable handle
Resizable: optional later
Backdrop: light transparent overlay, not heavy blackout
```

Inside modal:

```text
Left panel: governed builder library
Center: single-process canvas
Right panel: node inspector
Bottom strip: validation/simulation/publish status
Top modal toolbar: process name, draft version, autosave, validate, save draft, publish, close
```

User interactions inside modal:

```text
Drag node from library
-> add process node to draft graph

Drag existing node
-> update node layout only

Connect two nodes
-> create draft transition/edge

Click node
-> edit governed metadata in inspector

Click Validate
-> backend validates against governance metadata

Click Publish
-> backend publishes process metadata if validation passes
```

## Visual concept baseline

The accepted concept is:

- EIP V24 / Hybrid Light style.
- Dark navy EIP identity sidebar.
- Light productivity canvas.
- Main area is Process Network View.
- Micro Builder opens as a floating modal on top of the network.
- The modal is 70% viewport width/height and draggable.
- Macro and micro canvases use the same visual language but different scale.

Do not produce a generic dashboard. Preserve the visual density and precision of the concept.

## Theme / design tokens

Before implementation, create or reuse EIP design tokens. Do not scatter random Tailwind values.

Suggested token intent:

```js
export const eipTheme = {
  colors: {
    navy900: '#061426',
    navy800: '#0b1f3a',
    blue600: '#2563eb',
    blue500: '#3b82f6',
    cyan500: '#38bdf8',
    canvas: '#f8fbff',
    panel: '#ffffff',
    border: '#dbe7f5',
    text: '#0f172a',
    muted: '#64748b',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    orange: '#f97316'
  },
  radius: {
    panel: '18px',
    node: '14px',
    button: '12px'
  },
  shadow: {
    panel: '0 18px 50px rgba(15, 23, 42, 0.12)',
    node: '0 10px 24px rgba(37, 99, 235, 0.12)',
    modal: '0 30px 90px rgba(15, 23, 42, 0.22)'
  }
};
```

Preferred overall styling:

```text
Sidebar: dark navy with EIP logo and active blue route.
Top bar: white/light glass.
Network canvas: pale grey-blue dotted grid.
Panels/cards: white, soft border, soft shadows.
Nodes: colored pastel cards with strong readable labels.
Edges: thin, color-coded, with small trigger labels.
Modal: white glass panel, strong shadow, rounded corners, draggable header.
```

## Recommended technical stack

Use a graph/canvas library rather than hand-coding SVG interactions.

Recommended:

```text
@xyflow/react or reactflow
- macro Process Network canvas
- micro Process Builder canvas
- draggable nodes
- connectable handles
- custom node types
- custom edges
- minimap
- pan/zoom
- fit view

dnd-kit
- dragging library items into the micro canvas

Radix Dialog or custom controlled modal
- accessible modal behavior

Framer Motion
- polished modal open/close and minor transitions

Zustand or React context
- UI/canvas state
```

Do not build core process semantics inside the canvas component.

## Data model separation

### Visual layout data

This is safe for the frontend to update:

```json
{
  "process_def_id": "create_access_grant",
  "network_position": { "x": 520, "y": 340 },
  "network_group": "commerce_fulfillment",
  "collapsed": false
}
```

### Semantic process connection

This must be backend-governed and validated:

```json
{
  "source_process": "payment_processing",
  "target_process": "create_access_grant",
  "trigger": "payment.confirmed",
  "object_type": "sales_order",
  "condition": "payment.status = confirmed",
  "binding_type": "INSTANCE_START"
}
```

### Micro process node

```json
{
  "id": "create_access_grant",
  "type": "effect",
  "label": "Create Access Grant",
  "effect_code": "ACCESS_GRANT_CREATE",
  "object_type": "access_grant",
  "params": {
    "customer_id": "$payload.customer_id",
    "content_id": "$payload.content_id",
    "expires_in_days": 30
  },
  "layout": { "x": 620, "y": 180 }
}
```

Allowed `type`, `effect_code`, `object_type`, parameters, and validation rules must come from EIP governance metadata.

## Node types

Macro Process Network node types:

```text
process
trigger_event
decision
document
api_integration
human_task
data_object
external_system
runtime_instance
```

Micro Builder node types:

```text
start_trigger
user_task
approval
condition
effect
api_call
document_action
notification
wait_timer
end
```

Each node type must have:

- icon
- color token
- shape style
- valid input/output handles
- backend metadata mapping

## Edge types

Use semantic edge types:

```text
triggers
creates_or_updates
uses_or_reads
notifies
condition_yes
condition_no
api_response
error_route
manual_handoff
```

Edge display rules:

```text
triggers: solid blue/green
creates_or_updates: dashed navy
uses_or_reads: dotted grey
notifies: dashed purple
condition: orange/red with label
error_route: red
```

## Modal behavior details

The modal must be draggable by its header, not by the whole body.

Required behavior:

```text
- opens centered
- width: 70vw
- height: 70vh
- min width: 900px on desktop if possible
- min height: 600px on desktop if possible
- max width: calc(100vw - 48px)
- max height: calc(100vh - 48px)
- can be dragged by header
- keeps position while editing
- close button top-right
- escape closes only if no unsaved changes or after confirmation
- clicking outside should not accidentally close if draft is dirty
```

Do not make the modal full screen by default. The user explicitly wants the network to remain visible behind it.

## Accuracy workflow for Codex

The user is concerned that AI-generated UI concepts degrade when converted to React. Use this workflow to preserve accuracy.

### Step 1 — Static visual shell only

Implement static screen first. No backend wiring, no complex logic.

Deliver:

- Process Network page with sidebar/topbar/KPIs/canvas/details panel.
- Draggable modal shell at 70vw/70vh.
- Static Micro Builder inside modal.

Acceptance:

- Looks visually close to concept.
- No generic or low-density dashboard replacement.
- Sidebar/topbar/canvas/modal proportions match concept.

### Step 2 — React Flow static nodes

Replace fake/static cards with React Flow nodes/edges using fixed mock data.

Acceptance:

- Nodes are draggable.
- Canvas supports pan/zoom.
- Edges render cleanly.
- Modal micro builder also uses React Flow.

### Step 3 — Interaction layer

Add:

- click node -> detail panel
- click builder icon -> open modal
- drag macro node -> update layout state
- drag micro node -> update draft layout state
- connect micro nodes -> draft edge

No backend publish yet.

### Step 4 — Backend read integration

Read governed metadata and map into graph nodes.

Potential sources:

- process_def
- process_binding
- task_template
- task
- service_object
- object_link
- info_record
- gateway connections
- effect catalog / trigger registry when available

### Step 5 — Backend validation/publish

Only after the UI is visually stable:

- Validate graph through backend.
- Publish only governed metadata.
- Do not store executable JS in DB.
- Do not let UI create invalid effect/process semantics.

## Screenshot-based acceptance

After each implementation wave, produce a Playwright screenshot and compare against the concept.

Acceptance checklist:

```text
Sidebar width and contrast match concept.
Header height and search/actions align.
KPI cards are same scale/density.
Network canvas grid is subtle and readable.
Macro nodes are compact and professional.
Edge labels are readable but not noisy.
Legend and view controls are in correct positions.
Modal is 70vw/70vh and centered initially.
Modal shadow/radius matches premium SaaS feel.
Micro builder inside modal keeps three-panel layout.
Right inspector does not look generic.
Buttons use EIP blue/cyan language.
No accidental dark-only theme unless intentionally scoped.
```

Do not accept implementation just because it compiles.

## Governance constraints

The Process Studio must comply with EIP architecture:

- process-driven
- kernel-first
- metadata-governed
- engine-driven
- no hidden hardcoded business authority

Must not hardcode:

- effect catalog as UI-only constants
- task semantics
- document types
- service object categories
- process lifecycle rules
- trigger semantics
- publish authority

Temporary mock constants are allowed only in visual prototype files and must be clearly marked:

```text
// MOCK ONLY — replace with governed backend metadata before production
```

## V1 vs V2 / V24 recommendation

### V1

Use as:

```text
Process Network Preview
Static/controlled prototype
Read-only or layout-only interactions
No production editing until backend governance catches up
```

### V2 / V24

Use as:

```text
Full Process Studio
Network view + micro builder modal
Backend-governed validation and publishing
Runtime overlay
Effect catalog / trigger registry / document governance integration
```

## Required final deliverables from Codex

For the first implementation wave, Codex must deliver:

1. List of files changed.
2. Whether work was visual prototype only or backend-integrated.
3. Screenshots of implemented UI.
4. Confirmation that the main view is Process Network, not Micro Builder.
5. Confirmation that Micro Builder opens in a 70vw/70vh draggable modal.
6. Confirmation that macro and micro graph nodes are draggable.
7. Confirmation that semantic publishing is not hardcoded in frontend.
8. Any temporary mock data clearly identified.
9. Known gaps and next wave plan.

## Do not regress

- Do not make the Micro Builder the main default screen.
- Do not hide the network behind a full-screen builder.
- Do not make the modal non-draggable.
- Do not implement a generic CRUD dashboard instead of the process graph.
- Do not hardcode business semantics into React.
- Do not publish invalid graph edits without backend validation.
- Do not treat visual node movement as semantic process changes.
- Do not remove the user’s n8n/Visio-style drag/connect requirement.
- Do not lose EIP Hybrid Light visual identity.

## Codex implementation prompt summary

Use this short prompt if needed:

```text
Implement EIP Process Studio concept as a visual-first prototype.
The main view must be a Process Network neural map of all processes.
Clicking the builder/edit icon on a process node opens a draggable 70vw/70vh modal containing the Micro Process Builder for that process.
Use React Flow/xyflow for draggable/connectable macro and micro canvases.
Preserve EIP Hybrid Light visual identity: dark navy EIP sidebar, light canvas, white panels, blue/cyan accents, compact premium nodes.
Do visual shell first, then interactions, then backend read, then backend validation/publish in later waves.
Frontend must not become business authority; process/effect/trigger/document semantics must remain governed by backend metadata.
Provide screenshots and do not claim completion unless the rendered UI visually matches the concept proportions.
```
