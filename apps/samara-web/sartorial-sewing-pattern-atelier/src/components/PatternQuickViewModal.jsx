/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingCart, Star, Heart, Check, Sparkles, Scissors, Compass, Layers, BookOpen, Twitter, Instagram, Share2, ZoomIn, ZoomOut, Maximize2, Minimize2, Move, ChevronDown, ChevronLeft, ChevronRight, Paintbrush, Play, Video, ExternalLink, Facebook, Link, Eye, Lock, FileText, Image as ImageIcon } from 'lucide-react';
import CustomerGalleryAndReviews from './CustomerGalleryAndReviews';
import { getPatternMedia } from '../lib/patternMediaManager';

const PinterestIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" />
  </svg>
);

const getDifficultyInfo = (diff) => {
  switch (diff) {
    case 'Beginner':
      return {
        label: 'Beginner Friendly',
        icon: Compass,
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        iconColor: 'text-emerald-600',
        description: 'Ideal for new sewists. Simple, rewarding construction.'
      };
    case 'Intermediate':
      return {
        label: 'Intermediate Draft',
        icon: Scissors,
        classes: 'bg-amber-50 text-amber-700 border-amber-200',
        iconColor: 'text-amber-600',
        description: 'Requires collar assembly, curves, or clean finishes.'
      };
    case 'Advanced':
      return {
        label: 'Advanced Couture',
        icon: Sparkles,
        classes: 'bg-rose-50 text-rose-700 border-rose-200',
        iconColor: 'text-rose-600',
        description: 'Sophisticated lining, precision tailoring, or complex seams.'
      };
    default:
      return {
        label: diff || 'Intermediate',
        icon: Scissors,
        classes: 'bg-sand-50 text-bark-700 border-sand-200',
        iconColor: 'text-bark-500',
        description: 'Perfect for building core garment assembly skills.'
      };
  }
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

const FABRIC_TEXTURES = [
  {
    id: 'original',
    name: 'Original Blueprint',
    type: 'Stock Design',
    colorClass: 'bg-sand-100 border border-sand-300',
    overlayBackground: 'none',
    blendMode: 'normal',
    opacity: 0,
    filter: 'none',
    description: 'The standard curated aesthetic template from our designers.'
  },
  {
    id: 'linen',
    name: 'Belgian Woven Linen',
    type: 'Oatmeal Tweed',
    colorClass: 'bg-[#EAE1D4] border border-sand-400',
    overlayBackground: 'repeating-linear-gradient(0deg, rgba(139,115,85,0.08) 0px, rgba(139,115,85,0.08) 1px, transparent 1px, transparent 3px), repeating-linear-gradient(90deg, rgba(139,115,85,0.08) 0px, rgba(139,115,85,0.08) 1px, transparent 1px, transparent 3px)',
    blendMode: 'multiply',
    opacity: 0.85,
    filter: 'sepia(0.18) contrast(1.05) brightness(0.98)',
    description: 'Crisp woven Belgian flax with signature linen crosshatch grain.'
  },
  {
    id: 'denim',
    name: 'Raw Indigo Twill',
    type: '11oz Denim',
    colorClass: 'bg-[#2A3E5C] border border-[#1E2E44]',
    overlayBackground: 'repeating-linear-gradient(45deg, rgba(0,40,120,0.15) 0px, rgba(0,40,120,0.15) 2px, rgba(255,255,255,0.06) 2px, rgba(255,255,255,0.06) 4px)',
    blendMode: 'color-burn',
    opacity: 0.9,
    filter: 'hue-rotate(190deg) saturate(1.4) contrast(1.15) brightness(0.85)',
    description: 'Heavy diagonal-ridge denim twill, optimal for structured seams.'
  },
  {
    id: 'crepe',
    name: 'Terracotta Crinkle Crepe',
    type: 'Double Gauze',
    colorClass: 'bg-[#C96C4E] border border-[#B3583C]',
    overlayBackground: 'radial-gradient(circle, rgba(184,80,48,0.1) 0%, transparent 60%), repeating-radial-gradient(circle, rgba(184,80,48,0.08) 0px, rgba(184,80,48,0.08) 1px, transparent 1px, transparent 4px)',
    blendMode: 'multiply',
    opacity: 0.85,
    filter: 'hue-rotate(345deg) saturate(1.3) brightness(0.95)',
    description: 'Flowy crinkled cotton crepe with organic puckers and airy drape.'
  },
  {
    id: 'satin',
    name: 'Emerald Silk Satin',
    type: 'Mulberry Silk',
    colorClass: 'bg-[#184F35] border border-[#0F3824]',
    overlayBackground: 'linear-gradient(135deg, rgba(16,124,65,0.15) 0%, rgba(255,255,255,0.3) 45%, rgba(16,65,30,0.25) 70%, rgba(255,255,255,0.1) 100%)',
    blendMode: 'overlay',
    opacity: 0.95,
    filter: 'hue-rotate(100deg) saturate(1.6) brightness(0.8) contrast(1.2)',
    description: 'High-luster mulberry silk satin with fluid shine and sleek light folds.'
  },
  {
    id: 'velvet',
    name: 'Burgundy Royal Velvet',
    type: 'Plush Pile',
    colorClass: 'bg-[#581825] border border-[#3A1018]',
    overlayBackground: 'linear-gradient(90deg, rgba(88,24,37,0.1) 0%, rgba(255,255,255,0.15) 30%, rgba(0,0,0,0.3) 75%, rgba(88,24,37,0.1) 100%)',
    blendMode: 'multiply',
    opacity: 0.9,
    filter: 'hue-rotate(320deg) saturate(1.1) brightness(0.85) contrast(1.1)',
    description: 'Rich deep-red velvet with a smooth, short pile and luxurious, light-catching sheen.'
  },
  {
    id: 'plaid',
    name: 'Highland Tartan Plaid',
    type: 'Flannel Wool',
    colorClass: 'bg-[#9B2C2C] border border-[#7B1F1F]',
    overlayBackground: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 8px, transparent 8px, transparent 16px), repeating-linear-gradient(90deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 8px, transparent 8px, transparent 16px), repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 4px, transparent 4px, transparent 8px)',
    blendMode: 'multiply',
    opacity: 0.9,
    filter: 'hue-rotate(350deg) saturate(1.2) contrast(1.1)',
    description: 'Traditional brushed wool flannel with overlapping checkered red and dark hunter lines.'
  },
  {
    id: 'stripe',
    name: 'Classic Breton Stripe',
    type: 'Interlock Knit',
    colorClass: 'bg-[#F7F5F0] border border-[#CCCCCC]',
    overlayBackground: 'repeating-linear-gradient(0deg, #1E2E44 0px, #1E2E44 6px, transparent 6px, transparent 14px)',
    blendMode: 'multiply',
    opacity: 0.88,
    filter: 'contrast(1.05) brightness(1.02)',
    description: 'Medium-weight maritime jersey cotton displaying timeless alternating horizontal navy bars.'
  }
];

