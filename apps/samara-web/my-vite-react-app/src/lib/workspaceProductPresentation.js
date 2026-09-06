import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { runtimeDataStorage } from './runtimeDataGateway';
import {
  getCustomerSizeSystems,
  getDisplaySizeReferences,
  normalizeMeasurementChartValues,
  resolveBaseSizeReference
} from './measurementChart';

export const WORKSPACE_PRESENTATION_UPDATED_EVENT = 'perfectfit_workspace_product_presentation_updated';
const workspaceMetadata = perfectFitMetadata.workspace;

export const getWorkspacePresentationStorageKey = (metadata = workspaceMetadata) =>
  metadata.storageKey || `perfectfit_workspace_data_${metadata.version || 'v1'}`;

const asArray = (value) => (Array.isArray(value) ? value : []);

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeUsernameToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9._-]+/g, '')
    .slice(0, 40);

const labelize = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const translate = (metadata, key) => {
  if (!key) return '';
  const locale = metadata?.defaultLocale || 'en';
  return metadata?.localePacks?.[locale]?.[key] || key;
};

export const getWorkspaceDropdownLabel = (metadata, listKey, code) => {
  if (!code) return '';
  const option = asArray(metadata?.dropdowns?.[listKey]).find(
    (item) => item.code === code || item.eipV1Value === code
  );

  return option?.eipV1Value || translate(metadata, option?.labelKey) || labelize(code);
};

