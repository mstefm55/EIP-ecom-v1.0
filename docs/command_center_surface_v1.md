# EIP V1 Command Center Surface

## Purpose

The Command Center is the tenant dashboard landing surface for SME owners. It is a journey-first workbench, not a table-first module browser. It shows live business signals, urgent topics, and actionable tasks while routing module-specific work back to governed EIP workspaces.

## Layout Contract

- Left navigation remains the existing collapsible dashboard sidebar.
- Main dashboard uses a light, spacious owner workbench layout rather than nested operational tables.
- Top navigation has three active working tabs:
  - Command Center
  - Analytics
  - Workload
- A centered signal search supports quick scanning without turning the surface into a dense filter bar.
- The primary headline is: "Run the business, not the system."
- The center column shows compact business statistic cards with lightweight trend graphics above focused Burning Topics.
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

Task scheduling uses:

```text
POST /api/eip/user/tasks/:id/schedule
```

It reuses existing `eip_core.task.due_at`, `started_at`, assignment, status, and `attrs`. Planned start/end, reminder, priority, and scheduling metadata are stored in task attrs until the process engine exposes richer first-class scheduling effects. The route requires EIP session, CSRF, tenant scope, actor agent resolution, and ownership or existing task/process permissions. It writes a `task_status_event` with reason `scheduled`.

## UI Descriptor Governance

The dashboard surface descriptor owns:

- tab labels
- KPI widget selection
- Task Browser labels
- default open category
- urgency filters
- sort options
- due-date filters
- assignment/delegation filters
- semantic theme variant and density tokens

React owns only reusable layout primitives:

- KPI card
- graph panel
- tab switcher
- Burning Topics panels
- Task Browser category card
- task row
- delegation form

Module approvals, replies, purchasing decisions, inventory decisions, and commerce operations are not implemented in React. The Command Center opens the relevant governed workspace for those actions.

## Theme Tokens

The default Command Center theme is `eip_v1`, which maps to the current production `ink`, `brand`, `mist`, and glass-panel styling. The surface descriptor stores:

```json
{
  "theme": {
    "variant": "eip_v1",
    "density": "comfortable"
  }
}
```

The React primitive resolves those semantic tokens into class groups for shell, panels, cards, action buttons, tabs, and empty states. A dormant `light_glass_ready` variant exists only as a future-ready token map; it is not activated by default and does not change the production theme.

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

Full API/security checks for the release gate:

```bash
npm.cmd --prefix services/api test
npm.cmd --prefix services/api run test:security
```

Dashboard build:

```bash
cd apps/dashboard
npm run build
```

Railway rollout:

```bash
cd services/api
npm run migrate
```

Migration `0113_command_center_dashboard_descriptor.sql` is metadata-only. Migration `0114_command_center_theme_descriptor_refresh.sql` is the additive hosted refresh for environments where `0113` was already applied. It patches active/published `dashboard` UI surface descriptors so Command Center labels, tabs, widgets, category presentation, Task Browser settings, and theme tokens come from persisted surface metadata rather than only React fallback defaults.

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
