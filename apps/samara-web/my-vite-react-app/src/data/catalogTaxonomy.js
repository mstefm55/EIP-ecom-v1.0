import { perfectFitMetadata } from '../config/perfectFitMetadata';

const taxonomy = perfectFitMetadata.catalog.taxonomy;
export const PRODUCT_STATUS = taxonomy.productStatus;
export const CATEGORY_REQUEST_STATUS = taxonomy.categoryRequestStatus;
export const CATALOG_AUDIENCES = taxonomy.audiences;
export const DEFAULT_COLLECTION_TAGS = taxonomy.collectionTags;
export const DEFAULT_DESIGNER_BRANDS = taxonomy.designerBrands;

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

export function getCategoriesForAudience(audienceId) {
  const audience = getAudienceById(audienceId);
  return audience?.categories || [];
}

export function getCategoryLabel(audienceId, categoryId) {
  const categories = getCategoriesForAudience(audienceId);
  return categories.find((category) => category.id === categoryId)?.label || categoryId;
}

export function getAudienceLabel(audienceId) {
  return getAudienceById(audienceId)?.label || audienceId;
}