export function loadWorkspacePresentationData(metadata = workspaceMetadata) {
  const storageKey = getWorkspacePresentationStorageKey(metadata);

  if (typeof window !== 'undefined') {
    try {
      const saved = runtimeDataStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch {}
  }

  return {
    version: metadata.version,
    selectedLocale: metadata.defaultLocale,
    projects: [],
    auditLog: [],
    collaboration: { grants: [] }
  };
}

function findChild(node, nodeType) {
  return asArray(node?.children).find((child) => child.nodeType === nodeType) || null;
}

function formatSizeRange(sizes) {
  if (!sizes.length) return '';
  if (sizes.length === 1) return sizes[0];
  return `${sizes[0]}-${sizes[sizes.length - 1]}`;
}

function mainCategoryFromWorkspace(categoryCode, categoryLabel) {
  const code = normalizeToken(categoryCode);
  if (code === 'dress') return 'dresses';
  if (code === 'top') return 'tops';
  if (code === 'skirt') return 'skirts';
  if (code === 'trouser' || code === 'pant' || code === 'pants') return 'pants-shorts';
  if (code === 'coat' || code === 'outerwear') return 'coats-capes';
  return normalizeToken(categoryLabel) || 'dresses';
}

function resolveWorkspaceMessagingOwner(project = {}, projectValues = {}) {
  const ownership = project.ownership || {};
  const designerCode =
    projectValues['project.designer_code'] ||
    ownership.ownerLogin ||
    ownership.ownerName ||
    project.id ||
    'perfect-fit-bureau';
  const routingId =
    ownership.ownerIdentityId ||
    projectValues['project.owner_identity_id'] ||
    `agent:designer-${normalizeToken(designerCode) || 'perfect-fit-bureau'}`;
  const username =
    normalizeUsernameToken(
      ownership.ownerUsername ||
      ownership.ownerLogin ||
      projectValues['project.owner_username'] ||
      designerCode ||
      'perfectfitbureau'
    ) || 'perfectfitbureau';
  const brandName =
    ownership.ownerBrandName ||
    projectValues['project.brand_name'] ||
    projectValues['project.studio_name'] ||
    'Perfect Fit Bureau';

  return {
    id: routingId,
    routingId,
    username,
    brandName,
    role: 'designer',
    roleLabel: 'Designer',
    displayLabel: brandName
  };
}

function pickVisibleMediaAssets(mediaNode) {
  const mediaValues = mediaNode?.values || {};
  const assets = asArray(mediaValues.assets);
  const slots = mediaValues.slots || {};
  const visibleAssets = assets.filter((asset) => asset.customerVisible !== false);
  const byId = new Map(visibleAssets.map((asset) => [asset.id, asset]));
  const primaryAsset =
    byId.get(slots.primaryAssetId) ||
    visibleAssets.find((asset) => asset.profileId === 'product-card') ||
    visibleAssets.find((asset) => asset.profileId === 'product-gallery') ||
    visibleAssets[0] ||
    null;
  const orderedAssets = [
    primaryAsset,
    ...visibleAssets.filter((asset) => asset.id !== primaryAsset?.id)
  ].filter(Boolean);
  const technicalSketchAsset =
    byId.get(slots.technicalSketchAssetId) ||
    visibleAssets.find((asset) => {
      const assetType = normalizeToken(asset.type);
      const profileId = normalizeToken(asset.profileId);
      const label = normalizeToken(
        [
          asset.title,
          asset.fileName,
          asset.referenceCode,
          asset.label
        ].filter(Boolean).join(' ')
      );

      if (
        assetType === 'pattern-layout' ||
        assetType === 'layout' ||
        profileId === 'pattern-layout' ||
        profileId === 'layout'
      ) {
        return false;
      }

      return (
        assetType === 'technical-sketch' ||
        assetType === 'technical-drawing' ||
        profileId === 'technical-sketch' ||
        profileId === 'technical-drawing' ||
        label.includes('technical-sketch') ||
        label.includes('technical-drawing') ||
        label.includes('flat-sketch')
      );
    }) ||
    null;

  return {
    slots,
    primaryAsset,
    technicalSketchAsset,
    galleryAssets: orderedAssets,
    visibleAssets
  };
}

function getCommerceKeys(pattern) {
  return new Set(
    [
      pattern?.workspaceVariantId,
      pattern?.variantId,
      pattern?.variant_id,
      pattern?.variantCode,
      pattern?.variantReference,
      pattern?.reference,
      pattern?.productReference,
      pattern?.styleCode,
      pattern?.styleReference,
      pattern?.sku,
      pattern?.id
    ]
      .filter(Boolean)
      .map((value) => String(value))
  );
}

function findCommerceOverlay(presentation, commercePatterns, usedPatternIds) {
  const stableKeys = new Set(
    [
      presentation.variantId,
      presentation.reference,
      presentation.variantReference,
      presentation.styleReference,
      presentation.productReference
    ]
      .filter(Boolean)
      .map((value) => String(value))
  );

  const stableMatch = commercePatterns.find((pattern) => {
    if (!pattern || usedPatternIds.has(pattern.id)) return false;
    const commerceKeys = getCommerceKeys(pattern);
    return [...stableKeys].some((key) => commerceKeys.has(key));
  });

  if (stableMatch) return stableMatch;

  // Temporary bridge for the legacy static seed catalogue, which has no Workspace variant ids yet.
  // This is deliberately a fallback only; stable variant id/code matches win above.
  const nameToken = normalizeToken(presentation.styleName || presentation.name);
  const categoryToken = normalizeToken(presentation.category);
  return commercePatterns.find((pattern) => {
    if (!pattern || usedPatternIds.has(pattern.id)) return false;
    const patternNameToken = normalizeToken(pattern.name);
    const patternCategoryToken = normalizeToken(pattern.category);
    return patternNameToken === nameToken && (!categoryToken || !patternCategoryToken || patternCategoryToken.includes(categoryToken) || categoryToken.includes(patternCategoryToken));
  }) || null;
}

export function buildWorkspaceProductPresentations(
  workspaceData,
  commercePatterns = [],
  metadata = workspaceMetadata
) {
  const presentations = [];

  asArray(workspaceData?.projects).forEach((project) => {
    if (project?.nodeType !== 'project') return;

    asArray(project.children).forEach((style) => {
      if (style?.nodeType !== 'product') return;

      asArray(style.children).forEach((variant) => {
        if (variant?.nodeType !== 'variant') return;

        const styleValues = style.values || {};
        const variantValues = variant.values || {};
        const projectValues = project.values || {};
        const sizeNode = findChild(variant, 'sizeSet');
        const mediaNode = findChild(variant, 'media');
        const media = pickVisibleMediaAssets(mediaNode);
        const measurementChart = normalizeMeasurementChartValues(sizeNode?.values || {}, variantValues, metadata);
        const sizes = getDisplaySizeReferences(measurementChart, measurementChart.displaySystem).map((size) => String(size));
        const sizeSystems = getCustomerSizeSystems(measurementChart, metadata);
        const defaultSizeSystemKey = sizeSystems[measurementChart.displaySystem]
          ? measurementChart.displaySystem
          : Object.keys(sizeSystems)[0] || measurementChart.displaySystem;
        const categoryCode = styleValues['product.category'];
        const categoryLabel = getWorkspaceDropdownLabel(metadata, 'GARMENT_CATEGORY', categoryCode);
        const difficultyLabel = getWorkspaceDropdownLabel(metadata, 'DIFFICULTY_LEVEL', styleValues['product.difficulty']);
        const fitLabel = getWorkspaceDropdownLabel(metadata, 'FIT_SILHOUETTE', styleValues['product.fit_silhouette']);
        const variantStatusLabel = getWorkspaceDropdownLabel(metadata, 'VARIANT_STATUS', variantValues['variant.status']);
        const developmentStageLabel = getWorkspaceDropdownLabel(metadata, 'PRODUCT_DEVELOPMENT_STAGE', styleValues['product.development_stage']);
        const styleName = styleValues['product.style_name'] || variantValues['variant.name'] || 'Workspace Style';
        const variantName = variantValues['variant.name'] || 'Original';
        const variantCode = variantValues['variant.code'] || variant.id;
        const styleCode = styleValues['product.style_code'] || '';
        const collection = projectValues['project.season'] || '';
        const seoTitle = Object.prototype.hasOwnProperty.call(variantValues, 'variant.seo_title')
          ? String(variantValues['variant.seo_title'] || '')
          : undefined;
        const seoDescription = Object.prototype.hasOwnProperty.call(variantValues, 'variant.seo_description')
          ? String(variantValues['variant.seo_description'] || '')
          : undefined;
        const seoSlug = Object.prototype.hasOwnProperty.call(variantValues, 'variant.seo_slug')
          ? String(variantValues['variant.seo_slug'] || '')
          : undefined;
        const seoKeywordsPresent = Object.prototype.hasOwnProperty.call(variantValues, 'variant.seo_keywords');
        const seoKeywords = seoKeywordsPresent
          ? asArray(variantValues['variant.seo_keywords']).map((item) => String(item).trim()).filter(Boolean)
          : [];
        const messagingOwner = resolveWorkspaceMessagingOwner(project, projectValues);

        presentations.push({
          id: variant.id,
          presentationSource: 'workspace',
          workspaceOwned: true,
          workspaceProjectId: project.id,
          workspaceStyleId: style.id,
          workspaceVariantId: variant.id,
          ownership: {
            ...(project.ownership || {}),
            ownerIdentityId: messagingOwner.routingId
          },
          messagingOwner,
          styleId: style.id,
          variantId: variant.id,
          reference: variantCode,
          variantReference: variantCode,
          productReference: styleCode || variantCode,
          styleReference: styleCode,
          name: styleName,
          styleName,
          variantName,
          category: categoryLabel || labelize(categoryCode) || 'Pattern',
          categoryCode,
          mainCategory: mainCategoryFromWorkspace(categoryCode, categoryLabel),
          collection,
          season: collection,
          designer: projectValues['project.designer_code'] || '',
          designerBrand: 'Perfect Fit Bureau',
          developmentStage: developmentStageLabel,
          status: variantStatusLabel || developmentStageLabel,
          fit: fitLabel,
          silhouette: fitLabel,
          difficulty: difficultyLabel || 'Intermediate',
          description:
            styleValues['product.description'] ||
            variantValues['variant.notes'] ||
            'Workspace-linked pattern variant.',
          tagline: [variantName, fitLabel, collection].filter(Boolean).join(' · '),
          seoTitle,
          seoDescription,
          seoSlug,
          seoKeywordsPresent,
          seoKeywords,
          seo: {
            ...(seoTitle !== undefined ? { title: seoTitle } : {}),
            ...(seoDescription !== undefined ? { description: seoDescription } : {}),
            ...(seoSlug !== undefined ? { slug: seoSlug } : {}),
            ...(seoKeywordsPresent ? { keywords: seoKeywords } : {})
          },
          sizes,
          availableSizes: sizes,
          sizeRangeLabel: formatSizeRange(sizes),
          canonicalSizes: measurementChart.sizes,
          defaultSizeSystemKey,
          sizeSystems,
          baseReferenceSize: resolveBaseSizeReference(
            measurementChart,
            measurementChart.displaySystem,
            variantValues['variant.base_reference_size']
          ),
          measurementChart,
          measurementsTable: asArray(measurementChart.measurements),
          primaryMediaAsset: media.primaryAsset,
          technicalSketchAsset: media.technicalSketchAsset,
          technicalSketchUrl: media.technicalSketchAsset?.url || '',
          galleryMediaAssets: media.galleryAssets,
          customerVisibleMediaCount: media.visibleAssets.length,
          workspaceMediaSlots: media.slots,
          image: media.primaryAsset?.url || '',
          primaryImage: media.primaryAsset?.url || '',
          presentationMediaItems: media.galleryAssets
            .filter((asset) => asset.url)
            .map((asset) => ({
              id: asset.id,
              url: asset.url,
              title: asset.title || asset.fileName || 'Workspace media',
              type: asset.type || 'GARMENT_SAMPLE',
              typeLabel: labelize(asset.type || 'GARMENT_SAMPLE'),
              workspaceAssetId: asset.id
            })),
          stableJoinKeys: [variant.id, variantCode, styleCode].filter(Boolean)
        });
      });
    });
  });

  const usedPatternIds = new Set();

  return presentations.map((presentation) => {
    const commerce = findCommerceOverlay(presentation, commercePatterns, usedPatternIds);
    if (commerce?.id) {
      usedPatternIds.add(commerce.id);
    }

    return {
      ...(commerce || {}),
      ...presentation,
      legacyPatternId: commerce?.id || null,
      commerceOverlayId: commerce?.id || null,
      pricePDF: commerce?.pricePDF ?? commerce?.price ?? presentation.pricePDF ?? 0,
      pricePrinted: commerce?.pricePrinted ?? commerce?.price ?? presentation.pricePrinted ?? 0,
      price: commerce?.price ?? commerce?.pricePDF ?? presentation.price ?? 0,
      currency: commerce?.currency || 'USD',
      rating: commerce?.rating,
      reviewsCount: commerce?.reviewsCount,
      stock: commerce?.stock,
      availability: commerce?.availability,
      audience: commerce?.audience || 'women',
      collectionTags: commerce?.collectionTags || commerce?.tags || [],
      tags: commerce?.tags || commerce?.collectionTags || [],
      seoTitle: presentation.seoTitle !== undefined
        ? presentation.seoTitle
        : commerce?.seoTitle ?? commerce?.seo?.title ?? '',
      seoDescription: presentation.seoDescription !== undefined
        ? presentation.seoDescription
        : commerce?.seoDescription ?? commerce?.seo?.description ?? '',
      seoSlug: presentation.seoSlug !== undefined
        ? presentation.seoSlug
        : commerce?.seoSlug ?? commerce?.seo?.slug ?? '',
      seoKeywords: presentation.seoKeywordsPresent
        ? presentation.seoKeywords
        : commerce?.seoKeywords ?? commerce?.seo?.keywords ?? [],
      seo: {
        ...(commerce?.seo || {}),
        ...(presentation.seo || {})
      },
      image: presentation.image || commerce?.image || '',
      primaryImage: presentation.primaryImage || commerce?.image || '',
      technicalSketchAsset: presentation.technicalSketchAsset || commerce?.technicalSketchAsset || null,
      technicalSketchUrl: presentation.technicalSketchUrl || commerce?.technicalSketchUrl || '',
      presentationMediaItems: presentation.presentationMediaItems?.length
        ? presentation.presentationMediaItems
        : [],
      fabricSuggestions: asArray(commerce?.fabricSuggestions).length
        ? commerce.fabricSuggestions
        : ['Midweight Linen', 'Tencel Twill'],
      yardageInfo: commerce?.yardageInfo || { width44: 'TBC', width60: 'TBC' },
      features: asArray(commerce?.features).length
        ? commerce.features
        : [
            'Workspace-sourced style metadata',
            'Variant Measurement Chart drives customer size references',
            'Customer-visible Workspace Media only'
          ],
      notions: asArray(commerce?.notions),
      tutorial: commerce?.tutorial || {},
      measurementsTable: presentation.measurementsTable,
      sourceBoundary: {
        workspace: [
          'identity',
          'reference',
          'category',
          'collection',
          'difficulty',
          'fit',
          'description',
          'seo',
          'measurement chart',
          'media'
        ],
        commerceOverlay: [
          'price',
          'currency',
          'rating',
          'reviews',
          'stock',
          'audience',
          'sales availability'
        ]
      }
    };
  });
}

export function buildLegacyProductPresentation(pattern) {
  const sizes = asArray(pattern?.sizes).map((size) => String(size));

  return {
    ...pattern,
    presentationSource: pattern?.presentationSource || 'legacy-commerce',
    workspaceOwned: false,
    availableSizes: sizes,
    sizeRangeLabel: pattern?.sizeRangeLabel || formatSizeRange(sizes),
    primaryImage: pattern?.primaryImage || pattern?.image || '',
    technicalSketchAsset: pattern?.technicalSketchAsset || null,
    technicalSketchUrl: pattern?.technicalSketchUrl || '',
    presentationMediaItems: []
  };
}

export function mergeWorkspacePresentationsWithCommerce(
  commercePatterns = [],
  workspacePresentations = []
) {
  const usedLegacyIds = new Set(
    workspacePresentations
      .map((presentation) => presentation.commerceOverlayId || presentation.legacyPatternId)
      .filter(Boolean)
  );

  const legacyRemainder = asArray(commercePatterns)
    .filter((pattern) => !usedLegacyIds.has(pattern.id))
    .map(buildLegacyProductPresentation);

  return [
    ...asArray(workspacePresentations),
    ...legacyRemainder
  ];
}
