import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Link2,
  Megaphone,
  PlugZap,
  Plus,
  Radio,
  RefreshCw,
  Search,
  StickyNote,
  Tags,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const FALLBACK_TABS = [
  { id: "overview", label: "Overview", kind: "overview" },
  { id: "leads", label: "Leads", kind: "service_object", endpoint: "/api/eip/crm/leads", permission: "CRM_LEAD_READ" },
  { id: "agents", label: "Customers", kind: "agent", endpoint: "/api/eip/crm/agents", permission: "CRM_AGENT_READ" },
  { id: "opportunities", label: "Opportunities", kind: "service_object", endpoint: "/api/eip/crm/opportunities", permission: "CRM_OPPORTUNITY_READ" },
  { id: "cases", label: "Cases", kind: "service_object", endpoint: "/api/eip/crm/cases", permission: "CRM_CASE_READ" },
  { id: "interactions", label: "Interactions", kind: "service_object", endpoint: "/api/eip/crm/interactions", permission: "CRM_INTERACTION_READ" },
  { id: "tasks", label: "Follow-ups", kind: "task", endpoint: "/api/eip/crm/tasks", permission: "CRM_TASK_READ" },
  { id: "intelligence", label: "Intelligence", kind: "intelligence", endpoint: "/api/eip/crm/intelligence/overview", permission: "CRM_INTELLIGENCE_READ", capability: "intelligence" },
  { id: "segments", label: "Segments", kind: "agent", endpoint: "/api/eip/crm/segments", permission: "CRM_SEGMENT_READ", capability: "segments" },
  { id: "campaigns", label: "Campaigns", kind: "service_object", endpoint: "/api/eip/crm/campaigns", permission: "CRM_CAMPAIGN_READ", capability: "campaigns" },
  { id: "signals", label: "Signals", kind: "info_record", endpoint: "/api/eip/crm/signals", permission: "CRM_SIGNAL_READ", capability: "signals" },
  { id: "connectors", label: "Connectors", kind: "connector", endpoint: "/api/eip/crm/intelligence/connectors", permission: "CRM_CONNECTOR_READ", capability: "connectors" },
];

const FALLBACK_KPIS = [
  ["new_leads", "New leads"],
  ["open_leads", "Open leads"],
  ["qualified_leads", "Qualified leads"],
  ["converted_leads", "Converted leads"],
  ["open_opportunities", "Open opportunities"],
  ["pipeline_value", "Pipeline value", "currency"],
  ["weighted_pipeline_value", "Weighted pipeline", "currency"],
  ["won_value", "Won value", "currency"],
  ["open_cases", "Open cases"],
  ["overdue_follow_ups", "Overdue follow-ups"],
  ["tasks_due_today", "Tasks due today"],
].map(([code, label, format]) => ({ code, label, format }));

const STATUS_LISTS = {
  leads: "CRM_LEAD_STATUS",
  cases: "CRM_CASE_STATUS",
  opportunities: "CRM_OPPORTUNITY_STATUS",
  campaigns: "CRM_CAMPAIGN_STATUS",
  tasks: "TASK_STATUS",
};

const WRITE_PERMISSIONS = {
  leads: "CRM_LEAD_WRITE",
  agents: "CRM_AGENT_WRITE",
  opportunities: "CRM_OPPORTUNITY_WRITE",
  cases: "CRM_CASE_WRITE",
  interactions: "CRM_INTERACTION_WRITE",
  tasks: "CRM_TASK_WRITE",
  segments: "CRM_SEGMENT_WRITE",
  campaigns: "CRM_CAMPAIGN_WRITE",
  signals: "CRM_SIGNAL_WRITE",
};

