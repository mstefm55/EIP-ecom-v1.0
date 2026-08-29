import { runtimeDataStorage } from '../lib/runtimeDataGateway';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import {
  ShoppingBag, Clock, Download, FileText, Search, Copy, Check,
  Package, Printer, Scissors, ArrowRight, Sparkles, Filter,
  UploadCloud, Trash2, FolderPlus, HelpCircle, Loader2, CheckCircle2, AlertCircle, Plus, BookOpen, Compass,
  Tag
} from 'lucide-react';

const COLOR_PRESETS = {
  'Oatmeal': '#E5D9C9',
  'Burgundy': '#800020',
  'Forest': '#228B22',
  'Slate': '#708090',
  'Rose': '#B76E79',
  'Prussian': '#003153',
  'Charcoal': '#36454F',
  'Sage Green': '#8A9A86',
  'Rust': '#ba6446',
  'Red': '#EF4444',
  'Pink': '#EC4899',
  'Blue': '#3B82F6',
  'Teal': '#14B8A6',
  'Green': '#10B981',
  'Olive': '#808000',
  'Yellow': '#FBBF24',
  'Mustard': '#E3A857',
  'Orange': '#F97316',
  'Purple': '#8B5CF6',
  'Berry': '#9F1239',
  'Beige': '#F5F5DC',
  'Brown': '#78350F',
  'Black': '#000000',
  'White': '#FFFFFF',
  'Gray': '#6B7280'
};

function getHexColor(name) {
  if (!name) return '#6B7280';
  const clean = name.trim();
  if (clean.startsWith('#')) return clean;
  return COLOR_PRESETS[clean] || COLOR_PRESETS[Object.keys(COLOR_PRESETS).find(k => clean.toLowerCase().includes(k.toLowerCase()))] || '#ba6446';
}

