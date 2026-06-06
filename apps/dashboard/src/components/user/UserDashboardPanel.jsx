import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  Clock3,
  LayoutGrid,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserPlus
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const DEFAULT_CONFIG = {
  endpoint: "/api/eip/user/dashboard/command-center",
  title: "Run the business, not the system",
  subtitle:
    "Stats on top, burning topics below. The Task Browser shows all actionables and expands like the Admin data browser.",
  tabs: [
    { code: "command", label: "Command Center" },
    { code: "analytics", label: "Analytics" },
    { code: "workload", label: "Workload" }
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
    businessStatsHint: "Role/template-driven graph set",
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
    workload: "Workload balance",
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
    sortOptions: ["urgency", "due_date", "category"]
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

const URGENCY = {
  critical: "text-rose-600",
  high: "text-rose-600",
  medium: "text-violet-600",
  normal: "text-ink-400"
};

function mergeConfig(props = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...props,
    labels: { ...DEFAULT_CONFIG.labels, ...(props.labels || {}) },
    taskBrowser: { ...DEFAULT_CONFIG.taskBrowser, ...(props.taskBrowser || {}) },
    categoryPresentation: {
      ...DEFAULT_CONFIG.categoryPresentation,
      ...(props.categoryPresentation || {})
    }
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
  return Math.max(5, Math.min(100, Math.round((Number(value || 0) / total) * 100)));
}

function decorateCategory(category, config) {
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

function makeSparklinePoints(series) {
  const values = Array.isArray(series) && series.length
    ? series.map((item) => Number(item.value || item.count || 0))
    : [2, 4, 3, 6, 8, 10];
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  return values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
    const y = 46 - ((value - min) / range) * 38;
    return `${x},${y}`;
  }).join(" ");
}

export default function UserDashboardPanel({ node, ctx }) {
  const config = useMemo(() => mergeConfig(node?.props || {}), [node]);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("command");
  const [openCategory, setOpenCategory] = useState(config.taskBrowser.defaultOpen || "");
  const [pinnedCategories, setPinnedCategories] = useState([]);
  const [globalSearch, setGlobalSearch] = useState("");

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
    <section className="command-center-surface min-h-[calc(100vh-8rem)] rounded-[2rem] border border-white/75 bg-white/92 px-5 py-5 shadow-soft">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(330px,24vw)]">
        <main className="min-w-0 space-y-6">
          <CommandHeader
            config={config}
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
              widgets={widgets}
              payload={payload}
              labels={config.labels}
              burningTopics={burningTopics}
              pinnedCategories={pinnedCategories}
              decoratedCategories={decoratedCategories}
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
              categories={decoratedCategories}
              pinnedCategories={pinnedCategories}
            />
          ) : null}
        </main>

        <TaskBrowser
          loading={loading}
          labels={config.labels}
          taskBrowser={config.taskBrowser}
          categories={decoratedCategories}
          openCategory={openCategory}
          setOpenCategory={setOpenCategory}
          pinnedCategories={pinnedCategories}
          setPinnedCategories={setPinnedCategories}
          delegationCandidates={payload?.workload?.delegation_candidates || []}
          onAction={handleAction}
          onDelegate={handleDelegate}
          globalSearch={globalSearch}
        />
      </div>
      <p className="mt-4 text-xs font-semibold text-ink-300">
        UI rule: Task Browser = all user actionables; Burning Topics = pinned urgent subset.
        Filters collapse at bottom. Delegation is available on each task.
      </p>
    </section>
  );
}

function CommandHeader({ config, activeTab, setActiveTab, globalSearch, setGlobalSearch, loading, loadCommandCenter }) {
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
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-ink-400 hover:text-ink-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <label className="flex h-14 items-center gap-3 rounded-[1.35rem] border border-ink-100 bg-ink-50/80 px-5 text-sm text-ink-400">
          <Search className="h-4 w-4" />
          <input
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
            placeholder={config.labels.signalSearch}
            className="w-full bg-transparent text-sm text-ink-700 outline-none placeholder:text-ink-300"
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
        <h2 className="text-5xl font-semibold leading-none tracking-normal text-ink-900 xl:text-6xl">
          {config.title}
        </h2>
        <p className="mt-3 max-w-5xl text-lg font-medium text-ink-400">{config.subtitle}</p>
      </div>
    </header>
  );
}

