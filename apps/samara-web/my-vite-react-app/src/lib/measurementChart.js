import { perfectFitMetadata } from '../config/perfectFitMetadata';

export const MEASUREMENT_CHART_VERSION = perfectFitMetadata.sizing.version;
export const DEFAULT_MEASUREMENT_SIZE_SYSTEMS = perfectFitMetadata.sizing.baseSystems;
const DEFAULT_SIZE_LABELS = perfectFitMetadata.sizing.defaultSizeLabels;
export const FIT_PROFILE_VERSION = perfectFitMetadata.measurement.fitProfile.version;
export const FIT_PRIORITY_CODES = perfectFitMetadata.measurement.fitProfile.priorityCodes;
export const MEASUREMENT_CHART_APPROVAL_STATUSES = perfectFitMetadata.measurement.fitProfile.approvalStatuses;
const SYSTEM_ALIASES = perfectFitMetadata.sizing.systemAliases;
const MEASUREMENT_POSITIONS = perfectFitMetadata.measurement.legacyPositions;

export function normalizeMeasurementChartApprovalStatus(value, fallback = 'DRAFT') {
  const normalized = String(value || '').trim().toUpperCase();
  return MEASUREMENT_CHART_APPROVAL_STATUSES.includes(normalized)
    ? normalized
    : fallback;
}

const cloneSerializable = (value, fallback = null) => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
};

const normalizeFitPriority = (value, fallback = 'SECONDARY') => {
  const normalized = String(value || '').trim().toUpperCase();
  return FIT_PRIORITY_CODES.includes(normalized) ? normalized : fallback;
};

const getFitProfileMetadata = (metadata) => metadata?.fitProfile || {};

const normalizeBodyAreaCode = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export function getFitBodyAreaLabel(code, metadata) {
  const normalized = normalizeBodyAreaCode(code);
  return (
    getFitProfileMetadata(metadata)?.bodyAreas?.[normalized]?.label ||
    normalized
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) ||
    'Body area'
  );
}

export function resolveStandardFitCategory(styleValues = {}, metadata) {
  const fitMetadata = getFitProfileMetadata(metadata);
  const productCategory = String(styleValues?.['product.category'] || '').trim().toUpperCase();

  return (
    fitMetadata.categoryMappings?.[productCategory] ||
    fitMetadata.defaultStandardCategory ||
    'UNSPECIFIED'
  );
}

function getBaselineRules(standardCategory, silhouette, metadata) {
  const fitMetadata = getFitProfileMetadata(metadata);
  const categoryDefinition = fitMetadata.standardCategories?.[standardCategory] || {};
  const baseRules = Array.isArray(categoryDefinition.rules) ? categoryDefinition.rules : [];
  const modifier = fitMetadata.silhouetteModifiers?.[silhouette] || {};
  const categoryOverrides = modifier.byCategory?.[standardCategory] || {};

  return baseRules.map((rule, index) => {
    const measurementCode = normalizeBodyAreaCode(rule.measurementCode || rule.code);
    const override = categoryOverrides?.[measurementCode] || null;

    return {
      id: rule.id || `fit-rule-${measurementCode.toLowerCase() || index + 1}`,
      measurementCode,
      priority: normalizeFitPriority(override?.priority || rule.priority, 'SECONDARY'),
      minimumEase: override?.minimumEase ?? rule.minimumEase ?? '',
      targetEase: override?.targetEase ?? rule.targetEase ?? '',
      maximumPreferredEase:
        override?.maximumPreferredEase ??
        rule.maximumPreferredEase ??
        '',
      source: override ? 'SILHOUETTE_MODIFIER' : 'STANDARD_CATEGORY',
      sourceDetail: override ? silhouette : standardCategory,
      overrideReason: '',
      evidenceIds: []
    };
  });
}

