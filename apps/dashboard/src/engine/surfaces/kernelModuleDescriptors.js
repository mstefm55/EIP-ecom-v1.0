const entityFields = [
  { name: "entity_kind", label: "Kind", type: "select", optionList: "ENTITY_KIND", options: ["ORG", "PERSON", "DIVISION", "DEPARTMENT", "TEAM", "SYSTEM", "OTHER"] },
  { name: "code", label: "Code" },
  { name: "display_name", label: "Display name" },
  { name: "legal_name", label: "Legal name" },
  { name: "roles", label: "Roles", type: "multiselect", optionList: "ENTITY_ROLE", defaultOptionsPath: "roles" },
  { name: "status", label: "Status", type: "select", optionList: "ENTITY_STATUS", defaultOptionsPath: "statuses" },
  { name: "registration_number", label: "Registration number" },
  { name: "tax_number", label: "Tax number" },
  { name: "country_code", label: "Country" },
  { name: "currency_code", label: "Currency" },
  { name: "website", label: "Website", type: "url" },
  { name: "notes", label: "Notes", type: "textarea", rows: 2 }
];

const addressFields = [
  { name: "address_type", label: "Address type", type: "select", optionList: "ENTITY_ADDRESS_TYPE", options: ["MAIN", "BILLING", "SHIPPING"] },
  { name: "label", label: "Label" },
  { name: "line1", label: "Line 1" },
  { name: "line2", label: "Line 2" },
  { name: "city", label: "City" },
  { name: "state_region", label: "State/Region" },
  { name: "postal_code", label: "Postal code" },
  { name: "country_code", label: "Country" },
  { name: "is_primary", label: "Primary", type: "checkbox" },
  { name: "is_active", label: "Active", type: "checkbox", defaultValue: true }
];

const contactFields = [
  { name: "contact_type", label: "Contact type", type: "select", optionList: "ENTITY_CONTACT_TYPE", options: ["EMAIL", "PHONE", "WEBSITE"] },
  { name: "label", label: "Label" },
  { name: "value", label: "Value" },
  { name: "is_primary", label: "Primary", type: "checkbox" },
  { name: "is_active", label: "Active", type: "checkbox", defaultValue: true }
];

const bankFields = [
  { name: "account_type", label: "Account type", type: "select", optionList: "ENTITY_BANK_ACCOUNT_TYPE", options: ["BANK", "MOBILE_MONEY", "OTHER"] },
  { name: "label", label: "Label" },
  { name: "bank_name", label: "Bank" },
  { name: "account_name", label: "Account name" },
  { name: "account_number", label: "Account number" },
  { name: "iban", label: "IBAN" },
  { name: "swift_bic", label: "SWIFT/BIC" },
  { name: "currency_code", label: "Currency" },
  { name: "is_primary", label: "Primary", type: "checkbox" },
  { name: "is_active", label: "Active", type: "checkbox", defaultValue: true }
];

const relationshipFields = [
  { name: "related_entity_id", label: "Related entity", type: "lookup", endpoint: "/api/eip/entities", itemsPath: "items", valuePath: "id", labelPath: "display_name", placeholder: "Search entities" },
  { name: "relation_type", label: "Relationship", type: "select", optionList: "ENTITY_RELATIONSHIP_TYPE", options: ["RELATED_TO", "PARENT_OF", "SUBSIDIARY_OF", "MEMBER_OF", "DIVISION_OF", "DEPARTMENT_OF", "TEAM_OF", "REPORTS_TO", "AFFILIATED_TO", "CONTACT_FOR", "WORKS_FOR", "BILLS_TO", "SUPPLIES_TO", "SUPPLIER_OF", "CUSTOMER_OF"] },
  { name: "direction", label: "Direction", type: "select", options: ["OUTGOING", "INCOMING"] },
  { name: "relationship_scope", label: "Scope", type: "select", optionList: "ENTITY_RELATIONSHIP_SCOPE", options: ["GENERAL", "SELF", "LEGAL", "COMMERCIAL", "OPERATIONAL"], defaultValue: "GENERAL" },
  { name: "structure_category", label: "Structure category", type: "select", optionList: "ENTITY_STRUCTURE_CATEGORY", options: ["SELF", "GROUP", "TEAM", "LEGAL", "COMMERCIAL", "OPERATIONAL"], defaultValue: "SELF" },
  { name: "mobile_affiliation", label: "Mobile affiliation", type: "checkbox" },
  { name: "valid_from", label: "Valid from", type: "date" },
  { name: "valid_to", label: "Valid to", type: "date" },
  { name: "movement_reason", label: "Movement reason" },
  { name: "is_active", label: "Active", type: "checkbox", defaultValue: true }
];

