import { perfectFitMetadata } from '../../config/perfectFitMetadata';
import {
  AVATAR_PROFILES,
  getAvatarProfile,
  getMeasurementProfileLabel,
  getMeasurementProfileShortLabel,
  measurementAppliesToProfile,
  normalizeAvatarProfileId
} from './avatarProfiles';
import {
  DEFAULT_MEASUREMENTS,
  VIEW_MEASUREMENT_ORDER,
  isMeasurementVisible,
  normalizeView
} from './measurementAvatarMetadata';

const VIEWS = perfectFitMetadata.measurement.views;
const DEFAULT_GUIDE_TRANSFORM = perfectFitMetadata.measurement.guideDefaults.transform;
const DEFAULT_CURVE_OFFSET = perfectFitMetadata.measurement.guideDefaults.curveOffset;

function clonePoint(point, fallback = { x: 0, y: 0 }) {
  return {
    x: Number.isFinite(Number(point?.x)) ? Number(point.x) : fallback.x,
    y: Number.isFinite(Number(point?.y)) ? Number(point.y) : fallback.y
  };
}

function getPathEndpoints(path) {
  const text = String(path || '');
  const startMatch = text.match(/^\s*M\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/i);
  const endMatch = text.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/);
  return {
    start: {
      x: startMatch ? Number(startMatch[1]) : 0,
      y: startMatch ? Number(startMatch[2]) : 0
    },
    end: {
      x: endMatch ? Number(endMatch[1]) : 0,
      y: endMatch ? Number(endMatch[2]) : 0
    }
  };
}

function assetFileFor(profile, viewName) {
  const view = normalizeView(viewName);
  const viewLabel = `${view.charAt(0)}${view.slice(1).toLowerCase()}`;
  return `${profile.assetPrefix}_${viewLabel}.png`;
}

function officialViewsFor(definition) {
  const views = definition?.sourceReference?.views || definition?.officialViews;
  return Array.isArray(views) ? views.map(normalizeView) : [];
}

function isOfficialSourceDefinition(definition) {
  return Boolean(definition?.sourceReference?.system);
}

function measurementBelongsToView(definition, viewName) {
  const view = normalizeView(viewName);
  const officialViews = officialViewsFor(definition);

  if (isOfficialSourceDefinition(definition) && officialViews.length) {
    return officialViews.includes(view);
  }

  return Boolean(definition?.layout?.[view]);
}

function cloneLayout(layout) {
  if (!layout) return null;
  return {
    marker: clonePoint(layout.marker),
    guide: String(layout.guide || ''),
    focus: {
      x: Number(layout.focus?.x ?? 50),
      y: Number(layout.focus?.y ?? 50),
      scale: Number(layout.focus?.scale ?? 2)
    }
  };
}

function effectiveLayout(definition, viewName) {
  const view = normalizeView(viewName);
  if (!measurementBelongsToView(definition, view)) return null;

  const direct = cloneLayout(definition?.layout?.[view]);
  if (direct) return { ...direct, starterGenerated: false };

  const fallbackView = VIEWS.find((candidate) => definition?.layout?.[candidate]);
  const fallback = cloneLayout(definition?.layout?.[fallbackView]);
  if (!fallback) return null;

  return {
    ...fallback,
    starterGenerated: true,
    starterFromView: fallbackView
  };
}

function placementFromDefinition(definition, viewName, profileId) {
  if (!measurementAppliesToProfile(definition, profileId)) return null;

  const layout = effectiveLayout(definition, viewName);
  if (!layout) return null;

  const endpoints = getPathEndpoints(layout.guide);
  const sourceReference = definition.sourceReference || null;
  const displayMarker = definition.displayMarker || definition.marker;

  return {
    code: definition.code,
    displayMarker,
    markerNumber: displayMarker, // backwards-compatible alias
    label: getMeasurementProfileLabel(definition, profileId),
    shortLabel: getMeasurementProfileShortLabel(definition, profileId),
    type: definition.type || 'curve',
    sourceReference,
    officialViews: officialViewsFor(definition),
    starterGenerated: Boolean(layout.starterGenerated),
    starterFromView: layout.starterFromView || null,
    needsCalibration: Boolean(layout.starterGenerated),
    marker: clonePoint(layout.marker),
    guide: {
      type: definition.type || 'curve',
      path: layout.guide || '',
      start: clonePoint(endpoints.start),
      end: clonePoint(endpoints.end),
      curveOffset: { ...DEFAULT_CURVE_OFFSET },
      transform: { ...DEFAULT_GUIDE_TRANSFORM }
    },
    focus: { ...layout.focus },
    visible: true
  };
}

function sourceOrderKey(definition) {
  const raw = String(definition?.sourceReference?.number || '');
  if (!raw) return Number.POSITIVE_INFINITY;
  const match = raw.match(/^(\d+)([a-z])?$/i);
  if (!match) return Number.POSITIVE_INFINITY;
  const base = Number(match[1]);
  const suffix = match[2] ? match[2].toLowerCase().charCodeAt(0) - 96 : 0;
  return base + suffix / 10;
}

