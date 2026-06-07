import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, ListChecks, RefreshCw, Search, UserPlus, X } from "lucide-react";
import { apiFetch } from "../../services/apiClient";
import {
  DEFAULT_CONFIG,
  ScheduleTaskModal,
  WorkloadView,
  addDays,
  decorateCategory,
  dueState,
  matchesAssignmentFilter,
  matchesDateFilter,
  mergeConfig,
  resolveCommandTheme,
  toDateInputValue
} from "./UserDashboardPanel";

const VIEW_CONFIG = [
  { code: "my_tasks", label: "My Tasks" },
  { code: "calendar", label: "Calendar" },
  { code: "delegated", label: "Delegated" },
  { code: "overdue", label: "Overdue" },
  { code: "workload", label: "Workload" }
];

const DATE_FILTERS = ["all", "overdue", "today", "tomorrow", "future", "unscheduled"];
const ASSIGNMENT_FILTERS = ["all", "my_tasks", "delegated", "unassigned"];
const URGENCY_FILTERS = ["all", "critical", "high", "medium", "normal"];

function normalizeText(value) {
  return String(value || "").trim();
}

function flattenTasks(categories = []) {
  return categories.flatMap((category) =>
    (category.tasks || []).map((task) => ({
      ...task,
      category_code: category.code,
      category_label: category.display_label,
      category_surface: category.surface
    }))
  );
}

function matchesTaskQuery(task, query) {
  const q = normalizeText(query).toLowerCase();
  if (!q) return true;
  return [
    task.title,
    task.context,
    task.description,
    task.status,
    task.task_type,
    task.category_label
  ].join(" ").toLowerCase().includes(q);
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) =>
    Number(b.urgency_score || 0) - Number(a.urgency_score || 0)
    || String(a.due_at || "9999").localeCompare(String(b.due_at || "9999"))
    || String(b.updated_at || "").localeCompare(String(a.updated_at || ""))
  );
}

function filterTasks(tasks, { view, actorAgentId, query, urgency, dueFilter, assignmentFilter, categoryFilter }) {
  return sortTasks((tasks || []).filter((task) => {
    const due = dueState(task.due_at, task.status);
    if (view === "my_tasks" && actorAgentId && task.assigned_agent_id && task.assigned_agent_id !== actorAgentId) return false;
    if (view === "delegated" && !task.delegated_at) return false;
    if (view === "overdue" && due.code !== "overdue") return false;
    if (!matchesTaskQuery(task, query)) return false;
    if (urgency !== "all" && task.urgency !== urgency) return false;
    if (!matchesDateFilter(task, dueFilter)) return false;
    if (!matchesAssignmentFilter(task, assignmentFilter, actorAgentId)) return false;
    if (categoryFilter !== "all" && task.category_code !== categoryFilter) return false;
    return true;
  }));
}

