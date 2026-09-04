function normalizeText(value) {
  return String(value || "").trim();
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeMap(value) {
  const source = asObject(value);
  const output = new Map();
  for (const [key, raw] of Object.entries(source)) {
    const alias = normalizeText(key);
    if (!alias) continue;
    if (typeof raw === "string") {
      const canonical = normalizeText(raw);
      if (canonical) output.set(alias, { canonical_code: canonical, attrs: {} });
      continue;
    }
    const item = asObject(raw);
    const canonical = normalizeText(
      item.canonical_code || item.canonical || item.target || item.code
    );
    if (!canonical) continue;
    output.set(alias, {
      canonical_code: canonical,
      attrs: asObject(item.attrs || item.rules || item)
    });
  }
  return output;
}

function extractManifestFieldMap(row) {
  if (!row) return new Map();
  const manifest = asObject(row.manifest);
  const attrs = asObject(row.attrs);
  const candidates = [
    manifest?.mapping?.fields,
    manifest?.mapping?.field_aliases,
    manifest?.field_aliases,
    attrs?.mapping?.fields,
    attrs?.field_aliases
  ];
  for (const candidate of candidates) {
    const mapped = normalizeMap(candidate);
    if (mapped.size) return mapped;
  }
  return new Map();
}

async function loadActiveFieldAliases(db, tenantId) {
  const result = await db.query(
    `
    SELECT alias_code, canonical_code, attrs
    FROM eip_commerce.socket_alias_map
    WHERE tenant_id = $1
      AND map_kind = 'FIELD'
      AND is_active = true
    ORDER BY updated_at DESC, created_at DESC
    `,
    [tenantId]
  );

  const aliases = new Map();
  for (const row of result.rows || []) {
    const alias = normalizeText(row.alias_code);
    if (!alias || aliases.has(alias)) continue;
    aliases.set(alias, {
      canonical_code: normalizeText(row.canonical_code),
      attrs: asObject(row.attrs)
    });
  }
  return aliases;
}

async function loadPublishedSocketManifest(db, tenantId, { socketCode, connectionCode } = {}) {
  const normalizedSocket = normalizeText(socketCode);
  const normalizedConnection = normalizeText(connectionCode);
  const result = await db.query(
    `
    SELECT id, code, version, manifest, attrs, published_at, updated_at
    FROM eip_commerce.socket_manifest
    WHERE tenant_id = $1
      AND is_published = true
    ORDER BY
      CASE WHEN $2 <> '' AND code = $2 THEN 0 ELSE 1 END,
      CASE WHEN $3 <> '' AND attrs->>'connection_code' = $3 THEN 0 ELSE 1 END,
      version DESC,
      updated_at DESC
    LIMIT 1
    `,
    [tenantId, normalizedSocket, normalizedConnection]
  );
  return result.rows?.[0] || null;
}

function normalizeFieldContract(field) {
  const source = asObject(field);
  return {
    key: normalizeText(source.key),
    governance_list: normalizeText(source.governance_list || source.governanceList) || null,
    canonical_hint: normalizeText(source.canonical_hint || source.canonicalHint) || null,
    used_as_eip_parameter:
      source.used_as_eip_parameter === true || source.usedAsEipParameter === true,
    allow_free_text:
      source.allow_free_text === true || source.allowFreeText === true
  };
}

function normalizeAllowedSet(values) {
  return new Set(
    Array.from(values || [])
      .map((value) => normalizeText(value))
      .filter(Boolean)
  );
}

function resolveCandidate(field, { aliases, manifestMap, canonicalHintMap, allowed }) {
  const aliasEntry = aliases.get(field.key);
  if (aliasEntry) {
    const canonical = normalizeText(aliasEntry.canonical_code);
    return {
      source: "TENANT_ALIAS",
      canonical_code: canonical,
      attrs: aliasEntry.attrs,
      valid: allowed.has(canonical),
      reason: allowed.has(canonical) ? null : "CANONICAL_CODE_NOT_ALLOWED"
    };
  }

  const manifestEntry = manifestMap.get(field.key);
  if (manifestEntry) {
    const canonical = normalizeText(manifestEntry.canonical_code);
    return {
      source: "SOCKET_MANIFEST",
      canonical_code: canonical,
      attrs: manifestEntry.attrs,
      valid: allowed.has(canonical),
      reason: allowed.has(canonical) ? null : "CANONICAL_CODE_NOT_ALLOWED"
    };
  }

  const hint = normalizeText(field.canonical_hint);
  if (hint) {
    const canonical = normalizeText(canonicalHintMap?.[hint] || hint);
    return {
      source: "VALIDATED_CANONICAL_HINT",
      canonical_code: canonical,
      attrs: {},
      valid: allowed.has(canonical),
      reason: allowed.has(canonical) ? null : "CANONICAL_HINT_NOT_APPROVED"
    };
  }

  return {
    source: null,
    canonical_code: null,
    attrs: {},
    valid: false,
    reason: "NO_MAPPING"
  };
}

export async function resolveSocketFieldAliases(db, {
  tenantId,
  fields,
  allowedCanonicalCodes,
  canonicalHintMap = {},
  socketCode = null,
  connectionCode = null
}) {
  const allowed = normalizeAllowedSet(allowedCanonicalCodes);
  const contracts = Array.isArray(fields)
    ? fields.map(normalizeFieldContract).filter((field) => field.key)
    : [];

  const [aliases, manifestRow] = await Promise.all([
    loadActiveFieldAliases(db, tenantId),
    loadPublishedSocketManifest(db, tenantId, { socketCode, connectionCode })
  ]);
  const manifestMap = extractManifestFieldMap(manifestRow);

  const resolved = contracts.map((field) => {
    const candidate = resolveCandidate(field, {
      aliases,
      manifestMap,
      canonicalHintMap,
      allowed
    });
    return {
      ...field,
      status: candidate.valid ? "MAPPED" : "UNMAPPED",
      canonical_code: candidate.valid ? candidate.canonical_code : null,
      mapping_source: candidate.source,
      mapping_attrs: candidate.attrs,
      reason: candidate.reason
    };
  });

  const mapped = resolved.filter((field) => field.status === "MAPPED");
  const unmapped = resolved.filter((field) => field.status !== "MAPPED");

  return {
    source: {
      tenant_alias_count: aliases.size,
      socket_manifest: manifestRow
        ? {
            id: manifestRow.id,
            code: manifestRow.code,
            version: manifestRow.version,
            published_at: manifestRow.published_at || null
          }
        : null
    },
    summary: {
      total: resolved.length,
      mapped: mapped.length,
      unmapped: unmapped.length
    },
    fields: resolved
  };
}

export async function validateGovernedDropdownValue(db, {
  tenantId,
  listCode,
  value
}) {
  const code = normalizeText(listCode);
  const candidate = normalizeText(value);
  if (!code || !candidate) {
    return { ok: false, reason: "DROPDOWN_VALUE_REQUIRED" };
  }

  const result = await db.query(
    `
    SELECT dv.code, dv.label, dl.code AS list_code, dl.module, dl.tenant_id
    FROM eip_core.dropdown_list dl
    JOIN eip_core.dropdown_value dv ON dv.list_id = dl.id
    WHERE dl.code = $1
      AND dl.is_active = true
      AND dv.is_active = true
      AND dv.code = $2
      AND (dl.tenant_id = $3 OR dl.tenant_id IS NULL)
    ORDER BY (dl.tenant_id IS NULL) ASC, dl.version DESC, dv.sort_order ASC
    LIMIT 1
    `,
    [code, candidate, tenantId]
  );

  if (!result.rowCount) {
    return {
      ok: false,
      reason: "DROPDOWN_VALUE_NOT_GOVERNED",
      list_code: code,
      value: candidate
    };
  }

  return {
    ok: true,
    list_code: result.rows[0].list_code,
    module: result.rows[0].module,
    code: result.rows[0].code,
    label: result.rows[0].label
  };
}
