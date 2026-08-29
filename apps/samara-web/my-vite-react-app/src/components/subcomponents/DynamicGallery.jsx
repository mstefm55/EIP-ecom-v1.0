import { runtimeDataStorage } from '../../lib/runtimeDataGateway';
import { clientPreferences, clientSession } from '../../lib/clientPreferences';
import React, { useState, useMemo, useEffect } from 'react';
import { translatePerfectFitText as pfUiT } from '../../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Scissors, Clock, Layers, Star, Compass, Tag, Heart,
  Info, Sparkles, Calculator, ChevronRight, CheckSquare, Printer,
  Download, Maximize2, FileText, X, AlertCircle, RefreshCw, ShoppingBag,
  LayoutGrid, Eye, ChevronLeft, ChevronsLeft, ChevronsRight, Mail, Check
} from 'lucide-react';
import { UI_LAYERS } from '../../lib/uiLayers';

const SHOW_ATELIER_CRAFT_REGISTRY_INTRO = false;
const SHOW_CATALOGUE_HEADER_FILTER_BLOCK = false;
const SHOW_CATALOGUE_VIEW_MODE_TOGGLES = false;
const SHOW_CATALOGUE_INLINE_WISHLIST_FILTER = false;

const getStablePatternName = (pattern) => String(pattern?.name || '').trim();
const getStablePatternId = (pattern) => String(pattern?.id || pattern?.sku || pattern?.name || '').trim();
const getStablePatternPrice = (pattern) => Number(pattern?.price ?? pattern?.pricePDF ?? 0) || 0;
const getStablePatternRating = (pattern) => Number(pattern?.rating ?? 4.8) || 4.8;

