import { hasPermission } from "../../auth/perm.js";

export const OPEN_TASK_STATUSES = ["open", "assigned", "in_progress", "blocked", "pending", "review"];

const CATEGORY_DEFS = [
  {
    code: "crm",
    label: "Customer work",
    surface: "crm",
    keywords: ["crm", "lead", "case", "opportunity", "interaction", "mailbox", "reply", "customer", "prospect"]
  },
  {
    code: "commerce",
    label: "Orders and payments",
    surface: "commerce",
    keywords: ["commerce", "order", "payment", "refund", "return", "checkout", "fulfillment"]
  },
  {
    code: "inventory",
    label: "Inventory signals",
    surface: "inventory",
    keywords: ["inventory", "stock", "reorder", "material", "lot", "warehouse"]
  },
  {
    code: "procurement",
    label: "Procurement decisions",
    surface: "procurement",
    keywords: ["procurement", "purchase", "supplier", "rfq", "quote", "cash_purchase", "requisition"]
  },
  {
    code: "content",
    label: "Content and catalog",
    surface: "content",
    keywords: ["content", "catalog", "product", "publish", "storefront", "mapping"]
  },
  {
    code: "reports",
    label: "Reports and review",
    surface: "reports",
    keywords: ["report", "audit", "review", "analysis", "monitoring"]
  },
  {
    code: "general",
    label: "General tasks",
    surface: "tasks",
    keywords: []
  }
];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoOrNull(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

function truncate(value, max = 140) {
  const text = normalizeText(value).replace(/\s+/g, " ");
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}...`;
}

function readAttr(row, key) {
  const attrs = asObject(row.attrs);
  const payload = asObject(row.payload);
  const objectAttrs = asObject(row.object_attrs);
  return attrs[key] ?? payload[key] ?? objectAttrs[key] ?? null;
}

async function getPrimaryAgentId(client, tenantId, identityId) {
  const r = await client.query(
    `
    SELECT agent_id
    FROM eip_auth.auth_identity_agent
    WHERE tenant_id=$1
      AND identity_id=$2
      AND is_primary=true
      AND is_active=true
    LIMIT 1
    `,
    [tenantId, identityId]
  );
  return r.rows[0]?.agent_id || null;
}

async function buildActiveModules(app, tenantId) {
  const [moduleSettingsRes, surfacesRes] = await Promise.all([
    app.db.query(
      `
      SELECT DISTINCT module
      FROM eip_core.tenant_module_setting
      WHERE tenant_id = $1
        AND is_active = true
      `,
      [tenantId]
    ),
    app.db.query(
      `
      SELECT code, attrs
      FROM eip_core.ui_surface
      WHERE is_active = true
        AND is_published = true
        AND (tenant_id = $1 OR tenant_id IS NULL)
      `,
      [tenantId]
    )
  ]);

  const modules = new Set();
  for (const row of moduleSettingsRes.rows || []) {
    const code = normalizeLower(row.module);
    if (code) modules.add(code);
  }
  for (const row of surfacesRes.rows || []) {
    const attrs = asObject(row.attrs);
    const code = normalizeLower(attrs.module || attrs.surface_group || attrs.area || row.code);
    if (code) modules.add(code);
  }
  return [...modules].sort((a, b) => a.localeCompare(b));
}

function deriveCategory(row) {
  const explicitModule = normalizeLower(readAttr(row, "module") || readAttr(row, "area") || readAttr(row, "surface"));
  const strongFields = [
    row.task_type,
    row.object_type,
    row.process_code,
    row.process_name
  ].map(normalizeLower).join(" ");
  const descriptiveFields = [
    readAttr(row, "module"),
    readAttr(row, "area"),
    readAttr(row, "surface"),
    readAttr(row, "source"),
    row.title,
    row.description
  ].map(normalizeLower).join(" ");

  const scores = CATEGORY_DEFS.map((category) => {
    let score = explicitModule === category.code ? 100 : 0;
    for (const keyword of category.keywords) {
      const token = normalizeLower(keyword);
      const pattern = new RegExp(`(^|[^a-z0-9])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
      if (pattern.test(strongFields)) score += token === "order" ? 4 : 12;
      if (pattern.test(descriptiveFields)) score += token === "order" ? 1 : 3;
    }
    return { category, score };
  }).sort((a, b) => b.score - a.score);

  return scores[0]?.score > 0 ? scores[0].category : CATEGORY_DEFS[CATEGORY_DEFS.length - 1];
}

