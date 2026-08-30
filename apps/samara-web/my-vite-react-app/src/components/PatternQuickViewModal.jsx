import { localizeMetadataTree } from '../lib/localizedMetadata';
import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingCart, Star, Heart, Check, Sparkles, Scissors, Compass, BookOpen, Twitter, Instagram, Share2, ZoomIn, ZoomOut, Move, ChevronDown, ChevronLeft, ChevronRight, Paintbrush, Video, ExternalLink, Facebook, Link, Eye, Ruler, Mail } from 'lucide-react';
import CustomerGalleryAndReviews from './CustomerGalleryAndReviews';
import MannequinGuide from './MannequinGuide';
import { getPatternMedia } from '../lib/patternMediaManager';
import { UI_LAYERS } from '../lib/uiLayers';
import {
  formatPublicHandle,
  formatRecipientDisplay,
  getUserRoutingId,
  normalizeUsername
} from '../lib/userIdentity';

const PinterestIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" />
  </svg>
);

const getDifficultyInfo = (diff) => {
  const copyMap = localizeMetadataTree(
    perfectFitMetadata.componentUi.patternDifficulty.quickView,
    'component.patternDifficulty.quickView',
    pfUiT
  );
  const copy = copyMap[diff] || { ...copyMap.default, label: diff || copyMap.default?.label || 'Intermediate' };
  if (diff === 'Beginner') return { ...copy, icon: Compass, classes: 'bg-emerald-50 text-emerald-700 border-emerald-100', iconColor: 'text-emerald-600' };
  if (diff === 'Advanced') return { ...copy, icon: Sparkles, classes: 'bg-rose-50 text-rose-700 border-rose-200', iconColor: 'text-rose-600' };
  if (diff === 'Intermediate') return { ...copy, icon: Scissors, classes: 'bg-amber-50 text-amber-700 border-amber-200', iconColor: 'text-amber-600' };
  return { ...copy, icon: Scissors, classes: 'bg-sand-50 text-bark-700 border-sand-200', iconColor: 'text-bark-500' };
};

const normalizeSizeToken = (value) =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/^(UK|US|EU|FR)\s+/, '')
    .replace(/\s+/g, '');

const QUICK_VIEW_SIZE_SYSTEM_TO_REFERENCE = {
  ALPHA: 'ALPHA',
  UK: 'UK',
  US: 'US',
  EU: 'EU',
  FR: 'FR',
  alpha: 'ALPHA',
  ukReference: 'UK',
  usReference: 'US',
  euReference: 'EU',
  patternNumericCore: 'DISPLAY',
  patternNumericCurve: 'DISPLAY',
  workspaceVariant: 'ALPHA'
};

const resolveRecommendationSizeForSystem = (canonicalSize, availableSizes = [], sizeSystemKey = '') => {
  if (!canonicalSize || !availableSizes.length) return '';

  const references = canonicalSize.references || {};
  const referenceCode = QUICK_VIEW_SIZE_SYSTEM_TO_REFERENCE[sizeSystemKey] || sizeSystemKey;
  const systemReference = references[referenceCode];

  // Retail-reference selectors must only consume the matching canonical reference.
  // Falling across UK/US/EU labels would produce a false conversion.
  const isRetailReference = ['UK', 'US', 'EU', 'FR'].includes(referenceCode);
  const directCandidates = [
    systemReference,
    ...(isRetailReference ? [] : [canonicalSize.label, references.DISPLAY, references.ALPHA])
  ].filter(Boolean);

  for (const candidate of directCandidates) {
    const exact = availableSizes.find((size) => String(size) === String(candidate));
    if (exact !== undefined) return String(exact);

    const normalized = normalizeSizeToken(candidate);
    const equivalent = availableSizes.find((size) => normalizeSizeToken(size) === normalized);
    if (equivalent !== undefined) return String(equivalent);
  }

  return '';
};

const getMaskForPattern = (patternId) => {
  switch (patternId) {
    case 'sartorial-01': // Aurelia Wrap Dress
      // Ellipse centered at 50% horizontal, 64% vertical, horizontal radius 26%, vertical radius 45%
      return 'radial-gradient(ellipse 26% 45% at 50% 64%, black 50%, transparent 85%)';
    case 'sartorial-02': // Atelier Utility Trench
      // Ellipse centered at 56% horizontal, 66% vertical, horizontal radius 28%, vertical radius 46%
      return 'radial-gradient(ellipse 28% 46% at 56% 66%, black 50%, transparent 85%)';
    case 'sartorial-03': // Atelier Drape Trouser
      // Ellipse centered at 50% horizontal, 75% vertical, horizontal radius 22%, vertical radius 38%
      return 'radial-gradient(ellipse 22% 38% at 50% 75%, black 50%, transparent 85%)';
    case 'sartorial-04': // Sari Silk Blouse
      // Ellipse centered at 50% horizontal, 48% vertical, horizontal radius 28%, vertical radius 25%
      return 'radial-gradient(ellipse 28% 25% at 50% 48%, black 50%, transparent 85%)';
    default:
      return 'radial-gradient(circle at 50% 50%, black 50%, transparent 85%)';
  }
};

// TODO: Final digital format options should come from EIP governed dropdown data.
const DIGITAL_FORMAT_OPTIONS = [
  'PDF',
  'DXF-AAMA',
  'DXF-ASTM',
  'AI/PDF',
  'OBJ',
  'FBX',
  'glTF/GLB',
  'Alembic',
  'USD'
];

// TODO: Final size systems, measurements, grading rules, cup/height rules and pattern-file size mappings must come from EIP governed pattern data.
// Disabled until print-prep workflow is rebuilt with real functionality.
const SHOW_PRINT_PREP_BLUEPRINT = false;

// Disabled until sewing tips workflow is ready for deployment.
const SHOW_SEWING_TIPS_TAB = false;

const getPatternAttribute = (pattern, keys = []) => {
  const sources = [
    pattern,
    pattern?.metadata,
    pattern?.attrs,
    pattern?.raw,
    pattern?.raw?.attrs,
    pattern?.raw?.values,
    pattern?.source,
    pattern?.source?.attrs,
    pattern?.source?.values
  ].filter(Boolean);

  for (const source of sources) {
    for (const key of keys) {
      if (source?.[key]) return source[key];
    }
  }

  return '';
};

const normalizeRecipientRouteToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const resolveDesignerRecipient = (pattern = {}) => {
  const explicitOwner = pattern.messagingOwner || {};
  const ownerIdentityId =
    explicitOwner.routingId ||
    explicitOwner.id ||
    pattern?.ownership?.ownerIdentityId ||
    pattern?.ownerIdentityId ||
    getPatternAttribute(pattern, [
      'ownerIdentityId',
      'owner_identity_id',
      'project.owner_identity_id',
      'projectOwnerIdentityId'
    ]);

  const designerObject =
    pattern.designer && typeof pattern.designer === 'object'
      ? pattern.designer
      : null;

  const email =
    designerObject?.email ||
    getPatternAttribute(pattern, [
      'designerEmail',
      'designer_email',
      'designer.email',
      'ownerEmail',
      'owner_email'
    ]);

  const username = normalizeUsername(
    explicitOwner.username ||
    designerObject?.username ||
    getPatternAttribute(pattern, [
      'designerUsername',
      'designer_username',
      'designer.username',
      'ownerUsername',
      'owner_username',
      'project.owner_username'
    ]) ||
    getPatternAttribute(pattern, [
      'project.designer_code',
      'designerCode',
      'designer_code'
    ]) ||
    (typeof pattern.designer === 'string' ? pattern.designer : '') ||
    'perfectfitbureau'
  );

  const brandName =
    explicitOwner.brandName ||
    designerObject?.brandName ||
    designerObject?.designerBrand ||
    getPatternAttribute(pattern, [
      'designerBrand',
      'designer_brand',
      'brandName',
      'brand_name',
      'studioName',
      'studio_name',
      'ownerBrandName',
      'owner_brand_name'
    ]) ||
    (typeof pattern.designerBrand === 'string' ? pattern.designerBrand : '') ||
    'Perfect Fit Bureau';

  const displayLabel =
    explicitOwner.displayLabel ||
    brandName ||
    formatPublicHandle(username) ||
    getPatternAttribute(pattern, [
      'designerName',
      'designer_name',
      'designer.name',
      'ownerName',
      'owner_name'
    ]) ||
    (typeof pattern.designer === 'string' ? pattern.designer : '');

  const fallbackDesignerCode =
    getPatternAttribute(pattern, [
      'project.designer_code',
      'designerCode',
      'designer_code'
    ]) ||
    (typeof pattern.designer === 'string' ? pattern.designer : '') ||
    brandName ||
    pattern.id ||
    'perfect-fit-bureau';
  const fallbackRoutingId = `agent:designer-${normalizeRecipientRouteToken(fallbackDesignerCode) || 'perfect-fit-bureau'}`;
  const routingId =
    ownerIdentityId ||
    (email ? `user:${String(email).toLowerCase()}` : '') ||
    fallbackRoutingId;

  return {
    id: String(routingId),
    routingId: String(routingId),
    username,
    brandName,
    role: 'designer',
    roleLabel: 'Designer',
    displayLabel: displayLabel || 'Pattern Designer',
    label: formatRecipientDisplay({
      username,
      brandName,
      role: 'designer',
      roleLabel: 'Designer',
      displayLabel
    }),
    privateRouting: email ? { email } : undefined
  };
};