const comparePatternsByName = (a, b) => {
  const byName = getStablePatternName(a).localeCompare(getStablePatternName(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  if (byName !== 0) return byName;
  return getStablePatternId(a).localeCompare(getStablePatternId(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
};

const comparePatternsByNumber = (primary, a, b) => primary || comparePatternsByName(a, b);

import PatternCard from '../PatternCard';

export default function DynamicGallery({
  patterns: passedPatterns,
  loading = false,
  error = null,
  catalogColumns = 4,
  onAddToCart,
  activeRecommendedSize,
  reviews = [],
  onAddReview,
  favorites: passedFavorites,
  onToggleFavorite,
  onQuickView,
  onExploreSwatches,
  viewMode: passedViewMode,
  onViewModeChange
}) {
  const [localViewMode, setLocalViewMode] = useState('grid');
  const viewMode = passedViewMode || localViewMode;
  const setViewMode = onViewModeChange || setLocalViewMode;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPriceRange, setSelectedPriceRange] = useState('All');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState('name'); // 'rating', 'time', 'name', 'difficulty-asc', 'difficulty-desc', 'newest', 'price-asc', 'price-desc'

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Interaction and Newsletter Modal states
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);
  const [newsletterError, setNewsletterError] = useState('');
  const [newsletterPreferences, setNewsletterPreferences] = useState(['new-releases', 'tips']);

  // Check if already subscribed or dismissed
  const [newsletterModalDismissed, setNewsletterModalDismissed] = useState(() => {
    try {
      const dismissed = clientSession.getItem('perfectfit_newsletter_modal_dismissed') === 'true';
      const subscribed = clientPreferences.getItem('perfectfit_newsletter_modal_subscribed') === 'true';
      return dismissed || subscribed;
    } catch {
      return false;
    }
  });

  const recordInteraction = () => {
    if (newsletterModalDismissed) return;
    setInteractionCount(prev => {
      const next = prev + 1;
      if (next >= 4) {
        setShowNewsletterModal(true);
      }
      return next;
    });
  };

  // Track filter changes as interactions
  useEffect(() => {
    if (searchQuery || selectedDifficulty !== 'All' || selectedCategory !== 'All' || selectedPriceRange !== 'All' || sortBy !== 'name' || currentPage > 1 || showFavoritesOnly) {
      recordInteraction();
    }
  }, [searchQuery, selectedDifficulty, selectedCategory, selectedPriceRange, sortBy, currentPage, showFavoritesOnly]);

  const handleNewsletterTopicToggle = (topic) => {
    setNewsletterError('');
    setNewsletterPreferences(prev => {
      if (prev.includes(topic)) {
        if (prev.length === 1) {
          setNewsletterError('Please keep at least one subscription interest selected.');
          return prev;
        }
        return prev.filter(t => t !== topic);
      } else {
        return [...prev, topic];
      }
    });
  };

  const handleNewsletterDismiss = () => {
    setShowNewsletterModal(false);
    setNewsletterModalDismissed(true);
    try {
      clientSession.setItem('perfectfit_newsletter_modal_dismissed', 'true');
    } catch {}
  };

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    setNewsletterError('');

    if (!newsletterEmail || !newsletterEmail.includes('@')) {
      setNewsletterError('Please provide a valid email address.');
      return;
    }

    if (newsletterPreferences.length === 0) {
      setNewsletterError('Please select at least one inspiration topic.');
      return;
    }

    setNewsletterSubmitting(true);

    setTimeout(() => {
      try {
        const savedSubsStr = runtimeDataStorage.getItem('sartorial_newsletter_subscribers') || '[]';
        const savedSubs = JSON.parse(savedSubsStr);

        const trimmedEmail = newsletterEmail.trim();
        const nextSub = {
          email: trimmedEmail,
          topics: newsletterPreferences,
          timestamp: new Date().toISOString(),
          source: 'Gallery Interaction Modal'
        };

        const alreadyExists = savedSubs.some(
          (sub) => sub.email.toLowerCase() === trimmedEmail.toLowerCase()
        );

        if (!alreadyExists) {
          savedSubs.push(nextSub);
          runtimeDataStorage.setItem('sartorial_newsletter_subscribers', JSON.stringify(savedSubs));
        }

        clientPreferences.setItem('perfectfit_newsletter_modal_subscribed', 'true');
        setNewsletterModalDismissed(true);
        setNewsletterSuccess(true);
        setNewsletterEmail('');

        if (window.showToast) {
          window.showToast(
            `Successfully registered ${trimmedEmail} for our tailored pattern updates.`,
            'success',
            'Mailing Verified'
          );
        }
      } catch (err) {
        console.error("Local storage sync error", err);
        setNewsletterError('Could not register subscriber due to browser storage limits.');
      } finally {
        setNewsletterSubmitting(false);
      }
    }, 600);
  };

  // Reset page to 1 when filters or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDifficulty, selectedCategory, selectedPriceRange, showFavoritesOnly, sortBy, itemsPerPage]);

  const [localFavorites, setLocalFavorites] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_atelier_fav_patterns');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const favorites = passedFavorites || localFavorites;

  // Spec Sheet Dialog State
  const [activePattern, setActivePattern] = useState(null);

  // Custom Calculator State
  const [calcBust, setCalcBust] = useState('36');
  const [calcWaist, setCalcWaist] = useState('28');
  const [calcHips, setCalcHips] = useState('38');
  const [fabricWidth, setFabricWidth] = useState('60'); // '45' or '60' inches
  const [measuredSize, setMeasuredSize] = useState(null);
  const [showYardageCalc, setShowYardageCalc] = useState(false);
  const [materialsChecklist, setMaterialsChecklist] = useState({});

  const toggleFavorite = (e, id) => {
    if (e && e.stopPropagation) e.stopPropagation(); // Avoid triggering full card selection on fav toggle
    recordInteraction();
    if (onToggleFavorite) {
      onToggleFavorite(id);
    } else {
      setLocalFavorites(prev => {
        const updated = prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id];
        try {
          runtimeDataStorage.setItem('sartorial_atelier_fav_patterns', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }
  };

  const activePatterns = Array.isArray(passedPatterns) ? passedPatterns : [];

  // Filter and sort garments
  const filteredPatterns = useMemo(() => {
    return activePatterns.filter(pattern => {
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

      const matchesCategory = selectedCategory === 'All' ||
        (pattern.category === selectedCategory) ||
        (selectedCategory === 'Bottoms' && pattern.category === 'Bottoms') ||
        (selectedCategory === 'Bottoms' && pattern.category === 'Trousers');

      // Price calculation
      const price = pattern.price !== undefined ? pattern.price : (pattern.pricePDF || 0);
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
    }).sort((a, b) => {
      if (sortBy === 'rating') {
        return comparePatternsByNumber(getStablePatternRating(b) - getStablePatternRating(a), a, b);
      }
      if (sortBy === 'time') {
        const timeA = parseInt(a.time || a.duration || '0') || 0;
        const timeB = parseInt(b.time || b.duration || '0') || 0;
        return comparePatternsByNumber(timeB - timeA, a, b);
      }
      if (sortBy === 'name') return comparePatternsByName(a, b);
      if (sortBy === 'difficulty-asc' || sortBy === 'difficulty-desc') {
        const diffOrder = { 'Easy': 1, 'Beginner': 1, 'Intermediate': 2, 'Medium': 2, 'Advanced': 3 };
        const diffA = diffOrder[a.difficulty] || 2;
        const diffB = diffOrder[b.difficulty] || 2;
        const primary = sortBy === 'difficulty-asc' ? diffA - diffB : diffB - diffA;
        return comparePatternsByNumber(primary, a, b);
      }
      if (sortBy === 'newest') {
        const bDate = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        const aDate = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        return comparePatternsByNumber(bDate - aDate, a, b);
      }
      const priceA = getStablePatternPrice(a);
      const priceB = getStablePatternPrice(b);
      if (sortBy === 'price-asc') return comparePatternsByNumber(priceA - priceB, a, b);
      if (sortBy === 'price-desc') return comparePatternsByNumber(priceB - priceA, a, b);
      return comparePatternsByName(a, b);
    });
  }, [activePatterns, searchQuery, selectedDifficulty, selectedCategory, selectedPriceRange, showFavoritesOnly, favorites, sortBy]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredPatterns.length / itemsPerPage));
  }, [filteredPatterns, itemsPerPage]);

  const paginatedPatterns = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPatterns.slice(start, start + itemsPerPage);
  }, [filteredPatterns, currentPage, itemsPerPage]);

  // Categories extraction
  const categories = useMemo(() => {
    return ['All', ...new Set(activePatterns.map(p => p.category).filter(Boolean))];
  }, [activePatterns]);

  // Calculate recommended sizing based on standard tailoring grid
  const handleCalculateYardage = (pattern) => {
    if (!pattern) return;
    const b = parseFloat(calcBust) || 0;
    const w = parseFloat(calcWaist) || 0;
    const h = parseFloat(calcHips) || 0;

    let recommendedSize = 8;
    if (b > 44 || w > 36 || h > 46) recommendedSize = 16;
    else if (b > 41 || w > 33 || h > 43) recommendedSize = 14;
    else if (b > 38 || w > 30 || h > 40) recommendedSize = 12;
    else if (b > 35 || w > 27 || h > 37) recommendedSize = 10;
    else if (b > 32 || w > 24 || h > 34) recommendedSize = 8;
    else recommendedSize = 6;

    // Custom scaling factor based on size
    const yardage60Val = pattern.yardage60 || (pattern.yardageInfo && pattern.yardageInfo.width60) || '2.5';
    const yardage45Val = pattern.yardage45 || (pattern.yardageInfo && pattern.yardageInfo.width45) || '3.2';
    const baseYardage = fabricWidth === '60' ? parseFloat(yardage60Val) || 2.5 : parseFloat(yardage45Val) || 3.2;
    const scaleFactor = 1 + (recommendedSize - 8) * 0.05; // 5% increase per size above base 8
    const calculatedYards = (baseYardage * scaleFactor).toFixed(1);

    setMeasuredSize({
      size: recommendedSize,
      yards: calculatedYards
    });
    setShowYardageCalc(true);

    // Seed default materials checklist for this pattern
    const items = {};
    const fabricStr = pattern.fabric || (Array.isArray(pattern.fabricSuggestions) ? pattern.fabricSuggestions[0] : '') || 'Linen';
    const splitFabric = typeof fabricStr === 'string' ? fabricStr.split('with')[0].trim() : String(fabricStr);
    items['Fabric: ' + splitFabric] = false;
    if (typeof fabricStr === 'string' && fabricStr.toLowerCase().includes('lining')) {
      items['Lining fabric'] = false;
    }
    const notionsStr = pattern.notions || 'Thread, Needle';
    if (typeof notionsStr === 'string') {
      notionsStr.split(',').forEach(notion => {
        items[notion.trim()] = false;
      });
    }
    setMaterialsChecklist(items);
  };

  const toggleChecklistItem = (item) => {
    setMaterialsChecklist(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  return (
    <div className="space-y-6" id="dynamic-gallery-subcomponent">
      {/* Header and Filter Controls */}
      <div className="bg-[#FAF8F5] border border-sand-200/80 rounded-xl p-4 space-y-4" id="gallery-controls-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {SHOW_ATELIER_CRAFT_REGISTRY_INTRO && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Compass className="w-4.5 h-4.5 text-clay-600 animate-spin-slow" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-clay-700 font-bold">{pfUiT("ui.components.subcomponents.dynamicgallery.2825e98573")}</span>
            </div>
            <h3 className="text-2xl font-serif font-light text-bark-950">{pfUiT("ui.components.subcomponents.dynamicgallery.2b3e914635")}</h3>
            <p className="text-xs text-bark-600 font-sans max-w-xl">{pfUiT("ui.components.subcomponents.dynamicgallery.ff5b50ce57")}</p>
          </div>
          )}
          <div className="flex items-center gap-2 text-xs font-mono text-bark-500">
            <span>Showing {filteredPatterns.length} of {activePatterns.length} drafts</span>
            {(selectedDifficulty !== 'All' || selectedCategory !== 'All' || selectedPriceRange !== 'All' || searchQuery !== '') && (
              <button
                onClick={() => {
                  setSelectedDifficulty('All');
                  setSelectedCategory('All');
                  setSelectedPriceRange('All');
                  setSearchQuery('');
                }}
                className="ml-2 text-[9px] font-mono font-bold text-clay-700 hover:text-clay-900 uppercase underline transition-colors cursor-pointer"
              >{pfUiT("ui.components.subcomponents.dynamicgallery.efaaaca85a")}</button>
            )}
          </div>
        </div>

        {/* Premium Multi-Filter Panel (Difficulty Level, Style, Price Range) */}
        {SHOW_CATALOGUE_HEADER_FILTER_BLOCK && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-sand-50/50 p-4 border border-sand-200/60 rounded-xl">
          {/* Difficulty / Grade Filter */}
          <div className="space-y-1.5">
            <label className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-500 block">{pfUiT("ui.components.subcomponents.dynamicgallery.979cc3a7cb")}</label>
            <div className="flex flex-wrap bg-sand-100/65 p-1 rounded-lg border border-sand-200/60 gap-0.5">
              {['All', 'Easy', 'Medium', 'Advanced'].map(diff => (
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
              ))}
            </div>
          </div>

          {/* Style / Category Filter */}
          <div className="space-y-1.5">
            <label className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-500 block">{pfUiT("ui.components.subcomponents.dynamicgallery.075b4bc011")}</label>
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
            <label className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-500 block">{pfUiT("ui.components.subcomponents.dynamicgallery.f1e466628c")}</label>
            <div className="flex flex-wrap bg-sand-100/65 p-1 rounded-lg border border-sand-200/60 gap-0.5">
              {[
                { id: 'All', label: pfUiT('ui.gallery.priceRanges.all', {}, 'All') },
                { id: 'under-15', label: pfUiT('ui.gallery.priceRanges.under15', {}, 'Under $15') },
                { id: '15-20', label: '$15 - $20' },
                { id: 'over-20', label: pfUiT('ui.gallery.priceRanges.over20', {}, 'Over $20') }
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
        )}

        {/* Search, Sort and Layout row - positioned below premium filter panel */}
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-4 pt-2 border-t border-sand-200/40">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-bark-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={pfUiT("ui.components.subcomponents.dynamicgallery.cd79376659")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 w-full font-sans transition-all"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono uppercase text-bark-500">{pfUiT("ui.components.subcomponents.dynamicgallery.4a0788d8ff")}</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-sand-250 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold text-bark-750 focus:ring-1 focus:ring-clay-500 cursor-pointer"
              >
                <option value="rating">{pfUiT("ui.components.subcomponents.dynamicgallery.ddbbabb3bf")}</option>
                <option value="difficulty-asc">{pfUiT("ui.components.subcomponents.dynamicgallery.00e571bd05")}</option>
                <option value="difficulty-desc">{pfUiT("ui.components.subcomponents.dynamicgallery.a6c5d7fea8")}</option>
                <option value="newest">{pfUiT("ui.components.subcomponents.dynamicgallery.9de082caef")}</option>
                <option value="price-asc">{pfUiT("ui.components.subcomponents.dynamicgallery.8081145bb8")}</option>
                <option value="price-desc">{pfUiT("ui.components.subcomponents.dynamicgallery.b27fa98707")}</option>
                <option value="time">{pfUiT("ui.components.subcomponents.dynamicgallery.dfa34619b6")}</option>
                <option value="name">{pfUiT("ui.components.subcomponents.dynamicgallery.1f851fadb8")}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-auto">
            {SHOW_CATALOGUE_INLINE_WISHLIST_FILTER && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9.5px] font-mono uppercase text-bark-500 shrink-0">{pfUiT("ui.components.subcomponents.dynamicgallery.9caebcd0ca")}</span>
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase rounded transition-all cursor-pointer flex items-center gap-1.5 border ${
                  showFavoritesOnly
                    ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-3xs shadow-rose-100/40'
                    : 'bg-sand-100 border-sand-200/80 text-bark-500 hover:text-bark-900 hover:bg-sand-150'
                }`}
                title={pfUiT("ui.components.subcomponents.dynamicgallery.2848f09453")}
                type="button"
              >
                <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                <span>{showFavoritesOnly ? 'Saved Only' : 'All Designs'}</span>
                {favorites.length > 0 && (
                  <span className={`ml-1 px-1.5 py-0.25 text-[8px] rounded-full font-mono font-bold ${
                    showFavoritesOnly ? 'bg-rose-600 text-white' : 'bg-bark-200 text-bark-700'
                  }`}>
                    {favorites.length}
                  </span>
                )}
              </button>
            </div>
            )}

            {/* Layout Toggle Controls */}
            {SHOW_CATALOGUE_VIEW_MODE_TOGGLES && (
            <div className="flex items-center bg-sand-100 p-0.5 rounded-lg border border-sand-200/60 shrink-0" id="gallery-layout-view-toggle">
              <button
                onClick={() => setViewMode('showcase')}
                className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === 'showcase'
                    ? 'bg-white text-[#ba6446] shadow-3xs'
                    : 'text-bark-500 hover:text-bark-900'
                }`}
                title={pfUiT("ui.components.subcomponents.dynamicgallery.7b10e1635d")}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{pfUiT("ui.components.subcomponents.dynamicgallery.ae20f3d939")}</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === 'grid'
                    ? 'bg-white text-bark-800 shadow-3xs'
                    : 'text-bark-500 hover:text-bark-900'
                }`}
                title={pfUiT("ui.components.subcomponents.dynamicgallery.b05f502abf")}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{pfUiT("ui.components.subcomponents.dynamicgallery.9b4b669b78")}</span>
              </button>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-sand-300">
          <RefreshCw className="w-8 h-8 text-bark-400 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-bark-900 font-serif">{pfUiT("ui.components.subcomponents.dynamicgallery.runtime.loading")}</p>
        </div>
      ) : error ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-red-300">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-bark-900 font-serif">{pfUiT("ui.components.subcomponents.dynamicgallery.runtime.error")}</p>
          <p className="text-xs text-bark-500 mt-1">{pfUiT("ui.components.subcomponents.dynamicgallery.runtime.errorHelp")}</p>
        </div>
      ) : filteredPatterns.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-sand-300 flex flex-col items-center justify-center space-y-3">
          <AlertCircle className="w-8 h-8 text-bark-400" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-bark-900 font-serif">{pfUiT("ui.components.subcomponents.dynamicgallery.runtime.empty")}</p>
            <p className="text-xs text-bark-500 max-w-sm">{pfUiT("ui.components.subcomponents.dynamicgallery.runtime.emptyHelp")}</p>
          </div>
          <button
            onClick={() => { setSearchQuery(''); setSelectedDifficulty('All'); setSelectedCategory('All'); }}
            className="px-3.5 py-1.5 bg-clay-600 hover:bg-clay-700 text-white rounded-lg text-xs font-mono font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />{pfUiT("ui.components.subcomponents.dynamicgallery.f443521167")}</button>
        </div>
      ) : (
        <div className="space-y-6">
          <div
            className={`grid grid-flow-row auto-rows-fr grid-cols-1 sm:grid-cols-2 ${
              catalogColumns === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'
            } gap-6 items-stretch justify-items-stretch`}
            id="sewing-patterns-masonry"
            data-layout="strict-grid"
          >
            {paginatedPatterns.map((pattern, index) => (
              <div
                key={pattern.id}
                className="h-full min-w-0"
                style={{ order: index }}
              >
                <PatternCard
                  viewMode={viewMode}
                  pattern={pattern}
                  onAddToCart={onAddToCart}
                  activeRecommendedSize={activeRecommendedSize}
                  reviews={reviews}
                  onAddReview={onAddReview}
                  isFavorite={favorites.includes(pattern.id)}
                  onToggleFavorite={() => toggleFavorite(null, pattern.id)}
                  onExploreSwatches={(e) => {
                    recordInteraction();
                    if (onExploreSwatches) onExploreSwatches(pattern);
                  }}
                  onQuickView={() => {
                    recordInteraction();
                    if (onQuickView) {
                      onQuickView(pattern);
                    } else {
                      setActivePattern(pattern);
                      setShowYardageCalc(false);
                      setMeasuredSize(null);
                      handleCalculateYardage(pattern);
                    }
                  }}
                  onSelect={() => {
                    recordInteraction();
                    if (onQuickView) {
                      onQuickView(pattern);
                    } else {
                      setActivePattern(pattern);
                      setShowYardageCalc(false);
                      setMeasuredSize(null);
                      handleCalculateYardage(pattern);
                    }
                  }}
                />
              </div>
            ))}
          </div>

          {/* Dynamic Gallery Pagination Controls */}
          {filteredPatterns.length > 0 && (
            <div className="bg-[#FAF8F5] border border-sand-200/80 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 text-xs font-sans text-bark-800" id="gallery-pagination-section">
              {/* Results indicator & Items Per Page Selector */}
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-[11px] font-mono text-bark-500">{pfUiT("ui.components.subcomponents.dynamicgallery.ece49c40d0")}<strong className="text-bark-900">{(currentPage - 1) * itemsPerPage + 1}</strong>–<strong className="text-bark-900">{Math.min(filteredPatterns.length, currentPage * itemsPerPage)}</strong>{pfUiT("ui.components.subcomponents.dynamicgallery.07165bd0b9")}<strong className="text-bark-900">{filteredPatterns.length}</strong>{pfUiT("ui.components.subcomponents.dynamicgallery.5c116e96b7")}</span>

                <div className="flex items-center gap-1.5 border-l border-sand-250 pl-4">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-bark-450 font-bold">{pfUiT("ui.components.subcomponents.dynamicgallery.6116b818df")}</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="bg-white text-bark-800 border border-sand-250 font-bold font-mono rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-clay-500 cursor-pointer"
                    id="items-per-page-select"
                  >
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                    <option value={24}>24</option>
                    <option value={48}>48</option>
                    <option value={96}>96</option>
                  </select>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-lg border border-sand-250 bg-white text-bark-700 flex items-center justify-center transition-all cursor-pointer ${
                    currentPage === 1
                      ? 'opacity-35 pointer-events-none'
                      : 'hover:bg-sand-50 active:scale-95 shadow-4xs'
                  }`}
                  title={pfUiT("ui.components.subcomponents.dynamicgallery.edd650a7f2")}
                  id="pagination-first-page-btn"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-lg border border-sand-250 bg-white text-bark-700 flex items-center justify-center transition-all cursor-pointer ${
                    currentPage === 1
                  ? 'opacity-35 pointer-events-none'
                  : 'hover:bg-sand-50 active:scale-95 shadow-4xs'
                  }`}
                  title={pfUiT("ui.components.subcomponents.dynamicgallery.c48918c42e")}
                  id="pagination-prev-page-btn"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-xs font-bold font-mono bg-white border border-sand-200 px-3.5 py-1.5 rounded-lg text-bark-900 shadow-4xs">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-lg border border-sand-250 bg-white text-bark-700 flex items-center justify-center transition-all cursor-pointer ${
                    currentPage === totalPages
                      ? 'opacity-35 pointer-events-none'
                      : 'hover:bg-sand-50 active:scale-95 shadow-4xs'
                  }`}
                  title={pfUiT("ui.components.subcomponents.dynamicgallery.7c3c97d2d8")}
                  id="pagination-next-page-btn"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-lg border border-sand-250 bg-white text-bark-700 flex items-center justify-center transition-all cursor-pointer ${
                    currentPage === totalPages
                      ? 'opacity-35 pointer-events-none'
                      : 'hover:bg-sand-50 active:scale-95 shadow-4xs'
                  }`}
                  title={pfUiT("ui.components.subcomponents.dynamicgallery.7dbc925881")}
                  id="pagination-last-page-btn"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SARTORIAL BLUEPRINT & SPEC SHEET DIALOG (MODAL) */}
      <AnimatePresence>
        {activePattern && (
          <div
            className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
            style={{ zIndex: UI_LAYERS.modalBackdrop }}
            id="blueprint-spec-dialog"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="bg-white border border-sand-300 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
              style={{ zIndex: UI_LAYERS.modal }}
            >

              {/* Left Column: Visual Image & Interactive Blueprint Maker */}
              <div className="md:w-1/2 bg-stone-950 text-stone-200 p-6 flex flex-col justify-between space-y-6 overflow-y-auto border-r border-sand-200">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono tracking-widest text-clay-400 uppercase font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-clay-400 shrink-0" /> Garment Cutting Layout (1:10 Scale)
                    </span>
                    <span className="text-[10px] font-mono bg-stone-800 text-stone-300 px-2 py-0.5 rounded">{pfUiT("ui.components.subcomponents.dynamicgallery.19abfef504")}</span>
                  </div>

                  <h4 className="text-lg font-serif font-medium text-white">{activePattern.name} Cutting Guide</h4>
                  <p className="text-xs text-stone-400 leading-relaxed">{pfUiT("ui.components.subcomponents.dynamicgallery.aaab530880")}</p>
                </div>

                {/* Fabric Bolt Virtual Canvas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                    <span>{pfUiT("ui.components.subcomponents.dynamicgallery.8889b55aaa")}<strong className="text-white">{fabricWidth === '60' ? '60"' : '45"'} (Inches)</strong></span>
                    <span>{pfUiT("ui.components.subcomponents.dynamicgallery.77f48b68b9")}<strong className="text-white">{measuredSize?.yards || activePattern.yardage60} Yards</strong></span>
                  </div>

                  {/* Interactive Fabric roll preview */}
                  <div
                    className="relative bg-[#22211F] rounded-lg border-2 border-dashed border-stone-700 overflow-hidden flex items-center justify-center"
                    style={{ height: fabricWidth === '60' ? '180px' : '220px', transition: 'height 0.3s ease-in-out' }}
                  >
                    {/* Fabric grainlines */}
                    <div className="absolute inset-y-0 left-0 w-full flex justify-between pointer-events-none opacity-[0.03]">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} className="h-full w-[1px] bg-white border-dashed"></div>
                      ))}
                    </div>

                    <div className="absolute top-2 left-2 text-[8px] font-mono bg-clay-700/80 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{pfUiT("ui.components.subcomponents.dynamicgallery.8c2e712270")}</div>

                    {/* Render pattern pieces */}
                    {(activePattern.pieces || [
                      { name: 'Front Bodice', width: '80px', height: '110px', x: '10%', y: '15%', color: 'bg-[#ba6446]/10 border-[#ba6446]/40 text-stone-200' },
                      { name: 'Back Bodice', width: '80px', height: '110px', x: '40%', y: '15%', color: 'bg-amber-500/10 border-amber-500/40 text-stone-200' },
                      { name: 'Sleeve Layout', width: '70px', height: '80px', x: '70%', y: '25%', color: 'bg-emerald-500/10 border-emerald-500/40 text-stone-200' }
                    ]).map((piece, i) => (
                      <div
                        key={i}
                        className={`absolute rounded-md border text-center flex flex-col items-center justify-center p-1 cursor-default shadow-sm hover:brightness-105 transition-all ${piece.color || 'bg-[#ba6446]/10 border-[#ba6446]/40 text-stone-200'}`}
                        style={{
                          width: piece.width || '60px',
                          height: piece.height || '60px',
                          left: piece.x || '10%',
                          top: piece.y || '10%',
                        }}
                      >
                        <span className="text-[9.5px] font-bold font-mono uppercase tracking-tight block truncate max-w-full leading-none">
                          {piece.name}
                        </span>
                        <span className="text-[7.5px] font-mono font-medium opacity-80 mt-0.5">{pfUiT("ui.components.subcomponents.dynamicgallery.bfbd058947")}</span>
                      </div>
                    ))}

                    <div className="absolute bottom-2 right-2 text-[8px] font-mono bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded">{pfUiT("ui.components.subcomponents.dynamicgallery.93664d3698")}</div>
                  </div>

                  <div className="flex items-center gap-3 justify-center pt-2">
                    <span className="text-[10px] font-mono text-stone-400">{pfUiT("ui.components.subcomponents.dynamicgallery.aa0bff52d2")}</span>
                    <button
                      onClick={() => { setFabricWidth('60'); setTimeout(() => handleCalculateYardage(activePattern), 50); }}
                      className={`px-3 py-1 text-[9px] font-bold font-mono uppercase rounded transition-all cursor-pointer border ${
                        fabricWidth === '60'
                          ? 'bg-clay-600 text-white border-clay-500 shadow-sm'
                          : 'bg-stone-800 text-stone-300 border-stone-700'
                      }`}
                    >{pfUiT("ui.components.subcomponents.dynamicgallery.b7a4d45de4")}</button>
                    <button
                      onClick={() => { setFabricWidth('45'); setTimeout(() => handleCalculateYardage(activePattern), 50); }}
                      className={`px-3 py-1 text-[9px] font-bold font-mono uppercase rounded transition-all cursor-pointer border ${
                        fabricWidth === '45'
                          ? 'bg-clay-600 text-white border-clay-500 shadow-sm'
                          : 'bg-stone-800 text-stone-300 border-stone-700'
                      }`}
                    >{pfUiT("ui.components.subcomponents.dynamicgallery.f6eb3f5479")}</button>
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                    <span>{pfUiT("ui.components.subcomponents.dynamicgallery.75efcfe533")}<strong>{activePattern.rating}</strong> ({activePattern.reviews} reviews)</span>
                  </div>
                  <span className="font-mono text-[10px]">Atelier ID: {activePattern.id.toUpperCase()}</span>
                </div>
              </div>

              {/* Right Column: Tailoring Specs, Calculator, and Checklist */}
              <div className="md:w-1/2 bg-white p-6 md:p-8 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6">
                  {/* Close and Title Row */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-mono uppercase bg-clay-50 text-clay-700 px-2 py-0.5 rounded border border-clay-200/50 font-bold">
                        {activePattern.category} Drafting Spec
                      </span>
                      <h3 className="text-xl font-serif font-medium text-bark-950 mt-1">{activePattern.name}</h3>
                    </div>
                    <button
                      onClick={() => setActivePattern(null)}
                      className="w-7 h-7 rounded-full bg-sand-100 hover:bg-sand-200 text-bark-600 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Spec blocks */}
                  <div className="space-y-3">
                    <div className="bg-[#FAF8F5] p-3 rounded-xl border border-sand-200/50 space-y-1">
                      <span className="text-[9px] font-mono uppercase text-clay-700 tracking-wider font-bold block">{pfUiT("ui.components.subcomponents.dynamicgallery.83ff1a51b3")}</span>
                      <p className="text-xs text-bark-800 font-sans leading-relaxed">
                        {activePattern.difficultyDetail}
                      </p>
                    </div>

                    <div className="bg-[#FAF8F5] p-3 rounded-xl border border-sand-200/50 space-y-1">
                      <span className="text-[9px] font-mono uppercase text-clay-700 tracking-wider font-bold block">{pfUiT("ui.components.subcomponents.dynamicgallery.4e39138e51")}</span>
                      <p className="text-xs text-bark-800 font-sans leading-relaxed">
                        {activePattern.fabric}
                      </p>
                    </div>
                  </div>

                  {/* Sizing Measurement Calculator */}
                  <div className="space-y-3 border-t border-sand-150 pt-4">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-clay-600" />
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-bark-900">{pfUiT("ui.components.subcomponents.dynamicgallery.93f01492e6")}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[9.5px] font-mono text-bark-500 uppercase block mb-1">Bust (In)</label>
                        <input
                          type="number"
                          value={calcBust}
                          onChange={(e) => { setCalcBust(e.target.value); setTimeout(() => handleCalculateYardage(activePattern), 50); }}
                          className="w-full bg-white border border-sand-250 p-1.5 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-clay-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9.5px] font-mono text-bark-500 uppercase block mb-1">Waist (In)</label>
                        <input
                          type="number"
                          value={calcWaist}
                          onChange={(e) => { setCalcWaist(e.target.value); setTimeout(() => handleCalculateYardage(activePattern), 50); }}
                          className="w-full bg-white border border-sand-250 p-1.5 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-clay-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9.5px] font-mono text-bark-500 uppercase block mb-1">Hips (In)</label>
                        <input
                          type="number"
                          value={calcHips}
                          onChange={(e) => { setCalcHips(e.target.value); setTimeout(() => handleCalculateYardage(activePattern), 50); }}
                          className="w-full bg-white border border-sand-250 p-1.5 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-clay-500"
                        />
                      </div>
                    </div>

                    {showYardageCalc && measuredSize && (
                      <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs animate-fadeIn">
                        <div className="space-y-0.5">
                          <span className="text-[9.5px] font-mono text-emerald-800 uppercase font-bold block">
                            Size Recommended: Size {measuredSize.size}
                          </span>
                          <p className="text-[11px] text-bark-650">{pfUiT("ui.components.subcomponents.dynamicgallery.6b150f63a1")}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-mono text-bark-500 uppercase block">{pfUiT("ui.components.subcomponents.dynamicgallery.f0b1c3496c")}</span>
                          <span className="text-sm font-bold font-mono text-emerald-950">{measuredSize.yards} Yards</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Materials & Notions Checklist */}
                  <div className="space-y-3 border-t border-sand-150 pt-4">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-clay-600" />
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-bark-900">{pfUiT("ui.components.subcomponents.dynamicgallery.b68076579a")}</span>
                    </div>

                    <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-2 border border-sand-100 p-2.5 rounded-lg bg-sand-50/20">
                      {Object.keys(materialsChecklist).map((item, index) => (
                        <label
                          key={index}
                          className="flex items-start gap-2.5 text-[11px] text-bark-750 cursor-pointer select-none py-0.5"
                        >
                          <input
                            type="checkbox"
                            checked={materialsChecklist[item]}
                            onChange={() => toggleChecklistItem(item)}
                            className="rounded border-sand-300 text-clay-605 focus:ring-clay-500 cursor-pointer mt-0.5"
                          />
                          <span className={materialsChecklist[item] ? 'line-through text-bark-400 font-sans' : 'font-sans'}>
                            {item}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Print and Download Actions */}
                <div className="pt-6 border-t border-sand-150 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4">
                  {onAddToCart && (
                    <button
                      onClick={() => {
                        onAddToCart(activePattern, 'digital');
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-mono font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    >
                      <ShoppingBag className="w-4 h-4" /> Add to Cart (${activePattern.price?.toFixed(2)})
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (window.showToast) {
                        window.showToast(`"${activePattern.name} - Size ${measuredSize?.size || 8} PDF Pattern" has been prepared with your 1:10 scale layout and instructions!`, 'success', 'Pattern Download Ready');
                      } else {
                        alert(`Mock Pattern Download: "${activePattern.name} - Size ${measuredSize?.size || 8} PDF Pattern" has been prepared! It includes your 1:10 scale cutting layout and step-by-step drafting sequence instructions.`);
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-clay-600 hover:bg-clay-700 text-white rounded-lg text-xs font-mono font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                  >
                    <Download className="w-4 h-4" />{pfUiT("ui.components.subcomponents.dynamicgallery.aca1f532fd")}</button>
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-2 border border-sand-250 hover:bg-sand-50 text-bark-700 rounded-lg text-xs font-mono font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    title={pfUiT("ui.components.subcomponents.dynamicgallery.76a1c4ff28")}
                  >
                    <Printer className="w-4 h-4" />{pfUiT("ui.components.subcomponents.dynamicgallery.ffa93a5d6a")}</button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GALLERY INTERACTION NEWSLETTER MODAL */}
      <AnimatePresence>
        {showNewsletterModal && (
          <div
            className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto"
            style={{ zIndex: UI_LAYERS.modalBackdrop }}
            id="gallery-newsletter-modal"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleNewsletterDismiss}
              className="fixed inset-0 bg-bark-950/40 backdrop-blur-xs cursor-pointer"
              style={{ zIndex: UI_LAYERS.modalBackdrop }}
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-[#FAF8F5] border border-sand-250 shadow-lux rounded-xl w-full max-w-md p-6 relative space-y-5 text-left pointer-events-auto"
              style={{ zIndex: UI_LAYERS.modal }}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={handleNewsletterDismiss}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-sand-100 text-bark-450 hover:text-bark-900 transition-colors cursor-pointer"
                aria-label={pfUiT("ui.components.subcomponents.dynamicgallery.90fa23040e")}
              >
                <X className="w-4 h-4" />
              </button>

              {!newsletterSuccess ? (
                <form onSubmit={handleNewsletterSubmit} className="space-y-4" id="gallery-newsletter-form">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-clay-50 border border-clay-100 flex items-center justify-center text-[#ba6446]">
                        <Scissors className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#ba6446] font-bold">{pfUiT("ui.components.subcomponents.dynamicgallery.7948dd9c95")}</span>
                    </div>
                    <h4 className="font-serif text-bark-950 font-semibold text-lg tracking-wide pt-1">{pfUiT("ui.components.subcomponents.dynamicgallery.8d282872b1")}</h4>
                    <p className="text-xs text-bark-600 leading-relaxed font-sans pt-0.5">{pfUiT("ui.components.subcomponents.dynamicgallery.74788ea294")}</p>
                  </div>

                  {/* Preferences selectors */}
                  <div className="space-y-2 pt-1">
                    <label className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-500 block">{pfUiT("ui.components.subcomponents.dynamicgallery.bba8a4f110")}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleNewsletterTopicToggle('new-releases')}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[10.5px] font-sans font-medium transition-all duration-300 cursor-pointer ${
                          newsletterPreferences.includes('new-releases')
                            ? 'bg-clay-50 border-[#ba6446] text-[#ba6446]'
                            : 'bg-white border-sand-250 text-bark-600 hover:border-sand-350'
                        }`}
                      >
                        <Compass className="w-3.5 h-3.5 shrink-0 text-[#ba6446]" />
                        <span className="truncate">{pfUiT("ui.components.subcomponents.dynamicgallery.f75e6373ac")}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleNewsletterTopicToggle('tips')}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[10.5px] font-sans font-medium transition-all duration-300 cursor-pointer ${
                          newsletterPreferences.includes('tips')
                            ? 'bg-clay-50 border-[#ba6446] text-[#ba6446]'
                            : 'bg-white border-sand-250 text-bark-600 hover:border-sand-350'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#ba6446]" />
                        <span className="truncate">{pfUiT("ui.components.subcomponents.dynamicgallery.ba6718d8e4")}</span>
                      </button>
                    </div>
                  </div>

                  {/* Email & Submit */}
                  <div className="space-y-1.5 pt-1">
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bark-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        placeholder={pfUiT("ui.components.subcomponents.dynamicgallery.391708fad4")}
                        value={newsletterEmail}
                        onChange={(e) => {
                          setNewsletterError('');
                          setNewsletterEmail(e.target.value);
                        }}
                        required
                        className="bg-white border border-sand-250 text-bark-900 text-xs pl-10 pr-32 py-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ba6446] focus:border-[#ba6446] w-full transition-colors font-sans"
                        id="newsletter-modal-email-input"
                      />
                      <button
                        type="submit"
                        disabled={newsletterSubmitting}
                        className="absolute right-1.5 top-1.5 bottom-1.5 bg-[#ba6446] hover:bg-[#a25135] text-white text-[11px] font-mono font-bold uppercase px-4 rounded-md transition-all cursor-pointer flex items-center justify-center disabled:opacity-50"
                      >
                        {newsletterSubmitting ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span>{pfUiT("ui.components.subcomponents.dynamicgallery.8bb9dd5b5a")}</span>
                        )}
                      </button>
                    </div>

                    {/* Validation warnings */}
                    {newsletterError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[10px] text-rose-600 flex items-center gap-1 font-sans font-medium"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{newsletterError}</span>
                      </motion.p>
                    )}
                  </div>

                  <p className="text-[10px] text-bark-450 leading-relaxed italic text-center pt-1 font-sans">{pfUiT("ui.components.subcomponents.dynamicgallery.f2c0e2ed66")}</p>
                </form>
              ) : (
                <div className="space-y-4 pt-1" id="gallery-newsletter-success">
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                      <Check className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 font-bold">{pfUiT("ui.components.subcomponents.dynamicgallery.fdda8ff3f7")}</span>
                    <h4 className="font-serif text-bark-950 font-semibold text-lg tracking-wide">{pfUiT("ui.components.subcomponents.dynamicgallery.a09dd61172")}</h4>
                    <p className="text-xs text-bark-600 leading-relaxed max-w-sm font-sans px-2">{pfUiT("ui.components.subcomponents.dynamicgallery.1fc1c3c512")}<span className="font-bold text-[#ba6446]">{pfUiT("ui.components.subcomponents.dynamicgallery.717cf3d3d0")}</span>{pfUiT("ui.components.subcomponents.dynamicgallery.c057fd76d7")}</p>
                  </div>

                  {/* Promo code card */}
                  <div className="bg-[#FAF6F0] border border-sand-200/80 rounded-xl p-3 flex flex-col items-center justify-center space-y-1.5">
                    <span className="text-[8px] font-mono text-bark-500 uppercase tracking-widest block font-bold">{pfUiT("ui.components.subcomponents.dynamicgallery.b9c11967fe")}</span>
                    <div className="flex items-center gap-2">
                      <b className="text-sm font-mono tracking-widest select-all bg-white px-3 py-1.5 rounded-lg border border-sand-250 text-bark-950 shadow-3xs">
                        ARTISAN15
                      </b>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText('ARTISAN15');
                          if (window.showToast) {
                            window.showToast("Promo code ARTISAN15 copied successfully!", "success", "Copied Code");
                          }
                        }}
                        className="p-1.5 hover:bg-sand-100 rounded-lg text-bark-550 hover:text-bark-900 transition-colors cursor-pointer text-xs font-mono font-bold uppercase flex items-center gap-1 border border-transparent hover:border-sand-200 bg-white shadow-3xs"
                      >{pfUiT("ui.components.subcomponents.dynamicgallery.2531eb968b")}</button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-sand-150 space-y-1 text-center">
                    <span className="text-[8px] font-mono text-[#ba6446] uppercase font-bold tracking-wider">{pfUiT("ui.components.subcomponents.dynamicgallery.9a970bfc67")}</span>
                    <p className="text-[10.5px] text-bark-600 leading-relaxed italic px-4 font-sans">{pfUiT("ui.components.subcomponents.dynamicgallery.71e3aec2b6")}</p>
                  </div>

                  <button
                    type="button"
                    onClick={handleNewsletterDismiss}
                    className="w-full py-2.5 bg-bark-900 hover:bg-bark-950 text-white text-xs font-mono font-bold uppercase rounded-lg transition-all shadow-3xs cursor-pointer text-center"
                  >{pfUiT("ui.components.subcomponents.dynamicgallery.5bb2e96e49")}</button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