function computeUrgency(row) {
  const status = normalizeLower(row.status);
  const priority = normalizeLower(readAttr(row, "priority") || readAttr(row, "severity"));
  const due = parseDate(row.due_at);
  const today = startOfToday();
  const tomorrow = endOfToday();

  if (status === "blocked" || priority === "critical") {
    return { code: "critical", label: "Critical", score: 4, reason: status === "blocked" ? "Blocked" : "Critical priority" };
  }
  if (due && due < today) {
    return { code: "critical", label: "Overdue", score: 4, reason: "Past due" };
  }
  if (priority === "high" || priority === "urgent") {
    return { code: "high", label: "High", score: 3, reason: "High priority" };
  }
  if (due && due < tomorrow) {
    return { code: "high", label: "Due today", score: 3, reason: "Due today" };
  }
  if (due) {
    const days = (due.getTime() - Date.now()) / 86400000;
    if (days <= 3) return { code: "medium", label: "Soon", score: 2, reason: "Due soon" };
  }
  return { code: "normal", label: "Normal", score: 1, reason: "Open work" };
}

function buildContext(row) {
  const objectCode = normalizeText(row.object_code);
  const objectTitle = normalizeText(row.object_title);
  const objectType = normalizeText(row.object_type)
    .replace(/^CRM_|^ECOM_/i, "")
    .replace(/_/g, " ")
    .toLowerCase();
  const readableType = objectType ? objectType.charAt(0).toUpperCase() + objectType.slice(1) : "";
  if (objectCode && objectTitle && objectTitle.toLowerCase().includes(objectCode.toLowerCase())) {
    return readableType ? `${readableType} ${objectCode}` : objectCode;
  }
  const parts = [
    readableType && objectCode ? `${readableType} ${objectCode}` : objectCode || readableType,
    objectTitle,
    normalizeText(row.process_name || row.process_code)
  ].filter(Boolean);
  return [...new Set(parts)].slice(0, 2).join(" - ") || normalizeText(row.task_type) || "Task";
}

function normalizeReferenceDisplay(value) {
  const text = normalizeText(value);
  if (!text.includes(" - ")) return text;
  const [left, ...rest] = text.split(" - ");
  const right = rest.join(" - ").trim();
  if (!left || !right) return text;
  const leftText = left.trim();
  const rightLower = right.toLowerCase();
  if (rightLower.includes(leftText.toLowerCase())) return right;
  return text;
}

function toTaskItem(row) {
  const category = deriveCategory(row);
  const urgency = computeUrgency(row);
  const title = normalizeReferenceDisplay(row.title) || normalizeText(row.task_type) || "Task";
  const openLabel = category.code === "crm" && normalizeLower(row.task_type).includes("reply")
    ? "Reply"
    : category.code === "procurement"
      ? "Review"
      : "Open";

  return {
    id: row.id,
    title,
    description: truncate(row.description, 180),
    status: row.status,
    task_type: row.task_type,
    due_at: row.due_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category_code: category.code,
    category_label: category.label,
    surface: category.surface,
    urgency: urgency.code,
    urgency_label: urgency.label,
    urgency_score: urgency.score,
    urgency_reason: urgency.reason,
    context: normalizeReferenceDisplay(buildContext(row)),
    assigned_agent_id: row.assigned_agent_id,
    assigned_agent_name: row.assigned_agent_name || row.assigned_agent_code || "",
    delegated_by_agent_id: readAttr(row, "last_delegation")?.actor_agent_id || null,
    delegated_at: readAttr(row, "last_delegation")?.delegated_at || null,
    planned_start_at: readAttr(row, "planned_start_at"),
    planned_end_at: readAttr(row, "planned_end_at"),
    reminder_at: readAttr(row, "reminder_at"),
    priority: normalizeLower(readAttr(row, "priority") || readAttr(row, "severity")) || "normal",
    object: {
      id: row.service_object_id,
      type: row.object_type,
      status: row.object_status,
      code: row.object_code,
      title: row.object_title
    },
    actions: [
      {
        code: "open",
        label: openLabel,
        kind: "navigate",
        surface: category.surface,
        governed_by: "module_workspace"
      },
      {
        code: "delegate",
        label: "Delegate",
        kind: "delegate",
        endpoint: `/api/eip/user/tasks/${row.id}/delegate`,
        method: "POST",
        governed_by: "task_assignment"
      },
      {
        code: "schedule",
        label: "Schedule",
        kind: "schedule",
        endpoint: `/api/eip/user/tasks/${row.id}/schedule`,
        method: "POST",
        governed_by: "task_scheduling"
      }
    ]
  };
}