const materialFields = [
  { name: "code", label: "Code" },
  { name: "name", label: "Name" },
  { name: "material_type", label: "Type", type: "select", optionLists: ["INVENTORY_MATERIAL_TYPE", "MATERIAL_TYPE"], defaultOptionsPath: "material_types" },
  { name: "status", label: "Status", type: "select", optionList: "INVENTORY_MATERIAL_STATUS", defaultOptionsPath: "material_statuses" },
  { name: "unit_of_measure", label: "Unit" },
  { name: "category", label: "Category" },
  { name: "family", label: "Family" },
  { name: "default_supplier_entity_id", label: "Supplier entity id" },
  { name: "reorder_point", label: "Reorder point", type: "number", sourcePath: "stock_profile.reorder_point" },
  { name: "reorder_qty", label: "Reorder quantity", type: "number", sourcePath: "stock_profile.reorder_qty" },
  { name: "safety_stock", label: "Safety stock", type: "number", sourcePath: "stock_profile.safety_stock" },
  { name: "notes", label: "Notes", type: "textarea", rows: 2 }
];

const lotFields = [
  { name: "lot_code", label: "Lot code" },
  { name: "quantity", label: "Quantity", type: "number" },
  { name: "unit", label: "Unit", sourcePath: "unit" },
  { name: "status", label: "Status", type: "select", optionLists: ["INVENTORY_LOT_STATUS", "MATERIAL_LOT_STATUS"], defaultOptionsPath: "lot_statuses" },
  { name: "received_date", label: "Received", type: "date" },
  { name: "expiry_date", label: "Expires", type: "date" },
  { name: "location_ref", label: "Location" },
  { name: "supplier_agent_id", label: "Supplier entity id" },
  { name: "notes", label: "Notes", type: "textarea", rows: 2 }
];

const procurementRequestFields = [
  { name: "item_type", label: "Item type", type: "select", options: ["MATERIAL", "SERVICE"], defaultValue: "MATERIAL" },
  { name: "material_id", label: "Material", type: "lookup", endpoint: "/api/eip/procurement/lookup?kind=material", itemsPath: "items", valuePath: "id", labelPath: "label", placeholder: "Search materials" },
  { name: "service_item_name", label: "Service item" },
  { name: "title", label: "Title" },
  { name: "description", label: "Description", type: "textarea", rows: 2 },
  { name: "requested_qty", label: "Quantity", type: "number" },
  { name: "unit_of_measure", label: "Unit" },
  { name: "supplier_agent_id", label: "Supplier", type: "lookup", endpoint: "/api/eip/procurement/lookup?kind=supplier", itemsPath: "items", valuePath: "id", labelPath: "label", placeholder: "Search suppliers" },
  { name: "required_by_date", label: "Required by", type: "date" },
  { name: "priority", label: "Priority", type: "select", options: ["LOW", "NORMAL", "HIGH", "URGENT"], defaultValue: "NORMAL" },
  { name: "estimated_unit_cost", label: "Estimated unit cost", type: "number" },
  { name: "currency", label: "Currency", defaultValue: "EUR" },
  { name: "payment_terms_code", label: "Payment terms", type: "select", optionList: "PAYMENT_TERMS", defaultValue: "NET_30" },
  { name: "incoterm_code", label: "Incoterm", type: "select", optionList: "INCOTERM", allowEmpty: true },
  { name: "notes", label: "Notes", type: "textarea", rows: 2 }
];

