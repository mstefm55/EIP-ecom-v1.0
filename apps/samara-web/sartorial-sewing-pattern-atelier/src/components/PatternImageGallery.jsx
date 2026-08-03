import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRole } from '../context/RoleContext';
import {
  ShoppingCart,
  Star,
  Scissors,
  Compass,
  Sparkles,
  Heart,
  Eye,
  ArrowRight,
  Check,
  Layers,
  Info,
  Tag,
  Clock,
  Search,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

// Custom animated tooltip component that matches Perfect Fit Bureau style
function Tooltip({ children, content, position = 'top' }) {
  const [visible, setVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-bark-950 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-bark-950 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-bark-950 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-bark-950 border-y-transparent border-l-transparent',
  };

  return (
    <div
      className="relative inline-flex pointer-events-auto"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: position === 'top' ? 4 : position === 'bottom' ? -4 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }} // smooth ease out
            className={`absolute z-50 pointer-events-none whitespace-normal w-48 max-w-xs ${positionClasses[position]}`}
          >
            <div className="bg-bark-950/98 text-sand-100 text-[9.5px] leading-relaxed px-2.5 py-2 rounded-[3px] shadow-xl border border-sand-200/10 font-sans tracking-wide">
              {content}
            </div>
            <div className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Framer Motion staggered scroll animations for premium gallery entry
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.215, 0.61, 0.355, 1], // easeOutCubic
    },
  },
};

const getDifficultyDetails = (difficulty) => {
  switch (difficulty) {
    case 'Beginner':
      return {
        label: 'Beginner Friendly',
        icon: Compass,
        badgeClasses: 'bg-emerald-50 text-emerald-800 border-emerald-200/60',
        dotClass: 'bg-emerald-500',
        accentColor: '#10b981',
        description: 'Perfect for beginners. Simple straight seams, direct assembly, and easy-to-sew fabrics.'
      };
    case 'Intermediate':
      return {
        label: 'Intermediate Draft',
        icon: Scissors,
        badgeClasses: 'bg-amber-50 text-amber-800 border-amber-200/60',
        dotClass: 'bg-amber-500',
        accentColor: '#f59e0b',
        description: 'Requires handling curves, tailored necklines, collars, or precise seam finishes.'
      };
    case 'Advanced':
      return {
        label: 'Advanced Couture',
        icon: Sparkles,
        badgeClasses: 'bg-rose-50/90 text-rose-800 border-rose-200/60',
        dotClass: 'bg-rose-500',
        accentColor: '#f43f5e',
        description: 'Intricate couture tailoring, full body lining, hidden closures, and delicate finishes.'
      };
    default:
      return {
        label: difficulty || 'Intermediate',
        icon: Scissors,
        badgeClasses: 'bg-sand-50 text-bark-800 border-sand-200/60',
        dotClass: 'bg-bark-500',
        accentColor: '#ba6446',
        description: 'Refined tailoring draft that elevates core garment construction and fitting assembly.'
      };
  }
};

