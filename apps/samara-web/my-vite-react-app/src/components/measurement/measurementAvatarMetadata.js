import { perfectFitMetadata } from '../../config/perfectFitMetadata';
import {
  getAvatarProfile,
  normalizeAvatarProfileId,
  getMeasurementProfileLabel,
  getMeasurementProfileShortLabel,
  measurementAppliesToProfile
} from './avatarProfiles';
import { getRussianMeasurementReference } from './russianFemaleMeasurementGuide';
import { runtimeDataStorage } from '../../lib/runtimeDataGateway';

export const IMAGE_SIZE = perfectFitMetadata.measurement.imageSize;
export const STAGE_ASPECT = perfectFitMetadata.measurement.stageAspect;
export const CALIBRATION_STORAGE_KEY = perfectFitMetadata.measurement.calibrationStorageKey;
export const MEASUREMENT_ADMIN_STORAGE_KEY = perfectFitMetadata.measurement.adminStorageKey;
export const MEASUREMENT_PERSISTENCE = perfectFitMetadata.measurement.persistence;
export const CALIBRATION_EDITOR_VERSION = perfectFitMetadata.measurement.version;
export const ANCHOR_COLORS = perfectFitMetadata.measurement.anchorColors;
export const VIEW_MEASUREMENT_ORDER = perfectFitMetadata.measurement.viewOrder;
export const MEASUREMENT_INPUT_SPECS = perfectFitMetadata.measurement.inputSpecs;
export const MEASUREMENT_DISPLAY_CODES = perfectFitMetadata.measurement.displayCodes;
export const DEFAULT_MEASUREMENTS = perfectFitMetadata.measurement.definitions;
export const DEFAULT_VIEW_CONFIG = perfectFitMetadata.measurement.defaultViewConfig;

export function getMeasurementInputSpec(code, type = '') {
  const explicit = MEASUREMENT_INPUT_SPECS[code];
  if (explicit) return explicit;

  const russianReference = getRussianMeasurementReference(code);

  // Safe generic defaults for administrator-created / newly translated
  // measurements until a dedicated anthropometric range is published in EIP.
  const base =
    type === 'circumference' || type === 'curve'
      ? {
          minCm: 10, maxCm: 180, stepCm: 0.5, exampleCm: 50,
          instruction: 'Measure this circumference at the indicated tape position.',
          tapeHelp: 'Follow the measurement tape shown on the avatar.',
          mistake: 'Keep the tape at the indicated level and do not compress the body.'
        }
      : {
          minCm: 5, maxCm: 180, stepCm: 0.25, exampleCm: 40,
          instruction: 'Measure between the indicated start and end points.',
          tapeHelp: 'Follow the measurement line shown on the avatar.',
          mistake: 'Use the indicated anatomical start and end points.'
        };

  if (!russianReference) return base;

  return {
    ...base,
    instruction: russianReference.descriptionEn,
    tapeHelp: russianReference.descriptionEn,
    sourceReference: russianReference
  };
}

export function normalizeView(value) {
  const viewName = String(value || '').toUpperCase();
  if (viewName === 'SIDE' || viewName === 'BACK') return viewName;
  return 'FRONT';
}

export function buildViewConfig(definitions = DEFAULT_MEASUREMENTS, avatarProfileId = 'ADULT_FEMALE') {
  const profile = getAvatarProfile(normalizeAvatarProfileId(avatarProfileId));
  const result = Object.fromEntries(
    Object.entries(profile.images).map(([viewName, image]) => [
      viewName,
      { image, markers: {}, guides: {}, focus: {} }
    ])
  );

  definitions.forEach((definition) => {
    Object.entries(definition.layout || {}).forEach(([viewName, layout]) => {
      if (!result[viewName] || !layout) return;
      result[viewName].markers[definition.code] = layout.marker;
      result[viewName].guides[definition.code] = layout.guide;
      result[viewName].focus[definition.code] =
        layout.focus || { x: 50, y: 50, scale: 2 };
    });
  });

  return result;
}

export function readMeasurementAdminConfig() {
  if (typeof window === 'undefined') {
    return { hiddenByView: {}, hiddenByProfileView: {}, deletedByProfileView: {}, deletedCodes: [], customMeasurements: [] };
  }

  try {
    const parsed = JSON.parse(runtimeDataStorage.getItem(MEASUREMENT_ADMIN_STORAGE_KEY) || '{}') || {};
    return {
      hiddenByView: parsed.hiddenByView || {},
      hiddenByProfileView: parsed.hiddenByProfileView || {},
      deletedByProfileView: parsed.deletedByProfileView || {},
      deletedCodes: Array.isArray(parsed.deletedCodes) ? parsed.deletedCodes : [],
      customMeasurements: Array.isArray(parsed.customMeasurements) ? parsed.customMeasurements : []
    };
  } catch {
    return { hiddenByView: {}, hiddenByProfileView: {}, deletedByProfileView: {}, deletedCodes: [], customMeasurements: [] };
  }
}

