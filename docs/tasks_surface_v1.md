# EIP V1 Tasks Surface

## Purpose

The Tasks sidebar module is the production operational task center. It owns detailed task management, internal scheduling, delegation, due-date review, and workload filtering.

Dashboard remains the business cockpit. Tasks owns the full scheduler.

## Data Sources

The surface uses the existing tenant-scoped Command Center read model:

```text
GET /api/eip/user/dashboard/command-center
```

That endpoint composes real data from:

- `eip_core.task`
- `eip_core.service_object`
- `eip_core.process_def`
- `eip_core.agent`
- `eip_core.task_status_event`
- `eip_core.info_record`
- module and UI surface metadata

No production task list is generated in React, stored in memory, or hardcoded as sample data.

## Views

- `My Tasks`: real task/actionable rows for the current user scope.
- `Calendar`: internal EIP task due-date calendar from `task.due_at`.
- `Delegated`: tasks with delegation metadata.
- `Overdue`: tasks whose due date is before the local current day and whose status is still open.
- `Workload`: calendar/workload view from the same task payload.

If a view has no data, it shows a production empty state rather than placeholder cards.

## Scheduling

Scheduling uses:

- `eip_core.task.due_at`
- `eip_core.task.started_at`
- `eip_core.task.attrs` for planned end, reminder, priority, and audit metadata
- `eip_core.task_status_event` with reason `scheduled`

Write route:

```text
POST /api/eip/user/tasks/:id/schedule
```

The route requires EIP session, CSRF, tenant scoping, actor agent resolution, and either task ownership or a governed permission:

- `TASK_SCHEDULE`
- `core.task.write`
- `TASK_DELEGATE`
- `CRM_TASK_WRITE`
- `PROCESS_INSTANCE_WRITE`

## Delegation

Delegation uses active tenant agents loaded from the existing agent table.

Write route:

```text
POST /api/eip/user/tasks/:id/delegate
```

If no assignee source is available, the UI disables delegation and explains:

```text
Delegation unavailable: assignee source not configured.
```

## Production Empty States

The Tasks surface must show empty states such as:

```text
No tasks found.
No matching task records exist for this view and filter set.
```

It must not show fake customers, fake orders, fake revenue, fake charts, fake stock risks, or sample tasks.

## Descriptor Governance

The dashboard surface descriptor registers `UserTasksPanel` under the existing `tasks` sidebar item. Descriptor props own:

- title and subtitle
- endpoint
- default view
- view labels
- theme variant and density

React owns only reusable primitives:

- filter bar
- task cards
- task detail drawer
- scheduling modal
- due-date calendar/workload view
- production empty states

## Known Limits

- This is internal EIP scheduling only. There is no Google Calendar or Outlook integration.
- Scheduling remains a kernel task operation until richer first-class scheduling effects are added to the process engine.
- Delegation depends on active tenant agent/user data.
- Business-specific task completion, approvals, replies, purchase decisions, and payment actions remain in their governed module workspaces.
