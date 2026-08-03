/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Star, HelpCircle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, X, Camera, Compass, Scissors, Sparkles, Heart, Play, Clock, Video, RotateCcw, PlayCircle, PauseCircle, Check, BookOpen, Sliders, Cpu, RefreshCw, Paintbrush, Eye, Layers, Search } from 'lucide-react';
import CustomerGalleryAndReviews from './CustomerGalleryAndReviews';

// Render custom SVGs representing the front and back technical flats of the garments
const renderTechnicalFlats = (id) => {
  switch (id) {
    case 'sartorial-01': // Aurelia Wrap Dress
      return (
        <svg viewBox="0 0 80 140" className="w-full h-full text-bark-700 stroke-current fill-none" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          {/* Front View */}
          <g transform="translate(0, 5)">
            <path d="M 28,10 Q 34,9 40,10" />
            <path d="M 28,10 L 15,18 L 20,25 L 28,21 L 30,38 L 40,38 L 42,21 L 50,25 L 55,18 L 42,10" />
            <path d="M 28,10 L 40,38" />
            <path d="M 42,10 L 32,32" />
            <circle cx="40" cy="38" r="1.5" className="fill-current" />
            <path d="M 40,38 Q 45,35 48,39 Q 42,42 40,38" />
            <path d="M 40,38 Q 35,42 38,45" />
            <path d="M 30,38 L 18,90 L 52,90 L 40,38" />
            <path d="M 18,90 Q 35,93 52,90" />
            <path d="M 33,38 Q 31,65 28,90" strokeDasharray="1 1" strokeWidth="0.7" />
            <path d="M 37,38 Q 39,65 42,90" strokeDasharray="1 1" strokeWidth="0.7" />
          </g>
          {/* Back View */}
          <g transform="translate(0, 75)">
            <path d="M 28,10 Q 35,12 42,10" />
            <path d="M 28,10 L 15,18 L 20,25 L 28,21 L 30,38 L 40,38 L 42,21 L 50,25 L 55,18 L 42,10" />
            <path d="M 35,11 L 35,38" strokeDasharray="1 1" strokeWidth="0.7" />
            <path d="M 30,38 L 40,38" strokeWidth="1.5" />
            <path d="M 30,38 L 18,90 L 52,90 L 40,38" />
            <path d="M 18,90 Q 35,93 52,90" />
            <path d="M 35,38 L 35,91" strokeDasharray="1 1" strokeWidth="0.7" />
          </g>
        </svg>
      );
    case 'sartorial-02': // Atelier Utility Trench
      return (
        <svg viewBox="0 0 80 140" className="w-full h-full text-bark-700 stroke-current fill-none" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          {/* Front View */}
          <g transform="translate(0, 5)">
            <path d="M 26,12 L 32,5 L 38,12" />
            <path d="M 26,12 L 15,18 L 18,48 L 24,46 L 25,36 L 25,85 L 45,85 L 45,36 L 46,46 L 52,48 L 41,12" />
            <path d="M 26,12 L 22,22 L 30,22" />
            <path d="M 38,12 L 42,22 L 34,22" />
            <circle cx="28" cy="28" r="1" className="fill-current" />
            <circle cx="34" cy="28" r="1" className="fill-current" />
            <circle cx="28" cy="36" r="1" className="fill-current" />
            <circle cx="34" cy="36" r="1" className="fill-current" />
            <circle cx="28" cy="44" r="1" className="fill-current" />
            <circle cx="34" cy="44" r="1" className="fill-current" />
            <rect x="25" y="48" width="12" height="3.5" />
            <line x1="28" y1="50" x2="34" y2="50" strokeWidth="1.2" />
            <path d="M 23,60 L 27,60 L 27,66 L 23,66 Z" />
            <path d="M 35,60 L 39,60 L 39,66 L 35,66 Z" />
            <line x1="31" y1="22" x2="31" y2="85" />
          </g>
          {/* Back View */}
          <g transform="translate(0, 75)">
            <path d="M 26,12 Q 31,14 36,12" />
            <path d="M 26,12 L 15,18 L 18,48 L 24,46 L 25,36 L 25,85 L 45,85 L 45,36 L 46,46 L 52,48 L 36,12" />
            <path d="M 26,16 L 22,28 L 31,31 L 40,28 L 36,16 Z" />
            <line x1="31" y1="31" x2="31" y2="85" />
            <rect x="25" y="48" width="12" height="3.5" />
          </g>
        </svg>
      );
    case 'sartorial-03': // Palazzo Wide-Leg Trouser
      return (
        <svg viewBox="0 0 80 140" className="w-full h-full text-bark-700 stroke-current fill-none" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          {/* Front View */}
          <g transform="translate(0, 5)">
            <path d="M 24,12 L 44,12 L 44,18 L 24,18 Z" />
            <path d="M 34,18 L 34,32 Q 34,35 32,35" strokeDasharray="1 1" strokeWidth="0.8" />
            <path d="M 24,18 L 14,85 L 31,85 L 34,35 L 37,85 L 54,85 L 44,18" />
            <path d="M 24,18 L 20,28" />
            <path d="M 44,18 L 48,28" />
            <line x1="28" y1="18" x2="26" y2="45" strokeDasharray="1 1" strokeWidth="0.7" />
            <line x1="40" y1="18" x2="42" y2="45" strokeDasharray="1 1" strokeWidth="0.7" />
          </g>
          {/* Back View */}
          <g transform="translate(0, 75)">
            <path d="M 24,12 L 44,12 L 44,18 L 24,18 Z" />
            <path d="M 24,18 L 14,85 L 31,85 L 34,35 L 37,85 L 54,85 L 44,18" />
            <line x1="34" y1="18" x2="34" y2="35" />
            <line x1="29" y1="18" x2="29" y2="24" />
            <line x1="39" y1="18" x2="39" y2="24" />
            <line x1="26" y1="26" x2="31" y2="26" strokeWidth="1.2" />
            <line x1="37" y1="26" x2="42" y2="26" strokeWidth="1.2" />
          </g>
        </svg>
      );
    case 'sartorial-04': // Luminary Asymmetric Drape Blouse
      return (
        <svg viewBox="0 0 80 140" className="w-full h-full text-bark-700 stroke-current fill-none" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          {/* Front View */}
          <g transform="translate(0, 5)">
            <path d="M 25,12 C 28,18 42,20 45,12" />
            <path d="M 25,12 C 22,22 18,35 18,65 L 50,65 C 50,45 48,22 45,12" />
            <path d="M 25,15 C 30,22 40,25 43,18" strokeWidth="0.8" />
            <path d="M 24,24 C 28,32 38,34 46,26" strokeWidth="0.8" />
            <path d="M 22,35 C 28,42 36,44 48,36" strokeWidth="0.8" />
            <path d="M 18,65 Q 34,68 50,65" />
          </g>
          {/* Back View */}
          <g transform="translate(0, 75)">
            <path d="M 25,12 C 30,15 40,15 45,12" />
            <path d="M 25,12 C 22,22 18,35 18,65 L 50,65 C 50,45 48,22 45,12" />
            <line x1="35" y1="14" x2="35" y2="65" strokeDasharray="1 1" strokeWidth="0.7" />
            <path d="M 18,65 Q 34,68 50,65" />
          </g>
        </svg>
      );
    default:
      return null;
  }
};

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

const FABRIC_DESCRIPTIONS = {
  'Linen': 'Classic flax fiber woven with organic slub textures. Exceptional breathability with a beautifully relaxed, structural drape and organic wrinkles.',
  'Silk Satin': 'Luxurious filament silk weave featuring a high-luster finish. Offers an elegant, liquid-like drape, lightweight airiness, and a supreme hand feel.',
  'Wool Crepe': 'Pebbled texture woven from premium spun wool. Features high elasticity, bounce, excellent shape recovery, and crisp tailoring memory.',
  'Cotton': 'Crisp, matte-finish combed cotton. High breathability and everyday durability with structural softness perfect for precise stitching.',
  'Linen Blend': 'A curated blend matching the crisp slub appearance of flax with performance yarns for enhanced drape stability and wrinkle-resistance.',
  'Silk': 'Luxurious filament silk weave featuring a high-luster finish. Offers an elegant, liquid-like drape, lightweight airiness, and a supreme hand feel.',
  'Wool': 'Dense, structured weave with rich natural loft, excellent warmth, and crisp tailoring memory.',
  'Denim': 'Rugged twill weave with high structural durability and rich indigo depth.',
  'Tencel': 'Eco-friendly filament with peach-skin softness and high luster.',
  'Chambray': 'Plain-weave variation offering lightweight breathability and contrast warp.',
  'Crepe': 'Pebbled texture with high drape recovery, soft matte finish, and bouncy tailoring body.',
  'Satin': 'High-luster plain weave with liquid-like drape and smooth face.',
  'Gabardine': 'Steep twill structure providing superb shape definition, high wear resistance, and clean lines.',
  'Boiled Wool': 'Felted texture with rich body, warmth, and raw edge stability.'
};

const COLORWAY_NAMES = {
  'Oatmeal': 'Alabaster Oatmeal (13-0002 TCX)',
  'Burgundy': 'Bordeaux Burgundy (19-1650 TCX)',
  'Forest': 'Veridian Forest Green (19-5414 TCX)',
  'Slate': 'Steel Slate Gray (18-4005 TCX)',
  'Rose': 'Rosewood Pink (18-1630 TCX)',
  'Prussian': 'Prussian Navy Blue (19-4024 TCX)',
  'Charcoal': 'Charcoal Black (19-3906 TCX)'
};

