import { translatePerfectFitText as pfUiT } from './lib/i18n';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag, Compass, Scissors, Ruler, Printer, BookOpen,
  ArrowRight, Search, Heart, Mail, Check, Star, RefreshCw, LayoutGrid,
  User, Sparkles, Menu, X, ChevronDown, Filter, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Code, Terminal, Copy, Info, Wifi, WifiOff,
  AlertCircle, AlertTriangle, Monitor, Smartphone, ArrowUpDown, Layers,
  Lock, Unlock, Calendar, Archive
} from 'lucide-react';
import CatalogSidebarNavigator from './components/CatalogSidebarNavigator';
import { selectPatternsForSurface, slugifyCatalogValue } from './data/catalogTaxonomy';
import PatternCard from './components/PatternCard';
import PatternImageGallery from './components/PatternImageGallery';
import PatternQuickViewModal from './components/PatternQuickViewModal';
import CheckoutDrawer from './components/CheckoutDrawer';
import WishlistDrawer from './components/WishlistDrawer';
import TrackOrderModal from './components/TrackOrderModal';
import ConsultationBookingModal from './components/ConsultationBookingModal';
import HeroCarousel from './components/HeroCarousel';
import OrbitCarousel from './components/OrbitCarousel';
import MannequinGuide from './components/MannequinGuide';
import CreatorBlog from './components/CreatorBlog';
import EditorialAcademy from './components/EditorialAcademy';
import MemberManagement from './components/MemberManagement';
import MyOrdersSection from './components/MyOrdersSection';
import SewingSessionTimer from './components/SewingSessionTimer';
import CreationsAndFeedback from './components/CreationsAndFeedback';
import MobileAppView from './components/MobileAppView';
import DynamicUiEngine from './components/DynamicUiEngine';
import DynamicLayout from './components/DynamicLayout';
import { RoleProvider } from './context/RoleContext';
import DeveloperIntegrationModal from './components/DeveloperIntegrationModal';
import StayInspiredNewsletter from './components/StayInspiredNewsletter';
import { SkeletonGrid, OrbitCarouselSkeleton } from './components/SkeletonLoader';
import PerfectFitStandards from './components/PerfectFitStandards';
import DynamicGallery from './components/subcomponents/DynamicGallery';
import PerfectFitLayoutController from './components/PerfectFitLayoutController';
import TestimonialCarousel from './components/TestimonialCarousel';
import PerfectFitFaq from './components/PerfectFitFaq';
import FabricStashModal from './components/FabricStashModal';
import AdminControlPanel from './components/AdminControlPanel';
import ModeratorPublicationReviewBar from './components/ModeratorPublicationReviewBar';
import ModeratorPublicationMessenger from './components/ModeratorPublicationMessenger';
import MessageCenterWidget from './components/MessageCenterWidget';
import SignatureOrbitCarouselA from './components/SignatureOrbitCarouselA';
import SignaturePerspectiveStackCarouselB from './components/SignaturePerspectiveStackCarouselB';
import Workspace from './components/Workspace';
import WorkspaceMedia, { loadMediaFile } from './components/workspace/WorkspaceMedia';
import { perfectFitMetadata } from './config/perfectFitMetadata';
import { usePerfectFitLanguage } from './context/LanguageContext';
import { useRuntimeCollectionState, useRuntimeState } from './context/RuntimeDataContext';
import { createOptInDemoOrderSeed, isDemoRuntimeDataEnabled } from './lib/runtimeRepositoryBootstrap';
import { RUNTIME_DOMAINS } from './lib/runtimeDomainContracts';
import { clientPreferences } from './lib/clientPreferences';
import { ProjectFocusWindow } from './components/workspace/ProjectJournal';
import {
  WORKSPACE_PRESENTATION_UPDATED_EVENT,
  buildWorkspaceProductPresentations,
  getWorkspacePresentationStorageKey,
  loadWorkspacePresentationData,
  mergeWorkspacePresentationsWithCommerce
} from './lib/workspaceProductPresentation';
import {
  SURFACE_VISIBILITY_REGISTRY,
  getDefaultSurfaceVisibilityState,
  isSurfaceVisible,
  loadSurfaceVisibilityState,
  persistSurfaceVisibilityState,
  setSurfaceVisibility
} from './config/surfaceVisibilityMetadata';
import { UI_LAYERS } from './lib/uiLayers';

import {
  applyPublicationTransition,
  appendPublicationMessage,
  buildPublicationReviewRequests,
  filterPublishedProductPresentations,
  persistWorkspacePublicationData
} from './lib/workspacePublicationReview';

const workspaceMetadata = perfectFitMetadata.workspace;
const appLayoutMetadata = perfectFitMetadata.app.layoutMetadata;
const SHOW_CATALOGUE_VIEW_MODE_TOGGLES = appLayoutMetadata.catalogue.showViewModeToggles;
const DEFAULT_LEGACY_PATTERN_SIZE = appLayoutMetadata.catalogue.defaultLegacyPatternSize;
const CART_IMAGE_FIELDS = appLayoutMetadata.catalogue.cartImageFields;
const APP_LAYOUT_METADATA_VERSION = appLayoutMetadata.version;
const APP_LAYOUT_METADATA_KEY = appLayoutMetadata.storageKey;
const APP_LAYOUT_METADATA_VERSION_KEY = appLayoutMetadata.versionStorageKey;
const TRACK_SHIPMENT_FEATURE_KEY = appLayoutMetadata.trackShipmentFeatureKey;
const DISABLED_LAYOUT_SURFACE_IDS = new Set(appLayoutMetadata.disabledSurfaceIds);
const PAGE_SHELL_CLASS = perfectFitMetadata.app.layout.pageShellClass;
const MAIN_PAGE_SHELL_CLASS = perfectFitMetadata.app.layout.mainPageShellClass;
const NAV_GROUP_LABEL_KEYS = appLayoutMetadata.navGroupLabelKeys;
const NAV_ITEM_LABEL_KEYS = appLayoutMetadata.navItemLabelKeys;
const DEFAULT_APP_LAYOUT_METADATA = appLayoutMetadata.defaultSections;



// Modern/showcase catalogue views are preserved for future projects but hidden for current public catalogue.

// Legacy catalogue components still expect an initial size selector value.
// This is a neutral UI fallback only; garment-specific recommendations come from Find My Size.




const getPatternImageSource = (pattern = {}, options = {}) => {
  const { allowBlob = true } = options;
  const directCandidates = CART_IMAGE_FIELDS
    .map((field) => pattern?.[field])
    .filter(Boolean);
  const nestedCandidates = [
    pattern?.primaryMediaAsset?.url,
    pattern?.media?.primaryAsset?.url,
    pattern?.media?.image?.url,
    pattern?.presentationMediaItems?.find((item) => item?.url)?.url,
    pattern?.galleryMediaAssets?.find((item) => item?.url)?.url
  ].filter(Boolean);

  return [...directCandidates, ...nestedCandidates].find((candidate) => {
    const value = String(candidate || '').trim();
    if (!value) return false;
    if (!allowBlob && value.startsWith('blob:')) return false;
    return true;
  }) || '';
};

const getPatternCartKeyCandidates = (pattern = {}) =>
  [
    pattern.id,
    pattern.workspaceVariantId,
    pattern.variantId,
    pattern.legacyPatternId,
    pattern.commerceOverlayId,
    pattern.reference,
    pattern.variantReference,
    pattern.productReference,
    pattern.sku
  ]
    .filter(Boolean)
    .map((value) => String(value));

const findCurrentPatternForCartItem = (cartItem = {}, patterns = []) => {
  const pattern = cartItem.pattern || {};
  const compositeBase = String(cartItem.id || '').replace(/-(PDF|Printed|Print|Digital)$/i, '');
  const candidateKeys = new Set([
    compositeBase,
    ...getPatternCartKeyCandidates(pattern)
  ].filter(Boolean));

  return patterns.find((candidate) => {
    const keys = getPatternCartKeyCandidates(candidate);
    return keys.some((key) => candidateKeys.has(key));
  }) || null;
};

const refreshCartItemPresentation = (cartItem = {}, patterns = []) => {
  const currentPattern = findCurrentPatternForCartItem(cartItem, patterns);
  const currentImage = getPatternImageSource(currentPattern, { allowBlob: true });
  const savedImage = getPatternImageSource(cartItem.pattern, { allowBlob: false });
  const image = currentImage || savedImage;

  if (!currentPattern && !image) return cartItem;

  return {
    ...cartItem,
    pattern: {
      ...(cartItem.pattern || {}),
      ...(currentPattern || {}),
      image,
      primaryImage: image || currentPattern?.primaryImage || cartItem.pattern?.primaryImage || ''
    }
  };
};

const normalizeMultiFilter = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value || value === 'All') return [];
  return [value];
};

const toggleMultiFilter = (currentValues, value) => {
  const current = normalizeMultiFilter(currentValues);
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
};

const matchesPriceRange = (price, selectedRanges) => {
  const ranges = normalizeMultiFilter(selectedRanges);
  if (ranges.length === 0) return true;

  return ranges.some((range) => {
    if (range === 'under-15') return price < 15;
    if (range === '15-20') return price >= 15 && price <= 20;
    if (range === 'over-20') return price > 20;
    return true;
  });
};

const matchesRatingRange = (rating, selectedRatings) => {
  const ratings = normalizeMultiFilter(selectedRatings);
  if (ratings.length === 0) return true;
  const numericRating = Number(rating || 0);

  return ratings.some((range) => {
    if (range === '5-star') return numericRating >= 4.95;
    if (range === '4-5-up') return numericRating >= 4.5;
    if (range === '4-up') return numericRating >= 4;
    return true;
  });
};
// Framer Motion staggered animations for premium gallery entry
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 110,
      damping: 15,
    },
  },
};


// Font loading in styling guidelines check. We import luxury Google Fonts.
//const DEFAULT_APP_LAYOUT_METADATA = [
  //{ id: "orbital-featured", component: "OrbitCarousel", name: "Featured Item Gallery Showcase", isEnabled: true },
  //{ id: "dynamic-metadata-ui", component: "DynamicUiEngine", name: "Dynamic Layout & DB Admin Control", isEnabled: true },
  //{ id: "role-based-dynamic-layout", component: "DynamicLayout", name: "Dynamic Role-Gated Panels Workspace", isEnabled: true },
  //{ id: "gallery", component: "DynamicGallery", name: "Sewing Pattern Catalog & Gallery", isEnabled: true, title: "The Curated Pattern Collection", description: "Explore Our Style Collection" },
  //{ id: "my-orders", component: "MyOrdersSection", name: "My Purchased Orders", isEnabled: true },
  //{ id: "sewing-timer", component: "SewingSessionTimer", name: "Sewing Session Timer (Consolidated inside Workspace)", isEnabled: false },
  //{ id: "creations-feedback", component: "CreationsAndFeedback", name: "Showroom Feedback & Community Creations", isEnabled: true },
  //{ id: "customer-testimonials", component: "TestimonialCarousel", name: "Customer Testimonials Showcase (Consolidated with Board)", isEnabled: true },
  //{ id: "calculator", component: "MannequinGuide", name: "Fitting Room Sizer & Mannequin Guide (Consolidated inside Workspace)", isEnabled: false },
 // { id: "perfectfit-specification", component: "PerfectFitStandards", name: "Perfect Fit Assembly Standards & Specs", isEnabled: true },
  //{ id: "perfectfit-faq", component: "PerfectFitFaq", name: "Perfect Fit Curated Knowledge Base (FAQ)", isEnabled: true },
  //{ id: "perfectfit-library", component: "EditorialAcademy", name: "Editorials & Academy Masterclasses", isEnabled: true },
  //{ id: "creator-community-blog", component: "CreatorBlog", name: "Perfect Fit Creator Blog & Community Feed", isEnabled: true }
//];










function HeaderLanguageSelector({
  locale,
  setLocale,
  t,
  languages,
  className = '',
  compact = false
}) {
  if (!Array.isArray(languages) || languages.length === 0) return null;

  return (
    <label
      className={`inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white/70 px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-bark-700 shadow-3xs ${className}`}
    >
      <span className="sr-only">{t('language.selector.label')}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value)}
        className="appearance-none bg-transparent pr-4 text-inherit outline-none"
        aria-label={t('language.selector.label')}
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {compact
              ? language.code.toUpperCase()
              : t(language.labelKey, {}, language.nativeLabel)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none -ml-4 h-3 w-3 text-bark-400" />
    </label>
  );
}

const applyDisabledSurfaceGuards = (item) => {
  if (!DISABLED_LAYOUT_SURFACE_IDS.has(item?.id)) return item;

  return {
    ...item,
    isEnabled: false,
    nav: item.nav
      ? {
          ...item.nav,
          show: false
        }
      : item.nav
  };
};

