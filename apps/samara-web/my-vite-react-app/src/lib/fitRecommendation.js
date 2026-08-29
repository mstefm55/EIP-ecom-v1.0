import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { localizeMetadataTree } from './localizedMetadata';
import {
  getPreferredSizeReference,
  normalizeMeasurementChartValues,
  resolveFitProfileBaseline
} from './measurementChart';

const PRIORITY_WEIGHT = {
  CRITICAL: 5,
  IMPORTANT: 3,
  SECONDARY: 1,
  NOT_RELEVANT: 0
};

const BODY_AREA_ALIASES = {
  BUST: ['BUST', 'CHEST', 'BUST_CHEST', 'BUST_CHEST_GIRTH'],
  HIGH_BUST: ['HIGH_BUST', 'UPPER_BUST'],
  UNDERBUST: ['UNDERBUST', 'UNDER_BUST'],
  WAIST: ['WAIST', 'WAIST_GIRTH', 'NATURAL_WAIST'],
  HIP: ['HIP', 'HIPS', 'HIP_GIRTH', 'HIP_SEAT', 'SEAT'],
  SHOULDER: ['SHOULDER', 'SHOULDER_LENGTH', 'SHOULDER_WIDTH'],
  THIGH: ['THIGH', 'THIGH_GIRTH'],
  INSEAM: ['INSEAM', 'INSIDE_LEG', 'INSIDE_LEG_LENGTH'],
  HEIGHT: ['HEIGHT', 'STATURE'],
  BACK_LENGTH: ['BACK_LENGTH', 'BACK_WAIST_LENGTH'],
  SLEEVE_LENGTH: ['SLEEVE_LENGTH', 'ARM_LENGTH'],
  TORSO_LENGTH: ['TORSO_LENGTH', 'BODY_RISE']
};

const EPSILON_CM = 0.05;

const getLegacyMeasurementMetadata = () => localizeMetadataTree(
  perfectFitMetadata.componentUi.fitRecommendation.legacyMeasurements,
  'component.fitRecommendation.legacyMeasurements'
);

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export function normalizeBodyAreaCode(value) {
  const token = normalizeToken(value);

  for (const [canonical, aliases] of Object.entries(BODY_AREA_ALIASES)) {
    if (aliases.includes(token)) return canonical;
  }

  return token;
}

export function toCentimeters(value, unit = 'cm') {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return unit === 'in' || unit === 'inch' ? numeric * 2.54 : numeric;
}

export function fromCentimeters(value, unit = 'cm') {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return unit === 'in' || unit === 'inch' ? numeric / 2.54 : numeric;
}

function clonePublic(value, fallback = null) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function getMeasurementRowBodyArea(row) {
  const candidates = [row?.measurementCode, row?.bodyAreaCode, row?.code, row?.label];

  for (const candidate of candidates) {
    const normalized = normalizeBodyAreaCode(candidate);
    if (Object.keys(BODY_AREA_ALIASES).includes(normalized)) return normalized;
  }

  return normalizeBodyAreaCode(row?.label || row?.code || '');
}

function sanitizeFitProfile(fitProfile = {}) {
  return {
    version: fitProfile.version || 'fit-profile-v1',
    standardCategory: fitProfile.standardCategory || '',
    standardCategoryLabel: fitProfile.standardCategoryLabel || '',
    silhouette: fitProfile.silhouette || '',
    baseline: fitProfile.baseline
      ? {
          code: fitProfile.baseline.code || '',
          label: fitProfile.baseline.label || '',
          reference: fitProfile.baseline.reference || ''
        }
      : null,
    rules: (fitProfile.rules || []).map((rule) => ({
      id: rule.id || '',
      measurementCode: normalizeBodyAreaCode(rule.measurementCode),
      priority: String(rule.priority || 'SECONDARY').toUpperCase(),
      minimumEase: rule.minimumEase ?? '',
      targetEase: rule.targetEase ?? '',
      maximumPreferredEase: rule.maximumPreferredEase ?? '',
      // Public fit projections intentionally keep the rule origin category only.
      // `sourceDetail` can contain a designer login or Fit Session reference and
      // therefore must remain inside the private Workspace.
      source: rule.source || 'STANDARD_CATEGORY'
    }))
  };
}

