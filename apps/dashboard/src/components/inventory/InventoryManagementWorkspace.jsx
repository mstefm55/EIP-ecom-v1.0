import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Boxes,
  FileText,
  Layers,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  TrendingDown,
  Users
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const ENDPOINTS = {
  overview: "/api/eip/inventory/overview",
  materials: "/api/eip/inventory/materials",
  materialDetail: "/api/eip/inventory/materials/:id",
  materialSummary: "/api/eip/inventory/materials/:id/summary",
  materialLots: "/api/eip/inventory/materials/:id/lots",
  lotDetail: "/api/eip/inventory/lots/:id",
  recommendations: "/api/eip/inventory/reorder-recommendations",
  policiesEffective: "/api/eip/inventory/policies/effective",
  options: "/api/eip/inventory/governance/options"
};

const PERMISSIONS = {
  read: "inventory.read",
  materialCreate: "inventory.material.create",
  materialUpdate: "inventory.material.update",
  lotCreate: "inventory.lot.create",
  lotUpdate: "inventory.lot.update",
  recommendationRead: "inventory.recommendation.read",
  policyRead: "inventory.policy.read"
};

const DEFAULT_MATERIAL_FORM = {
  code: "",
  name: "",
  material_type: "OTHER",
  status: "ACTIVE",
  unit_of_measure: "pcs",
  category: "",
  family: "",
  default_supplier_entity_id: "",
  reorder_point: "",
  reorder_qty: "",
  safety_stock: "",
  notes: ""
};

const DEFAULT_LOT_FORM = {
  lot_code: "",
  quantity: "",
  unit: "pcs",
  status: "AVAILABLE",
  received_date: "",
  expiry_date: "",
  location_ref: "",
  supplier_agent_id: "",
  notes: ""
};

const TAB_ICONS = {
  overview: Boxes,
  materials: Package,
  lots: Layers,
  reorder: TrendingDown,
  policies: ShieldCheck,
  documents: FileText,
  activity: Archive
};

function cleanBody(input) {
  return Object.fromEntries(
    Object.entries(input || {}).filter(([, value]) => value !== "" && value !== null && value !== undefined)
  );
}

function pathFor(template, id) {
  return String(template || "").replace(":id", id);
}

function parseApiError(error) {
  const message = error?.message || "Request failed.";
  const match = message.match(/API\s+(\d+):\s*(.*)$/s);
  if (!match) return message;
  try {
    const payload = JSON.parse(match[2]);
    if (payload?.error === "FORBIDDEN") return "Access denied.";
    if (payload?.error) return payload.error.replaceAll("_", " ");
  } catch {
    return message;
  }
  return message;
}

function formatLabel(value) {
  const text = String(value || "").replaceAll("_", " ").trim();
  return text ? text.replace(/\b\w/g, (char) => char.toUpperCase()) : "-";
}

function formatQty(value, unit) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${Number(number.toFixed(3))}${unit ? ` ${unit}` : ""}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function optionRows(options, listCodes, fallback) {
  for (const code of listCodes) {
    if (options?.[code]?.length) return options[code];
  }
  return (fallback || []).map((code) => ({ code, label: formatLabel(code) }));
}

function Pill({ children, tone = "slate" }) {
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

function statusTone(status) {
  const value = String(status || "").toUpperCase();
  if (["ACTIVE", "AVAILABLE", "IN_STOCK", "HEALTHY"].includes(value)) return "green";
  if (["BLOCKED", "EXPIRED", "ARCHIVED", "OUT_OF_STOCK", "NEGATIVE_STOCK"].includes(value)) return "red";
  if (["RESERVED", "UNDER_REVIEW", "QUARANTINE", "LOW_STOCK", "WATCH", "REORDER_NOW"].includes(value)) return "amber";
  return "slate";
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-ink-400">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-ink-100 bg-white/90 px-3 py-2 text-sm text-ink-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 disabled:opacity-60 ${props.className || ""}`}
    />
  );
}

