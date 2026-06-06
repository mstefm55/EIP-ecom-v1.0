# Core Process Engine v1 (Kernel)

## Scope
- Kernel-level process engine shared by all modules (CRM, inventory, production, etc.).
- Operates on `service_object_id` with optional object_type validation.
- No new tables; uses existing core tables only.

## Tables
- `eip_core.process_def`
- `eip_core.process_instance`
- `eip_core.task`
- `eip_core.service_object`
- `eip_core.object_link`
- `eip_core.service_object_status_event`
- `eip_core.task_status_event`
- `eip_core.dropdown_list` + `eip_core.dropdown_value`

## Permissions
- `PROCESS_DEF_READ`, `PROCESS_DEF_WRITE`
- `PROCESS_INSTANCE_READ`, `PROCESS_INSTANCE_WRITE`
- User creation uses governed role templates. Migration `0117_process_transition_permission_backfill.sql` backfills these permissions into profile/access bundles such as `ADMIN_SUPER`, `ACCESS_UNIVERSAL`, `ECOM_ADMIN`, ECOM access bundles, and CRM bundles so newly created users inherit process/transition access through the selected profile and access type.

## Routes (prefix: /api/eip/core)
Process definitions:
- GET `/process/defs`
- POST `/process/defs`
- GET `/process/defs/:id`
- PATCH `/process/defs/:id`
- POST `/process/defs/:id/publish`

Process instances:
- GET `/process/instances`
- GET `/process/instances/:id`
- POST `/process/instances`
- POST `/process/instances/:id/advance`

All routes require session + CSRF + permission checks (including GET).

## Graph JSON (v1 minimal)
```
{
  "name": "Case lifecycle",
  "object_type": "CRM_CASE",
  "initial_node": "new",
  "nodes": {
    "new": {
      "on_enter": {"task_templates": [ ... ]}
    },
    "in_progress": {}
  },
  "transitions": [
    {
      "from": "new",
      "action": "start",
      "to": "in_progress",
      "effects": [
        { "type": "so_status", "to": "in_progress", "list_code": "SERVICE_OBJECT_STATUS" },
        { "type": "task_create", "task_type": "FOLLOWUP", "title": "Call customer" }
      ]
    }
  ]
}
```

Notes:
- `graph.nodes` can be a map (object) or an array of `{ id, ... }` nodes.
- Terminal nodes: set `terminal: true` (or `is_terminal: true`) on a node to auto-close the instance (`status='completed'`, `ended_at=now()`).

## Effects (v1)
- `so_status`: updates `service_object.status` and inserts `service_object_status_event`.
- `task_create`: inserts `task` row.
- `task_status`: updates `task.status` and inserts `task_status_event`.
- `link`: inserts `object_link`.
- `attrs_merge`: merges JSON into `service_object.attrs` or `process_instance.cursor_json`.
- `so_create`: creates new `service_object` rows (one or many) with optional links.
- `instance_start`: starts a new process instance for one or many service objects.

### Effect References
- `$service_object_id`: current instance service_object.
- `$process_instance_id`: current instance.
- `$created_last`: last `so_create` id (in this transition).
- `$created.<key>`: named ids from `so_create` using `as`/`key`.

### so_create (example)
```
{
  "type": "so_create",
  "items": [
    {
      "object_type": "CRM_CASE",
      "status": "new",
      "title": "Child Case",
      "as": "child",
      "links": [
        {
          "src_kind": "SERVICE_OBJECT",
          "src_id": "$created.child",
          "dst_kind": "SERVICE_OBJECT",
          "dst_id": "$service_object_id",
          "relation_type": "TRANSFORMED_FROM"
        }
      ]
    }
  ]
}
```

### instance_start (example)
```
{
  "type": "instance_start",
  "service_object_id": "$created.child",
  "module": "core",
  "code": "child_flow_v1",
  "idempotency_key_prefix": "auto-child"
}
```

## Idempotency
- `POST /instances/:id/advance` requires `idempotency_key`.
- Engine reuses prior history entry when the same key is provided.
- `POST /instances` accepts an optional `idempotency_key` (stored in cursor_json).

## Invalid Transition Diagnostics
- Transition lookup normalizes harmless whitespace/casing drift on the current node and requested action.
- If an action is not valid for the current node, the API returns `409` with `error: "INVALID_TRANSITION"`, the current `node`, requested `action`, `process_def_id`, and `available_transitions`.
- Clients should display those available actions rather than retrying a guessed transition name.

## Transactional Behavior
- All state transitions use a single DB transaction with `FOR UPDATE` locks.
- Effects are applied in order, then the cursor advances and history is recorded.
- On-enter task templates run when entering a node.

## Status Governance
- Status values are validated against existing dropdown lists.
- For `so_status`, the transition should specify `list_code` (e.g., `SERVICE_OBJECT_STATUS`).
- For `task_status`, validation uses the `TASK_STATUS` list.

## Notes
- `attrs.module` and `attrs.is_published` are used for filtering defs.
- Process instance status is `active` by default (table column is text).
- Use an anchor service_object (job/order/batch) for cross-step identity, and link derived objects via `TRANSFORMED_FROM` or similar relation types.