function resetOutdatedLayoutMetadata() {
  const savedVersion = clientPreferences.getItem(APP_LAYOUT_METADATA_VERSION_KEY);

  if (savedVersion !== APP_LAYOUT_METADATA_VERSION) {
    clientPreferences.removeItem(APP_LAYOUT_METADATA_KEY);
    clientPreferences.removeItem('sartorial_ui_metadata');
    clientPreferences.removeItem('sartorial_layout_rules');
    clientPreferences.setItem(APP_LAYOUT_METADATA_VERSION_KEY, APP_LAYOUT_METADATA_VERSION);
  }
}

export default function App() {
  const { locale, setLocale, t, languages } = usePerfectFitLanguage();

  // Sizing view state mode: 'desktop' | 'mobile'
  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = clientPreferences.getItem('perfectfit_view_mode');
      if (saved === 'desktop' || saved === 'mobile') return saved;
    } catch {}
    return window.innerWidth < 1024 ? 'mobile' : 'desktop';
  });
const [activeView, setActiveView] = useState("home");
// Member authentication state is repository-driven; EIP auth can replace the local adapter later.
  const [currentUser, setCurrentUser] = useRuntimeState(RUNTIME_DOMAINS.USER_PROFILE, null);
  const [catalogAudienceFilter, setCatalogAudienceFilter] = useState('women');
const [catalogCategoryFilter, setCatalogCategoryFilter] = useState([]);
const [catalogDifficultyFilters, setCatalogDifficultyFilters] = useState([]);
const [catalogPriceRangeFilters, setCatalogPriceRangeFilters] = useState([]);
const [catalogRatingFilters, setCatalogRatingFilters] = useState([]);
const [catalogDesignerFilter, setCatalogDesignerFilter] = useState('All');
const [isCatalogSidebarCollapsed, setIsCatalogSidebarCollapsed] = useState(false);
const [surfaceVisibility, setSurfaceVisibilityState] = useState(loadSurfaceVisibilityState);
  // Master metadata layout configuration
  const [appLayout, setAppLayout] = useState(() => {
    resetOutdatedLayoutMetadata();
    try {
      const saved = clientPreferences.getItem(APP_LAYOUT_METADATA_KEY);
      if (saved) {
        let parsed = JSON.parse(saved).map(item => {
          // Keep the legacy standalone sewing timer disabled because it is consolidated in Workspace.
          if (item.id === 'sewing-timer') {
            return { ...item, isEnabled: false };
          }

          // Find My Size is now a first-class customer-facing FIT & SIZING view.
          // Older saved layout metadata marked this section disabled when it previously
          // lived inside the legacy Workspace flow, which otherwise leaves the route blank.
          if (item.id === 'calculator') {
            return {
              ...item,
              isEnabled: true,
              view: 'fit',
              nav: {
                ...(item.nav || {}),
                show: true,
                group: 'FIT & SIZING',
                groupOrder: 15,
                label: t('nav.item.fit.label'),
                description: t('nav.item.fit.description'),
                order: 10,
                targetView: 'fit',
                targetTool: 'fitting-room-sizer'
              }
            };
          }

          // Keep the Materials menu action valid even when older saved layout
          // metadata predates the action-based Materials navigation.
          if (item.id === 'materials-action') {
            return {
              ...item,
              isEnabled: true,
              view: '__action__',
              nav: {
                ...(item.nav || {}),
                show: true,
                group: 'DESIGN SANDBOX',
                groupOrder: 20,
                label: t('nav.item.materials.label'),
                description: t('nav.item.materials.description'),
                order: 20,
                action: 'openMaterials'
              }
            };
          }

          return applyDisabledSurfaceGuards(item);
        });
        const parsedById = new Map(parsed.map(item => [item.id, item]));

          return DEFAULT_APP_LAYOUT_METADATA.map((defaultItem) => {
          const savedItem = parsedById.get(defaultItem.id);

          const mergedItem = savedItem
          ? { ...defaultItem, ...savedItem }
          : defaultItem;

          return applyDisabledSurfaceGuards(mergedItem);
          });
        return parsed;
      }
      return DEFAULT_APP_LAYOUT_METADATA.map(applyDisabledSurfaceGuards);
    } catch {
      return DEFAULT_APP_LAYOUT_METADATA.map(applyDisabledSurfaceGuards);
    }
  });

  useEffect(() => {
    try {
      clientPreferences.setItem(APP_LAYOUT_METADATA_KEY, JSON.stringify(appLayout));
    } catch {}
  }, [appLayout]);

  useEffect(() => {
    persistSurfaceVisibilityState(surfaceVisibility);
  }, [surfaceVisibility]);

  const handleSurfaceVisibilityChange = (surfaceId, enabled) => {
    setSurfaceVisibilityState((current) =>
      setSurfaceVisibility(current, surfaceId, enabled)
    );
  };

  const handleResetLayout = () => {
    setAppLayout(DEFAULT_APP_LAYOUT_METADATA.map(applyDisabledSurfaceGuards));
    setSurfaceVisibilityState(getDefaultSurfaceVisibilityState());
    addToast("Perfect Fit layout metadata successfully restored to default.", "success", "System Reset");
  };

const visibleSections = appLayout
  .filter((section) => {
    if (DISABLED_LAYOUT_SURFACE_IDS.has(section.id)) return false;
    if (!isSurfaceVisible(surfaceVisibility, section.id)) return false;

    const isEnabledForView = section.isEnabled && section.view === activeView;

    if (!isEnabledForView) return false;

    if (!section.roles?.length) return true;

    return section.roles.includes(currentUser?.role);
  })
  .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

const fadeInSectionProps = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
};

