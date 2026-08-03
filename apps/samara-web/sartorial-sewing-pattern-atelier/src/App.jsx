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
  Lock, Unlock, Package, Calendar, Archive
} from 'lucide-react';

import { SEWING_PATTERNS, MASTER_SIZING_TABLE } from './data.js';
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
const DEFAULT_APP_LAYOUT_METADATA = [
  { id: "orbital-featured", component: "OrbitCarousel", name: "Featured Item Gallery Showcase", isEnabled: true },
  { id: "dynamic-metadata-ui", component: "DynamicUiEngine", name: "Dynamic Layout & DB Admin Control", isEnabled: true },
  { id: "role-based-dynamic-layout", component: "DynamicLayout", name: "Dynamic Role-Gated Panels Workspace", isEnabled: true },
  { id: "gallery", component: "DynamicGallery", name: "Sewing Pattern Catalog & Gallery", isEnabled: true, title: "The Curated Pattern Collection", description: "Explore Our Modern Garments" },
  { id: "my-orders", component: "MyOrdersSection", name: "My Purchased Orders", isEnabled: true },
  { id: "sewing-timer", component: "SewingSessionTimer", name: "Sewing Session Timer (Consolidated inside Workspace)", isEnabled: false },
  { id: "creations-feedback", component: "CreationsAndFeedback", name: "Showroom Feedback & Community Creations", isEnabled: true },
  { id: "customer-testimonials", component: "TestimonialCarousel", name: "Customer Testimonials Showcase (Consolidated with Board)", isEnabled: true },
  { id: "calculator", component: "MannequinGuide", name: "Fitting Room Sizer & Mannequin Guide (Consolidated inside Workspace)", isEnabled: false },
  { id: "perfectfit-specification", component: "PerfectFitStandards", name: "Perfect Fit Assembly Standards & Specs", isEnabled: true },
  { id: "perfectfit-faq", component: "PerfectFitFaq", name: "Perfect Fit Curated Knowledge Base (FAQ)", isEnabled: true },
  { id: "perfectfit-library", component: "EditorialAcademy", name: "Editorials & Academy Masterclasses", isEnabled: true },
  { id: "creator-community-blog", component: "CreatorBlog", name: "Perfect Fit Creator Blog & Community Feed", isEnabled: true }
];

