/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UploadCloud, RefreshCw, Scissors, Sparkles, Trash2,
  Layers, Sliders, Eye, EyeOff, RotateCcw, HelpCircle,
  DownloadCloud, ZoomIn, ZoomOut, Maximize, Check, Info, Shirt
} from 'lucide-react';

// Preset model backdrops for instant engagement if they don't have their own photo
const MODEL_PRESETS = [
  {
    id: 'studio-stand',
    name: 'Atelier Dress Form (Neutral)',
    desc: 'Classic wooden studio stand with sand-colored background',
    image: 'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 'minimalist-model',
    name: 'Standard Model (Casual Silhouette)',
    desc: 'Neutral standing pose with minimalist room lighting',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=600'
  },
  {
    id: 'fabric-hanger',
    name: 'Artisan Wood Hanger Backdrop',
    desc: 'Rustic atelier background for raw fabric/outline checks',
    image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&q=80&w=600'
  }
];

// Available atelier blueprints mapped from INITIAL_PATTERNS
const OVERLAY_BLUEPRINTS = [
  {
    id: 'aurelia-dress',
    name: 'Aurelia Wrap Dress',
    tagline: 'Asymmetrical wrap dress with dolman sleeves',
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600',
    blueprintOutline: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=600',
    type: 'Dresses'
  },
  {
    id: 'utility-trench',
    name: 'Atelier Utility Trench',
    tagline: 'Structured double-breasted coat with storm flaps',
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=600',
    blueprintOutline: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&q=80&w=600',
    type: 'Outerwear'
  },
  {
    id: 'palazzo-pants',
    name: 'Palazzo Wide Legs',
    tagline: 'High-waisted trousers with deep side pleats',
    image: 'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?auto=format&fit=crop&q=80&w=600',
    blueprintOutline: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=600',
    type: 'Trousers'
  },
  {
    id: 'dolman-blouse',
    name: 'Linen Dolman Blouse',
    tagline: 'Relaxed boatneck shirt with clean rolled cuffs',
    image: 'https://images.unsplash.com/photo-1548624149-f7b3e5cb365b?auto=format&fit=crop&q=80&w=600',
    blueprintOutline: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&q=80&w=600',
    type: 'Tops'
  }
];

// Creative Filter Presets to easily set multiple CSS parameters
const PRESETS = [
  {
    id: 'blueprint',
    name: 'Studio Blueprint',
    desc: 'Blue cyanotype aesthetic for structural drafting looks',
    filters: {
      blendMode: 'screen',
      opacity: 85,
      brightness: 110,
      contrast: 130,
      saturation: 40,
      hueRotate: 200,
      invert: 10,
      grayscale: 0,
      sepia: 0
    }
  },
  {
    id: 'xray',
    name: 'Couture X-Ray',
    desc: 'High contrast monochrome to trace drape flow outlines',
    filters: {
      blendMode: 'difference',
      opacity: 75,
      brightness: 120,
      contrast: 150,
      saturation: 0,
      hueRotate: 0,
      invert: 100,
      grayscale: 100,
      sepia: 0
    }
  },
  {
    id: 'fusion',
    name: 'Textile Fusion',
    desc: 'Soft warm overlay that blends fabric grains elegantly',
    filters: {
      blendMode: 'overlay',
      opacity: 80,
      brightness: 100,
      contrast: 110,
      saturation: 120,
      hueRotate: 30,
      invert: 0,
      grayscale: 0,
      sepia: 30
    }
  },
  {
    id: 'chalk',
    name: 'Chalk Outline',
    desc: 'Dark canvas backdrop with bright chalk sewing guidelines',
    filters: {
      blendMode: 'color-burn',
      opacity: 90,
      brightness: 90,
      contrast: 140,
      saturation: 10,
      hueRotate: 0,
      invert: 90,
      grayscale: 90,
      sepia: 10
    }
  },
  {
    id: 'photomontage',
    name: 'Finished Garment',
    desc: 'Standard composition to visualize realistic texture matches',
    filters: {
      blendMode: 'normal',
      opacity: 75,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hueRotate: 0,
      invert: 0,
      grayscale: 0,
      sepia: 0
    }
  }
];