function sanitizeGarmentMeasurements(raw = {}, sizes = []) {
  const sizeIds = new Set((sizes || []).map((size) => size.id).filter(Boolean));

  return Object.entries(raw || {}).reduce((result, [rawCode, rawValues]) => {
    const code = normalizeBodyAreaCode(rawCode);
    if (!code || !rawValues || typeof rawValues !== 'object') return result;

    const values = rawValues.values && typeof rawValues.values === 'object'
      ? rawValues.values
      : rawValues;

    const sanitized = Object.entries(values).reduce((sizeResult, [sizeId, value]) => {
      if (!sizeIds.has(sizeId)) return sizeResult;
      if (value === '' || value === null || value === undefined) return sizeResult;
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return sizeResult;
      sizeResult[sizeId] = numeric;
      return sizeResult;
    }, {});

    if (Object.keys(sanitized).length) result[code] = sanitized;
    return result;
  }, {});
}

function sanitizeChart(chart = {}) {
  return {
    revisionLabel: chart.revisionLabel || 'V1',
    revisionNumber: Number(chart.revisionNumber || 1),
    displaySystem: chart.displaySystem || 'ALPHA',
    unit: chart.unit || 'cm',
    baseSizeId: chart.baseSizeId || '',
    sizes: (chart.sizes || []).map((size) => ({
      id: size.id,
      sortOrder: Number(size.sortOrder || 0),
      label: size.label || '',
      references: clonePublic(size.references || {}, {})
    })),
    measurements: (chart.measurements || []).map((row) => ({
      id: row.id || '',
      code: row.code || '',
      label: row.label || '',
      bodyAreaCode: getMeasurementRowBodyArea(row),
      values: clonePublic(row.values || {}, {})
    })),
    garmentMeasurements: sanitizeGarmentMeasurements(
      chart.garmentMeasurements || {},
      chart.sizes || []
    ),
    fitProfile: sanitizeFitProfile(chart.fitProfile || {})
  };
}

export function buildWorkspaceFitSpecificationSnapshot({
  project = null,
  style = null,
  variant = null,
  metadata,
  requestId = '',
  createdAt = new Date().toISOString()
} = {}) {
  if (!variant) return null;

  const measurementNode = (variant.children || []).find(
    (child) => child.nodeType === 'sizeSet'
  );

  if (!measurementNode) return null;

  const chart = normalizeMeasurementChartValues(
    measurementNode.values || {},
    variant.values || {},
    metadata,
    style?.values || {}
  );

  return {
    snapshotVersion: 'public-fit-spec-v1',
    source: 'WORKSPACE_PUBLISHED',
    requestId: requestId || '',
    workspaceVariantId: variant.id,
    projectId: project?.id || '',
    styleId: style?.id || '',
    name:
      style?.values?.['product.style_name'] ||
      variant.values?.['variant.name'] ||
      style?.title ||
      'Published product',
    variantName: variant.values?.['variant.name'] || variant.title || '',
    variantCode: variant.values?.['variant.code'] || '',
    styleCode: style?.values?.['product.style_code'] || '',
    categoryCode: style?.values?.['product.category'] || '',
    silhouetteCode: style?.values?.['product.fit_silhouette'] || 'REGULAR',
    publicationStatus: 'SUBMITTED',
    measurementChartRevision: chart.revisionLabel || 'V1',
    createdAt,
    measurementChart: sanitizeChart(chart)
  };
}

function walkWorkspaceVariants(workspaceData = {}) {
  const result = [];

  (workspaceData.projects || []).forEach((project) => {
    (project.children || []).forEach((style) => {
      if (style.nodeType !== 'product') return;

      (style.children || []).forEach((variant) => {
        if (variant.nodeType !== 'variant') return;
        result.push({ project, style, variant });
      });
    });
  });

  return result;
}

