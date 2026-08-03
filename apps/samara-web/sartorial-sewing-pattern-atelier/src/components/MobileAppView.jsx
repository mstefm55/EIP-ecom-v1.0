/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag, Compass, Scissors, Ruler, Printer, BookOpen,
  Search, Heart, Mail, Check, Star, RefreshCw, LayoutGrid,
  User, Sparkles, X, ChevronRight, ArrowLeft, Minus, Plus, Trash2,
  Cloud, UploadCloud, DownloadCloud, FileText, LogIn, LogOut, Info,
  Layers, AlertCircle, ChevronLeft, ChevronsLeft, ChevronsRight,
  Clock, Activity
} from 'lucide-react';

import SewingSessionTimer from './SewingSessionTimer.jsx';
import { SEWING_PATTERNS, MASTER_SIZING_TABLE } from '../data.js';
import { MEASUREMENT_POSITIONS } from '../data_positions.js';
import {
  initAuth,
  googleSignIn,
  logout,
  saveJsonToDrive,
  saveTextToDrive,
  listAppFilesFromDrive,
  readJsonFromDrive,
  deleteFileFromDrive
} from '../googleAuth.js';

// Mannequin interactive hot spots coordinates optimized for mobile scaling
const LEGEND_COORDINATES = {
  1: { left: '50%', top: '11%' },   // Neck
  2: { left: '29%', top: '16%' },   // Shoulder
  3: { left: '50%', top: '23%' },   // Bust
  4: { left: '50%', top: '35%' },   // Front Waist Length
  5: { left: '50%', top: '39%' },   // Waist Girth
  6: { left: '50%', top: '50%' },   // Hip Girth
  7: { left: '42%', top: '70%' },   // Inseam
};