export function saveMeasurementAdminConfig(config) {
  if (typeof window === 'undefined') return;
  try {
    runtimeDataStorage.setItem(MEASUREMENT_ADMIN_STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

export function isMeasurementVisible(
  adminConfig,
  viewName,
  code,
  avatarProfileId = 'ADULT_FEMALE'
) {
  const normalized = normalizeView(viewName);
  const normalizedProfileId = normalizeAvatarProfileId(avatarProfileId);
  const profileHidden =
    adminConfig?.hiddenByProfileView?.[normalizedProfileId]?.[normalized] ||
    adminConfig?.hiddenByProfileView?.[avatarProfileId]?.[normalized] || [];

  if (profileHidden.includes(code)) return false;

  // Backward compatibility with V4–V6 global-per-view settings.
  return !(adminConfig?.hiddenByView?.[normalized] || []).includes(code);
}

export function getMeasurementsForView(
  definitions,
  adminConfig,
  viewName,
  {
    includeHidden = false,
    listOnly = true,
    profileId = 'ADULT_FEMALE'
  } = {}
) {
  const normalized = normalizeView(viewName);
  const byCode = new Map((definitions || []).map((definition) => [definition.code, definition]));
  const orderedCodes = listOnly
    ? [...(VIEW_MEASUREMENT_ORDER[normalized] || [])]
    : (definitions || [])
        .filter((definition) => Boolean(definition.layout?.[normalized]))
        .map((definition) => definition.code);

  (definitions || []).forEach((definition) => {
    if (
      definition.custom &&
      definition.layout?.[normalized] &&
      !orderedCodes.includes(definition.code)
    ) {
      orderedCodes.push(definition.code);
    }
  });

  return orderedCodes
    .map((code) => byCode.get(code))
    .filter(Boolean)
    .filter((definition) => Boolean(definition.layout?.[normalized]))
    .filter((definition) => measurementAppliesToProfile(definition, profileId))
    .filter(
      (definition) =>
        includeHidden ||
        isMeasurementVisible(adminConfig, normalized, definition.code, profileId)
    )
    .map((definition) => ({
      ...definition,
      label: getMeasurementProfileLabel(definition, profileId),
      shortLabel: getMeasurementProfileShortLabel(definition, profileId)
    }));
}

export function mergeMeasurementDefinitions(defaults, externalGuides = [], adminConfig = {}) {
  const deleted = new Set(adminConfig.deletedCodes || []);
  const externalByCode = new Map((externalGuides || []).map((guide) => [guide.code, guide]));

  const merged = defaults
    .filter((definition) => !deleted.has(definition.code))
    .map((definition) => {
      const external = externalByCode.get(definition.code);
      if (!external) return definition;
      return {
        ...definition,
        marker: definition.displayMarker || external.marker || definition.marker,
        displayMarker: definition.displayMarker || external.marker || definition.marker,
        label: external.label ?? definition.label,
        shortLabel: external.shortLabel ?? definition.shortLabel
      };
    });

  const known = new Set(merged.map((definition) => definition.code));
  (adminConfig.customMeasurements || []).forEach((definition) => {
    if (!deleted.has(definition.code) && !known.has(definition.code)) {
      merged.push(definition);
      known.add(definition.code);
    }
  });

  return merged;
}

function slugCode(label) {
  return String(label || 'CUSTOM')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'CUSTOM';
}

export function createCustomMeasurementDefinition({
  label,
  shortLabel,
  type = 'curve',
  viewName,
  marker = 'C',
  avatarProfileId = 'ADULT_FEMALE'
}) {
  const code = `${slugCode(label)}_${Date.now().toString(36).toUpperCase()}`;
  const y = 610;
  const isVertical = type === 'length';

  return {
    code,
    marker,
    label: String(label || 'Custom measurement').trim(),
    shortLabel: String(shortLabel || label || 'Custom').trim(),
    type,
    custom: true,
    appliesTo: [normalizeAvatarProfileId(avatarProfileId)],
    layout: {
      [normalizeView(viewName)]: {
        marker: { x: 730, y },
        guide: isVertical
          ? `M512 ${y - 90} L512 ${y + 90}`
          : `M410 ${y} C455 ${y - 8} 565 ${y - 8} 610 ${y}`,
        focus: { x: 50, y: 40, scale: 2.25 }
      }
    }
  };
}