export function buildPublishedFitSpecifications(workspaceData = {}, metadata) {
  return walkWorkspaceVariants(workspaceData)
    .filter(({ variant }) => variant?.values?.publicationRelease?.status === 'PUBLISHED')
    .map(({ project, style, variant }) => {
      const publication = variant?.values?.publicationRelease || {};
      const frozen = publication.publishedFitSpecification;

      if (frozen?.measurementChart) {
        return {
          ...clonePublic(frozen, {}),
          source: 'WORKSPACE_PUBLISHED',
          publicationStatus: 'PUBLISHED',
          releaseBinding: 'FROZEN_PUBLICATION_SNAPSHOT',
          measurementChart: sanitizeChart(frozen.measurementChart)
        };
      }

      // A published Workspace product without a frozen fit snapshot predates
      // governed publication binding. Do not expose the current live Workspace
      // chart as a substitute: it may already contain a newer Draft / In Review
      // technical revision that the moderator never approved for publication.
      // Returning null deliberately sends Find My Size to its non-Workspace
      // industry baseline until the product is submitted/published again and a
      // frozen `publishedFitSpecification` is created.
      return null;
    })
    .filter(Boolean);
}

function inferLegacyCategoryCode(pattern = {}) {
  const searchable = `${pattern.category || ''} ${pattern.name || ''} ${pattern.type || ''}`.toLowerCase();

  if (/trouser|pant|short|palazzo/.test(searchable)) return 'TROUSER';
  if (/skirt/.test(searchable)) return 'SKIRT';
  if (/coat|jacket|trench|outerwear/.test(searchable)) return 'COAT';
  if (/blouse|shirt|top|tee/.test(searchable)) return 'TOP';
  return 'DRESS';
}

function inferLegacySilhouette(pattern = {}) {
  const searchable = `${pattern.fit || ''} ${pattern.silhouette || ''} ${pattern.name || ''}`.toLowerCase();

  if (/oversized/.test(searchable)) return 'OVERSIZED';
  if (/relaxed|loose/.test(searchable)) return 'RELAXED';
  if (/a[- ]?line/.test(searchable)) return 'A_LINE';
  if (/semi[- ]?fitted/.test(searchable)) return 'SEMI_FITTED';
  if (/fitted|bodycon|slim/.test(searchable)) return 'FITTED';
  return 'REGULAR';
}

export function buildLegacyFitSpecification(pattern = {}, sizingRows = [], metadata) {
  const rows = Array.isArray(sizingRows) ? sizingRows.filter(Boolean) : [];
  if (!rows.length) return null;

  const categoryCode = inferLegacyCategoryCode(pattern);
  const silhouetteCode = inferLegacySilhouette(pattern);
  const styleValues = {
    'product.category': categoryCode,
    'product.fit_silhouette': silhouetteCode
  };
  const fitProfile = resolveFitProfileBaseline(styleValues, metadata);

  const sizes = rows.map((row, index) => ({
    id: `legacy-size-${index + 1}`,
    sortOrder: index + 1,
    references: {
      DISPLAY: String(row.size ?? index + 1),
      US: String(row.size ?? index + 1)
    },
    label: String(row.size ?? index + 1)
  }));

  const makeValues = (field) =>
    sizes.reduce((result, size, index) => {
      const raw = rows[index]?.[field];
      if (raw !== undefined && raw !== null && raw !== '') {
        result[size.id] = raw;
      }
      return result;
    }, {});

  return {
    id: `legacy-fit-spec-${pattern.id || 'pattern'}`,
    source: 'INDUSTRY_BASELINE_FALLBACK',
    patternId: pattern.id || '',
    name: pattern.name || 'Pattern',
    variantName: '',
    categoryCode,
    silhouetteCode,
    publicationStatus: 'LEGACY',
    measurementChart: {
      revisionLabel: 'Baseline',
      revisionNumber: 1,
      displaySystem: 'DISPLAY',
      unit: 'in',
      baseSizeId: sizes[0]?.id || '',
      sizes,
      measurements: [
        {
          id: 'legacy-bust',
          code: 'BUST',
          label: getLegacyMeasurementMetadata()[0].label,
          bodyAreaCode: 'BUST',
          values: makeValues('bust')
        },
        {
          id: 'legacy-waist',
          code: 'WAIST',
          label: getLegacyMeasurementMetadata()[1].label,
          bodyAreaCode: 'WAIST',
          values: makeValues('waist')
        },
        {
          id: 'legacy-hip',
          code: 'HIP',
          label: getLegacyMeasurementMetadata()[2].label,
          bodyAreaCode: 'HIP',
          values: makeValues('hips')
        }
      ],
      fitProfile: sanitizeFitProfile(fitProfile)
    }
  };
}

