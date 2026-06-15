# Kernel UX Shell V1

Base main: `ddcf7ef2dfb0c8813698936da853056f5f9a1fcf`

Scope: the generic `KernelModuleWorkspace` used by Entity Management, CRM Management, Inventory Management, Procurement Management, Policies & Conditions, and future modules.

## UX Audit

The released module screens were functional but still felt too close to an admin CRUD surface. The weak points were:

- the module header did not show enough operational intent;
- the left list was useful but visually flat and did not expose enough record identity;
- tabs were present, but they felt disconnected from lifecycle, process, policy, and next action;
- disabled actions relied too much on hover titles instead of visible reasons;
- overview information was rendered as simple rows rather than decision cards;
- CRM communications had no generic disabled slot for provider readiness.

Product Studio feels stronger because it uses compact glass panels, clear command areas, dense master-detail layout, rounded tab pills, strong selected states, and work-focused language. Kernel UX Shell V1 reuses those qualities in the shared shell rather than copying Product Studio logic.

## Shell Structure

The generic shell now has:

- module hero header with icon, title, subtitle, metrics, refresh, and primary action;
- left master panel with search, filters, count, compact record cards, status badge, and metadata-defined secondary facts;
- main detail header with selected object identity, lifecycle badge, metadata fields, and contextual actions;
- process and intent strip with current stage, next action, blockers, approval or policy state, and linked task count;
- overview cards for facts, warnings, linked objects, open work, and policy state;
- metadata-driven tab strip with Product-Studio-style pill treatment;
- communications slot that can show real linked summaries or a safe disabled state.

## Descriptor Fields

Modules can customize the shell through metadata:

- `layout.icon`
- `layout.metrics`
- `layout.processHealth`
- `list.meta`
- `detail.meta`
- `detail.process`
- `detail.overviewCards`
- `tabs[].type`
- `tabs[].disabledMessage`
- `rowActions[].disabledReason`

These fields are data paths and presentation hints only. They do not introduce module-specific React components.

## Process Model

The `detail.process` object is the shared process/intention model:

- `stage`: current lifecycle or process state;
- `nextAction`: what the user should do next;
- `blocked`: missing data or blockers;
- `approval`: approval, policy, or governance state;
- `taskCount`: linked open task count.

The shell renders this consistently for:

- Entity: profile, contact, relationship, policy, and activity completeness;
- CRM: account status, opportunity and activity follow-up, commercial policy context;
- Inventory: stock risk, reorder posture, policy resolution, procurement bridge;
- Procurement: request status, approval stage, supplier sourcing, missing data;
- Policies: mapping status, effective policy context, warnings, review action.

## Communications Slot

CRM uses the generic `communications` tab type. When a provider is not configured and no safe summaries are linked, the shell shows:

`Communication provider not configured`

No fake messages are generated.

## What Still Requires JS

JavaScript remains generic shell code for:

- fetching module options and record lists;
- applying metadata paths to data;
- rendering forms, collections, summaries, records, JSON, process strips, overview cards, and communications;
- executing metadata-defined actions.

Module-specific JavaScript is still avoided for these V1 modules. Future modules should add workspace metadata in `module_catalog.attrs.ui_workspace` and tenant module settings, then rely on `KernelModuleWorkspace`.

## Migration

Migration `0130_kernel_ux_shell_v1.sql` is metadata-only. It patches existing `ui_workspace` JSON in `module_catalog` and tenant module settings. It does not add tables or perform destructive changes.
