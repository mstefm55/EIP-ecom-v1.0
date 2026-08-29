import { perfectFitMetadata } from '../config/perfectFitMetadata';
import {
  BLOG_POST_SEED,
  CATALOG_PRODUCT_SEED,
  COLLABORATOR_INVENTORY_SEED,
  COLLABORATOR_PROJECT_SEED,
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
  WORKSPACE_SEED
} from '../data/runtimeSeeds';
import {
  configureRuntimeRepositories,
  configureRuntimeStorageDomains,
  createLocalCollectionRepository,
  createLocalValueRepository,
  createRepositoryRegistry
} from './runtimeDataGateway';

const seeds = {
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
  industrialTechPacks: INDUSTRIAL_TECH_PACK_SEED
};

const browserStorage = () => (typeof window !== 'undefined' ? window.localStorage : null);

/** Preserve existing browser records when consolidating legacy storage keys. */
export function migrateLegacyRuntimeStorage(metadata = perfectFitMetadata) {
  const storage = browserStorage();
  if (!storage) return [];
  const migrations = [];

  Object.entries(metadata.runtimeData?.domains || {}).forEach(([domain, contract]) => {
    const canonicalKey = contract?.storageKey;
    if (!canonicalKey || storage.getItem(canonicalKey) !== null) return;

    for (const legacyKey of contract?.legacyKeys || []) {
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

export function createDefaultRuntimeRepositoryRegistry(metadata = perfectFitMetadata) {
  const contracts = metadata.runtimeData?.domains || {};
  migrateLegacyRuntimeStorage(metadata);
  configureRuntimeStorageDomains(contracts);

  const repositories = {};
  Object.entries(contracts).forEach(([domain, contract]) => {
    const common = {
      domain,
      storageKey: contract.storageKey,
      seed: seeds[domain] ?? (contract.shape === 'collection' ? [] : null)
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