export function findFitSpecificationForPattern(pattern, publishedSpecifications = []) {
  if (!pattern) return null;

  const variantId =
    pattern.workspaceVariantId ||
    pattern.variantId ||
    pattern.workspace?.variantId ||
    '';

  if (variantId) {
    const byVariant = publishedSpecifications.find(
      (spec) => String(spec.workspaceVariantId) === String(variantId)
    );
    if (byVariant) return byVariant;
  }

  const styleCode = pattern.styleCode || pattern.workspaceStyleCode || '';
  const variantCode = pattern.variantCode || pattern.workspaceVariantCode || '';

  if (variantCode) {
    const byVariantCode = publishedSpecifications.find(
      (spec) => String(spec.variantCode) === String(variantCode)
    );
    if (byVariantCode) return byVariantCode;
  }

  if (styleCode) {
    const byStyleCode = publishedSpecifications.find(
      (spec) => String(spec.styleCode) === String(styleCode)
    );
    if (byStyleCode) return byStyleCode;
  }

  return null;
}

function getSortedSizes(chart = {}) {
  return [...(chart.sizes || [])].sort((a, b) => {
    const orderA = Number(a.sortOrder || 0);
    const orderB = Number(b.sortOrder || 0);
    return orderA - orderB;
  });
}

function getRowMap(chart = {}) {
  const map = new Map();

  (chart.measurements || []).forEach((row) => {
    const code = normalizeBodyAreaCode(row.bodyAreaCode || row.label || row.code);
    if (code && !map.has(code)) map.set(code, row);
  });

  return map;
}

function getAdjacentStepCm(row, sizes = [], chartUnit) {
  // A Fit Profile may legitimately contain a governed rule for a body area
  // that is not present in an older / partial Measurement Chart. In that
  // case there is no grading step to derive, so use the neutral fallback
  // rather than dereferencing an absent row.
  if (!row || !row.values || !Array.isArray(sizes) || sizes.length < 2) {
    return 4;
  }

  const diffs = [];

  for (let index = 1; index < sizes.length; index += 1) {
    const previous = toCentimeters(row.values?.[sizes[index - 1]?.id], chartUnit);
    const current = toCentimeters(row.values?.[sizes[index]?.id], chartUnit);

    if (Number.isFinite(previous) && Number.isFinite(current)) {
      const diff = Math.abs(current - previous);
      if (diff > EPSILON_CM) diffs.push(diff);
    }
  }

  if (!diffs.length) return 4;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)] || 4;
}

function parseEaseCm(value, chartUnit) {
  if (value === '' || value === null || value === undefined) return null;
  return toCentimeters(value, chartUnit);
}

