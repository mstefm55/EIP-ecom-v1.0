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

function replaceArrayContents(target, source) {
  if (!Array.isArray(target) || !Array.isArray(source)) return;
  target.splice(0, target.length, ...source);
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

function mergeGovernedOptions(governed, existing = []) {
  const currentByCode = new Map(
    (Array.isArray(existing) ? existing : [])
      .filter((item) => item?.code !== undefined && item?.code !== null)
      .map((item) => [String(item.code), item])
  );

  return (Array.isArray(governed) ? governed : []).map((option) => {
    const attrs = asObject(option?.attrs);
    const previous = currentByCode.get(String(option?.code || '')) || {};
    return {
      ...previous,
      ...attrs,
      ...option,
      attrs
    };
  });
}

function requireControlledVocabulary(controlled, logicalCode) {
  if (!Object.prototype.hasOwnProperty.call(controlled, logicalCode)) {
    throw new Error(`EIP Perfect Fit metadata is missing controlled vocabulary ${logicalCode}.`);
  }
  const options = controlled[logicalCode];
  if (!Array.isArray(options) || !options.length) {
    throw new Error(`EIP Perfect Fit controlled vocabulary ${logicalCode} has no governed values.`);
  }
  return options;
}

function applyControlledVocabularies(runtimeWorkspace) {
  const bindings = asObject(runtimeWorkspace.controlledBindings || runtimeWorkspace.controlled_bindings);
  if (!Object.keys(bindings).length) return;

  const controlled = normalizeRuntimeDropdowns(runtimeWorkspace.controlledVocabularies);
  for (const logicalCode of Object.keys(bindings)) {
    requireControlledVocabulary(controlled, logicalCode);
  }

  const workspace = perfectFitMetadata.workspace || {};
  workspace.media ||= {};
  workspace.sewing ||= {};
  workspace.sewing.timeMotion ||= {};
  workspace.collaboration ||= {};
  perfectFitMetadata.materials ||= {};
  perfectFitMetadata.materials.stockIssue ||= {};
  perfectFitMetadata.messaging ||= {};
  perfectFitMetadata.measurement ||= {};
  perfectFitMetadata.techPack ||= {};
  perfectFitMetadata.techPack.drawingStudio ||= {};

  const replaceGovernedArray = (container, key, logicalCode) => {
    const next = mergeGovernedOptions(
      requireControlledVocabulary(controlled, logicalCode),
      container[key]
    );
    if (Array.isArray(container[key])) {
      replaceArrayContents(container[key], next);
    } else {
      container[key] = next;
    }
  };

  replaceGovernedArray(workspace.media, 'assetTypes', 'MEDIA_ASSET_TYPE');
  replaceGovernedArray(workspace.media, 'assetRoles', 'MEDIA_ASSET_ROLE');
  replaceGovernedArray(workspace.media, 'profiles', 'MEDIA_PROFILE');

  replaceGovernedArray(workspace.sewing.timeMotion, 'studyModes', 'TIME_STUDY_MODE');
  replaceGovernedArray(workspace.sewing.timeMotion, 'sequenceModes', 'TIME_SEQUENCE_MODE');
  replaceGovernedArray(workspace.sewing.timeMotion, 'recordingModes', 'TIME_RECORDING_MODE');
  replaceGovernedArray(workspace.sewing.timeMotion, 'annotationTypes', 'TIME_ANNOTATION_TYPE');

  replaceGovernedArray(workspace.collaboration, 'shareScopes', 'COLLAB_SCOPE');
  replaceGovernedArray(workspace.collaboration, 'durations', 'COLLAB_DURATION');
  replaceGovernedArray(workspace.collaboration, 'policies', 'COLLAB_POLICY');
  replaceGovernedArray(workspace.collaboration, 'roles', 'COLLAB_ROLE');
  replaceGovernedArray(workspace.collaboration, 'permissions', 'COLLAB_PERMISSION');

  replaceGovernedArray(perfectFitMetadata.materials, 'uoms', 'MATERIAL_UOM');
  replaceGovernedArray(perfectFitMetadata.materials, 'currencies', 'MATERIAL_CURRENCY');
  replaceGovernedArray(perfectFitMetadata.materials, 'incomingStatuses', 'MATERIAL_INCOMING_STATUS');
  replaceGovernedArray(perfectFitMetadata.materials.stockIssue, 'transactionTypes', 'MATERIAL_ISSUE_TYPE');

  replaceGovernedArray(perfectFitMetadata.messaging, 'messageTypes', 'MESSAGE_TYPE');
  replaceGovernedArray(perfectFitMetadata.measurement, 'avatarGenders', 'AVATAR_GENDER');
  replaceGovernedArray(perfectFitMetadata.measurement, 'avatarAgeGroups', 'AVATAR_AGE_GROUP');
  replaceGovernedArray(perfectFitMetadata.measurement, 'units', 'MEASUREMENT_UNIT');

  replaceGovernedArray(perfectFitMetadata.techPack.drawingStudio, 'sequenceModes', 'TECHPACK_SEQUENCE_MODE');
  replaceGovernedArray(perfectFitMetadata.techPack.drawingStudio, 'referenceTypes', 'TECHPACK_REFERENCE_TYPE');

  workspace.controlledBindings = bindings;
  workspace.controlledVocabularies = controlled;
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

  replaceObjectContents(target.fields, source.fields);
  replaceObjectContents(target.fieldGroups, source.fieldGroups);
  replaceObjectContents(target.structure, source.structure);
  replaceObjectContents(target.dropdowns, normalizeRuntimeDropdowns(source.dropdowns));
  replaceObjectContents(target.referenceConvention, source.referenceConvention);

  target.dropdownBindings = asObject(source.dropdownBindings);
  applyControlledVocabularies(source);
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