export default function PatternCard({
  pattern: rawPattern,
  onAddToCart,
  activeRecommendedSize,
  onSelect,
  isActive,
  reviews = [],
  onAddReview,
  isFavorite = false,
  onToggleFavorite = () => {},
  onExploreSwatches = () => {},
  onQuickView = () => {},
  viewMode = 'showcase'
}) {
  const pattern = React.useMemo(() => {
    const p = rawPattern || {};
    const pricePDF = p.pricePDF !== undefined ? p.pricePDF : (p.price !== undefined ? p.price : 14.00);
    const pricePrinted = p.pricePrinted !== undefined ? p.pricePrinted : (p.price !== undefined ? p.price : (pricePDF + 8));
    return {
      ...p,
      id: p.id || 'unknown',
      name: p.name || 'Perfect Fit Garment',
      category: p.category || 'Dress',
      difficulty: p.difficulty || 'Intermediate',
      pricePDF: pricePDF,
      pricePrinted: pricePrinted,
      fabricSuggestions: Array.isArray(p.fabricSuggestions)
        ? p.fabricSuggestions
        : (p.fabric ? [p.fabric] : ['Linen', 'Silk', 'Wool']),
      yardageInfo: p.yardageInfo || { width60: p.yardage60 || '2.5 yards', width45: p.yardage45 || '3.2 yards' },
      tagline: p.tagline || 'Exquisite tailoring pattern',
      description: p.description || 'A timeless addition to any handmade wardrobe.'
    };
  }, [rawPattern]);

  const patternReviews = React.useMemo(() => {
    if (Array.isArray(reviews)) return reviews;
    if (reviews && typeof reviews === 'object' && pattern.id) {
      return reviews[pattern.id] || [];
    }
    return [];
  }, [reviews, pattern.id]);

  const [format, setFormat] = useState('PDF');
  const [selectedSize, setSelectedSize] = useState(activeRecommendedSize || '8');
  const [showSpecs, setShowSpecs] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [particles, setParticles] = useState([]);
  const [showGalleryDrawer, setShowGalleryDrawer] = useState(false);

  // Fabric Swatch & Technical Details States
  const [isSwatchModalOpen, setIsSwatchModalOpen] = useState(false);
  const [selectedFabric, setSelectedFabric] = useState(pattern.fabricSuggestions?.[0] || 'Linen');
  const [selectedColor, setSelectedColor] = useState('Oatmeal');
  const [hoveredFabric, setHoveredFabric] = useState(null);
  const [hoveredColor, setHoveredColor] = useState(null);
  const [customSwatchPrompt, setCustomSwatchPrompt] = useState('');
  const [isSynthesizingSwatch, setIsSynthesizingSwatch] = useState(false);
  const [synthesizedSwatchUrl, setSynthesizedSwatchUrl] = useState('');
  const [synthesisLogs, setSynthesisLogs] = useState([]);
  const [drawingView, setDrawingView] = useState('both'); // 'both', 'front', 'back'
  const [isMagnifying, setIsMagnifying] = useState(false);
  const [magnifierPos, setMagnifierPos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setMagnifierPos({ x, y });
  };

  // Get fabric texture category and URL mapping
  const getFabricTextureUrl = (fabricName, colorName) => {
    const norm = (fabricName || '').toLowerCase();
    let category = 'Linen';
    if (norm.includes('silk') || norm.includes('satin') || norm.includes('cupro') || norm.includes('rayon') || norm.includes('georgette') || norm.includes('challis') || norm.includes('crepe') || norm.includes('sateen') || norm.includes('velvet')) {
      category = 'Silk';
    } else if (norm.includes('wool') || norm.includes('coat') || norm.includes('gabardine') || norm.includes('corduroy') || norm.includes('heavy') || norm.includes('suiting')) {
      category = 'Wool';
    }

    const colorMap = {
      Oatmeal: {
        Linen: 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?auto=format&fit=crop&w=600&q=80',
        Silk: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80',
        Wool: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80'
      },
      Burgundy: {
        Linen: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=600&q=80',
        Silk: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=600&q=80',
        Wool: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80'
      },
      Forest: {
        Linen: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80',
        Silk: 'https://images.unsplash.com/photo-1579783922619-083471c253de?auto=format&fit=crop&w=600&q=80',
        Wool: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80'
      },
      Slate: {
        Linen: 'https://images.unsplash.com/photo-1596265309144-839a89b51ca3?auto=format&fit=crop&w=600&q=80',
        Silk: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
        Wool: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80'
      },
      Rose: {
        Linen: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=600&q=80',
        Silk: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=600&q=80',
        Wool: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80'
      },
      Prussian: {
        Linen: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
        Silk: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
        Wool: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80'
      },
      Charcoal: {
        Linen: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80',
        Silk: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80',
        Wool: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80'
      }
    };

    return colorMap[colorName]?.[category] || colorMap.Oatmeal[category];
  };

  const handleSynthesizeCustomSwatch = () => {
    if (!customSwatchPrompt.trim()) return;
    setIsSynthesizingSwatch(true);
    setSynthesisLogs([]);

    const logs = [
      `Initializing neural textile rendering engine for '${customSwatchPrompt}'...`,
      `Parsing fiber weave parameters & warp density coefficients...`,
      `Computing drape physics and structural weave noise map...`,
      `Applying light-scattering render pass (diffuse and specular micro-facets)...`,
      `Finalizing high-fidelity 4K textile render. Swatch successfully synthesized!`
    ];

    logs.forEach((log, index) => {
      setTimeout(() => {
        setSynthesisLogs(prev => [...prev, log]);
        if (index === logs.length - 1) {
          const randomUnsplashIds = [
            'photo-1579783900882-c0d3dad7b119',
            'photo-1596265309144-839a89b51ca3',
            'photo-1528459801416-a9e53bbf4e17',
            'photo-1618005182384-a83a8bd57fbe',
            'photo-1544816155-12df9643f363',
            'photo-1603252109303-2751441dd157',
            'photo-1513519245088-0e12902e5a38'
          ];
          const chosenId = randomUnsplashIds[Math.floor(Math.random() * randomUnsplashIds.length)];
          setSynthesizedSwatchUrl(`https://images.unsplash.com/${chosenId}?auto=format&fit=crop&w=600&q=80`);
          setIsSynthesizingSwatch(false);
        }
      }, (index + 1) * 500);
    });
  };

  const renderDynamicTechnicalFlats = (id, category, viewMode) => {
    let targetId = id;
    if (!['sartorial-01', 'sartorial-02', 'sartorial-03', 'sartorial-04'].includes(id)) {
      const cat = (category || '').toLowerCase();
      if (cat.includes('dress')) targetId = 'sartorial-01';
      else if (cat.includes('outer') || cat.includes('jacket') || cat.includes('coat') || cat.includes('trench')) targetId = 'sartorial-02';
      else if (cat.includes('trouser') || cat.includes('pant') || cat.includes('skirt') || cat.includes('bottom')) targetId = 'sartorial-03';
      else if (cat.includes('top') || cat.includes('blouse') || cat.includes('shirt')) targetId = 'sartorial-04';
      else targetId = 'sartorial-01';
    }

    let viewBox = "0 0 80 140";
    if (viewMode === 'front') {
      viewBox = "0 5 80 65";
    } else if (viewMode === 'back') {
      viewBox = "0 73 80 65";
    }

    switch (targetId) {
      case 'sartorial-01':
        return (
          <svg viewBox={viewBox} className="w-full h-full text-bark-800 stroke-current fill-none transition-all duration-300" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            {(viewMode === 'both' || viewMode === 'front') && (
              <g transform="translate(0, 5)">
                <path d="M 28,10 Q 34,9 40,10" />
                <path d="M 28,10 L 15,18 L 20,25 L 28,21 L 30,38 L 40,38 L 42,21 L 50,25 L 55,18 L 42,10" />
                <path d="M 28,10 L 40,38" />
                <path d="M 42,10 L 32,32" />
                <circle cx="40" cy="38" r="1.5" className="fill-current" />
                <path d="M 40,38 Q 45,35 48,39 Q 42,42 40,38" />
                <path d="M 40,38 Q 35,42 38,45" />
                <path d="M 30,38 L 18,90 L 52,90 L 40,38" />
                <path d="M 18,90 Q 35,93 52,90" />
                <path d="M 33,38 Q 31,65 28,90" strokeDasharray="1 1" strokeWidth="0.7" />
                <path d="M 37,38 Q 39,65 42,90" strokeDasharray="1 1" strokeWidth="0.7" />
              </g>
            )}
            {(viewMode === 'both' || viewMode === 'back') && (
              <g transform={viewMode === 'back' ? "translate(0, 5)" : "translate(0, 75)"}>
                <path d="M 28,10 Q 35,12 42,10" />
                <path d="M 28,10 L 15,18 L 20,25 L 28,21 L 30,38 L 40,38 L 42,21 L 50,25 L 55,18 L 42,10" />
                <path d="M 35,11 L 35,38" strokeDasharray="1 1" strokeWidth="0.7" />
                <path d="M 30,38 L 40,38" strokeWidth="1.5" />
                <path d="M 30,38 L 18,90 L 52,90 L 40,38" />
                <path d="M 18,90 Q 35,93 52,90" />
                <path d="M 35,38 L 35,91" strokeDasharray="1 1" strokeWidth="0.7" />
              </g>
            )}
          </svg>
        );
      case 'sartorial-02':
        return (
          <svg viewBox={viewBox} className="w-full h-full text-bark-800 stroke-current fill-none transition-all duration-300" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            {(viewMode === 'both' || viewMode === 'front') && (
              <g transform="translate(0, 5)">
                <path d="M 26,12 L 32,5 L 38,12" />
                <path d="M 26,12 L 15,18 L 18,48 L 24,46 L 25,36 L 25,85 L 45,85 L 45,36 L 46,46 L 52,48 L 41,12" />
                <path d="M 26,12 L 22,22 L 30,22" />
                <path d="M 38,12 L 42,22 L 34,22" />
                <circle cx="28" cy="28" r="1" className="fill-current" />
                <circle cx="34" cy="28" r="1" className="fill-current" />
                <circle cx="28" cy="36" r="1" className="fill-current" />
                <circle cx="34" cy="36" r="1" className="fill-current" />
                <circle cx="28" cy="44" r="1" className="fill-current" />
                <circle cx="34" cy="44" r="1" className="fill-current" />
                <rect x="25" y="48" width="12" height="3.5" />
                <line x1="28" y1="50" x2="34" y2="50" strokeWidth="1.2" />
                <path d="M 23,60 L 27,60 L 27,66 L 23,66 Z" />
                <path d="M 35,60 L 39,60 L 39,66 L 35,66 Z" />
                <line x1="31" y1="22" x2="31" y2="85" />
              </g>
            )}
            {(viewMode === 'both' || viewMode === 'back') && (
              <g transform={viewMode === 'back' ? "translate(0, 5)" : "translate(0, 75)"}>
                <path d="M 26,12 Q 31,14 36,12" />
                <path d="M 26,12 L 15,18 L 18,48 L 24,46 L 25,36 L 25,85 L 45,85 L 45,36 L 46,46 L 52,48 L 36,12" />
                <path d="M 26,16 L 22,28 L 31,31 L 40,28 L 36,16 Z" />
                <line x1="31" y1="31" x2="31" y2="85" />
                <rect x="25" y="48" width="12" height="3.5" />
              </g>
            )}
          </svg>
        );
      case 'sartorial-03':
        return (
          <svg viewBox={viewBox} className="w-full h-full text-bark-800 stroke-current fill-none transition-all duration-300" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            {(viewMode === 'both' || viewMode === 'front') && (
              <g transform="translate(0, 5)">
                <path d="M 24,12 L 44,12 L 44,18 L 24,18 Z" />
                <path d="M 34,18 L 34,32 Q 34,35 32,35" strokeDasharray="1 1" strokeWidth="0.8" />
                <path d="M 24,18 L 14,85 L 31,85 L 34,35 L 37,85 L 54,85 L 44,18" />
                <path d="M 24,18 L 20,28" />
                <path d="M 44,18 L 48,28" />
                <line x1="28" y1="18" x2="26" y2="45" strokeDasharray="1 1" strokeWidth="0.7" />
                <line x1="40" y1="18" x2="42" y2="45" strokeDasharray="1 1" strokeWidth="0.7" />
              </g>
            )}
            {(viewMode === 'both' || viewMode === 'back') && (
              <g transform={viewMode === 'back' ? "translate(0, 5)" : "translate(0, 75)"}>
                <path d="M 24,12 L 44,12 L 44,18 L 24,18 Z" />
                <path d="M 24,18 L 14,85 L 31,85 L 34,35 L 37,85 L 54,85 L 44,18" />
                <line x1="34" y1="18" x2="34" y2="35" />
                <line x1="29" y1="18" x2="29" y2="24" />
                <line x1="39" y1="18" x2="39" y2="24" />
                <line x1="26" y1="26" x2="31" y2="26" strokeWidth="1.2" />
                <line x1="37" y1="26" x2="42" y2="26" strokeWidth="1.2" />
              </g>
            )}
          </svg>
        );
      case 'sartorial-04':
        return (
          <svg viewBox={viewBox} className="w-full h-full text-bark-800 stroke-current fill-none transition-all duration-300" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            {(viewMode === 'both' || viewMode === 'front') && (
              <g transform="translate(0, 5)">
                <path d="M 25,12 C 28,18 42,20 45,12" />
                <path d="M 25,12 C 22,22 18,35 18,65 L 50,65 C 50,45 48,22 45,12" />
                <path d="M 25,15 C 30,22 40,25 43,18" strokeWidth="0.8" />
                <path d="M 24,24 C 28,32 38,34 46,26" strokeWidth="0.8" />
                <path d="M 22,35 C 28,42 36,44 48,36" strokeWidth="0.8" />
                <path d="M 18,65 Q 34,68 50,65" />
              </g>
            )}
            {(viewMode === 'both' || viewMode === 'back') && (
              <g transform={viewMode === 'back' ? "translate(0, 5)" : "translate(0, 75)"}>
                <path d="M 25,12 C 30,15 40,15 45,12" />
                <path d="M 25,12 C 22,22 18,35 18,65 L 50,65 C 50,45 48,22 45,12" />
                <line x1="35" y1="14" x2="35" y2="65" strokeDasharray="1 1" strokeWidth="0.7" />
                <path d="M 18,65 Q 34,68 50,65" />
              </g>
            )}
          </svg>
        );
      default:
        return null;
    }
  };

  const currentPrice = format === 'PDF' ? pattern.pricePDF : pattern.pricePrinted;

  const handleAddToCart = () => {
    onAddToCart(pattern, format, selectedSize);
    setJustAdded(true);

    // Spawn 8 delicate atelier-themed confetti particles
    const newParticles = Array.from({ length: 8 }).map((_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 120,
      y: (Math.random() - 0.5) * 30 - 25,
      size: Math.random() * 4.5 + 2.5,
      delay: i * 0.04
    }));
    setParticles(newParticles);

    setTimeout(() => {
      setJustAdded(false);
      setParticles([]);
    }, 2000);
  };

  // Calculate review rating statistics
  const getRatingStats = () => {
    if (patternReviews.length === 0) return null;
    const sum = patternReviews.reduce((acc, r) => acc + r.rating, 0);
    return {
      average: Math.round((sum / patternReviews.length) * 10) / 10,
      count: patternReviews.length
    };
  };

  const ratingStats = getRatingStats();

  // Map difficulty level to a number of filled dots out of 5
  const getDifficultyDotsCount = (diff) => {
    switch (diff) {
      case 'Beginner': return 1;
      case 'Intermediate': return 3;
      case 'Advanced': return 5;
      default: return 3;
    }
  };

  const dotsCount = getDifficultyDotsCount(pattern.difficulty);
  const diffInfo = getDifficultyInfo(pattern.difficulty);
  const DiffIcon = diffInfo.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className={`bg-white rounded-[4px] border transition-all duration-300 overflow-hidden flex flex-col justify-between erp-pattern-card ${
        isActive
          ? 'border-clay-500 ring-2 ring-clay-100 shadow-lg scale-[1.01]'
          : 'border-sand-200/85 shadow-xs hover:shadow-md hover:scale-[1.005]'
      }`}
      id={`pattern-card-${pattern.id}`}
      data-erp-id={pattern.id}
      data-erp-category={pattern.category}
      data-erp-difficulty={pattern.difficulty}
    >
      {/* Viki Sews Inspired Full-Width Cover Image with Overlaid Pattern Info */}
      <div
        className="relative aspect-[3/4.2] border-b border-sand-150 overflow-hidden group cursor-pointer"
        id={`cover-container-${pattern.id}`}
        onClick={onSelect}
      >
        {/* The Full-Width High-Fashion Model Photo */}
        <img
          src={pattern.image}
          alt={pattern.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
          id={`cover-img-${pattern.id}`}
        />

        {viewMode === 'showcase' ? (
          /* HIGH-QUALITY HOVER OVERLAY: Reveals difficulty, fabric, and instant actions */
          <div
            className="absolute inset-x-0 bottom-0 top-[15%] bg-stone-950/95 p-4 flex flex-col justify-between translate-y-full group-hover:translate-y-0 transition-all duration-300 ease-out z-20 text-stone-100 font-sans border-t border-white/10 backdrop-blur-md"
            onClick={(e) => {
              // Clicking the general overlay triggers the main select/modal action,
              // so we don't stop propagation here unless a child button is clicked.
            }}
          >
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-white/15 pb-2">
                <span className="text-[10px] font-mono tracking-widest text-[#ba6446] uppercase font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#ba6446] animate-pulse" /> Specs Blueprint
                </span>
                <span className="text-[9px] font-mono text-stone-400">Est. Time: {pattern.time || '8 hours'}</span>
              </div>

              <div className="space-y-2.5">
                {/* Brief description */}
                <div className="space-y-0.5">
                  <h4 className="text-xs font-serif text-white font-medium tracking-tight">
                    {pattern.name}
                  </h4>
                  <p className="text-[9.5px] text-stone-300 line-clamp-2 leading-relaxed font-sans">
                    <span className="italic text-[#e0a894]">"{pattern.tagline}"</span> — {pattern.description}
                  </p>
                </div>

                {/* Difficulty explanation */}
                <div className="space-y-1">
                  <span className="text-[9px] font-mono uppercase text-stone-300 tracking-wider flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-stone-400" /> Grade: <strong className="text-white">{pattern.difficulty}</strong>
                  </span>
                  <p className="text-[10.5px] text-stone-300 leading-relaxed font-sans line-clamp-2">
                    {pattern.difficultyDetail || `${pattern.difficulty} level sewing project. Features professional-grade couture finishing and clean structural lines.`}
                  </p>
                </div>

                {/* Fabric suggestions */}
                <div className="space-y-1">
                  <span className="text-[9px] font-mono uppercase text-stone-300 tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-stone-400" /> Favored Fabrics:
                  </span>
                  <p className="text-[10.5px] text-stone-300 leading-relaxed font-sans line-clamp-2">
                    {pattern.fabricSuggestions.join(', ')}
                  </p>
                </div>

                {/* Yardage suggestion */}
                <div className="space-y-1">
                  <span className="text-[9px] font-mono uppercase text-stone-300 tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-stone-400" /> Blueprint Requirements:
                  </span>
                  <p className="text-[10.5px] text-stone-300 leading-relaxed font-sans line-clamp-1">
                    Requires {pattern.yardageInfo.width60} (60" width) or {pattern.yardageInfo.width45} (45" width).
                  </p>
                </div>
              </div>
            </div>

            {/* Call to actions inside overlay */}
            <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Avoid triggering parent onClick (onSelect)
                  onQuickView(pattern);
                }}
                className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-[4px] text-[10px] font-mono font-bold uppercase tracking-wider text-white transition-all cursor-pointer flex items-center gap-1"
                id={`overlay-quick-view-${pattern.id}`}
                type="button"
              >
                <Eye className="w-3 h-3" /> Quick View
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickView(pattern);
                }}
                className="text-[#ba6446] font-bold text-[10px] font-mono uppercase tracking-wider flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform hover:underline cursor-pointer"
              >
                Quick View <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Hover Quick View overlay */
          <div className="absolute inset-0 bg-bark-950/20 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center z-20">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickView(pattern);
              }}
              className="bg-white/95 text-bark-900 border border-sand-200/50 hover:bg-[#ba6446] hover:text-white hover:border-[#ba6446] px-4 py-2 rounded-[4px] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
              id={`btn-quickview-overlay-${pattern.id}`}
              type="button"
            >
              <Eye className="w-4 h-4" />
              <span>Quick View</span>
            </button>
          </div>
        )}

        {/* Heart Icon for Favorites List */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering onSelect for the entire card image
            onToggleFavorite(pattern.id);
          }}
          className={`absolute top-3 right-3 z-25 p-2 rounded-full backdrop-blur-md transition-all border shadow-xs hover:scale-110 active:scale-95 cursor-pointer ${
            isFavorite
              ? 'bg-rose-50/95 border-rose-200 text-rose-500 shadow-rose-100/40'
              : 'bg-white/70 border-sand-200/40 text-bark-450 hover:text-rose-500 hover:bg-rose-50/50 hover:border-rose-100'
          }`}
          title={isFavorite ? "Remove from Saved" : "Save to Favorites"}
          id={`favorite-btn-${pattern.id}`}
          type="button"
        >
          <Heart className={`w-3.5 h-3.5 transition-transform ${isFavorite ? 'fill-current animate-pulse scale-105' : ''}`} />
        </button>

        {/* High-contrast off-white background panel on top/left of the image to ensure high text contrast and legibility - visible only in Classic Grid view */}
        {viewMode === 'grid' && (
          <div
            className="absolute inset-y-0 left-0 w-[42%] bg-[#FAF8F5]/92 backdrop-blur-xs border-r border-sand-200/30 flex flex-col justify-between p-2.5 select-none transition-colors duration-300 z-10 shadow-xs"
            id={`overlay-${pattern.id}`}
          >
            {/* Top: Branding Logo & Category Label */}
            <div>
              <div className="flex flex-col items-start leading-none" id={`viki-card-logo-${pattern.id}`}>
                <span
                  id={`viki-card-brand-${pattern.id}`}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  className="font-serif italic text-[11px] font-bold text-bark-900 tracking-tight cursor-text focus:outline-none"
                >
                  Perfect Fit
                </span>
                <span
                  id={`viki-card-subtitle-${pattern.id}`}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  className="text-[6px] font-mono tracking-[0.25em] text-bark-400 font-bold uppercase mt-0.5 cursor-text focus:outline-none"
                >
                  S E W S
                </span>
              </div>

              <div className="mt-2.5" id={`viki-card-category-block-${pattern.id}`}>
                <span
                  id={`viki-card-category-${pattern.id}`}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  className="text-[6px] font-sans font-semibold tracking-wider text-bark-500 uppercase block leading-none cursor-text focus:outline-none"
                >
                  {pattern.category.replace(/s$/, '')}
                </span>
                <h4
                  id={`viki-card-name-${pattern.id}`}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  className="text-[9px] font-sans font-black tracking-widest text-bark-900 uppercase mt-0.5 leading-tight truncate cursor-text focus:outline-none"
                >
                  {pattern.name.split(' ')[0]}
                </h4>
              </div>
            </div>

            {/* Middle: Beautiful, highly detailed custom technical flats SVG - Interactive trigger */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                onExploreSwatches(pattern.id);
              }}
              className="h-24 w-full flex flex-col items-center justify-center py-1 opacity-90 hover:opacity-100 transition-all cursor-pointer relative group/flat rounded-[4px] hover:bg-sand-50/30"
              id={`viki-card-flats-${pattern.id}`}
              title="Explore Technical Drawings & AI Fabric Swatches"
            >
              {renderDynamicTechnicalFlats(pattern.id, pattern.category, 'both')}

              {/* Subtle interactive tag on hover */}
              <div className="absolute inset-0 bg-bark-950/5 opacity-0 group-hover/flat:opacity-100 transition-opacity flex items-center justify-center rounded-[4px]">
                <span className="text-[7.5px] font-mono uppercase bg-white/95 border border-sand-200 text-bark-800 px-2 py-1 rounded-[3px] shadow-md tracking-wider font-bold flex items-center gap-1 active:scale-95">
                  <Sparkles className="w-2.5 h-2.5 text-clay-600 animate-pulse" />
                  Inspect Swatch Room
                </span>
              </div>
            </div>

            {/* Bottom: Sizes, Difficulty dots & level */}
            <div className="space-y-1.5 pt-1.5 border-t border-sand-200/50" id={`viki-card-info-footer-${pattern.id}`}>
              <div>
                <span
                  id={`viki-card-sizes-label-${pattern.id}`}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  className="text-[5.5px] font-sans font-semibold tracking-wider text-bark-500 uppercase block leading-none cursor-text focus:outline-none"
                >
                  SIZES
                </span>
                <span
                  id={`viki-card-sizes-range-${pattern.id}`}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  className="text-[7px] font-mono font-medium text-bark-800 leading-none cursor-text focus:outline-none"
                >
                  0 - 22
                </span>
              </div>

              <div className="space-y-0.5">
                <span
                  id={`viki-card-difficulty-label-${pattern.id}`}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  className="text-[5.5px] font-sans font-semibold tracking-wider text-bark-500 uppercase block leading-none cursor-text focus:outline-none"
                >
                  DIFFICULTY
                </span>
                <div className="flex gap-[1px] items-center" id={`viki-card-difficulty-dots-${pattern.id}`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className={`w-[4.5px] h-[4.5px] rounded-full border border-bark-900 ${
                        i <= dotsCount ? 'bg-[#ba6446]' : 'bg-transparent'
                      }`}
                    />
                  ))}
                </div>
                <span
                  id={`viki-card-difficulty-level-${pattern.id}`}
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  className="text-[6px] font-sans font-bold tracking-wider text-bark-700 uppercase block leading-none cursor-text focus:outline-none"
                >
                  {pattern.difficulty}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Subtle bottom-right tag */}
        <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-xs px-1.5 py-0.5 rounded-[4px] border border-sand-150 flex items-center justify-between shadow-3xs z-10" id={`pdf-banner-${pattern.id}`}>
          <span
            id={`viki-card-blueprint-tag-${pattern.id}`}
            contentEditable={true}
            suppressContentEditableWarning={true}
            className="text-[6.5px] text-bark-700 font-mono tracking-wider font-semibold uppercase cursor-text focus:outline-none"
          >
            Atelier Blueprint
          </span>
        </div>
      </div>

      {/* Details Box */}
      <div className="p-4 flex-1 flex flex-col justify-between bg-[#fdfdfc]" id="details-box">
        <div>
          {/* Viki Sews Inspired lowercase/titlecase display name and price first */}
          <div className="flex flex-col mb-2.5" id="viki-card-header">
            <div className="flex items-center justify-between" id="price-rating-row">
              <span
                className="font-serif text-base font-light text-bark-900 erp-pattern-price"
                id="viki-price-tag"
                data-erp-field="price"
                data-erp-price-pdf={pattern.pricePDF}
                data-erp-price-printed={pattern.pricePrinted}
                data-erp-current-format={format}
                data-erp-current-price={currentPrice}
              >
                ${(typeof currentPrice === 'number' && !isNaN(currentPrice) ? currentPrice : 0).toFixed(2)}
              </span>

              {ratingStats ? (
                <button
                  onClick={() => setShowGalleryDrawer(true)}
                  className="flex items-center gap-1 bg-[#ba6446]/5 border border-[#ba6446]/10 px-1.5 py-0.5 rounded-[4px] text-[10px] text-[#ba6446] font-medium hover:bg-[#ba6446]/15 hover:border-[#ba6446]/20 transition-all cursor-pointer shadow-3xs"
                  id={`card-rating-${pattern.id}`}
                  title="View Maker Gallery & Reviews"
                >
                  <Star className="w-2.5 h-2.5 fill-current" />
                  <span className="font-bold leading-none">{(typeof ratingStats.average === 'number' && !isNaN(ratingStats.average) ? ratingStats.average : 0).toFixed(1)}</span>
                  <span className="text-bark-500 font-normal leading-none">({ratingStats.count})</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowGalleryDrawer(true)}
                  className="flex items-center gap-1 bg-sand-100/60 border border-sand-200/80 px-1.5 py-0.5 rounded-[4px] text-[10px] text-bark-500 font-medium hover:bg-sand-100 hover:border-sand-300 transition-all cursor-pointer shadow-3xs"
                  id={`card-rating-empty-${pattern.id}`}
                  title="View Maker Gallery & Reviews"
                >
                  <Camera className="w-2.5 h-2.5 text-bark-400" />
                  <span className="leading-none">Reviews &amp; Gallery</span>
                </button>
              )}
            </div>
            <span
              onClick={onSelect}
              className="text-sm font-serif text-bark-950 font-medium tracking-tight hover:text-clay-600 transition-colors cursor-pointer mt-1 block erp-pattern-title"
              id="viki-title-tag"
              data-erp-field="name"
            >
              {pattern.name}
            </span>

            {/* Visual Difficulty Indicator Badge */}
            <div className="flex items-center gap-1.5 mt-2" id={`card-difficulty-badge-${pattern.id}`}>
              <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] border text-[9px] font-mono font-bold uppercase tracking-wider ${diffInfo.classes}`}>
                <DiffIcon className={`w-3 h-3 ${diffInfo.iconColor}`} />
                <span>{diffInfo.label}</span>
              </div>
              <span className="text-[10.5px] text-bark-500 font-sans truncate" title={diffInfo.description}>
                {diffInfo.description}
              </span>
            </div>
          </div>

          <p
            className="text-[10.5px] text-bark-550 leading-relaxed font-sans line-clamp-2 mb-3 erp-pattern-description"
            data-erp-field="description"
            data-erp-tagline={pattern.tagline}
            data-erp-description={pattern.description}
          >
            {pattern.tagline}. {pattern.description}
          </p>

          {/* Quick Specifications */}
          <div className="border-t border-b border-sand-200/50 py-2.5 mb-3.5 space-y-1.5 text-[10.5px] font-sans" id="quick-attributes">
            <div className="flex justify-between" id="attr-fabrics" data-erp-field="fabric-suggestions" data-erp-fabrics={(pattern.fabricSuggestions || []).join(',')}>
              <span className="text-bark-400">Favored Fabrics</span>
              <span className="text-bark-750 font-medium text-right line-clamp-1 max-w-[140px] erp-pattern-fabrics">
                {pattern.fabricSuggestions.slice(0, 2).join(', ')}
              </span>
            </div>
            <div className="flex justify-between" id="attr-yardage" data-erp-field="yardage-info-60" data-erp-yardage-60={pattern.yardageInfo.width60}>
              <span className="text-bark-400">Yardage (60")</span>
              <span className="text-bark-750 font-mono font-medium erp-pattern-yardage">{pattern.yardageInfo.width60}</span>
            </div>
          </div>
        </div>

        {/* Compact, elegant checkout actions row */}
        <div className="mt-2" id={`pattern-card-actions-${pattern.id}`}>
          <div className="flex gap-1.5 items-center" id={`actions-row-${pattern.id}`}>
            {/* Add to Cart Core CTA */}
            <motion.button
              whileTap={{ scale: justAdded ? 1 : 0.96 }}
              onClick={handleAddToCart}
              disabled={justAdded}
              className={`flex-1 py-2.5 rounded-[4px] font-bold text-[10px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer relative overflow-hidden ${
                justAdded
                  ? 'bg-sage-700 text-sand-50 cursor-default'
                  : 'bg-bark-900 hover:bg-clay-600 text-sand-50 shadow-3xs'
              }`}
              id={`add-to-cart-button-${pattern.id}`}
            >
              <AnimatePresence mode="wait">
                {justAdded ? (
                  <motion.div
                    key="added"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ type: "spring", stiffness: 450, damping: 24 }}
                    className="flex items-center justify-center gap-1.5"
                  >
                    <motion.span
                      initial={{ scale: 0.6, rotate: -30 }}
                      animate={{ scale: [0.6, 1.25, 1], rotate: 0 }}
                      transition={{ type: "spring", stiffness: 350, damping: 18, delay: 0.05 }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-sand-50" id={`check-icon-${pattern.id}`} />
                    </motion.span>
                    <span className="font-serif italic font-medium tracking-wide">Added</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ type: "spring", stiffness: 450, damping: 24 }}
                    className="flex items-center justify-center gap-1.5"
                  >
                    <motion.span
                      whileHover={{ scale: 1.15, rotate: -5 }}
                      transition={{ type: "spring", stiffness: 400, damping: 12 }}
                    >
                      <ShoppingCart className="w-3.5 h-3.5 text-sand-100/90" id={`cart-icon-${pattern.id}`} />
                    </motion.span>
                    <span>Add to Cart — ${(typeof currentPrice === 'number' && !isNaN(currentPrice) ? currentPrice : 0).toFixed(0)}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Premium success ripple background effect */}
              {justAdded && (
                <motion.span
                  initial={{ scale: 0.6, opacity: 0.4 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                  className="absolute inset-0 bg-white/20 rounded-[4px] pointer-events-none"
                />
              )}

              {/* Custom confetti particles explosion */}
              {particles.map((p, idx) => {
                const bgColors = ['bg-clay-400', 'bg-sage-400', 'bg-sand-400', 'bg-clay-200', 'bg-sage-200'];
                const chosenBg = bgColors[idx % bgColors.length];
                return (
                  <motion.span
                    key={p.id}
                    initial={{ opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }}
                    animate={{
                      opacity: 0,
                      scale: 0.3,
                      x: p.x,
                      y: p.y - 35,
                      rotate: (Math.random() - 0.5) * 360
                    }}
                    transition={{
                      duration: 0.75,
                      ease: "easeOut",
                      delay: p.delay
                    }}
                    className={`absolute rounded-xs pointer-events-none z-25 ${chosenBg}`}
                    style={{
                      width: p.size,
                      height: p.size,
                      left: '50%',
                      top: '50%'
                    }}
                  />
                );
              })}
            </motion.button>

            {/* Product Details secondary action button */}
            <button
              onClick={onSelect}
              className="px-2.5 py-2.5 bg-white hover:bg-sand-50 border border-sand-250/70 text-bark-800 hover:text-clay-605 rounded-[4px] flex items-center justify-center cursor-pointer transition-colors active:scale-95 shadow-3xs"
              title="View Product Details"
              type="button"
              id={`product-details-btn-${pattern.id}`}
            >
              <Compass className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[8px] text-bark-400 italic text-center mt-1.5 leading-none">
            Adds PDF Format &amp; Size {selectedSize}. Customize in Details.
          </p>
        </div>
      </div>

      {/* Slide-over Maker Gallery & Reviews Drawer */}
      <AnimatePresence>
        {showGalleryDrawer && (
          <div className="fixed inset-0 z-130 overflow-hidden" id={`gallery-drawer-${pattern.id}`}>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGalleryDrawer(false)}
              className="absolute inset-0 bg-bark-950/40 backdrop-blur-xs cursor-pointer"
            />

            {/* Drawer Container */}
            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 210 }}
                className="w-screen max-w-2xl bg-[#FAF8F5] shadow-2xl flex flex-col h-full border-l border-sand-200"
              >
                {/* Drawer Header */}
                <div className="p-4 border-b border-sand-200 bg-white flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h3 className="font-serif text-base font-semibold text-bark-950">{pattern.name}</h3>
                    <p className="text-[10px] text-bark-500 font-sans uppercase tracking-wider font-semibold">Customer Showcase &amp; Reviews</p>
                  </div>
                  <button
                    onClick={() => setShowGalleryDrawer(false)}
                    className="p-1.5 text-bark-400 hover:text-bark-800 transition-colors rounded-full hover:bg-sand-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                  <CustomerGalleryAndReviews
                    pattern={pattern}
                    reviews={patternReviews}
                    onAddReview={onAddReview}
                    currentUser={null}
                  />
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Video Tutorial Modal */}
      <AnimatePresence>
        {false && (
          <div className="fixed inset-0 z-140 overflow-y-auto flex items-center justify-center p-4 sm:p-6" id={`video-modal-${pattern.id}`}>
            {/* Modal Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsVideoModalOpen(false);
                setIsPlayingSimulator(false);
              }}
              className="fixed inset-0 bg-bark-950/50 backdrop-blur-sm cursor-pointer"
            />

            {/* Modal Content Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-[#FAF8F5] rounded-xl border border-sand-200 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col z-150 relative"
              id={`video-modal-content-${pattern.id}`}
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-sand-200 bg-white flex items-center justify-between flex-shrink-0">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-clay-50 border border-clay-200/50 text-clay-700 rounded-[4px]">
                      Sewing Demonstration
                    </span>
                    <span className="text-[10px] font-mono text-bark-450 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {pattern.tutorial?.duration || "15:00"}
                    </span>
                  </div>
                  <h3 className="font-serif text-base sm:text-lg font-semibold text-bark-950 flex items-center gap-2">
                    <Video className="w-4.5 h-4.5 text-[#ba6446]" />
                    {pattern.name} Masterclass
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsVideoModalOpen(false);
                    setIsPlayingSimulator(false);
                  }}
                  className="p-1.5 text-bark-400 hover:text-bark-800 transition-colors rounded-full hover:bg-sand-100 cursor-pointer"
                  title="Close Modal"
                  id={`btn-close-video-modal-${pattern.id}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body (Split screen on desktop, stack on mobile) */}
              <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-sand-200" id="video-modal-body">

                {/* Left Column: Player & Dynamic Guides */}
                <div className="flex-1 p-4 sm:p-5 flex flex-col gap-4 bg-white" id="player-column">

                  {/* Tabs */}
                  <div className="flex border-b border-sand-150 text-xs font-semibold flex-shrink-0" id="player-tabs">
                    <button
                      onClick={() => {
                        setCurrentTab('youtube');
                        setIsPlayingSimulator(false);
                      }}
                      className={`pb-2 px-4 border-b-2 transition-colors cursor-pointer ${
                        currentTab === 'youtube'
                          ? 'border-clay-600 text-clay-700 font-bold'
                          : 'border-transparent text-bark-400 hover:text-bark-700'
                      }`}
                    >
                      Class Video Stream
                    </button>
                    <button
                      onClick={() => {
                        setCurrentTab('interactive');
                        setSimulatorProgress(0);
                      }}
                      className={`pb-2 px-4 border-b-2 transition-colors cursor-pointer ${
                        currentTab === 'interactive'
                          ? 'border-clay-600 text-clay-700 font-bold'
                          : 'border-transparent text-bark-400 hover:text-bark-700'
                      }`}
                    >
                      Interactive Simulator
                    </button>
                  </div>

                  {/* Player Frame Container */}
                  <div className="aspect-video bg-bark-900 rounded-lg overflow-hidden relative shadow-inner flex-shrink-0" id="player-viewport">
                    {currentTab === 'youtube' ? (
                      <iframe
                        src={`${pattern.tutorial?.videoUrl || 'https://www.youtube.com/embed/gAnS9b_P04w'}?start=${parseTimeToSeconds(pattern.tutorial?.steps?.[selectedStepIndex]?.time || '00:00')}&autoplay=1&mute=1`}
                        title={`${pattern.name} Sewing Lesson`}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      ></iframe>
                    ) : (
                      /* Interactive Simulator Player */
                      <div className="w-full h-full flex flex-col justify-between p-4 sm:p-5 text-white relative select-none">
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-b from-bark-950/40 via-bark-900/85 to-bark-950/95 z-0" />

                        {/* Top Indicator */}
                        <div className="z-10 flex items-center justify-between flex-shrink-0" id="sim-top-bar">
                          <span className="text-[9px] font-mono tracking-widest text-clay-300 font-bold uppercase">
                            Step {selectedStepIndex + 1} of {pattern.tutorial?.steps?.length || 5}
                          </span>
                          <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded-full border border-white/20">
                            {pattern.tutorial?.steps?.[selectedStepIndex]?.time || "00:00"}
                          </span>
                        </div>

                        {/* Mid Section: Stitching Animation */}
                        <div className="z-10 flex flex-col items-center justify-center flex-grow py-3" id="sim-visual-core">
                          <div className="relative w-16 h-16 mb-2 flex items-center justify-center">
                            {/* Stitch Line */}
                            <svg className="absolute inset-0 w-full h-full text-sand-200/40" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M 0,50 Q 25,20 50,50 T 100,50" />
                              {isPlayingSimulator && (
                                <path
                                  d="M 0,50 Q 25,20 50,50 T 100,50"
                                  stroke="#ba6446"
                                  strokeWidth="3"
                                  strokeDasharray="6 3"
                                  className="animate-[dash_1.5s_linear_infinite]"
                                />
                              )}
                            </svg>
                            {/* Moving Needle */}
                            <motion.div
                              animate={isPlayingSimulator ? { y: [-5, 5, -5] } : { y: 0 }}
                              transition={{ repeat: Infinity, duration: 0.3, ease: "linear" }}
                              className="absolute top-2"
                            >
                              <Scissors className="w-8 h-8 text-white drop-shadow-md rotate-90" />
                            </motion.div>
                          </div>

                          <p className="text-sm font-serif italic text-center font-medium max-w-sm px-4">
                            "{pattern.tutorial?.steps?.[selectedStepIndex]?.title}"
                          </p>
                          <p className="text-[10px] text-sand-200/70 text-center max-w-xs mt-1 leading-snug">
                            {isPlayingSimulator ? "Stitching seams in progress... Watch needle feed!" : "Demonstration paused. Press play to start."}
                          </p>
                        </div>

                        {/* Bottom Controls */}
                        <div className="z-10 space-y-2.5 flex-shrink-0" id="sim-bottom-bar">
                          {/* Progress Slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-mono text-sand-300">
                              <span>Step Stitching Progress</span>
                              <span>{Math.round(simulatorProgress)}%</span>
                            </div>
                            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-clay-500 rounded-full transition-all duration-150"
                                style={{ width: `${simulatorProgress}%` }}
                              />
                            </div>
                          </div>

                          {/* Action Controls */}
                          <div className="flex items-center justify-center gap-2.5">
                            <button
                              onClick={() => {
                                setSimulatorProgress(0);
                                setSelectedStepIndex(0);
                              }}
                              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95"
                              title="Reset Class"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setIsPlayingSimulator(!isPlayingSimulator)}
                              className="px-4 py-1 rounded-full bg-clay-600 hover:bg-clay-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md shadow-clay-950/20"
                            >
                              {isPlayingSimulator ? (
                                <>
                                  <PauseCircle className="w-4 h-4" />
                                  <span>Pause Stitching</span>
                                </>
                              ) : (
                                <>
                                  <PlayCircle className="w-4 h-4" />
                                  <span>Sew Active Chapter</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Active Step Description */}
                  <div className="p-3 bg-sand-100/50 border border-sand-200/50 rounded-lg space-y-1" id="active-step-desc">
                    <span className="text-[9px] font-mono font-bold text-bark-400 uppercase tracking-widest">
                      Active Step Guidelines
                    </span>
                    <h4 className="text-xs font-semibold text-bark-900 flex items-center gap-1.5">
                      <span className="w-4.5 h-4.5 rounded-full bg-clay-100 text-clay-700 flex items-center justify-center font-mono text-[9px] font-bold">
                        {selectedStepIndex + 1}
                      </span>
                      {pattern.tutorial?.steps?.[selectedStepIndex]?.title}
                    </h4>
                    <p className="text-[10.5px] text-bark-600 leading-relaxed font-sans pl-6">
                      {pattern.tutorial?.steps?.[selectedStepIndex]?.desc}
                    </p>
                  </div>
                </div>

                {/* Right Column: Steps Curriculum list & tips */}
                <div className="w-full lg:w-76 p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto bg-[#FAF8F5]" id="curriculum-column">

                  {/* Instructor Profile */}
                  <div className="p-2.5 bg-white border border-sand-200 rounded-lg flex items-center gap-2.5 shadow-3xs flex-shrink-0" id="instructor-card">
                    <div className="w-8 h-8 rounded-full bg-clay-100 border border-clay-200 flex items-center justify-center text-clay-700 font-serif font-bold text-xs">
                      {pattern.tutorial?.instructor?.[0] || "S"}
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[7.5px] font-mono uppercase tracking-wider text-bark-400 block leading-none font-bold">Your Instructor</span>
                      <h4 className="text-[11px] font-bold text-bark-900 leading-none">{pattern.tutorial?.instructor || "Perfect Fit Master"}</h4>
                      <p className="text-[9px] text-bark-500 leading-none">Senior Pattern Drafter</p>
                    </div>
                  </div>

                  {/* Steps Scroller */}
                  <div className="space-y-2 flex-grow" id="steps-panel">
                    <h4 className="text-[9px] font-mono uppercase font-bold text-bark-400 tracking-wider">
                      Course Curriculum
                    </h4>

                    <div className="space-y-1.5" id="steps-scroller">
                      {(pattern.tutorial?.steps || []).map((step, idx) => {
                        const isSelected = selectedStepIndex === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedStepIndex(idx);
                              if (currentTab === 'interactive') {
                                setSimulatorProgress(0);
                              }
                            }}
                            className={`w-full text-left p-2 rounded-lg border text-xs transition-all flex items-start gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-[#ba6446]/5 border-[#ba6446]/35 text-[#ba6446] font-medium shadow-3xs'
                                : 'bg-white border-sand-200 text-bark-800 hover:bg-sand-100/60 hover:border-sand-300'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center font-mono text-[9px] font-bold flex-shrink-0 mt-0.5 ${
                              isSelected
                                ? 'bg-clay-600 text-white'
                                : 'bg-sand-100 text-bark-500'
                            }`}>
                              {idx + 1}
                            </span>
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold leading-tight truncate">{step.title}</span>
                                <span className="font-mono text-[9px] opacity-75 flex-shrink-0">{step.time}</span>
                              </div>
                              <p className="text-[9.5px] opacity-85 leading-snug line-clamp-1">{step.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Auntie's Sewing Tips */}
                  <div className="p-3 bg-amber-50/50 border border-amber-200/50 rounded-lg space-y-1.5 text-xs flex-shrink-0" id="pro-tips-card">
                    <h4 className="font-bold text-amber-900 flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider">
                      <BookOpen className="w-3 h-3 text-amber-700" />
                      Studio Perfect Fit Secrets
                    </h4>
                    <ul className="space-y-1 text-[10px] text-amber-800/90 leading-relaxed font-medium list-disc list-inside">
                      {(pattern.tutorial?.tips || []).map((tip, idx) => (
                        <li key={idx} className="marker:text-amber-500">
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fabric Swatch & Technical Details Modal */}
      <AnimatePresence>
        {false && isSwatchModalOpen && (
          <div className="fixed inset-0 z-140 overflow-y-auto flex items-center justify-center p-4 sm:p-6" id={`swatch-modal-${pattern.id}`}>
            {/* Backdrop with motion blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsSwatchModalOpen(false);
                setIsMagnifying(false);
              }}
              className="fixed inset-0 bg-bark-950/50 backdrop-blur-sm cursor-pointer"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 24, stiffness: 210 }}
              className="bg-[#FAF8F5] rounded-xl border border-sand-200 shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col z-150 relative"
              id={`swatch-modal-content-${pattern.id}`}
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-sand-200 bg-white flex items-center justify-between flex-shrink-0">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-clay-50 border border-clay-200/50 text-clay-700 rounded-[4px] flex items-center gap-1">
                      <Cpu className="w-2.5 h-2.5 animate-pulse" />
                      Digital Swatch Room
                    </span>
                    <span className="text-[9px] font-mono text-bark-450 uppercase tracking-wider">
                      Atelier CAD Engine v2.4
                    </span>
                  </div>
                  <h3 className="font-serif text-base sm:text-lg font-semibold text-bark-950 flex items-center gap-2">
                    <Layers className="w-4.5 h-4.5 text-[#ba6446]" />
                    {pattern.name} // Fabric Selection & Technical Details
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsSwatchModalOpen(false);
                    setIsMagnifying(false);
                  }}
                  className="p-1.5 text-bark-400 hover:text-bark-800 transition-colors rounded-full hover:bg-sand-100 cursor-pointer"
                  title="Close Swatch Room"
                  id={`btn-close-swatch-modal-${pattern.id}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Side-by-Side Body Grid */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6" id="swatch-modal-body">

                {/* Left Column: Technical Blueprint Drawing */}
                <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-sand-200" id="tech-drawing-panel">
                  <div className="flex items-center justify-between flex-shrink-0">
                    <div className="space-y-0.5">
                      <h4 className="text-[10.5px] font-mono uppercase tracking-widest text-bark-450 font-bold">
                        I. Technical Specification
                      </h4>
                      <p className="text-[11.5px] font-serif italic text-bark-800 font-semibold">
                        Vector Draft Blueprint (Draft Scale 1:10)
                      </p>
                    </div>

                    {/* Blueprint Isolation Tabs */}
                    <div className="flex bg-sand-100/60 p-0.5 rounded-md border border-sand-200 text-[9.5px] font-mono font-bold" id="drawing-isolation-controls">
                      {['both', 'front', 'back'].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setDrawingView(mode)}
                          className={`px-2.5 py-1 rounded-[4px] uppercase transition-all cursor-pointer ${
                            drawingView === mode
                              ? 'bg-white text-clay-700 shadow-3xs font-bold'
                              : 'text-bark-450 hover:text-bark-800'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Blueprint Stage Canvas with millimeter grid */}
                  <div
                    className="aspect-square w-full rounded-lg border border-[#ba6446]/25 relative overflow-hidden flex items-center justify-center select-none shadow-inner"
                    style={{
                      backgroundColor: '#FAF8F5',
                      backgroundImage: 'radial-gradient(#ba6446 0.6px, transparent 0.6px), radial-gradient(#ba6446 0.6px, #FAF8F5 0.6px)',
                      backgroundSize: '12px 12px',
                    }}
                    id="blueprint-stage-viewport"
                  >
                    {/* Architectural Border Markings */}
                    <div className="absolute top-1 left-2 text-[7.5px] font-mono text-[#ba6446]/60">A-1</div>
                    <div className="absolute top-1 right-2 text-[7.5px] font-mono text-[#ba6446]/60">A-2</div>
                    <div className="absolute bottom-1 left-2 text-[7.5px] font-mono text-[#ba6446]/60">B-1</div>
                    <div className="absolute bottom-1 right-2 text-[7.5px] font-mono text-[#ba6446]/60">B-2</div>

                    {/* Coordinate Grid Crosshairs */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                      <div className="w-full h-px bg-[#ba6446] dashed" />
                      <div className="h-full w-px bg-[#ba6446] dashed" />
                    </div>

                    {/* SVG Technical flats */}
                    <div className="w-[85%] h-[85%] flex items-center justify-center relative z-10 transition-transform duration-500">
                      {renderDynamicTechnicalFlats(pattern.id, pattern.category, drawingView)}
                    </div>

                    {/* Overlay Drafting Stamp Tag */}
                    <div className="absolute bottom-3 left-3 bg-white/90 border border-sand-200/80 rounded px-2 py-1 flex items-center gap-1.5 shadow-2xs backdrop-blur-sm z-20">
                      <div className="w-1.5 h-1.5 rounded-full bg-clay-500 animate-pulse" />
                      <span className="text-[7.5px] font-mono uppercase tracking-wider text-bark-700 font-bold">
                        Cad Draft Approved
                      </span>
                    </div>
                  </div>

                  {/* Silhouette and Seam Specifications below the drawing */}
                  <div className="p-3 bg-sand-50 border border-sand-200/80 rounded-lg space-y-2.5 text-xs flex-grow" id="tech-drawing-specs">
                    <div>
                      <span className="text-[8px] font-mono uppercase tracking-widest text-bark-400 block font-bold">
                        Construction Profile & Notions
                      </span>
                      <p className="text-[10.5px] font-sans font-medium text-bark-700 mt-1">
                        Recommended Seam Finishing: <span className="font-bold text-clay-700">French Seams</span> or standard overcast finish. 3/8 in (1cm) seam allowance included in blueprint pattern pages.
                      </p>
                    </div>

                    {pattern.features && pattern.features.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[8px] font-mono uppercase tracking-widest text-bark-400 block font-bold">
                          Key Structural Elements
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {pattern.features.map((feat, i) => (
                            <span key={i} className="px-2 py-0.5 bg-white border border-sand-200/70 rounded-[3px] text-[9.5px] text-bark-700 font-sans font-medium">
                              {feat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-sand-200/60 flex items-center justify-between text-[9px] font-mono text-bark-450">
                      <span>PATTERN ID: {pattern.id.toUpperCase()}</span>
                      <span>DRAFT DATE: 2026-07</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Generative Textile Swatch Room */}
                <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-sand-200" id="generative-textile-panel">
                  <div className="space-y-0.5 flex-shrink-0">
                    <h4 className="text-[10.5px] font-mono uppercase tracking-widest text-bark-450 font-bold">
                      II. Recommended Textile Weaves
                    </h4>
                    <p className="text-[11.5px] font-serif italic text-bark-800 font-semibold">
                      Generative AI Textile Swatch Room
                    </p>
                  </div>

                  {/* Recommended Fabric Selector Swatch Buttons */}
                  <div className="space-y-2 flex-shrink-0">
                    <span className="text-[8px] font-mono uppercase tracking-widest text-bark-400 block font-bold">
                      Recommended Pattern Fibers (Click to inspect)
                    </span>
                    <div className="grid grid-cols-2 gap-2" id="recommended-fiber-grid">
                      {(pattern.fabricSuggestions || ['Linen', 'Silk Satin', 'Wool Crepe']).slice(0, 4).map((fab, i) => {
                        const isSelected = selectedFabric === fab && !synthesizedSwatchUrl;
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              setSelectedFabric(fab);
                              setSynthesizedSwatchUrl(''); // Clear custom synthesized URL
                            }}
                            onMouseEnter={() => setHoveredFabric(fab)}
                            onMouseLeave={() => setHoveredFabric(null)}
                            className={`p-2 rounded-lg border text-left flex items-center gap-2 cursor-pointer transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] ${
                              isSelected
                                ? 'bg-clay-50/50 border-clay-500 shadow-3xs ring-1 ring-clay-500/20'
                                : 'bg-sand-50/20 border-sand-200 hover:bg-sand-50/80 hover:border-sand-350 hover:shadow-2xs'
                            }`}
                          >
                            <div className="w-5 h-5 rounded-md overflow-hidden relative border border-sand-200 flex-shrink-0 shadow-3xs">
                              <img
                                src={getFabricTextureUrl(fab, selectedColor)}
                                alt={fab}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div
                                className="absolute inset-0 mix-blend-color opacity-70"
                                style={{
                                  backgroundColor:
                                    selectedColor === 'Oatmeal' ? '#DBCCB5' :
                                    selectedColor === 'Burgundy' ? '#5C1A2E' :
                                    selectedColor === 'Forest' ? '#18413B' :
                                    selectedColor === 'Slate' ? '#717378' :
                                    selectedColor === 'Rose' ? '#B96D76' :
                                    selectedColor === 'Prussian' ? '#1E243A' :
                                    selectedColor === 'Charcoal' ? '#1A1A1E' :
                                    'transparent'
                                }}
                              />
                            </div>
                            <div className="min-w-0">
                              <span className={`block text-[10px] truncate leading-none ${isSelected ? 'font-bold text-clay-700' : 'font-medium text-bark-800'}`}>
                                {fab}
                              </span>
                              <span className="text-[7.5px] font-mono text-bark-400 block mt-0.5">
                                {isSelected ? 'Selected Fiber' : 'Select Fiber'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Premium Runway Colors */}
                  <div className="space-y-2 flex-shrink-0" id="color-selectors-container">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-mono uppercase tracking-widest text-bark-400 block font-bold">
                        Color Presets (PANTONE® TCX Reference)
                      </span>
                      <span className="text-[9.5px] font-serif italic text-bark-600 font-bold">
                        {selectedColor === 'Oatmeal' ? 'Alabaster Oatmeal (13-0002 TCX)' :
                         selectedColor === 'Burgundy' ? 'Bordeaux Burgundy (19-1650 TCX)' :
                         selectedColor === 'Forest' ? 'Veridian Forest (19-5414 TCX)' :
                         selectedColor === 'Slate' ? 'Steel Slate (18-4005 TCX)' :
                         selectedColor === 'Rose' ? 'Rosewood Pink (18-1630 TCX)' :
                         selectedColor === 'Prussian' ? 'Prussian Navy (19-4024 TCX)' :
                         'Charcoal Black (19-3906 TCX)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2" id="color-circle-group">
                      {[
                        { name: 'Oatmeal', code: '#DBCCB5', border: 'border-sand-300', pantoneName: 'White Sand', pantoneCode: '13-0002-TCX' },
                        { name: 'Burgundy', code: '#5C1A2E', border: 'border-rose-950', pantoneName: 'Biking Red', pantoneCode: '19-1650-TCX' },
                        { name: 'Forest', code: '#18413B', border: 'border-emerald-950', pantoneName: 'Forest Biome', pantoneCode: '19-5414-TCX' },
                        { name: 'Slate', code: '#717378', border: 'border-slate-800', pantoneName: 'Steel Gray', pantoneCode: '18-4005-TCX' },
                        { name: 'Rose', code: '#B96D76', border: 'border-rose-300', pantoneName: 'Dusty Rose', pantoneCode: '18-1630-TCX' },
                        { name: 'Prussian', code: '#1E243A', border: 'border-slate-900', pantoneName: 'Dress Blues', pantoneCode: '19-4024-TCX' },
                        { name: 'Charcoal', code: '#1A1A1E', border: 'border-neutral-900', pantoneName: 'Dark Slate', pantoneCode: '19-3906-TCX' }
                      ].map((col) => {
                        const isColorSelected = selectedColor === col.name;
                        return (
                          <button
                            key={col.name}
                            onClick={() => setSelectedColor(col.name)}
                            onMouseEnter={() => setHoveredColor(col.name)}
                            onMouseLeave={() => setHoveredColor(null)}
                            className={`w-6 h-6 rounded-full cursor-pointer relative flex items-center justify-center transition-all duration-200 hover:scale-[1.18] active:scale-95 ${col.border} ${
                              isColorSelected ? 'ring-2 ring-clay-500 ring-offset-2 scale-110 shadow-3xs' : 'border'
                            }`}
                            style={{ backgroundColor: col.code }}
                            title={`${col.name} - PANTONE ${col.pantoneCode}`}
                          />
                        );
                      })}
                    </div>

                    {/* Interactive Tactile Swatch Profile Card */}
                    {(() => {
                      const activeInspectColor = hoveredColor || selectedColor;
                      const activeInspectFabric = hoveredFabric || selectedFabric;

                      const pantoneData = [
                        { name: 'Oatmeal', code: '#DBCCB5', pantoneName: 'White Sand', pantoneCode: '13-0002-TCX' },
                        { name: 'Burgundy', code: '#5C1A2E', pantoneName: 'Biking Red', pantoneCode: '19-1650-TCX' },
                        { name: 'Forest', code: '#18413B', pantoneName: 'Forest Biome', pantoneCode: '19-5414-TCX' },
                        { name: 'Slate', code: '#717378', pantoneName: 'Steel Gray', pantoneCode: '18-4005-TCX' },
                        { name: 'Rose', code: '#B96D76', pantoneName: 'Dusty Rose', pantoneCode: '18-1630-TCX' },
                        { name: 'Prussian', code: '#1E243A', pantoneName: 'Dress Blues', pantoneCode: '19-4024-TCX' },
                        { name: 'Charcoal', code: '#1A1A1E', pantoneName: 'Dark Slate', pantoneCode: '19-3906-TCX' }
                      ].find(c => c.name === activeInspectColor) || { name: 'Oatmeal', code: '#DBCCB5', pantoneName: 'White Sand', pantoneCode: '13-0002-TCX' };

                      const fabricDesc = FABRIC_DESCRIPTIONS[activeInspectFabric] || FABRIC_DESCRIPTIONS['Linen'];
                      const isHoveredState = !!(hoveredColor || hoveredFabric);

                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", damping: 25, stiffness: 300 }}
                          className="bg-sand-50/50 border border-sand-200/80 rounded-lg p-3 space-y-3 shadow-3xs mt-2 relative overflow-hidden transition-all duration-300 hover:border-clay-300/60"
                          id={`tactile-swatch-panel-${pattern.id}`}
                        >
                          {/* Inner glow or state feedback line */}
                          <div
                            className={`absolute top-0 left-0 right-0 h-1 transition-all duration-300 ${isHoveredState ? 'bg-clay-500 scale-x-100' : 'bg-sand-300 scale-x-75'}`}
                          />

                          <div className="flex items-start justify-between gap-3 pt-1">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Color Block resembling a Pantone Chip */}
                              <div className="w-9 h-12 bg-white rounded border border-sand-250 flex flex-col justify-between overflow-hidden shadow-3xs p-0.5 flex-shrink-0">
                                <div className="flex-grow rounded-xs" style={{ backgroundColor: pantoneData.code }} />
                                <div className="text-[4px] font-mono leading-none pt-0.5 text-center font-bold text-bark-900 tracking-tighter uppercase">
                                  PANTONE®
                                </div>
                              </div>
                              <div className="min-w-0">
                                <span className="text-[7.5px] font-mono font-bold uppercase tracking-widest text-clay-605 block">
                                  {isHoveredState ? 'Previewing Profile' : 'Selected Tactile Profile'}
                                </span>
                                <span className="text-[10.5px] font-bold text-bark-950 block truncate leading-tight">
                                  {pantoneData.pantoneCode}
                                </span>
                                <span className="text-[9.5px] text-bark-600 font-serif italic block truncate leading-none mt-0.5">
                                  {pantoneData.pantoneName} ({activeInspectColor})
                                </span>
                              </div>
                            </div>

                            <a
                              href={`https://www.pantone.com/color-finder/${pantoneData.pantoneCode}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-white hover:bg-sand-50 text-bark-750 hover:text-bark-900 border border-sand-200/80 text-[8px] font-mono font-bold uppercase tracking-wider px-2 py-1.5 rounded flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-3xs"
                              id={`link-pantone-external-${pattern.id}`}
                            >
                              <span>Verify Specs</span>
                              <ArrowRight className="w-2.5 h-2.5 text-clay-600" />
                            </a>
                          </div>

                          {/* Dynamic Texture Description Section with expansion transition */}
                          <motion.div
                            layout
                            className="border-t border-sand-200/50 pt-2.5 space-y-1"
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-[8px] font-mono uppercase tracking-widest text-bark-450 font-bold block">
                                Fiber Character • {activeInspectFabric}
                              </span>
                              {isHoveredState && (
                                <span className="text-[7.5px] font-mono text-clay-600 bg-clay-50 px-1 rounded animate-pulse">
                                  Inspecting
                                </span>
                              )}
                            </div>

                            <motion.p
                              layout="position"
                              className="text-[10px] text-bark-700 leading-relaxed font-sans font-medium"
                            >
                              {fabricDesc}
                            </motion.p>
                          </motion.div>

                          {/* subtle helper footer explaining how to expand */}
                          <div className="text-[7.5px] font-mono text-bark-400 border-t border-sand-200/20 pt-1.5 flex justify-between items-center">
                            <span>MATCHWAY: {activeInspectColor.toUpperCase()} • {activeInspectFabric.toUpperCase()}</span>
                            <span>Hover swatches to swap</span>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </div>

                  {/* AI Swatch Generator Prompt Input */}
                  <div className="space-y-1.5 flex-shrink-0" id="ai-generator-panel">
                    <span className="text-[8px] font-mono uppercase tracking-widest text-bark-400 block font-bold">
                      AI Custom Texture Synthesizer
                    </span>
                    <div className="flex gap-2">
                      <div className="relative flex-grow">
                        <input
                          type="text"
                          value={customSwatchPrompt}
                          onChange={(e) => setCustomSwatchPrompt(e.target.value)}
                          placeholder="Type custom weave, e.g. 'heavy tweed with golden lurex thread'..."
                          className="w-full px-3 py-1.5 bg-sand-50/50 border border-sand-200 rounded-[4px] text-[10px] focus:outline-none focus:border-clay-500 focus:bg-white text-bark-950"
                          disabled={isSynthesizingSwatch}
                        />
                        <Paintbrush className="absolute right-2.5 top-2 w-3.5 h-3.5 text-bark-400 pointer-events-none" />
                      </div>
                      <button
                        onClick={handleSynthesizeCustomSwatch}
                        disabled={isSynthesizingSwatch || !customSwatchPrompt.trim()}
                        className="py-1.5 px-3 bg-[#ba6446] hover:bg-[#ba6446]/90 disabled:bg-sand-200 text-white font-mono font-bold uppercase text-[9px] tracking-wider rounded-[4px] transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0 active:scale-98"
                      >
                        <RefreshCw className={`w-3 h-3 ${isSynthesizingSwatch ? 'animate-spin' : ''}`} />
                        <span>Synthesize</span>
                      </button>
                    </div>
                  </div>

                  {/* Swatch Image Preview Stage & Thread Counter Magnifying Loupe */}
                  <div className="flex-grow flex flex-col justify-end relative" id="swatch-viewer-stage">
                    <div className="aspect-[3/2] w-full rounded-lg border border-sand-200 overflow-hidden relative shadow-md bg-sand-50" id="swatch-box-frame">
                      {isSynthesizingSwatch ? (
                        /* AI Synthesis Loading overlay with simulated logic files logs */
                        <div className="absolute inset-0 bg-bark-950/90 text-emerald-400 font-mono text-[8px] p-4 flex flex-col justify-between z-40 select-none animate-[pulse_3s_infinite]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-white font-bold text-[9px] border-b border-emerald-500/20 pb-1 mb-1.5">
                              <Cpu className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                              <span>AI TEXTURE SYNTHESIS MODULE RUNNING...</span>
                            </div>
                            {synthesisLogs.map((log, index) => (
                              <div key={index} className="animate-fade-in truncate leading-normal">
                                &gt; {log}
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between border-t border-emerald-500/20 pt-1 text-[7.5px] text-emerald-500">
                            <span>GRID CORE: ACTIVE</span>
                            <span>THREAD WEIGHT PARSED: 98%</span>
                          </div>
                        </div>
                      ) : (
                        /* Standard swatch render with thread magnifier */
                        <div
                          className="w-full h-full relative cursor-crosshair group/swatch overflow-hidden"
                          onMouseMove={handleMouseMove}
                          onMouseEnter={() => setIsMagnifying(true)}
                          onMouseLeave={() => setIsMagnifying(false)}
                          id="swatch-interactive-zone"
                        >
                          {/* Image rendering with color filters applied */}
                          <img
                            src={synthesizedSwatchUrl || getFabricTextureUrl(selectedFabric, selectedColor)}
                            alt={selectedFabric}
                            className="w-full h-full object-cover select-none"
                            referrerPolicy="no-referrer"
                            id="swatch-texture-img"
                          />

                          {/* Color dye multiply filter */}
                          {!synthesizedSwatchUrl && (
                            <>
                              <div
                                className={`absolute inset-0 mix-blend-color pointer-events-none transition-colors duration-500 ${
                                  selectedColor === 'Burgundy' ? 'bg-[#5c1313]' :
                                  selectedColor === 'Forest' ? 'bg-[#153b21]' :
                                  selectedColor === 'Slate' ? 'bg-[#475569]' :
                                  selectedColor === 'Rose' ? 'bg-[#be7c87]' :
                                  selectedColor === 'Prussian' ? 'bg-[#1e293b]' :
                                  selectedColor === 'Charcoal' ? 'bg-[#18181b]' :
                                  'bg-transparent'
                                }`}
                              />
                              <div
                                className={`absolute inset-0 mix-blend-multiply pointer-events-none opacity-45 transition-colors duration-500 ${
                                  selectedColor === 'Burgundy' ? 'bg-[#881337]' :
                                  selectedColor === 'Forest' ? 'bg-[#064e3b]' :
                                  selectedColor === 'Slate' ? 'bg-[#334155]' :
                                  selectedColor === 'Rose' ? 'bg-[#f472b6]' :
                                  selectedColor === 'Prussian' ? 'bg-[#172554]' :
                                  selectedColor === 'Charcoal' ? 'bg-[#09090b]' :
                                  'bg-transparent'
                                }`}
                              />
                            </>
                          )}

                          {/* Magnifying Glass Loupe (Thread counter) */}
                          {isMagnifying && (
                            <div
                              className="absolute pointer-events-none border-2 border-clay-500 rounded-full shadow-2xl overflow-hidden w-28 h-28 z-30"
                              style={{
                                left: `${magnifierPos.x}%`,
                                top: `${magnifierPos.y}%`,
                                transform: 'translate(-50%, -50%)',
                              }}
                            >
                              <div
                                className="w-full h-full scale-[2.8]"
                                style={{
                                  backgroundImage: `url(${synthesizedSwatchUrl || getFabricTextureUrl(selectedFabric, selectedColor)})`,
                                  backgroundPosition: `${magnifierPos.x}% ${magnifierPos.y}%`,
                                  backgroundSize: '300% 300%',
                                }}
                              />

                              {/* Color tint inside magnifying loupe */}
                              {!synthesizedSwatchUrl && (
                                <>
                                  <div
                                    className={`absolute inset-0 mix-blend-color pointer-events-none opacity-50 ${
                                      selectedColor === 'Burgundy' ? 'bg-[#5c1313]' :
                                      selectedColor === 'Forest' ? 'bg-[#153b21]' :
                                      selectedColor === 'Slate' ? 'bg-[#475569]' :
                                      selectedColor === 'Rose' ? 'bg-[#be7c87]' :
                                      selectedColor === 'Prussian' ? 'bg-[#1e293b]' :
                                      selectedColor === 'Charcoal' ? 'bg-[#18181b]' :
                                      'bg-transparent'
                                    }`}
                                  />
                                  <div
                                    className={`absolute inset-0 mix-blend-multiply pointer-events-none opacity-30 ${
                                      selectedColor === 'Burgundy' ? 'bg-[#881337]' :
                                      selectedColor === 'Forest' ? 'bg-[#064e3b]' :
                                      selectedColor === 'Slate' ? 'bg-[#334155]' :
                                      selectedColor === 'Rose' ? 'bg-[#f472b6]' :
                                      selectedColor === 'Prussian' ? 'bg-[#172554]' :
                                      selectedColor === 'Charcoal' ? 'bg-[#09090b]' :
                                      'bg-transparent'
                                    }`}
                                  />
                                </>
                              )}

                              {/* Loupe reticle crosshairs & glass reflections */}
                              <div className="absolute inset-0 border border-white/25 rounded-full" />
                              <div className="absolute top-1/2 left-0 right-0 h-px bg-clay-500/25" />
                              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-clay-500/25" />
                              <div className="absolute top-1 right-3 text-[5.5px] font-mono text-[#ba6446] bg-white/70 px-1 py-0.2 rounded font-bold">
                                4.0x
                              </div>
                            </div>
                          )}

                          {/* Floating Loupe Notice Overlay */}
                          <div className="absolute top-2 right-2 px-2 py-0.5 bg-bark-900/40 backdrop-blur-xs rounded text-[7.5px] font-mono text-sand-100 uppercase font-medium tracking-wider group-hover/swatch:opacity-0 transition-opacity">
                            Hover to inspect weave (4x)
                          </div>

                          {/* Swatch Status Badge */}
                          <div className="absolute bottom-2 left-2 bg-white/90 border border-sand-200/80 rounded px-1.5 py-0.5 text-[7px] font-mono uppercase font-bold text-bark-800 shadow-2xs">
                            {synthesizedSwatchUrl ? 'CUSTOM SYNTHESIS ACTIVE' : `${selectedFabric.toUpperCase()} // ${selectedColor.toUpperCase()}`}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