function buildRuleEvaluation({
  rule,
  row,
  size,
  sizes,
  chart,
  bodyValueCm,
  garmentMeasurementValue
}) {
  const priority = String(rule.priority || 'SECONDARY').toUpperCase();
  const weight = PRIORITY_WEIGHT[priority] ?? 1;
  const chartValueCm = toCentimeters(row?.values?.[size.id], chart.unit);
  const garmentValueCm = toCentimeters(garmentMeasurementValue, chart.unit);
  const hasGarmentMeasurement = Number.isFinite(garmentValueCm);
  const stepCm = getAdjacentStepCm(row, sizes, chart.unit);

  if (!Number.isFinite(bodyValueCm) || !Number.isFinite(chartValueCm)) {
    return {
      measurementCode: rule.measurementCode,
      priority,
      evaluable: false,
      hardFail: false,
      penalty: 0,
      bodyValueCm,
      chartValueCm: Number.isFinite(chartValueCm) ? chartValueCm : null,
      actualEaseCm: null,
      basis: 'UNAVAILABLE'
    };
  }

  if (hasGarmentMeasurement) {
    const minimumEaseCm = parseEaseCm(rule.minimumEase, chart.unit);
    const targetEaseCm = parseEaseCm(rule.targetEase, chart.unit);
    const maximumPreferredEaseCm = parseEaseCm(rule.maximumPreferredEase, chart.unit);
    const actualEaseCm = garmentValueCm - bodyValueCm;
    const hardFail =
      priority === 'CRITICAL' &&
      actualEaseCm < (Number.isFinite(minimumEaseCm) ? minimumEaseCm : 0) - EPSILON_CM;
    const target = Number.isFinite(targetEaseCm) ? targetEaseCm : Math.max(0, minimumEaseCm || 0);
    const deviation = Math.abs(actualEaseCm - target);
    const deficit = actualEaseCm < target;
    const excessBeyondPreferred =
      Number.isFinite(maximumPreferredEaseCm) &&
      actualEaseCm > maximumPreferredEaseCm
        ? actualEaseCm - maximumPreferredEaseCm
        : 0;
    const basePenalty =
      weight *
      (deviation / Math.max(stepCm, 1)) *
      (deficit ? 2.4 : 0.8);
    const excessPenalty =
      excessBeyondPreferred > 0
        ? weight * (excessBeyondPreferred / Math.max(stepCm, 1)) * 1.35
        : 0;
    const penalty = basePenalty + excessPenalty;

    return {
      measurementCode: rule.measurementCode,
      priority,
      evaluable: true,
      hardFail,
      penalty,
      bodyValueCm,
      chartValueCm,
      garmentValueCm,
      actualEaseCm,
      minimumEaseCm,
      targetEaseCm,
      maximumPreferredEaseCm,
      basis: 'FINISHED_GARMENT'
    };
  }

  const deltaCm = chartValueCm - bodyValueCm;
  const hardFail = priority === 'CRITICAL' && deltaCm < -EPSILON_CM;
  const tight = deltaCm < 0;
  const tightMultiplier = priority === 'IMPORTANT' ? 3.2 : priority === 'SECONDARY' ? 1.5 : 2.2;
  const looseMultiplier = priority === 'CRITICAL' ? 0.7 : priority === 'IMPORTANT' ? 0.8 : 0.65;
  const penalty =
    weight *
    (Math.abs(deltaCm) / Math.max(stepCm, 1)) *
    (tight ? tightMultiplier : looseMultiplier);

  return {
    measurementCode: rule.measurementCode,
    priority,
    evaluable: true,
    hardFail,
    penalty,
    bodyValueCm,
    chartValueCm,
    deltaCm,
    actualEaseCm: null,
    basis: 'BODY_CHART_ANCHOR'
  };
}

function getGarmentMeasurement(spec, measurementCode, sizeId) {
  return (
    spec?.garmentMeasurements?.[measurementCode]?.[sizeId] ??
    spec?.measurementChart?.garmentMeasurements?.[measurementCode]?.[sizeId] ??
    null
  );
}

function classifyBodyArea({ rule, row, sizes, chart, bodyValueCm }) {
  if (!row || !Number.isFinite(bodyValueCm)) {
    return {
      measurementCode: rule.measurementCode,
      priority: rule.priority,
      matchedSize: null,
      matchedSizeIndex: -1,
      beyondRange: false
    };
  }

  for (let index = 0; index < sizes.length; index += 1) {
    const anchorCm = toCentimeters(row.values?.[sizes[index].id], chart.unit);
    if (Number.isFinite(anchorCm) && anchorCm + EPSILON_CM >= bodyValueCm) {
      return {
        measurementCode: rule.measurementCode,
        priority: rule.priority,
        matchedSize: sizes[index],
        matchedSizeIndex: index,
        beyondRange: false,
        anchorCm
      };
    }
  }

  return {
    measurementCode: rule.measurementCode,
    priority: rule.priority,
    matchedSize: sizes[sizes.length - 1] || null,
    matchedSizeIndex: sizes.length - 1,
    beyondRange: true,
    anchorCm: toCentimeters(row.values?.[sizes[sizes.length - 1]?.id], chart.unit)
  };
}

