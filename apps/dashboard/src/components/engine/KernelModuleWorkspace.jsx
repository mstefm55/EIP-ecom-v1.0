import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  Boxes,
  Briefcase,
  Building2,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileText,
  GitBranch,
  Layers,
  Loader2,
  Mail,
  Package,
  PanelLeft,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const ICONS = {
  activity: Activity,
  alert: AlertTriangle,
  archive: Archive,
  boxes: Boxes,
  briefcase: Briefcase,
  building: Building2,
  check: CheckCircle2,
  clock: Clock3,
  dot: CircleDot,
  document: FileText,
  file: FileText,
  health: CheckCircle2,
  intent: Sparkles,
  link: GitBranch,
  layers: Layers,
  mail: Mail,
  package: Package,
  panel: PanelLeft,
  pipeline: TrendingUp,
  policy: ShieldCheck,
  reorder: TrendingDown,
  sparkles: Sparkles,
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
  QUARANTINE: "amber",
  DRAFT: "slate",
  OPEN: "blue",
  PENDING_APPROVAL: "amber",
  LOW_STOCK: "amber",
  REORDER_NOW: "amber",
  STOCKOUT_PREDICTED: "red",
  ALREADY_OUT_OF_STOCK: "red"
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
  if (format === "currency") {
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    return new Intl.NumberFormat(undefined, { style: "currency", currency: unit || "EUR" }).format(number);
  }
  if (format === "boolean") return value ? "Yes" : "No";
  if (format === "percent") {
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    return `${String(Number(number.toFixed(2)))}%`;
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

function parseApiErrorPayload(error) {
  const message = error?.message || "Request failed.";
  const match = message.match(/API\s+(\d+):\s*(.*)$/s);
  if (!match) return null;
  try {
    return JSON.parse(match[2]);
  } catch {
    return null;
  }
}

function fieldName(field) {
  return field?.name || field?.key || "";
}

function fieldLabel(field) {
  return field?.label || titleize(fieldName(field));
}

function fieldErrorMessage(errorCode, details, field) {
  const label = fieldLabel(field);
  if (errorCode === "TEXT_TOO_LONG" && details?.maxLength) return `${label} must be ${details.maxLength} characters or fewer.`;
  if (errorCode === "TEXT_TOO_LONG") return `${label} is too long.`;
  if (errorCode === "INVALID_COUNTRY_CODE") return `${label} must be a valid country code.`;
  if (errorCode === "INVALID_CURRENCY_CODE") return `${label} must be a valid currency code.`;
  if (errorCode === "INVALID_CODE") return `${label} has an invalid code format.`;
  return titleize(errorCode || "Invalid value");
}

function fieldErrorKey(value, fields) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const direct = fields.find((field) => fieldName(field) === normalized);
  if (direct) return fieldName(direct);
  const lowered = normalized.toLowerCase();
  const match = fields.find((field) => fieldName(field).toLowerCase() === lowered);
  return match ? fieldName(match) : normalized;
}

function fieldErrorsFromApi(error, fields, values) {
  const payload = parseApiErrorPayload(error);
  const details = payload?.details && typeof payload.details === "object" ? payload.details : {};
  const out = {};
  const add = (fieldValue, message = null) => {
    const key = fieldErrorKey(fieldValue, fields);
    if (!key) return;
    const field = fields.find((candidate) => fieldName(candidate) === key);
    out[key] = message || fieldErrorMessage(payload?.error, details, field || { name: key });
  };

  add(details.field || details.path || payload?.field);

  if (Array.isArray(details.fields)) {
    for (const item of details.fields) {
      if (typeof item === "string") add(item);
      else add(item?.field || item?.path || item?.name, item?.message);
    }
  }

  if (payload?.error === "TEXT_TOO_LONG" && Object.keys(out).length === 0) {
    for (const field of fields) {
      const maxLength = Number(field.maxLength);
      if (!Number.isFinite(maxLength) || maxLength <= 0) continue;
      const value = inputValue(values, field);
      if (String(value ?? "").trim().length > maxLength) add(fieldName(field));
    }
  }

  return out;
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

function LookupField({ field, values, setValues, disabled, error, clearFieldError }) {
  const value = inputValue(values, field);
  const label = fieldLabel(field);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const hasError = Boolean(error);
  const labelClass = hasError ? "text-rose-600" : "text-ink-400";
  const inputClass = hasError
    ? "mb-2 w-full rounded-xl border border-rose-300 bg-rose-50/70 px-3 py-2 text-sm text-rose-700 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100 disabled:opacity-60"
    : "mb-2 w-full rounded-xl border border-ink-100 bg-white/90 px-3 py-2 text-sm text-ink-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 disabled:opacity-60";
  const selectClass = hasError
    ? "w-full rounded-xl border border-rose-300 bg-rose-50/70 px-3 py-2 text-sm text-rose-700 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100 disabled:opacity-60"
    : "w-full rounded-xl border border-ink-100 bg-white/90 px-3 py-2 text-sm text-ink-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 disabled:opacity-60";

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
      <span className={`mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${labelClass}`}>{label}</span>
      <input
        disabled={disabled}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          clearFieldError?.();
        }}
        placeholder={field.placeholder || "Search"}
        aria-invalid={hasError || undefined}
        className={inputClass}
      />
      <select
        disabled={disabled || loading}
        value={value}
        onChange={(event) => {
          updateInputValue(setValues, field, event.target.value);
          clearFieldError?.();
        }}
        aria-invalid={hasError || undefined}
        className={selectClass}
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
      {hasError ? <span className="mt-1 block text-xs font-semibold text-rose-600">{error}</span> : null}
    </label>
  );
}

