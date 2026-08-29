import {
  PERFECTFIT_LOCALE_STORAGE_KEY,
  perfectFitMetadata
} from '../config/perfectFitMetadata';

const interpolate = (value, params = {}) =>
  String(value).replace(/\{([^}]+)\}/g, (match, token) => {
    const key = token.trim();
    return Object.prototype.hasOwnProperty.call(params, key)
      ? String(params[key])
      : match;
  });

const readableKeyFallback = (key) =>
  String(key || '')
    .split('.')
    .filter(Boolean)
    .pop()
    ?.replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) ||
  '';

export const getPerfectFitLanguages = (metadata = perfectFitMetadata) =>
  Array.isArray(metadata?.i18n?.languages) && metadata.i18n.languages.length
    ? metadata.i18n.languages
    : [{ code: 'en', labelKey: 'language.en', nativeLabel: 'English' }];

export const isSupportedPerfectFitLocale = (locale, metadata = perfectFitMetadata) => {
  const requested = String(locale || '').trim();
  if (!requested) return false;

  const supported = new Set(getPerfectFitLanguages(metadata).map((language) => language.code));
  if (supported.has(requested)) return true;

  const base = requested.split('-')[0];
  return supported.has(base);
};

export const resolvePerfectFitLocale = (locale, metadata = perfectFitMetadata) => {
  const defaultLocale = metadata?.i18n?.defaultLocale || 'en';
  const requested = String(locale || '').trim();
  const supported = new Set(getPerfectFitLanguages(metadata).map((language) => language.code));

  if (supported.has(requested)) return requested;

  const base = requested.split('-')[0];
  if (supported.has(base)) return base;

  return supported.has(defaultLocale) ? defaultLocale : 'en';
};

export const getStoredPerfectFitLocale = (metadata = perfectFitMetadata) => {
  if (typeof window === 'undefined') {
    return resolvePerfectFitLocale(metadata?.i18n?.defaultLocale || 'en', metadata);
  }

  try {
    const stored = window.localStorage?.getItem(
      metadata?.i18n?.storageKey || PERFECTFIT_LOCALE_STORAGE_KEY
    );
    return resolvePerfectFitLocale(stored, metadata);
  } catch {
    return resolvePerfectFitLocale(metadata?.i18n?.defaultLocale || 'en', metadata);
  }
};

export const persistPerfectFitLocale = (locale, metadata = perfectFitMetadata) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage?.setItem(
      metadata?.i18n?.storageKey || PERFECTFIT_LOCALE_STORAGE_KEY,
      resolvePerfectFitLocale(locale, metadata)
    );
  } catch {}
};

export const translatePerfectFitKey = (
  key,
  params = {},
  options = {},
  metadata = perfectFitMetadata
) => {
  const requestedLocale = resolvePerfectFitLocale(options.locale, metadata);
  const localePacks = metadata?.i18n?.localePacks || {};
  const baseLocale = requestedLocale.split('-')[0];
  const defaultLocale = metadata?.i18n?.defaultLocale || 'en';

  const value =
    localePacks[requestedLocale]?.[key] ??
    localePacks[baseLocale]?.[key] ??
    localePacks[defaultLocale]?.[key] ??
    localePacks.en?.[key] ??
    options.fallback ??
    readableKeyFallback(key);

  return interpolate(value, params);
};

export const translatePerfectFitText = (key, params = {}, fallback = undefined) =>
  translatePerfectFitKey(
    key,
    params,
    {
      locale: getStoredPerfectFitLocale(perfectFitMetadata),
      fallback
    },
    perfectFitMetadata
  );

export const getLocaleCoverage = (metadata = perfectFitMetadata) => {
  const localePacks = metadata?.i18n?.localePacks || {};
  const englishKeys = Object.keys(localePacks.en || {});

  return getPerfectFitLanguages(metadata).map((language) => {
    const keys = Object.keys(localePacks[language.code] || {});
    const keySet = new Set(keys);
    const missingKeys = englishKeys.filter((key) => !keySet.has(key));

    return {
      locale: language.code,
      keys: keys.length,
      englishKeys: englishKeys.length,
      missingKeys
    };
  });
};
