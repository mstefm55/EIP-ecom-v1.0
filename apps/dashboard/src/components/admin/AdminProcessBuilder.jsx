import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Save,
  CheckCircle2,
  Send,
  Trash2,
  AlertTriangle,
  Zap,
  Route,
  GitMerge,
  Flag,
  Layers,
  UserRound,
  CircleDot
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const MAX_LIST = 200;

const EMPTY_GRAPH = {
  object_type: "",
  initial_node: "",
  nodes: [],
  transitions: [],
};

const DEFAULT_LAYOUT = {
  header: {
    badge: "Process Automation Builder",
    title: "Workflow studio",
    subtitle:
      "Define process graphs, tasks, and bindings. All execution is handled by the core process engine.",
    tabs: {
      builder: "Builder",
      logs: "Logs"
    },
    buttons: {
      new: "New",
      save: "Save",
      saving: "Saving",
      validate: "Validate",
      validating: "Validating",
      publish: "Publish",
      publishing: "Publishing"
    }
  },
  viewToggle: {
    label: "View",
    simple: "Simple",
    advanced: "Advanced",
    helper: "Advanced view shows transitions, templates, and bindings."
  },
  tenant: {
    title: "Tenant scope",
    placeholder: "Search tenant...",
    empty: "No tenants found.",
    helper: "Select a tenant to view or edit its processes.",
    clear: "Clear"
  },
  library: {
    title: "Process Library",
    empty: "No processes yet. Use Add to create the first definition.",
    loading: "Loading process definitions...",
    add: "Add"
  },
  canvas: {
    title: "Builder Canvas",
    empty: "No nodes yet. Add a trigger or step to begin the graph.",
    addNode: "Add Node",
    nodeTypeFallback: "NODE",
    nodeState: {
      terminal: "Terminal",
      active: "Active"
    }
  },
  transitions: {
    title: "Transitions",
    empty: "No transitions yet. Add a transition to connect nodes.",
    add: "Add Transition",
    badgeSuffix: "fx",
    actionFallback: "no-action",
    edgeFallback: "DEFAULT",
    nodeFallback: "?",
    selectPlaceholder: "Select",
    effects: {
      add: "Add Effect",
      empty: "No effects configured.",
      select: "Select effect",
      configPlaceholder: "{\"status\":\"approved\"}"
    }
  },
  logs: {
    title: "Process Logs",
    loading: "Loading process instances...",
    empty: "No process instances yet.",
    fields: {
      started: "Started",
      updated: "Updated"
    }
  },
  definition: {
    title: "Definition",
    fields: {
      code: "Code",
      name: "Name",
      module: "Module",
      version: "Version",
      objectType: "Service Object Type",
      initialNode: "Initial Node",
      initialNodePlaceholder: "Select node",
      active: "Active definition"
    }
  },
  nodeInspector: {
    title: "Node Inspector",
    empty: "Select a node to edit details.",
    remove: "Remove",
    fields: {
      id: "Node Id",
      type: "Type",
      typePlaceholder: "Select type",
      label: "Label",
      terminal: "Terminal node",
      templates: "Task Templates (one per line)"
    }
  },
  nodePalette: {
    title: "Node Palette",
    help: "Click a node type to add it to the canvas.",
    searchPlaceholder: "Search nodes...",
    empty: "No matches."
  },
  transitionInspector: {
    title: "Transition Inspector",
    empty: "Select a transition to edit details.",
    remove: "Remove",
    fields: {
      from: "From",
      to: "To",
      selectPlaceholder: "Select",
      action: "Action",
      edge: "Edge Type",
      condition: "Condition",
      effects: "Effects"
    }
  },
  templates: {
    title: "Task Templates",
    subtitle: "Templates linked to this process.",
    empty: "No templates yet.",
    add: "Add",
    save: "Save",
    deactivate: "Deactivate",
    remove: "Remove",
    itemFallback: "New task",
    fields: {
      taskTypePlaceholder: "Task type",
      titlePlaceholder: "Title",
      descriptionPlaceholder: "Description",
      serviceObjectTypePlaceholder: "Service object type",
      sortOrderPlaceholder: "Sort order",
      allowedActions: "Allowed Actions",
      completionAction: "Completion Action",
      completionActionPlaceholder: "Select action",
      attrsPlaceholder: "{\"ui\": {\"layout\": \"compact\"}}",
      activeLabel: "Active"
    }
  },
  bindings: {
    title: "Process Bindings",
    subtitle: "Bindings map service objects to processes.",
    empty: "No bindings yet.",
    add: "Add",
    save: "Save",
    deactivate: "Deactivate",
    remove: "Remove",
    itemFallback: "Binding",
    taskPrefix: "Task",
    allTasks: "All tasks",
    fields: {
      serviceObjectTypePlaceholder: "Service object type",
      taskTypePlaceholder: "Task type (optional)",
      priorityPlaceholder: "Priority",
      activeLabel: "Active",
      attrsPlaceholder: "{\"notes\":\"default binding\"}"
    }
  }
};

function mergeLayout(base, override) {
  if (!override || typeof override !== "object") return base;
  const output = Array.isArray(base) ? [...base] : { ...base };
  Object.keys(override).forEach((key) => {
    const baseValue = base ? base[key] : undefined;
    const overrideValue = override[key];
    if (
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue) &&
      overrideValue &&
      typeof overrideValue === "object" &&
      !Array.isArray(overrideValue)
    ) {
      output[key] = mergeLayout(baseValue, overrideValue);
    } else {
      output[key] = overrideValue;
    }
  });
  return output;
}

const NODE_ICON_MAP = {
  TRIGGER: Zap,
  STEP: Layers,
  HUMAN_TASK: UserRound,
  ROUTER: Route,
  JOIN: GitMerge,
  TERMINAL: Flag
};

const NODE_COLOR_MAP = {
  TRIGGER: "bg-sky-100 text-sky-700",
  STEP: "bg-indigo-100 text-indigo-700",
  HUMAN_TASK: "bg-amber-100 text-amber-700",
  ROUTER: "bg-purple-100 text-purple-700",
  JOIN: "bg-emerald-100 text-emerald-700",
  TERMINAL: "bg-slate-200 text-slate-700"
};

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value) {
  const trimmed = normalizeText(value);
  return trimmed.length ? trimmed : "";
}

function formatTenantLabel(tenant) {
  if (!tenant) return "";
  const name = tenant.name || "Tenant";
  const code = tenant.code || tenant.id;
  return `${name} - ${code}`;
}

function normalizeList(text) {
  if (!text) return [];
  return text
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseJsonText(text) {
  if (!text) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return { ok: false, value: null };
  }
}

function buildQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    query.set(key, String(value));
  });
  return query.toString();
}

function buildNewDef() {
  return {
    id: null,
    code: "",
    name: "",
    version: 1,
    module: "core",
    object_type: "",
    is_active: true,
    is_published: false,
    attrs: {},
  };
}

function toGraphForm(graph) {
  const raw = graph && typeof graph === "object" ? graph : {};
  const rawNodes = raw.nodes;
  const nodes = [];

  if (Array.isArray(rawNodes)) {
    rawNodes.forEach((node) => {
      if (!node || typeof node !== "object") return;
      const id = normalizeOptionalText(node.id || node.key || node.name);
      if (!id) return;
      const onEnter = node.on_enter || node.onEnter || {};
      const templateTypes = Array.isArray(onEnter.task_template_types)
        ? onEnter.task_template_types
        : [];
      nodes.push({
        id,
        type: normalizeOptionalText(node.type || node.node_type),
        label: normalizeOptionalText(node.label || node.name || node.title),
        is_terminal: Boolean(
          node.is_terminal || node.isTerminal || node.terminal
        ),
        task_templates_text: templateTypes.join("\n"),
        raw: node,
      });
    });
  } else if (rawNodes && typeof rawNodes === "object") {
    Object.entries(rawNodes).forEach(([key, node]) => {
      if (!node || typeof node !== "object") return;
      const id = normalizeOptionalText(node.id || key);
      if (!id) return;
      const onEnter = node.on_enter || node.onEnter || {};
      const templateTypes = Array.isArray(onEnter.task_template_types)
        ? onEnter.task_template_types
        : [];
      nodes.push({
        id,
        type: normalizeOptionalText(node.type || node.node_type),
        label: normalizeOptionalText(node.label || node.name || node.title),
        is_terminal: Boolean(
          node.is_terminal || node.isTerminal || node.terminal
        ),
        task_templates_text: templateTypes.join("\n"),
        raw: node,
      });
    });
  }

  const transitions = Array.isArray(raw.transitions)
    ? raw.transitions.map((transition, index) => {
        const effects = Array.isArray(transition?.effects)
          ? transition.effects
          : [];
        return {
          id: `t-${index}-${Date.now()}`,
          from: normalizeOptionalText(transition?.from),
          to: normalizeOptionalText(transition?.to || transition?.target),
          action: normalizeOptionalText(transition?.action),
          edge_type: normalizeOptionalText(
            transition?.edge_type || transition?.edgeType || "DEFAULT"
          ),
          condition: normalizeOptionalText(transition?.condition || ""),
          effects: effects.map((effect, effIndex) => {
            const { type, ...rest } = effect || {};
            const configText = Object.keys(rest || {}).length
              ? JSON.stringify(rest, null, 2)
              : "";
            return {
              id: `e-${index}-${effIndex}-${Date.now()}`,
              type: normalizeOptionalText(type),
              configText,
            };
          }),
          raw: transition,
        };
      })
    : [];

  return {
    object_type: normalizeOptionalText(raw.object_type),
    initial_node: normalizeOptionalText(raw.initial_node || raw.initialNode),
    nodes,
    transitions,
  };
}

