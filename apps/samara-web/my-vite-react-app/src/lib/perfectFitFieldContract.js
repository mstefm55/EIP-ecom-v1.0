import { perfectFitMetadata } from '../config/perfectFitMetadata';

function normalizeText(value) {
  return String(value || '').trim();
}

/**
 * Transport view of the existing Perfect Fit workspace field metadata.
 * This does not define a second manifest and never contains EIP table/JSONB storage paths.
 * eipV1Target is sent only as a canonical vocabulary hint and is validated server-side.
 */
export function buildPerfectFitFieldContract(metadata = perfectFitMetadata) {
  const workspace = metadata?.workspace || {};
  const fields = workspace?.fields && typeof workspace.fields === 'object'
    ? workspace.fields
    : {};

  return {
    application: 'perfect_fit',
    version: workspace.version || metadata?.version || 'v1',
    fields: Object.values(fields)
      .map((field) => ({
        key: normalizeText(field?.key),
        governance_list: normalizeText(field?.governanceList) || null,
        canonical_hint: normalizeText(field?.eipV1Target) || null,
        used_as_eip_parameter: field?.usedAsEipParameter === true,
        allow_free_text: field?.allowFreeText === true
      }))
      .filter((field) => field.key)
  };
}