function orderDefinitionsForView(definitions, viewName) {
  const view = normalizeView(viewName);
  const preferred = VIEW_MEASUREMENT_ORDER[view] || [];
  const preferredIndex = new Map(preferred.map((code, index) => [code, index]));

  return [...definitions].sort((a, b) => {
    const aSource = sourceOrderKey(a);
    const bSource = sourceOrderKey(b);
    const aHasSource = Number.isFinite(aSource);
    const bHasSource = Number.isFinite(bSource);

    if (aHasSource && bHasSource && aSource !== bSource) return aSource - bSource;
    if (aHasSource !== bHasSource) return aHasSource ? -1 : 1;

    const ai = preferredIndex.has(a.code) ? preferredIndex.get(a.code) : 10000;
    const bi = preferredIndex.has(b.code) ? preferredIndex.get(b.code) : 10000;
    if (ai !== bi) return ai - bi;
    return String(a.code).localeCompare(String(b.code));
  });
}

export const AVATAR_AREAS = perfectFitMetadata.measurement.avatarAreas;

export function getAvatarArea(profileId = 'ADULT_FEMALE') {
  const normalized = normalizeAvatarProfileId(profileId);
  return AVATAR_AREAS[normalized] || AVATAR_AREAS.ADULT_FEMALE;
}

export function getAvatarAreaView(profileId, viewName) {
  const area = getAvatarArea(profileId);
  return area.views[normalizeView(viewName)] || area.views.FRONT;
}

function isAreaDeleted(adminConfig, profileId, viewName, code) {
  const normalizedProfile = normalizeAvatarProfileId(profileId);
  const normalizedView = normalizeView(viewName);
  return Boolean(
    adminConfig?.deletedByProfileView?.[normalizedProfile]?.[normalizedView]?.includes(code)
  );
}

function placementForDefinition(definition, profileId, viewName) {
  const areaPlacement = getAvatarAreaView(profileId, viewName)?.measurements?.[definition.code];
  if (areaPlacement) return areaPlacement;

  // Administrator-created measurements are dynamic and are not part of the
  // frozen baseline until their exported JSON is migrated.
  return placementFromDefinition(
    definition,
    normalizeView(viewName),
    normalizeAvatarProfileId(profileId)
  );
}

export function getAvatarAreaMeasurementsForView(
  definitions = DEFAULT_MEASUREMENTS,
  adminConfig = {},
  profileId = 'ADULT_FEMALE',
  viewName = 'FRONT',
  { includeHidden = false } = {}
) {
  const normalizedProfile = normalizeAvatarProfileId(profileId);
  const normalizedView = normalizeView(viewName);
  const byCode = new Map((definitions || []).map((definition) => [definition.code, definition]));

  // IMPORTANT: calculate existence from the active avatar state + semantic
  // definition, never from VIEW_MEASUREMENT_ORDER.
  const eligible = orderDefinitionsForView(
    (definitions || []).filter((definition) => {
      if (!measurementAppliesToProfile(definition, normalizedProfile)) return false;
      if (definition.custom) return Boolean(definition.layout?.[normalizedView]);
      return measurementBelongsToView(definition, normalizedView) && Boolean(effectiveLayout(definition, normalizedView));
    }),
    normalizedView
  );

  return eligible
    .map((definition) => byCode.get(definition.code) || definition)
    .filter(Boolean)
    .filter((definition) => !isAreaDeleted(adminConfig, normalizedProfile, normalizedView, definition.code))
    .filter(
      (definition) =>
        includeHidden ||
        isMeasurementVisible(adminConfig, normalizedView, definition.code, normalizedProfile)
    )
    .map((definition) => ({
      ...definition,
      marker: definition.displayMarker || definition.marker,
      label: getMeasurementProfileLabel(definition, normalizedProfile),
      shortLabel: getMeasurementProfileShortLabel(definition, normalizedProfile),
      avatarPlacement: placementForDefinition(definition, normalizedProfile, normalizedView)
    }));
}

export function getAvatarState({
  profileId = 'ADULT_FEMALE',
  viewName = 'FRONT',
  definitions = DEFAULT_MEASUREMENTS,
  adminConfig = {},
  includeHidden = false
} = {}) {
  const normalizedProfile = normalizeAvatarProfileId(profileId);
  const normalizedView = normalizeView(viewName);
  const profile = getAvatarProfile(normalizedProfile);
  const baselineView = getAvatarAreaView(normalizedProfile, normalizedView);
  const measurements = getAvatarAreaMeasurementsForView(
    definitions,
    adminConfig,
    normalizedProfile,
    normalizedView,
    { includeHidden }
  );

  const viewConfig = {
    image: baselineView.image,
    assetFile: baselineView.assetFile,
    stateKey: `${normalizedProfile}:${normalizedView}`,
    markers: Object.fromEntries(
      measurements.map((definition) => [
        definition.code,
        clonePoint(definition.avatarPlacement?.marker)
      ])
    ),
    guides: Object.fromEntries(
      measurements.map((definition) => [
        definition.code,
        definition.avatarPlacement?.guide?.path || ''
      ])
    ),
    focus: Object.fromEntries(
      measurements.map((definition) => [
        definition.code,
        definition.avatarPlacement?.focus || { x: 50, y: 50, scale: 2 }
      ])
    )
  };

  return {
    stateKey: `${normalizedProfile}:${normalizedView}`,
    profileId: normalizedProfile,
    profile,
    view: normalizedView,
    image: baselineView.image,
    assetFile: baselineView.assetFile,
    measurements,
    viewConfig
  };
}

