BEGIN;

INSERT INTO eip_core.ui_surface
  (tenant_id, code, title, version, is_active, is_published, is_public, tree, attrs)
SELECT
  NULL,
  'dashboard',
  'Tenant Dashboard',
  COALESCE(MAX(version), 0) + 1,
  true,
  true,
  false,
  $${
  "id": "user-shell",
  "type": "UserShell",
  "props": {
    "brand": "EIP Core",
    "nav": ["Dashboard", "Product Studio", "Content Studio", "Orders & Payments", "Tasks", "Reports", "Settings"],
    "menu": [
      { "code": "dashboard", "label": "Dashboard", "icon": "LayoutGrid" },
      { "code": "catalog", "label": "Product Studio", "icon": "Package" },
      { "code": "content", "label": "Content Studio", "icon": "LayoutTemplate" },
      { "code": "commerce", "label": "Orders & Payments", "icon": "CreditCard" },
      { "code": "tasks", "label": "Tasks", "icon": "Activity" },
      { "code": "reports", "label": "Reports", "icon": "BarChart3" },
      { "code": "settings", "label": "Settings", "icon": "Settings" }
    ],
    "helper": "Workspace overview, catalog operations, and tenant tasks."
  },
  "children": [
    {
      "id": "user-dashboard-panel",
      "type": "UserPanel",
      "props": { "tab": "dashboard" },
      "children": [
        {
          "id": "user-dashboard",
          "type": "UserDashboardPanel"
        }
      ]
    },
    {
      "id": "user-catalog-panel",
      "type": "UserPanel",
      "props": { "tab": "catalog" },
      "children": [
        {
          "id": "catalog-workspace",
          "type": "EcomProductWorkspace"
        }
      ]
    },
    {
      "id": "user-content-panel",
      "type": "UserPanel",
      "props": { "tab": "content" },
      "children": [
        {
          "id": "content-workspace",
          "type": "EcomProductWorkspace",
          "props": {
            "mode": "content-studio"
          }
        }
      ]
    },
    {
      "id": "user-commerce-panel",
      "type": "UserPanel",
      "props": { "tab": "commerce" },
      "children": [
        {
          "id": "commerce-lifecycle-panel",
          "type": "EcomOrderManagementPanel",
          "props": {
            "layout": {
              "header": {
                "eyebrow": "Commerce",
                "title": "Orders & payments",
                "subtitle": "Track sales orders, returns, and refunds flowing through the core process engine."
              },
              "tabs": [
                { "id": "orders", "label": "Orders", "icon": "ClipboardList" },
                { "id": "returns", "label": "Returns", "icon": "RotateCcw" },
                { "id": "refunds", "label": "Refunds", "icon": "DollarSign" }
              ],
              "list": {
                "title": "Queue",
                "searchPlaceholder": "Search orders, buyers, items...",
                "perPageLabel": "Per page",
                "perPageOptions": [12, 25, 50],
                "refreshLabel": "Refresh",
                "empty": "Nothing here yet.",
                "emptyFiltered": "No orders match the current search.",
                "pageLabel": "Page",
                "pageOfLabel": "of",
                "prevLabel": "Prev",
                "nextLabel": "Next",
                "ellipsisLabel": "...",
                "codeFallback": "ORDER",
                "itemFallback": "Order",
                "buyerFallback": "Buyer",
                "stageFallback": "new",
                "orderLabel": "Order",
                "untitledFallback": "Untitled"
              },
              "detail": {
                "title": "Order details",
                "orderNumberLabel": "Order no.",
                "orderCodeLabel": "Code",
                "untitledOrder": "Sales order",
                "untitledItem": "Order item",
                "invoiceLabel": "Invoice",
                "contactLabel": "Contact us",
                "statusLabel": "Order status",
                "trackTitle": "Track order",
                "paymentTitle": "Payment details",
                "paymentMethodLabel": "Payment method",
                "paymentPendingLabel": "Pending",
                "billingTitle": "Billing information",
                "summaryTitle": "Order summary",
                "summaryLabels": {
                  "subtotal": "Product price",
                  "shipping": "Delivery",
                  "tax": "Taxes",
                  "total": "Total"
                },
                "metaLabels": {
                  "created": "Created",
                  "channel": "Channel",
                  "buyer": "Buyer",
                  "buyerEmail": "Buyer email",
                  "jurisdiction": "Jurisdiction",
                  "currency": "Currency"
                },
                "trackLabels": {
                  "received": "Order received",
                  "confirmed": "Order confirmed",
                  "packed": "Order packed",
                  "shipped": "Order shipped",
                  "delivered": "Order delivered"
                },
                "trackIcons": {
                  "received": "Bell",
                  "confirmed": "FileText",
                  "packed": "Package",
                  "shipped": "Truck",
                  "delivered": "Check"
                },
                "trackIconFallback": "CircleDot",
                "fulfillmentTitle": "Fulfillment",
                "lineItemsTitle": "Line items",
                "lineItemLabel": "Item",
                "lineItemsQtyLabel": "Qty",
                "lineItemsAtLabel": "@",
                "lineItemsEmpty": "No order lines recorded.",
                "customerRequestsTitle": "Customer requests",
                "returnReasonLabel": "Return reason",
                "requestReturnLabel": "Request return",
                "refundLabel": "Refund",
                "refundReasonPlaceholder": "Reason",
                "refundAmountPlaceholder": "Amount (leave blank for full refund)",
                "requestRefundLabel": "Request refund",
                "returnsTitle": "Returns",
                "returnsEmpty": "No returns yet.",
                "refundsTitle": "Refunds",
                "refundsEmpty": "No refunds yet.",
                "paymentsTitle": "Payments",
                "paymentsEmpty": "No payments yet.",
                "returnTitle": "Return",
                "refundTitle": "Refund",
                "orderLabel": "Order",
                "amountLabel": "Amount",
                "actionLabels": {
                  "order": {
                    "ORDER_CONFIRM": "Confirm",
                    "ORDER_PACK": "Pack",
                    "ORDER_SHIP": "Ship",
                    "ORDER_FULFILL": "Fulfill",
                    "ORDER_DELIVER": "Deliver",
                    "ORDER_CANCEL": "Cancel"
                  },
                  "return": {
                    "RETURN_APPROVE": "Approve",
                    "RETURN_REJECT": "Reject",
                    "RETURN_RECEIVE": "Receive"
                  },
                  "refund": {
                    "REFUND_APPROVE": "Approve",
                    "REFUND_REJECT": "Reject",
                    "REFUND_ISSUE": "Issue"
                  }
                },
                "messages": {
                  "loadingOrder": "Loading order...",
                  "loadingReturn": "Loading return...",
                  "loadingRefund": "Loading refund...",
                  "selectOrder": "Select an order to see details.",
                  "selectReturn": "Select a return to see details.",
                  "selectRefund": "Select a refund to see details.",
                  "orderUpdated": "Order updated.",
                  "returnRequestCreated": "Return request created.",
                  "refundRequestCreated": "Refund request created."
                },
                "skeleton": {
                  "enabled": true,
                  "timePlaceholder": "-",
                  "lineItemsCount": 2
                }
              }
            }
          }
        }
      ]
    },
    {
      "id": "user-tasks-panel",
      "type": "UserPanel",
      "props": { "tab": "tasks" },
      "children": [
        {
          "id": "user-tasks-placeholder",
          "type": "UserPlaceholderPanel",
          "props": {
            "title": "Tasks",
            "subtitle": "Your assigned tasks and approvals will appear here."
          }
        }
      ]
    },
    {
      "id": "user-reports-panel",
      "type": "UserPanel",
      "props": { "tab": "reports" },
      "children": [
        {
          "id": "user-reports-placeholder",
          "type": "UserPlaceholderPanel",
          "props": {
            "title": "Reports",
            "subtitle": "Download activity reports and exports here."
          }
        }
      ]
    },
    {
      "id": "user-settings-panel",
      "type": "UserPanel",
      "props": { "tab": "settings" },
      "children": [
        {
          "id": "tenant-admin-access",
          "type": "TenantAdminAccessPanel",
          "props": {
            "layout": {
              "title": "Sensitive access approvals",
              "subtitle": "Grant EIP administrators access to this tenant. Sensitive data access requires a 24h token.",
              "form": {
                "tokenHint": "Share securely. Token expires in 24 hours."
              }
            }
          }
        },
        {
          "id": "commerce-settings",
          "type": "EcomCommerceSettingsPanel"
        }
      ]
    }
  ]
}$$::jsonb,
  $${
  "source": "seed",
  "generated_at": "2026-02-10T21:10:00.000Z"
}$$::jsonb
FROM eip_core.ui_surface
WHERE tenant_id IS NULL AND code = 'dashboard';

COMMIT;
