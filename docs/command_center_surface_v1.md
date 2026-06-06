# EIP V1 Command Center Surface

## Purpose

The Command Center is the tenant dashboard landing surface for SME owners. It is a journey-first workbench, not a table-first module browser. It shows live business signals, urgent topics, and actionable tasks while routing module-specific work back to governed EIP workspaces.

## Layout Contract

- Left navigation remains the existing collapsible dashboard sidebar.
- Main dashboard has three active working tabs:
  - Command Center
  - Analytics
  - Workload
- The center column shows compact KPI and graph widgets above focused Burning Topics.
- The right rail is a full-height Task Browser sized for roughly one quarter of the viewport.
- Task Browser category cards are stacked. One category opens by default, and the task list inside that category is scroll bounded.
- Bottom filters, sorting, pinning, and delegation controls are secondary and collapsible.

## Backend Composition

The read model is exposed at:

```text
GET /api/eip/user/dashboard/command-center
```

The endpoint composes existing kernel data only:

- `eip_core.task`
- `eip_core.service_object`
- `eip_core.process_def`
- `eip_core.agent`
- `eip_core.info_record`
- `eip_core.ui_surface`
- `eip_core.tenant_module_setting`

No Command Center tables are introduced. Categories are derived from module/process/task metadata and remain tenant scoped.

Task delegation uses:

```text
POST /api/eip/user/tasks/:id/delegate
```

It requires an EIP session, CSRF, tenant scoping, an actor agent, and either ownership of the task or an existing task/process write permission. It updates the existing task assignment and writes a `task_status_event` with reason `delegated`.

## UI Descriptor Governance

The dashboard surface descriptor owns:

- tab labels
- KPI widget selection
- Task Browser labels
- default open category
- urgency filters
- sort options

React owns only reusable layout primitives:

- KPI card
- graph panel
- tab switcher
- Burning Topics panels
- Task Browser category card
- task row
- delegation form

Module approvals, replies, purchasing decisions, inventory decisions, and commerce operations are not implemented in React. The Command Center opens the relevant governed workspace for those actions.

## Engine-First Boundaries

- Process authority remains in `process_def`, `process_binding`, task templates, and the process engine.
- Policy authority remains in governed metadata and module-specific services.
- The Command Center composes a read model and provides task assignment as a kernel task operation.
- Business-specific actions are represented as links back to module workspaces unless a governed endpoint already exists.

## Test Procedure

API static contract:

```bash
cd services/api
npm test -- test/command_center_surface.test.mjs
```

Dashboard build:

```bash
cd apps/dashboard
npm run build
```

Manual dashboard check:

1. Sign in to a tenant dashboard.
2. Open Dashboard.
3. Confirm Command Center, Analytics, and Workload tabs render.
4. Confirm right-side Task Browser appears.
5. Open a category and verify the task list scrolls inside the category instead of expanding the whole page.
6. Pin or unpin categories and verify Burning Topics only shows urgent tasks from pinned categories.
7. Use Open on a task and confirm it routes to the governed module workspace.
8. Delegate a task you own or an unassigned task and confirm the task assignment updates after refresh.

## Known Limits

- Category classification is a read-model adapter until the process engine exposes first-class available owner actions for every module.
- Delegation is intentionally narrow; it does not replace module-specific approval, reply, or purchasing workflows.
- Tenant-specific wording should continue moving into UI descriptors as commercial tenants require custom labels.