function buildCategoryPayload(tasks, activeModules) {
  return CATEGORY_DEFS
    .filter((category) => category.code === "general" || activeModules.includes(category.code) || tasks.some((task) => task.category_code === category.code))
    .map((category, index) => {
      const categoryTasks = tasks
        .filter((task) => task.category_code === category.code)
        .sort((a, b) => b.urgency_score - a.urgency_score || String(a.due_at || "").localeCompare(String(b.due_at || "")));
      return {
        code: category.code,
        label: category.label,
        surface: category.surface,
        description: category.code === "general"
          ? "Open work that is not tied to a specialized module yet."
          : `Actionable ${category.label.toLowerCase()} for this workspace.`,
        count: categoryTasks.length,
        urgent_count: categoryTasks.filter((task) => task.urgency_score >= 3).length,
        pinned: index < 3,
        tasks: categoryTasks.slice(0, 20)
      };
    });
}

function buildDueBuckets(tasks) {
  const today = startOfToday();
  const tomorrow = endOfToday();
  return [
    { code: "overdue", label: "Overdue", count: tasks.filter((task) => parseDate(task.due_at) && parseDate(task.due_at) < today).length },
    { code: "today", label: "Today", count: tasks.filter((task) => {
      const due = parseDate(task.due_at);
      return due && due >= today && due < tomorrow;
    }).length },
    { code: "later", label: "Later", count: tasks.filter((task) => {
      const due = parseDate(task.due_at);
      return due && due >= tomorrow;
    }).length },
    { code: "unscheduled", label: "Unscheduled", count: tasks.filter((task) => !task.due_at).length }
  ];
}

function buildWidgets({ tasks, activeModules, recentReports }) {
  const dueBuckets = buildDueBuckets(tasks);
  const overdue = dueBuckets.find((bucket) => bucket.code === "overdue")?.count || 0;
  const today = dueBuckets.find((bucket) => bucket.code === "today")?.count || 0;
  const high = tasks.filter((task) => task.urgency_score >= 3).length;

  return [
    {
      code: "open_work",
      label: "Open work",
      value: tasks.length,
      helper: "Tenant-scoped task engine items in motion",
      tone: "ink",
      series: dueBuckets.map((bucket) => ({ label: bucket.label, value: bucket.count }))
    },
    {
      code: "high_urgency",
      label: "High urgency",
      value: high,
      helper: "Overdue, blocked, high priority, or due today",
      tone: high ? "rose" : "emerald",
      series: [
        { label: "Urgent", value: high },
        { label: "Routine", value: Math.max(0, tasks.length - high) }
      ]
    },
    {
      code: "due_today",
      label: "Due today",
      value: today,
      helper: "Tasks with a due date inside today",
      tone: today ? "amber" : "emerald",
      series: dueBuckets
    },
    {
      code: "active_modules",
      label: "Active modules",
      value: activeModules.length,
      helper: "Enabled module and surface areas",
      tone: "brand",
      series: activeModules.slice(0, 6).map((module) => ({ label: module, value: 1 }))
    },
    {
      code: "recent_reports",
      label: "Recent reports",
      value: recentReports,
      helper: "Report records created in the last 30 days",
      tone: "cyan",
      series: [
        { label: "Reports", value: recentReports },
        { label: "Other", value: Math.max(0, tasks.length - recentReports) }
      ]
    }
  ];
}

function buildBurningTopics(categories) {
  return categories
    .map((category) => {
      const urgentItems = category.tasks.filter((task) => task.urgency_score >= 3).slice(0, 3);
      return {
        category_code: category.code,
        title: category.label,
        surface: category.surface,
        urgent_count: urgentItems.length,
        items: urgentItems,
        next_action_label: urgentItems.length ? "Open the most urgent item" : "No urgent action",
        recommendation: urgentItems.length
          ? "Review the first urgent item, then continue from the governed module workspace."
          : "Keep this category visible; no immediate owner approval is waiting."
      };
    })
    .filter((topic) => topic.urgent_count > 0)
    .slice(0, 3);
}

function buildStatusMix(tasks) {
  const counts = new Map();
  for (const task of tasks) {
    const key = normalizeLower(task.status) || "open";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].map(([status, count]) => ({ status, count }));
}