export default function PatternQuickViewModal({
  pattern,
  onClose,
  onAddToCart,
  onExploreSwatches,
  activeRecommendedSize = '8',
  isFavorite = false,
  onToggleFavorite = () => {},
  reviews = [],
  onAddReview
}) {
  if (!pattern) return null;

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

  // Retrieve media items for this pattern
  const rawMediaItems = useMemo(() => {
    if (!pattern) return [];
    return getPatternMedia(pattern.id);
  }, [pattern, mediaGalleryVersion]);

  // Filter out SECRET media items - ONLY public/visible media is shown in Quick View Summary
  const visibleMediaItems = useMemo(() => {
    return rawMediaItems.filter(item => !item.isSecret);
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

  // Reset image index when pattern ID changes or visible media count changes
  useEffect(() => {
    setActiveImageIndex(0);
  }, [pattern?.id, visibleMediaItems.length]);

  const [format, setFormat] = useState('PDF');
  const [selectedSize, setSelectedSize] = useState(activeRecommendedSize);
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

  // Hover zoom state on the main thumbnail
  const [zoomStyle, setZoomStyle] = useState({ transformOrigin: 'center center', transform: 'scale(1)' });
  const [isZoomed, setIsZoomed] = useState(false);

  // Full-screen interactive lightbox states
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1.5);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomStyle({
      transformOrigin: `${x}% ${y}%`,
      transform: 'scale(2.2)'
    });
  };

  const handleMouseEnter = () => {
    setIsZoomed(true);
  };

  const handleMouseLeave = () => {
    setIsZoomed(false);
    setZoomStyle({ transformOrigin: 'center center', transform: 'scale(1)' });
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

  const currentPrice = format === 'PDF' ? pattern.pricePDF : pattern.pricePrinted;
  const diffInfo = getDifficultyInfo(pattern.difficulty);
  const DiffIcon = diffInfo.icon;

  const handleAddToCart = () => {
    onAddToCart(pattern, format, selectedSize);
    setJustAdded(true);

    setTimeout(() => {
      setJustAdded(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-150 overflow-y-auto flex items-center justify-center p-4 sm:p-6" id="pattern-quick-view-modal">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-bark-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
        id="quick-view-backdrop"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ type: 'spring', duration: 0.4 }}
        className="bg-white border border-sand-250/60 shadow-2xl rounded-lg max-w-4xl w-full mx-auto relative overflow-hidden flex flex-col md:flex-row z-10 max-h-[92vh]"
        id="quick-view-card"
      >
        {/* Left Side: Photo + Controls */}
        <div className="md:w-5/12 flex flex-col bg-sand-50 border-r border-sand-200/50" id="quick-view-left-column">
          {/* Main Photo container */}
          <div
            className="relative flex-1 min-h-[300px] md:min-h-[460px] overflow-hidden group select-none flex flex-col justify-between"
            id="quick-view-image-container"
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={() => setIsLightboxOpen(true)}
          >
            {/* Base original image (always pristine, preserves face, hair, and background skin tones perfectly) */}
            <motion.img
              src={activeImage}
              alt={pattern.name}
              style={{
                ...(isZoomed ? { transformOrigin: zoomStyle.transformOrigin, transform: zoomStyle.transform } : { transform: 'scale(1)' }),
              }}
              className="w-full h-full object-cover transition-all duration-500 ease-out cursor-zoom-in"
              referrerPolicy="no-referrer"
              id="quick-view-image-base"
            />

            {/* Dynamic Fabric Visualizer Layer with Skin-Preserving & Background-Preserving Ellipse Mask */}
            {selectedTexture.id !== 'original' && (
              <div
                className="absolute inset-0 pointer-events-none transition-all duration-500 ease-in-out"
                style={{
                  maskImage: getMaskForPattern(pattern.id),
                  WebkitMaskImage: getMaskForPattern(pattern.id),
                  maskRepeat: 'no-repeat',
                  WebkitMaskRepeat: 'no-repeat',
                  maskSize: '100% 100%',
                  WebkitMaskSize: '100% 100%',
                  ...(isZoomed ? { transformOrigin: zoomStyle.transformOrigin, transform: zoomStyle.transform } : { transform: 'scale(1)' }),
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
            {(showSeamAllowances || showNotches) && (
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
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ba6446] animate-pulse"></span>
                    Interactive Blueprint CAD Mode
                  </span>
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

            {/* Overlay to fade out background when zoomed */}
            <div className="absolute inset-0 bg-gradient-to-t from-bark-950/50 via-transparent to-bark-950/20 pointer-events-none" />

            {/* Floating Instructions Banner */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10 bg-bark-900/90 backdrop-blur-xs px-2.5 py-1.5 rounded-[4px] text-[10px] font-mono font-bold uppercase tracking-wider text-sand-50 shadow-md border border-bark-800 transition-opacity duration-300 group-hover:opacity-100 opacity-90">
              <ZoomIn className="w-3.5 h-3.5 text-clay-400" />
              <span>Click to Zoom &amp; Pan</span>
            </div>

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
                  title="Previous Photo / Technical Sketch"
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
                  title="Next Photo / Technical Sketch"
                >
                  <ChevronRight className="w-5 h-5 stroke-[2.5px]" />
                </button>

                {/* Top Slide Counter Badge */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-bark-950/85 text-amber-200 border border-amber-300/30 text-[9.5px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md backdrop-blur-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-clay-400 animate-pulse"></span>
                  <span>Slide {activeImageIndex + 1} / {visibleMediaItems.length}</span>
                </div>
              </>
            )}

            {/* Symmetrical Floating Branding Overlay */}
            <div className="absolute top-4 left-4 flex flex-col leading-none z-10 select-none bg-white/70 backdrop-blur-xs p-2 rounded border border-sand-200/40">
              <span className="font-serif italic text-xs font-bold text-bark-900 tracking-tight">Perfect Fit</span>
              <span className="text-[6px] font-mono tracking-[0.25em] text-bark-500 font-bold uppercase mt-0.5">SEWS</span>
            </div>

            <div className="absolute bottom-4 left-4 space-y-1.5 z-10">
              {activeMediaItem && (
                <div className="flex items-center gap-1.5 bg-bark-900/90 text-amber-100 backdrop-blur-xs px-2.5 py-1 rounded border border-amber-300/30 text-[9.5px] font-mono font-bold uppercase tracking-wide shadow-md">
                  <Eye className="w-3 h-3 text-clay-400" />
                  <span>{activeMediaItem.typeLabel || 'Garment Photo'}: {activeMediaItem.title}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono tracking-wider font-semibold uppercase bg-white/95 px-2 py-0.5 rounded border border-sand-150 shadow-3xs inline-block">
                  {pattern.category}
                </span>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-mono font-bold uppercase tracking-wider bg-white/95 shadow-3xs`}>
                  <DiffIcon className={`w-3 h-3 ${diffInfo.iconColor}`} />
                  <span>{diffInfo.label}</span>
                </div>
              </div>
            </div>

            {/* Prompt/Tooltip to guide user */}
            {!isZoomed && (
              <div className="absolute inset-x-0 bottom-16 flex justify-center pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100">
                <span className="bg-white/90 backdrop-blur-xs border border-sand-250 text-[10px] text-bark-800 font-bold tracking-wide px-3 py-1.5 rounded-full shadow-lg">
                  Hover to magnify fabric details
                </span>
              </div>
            )}
          </div>

          {/* Interactive Extra Photos & Technical Sketches Gallery Thumbnails */}
          {visibleMediaItems.length > 0 && (
            <div className="bg-sand-100/40 border-b border-sand-200/50 p-2 shrink-0 flex flex-col gap-1" id="modal-extra-photos-bar">
              <div className="flex justify-between items-center px-1.5 mb-1">
                <span className="text-[8.5px] font-mono font-bold uppercase tracking-wider text-bark-600 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-clay-605" />
                  <span>Public Media &amp; Technical Sketches ({visibleMediaItems.length})</span>
                </span>
                <span className="text-[7.5px] font-mono text-bark-400 italic">
                  (🔒 Secret media hidden)
                </span>
              </div>
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
          <div className="bg-white border-t border-sand-200 p-4 space-y-3 shrink-0" id="blueprint-controls-panel">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-550 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-clay-65b" />
                <span>Print Prep Blueprints</span>
              </span>
              <span className="text-[8px] bg-clay-50 text-clay-705 px-1.5 py-0.5 rounded font-mono font-bold">CAD v2.5</span>
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
                  <span className="text-[10px] font-bold text-bark-900 block">Show Seam Allowances</span>
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
                  <span className="text-[10px] font-bold text-bark-900 block">Show Alignment Notches</span>
                  <span className="text-[8.5px] text-bark-450 font-serif">Overlay match triangles &amp; grain points for pattern pieces</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Side: Specifications and Quick Actions */}
        <div className="md:w-7/12 p-6 md:p-8 flex flex-col justify-between overflow-y-auto max-h-[55vh] md:max-h-[92vh] bg-[#FAF9F6]/30" id="quick-view-content">

          {/* Floating Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full border border-sand-200 hover:border-sand-300 text-bark-500 hover:text-bark-900 bg-white/90 hover:bg-sand-50 transition-all cursor-pointer z-20 shadow-3xs active:scale-95"
            aria-label="Close Quick View Modal"
            id="quick-view-close-btn"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="space-y-5">
            {/* Header / Meta */}
            <div>
              <span className="text-[9px] font-mono text-clay-605 tracking-widest uppercase font-bold block mb-1">
                Atelier Quick View
              </span>
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
                  <span>No reviews yet</span>
                  <button
                    onClick={() => setActiveTab('reviews')}
                    className="text-clay-605 hover:text-clay-700 underline font-medium cursor-pointer"
                  >
                    Write a review
                  </button>
                </div>
              )}
            </div>

            {/* Pattern Core Description */}
            <p className="text-xs text-bark-650 leading-relaxed font-sans">
              {pattern.description}
            </p>

            {/* Sizes Indicator */}
            <div className="flex items-center gap-6 py-2 border-t border-b border-sand-200/50 text-xs font-sans text-bark-750">
              <div>
                <span className="text-bark-400 block text-[9px] uppercase tracking-wider font-semibold mb-0.5">SIZE RANGE</span>
                <span className="font-mono font-bold text-bark-900">0 – 22 (US Sizes)</span>
              </div>
              <div>
                <span className="text-bark-400 block text-[9px] uppercase tracking-wider font-semibold mb-0.5">difficulty dot matrix</span>
                <div className="flex gap-[1.5px] items-center mt-1">
                  {[1, 2, 3, 4, 5].map((i) => {
                    const activeDots = pattern.difficulty === 'Beginner' ? 1 : pattern.difficulty === 'Intermediate' ? 3 : 5;
                    return (
                      <span
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full border border-bark-900 ${
                          i <= activeDots ? 'bg-[#ba6446]' : 'bg-transparent'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Interactive Fabric Texture Lab */}
            <div className="bg-white border border-sand-200/80 rounded-[4px] p-3.5 space-y-3.5 shadow-3xs" id="fabric-texture-customizer">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-bark-400 uppercase tracking-widest font-bold block flex items-center gap-1">
                  <Paintbrush className="w-3 h-3 text-[#ba6446]" />
                  Interactive Fabric Lab
                </span>
                <span className="text-[9px] font-mono font-bold text-clay-700 bg-clay-50 border border-clay-100 px-1.5 py-0.5 rounded">
                  Beta Visualizer
                </span>
              </div>

              {/* Fabric Selection Dropdown */}
              <div className="space-y-1.5" id="fabric-dropdown-wrapper">
                <label htmlFor="fabric-select" className="text-[10px] text-bark-600 font-semibold font-mono uppercase tracking-wider block">
                  Select Fabric Texture:
                </label>
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
                <span className="text-[10px] text-bark-500 font-semibold font-mono uppercase tracking-wider block">
                  Or select swatch directly:
                </span>
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

            {/* Options Selection Grid (Format & Sizing) */}
            <div className="grid grid-cols-2 gap-4">
              {/* Format selection */}
              <div>
                <span className="text-[9px] text-bark-400 uppercase tracking-widest font-bold block mb-1.5">
                  Pattern Format
                </span>
                <div className="grid grid-cols-2 gap-1 bg-white border border-sand-200/80 rounded-[4px] p-0.5 shadow-3xs">
                  <button
                    onClick={() => setFormat('PDF')}
                    className={`text-[9px] py-1.5 px-1 rounded-[3px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                      format === 'PDF'
                        ? 'bg-bark-900 text-sand-50 shadow-3xs'
                        : 'text-bark-500 hover:text-bark-800 hover:bg-sand-50/50'
                    }`}
                  >
                    PDF (${pattern.pricePDF.toFixed(0)})
                  </button>
                  <button
                    onClick={() => setFormat('Printed')}
                    className={`text-[9px] py-1.5 px-1 rounded-[3px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                      format === 'Printed'
                        ? 'bg-bark-900 text-sand-50 shadow-3xs'
                        : 'text-bark-500 hover:text-bark-800 hover:bg-sand-50/50'
                    }`}
                  >
                    Printed (${pattern.pricePrinted.toFixed(0)})
                  </button>
                </div>
              </div>

              {/* Size choice */}
              <div>
                <label className="text-[9px] text-bark-400 uppercase tracking-widest font-bold block mb-1.5" htmlFor="quick-view-size-picker">
                  Choose Target Size
                </label>
                <select
                  id="quick-view-size-picker"
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className="w-full bg-white border border-sand-200/80 rounded-[4px] px-2 py-1.5 text-xs font-semibold text-bark-850 focus:outline-none focus:ring-1 focus:ring-clay-500 focus:border-clay-500 cursor-pointer shadow-3xs"
                >
                  {pattern.sizes.map((sz) => (
                    <option key={sz} value={sz}>
                      Size {sz} {sz === activeRecommendedSize ? '(Recommended)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>            {/* Quick specifications tab navigation */}
            <div className="space-y-2">
              <div className="flex border-b border-sand-200/70" id="quick-view-tab-bar">
                <button
                  onClick={() => setActiveTab('features')}
                  className={`py-1 px-2.5 text-[10.5px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                    activeTab === 'features'
                      ? 'border-clay-605 text-clay-705 font-black'
                      : 'border-transparent text-bark-450 hover:text-bark-800'
                  }`}
                  type="button"
                >
                  Key Features
                </button>
                <button
                  onClick={() => setActiveTab('fabrics')}
                  className={`py-1 px-2.5 text-[10.5px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                    activeTab === 'fabrics'
                      ? 'border-clay-605 text-clay-705 font-black'
                      : 'border-transparent text-bark-450 hover:text-bark-800'
                  }`}
                  type="button"
                >
                  Favored Fabrics
                </button>
                <button
                  onClick={() => setActiveTab('notions')}
                  className={`py-1 px-2.5 text-[10.5px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                    activeTab === 'notions'
                      ? 'border-clay-605 text-clay-705 font-black'
                      : 'border-transparent text-bark-450 hover:text-bark-800'
                  }`}
                  type="button"
                >
                  Notions &amp; Yardage
                </button>
                <button
                  onClick={() => setActiveTab('tips')}
                  className={`py-1 px-2.5 text-[10.5px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1 ${
                    activeTab === 'tips'
                      ? 'border-clay-605 text-clay-705 font-black'
                      : 'border-transparent text-bark-450 hover:text-bark-800'
                  }`}
                  type="button"
                >
                  <Video className="w-3 h-3 text-clay-550 shrink-0" />
                  <span>Sewing Tips</span>
                </button>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className={`py-1 px-2.5 text-[10.5px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1 ${
                    activeTab === 'reviews'
                      ? 'border-clay-605 text-clay-705 font-black'
                      : 'border-transparent text-bark-450 hover:text-bark-800'
                  }`}
                  type="button"
                >
                  <span>Reviews</span>
                  {ratingStats && (
                    <span className="bg-[#ba6446]/10 text-[#ba6446] px-1 rounded-sm text-[8.5px] font-bold">
                      {ratingStats.count}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Panels */}
              <div className="bg-white border border-sand-200/60 rounded-[4px] p-3 shadow-3xs text-[10.5px] leading-relaxed text-bark-700 min-h-[110px]" id="quick-view-tab-panel">
                {activeTab === 'features' && (
                  <ul className="space-y-1 ml-1">
                    {pattern.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-clay-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {activeTab === 'fabrics' && (
                  <div className="space-y-2">
                    <p className="text-bark-550 font-medium text-[9.5px] uppercase tracking-wider">Recommended textiles for optimum drapery &amp; fit:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pattern.fabricSuggestions.map((fab, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-sand-100 border border-sand-200/60 text-bark-800 rounded font-medium shadow-3xs">
                          {fab}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === 'notions' && (
                  <div className="space-y-2.5">
                    <div>
                      <span className="font-bold uppercase text-[8.5px] text-bark-450 tracking-wider block mb-0.5">Required Materials Checklist:</span>
                      <p className="text-bark-600">{pattern.notions.join(', ')}</p>
                    </div>
                    <div className="border-t border-sand-150 pt-2 grid grid-cols-2 gap-2">
                      <div>
                        <span className="font-bold text-[8px] text-bark-450 uppercase tracking-wider block">44" Width Yardage</span>
                        <p className="text-bark-800 font-mono font-medium">{pattern.yardageInfo.width44}</p>
                      </div>
                      <div>
                        <span className="font-bold text-[8px] text-bark-450 uppercase tracking-wider block">60" Width Yardage</span>
                        <p className="text-bark-800 font-mono font-medium">{pattern.yardageInfo.width60}</p>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'tips' && (
                  <div className="space-y-4" id="quick-view-sewing-tips-tab">
                    {/* Masterclass Host Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#FAF8F5] border border-sand-200/60 p-2.5 rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-clay-100 flex items-center justify-center text-clay-705 font-bold border border-clay-200 text-[10px]">
                          {pattern.tutorial?.instructor?.split(' ').map(n => n[0]).join('') || 'AT'}
                        </div>
                        <div className="leading-tight">
                          <span className="font-bold text-bark-900 block text-[10.5px]">Video Masterclass Room</span>
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
                      <span className="font-bold uppercase text-[8.5px] text-bark-450 tracking-wider block">Interactive Sewing Instruction Studio:</span>
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
                              <span className="font-bold text-bark-850 block text-[10px]">1. Pressing vs Ironing Secrets</span>
                              <p className="text-[9.5px] text-bark-550 mt-0.5 leading-normal">
                                Crucial for clean necklines. Don't slide the iron back and forth; press down firmly on seams and lift to avoid stretching curved bias garment edges.
                              </p>
                              <a
                                href="https://www.youtube.com/results?search_query=how+to+press+seams+sewing"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-[#ba6446] hover:text-clay-800 font-bold underline uppercase mt-1.5 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>Watch Technique Video</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>

                            <div className="p-2.5 bg-sand-50/40 border border-sand-200/60 rounded">
                              <span className="font-bold text-bark-850 block text-[10px]">2. Accurate Staystitching</span>
                              <p className="text-[9.5px] text-bark-550 mt-0.5 leading-normal">
                                Staystitch necklines immediately at 1/8" within the seam allowances before pin-basting to prevent delicate fabric bias lines from distortion.
                              </p>
                              <a
                                href="https://www.youtube.com/results?search_query=how+to+staystitch+neckline"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-[#ba6446] hover:text-clay-800 font-bold underline uppercase mt-1.5 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>Watch Technique Video</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </>
                        )}

                        {pattern.difficulty === 'Intermediate' && (
                          <>
                            <div className="p-2.5 bg-sand-50/40 border border-sand-200/60 rounded">
                              <span className="font-bold text-bark-850 block text-[10px]">1. French Seaming Techniques</span>
                              <p className="text-[9.5px] text-bark-550 mt-0.5 leading-normal">
                                Perfect for raw-edge protection. Stitch wrong sides together at 1/4", trim close, press flat, then stitch right sides together to trap raw fringe inside.
                              </p>
                              <a
                                href="https://www.youtube.com/results?search_query=how+to+sew+french+seams"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-[#ba6446] hover:text-clay-800 font-bold underline uppercase mt-1.5 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>Watch Technique Video</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>

                            <div className="p-2.5 bg-sand-50/40 border border-sand-200/60 rounded">
                              <span className="font-bold text-bark-850 block text-[10px]">2. Flawless Front J-Flys</span>
                              <p className="text-[9.5px] text-bark-550 mt-0.5 leading-normal">
                                Standard zip assembly requires precise basting. Mark sewing guides clearly and baste secure hook loops inside face bands before turning raw seams.
                              </p>
                              <a
                                href="https://www.youtube.com/results?search_query=how+to+sew+pants+fly+zipper"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-[#ba6446] hover:text-clay-800 font-bold underline uppercase mt-1.5 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>Watch Technique Video</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </>
                        )}

                        {pattern.difficulty === 'Advanced' && (
                          <>
                            <div className="p-2.5 bg-sand-50/40 border border-sand-200/60 rounded">
                              <span className="font-bold text-bark-850 block text-[10px]">1. The Tailor's Clapper Secrets</span>
                              <p className="text-[9.5px] text-bark-550 mt-0.5 leading-normal">
                                For thick materials like wool gabardine. Steam seams heavily, then apply the hardwood clapper with downward pressure. Traps heat for razor-sharp collar folds.
                              </p>
                              <a
                                href="https://www.youtube.com/results?search_query=how+to+use+tailor+wooden+clapper"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-[#ba6446] hover:text-clay-800 font-bold underline uppercase mt-1.5 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>Watch Technique Video</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>

                            <div className="p-2.5 bg-sand-50/40 border border-sand-200/60 rounded">
                              <span className="font-bold text-bark-850 block text-[10px]">2. Flawless Pocket Double-Welts</span>
                              <p className="text-[9.5px] text-bark-550 mt-0.5 leading-normal">
                                Key to outerwear tailoring. Slash corner triangles accurately right to the stitch line. Over-slashing creates outer holes; under-slashing makes bulky puckers.
                              </p>
                              <a
                                href="https://www.youtube.com/results?search_query=how+to+sew+welt+pockets"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-[#ba6446] hover:text-clay-800 font-bold underline uppercase mt-1.5 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>Watch Technique Video</span>
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
                        <span>Atelier Masterclass Tips:</span>
                      </span>
                      <ul className="space-y-1 text-bark-650 list-disc pl-3">
                        {pattern.tutorial?.tips?.map((tip, idx) => (
                          <li key={idx} className="leading-normal">{tip}</li>
                        )) || (
                          <>
                            <li className="leading-normal">Always perform a test stitch on a scrap piece of your fabric to calibrate machine tension.</li>
                            <li className="leading-normal">Press every seam flat and then open immediately after sewing for an impeccable drape.</li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
                {activeTab === 'reviews' && (
                  <div className="max-h-[350px] overflow-y-auto pr-1" id="quick-view-reviews-wrapper">
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
                <span>Share Pattern Blueprint</span>
              </span>
              <span className="text-[9px] text-bark-450 italic font-serif">Inspire the sewing community</span>
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
                title="Share on Twitter / X"
                id="share-twitter-btn"
                type="button"
              >
                <Twitter className="w-3.5 h-3.5" />
                <span className="text-[8.5px] font-mono font-bold mt-1 uppercase tracking-tighter">X / Tweet</span>
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
                title="Pin on Pinterest"
                id="share-pinterest-btn"
                type="button"
              >
                <PinterestIcon className="w-3.5 h-3.5" />
                <span className="text-[8.5px] font-mono font-bold mt-1 uppercase tracking-tighter">Pinterest</span>
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
                title="Share on Facebook"
                id="share-facebook-btn"
                type="button"
              >
                <Facebook className="w-3.5 h-3.5" />
                <span className="text-[8.5px] font-mono font-bold mt-1 uppercase tracking-tighter">Facebook</span>
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
                title="Share on Instagram"
                id="share-instagram-btn"
                type="button"
              >
                <Instagram className="w-3.5 h-3.5" />
                <span className="text-[8.5px] font-mono font-bold mt-1 uppercase tracking-tighter">Instagram</span>
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
                title="Copy Pattern Link"
                id="share-copylink-btn"
                type="button"
              >
                <Link className="w-3.5 h-3.5" />
                <span className="text-[8.5px] font-mono font-bold mt-1 uppercase tracking-tighter">Copy Link</span>
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
                    <span>Successfully Added!</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    <span>Add to Styling Ledger — ${(currentPrice).toFixed(2)}</span>
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

            {/* Explore Lab Direct Link Button */}
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
          </div>
        </div>
      </motion.div>

      {/* Interactive Lightbox for fabric texture/sewing inspection */}
      <AnimatePresence>
        {isLightboxOpen && (
          <div className="fixed inset-0 z-200 flex items-center justify-center p-4 md:p-8 bg-bark-950/98 backdrop-blur-sm" id="texture-zoom-lightbox">
            {/* Backdrop Dismiss */}
            <div className="absolute inset-0 cursor-zoom-out" onClick={() => setIsLightboxOpen(false)} />

            {/* Lightbox Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-bark-900 border border-bark-800 rounded-lg max-w-5xl w-full flex flex-col md:flex-row shadow-2xl overflow-hidden z-210 max-h-[90vh]"
            >
              {/* Left Column: Interactive Zoom Canvas */}
              <div className="relative md:w-8/12 h-[50vh] md:h-[70vh] bg-bark-950 overflow-hidden flex items-center justify-center cursor-move" id="lightbox-image-viewport">

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

                {/* Corner Quick Actions & Instructions */}
                <div className="absolute bottom-4 left-4 bg-bark-950/80 backdrop-blur-xs border border-bark-800 px-3 py-1.5 rounded text-[10px] text-sand-300 font-mono flex items-center gap-2">
                  <Move className="w-3.5 h-3.5 text-clay-400" />
                  <span>Drag or swipe to pan details closely</span>
                </div>

                <div className="absolute top-4 left-4 bg-bark-950/85 backdrop-blur-xs border border-bark-800 px-2.5 py-1.5 rounded text-[10px] text-clay-400 font-bold font-mono tracking-wider">
                  Couture Inspection Loupe: {Math.round(lightboxZoom * 100)}%
                </div>
              </div>

              {/* Right Column: Zoom Controls & Sewing Specs */}
              <div className="md:w-4/12 p-6 flex flex-col justify-between bg-bark-900 border-t md:border-t-0 md:border-l border-bark-800 text-sand-50 overflow-y-auto max-h-[35vh] md:max-h-[70vh]">

                <div className="space-y-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-mono text-clay-400 tracking-widest uppercase font-bold block mb-1">
                        Sewing Detail Board
                      </span>
                      <h4 className="text-lg font-serif font-medium text-white">{pattern.name}</h4>
                    </div>

                    {/* Close Lightbox */}
                    <button
                      onClick={() => setIsLightboxOpen(false)}
                      className="p-1.5 rounded-full border border-bark-800 hover:border-bark-700 hover:bg-bark-800 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4 text-sand-300" />
                    </button>
                  </div>

                  {/* Interactive Controls Panel */}
                  <div className="bg-bark-950 border border-bark-800 p-4 rounded-md space-y-4">
                    <span className="text-[10px] font-mono text-bark-400 uppercase tracking-wider block">
                      Magnification Engine
                    </span>

                    {/* Scale Input Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] text-sand-300">
                        <span>Zoom Level</span>
                        <span className="font-mono">{Math.round(lightboxZoom * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="0.1"
                        value={lightboxZoom}
                        onChange={(e) => {
                          setLightboxZoom(parseFloat(e.target.value));
                          // Reset pan if zoom is set to 1 to avoid weird clipping
                          if (parseFloat(e.target.value) === 1) {
                            setPanOffset({ x: 0, y: 0 });
                          }
                        }}
                        className="w-full h-1 bg-bark-800 rounded-lg appearance-none cursor-pointer accent-clay-550"
                      />
                    </div>

                    {/* Quick zoom buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleAdjustZoom(-0.5)}
                        disabled={lightboxZoom <= 1}
                        className="px-2 py-1.5 border border-bark-800 hover:border-bark-700 rounded text-[10px] font-mono text-center cursor-pointer transition-colors hover:bg-bark-800/40 disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <ZoomOut className="w-3.5 h-3.5 mx-auto mb-1" /> -50%
                      </button>
                      <button
                        onClick={() => handleAdjustZoom(0.5)}
                        disabled={lightboxZoom >= 4}
                        className="px-2 py-1.5 border border-bark-800 hover:border-bark-700 rounded text-[10px] font-mono text-center cursor-pointer transition-colors hover:bg-bark-800/40 disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <ZoomIn className="w-3.5 h-3.5 mx-auto mb-1" /> +50%
                      </button>
                      <button
                        onClick={() => {
                          setLightboxZoom(1.5);
                          setPanOffset({ x: 0, y: 0 });
                        }}
                        className="px-2 py-1.5 border border-bark-800 hover:border-bark-700 rounded text-[10px] font-mono text-center cursor-pointer transition-colors hover:bg-bark-800/40"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Sewing / Texture Specifications */}
                  <div className="space-y-3 pt-2">
                    <h5 className="text-[11px] font-mono font-bold text-clay-400 uppercase tracking-wider">
                      Couture Texture Guidelines
                    </h5>

                    <div className="space-y-2.5 text-xs text-sand-300 font-sans">
                      <div className="border-l-2 border-clay-550 pl-3 py-0.5">
                        <strong className="block text-[10px] uppercase font-mono text-white mb-0.5">Weave Detail Inspection:</strong>
                        <p className="leading-relaxed text-sand-300">
                          Verify seam layouts against structured textures. Check draping line flows, tension lines, and grainline indicators.
                        </p>
                      </div>

                      <div className="border-l-2 border-bark-700 pl-3 py-0.5">
                        <strong className="block text-[10px] uppercase font-mono text-white mb-0.5">Recommended Needles:</strong>
                        <p className="leading-relaxed text-sand-300">
                          For {pattern.fabricSuggestions[0] || "linens/wool"}, we advise using size 80/12 universal or microtex sewing needles with high-twist thread.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-bark-800 flex items-center justify-between text-[10px] text-bark-400 font-mono">
                  <span>Atelier Design Lab</span>
                  <span>v2026.1</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
