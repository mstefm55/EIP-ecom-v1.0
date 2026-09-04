import { resolveSocketFieldAliases } from "../socket/fieldAliasResolver.js";

const CURRENT_PRODUCT_CANONICAL_CODES = Object.freeze([
  "product.name",
  "product.code",
  "product.category",
  "attrs.product_description",
  "attrs.designer_code",
  "attrs.variant_code"
]);

function normalizeText(value) {
  return String(value || "").trim();
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeField(field) {
  const source = asObject(field);
  const key = normalizeText(source.key);
  return {
    key,
    scope: normalizeText(source.scope) || normalizeText(key.split(".")[0]) || null,
    metadata_path: normalizeText(source.metadata_path) || null,
    field_type: normalizeText(source.field_type) || null,
    governance_list: normalizeText(source.governance_list) || null,
    canonical_hint: normalizeText(source.canonical_hint) || null,
    used_as_eip_parameter: source.used_as_eip_parameter === true,
    allow_free_text: source.allow_free_text === true,
    read_only: source.read_only === true
  };
}

function normalizeDropdown(dropdown) {
  const source = asObject(dropdown);
  return {
    code: normalizeText(source.code),
    source: normalizeText(source.source) || null,
    values: (Array.isArray(source.values) ? source.values : [])
      .map((item) => ({
        code: normalizeText(item?.code),
        parent_code: normalizeText(item?.parent_code) || null
      }))
      .filter((item) => item.code)
  };
}

function normalizeStructure(structure) {
  const source = asObject(structure);
  const hierarchy = asObject(source.product_hierarchy);
  return {
    root_type: normalizeText(source.root_type) || null,
    tree_types: (Array.isArray(source.tree_types) ? source.tree_types : [])
      .map((item) => ({
        code: normalizeText(item?.code),
        children: (Array.isArray(item?.children) ? item.children : [])
          .map(normalizeText)
          .filter(Boolean)
      }))
      .filter((item) => item.code),
    product_hierarchy: {
      levels: (Array.isArray(hierarchy.levels) ? hierarchy.levels : [])
        .map((item) => ({
          level: normalizeText(item?.level).toUpperCase(),
          node_type: normalizeText(item?.node_type),
          parent_level: normalizeText(item?.parent_level).toUpperCase() || null
        }))
        .filter((item) => item.level && item.node_type)
    }
  };
}

async function loadDropdownGovernance(db, tenantId, dropdowns) {
  const requestedCodes = [...new Set(
    dropdowns.map((item) => item.code).filter(Boolean)
  )];
  if (!requestedCodes.length) {
    return { lists: [], summary: { total: 0, aligned: 0, review_required: 0 } };
  }

  const result = await db.query(
    `
    SELECT dl.id,
           dl.code AS list_code,
           dl.module,
           dl.version,
           dl.tenant_id,
           dv.code AS value_code,
           dv.sort_order
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
    [requestedCodes, tenantId]
  );

  const effectiveByCode = new Map();
  for (const row of result.rows || []) {
    const code = normalizeText(row.list_code);
    if (!code) continue;
    if (!effectiveByCode.has(code)) {
      effectiveByCode.set(code, {
        list_id: row.id,
        code,
        module: row.module,
        version: row.version,
        tenant_id: row.tenant_id,
        values: new Set()
      });
    }
    const entry = effectiveByCode.get(code);
    // Ignore rows from a lower-precedence list once an effective list has been chosen.
    if (String(entry.list_id) !== String(row.id)) continue;
    if (row.value_code) entry.values.add(normalizeText(row.value_code));
  }

  const lists = dropdowns.map((requested) => {
    const governed = effectiveByCode.get(requested.code);
    if (!governed) {
      return {
        code: requested.code,
        status: "ADMIN_REVIEW",
        reason: "DROPDOWN_LIST_NOT_GOVERNED",
        missing_values: requested.values.map((item) => item.code),
        extra_values: []
      };
    }

    const requestedValues = new Set(requested.values.map((item) => item.code));
    const missingValues = [...requestedValues].filter((code) => !governed.values.has(code));
    const extraValues = [...governed.values].filter((code) => !requestedValues.has(code));

    return {
      code: requested.code,
      status: missingValues.length ? "VALUE_MAPPING_REQUIRED" : "ALIGNED",
      reason: missingValues.length ? "DROPDOWN_VALUES_MISSING" : null,
      module: governed.module,
      version: governed.version,
      tenant_override: governed.tenant_id != null,
      missing_values: missingValues,
      extra_values: extraValues
    };
  });

  return {
    lists,
    summary: {
      total: lists.length,
      aligned: lists.filter((item) => item.status === "ALIGNED").length,
      value_mapping_required: lists.filter((item) => item.status === "VALUE_MAPPING_REQUIRED").length,
      admin_review: lists.filter((item) => item.status === "ADMIN_REVIEW").length
    }
  };
}

function hierarchyAudit(structure) {
  const levels = structure?.product_hierarchy?.levels || [];
  const byLevel = new Map(levels.map((item) => [item.level, item]));
  const style = byLevel.get("STYLE");
  const styleVariant = byLevel.get("STYLE_VARIANT");
  const sizeVariant = byLevel.get("SIZE_VARIANT");

  const issues = [];
  if (!style || style.node_type !== "product") {
    issues.push("STYLE_LEVEL_DECLARATION_REQUIRED");
  }
  if (!styleVariant || styleVariant.node_type !== "variant" || styleVariant.parent_level !== "STYLE") {
    issues.push("STYLE_VARIANT_LEVEL_DECLARATION_REQUIRED");
  }
  if (!sizeVariant || sizeVariant.parent_level !== "STYLE_VARIANT") {
    issues.push("SIZE_VARIANT_LEVEL_DECLARATION_REQUIRED");
  }

  return {
    ok: issues.length === 0,
    issues,
    levels,
    eip_target_model: {
      style: "STYLE_MASTER_PRODUCT",
      style_variant: "STYLE_VARIANT_PRODUCT",
      style_variant_relation: "STYLE_VARIANT_OF",
      size_variant: "EXISTING_ECOM_VARIANT_MATRIX"
    }
  };
}

function classifyField(field, resolvedField, dropdownStatusByCode) {
  const dropdownStatus = field.governance_list
    ? dropdownStatusByCode.get(field.governance_list)
    : null;

  if (
    dropdownStatus === "VALUE_MAPPING_REQUIRED" ||
    dropdownStatus === "ADMIN_REVIEW"
  ) {
    return {
      disposition: "VALUE_MAPPING_REQUIRED",
      reason: "FIELD_DROPDOWN_GOVERNANCE_INCOMPLETE"
    };
  }

  if (resolvedField?.status === "MAPPED") {
    return {
      disposition: "ENTERPRISE_MAPPED",
      reason: null
    };
  }

  if (field.scope === "variant") {
    return {
      disposition: "OBJECT_MAPPING_REQUIRED",
      reason: "STYLE_VARIANT_HIERARCHY_PENDING"
    };
  }

  if (field.scope === "product" && field.canonical_hint) {
    return {
      disposition: "ADMIN_REVIEW",
      reason: resolvedField?.reason || "PRODUCT_FIELD_MAPPING_REQUIRED"
    };
  }

  if (field.scope === "project") {
    return {
      disposition: "WORKSPACE_ONLY",
      reason: "PROJECT_REMAINS_PRIVATE_WORKSPACE_CONTEXT"
    };
  }

  if (field.used_as_eip_parameter || field.canonical_hint) {
    return {
      disposition: "ADMIN_REVIEW",
      reason: resolvedField?.reason || "CANONICAL_MAPPING_REQUIRED"
    };
  }

  return {
    disposition: "WORKSPACE_ONLY",
    reason: "DURABLE_IN_EIP_WORKSPACE_DOCUMENT"
  };
}

export async function auditPerfectFitManifestCompleteness(db, {
  tenantId,
  manifestContract,
  socketCode = null,
  connectionCode = null
}) {
  const manifest = asObject(manifestContract);
  const fields = (Array.isArray(manifest.fields) ? manifest.fields : [])
    .map(normalizeField)
    .filter((field) => field.key);
  const dropdowns = (Array.isArray(manifest.dropdowns) ? manifest.dropdowns : [])
    .map(normalizeDropdown)
    .filter((item) => item.code);
  const structure = normalizeStructure(manifest.structure);

  const [fieldResolution, dropdownAudit] = await Promise.all([
    resolveSocketFieldAliases(db, {
      tenantId,
      fields,
      allowedCanonicalCodes: CURRENT_PRODUCT_CANONICAL_CODES,
      socketCode,
      connectionCode
    }),
    loadDropdownGovernance(db, tenantId, dropdowns)
  ]);

  const resolvedByKey = new Map(
    (fieldResolution.fields || []).map((field) => [field.key, field])
  );
  const dropdownStatusByCode = new Map(
    dropdownAudit.lists.map((item) => [item.code, item.status])
  );

  const fieldAudit = fields.map((field) => {
    const resolved = resolvedByKey.get(field.key) || null;
    const classified = classifyField(field, resolved, dropdownStatusByCode);
    return {
      ...field,
      disposition: classified.disposition,
      reason: classified.reason,
      canonical_code: resolved?.canonical_code || null,
      mapping_source: resolved?.mapping_source || null,
      mapping_reason: resolved?.reason || null,
      schema_suggestions: resolved?.schema_suggestions || [],
      durable_storage: "EIP_PERFECT_FIT_WORKSPACE"
    };
  });

  const dispositionCounts = {};
  for (const item of fieldAudit) {
    dispositionCounts[item.disposition] = (dispositionCounts[item.disposition] || 0) + 1;
  }

  const unaccounted = fieldAudit.filter((item) => !item.disposition);
  const reviewRequired = fieldAudit.filter((item) =>
    ["VALUE_MAPPING_REQUIRED", "OBJECT_MAPPING_REQUIRED", "ADMIN_REVIEW"].includes(item.disposition)
  );
  const hierarchy = hierarchyAudit(structure);

  return {
    ok: unaccounted.length === 0,
    application: normalizeText(manifest.application) || "perfect_fit",
    version: normalizeText(manifest.version) || null,
    summary: {
      fields_total: fieldAudit.length,
      fields_accounted: fieldAudit.length - unaccounted.length,
      fields_unaccounted: unaccounted.length,
      review_required: reviewRequired.length,
      dispositions: dispositionCounts,
      dropdowns: dropdownAudit.summary,
      hierarchy_ok: hierarchy.ok
    },
    fields: fieldAudit,
    dropdowns: dropdownAudit.lists,
    hierarchy,
    field_resolution_source: fieldResolution.source
  };
}
