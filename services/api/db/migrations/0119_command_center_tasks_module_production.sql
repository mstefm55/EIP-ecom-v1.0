-- 0119_command_center_tasks_module_production.sql
-- Production ownership correction:
-- Dashboard stays the business cockpit; the Tasks sidebar module owns detailed task management.

BEGIN;

DO $$
DECLARE
  command_center_props jsonb := '{
    "endpoint": "/api/eip/user/dashboard/command-center",
    "title": "Run the business, not the system",
    "subtitle": "Live business signals, urgent topics, and actionables from existing task and module data.",
    "tabs": [
      { "code": "command", "label": "Command Center" },
      { "code": "analytics", "label": "Analytics" }
    ],
    "widgets": [
      { "code": "open_work", "label": "Open work" },
      { "code": "high_urgency", "label": "High urgency" },
      { "code": "due_today", "label": "Due today" },
      { "code": "active_modules", "label": "Active modules" },
      { "code": "recent_reports", "label": "Recent reports" }
    ],
    "labels": {
      "refresh": "Refresh",
      "businessStats": "Business statistics",
      "businessStatsHint": "Live task, module, report, and operational signals",
      "openDetail": "Open detail",
      "burningTopics": "Burning topics",
      "burningHint": "Top urgent items only. User pins 2-3 categories from the Task Browser.",
      "burningEmpty": "No urgent item is waiting in the pinned categories.",
      "taskBrowser": "Task Browser",
      "taskBrowserHint": "All user actionables - categories are metadata-driven",
      "taskSearch": "Search actionables...",
      "signalSearch": "Search signal, customer, order, material...",
      "actionables": "Actionables",
      "controls": "Filters, delegation rules and category pinning",
      "analytics": "Signal analytics",
      "workload": "Workload",
      "delegate": "Delegate",
      "assign": "Assign",
      "cancel": "Cancel",
      "confirm": "Confirm",
      "noTasks": "No open tasks in this category.",
      "search": "Search tasks",
      "urgency": "Urgency",
      "sort": "Sort",
      "pinned": "Pinned"
    },
    "categoryPresentation": {
      "crm": { "label": "Customer queries", "badge": "CRM / INTAKE", "tone": "blue" },
      "commerce": { "label": "Orders to deliver", "badge": "ORDER FLOW", "tone": "red" },
      "inventory": { "label": "Stock risks", "badge": "INVENTORY", "tone": "gold" },
      "procurement": { "label": "RFQ / Suppliers", "badge": "PROCUREMENT", "tone": "violet" },
      "content": { "label": "Content & catalog", "badge": "STORE", "tone": "green" },
      "reports": { "label": "Reports & review", "badge": "REPORTING", "tone": "slate" },
      "general": { "label": "General work", "badge": "TASKS", "tone": "slate" }
    },
    "taskBrowser": {
      "defaultOpen": "crm",
      "urgencyFilters": ["all", "critical", "high", "medium", "normal"],
      "dueDateFilters": ["all", "overdue", "today", "tomorrow", "future", "unscheduled"],
      "assignmentFilters": ["all", "my_tasks", "delegated", "unassigned"],
      "sortOptions": ["urgency", "due_date", "category", "created_date"]
    },
    "theme": {
      "variant": "eip_v1",
      "density": "comfortable"
    }
  }'::jsonb;
  tasks_node jsonb := '{
    "id": "user-tasks",
    "type": "UserTasksPanel",
    "props": {
      "title": "Tasks",
      "subtitle": "Full task management, scheduling, delegation, and workload from real task engine records.",
      "endpoint": "/api/eip/user/dashboard/command-center",
      "defaultView": "my_tasks",
      "views": [
        { "code": "my_tasks", "label": "My Tasks" },
        { "code": "calendar", "label": "Calendar" },
        { "code": "delegated", "label": "Delegated" },
        { "code": "overdue", "label": "Overdue" },
        { "code": "workload", "label": "Workload" }
      ],
      "theme": {
        "variant": "eip_v1",
        "density": "comfortable"
      }
    }
  }'::jsonb;
  surface_record record;
  root_children jsonb;
BEGIN
  FOR surface_record IN
    SELECT ui_surface.id, ui_surface.tree
    FROM eip_core.ui_surface ui_surface
    WHERE ui_surface.code='dashboard'
      AND ui_surface.is_active=true
      AND ui_surface.is_published=true
  LOOP
    root_children := COALESCE(surface_record.tree->'children', '[]'::jsonb);

    SELECT jsonb_agg(
      CASE
        WHEN root_child->>'id' = 'user-dashboard-panel' THEN
          jsonb_set(
            root_child,
            '{children}',
            COALESCE(
              (
                SELECT jsonb_agg(
                  CASE
                    WHEN panel_child->>'id' = 'user-dashboard'
                      OR panel_child->>'type' = 'UserDashboardPanel'
                    THEN jsonb_set(panel_child, '{props}', command_center_props, true)
                    ELSE panel_child
                  END
                )
                FROM jsonb_array_elements(COALESCE(root_child->'children', '[]'::jsonb)) panel_child
              ),
              '[]'::jsonb
            ),
            true
          )
        WHEN root_child->>'id' = 'user-tasks-panel' THEN
          jsonb_set(root_child, '{children}', jsonb_build_array(tasks_node), true)
        ELSE root_child
      END
    )
    INTO root_children
    FROM jsonb_array_elements(root_children) root_child;

    UPDATE eip_core.ui_surface
    SET tree=jsonb_set(surface_record.tree, '{children}', root_children, true),
        attrs=COALESCE(attrs, '{}'::jsonb) || '{"module":"dashboard","command_center_surface":true,"tasks_surface":true,"production_data_only":true}'::jsonb,
        updated_at=now()
    WHERE id=surface_record.id;
  END LOOP;
END;
$$;

COMMIT;