export default function MobileAppView({
  cartItems,
  onAddToCart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  currentUser,
  onOpenAuthModal,
  reviews,
  onAddReview,
  patterns = SEWING_PATTERNS
}) {
  // Mobile Active Tab: 'catalog' | 'fitting' | 'academy' | 'profile'
  const [activeTab, setActiveTab] = useState('catalog');

  // Catalog Filters
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile Pagination states
  const [itemsPerPage, setItemsPerPage] = useState(24);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page to 1 when filters or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedDifficulty, searchQuery, itemsPerPage]);

  // Selected pattern for detail overlay view
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [detailTab, setDetailTab] = useState('overview'); // 'overview' | 'sizing' | 'reviews'

  // Review inputs
  const [newReviewName, setNewReviewName] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewTitle, setNewReviewTitle] = useState('');
  const [newReviewComment, setNewReviewComment] = useState('');
  const [reviewSubmitStatus, setReviewSubmitStatus] = useState('');

  // Cart Tray open status
  const [isCartOpen, setIsCartOpen] = useState(false);

  // --- MOBILE FITTING ROOM STATES ---
  const [unit, setUnit] = useState('in');
  const [neck, setNeck] = useState(13.5);
  const [shoulder, setShoulder] = useState(4.7);
  const [bust, setBust] = useState(36.0);
  const [frontWaist, setFrontWaist] = useState(16.2);
  const [waist, setWaist] = useState(28.0);
  const [hips, setHips] = useState(38.0);
  const [inseam, setInseam] = useState(31.0);
  const [height, setHeight] = useState(65.0); // 5'5"
  const [activeHotspotId, setActiveHotspotId] = useState(3); // Default to bust

  // Fitting room sub-tabs: 'mannequin' | 'metrics' | 'cloud'
  const [fittingSubTab, setFittingSubTab] = useState('mannequin');

  // Mobile newsletter subscription states
  const [mobileNewsEmail, setMobileNewsEmail] = useState('');
  const [mobileNewsSubscribed, setMobileNewsSubscribed] = useState(false);

  const handleMobileNewsletterSubmit = (e) => {
    e.preventDefault();
    if (mobileNewsEmail) {
      const trimmedEmail = mobileNewsEmail.trim();
      let currentSubs = [];
      try {
        const saved = localStorage.getItem('perfectfit_newsletter_subscribers');
        if (saved) currentSubs = JSON.parse(saved);
      } catch (err) {}

      const alreadySubscribed = currentSubs.some(
        (sub) => sub.email.toLowerCase() === trimmedEmail.toLowerCase()
      );

      if (!alreadySubscribed) {
        currentSubs.push({
          email: trimmedEmail,
          timestamp: new Date().toISOString(),
          source: 'Mobile App View'
        });
        try {
          localStorage.setItem('perfectfit_newsletter_subscribers', JSON.stringify(currentSubs));
        } catch (err) {}
      }
      setMobileNewsSubscribed(true);
      setMobileNewsEmail('');
      setTimeout(() => {
        setMobileNewsSubscribed(false);
      }, 7000);
    }
  };

  // Google Drive integrations
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [driveUser, setDriveUser] = useState(null);
  const [driveFiles, setDriveFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync Google Drive Auth status
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setIsDriveConnected(true);
        setDriveUser(user);
        setIsLoadingFiles(true);
        listAppFilesFromDrive()
          .then(files => setDriveFiles(files))
          .catch(err => console.error(err))
          .finally(() => setIsLoadingFiles(false));
      },
      () => {
        setIsDriveConnected(false);
        setDriveUser(null);
        setDriveFiles([]);
      }
    );
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const fetchDriveFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const files = await listAppFilesFromDrive();
      setDriveFiles(files);
    } catch (err) {
      console.error('Failed to load Google Drive files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleGoogleDriveSignIn = async () => {
    setIsSyncing(true);
    setSyncStatus('Connecting...');
    try {
      const res = await googleSignIn();
      if (res) {
        setIsDriveConnected(true);
        setDriveUser(res.user);
        setSyncStatus('Connected!');
        const files = await listAppFilesFromDrive();
        setDriveFiles(files);
      }
    } catch (err) {
      console.error('Google Drive sign-in failed:', err);
      setSyncStatus('Connection failed.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(''), 4000);
    }
  };

  const handleGoogleDriveLogout = async () => {
    setIsSyncing(true);
    setSyncStatus('Signing out...');
    try {
      await logout();
      setIsDriveConnected(false);
      setDriveUser(null);
      setDriveFiles([]);
      setSyncStatus('Disconnected.');
    } catch (err) {
      console.error('Sign-out failed:', err);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(''), 4000);
    }
  };

  // Unit changes converter
  const handleUnitChange = (newUnit) => {
    if (newUnit === unit) return;
    const factor = newUnit === 'cm' ? 2.54 : 1 / 2.54;

    setBust((prev) => parseFloat((prev * factor).toFixed(1)));
    setWaist((prev) => parseFloat((prev * factor).toFixed(1)));
    setHips((prev) => parseFloat((prev * factor).toFixed(1)));
    setHeight((prev) => parseFloat((prev * factor).toFixed(0)));

    setNeck((prev) => parseFloat((prev * factor).toFixed(1)));
    setShoulder((prev) => parseFloat((prev * factor).toFixed(1)));
    setFrontWaist((prev) => parseFloat((prev * factor).toFixed(1)));
    setInseam((prev) => parseFloat((prev * factor).toFixed(1)));

    setUnit(newUnit);
  };

  // Normalize metrics to imperial inches for standard sizing lookup
  const parsedMeasurements = useMemo(() => {
    if (unit === 'cm') {
      return {
        bust: parseFloat((bust / 2.54).toFixed(1)),
        waist: parseFloat((waist / 2.54).toFixed(1)),
        hips: parseFloat((hips / 2.54).toFixed(1)),
        height: parseFloat((height / 2.54).toFixed(1)),
        unit: 'cm',
      };
    }
    return { bust, waist, hips, height, unit: 'in' };
  }, [bust, waist, hips, height, unit]);

  // Advisor sizing suggestion
  const recommendation = useMemo(() => {
    const { bust: bIn, waist: wIn, hips: hIn, height: htIn } = parsedMeasurements;

    // Standard EN 13402 mapping lookup algorithm
    let bRec = '0';
    for (let i = 0; i < MASTER_SIZING_TABLE.length; i++) {
      if (bIn <= MASTER_SIZING_TABLE[i].bust) {
        bRec = MASTER_SIZING_TABLE[i].size;
        break;
      }
      bRec = '22'; // fallback cap
    }

    let wRec = '0';
    for (let i = 0; i < MASTER_SIZING_TABLE.length; i++) {
      if (wIn <= MASTER_SIZING_TABLE[i].waist) {
        wRec = MASTER_SIZING_TABLE[i].size;
        break;
      }
      wRec = '22';
    }

    let hRec = '0';
    for (let i = 0; i < MASTER_SIZING_TABLE.length; i++) {
      if (hIn <= MASTER_SIZING_TABLE[i].hips) {
        hRec = MASTER_SIZING_TABLE[i].size;
        break;
      }
      hRec = '22';
    }

    // Advice text logic matching measurements
    let summaryText = `We advise grading your sewing pattern from a Size ${bRec} in the bust down to a Size ${wRec} at the waist, and out to a Size ${hRec} over the hips.`;
    if (bRec === wRec && wRec === hRec) {
      summaryText = `Your proportions map consistently to a standard Perfect Fit Size ${bRec}. This will require zero grading between pattern pieces!`;
    }

    let customAdvice = "Trace your pattern sheets carefully, connecting the graded lines with a curved French ruler. This ensures a beautifully tailored finish on the seams.";
    if (Math.abs(parseInt(bRec) - parseInt(hRec)) >= 4) {
      customAdvice = "Because your hip measurement is 2+ sizes different than your bust, we highly recommend slashing and spreading the bodice skirt using the pivot adjustment lines on sheet B.";
    }

    let htAdvice = "No height adjustments are required; this pattern is designed for heights of 5'4\" to 5'6\".";
    if (htIn < 62.5) {
      htAdvice = `At ${unit === 'in' ? `${Math.floor(height/12)}'${height%12}"` : `${height}cm`}, shorten the bodice panels by 1 inch at the marked lengthening/shortening lines before cutting fabric.`;
    } else if (htIn > 68.5) {
      htAdvice = `At ${unit === 'in' ? `${Math.floor(height/12)}'${height%12}"` : `${height}cm`}, we recommend adding 1.5 inches to the length using the guidelines printed on the tissue template.`;
    }

    return {
      bustRec: bRec,
      waistRec: wRec,
      hipsRec: hRec,
      summary: summaryText,
      advice: customAdvice,
      heightAdvice: htAdvice
    };
  }, [parsedMeasurements]);

  // Google Drive Handlers
  const handleBackupLedger = async () => {
    if (!isDriveConnected) return;
    setIsSyncing(true);
    setSyncStatus('Uploading...');
    try {
      const ledgerData = {
        unit,
        neck,
        shoulder,
        bust,
        frontWaist,
        waist,
        hips,
        inseam,
        height,
        timestamp: new Date().toISOString(),
        advisorSize: recommendation.bustRec
      };

      const dateString = new Date().toLocaleDateString().replace(/\//g, '-');
      const filename = `perfectfit_bureau_measurements_${dateString}.json`;

      await saveJsonToDrive(ledgerData, filename);
      setSyncStatus(`Uploaded: ${filename}`);
      const files = await listAppFilesFromDrive();
      setDriveFiles(files);
    } catch (err) {
      console.error(err);
      setSyncStatus('Backup failed.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(''), 4000);
    }
  };

  const handleSaveReport = async () => {
    if (!isDriveConnected) return;
    setIsSyncing(true);
    setSyncStatus('Generating report...');
    try {
      const reportMarkdown = `# Perfect Fit Bureau Tailoring Report
Generated on: ${new Date().toLocaleString()}

## Sizing Ledger Profile (Unit: ${unit})
- **Body Height**: ${unit === 'in' ? `${Math.floor(height / 12)}'${height % 12}"` : `${height} cm`}
- **Neck Girth**: ${neck} ${unit}
- **Shoulder Length**: ${shoulder} ${unit}
- **Bust/Chest Girth**: ${bust} ${unit}
- **Front Waist**: ${frontWaist} ${unit}
- **Waist Girth**: ${waist} ${unit}
- **Hip Girth**: ${hips} ${unit}
- **Inseam Leg**: ${inseam} ${unit}

## Sizing Advice & Pattern Gradients
- **Bust Graded Size**: Size ${recommendation.bustRec}
- **Waist Graded Size**: Size ${recommendation.waistRec}
- **Hip Graded Size**: Size ${recommendation.hipsRec}

### Graded Fitting Summary
${recommendation.summary}

---
*Created on Perfect Fit Bureau Pattern Studio (Mobile Cloud Vault)*`;

      const dateString = new Date().toLocaleDateString().replace(/\//g, '-');
      const filename = `perfectfit_bureau_report_${dateString}.md`;

      await saveTextToDrive(reportMarkdown, filename);
      setSyncStatus(`Saved report to Drive!`);
      const files = await listAppFilesFromDrive();
      setDriveFiles(files);
    } catch (err) {
      console.error(err);
      setSyncStatus('Save failed.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(''), 4000);
    }
  };

  const handleRestoreLedger = async (file) => {
    const confirmed = window.confirm(`Restore measurements from "${file.name}"? Current screen values will be overwritten.`);
    if (!confirmed) return;
    setIsSyncing(true);
    try {
      const ledger = await readJsonFromDrive(file.id);
      if (ledger.unit) setUnit(ledger.unit);
      if (ledger.neck !== undefined) setNeck(ledger.neck);
      if (ledger.shoulder !== undefined) setShoulder(ledger.shoulder);
      if (ledger.bust !== undefined) setBust(ledger.bust);
      if (ledger.frontWaist !== undefined) setFrontWaist(ledger.frontWaist);
      if (ledger.waist !== undefined) setWaist(ledger.waist);
      if (ledger.hips !== undefined) setHips(ledger.hips);
      if (ledger.inseam !== undefined) setInseam(ledger.inseam);
      if (ledger.height !== undefined) setHeight(ledger.height);
      setSyncStatus('Restored!');
    } catch (err) {
      console.error(err);
      setSyncStatus('Restore failed.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(''), 4000);
    }
  };

  const handleDeleteFile = async (file) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${file.name}" from Google Drive?`);
    if (!confirmed) return;
    setIsSyncing(true);
    try {
      await deleteFileFromDrive(file.id);
      setSyncStatus('Deleted.');
      const files = await listAppFilesFromDrive();
      setDriveFiles(files);
    } catch (err) {
      console.error(err);
      setSyncStatus('Delete failed.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(''), 4000);
    }
  };

  // Helper to get active hotspot information
  const getActiveHotspotDetails = (id) => {
    switch (id) {
      case 1:
        return { name: 'Neck Girth', value: neck, setValue: setNeck, min: unit === 'in' ? 11.5 : 29.0, max: unit === 'in' ? 16.5 : 42.0, step: 0.1, desc: 'Base of the neck, level at the back.' };
      case 2:
        return { name: 'Shoulder', value: shoulder, setValue: setShoulder, min: unit === 'in' ? 4.0 : 10.0, max: unit === 'in' ? 6.5 : 16.5, step: 0.1, desc: 'From neck point to shoulder socket.' };
      case 3:
        return { name: 'Bust/Chest', value: bust, setValue: setBust, min: unit === 'in' ? 30.0 : 52.0, max: unit === 'in' ? 52.0 : 132.0, step: 0.5, desc: 'Horizontal line at fullest chest point.' };
      case 4:
        return { name: 'Front Waist', value: frontWaist, setValue: setFrontWaist, min: unit === 'in' ? 14.5 : 37.0, max: unit === 'in' ? 18.5 : 47.0, step: 0.1, desc: 'High shoulder down to natural waist.' };
      case 5:
        return { name: 'Waist Girth', value: waist, setValue: setWaist, min: unit === 'in' ? 22.0 : 56.0, max: unit === 'in' ? 44.0 : 112.0, step: 0.5, desc: 'Natural narrow line above hip bones.' };
      case 6:
        return { name: 'Hip Girth', value: hips, setValue: setHips, min: unit === 'in' ? 32.0 : 81.0, max: unit === 'in' ? 54.0 : 137.0, step: 0.5, desc: 'Widest circumference at full seat.' };
      case 7:
        return { name: 'Inside Leg', value: inseam, setValue: setInseam, min: unit === 'in' ? 28.0 : 71.0, max: unit === 'in' ? 35.5 : 90.0, step: 0.5, desc: 'Inner crotch down to the floor level.' };
      default:
        return null;
    }
  };

  const activeHotspot = getActiveHotspotDetails(activeHotspotId);

  // Filtered patterns logic
  const filteredPatterns = useMemo(() => {
    return patterns.filter((p) => {
      const matchCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchDifficulty = selectedDifficulty === 'All' || p.difficulty === selectedDifficulty;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.difficulty.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchDifficulty && matchSearch;
    });
  }, [patterns, selectedCategory, selectedDifficulty, searchQuery]);

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

  // Handle Review submission
  const handleSubmitReview = (e, patternId) => {
    e.preventDefault();
    if (!newReviewName || !newReviewTitle || !newReviewComment) {
      setReviewSubmitStatus('Please fill in all review details.');
      return;
    }

    const item = {
      id: `mobile-rev-${Date.now()}`,
      name: newReviewName,
      rating: newReviewRating,
      title: newReviewTitle,
      comment: newReviewComment,
      date: new Date().toISOString().slice(0, 10)
    };

    onAddReview(patternId, item);
    setReviewSubmitStatus('Review added with success!');

    // Clear inputs
    setNewReviewName('');
    setNewReviewTitle('');
    setNewReviewComment('');
    setTimeout(() => setReviewSubmitStatus(''), 4500);
  };

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const totalCartValue = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5] text-bark-900 select-none max-w-md mx-auto relative overflow-hidden font-sans border-x border-sand-200 shadow-2xl" id="mobile-app-shell">

      {/* 1. APP BAR HEADER */}
      <header className="px-4 py-4 border-b border-sand-200/50 bg-white flex items-center justify-between z-10">
        <div className="flex flex-col">
          <span className="font-serif text-base font-semibold uppercase tracking-[0.15em] text-bark-950">Perfect Fit</span>
          <span className="text-[6.5px] tracking-[0.25em] text-bark-400 font-mono font-bold block uppercase mt-0.5">BUREAU</span>
        </div>

        {/* Header Right Widgets */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <img
              src={currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150"}
              alt={currentUser.fullName}
              className="w-7 h-7 rounded-full object-cover border border-clay-200"
              onClick={() => setActiveTab('profile')}
              referrerPolicy="no-referrer"
            />
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="p-1.5 rounded-full border border-sand-250 hover:bg-sand-50 cursor-pointer"
            >
              <User className="w-4 h-4 text-bark-600" />
            </button>
          )}

          {/* Sizing Indicator badge linked to fitting tab */}
          <button
            onClick={() => setActiveTab('fitting')}
            className="bg-clay-50 border border-clay-200 rounded-[4px] px-2 py-1 text-[9px] font-mono font-bold text-clay-700 flex items-center gap-1 cursor-pointer"
          >
            <Ruler className="w-3 h-3 text-clay-605" />
            Size {recommendation.bustRec}
          </button>

          {/* Cart triggers bottom tray */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 bg-bark-900 text-white rounded-full transition-all active:scale-95 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-clay-605 text-white text-[8px] font-mono font-bold w-4 h-4 flex items-center justify-center rounded-full border border-white">
                {totalCartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 2. TAB VIEWS PANELS */}
      <main className="flex-1 overflow-y-auto pb-24" id="mobile-views-container">
        <AnimatePresence mode="wait">

          {/* TAB A: CATALOGUE OF PATTERNS */}
          {activeTab === 'catalog' && (
            <motion.div
              key="catalog"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 space-y-4"
            >
              {/* Search Banner */}
              <div className="relative border border-sand-200 bg-white rounded-full flex items-center px-3 py-2 shadow-3xs">
                <Search className="w-4 h-4 text-bark-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search curated pattern blueprints..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none text-xs w-full focus:outline-none text-bark-800 placeholder-bark-400 font-sans"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="p-0.5 text-bark-400 hover:text-bark-750">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Horizontal Category Pill Selector */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" id="mobile-category-pills">
                {['All', 'Dresses', 'Outerwear', 'Trousers', 'Tops'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer shrink-0 ${
                      selectedCategory === cat
                        ? 'bg-clay-605 border-clay-605 text-white shadow-3xs'
                        : 'bg-white border-sand-200 text-bark-600 hover:border-sand-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Pattern list card items */}
              {filteredPatterns.length === 0 ? (
                <div className="text-center py-12 bg-white border border-sand-200 rounded-xl space-y-2">
                  <Scissors className="w-6 h-6 text-bark-400 mx-auto" />
                  <h3 className="text-xs font-bold text-bark-900">No patterns fit selection</h3>
                  <p className="text-[10px] text-bark-500 max-w-xs mx-auto">Try resetting category or search criteria.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {paginatedPatterns.map((pattern) => (
                      <div
                        key={pattern.id}
                        onClick={() => {
                          setSelectedPattern(pattern);
                          setDetailTab('overview');
                        }}
                        className="bg-white border border-sand-200 rounded-xl overflow-hidden flex cursor-pointer hover:border-sand-350 transition-all shadow-3xs relative"
                      >
                        <div className="w-24 h-28 relative shrink-0">
                          <img
                            src={pattern.image}
                            alt={pattern.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <span className={`absolute top-1.5 left-1.5 text-[7px] font-bold font-mono px-1.5 py-0.5 rounded-[3px] shadow-3xs border uppercase ${
                            pattern.difficulty === 'Beginner' ? 'bg-emerald-50 border-emerald-100 text-emerald-805' :
                            pattern.difficulty === 'Intermediate' ? 'bg-clay-50 border-clay-100 text-clay-705' :
                            'bg-amber-50 border-amber-100 text-amber-755'
                          }`}>
                            {pattern.difficulty}
                          </span>
                        </div>

                        <div className="p-3 flex-1 flex flex-col justify-between min-w-0">
                          <div>
                            <div className="flex justify-between items-start">
                              <h3 className="font-serif font-semibold text-bark-900 text-sm leading-tight truncate pr-1">
                                {pattern.name}
                              </h3>
                              <span className="text-xs font-mono font-bold text-clay-700 shrink-0">
                                ${pattern.pricePDF}
                              </span>
                            </div>
                            <p className="text-[10px] text-bark-500 mt-0.5 truncate">{pattern.tagline}</p>
                            <p className="text-[10px] text-bark-600 line-clamp-2 mt-1 leading-normal">
                              {pattern.description}
                            </p>
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-sand-100 mt-2">
                            <span className="text-[8.5px] font-mono text-bark-400">
                              Sizes: 0 - 22
                            </span>
                            <span className="text-[9px] text-clay-650 font-bold uppercase tracking-wider flex items-center gap-0.5">
                              Details <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Dense Mobile Pagination Control Center */}
                  <div className="bg-white border border-sand-200 rounded-xl p-3 space-y-3 shadow-3xs text-xs font-sans text-bark-800" id="mobile-pagination-section">
                    {/* Part A: Page navigation buttons + page indicator */}
                    <div className="flex items-center justify-between gap-1">
                      {/* Navigation buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className={`p-1.5 rounded-lg border border-sand-200 bg-sand-50/50 text-bark-600 cursor-pointer ${currentPage === 1 ? 'opacity-30 pointer-events-none' : 'hover:bg-sand-100 active:scale-95'}`}
                          title="First Page"
                        >
                          <ChevronsLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className={`p-1.5 rounded-lg border border-sand-200 bg-sand-50/50 text-bark-600 cursor-pointer ${currentPage === 1 ? 'opacity-30 pointer-events-none' : 'hover:bg-sand-100 active:scale-95'}`}
                          title="Previous Page"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Dense Page Info */}
                      <span className="text-[10.5px] font-bold font-mono bg-sand-100 px-2.5 py-1 rounded-md text-bark-800 shrink-0">
                        Page {currentPage} of {totalPages}
                      </span>

                      {/* Right navigation buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className={`p-1.5 rounded-lg border border-sand-200 bg-sand-50/50 text-bark-600 cursor-pointer ${currentPage === totalPages ? 'opacity-30 pointer-events-none' : 'hover:bg-sand-100 active:scale-95'}`}
                          title="Next Page"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                          className={`p-1.5 rounded-lg border border-sand-200 bg-sand-50/50 text-bark-600 cursor-pointer ${currentPage === totalPages ? 'opacity-30 pointer-events-none' : 'hover:bg-sand-100 active:scale-95'}`}
                          title="Last Page"
                        >
                          <ChevronsRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Part B: Results indicator + page capacity dropdown */}
                    <div className="flex items-center justify-between pt-2 border-t border-sand-150 text-[10px] text-bark-500">
                      <span>
                        Showing {Math.min(filteredPatterns.length, (Number(currentPage) - 1) * Number(itemsPerPage) + 1)}–{Math.min(filteredPatterns.length, Number(currentPage) * Number(itemsPerPage))} of {filteredPatterns.length}
                      </span>

                      {/* Limit dropdown */}
                      <div className="flex items-center gap-1">
                        <span className="font-semibold uppercase tracking-wider text-[8.5px] text-bark-400">Per Page:</span>
                        <select
                          value={itemsPerPage}
                          onChange={(e) => setItemsPerPage(Number(e.target.value))}
                          className="bg-sand-100 text-bark-800 border border-sand-200 font-bold font-mono rounded px-1.5 py-0.5 text-[9px] focus:outline-none"
                        >
                          <option value={24}>24</option>
                          <option value={48}>48</option>
                          <option value={96}>96</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB B: INTERACTIVE FITTING ROOM / DRESS FORM */}
          {activeTab === 'fitting' && (
            <motion.div
              key="fitting"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 space-y-4"
            >
              {/* Sizing advisor summary banner */}
              <div className="bg-[#FAF8F5] border border-sand-200/80 rounded-xl p-3 space-y-2 shadow-3xs">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-clay-700 font-bold uppercase tracking-widest flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-clay-605" /> Perfect Fit Sizing Advisor
                  </span>

                  {/* Unit Toggler */}
                  <div className="bg-white border border-sand-200 p-0.5 rounded-full flex text-[9px] font-mono font-semibold shadow-3xs">
                    <button
                      onClick={() => handleUnitChange('in')}
                      className={`px-2 py-0.5 rounded-full transition-colors cursor-pointer ${unit === 'in' ? 'bg-bark-900 text-white' : 'text-bark-500 hover:text-bark-900'}`}
                    >
                      IN
                    </button>
                    <button
                      onClick={() => handleUnitChange('cm')}
                      className={`px-2 py-0.5 rounded-full transition-colors cursor-pointer ${unit === 'cm' ? 'bg-bark-900 text-white' : 'text-bark-500 hover:text-bark-900'}`}
                    >
                      CM
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1.5 border-y border-sand-200/60 text-center bg-white/45 rounded-md">
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-mono text-bark-400 uppercase tracking-widest block">Bust Size</span>
                    <span className="text-sm font-bold text-bark-900 font-mono">Size {recommendation.bustRec}</span>
                  </div>
                  <div className="space-y-0.5 border-x border-sand-200/50">
                    <span className="text-[8px] font-mono text-bark-400 uppercase tracking-widest block">Waist Size</span>
                    <span className="text-sm font-bold text-bark-900 font-mono">Size {recommendation.waistRec}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-mono text-bark-400 uppercase tracking-widest block">Hip Size</span>
                    <span className="text-sm font-bold text-bark-900 font-mono">Size {recommendation.hipsRec}</span>
                  </div>
                </div>

                <p className="text-[10px] text-bark-700 leading-normal font-medium bg-sand-50/50 px-2 py-1.5 rounded-[4px] border border-sand-150/40">
                  {recommendation.summary}
                </p>
              </div>

              {/* Segmented subtab controls: Mannequin | Metrics List | Cloud Vault */}
              <div className="flex bg-sand-100/50 border border-sand-200 rounded-lg p-1 text-[10px] font-bold tracking-wider uppercase font-sans">
                <button
                  onClick={() => setFittingSubTab('mannequin')}
                  className={`flex-1 py-1.5 rounded-md text-center transition-all cursor-pointer ${fittingSubTab === 'mannequin' ? 'bg-white text-bark-900 shadow-3xs font-extrabold' : 'text-bark-500'}`}
                >
                  Mannequin
                </button>
                <button
                  onClick={() => setFittingSubTab('metrics')}
                  className={`flex-1 py-1.5 rounded-md text-center transition-all cursor-pointer ${fittingSubTab === 'metrics' ? 'bg-white text-bark-900 shadow-3xs font-extrabold' : 'text-bark-500'}`}
                >
                  All Metrics
                </button>
                <button
                  onClick={() => setFittingSubTab('cloud')}
                  className={`flex-1 py-1.5 rounded-md text-center transition-all cursor-pointer ${fittingSubTab === 'cloud' ? 'bg-white text-bark-900 shadow-3xs font-extrabold' : 'text-bark-500'}`}
                >
                  Cloud Vault
                </button>
              </div>

              {/* Subtab Content Panels */}
              <AnimatePresence mode="wait">
                {/* SUBTAB 1: VISUAL MANNEQUIN INTERACTIVE GRID */}
                {fittingSubTab === 'mannequin' && (
                  <motion.div
                    key="sub-mannequin"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="space-y-4"
                  >
                    <div className="bg-[#FAF8F5] border border-sand-200 rounded-xl p-4 flex flex-col items-center justify-center min-h-[360px] relative overflow-hidden bg-gradient-to-b from-[#fdfcfb] via-[#f7f4ef] to-[#eeeae2]">
                      {/* Stylized neutral background lines */}
                      <div className="absolute inset-0 bg-[radial-gradient(#887857_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.04] pointer-events-none" />

                      {/* Mannequin graphic form */}
                      <div className="relative w-[180px] h-[310px] flex items-center justify-center z-10" id="mobile-mannequin-interactive">

                        {/* High contrast visual dress form SVG vector */}
                        <svg className="w-full h-full text-bark-900 filter drop-shadow-sm opacity-95" viewBox="0 0 200 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                          {/* Stand Pole Base */}
                          <line x1="100" y1="280" x2="100" y2="380" stroke="#786c55" strokeWidth="3" strokeLinecap="round" />
                          <path d="M70 380 L130 380" stroke="#786c55" strokeWidth="4" strokeLinecap="round" />
                          <path d="M85 380 L100 365 L115 380" fill="none" stroke="#786c55" strokeWidth="2.5" strokeLinecap="round" />

                          {/* Torso Dress Form Contour */}
                          <path
                            d="M93 45 C91 43, 109 43, 107 45 C113 46, 125 54, 134 62 C140 68, 145 74, 145 82 C145 92, 138 105, 134 116 C129 128, 128 140, 131 155 C134 172, 138 190, 137 205 C135 220, 128 235, 121 245 C115 252, 111 258, 111 264 L89 264 C89 258, 85 252, 79 245 C72 235, 65 220, 63 205 C62 190, 66 172, 69 155 C72 140, 71 128, 66 116 C62 105, 55 92, 55 82 C55 74, 60 68, 66 62 C75 54, 87 46, 93 45 Z"
                            fill="#F2ECE3"
                            stroke="#8e816a"
                            strokeWidth="2"
                            strokeLinejoin="round"
                          />
                          {/* Inner details contour */}
                          <path d="M100 45 L100 264" stroke="#d5cbba" strokeWidth="1" strokeDasharray="3,3" />
                          <path d="M68 116 C85 130, 115 130, 132 116" stroke="#e0d6c6" strokeWidth="1" fill="none" />
                          <path d="M69 155 C82 165, 118 165, 131 155" stroke="#e0d6c6" strokeWidth="1" fill="none" />
                          <path d="M63 205 C75 215, 125 215, 137 205" stroke="#e0d6c6" strokeWidth="1" fill="none" />
                        </svg>

                        {/* Interactive hotspot buttons */}
                        {MEASUREMENT_POSITIONS.map((pos) => {
                          const coord = LEGEND_COORDINATES[pos.id] || { left: '50%', top: '50%' };
                          const isSelected = activeHotspotId === pos.id;
                          return (
                            <button
                              key={pos.id}
                              onClick={() => setActiveHotspotId(pos.id)}
                              style={{ left: coord.left, top: coord.top }}
                              className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center font-mono text-[9px] font-bold border transition-all z-20 cursor-pointer ${
                                isSelected
                                  ? 'bg-clay-605 text-white scale-125 ring-4 ring-clay-605/20 border-clay-700 font-extrabold shadow-md'
                                  : 'bg-white text-bark-700 border-sand-300 hover:border-bark-500 hover:bg-sand-50 shadow-3xs'
                              }`}
                            >
                              {pos.id}
                            </button>
                          );
                        })}
                      </div>

                      {/* Small overlay floating instructions */}
                      <span className="absolute bottom-2 text-[8px] font-mono text-bark-400 uppercase tracking-widest block bg-white/60 px-2 py-0.5 rounded-[4px]">
                        Tap numbered markers to adjust measurements
                      </span>
                    </div>

                    {/* Active Hotspot Controls Box */}
                    {activeHotspot && (
                      <div className="bg-white border border-sand-200 rounded-xl p-4 space-y-3 shadow-3xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-mono font-bold text-clay-705 uppercase tracking-widest block">
                              Metric {activeHotspotId} of 7
                            </span>
                            <h4 className="text-xs font-bold text-bark-900">{activeHotspot.name}</h4>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold font-mono text-clay-750">
                              {activeHotspot.value} {unit}
                            </span>
                          </div>
                        </div>

                        <p className="text-[10px] text-bark-600 leading-normal">
                          {activeHotspot.desc}
                        </p>

                        {/* Custom Touch Slider Controls */}
                        <div className="flex items-center gap-3 pt-1">
                          <button
                            onClick={() => activeHotspot.setValue(prev => parseFloat(Math.max(activeHotspot.min, prev - activeHotspot.step).toFixed(1)))}
                            className="w-8 h-8 rounded-full border border-sand-250 flex items-center justify-center bg-sand-50/45 hover:bg-sand-100 transition-colors active:scale-90 cursor-pointer"
                          >
                            <Minus className="w-3 h-3 text-bark-700" />
                          </button>

                          <input
                            type="range"
                            min={activeHotspot.min}
                            max={activeHotspot.max}
                            step={activeHotspot.step}
                            value={activeHotspot.value}
                            onChange={(e) => activeHotspot.setValue(parseFloat(e.target.value))}
                            className="flex-1 accent-clay-605 h-1.5 bg-sand-150 rounded-lg cursor-pointer"
                          />

                          <button
                            onClick={() => activeHotspot.setValue(prev => parseFloat(Math.min(activeHotspot.max, prev + activeHotspot.step).toFixed(1)))}
                            className="w-8 h-8 rounded-full border border-sand-250 flex items-center justify-center bg-sand-50/45 hover:bg-sand-100 transition-colors active:scale-90 cursor-pointer"
                          >
                            <Plus className="w-3 h-3 text-bark-700" />
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* SUBTAB 2: ALL METRICS RAW INPUT LIST */}
                {fittingSubTab === 'metrics' && (
                  <motion.div
                    key="sub-metrics"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="bg-white border border-sand-200 rounded-xl p-3.5 space-y-3 shadow-3xs"
                  >
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-bark-900 uppercase tracking-widest font-serif">Perfect Fit Proportions Ledger</h4>
                      <p className="text-[10px] text-bark-450">Tweak all measurements directly in one continuous ledger form.</p>
                    </div>

                    <div className="space-y-2 pt-2 divide-y divide-sand-100">
                      {/* Height */}
                      <div className="flex items-center justify-between py-2 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-bark-850">Body Height</span>
                          <span className="text-[9px] text-bark-400 block font-mono">Designed height: 5'5" (165cm)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={height}
                            onChange={(e) => setHeight(parseFloat(e.target.value) || height)}
                            className="w-16 px-1.5 py-1 text-center font-mono border border-sand-250 rounded-md text-xs"
                          />
                          <span className="text-[10px] font-mono text-bark-500 uppercase">{unit}</span>
                        </div>
                      </div>

                      {/* Neck */}
                      <div className="flex items-center justify-between py-2 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-bark-850">1. Neck Girth (Base)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={neck}
                            onChange={(e) => setNeck(parseFloat(e.target.value) || neck)}
                            className="w-16 px-1.5 py-1 text-center font-mono border border-sand-250 rounded-md text-xs"
                          />
                          <span className="text-[10px] font-mono text-bark-500 uppercase">{unit}</span>
                        </div>
                      </div>

                      {/* Shoulder */}
                      <div className="flex items-center justify-between py-2 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-bark-850">2. Shoulder Length</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={shoulder}
                            onChange={(e) => setShoulder(parseFloat(e.target.value) || shoulder)}
                            className="w-16 px-1.5 py-1 text-center font-mono border border-sand-250 rounded-md text-xs"
                          />
                          <span className="text-[10px] font-mono text-bark-500 uppercase">{unit}</span>
                        </div>
                      </div>

                      {/* Bust */}
                      <div className="flex items-center justify-between py-2 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-bark-850">3. Bust/Chest Girth</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.5"
                            value={bust}
                            onChange={(e) => setBust(parseFloat(e.target.value) || bust)}
                            className="w-16 px-1.5 py-1 text-center font-mono border border-sand-250 rounded-md text-xs"
                          />
                          <span className="text-[10px] font-mono text-bark-500 uppercase">{unit}</span>
                        </div>
                      </div>

                      {/* Front Waist */}
                      <div className="flex items-center justify-between py-2 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-bark-850">4. Front Waist Length</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={frontWaist}
                            onChange={(e) => setFrontWaist(parseFloat(e.target.value) || frontWaist)}
                            className="w-16 px-1.5 py-1 text-center font-mono border border-sand-250 rounded-md text-xs"
                          />
                          <span className="text-[10px] font-mono text-bark-500 uppercase">{unit}</span>
                        </div>
                      </div>

                      {/* Waist */}
                      <div className="flex items-center justify-between py-2 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-bark-850">5. Waist Girth</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.5"
                            value={waist}
                            onChange={(e) => setWaist(parseFloat(e.target.value) || waist)}
                            className="w-16 px-1.5 py-1 text-center font-mono border border-sand-250 rounded-md text-xs"
                          />
                          <span className="text-[10px] font-mono text-bark-500 uppercase">{unit}</span>
                        </div>
                      </div>

                      {/* Hips */}
                      <div className="flex items-center justify-between py-2 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-bark-850">6. Hip Girth</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.5"
                            value={hips}
                            onChange={(e) => setHips(parseFloat(e.target.value) || hips)}
                            className="w-16 px-1.5 py-1 text-center font-mono border border-sand-250 rounded-md text-xs"
                          />
                          <span className="text-[10px] font-mono text-bark-500 uppercase">{unit}</span>
                        </div>
                      </div>

                      {/* Inseam */}
                      <div className="flex items-center justify-between py-2 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-bark-850">7. Inside Leg Length (Inseam)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.5"
                            value={inseam}
                            onChange={(e) => setInseam(parseFloat(e.target.value) || inseam)}
                            className="w-16 px-1.5 py-1 text-center font-mono border border-sand-250 rounded-md text-xs"
                          />
                          <span className="text-[10px] font-mono text-bark-500 uppercase">{unit}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* SUBTAB 3: GOOGLE DRIVE CLOUD VAULT */}
                {fittingSubTab === 'cloud' && (
                  <motion.div
                    key="sub-cloud"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="bg-white border border-sand-200 rounded-xl p-4 space-y-4 shadow-3xs"
                  >
                    <div className="flex justify-between items-center border-b border-sand-150 pb-2">
                      <h4 className="text-xs font-bold text-bark-900 uppercase tracking-widest flex items-center gap-1.5">
                        <Cloud className="w-4 h-4 text-clay-605" /> Mobile Cloud Vault
                      </h4>
                      {isSyncing && (
                        <RefreshCw className="w-3 h-3 text-clay-600 animate-spin" />
                      )}
                    </div>

                    {!isDriveConnected ? (
                      <div className="py-6 text-center space-y-3">
                        <Cloud className="w-8 h-8 text-bark-300 mx-auto" />
                        <div className="space-y-1 px-2">
                          <h5 className="text-xs font-bold text-bark-900">Google Drive Offline</h5>
                          <p className="text-[10px] text-bark-500 leading-normal">
                            Connect your Google account to back up custom sizing ledger profiles and download print-ready specifications directly from your phone.
                          </p>
                        </div>
                        <button
                          onClick={handleGoogleDriveSignIn}
                          disabled={isSyncing}
                          className="bg-bark-900 hover:bg-bark-850 text-white text-[10.5px] font-bold px-3 py-1.5 rounded-full cursor-pointer flex items-center gap-1.5 mx-auto transition-all"
                        >
                          <LogIn className="w-3.5 h-3.5" /> Sign In with Google
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Connected User Profile */}
                        <div className="flex items-center justify-between bg-sand-50 p-2.5 rounded-lg border border-sand-200">
                          <div className="flex items-center gap-2">
                            {driveUser?.photoURL ? (
                              <img
                                src={driveUser.photoURL}
                                alt={driveUser.displayName}
                                className="w-8 h-8 rounded-full border border-sand-250"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-clay-100 text-clay-850 font-bold flex items-center justify-center rounded-full text-[10px]">
                                GD
                              </div>
                            )}
                            <div>
                              <h5 className="text-[11px] font-bold text-bark-900">{driveUser?.displayName}</h5>
                              <p className="text-[8px] font-mono text-bark-450 truncate max-w-[140px]">{driveUser?.email}</p>
                            </div>
                          </div>

                          <button
                            onClick={handleGoogleDriveLogout}
                            className="text-[9px] text-clay-650 hover:text-clay-800 font-semibold underline cursor-pointer"
                          >
                            Disconnect
                          </button>
                        </div>

                        {/* Backups trigger buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={handleBackupLedger}
                            disabled={isSyncing}
                            className="bg-clay-605 hover:bg-clay-700 text-white text-[10px] font-bold py-2 px-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <UploadCloud className="w-3.5 h-3.5" /> Backup Ledger
                          </button>
                          <button
                            onClick={handleSaveReport}
                            disabled={isSyncing}
                            className="bg-white border border-sand-250 text-bark-800 text-[10px] font-bold py-2 px-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-clay-605" /> Save Report
                          </button>
                        </div>

                        {/* Backed up file list */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[9px] font-mono text-bark-400 uppercase tracking-widest pt-1">
                            <span>Saved Backups</span>
                            <button onClick={fetchDriveFiles} className="hover:text-bark-900 font-bold">
                              Refresh List
                            </button>
                          </div>

                          {isLoadingFiles ? (
                            <div className="py-6 flex items-center justify-center">
                              <RefreshCw className="w-4 h-4 text-clay-600 animate-spin" />
                            </div>
                          ) : driveFiles.length === 0 ? (
                            <p className="text-[10px] text-bark-400 italic text-center py-4 bg-sand-50/40 rounded-lg border border-dashed border-sand-200">
                              No app files discovered in Drive.
                            </p>
                          ) : (
                            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                              {driveFiles.map((file) => {
                                const isJson = file.mimeType === 'application/json';
                                return (
                                  <div
                                    key={file.id}
                                    className="p-2 border border-sand-150 bg-white hover:border-sand-300 rounded-md flex items-center justify-between gap-2 text-[10.5px]"
                                  >
                                    <div className="min-w-0 flex items-center gap-1.5">
                                      <FileText className="w-3.5 h-3.5 text-clay-605 shrink-0" />
                                      <div className="min-w-0">
                                        <span className="font-bold text-bark-900 block truncate" title={file.name}>
                                          {file.name}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {isJson && (
                                        <button
                                          onClick={() => handleRestoreLedger(file)}
                                          disabled={isSyncing}
                                          className="text-[9px] bg-sand-100 hover:bg-sand-200 text-bark-850 px-1.5 py-0.5 rounded font-bold cursor-pointer"
                                        >
                                          Restore
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDeleteFile(file)}
                                        disabled={isSyncing}
                                        className="p-1 text-bark-400 hover:text-clay-605 cursor-pointer"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* TAB C: ACADEMY / CREATOR BLOG SEWING LIBRARY */}
          {activeTab === 'academy' && (
            <motion.div
              key="academy"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 space-y-4"
            >
              {/* Academy masterclasses and guides list */}
              <div className="space-y-1.5">
                <span className="text-[9px] text-clay-700 font-mono font-bold uppercase tracking-widest block">Couture Masterclass Academy</span>
                <h3 className="text-xl font-serif text-bark-950 font-light">Perfect Fit Sewing Handbook</h3>
                <p className="text-[10px] text-bark-550 leading-relaxed">
                  Refine your tailoring techniques with our masterclasses, sewing principles, and bespoke guidelines.
                </p>
              </div>

              {/* Masterclass card 1 */}
              <div className="bg-white border border-sand-200 rounded-xl overflow-hidden p-3.5 space-y-3.5 shadow-3xs">
                <div className="flex justify-between items-start">
                  <span className="bg-clay-50 text-clay-705 text-[8.5px] font-mono font-bold px-2 py-0.5 border border-clay-100 rounded-full uppercase">
                    Finishing Finishes
                  </span>
                  <span className="text-[9px] font-mono text-bark-405 font-bold">12 Min Read</span>
                </div>
                <div className="space-y-1">
                  <h4 className="font-serif font-bold text-bark-900 text-sm">Perfecting the French Seam Contour</h4>
                  <p className="text-[10.5px] text-bark-600 leading-normal">
                    Learn to compile neat, enclosed double stitching on light silks and cotton voiles to ensure luxury shop quality.
                  </p>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-clay-650 pt-2 border-t border-sand-100">
                  <span>Explore Guidelines</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Masterclass card 2 */}
              <div className="bg-white border border-sand-200 rounded-xl overflow-hidden p-3.5 space-y-3.5 shadow-3xs">
                <div className="flex justify-between items-start">
                  <span className="bg-sage-50 text-sage-750 text-[8.5px] font-mono font-bold px-2 py-0.5 border border-sage-100 rounded-full uppercase">
                    Fitting Hacks
                  </span>
                  <span className="text-[9px] font-mono text-bark-405 font-bold">18 Min Read</span>
                </div>
                <div className="space-y-1">
                  <h4 className="font-serif font-bold text-bark-900 text-sm">Slash &amp; Spread Bodice Adjustments</h4>
                  <p className="text-[10.5px] text-bark-600 leading-normal">
                    A comprehensive walkthrough regarding waist and chest custom grading using tissue pivots to customize patterns for high-contrast figures.
                  </p>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-clay-650 pt-2 border-t border-sand-100">
                  <span>Explore Guidelines</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Masterclass card 3 */}
              <div className="bg-white border border-sand-200 rounded-xl overflow-hidden p-3.5 space-y-3.5 shadow-3xs">
                <div className="flex justify-between items-start">
                  <span className="bg-sand-100 text-bark-750 text-[8.5px] font-mono font-bold px-2 py-0.5 border border-sand-200 rounded-full uppercase">
                    Couture Textiles
                  </span>
                  <span className="text-[9px] font-mono text-bark-405 font-bold font-semibold">9 Min Read</span>
                </div>
                <div className="space-y-1">
                  <h4 className="font-serif font-bold text-bark-900 text-sm">Handling Sandwashed Silk and Cupro</h4>
                  <p className="text-[10.5px] text-bark-600 leading-normal">
                    Working with fluid bias fabrics. Learn how stay-tape applications prevent underarm wraps from warping.
                  </p>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-clay-650 pt-2 border-t border-sand-100">
                  <span>Explore Guidelines</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB D: ATELIER MEMBER PORTAL PROFILE */}
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 space-y-4"
            >
              {currentUser ? (
                <div className="space-y-4">
                  {/* Connected Profile Details */}
                  <div className="bg-white border border-sand-200 rounded-xl p-4 space-y-3.5 shadow-3xs text-center">
                    <img
                      src={currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150"}
                      alt={currentUser.fullName}
                      className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-clay-400 shadow-3xs"
                      referrerPolicy="no-referrer"
                    />
                    <div className="space-y-0.5">
                      <h4 className="text-base font-serif font-bold text-bark-900">{currentUser.fullName}</h4>
                      <p className="text-xs text-bark-500 font-mono font-medium">{currentUser.email}</p>

                      <div className="pt-2 flex justify-center gap-2">
                        {currentUser.role === 'collaborator' ? (
                          <span className="text-[8.5px] px-2.5 py-0.5 bg-clay-50 border border-clay-100 rounded-full font-mono text-clay-705 uppercase font-bold">Perfect Fit Seller</span>
                        ) : (
                          <span className="text-[8.5px] px-2.5 py-0.5 bg-sage-50 border border-sage-150 rounded-full font-mono text-sage-750 uppercase font-bold">Gold Club Member</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sizing profile ledger info */}
                  <div className="bg-white border border-sand-200 rounded-xl p-4 space-y-3 shadow-3xs">
                    <h4 className="text-xs font-bold text-bark-900 uppercase tracking-widest font-serif">Saved Sizing Profile</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2 bg-sand-50/50 rounded-md border border-sand-100">
                        <span className="text-[9px] text-bark-400 block font-mono">Bust Line</span>
                        <span className="font-bold text-bark-900">{bust} {unit}</span>
                      </div>
                      <div className="p-2 bg-sand-50/50 rounded-md border border-sand-100">
                        <span className="text-[9px] text-bark-400 block font-mono">Waist Line</span>
                        <span className="font-bold text-bark-900">{waist} {unit}</span>
                      </div>
                      <div className="p-2 bg-sand-50/50 rounded-md border border-sand-100">
                        <span className="text-[9px] text-bark-400 block font-mono">Hips Line</span>
                        <span className="font-bold text-bark-900">{hips} {unit}</span>
                      </div>
                      <div className="p-2 bg-sand-50/50 rounded-md border border-sand-100">
                        <span className="text-[9px] text-bark-400 block font-mono">Target Height</span>
                        <span className="font-bold text-bark-900">{height} {unit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#FAF8F5] p-3 rounded-lg border border-sand-200 text-center">
                    <p className="text-[10px] text-bark-500 italic">Welcome to Perfect Fit Bureau Sizing Studio, crafting elegance with absolute precision.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-sand-200 rounded-xl p-6 text-center space-y-4 shadow-3xs">
                  <User className="w-12 h-12 text-bark-300 mx-auto" />
                  <div className="space-y-1.5 px-2">
                    <h4 className="text-sm font-serif font-bold text-bark-900">Unlock Perfect Fit Gold Club</h4>
                    <p className="text-[11px] text-bark-500 leading-normal">
                      Sign in to your private Perfect Fit member account to manage orders, customize sizing profiles, and save design specifications.
                    </p>
                  </div>
                  <button
                    onClick={onOpenAuthModal}
                    className="bg-bark-900 hover:bg-bark-850 text-white text-xs font-bold px-4 py-2 rounded-full cursor-pointer transition-all mx-auto active:scale-95"
                  >
                    Register / Sign In
                  </button>
                </div>
              )}

              {/* Mobile-optimized Newsletter Sign-up card */}
              <div className="bg-bark-950 text-sand-50 rounded-xl p-5 space-y-3 shadow-sm" id="mobile-newsletter-card">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-clay-400 shrink-0" />
                  <h4 className="text-xs font-serif font-bold uppercase tracking-widest text-sand-100">Mailing Registry</h4>
                </div>
                <p className="text-[10px] text-sand-200 leading-relaxed">
                  Join our seasonal registry to receive instant alerts on collection drops, tailoring handbooks, and styling workshops.
                </p>

                <form onSubmit={handleMobileNewsletterSubmit} className="flex gap-1.5 pt-1">
                  <input
                    type="email"
                    placeholder="name@perfectfit.com"
                    value={mobileNewsEmail}
                    onChange={(e) => setMobileNewsEmail(e.target.value)}
                    required
                    className="bg-bark-900 border border-bark-800 text-sand-50 text-[10.5px] px-3 py-1.5 rounded-lg focus:outline-none focus:border-clay-500 w-full font-sans"
                    id="mobile-news-input"
                  />
                  <button
                    type="submit"
                    className="bg-sand-100 hover:bg-sand-200 text-bark-950 text-[10.5px] font-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer shrink-0 font-sans active:scale-95"
                    id="mobile-news-submit"
                  >
                    {mobileNewsSubscribed ? 'Done!' : 'Register'}
                  </button>
                </form>

                {mobileNewsSubscribed && (
                  <p className="text-[10px] text-emerald-400 flex items-start gap-1 leading-normal transition-all duration-300 animate-fade-in pt-1" id="mobile-news-success">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Registered! Use code <b className="text-amber-300 font-mono select-all">ARTISAN15</b> for 15% off blueprints.</span>
                  </p>
                )}
              </div>

            </motion.div>
          )}

          {/* TAB E: SEWING SESSION TIMER & TIME STUDY TOOL */}
          {activeTab === 'timer' && (
            <motion.div
              key="timer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 space-y-4"
            >
              <div className="bg-white border border-sand-200 rounded-xl p-3 shadow-3xs">
                <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-sand-100">
                  <span className="p-1.5 bg-clay-50 border border-clay-100 rounded-lg text-clay-700">
                    <Clock className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-bark-900 uppercase tracking-wider">Couture Sewing Room</h3>
                    <p className="text-[10px] text-bark-450 leading-none">Industrial companion &amp; study tool</p>
                  </div>
                </div>

                <p className="text-[10.5px] text-bark-650 leading-relaxed">
                  Step-by-step assembly timers, real-time stopwatch logs, fabric inventory management, and video motion study.
                </p>
              </div>

              <SewingSessionTimer patterns={patterns} />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* 3. PATTERN DETAILS OVERLAY POP-UP SHEET */}
      <AnimatePresence>
        {selectedPattern && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-0 bg-white z-40 flex flex-col max-w-md mx-auto"
            id="mobile-pattern-detail-sheet"
          >
            {/* Header row */}
            <div className="px-4 py-3.5 border-b border-sand-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <button
                onClick={() => setSelectedPattern(null)}
                className="p-1 text-bark-500 hover:text-bark-900 cursor-pointer flex items-center gap-1 font-semibold text-xs"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <h3 className="text-xs font-serif font-bold uppercase tracking-widest text-bark-900">Pattern Blueprint</h3>
              <button
                onClick={() => setSelectedPattern(null)}
                className="p-1 text-bark-400 hover:text-bark-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable specs */}
            <div className="flex-1 overflow-y-auto pb-24 p-4 space-y-4">
              <div className="relative h-64 rounded-xl overflow-hidden shadow-sm">
                <img
                  src={selectedPattern.image}
                  alt={selectedPattern.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute bottom-3 right-3 bg-bark-900/90 text-white text-[11px] font-mono font-bold px-2.5 py-1 rounded-[4px]">
                  PDF: ${selectedPattern.pricePDF} | Print: ${selectedPattern.pricePrinted}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-mono text-clay-705 uppercase font-bold tracking-widest">
                  {selectedPattern.category} &bull; Size {recommendation.bustRec} Recommended
                </span>
                <h2 className="font-serif font-bold text-2xl text-bark-950 leading-tight">
                  {selectedPattern.name}
                </h2>
                <p className="text-xs text-bark-505 font-medium italic">{selectedPattern.tagline}</p>
              </div>

              {/* Specs Tabs controls: Specs, Fabric, Reviews */}
              <div className="flex border-b border-sand-200 text-xs font-semibold">
                <button
                  onClick={() => setDetailTab('overview')}
                  className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${detailTab === 'overview' ? 'border-clay-605 text-clay-705' : 'border-transparent text-bark-500'}`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setDetailTab('sizing')}
                  className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${detailTab === 'sizing' ? 'border-clay-605 text-clay-705' : 'border-transparent text-bark-500'}`}
                >
                  Fabric Specs
                </button>
                <button
                  onClick={() => setDetailTab('reviews')}
                  className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${detailTab === 'reviews' ? 'border-clay-605 text-clay-705' : 'border-transparent text-bark-500'}`}
                >
                  Reviews
                </button>
              </div>

              {/* Subtab Content details */}
              <div className="text-xs leading-relaxed text-bark-750">
                {detailTab === 'overview' && (
                  <div className="space-y-4">
                    <p className="text-[11.5px] leading-relaxed text-bark-650">
                      {selectedPattern.description}
                    </p>

                    <div className="space-y-2">
                      <h4 className="font-bold text-bark-900 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-clay-605" /> Key Pattern Features
                      </h4>
                      <ul className="space-y-1.5 pl-4 list-disc text-[11px] text-bark-600">
                        {selectedPattern.features.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {detailTab === 'sizing' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5 bg-sand-50/50 p-3 rounded-lg border border-sand-150">
                      <h4 className="font-bold text-bark-900 uppercase tracking-widest text-[10px] font-mono">Suggested Textiles</h4>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedPattern.fabricSuggestions.map((fab, i) => (
                          <span key={i} className="bg-white border border-sand-200 text-bark-700 text-[10.5px] px-2 py-0.5 rounded-[4px]">
                            {fab}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      <div className="border border-sand-150 rounded-lg p-3 bg-white">
                        <span className="text-[8.5px] text-bark-400 block font-mono">Yardage Requirements (44" width)</span>
                        <span className="font-bold text-bark-900 block mt-0.5">{selectedPattern.yardageInfo.width44}</span>
                      </div>
                      <div className="border border-sand-150 rounded-lg p-3 bg-white">
                        <span className="text-[8.5px] text-bark-400 block font-mono">Yardage Requirements (60" width)</span>
                        <span className="font-bold text-bark-900 block mt-0.5">{selectedPattern.yardageInfo.width60}</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <h4 className="font-bold text-bark-900">Required Sewing Notions</h4>
                      <ul className="space-y-1 pl-4 list-disc text-bark-600 text-[11px]">
                        {selectedPattern.notions.map((not, i) => (
                          <li key={i}>{not}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {detailTab === 'reviews' && (
                  <div className="space-y-4">
                    {/* User reviews list */}
                    <div className="space-y-3">
                      {(reviews[selectedPattern.id] || []).length === 0 ? (
                        <p className="text-bark-500 italic text-center py-4 text-[11px]">
                          Be the first to add a review of this curated blueprint.
                        </p>
                      ) : (
                        (reviews[selectedPattern.id] || []).map((rev) => (
                          <div key={rev.id} className="p-3 bg-sand-50/40 border border-sand-200 rounded-lg space-y-1.5 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-bark-905">{rev.name}</span>
                              <span className="text-[10px] text-bark-400 font-mono">{rev.date}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`w-3 h-3 ${i < rev.rating ? 'text-clay-605 fill-clay-605' : 'text-sand-350'}`} />
                              ))}
                              <span className="text-[10.5px] font-bold text-bark-850 pl-1">{rev.title}</span>
                            </div>
                            <p className="text-[10.5px] text-bark-600 leading-normal italic">
                              "{rev.comment}"
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Review Form */}
                    <form onSubmit={(e) => handleSubmitReview(e, selectedPattern.id)} className="bg-sand-100/30 border border-sand-200 p-3.5 rounded-lg space-y-3">
                      <h4 className="font-serif font-semibold text-bark-900 text-xs">Write a bespoke review</h4>

                      {reviewSubmitStatus && (
                        <p className="text-[10px] text-clay-705 font-bold animate-pulse bg-clay-50 p-1 border border-clay-100 rounded text-center">
                          {reviewSubmitStatus}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="space-y-1">
                          <label className="text-[9.5px] font-semibold text-bark-500 uppercase block pl-0.5">Your Name</label>
                          <input
                            type="text"
                            required
                            value={newReviewName}
                            onChange={(e) => setNewReviewName(e.target.value)}
                            className="w-full bg-white border border-sand-200 rounded p-1.5 font-sans"
                            placeholder="e.g. Marie S."
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9.5px] font-semibold text-bark-500 uppercase block pl-0.5">Rating</label>
                          <select
                            value={newReviewRating}
                            onChange={(e) => setNewReviewRating(parseInt(e.target.value))}
                            className="w-full bg-white border border-sand-200 rounded p-1.5 text-xs font-sans"
                          >
                            <option value="5">5 Stars (Perfect)</option>
                            <option value="4">4 Stars (Great)</option>
                            <option value="3">3 Stars (Average)</option>
                            <option value="2">2 Stars (Poor)</option>
                            <option value="1">1 Star (Disaster)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs">
                        <label className="text-[9.5px] font-semibold text-bark-500 uppercase block pl-0.5">Review Headline</label>
                        <input
                          type="text"
                          required
                          value={newReviewTitle}
                          onChange={(e) => setNewReviewTitle(e.target.value)}
                          className="w-full bg-white border border-sand-200 rounded p-1.5"
                          placeholder="e.g. Stunning drape, easy assembly"
                        />
                      </div>

                      <div className="space-y-1 text-xs">
                        <label className="text-[9.5px] font-semibold text-bark-500 uppercase block pl-0.5">Your Comments</label>
                        <textarea
                          required
                          value={newReviewComment}
                          onChange={(e) => setNewReviewComment(e.target.value)}
                          rows="2"
                          className="w-full bg-white border border-sand-200 rounded p-1.5"
                          placeholder="Share your custom garment building experience..."
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-bark-900 hover:bg-bark-850 text-white text-[11px] font-bold py-1.5 rounded cursor-pointer transition-colors"
                      >
                        Submit Perfect Fit Review
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Add to Cart Footer Action bar */}
            <div className="p-3 border-t border-sand-200 bg-[#FAF8F5] flex items-center justify-between gap-3 absolute bottom-0 left-0 right-0 z-25">
              <div className="flex flex-col">
                <span className="text-[8.5px] font-mono text-bark-400 uppercase tracking-wider">Estimated Cost</span>
                <span className="text-sm font-extrabold text-clay-700 font-mono">${selectedPattern.pricePDF}</span>
              </div>
              <div className="flex gap-1.5 flex-1 max-w-[280px]">
                <button
                  onClick={() => {
                    onAddToCart(selectedPattern, 'PDF', recommendation.bustRec);
                    setSelectedPattern(null);
                  }}
                  className="flex-1 bg-clay-605 hover:bg-clay-700 text-white font-bold text-[10.5px] py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 active:scale-95 shadow-3xs"
                >
                  Add PDF Blueprint
                </button>
                <button
                  onClick={() => {
                    onAddToCart(selectedPattern, 'Printed', recommendation.bustRec);
                    setSelectedPattern(null);
                  }}
                  className="bg-white border border-sand-300 text-bark-850 font-bold text-[10.5px] py-2 px-3 rounded-lg hover:bg-sand-50 transition-all cursor-pointer flex items-center justify-center active:scale-95"
                  title="Add physical printed copy"
                >
                  Print
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. SHOPPING CART DRAWERS SLIDEOUT */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 bg-bark-950/40 z-50 flex justify-end max-w-md mx-auto" id="mobile-cart-container">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="w-80 h-full bg-white border-l border-sand-200 flex flex-col"
              id="mobile-cart-drawer"
            >
              {/* Cart Drawer Header */}
              <div className="p-4 border-b border-sand-200 flex items-center justify-between">
                <h3 className="font-serif font-bold text-sm uppercase tracking-wider text-bark-900 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-clay-605" /> Perfect Fit Cart
                </h3>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1 text-bark-400 hover:text-bark-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Cart Items list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cartItems.length === 0 ? (
                  <div className="py-20 text-center space-y-2">
                    <ShoppingBag className="w-8 h-8 text-bark-300 mx-auto" />
                    <p className="text-xs text-bark-500 italic">Your shopping cart is currently empty.</p>
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 border border-sand-200 rounded-lg flex items-start gap-2 text-xs"
                    >
                      <img
                        src={item.pattern.image}
                        alt={item.pattern.name}
                        className="w-12 h-14 object-cover rounded border"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="font-serif font-bold text-bark-900 truncate max-w-[110px] leading-tight">
                            {item.pattern.name}
                          </h4>
                          <span className="text-[10.5px] font-mono font-bold text-clay-700 shrink-0">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[9px] text-bark-450 uppercase font-mono block">
                          Format: <b>{item.format}</b> &bull; Size {item.sizePreference}
                        </p>

                        <div className="flex justify-between items-center pt-1">
                          <div className="flex items-center border border-sand-200 rounded bg-sand-50/50">
                            <button
                              onClick={() => onUpdateQuantity(item.id, -1)}
                              className="px-1.5 py-0.5 text-bark-500 hover:text-bark-900 cursor-pointer"
                            >
                              -
                            </button>
                            <span className="px-2 font-mono text-[10px] font-semibold text-bark-800">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => onUpdateQuantity(item.id, 1)}
                              className="px-1.5 py-0.5 text-bark-500 hover:text-bark-900 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                          <button
                            onClick={() => onRemoveItem(item.id)}
                            className="text-[10px] text-clay-650 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 text-clay-605" /> Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer Total & Checkout Summary */}
              {cartItems.length > 0 && (
                <div className="p-4 border-t border-sand-200 bg-[#FAF8F5] space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold text-bark-900">
                    <span>Perfect Fit Subtotal:</span>
                    <span className="font-mono text-clay-750">${totalCartValue.toFixed(2)}</span>
                  </div>
                  <p className="text-[8.5px] text-bark-450 italic leading-normal">
                    *Taxes and physical copy shipping rates are calculated at checkout. Curated orders are packed in signature craft paper catalogs.
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold">
                    <button
                      onClick={onClearCart}
                      className="border border-sand-300 hover:bg-sand-100 text-bark-750 py-2 rounded-lg cursor-pointer transition-colors"
                    >
                      Clear Items
                    </button>
                    <button
                      onClick={() => {
                        window.alert('Thank you for choosing Perfect Fit Bureau! This simulates a secure checkout flow. Fabricate timeless couture with absolute precision.');
                        onClearCart();
                        setIsCartOpen(false);
                      }}
                      className="bg-clay-605 hover:bg-clay-700 text-white py-2 rounded-lg cursor-pointer transition-all active:scale-95 shadow-3xs"
                    >
                      Secure Checkout
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. BOTTOM NAVIGATION BAR TABS */}
      <nav className="absolute bottom-0 left-0 right-0 h-16 border-t border-sand-200 bg-white flex items-center justify-around z-20 shadow-lg">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${activeTab === 'catalog' ? 'text-clay-605 font-bold' : 'text-bark-400 hover:text-bark-700'}`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[9.5px] font-sans">Catalog</span>
        </button>

        <button
          onClick={() => setActiveTab('fitting')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${activeTab === 'fitting' ? 'text-clay-605 font-bold' : 'text-bark-400 hover:text-bark-700'}`}
        >
          <Ruler className="w-5 h-5" />
          <span className="text-[9.5px] font-sans">Fitting Room</span>
        </button>

        <button
          onClick={() => setActiveTab('academy')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${activeTab === 'academy' ? 'text-clay-605 font-bold' : 'text-bark-400 hover:text-bark-700'}`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[9.5px] font-sans">Academy</span>
        </button>

        <button
          onClick={() => setActiveTab('timer')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${activeTab === 'timer' ? 'text-clay-605 font-bold' : 'text-bark-400 hover:text-bark-700'}`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[9.5px] font-sans">Sewing Room</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${activeTab === 'profile' ? 'text-clay-605 font-bold' : 'text-bark-400 hover:text-bark-700'}`}
        >
          <User className="w-5 h-5" />
          <span className="text-[9.5px] font-sans">Club Portal</span>
        </button>
      </nav>

    </div>
  );
}
