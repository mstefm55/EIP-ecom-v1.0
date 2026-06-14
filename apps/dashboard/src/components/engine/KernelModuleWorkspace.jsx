import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  Boxes,
  Briefcase,
  Building2,
  FileText,
  GitBranch,
  Layers,
  Loader2,
  Mail,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const ICONS = {
  activity: Activity,
  archive: Archive,
  boxes: Boxes,
  briefcase: Briefcase,
  building: Building2,
  document: FileText,
  file: FileText,
  link: GitBranch,
  layers: Layers,
  mail: Mail,
  package: Package,
  pipeline: TrendingUp,
  policy: ShieldCheck,
  reorder: TrendingDown,
  shopping: ShoppingCart,
  "shopping-cart": ShoppingCart,
  trend: TrendingUp,
  users: Users
};

const TONES = {
  ACTIVE: "green",
  AVAILABLE: "green",
  DONE: "green",
  RESOLVED: "green",
  MAPPED: "green",
  WON: "green",
  BLOCKED: "red",
  CANCELLED: "red",
  EXPIRED: "red",
  ARCHIVED: "red",
  INACTIVE: "red",
  LOST: "red",
  NEGOTIATION: "blue",
  NEW: "blue",
  PROPOSAL: "blue",
  PROSPECT: "blue",
  QUALIFYING: "amber",
  NEEDS_REVIEW: "amber",
  UNDER_REVIEW: "amber",
  RESERVED: "amber",
  QUARANTINE: "amber"
};

function getPath(obj, path, fallback = undefined) {
  if (!path) return obj ?? fallback;
  const value = String(path)
    .split(".")
    .reduce((cursor, key) => {
      if (cursor === null || cursor === undefined) return undefined;
      if (Array.isArray(cursor) && /^\d+$/.test(key)) return cursor[Number(key)];
      return cursor[key];
    }, obj);
  return value === undefined || value === null ? fallback : value;
}

function setPath(obj, path, value) {
  const keys = String(path || "").split(".").filter(Boolean);
  if (!keys.length) return obj;
  let cursor = obj;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }
    if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
    cursor = cursor[key];
  });
  return obj;
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function titleize(value) {
  const text = String(value ?? "").replaceAll("_", " ").trim();
  return text ? text.replace(/\b\w/g, (char) => char.toUpperCase()) : "-";
}

function formatValue(value, format, unit) {
  if (value === undefined || value === null || value === "") return "-";
  if (format === "date") {
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
      : "-";
  }
  if (format === "number" || format === "quantity") {
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    const text = String(Number(number.toFixed(3)));
    return format === "quantity" && unit ? `${text} ${unit}` : text;
  }
  if (format === "array") return normalizeList(value).join(", ") || "-";
  if (format === "label") return titleize(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function cleanBody(input) {
  return Object.fromEntries(
    Object.entries(input || {}).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== "" && value !== null && value !== undefined;
    })
  );
}

function endpointFor(template, selected, row) {
  return String(template || "")
    .replaceAll(":id", selected?.id || "")
    .replaceAll(":rowId", row?.id || "")
    .replaceAll("{{selected.id}}", selected?.id || "")
    .replaceAll("{{row.id}}", row?.id || "");
}

function parseApiError(error) {
  const message = error?.message || "Request failed.";
  const match = message.match(/API\s+(\d+):\s*(.*)$/s);
  if (!match) return message;
  try {
    const payload = JSON.parse(match[2]);
    if (payload?.error === "FORBIDDEN") return "Access denied.";
    if (payload?.error) return titleize(payload.error);
  } catch {
    return message;
  }
  return message;
}