const goToView = (view) => {
  setActiveView(view);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const exploreMenuGroups = useMemo(() => {
  const groups = {};

  appLayout
    .filter((section) =>
      !DISABLED_LAYOUT_SURFACE_IDS.has(section.id) &&
      isSurfaceVisible(surfaceVisibility, section.id) &&
      section.isEnabled &&
      section.nav?.show
    )
    .forEach((section) => {
      const nav = section.nav;
      const groupName = nav.group || "MORE";
      const groupLabelKey = NAV_GROUP_LABEL_KEYS[groupName] || null;

      if (!groups[groupName]) {
        groups[groupName] = {
          title: groupLabelKey ? t(groupLabelKey, {}, groupName) : groupName,
          order: nav.groupOrder ?? 999,
          items: []
        };
      }

      const itemKeys = NAV_ITEM_LABEL_KEYS[section.id] || {};

      groups[groupName].items.push({
        id: section.id,
        label: itemKeys.labelKey ? t(itemKeys.labelKey, {}, nav.label) : nav.label,
        description: itemKeys.descriptionKey
          ? t(itemKeys.descriptionKey, {}, nav.description)
          : nav.description,
        order: nav.order ?? 999,
        targetView: nav.targetView || section.view,
        action: nav.action
      });
    });

  return Object.values(groups)
    .map((menuGroup) => ({
      ...menuGroup,
      items: menuGroup.items.sort((a, b) => a.order - b.order)
    }))
    .sort((a, b) => a.order - b.order);
}, [appLayout, surfaceVisibility, t]);
const workspaceModuleRegistry = {
  media: WorkspaceMedia
};
const SECTION_RENDERERS = {
  HeroCarousel: (section) => (
    <HeroCarousel
      key={section.id}
      onExploreCatalog={() => goToView("patterns")}
      onOpenSizingCalculator={() => goToView("workspace")}
    />
  ),
SignatureOrbitCarouselA: (section) => (
  <SignatureOrbitCarouselA
    key={section.id}
    patterns={selectPatternsForSurface(productPresentationPatterns, 'signature-orbit-carousel', 8)}
    title={section.title || "Our Signature Collections"}
    subtitle={section.subtitle || "Let Your Uniqueness Take Shape"}
    showLabel={section.showLabel || false}
    isLoading={patternsRepositoryState.loading}
    onExploreCatalog={() => goToView("patterns")}
    onQuickView={setQuickViewPattern}
    onFocusPattern={(pattern) => {
      setActivePatternId(pattern.id);
      setFeaturedDetailTab('features');
    }}
  />
),

SignaturePerspectiveStackCarouselB: (section) => (
  <SignaturePerspectiveStackCarouselB
    key={section.id}
    patterns={productPresentationPatterns.slice(0, 10)}
    title={section.title || "Our Signature Collections"}
    subtitle={section.subtitle || "Let Your Uniqueness Take Shape"}
    showLabel={section.showLabel || false}
    onQuickView={setQuickViewPattern}
    onFocusPattern={(pattern) => {
      setActivePatternId(pattern.id);
      setFeaturedDetailTab('features');
    }}
  />
),
  OrbitCarousel: (section) => (
    <motion.section
      key={section.id}
      {...fadeInSectionProps}
      className="space-y-6"
      id="orbital-featured-section"
    >
      {isCarouselLoading ? (
        <OrbitCarouselSkeleton />
      ) : (
        <OrbitCarousel
          patterns={selectPatternsForSurface(productPresentationPatterns, 'orbit-carousel', 4)}
          activePatternId={activePatternId}
          setActivePatternId={setActivePatternId}
          activeRecommendedSize={DEFAULT_LEGACY_PATTERN_SIZE}
          onAddToCart={handleAddToCart}
          reviews={reviews}
          onAddReview={handleAddReview}
          currentUser={currentUser}
          detailTab={featuredDetailTab}
          setDetailTab={setFeaturedDetailTab}
          onQuickView={(p) => setQuickViewPattern(p)}
          quickViewPattern={quickViewPattern}
          onCloseQuickView={() => setQuickViewPattern(null)}
        />
      )}
    </motion.section>
  ),
HomeMakerTransition: () => null, // Placeholder for a transition section, can be customized later

/*  DynamicUiEngine: (section) => (
    <motion.section
      key={section.id}
      {...fadeInSectionProps}
      className="space-y-6"
      id="dynamic-metadata-ui-section"
    >
      <DynamicUiEngine
        currentUser={currentUser}
        onForceLoginTrigger={(gated) => setIsAppLoginDependent(gated)}
        isAdminWorkspace={false}
      />
    </motion.section>
  ), */
Workspace: (section) => (
  <motion.div
    key={section.id}
    {...fadeInSectionProps}
  >
    <Workspace
      currentUser={currentUser}
      moduleRegistry={workspaceModuleRegistry}
      surfaceVisibility={surfaceVisibility}
    />
  </motion.div>
),
/*Workspaceb: (section) => (
  <motion.section
    key={section.id}
    {...fadeInSectionProps}
    id="workspace-shell-section"
  >
    <Workspace currentUser={currentUser} />
  </motion.section>
),

  DynamicLayout: (section) => (
    <motion.section
      key={section.id}
      {...fadeInSectionProps}
      className="space-y-6"
      id="role-based-dynamic-layout-section"
    >
      <DynamicLayout
        appLayout={appLayout}
        setAppLayout={setAppLayout}
        onResetLayout={handleResetLayout}
      />
    </motion.section>
  ),*/

  MyOrdersSection: (section) => (
    <motion.div key={section.id} {...fadeInSectionProps}>
      <MyOrdersSection
        currentUser={currentUser}
        guestOrders={guestOrders}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLoadDemoOrders={isDemoRuntimeDataEnabled() ? handleLoadDemoOrders : undefined}
      />
    </motion.div>
  ),

  SewingSessionTimer: (section) => (
    <motion.div key={section.id} {...fadeInSectionProps}>
      <SewingSessionTimer patterns={patterns} />
    </motion.div>
  ),

  CreationsAndFeedback: (section) => (
    <motion.div key={section.id} {...fadeInSectionProps}>
      <CreationsAndFeedback
        patterns={productPresentationPatterns}
        currentUser={currentUser}
        onAddReview={handleAddReview}
      />
    </motion.div>
  ),

  TestimonialCarousel: (section) => (
    <motion.section
      key={section.id}
      {...fadeInSectionProps}
      className="pt-6"
      id="testimonials-section"
    >
      <TestimonialCarousel />
    </motion.section>
  ),

  MannequinGuide: (section) => (
    <motion.section
      key={section.id}
      {...fadeInSectionProps}
      className="pt-6"
      id="calculator-section"
    >
      <MannequinGuide
        patterns={productPresentationPatterns}
        showSizeConversion={isSurfaceVisible(surfaceVisibility, 'global.sizeConversion')}
      />
    </motion.section>
  ),

  PerfectFitStandards: (section) => (
    <motion.div key={section.id} {...fadeInSectionProps}>
      <PerfectFitStandards />
    </motion.div>
  ),

  PerfectFitFaq: (section) => (
    <motion.section
      key={section.id}
      {...fadeInSectionProps}
    className={`${PAGE_SHELL_CLASS} pt-4 sm:pt-6`}
      id="perfectfit-faq-section-wrapper"
    >
      <PerfectFitFaq />
    </motion.section>
  ),

  EditorialAcademy: (section) => (
    <motion.section
      key={section.id}
      {...fadeInSectionProps}
      className="pt-6"
      id="atelier-library-section"
    >
      <EditorialAcademy
        isLoggedIn={!!currentUser}
        userRole={currentUser?.role}
      />
    </motion.section>
  ),

  CreatorBlog: (section) => (
    <motion.section
      key={section.id}
      {...fadeInSectionProps}
      className="pt-6"
      id="creator-community-blog-section"
    >
      <CreatorBlog />
    </motion.section>
  ),
  AdminControlPanel: (section) => (
  <motion.section
    key={section.id}
    {...fadeInSectionProps}
    className={`${PAGE_SHELL_CLASS} py-6 sm:py-8`}
  >
    <AdminControlPanel
      appLayout={appLayout}
      setAppLayout={setAppLayout}
      onResetLayout={handleResetLayout}
      surfaceVisibility={surfaceVisibility}
      surfaceVisibilityRegistry={SURFACE_VISIBILITY_REGISTRY}
      onSurfaceVisibilityChange={handleSurfaceVisibilityChange}
      appConnectionStatus={{ isOnline, lastChecked: connectionLastChecked }}
      trackShipmentEnabled={isTrackShipmentEnabled}
      onTrackShipmentEnabledChange={setIsTrackShipmentEnabled}
      publicationRequests={publicationReviewRequests}
      onOpenPublicationReview={handleOpenPublicationReview}
      onMessagePublicationDesigner={handleOpenModeratorMessage}
    />
  </motion.section>
),
};
  // Keep viewMode state synchronized with localStorage
  useEffect(() => {
    try {
      clientPreferences.setItem('perfectfit_view_mode', viewMode);
    } catch {}
  }, [viewMode]);

  // Cart is runtime business data, not component/browser authority.
  const [cartItems, setCartItems] = useRuntimeState(RUNTIME_DOMAINS.CART, []);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);

  // Close explore dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (isExploreOpen && !event.target.closest('#explore-dropdown-container')) {
        setIsExploreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isExploreOpen]);

  // Global state for administrator strict login requirement
  const [isAppLoginDependent, setIsAppLoginDependent] = useState(() => {
    return clientPreferences.getItem('perfectfit_ui_login_dependent') === 'true';
  });

  // Orders are runtime records behind the repository boundary.
  const [guestOrders, setGuestOrders] = useRuntimeState(RUNTIME_DOMAINS.ORDERS, []);

  const handleOrderSuccess = (newOrder) => {
    const formattedItems = newOrder.items.map(item => ({
      patternName: item.pattern.name,
      format: item.format,
      price: item.price,
      quantity: item.quantity,
      sizePreference: item.sizePreference || '8',
      image: getPatternImageSource(item.pattern, { allowBlob: true })
    }));
    const receiptSnapshot = {
      ...newOrder,
      items: formattedItems
    };

    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        purchaseHistory: [
          {
            id: newOrder.orderId,
            date: newOrder.date,
            items: formattedItems,
            total: newOrder.total,
            status: 'Ready for Download',
            format: formattedItems[0]?.format || 'PDF',
            patternName: formattedItems.map(item => item.patternName).join(', '),
            price: newOrder.total,
            receipt: receiptSnapshot
          },
          ...(currentUser.purchaseHistory || [])
        ]
      };
      setCurrentUser(updatedUser);
    } else {
      setGuestOrders(prev => [
        {
          id: newOrder.orderId,
          date: newOrder.date,
          items: formattedItems,
          total: newOrder.total,
          status: 'Ready for Download',
          format: formattedItems[0]?.format || 'PDF',
          patternName: formattedItems.map(item => item.patternName).join(', '),
          price: newOrder.total,
          receipt: receiptSnapshot
        },
        ...prev
      ]);
    }
  };

  const handleLoadDemoOrders = () => {
    const demoOrdersList = createOptInDemoOrderSeed();

    if (currentUser) {
      setCurrentUser(prev => ({
        ...prev,
        purchaseHistory: [...demoOrdersList, ...(prev.purchaseHistory || [])]
      }));
    } else {
      setGuestOrders(prev => [...demoOrdersList, ...prev]);
    }

    if (window.showToast) {
      window.showToast("Instantly populated your Perfect Fit purchase history with two premium sample patterns!", "success", "Demo Orders Loaded");
    }
  };

  // Catalogue runtime data comes through the repository boundary.
  const [patterns, setPatterns, patternsRepositoryState] = useRuntimeCollectionState(
    RUNTIME_DOMAINS.CATALOG_PRODUCTS,
    []
  );
  const [commercialPromotions] = useRuntimeCollectionState(
    RUNTIME_DOMAINS.COMMERCIAL_PROMOTIONS,
    []
  );

  const [workspaceProductPresentations, setWorkspaceProductPresentations] = useState([]);
  const [workspacePublicationData, setWorkspacePublicationData] = useState(null);
  const [moderatorReviewRequest, setModeratorReviewRequest] = useState(null);
  const [moderatorMessageRequest, setModeratorMessageRequest] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let activeObjectUrls = [];

    const revokeActiveObjectUrls = () => {
      activeObjectUrls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      activeObjectUrls = [];
    };

    const hydrateAssetUrl = async (asset, objectUrls) => {
      if (!asset) return '';
      if (asset.url) return asset.url;
      if (!asset.id || typeof URL === 'undefined') return '';

      try {
        const file = await loadMediaFile(asset.id);
        if (!file) return '';
        const objectUrl = URL.createObjectURL(file);
        objectUrls.push(objectUrl);
        return objectUrl;
      } catch {
        return '';
      }
    };

    const refreshWorkspaceProducts = async () => {
      const nextObjectUrls = [];
      const workspaceData = loadWorkspacePresentationData();
      setWorkspacePublicationData(workspaceData);
      const mapped = buildWorkspaceProductPresentations(workspaceData, patterns);

      const hydrated = await Promise.all(
        mapped.map(async (presentation) => {
          const mediaItems = (
            await Promise.all(
              (presentation.galleryMediaAssets || []).map(async (asset) => {
                const url = await hydrateAssetUrl(asset, nextObjectUrls);
                if (!url) return null;

                return {
                  id: asset.id,
                  url,
                  title: asset.title || asset.fileName || 'Workspace media',
                  type: asset.type || 'GARMENT_SAMPLE',
                  typeLabel: String(asset.type || 'Garment sample').replace(/_/g, ' ').toLowerCase(),
                  workspaceAssetId: asset.id
                };
              })
            )
          ).filter(Boolean);

          const primaryMediaItem =
            mediaItems.find((item) => item.workspaceAssetId === presentation.primaryMediaAsset?.id) ||
            mediaItems[0] ||
            null;
          const technicalSketchMediaItem =
            mediaItems.find((item) => item.workspaceAssetId === presentation.technicalSketchAsset?.id) ||
            null;
          const technicalSketchUrl =
            technicalSketchMediaItem?.url ||
            presentation.technicalSketchAsset?.url ||
            (
              presentation.technicalSketchAsset?.id
                ? await hydrateAssetUrl(presentation.technicalSketchAsset, nextObjectUrls)
                : ''
            );
          const image = primaryMediaItem?.url || presentation.image || presentation.primaryImage || '';

          return {
            ...presentation,
            image,
            primaryImage: image,
            technicalSketchUrl,
            presentationMediaItems: mediaItems
          };
        })
      );

      if (cancelled) {
        nextObjectUrls.forEach((url) => {
          try {
            URL.revokeObjectURL(url);
          } catch {}
        });
        return;
      }

      revokeActiveObjectUrls();
      activeObjectUrls = nextObjectUrls;
      setWorkspaceProductPresentations(hydrated);
    };

    refreshWorkspaceProducts();

    const handleWorkspaceStorage = (event) => {
      if (!event?.key || event.key === getWorkspacePresentationStorageKey()) {
        refreshWorkspaceProducts();
      }
    };

    window.addEventListener(WORKSPACE_PRESENTATION_UPDATED_EVENT, refreshWorkspaceProducts);
    window.addEventListener('storage', handleWorkspaceStorage);

    return () => {
      cancelled = true;
      window.removeEventListener(WORKSPACE_PRESENTATION_UPDATED_EVENT, refreshWorkspaceProducts);
      window.removeEventListener('storage', handleWorkspaceStorage);
      revokeActiveObjectUrls();
    };
  }, [patterns]);

  const mergedWorkspaceCommercePatterns = useMemo(
    () =>
      mergeWorkspacePresentationsWithCommerce(
        patterns,
        workspaceProductPresentations
      ),
    [
      patterns,
      workspaceProductPresentations
    ]
  );

  const productPresentationPatterns = useMemo(
    () =>
      filterPublishedProductPresentations({
        mergedPatterns:
          mergedWorkspaceCommercePatterns,
        workspacePresentations:
          workspaceProductPresentations,
        workspaceData:
          workspacePublicationData
      }),
    [
      mergedWorkspaceCommercePatterns,
      workspaceProductPresentations,
      workspacePublicationData
    ]
  );
  const displayedWorkspaceProducts = useMemo(
    () => productPresentationPatterns.filter((pattern) => pattern.presentationSource === 'workspace'),
    [productPresentationPatterns]
  );

  const cartItemsForCheckout = useMemo(
    () =>
      cartItems.map((item) =>
        refreshCartItemPresentation(item, productPresentationPatterns)
      ),
    [cartItems, productPresentationPatterns]
  );

  const publicationReviewRequests = useMemo(
    () =>
      buildPublicationReviewRequests({
        workspaceData:
          workspacePublicationData,
        workspacePresentations:
          workspaceProductPresentations
      }),
    [
      workspacePublicationData,
      workspaceProductPresentations
    ]
  );

  const publicationWorkflow =
    workspaceMetadata.approval
      ?.workflows
      ?.CATALOGUE_RELEASE ||
    null;

  const publicationMessageStorageKey =
    `${getWorkspacePresentationStorageKey()}_messages_v1`;

  const findPublicationTransition = (
    code,
    status
  ) =>
    (
      publicationWorkflow
        ?.transitions ||
      []
    ).find(
      (transition) =>
        transition.code ===
          code &&
        (
          transition.from ||
          []
        ).includes(
          status
        )
    ) ||
    null;

  const handleUndisplayPublishedProduct = (pattern) => {
    const variantId = pattern?.workspaceVariantId || pattern?.variantId;
    const transition = findPublicationTransition('UNPUBLISH', 'PUBLISHED');
    if (!variantId || !transition) {
      addToast('This product is not linked to an active Workspace publication record.', 'warning', 'Unable to Undisplay');
      return;
    }

    const nextWorkspaceData = applyPublicationTransition({
      workspaceData: loadWorkspacePresentationData(),
      variantId,
      transition,
      actor: currentUser
    });
    persistWorkspacePublicationData({
      workspaceData: nextWorkspaceData,
      storageKey: getWorkspacePresentationStorageKey(),
      eventName: WORKSPACE_PRESENTATION_UPDATED_EVENT
    });
    setWorkspacePublicationData(nextWorkspaceData);
    addToast(`"${pattern.name || 'Product'}" is no longer displayed.`, 'success', 'Publication Updated');
  };

  const handleOpenPublicationReview = (
    request
  ) => {
    if (!request?.pattern) {
      addToast(
        'The customer projection could not be generated for this request.',
        'warning',
        'Preview Unavailable'
      );
      return;
    }

    setModeratorReviewRequest(
      request
    );

    setQuickViewPattern(
      request.pattern
    );
  };

  const handleOpenModeratorMessage = (
    request
  ) => {
    if (!request?.requestId) {
      return;
    }

    setModeratorMessageRequest(
      request
    );
  };

  const commitModeratorPublicationTransition = (
    request,
    transition,
    moderatorNote = ''
  ) => {
    if (
      !request ||
      !transition
    ) {
      return;
    }

    const currentWorkspaceData =
      loadWorkspacePresentationData();

    const nextWorkspaceData =
      applyPublicationTransition({
        workspaceData:
          currentWorkspaceData,
        variantId:
          request.variantId,
        transition,
        actor:
          currentUser,
        moderatorNote
      });

    persistWorkspacePublicationData({
      workspaceData:
        nextWorkspaceData,
      storageKey:
        getWorkspacePresentationStorageKey(),
      eventName:
        WORKSPACE_PRESENTATION_UPDATED_EVENT
    });

    setWorkspacePublicationData(
      nextWorkspaceData
    );

    if (
      transition.code ===
        'MODERATOR_RETURN' &&
      moderatorNote
    ) {
      appendPublicationMessage({
        storageKey:
          publicationMessageStorageKey,
        request,
        senderType:
          'MODERATOR',
        sender:
          currentUser,
        text:
          moderatorNote
      });
    }

    if (
      transition.code ===
      'MODERATOR_PUBLISH'
    ) {
      appendPublicationMessage({
        storageKey:
          publicationMessageStorageKey,
        request,
        senderType:
          'MODERATOR',
        sender:
          currentUser,
        text:
          'Your product has been approved and released for customer publication.'
      });
    }

    setModeratorReviewRequest(
      null
    );

    setQuickViewPattern(
      null
    );

    addToast(
      transition.code ===
        'MODERATOR_PUBLISH'
        ? `"${request.styleName}" is now published to customer-facing catalogue and landing-page surfaces.`
        : `"${request.styleName}" was returned to the designer for correction.`,
      transition.code ===
        'MODERATOR_PUBLISH'
        ? 'success'
        : 'warning',
      transition.code ===
        'MODERATOR_PUBLISH'
        ? 'Publication Released'
        : 'Returned to Designer'
    );
  };

  const handleModeratorApprove = (
    request,
    suppliedTransition
  ) => {
    const transition =
      suppliedTransition ||
      findPublicationTransition(
        'MODERATOR_PUBLISH',
        request?.status
      );

    commitModeratorPublicationTransition(
      request,
      transition
    );
  };

  const handleModeratorReturn = (
    request,
    suppliedTransition,
    reason
  ) => {
    const transition =
      suppliedTransition ||
      findPublicationTransition(
        'MODERATOR_RETURN',
        request?.status
      );

    commitModeratorPublicationTransition(
      request,
      transition,
      reason
    );
  };

  const catalogDesignerBrands = useMemo(() => {
    return Array.from(
      new Set(
        productPresentationPatterns
          .map((pattern) => pattern.designerBrand || 'Perfect Fit Bureau')
          .filter(Boolean)
      )
    ).sort();
  }, [productPresentationPatterns]);