function FieldInput({ field, values, setValues, disabled, optionsPayload, error, clearFieldError }) {
  const value = inputValue(values, field);
  const label = fieldLabel(field);
  const hasError = Boolean(error);
  const labelClass = hasError ? "text-rose-600" : "text-ink-400";
  const baseClass = hasError
    ? "w-full rounded-xl border border-rose-300 bg-rose-50/70 px-3 py-2 text-sm text-rose-700 outline-none transition placeholder:text-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 disabled:opacity-60"
    : "w-full rounded-xl border border-ink-100 bg-white/90 px-3 py-2 text-sm text-ink-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 disabled:opacity-60";
  const describedBy = hasError ? `${fieldName(field)}-error` : undefined;
  const handleValueChange = (nextValue) => {
    updateInputValue(setValues, field, nextValue);
    clearFieldError?.();
  };

  if (field.type === "hidden") {
    return null;
  }

  if (field.type === "lookup") {
    return <LookupField field={field} values={values} setValues={setValues} disabled={disabled} error={error} clearFieldError={clearFieldError} />;
  }

  if (field.type === "select") {
    return (
      <label className="block">
        <span className={`mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${labelClass}`}>{label}</span>
        <select
          disabled={disabled}
          value={value}
          onChange={(event) => handleValueChange(event.target.value)}
          aria-describedby={describedBy}
          aria-invalid={hasError || undefined}
          className={baseClass}
        >
          {field.allowEmpty ? <option value="">{field.emptyLabel || "Any"}</option> : null}
          {fieldOptions(field, optionsPayload).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {hasError ? <span id={describedBy} className="mt-1 block text-xs font-semibold text-rose-600">{error}</span> : null}
      </label>
    );
  }

  if (field.type === "multiselect") {
    const selected = new Set(normalizeList(value));
    return (
      <fieldset disabled={disabled} className="block">
        <legend className={`mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${labelClass}`}>{label}</legend>
        <div className={`flex flex-wrap gap-2 rounded-xl border p-2 ${hasError ? "border-rose-300 bg-rose-50/70 text-rose-700" : "border-ink-100 bg-white/90"}`}>
          {fieldOptions(field, optionsPayload).map((option) => (
            <label key={option.value} className="inline-flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-2 py-1 text-xs text-ink-600">
              <input
                type="checkbox"
                checked={selected.has(option.value)}
                onChange={(event) => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(option.value);
                  else next.delete(option.value);
                  handleValueChange([...next]);
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
        {hasError ? <span className="mt-1 block text-xs font-semibold text-rose-600">{error}</span> : null}
      </fieldset>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="block">
        <span className={`mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${labelClass}`}>{label}</span>
        <textarea
          disabled={disabled}
          rows={field.rows || 3}
          value={value}
          placeholder={field.placeholder}
          onChange={(event) => handleValueChange(event.target.value)}
          aria-describedby={describedBy}
          aria-invalid={hasError || undefined}
          className={baseClass}
        />
        {hasError ? <span id={describedBy} className="mt-1 block text-xs font-semibold text-rose-600">{error}</span> : null}
      </label>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${hasError ? "border-rose-300 bg-rose-50/70 text-rose-700" : "border-ink-100 bg-white/90 text-ink-600"}`}>
        <input
          disabled={disabled}
          type="checkbox"
          checked={value === true}
          onChange={(event) => handleValueChange(event.target.checked)}
          aria-describedby={describedBy}
          aria-invalid={hasError || undefined}
        />
        {label}
        {hasError ? <span id={describedBy} className="text-xs font-semibold text-rose-600">{error}</span> : null}
      </label>
    );
  }

  return (
    <label className="block">
      <span className={`mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${labelClass}`}>{label}</span>
      <input
        disabled={disabled}
        type={field.type || "text"}
        value={value}
        placeholder={field.placeholder}
        onChange={(event) => handleValueChange(event.target.value)}
        aria-describedby={describedBy}
        aria-invalid={hasError || undefined}
        className={baseClass}
      />
      {hasError ? <span id={describedBy} className="mt-1 block text-xs font-semibold text-rose-600">{error}</span> : null}
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

function validateFormValues(fields, values) {
  const fieldErrors = {};
  for (const field of fields) {
    const name = fieldName(field);
    if (!name || field.type === "hidden") continue;
    const value = inputValue(values, field);
    const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
    if (field.required && !text.trim()) {
      fieldErrors[name] = `${fieldLabel(field)} is required.`;
      continue;
    }
    const maxLength = Number(field.maxLength);
    if (Number.isFinite(maxLength) && maxLength > 0 && text.trim().length > maxLength) {
      fieldErrors[name] = `${fieldLabel(field)} must be ${maxLength} characters or fewer.`;
    }
  }
  return fieldErrors;
}

function fieldGridClass(field) {
  const span = field.span || field.layout || field.width;
  if (span === "full" || field.fullWidth) return "md:col-span-2 xl:col-span-3";
  if (span === "wide" || span === 2 || span === "2") return "md:col-span-2";
  return "";
}

function ManagedFormState({ config, fields, initialValues, selected, row, optionsPayload, permissions, onSaved }) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const permission = config?.permission;
  const disabled = Boolean(permission) && !permissions.includes(permission);
  const clearFieldError = (name) => {
    if (!name) return;
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  async function submit(event) {
    event.preventDefault();
    if (disabled) return;
    setError("");
    setFieldErrors({});
    const localFieldErrors = validateFormValues(fields, values);
    if (Object.keys(localFieldErrors).length) {
      setFieldErrors(localFieldErrors);
      setError("Review the highlighted field.");
      return;
    }
    setSaving(true);
    try {
      const body = cleanBody(values);
      await apiFetch(endpointFor(config.endpoint, selected, row), {
        method: config.method || "POST",
        body
      });
      await onSaved?.();
      if (config.resetOnSave !== false) setValues(initialValues);
    } catch (err) {
      const nextFieldErrors = fieldErrorsFromApi(err, fields, values);
      setFieldErrors(nextFieldErrors);
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-ink-100/70 bg-white/80 p-4">
      {config.title ? <h3 className="text-base font-semibold text-ink-900">{config.title}</h3> : null}
      {config.subtitle ? <p className="mt-1 text-sm text-ink-400">{config.subtitle}</p> : null}
      {error ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      <div className={`mt-4 grid gap-3 ${config.columns === 1 ? "" : "md:grid-cols-2 xl:grid-cols-3"}`}>
        {fields.map((field) => {
          const name = fieldName(field);
          if (field.type === "hidden") {
            return (
              <FieldInput
                key={name}
                field={field}
                values={values}
                setValues={setValues}
                disabled={disabled || saving}
                optionsPayload={optionsPayload}
              />
            );
          }
          return (
            <div key={name} className={fieldGridClass(field)}>
              <FieldInput
                field={field}
                values={values}
                setValues={setValues}
                disabled={disabled || saving}
                optionsPayload={optionsPayload}
                error={fieldErrors[name]}
                clearFieldError={() => clearFieldError(name)}
              />
            </div>
          );
        })}
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
    <div className="rounded-2xl border border-dashed border-ink-100 bg-white/70 p-5 text-sm text-ink-500">
      {children}
    </div>
  );
}

function valueFromSpec(spec, data) {
  const value = spec.path ? getPath(data, spec.path, spec.value) : spec.value;
  return value === undefined || value === null || value === "" ? spec.fallback : value;
}

function FieldList({ fields, data, compact = false }) {
  const visible = normalizeList(fields).filter(Boolean);
  if (!visible.length) return null;
  return (
    <div className={`grid gap-2 ${compact ? "" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
      {visible.map((field) => {
        const value = valueFromSpec(field, data);
        const unit = field.unitPath ? getPath(data, field.unitPath) : field.unit;
        return (
          <div key={`${field.label}-${field.path || field.value}`} className={compact ? "min-w-0" : "rounded-2xl border border-ink-100/70 bg-white/70 px-3 py-2"}>
            <p className="truncate text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-ink-400">{field.label}</p>
            <p className="mt-1 truncate text-xs font-semibold text-ink-700">{formatValue(value, field.format, unit)}</p>
          </div>
        );
      })}
    </div>
  );
}

function HeroMetrics({ metrics, items, data }) {
  const configured = normalizeList(metrics);
  const statusCounts = items.reduce((acc, item) => {
    const status = getPath(item, "status") || getPath(item, "mapping_status") || "records";
    const key = String(status || "records").toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const cards = configured.length
    ? configured.map((metric) => ({ ...metric, value: valueFromSpec(metric, data) }))
    : [
        { label: "Records", value: items.length, icon: "panel" },
        ...Object.entries(statusCounts).slice(0, 2).map(([status, count]) => ({ label: titleize(status), value: count, icon: "dot" }))
      ];
  return (
    <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[24rem]">
      {cards.map((metric) => {
        const Icon = ICONS[metric.icon] || CircleDot;
        const unit = metric.unitPath ? getPath(data, metric.unitPath) : metric.unit;
        return (
          <div key={`${metric.label}-${metric.path || metric.value}`} className="rounded-2xl border border-ink-100/70 bg-white/75 px-3 py-2 shadow-soft">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-500">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-ink-400">{metric.label}</p>
                <p className="truncate text-sm font-semibold text-ink-900">{formatValue(metric.value, metric.format, unit)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function disabledReasonForAction(action, permissions, statusValue, loading) {
  if (loading) return "";
  if (action.permission && !permissions.includes(action.permission)) return action.permissionDeniedReason || `Missing ${action.permission}`;
  const enabledStatuses = normalizeList(action.enabledStatuses).map((status) => String(status).toUpperCase());
  if (enabledStatuses.length && !enabledStatuses.includes(String(statusValue || "").toUpperCase())) {
    return action.disabledReason || "Action is unavailable for this status.";
  }
  return "";
}

function ActionButton({ action, permissions, statusValue, loading, onClick, icon }) {
  const reason = disabledReasonForAction(action, permissions, statusValue, loading);
  const disabled = Boolean(reason) || loading;
  const ButtonIcon = icon || ICONS[action.icon] || Save;
  return (
    <div className="min-w-[8rem]">
      <button
        type="button"
        disabled={disabled}
        title={reason || undefined}
        onClick={onClick}
        className={buttonClass(action.primary === true)}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ButtonIcon className="h-4 w-4" />}
        {action.label}
      </button>
      {reason ? <p className="mt-1 max-w-[12rem] text-[0.58rem] font-medium leading-snug text-ink-400">{reason}</p> : null}
    </div>
  );
}

function ProcessIntentStrip({ config, data }) {
  if (!config) return null;
  const stage = valueFromSpec(config.stage || {}, data);
  const nextAction = valueFromSpec(config.nextAction || {}, data);
  const blocked = valueFromSpec(config.blocked || {}, data);
  const approval = valueFromSpec(config.approval || {}, data);
  const taskCount = valueFromSpec(config.taskCount || {}, data);
  const hasContent = [stage, nextAction, blocked, approval, taskCount].some((value) => value !== undefined && value !== null && value !== "" && value !== "-");
  if (!hasContent) return null;
  const blockedActive = Array.isArray(blocked) ? blocked.length > 0 : Boolean(blocked && blocked !== "-");
  return (
    <div className="rounded-2xl border border-ink-100/70 bg-ink-950 p-4 text-white shadow-soft">
      <div className="grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2">
          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-white/45">{config.label || "Process intent"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Pill tone={blockedActive ? "amber" : "blue"}>{formatValue(stage || config.stage?.fallback || "In progress", config.stage?.format || "label")}</Pill>
            {approval ? <Pill tone={String(approval).toUpperCase().includes("PENDING") ? "amber" : "slate"}>{formatValue(approval, config.approval?.format || "label")}</Pill> : null}
          </div>
        </div>
        <div className="md:col-span-2">
          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-white/45">Next best action</p>
          <p className="mt-2 text-sm font-semibold text-white">{formatValue(nextAction || config.nextAction?.fallback || "Review current state")}</p>
          {blockedActive ? <p className="mt-1 text-xs text-amber-100">{formatValue(blocked, config.blocked?.format || "array")}</p> : null}
        </div>
        <div>
          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-white/45">Linked tasks</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatValue(taskCount ?? 0, "number")}</p>
        </div>
      </div>
    </div>
  );
}

function OverviewCards({ cards, data }) {
  const visible = normalizeList(cards);
  if (!visible.length) return null;
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {visible.map((card) => {
        const Icon = ICONS[card.icon] || Sparkles;
        const value = valueFromSpec(card, data);
        const unit = card.unitPath ? getPath(data, card.unitPath) : card.unit;
        const toneValue = String(getPath(data, card.tonePath, value) || "").toUpperCase();
        const tone = TONES[toneValue] || card.tone || "slate";
        return (
          <div key={`${card.label}-${card.path || card.value}`} className="rounded-xl border border-ink-100/70 bg-white/85 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-ink-400">{card.label}</p>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-500">
                <Icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="min-w-0 break-words text-sm font-semibold text-ink-900">{formatValue(value, card.format, unit)}</p>
              {card.badge ? <Pill tone={tone}>{card.badge}</Pill> : null}
            </div>
            {card.hint ? <p className="mt-1 text-xs leading-relaxed text-ink-500">{card.hint}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function KernelTabbedFormPanel({ tabs, activeTab, onChange, children }) {
  if (!tabs.length) {
    return (
      <section className="rounded-2xl border border-ink-100/70 bg-white/75 p-4 shadow-soft">
        {children}
      </section>
    );
  }
  return (
    <section className="glass-panel overflow-hidden border border-ink-100/60 bg-white/75 shadow-soft">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-100/70 bg-white/70 px-4 py-3">
        {tabs.map((tab) => {
          const Icon = ICONS[tab.icon] || Package;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] transition ${
                activeTab === tab.id
                  ? "bg-ink-900 text-white shadow-soft"
                  : "border border-ink-100/70 bg-white/80 text-ink-600 hover:bg-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="bg-white/55 p-4">
        {children}
      </div>
    </section>
  );
}

function SummaryRows({ rows, data }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {normalizeList(rows).map((row) => {
        const value = getPath(data, row.path, row.value);
        const unit = row.unitPath ? getPath(data, row.unitPath) : row.unit;
        return (
          <div key={`${row.label}-${row.path || row.value}`} className="rounded-xl border border-ink-100/70 bg-white/80 px-3 py-2 shadow-soft">
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-ink-400">{row.label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-ink-800">{formatValue(value, row.format, unit)}</p>
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
            className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === id ? "border-ink-900 bg-ink-900 text-white shadow-soft" : "border-white/70 bg-white/75 hover:border-brand-200 hover:bg-white"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selectedId === id ? "bg-white text-ink-900" : "bg-ink-900 text-white"}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-semibold ${selectedId === id ? "text-white" : "text-ink-800"}`}>{title}</p>
                  <p className={`truncate text-xs ${selectedId === id ? "text-white/60" : "text-ink-400"}`}>{subtitle}</p>
                </div>
              </div>
              {badgeValue ? <Pill tone={TONES[String(badgeValue).toUpperCase()] || "slate"}>{formatValue(badgeValue, "label")}</Pill> : null}
            </div>
            {config.meta?.length ? (
              <div className={`mt-3 rounded-xl border px-3 py-2 ${selectedId === id ? "border-white/10 bg-white/10" : "border-ink-100/70 bg-ink-50/60"}`}>
                <FieldList fields={config.meta} data={item} compact />
              </div>
            ) : null}
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
                  const rowBadgeValue = getPath(selectedRow, action.statusPath || tab.badgePath || "status");
                  const actionKey = action.id || action.label || action.endpoint;
                  return (
                    <ActionButton
                      key={actionKey}
                      action={action}
                      permissions={permissions}
                      statusValue={rowBadgeValue}
                      loading={collectionActionLoading === actionKey}
                      onClick={() => runCollectionAction(action, selectedRow)}
                    />
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

  if (tab.type === "communications") {
    const configured = tab.providerConfiguredPath ? getPath(data, tab.providerConfiguredPath) === true : false;
    const items = normalizeList(getPath(data, tab.itemsPath));
    if (!configured && !items.length) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold">{tab.disabledTitle || "Communications unavailable"}</p>
              <p className="mt-1 text-amber-700">{tab.disabledMessage || "Communication provider not configured"}</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-soft">
        <RecordList items={items} config={{ ...tab, empty: tab.empty || "No communication summaries linked." }} />
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
  const activeTabConfig = visibleTabs.find((tab) => tab.id === effectiveActiveTab) || visibleTabs[0] || {};
  const workspaceData = { items, selected, item: selected, detail, optionsPayload, ...(detail || {}) };
  const processConfig = detailConfig.process || layout.process;
  const overviewCards = detailConfig.overviewCards || layout.overviewCards;
  const ModuleIcon = ICONS[layout.icon || listConfig.icon] || Package;

  return (
    <div className="space-y-4">
      <div className="glass-panel border border-ink-100/60 bg-white/75 p-5 shadow-soft">
        <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink-900 text-white shadow-soft">
              <ModuleIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              {layout.eyebrow ? <p className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-brand-500">{layout.eyebrow}</p> : null}
              <h1 className="mt-1 font-display text-2xl font-semibold text-ink-900">{layout.title || props.title || "Workspace"}</h1>
              {layout.subtitle || props.subtitle ? <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-500">{layout.subtitle || props.subtitle}</p> : null}
              {layout.processHealth ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-ink-100/70 bg-white/80 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-ink-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {layout.processHealth.label || "Process health"}: {formatValue(valueFromSpec(layout.processHealth, workspaceData), layout.processHealth.format || "label")}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-3 xl:items-end">
            <HeroMetrics metrics={layout.metrics} items={items} data={workspaceData} />
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <button type="button" onClick={refreshAll} disabled={loading} className={buttonClass(false)}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {layout.refreshLabel || "Refresh"}
            </button>
            {actions.create ? (
              <ActionButton
                action={{ ...actions.create, label: actions.create.label || "Create" }}
                permissions={permissions}
                loading={false}
                icon={Plus}
                onClick={() => setCreateOpen((value) => !value)}
              />
            ) : null}
            </div>
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

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,400px)_1fr]">
        <section className="space-y-3">
          <div className="glass-panel border border-ink-100/60 bg-white/75 p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-ink-400">{listConfig.label || "Records"}</p>
                <p className="text-sm font-semibold text-ink-900">{items.length} visible</p>
              </div>
              <PanelLeft className="h-4 w-4 text-ink-300" />
            </div>
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
                empty: listConfig.emptyLabel,
                meta: listConfig.meta
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
              <div className="glass-panel border border-ink-100/60 bg-white/75 p-5 shadow-soft">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-xl font-semibold text-ink-900">
                        {formatValue(getPath(selected, detailConfig.titlePath || listConfig.titlePath || "name"))}
                      </h2>
                      {selectedBadgeValue ? <Pill tone={TONES[String(selectedBadgeValue).toUpperCase()] || "slate"}>{formatValue(selectedBadgeValue, "label")}</Pill> : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-ink-500">{formatValue(getPath(selected, detailConfig.subtitlePath || listConfig.subtitlePath || "code"))}</p>
                    <div className="mt-3">
                      <FieldList fields={detailConfig.meta} data={workspaceData} />
                    </div>
                  </div>
                  {rowActions.length ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {rowActions.map((action) => {
                        const loadingThis = actionLoading === (action.id || action.label || action.endpoint);
                        return (
                          <ActionButton
                            key={action.id || action.label || action.endpoint}
                            action={action}
                            permissions={permissions}
                            statusValue={selectedBadgeValue}
                            loading={loadingThis}
                            onClick={() => runRowAction(action)}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
              <ProcessIntentStrip config={processConfig} data={workspaceData} />
              <KernelTabbedFormPanel tabs={visibleTabs} activeTab={effectiveActiveTab} onChange={setActiveTab}>
                <div className="space-y-4">
                  {activeTabConfig.id === "overview" ? <OverviewCards cards={overviewCards} data={workspaceData} /> : null}
                  <TabContent
                    tab={activeTabConfig}
                    detail={detail || {}}
                    selected={selected}
                    optionsPayload={optionsPayload}
                    permissions={permissions}
                    refreshAll={refreshAll}
                    refreshDetail={refreshDetail}
                  />
                </div>
              </KernelTabbedFormPanel>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
