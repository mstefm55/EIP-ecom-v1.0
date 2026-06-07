import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Clock3,
  LayoutGrid,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserPlus,
  X
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const DATE_FILTERS = ["all", "overdue", "today", "tomorrow", "future", "unscheduled"];
const ASSIGNMENT_FILTERS = ["all", "my_tasks", "delegated", "unassigned"];

export const DEFAULT_CONFIG = {
  endpoint: "/api/eip/user/dashboard/command-center",
  title: "Run the business, not the system",
  subtitle:
    "Live business signals, urgent topics, and actionables from existing task and module data.",
  tabs: [
    { code: "command", label: "Command Center" },
    { code: "analytics", label: "Analytics" }
  ],
  widgets: [
    { code: "open_work", label: "Open work" },
    { code: "high_urgency", label: "High urgency" },
    { code: "due_today", label: "Due today" },
    { code: "active_modules", label: "Active modules" },
    { code: "recent_reports", label: "Recent reports" }
  ],
  labels: {
    refresh: "Refresh",
    businessStats: "Business statistics",
    businessStatsHint: "Live task, module, report, and operational signals",
    openDetail: "Open detail",
    burningTopics: "Burning topics",
    burningHint: "Top urgent items only. User pins 2-3 categories from the Task Browser.",
    burningEmpty: "No urgent item is waiting in the pinned categories.",
    taskBrowser: "Task Browser",
    taskBrowserHint: "All user actionables - categories are metadata-driven",
    taskSearch: "Search actionables...",
    signalSearch: "Search signal, customer, order, material...",
    actionables: "Actionables",
    controls: "Filters, delegation rules and category pinning",
    analytics: "Signal analytics",
    workload: "Workload",
    delegate: "Delegate",
    assign: "Assign",
    cancel: "Cancel",
    confirm: "Confirm",
    noTasks: "No open tasks in this category.",
    search: "Search tasks",
    urgency: "Urgency",
    sort: "Sort",
    pinned: "Pinned"
  },
  categoryPresentation: {
    crm: { label: "Customer queries", badge: "CRM / INTAKE", tone: "blue" },
    commerce: { label: "Orders to deliver", badge: "ORDER FLOW", tone: "red" },
    inventory: { label: "Stock risks", badge: "INVENTORY", tone: "gold" },
    procurement: { label: "RFQ / Suppliers", badge: "PROCUREMENT", tone: "violet" },
    content: { label: "Content & catalog", badge: "STORE", tone: "green" },
    reports: { label: "Reports & review", badge: "REPORTING", tone: "slate" },
    general: { label: "General work", badge: "TASKS", tone: "slate" }
  },
  taskBrowser: {
    defaultOpen: "crm",
    urgencyFilters: ["all", "critical", "high", "medium", "normal"],
    dueDateFilters: DATE_FILTERS,
    assignmentFilters: ASSIGNMENT_FILTERS,
    sortOptions: ["urgency", "due_date", "category", "created_date"]
  },
  theme: {
    variant: "eip_v1",
    density: "comfortable"
  }
};

const COMMAND_CENTER_THEMES = {
  eip_v1: {
    surface: "min-h-[calc(100vh-8rem)] rounded-[2rem] border border-white/75 bg-white/92 px-5 py-5 shadow-soft",
    panel: "rounded-[1.75rem] border border-ink-100 bg-white px-6 py-6 shadow-soft",
    panelCompact: "rounded-[1.75rem] border border-ink-100 bg-white px-6 py-5 shadow-soft",
    card: "rounded-2xl border border-ink-100 bg-ink-50/70",
    cardRaised: "rounded-2xl border border-white/70 bg-white/80 shadow-soft",
    taskRail: "glass-panel px-4 py-4 xl:fixed xl:right-5 xl:top-[6.75rem] xl:z-30 xl:h-[calc(100vh-7.5rem)] xl:w-[min(24vw,26rem)] xl:overflow-y-auto xl:overscroll-contain",
    heading: "text-ink-900",
    muted: "text-ink-400",
    body: "text-ink-700",
    primaryAction: "rounded-full bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white shadow-soft",
    secondaryAction: "rounded-full border border-ink-100 bg-white text-brand-600 shadow-soft",
    tabActive: "border-brand-500 text-brand-600",
    tabIdle: "border-transparent text-ink-400 hover:text-ink-700",
    search: "border border-ink-100 bg-ink-50/80 text-ink-400",
    input: "text-ink-700 placeholder:text-ink-300",
    empty: "rounded-2xl border border-dashed border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-400"
  },
  light_glass_ready: {
    surface: "min-h-[calc(100vh-8rem)] rounded-[2rem] border border-white/80 bg-white/95 px-5 py-5 shadow-soft",
    panel: "rounded-[1.75rem] border border-slate-200/80 bg-white/95 px-6 py-6 shadow-soft",
    panelCompact: "rounded-[1.75rem] border border-slate-200/80 bg-white/95 px-6 py-5 shadow-soft",
    card: "rounded-2xl border border-slate-200 bg-white/90",
    cardRaised: "rounded-2xl border border-white/80 bg-white/90 shadow-soft",
    taskRail: "glass-panel px-4 py-4 xl:fixed xl:right-5 xl:top-[6.75rem] xl:z-30 xl:h-[calc(100vh-7.5rem)] xl:w-[min(24vw,26rem)] xl:overflow-y-auto xl:overscroll-contain",
    heading: "text-ink-900",
    muted: "text-ink-400",
    body: "text-ink-700",
    primaryAction: "rounded-full bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white shadow-soft",
    secondaryAction: "rounded-full border border-slate-200 bg-white text-brand-600 shadow-soft",
    tabActive: "border-brand-500 text-brand-600",
    tabIdle: "border-transparent text-ink-400 hover:text-ink-700",
    search: "border border-slate-200 bg-white/85 text-ink-400",
    input: "text-ink-700 placeholder:text-ink-300",
    empty: "rounded-2xl border border-dashed border-slate-200 bg-white/75 px-4 py-6 text-sm text-ink-400"
  }
};

const TONE = {
  blue: {
    accent: "text-brand-600",
    border: "border-brand-500",
    softBorder: "border-brand-200",
    bg: "bg-brand-50",
    dot: "bg-brand-500",
    badge: "bg-brand-600 text-white",
    active: "bg-ink-900 text-white"
  },
  red: {
    accent: "text-rose-600",
    border: "border-rose-500",
    softBorder: "border-rose-200",
    bg: "bg-rose-50",
    dot: "bg-rose-500",
    badge: "bg-rose-500 text-white",
    active: "bg-ink-900 text-white"
  },
  gold: {
    accent: "text-amber-600",
    border: "border-amber-500",
    softBorder: "border-amber-200",
    bg: "bg-amber-50",
    dot: "bg-amber-500",
    badge: "bg-amber-500 text-white",
    active: "bg-ink-900 text-white"
  },
  violet: {
    accent: "text-violet-600",
    border: "border-violet-500",
    softBorder: "border-violet-200",
    bg: "bg-violet-50",
    dot: "bg-violet-500",
    badge: "bg-violet-500 text-white",
    active: "bg-ink-900 text-white"
  },
  green: {
    accent: "text-emerald-600",
    border: "border-emerald-500",
    softBorder: "border-emerald-200",
    bg: "bg-emerald-50",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500 text-white",
    active: "bg-ink-900 text-white"
  },
  slate: {
    accent: "text-ink-500",
    border: "border-ink-300",
    softBorder: "border-ink-100",
    bg: "bg-ink-50",
    dot: "bg-ink-400",
    badge: "bg-ink-500 text-white",
    active: "bg-ink-900 text-white"
  }
};

