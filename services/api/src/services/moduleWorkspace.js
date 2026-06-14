export async function loadModuleWorkspace(appOrDb, tenantId, moduleCode) {
  const db = appOrDb?.db || appOrDb;
  if (!db || !tenantId || !moduleCode) return null;

  const result = await db.query(
    `
    WITH tenant_workspace AS (
      SELECT attrs->'ui_workspace' AS workspace
      FROM eip_core.tenant_module_setting
      WHERE tenant_id=$1
        AND module=$2
        AND is_active=true
        AND attrs ? 'ui_workspace'
      ORDER BY updated_at DESC
      LIMIT 1
    ),
    catalog_workspace AS (
      SELECT attrs->'ui_workspace' AS workspace
      FROM eip_core.module_catalog
      WHERE code=$2
        AND is_active=true
        AND attrs ? 'ui_workspace'
      LIMIT 1
    )
    SELECT workspace
    FROM tenant_workspace
    UNION ALL
    SELECT workspace
    FROM catalog_workspace
    LIMIT 1
    `,
    [tenantId, moduleCode]
  );

  const workspace = result.rows[0]?.workspace;
  return workspace && typeof workspace === "object" ? workspace : null;
}

export async function loadDropdownCodeSets(appOrDb, tenantId, listCodes = []) {
  const db = appOrDb?.db || appOrDb;
  const codes = Array.isArray(listCodes) ? listCodes.filter(Boolean) : [];
  if (!db || !tenantId || !codes.length) return {};

  const result = await db.query(
    `
    WITH lists AS (
      SELECT DISTINCT ON (code) id, code
      FROM eip_core.dropdown_list
      WHERE is_active=true
        AND (tenant_id=$1 OR tenant_id IS NULL)
        AND code = ANY($2::text[])
      ORDER BY code, (tenant_id IS NOT NULL) DESC, version DESC
    )
    SELECT lists.code AS list_code, value.code
    FROM lists
    JOIN eip_core.dropdown_value value
      ON value.list_id=lists.id AND value.is_active=true
    `,
    [tenantId, codes]
  );

  const output = {};
  for (const row of result.rows || []) {
    output[row.list_code] = output[row.list_code] || new Set();
    output[row.list_code].add(String(row.code || "").toUpperCase());
  }
  return output;
}

export function allowedCodesFrom(codeSets, listCodes = [], fallback = []) {
  const allowed = new Set();
  for (const listCode of Array.isArray(listCodes) ? listCodes : [listCodes]) {
    for (const code of codeSets?.[listCode] || []) allowed.add(code);
  }
  if (!allowed.size) {
    for (const code of fallback || []) allowed.add(String(code || "").toUpperCase());
  }
  return [...allowed];
}
