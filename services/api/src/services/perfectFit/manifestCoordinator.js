const DEFAULT_SURFACE_CODE = "perfect_fit_workspace_manifest";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeToken(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function flattenSchemaProperties(properties, prefix = "", output = []) {
  for (const [key, definition] of Object.entries(asObject(properties))) {
    const path = prefix ? `${prefix}.${key}` : key;
    const def = asObject(definition);
    if (def.type === "object" && def.properties) {
      flattenSchemaProperties(def.properties, path, output);
      continue;
    }
    output.push({
      logical_path: path,
      field_code: key,
      type: def.type || null,
      enum: Array.isArray(def.enum) ? def.enum : null,
      description: def.description || null
    });
  }
  return output;
}

async function loadApprovedMapping(db, tenantId, surfaceCode = DEFAULT_SURFACE_CODE) {
  const result = await db.query(
    `
    SELECT id, tenant_id, code, version, attrs, updated_at
    FROM eip_core.ui_surface
    WHERE code = $1
      AND is_active = true
      AND is_published = true
      AND (tenant_id = $2 OR tenant_id IS NULL)
    ORDER BY (tenant_id IS NULL) ASC, version DESC, updated_at DESC
    LIMIT 1
    `,
    [surfaceCode, tenantId]
  );
  const row = result.rows[0] || null;
  const attrs = asObject(row?.attrs);
  return {
    surface: row
      ? {
          id: row.id,
          code: row.code,
          version: row.version,
          tenant_id: row.tenant_id,
          updated_at: row.updated_at
        }
      : null,
    mapping: asObject(attrs.mapping),
    mapping_meta: asObject(attrs.mapping_meta)
  };
}

async function loadSchemaCatalogue(db, tenantId) {
  const result = await db.query(
    `
    SELECT DISTINCT ON (module, object_kind, object_type)
      id, tenant_id, module, object_kind, object_type, version,
      schema_json, ui_json, updated_at
    FROM eip_core.schema_registry
    WHERE is_active = true
      AND (tenant_id = $1 OR tenant_id IS NULL)
    ORDER BY
      module,
      object_kind,
      object_type,
      (tenant_id IS NULL) ASC,
      version DESC,
      updated_at DESC
    `,
    [tenantId]
  );

  return (result.rows || []).map((row) => {
    const schema = asObject(row.schema_json);
    const ui = asObject(row.ui_json);
    const storage = asObject(ui.storage);
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      module: row.module,
      object_kind: row.object_kind,
      object_type: row.object_type,
      version: row.version,
      storage,
      fields: flattenSchemaProperties(schema.properties),
      ui
    };
  });
}

async function loadDropdownCatalogue(db, tenantId) {
  const lists = await db.query(
    `
    SELECT DISTINCT ON (module, code)
      id, tenant_id, module, code, name, version, attrs, updated_at
    FROM eip_core.dropdown_list
    WHERE is_active = true
      AND (tenant_id = $1 OR tenant_id IS NULL)
    ORDER BY module, code, (tenant_id IS NULL) ASC, version DESC, updated_at DESC
    `,
    [tenantId]
  );

  const ids = (lists.rows || []).map((row) => row.id);
  let values = [];
  if (ids.length) {
    const valueResult = await db.query(
      `
      SELECT list_id, code, label, sort_order, attrs
      FROM eip_core.dropdown_value
      WHERE is_active = true
        AND list_id = ANY($1::uuid[])
      ORDER BY list_id, sort_order, label
      `,
      [ids]
    );
    values = valueResult.rows || [];
  }

  const byList = new Map();
  for (const value of values) {
    const rows = byList.get(String(value.list_id)) || [];
    rows.push({
      code: value.code,
      label: value.label,
      attrs: asObject(value.attrs)
    });
    byList.set(String(value.list_id), rows);
  }

  return (lists.rows || []).map((row) => ({
    id: row.id,
    module: row.module,
    code: row.code,
    name: row.name,
    version: row.version,
    attrs: asObject(row.attrs),
    values: byList.get(String(row.id)) || []
  }));
}

async function loadRelationalColumnCatalogue(db) {
  // These are existing kernel objects that the coordinator may project into.
  // The browser never receives arbitrary database access and never supplies a table name.
  const allowedTables = [
    "material",
    "asset",
    "service_object",
    "info_record",
    "object_link"
  ];
  const result = await db.query(
    `
    SELECT table_name, column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'eip_core'
      AND table_name = ANY($1::text[])
    ORDER BY table_name, ordinal_position
    `,
    [allowedTables]
  );
  return (result.rows || [])
    .filter((row) => !["tenant_id", "created_at", "updated_at"].includes(row.column_name))
    .map((row) => ({
      object_kind: row.table_name,
      field_code: row.column_name,
      logical_path: `${row.table_name}.${row.column_name}`,
      type: row.data_type,
      udt_name: row.udt_name,
      nullable: row.is_nullable === "YES",
      storage: {
        kind: "RELATIONAL_COLUMN",
        object_kind: row.table_name,
        field: row.column_name
      }
    }));
}

function buildTargetCatalogue({ schemas, relationalColumns }) {
  const targets = [];

  for (const item of relationalColumns) {
    targets.push({
      ...item,
      normalized_field: normalizeToken(item.field_code),
      normalized_path: normalizeToken(item.logical_path)
    });
  }

  for (const schema of schemas) {
    for (const field of schema.fields) {
      const explicitStorage = asObject(schema.ui?.field_storage?.[field.logical_path]);
      const storage = Object.keys(explicitStorage).length
        ? explicitStorage
        : {
            kind: "JSONB_SCHEMA_FIELD",
            object_kind: schema.object_kind,
            object_type: schema.object_type,
            logical_path: field.logical_path
          };
      targets.push({
        module: schema.module,
        object_kind: schema.object_kind,
        object_type: schema.object_type,
        field_code: field.field_code,
        logical_path: `${schema.object_kind}.${schema.object_type}.${field.logical_path}`,
        type: field.type,
        enum: field.enum,
        storage,
        normalized_field: normalizeToken(field.field_code),
        normalized_path: normalizeToken(`${schema.object_kind}.${schema.object_type}.${field.logical_path}`)
      });
    }
  }

  return targets;
}