const CREATE_FORMS = {
  agents: [
    ["agent_type", "Customer type", "select", ["ORG", "PERSON"]],
    ["name", "Name", "text"],
    ["code", "Reference code", "text"],
  ],
  leads: [
    ["title", "Lead title", "text"],
    ["customer_agent_id", "Prospect customer id", "text"],
    ["source", "Source", "governed", "CRM_SOURCE"],
    ["priority", "Priority", "governed", "CRM_PRIORITY"],
    ["next_follow_up_at", "Next follow-up", "datetime-local"],
    ["description", "Description", "textarea"],
  ],
  interactions: [
    ["customer_agent_id", "Customer id", "text"],
    ["contact_agent_id", "Contact id", "text"],
    ["channel", "Channel", "governed", "CRM_INTERACTION_CHANNEL"],
    ["direction", "Direction", "governed", "CRM_INTERACTION_DIRECTION"],
    ["subject", "Subject", "text"],
    ["body_text", "Notes", "textarea"],
  ],
  cases: [
    ["customer_agent_id", "Customer id", "text"],
    ["title", "Case title", "text"],
    ["case_type", "Case type", "select", ["REQUEST", "COMPLAINT", "SUPPORT", "RETURN"]],
    ["severity", "Priority", "governed", "CRM_PRIORITY"],
    ["description", "Description", "textarea"],
  ],
  opportunities: [
    ["customer_agent_id", "Customer id", "text"],
    ["title", "Opportunity title", "text"],
    ["value_amount", "Value", "number"],
    ["value_currency", "Currency", "text"],
    ["probability", "Probability", "number"],
    ["expected_close_at", "Expected close", "date"],
  ],
  tasks: [
    ["service_object_id", "Linked object id", "text"],
    ["task_type", "Task type", "governed", "CRM_TASK_TYPE"],
    ["title", "Title", "text"],
    ["assigned_agent_id", "Assignee id", "text"],
    ["due_at", "Due at", "datetime-local"],
    ["description", "Description", "textarea"],
  ],
  segments: [
    ["agent_type", "Segment class", "select", ["SEGMENT", "MARKET_GROUP"]],
    ["name", "Segment name", "text"],
    ["code", "Reference code", "text"],
    ["segment_type", "Segment type", "governed", "CRM_SEGMENT_TYPE"],
    ["priority", "Priority", "governed", "CRM_SEGMENT_PRIORITY"],
    ["maturity", "Maturity", "governed", "CRM_SEGMENT_MATURITY"],
    ["source_channels_csv", "Source channels", "text"],
    ["interest_tags_csv", "Interest tags", "text"],
    ["language", "Language", "text"],
    ["region", "Region", "text"],
  ],
  campaigns: [
    ["title", "Campaign title", "text"],
    ["code", "Reference code", "text"],
    ["objective", "Objective", "governed", "CRM_CAMPAIGN_OBJECTIVE"],
    ["start_date", "Start date", "date"],
    ["end_date", "End date", "date"],
    ["budget", "Budget", "number"],
    ["currency", "Currency", "text"],
    ["target_segment_ids_csv", "Target segment ids", "text"],
  ],
  signals: [
    ["signal_type", "Signal type", "governed", "CRM_SIGNAL_TYPE"],
    ["provider", "Provider", "text"],
    ["source_channel", "Source channel", "governed", "CRM_SIGNAL_SOURCE_CHANNEL"],
    ["metric", "Metric", "text"],
    ["value", "Value", "number"],
    ["unit", "Unit", "text"],
    ["observed_at", "Observed at", "datetime-local"],
    ["description", "Description", "textarea"],
  ],
};

const ICONS = {
  overview: Activity,
  leads: ArrowRightLeft,
  agents: Building2,
  opportunities: BriefcaseBusiness,
  cases: ClipboardList,
  interactions: FileText,
  tasks: CalendarClock,
  intelligence: BarChart3,
  segments: Tags,
  campaigns: Megaphone,
  signals: Radio,
  connectors: PlugZap,
};

const INTELLIGENCE_KPIS = [
  ["segment_count", "Segments"],
  ["campaign_count", "Campaigns"],
  ["active_campaign_count", "Active campaigns"],
  ["signal_count", "Signals"],
  ["signals_last_7_days", "Signals last 7 days"],
  ["connector_readiness", "Ready connectors"],
].map(([code, label]) => ({ code, label }));

function parseCsv(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function formatValue(value, format) {
  if (format === "currency") {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
      Number(value || 0)
    );
  }
  if (typeof value === "number") return value.toLocaleString();
  return value ?? "-";
}

function titleFor(item) {
  return item?.title || item?.name || item?.code || item?.connection_name || item?.connection_code || item?.task_type || item?.id || "Untitled";
}