export default function MyOrdersSection({
  currentUser,
  guestOrders = [],
  onOpenAuthModal,
  onLoadDemoOrders
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [filterFormat, setFilterFormat] = useState('All'); // 'All' | 'PDF'
  const [downloadingItem, setDownloadingItem] = useState(null);

  // Tag-related states
  const [savedTags, setSavedTags] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_atelier_saved_pattern_tags');
      return saved ? JSON.parse(saved) : {
        'IMP-001': { fabricType: 'Linen', colorTag: 'Oatmeal' },
        'IMP-002': { fabricType: 'Denim', colorTag: 'Prussian' },
        'IMP-003': { fabricType: 'Cotton', colorTag: 'Rose' }
      };
    } catch {
      return {
        'IMP-001': { fabricType: 'Linen', colorTag: 'Oatmeal' },
        'IMP-002': { fabricType: 'Denim', colorTag: 'Prussian' },
        'IMP-003': { fabricType: 'Cotton', colorTag: 'Rose' }
      };
    }
  });

  const [editingTagsId, setEditingTagsId] = useState(null);
  const [editingFabricType, setEditingFabricType] = useState('');
  const [editingColorTag, setEditingColorTag] = useState('');

  const [fabricFilter, setFabricFilter] = useState('All');
  const [colorFilter, setColorFilter] = useState('All');

  // Sync savedTags with localStorage
  useEffect(() => {
    try {
      runtimeDataStorage.setItem('sartorial_atelier_saved_pattern_tags', JSON.stringify(savedTags));
    } catch {}
  }, [savedTags]);

  const handleSaveTags = (id) => {
    setSavedTags(prev => {
      const updated = {
        ...prev,
        [id]: {
          fabricType: editingFabricType.trim(),
          colorTag: editingColorTag.trim()
        }
      };
      return updated;
    });
    setEditingTagsId(null);
    if (window.showToast) {
      window.showToast('Fabric Type and Color tags updated successfully!', 'success', 'Tags Saved');
    }
  };

  const handleRemoveTags = (id) => {
    setSavedTags(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    setEditingTagsId(null);
    if (window.showToast) {
      window.showToast('Tags removed from pattern card.', 'info', 'Tags Cleared');
    }
  };

  const allUniqueFabrics = React.useMemo(() => {
    const list = new Set(['Linen', 'Denim', 'Cotton', 'Silk', 'Wool']);
    Object.values(savedTags).forEach(tag => {
      if (tag && tag.fabricType) {
        list.add(tag.fabricType);
      }
    });
    return ['All', ...Array.from(list)];
  }, [savedTags]);

  const allUniqueColors = React.useMemo(() => {
    const list = new Set(['Oatmeal', 'Burgundy', 'Forest', 'Slate', 'Rose', 'Prussian', 'Charcoal']);
    Object.values(savedTags).forEach(tag => {
      if (tag && tag.colorTag) {
        list.add(tag.colorTag);
      }
    });
    return ['All', ...Array.from(list)];
  }, [savedTags]);

  // Digital pattern library integration state
  const [activeTab, setActiveTab] = useState('boutique'); // 'boutique' | 'library'
  const [importedPatterns, setImportedPatterns] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_atelier_imported_patterns');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'IMP-001',
        name: 'Merchant & Mills Fielder Dress',
        platform: 'Merchant & Mills',
        purchaseDate: '2026-05-15',
        orderNumber: 'MM-99218',
        format: 'PDF (A0 & A4)',
        price: '16.50',
        category: 'Dresses',
        difficulty: 'Intermediate',
        notes: 'Classic raglan sleeve dress. Beautiful in lightweight linens.'
      },
      {
        id: 'IMP-002',
        name: 'The Fold Line Dawn Jeans',
        platform: 'The Fold Line',
        purchaseDate: '2026-06-02',
        orderNumber: 'TFL-44021',
        format: 'PDF (A0 Copyshop)',
        price: '18.00',
        category: 'Pants',
        difficulty: 'Advanced',
        notes: 'Rigid denim, high-waisted jeans block. Pattern has great sizing.'
      },
      {
        id: 'IMP-003',
        name: 'Etsy Modern Linen Boxy Tee',
        platform: 'Etsy (PerfectFitPatterns)',
        purchaseDate: '2026-07-01',
        orderNumber: 'ETS-8829104',
        format: 'PDF (Letter Tiles)',
        price: '8.50',
        category: 'Tops',
        difficulty: 'Easy',
        notes: 'Super quick sew. Good for stash-busting scrap fabrics.'
      }
    ];
  });

  useEffect(() => {
    try {
      runtimeDataStorage.setItem('sartorial_atelier_imported_patterns', JSON.stringify(importedPatterns));
    } catch {}
  }, [importedPatterns]);

  // Importer state
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStep, setParsingStep] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [parsedName, setParsedName] = useState('');
  const [parsedPlatform, setParsedPlatform] = useState('Etsy');
  const [parsedDate, setParsedDate] = useState('');
  const [parsedOrderNum, setParsedOrderNum] = useState('');
  const [parsedPrice, setParsedPrice] = useState('14.00');
  const [parsedCategory, setParsedCategory] = useState('Dresses');
  const [parsedDifficulty, setParsedDifficulty] = useState('Intermediate');
  const [parsedNotes, setParsedNotes] = useState('');
  const [parsedFabricType, setParsedFabricType] = useState('');
  const [parsedColorTag, setParsedColorTag] = useState('');

  const simulateParsing = (fileName) => {
    setIsParsing(true);
    setParsedData(null);
    setParsedFabricType('');
    setParsedColorTag('');

    let guessedName = 'Curated Tailoring Block';
    let guessedCategory = 'Dresses';
    let guessedPlatform = 'The Fold Line';
    let guessedDifficulty = 'Intermediate';

    const fnLower = fileName.toLowerCase();
    if (fnLower.includes('pants') || fnLower.includes('trouser') || fnLower.includes('jeans')) {
      guessedName = 'Classic Utility Trousers';
      guessedCategory = 'Pants';
      guessedDifficulty = 'Advanced';
    } else if (fnLower.includes('shirt') || fnLower.includes('top') || fnLower.includes('blouse') || fnLower.includes('tee')) {
      guessedName = 'Asymmetrical Linen Blouse';
      guessedCategory = 'Tops';
      guessedDifficulty = 'Easy';
    } else if (fnLower.includes('jacket') || fnLower.includes('coat') || fnLower.includes('blazer') || fnLower.includes('outerwear')) {
      guessedName = 'Perfect Fit Structured Blazer';
      guessedCategory = 'Outerwear';
      guessedDifficulty = 'Advanced';
    } else if (fnLower.includes('dress') || fnLower.includes('gown') || fnLower.includes('wrap')) {
      guessedName = 'Perfect Fit Empire Wrap Dress';
      guessedCategory = 'Dresses';
      guessedDifficulty = 'Intermediate';
    }

    if (fnLower.includes('etsy')) {
      guessedPlatform = 'Etsy';
    } else if (fnLower.includes('stylearc') || fnLower.includes('style_arc') || fnLower.includes('style arc')) {
      guessedPlatform = 'Style Arc';
    } else if (fnLower.includes('grainline')) {
      guessedPlatform = 'Grainline Studio';
    } else if (fnLower.includes('merchant') || fnLower.includes('mills')) {
      guessedPlatform = 'Merchant & Mills';
    } else if (fnLower.includes('seamwork')) {
      guessedPlatform = 'Seamwork';
    }

    const steps = [
      { text: 'Detecting PDF document layout structures...', delay: 600 },
      { text: 'Applying OCR sequence recognition on merchant header...', delay: 1200 },
      { text: 'Identifying platform digital signature pattern schemas...', delay: 1800 },
      { text: 'Extracting pattern metrics, SKU details, and transaction meta...', delay: 2400 },
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setParsingStep(step.text);
      }, step.delay);
    });

    setTimeout(() => {
      setIsParsing(false);
      setParsedName(guessedName);
      setParsedPlatform(guessedPlatform);

      const today = new Date().toISOString().split('T')[0];
      setParsedDate(today);

      const randomOrder = `${guessedPlatform.substring(0, 3).toUpperCase()}-${Math.floor(10000 + Math.random() * 90000)}`;
      setParsedOrderNum(randomOrder);

      setParsedPrice((8 + Math.random() * 12).toFixed(2));
      setParsedCategory(guessedCategory);
      setParsedDifficulty(guessedDifficulty);
      setParsedNotes(`Imported from receipt: "${fileName}". Standard digital calibration.`);

      setParsedData({
        fileName,
        guessedName,
      });

      if (window.showToast) {
        window.showToast(`Extracted purchase metadata from order PDF successfully!`, "success", "Receipt Scanned");
      }
    }, 3000);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      simulateParsing(file.name);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      simulateParsing(file.name);
    }
  };

  const handleApproveImport = () => {
    if (!parsedName.trim()) {
      if (window.showToast) {
        window.showToast("Pattern name is required to register in library.", "error", "Missing Name");
      }
      return;
    }

    const newId = `IMP-${Date.now()}`;
    const newImport = {
      id: newId,
      name: parsedName,
      platform: parsedPlatform,
      purchaseDate: parsedDate,
      orderNumber: parsedOrderNum,
      format: 'PDF (Extracted Pack)',
      price: parsedPrice,
      category: parsedCategory,
      difficulty: parsedDifficulty,
      notes: parsedNotes
    };

    setImportedPatterns(prev => [newImport, ...prev]);

    if (parsedFabricType.trim() || parsedColorTag.trim()) {
      setSavedTags(prev => ({
        ...prev,
        [newId]: {
          fabricType: parsedFabricType.trim(),
          colorTag: parsedColorTag.trim()
        }
      }));
    }

    setParsedData(null);

    if (window.showToast) {
      window.showToast(`"${parsedName}" successfully registered to your personal Atelier Library!`, "success", "Import Approved");
    }
  };

  const handleDeleteImport = (id, name) => {
    setImportedPatterns(prev => prev.filter(item => item.id !== id));
    if (window.showToast) {
      window.showToast(`Removed "${name}" from your imported catalog.`, "info", "Pattern Removed");
    }
  };

  // Combine currentUser purchase history and guest orders
  const orders = currentUser?.role === 'buyer'
    ? (currentUser.purchaseHistory || [])
    : (currentUser?.role === 'collaborator' ? [] : guestOrders);

  // Copy order ID helper
  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    if (window.showToast) {
      window.showToast(`Order ID ${id} copied to clipboard!`, "success", "Copied");
    }
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Digital pattern download simulation
  const handleDownload = (patternName, format) => {
    const id = `${patternName}-${format}`;
    setDownloadingItem(id);

    if (window.showToast) {
      window.showToast(`Constructing secure high-res package for "${patternName}"...`, "info", "Compiling PDF Pack");
    }

    setTimeout(() => {
      setDownloadingItem(null);
      const fileContent = [
        'Perfect Fit digital pattern download',
        `Pattern: ${patternName}`,
        `Format: ${format || 'PDF'}`,
        '',
        'This demo file represents the purchased customer pattern bundle.'
      ].join('\n');
      const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Perfect-Fit-${String(patternName || 'pattern').replace(/[^a-z0-9]+/gi, '-')}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      if (window.showToast) {
        window.showToast(
          `Successfully downloaded "${patternName}" digital pattern package.`,
          "success",
          "Download Complete"
        );
      } else {
        alert(`Successfully downloaded "${patternName}" digital pattern package.`);
      }
    }, 2000);
  };

  const getReceiptSnapshot = (ord) => {
    const receipt = ord.receipt || {};
    const items = Array.isArray(receipt.items) && receipt.items.length > 0
      ? receipt.items
      : (Array.isArray(ord.items) && ord.items.length > 0
        ? ord.items
        : [{
            patternName: ord.patternName,
            format: ord.format,
            price: ord.price,
            quantity: 1,
            sizePreference: ord.sizePreference || '8',
            image: ord.image
          }]);

    const subtotal = Number(receipt.subtotal ?? items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0));
    const discountAmount = Number(receipt.discountAmount || 0);
    const promoDiscountAmount = Number(receipt.promoDiscountAmount || 0);
    const total = Number(receipt.total ?? ord.total ?? ord.price ?? Math.max(0, subtotal - discountAmount - promoDiscountAmount));

    return {
      orderId: receipt.orderId || ord.id,
      date: receipt.date || ord.date,
      customerDetails: receipt.customerDetails || {},
      items,
      subtotal,
      discountAmount,
      promoDiscountAmount,
      appliedPromo: receipt.appliedPromo || null,
      total
    };
  };

  const handleDownloadInvoicePdf = (ord) => {
    const receipt = getReceiptSnapshot(ord);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 48;

    const addLine = (label, value, options = {}) => {
      doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
      doc.setFontSize(options.size || 10);
      doc.text(String(label), 48, y);
      doc.text(String(value ?? '—'), pageWidth - 48, y, { align: 'right' });
      y += options.gap || 18;
    };

    const customer = receipt.customerDetails || {};
    const billingDetails = [
      `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
      customer.address,
      customer.city,
      customer.state,
      customer.postalCode,
      customer.country
    ].filter(Boolean).join(', ');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Perfect Fit', 48, y);
    y += 26;
    doc.setFontSize(14);
    doc.text('Invoice / Receipt', 48, y);
    y += 28;

    addLine('Order reference', receipt.orderId);
    addLine('Processed date', receipt.date);
    addLine('Customer email', customer.email || '—');
    addLine('Billing details', billingDetails || '—');

    y += 10;
    doc.setDrawColor(225, 213, 203);
    doc.line(48, y, pageWidth - 48, y);
    y += 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Items', 48, y);
    y += 20;

    receipt.items.forEach((item) => {
      const quantity = Number(item.quantity || 1);
      const unitPrice = Number(item.price || 0);
      const lineTotal = unitPrice * quantity;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(item.patternName || 'Digital pattern', 48, y);
      doc.text(`$${lineTotal.toFixed(2)}`, pageWidth - 48, y, { align: 'right' });
      y += 15;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Format: ${item.format || 'PDF'} · Size: ${item.sizePreference || '8'} · Qty: ${quantity} · Unit: $${unitPrice.toFixed(2)}`, 60, y);
      y += 20;
    });

    y += 8;
    doc.line(48, y, pageWidth - 48, y);
    y += 22;
    addLine('Subtotal', `$${receipt.subtotal.toFixed(2)}`);
    if (receipt.discountAmount > 0) addLine('Discount', `-$${receipt.discountAmount.toFixed(2)}`);
    if (receipt.appliedPromo) addLine(`Promo discount (${receipt.appliedPromo.code})`, `-$${receipt.promoDiscountAmount.toFixed(2)}`);
    addLine('Digital delivery', 'Free');
    addLine('Grand total', `$${receipt.total.toFixed(2)}`, { bold: true, size: 12, gap: 24 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Digital pattern order. No physical shipment is included.', 48, y);
    y += 18;
    doc.text('Thank you for your order.', 48, y);
    doc.save(`Perfect-Fit-Invoice-${receipt.orderId}.pdf`);
  };

  // Filter and search orders
  const filteredOrders = orders.filter(ord => {
    // Some formats could be item-specific or order-specific
    const hasFormat = filterFormat === 'All' ||
      ord.format === filterFormat ||
      (ord.items && ord.items.some(item => item.format === filterFormat));

    // Search by ID, patternName, or individual items patternName
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      ord.id.toLowerCase().includes(searchLower) ||
      (ord.patternName && ord.patternName.toLowerCase().includes(searchLower)) ||
      (ord.items && ord.items.some(item => item.patternName.toLowerCase().includes(searchLower)));

    const isMultipleItems = ord.items && ord.items.length > 0;
    const orderItems = isMultipleItems
      ? ord.items
      : [{ patternName: ord.patternName, format: ord.format, price: ord.price }];

    const matchesFabric = fabricFilter === 'All' || orderItems.some((item, idx) => {
      const key = `${ord.id}-${idx}`;
      const tag = savedTags[key] || savedTags[item.patternName];
      return tag && tag.fabricType.toLowerCase() === fabricFilter.toLowerCase();
    });

    const matchesColor = colorFilter === 'All' || orderItems.some((item, idx) => {
      const key = `${ord.id}-${idx}`;
      const tag = savedTags[key] || savedTags[item.patternName];
      return tag && tag.colorTag.toLowerCase() === colorFilter.toLowerCase();
    });

    return hasFormat && matchesSearch && matchesFabric && matchesColor;
  });

  return (
    <section className="bg-white rounded-[4px] border border-sand-200 p-6 md:p-10 space-y-8 shadow-lux relative overflow-hidden" id="my-orders-section">
      {/* Decorative Blueprint Background Grid */}
      <div className="absolute right-0 top-0 w-48 h-48 opacity-[0.02] bg-[radial-gradient(#ba6446_1px,transparent_1px)] [background-size:10px_10px] pointer-events-none" />

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-sand-150/80">
        <div>
          <h3 className="text-2xl md:text-3xl font-serif text-bark-950 font-light" id="orders-section-heading">{pfUiT("ui.components.myorderssection.b53e72a728")}</h3>
          <p className="text-xs text-bark-550 max-w-xl leading-relaxed mt-1 font-sans">{pfUiT("ui.components.myorderssection.7c8645cc27")}</p>
        </div>

        {/* Action Button for Guest or Demo Account Seed */}
        <div className="flex flex-wrap gap-2.5 shrink-0">
          {/*{orders.length === 0 && (
            <button
              onClick={onLoadDemoOrders}
              className="inline-flex items-center gap-1.5 bg-clay-50 hover:bg-clay-100 text-clay-705 text-xs font-semibold px-4 py-2 rounded-lg border border-clay-200/50 shadow-3xs hover:shadow-2xs transition-all duration-300 cursor-pointer"
              id="btn-load-demo-orders"
              title={pfUiT("ui.components.myorderssection.ec903c9725")}
            >
              <Sparkles className="w-3.5 h-3.5" />{pfUiT("ui.components.myorderssection.adc7577dff")}</button>
          )} */}  

          {!currentUser && (
            <button
              onClick={onOpenAuthModal}
              className="inline-flex items-center gap-1.5 bg-bark-900 hover:bg-bark-950 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-300 cursor-pointer shadow-3xs hover:shadow-2xs"
              id="btn-login-to-save"
            >{pfUiT("ui.components.myorderssection.8a2affb8a4")}</button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-sand-150/80 gap-6" id="orders-tabs">
        <button
          onClick={() => setActiveTab('boutique')}
          className={`pb-3.5 text-xs font-bold uppercase tracking-wider transition-colors relative px-4 flex items-center gap-2 cursor-pointer ${
            activeTab === 'boutique' ? 'text-[#ba6446]' : 'text-bark-500 hover:text-bark-850'
          }`}
          id="tab-boutique-purchases"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>{pfUiT("ui.components.myorderssection.0d0c1f967e")}</span>
          {activeTab === 'boutique' && (
            <motion.div layoutId="activeOrderTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ba6446]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('library')}
          className={`pb-3.5 text-xs font-bold uppercase tracking-wider transition-colors relative px-4 flex items-center gap-2 cursor-pointer ${
            activeTab === 'library' ? 'text-[#ba6446]' : 'text-bark-500 hover:text-bark-850'
          }`}
          id="tab-external-library"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>{pfUiT("ui.components.myorderssection.76cedb7f34")}</span>
          <span className="text-[9px] bg-clay-50 border border-clay-100 text-clay-705 px-1.5 py-0.2 rounded font-mono font-semibold">
            {importedPatterns.length}
          </span>
          {activeTab === 'library' && (
            <motion.div layoutId="activeOrderTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ba6446]" />
          )}
        </button>
      </div>

      {activeTab === 'boutique' ? (
        orders.length === 0 ? (
          /* Empty Orders State */
          <div className="text-center py-16 md:py-24 space-y-5 border border-dashed border-sand-250/80 rounded-lg bg-sand-50/20" id="empty-orders-view">
            <div className="w-16 h-16 bg-sand-100 rounded-full flex items-center justify-center mx-auto text-bark-400">
              <ShoppingBag className="w-7 h-7 stroke-[1.25]" />
            </div>
            <div className="space-y-1.5">
              <h4 className="font-serif text-lg font-medium text-bark-900">{pfUiT("ui.components.myorderssection.279b7deacf")}</h4>
              <p className="text-xs text-bark-500 max-w-[340px] mx-auto leading-relaxed font-sans">{pfUiT("ui.components.myorderssection.f34d8a2018")}</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={onLoadDemoOrders}
                className="bg-[#FAF8F5] hover:bg-sand-100 text-bark-850 border border-sand-250 text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-3xs"
              >{pfUiT("ui.components.myorderssection.749f63ceef")}</button>
              <a
                href="#gallery-section"
                className="inline-flex items-center gap-1 bg-bark-900 hover:bg-bark-955 text-sand-50 text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-3xs"
              >{pfUiT("ui.components.myorderssection.d4cc9c5f75")}<ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : (
          /* Orders list & Filter Controls */
          <div className="space-y-6">
            {/* Controls Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5 bg-[#FAF8F5] border border-sand-200/80 p-3 rounded-lg" id="orders-controls">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-bark-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder={pfUiT("ui.components.myorderssection.ff1f442492")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-sand-250 text-xs pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-clay-500 text-bark-800 placeholder-bark-400 font-sans"
                />
              </div>

              {/* Tag-based Dropdown Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Fabric Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-bark-450 font-bold font-mono uppercase tracking-wider hidden sm:inline">{pfUiT("ui.components.myorderssection.f7d68afdb7")}</span>
                  <select
                    value={fabricFilter}
                    onChange={(e) => setFabricFilter(e.target.value)}
                    className="bg-white border border-sand-250 rounded-lg text-[10px] font-bold px-2 py-1.5 focus:outline-none focus:border-clay-500 text-bark-750 font-sans cursor-pointer"
                  >
                    <option value="All">{pfUiT("ui.components.myorderssection.2538db6b61")}</option>
                    {allUniqueFabrics.filter(f => f !== 'All').map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                {/* Color Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-bark-450 font-bold font-mono uppercase tracking-wider hidden sm:inline">{pfUiT("ui.components.myorderssection.e820d5fe67")}</span>
                  <select
                    value={colorFilter}
                    onChange={(e) => setColorFilter(e.target.value)}
                    className="bg-white border border-sand-250 rounded-lg text-[10px] font-bold px-2 py-1.5 focus:outline-none focus:border-clay-500 text-bark-750 font-sans cursor-pointer"
                  >
                    <option value="All">{pfUiT("ui.components.myorderssection.318996d8bb")}</option>
                    {allUniqueColors.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Format Filter */}
                <div className="flex items-center gap-2 shrink-0 border-l border-sand-200 pl-2.5">
                  <span className="text-[10px] text-bark-450 font-bold font-mono uppercase tracking-wider hidden md:inline">{pfUiT("ui.components.myorderssection.4128d507f3")}</span>
                  {['All', 'PDF'].map((format) => (
                    <button
                      key={format}
                      onClick={() => setFilterFormat(format)}
                      className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider font-sans border cursor-pointer transition-all ${
                        filterFormat === format
                          ? 'bg-bark-900 text-white border-bark-900 shadow-3xs'
                          : 'bg-white text-bark-600 border-sand-200 hover:bg-sand-50/80'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Active Orders List */}
            <div className="space-y-5" id="orders-list-container">
              <AnimatePresence mode="popLayout">
                {filteredOrders.length === 0 ? (
                  <p className="text-center py-10 text-xs text-bark-400 italic">{pfUiT("ui.components.myorderssection.3af6fabcc9")}</p>
                ) : (
                  filteredOrders.map((ord) => {
                    const isMultipleItems = ord.items && ord.items.length > 0;
                    const orderItems = isMultipleItems
                      ? ord.items
                      : [{
                          patternName: ord.patternName,
                          format: ord.format,
                          price: ord.price,
                          quantity: 1,
                          sizePreference: ord.sizePreference || '8',
                          image: ord.image || 'https://images.unsplash.com/photo-1566207274740-0f8cf6b7d5a5?auto=format&fit=crop&w=120&q=80'
                        }];

                    return (
                      <motion.div
                        key={ord.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="border border-sand-250/90 rounded-lg overflow-hidden bg-white hover:border-sand-300 shadow-3xs hover:shadow-2xs transition-all duration-300"
                        id={`order-block-${ord.id}`}
                      >
                        {/* Order Block Header (Meta, ID, Date, Total) */}
                        <div className="bg-sand-50/60 px-5 py-4 border-b border-sand-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                              <span className="text-bark-400">ORDER</span>
                              <span className="font-bold text-bark-900 select-all">{ord.id}</span>
                              <button
                                onClick={() => handleCopyId(ord.id)}
                                className="text-bark-300 hover:text-clay-655 p-0.5 rounded transition-colors"
                                title={pfUiT("ui.components.myorderssection.fa7665d31e")}
                              >
                                {copiedId === ord.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>

                            <div className="flex items-center gap-1 text-bark-500 font-sans">
                              <Clock className="w-3.5 h-3.5 text-bark-400" />
                              <span>{ord.date}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] uppercase font-mono tracking-wider text-bark-450">{pfUiT("ui.components.myorderssection.38a38d869f")}</span>
                            <strong className="text-sm font-mono text-bark-950">${ord.total ? ord.total.toFixed(2) : (ord.price ? ord.price.toFixed(2) : '0.00')}</strong>
                            <button
                              type="button"
                              onClick={() => handleDownloadInvoicePdf(ord)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-sand-250 bg-white px-3 py-1.5 text-[10px] font-bold text-bark-800 transition-colors hover:bg-sand-50"
                            >
                              <FileText className="h-3 w-3" />{pfUiT("ui.components.myorderssection.64f517574d")}</button>
                          </div>
                        </div>

                        {/* Purchased Items Inside the Order */}
                        <div className="divide-y divide-sand-150/70 px-5">
                          {orderItems.map((item, index) => {
                            const isDownloading = downloadingItem === `${item.patternName}-${item.format}`;

                            return (
                              <div key={index} className="py-4.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                {/* Item Details */}
                                <div className="flex gap-4">
                                  {/* Thumbnail */}
                                  <div className="w-12 h-15 bg-sand-50 border border-sand-200 rounded-md overflow-hidden flex-shrink-0">
                                    <img
                                      src={item.image || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=120&q=80'}
                                      alt={item.patternName}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <h4 className="font-serif text-sm font-semibold text-bark-900 leading-snug">
                                      {item.patternName}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-clay-50 text-clay-750 border border-clay-100">
                                        {item.format} File
                                      </span>
                                      {item.sizePreference && (
                                        <span className="text-[9px] text-bark-500 font-medium font-mono">
                                          Size {item.sizePreference} Target
                                        </span>
                                      )}
                                      {item.quantity > 1 && (
                                        <span className="text-[9px] bg-sand-50 border border-sand-200 px-1.5 py-0.5 rounded font-mono font-bold text-bark-700">
                                          Qty: {item.quantity}
                                        </span>
                                      )}
                                    </div>

                                    {/* Order item tags display and edit inline */}
                                    {(() => {
                                      const key = `${ord.id}-${index}`;
                                      const tag = savedTags[key] || savedTags[item.patternName];
                                      return (
                                        <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                                          {tag?.fabricType ? (
                                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold bg-clay-50 border border-clay-100 text-clay-705 px-2 py-0.5 rounded-full shadow-4xs">
                                              <Tag className="w-2.5 h-2.5 text-clay-500" />
                                              <span>{tag.fabricType}</span>
                                            </span>
                                          ) : null}

                                          {tag?.colorTag ? (
                                            <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-sand-50 border border-sand-250 text-bark-750 px-2 py-0.5 rounded-full shadow-4xs">
                                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getHexColor(tag.colorTag) }} />
                                              <span>{tag.colorTag}</span>
                                            </span>
                                          ) : null}

                                          <button
                                            onClick={() => {
                                              setEditingTagsId(key);
                                              setEditingFabricType(tag?.fabricType || '');
                                              setEditingColorTag(tag?.colorTag || '');
                                            }}
                                            className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#ba6446] hover:underline cursor-pointer ml-1"
                                            title={pfUiT("ui.components.myorderssection.83e16f48a1")}
                                          >
                                            <span>{tag?.fabricType || tag?.colorTag ? 'Edit Tags' : '+ Add Tags'}</span>
                                          </button>
                                        </div>
                                      );
                                    })()}

                                    {editingTagsId === `${ord.id}-${index}` ? (
                                      <div className="bg-sand-50/50 p-3 rounded-lg border border-sand-250/70 space-y-3 mt-2.5 text-xs w-full max-w-sm">
                                        <h6 className="font-bold text-bark-800 text-[10px] uppercase font-mono tracking-wider">{pfUiT("ui.components.myorderssection.bedbe6e8b0")}</h6>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-bark-500 uppercase font-mono">{pfUiT("ui.components.myorderssection.903d927d85")}</label>
                                            <input
                                              type="text"
                                              value={editingFabricType}
                                              onChange={(e) => setEditingFabricType(e.target.value)}
                                              placeholder={pfUiT("ui.components.myorderssection.11d4a9cf55")}
                                              className="w-full bg-white border border-sand-250 text-[11px] px-2 py-1 rounded"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-bark-500 uppercase font-mono">{pfUiT("ui.components.myorderssection.2cdaca491b")}</label>
                                            <input
                                              type="text"
                                              value={editingColorTag}
                                              onChange={(e) => setEditingColorTag(e.target.value)}
                                              placeholder={pfUiT("ui.components.myorderssection.4bbfb83198")}
                                              className="w-full bg-white border border-sand-250 text-[11px] px-2 py-1 rounded"
                                            />
                                          </div>
                                        </div>
                                        <div className="flex justify-end gap-1.5 pt-1">
                                          <button
                                            onClick={() => {
                                              setEditingTagsId(null);
                                            }}
                                            className="px-2.5 py-1 bg-white hover:bg-sand-100 border border-sand-200 rounded text-[9px] font-bold text-bark-600 cursor-pointer"
                                          >{pfUiT("ui.components.myorderssection.78a32c2d51")}</button>
                                          <button
                                            onClick={() => handleRemoveTags(`${ord.id}-${index}`)}
                                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-[9px] font-bold cursor-pointer"
                                            title={pfUiT("ui.components.myorderssection.d2f9dd7990")}
                                          >{pfUiT("ui.components.myorderssection.583078ffd3")}</button>
                                          <button
                                            onClick={() => handleSaveTags(`${ord.id}-${index}`)}
                                            className="px-2.5 py-1 bg-[#ba6446] hover:bg-[#a25135] text-white rounded text-[9px] font-bold cursor-pointer"
                                          >{pfUiT("ui.components.myorderssection.aca3c3643f")}</button>
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>

                                {/* Status Badging & Action Links */}
                                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                  {/* Status Indicator */}
                                  <div className="flex items-center gap-1.5 text-xs font-sans">
                                    <span className={`w-2 h-2 rounded-full ${
                                      isPDF ? 'bg-emerald-500 animate-pulse' : 'bg-amber-450'
                                    }`} />
                                    <span className="text-bark-750">{pfUiT("ui.components.myorderssection.31beaa97b3")}</span>
                                  </div>

                                  {/* Digital download action CTA */}
                                  <div className="shrink-0">
                                    <button
                                      disabled={isDownloading}
                                      onClick={() => handleDownload(item.patternName, item.format)}
                                      className="inline-flex items-center gap-1.5 bg-bark-900 hover:bg-bark-955 disabled:bg-sand-200 text-sand-50 disabled:text-bark-400 text-[10px] font-bold px-3.5 py-2 rounded-lg transition-all duration-200 shadow-3xs cursor-pointer select-none"
                                    >
                                      <Download className={`w-3 h-3 ${isDownloading ? 'animate-bounce' : ''}`} />
                                      <span>{isDownloading ? 'Preparing download...' : 'Download pattern'}</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Download Guidance / Footer tips */}
                        <div className="bg-[#FAF8F5]/40 px-5 py-3 border-t border-sand-150/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[10px] text-bark-500 font-sans">
                          <span className="flex items-center gap-1 font-medium text-[9px] uppercase tracking-wider text-clay-700">
                            <Printer className="w-3 h-3" />{pfUiT("ui.components.myorderssection.b78eb154b9")}</span>
                          <span>{pfUiT("ui.components.myorderssection.d028efabea")}</span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>
        )
      ) : (
        /* Digital Pattern PDF Importer & Atelier Library */
        <div className="space-y-8" id="library-tab-panel">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Left Column: Drag & Drop PDF Importer */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-sand-50/50 rounded-lg p-5 border border-sand-250/70 space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-bark-900 flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-[#ba6446]" />{pfUiT("ui.components.myorderssection.30e28b60ef")}</h4>
                  <p className="text-[11px] text-bark-500 leading-relaxed">{pfUiT("ui.components.myorderssection.5ca5cf5334")}</p>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('digital-receipt-picker').click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#ba6446] bg-clay-50/40 shadow-sm'
                      : 'border-sand-250 hover:border-bark-400 bg-white hover:bg-sand-50/30'
                  }`}
                  id="dropzone-pattern-pdf"
                >
                  <input
                    type="file"
                    id="digital-receipt-picker"
                    accept=".pdf,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-full bg-[#ba6446]/10 flex items-center justify-center mx-auto text-[#ba6446]">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-bark-850">
                        {isDragging ? 'Drop order confirmation PDF here' : 'Drag & drop order PDF, or click to browse'}
                      </p>
                      <p className="text-[10px] text-bark-450">
                        Supports standard confirmation PDFs (Etsy, Seamwork, etc.)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Loading / Parsing States */}
                {isParsing && (
                  <div className="bg-white border border-sand-200 rounded-md p-4 space-y-3 text-center animate-pulse">
                    <Loader2 className="w-5 h-5 text-[#ba6446] animate-spin mx-auto" />
                    <div className="space-y-1">
                      <p className="text-[11px] font-mono font-bold text-[#ba6446] uppercase tracking-wide">{pfUiT("ui.components.myorderssection.5b66af181c")}</p>
                      <p className="text-[10px] text-bark-500 italic font-sans">{parsingStep}</p>
                    </div>
                  </div>
                )}

                {/* Edit & Verification Panel */}
                {parsedData && !isParsing && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-sand-250/90 rounded-md p-4.5 space-y-4 shadow-4xs"
                    id="parsed-metadata-panel"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-sand-150">
                      <span className="text-[10px] font-mono font-bold text-[#ba6446] uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />{pfUiT("ui.components.myorderssection.440a5f2589")}</span>
                      <span className="text-[9px] text-bark-400 font-mono italic">
                        {parsedData.fileName.length > 20 ? parsedData.fileName.substring(0, 18) + '...' : parsedData.fileName}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1 col-span-2">
                        <label className="text-[9px] font-mono font-bold text-bark-500 uppercase tracking-wider">{pfUiT("ui.components.myorderssection.d7081bcf78")}</label>
                        <input
                          type="text"
                          value={parsedName}
                          onChange={(e) => setParsedName(e.target.value)}
                          className="w-full bg-white border border-sand-250 text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-[#ba6446] text-bark-850 font-sans font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono font-bold text-bark-500 uppercase tracking-wider">{pfUiT("ui.components.myorderssection.e90c889745")}</label>
                        <select
                          value={parsedPlatform}
                          onChange={(e) => setParsedPlatform(e.target.value)}
                          className="w-full bg-white border border-sand-250 text-xs px-2 py-1.5 rounded focus:outline-none focus:border-[#ba6446] text-bark-850 font-sans"
                        >
                          <option value="Etsy">{pfUiT("ui.components.myorderssection.21147a8926")}</option>
                          <option value="The Fold Line">{pfUiT("ui.components.myorderssection.e99942d636")}</option>
                          <option value="Style Arc">{pfUiT("ui.components.myorderssection.ae6993f2b6")}</option>
                          <option value="Seamwork">{pfUiT("ui.components.myorderssection.c95ed6dd39")}</option>
                          <option value="Merchant & Mills">{pfUiT("ui.components.myorderssection.8321dd26de")}</option>
                          <option value="Grainline Studio">{pfUiT("ui.components.myorderssection.170ea5d284")}</option>
                          <option value="Other / Independent">{pfUiT("ui.components.myorderssection.2332ec8bb2")}</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono font-bold text-bark-500 uppercase tracking-wider">{pfUiT("ui.components.myorderssection.8db8cd4712")}</label>
                        <input
                          type="text"
                          value={parsedOrderNum}
                          onChange={(e) => setParsedOrderNum(e.target.value)}
                          className="w-full bg-white border border-sand-250 text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-[#ba6446] text-bark-850 font-sans font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono font-bold text-bark-500 uppercase tracking-wider">{pfUiT("ui.components.myorderssection.9d263fe70b")}</label>
                        <select
                          value={parsedCategory}
                          onChange={(e) => setParsedCategory(e.target.value)}
                          className="w-full bg-white border border-sand-250 text-xs px-2 py-1.5 rounded focus:outline-none focus:border-[#ba6446] text-bark-850 font-sans"
                        >
                          <option value="Dresses">{pfUiT("ui.components.myorderssection.02e794b79e")}</option>
                          <option value="Tops">{pfUiT("ui.components.myorderssection.5e9a689963")}</option>
                          <option value="Pants">{pfUiT("ui.components.myorderssection.775b66d81b")}</option>
                          <option value="Skirts">{pfUiT("ui.components.myorderssection.eb1c263753")}</option>
                          <option value="Outerwear">{pfUiT("ui.components.myorderssection.3083267ac1")}</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono font-bold text-bark-500 uppercase tracking-wider">{pfUiT("ui.components.myorderssection.6f4fface4b")}</label>
                        <select
                          value={parsedDifficulty}
                          onChange={(e) => setParsedDifficulty(e.target.value)}
                          className="w-full bg-white border border-sand-250 text-xs px-2 py-1.5 rounded focus:outline-none focus:border-[#ba6446] text-bark-850 font-sans"
                        >
                          <option value="Easy">{pfUiT("ui.components.myorderssection.148c6722c8")}</option>
                          <option value="Intermediate">{pfUiT("ui.components.myorderssection.35901f83c3")}</option>
                          <option value="Advanced">{pfUiT("ui.components.myorderssection.94b70c6d67")}</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono font-bold text-bark-500 uppercase tracking-wider">{pfUiT("ui.components.myorderssection.711b333fb7")}</label>
                        <input
                          type="text"
                          value={parsedPrice}
                          onChange={(e) => setParsedPrice(e.target.value)}
                          className="w-full bg-white border border-sand-250 text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-[#ba6446] text-bark-850 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono font-bold text-bark-500 uppercase tracking-wider">{pfUiT("ui.components.myorderssection.3210f8999c")}</label>
                        <input
                          type="date"
                          value={parsedDate}
                          onChange={(e) => setParsedDate(e.target.value)}
                          className="w-full bg-white border border-sand-250 text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-[#ba6446] text-bark-850"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono font-bold text-bark-500 uppercase tracking-wider">{pfUiT("ui.components.myorderssection.92b69b1eef")}</label>
                        <input
                          type="text"
                          value={parsedFabricType}
                          onChange={(e) => setParsedFabricType(e.target.value)}
                          placeholder={pfUiT("ui.components.myorderssection.50f6403515")}
                          className="w-full bg-white border border-sand-250 text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-[#ba6446] text-bark-850 font-sans"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono font-bold text-bark-500 uppercase tracking-wider">{pfUiT("ui.components.myorderssection.6a84198f2b")}</label>
                        <input
                          type="text"
                          value={parsedColorTag}
                          onChange={(e) => setParsedColorTag(e.target.value)}
                          placeholder={pfUiT("ui.components.myorderssection.ace63f9fd6")}
                          className="w-full bg-white border border-sand-250 text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-[#ba6446] text-bark-850 font-sans"
                        />
                      </div>

                      <div className="space-y-1 col-span-2">
                        <label className="text-[9px] font-mono font-bold text-bark-500 uppercase tracking-wider">{pfUiT("ui.components.myorderssection.0536eab064")}</label>
                        <textarea
                          rows="2"
                          value={parsedNotes}
                          onChange={(e) => setParsedNotes(e.target.value)}
                          placeholder="e.g. Needs FBA (Full Bust Adjustment) or 1.5 inch hem shortening..."
                          className="w-full bg-white border border-sand-250 text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-[#ba6446] text-bark-850 font-sans"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-sand-150">
                      <button
                        onClick={() => setParsedData(null)}
                        className="flex-1 bg-white hover:bg-sand-100 text-bark-750 border border-sand-250 text-[10px] font-bold py-2 rounded transition-colors cursor-pointer text-center"
                      >{pfUiT("ui.components.myorderssection.78a32c2d51")}</button>
                      <button
                        onClick={handleApproveImport}
                        className="flex-1 bg-[#ba6446] hover:bg-[#ba6446]/90 text-white text-[10px] font-bold py-2 rounded transition-colors cursor-pointer text-center"
                      >
                        Approve &amp; Add
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Right Column: Library Catalog */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#FAF8F5] border border-sand-200 p-3.5 rounded-lg">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-bark-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={pfUiT("ui.components.myorderssection.9ef1b2c905")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-sand-250 text-xs pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#ba6446] text-bark-800 placeholder-bark-400 font-sans"
                  />
                </div>

                {/* Tag Filters for Imported Library */}
                <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0 shrink-0">
                  <select
                    value={fabricFilter}
                    onChange={(e) => setFabricFilter(e.target.value)}
                    className="bg-white border border-sand-250 rounded-lg text-[10px] font-bold px-2 py-1.5 focus:outline-none focus:border-[#ba6446] text-bark-750 font-sans cursor-pointer"
                  >
                    <option value="All">{pfUiT("ui.components.myorderssection.2538db6b61")}</option>
                    {allUniqueFabrics.filter(f => f !== 'All').map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>

                  <select
                    value={colorFilter}
                    onChange={(e) => setColorFilter(e.target.value)}
                    className="bg-white border border-sand-250 rounded-lg text-[10px] font-bold px-2 py-1.5 focus:outline-none focus:border-[#ba6446] text-bark-750 font-sans cursor-pointer"
                  >
                    <option value="All">{pfUiT("ui.components.myorderssection.318996d8bb")}</option>
                    {allUniqueColors.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Imported Catalog Cards Grid */}
              <div className="space-y-4" id="library-catalog-grid">
                <AnimatePresence mode="popLayout">
                  {importedPatterns.filter(item => {
                    const term = searchQuery.toLowerCase();
                    const matchesSearch = item.name.toLowerCase().includes(term) || item.platform.toLowerCase().includes(term) || item.category.toLowerCase().includes(term);

                    const tag = savedTags[item.id];
                    const matchesFabric = fabricFilter === 'All' || (tag && tag.fabricType.toLowerCase() === fabricFilter.toLowerCase());
                    const matchesColor = colorFilter === 'All' || (tag && tag.colorTag.toLowerCase() === colorFilter.toLowerCase());

                    return matchesSearch && matchesFabric && matchesColor;
                  }).length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-sand-200 rounded-lg bg-sand-50/20 text-bark-450 space-y-2">
                      <Compass className="w-8 h-8 mx-auto text-bark-300 stroke-[1.25]" />
                      <p className="text-xs italic font-sans">{pfUiT("ui.components.myorderssection.19741e374f")}</p>
                    </div>
                  ) : (
                    importedPatterns.filter(item => {
                      const term = searchQuery.toLowerCase();
                      const matchesSearch = item.name.toLowerCase().includes(term) || item.platform.toLowerCase().includes(term) || item.category.toLowerCase().includes(term);

                      const tag = savedTags[item.id];
                      const matchesFabric = fabricFilter === 'All' || (tag && tag.fabricType.toLowerCase() === fabricFilter.toLowerCase());
                      const matchesColor = colorFilter === 'All' || (tag && tag.colorTag.toLowerCase() === colorFilter.toLowerCase());

                      return matchesSearch && matchesFabric && matchesColor;
                    }).map((item) => {
                      let platformColor = 'bg-stone-100 text-stone-850 border-stone-200';
                      if (item.platform.toLowerCase().includes('etsy')) {
                        platformColor = 'bg-orange-50 text-orange-800 border-orange-200';
                      } else if (item.platform.toLowerCase().includes('fold')) {
                        platformColor = 'bg-blue-50 text-blue-800 border-blue-200';
                      } else if (item.platform.toLowerCase().includes('seamwork')) {
                        platformColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                      } else if (item.platform.toLowerCase().includes('merchant')) {
                        platformColor = 'bg-purple-50 text-purple-800 border-purple-200';
                      } else if (item.platform.toLowerCase().includes('style')) {
                        platformColor = 'bg-amber-50 text-amber-800 border-amber-200';
                      }

                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="border border-sand-250 rounded-lg bg-white p-4 space-y-3.5 hover:border-sand-350 shadow-4xs hover:shadow-3xs transition-all relative overflow-hidden"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[9px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 border rounded-full ${platformColor}`}>
                                  {item.platform}
                                </span>
                                <span className="text-[9px] bg-sand-100 text-bark-600 px-1.5 py-0.5 rounded font-medium">
                                  {item.category}
                                </span>
                                <span className="text-[9px] bg-[#FAF8F5] text-bark-500 font-mono font-medium">
                                  Ref: {item.orderNumber}
                                </span>
                              </div>
                              <h5 className="font-serif text-sm font-semibold text-bark-900 pt-1">
                                {item.name}
                              </h5>
                              {item.notes && (
                                <p className="text-[10px] text-bark-550 italic leading-relaxed pt-0.5">
                                  “{item.notes}”
                                </p>
                              )}

                              {/* Tags Display section */}
                              {(() => {
                                const tag = savedTags[item.id];
                                return (
                                  <div className="flex flex-wrap items-center gap-2 pt-2">
                                    {tag?.fabricType ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold bg-clay-50 border border-clay-100 text-clay-705 px-2 py-0.5 rounded-full shadow-4xs">
                                        <Tag className="w-2.5 h-2.5 text-clay-500" />
                                        <span>{tag.fabricType}</span>
                                      </span>
                                    ) : null}

                                    {tag?.colorTag ? (
                                      <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold bg-sand-50 border border-sand-250 text-bark-750 px-2 py-0.5 rounded-full shadow-4xs">
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getHexColor(tag.colorTag) }} />
                                        <span>{tag.colorTag}</span>
                                      </span>
                                    ) : null}

                                    <button
                                      onClick={() => {
                                        setEditingTagsId(item.id);
                                        setEditingFabricType(tag?.fabricType || '');
                                        setEditingColorTag(tag?.colorTag || '');
                                      }}
                                      className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#ba6446] hover:underline cursor-pointer ml-1 animate-fade-in"
                                      title={pfUiT("ui.components.myorderssection.83e16f48a1")}
                                    >
                                      <span>{tag?.fabricType || tag?.colorTag ? 'Edit Tags' : '+ Add Tags'}</span>
                                    </button>
                                  </div>
                                );
                              })()}

                              {editingTagsId === item.id ? (
                                <div className="bg-sand-50/50 p-3 rounded-lg border border-sand-250/70 space-y-3 mt-2 text-xs w-full">
                                  <h6 className="font-bold text-bark-800 text-[10px] uppercase font-mono tracking-wider">{pfUiT("ui.components.myorderssection.bedbe6e8b0")}</h6>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-bark-500 uppercase font-mono">{pfUiT("ui.components.myorderssection.903d927d85")}</label>
                                      <input
                                        type="text"
                                        value={editingFabricType}
                                        onChange={(e) => setEditingFabricType(e.target.value)}
                                        placeholder={pfUiT("ui.components.myorderssection.11d4a9cf55")}
                                        className="w-full bg-white border border-sand-250 text-[11px] px-2 py-1 rounded focus:outline-none focus:border-[#ba6446]"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-bold text-bark-500 uppercase font-mono">{pfUiT("ui.components.myorderssection.2cdaca491b")}</label>
                                      <input
                                        type="text"
                                        value={editingColorTag}
                                        onChange={(e) => setEditingColorTag(e.target.value)}
                                        placeholder={pfUiT("ui.components.myorderssection.4bbfb83198")}
                                        className="w-full bg-white border border-sand-250 text-[11px] px-2 py-1 rounded focus:outline-none focus:border-[#ba6446]"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-1.5 pt-1">
                                    <button
                                      onClick={() => {
                                        setEditingTagsId(null);
                                      }}
                                      className="px-2.5 py-1 bg-white hover:bg-sand-100 border border-sand-200 rounded text-[9px] font-bold text-bark-600 cursor-pointer"
                                    >{pfUiT("ui.components.myorderssection.78a32c2d51")}</button>
                                    <button
                                      onClick={() => handleRemoveTags(item.id)}
                                      className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-[9px] font-bold cursor-pointer"
                                      title={pfUiT("ui.components.myorderssection.d2f9dd7990")}
                                    >{pfUiT("ui.components.myorderssection.583078ffd3")}</button>
                                    <button
                                      onClick={() => handleSaveTags(item.id)}
                                      className="px-2.5 py-1 bg-[#ba6446] hover:bg-[#a25135] text-white rounded text-[9px] font-bold cursor-pointer"
                                    >{pfUiT("ui.components.myorderssection.aca3c3643f")}</button>
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            <button
                              onClick={() => handleDeleteImport(item.id, item.name)}
                              className="text-bark-300 hover:text-red-600 p-1 rounded-md transition-colors cursor-pointer"
                              title={pfUiT("ui.components.myorderssection.b5d28e3985")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-sans text-bark-500 pt-2 border-t border-sand-150/50">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-bark-400" />
                              Imported: {item.purchaseDate}
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  if (window.showToast) {
                                    window.showToast(`Calibrating high-resolution pattern package for ${item.name}...`, "info", "Format Configured");
                                    setTimeout(() => {
                                      window.showToast(`Download package is ready. Layout contains full sizing layers.`, "success", "PDF Complete");
                                    }, 1500);
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-[9px] font-bold text-clay-705 hover:text-[#ba6446] bg-clay-50/50 hover:bg-clay-50 px-2 py-1 rounded transition-colors cursor-pointer"
                              >
                                <Download className="w-2.5 h-2.5" />
                                <span>{pfUiT("ui.components.myorderssection.73132614d0")}</span>
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>
      )}
    </section>
  );
}