function fitLabelForEvaluation(evaluation, stepCm = 4) {
  if (!evaluation?.evaluable) return 'Not assessed';
  if (evaluation.hardFail) return 'Too small';

  if (evaluation.basis === 'FINISHED_GARMENT') {
    const target = Number.isFinite(evaluation.targetEaseCm) ? evaluation.targetEaseCm : 0;
    const delta = evaluation.actualEaseCm - target;
    if (
      Number.isFinite(evaluation.maximumPreferredEaseCm) &&
      evaluation.actualEaseCm > evaluation.maximumPreferredEaseCm + EPSILON_CM
    ) return 'Too loose';
    if (delta < -0.5) return 'Close / snug';
    if (delta > Math.max(2, stepCm * 0.8)) return 'Relaxed';
    return 'Best fit';
  }

  const delta = evaluation.deltaCm;
  if (delta < -EPSILON_CM) return 'Snug';
  if (delta > Math.max(2, stepCm * 0.8)) return 'Relaxed';
  if (delta > 0.5) return 'Comfortable';
  return 'Best fit';
}

export function recommendSizeForFit({
  specification,
  bodyMeasurements = {},
  displaySystem,
  fitPreference = 'REGULAR'
}) {
  if (!specification?.measurementChart) {
    return {
      status: 'NO_SPECIFICATION',
      recommendation: null,
      candidates: [],
      bodyPartMatches: [],
      missingCriticalMeasurements: []
    };
  }

  const chart = specification.measurementChart;
  const sizes = getSortedSizes(chart);
  const rowMap = getRowMap(chart);
  const rules = (chart.fitProfile?.rules || []).filter(
    (rule) => String(rule.priority || '').toUpperCase() !== 'NOT_RELEVANT'
  );

  const normalizedBody = Object.entries(bodyMeasurements || {}).reduce((result, [key, value]) => {
    const code = normalizeBodyAreaCode(key);
    const numeric = Number(value);
    if (code && Number.isFinite(numeric)) result[code] = numeric;
    return result;
  }, {});

  const criticalRules = rules.filter(
    (rule) => String(rule.priority || '').toUpperCase() === 'CRITICAL'
  );
  const missingCriticalMeasurements = criticalRules
    .filter((rule) => !Number.isFinite(normalizedBody[normalizeBodyAreaCode(rule.measurementCode)]))
    .map((rule) => normalizeBodyAreaCode(rule.measurementCode));

  const bodyPartMatches = rules.map((rule) => {
    const code = normalizeBodyAreaCode(rule.measurementCode);
    const row = rowMap.get(code);
    return classifyBodyArea({
      rule: { ...rule, measurementCode: code },
      row,
      sizes,
      chart,
      bodyValueCm: normalizedBody[code]
    });
  });

  if (!sizes.length || !rules.length) {
    return {
      status: 'INSUFFICIENT_SPECIFICATION',
      recommendation: null,
      candidates: [],
      bodyPartMatches,
      missingCriticalMeasurements
    };
  }

  const candidates = sizes.map((size, sizeIndex) => {
    const evaluations = rules.map((rule) => {
      const code = normalizeBodyAreaCode(rule.measurementCode);
      const row = rowMap.get(code);
      const bodyValueCm = normalizedBody[code];
      return buildRuleEvaluation({
        rule: { ...rule, measurementCode: code },
        row,
        size,
        sizes,
        chart,
        bodyValueCm,
        garmentMeasurementValue: getGarmentMeasurement(specification, code, size.id)
      });
    });

    const hardFails = evaluations.filter((item) => item.hardFail);
    const evaluableCount = evaluations.filter((item) => item.evaluable).length;
    const penalty = evaluations.reduce((sum, item) => sum + Number(item.penalty || 0), 0);
    const preferencePenalty = fitPreference === 'RELAXED' ? Math.max(0, sizes.length - sizeIndex - 1) * 0.04 : sizeIndex * 0.01;

    return {
      size,
      sizeIndex,
      viable: hardFails.length === 0,
      hardFails,
      evaluations,
      evaluableCount,
      score: penalty + preferencePenalty
    };
  });

  const viableCandidates = candidates
    .filter((candidate) => candidate.viable)
    .sort((a, b) => a.score - b.score || a.sizeIndex - b.sizeIndex);

  if (!viableCandidates.length) {
    const closest = [...candidates].sort((a, b) => {
      if (a.hardFails.length !== b.hardFails.length) return a.hardFails.length - b.hardFails.length;
      return a.score - b.score;
    })[0] || null;

    return {
      status: 'NO_STANDARD_SIZE',
      recommendation: null,
      closestAvailable: closest,
      candidates,
      bodyPartMatches,
      missingCriticalMeasurements,
      confidence: 'LOW'
    };
  }

  const winner = viableCandidates[0];
  const preferredSystem = displaySystem || chart.displaySystem || 'ALPHA';
  const label = getPreferredSizeReference(winner.size, preferredSystem) || winner.size.label || winner.size.id;
  const controlling = bodyPartMatches
    .filter((item) => String(item.priority || '').toUpperCase() === 'CRITICAL' && item.matchedSize)
    .sort((a, b) => b.matchedSizeIndex - a.matchedSizeIndex)[0] || null;

  const fitBreakdown = winner.evaluations.map((evaluation) => {
    const row = rowMap.get(evaluation.measurementCode);
    const stepCm = row ? getAdjacentStepCm(row, sizes, chart.unit) : 4;
    return {
      ...evaluation,
      label: fitLabelForEvaluation(evaluation, stepCm)
    };
  });

  const usesFinishedGarmentData = fitBreakdown.some(
    (item) => item.basis === 'FINISHED_GARMENT'
  );
  const criticalEvaluated = criticalRules.every((rule) => {
    const code = normalizeBodyAreaCode(rule.measurementCode);
    return Number.isFinite(normalizedBody[code]) && rowMap.has(code);
  });
  const allCriticalUseFinishedGarmentData = criticalRules.length
    ? criticalRules.every((rule) => {
        const code = normalizeBodyAreaCode(rule.measurementCode);
        return fitBreakdown.some(
          (item) => item.measurementCode === code && item.basis === 'FINISHED_GARMENT'
        );
      })
    : usesFinishedGarmentData;

  const confidence = allCriticalUseFinishedGarmentData && criticalEvaluated
    ? 'HIGH'
    : specification.source === 'WORKSPACE_PUBLISHED' && criticalEvaluated
    ? 'MEDIUM'
    : 'BASELINE';

  return {
    status: missingCriticalMeasurements.length ? 'NEEDS_MORE_MEASUREMENTS' : 'RECOMMENDED',
    recommendation: {
      size: winner.size,
      label,
      score: winner.score,
      controllingMeasurementCode: controlling?.measurementCode || null,
      controllingMatchedSize: controlling?.matchedSize || null,
      fitBreakdown
    },
    candidates,
    bodyPartMatches,
    missingCriticalMeasurements,
    confidence,
    specificationSource: specification.source
  };
}

export function getRequiredMeasurementCodes(specification) {
  const rules = specification?.measurementChart?.fitProfile?.rules || [];
  return rules
    .filter((rule) => String(rule.priority || '').toUpperCase() !== 'NOT_RELEVANT')
    .map((rule) => normalizeBodyAreaCode(rule.measurementCode))
    .filter(Boolean);
}

export function getFitPriorityLabel(priority) {
  const normalized = String(priority || '').toUpperCase();
  if (normalized === 'CRITICAL') return 'Critical';
  if (normalized === 'IMPORTANT') return 'Important';
  if (normalized === 'SECONDARY') return 'Secondary';
  if (normalized === 'NOT_RELEVANT') return 'Not relevant';
  return 'Fit input';
}
