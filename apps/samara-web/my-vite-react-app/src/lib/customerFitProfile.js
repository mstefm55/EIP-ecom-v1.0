import { toCentimeters } from './fitRecommendation';
import { createClientRecordId, runtimeDataStorage } from './runtimeDataGateway';

export const CUSTOMER_BODY_PROFILE_VERSION = 'customer-body-profile-v1';
export const CUSTOMER_BODY_PROFILE_KEY = 'perfectfit_customer_body_profile_v1';
export const CUSTOMER_BODY_PROFILE_UPDATED_EVENT = 'perfectfit_customer_body_profile_updated';

export const CUSTOMER_FIT_HISTORY_VERSION = 'customer-fit-history-v1';
export const CUSTOMER_FIT_HISTORY_KEY = 'perfectfit_customer_fit_history_v1';
export const CUSTOMER_FIT_HISTORY_UPDATED_EVENT = 'perfectfit_customer_fit_history_updated';

const LEGACY_BODY_PROFILE_KEY = 'sartorial_sizing_profile';
const MAX_ACCEPTED_RECOMMENDATIONS = 50;

const nowIso = () => new Date().toISOString();

const safeParse = (raw, fallback = null) => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const emit = (eventName, detail) => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  } catch {}
};

const normalizeMeasurementMap = (measurements = {}) => {
  if (!measurements || typeof measurements !== 'object') return {};

  return Object.entries(measurements).reduce((result, [code, raw]) => {
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) {
      result[String(code || '').trim().toUpperCase()] = value;
    }
    return result;
  }, {});
};

function migrateLegacyBodyProfile() {
  if (typeof window === 'undefined') return null;

  const legacy = safeParse(runtimeDataStorage.getItem(LEGACY_BODY_PROFILE_KEY));
  if (!legacy || typeof legacy !== 'object') return null;

  const sourceUnit = legacy.unit === 'cm' ? 'cm' : 'in';
  const measurementsCm = {};
  const legacyMap = {
    neck: 'NECK',
    shoulder: 'SHOULDER',
    bust: 'BUST',
    frontWaist: 'FRONT_WAIST_LENGTH',
    waist: 'WAIST',
    hips: 'HIP',
    inseam: 'INSEAM',
    height: 'HEIGHT'
  };

  Object.entries(legacyMap).forEach(([legacyKey, measurementCode]) => {
    const converted = toCentimeters(legacy?.[legacyKey], sourceUnit);
    if (Number.isFinite(converted) && converted > 0) {
      measurementsCm[measurementCode] = converted;
    }
  });

  if (!Object.keys(measurementsCm).length) return null;

  return {
    version: CUSTOMER_BODY_PROFILE_VERSION,
    unit: sourceUnit,
    measurementsCm,
    selectedProductId: '',
    migratedFrom: LEGACY_BODY_PROFILE_KEY,
    createdAt: legacy.timestamp || nowIso(),
    updatedAt: nowIso()
  };
}

export function loadCustomerBodyProfile() {
  if (typeof window === 'undefined') {
    return {
      version: CUSTOMER_BODY_PROFILE_VERSION,
      unit: 'in',
      measurementsCm: {},
      selectedProductId: '',
      createdAt: null,
      updatedAt: null
    };
  }

  const current = safeParse(runtimeDataStorage.getItem(CUSTOMER_BODY_PROFILE_KEY));

  if (current && typeof current === 'object') {
    return {
      ...current,
      version: CUSTOMER_BODY_PROFILE_VERSION,
      unit: current.unit === 'cm' ? 'cm' : 'in',
      measurementsCm: normalizeMeasurementMap(current.measurementsCm),
      selectedProductId: String(current.selectedProductId || '')
    };
  }

  const migrated = migrateLegacyBodyProfile();
  if (migrated) {
    saveCustomerBodyProfile(migrated);
    return migrated;
  }

  return {
    version: CUSTOMER_BODY_PROFILE_VERSION,
    unit: 'in',
    measurementsCm: {},
    selectedProductId: '',
    createdAt: null,
    updatedAt: null
  };
}