function CommandView({
  loading,
  widgets,
  payload,
  labels,
  burningTopics,
  pinnedCategories,
  decoratedCategories,
  onOpenSurface
}) {
  return (
    <>
      <section className="rounded-[1.75rem] border border-ink-100 bg-white px-6 py-6 shadow-soft">
        <div className="mb-5">
          <h3 className="text-2xl font-semibold text-ink-900">{labels.businessStats}</h3>
          <p className="text-sm font-semibold text-ink-400">{labels.businessStatsHint}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {widgets.map((widget) => (
            <StatTile key={widget.code} widget={widget} loading={loading} labels={labels} />
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-ink-100 bg-white px-6 py-6 shadow-soft">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold text-ink-900">{labels.burningTopics}</h3>
            <p className="text-sm font-semibold text-ink-400">{labels.burningHint}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {decoratedCategories
              .filter((category) => pinnedCategories.includes(category.code))
              .slice(0, 3)
              .map((category) => (
                <span
                  key={category.code}
                  className={`rounded-full border ${category.tone.softBorder} ${category.tone.bg} px-4 py-1.5 text-sm font-semibold ${category.tone.accent}`}
                >
                  {category.display_label}
                </span>
              ))}
          </div>
        </div>
        {burningTopics.length ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {burningTopics.map((topic) => (
              <BurningPanel key={topic.code} topic={topic} labels={labels} onOpenSurface={onOpenSurface} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-400">
            {labels.burningEmpty}
          </p>
        )}
      </section>
    </>
  );
}

function StatTile({ widget, loading, labels }) {
  const series = Array.isArray(widget.series) ? widget.series : [];
  const total = series.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const accent = widget.tone === "rose" ? "stroke-rose-500" : widget.tone === "amber" ? "stroke-amber-500" : "stroke-brand-500";
  const secondary = widget.tone === "rose" ? "stroke-rose-300" : widget.tone === "amber" ? "stroke-amber-300" : "stroke-amber-400";
  return (
    <article className="rounded-2xl border border-ink-100 bg-ink-50/70 px-4 py-4">
      <p className="text-sm font-semibold text-ink-400">{widget.label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink-900">{loading ? "..." : widget.value ?? 0}</p>
      <p className={`mt-2 text-sm font-semibold ${widget.tone === "rose" ? "text-rose-500" : widget.tone === "amber" ? "text-amber-500" : "text-brand-500"}`}>
        {widget.helper || (total ? `${total} live signals` : "live signal")}
      </p>
      <svg viewBox="0 0 100 52" className="mt-4 h-20 w-full overflow-visible">
        <line x1="0" y1="47" x2="100" y2="47" className="stroke-ink-200" strokeWidth="2" />
        <polyline points={makeSparklinePoints(series)} fill="none" className={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={makeSparklinePoints(series.slice().reverse())} fill="none" className={secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
      </svg>
      <button
        type="button"
        className="mt-2 w-full rounded-full border border-ink-100 bg-white py-2 text-sm font-semibold text-brand-600 shadow-soft"
      >
        {labels.openDetail}
      </button>
    </article>
  );
}

function BurningPanel({ topic, labels, onOpenSurface }) {
  return (
    <article className="rounded-2xl border border-ink-100 bg-ink-50/70 p-4">
      <h4 className="text-lg font-semibold text-ink-900">Urgent {topic.display_label.toLowerCase()}</h4>
      <p className="text-sm font-semibold text-ink-400">top urgent only</p>
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

function AnalyticsView({ loading, payload, labels }) {
  return (
    <div className="space-y-5">
      <SectionHeader icon={BarChart3} title={labels.analytics} subtitle="Graph-led view of module load, urgency, and due windows." />
      <div className="grid gap-5 lg:grid-cols-2">
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
    <div className="space-y-5">
      <SectionHeader icon={LayoutGrid} title={labels.workload} subtitle="Pinned categories and delegation readiness for the current workspace." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <div key={category.code} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold text-ink-900">{category.display_label}</h4>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${category.tone.badge}`}>{category.count}</span>
            </div>
            <p className="mt-2 min-h-10 text-sm text-ink-500">{category.description}</p>
            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-ink-400">
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
  onDelegate,
  globalSearch
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
    const q = [query, globalSearch].map(normalizeText).filter(Boolean).join(" ").toLowerCase();
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
  }, [globalSearch, query, sort, urgency]);

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
    <aside className="task-browser rounded-[2rem] border border-ink-100 bg-ink-50/80 px-5 py-6 shadow-soft xl:sticky xl:top-[6.75rem] xl:max-h-[calc(100vh-7.75rem)] xl:overflow-hidden">
      <div>
        <h3 className="text-4xl font-semibold leading-none text-ink-900">{labels.taskBrowser}</h3>
        <p className="mt-1 text-sm font-semibold text-ink-500">{labels.taskBrowserHint}</p>
      </div>

      <div className="mt-6 flex rounded-[1.35rem] border border-ink-100 bg-white p-1.5 shadow-soft">
        <label className="flex min-w-0 flex-1 items-center gap-2 px-3 text-sm text-ink-400">
          <Search className="h-4 w-4" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.taskSearch}
            className="w-full bg-transparent text-sm text-ink-700 outline-none placeholder:text-ink-300"
          />
        </label>
        <button
          type="button"
          onClick={() => setControlsOpen(true)}
          className="rounded-[1rem] border border-brand-100 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-600 shadow-soft"
        >
          {labels.delegate}
        </button>
      </div>

      <div className="mt-5 space-y-3 overflow-y-auto pr-1 xl:max-h-[calc(100vh-19rem)]">
        {categories.map((category) => {
          const isOpen = openCategory === category.code;
          const tasks = filteredTasks(category.tasks);
          const isPinned = pinnedCategories.includes(category.code);
          return (
            <div key={category.code}>
              <div className={`rounded-2xl border shadow-soft ${isOpen ? category.tone.active : "border-ink-100 bg-white text-ink-900"}`}>
                <div className="flex items-center justify-between gap-3 px-4 py-4">
                  <button
                    type="button"
                    onClick={() => setOpenCategory(isOpen ? "" : category.code)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${isOpen ? "border-brand-300 text-brand-300" : `${category.tone.softBorder} ${category.tone.accent}`}`}>
                      !
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-semibold">{category.display_label}</span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`hidden text-xs font-semibold uppercase tracking-[0.08em] ${isOpen ? "text-white/60" : "text-ink-300"} sm:inline`}>
                      {category.badge}
                    </span>
                    <button
                      type="button"
                      onClick={() => togglePin(category.code)}
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${isOpen ? "bg-white/10 text-white" : isPinned ? category.tone.badge : "bg-ink-50 text-ink-400"}`}
                    >
                      {category.count}
                    </button>
                  </div>
                </div>
              </div>

              {isOpen ? (
                <div className="mx-1 mt-3 rounded-2xl border border-ink-100 bg-ink-100/55 px-3 py-4">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">{labels.actionables}</p>
                    <p className="text-xs font-semibold text-ink-300">scroll</p>
                  </div>
                  <div className="max-h-[34vh] space-y-2 overflow-y-auto overscroll-contain pr-1">
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
                      <p className="rounded-xl border border-dashed border-ink-200 bg-white px-3 py-4 text-sm text-ink-400">
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

      <div className="mt-4 rounded-2xl border border-ink-100 bg-white shadow-soft">
        <button
          type="button"
          onClick={() => setControlsOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left text-sm font-semibold text-ink-500"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-ink-400" />
            {labels.controls}
          </span>
          <ChevronDown className={`h-4 w-4 text-brand-500 transition ${controlsOpen ? "rotate-180" : ""}`} />
        </button>
        {controlsOpen ? (
          <div className="space-y-3 border-t border-ink-100 px-4 py-3">
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
  const actionLabel = primaryAction?.label || labels.openDetail.replace(" detail", "");
  return (
    <article className="rounded-xl border border-ink-100 bg-white px-3 py-3 shadow-soft">
      <div className="flex items-start gap-3">
        <span className={`w-12 shrink-0 text-sm font-semibold uppercase ${URGENCY[task.urgency] || URGENCY.normal}`}>
          {task.urgency_label === "Overdue" ? "High" : task.urgency_label}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-800">{task.title}</p>
          <p className="mt-1 truncate text-sm font-semibold text-ink-400">{task.context}</p>
        </div>
        {task.due_at ? (
          <span className="hidden items-center gap-1 text-xs text-ink-300 2xl:inline-flex">
            <Clock3 className="h-3.5 w-3.5" />
            {formatDate(task.due_at)}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => onAction(task, primaryAction)}
          className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-600"
        >
          {actionLabel}
        </button>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => setDelegatingTaskId(delegating ? "" : task.id)}
          className="inline-flex items-center gap-1 rounded-full border border-ink-100 bg-ink-50 px-3 py-1 text-xs font-semibold text-ink-400"
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
    </article>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="rounded-[1.75rem] border border-ink-100 bg-white px-6 py-5 shadow-soft">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-brand-500" />
        <div>
          <h3 className="text-2xl font-semibold text-ink-900">{title}</h3>
          <p className="text-sm text-ink-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function GraphPanel({ title, subtitle, items, valueKey, accentKey, empty }) {
  const safeItems = Array.isArray(items) ? items : [];
  const total = safeItems.reduce((sum, item) => sum + Number(item?.[valueKey] || 0), 0);
  return (
    <div className="rounded-[1.75rem] border border-ink-100 bg-white px-6 py-5 shadow-soft">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-ink-900">{title}</h3>
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
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${percentOf(value, total) || 5}%` }} />
                </div>
                {accent ? <p className="text-xs text-rose-500">{accent} urgent</p> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-400">
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
