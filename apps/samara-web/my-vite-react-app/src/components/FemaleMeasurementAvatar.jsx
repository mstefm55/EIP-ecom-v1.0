import { runtimeDataStorage } from '../lib/runtimeDataGateway';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ANCHOR_COLORS,
  CALIBRATION_EDITOR_VERSION,
  CALIBRATION_STORAGE_KEY,
  DEFAULT_MEASUREMENTS,
  DEFAULT_VIEW_CONFIG,
  IMAGE_SIZE,
  STAGE_ASPECT,
  buildViewConfig,
  createCustomMeasurementDefinition,
  getMeasurementsForView,
  isMeasurementVisible,
  mergeMeasurementDefinitions,
  normalizeView,
  readMeasurementAdminConfig,
  saveMeasurementAdminConfig
} from './measurement/measurementAvatarMetadata';
import { getProfileAliases, normalizeAvatarProfileId } from './measurement/avatarProfiles';
import {
  buildAvatarViewConfig,
  buildResolvedAvatarAreaMetadata,
  getAvatarAreaMeasurementsForView,
  getAvatarState
} from './measurement/avatarAreaMetadata';

function readStoredUserRole() {
  if (typeof window === 'undefined') return '';
  try {
    const user = JSON.parse(runtimeDataStorage.getItem('perfectfit_bureau_user') || 'null');
    return String(user?.role || '').toLowerCase();
  } catch {
    return '';
  }
}