export function resolveFitProfileBaseline(styleValues = {}, metadata) {
  const fitMetadata = getFitProfileMetadata(metadata);
  const standardCategory = resolveStandardFitCategory(styleValues, metadata);
  const silhouette = String(styleValues?.['product.fit_silhouette'] || 'REGULAR').trim().toUpperCase();
  const categoryDefinition = fitMetadata.standardCategories?.[standardCategory] || {};

  return {
    version: FIT_PROFILE_VERSION,
    standardCategory,
    standardCategoryLabel: categoryDefinition.label || standardCategory,
    silhouette,
    baseline: {
      code: fitMetadata.baseline?.code || 'INDUSTRY_STANDARD',
      label: fitMetadata.baseline?.label || 'Industry standard baseline',
      reference: fitMetadata.baseline?.reference || ''
    },
    rules: getBaselineRules(standardCategory, silhouette, metadata)
  };
}

function normalizeFitRule(rule = {}, fallbackRule = null, index = 0) {
  const measurementCode = normalizeBodyAreaCode(
    rule.measurementCode || fallbackRule?.measurementCode || rule.code
  );

  return {
    id:
      rule.id ||
      fallbackRule?.id ||
      `fit-rule-${measurementCode.toLowerCase() || index + 1}`,
    measurementCode,
    priority: normalizeFitPriority(
      rule.priority || fallbackRule?.priority,
      fallbackRule?.priority || 'SECONDARY'
    ),
    minimumEase: rule.minimumEase ?? fallbackRule?.minimumEase ?? '',
    targetEase: rule.targetEase ?? fallbackRule?.targetEase ?? '',
    maximumPreferredEase:
      rule.maximumPreferredEase ??
      fallbackRule?.maximumPreferredEase ??
      '',
    source: rule.source || fallbackRule?.source || 'STANDARD_CATEGORY',
    sourceDetail: rule.sourceDetail || fallbackRule?.sourceDetail || '',
    overrideReason: rule.overrideReason || '',
    evidenceIds: Array.isArray(rule.evidenceIds) ? [...rule.evidenceIds] : []
  };
}

export function normalizeFitProfileValues(fitProfile = {}, styleValues = {}, metadata) {
  const baseline = resolveFitProfileBaseline(styleValues, metadata);
  const existingRules = Array.isArray(fitProfile.rules) ? fitProfile.rules : [];
  const existingByCode = new Map(
    existingRules
      .map((rule) => [normalizeBodyAreaCode(rule.measurementCode || rule.code), rule])
      .filter(([code]) => Boolean(code))
  );

  const mergedRules = baseline.rules.map((baselineRule, index) => {
    const existing = existingByCode.get(baselineRule.measurementCode);
    existingByCode.delete(baselineRule.measurementCode);

    if (!existing) {
      return normalizeFitRule(baselineRule, baselineRule, index);
    }

    const isDesignerOverride = existing.source === 'DESIGNER_OVERRIDE';
    return normalizeFitRule(
      isDesignerOverride
        ? existing
        : {
            ...baselineRule,
            evidenceIds: existing.evidenceIds || [],
            overrideReason: existing.overrideReason || ''
          },
      baselineRule,
      index
    );
  });

  existingByCode.forEach((rule) => {
    mergedRules.push(normalizeFitRule(rule, null, mergedRules.length));
  });

  const proposals = Array.isArray(fitProfile.proposals)
    ? fitProfile.proposals.map((proposal) => ({
        ...cloneSerializable(proposal, {}),
        status: proposal?.status || 'PENDING'
      }))
    : [];

  return {
    ...fitProfile,
    version: fitProfile.version || FIT_PROFILE_VERSION,
    standardCategory: baseline.standardCategory,
    standardCategoryLabel: baseline.standardCategoryLabel,
    silhouette: baseline.silhouette,
    baseline: baseline.baseline,
    rules: mergedRules,
    proposals
  };
}

function convertNumericMeasurementValue(value, factor) {
  if (value === '' || value === null || value === undefined) {
    return value;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }

  return Number((numeric * factor).toFixed(2));
}

function convertFitRuleEaseFields(rule = {}, factor) {
  return {
    ...rule,
    minimumEase: convertNumericMeasurementValue(rule.minimumEase, factor),
    targetEase: convertNumericMeasurementValue(rule.targetEase, factor),
    maximumPreferredEase: convertNumericMeasurementValue(
      rule.maximumPreferredEase,
      factor
    )
  };
}

