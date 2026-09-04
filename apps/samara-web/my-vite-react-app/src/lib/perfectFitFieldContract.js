import { perfectFitMetadata } from '../config/perfectFitMetadata';

function normalizeText(value) {
  return String(value || '').trim();
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function inferScope(key) {
  const normalized = normalizeText(key);
  if (!normalized) return null;
  const [scope] = normalized.split('.');
  return scope || null;
}

function isFieldDescriptor(value) {
  const item = asObject(value);
  if (!normalizeText(item.key)) return false;
  return Boolean(
    normalizeText(item.type) ||
    normalizeText(item.governanceList) ||
    normalizeText(item.eipV1Target) ||
    Object.prototype.hasOwnProperty.call(item, 'allowFreeText') ||
    Object.prototype.hasOwnProperty.call(item, 'readOnly') ||
    Object.prototype.hasOwnProperty.call(item, 'usedAsEipParameter')
  );
}

function normalizeFieldDescriptor(field, metadataPath = '') {
  const key = normalizeText(field?.key);
  return {
    key,
    scope: inferScope(key),
    metadata_path: normalizeText(metadataPath) || null,
    field_type: normalizeText(field?.type) || null,
    governance_list: normalizeText(field?.governanceList) || null,
    canonical_hint: normalizeText(field?.eipV1Target) || null,
    used_as_eip_parameter: field?.usedAsEipParameter === true,
    allow_free_text: field?.allowFreeText === true,
    read_only: field?.readOnly === true
  };
}

function collectDeclaredFields(root) {
  const found = new Map();
  const seen = new WeakSet();

  function visit(value, path = '') {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    if (isFieldDescriptor(value)) {
      const field = normalizeFieldDescriptor(value, path);
      if (field.key && !found.has(field.key)) found.set(field.key, field);
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    Object.entries(value).forEach(([key, child]) => {
      const nextPath = path ? `${path}.${key}` : key;
      visit(child, nextPath);
    });
  }

  visit(root);
  return [...found.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function buildWorkspaceDropdownContract(workspace) {
  return Object.entries(asObject(workspace?.dropdowns))
    .map(([code, rawValues]) => ({
      code: normalizeText(code),
      source: 'workspace.dropdowns',
      values: (Array.isArray(rawValues) ? rawValues : [])
        .map((item) => ({
          code: normalizeText(item?.code),
          parent_code: normalizeText(item?.parentCode || item?.parent_code) || null
        }))
        .filter((item) => item.code)
    }))
    .filter((item) => item.code)
    .sort((a, b) => a.code.localeCompare(b.code));
}

function buildWorkspaceStructureContract(workspace) {
  const structure = asObject(workspace?.structure);
  const treeTypes = asObject(structure.treeTypes);

  return {
    root_type: normalizeText(structure.rootType) || 'workspace',
    tree_types: Object.entries(treeTypes)
      .map(([code, definition]) => ({
        code: normalizeText(code),
        title_field: normalizeText(definition?.titleField) || null,
        component_key: normalizeText(definition?.componentKey) || null,
        show_in_tree: definition?.showInTree !== false,
        children: (Array.isArray(definition?.children) ? definition.children : [])
          .map(normalizeText)
          .filter(Boolean)
      }))
      .filter((item) => item.code),
    product_hierarchy: {
      levels: [
        {
          level: 'STYLE',
          node_type: 'product',
          parent_level: 'PROJECT'
        },
        {
          level: 'STYLE_VARIANT',
          node_type: 'variant',
          parent_level: 'STYLE'
        },
        {
          level: 'SIZE_VARIANT',
          node_type: 'measurement_chart_size',
          parent_level: 'STYLE_VARIANT'
        }
      ]
    }
  };
}

/**
 * Transport view of Perfect Fit's existing metadata fallback.
 *
 * Perfect Fit has no application database. This contract lets EIP compare the
 * browser fallback with the DB-backed SmartSocket/schema/dropdown governance.
 * It is a declaration/suggestion only: browser metadata never publishes or
 * overrides EIP governance by itself.
 *
 * The contract deliberately contains logical keys/codes only and no EIP table,
 * column or JSONB storage paths.
 */
export function buildPerfectFitManifestContract(metadata = perfectFitMetadata) {
  const workspace = asObject(metadata?.workspace);
  const declaredFields = collectDeclaredFields(metadata);

  return {
    application: 'perfect_fit',
    version: normalizeText(workspace.version || metadata?.version) || 'v1',
    fields: declaredFields,
    dropdowns: buildWorkspaceDropdownContract(workspace),
    structure: buildWorkspaceStructureContract(workspace)
  };
}

/**
 * Backward-compatible field-only view used by older callers/tests.
 */
export function buildPerfectFitFieldContract(metadata = perfectFitMetadata) {
  const manifest = buildPerfectFitManifestContract(metadata);
  return {
    application: manifest.application,
    version: manifest.version,
    fields: manifest.fields
  };
}