function toPercent(value, dimension) {
  return `${(value / dimension) * 100}%`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function measurementLabelAbbreviation(label) {
  const words = String(label || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return 'CM';
  if (words.length === 1) return words[0].slice(0, 2).padEnd(2, 'X');
  return `${words[0][0] || 'C'}${words[1][0] || 'M'}`;
}

function resolveCustomMeasurementMarkers(label, definitions = []) {
  const base = measurementLabelAbbreviation(label);
  const custom = (definitions || []).filter((item) => item?.custom);
  const related = custom.filter((item) => {
    const marker = String(item.displayMarker || item.marker || '');
    return marker === base || new RegExp(`^${base}\\d+$`).test(marker);
  });

  if (!related.length) {
    return { base, marker: base, promoteCode: null };
  }

  const unsuffixed = related.find(
    (item) => String(item.displayMarker || item.marker || '') === base
  );
  const suffixes = related
    .map((item) => String(item.displayMarker || item.marker || '').match(new RegExp(`^${base}(\\d+)$`)))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);

  return {
    base,
    marker: `${base}${Math.max(1, ...suffixes) + 1}`,
    promoteCode: unsuffixed?.code || null
  };
}

function readFrozenCalibration() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(runtimeDataStorage.getItem(CALIBRATION_STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function normalizeGuideTransform(value) {
  return {
    dx: Number.isFinite(value?.dx) ? value.dx : 0,
    dy: Number.isFinite(value?.dy) ? value.dy : 0,
    sx: Number.isFinite(value?.sx) ? value.sx : 1,
    sy: Number.isFinite(value?.sy) ? value.sy : 1
  };
}

function getProfileCalibration(calibration, avatarProfileId = 'ADULT_FEMALE') {
  const aliases = getProfileAliases(avatarProfileId);

  for (const alias of aliases) {
    if (calibration?.[alias]) return calibration[alias];
  }

  // Backward compatibility with V4–V6 where the adult-female profile was
  // stored directly as { FRONT, SIDE, BACK }.
  if (
    aliases.includes('ADULT_FEMALE') &&
    (calibration?.FRONT || calibration?.SIDE || calibration?.BACK)
  ) {
    return calibration;
  }

  return {};
}

function getViewCalibration(calibration, avatarProfileId, view) {
  return getProfileCalibration(calibration, avatarProfileId)?.[view] || {};
}

function withUpdatedViewCalibration(
  calibration,
  avatarProfileId,
  view,
  nextView
) {
  const currentProfile = getProfileCalibration(calibration, avatarProfileId);

  return {
    ...calibration,
    [normalizeAvatarProfileId(avatarProfileId)]: {
      ...currentProfile,
      [view]: nextView
    }
  };
}

function getBaseGuideEndpoints(path) {
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

function getGuideEndpoints(
  calibration,
  avatarProfileId,
  view,
  code,
  viewConfig = DEFAULT_VIEW_CONFIG
) {
  const base = getBaseGuideEndpoints(viewConfig[view]?.guides?.[code]);
  const override =
    getViewCalibration(calibration, avatarProfileId, view)?.guideEndpoints?.[code] || {};

  return {
    start: {
      x: Number.isFinite(override?.start?.x) ? override.start.x : base.start.x,
      y: Number.isFinite(override?.start?.y) ? override.start.y : base.start.y
    },
    end: {
      x: Number.isFinite(override?.end?.x) ? override.end.x : base.end.x,
      y: Number.isFinite(override?.end?.y) ? override.end.y : base.end.y
    }
  };
}

function updateGuideEndpoint(
  calibration,
  avatarProfileId,
  view,
  code,
  endpointName,
  point
) {
  const currentView = getViewCalibration(calibration, avatarProfileId, view);
  const currentEndpoints = currentView?.guideEndpoints?.[code] || {};

  return withUpdatedViewCalibration(calibration, avatarProfileId, view, {
    ...currentView,
    guideEndpoints: {
      ...(currentView?.guideEndpoints || {}),
      [code]: {
        ...currentEndpoints,
        [endpointName]: point
      }
    }
  });
}

function getGuideCurveOffset(calibration, avatarProfileId, view, code) {
  const value =
    getViewCalibration(calibration, avatarProfileId, view)?.guideCurveOffsets?.[code];

  return {
    x: Number.isFinite(value?.x) ? value.x : 0,
    y: Number.isFinite(value?.y) ? value.y : 0
  };
}

function updateGuideCurveOffset(
  calibration,
  avatarProfileId,
  view,
  code,
  offset
) {
  const currentView = getViewCalibration(calibration, avatarProfileId, view);

  return withUpdatedViewCalibration(calibration, avatarProfileId, view, {
    ...currentView,
    guideCurveOffsets: {
      ...(currentView?.guideCurveOffsets || {}),
      [code]: offset
    }
  });
}

function normalizeGuideShape(value, fallbackType = 'line') {
  const shape = String(value || '').toLowerCase();
  if (shape === 'curve' || shape === 'circumference' || shape === 'line') return shape;

  const fallback = String(fallbackType || '').toLowerCase();
  if (fallback === 'circumference') return 'circumference';
  if (fallback === 'curve') return 'curve';
  return 'line';
}

function getGuideShape(
  calibration,
  avatarProfileId,
  view,
  code,
  fallbackType = 'line'
) {
  const stored = getViewCalibration(calibration, avatarProfileId, view)?.guideShapes?.[code];
  return normalizeGuideShape(stored, fallbackType);
}

function updateGuideShape(
  calibration,
  avatarProfileId,
  view,
  code,
  shape
) {
  const currentView = getViewCalibration(calibration, avatarProfileId, view);
  return withUpdatedViewCalibration(calibration, avatarProfileId, view, {
    ...currentView,
    guideShapes: {
      ...(currentView?.guideShapes || {}),
      [code]: normalizeGuideShape(shape)
    }
  });
}

function getDefaultCurveOffset(endpoints) {
  const start = endpoints?.start || { x: 0, y: 0 };
  const end = endpoints?.end || { x: 0, y: 0 };
  const dx = Number(end.x || 0) - Number(start.x || 0);
  const dy = Number(end.y || 0) - Number(start.y || 0);
  const length = Math.max(1, Math.hypot(dx, dy));
  const bend = clamp(length * 0.12, 18, 55);

  // Perpendicular offset makes the first conversion visibly curved for both
  // horizontal and vertical point-to-point guides. The orange handle can then
  // be dragged to refine the exact shape.
  return {
    x: Math.round((-dy / length) * bend * 10) / 10,
    y: Math.round((dx / length) * bend * 10) / 10
  };
}

/**
 * Curve and circumference are deliberately different rendering primitives.
 *
 * CURVE:
 *   Existing open cubic/line controlled by start/middle/end.
 *
 * CIRCUMFERENCE:
 *   A CLOSED ellipse-like tape. Start/end control the horizontal span and the
 *   orange middle handle controls depth. This fixes the old "circumference is
 *   only another curve" behavior.
 */
function applyGuideShape(
  path,
  endpoints,
  curveOffset = { x: 0, y: 0 },
  guideShape = 'line'
) {
  if (!path || !endpoints) return path;

  const shape = normalizeGuideShape(guideShape);

  if (shape === 'circumference') {
    const start = endpoints.start;
    const end = endpoints.end;
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    const radiusX = Math.max(6, Math.abs(end.x - start.x) / 2);
    const defaultDepth = Math.max(7, radiusX * 0.14);
    const radiusY = Math.max(4, defaultDepth - Number(curveOffset?.y || 0));

    const leftX = centerX - radiusX;
    const rightX = centerX + radiusX;

    return [
      `M ${leftX} ${centerY}`,
      `A ${radiusX} ${radiusY} 0 1 0 ${rightX} ${centerY}`,
      `A ${radiusX} ${radiusY} 0 1 0 ${leftX} ${centerY}`,
      'Z'
    ].join(' ');
  }

  // A line shape always renders a true point-to-point segment, regardless of
  // whether the original fallback metadata happened to contain a cubic path.
  if (shape === 'line') {
    return `M${endpoints.start.x} ${endpoints.start.y} L${endpoints.end.x} ${endpoints.end.y}`;
  }

  const text = String(path).trim();
  const number = '(-?\\d+(?:\\.\\d+)?)';
  const cubicRegex = new RegExp(
    `^M\\s*${number}\\s+${number}\\s+C\\s*${number}\\s+${number}\\s+${number}\\s+${number}\\s+${number}\\s+${number}$`,
    'i'
  );

  const cubic = text.match(cubicRegex);
  if (cubic) {
    const baseStart = { x: Number(cubic[1]), y: Number(cubic[2]) };
    const control1 = { x: Number(cubic[3]), y: Number(cubic[4]) };
    const control2 = { x: Number(cubic[5]), y: Number(cubic[6]) };
    const baseEnd = { x: Number(cubic[7]), y: Number(cubic[8]) };

    const startDx = endpoints.start.x - baseStart.x;
    const startDy = endpoints.start.y - baseStart.y;
    const endDx = endpoints.end.x - baseEnd.x;
    const endDy = endpoints.end.y - baseEnd.y;

    const c1 = {
      x: control1.x + startDx + Number(curveOffset?.x || 0),
      y: control1.y + startDy + Number(curveOffset?.y || 0)
    };
    const c2 = {
      x: control2.x + endDx + Number(curveOffset?.x || 0),
      y: control2.y + endDy + Number(curveOffset?.y || 0)
    };

    return `M${endpoints.start.x} ${endpoints.start.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${endpoints.end.x} ${endpoints.end.y}`;
  }

  // Converting a historical straight point-to-point guide to Curve must not
  // require changing the semantic measurement type. We synthesize a cubic
  // path from the two endpoints and the editable orange middle offset.
  const start = endpoints.start;
  const end = endpoints.end;
  const ox = Number(curveOffset?.x || 0);
  const oy = Number(curveOffset?.y || 0);
  const c1 = {
    x: start.x + (end.x - start.x) / 3 + ox,
    y: start.y + (end.y - start.y) / 3 + oy
  };
  const c2 = {
    x: start.x + ((end.x - start.x) * 2) / 3 + ox,
    y: start.y + ((end.y - start.y) * 2) / 3 + oy
  };

  return `M${start.x} ${start.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`;
}

function transformGuidePoint(point, transform) {
  return {
    x: point.x * transform.sx + transform.dx,
    y: point.y * transform.sy + transform.dy
  };
}

function inverseTransformGuidePoint(point, transform) {
  return {
    x: (point.x - transform.dx) / transform.sx,
    y: (point.y - transform.dy) / transform.sy
  };
}

function getMarkerPosition(
  calibration,
  avatarProfileId,
  view,
  code,
  viewConfig = DEFAULT_VIEW_CONFIG
) {
  const base =
    viewConfig[view]?.markers?.[code] ||
    { x: IMAGE_SIZE.width / 2, y: IMAGE_SIZE.height / 2 };
  const override =
    getViewCalibration(calibration, avatarProfileId, view)?.markers?.[code];

  return {
    x: Number.isFinite(override?.x) ? override.x : base.x,
    y: Number.isFinite(override?.y) ? override.y : base.y
  };
}

function getGuideTransform(calibration, avatarProfileId, view, code) {
  return normalizeGuideTransform(
    getViewCalibration(calibration, avatarProfileId, view)?.guideTransforms?.[code]
  );
}

function updateMarker(calibration, avatarProfileId, view, code, point) {
  const currentView = getViewCalibration(calibration, avatarProfileId, view);

  return withUpdatedViewCalibration(calibration, avatarProfileId, view, {
    ...currentView,
    markers: {
      ...(currentView?.markers || {}),
      [code]: point
    }
  });
}

function updateGuideTransform(
  calibration,
  avatarProfileId,
  view,
  code,
  transform
) {
  const currentView = getViewCalibration(calibration, avatarProfileId, view);

  return withUpdatedViewCalibration(calibration, avatarProfileId, view, {
    ...currentView,
    guideTransforms: {
      ...(currentView?.guideTransforms || {}),
      [code]: normalizeGuideTransform(transform)
    }
  });
}

function resetViewCalibration(calibration, avatarProfileId, view) {
  const currentProfile = { ...getProfileCalibration(calibration, avatarProfileId) };
  delete currentProfile[view];

  return {
    ...calibration,
    [normalizeAvatarProfileId(avatarProfileId)]: currentProfile
  };
}

function buildResolvedCalibration(
  calibration,
  avatarProfileId,
  viewConfig = DEFAULT_VIEW_CONFIG
) {
  return {
    [normalizeAvatarProfileId(avatarProfileId)]: Object.fromEntries(
      Object.keys(viewConfig).map((view) => [
        view,
        {
          markers: Object.fromEntries(
            Object.keys(viewConfig[view]?.markers || {}).map((code) => [
              code,
              getMarkerPosition(
                calibration,
                avatarProfileId,
                view,
                code,
                viewConfig
              )
            ])
          ),
          guideTransforms: Object.fromEntries(
            Object.keys(viewConfig[view]?.guides || {}).map((code) => [
              code,
              getGuideTransform(calibration, avatarProfileId, view, code)
            ])
          ),
          guideEndpoints: Object.fromEntries(
            Object.keys(viewConfig[view]?.guides || {}).map((code) => [
              code,
              getGuideEndpoints(
                calibration,
                avatarProfileId,
                view,
                code,
                viewConfig
              )
            ])
          ),
          guideCurveOffsets: Object.fromEntries(
            Object.keys(viewConfig[view]?.guides || {}).map((code) => [
              code,
              getGuideCurveOffset(calibration, avatarProfileId, view, code)
            ])
          )
        }
      ])
    )
  };
}

function clientToSvg(svg, clientX, clientY) {
  if (!svg) return { x: 0, y: 0 };
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const result = point.matrixTransform(ctm.inverse());
  return { x: result.x, y: result.y };
}

export function MeasurementAvatarZoom({ activeCode, label, view = 'FRONT', avatarProfileId = 'ADULT_FEMALE' }) {
  const resolvedView = normalizeView(view);
  const adminConfig = readMeasurementAdminConfig();
  const measurements = mergeMeasurementDefinitions(DEFAULT_MEASUREMENTS, [], adminConfig);
  const viewConfig = buildAvatarViewConfig(measurements, avatarProfileId, adminConfig);
  const config = viewConfig[resolvedView];
  const frozenCalibration = readFrozenCalibration();
  const focus = config.focus[activeCode] || config.focus.WAIST;
  const guideTransform = getGuideTransform(frozenCalibration, avatarProfileId, resolvedView, activeCode);
  const guideEndpoints = getGuideEndpoints(frozenCalibration, avatarProfileId, resolvedView, activeCode, viewConfig);
  const guideCurveOffset = getGuideCurveOffset(frozenCalibration, avatarProfileId, resolvedView, activeCode);
  const zoomGuide = measurements.find((item) => item.code === activeCode);
  const guidePath = applyGuideShape(config.guides[activeCode], guideEndpoints, guideCurveOffset, zoomGuide?.type);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[16px] border border-[#E2D7CB] bg-[#F8F4EF]">
      <img
        src={config.image}
        alt={label || ''}
        className="absolute inset-0 h-full w-full select-none object-contain transition-transform duration-300 ease-out"
        style={{
          transform: `scale(${focus.scale})`,
          transformOrigin: `${focus.x}% ${focus.y}%`
        }}
        draggable={false}
      />
      {config.guides[activeCode] && (
        <svg
          viewBox={`0 0 ${IMAGE_SIZE.width} ${IMAGE_SIZE.height}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `scale(${focus.scale})`,
            transformOrigin: `${focus.x}% ${focus.y}%`
          }}
        >
          <path
            d={guidePath}
            transform={`matrix(${guideTransform.sx} 0 0 ${guideTransform.sy} ${guideTransform.dx} ${guideTransform.dy})`}
            fill="none"
            stroke="#A65F3F"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={activeCode === 'HEIGHT' ? undefined : '18 12'}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  );
}

export default function FemaleMeasurementAvatar({
  activeCode,
  onSelect,
  guides,
  t,
  view = 'FRONT',
  onViewChange,
  frontViewLabel = 'Front',
  sideViewLabel = 'Side',
  backViewLabel = 'Back',
  avatarProfileId = 'ADULT_FEMALE',
  currentUser = null,
  isAdministrator,
  measurementConfig = null,
  onMeasurementConfigChange,
  calibration = null,
  onCalibrationChange,
  onViewMeasurementsChange
}) {
  const resolvedView = normalizeView(view);
  const [localMeasurementConfig, setLocalMeasurementConfig] = useState(() => readMeasurementAdminConfig());
  const adminMeasurementConfig = measurementConfig || localMeasurementConfig;
  const measurementDefinitions = useMemo(
    () => mergeMeasurementDefinitions(DEFAULT_MEASUREMENTS, guides, adminMeasurementConfig),
    [guides, adminMeasurementConfig]
  );
  const runtimeViewConfig = useMemo(
    () => buildAvatarViewConfig(measurementDefinitions, avatarProfileId, adminMeasurementConfig),
    [measurementDefinitions, avatarProfileId, adminMeasurementConfig]
  );
  const avatarState = useMemo(
    () => getAvatarState({
      profileId: avatarProfileId,
      viewName: resolvedView,
      definitions: measurementDefinitions,
      adminConfig: adminMeasurementConfig,
      includeHidden: false
    }),
    [measurementDefinitions, adminMeasurementConfig, avatarProfileId, resolvedView]
  );
  // Image, measurement list and placement metadata now come from the same
  // profile+view state object. Switching avatar state switches all three.
  const config = avatarState.viewConfig;
  const viewMeasurements = avatarState.measurements;
  const visibleCodes = useMemo(
    () => viewMeasurements.map((definition) => definition.code),
    [viewMeasurements]
  );
  const [internalActiveCode, setInternalActiveCode] = useState(activeCode || '');
  const selectedCode =
    (
      internalActiveCode &&
      visibleCodes.includes(internalActiveCode) &&
      config?.guides?.[internalActiveCode]
        ? internalActiveCode
        : ''
    ) ||
    (
      activeCode &&
      visibleCodes.includes(activeCode) &&
      config?.guides?.[activeCode]
        ? activeCode
        : ''
    ) ||
    visibleCodes[0] ||
    '';
  const guideMap = useMemo(
    () => new Map(measurementDefinitions.map((guide) => [guide.code, guide])),
    [measurementDefinitions]
  );
  const activeGuide = guideMap.get(selectedCode);
  const stageRef = useRef(null);
  const svgRef = useRef(null);
  const pathRef = useRef(null);
  const dragRef = useRef(null);

  const [localFrozenCalibration, setLocalFrozenCalibration] = useState(() => readFrozenCalibration());
  const frozenCalibration = calibration || localFrozenCalibration;
  const [workingCalibration, setWorkingCalibration] = useState(() => calibration || readFrozenCalibration());
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [guideBBox, setGuideBBox] = useState(null);
  const [guideMidPoint, setGuideMidPoint] = useState(null);
  const [showCalibrationJson, setShowCalibrationJson] = useState(false);
  const [showMeasurementManager, setShowMeasurementManager] = useState(false);
  const [showGuideStyleEditor, setShowGuideStyleEditor] = useState(true);
  const [showAddMeasurement, setShowAddMeasurement] = useState(false);
  const [newMeasurementLabel, setNewMeasurementLabel] = useState('');
  const [newMeasurementType, setNewMeasurementType] = useState('curve');

  const storedRole = readStoredUserRole();
  const canAdminEdit =
    typeof isAdministrator === 'boolean'
      ? isAdministrator
      : String(currentUser?.role || storedRole).toLowerCase() === 'administrator';

  useEffect(() => {
    if (activeCode) setInternalActiveCode(activeCode);
  }, [activeCode]);

  useEffect(() => {
    if (measurementConfig) setLocalMeasurementConfig(measurementConfig);
  }, [measurementConfig]);

  useEffect(() => {
    if (calibration) {
      setLocalFrozenCalibration(calibration);
      if (!calibrationMode) setWorkingCalibration(calibration);
    }
  }, [calibration]);

  useEffect(() => {
    onViewMeasurementsChange?.(viewMeasurements, resolvedView);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('perfectfit:measurement-view-changed', {
        detail: {
          profileId: normalizeAvatarProfileId(avatarProfileId),
          view: resolvedView,
          stateKey: avatarState.stateKey,
          assetFile: avatarState.assetFile,
          measurements: viewMeasurements
        }
      }));
    }
  }, [avatarProfileId, resolvedView, avatarState.stateKey, avatarState.assetFile, viewMeasurements, onViewMeasurementsChange]);

  useEffect(() => {
    if (!visibleCodes.length) {
      setInternalActiveCode('');
      return;
    }
    if (!visibleCodes.includes(internalActiveCode)) {
      setInternalActiveCode(visibleCodes[0]);
    }
  }, [avatarProfileId, resolvedView, visibleCodes.join('|')]);

  function selectMeasurement(code) {
    setInternalActiveCode(code);
    onSelect?.(code);
  }

  function persistAdminMeasurementConfig(updater) {
    if (!canAdminEdit) return;
    setLocalMeasurementConfig((currentLocal) => {
      const current = measurementConfig || currentLocal;
      const next = typeof updater === 'function' ? updater(current) : updater;
      saveMeasurementAdminConfig(next);
      onMeasurementConfigChange?.(next);
      return next;
    });
  }

  function toggleMeasurementVisibility(code) {
    persistAdminMeasurementConfig((current) => {
      const currentProfileHidden =
        current.hiddenByProfileView?.[normalizeAvatarProfileId(avatarProfileId)] || current.hiddenByProfileView?.[avatarProfileId] || {};
      const hidden = new Set(currentProfileHidden?.[resolvedView] || []);

      if (hidden.has(code)) hidden.delete(code);
      else hidden.add(code);

      return {
        ...current,
        hiddenByProfileView: {
          ...(current.hiddenByProfileView || {}),
          [normalizeAvatarProfileId(avatarProfileId)]: {
            ...currentProfileHidden,
            [resolvedView]: Array.from(hidden)
          }
        }
      };
    });
  }

  function deleteMeasurementDefinition(code) {
    persistAdminMeasurementConfig((current) => {
      const profileId = normalizeAvatarProfileId(avatarProfileId);
      const currentProfileDeleted = current.deletedByProfileView?.[profileId] || {};
      const deleted = new Set(currentProfileDeleted?.[resolvedView] || []);
      deleted.add(code);

      return {
        ...current,
        deletedByProfileView: {
          ...(current.deletedByProfileView || {}),
          [profileId]: {
            ...currentProfileDeleted,
            [resolvedView]: Array.from(deleted)
          }
        },
        customMeasurements: (current.customMeasurements || []).filter(
          (item) => item.code !== code
        )
      };
    });
  }

  function addCustomMeasurement() {
    if (!newMeasurementLabel.trim()) return;
    const markerPlan = resolveCustomMeasurementMarkers(
      newMeasurementLabel,
      measurementDefinitions
    );
    const definition = createCustomMeasurementDefinition({
      label: newMeasurementLabel,
      shortLabel: newMeasurementLabel,
      type: newMeasurementType,
      viewName: resolvedView,
      marker: markerPlan.marker,
      avatarProfileId
    });
    persistAdminMeasurementConfig((current) => ({
      ...current,
      customMeasurements: [
        ...(current.customMeasurements || []).map((item) =>
          item.code === markerPlan.promoteCode
            ? { ...item, marker: `${markerPlan.base}1`, displayMarker: `${markerPlan.base}1` }
            : item
        ),
        definition
      ]
    }));
    setInternalActiveCode(definition.code);
    setNewMeasurementLabel('');
    setShowAddMeasurement(false);
  }

  // Temporary calibration editor. Once coordinates are approved, migrate them into metadata.
  const calibrationAvailable = canAdminEdit;
  const activeCalibration = calibrationMode ? workingCalibration : frozenCalibration;
  const guideTransform = getGuideTransform(activeCalibration, avatarProfileId, resolvedView, selectedCode);
  const guideEndpoints = getGuideEndpoints(activeCalibration, avatarProfileId, resolvedView, selectedCode, runtimeViewConfig);
  const guideCurveOffset = getGuideCurveOffset(activeCalibration, avatarProfileId, resolvedView, selectedCode);
  const baseGuideShape = activeGuide?.avatarPlacement?.guide?.type || activeGuide?.type || 'line';
  const activeGuideShape = getGuideShape(
    activeCalibration,
    avatarProfileId,
    resolvedView,
    selectedCode,
    baseGuideShape
  );
  const guidePath = applyGuideShape(
    config.guides[selectedCode],
    guideEndpoints,
    guideCurveOffset,
    activeGuideShape
  );
  const transformedGuideStart = transformGuidePoint(guideEndpoints.start, guideTransform);
  const transformedGuideEnd = transformGuidePoint(guideEndpoints.end, guideTransform);
  const transformedGuideMid = guideMidPoint ? transformGuidePoint(guideMidPoint, guideTransform) : null;

  useEffect(() => {
    if (!pathRef.current) {
      setGuideBBox(null);
      setGuideMidPoint(null);
      return;
    }

    try {
      const path = pathRef.current;
      const box = path.getBBox();
      setGuideBBox({ x: box.x, y: box.y, width: box.width, height: box.height });

      if (activeGuideShape === 'circumference') {
        const centerX = (guideEndpoints.start.x + guideEndpoints.end.x) / 2;
        const centerY = (guideEndpoints.start.y + guideEndpoints.end.y) / 2;
        const radiusX = Math.max(
          6,
          Math.abs(guideEndpoints.end.x - guideEndpoints.start.x) / 2
        );
        const defaultDepth = Math.max(7, radiusX * 0.14);
        const radiusY = Math.max(
          4,
          defaultDepth - Number(guideCurveOffset?.y || 0)
        );

        // Orange handle edits the visible depth of the closed circumference.
        setGuideMidPoint({
          x: centerX,
          y: centerY - radiusY
        });
      } else {
        const length = path.getTotalLength();
        const middle = path.getPointAtLength(length / 2);
        setGuideMidPoint({ x: middle.x, y: middle.y });
      }
    } catch {
      setGuideBBox(null);
      setGuideMidPoint(null);
    }
  }, [
    selectedCode,
    resolvedView,
    avatarProfileId,
    activeGuideShape,
    guidePath,
    guideEndpoints.start.x,
    guideEndpoints.start.y,
    guideEndpoints.end.x,
    guideEndpoints.end.y,
    guideCurveOffset.y,
    guideTransform.dx,
    guideTransform.dy,
    guideTransform.sx,
    guideTransform.sy
  ]);

  useEffect(() => {
    function handlePointerMove(event) {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.type === 'marker') {
        const rect = stageRef.current?.getBoundingClientRect();
        if (!rect || !rect.width || !rect.height) return;
        const x = clamp(((event.clientX - rect.left) / rect.width) * IMAGE_SIZE.width, 0, IMAGE_SIZE.width);
        const y = clamp(((event.clientY - rect.top) / rect.height) * IMAGE_SIZE.height, 0, IMAGE_SIZE.height);
        setWorkingCalibration((current) =>
          updateMarker(current, drag.profileId, drag.view, drag.code, { x: Math.round(x), y: Math.round(y) })
        );
        return;
      }

      if (drag.type === 'guide-endpoint') {
        const currentPoint = clientToSvg(svgRef.current, event.clientX, event.clientY);
        const localPoint = inverseTransformGuidePoint(currentPoint, drag.transform);
        setWorkingCalibration((current) =>
          updateGuideEndpoint(current, drag.profileId, drag.view, drag.code, drag.endpointName, {
            x: Math.round(clamp(localPoint.x, 0, IMAGE_SIZE.width) * 10) / 10,
            y: Math.round(clamp(localPoint.y, 0, IMAGE_SIZE.height) * 10) / 10
          })
        );
        return;
      }

      if (drag.type === 'guide-curve') {
        const currentPoint = clientToSvg(svgRef.current, event.clientX, event.clientY);
        const localPoint = inverseTransformGuidePoint(currentPoint, drag.transform);
        const dx = localPoint.x - drag.startPoint.x;
        const dy = localPoint.y - drag.startPoint.y;

        setWorkingCalibration((current) =>
          updateGuideCurveOffset(current, drag.profileId, drag.view, drag.code, {
            x:
              drag.guideType === 'circumference'
                ? 0
                : Math.round((drag.startOffset.x + dx) * 10) / 10,
            y: Math.round((drag.startOffset.y + dy) * 10) / 10
          })
        );
        return;
      }

      if (drag.type === 'guide-move' || drag.type === 'guide-resize') {
        const currentPoint = clientToSvg(svgRef.current, event.clientX, event.clientY);
        const dx = currentPoint.x - drag.startPoint.x;
        const dy = currentPoint.y - drag.startPoint.y;

        if (drag.type === 'guide-move') {
          setWorkingCalibration((current) =>
            updateGuideTransform(current, drag.profileId, drag.view, drag.code, {
              ...drag.startTransform,
              dx: Math.round((drag.startTransform.dx + dx) * 10) / 10,
              dy: Math.round((drag.startTransform.dy + dy) * 10) / 10
            })
          );
          return;
        }

        const width = Math.max(1, drag.bbox.width);
        const height = Math.max(1, drag.bbox.height);
        setWorkingCalibration((current) =>
          updateGuideTransform(current, drag.profileId, drag.view, drag.code, {
            ...drag.startTransform,
            sx: Math.round(clamp(drag.startTransform.sx + dx / width, 0.2, 4) * 1000) / 1000,
            sy: Math.round(clamp(drag.startTransform.sy + dy / height, 0.2, 4) * 1000) / 1000
          })
        );
      }
    }

    function handlePointerUp() {
      dragRef.current = null;
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  function startMarkerDrag(event, code) {
    if (!calibrationMode) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { type: 'marker', profileId: avatarProfileId, view: resolvedView, code };
  }

  function startGuideMove(event) {
    if (!calibrationMode || !selectedCode) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      type: 'guide-move',
      profileId: avatarProfileId,
      view: resolvedView,
      code: selectedCode,
      startPoint: clientToSvg(svgRef.current, event.clientX, event.clientY),
      startTransform: getGuideTransform(workingCalibration, avatarProfileId, resolvedView, selectedCode)
    };
  }

  function startGuideResize(event) {
    if (!calibrationMode || !selectedCode || !guideBBox) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      type: 'guide-resize',
      profileId: avatarProfileId,
      view: resolvedView,
      code: selectedCode,
      startPoint: clientToSvg(svgRef.current, event.clientX, event.clientY),
      startTransform: getGuideTransform(workingCalibration, avatarProfileId, resolvedView, selectedCode),
      bbox: guideBBox
    };
  }

  function captureHandlePointer(event) {
    try {
      event.currentTarget?.setPointerCapture?.(event.pointerId);
    } catch {
      // Capturing is a convenience only; window listeners remain as a fallback.
    }
  }

  function startGuideEndpointDrag(event, endpointName) {
    if (!calibrationMode || !selectedCode) return;
    event.preventDefault();
    event.stopPropagation();
    captureHandlePointer(event);

    dragRef.current = {
      type: 'guide-endpoint',
      profileId: avatarProfileId,
      view: resolvedView,
      code: selectedCode,
      endpointName,
      pointerId: event.pointerId,
      transform: getGuideTransform(workingCalibration, avatarProfileId, resolvedView, selectedCode)
    };
  }

  function startGuideCurveDrag(event) {
    if (!calibrationMode || !selectedCode || !guideMidPoint || selectedCode === 'HEIGHT') return;
    event.preventDefault();
    event.stopPropagation();
    captureHandlePointer(event);

    const transform = getGuideTransform(workingCalibration, avatarProfileId, resolvedView, selectedCode);
    const currentPoint = clientToSvg(svgRef.current, event.clientX, event.clientY);
    const localPoint = inverseTransformGuidePoint(currentPoint, transform);

    dragRef.current = {
      type: 'guide-curve',
      profileId: avatarProfileId,
      view: resolvedView,
      code: selectedCode,
      pointerId: event.pointerId,
      transform,
      guideType: activeGuideShape,
      startPoint: localPoint,
      startOffset: getGuideCurveOffset(workingCalibration, avatarProfileId, resolvedView, selectedCode)
    };
  }

  // Direct pointer handlers for start / middle / end precision dots.
  // These run on the captured HTML button itself, so dragging does not depend
  // on pointer events reaching the SVG or the window listener.
  function moveCalibrationHandle(event) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.pointerId != null && drag.pointerId !== event.pointerId) return;
    if (drag.type !== 'guide-endpoint' && drag.type !== 'guide-curve') return;

    event.preventDefault();
    event.stopPropagation();

    const currentPoint = clientToSvg(svgRef.current, event.clientX, event.clientY);
    const localPoint = inverseTransformGuidePoint(currentPoint, drag.transform);

    if (drag.type === 'guide-endpoint') {
      setWorkingCalibration((current) =>
        updateGuideEndpoint(current, drag.profileId, drag.view, drag.code, drag.endpointName, {
          x: Math.round(clamp(localPoint.x, 0, IMAGE_SIZE.width) * 10) / 10,
          y: Math.round(clamp(localPoint.y, 0, IMAGE_SIZE.height) * 10) / 10
        })
      );
      return;
    }

    const dx = localPoint.x - drag.startPoint.x;
    const dy = localPoint.y - drag.startPoint.y;
    setWorkingCalibration((current) =>
      updateGuideCurveOffset(current, drag.profileId, drag.view, drag.code, {
        x:
          drag.guideType === 'circumference'
            ? 0
            : Math.round((drag.startOffset.x + dx) * 10) / 10,
        y: Math.round((drag.startOffset.y + dy) * 10) / 10
      })
    );
  }

  function endCalibrationHandle(event) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.pointerId != null && drag.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    try {
      if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Safe fallback.
    }
    dragRef.current = null;
  }

  function changeSelectedGuideShape(nextShape) {
    if (!calibrationMode || !selectedCode) return;
    const normalizedShape = normalizeGuideShape(nextShape);

    setWorkingCalibration((current) => {
      let next = updateGuideShape(
        current,
        avatarProfileId,
        resolvedView,
        selectedCode,
        normalizedShape
      );

      // When a straight guide is converted to curve for the first time, seed
      // a small perpendicular bend so the change is immediately visible.
      if (normalizedShape === 'curve') {
        const currentOffset = getGuideCurveOffset(
          current,
          avatarProfileId,
          resolvedView,
          selectedCode
        );
        const hasBend =
          Math.abs(Number(currentOffset?.x || 0)) > 0.01 ||
          Math.abs(Number(currentOffset?.y || 0)) > 0.01;
        if (!hasBend) {
          next = updateGuideCurveOffset(
            next,
            avatarProfileId,
            resolvedView,
            selectedCode,
            getDefaultCurveOffset(guideEndpoints)
          );
        }
      }

      return next;
    });
  }

  function enterCalibration() {
    setWorkingCalibration(frozenCalibration);
    setCalibrationMode(true);
    setShowCalibrationJson(false);
    // Open the compact line-style editor when calibration starts. It can be
    // closed at any time and reopened from the calibration toolbar.
    setShowGuideStyleEditor(true);
    setShowMeasurementManager(false);
  }

  function freezeCalibration() {
    const snapshot = buildResolvedAvatarAreaMetadata({ profileId: avatarProfileId, definitions: measurementDefinitions, adminConfig: adminMeasurementConfig, calibration: workingCalibration });
    try {
      runtimeDataStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(workingCalibration));
    } catch {
      // The stage still works for the current session if storage is blocked.
    }
    setLocalFrozenCalibration(workingCalibration);
    onCalibrationChange?.(workingCalibration);
    setCalibrationMode(false);
    setShowGuideStyleEditor(false);
    setShowCalibrationJson(true);
    console.info('[Perfect Fit] Frozen avatar calibration', snapshot);
  }

  function cancelCalibration() {
    setWorkingCalibration(frozenCalibration);
    setCalibrationMode(false);
    setShowGuideStyleEditor(false);
    setShowCalibrationJson(false);
  }

  function resetCurrentView() {
    setWorkingCalibration((current) => resetViewCalibration(current, avatarProfileId, resolvedView));
  }

  const resolvedJson = JSON.stringify(
    buildResolvedAvatarAreaMetadata({
      profileId: avatarProfileId,
      definitions: measurementDefinitions,
      adminConfig: adminMeasurementConfig,
      calibration: calibrationMode ? workingCalibration : frozenCalibration
    }),
    null,
    2
  );

  const resolvedFrontViewLabel = String(frontViewLabel || '').trim() || 'Front';
  const resolvedSideViewLabel = String(sideViewLabel || '').trim() || 'Side';
  const resolvedBackViewLabel = String(backViewLabel || '').trim() || 'Back';

  const changeView = (nextView) => {
    const normalized = normalizeView(nextView);
    const nextState = getAvatarState({
      profileId: avatarProfileId,
      viewName: normalized,
      definitions: measurementDefinitions,
      adminConfig: adminMeasurementConfig,
      includeHidden: false
    });
    onViewChange?.(normalized, nextState.measurements, nextState);
  };

  const transformedBox = guideBBox
    ? {
        x: guideBBox.x * guideTransform.sx + guideTransform.dx,
        y: guideBBox.y * guideTransform.sy + guideTransform.dy,
        width: guideBBox.width * guideTransform.sx,
        height: guideBBox.height * guideTransform.sy
      }
    : null;

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[#E1D5C8] bg-[radial-gradient(circle_at_50%_32%,#FFFFFF_0%,#FCF9F5_60%,#F3ECE3_100%)] shadow-[0_16px_40px_rgba(64,48,34,0.05)]">
      <div className="absolute right-4 top-4 z-20 inline-grid grid-cols-3 overflow-hidden rounded-full border border-[#D9CABB] bg-white/95 p-1 shadow-sm backdrop-blur-sm">
        {[
          ['FRONT', resolvedFrontViewLabel],
          ['SIDE', resolvedSideViewLabel],
          ['BACK', resolvedBackViewLabel]
        ].map(([viewCode, label]) => (
          <button
            key={viewCode}
            type="button"
            onClick={() => changeView(viewCode)}
            className={`min-w-[62px] rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] transition ${
              resolvedView === viewCode
                ? 'bg-[#2E241C] text-white'
                : 'text-[#705F51] hover:bg-[#F3EEE8]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {calibrationAvailable && (
        <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-1.5">
          {!calibrationMode ? (
            <>
              <button
                type="button"
                onClick={enterCalibration}
                className="rounded-full border border-[#CDBBA8] bg-white/95 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#705F51] shadow-sm"
              >{pfUiT("ui.components.femalemeasurementavatar.689dfb730a")}</button>
              <button
                type="button"
                onClick={() => setShowMeasurementManager((value) => !value)}
                className="rounded-full border border-[#CDBBA8] bg-white/95 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#705F51] shadow-sm"
              >{pfUiT("ui.components.femalemeasurementavatar.85bbe74032")}</button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={freezeCalibration}
                className="rounded-full bg-[#2E241C] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-white shadow-sm"
              >{pfUiT("ui.components.femalemeasurementavatar.8b4c381362")}</button>
              <button
                type="button"
                onClick={cancelCalibration}
                className="rounded-full border border-[#CDBBA8] bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#705F51] shadow-sm"
              >{pfUiT("ui.components.femalemeasurementavatar.6e138040a8")}</button>
              <button
                type="button"
                onClick={resetCurrentView}
                className="rounded-full border border-[#CDBBA8] bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#705F51] shadow-sm"
              >{pfUiT("ui.components.femalemeasurementavatar.84e7fb6980")}</button>
              <button
                type="button"
                onClick={() => setShowGuideStyleEditor((value) => !value)}
                className={`rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] shadow-sm ${
                  showGuideStyleEditor
                    ? 'border-[#2E241C] bg-[#2E241C] text-white'
                    : 'border-[#CDBBA8] bg-white text-[#705F51]'
                }`}
                title={showGuideStyleEditor ? 'Close guide line style editor' : 'Open guide line style editor'}
              >{pfUiT("ui.components.femalemeasurementavatar.250d5a0392")}</button>
              <button
                type="button"
                onClick={() => setShowCalibrationJson((value) => !value)}
                className="rounded-full border border-[#CDBBA8] bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#705F51] shadow-sm"
              >{pfUiT("ui.components.femalemeasurementavatar.27d9efc092")}</button>
            </>
          )}
        </div>
      )}

      {calibrationAvailable && calibrationMode && selectedCode && showGuideStyleEditor && (
        <div className="absolute left-4 top-[58px] z-30 w-[230px] max-w-[calc(100%-2rem)] rounded-[12px] border border-[#D9CABB] bg-white/98 p-2 shadow-[0_12px_28px_rgba(46,36,28,0.15)] backdrop-blur-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#705F51]">{pfUiT("ui.components.femalemeasurementavatar.78ae41b3a7")}</p>
              <p className="mt-0.5 truncate text-[8px] font-semibold text-[#3E332C]">
                {activeGuide?.displayMarker || activeGuide?.marker || selectedCode} · {activeGuide?.shortLabel || activeGuide?.label || selectedCode}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="rounded-full bg-[#F4EEE8] px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-[#7B6A5B]">
                {resolvedView}
              </span>
              <button
                type="button"
                onClick={() => setShowGuideStyleEditor(false)}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-[#DED3C8] bg-white text-[13px] font-semibold leading-none text-[#705F51] hover:bg-[#F3EEE8]"
                aria-label={pfUiT("ui.components.femalemeasurementavatar.823a874653")}
                title={pfUiT("ui.components.femalemeasurementavatar.8b8d109bdc")}
              >
                ×
              </button>
            </div>
          </div>

          <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-[9px] bg-[#F7F2EC] p-1">
            {[
              ['line', 'Straight'],
              ['curve', 'Curve'],
              ['circumference', 'Loop']
            ].map(([shape, label]) => (
              <button
                key={shape}
                type="button"
                onClick={() => changeSelectedGuideShape(shape)}
                className={`rounded-[7px] px-1 py-1.5 text-[7px] font-black uppercase tracking-[0.04em] transition ${
                  activeGuideShape === shape
                    ? 'bg-[#2E241C] text-white shadow-sm'
                    : 'bg-white text-[#705F51] hover:bg-[#EFE6DE]'
                }`}
                title={`Render this measurement as ${label.toLowerCase()} for the active avatar and view`}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="mt-1.5 text-[7px] leading-snug text-[#8A7868]">
            Green = start · orange = bend/depth · red = end.
          </p>
        </div>
      )}

      {canAdminEdit && showMeasurementManager && (
        <div className="absolute left-4 top-16 z-30 w-[300px] max-w-[calc(100%-2rem)] rounded-[14px] border border-[#D9CABB] bg-white/98 p-3 shadow-[0_16px_38px_rgba(46,36,28,0.18)] backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#705F51]">{pfUiT("ui.components.femalemeasurementavatar.b239c2950d")}</p>
              <p className="mt-0.5 text-[8px] text-[#9A8777]">{avatarProfileId.replaceAll('_', ' ')} · {resolvedView} area · admin only</p>
            </div>
            <button
              type="button"
              onClick={() => setShowMeasurementManager(false)}
              className="rounded-full border border-[#DED3C8] px-2 py-1 text-[8px] font-bold text-[#705F51]"
            >{pfUiT("ui.components.femalemeasurementavatar.4c2ee978f1")}</button>
          </div>

          <div className="mt-3 max-h-[290px] space-y-1 overflow-y-auto pr-1">
            {getAvatarAreaMeasurementsForView(measurementDefinitions, adminMeasurementConfig, avatarProfileId, resolvedView, { includeHidden: true }).map((definition) => {
                const visible = isMeasurementVisible(adminMeasurementConfig, resolvedView, definition.code, avatarProfileId);
                const active = definition.code === selectedCode;
                return (
                  <div
                    key={definition.code}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${active ? 'border-[#B97957] bg-[#FFF7F1]' : 'border-[#EEE5DC] bg-white'}`}
                  >
                    <button
                      type="button"
                      onClick={() => selectMeasurement(definition.code)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="mr-1.5 font-mono text-[8px] font-black text-[#9B6043]">{definition.marker}</span>
                      <span className="text-[9px] font-bold text-[#42372F]">{definition.shortLabel || definition.label}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMeasurementVisibility(definition.code)}
                      className={`rounded-full px-2 py-1 text-[7px] font-black uppercase ${visible ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F1EDEA] text-[#8A7D72]'}`}
                    >
                      {visible ? 'Shown' : 'Hidden'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMeasurementDefinition(definition.code)}
                      className="rounded-full bg-rose-50 px-2 py-1 text-[7px] font-black uppercase text-rose-700"
                    >{pfUiT("ui.components.femalemeasurementavatar.0cfa764e97")}</button>
                  </div>
                );
              })}
          </div>

          {!showAddMeasurement ? (
            <button
              type="button"
              onClick={() => setShowAddMeasurement(true)}
              className="mt-3 w-full rounded-lg bg-[#2E241C] px-3 py-2 text-[8px] font-black uppercase tracking-[0.1em] text-white"
            >{pfUiT("ui.components.femalemeasurementavatar.00e9857f3b")}</button>
          ) : (
            <div className="mt-3 space-y-2 rounded-lg border border-[#E8DED4] bg-[#FCF9F5] p-2.5">
              <input
                value={newMeasurementLabel}
                onChange={(event) => setNewMeasurementLabel(event.target.value)}
                placeholder={pfUiT("ui.components.femalemeasurementavatar.a853e06491")}
                className="w-full rounded-lg border border-[#D9CABB] bg-white px-2.5 py-2 text-[9px] outline-none focus:border-[#B97957]"
                autoFocus
              />
              <select
                value={newMeasurementType}
                onChange={(event) => setNewMeasurementType(event.target.value)}
                className="w-full rounded-lg border border-[#D9CABB] bg-white px-2.5 py-2 text-[9px] outline-none"
              >
                <option value="curve">{pfUiT("ui.components.femalemeasurementavatar.caff1ff7f8")}</option>
                <option value="circumference">{pfUiT("ui.components.femalemeasurementavatar.fc53cfa7b5")}</option>
                <option value="width">{pfUiT("ui.components.femalemeasurementavatar.e971be2b5d")}</option>
                <option value="length">{pfUiT("ui.components.femalemeasurementavatar.e9c61975cf")}</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addCustomMeasurement}
                  className="flex-1 rounded-lg bg-[#2E241C] px-2 py-2 text-[8px] font-black uppercase text-white"
                >{pfUiT("ui.components.femalemeasurementavatar.b86befc8da")}</button>
                <button
                  type="button"
                  onClick={() => setShowAddMeasurement(false)}
                  className="rounded-lg border border-[#D9CABB] bg-white px-3 py-2 text-[8px] font-black uppercase text-[#705F51]"
                >{pfUiT("ui.components.femalemeasurementavatar.6e138040a8")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex w-full justify-center px-3 pb-3 pt-14 sm:px-5 sm:pb-5 sm:pt-16">
        <div
          ref={stageRef}
          className="relative w-full max-w-[520px] shrink-0 overflow-hidden select-none"
          style={{ aspectRatio: STAGE_ASPECT, touchAction: calibrationMode ? 'none' : 'auto' }}
        >
          <img
            src={config.image}
            alt={t?.('fit.guide.avatar.aria') || ''}
            className="absolute inset-0 h-full w-full select-none object-contain object-center"
            draggable={false}
          />

          <svg
            ref={svgRef}
            viewBox={`0 0 ${IMAGE_SIZE.width} ${IMAGE_SIZE.height}`}
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
            preserveAspectRatio="xMidYMid meet"
          >
            {config.guides[selectedCode] && (
              <>
                <path
                  ref={pathRef}
                  d={guidePath}
                  transform={`matrix(${guideTransform.sx} 0 0 ${guideTransform.sy} ${guideTransform.dx} ${guideTransform.dy})`}
                  fill="none"
                  stroke="#A65F3F"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={selectedCode === 'HEIGHT' ? undefined : '18 12'}
                  vectorEffect="non-scaling-stroke"
                  className="pointer-events-none"
                />

                {calibrationMode && transformedBox && (
                  <>
                    <rect
                      x={transformedBox.x - 12}
                      y={transformedBox.y - 12}
                      width={Math.max(24, transformedBox.width + 24)}
                      height={Math.max(24, transformedBox.height + 24)}
                      fill="rgba(255,255,255,0.01)"
                      stroke="#2E241C"
                      strokeWidth="3"
                      strokeDasharray="10 8"
                      vectorEffect="non-scaling-stroke"
                      className="cursor-move"
                      onPointerDown={startGuideMove}
                    />
                    <rect
                      x={transformedBox.x + transformedBox.width - 10}
                      y={transformedBox.y + transformedBox.height - 10}
                      width="20"
                      height="20"
                      rx="4"
                      fill="#2E241C"
                      stroke="#FFFFFF"
                      strokeWidth="3"
                      vectorEffect="non-scaling-stroke"
                      className="cursor-nwse-resize"
                      onPointerDown={startGuideResize}
                    />
                  </>
                )}

              </>
            )}
          </svg>

          <div className="absolute inset-0">
            {selectedCode && visibleCodes.includes(selectedCode) && (() => {
              const guide = guideMap.get(selectedCode);
              if (!guide) return null;
              const point = getMarkerPosition(activeCalibration, avatarProfileId, resolvedView, selectedCode, runtimeViewConfig);
              return (
                <button
                  key={selectedCode}
                  type="button"
                  onPointerDown={(event) => startMarkerDrag(event, selectedCode)}
                  className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 touch-none select-none ${
                    calibrationMode ? 'cursor-move' : 'cursor-default'
                  }`}
                  style={{
                    left: toPercent(point.x, IMAGE_SIZE.width),
                    top: toPercent(point.y, IMAGE_SIZE.height),
                    touchAction: calibrationMode ? 'none' : 'auto',
                    userSelect: 'none'
                  }}
                  aria-label={`${guide.marker}. ${guide.label}`}
                  title={calibrationMode ? `${guide.label} — drag to position` : guide.label}
                >
                  <span className="block h-4 w-4 rounded-full border-2 border-white bg-[#A65F3F] shadow-[0_1px_4px_rgba(0,0,0,0.28)] ring-2 ring-[#EAC7B2]" />
                  <span className="pointer-events-none absolute left-1/2 top-[-26px] -translate-x-1/2 whitespace-nowrap rounded-full border border-[#C9B7A6] bg-[#FFFDF9] px-2 py-1 text-[8px] font-black text-[#3B312A] shadow-sm">
                    {guide.marker}
                  </span>
                </button>
              );
            })()}
          </div>

          {calibrationMode && selectedCode && config.guides[selectedCode] && (
            <div
              className="absolute inset-0 z-20"
              style={{ pointerEvents: 'none' }}
              data-calibration-editor={CALIBRATION_EDITOR_VERSION}
            >
              {/* Precision anchors: visual dot is 8px; invisible hit area stays easy to grab. */}
              <button
                type="button"
                onPointerDown={(event) => startGuideEndpointDrag(event, 'start')}
                onPointerMove={moveCalibrationHandle}
                onPointerUp={endCalibrationHandle}
                onPointerCancel={endCalibrationHandle}
                className="pointer-events-auto absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 touch-none select-none items-center justify-center rounded-full cursor-grab active:cursor-grabbing"
                style={{
                  left: toPercent(transformedGuideStart.x, IMAGE_SIZE.width),
                  top: toPercent(transformedGuideStart.y, IMAGE_SIZE.height),
                  touchAction: 'none',
                  pointerEvents: 'auto'
                }}
                aria-label={pfUiT("ui.components.femalemeasurementavatar.fbf9d1e8a9")}
                title={pfUiT("ui.components.femalemeasurementavatar.b5abf938bd")}
              >
                <span className="h-2 w-2 rounded-full border border-white shadow-[0_1px_4px_rgba(0,0,0,0.45)]" style={{ backgroundColor: ANCHOR_COLORS.start }} />
              </button>

              {activeGuideShape !== 'line' && transformedGuideMid && selectedCode !== 'HEIGHT' && (
                <button
                  type="button"
                  onPointerDown={startGuideCurveDrag}
                  onPointerMove={moveCalibrationHandle}
                  onPointerUp={endCalibrationHandle}
                  onPointerCancel={endCalibrationHandle}
                  className="pointer-events-auto absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 touch-none select-none items-center justify-center rounded-full cursor-grab active:cursor-grabbing"
                  style={{
                    left: toPercent(transformedGuideMid.x, IMAGE_SIZE.width),
                    top: toPercent(transformedGuideMid.y, IMAGE_SIZE.height),
                    touchAction: 'none',
                    pointerEvents: 'auto'
                  }}
                  aria-label={pfUiT("ui.components.femalemeasurementavatar.c530d1b2c1")}
                  title={activeGuideShape === 'circumference' ? 'Circumference depth · orange' : 'Curve point · orange'}
                >
                  <span className="h-2 w-2 rounded-full border border-white shadow-[0_1px_4px_rgba(0,0,0,0.45)]" style={{ backgroundColor: ANCHOR_COLORS.middle }} />
                </button>
              )}

              <button
                type="button"
                onPointerDown={(event) => startGuideEndpointDrag(event, 'end')}
                onPointerMove={moveCalibrationHandle}
                onPointerUp={endCalibrationHandle}
                onPointerCancel={endCalibrationHandle}
                className="pointer-events-auto absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 touch-none select-none items-center justify-center rounded-full cursor-grab active:cursor-grabbing"
                style={{
                  left: toPercent(transformedGuideEnd.x, IMAGE_SIZE.width),
                  top: toPercent(transformedGuideEnd.y, IMAGE_SIZE.height),
                  touchAction: 'none',
                  pointerEvents: 'auto'
                }}
                aria-label={pfUiT("ui.components.femalemeasurementavatar.fd6d32d8ea")}
                title={pfUiT("ui.components.femalemeasurementavatar.e904906f0c")}
              >
                <span className="h-2 w-2 rounded-full border border-white shadow-[0_1px_4px_rgba(0,0,0,0.45)]" style={{ backgroundColor: ANCHOR_COLORS.end }} />
              </button>
            </div>
          )}

          {activeGuide && !calibrationMode && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#D9CABB] bg-white/92 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#735C4A] shadow-sm backdrop-blur-sm">
              {activeGuide.marker} · {activeGuide.shortLabel}
            </div>
          )}
        </div>
      </div>

      {calibrationAvailable && showCalibrationJson && (
        <div className="relative z-20 border-t border-[#E1D5C8] bg-[#2E241C] p-3 text-white">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em]">{pfUiT("ui.components.femalemeasurementavatar.07e4bd5384")}</p>
            <button
              type="button"
              onClick={() => setShowCalibrationJson(false)}
              className="rounded-full border border-white/30 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em]"
            >{pfUiT("ui.components.femalemeasurementavatar.4c2ee978f1")}</button>
          </div>
          <textarea
            readOnly
            value={resolvedJson}
            className="h-48 w-full resize-y rounded-lg border border-white/15 bg-black/25 p-3 font-mono text-[10px] leading-relaxed text-white outline-none"
          />
        </div>
      )}
    </div>
  );
}

export { CALIBRATION_STORAGE_KEY, IMAGE_SIZE, DEFAULT_VIEW_CONFIG as VIEW_CONFIG };
