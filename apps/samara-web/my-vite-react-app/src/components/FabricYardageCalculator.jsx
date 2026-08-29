import { localizeMetadataTree } from '../lib/localizedMetadata';
import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { runtimeDataStorage } from '../lib/runtimeDataGateway';
import React, { useState, useMemo, useEffect } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  Scissors, Ruler, Info, RefreshCw, Sparkles, Check,
  ChevronRight, HelpCircle, Layers, Maximize2, Search, ArrowRight, Tag,
  Sliders, X, ClipboardCopy, Pin, Minimize2, ChevronLeft
} from 'lucide-react';
import {
  getPreferredSizeReference,
  normalizeMeasurementChartValues
} from '../lib/measurementChart';
import { UI_LAYERS } from '../lib/uiLayers';

export default function FabricYardageCalculator({
  selectedSize = '8',
  onApplyYardage,
  patterns = [],
  activePatternOverride = null,
  measurementChart = null,
  selectedCanonicalSizeId = '',
  contextLabel = ''
}) {
  const FABRIC_WIDTH_PRESETS = localizeMetadataTree(perfectFitMetadata.componentUi.fabricYardage.fabricWidthPresets, 'component.fabricYardage.fabricWidthPresets', pfUiT);

  const [selectedPatternId, setSelectedPatternId] = useState('sartorial-01');
  const [fabricWidth, setFabricWidth] = useState(44); // Inches
  const [customWidthEnabled, setCustomWidthEnabled] = useState(false);
  const [customWidth, setCustomWidth] = useState(44);
  const [patternRepeat, setPatternRepeat] = useState('none'); // 'none' | 'nap' | 'plaid'
  const [layoutComplexity, setLayoutComplexity] = useState('standard'); // 'simple' | 'standard' | 'complex'
  const [hasLining, setHasLining] = useState(false);
  const [hasInterfacing, setHasInterfacing] = useState(true);
  const [customUnit, setCustomUnit] = useState('yards'); // 'yards' | 'meters'
  const [localSize, setLocalSize] = useState(selectedSize);
  const [searchTerm, setSearchTerm] = useState('');
  const [stash, setStash] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Floating slide-out sidebar panel
  const normalizedMeasurementChart = useMemo(
    () => measurementChart ? normalizeMeasurementChartValues(measurementChart) : null,
    [measurementChart]
  );
  const canonicalSizes = normalizedMeasurementChart?.sizes || [];
  const [localCanonicalSizeId, setLocalCanonicalSizeId] = useState(selectedCanonicalSizeId || canonicalSizes[0]?.id || '');

  // Load fabric stash from localStorage
  useEffect(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_atelier_fabric_stash');
      if (saved) {
        setStash(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // Keep local size in sync with prop updates
  useEffect(() => {
    setLocalSize(selectedSize);
  }, [selectedSize]);

  useEffect(() => {
    setLocalCanonicalSizeId(selectedCanonicalSizeId || canonicalSizes[0]?.id || '');
  }, [canonicalSizes, selectedCanonicalSizeId]);

  // Find currently active pattern
  const activePattern = useMemo(() => {
    return activePatternOverride || patterns.find(p => p.id === selectedPatternId) || patterns[0] || null;
  }, [activePatternOverride, patterns, selectedPatternId]);

  // Sync lining state based on whether active pattern usually includes a lining requirement
  useEffect(() => {
    if (activePattern && activePattern.yardageInfo && activePattern.yardageInfo.lining) {
      setHasLining(true);
    } else {
      setHasLining(false);
    }
  }, [activePattern, selectedPatternId]);

  // Filter patterns for searchable dropdown
  const filteredPatterns = useMemo(() => {
    if (activePatternOverride) return [activePatternOverride];
    if (!searchTerm.trim()) return patterns.slice(0, 12);
    return patterns.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 12);
  }, [activePatternOverride, patterns, searchTerm]);

  const activeCanonicalSize = canonicalSizes.find((size) => size.id === localCanonicalSizeId) || canonicalSizes[0] || null;
  const activeCanonicalSizeLabel = activeCanonicalSize
    ? getPreferredSizeReference(activeCanonicalSize, normalizedMeasurementChart?.displaySystem)
    : '';
  const deriveNumericReferenceSize = () => {
    if (!activeCanonicalSize) {
      return parseInt(localSize) || 8;
    }

    const refs = activeCanonicalSize.refs || {};
    const candidates = [
      refs.US,
      refs.UK,
      refs.EU,
      refs.FR,
      refs.ALPHA,
      activeCanonicalSize.label
    ];

    for (const candidate of candidates) {
      const parsed = parseInt(String(candidate || '').replace(/[^0-9-]/g, ''), 10);
      if (Number.isFinite(parsed)) {
        if (candidate === refs.UK) return Math.max(0, parsed - 4);
        if (candidate === refs.EU || candidate === refs.FR) return Math.max(0, parsed - 26);
        return parsed;
      }
    }

    const alpha = String(refs.ALPHA || activeCanonicalSize.label || '').toUpperCase();
    const alphaMap = { XXS: 0, XS: 2, S: 4, M: 8, L: 12, XL: 16, XXL: 20 };
    return alphaMap[alpha] || 8;
  };

  const sizeNum = deriveNumericReferenceSize();
  const currentWidth = customWidthEnabled ? customWidth : fabricWidth;

  // Helper to parse strings like "3.8 Yards" to 3.8
  const parseYardageString = (str) => {
    if (!str) return 0;
    const cleaned = str.replace(/[^0-9.]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  };

  // Perform dynamic yardage calculation based on specific pattern yardageInfo, bolt width, and complexity
  const calculations = useMemo(() => {
    if (!activePattern) return null;

    // Get the base measurements for standard 44" and 60" widths from pattern database
    const y44Str = activePattern.yardageInfo?.width44 || '3.5 Yards';
    const y60Str = activePattern.yardageInfo?.width60 || '2.5 Yards';

    const base44 = parseYardageString(y44Str);
    const base60 = parseYardageString(y60Str);

    let interpolatedBase = base44;

    // Perform high-precision interpolation or extrapolation based on custom width
    if (currentWidth <= 44) {
      // For very narrow fabrics, efficiency decreases. Apply a standard layout penalty
      const ratio = 44 / currentWidth;
      const efficiencyPenalty = currentWidth < 36 ? 1.18 : (currentWidth < 44 ? 1.08 : 1.0);
      interpolatedBase = base44 * ratio * efficiencyPenalty;
    } else if (currentWidth >= 60) {
      // For extra wide fabrics, clamp the maximum scaling to maintain realism
      const ratio = 60 / currentWidth;
      interpolatedBase = base60 * Math.max(0.78, ratio);
    } else {
      // Linear interpolation between the known points at 44" and 60"
      const t = (currentWidth - 44) / (60 - 44);
      interpolatedBase = base44 + t * (base60 - base44);
    }

    // Adjust for size grading (reference size is 8)
    const sizeDiff = sizeNum - 8;
    // Standard professional sizing grade scales yardage by ~3.5% per size step
    const sizeFactor = 1.0 + (sizeDiff * 0.035);
    let sizeAdjusted = interpolatedBase * Math.max(0.65, sizeFactor);

    // Adjust for fabric print repeats or Nap directions (one-way layouts)
    let patternMultiplier = 1.0;
    if (patternRepeat === 'nap') {
      patternMultiplier = 1.12; // Directional nap requires +12% more fabric
    } else if (patternRepeat === 'plaid') {
      patternMultiplier = 1.22; // Matching plaid/stripes along seamlines requires +22% more fabric
    }

    // Adjust for layout complexity
    let complexityMultiplier = 1.0;
    if (layoutComplexity === 'simple') {
      complexityMultiplier = 0.92; // Simple, efficient cuts save 8%
    } else if (layoutComplexity === 'complex') {
      complexityMultiplier = 1.18; // Complex/couture layouts add 18% buffer for deep pleats/bias drapes
    }

    let finalShellYardage = sizeAdjusted * patternMultiplier * complexityMultiplier;

    // Estimate Lining requirements
    let liningEst = 0;
    if (hasLining) {
      if (activePattern.yardageInfo?.lining) {
        liningEst = parseYardageString(activePattern.yardageInfo.lining);
      } else {
        // Fallback lining estimation based on category if not explicitly defined
        const cat = activePattern.category?.toLowerCase() || '';
        if (cat.includes('outerwear') || cat.includes('jacket') || cat.includes('trench')) liningEst = 3.0;
        else if (cat.includes('dress') || cat.includes('gown')) liningEst = 2.4;
        else if (cat.includes('trouser') || cat.includes('pant')) liningEst = 0.5; // partial lining/pockets
        else if (cat.includes('skirt')) liningEst = 0.8;
        else liningEst = 1.2;
      }

      // Adjust lining yardage for sizing grade
      liningEst = liningEst * Math.max(0.7, 1.0 + (sizeDiff * 0.025));
      // Adjust lining based on standard lining width (typically 54") relative to active width
      liningEst = liningEst * (54 / currentWidth) * (currentWidth < 45 ? 1.08 : 1.0);
    }

    // Estimate Fusible Interfacing requirements
    let interfacingEst = 0;
    if (hasInterfacing) {
      // Try to parse from notions or fall back to template complexity
      const notionsStr = (activePattern.notions || []).join(' ');
      const matchedInterfacing = notionsStr.match(/([0-9.]+)\s*yard/i);

      if (matchedInterfacing) {
        interfacingEst = parseFloat(matchedInterfacing[1]);
      } else {
        const difficulty = activePattern.difficulty?.toLowerCase() || 'intermediate';
        if (difficulty === 'advanced') interfacingEst = 1.5;
        else if (difficulty === 'intermediate') interfacingEst = 0.8;
        else interfacingEst = 0.4;
      }
    }

    // Rounding utility to the nearest 1/8th yard (0.125) for tailoring authenticity
    const roundToEighths = (val) => {
      return Math.max(0.25, Math.ceil(val * 8) / 8);
    };

    const finalYards = roundToEighths(finalShellYardage);
    const finalLiningYards = roundToEighths(liningEst);
    const finalInterfacingYards = roundToEighths(interfacingEst);

    // Meters conversion helper
    const yardsToMeters = (y) => y * 0.9144;
    const finalMeters = parseFloat(yardsToMeters(finalYards).toFixed(2));
    const finalLiningMeters = parseFloat(yardsToMeters(finalLiningYards).toFixed(2));
    const finalInterfacingMeters = parseFloat(yardsToMeters(finalInterfacingYards).toFixed(2));

    // Dynamic efficiency rating based on width, layout, and repeats
    let baseEfficiency = (currentWidth / 60) * 100;
    if (patternRepeat === 'nap') baseEfficiency -= 8;
    if (patternRepeat === 'plaid') baseEfficiency -= 14;
    if (layoutComplexity === 'complex') baseEfficiency -= 12;
    if (layoutComplexity === 'simple') baseEfficiency += 6;
    const efficiency = Math.round(Math.min(98, Math.max(45, baseEfficiency)));

    return {
      mainYards: finalYards,
      mainMeters: finalMeters,
      liningYards: finalLiningYards,
      liningMeters: finalLiningMeters,
      interfacingYards: finalInterfacingYards,
      interfacingMeters: finalInterfacingMeters,
      efficiencyScore: efficiency
    };
  }, [activePattern, currentWidth, sizeNum, patternRepeat, hasLining, hasInterfacing, layoutComplexity]);

  // Copy specs to clipboard
  const handleCopySpecs = () => {
    const text = `PERFECT FIT BUREAU YARDAGE SPEC SHEET
========================================
Design Pattern:     ${activePattern.name}
Workspace Context:  ${contextLabel || 'Standalone'}
Active Size:        ${activeCanonicalSizeLabel ? `${activeCanonicalSizeLabel} (${activeCanonicalSize.id})` : `Size ${localSize}`}
Heuristic Size Ref: Size ${sizeNum}
Selected Width:     ${currentWidth}" (${Math.round(currentWidth * 2.54)}cm)
Layout Complexity:  ${layoutComplexity.toUpperCase()}
Print Repeat:       ${patternRepeat.toUpperCase()}

ESTIMATED FABRIC REQUIREMENT:
----------------------------------------
• Main Shell Fabric:  ${customUnit === 'yards' ? `${calculations?.mainYards} yds` : `${calculations?.mainMeters} m`}
• Lining backing:     ${hasLining ? (customUnit === 'yards' ? `${calculations?.liningYards} yds` : `${calculations?.liningMeters} m`) : 'Not requested'}
• Fusible Canvas:     ${hasInterfacing ? (customUnit === 'yards' ? `${calculations?.interfacingYards} yds` : `${calculations?.interfacingMeters} m`) : 'Not requested'}

Estimated Layout Efficiency Score: ${calculations?.efficiencyScore}%`;

    navigator.clipboard.writeText(text);
    if (window.showToast) {
      window.showToast("Atelier yardage specifications copied successfully!", "success", "Copied to Clipboard");
    } else {
      alert("Atelier yardage specifications copied successfully!");
    }
  };

  // Generate pattern-specific cutting piece visualization blocks
  const cuttingPieces = useMemo(() => {
    if (!activePattern) return [];

    const id = activePattern.id;
    if (id === 'sartorial-01') {
      return [
        { name: 'Front Bodice', count: 'x2', wClass: 'w-[20%]', hClass: 'h-[80%]', color: 'border-clay-300 bg-clay-50/40 text-clay-800' },
        { name: 'Back Bodice', count: 'x1 Fold', wClass: 'w-[18%]', hClass: 'h-[80%]', color: 'border-clay-400 bg-clay-100/30 text-clay-800' },
        { name: 'Skirt Front', count: 'x2', wClass: 'w-[28%]', hClass: 'h-[90%]', color: 'border-amber-300 bg-amber-50/30 text-amber-950' },
        { name: 'Skirt Back', count: 'x1 Fold', wClass: 'w-[24%]', hClass: 'h-[90%]', color: 'border-amber-400 bg-amber-100/20 text-amber-950' },
        { name: 'Sleeves', count: 'x2', wClass: 'w-[14%]', hClass: 'h-[60%]', color: 'border-stone-300 bg-stone-100/40 text-stone-700' }
      ];
    } else if (id === 'sartorial-02') {
      return [
        { name: 'Front Coat', count: 'x2', wClass: 'w-[25%]', hClass: 'h-[95%]', color: 'border-clay-400 bg-clay-50/40 text-clay-850' },
        { name: 'Back Coat', count: 'x1 Fold', wClass: 'w-[24%]', hClass: 'h-[95%]', color: 'border-clay-500 bg-clay-100/30 text-clay-850' },
        { name: 'Sleeves', count: 'x2', wClass: 'w-[18%]', hClass: 'h-[75%]', color: 'border-amber-300 bg-amber-50/30 text-amber-900' },
        { name: 'Storm Shield', count: 'x1', wClass: 'w-[15%]', hClass: 'h-[55%]', color: 'border-stone-400 bg-stone-100/45 text-stone-800' },
        { name: 'Belt & Straps', count: 'x3', wClass: 'w-[12%]', hClass: 'h-[90%]', color: 'border-stone-300 bg-stone-50/30 text-stone-750' }
      ];
    } else if (id === 'sartorial-03') {
      return [
        { name: 'Leg Front', count: 'x2', wClass: 'w-[28%]', hClass: 'h-[92%]', color: 'border-clay-300 bg-clay-50/40 text-clay-800' },
        { name: 'Leg Back', count: 'x2', wClass: 'w-[28%]', hClass: 'h-[92%]', color: 'border-clay-400 bg-clay-100/30 text-clay-800' },
        { name: 'Contour Band', count: 'x2', wClass: 'w-[22%]', hClass: 'h-[40%]', color: 'border-amber-400 bg-amber-50/40 text-amber-950' },
        { name: 'Pocket Bags', count: 'x4', wClass: 'w-[16%]', hClass: 'h-[50%]', color: 'border-stone-300 bg-stone-50/30 text-stone-750' }
      ];
    } else if (id === 'sartorial-04') {
      return [
        { name: 'Drape Front', count: 'x1 Bias', wClass: 'w-[32%]', hClass: 'h-[85%]', color: 'border-clay-400 bg-clay-50/30 text-clay-850' },
        { name: 'Back Body', count: 'x1 Fold', wClass: 'w-[24%]', hClass: 'h-[80%]', color: 'border-clay-300 bg-clay-50/40 text-clay-800' },
        { name: 'Sleeves', count: 'x2', wClass: 'w-[20%]', hClass: 'h-[65%]', color: 'border-amber-300 bg-amber-50/30 text-amber-950' },
        { name: 'Collar Facing', count: 'x2', wClass: 'w-[18%]', hClass: 'h-[45%]', color: 'border-stone-300 bg-stone-50/30 text-stone-750' }
      ];
    } else {
      return [
        { name: 'Main Panels', count: 'x2', wClass: 'w-[35%]', hClass: 'h-[85%]', color: 'border-clay-350 bg-clay-50/30 text-clay-800' },
        { name: 'Facings', count: 'x2', wClass: 'w-[25%]', hClass: 'h-[50%]', color: 'border-amber-300 bg-amber-50/30 text-amber-950' },
        { name: 'Pocket Liners', count: 'x2', wClass: 'w-[20%]', hClass: 'h-[40%]', color: 'border-stone-300 bg-stone-50/30 text-stone-700' }
      ];
    }
  }, [activePattern]);

  // Sidebar Layout Component (Self-contained result renderer)
  const sidebarContent = (
    <div className="flex flex-col h-full justify-between" id="calculator-sidebar-inner">
      <div className="space-y-5 flex-1 overflow-y-auto p-4 sm:p-5 scrollbar-thin">
        {/* Active parameters quick summary banner */}
        <div className="bg-sand-50/65 border border-sand-200/50 rounded p-3 space-y-1 text-xs">
          <div className="font-bold text-bark-900 flex justify-between items-center">
            <span className="truncate max-w-[190px]">{activePattern.name}</span>
            <span className="font-mono text-[10px] text-clay-700">Size {localSize}</span>
          </div>
          <div className="text-[10px] text-bark-500 font-mono flex flex-wrap gap-x-2.5 gap-y-0.5">
            <span>Width: {currentWidth}"</span>
            <span>{pfUiT("ui.components.fabricyardagecalculator.d7f5d2ddc8")}<span className="font-bold text-clay-650">{layoutComplexity.toUpperCase()}</span></span>
          </div>
        </div>

        {/* Calculation Hero display */}
        <div className="text-center bg-white border border-sand-200/80 rounded-[4px] p-4.5 shadow-3xs relative overflow-hidden" id="sidebar-calculation-hero">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-clay-500 via-[#e0a894] to-bark-800" />
          <span className="text-[8.5px] font-mono font-bold text-clay-700 uppercase tracking-widest block mb-1">{pfUiT("ui.components.fabricyardagecalculator.1c3118187c")}</span>

          <div className="flex items-baseline justify-center gap-1">
            <motion.span
              key={`${calculations?.mainYards}-${customUnit}-sidebar`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="text-4xl font-extrabold font-mono text-bark-900 tracking-tight"
            >
              {customUnit === 'yards' ? calculations?.mainYards : calculations?.mainMeters}
            </motion.span>
            <span className="text-xs font-serif italic text-bark-600 font-medium">
              {customUnit}
            </span>
          </div>

          <p className="text-[9px] text-bark-450 mt-1.5 leading-tight">{pfUiT("ui.components.fabricyardagecalculator.f85f2f81a1")}</p>
        </div>

        {/* Breakdown summary cards */}
        <div className="space-y-2.5" id="sidebar-supplements-summary">
          <h4 className="text-[9px] font-mono font-bold text-bark-400 uppercase tracking-widest">{pfUiT("ui.components.fabricyardagecalculator.c56eb2c418")}</h4>

          <div className="bg-white border border-sand-150 rounded-[4px] divide-y divide-sand-100 text-xs font-medium font-sans">
            {/* Shell */}
            <div className="flex justify-between items-center p-2.5">
              <span className="text-bark-700 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-clay-500 rounded-full"></span>{pfUiT("ui.components.fabricyardagecalculator.4b6778485a")}</span>
              <span className="font-mono text-bark-950 font-bold">
                {customUnit === 'yards' ? `${calculations?.mainYards} yds` : `${calculations?.mainMeters} m`}
              </span>
            </div>

            {/* Lining */}
            <div className="flex justify-between items-center p-2.5">
              <span className="text-bark-700 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>{pfUiT("ui.components.fabricyardagecalculator.30c63b2ee2")}</span>
              {hasLining ? (
                <span className="font-mono text-clay-750 font-semibold">
                  {customUnit === 'yards' ? `${calculations?.liningYards} yds` : `${calculations?.liningMeters} m`}
                </span>
              ) : (
                <span className="text-[10px] text-bark-400 italic font-normal">{pfUiT("ui.components.fabricyardagecalculator.acab8761ac")}</span>
              )}
            </div>

            {/* Interfacing */}
            <div className="flex justify-between items-center p-2.5">
              <span className="text-bark-700 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full"></span>{pfUiT("ui.components.fabricyardagecalculator.35fc2da77f")}</span>
              {hasInterfacing ? (
                <span className="font-mono text-clay-750 font-semibold">
                  {customUnit === 'yards' ? `${calculations?.interfacingYards} yds` : `${calculations?.interfacingMeters} m`}
                </span>
              ) : (
                <span className="text-[10px] text-bark-400 italic font-normal">{pfUiT("ui.components.fabricyardagecalculator.acab8761ac")}</span>
              )}
            </div>
          </div>
        </div>

        {/* Layout Nesting Visualization */}
        <div className="space-y-2.5" id="sidebar-layout-nesting-visualization">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-mono font-bold text-bark-400 uppercase tracking-widest">{pfUiT("ui.components.fabricyardagecalculator.a92b90e6eb")}</span>
            <span className="text-[8px] font-mono font-bold text-clay-700 bg-clay-50 border border-clay-100 px-1.5 py-0.2 rounded">
              Efficiency: {calculations?.efficiencyScore}%
            </span>
          </div>

          <div className="relative border border-sand-200 rounded bg-white p-2.5 h-[76px] flex items-center justify-start overflow-hidden shadow-4xs">
            <div className="absolute inset-y-0 left-0 w-1 bg-clay-500" />
            <div className="absolute inset-0 bg-linear-to-r from-clay-50/15 to-sand-50/5 pointer-events-none" />

            <div className="absolute inset-0 z-0 flex justify-between px-8 pointer-events-none opacity-5">
              <div className="w-px h-full border-r border-dashed border-bark-900" />
              <div className="w-px h-full border-r border-dashed border-bark-900" />
              <div className="w-px h-full border-r border-dashed border-bark-900" />
            </div>

            <div className="relative z-10 w-full flex gap-1 h-full items-center" id="sidebar-pattern-nesting-blocks">
              <AnimatePresence mode="popLayout">
                {cuttingPieces.map((piece, i) => (
                  <motion.div
                    key={`sidebar-piece-${i}`}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2, delay: i * 0.04 }}
                    className={`border rounded-xs flex flex-col items-center justify-center text-[6.5px] font-mono leading-none ${piece.color} ${piece.wClass} ${piece.hClass}`}
                  >
                    <span className="font-bold text-center px-0.5 truncate max-w-full block">
                      {piece.name}
                    </span>
                    <span className="text-[5px] opacity-75 mt-0.5 font-sans block">{piece.count}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Matching fabrics from stash */}
        {stash.length > 0 && (
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-[4px] p-3 space-y-1.5" id="sidebar-stash-matcher">
            <span className="text-[8.5px] font-mono font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              Stash Fabric matches ({stash.filter(item => {
                const required = customUnit === 'yards' ? calculations?.mainYards : calculations?.mainMeters;
                const itemQty = parseFloat(item.quantity) || 0;
                return itemQty >= required;
              }).length})
            </span>
            <div className="space-y-1.5 max-h-[105px] overflow-y-auto pr-0.5 scrollbar-thin">
              {stash.filter(item => {
                const required = customUnit === 'yards' ? calculations?.mainYards : calculations?.mainMeters;
                const itemQty = parseFloat(item.quantity) || 0;
                return itemQty >= required;
              }).map(item => (
                <div key={`sidebar-stash-${item.id}`} className="flex items-center justify-between text-[10px] bg-white border border-emerald-100 p-1.5 rounded shadow-5xs">
                  <div className="flex items-center gap-1.5">
                    <img src={item.image} className="w-5 h-5 object-cover rounded-sm" referrerPolicy="no-referrer" />
                    <div className="leading-tight">
                      <span className="font-bold text-bark-900 block truncate max-w-[120px]">{item.name}</span>
                      <span className="text-[8px] text-bark-450 font-mono">{item.material} • {item.width}</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded text-[8.5px] shrink-0">
                    {item.quantity} {item.unit}
                  </span>
                </div>
              ))}
              {stash.filter(item => {
                const required = customUnit === 'yards' ? calculations?.mainYards : calculations?.mainMeters;
                const itemQty = parseFloat(item.quantity) || 0;
                return itemQty >= required;
              }).length === 0 && (
                <p className="text-[8.5px] text-bark-450 italic">
                  None of your stashed fabrics have enough yardage ({customUnit === 'yards' ? calculations?.mainYards : calculations?.mainMeters} {customUnit}) for this design.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sharing / Actions footer inside the sidebar */}
      <div className="border-t border-sand-200/60 p-4 space-y-2 bg-sand-50/40">
        <button
          onClick={handleCopySpecs}
          type="button"
          className="w-full bg-white hover:bg-sand-50 text-bark-800 border border-sand-250 py-2 rounded-[4px] font-bold text-[9px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-4xs"
        >
          <ClipboardCopy className="w-3.5 h-3.5 text-bark-600" />{pfUiT("ui.components.fabricyardagecalculator.9e53075056")}</button>

        {onApplyYardage && (
          <button
            onClick={() => {
              onApplyYardage(calculations?.mainYards, activePattern.name, currentWidth);
              if (window.showToast) {
                window.showToast("Yardage applied to active drafting session!", "success", "Applied Successfully");
              }
            }}
            type="button"
            className="w-full bg-bark-900 hover:bg-clay-605 text-sand-50 py-2.5 rounded-[4px] font-bold text-[9px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
          >
            <Check className="w-3.5 h-3.5" />{pfUiT("ui.components.fabricyardagecalculator.b8e346bdc8")}</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-white border border-sand-200/80 rounded-[4px] p-5 space-y-6 shadow-3xs text-left" id="fabric-calculator-root">

      {/* Header section with branding, pin actions, & unit selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-sand-200/60 pb-4">
        <div className="space-y-0.5">
          <h3 className="text-sm font-serif font-semibold text-bark-900 uppercase tracking-widest flex items-center gap-2">
            <Scissors className="w-4 h-4 text-clay-605" />{pfUiT("ui.components.fabricyardagecalculator.1c3118187c")}</h3>
          <p className="text-[10px] text-bark-500 font-medium">{pfUiT("ui.components.fabricyardagecalculator.e08ba059a8")}</p>
        </div>

        {/* Actions Controls Block */}
        <div className="flex items-center gap-2" id="header-action-toggles">
          {/* Floating Sidebar Toggle Button */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="px-3 py-1 bg-clay-50 hover:bg-clay-100 text-clay-700 text-[9px] font-bold font-mono uppercase tracking-wider rounded-[4px] border border-clay-200/50 transition-all cursor-pointer flex items-center gap-1 shadow-4xs"
            title={pfUiT("ui.components.fabricyardagecalculator.bdd538f7b7")}
            id="btn-toggle-yardage-sidebar"
          >
            <Pin className="w-3 h-3 text-clay-605" />
            <span>{pfUiT("ui.components.fabricyardagecalculator.f2e73c6fe6")}</span>
          </button>

          {/* Metric / Imperial unit toggle */}
          <div className="flex bg-sand-100 p-0.5 rounded-[4px] border border-sand-200/60" id="unit-toggle-container">
            <button
              onClick={() => setCustomUnit('yards')}
              className={`px-2.5 py-1 text-[9px] font-bold font-mono uppercase tracking-wider rounded-[3px] transition-all cursor-pointer ${
                customUnit === 'yards' ? 'bg-white text-clay-700 shadow-3xs' : 'text-bark-500 hover:text-bark-800'
              }`}
            >{pfUiT("ui.components.fabricyardagecalculator.23b86cf0c9")}</button>
            <button
              onClick={() => setCustomUnit('meters')}
              className={`px-2.5 py-1 text-[9px] font-bold font-mono uppercase tracking-wider rounded-[3px] transition-all cursor-pointer ${
                customUnit === 'meters' ? 'bg-white text-clay-700 shadow-3xs' : 'text-bark-500 hover:text-bark-800'
              }`}
            >{pfUiT("ui.components.fabricyardagecalculator.d6f7f94cc0")}</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="fabric-calculator-grid">

        {/* Left Parameter Panel (7 columns) */}
        <div className="lg:col-span-7 space-y-5" id="params-column">

          {/* Curated Sewing Pattern Selector */}
          <div className="space-y-1.5 relative">
            <label className="text-[10px] font-mono font-bold text-bark-500 uppercase tracking-widest block">{pfUiT("ui.components.fabricyardagecalculator.461467c9fb")}</label>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-bark-400" />
                <input
                  type="text"
                  placeholder={activePatternOverride ? 'Workspace variant locked' : 'Filter sewing patterns...'}
                  value={searchTerm}
                  disabled={Boolean(activePatternOverride)}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-sand-200 rounded text-xs bg-white text-bark-800 focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-xs text-bark-400 hover:text-bark-700 font-mono"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Pattern horizontal grid picker */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-[165px] overflow-y-auto pr-1" id="patterns-selection-grid">
              {filteredPatterns.map((p) => {
                const isSelected = activePattern?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (!activePatternOverride) {
                        setSelectedPatternId(p.id);
                      }
                    }}
                    className={`p-2 rounded-[4px] border text-left transition-all duration-200 flex flex-col justify-between h-[75px] cursor-pointer ${
                      isSelected
                        ? 'border-clay-500 bg-clay-50/10 ring-1 ring-clay-500/20 shadow-3xs'
                        : 'border-sand-200 hover:border-sand-300 bg-white'
                    }`}
                  >
                    <div className="w-full">
                      <span className="text-[10px] font-sans font-semibold text-bark-900 block truncate leading-tight">
                        {p.name}
                      </span>
                      <span className="text-[8px] text-bark-450 uppercase font-mono tracking-wider block mt-0.5">
                        {p.category}
                      </span>
                    </div>

                    <div className="flex items-center justify-between w-full mt-1.5">
                      <span className="text-[7.5px] font-mono bg-sand-100 text-bark-600 px-1 py-0.2 rounded">
                        {p.difficulty}
                      </span>
                      {isSelected && (
                        <Check className="w-3 h-3 text-clay-650" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Pattern Meta Overview */}
            {activePattern && (
              <motion.div
                key={activePattern.id}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-sand-50/70 border border-sand-200 rounded p-3 flex gap-3 items-start"
              >
                <div className="w-12 h-16 bg-sand-200 rounded overflow-hidden flex-shrink-0 border border-sand-300/30">
                  <img
                    src={activePattern.image}
                    alt={activePattern.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-[11px] font-bold text-bark-900 truncate">
                      {activePattern.name}
                    </span>
                    <span className="text-[8px] font-mono uppercase text-[#e0a894] font-semibold bg-bark-900/5 px-1 rounded">{pfUiT("ui.components.fabricyardagecalculator.aa0ea973ab")}</span>
                  </div>
                  <p className="text-[9px] text-bark-500 line-clamp-2 leading-relaxed italic">
                    "{activePattern.tagline}" — {activePattern.description}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="text-[8.5px] text-bark-600 font-sans">
                      <strong>{pfUiT("ui.components.fabricyardagecalculator.40eace2275")}</strong> {activePattern.fabricSuggestions?.slice(0, 3).join(', ')}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Width Selector Panel */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-mono font-bold text-bark-500 uppercase tracking-widest">{pfUiT("ui.components.fabricyardagecalculator.7a1b4b45ec")}</label>
              <button
                onClick={() => setCustomWidthEnabled(!customWidthEnabled)}
                className="text-[9px] text-clay-650 hover:text-clay-605 font-bold font-mono uppercase tracking-wider cursor-pointer"
              >
                {customWidthEnabled ? 'Standard Presets' : 'Custom Slider'}
              </button>
            </div>

            {!customWidthEnabled ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" id="fabric-width-presets">
                {FABRIC_WIDTH_PRESETS.map((preset) => {
                  const isActive = fabricWidth === preset.value;
                  return (
                    <button
                      key={preset.value}
                      onClick={() => setFabricWidth(preset.value)}
                      className={`p-2 rounded-[4px] border text-left transition-all cursor-pointer flex flex-col justify-between h-[52px] ${
                        isActive
                          ? 'border-clay-500 bg-clay-50/10 ring-1 ring-clay-100/30'
                          : 'border-sand-200 hover:border-sand-300 bg-white'
                      }`}
                    >
                      <span className="text-[11px] font-bold text-bark-900 block font-mono">{preset.label}</span>
                      <span className="text-[8px] text-bark-450 block font-sans truncate">{preset.desc}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-sand-50/50 p-3.5 border border-sand-200 rounded-[4px] space-y-2">
                <div className="flex justify-between items-center text-xs font-mono font-bold text-bark-800">
                  <span>Custom Width: {customWidth} inches</span>
                  <span>{Math.round(customWidth * 2.54)} cm Bolt Width</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="72"
                  step="1"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(parseInt(e.target.value))}
                  className="w-full h-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-clay-605"
                />
                <div className="flex justify-between text-[8px] text-bark-400 font-mono">
                  <span>30" (76cm)</span>
                  <span>44" (110cm)</span>
                  <span>54" (137cm)</span>
                  <span>60" (152cm)</span>
                  <span>72" (183cm)</span>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Pattern Layout Complexity Segment Group */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-mono font-bold text-bark-500 uppercase tracking-widest">{pfUiT("ui.components.fabricyardagecalculator.30078f30a7")}</label>
              <HelpCircle className="w-3.5 h-3.5 text-bark-400 cursor-pointer" title={pfUiT("ui.components.fabricyardagecalculator.6034bc97be")} />
            </div>

            <div className="grid grid-cols-3 gap-2" id="layout-complexity-picker">
              {[
                {
                  value: 'simple',
                  label: pfUiT('ui.yardage.layoutComplexity.simple.label', {}, 'Simple / Economic'),
                  desc: 'High nesting density. Straight vertical grain lines, rectangular blocks, or minimal parts.',
                  rate: '-8% fabric',
                },
                {
                  value: 'standard',
                  label: pfUiT('ui.yardage.layoutComplexity.standard.label', {}, 'Standard Atelier'),
                  desc: 'Standard professional nesting. Average pieces, traditional sleeves, and standard collars.',
                  rate: 'Baseline (0%)',
                },
                {
                  value: 'complex',
                  label: pfUiT('ui.yardage.layoutComplexity.complex.label', {}, 'Complex / Couture'),
                  desc: 'Advanced drapes, asymmetrical wrap pieces, bias cuts, deep pleats, or extreme flares.',
                  rate: '+18% buffer',
                }
              ].map((complexity) => {
                const isActive = layoutComplexity === complexity.value;
                return (
                  <button
                    key={complexity.value}
                    type="button"
                    onClick={() => setLayoutComplexity(complexity.value)}
                    className={`p-2.5 rounded-[4px] border text-left transition-all cursor-pointer flex flex-col justify-between h-[96px] relative ${
                      isActive
                        ? 'border-clay-500 bg-clay-50/15 ring-1 ring-clay-500/20 shadow-3xs'
                        : 'border-sand-200 hover:border-sand-300 bg-white'
                    }`}
                  >
                    <div className="w-full leading-tight">
                      <div className="flex justify-between items-center w-full">
                        <span className="text-[10.5px] font-bold text-bark-900 block font-sans">
                          {complexity.label}
                        </span>
                        {isActive && (
                          <span className="w-1.5 h-1.5 bg-clay-605 rounded-full" />
                        )}
                      </div>
                      <span className="text-[7.5px] text-bark-450 block font-sans mt-1 leading-normal line-clamp-3">
                        {complexity.desc}
                      </span>
                    </div>
                    <span className="text-[7.5px] font-mono font-bold text-clay-700 bg-clay-50 px-1.5 py-0.2 rounded mt-1.5 block w-max">
                      {complexity.rate}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Repeat pattern & Size selectors row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Pattern Repeats / Nap */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold text-bark-500 uppercase tracking-widest block">{pfUiT("ui.components.fabricyardagecalculator.967b69be6b")}</label>
              <select
                value={patternRepeat}
                onChange={(e) => setPatternRepeat(e.target.value)}
                className="w-full text-xs bg-white border border-sand-200 rounded-[4px] p-2 font-medium text-bark-800 focus:border-clay-400 focus:outline-hidden cursor-pointer"
              >
                <option value="none">Solid Color / Random Print (0% extra)</option>
                <option value="nap">Directional Nap / Velvet / Satin (+12% extra)</option>
                <option value="plaid">Plaid, Large Stripes, or Tartans (+22% extra)</option>
              </select>
            </div>

            {/* Sizing selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold text-bark-500 uppercase tracking-widest block">{pfUiT("ui.components.fabricyardagecalculator.68d5a19f83")}</label>
              <select
                value={canonicalSizes.length ? (activeCanonicalSize?.id || '') : localSize}
                onChange={(e) => {
                  if (canonicalSizes.length) {
                    setLocalCanonicalSizeId(e.target.value);
                  } else {
                    setLocalSize(e.target.value);
                  }
                }}
                className="w-full text-xs bg-white border border-sand-200 rounded-[4px] p-2 font-medium text-bark-800 focus:border-clay-400 focus:outline-hidden cursor-pointer"
              >
                {canonicalSizes.length
                  ? canonicalSizes.map((size) => (
                      <option key={size.id} value={size.id}>
                        {getPreferredSizeReference(size, normalizedMeasurementChart?.displaySystem) || size.label || size.id}
                      </option>
                    ))
                  : [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24].map((sz) => (
                      <option key={sz} value={sz}>
                        Size {sz} (Bust ~{30 + sz * 1.5}")
                      </option>
                    ))}
              </select>
              {canonicalSizes.length > 0 && (
                <p className="mt-1 text-[9px] text-bark-450 font-mono">
                  Uses existing numeric heuristic with derived reference size {sizeNum}; not marker-accurate.
                </p>
              )}
            </div>

          </div>

          {/* Optional switches for Linings / Interfacing */}
          <div className="border-t border-sand-150 pt-3 flex flex-wrap gap-5">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-sans text-bark-800 select-none">
              <input
                type="checkbox"
                checked={hasLining}
                onChange={() => setHasLining(!hasLining)}
                className="rounded border-sand-300 text-clay-600 focus:ring-clay-500 w-3.5 h-3.5 cursor-pointer"
              />
              <div className="leading-tight">
                <span className="font-bold block">{pfUiT("ui.components.fabricyardagecalculator.a3a36924a1")}</span>
                <span className="text-[9px] text-bark-450 font-medium font-mono">{pfUiT("ui.components.fabricyardagecalculator.e18ece6ad3")}</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-sans text-bark-800 select-none">
              <input
                type="checkbox"
                checked={hasInterfacing}
                onChange={() => setHasInterfacing(!hasInterfacing)}
                className="rounded border-sand-300 text-clay-600 focus:ring-clay-500 w-3.5 h-3.5 cursor-pointer"
              />
              <div className="leading-tight">
                <span className="font-bold block">{pfUiT("ui.components.fabricyardagecalculator.bedc4cb6f6")}</span>
                <span className="text-[9px] text-bark-450 font-medium font-mono">{pfUiT("ui.components.fabricyardagecalculator.b055e8a47e")}</span>
              </div>
            </label>
          </div>

        </div>

        {/* Right Output Sidebar Component (5 columns) */}
        <div className="lg:col-span-5 bg-[#FAF8F5] border border-sand-200/80 rounded-[4px] p-4.5 flex flex-col justify-between shadow-xs relative" id="outcomes-column">
          {/* Internal visual badge to anchor the "Sidebar" concept */}
          <div className="flex items-center justify-between pb-2 border-b border-sand-200/60 mb-2">
            <span className="text-[9px] font-mono font-bold text-bark-500 uppercase tracking-widest flex items-center gap-1">
              <Layers className="w-3 h-3 text-clay-605" />{pfUiT("ui.components.fabricyardagecalculator.c3a7eb668c")}</span>
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" title={pfUiT("ui.components.fabricyardagecalculator.7b9151da1b")} />
          </div>

          {sidebarContent}
        </div>

      </div>

      {/* Floating full-screen slide-out Sidebar Drawer (for Multi-tasking) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-bark-950 cursor-pointer"
              style={{ zIndex: UI_LAYERS.modalBackdrop }}
              id="sidebar-backdrop"
            />

            {/* Sidebar Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 right-0 h-full w-full max-w-sm sm:max-w-md bg-white border-l border-sand-200 shadow-2xl flex flex-col justify-between"
              style={{ zIndex: UI_LAYERS.modal }}
              id="sidebar-floating-drawer"
            >
              {/* Header */}
              <div className="border-b border-sand-200 p-4 sm:p-5 flex items-center justify-between bg-[#FAF8F5]" id="sidebar-drawer-header">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-clay-605" />
                  <div>
                    <h3 className="text-xs font-serif font-bold uppercase tracking-widest text-bark-900">{pfUiT("ui.components.fabricyardagecalculator.17c35e6c90")}</h3>
                    <p className="text-[9px] text-bark-500 font-sans font-medium">{pfUiT("ui.components.fabricyardagecalculator.f233320bbe")}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Floating Unit Switcher */}
                  <div className="flex bg-sand-100 p-0.5 rounded border border-sand-200/60 text-[8px]" id="sidebar-drawer-unit-toggle">
                    <button
                      onClick={() => setCustomUnit('yards')}
                      className={`px-1.5 py-0.5 font-bold font-mono rounded transition-all ${
                        customUnit === 'yards' ? 'bg-white text-clay-700 shadow-4xs' : 'text-bark-500'
                      }`}
                    >{pfUiT("ui.components.fabricyardagecalculator.4e110b5911")}</button>
                    <button
                      onClick={() => setCustomUnit('meters')}
                      className={`px-1.5 py-0.5 font-bold font-mono rounded transition-all ${
                        customUnit === 'meters' ? 'bg-white text-clay-700 shadow-4xs' : 'text-bark-500'
                      }`}
                    >{pfUiT("ui.components.fabricyardagecalculator.e0608e468a")}</button>
                  </div>

                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1.5 hover:bg-sand-100 rounded transition-all text-bark-600 hover:text-bark-900 cursor-pointer"
                    id="btn-close-floating-sidebar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Live Parameters Panel within the Sidebar */}
              <div className="border-b border-sand-100 bg-[#FAF8F5]/40 p-4 space-y-3" id="sidebar-drawer-sliders">
                <span className="text-[8.5px] font-mono font-bold text-bark-450 uppercase tracking-widest block">{pfUiT("ui.components.fabricyardagecalculator.579d077113")}</span>
                <div className="grid grid-cols-2 gap-3">
                  {/* Width slider inside sidebar */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-bark-800 font-sans block">
                      Bolt Width: {currentWidth}"
                    </span>
                    <input
                      type="range"
                      min="32"
                      max="68"
                      step="2"
                      value={currentWidth}
                      onChange={(e) => {
                        setCustomWidthEnabled(true);
                        setCustomWidth(parseInt(e.target.value));
                      }}
                      className="w-full h-1 bg-sand-200 rounded accent-clay-605 cursor-pointer"
                    />
                  </div>

                  {/* Size select inside sidebar */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-bark-800 font-sans block">{pfUiT("ui.components.fabricyardagecalculator.30e6332f53")}</span>
                    <select
                      value={canonicalSizes.length ? (activeCanonicalSize?.id || '') : localSize}
                      onChange={(e) => {
                        if (canonicalSizes.length) {
                          setLocalCanonicalSizeId(e.target.value);
                        } else {
                          setLocalSize(e.target.value);
                        }
                      }}
                      className="w-full text-[10px] bg-white border border-sand-200 rounded p-1 font-mono text-bark-800 focus:outline-hidden cursor-pointer"
                    >
                      {canonicalSizes.length
                        ? canonicalSizes.map((size) => (
                            <option key={`sidebar-opt-${size.id}`} value={size.id}>
                              {getPreferredSizeReference(size, normalizedMeasurementChart?.displaySystem) || size.label || size.id}
                            </option>
                          ))
                        : [0, 4, 8, 12, 16, 20, 24].map((sz) => (
                            <option key={`sidebar-opt-${sz}`} value={sz}>Size {sz}</option>
                          ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* Complexity select inside sidebar */}
                  <div className="space-y-1 col-span-2">
                    <span className="text-[9px] font-bold text-bark-800 font-sans block">{pfUiT("ui.components.fabricyardagecalculator.1158e2693d")}</span>
                    <div className="flex bg-sand-100 p-0.5 rounded border border-sand-200/50">
                      {['simple', 'standard', 'complex'].map((level) => (
                        <button
                          key={`sidebar-drawer-level-${level}`}
                          onClick={() => setLayoutComplexity(level)}
                          className={`flex-1 text-[8.5px] font-sans font-bold capitalize py-0.5 rounded transition-all ${
                            layoutComplexity === level ? 'bg-white text-clay-705 shadow-5xs' : 'text-bark-550'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Render dynamic Sidebar Content */}
              <div className="flex-1 overflow-y-auto" id="sidebar-drawer-body">
                {sidebarContent}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