export function convertMeasurementChartUnitValues(chart = {}, nextUnit = 'cm') {
  const currentUnit = chart.unit === 'inch' ? 'in' : chart.unit || 'cm';
  const normalizedNextUnit = nextUnit === 'inch' ? 'in' : nextUnit || 'cm';

  if (currentUnit === normalizedNextUnit) {
    return cloneSerializable(chart, chart);
  }

  const factor =
    currentUnit === 'cm' && normalizedNextUnit === 'in'
      ? 1 / 2.54
      : currentUnit === 'in' && normalizedNextUnit === 'cm'
        ? 2.54
        : 1;

  if (factor === 1) {
    return {
      ...cloneSerializable(chart, chart),
      unit: normalizedNextUnit
    };
  }

  const measurements = (chart.measurements || []).map((row) => ({
    ...row,
    values: Object.fromEntries(
      Object.entries(row.values || {}).map(([sizeId, value]) => [
        sizeId,
        convertNumericMeasurementValue(value, factor)
      ])
    )
  }));

  const garmentMeasurements = Object.fromEntries(
    Object.entries(chart.garmentMeasurements || {}).map(([measurementCode, values]) => [
      measurementCode,
      Object.fromEntries(
        Object.entries(values || {}).map(([sizeId, value]) => [
          sizeId,
          convertNumericMeasurementValue(value, factor)
        ])
      )
    ])
  );

  const fitProfile = {
    ...(chart.fitProfile || {}),
    rules: (chart.fitProfile?.rules || []).map((rule) =>
      convertFitRuleEaseFields(rule, factor)
    ),
    proposals: (chart.fitProfile?.proposals || []).map((proposal) => ({
      ...proposal,
      from: proposal?.from
        ? convertFitRuleEaseFields(proposal.from, factor)
        : proposal?.from,
      to: proposal?.to
        ? convertFitRuleEaseFields(proposal.to, factor)
        : proposal?.to
    }))
  };

  return {
    ...chart,
    unit: normalizedNextUnit,
    measurements,
    garmentMeasurements,
    fitProfile
  };
}

export function normalizeFinishedGarmentMeasurements(
  rawMeasurements = {},
  sizes = [],
  fitProfile = {}
) {
  const raw = rawMeasurements && typeof rawMeasurements === 'object'
    ? rawMeasurements
    : {};

  const ruleCodes = (fitProfile?.rules || [])
    .map((rule) => normalizeBodyAreaCode(rule?.measurementCode))
    .filter(Boolean);

  const rawCodes = Object.keys(raw)
    .map((code) => normalizeBodyAreaCode(code))
    .filter(Boolean);

  const codes = Array.from(new Set([...ruleCodes, ...rawCodes]));

  return codes.reduce((result, code) => {
    const rawEntry = raw[code] || raw[Object.keys(raw).find((key) => normalizeBodyAreaCode(key) === code)] || {};
    const sourceValues = rawEntry && typeof rawEntry === 'object' && !Array.isArray(rawEntry)
      ? (rawEntry.values && typeof rawEntry.values === 'object' ? rawEntry.values : rawEntry)
      : {};

    result[code] = sizes.reduce((values, size) => {
      const candidates = [
        size.id,
        size.label,
        ...Object.values(size.references || {})
      ].filter(Boolean);

      let value = '';
      for (const candidate of candidates) {
        if (Object.prototype.hasOwnProperty.call(sourceValues, candidate)) {
          value = sourceValues[candidate];
          break;
        }
      }

      values[size.id] = value ?? '';
      return values;
    }, {});

    return result;
  }, {});
}

export function getFinishedGarmentMeasurement(
  chart = {},
  measurementCode,
  sizeId
) {
  const code = normalizeBodyAreaCode(measurementCode);
  if (!code || !sizeId) return '';
  return chart?.garmentMeasurements?.[code]?.[sizeId] ?? '';
}