export default function PatternImageGallery({
  patterns = [],
  onAddToCart,
  onQuickView,
  onSelect,
  favorites = [],
  onToggleFavorite,
  activePatternId
}) {
  let currentRole = 'guest';
  try {
    const roleCtx = useRole();
    if (roleCtx) {
      currentRole = roleCtx.role;
    }
  } catch (err) {
    // Context fallback
  }

  const isAdmin = currentRole === 'professional' || currentRole === 'administrator';

  const [hoverEnabled, setHoverEnabled] = useState(() => {
    const saved = localStorage.getItem('atelier_hover_info_enabled');
    return saved !== 'false'; // Defaults to true
  });

  const [hoveredPatternId, setHoveredPatternId] = useState(null);
  const [addingToCartId, setAddingToCartId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPriceRange, setSelectedPriceRange] = useState('All');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Listen for global hover config changes from Admin Console
  useEffect(() => {
    const handleConfigChange = () => {
      const saved = localStorage.getItem('atelier_hover_info_enabled');
      setHoverEnabled(saved !== 'false');
    };
    window.addEventListener('atelier_hover_config_changed', handleConfigChange);
    return () => window.removeEventListener('atelier_hover_config_changed', handleConfigChange);
  }, []);

  // Reset page to 1 when filters or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDifficulty, selectedCategory, selectedPriceRange, showFavoritesOnly, itemsPerPage]);

  const { filteredPatterns, totalPages, paginatedPatterns } = useMemo(() => {
    const filtered = patterns.filter(pattern => {
      const query = searchQuery.toLowerCase();
      const name = pattern.name || '';
      const catVal = pattern.category || '';
      const fabVal = Array.isArray(pattern.fabricSuggestions)
        ? pattern.fabricSuggestions.join(', ')
        : (pattern.fabric || '');

      const matchesSearch = name.toLowerCase().includes(query) ||
                            catVal.toLowerCase().includes(query) ||
                            fabVal.toLowerCase().includes(query);
      const matchesDifficulty = selectedDifficulty === 'All' || pattern.difficulty === selectedDifficulty;

      // Category match handles 'Bottoms' / 'Bottoms' or similar
      const matchesCategory = selectedCategory === 'All' ||
        (pattern.category === selectedCategory) ||
        (selectedCategory === 'Bottoms' && pattern.category === 'Bottoms') ||
        (selectedCategory === 'Bottoms' && pattern.category === 'Trousers');

      // Price calculation
      const price = typeof pattern.pricePDF === 'number' && !isNaN(pattern.pricePDF)
        ? pattern.pricePDF
        : (pattern.price || 0);
      let matchesPrice = true;
      if (selectedPriceRange === 'under-15') {
        matchesPrice = price < 15;
      } else if (selectedPriceRange === '15-20') {
        matchesPrice = price >= 15 && price <= 20;
      } else if (selectedPriceRange === 'over-20') {
        matchesPrice = price > 20;
      }

      const matchesFavorites = !showFavoritesOnly || favorites.includes(pattern.id);
      return matchesSearch && matchesDifficulty && matchesCategory && matchesPrice && matchesFavorites;
    });

    const total = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const start = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(start, start + itemsPerPage);

    return {
      filteredPatterns: filtered,
      totalPages: total,
      paginatedPatterns: paginated
    };
  }, [patterns, searchQuery, selectedDifficulty, selectedCategory, selectedPriceRange, showFavoritesOnly, favorites, itemsPerPage, currentPage]);

  const handleQuickAdd = (e, pattern) => {
    e.stopPropagation();
    setAddingToCartId(pattern.id);
    onAddToCart(pattern, 'PDF', '8'); // Default format & size

    setTimeout(() => {
      setAddingToCartId(null);
      if (window.showToast) {
        window.showToast(
          `Added ${pattern.name} (PDF, Size 8) to your active tailoring queue.`,
          "success",
          "Added to Cart"
        );
      }
    }, 800);
  };

  return (
    <div className="space-y-6" id="pattern-showcase-gallery-component">
      {/* Decorative intro text inside the gallery */}
      <div>
        <p className="text-xs text-bark-500 italic max-w-lg leading-relaxed font-sans">
          Hover over any design cover below to reveal professional specifications, construction features, recommended fabrics, and tailoring complexity in real-time.
        </p>
      </div>

      {/* Premium Multi-Filter Panel (Difficulty Level, Style, Price Range) */}
      <div className="bg-[#FAF8F5] border border-sand-200/70 p-5 rounded-xl space-y-4" id="gallery-premium-filters-panel">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-sand-200/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#ba6446]" />
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-bark-800">Fine-Tune Atelier Blueprints</h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-bark-400">Showing {filteredPatterns.length} of {patterns.length} drafts</span>
            {(selectedDifficulty !== 'All' || selectedCategory !== 'All' || selectedPriceRange !== 'All' || searchQuery !== '') && (
              <button
                onClick={() => {
                  setSelectedDifficulty('All');
                  setSelectedCategory('All');
                  setSelectedPriceRange('All');
                  setSearchQuery('');
                }}
                className="text-[9px] font-mono font-bold text-clay-700 hover:text-clay-900 uppercase underline transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Difficulty Filter */}
          <div className="space-y-1.5">
            <label className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-500 block">
              Tailoring Difficulty Level
            </label>
            <div className="flex flex-wrap bg-sand-100/65 p-1 rounded-lg border border-sand-200/60 gap-0.5">
              {['All', 'Beginner', 'Intermediate', 'Advanced'].map(diff => {
                const gradeTooltips = {
                  All: "Display all sewing patterns across all difficulty tiers.",
                  Beginner: "Perfect for beginners. Direct assembly and simple straight seams.",
                  Intermediate: "Requires experience with curved lines, collars, or zippers.",
                  Advanced: "Intricate bespoke designs featuring linings and structured cuts."
                };
                return (
                  <Tooltip key={diff} content={gradeTooltips[diff]} position="top">
                    <button
                      key={diff}
                      onClick={() => setSelectedDifficulty(diff)}
                      className={`flex-1 min-w-[60px] text-center px-2 py-1 text-[8.5px] font-bold uppercase rounded transition-all cursor-pointer ${
                        selectedDifficulty === diff
                          ? 'bg-white text-clay-700 shadow-3xs'
                          : 'text-bark-500 hover:text-bark-900'
                      }`}
                      type="button"
                    >
                      {diff}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Category / Style Filter */}
          <div className="space-y-1.5">
            <label className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-500 block">
              Garment Style / Category
            </label>
            <div className="flex flex-wrap bg-sand-100/65 p-1 rounded-lg border border-sand-200/60 gap-0.5">
              {['All', 'Dresses', 'Outerwear', 'Tops', 'Bottoms'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex-1 min-w-[50px] text-center px-2 py-1 text-[8.5px] font-bold uppercase rounded transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-white text-clay-700 shadow-3xs'
                      : 'text-bark-500 hover:text-bark-900'
                  }`}
                  type="button"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range Filter */}
          <div className="space-y-1.5">
            <label className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-500 block">
              Price Range Selection
            </label>
            <div className="flex flex-wrap bg-sand-100/65 p-1 rounded-lg border border-sand-200/60 gap-0.5">
              {[
                { id: 'All', label: 'All' },
                { id: 'under-15', label: 'Under $15' },
                { id: '15-20', label: '$15 - $20' },
                { id: 'over-20', label: 'Over $20' }
              ].map(range => (
                <button
                  key={range.id}
                  onClick={() => setSelectedPriceRange(range.id)}
                  className={`flex-1 min-w-[60px] text-center px-2 py-1 text-[8.5px] font-bold uppercase rounded transition-all cursor-pointer ${
                    selectedPriceRange === range.id
                      ? 'bg-white text-clay-700 shadow-3xs'
                      : 'text-bark-500 hover:text-bark-900'
                  }`}
                  type="button"
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Filters Row in Showcase View */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-sand-50/50 p-4 border border-sand-200/60 rounded-lg" id="showcase-filters">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-bark-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search designs or fabrics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-10 py-1.5 bg-white border border-sand-250 rounded-md text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 w-full font-sans transition-all"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-bark-300 hover:text-bark-500 transition-colors">
            <Tooltip content="Filters list by design names, categories, or fabric suggestions (e.g., Linen, Wool, Silk, Denim)." position="bottom">
              <Info className="w-3.5 h-3.5 cursor-help" />
            </Tooltip>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Tooltip content="Show only the sewing patterns you have saved to your active favorites wishlist." position="top">
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`px-2.5 py-1 text-[8.5px] font-bold uppercase rounded transition-all cursor-pointer flex items-center gap-1.5 border ${
                showFavoritesOnly
                  ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-3xs shadow-rose-100/45 font-bold'
                  : 'bg-white border-sand-250 text-bark-500 hover:text-bark-900 hover:bg-sand-50'
              }`}
              type="button"
            >
              <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-current' : ''}`} />
              <span>Saved ({favorites.length})</span>
            </button>
          </Tooltip>
        </div>
      </div>

      {filteredPatterns.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-sand-300 flex flex-col items-center justify-center space-y-2">
          <AlertCircle className="w-7 h-7 text-bark-400" />
          <p className="text-xs font-semibold text-bark-900 font-serif">No showcased blueprints found matching the filters</p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedDifficulty('All'); setShowFavoritesOnly(false); }}
            className="px-3.5 py-1.5 bg-clay-600 hover:bg-clay-700 text-white rounded text-[10px] font-mono font-bold uppercase cursor-pointer transition-all"
            type="button"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          {/* Grid container with staggered scroll animations */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8"
            id="showcase-gallery-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-20px" }}
        >
          {paginatedPatterns.map((pattern) => {
            const isHovered = hoverEnabled && hoveredPatternId === pattern.id;
            const isFav = favorites.includes(pattern.id);
            const diff = getDifficultyDetails(pattern.difficulty);
            const DiffIcon = diff.icon;
            const isSelected = activePatternId === pattern.id;

            return (
              <motion.div
                key={pattern.id}
                variants={itemVariants}
                onMouseEnter={() => setHoveredPatternId(pattern.id)}
                onMouseLeave={() => setHoveredPatternId(null)}
                onClick={() => onSelect(pattern.id)}
                className={`relative aspect-[3/4.2] rounded-[4px] border overflow-hidden cursor-pointer shadow-lux group/gallery-card transition-all duration-300 ${
                  isSelected
                    ? 'border-[#ba6446] ring-2 ring-[#ba6446]/10 scale-[1.01]'
                    : 'border-sand-200 hover:border-[#ba6446]/40 hover:scale-[1.005]'
                }`}
                id={`showcase-card-${pattern.id}`}
              >
                {/* Background Cover Image */}
                <img
                  src={pattern.image}
                  alt={pattern.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover/gallery-card:scale-105"
                  referrerPolicy="no-referrer"
                  id={`showcase-img-${pattern.id}`}
                />

                {/* Top Row Indicators: Difficulty, Quick View, and Favorite (Always Visible & Clickable) */}
                <div className="absolute top-4 inset-x-4 flex items-center justify-between z-40 pointer-events-none">
                  <div className="flex gap-2 items-center">
                    {/* Difficulty pill with description tooltip */}
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-[4px] border text-[8px] font-mono font-bold uppercase tracking-wider backdrop-blur-md shadow-3xs transition-opacity duration-300 ${
                      isHovered ? 'opacity-0 pointer-events-none' : 'opacity-100 bg-white/90 border-sand-200/60 text-bark-800'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${diff.dotClass}`} />
                      {pattern.difficulty}
                    </span>

                    {/* Quick View Button wrapped in custom descriptive tooltip */}
                    <div className={isHovered ? 'opacity-0 pointer-events-none' : 'opacity-100 transition-opacity duration-300'}>
                      <Tooltip content="Instantly overlay technical drawings, size keys, and active user reviews." position="bottom">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickView(pattern);
                          }}
                          className="pointer-events-auto flex items-center gap-1 bg-[#FAF8F5]/95 border border-sand-200/80 text-bark-900 hover:bg-[#ba6446] hover:text-white hover:border-[#ba6446] px-2.5 py-1.5 rounded-[4px] text-[8.5px] font-mono font-bold uppercase tracking-wider shadow-3xs hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95"
                          id={`gallery-quickview-btn-${pattern.id}`}
                          title="Quick View Details"
                          type="button"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span>Quick View</span>
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Favorite Button wrapped in tooltip */}
                  <div className={isHovered ? 'opacity-0 pointer-events-none' : 'opacity-100 transition-opacity duration-300'}>
                    <Tooltip content={isFav ? "Remove this design from your saved collection." : "Save this sewing pattern to your private wishlist."} position="bottom">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(pattern.id);
                        }}
                        className="pointer-events-auto p-2 rounded-full backdrop-blur-md shadow-3xs transition-all border hover:scale-110 active:scale-95 cursor-pointer bg-white/75 border-sand-200/50 text-bark-450 hover:text-rose-500 hover:bg-rose-50/50"
                        id={`showcase-fav-${pattern.id}`}
                        title={isFav ? "Remove from Wishlist" : "Save to Wishlist"}
                        type="button"
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current text-rose-500 animate-pulse' : ''}`} />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                {/* Bottom Badge: Name, Category, and Price Tag (Hidden on Hover) */}
                <div className={`absolute bottom-4 inset-x-4 bg-white/95 backdrop-blur-md border border-sand-200/80 p-3 rounded-[3px] shadow-md transition-all duration-300 z-10 flex flex-col ${
                  isHovered ? 'opacity-0 translate-y-2 pointer-events-none' : 'opacity-100'
                }`}>
                  <span className="text-[7.5px] font-mono tracking-widest text-[#ba6446] font-bold uppercase">
                    {pattern.category}
                  </span>
                  <h4 className="font-serif text-bark-950 text-sm font-semibold tracking-tight truncate mt-0.5">
                    {pattern.name}
                  </h4>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-bark-550 font-sans border-t border-sand-100 pt-1.5">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-bark-400">PDF & Print Ready</span>
                    <span className="text-[#ba6446] font-bold font-serif">${(typeof pattern.pricePDF === 'number' && !isNaN(pattern.pricePDF) ? pattern.pricePDF : (pattern.price || 0)).toFixed(2)}</span>
                  </div>
                </div>

                {/* Hover-Reveal Overlay (Fades and Slides Up on Hover) */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 15 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="absolute inset-0 bg-gradient-to-t from-bark-950 via-bark-900/96 to-bark-900/88 backdrop-blur-xs p-5 flex flex-col justify-between z-30 select-none text-sand-50"
                    >
                      {/* Top part: Brand & Category */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <div className="leading-none">
                            <span className="font-serif italic text-xs font-bold text-white tracking-tight block">Perfect Fit</span>
                            <span className="text-[5.5px] font-mono tracking-[0.2em] text-sand-400 font-bold uppercase mt-0.5 block">Bureau</span>
                          </div>
                          <span className="text-[8px] font-mono uppercase bg-white/10 border border-white/15 px-2 py-0.5 rounded text-sand-300">
                            {pattern.category}
                          </span>
                        </div>

                        {/* Name & Tagline */}
                        <div className="space-y-1">
                          <h3 className="font-serif text-lg font-light tracking-tight text-white leading-tight">
                            {pattern.name}
                          </h3>
                          <p className="text-[10px] text-[#e0a894] font-medium leading-relaxed font-sans italic">
                            "{pattern.tagline || 'Modern elegance in flowing silhouette'}"
                          </p>
                          <p className="text-[9.5px] text-sand-300 leading-normal font-sans line-clamp-2 pt-1 border-t border-white/5 mt-1">
                            {pattern.description || 'A timeless addition to any handmade wardrobe.'}
                          </p>
                        </div>

                        {/* Difficulty Detail Badge */}
                        <div className={`p-2 rounded border flex flex-col gap-1 bg-white/5 border-white/10`}>
                          <div className="flex items-center gap-1.5">
                            <DiffIcon className="w-3.5 h-3.5" style={{ color: diff.accentColor }} />
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-white">
                              {diff.label}
                            </span>
                          </div>
                          <p className="text-[9.5px] text-sand-300 leading-normal font-sans">
                            {diff.description}
                          </p>
                        </div>

                        {/* Specifications Preview with Custom Tooltips */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-t border-white/10 pt-2 text-sand-400">
                          <Tooltip content="Tailored recommendation for fabric fibers matching this pattern's draping parameters." position="top">
                            <div className="space-y-0.5 cursor-help">
                              <span className="block text-[8px] uppercase tracking-wider font-semibold text-white/40">Fabric Sug.</span>
                              <span className="block text-sand-200 truncate font-sans text-[9.5px]">
                                {pattern.fabricSuggestions?.[0] || 'Linen'}
                              </span>
                            </div>
                          </Tooltip>

                          <Tooltip content="Comprehensive sizing chart. Size adjustments and layers are built directly into standard digital sheets." position="top">
                            <div className="space-y-0.5 cursor-help">
                              <span className="block text-[8px] uppercase tracking-wider font-semibold text-white/40">Size Range</span>
                              <span className="block text-sand-200 font-sans text-[9.5px]">Sizes 0 – 22</span>
                            </div>
                          </Tooltip>
                        </div>
                      </div>

                      {/* Bottom Action buttons */}
                      <div className="space-y-2.5 pt-3 border-t border-white/10">
                        {/* Price Tag line */}
                        <div className="flex items-center justify-between text-xs font-mono text-sand-300">
                          <span>Blueprint:</span>
                          <span className="text-[#e0a894] text-sm font-bold font-serif">${(typeof pattern.pricePDF === 'number' && !isNaN(pattern.pricePDF) ? pattern.pricePDF : (pattern.price || 0)).toFixed(2)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {/* Product Details / Select */}
                          <Tooltip content="Explore high-fidelity sizing tables, interactive swatch customizers, and print guides." position="top">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelect(pattern.id);
                              }}
                              className="bg-white/10 hover:bg-white/15 border border-white/15 text-white py-1.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer w-full"
                              type="button"
                              title="View Product Details"
                            >
                              <Compass className="w-3 h-3" />
                              <span>Details</span>
                            </button>
                          </Tooltip>

                          {/* Quick Purchase PDF */}
                          <Tooltip content="Instantly purchase and download the standard multi-size high-resolution PDF." position="top">
                            <button
                              onClick={(e) => handleQuickAdd(e, pattern)}
                              disabled={addingToCartId === pattern.id}
                              className="bg-[#ba6446] hover:bg-[#a25135] text-white py-1.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs w-full"
                              type="button"
                              title="Quick Add PDF to Queue"
                            >
                              {addingToCartId === pattern.id ? (
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <ShoppingCart className="w-3 h-3" />
                                  <span>Add PDF</span>
                                </>
                              )}
                            </button>
                          </Tooltip>
                        </div>

                        {/* Explore Interactive Specs option */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(pattern.id);
                          }}
                          className="w-full text-center text-[9px] font-mono uppercase tracking-widest text-sand-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1 pt-1 font-semibold"
                          type="button"
                        >
                          <span>Inspect Interactive Specs</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            );
          })}
        </motion.div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-sand-200/80 gap-4" id="showcase-pagination-controls">
            <span className="text-[11px] font-mono text-bark-500">
              Showing <span className="font-bold text-bark-800">{(currentPage - 1) * itemsPerPage + 1}</span>–<span className="font-bold text-bark-800">{Math.min(filteredPatterns.length, currentPage * itemsPerPage)}</span> of <span className="font-bold text-bark-800">{filteredPatterns.length}</span> luxury blueprints
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-sand-250 bg-white hover:bg-[#FAF8F5] disabled:opacity-40 transition-all cursor-pointer text-bark-600 disabled:cursor-not-allowed"
                title="First Page"
                type="button"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-sand-250 bg-white hover:bg-[#FAF8F5] disabled:opacity-40 transition-all cursor-pointer text-bark-600 disabled:cursor-not-allowed"
                title="Previous Page"
                type="button"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="text-[11px] font-mono font-bold px-3 py-1 bg-[#FAF8F5] rounded border border-sand-250 text-bark-800">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded border border-sand-250 bg-white hover:bg-[#FAF8F5] disabled:opacity-40 transition-all cursor-pointer text-bark-600 disabled:cursor-not-allowed"
                title="Next Page"
                type="button"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded border border-sand-250 bg-white hover:bg-[#FAF8F5] disabled:opacity-40 transition-all cursor-pointer text-bark-600 disabled:cursor-not-allowed"
                title="Last Page"
                type="button"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
