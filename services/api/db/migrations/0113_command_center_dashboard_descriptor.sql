-- 0113_command_center_dashboard_descriptor.sql
-- Metadata-only correction: persist Command Center dashboard descriptor props
-- so hosted tenants do not rely on React fallback defaults.

BEGIN;

DO $$
DECLARE
  command_center_props jsonb := '{
    "endpoint": "/api/eip/user/dashboard/command-center",
    "title": "Run the business, not the system",
    "subtitle": "Stats on top, burning topics below. The Task Browser shows all actionables and expands like the Admin data browser.",
    "tabs": [
      { "code": "command", "label": "Command Center" },
      { "code": "analytics", "label": "Analytics" },
      { "code": "workload", "label": "Workload" }
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
      "businessStatsHint": "Role/template-driven graph set",
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
      "workload": "Workload balance",
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
      "sortOptions": ["urgency", "due_date", "category"]
    },
    "theme": {
      "variant": "eip_v1",
      "density": "comfortable"
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
          (
            SELECT jsonb_set(
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
          )
        ELSE root_child
      END
    )
    INTO root_children
    FROM jsonb_array_elements(root_children) root_child;

    UPDATE eip_core.ui_surface
    SET tree=jsonb_set(surface_record.tree, '{children}', root_children, true),
        attrs=COALESCE(attrs, '{}'::jsonb) || '{"module":"dashboard","command_center_surface":true}'::jsonb,
        updated_at=now()
    WHERE id=surface_record.id;
  END LOOP;
END;
$$;

COMMIT;