const URGENCY_CLASSES = {
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  medium: "border-cyan-200 bg-cyan-50 text-cyan-700",
  normal: "border-ink-100 bg-white text-ink-500"
};

export function mergeConfig(props = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...props,
    labels: { ...DEFAULT_CONFIG.labels, ...(props.labels || {}) },
    taskBrowser: { ...DEFAULT_CONFIG.taskBrowser, ...(props.taskBrowser || {}) },
    theme: { ...DEFAULT_CONFIG.theme, ...(props.theme || {}) },
    categoryPresentation: {
      ...DEFAULT_CONFIG.categoryPresentation,
      ...(props.categoryPresentation || {})
    }
  };
}

export function resolveCommandTheme(theme = {}) {
  const base = COMMAND_CENTER_THEMES[theme.variant] || COMMAND_CENTER_THEMES.eip_v1;
  return { ...base, ...(theme.classes || {}) };
}

function normalizeText(value) {
  return String(value || "").trim();
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return normalizeText(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const text = normalizeText(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalDateKey(value = new Date()) {
  const date = parseLocalDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDateInputValue(value) {
  return formatLocalDateKey(value);
}

export function startOfLocalDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(value, days) {
  const date = startOfLocalDay(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function addMonths(value, months) {
  const date = startOfLocalDay(value);
  date.setMonth(date.getMonth() + months);
  return date;
}

function startOfCalendarWeek(value = new Date()) {
  const date = startOfLocalDay(value);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return date;
}

function startOfCalendarMonth(value = new Date()) {
  const date = startOfLocalDay(value);
  date.setDate(1);
  return date;
}

export function calendarRange(view, anchorDate) {
  const anchor = parseLocalDate(anchorDate) || new Date();
  if (view === "day") return [startOfLocalDay(anchor)];
  if (view === "month") {
    const monthStart = startOfCalendarMonth(anchor);
    const gridStart = startOfCalendarWeek(monthStart);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }
  const weekStart = startOfCalendarWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function dueState(value, status) {
  const normalizedStatus = normalizeText(status).toLowerCase();
  if (["done", "closed", "completed", "cancelled"].includes(normalizedStatus)) {
    return { code: "complete", label: "Complete", className: "border-ink-100 bg-ink-50 text-ink-400" };
  }
  if (!value) return { code: "unscheduled", label: "No due date", className: "border-ink-100 bg-white text-ink-400" };
  const due = parseLocalDate(value);
  if (!due) return { code: "unscheduled", label: "No due date", className: "border-ink-100 bg-white text-ink-400" };
  const today = startOfLocalDay();
  const tomorrow = addDays(today, 1);
  const nextDay = addDays(today, 2);
  if (due < today) return { code: "overdue", label: "Overdue", className: "border-rose-200 bg-rose-50 text-rose-700" };
  if (due >= today && due < tomorrow) return { code: "today", label: "Due today", className: "border-amber-200 bg-amber-50 text-amber-700" };
  if (due >= tomorrow && due < nextDay) return { code: "tomorrow", label: "Due tomorrow", className: "border-cyan-200 bg-cyan-50 text-cyan-700" };
  return { code: "future", label: formatDate(value), className: "border-ink-100 bg-white text-ink-500" };
}

export function matchesDateFilter(task, filter) {
  if (!filter || filter === "all") return true;
  return dueState(task.due_at, task.status).code === filter;
}

export function matchesAssignmentFilter(task, filter, actorAgentId) {
  if (!filter || filter === "all") return true;
  if (filter === "my_tasks") return Boolean(actorAgentId && task.assigned_agent_id === actorAgentId);
  if (filter === "delegated") return Boolean(task.delegated_at);
  if (filter === "unassigned") return !task.assigned_agent_id;
  return true;
}

function percentOf(value, total) {
  if (!total) return 0;
  return Math.max(5, Math.min(100, Math.round((Number(value || 0) / total) * 100)));
}

export function decorateCategory(category, config) {
  const presentation = config.categoryPresentation?.[category.code] || {};
  const tone = TONE[presentation.tone] || TONE.slate;
  return {
    ...category,
    display_label: presentation.label || category.label,
    badge: presentation.badge || String(category.code || "TASKS").toUpperCase(),
    tone_name: presentation.tone || "slate",
    tone
  };
}

function makeSparkValues(series) {
  const values = Array.isArray(series) && series.length
    ? series.map((item) => Number(item.value || item.count || 0))
    : [];
  if (!values.length) return [];
  if (values.length >= 5) return values;

  if (values.length === 1) {
    const value = Math.max(values[0], 1);
    return [value * 0.2, value * 0.45, value * 0.35, value * 0.8, value, value * 0.7, value * 0.9];
  }

  const expanded = [];
  for (let i = 0; i < values.length - 1; i += 1) {
    const from = values[i];
    const to = values[i + 1];
    expanded.push(from, from * 0.72 + to * 0.28, from * 0.38 + to * 0.62);
  }
  expanded.push(values[values.length - 1]);
  while (expanded.length < 7) {
    const last = expanded[expanded.length - 1] || 1;
    expanded.push(last * (expanded.length % 2 ? 0.86 : 1.08));
  }
  return expanded;
}

function makeSparklinePoints(series) {
  const values = makeSparkValues(series);
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  return values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
    const y = 46 - ((value - min) / range) * 38;
    return `${x},${y}`;
  }).join(" ");
}

function makeSparkAreaPoints(series) {
  const points = makeSparklinePoints(series);
  if (!points) return "";
  return `0,50 ${points} 100,50`;
}

function lastSparkPoint(series) {
  const points = makeSparklinePoints(series).split(" ");
  if (!points[0]) return { x: 100, y: 46 };
  const last = points[points.length - 1] || "100,46";
  const [x, y] = last.split(",").map(Number);
  return { x: Number.isFinite(x) ? x : 100, y: Number.isFinite(y) ? y : 46 };
}

export default function UserDashboardPanel({ node, ctx }) {
  const config = useMemo(() => mergeConfig(node?.props || {}), [node]);
  const theme = useMemo(() => resolveCommandTheme(config.theme), [config.theme]);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("command");
  const [openCategory, setOpenCategory] = useState(config.taskBrowser.defaultOpen || "");
  const [pinnedCategories, setPinnedCategories] = useState([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const [taskBrowserCollapsed, setTaskBrowserCollapsed] = useState(false);
  const [schedulingTask, setSchedulingTask] = useState(null);

  const loadCommandCenter = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch(config.endpoint);
      setPayload(result);
      const categories = Array.isArray(result?.categories) ? result.categories : [];
      const defaultCategory = result?.workload?.default_category || categories.find((item) => item.count > 0)?.code || categories[0]?.code || "";
      setOpenCategory((current) => current || defaultCategory);
      setPinnedCategories((current) => {
        if (current.length) return current;
        return categories.filter((item) => item.pinned).map((item) => item.code).slice(0, 3);
      });
    } catch {
      setError("Unable to load the live Command Center.");
    } finally {
      setLoading(false);
    }
  }, [config.endpoint]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await apiFetch(config.endpoint);
        if (!active) return;
        setPayload(result);
        const categories = Array.isArray(result?.categories) ? result.categories : [];
        const defaultCategory = result?.workload?.default_category || categories.find((item) => item.count > 0)?.code || categories[0]?.code || "";
        setOpenCategory(defaultCategory);
        setPinnedCategories(categories.filter((item) => item.pinned).map((item) => item.code).slice(0, 3));
      } catch {
        if (active) setError("Unable to load the live Command Center.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [config.endpoint]);

  const decoratedCategories = useMemo(
    () => (payload?.categories || []).map((category) => decorateCategory(category, config)),
    [config, payload]
  );

  const widgets = useMemo(() => {
    const byCode = new Map((payload?.widgets || []).map((widget) => [widget.code, widget]));
    return (config.widgets || DEFAULT_CONFIG.widgets)
      .map((descriptor) => ({ ...descriptor, ...(byCode.get(descriptor.code) || {}) }))
      .slice(0, 5);
  }, [config.widgets, payload]);

  const burningTopics = useMemo(() => {
    const pinned = new Set(pinnedCategories);
    return decoratedCategories
      .filter((category) => pinned.has(category.code))
      .map((category) => ({
        ...category,
        urgentTasks: (category.tasks || [])
          .filter((task) => Number(task.urgency_score || 0) >= 3)
          .slice(0, 3)
      }))
      .filter((category) => category.urgentTasks.length)
      .slice(0, 3);
  }, [decoratedCategories, pinnedCategories]);

  const allTasks = useMemo(
    () => decoratedCategories.flatMap((category) =>
      (category.tasks || []).map((task) => ({
        ...task,
        category_code: category.code,
        category_label: category.display_label,
        category_surface: category.surface
      }))
    ),
    [decoratedCategories]
  );
  const handleAction = useCallback((task, action) => {
    const allowedSurfaces = new Set(["crm", "commerce", "inventory", "procurement", "content", "reports", "tasks"]);
    const targetSurface = action?.surface || task?.surface || task?.category_surface || task?.category_code;
    if ((action?.kind === "navigate" || !action?.kind) && allowedSurfaces.has(targetSurface)) {
      ctx?.user?.setActiveTab?.(targetSurface);
      return;
    }
  }, [ctx]);

  const handleDelegate = useCallback(async (task, assignedAgentId) => {
    const endpoint = task?.actions?.find((action) => action.code === "delegate")?.endpoint;
    if (!endpoint || !assignedAgentId) return;
    await apiFetch(endpoint, { method: "POST", body: { assigned_agent_id: assignedAgentId } });
    await loadCommandCenter();
  }, [loadCommandCenter]);

  const handleSchedule = useCallback(async (task, schedule) => {
    const endpoint = task?.actions?.find((action) => action.code === "schedule")?.endpoint;
    if (!endpoint) return;
    await apiFetch(endpoint, { method: "POST", body: schedule });
    setSchedulingTask(null);
    await loadCommandCenter();
  }, [loadCommandCenter]);

  const handleWidgetDetail = useCallback((widget) => {
    if (widget?.code === "recent_reports") {
      ctx?.user?.setActiveTab?.("reports");
      return;
    }
    if (widget?.code === "active_modules") {
      setActiveTab("analytics");
      return;
    }
    setActiveTab("workload");
  }, [ctx]);

  return (
    <section className={`command-center-surface ${theme.surface}`}>
      <div className={`grid gap-2 transition-[grid-template-columns] duration-300 ease-out ${
        taskBrowserCollapsed ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_minmax(330px,24vw)]"
      }`}>
        <main className="min-w-0 space-y-3">
          <CommandHeader
            config={config}
            theme={theme}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            globalSearch={globalSearch}
            setGlobalSearch={setGlobalSearch}
            loading={loading}
            loadCommandCenter={loadCommandCenter}
          />

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {activeTab === "command" ? (
            <CommandView
              loading={loading}
              theme={theme}
              widgets={widgets}
              payload={payload}
              labels={config.labels}
              burningTopics={burningTopics}
              pinnedCategories={pinnedCategories}
              setPinnedCategories={setPinnedCategories}
              decoratedCategories={decoratedCategories}
              onWidgetDetail={handleWidgetDetail}
              onOpenSurface={(surface) => ctx?.user?.setActiveTab?.(surface)}
            />
          ) : null}
          {activeTab === "analytics" ? (
            <AnalyticsView loading={loading} payload={payload} labels={config.labels} theme={theme} />
          ) : null}
        </main>

        <TaskBrowser
          loading={loading}
          labels={config.labels}
          taskBrowser={config.taskBrowser}
          actorAgentId={payload?.workload?.assigned_agent_id}
          categories={decoratedCategories}
          openCategory={openCategory}
          setOpenCategory={setOpenCategory}
          pinnedCategories={pinnedCategories}
          setPinnedCategories={setPinnedCategories}
          delegationCandidates={payload?.workload?.delegation_candidates || []}
          onAction={handleAction}
          onDelegate={handleDelegate}
          onSchedule={(task) => setSchedulingTask(task)}
          globalSearch={globalSearch}
          dateFocus=""
          onClearDateFocus={() => {}}
          collapsed={taskBrowserCollapsed}
          setCollapsed={setTaskBrowserCollapsed}
          theme={theme}
        />
      </div>
      <p className={`mt-2 text-xs font-semibold ${theme.muted}`}>
        UI rule: Dashboard is the compact business cockpit. Open Tasks for full scheduling, delegation, and workload management.
      </p>
      <ScheduleTaskModal
        task={schedulingTask}
        labels={config.labels}
        onClose={() => setSchedulingTask(null)}
        onSubmit={handleSchedule}
        theme={theme}
      />
    </section>
  );
}

function CommandHeader({ config, theme, activeTab, setActiveTab, globalSearch, setGlobalSearch, loading, loadCommandCenter }) {
  return (
    <header className="space-y-7">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)_auto]">
        <nav className="flex flex-wrap items-center gap-6">
          {(config.tabs || DEFAULT_CONFIG.tabs).map((tab) => (
            <button
              key={tab.code}
              type="button"
              onClick={() => setActiveTab(tab.code)}
              className={`border-b-4 pb-3 text-base font-semibold transition ${
                activeTab === tab.code
                  ? theme.tabActive
                  : theme.tabIdle
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <label className={`flex h-14 items-center gap-3 rounded-[1.35rem] px-5 text-sm ${theme.search}`}>
          <Search className="h-4 w-4" />
          <input
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
            placeholder={config.labels.signalSearch}
            className={`w-full bg-transparent text-sm outline-none ${theme.input}`}
          />
        </label>
        <button
          type="button"
          onClick={loadCommandCenter}
          disabled={loading}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-ink-100 bg-white px-4 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400 shadow-soft transition hover:text-ink-900 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {config.labels.refresh}
        </button>
      </div>
      <div>
        <h2 className={`text-3xl font-semibold leading-tight tracking-normal xl:text-4xl ${theme.heading}`}>
          {config.title}
        </h2>
        <p className={`mt-2 max-w-5xl text-sm font-medium xl:text-base ${theme.muted}`}>{config.subtitle}</p>
      </div>
    </header>
  );
}

function CommandView({
  loading,
  theme,
  widgets,
  payload,
  labels,
  burningTopics,
  pinnedCategories,
  setPinnedCategories,
  decoratedCategories,
  onWidgetDetail,
  onOpenSurface
}) {
  return (
    <>
      <section className={theme.panel}>
        <div className="mb-5">
          <h3 className={`text-2xl font-semibold ${theme.heading}`}>{labels.businessStats}</h3>
          <p className={`text-sm font-semibold ${theme.muted}`}>{labels.businessStatsHint}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {widgets.map((widget) => (
            <StatTile key={widget.code} widget={widget} loading={loading} labels={labels} onOpenDetail={onWidgetDetail} theme={theme} />
          ))}
        </div>
      </section>

      <section className={theme.panel}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className={`text-2xl font-semibold ${theme.heading}`}>{labels.burningTopics}</h3>
            <p className={`text-sm font-semibold ${theme.muted}`}>{labels.burningHint}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {decoratedCategories
              .map((category) => (
                <button
                  key={category.code}
                  type="button"
                  onClick={() => setPinnedCategories((current) => {
                    if (current.includes(category.code)) return current.filter((item) => item !== category.code);
                    return [...current, category.code].slice(-3);
                  })}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                    pinnedCategories.includes(category.code)
                      ? `${category.tone.softBorder} ${category.tone.bg} ${category.tone.accent} ring-2 ring-white`
                      : "border-ink-100 bg-white text-ink-400"
                  }`}
                >
                  {category.display_label}
                </button>
              ))}
          </div>
        </div>
        {burningTopics.length ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {burningTopics.map((topic) => (
              <BurningPanel key={topic.code} topic={topic} labels={labels} onOpenSurface={onOpenSurface} theme={theme} />
            ))}
          </div>
        ) : (
          <p className={theme.empty}>
            {labels.burningEmpty}
          </p>
        )}
      </section>
    </>
  );
}

function StatTile({ widget, loading, labels, onOpenDetail, theme }) {
  const series = Array.isArray(widget.series) ? widget.series : [];
  const hasSeries = series.some((item) => Number(item?.value || item?.count || 0) > 0);
  const sparkId = `spark-${String(widget.code || "card").replace(/[^a-z0-9_-]/gi, "-")}`;
  const sparkTone = widget.tone === "rose"
    ? { line: "stroke-rose-500", text: "text-rose-500", fill: "fill-rose-500", color: "#f43f5e" }
    : widget.tone === "amber"
      ? { line: "stroke-amber-500", text: "text-amber-500", fill: "fill-amber-500", color: "#f59e0b" }
      : { line: "stroke-brand-600", text: "text-brand-600", fill: "fill-brand-600", color: "#2563eb" };
  const point = lastSparkPoint(series);
  return (
    <article className={`flex h-full flex-col px-4 py-4 ${theme.card}`}>
      <p className={`text-sm font-semibold ${theme.muted}`}>{widget.label}</p>
      <p className={`mt-2 text-3xl font-semibold ${theme.heading}`}>{loading ? "..." : widget.value ?? 0}</p>
      <p className={`mt-2 min-h-[4.5rem] text-sm font-semibold leading-relaxed ${widget.tone === "rose" ? "text-rose-500" : widget.tone === "amber" ? "text-amber-500" : "text-brand-500"}`}>
        {widget.helper || "live signal"}
      </p>
      <div className="mt-auto">
        {hasSeries ? (
        <svg viewBox="0 0 100 56" className="h-20 w-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={sparkId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={sparkTone.color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={sparkTone.color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d="M0 48 C25 45, 75 45, 100 48" className="stroke-ink-200" fill="none" strokeWidth="2" />
          <polygon points={makeSparkAreaPoints(series)} fill={`url(#${sparkId})`} className={sparkTone.text} />
          <polyline points={makeSparklinePoints(series)} fill="none" className={sparkTone.line} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={point.x} cy={point.y} r="3.5" className={`${sparkTone.fill} stroke-white`} strokeWidth="2" />
        </svg>
        ) : (
          <div className="flex h-20 items-center rounded-2xl border border-dashed border-ink-200 bg-white/70 px-3 text-xs font-semibold text-ink-400">
            No trend data available yet.
          </div>
        )}
        <button
          type="button"
          onClick={() => onOpenDetail?.(widget)}
          className={`mt-2 w-full py-2 text-sm font-semibold ${theme.secondaryAction}`}
        >
          {labels.openDetail}
        </button>
      </div>
    </article>
  );
}

function BurningPanel({ topic, labels, onOpenSurface, theme }) {
  return (
    <article className={`p-4 ${theme.card}`}>
      <h4 className={`text-lg font-semibold ${theme.heading}`}>Urgent {topic.display_label.toLowerCase()}</h4>
      <p className={`text-sm font-semibold ${theme.muted}`}>top urgent only</p>
      <div className="mt-5 space-y-3">
        {topic.urgentTasks.map((task, index) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onOpenSurface(task.surface)}
            className={`flex w-full items-center gap-3 rounded-2xl border bg-white px-3 py-3 text-left shadow-soft transition hover:-translate-y-0.5 ${index === 0 ? topic.tone.border : "border-ink-100"}`}
          >
            <span className={`h-8 w-8 shrink-0 rounded-xl ${topic.tone.dot}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink-800">{task.title}</span>
              <span className="mt-1 block truncate text-sm font-semibold text-ink-400">{task.context}</span>
            </span>
            <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-600">
              {labels.openDetail.replace(" detail", "")}
            </span>
          </button>
        ))}
      </div>
    </article>
  );
}

function AnalyticsView({ loading, payload, labels, theme }) {
  return (
    <div className="space-y-3">
      <SectionHeader icon={BarChart3} title={labels.analytics} subtitle="Graph-led view of module load, urgency, and due windows." theme={theme} />
      <div className="grid gap-5 lg:grid-cols-2">
        <GraphPanel
          title="Category load"
          subtitle="Open tasks by business area."
          items={payload?.analytics?.category_load || []}
          valueKey="count"
          accentKey="urgent_count"
          empty={loading ? "Loading..." : "No category load yet."}
          theme={theme}
        />
        <GraphPanel
          title="Status mix"
          subtitle="Open task statuses currently visible."
          items={(payload?.analytics?.status_mix || []).map((item) => ({ label: item.status, count: item.count }))}
          valueKey="count"
          empty={loading ? "Loading..." : "No status data yet."}
          theme={theme}
        />
      </div>
      <GraphPanel
        title="Due buckets"
        subtitle="Where attention is required by time window."
        items={payload?.analytics?.due_buckets || []}
        valueKey="count"
        empty={loading ? "Loading..." : "No due dates detected."}
        theme={theme}
      />
    </div>
  );
}

export function WorkloadView({ loading, labels, categories, theme, tasks, actorAgentId, onAction, onSchedule, focusedDate, onFocusDate }) {
  const [calendarView, setCalendarView] = useState("week");
  const [anchorDate, setAnchorDate] = useState(() => startOfLocalDay());
  const [selectedDate, setSelectedDate] = useState(() => focusedDate || formatLocalDateKey(new Date()));
  const [filter, setFilter] = useState("all");
  const [urgency, setUrgency] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");

  const filteredTasks = useMemo(() => {
    const q = normalizeText(query).toLowerCase();
    return (tasks || [])
      .filter((task) => {
        const matchesQuery = !q || [task.title, task.context, task.status, task.task_type].join(" ").toLowerCase().includes(q);
        const matchesUrgency = urgency === "all" || task.urgency === urgency;
        const matchesDue = matchesDateFilter(task, filter);
        const matchesAssignment = matchesAssignmentFilter(task, assignmentFilter, actorAgentId);
        const matchesCategory = categoryFilter === "all" || task.category_code === categoryFilter;
        return matchesQuery && matchesUrgency && matchesDue && matchesAssignment && matchesCategory;
      })
      .sort((a, b) => String(a.due_at || "9999").localeCompare(String(b.due_at || "9999")) || Number(b.urgency_score || 0) - Number(a.urgency_score || 0));
  }, [actorAgentId, assignmentFilter, categoryFilter, filter, query, tasks, urgency]);

  const overdue = (tasks || []).filter((task) => dueState(task.due_at, task.status).code === "overdue").length;
  const today = (tasks || []).filter((task) => dueState(task.due_at, task.status).code === "today").length;
  const delegated = (tasks || []).filter((task) => task.delegated_at).length;
  const myTasks = (tasks || []).filter((task) => actorAgentId && task.assigned_agent_id === actorAgentId).length;

  const moveCalendar = (direction) => {
    setAnchorDate((current) => {
      const next =
        calendarView === "month"
          ? addMonths(current, direction)
          : addDays(current, calendarView === "week" ? direction * 7 : direction);
      const nextKey = formatLocalDateKey(next);
      setSelectedDate(nextKey);
      onFocusDate?.(nextKey);
      return next;
    });
  };

  const jumpToday = () => {
    const todayDate = startOfLocalDay();
    const todayKey = formatLocalDateKey(todayDate);
    setAnchorDate(todayDate);
    setSelectedDate(todayKey);
    onFocusDate?.(todayKey);
  };

  const openTask = (task) => onAction(task, task.actions?.find((action) => action.code === "open") || task.actions?.[0]);

  return (
    <div className="space-y-5">
      <SectionHeader icon={LayoutGrid} title={labels.workload} subtitle="Calendar scheduling, due dates, delegation, and workload distribution." theme={theme} />
      <div className="grid gap-3 md:grid-cols-4">
        <MiniMetric label="Open tasks" value={(tasks || []).length} theme={theme} />
        <MiniMetric label="Overdue" value={overdue} tone="rose" theme={theme} />
        <MiniMetric label="Due today" value={today} tone="amber" theme={theme} />
        <MiniMetric label="Delegated" value={delegated} helper={`${myTasks} assigned to me`} theme={theme} />
      </div>
      <div className={theme.panelCompact}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className={`text-xl font-semibold ${theme.heading}`}>Schedule and due work</h3>
            <p className={`text-sm ${theme.body}`}>Calendar workspace from existing task due dates, ownership, and category metadata.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {["day", "week", "month"].map((item) => (
              <button key={item} type="button" onClick={() => setCalendarView(item)} className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${calendarView === item ? "bg-ink-900 text-white" : "border border-ink-100 bg-white text-ink-500"}`}>
                {item}
              </button>
            ))}
            <button type="button" onClick={() => moveCalendar(-1)} className="rounded-full border border-ink-100 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500">Prev</button>
            <button type="button" onClick={jumpToday} className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">Today</button>
            <button type="button" onClick={() => moveCalendar(1)} className="rounded-full border border-ink-100 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500">Next</button>
          </div>
        </div>
        <div className="mb-4 rounded-2xl border border-ink-100 bg-ink-50/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {DATE_FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                  filter === item ? "bg-ink-900 text-white" : "border border-ink-100 bg-white text-ink-500"
                }`}
              >
                {item.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(13rem,1.4fr)_minmax(9rem,0.8fr)_minmax(9rem,0.9fr)_minmax(9rem,0.9fr)]">
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2">
              <Search className="h-4 w-4 text-ink-300" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-xs font-semibold text-ink-700 outline-none placeholder:text-ink-300"
                placeholder="Search tasks"
              />
            </label>
            <Select label="Priority" value={urgency} onChange={setUrgency} options={["all", "critical", "high", "medium", "normal"]} />
            <Select label="Assignment" value={assignmentFilter} onChange={setAssignmentFilter} options={ASSIGNMENT_FILTERS} />
            <Select label="Category" value={categoryFilter} onChange={setCategoryFilter} options={["all", ...categories.map((category) => category.code)]} />
          </div>
        </div>
        <div className="grid max-h-[calc(100vh-16rem)] min-h-[30rem] gap-2 overflow-hidden">
          <CalendarWorkbench
            view={calendarView}
            anchorDate={anchorDate}
            selectedDate={selectedDate}
            tasks={filteredTasks}
            onSelectDate={(dateKey) => {
              const next = parseLocalDate(dateKey) || new Date();
              setSelectedDate(dateKey);
              setAnchorDate(next);
              onFocusDate?.(dateKey);
            }}
            onOpenTask={openTask}
            onSchedule={onSchedule}
          />
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, helper, tone, theme }) {
  const toneClass = tone === "rose" ? "text-rose-600" : tone === "amber" ? "text-amber-600" : theme.heading;
  return (
    <div className={`p-4 ${theme.cardRaised}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme.muted}`}>{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${toneClass}`}>{value}</p>
      {helper ? <p className={`mt-1 text-xs ${theme.body}`}>{helper}</p> : null}
    </div>
  );
}

