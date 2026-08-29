import { localizeMetadataTree } from '../../lib/localizedMetadata';
import { perfectFitMetadata } from '../../config/perfectFitMetadata';
import { translatePerfectFitText as pfUiT } from '../../lib/i18n';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye, Lock, Plus, Trash2, ZoomIn, Image as ImageIcon,
  Sparkles, Check, X, Layers, Scissors, ChevronLeft, ChevronRight,
  ExternalLink, ArrowRight, Paintbrush, Palette, Search, Info, Package, RefreshCw
} from 'lucide-react';
import {
  getPatternMedia,
  toggleMediaVisibility,
  addPatternMediaItem,
  deletePatternMediaItem,
  MEDIA_TYPES,
  getPatternSwatches,
  addPatternSwatchItem,
  deletePatternSwatchItem,
  DEFAULT_FABRIC_SWATCHES
} from '../../lib/patternMediaManager';
import { UI_LAYERS } from '../../lib/uiLayers';

export default function ProductDevelopmentMediaGallery({ pattern }) {
  const PANTONE_PRESETS = localizeMetadataTree(perfectFitMetadata.componentUi.productDevelopmentMedia.pantonePresets, 'component.productDevelopmentMedia.pantonePresets', pfUiT);

  // Main Workspace Sub-Tab Mode: 'swatches' | 'media'
  const [activeSubTab, setActiveSubTab] = useState('swatches');
  const [version, setVersion] = useState(0);

  // --- SWATCH LIBRARY STATE ---
  const [swatchList, setSwatchList] = useState([]);
  const [selectedSwatch, setSelectedSwatch] = useState(null);
  const [showAddSwatchForm, setShowAddSwatchForm] = useState(false);
  const [magnifierSwatch, setMagnifierSwatch] = useState(null);

  // Magnifier Mouse Cursor State
  const [magnifierPos, setMagnifierPos] = useState({ x: 50, y: 50, show: false });
  const magnifierImgRef = useRef(null);

  // New Swatch Form State
  const [swatchName, setSwatchName] = useState('');
  const [swatchComposition, setSwatchComposition] = useState('100% Belgian Flax Linen');
  const [swatchColorName, setSwatchColorName] = useState('Oatmeal / White Sand');
  const [swatchColorHex, setSwatchColorHex] = useState('#DBCCB5');
  const [swatchPantoneName, setSwatchPantoneName] = useState('White Sand');
  const [swatchPantoneCode, setSwatchPantoneCode] = useState('13-0002-TCX');
  const [swatchStockMeters, setSwatchStockMeters] = useState(120);
  const [swatchSupplier, setSwatchSupplier] = useState('Solbiati Linen Mill, Italy');
  const [swatchImageUrl, setSwatchImageUrl] = useState('');
  const [swatchNotes, setSwatchNotes] = useState('');

  // --- MEDIA GALLERY STATE ---
  const [mediaList, setMediaList] = useState([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [showAddMediaForm, setShowAddMediaForm] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  // New Media Form State
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('sketch');
  const [newUrl, setNewUrl] = useState('');
  const [newIsSecret, setNewIsSecret] = useState(false);
  const [newDescription, setNewDescription] = useState('');

  // Load Data
  useEffect(() => {
    if (pattern?.id) {
      const sw = getPatternSwatches(pattern.id);
      setSwatchList(sw);
      if (sw.length > 0) setSelectedSwatch(sw[0]);

      const med = getPatternMedia(pattern.id);
      setMediaList(med);
    }
  }, [pattern?.id, version]);

  // Subscribe to storage updates
  useEffect(() => {
    const handleUpdate = () => setVersion(v => v + 1);
    window.addEventListener('pattern_media_updated', handleUpdate);
    window.addEventListener('pattern_swatches_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('pattern_media_updated', handleUpdate);
      window.removeEventListener('pattern_swatches_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Media slider bounds safety
  useEffect(() => {
    if (activeSlideIndex >= mediaList.length && mediaList.length > 0) {
      setActiveSlideIndex(mediaList.length - 1);
    }
  }, [mediaList.length, activeSlideIndex]);

  const activeMediaItem = mediaList[activeSlideIndex] || mediaList[0];
  const visibleCount = useMemo(() => mediaList.filter(m => !m.isSecret).length, [mediaList]);
  const secretCount = useMemo(() => mediaList.filter(m => m.isSecret).length, [mediaList]);

  const totalStockMeters = useMemo(() => {
    return swatchList.reduce((acc, curr) => acc + (Number(curr.stockMeters) || 0), 0);
  }, [swatchList]);

  // --- SWATCH ACTIONS ---
  const handleCreateSwatch = (e) => {
    e.preventDefault();
    if (!swatchName.trim()) {
      if (window.showToast) window.showToast('Please enter a name for the fabric swatch.', 'warning');
      return;
    }

    const defaultImg = swatchImageUrl.trim() || 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80';

    const updated = addPatternSwatchItem(pattern.id, {
      name: swatchName.trim(),
      composition: swatchComposition.trim(),
      colorName: swatchColorName.trim(),
      colorHex: swatchColorHex,
      pantoneName: swatchPantoneName.trim(),
      pantoneCode: swatchPantoneCode.trim(),
      stockMeters: parseFloat(swatchStockMeters) || 100,
      supplier: swatchSupplier.trim() || 'Atelier Direct',
      imageUrl: defaultImg,
      notes: swatchNotes.trim() || `Custom fabric swatch for ${pattern.name}.`
    });

    setSwatchList(updated);
    setSelectedSwatch(updated[0]);

    if (window.showToast) {
      window.showToast(`Added "${swatchName.trim()}" to fabric stock library.`, 'success', 'New Swatch Created');
    }

    // Reset Form
    setSwatchName('');
    setSwatchImageUrl('');
    setSwatchNotes('');
    setShowAddSwatchForm(false);
  };

  const handleDeleteSwatch = (swatchId, name) => {
    const updated = deletePatternSwatchItem(pattern.id, swatchId);
    setSwatchList(updated);
    if (selectedSwatch?.id === swatchId && updated.length > 0) {
      setSelectedSwatch(updated[0]);
    }
    if (window.showToast) {
      window.showToast(`Removed "${name}" from fabric library.`, 'info', 'Swatch Removed');
    }
  };

  // --- MEDIA ACTIONS ---
  const handleToggleSecret = (mediaId, currentIsSecret, title) => {
    const updated = toggleMediaVisibility(pattern.id, mediaId);
    setMediaList(updated);
    if (window.showToast) {
      window.showToast(
        !currentIsSecret
          ? `"${title}" is now SECRET (Internal in workspace, hidden from Quick View).`
          : `"${title}" is now VISIBLE (Published in customer Quick View gallery).`,
        !currentIsSecret ? 'warning' : 'success',
        !currentIsSecret ? 'Set to Secret' : 'Set to Visible'
      );
    }
  };

  const handleDeleteMedia = (mediaId, title) => {
    const updated = deletePatternMediaItem(pattern.id, mediaId);
    setMediaList(updated);
    if (window.showToast) {
      window.showToast(`Removed "${title}" from photo slider.`, 'info', 'Photo Deleted');
    }
  };

  const handleAddMedia = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      if (window.showToast) window.showToast('Please enter a title for the photo/sketch.', 'warning');
      return;
    }

    const typeInfo = MEDIA_TYPES.find(t => t.id === newType) || MEDIA_TYPES[0];
    const defaultSampleUrl = newType === 'sketch'
      ? 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80'
      : newType === 'pattern_layout'
      ? 'https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=800&q=80'
      : newType === 'detail'
      ? 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80'
      : 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80';

    const finalUrl = newUrl.trim() || defaultSampleUrl;

    const updated = addPatternMediaItem(pattern.id, {
      title: newTitle.trim(),
      type: newType,
      typeLabel: typeInfo.shortLabel,
      url: finalUrl,
      isSecret: newIsSecret,
      description: newDescription.trim() || `${typeInfo.shortLabel} for ${pattern.name}.`
    });

    setMediaList(updated);
    setActiveSlideIndex(updated.length - 1);

    if (window.showToast) {
      window.showToast(
        `Added "${newTitle.trim()}" (${newIsSecret ? '🔒 Secret' : '👁️ Visible'}).`,
        'success',
        'Photo Added'
      );
    }

    setNewTitle('');
    setNewUrl('');
    setNewDescription('');
    setShowAddMediaForm(false);
  };

  // Magnifier Mouse move calculation
  const handleMouseMoveMagnifier = (e) => {
    if (!magnifierImgRef.current) return;
    const { left, top, width, height } = magnifierImgRef.current.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setMagnifierPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)), show: true });
  };

  const sampleTexturePresets = [
    { label: 'Belgian Organic Linen', url: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80' },
    { label: 'Mulberry Silk Satin', url: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=800&q=80' },
    { label: 'Wool Crepe Suiting', url: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80' },
    { label: 'Combed Cotton Gabardine', url: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=800&q=80' },
    { label: 'Tencel Lyocell Denim', url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80' }
  ];

  return (
    <div className="space-y-6 animate-fadeIn" id="pd-workspace-swatch-media-view">
      {/* WORKSPACE NAVIGATION SUB-TABS */}
      <div className="bg-white border border-sand-200 rounded-2xl p-2 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-3xs">
        <div className="flex bg-sand-100 p-1 rounded-xl w-full sm:w-auto border border-sand-200">
          <button
            type="button"
            onClick={() => setActiveSubTab('swatches')}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'swatches'
                ? 'bg-clay-605 text-white shadow-xs'
                : 'text-bark-600 hover:text-bark-900 hover:bg-white/50'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Fabric Swatch &amp; Stock Library ({swatchList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('media')}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'media'
                ? 'bg-clay-605 text-white shadow-xs'
                : 'text-bark-600 hover:text-bark-900 hover:bg-white/50'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Technical Media &amp; Photo Slider ({mediaList.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-bark-500 pr-2">
          <span>{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.7f0159c9c4")}</span>
          <span className="font-bold text-bark-900 bg-sand-100 px-2 py-1 rounded border border-sand-200">
            {pattern?.id || 'sartorial-01'}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: FABRIC SWATCH & STOCK LIBRARY                                  */}
      {/* ========================================================================= */}
      {activeSubTab === 'swatches' && (
        <div className="space-y-6">
          {/* Header & Stats Banner */}
          <div className="bg-white border border-sand-200 rounded-2xl p-6 space-y-6 shadow-3xs">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-sand-150 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-clay-50 border border-clay-200 text-clay-705 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-clay-605" /> Textile Stock &amp; Swatch Studio
                  </span>
                  <span className="text-bark-500 text-xs font-mono font-bold">• {pattern?.name}</span>
                </div>
                <h4 className="text-xl font-serif text-bark-950 font-normal">
                  Fabric Swatch Library &amp; Roll Stock Management
                </h4>
                <p className="text-xs text-bark-500 max-w-2xl leading-relaxed">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.f130f4b622")}<strong>{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.32e9d18fa3")}</strong>{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.6c68a18342")}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddSwatchForm(!showAddSwatchForm)}
                  className={`text-xs font-bold font-sans px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2 cursor-pointer border ${
                    showAddSwatchForm
                      ? 'bg-sand-200 text-bark-800 border-sand-300'
                      : 'bg-clay-605 hover:bg-clay-705 text-white border-clay-500/50'
                  }`}
                >
                  <Plus className="w-4 h-4 stroke-[3px]" />
                  <span>{showAddSwatchForm ? 'Close Form' : 'Add New Custom Swatch'}</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-[#FAF8F5] border border-sand-200 rounded-xl">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-lg bg-clay-605 text-white flex items-center justify-center font-bold text-xs font-mono">
                  {swatchList.length}
                </div>
                <div>
                  <div className="text-[9.5px] font-mono uppercase font-bold text-bark-500">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.87a22cca91")}</div>
                  <div className="text-xs font-sans font-bold text-bark-900">Custom &amp; Standard Fabrics</div>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-sand-200 pt-2 sm:pt-0 sm:pl-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs font-mono">
                  <Package className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <div className="text-[9.5px] font-mono uppercase font-bold text-emerald-800">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.a124217a86")}</div>
                  <div className="text-xs font-sans font-bold text-bark-900">{totalStockMeters.toFixed(1)} Meters Available</div>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-sand-200 pt-2 sm:pt-0 sm:pl-4">
                <div className="w-8 h-8 rounded-lg bg-sand-200 text-bark-800 flex items-center justify-center font-bold text-xs font-mono">
                  <Palette className="w-4 h-4 text-clay-605" />
                </div>
                <div>
                  <div className="text-[9.5px] font-mono uppercase font-bold text-bark-600">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.cab187607f")}</div>
                  <div className="text-xs font-sans font-bold text-bark-900">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.719dd178f2")}</div>
                </div>
              </div>
            </div>

            {/* INLINE ADD NEW CUSTOM FABRIC SWATCH FORM */}
            <AnimatePresence>
              {showAddSwatchForm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="bg-[#FAF8F5] border border-sand-250 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-center border-b border-sand-200 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-clay-605 text-white">
                          <Plus className="w-4 h-4 stroke-[2.5px]" />
                        </span>
                        <div>
                          <h4 className="text-sm font-serif font-bold text-bark-950">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.d0c67458f9")}</h4>
                          <p className="text-xs text-bark-500">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.baea23933a")}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAddSwatchForm(false)}
                        className="text-bark-400 hover:text-bark-900 text-xs font-mono font-bold"
                      >{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.009fd1c842")}</button>
                    </div>

                    <form onSubmit={handleCreateSwatch} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-mono uppercase font-bold text-bark-700 block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.b44c766bf9")}</label>
                          <input
                            type="text"
                            required
                            value={swatchName}
                            onChange={(e) => setSwatchName(e.target.value)}
                            placeholder={pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.892da78cd6")}
                            className="w-full bg-white border border-sand-250 rounded-xl px-3.5 py-2.5 text-xs font-sans text-bark-900 focus:outline-none focus:border-clay-605 shadow-2xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-mono uppercase font-bold text-bark-700 block">
                            Fiber Composition &amp; Weave
                          </label>
                          <input
                            type="text"
                            value={swatchComposition}
                            onChange={(e) => setSwatchComposition(e.target.value)}
                            placeholder={pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.b8c7d452ea")}
                            className="w-full bg-white border border-sand-250 rounded-xl px-3.5 py-2.5 text-xs font-sans text-bark-900 focus:outline-none focus:border-clay-605 shadow-2xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-mono uppercase font-bold text-bark-700 block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.359170e57c")}</label>
                          <input
                            type="text"
                            value={swatchColorName}
                            onChange={(e) => setSwatchColorName(e.target.value)}
                            placeholder={pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.0e7f4497b8")}
                            className="w-full bg-white border border-sand-250 rounded-xl px-3 py-2 text-xs font-sans text-bark-900 focus:outline-none focus:border-clay-605"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-mono uppercase font-bold text-bark-700 block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.c55ab78f00")}</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={swatchColorHex}
                              onChange={(e) => setSwatchColorHex(e.target.value)}
                              className="w-9 h-9 rounded-lg border border-sand-250 cursor-pointer shrink-0 p-0.5"
                            />
                            <input
                              type="text"
                              value={swatchColorHex}
                              onChange={(e) => setSwatchColorHex(e.target.value)}
                              className="w-full bg-white border border-sand-250 rounded-xl px-3 py-2 text-xs font-mono text-bark-900 focus:outline-none focus:border-clay-605"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-mono uppercase font-bold text-bark-700 block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.c0943cd1b2")}</label>
                          <input
                            type="text"
                            value={swatchPantoneCode}
                            onChange={(e) => setSwatchPantoneCode(e.target.value)}
                            placeholder={pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.ed5726bcb3")}
                            className="w-full bg-white border border-sand-250 rounded-xl px-3 py-2 text-xs font-mono text-bark-900 focus:outline-none focus:border-clay-605"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-mono uppercase font-bold text-bark-700 block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.785e6d0770")}</label>
                          <input
                            type="text"
                            value={swatchPantoneName}
                            onChange={(e) => setSwatchPantoneName(e.target.value)}
                            placeholder={pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.b29399ede9")}
                            className="w-full bg-white border border-sand-250 rounded-xl px-3 py-2 text-xs font-sans text-bark-900 focus:outline-none focus:border-clay-605"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-mono uppercase font-bold text-bark-700 block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.4eb4cb37af")}</label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={swatchStockMeters}
                            onChange={(e) => setSwatchStockMeters(e.target.value)}
                            placeholder="120"
                            className="w-full bg-white border border-sand-250 rounded-xl px-3.5 py-2 text-xs font-mono text-bark-900 focus:outline-none focus:border-clay-605"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-mono uppercase font-bold text-bark-700 block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.0ed1652934")}</label>
                          <input
                            type="text"
                            value={swatchSupplier}
                            onChange={(e) => setSwatchSupplier(e.target.value)}
                            placeholder={pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.2e644ba376")}
                            className="w-full bg-white border border-sand-250 rounded-xl px-3.5 py-2 text-xs font-sans text-bark-900 focus:outline-none focus:border-clay-605"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-mono uppercase font-bold text-bark-700 block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.efb8ec41d4")}</label>
                        <input
                          type="url"
                          value={swatchImageUrl}
                          onChange={(e) => setSwatchImageUrl(e.target.value)}
                          placeholder={pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.48e61c37ac")}
                          className="w-full bg-white border border-sand-250 rounded-xl px-3.5 py-2 text-xs font-sans text-bark-900 focus:outline-none focus:border-clay-605"
                        />

                        {/* Texture Preset Quick Buttons */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className="text-[10px] font-mono text-bark-500 self-center mr-1">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.88f6e5e699")}</span>
                          {sampleTexturePresets.map((p, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setSwatchImageUrl(p.url);
                                if (!swatchName) setSwatchName(`${p.label} - Custom`);
                              }}
                              className="text-[10px] font-mono px-2 py-1 rounded bg-white hover:bg-sand-100 text-bark-800 border border-sand-250 transition-all cursor-pointer shadow-2xs"
                            >
                              + {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-mono uppercase font-bold text-bark-700 block">
                          Technical Seam &amp; Sewing Notes
                        </label>
                        <input
                          type="text"
                          value={swatchNotes}
                          onChange={(e) => setSwatchNotes(e.target.value)}
                          placeholder={pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.12008c4fa0")}
                          className="w-full bg-white border border-sand-250 rounded-xl px-3.5 py-2 text-xs font-sans text-bark-900 focus:outline-none focus:border-clay-605"
                        />
                      </div>

                      <div className="pt-2 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowAddSwatchForm(false)}
                          className="px-4 py-2 rounded-xl text-xs font-sans font-bold text-bark-600 hover:bg-sand-200 transition-colors cursor-pointer"
                        >{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.009fd1c842")}</button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl text-xs font-sans font-bold bg-clay-605 hover:bg-clay-705 text-white transition-all shadow-sm cursor-pointer"
                        >{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.506649162f")}</button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* SCROLLABLE FABRIC SWATCH LIST & INSPECTOR */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-sand-200 pb-2">
                <span className="text-[11px] font-mono uppercase font-bold text-bark-700 tracking-wider flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-clay-605" /> Scrollable Fabric Swatch Library ({swatchList.length} Fabrics)
                </span>
                <span className="text-[10px] font-mono text-bark-400 italic">
                  Scroll list to select &amp; inspect swatches
                </span>
              </div>

              {/* Scrollable Container with Custom Scrollbar */}
              <div className="max-h-[560px] overflow-y-auto pr-1 space-y-3.5 scrollbar-thin scrollbar-thumb-sand-300">
                {swatchList.map((swatch) => {
                  const isSelected = selectedSwatch?.id === swatch.id;
                  return (
                    <div
                      key={swatch.id}
                      onClick={() => setSelectedSwatch(swatch)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-white border-clay-500 ring-2 ring-clay-500/20 shadow-md'
                          : 'bg-[#FAF8F5] border-sand-250 hover:bg-white hover:border-sand-350 shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        {/* Left: Swatch Image & Information */}
                        <div className="flex items-start gap-3.5 min-w-0">
                          {/* Fabric Photo Thumbnail with Magnifier Hover Icon */}
                          <div
                            className="relative w-20 h-20 rounded-xl border border-sand-300 overflow-hidden shrink-0 group bg-sand-100 shadow-2xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMagnifierSwatch(swatch);
                            }}
                          >
                            <img
                              src={swatch.imageUrl}
                              alt={swatch.name}
                              className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-300"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-bark-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Search className="w-5 h-5 text-amber-200" />
                            </div>
                            <div className="absolute bottom-1 right-1 bg-white/90 text-[8px] font-mono font-bold px-1 rounded text-bark-900 shadow-2xs">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.50fdb5a49b")}</div>
                          </div>

                          <div className="space-y-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h5 className="text-sm font-serif font-bold text-bark-950 truncate">
                                {swatch.name}
                              </h5>
                              <span className="px-2 py-0.5 rounded bg-sand-200 text-bark-800 text-[9.5px] font-mono font-bold">
                                {swatch.composition}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-bark-600">
                              <span className="flex items-center gap-1.5">
                                <span className="w-3.5 h-3.5 rounded-full border border-sand-300 inline-block shadow-2xs" style={{ backgroundColor: swatch.colorHex }} />
                                <strong className="text-bark-900">{swatch.colorName}</strong>
                              </span>
                              <span>•</span>
                              <span className="text-clay-705 font-bold">
                                PANTONE® {swatch.pantoneCode} ({swatch.pantoneName})
                              </span>
                            </div>

                            <p className="text-xs text-bark-600 font-sans line-clamp-1">
                              {swatch.notes}
                            </p>
                          </div>
                        </div>

                        {/* Right: Stock Inventory & Actions */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-sand-200">
                          <div className="text-left sm:text-right">
                            <div className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-mono font-bold inline-flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 text-emerald-700" />
                              <span>{swatch.stockMeters} M in Roll Stock</span>
                            </div>
                            <div className="text-[10px] font-mono text-bark-400 mt-1 block">
                              Mill: {swatch.supplier}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMagnifierSwatch(swatch);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-sand-100 hover:bg-clay-605 hover:text-white text-bark-800 text-xs font-mono font-bold transition-all flex items-center gap-1.5 border border-sand-250 cursor-pointer shadow-2xs"
                            >
                              <Search className="w-3.5 h-3.5 text-clay-605 group-hover:text-white" />
                              <span>{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.13f5b279a5")}</span>
                            </button>

                            <a
                              href={`https://www.pantone.com/color-finder/${swatch.pantoneCode}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 text-clay-705 hover:text-clay-900 hover:bg-clay-50 rounded-lg transition-colors cursor-pointer"
                              title={`Verify ${swatch.pantoneCode} on Pantone.com`}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSwatch(swatch.id, swatch.name);
                              }}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title={pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.b20e59cc80")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: TECHNICAL MEDIA & PHOTO SLIDER                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'media' && (
        <div className="bg-white border border-sand-200 rounded-2xl p-6 space-y-6 shadow-3xs">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-sand-150 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded bg-clay-50 border border-clay-200 text-clay-705 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-clay-605" /> Technical Media &amp; Photo Gallery
                </span>
                <span className="text-bark-500 text-xs font-mono font-bold">• {pattern?.name}</span>
              </div>
              <h4 className="text-xl font-serif text-bark-950 font-normal">
                Pattern Photo Slider &amp; Confidentiality Controls
              </h4>
              <p className="text-xs text-bark-500 max-w-2xl leading-relaxed">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.a1a650af6f")}<strong>{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.636cd07d18")}</strong>{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.932b819cd3")}</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAddMediaForm(!showAddMediaForm)}
                className={`text-xs font-bold font-sans px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2 cursor-pointer border ${
                  showAddMediaForm
                    ? 'bg-sand-200 text-bark-800 border-sand-300'
                    : 'bg-clay-605 hover:bg-clay-705 text-white border-clay-500/50'
                }`}
              >
                <Plus className="w-4 h-4 stroke-[3px]" />
                <span>{showAddMediaForm ? 'Close Form' : 'Add Photo / CAD Sketch'}</span>
              </button>
            </div>
          </div>

          {/* Visibility Stats Summary Pill */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-[#FAF8F5] border border-sand-200 rounded-xl">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-lg bg-bark-900 text-amber-100 flex items-center justify-center font-bold text-xs font-mono">
                {mediaList.length}
              </div>
              <div>
                <div className="text-[9.5px] font-mono uppercase font-bold text-bark-500">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.c638a85519")}</div>
                <div className="text-xs font-sans font-bold text-bark-900">Photos &amp; Drawings</div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-sand-200 pt-2 sm:pt-0 sm:pl-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs font-mono">
                <Eye className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <div className="text-[9.5px] font-mono uppercase font-bold text-emerald-800">Public Visible ({visibleCount})</div>
                <div className="text-xs font-sans text-bark-700">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.f77029112f")}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-sand-200 pt-2 sm:pt-0 sm:pl-4">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xs font-mono">
                <Lock className="w-4 h-4 text-amber-800" />
              </div>
              <div>
                <div className="text-[9.5px] font-mono uppercase font-bold text-amber-900">Secret / Confidential ({secretCount})</div>
                <div className="text-xs font-sans text-bark-700">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.b2ae8fe19f")}</div>
              </div>
            </div>
          </div>

          {/* PHOTO SLIDER MAIN VIEWER */}
          {activeMediaItem && (
            <div className="border border-sand-250 rounded-2xl overflow-hidden bg-[#FAF8F5] shadow-sm relative flex flex-col lg:flex-row min-h-[420px]">
              {/* Main Photo Slider Viewer */}
              <div className="relative lg:w-7/12 min-h-[340px] lg:min-h-[420px] bg-sand-100/60 flex items-center justify-center group select-none overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={activeMediaItem.id}
                    src={activeMediaItem.url}
                    alt={activeMediaItem.title}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="w-full h-full object-contain max-h-[420px]"
                    referrerPolicy="no-referrer"
                  />
                </AnimatePresence>

                {/* Slider Navigation Arrows */}
                {mediaList.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveSlideIndex(prev => (prev > 0 ? prev - 1 : mediaList.length - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-clay-605 hover:text-white text-bark-900 flex items-center justify-center transition-all shadow-md backdrop-blur-xs cursor-pointer border border-sand-300 active:scale-95"
                      title={pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.51f37defce")}
                    >
                      <ChevronLeft className="w-5 h-5 stroke-[2.5px]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSlideIndex(prev => (prev < mediaList.length - 1 ? prev + 1 : 0))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-clay-605 hover:text-white text-bark-900 flex items-center justify-center transition-all shadow-md backdrop-blur-xs cursor-pointer border border-sand-300 active:scale-95"
                      title={pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.b00afe8d78")}
                    >
                      <ChevronRight className="w-5 h-5 stroke-[2.5px]" />
                    </button>
                  </>
                )}

                {/* Slide Header Badges */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
                  <span className="px-3 py-1 rounded-md bg-white/95 text-bark-900 border border-sand-250 text-[10px] font-mono font-bold uppercase tracking-wider shadow-2xs backdrop-blur-xs">
                    {activeMediaItem.type === 'sketch' ? '🎨 Technical Sketch' : activeMediaItem.type === 'pattern_layout' ? '📐 Pattern Draft' : activeMediaItem.type === 'detail' ? '🔍 Seam Detail' : activeMediaItem.type === 'prototype' ? '🔒 Prototype Spec' : '📸 Garment Sample'}
                  </span>

                  <span className="px-3 py-1 rounded-md bg-bark-900 text-amber-100 border border-bark-800 text-[10px] font-mono font-bold uppercase tracking-wider shadow-2xs">
                    Slide {activeSlideIndex + 1} of {mediaList.length}
                  </span>
                </div>

                {/* Lightbox Zoom Button */}
                <button
                  type="button"
                  onClick={() => setLightboxImage(activeMediaItem)}
                  className="absolute bottom-4 right-4 z-10 bg-white/90 hover:bg-white text-bark-900 border border-sand-300 p-2 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4 text-clay-605" />
                  <span>{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.ddb5131b8d")}</span>
                </button>
              </div>

              {/* Right Side Controls & Visibility Switch */}
              <div className="lg:w-5/12 p-6 bg-white border-t lg:border-t-0 lg:border-l border-sand-200 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="flex justify-between items-start gap-2 border-b border-sand-150 pb-3">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-clay-705 block mb-0.5">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.d8a9ef7742")}</span>
                      <h4 className="text-lg font-serif font-bold text-bark-950">
                        {activeMediaItem.title}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteMedia(activeMediaItem.id, activeMediaItem.title)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title={pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.01dcc61ac5")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-bark-500 uppercase font-bold block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.74da45852a")}</span>
                    <p className="text-xs font-sans text-bark-700 leading-relaxed bg-sand-50/70 p-3 rounded-xl border border-sand-200">
                      {activeMediaItem.description || 'No additional technical notes recorded for this asset.'}
                    </p>
                  </div>

                  {/* VISIBILITY TOGGLE SWITCH */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[10.5px] font-mono font-bold uppercase text-bark-700 block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.255d7b23bb")}</span>

                    <div className={`p-4 rounded-xl border space-y-3 transition-all ${
                      activeMediaItem.isSecret
                        ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                        : 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        {activeMediaItem.isSecret ? (
                          <Lock className="w-5 h-5 text-amber-700 shrink-0" />
                        ) : (
                          <Eye className="w-5 h-5 text-emerald-700 shrink-0" />
                        )}
                        <div>
                          <div className="text-xs font-mono font-bold uppercase">
                            {activeMediaItem.isSecret ? '🔒 Workspace Secret (Confidential)' : '👁️ Visible in Quick View Modal'}
                          </div>
                          <p className="text-[11px] text-bark-600 leading-normal mt-0.5">
                            {activeMediaItem.isSecret
                              ? 'Protected inside internal Product Development Workspace. Hidden from customer Quick View summary.'
                              : 'Published to customer Quick View summary gallery.'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleSecret(activeMediaItem.id, activeMediaItem.isSecret, activeMediaItem.title)}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs border ${
                          activeMediaItem.isSecret
                            ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-600'
                            : 'bg-bark-900 hover:bg-bark-950 text-amber-100 border-bark-800'
                        }`}
                      >
                        {activeMediaItem.isSecret ? (
                          <>
                            <Eye className="w-4 h-4 text-white" />
                            <span>{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.c0478aab71")}</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 text-amber-300" />
                            <span>Keep Picture Secret (Internal)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Thumbnail Strip */}
                <div className="pt-3 border-t border-sand-200 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-mono text-bark-500">
                    <span>Thumbnail Selector ({mediaList.length})</span>
                    <span>{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.504688d0a7")}</span>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-sand-300">
                    {mediaList.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveSlideIndex(idx)}
                        className={`relative w-12 h-12 rounded-lg border overflow-hidden shrink-0 transition-all cursor-pointer ${
                          activeSlideIndex === idx
                            ? 'border-clay-605 ring-2 ring-clay-605/30 scale-105 shadow-sm'
                            : 'border-sand-250 hover:border-sand-400 bg-white opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={item.url}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-0.5 right-0.5">
                          {item.isSecret ? (
                            <div className="w-3.5 h-3.5 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center text-[7px] font-bold">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.b90fd1279b")}</div>
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[7px] font-bold">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.74652745d8")}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INLINE ADD PHOTO / TECHNICAL DRAWING FORM */}
          <AnimatePresence>
            {showAddMediaForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="bg-[#FAF8F5] border border-sand-250 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-sand-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-clay-605 text-white">
                        <Plus className="w-4 h-4 stroke-[2.5px]" />
                      </span>
                      <div>
                        <h4 className="text-sm font-serif font-bold text-bark-950">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.decdd07c14")}</h4>
                        <p className="text-xs text-bark-500">Attach a new drawing, pattern marker draft, or sample photo for {pattern?.name}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAddMediaForm(false)}
                      className="text-bark-400 hover:text-bark-900 text-xs font-mono font-bold"
                    >{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.009fd1c842")}</button>
                  </div>

                  <form onSubmit={handleAddMedia} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-mono uppercase font-bold text-bark-700 block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.4d162ad668")}</label>
                        <input
                          type="text"
                          required
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="e.g., Technical Flat CAD (Back View), Dart Grading Spec"
                          className="w-full bg-white border border-sand-250 rounded-xl px-3.5 py-2.5 text-xs font-sans text-bark-900 focus:outline-none focus:border-clay-605 shadow-2xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-mono uppercase font-bold text-bark-700 block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.95d17bdcae")}</label>
                          <select
                            value={newType}
                            onChange={(e) => setNewType(e.target.value)}
                            className="w-full bg-white border border-sand-250 rounded-xl px-3 py-2.5 text-xs font-sans text-bark-900 focus:outline-none focus:border-clay-605 cursor-pointer"
                          >
                            {MEDIA_TYPES.map(t => (
                              <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-mono uppercase font-bold text-bark-700 block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.30f8566dbd")}</label>
                          <button
                            type="button"
                            onClick={() => setNewIsSecret(!newIsSecret)}
                            className={`w-full py-2.5 px-3 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                              newIsSecret
                                ? 'bg-amber-100 text-amber-950 border-amber-300'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            }`}
                          >
                            {newIsSecret ? (
                              <>
                                <Lock className="w-3.5 h-3.5 text-amber-700" />
                                <span>{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.d1d51fb4db")}</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5 text-emerald-700" />
                                <span>{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.1828abc01a")}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-mono uppercase font-bold text-bark-700 block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.7eeeb8d816")}</label>
                      <input
                        type="url"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full bg-white border border-sand-250 rounded-xl px-3.5 py-2 text-xs font-sans text-bark-900 focus:outline-none focus:border-clay-605"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-mono uppercase font-bold text-bark-700 block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.9f9826c838")}</label>
                      <input
                        type="text"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder={pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.c86bb27909")}
                        className="w-full bg-white border border-sand-250 rounded-xl px-3.5 py-2 text-xs font-sans text-bark-900 focus:outline-none focus:border-clay-605"
                      />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowAddMediaForm(false)}
                        className="px-4 py-2 rounded-xl text-xs font-sans font-bold text-bark-600 hover:bg-sand-200 transition-colors cursor-pointer"
                      >{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.009fd1c842")}</button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl text-xs font-sans font-bold bg-clay-605 hover:bg-clay-705 text-white transition-all shadow-sm cursor-pointer"
                      >{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.ef8088ae3e")}</button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAGNIFYING GLASS FABRIC SWATCH INSPECTOR MODAL                             */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {magnifierSwatch && (
          <div
            className="fixed inset-0 flex items-center justify-center p-4 bg-bark-950/80 backdrop-blur-xs"
            style={{ zIndex: UI_LAYERS.modalBackdrop }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-sand-300 rounded-2xl max-w-4xl w-full p-6 space-y-5 text-bark-950 relative shadow-2xl overflow-hidden"
              style={{ zIndex: UI_LAYERS.modal }}
            >
              <div className="flex justify-between items-center border-b border-sand-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-clay-605 text-white">
                    <Search className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-clay-705">
                      HD Fabric Weave Magnifier &amp; Pantone Standard
                    </span>
                    <h4 className="text-lg font-serif font-bold text-bark-950">
                      {magnifierSwatch.name}
                    </h4>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMagnifierSwatch(null)}
                  className="p-1.5 text-bark-400 hover:text-bark-900 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Main Content Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left 7 cols: Interactive Texture Magnifier */}
                <div className="md:col-span-7 space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono text-bark-600">
                    <span className="font-bold flex items-center gap-1">
                      <Search className="w-3.5 h-3.5 text-clay-605" />{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.906d2d62eb")}</span>
                    <span>{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.2384993397")}</span>
                  </div>

                  <div
                    className="relative w-full h-[320px] rounded-xl overflow-hidden border border-sand-300 bg-sand-100 cursor-crosshair select-none shadow-2xs"
                    onMouseMove={handleMouseMoveMagnifier}
                    onMouseEnter={() => setMagnifierPos(p => ({ ...p, show: true }))}
                    onMouseLeave={() => setMagnifierPos(p => ({ ...p, show: false }))}
                  >
                    <img
                      ref={magnifierImgRef}
                      src={magnifierSwatch.imageUrl}
                      alt={magnifierSwatch.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />

                    {/* Magnifier Lens */}
                    {magnifierPos.show && (
                      <div
                        className="absolute w-32 h-32 rounded-full border-2 border-amber-300 shadow-2xl pointer-events-none z-30 overflow-hidden ring-4 ring-black/20"
                        style={{
                          left: `calc(${magnifierPos.x}% - 64px)`,
                          top: `calc(${magnifierPos.y}% - 64px)`,
                          backgroundImage: `url(${magnifierSwatch.imageUrl})`,
                          backgroundPosition: `${magnifierPos.x}% ${magnifierPos.y}%`,
                          backgroundSize: '350%',
                          backgroundRepeat: 'no-repeat'
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-2 h-2 rounded-full bg-amber-400/60 ring-1 ring-white" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right 5 cols: PANTONE Spec Card & Details */}
                <div className="md:col-span-5 bg-[#FAF8F5] border border-sand-250 rounded-xl p-4 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <span className="text-[10.5px] font-mono uppercase font-bold text-bark-600 tracking-wider block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.104ba6550e")}</span>

                    {/* Pantone Chip */}
                    <div className="bg-white border border-sand-200 rounded-xl p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-16 bg-white rounded-md border border-sand-250 flex flex-col justify-between p-1 shadow-2xs shrink-0">
                          <div className="flex-grow rounded-xs" style={{ backgroundColor: magnifierSwatch.colorHex }} />
                          <div className="text-[6px] font-mono pt-1 text-center font-bold text-bark-900 tracking-tight uppercase">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.3018e0b368")}</div>
                        </div>

                        <div className="min-w-0">
                          <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-clay-705 block">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.e038d5db48")}</span>
                          <span className="text-base font-bold font-mono text-bark-950 block truncate">
                            {magnifierSwatch.pantoneCode}
                          </span>
                          <span className="text-xs text-bark-600 font-serif italic block truncate mt-0.5">
                            {magnifierSwatch.pantoneName} ({magnifierSwatch.colorName})
                          </span>
                        </div>
                      </div>

                      {/* Official Link Button */}
                      <a
                        href={`https://www.pantone.com/color-finder/${magnifierSwatch.pantoneCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-sand-100 hover:bg-clay-605 hover:text-white text-bark-800 border border-sand-250 text-[10px] font-mono font-bold uppercase tracking-wider py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                      >
                        <span>{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.7e123ccb1e")}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-clay-605 group-hover:text-white" />
                      </a>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="text-bark-500 font-mono text-[10px] uppercase font-bold">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.97188c0981")}</div>
                      <div className="font-semibold text-bark-900">{magnifierSwatch.composition}</div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="text-bark-500 font-mono text-[10px] uppercase font-bold">{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.19d8d48bcd")}</div>
                      <div className="font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded inline-block border border-emerald-200">
                        {magnifierSwatch.stockMeters} Meters in Inventory ({magnifierSwatch.supplier})
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-sand-200 text-[11px] font-sans text-bark-600">
                    <strong>{pfUiT("ui.components.subcomponents.productdevelopmentmediagallery.632d323c4e")}</strong> {magnifierSwatch.notes}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LIGHTBOX ZOOM MODAL */}
      <AnimatePresence>
        {lightboxImage && (
          <div
            className="fixed inset-0 flex items-center justify-center p-4 bg-bark-950/80 backdrop-blur-xs"
            style={{ zIndex: UI_LAYERS.modalBackdrop }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-sand-300 rounded-2xl max-w-3xl w-full p-5 space-y-4 text-bark-950 relative shadow-2xl overflow-hidden"
              style={{ zIndex: UI_LAYERS.modal }}
            >
              <div className="flex justify-between items-center border-b border-sand-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-clay-705 font-mono text-xs uppercase font-bold">
                    {lightboxImage.typeLabel || 'Technical Drawing'}
                  </span>
                  <h4 className="text-base font-serif font-bold text-bark-950 truncate max-w-md">
                    {lightboxImage.title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="p-1.5 text-bark-400 hover:text-bark-900 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative max-h-[70vh] overflow-hidden rounded-xl bg-sand-100 flex items-center justify-center p-2">
                <img
                  src={lightboxImage.url}
                  alt={lightboxImage.title}
                  className="max-h-[65vh] w-auto object-contain rounded"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex justify-between items-center text-xs font-mono text-bark-600 pt-1">
                <p>{lightboxImage.description}</p>
                <span className="px-2.5 py-1 rounded-md bg-sand-100 text-bark-800 border border-sand-250">
                  {lightboxImage.isSecret ? '🔒 Secret Asset' : '👁️ Public Gallery'}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