function Pill({ children, tone }) {
  const tones = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    slate: "border-ink-100 bg-white/80 text-ink-500"
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

function buttonClass(primary = false) {
  return primary
    ? "inline-flex items-center justify-center gap-2 rounded-xl bg-ink-900 px-3 py-2 text-xs font-semibold text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
    : "inline-flex items-center justify-center gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2 text-xs font-semibold text-ink-600 shadow-soft disabled:cursor-not-allowed disabled:opacity-60";
}

function fieldOptions(field, optionsPayload) {
  const options = optionsPayload?.options || {};
  const normalizeValue = (value) => (field.uppercaseOptions ? String(value ?? "").toUpperCase() : value);
  const lists = Array.isArray(field.optionLists)
    ? field.optionLists
    : field.optionList
      ? [field.optionList]
      : [];
  for (const listCode of lists) {
    if (Array.isArray(options[listCode]) && options[listCode].length) {
      return options[listCode].map((entry) => ({
        value: normalizeValue(entry.code ?? entry.value),
        label: entry.label ?? titleize(entry.code ?? entry.value)
      }));
    }
  }
  const fallback = getPath(optionsPayload?.defaults || {}, field.defaultOptionsPath);
  if (Array.isArray(fallback)) {
    return fallback.map((entry) => ({
      value: normalizeValue(entry.code ?? entry.value ?? entry),
      label: entry.label ?? titleize(entry.code ?? entry.value ?? entry)
    }));
  }
  return normalizeList(field.options).map((entry) => ({
    value: normalizeValue(entry.code ?? entry.value ?? entry),
    label: entry.label ?? titleize(entry.code ?? entry.value ?? entry)
  }));
}

function defaultValues(fields, source = {}) {
  const values = {};
  for (const field of fields || []) {
    const name = field.name || field.key;
    if (!name) continue;
    const sourcePath = field.sourcePath || name;
    const value = getPath(source, sourcePath, field.defaultValue ?? "");
    setPath(values, name, Array.isArray(value) ? value : value ?? "");
  }
  return values;
}

function inputValue(values, field) {
  return getPath(values, field.name || field.key, field.defaultValue ?? "");
}

function updateInputValue(setValues, field, value) {
  const name = field.name || field.key;
  setValues((current) => {
    const next = { ...current };
    setPath(next, name, value);
    return next;
  });
}

function LookupField({ field, values, setValues, disabled }) {
  const value = inputValue(values, field);
  const label = field.label || titleize(field.name || field.key);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!field.endpoint) return;
    let active = true;
    Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      const params = new URLSearchParams();
      params.set(field.queryParam || "q", query);
      params.set(field.limitParam || "limit", String(field.limit || 25));
      try {
        const payload = await apiFetch(`${field.endpoint}${String(field.endpoint).includes("?") ? "&" : "?"}${params.toString()}`);
        if (!active) return;
        setOptions(normalizeList(getPath(payload, field.itemsPath || "items")));
      } catch {
        if (active) setOptions([]);
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [field.endpoint, field.itemsPath, field.limit, field.limitParam, field.queryParam, query]);

  return (
    <label className="block">
      <span className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-ink-400">{label}</span>
      <input
        disabled={disabled}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={field.placeholder || "Search"}
        className="mb-2 w-full rounded-xl border border-ink-100 bg-white/90 px-3 py-2 text-sm text-ink-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
      />
      <select
        disabled={disabled || loading}
        value={value}
        onChange={(event) => updateInputValue(setValues, field, event.target.value)}
        className="w-full rounded-xl border border-ink-100 bg-white/90 px-3 py-2 text-sm text-ink-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
      >
        <option value="">{loading ? "Loading..." : field.emptyLabel || "Select"}</option>
        {options.map((option) => {
          const optionValue = getPath(option, field.valuePath || "id", option.id || option.value);
          const optionLabel = getPath(option, field.labelPath || "label", option.label || option.name || option.code || optionValue);
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function FieldInput({ field, values, setValues, disabled, optionsPayload }) {
  const value = inputValue(values, field);
  const label = field.label || titleize(field.name || field.key);
  const baseClass = "w-full rounded-xl border border-ink-100 bg-white/90 px-3 py-2 text-sm text-ink-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 disabled:opacity-60";

  if (field.type === "hidden") {
    return null;
  }

  if (field.type === "lookup") {
    return <LookupField field={field} values={values} setValues={setValues} disabled={disabled} />;
  }

  if (field.type === "select") {
    return (
      <label className="block">
        <span className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-ink-400">{label}</span>
        <select
          disabled={disabled}
          value={value}
          onChange={(event) => updateInputValue(setValues, field, event.target.value)}
          className={baseClass}
        >
          {field.allowEmpty ? <option value="">{field.emptyLabel || "Any"}</option> : null}
          {fieldOptions(field, optionsPayload).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "multiselect") {
    const selected = new Set(normalizeList(value));
    return (
      <fieldset disabled={disabled} className="block">
        <legend className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-ink-400">{label}</legend>
        <div className="flex flex-wrap gap-2 rounded-xl border border-ink-100 bg-white/90 p-2">
          {fieldOptions(field, optionsPayload).map((option) => (
            <label key={option.value} className="inline-flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-2 py-1 text-xs text-ink-600">
              <input
                type="checkbox"
                checked={selected.has(option.value)}
                onChange={(event) => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(option.value);
                  else next.delete(option.value);
                  updateInputValue(setValues, field, [...next]);
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="block">
        <span className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-ink-400">{label}</span>
        <textarea
          disabled={disabled}
          rows={field.rows || 3}
          value={value}
          placeholder={field.placeholder}
          onChange={(event) => updateInputValue(setValues, field, event.target.value)}
          className={baseClass}
        />
      </label>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="inline-flex items-center gap-2 rounded-xl border border-ink-100 bg-white/90 px-3 py-2 text-sm text-ink-600">
        <input
          disabled={disabled}
          type="checkbox"
          checked={value === true}
          onChange={(event) => updateInputValue(setValues, field, event.target.checked)}
        />
        {label}
      </label>
    );
  }

  return (
    <label className="block">
      <span className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-ink-400">{label}</span>
      <input
        disabled={disabled}
        type={field.type || "text"}
        value={value}
        placeholder={field.placeholder}
        onChange={(event) => updateInputValue(setValues, field, event.target.value)}
        className={baseClass}
      />
    </label>
  );
}

function ManagedForm({ config, source, selected, row, optionsPayload, permissions, onSaved }) {
  const fields = useMemo(() => config?.fields || [], [config?.fields]);
  const initialValues = useMemo(() => defaultValues(fields, source), [fields, source]);
  const formKey = useMemo(() => JSON.stringify(initialValues), [initialValues]);

  return (
    <ManagedFormState
      key={formKey}
      config={config}
      fields={fields}
      initialValues={initialValues}
      selected={selected}
      row={row}
      optionsPayload={optionsPayload}
      permissions={permissions}
      onSaved={onSaved}
    />
  );
}

function ManagedFormState({ config, fields, initialValues, selected, row, optionsPayload, permissions, onSaved }) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const permission = config?.permission;
  const disabled = Boolean(permission) && !permissions.includes(permission);

  async function submit(event) {
    event.preventDefault();
    if (disabled) return;
    setSaving(true);
    setError("");
    try {
      const body = cleanBody(values);
      await apiFetch(endpointFor(config.endpoint, selected, row), {
        method: config.method || "POST",
        body
      });
      await onSaved?.();
      if (config.resetOnSave !== false) setValues(initialValues);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-soft">
      {config.title ? <h3 className="text-base font-semibold text-ink-900">{config.title}</h3> : null}
      {config.subtitle ? <p className="mt-1 text-sm text-ink-400">{config.subtitle}</p> : null}
      {error ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      <div className={`mt-4 grid gap-3 ${config.columns === 1 ? "" : "md:grid-cols-2 xl:grid-cols-3"}`}>
        {fields.map((field) => (
          <FieldInput
            key={field.name || field.key}
            field={field}
            values={values}
            setValues={setValues}
            disabled={disabled || saving}
            optionsPayload={optionsPayload}
          />
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={disabled || saving} title={disabled && permission ? `Missing ${permission}` : undefined} className={buttonClass(true)}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {config.submitLabel || "Save"}
        </button>
      </div>
    </form>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-100 bg-white/60 p-5 text-sm text-ink-400">
      {children}
    </div>
  );
}

function SummaryRows({ rows, data }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {normalizeList(rows).map((row) => {
        const value = getPath(data, row.path, row.value);
        const unit = row.unitPath ? getPath(data, row.unitPath) : row.unit;
        return (
          <div key={`${row.label}-${row.path || row.value}`} className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-soft">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-ink-400">{row.label}</p>
            <p className="mt-2 break-words text-sm font-semibold text-ink-800">{formatValue(value, row.format, unit)}</p>
          </div>
        );
      })}
    </div>
  );
}

function RecordList({ items, config, onSelect, selectedId }) {
  if (!items.length) return <EmptyState>{config.empty || "No records found."}</EmptyState>;
  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const id = item.id || `${config.id || "row"}-${index}`;
        const title = formatValue(getPath(item, config.titlePath), config.titleFormat) || id;
        const subtitle = formatValue(getPath(item, config.subtitlePath), config.subtitleFormat);
        const badgeValue = getPath(item, config.badgePath);
        const Icon = ICONS[config.icon] || Package;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect?.(item)}
            className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === id ? "border-brand-200 bg-brand-50/80 shadow-soft" : "border-white/70 bg-white/70 hover:bg-white"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-800">{title}</p>
                  <p className="truncate text-xs text-ink-400">{subtitle}</p>
                </div>
              </div>
              {badgeValue ? <Pill tone={TONES[String(badgeValue).toUpperCase()] || "slate"}>{formatValue(badgeValue, "label")}</Pill> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function JsonBlock({ value }) {
  const hasValue = value && (Array.isArray(value) ? value.length : Object.keys(value || {}).length);
  return (
    <pre className="max-h-72 overflow-auto rounded-2xl border border-ink-100 bg-ink-950 p-3 text-xs text-white">
      {hasValue ? JSON.stringify(value, null, 2) : "{}"}
    </pre>
  );
}

function TabContent({ tab, detail, selected, optionsPayload, permissions, refreshDetail, refreshAll }) {
  const data = { detail, selected, item: selected, ...detail };
  const [selectedRowByTab, setSelectedRowByTab] = useState({});
  const [collectionActionLoading, setCollectionActionLoading] = useState("");
  const [collectionActionError, setCollectionActionError] = useState("");

  async function runCollectionAction(action, row) {
    if (!selected || !row || !action?.endpoint) return;
    const actionKey = action.id || action.label || action.endpoint;
    setCollectionActionLoading(actionKey);
    setCollectionActionError("");
    try {
      await apiFetch(endpointFor(action.endpoint, selected, row), {
        method: action.method || "POST",
        body: action.body || {}
      });
      await refreshDetail(selected?.id);
      await refreshAll?.();
    } catch (err) {
      setCollectionActionError(parseApiError(err));
    } finally {
      setCollectionActionLoading("");
    }
  }

  if (tab.type === "form") {
    return (
      <ManagedForm
        config={tab.form}
        source={selected}
        selected={selected}
        optionsPayload={optionsPayload}
        permissions={permissions}
        onSaved={async () => {
          await refreshAll();
          await refreshDetail(selected?.id);
        }}
      />
    );
  }

  if (tab.type === "collection") {
    const items = normalizeList(getPath(data, tab.itemsPath));
    const selectedRow = selectedRowByTab[tab.id] || items[0] || null;
    const listConfig = {
      id: tab.id,
      icon: tab.icon,
      titlePath: tab.titlePath || "label",
      subtitlePath: tab.subtitlePath,
      badgePath: tab.badgePath,
      empty: tab.empty
    };
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(260px,360px)_1fr]">
        <div className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-soft">
          <RecordList
            items={items}
            config={listConfig}
            selectedId={selectedRow?.id}
            onSelect={(row) => setSelectedRowByTab((current) => ({ ...current, [tab.id]: row }))}
          />
        </div>
        <div className="space-y-5">
          {tab.createForm ? (
            <ManagedForm
              config={tab.createForm}
              source={data}
              selected={selected}
              optionsPayload={optionsPayload}
              permissions={permissions}
              onSaved={() => refreshDetail(selected?.id)}
            />
          ) : null}
          {tab.rowActions?.length && selectedRow ? (
            <div className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-soft">
              {collectionActionError ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{collectionActionError}</div> : null}
              <div className="flex flex-wrap gap-2">
                {tab.rowActions.map((action) => {
                  const permissionMissing = action.permission && !permissions.includes(action.permission);
                  const enabledStatuses = normalizeList(action.enabledStatuses).map((status) => String(status).toUpperCase());
                  const rowBadgeValue = getPath(selectedRow, action.statusPath || tab.badgePath || "status");
                  const statusBlocked = enabledStatuses.length
                    ? !enabledStatuses.includes(String(rowBadgeValue || "").toUpperCase())
                    : false;
                  const actionKey = action.id || action.label || action.endpoint;
                  const disabled = permissionMissing || statusBlocked || Boolean(collectionActionLoading);
                  const title = permissionMissing
                    ? `Missing ${action.permission}`
                    : statusBlocked
                      ? action.disabledReason || "Action is unavailable for this status."
                      : undefined;
                  return (
                    <button
                      key={actionKey}
                      type="button"
                      disabled={disabled}
                      title={title}
                      onClick={() => runCollectionAction(action, selectedRow)}
                      className={buttonClass(action.primary === true)}
                    >
                      {collectionActionLoading === actionKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {tab.updateForm && selectedRow ? (
            <ManagedForm
              config={tab.updateForm}
              source={selectedRow}
              selected={selected}
              row={selectedRow}
              optionsPayload={optionsPayload}
              permissions={permissions}
              onSaved={() => refreshDetail(selected?.id)}
            />
          ) : null}
        </div>
      </div>
    );
  }

  if (tab.type === "json") {
    return <JsonBlock value={getPath(data, tab.path)} />;
  }

  if (tab.type === "records") {
    const items = normalizeList(getPath(data, tab.itemsPath));
    return (
      <div className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-soft">
        <RecordList items={items} config={tab} />
      </div>
    );
  }

  return <SummaryRows rows={tab.rows || []} data={data} />;
}

export default function KernelModuleWorkspace({ node }) {
  const props = useMemo(() => node?.props || {}, [node?.props]);
  const [remoteProps, setRemoteProps] = useState({});
  const effectiveProps = useMemo(() => ({
    ...props,
    ...remoteProps,
    layout: { ...(props.layout || {}), ...(remoteProps.layout || {}) },
    list: { ...(props.list || {}), ...(remoteProps.list || {}) },
    detail: { ...(props.detail || {}), ...(remoteProps.detail || {}) },
    actions: { ...(props.actions || {}), ...(remoteProps.actions || {}) },
    tabs: remoteProps.tabs || props.tabs || []
  }), [props, remoteProps]);
  const layout = useMemo(() => effectiveProps.layout || {}, [effectiveProps.layout]);
  const listConfig = useMemo(() => effectiveProps.list || {}, [effectiveProps.list]);
  const detailConfig = useMemo(() => effectiveProps.detail || {}, [effectiveProps.detail]);
  const actions = useMemo(() => effectiveProps.actions || {}, [effectiveProps.actions]);
  const rowActions = useMemo(() => normalizeList(effectiveProps.rowActions), [effectiveProps.rowActions]);
  const tabs = useMemo(() => effectiveProps.tabs || [], [effectiveProps.tabs]);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [optionsPayload, setOptionsPayload] = useState({ options: {}, defaults: {}, permissions: [] });
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || "overview");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({});
  const [createOpen, setCreateOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const permissions = useMemo(() => optionsPayload.permissions || [], [optionsPayload.permissions]);
  const visibleTabs = useMemo(
    () => tabs.filter((tab) => !tab.permission || permissions.includes(tab.permission)),
    [permissions, tabs]
  );
  const selected = detail?.item || items.find((item) => item.id === selectedId) || null;

  const listEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.set(listConfig.limitParam || "limit", String(listConfig.limit || 50));
    if (query.trim()) params.set(listConfig.queryParam || "q", query.trim());
    for (const filter of listConfig.filters || []) {
      const value = filters[filter.name];
      if (value) params.set(filter.param || filter.name, value);
    }
    const separator = String(listConfig.endpoint || "").includes("?") ? "&" : "?";
    return `${listConfig.endpoint}${separator}${params.toString()}`;
  }, [filters, listConfig, query]);

  const loadOptions = useCallback(async () => {
    const endpoint = effectiveProps.configEndpoint || effectiveProps.optionsEndpoint;
    if (!endpoint) return;
    const payload = await apiFetch(endpoint);
    if (payload?.workspace && typeof payload.workspace === "object") setRemoteProps(payload.workspace);
    if (payload?.descriptor && typeof payload.descriptor === "object") setRemoteProps(payload.descriptor);
    setOptionsPayload(payload || { options: {}, defaults: {}, permissions: [] });
  }, [effectiveProps.configEndpoint, effectiveProps.optionsEndpoint]);

  const loadItems = useCallback(async () => {
    if (!listConfig.endpoint) return;
    const payload = await apiFetch(listEndpoint);
    const nextItems = normalizeList(getPath(payload, listConfig.itemsPath || "items"));
    setItems(nextItems);
    setSelectedId((current) => current || nextItems[0]?.id || null);
  }, [listConfig.endpoint, listConfig.itemsPath, listEndpoint]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await loadOptions();
      await loadItems();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [loadItems, loadOptions]);

  const refreshDetail = useCallback(async (id) => {
    if (!id || !detailConfig.endpoint) {
      setDetail(null);
      return;
    }
    try {
      const payload = await apiFetch(endpointFor(detailConfig.endpoint, { id }));
      setDetail(payload);
    } catch (err) {
      setError(parseApiError(err));
    }
  }, [detailConfig.endpoint]);

  const runRowAction = useCallback(async (action) => {
    if (!selected || !action?.endpoint) return;
    setActionLoading(action.id || action.label || action.endpoint);
    setError("");
    try {
      await apiFetch(endpointFor(action.endpoint, selected), {
        method: action.method || "POST",
        body: action.body || {}
      });
      await refreshAll();
      await refreshDetail(selected.id);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setActionLoading("");
    }
  }, [refreshAll, refreshDetail, selected]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void refreshAll();
    });
    return () => {
      active = false;
    };
  }, [refreshAll]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void refreshDetail(selectedId);
    });
    return () => {
      active = false;
    };
  }, [refreshDetail, selectedId]);

  const listBadgePath = listConfig.badgePath || "status";
  const selectedBadgeValue = getPath(selected, detailConfig.badgePath || listBadgePath);
  const effectiveActiveTab = visibleTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : visibleTabs[0]?.id || "overview";

  return (
    <div className="space-y-5">
      <div className="glass-panel p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            {layout.eyebrow ? <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-brand-500">{layout.eyebrow}</p> : null}
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink-900">{layout.title || props.title || "Workspace"}</h1>
            {layout.subtitle || props.subtitle ? <p className="mt-1 max-w-3xl text-sm text-ink-500">{layout.subtitle || props.subtitle}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={refreshAll} disabled={loading} className={buttonClass(false)}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {layout.refreshLabel || "Refresh"}
            </button>
            {actions.create ? (
              <button
                type="button"
                onClick={() => setCreateOpen((value) => !value)}
                disabled={actions.create.permission && !permissions.includes(actions.create.permission)}
                title={actions.create.permission && !permissions.includes(actions.create.permission) ? `Missing ${actions.create.permission}` : undefined}
                className={buttonClass(true)}
              >
                <Plus className="h-4 w-4" />
                {actions.create.label || "Create"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {createOpen && actions.create ? (
        <ManagedForm
          config={actions.create}
          optionsPayload={optionsPayload}
          permissions={permissions}
          onSaved={async () => {
            setCreateOpen(false);
            await refreshAll();
          }}
        />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(280px,380px)_1fr]">
        <section className="space-y-3">
          <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-soft">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={listConfig.searchPlaceholder || "Search"}
                className="w-full rounded-xl border border-ink-100 bg-white px-9 py-2 text-sm text-ink-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            {listConfig.filters?.length ? (
              <div className="mt-3 grid gap-2">
                {listConfig.filters.map((filter) => (
                  <FieldInput
                    key={filter.name}
                    field={{ ...filter, type: "select", allowEmpty: true }}
                    values={filters}
                    setValues={setFilters}
                    optionsPayload={optionsPayload}
                  />
                ))}
              </div>
            ) : null}
          </div>
          {loading ? <EmptyState>{layout.loadingLabel || "Loading..."}</EmptyState> : null}
          {!loading ? (
            <RecordList
              items={items}
              selectedId={selectedId}
              config={{
                icon: listConfig.icon,
                titlePath: listConfig.titlePath || "name",
                subtitlePath: listConfig.subtitlePath || "code",
                badgePath: listBadgePath,
                empty: listConfig.emptyLabel
              }}
              onSelect={(item) => {
                setSelectedId(item.id);
                setActiveTab(visibleTabs[0]?.id || "overview");
              }}
            />
          ) : null}
        </section>

        <section className="min-h-[620px]">
          {!selected ? (
            <div className="glass-panel p-6">
              <EmptyState>{detailConfig.emptyLabel || "Select a record."}</EmptyState>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="glass-panel p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-xl font-semibold text-ink-900">
                        {formatValue(getPath(selected, detailConfig.titlePath || listConfig.titlePath || "name"))}
                      </h2>
                      {selectedBadgeValue ? <Pill tone={TONES[String(selectedBadgeValue).toUpperCase()] || "slate"}>{formatValue(selectedBadgeValue, "label")}</Pill> : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-ink-500">{formatValue(getPath(selected, detailConfig.subtitlePath || listConfig.subtitlePath || "code"))}</p>
                  </div>
                  {rowActions.length ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {rowActions.map((action) => {
                        const permissionMissing = action.permission && !permissions.includes(action.permission);
                        const enabledStatuses = normalizeList(action.enabledStatuses).map((status) => String(status).toUpperCase());
                        const statusBlocked = enabledStatuses.length
                          ? !enabledStatuses.includes(String(selectedBadgeValue || "").toUpperCase())
                          : false;
                        const disabled = permissionMissing || statusBlocked || Boolean(actionLoading);
                        const title = permissionMissing
                          ? `Missing ${action.permission}`
                          : statusBlocked
                            ? action.disabledReason || "Action is unavailable for this status."
                            : undefined;
                        const loadingThis = actionLoading === (action.id || action.label || action.endpoint);
                        return (
                          <button
                            key={action.id || action.label || action.endpoint}
                            type="button"
                            disabled={disabled}
                            title={title}
                            onClick={() => runRowAction(action)}
                            className={buttonClass(action.primary === true)}
                          >
                            {loadingThis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {action.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {visibleTabs.map((tab) => {
                    const Icon = ICONS[tab.icon] || Package;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${effectiveActiveTab === tab.id ? "bg-ink-900 text-white" : "border border-ink-100 bg-white text-ink-600"}`}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <TabContent
                tab={visibleTabs.find((tab) => tab.id === effectiveActiveTab) || visibleTabs[0] || {}}
                detail={detail || {}}
                selected={selected}
                optionsPayload={optionsPayload}
                permissions={permissions}
                refreshAll={refreshAll}
                refreshDetail={refreshDetail}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