function SelectInput({ children, ...props }) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-ink-100 bg-white/90 px-3 py-2 text-sm text-ink-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 disabled:opacity-60 ${props.className || ""}`}
    >
      {children}
    </select>
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-ink-100 bg-white/90 px-3 py-2 text-sm text-ink-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 disabled:opacity-60 ${props.className || ""}`}
    />
  );
}

function EmptyState({ title }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-100 bg-white/60 p-5 text-sm text-ink-400">
      {title}
    </div>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-400">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-ink-400" /> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-ink-900">{value ?? 0}</p>
    </div>
  );
}

function SubmitButton({ saving, disabled, title, children }) {
  return (
    <button
      type="submit"
      disabled={saving || disabled}
      title={title}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {children}
    </button>
  );
}

export default function InventoryManagementWorkspace({ node }) {
  const props = node?.props || {};
  const endpoints = { ...ENDPOINTS, ...(props.endpoints || {}) };
  const tabs = props.tabs || [
    { id: "overview", label: "Overview" },
    { id: "materials", label: "Materials" },
    { id: "lots", label: "Lots" },
    { id: "reorder", label: "Reorder" },
    { id: "policies", label: "Policies" },
    { id: "documents", label: "Documents" },
    { id: "activity", label: "Activity" }
  ];

  const [activeTab, setActiveTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [materials, setMaterials] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [policyPayload, setPolicyPayload] = useState(null);
  const [optionsPayload, setOptionsPayload] = useState({ options: {}, defaults: {}, permissions: [] });
  const [createOpen, setCreateOpen] = useState(false);
  const [materialForm, setMaterialForm] = useState(DEFAULT_MATERIAL_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_MATERIAL_FORM);
  const [lotForm, setLotForm] = useState(DEFAULT_LOT_FORM);
  const [selectedLotId, setSelectedLotId] = useState(null);
  const [lotEditForm, setLotEditForm] = useState(DEFAULT_LOT_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const permissions = useMemo(() => optionsPayload.permissions || [], [optionsPayload.permissions]);
  const can = useCallback((permission) => permissions.includes(permission), [permissions]);
  const options = optionsPayload.options || {};
  const materialTypes = optionRows(options, ["INVENTORY_MATERIAL_TYPE", "MATERIAL_TYPE"], optionsPayload.defaults?.material_types);
  const materialStatuses = optionRows(options, ["INVENTORY_MATERIAL_STATUS"], optionsPayload.defaults?.material_statuses);
  const lotStatuses = optionRows(options, ["INVENTORY_LOT_STATUS", "MATERIAL_LOT_STATUS"], optionsPayload.defaults?.lot_statuses);

  const materialQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (query) params.set("q", query);
    return params.toString();
  }, [query]);

  const selected = detail?.item || materials.find((item) => item.id === selectedId) || null;
  const lots = detail?.lots || [];
  const documents = detail?.documents || [];
  const suppliers = detail?.suppliers || [];
  const selectedLot = lots.find((lot) => lot.id === selectedLotId) || lots[0] || null;

  const stats = useMemo(() => ({
    materials: materials.length,
    active: materials.filter((item) => item.status === "ACTIVE").length,
    lots: materials.reduce((sum, item) => sum + Number(item.stock_summary?.lot_count || 0), 0),
    reorder: recommendations.filter((item) => item.suggested_action === "create_reorder_suggestion").length,
    suppliers: suppliers.length,
    documents: documents.length
  }), [documents.length, materials, recommendations, suppliers.length]);

  const loadOptions = useCallback(async () => {
    const payload = await apiFetch(endpoints.options);
    setOptionsPayload(payload || { options: {}, defaults: {}, permissions: [] });
  }, [endpoints.options]);

  const loadMaterials = useCallback(async () => {
    const payload = await apiFetch(`${endpoints.materials}?${materialQuery}`);
    const items = payload?.items || [];
    setMaterials(items);
    setSelectedId((current) => current || items[0]?.id || null);
  }, [endpoints.materials, materialQuery]);

  const loadRecommendations = useCallback(async () => {
    try {
      const payload = await apiFetch(`${endpoints.recommendations}?limit=100`);
      setRecommendations(payload?.items || []);
    } catch (err) {
      if (String(err?.message || "").includes("403")) return;
      throw err;
    }
  }, [endpoints.recommendations]);

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    const payload = await apiFetch(pathFor(endpoints.materialDetail, id));
    setDetail(payload);
    const item = payload?.item || {};
    const profile = item.stock_profile || {};
    setEditForm({
      code: item.code || "",
      name: item.name || "",
      material_type: item.material_type || "OTHER",
      status: item.status || "ACTIVE",
      unit_of_measure: item.unit_of_measure || profile.unit_of_measure || "pcs",
      category: item.category || "",
      family: item.family || "",
      default_supplier_entity_id: item.default_supplier_entity_id || "",
      reorder_point: profile.reorder_point ?? "",
      reorder_qty: profile.reorder_qty ?? "",
      safety_stock: profile.safety_stock ?? "",
      notes: item.notes || ""
    });
    setLotForm((current) => ({ ...current, unit: item.unit_of_measure || profile.unit_of_measure || "pcs" }));
    const firstLot = payload?.lots?.[0] || null;
    setSelectedLotId((current) => current || firstLot?.id || null);
  }, [endpoints.materialDetail]);

  const loadPolicy = useCallback(async (id) => {
    if (!id) {
      setPolicyPayload(null);
      return;
    }
    try {
      const payload = await apiFetch(`${endpoints.policiesEffective}?material_id=${encodeURIComponent(id)}`);
      setPolicyPayload(payload);
    } catch (err) {
      if (String(err?.message || "").includes("403")) {
        setPolicyPayload(null);
        return;
      }
      throw err;
    }
  }, [endpoints.policiesEffective]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setNotice("");
    setError("");
    try {
      await loadOptions();
      await Promise.all([loadMaterials(), loadRecommendations()]);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [loadMaterials, loadOptions, loadRecommendations]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    async function loadSelected() {
      setError("");
      try {
        await loadDetail(selectedId);
        await loadPolicy(selectedId);
      } catch (err) {
        setError(parseApiError(err));
      }
    }
    void loadSelected();
  }, [loadDetail, loadPolicy, selectedId]);

  useEffect(() => {
    if (!selectedLot) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLotEditForm({
      lot_code: selectedLot.lot_code || "",
      quantity: selectedLot.quantity ?? "",
      unit: selectedLot.unit || selectedLot.unit_of_measure || selected?.unit_of_measure || "pcs",
      status: selectedLot.status || "AVAILABLE",
      received_date: selectedLot.received_date || "",
      expiry_date: selectedLot.expiry_date || "",
      location_ref: selectedLot.location_ref || "",
      supplier_agent_id: selectedLot.supplier_agent_id || "",
      notes: selectedLot.notes || ""
    });
  }, [selected?.unit_of_measure, selectedLot]);

  async function submitMaterialCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = await apiFetch(endpoints.materials, {
        method: "POST",
        body: cleanBody({
          ...materialForm,
          reorder_point: materialForm.reorder_point === "" ? undefined : Number(materialForm.reorder_point),
          reorder_qty: materialForm.reorder_qty === "" ? undefined : Number(materialForm.reorder_qty),
          safety_stock: materialForm.safety_stock === "" ? undefined : Number(materialForm.safety_stock)
        })
      });
      setCreateOpen(false);
      setMaterialForm(DEFAULT_MATERIAL_FORM);
      await loadMaterials();
      setSelectedId(payload?.item?.id || null);
      setNotice("Material saved.");
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitMaterialUpdate(event) {
    event.preventDefault();
    if (!selected?.id) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(pathFor(endpoints.materialDetail, selected.id), {
        method: "PATCH",
        body: cleanBody({
          ...editForm,
          reorder_point: editForm.reorder_point === "" ? undefined : Number(editForm.reorder_point),
          reorder_qty: editForm.reorder_qty === "" ? undefined : Number(editForm.reorder_qty),
          safety_stock: editForm.safety_stock === "" ? undefined : Number(editForm.safety_stock)
        })
      });
      await Promise.all([loadMaterials(), loadDetail(selected.id), loadRecommendations(), loadPolicy(selected.id)]);
      setNotice("Material updated.");
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitLotCreate(event) {
    event.preventDefault();
    if (!selected?.id) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = await apiFetch(pathFor(endpoints.materialLots, selected.id), {
        method: "POST",
        body: cleanBody({ ...lotForm, quantity: lotForm.quantity === "" ? undefined : Number(lotForm.quantity) })
      });
      setLotForm({ ...DEFAULT_LOT_FORM, unit: selected.unit_of_measure || "pcs" });
      setSelectedLotId(payload?.item?.id || null);
      await Promise.all([loadMaterials(), loadDetail(selected.id), loadRecommendations()]);
      setNotice("Lot saved.");
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function submitLotUpdate(event) {
    event.preventDefault();
    if (!selectedLot?.id || !selected?.id) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(pathFor(endpoints.lotDetail, selectedLot.id), {
        method: "PATCH",
        body: cleanBody({ ...lotEditForm, quantity: lotEditForm.quantity === "" ? undefined : Number(lotEditForm.quantity) })
      });
      await Promise.all([loadMaterials(), loadDetail(selected.id), loadRecommendations()]);
      setNotice("Lot updated.");
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  const missingCreateMaterial = !can(PERMISSIONS.materialCreate);
  const missingUpdateMaterial = !can(PERMISSIONS.materialUpdate);
  const missingCreateLot = !can(PERMISSIONS.lotCreate);
  const missingUpdateLot = !can(PERMISSIONS.lotUpdate);

  return (
    <div className="space-y-5">
      <div className="glass-panel p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-brand-500">Inventory Management</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink-900">{props.title || "Inventory"}</h1>
            <p className="mt-1 max-w-3xl text-sm text-ink-500">{props.subtitle || "Materials, lots, stock, policies, and activity."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshAll}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2 text-xs font-semibold text-ink-600 shadow-soft disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen((value) => !value)}
              disabled={missingCreateMaterial}
              title={missingCreateMaterial ? "Missing inventory.material.create" : undefined}
              className="inline-flex items-center gap-2 rounded-xl bg-ink-900 px-3 py-2 text-xs font-semibold text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Create material
            </button>
          </div>
        </div>
      </div>

      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {createOpen ? (
        <form onSubmit={submitMaterialCreate} className="glass-panel p-5">
          <MaterialForm
            form={materialForm}
            setForm={setMaterialForm}
            materialTypes={materialTypes}
            materialStatuses={materialStatuses}
          />
          <div className="mt-4 flex justify-end">
            <SubmitButton saving={saving} disabled={missingCreateMaterial} title={missingCreateMaterial ? "Missing inventory.material.create" : undefined}>
              Save material
            </SubmitButton>
          </div>
        </form>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(280px,360px)_1fr]">
        <section className="glass-panel min-h-[720px] p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-300" />
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search materials" className="pl-9" />
          </div>
          <div className="mt-4 space-y-2">
            {loading ? <EmptyState title="Loading materials..." /> : null}
            {!loading && materials.length === 0 ? <EmptyState title="No materials match the current filters." /> : null}
            {materials.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.id);
                  setActiveTab("overview");
                }}
                className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === item.id ? "border-brand-200 bg-brand-50/80 shadow-soft" : "border-white/70 bg-white/70 hover:bg-white"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-800">{item.name || item.code || "Untitled material"}</p>
                    <p className="truncate text-xs text-ink-400">{item.code || item.material_type || "-"}</p>
                  </div>
                  <Pill tone={statusTone(item.status)}>{item.status}</Pill>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-ink-500">
                  <span>{formatQty(item.stock_profile?.available_qty, item.stock_profile?.unit_of_measure)}</span>
                  <span>{formatLabel(item.stock_profile?.stock_status)}</span>
                  <span>{item.stock_summary?.lot_count || 0} lots</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="min-h-[720px]">
          {!selected ? (
            <div className="glass-panel p-6">
              <EmptyState title="Select a material to inspect inventory." />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="glass-panel p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-ink-900">{selected.name || selected.code}</h2>
                      <Pill tone={statusTone(selected.status)}>{selected.status}</Pill>
                      <Pill>{selected.material_type}</Pill>
                    </div>
                    <p className="mt-1 text-sm text-ink-500">{selected.code || selected.id}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-right text-xs text-ink-500">
                    <span>On hand<strong className="block text-sm text-ink-900">{formatQty(selected.stock_profile?.stock_on_hand, selected.stock_profile?.unit_of_measure)}</strong></span>
                    <span>Available<strong className="block text-sm text-ink-900">{formatQty(selected.stock_profile?.available_qty, selected.stock_profile?.unit_of_measure)}</strong></span>
                    <span>Reserved<strong className="block text-sm text-ink-900">{formatQty(selected.stock_profile?.reserved_qty, selected.stock_profile?.unit_of_measure)}</strong></span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tabs.map((tab) => {
                    const Icon = TAB_ICONS[tab.id] || Package;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${activeTab === tab.id ? "bg-ink-900 text-white" : "border border-ink-100 bg-white text-ink-600"}`}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeTab === "overview" ? (
                <div className="grid gap-5">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Stat label="Materials" value={stats.materials} icon={Package} />
                    <Stat label="Lots" value={stats.lots} icon={Layers} />
                    <Stat label="Reorder actions" value={stats.reorder} icon={TrendingDown} />
                  </div>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <SummaryPanel title="Stock visibility" rows={[
                      ["Stock status", formatLabel(selected.stock_profile?.stock_status)],
                      ["Risk status", formatLabel(selected.stock_profile?.risk_status)],
                      ["Reorder point", formatQty(selected.stock_profile?.reorder_point, selected.stock_profile?.unit_of_measure)],
                      ["Suggested quantity", formatQty(selected.stock_profile?.suggested_qty, selected.stock_profile?.unit_of_measure)]
                    ]} />
                    <SummaryPanel title="Links" rows={[
                      ["Supplier links", stats.suppliers],
                      ["Documents", stats.documents],
                      ["Policy source", formatLabel(selected.stock_profile?.policy_source)],
                      ["Condition codes", selected.stock_profile?.policy_condition_codes?.join(", ") || "-"]
                    ]} />
                  </div>
                </div>
              ) : null}

              {activeTab === "materials" ? (
                <form onSubmit={submitMaterialUpdate} className="glass-panel p-5">
                  <MaterialForm
                    form={editForm}
                    setForm={setEditForm}
                    materialTypes={materialTypes}
                    materialStatuses={materialStatuses}
                    disabled={missingUpdateMaterial}
                  />
                  <div className="mt-4 flex justify-end">
                    <SubmitButton saving={saving} disabled={missingUpdateMaterial} title={missingUpdateMaterial ? "Missing inventory.material.update" : undefined}>
                      Save material
                    </SubmitButton>
                  </div>
                </form>
              ) : null}

              {activeTab === "lots" ? (
                <div className="grid gap-5 xl:grid-cols-[minmax(260px,340px)_1fr]">
                  <form onSubmit={submitLotCreate} className="glass-panel p-5">
                    <h3 className="mb-4 text-base font-semibold text-ink-900">Create lot</h3>
                    <LotForm form={lotForm} setForm={setLotForm} statuses={lotStatuses} disabled={missingCreateLot} />
                    <div className="mt-4">
                      <SubmitButton saving={saving} disabled={missingCreateLot} title={missingCreateLot ? "Missing inventory.lot.create" : undefined}>
                        Create lot
                      </SubmitButton>
                    </div>
                  </form>
                  <div className="space-y-4">
                    <div className="glass-panel p-5">
                      <div className="space-y-2">
                        {lots.length ? lots.map((lot) => (
                          <button
                            key={lot.id}
                            type="button"
                            onClick={() => setSelectedLotId(lot.id)}
                            className={`w-full rounded-2xl border p-3 text-left ${selectedLot?.id === lot.id ? "border-brand-200 bg-brand-50/80" : "border-white/70 bg-white/70"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-ink-800">{lot.lot_code || lot.id}</span>
                              <Pill tone={statusTone(lot.status)}>{lot.status}</Pill>
                            </div>
                            <p className="mt-1 text-xs text-ink-500">{formatQty(lot.quantity, lot.unit)} | {lot.location_ref || "No location"}</p>
                          </button>
                        )) : <EmptyState title="No lots recorded for this material." />}
                      </div>
                    </div>
                    {selectedLot ? (
                      <form onSubmit={submitLotUpdate} className="glass-panel p-5">
                        <h3 className="mb-4 text-base font-semibold text-ink-900">Update lot</h3>
                        <LotForm form={lotEditForm} setForm={setLotEditForm} statuses={lotStatuses} disabled={missingUpdateLot} />
                        <div className="mt-4">
                          <SubmitButton saving={saving} disabled={missingUpdateLot} title={missingUpdateLot ? "Missing inventory.lot.update" : undefined}>
                            Save lot
                          </SubmitButton>
                        </div>
                      </form>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeTab === "reorder" ? (
                <ReadOnlyPanel
                  items={recommendations.filter((item) => item.material.id === selected.id)}
                  empty="No reorder recommendation for this material."
                  render={(item) => (
                    <RecordRow
                      key={item.material.id}
                      icon={TrendingDown}
                      title={formatLabel(item.suggested_action)}
                      subtitle={`${item.reason || "monitor"} | suggested ${formatQty(item.suggested_qty, selected.unit_of_measure)}`}
                      meta={item.warnings?.length ? `${item.warnings.length} warning(s)` : item.current_stock?.risk_status}
                    />
                  )}
                />
              ) : null}

              {activeTab === "policies" ? (
                <div className="glass-panel p-5">
                  <SummaryPanel title="Effective policy" rows={[
                    ["Resolution", formatLabel(policyPayload?.effective_policy?.resolution_status || detail?.policy_summary?.effective_read_model?.resolution_status)],
                    ["Selected condition", policyPayload?.effective_policy?.selected_condition?.code || detail?.policy_summary?.effective_read_model?.selected_condition?.code || "-"],
                    ["Fallback used", policyPayload?.effective_policy?.fallback_used === true ? "Yes" : "No"],
                    ["Policy source", formatLabel(detail?.policy_summary?.source || selected.stock_profile?.policy_source)]
                  ]} />
                  <div className="mt-4 space-y-2">
                    {(policyPayload?.effective_policy?.explanation || detail?.policy_summary?.effective_read_model?.explanation || []).map((line) => (
                      <div key={line} className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm text-ink-500">{line}</div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTab === "documents" ? (
                <ReadOnlyPanel
                  items={documents}
                  empty="No documents linked."
                  render={(item) => (
                    <RecordRow
                      key={item.id}
                      icon={FileText}
                      title={item.title || item.record_type}
                      subtitle={[item.record_type, item.mime_type].filter(Boolean).join(" | ")}
                      meta={item.status || formatDate(item.created_at)}
                    />
                  )}
                />
              ) : null}

              {activeTab === "activity" ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  <ReadOnlyPanel
                    items={detail?.movements || []}
                    empty="No stock movement records."
                    render={(item) => (
                      <RecordRow
                        key={item.id}
                        icon={Archive}
                        title={item.title || item.record_type}
                        subtitle={`${formatLabel(item.direction)} ${formatQty(item.quantity, item.unit_of_measure)}`}
                        meta={formatDate(item.created_at)}
                      />
                    )}
                  />
                  <ReadOnlyPanel
                    items={suppliers}
                    empty="No supplier or entity links."
                    render={(item) => (
                      <RecordRow
                        key={item.link_id || item.id}
                        icon={Users}
                        title={item.display_name || item.code}
                        subtitle={item.relation_type}
                        meta={item.status}
                      />
                    )}
                  />
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MaterialForm({ form, setForm, materialTypes, materialStatuses, disabled = false }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Field label="Code">
        <TextInput disabled={disabled} value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
      </Field>
      <Field label="Name">
        <TextInput required disabled={disabled} value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
      </Field>
      <Field label="Type">
        <SelectInput disabled={disabled} value={form.material_type} onChange={(event) => setForm((prev) => ({ ...prev, material_type: event.target.value }))}>
          {materialTypes.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
        </SelectInput>
      </Field>
      <Field label="Status">
        <SelectInput disabled={disabled} value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
          {materialStatuses.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
        </SelectInput>
      </Field>
      <Field label="Unit">
        <TextInput disabled={disabled} value={form.unit_of_measure} onChange={(event) => setForm((prev) => ({ ...prev, unit_of_measure: event.target.value }))} />
      </Field>
      <Field label="Category">
        <TextInput disabled={disabled} value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} />
      </Field>
      <Field label="Family">
        <TextInput disabled={disabled} value={form.family} onChange={(event) => setForm((prev) => ({ ...prev, family: event.target.value }))} />
      </Field>
      <Field label="Supplier entity id">
        <TextInput disabled={disabled} value={form.default_supplier_entity_id} onChange={(event) => setForm((prev) => ({ ...prev, default_supplier_entity_id: event.target.value }))} />
      </Field>
      <Field label="Reorder point">
        <TextInput disabled={disabled} type="number" value={form.reorder_point} onChange={(event) => setForm((prev) => ({ ...prev, reorder_point: event.target.value }))} />
      </Field>
      <Field label="Reorder quantity">
        <TextInput disabled={disabled} type="number" value={form.reorder_qty} onChange={(event) => setForm((prev) => ({ ...prev, reorder_qty: event.target.value }))} />
      </Field>
      <Field label="Safety stock">
        <TextInput disabled={disabled} type="number" value={form.safety_stock} onChange={(event) => setForm((prev) => ({ ...prev, safety_stock: event.target.value }))} />
      </Field>
      <Field label="Notes">
        <TextArea disabled={disabled} rows={2} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
      </Field>
    </div>
  );
}

function LotForm({ form, setForm, statuses, disabled = false }) {
  return (
    <div className="grid gap-3">
      <Field label="Lot code">
        <TextInput required disabled={disabled} value={form.lot_code} onChange={(event) => setForm((prev) => ({ ...prev, lot_code: event.target.value }))} />
      </Field>
      <Field label="Quantity">
        <TextInput required disabled={disabled} type="number" value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))} />
      </Field>
      <Field label="Unit">
        <TextInput disabled={disabled} value={form.unit} onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))} />
      </Field>
      <Field label="Status">
        <SelectInput disabled={disabled} value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
          {statuses.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
        </SelectInput>
      </Field>
      <Field label="Received date">
        <TextInput disabled={disabled} type="date" value={form.received_date} onChange={(event) => setForm((prev) => ({ ...prev, received_date: event.target.value }))} />
      </Field>
      <Field label="Expiry date">
        <TextInput disabled={disabled} type="date" value={form.expiry_date} onChange={(event) => setForm((prev) => ({ ...prev, expiry_date: event.target.value }))} />
      </Field>
      <Field label="Location">
        <TextInput disabled={disabled} value={form.location_ref} onChange={(event) => setForm((prev) => ({ ...prev, location_ref: event.target.value }))} />
      </Field>
      <Field label="Supplier entity id">
        <TextInput disabled={disabled} value={form.supplier_agent_id} onChange={(event) => setForm((prev) => ({ ...prev, supplier_agent_id: event.target.value }))} />
      </Field>
      <Field label="Notes">
        <TextArea disabled={disabled} rows={2} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
      </Field>
    </div>
  );
}

function SummaryPanel({ title, rows }) {
  return (
    <div className="glass-panel p-5">
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      <div className="mt-4 grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm">
            <span className="text-ink-500">{label}</span>
            <span className="font-semibold text-ink-800">{value ?? "-"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadOnlyPanel({ items, empty, render }) {
  return (
    <div className="glass-panel p-5">
      <div className="space-y-3">
        {items.length ? items.map(render) : <EmptyState title={empty} />}
      </div>
    </div>
  );
}

function RecordRow({ title, subtitle, meta, icon }) {
  const Icon = icon || Package;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-800">{title || "-"}</p>
          <p className="truncate text-xs text-ink-400">{subtitle || "-"}</p>
        </div>
      </div>
      <Pill tone={statusTone(meta)}>{meta || "-"}</Pill>
    </div>
  );
}
