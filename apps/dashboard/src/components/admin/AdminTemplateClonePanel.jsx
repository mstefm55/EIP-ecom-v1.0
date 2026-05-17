import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Copy, RefreshCw } from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const DEFAULT_LAYOUT = {
  title: "Template cloning",
  subtitle:
    "Clone a template tenant (processes, UI surfaces, schemas, and dropdowns) into a live tenant.",
  source: {
    title: "Template tenant",
    placeholder: "Search template tenant...",
    empty: "No templates available.",
    helper: "Templates are marked with attrs.template = true.",
  },
  target: {
    title: "Target tenant",
    placeholder: "Search target tenant...",
    empty: "No tenants found.",
    helper: "Target tenants exclude template records.",
  },
  action: {
    clone: "Clone template",
    cloning: "Cloning...",
    refresh: "Refresh",
  },
  summary: {
    title: "Clone summary",
    empty: "Run a clone to see what was inserted.",
  },
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

function formatTenantLabel(tenant) {
  if (!tenant) return "";
  const name = tenant.name || "Unnamed tenant";
  const code = tenant.code || tenant.id;
  return `${name} · ${code}`;
}

export default function AdminTemplateClonePanel({ node }) {
  const layout = useMemo(
    () => mergeLayout(DEFAULT_LAYOUT, node?.props?.layout),
    [node?.props?.layout]
  );
  const [templateOptions, setTemplateOptions] = useState([]);
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateInput, setTemplateInput] = useState("");
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  const [targetOptions, setTargetOptions] = useState([]);
  const [targetQuery, setTargetQuery] = useState("");
  const [targetInput, setTargetInput] = useState("");
  const [targetMenuOpen, setTargetMenuOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [targetLoading, setTargetLoading] = useState(false);

  const [cloning, setCloning] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const templateDisplay = templateMenuOpen
    ? templateInput
    : templateInput || (selectedTemplate ? formatTenantLabel(selectedTemplate) : "");
  const targetDisplay = targetMenuOpen
    ? targetInput
    : targetInput || (selectedTarget ? formatTenantLabel(selectedTarget) : "");

  const handleTemplatePick = (tenant) => {
    setSelectedTemplate(tenant);
    setTemplateInput(formatTenantLabel(tenant));
    setTemplateQuery("");
    setTemplateMenuOpen(false);
  };

  const handleTargetPick = (tenant) => {
    setSelectedTarget(tenant);
    setTargetInput(formatTenantLabel(tenant));
    setTargetQuery("");
    setTargetMenuOpen(false);
  };

  const loadTemplates = async (query) => {
    setTemplateLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      const result = await apiFetch(`/api/eip/admin/template-tenants?${params.toString()}`);
      setTemplateOptions(result.tenants || []);
    } catch (err) {
      setTemplateOptions([]);
    } finally {
      setTemplateLoading(false);
    }
  };

  const loadTargets = async (query) => {
    setTargetLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      const result = await apiFetch(`/api/eip/admin/tenant-lookup?${params.toString()}`);
      setTargetOptions(result.tenants || []);
    } catch (err) {
      setTargetOptions([]);
    } finally {
      setTargetLoading(false);
    }
  };

  const handleClone = async () => {
    setError(null);
    setNotice(null);
    setSummary(null);
    if (!selectedTemplate || !selectedTarget) {
      setError("Select both a template tenant and a target tenant.");
      return;
    }

    setCloning(true);
    try {
      const result = await apiFetch("/api/eip/admin/template-clone", {
        method: "POST",
        body: {
          source_tenant_id: selectedTemplate.id,
          target_tenant_id: selectedTarget.id,
        },
      });
      setSummary(result.summary || null);
      setNotice(
        `Cloned ${selectedTemplate.name || selectedTemplate.code} into ${
          selectedTarget.name || selectedTarget.code
        }.`
      );
    } catch (err) {
      setError(err.message || "Template clone failed.");
    } finally {
      setCloning(false);
    }
  };

  useEffect(() => {
    loadTemplates("");
    loadTargets("");
  }, []);

  useEffect(() => {
    if (!templateMenuOpen) return undefined;
    const handle = setTimeout(() => {
      loadTemplates(templateQuery.trim());
    }, 200);
    return () => clearTimeout(handle);
  }, [templateMenuOpen, templateQuery]);

  useEffect(() => {
    if (!targetMenuOpen) return undefined;
    const handle = setTimeout(() => {
      loadTargets(targetQuery.trim());
    }, 200);
    return () => clearTimeout(handle);
  }, [targetMenuOpen, targetQuery]);

  const summaryRows = [
    { key: "dropdown_lists", label: "Dropdown lists" },
    { key: "dropdown_values", label: "Dropdown values" },
    { key: "schema_registry", label: "Schema registry" },
    { key: "schema_bundles", label: "Schema bundles" },
    { key: "process_defs", label: "Process definitions" },
    { key: "task_templates", label: "Task templates" },
    { key: "process_bindings", label: "Process bindings" },
    { key: "ui_surfaces", label: "UI surfaces" },
    { key: "commercial_conditions", label: "Commercial conditions" },
  ];

  return (
    <section className="glass-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">{layout.title}</h2>
          <p className="mt-1 text-sm text-ink-500">{layout.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadTemplates("");
            loadTargets("");
          }}
          className="flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 hover:bg-white"
        >
          <RefreshCw className="h-4 w-4" />
          {layout.action.refresh}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="rounded-2xl border border-ink-100 bg-white/90 p-4">
          <div className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-ink-500" />
            <h3 className="text-sm font-semibold text-ink-900">{layout.source.title}</h3>
          </div>
          <p className="mt-2 text-xs text-ink-500">{layout.source.helper}</p>
          <div className="relative mt-3">
            <input
              value={templateDisplay}
              onChange={(event) => {
                setTemplateInput(event.target.value);
                setTemplateQuery(event.target.value);
                setSelectedTemplate(null);
                setTemplateMenuOpen(true);
              }}
              onFocus={() => setTemplateMenuOpen(true)}
              onBlur={() => setTimeout(() => setTemplateMenuOpen(false), 150)}
              placeholder={layout.source.placeholder}
              className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
            />
            {templateMenuOpen ? (
              <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-ink-100 bg-white p-1 shadow-lg">
                {templateLoading ? (
                  <div className="px-3 py-2 text-xs text-ink-500">Loading...</div>
                ) : null}
                {!templateLoading && templateOptions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-ink-500">{layout.source.empty}</div>
                ) : null}
                {templateOptions.map((tenant) => (
                  <button
                    type="button"
                    key={tenant.id}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleTemplatePick(tenant);
                    }}
                    onClick={() => handleTemplatePick(tenant)}
                    className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-xs text-ink-700 hover:bg-ink-50"
                  >
                    <span className="font-semibold">{tenant.name || tenant.code || tenant.id}</span>
                    <span className="text-[0.65rem] text-ink-400">{tenant.code}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="hidden items-center justify-center lg:flex">
          <div className="rounded-full border border-ink-100 bg-white/80 p-3 text-ink-400">
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white/90 p-4">
          <div className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-ink-500" />
            <h3 className="text-sm font-semibold text-ink-900">{layout.target.title}</h3>
          </div>
          <p className="mt-2 text-xs text-ink-500">{layout.target.helper}</p>
          <div className="relative mt-3">
            <input
              value={targetDisplay}
              onChange={(event) => {
                setTargetInput(event.target.value);
                setTargetQuery(event.target.value);
                setSelectedTarget(null);
                setTargetMenuOpen(true);
              }}
              onFocus={() => setTargetMenuOpen(true)}
              onBlur={() => setTimeout(() => setTargetMenuOpen(false), 150)}
              placeholder={layout.target.placeholder}
              className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
            />
            {targetMenuOpen ? (
              <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-ink-100 bg-white p-1 shadow-lg">
                {targetLoading ? (
                  <div className="px-3 py-2 text-xs text-ink-500">Loading...</div>
                ) : null}
                {!targetLoading && targetOptions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-ink-500">{layout.target.empty}</div>
                ) : null}
                {targetOptions.map((tenant) => (
                  <button
                    type="button"
                    key={tenant.id}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleTargetPick(tenant);
                    }}
                    onClick={() => handleTargetPick(tenant)}
                    className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-xs text-ink-700 hover:bg-ink-50"
                  >
                    <span className="font-semibold">{tenant.name || tenant.code || tenant.id}</span>
                    <span className="text-[0.65rem] text-ink-400">{tenant.code}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-ink-500">
          {selectedTemplate && selectedTarget
            ? `${selectedTemplate.name || selectedTemplate.code} → ${
                selectedTarget.name || selectedTarget.code
              }`
            : "Select a template and target to clone."}
        </div>
        <button
          type="button"
          onClick={handleClone}
          disabled={cloning || !selectedTemplate || !selectedTarget}
          className="flex items-center gap-2 rounded-full bg-ink-900 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-sm disabled:cursor-not-allowed disabled:bg-ink-300"
        >
          <Copy className="h-4 w-4" />
          {cloning ? layout.action.cloning : layout.action.clone}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-ink-100 bg-white/90 p-4">
        <h3 className="text-sm font-semibold text-ink-900">{layout.summary.title}</h3>
        {!summary ? (
          <p className="mt-2 text-xs text-ink-500">{layout.summary.empty}</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summaryRows.map((row) => (
              <div
                key={row.key}
                className="rounded-xl border border-ink-100 bg-ink-50/60 px-3 py-2 text-xs"
              >
                <p className="text-ink-500">{row.label}</p>
                <p className="mt-1 text-sm font-semibold text-ink-900">
                  {Number.isFinite(summary[row.key]) ? summary[row.key] : 0}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