function normalizeMappingEntry(value) {
  if (typeof value === "string") {
    return { target: value, status: "APPROVED", storage: {} };
  }
  const entry = asObject(value);
  return {
    ...entry,
    target: normalizeText(entry.target || entry.eip_path || entry.path),
    status: normalizeText(entry.status || "APPROVED").toUpperCase(),
    storage: asObject(entry.storage)
  };
}

function suggestTarget(field, targets) {
  const sourceKey = normalizeText(field?.key);
  const sourceLeaf = normalizeToken(sourceKey.split(".").pop());
  const sourcePath = normalizeToken(sourceKey);
  const objectKind = normalizeToken(field?.object_kind || field?.object || "");

  const exactPath = targets.find((target) => target.normalized_path === sourcePath);
  if (exactPath) return { target: exactPath, confidence: 1, reason: "EXACT_PATH" };

  const sameObjectExactLeaf = targets.filter((target) =>
    target.normalized_field === sourceLeaf &&
    (!objectKind || normalizeToken(target.object_kind) === objectKind)
  );
  if (sameObjectExactLeaf.length === 1) {
    return { target: sameObjectExactLeaf[0], confidence: 0.95, reason: "OBJECT_FIELD_MATCH" };
  }

  const exactLeaf = targets.filter((target) => target.normalized_field === sourceLeaf);
  if (exactLeaf.length === 1) {
    return { target: exactLeaf[0], confidence: 0.88, reason: "FIELD_MATCH" };
  }

  return null;
}

function dropdownResolution(field, dropdowns) {
  const requested = normalizeToken(field?.governance_list || field?.governanceList);
  if (!requested) return null;
  const matches = dropdowns.filter((list) => normalizeToken(list.code) === requested);
  if (matches.length !== 1) {
    return {
      status: matches.length ? "AMBIGUOUS" : "UNMAPPED",
      requested_code: field?.governance_list || field?.governanceList || null,
      matches: matches.map((item) => ({ module: item.module, code: item.code }))
    };
  }
  return {
    status: "MAPPED",
    requested_code: field?.governance_list || field?.governanceList || null,
    eip_list: {
      module: matches[0].module,
      code: matches[0].code,
      values: matches[0].values
    }
  };
}

export async function buildPerfectFitCoordinatorManifest(db, {
  tenantId,
  clientManifest = null,
  surfaceCode = DEFAULT_SURFACE_CODE
}) {
  const [approved, schemas, dropdowns, relationalColumns] = await Promise.all([
    loadApprovedMapping(db, tenantId, surfaceCode),
    loadSchemaCatalogue(db, tenantId),
    loadDropdownCatalogue(db, tenantId),
    loadRelationalColumnCatalogue(db)
  ]);

  const targets = buildTargetCatalogue({ schemas, relationalColumns });
  const fields = Array.isArray(clientManifest?.fields) ? clientManifest.fields : [];
  const mapping = approved.mapping;
  const resolvedFields = fields.map((field) => {
    const key = normalizeText(field?.key);
    const approvedEntry = key ? normalizeMappingEntry(mapping[key]) : null;
    const approvedTarget = approvedEntry?.target
      ? targets.find((target) => target.logical_path === approvedEntry.target)
      : null;
    const governedStorage = approvedEntry && Object.keys(approvedEntry.storage || {}).length
      ? approvedEntry.storage
      : null;
    const dropdown = dropdownResolution(field, dropdowns);

    if (approvedEntry?.target) {
      return {
        ...field,
        status: approvedTarget || governedStorage ? "MAPPED" : "MAPPING_TARGET_MISSING",
        mapping_source: "ADMIN_APPROVED",
        approved_mapping: approvedEntry,
        target: approvedTarget || {
          logical_path: approvedEntry.target,
          storage: governedStorage
        },
        dropdown
      };
    }

    const suggestion = suggestTarget(field, targets);
    if (suggestion) {
      return {
        ...field,
        status: suggestion.confidence >= 0.95 ? "AUTO_MAPPED" : "SUGGESTED",
        mapping_source: "MANIFEST_COORDINATOR",
        target: suggestion.target,
        confidence: suggestion.confidence,
        reason: suggestion.reason,
        dropdown
      };
    }

    return {
      ...field,
      status: field?.authority === "PERFECT_FIT_PRIVATE" ? "PF_PRIVATE" : "UNMAPPED",
      mapping_source: "MANIFEST_COORDINATOR",
      target: null,
      dropdown
    };
  });

  const summary = resolvedFields.reduce((acc, field) => {
    acc.total += 1;
    const key = String(field.status || "UNMAPPED").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { total: 0 });

  return {
    coordinator_version: 1,
    surface_code: surfaceCode,
    surface: approved.surface,
    mapping_meta: approved.mapping_meta,
    client_manifest_version: clientManifest?.version || null,
    summary,
    fields: resolvedFields,
    target_catalogue: targets,
    dropdown_catalogue: dropdowns.map((item) => ({
      module: item.module,
      code: item.code,
      name: item.name,
      version: item.version,
      values: item.values
    }))
  };
}

export { DEFAULT_SURFACE_CODE as PERFECT_FIT_MANIFEST_SURFACE_CODE };