function fromGraphForm(form, defObjectType) {
  const graph = {
    object_type: defObjectType || form.object_type || "",
    initial_node: form.initial_node || "",
    nodes: [],
    transitions: [],
  };

  form.nodes.forEach((node) => {
    const raw = node.raw && typeof node.raw === "object" ? node.raw : {};
    const onEnterRaw = raw.on_enter || raw.onEnter;
    const onEnter =
      onEnterRaw && typeof onEnterRaw === "object" ? { ...onEnterRaw } : {};

    const taskTypes = normalizeList(node.task_templates_text);
    if (taskTypes.length) {
      onEnter.task_template_types = taskTypes;
    } else {
      delete onEnter.task_template_types;
    }

    const merged = {
      ...raw,
      id: normalizeOptionalText(node.id),
      type: normalizeOptionalText(node.type),
      label: normalizeOptionalText(node.label),
      is_terminal: Boolean(node.is_terminal),
    };

    if (Object.keys(onEnter).length) {
      merged.on_enter = onEnter;
    } else {
      delete merged.on_enter;
    }

    graph.nodes.push(merged);
  });

  form.transitions.forEach((transition) => {
    const raw = transition.raw && typeof transition.raw === "object" ? transition.raw : {};
    const effects = transition.effects.map((effect) => {
      const parsed = parseJsonText(effect.configText);
      return {
        type: normalizeOptionalText(effect.type),
        ...(parsed.ok ? parsed.value : {}),
      };
    });

    const merged = {
      ...raw,
      from: normalizeOptionalText(transition.from),
      to: normalizeOptionalText(transition.to),
      action: normalizeOptionalText(transition.action),
      edge_type: normalizeOptionalText(transition.edge_type || "DEFAULT"),
      effects,
    };

    if (transition.condition) {
      merged.condition = transition.condition;
    }

    graph.transitions.push(merged);
  });

  return graph;
}

function mapTemplateFromApi(item) {
  const attrs = item.attrs && typeof item.attrs === "object" ? item.attrs : {};
  return {
    id: item.id,
    isNew: false,
    process_def_id: item.process_def_id,
    service_object_type: normalizeOptionalText(item.service_object_type),
    task_type: normalizeOptionalText(item.task_type),
    title: normalizeOptionalText(item.title),
    description: normalizeOptionalText(item.description),
    sort_order: Number.isFinite(item.sort_order) ? item.sort_order : 100,
    is_active: item.is_active !== false,
    allowed_actions: Array.isArray(attrs.allowed_actions) ? attrs.allowed_actions : [],
    completion_action: normalizeOptionalText(attrs.completion_action),
    attrs_text: Object.keys(attrs).length ? JSON.stringify(attrs, null, 2) : "",
  };
}

function mapBindingFromApi(item) {
  return {
    id: item.id,
    isNew: false,
    service_object_type: normalizeOptionalText(item.service_object_type),
    process_def_id: normalizeOptionalText(item.process_def_id),
    task_type: normalizeOptionalText(item.task_type),
    priority: Number.isFinite(item.priority) ? item.priority : 100,
    is_active: item.is_active !== false,
    attrs_text: item.attrs && typeof item.attrs === "object" ? JSON.stringify(item.attrs, null, 2) : "",
  };
}

