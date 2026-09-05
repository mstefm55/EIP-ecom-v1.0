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

  // These domains are DB-authoritative once a published Perfect Fit manifest exists.
  // Replace rather than merge so missing DB governance cannot be hidden by hardcoded values.
  replaceObjectContents(target.fields, source.fields);
  replaceObjectContents(target.fieldGroups, source.fieldGroups);
  replaceObjectContents(target.structure, source.structure);
  replaceObjectContents(target.dropdowns, source.dropdowns);

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
