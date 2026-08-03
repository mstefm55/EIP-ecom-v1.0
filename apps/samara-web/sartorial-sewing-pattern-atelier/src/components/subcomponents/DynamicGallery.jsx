import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Scissors, Clock, Layers, Star, Compass, Tag, Heart,
  Info, Sparkles, Calculator, ChevronRight, CheckSquare, Printer,
  Download, Maximize2, FileText, X, AlertCircle, RefreshCw, ShoppingBag,
  LayoutGrid, Eye, ChevronLeft, ChevronsLeft, ChevronsRight, Mail, Check
} from 'lucide-react';

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

// Highly descriptive sewing pattern catalog with detailed specs
const SEWING_PATTERNS = [
  {
    id: 'pat-1',
    name: 'The French Draped Trench',
    category: 'Outerwear',
    difficulty: 'Advanced',
    time: '18 hours',
    yardage60: '3.5 Yards',
    yardage45: '4.4 Yards',
    fabric: 'Wool gabardine, cotton twill, or heavy canvas with a premium silk satin lining.',
    difficultyDetail: 'Couture tailoring. Features hand-pad stitched lapels, authentic welt pockets, and sleeve cap easing.',
    notions: '8x 24mm buttons, stay tape, 2 yards fusible weft insertion interfacing, shoulder pads.',
    rating: 4.9,
    reviews: 42,
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80',
    description: 'Double-breasted classic featuring authentic bias-bound interior seams, custom wind flaps, and a storm collar.',
    price: 24.99,
    releaseDate: '2026-05-10',
    pieces: [
      { name: 'Front Bodice', width: '30%', height: '70%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Back Bodice', width: '30%', height: '70%', x: '38%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Left Sleeve', width: '22%', height: '50%', x: '72%', y: '10%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Right Sleeve', width: '22%', height: '50%', x: '72%', y: '65%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Storm Flaps', width: '15%', height: '25%', x: '5%', y: '85%', color: 'bg-amber-100 border-amber-300 text-amber-700' },
      { name: 'Collar & Belts', width: '48%', height: '12%', x: '22%', y: '85%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' }
    ]
  },
  {
    id: 'pat-2',
    name: 'Zero-Waste Wrap Skirt',
    category: 'Bottoms',
    difficulty: 'Easy',
    time: '4 hours',
    yardage60: '1.2 Yards',
    yardage45: '1.6 Yards',
    fabric: 'Washed Belgian linen, cotton drill, hemp canvas, or light wool crepe.',
    difficultyDetail: 'Beginner-friendly. No zipper required; uses side self-ties and clean French seams.',
    notions: '1x heavy-duty hook & bar eye, 2.5 yards of 1/2" bias binding.',
    rating: 4.7,
    reviews: 68,
    image: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=600&q=80',
    description: 'A structural, adjustable wrap skirt engineered to consume 100% of fabric width with zero cut-off waste.',
    price: 14.99,
    releaseDate: '2026-06-20',
    pieces: [
      { name: 'Main Skirt Panel', width: '70%', height: '80%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Waistband Tie', width: '20%', height: '40%', x: '78%', y: '10%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
      { name: 'Facing Strip', width: '20%', height: '35%', x: '78%', y: '55%', color: 'bg-sand-100 border-sand-300 text-sand-700' }
    ]
  },
  {
    id: 'pat-3',
    name: 'Atelier Linen Smock',
    category: 'Tops',
    difficulty: 'Medium',
    time: '7 hours',
    yardage60: '2.0 Yards',
    yardage45: '2.5 Yards',
    fabric: 'Light to medium weight linen, cotton chambray, or raw ramie canvas.',
    difficultyDetail: 'Intermediate drafting. Includes sleeve plackets, flat-felled shoulder seams, and structured collar stands.',
    notions: '6x 12mm buttons, 0.5 yards lightweight sew-in woven interfacing.',
    rating: 4.8,
    reviews: 51,
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
    description: 'Relaxed utilitarian work blouse with oversized patch pockets and traditional continuous arm cuffs.',
    price: 18.99,
    releaseDate: '2026-04-15',
    pieces: [
      { name: 'Front Bodice', width: '32%', height: '65%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Back Bodice', width: '32%', height: '65%', x: '40%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Left Sleeve', width: '20%', height: '45%', x: '75%', y: '10%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Right Sleeve', width: '20%', height: '45%', x: '75%', y: '60%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Collar Stand', width: '15%', height: '15%', x: '5%', y: '80%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
      { name: 'Patch Pockets', width: '18%', height: '15%', x: '22%', y: '80%', color: 'bg-amber-100 border-amber-300 text-amber-700' }
    ]
  },
  {
    id: 'pat-4',
    name: 'Perfect Fit Hourglass Blazer',
    category: 'Outerwear',
    difficulty: 'Advanced',
    time: '24 hours',
    yardage60: '2.8 Yards',
    yardage45: '3.6 Yards',
    fabric: 'Savile Row wool flannel, cashmere blend tweed, or heavy silk crepe.',
    difficultyDetail: 'High tailoring complexity. Traditional hair canvas internal structure and double-welt flap pocket panels.',
    notions: '3x 20mm primary buttons, 8x 15mm cuff buttons, pure horsehair canvassing, shoulder pads.',
    rating: 5.0,
    reviews: 35,
    image: 'https://images.unsplash.com/photo-1548624149-f9b1859aa700?auto=format&fit=crop&w=600&q=80',
    description: 'Traditional sculptured fit jacket featuring rolled shawl lapels, tailored sleeve linings, and classic keyhole details.',
    price: 29.99,
    releaseDate: '2026-07-01',
    pieces: [
      { name: 'Front Panel', width: '25%', height: '75%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Side Panel', width: '18%', height: '70%', x: '32%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Back Panel', width: '22%', height: '75%', x: '52%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Two-Piece Sleeve', width: '18%', height: '60%', x: '77%', y: '10%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Shawl Facings', width: '22%', height: '12%', x: '5%', y: '88%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
      { name: 'Pocket Welts', width: '45%', height: '12%', x: '30%', y: '88%', color: 'bg-amber-100 border-amber-300 text-amber-700' }
    ]
  },
  {
    id: 'pat-5',
    name: 'A-Line Bias Silk Slip Dress',
    category: 'Dresses',
    difficulty: 'Medium',
    time: '6 hours',
    yardage60: '2.2 Yards',
    yardage45: '2.8 Yards',
    fabric: 'Sand-washed silk satin, heavyweight crepe-de-chine, or fluid bamboo rayon.',
    difficultyDetail: 'Requires careful handling. Cut on a 45-degree grainline. Includes fine rolled-hem edge finishes.',
    notions: 'Stay tape, high-grade fine silk thread, 1.5 yards of bias cord for loops and strap channels.',
    rating: 4.6,
    reviews: 29,
    image: 'https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?auto=format&fit=crop&w=600&q=80',
    description: 'Liquid-like drape silhouette clinging elegantly to form. Features cross-back straps and a self-lined V-neck.',
    price: 16.99,
    releaseDate: '2026-06-05',
    pieces: [
      { name: 'Front Dress Block (Bias)', width: '42%', height: '80%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Back Dress Block (Bias)', width: '42%', height: '80%', x: '50%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Facings', width: '20%', height: '12%', x: '5%', y: '92%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
      { name: 'Underbust Binding', width: '60%', height: '6%', x: '28%', y: '92%', color: 'bg-sand-100 border-sand-300 text-sand-700' }
    ]
  },
  {
    id: 'pat-6',
    name: 'Bespoke Pleated Suit Trouser',
    category: 'Bottoms',
    difficulty: 'Advanced',
    time: '12 hours',
    yardage60: '2.4 Yards',
    yardage45: '3.0 Yards',
    fabric: 'Wool gabardine, worsted suitings, heavy weight linen, or dense cotton twill.',
    difficultyDetail: 'High detail density. Double welt back pocket slit, tailored waistband curtains, and brass zipper fly shield.',
    notions: '1x metal trouser clasp, 1x 7" brass trouser zipper, 1 yard of rigid stay tape, soft pocketing lining.',
    rating: 4.9,
    reviews: 47,
    image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=600&q=80',
    description: 'High-waisted double-pleated design with an internal pocket stay, adjustable brass side buckles, and hidden cuff hems.',
    price: 22.99,
    releaseDate: '2026-05-25',
    pieces: [
      { name: 'Front Leg Panel', width: '25%', height: '80%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Back Leg Panel', width: '25%', height: '80%', x: '32%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Pocket Bags (2x)', width: '18%', height: '35%', x: '59%', y: '10%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Waistband Curtains', width: '18%', height: '40%', x: '59%', y: '50%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
      { name: 'Fly Shields & Tabs', width: '15%', height: '20%', x: '79%', y: '10%', color: 'bg-amber-100 border-amber-300 text-amber-700' }
    ]
  },
  {
    id: 'pat-7',
    name: 'Edwardian Puff Sleeve Blouse',
    category: 'Tops',
    difficulty: 'Medium',
    time: '8 hours',
    yardage60: '1.8 Yards',
    yardage45: '2.4 Yards',
    fabric: 'Fine cotton voile, pure silk organza, sheer batiste, or heirloom linen.',
    difficultyDetail: 'Intermediate techniques. Inset cotton lace strips, micro pin-tucking front paneling, and button cuff plackets.',
    notions: '12x 8mm pearl dome buttons, 3 yards heirloom insert lace trim, premium fine basting thread.',
    rating: 4.8,
    reviews: 31,
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
    description: 'Dramatic vintage-inspired puff arm caps tapering to neat snug cuffs with intricate lace inserts.',
    price: 19.99,
    releaseDate: '2026-07-10',
    pieces: [
      { name: 'Front Bodice Panel', width: '30%', height: '70%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Back Bodice Panel', width: '30%', height: '70%', x: '38%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Left Puff Sleeve', width: '22%', height: '55%', x: '70%', y: '10%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Right Puff Sleeve', width: '22%', height: '55%', x: '70%', y: '68%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Collar Band & Cuffs', width: '28%', height: '12%', x: '5%', y: '85%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
      { name: 'Placket Facings', width: '28%', height: '12%', x: '35%', y: '85%', color: 'bg-amber-100 border-amber-300 text-amber-700' }
    ]
  },
  {
    id: 'pat-8',
    name: 'Atelier Hooded Duffle Cape',
    category: 'Outerwear',
    difficulty: 'Medium',
    time: '10 hours',
    yardage60: '3.0 Yards',
    yardage45: '3.8 Yards',
    fabric: 'Thick boiled wool, traditional loden coating, or luxury double-faced cashmere.',
    difficultyDetail: 'Intermediate coating. Flat-felled edge piping, leather latch reinforcing, and structured hood assembly.',
    notions: '3x genuine horn or wooden toggles, 1 yard of 4mm leather cord rope, reinforcing canvas panels.',
    rating: 4.7,
    reviews: 55,
    image: 'https://images.unsplash.com/photo-1516762689617-e1cffcef479d?auto=format&fit=crop&w=600&q=80',
    description: 'Luxurious heavy drape silhouette with structured hand slits, leather patch duffle latches, and an elegant cowl hood.',
    price: 27.99,
    releaseDate: '2026-03-30',
    pieces: [
      { name: 'Main Cape Front', width: '32%', height: '75%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Main Cape Back', width: '32%', height: '75%', x: '40%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Three-Piece Hood', width: '20%', height: '50%', x: '75%', y: '10%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Pocket Facings (2x)', width: '20%', height: '25%', x: '75%', y: '65%', color: 'bg-amber-100 border-amber-300 text-amber-700' },
      { name: 'Leather Patch Welts', width: '67%', height: '8%', x: '5%', y: '88%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' }
    ]
  }
];

import PatternCard from '../PatternCard';

export default function DynamicGallery({
  patterns: passedPatterns,
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
  const [localViewMode, setLocalViewMode] = useState('showcase');
  const viewMode = passedViewMode || localViewMode;
  const setViewMode = onViewModeChange || setLocalViewMode;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPriceRange, setSelectedPriceRange] = useState('All');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState('rating'); // 'rating', 'time', 'name', 'difficulty-asc', 'difficulty-desc', 'newest', 'price-asc', 'price-desc'

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
      const dismissed = sessionStorage.getItem('perfectfit_newsletter_modal_dismissed') === 'true';
      const subscribed = localStorage.getItem('perfectfit_newsletter_modal_subscribed') === 'true';
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
    if (searchQuery || selectedDifficulty !== 'All' || selectedCategory !== 'All' || selectedPriceRange !== 'All' || sortBy !== 'rating' || currentPage > 1 || showFavoritesOnly) {
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
      sessionStorage.setItem('perfectfit_newsletter_modal_dismissed', 'true');
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
        const savedSubsStr = localStorage.getItem('sartorial_newsletter_subscribers') || '[]';
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
          localStorage.setItem('sartorial_newsletter_subscribers', JSON.stringify(savedSubs));
        }

        localStorage.setItem('perfectfit_newsletter_modal_subscribed', 'true');
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
      const saved = localStorage.getItem('sartorial_atelier_fav_patterns');
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
          localStorage.setItem('sartorial_atelier_fav_patterns', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }
  };

  const activePatterns = passedPatterns || SEWING_PATTERNS;

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
      if (sortBy === 'rating') return (b.rating || 4.8) - (a.rating || 4.8);
      if (sortBy === 'time') {
        const timeA = parseInt(a.time || a.duration || '0') || 0;
        const timeB = parseInt(b.time || b.duration || '0') || 0;
        return timeB - timeA;
      }
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'difficulty-asc' || sortBy === 'difficulty-desc') {
        const diffOrder = { 'Easy': 1, 'Beginner': 1, 'Intermediate': 2, 'Medium': 2, 'Advanced': 3 };
        const diffA = diffOrder[a.difficulty] || 2;
        const diffB = diffOrder[b.difficulty] || 2;
        return sortBy === 'difficulty-asc' ? diffA - diffB : diffB - diffA;
      }
      if (sortBy === 'newest') {
        const bDate = b.releaseDate ? new Date(b.releaseDate).getTime() : Date.now();
        const aDate = a.releaseDate ? new Date(a.releaseDate).getTime() : Date.now();
        return bDate - aDate;
      }
      const priceA = a.price !== undefined ? a.price : (a.pricePDF || 0);
      const priceB = b.price !== undefined ? b.price : (b.pricePDF || 0);
      if (sortBy === 'price-asc') return priceA - priceB;
      if (sortBy === 'price-desc') return priceB - priceA;
      return 0;
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
      <div className="bg-[#FAF8F5] border border-sand-200/80 rounded-xl p-6 space-y-6" id="gallery-controls-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-sand-200/50 pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Compass className="w-4.5 h-4.5 text-clay-600 animate-spin-slow" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-clay-700 font-bold">Atelier Craft Registry</span>
            </div>
            <h3 className="text-2xl font-serif font-light text-bark-950">Curated Sewing Pattern Catalog</h3>
            <p className="text-xs text-bark-600 font-sans max-w-xl">
              A responsive grid of digital garment blueprints. Hover to reveal bespoke sewing specs, difficulty grades, and fabric metrics. Click any blueprint to generate layout yardages and drafting guidelines.
            </p>
          </div>
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
              >
                Reset All Filters
              </button>
            )}
          </div>
        </div>

        {/* Premium Multi-Filter Panel (Difficulty Level, Style, Price Range) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-sand-50/50 p-4 border border-sand-200/60 rounded-xl">
          {/* Difficulty / Grade Filter */}
          <div className="space-y-1.5">
            <label className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-500 block">
              Tailoring Difficulty Level
            </label>
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

        {/* Search, Sort and Layout row - positioned below premium filter panel */}
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-4 pt-2 border-t border-sand-200/40">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-bark-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search designs or fabrics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 w-full font-sans transition-all"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono uppercase text-bark-500">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-sand-250 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold text-bark-750 focus:ring-1 focus:ring-clay-500 cursor-pointer"
              >
                <option value="rating">★ Highest Rating</option>
                <option value="difficulty-asc">⚙ Difficulty: Easy to Hard</option>
                <option value="difficulty-desc">⚙ Difficulty: Hard to Easy</option>
                <option value="newest">✨ Newest Releases</option>
                <option value="price-asc">🪙 Price: Low to High</option>
                <option value="price-desc">🪙 Price: High to Low</option>
                <option value="time">⏱ Crafting Hours</option>
                <option value="name">✦ Alphabetical</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-auto">
            <div className="flex items-center gap-1.5">
              <span className="text-[9.5px] font-mono uppercase text-bark-500 shrink-0">Wishlist:</span>
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase rounded transition-all cursor-pointer flex items-center gap-1.5 border ${
                  showFavoritesOnly
                    ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-3xs shadow-rose-100/40'
                    : 'bg-sand-100 border-sand-200/80 text-bark-500 hover:text-bark-900 hover:bg-sand-150'
                }`}
                title="Filter by your saved wishlist"
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

            {/* Layout Toggle Controls */}
            <div className="flex items-center bg-sand-100 p-0.5 rounded-lg border border-sand-200/60 shrink-0" id="gallery-layout-view-toggle">
              <button
                onClick={() => setViewMode('showcase')}
                className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === 'showcase'
                    ? 'bg-white text-[#ba6446] shadow-3xs'
                    : 'text-bark-500 hover:text-bark-900'
                }`}
                title="Modern View with Specs on Hover"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Modern</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === 'grid'
                    ? 'bg-white text-bark-800 shadow-3xs'
                    : 'text-bark-500 hover:text-bark-900'
                }`}
                title="Classic View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Classic</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid List */}
      {filteredPatterns.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-sand-300 flex flex-col items-center justify-center space-y-3">
          <AlertCircle className="w-8 h-8 text-bark-400" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-bark-900 font-serif">No pattern blueprints found</p>
            <p className="text-xs text-bark-500 max-w-sm">
              We couldn't find any designs matching your parameters. Adjust your search or clear filters to reset.
            </p>
          </div>
          <button
            onClick={() => { setSearchQuery(''); setSelectedDifficulty('All'); setSelectedCategory('All'); }}
            className="px-3.5 py-1.5 bg-clay-600 hover:bg-clay-700 text-white rounded-lg text-xs font-mono font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            id="sewing-patterns-masonry"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-20px" }}
          >
            {paginatedPatterns.map((pattern) => (
              <motion.div
                key={pattern.id}
                variants={itemVariants}
                className="h-full"
              >
                <PatternCard
                  viewMode={viewMode}
                  pattern={{
                    ...pattern,
                    fabric: pattern.fabric || (Array.isArray(pattern.fabricSuggestions) ? pattern.fabricSuggestions.join(', ') : 'Premium apparel textiles.'),
                    rating: pattern.rating || 4.8,
                    reviewsCount: pattern.reviews || 12,
                    time: pattern.time || pattern.duration || '8 hours'
                  }}
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
              </motion.div>
            ))}
          </motion.div>

          {/* Dynamic Gallery Pagination Controls */}
          {filteredPatterns.length > 0 && (
            <div className="bg-[#FAF8F5] border border-sand-200/80 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 text-xs font-sans text-bark-800" id="gallery-pagination-section">
              {/* Results indicator & Items Per Page Selector */}
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-[11px] font-mono text-bark-500">
                  Showing <strong className="text-bark-900">{(currentPage - 1) * itemsPerPage + 1}</strong>–<strong className="text-bark-900">{Math.min(filteredPatterns.length, currentPage * itemsPerPage)}</strong> of <strong className="text-bark-900">{filteredPatterns.length}</strong> beautiful designs
                </span>

                <div className="flex items-center gap-1.5 border-l border-sand-250 pl-4">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-bark-450 font-bold">Per Page:</span>
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
                  title="First Page"
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
                  title="Previous Page"
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
                  title="Next Page"
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
                  title="Last Page"
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
          <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="blueprint-spec-dialog">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="bg-white border border-sand-300 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
            >

              {/* Left Column: Visual Image & Interactive Blueprint Maker */}
              <div className="md:w-1/2 bg-stone-950 text-stone-200 p-6 flex flex-col justify-between space-y-6 overflow-y-auto border-r border-sand-200">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono tracking-widest text-clay-400 uppercase font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-clay-400 shrink-0" /> Garment Cutting Layout (1:10 Scale)
                    </span>
                    <span className="text-[10px] font-mono bg-stone-800 text-stone-300 px-2 py-0.5 rounded">
                      Grainline Layout Matcher
                    </span>
                  </div>

                  <h4 className="text-lg font-serif font-medium text-white">{activePattern.name} Cutting Guide</h4>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    This interactive diagram represents the placement of template pieces on a single fabric fold. Toggle width or customize sizing to preview nesting density.
                  </p>
                </div>

                {/* Fabric Bolt Virtual Canvas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                    <span>Fabric Bolt Width: <strong className="text-white">{fabricWidth === '60' ? '60"' : '45"'} (Inches)</strong></span>
                    <span>Expected Length: <strong className="text-white">{measuredSize?.yards || activePattern.yardage60} Yards</strong></span>
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

                    <div className="absolute top-2 left-2 text-[8px] font-mono bg-clay-700/80 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                      Fold line
                    </div>

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
                        <span className="text-[7.5px] font-mono font-medium opacity-80 mt-0.5">
                          Cut 2
                        </span>
                      </div>
                    ))}

                    <div className="absolute bottom-2 right-2 text-[8px] font-mono bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded">
                      Selvage Edge
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-center pt-2">
                    <span className="text-[10px] font-mono text-stone-400">Bolt Fold:</span>
                    <button
                      onClick={() => { setFabricWidth('60'); setTimeout(() => handleCalculateYardage(activePattern), 50); }}
                      className={`px-3 py-1 text-[9px] font-bold font-mono uppercase rounded transition-all cursor-pointer border ${
                        fabricWidth === '60'
                          ? 'bg-clay-600 text-white border-clay-500 shadow-sm'
                          : 'bg-stone-800 text-stone-300 border-stone-700'
                      }`}
                    >
                      60" Fashion Width
                    </button>
                    <button
                      onClick={() => { setFabricWidth('45'); setTimeout(() => handleCalculateYardage(activePattern), 50); }}
                      className={`px-3 py-1 text-[9px] font-bold font-mono uppercase rounded transition-all cursor-pointer border ${
                        fabricWidth === '45'
                          ? 'bg-clay-600 text-white border-clay-500 shadow-sm'
                          : 'bg-stone-800 text-stone-300 border-stone-700'
                      }`}
                    >
                      45" Narrow Width
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                    <span>Rating: <strong>{activePattern.rating}</strong> ({activePattern.reviews} reviews)</span>
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
                      <span className="text-[9px] font-mono uppercase text-clay-700 tracking-wider font-bold block">
                        Difficulty Grading
                      </span>
                      <p className="text-xs text-bark-800 font-sans leading-relaxed">
                        {activePattern.difficultyDetail}
                      </p>
                    </div>

                    <div className="bg-[#FAF8F5] p-3 rounded-xl border border-sand-200/50 space-y-1">
                      <span className="text-[9px] font-mono uppercase text-clay-700 tracking-wider font-bold block">
                        Fabric Requirements & Textiles
                      </span>
                      <p className="text-xs text-bark-800 font-sans leading-relaxed">
                        {activePattern.fabric}
                      </p>
                    </div>
                  </div>

                  {/* Sizing Measurement Calculator */}
                  <div className="space-y-3 border-t border-sand-150 pt-4">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-clay-600" />
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-bark-900">
                        Perfect Fit Sizing & Yardage Estimator
                      </span>
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
                          <p className="text-[11px] text-bark-650">
                            Based on your tailored measurements.
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-mono text-bark-500 uppercase block">Required Yardage</span>
                          <span className="text-sm font-bold font-mono text-emerald-950">{measuredSize.yards} Yards</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Materials & Notions Checklist */}
                  <div className="space-y-3 border-t border-sand-150 pt-4">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-clay-600" />
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-bark-900">
                        Atelier Preparation Checklist
                      </span>
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
                    <Download className="w-4 h-4" /> Download PDF Pattern
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-2 border border-sand-250 hover:bg-sand-50 text-bark-700 rounded-lg text-xs font-mono font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    title="Print specs"
                  >
                    <Printer className="w-4 h-4" /> Print Specs
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GALLERY INTERACTION NEWSLETTER MODAL */}
      <AnimatePresence>
        {showNewsletterModal && (
          <div className="fixed inset-0 z-140 flex items-center justify-center p-4 overflow-y-auto" id="gallery-newsletter-modal">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleNewsletterDismiss}
              className="fixed inset-0 bg-bark-950/40 backdrop-blur-xs z-130 cursor-pointer"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-[#FAF8F5] border border-sand-250 shadow-lux rounded-xl w-full max-w-md p-6 z-140 relative space-y-5 text-left pointer-events-auto"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={handleNewsletterDismiss}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-sand-100 text-bark-450 hover:text-bark-900 transition-colors cursor-pointer"
                aria-label="Close modal"
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
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#ba6446] font-bold">
                        ATELIER BLUEPRINT NOTICES
                      </span>
                    </div>
                    <h4 className="font-serif text-bark-950 font-semibold text-lg tracking-wide pt-1">
                      Stay in the Pattern Loop
                    </h4>
                    <p className="text-xs text-bark-600 leading-relaxed font-sans pt-0.5">
                      Since you've been active in our blueprint gallery, join our private list of makers. You'll receive instant alerts for fresh pattern releases, monthly slow-fashion assembly guides, and exclusive sizing studies.
                    </p>
                  </div>

                  {/* Preferences selectors */}
                  <div className="space-y-2 pt-1">
                    <label className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-bark-500 block">
                      Select Your Atelier Interests:
                    </label>
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
                        <span className="truncate">New Releases</span>
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
                        <span className="truncate">Couture Tutorials</span>
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
                        placeholder="tailor@atelier.com"
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
                          <span>Subscribe</span>
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

                  <p className="text-[10px] text-bark-450 leading-relaxed italic text-center pt-1 font-sans">
                    Zero spam. Only hand-drafted pattern releases and atelier tailoring guides.
                  </p>
                </form>
              ) : (
                <div className="space-y-4 pt-1" id="gallery-newsletter-success">
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                      <Check className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 font-bold">
                      SUBSCRIPTION VERIFIED
                    </span>
                    <h4 className="font-serif text-bark-950 font-semibold text-lg tracking-wide">
                      Welcome to the Slow-Fashion Circle
                    </h4>
                    <p className="text-xs text-bark-600 leading-relaxed max-w-sm font-sans px-2">
                      You are now registered for high-precision design updates. Use this welcome code at checkout to receive <span className="font-bold text-[#ba6446]">15% off</span> your next structural blueprint package:
                    </p>
                  </div>

                  {/* Promo code card */}
                  <div className="bg-[#FAF6F0] border border-sand-200/80 rounded-xl p-3 flex flex-col items-center justify-center space-y-1.5">
                    <span className="text-[8px] font-mono text-bark-500 uppercase tracking-widest block font-bold">Welcome Promo Code</span>
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
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-sand-150 space-y-1 text-center">
                    <span className="text-[8px] font-mono text-[#ba6446] uppercase font-bold tracking-wider">
                      ★ Active Atelier Tip
                    </span>
                    <p className="text-[10.5px] text-bark-600 leading-relaxed italic px-4 font-sans">
                      "Slow-Fashion Guide: Pre-wash pure linen or cotton twill with lukewarm water to let fibers shrink before laying out pattern blocks."
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleNewsletterDismiss}
                    className="w-full py-2.5 bg-bark-900 hover:bg-bark-950 text-white text-xs font-mono font-bold uppercase rounded-lg transition-all shadow-3xs cursor-pointer text-center"
                  >
                    Return to Gallery
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
