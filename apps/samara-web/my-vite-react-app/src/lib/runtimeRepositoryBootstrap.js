import { perfectFitMetadata } from '../config/perfectFitMetadata';
import {
  BLOG_POST_SEED,
  CATALOG_PRODUCT_SEED,
  COLLABORATOR_INVENTORY_SEED,
  COLLABORATOR_PROJECT_SEED,
  COLLABORATOR_SALES_DEMO_TEMPLATES,
  COMMUNITY_POST_SEED,
  CONSULTATION_EXPERT_SEED,
  EDITORIAL_ARTICLE_SEED,
  FABRIC_STASH_SEED,
  INDUSTRIAL_TECH_PACK_SEED,
  MEMBER_DEMO_ACCOUNTS,
  PRINTING_GUIDE_SEED,
  PRODUCT_REVIEW_SEED,
  SUPPLIER_SEED,
  TESTIMONIAL_SEED,
  TIME_LOG_SEED,
  WORKSPACE_SEED,
  createDemoOrderSeed
} from '../data/runtimeSeeds';
import {
  configureRuntimeRepositories,
  configureRuntimeStorageDomains,
  createLocalCollectionRepository,
  createLocalValueRepository,
  createRepositoryRegistry
} from './runtimeDataGateway';

const demoSeeds = {
  catalogProducts: CATALOG_PRODUCT_SEED,
  productReviews: PRODUCT_REVIEW_SEED,
  wishlist: [],
  cart: [],
  orders: [],
  blogPosts: BLOG_POST_SEED,
  communityPosts: COMMUNITY_POST_SEED,
  testimonials: TESTIMONIAL_SEED,
  editorialArticles: EDITORIAL_ARTICLE_SEED,
  consultationExperts: CONSULTATION_EXPERT_SEED,
  consultationBookings: [],
  newsletterSubscriptions: [],
  memberDirectory: Object.values(MEMBER_DEMO_ACCOUNTS),
  userProfile: null,
  productSubmissions: [],
  accessRequests: [],
  projects: COLLABORATOR_PROJECT_SEED,
  archivedProjects: [],
  projectCompanion: {},
  inventory: COLLABORATOR_INVENTORY_SEED,
  suppliers: SUPPLIER_SEED,
  salesHistory: [],
  supplyOrders: [],
  timeLogs: TIME_LOG_SEED,
  timerHistory: [],
  importedPatterns: [],
  patternTags: {},
  fabricStash: FABRIC_STASH_SEED,
  materials: FABRIC_STASH_SEED,
  messages: [],
  messageDirectory: {},
  workspace: WORKSPACE_SEED,
  workspacePublication: {},
  media: [],
  notifications: [],
  userSizingProfile: {},
  projectJournal: {},
  customerBodyProfile: {},
  customerFitHistory: { acceptedRecommendations: [] },
  measurementCalibration: {},
  measurementAdminConfig: {},
  usernameRegistry: {},
  materialPurchaseRequirements: [],
  materialGoodsReceipts: [],
  materialIssues: [],
  shoppingPreferences: {},
  collaboratorSecrets: {},
  analyticsLogs: [],
  printingGuides: PRINTING_GUIDE_SEED,
  industrialTechPacks: INDUSTRIAL_TECH_PACK_SEED,
  commercialPromotions: []
};

const LEGACY_IMPORTED_PATTERN_DEMO_SIGNATURES = new Map([
  ['IMP-001', 'Merchant & Mills Fielder Dress'],
  ['IMP-002', 'The Fold Line Dawn Jeans'],
  ['IMP-003', 'Etsy Modern Linen Boxy Tee']
]);

const WORKSPACE_CART_IMAGE_FIELDS = [
  'image',
  'primaryImage',
  'coverImage',
  'thumbnail',
  'thumbnailUrl',
  'mainImage',
  'imageUrl'
];

const browserStorage = () => (typeof window !== 'undefined' ? window.localStorage : null);

export function isDemoRuntimeDataEnabled(env = import.meta.env) {
  return env?.DEV === true && env?.VITE_PERFECT_FIT_DEMO_DATA === 'true';
}