export function createFitProfileProposal({
  fitSessionId,
  rule,
  proposal = {},
  actor = null,
  observation = null
}) {
  const now = new Date().toISOString();
  const measurementCode = normalizeBodyAreaCode(
    proposal.measurementCode || rule?.measurementCode
  );

  return {
    id: `fit-proposal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fitSessionId,
    measurementCode,
    status: 'PENDING',
    from: {
      priority: normalizeFitPriority(rule?.priority, 'SECONDARY'),
      minimumEase: rule?.minimumEase ?? '',
      targetEase: rule?.targetEase ?? '',
      maximumPreferredEase: rule?.maximumPreferredEase ?? ''
    },
    to: {
      priority: normalizeFitPriority(
        proposal.priority || rule?.priority,
        rule?.priority || 'SECONDARY'
      ),
      minimumEase: proposal.minimumEase ?? rule?.minimumEase ?? '',
      targetEase: proposal.targetEase ?? rule?.targetEase ?? '',
      maximumPreferredEase:
        proposal.maximumPreferredEase ??
        rule?.maximumPreferredEase ??
        ''
    },
    reason: String(proposal.reason || '').trim(),
    observation: observation ? cloneSerializable(observation, null) : null,
    createdAt: now,
    createdBy: actor
      ? {
          id: actor.id || '',
          name: actor.name || '',
          login: actor.login || ''
        }
      : null,
    decidedAt: null,
    decidedBy: null
  };
}

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');

const normalizeValue = (value) =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/^(UK|US|EU|FR)\s+/, '');

export function normalizeSizeSystemCode(value, fallback = 'ALPHA') {
  const token = normalizeToken(value);
  return SYSTEM_ALIASES[token] || fallback;
}

const getSizerReferenceRows = () => {
  const matrix = MEASUREMENT_POSITIONS?.find((position) => Array.isArray(position.matrix))?.matrix || [];
  return matrix.map((row) => ({
    ALPHA: String(row.size ?? '').trim(),
    UK: String(row.uk ?? '').trim(),
    US: String(row.us ?? '').trim(),
    EU: String(row.eu ?? '').trim(),
    FR: String(row.fr ?? '').trim()
  }));
};

const SIZER_REFERENCE_ROWS = getSizerReferenceRows();

export function getMeasurementSizeSystems(metadata) {
  const metadataSystems = Array.isArray(metadata?.dropdowns?.SIZE_SYSTEM)
    ? metadata.dropdowns.SIZE_SYSTEM.map((item) => ({
        code: normalizeSizeSystemCode(item.code),
        label: item.eipV1Value || item.code
      }))
    : [];

  const discoveredCodes = new Set([
    ...DEFAULT_MEASUREMENT_SIZE_SYSTEMS.map((system) => system.code),
    ...metadataSystems.map((system) => system.code),
    ...SIZER_REFERENCE_ROWS.flatMap((row) => Object.keys(row).filter((code) => row[code]))
  ]);

  const knownLabels = new Map([
    ...DEFAULT_MEASUREMENT_SIZE_SYSTEMS.map((system) => [system.code, system.label]),
    ...metadataSystems.map((system) => [system.code, system.label])
  ]);

  const preferredOrder = ['ALPHA', 'UK', 'US', 'EU', 'FR'];
  return [...discoveredCodes]
    .sort((a, b) => {
      const ai = preferredOrder.indexOf(a);
      const bi = preferredOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
    .map((code) => ({
      code,
      label: knownLabels.get(code) || code
    }));
}

function findSizerReferenceRow(label, preferredSystem = 'ALPHA') {
  const normalizedLabel = normalizeValue(label);
  const normalizedSystem = normalizeSizeSystemCode(preferredSystem);

  return SIZER_REFERENCE_ROWS.find((row) => normalizeValue(row[normalizedSystem]) === normalizedLabel)
    || SIZER_REFERENCE_ROWS.find((row) => Object.values(row).some((value) => normalizeValue(value) === normalizedLabel))
    || null;
}

function referencesFromLabel(label, preferredSystem = 'ALPHA') {
  const row = findSizerReferenceRow(label, preferredSystem);
  if (row) {
    return { ...row };
  }

  const system = normalizeSizeSystemCode(preferredSystem);
  const fallbackSystem = /^[A-Z]{1,4}$/.test(String(label || '').trim()) ? 'ALPHA' : system;
  return {
    [fallbackSystem]: String(label || '').trim()
  };
}

function normalizeReferences(inputReferences = {}, fallbackLabel = '', preferredSystem = 'ALPHA') {
  const references = referencesFromLabel(fallbackLabel, preferredSystem);

  Object.entries(inputReferences || {}).forEach(([key, value]) => {
    const code = normalizeSizeSystemCode(key, key.toUpperCase());
    references[code] = String(value ?? '').trim();
  });

  const preferredCode = normalizeSizeSystemCode(preferredSystem);
  if (
    fallbackLabel &&
    !references[preferredCode] &&
    !Object.values(references).some((value) => normalizeValue(value) === normalizeValue(fallbackLabel))
  ) {
    references[preferredCode] = String(fallbackLabel).trim();
  }

  return references;
}

function createCanonicalSize(rawSize, index, displaySystem) {
  const label = typeof rawSize === 'object'
    ? rawSize.label || rawSize.code || rawSize.name || rawSize.value || rawSize.id
    : rawSize;

  const id = typeof rawSize === 'object' && rawSize.id
    ? String(rawSize.id)
    : `size-${String(index + 1).padStart(2, '0')}`;

  const references = normalizeReferences(
    typeof rawSize === 'object' ? rawSize.references : {},
    label,
    displaySystem
  );

  return {
    id,
    sortOrder: typeof rawSize === 'object' && Number.isFinite(Number(rawSize.sortOrder))
      ? Number(rawSize.sortOrder)
      : index + 1,
    references,
    label: getPreferredSizeReference({ id, references }, displaySystem)
  };
}

function resolveRawSizes(values, displaySystem) {
  const candidateSizes = Array.isArray(values?.sizes) && values.sizes.length
    ? values.sizes
    : DEFAULT_SIZE_LABELS;

  return candidateSizes
    .map((rawSize, index) => createCanonicalSize(rawSize, index, displaySystem))
    .filter((size) => size.id);
}

function findSizeByReference(sizes, value) {
  const normalized = normalizeValue(value);
  if (!normalized) return null;

  return sizes.find((size) => normalizeValue(size.id) === normalized)
    || sizes.find((size) => Object.values(size.references || {}).some((reference) => normalizeValue(reference) === normalized))
    || null;
}

function getExistingMeasurementValue(rowValues = {}, size) {
  if (Object.prototype.hasOwnProperty.call(rowValues, size.id)) {
    return rowValues[size.id];
  }

  const referenceValues = Object.values(size.references || {});
  for (const reference of referenceValues) {
    if (Object.prototype.hasOwnProperty.call(rowValues, reference)) {
      return rowValues[reference];
    }
  }

  if (Object.prototype.hasOwnProperty.call(rowValues, size.label)) {
    return rowValues[size.label];
  }

  return '';
}

function createDefaultMeasurementRows(sizes) {
  return [
    'Bust',
    'Waist',
    'Hip',
    'Shoulder',
    'Back Length',
    'Sleeve Length'
  ].map((label, index) => ({
    id: `pom-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`,
    code: `POM-${String(index + 1).padStart(2, '0')}`,
    label,
    values: sizes.reduce((result, size) => ({
      ...result,
      [size.id]: ''
    }), {})
  }));
}

function normalizeMeasurementRows(rawRows, sizes) {
  const rows = Array.isArray(rawRows) && rawRows.length
    ? rawRows
    : createDefaultMeasurementRows(sizes);

  return rows.map((row, index) => ({
    id: row.id || `pom-${index + 1}`,
    code: row.code || `POM-${String(index + 1).padStart(2, '0')}`,
    label: row.label || row.name || `Measurement ${index + 1}`,
    values: sizes.reduce((result, size) => ({
      ...result,
      [size.id]: getExistingMeasurementValue(row.values || {}, size)
    }), {})
  }));
}

export function getPreferredSizeReference(size, displaySystem = 'ALPHA') {
  const system = normalizeSizeSystemCode(displaySystem);
  const references = size?.references || {};

  return String(
    references[system] ||
    references.ALPHA ||
    Object.values(references).find(Boolean) ||
    size?.label ||
    size?.id ||
    ''
  ).trim();
}

export function formatMeasurementSizeRange(sizes = []) {
  const labels = sizes.map((size) => String(size || '').trim()).filter(Boolean);
  if (!labels.length) return '';
  if (labels.length === 1) return labels[0];
  return `${labels[0]}-${labels[labels.length - 1]}`;
}

export function getDisplaySizeReferences(chart, displaySystem = chart?.displaySystem || 'ALPHA') {
  return (chart?.sizes || []).map((size) => getPreferredSizeReference(size, displaySystem)).filter(Boolean);
}

export function getCustomerSizeSystems(chart, metadata) {
  const systems = getMeasurementSizeSystems(metadata);
  return systems.reduce((result, system) => {
    const sizes = getDisplaySizeReferences(chart, system.code);
    const hasExplicitReferences = (chart?.sizes || []).some((size) => size.references?.[system.code]);

    if (!sizes.length || !hasExplicitReferences) {
      return result;
    }

    return {
      ...result,
      [system.code]: {
        label: system.label,
        type: 'measurement-chart-reference',
        sizes,
        displayRange: formatMeasurementSizeRange(sizes),
        basis: 'Variant Measurement Chart'
      }
    };
  }, {});
}

export function resolveBaseSize(chart, fallbackReference = '') {
  const sizes = chart?.sizes || [];
  return sizes.find((size) => size.id === chart?.baseSizeId)
    || findSizeByReference(sizes, fallbackReference)
    || sizes[0]
    || null;
}

export function resolveBaseSizeReference(chart, displaySystem = chart?.displaySystem || 'ALPHA', fallbackReference = '') {
  const size = resolveBaseSize(chart, fallbackReference);
  return size ? getPreferredSizeReference(size, displaySystem) : '';
}

export function normalizeMeasurementChartValues(values = {}, variantValues = {}, metadata, styleValues = {}) {
  const displaySystem = normalizeSizeSystemCode(
    values.displaySystem ||
    values.sizeSystem ||
    variantValues['variant.size_system'] ||
    'ALPHA'
  );
  const sizes = resolveRawSizes(values, displaySystem);
  const baseSize = values.baseSizeId
    ? sizes.find((size) => size.id === values.baseSizeId)
    : findSizeByReference(sizes, values.baseReferenceSize || variantValues['variant.base_reference_size']);
  const baseSizeId = baseSize?.id || sizes[0]?.id || '';
  const unit = values.unit === 'inch' ? 'in' : values.unit || 'cm';

  const revisionNumber = Math.max(
    1,
    Number(values.revisionNumber || 1)
  );
  const fitProfile = normalizeFitProfileValues(
    values.fitProfile || {},
    styleValues,
    metadata
  );

  const status = normalizeMeasurementChartApprovalStatus(
    values.status || values.workflow?.status,
    'DRAFT'
  );

  return {
    ...values,
    version:
      values.version ||
      MEASUREMENT_CHART_VERSION,
    revisionNumber,
    revisionLabel:
      values.revisionLabel ||
      `V${revisionNumber}`,
    status,
    workflow: {
      ...(values.workflow || {}),
      status,
      history: Array.isArray(values.workflow?.history)
        ? cloneSerializable(values.workflow.history, [])
        : []
    },
    displaySystem,
    unit,
    baseSizeId,
    sizes,
    sizingSystems: getMeasurementSizeSystems(metadata),
    measurements: normalizeMeasurementRows(values.measurements, sizes),
    fitProfile,
    garmentMeasurements: normalizeFinishedGarmentMeasurements(
      values.garmentMeasurements || {},
      sizes,
      fitProfile
    )
  };
}

export function createDefaultMeasurementChartValues(sizeLabels = DEFAULT_SIZE_LABELS, options = {}) {
  const displaySystem = normalizeSizeSystemCode(options.displaySystem || 'ALPHA');
  const sizes = sizeLabels.map((label, index) => createCanonicalSize(label, index, displaySystem));
  const baseSize = findSizeByReference(sizes, options.baseReferenceLabel || 'M') || sizes[0];

  const fitProfile = normalizeFitProfileValues(
    options.fitProfile || {},
    options.styleValues || {},
    options.metadata
  );

  return {
    version: MEASUREMENT_CHART_VERSION,
    revisionNumber: 1,
    revisionLabel: 'V1',
    revisionHistory: [],
    status: 'DRAFT',
    workflow: {
      status: 'DRAFT',
      history: []
    },
    displaySystem,
    unit: options.unit || 'cm',
    baseSizeId: baseSize?.id || '',
    sizes,
    sizingSystems: getMeasurementSizeSystems(options.metadata),
    measurements: createDefaultMeasurementRows(sizes),
    fitProfile,
    garmentMeasurements: normalizeFinishedGarmentMeasurements(
      options.garmentMeasurements || {},
      sizes,
      fitProfile
    )
  };
}

function buildMeasurementRevisionSnapshot(chart = {}) {
  const revisionNumber = Math.max(
    1,
    Number(chart.revisionNumber || 1)
  );

  return {
    revisionNumber,
    revisionLabel:
      chart.revisionLabel || `V${revisionNumber}`,
    status:
      normalizeMeasurementChartApprovalStatus(
        chart.status || chart.workflow?.status,
        'DRAFT'
      ),
    workflow:
      cloneSerializable(chart.workflow || {}, {}),
    displaySystem:
      chart.displaySystem || 'ALPHA',
    unit:
      chart.unit || 'cm',
    baseSizeId:
      chart.baseSizeId || '',
    sizes:
      JSON.parse(
        JSON.stringify(chart.sizes || [])
      ),
    measurements:
      JSON.parse(
        JSON.stringify(chart.measurements || [])
      ),
    garmentMeasurements:
      cloneSerializable(chart.garmentMeasurements || {}, {}),
    fitProfile:
      cloneSerializable(chart.fitProfile || {}, {}),
    revisionReason:
      chart.revisionReason || '',
    createdAt:
      chart.revisedAt ||
      chart.createdAt ||
      new Date().toISOString()
  };
}

export function createMeasurementChartRevision(
  chart = {},
  changes = {}
) {
  const currentRevision = Math.max(
    1,
    Number(chart.revisionNumber || 1)
  );

  const revisionNumber =
    currentRevision + 1;

  const existingHistory =
    Array.isArray(chart.revisionHistory)
      ? chart.revisionHistory
      : [];

  const previousSnapshot =
    buildMeasurementRevisionSnapshot(chart);

  const historyHasCurrent =
    existingHistory.some(
      (item) =>
        Number(item.revisionNumber) ===
        currentRevision
    );

  const revisedAt =
    new Date().toISOString();

  const previousStatus =
    normalizeMeasurementChartApprovalStatus(
      chart.status || chart.workflow?.status,
      'DRAFT'
    );

  const revisionEvent = {
    id: `measurement-revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action: 'CREATE_REVISION',
    from: previousStatus,
    to: 'DRAFT',
    basedOnRevisionNumber: currentRevision,
    basedOnRevisionLabel:
      chart.revisionLabel || `V${currentRevision}`,
    at: revisedAt
  };

  return {
    ...chart,
    ...changes,

    revisionNumber,

    revisionLabel:
      `V${revisionNumber}`,

    revisionHistory:
      historyHasCurrent
        ? existingHistory
        : [
            ...existingHistory,
            previousSnapshot
          ],

    status: 'DRAFT',

    workflow: {
      status: 'DRAFT',
      history: [revisionEvent],
      basedOnRevisionNumber: currentRevision,
      basedOnRevisionLabel:
        chart.revisionLabel || `V${currentRevision}`,
      createdAt: revisedAt
    },

    revisedAt
  };
}
