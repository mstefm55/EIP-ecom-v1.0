import { perfectFitMetadata } from '../config/perfectFitMetadata';

function normalizeText(value) {
  return String(value || '').trim();
}

function inferValueType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null || value === undefined) return 'unknown';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'object') return 'object';
  return 'string';
}

function inferObjectKind(key, nodeType = '') {
  const prefix = normalizeText(key).split('.')[0].toLowerCase();
  if (prefix === 'project') return 'project';
  if (prefix === 'product') return 'material';
  if (prefix === 'variant') return 'variant';
  if (prefix === 'asset' || prefix === 'media') return 'asset';
  if (prefix === 'measurement' || prefix === 'fit') return 'measurement';
  if (prefix === 'pattern') return 'pattern';
  if (prefix === 'sewing') return 'sewing';
  if (prefix === 'techpack' || prefix === 'tech_pack') return 'tech_pack';
  return normalizeText(nodeType || prefix || 'workspace');
}

function inferAuthority(key, nodeType = '') {
  const normalized = `${normalizeText(nodeType)}:${normalizeText(key)}`.toLowerCase();
  if (
    normalized.includes('measurement') ||
    normalized.includes('pattern') ||
    normalized.includes('sewing') ||
    normalized.includes('techpack') ||
    normalized.includes('tech_pack') ||
    normalized.includes('fit') ||
    normalized.includes('journal')
  ) {
    return 'PERFECT_FIT_PRIVATE';
  }
  return 'PERFECT_FIT';
}

function collectMetadataFieldDefinitions(value, output = new Map(), visited = new Set()) {
  if (!value || typeof value !== 'object') return output;
  if (visited.has(value)) return output;
  visited.add(value);

  if (!Array.isArray(value)) {
    const key = normalizeText(value.key || value.fieldKey || value.field_key);
    if (key && key.includes('.')) {
      output.set(key, {
        key,
        type: value.type || value.inputType || value.input_type || null,
        governance_list: value.governanceList || value.governance_list || null,
        label_key: value.labelKey || value.label_key || null,
        authority: value.authority || null
      });
    }
  }

  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    if (child && typeof child === 'object') {
      collectMetadataFieldDefinitions(child, output, visited);
    }
  }
  return output;
}

function collectObservedWorkspaceFields(workspace, definitions, output = new Map()) {
  const visitNode = (node, context = {}) => {
    if (!node || typeof node !== 'object') return;
    const nodeType = normalizeText(node.nodeType || context.nodeType || 'workspace');
    const values = node.values && typeof node.values === 'object' && !Array.isArray(node.values)
      ? node.values
      : {};

    for (const [key, value] of Object.entries(values)) {
      const definition = definitions.get(key) || {};
      const previous = output.get(key) || {};
      output.set(key, {
        key,
        object_kind: inferObjectKind(key, nodeType),
        node_type: nodeType,
        type: definition.type || previous.type || inferValueType(value),
        governance_list: definition.governance_list || previous.governance_list || null,
        label_key: definition.label_key || previous.label_key || null,
        authority: definition.authority || previous.authority || inferAuthority(key, nodeType),
        observed: true
      });
    }

    for (const child of node.children || []) {
      visitNode(child, { nodeType });
    }
  };

  for (const project of workspace?.projects || []) visitNode(project);
  return output;
}

export function buildPerfectFitFieldManifest({
  metadata = perfectFitMetadata,
  workspace = null
} = {}) {
  const definitions = collectMetadataFieldDefinitions(metadata?.workspace || metadata);
  const fields = new Map();

  for (const definition of definitions.values()) {
    fields.set(definition.key, {
      ...definition,
      object_kind: inferObjectKind(definition.key),
      authority: definition.authority || inferAuthority(definition.key),
      observed: false
    });
  }

  collectObservedWorkspaceFields(workspace, definitions, fields);

  return {
    application: 'perfect_fit',
    version: metadata?.workspace?.version || metadata?.version || 'v1',
    generated_at: new Date().toISOString(),
    fields: [...fields.values()].sort((a, b) => a.key.localeCompare(b.key))
  };
}