export function createOptInDemoOrderSeed(env = import.meta.env) {
  return isDemoRuntimeDataEnabled(env) ? createDemoOrderSeed() : [];
}

export function getOptInDemoMemberAccounts(env = import.meta.env) {
  return isDemoRuntimeDataEnabled(env) ? MEMBER_DEMO_ACCOUNTS : {};
}

export function getOptInDemoSalesTemplates(env = import.meta.env) {
  return isDemoRuntimeDataEnabled(env) ? COLLABORATOR_SALES_DEMO_TEMPLATES : {};
}

const emptyValueFor = (contract) => (contract?.shape === 'collection' ? [] : null);

const parseStoredCollection = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.records)) return parsed.records;
  } catch {}
  return null;
};

const isLegacyImportedPatternDemoRecord = (record) => {
  const id = String(record?.id || '').trim();
  const expectedName = LEGACY_IMPORTED_PATTERN_DEMO_SIGNATURES.get(id);
  return Boolean(expectedName && String(record?.name || '').trim() === expectedName);
};

export function removeLegacyImportedPatternDemoRecords(records = []) {
  return (Array.isArray(records) ? records : []).filter(
    (record) => !isLegacyImportedPatternDemoRecord(record)
  );
}

const isWorkspacePattern = (pattern = {}) =>
  pattern?.workspaceOwned === true || pattern?.presentationSource === 'workspace';

const hasWorkspaceCustomerMedia = (pattern = {}) => {
  if (!isWorkspacePattern(pattern)) return true;
  if (Number(pattern.customerVisibleMediaCount || 0) > 0) return true;
  if (pattern.primaryMediaAsset?.id || pattern.primaryMediaAsset?.url) return true;
  if (Array.isArray(pattern.presentationMediaItems) && pattern.presentationMediaItems.length > 0) return true;
  if (Array.isArray(pattern.galleryMediaAssets) && pattern.galleryMediaAssets.length > 0) return true;
  return false;
};

/**
 * A Workspace product owns its customer media. Commerce overlays may contribute
 * price/rating/availability, but an old cart snapshot must never supply a photo
 * when the Workspace variant has no customer-visible media of its own.
 */
export function sanitizeWorkspaceCartMedia(records = []) {
  let changed = false;
  const sanitized = (Array.isArray(records) ? records : []).map((item) => {
    const pattern = item?.pattern;
    if (!isWorkspacePattern(pattern) || hasWorkspaceCustomerMedia(pattern)) return item;

    const nextPattern = { ...pattern };
    WORKSPACE_CART_IMAGE_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(nextPattern, field) && nextPattern[field]) {
        changed = true;
      }
      delete nextPattern[field];
    });

    if (nextPattern.mediaProvenance !== 'WORKSPACE_NONE') {
      nextPattern.mediaProvenance = 'WORKSPACE_NONE';
      changed = true;
    }

    return {
      ...item,
      pattern: nextPattern
    };
  });

  return { records: sanitized, changed };
}

/**
 * Production repair for the old Atelier-library fallback.
 *
 * `sartorial_atelier_imported_patterns` is a personal imported-library domain,
 * not a storefront catalogue source. Older code populated that key with three
 * demo records and the legacy catalogue migration could then copy them into
 * `perfectfit_erp_patterns`. Preserve genuine user imports and catalogue rows,
 * but remove only the exact known demo signatures and initialize the imported
 * library to [] so the legacy component cannot re-seed them in production.
 */
