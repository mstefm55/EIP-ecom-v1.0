import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { eipApiAdapter, isEipApiConfigured } from './eipApiAdapter';

export const PERFECT_FIT_METADATA_CHANGED_EVENT = 'perfectfit:metadata-changed';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function replaceObjectContents(target, source) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) return;
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, asObject(source));
}

function getRuntimeLabelPacks() {
  const workspace = perfectFitMetadata.workspace || {};

  perfectFitMetadata.i18n ||= {};
  perfectFitMetadata.i18n.localePacks ||= {};
  const appDefaultLocale = perfectFitMetadata.i18n.defaultLocale || 'en';
  perfectFitMetadata.i18n.localePacks[appDefaultLocale] ||= {};

  workspace.localePacks ||= {};
  const workspaceDefaultLocale = workspace.defaultLocale || appDefaultLocale;
  workspace.defaultLocale ||= workspaceDefaultLocale;
  workspace.localePacks[workspaceDefaultLocale] ||= {};

  return {
    app: perfectFitMetadata.i18n.localePacks[appDefaultLocale],
    workspace: workspace.localePacks[workspaceDefaultLocale]
  };
}

function normalizeRuntimeDropdowns(dropdowns) {
  const source = asObject(dropdowns);
  const normalized = {};
  const runtimeLabelPacks = getRuntimeLabelPacks();

  for (const [listCode, rawOptions] of Object.entries(source)) {
    const options = Array.isArray(rawOptions) ? rawOptions : [];
    normalized[listCode] = options.map((rawOption) => {
      const option = asObject(rawOption);
      const code = String(option.code || '').trim();
      const label = String(option.label || option.eipV1Value || code).trim();
      const existingLabelKey = String(option.labelKey || '').trim();
      const runtimeLabelKey = existingLabelKey || `runtime.dropdown.${listCode}.${code}`;

      // EIP dropdown_value.label remains the governed presentation value.
      // Existing PF workspace controls resolve dropdown labels through
      // workspace.localePacks, while app-wide controls use i18n.localePacks.
      // Register the DB-owned label in both runtime resolvers; do not recreate
      // or hardcode any dropdown values in React.
      if (!existingLabelKey && runtimeLabelKey && label) {
        runtimeLabelPacks.app[runtimeLabelKey] = label;
        runtimeLabelPacks.workspace[runtimeLabelKey] = label;
      }

      return {
        ...option,
        code,
        label,
        eipV1Value: option.eipV1Value || label,
        labelKey: runtimeLabelKey
      };
    });
  }

  return normalized;
}

function applyWorkspaceMetadata(runtimeWorkspace) {
  const source = asObject(runtimeWorkspace);
  const target = perfectFitMetadata.workspace;
  if (!target || typeof target !== 'object') {
    throw new Error('Perfect Fit workspace metadata fallback is unavailable.');
  }

  if (!Object.keys(asObject(source.fields)).length) {
    throw new Error('EIP Perfect Fit metadata has no governed fields.');
  }
  if (!Object.keys(asObject(source.fieldGroups)).length) {
    throw new Error('EIP Perfect Fit metadata has no governed field groups.');
  }
  if (!Object.keys(asObject(source.structure)).length) {
    throw new Error('EIP Perfect Fit metadata has no governed workspace structure.');
  }
  if (!Object.keys(asObject(source.dropdowns)).length) {
    throw new Error('EIP Perfect Fit metadata has no governed dropdowns.');
  }

  target.version = source.version || target.version;

  target.fields ||= {};
  target.fieldGroups ||= {};
  target.structure ||= {};
  target.dropdowns ||= {};
  target.referenceConvention ||= {};

  // These domains are DB-authoritative once a published Perfect Fit manifest exists.
  // Replace rather than merge so missing DB governance cannot be hidden by hardcoded values.
  replaceObjectContents(target.fields, source.fields);
  replaceObjectContents(target.fieldGroups, source.fieldGroups);
  replaceObjectContents(target.structure, source.structure);
  replaceObjectContents(target.dropdowns, normalizeRuntimeDropdowns(source.dropdowns));
  replaceObjectContents(target.referenceConvention, source.referenceConvention);

  target.dropdownBindings = asObject(source.dropdownBindings);
  target.metadataAuthority = {
    ...asObject(source.metadataAuthority),
    source: 'EIP_DB'
  };
}

function emitMetadataChanged(detail) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(PERFECT_FIT_METADATA_CHANGED_EVENT, { detail }));
  } catch {}
}

export async function initializePerfectFitRuntimeMetadata() {
  if (!isEipApiConfigured()) {
    return { hydrated: false, source: 'LEGACY_BOOTSTRAP', reason: 'EIP_NOT_CONFIGURED' };
  }

  try {
    const result = await eipApiAdapter.loadMetadata();
    const runtimeMetadata = asObject(result?.metadata);
    const runtimeWorkspace = asObject(runtimeMetadata.workspace);
    if (!Object.keys(runtimeWorkspace).length) {
      throw new Error('EIP Perfect Fit metadata payload is empty.');
    }

    applyWorkspaceMetadata(runtimeWorkspace);
    const detail = {
      hydrated: true,
      source: 'EIP_DB',
      manifest: result?.manifest_source || runtimeWorkspace.metadataAuthority || null
    };
    emitMetadataChanged(detail);
    return detail;
  } catch (error) {
    // Transitional safety only: the legacy bundle keeps the UI bootable until the
    // DB metadata migration is applied. It is never uploaded or treated as governance.
    console.error('[PerfectFit metadata] EIP DB metadata hydrate failed', error);
    const detail = {
      hydrated: false,
      source: 'LEGACY_BOOTSTRAP',
      error: error?.message || String(error)
    };
    emitMetadataChanged(detail);
    return detail;
  }
}
