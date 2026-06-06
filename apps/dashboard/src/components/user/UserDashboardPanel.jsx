import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  ChevronDown,
  CircleDot,
  Clock3,
  Flame,
  LayoutGrid,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserPlus
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const DEFAULT_CONFIG = {
  endpoint: "/api/eip/user/dashboard/command-center",
  title: "Command Center",
  subtitle: "Owner-level workbench for urgent work, live signals, and governed next actions.",
  tabs: [
    { code: "command", label: "Command Center" },
    { code: "analytics", label: "Analytics" },
    { code: "workload", label: "Workload" }
  ],
  widgets: [
    { code: "open_work", label: "Open work" },
    { code: "high_urgency", label: "High urgency" },
    { code: "due_today", label: "Due today" },
    { code: "active_modules", label: "Active modules" }
  ],
  labels: {
    refresh: "Refresh",
    burningTopics: "Burning topics",
    burningEmpty: "No urgent item is waiting in the pinned categories.",
    taskBrowser: "Task Browser",
    controls: "Filters and delegation",
    analytics: "Signal analytics",
    workload: "Workload balance",
    delegate: "Delegate",
    cancel: "Cancel",
    confirm: "Confirm",
    noTasks: "No open tasks in this category.",
    search: "Search tasks",
    urgency: "Urgency",
    sort: "Sort",
    pinned: "Pinned"
  },
  taskBrowser: {
    defaultOpen: "crm",
    urgencyFilters: ["all", "critical", "high", "medium", "normal"],
    sortOptions: ["urgency", "due_date", "category"]
  }
};

const TONE_CLASSES = {
  ink: "border-ink-100 bg-white/85 text-ink-900",
  rose: "border-rose-200 bg-rose-50/90 text-rose-700",
  amber: "border-amber-200 bg-amber-50/90 text-amber-700",
  emerald: "border-emerald-200 bg-emerald-50/90 text-emerald-700",
  brand: "border-brand-200 bg-brand-50/90 text-brand-700",
  cyan: "border-cyan-200 bg-cyan-50/90 text-cyan-700"
};

const URGENCY_CLASSES = {
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  medium: "border-cyan-200 bg-cyan-50 text-cyan-700",
  normal: "border-ink-100 bg-white text-ink-500"
};

function mergeConfig(props = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...props,
    labels: { ...DEFAULT_CONFIG.labels, ...(props.labels || {}) },
    taskBrowser: { ...DEFAULT_CONFIG.taskBrowser, ...(props.taskBrowser || {}) }
  };
}