function statusTone(status) {
  const value = String(status || "").toLowerCase();
  if (["won", "done", "closed", "resolved", "converted"].includes(value)) return "bg-emerald-50 text-emerald-700";
  if (["lost", "cancelled", "unqualified"].includes(value)) return "bg-rose-50 text-rose-700";
  if (["qualified", "proposal", "in_progress", "contacted"].includes(value)) return "bg-sky-50 text-sky-700";
  return "bg-amber-50 text-amber-700";
}

function StatusPill({ value }) {
  if (!value) return null;
  return <span className={`rounded-full px-2 py-1 text-[0.65rem] font-semibold uppercase ${statusTone(value)}`}>{value}</span>;
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink-950/35 p-4" onMouseDown={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/70 bg-white p-5 shadow-strong"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-ink-400 hover:bg-ink-50" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormFields({ fields, form, options, onChange }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map(([name, label, kind, values]) => {
        const resolvedValues = kind === "governed" ? options?.[values] || [] : values || [];
        const select = kind === "select" || kind === "governed";
        return (
          <label key={name} className={kind === "textarea" ? "md:col-span-2" : ""}>
            <span className="mb-1 block text-[0.65rem] font-semibold uppercase text-ink-400">{label}</span>
            {kind === "textarea" ? (
              <textarea
                rows={4}
                value={form[name] || ""}
                onChange={(event) => onChange(name, event.target.value)}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700"
              />
            ) : select ? (
              <select
                value={form[name] || ""}
                onChange={(event) => onChange(name, event.target.value)}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700"
              >
                <option value="">Select</option>
                {resolvedValues.map((option) => {
                  const value = typeof option === "string" ? option : option.code;
                  return <option key={value} value={value}>{typeof option === "string" ? option : option.label}</option>;
                })}
              </select>
            ) : (
              <input
                type={kind || "text"}
                value={form[name] || ""}
                onChange={(event) => onChange(name, event.target.value)}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700"
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

function Timeline({ items }) {
  if (!items.length) return <p className="text-xs text-ink-400">No timeline entries yet.</p>;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={`${item.kind}-${item.id}`} className="border-l-2 border-brand-200 pl-3 text-xs text-ink-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold uppercase text-brand-700">{item.kind.replaceAll("_", " ")}</span>
            <span className="text-ink-400">{new Date(item.occurred_at).toLocaleString()}</span>
          </div>
          <p className="mt-1">{item.title || item.description || item.note || item.to_status || item.status || "Activity"}</p>
        </div>
      ))}
    </div>
  );
}