export default function PatternQuickViewModal({
  pattern,
  onClose,
  onAddToCart,
  onExploreSwatches,
  activeRecommendedSize = '8',
  isFavorite = false,
  onToggleFavorite = () => {},
  reviews = [],
  onAddReview,
  currentUser
}) {
  const quickViewUi = perfectFitMetadata.componentUi.patternQuickView;
  const FABRIC_TEXTURES = localizeMetadataTree(quickViewUi.fabricTextures, 'component.patternQuickView.fabricTextures', pfUiT);
  const SIZE_SYSTEMS = localizeMetadataTree(quickViewUi.sizeSystems, 'component.patternQuickView.sizeSystems', pfUiT);

  if (!pattern) return null;

  // Repository projections intentionally permit sparse optional commerce data.
  // Normalize collections once at the presentation boundary so an absent
  // optional section is rendered as empty instead of crashing the modal.
  const features = Array.isArray(pattern.features) ? pattern.features : [];
  const fabricSuggestions = Array.isArray(pattern.fabricSuggestions) ? pattern.fabricSuggestions : [];
  const notions = Array.isArray(pattern.notions) ? pattern.notions : [];
  const yardageInfo = pattern.yardageInfo && typeof pattern.yardageInfo === 'object'
    ? pattern.yardageInfo
    : {};

  // Media items state synced with Pattern Media Manager & LocalStorage
  const [mediaGalleryVersion, setMediaGalleryVersion] = useState(0);

  useEffect(() => {
    const handleMediaUpdated = () => setMediaGalleryVersion(v => v + 1);
    window.addEventListener('pattern_media_updated', handleMediaUpdated);
    window.addEventListener('storage', handleMediaUpdated);
    return () => {
      window.removeEventListener('pattern_media_updated', handleMediaUpdated);
      window.removeEventListener('storage', handleMediaUpdated);
    };
  }, []);

  const projectedMediaItems = useMemo(() => {
    if (!Array.isArray(pattern?.presentationMediaItems)) return [];
    return pattern.presentationMediaItems.filter((item) => item?.url);
  }, [pattern]);

  // Retrieve media items for this pattern. Workspace projections already contain
  // customer-visible media; only legacy commerce patterns fall back to the older
  // pattern media manager.
  const rawMediaItems = useMemo(() => {
    if (!pattern) return [];
    if (projectedMediaItems.length > 0) return projectedMediaItems;
    if (pattern.presentationSource === 'workspace') return [];
    return getPatternMedia(pattern.id);
  }, [pattern, projectedMediaItems, mediaGalleryVersion]);

  // Filter out SECRET media items - ONLY public/visible media is shown in Quick View Summary
  const visibleMediaItems = useMemo(() => {
    return rawMediaItems.filter(item => !item.isSecret && item.url);
  }, [rawMediaItems]);

  const patternImages = useMemo(() => {
    if (visibleMediaItems.length > 0) {
      return visibleMediaItems.map(item => item.url);
    }
    return [pattern?.image].filter(Boolean);
  }, [visibleMediaItems, pattern]);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const activeMediaItem = visibleMediaItems[activeImageIndex] || visibleMediaItems[0];
  const activeImage = activeMediaItem?.url || patternImages[activeImageIndex] || pattern?.image;
  const isTechnicalMediaItem = (item) => {
    if (!item) return false;
    const type = String(item.type || '').toLowerCase();
    const label = `${item.typeLabel || ''} ${item.title || ''} ${item.name || ''}`.toLowerCase();

    if (['sketch', 'technical_sketch', 'technical-sketch'].includes(type)) return true;
    if (type === 'technical' && /\b(sketch|drawing)\b/.test(label)) return true;

    return /\b(technical sketch|technical drawing|garment sketch|construction sketch)\b/.test(label);
  };
  const isActiveTechnicalMedia = isTechnicalMediaItem(activeMediaItem);
  const firstTechnicalMediaIndex = visibleMediaItems.findIndex(isTechnicalMediaItem);
  const firstSampleMediaIndex = visibleMediaItems.findIndex((item) => !isTechnicalMediaItem(item));

  // Reset image index when pattern ID changes or visible media count changes
  useEffect(() => {
    setActiveImageIndex(0);
  }, [pattern?.id, visibleMediaItems.length]);

  const [format, setFormat] = useState('PDF');
  const [selectedSize, setSelectedSize] = useState(activeRecommendedSize);
  const [isFindMySizeOpen, setIsFindMySizeOpen] = useState(false);
  const [fitRecommendationResult, setFitRecommendationResult] = useState(null);
  const projectedSizeSystems = useMemo(() => {
    if (pattern?.sizeSystems && typeof pattern.sizeSystems === 'object') {
      const entries = Object.entries(pattern.sizeSystems).filter(([, system]) => Array.isArray(system?.sizes) && system.sizes.length);
      if (entries.length) {
        return Object.fromEntries(entries);
      }
    }

    return SIZE_SYSTEMS;
  }, [pattern?.sizeSystems]);
  const defaultSizeSystemKey = useMemo(() => {
    if (pattern?.defaultSizeSystemKey && projectedSizeSystems[pattern.defaultSizeSystemKey]) {
      return pattern.defaultSizeSystemKey;
    }
    if (projectedSizeSystems.workspaceVariant) return 'workspaceVariant';
    return 'patternNumericCore';
  }, [pattern?.defaultSizeSystemKey, projectedSizeSystems]);
  const [sizeSystemKey, setSizeSystemKey] = useState(defaultSizeSystemKey);
  const [justAdded, setJustAdded] = useState(false);
  const [activeTab, setActiveTab] = useState('features'); // 'features' | 'fabrics' | 'notions' | 'reviews'
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [selectedTexture, setSelectedTexture] = useState(FABRIC_TEXTURES[0]);

  // Seam allowances and sewing notches display toggle states
  const [showSeamAllowances, setShowSeamAllowances] = useState(false);
  const [showNotches, setShowNotches] = useState(false);

  // Calculate review rating statistics
  const ratingStats = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    return {
      average: Math.round((sum / reviews.length) * 10) / 10,
      count: reviews.length
    };
  }, [reviews]);

  useEffect(() => {
    setSizeSystemKey(defaultSizeSystemKey);
  }, [defaultSizeSystemKey, pattern?.id]);

  const selectedSizeSystem =
    projectedSizeSystems[sizeSystemKey] ||
    projectedSizeSystems[defaultSizeSystemKey] ||
    SIZE_SYSTEMS.patternNumericCore;
  const availableSizes = useMemo(() => {
    if (Array.isArray(selectedSizeSystem?.sizes) && selectedSizeSystem.sizes.length) {
      return selectedSizeSystem.sizes;
    }
    if (Array.isArray(pattern?.availableSizes) && pattern.availableSizes.length) {
      return pattern.availableSizes;
    }
    if (Array.isArray(pattern?.sizes) && pattern.sizes.length) {
      return pattern.sizes;
    }
    return SIZE_SYSTEMS.patternNumericCore.sizes;
  }, [pattern?.availableSizes, pattern?.sizes, selectedSizeSystem]);
  const displaySizeRange = selectedSizeSystem.displayRange || pattern?.sizeRangeLabel || (availableSizes.length > 1
    ? `${availableSizes[0]} - ${availableSizes[availableSizes.length - 1]}`
    : availableSizes[0] || 'Not set');

  const fitRecommendedCanonicalSize = fitRecommendationResult?.recommendation?.size || null;
  const fitRecommendedDisplaySize = useMemo(
    () => resolveRecommendationSizeForSystem(
      fitRecommendedCanonicalSize,
      availableSizes,
      sizeSystemKey
    ),
    [availableSizes, fitRecommendedCanonicalSize, sizeSystemKey]
  );

  useEffect(() => {
    setSelectedSize((current) => {
      if (fitRecommendedDisplaySize && availableSizes.includes(fitRecommendedDisplaySize)) {
        return fitRecommendedDisplaySize;
      }
      if (availableSizes.includes(current)) return current;
      if (availableSizes.includes(activeRecommendedSize)) return activeRecommendedSize;
      return availableSizes[0] || '';
    });
  }, [activeRecommendedSize, availableSizes, fitRecommendedDisplaySize]);

  useEffect(() => {
    setIsFindMySizeOpen(false);
    setFitRecommendationResult(null);
  }, [pattern?.id]);

  const handleFitRecommendationApplied = (result) => {
    const canonicalSize = result?.recommendation?.size;
    if (!canonicalSize) return;

    setFitRecommendationResult(result);

    const resolved = resolveRecommendationSizeForSystem(
      canonicalSize,
      availableSizes,
      sizeSystemKey
    );

    if (resolved) {
      setSelectedSize(resolved);
      return;
    }

    // If the current display system has no governed reference for the canonical
    // recommendation (common for legacy fallback charts), move to the first
    // compatible selector rather than inventing a cross-system conversion.
    const compatibleSystem = Object.entries(projectedSizeSystems).find(([key, system]) =>
      resolveRecommendationSizeForSystem(canonicalSize, system?.sizes || [], key)
    );

    if (compatibleSystem) {
      const [nextSystemKey, nextSystem] = compatibleSystem;
      const nextSize = resolveRecommendationSizeForSystem(
        canonicalSize,
        nextSystem?.sizes || [],
        nextSystemKey
      );

      setSizeSystemKey(nextSystemKey);
      if (nextSize) setSelectedSize(nextSize);
    }
  };

  useEffect(() => {
    if (!SHOW_SEWING_TIPS_TAB && activeTab === 'tips') {
      setActiveTab('features');
    }
  }, [activeTab]);

  // Product image zoom is explicit: hover alone never activates it.
  const [zoomStyle, setZoomStyle] = useState({ transformOrigin: 'center center', transform: 'scale(1)' });
  const [isProductImageZoomEnabled, setIsProductImageZoomEnabled] = useState(false);

  // Technical sketch modal state is intentionally separate from product-image zoom.
  const [isTechnicalSketchOpen, setIsTechnicalSketchOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1.5);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setIsProductImageZoomEnabled(false);
    setZoomStyle({ transformOrigin: 'center center', transform: 'scale(1)' });
    setPanOffset({ x: 0, y: 0 });
  }, [activeImageIndex, pattern?.id]);

  const handleMouseMove = (e) => {
    if (!isProductImageZoomEnabled) return;
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomStyle({
      transformOrigin: `${x}% ${y}%`,
      transform: 'scale(2.2)'
    });
  };

  const handleAdjustZoom = (delta) => {
    setLightboxZoom(prev => {
      const next = Math.max(1, Math.min(4, prev + delta));
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handlePanStart = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handlePanMove = (e) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handlePanEnd = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile/trackpad devices
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - panOffset.x,
      y: e.touches[0].clientY - panOffset.y
    });
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPanOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const currentPrice = pattern.pricePDF || pattern.price || 0;
  const diffInfo = getDifficultyInfo(pattern.difficulty);
  const DiffIcon = diffInfo.icon;
  const designerRecipient = useMemo(() => resolveDesignerRecipient(pattern), [pattern]);
  const currentUserIdentity = useMemo(
    () => (currentUser ? getUserRoutingId(currentUser) : ''),
    [currentUser]
  );
  const currentUserRole = String(currentUser?.role || '').toLowerCase();
  const canMessageDesigner =
    ['buyer', 'administrator'].includes(currentUserRole) &&
    Boolean(designerRecipient?.id) &&
    designerRecipient.id !== currentUserIdentity;
  const technicalToggleLabel = isActiveTechnicalMedia ? 'Sample photo' : 'Technical sketch';

  const handleMessageDesigner = () => {
    if (!canMessageDesigner) return;

    window.dispatchEvent(new CustomEvent('perfectfit:message-compose', {
      detail: {
        recipient: {
          id: designerRecipient.routingId || designerRecipient.id,
          username: designerRecipient.username,
          brandName: designerRecipient.brandName,
          role: 'designer',
          displayLabel:
            designerRecipient.displayLabel ||
            designerRecipient.brandName ||
            formatPublicHandle(designerRecipient.username)
        },
        lockRecipients: true,
        privacyMode: 'USERNAME_ONLY',
        subject: `Question about ${pattern.name}`,
        contextLabel: `Pattern · ${pattern.name}`,
        context: {
          patternId: pattern.id,
          workspaceVariantId: pattern.workspaceVariantId || '',
          ownerRoutingId: designerRecipient.routingId || designerRecipient.id
        }
      }
    }));

    window.showToast?.(
      `Opening a message to ${designerRecipient.label || designerRecipient.displayLabel || 'the pattern designer'}.`,
      'info',
      'Message designer'
    );
  };

  const handleAddToCart = () => {
    onAddToCart(pattern, format, selectedSize);
    setJustAdded(true);

    setTimeout(() => {
      setJustAdded(false);
    }, 2000);
  };

  return (
    <div
      className="fixed inset-0 overflow-y-auto flex items-center justify-center p-4 sm:p-6"
      style={{ zIndex: UI_LAYERS.modalBackdrop }}
      id="pattern-quick-view-modal"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-bark-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
        style={{ zIndex: UI_LAYERS.modalBackdrop }}
        id="quick-view-backdrop"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ type: 'spring', duration: 0.4 }}
        className="bg-white border border-sand-250/60 shadow-2xl rounded-lg max-w-5xl w-full mx-auto relative overflow-hidden flex flex-col md:flex-row max-h-[92vh]"
        style={{ zIndex: UI_LAYERS.modal }}
        id="quick-view-card"
      >
        {/* Left Side: Photo + Controls */}
        <div className="md:w-5/12 flex flex-col bg-sand-50 border-r border-sand-200/50 overflow-y-auto max-h-[55vh] md:max-h-[92vh]" id="quick-view-left-column">
          {/* Main Photo container */}
          <div
            className={`relative h-[330px] md:h-[520px] shrink-0 overflow-hidden group select-none flex flex-col justify-between ${isProductImageZoomEnabled ? 'cursor-zoom-out' : 'cursor-default'}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => {
              if (isProductImageZoomEnabled) {
                setZoomStyle({ transformOrigin: 'center center', transform: 'scale(2.2)' });
              }
            }}
            id="quick-view-image-container"
          >
            {/* Base original image (always pristine, preserves face, hair, and background skin tones perfectly) */}
            <motion.img
              src={activeImage}
              alt={pattern.name}
              style={{
                ...(isProductImageZoomEnabled ? { transformOrigin: zoomStyle.transformOrigin, transform: zoomStyle.transform } : { transform: 'scale(1)' }),
              }}
              className={`w-full h-full transition-all duration-300 ease-out ${isActiveTechnicalMedia ? 'object-contain bg-white' : 'object-cover'}`}
              referrerPolicy="no-referrer"
              id="quick-view-image-base"
            />

            {/* Dynamic Fabric Visualizer Layer with Skin-Preserving & Background-Preserving Ellipse Mask */}
            {!isActiveTechnicalMedia && selectedTexture.id !== 'original' && (
              <div
                className="absolute inset-0 pointer-events-none transition-all duration-500 ease-in-out"
                style={{
                  maskImage: getMaskForPattern(pattern.id),
                  WebkitMaskImage: getMaskForPattern(pattern.id),
                  maskRepeat: 'no-repeat',
                  WebkitMaskRepeat: 'no-repeat',
                  maskSize: '100% 100%',
                  WebkitMaskSize: '100% 100%',
                  ...(isProductImageZoomEnabled ? { transformOrigin: zoomStyle.transformOrigin, transform: zoomStyle.transform } : { transform: 'scale(1)' }),
                }}
                id="quick-view-visualizer-layer"
              >
                {/* Filtered image of the garment */}
                <img
                  src={activeImage}
                  alt={pattern.name}
                  style={{
                    filter: selectedTexture.filter
                  }}
                  className="w-full h-full object-cover transition-all duration-500 ease-out"
                  referrerPolicy="no-referrer"
                  id="quick-view-image-filtered"
                />

                {/* Fabric Texture Overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: selectedTexture.overlayBackground,
                    mixBlendMode: selectedTexture.blendMode,
                    opacity: selectedTexture.opacity,
                  }}
                  id="quick-view-texture-overlay"
                />
              </div>
            )}

            {/* CAD Blueprint / Pattern Drafter Overlay */}
            {!isActiveTechnicalMedia && SHOW_PRINT_PREP_BLUEPRINT && (showSeamAllowances || showNotches) && (
              <div className="absolute inset-0 z-30 pointer-events-none bg-bark-900/15 backdrop-blur-[0.5px] transition-all duration-300 flex items-center justify-center">
                <svg
                  viewBox="0 0 400 500"
                  className="w-full h-full absolute inset-0 text-white select-none drop-shadow-md"
                  id="blueprint-svg-overlay"
                >
                  {/* Grid background representing standard dressmaker graph paper */}
                  <defs>
                    <pattern id="blueprint-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <rect width="20" height="20" fill="none" />
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#blueprint-grid)" className="opacity-70" />

                  {/* Category-specific blueprint layouts to perfectly match product category */}
                  {pattern.category === 'Dresses' ? (
                    <g className="transition-all duration-300">
                      {/* Dress pattern wrap front bodice piece (Solid outer line = cutting path) */}
                      <path
                        d="M 100 120 L 250 150 L 280 320 L 120 350 Z"
                        fill="rgba(186, 100, 70, 0.15)"
                        stroke="#ba6446"
                        strokeWidth="2.5"
                        id="outline-cut-line-dress"
                      />

                      {/* Inner stitch line / seam allowance (dashed line = stitch path) */}
                      {showSeamAllowances && (
                        <path
                          d="M 112 135 L 240 162 L 265 308 L 130 335 Z"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          strokeDasharray="4,3"
                          id="outline-stitch-line-dress"
                        />
                      )}

                      {/* Pattern Notches: Triangle indices placed on key construction spots */}
                      {showNotches && (
                        <g id="notch-points-dress">
                          {/* Shoulder notch */}
                          <path d="M 175 135 L 175 120 M 171 120 L 179 120" stroke="#ffffff" strokeWidth="1.5" />
                          <polygon points="175,123 171,117 179,117" fill="#e0a894" />
                          <text x="184" y="118" fill="#ffffff" className="font-mono font-bold" style={{ fontSize: '7.5px' }}>NECK MATCH</text>

                          {/* Waist dart notches */}
                          <path d="M 265 235 L 250 235 M 250 231 L 250 239" stroke="#ffffff" strokeWidth="1.5" />
                          <polygon points="253,235 247,231 247,239" fill="#e0a894" />
                          <text x="185" y="247" fill="#ffffff" className="font-mono font-bold" style={{ fontSize: '7.5px' }}>WAIST NOTCH</text>
                        </g>
                      )}
                    </g>
                  ) : pattern.category === 'Tops' || pattern.category === 'Outerwear' ? (
                    <g className="transition-all duration-300">
                      {/* Structured Sleeve block */}
                      <path
                        d="M 80 150 C 120 100, 280 100, 320 150 L 280 380 L 120 380 Z"
                        fill="rgba(186, 100, 70, 0.15)"
                        stroke="#ba6446"
                        strokeWidth="2.5"
                      />
                      {showSeamAllowances && (
                        <path
                          d="M 94 158 C 130 115, 270 115, 306 158 L 268 365 L 132 365 Z"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          strokeDasharray="4,3"
                        />
                      )}
                      {showNotches && (
                        <g id="notch-points-sleeve">
                          {/* Sleeve cap center point */}
                          <path d="M 200 118 L 200 103" stroke="#ffffff" strokeWidth="1.5" />
                          <polygon points="200,107 196,113 204,113" fill="#e0a894" />
                          <text x="206" y="111" fill="#ffffff" className="font-mono font-bold" style={{ fontSize: '7.5px' }}>SHOULDER POINT</text>

                          {/* Sleeve hem cuff fold line */}
                          <path d="M 120 380 L 120 365" stroke="#ffffff" strokeWidth="1.5" />
                          <circle cx="120" cy="380" r="3" fill="#e0a894" />
                          <text x="126" y="386" fill="#ffffff" className="font-mono font-bold" style={{ fontSize: '7.5px' }}>HEM ALIGN</text>
                        </g>
                      )}
                    </g>
                  ) : (
                    <g className="transition-all duration-300">
                      {/* Skirt Panel Layout */}
                      <path
                        d="M 110 120 C 180 140, 220 140, 290 120 L 310 380 L 90 380 Z"
                        fill="rgba(186, 100, 70, 0.15)"
                        stroke="#ba6446"
                        strokeWidth="2.5"
                      />
                      {showSeamAllowances && (
                        <path
                          d="M 122 135 C 180 152, 220 152, 278 135 L 295 365 L 105 365 Z"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          strokeDasharray="4,3"
                        />
                      )}
                      {showNotches && (
                        <g id="notch-points-skirt">
                          <polygon points="200,135 196,141 204,141" fill="#e0a894" />
                          <text x="206" y="146" fill="#ffffff" className="font-mono font-bold" style={{ fontSize: '7.5px' }}>FOLD MATCH</text>
                          <polygon points="98,250 104,246 104,254" fill="#e0a894" />
                          <text x="108" y="253" fill="#ffffff" className="font-mono font-bold" style={{ fontSize: '7.5px' }}>ZIPPER TERMINAL</text>
                        </g>
                      )}
                    </g>
                  )}

                  {/* High-fidelity blueprints labels on the active workspace */}
                  <rect x="130" y="260" width="140" height="34" rx="3" fill="rgba(24, 20, 18, 0.82)" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
                  <text x="200" y="273" fill="#ffffff" textAnchor="middle" className="font-mono font-bold" style={{ fontSize: '8.5px' }}>
                    SIZE {selectedSize} • PATTERN BLOCK
                  </text>
                  <text x="200" y="284" fill="#d4d4d8" textAnchor="middle" className="font-mono uppercase font-semibold" style={{ fontSize: '6.5px' }}>
                    {showSeamAllowances ? 'Standard 1.5cm Allowance included' : 'Pristine stitch line layout'}
                  </text>

                  {/* Calibration metric bar */}
                  <g transform="translate(15, 465)">
                    <line x1="0" y1="0" x2="60" y2="0" stroke="#ffffff" strokeWidth="2" />
                    <line x1="0" y1="-3" x2="0" y2="3" stroke="#ffffff" strokeWidth="2" />
                    <line x1="30" y1="-2" x2="30" y2="2" stroke="#ffffff" strokeWidth="1" />
                    <line x1="60" y1="-3" x2="60" y2="3" stroke="#ffffff" strokeWidth="2" />
                    <text x="30" y="-8" textAnchor="middle" fill="#ffffff" className="font-mono font-bold" style={{ fontSize: '7px' }}>
                      SCALE CALIBRATOR (10cm)
                    </text>
                  </g>
                </svg>

                {/* Instruction / legend card */}
                <div className="absolute bottom-4 left-4 right-4 bg-bark-950/95 text-stone-100 p-2.5 rounded-[4px] text-[9.5px] leading-normal border border-white/10 flex flex-col gap-1 shadow-md">
                  <span className="font-bold text-[#e0a894] uppercase tracking-wider text-[8px] font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ba6446] animate-pulse"></span>{pfUiT("ui.components.patternquickviewmodal.def6906860")}</span>
                  <p className="text-[8.5px] text-stone-300">
                    {showSeamAllowances && showNotches
                      ? "Displaying 1.5cm (5/8 in) seam allowance boundary (dashed line) and alignment notches (solid indicators)."
                      : showSeamAllowances
                      ? "Displaying 1.5cm (5/8 in) seam allowance boundary (dashed line). Fabric outside is trimming scrap."
                      : "Displaying matching alignment notches (match key points precisely when pinning pieces together)."}
                  </p>
                </div>
              </div>
            )}

            {/* Overlay to fade out background when zoomed; raw technical sketches stay ungraded and unannotated. */}
            {!isActiveTechnicalMedia && (
              <div className="absolute inset-0 bg-gradient-to-t from-bark-950/50 via-transparent to-bark-950/20 pointer-events-none" />
            )}

            {/* Interactive Photo & Sketch Slider Nav Arrows */}
            {visibleMediaItems.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : visibleMediaItems.length - 1));
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-bark-950/80 hover:bg-clay-605 text-white flex items-center justify-center transition-all shadow-md backdrop-blur-xs cursor-pointer active:scale-95 border border-white/20"
                  title={pfUiT("ui.components.patternquickviewmodal.7b3639eeb0")}
                >
                  <ChevronLeft className="w-5 h-5 stroke-[2.5px]" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex((prev) => (prev < visibleMediaItems.length - 1 ? prev + 1 : 0));
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-bark-950/80 hover:bg-clay-605 text-white flex items-center justify-center transition-all shadow-md backdrop-blur-xs cursor-pointer active:scale-95 border border-white/20"
                  title={pfUiT("ui.components.patternquickviewmodal.ed05ed1da8")}
                >
                  <ChevronRight className="w-5 h-5 stroke-[2.5px]" />
                </button>

                {/* Top-left Slide Counter Badge, kept away from the zoom control. */}
                <div className="absolute top-4 left-4 z-10 bg-bark-950/85 text-amber-200 border border-amber-300/30 text-[9.5px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md backdrop-blur-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-clay-400 animate-pulse"></span>
                  <span>Slide {activeImageIndex + 1} / {visibleMediaItems.length}</span>
                </div>
              </>
            )}

            {/* Symmetrical Floating Branding Overlay */}
            {!isActiveTechnicalMedia && (
              <div className="absolute top-14 left-4 flex flex-col leading-none z-10 select-none bg-white/70 backdrop-blur-xs p-2 rounded border border-sand-200/40">
                <span className="font-serif italic text-xs font-bold text-bark-900 tracking-tight">Perfect Fit</span>
              </div>
            )}

            <div className="absolute bottom-4 left-4 space-y-1.5 z-10">
              {(isActiveTechnicalMedia || firstTechnicalMediaIndex >= 0) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isActiveTechnicalMedia) {
                      setActiveImageIndex(firstSampleMediaIndex >= 0 ? firstSampleMediaIndex : 0);
                      return;
                    }

                    if (firstTechnicalMediaIndex >= 0) {
                      setActiveImageIndex(firstTechnicalMediaIndex);
                    }
                  }}
                  className="flex items-center gap-1.5 bg-bark-900/90 text-amber-100 backdrop-blur-xs px-2.5 py-1 rounded border border-amber-300/30 text-[9.5px] font-mono font-bold uppercase tracking-wide shadow-md hover:bg-bark-950"
                >
                  <Eye className="w-3 h-3 text-clay-400" />
                  <span>{technicalToggleLabel}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsProductImageZoomEnabled((current) => {
                  const next = !current;
                  if (!next) {
                    setZoomStyle({ transformOrigin: 'center center', transform: 'scale(1)' });
                  } else {
                    setZoomStyle({ transformOrigin: 'center center', transform: 'scale(2.2)' });
                  }
                  return next;
                });
              }}
              className={`absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full shadow-md border border-white/20 transition-colors ${
                isProductImageZoomEnabled
                  ? 'bg-clay-605 text-white hover:bg-bark-900'
                  : 'bg-bark-900/90 text-sand-50 hover:bg-clay-605'
              }`}
              aria-label={isProductImageZoomEnabled ? 'Turn off image zoom' : 'Turn on image zoom'}
              title={isProductImageZoomEnabled ? 'Turn off image zoom' : 'Turn on image zoom'}
            >
              {isProductImageZoomEnabled ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </button>
          </div>

          {/* Interactive Extra Photos & Technical Sketches Gallery Thumbnails */}
          {visibleMediaItems.length > 0 && (
            <div className="bg-sand-100/40 border-b border-sand-200/50 p-2 shrink-0 flex flex-col gap-1" id="modal-extra-photos-bar">
              <span className="sr-only">{pfUiT("ui.components.patternquickviewmodal.7ad26d3f80")}</span>
              <div className="flex gap-2 overflow-x-auto pb-1 px-1.5 scrollbar-thin scrollbar-thumb-sand-300">
                {visibleMediaItems.map((mediaItem, idx) => (
                  <button
                    key={mediaItem.id || idx}
                    onClick={() => {
                      setActiveImageIndex(idx);
                      if (window.showToast) {
                        window.showToast(`Viewing ${mediaItem.typeLabel || 'media'} (${idx + 1} of ${visibleMediaItems.length}): ${mediaItem.title}`, 'info', 'Perspective Updated');
                      }
                    }}
                    className={`relative group/thumb w-12 h-12 rounded-lg border cursor-pointer transition-all shrink-0 overflow-hidden ${
                      activeImageIndex === idx
                        ? 'border-[#ba6446] ring-2 ring-[#ba6446]/40 scale-105 shadow-sm'
                        : 'border-sand-250 hover:border-sand-400 bg-white'
                    }`}
                    type="button"
                    title={`${mediaItem.typeLabel || 'Media'}: ${mediaItem.title}`}
                  >
                    <img
                      src={mediaItem.url}
                      alt={mediaItem.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-bark-950/80 text-[7px] text-amber-100 font-mono font-bold px-0.5 py-0.5 text-center truncate group-hover/thumb:bg-clay-705">
                      {mediaItem.type === 'sketch' ? 'Sketch' : mediaItem.type === 'pattern_layout' ? 'Layout' : mediaItem.type === 'detail' ? 'Detail' : 'Sample'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Blueprint & Seam Allowance Checkboxes */}
          {SHOW_PRINT_PREP_BLUEPRINT && (
          <div className="bg-white border-t border-sand-200 p-4 space-y-3 shrink-0 overflow-visible" id="blueprint-controls-panel">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-550 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-clay-65b" />
                <span>{pfUiT("ui.components.patternquickviewmodal.aaae95d63e")}</span>
              </span>
              <span className="text-[8px] bg-clay-50 text-clay-705 px-1.5 py-0.5 rounded font-mono font-bold">{pfUiT("ui.components.patternquickviewmodal.86765be4bf")}</span>
            </div>

            <div className="space-y-2">
              {/* Seam Allowance Toggle */}
              <label
                className="flex items-start gap-2.5 p-2 rounded border border-sand-150 hover:bg-sand-50/50 transition-colors cursor-pointer select-none"
                htmlFor="toggle-blueprint-seam-allowance"
              >
                <input
                  type="checkbox"
                  id="toggle-blueprint-seam-allowance"
                  checked={showSeamAllowances}
                  onChange={(e) => setShowSeamAllowances(e.target.checked)}
                  className="mt-0.5 w-3.5 h-3.5 rounded text-[#ba6446] border-sand-300 focus:ring-0 cursor-pointer accent-[#ba6446]"
                />
                <div className="leading-tight">
                  <span className="text-[10px] font-bold text-bark-900 block">{pfUiT("ui.components.patternquickviewmodal.9e3c5556ce")}</span>
                  <span className="text-[8.5px] text-bark-450 font-serif">Overlay 1.5cm (5/8 in) standard margins on pattern nest</span>
                </div>
              </label>

              {/* Notches Toggle */}
              <label
                className="flex items-start gap-2.5 p-2 rounded border border-sand-150 hover:bg-sand-50/50 transition-colors cursor-pointer select-none"
                htmlFor="toggle-blueprint-notches"
              >
                <input
                  type="checkbox"
                  id="toggle-blueprint-notches"
                  checked={showNotches}
                  onChange={(e) => setShowNotches(e.target.checked)}
                  className="mt-0.5 w-3.5 h-3.5 rounded text-[#ba6446] border-sand-300 focus:ring-0 cursor-pointer accent-[#ba6446]"
                />
                <div className="leading-tight">
                  <span className="text-[10px] font-bold text-bark-900 block">{pfUiT("ui.components.patternquickviewmodal.5c5df8b68c")}</span>
                  <span className="text-[8.5px] text-bark-450 font-serif">Overlay match triangles &amp; grain points for pattern pieces</span>
                </div>
              </label>
            </div>
          </div>
          )}
        </div>

        {/* Right Side: Specifications and Quick Actions */}
        <div className="md:w-7/12 p-6 md:p-8 flex flex-col justify-between overflow-y-auto max-h-[55vh] md:max-h-[92vh] bg-[#FAF9F6]/30" id="quick-view-content">

          {/* Floating Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full border border-sand-200 hover:border-sand-300 text-bark-500 hover:text-bark-900 bg-white/90 hover:bg-sand-50 transition-all cursor-pointer z-20 shadow-3xs active:scale-95"
            aria-label={pfUiT("ui.components.patternquickviewmodal.a96176c4be")}
            id="quick-view-close-btn"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="space-y-5">
            {/* Header / Meta */}
            <div className="pr-10">
              <span className="text-[9px] font-mono text-clay-605 tracking-widest uppercase font-bold block mb-1">{pfUiT("ui.components.patternquickviewmodal.39628cebf6")}</span>
              <h2 className="text-2xl font-serif text-bark-950 font-medium tracking-tight leading-tight">
                {pattern.name}
              </h2>
              <p className="text-xs italic text-bark-500 font-serif mt-1">
                "{pattern.tagline}"
              </p>

              {/* Rating aggregate display */}
              {ratingStats ? (
                <div className="flex items-center gap-2 mt-2" id="quick-view-rating-header">
                  <div className="flex gap-0.5 text-[#ba6446]" id="quick-view-stars">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i <= Math.round(ratingStats.average) ? 'fill-[#ba6446] text-[#ba6446]' : 'text-sand-300'}`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-bold text-bark-850 font-mono">
                    {ratingStats.average.toFixed(1)}
                  </span>
                  <button
                    onClick={() => setActiveTab('reviews')}
                    className="text-[10px] text-clay-605 hover:text-clay-700 underline font-medium cursor-pointer"
                  >
                    ({ratingStats.count} {ratingStats.count === 1 ? 'review' : 'reviews'})
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-2 text-bark-450 text-[10px]" id="quick-view-rating-header-empty">
                  <Star className="w-3.5 h-3.5 text-sand-300" />
                  <span>{pfUiT("ui.components.patternquickviewmodal.a606702b3e")}</span>
                  <button
                    onClick={() => setActiveTab('reviews')}
                    className="text-clay-605 hover:text-clay-700 underline font-medium cursor-pointer"
                  >{pfUiT("ui.components.patternquickviewmodal.d8164af87f")}</button>
                </div>
              )}
            </div>

            {/* Pattern Core Description */}
            <p className="text-sm text-bark-650 leading-relaxed font-sans">
              {pattern.description}
            </p>

            {/* Product details moved out of the picture overlay for clearer e-commerce reading. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3 border-t border-b border-sand-200/50 text-sm font-sans text-bark-750">
              <div>
                <span className="text-bark-400 block text-[9px] uppercase tracking-wider font-semibold mb-0.5">{pfUiT("ui.components.patternquickviewmodal.1cba446467")}</span>
                <span className="font-mono font-bold text-bark-900">{pattern.category || 'Pattern'}</span>
              </div>
              <div>
                <span className="text-bark-400 block text-[9px] uppercase tracking-wider font-semibold mb-0.5">{pfUiT("ui.components.patternquickviewmodal.4e1ed9feff")}</span>
                <span className="inline-flex items-center gap-1.5 font-mono font-bold text-bark-900">
                  <DiffIcon className={`w-3.5 h-3.5 ${diffInfo.iconColor}`} />
                  {pattern.difficulty || diffInfo.label}
                </span>
              </div>
              <div>
                <label className="text-bark-400 block text-[9px] uppercase tracking-wider font-semibold mb-1" htmlFor="quick-view-size-system-picker">{pfUiT("ui.components.patternquickviewmodal.6085616ec8")}</label>
                <select
                  id="quick-view-size-system-picker"
                  value={sizeSystemKey}
                  onChange={(e) => setSizeSystemKey(e.target.value)}
                  className="w-full bg-white border border-sand-200/80 rounded-[4px] px-2 py-1.5 text-xs font-semibold text-bark-850 focus:outline-none focus:ring-1 focus:ring-clay-500 focus:border-clay-500 cursor-pointer shadow-3xs"
                >
                  {Object.entries(projectedSizeSystems).map(([key, system]) => (
                    <option key={key} value={key}>{system.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-bark-400 block text-[9px] uppercase tracking-wider font-semibold mb-0.5">{pfUiT("ui.components.patternquickviewmodal.f35671c6a1")}</span>
                <span className="font-mono font-bold text-bark-900">{displaySizeRange}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-bark-400 block text-[9px] uppercase tracking-wider font-semibold mb-0.5">{pfUiT("ui.components.patternquickviewmodal.02105e3f32")}</span>
                <span className="font-mono font-bold text-bark-900">
                  {selectedSizeSystem.basis || 'Variant Measurement Chart'}
                </span>
              </div>
            </div>

            {/* Interactive Fabric Texture Lab */}
            {/* Disabled temporarily until fabric lab functionality is technically rebuilt. */}
            {false && (
            <div className="bg-white border border-sand-200/80 rounded-[4px] p-3.5 space-y-3.5 shadow-3xs" id="fabric-texture-customizer">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-bark-400 uppercase tracking-widest font-bold block flex items-center gap-1">
                  <Paintbrush className="w-3 h-3 text-[#ba6446]" />{pfUiT("ui.components.patternquickviewmodal.fd08c42151")}</span>
                <span className="text-[9px] font-mono font-bold text-clay-700 bg-clay-50 border border-clay-100 px-1.5 py-0.5 rounded">{pfUiT("ui.components.patternquickviewmodal.f5922d89d5")}</span>
              </div>

              {/* Fabric Selection Dropdown */}
              <div className="space-y-1.5" id="fabric-dropdown-wrapper">
                <label htmlFor="fabric-select" className="text-[10px] text-bark-600 font-semibold font-mono uppercase tracking-wider block">{pfUiT("ui.components.patternquickviewmodal.05762a86b6")}</label>
                <div className="relative">
                  <select
                    id="fabric-select"
                    value={selectedTexture.id}
                    onChange={(e) => {
                      const selected = FABRIC_TEXTURES.find(t => t.id === e.target.value);
                      if (selected) {
                        setSelectedTexture(selected);
                        if (window.showToast) {
                          window.showToast(`Switched fabric texture visualization to "${selected.name}".`, 'info', 'Texture Applied');
                        }
                      }
                    }}
                    className="w-full bg-sand-50/50 border border-sand-200 hover:border-sand-300 text-xs text-bark-850 font-medium py-2 px-3 pr-8 rounded-[4px] shadow-3xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-clay-500 focus:border-clay-500 transition-all appearance-none"
                  >
                    {FABRIC_TEXTURES.map((tex) => (
                      <option key={tex.id} value={tex.id} className="text-bark-900 bg-white font-sans py-1">
                        {tex.name} ({tex.type})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-bark-500 border-l border-sand-200/50 my-1">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Palette swatches for quick clicking */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-bark-500 font-semibold font-mono uppercase tracking-wider block">{pfUiT("ui.components.patternquickviewmodal.a0ca2b85a0")}</span>
                <div className="flex flex-wrap gap-2.5" id="fabric-swatches-row">
                  {FABRIC_TEXTURES.map((tex) => (
                    <button
                      key={tex.id}
                      onClick={() => {
                        setSelectedTexture(tex);
                        if (window.showToast) {
                          window.showToast(`Switched fabric texture visualization to "${tex.name}".`, 'info', 'Texture Applied');
                        }
                      }}
                      className={`w-9 h-9 rounded-full cursor-pointer relative flex items-center justify-center transition-all ${
                        selectedTexture.id === tex.id
                          ? 'ring-2 ring-clay-605 ring-offset-2 scale-105'
                          : 'hover:scale-105 hover:ring-1 hover:ring-sand-400'
                      }`}
                      title={`${tex.name} (${tex.type})`}
                      type="button"
                    >
                      {/* Inner color swatch */}
                      <div className={`w-full h-full rounded-full ${tex.colorClass} overflow-hidden relative`}>
                        {/* CSS background texture pattern on the swatch button itself to represent weave! */}
                        {tex.id !== 'original' && (
                          <div
                            className="absolute inset-0 opacity-40"
                            style={{ background: tex.overlayBackground }}
                          />
                        )}
                      </div>

                      {/* Active Check */}
                      {selectedTexture.id === tex.id && (
                        <span className="absolute inset-0 flex items-center justify-center text-white mix-blend-difference">
                          <Check className="w-4 h-4 stroke-[3.5]" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Swatch Description details */}
              <div className="bg-sand-50/50 border border-sand-150 p-2.5 rounded text-[10.5px] leading-relaxed text-bark-750 font-sans" id="fabric-swatch-details">
                <p className="font-bold text-bark-900 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-clay-605" />
                  {selectedTexture.name} <span className="text-[9px] font-mono text-bark-400 font-normal">({selectedTexture.type})</span>
                </p>
                <p className="text-bark-550 mt-0.5 text-[10px]">
                  {selectedTexture.description}
                </p>
              </div>
            </div>
            )}

            {/* Options Selection Grid (Format & Sizing) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Format selection */}
              <div>
                <span className="text-[9px] text-bark-400 uppercase tracking-widest font-bold block mb-1.5">{pfUiT("ui.components.patternquickviewmodal.80079bcda1")}</span>
                <div className="bg-white border border-sand-200/80 rounded-[4px] p-2 shadow-3xs">
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full bg-sand-50/70 border border-sand-200 rounded-[4px] px-2 py-1.5 text-xs font-semibold text-bark-850 focus:outline-none focus:ring-1 focus:ring-clay-500 focus:border-clay-500 cursor-pointer"
                  >
                    {DIGITAL_FORMAT_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Size choice */}
              <div>
                <label className="text-[9px] text-bark-400 uppercase tracking-widest font-bold block mb-1.5" htmlFor="quick-view-size-picker">{pfUiT("ui.components.patternquickviewmodal.ba3929ddda")}</label>
                <select
                  id="quick-view-size-picker"
                  value={selectedSize}
                  onChange={(e) => {
                    setSelectedSize(e.target.value);
                    setFitRecommendationResult(null);
                  }}
                  className="w-full bg-white border border-sand-200/80 rounded-[4px] px-2 py-1.5 text-xs font-semibold text-bark-850 focus:outline-none focus:ring-1 focus:ring-clay-500 focus:border-clay-500 cursor-pointer shadow-3xs"
                >
                  {availableSizes.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}{fitRecommendedDisplaySize === sz ? ' (My fit)' : sz === activeRecommendedSize ? ' (Saved preference)' : ''}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setIsFindMySizeOpen(true)}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-[4px] border border-clay-200 bg-clay-50/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-clay-700 transition-colors hover:border-clay-300 hover:bg-clay-100/60"
                >
                  <Ruler className="h-3.5 w-3.5" />{pfUiT("ui.components.patternquickviewmodal.a0f3f2f422")}</button>

                {fitRecommendedDisplaySize ? (
                  <div className="mt-1.5 rounded-[4px] border border-emerald-200 bg-emerald-50/70 px-2.5 py-2 text-[10px] leading-relaxed text-emerald-800">
                    <strong>My fit recommendation: {fitRecommendedDisplaySize}.</strong>{pfUiT("ui.components.patternquickviewmodal.d47dabcd89")}</div>
                ) : (
                  <span className="mt-1 block text-[10px] text-bark-450">{pfUiT("ui.components.patternquickviewmodal.4e01b392bd")}</span>
                )}
              </div>
            </div>            {/* Quick specifications tab navigation */}
            <div className="space-y-2">
              <div className="flex border-b border-sand-200/70" id="quick-view-tab-bar">
                <button
                  onClick={() => setActiveTab('features')}
                  className={`py-1 px-2.5 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                    activeTab === 'features'
                      ? 'border-clay-605 text-clay-705 font-black'
                      : 'border-transparent text-bark-450 hover:text-bark-800'
                  }`}
                  type="button"
                >{pfUiT("ui.components.patternquickviewmodal.b721afecb8")}</button>
                <button
                  onClick={() => setActiveTab('fabrics')}
                  className={`py-1 px-2.5 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                    activeTab === 'fabrics'
                      ? 'border-clay-605 text-clay-705 font-black'
                      : 'border-transparent text-bark-450 hover:text-bark-800'
                  }`}
                  type="button"
                >{pfUiT("ui.components.patternquickviewmodal.0421876b93")}</button>
                <button
                  onClick={() => setActiveTab('notions')}
                  className={`py-1 px-2.5 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                    activeTab === 'notions'
                      ? 'border-clay-605 text-clay-705 font-black'
                      : 'border-transparent text-bark-450 hover:text-bark-800'
                  }`}
                  type="button"
                >
                  Notions &amp; Yardage
                </button>
                {SHOW_SEWING_TIPS_TAB && (
                  <button
                    onClick={() => setActiveTab('tips')}
                    className={`py-1 px-2.5 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1 ${
                      activeTab === 'tips'
                        ? 'border-clay-605 text-clay-705 font-black'
                        : 'border-transparent text-bark-450 hover:text-bark-800'
                    }`}
                    type="button"
                  >
                    <Video className="w-3 h-3 text-clay-550 shrink-0" />
                    <span>{pfUiT("ui.components.patternquickviewmodal.43a78badd1")}</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('reviews')}
                  className={`py-1 px-2.5 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1 ${
                    activeTab === 'reviews'
                      ? 'border-clay-605 text-clay-705 font-black'
                      : 'border-transparent text-bark-450 hover:text-bark-800'
                  }`}
                  type="button"
                >
                  <span>{pfUiT("ui.components.patternquickviewmodal.cc13db50cb")}</span>
                  {ratingStats && (
                    <span className="bg-[#ba6446]/10 text-[#ba6446] px-1 rounded-sm text-[8.5px] font-bold">
                      {ratingStats.count}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Panels */}
              <div className="bg-white border border-sand-200/60 rounded-[4px] p-3 shadow-3xs text-[11px] leading-relaxed text-bark-700 min-h-[110px] overflow-x-hidden" id="quick-view-tab-panel">
                {activeTab === 'features' && features.length > 0 && (
                  <ul className="space-y-1 ml-1">
                    {features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-clay-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {activeTab === 'fabrics' && fabricSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-bark-550 font-medium text-[9.5px] uppercase tracking-wider">Recommended textiles for optimum drapery &amp; fit:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {fabricSuggestions.map((fab, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-sand-100 border border-sand-200/60 text-bark-800 rounded font-medium shadow-3xs">
                          {fab}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === 'notions' && (notions.length > 0 || yardageInfo.width44 || yardageInfo.width60) && (
                  <div className="space-y-2.5">
                    <div>
                      <span className="font-bold uppercase text-[8.5px] text-bark-450 tracking-wider block mb-0.5">{pfUiT("ui.components.patternquickviewmodal.5b082c6d4a")}</span>
                      {notions.length > 0 && <p className="text-bark-600">{notions.join(', ')}</p>}
                    </div>
                    <div className="border-t border-sand-150 pt-2 grid grid-cols-2 gap-2">
                      <div>
                        <span className="font-bold text-[8px] text-bark-450 uppercase tracking-wider block">{pfUiT("ui.components.patternquickviewmodal.438866801e")}</span>
                        <p className="text-bark-800 font-mono font-medium">{yardageInfo.width44 || '—'}</p>
                      </div>
                      <div>
                        <span className="font-bold text-[8px] text-bark-450 uppercase tracking-wider block">{pfUiT("ui.components.patternquickviewmodal.813fd35a50")}</span>
                        <p className="text-bark-800 font-mono font-medium">{yardageInfo.width60 || '—'}</p>
                      </div>
                    </div>
                  </div>
                )}
                {SHOW_SEWING_TIPS_TAB && activeTab === 'tips' && (
                  <div className="space-y-4" id="quick-view-sewing-tips-tab">
                    {/* Masterclass Host Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#FAF8F5] border border-sand-200/60 p-2.5 rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-clay-100 flex items-center justify-center text-clay-705 font-bold border border-clay-200 text-[10px]">
                          {pattern.tutorial?.instructor?.split(' ').map(n => n[0]).join('') || 'AT'}
                        </div>
                        <div className="leading-tight">
                          <span className="font-bold text-bark-900 block text-[10.5px]">{pfUiT("ui.components.patternquickviewmodal.0e93ab655d")}</span>
                          <span className="text-[9px] text-bark-500 font-sans">Led by Expert Instructor: {pattern.tutorial?.instructor || "Perfect Fit Bureau Team"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono bg-clay-550/10 text-[#ba6446] border border-clay-200/40 px-1.5 py-0.5 rounded uppercase font-bold">
                          {pattern.tutorial?.difficulty || pattern.difficulty || 'Intermediate'}
                        </span>
                        <span className="text-[9.5px] font-mono font-bold text-bark-750 bg-sand-100 px-1.5 py-0.5 rounded">
                          {pattern.tutorial?.duration || "15:00"} mins
                        </span>
                      </div>
                    </div>

                    {/* Youtube Video Embed Frame */}
                    <div className="space-y-2">
                      <span className="font-bold uppercase text-[8.5px] text-bark-450 tracking-wider block">{pfUiT("ui.components.patternquickviewmodal.3c86028c8a")}</span>
                      <div className="relative aspect-video w-full rounded border border-sand-200 overflow-hidden bg-bark-950 shadow-inner group" id="tips-video-player">
                        <iframe
                          className="w-full h-full"
                          src={`${pattern.tutorial?.videoUrl || "https://www.youtube.com/embed/gAnS9b_P04w"}`}
                          title={`${pattern.name} Sewing Video Tutorial`}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        ></iframe>
                      </div>
                    </div>

                    {/* Timeline Chapters / Steps Accordion Grid */}
                    <div className="space-y-2">
                      <span className="font-bold uppercase text-[8.5px] text-bark-450 tracking-wider block">Tutorial Timeline &amp; Assembly Chapters:</span>
                      <div className="grid grid-cols-1 gap-1.5">
                        {pattern.tutorial?.steps?.map((step, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setActiveStepIdx(idx);
                              if (window.showToast) {
                                window.showToast(`Selected Chapter: "${step.title}" (${step.time})`, 'info', 'Chapter Highlighted');
                              }
                            }}
                            className={`flex items-start text-left gap-2.5 p-2 rounded border transition-all text-xs cursor-pointer ${
                              activeStepIdx === idx
                                ? 'bg-clay-50/50 border-clay-250 text-bark-900 shadow-3xs'
                                : 'bg-white border-sand-150 hover:bg-sand-50/40 text-bark-650'
                            }`}
                            type="button"
                          >
                            <span className="font-mono text-[9.5px] bg-bark-100 text-bark-700 px-1.5 py-0.5 rounded font-bold shrink-0 mt-0.5">
                              {step.time}
                            </span>
                            <div className="leading-tight">
                              <span className={`font-semibold block text-[10.5px] ${activeStepIdx === idx ? 'text-clay-705 font-bold' : 'text-bark-850'}`}>
                                {step.title}
                              </span>
                              <p className="text-[9.5px] text-bark-550 mt-1 font-serif leading-relaxed">
                                {step.desc}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Difficulty-Specific Basic Techniques section for Beginners */}
                    <div className="border-t border-sand-150 pt-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-clay-605" />
                        <span className="font-bold uppercase text-[8.5px] text-bark-450 tracking-wider block">Beginner Support &amp; Basic Sewing Techniques:</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(pattern.difficulty === 'Beginner' || !pattern.difficulty) && (
                          <>
                            <div className="p-2.5 bg-sand-50/40 border border-sand-200/60 rounded">
                              <span className="font-bold text-bark-850 block text-[10px]">{pfUiT("ui.components.patternquickviewmodal.3cd1472483")}</span>
                              <p className="text-[9.5px] text-bark-550 mt-0.5 leading-normal">
                                Crucial for clean necklines. Don't slide the iron back and forth; press down firmly on seams and lift to avoid stretching curved bias garment edges.
                              </p>
                              <a
                                href="https://www.youtube.com/results?search_query=how+to+press+seams+sewing"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-[#ba6446] hover:text-clay-800 font-bold underline uppercase mt-1.5 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>{pfUiT("ui.components.patternquickviewmodal.741bbe2d48")}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>

                            <div className="p-2.5 bg-sand-50/40 border border-sand-200/60 rounded">
                              <span className="font-bold text-bark-850 block text-[10px]">{pfUiT("ui.components.patternquickviewmodal.ea6021e7a9")}</span>
                              <p className="text-[9.5px] text-bark-550 mt-0.5 leading-normal">{pfUiT("ui.components.patternquickviewmodal.e42ef82702")}</p>
                              <a
                                href="https://www.youtube.com/results?search_query=how+to+staystitch+neckline"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-[#ba6446] hover:text-clay-800 font-bold underline uppercase mt-1.5 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>{pfUiT("ui.components.patternquickviewmodal.741bbe2d48")}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </>
                        )}

                        {pattern.difficulty === 'Intermediate' && (
                          <>
                            <div className="p-2.5 bg-sand-50/40 border border-sand-200/60 rounded">
                              <span className="font-bold text-bark-850 block text-[10px]">{pfUiT("ui.components.patternquickviewmodal.4a47222bd7")}</span>
                              <p className="text-[9.5px] text-bark-550 mt-0.5 leading-normal">{pfUiT("ui.components.patternquickviewmodal.2250fecf07")}</p>
                              <a
                                href="https://www.youtube.com/results?search_query=how+to+sew+french+seams"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-[#ba6446] hover:text-clay-800 font-bold underline uppercase mt-1.5 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>{pfUiT("ui.components.patternquickviewmodal.741bbe2d48")}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>

                            <div className="p-2.5 bg-sand-50/40 border border-sand-200/60 rounded">
                              <span className="font-bold text-bark-850 block text-[10px]">{pfUiT("ui.components.patternquickviewmodal.7370919474")}</span>
                              <p className="text-[9.5px] text-bark-550 mt-0.5 leading-normal">{pfUiT("ui.components.patternquickviewmodal.328776b2a0")}</p>
                              <a
                                href="https://www.youtube.com/results?search_query=how+to+sew+pants+fly+zipper"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-[#ba6446] hover:text-clay-800 font-bold underline uppercase mt-1.5 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>{pfUiT("ui.components.patternquickviewmodal.741bbe2d48")}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </>
                        )}

                        {pattern.difficulty === 'Advanced' && (
                          <>
                            <div className="p-2.5 bg-sand-50/40 border border-sand-200/60 rounded">
                              <span className="font-bold text-bark-850 block text-[10px]">{pfUiT("ui.components.patternquickviewmodal.d288904ebd")}</span>
                              <p className="text-[9.5px] text-bark-550 mt-0.5 leading-normal">{pfUiT("ui.components.patternquickviewmodal.bdc1b526c8")}</p>
                              <a
                                href="https://www.youtube.com/results?search_query=how+to+use+tailor+wooden+clapper"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-[#ba6446] hover:text-clay-800 font-bold underline uppercase mt-1.5 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>{pfUiT("ui.components.patternquickviewmodal.741bbe2d48")}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>

                            <div className="p-2.5 bg-sand-50/40 border border-sand-200/60 rounded">
                              <span className="font-bold text-bark-850 block text-[10px]">{pfUiT("ui.components.patternquickviewmodal.53e65f18ad")}</span>
                              <p className="text-[9.5px] text-bark-550 mt-0.5 leading-normal">
                                Key to outerwear tailoring. Slash corner triangles accurately right to the stitch line. Over-slashing creates outer holes; under-slashing makes bulky puckers.
                              </p>
                              <a
                                href="https://www.youtube.com/results?search_query=how+to+sew+welt+pockets"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-[#ba6446] hover:text-clay-800 font-bold underline uppercase mt-1.5 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>{pfUiT("ui.components.patternquickviewmodal.741bbe2d48")}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Masterclass Expert Tips Notes */}
                    <div className="bg-sand-50/50 border border-sand-150 p-2.5 rounded text-[10px]" id="tips-instructor-wisdom">
                      <span className="font-bold uppercase text-[8px] text-[#ba6446] tracking-wider block mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#ba6446]" />
                        <span>{pfUiT("ui.components.patternquickviewmodal.2fe3541b12")}</span>
                      </span>
                      <ul className="space-y-1 text-bark-650 list-disc pl-3">
                        {pattern.tutorial?.tips?.map((tip, idx) => (
                          <li key={idx} className="leading-normal">{tip}</li>
                        )) || (
                          <>
                            <li className="leading-normal">{pfUiT("ui.components.patternquickviewmodal.80699f6ba4")}</li>
                            <li className="leading-normal">{pfUiT("ui.components.patternquickviewmodal.71ba7dbf28")}</li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
                {activeTab === 'reviews' && (
                  <div className="max-h-[420px] overflow-y-auto overflow-x-hidden pr-2" id="quick-view-reviews-wrapper">
                    <CustomerGalleryAndReviews
                      pattern={pattern}
                      reviews={reviews}
                      onAddReview={onAddReview}
                      currentUser={null}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Social Sharing Inspiration Section */}
          <div className="bg-[#FAF8F5] border border-sand-200/60 p-3.5 rounded-lg space-y-2 mt-4" id="quick-view-share-row">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] text-bark-800 uppercase tracking-wider font-mono font-bold flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-clay-605" />
                <span>{pfUiT("ui.components.patternquickviewmodal.ee6a8a24b5")}</span>
              </span>
              <span className="text-[9px] text-bark-450 italic font-serif">{pfUiT("ui.components.patternquickviewmodal.11536ba128")}</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5" id="social-share-buttons-grid">
              {/* Twitter / X */}
              <button
                onClick={() => {
                  const text = encodeURIComponent(`Drafting the exquisite ${pattern.name} from Perfect Fit Bureau! 🧵✂️ #SewingCommunity #SlowFashion`);
                  const url = encodeURIComponent(`${window.location.origin}/#pattern/${pattern.id}`);
                  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
                  if (window.showToast) {
                    window.showToast('Twitter / X share dialog opened!', 'success', 'Shared Successfully');
                  }
                }}
                className="flex flex-col items-center justify-center py-2.5 rounded border border-sand-200 bg-white hover:border-bark-900 hover:bg-bark-50/50 hover:text-bark-900 text-bark-600 transition-all cursor-pointer active:scale-95 shadow-3xs"
                title={pfUiT("ui.components.patternquickviewmodal.01bb62333f")}
                id="share-twitter-btn"
                type="button"
              >
                <Twitter className="w-3.5 h-3.5" />
                <span className="text-[8.5px] font-mono font-bold mt-1 uppercase tracking-tighter">{pfUiT("ui.components.patternquickviewmodal.294595bea9")}</span>
              </button>

              {/* Pinterest */}
              <button
                onClick={() => {
                  const description = encodeURIComponent(`The beautiful ${pattern.name} sewing pattern blueprint from Perfect Fit Bureau! 📐✨`);
                  const url = encodeURIComponent(`${window.location.origin}/#pattern/${pattern.id}`);
                  const media = encodeURIComponent(pattern.image);
                  window.open(`https://pinterest.com/pin/create/button/?url=${url}&media=${media}&description=${description}`, '_blank');
                  if (window.showToast) {
                    window.showToast('Pinned to Pinterest board suggestion!', 'success', 'Pinned Successfully');
                  }
                }}
                className="flex flex-col items-center justify-center py-2.5 rounded border border-sand-200 bg-white hover:border-rose-600 hover:bg-rose-50/50 hover:text-rose-700 text-bark-600 transition-all cursor-pointer active:scale-95 shadow-3xs"
                title={pfUiT("ui.components.patternquickviewmodal.87cfdfdacf")}
                id="share-pinterest-btn"
                type="button"
              >
                <PinterestIcon className="w-3.5 h-3.5" />
                <span className="text-[8.5px] font-mono font-bold mt-1 uppercase tracking-tighter">{pfUiT("ui.components.patternquickviewmodal.2e92796697")}</span>
              </button>

              {/* Facebook */}
              <button
                onClick={() => {
                  const url = encodeURIComponent(`${window.location.origin}/#pattern/${pattern.id}`);
                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
                  if (window.showToast) {
                    window.showToast('Facebook share dialog launched!', 'success', 'Shared Successfully');
                  }
                }}
                className="flex flex-col items-center justify-center py-2.5 rounded border border-sand-200 bg-white hover:border-blue-600 hover:bg-blue-50/50 hover:text-blue-700 text-bark-600 transition-all cursor-pointer active:scale-95 shadow-3xs"
                title={pfUiT("ui.components.patternquickviewmodal.362e224c3b")}
                id="share-facebook-btn"
                type="button"
              >
                <Facebook className="w-3.5 h-3.5" />
                <span className="text-[8.5px] font-mono font-bold mt-1 uppercase tracking-tighter">{pfUiT("ui.components.patternquickviewmodal.cd0be4a25f")}</span>
              </button>

              {/* Instagram (Copy Link specialized for IG stories) */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/#pattern/${pattern.id}`);
                  if (window.showToast) {
                    window.showToast('Blueprint link copied! Paste in your Instagram stories or bio to tag us @PerfectFitBureau.', 'success', 'Instagram Link Ready');
                  } else {
                    alert('Blueprint link copied! Share this inspiration in your Instagram stories or bio.');
                  }
                }}
                className="flex flex-col items-center justify-center py-2.5 rounded border border-sand-200 bg-white hover:border-fuchsia-600 hover:bg-fuchsia-50/50 hover:text-fuchsia-700 text-bark-600 transition-all cursor-pointer active:scale-95 shadow-3xs"
                title={pfUiT("ui.components.patternquickviewmodal.4cd839c6ab")}
                id="share-instagram-btn"
                type="button"
              >
                <Instagram className="w-3.5 h-3.5" />
                <span className="text-[8.5px] font-mono font-bold mt-1 uppercase tracking-tighter">{pfUiT("ui.components.patternquickviewmodal.6e0092a666")}</span>
              </button>

              {/* Direct Link Copier */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/#pattern/${pattern.id}`);
                  if (window.showToast) {
                    window.showToast('Bespoke sewing pattern link copied to clipboard.', 'success', 'Link Copied');
                  } else {
                    alert('Blueprint link copied!');
                  }
                }}
                className="flex flex-col items-center justify-center py-2.5 rounded border border-sand-200 bg-white hover:border-[#ba6446] hover:bg-[#ba6446]/5 hover:text-[#ba6446] text-bark-600 transition-all cursor-pointer active:scale-95 shadow-3xs"
                title={pfUiT("ui.components.patternquickviewmodal.774ce266ea")}
                id="share-copylink-btn"
                type="button"
              >
                <Link className="w-3.5 h-3.5" />
                <span className="text-[8.5px] font-mono font-bold mt-1 uppercase tracking-tighter">{pfUiT("ui.components.patternquickviewmodal.fd99a7c6b2")}</span>
              </button>
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-4 pt-3 border-t border-sand-200/50 space-y-2.5" id="quick-view-actions">
            <div className="flex gap-2">
              <button
                onClick={handleAddToCart}
                className={`flex-1 py-3 px-4 rounded-[4px] text-xs font-bold uppercase tracking-widest cursor-pointer transition-all flex items-center justify-center gap-2 shadow-xs ${
                  justAdded
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-bark-900 hover:bg-bark-950 text-sand-50 active:scale-[0.99]'
                }`}
                id="quick-view-add-cart-btn"
              >
                {justAdded ? (
                  <>
                    <Check className="w-4 h-4 animate-bounce" />
                    <span>{pfUiT("ui.components.patternquickviewmodal.c306d82f10")}</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    <span>Add to cart — ${(currentPrice).toFixed(2)}</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  onToggleFavorite(pattern.id);
                }}
                className={`px-4 py-3 rounded-[4px] border transition-all cursor-pointer flex items-center justify-center shadow-xs active:scale-95 ${
                  isFavorite
                    ? 'bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-100/50'
                    : 'bg-white border-sand-250 text-bark-500 hover:text-rose-500 hover:bg-rose-50/20 hover:border-rose-200'
                }`}
                title={isFavorite ? "Remove from Saved Blueprints" : "Save to Favorites"}
                id="quick-view-toggle-favorite-btn"
                type="button"
              >
                <Heart className={`w-4 h-4 transition-transform ${isFavorite ? 'fill-current scale-110' : ''}`} />
              </button>
            </div>

            {canMessageDesigner && (
              <button
                type="button"
                onClick={handleMessageDesigner}
                className="w-full py-2.5 px-4 bg-white hover:bg-sand-100 border border-sand-250 text-bark-800 hover:text-bark-950 transition-all rounded-[4px] flex items-center justify-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider cursor-pointer shadow-3xs active:scale-98"
                id="quick-view-message-designer-btn"
              >
                <Mail className="w-3.5 h-3.5 text-clay-605" />
                <span>{pfUiT("ui.components.patternquickviewmodal.e811875234")}</span>
              </button>
            )}

            {/* Professional-only technical room is hidden from public quick view for now. */}
            {false && (
            <button
              onClick={() => {
                onClose();
                onExploreSwatches(pattern.id);
              }}
              className="w-full py-2 px-4 bg-white hover:bg-sand-100 border border-sand-250 text-bark-800 hover:text-bark-950 transition-all rounded-[4px] flex items-center justify-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider cursor-pointer shadow-3xs active:scale-98"
              id="quick-view-inspect-btn"
            >
              <Sparkles className="w-3.5 h-3.5 text-clay-605" />
              <span>Full Swatches &amp; Technical Drawings Room</span>
            </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Product-scoped Find My Size. The mannequin remains the measurement guide;
          the governed recommendation engine returns the canonical size into Quick View. */}
      <AnimatePresence>
        {isFindMySizeOpen && (
          <div
            className="fixed inset-0 bg-bark-950/55 p-2 backdrop-blur-sm sm:p-4 md:p-6"
            style={{ zIndex: UI_LAYERS.criticalDialog }}
            id="quick-view-find-my-size-overlay"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="mx-auto flex h-full w-full max-w-[1440px] flex-col overflow-hidden rounded-[14px] border border-sand-200 bg-[#FAF8F5] shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-sand-200 bg-white px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-clay-650">
                    <Ruler className="h-3.5 w-3.5" />{pfUiT("ui.components.patternquickviewmodal.79b581bf13")}</div>
                  <div className="mt-0.5 truncate font-serif text-base font-semibold text-bark-950 sm:text-lg">
                    {pattern.name}
                  </div>
                  <p className="mt-0.5 text-[10px] text-bark-500">{pfUiT("ui.components.patternquickviewmodal.ae12af7f96")}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFindMySizeOpen(false)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sand-200 bg-white text-bark-600 transition-colors hover:bg-sand-50 hover:text-bark-950"
                  aria-label={pfUiT("ui.components.patternquickviewmodal.e1f5f75d18")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3 md:p-4">
                <MannequinGuide
                  patterns={[pattern]}
                  initialPatternId={pattern.id}
                  lockProductSelection
                  activeRecommendedSize={fitRecommendedDisplaySize || selectedSize}
                  onRecommendedSizeChange={(size) => {
                    if (availableSizes.includes(size)) {
                      setSelectedSize(size);
                    }
                  }}
                  onRecommendationApplied={handleFitRecommendationApplied}
                />
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-sand-200 bg-white px-4 py-2.5 text-[10px] text-bark-500 sm:px-5">
                <span>{pfUiT("ui.components.patternquickviewmodal.1d75e08d21")}</span>
                <button
                  type="button"
                  onClick={() => setIsFindMySizeOpen(false)}
                  className="rounded-full bg-bark-900 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white hover:bg-bark-950"
                >{pfUiT("ui.components.patternquickviewmodal.5d919dd75f")}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interactive Lightbox for fabric texture/sewing inspection */}
      <AnimatePresence>
        {isTechnicalSketchOpen && (
          <div
            className="fixed inset-0 flex items-center justify-center p-4 md:p-8 bg-bark-950/98 backdrop-blur-sm"
            style={{ zIndex: UI_LAYERS.criticalDialog }}
            id="texture-zoom-lightbox"
          >
            {/* Backdrop Dismiss */}
            <div className="absolute inset-0 cursor-zoom-out" onClick={() => setIsTechnicalSketchOpen(false)} />

            {/* Lightbox Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-bark-900 border border-bark-800 rounded-lg w-[90vw] max-w-5xl h-[88vh] grid grid-cols-1 md:grid-cols-[minmax(0,0.64fr)_minmax(320px,0.36fr)] shadow-2xl overflow-hidden z-[270]"
            >
              {/* Left Column: Interactive Zoom Canvas */}
              <div className="relative h-[54vh] md:h-full bg-bark-950 overflow-hidden flex items-center justify-center cursor-move" id="lightbox-image-viewport">

                {/* Draggable/Scalable Image Container using motion or simple transform */}
                <div
                  className="w-full h-full flex items-center justify-center select-none"
                  style={{
                    transform: `scale(${lightboxZoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.15s ease-out'
                  }}
                  onMouseDown={handlePanStart}
                  onMouseMove={handlePanMove}
                  onMouseUp={handlePanEnd}
                  onMouseLeave={handlePanEnd}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handlePanEnd}
                >
                  {/* Base original image (always pristine, preserves face, hair, and background skin tones perfectly) */}
                  <img
                    src={activeImage}
                    alt={pattern.name}
                    className="max-w-full max-h-full object-contain pointer-events-none transition-all duration-500"
                    referrerPolicy="no-referrer"
                    id="lightbox-image-base"
                  />

                  {/* Dynamic Fabric Visualizer Layer with Skin-Preserving & Background-Preserving Ellipse Mask */}
                  {selectedTexture.id !== 'original' && (
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      style={{
                        maskImage: getMaskForPattern(pattern.id),
                        WebkitMaskImage: getMaskForPattern(pattern.id),
                        maskRepeat: 'no-repeat',
                        WebkitMaskRepeat: 'no-repeat',
                        maskSize: '100% 100%',
                        WebkitMaskSize: '100% 100%',
                      }}
                      id="lightbox-visualizer-layer"
                    >
                      {/* Filtered image of the garment */}
                      <img
                        src={activeImage}
                        alt={pattern.name}
                        style={{ filter: selectedTexture.filter }}
                        className="max-w-full max-h-full object-contain transition-all duration-500"
                        referrerPolicy="no-referrer"
                        id="lightbox-image-filtered"
                      />

                      {/* Fabric Texture Overlay */}
                      <div
                        className="absolute inset-0 pointer-events-none transition-all duration-500 ease-in-out"
                        style={{
                          background: selectedTexture.overlayBackground,
                          mixBlendMode: selectedTexture.blendMode,
                          opacity: selectedTexture.opacity,
                        }}
                        id="lightbox-texture-overlay"
                      />
                    </div>
                  )}
                </div>

                {visibleMediaItems.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : visibleMediaItems.length - 1));
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-bark-900 shadow-lg hover:bg-white"
                      aria-label={pfUiT("ui.components.patternquickviewmodal.d691de50f6")}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageIndex((prev) => (prev < visibleMediaItems.length - 1 ? prev + 1 : 0));
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-bark-900 shadow-lg hover:bg-white"
                      aria-label={pfUiT("ui.components.patternquickviewmodal.5dfb32bb67")}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Corner Quick Actions & Instructions */}
                <div className="absolute bottom-4 left-4 bg-bark-950/80 backdrop-blur-xs border border-bark-800 px-3 py-1.5 rounded text-[10px] text-sand-300 font-mono flex items-center gap-2">
                  <Move className="w-3.5 h-3.5 text-clay-400" />
                  <span>{pfUiT("ui.components.patternquickviewmodal.ffe20397fe")}</span>
                </div>

                <div className="absolute top-4 left-4 bg-bark-950/85 backdrop-blur-xs border border-bark-800 px-2.5 py-1.5 rounded text-[10px] text-clay-400 font-bold font-mono tracking-wider">
                  Zoom: {Math.round(lightboxZoom * 100)}%
                </div>
              </div>

              {/* Right Column: Zoom Controls & Sewing Specs */}
              <div className="min-h-0 p-4 flex flex-col justify-between bg-bark-900 border-t md:border-t-0 md:border-l border-bark-800 text-sand-50 overflow-y-auto">

                <div className="space-y-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-mono text-clay-400 tracking-widest uppercase font-bold block mb-1">{pfUiT("ui.components.patternquickviewmodal.c05f0cba9e")}</span>
                      <h4 className="text-lg font-serif font-medium text-white">{pattern.name}</h4>
                    </div>

                    {/* Close Lightbox */}
                    <button
                      onClick={() => setIsTechnicalSketchOpen(false)}
                      className="p-1.5 rounded-full border border-bark-800 hover:border-bark-700 hover:bg-bark-800 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4 text-sand-300" />
                    </button>
                  </div>

                  {/* Interactive Controls Panel */}
                  <div className="bg-bark-950 border border-bark-800 p-3 rounded-md">
                    {/* Scale Input Slider */}
                    <div className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-2">
                      <span className="text-[10px] font-mono text-bark-400 uppercase tracking-wider">{pfUiT("ui.components.patternquickviewmodal.9304913ab9")}</span>
                      <button
                        onClick={() => handleAdjustZoom(-0.1)}
                        disabled={lightboxZoom <= 1}
                        className="p-2 border border-bark-800 hover:border-bark-700 rounded text-[10px] font-mono text-center cursor-pointer transition-colors hover:bg-bark-800/40 disabled:opacity-30 disabled:pointer-events-none"
                        aria-label={pfUiT("ui.components.patternquickviewmodal.3f5efebf1f")}
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="0.1"
                        value={lightboxZoom}
                        onChange={(e) => {
                          setLightboxZoom(parseFloat(e.target.value));
                          if (parseFloat(e.target.value) === 1) {
                            setPanOffset({ x: 0, y: 0 });
                          }
                        }}
                        className="w-full h-1 bg-bark-800 rounded-lg appearance-none cursor-pointer accent-clay-550"
                        aria-label={pfUiT("ui.components.patternquickviewmodal.177bb1a0c7")}
                      />
                      <button
                        onClick={() => handleAdjustZoom(0.1)}
                        disabled={lightboxZoom >= 4}
                        className="p-2 border border-bark-800 hover:border-bark-700 rounded text-[10px] font-mono text-center cursor-pointer transition-colors hover:bg-bark-800/40 disabled:opacity-30 disabled:pointer-events-none"
                        aria-label={pfUiT("ui.components.patternquickviewmodal.789cb07394")}
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setLightboxZoom(1.5);
                          setPanOffset({ x: 0, y: 0 });
                        }}
                        className="px-2.5 py-1.5 border border-bark-800 hover:border-bark-700 rounded text-[10px] font-mono text-center cursor-pointer transition-colors hover:bg-bark-800/40"
                      >{pfUiT("ui.components.patternquickviewmodal.c31df96433")}</button>
                    </div>
                    <span className="mt-2 block font-mono text-[11px] text-sand-300">{Math.round(lightboxZoom * 100)}%</span>
                  </div>

                  {/* Sewing / Texture Specifications */}
                  <div className="space-y-3 pt-2">
                    <h5 className="text-[11px] font-mono font-bold text-clay-400 uppercase tracking-wider">{pfUiT("ui.components.patternquickviewmodal.c3791a4b5c")}</h5>

                    <div className="space-y-2.5 text-xs text-sand-300 font-sans">
                      <div className="border-l-2 border-clay-550 pl-3 py-0.5">
                        <strong className="block text-[10px] uppercase font-mono text-white mb-0.5">{pfUiT("ui.components.patternquickviewmodal.d97097beb8")}</strong>
                        <p className="leading-relaxed text-sand-300">{pfUiT("ui.components.patternquickviewmodal.3614141e10")}</p>
                      </div>

                      <div className="border-l-2 border-bark-700 pl-3 py-0.5">
                        <strong className="block text-[10px] uppercase font-mono text-white mb-0.5">{pfUiT("ui.components.patternquickviewmodal.7f3ace3d8c")}</strong>
                        <p className="leading-relaxed text-sand-300">
                          For {pattern.fabricSuggestions[0] || "linens/wool"}, we advise using size 80/12 universal or microtex sewing needles with high-twist thread.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-bark-800 flex items-center justify-between text-[10px] text-bark-400 font-mono">
                  <span>{pfUiT("ui.components.patternquickviewmodal.1fb17f6ec0")}</span>
                  <span>{pfUiT("ui.components.patternquickviewmodal.2a7e90f84a")}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