export function saveCustomerBodyProfile(profile = {}) {
  const existing =
    typeof window !== 'undefined'
      ? safeParse(runtimeDataStorage.getItem(CUSTOMER_BODY_PROFILE_KEY), {}) || {}
      : {};

  const next = {
    ...existing,
    ...profile,
    version: CUSTOMER_BODY_PROFILE_VERSION,
    unit: profile.unit === 'cm' ? 'cm' : existing.unit === 'cm' ? 'cm' : 'in',
    measurementsCm: normalizeMeasurementMap(
      profile.measurementsCm !== undefined
        ? profile.measurementsCm
        : existing.measurementsCm
    ),
    selectedProductId: String(
      profile.selectedProductId !== undefined
        ? profile.selectedProductId || ''
        : existing.selectedProductId || ''
    ),
    createdAt: existing.createdAt || profile.createdAt || nowIso(),
    updatedAt: nowIso()
  };

  if (typeof window !== 'undefined') {
    try {
      runtimeDataStorage.setItem(CUSTOMER_BODY_PROFILE_KEY, JSON.stringify(next));
    } catch {}
    emit(CUSTOMER_BODY_PROFILE_UPDATED_EVENT, next);
  }

  return next;
}

export function clearCustomerBodyProfile() {
  if (typeof window !== 'undefined') {
    try {
      runtimeDataStorage.removeItem(CUSTOMER_BODY_PROFILE_KEY);
    } catch {}
    emit(CUSTOMER_BODY_PROFILE_UPDATED_EVENT, null);
  }
}

export function loadCustomerFitHistory() {
  if (typeof window === 'undefined') {
    return {
      version: CUSTOMER_FIT_HISTORY_VERSION,
      acceptedRecommendations: [],
      updatedAt: null
    };
  }

  const parsed = safeParse(runtimeDataStorage.getItem(CUSTOMER_FIT_HISTORY_KEY));
  const acceptedRecommendations = Array.isArray(parsed?.acceptedRecommendations)
    ? parsed.acceptedRecommendations
    : [];

  return {
    version: CUSTOMER_FIT_HISTORY_VERSION,
    acceptedRecommendations,
    updatedAt: parsed?.updatedAt || null
  };
}

function buildCanonicalSizeSnapshot(size = {}, recommendation = {}) {
  return {
    id: String(size?.id || ''),
    label: String(
      recommendation?.label ||
      size?.label ||
      size?.id ||
      ''
    ),
    references: {
      ...(size?.references || size?.refs || {})
    }
  };
}

export function recordAcceptedFitRecommendation({
  result,
  specification,
  pattern,
  measurementsCm = {},
  unit = 'in'
} = {}) {
  const recommendation = result?.recommendation;
  const canonicalSize = recommendation?.size;

  if (!recommendation || !canonicalSize) return null;

  const existingHistory = loadCustomerFitHistory();
  const acceptedAt = nowIso();
  const entry = {
    id: createClientRecordId('fit-accepted'),
    product: {
      id: String(pattern?.id || specification?.productId || ''),
      name: String(pattern?.name || pattern?.title || specification?.productName || '')
    },
    recommendation: {
      canonicalSize: buildCanonicalSizeSnapshot(canonicalSize, recommendation),
      confidence: String(result?.confidence || ''),
      controllingMeasurementCode: String(recommendation?.controllingMeasurementCode || ''),
      fitSource: String(result?.specificationSource || specification?.source || ''),
      measurementChartRevision: String(
        specification?.measurementChart?.revisionLabel ||
        specification?.measurementChart?.revisionNumber ||
        ''
      ),
      fitProfileRevision: String(
        specification?.measurementChart?.fitProfile?.revisionLabel ||
        specification?.measurementChart?.fitProfile?.revisionNumber ||
        ''
      )
    },
    bodyProfileSnapshot: {
      unit: unit === 'cm' ? 'cm' : 'in',
      measurementsCm: normalizeMeasurementMap(measurementsCm)
    },
    acceptedAt
  };

  const next = {
    version: CUSTOMER_FIT_HISTORY_VERSION,
    acceptedRecommendations: [
      entry,
      ...existingHistory.acceptedRecommendations
    ].slice(0, MAX_ACCEPTED_RECOMMENDATIONS),
    updatedAt: acceptedAt
  };

  if (typeof window !== 'undefined') {
    try {
      runtimeDataStorage.setItem(CUSTOMER_FIT_HISTORY_KEY, JSON.stringify(next));
    } catch {}
    emit(CUSTOMER_FIT_HISTORY_UPDATED_EVENT, next);
  }

  return entry;
}
