const PERFECT_FIT_MANIFEST_CODE = "PERFECT_FIT";

function normalizeText(value) {
  return String(value || "").trim();
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeFieldDescriptor(key, value, bindings = {}) {
  const source = asObject(value);
  const fieldKey = normalizeText(source.key || key);
  const logicalGovernance = normalizeText(source.governanceList || source.governance_list);
  const governedCode = normalizeText(bindings?.[logicalGovernance] || logicalGovernance);
  return {
    key: fieldKey,
    scope: normalizeText(source.scope || fieldKey.split(".")[0]) || null,
    metadata_path: `workspace.fields.${fieldKey}`,
    field_type: normalizeText(source.type || source.field_type) || null,
    governance_list: governedCode || null,
    canonical_hint: null,
    used_as_eip_parameter:
      source.usedAsEipParameter === true || source.used_as_eip_parameter === true,
    allow_free_text:
      source.allowFreeText === true || source.allow_free_text === true,
    read_only: source.readOnly === true || source.read_only === true
  };
}

function normalizeStructureForContract(workspace) {
  const structure = asObject(workspace.structure);
  const treeTypes = asObject(structure.treeTypes || structure.tree_types);
  const hierarchy = asObject(
    structure.productHierarchy ||
    structure.product_hierarchy ||
    workspace.productHierarchy ||
    workspace.product_hierarchy
  );

  return {
    root_type: normalizeText(structure.rootType || structure.root_type) || "workspace",
    tree_types: Object.entries(treeTypes)
      .map(([code, raw]) => {
        const item = asObject(raw);
        return {
          code: normalizeText(code),
          title_field: normalizeText(item.titleField || item.title_field) || null,
          component_key: normalizeText(item.componentKey || item.component_key) || null,
          show_in_tree: item.showInTree !== false && item.show_in_tree !== false,
          children: (Array.isArray(item.children) ? item.children : [])
            .map(normalizeText)
            .filter(Boolean)
        };
      })
      .filter((item) => item.code),
    product_hierarchy: {
      levels: (Array.isArray(hierarchy.levels) ? hierarchy.levels : [])
        .map((raw) => {
          const item = asObject(raw);
          return {
            level: normalizeText(item.level).toUpperCase(),
            node_type: normalizeText(item.node_type || item.nodeType),
            parent_level: normalizeText(item.parent_level || item.parentLevel).toUpperCase() || null
          };
        })
        .filter((item) => item.level && item.node_type)
    }
  };
}

function extractPerfectFitPayload(row) {
  const manifest = asObject(row?.manifest);
  if (manifest.application === "perfect_fit" && manifest.workspace) return manifest;
  if (asObject(manifest.perfect_fit).workspace) return asObject(manifest.perfect_fit);
  if (asObject(asObject(manifest.metadata).perfect_fit).workspace) {
    return asObject(asObject(manifest.metadata).perfect_fit);
  }
  return {};
}

async function loadPublishedManifest(db, {
  tenantId,
  socketCode = null,
  connectionCode = null
}) {
  const socket = normalizeText(socketCode);
  const connection = normalizeText(connectionCode);
  const result = await db.query(
    `
    SELECT id, code, version, manifest, attrs, published_at, updated_at
    FROM eip_commerce.socket_manifest
    WHERE tenant_id = $1
      AND is_published = true
      AND (
        code = $4
        OR ($2 <> '' AND code = $2)
        OR ($3 <> '' AND attrs->>'connection_code' = $3)
        OR attrs->>'application' = 'perfect_fit'
      )
    ORDER BY
      CASE WHEN code = $4 THEN 0 ELSE 1 END,
      CASE WHEN $2 <> '' AND code = $2 THEN 0 ELSE 1 END,
      CASE WHEN $3 <> '' AND attrs->>'connection_code' = $3 THEN 0 ELSE 1 END,
      version DESC,
      updated_at DESC
    LIMIT 1
    `,
    [tenantId, socket, connection, PERFECT_FIT_MANIFEST_CODE]
  );
  return result.rows?.[0] || null;
}

async function loadEffectiveDropdowns(db, tenantId, bindings) {
  const dbCodes = [...new Set(
    Object.values(bindings || {})
      .map(normalizeText)
      .filter(Boolean)
  )];

  if (!dbCodes.length) return new Map();

  const result = await db.query(
    `
    SELECT dl.id,
           dl.code AS list_code,
           dl.module,
           dl.version,
           dl.tenant_id,
           dv.code AS value_code,
           dv.label AS value_label,
           dv.sort_order,
           dv.attrs AS value_attrs
    FROM eip_core.dropdown_list dl
    LEFT JOIN eip_core.dropdown_value dv
      ON dv.list_id = dl.id
     AND dv.is_active = true
    WHERE dl.code = ANY($1::text[])
      AND dl.is_active = true
      AND (dl.tenant_id = $2 OR dl.tenant_id IS NULL)
    ORDER BY
      dl.code,
      (dl.tenant_id IS NULL) ASC,
      dl.version DESC,
      dv.sort_order ASC,
      dv.code ASC
    `,
    [dbCodes, tenantId]
  );

  const selected = new Map();
  for (const row of result.rows || []) {
    const code = normalizeText(row.list_code);
    if (!code) continue;
    if (!selected.has(code)) {
      selected.set(code, {
        list_id: row.id,
        code,
        module: row.module,
        version: row.version,
        tenant_id: row.tenant_id,
        values: []
      });
    }
    const entry = selected.get(code);
    if (String(entry.list_id) !== String(row.id)) continue;
    if (!row.value_code) continue;
    entry.values.push({
      code: normalizeText(row.value_code),
      label: normalizeText(row.value_label) || normalizeText(row.value_code),
      sort_order: Number(row.sort_order || 0),
      attrs: asObject(row.value_attrs)
    });
  }
  return selected;
}

function buildRuntimeDropdowns(bindings, governed) {
  const output = {};
  for (const [logicalCode, rawDbCode] of Object.entries(bindings || {})) {
    const logical = normalizeText(logicalCode);
    const dbCode = normalizeText(rawDbCode);
    if (!logical || !dbCode) continue;
    const list = governed.get(dbCode);
    output[logical] = (list?.values || []).map((item) => ({
      code: item.code,
      label: item.label,
      eipV1Value: item.label,
      sortOrder: item.sort_order,
      attrs: item.attrs
    }));
  }
  return output;
}

export async function loadPerfectFitMetadataBundle(db, {
  tenantId,
  socketCode = null,
  connectionCode = null
}) {
  const row = await loadPublishedManifest(db, {
    tenantId,
    socketCode,
    connectionCode
  });

  if (!row) {
    return {
      ok: false,
      error: "PERFECT_FIT_METADATA_MANIFEST_NOT_PUBLISHED"
    };
  }

  const payload = extractPerfectFitPayload(row);
  const workspace = asObject(payload.workspace);
  const fields = asObject(workspace.fields);
  const fieldGroups = asObject(workspace.fieldGroups || workspace.field_groups);
  const bindings = asObject(workspace.dropdownBindings || workspace.dropdown_bindings);
  const governedDropdowns = await loadEffectiveDropdowns(db, tenantId, bindings);
  const runtimeDropdowns = buildRuntimeDropdowns(bindings, governedDropdowns);
  const structureContract = normalizeStructureForContract(workspace);

  const fieldContract = Object.entries(fields)
    .map(([key, value]) => normalizeFieldDescriptor(key, value, bindings))
    .filter((field) => field.key)
    .sort((a, b) => a.key.localeCompare(b.key));

  const dropdownContract = Object.entries(bindings)
    .map(([logicalCode, rawDbCode]) => {
      const logical = normalizeText(logicalCode);
      const dbCode = normalizeText(rawDbCode);
      const governed = governedDropdowns.get(dbCode);
      return {
        code: dbCode,
        logical_code: logical,
        governed_code: dbCode,
        source: "eip_core.dropdown_list",
        values: (governed?.values || []).map((item) => ({ code: item.code }))
      };
    })
    .filter((item) => item.code && item.logical_code)
    .sort((a, b) => a.logical_code.localeCompare(b.logical_code));

  return {
    ok: true,
    source: {
      authority: "EIP_DB",
      manifest_id: row.id,
      manifest_code: row.code,
      manifest_version: row.version,
      published_at: row.published_at || null,
      updated_at: row.updated_at || null
    },
    runtime_metadata: {
      application: "perfect_fit",
      workspace: {
        version: normalizeText(workspace.version) || `db-${row.version}`,
        fields,
        fieldGroups,
        structure: asObject(workspace.structure),
        dropdowns: runtimeDropdowns,
        dropdownBindings: bindings,
        metadataAuthority: {
          source: "EIP_DB",
          manifestId: row.id,
          manifestCode: row.code,
          manifestVersion: row.version
        }
      }
    },
    contract: {
      application: "perfect_fit",
      version: normalizeText(workspace.version) || `db-${row.version}`,
      fields: fieldContract,
      dropdowns: dropdownContract,
      structure: structureContract
    }
  };
}

export { PERFECT_FIT_MANIFEST_CODE };