export default function CrmWorkspace({ node }) {
  const props = node?.props || {};
  const tabs = props.tabs?.length ? props.tabs : FALLBACK_TABS;
  const kpis = props.kpis?.length ? props.kpis : FALLBACK_KPIS;
  const actions = { create: "Create", refresh: "Refresh", edit: "Edit", note: "Add note", task: "Add follow-up", convert: "Convert lead", ...(props.actions || {}) };
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || "overview");
  const [overview, setOverview] = useState(null);
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [options, setOptions] = useState({});
  const [permissions, setPermissions] = useState([]);
  const [capabilities, setCapabilities] = useState({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const visibleTabs = useMemo(() => tabs.filter((item) =>
    (!item.permission || permissions.includes(item.permission)) &&
    (!item.capability || capabilities[item.capability] === true)
  ), [capabilities, permissions, tabs]);
  const tab = useMemo(() => visibleTabs.find((item) => item.id === activeTab) || visibleTabs[0], [activeTab, visibleTabs]);
  const can = useCallback((permission) => !permission || permissions.includes(permission), [permissions]);

  const loadOptions = useCallback(async () => {
    const result = await apiFetch("/api/eip/crm/governance/options");
    setOptions(result.options || {});
    setPermissions(result.permissions || []);
    setCapabilities(result.capabilities || {});
  }, []);

  const loadOverview = useCallback(async () => {
    const result = await apiFetch("/api/eip/crm/dashboard/overview");
    setOverview(result);
  }, []);

  const loadIntelligenceOverview = useCallback(async () => {
    const result = await apiFetch("/api/eip/crm/intelligence/overview");
    setOverview(result);
  }, []);

  const loadRecords = useCallback(async () => {
    if (!tab?.endpoint) return;
    const search = query.trim() && ["agents", "leads"].includes(tab.id) ? `?q=${encodeURIComponent(query.trim())}` : "";
    const result = await apiFetch(`${tab.endpoint}${search}`);
    setRecords(result.items || []);
  }, [query, tab]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      await loadOptions();
      if (tab?.kind === "overview") await loadOverview();
      else if (tab?.kind === "intelligence") await loadIntelligenceOverview();
      else await loadRecords();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [loadOptions, loadOverview, loadIntelligenceOverview, loadRecords, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  function selectTab(tabId) {
    setActiveTab(tabId);
    setSelected(null);
    setDetail(null);
    setTimeline([]);
  }

  const openDetail = useCallback(async (item) => {
    setSelected(item);
    setDetail(item);
    setTimeline([]);
    if (!tab?.endpoint || ["tasks", "connectors"].includes(tab.id)) return;
    try {
      const detailPath = tab.id === "agents" ? `${tab.endpoint}/${item.id}/overview` : `${tab.endpoint}/${item.id}`;
      const result = await apiFetch(detailPath);
      setDetail({ ...result.item, parties: result.parties, contacts: result.contacts, addresses: result.addresses, bank_accounts: result.bank_accounts, service_objects: result.service_objects, links: result.links });
      if (tab.id === "signals") return;
      const timelinePath = ["segments", "campaigns"].includes(tab.id)
        ? `${tab.endpoint}/${item.id}/timeline`
        : `/api/eip/crm/timeline?object_kind=${tab.id === "agents" ? "agent" : "service_object"}&object_id=${item.id}`;
      const timelineResult = await apiFetch(timelinePath);
      setTimeline(timelineResult.items || []);
    } catch (error) {
      setMessage(error.message);
    }
  }, [tab]);

  function openModal(kind, initial = {}) {
    setForm(initial);
    setModal(kind);
    setMessage("");
  }

  async function submitModal(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      if (modal === "create") {
        const body = tab.id === "opportunities"
          ? {
              customer_agent_id: form.customer_agent_id,
              title: form.title,
              value: {
                ...(form.value_amount === "" || form.value_amount === undefined ? {} : { amount: Number(form.value_amount) }),
                currency: form.value_currency || "EUR",
              },
              ...(form.probability === "" || form.probability === undefined ? {} : { probability: Number(form.probability) }),
              ...(form.expected_close_at ? { expected_close_at: form.expected_close_at } : {}),
            }
          : tab.id === "segments"
            ? { ...form, source_channels: parseCsv(form.source_channels_csv), interest_tags: parseCsv(form.interest_tags_csv) }
            : tab.id === "campaigns"
              ? { ...form, target_segment_ids: parseCsv(form.target_segment_ids_csv) }
              : form;
        await apiFetch(tab.endpoint, { method: "POST", body });
      } else if (modal === "note") {
        const notePath = tab.id === "campaigns" ? `/api/eip/crm/campaigns/${selected.id}/notes` : "/api/eip/crm/notes";
        await apiFetch(notePath, {
          method: "POST",
          body: {
            ...(tab.id === "campaigns" ? {} : { object_kind: ["agents", "segments"].includes(tab.id) ? "agent" : "service_object", object_id: selected.id }),
            title: form.title || "Note",
            description: form.description || "",
          },
        });
      } else if (modal === "task") {
        const taskPath = tab.id === "segments"
          ? `/api/eip/crm/segments/${selected.id}/tasks`
          : tab.id === "campaigns"
            ? `/api/eip/crm/campaigns/${selected.id}/tasks`
            : "/api/eip/crm/tasks";
        await apiFetch(taskPath, {
          method: "POST",
          body: { ...form, ...(!["segments", "campaigns"].includes(tab.id) ? { service_object_id: selected.id } : {}) },
        });
      } else if (modal === "status") {
        await apiFetch(`${tab.endpoint}/${selected.id}/status`, { method: "POST", body: { to_status: form.to_status } });
      } else if (modal === "convert") {
        await apiFetch(`/api/eip/crm/leads/${selected.id}/convert`, { method: "POST", body: form });
      } else if (modal === "contact") {
        await apiFetch(`/api/eip/crm/agents/${selected.id}/contacts`, { method: "POST", body: form });
      } else if (modal === "address") {
        await apiFetch(`/api/eip/crm/agents/${selected.id}/addresses`, { method: "POST", body: form });
      } else if (modal === "bank") {
        await apiFetch(`/api/eip/crm/agents/${selected.id}/bank-accounts`, { method: "POST", body: form });
      } else if (modal === "channel_variant") {
        const variantPath = form.variant_id
          ? `/api/eip/crm/campaigns/${selected.id}/channel-variants/${form.variant_id}`
          : `/api/eip/crm/campaigns/${selected.id}/channel-variants`;
        await apiFetch(variantPath, { method: form.variant_id ? "PATCH" : "POST", body: form });
      } else if (modal === "signal_link") {
        await apiFetch(`/api/eip/crm/signals/${selected.id}/link`, { method: "POST", body: form });
      } else if (modal === "signal_promote") {
        await apiFetch(`/api/eip/crm/signals/${selected.id}/promote`, { method: "POST", body: form });
      } else if (modal === "edit") {
        const body = tab.id === "agents"
          ? form
          : tab.id === "segments"
            ? { ...form, source_channels: parseCsv(form.source_channels_csv), interest_tags: parseCsv(form.interest_tags_csv) }
          : tab.id === "interactions"
            ? form
            : {
                title: form.title || undefined,
                owner_agent_id: form.owner_agent_id || undefined,
                attrs: form.attrs_json ? JSON.parse(form.attrs_json) : {},
              };
        await apiFetch(`${tab.endpoint}/${selected.id}`, { method: "PATCH", body });
      }
      setModal(null);
      setForm({});
      setMessage("Saved.");
      await refresh();
      if (selected) await openDetail(selected);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  const statusOptions = options?.[STATUS_LISTS[activeTab]] || [];
  const displayRecords = useMemo(() => {
    if (!query.trim() || ["agents", "leads"].includes(tab?.id)) return records;
    const needle = query.toLowerCase();
    return records.filter((item) => JSON.stringify(item).toLowerCase().includes(needle));
  }, [query, records, tab?.id]);

  return (
    <section className="space-y-4">
      <header className="glass-panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase text-brand-700">Customer operations</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">{props.title || "CRM"}</h1>
          <p className="mt-1 text-sm text-ink-500">{props.subtitle || "Customers, leads, opportunities, cases, interactions, and follow-ups."}</p>
        </div>
        <button type="button" onClick={refresh} className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-600">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {actions.refresh}
        </button>
      </header>

      <nav className="glass-panel flex gap-2 overflow-x-auto p-2">
        {visibleTabs.map((item) => {
          const Icon = ICONS[item.id] || Users;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => selectTab(item.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === item.id ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-white/80"}`}
            >
              <Icon className="h-4 w-4" /> {item.label}
            </button>
          );
        })}
      </nav>

      {message ? <p className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-xs text-ink-600">{message}</p> : null}

      {tab?.kind === "overview" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.code} className="rounded-lg border border-white/70 bg-white/80 px-4 py-3 shadow-soft">
                <p className="text-[0.65rem] font-semibold uppercase text-ink-400">{kpi.label}</p>
                <p className="mt-2 text-xl font-semibold text-ink-900">{formatValue(overview?.kpis?.[kpi.code], kpi.format)}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              ["Recent activities", overview?.recent_activities],
              ["Recent notes", overview?.recent_notes],
              ["Active customers", overview?.top_agents],
            ].map(([title, items]) => (
              <div key={title} className="glass-panel p-4">
                <h2 className="text-sm font-semibold text-ink-800">{title}</h2>
                <div className="mt-3 space-y-2 text-xs text-ink-500">
                  {(items || []).length ? (items || []).map((item) => (
                    <div key={item.id} className="rounded-lg border border-ink-100 bg-white/80 px-3 py-2">
                      <p className="font-semibold text-ink-700">{titleFor(item)}</p>
                      <p>{item.description || item.agent_type || item.record_type || `${item.activity_count || 0} activities`}</p>
                    </div>
                  )) : <p>No records yet.</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : tab?.kind === "intelligence" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {INTELLIGENCE_KPIS.map((kpi) => (
              <div key={kpi.code} className="rounded-lg border border-white/70 bg-white/80 px-4 py-3 shadow-soft">
                <p className="text-[0.65rem] font-semibold uppercase text-ink-400">{kpi.label}</p>
                <p className="mt-2 text-xl font-semibold text-ink-900">{formatValue(overview?.kpis?.[kpi.code])}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              ["Top channels", overview?.top_signal_channels],
              ["Campaign status", overview?.campaigns_by_status],
              ["Segment priority", overview?.segments_by_priority],
            ].map(([title, items]) => (
              <div key={title} className="glass-panel p-4">
                <h2 className="text-sm font-semibold text-ink-800">{title}</h2>
                <div className="mt-3 space-y-2 text-xs text-ink-500">
                  {(items || []).length ? items.map((item) => <div key={item.code} className="flex justify-between rounded-lg border border-ink-100 bg-white/80 px-3 py-2"><span>{item.code}</span><strong>{item.count}</strong></div>) : <p>No records yet.</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="glass-panel p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex min-w-60 flex-1 items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 py-2 text-xs text-ink-500">
                <Search className="h-4 w-4" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${tab.label.toLowerCase()}`} className="w-full bg-transparent outline-none" />
              </label>
              {WRITE_PERMISSIONS[tab.id] && can(WRITE_PERMISSIONS[tab.id]) ? <button type="button" onClick={() => openModal("create")} className="flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-2 text-xs font-semibold text-white">
                <Plus className="h-4 w-4" /> {actions.create}
              </button> : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-ink-600">
                <thead className="border-b border-ink-100 text-[0.65rem] uppercase text-ink-400">
                  <tr><th className="px-2 py-2">Title</th><th className="px-2 py-2">Type</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Updated</th></tr>
                </thead>
                <tbody>
                  {displayRecords.map((item) => (
                    <tr key={item.id} onClick={() => openDetail(item)} className={`cursor-pointer border-b border-ink-50 hover:bg-white ${selected?.id === item.id ? "bg-brand-50" : ""}`}>
                      <td className="px-2 py-3 font-semibold text-ink-800">{titleFor(item)}</td>
                      <td className="px-2 py-3">{item.object_type || item.agent_type || item.record_type || item.provider_category || item.task_type || "-"}</td>
                      <td className="px-2 py-3"><StatusPill value={item.status || (item.is_active === false ? "inactive" : "active")} /></td>
                      <td className="px-2 py-3 text-ink-400">{item.updated_at || item.created_at || item.last_sync_at ? new Date(item.updated_at || item.created_at || item.last_sync_at).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!displayRecords.length ? <p className="p-5 text-center text-xs text-ink-400">{loading ? "Loading..." : "No records yet."}</p> : null}
            </div>
          </div>

          <aside className="glass-panel p-4">
            {detail ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase text-brand-700">Selected record</p>
                  <h2 className="mt-1 text-lg font-semibold text-ink-900">{titleFor(detail)}</h2>
                  <div className="mt-2"><StatusPill value={detail.status || (detail.is_active === false ? "inactive" : "active")} /></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.length && can(WRITE_PERMISSIONS[tab.id]) ? <button type="button" onClick={() => openModal("status")} className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600">Status</button> : null}
                  {!["tasks", "signals", "connectors"].includes(tab.id) && can(WRITE_PERMISSIONS[tab.id]) ? <button type="button" onClick={() => openModal("edit", tab.id === "agents" ? { agent_type: detail.agent_type || "", name: detail.name || "", code: detail.code || "" } : tab.id === "segments" ? { agent_type: detail.agent_type || "", name: detail.name || "", code: detail.code || "", segment_type: detail.attrs?.segment_type || "", priority: detail.attrs?.priority || "", maturity: detail.attrs?.maturity || "", source_channels_csv: (detail.attrs?.source_channels || []).join(", "), interest_tags_csv: (detail.attrs?.interest_tags || []).join(", "), language: detail.attrs?.language || "", region: detail.attrs?.region || "" } : tab.id === "interactions" ? { subject: detail.title || "", body_text: detail.attrs?.body_text || "", priority: detail.attrs?.priority || "" } : { title: detail.title || "", owner_agent_id: detail.owner_agent_id || "", attrs_json: JSON.stringify(detail.attrs || {}, null, 2) })} className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600">{actions.edit}</button> : null}
                  {!["agents", "tasks", "signals", "connectors"].includes(tab.id) && can("CRM_TASK_WRITE") ? <button type="button" onClick={() => openModal("task")} className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600">{actions.task}</button> : null}
                  {tab.id === "segments" && can("CRM_SEGMENT_WRITE") ? <button type="button" onClick={() => openModal("task")} className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600">{actions.task}</button> : null}
                  {!["tasks", "signals", "connectors"].includes(tab.id) && can("CRM_NOTE_WRITE") ? <button type="button" onClick={() => openModal("note")} className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600">{actions.note}</button> : null}
                  {tab.id === "campaigns" && can("CRM_CAMPAIGN_WRITE") ? <button type="button" onClick={() => openModal("channel_variant")} className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600">Add channel variant</button> : null}
                  {tab.id === "signals" && can("CRM_SIGNAL_WRITE") ? <button type="button" onClick={() => openModal("signal_link")} className="flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600"><Link2 className="h-3 w-3" /> Link signal</button> : null}
                  {tab.id === "signals" && can("CRM_SIGNAL_WRITE") ? <button type="button" onClick={() => openModal("signal_promote")} className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600">Create review task</button> : null}
                  {tab.id === "leads" && detail.status === "qualified" && can("CRM_LEAD_CONVERT") ? <button type="button" onClick={() => openModal("convert")} className="rounded-lg bg-brand-700 px-2 py-1 text-xs text-white">{actions.convert}</button> : null}
                  {tab.id === "agents" && can("CRM_AGENT_WRITE") ? <button type="button" onClick={() => openModal("contact")} className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600">Add contact</button> : null}
                  {tab.id === "agents" && can("CRM_AGENT_WRITE") ? <button type="button" onClick={() => openModal("address")} className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600">Add address</button> : null}
                  {tab.id === "agents" && can("CRM_AGENT_WRITE") ? <button type="button" onClick={() => openModal("bank")} className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600">Add bank account</button> : null}
                </div>
                <dl className="grid gap-2 text-xs">
                  {Object.entries(detail).filter(([key, value]) => !["attrs", "parties", "contacts", "addresses", "bank_accounts", "service_objects"].includes(key) && value !== null && typeof value !== "object").slice(0, 10).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2"><dt className="text-ink-400">{key.replaceAll("_", " ")}</dt><dd className="break-all text-ink-700">{String(value)}</dd></div>
                  ))}
                </dl>
                {detail.attrs ? <pre className="max-h-44 overflow-auto rounded-lg bg-ink-950 p-3 text-[0.65rem] text-ink-100">{JSON.stringify(detail.attrs, null, 2)}</pre> : null}
                {tab.id === "campaigns" && detail.attrs?.channel_variants?.length ? <div><h3 className="mb-2 text-xs font-semibold uppercase text-ink-500">Channel variants</h3><div className="space-y-2">{detail.attrs.channel_variants.map((variant) => <div key={variant.variant_id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 bg-white px-3 py-2 text-xs"><span><strong>{variant.channel}</strong><span className="ml-2 text-ink-400">{variant.variant_status}</span></span>{can("CRM_CAMPAIGN_WRITE") ? <button type="button" onClick={() => openModal("channel_variant", variant)} className="rounded border border-ink-200 px-2 py-1 text-ink-500">Edit</button> : null}</div>)}</div></div> : null}
                {detail.links?.length ? <div><h3 className="mb-2 text-xs font-semibold uppercase text-ink-500">Links</h3><div className="space-y-1 text-xs text-ink-500">{detail.links.map((link) => <p key={link.id}>{link.relation_type}: {link.dst_kind === "info_record" && link.src_kind !== "info_record" ? link.dst_id : link.src_kind === "info_record" ? `${link.dst_kind} ${link.dst_id}` : `${link.src_kind} ${link.src_id}`}</p>)}</div></div> : null}
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-ink-500"><StickyNote className="h-4 w-4" /> Timeline</h3>
                  <Timeline items={timeline} />
                </div>
              </div>
            ) : <p className="text-sm text-ink-400">Select a record to inspect its details and timeline.</p>}
          </aside>
        </div>
      )}

      {modal ? (
        <Modal title={modal === "create" ? `${actions.create} ${tab.label}` : modal.replaceAll("_", " ")} onClose={() => setModal(null)}>
          <form className="space-y-4" onSubmit={submitModal}>
            {modal === "create" ? <FormFields fields={CREATE_FORMS[tab.id] || []} form={form} options={options} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} /> : null}
            {modal === "note" ? <FormFields fields={[["title", "Title", "text"], ["description", "Note", "textarea"]]} form={form} options={options} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} /> : null}
            {modal === "task" ? <FormFields fields={CREATE_FORMS.tasks.filter(([name]) => name !== "service_object_id")} form={form} options={options} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} /> : null}
            {modal === "status" ? <FormFields fields={[["to_status", "Status", "select", statusOptions]]} form={form} options={options} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} /> : null}
            {modal === "convert" ? <FormFields fields={[["opportunity_title", "Opportunity title", "text"], ["customer_agent_id", "Customer id", "text"], ["value", "Value", "number"], ["currency", "Currency", "text"], ["probability", "Probability", "number"], ["expected_close_date", "Expected close", "date"], ["note", "Conversion note", "textarea"]]} form={form} options={options} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} /> : null}
            {modal === "contact" ? <FormFields fields={[["contact_type", "Contact type", "select", ["email", "phone", "whatsapp", "website"]], ["label", "Label", "text"], ["value", "Value", "text"]]} form={form} options={options} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} /> : null}
            {modal === "address" ? <FormFields fields={[["address_type", "Address type", "select", ["main", "billing", "shipping", "site"]], ["label", "Label", "text"], ["line1", "Address line", "text"], ["city", "City", "text"], ["postal_code", "Postal code", "text"], ["country_code", "Country", "text"]]} form={form} options={options} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} /> : null}
            {modal === "bank" ? <FormFields fields={[["account_type", "Account type", "select", ["bank", "mobile_money"]], ["label", "Label", "text"], ["bank_name", "Bank name", "text"], ["account_name", "Account name", "text"], ["account_number", "Account number", "text"], ["currency_code", "Currency", "text"]]} form={form} options={options} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} /> : null}
            {modal === "channel_variant" ? <FormFields fields={[["channel", "Channel", "governed", "CRM_CAMPAIGN_CHANNEL"], ["connection_code", "Connection code", "text"], ["variant_status", "Variant status", "governed", "CRM_CHANNEL_VARIANT_STATUS"], ["caption", "Caption", "textarea"], ["cta", "Call to action", "text"], ["scheduled_at", "Scheduled at", "datetime-local"]]} form={form} options={options} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} /> : null}
            {modal === "signal_link" ? <FormFields fields={[["dst_kind", "Target type", "select", ["agent", "service_object", "material", "info_record"]], ["dst_id", "Target id", "text"], ["relation_type", "Relationship", "select", ["SIGNAL_FOR_SEGMENT", "SIGNAL_FOR_AGENT", "SIGNAL_FOR_CAMPAIGN", "SIGNAL_FOR_LEAD", "SIGNAL_FOR_OPPORTUNITY", "SIGNAL_FOR_PRODUCT", "SIGNAL_FOR_CONTENT"]]]} form={form} options={options} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} /> : null}
            {modal === "signal_promote" ? <FormFields fields={[["service_object_id", "Review object id", "text"], ["task_type", "Task type", "governed", "CRM_TASK_TYPE"], ["title", "Task title", "text"], ["assigned_agent_id", "Assignee id", "text"], ["due_at", "Due at", "datetime-local"], ["description", "Description", "textarea"]]} form={form} options={options} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} /> : null}
            {modal === "edit" ? <FormFields fields={tab.id === "agents" ? CREATE_FORMS.agents : tab.id === "segments" ? CREATE_FORMS.segments : tab.id === "interactions" ? [["subject", "Subject", "text"], ["body_text", "Notes", "textarea"], ["priority", "Priority", "governed", "CRM_PRIORITY"]] : [["title", "Title", "text"], ["owner_agent_id", "Owner agent id", "text"], ["attrs_json", "Attributes", "textarea"]]} form={form} options={options} onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))} /> : null}
            <button disabled={loading} type="submit" className="flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" /> Save
            </button>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