export const crmKernelWorkspaceNode = {
  id: "crm-management-workspace",
  type: "KernelModuleWorkspace",
  props: {
    module: "crm",
    configEndpoint: "/api/eip/crm/governance/options",
    layout: {
      icon: "pipeline",
      eyebrow: "CRM Management",
      title: "CRM",
      subtitle: "Accounts, contacts, opportunities, pipeline, activities, policy context, documents, and governed conversion intent.",
      processHealth: { label: "CRM flow", value: "Pipeline ready" },
      metrics: [
        { label: "Accounts", path: "items.length", format: "number", icon: "building" },
        { label: "Open opportunities", path: "summary.open_opportunities", format: "number", icon: "pipeline" },
        { label: "Open activities", path: "summary.open_activities", format: "number", icon: "activity" }
      ]
    },
    list: {
      endpoint: "/api/eip/crm/accounts",
      itemsPath: "items",
      limit: 50,
      icon: "building",
      titlePath: "display_name",
      subtitlePath: "code",
      badgePath: "status",
      searchPlaceholder: "Search accounts",
      meta: [
        { label: "Roles", path: "roles", format: "array" },
        { label: "Country", path: "country_code" }
      ]
    },
    detail: {
      endpoint: "/api/eip/crm/accounts/:id",
      titlePath: "display_name",
      subtitlePath: "code",
      badgePath: "status",
      emptyLabel: "Select an account.",
      meta: [
        { label: "Roles", path: "item.roles", format: "array" },
        { label: "Currency", path: "item.currency_code" },
        { label: "Source", path: "item.source", format: "label" }
      ],
      process: {
        label: "CRM intent",
        stage: { path: "item.status", format: "label" },
        nextAction: { path: "summary.next_action", fallback: "Qualify account, update opportunity, or schedule activity" },
        blocked: { path: "summary.blocked_reasons", format: "array" },
        approval: { path: "policy_summary.domains.COMMERCIAL.resolution_status", format: "label" },
        taskCount: { path: "summary.open_activities", format: "number" }
      },
      overviewCards: [
        { label: "Contacts", path: "summary.contacts", format: "number", icon: "users" },
        { label: "Open opportunities", path: "summary.open_opportunities", format: "number", icon: "pipeline" },
        { label: "Pipeline value", path: "summary.pipeline_value", format: "number", icon: "trend" },
        { label: "Commercial conditions", path: "summary.commercial_conditions", format: "number", icon: "policy" }
      ]
    },
    tabs: [
      {
        id: "overview",
        label: "Overview",
        icon: "building",
        type: "summary",
        rows: [
          { label: "Status", path: "item.status", format: "label" },
          { label: "Roles", path: "item.roles", format: "array" },
          { label: "Contacts", path: "summary.contacts", format: "number" },
          { label: "Open opportunities", path: "summary.open_opportunities", format: "number" },
          { label: "Open activities", path: "summary.open_activities", format: "number" },
          { label: "Pipeline value", path: "summary.pipeline_value", format: "number" }
        ]
      },
      { id: "communications", label: "Communications", icon: "mail", type: "communications", itemsPath: "communications", titlePath: "title", subtitlePath: "record_type", badgePath: "relation_type", disabledMessage: "Communication provider not configured" }
    ]
  }
};