export function sanitizeProductionPatternStorage(metadata = perfectFitMetadata, storage = browserStorage()) {
  if (!storage) return [];
  const contracts = metadata.runtimeData?.domains || {};
  const importedKey = contracts.importedPatterns?.storageKey;
  const catalogKey = contracts.catalogProducts?.storageKey;
  const cartKey = contracts.cart?.storageKey;
  const changes = [];

  if (importedKey) {
    const importedRaw = storage.getItem(importedKey);
    const importedRecords = parseStoredCollection(importedRaw);
    if (importedRaw === null) {
      storage.setItem(importedKey, JSON.stringify([]));
      changes.push({ domain: 'importedPatterns', action: 'initialize_empty', key: importedKey });
    } else if (importedRecords) {
      const sanitized = removeLegacyImportedPatternDemoRecords(importedRecords);
      if (sanitized.length !== importedRecords.length) {
        storage.setItem(importedKey, JSON.stringify(sanitized));
        changes.push({ domain: 'importedPatterns', action: 'remove_legacy_demo_records', key: importedKey });
      }
    }
  }

  if (catalogKey) {
    const catalogRaw = storage.getItem(catalogKey);
    const catalogRecords = parseStoredCollection(catalogRaw);
    if (catalogRecords) {
      const sanitized = removeLegacyImportedPatternDemoRecords(catalogRecords);
      if (sanitized.length !== catalogRecords.length) {
        storage.setItem(catalogKey, JSON.stringify(sanitized));
        changes.push({ domain: 'catalogProducts', action: 'remove_legacy_demo_records', key: catalogKey });
      }
    }
  }

  if (cartKey) {
    const cartRaw = storage.getItem(cartKey);
    const cartRecords = parseStoredCollection(cartRaw);
    if (cartRecords) {
      const { records, changed } = sanitizeWorkspaceCartMedia(cartRecords);
      if (changed) {
        storage.setItem(cartKey, JSON.stringify(records));
        changes.push({ domain: 'cart', action: 'remove_non_workspace_media_fallback', key: cartKey });
      }
    }
  }

  return changes;
}

/** Preserve existing browser records when consolidating legacy storage keys. */
export function migrateLegacyRuntimeStorage(metadata = perfectFitMetadata, storage = browserStorage()) {
  if (!storage) return [];
  const migrations = [];
  const importedPatternStorageKey = metadata.runtimeData?.domains?.importedPatterns?.storageKey || '';

  Object.entries(metadata.runtimeData?.domains || {}).forEach(([domain, contract]) => {
    const canonicalKey = contract?.storageKey;
    if (!canonicalKey || storage.getItem(canonicalKey) !== null) return;

    for (const legacyKey of contract?.legacyKeys || []) {
      // Imported Atelier library records are personal library entries. They must never
      // become storefront catalogue products merely because an old metadata alias listed
      // the same browser key as a catalogue legacy source.
      if (domain === 'catalogProducts' && legacyKey === importedPatternStorageKey) continue;

      const legacyValue = storage.getItem(legacyKey);
      if (legacyValue !== null) {
        storage.setItem(canonicalKey, legacyValue);
        migrations.push({ domain, from: legacyKey, to: canonicalKey });
        break;
      }
    }
  });

  return migrations;
}

export function createDefaultRuntimeRepositoryRegistry(
  metadata = perfectFitMetadata,
  { enableDemoData = isDemoRuntimeDataEnabled(), storage = browserStorage() } = {}
) {
  const contracts = metadata.runtimeData?.domains || {};
  migrateLegacyRuntimeStorage(metadata, storage);
  if (!enableDemoData) {
    sanitizeProductionPatternStorage(metadata, storage);
  }
  configureRuntimeStorageDomains(contracts);

  const repositories = {};
  Object.entries(contracts).forEach(([domain, contract]) => {
    const common = {
      domain,
      storageKey: contract.storageKey,
      storage,
      seed: enableDemoData
        ? (demoSeeds[domain] ?? emptyValueFor(contract))
        : emptyValueFor(contract)
    };

    repositories[domain] =
      contract.shape === 'collection'
        ? createLocalCollectionRepository(common)
        : createLocalValueRepository(common);
  });

  return createRepositoryRegistry(repositories);
}

let defaultRegistry = null;

export function ensureDefaultRuntimeRepositories(metadata = perfectFitMetadata) {
  if (!defaultRegistry) {
    defaultRegistry = createDefaultRuntimeRepositoryRegistry(metadata);
    configureRuntimeRepositories(defaultRegistry);
  }
  return defaultRegistry;
}
