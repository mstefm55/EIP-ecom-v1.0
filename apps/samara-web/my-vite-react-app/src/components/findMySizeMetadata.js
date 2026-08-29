import { perfectFitMetadata } from '../config/perfectFitMetadata';

export const findMySizeMetadata = perfectFitMetadata.findMySize;
const workspaceMetadata = perfectFitMetadata.workspace;

const replaceParams = (text, params = {}) =>
  String(text ?? '').replace(/\{([^}]+)\}/g, (_, key) =>
    params[key] === undefined || params[key] === null ? `{${key}}` : String(params[key])
  );

export function resolveFindMySizeLocale(locale) {
  const requested = String(locale || '').trim();
  if (requested && findMySizeMetadata.localePacks[requested]) return requested;
  const language = requested.split('-')[0];
  if (language && findMySizeMetadata.localePacks[language]) return language;
  return findMySizeMetadata.defaultLocale;
}

export function createFindMySizeTranslator(locale) {
  const resolvedLocale = resolveFindMySizeLocale(locale);
  const ownPack = findMySizeMetadata.localePacks[resolvedLocale] || findMySizeMetadata.localePacks.en;
  const workspacePack = workspaceMetadata.localePacks?.[resolvedLocale] || workspaceMetadata.localePacks?.en || {};

  return (key, params = {}, fallback = '') => {
    const value = ownPack[key] ?? workspacePack[key] ?? fallback ?? key;
    return replaceParams(value, params);
  };
}

export function getFindMySizeMeasurementGuides(locale) {
  const t = createFindMySizeTranslator(locale);
  return findMySizeMetadata.measurements.map((item) => ({
    ...item,
    marker: String(item.order),
    label: t(`measurement.${item.code}.label`, {}, item.code),
    shortLabel: t(`measurement.${item.code}.short`, {}, item.code),
    instruction: t(`measurement.${item.code}.instruction`),
    tapeHelp: t(`measurement.${item.code}.tape`),
    mistake: t(`measurement.${item.code}.mistake`)
  }));
}

export function getWorkspaceDropdownOptions(listCode, locale) {
  const t = createFindMySizeTranslator(locale);
  const rows = workspaceMetadata.dropdowns?.[listCode] || [];
  return rows.map((row) => ({
    code: row.code,
    label: t(row.labelKey, {}, row.eipV1Value || row.code)
  }));
}