export const procurementKernelWorkspaceNode = {
  id: "procurement-workspace",
  type: "KernelModuleWorkspace",
  props: {
    module: "procurement",
    configEndpoint: "/api/eip/procurement/governance/options",
    layout: {
      icon: "shopping-cart",
      eyebrow: "Procurement Management",
      title: "Procurement",
      subtitle: "Purchase needs, supplier selection, commercial terms, approvals, documents, activity, and next procurement actions.",
      processHealth: { label: "Sourcing flow", path: "summary.next_action.label", fallback: "Workflow ready" },
      metrics: [
        { label: "Needs", path: "items.length", format: "number", icon: "shopping-cart" },
        { label: "Selected status", path: "item.status", format: "label", icon: "dot" },
        { label: "Open tasks", path: "activity.summary.open_tasks", format: "number", icon: "activity" }
      ]
    },
    list: {
      endpoint: "/api/eip/procurement/requests",
      itemsPath: "items",
      limit: 50,
      icon: "shopping-cart",
      titlePath: "title",
      subtitlePath: "code",
      badgePath: "status",
      searchPlaceholder: "Search purchase needs",
      meta: [
        { label: "Priority", path: "priority", format: "label" },
        { label: "Item", path: "item_type", format: "label" }
      ],
      filters: [
        { name: "status", label: "Status", optionList: "PROCUREMENT_REQUEST_STATUS", defaultOptionsPath: "statuses" }
      ]
    },
    detail: {
      endpoint: "/api/eip/procurement/requests/:id",
      titlePath: "title",
      subtitlePath: "code",
      badgePath: "status",
      emptyLabel: "Select a purchase need.",
      meta: [
        { label: "Supplier", path: "item.supplier_name" },
        { label: "Payment terms", path: "commercial_terms.payment_terms_code" },
        { label: "Incoterm", path: "commercial_terms.incoterm_code" },
        { label: "Approval", path: "approval.status", format: "label" }
      ],
      process: {
        label: "Procurement intent",
        stage: { path: "item.status", format: "label" },
        nextAction: { path: "summary.next_action.label", fallback: "Review supplier, terms, and approval path" },
        blocked: { path: "recommendation.missing_data", format: "array" },
        approval: { path: "approval.status", format: "label" },
        taskCount: { path: "activity.summary.open_tasks", format: "number" }
      },
      overviewCards: [
        { label: "Buying route", path: "recommendation.procurement_model", format: "label", icon: "reorder" },
        { label: "Selected supplier", path: "item.supplier_name", icon: "users" },
        { label: "Approval", path: "approval.status", format: "label", icon: "policy" },
        { label: "Documents", path: "documents.length", format: "number", icon: "document" }
      ]
    },
    actions: {
      create: {
        label: "Create need",
        title: "Create purchase need",
        endpoint: "/api/eip/procurement/requests",
        method: "POST",
        permission: "procurement.request.create",
        fields: procurementRequestFields
      }
    },
    rowActions: [
      {
        id: "submit",
        label: "Submit",
        endpoint: "/api/eip/procurement/requests/:id/submit",
        method: "POST",
        permission: "procurement.request.submit",
        primary: true,
        enabledStatuses: ["DRAFT", "NEEDS_REVIEW"],
        disabledReason: "Submit is available for draft or review needs."
      },
      {
        id: "approve",
        label: "Approve",
        endpoint: "/api/eip/procurement/requests/:id/approve",
        method: "POST",
        permission: "procurement.request.approve",
        primary: true,
        enabledStatuses: ["PENDING_APPROVAL"],
        disabledReason: "Approve is available after submission."
      },
      {
        id: "reject",
        label: "Reject",
        endpoint: "/api/eip/procurement/requests/:id/reject",
        method: "POST",
        permission: "procurement.request.approve",
        enabledStatuses: ["PENDING_APPROVAL"],
        disabledReason: "Reject is available after submission."
      }
    ],
    tabs: [
      {
        id: "overview",
        label: "Overview",
        icon: "shopping-cart",
        type: "summary",
        rows: [
          { label: "Item type", path: "item.item_type", format: "label" },
          { label: "Material", path: "item.material_name" },
          { label: "Service", path: "item.service_item_name" },
          { label: "Quantity", path: "item.requested_qty", unitPath: "item.unit_of_measure", format: "quantity" },
          { label: "Selected supplier", path: "item.supplier_name" },
          { label: "Next action", path: "summary.next_action.label" }
        ]
      },
      {
        id: "purchase_needs",
        label: "Purchase Needs",
        icon: "package",
        type: "form",
        form: {
          title: "Purchase need",
          endpoint: "/api/eip/procurement/requests/:id",
          method: "PATCH",
          permission: "procurement.request.update",
          submitLabel: "Save need",
          resetOnSave: false,
          fields: procurementRequestFields
        }
      },
      {
        id: "recommendations",
        label: "Recommendations",
        icon: "reorder",
        type: "summary",
        rows: [
          { label: "Buying route", path: "recommendation.procurement_model", format: "label" },
          { label: "Reason", path: "recommendation.reason", format: "label" },
          { label: "Estimated landed cost", path: "recommendation.estimated_landed_cost", format: "number" },
          { label: "Currency", path: "recommendation.currency" },
          { label: "Warnings", path: "recommendation.warnings", format: "array" },
          { label: "Missing data", path: "recommendation.missing_data", format: "array" }
        ]
      },
      { id: "suppliers", label: "Suppliers", icon: "users", type: "records", itemsPath: "supplier_options", titlePath: "supplier_name", subtitlePath: "relationship_source", badgePath: "supplier_role", empty: "No supplier options found." },
      {
        id: "commercial_terms",
        label: "Commercial Terms",
        icon: "file",
        type: "summary",
        rows: [
          { label: "Payment terms", path: "commercial_terms.payment_terms_code" },
          { label: "Incoterm", path: "commercial_terms.incoterm_code" },
          { label: "Trade credit", path: "commercial_terms.trade_credit" },
          { label: "Commercial conditions", path: "commercial_terms.conditions.length", format: "number" }
        ]
      },
      {
        id: "approvals",
        label: "Approvals",
        icon: "policy",
        type: "summary",
        rows: [
          { label: "Approval required", path: "approval.required" },
          { label: "Approval status", path: "approval.status", format: "label" },
          { label: "Pending approval", path: "approval.pending" },
          { label: "Approval conditions", path: "approval.conditions.length", format: "number" }
        ]
      },
      { id: "documents", label: "Documents", icon: "document", type: "records", itemsPath: "documents", titlePath: "title", subtitlePath: "record_type", badgePath: "relation_type", empty: "No quote, supplier document, contract, note, or attachment metadata linked." },
      {
        id: "activity",
        label: "Activity",
        icon: "archive",
        type: "summary",
        rows: [
          { label: "Tasks", path: "activity.summary.tasks", format: "number" },
          { label: "Open tasks", path: "activity.summary.open_tasks", format: "number" },
          { label: "Status events", path: "activity.summary.events", format: "number" },
          { label: "Policy commercial resolution", path: "policy_summary.domains.COMMERCIAL.resolution_status", format: "label" }
        ]
      }
    ]
  }
};