async function fetchDelegationCandidates(app, tenantId) {
  const r = await app.db.query(
    `
    SELECT id, code, name, agent_type
    FROM eip_core.agent
    WHERE tenant_id=$1
      AND is_active=true
      AND lower(agent_type) IN ('person', 'team', 'org', 'organization')
    ORDER BY COALESCE(name, code, id::text) ASC
    LIMIT 50
    `,
    [tenantId]
  );
  return (r.rows || []).map((row) => ({
    id: row.id,
    label: normalizeText(row.name || row.code || row.id),
    code: row.code,
    agent_type: row.agent_type
  }));
}

export async function buildCommandCenterPayload(app, tenantId, identityId) {
  const actorAgentId = await getPrimaryAgentId(app.db, tenantId, identityId);
  const activeModulesPromise = buildActiveModules(app, tenantId);
  const reportsPromise = app.db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM eip_core.info_record
    WHERE tenant_id=$1
      AND is_active=true
      AND (
        lower(record_type) LIKE '%report%'
        OR lower(COALESCE(title, '')) LIKE '%report%'
        OR lower(COALESCE(payload->>'kind', '')) LIKE '%report%'
      )
      AND created_at >= now() - interval '30 days'
    `,
    [tenantId]
  );
  const tasksPromise = app.db.query(
    `
    SELECT
      t.id,
      t.service_object_id,
      t.process_def_id,
      t.task_type,
      t.status,
      t.title,
      t.description,
      t.assigned_agent_id,
      t.due_at,
      t.payload,
      t.attrs,
      t.created_at,
      t.updated_at,
      so.object_type,
      so.status AS object_status,
      so.code AS object_code,
      so.title AS object_title,
      so.attrs AS object_attrs,
      so.owner_agent_id,
      pd.code AS process_code,
      pd.name AS process_name,
      ag.code AS assigned_agent_code,
      ag.name AS assigned_agent_name
    FROM eip_core.task t
    LEFT JOIN eip_core.service_object so
      ON so.tenant_id = t.tenant_id
     AND so.id = t.service_object_id
    LEFT JOIN eip_core.process_def pd
      ON pd.tenant_id = t.tenant_id
     AND pd.id = t.process_def_id
    LEFT JOIN eip_core.agent ag
      ON ag.tenant_id = t.tenant_id
     AND ag.id = t.assigned_agent_id
    WHERE t.tenant_id=$1
      AND lower(t.status) = ANY($2::text[])
      AND (
        $3::uuid IS NULL
        OR t.assigned_agent_id IS NULL
        OR t.assigned_agent_id=$3::uuid
        OR so.owner_agent_id=$3::uuid
        OR lower(COALESCE(t.attrs->>'visibility', t.payload->>'visibility', '')) = 'tenant'
      )
    ORDER BY
      CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END,
      t.due_at ASC,
      t.updated_at DESC
    LIMIT 100
    `,
    [tenantId, OPEN_TASK_STATUSES, actorAgentId]
  );

  const [activeModules, reportsRes, tasksRes, delegationCandidates] = await Promise.all([
    activeModulesPromise,
    reportsPromise,
    tasksPromise,
    fetchDelegationCandidates(app, tenantId)
  ]);

  const tasks = (tasksRes.rows || []).map(toTaskItem);
  const categories = buildCategoryPayload(tasks, activeModules);
  const dueBuckets = buildDueBuckets(tasks);
  const recentReports = toNumber(reportsRes.rows?.[0]?.total);

  return {
    ok: true,
    generated_at: new Date().toISOString(),
    scope: {
      tenant_id: tenantId,
      actor_agent_id: actorAgentId,
      task_scope: actorAgentId ? "assigned_unassigned_owned_visible" : "tenant_visible"
    },
    tabs: [
      { code: "command", label: "Command Center" },
      { code: "analytics", label: "Analytics" },
      { code: "workload", label: "Workload" }
    ],
    stats: {
      open_tasks: tasks.length,
      high_urgency: tasks.filter((task) => task.urgency_score >= 3).length,
      overdue: dueBuckets.find((bucket) => bucket.code === "overdue")?.count || 0,
      due_today: dueBuckets.find((bucket) => bucket.code === "today")?.count || 0,
      active_modules: activeModules.length,
      recent_reports: recentReports
    },
    widgets: buildWidgets({ tasks, activeModules, recentReports }),
    categories,
    burning_topics: buildBurningTopics(categories),
    analytics: {
      category_load: categories.map((category) => ({
        code: category.code,
        label: category.label,
        count: category.count,
        urgent_count: category.urgent_count
      })),
      due_buckets: dueBuckets,
      status_mix: buildStatusMix(tasks)
    },
    workload: {
      delegation_candidates: delegationCandidates,
      assigned_agent_id: actorAgentId,
      default_category: categories.find((category) => category.count > 0)?.code || categories[0]?.code || "general",
      sort_options: ["urgency", "due_date", "category"],
      urgency_filters: ["all", "critical", "high", "medium", "normal"],
      due_buckets: dueBuckets,
      delegated_count: tasks.filter((task) => task.delegated_at).length,
      my_task_count: tasks.filter((task) => actorAgentId && task.assigned_agent_id === actorAgentId).length,
      scheduled_tasks: tasks
        .filter((task) => task.due_at)
        .sort((a, b) => String(a.due_at || "").localeCompare(String(b.due_at || "")))
        .slice(0, 30)
    }
  };
}

export async function delegateCommandCenterTask(app, { tenantId, identityId, taskId, assignedAgentId }) {
  const targetAgentId = normalizeText(assignedAgentId);
  if (!targetAgentId) {
    return { ok: false, status: 400, error: "ASSIGNEE_REQUIRED" };
  }

  const actorAgentId = await getPrimaryAgentId(app.db, tenantId, identityId);
  if (!actorAgentId) {
    return { ok: false, status: 403, error: "ACTOR_AGENT_REQUIRED" };
  }

  const client = await app.db.connect();
  try {
    await client.query("BEGIN");

    const taskRes = await client.query(
      `
      SELECT id, status, assigned_agent_id, attrs
      FROM eip_core.task
      WHERE tenant_id=$1 AND id=$2
      FOR UPDATE
      `,
      [tenantId, taskId]
    );
    const agentRes = await client.query(
      `
      SELECT id, code, name, agent_type
      FROM eip_core.agent
      WHERE tenant_id=$1
        AND id=$2
        AND is_active=true
      LIMIT 1
      `,
      [tenantId, targetAgentId]
    );

    const task = taskRes.rows[0];
    if (!task) {
      await client.query("ROLLBACK");
      return { ok: false, status: 404, error: "TASK_NOT_FOUND" };
    }
    const target = agentRes.rows[0];
    if (!target) {
      await client.query("ROLLBACK");
      return { ok: false, status: 404, error: "ASSIGNEE_NOT_FOUND" };
    }

    const canDelegateAny = await hasPermission(app, tenantId, identityId, "TASK_DELEGATE")
      || await hasPermission(app, tenantId, identityId, "core.task.write")
      || await hasPermission(app, tenantId, identityId, "CRM_TASK_WRITE")
      || await hasPermission(app, tenantId, identityId, "PROCESS_INSTANCE_WRITE");
    const ownsTask = !task.assigned_agent_id || task.assigned_agent_id === actorAgentId;
    if (!ownsTask && !canDelegateAny) {
      await client.query("ROLLBACK");
      return { ok: false, status: 403, error: "TASK_DELEGATE_FORBIDDEN" };
    }

    const delegation = {
      from_agent_id: task.assigned_agent_id || null,
      to_agent_id: targetAgentId,
      actor_agent_id: actorAgentId,
      delegated_at: new Date().toISOString(),
      source: "command_center"
    };
    const attrs = {
      ...asObject(task.attrs),
      last_delegation: delegation
    };

    const updated = await client.query(
      `
      UPDATE eip_core.task
      SET assigned_agent_id=$3,
          attrs=$4::jsonb,
          updated_at=now()
      WHERE tenant_id=$1 AND id=$2
      RETURNING id, status, assigned_agent_id, updated_at
      `,
      [tenantId, taskId, targetAgentId, JSON.stringify(attrs)]
    );

    await client.query(
      `
      INSERT INTO eip_core.task_status_event
        (tenant_id, task_id, from_status, to_status, reason_code, note, actor_agent_id, attrs)
      VALUES ($1, $2, $3, $3, 'delegated', $4, $5, $6::jsonb)
      `,
      [
        tenantId,
        taskId,
        task.status,
        `Delegated to ${normalizeText(target.name || target.code || target.id)}`,
        actorAgentId,
        JSON.stringify({ delegation, source: "command_center" })
      ]
    );

    await client.query("COMMIT");
    return { ok: true, item: updated.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    app.log.error({ event: "command_center_delegate_error", tenantId, taskId, error: error.message });
    return { ok: false, status: 500, error: "TASK_DELEGATE_FAILED" };
  } finally {
    client.release();
  }
}

export async function scheduleCommandCenterTask(app, { tenantId, identityId, taskId, schedule = {} }) {
  const actorAgentId = await getPrimaryAgentId(app.db, tenantId, identityId);
  if (!actorAgentId) {
    return { ok: false, status: 403, error: "ACTOR_AGENT_REQUIRED" };
  }

  const dueAt = toIsoOrNull(schedule.due_at);
  const plannedStartAt = toIsoOrNull(schedule.planned_start_at);
  const plannedEndAt = toIsoOrNull(schedule.planned_end_at);
  const reminderAt = toIsoOrNull(schedule.reminder_at);
  const priority = normalizeLower(schedule.priority).slice(0, 40) || null;
  const status = normalizeLower(schedule.status).slice(0, 40) || null;

  if (schedule.due_at && !dueAt) return { ok: false, status: 400, error: "INVALID_DUE_AT" };
  if (schedule.planned_start_at && !plannedStartAt) return { ok: false, status: 400, error: "INVALID_PLANNED_START_AT" };
  if (schedule.planned_end_at && !plannedEndAt) return { ok: false, status: 400, error: "INVALID_PLANNED_END_AT" };
  if (schedule.reminder_at && !reminderAt) return { ok: false, status: 400, error: "INVALID_REMINDER_AT" };

  const client = await app.db.connect();
  try {
    await client.query("BEGIN");

    const taskRes = await client.query(
      `
      SELECT id, status, assigned_agent_id, attrs
      FROM eip_core.task
      WHERE tenant_id=$1 AND id=$2
      FOR UPDATE
      `,
      [tenantId, taskId]
    );
    const task = taskRes.rows[0];
    if (!task) {
      await client.query("ROLLBACK");
      return { ok: false, status: 404, error: "TASK_NOT_FOUND" };
    }

    const canScheduleAny = await hasPermission(app, tenantId, identityId, "TASK_SCHEDULE")
      || await hasPermission(app, tenantId, identityId, "core.task.write")
      || await hasPermission(app, tenantId, identityId, "TASK_DELEGATE")
      || await hasPermission(app, tenantId, identityId, "CRM_TASK_WRITE")
      || await hasPermission(app, tenantId, identityId, "PROCESS_INSTANCE_WRITE");
    const ownsTask = !task.assigned_agent_id || task.assigned_agent_id === actorAgentId;
    if (!ownsTask && !canScheduleAny) {
      await client.query("ROLLBACK");
      return { ok: false, status: 403, error: "TASK_SCHEDULE_FORBIDDEN" };
    }

    const scheduling = {
      planned_start_at: plannedStartAt,
      planned_end_at: plannedEndAt,
      reminder_at: reminderAt,
      priority,
      scheduled_by_agent_id: actorAgentId,
      scheduled_at: new Date().toISOString(),
      source: "command_center"
    };
    const attrs = {
      ...asObject(task.attrs),
      ...Object.fromEntries(Object.entries({
        planned_start_at: plannedStartAt,
        planned_end_at: plannedEndAt,
        reminder_at: reminderAt,
        priority
      }).filter(([, value]) => value !== null)),
      last_schedule_update: scheduling
    };

    const updated = await client.query(
      `
      UPDATE eip_core.task
      SET due_at=$3,
          started_at=COALESCE($4, started_at),
          status=COALESCE($5, status),
          attrs=$6::jsonb,
          updated_at=now()
      WHERE tenant_id=$1 AND id=$2
      RETURNING id, status, assigned_agent_id, due_at, started_at, updated_at, attrs
      `,
      [tenantId, taskId, dueAt, plannedStartAt, status, JSON.stringify(attrs)]
    );

    await client.query(
      `
      INSERT INTO eip_core.task_status_event
        (tenant_id, task_id, from_status, to_status, reason_code, note, actor_agent_id, attrs)
      VALUES ($1, $2, $3, COALESCE($4, $3), 'scheduled', $5, $6, $7::jsonb)
      `,
      [
        tenantId,
        taskId,
        task.status,
        status,
        dueAt ? `Scheduled for ${dueAt}` : "Due date cleared",
        actorAgentId,
        JSON.stringify({ scheduling, due_at: dueAt, source: "command_center" })
      ]
    );

    await client.query("COMMIT");
    return { ok: true, item: updated.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    app.log.error({ event: "command_center_schedule_error", tenantId, taskId, error: error.message });
    return { ok: false, status: 500, error: "TASK_SCHEDULE_FAILED" };
  } finally {
    client.release();
  }
}
