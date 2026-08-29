import { translatePerfectFitText } from './i18n';

const TRANSLATABLE_FIELDS = new Set([
  'label','title','description','subtitle','help','helpText','placeholder','tooltip','emptyText','emptyState','message','caption','heading','subheading','ariaLabel','alt','name','desc','detail','details','content','callout','badge','basis'
]);

const TRANSLATABLE_STRING_ARRAY_FIELDS = new Set(['items','tips','features','notions','instructions']);

const TECHNICAL_STRING = /^(?:https?:\/\/|data:|blob:|#(?:[0-9a-f]{3,8})$|(?:bg|text|border|ring|shadow|font|tracking|leading|rounded|grid|flex|items|justify|w|h|min|max|aspect|opacity|overflow|absolute|relative|fixed|sticky|z)-|[A-Z][A-Z0-9_./:+-]*$|\d+(?:\.\d+)?(?:px|cm|mm|in|%|x)?$)/i;

const token = (value) => String(value ?? '').trim().replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';

const itemSegment = (value, index) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of ['id','code','value','key']) {
      const candidate = value[key];
      if (typeof candidate === 'string' || typeof candidate === 'number') return token(candidate);
    }
  }
  return String(index);
};

const isTranslatableValue = (field, value) => typeof value === 'string' && TRANSLATABLE_FIELDS.has(field) && /[A-Za-z]{2,}/.test(value) && !TECHNICAL_STRING.test(value.trim());

export const getMetadataTranslationKey = (namespace, path = [], field = '') => [
  'metadata',
  ...String(namespace || '').split('.').filter(Boolean),
  ...path,
  field
].filter(Boolean).map(token).join('.');

export function localizeMetadataTree(value, namespace, translate = translatePerfectFitText, path = [], parentField = '') {
  if (Array.isArray(value)) {
    return value.map((entry, index) => {
      if (typeof entry === 'string' && TRANSLATABLE_STRING_ARRAY_FIELDS.has(parentField) && /[A-Za-z]{2,}/.test(entry) && !TECHNICAL_STRING.test(entry.trim())) {
        return translate(getMetadataTranslationKey(namespace, [...path, String(index)]), {}, entry);
      }
      return localizeMetadataTree(entry, namespace, translate, [...path, itemSegment(entry, index)], parentField);
    });
  }
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [field, fieldValue] of Object.entries(value)) {
    if (isTranslatableValue(field, fieldValue)) {
      result[field] = translate(getMetadataTranslationKey(namespace, path, field), {}, fieldValue);
    } else {
      result[field] = localizeMetadataTree(fieldValue, namespace, translate, [...path, token(field)], field);
    }
  }
  return result;
}

export default localizeMetadataTree;
