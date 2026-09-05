import { perfectFitMetadata } from '../config/perfectFitMetadata';

const taxonomy = perfectFitMetadata.catalog.taxonomy;
export const PRODUCT_STATUS = taxonomy.productStatus;
export const CATEGORY_REQUEST_STATUS = taxonomy.categoryRequestStatus;
export const CATALOG_AUDIENCES = taxonomy.audiences;
export const DEFAULT_COLLECTION_TAGS = taxonomy.collectionTags;
export const DEFAULT_DESIGNER_BRANDS = taxonomy.designerBrands;

// These remain catalogue filters, not product.category values. Real style
// categories come from the DB-governed PF_GARMENT_CATEGORY list once runtime
// metadata is hydrated.
const CATALOG_FILTER_ONLY_CATEGORY_IDS = new Set([
  'pattern-of-the-day',
  'free-patterns',
  'curve-plus',
  'best-sellers'
]);

export function slugifyCatalogValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getAudienceById(audienceId) {
  return CATALOG_AUDIENCES.find((audience) => audience.id === audienceId) || null;
}

function getGovernedStyleCategoriesForAudience(audienceId) {
  const governed = perfectFitMetadata.workspace?.dropdowns?.GARMENT_CATEGORY;
  if (!Array.isArray(governed) || !governed.length) {
    return [];
  }

  return governed
    .filter((option) => {
      const attrs = option?.attrs || {};
      return (
        attrs.taxonomy_role === 'STYLE_CATEGORY' &&
        attrs.workspace_style_selectable !== false &&
        attrs.catalog_filter_visible !== false &&
        attrs.catalog_audience === audienceId
      );
    })
    .map((option) => {
      const attrs = option.attrs || {};
      const label = option.label || option.eipV1Value || option.code;
      return {
        id: attrs.catalog_category_id || slugifyCatalogValue(label || option.code),
        label,
        governedCode: option.code,
        source: 'EIP_DB',
        sortOrder: Number(attrs.catalog_sort_order ?? option.sortOrder ?? 0)
      };
    })
    .filter((category) => category.id)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export function getCategoriesForAudience(audienceId) {
  const audience = getAudienceById(audienceId);
  const fallbackCategories = audience?.categories || [];
  const governedCategories = getGovernedStyleCategoriesForAudience(audienceId);

  if (!governedCategories.length) {
    return fallbackCategories;
  }

  const governedById = new Map(
    governedCategories.map((category) => [category.id, category])
  );
  const emitted = new Set();
  const categories = [];

  // Preserve the existing catalogue presentation order, but only allow DB
  // governance to define real style/product categories. The four catalogue-only
  // facets remain visible without becoming valid product.category values.
  fallbackCategories.forEach((fallback) => {
    if (CATALOG_FILTER_ONLY_CATEGORY_IDS.has(fallback.id)) {
      categories.push({ ...fallback, source: 'CATALOG_FILTER' });
      return;
    }

    const governed = governedById.get(fallback.id);
    if (!governed) return;

    categories.push(governed);
    emitted.add(governed.id);
  });

  // New DB-governed categories that do not exist in the old bootstrap taxonomy
  // are appended automatically. No frontend release is required to add them.
  governedCategories.forEach((category) => {
    if (!emitted.has(category.id)) {
      categories.push(category);
    }
  });

  return categories;
}

export function getCategoryLabel(audienceId, categoryId) {
  const categories = getCategoriesForAudience(audienceId);
  return categories.find((category) => category.id === categoryId)?.label || categoryId;
}

export function getAudienceLabel(audienceId) {
  return getAudienceById(audienceId)?.label || audienceId;
}