export default function ArOverlayVisualizer() {
  const [userPhoto, setUserPhoto] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODEL_PRESETS[0]);
  const [selectedBlueprint, setSelectedBlueprint] = useState(OVERLAY_BLUEPRINTS[0]);

  // Alignment & composition state
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [scale, setScale] = useState(100);
  const [rotation, setRotation] = useState(0);

  // CSS Filters state
  const [blendMode, setBlendMode] = useState('overlay');
  const [opacity, setOpacity] = useState(70);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(110);
  const [saturation, setSaturation] = useState(100);
  const [hueRotate, setHueRotate] = useState(0);
  const [invert, setInvert] = useState(0);
  const [grayscale, setGrayscale] = useState(0);
  const [sepia, setSepia] = useState(0);

  // UI Helpers
  const [activeTab, setActiveTab] = useState('templates'); // 'templates' | 'filters' | 'presets'
  const [showOverlayOnly, setShowOverlayOnly] = useState(false);
  const [isGuidelineModalOpen, setIsGuidelineModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Apply a style preset
  const applyPreset = (preset) => {
    const f = preset.filters;
    setBlendMode(f.blendMode);
    setOpacity(f.opacity);
    setBrightness(f.brightness);
    setContrast(f.contrast);
    setSaturation(f.saturation);
    setHueRotate(f.hueRotate);
    setInvert(f.invert);
    setGrayscale(f.grayscale);
    setSepia(f.sepia);

    if (window.showToast) {
      window.showToast(`Applied preset composition: "${preset.name}".`, 'success', 'AR Composition Ready');
    }
  };

  // Reset alignment params
  const resetAlignment = () => {
    setPosX(0);
    setPosY(0);
    setScale(100);
    setRotation(0);
    if (window.showToast) {
      window.showToast('Reset alignment and scale coordinates.', 'info');
    }
  };

  // Reset filters params
  const resetFilters = () => {
    setBlendMode('overlay');
    setOpacity(70);
    setBrightness(100);
    setContrast(110);
    setSaturation(100);
    setHueRotate(0);
    setInvert(0);
    setGrayscale(0);
    setSepia(0);
    if (window.showToast) {
      window.showToast('Reset photographic filters and blend modes.', 'info');
    }
  };

  // File upload handling
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setUserPhoto({ file, url });
        if (window.showToast) {
          window.showToast(`Successfully imported custom try-on photo "${file.name}".`, 'success', 'User Photo Loaded');
        }
      } else {
        if (window.showToast) {
          window.showToast('Unsupported file format. Please upload an image.', 'error');
        }
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setUserPhoto({ file, url });
        if (window.showToast) {
          window.showToast(`Successfully imported custom try-on photo "${file.name}".`, 'success', 'User Photo Loaded');
        }
      }
    }
  };

  const clearUserPhoto = () => {
    setUserPhoto(null);
    if (window.showToast) {
      window.showToast('Cleared custom photo. Reverting to studio model presets.', 'info');
    }
  };

  // Construct current CSS filters string for overlay
  const getFilterString = () => {
    return `
      brightness(${brightness}%)
      contrast(${contrast}%)
      saturate(${saturation}%)
      hue-rotate(${hueRotate}deg)
      invert(${invert}%)
      grayscale(${grayscale}%)
      sepia(${sepia}%)
    `.replace(/\s+/g, ' ').trim();
  };

  // Background active image URL
  const activeBackgroundUrl = userPhoto ? userPhoto.url : selectedModel.image;

  // Simulate saving or exporting
  const handleSaveComposition = () => {
    if (window.showToast) {
      window.showToast(
        `Composition metadata saved. Successfully generated AR fitting template for size analysis.`,
        'success',
        'Fitting Template Locked'
      );
    }
  };

  return (
    <div className="bg-white border border-sand-200/80 rounded-[4px] p-5 lg:p-7 space-y-6 shadow-3xs" id="ar-overlay-visualizer-main">

      {/* Header and Intro */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-sand-200/60 pb-5" id="ar-header">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-clay-550 uppercase tracking-[0.2em] bg-clay-50 border border-clay-100 px-2 py-0.5 rounded-[4px]">
              Virtual fitting room
            </span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <h3 className="text-xl font-serif font-bold text-bark-950 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-clay-605" /> AR-Inspired Overlay Fitting Studio
          </h3>
          <p className="text-xs text-bark-600 max-w-2xl leading-relaxed">
            Compose and align atelier sewing outlines, patterns, or garment blueprints directly onto your physical photo or studio mannequins. Fine-tune material fits and visual grains with detailed CSS filters and blend modes.
          </p>
        </div>
        <button
          onClick={() => setIsGuidelineModalOpen(true)}
          className="bg-sand-50 hover:bg-sand-100 border border-sand-250 text-bark-800 text-[10.5px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-[4px] cursor-pointer transition-colors shrink-0 flex items-center gap-1.5 font-mono shadow-3xs"
          id="ar-help-btn"
        >
          <HelpCircle className="w-3.5 h-3.5 text-clay-500" /> Overlay Guidelines
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start" id="ar-main-layout">

        {/* Left Side: Dynamic Canvas Workspace (5 Cols) */}
        <div className="xl:col-span-6 flex flex-col space-y-4" id="ar-preview-column">
          <div className="flex justify-between items-center bg-sand-50/60 p-2.5 rounded-[4px] border border-sand-200/80">
            <span className="text-[10px] font-mono text-bark-500 font-bold uppercase tracking-wider">
              Composition Canvas Stage
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowOverlayOnly(!showOverlayOnly)}
                className={`text-[9.5px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-[4px] border cursor-pointer transition-all flex items-center gap-1.5 shadow-3xs ${
                  showOverlayOnly
                    ? 'bg-clay-600 border-clay-700 text-white'
                    : 'bg-white border-sand-250 text-bark-800 hover:bg-sand-50'
                }`}
                title="Isolate blueprint outline only"
              >
                {showOverlayOnly ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showOverlayOnly ? 'Blueprint Isolated' : 'Isolate Blueprint'}
              </button>
              <button
                onClick={resetAlignment}
                className="bg-white hover:bg-sand-50 border border-sand-250 text-bark-800 text-[9.5px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-[4px] cursor-pointer transition-all flex items-center gap-1 shadow-3xs"
                title="Reset coordinates"
              >
                <RotateCcw className="w-3 h-3 text-bark-500" /> Reset
              </button>
            </div>
          </div>

          {/* Interactive Composition Window */}
          <div
            className="relative bg-bark-950 aspect-[4/5] rounded-md overflow-hidden border border-bark-900 shadow-xl flex items-center justify-center select-none"
            id="composition-stage-window"
          >
            {/* Background Layer: Preset or Custom User Photo */}
            <img
              src={activeBackgroundUrl}
              alt="Fitting Backdrop"
              className={`w-full h-full object-cover transition-all duration-300 ${
                showOverlayOnly ? 'opacity-0 blur-md pointer-events-none' : 'opacity-100 blur-0'
              }`}
              referrerPolicy="no-referrer"
              id="ar-background-layer"
            />

            {/* Ambient Lighting depth overlay */}
            {!showOverlayOnly && (
              <div className="absolute inset-0 bg-gradient-to-t from-bark-950/40 via-transparent to-transparent pointer-events-none z-5" />
            )}

            {/* Pattern/Garment Overlay Layer (CSS Filters, Blend Modes, Position applied in real-time) */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10"
              style={{
                mixBlendMode: blendMode,
                opacity: opacity / 100
              }}
            >
              <motion.img
                src={selectedBlueprint.blueprintOutline}
                alt={selectedBlueprint.name}
                className="max-w-[75%] max-h-[75%] object-contain pointer-events-none select-none"
                referrerPolicy="no-referrer"
                id="ar-overlay-layer"
                style={{
                  filter: getFilterString(),
                  transform: `translate(${posX}px, ${posY}px) scale(${scale / 100}) rotate(${rotation}deg)`
                }}
              />
            </div>

            {/* Technical grid lines overlay to aid visualization */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-12" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

            {/* Grid Coordinates status watermark */}
            <div className="absolute bottom-3 left-4 z-15 font-mono text-[9px] text-white/50 bg-bark-950/70 px-2 py-1 rounded-[4px] border border-bark-800/50 flex gap-3">
              <span>X: {posX}px</span>
              <span>Y: {posY}px</span>
              <span>S: {scale}%</span>
              <span>R: {rotation}°</span>
            </div>

            {/* Quick calibration tag */}
            <div className="absolute top-3 left-4 z-15 font-mono text-[8px] tracking-widest uppercase font-bold text-clay-400 bg-bark-950/80 px-2 py-1 rounded-[3px] border border-bark-800/60">
              {selectedBlueprint.name} Silhouette
            </div>

            {/* Overlay toggle state reminder */}
            {showOverlayOnly && (
              <div className="absolute top-3 right-4 z-15 font-mono text-[8px] tracking-widest uppercase font-bold text-white bg-clay-700 px-2.5 py-1 rounded-[3px] shadow-sm">
                Blueprint Isolated
              </div>
            )}
          </div>

          {/* Quick Stats of composition */}
          <div className="bg-sand-50/50 p-4 border border-sand-200/80 rounded-[4px] flex flex-col sm:flex-row justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Shirt className="w-4 h-4 text-clay-600 shrink-0" />
              <div>
                <span className="font-serif font-bold text-bark-950 block">{selectedBlueprint.name}</span>
                <span className="text-[10px] text-bark-500 font-mono">Composition: {blendMode.toUpperCase()} Blend Mode</span>
              </div>
            </div>
            <button
              onClick={handleSaveComposition}
              className="bg-bark-900 hover:bg-bark-800 text-white text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-2 rounded-[4px] cursor-pointer transition-colors shrink-0 shadow-2xs flex items-center justify-center gap-1.5"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-clay-400" /> Capture &amp; Lock Fit
            </button>
          </div>
        </div>

        {/* Right Side: Design Control Panel (7 Cols) */}
        <div className="xl:col-span-6 space-y-5" id="ar-control-column">

          {/* Step 1: Upload and Preset Background Selector */}
          <div className="bg-[#FAF8F5] border border-sand-200/80 p-5 rounded-[4px] space-y-4">
            <span className="text-[10.5px] font-mono font-black text-clay-700 tracking-widest uppercase block border-b border-sand-200/60 pb-1.5">
              1. Choose Fitting Photo Backdrop
            </span>

            {/* Drag and drop zone with manual file fallback */}
            {!userPhoto ? (
              <div
                className={`border border-dashed rounded-[4px] p-5 text-center transition-all cursor-pointer select-none space-y-2.5 ${
                  dragActive
                    ? 'bg-clay-50/60 border-clay-550'
                    : 'bg-white border-sand-300 hover:border-clay-400'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <UploadCloud className="w-8 h-8 text-bark-300 mx-auto" />
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-bark-900 font-serif">
                    Drag and drop your own fitting photo
                  </h5>
                  <p className="text-[10px] text-bark-500 leading-normal max-w-sm mx-auto font-sans font-medium">
                    Upload a high-quality standing pose, selfie, or fabric background. Supports PNG, JPG (Max 5MB).
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-sand-250 p-3 rounded-[4px] flex items-center justify-between shadow-3xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-12 bg-sand-50 rounded-[4px] overflow-hidden border border-sand-200">
                    <img src={userPhoto.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <span className="text-[11px] font-serif font-semibold text-bark-950 block truncate max-w-[200px]">
                      {userPhoto.file.name}
                    </span>
                    <span className="text-[9px] font-mono text-bark-400 font-bold uppercase">
                      {(userPhoto.file.size / 1024 / 1024).toFixed(2)} MB • Custom
                    </span>
                  </div>
                </div>
                <button
                  onClick={clearUserPhoto}
                  className="p-1.5 rounded-[4px] text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 cursor-pointer transition-colors"
                  title="Remove uploaded photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Model templates quick selector */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono font-bold text-bark-400 uppercase tracking-wider">
                <span>Or use standard studio backdrop:</span>
                {userPhoto && <span className="text-clay-605">Custom Photo Active</span>}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {MODEL_PRESETS.map((model) => {
                  const isActive = !userPhoto && selectedModel.id === model.id;
                  return (
                    <button
                      key={model.id}
                      onClick={() => {
                        setUserPhoto(null);
                        setSelectedModel(model);
                        if (window.showToast) {
                          window.showToast(`Switched backdrop to: "${model.name}".`, 'info');
                        }
                      }}
                      className={`group p-2 rounded-[4px] border text-left cursor-pointer transition-all flex flex-col gap-1.5 shadow-3xs ${
                        isActive
                          ? 'bg-clay-50/50 border-clay-550 ring-1 ring-clay-400'
                          : 'bg-white border-sand-200 hover:border-sand-300'
                      }`}
                    >
                      <div className="w-full aspect-[4/3] rounded-[3px] bg-sand-50 overflow-hidden border border-sand-150 relative">
                        <img src={model.image} className="w-full h-full object-cover transition-transform group-hover:scale-105" referrerPolicy="no-referrer" />
                        {isActive && (
                          <div className="absolute inset-0 bg-clay-950/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white drop-shadow-md" />
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] font-serif font-black text-bark-900 leading-tight block truncate w-full">
                        {model.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step 2: Overlay Blueprint Selector */}
          <div className="bg-[#FAF8F5] border border-sand-200/80 p-5 rounded-[4px] space-y-3.5">
            <span className="text-[10.5px] font-mono font-black text-clay-700 tracking-widest uppercase block border-b border-sand-200/60 pb-1.5">
              2. Select Atelier Pattern Silhouette
            </span>

            <div className="grid grid-cols-2 gap-3">
              {OVERLAY_BLUEPRINTS.map((bp) => {
                const isActive = selectedBlueprint.id === bp.id;
                return (
                  <button
                    key={bp.id}
                    onClick={() => {
                      setSelectedBlueprint(bp);
                      if (window.showToast) {
                        window.showToast(`Switched active overlay pattern to: "${bp.name}".`, 'success', 'Pattern Selected');
                      }
                    }}
                    className={`p-3 rounded-[4px] border text-left cursor-pointer transition-all flex gap-3 shadow-3xs ${
                      isActive
                        ? 'bg-clay-50/50 border-clay-550 ring-1 ring-clay-400'
                        : 'bg-white border-sand-200 hover:border-sand-300'
                    }`}
                  >
                    <div className="w-10 h-12 rounded-[4px] overflow-hidden border border-sand-200 shrink-0 relative bg-sand-50">
                      <img src={bp.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      {isActive && (
                        <div className="absolute inset-0 bg-clay-950/10 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white drop-shadow-md" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      <span className="text-[8px] font-mono font-bold text-clay-650 tracking-wider uppercase block leading-none">
                        {bp.type}
                      </span>
                      <h5 className="text-[11px] font-serif font-bold text-bark-900 leading-tight block truncate">
                        {bp.name}
                      </h5>
                      <p className="text-[9.5px] text-bark-500 truncate leading-none font-sans">
                        {bp.tagline}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Tab Panel for Positioning and Composition Controls */}
          <div className="border border-sand-200/85 rounded-[4px] overflow-hidden bg-white shadow-3xs" id="ar-controls-tabs">

            {/* Tabs Trigger */}
            <div className="flex border-b border-sand-200 bg-sand-50/40 font-mono text-[10.5px] font-bold uppercase tracking-widest">
              <button
                onClick={() => setActiveTab('templates')}
                className={`flex-1 py-3 border-r border-sand-200 cursor-pointer transition-colors text-center ${
                  activeTab === 'templates'
                    ? 'bg-white text-clay-700 border-b-2 border-b-clay-550 font-black'
                    : 'text-bark-500 hover:text-bark-850 hover:bg-sand-50/60'
                }`}
              >
                <Sliders className="w-3 h-3 inline mr-1 text-clay-550" /> Alignment
              </button>
              <button
                onClick={() => setActiveTab('filters')}
                className={`flex-1 py-3 border-r border-sand-200 cursor-pointer transition-colors text-center ${
                  activeTab === 'filters'
                    ? 'bg-white text-clay-700 border-b-2 border-b-clay-550 font-black'
                    : 'text-bark-500 hover:text-bark-850 hover:bg-sand-50/60'
                }`}
              >
                <Layers className="w-3 h-3 inline mr-1 text-clay-550" /> Photographic Filters
              </button>
              <button
                onClick={() => setActiveTab('presets')}
                className={`flex-1 py-3 cursor-pointer transition-colors text-center ${
                  activeTab === 'presets'
                    ? 'bg-white text-clay-700 border-b-2 border-b-clay-550 font-black'
                    : 'text-bark-500 hover:text-bark-850 hover:bg-sand-50/60'
                }`}
              >
                <Sparkles className="w-3 h-3 inline mr-1 text-clay-550" /> Style Presets
              </button>
            </div>

            {/* Tab 1: Alignment Controls */}
            {activeTab === 'templates' && (
              <div className="p-5 space-y-4 font-sans animate-fade-in">
                <div className="flex justify-between items-center text-[10px] font-mono text-bark-400 uppercase tracking-wider">
                  <span>Draft Placement Controls</span>
                  <button onClick={resetAlignment} className="text-clay-650 hover:underline">Reset Alignment</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-xs text-bark-750">
                  {/* Translate X */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Horizontal Shift (X)</span>
                      <span className="font-mono font-bold">{posX}px</span>
                    </div>
                    <input
                      type="range"
                      min="-200"
                      max="200"
                      value={posX}
                      onChange={(e) => setPosX(parseInt(e.target.value))}
                      className="w-full h-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-clay-550"
                    />
                  </div>

                  {/* Translate Y */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Vertical Shift (Y)</span>
                      <span className="font-mono font-bold">{posY}px</span>
                    </div>
                    <input
                      type="range"
                      min="-200"
                      max="200"
                      value={posY}
                      onChange={(e) => setPosY(parseInt(e.target.value))}
                      className="w-full h-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-clay-550"
                    />
                  </div>

                  {/* Scale size */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Blueprint Scale</span>
                      <span className="font-mono font-bold">{scale}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setScale(prev => Math.max(20, prev - 5))} className="p-1 border border-sand-250 rounded hover:bg-sand-50 cursor-pointer"><ZoomOut className="w-3.5 h-3.5" /></button>
                      <input
                        type="range"
                        min="20"
                        max="300"
                        value={scale}
                        onChange={(e) => setScale(parseInt(e.target.value))}
                        className="w-full h-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-clay-550"
                      />
                      <button onClick={() => setScale(prev => Math.min(300, prev + 5))} className="p-1 border border-sand-250 rounded hover:bg-sand-50 cursor-pointer"><ZoomIn className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>

                  {/* Rotation Angle */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Rotation Angle</span>
                      <span className="font-mono font-bold">{rotation}°</span>
                    </div>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={rotation}
                      onChange={(e) => setRotation(parseInt(e.target.value))}
                      className="w-full h-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-clay-550"
                    />
                  </div>
                </div>

                {/* Practical Tip */}
                <div className="border-l-2 border-clay-550 bg-clay-50/20 p-3 rounded-r-[4px] text-[11px] text-bark-650 leading-relaxed font-sans font-medium">
                  <strong>Pro-Tip:</strong> Set scale and horizontal offsets first. Drag the sliders slowly to map the shoulders of the pattern silhouette directly over the mannequin or your custom photo's alignment lines.
                </div>
              </div>
            )}

            {/* Tab 2: Photographic Filters & Blend Modes */}
            {activeTab === 'filters' && (
              <div className="p-5 space-y-5 animate-fade-in font-sans">
                <div className="flex justify-between items-center text-[10px] font-mono text-bark-400 uppercase tracking-wider">
                  <span>Fine-Tuning CSS Filters</span>
                  <button onClick={resetFilters} className="text-clay-650 hover:underline">Reset Filters</button>
                </div>

                {/* Blend Mode Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-serif font-black text-bark-900 block">
                    Active CSS Blend Mode
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 text-[10.5px] font-mono">
                    {['overlay', 'screen', 'multiply', 'difference', 'color-burn', 'darken', 'normal'].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setBlendMode(mode)}
                        className={`py-1.5 border rounded cursor-pointer transition-colors text-center ${
                          blendMode === mode
                            ? 'bg-clay-650 border-clay-700 text-white font-black'
                            : 'bg-white border-sand-200 hover:border-sand-350 text-bark-800'
                        }`}
                      >
                        {mode.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filters grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-xs text-bark-750">
                  {/* Opacity */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Blueprint Opacity</span>
                      <span className="font-mono font-bold">{opacity}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={opacity}
                      onChange={(e) => setOpacity(parseInt(e.target.value))}
                      className="w-full h-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-clay-550"
                    />
                  </div>

                  {/* Brightness */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Brightness Contrast</span>
                      <span className="font-mono font-bold">{brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={brightness}
                      onChange={(e) => setBrightness(parseInt(e.target.value))}
                      className="w-full h-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-clay-550"
                    />
                  </div>

                  {/* Contrast */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Outlines Contrast</span>
                      <span className="font-mono font-bold">{contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={contrast}
                      onChange={(e) => setContrast(parseInt(e.target.value))}
                      className="w-full h-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-clay-550"
                    />
                  </div>

                  {/* Saturation */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Color Saturation</span>
                      <span className="font-mono font-bold">{saturation}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={saturation}
                      onChange={(e) => setSaturation(parseInt(e.target.value))}
                      className="w-full h-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-clay-550"
                    />
                  </div>

                  {/* Hue Rotate */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Fabric Hue Shifting</span>
                      <span className="font-mono font-bold">{hueRotate}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={hueRotate}
                      onChange={(e) => setHueRotate(parseInt(e.target.value))}
                      className="w-full h-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-clay-550"
                    />
                  </div>

                  {/* Invert */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Invert Color Curve</span>
                      <span className="font-mono font-bold">{invert}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={invert}
                      onChange={(e) => setInvert(parseInt(e.target.value))}
                      className="w-full h-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-clay-550"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Style Presets */}
            {activeTab === 'presets' && (
              <div className="p-5 space-y-3.5 animate-fade-in font-sans">
                <span className="text-[10px] font-mono text-bark-400 uppercase tracking-wider block">
                  Click to Instant composition template:
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset)}
                      className="p-3 border border-sand-200 bg-sand-50/25 rounded-[4px] hover:bg-clay-50/20 hover:border-clay-300 text-left cursor-pointer transition-all flex flex-col gap-1 shadow-3xs"
                    >
                      <span className="text-xs font-serif font-black text-bark-950 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-clay-650" /> {preset.name}
                      </span>
                      <p className="text-[10.5px] text-bark-550 leading-tight">
                        {preset.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* Guidelines Modal dialog */}
      <AnimatePresence>
        {isGuidelineModalOpen && (
          <div className="fixed inset-0 z-150 flex items-center justify-center p-4 bg-bark-950/80 backdrop-blur-xs" id="ar-guideline-modal">
            {/* Backdrop Dismiss */}
            <div className="absolute inset-0 cursor-pointer" onClick={() => setIsGuidelineModalOpen(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white border border-sand-250 rounded-lg max-w-lg w-full p-6 shadow-2xl overflow-hidden z-160 text-bark-900"
            >
              <div className="flex justify-between items-start border-b border-sand-200 pb-3 mb-4">
                <h4 className="text-base font-serif font-bold text-bark-950 flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-clay-605" /> Perfect Fit AR Overlay Instructions
                </h4>
                <button
                  onClick={() => setIsGuidelineModalOpen(false)}
                  className="p-1 rounded-full hover:bg-sand-100 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4 text-bark-600" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-bark-700 leading-relaxed font-sans">
                <div className="space-y-1.5">
                  <strong className="text-bark-900 font-serif font-black uppercase text-[10px] tracking-wide block">How the Overlay Engine Works:</strong>
                  <p>
                    This module utilizes client-side hardware-accelerated CSS composition layers. By combining multiple alpha channels and blending filters together, dressmakers can test garment silhouettes directly on top of real fitting photographs without requiring heavy server computing.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <strong className="text-bark-900 font-serif font-black uppercase text-[10px] tracking-wide block">Recommended Photo Layout:</strong>
                  <ul className="list-disc list-inside space-y-1 pl-1 text-bark-650">
                    <li>Stand against a solid, neutral-colored background.</li>
                    <li>Avoid heavy, loose clothing to ensure the silhouette lines match your true body curvature.</li>
                    <li>Ensure high-key, even lighting from the front so the shadows blend perfectly.</li>
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <strong className="text-bark-900 font-serif font-black uppercase text-[10px] tracking-wide block">Troubleshooting Composition Scales:</strong>
                  <p>
                    If the blueprint appears too small or rotated incorrectly, use the **Alignment Tab** to scale the layer between 20% and 300%. Setting the Blend Mode to **"Difference"** or **"Screen"** is highly recommended to inspect fabric grain alignments.
                  </p>
                </div>
              </div>

              <div className="border-t border-sand-200 pt-4 mt-5 flex justify-end">
                <button
                  onClick={() => setIsGuidelineModalOpen(false)}
                  className="bg-bark-900 hover:bg-bark-800 text-white text-[10.5px] font-mono font-bold uppercase tracking-wider px-4 py-2 rounded-[4px] cursor-pointer transition-colors"
                >
                  Understood, Let's Fit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