export const inventoryKernelWorkspaceNode = {
  id: "inventory-management-workspace",
  type: "KernelModuleWorkspace",
  props: {
    module: "inventory",
    optionsEndpoint: "/api/eip/inventory/governance/options",
    layout: {
      icon: "package",
      eyebrow: "Inventory Management",
      title: "Inventory",
      subtitle: "Materials, lots, stock visibility, reorder recommendations, policy explanations, suppliers, documents, and activity.",
      processHealth: { label: "Stock flow", path: "item.stock_profile.risk_status", fallback: "Stock monitored", format: "label" },
      metrics: [
        { label: "Materials", path: "items.length", format: "number", icon: "package" },
        { label: "On hand", path: "item.stock_profile.stock_on_hand", unitPath: "item.stock_profile.unit_of_measure", format: "quantity", icon: "boxes" },
        { label: "Risk", path: "item.stock_profile.risk_status", format: "label", icon: "reorder" }
      ]
    },
    list: {
      endpoint: "/api/eip/inventory/materials",
      itemsPath: "items",
      limit: 100,
      icon: "package",
      titlePath: "name",
      subtitlePath: "code",
      badgePath: "status",
      searchPlaceholder: "Search materials",
      meta: [
        { label: "Type", path: "material_type", format: "label" },
        { label: "On hand", path: "stock_profile.stock_on_hand", unitPath: "stock_profile.unit_of_measure", format: "quantity" }
      ],
      filters: [
        { name: "status", label: "Status", optionList: "INVENTORY_MATERIAL_STATUS", defaultOptionsPath: "material_statuses" },
        { name: "material_type", label: "Type", optionLists: ["INVENTORY_MATERIAL_TYPE", "MATERIAL_TYPE"], defaultOptionsPath: "material_types" }
      ]
    },
    detail: {
      endpoint: "/api/eip/inventory/materials/:id",
      titlePath: "name",
      subtitlePath: "code",
      badgePath: "status",
      emptyLabel: "Select a material to inspect inventory.",
      meta: [
        { label: "Type", path: "item.material_type", format: "label" },
        { label: "Available", path: "item.stock_profile.available_qty", unitPath: "item.stock_profile.unit_of_measure", format: "quantity" },
        { label: "Supplier", path: "item.default_supplier_name" },
        { label: "Policy source", path: "item.stock_profile.policy_source", format: "label" }
      ],
      process: {
        label: "Inventory intent",
        stage: { path: "item.stock_profile.risk_status", fallback: "Stock monitored", format: "label" },
        nextAction: { path: "item.stock_profile.next_action", fallback: "Review stock, reorder policy, and procurement bridge" },
        blocked: { path: "item.stock_profile.missing_data", format: "array" },
        approval: { path: "policy_summary.effective_read_model.resolution_status", format: "label" },
        taskCount: { path: "summary.tasks.open", format: "number" }
      },
      overviewCards: [
        { label: "On hand", path: "item.stock_profile.stock_on_hand", unitPath: "item.stock_profile.unit_of_measure", format: "quantity", icon: "boxes" },
        { label: "Available", path: "item.stock_profile.available_qty", unitPath: "item.stock_profile.unit_of_measure", format: "quantity", icon: "check" },
        { label: "Reorder point", path: "item.stock_profile.reorder_point", unitPath: "item.stock_profile.unit_of_measure", format: "quantity", icon: "reorder" },
        { label: "Lots", path: "summary.lots.total", format: "number", icon: "layers" }
      ]
    },
    actions: {
      create: {
        label: "Create material",
        title: "Create material",
        endpoint: "/api/eip/inventory/materials",
        method: "POST",
        permission: "inventory.material.create",
        fields: materialFields
      }
    },
    tabs: [
      {
        id: "overview",
        label: "Overview",
        icon: "boxes",
        type: "summary",
        rows: [
          { label: "Status", path: "item.status", format: "label" },
          { label: "Type", path: "item.material_type", format: "label" },
          { label: "On hand", path: "item.stock_profile.stock_on_hand", unitPath: "item.stock_profile.unit_of_measure", format: "quantity" },
          { label: "Available", path: "item.stock_profile.available_qty", unitPath: "item.stock_profile.unit_of_measure", format: "quantity" },
          { label: "Lots", path: "summary.lots.total", format: "number" },
          { label: "Documents", path: "summary.documents.total", format: "number" }
        ]
      },
      {
        id: "materials",
        label: "Material",
        icon: "package",
        type: "form",
        form: {
          title: "Material profile",
          endpoint: "/api/eip/inventory/materials/:id",
          method: "PATCH",
          permission: "inventory.material.update",
          submitLabel: "Save material",
          resetOnSave: false,
          fields: materialFields
        }
      },
      {
        id: "lots",
        label: "Lots",
        icon: "layers",
        type: "collection",
        itemsPath: "lots",
        titlePath: "lot_code",
        subtitlePath: "quantity",
        badgePath: "status",
        empty: "No lots recorded for this material.",
        createForm: {
          title: "Create lot",
          endpoint: "/api/eip/inventory/materials/:id/lots",
          method: "POST",
          permission: "inventory.lot.create",
          submitLabel: "Create lot",
          fields: lotFields
        },
        updateForm: {
          title: "Update lot",
          endpoint: "/api/eip/inventory/lots/:rowId",
          method: "PATCH",
          permission: "inventory.lot.update",
          submitLabel: "Save lot",
          resetOnSave: false,
          fields: lotFields
        }
      },
      {
        id: "reorder",
        label: "Reorder",
        icon: "reorder",
        type: "summary",
        rows: [
          { label: "Stock status", path: "item.stock_profile.stock_status", format: "label" },
          { label: "Risk status", path: "item.stock_profile.risk_status", format: "label" },
          { label: "Reorder point", path: "item.stock_profile.reorder_point", unitPath: "item.stock_profile.unit_of_measure", format: "quantity" },
          { label: "Suggested quantity", path: "item.stock_profile.suggested_qty", unitPath: "item.stock_profile.unit_of_measure", format: "quantity" },
          { label: "Policy source", path: "item.stock_profile.policy_source", format: "label" },
          { label: "Condition codes", path: "item.stock_profile.policy_condition_codes", format: "array" }
        ]
      },
      {
        id: "policies",
        label: "Policies",
        icon: "policy",
        type: "summary",
        rows: [
          { label: "Policy source", path: "policy_summary.source", format: "label" },
          { label: "Condition codes", path: "policy_summary.condition_codes", format: "array" },
          { label: "Resolution", path: "policy_summary.effective_read_model.resolution_status", format: "label" },
          { label: "Fallback used", path: "policy_summary.effective_read_model.fallback_used" }
        ]
      },
      { id: "documents", label: "Documents", icon: "document", type: "records", itemsPath: "documents", titlePath: "title", subtitlePath: "record_type", badgePath: "status", empty: "No documents linked." },
      { id: "activity", label: "Activity", icon: "archive", type: "records", itemsPath: "movements", titlePath: "title", subtitlePath: "record_type", badgePath: "direction", empty: "No stock movement records." }
    ]
  }
};

