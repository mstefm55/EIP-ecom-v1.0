import { useEffect, useMemo, useState } from "react";
import { Database, Download, RefreshCw, ShieldAlert } from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const DEFAULT_LAYOUT = {
  title: "Data explorer",
  subtitle: "Browse schema metadata and preview table data with export support.",
  schema: {
    title: "Schema browser",
    searchPlaceholder: "Search tables...",
    empty: "No tables available.",
    export: "Export schema",
    columnsTitle: "Columns",
    columnsEmpty: "Select a table to view columns."
  },
  table: {
    title: "Table",
    placeholder: "Select a table to view data.",
    tenantPlaceholder: "Tenant id (optional)",
    refresh: "Refresh",
    exportCsv: "Export CSV",
    exportJson: "Export JSON"
  },
  data: {
    title: "Data preview",
    empty: "No rows to display.",
    loading: "Loading rows..."
  },
  pagination: {
    prev: "Prev",
    next: "Next"
  },
  sensitive: {
    title: "Sensitive access token",
    tenantPlaceholder: "Tenant id",
    tokenPlaceholder: "Paste tenant token",
    consume: "Consume token",
    clear: "Clear token",
    hint: "Required for sensitive tables. Requires step-up verification."
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

export default function AdminDbExplorer({ node }) {
  const layout = useMemo(
    () => mergeLayout(DEFAULT_LAYOUT, node?.props?.layout),
    [node?.props?.layout]
  );
  const [schemas, setSchemas] = useState([]);
  const [isExec, setIsExec] = useState(false);
  const [selectedSchema, setSelectedSchema] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [tableQuery, setTableQuery] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [tenantLabel, setTenantLabel] = useState("");
  const [tenantQuery, setTenantQuery] = useState("");
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantOptions, setTenantOptions] = useState([]);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedRows, setSelectedRows] = useState(() => new Map());
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [sensitiveTenant, setSensitiveTenant] = useState("");
  const [sensitiveToken, setSensitiveToken] = useState("");
  const [sensitiveStatus, setSensitiveStatus] = useState(null);

  const tableList = useMemo(() => {
    const entries = [];
    schemas.forEach((schema) => {
      schema.tables.forEach((table) => {
        entries.push({
          schema: schema.schema,
          name: table.name,
          sensitive: Boolean(table.sensitive),
        });
      });
    });
    const query = tableQuery.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.schema.toLowerCase().includes(query)
    );
  }, [schemas, tableQuery]);

  const selectedTableLabel = selectedTable
    ? `${selectedSchema}.${selectedTable}`
    : "";
  const selectedMeta = useMemo(() => {
    const schema = schemas.find((item) => item.schema === selectedSchema);
    return schema?.tables.find((table) => table.name === selectedTable) || null;
  }, [schemas, selectedSchema, selectedTable]);
  const requiresTenant = useMemo(
    () =>
      Boolean(selectedMeta?.columns?.some((col) => col.name === "tenant_id")) &&
      !isExec,
    [selectedMeta, isExec]
  );
  const tenantInputValue = tenantLabel || tenantQuery;
  const pageIndex = Math.floor(offset / limit);
  const pageCount = Math.max(1, Math.ceil((totalCount || 0) / limit) || 1);
  const pageOptions = useMemo(
    () => Array.from({ length: pageCount }, (_, idx) => idx),
    [pageCount]
  );

  const loadSchema = async () => {
    setLoadingSchema(true);
    setError(null);
    try {
      const result = await apiFetch("/api/eip/admin/db/schema?include_columns=true");
      const list = result.schemas || [];
      setSchemas(list);
      setIsExec(Boolean(result?.is_exec || result?.exec));
      if (!selectedTable && list.length) {
        const firstSchema = list[0];
        const firstTable = firstSchema.tables[0];
        if (firstTable) {
          setSelectedSchema(firstSchema.schema);
          setSelectedTable(firstTable.name);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to load schema.");
    } finally {
      setLoadingSchema(false);
    }
  };

  const loadTable = async () => {
    if (!selectedSchema || !selectedTable) return;
    if (requiresTenant && !tenantFilter) {
      setNotice("Tenant id required to preview rows for this table.");
      setRows([]);
      setColumns(selectedMeta?.columns?.map((col) => col.name) || []);
      setTotalCount(0);
      return;
    }
    setLoadingRows(true);
    setError(null);
    setNotice(null);
    try {
      const params = new URLSearchParams({
        schema: selectedSchema,
        table: selectedTable,
        limit: String(limit),
        offset: String(offset)
      });
      if (tenantFilter) params.set("tenant_id", tenantFilter);
      const result = await apiFetch(`/api/eip/admin/db/table?${params.toString()}`);
      setColumns(result.columns || []);
      setRows(result.rows || []);
      setTotalCount(Number(result.total_count || result.totalCount || 0));
    } catch (err) {
      setError(err.message || "Failed to load table.");
      setTotalCount(0);
    } finally {
      setLoadingRows(false);
    }
  };

  const handleSelectTable = (schema, name) => {
    setSelectedSchema(schema);
    setSelectedTable(name);
    setOffset(0);
    setSelectedRows(new Map());
    setTotalCount(0);
  };

  const downloadSchema = () => {
    if (!schemas.length) {
      setError("Schema is empty.");
      return;
    }
    const payload = {
      generated_at: new Date().toISOString(),
      schemas
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "eip_schema.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const resolveRowKey = (row, idx) => {
    if (row && (row.id || row.id === 0)) return String(row.id);
    return `${offset}-${idx}`;
  };

  const selectedRowsArray = useMemo(() => Array.from(selectedRows.values()), [selectedRows]);

  const currentPageSelectedCount = useMemo(() => {
    if (!rows.length) return 0;
    return rows.reduce((count, row, idx) => {
      const key = resolveRowKey(row, idx);
      return selectedRows.has(key) ? count + 1 : count;
    }, 0);
  }, [rows, selectedRows, offset]);

  const allRowsSelected = rows.length > 0 && currentPageSelectedCount === rows.length;

  const toggleRowSelection = (rowKey, row) => {
    setSelectedRows((prev) => {
      const next = new Map(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.set(rowKey, row);
      }
      return next;
    });
  };

  const toggleAllRows = () => {
    if (!rows.length) return;
    setSelectedRows((prev) => {
      const next = new Map(prev);
      if (allRowsSelected) {
        rows.forEach((row, idx) => {
          next.delete(resolveRowKey(row, idx));
        });
        return next;
      }
      rows.forEach((row, idx) => {
        next.set(resolveRowKey(row, idx), row);
      });
      return next;
    });
  };

  const downloadSelected = () => {
    if (!selectedRowsArray.length) return;
    const payload = selectedRowsArray.map((row) => {
      const output = {};
      columns.forEach((col) => {
        output[col] = row[col];
      });
      return output;
    });
    const header = columns.join(",");
    const lines = payload.map((row) =>
      columns
        .map((col) => {
          const value = row[col];
          if (value === null || value === undefined) return "";
          const text =
            typeof value === "object" ? JSON.stringify(value) : String(value);
          return `"${text.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedTable || "data"}-selected.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const loadTenants = async (query) => {
    setTenantLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      const result = await apiFetch(`/api/eip/admin/db/tenants?${params.toString()}`);
      setTenantOptions(result.tenants || []);
    } catch (err) {
      setTenantOptions([]);
    } finally {
      setTenantLoading(false);
    }
  };

  const handleTenantSelect = (tenant) => {
    if (!tenant) return;
    setTenantFilter(tenant.id);
    setTenantLabel(
      tenant.name && tenant.code
        ? `${tenant.name} (${tenant.code})`
        : tenant.name || tenant.code || tenant.id
    );
    setTenantQuery("");
    setTenantMenuOpen(false);
    setSelectedRows(new Map());
    setOffset(0);
    setTotalCount(0);
  };

  const handleTenantInputChange = (value) => {
    setTenantQuery(value);
    if (tenantFilter) {
      setTenantFilter("");
      setTenantLabel("");
    }
    setTenantMenuOpen(true);
  };

  const consumeSensitiveToken = async () => {
    setSensitiveStatus(null);
    try {
      const result = await apiFetch("/api/eip/admin/db/sensitive/consume", {
        method: "POST",
        body: {
          tenant_id: sensitiveTenant,
          token: sensitiveToken,
        },
      });
      setSensitiveStatus({
        type: "success",
        message: `Token active until ${new Date(result.token_expires_at).toLocaleString()}`,
      });
    } catch (err) {
      setSensitiveStatus({
        type: "error",
        message: err.message || "Token failed.",
      });
    }
  };

  const clearSensitiveToken = async () => {
    setSensitiveStatus(null);
    try {
      await apiFetch("/api/eip/admin/db/sensitive/clear", { method: "POST", body: {} });
      setSensitiveStatus({
        type: "success",
        message: "Token cleared.",
      });
    } catch (err) {
      setSensitiveStatus({
        type: "error",
        message: err.message || "Clear failed.",
      });
    }
  };

  useEffect(() => {
    loadSchema();
  }, []);

  useEffect(() => {
    loadTable();
  }, [selectedSchema, selectedTable, tenantFilter, limit, offset, requiresTenant]);

  useEffect(() => {
    if (!totalCount) {
      if (offset !== 0) setOffset(0);
      return;
    }
    const maxOffset = Math.max(0, (Math.ceil(totalCount / limit) - 1) * limit);
    if (offset > maxOffset) {
      setOffset(maxOffset);
    }
  }, [totalCount, limit, offset]);

  useEffect(() => {
    if (!tenantMenuOpen) return undefined;
    const handle = setTimeout(() => {
      loadTenants(tenantQuery.trim());
    }, 200);
    return () => clearTimeout(handle);
  }, [tenantMenuOpen, tenantQuery]);

  useEffect(() => {
    if (!tenantFilter || tenantLabel) return;
    const match = tenantOptions.find((tenant) => tenant.id === tenantFilter);
    if (match) {
      setTenantLabel(
        match.name && match.code
          ? `${match.name} (${match.code})`
          : match.name || match.code || match.id
      );
    }
  }, [tenantFilter, tenantLabel, tenantOptions]);

  return (
    <div className="glass-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.35em] text-ink-400">
            {layout.title}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink-900">Database explorer</h2>
          <p className="mt-2 text-xs text-ink-500">{layout.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadSchema}
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-ink-600 shadow-soft hover:bg-white"
          >
            <Download className="h-4 w-4" />
            {layout.schema.export}
          </button>
          <button
            type="button"
            onClick={loadSchema}
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-ink-600 shadow-soft hover:bg-white"
          >
            <RefreshCw className="h-4 w-4" />
            {layout.table.refresh}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-700">
          {notice}
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-ink-100 bg-white/90 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-400">
              {layout.sensitive.title}
            </p>
            <p className="mt-1 text-[0.7rem] text-ink-500">{layout.sensitive.hint}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={consumeSensitiveToken}
              className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-white shadow-glow"
            >
              {layout.sensitive.consume}
            </button>
            <button
              type="button"
              onClick={clearSensitiveToken}
              className="inline-flex items-center gap-2 rounded-full border border-ink-200/70 bg-white px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-600"
            >
              {layout.sensitive.clear}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            value={sensitiveTenant}
            onChange={(event) => setSensitiveTenant(event.target.value)}
            placeholder={layout.sensitive.tenantPlaceholder}
            className="w-full max-w-xs rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
          />
          <input
            value={sensitiveToken}
            onChange={(event) => setSensitiveToken(event.target.value)}
            placeholder={layout.sensitive.tokenPlaceholder}
            className="w-full flex-1 rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
          />
        </div>
        {sensitiveStatus?.message ? (
          <div
            className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
              sensitiveStatus.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-emerald-200 bg-emerald-50 text-emerald-600"
            }`}
          >
            {sensitiveStatus.message}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-ink-100 bg-white/90 p-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-ink-500" />
            <h3 className="text-sm font-semibold text-ink-900">{layout.schema.title}</h3>
          </div>
          <input
            value={tableQuery}
            onChange={(event) => setTableQuery(event.target.value)}
            placeholder={layout.schema.searchPlaceholder}
            className="mt-3 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
          />
          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-2 text-xs text-ink-600">
            {loadingSchema ? (
              <div className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-500">
                Loading...
              </div>
            ) : null}
            {!loadingSchema && tableList.length === 0 ? (
              <div className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-500">
                {layout.schema.empty}
              </div>
            ) : null}
            {tableList.map((item) => {
              const active =
                item.schema === selectedSchema && item.name === selectedTable;
              return (
                <div key={`${item.schema}.${item.name}`} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleSelectTable(item.schema, item.name)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-[0.7rem] ${
                      active
                        ? "border-ink-900 bg-ink-900 text-white"
                        : "border-ink-100 bg-white text-ink-700 hover:bg-ink-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {item.sensitive ? (
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
                      ) : null}
                      {item.name}
                    </span>
                    <span className="text-[0.6rem] uppercase tracking-[0.2em] opacity-60">
                      {item.schema}
                    </span>
                  </button>
                  {active ? (
                    <div className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-[0.65rem] text-ink-500">
                      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-ink-400">
                        {layout.schema.columnsTitle}
                      </p>
                      <div className="mt-2 space-y-1">
                        {selectedMeta?.columns?.length ? (
                          selectedMeta.columns.map((col) => (
                            <div
                              key={col.name}
                              className="flex items-center justify-between"
                            >
                              <span className="font-semibold text-ink-700">
                                {col.name}
                              </span>
                              <span className="text-[0.6rem] uppercase tracking-[0.2em] text-ink-400">
                                {col.type}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-[0.65rem] text-ink-400">
                            {layout.schema.columnsEmpty}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-ink-100 bg-white/90 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-ink-400">
                  {layout.table.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink-900 break-all">
                    {selectedTableLabel || layout.table.placeholder}
                  </p>
                  {selectedMeta?.sensitive ? (
                    <ShieldAlert className="h-4 w-4 text-rose-500" />
                  ) : null}
                </div>
              </div>
              <div />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="relative w-full max-w-xs">
                <input
                  value={tenantInputValue}
                  onChange={(event) => handleTenantInputChange(event.target.value)}
                  onFocus={() => setTenantMenuOpen(true)}
                  onBlur={() => setTimeout(() => setTenantMenuOpen(false), 150)}
                  placeholder={
                    requiresTenant ? "Select tenant (required)" : layout.table.tenantPlaceholder
                  }
                  className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                />
                {tenantMenuOpen ? (
                  <div className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-ink-200/70 bg-white p-2 text-[0.7rem] text-ink-700 shadow-lg">
                    {tenantLoading ? (
                      <div className="rounded-lg bg-ink-50 px-3 py-2 text-[0.65rem] text-ink-500">
                        Loading...
                      </div>
                    ) : null}
                    {!tenantLoading && tenantOptions.length === 0 ? (
                      <div className="rounded-lg bg-ink-50 px-3 py-2 text-[0.65rem] text-ink-500">
                        No tenants found.
                      </div>
                    ) : null}
                    {tenantOptions.map((tenant) => (
                      <button
                        key={tenant.id}
                        type="button"
                        onClick={() => handleTenantSelect(tenant)}
                        className="flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left hover:bg-ink-50"
                      >
                        <span className="text-[0.75rem] font-semibold text-ink-900">
                          {tenant.name && tenant.code ? `${tenant.name} (${tenant.code})` : tenant.name || tenant.code || tenant.id}
                        </span>
                        <span className="text-[0.6rem] uppercase tracking-[0.2em] text-ink-400">
                          {tenant.id}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setTenantFilter("");
                  setTenantLabel("");
                  setTenantQuery("");
                  setSelectedRows(new Map());
                  setOffset(0);
                  setTotalCount(0);
                }}
                className="rounded-full border border-ink-100 bg-white px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-600"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-white/90 p-4">
            <h3 className="text-sm font-semibold text-ink-900">{layout.data.title}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.6rem] uppercase tracking-[0.25em] text-ink-500">
              <button
                type="button"
                onClick={downloadSelected}
                disabled={!selectedRowsArray.length}
                className="inline-flex items-center gap-2 rounded-full border border-ink-100 bg-white px-3 py-2 font-semibold text-ink-600 disabled:opacity-60"
              >
                <Download className="h-3 w-3" />
                Download Selected
              </button>
              {selectedRowsArray.length ? (
                <span className="text-[0.55rem] uppercase tracking-[0.2em] text-ink-400">
                  {selectedRowsArray.length} selected
                </span>
              ) : null}
            </div>
            {loadingRows ? (
              <p className="mt-3 text-xs text-ink-500">{layout.data.loading}</p>
            ) : null}
            {!loadingRows && rows.length === 0 ? (
              <p className="mt-3 text-xs text-ink-500">{layout.data.empty}</p>
            ) : null}
            {rows.length > 0 ? (
              <div className="mt-3 max-h-[420px] overflow-auto relative">
                <table className="min-w-full border-separate border-spacing-0 text-[0.7rem] text-ink-700">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-[0.6rem] uppercase tracking-[0.2em] text-ink-400">
                      <th className="sticky top-0 z-10 border-b border-ink-100 bg-white/95 px-3 py-2 text-left backdrop-blur">
                        <input
                          type="checkbox"
                          checked={allRowsSelected}
                          onChange={toggleAllRows}
                        />
                      </th>
                      {columns.map((col) => (
                        <th
                          key={col}
                          className="sticky top-0 z-10 border-b border-ink-100 bg-white/95 px-3 py-2 text-left backdrop-blur"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-ink-50">
                        <td className="px-3 py-2 align-top">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(resolveRowKey(row, idx))}
                            onChange={() => toggleRowSelection(resolveRowKey(row, idx), row)}
                          />
                        </td>
                        {columns.map((col) => {
                          const value = row[col];
                          const display =
                            value && typeof value === "object"
                              ? JSON.stringify(value)
                              : value ?? "";
                          return (
                            <td key={col} className="px-3 py-2 align-top">
                              {display}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[0.6rem] uppercase tracking-[0.25em] text-ink-400">
              <div className="flex items-center gap-2">
                <span>
                  Page {pageIndex + 1} of {pageCount}
                </span>
                <select
                  value={pageIndex}
                  onChange={(event) => setOffset(Number(event.target.value) * limit)}
                  className="rounded-full border border-ink-100 bg-white px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-600"
                >
                  {pageOptions.map((idx) => (
                    <option key={idx} value={idx}>
                      {idx + 1}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={pageIndex === 0}
                  className="rounded-full border border-ink-100 bg-white px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-600"
                >
                  {layout.pagination.prev}
                </button>
                <button
                  type="button"
                  onClick={() => setOffset(offset + limit)}
                  disabled={pageIndex + 1 >= pageCount}
                  className="rounded-full border border-ink-100 bg-white px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-600"
                >
                  {layout.pagination.next}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