export default function App() {
  // Sizing view state mode: 'desktop' | 'mobile'
  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem('perfectfit_view_mode');
      if (saved === 'desktop' || saved === 'mobile') return saved;
    } catch {}
    return window.innerWidth < 1024 ? 'mobile' : 'desktop';
  });

  // Master metadata layout configuration
  const [appLayout, setAppLayout] = useState(() => {
    try {
      const saved = localStorage.getItem('perfectfit_app_layout_metadata');
      if (saved) {
        let parsed = JSON.parse(saved).map(item => {
          // If previous saves had sewing-timer or calculator enabled on the main page,
          // migrate them to false now that they are consolidated inside the workspace
          if (item.id === 'sewing-timer' || item.id === 'calculator') {
            return { ...item, isEnabled: false };
          }
          return item;
        });
        const defaultIds = DEFAULT_APP_LAYOUT_METADATA.map(item => item.id);
        const parsedIds = parsed.map(item => item.id);
        const missing = DEFAULT_APP_LAYOUT_METADATA.filter(item => !parsedIds.includes(item.id));
        if (missing.length > 0) {
          return [...parsed, ...missing];
        }
        return parsed;
      }
      return DEFAULT_APP_LAYOUT_METADATA;
    } catch {
      return DEFAULT_APP_LAYOUT_METADATA;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('perfectfit_app_layout_metadata', JSON.stringify(appLayout));
    } catch {}
  }, [appLayout]);

  const handleResetLayout = () => {
    setAppLayout(DEFAULT_APP_LAYOUT_METADATA);
    addToast("Perfect Fit layout metadata successfully restored to default.", "success", "System Reset");
  };

  // Keep viewMode state synchronized with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('perfectfit_view_mode', viewMode);
    } catch {}
  }, [viewMode]);

  // Local state for shopping cart with localStorage persistence
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('perfectfit_bureau_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Member authentication states with localStorage persistence
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('perfectfit_bureau_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

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
    return localStorage.getItem('perfectfit_ui_login_dependent') === 'true';
  });

  // Sync user profile changes back to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('perfectfit_bureau_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('perfectfit_bureau_user');
    }
  }, [currentUser]);

  // Guest orders state with localStorage persistence
  const [guestOrders, setGuestOrders] = useState(() => {
    try {
      const saved = localStorage.getItem('perfectfit_bureau_guest_orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('perfectfit_bureau_guest_orders', JSON.stringify(guestOrders));
    } catch {}
  }, [guestOrders]);

  const handleOrderSuccess = (newOrder) => {
    const formattedItems = newOrder.items.map(item => ({
      patternName: item.pattern.name,
      format: item.format,
      price: item.price,
      quantity: item.quantity,
      sizePreference: item.sizePreference || '8',
      image: item.pattern.image
    }));

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
            price: newOrder.total
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
          price: newOrder.total
        },
        ...prev
      ]);
    }
  };

  const handleLoadDemoOrders = () => {
    const demoOrdersList = [
      {
        id: 'SRT-409124',
        date: new Date(Date.now() - 4 * 24 * 3600 * 1000).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }),
        items: [
          {
            patternName: 'Palazzo Wide-Leg Trouser',
            format: 'PDF',
            price: 13.00,
            quantity: 1,
            sizePreference: '10',
            image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=120&q=80'
          },
          {
            patternName: 'Renaissance Pleated Bodice',
            format: 'PDF',
            price: 15.00,
            quantity: 1,
            sizePreference: '8',
            image: 'https://images.unsplash.com/photo-1566207274740-0f8cf6b7d5a5?auto=format&fit=crop&w=120&q=80'
          }
        ],
        total: 28.00,
        status: 'Ready for Download',
        format: 'PDF'
      },
      {
        id: 'SRT-882041',
        date: new Date(Date.now() - 10 * 24 * 3600 * 1000).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }),
        items: [
          {
            patternName: 'Aurelia Wrap Dress',
            format: 'Printed',
            price: 24.00,
            quantity: 1,
            sizePreference: '12',
            image: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=120&q=80'
          }
        ],
        total: 28.50,
        status: 'Shipped (Tracking: #SART-98402)',
        format: 'Printed'
      }
    ];

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

  // Dynamic patterns state initialized with our MASTER SEWING_PATTERNS or ERP pushed data
  const [patterns, setPatterns] = useState(() => {
    try {
      const savedErp = localStorage.getItem('perfectfit_erp_patterns');
      if (savedErp) {
        const parsed = JSON.parse(savedErp);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error reading initial patterns from localStorage:", e);
    }
    return SEWING_PATTERNS;
  });

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
      addToast(
        'Your connection is stable. The Perfect Fit Bureau is fully synchronized with live ERP updates.',
        'success',
        'Connection Restored'
      );
    };
    const handleOffline = () => {
      setIsOnline(false);
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
        try {
          localStorage.setItem('perfectfit_erp_patterns', JSON.stringify(newPatterns));
        } catch {}
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
          try {
            localStorage.setItem('perfectfit_erp_patterns', JSON.stringify(updated));
          } catch {}
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
            localStorage.setItem('perfectfit_erp_patterns', JSON.stringify(data));
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
  const [generalRecommendedSize, setGeneralRecommendedSize] = useState('8');

  // Currently active focused pattern (for detailed product description view)
  const [activePatternId, setActivePatternId] = useState(() => {
    try {
      const savedErp = localStorage.getItem('perfectfit_erp_patterns');
      if (savedErp) {
        const parsed = JSON.parse(savedErp);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0].id;
        }
      }
    } catch {}
    return SEWING_PATTERNS[0].id;
  });

  // Detail tab state for OrbitCarousel details panel
  const [featuredDetailTab, setFeaturedDetailTab] = useState('specs');

  // Interactive Quick View summary modal active pattern state
  const [quickViewPattern, setQuickViewPattern] = useState(null);

  // Shared One-Time Token Access state
  const [sharedTokenAccess, setSharedTokenAccess] = useState(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const patternId = params.get('pattern');
      if (token) {
        const matchedPattern = SEWING_PATTERNS.find(p => p.id === patternId || (token && token.includes(p.id))) || SEWING_PATTERNS[0];
        setSharedTokenAccess({
          token,
          pattern: matchedPattern
        });
      }
    } catch (err) {
      console.error("Error reading token URL parameter:", err);
    }
  }, []);

  // Sync active focused pattern when patterns list changes
  useEffect(() => {
    if (patterns.length > 0) {
      const exists = patterns.some(p => p.id === activePatternId);
      if (!exists) {
        setActivePatternId(patterns[0].id);
      }
    }
  }, [patterns, activePatternId]);

  // Initialize product reviews from localStorage or realistic couture seeds
  const [reviews, setReviews] = useState(() => {
    try {
      const saved = localStorage.getItem('perfectfit_bureau_reviews');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Error reading reviews from localStorage", e);
    }
    // Standard high-quality seeded reviews
    const defaultReviews = {
      'sartorial-01': [
        {
          id: 'rev-sartorial-01-1',
          name: 'Genevieve R.',
          rating: 5,
          title: 'Flawless Drape & Clear Guides',
          comment: 'The French seam instructions are exceptionally clear. I made this in a midweight washed linen and the drape is stunning. The sizing was spot-on according to the calculator!',
          date: '2026-06-18'
        },
        {
          id: 'rev-sartorial-01-2',
          name: 'Clara M.',
          rating: 4,
          title: 'Beautiful dress, watch the tie length',
          comment: 'Absolutely love the final look. I modified the waist tie to be slightly wider to style a bigger bow. Perfect beginner-intermediate challenge.',
          date: '2026-05-24'
        }
      ],
      'sartorial-02': [
        {
          id: 'rev-sartorial-02-1',
          name: 'Arthur P.',
          rating: 5,
          title: 'The ultimate bespoke experience',
          comment: 'An ambitious project but the results are absolute shop-quality. The storm flap alignment guides were incredibly precise. Crafted mine in organic heavyweight cotton twill.',
          date: '2026-06-20'
        },
        {
          id: 'rev-sartorial-02-2',
          name: 'Elena K.',
          rating: 5,
          title: 'A masterclass in coatmaking',
          comment: 'Excellent documentation, high quality booklet. The double-breasted layout is beautifully calculated. Take your time with the collar and welt pockets!',
          date: '2026-06-11'
        }
      ],
      'sartorial-03': [
        {
          id: 'rev-sartorial-03-1',
          name: 'Beatrice L.',
          rating: 5,
          title: 'Unbelievably comfortable trouser',
          comment: 'I have made three pairs of these Palazzo trousers already! The pocket drafting is pure genius—completely flat against the hips.',
          date: '2026-06-22'
        },
        {
          id: 'rev-sartorial-03-2',
          name: 'Isabella K.',
          rating: 4,
          title: 'Excellent width and drape',
          comment: 'Sized down slightly based on the waist measurement. Instructions were fantastic. High-fashion result!',
          date: '2026-06-01'
        }
      ],
      'sartorial-04': [
        {
          id: 'rev-sartorial-04-1',
          name: 'Sienna V.',
          rating: 5,
          title: 'Couture feel, draping masterclass',
          comment: 'The asymmetric pleat lines are a masterpiece. This blouse looks like a high-end designer piece. Highly recommend lightweight silk tencel.',
          date: '2026-06-15'
        }
      ]
    };
    try {
      localStorage.setItem('perfectfit_bureau_reviews', JSON.stringify(defaultReviews));
    } catch (e) {
      console.error("Error writing reviews to localStorage", e);
    }
    return defaultReviews;
  });

  // Sync reviews with localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem('perfectfit_bureau_reviews', JSON.stringify(reviews));
    } catch (e) {
      console.error("Error syncing reviews", e);
    }
  }, [reviews]);

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
    return patterns.filter((p) => {
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
  }, [patterns, searchQuery]);

  // Favorites state persisted in local storage
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('perfectfit_bureau_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error reading favorites from localStorage", e);
      return [];
    }
  });

  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [galleryViewMode, setGalleryViewMode] = useState('showcase'); // 'showcase' (hover reveal) or 'grid' (classic Viki Sews card)

  // Sync favorites with localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem('perfectfit_bureau_favorites', JSON.stringify(favorites));
    } catch (e) {
      console.error("Error syncing favorites to localStorage", e);
    }
  }, [favorites]);

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
  }, [selectedCategory, selectedDifficulty, searchQuery, itemsPerPage, showFavoritesOnly, sortBy]);

  // Dynamic skeleton loading delay on filter or search changes to simulate live ERP indexing
  useEffect(() => {
    setIsCatalogLoading(true);
    const delay = searchQuery ? 400 : 550; // Snappier delay for keyword search
    const timer = setTimeout(() => {
      setIsCatalogLoading(false);
    }, delay);
    return () => clearTimeout(timer);
  }, [selectedCategory, selectedDifficulty, showFavoritesOnly, sortBy, searchQuery]);


  // Cart Drawer open/close status
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isTrackOrderOpen, setIsTrackOrderOpen] = useState(false);
  const [isConsultationOpen, setIsConsultationOpen] = useState(false);
  const [isFabricStashOpen, setIsFabricStashOpen] = useState(false);
  const [trackOrderId, setTrackOrderId] = useState('');
  const [isDevModalOpen, setIsDevModalOpen] = useState(false);

  // Persistent cart syncing
  useEffect(() => {
    localStorage.setItem('perfectfit_bureau_cart', JSON.stringify(cartItems));
  }, [cartItems]);

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
    const counts = { All: patterns.length };
    patterns.forEach((p) => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return counts;
  }, [patterns]);

  const difficultyCounts = useMemo(() => {
    const counts = { All: patterns.length };
    patterns.forEach((p) => {
      if (p.difficulty) {
        counts[p.difficulty] = (counts[p.difficulty] || 0) + 1;
      }
    });
    return counts;
  }, [patterns]);

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
    const filtered = patterns.filter((p) => {
      const matchCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchDifficulty = selectedDifficulty === 'All' || p.difficulty === selectedDifficulty;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.difficulty.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFavorites = !showFavoritesOnly || favorites.includes(p.id);
      return matchCategory && matchDifficulty && matchSearch && matchFavorites;
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
  }, [patterns, selectedCategory, selectedDifficulty, searchQuery, showFavoritesOnly, favorites, sortBy]);

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
    const price = format === 'PDF' ? pattern.pricePDF : pattern.pricePrinted;

    setCartItems((prevItems) => {
      const existing = prevItems.find((item) => item.id === compositeId);
      if (existing) {
        return prevItems.map((item) =>
          item.id === compositeId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prevItems,
        {
          id: compositeId,
          pattern,
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
      { image: pattern.image, size: sizePref, format }
    );

    // Automatically open the cart drawer when adding an item to feel highly responsive
    setTimeout(() => {
      setIsCartOpen(true);
    }, 450);
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
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            PERFECT FIT MOBILE WORKSPACE
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('desktop')}
              className="text-sand-400 hover:text-white transition-colors cursor-pointer text-[10px] font-bold tracking-wider"
            >
              🖥️ SWITCH TO DESKTOP BLUEPRINT
            </button>
            <span className="text-bark-850">|</span>
            <span className="text-white font-bold font-mono uppercase tracking-wider">📱 MOBILE APP VIEW ACTIVE</span>
          </div>
        </div>

        {/* Mobile Mockup device container (simulating a phone) */}
        <div className="w-full max-w-md h-[840px] shadow-2xl relative my-4 flex-1 flex flex-col border border-sand-200 bg-white">
          <MobileAppView
            patterns={patterns}
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
            <span className="text-[10px] uppercase tracking-[0.25em] text-clay-400 font-mono block">Authentic Gated Workspace</span>
            <h1 className="text-3xl font-serif font-light text-white uppercase tracking-wide">Perfect Fit Bureau</h1>
            <div className="h-0.5 bg-stone-800 w-16 mx-auto" />
          </div>

          <p className="text-xs text-stone-300 leading-relaxed font-sans">
            Authentication Required. This system has been configured by the <strong>Executive Administrator</strong> to restrict public catalog operations. Please log in or use the interactive demo bypass to authorize access.
          </p>

          <div className="bg-stone-900/50 border border-stone-800 p-4 rounded-xl space-y-3">
            <span className="text-[9px] font-mono uppercase text-clay-300 block tracking-wider font-bold">✦ Dynamic Administrator Credentials ✦</span>
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
                localStorage.setItem('perfectfit_bureau_user', JSON.stringify(adminUser));
              }}
              className="w-full bg-clay-650 hover:bg-clay-600 text-white text-xs font-semibold py-2.5 rounded-lg transition-all cursor-pointer shadow-3xs flex items-center justify-center gap-2"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Bypass: Sign In as Administrator</span>
            </button>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-stone-400 hover:text-white text-xs font-semibold uppercase tracking-wider underline cursor-pointer"
            >
              View Member Login Options
            </button>
          </div>
        </div>

        <MemberManagement
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          patterns={patterns}
          onLoginSuccess={(user) => {
            setIsAuthModalOpen(false);
          }}
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
      `}</style>

      {/* Top Utility Bar */}
      <div className="bg-[#FAF6F0] border-b border-sand-150 py-2 px-4 sm:px-6 lg:px-8 text-bark-600 text-[10px]" id="top-utility-bar">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left side: Connection status */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const nextOnline = !isOnline;
                setIsOnline(nextOnline);
                window.isPerfectFitOffline = !nextOnline;
                if (nextOnline) {
                  addToast(
                    'Your connection is stable. The Perfect Fit Bureau is fully synchronized with live ERP updates.',
                    'success',
                    'Connection Restored'
                  );
                } else {
                  addToast(
                    'You are now browsing offline. Pre-cached blueprints, styling handbooks, mannequin measurements, and time studies remain fully functional.',
                    'warning',
                    'Intermittent Connection (Offline Mode)'
                  );
                }
              }}
              className="flex items-center gap-1.5 hover:text-[#ba6446] text-bark-500 transition-colors cursor-pointer text-[9.5px] font-mono font-bold uppercase tracking-wider focus:outline-none"
              title="Toggle online/offline simulator mode"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>Status: {isOnline ? 'Online (ERP Sync)' : 'Offline (Simulated)'}</span>
            </button>
          </div>

          {/* Right side: View toggler, Track Order, Consultation */}
          <div className="flex items-center gap-5">
            <button
              onClick={() => setIsTrackOrderOpen(true)}
              className="hover:text-[#ba6446] text-bark-500 transition-colors flex items-center gap-1.5 font-sans font-semibold uppercase tracking-wider text-[9.5px] cursor-pointer"
            >
              <Package className="w-3 h-3 text-bark-400" />
              <span>Track Shipment</span>
            </button>

            <button
              onClick={() => setIsConsultationOpen(true)}
              className="hover:text-[#ba6446] text-bark-500 transition-colors flex items-center gap-1.5 font-sans font-semibold uppercase tracking-wider text-[9.5px] cursor-pointer"
            >
              <Calendar className="w-3 h-3 text-bark-400" />
              <span>Design Consultation</span>
            </button>

            <div className="h-3 w-[1px] bg-sand-200 hidden sm:block" />

            {/* Sizing Toggler */}
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-wider text-bark-400 font-bold font-sans">View As:</span>
              <div className="flex bg-sand-200/50 p-0.5 rounded-md items-center text-bark-600 border border-sand-250/60">
                <button
                  onClick={() => setViewMode('desktop')}
                  className={`px-2 py-0.5 rounded-[3px] text-[8.5px] font-mono uppercase tracking-wider font-bold transition-all cursor-pointer ${viewMode === 'desktop' ? 'bg-white text-bark-900 shadow-3xs' : 'hover:text-bark-900'}`}
                >
                  Desk
                </button>
                <button
                  onClick={() => setViewMode('mobile')}
                  className={`px-2 py-0.5 rounded-[3px] text-[8.5px] font-mono uppercase tracking-wider font-bold transition-all cursor-pointer ${viewMode === 'mobile' ? 'bg-white text-bark-900 shadow-3xs' : 'hover:text-bark-900'}`}
                >
                  Mob
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Navigation Bar */}
      <nav className="sticky top-0 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-sand-200/45 z-40 transition-all duration-300" id="navigation-bar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4.5 flex items-center justify-between" id="nav-inner-row">

          {/* Logo / Brand Name */}
          <a href="#" className="flex items-center gap-2 group" id="brand-logo-link">
            <div className="flex flex-col leading-none" id="brand-logo-text">
              <span className="font-serif text-xl font-light uppercase tracking-[0.18em] text-bark-950 block">PERFECT FIT</span>
              <span className="text-[7.5px] tracking-[0.35em] text-bark-400 block uppercase font-mono mt-1 font-semibold">BUREAU</span>
            </div>
          </a>

          {/* Grouped Dropdown Navigation Menu */}
          <div className="hidden md:block relative" id="explore-dropdown-container">
            <button
              onClick={() => setIsExploreOpen(!isExploreOpen)}
              className="flex items-center gap-1.5 px-3 py-2 text-bark-900 hover:text-[#ba6446] transition-all text-[11px] font-bold uppercase tracking-wider cursor-pointer font-sans"
              id="explore-dropdown-button"
              type="button"
            >
              <span>Explore Bureau</span>
              <ChevronDown className={`w-3.5 h-3.5 text-bark-500 transition-transform duration-300 ${isExploreOpen ? 'rotate-180 text-[#ba6446]' : ''}`} />
            </button>

            <AnimatePresence>
              {isExploreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-1/2 -translate-x-1/2 mt-2.5 w-[440px] bg-white border border-sand-200 shadow-lg rounded-[4px] p-4.5 z-50 grid grid-cols-2 gap-4"
                  id="explore-dropdown-panel"
                >
                  {/* Column 1: Showroom & Patterns */}
                  <div className="space-y-3">
                    <span className="text-[8.5px] font-mono font-bold text-clay-700 tracking-wider uppercase border-b border-sand-100 pb-1.5 block">
                      Showroom &amp; Patterns
                    </span>
                    <div className="space-y-1.5">
                      <a
                        href="#gallery-section"
                        onClick={() => setIsExploreOpen(false)}
                        className="group flex flex-col p-1 rounded hover:bg-[#FAF8F5] transition-colors"
                      >
                        <span className="text-xs font-bold text-bark-900 group-hover:text-[#ba6446] transition-colors">Curated Catalog</span>
                        <span className="text-[9px] text-bark-450 normal-case tracking-normal">Browse design booklets</span>
                      </a>
                      <a
                        href="#my-orders-section"
                        onClick={() => setIsExploreOpen(false)}
                        className="group flex flex-col p-1 rounded hover:bg-[#FAF8F5] transition-colors"
                      >
                        <span className="text-xs font-bold text-bark-900 group-hover:text-[#ba6446] transition-colors">My Purchased Orders</span>
                        <span className="text-[9px] text-bark-450 normal-case tracking-normal">Access PDF downloads</span>
                      </a>
                      <a
                        href="#perfectfit-showroom-feedback-section"
                        onClick={() => setIsExploreOpen(false)}
                        className="group flex flex-col p-1 rounded hover:bg-[#FAF8F5] transition-colors"
                      >
                        <span className="text-xs font-bold text-bark-900 group-hover:text-[#ba6446] transition-colors">Perfect Fit Showroom</span>
                        <span className="text-[9px] text-bark-450 normal-case tracking-normal">Reviews &amp; completed garments</span>
                      </a>
                      <a
                        href="#creator-community-blog-section"
                        onClick={() => setIsExploreOpen(false)}
                        className="group flex flex-col p-1 rounded hover:bg-[#FAF8F5] transition-colors"
                      >
                        <span className="text-xs font-bold text-bark-900 group-hover:text-[#ba6446] transition-colors">Creator Blog</span>
                        <span className="text-[9px] text-bark-450 normal-case tracking-normal">Perfect Fit updates</span>
                      </a>
                    </div>
                  </div>

                  {/* Column 2: Creative Workspace */}
                  <div className="space-y-3">
                    <span className="text-[8.5px] font-mono font-bold text-clay-700 tracking-wider uppercase border-b border-sand-100 pb-1.5 block">
                      Creative Workspace
                    </span>
                    <div className="space-y-1.5">
                      <a
                        href="#sewing-session-timer-section"
                        onClick={() => setIsExploreOpen(false)}
                        className="group flex flex-col p-1 rounded hover:bg-[#FAF8F5] transition-colors"
                      >
                        <span className="text-xs font-bold text-[#ba6446] group-hover:text-[#ba6446] transition-colors flex items-center gap-1">
                          Sewing Room <span className="w-1.5 h-1.5 rounded-full bg-[#ba6446] animate-pulse" />
                        </span>
                        <span className="text-[9px] text-bark-450 normal-case tracking-normal">Track timing and drafting workloads</span>
                      </a>
                      <a
                        href="#calculator-section"
                        onClick={() => setIsExploreOpen(false)}
                        className="group flex flex-col p-1 rounded hover:bg-[#FAF8F5] transition-colors"
                      >
                        <span className="text-xs font-bold text-bark-900 group-hover:text-[#ba6446] transition-colors">Fitting Room Sizer</span>
                        <span className="text-[9px] text-bark-450 normal-case tracking-normal">Interactive yardage calculator</span>
                      </a>
                      <a
                        href="#perfectfit-specification-guide"
                        onClick={() => setIsExploreOpen(false)}
                        className="group flex flex-col p-1 rounded hover:bg-[#FAF8F5] transition-colors"
                      >
                        <span className="text-xs font-bold text-bark-900 group-hover:text-[#ba6446] transition-colors">Drafting Standards</span>
                        <span className="text-[9px] text-bark-450 normal-case tracking-normal">Measurement &amp; print specs</span>
                      </a>
                      <a
                        href="#perfectfit-library-section"
                        onClick={() => setIsExploreOpen(false)}
                        className="group flex flex-col p-1 rounded hover:bg-[#FAF8F5] transition-colors"
                      >
                        <span className="text-xs font-bold text-bark-900 group-hover:text-[#ba6446] transition-colors">Perfect Fit Library</span>
                        <span className="text-[9px] text-bark-450 normal-case tracking-normal">Manuals, templates &amp; styling guides</span>
                      </a>
                    </div>
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
              title="Search Catalog"
              type="button"
              id="header-search-icon-btn"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <input
              type="text"
              placeholder="Search patterns..."
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
                title="Clear Search"
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
                  className="absolute top-full left-0 right-0 mt-2.5 bg-white border border-sand-200 shadow-lg rounded-[4px] z-50 overflow-hidden divide-y divide-sand-100 w-[280px] sm:w-[320px] md:w-[340px] -translate-x-1/4 sm:translate-x-0"
                  id="header-search-dropdown-panel"
                >
                  <div className="px-3 py-1.5 bg-sand-50/50 text-[8.5px] font-mono font-bold uppercase tracking-wider text-bark-400 flex justify-between items-center">
                    <span>Suggested Blueprints</span>
                    <span className="text-[7.5px] font-semibold text-[#e0a894]">Click to Open Quick View</span>
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
                          <span className="block text-[7px] font-mono text-bark-400 uppercase tracking-tight">PDF Spec</span>
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
                        View all {filteredPatterns.length} matches in catalog →
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Row - Cart Status & Member Indicator */}
          <div className="flex items-center gap-2.5 flex-shrink-0" id="nav-action-row">

            {/* User Profile / Authentication Badge */}
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-bark-850 hover:text-[#ba6446] hover:bg-sand-100/50 border border-transparent rounded-lg px-2.5 py-2 flex items-center gap-2 transition-all text-xs font-semibold cursor-pointer active:scale-[0.98]"
              id="header-profile-widget"
              title="Manage Perfect Fit Membership"
            >
              {currentUser ? (
                <>
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.fullName}
                      className="w-5 h-5 rounded-full object-cover border border-clay-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-5 h-5 bg-clay-100 text-[#ba6446] rounded-full flex items-center justify-center font-bold text-[9px] uppercase">
                      {currentUser.fullName.slice(0, 2)}
                    </div>
                  )}
                  <span className="hidden sm:inline font-sans truncate max-w-[80px]">{currentUser.fullName}</span>
                </>
              ) : (
                <>
                  <User className="w-4 h-4 text-bark-500" />
                  <span className="hidden sm:inline font-sans uppercase tracking-wider text-[9px] font-bold">Sign In</span>
                </>
              )}
            </button>

            {/* Fabric Stash */}
            <button
              onClick={() => setIsFabricStashOpen(true)}
              className="text-bark-850 hover:text-[#ba6446] hover:bg-sand-100/50 rounded-lg px-2.5 py-2 flex items-center gap-1.5 transition-all text-xs font-semibold cursor-pointer active:scale-[0.98]"
              id="header-fabric-stash-gauge"
              title="My Fabric Stash & Swatches"
            >
              <Archive className="w-4 h-4 text-[#ba6446]" />
              <span className="hidden xl:inline font-sans uppercase tracking-wider text-[9px] font-bold">
                Fabric Stash
              </span>
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
                Wishlist
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
                {totalCartCount > 0 ? `Cart (${totalCartCount})` : 'Cart'}
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
              aria-label="Toggle Menu"
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
                    placeholder="Search by name, category, level..."
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
                        <span>Matching Patterns</span>
                        <span className="text-[7px] text-[#e0a894] font-semibold">Tap to View</span>
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

                <a
                  href="#gallery-section"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="hover:text-[#ba6446] transition-colors py-1.5 border-b border-sand-100/40"
                >
                  Curated Catalog
                </a>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsWishlistOpen(true);
                  }}
                  className="hover:text-[#ba6446] transition-colors py-1.5 border-b border-sand-100/40 flex items-center justify-between text-left w-full font-semibold uppercase tracking-widest text-xs cursor-pointer"
                >
                  <span>Archive Wishlist</span>
                  {favorites.length > 0 && (
                    <span className="bg-rose-600 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                      {favorites.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsTrackOrderOpen(true);
                  }}
                  className="hover:text-[#ba6446] transition-colors py-1.5 border-b border-sand-100/40 text-left w-full font-semibold uppercase tracking-widest text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Package className="w-3.5 h-3.5 text-bark-500" />
                  <span>Track Order Shipment</span>
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsConsultationOpen(true);
                  }}
                  className="hover:text-[#ba6446] transition-colors py-1.5 border-b border-sand-100/40 text-left w-full font-semibold uppercase tracking-widest text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#ba6446]" />
                  <span>Book Consultation</span>
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsFabricStashOpen(true);
                  }}
                  className="hover:text-[#ba6446] transition-colors py-1.5 border-b border-sand-100/40 text-left w-full font-semibold uppercase tracking-widest text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5 text-clay-700" />
                  <span>Fabric Stash Inventory</span>
                </button>
                <a
                  href="#my-orders-section"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="hover:text-[#ba6446] transition-colors py-1.5 border-b border-sand-100/40"
                >
                  My Purchased Orders
                </a>
                <a
                  href="#perfectfit-showroom-feedback-section"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="hover:text-[#ba6446] transition-colors py-1.5 border-b border-sand-100/40"
                >
                  Community Showroom
                </a>
                <a
                  href="#calculator-section"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="hover:text-[#ba6446] transition-colors py-1.5 border-b border-sand-100/40"
                >
                  Interactive Sizing
                </a>
                <a
                  href="#perfectfit-specification-guide"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="hover:text-[#ba6446] transition-colors py-1.5 border-b border-sand-100/40"
                >
                  Our Standard Guidelines
                </a>
                <a
                  href="#perfectfit-library-section"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="hover:text-[#ba6446] transition-colors py-1.5 border-b border-sand-100/40"
                >
                  Perfect Fit Library
                </a>
                <a
                  href="#creator-community-blog-section"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="hover:text-[#ba6446] transition-colors py-1.5"
                >
                  Creator Blog
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Carousel Section */}
      <HeroCarousel
        onExploreCatalog={() => {
          const el = document.getElementById('gallery-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        onOpenSizingCalculator={() => {
          const el = document.getElementById('calculator-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Primary Landing Page Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-24" id="main-sections">

        {appLayout.map((section) => {
          if (!section.isEnabled) return null;

          switch (section.component) {
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
                      patterns={patterns.slice(0, 4)}
                      activePatternId={activePatternId}
                      setActivePatternId={setActivePatternId}
                      activeRecommendedSize={generalRecommendedSize}
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
                  className="space-y-8"
                  id="gallery-section"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-sand-200 pb-4">
                    <div>
                      <span className="text-[9px] text-clay-700 font-bold uppercase tracking-[0.25em] block mb-1">
                        {section.title || "The Curated Pattern Collection"}
                      </span>
                      <h2 className="text-3xl font-serif font-light text-bark-950 tracking-tight">
                        {section.description || "Explore Our Modern Garments"}
                      </h2>
                    </div>

                    {/* Premium Layout Toggle Switcher in the Section Header */}
                    <div className="flex items-center bg-sand-100 p-0.5 rounded-lg border border-sand-200/60 font-sans text-xs self-start sm:self-auto shrink-0" id="gallery-layout-view-toggle">
                      <button
                        onClick={() => setGalleryViewMode('showcase')}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                          galleryViewMode === 'showcase'
                            ? 'bg-white text-[#ba6446] shadow-3xs'
                            : 'text-bark-500 hover:text-bark-900'
                        }`}
                        title="Modern Showcase View with Specs on Hover"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Showcase</span>
                      </button>
                      <button
                        onClick={() => setGalleryViewMode('grid')}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                          galleryViewMode === 'grid'
                            ? 'bg-white text-bark-800 shadow-3xs'
                            : 'text-bark-500 hover:text-bark-900'
                        }`}
                        title="Classic Grid View with Left Specification Panel"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Classic Grid</span>
                      </button>
                    </div>
                  </div>

                  {galleryViewMode === 'showcase' ? (
                    <PatternImageGallery
                      patterns={patterns}
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
                      patterns={patterns}
                      onAddToCart={handleAddToCart}
                      activeRecommendedSize={generalRecommendedSize}
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
                  )}
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
                    onLoadDemoOrders={handleLoadDemoOrders}
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
                    patterns={patterns}
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
                    activeRecommendedSize={generalRecommendedSize}
                    onRecommendedSizeChange={setGeneralRecommendedSize}
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
                  className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6"
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
      <footer className="bg-bark-950 text-sand-200 border-t border-bark-900 py-16 mt-20" id="landing-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12" id="footer-inner">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start" id="footer-grid">

            {/* Branding detail */}
            <div className="md:col-span-5 space-y-4" id="footer-branding">
              <div className="flex items-center gap-2.5" id="footer-logo">
                <div className="w-8 h-8 rounded-[4px] border border-sand-400 flex items-center justify-center text-sand-50 font-serif font-bold" id="footer-logo-ring">
                  P
                </div>
                <h4 className="font-serif text-sand-50 text-base uppercase tracking-wider">Perfect Fit Bureau</h4>
              </div>
              <p className="text-xs text-sand-300/80 leading-relaxed max-w-sm" id="footer-tag-desc">
                Timeless wearable styling built on structural elegance. We celebrate the luxury of slow-fashion constructing, providing beautifully organized, fully accurate blueprint packets for sewing enthusiasts around the globe.
              </p>
            </div>

            {/* Core references links */}
            <div className="md:col-span-3 space-y-3 text-xs" id="footer-links-column">
              <h5 className="font-serif text-sand-105 tracking-wider font-semibold">THE PERFECT FIT BLUEPRINTS</h5>
              <ul className="space-y-2 text-sand-300">
                <li><a href="#gallery-section" className="hover:text-clay-400 transition-colors">Wrap Dresses Series</a></li>
                <li><a href="#gallery-section" className="hover:text-clay-400 transition-colors">Tailored Tailcoat Jackets</a></li>
                <li><a href="#gallery-section" className="hover:text-clay-400 transition-colors">Wide Leg Palazzos</a></li>
                <li><a href="#gallery-section" className="hover:text-clay-400 transition-colors">Asymmetric Slips Series</a></li>
                <li><a href="#creator-community-blog-section" className="hover:text-clay-400 transition-colors">Creator Blog &amp; Feed</a></li>
              </ul>
            </div>

            {/* Newsletter prompt */}
            <div className="md:col-span-4" id="footer-newsletter">
              <StayInspiredNewsletter addToast={addToast} />
            </div>

          </div>

          {/* Trademark details */}
          <div className="border-t border-bark-900 pt-8 flex flex-col sm:flex-row justify-between items-center text-[10px] text-sand-400/70 gap-4" id="footer-bottom">
            <p id="copyright">© 2026 Perfect Fit Bureau Inc. Executed with premium slow-fashion guidelines.</p>
            <div className="flex gap-4" id="socials">
              <button
                onClick={() => setIsDevModalOpen(true)}
                className="hover:text-sand-100 transition-colors text-[10px] text-sand-400/70 font-sans cursor-pointer bg-transparent border-none p-0 outline-none flex items-center gap-1 font-semibold"
                id="footer-dev-integration-btn"
              >
                <Code className="w-3 h-3 text-clay-400" />
                Developer Integration
              </button>
              <a href="javascript:void(0)" className="hover:text-sand-100 transition-colors">Blueprint Licensing</a>
              <a href="javascript:void(0)" className="hover:text-sand-100 transition-colors">Perfect Fit Terms</a>
              <a href="javascript:void(0)" className="hover:text-sand-100 transition-colors">Privacy Principles</a>
            </div>
          </div>
        </div>
      </footer>

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
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        currentUser={currentUser}
        onOrderSuccess={handleOrderSuccess}
        onTrackOrder={(orderId) => {
          setTrackOrderId(orderId);
          setIsTrackOrderOpen(true);
        }}
      />

      {/* Wishlist Drawer Panel */}
      <WishlistDrawer
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        favorites={favorites}
        patterns={patterns}
        onToggleFavorite={handleToggleFavorite}
        onAddToCart={handleAddToCart}
        onQuickView={setQuickViewPattern}
      />

      {/* Track Order Modal */}
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

      {/* Consultation Booking Modal */}
      <ConsultationBookingModal
        isOpen={isConsultationOpen}
        onClose={() => setIsConsultationOpen(false)}
        currentUser={currentUser}
      />

      {/* Clean, Minimal Stackable Toast Notifications */}
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none"
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
        patterns={patterns}
        onLoginSuccess={(user) => {
          addToast(`Welcome back, ${user.fullName}. Authenticated successfully.`, 'success', 'Session Activated');
          // Sync size calculator or preferences automatically if needed
          if (user?.sizingProfile) {
            setGeneralRecommendedSize(user.sizingProfile.bustSize || '8');
          }
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
            activeRecommendedSize={generalRecommendedSize}
            isFavorite={favorites.includes(quickViewPattern.id)}
            onToggleFavorite={handleToggleFavorite}
            reviews={reviews[quickViewPattern.id] || []}
            onAddReview={handleAddReview}
          />
        )}
      </AnimatePresence>

      <FabricStashModal
        isOpen={isFabricStashOpen}
        onClose={() => setIsFabricStashOpen(false)}
      />

      {/* One-Time Shared Token Technical Spec & Development Secrets Modal */}
      <AnimatePresence>
        {sharedTokenAccess && (
          <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
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
                    <Key className="w-3.5 h-3.5 text-amber-400" /> One-Time Token Grant Verified
                  </span>
                  <span className="text-stone-400 text-xs font-mono">Read-Only Session</span>
                </div>
                <h3 className="text-2xl font-serif text-amber-50">{sharedTokenAccess.pattern.name} — Technical Specs &amp; Secrets</h3>
                <p className="text-xs text-stone-300 leading-relaxed font-sans">
                  You have been granted one-time collaborator access to inspect private technical specifications, seam allowance notes, and industrial assembly sequences for this garment.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                <div className="p-4 bg-stone-950/80 rounded-xl border border-stone-800 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-amber-300 font-bold block">Garment Technical Overview</span>
                  <p className="text-stone-300 leading-relaxed">
                    {sharedTokenAccess.pattern.description}
                  </p>
                  <div className="pt-2 text-[11px] font-mono text-stone-400 space-y-1">
                    <div>• Category: <span className="text-amber-100">{sharedTokenAccess.pattern.category}</span></div>
                    <div>• Skill Level: <span className="text-amber-100">{sharedTokenAccess.pattern.difficulty}</span></div>
                    <div>• Recommended Yardage: <span className="text-amber-100">{sharedTokenAccess.pattern.recommendedYards || '3.0 Yds'}</span></div>
                  </div>
                </div>

                <div className="p-4 bg-stone-950/80 rounded-xl border border-stone-800 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-amber-300 font-bold block">Seam Allowance &amp; Construction Secrets</span>
                  <p className="text-stone-300 font-mono text-[11px] leading-relaxed">
                    • Major Seam Allowance: 5/8" (1.5 cm)<br />
                    • Facing Seams: 3/8" (1.0 cm)<br />
                    • Secret Tip: Pre-wash fabric with neutral textile enzyme wash prior to cutting for zero shrinkage.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-xl flex items-center justify-between text-xs text-amber-200/90 font-mono">
                <span>Token Ref: {sharedTokenAccess.token.substring(0, 24)}...</span>
                <span className="font-bold text-amber-300">1-Time Grant Active</span>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setSharedTokenAccess(null)}
                  className="bg-amber-400 hover:bg-amber-500 text-stone-950 text-xs font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md"
                >
                  Close Spec Viewer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </RoleProvider>
  );
}
