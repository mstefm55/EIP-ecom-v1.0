import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Banknote,
  Building2,
  FileText,
  GitBranch,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const ENDPOINTS = {
  list: "/api/eip/entities",
  detail: "/api/eip/entities/:id",
  options: "/api/eip/entities/governance/options"
};

const PERMISSIONS = {
  read: "entities.read",
  create: "entities.create",
  update: "entities.update",
  addresses: "entities.manage_addresses",
  contacts: "entities.manage_contacts",
  bank: "entities.manage_bank_accounts",
  relationships: "entities.manage_relationships"
};

const DETAIL_TABS = [
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "addresses", label: "Addresses", icon: MapPin },
  { id: "contacts", label: "Contacts", icon: Phone },
  { id: "bank_accounts", label: "Bank Accounts", icon: Landmark },
  { id: "relationships", label: "Relationships", icon: GitBranch },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "policies", label: "Policies", icon: ShieldCheck },
  { id: "activity", label: "Activity", icon: UserRound }
];

const DEFAULT_ENTITY_FORM = {
  entity_kind: "ORG",
  code: "",
  display_name: "",
  legal_name: "",
  roles: ["CUSTOMER"],
  status: "ACTIVE",
  registration_number: "",
  tax_number: "",
  country_code: "",
  default_language: "",
  currency_code: "",
  website: "",
  notes: ""
};

const DEFAULT_ADDRESS_FORM = {
  address_type: "MAIN",
  label: "",
  line1: "",
  line2: "",
  city: "",
  state_region: "",
  postal_code: "",
  country_code: "",
  is_primary: false
};

const DEFAULT_CONTACT_FORM = {
  contact_type: "EMAIL",
  label: "",
  value: "",
  is_primary: false
};

const DEFAULT_BANK_FORM = {
  account_type: "BANK",
  label: "",
  bank_name: "",
  account_name: "",
  account_number: "",
  iban: "",
  swift_bic: "",
  currency_code: "",
  is_primary: false
};

const DEFAULT_RELATIONSHIP_FORM = {
  related_entity_id: "",
  relation_type: "RELATED_TO",
  direction: "OUTGOING"
};

function cleanBody(input) {
  return Object.fromEntries(
    Object.entries(input || {}).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== "" && value !== null && value !== undefined;
    })
  );
}

function pathFor(template, id) {
  return String(template || ENDPOINTS.detail).replace(":id", id);
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "-";
  }
}

function optionLabel(options, listCode, code) {
  const item = options?.[listCode]?.find((entry) => entry.code === code);
  return item?.label || code || "-";
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
      className={`w-full rounded-xl border border-ink-100 bg-white/90 px-3 py-2 text-sm text-ink-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 ${props.className || ""}`}
    />
  );
}

function SelectInput({ children, ...props }) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-ink-100 bg-white/90 px-3 py-2 text-sm text-ink-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 ${props.className || ""}`}
    >
      {children}
    </select>
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-ink-100 bg-white/90 px-3 py-2 text-sm text-ink-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 ${props.className || ""}`}
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