function normalizeText(value) {
  return String(value || "").trim();
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return normalizeText(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function percentOf(value, total) {
  if (!total) return 0;
  return Math.max(4, Math.min(100, Math.round((Number(value || 0) / total) * 100)));
}

export default function UserDashboardPanel({ node, ctx }) {
  const config = useMemo(() => mergeConfig(node?.props || {}), [node]);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("command");
  const [openCategory, setOpenCategory] = useState(config.taskBrowser.defaultOpen || "");
  const [pinnedCategories, setPinnedCategories] = useState([]);

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
    } catch (err) {
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

  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  const widgets = useMemo(() => {
    const byCode = new Map((payload?.widgets || []).map((widget) => [widget.code, widget]));
    return (config.widgets || DEFAULT_CONFIG.widgets)
      .map((descriptor) => ({ ...descriptor, ...(byCode.get(descriptor.code) || {}) }))
      .slice(0, 4);
  }, [config.widgets, payload]);

  const burningTopics = useMemo(() => {
    const pinned = new Set(pinnedCategories);
    return categories
      .filter((category) => pinned.has(category.code))
      .map((category) => ({
        ...category,
        urgentTasks: (category.tasks || []).filter((task) => Number(task.urgency_score || 0) >= 3).slice(0, 3)
      }))
      .filter((category) => category.urgentTasks.length)
      .slice(0, 3);
  }, [categories, pinnedCategories]);

  const handleAction = useCallback((task, action) => {
    if (action?.kind === "navigate" && action.surface) {
      ctx?.user?.setActiveTab?.(action.surface);
      return;
    }
    if (task?.surface) {
      ctx?.user?.setActiveTab?.(task.surface);
    }
  }, [ctx]);

  const handleDelegate = useCallback(async (task, assignedAgentId) => {
    const endpoint = task?.actions?.find((action) => action.code === "delegate")?.endpoint;
    if (!endpoint || !assignedAgentId) return;
    await apiFetch(endpoint, { method: "POST", body: { assigned_agent_id: assignedAgentId } });
    await loadCommandCenter();
  }, [loadCommandCenter]);

  return (
    <section className="space-y-4">
      <div className="glass-panel px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-ink-400">Workspace</p>
            <h2 className="mt-1 text-2xl font-semibold font-display text-ink-900">{config.title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-ink-500">{config.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={loadCommandCenter}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-500 shadow-soft transition hover:text-ink-900 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {config.labels.refresh}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(config.tabs || DEFAULT_CONFIG.tabs).map((tab) => (
            <button
              key={tab.code}
              type="button"
              onClick={() => setActiveTab(tab.code)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.code
                  ? "bg-ink-900 text-white shadow-glow"
                  : "border border-white/70 bg-white/75 text-ink-500 hover:text-ink-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,24vw)]">
        <div className="min-w-0 space-y-4">
          {activeTab === "command" ? (
            <CommandView
              loading={loading}
              widgets={widgets}
              payload={payload}
              burningTopics={burningTopics}
              labels={config.labels}
              onOpenSurface={(surface) => ctx?.user?.setActiveTab?.(surface)}
            />
          ) : null}
          {activeTab === "analytics" ? (
            <AnalyticsView loading={loading} payload={payload} labels={config.labels} />
          ) : null}
          {activeTab === "workload" ? (
            <WorkloadView
              loading={loading}
              payload={payload}
              labels={config.labels}
              categories={categories}
              pinnedCategories={pinnedCategories}
            />
          ) : null}
        </div>

        <TaskBrowser
          loading={loading}
          labels={config.labels}
          taskBrowser={config.taskBrowser}
          categories={categories}
          openCategory={openCategory}
          setOpenCategory={setOpenCategory}
          pinnedCategories={pinnedCategories}
          setPinnedCategories={setPinnedCategories}
          delegationCandidates={payload?.workload?.delegation_candidates || []}
          onAction={handleAction}
          onDelegate={handleDelegate}
        />
      </div>
    </section>
  );
}

function CommandView({ loading, widgets, payload, burningTopics, labels, onOpenSurface }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {widgets.map((widget) => (
          <KpiCard key={widget.code} widget={widget} loading={loading} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.52fr)_minmax(0,0.48fr)]">
        <GraphPanel
          title="Work by category"
          subtitle="Task engine load, grouped by module signal."
          items={payload?.analytics?.category_load || []}
          valueKey="count"
          accentKey="urgent_count"
          empty="No open work detected."
        />
        <GraphPanel
          title="Due map"
          subtitle="Owner attention by schedule window."
          items={payload?.analytics?.due_buckets || []}
          valueKey="count"
          empty="Nothing scheduled yet."
        />
      </div>

      <div className="glass-panel px-5 py-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-rose-400">Urgent subset</p>
            <h3 className="text-lg font-semibold text-ink-900">{labels.burningTopics}</h3>
          </div>
          <Flame className="h-5 w-5 text-rose-400" />
        </div>
        {burningTopics.length ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {burningTopics.map((topic) => (
              <div key={topic.code} className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-ink-900">{topic.label}</h4>
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600">
                    {topic.urgentTasks.length} urgent
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {topic.urgentTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onOpenSurface(task.surface)}
                      className="w-full rounded-xl border border-ink-100 bg-ink-50/80 px-3 py-2 text-left transition hover:border-ink-200 hover:bg-white"
                    >
                      <p className="text-sm font-semibold text-ink-900">{task.title}</p>
                      <p className="mt-1 text-xs text-ink-500">{task.context}</p>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-ink-400">
                  Review the first urgent item, then continue inside the governed workspace.
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-ink-200 bg-white/70 px-4 py-6 text-sm text-ink-400">
            {labels.burningEmpty}
          </p>
        )}
      </div>
    </>
  );
}

function AnalyticsView({ loading, payload, labels }) {
  return (
    <div className="space-y-4">
      <div className="glass-panel px-5 py-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-brand-500" />
          <div>
            <h3 className="text-lg font-semibold text-ink-900">{labels.analytics}</h3>
            <p className="text-sm text-ink-500">Lightweight operational signal, not a table dump.</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <GraphPanel
          title="Category load"
          subtitle="Open tasks by business area."
          items={payload?.analytics?.category_load || []}
          valueKey="count"
          accentKey="urgent_count"
          empty={loading ? "Loading..." : "No category load yet."}
        />
        <GraphPanel
          title="Status mix"
          subtitle="Open task statuses currently visible."
          items={(payload?.analytics?.status_mix || []).map((item) => ({ label: item.status, count: item.count }))}
          valueKey="count"
          empty={loading ? "Loading..." : "No status data yet."}
        />
      </div>
      <GraphPanel
        title="Due buckets"
        subtitle="Where attention is required by time window."
        items={payload?.analytics?.due_buckets || []}
        valueKey="count"
        empty={loading ? "Loading..." : "No due dates detected."}
      />
    </div>
  );
}

function WorkloadView({ loading, payload, labels, categories, pinnedCategories }) {
  return (
    <div className="space-y-4">
      <div className="glass-panel px-5 py-4">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-brand-500" />
          <div>
            <h3 className="text-lg font-semibold text-ink-900">{labels.workload}</h3>
            <p className="text-sm text-ink-500">Pinned categories and delegation readiness for the current workspace.</p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <div key={category.code} className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold text-ink-900">{category.label}</h4>
              <span className="text-sm font-semibold text-ink-500">{category.count}</span>
            </div>
            <p className="mt-2 min-h-10 text-sm text-ink-500">{category.description}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
              <span>{category.urgent_count} urgent</span>
              <span>{pinnedCategories.includes(category.code) ? labels.pinned : "Available"}</span>
            </div>
          </div>
        ))}
        {!categories.length && !loading ? (
          <p className="rounded-2xl border border-dashed border-ink-200 bg-white/70 px-4 py-6 text-sm text-ink-400">
            No workload categories available yet.
          </p>
        ) : null}
      </div>
      <GraphPanel
        title="Delegation pool"
        subtitle="Assignable tenant agents exposed by the kernel agent model."
        items={(payload?.workload?.delegation_candidates || []).map((item) => ({ label: item.label, count: 1 }))}
        valueKey="count"
        empty={loading ? "Loading..." : "No delegation candidates available."}
      />
    </div>
  );
}

function TaskBrowser({
  loading,
  labels,
  taskBrowser,
  categories,
  openCategory,
  setOpenCategory,
  pinnedCategories,
  setPinnedCategories,
  delegationCandidates,
  onAction,
  onDelegate
}) {
  const [controlsOpen, setControlsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [urgency, setUrgency] = useState("all");
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
    const q = normalizeText(query).toLowerCase();
    const filtered = (tasks || []).filter((task) => {
      const matchesQuery = !q || [task.title, task.context, task.status, task.task_type].join(" ").toLowerCase().includes(q);
      const matchesUrgency = urgency === "all" || task.urgency === urgency;
      return matchesQuery && matchesUrgency;
    });
    return filtered.sort((a, b) => {
      if (sort === "due_date") return String(a.due_at || "9999").localeCompare(String(b.due_at || "9999"));
      if (sort === "category") return String(a.category_label || "").localeCompare(String(b.category_label || ""));
      return Number(b.urgency_score || 0) - Number(a.urgency_score || 0);
    });
  }, [query, sort, urgency]);

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

  return (
    <aside className="glass-panel min-h-[calc(100vh-9rem)] px-4 py-4 xl:sticky xl:top-[6.75rem] xl:max-h-[calc(100vh-7.5rem)] xl:overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">Action queue</p>
          <h3 className="text-lg font-semibold text-ink-900">{labels.taskBrowser}</h3>
        </div>
        <LayoutGrid className="h-5 w-5 text-ink-400" />
      </div>

      <div className="mt-4 space-y-3 overflow-y-auto pr-1 xl:max-h-[calc(100vh-16rem)]">
        {categories.map((category) => {
          const isOpen = openCategory === category.code;
          const tasks = filteredTasks(category.tasks);
          const isPinned = pinnedCategories.includes(category.code);
          return (
            <div key={category.code} className="rounded-2xl border border-white/70 bg-white/80 shadow-soft">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setOpenCategory(isOpen ? "" : category.code)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block text-sm font-semibold text-ink-900">{category.label}</span>
                  <span className="mt-1 block text-xs text-ink-400">
                    {category.count} tasks, {category.urgent_count} urgent
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => togglePin(category.code)}
                    className={`rounded-full border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${
                      isPinned ? "border-brand-200 bg-brand-50 text-brand-700" : "border-ink-100 bg-white text-ink-400"
                    }`}
                  >
                    {isPinned ? labels.pinned : "Pin"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenCategory(isOpen ? "" : category.code)}
                    className="rounded-full p-1 hover:bg-ink-50"
                    aria-label={isOpen ? "Collapse category" : "Expand category"}
                  >
                    <ChevronDown className={`h-4 w-4 text-ink-400 transition ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>

              {isOpen ? (
                <div className="border-t border-ink-100 px-3 py-3">
                  <div className="max-h-[30vh] space-y-2 overflow-y-auto overscroll-contain pr-1">
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
                          onSubmitDelegate={submitDelegate}
                          labels={labels}
                        />
                      ))
                    ) : (
                      <p className="rounded-xl border border-dashed border-ink-200 bg-white/70 px-3 py-4 text-sm text-ink-400">
                        {loading ? "Loading..." : labels.noTasks}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-2xl border border-white/70 bg-white/80">
        <button
          type="button"
          onClick={() => setControlsOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-ink-800"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-ink-400" />
            {labels.controls}
          </span>
          <ChevronDown className={`h-4 w-4 text-ink-400 transition ${controlsOpen ? "rotate-180" : ""}`} />
        </button>
        {controlsOpen ? (
          <div className="space-y-3 border-t border-ink-100 px-4 py-3">
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">
              {labels.search}
              <span className="mt-2 flex items-center gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2">
                <Search className="h-4 w-4 text-ink-300" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full bg-transparent text-sm normal-case tracking-normal text-ink-800 outline-none"
                  placeholder="Title, status, context"
                />
              </span>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Select label={labels.urgency} value={urgency} onChange={setUrgency} options={taskBrowser.urgencyFilters || []} />
              <Select label={labels.sort} value={sort} onChange={setSort} options={taskBrowser.sortOptions || []} />
            </div>
          </div>
        ) : null}
      </div>
    </aside>
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
  onSubmitDelegate,
  labels
}) {
  const primaryAction = task.actions?.find((action) => action.code === "open") || task.actions?.[0];
  return (
    <div className="rounded-xl border border-ink-100 bg-white px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-full border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${URGENCY_CLASSES[task.urgency] || URGENCY_CLASSES.normal}`}>
          {task.urgency_label}
        </span>
        {task.due_at ? (
          <span className="inline-flex items-center gap-1 text-xs text-ink-400">
            <Clock3 className="h-3.5 w-3.5" />
            {formatDate(task.due_at)}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug text-ink-900">{task.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">{task.context}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {primaryAction ? (
          <button
            type="button"
            onClick={() => onAction(task, primaryAction)}
            className="rounded-full bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white shadow-soft"
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

function KpiCard({ widget, loading }) {
  const tone = TONE_CLASSES[widget.tone] || TONE_CLASSES.ink;
  return (
    <div className={`rounded-2xl border px-4 py-4 shadow-soft ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">{widget.label}</p>
        <CircleDot className="h-4 w-4 opacity-60" />
      </div>
      <p className="mt-3 text-3xl font-semibold">{loading ? "..." : widget.value ?? 0}</p>
      <p className="mt-2 min-h-8 text-xs leading-relaxed opacity-70">{widget.helper}</p>
    </div>
  );
}

function GraphPanel({ title, subtitle, items, valueKey, accentKey, empty }) {
  const safeItems = Array.isArray(items) ? items : [];
  const total = safeItems.reduce((sum, item) => sum + Number(item?.[valueKey] || 0), 0);
  return (
    <div className="glass-panel px-5 py-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
        <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
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
                  <div className="h-full rounded-full bg-ink-800" style={{ width: `${percentOf(value, total) || 4}%` }} />
                </div>
                {accent ? <p className="text-xs text-rose-500">{accent} urgent</p> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-ink-200 bg-white/70 px-4 py-6 text-sm text-ink-400">
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