export default function AdminProcessBuilder({ node }) {
  const layout = useMemo(
    () => mergeLayout(DEFAULT_LAYOUT, node?.props?.layout),
    [node?.props?.layout]
  );
  const initialAdvanced =
    node?.props?.view_mode === "simple"
      ? false
      : node?.props?.view_mode === "advanced"
        ? true
        : layout.viewToggle?.defaultAdvanced ?? true;
  const [showAdvanced, setShowAdvanced] = useState(initialAdvanced);
  const [activeView, setActiveView] = useState("builder");
  const [nodeQuery, setNodeQuery] = useState("");
  const [tenantOptions, setTenantOptions] = useState([]);
  const [tenantQuery, setTenantQuery] = useState("");
  const [tenantInput, setTenantInput] = useState("");
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [defs, setDefs] = useState([]);
  const [selectedDefId, setSelectedDefId] = useState(null);
  const [defDraft, setDefDraft] = useState(buildNewDef());
  const [graphDraft, setGraphDraft] = useState({ ...EMPTY_GRAPH });
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [instances, setInstances] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [taxonomy, setTaxonomy] = useState({});
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [loadingDefs, setLoadingDefs] = useState(false);
  const [savingDef, setSavingDef] = useState(false);
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedBindingId, setSelectedBindingId] = useState(null);
  const [rightPaneTab, setRightPaneTab] = useState("definition");
  const tenantId = selectedTenant?.id || "";
  const tenantDisplay = tenantMenuOpen
    ? tenantInput
    : tenantInput || (selectedTenant ? formatTenantLabel(selectedTenant) : "");
  const tenantPayload = tenantId ? { tenant_id: tenantId } : {};

  const nodeMetaByCode = useMemo(() => {
    const map = new Map();
    (taxonomy.PROCESS_NODE_TYPE || []).forEach((item) => {
      map.set(item.code, { label: item.label, attrs: item.attrs || {} });
    });
    return map;
  }, [taxonomy]);

  const nodeOptions = useMemo(
    () =>
      (taxonomy.PROCESS_NODE_TYPE || [])
        .map((item) => ({ value: item.code, label: item.label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [taxonomy]
  );
  const filteredNodeOptions = useMemo(() => {
    const query = nodeQuery.trim().toLowerCase();
    if (!query) return nodeOptions;
    return nodeOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [nodeOptions, nodeQuery]);

  const defsById = useMemo(() => {
    const map = new Map();
    defs.forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [defs]);

  const edgeOptions = useMemo(
    () =>
      (taxonomy.PROCESS_EDGE_TYPE || [])
        .map((item) => ({ value: item.code, label: item.label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [taxonomy]
  );
  const actionOptions = useMemo(
    () =>
      (taxonomy.PROCESS_ACTION || [])
        .map((item) => ({ value: item.code, label: item.label || item.code }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [taxonomy]
  );

  const effectOptions = useMemo(
    () =>
      (taxonomy.PROCESS_EFFECT_TYPE || [])
        .filter((item) => !(item.attrs && item.attrs.deprecated))
        .map((item) => ({ value: item.code, label: item.label })),
    [taxonomy]
  );

  const taskActionOptions = useMemo(
    () =>
      (taxonomy.TASK_ACTION || [])
        .map((item) => ({ value: item.code, label: item.label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [taxonomy]
  );

  const isNewDef = !defDraft.id;

  const toFriendlyError = (err, fallback) => {
    const message = err?.message || "";
    const match = message.match(/API \\d+: (.*)$/);
    let payload = null;
    if (match) {
      try {
        payload = JSON.parse(match[1]);
      } catch {
        payload = null;
      }
    }
    if (payload?.error === "STEP_UP_REQUIRED") {
      return "Step-up required. Use profile menu to verify OTP/TOTP.";
    }
    if (payload?.error === "FORBIDDEN") {
      return "Permission missing. Ask an administrator to grant process-definition access, then sign in again.";
    }
    if (payload?.error === "TENANT_ACCESS_REQUIRED") {
      return "Tenant access required. Add this tenant to your admin portfolio or request access.";
    }
    if (payload?.error === "UNAUTHENTICATED") {
      return "Session expired. Please log in again.";
    }
    if (payload?.error === "BOOTSTRAP_RESTRICTED") {
      return "Bootstrap in progress. Complete bootstrap before using the builder.";
    }
    if (message.includes("Failed to fetch")) {
      return "Service is currently unavailable. Please try again in a moment.";
    }
    return payload?.error || fallback || message || "Request failed.";
  };

  const loadDefs = async () => {
    setLoadingDefs(true);
    try {
      const query = buildQuery({ limit: MAX_LIST, tenant_id: tenantId });
      const result = await apiFetch(`/api/eip/process/defs?${query}`);
      setDefs(result.items || []);
    } catch (err) {
      setError(toFriendlyError(err, "Failed to load process definitions."));
    } finally {
      setLoadingDefs(false);
    }
  };

  const loadTaxonomy = async () => {
    try {
      const query = buildQuery({ tenant_id: tenantId });
      const result = await apiFetch(`/api/eip/process/taxonomy?${query}`);
      setTaxonomy(result.lists || {});
    } catch (err) {
      setError(toFriendlyError(err, "Failed to load taxonomy."));
    }
  };

  const loadInstances = async () => {
    setLoadingInstances(true);
    try {
      const query = buildQuery({ limit: MAX_LIST, tenant_id: tenantId });
      const result = await apiFetch(`/api/eip/process/instances?${query}`);
      setInstances(result.items || []);
    } catch (err) {
      setError(toFriendlyError(err, "Failed to load process instances."));
    } finally {
      setLoadingInstances(false);
    }
  };

  const loadDefDetails = async (defId) => {
    if (!defId) return;
    try {
      const defQuery = buildQuery({ tenant_id: tenantId });
      const defResult = await apiFetch(`/api/eip/process/defs/${defId}?${defQuery}`);
      const item = defResult.item || {};
      const attrs = item.attrs && typeof item.attrs === "object" ? item.attrs : {};
      const graph = item.graph || {};
      setDefDraft({
        id: item.id,
        code: normalizeOptionalText(item.code),
        name: normalizeOptionalText(item.name),
        version: item.version || 1,
        module: normalizeOptionalText(attrs.module),
        object_type: normalizeOptionalText(graph.object_type || attrs.object_type),
        is_active: item.is_active !== false,
        is_published: attrs.is_published === true,
        attrs,
      });
      setGraphDraft(toGraphForm(graph));

      const templateQuery = buildQuery({
        process_def_id: defId,
        limit: MAX_LIST,
        tenant_id: tenantId
      });
      const templateResult = await apiFetch(`/api/eip/process/task-templates?${templateQuery}`);
      setTaskTemplates((templateResult.items || []).map(mapTemplateFromApi));

      const bindingQuery = buildQuery({
        process_def_id: defId,
        limit: MAX_LIST,
        tenant_id: tenantId
      });
      const bindingResult = await apiFetch(`/api/eip/process/bindings?${bindingQuery}`);
      setBindings((bindingResult.items || []).map(mapBindingFromApi));
    } catch (err) {
      setError(toFriendlyError(err, "Failed to load process definition."));
    }
  };

  const loadTenants = async (query) => {
    setTenantLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      const result = await apiFetch(`/api/eip/admin/portfolios/tenants?${params.toString()}`);
      setTenantOptions(result.tenants || []);
    } catch (err) {
      setTenantOptions([]);
    } finally {
      setTenantLoading(false);
    }
  };

  const handleTenantPick = (tenant) => {
    if (!tenant) return;
    setSelectedTenant(tenant);
    setTenantInput(formatTenantLabel(tenant));
    setTenantQuery("");
    setTenantMenuOpen(false);
  };

  const handleTenantClear = () => {
    setSelectedTenant(null);
    setTenantInput("");
    setTenantQuery("");
    setTenantMenuOpen(false);
  };

  useEffect(() => {
    loadTaxonomy();
    loadDefs();
  }, [tenantId]);

  useEffect(() => {
    setSelectedDefId(null);
    setDefs([]);
    setInstances([]);
    setError(null);
    setStatus(null);
  }, [tenantId]);

  useEffect(() => {
    if (activeView === "logs") {
      loadInstances();
    }
  }, [activeView, tenantId]);

  useEffect(() => {
    if (!showAdvanced && activeView === "logs") {
      setActiveView("builder");
    }
  }, [showAdvanced, activeView]);

  useEffect(() => {
    loadTenants("");
  }, []);

  useEffect(() => {
    if (!tenantMenuOpen) return undefined;
    const handle = setTimeout(() => {
      loadTenants(tenantQuery.trim());
    }, 200);
    return () => clearTimeout(handle);
  }, [tenantMenuOpen, tenantQuery]);

  useEffect(() => {
    if (selectedDefId) {
      loadDefDetails(selectedDefId);
      return;
    }
    setDefDraft(buildNewDef());
    setGraphDraft({ ...EMPTY_GRAPH });
    setTaskTemplates([]);
    setBindings([]);
  }, [selectedDefId]);

  useEffect(() => {
    if (!graphDraft.nodes.length) {
      setSelectedNodeId(null);
      return;
    }
    if (!selectedNodeId || !graphDraft.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(graphDraft.nodes[0].id);
    }
  }, [graphDraft.nodes, selectedNodeId]);

  useEffect(() => {
    if (!graphDraft.transitions.length) {
      setSelectedTransitionId(null);
      return;
    }
    if (
      !selectedTransitionId ||
      !graphDraft.transitions.some((transition) => transition.id === selectedTransitionId)
    ) {
      setSelectedTransitionId(graphDraft.transitions[0].id);
    }
  }, [graphDraft.transitions, selectedTransitionId]);

  useEffect(() => {
    if (!taskTemplates.length) {
      setSelectedTemplateId(null);
      return;
    }
    if (!selectedTemplateId || !taskTemplates.some((item) => item.id === selectedTemplateId)) {
      setSelectedTemplateId(taskTemplates[0].id);
    }
  }, [taskTemplates, selectedTemplateId]);

  useEffect(() => {
    if (!bindings.length) {
      setSelectedBindingId(null);
      return;
    }
    if (!selectedBindingId || !bindings.some((item) => item.id === selectedBindingId)) {
      setSelectedBindingId(bindings[0].id);
    }
  }, [bindings, selectedBindingId]);

  const handleCreateDef = () => {
    setSelectedDefId(null);
    setDefDraft(buildNewDef());
    setGraphDraft({ ...EMPTY_GRAPH });
    setTaskTemplates([]);
    setBindings([]);
    setStatus(null);
    setError(null);
  };

  const handleSaveDef = async () => {
    setError(null);
    setStatus(null);

    if (!normalizeOptionalText(defDraft.code) || !normalizeOptionalText(defDraft.name)) {
      setError("Process code and name are required.");
      return;
    }

    const graph = fromGraphForm(graphDraft, defDraft.object_type);
    const invalidEffect = graphDraft.transitions.find((transition) =>
      transition.effects.some((effect) => !parseJsonText(effect.configText).ok)
    );
    if (invalidEffect) {
      setError("One or more effect JSON blocks are invalid.");
      return;
    }

    setSavingDef(true);
    try {
      if (isNewDef) {
        const created = await apiFetch("/api/eip/process/defs", {
          method: "POST",
          body: {
            code: defDraft.code,
            name: defDraft.name,
            version: defDraft.version,
            module: defDraft.module,
            object_type: defDraft.object_type,
            is_active: defDraft.is_active,
            is_published: defDraft.is_published,
            graph,
            ...tenantPayload,
          },
        });
        const item = created.item;
        if (item?.id) {
          setSelectedDefId(item.id);
          await loadDefs();
        }
        setStatus("Process definition created.");
      } else {
        await apiFetch(`/api/eip/process/defs/${defDraft.id}`, {
          method: "PATCH",
          body: {
            name: defDraft.name,
            module: defDraft.module,
            object_type: defDraft.object_type,
            is_active: defDraft.is_active,
            is_published: defDraft.is_published,
            graph,
            ...tenantPayload,
          },
        });
        await loadDefs();
        setStatus("Process definition saved.");
      }
    } catch (err) {
      setError(toFriendlyError(err, "Save failed."));
    } finally {
      setSavingDef(false);
    }
  };

  const handleValidate = async () => {
    setError(null);
    setStatus(null);
    if (!defDraft.id) {
      setError("Save the process definition before validation.");
      return;
    }
    setValidating(true);
    try {
      const query = buildQuery({ tenant_id: tenantId });
      const result = await apiFetch(`/api/eip/process/defs/${defDraft.id}/validate?${query}`, {
        method: "POST",
        body: {},
      });
      if (result.valid) {
        setStatus("Validation passed.");
      } else {
        setError(`Validation failed: ${result.errors?.join(", ") || "Unknown error"}`);
      }
    } catch (err) {
      setError(toFriendlyError(err, "Validation failed."));
    } finally {
      setValidating(false);
    }
  };

  const handlePublish = async () => {
    setError(null);
    setStatus(null);
    if (!defDraft.id) {
      setError("Save the process definition before publishing.");
      return;
    }
    setPublishing(true);
    try {
      const query = buildQuery({ tenant_id: tenantId });
      await apiFetch(`/api/eip/process/defs/${defDraft.id}/publish?${query}`, {
        method: "POST",
        body: {},
      });
      setStatus("Process definition published.");
      await loadDefDetails(defDraft.id);
    } catch (err) {
      setError(toFriendlyError(err, "Publish failed."));
    } finally {
      setPublishing(false);
    }
  };

  const renameNode = (id, nextId) => {
    const newId = normalizeOptionalText(nextId);
    if (!newId || newId === id) return;
    setGraphDraft((prev) => ({
      ...prev,
      initial_node: prev.initial_node === id ? newId : prev.initial_node,
      nodes: prev.nodes.map((node) => (node.id === id ? { ...node, id: newId } : node)),
      transitions: prev.transitions.map((transition) => ({
        ...transition,
        from: transition.from === id ? newId : transition.from,
        to: transition.to === id ? newId : transition.to
      }))
    }));
    setSelectedNodeId(newId);
  };

  const updateNode = (id, patch) => {
    setGraphDraft((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === id ? { ...node, ...patch } : node
      ),
    }));
  };

  const addNode = (typeOverride) => {
    const resolvedType = typeof typeOverride === "string" ? typeOverride : "";
    const idBase = `node-${graphDraft.nodes.length + 1}`;
    const next = {
      id: idBase,
      type: resolvedType || nodeOptions[0]?.value || "",
      label: "",
      is_terminal: false,
      task_templates_text: "",
      raw: {},
    };
    setGraphDraft((prev) => ({ ...prev, nodes: [...prev.nodes, next] }));
    setSelectedNodeId(idBase);
  };

  const removeNode = (id) => {
    setGraphDraft((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((node) => node.id !== id),
      transitions: prev.transitions.filter(
        (transition) => transition.from !== id && transition.to !== id
      ),
    }));
  };

  const updateTransition = (id, patch) => {
    setGraphDraft((prev) => ({
      ...prev,
      transitions: prev.transitions.map((transition) =>
        transition.id === id ? { ...transition, ...patch } : transition
      ),
    }));
  };

  const addTransition = () => {
    const next = {
      id: `t-${Date.now()}`,
      from: "",
      to: "",
      action: "",
      edge_type: edgeOptions[0]?.value || "DEFAULT",
      condition: "",
      effects: [],
      raw: {},
    };
    setGraphDraft((prev) => ({
      ...prev,
      transitions: [...prev.transitions, next],
    }));
    setSelectedTransitionId(next.id);
  };

  const removeTransition = (id) => {
    setGraphDraft((prev) => ({
      ...prev,
      transitions: prev.transitions.filter((transition) => transition.id !== id),
    }));
  };

  const addEffect = (transitionId) => {
    setGraphDraft((prev) => ({
      ...prev,
      transitions: prev.transitions.map((transition) => {
        if (transition.id !== transitionId) return transition;
        const nextEffect = {
          id: `e-${Date.now()}`,
          type: effectOptions[0]?.value || "",
          configText: "",
        };
        return {
          ...transition,
          effects: [...transition.effects, nextEffect],
        };
      }),
    }));
  };

  const updateEffect = (transitionId, effectId, patch) => {
    setGraphDraft((prev) => ({
      ...prev,
      transitions: prev.transitions.map((transition) => {
        if (transition.id !== transitionId) return transition;
        return {
          ...transition,
          effects: transition.effects.map((effect) =>
            effect.id === effectId ? { ...effect, ...patch } : effect
          ),
        };
      }),
    }));
  };

  const removeEffect = (transitionId, effectId) => {
    setGraphDraft((prev) => ({
      ...prev,
      transitions: prev.transitions.map((transition) => {
        if (transition.id !== transitionId) return transition;
        return {
          ...transition,
          effects: transition.effects.filter((effect) => effect.id !== effectId),
        };
      }),
    }));
  };

  const updateTemplate = (id, patch) => {
    setTaskTemplates((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const addTemplate = () => {
    if (!defDraft.id) {
      setError("Save the process definition before adding task templates.");
      return;
    }
    const next = {
      id: `tmp-${Date.now()}`,
      isNew: true,
      process_def_id: defDraft.id,
      service_object_type: defDraft.object_type || "",
      task_type: "",
      title: "",
      description: "",
      sort_order: 100,
      is_active: true,
      allowed_actions: [],
      completion_action: "",
      attrs_text: "",
    };
    setTaskTemplates((prev) => [...prev, next]);
    setSelectedTemplateId(next.id);
  };

  const saveTemplate = async (template) => {
    setError(null);
    const attrsParsed = parseJsonText(template.attrs_text);
    if (!attrsParsed.ok) {
      setError(`Task template ${template.task_type || ""} has invalid attrs JSON.`);
      return;
    }
    const mergedAttrs = {
      ...attrsParsed.value,
      allowed_actions: template.allowed_actions,
      completion_action: template.completion_action,
    };
    try {
      if (template.isNew) {
        const result = await apiFetch("/api/eip/process/task-templates", {
          method: "POST",
          body: {
            process_def_id: template.process_def_id,
            service_object_type: template.service_object_type || null,
            task_type: template.task_type,
            title: template.title,
            description: template.description,
            sort_order: template.sort_order,
            is_active: template.is_active,
            attrs: mergedAttrs,
            ...tenantPayload,
          },
        });
        setTaskTemplates((prev) =>
          prev.map((item) =>
            item.id === template.id ? mapTemplateFromApi(result.item) : item
          )
        );
      } else {
        await apiFetch(`/api/eip/process/task-templates/${template.id}`, {
          method: "PATCH",
          body: {
            service_object_type: template.service_object_type || null,
            task_type: template.task_type,
            title: template.title,
            description: template.description,
            sort_order: template.sort_order,
            is_active: template.is_active,
            attrs: mergedAttrs,
            ...tenantPayload,
          },
        });
      }
      setStatus("Task template saved.");
    } catch (err) {
      setError(toFriendlyError(err, "Task template save failed."));
    }
  };

  const removeTemplate = async (template) => {
    if (template.isNew) {
      setTaskTemplates((prev) => prev.filter((item) => item.id !== template.id));
      return;
    }
    await saveTemplate({ ...template, is_active: false });
  };

  const updateBinding = (id, patch) => {
    setBindings((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const addBinding = () => {
    if (!defDraft.id) {
      setError("Save the process definition before adding bindings.");
      return;
    }
    const next = {
      id: `binding-${Date.now()}`,
      isNew: true,
      service_object_type: defDraft.object_type || "",
      process_def_id: defDraft.id,
      task_type: "",
      priority: 100,
      is_active: true,
      attrs_text: "",
    };
    setBindings((prev) => [...prev, next]);
    setSelectedBindingId(next.id);
  };

  const saveBinding = async (binding) => {
    setError(null);
    const attrsParsed = parseJsonText(binding.attrs_text);
    if (!attrsParsed.ok) {
      setError("Binding attrs JSON is invalid.");
      return;
    }
    try {
      if (binding.isNew) {
        const result = await apiFetch("/api/eip/process/bindings", {
          method: "POST",
          body: {
            service_object_type: binding.service_object_type,
            process_def_id: binding.process_def_id,
            task_type: binding.task_type || null,
            priority: binding.priority,
            is_active: binding.is_active,
            attrs: attrsParsed.value,
            ...tenantPayload,
          },
        });
        setBindings((prev) =>
          prev.map((item) =>
            item.id === binding.id ? mapBindingFromApi(result.item) : item
          )
        );
      } else {
        await apiFetch(`/api/eip/process/bindings/${binding.id}`, {
          method: "PATCH",
          body: {
            service_object_type: binding.service_object_type,
            process_def_id: binding.process_def_id,
            task_type: binding.task_type || null,
            priority: binding.priority,
            is_active: binding.is_active,
            attrs: attrsParsed.value,
            ...tenantPayload,
          },
        });
      }
      setStatus("Binding saved.");
    } catch (err) {
      setError(toFriendlyError(err, "Binding save failed."));
    }
  };

  const removeBinding = async (binding) => {
    if (binding.isNew) {
      setBindings((prev) => prev.filter((item) => item.id !== binding.id));
      return;
    }
    await saveBinding({ ...binding, is_active: false });
  };

  const nodeIdOptions = useMemo(() => graphDraft.nodes.map((node) => node.id), [graphDraft.nodes]);

  const selectedNode = graphDraft.nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedTransition =
    graphDraft.transitions.find((transition) => transition.id === selectedTransitionId) || null;
  const selectedTemplate =
    taskTemplates.find((item) => item.id === selectedTemplateId) || null;
  const selectedBinding =
    bindings.find((item) => item.id === selectedBindingId) || null;
  const selectedNodeTasks = selectedNode
    ? normalizeList(selectedNode.task_templates_text)
    : [];
  const outgoingTransitions = selectedNode
    ? graphDraft.transitions.filter((transition) => transition.from === selectedNode.id)
    : [];
  const nextNodeIds = outgoingTransitions
    .map((transition) => transition.to)
    .filter(Boolean);
  const nextNodes = nextNodeIds
    .map((nodeId) => graphDraft.nodes.find((node) => node.id === nodeId))
    .filter(Boolean);

  const renderNodeIcon = (type) => {
    const key = String(type || "").toUpperCase();
    const Icon = NODE_ICON_MAP[key] || CircleDot;
    const tone = NODE_COLOR_MAP[key] || "bg-slate-100 text-slate-600";
    return { Icon, tone };
  };
  const isLogsView = activeView === "logs";
  const formatDate = (value) => (value ? new Date(value).toLocaleString() : "-");
  const instanceRows = useMemo(
    () =>
      instances.map((item) => {
        const def = defsById.get(item.process_def_id) || {};
        return {
          id: item.id,
          processCode: def.code || item.process_def_id,
          processName: def.name || "Process",
          status: item.status || "unknown",
          startedAt: formatDate(item.started_at || item.created_at),
          updatedAt: formatDate(item.updated_at),
        };
      }),
    [instances, defsById]
  );

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.35em] text-ink-400">
              {layout.header.badge}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink-900">{layout.header.title}</h2>
            <p className="mt-2 text-xs text-ink-500">
              {layout.header.subtitle}
            </p>
            <div className="mt-4">
              <p className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                {layout.tenant.title}
              </p>
              {layout.tenant.helper ? (
                <p className="mt-1 text-xs text-ink-500">{layout.tenant.helper}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="relative w-full max-w-sm">
                  <input
                    value={tenantDisplay}
                    onChange={(event) => {
                      setTenantInput(event.target.value);
                      setTenantQuery(event.target.value);
                      setSelectedTenant(null);
                      setTenantMenuOpen(true);
                    }}
                    onFocus={() => setTenantMenuOpen(true)}
                    onBlur={() => setTimeout(() => setTenantMenuOpen(false), 150)}
                    placeholder={layout.tenant.placeholder}
                    className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                  />
                  {tenantMenuOpen ? (
                    <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-ink-100 bg-white p-1 shadow-lg">
                      {tenantLoading ? (
                        <div className="px-3 py-2 text-xs text-ink-500">Loading...</div>
                      ) : null}
                      {!tenantLoading && tenantOptions.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-ink-500">{layout.tenant.empty}</div>
                      ) : null}
                      {tenantOptions.map((tenant) => (
                        <button
                          type="button"
                          key={tenant.id}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleTenantPick(tenant);
                          }}
                          onClick={() => handleTenantPick(tenant)}
                          className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-xs text-ink-700 hover:bg-ink-50"
                        >
                          <span className="font-semibold">
                            {tenant.name || tenant.code || tenant.id}
                          </span>
                          <span className="text-[0.65rem] text-ink-400">
                            {tenant.code}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={handleTenantClear}
                  className="rounded-full border border-ink-100 bg-white px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-600"
                >
                  {layout.tenant.clear}
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-full border border-ink-100 bg-white/90 p-1 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-500 shadow-soft">
              <button
                type="button"
                onClick={() => setShowAdvanced(false)}
                className={`rounded-full px-3 py-1 ${showAdvanced ? "text-ink-500" : "bg-ink-900 text-white"}`}
              >
                {layout.viewToggle.simple}
              </button>
              <button
                type="button"
                onClick={() => setShowAdvanced(true)}
                className={`rounded-full px-3 py-1 ${showAdvanced ? "bg-ink-900 text-white" : "text-ink-500"}`}
              >
                {layout.viewToggle.advanced}
              </button>
            </div>
            {showAdvanced ? (
              <>
                <button
                  type="button"
                  onClick={handleCreateDef}
                  className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-ink-600 shadow-soft hover:bg-white"
                >
                  <Plus className="h-4 w-4" />
                  {layout.header.buttons.new}
                </button>
                <button
                  type="button"
                  onClick={handleSaveDef}
                  disabled={savingDef}
                  className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white shadow-glow disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {savingDef ? layout.header.buttons.saving : layout.header.buttons.save}
                </button>
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={validating || !defDraft.id}
                  className="inline-flex items-center gap-2 rounded-full border border-ink-200/70 bg-white px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-ink-600 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {validating ? layout.header.buttons.validating : layout.header.buttons.validate}
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishing || !defDraft.id}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-brand-600 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white shadow-glow disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {publishing ? layout.header.buttons.publishing : layout.header.buttons.publish}
                </button>
              </>
            ) : null}
          </div>
        </div>
        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        ) : null}
        {status ? (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
            {status}
          </div>
        ) : null}
        {layout.header.tabs ? (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {["builder", "logs"]
              .filter((tabKey) => showAdvanced || tabKey === "builder")
              .map((tabKey) => {
              const label = layout.header.tabs[tabKey];
              if (!label) return null;
              const active = activeView === tabKey;
              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setActiveView(tabKey)}
                  className={`rounded-full border px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] ${
                    active
                      ? "border-ink-900 bg-ink-900 text-white shadow-glow"
                      : "border-ink-100 bg-white/80 text-ink-600 hover:bg-white"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div
        className={`grid items-start gap-6 ${
          isLogsView
            ? "lg:grid-cols-[280px_minmax(0,1fr)]"
            : "lg:grid-cols-[280px_minmax(0,1fr)_360px]"
        }`}
      >
        <div className="glass-panel p-4 h-full min-h-[620px] flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-900">{layout.library.title}</h3>
            <button
              type="button"
              onClick={handleCreateDef}
              className="rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-500"
            >
              {layout.library.add}
            </button>
          </div>
          {layout.library.help ? (
            <p className="mt-2 text-xs text-ink-500">{layout.library.help}</p>
          ) : null}
          <div className="mt-4 space-y-2 overflow-y-auto pr-1 flex-1 min-h-0">
            {loadingDefs ? (
              <div className="rounded-2xl border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-500">
                {layout.library.loading}
              </div>
            ) : null}
            {!loadingDefs && defs.length === 0 ? (
              <div className="rounded-2xl border border-ink-100 bg-ink-50 px-3 py-3 text-xs text-ink-500">
                {layout.library.empty}
              </div>
            ) : null}
            {defs.map((item) => {
              const active = item.id === defDraft.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedDefId(item.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left text-xs transition ${
                    active
                      ? "border-ink-900 bg-ink-900 text-white shadow-glow"
                      : "border-ink-100 bg-white/80 text-ink-700 hover:bg-white"
                  }`}
                >
                  <p className="text-[0.6rem] uppercase tracking-[0.3em] opacity-70">
                    {item.code}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{item.name}</p>
                  <p className="mt-1 text-[0.65rem] opacity-70">
                    v{item.version} {item.graph?.object_type ? `- ${item.graph.object_type}` : ""}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
        {isLogsView ? (
          showAdvanced ? (
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">{layout.logs.title}</h3>
            </div>
            <div className="mt-4 space-y-2 text-xs text-ink-600">
              {loadingInstances ? (
                <div className="rounded-2xl border border-ink-100 bg-ink-50 px-3 py-3 text-xs text-ink-500">
                  {layout.logs.loading}
                </div>
              ) : null}
              {!loadingInstances && instanceRows.length === 0 ? (
                <div className="rounded-2xl border border-ink-100 bg-ink-50 px-3 py-3 text-xs text-ink-500">
                  {layout.logs.empty}
                </div>
              ) : null}
              {instanceRows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-ink-100 bg-white/90 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        {row.processName}
                      </p>
                      <p className="mt-1 text-[0.65rem] uppercase tracking-[0.25em] text-ink-400">
                        {row.processCode}
                      </p>
                    </div>
                    <span className="rounded-full border border-ink-100 bg-ink-50 px-2 py-1 text-[0.55rem] uppercase tracking-[0.2em] text-ink-500">
                      {row.status}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[0.65rem] text-ink-500">
                    <div>
                      <span className="uppercase tracking-[0.2em]">
                        {layout.logs.fields?.started || "Started"}
                      </span>
                      <p className="mt-1 text-ink-700">{row.startedAt}</p>
                    </div>
                    <div>
                      <span className="uppercase tracking-[0.2em]">
                        {layout.logs.fields?.updated || "Updated"}
                      </span>
                      <p className="mt-1 text-ink-700">{row.updatedAt}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          ) : (
            <div className="glass-panel p-5">
              <p className="text-xs text-ink-500">Switch to Advanced view to see logs.</p>
            </div>
          )
        ) : (
        <div className="space-y-6">
          <div
            className="glass-panel p-5"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(148,163,184,0.35) 1px, transparent 1px)",
              backgroundSize: "18px 18px"
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">{layout.canvas.title}</h3>
              {showAdvanced ? (
                <button
                  type="button"
                  onClick={() => addNode()}
                  className="rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-500"
                >
                  {layout.canvas.addNode}
                </button>
              ) : null}
            </div>
            {layout.canvas.help ? (
              <p className="mt-2 text-xs text-ink-500">{layout.canvas.help}</p>
            ) : null}
            <div className="mt-4 space-y-3">
              {graphDraft.nodes.length === 0 ? (
                <div className="rounded-2xl border border-ink-100 bg-white/90 px-4 py-6 text-xs text-ink-500">
                  {layout.canvas.empty}
                </div>
              ) : null}
              {graphDraft.nodes.map((node, index) => {
                const active = node.id === selectedNodeId;
                const { Icon, tone } = renderNodeIcon(node.type);
                const showConnector = index < graphDraft.nodes.length - 1;
                return (
                  <div key={node.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-xs transition ${
                        active
                          ? "border-brand-400 bg-white text-ink-900 shadow-soft"
                          : "border-ink-100 bg-white/80 text-ink-700 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{node.label || node.id}</p>
                          <p className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-ink-400">
                            {node.type || layout.canvas.nodeTypeFallback}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full border border-ink-100 bg-ink-50 px-2 py-1 text-[0.55rem] uppercase tracking-[0.2em] text-ink-500">
                        {node.is_terminal
                          ? layout.canvas.nodeState.terminal
                          : layout.canvas.nodeState.active}
                      </span>
                    </button>
                    {showConnector ? (
                      <span className="absolute left-10 top-[4.1rem] h-6 w-px bg-ink-200" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-panel p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">{layout.transitions.title}</h3>
              <button
                type="button"
                onClick={addTransition}
                className="rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-500"
              >
                {layout.transitions.add}
              </button>
            </div>
            {layout.transitions.help ? (
              <p className="mt-2 text-xs text-ink-500">{layout.transitions.help}</p>
            ) : null}
            <div className="mt-4 space-y-2">
              {graphDraft.transitions.length === 0 ? (
                <div className="rounded-2xl border border-ink-100 bg-ink-50 px-3 py-3 text-xs text-ink-500">
                  {layout.transitions.empty}
                </div>
              ) : null}
              {graphDraft.transitions.map((transition) => {
                const active = transition.id === selectedTransitionId;
                return (
                  <button
                    key={transition.id}
                    type="button"
                    onClick={() => setSelectedTransitionId(transition.id)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left text-xs ${
                      active
                        ? "border-ink-900 bg-ink-900 text-white"
                        : "border-ink-100 bg-white/80 text-ink-700"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {transition.from || layout.transitions.nodeFallback}
                        {" -> "}
                        {transition.to || layout.transitions.nodeFallback}
                      </p>
                      <p className="mt-1 text-[0.65rem] opacity-70">
                        {transition.action || layout.transitions.actionFallback} -{" "}
                        {transition.edge_type || layout.transitions.edgeFallback}
                      </p>
                    </div>
                    <span className="rounded-full border border-ink-100 bg-ink-50 px-2 py-1 text-[0.55rem] uppercase tracking-[0.2em] text-ink-500">
                      {transition.effects.length} {layout.transitions.badgeSuffix}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        )}
        {isLogsView ? null : (
        <div className="space-y-4 max-h-[720px] overflow-y-auto pr-1">
          {!showAdvanced ? (
            <div className="glass-panel p-4">
              <h3 className="text-sm font-semibold text-ink-900">Step summary</h3>
              {selectedNode ? (
                <div className="mt-3 space-y-3 text-xs text-ink-600">
                  <div>
                    <p className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">Step</p>
                    <p className="mt-1 text-sm font-semibold text-ink-900">
                      {selectedNode.label || selectedNode.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">Type</p>
                    <p className="mt-1 text-ink-700">
                      {selectedNode.type || layout.canvas.nodeTypeFallback}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">Tasks</p>
                    {selectedNodeTasks.length ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {selectedNodeTasks.map((task) => (
                          <span
                            key={task}
                            className="inline-flex items-center rounded-full border border-ink-100 bg-ink-50 px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-ink-500"
                          >
                            {task}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-ink-500">No tasks attached.</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">Next</p>
                    {nextNodes.length ? (
                      <div className="mt-1 space-y-1">
                        {nextNodes.map((node) => (
                          <p key={node.id} className="text-ink-700">
                            {node.label || node.id}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-ink-500">No outgoing transitions.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-ink-500">Select a node to see details.</p>
              )}
            </div>
          ) : null}
          {showAdvanced ? (
          <>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "definition", label: layout.definition.title },
              { key: "node", label: layout.nodeInspector.title },
              { key: "transition", label: layout.transitionInspector.title },
              { key: "templates", label: layout.templates.title },
              { key: "bindings", label: layout.bindings.title }
            ].map((tab) => {
              const active = rightPaneTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRightPaneTab(tab.key)}
                  className={`rounded-full border px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.25em] ${
                    active
                      ? "border-ink-900 bg-ink-900 text-white"
                      : "border-ink-100 bg-white/80 text-ink-600"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          {rightPaneTab === "definition" ? (
          <div className="glass-panel p-4">
            <h3 className="text-sm font-semibold text-ink-900">{layout.definition.title}</h3>
            {layout.definition.help ? (
              <p className="mt-2 text-xs text-ink-500">{layout.definition.help}</p>
            ) : null}
            <div className="mt-4 grid gap-3 text-xs text-ink-600">
              <label className="space-y-1">
                <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                  {layout.definition.fields.code}
                </span>
                <input
                  value={defDraft.code}
                  onChange={(event) => setDefDraft((prev) => ({ ...prev, code: event.target.value }))}
                  disabled={!isNewDef}
                  className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700 disabled:opacity-60"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                  {layout.definition.fields.name}
                </span>
                <input
                  value={defDraft.name}
                  onChange={(event) => setDefDraft((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                    {layout.definition.fields.module}
                  </span>
                  <input
                    value={defDraft.module}
                    onChange={(event) => setDefDraft((prev) => ({ ...prev, module: event.target.value }))}
                    className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                    {layout.definition.fields.version}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={defDraft.version}
                    onChange={(event) =>
                      setDefDraft((prev) => ({ ...prev, version: Number(event.target.value || 1) }))
                    }
                    className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                  />
                </label>
              </div>
              <label className="space-y-1">
                <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                  {layout.definition.fields.objectType}
                </span>
                <input
                  value={defDraft.object_type}
                  onChange={(event) =>
                    setDefDraft((prev) => ({ ...prev, object_type: event.target.value }))
                  }
                  className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                  {layout.definition.fields.initialNode}
                </span>
                <select
                  value={graphDraft.initial_node}
                  onChange={(event) =>
                    setGraphDraft((prev) => ({ ...prev, initial_node: event.target.value }))
                  }
                  className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                >
                  <option value="">{layout.definition.fields.initialNodePlaceholder}</option>
                  {nodeIdOptions.map((nodeId) => (
                    <option key={nodeId} value={nodeId}>
                      {nodeId}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-500">
                <input
                  type="checkbox"
                  checked={defDraft.is_active}
                  onChange={(event) =>
                    setDefDraft((prev) => ({ ...prev, is_active: event.target.checked }))
                  }
                />
                {layout.definition.fields.active}
              </label>
            </div>
          </div>
          ) : null}
          {rightPaneTab === "node" ? (
          <>
          {layout.nodePalette ? (
            <div className="glass-panel p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink-900">
                  {layout.nodePalette.title}
                </h3>
              </div>
              {layout.nodePalette.help ? (
                <p className="mt-2 text-xs text-ink-500">{layout.nodePalette.help}</p>
              ) : null}
              {layout.nodePalette.searchPlaceholder ? (
                <input
                  value={nodeQuery}
                  onChange={(event) => setNodeQuery(event.target.value)}
                  placeholder={layout.nodePalette.searchPlaceholder}
                  className="mt-3 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                />
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {filteredNodeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => addNode(option.value)}
                    className="rounded-xl border border-ink-100 bg-white px-3 py-2 text-left text-[0.65rem] font-semibold text-ink-700 hover:border-ink-200 hover:bg-ink-50"
                  >
                    {option.label}
                  </button>
                ))}
                {filteredNodeOptions.length === 0 ? (
                  <div className="col-span-2 rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-[0.65rem] text-ink-500">
                    {layout.nodePalette.empty || "No matches."}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">{layout.nodeInspector.title}</h3>
              {selectedNode ? (
                <button
                  type="button"
                  onClick={() => removeNode(selectedNode.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-rose-600"
                >
                  <Trash2 className="h-3 w-3" />
                  {layout.nodeInspector.remove}
                </button>
                ) : null}
            </div>
            {layout.nodeInspector.help ? (
              <p className="mt-2 text-xs text-ink-500">{layout.nodeInspector.help}</p>
            ) : null}
            {!selectedNode ? (
              <p className="mt-3 text-xs text-ink-500">{layout.nodeInspector.empty}</p>
            ) : (
              <div className="mt-4 grid gap-3 text-xs text-ink-600">
                <label className="space-y-1">
                  <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                    {layout.nodeInspector.fields.id}
                  </span>
                  <input
                    value={selectedNode.id}
                    onChange={(event) => renameNode(selectedNode.id, event.target.value)}
                    className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                    {layout.nodeInspector.fields.type}
                  </span>
                  <select
                    value={selectedNode.type}
                    onChange={(event) => updateNode(selectedNode.id, { type: event.target.value })}
                    className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                  >
                    <option value="">{layout.nodeInspector.fields.typePlaceholder}</option>
                    {nodeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                    {layout.nodeInspector.fields.label}
                  </span>
                  <input
                    value={selectedNode.label}
                    onChange={(event) => updateNode(selectedNode.id, { label: event.target.value })}
                    className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-ink-500">
                  <input
                    type="checkbox"
                    checked={selectedNode.is_terminal}
                    onChange={(event) =>
                      updateNode(selectedNode.id, { is_terminal: event.target.checked })
                    }
                  />
                  {layout.nodeInspector.fields.terminal}
                </label>
                <label className="space-y-1">
                  <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                    {layout.nodeInspector.fields.templates}
                  </span>
                  <textarea
                    rows={3}
                    value={selectedNode.task_templates_text}
                    onChange={(event) =>
                      updateNode(selectedNode.id, { task_templates_text: event.target.value })
                    }
                    className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                  />
                </label>
              </div>
            )}
          </div>
          </>
          ) : null}
          {rightPaneTab === "transition" ? (
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">
                {layout.transitionInspector.title}
              </h3>
              {selectedTransition ? (
                <button
                  type="button"
                  onClick={() => removeTransition(selectedTransition.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-rose-600"
                >
                  <Trash2 className="h-3 w-3" />
                  {layout.transitionInspector.remove}
                </button>
                ) : null}
            </div>
            {layout.transitionInspector.help ? (
              <p className="mt-2 text-xs text-ink-500">{layout.transitionInspector.help}</p>
            ) : null}
            {!selectedTransition ? (
              <p className="mt-3 text-xs text-ink-500">{layout.transitionInspector.empty}</p>
            ) : (
              <div className="mt-4 grid gap-3 text-xs text-ink-600">
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                      {layout.transitionInspector.fields.from}
                    </span>
                    <select
                      value={selectedTransition.from}
                      onChange={(event) =>
                        updateTransition(selectedTransition.id, { from: event.target.value })
                      }
                      className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                    >
                      <option value="">
                        {layout.transitionInspector.fields.selectPlaceholder}
                      </option>
                      {nodeIdOptions.map((nodeId) => (
                        <option key={nodeId} value={nodeId}>
                          {nodeId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                      {layout.transitionInspector.fields.to}
                    </span>
                    <select
                      value={selectedTransition.to}
                      onChange={(event) =>
                        updateTransition(selectedTransition.id, { to: event.target.value })
                      }
                      className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                    >
                      <option value="">
                        {layout.transitionInspector.fields.selectPlaceholder}
                      </option>
                      {nodeIdOptions.map((nodeId) => (
                        <option key={nodeId} value={nodeId}>
                          {nodeId}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="space-y-1">
                  <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                    {layout.transitionInspector.fields.action}
                  </span>
                  {actionOptions.length > 0 ? (
                    <select
                      value={selectedTransition.action}
                      onChange={(event) =>
                        updateTransition(selectedTransition.id, { action: event.target.value })
                      }
                      className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                    >
                      <option value="">
                        {layout.transitionInspector.fields.selectPlaceholder}
                      </option>
                      {actionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={selectedTransition.action}
                      onChange={(event) =>
                        updateTransition(selectedTransition.id, { action: event.target.value })
                      }
                      className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                    />
                  )}
                </label>
                <label className="space-y-1">
                  <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                    {layout.transitionInspector.fields.edge}
                  </span>
                  <select
                    value={selectedTransition.edge_type}
                    onChange={(event) =>
                      updateTransition(selectedTransition.id, { edge_type: event.target.value })
                    }
                    className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                  >
                    {edgeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                    {layout.transitionInspector.fields.condition}
                  </span>
                  <input
                    value={selectedTransition.condition}
                    onChange={(event) =>
                      updateTransition(selectedTransition.id, { condition: event.target.value })
                    }
                    className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                  />
                </label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                      {layout.transitionInspector.fields.effects}
                    </span>
                    <button
                      type="button"
                      onClick={() => addEffect(selectedTransition.id)}
                      className="rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-ink-500"
                    >
                      {layout.transitions.effects.add}
                    </button>
                  </div>
                  {selectedTransition.effects.length === 0 ? (
                    <p className="text-xs text-ink-500">{layout.transitions.effects.empty}</p>
                  ) : null}
                  {selectedTransition.effects.map((effect) => (
                    <div key={effect.id} className="rounded-2xl border border-ink-100 bg-white/80 p-3">
                      <div className="flex items-center justify-between">
                        <select
                          value={effect.type}
                          onChange={(event) =>
                            updateEffect(selectedTransition.id, effect.id, {
                              type: event.target.value
                            })
                          }
                          className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                        >
                          <option value="">{layout.transitions.effects.select}</option>
                          {effectOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeEffect(selectedTransition.id, effect.id)}
                          className="ml-2 text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={effect.configText}
                        onChange={(event) =>
                          updateEffect(selectedTransition.id, effect.id, {
                            configText: event.target.value
                          })
                        }
                        placeholder={layout.transitions.effects.configPlaceholder}
                        className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          ) : null}
          {rightPaneTab === "templates" ? (
          <details className="glass-panel p-4" open>
            <summary className="cursor-pointer text-sm font-semibold text-ink-900">
              {layout.templates.title}
            </summary>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-ink-500">{layout.templates.subtitle}</p>
                <button
                  type="button"
                  onClick={addTemplate}
                  className="rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-ink-500"
                >
                  {layout.templates.add}
                </button>
              </div>
              {layout.templates.help ? (
                <p className="text-xs text-ink-500">{layout.templates.help}</p>
              ) : null}
              <div className="space-y-2">
                {taskTemplates.length === 0 ? (
                  <p className="text-xs text-ink-500">{layout.templates.empty}</p>
                ) : null}
                {taskTemplates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(item.id)}
                    className={`w-full rounded-2xl border px-3 py-2 text-left text-xs ${
                      item.id === selectedTemplateId
                        ? "border-ink-900 bg-ink-900 text-white"
                        : "border-ink-100 bg-white/80 text-ink-700"
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {item.task_type || layout.templates.itemFallback}
                    </p>
                    <p className="mt-1 text-[0.65rem] opacity-70">{item.title}</p>
                  </button>
                ))}
              </div>
              {selectedTemplate ? (
                <div className="rounded-2xl border border-ink-100 bg-white/90 p-3 text-xs text-ink-600">
                  <div className="grid gap-2">
                    <input
                      value={selectedTemplate.task_type}
                      onChange={(event) =>
                        updateTemplate(selectedTemplate.id, { task_type: event.target.value })
                      }
                      placeholder={layout.templates.fields.taskTypePlaceholder}
                      className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                    />
                    <input
                      value={selectedTemplate.title}
                      onChange={(event) =>
                        updateTemplate(selectedTemplate.id, { title: event.target.value })
                      }
                      placeholder={layout.templates.fields.titlePlaceholder}
                      className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                    />
                    <textarea
                      rows={2}
                      value={selectedTemplate.description}
                      onChange={(event) =>
                        updateTemplate(selectedTemplate.id, { description: event.target.value })
                      }
                      placeholder={layout.templates.fields.descriptionPlaceholder}
                      className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={selectedTemplate.service_object_type}
                        onChange={(event) =>
                          updateTemplate(selectedTemplate.id, {
                            service_object_type: event.target.value
                          })
                        }
                        placeholder={layout.templates.fields.serviceObjectTypePlaceholder}
                        className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                      />
                      <input
                        type="number"
                        value={selectedTemplate.sort_order}
                        onChange={(event) =>
                          updateTemplate(selectedTemplate.id, {
                            sort_order: Number(event.target.value || 0)
                          })
                        }
                        placeholder={layout.templates.fields.sortOrderPlaceholder}
                        className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-ink-500">
                      <input
                        type="checkbox"
                        checked={selectedTemplate.is_active}
                        onChange={(event) =>
                          updateTemplate(selectedTemplate.id, {
                            is_active: event.target.checked
                          })
                        }
                      />
                      {layout.templates.fields.activeLabel}
                    </label>
                    <div>
                      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                        {layout.templates.fields.allowedActions}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        {taskActionOptions.map((option) => {
                          const checked = selectedTemplate.allowed_actions.includes(option.value);
                          return (
                            <label
                              key={option.value}
                              className="flex items-center gap-2 text-[0.65rem] text-ink-600"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  const next = event.target.checked
                                    ? [...selectedTemplate.allowed_actions, option.value]
                                    : selectedTemplate.allowed_actions.filter(
                                        (action) => action !== option.value
                                      );
                                  updateTemplate(selectedTemplate.id, { allowed_actions: next });
                                }}
                              />
                              {option.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <label className="space-y-1">
                      <span className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                        {layout.templates.fields.completionAction}
                      </span>
                      <select
                        value={selectedTemplate.completion_action}
                        onChange={(event) =>
                          updateTemplate(selectedTemplate.id, {
                            completion_action: event.target.value
                          })
                        }
                        className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                      >
                        <option value="">
                          {layout.templates.fields.completionActionPlaceholder}
                        </option>
                        {taskActionOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <textarea
                      rows={3}
                      value={selectedTemplate.attrs_text}
                      onChange={(event) =>
                        updateTemplate(selectedTemplate.id, { attrs_text: event.target.value })
                      }
                      placeholder={layout.templates.fields.attrsPlaceholder}
                      className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => saveTemplate(selectedTemplate)}
                        className="rounded-full bg-ink-900 px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-white"
                      >
                        {layout.templates.save}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTemplate(selectedTemplate)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-rose-600"
                      >
                        {selectedTemplate.isNew ? layout.templates.remove : layout.templates.deactivate}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </details>
          ) : null}
          {rightPaneTab === "bindings" ? (
          <details className="glass-panel p-4">
            <summary className="cursor-pointer text-sm font-semibold text-ink-900">
              {layout.bindings.title}
            </summary>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-ink-500">{layout.bindings.subtitle}</p>
                <button
                  type="button"
                  onClick={addBinding}
                  className="rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-ink-500"
                >
                  {layout.bindings.add}
                </button>
              </div>
              {layout.bindings.help ? (
                <p className="text-xs text-ink-500">{layout.bindings.help}</p>
              ) : null}
              <div className="space-y-2">
                {bindings.length === 0 ? (
                  <p className="text-xs text-ink-500">{layout.bindings.empty}</p>
                ) : null}
                {bindings.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedBindingId(item.id)}
                    className={`w-full rounded-2xl border px-3 py-2 text-left text-xs ${
                      item.id === selectedBindingId
                        ? "border-ink-900 bg-ink-900 text-white"
                        : "border-ink-100 bg-white/80 text-ink-700"
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {item.service_object_type || layout.bindings.itemFallback}
                    </p>
                    <p className="mt-1 text-[0.65rem] opacity-70">
                      {item.task_type
                        ? `${layout.bindings.taskPrefix} ${item.task_type}`
                        : layout.bindings.allTasks}
                    </p>
                  </button>
                ))}
              </div>
              {selectedBinding ? (
                <div className="rounded-2xl border border-ink-100 bg-white/90 p-3 text-xs text-ink-600">
                  <div className="grid gap-2">
                    <input
                      value={selectedBinding.service_object_type}
                      onChange={(event) =>
                        updateBinding(selectedBinding.id, {
                          service_object_type: event.target.value
                        })
                      }
                      placeholder={layout.bindings.fields.serviceObjectTypePlaceholder}
                      className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                    />
                    <input
                      value={selectedBinding.task_type}
                      onChange={(event) =>
                        updateBinding(selectedBinding.id, { task_type: event.target.value })
                      }
                      placeholder={layout.bindings.fields.taskTypePlaceholder}
                      className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                    />
                    <input
                      type="number"
                      value={selectedBinding.priority}
                      onChange={(event) =>
                        updateBinding(selectedBinding.id, {
                          priority: Number(event.target.value || 0)
                        })
                      }
                      placeholder={layout.bindings.fields.priorityPlaceholder}
                      className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                    />
                    <label className="flex items-center gap-2 text-xs text-ink-500">
                      <input
                        type="checkbox"
                        checked={selectedBinding.is_active}
                        onChange={(event) =>
                        updateBinding(selectedBinding.id, { is_active: event.target.checked })
                      }
                    />
                    {layout.bindings.fields.activeLabel}
                    </label>
                    <textarea
                      rows={3}
                      value={selectedBinding.attrs_text}
                      onChange={(event) =>
                        updateBinding(selectedBinding.id, { attrs_text: event.target.value })
                      }
                      placeholder={layout.bindings.fields.attrsPlaceholder}
                      className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => saveBinding(selectedBinding)}
                        className="rounded-full bg-ink-900 px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-white"
                      >
                        {layout.bindings.save}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBinding(selectedBinding)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-rose-600"
                      >
                        {selectedBinding.isNew ? layout.bindings.remove : layout.bindings.deactivate}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </details>
          ) : null}
          </>
          ) : null}
        </div>
        )}
      </div>
    </div>
  );
}