const resetCatalogFilters = () => {
  setCatalogAudienceFilter('women');
  setCatalogCategoryFilter([]);
  setCatalogDifficultyFilters([]);
  setCatalogPriceRangeFilters([]);
  setCatalogRatingFilters([]);
  setShowFavoritesOnly(false);
  setCatalogDesignerFilter('All');
};

const handleCatalogCategoryToggle = (categoryId) => {
  setCatalogCategoryFilter((current) => toggleMultiFilter(current, categoryId));
};

const handleCatalogDifficultyToggle = (difficultyId) => {
  setCatalogDifficultyFilters((current) => toggleMultiFilter(current, difficultyId));
};

const handleCatalogPriceRangeToggle = (priceRangeId) => {
  setCatalogPriceRangeFilters((current) => toggleMultiFilter(current, priceRangeId));
};

const handleCatalogRatingToggle = (ratingId) => {
  setCatalogRatingFilters((current) => toggleMultiFilter(current, ratingId));
};

  // Premium skeleton loader states
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isCarouselLoading, setIsCarouselLoading] = useState(true);

  // Initial load simulation for premium feeling
  useEffect(() => {
    const timerCarousel = setTimeout(() => setIsCarouselLoading(false), 950);
    const timerCatalog = setTimeout(() => setIsCatalogLoading(false), 1450);
    return () => {
      clearTimeout(timerCarousel);
      clearTimeout(timerCatalog);
    };
  }, []);

  // Real-time network and service worker caching tracking
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionLastChecked, setConnectionLastChecked] = useState(() => new Date().toISOString());

  // Clean minimal stackable toast notifications
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info', title = null, meta = null) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, title, meta }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Expose toast trigger globally
  useEffect(() => {
    window.showToast = addToast;
    return () => {
      delete window.showToast;
    };
  }, []);

  useEffect(() => {
    window.isPerfectFitOffline = !isOnline;
  }, [isOnline]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionLastChecked(new Date().toISOString());
      addToast(
        'Your connection is stable. The Perfect Fit Bureau is fully synchronized with live ERP updates.',
        'success',
        'Connection Restored'
      );
    };
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionLastChecked(new Date().toISOString());
      addToast(
        'You are now browsing offline. Pre-cached blueprints and styling handbook remain fully functional.',
        'warning',
        'Intermittent Connection'
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Soft trigger for catalog-only loading states when filters/searches change
  const triggerCatalogLoading = (duration = 550) => {
    setIsCatalogLoading(true);
    const t = setTimeout(() => setIsCatalogLoading(false), duration);
    return () => clearTimeout(t);
  };


  // ERP integration effect: exposes global APIs and registers listeners for dynamic data pushing
  useEffect(() => {
    // 1. Expose global helper on window so ERP scripts can directly push products/patterns
    window.setPerfectFitPatterns = (newPatterns) => {
      if (Array.isArray(newPatterns)) {
        setIsCarouselLoading(true);
        setIsCatalogLoading(true);
        setPatterns(newPatterns);
        addToast(`Catalog fully synchronized. ${newPatterns.length} blueprints mapped to ERP data source.`, 'erp', 'ERP Data Synchronized');
        setTimeout(() => setIsCarouselLoading(false), 850);
        setTimeout(() => setIsCatalogLoading(false), 1350);
        return { success: true, count: newPatterns.length };
      }
      return { success: false, error: "Invalid patterns list. Must be an array." };
    };

    window.pushPerfectFitPattern = (pattern) => {
      if (pattern && pattern.id) {
        setIsCarouselLoading(true);
        setIsCatalogLoading(true);
        setPatterns(prev => {
          const filtered = prev.filter(p => p.id !== pattern.id);
          const updated = [pattern, ...filtered];
          return updated;
        });
        addToast(`Dynamic ERP push detected: Successfully imported design "${pattern.title || pattern.name}".`, 'erp', 'ERP Design Pushed');
        setTimeout(() => setIsCarouselLoading(false), 850);
        setTimeout(() => setIsCatalogLoading(false), 1350);
        return { success: true, patternId: pattern.id };
      }
      return { success: false, error: "Invalid pattern object. id field is required." };
    };

    // 2. Listen to cross-document window postMessage events
    const handleMessage = (event) => {
      try {
        const payload = event.data;
        if (!payload || typeof payload !== 'object') return;

        if (payload.type === 'SET_PERFECTFIT_PATTERNS' && Array.isArray(payload.patterns)) {
          window.setPerfectFitPatterns(payload.patterns);
        } else if (payload.type === 'PUSH_PERFECTFIT_PATTERN' && payload.pattern) {
          window.pushPerfectFitPattern(payload.pattern);
        }
      } catch (err) {
        console.error("Error processing postMessage from ERP:", err);
      }
    };
    window.addEventListener('message', handleMessage);

    // 3. Listen to local storage changes from same-origin pages
    const handleStorage = (event) => {
      if (event.key === 'perfectfit_erp_patterns' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          if (Array.isArray(parsed)) {
            setPatterns(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // 4. Optionally fetch from live API endpoint /api/patterns if existing
    const fetchServerPatterns = async () => {
      try {
        const res = await fetch('/api/patterns');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setPatterns(data);
          }
        }
      } catch (e) {}
    };
    fetchServerPatterns();

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      try {
        delete window.setPerfectFitPatterns;
        delete window.pushPerfectFitPattern;
      } catch {}
    };
  }, []);

  // User sizing preference from the calculator (or default)

  // Currently active focused pattern (for detailed product description view)
  const [activePatternId, setActivePatternId] = useState('');

  // Detail tab state for OrbitCarousel details panel
  const [featuredDetailTab, setFeaturedDetailTab] = useState('specs');

  // Interactive Quick View summary modal active pattern state
  const [quickViewPattern, setQuickViewPattern] = useState(null);

  useEffect(() => {
    if (
      !quickViewPattern &&
      moderatorReviewRequest
    ) {
      setModeratorReviewRequest(
        null
      );
    }
  }, [
    quickViewPattern,
    moderatorReviewRequest
  ]);

  // Shared One-Time Token Access state
  const [sharedTokenAccess, setSharedTokenAccess] = useState(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const patternId = params.get('pattern');
      if (token) {
        const matchedPattern = productPresentationPatterns.find(
          (pattern) => pattern.id === patternId || token.includes(pattern.id)
        );
        setSharedTokenAccess({
          token,
          pattern: matchedPattern || null
        });
      }
    } catch (err) {
      console.error("Error reading token URL parameter:", err);
    }
  }, [productPresentationPatterns]);

  // Sync active focused pattern when presentation list changes
  useEffect(() => {
    if (productPresentationPatterns.length > 0) {
      const exists = productPresentationPatterns.some(p => p.id === activePatternId);
      if (!exists) {
        setActivePatternId(productPresentationPatterns[0].id);
      }
    }
  }, [productPresentationPatterns, activePatternId]);

  // Reviews remain authored/runtime content; only their surrounding UI is translated.
  const [reviews, setReviews] = useRuntimeState(
    RUNTIME_DOMAINS.PRODUCT_REVIEWS,
    {}
  );

  // Submit a new review handler
  const handleAddReview = (patternId, newReview) => {
    setReviews((prev) => {
      const patternReviews = prev[patternId] || [];
      return {
        ...prev,
        [patternId]: [newReview, ...patternReviews]
      };
    });
  };

  // Search, categories and difficulty filters
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [sortBy, setSortBy] = useState('Default');
  const [searchQuery, setSearchQuery] = useState('');
  const [isHeaderSearchFocused, setIsHeaderSearchFocused] = useState(false);
  const [isMobileSearchFocused, setIsMobileSearchFocused] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isDifficultyDropdownOpen, setIsDifficultyDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  // Memoized top autocomplete matches for live header dropdown
  const matchingDropdownPatterns = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.trim().toLowerCase();
    return productPresentationPatterns.filter((p) => {
      const name = p.name || '';
      const tagline = p.tagline || '';
      const desc = p.description || '';
      const cat = p.category || '';
      const diff = p.difficulty || '';
      return name.toLowerCase().includes(query) ||
             tagline.toLowerCase().includes(query) ||
             desc.toLowerCase().includes(query) ||
             cat.toLowerCase().includes(query) ||
             diff.toLowerCase().includes(query);
    }).slice(0, 5);
  }, [productPresentationPatterns, searchQuery]);

  // Wishlist/favorites are runtime user data.
  const [favorites, setFavorites] = useRuntimeState(RUNTIME_DOMAINS.WISHLIST, []);

  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [galleryViewMode, setGalleryViewMode] = useState('grid'); // 'showcase' preserved for future projects; current public catalogue uses classic grid.

  // Toggle favorite handler
  const handleToggleFavorite = (patternId) => {
    setFavorites((prev) => {
      if (prev.includes(patternId)) {
        addToast("Removed from saved blueprints.", "info", "Removed");
        return prev.filter(id => id !== patternId);
      } else {
        addToast("Added to saved blueprints.", "success", "Saved Blueprint");
        return [...prev, patternId];
      }
    });
  };

  // Pagination states
  const [itemsPerPage, setItemsPerPage] = useState(24);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page to 1 when any filter or itemsPerPage changes
  useEffect(() => {
  setCurrentPage(1);
}, [
  selectedCategory,
  selectedDifficulty,
  searchQuery,
  itemsPerPage,
  showFavoritesOnly,
  sortBy,
  catalogAudienceFilter,
  catalogCategoryFilter,
  catalogDifficultyFilters,
  catalogPriceRangeFilters,
  catalogRatingFilters,
  catalogDesignerFilter
]);

  // Dynamic skeleton loading delay on filter or search changes to simulate live ERP indexing
  useEffect(() => {
    setIsCatalogLoading(true);
    const delay = searchQuery ? 400 : 550; // Snappier delay for keyword search
    const timer = setTimeout(() => {
      setIsCatalogLoading(false);
    }, delay);
    return () => clearTimeout(timer);
  }, [
    selectedCategory,
    selectedDifficulty,
    showFavoritesOnly,
    sortBy,
    searchQuery,
    catalogAudienceFilter,
    catalogCategoryFilter,
    catalogDifficultyFilters,
    catalogPriceRangeFilters,
    catalogRatingFilters,
    catalogDesignerFilter
  ]);


  // Cart Drawer open/close status
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isTrackOrderOpen, setIsTrackOrderOpen] = useState(false);
  const [isConsultationOpen, setIsConsultationOpen] = useState(false);
  const [isFabricStashOpen, setIsFabricStashOpen] = useState(false);
  const [trackOrderId, setTrackOrderId] = useState('');
  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  const [isTrackShipmentEnabled, setIsTrackShipmentEnabled] = useState(() => {
    try {
      return clientPreferences.getItem(TRACK_SHIPMENT_FEATURE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      clientPreferences.setItem(TRACK_SHIPMENT_FEATURE_KEY, String(isTrackShipmentEnabled));
    } catch {}
    if (!isTrackShipmentEnabled) {
      setIsTrackOrderOpen(false);
      setTrackOrderId('');
    }
  }, [isTrackShipmentEnabled]);

  useEffect(() => {
    const syncTrackShipmentSetting = () => {
      try {
        setIsTrackShipmentEnabled(clientPreferences.getItem(TRACK_SHIPMENT_FEATURE_KEY) === 'true');
      } catch {
        setIsTrackShipmentEnabled(false);
      }
    };
    window.addEventListener('perfectfit_track_shipment_setting_changed', syncTrackShipmentSetting);
    window.addEventListener('storage', syncTrackShipmentSetting);
    return () => {
      window.removeEventListener('perfectfit_track_shipment_setting_changed', syncTrackShipmentSetting);
      window.removeEventListener('storage', syncTrackShipmentSetting);
    };
  }, []);

  const openTrackShipmentIfEnabled = () => {
    if (!isTrackShipmentEnabled) return;
    setIsTrackOrderOpen(true);
  };

  // Persistent cart syncing

  // Read active recommended size from SizeCalculator calculations if possible.
  // In our app, we listen to sizing events or just let the user set it. To make this work seamlessly,
  // we listen to changes in localStorage or let the SizeCalculator update a key.
  // Let's configure a smart listener to automatically sync recommended size.
  useEffect(() => {
    const handleStorageChange = () => {
      // Periodic check or event listener
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Real-time counts for categories and difficulties
  const categoryCounts = useMemo(() => {
    const counts = { All: productPresentationPatterns.length };
    productPresentationPatterns.forEach((p) => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return counts;
  }, [productPresentationPatterns]);

  const difficultyCounts = useMemo(() => {
    const counts = { All: productPresentationPatterns.length };
    productPresentationPatterns.forEach((p) => {
      if (p.difficulty) {
        counts[p.difficulty] = (counts[p.difficulty] || 0) + 1;
      }
    });
    return counts;
  }, [productPresentationPatterns]);

  // Helper to determine difficulty sorting weight
  const getDifficultyWeight = (diff) => {
    switch (diff?.toLowerCase()) {
      case 'beginner': return 1;
      case 'intermediate': return 2;
      case 'advanced': return 3;
      default: return 4;
    }
  };

  // Filtered patterns calculation with sorting
  const filteredPatterns = useMemo(() => {
    const filtered = productPresentationPatterns.filter((p) => {
      const selectedCatalogCategories = normalizeMultiFilter(catalogCategoryFilter).map(slugifyCatalogValue);
      const selectedCatalogDifficulties = normalizeMultiFilter(catalogDifficultyFilters).map(slugifyCatalogValue);
      const matchCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchDifficulty = selectedDifficulty === 'All' || p.difficulty === selectedDifficulty;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.difficulty.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFavorites = !showFavoritesOnly || favorites.includes(p.id);
      const patternAudience = slugifyCatalogValue(p.audience || 'women');
const patternCategory = slugifyCatalogValue(p.mainCategory || p.category || 'dresses');
const patternDesigner = p.designerBrand || 'Perfect Fit Bureau';

const matchesAudience =
  catalogAudienceFilter === 'All' ||
  patternAudience === slugifyCatalogValue(catalogAudienceFilter);

const matchesCatalogCategory =
  selectedCatalogCategories.length === 0 ||
  selectedCatalogCategories.includes(patternCategory);

const matchesCatalogDifficulty =
  selectedCatalogDifficulties.length === 0 ||
  selectedCatalogDifficulties.includes(slugifyCatalogValue(p.difficulty || ''));

const patternPrice = Number(p.price ?? p.pricePDF ?? 0);
const patternRating = Number(p.rating ?? 0);

const matchesCatalogPrice = matchesPriceRange(patternPrice, catalogPriceRangeFilters);
const matchesCatalogRating = matchesRatingRange(patternRating, catalogRatingFilters);

const matchesDesigner =
  catalogDesignerFilter === 'All' || patternDesigner === catalogDesignerFilter;
      return matchCategory && matchDifficulty && matchSearch && matchFavorites && matchesAudience &&
  matchesCatalogCategory &&
  matchesCatalogDifficulty &&
  matchesCatalogPrice &&
  matchesCatalogRating &&
  matchesDesigner;
    });

    // Apply sorting
    if (sortBy === 'diff-asc') {
      return [...filtered].sort((a, b) => getDifficultyWeight(a.difficulty) - getDifficultyWeight(b.difficulty));
    } else if (sortBy === 'diff-desc') {
      return [...filtered].sort((a, b) => getDifficultyWeight(b.difficulty) - getDifficultyWeight(a.difficulty));
    } else if (sortBy === 'garment-asc') {
      return [...filtered].sort((a, b) => (a.category || '').localeCompare(b.category || ''));
    } else if (sortBy === 'garment-desc') {
      return [...filtered].sort((a, b) => (b.category || '').localeCompare(a.category || ''));
    }

    return filtered;
  },
  [
  productPresentationPatterns,
  selectedCategory,
  selectedDifficulty,
  searchQuery,
  showFavoritesOnly,
  favorites,
  sortBy,
  catalogAudienceFilter,
  catalogCategoryFilter,
  catalogDifficultyFilters,
  catalogPriceRangeFilters,
  catalogRatingFilters,
  catalogDesignerFilter
]);
  // Paginated patterns calculation
  const paginatedPatterns = useMemo(() => {
    const limit = Number(itemsPerPage) || 24;
    const page = Number(currentPage) || 1;
    const startIndex = (page - 1) * limit;
    return filteredPatterns.slice(startIndex, startIndex + limit);
  }, [filteredPatterns, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    const limit = Number(itemsPerPage) || 24;
    return Math.ceil(filteredPatterns.length / limit) || 1;
  }, [filteredPatterns, itemsPerPage]);

  // Cart Operations
  const handleAddToCart = (pattern, format, sizePref) => {
    const compositeId = `${pattern.id}-${format}`;
    const price = pattern.pricePDF || pattern.price || 0;

    setCartItems((prevItems) => {
      const existing = prevItems.find((item) => item.id === compositeId);
      if (existing) {
        return prevItems.map((item) =>
          item.id === compositeId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      const image = getPatternImageSource(pattern, { allowBlob: true });
      return [
        ...prevItems,
        {
          id: compositeId,
          pattern: {
            ...pattern,
            image,
            primaryImage: image || pattern.primaryImage || ''
          },
          format,
          sizePreference: sizePref,
          price,
          quantity: 1
        }
      ];
    });

    addToast(
      `"${pattern.name}" (${format}) added to your Perfect Fit cart.`,
      'cart',
      'Added to Cart',
      { image: getPatternImageSource(pattern, { allowBlob: true }), size: sizePref, format }
    );

    // Automatically open the cart drawer when adding an item to feel highly responsive
    // Desktop may open the cart automatically.
// On mobile, keep the customer in the catalogue after adding an item.
const isMobileViewport = window.matchMedia('(max-width: 767px)').matches;

if (!isMobileViewport) {
  setTimeout(() => {
    setIsCartOpen(true);
  }, 450);
}
  };

  const handleUpdateQuantity = (id, delta) => {
    setCartItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id) {
          const nextQty = item.quantity + delta;
          return nextQty > 0 ? { ...item, quantity: nextQty } : item;
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (id) => {
    setCartItems((prevItems) => {
      const removedItem = prevItems.find(item => item.id === id);
      if (removedItem) {
        addToast(`"${removedItem.pattern.name}" removed from cart.`, 'info', 'Item Removed');
      }
      return prevItems.filter((item) => item.id !== id);
    });
  };

  const handleClearCart = () => {
    setCartItems([]);
    addToast('Your active session cart has been cleared.', 'info', 'Cart Cleared');
  };

  // Cart summary stats
  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const totalCartValue = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  if (viewMode === 'mobile') {
    return (
      <div className="min-h-screen bg-[#F5EFEB] flex flex-col justify-start items-center">
        {/* Style tag same as desktop to share Cormorant / Outfit / Mono font files */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

          .font-sans {
            font-family: 'Outfit', sans-serif;
          }
          .font-serif {
            font-family: 'Cormorant Garamond', serif;
          }
          .font-mono {
            font-family: 'JetBrains Mono', monospace;
          }
        `}</style>

        {/* Global utility banner */}
        <div className="w-full bg-bark-950 text-sand-300 py-2.5 px-4 text-[10px] font-mono flex items-center justify-between border-b border-bark-900 z-50">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{pfUiT("ui.app.1653c69999")}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('desktop')}
              className="text-sand-400 hover:text-white transition-colors cursor-pointer text-[10px] font-bold tracking-wider"
            >{pfUiT("ui.app.b311a4d421")}</button>
            <span className="text-bark-850">|</span>
            <span className="text-white font-bold font-mono uppercase tracking-wider">{pfUiT("ui.app.844ff4decc")}</span>
          </div>
        </div>

        {/* Mobile Mockup device container (simulating a phone) */}
        <div className="w-full max-w-md h-[840px] shadow-2xl relative my-4 flex-1 flex flex-col border border-sand-200 bg-white">
          <MobileAppView
            patterns={productPresentationPatterns}
            cartItems={cartItems}
            onAddToCart={handleAddToCart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            currentUser={currentUser}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            reviews={reviews}
            onAddReview={handleAddReview}
          />
        </div>
      </div>
    );
  }

  const isGateActive = isAppLoginDependent && !currentUser;

  if (isGateActive) {
    return (
      <div className="min-h-screen bg-[#1c1917] text-sand-50 flex items-center justify-center p-6 selection:bg-clay-600 selection:text-sand-50" id="login-gate-screen">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
          .font-sans { font-family: 'Outfit', sans-serif; }
          .font-serif { font-family: 'Cormorant Garamond', serif; }
          .font-mono { font-family: 'JetBrains Mono', monospace; }
        `}</style>

        <div className="max-w-md w-full bg-[#292524] border border-stone-800 rounded-[4px] p-8 space-y-6 text-center shadow-2xl relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-clay-605 rounded-full flex items-center justify-center border-4 border-[#1c1917] shadow-lg">
            <Lock className="w-5 h-5 text-white" />
          </div>

          <div className="space-y-2 pt-4">
            <span className="text-[10px] uppercase tracking-[0.25em] text-clay-400 font-mono block">{pfUiT("ui.app.fd5e6476a6")}</span>
            <h1 className="text-3xl font-serif font-light text-white uppercase tracking-wide">Perfect Fit Bureau</h1>
            <div className="h-0.5 bg-stone-800 w-16 mx-auto" />
          </div>

          <p className="text-xs text-stone-300 leading-relaxed font-sans">{pfUiT("ui.app.0aa0352292")}<strong>{pfUiT("ui.app.a7e9d03d53")}</strong>{pfUiT("ui.app.570ce950bf")}</p>

          <div className="bg-stone-900/50 border border-stone-800 p-4 rounded-xl space-y-3">
            <span className="text-[9px] font-mono uppercase text-clay-300 block tracking-wider font-bold">{pfUiT("ui.app.3f9a5ea288")}</span>
            <button
              onClick={() => {
                const adminUser = {
                  fullName: 'Executive Administrator',
                  email: 'admin@perfectfit.com',
                  role: 'administrator',
                  tier: 'System Chief Admin',
                  avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80',
                  bio: 'Perfect Fit Operations Director with administrator credentials.',
                  creationGallery: []
                };
                setCurrentUser(adminUser);
              }}
              className="w-full bg-clay-650 hover:bg-clay-600 text-white text-xs font-semibold py-2.5 rounded-lg transition-all cursor-pointer shadow-3xs flex items-center justify-center gap-2"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>{pfUiT("ui.app.8390124044")}</span>
            </button>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-stone-400 hover:text-white text-xs font-semibold uppercase tracking-wider underline cursor-pointer"
            >{pfUiT("ui.app.b60311bb13")}</button>
          </div>
        </div>

        <MemberManagement
  onLoginSuccess={(user) => {
  addToast(`Welcome back, ${user.fullName}. Authenticated successfully.`, 'success', 'Session Activated');

}}
onLogout={() => {
  addToast('You have signed out of your Perfect Fit Bureau session.', 'info', 'Session Deactivated');
}}
  currentUser={currentUser}
  setCurrentUser={setCurrentUser}
  isOpen={isAuthModalOpen}
  onClose={() => setIsAuthModalOpen(false)}
  onOpenAdminConsole={() => {
    goToView("admin");
  }}
  patterns={displayedWorkspaceProducts}
  commercialPromotions={commercialPromotions}
  onUndisplayProduct={handleUndisplayPublishedProduct}
/>
      </div>
    );
  }

  return (
    <RoleProvider currentUser={currentUser}>
      <div className="min-h-screen bg-[#FAF8F5] bg-gradient-to-b from-[#FAF8F5] via-[#FFFDFB] to-[#F5EFEB] text-bark-900 selection:bg-clay-600 selection:text-sand-50" id="main-application-container">
      {/* Dynamic Fonts Import */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        .font-sans {
          font-family: 'Outfit', sans-serif;
        }
        .font-serif {
          font-family: 'Cormorant Garamond', serif;
        }
        .font-mono {
          font-family: 'JetBrains Mono', monospace;
        }

        #main-sections > *:first-child {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
      `}</style>

      {/* Global Navigation Bar */}
      <nav
        className="sticky top-0 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-sand-200/45 transition-all duration-300"
        style={{ zIndex: UI_LAYERS.navigation }}
        id="navigation-bar"
      >
        <div className={`relative ${PAGE_SHELL_CLASS} py-4 flex items-center justify-between`} id="nav-inner-row">

          {/* Logo / Brand Name */}
          <button
  type="button"
  onClick={() => goToView("home")}
  className="flex items-center gap-2 group appearance-none bg-transparent border-0 p-0 cursor-pointer text-left"
  id="brand-logo-link"
  aria-label={t('header.brandHomeAria')}
>
  <div className="flex flex-col leading-none" id="brand-logo-text">
    <span className="font-serif text-xl font-light uppercase tracking-[0.18em] text-bark-950 block">
      PERFECT FIT
    </span>
    <span className="text-[7.5px] tracking-[0.35em] text-bark-400 block uppercase font-mono mt-1 font-semibold">
      BUREAU
    </span>
  </div>
</button>
          {/* Grouped Dropdown Navigation Menu */}
          <div className="hidden md:block" id="explore-dropdown-container">
            <button
              onClick={() => setIsExploreOpen(!isExploreOpen)}
              className="flex items-center gap-1.5 px-3 py-2 text-bark-900 hover:text-[#ba6446] transition-all text-[11px] font-bold uppercase tracking-wider cursor-pointer font-sans"
              id="explore-dropdown-button"
              type="button"
            >
              <span>{t('nav.explore')}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-bark-500 transition-transform duration-300 ${isExploreOpen ? 'rotate-180 text-[#ba6446]' : ''}`} />
            </button>

            <AnimatePresence>
  {isExploreOpen && (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className="absolute left-1/2 top-full -translate-x-1/2 mt-2.5 w-[1120px] max-w-[calc(100vw-2rem)] bg-white border border-sand-200 shadow-lg rounded-[4px] p-4"
      style={{ zIndex: UI_LAYERS.navigationMenu }}
      id="explore-dropdown-panel"
    >
      <div
        className="grid gap-x-4 gap-y-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
      >
        {exploreMenuGroups.map((menuGroup) => (
          <div key={menuGroup.title} className="min-w-0 space-y-1.5">
            <span className="text-[8.5px] font-mono font-bold text-clay-700 tracking-wider uppercase border-b border-sand-100 pb-1.5 block whitespace-nowrap">
              {menuGroup.title}
            </span>

            <div className="grid gap-1">
              {menuGroup.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.action === "openConsultation") {
                      setIsConsultationOpen(true);
                    } else if (item.action === "openMaterials") {
                      setIsFabricStashOpen(true);
                    } else {
                      goToView(item.targetView);
                    }
                    setIsExploreOpen(false);
                  }}
                  className="group flex min-h-[50px] flex-col justify-start rounded px-2 py-1.5 text-left transition-colors hover:bg-[#FAF8F5]"
                >
                  <span className="text-xs font-bold text-bark-900 group-hover:text-[#ba6446] transition-colors">
                    {item.label}
                  </span>
                  <span className="mt-0.5 text-[9px] leading-[1.25] text-bark-450 normal-case tracking-normal">
                    {item.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )}
</AnimatePresence>
          </div>

          {/* Header Search Bar */}
          <div className="hidden md:flex items-center relative min-w-[140px] max-w-[180px] xl:max-w-xs w-full flex-shrink-0" id="header-search-wrapper">
            <button
              onClick={() => {
                document.getElementById('header-search-input')?.focus();
                const el = document.getElementById('gallery-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="absolute left-3.5 p-0.5 text-bark-400 hover:text-clay-605 transition-colors cursor-pointer flex items-center justify-center z-10"
              title={t('header.searchCatalogTitle')}
              type="button"
              id="header-search-icon-btn"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <input
              type="text"
              placeholder={t('header.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsHeaderSearchFocused(true);
              }}
              onFocus={() => setIsHeaderSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsHeaderSearchFocused(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const el = document.getElementById('gallery-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  setIsHeaderSearchFocused(false);
                }
              }}
              className="w-full bg-[#FAF8F5] border border-sand-200/85 hover:border-sand-350 text-bark-800 text-[11px] font-sans pl-10 pr-8 py-1.5 rounded-full focus:outline-none focus:border-clay-500 focus:bg-white placeholder-bark-450 transition-all shadow-3xs"
              id="header-search-input"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setIsHeaderSearchFocused(false);
                }}
                className="p-1 hover:bg-sand-150 rounded-full text-bark-400 hover:text-bark-700 transition-colors cursor-pointer absolute right-2.5 flex items-center justify-center"
                id="header-search-clear-btn"
                type="button"
                title={t('header.clearSearch')}
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Live Autocomplete Suggestions Dropdown */}
            <AnimatePresence>
              {isHeaderSearchFocused && matchingDropdownPatterns.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-1/2 -translate-x-[40%] mt-2.5 w-[860px] max-w-[calc(100vw-2rem)] bg-white border border-sand-200 shadow-lg rounded-[4px] p-4"
                  style={{ zIndex: UI_LAYERS.navigationMenu }}
                  id="header-search-dropdown-panel"
                >
                  <div className="px-3 py-1.5 bg-sand-50/50 text-[8.5px] font-mono font-bold uppercase tracking-wider text-bark-400 flex justify-between items-center">
                    <span>{t('header.suggestedBlueprints')}</span>
                    <span className="text-[7.5px] font-semibold text-[#e0a894]">{t('header.clickToOpenQuickView')}</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto divide-y divide-sand-100">
                    {matchingDropdownPatterns.map((pattern) => (
                      <div
                        key={pattern.id}
                        onMouseDown={() => {
                          setQuickViewPattern(pattern);
                          setSearchQuery('');
                          setIsHeaderSearchFocused(false);
                        }}
                        className="flex items-center gap-3 p-2.5 hover:bg-[#FAF8F5] cursor-pointer transition-colors"
                      >
                        <img
                          src={pattern.image}
                          alt={pattern.name}
                          className="w-10 h-12 object-cover rounded-[2px] border border-sand-200/60 flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <h5 className="font-serif text-xs font-semibold text-bark-950 truncate leading-tight">
                            {pattern.name}
                          </h5>
                          <p className="text-[9.5px] text-[#e0a894] font-medium leading-none font-sans italic truncate mt-0.5">
                            "{pattern.tagline || 'Modern elegance'}"
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[8px] font-mono bg-sand-100 px-1 py-0.2 rounded text-bark-500 uppercase">
                              {pattern.category}
                            </span>
                            <span className="text-[8px] font-mono text-bark-400">
                              • {pattern.difficulty}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-xs font-serif font-bold text-[#ba6446]">
                            ${(pattern.pricePDF || pattern.price || 0).toFixed(2)}
                          </span>
                          <span className="block text-[7px] font-mono text-bark-400 uppercase tracking-tight">{t('header.pdfSpec')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {filteredPatterns.length > 5 && (
                    <div
                      className="px-3 py-2 bg-sand-50/30 text-center border-t border-sand-100 cursor-pointer hover:bg-sand-100/45 transition-colors"
                      onMouseDown={() => {
                        setIsHeaderSearchFocused(false);
                        const el = document.getElementById('gallery-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      <span className="text-[9px] font-mono uppercase tracking-wider text-bark-500 hover:text-[#ba6446] transition-colors font-bold">
                        {t('header.viewAllMatches', { count: filteredPatterns.length })}
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Row - Cart Status & Member Indicator */}
          <div className="flex items-center gap-2.5 flex-shrink-0" id="nav-action-row">
            <HeaderLanguageSelector
              locale={locale}
              setLocale={setLocale}
              t={t}
              languages={languages}
              compact
              className="hidden md:inline-flex"
            />

            {/* User Profile / Authentication Badge */}
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-bark-850 hover:text-[#ba6446] hover:bg-sand-100/50 border border-transparent rounded-lg px-2.5 py-2 flex items-center gap-2 transition-all text-xs font-semibold cursor-pointer active:scale-[0.98]"
              id="header-profile-widget"
              title={t('header.manageMembership')}
            >
              {currentUser ? (
                <>
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.fullName}
                      className="w-9 h-9 rounded-full object-cover border border-clay-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-9 h-9 bg-clay-100 text-[#ba6446] rounded-full flex items-center justify-center font-bold text-[10px] uppercase">
                      {currentUser.fullName.slice(0, 2)}
                    </div>
                  )}
                  <span className="hidden sm:inline font-sans truncate max-w-[80px]">{currentUser.fullName}</span>
                </>
              ) : (
                <>
                  <User className="w-4 h-4 text-bark-500" />
                  <span className="hidden sm:inline font-sans uppercase tracking-wider text-[9px] font-bold">{t('auth.signIn')}</span>
                </>
              )}
            </button>

            {/* Wishlist */}
            <button
              onClick={() => setIsWishlistOpen(true)}
              className="text-bark-850 hover:text-[#ba6446] hover:bg-sand-100/50 rounded-lg px-2.5 py-2 flex items-center gap-1.5 transition-all text-xs font-semibold cursor-pointer active:scale-[0.98]"
              id="header-wishlist-gauge"
            >
              <div className="relative" id="wishlist-badge-wrapper">
                <Heart className={`w-4 h-4 ${favorites.length > 0 ? 'fill-rose-500 text-rose-500' : 'text-bark-500'}`} id="nav-wishlist-icon" />
                {favorites.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[8px] font-mono font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full border border-white" id="wishlist-badge-count">
                    {favorites.length}
                  </span>
                )}
              </div>
              <span className="hidden xl:inline font-sans uppercase tracking-wider text-[9px] font-bold" id="wishlist-gauge-text">
                {t('nav.wishlist')}
              </span>
            </button>

            {/* Shopping Cart */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="bg-bark-900 hover:bg-bark-950 text-sand-50 rounded-full pl-3.5 pr-4 py-2 flex items-center gap-2 transition-all text-xs font-bold shadow-3xs cursor-pointer active:scale-[0.98]"
              id="header-cart-gauge"
            >
              <div className="relative" id="gauge-badge-wrapper">
                <ShoppingBag className="w-4 h-4 text-sand-50" id="nav-bag-icon" />
                {totalCartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#ba6446] text-sand-50 text-[8px] font-mono font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full border border-bark-900" id="badge-count">
                    {totalCartCount}
                  </span>
                )}
              </div>
              <span className="hidden md:inline font-sans uppercase tracking-wider text-[9px] font-bold" id="gauge-text">
                {totalCartCount > 0 ? t('nav.cartWithCount', { count: totalCartCount }) : t('nav.cart')}
              </span>
              {totalCartCount > 0 && (
                <span className="font-mono text-sand-300 border-l border-white/20 pl-1.5 hidden md:inline" id="gauge-amount">
                  ${totalCartValue.toFixed(2)}
                </span>
              )}
            </button>

            {/* Mobile Navigation Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg border border-transparent hover:bg-sand-100/50 text-bark-900 transition-all cursor-pointer active:scale-[0.98]"
              id="header-mobile-menu-button"
              aria-label={t('nav.toggleMenu')}
            >
              {isMobileMenuOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-sand-200 bg-white overflow-hidden shadow-sm"
              id="mobile-navigation-menu"
            >
              <div className="px-4 py-4 space-y-3 flex flex-col text-xs font-semibold text-bark-500 uppercase tracking-widest">
                {/* Mobile Dropdown Search Input */}
                <div className="relative mb-2.5 shrink-0" id="mobile-nav-search-wrapper">
                  <Search className="w-3.5 h-3.5 text-bark-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={t('header.mobileSearchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsMobileSearchFocused(true);
                    }}
                    onFocus={() => setIsMobileSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsMobileSearchFocused(false), 200)}
                    className="w-full bg-sand-50/60 border border-sand-200 text-bark-800 text-[11px] pl-9 pr-8 py-2 rounded-lg focus:outline-none focus:border-clay-450 placeholder-bark-400/80 font-normal normal-case tracking-normal font-sans"
                    id="mobile-nav-search-input"
                    autoComplete="off"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setIsMobileSearchFocused(false);
                      }}
                      className="p-1 hover:bg-sand-150 rounded-full text-bark-400 hover:text-bark-700 transition-colors cursor-pointer absolute right-2.5 top-1.5 flex items-center justify-center"
                      id="mobile-nav-search-clear-btn"
                      type="button"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Mobile Autocomplete Dropdown */}
                  {isMobileSearchFocused && searchQuery && matchingDropdownPatterns.length > 0 && (
                    <div className="mt-2.5 border border-sand-200 bg-white rounded-lg overflow-hidden divide-y divide-sand-100 shadow-lg relative z-50 max-h-[250px] overflow-y-auto" id="mobile-search-autocomplete">
                      <div className="px-3 py-1.5 bg-sand-50/60 text-[8.5px] font-mono uppercase tracking-wider text-bark-400 font-bold flex justify-between items-center">
                        <span>{t('header.matchingPatterns')}</span>
                        <span className="text-[7px] text-[#e0a894] font-semibold">{t('header.tapToView')}</span>
                      </div>
                      {matchingDropdownPatterns.map((pattern) => (
                        <div
                          key={pattern.id}
                          onMouseDown={() => {
                            setQuickViewPattern(pattern);
                            setSearchQuery('');
                            setIsMobileMenuOpen(false);
                            setIsMobileSearchFocused(false);
                            const el = document.getElementById('gallery-section');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="w-full text-left flex items-center gap-2.5 p-2.5 hover:bg-[#FAF8F5] cursor-pointer transition-colors"
                        >
                          <img
                            src={pattern.image}
                            alt={pattern.name}
                            className="w-8 h-10 object-cover rounded-[2px] border border-sand-100 flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 min-w-0">
                            <h6 className="font-serif text-xs font-semibold text-bark-950 truncate leading-tight normal-case tracking-normal">
                              {pattern.name}
                            </h6>
                            <div className="flex items-center gap-1.5 mt-0.5 font-normal tracking-normal normal-case">
                              <span className="text-[7.5px] font-mono text-clay-700 font-bold">
                                {pattern.category}
                              </span>
                              <span className="text-[7.5px] font-mono text-bark-400">
                                • {pattern.difficulty}
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 font-normal tracking-normal normal-case">
                            <span className="text-[11px] font-serif font-bold text-[#ba6446]">
                              ${(pattern.pricePDF || pattern.price || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <HeaderLanguageSelector
                  locale={locale}
                  setLocale={setLocale}
                  t={t}
                  languages={languages}
                  className="w-full justify-between bg-sand-50/70 px-3 py-2"
                />

                {/* Metadata-driven mobile navigation */}
<div className="space-y-5">
  {exploreMenuGroups.map((menuGroup) => (
    <div
      key={menuGroup.title}
      className="space-y-1.5"
    >
      <div className="border-b border-sand-100 pb-1.5 text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-clay-700">
        {menuGroup.title}
      </div>

      <div className="space-y-0.5">
        {menuGroup.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);

              if (item.action === 'openConsultation') {
                setIsConsultationOpen(true);
                return;
              }

              if (item.action === 'openMaterials') {
                setIsFabricStashOpen(true);
                return;
              }

              goToView(item.targetView);
            }}
            className="flex w-full items-start justify-between gap-3 border-b border-sand-100/40 py-2.5 text-left transition-colors hover:text-[#ba6446]"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-bark-800">
                {item.label}
              </div>

              {item.description && (
                <div className="mt-0.5 text-[9px] font-normal normal-case tracking-normal text-bark-400">
                  {item.description}
                </div>
              )}
            </div>

            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bark-350" />
          </button>
        ))}
      </div>
    </div>
  ))}
</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      {/* Primary Landing Page Container */}
      <main className={MAIN_PAGE_SHELL_CLASS} id="main-sections">

        {visibleSections.map((section) => {
          const registryRenderer = SECTION_RENDERERS[section.component];

  if (registryRenderer) {
    return registryRenderer(section);
  }

          switch (section.component) {
            case 'HeroCarousel':
               return (
                <HeroCarousel
                  key={section.id}
                  onExploreCatalog={() => {
                  setActiveView("patterns");
                   window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onOpenSizingCalculator={() => {
                  setActiveView("workspace");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              );
            case 'OrbitCarousel':
              return (
                <motion.section
                  key={section.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="pt-4"
                  id="orbital-featured-section"
                >
                  {isCarouselLoading ? (
                    <OrbitCarouselSkeleton />
                  ) : (
                    <OrbitCarousel
                      patterns={selectPatternsForSurface(productPresentationPatterns, 'orbit-carousel', 4)}
                      activePatternId={activePatternId}
                      setActivePatternId={setActivePatternId}
                      activeRecommendedSize={DEFAULT_LEGACY_PATTERN_SIZE}
                      onAddToCart={handleAddToCart}
                      reviews={reviews}
                      onAddReview={handleAddReview}
                      currentUser={currentUser}
                      detailTab={featuredDetailTab}
                      setDetailTab={setFeaturedDetailTab}
                      onQuickView={(p) => setQuickViewPattern(p)}
                      quickViewPattern={quickViewPattern}
                      onCloseQuickView={() => setQuickViewPattern(null)}
                    />
                  )}
                </motion.section>
              );
            case 'DynamicUiEngine':
              return (
                <motion.section
                  key={section.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-6"
                  id="dynamic-metadata-ui-section"
                >
                  <DynamicUiEngine
                    currentUser={currentUser}
                    onForceLoginTrigger={(gated) => setIsAppLoginDependent(gated)}
                    isAdminWorkspace={false}
                  />
                </motion.section>
              );
            case 'DynamicLayout':
              return (
                <motion.section
                  key={section.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-6"
                  id="role-based-dynamic-layout-section"
                >
                  <DynamicLayout
                    appLayout={appLayout}
                    setAppLayout={setAppLayout}
                    onResetLayout={handleResetLayout}
                  />
                </motion.section>
              );
            case 'DynamicGallery':
              return (
                <motion.section
                  key={section.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-5 overflow-visible"
id="gallery-section"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-sand-200 pb-3">
                    <div>
                      <span className="text-[9px] text-clay-700 font-bold uppercase tracking-[0.25em] block mb-1">
                        {section.title || "The Curated Pattern Collection"}
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-serif font-light text-bark-950 tracking-tight">
                        {section.description || "Explore Our Style Collection"}
                      </h2>
                    </div>

                    {/* Premium Layout Toggle Switcher in the Section Header */}
                    {SHOW_CATALOGUE_VIEW_MODE_TOGGLES && (
                    <div className="flex items-center bg-sand-100 p-0.5 rounded-lg border border-sand-200/60 font-sans text-xs self-start sm:self-auto shrink-0" id="gallery-layout-view-toggle">
                      <button
                        onClick={() => setGalleryViewMode('showcase')}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                          galleryViewMode === 'showcase'
                            ? 'bg-white text-[#ba6446] shadow-3xs'
                            : 'text-bark-500 hover:text-bark-900'
                        }`}
                        title={pfUiT("ui.app.95adda62fd")}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{pfUiT("ui.app.751a77e31e")}</span>
                      </button>
                      <button
                        onClick={() => setGalleryViewMode('grid')}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                          galleryViewMode === 'grid'
                            ? 'bg-white text-bark-800 shadow-3xs'
                            : 'text-bark-500 hover:text-bark-900'
                        }`}
                        title={pfUiT("ui.app.6c876d7c1c")}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>{pfUiT("ui.app.4f7be347b8")}</span>
                      </button>
                    </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] gap-7 items-start overflow-visible">
                    <CatalogSidebarNavigator
                      selectedAudience={catalogAudienceFilter}
                      selectedCategory={catalogCategoryFilter}
                      selectedDifficulty={catalogDifficultyFilters}
                      selectedPriceRanges={catalogPriceRangeFilters}
                      selectedRatings={catalogRatingFilters}
                      selectedDesigner={catalogDesignerFilter}
                      showFavoritesOnly={showFavoritesOnly}
                      designerBrands={catalogDesignerBrands}
                      patterns={productPresentationPatterns}
                      onAudienceChange={setCatalogAudienceFilter}
                      onCategoryChange={handleCatalogCategoryToggle}
                      onCategoryClear={() => setCatalogCategoryFilter([])}
                      onDifficultyChange={handleCatalogDifficultyToggle}
                      onPriceRangeChange={handleCatalogPriceRangeToggle}
                      onRatingChange={handleCatalogRatingToggle}
                      onFavoritesChange={setShowFavoritesOnly}
                      onDesignerChange={setCatalogDesignerFilter}
                      onResetFilters={resetCatalogFilters}
                      isCollapsed={isCatalogSidebarCollapsed}
                      onCollapsedChange={setIsCatalogSidebarCollapsed}
                    />

                    <div className="min-w-0 space-y-8 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
  <motion.div
    layout
    transition={{
      layout: {
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1]
      }
    }}
    className="min-h-[760px]"
  >
  {SHOW_CATALOGUE_VIEW_MODE_TOGGLES && galleryViewMode === 'showcase' ? (
                        <PatternImageGallery
                          patterns={filteredPatterns}
                          catalogColumns={isCatalogSidebarCollapsed ? 4 : 3}
                          onAddToCart={handleAddToCart}
                          onQuickView={setQuickViewPattern}
                          onSelect={(patternId) => {
                            setActivePatternId(patternId);
                            setFeaturedDetailTab('features');
                            const el = document.getElementById('orbital-featured-section');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          favorites={favorites}
                          onToggleFavorite={handleToggleFavorite}
                          activePatternId={activePatternId}
                        />
                      ) : (
                        <DynamicGallery
                          patterns={filteredPatterns}
                          loading={patternsRepositoryState.loading}
                          error={patternsRepositoryState.error}
                          catalogColumns={isCatalogSidebarCollapsed ? 4 : 3}
                          onAddToCart={handleAddToCart}
                          activeRecommendedSize={DEFAULT_LEGACY_PATTERN_SIZE}
                          reviews={reviews}
                          onAddReview={handleAddReview}
                          favorites={favorites}
                          onToggleFavorite={handleToggleFavorite}
                          onQuickView={setQuickViewPattern}
                          viewMode={galleryViewMode}
                          onViewModeChange={setGalleryViewMode}
                          onExploreSwatches={(patternId) => {
                            setActivePatternId(patternId);
                            setFeaturedDetailTab('swatches');
                            const el = document.getElementById('orbital-featured-section');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                        />
                      )}</motion.div>
                    </div>
                  </div>


               </motion.section>
              );
            case 'MyOrdersSection':
              return (
                <motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <MyOrdersSection
                    currentUser={currentUser}
                    guestOrders={guestOrders}
                    onOpenAuthModal={() => setIsAuthModalOpen(true)}
                    onLoadDemoOrders={isDemoRuntimeDataEnabled() ? handleLoadDemoOrders : undefined}
                  />
                </motion.div>
              );
            case 'SewingSessionTimer':
              return (
                <motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <SewingSessionTimer patterns={patterns} />
                </motion.div>
              );
            case 'CreationsAndFeedback':
              return (
                <motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <CreationsAndFeedback
                    patterns={productPresentationPatterns}
                    currentUser={currentUser}
                    onAddReview={handleAddReview}
                  />
                </motion.div>
              );
            case 'TestimonialCarousel':
              return (
                <motion.section
                  key={section.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="pt-6"
                  id="testimonials-section"
                >
                  <TestimonialCarousel />
                </motion.section>
              );
            case 'MannequinGuide':
              return (
                <motion.section
                  key={section.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="pt-6"
                  id="calculator-section"
                >
                  <MannequinGuide
                    patterns={productPresentationPatterns}
                  />
                </motion.section>
              );
            case 'PerfectFitStandards':
              return (
                <motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <PerfectFitStandards />
                </motion.div>
              );
            case 'PerfectFitFaq':
              return (
                <motion.section
                  key={section.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className={`${PAGE_SHELL_CLASS} pt-4 sm:pt-6`}
                  id="perfectfit-faq-section-wrapper"
                >
                  <PerfectFitFaq />
                </motion.section>
              );
            case 'EditorialAcademy':
              return (
                <motion.section
                  key={section.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="pt-6"
                  id="atelier-library-section"
                >
                  <EditorialAcademy
                    isLoggedIn={!!currentUser}
                    userRole={currentUser?.role}
                  />
                </motion.section>
              );
            case 'CreatorBlog':
              return (
                <motion.section
                  key={section.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="pt-6"
                  id="creator-community-blog-section"
                >
                  <CreatorBlog />
                </motion.section>
              );
            default:
              return null;
          }
        })}

      </main>

      {/* Atmospheric Perfect Fit newsletter footer */}
      {isSurfaceVisible(surfaceVisibility, 'global.footer') && (
      <footer className="bg-[#1c1917] text-[#f5efe7] border-t border-[#3b2f28] py-12 mt-14" id="landing-footer">
        <div className={`${PAGE_SHELL_CLASS} space-y-10`} id="footer-inner">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start" id="footer-grid">

            {/* Branding detail */}
            <div className="md:col-span-5 space-y-4" id="footer-branding">
              <div className="flex items-center gap-2.5" id="footer-logo">
                <div className="w-8 h-8 rounded-[4px] border border-sand-400 flex items-center justify-center text-sand-50 font-serif font-bold" id="footer-logo-ring">
                  P
                </div>
                <h4 className="font-serif text-sand-50 text-base uppercase tracking-wider">Perfect Fit Bureau</h4>
              </div>
              <p className="text-xs text-sand-300/80 leading-relaxed max-w-sm" id="footer-tag-desc">{pfUiT("ui.app.13a6e689db")}</p>
            </div>

            {/* Core references links */}
            <div className="md:col-span-3 space-y-3 text-xs" id="footer-links-column">
              <h5 className="font-serif text-sand-105 tracking-wider font-semibold">{pfUiT("ui.app.6980d33b3c")}</h5>
              <ul className="space-y-2 text-sand-300">
                <li><a href="#gallery-section" className="hover:text-clay-400 transition-colors">{pfUiT("ui.app.a10df72f47")}</a></li>
                <li><a href="#gallery-section" className="hover:text-clay-400 transition-colors">{pfUiT("ui.app.0a7b4a5b4c")}</a></li>
                <li><a href="#gallery-section" className="hover:text-clay-400 transition-colors">{pfUiT("ui.app.aff665cf7d")}</a></li>
                <li><a href="#gallery-section" className="hover:text-clay-400 transition-colors">{pfUiT("ui.app.47f324475d")}</a></li>
                <li><a href="#creator-community-blog-section" className="hover:text-clay-400 transition-colors">Creator Blog &amp; Feed</a></li>
              </ul>
            </div>

            {/* Newsletter prompt */}
            {isSurfaceVisible(surfaceVisibility, 'global.newsletter') && (
            <div className="md:col-span-4" id="footer-newsletter">
              <StayInspiredNewsletter addToast={addToast} />
            </div>
            )}

          </div>

          {/* Trademark details */}
          <div className="border-t border-bark-900 pt-8 flex flex-col sm:flex-row justify-between items-center text-[10px] text-sand-400/70 gap-4" id="footer-bottom">
            <p id="copyright">{pfUiT("ui.app.89757e2e56")}</p>
            <div className="flex gap-4" id="socials">
              <button
                onClick={() => setIsDevModalOpen(true)}
                className="hover:text-sand-100 transition-colors text-[10px] text-sand-400/70 font-sans cursor-pointer bg-transparent border-none p-0 outline-none flex items-center gap-1 font-semibold"
                id="footer-dev-integration-btn"
              >
                <Code className="w-3 h-3 text-clay-400" />{pfUiT("ui.app.f3b08bcdde")}</button>
              <a href="javascript:void(0)" className="hover:text-sand-100 transition-colors">{pfUiT("ui.app.20e2afc99b")}</a>
              <a href="javascript:void(0)" className="hover:text-sand-100 transition-colors">{pfUiT("ui.app.b197caa11b")}</a>
              <a href="javascript:void(0)" className="hover:text-sand-100 transition-colors">{pfUiT("ui.app.416a232118")}</a>
            </div>
          </div>
        </div>
      </footer>
      )}

      {/* Developer Integration & ERP Mapping Guide */}
      <DeveloperIntegrationModal
        isOpen={isDevModalOpen}
        onClose={() => setIsDevModalOpen(false)}
        patterns={patterns}
        setPatterns={setPatterns}
      />

      {/* Shopping Cart Drawer / Panels */}
      <CheckoutDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItemsForCheckout}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        currentUser={currentUser}
        commercialPromotions={commercialPromotions}
        onOrderSuccess={handleOrderSuccess}
        onTrackOrder={(orderId) => {
          if (!isTrackShipmentEnabled) return;
          setTrackOrderId(orderId);
          setIsTrackOrderOpen(true);
        }}
      />

      {/* Wishlist Drawer Panel */}
      <WishlistDrawer
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        favorites={favorites}
        patterns={productPresentationPatterns}
        onToggleFavorite={handleToggleFavorite}
        onAddToCart={handleAddToCart}
        onQuickView={setQuickViewPattern}
      />

      {/* Track Order Modal */}
      {isTrackShipmentEnabled && (
        <TrackOrderModal
          isOpen={isTrackOrderOpen}
          onClose={() => {
            setIsTrackOrderOpen(false);
            setTrackOrderId('');
          }}
          currentUser={currentUser}
          guestOrders={guestOrders}
          onQuickView={setQuickViewPattern}
          initialOrderId={trackOrderId}
        />
      )}

      {/* Consultation Booking Modal */}
      <ConsultationBookingModal
        isOpen={isConsultationOpen}
        onClose={() => setIsConsultationOpen(false)}
        currentUser={currentUser}
      />

      {/* Clean, Minimal Stackable Toast Notifications */}
      <div
        className="fixed bottom-6 right-6 flex flex-col gap-3 max-w-sm w-full pointer-events-none"
        style={{ zIndex: UI_LAYERS.toast }}
        id="toast-notifications-container"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            // Determine type-specific colors, border, title and icon
            let bgClass = "bg-white border-sand-200 text-bark-800";
            let iconBgClass = "bg-sand-50 text-sand-600";
            let badgeText = "";
            let IconComponent = Info;

            if (toast.type === 'cart') {
              bgClass = "bg-[#FAF8F5] border-clay-200 text-bark-900 shadow-lux";
              iconBgClass = "bg-clay-50 text-clay-700";
              badgeText = "CART";
              IconComponent = ShoppingBag;
            } else if (toast.type === 'profile') {
              bgClass = "bg-[#FAF8F5] border-sage-200 text-bark-900 shadow-lux";
              iconBgClass = "bg-sage-50 text-sage-600";
              badgeText = "MEMBER";
              IconComponent = User;
            } else if (toast.type === 'erp') {
              bgClass = "bg-[#FAF8F5] border-sand-300 text-bark-900 shadow-lux";
              iconBgClass = "bg-sand-100 text-sand-800";
              badgeText = "ERP SYNC";
              IconComponent = RefreshCw;
            } else if (toast.type === 'success') {
              bgClass = "bg-white border-sage-200 text-bark-900 shadow-lux";
              iconBgClass = "bg-sage-50 text-sage-600";
              badgeText = "SUCCESS";
              IconComponent = Check;
            } else if (toast.type === 'warning') {
              bgClass = "bg-white border-amber-200 text-bark-900 shadow-lux";
              iconBgClass = "bg-amber-50 text-amber-600";
              badgeText = "WARNING";
              IconComponent = AlertTriangle;
            }

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.2 } }}
                layout
                className={`pointer-events-auto w-full border rounded-sm p-4 shadow-lux flex items-start gap-3.5 text-left transition-all duration-300 relative overflow-hidden ${bgClass}`}
                id={`toast-item-${toast.id}`}
              >
                {toast.meta?.image ? (
                  <div className="w-10 h-14 border border-sand-300 rounded-[2px] overflow-hidden shrink-0 shadow-3xs bg-white" id={`toast-meta-img-${toast.id}`}>
                    <img src={toast.meta.image} alt={toast.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <div className={`p-2 rounded-full shrink-0 ${iconBgClass}`} id={`toast-icon-${toast.id}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                )}
                <div className="space-y-1 flex-1 min-w-0" id={`toast-body-${toast.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="font-serif text-xs font-bold text-bark-950 tracking-tight truncate">
                      {toast.title || 'Notification'}
                    </h5>
                    {badgeText && (
                      <span className="font-mono text-[8px] font-bold tracking-wider text-bark-400 bg-sand-100/70 px-1.5 py-0.5 rounded-[2px] uppercase shrink-0">
                        {badgeText}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-bark-600 leading-relaxed font-sans">
                    {toast.message}
                  </p>
                </div>
                <button
                  onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="text-bark-400 hover:text-bark-700 p-0.5 cursor-pointer self-start shrink-0 z-10"
                  id={`toast-close-${toast.id}`}
                  type="button"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Elegant progress countdown indicator */}
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 4.5, ease: 'linear' }}
                  className={`absolute bottom-0 left-0 h-[2.5px] opacity-75 ${
                    toast.type === 'cart'
                      ? 'bg-clay-600'
                      : toast.type === 'profile'
                      ? 'bg-sage-600'
                      : toast.type === 'erp'
                      ? 'bg-sand-500'
                      : toast.type === 'success'
                      ? 'bg-sage-600'
                      : toast.type === 'warning'
                      ? 'bg-amber-600'
                      : 'bg-bark-400'
                  }`}
                  id={`toast-progress-${toast.id}`}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Interactive Account & Authentication Management Portal */}
      <MemberManagement
  isOpen={isAuthModalOpen}
  onClose={() => setIsAuthModalOpen(false)}
  currentUser={currentUser}
  setCurrentUser={setCurrentUser}
  patterns={displayedWorkspaceProducts}
  commercialPromotions={commercialPromotions}
  onUndisplayProduct={handleUndisplayPublishedProduct}
  onOpenAdminConsole={() => {
    goToView("admin");
    setIsAuthModalOpen(false);
  }}
  onLoginSuccess={(user) => {
    addToast(`Welcome back, ${user.fullName}. Authenticated successfully.`, 'success', 'Session Activated');
  }}
  onLogout={() => {
    addToast('You have signed out of your Perfect Fit Bureau session.', 'info', 'Session Deactivated');
  }}
/>

      {/* Pattern Quick Summary Modal */}
      <AnimatePresence>
        {quickViewPattern && (
          <PatternQuickViewModal
            pattern={quickViewPattern}
            onClose={() => setQuickViewPattern(null)}
            onAddToCart={handleAddToCart}
            onExploreSwatches={(patternId) => {
              setActivePatternId(patternId);
              setFeaturedDetailTab('swatches');
              const el = document.getElementById('orbital-featured-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            activeRecommendedSize={DEFAULT_LEGACY_PATTERN_SIZE}
            isFavorite={favorites.includes(quickViewPattern.id)}
            onToggleFavorite={handleToggleFavorite}
            reviews={reviews[quickViewPattern.id] || []}
            onAddReview={handleAddReview}
            currentUser={currentUser}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {moderatorReviewRequest && quickViewPattern && (
          <ModeratorPublicationReviewBar
            request={moderatorReviewRequest}
            workflow={publicationWorkflow}
            onClose={() => {
              setModeratorReviewRequest(null);
              setQuickViewPattern(null);
            }}
            onApprove={handleModeratorApprove}
            onReturn={handleModeratorReturn}
            onMessageDesigner={handleOpenModeratorMessage}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {moderatorMessageRequest && (
          <ModeratorPublicationMessenger
            open={Boolean(moderatorMessageRequest)}
            request={moderatorMessageRequest}
            storageKey={publicationMessageStorageKey}
            currentUser={currentUser}
            onClose={() => setModeratorMessageRequest(null)}
          />
        )}
      </AnimatePresence>

      <FabricStashModal
        isOpen={isFabricStashOpen}
        onClose={() => setIsFabricStashOpen(false)}
      />

      {/* Global Perfect Fit Message Center: one draggable/collapsible widget on every page. */}
      {isSurfaceVisible(surfaceVisibility, 'global.messages') && (
      <MessageCenterWidget
        currentUser={currentUser}
        workflowStorageKey={publicationMessageStorageKey}
        contextLabel="Perfect Fit"
      />
      )}

      <ProjectFocusWindow />

      {/* One-Time Shared Token Technical Spec & Development Secrets Modal */}
      <AnimatePresence>
        {sharedTokenAccess && (
          <div
            className="fixed inset-0 bg-stone-950/85 backdrop-blur-md flex items-center justify-center p-4"
            style={{ zIndex: UI_LAYERS.criticalDialog }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl max-w-2xl w-full p-6 md:p-8 shadow-2xl space-y-6 text-left relative overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => setSharedTokenAccess(null)}
                className="absolute top-4 right-4 text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-2 pr-8 border-b border-stone-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="bg-amber-400/10 border border-amber-400/20 text-amber-300 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-amber-400" />{pfUiT("ui.app.6c41c3acc1")}</span>
                  <span className="text-stone-400 text-xs font-mono">{pfUiT("ui.app.5bd2305857")}</span>
                </div>
                <h3 className="text-2xl font-serif text-amber-50">{sharedTokenAccess.pattern.name} — Technical Specs &amp; Secrets</h3>
                <p className="text-xs text-stone-300 leading-relaxed font-sans">{pfUiT("ui.app.a81feb4bab")}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                <div className="p-4 bg-stone-950/80 rounded-xl border border-stone-800 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-amber-300 font-bold block">{pfUiT("ui.app.b66fd2670e")}</span>
                  <p className="text-stone-300 leading-relaxed">
                    {sharedTokenAccess.pattern.description}
                  </p>
                  <div className="pt-2 text-[11px] font-mono text-stone-400 space-y-1">
                    <div>{pfUiT("ui.app.5b910b6a4a")}<span className="text-amber-100">{sharedTokenAccess.pattern.category}</span></div>
                    <div>{pfUiT("ui.app.ec7688cdfc")}<span className="text-amber-100">{sharedTokenAccess.pattern.difficulty}</span></div>
                    <div>{pfUiT("ui.app.8e47431088")}<span className="text-amber-100">{sharedTokenAccess.pattern.recommendedYards || '3.0 Yds'}</span></div>
                  </div>
                </div>

                <div className="p-4 bg-stone-950/80 rounded-xl border border-stone-800 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-amber-300 font-bold block">Seam Allowance &amp; Construction Secrets</span>
                  <p className="text-stone-300 font-mono text-[11px] leading-relaxed">
                    • Major Seam Allowance: 5/8" (1.5 cm)<br />
                    • Facing Seams: 3/8" (1.0 cm)<br />{pfUiT("ui.app.b464528b65")}</p>
                </div>
              </div>

              <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-xl flex items-center justify-between text-xs text-amber-200/90 font-mono">
                <span>Token Ref: {sharedTokenAccess.token.substring(0, 24)}...</span>
                <span className="font-bold text-amber-300">{pfUiT("ui.app.9483462540")}</span>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setSharedTokenAccess(null)}
                  className="bg-amber-400 hover:bg-amber-500 text-stone-950 text-xs font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md"
                >{pfUiT("ui.app.8a0151dbf0")}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </RoleProvider>
  );
}
