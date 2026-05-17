BEGIN;

INSERT INTO eip_core.ui_surface
  (tenant_id, code, title, version, is_active, is_published, is_public, tree, attrs)
SELECT
  NULL,
  'admin',
  'EIP Admin',
  COALESCE(MAX(version), 0) + 1,
  true,
  true,
  false,
  $${
  "id": "admin-shell",
  "type": "AdminShell",
  "props": {
    "brand": "EIP Core",
    "nav": [
      "Tenant Requests",
      "Processes",
      "Connections",
      "Security",
      "Audit",
      "Data Explorer"
    ],
    "menu": [
      {
        "code": "dashboard",
        "label": "Dashboard",
        "icon": "LayoutGrid"
      },
      {
        "code": "tenant-requests",
        "label": "Tenant Requests",
        "icon": "ClipboardList"
      },
      {
        "code": "processes",
        "label": "Processes",
        "icon": "GitBranch"
      },
      {
        "code": "connections",
        "label": "Connections",
        "icon": "Plug"
      },
      {
        "code": "tasks",
        "label": "Tasks & Follow-up",
        "icon": "Activity"
      },
      {
        "code": "users",
        "label": "Users & Roles",
        "icon": "Users"
      },
      {
        "code": "portfolios",
        "label": "Portfolios",
        "icon": "Briefcase"
      },
      {
        "code": "templates",
        "label": "Templates",
        "icon": "Copy"
      },
      {
        "code": "security",
        "label": "Security",
        "icon": "Shield"
      },
      {
        "code": "audit",
        "label": "Audit",
        "icon": "FileClock"
      },
      {
        "code": "data-explorer",
        "label": "Data Explorer",
        "icon": "Database"
      },
      {
        "code": "integrations",
        "label": "Integrations",
        "icon": "Plug"
      },
      {
        "code": "reports",
        "label": "Reports",
        "icon": "BarChart3"
      },
      {
        "code": "settings",
        "label": "Settings",
        "icon": "Settings"
      }
    ],
    "helper": "Review onboarding requests, bootstrap tenants, and monitor admin posture.",
    "scale": 1
  },
  "children": [
    {
      "id": "admin-header",
      "type": "AdminHeader",
      "props": {
        "badge": "EIP Admin",
        "title": "Admin console",
        "subtitle": "Manage onboarding, security, audit, and internal operations from a single control plane.",
        "highlight": "Step-up required for approval actions."
      }
    },
    {
      "id": "tenant-panel",
      "type": "AdminPanel",
      "props": {
        "tab": "tenant-requests"
      },
      "children": [
        {
          "id": "tenant-metrics",
          "type": "AdminMetrics",
          "props": {
            "endpoint": "/api/eip/admin/tenant-requests"
          }
        },
        {
          "id": "tenant-requests",
          "type": "TenantRequestBoard",
          "props": {
            "endpoint": "/api/eip/admin/tenant-requests",
            "limit": 200
          }
        }
      ]
    },
    {
      "id": "processes-panel",
      "type": "AdminPanel",
      "props": {
        "tab": "processes"
      },
      "children": [
        {
          "id": "process-builder",
          "type": "AdminProcessBuilder",
          "props": {
            "layout": {
              "header": {
                "badge": "Process Automation Builder",
                "title": "Workflow studio",
                "subtitle": "Define process graphs, tasks, and bindings. All execution is handled by the core process engine.",
                "tabs": {
                  "builder": "Builder",
                  "logs": "Logs"
                },
                "buttons": {
                  "new": "New",
                  "save": "Save",
                  "saving": "Saving",
                  "validate": "Validate",
                  "validating": "Validating",
                  "publish": "Publish",
                  "publishing": "Publishing"
                }
              },
              "library": {
                "title": "Process Library",
                "empty": "No processes yet. Use Add to create the first definition.",
                "loading": "Loading process definitions...",
                "add": "Add",
                "help": "Select a definition to edit, or create a new one to start a workflow."
              },
              "canvas": {
                "title": "Builder Canvas",
                "empty": "No nodes yet. Add a trigger or step to begin the graph.",
                "addNode": "Add Node",
                "nodeTypeFallback": "NODE",
                "nodeState": {
                  "terminal": "Terminal",
                  "active": "Active"
                },
                "help": "Create nodes in the order they run. Use TRIGGER to start and TERMINAL to end."
              },
              "transitions": {
                "title": "Transitions",
                "empty": "No transitions yet. Add a transition to connect nodes.",
                "add": "Add Transition",
                "badgeSuffix": "fx",
                "actionFallback": "no-action",
                "edgeFallback": "DEFAULT",
                "nodeFallback": "?",
                "selectPlaceholder": "Select",
                "effects": {
                  "add": "Add Effect",
                  "empty": "No effects configured.",
                  "select": "Select effect",
                  "configPlaceholder": "{\"status\":\"approved\"}"
                },
                "help": "Transitions define movement between nodes. Use explicit JOIN nodes for branch merges."
              },
              "logs": {
                "title": "Process Logs",
                "loading": "Loading process instances...",
                "empty": "No process instances yet.",
                "fields": {
                  "started": "Started",
                  "updated": "Updated"
                }
              },
              "definition": {
                "title": "Definition",
                "fields": {
                  "code": "Code",
                  "name": "Name",
                  "module": "Module",
                  "version": "Version",
                  "objectType": "Service Object Type",
                  "initialNode": "Initial Node",
                  "initialNodePlaceholder": "Select node",
                  "active": "Active definition"
                },
                "help": "Set the identity and service object type for the process definition."
              },
              "nodeInspector": {
                "title": "Node Inspector",
                "empty": "Select a node to edit details.",
                "remove": "Remove",
                "fields": {
                  "id": "Node Id",
                  "type": "Type",
                  "typePlaceholder": "Select type",
                  "label": "Label",
                  "terminal": "Terminal node",
                  "templates": "Task Templates (one per line)"
                },
                "help": "Human task nodes must reference task templates. Keep node IDs stable."
              },
              "nodePalette": {
                "title": "Node Palette",
                "help": "Click a node type to add it to the canvas.",
                "searchPlaceholder": "Search nodes...",
                "empty": "No matches."
              },
              "transitionInspector": {
                "title": "Transition Inspector",
                "empty": "Select a transition to edit details.",
                "remove": "Remove",
                "fields": {
                  "from": "From",
                  "to": "To",
                  "selectPlaceholder": "Select",
                  "action": "Action",
                  "edge": "Edge Type",
                  "condition": "Condition",
                  "effects": "Effects"
                },
                "help": "Effects run on transition. Use JSON_MERGE or STATUS_SET per taxonomy."
              },
              "templates": {
                "title": "Task Templates",
                "subtitle": "Templates linked to this process.",
                "empty": "No templates yet.",
                "add": "Add",
                "save": "Save",
                "deactivate": "Deactivate",
                "remove": "Remove",
                "itemFallback": "New task",
                "fields": {
                  "taskTypePlaceholder": "Task type",
                  "titlePlaceholder": "Title",
                  "descriptionPlaceholder": "Description",
                  "serviceObjectTypePlaceholder": "Service object type",
                  "sortOrderPlaceholder": "Sort order",
                  "allowedActions": "Allowed Actions",
                  "completionAction": "Completion Action",
                  "completionActionPlaceholder": "Select action",
                  "attrsPlaceholder": "{\"ui\": {\"layout\": \"compact\"}}",
                  "activeLabel": "Active"
                },
                "help": "Define which actions are allowed and which action completes the task."
              },
              "bindings": {
                "title": "Process Bindings",
                "subtitle": "Bindings map service objects to processes.",
                "empty": "No bindings yet.",
                "add": "Add",
                "save": "Save",
                "deactivate": "Deactivate",
                "remove": "Remove",
                "itemFallback": "Binding",
                "taskPrefix": "Task",
                "allTasks": "All tasks",
                "fields": {
                  "serviceObjectTypePlaceholder": "Service object type",
                  "taskTypePlaceholder": "Task type (optional)",
                  "priorityPlaceholder": "Priority",
                  "activeLabel": "Active",
                  "attrsPlaceholder": "{\"notes\":\"default binding\"}"
                },
                "help": "Bindings route service objects into this process by type and optional task."
              }
            }
          }
        }
      ]
    },
    {
      "id": "connections-panel",
      "type": "AdminPanel",
      "props": {
        "tab": "connections"
      },
      "children": [
        {
          "id": "connections-overview",
          "type": "AdminConnectionsPanel"
        }
      ]
    },
    {
      "id": "security-panel",
      "type": "AdminPanel",
      "props": {
        "tab": "security"
      },
      "children": [
        {
          "id": "security-overview",
          "type": "AdminSecurityPanel",
          "props": {
            "endpoint": "/api/eip/auth/devices"
          }
        }
      ]
    },
    {
      "id": "audit-panel",
      "type": "AdminPanel",
      "props": {
        "tab": "audit"
      },
      "children": [
        {
          "id": "audit-overview",
          "type": "AdminAuditPanel"
        }
      ]
    },
    {
      "id": "data-explorer-panel",
      "type": "AdminPanel",
      "props": {
        "tab": "data-explorer"
      },
      "children": [
        {
          "id": "db-explorer",
          "type": "AdminDbExplorer",
          "props": {
            "layout": {
              "title": "Data explorer",
              "subtitle": "Inspect schema metadata, preview table rows, and export snapshots for diagnostics.",
              "schema": {
                "title": "Schema browser",
                "searchPlaceholder": "Search tables...",
                "empty": "No tables available.",
                "export": "Export schema",
                "columnsTitle": "Columns",
                "columnsEmpty": "Select a table to view columns."
              },
              "table": {
                "title": "Table",
                "placeholder": "Select a table to view data.",
                "tenantPlaceholder": "Tenant id (optional)",
                "refresh": "Refresh",
                "exportCsv": "Export CSV",
                "exportJson": "Export JSON"
              },
              "data": {
                "title": "Data preview",
                "empty": "No rows to display.",
                "loading": "Loading rows..."
              },
              "pagination": {
                "prev": "Prev",
                "next": "Next"
              }
            }
          }
        }
      ]
    },
    {
      "id": "dashboard-panel",
      "type": "AdminPanel",
      "props": {
        "tab": "dashboard"
      },
      "children": [
        {
          "id": "admin-monitoring-dashboard",
          "type": "AdminMonitoringDashboard",
          "props": {
            "endpoint": "/api/eip/admin/monitoring"
          }
        }
      ]
    },
    {
      "id": "tasks-panel",
      "type": "AdminPanel",
      "props": {
        "tab": "tasks"
      },
      "children": [
        {
          "id": "tasks-placeholder",
          "type": "AdminPlaceholderPanel",
          "props": {
            "title": "Tasks & follow-up",
            "subtitle": "Workflow approvals, escalations, and admin action queues."
          }
        }
      ]
    },
    {
      "id": "users-panel",
      "type": "AdminPanel",
      "props": {
        "tab": "users"
      },
      "children": [
        {
          "id": "users-overview",
          "type": "AdminUsersPanel"
        }
      ]
    },
    {
      "id": "portfolios-panel",
      "type": "AdminPanel",
      "props": {
        "tab": "portfolios"
      },
      "children": [
        {
          "id": "portfolios-overview",
          "type": "AdminPortfolioPanel"
        }
      ]
    },
    {
      "id": "templates-panel",
      "type": "AdminPanel",
      "props": {
        "tab": "templates"
      },
      "children": [
        {
          "id": "template-clone",
          "type": "AdminTemplateClonePanel",
          "props": {
            "layout": {
              "title": "Template cloning",
              "subtitle": "Clone a template tenant (processes, UI surfaces, schemas, and dropdowns) into a live tenant.",
              "source": {
                "title": "Template tenant",
                "placeholder": "Search template tenant...",
                "empty": "No templates available.",
                "helper": "Templates are marked with attrs.template = true."
              },
              "target": {
                "title": "Target tenant",
                "placeholder": "Search target tenant...",
                "empty": "No tenants found.",
                "helper": "Target tenants exclude template records."
              },
              "action": {
                "clone": "Clone template",
                "cloning": "Cloning...",
                "refresh": "Refresh"
              },
              "summary": {
                "title": "Clone summary",
                "empty": "Run a clone to see what was inserted."
              }
            }
          }
        }
      ]
    },
    {
      "id": "integrations-panel",
      "type": "AdminPanel",
      "props": {
        "tab": "integrations"
      },
      "children": [
        {
          "id": "integrations-placeholder",
          "type": "AdminPlaceholderPanel",
          "props": {
            "title": "Integrations",
            "subtitle": "Connector catalog, API keys, and partner endpoints."
          }
        }
      ]
    },
    {
      "id": "reports-panel",
      "type": "AdminPanel",
      "props": {
        "tab": "reports"
      },
      "children": [
        {
          "id": "reports-placeholder",
          "type": "AdminPlaceholderPanel",
          "props": {
            "title": "Reports",
            "subtitle": "Compliance exports, usage reports, and audit snapshots."
          }
        }
      ]
    },
    {
      "id": "settings-panel",
      "type": "AdminPanel",
      "props": {
        "tab": "settings"
      },
      "children": [
        {
          "id": "settings-modules",
          "type": "AdminModulesPanel"
        }
      ]
    }
  ]
}$$::jsonb,
  $${
  "source": "seed",
  "generated_at": "2026-02-10T19:51:05.188Z"
}$$::jsonb
FROM eip_core.ui_surface
WHERE tenant_id IS NULL AND code = 'admin';

COMMIT;