export const policiesKernelWorkspaceNode = {
  id: "policies-conditions-workspace",
  type: "KernelModuleWorkspace",
  props: {
    module: "policies-conditions",
    optionsEndpoint: "/api/eip/policies-conditions/governance/options",
    layout: {
      icon: "policy",
      eyebrow: "Policies & Conditions",
      title: "Policies & Conditions",
      subtitle: "Read-only business rules that explain recommendations and approvals.",
      processHealth: { label: "Policy read model", path: "item.mapping_status", fallback: "Governed", format: "label" },
      metrics: [
        { label: "Conditions", path: "items.length", format: "number", icon: "policy" },
        { label: "Domain", path: "item.classification.policy_domain", format: "label", icon: "layers" },
        { label: "Mapping", path: "item.mapping_status", format: "label", icon: "check" }
      ]
    },
    list: {
      endpoint: "/api/eip/policies-conditions",
      itemsPath: "items",
      limitParam: "page_size",
      limit: 25,
      icon: "policy",
      titlePath: "label",
      subtitlePath: "code",
      badgePath: "mapping_status",
      searchPlaceholder: "Search policies",
      meta: [
        { label: "Domain", path: "classification.policy_domain", format: "label" },
        { label: "Nature", path: "classification.condition_nature", format: "label" }
      ],
      filters: [
        { name: "policy_domain", label: "Domain", optionList: "POLICY_DOMAIN" },
        { name: "status", label: "Status", options: [{ value: "needs_review", label: "Needs review" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] }
      ]
    },
    detail: {
      endpoint: "/api/eip/policies-conditions/:id",
      titlePath: "label",
      subtitlePath: "code",
      badgePath: "mapping_status",
      emptyLabel: "Select a policy or condition to inspect the read model.",
      meta: [
        { label: "Domain", path: "item.classification.policy_domain", format: "label" },
        { label: "Family", path: "item.classification.policy_family", format: "label" },
        { label: "Type", path: "item.classification.condition_type", format: "label" },
        { label: "Status", path: "item.status", format: "label" }
      ],
      process: {
        label: "Policy intent",
        stage: { path: "item.mapping_status", format: "label" },
        nextAction: { path: "item.next_action", fallback: "Review scope, values, and effective condition impact" },
        blocked: { path: "item.warnings", format: "array" },
        approval: { path: "item.classification.policy_domain", format: "label" },
        taskCount: { value: 0, format: "number" }
      },
      overviewCards: [
        { label: "Domain", path: "item.classification.policy_domain", format: "label", icon: "policy" },
        { label: "Condition type", path: "item.classification.condition_type", format: "label", icon: "file" },
        { label: "Scope fields", path: "item.scope_summary.length", format: "number", icon: "link" },
        { label: "Warnings", path: "item.warnings.length", format: "number", icon: "alert" }
      ]
    },
    tabs: [
      {
        id: "overview",
        label: "Overview",
        icon: "policy",
        type: "summary",
        rows: [
          { label: "Mapping", path: "item.mapping_status", format: "label" },
          { label: "Status", path: "item.status", format: "label" },
          { label: "Domain", path: "item.classification.policy_domain", format: "label" },
          { label: "Family", path: "item.classification.policy_family", format: "label" },
          { label: "Condition type", path: "item.classification.condition_type", format: "label" },
          { label: "Nature", path: "item.classification.condition_nature", format: "label" }
        ]
      },
      { id: "scope", label: "Scope", icon: "link", type: "json", path: "item.scope_summary" },
      { id: "values", label: "Values", icon: "file", type: "json", path: "item.value_summary" },
      { id: "warnings", label: "Warnings", icon: "archive", type: "json", path: "item.warnings" }
    ]
  }
};

export const entityKernelWorkspaceNode = {
  id: "entity-management-workspace",
  type: "KernelModuleWorkspace",
  props: {
    module: "entity-management",
    optionsEndpoint: "/api/eip/entities/governance/options",
    layout: {
      icon: "building",
      eyebrow: "Entity Management",
      title: "Entity Management",
      subtitle: "Customers, suppliers, employees, partners, authorities, addresses, contacts, bank accounts, relationships, documents, policies, and activity.",
      processHealth: { label: "Entity lifecycle", path: "item.status", fallback: "Registry ready", format: "label" },
      metrics: [
        { label: "Entities", path: "items.length", format: "number", icon: "building" },
        { label: "Contacts", path: "summary.contacts", format: "number", icon: "users" },
        { label: "Open tasks", path: "activity_summary.tasks.open", format: "number", icon: "activity" }
      ]
    },
    list: {
      endpoint: "/api/eip/entities",
      itemsPath: "items",
      limit: 50,
      icon: "building",
      titlePath: "display_name",
      subtitlePath: "code",
      badgePath: "status",
      searchPlaceholder: "Search entities",
      meta: [
        { label: "Roles", path: "roles", format: "array" },
        { label: "Kind", path: "entity_kind", format: "label" }
      ],
      filters: [
        { name: "role", label: "Role", optionList: "ENTITY_ROLE", defaultOptionsPath: "roles" },
        { name: "status", label: "Status", optionList: "ENTITY_STATUS", defaultOptionsPath: "statuses" },
        { name: "entity_kind", label: "Kind", optionList: "ENTITY_KIND", options: ["ORG", "PERSON", "DIVISION", "DEPARTMENT", "TEAM", "SYSTEM", "OTHER"] }
      ]
    },
    detail: {
      endpoint: "/api/eip/entities/:id",
      titlePath: "display_name",
      subtitlePath: "code",
      badgePath: "status",
      emptyLabel: "Select an entity.",
      meta: [
        { label: "Roles", path: "item.roles", format: "array" },
        { label: "Kind", path: "item.entity_kind", format: "label" },
        { label: "Country", path: "item.country_code" },
        { label: "Currency", path: "item.currency_code" }
      ],
      process: {
        label: "Entity intent",
        stage: { path: "item.status", format: "label" },
        nextAction: { path: "summary.next_action", fallback: "Complete profile, contacts, relationships, policies, and activity" },
        blocked: { path: "summary.missing_data", format: "array" },
        approval: { path: "policy_summary.resolution_status", format: "label" },
        taskCount: { path: "activity_summary.tasks.open", format: "number" }
      },
      overviewCards: [
        { label: "Contacts", path: "summary.contacts", format: "number", icon: "users" },
        { label: "Addresses", path: "summary.addresses", format: "number", icon: "link" },
        { label: "Relationships", path: "summary.relationships", format: "number", icon: "layers" },
        { label: "Open tasks", path: "activity_summary.tasks.open", format: "number", icon: "activity" }
      ]
    },
    actions: {
      create: {
        label: "Create entity",
        title: "Create entity",
        endpoint: "/api/eip/entities",
        method: "POST",
        permission: "entities.create",
        fields: entityFields
      }
    },
    tabs: [
      {
        id: "overview",
        label: "Overview",
        icon: "building",
        type: "summary",
        rows: [
          { label: "Kind", path: "item.entity_kind", format: "label" },
          { label: "Status", path: "item.status", format: "label" },
          { label: "Roles", path: "item.roles", format: "array" },
          { label: "Country", path: "item.country_code" },
          { label: "Contacts", path: "summary.contacts", format: "number" },
          { label: "Tasks", path: "summary.tasks", format: "number" }
        ]
      },
      {
        id: "profile",
        label: "Profile",
        icon: "building",
        type: "form",
        form: {
          title: "Entity profile",
          endpoint: "/api/eip/entities/:id",
          method: "PATCH",
          permission: "entities.update",
          submitLabel: "Save entity",
          resetOnSave: false,
          fields: entityFields
        }
      },
      {
        id: "addresses",
        label: "Addresses",
        icon: "link",
        type: "collection",
        itemsPath: "addresses",
        titlePath: "label",
        subtitlePath: "line1",
        badgePath: "address_type",
        empty: "No addresses recorded.",
        createForm: { title: "Add address", endpoint: "/api/eip/entities/:id/addresses", method: "POST", permission: "entities.manage_addresses", submitLabel: "Add address", fields: addressFields },
        updateForm: { title: "Update address", endpoint: "/api/eip/entities/:id/addresses/:rowId", method: "PATCH", permission: "entities.manage_addresses", submitLabel: "Save address", resetOnSave: false, fields: addressFields }
      },
      {
        id: "contacts",
        label: "Contacts",
        icon: "users",
        type: "collection",
        itemsPath: "contacts",
        titlePath: "label",
        subtitlePath: "value",
        badgePath: "contact_type",
        empty: "No contacts recorded.",
        createForm: { title: "Add contact", endpoint: "/api/eip/entities/:id/contacts", method: "POST", permission: "entities.manage_contacts", submitLabel: "Add contact", fields: contactFields },
        updateForm: { title: "Update contact", endpoint: "/api/eip/entities/:id/contacts/:rowId", method: "PATCH", permission: "entities.manage_contacts", submitLabel: "Save contact", resetOnSave: false, fields: contactFields }
      },
      {
        id: "bank_accounts",
        label: "Bank Accounts",
        icon: "file",
        type: "collection",
        itemsPath: "bank_accounts",
        titlePath: "label",
        subtitlePath: "bank_name",
        badgePath: "currency_code",
        empty: "No bank account metadata recorded.",
        createForm: { title: "Add bank account", endpoint: "/api/eip/entities/:id/bank-accounts", method: "POST", permission: "entities.manage_bank_accounts", submitLabel: "Add bank account", fields: bankFields },
        updateForm: { title: "Update bank account", endpoint: "/api/eip/entities/:id/bank-accounts/:rowId", method: "PATCH", permission: "entities.manage_bank_accounts", submitLabel: "Save bank account", resetOnSave: false, fields: bankFields }
      },
      {
        id: "relationships",
        label: "Relationships",
        icon: "link",
        type: "collection",
        itemsPath: "relationships",
        titlePath: "related_entity.display_name",
        subtitlePath: "related_entity.code",
        badgePath: "relation_type",
        empty: "No relationships recorded.",
        createForm: { title: "Add relationship", endpoint: "/api/eip/entities/:id/relationships", method: "POST", permission: "entities.manage_relationships", submitLabel: "Add relationship", fields: relationshipFields },
        updateForm: { title: "Update relationship", endpoint: "/api/eip/entities/:id/relationships/:rowId", method: "PATCH", permission: "entities.manage_relationships", submitLabel: "Save relationship", resetOnSave: false, fields: relationshipFields }
      },
      {
        id: "org_chart",
        label: "Org Chart",
        icon: "layers",
        type: "org_chart",
        itemsPath: "org_chart",
        endpoint: "/api/eip/entities/:id/org-chart?relationship_scope=SELF&structure_category=SELF",
        moveEndpoint: "/api/eip/entities/:id/org-chart/move",
        moveMethod: "POST",
        moveRelationType: "MEMBER_OF",
        relationshipScope: "SELF",
        structureCategory: "SELF",
        permission: "entities.manage_relationships",
        empty: "No self-structure relationships recorded."
      },
      { id: "documents", label: "Documents", icon: "document", type: "records", itemsPath: "documents", titlePath: "title", subtitlePath: "record_type", badgePath: "status", empty: "No documents linked." },
      {
        id: "policies",
        label: "Policies",
        icon: "policy",
        type: "summary",
        rows: [
          { label: "Total policies", path: "policy_summary.total", format: "number" },
          { label: "Policy domains", path: "policy_summary.domains", format: "array" }
        ]
      },
      {
        id: "activity",
        label: "Activity",
        icon: "archive",
        type: "summary",
        rows: [
          { label: "Service objects", path: "activity_summary.service_objects.total", format: "number" },
          { label: "Tasks", path: "activity_summary.tasks.total", format: "number" },
          { label: "Open tasks", path: "activity_summary.tasks.open", format: "number" },
          { label: "Overdue tasks", path: "activity_summary.tasks.overdue", format: "number" }
        ]
      }
    ]
  }
};