function EmptyState({ title, detail, actionLabel, onAction, theme }) {
  return (
    <div className={`${theme.empty} min-h-[12rem]`}>
      <p className="text-sm font-semibold text-ink-700">{title}</p>
      <p className="mt-2 text-sm text-ink-500">{detail}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="mt-4 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold text-white">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-ink-100 bg-white px-3 py-2 text-sm normal-case tracking-normal text-ink-800 outline-none"
      >
        {(options || []).map((option) => (
          <option key={option} value={option}>
            {String(option).replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function TaskDetailDrawer({ task, onClose, onOpen, onSchedule, theme }) {
  if (!task) return null;
  const due = dueState(task.due_at, task.status);
  return (
    <div className="fixed inset-0 z-[92] flex justify-end bg-ink-900/30 backdrop-blur-[2px]">
      <aside className="h-full w-full max-w-lg overflow-y-auto border-l border-ink-100 bg-white p-5 shadow-strong">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-400">Task detail</p>
            <h3 className="mt-1 text-xl font-semibold text-ink-900">{task.title}</h3>
            <p className="mt-2 text-sm text-ink-500">{task.context || "No source reference available."}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-ink-100 bg-white p-2 text-ink-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <InfoBlock label="Status" value={task.status || "open"} />
          <InfoBlock label="Priority" value={task.urgency_label || task.urgency || "normal"} />
          <InfoBlock label="Due" value={due.label} />
          <InfoBlock label="Category" value={task.category_label || task.category_code || "General"} />
          <InfoBlock label="Assigned to" value={task.assigned_agent_name || "Unassigned"} />
          <InfoBlock label="Task type" value={task.task_type || "Task"} />
        </div>
        {task.description ? (
          <div className="mt-5 rounded-2xl border border-ink-100 bg-ink-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Description</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">{task.description}</p>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={onOpen} className={theme.primaryAction}>
            Open module
          </button>
          <button type="button" onClick={onSchedule} className="rounded-full border border-brand-100 bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-700">
            Schedule
          </button>
        </div>
      </aside>
    </div>
  );
}

function InfoBlock({ label, value }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-ink-50 px-3 py-3">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ink-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-ink-800">{String(value || "-").replace(/_/g, " ")}</p>
    </div>
  );
}

function TaskListCard({ task, onOpen, onDetails, onSchedule, onDelegate, delegationCandidates, theme }) {
  const due = dueState(task.due_at, task.status);
  const canDelegate = Boolean(task.actions?.some((action) => action.code === "delegate") && delegationCandidates.length);
  const canSchedule = Boolean(task.actions?.some((action) => action.code === "schedule"));
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submitDelegate = async () => {
    setError("");
    if (!assignee) {
      setError("Choose an assignee first.");
      return;
    }
    try {
      setSaving(true);
      await onDelegate(task, assignee);
      setDelegateOpen(false);
      setAssignee("");
    } catch {
      setError("Delegation failed. Check task permissions and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold ${due.className}`}>
              {due.label}
            </span>
            <span className="rounded-full border border-ink-100 bg-ink-50 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-500">
              {task.urgency_label || task.urgency || "normal"}
            </span>
          </div>
          <h4 className="mt-3 text-base font-semibold text-ink-900">{task.title}</h4>
          <p className="mt-1 text-sm text-ink-500">{task.context || task.category_label || "No source reference available."}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
            {task.category_label || task.category_code || "General"} {task.assigned_agent_name ? `- ${task.assigned_agent_name}` : "- unassigned"}
          </p>
        </div>
        <button type="button" onClick={onDetails} className="rounded-full border border-ink-100 bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-600">
          Detail
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onOpen} className={theme.primaryAction}>
          Open
        </button>
        <button
          type="button"
          onClick={canSchedule ? onSchedule : undefined}
          disabled={!canSchedule}
          className="inline-flex items-center gap-1 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          title={canSchedule ? "Reschedule task" : "Scheduling unavailable for this task"}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Schedule
        </button>
        <button
          type="button"
          onClick={canDelegate ? () => setDelegateOpen((current) => !current) : undefined}
          disabled={!canDelegate}
          className="inline-flex items-center gap-1 rounded-full border border-ink-100 bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-600 disabled:cursor-not-allowed disabled:opacity-50"
          title={canDelegate ? "Delegate task" : "Delegation unavailable: assignee source not configured."}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Delegate
        </button>
      </div>
      {delegateOpen ? (
        <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/70 p-3">
          <Select label="Assignee" value={assignee} onChange={setAssignee} options={["", ...delegationCandidates.map((candidate) => candidate.id)]} />
          <div className="mt-2 text-xs text-ink-500">
            {delegationCandidates.find((candidate) => candidate.id === assignee)?.label || "Choose an active person or team."}
          </div>
          {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setDelegateOpen(false)} className="rounded-full border border-ink-100 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500">Cancel</button>
            <button type="button" onClick={submitDelegate} disabled={saving} className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
              {saving ? "Saving..." : "Confirm"}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function UserTasksPanel({ node, ctx }) {
  const config = useMemo(() => mergeConfig({ ...DEFAULT_CONFIG, ...(node?.props || {}) }), [node]);
  const theme = useMemo(() => resolveCommandTheme(config.theme), [config.theme]);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState(config.defaultView || "my_tasks");
  const [query, setQuery] = useState("");
  const [urgency, setUrgency] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [schedulingTask, setSchedulingTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [workloadDateFocus, setWorkloadDateFocus] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch(config.endpoint || DEFAULT_CONFIG.endpoint);
      setPayload(result);
    } catch {
      setError("Unable to load live tasks.");
    } finally {
      setLoading(false);
    }
  }, [config.endpoint]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    apiFetch(config.endpoint || DEFAULT_CONFIG.endpoint)
      .then((result) => {
        if (active) setPayload(result);
      })
      .catch(() => {
        if (active) setError("Unable to load live tasks.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [config.endpoint]);

  const categories = useMemo(
    () => (payload?.categories || []).map((category) => decorateCategory(category, config)),
    [config, payload]
  );
  const tasks = useMemo(() => flattenTasks(categories), [categories]);
  const actorAgentId = payload?.workload?.assigned_agent_id || "";
  const delegationCandidates = payload?.workload?.delegation_candidates || [];
  const visibleTasks = useMemo(
    () => filterTasks(tasks, { view: activeView, actorAgentId, query, urgency, dueFilter, assignmentFilter, categoryFilter }),
    [activeView, actorAgentId, assignmentFilter, categoryFilter, dueFilter, query, tasks, urgency]
  );

  const counts = useMemo(() => ({
    total: tasks.length,
    my: tasks.filter((task) => actorAgentId && (!task.assigned_agent_id || task.assigned_agent_id === actorAgentId)).length,
    overdue: tasks.filter((task) => dueState(task.due_at, task.status).code === "overdue").length,
    today: tasks.filter((task) => dueState(task.due_at, task.status).code === "today").length,
    delegated: tasks.filter((task) => task.delegated_at).length,
    unscheduled: tasks.filter((task) => !task.due_at).length
  }), [actorAgentId, tasks]);

  const handleAction = useCallback((task, action) => {
    const allowedSurfaces = new Set(["crm", "commerce", "inventory", "procurement", "content", "reports", "tasks"]);
    const targetSurface = action?.surface || task?.surface || task?.category_surface || task?.category_code;
    if ((action?.kind === "navigate" || !action?.kind) && allowedSurfaces.has(targetSurface)) {
      ctx?.user?.setActiveTab?.(targetSurface);
    }
  }, [ctx]);

  const handleOpen = useCallback((task) => {
    const action = task?.actions?.find((item) => item.code === "open") || task?.actions?.[0];
    handleAction(task, action);
  }, [handleAction]);

  const handleDelegate = useCallback(async (task, assignedAgentId) => {
    const endpoint = task?.actions?.find((action) => action.code === "delegate")?.endpoint;
    if (!endpoint || !assignedAgentId) return;
    await apiFetch(endpoint, { method: "POST", body: { assigned_agent_id: assignedAgentId } });
    await loadTasks();
  }, [loadTasks]);

  const handleSchedule = useCallback(async (task, schedule) => {
    const endpoint = task?.actions?.find((action) => action.code === "schedule")?.endpoint;
    if (!endpoint) return;
    await apiFetch(endpoint, { method: "POST", body: schedule });
    setSchedulingTask(null);
    await loadTasks();
  }, [loadTasks]);

  return (
    <section className={`${theme.surface} space-y-4`}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">Tasks module</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink-900">{config.title || "Tasks"}</h2>
          <p className="mt-2 max-w-3xl text-sm font-medium text-ink-500">
            {config.subtitle || "Full task management, scheduling, delegation, and workload from real task engine records."}
          </p>
        </div>
        <button type="button" onClick={loadTasks} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-ink-100 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-500 shadow-soft disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-5">
        <Metric label="Open tasks" value={counts.total} icon={ListChecks} />
        <Metric label="My tasks" value={counts.my} />
        <Metric label="Overdue" value={counts.overdue} tone="rose" />
        <Metric label="Due today" value={counts.today} tone="amber" />
        <Metric label="Unscheduled" value={counts.unscheduled} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(config.views || VIEW_CONFIG).map((view) => (
          <button
            key={view.code}
            type="button"
            onClick={() => setActiveView(view.code)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeView === view.code ? "bg-ink-900 text-white shadow-soft" : "border border-ink-100 bg-white text-ink-500 hover:text-ink-900"}`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {activeView === "calendar" || activeView === "workload" ? (
        <WorkloadView
          loading={loading}
          labels={{ ...config.labels, workload: activeView === "calendar" ? "Calendar" : "Workload" }}
          categories={categories}
          theme={theme}
          tasks={tasks}
          actorAgentId={actorAgentId}
          onAction={handleAction}
          onSchedule={setSchedulingTask}
          focusedDate={workloadDateFocus}
          onFocusDate={setWorkloadDateFocus}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className={theme.panelCompact}>
            <div className="mb-3 grid gap-3 md:grid-cols-[minmax(14rem,1.3fr)_repeat(4,minmax(8rem,0.7fr))]">
              <label className="flex min-w-0 items-center gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2">
                <Search className="h-4 w-4 text-ink-300" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search task, source, status" className="w-full bg-transparent text-sm text-ink-800 outline-none placeholder:text-ink-300" />
              </label>
              <Select label="Urgency" value={urgency} onChange={setUrgency} options={URGENCY_FILTERS} />
              <Select label="Due" value={dueFilter} onChange={setDueFilter} options={DATE_FILTERS} />
              <Select label="Assignment" value={assignmentFilter} onChange={setAssignmentFilter} options={ASSIGNMENT_FILTERS} />
              <Select label="Category" value={categoryFilter} onChange={setCategoryFilter} options={["all", ...categories.map((category) => category.code)]} />
            </div>
            <div className="max-h-[calc(100vh-23rem)] min-h-[26rem] space-y-3 overflow-y-auto overscroll-contain pr-2">
              {visibleTasks.length ? visibleTasks.map((task) => (
                <TaskListCard
                  key={task.id}
                  task={task}
                  onOpen={() => handleOpen(task)}
                  onDetails={() => setDetailTask(task)}
                  onSchedule={() => setSchedulingTask(task)}
                  onDelegate={handleDelegate}
                  delegationCandidates={delegationCandidates}
                  theme={theme}
                />
              )) : (
                <EmptyState
                  title={loading ? "Loading tasks..." : "No tasks found."}
                  detail={loading ? "Reading live task engine records." : "No matching task records exist for this view and filter set."}
                  actionLabel={!loading ? "Clear filters" : ""}
                  onAction={!loading ? () => {
                    setQuery("");
                    setUrgency("all");
                    setDueFilter("all");
                    setAssignmentFilter("all");
                    setCategoryFilter("all");
                  } : null}
                  theme={theme}
                />
              )}
            </div>
          </div>
          <aside className="space-y-3">
            <div className={theme.panelCompact}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">Due windows</p>
              <DueLine label="Overdue" value={counts.overdue} tone="rose" />
              <DueLine label="Today" value={counts.today} tone="amber" />
              <DueLine label="Tomorrow" value={tasks.filter((task) => dueState(task.due_at, task.status).code === "tomorrow").length} tone="cyan" />
              <DueLine label="Unscheduled" value={counts.unscheduled} />
            </div>
            <div className={theme.panelCompact}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">Delegation</p>
              <p className="mt-2 text-sm text-ink-600">
                {delegationCandidates.length
                  ? `${delegationCandidates.length} active assignee options available.`
                  : "Delegation unavailable: assignee source not configured."}
              </p>
            </div>
          </aside>
        </div>
      )}

      <TaskDetailDrawer
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onOpen={() => {
          handleOpen(detailTask);
          setDetailTask(null);
        }}
        onSchedule={() => {
          setSchedulingTask(detailTask);
          setDetailTask(null);
        }}
        theme={theme}
      />
      <ScheduleTaskModal task={schedulingTask} labels={config.labels || DEFAULT_CONFIG.labels} onClose={() => setSchedulingTask(null)} onSubmit={handleSchedule} theme={theme} />
    </section>
  );
}

function Metric({ label, value, tone, icon: Icon }) {
  const color = tone === "rose" ? "text-rose-600" : tone === "amber" ? "text-amber-600" : "text-ink-900";
  return (
    <div className="rounded-2xl border border-ink-100 bg-white px-4 py-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-brand-500" /> : null}
      </div>
      <p className={`mt-2 text-3xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function DueLine({ label, value, tone }) {
  const color = tone === "rose" ? "bg-rose-500" : tone === "amber" ? "bg-amber-500" : tone === "cyan" ? "bg-cyan-500" : "bg-ink-300";
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white px-3 py-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-ink-700">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        {label}
      </span>
      <span className="text-sm font-semibold text-ink-500">{value}</span>
    </div>
  );
}