function CalendarWorkbench({ view, anchorDate, selectedDate, tasks, onSelectDate, onOpenTask, onSchedule }) {
  const days = calendarRange(view, anchorDate);
  const anchor = parseLocalDate(anchorDate) || new Date();
  const title = view === "month"
    ? anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : view === "day"
      ? anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
      : `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${days[days.length - 1].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return (
    <div className="flex min-h-0 flex-col rounded-[1.5rem] border border-ink-100 bg-ink-50/70 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-ink-400">Calendar</p>
          <h4 className="text-lg font-semibold text-ink-900">{title}</h4>
        </div>
        <span className="rounded-full border border-ink-100 bg-white px-3 py-1 text-xs font-semibold text-ink-500">
          {(tasks || []).length} filtered
        </span>
      </div>
      <div className={`min-h-0 overflow-y-auto pr-1 ${view === "day" ? "grid grid-cols-1 gap-2" : "grid grid-cols-7 gap-2"}`}>
        {days.map((day) => {
          const dayKey = formatLocalDateKey(day);
          const selected = selectedDate === dayKey;
          const today = formatLocalDateKey(new Date()) === dayKey;
          const inMonth = day.getMonth() === anchor.getMonth();
          const dayTasks = (tasks || []).filter((task) => toDateInputValue(task.due_at) === dayKey);
          const visibleChips = view === "month" ? dayTasks.slice(0, 3) : dayTasks.slice(0, 6);
          return (
            <div
              key={dayKey}
              onClick={() => onSelectDate(dayKey)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectDate(dayKey);
                }
              }}
              className={`min-h-[8.25rem] rounded-2xl border p-2 text-left transition ${
                selected
                  ? "border-brand-300 bg-brand-50 text-brand-900 shadow-soft ring-2 ring-brand-100"
                  : today
                    ? "border-ink-200 bg-white text-ink-800"
                    : "border-ink-100 bg-white/85 text-ink-700"
              } ${view === "month" && !inMonth ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-ink-400">
                    {day.toLocaleDateString(undefined, { weekday: "short" })}
                  </p>
                  <p className="mt-1 text-lg font-semibold">{day.getDate()}</p>
                </div>
                {selected ? <span className="rounded-full bg-ink-900 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-white">Selected</span> : null}
              </div>
              <div className="mt-3 space-y-1">
                {visibleChips.length ? visibleChips.map((task) => (
                  <span
                    key={`${dayKey}-${task.id}`}
                    className={`block truncate rounded-full px-2 py-1 text-[0.58rem] font-semibold ${
                      dueState(task.due_at, task.status).code === "overdue"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-white text-ink-600"
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenTask(task);
                    }}
                  >
                    {task.title}
                  </span>
                )) : (
                  <span className="text-[0.6rem] text-ink-300">No due task</span>
                )}
                {dayTasks.length > visibleChips.length ? (
                  <span className="block text-[0.58rem] font-semibold text-brand-700">+{dayTasks.length - visibleChips.length} more</span>
                ) : null}
              </div>
              {view === "day" && dayTasks.length ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {dayTasks.slice(0, 8).map((task) => (
                    <TaskAgendaRow key={`day-${task.id}`} task={task} onOpen={() => onOpenTask(task)} onSchedule={() => onSchedule(task)} compact />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskAgendaRow({ task, onOpen, onSchedule, selected, compact }) {
  const due = dueState(task.due_at, task.status);
  return (
    <div className={`rounded-2xl border px-3 py-3 shadow-soft ${selected ? "border-brand-200 bg-brand-50/60" : "border-ink-100 bg-white"} ${compact ? "shadow-none" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">{task.title}</p>
          <p className="mt-1 truncate text-xs text-ink-500">{task.context}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold ${due.className}`}>
          {due.label}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={(event) => { event.stopPropagation(); onOpen?.(); }} className="rounded-full bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white">
          Open
        </button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onSchedule?.(); }} className="rounded-full border border-ink-100 bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-600">
          Reschedule
        </button>
      </div>
    </div>
  );
}

function TaskBrowser({
  loading,
  labels,
  taskBrowser,
  actorAgentId,
  categories,
  openCategory,
  setOpenCategory,
  pinnedCategories,
  setPinnedCategories,
  delegationCandidates,
  onAction,
  onDelegate,
  onSchedule,
  globalSearch,
  dateFocus,
  onClearDateFocus,
  collapsed,
  setCollapsed,
  theme
}) {
  const [controlsOpen, setControlsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [urgency, setUrgency] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState("urgency");
  const [delegatingTaskId, setDelegatingTaskId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [delegateError, setDelegateError] = useState("");
  const [delegateBusy, setDelegateBusy] = useState(false);

  const togglePin = (code) => {
    setPinnedCategories((current) => {
      if (current.includes(code)) return current.filter((item) => item !== code);
      return [...current, code].slice(-3);
    });
  };

  const filteredTasks = useCallback((tasks) => {
    const q = [query, globalSearch].map(normalizeText).filter(Boolean).join(" ").toLowerCase();
    const filtered = (tasks || []).filter((task) => {
      const matchesQuery = !q || [task.title, task.context, task.status, task.task_type].join(" ").toLowerCase().includes(q);
      const matchesUrgency = urgency === "all" || task.urgency === urgency;
      const matchesDate = matchesDateFilter(task, dateFilter);
      const matchesFocusDate = !dateFocus || toDateInputValue(task.due_at) === dateFocus;
      const matchesAssignment = matchesAssignmentFilter(task, assignmentFilter, actorAgentId);
      const matchesCategory = categoryFilter === "all" || task.category_code === categoryFilter;
      return matchesQuery && matchesUrgency && matchesDate && matchesFocusDate && matchesAssignment && matchesCategory;
    });
    return filtered.sort((a, b) => {
      if (sort === "created_date") return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      if (sort === "due_date") return String(a.due_at || "9999").localeCompare(String(b.due_at || "9999"));
      if (sort === "category") return String(a.category_label || "").localeCompare(String(b.category_label || ""));
      return Number(b.urgency_score || 0) - Number(a.urgency_score || 0);
    });
  }, [actorAgentId, assignmentFilter, categoryFilter, dateFilter, globalSearch, query, sort, urgency]);

  const submitDelegate = async (task) => {
    setDelegateError("");
    if (!assignee) {
      setDelegateError("Choose an assignee first.");
      return;
    }
    try {
      setDelegateBusy(true);
      await onDelegate(task, assignee);
      setDelegatingTaskId("");
      setAssignee("");
    } catch {
      setDelegateError("Delegation failed. Check permissions and try again.");
    } finally {
      setDelegateBusy(false);
    }
  };

  const toggleCategory = (code) => {
    setControlsOpen(false);
    setDelegatingTaskId("");
    setOpenCategory((current) => (current === code ? "" : code));
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed right-5 top-[6.75rem] z-40 hidden rounded-2xl border border-white/70 bg-white/95 p-3 text-ink-600 shadow-strong transition hover:text-ink-900 xl:inline-flex"
        aria-label="Open Task Browser"
      >
        <PanelRightOpen className="h-5 w-5" />
      </button>
    );
  }

  return (
    <aside className={theme.taskRail}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-[0.65rem] font-semibold uppercase tracking-[0.25em] ${theme.muted}`}>Action queue</p>
          <h3 className={`text-lg font-semibold ${theme.heading}`}>{labels.taskBrowser}</h3>
          <p className={`mt-1 text-xs font-semibold ${theme.muted}`}>{labels.taskBrowserHint}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setControlsOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-ink-100 bg-white px-3 py-2 text-xs font-semibold text-ink-600 transition hover:border-brand-200 hover:text-brand-700"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="hidden rounded-full border border-ink-100 bg-white p-2 text-ink-400 transition hover:text-ink-800 xl:inline-flex"
            aria-label="Collapse Task Browser"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2 pr-1">
        {dateFocus ? (
          <div className="rounded-2xl border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">
            <div className="flex items-center justify-between gap-2">
              <span>Focused on {formatDate(dateFocus)}</span>
              <button type="button" onClick={onClearDateFocus} className="rounded-full border border-brand-100 bg-white px-2 py-1 text-[0.65rem]">
                Clear
              </button>
            </div>
          </div>
        ) : null}
        {categories.map((category) => {
          const isOpen = openCategory === category.code;
          const tasks = filteredTasks(category.tasks);
          const isPinned = pinnedCategories.includes(category.code);
          return (
            <div
              key={category.code}
              className={`${theme.cardRaised} transition ${isOpen ? "border-brand-200 bg-brand-50/80 shadow-soft ring-2 ring-brand-100" : ""}`}
            >
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleCategory(category.code)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className={`block truncate text-sm font-semibold ${isOpen ? "text-brand-900" : theme.heading}`}>{category.display_label}</span>
                  <span className={`mt-1 block text-xs ${isOpen ? "text-brand-700" : theme.muted}`}>
                    {category.count} tasks, {category.urgent_count} urgent
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isOpen ? "bg-white text-brand-700" : "border border-ink-100 bg-white text-ink-500"}`}>
                    {category.count}
                  </span>
                  {isPinned ? <span className="rounded-full bg-brand-500 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-white">{labels.pinned}</span> : null}
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.code)}
                    className={`rounded-full border p-1 transition ${isOpen ? "border-brand-100 bg-white text-brand-700" : "border-transparent hover:bg-ink-50"}`}
                    aria-label={isOpen ? "Collapse category" : "Expand category"}
                  >
                    <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180 text-brand-700" : "text-ink-400"}`} />
                  </button>
                </div>
              </div>

              <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}>
                <div className="overflow-hidden">
                  <div className={`${isOpen ? "border-t border-brand-100 bg-white/95" : "border-t border-ink-100"} px-2 py-2`}>
                    <div className="max-h-[42vh] min-h-[14rem] space-y-2 overflow-y-auto overscroll-contain pr-2 scrollbar-thin">
                      {tasks.length ? (
                        tasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            delegating={delegatingTaskId === task.id}
                            setDelegatingTaskId={setDelegatingTaskId}
                            assignee={assignee}
                            setAssignee={setAssignee}
                            delegationCandidates={delegationCandidates}
                            delegateBusy={delegateBusy}
                            delegateError={delegateError}
                            onAction={onAction}
                            onSchedule={onSchedule}
                            onSubmitDelegate={submitDelegate}
                            labels={labels}
                            theme={theme}
                          />
                        ))
                      ) : (
                        <p className={theme.empty}>
                          {loading ? "Loading..." : labels.noTasks}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <TaskBrowserFilterModal
        open={controlsOpen}
        labels={labels}
        taskBrowser={taskBrowser}
        categories={categories}
        pinnedCategories={pinnedCategories}
        onTogglePin={togglePin}
        query={query}
        setQuery={setQuery}
        urgency={urgency}
        setUrgency={setUrgency}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        assignmentFilter={assignmentFilter}
        setAssignmentFilter={setAssignmentFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        sort={sort}
        setSort={setSort}
        onClose={() => setControlsOpen(false)}
      />
    </aside>
  );
}

function TaskBrowserFilterModal({
  open,
  labels,
  taskBrowser,
  categories,
  pinnedCategories,
  onTogglePin,
  query,
  setQuery,
  urgency,
  setUrgency,
  dateFilter,
  setDateFilter,
  assignmentFilter,
  setAssignmentFilter,
  categoryFilter,
  setCategoryFilter,
  sort,
  setSort,
  onClose
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center bg-ink-900/35 px-4 py-12 backdrop-blur-[2px]">
      <div className="max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] border border-ink-100 bg-white p-5 shadow-strong">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-ink-400">Task Browser</p>
            <h3 className="mt-1 text-xl font-semibold text-ink-900">{labels.controls}</h3>
            <p className="mt-1 text-sm text-ink-500">Filter the action queue and pin up to three categories into Burning Topics.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-ink-100 bg-white p-2 text-ink-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
          {labels.search}
          <span className="mt-2 flex items-center gap-2 rounded-2xl border border-ink-100 bg-ink-50 px-3 py-2">
            <Search className="h-4 w-4 text-ink-300" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-sm normal-case tracking-normal text-ink-800 outline-none"
              placeholder="Title, status, context"
            />
          </span>
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Select label={labels.urgency} value={urgency} onChange={setUrgency} options={taskBrowser.urgencyFilters || []} />
          <Select label="Due" value={dateFilter} onChange={setDateFilter} options={taskBrowser.dueDateFilters || DATE_FILTERS} />
          <Select label="Assignment" value={assignmentFilter} onChange={setAssignmentFilter} options={taskBrowser.assignmentFilters || ASSIGNMENT_FILTERS} />
          <Select label="Category" value={categoryFilter} onChange={setCategoryFilter} options={["all", ...categories.map((category) => category.code)]} />
          <Select label={labels.sort} value={sort} onChange={setSort} options={taskBrowser.sortOptions || []} />
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">{labels.pinned} categories</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {categories.map((category) => {
              const pinned = pinnedCategories.includes(category.code);
              return (
                <button
                  key={category.code}
                  type="button"
                  onClick={() => onTogglePin(category.code)}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    pinned ? "border-ink-900 bg-ink-900 text-white shadow-soft" : "border-ink-100 bg-white text-ink-700 hover:border-brand-200"
                  }`}
                >
                  <span className="block text-sm font-semibold">{category.display_label}</span>
                  <span className={`mt-1 block text-xs ${pinned ? "text-white/70" : "text-ink-400"}`}>
                    {category.count} tasks · {category.urgent_count} urgent
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold text-white">
            Apply filters
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  delegating,
  setDelegatingTaskId,
  assignee,
  setAssignee,
  delegationCandidates,
  delegateBusy,
  delegateError,
  onAction,
  onSchedule,
  onSubmitDelegate,
  labels,
  theme
}) {
  const primaryAction = task.actions?.find((action) => action.code === "open") || task.actions?.[0];
  const due = dueState(task.due_at, task.status);
  return (
    <div className="rounded-xl border border-ink-200/80 bg-white px-3 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-full border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${URGENCY_CLASSES[task.urgency] || URGENCY_CLASSES.normal}`}>
          {task.urgency_label}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[0.65rem] font-semibold ${due.className}`}>
          <Clock3 className="h-3.5 w-3.5" />
          {due.label}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug text-ink-900">{task.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">{task.context}</p>
      {task.assigned_agent_name || task.delegated_at ? (
        <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink-400">
          {task.assigned_agent_name ? `Assigned to ${task.assigned_agent_name}` : "Unassigned"}
          {task.delegated_at ? " · delegated" : ""}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {primaryAction ? (
          <button
            type="button"
            onClick={() => onAction(task, primaryAction)}
            className={theme.primaryAction}
          >
            {primaryAction.label}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setDelegatingTaskId(delegating ? "" : task.id)}
          className="inline-flex items-center gap-1 rounded-full border border-ink-100 bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-500"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {labels.delegate}
        </button>
        <button
          type="button"
          onClick={() => onSchedule(task)}
          className="inline-flex items-center gap-1 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Schedule
        </button>
      </div>

      {delegating ? (
        <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/70 p-3">
          <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
            Assignee
            <select
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              className="mt-2 w-full rounded-xl border border-brand-100 bg-white px-3 py-2 text-sm normal-case tracking-normal text-ink-800 outline-none"
            >
              <option value="">Choose person or team</option>
              {delegationCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
              ))}
            </select>
          </label>
          {delegateError ? <p className="mt-2 text-xs text-rose-600">{delegateError}</p> : null}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDelegatingTaskId("")}
              className="rounded-full border border-ink-100 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500"
            >
              {labels.cancel}
            </button>
            <button
              type="button"
              onClick={() => onSubmitDelegate(task)}
              disabled={delegateBusy}
              className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {delegateBusy ? "Saving..." : labels.confirm}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ScheduleTaskModal({ task, labels, onClose, onSubmit, theme }) {
  const [view, setView] = useState("day");
  const [form, setForm] = useState({
    due_at: "",
    planned_start_at: "",
    planned_end_at: "",
    reminder_at: "",
    priority: "normal",
    status: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!task) return;
    setForm({
      due_at: toDateInputValue(task.due_at),
      planned_start_at: toDateInputValue(task.planned_start_at),
      planned_end_at: toDateInputValue(task.planned_end_at),
      reminder_at: toDateInputValue(task.reminder_at),
      priority: task.priority || task.urgency || "normal",
      status: ""
    });
    setView("day");
    setError("");
  }, [task]);

  if (!task) return null;

  const setDue = (date) => {
    setForm((current) => ({ ...current, due_at: date ? formatLocalDateKey(date) : "" }));
  };

  const submit = async () => {
    setError("");
    try {
      setSaving(true);
      await onSubmit(task, {
        due_at: form.due_at || null,
        planned_start_at: form.planned_start_at || null,
        planned_end_at: form.planned_end_at || null,
        reminder_at: form.reminder_at || null,
        priority: form.priority || "normal",
        status: form.status || undefined
      });
    } catch {
      setError("Schedule update failed. Check task permissions and try again.");
    } finally {
      setSaving(false);
    }
  };

  const due = dueState(form.due_at || task.due_at, task.status);
  const days = Array.from({ length: view === "month" ? 28 : view === "week" ? 7 : 1 }, (_, index) => addDays(new Date(), index));

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-900/35 p-4 backdrop-blur-[2px]">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-[1.75rem] border border-ink-100 bg-white p-5 shadow-strong">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-[0.65rem] font-semibold uppercase tracking-[0.25em] ${theme.muted}`}>Task scheduling</p>
            <h3 className={`mt-1 text-xl font-semibold ${theme.heading}`}>{task.title}</h3>
            <p className={`mt-1 text-sm ${theme.body}`}>{task.context}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-ink-100 bg-white p-2 text-ink-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {["day", "week", "month"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                view === item ? "bg-ink-900 text-white" : "border border-ink-100 bg-ink-50 text-ink-500"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="rounded-2xl border border-ink-100 bg-ink-50/70 p-3">
            <div className={`grid gap-2 ${view === "day" ? "grid-cols-1" : "grid-cols-7"}`}>
              {days.map((day) => {
                const dayValue = formatLocalDateKey(day);
                const selected = form.due_at === dayValue;
                return (
                  <button
                    key={dayValue}
                    type="button"
                    onClick={() => setDue(day)}
                    className={`min-h-[4.8rem] rounded-xl border px-2 py-2 text-left transition ${
                      selected ? "border-brand-300 bg-brand-50 text-brand-800" : "border-ink-100 bg-white text-ink-600"
                    }`}
                  >
                    <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.16em]">
                      {day.toLocaleDateString(undefined, { weekday: "short" })}
                    </span>
                    <span className="mt-1 block text-lg font-semibold">{day.getDate()}</span>
                    {selected ? <span className="mt-1 block text-[0.6rem] font-semibold">selected</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-ink-100 bg-white p-4">
            <div className={`rounded-xl border px-3 py-2 text-sm font-semibold ${due.className}`}>
              {due.label}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDue(new Date())} className="rounded-full border border-ink-100 bg-white px-3 py-2 text-xs font-semibold">Today</button>
              <button type="button" onClick={() => setDue(addDays(new Date(), 1))} className="rounded-full border border-ink-100 bg-white px-3 py-2 text-xs font-semibold">Tomorrow</button>
              <button type="button" onClick={() => setDue(addDays(new Date(), 7))} className="rounded-full border border-ink-100 bg-white px-3 py-2 text-xs font-semibold">Next week</button>
              <button type="button" onClick={() => setDue(null)} className="rounded-full border border-ink-100 bg-white px-3 py-2 text-xs font-semibold">No due date</button>
            </div>
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
              Custom due date
              <input type="date" value={form.due_at} onChange={(event) => setForm((current) => ({ ...current, due_at: event.target.value }))} className="mt-2 w-full rounded-xl border border-ink-100 px-3 py-2 text-sm text-ink-700" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
                Start
                <input type="date" value={form.planned_start_at} onChange={(event) => setForm((current) => ({ ...current, planned_start_at: event.target.value }))} className="mt-2 w-full rounded-xl border border-ink-100 px-3 py-2 text-sm text-ink-700" />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
                End
                <input type="date" value={form.planned_end_at} onChange={(event) => setForm((current) => ({ ...current, planned_end_at: event.target.value }))} className="mt-2 w-full rounded-xl border border-ink-100 px-3 py-2 text-sm text-ink-700" />
              </label>
            </div>
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
              Reminder
              <input type="date" value={form.reminder_at} onChange={(event) => setForm((current) => ({ ...current, reminder_at: event.target.value }))} className="mt-2 w-full rounded-xl border border-ink-100 px-3 py-2 text-sm text-ink-700" />
            </label>
            <Select label="Priority" value={form.priority} onChange={(value) => setForm((current) => ({ ...current, priority: value }))} options={["normal", "medium", "high", "critical"]} />
            <Select label="Status" value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={["", "open", "assigned", "in_progress", "blocked", "review"]} />
            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-full border border-ink-100 bg-white px-4 py-2 text-xs font-semibold text-ink-500">{labels.cancel}</button>
              <button type="button" onClick={submit} disabled={saving} className="rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
                {saving ? "Saving..." : "Save schedule"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, theme }) {
  return (
    <div className={theme.panelCompact}>
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-brand-500" />
        <div>
          <h3 className={`text-2xl font-semibold ${theme.heading}`}>{title}</h3>
          <p className={`text-sm ${theme.body}`}>{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function GraphPanel({ title, subtitle, items, valueKey, accentKey, empty, theme }) {
  const safeItems = Array.isArray(items) ? items : [];
  const total = safeItems.reduce((sum, item) => sum + Number(item?.[valueKey] || 0), 0);
  return (
    <div className={theme.panelCompact}>
      <div className="mb-4">
        <h3 className={`text-xl font-semibold ${theme.heading}`}>{title}</h3>
        <p className={`mt-1 text-sm ${theme.body}`}>{subtitle}</p>
      </div>
      {safeItems.length ? (
        <div className="space-y-3">
          {safeItems.map((item) => {
            const value = Number(item?.[valueKey] || 0);
            const accent = Number(accentKey ? item?.[accentKey] || 0 : 0);
            return (
              <div key={item.code || item.label || item.status} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink-700">{item.label || item.status}</span>
                  <span className="text-ink-400">{value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${percentOf(value, total) || 5}%` }} />
                </div>
                {accent ? <p className="text-xs text-rose-500">{accent} urgent</p> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className={theme.empty}>
          {empty}
        </p>
      )}
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
            {option.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