export function buildAvatarViewConfig(
  definitions = DEFAULT_MEASUREMENTS,
  profileId = 'ADULT_FEMALE',
  adminConfig = {}
) {
  const normalizedProfile = normalizeAvatarProfileId(profileId);
  return Object.fromEntries(
    VIEWS.map((viewName) => {
      const state = getAvatarState({
        profileId: normalizedProfile,
        viewName,
        definitions,
        adminConfig,
        includeHidden: true
      });
      return [viewName, state.viewConfig];
    })
  );
}

function getCalibrationProfile(calibration, profileId) {
  const normalized = normalizeAvatarProfileId(profileId);
  if (calibration?.[normalized]) return calibration[normalized];

  const profile = getAvatarProfile(normalized);
  const legacyId =
    profile.ageGroup === 'KID'
      ? `child_${profile.gender.toLowerCase()}`
      : `${profile.ageGroup.toLowerCase()}_${profile.gender.toLowerCase()}`;
  if (calibration?.[legacyId]) return calibration[legacyId];

  if (
    normalized === 'ADULT_FEMALE' &&
    (calibration?.FRONT || calibration?.SIDE || calibration?.BACK)
  ) {
    return calibration;
  }

  return {};
}

function resolvedGuide(baseGuide, viewCalibration, code) {
  const endpoints = viewCalibration?.guideEndpoints?.[code] || {};
  const transform = viewCalibration?.guideTransforms?.[code] || DEFAULT_GUIDE_TRANSFORM;
  const curveOffset = viewCalibration?.guideCurveOffsets?.[code] || DEFAULT_CURVE_OFFSET;

  return {
    ...baseGuide,
    start: clonePoint(endpoints.start, baseGuide.start),
    end: clonePoint(endpoints.end, baseGuide.end),
    curveOffset: {
      x: Number(curveOffset?.x || 0),
      y: Number(curveOffset?.y || 0)
    },
    transform: {
      dx: Number(transform?.dx || 0),
      dy: Number(transform?.dy || 0),
      sx: Number.isFinite(Number(transform?.sx)) ? Number(transform.sx) : 1,
      sy: Number.isFinite(Number(transform?.sy)) ? Number(transform.sy) : 1
    }
  };
}

export function buildResolvedAvatarAreaMetadata({
  profileId = 'ADULT_FEMALE',
  definitions = DEFAULT_MEASUREMENTS,
  adminConfig = {},
  calibration = {}
} = {}) {
  const normalizedProfile = normalizeAvatarProfileId(profileId);
  const area = getAvatarArea(normalizedProfile);
  const calibrationProfile = getCalibrationProfile(calibration, normalizedProfile);

  return {
    metadataVersion: 'avatar-area-v9.2',
    id: area.id,
    gender: area.gender,
    ageGroup: area.ageGroup,
    label: area.label,
    assetPrefix: area.assetPrefix,
    views: Object.fromEntries(
      VIEWS.map((viewName) => {
        const state = getAvatarState({
          profileId: normalizedProfile,
          viewName,
          definitions,
          adminConfig,
          includeHidden: true
        });
        const viewCalibration = calibrationProfile?.[viewName] || {};

        return [
          viewName,
          {
            stateKey: state.stateKey,
            assetFile: state.assetFile,
            measurements: Object.fromEntries(
              state.measurements.map((definition) => {
                const base = placementForDefinition(definition, normalizedProfile, viewName);
                const marker = viewCalibration?.markers?.[definition.code] || base?.marker;

                return [
                  definition.code,
                  {
                    code: definition.code,
                    displayMarker: definition.displayMarker || definition.marker,
                    markerNumber: definition.displayMarker || definition.marker,
                    label: definition.label,
                    shortLabel: definition.shortLabel,
                    type: definition.type || base?.type || 'curve',
                    sourceReference: definition.sourceReference || null,
                    officialViews: definition.officialViews || [],
                    starterGenerated: Boolean(base?.starterGenerated),
                    starterFromView: base?.starterFromView || null,
                    visible:
                      !isAreaDeleted(adminConfig, normalizedProfile, viewName, definition.code) &&
                      isMeasurementVisible(adminConfig, viewName, definition.code, normalizedProfile),
                    marker: clonePoint(marker),
                    guide: resolvedGuide(
                      base?.guide || {
                        type: definition.type || 'curve',
                        path: '',
                        start: { x: 0, y: 0 },
                        end: { x: 0, y: 0 }
                      },
                      viewCalibration,
                      definition.code
                    ),
                    focus: base?.focus || { x: 50, y: 50, scale: 2 }
                  }
                ];
              })
            )
          }
        ];
      })
    )
  };
}