export default function EntityManagementWorkspace({ node }) {
  const props = node?.props || {};
  const endpoints = { ...ENDPOINTS, ...(props.endpoints || {}) };
  const [filters, setFilters] = useState({ q: "", role: "", status: "" });
  const [entities, setEntities] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [optionsPayload, setOptionsPayload] = useState({ options: {}, permissions: [] });
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(DEFAULT_ENTITY_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_ENTITY_FORM);
  const [addressForm, setAddressForm] = useState(DEFAULT_ADDRESS_FORM);
  const [contactForm, setContactForm] = useState(DEFAULT_CONTACT_FORM);
  const [bankForm, setBankForm] = useState(DEFAULT_BANK_FORM);
  const [relationshipForm, setRelationshipForm] = useState(DEFAULT_RELATIONSHIP_FORM);

  const options = optionsPayload.options || {};
  const permissions = useMemo(() => optionsPayload.permissions || [], [optionsPayload.permissions]);
  const can = useCallback((permission) => permissions.includes(permission), [permissions]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.role) params.set("role", filters.role);
    if (filters.status) params.set("status", filters.status);
    params.set("limit", "50");
    return params.toString();
  }, [filters]);

  const loadOptions = useCallback(async () => {
    const payload = await apiFetch(endpoints.options);
    setOptionsPayload(payload || { options: {}, permissions: [] });
  }, [endpoints.options]);

  const loadEntities = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiFetch(`${endpoints.list}?${query}`);
      const items = payload?.items || [];
      setEntities(items);
      setSelectedId((current) => current || items[0]?.id || null);
    } catch (err) {
      setError(err.message || "Unable to load entities.");
    } finally {
      setLoading(false);
    }
  }, [endpoints.list, query]);

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    setError("");
    try {
      const payload = await apiFetch(pathFor(endpoints.detail, id));
      setDetail(payload);
      setEditForm({ ...DEFAULT_ENTITY_FORM, ...(payload?.item || {}), roles: payload?.item?.roles || ["OTHER"] });
    } catch (err) {
      setError(err.message || "Unable to load entity.");
    }
  }, [endpoints.detail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOptions().catch((err) => setError(err.message || "Unable to load entity options."));
  }, [loadOptions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEntities();
  }, [loadEntities]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadOptions(), loadEntities()]);
    if (selectedId) await loadDetail(selectedId);
  }, [loadOptions, loadEntities, loadDetail, selectedId]);

  async function submitCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = await apiFetch(endpoints.list, {
        method: "POST",
        body: cleanBody({ ...createForm, roles: createForm.roles })
      });
      setCreateOpen(false);
      setCreateForm(DEFAULT_ENTITY_FORM);
      await loadEntities();
      setSelectedId(payload?.item?.id || null);
    } catch (err) {
      setError(err.message || "Unable to create entity.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!detail?.item?.id) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(pathFor(endpoints.detail, detail.item.id), {
        method: "PATCH",
        body: cleanBody({ ...editForm, roles: editForm.roles })
      });
      await loadEntities();
      await loadDetail(detail.item.id);
    } catch (err) {
      setError(err.message || "Unable to save entity.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveEntity() {
    if (!detail?.item?.id) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(pathFor(endpoints.detail, detail.item.id), {
        method: "PATCH",
        body: { status: "ARCHIVED" }
      });
      await loadEntities();
      await loadDetail(detail.item.id);
    } catch (err) {
      setError(err.message || "Unable to archive entity.");
    } finally {
      setSaving(false);
    }
  }

  async function submitChild(event, kind) {
    event.preventDefault();
    if (!detail?.item?.id) return;
    const forms = {
      addresses: [addressForm, setAddressForm, DEFAULT_ADDRESS_FORM, "addresses"],
      contacts: [contactForm, setContactForm, DEFAULT_CONTACT_FORM, "contacts"],
      "bank-accounts": [bankForm, setBankForm, DEFAULT_BANK_FORM, "bank-accounts"],
      relationships: [relationshipForm, setRelationshipForm, DEFAULT_RELATIONSHIP_FORM, "relationships"]
    };
    const [form, setter, defaults, path] = forms[kind];
    setSaving(true);
    setError("");
    try {
      await apiFetch(`${pathFor(endpoints.detail, detail.item.id)}/${path}`, {
        method: "POST",
        body: cleanBody(form)
      });
      setter(defaults);
      await loadDetail(detail.item.id);
    } catch (err) {
      setError(err.message || "Unable to save record.");
    } finally {
      setSaving(false);
    }
  }

  async function patchChild(kind, id, body) {
    if (!detail?.item?.id) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`${pathFor(endpoints.detail, detail.item.id)}/${kind}/${id}`, {
        method: "PATCH",
        body
      });
      await loadDetail(detail.item.id);
    } catch (err) {
      setError(err.message || "Unable to update record.");
    } finally {
      setSaving(false);
    }
  }

  const selected = detail?.item || null;
  const statusTone = selected?.status === "ACTIVE" ? "green" : selected?.status === "BLOCKED" ? "red" : selected?.status === "UNDER_REVIEW" ? "amber" : "slate";
  const roles = options.ENTITY_ROLE?.length ? options.ENTITY_ROLE : (optionsPayload.defaults?.roles || []).map((code) => ({ code, label: code }));
  const statuses = options.ENTITY_STATUS?.length ? options.ENTITY_STATUS : (optionsPayload.defaults?.statuses || []).map((code) => ({ code, label: code }));
  const otherEntities = entities.filter((item) => item.id !== selected?.id);

  return (
    <div className="space-y-5">
      <div className="glass-panel p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-brand-500">Entity Management</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink-900">{props.title || "Entity Management"}</h1>
            <p className="mt-1 max-w-3xl text-sm text-ink-500">{props.subtitle || "Tenant entity registry."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshAll}
              className="inline-flex items-center gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2 text-xs font-semibold text-ink-600 shadow-soft"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            {can(PERMISSIONS.create) ? (
              <button
                type="button"
                onClick={() => setCreateOpen((value) => !value)}
                className="inline-flex items-center gap-2 rounded-xl bg-ink-900 px-3 py-2 text-xs font-semibold text-white shadow-soft"
              >
                <Plus className="h-4 w-4" />
                Create entity
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {createOpen ? (
        <form onSubmit={submitCreate} className="glass-panel p-5">
          <div className="grid gap-3 lg:grid-cols-4">
            <Field label="Kind">
              <SelectInput value={createForm.entity_kind} onChange={(event) => setCreateForm((prev) => ({ ...prev, entity_kind: event.target.value }))}>
                {(options.ENTITY_KIND || [{ code: "ORG", label: "Organization" }, { code: "PERSON", label: "Person" }]).map((item) => (
                  <option key={item.code} value={item.code}>{item.label}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Code">
              <TextInput value={createForm.code} onChange={(event) => setCreateForm((prev) => ({ ...prev, code: event.target.value }))} />
            </Field>
            <Field label="Display name">
              <TextInput required value={createForm.display_name} onChange={(event) => setCreateForm((prev) => ({ ...prev, display_name: event.target.value }))} />
            </Field>
            <Field label="Status">
              <SelectInput value={createForm.status} onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value }))}>
                {statuses.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </SelectInput>
            </Field>
            <Field label="Roles">
              <select
                multiple
                value={createForm.roles}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, roles: Array.from(event.target.selectedOptions).map((option) => option.value) }))}
                className="h-28 w-full rounded-xl border border-ink-100 bg-white/90 px-3 py-2 text-sm text-ink-700"
              >
                {roles.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Legal name">
              <TextInput value={createForm.legal_name} onChange={(event) => setCreateForm((prev) => ({ ...prev, legal_name: event.target.value }))} />
            </Field>
            <Field label="Country">
              <TextInput maxLength={2} value={createForm.country_code} onChange={(event) => setCreateForm((prev) => ({ ...prev, country_code: event.target.value.toUpperCase() }))} />
            </Field>
            <Field label="Currency">
              <TextInput maxLength={3} value={createForm.currency_code} onChange={(event) => setCreateForm((prev) => ({ ...prev, currency_code: event.target.value.toUpperCase() }))} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft">
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(280px,360px)_1fr]">
        <section className="glass-panel min-h-[680px] p-4">
          <div className="grid gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-300" />
              <TextInput
                placeholder="Search entities"
                value={filters.q}
                onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SelectInput value={filters.role} onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))}>
                <option value="">All roles</option>
                {roles.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </SelectInput>
              <SelectInput value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                <option value="">All statuses</option>
                {statuses.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </SelectInput>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {loading ? <EmptyState title="Loading entities..." /> : null}
            {!loading && entities.length === 0 ? <EmptyState title="No entities match the current filters." /> : null}
            {entities.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === item.id ? "border-brand-200 bg-brand-50/80 shadow-soft" : "border-white/70 bg-white/70 hover:bg-white"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-800">{item.display_name || item.code || "Untitled entity"}</p>
                    <p className="truncate text-xs text-ink-400">{item.code || item.legal_name || item.entity_kind}</p>
                  </div>
                  <Pill tone={item.status === "ACTIVE" ? "green" : item.status === "BLOCKED" ? "red" : "slate"}>{item.status}</Pill>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(item.roles || []).slice(0, 3).map((role) => <Pill key={role}>{role}</Pill>)}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="min-h-[680px]">
          {!selected ? (
            <div className="glass-panel p-6">
              <EmptyState title="Select an entity to inspect the record." />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="glass-panel p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl font-semibold text-ink-900">{selected.display_name}</h2>
                      <Pill tone={statusTone}>{selected.status}</Pill>
                    </div>
                    <p className="mt-1 text-sm text-ink-500">{selected.code || selected.legal_name || selected.entity_kind}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(selected.roles || []).map((role) => <Pill key={role} tone="blue">{role}</Pill>)}
                    </div>
                  </div>
                  {can(PERMISSIONS.update) ? (
                    <button
                      type="button"
                      onClick={archiveEntity}
                      disabled={saving || selected.status === "ARCHIVED"}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-semibold text-rose-600 shadow-soft disabled:opacity-50"
                    >
                      <Archive className="h-4 w-4" />
                      Archive
                    </button>
                  ) : null}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {DETAIL_TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${activeTab === tab.id ? "bg-ink-900 text-white" : "border border-ink-100 bg-white text-ink-500"}`}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeTab === "overview" ? (
                <form onSubmit={saveProfile} className="glass-panel p-5">
                  <div className="grid gap-3 lg:grid-cols-4">
                    <Field label="Kind">
                      <SelectInput disabled={!can(PERMISSIONS.update)} value={editForm.entity_kind || "ORG"} onChange={(event) => setEditForm((prev) => ({ ...prev, entity_kind: event.target.value }))}>
                        {(options.ENTITY_KIND || [{ code: "ORG", label: "Organization" }, { code: "PERSON", label: "Person" }]).map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
                      </SelectInput>
                    </Field>
                    <Field label="Code">
                      <TextInput disabled={!can(PERMISSIONS.update)} value={editForm.code || ""} onChange={(event) => setEditForm((prev) => ({ ...prev, code: event.target.value }))} />
                    </Field>
                    <Field label="Display name">
                      <TextInput disabled={!can(PERMISSIONS.update)} value={editForm.display_name || ""} onChange={(event) => setEditForm((prev) => ({ ...prev, display_name: event.target.value }))} />
                    </Field>
                    <Field label="Status">
                      <SelectInput disabled={!can(PERMISSIONS.update)} value={editForm.status || "ACTIVE"} onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}>
                        {statuses.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
                      </SelectInput>
                    </Field>
                    <Field label="Roles">
                      <select
                        multiple
                        disabled={!can(PERMISSIONS.update)}
                        value={editForm.roles || []}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, roles: Array.from(event.target.selectedOptions).map((option) => option.value) }))}
                        className="h-32 w-full rounded-xl border border-ink-100 bg-white/90 px-3 py-2 text-sm text-ink-700 disabled:opacity-70"
                      >
                        {roles.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Legal name">
                      <TextInput disabled={!can(PERMISSIONS.update)} value={editForm.legal_name || ""} onChange={(event) => setEditForm((prev) => ({ ...prev, legal_name: event.target.value }))} />
                    </Field>
                    <Field label="Registration">
                      <TextInput disabled={!can(PERMISSIONS.update)} value={editForm.registration_number || ""} onChange={(event) => setEditForm((prev) => ({ ...prev, registration_number: event.target.value }))} />
                    </Field>
                    <Field label="Tax number">
                      <TextInput disabled={!can(PERMISSIONS.update)} value={editForm.tax_number || ""} onChange={(event) => setEditForm((prev) => ({ ...prev, tax_number: event.target.value }))} />
                    </Field>
                    <Field label="Country">
                      <TextInput disabled={!can(PERMISSIONS.update)} maxLength={2} value={editForm.country_code || ""} onChange={(event) => setEditForm((prev) => ({ ...prev, country_code: event.target.value.toUpperCase() }))} />
                    </Field>
                    <Field label="Currency">
                      <TextInput disabled={!can(PERMISSIONS.update)} maxLength={3} value={editForm.currency_code || ""} onChange={(event) => setEditForm((prev) => ({ ...prev, currency_code: event.target.value.toUpperCase() }))} />
                    </Field>
                    <Field label="Website">
                      <TextInput disabled={!can(PERMISSIONS.update)} value={editForm.website || ""} onChange={(event) => setEditForm((prev) => ({ ...prev, website: event.target.value }))} />
                    </Field>
                    <Field label="Language">
                      <TextInput disabled={!can(PERMISSIONS.update)} value={editForm.default_language || ""} onChange={(event) => setEditForm((prev) => ({ ...prev, default_language: event.target.value }))} />
                    </Field>
                  </div>
                  <div className="mt-3">
                    <Field label="Notes">
                      <TextArea disabled={!can(PERMISSIONS.update)} rows={3} value={editForm.notes || ""} onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))} />
                    </Field>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    {[
                      ["Addresses", detail.summary?.addresses || 0],
                      ["Contacts", detail.summary?.contacts || 0],
                      ["Bank accounts", detail.summary?.bank_accounts || 0],
                      ["Relationships", detail.summary?.relationships || 0]
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/70 bg-white/70 p-4">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-400">{label}</p>
                        <p className="mt-1 text-2xl font-semibold text-ink-900">{value}</p>
                      </div>
                    ))}
                  </div>
                  {can(PERMISSIONS.update) ? (
                    <div className="mt-4 flex justify-end">
                      <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft">
                        <Save className="h-4 w-4" />
                        Save
                      </button>
                    </div>
                  ) : null}
                </form>
              ) : null}

              {activeTab === "addresses" ? (
                <DataTab
                  items={detail.addresses || []}
                  empty="No addresses recorded."
                  render={(item) => (
                    <RecordRow
                      key={item.id}
                      title={`${optionLabel(options, "ENTITY_ADDRESS_TYPE", item.address_type)}${item.label ? ` - ${item.label}` : ""}`}
                      subtitle={[item.line1, item.city, item.country_code].filter(Boolean).join(", ")}
                      meta={item.is_primary ? "Primary" : item.is_active ? "Active" : "Inactive"}
                      active={item.is_active}
                      onToggle={can(PERMISSIONS.addresses) ? () => patchChild("addresses", item.id, { is_active: !item.is_active }) : null}
                    />
                  )}
                >
                  {can(PERMISSIONS.addresses) ? (
                    <AddressForm form={addressForm} setForm={setAddressForm} options={options} onSubmit={(event) => submitChild(event, "addresses")} saving={saving} />
                  ) : null}
                </DataTab>
              ) : null}

              {activeTab === "contacts" ? (
                <DataTab
                  items={detail.contacts || []}
                  empty="No contacts recorded."
                  render={(item) => (
                    <RecordRow
                      key={item.id}
                      title={`${optionLabel(options, "ENTITY_CONTACT_TYPE", item.contact_type)}${item.label ? ` - ${item.label}` : ""}`}
                      subtitle={item.value}
                      meta={item.is_primary ? "Primary" : item.is_active ? "Active" : "Inactive"}
                      active={item.is_active}
                      icon={item.contact_type === "EMAIL" ? Mail : Phone}
                      onToggle={can(PERMISSIONS.contacts) ? () => patchChild("contacts", item.id, { is_active: !item.is_active }) : null}
                    />
                  )}
                >
                  {can(PERMISSIONS.contacts) ? (
                    <ContactForm form={contactForm} setForm={setContactForm} options={options} onSubmit={(event) => submitChild(event, "contacts")} saving={saving} />
                  ) : null}
                </DataTab>
              ) : null}

              {activeTab === "bank_accounts" ? (
                <DataTab
                  items={detail.bank_accounts || []}
                  empty="No bank accounts recorded."
                  render={(item) => (
                    <RecordRow
                      key={item.id}
                      title={[item.bank_name, item.label].filter(Boolean).join(" - ") || optionLabel(options, "ENTITY_BANK_ACCOUNT_TYPE", item.account_type)}
                      subtitle={[item.account_number_masked, item.iban_masked, item.currency_code].filter(Boolean).join(" | ")}
                      meta={item.is_primary ? "Primary" : item.is_active ? "Active" : "Inactive"}
                      active={item.is_active}
                      icon={Banknote}
                      onToggle={can(PERMISSIONS.bank) ? () => patchChild("bank-accounts", item.id, { is_active: !item.is_active }) : null}
                    />
                  )}
                >
                  {can(PERMISSIONS.bank) ? (
                    <BankForm form={bankForm} setForm={setBankForm} options={options} onSubmit={(event) => submitChild(event, "bank-accounts")} saving={saving} />
                  ) : null}
                </DataTab>
              ) : null}

              {activeTab === "relationships" ? (
                <DataTab
                  items={detail.relationships || []}
                  empty="No relationships recorded."
                  render={(item) => (
                    <RecordRow
                      key={item.id}
                      title={`${optionLabel(options, "ENTITY_RELATIONSHIP_TYPE", item.relation_type)}: ${item.related_entity?.display_name || item.related_entity_id}`}
                      subtitle={item.direction}
                      meta={item.is_active ? "Active" : "Inactive"}
                      active={item.is_active}
                      icon={GitBranch}
                      onToggle={can(PERMISSIONS.relationships) ? () => patchChild("relationships", item.id, { is_active: !item.is_active }) : null}
                    />
                  )}
                >
                  {can(PERMISSIONS.relationships) ? (
                    <RelationshipForm
                      form={relationshipForm}
                      setForm={setRelationshipForm}
                      options={options}
                      entities={otherEntities}
                      onSubmit={(event) => submitChild(event, "relationships")}
                      saving={saving}
                    />
                  ) : null}
                </DataTab>
              ) : null}

              {activeTab === "documents" ? (
                <ReadOnlyTab items={detail.documents || []} empty="No documents linked." render={(item) => (
                  <RecordRow key={item.id} icon={FileText} title={item.title || item.record_type} subtitle={[item.mime_type, item.file_size ? `${item.file_size} bytes` : null].filter(Boolean).join(" | ")} meta={formatDate(item.created_at)} />
                )} />
              ) : null}

              {activeTab === "policies" ? (
                <ReadOnlyTab items={detail.policy_summary?.items || []} empty="No scoped policies found." render={(item) => (
                  <RecordRow key={item.id} icon={ShieldCheck} title={item.label || item.code} subtitle={`${item.policy_domain} | ${item.condition_type || "policy"}`} meta={item.needs_review ? "Needs review" : `Priority ${item.priority ?? "-"}`} />
                )} />
              ) : null}

              {activeTab === "activity" ? (
                <div className="glass-panel p-5">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Metric label="Service objects" value={detail.activity_summary?.service_objects?.total || 0} />
                    <Metric label="Open tasks" value={detail.activity_summary?.tasks?.open || 0} />
                    <Metric label="Overdue tasks" value={detail.activity_summary?.tasks?.overdue || 0} tone="red" />
                  </div>
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <SummaryMap title="By object type" values={detail.activity_summary?.service_objects?.by_type || {}} />
                    <SummaryMap title="By status" values={detail.activity_summary?.service_objects?.by_status || {}} />
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DataTab({ items, empty, render, children }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(280px,360px)_1fr]">
      <div className="glass-panel p-5">{children}</div>
      <div className="glass-panel p-5">
        <div className="space-y-3">{items.length ? items.map(render) : <EmptyState title={empty} />}</div>
      </div>
    </div>
  );
}

function ReadOnlyTab({ items, empty, render }) {
  return (
    <div className="glass-panel p-5">
      <div className="space-y-3">{items.length ? items.map(render) : <EmptyState title={empty} />}</div>
    </div>
  );
}

function RecordRow({ title, subtitle, meta, icon, active = true, onToggle }) {
  const RowIcon = icon || Building2;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white">
          <RowIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-800">{title || "-"}</p>
          <p className="truncate text-xs text-ink-400">{subtitle || "-"}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Pill tone={active ? "green" : "slate"}>{meta || (active ? "Active" : "Inactive")}</Pill>
        {onToggle ? (
          <button type="button" onClick={onToggle} className="rounded-xl border border-ink-100 bg-white px-3 py-1.5 text-xs font-semibold text-ink-500">
            {active ? "Deactivate" : "Activate"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function AddressForm({ form, setForm, options, onSubmit, saving }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Type">
        <SelectInput value={form.address_type} onChange={(event) => setForm((prev) => ({ ...prev, address_type: event.target.value }))}>
          {(options.ENTITY_ADDRESS_TYPE || [{ code: "MAIN", label: "Main" }]).map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
        </SelectInput>
      </Field>
      {["label", "line1", "line2", "city", "state_region", "postal_code"].map((field) => (
        <Field key={field} label={field.replace("_", " ")}>
          <TextInput value={form[field]} onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))} />
        </Field>
      ))}
      <Field label="Country">
        <TextInput maxLength={2} value={form.country_code} onChange={(event) => setForm((prev) => ({ ...prev, country_code: event.target.value.toUpperCase() }))} />
      </Field>
      <CheckInput label="Primary" checked={form.is_primary} onChange={(value) => setForm((prev) => ({ ...prev, is_primary: value }))} />
      <SubmitButton saving={saving}>Add address</SubmitButton>
    </form>
  );
}

function ContactForm({ form, setForm, options, onSubmit, saving }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Type">
        <SelectInput value={form.contact_type} onChange={(event) => setForm((prev) => ({ ...prev, contact_type: event.target.value }))}>
          {(options.ENTITY_CONTACT_TYPE || [{ code: "EMAIL", label: "Email" }]).map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
        </SelectInput>
      </Field>
      <Field label="Label">
        <TextInput value={form.label} onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))} />
      </Field>
      <Field label="Value">
        <TextInput required value={form.value} onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))} />
      </Field>
      <CheckInput label="Primary" checked={form.is_primary} onChange={(value) => setForm((prev) => ({ ...prev, is_primary: value }))} />
      <SubmitButton saving={saving}>Add contact</SubmitButton>
    </form>
  );
}

function BankForm({ form, setForm, options, onSubmit, saving }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Type">
        <SelectInput value={form.account_type} onChange={(event) => setForm((prev) => ({ ...prev, account_type: event.target.value }))}>
          {(options.ENTITY_BANK_ACCOUNT_TYPE || [{ code: "BANK", label: "Bank account" }]).map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
        </SelectInput>
      </Field>
      {["label", "bank_name", "account_name", "account_number", "iban", "swift_bic", "currency_code"].map((field) => (
        <Field key={field} label={field.replaceAll("_", " ")}>
          <TextInput value={form[field]} onChange={(event) => setForm((prev) => ({ ...prev, [field]: field === "currency_code" ? event.target.value.toUpperCase() : event.target.value }))} />
        </Field>
      ))}
      <CheckInput label="Primary" checked={form.is_primary} onChange={(value) => setForm((prev) => ({ ...prev, is_primary: value }))} />
      <SubmitButton saving={saving}>Add bank account</SubmitButton>
    </form>
  );
}

function RelationshipForm({ form, setForm, options, entities, onSubmit, saving }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Related entity">
        <SelectInput required value={form.related_entity_id} onChange={(event) => setForm((prev) => ({ ...prev, related_entity_id: event.target.value }))}>
          <option value="">Select entity</option>
          {entities.map((item) => <option key={item.id} value={item.id}>{item.display_name || item.code}</option>)}
        </SelectInput>
      </Field>
      <Field label="Relationship">
        <SelectInput value={form.relation_type} onChange={(event) => setForm((prev) => ({ ...prev, relation_type: event.target.value }))}>
          {(options.ENTITY_RELATIONSHIP_TYPE || [{ code: "RELATED_TO", label: "Related to" }]).map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
        </SelectInput>
      </Field>
      <Field label="Direction">
        <SelectInput value={form.direction} onChange={(event) => setForm((prev) => ({ ...prev, direction: event.target.value }))}>
          <option value="OUTGOING">Outgoing</option>
          <option value="INCOMING">Incoming</option>
        </SelectInput>
      </Field>
      <SubmitButton saving={saving}>Add relationship</SubmitButton>
    </form>
  );
}

function CheckInput({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-ink-100 bg-white/80 px-3 py-2 text-sm font-semibold text-ink-600">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function SubmitButton({ saving, children }) {
  return (
    <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white shadow-soft disabled:opacity-60">
      <Plus className="h-4 w-4" />
      {children}
    </button>
  );
}

function Metric({ label, value, tone = "blue" }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-400">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${tone === "red" ? "text-rose-600" : "text-ink-900"}`}>{value}</p>
    </div>
  );
}

function SummaryMap({ title, values }) {
  const entries = Object.entries(values || {});
  return (
    <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      <div className="mt-3 space-y-2">
        {entries.length ? entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-sm">
            <span className="text-ink-500">{key}</span>
            <span className="font-semibold text-ink-900">{value}</span>
          </div>
        )) : <p className="text-sm text-ink-400">No activity recorded.</p>}
      </div>
    </div>
  );
}
