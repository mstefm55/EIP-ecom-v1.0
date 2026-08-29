import React, { useState, useMemo, useEffect } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { localizeMetadataTree } from '../lib/localizedMetadata';
import { useRuntimeState } from '../context/RuntimeDataContext';
import { RUNTIME_DOMAINS } from '../lib/runtimeDomainContracts';
import { PRINTING_GUIDE_SEED } from '../data/runtimeSeeds';
import { motion, AnimatePresence } from 'motion/react';
import {
  Printer, Scissors, Layers, Check, RefreshCw, Ruler,
  Grid, AlertTriangle, ChevronLeft, ChevronRight, HelpCircle,
  FileText, ArrowRight, Settings, Info, Square, Eye, Play, Pause, RotateCcw, ZoomIn, CheckCircle2
} from 'lucide-react';

// Database of SVG paths representing actual garment pattern pieces layout
export default function PrintingGuide({
  initialPattern = "Aurelia Wrap Dress",
  initialFormat = "Letter",
  onAssemblyComplete
}) {
  const [printingGuideData] = useRuntimeState(RUNTIME_DOMAINS.PRINTING_GUIDES, PRINTING_GUIDE_SEED);
  const PATTERN_PATHS = printingGuideData?.patternPaths || PRINTING_GUIDE_SEED.patternPaths;
  const PATTERNS_DB = printingGuideData?.patterns || PRINTING_GUIDE_SEED.patterns;
  const stepMetadata = localizeMetadataTree(
    perfectFitMetadata.componentUi.printingGuide.steps,
    'component.printingGuide.steps',
    pfUiT
  );
  const stepIconMap = { settings: Settings, ruler: Ruler, scissors: Scissors, grid: Grid, layers: Layers };
  const steps = stepMetadata.map((step) => ({ ...step, icon: stepIconMap[step.icon] || Settings }));
  // 1. Interactive States
  const [selectedPattern, setSelectedPattern] = useState(initialPattern);
  const [selectedFormat, setSelectedFormat] = useState(initialFormat);
  const [currentStep, setCurrentStep] = useState(0); // 0 to 4

  // Calibration Square simulator state
  const [unit, setUnit] = useState('in'); // 'in' | 'cm'
  const [measuredValue, setMeasuredValue] = useState(2.0); // 2.0 inches standard
  const [isCalibrated, setIsCalibrated] = useState(true);

  // Grid interaction: track which pages have been printed & taped
  const [assembledPages, setAssembledPages] = useState({});
  const [highlightedPage, setHighlightedPage] = useState(null);

  // Print Preview Mode States
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [previewScale, setPreviewScale] = useState(100); // 90 to 110%
  const [isPrintingSimulating, setIsPrintingSimulating] = useState(false);
  const [currentlyPrintingIndex, setCurrentlyPrintingIndex] = useState(-1);
  const [inspectorSelectedPage, setInspectorSelectedPage] = useState({ row: 0, col: 0 });
  const [showAlignmentMarks, setShowAlignmentMarks] = useState(true);
  const [showMargins, setShowMargins] = useState(true);
  const [showPieceFills, setShowPieceFills] = useState(true);

  // Dynamic feedback when calibration changes
  useEffect(() => {
    if (unit === 'in') {
      setIsCalibrated(Math.abs(measuredValue - 2.0) < 0.02);
    } else {
      setIsCalibrated(Math.abs(measuredValue - 5.0) < 0.05);
    }
  }, [measuredValue, unit]);

  // Adjust measured value base when unit changes
  const handleUnitChange = (newUnit) => {
    setUnit(newUnit);
    if (newUnit === 'in') {
      setMeasuredValue(2.0);
    } else {
      setMeasuredValue(5.0);
    }
  };

  // Pre-configured sewing pattern blueprints
  
  const activePatternDetails = PATTERNS_DB[selectedPattern] || PATTERNS_DB["Aurelia Wrap Dress"];

  // 2. Calculated Scaling adjustment
  const scalingAnalysis = useMemo(() => {
    const target = unit === 'in' ? 2.0 : 5.0;
    const diff = measuredValue - target;
    const ratio = target / measuredValue;
    const recommendedPercentage = Math.round(ratio * 100 * 10) / 10;

    return {
      diff,
      ratio,
      recommendedPercentage,
      status: Math.abs(diff) < 0.005 ? "perfect" : (diff > 0 ? "too-large" : "too-small")
    };
  }, [measuredValue, unit]);

  // Expose global methods for ERP integrations & automated content crawlers
  useEffect(() => {
    window.setERPPrintingGuideConfig = (config) => {
      if (!config) return { success: false, error: "Empty config provided." };

      if (config.pattern && PATTERNS_DB[config.pattern]) {
        setSelectedPattern(config.pattern);
      }
      if (config.format && ["Letter", "A4", "A0"].includes(config.format)) {
        setSelectedFormat(config.format);
      }
      if (config.measuredValue && typeof config.measuredValue === 'number') {
        setMeasuredValue(config.measuredValue);
      }
      if (config.unit && ["in", "cm"].includes(config.unit)) {
        setUnit(config.unit);
      }
      if (config.step !== undefined && config.step >= 0 && config.step <= 4) {
        setCurrentStep(config.step);
      }
      return {
        success: true,
        currentPattern: config.pattern || selectedPattern,
        currentFormat: config.format || selectedFormat,
        message: pfUiT("ui.components.printingguide.erpConfigUpdated", {}, "ERP content injection configuration successfully updated.")
      };
    };

    return () => {
      try {
        delete window.setERPPrintingGuideConfig;
      } catch {}
    };
  }, [selectedPattern, selectedFormat]);
const totalGridPages = useMemo(() => {
    if (selectedFormat === "A0") return 1; // Copyshop is a single continuous blueprint sheet
    return activePatternDetails.cols * activePatternDetails.rows;
  }, [selectedFormat, activePatternDetails]);

  // Handle Simulated Printing Animation Loop
  useEffect(() => {
    let intervalId = null;
    if (isPrintingSimulating) {
      intervalId = setInterval(() => {
        setCurrentlyPrintingIndex((prev) => {
          if (prev >= totalGridPages - 1) {
            setIsPrintingSimulating(false);
            return totalGridPages - 1;
          }
          const nextIdx = prev + 1;
          // Calculate row and column of new page
          const r = Math.floor(nextIdx / activePatternDetails.cols);
          const c = nextIdx % activePatternDetails.cols;
          setInspectorSelectedPage({ row: r, col: c });
          return nextIdx;
        });
      }, 700);
    } else {
      if (currentlyPrintingIndex === totalGridPages - 1) {
        // Keep it at full completion
      } else {
        setCurrentlyPrintingIndex(-1);
      }
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPrintingSimulating, totalGridPages, activePatternDetails.cols]);

  const handleResetSimulation = () => {
    setIsPrintingSimulating(false);
    setCurrentlyPrintingIndex(-1);
    setInspectorSelectedPage({ row: 0, col: 0 });
  };

  // Total grid count helper
  
  // Track page cell details (which piece occupies this cell)
  const getPageOverlaps = (r, c) => {
    if (selectedFormat === "A0") return ["Complete Blueprint Roll (No cutting needed)"];

    const overlaps = [];
    activePatternDetails.pieces.forEach(p => {
      const match = p.coords.some(coord => coord[0] === r && coord[1] === c);
      if (match) {
        overlaps.push(p);
      }
    });
    return overlaps;
  };

  // Helper to mark all pages as taped
  const handleTapeAll = () => {
    const newAssembled = {};
    for (let r = 0; r < activePatternDetails.rows; r++) {
      for (let c = 0; c < activePatternDetails.cols; c++) {
        newAssembled[`${r}-${c}`] = true;
      }
    }
    setAssembledPages(newAssembled);
    if (onAssemblyComplete) onAssemblyComplete(true);
  };

  // Toggle page taped status
  const togglePageAssembled = (r, c) => {
    const key = `${r}-${c}`;
    setAssembledPages(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      // Check if all taped
      let allTaped = true;
      for (let row = 0; row < activePatternDetails.rows; row++) {
        for (let col = 0; col < activePatternDetails.cols; col++) {
          if (!updated[`${row}-${col}`]) {
            allTaped = false;
            break;
          }
        }
      }
      if (allTaped && onAssemblyComplete) {
        onAssemblyComplete(true);
      }
      return updated;
    });
  };

  // Reset assembled map
  const handleResetGrid = () => {
    setAssembledPages({});
    setHighlightedPage(null);
  };

  // Simulation templates for fast testing of different states
  const simulationProfiles = {
    standardLetter: () => {
      setSelectedPattern("Aurelia Wrap Dress");
      setSelectedFormat("Letter");
      setUnit("in");
      setMeasuredValue(2.0);
      setCurrentStep(3);
      setAssembledPages({ "0-0": true, "0-1": true, "0-2": true });
    },
    calibrationError: () => {
      setSelectedPattern("Atelier Trench Coat");
      setSelectedFormat("A4");
      setUnit("in");
      setMeasuredValue(1.85); // miscalibrated!
      setCurrentStep(1); // Calibration step
      setAssembledPages({});
    },
    copyshopReady: () => {
      setSelectedPattern("Renaissance Pleated Bodice");
      setSelectedFormat("A0");
      setUnit("cm");
      setMeasuredValue(5.0);
      setCurrentStep(4);
    }
  };

  const StepIcon = steps[currentStep].icon;

  return (
    <div
      className="bg-white border border-sand-200/90 rounded-[4px] p-5 md:p-6 space-y-6 erp-printing-guide"
      id="interactive-printing-guide"
      data-erp-selected-pattern={selectedPattern}
      data-erp-selected-format={selectedFormat}
      data-erp-calibration-status={isCalibrated ? "calibrated" : "uncalibrated"}
    >
      {/* 1. Header & Context */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-sand-150 pb-4" id="guide-header-row">
        <div>
          <span className="text-[10px] uppercase font-mono text-clay-700 bg-clay-50/80 px-2 py-0.5 rounded font-bold tracking-wider">{pfUiT("ui.components.printingguide.fba61109c5")}</span>
          <h3 className="text-xl font-serif text-bark-900 font-semibold mt-1">{pfUiT("ui.components.printingguide.973b2ffe28")}</h3>
          <p className="text-xs text-bark-500 font-sans mt-0.5">{pfUiT("ui.components.printingguide.2fcea72a37")}</p>
        </div>

        {/* Dynamic ERP test console widget */}
        <div className="bg-sand-50/80 border border-sand-200 p-2.5 rounded flex items-center gap-2 text-[10.5px] font-sans shrink-0" id="erp-profile-quick-select">
          <span className="font-mono font-bold text-bark-500 uppercase text-[9.5px]">{pfUiT("ui.components.printingguide.9502700fa0")}</span>
          <button
            onClick={simulationProfiles.standardLetter}
            className="bg-white hover:bg-sand-100/50 text-bark-800 border border-sand-250 text-[10px] px-1.5 py-0.5 rounded cursor-pointer font-sans"
            type="button"
          >{pfUiT("ui.components.printingguide.0cd3066fac")}</button>
          <button
            onClick={simulationProfiles.calibrationError}
            className="bg-white hover:bg-rose-50 text-rose-800 border border-rose-200 text-[10px] px-1.5 py-0.5 rounded cursor-pointer font-sans"
            type="button"
          >{pfUiT("ui.components.printingguide.d3391975df")}</button>
          <button
            onClick={simulationProfiles.copyshopReady}
            className="bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] px-1.5 py-0.5 rounded cursor-pointer font-sans"
            type="button"
          >{pfUiT("ui.components.printingguide.4a1f706dce")}</button>
        </div>
      </div>

      {/* 2. Interactive Selections */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-sand-50/30 border border-sand-150 rounded-[4px] p-4" id="guide-form-selections">

        {/* Pattern Blueprint Choice */}
        <div className="md:col-span-5 space-y-1.5" id="field-pattern-select">
          <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-bark-450 block">{pfUiT("ui.components.printingguide.81ba4709f6")}</label>
          <select
            value={selectedPattern}
            onChange={(e) => {
              setSelectedPattern(e.target.value);
              handleResetGrid();
            }}
            className="w-full border border-sand-250 rounded-[3px] text-xs px-3 py-2 bg-white font-sans text-bark-850 focus:outline-none focus:ring-1 focus:ring-clay-500 erp-pattern-selector"
            id="sel-pattern-blueprint"
          >
            {Object.keys(PATTERNS_DB).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="flex gap-2 text-[10px] text-bark-500 font-sans mt-1">
            <span>{pfUiT("ui.components.printingguide.966620ac50")}<b className="text-bark-800">{activePatternDetails.difficulty}</b></span>
            <span>•</span>
            <span>{pfUiT("ui.components.printingguide.68b377a9b6")}<b className="text-bark-800">{activePatternDetails.estTime}</b></span>
          </div>
        </div>

        {/* Paper Format Choice */}
        <div className="md:col-span-4 space-y-1.5" id="field-format-select">
          <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-bark-450 block">{pfUiT("ui.components.printingguide.cf3c063b6a")}</label>
          <select
            value={selectedFormat}
            onChange={(e) => {
              setSelectedFormat(e.target.value);
              handleResetGrid();
            }}
            className="w-full border border-sand-250 rounded-[3px] text-xs px-3 py-2 bg-white font-sans text-bark-850 focus:outline-none focus:ring-1 focus:ring-clay-500 erp-format-selector"
            id="sel-paper-format"
          >
            <option value="Letter">Letter Paper (US Standard)</option>
            <option value="A4">A4 Paper (Global Standard)</option>
            <option value="A0">A0 Copyshop (1 Continuous Roll)</option>
          </select>
          <p className="text-[10px] text-bark-500 font-sans mt-1">
            {selectedFormat === "A0"
              ? "Wide format continuous sheet. No tiling required."
              : `Total tiling sheets required: ${totalGridPages} pages.`}
          </p>
        </div>

        {/* Assembly Checklist summary badge */}
        <div className="md:col-span-3 flex flex-col justify-center items-stretch md:items-end border-t md:border-t-0 md:border-l border-sand-200 pt-3 md:pt-0 md:pl-4 space-y-1.5" id="guide-progress-badge">
          <div className="text-left md:text-right">
            <span className="text-[9px] uppercase font-mono text-bark-400 font-bold block">{pfUiT("ui.components.printingguide.983c7731a2")}</span>
            <div className="flex items-baseline gap-1 mt-0.5 justify-start md:justify-end">
              <span className="text-xl font-serif font-bold text-bark-900" id="assembled-count-label">
                {selectedFormat === "A0" ? (currentStep === 4 ? 1 : 0) : Object.keys(assembledPages).length}
              </span>
              <span className="text-xs text-bark-450">/ {totalGridPages} pages</span>
            </div>
          </div>
          {selectedFormat !== "A0" && (
            <div className="flex gap-1.5 w-full">
              <button
                onClick={handleTapeAll}
                className="flex-1 bg-sand-100 hover:bg-sand-200/80 text-bark-800 text-[9.5px] font-sans font-bold px-2 py-1 rounded transition-colors text-center cursor-pointer"
                type="button"
                id="btn-tape-all"
              >{pfUiT("ui.components.printingguide.5ad3ec9e95")}</button>
              <button
                onClick={handleResetGrid}
                className="bg-white hover:bg-rose-50 text-rose-700 border border-sand-200 hover:border-rose-200 p-1 rounded transition-all cursor-pointer"
                type="button"
                title={pfUiT("ui.components.printingguide.26066f35b2")}
                id="btn-reset-assembly"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

      </div>

      {/* 3. Horizontal Stepper Timeline */}
      <div className="border-y border-sand-150 py-3.5" id="guide-stepper-row">
        <div className="flex justify-between items-center overflow-x-auto gap-4 no-scrollbar">
          {steps.map((step, idx) => {
            const IconComponent = step.icon;
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;

            return (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className="flex items-center gap-2 text-left shrink-0 cursor-pointer group transition-all"
                type="button"
                id={`btn-step-${idx}`}
                data-erp-step-active={isActive ? "true" : "false"}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center border font-mono text-[10.5px] font-bold transition-all ${
                  isActive
                    ? 'bg-bark-900 border-bark-900 text-sand-50 shadow-3xs scale-105'
                    : isCompleted
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                      : 'bg-white border-sand-200 text-bark-450 group-hover:border-sand-400 group-hover:text-bark-900'
                }`}>
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <div>
                  <span className={`text-[11px] font-semibold block leading-tight ${
                    isActive ? 'text-bark-900 font-bold' : 'text-bark-550 group-hover:text-bark-900'
                  }`}>
                    {step.title}
                  </span>
                  <span className="text-[9px] text-bark-400 font-sans block leading-none">
                    {idx === currentStep ? "Current Phase" : "Inspect Step"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Active Step Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="guide-step-body">

        {/* Left Side: Step Details & Controls */}
        <div className="lg:col-span-5 space-y-4" id="guide-step-sidebar">

          <div className="bg-sand-50/50 border border-sand-200 rounded-[4px] p-4 space-y-3.5" id="guide-step-info-card">
            <div className="flex items-start justify-between" id="step-info-header">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white border border-sand-200 rounded-[3px] text-bark-800">
                  <StepIcon className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-mono text-bark-400 font-bold block">Instruction Set {currentStep + 1} of 5</span>
                  <h4 className="text-sm font-serif font-bold text-bark-900 mt-0.5">{steps[currentStep].title}</h4>
                </div>
              </div>
            </div>

            <p className="text-xs text-bark-650 leading-relaxed font-sans" id="step-description-text">
              {steps[currentStep].description}
            </p>

            {/* Render Contextual Details based on active step */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="space-y-3 pt-2 border-t border-sand-150"
              >
                {currentStep === 0 && (
                  <div className="space-y-2 text-xs font-sans text-bark-750" id="step-info-0">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-clay-500 mt-1.5 shrink-0" />
                      <span>{pfUiT("ui.components.printingguide.46ee66dfb2")}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-clay-500 mt-1.5 shrink-0" />
                      <span>{pfUiT("ui.components.printingguide.7367cc62fb")}</span>
                    </div>
                  </div>
                )}

                {currentStep === 1 && (
                  <div className="space-y-3" id="step-info-1">
                    <p className="text-xs text-bark-700 leading-relaxed font-sans">{pfUiT("ui.components.printingguide.e93bef436a")}</p>

                    {/* Interactive Calibration Simulator */}
                    <div
                      className={`border p-3.5 rounded-[4px] space-y-3 erp-calibration-square ${
                        isCalibrated
                          ? 'bg-emerald-50/60 border-emerald-100'
                          : 'bg-rose-50/60 border-rose-100'
                      }`}
                      data-erp-calibrated={isCalibrated ? "true" : "false"}
                      id="calibration-calc-container"
                    >
                      <div className="flex justify-between items-center" id="cal-calc-header">
                        <span className="text-[10px] font-mono uppercase font-bold tracking-wide text-bark-550 flex items-center gap-1">
                          <Ruler className="w-3.5 h-3.5 text-bark-600" />{pfUiT("ui.components.printingguide.1df0ac3ade")}</span>

                        {/* Unit Toggles */}
                        <div className="flex bg-white border border-sand-250 rounded-[3px] overflow-hidden p-0.5" id="unit-toggles">
                          <button
                            onClick={() => handleUnitChange('in')}
                            className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-sm cursor-pointer ${unit === 'in' ? 'bg-bark-900 text-white' : 'text-bark-500 hover:bg-sand-100/50'}`}
                            type="button"
                          >{pfUiT("ui.components.printingguide.115c57c946")}</button>
                          <button
                            onClick={() => handleUnitChange('cm')}
                            className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-sm cursor-pointer ${unit === 'cm' ? 'bg-bark-900 text-white' : 'text-bark-500 hover:bg-sand-100/50'}`}
                            type="button"
                          >
                            CM
                          </button>
                        </div>
                      </div>

                      {/* Slider Input to simulate measurements */}
                      <div className="space-y-1.5" id="cal-slider-row">
                        <div className="flex justify-between text-[10.5px] font-sans text-bark-800">
                          <span>{pfUiT("ui.components.printingguide.c900f52a6f")}</span>
                          <strong className="font-mono text-bark-900 bg-white border border-sand-200 px-1.5 py-0.5 rounded">
                            {measuredValue.toFixed(2)} {unit}
                          </strong>
                        </div>
                        <input
                          type="range"
                          min={unit === 'in' ? "1.75" : "4.30"}
                          max={unit === 'in' ? "2.25" : "5.70"}
                          step="0.01"
                          value={measuredValue}
                          onChange={(e) => setMeasuredValue(parseFloat(e.target.value))}
                          className="w-full accent-clay-605 cursor-ew-resize"
                          id="inp-measured-slider"
                        />
                        <div className="flex justify-between text-[8.5px] text-bark-400 font-mono">
                          <span>{unit === 'in' ? "1.75 in" : "4.30 cm"}</span>
                          <span className="text-clay-600 font-bold">Target: {unit === 'in' ? "2.0 in" : "5.0 cm"}</span>
                          <span>{unit === 'in' ? "2.25 in" : "5.70 cm"}</span>
                        </div>
                      </div>

                      {/* Dynamic Scaling Analysis Feedback */}
                      <div className="text-[10.5px] font-sans leading-relaxed space-y-1 pt-1.5 border-t border-sand-200/50" id="cal-feedback-box">
                        {isCalibrated ? (
                          <div className="flex items-center gap-1.5 text-emerald-800" id="cal-status-calibrated">
                            <Check className="w-3.5 h-3.5 bg-emerald-100 rounded-full p-0.5 text-emerald-700 inline shrink-0" />
                            <span><b>{pfUiT("ui.components.printingguide.fde88c9891")}</b>{pfUiT("ui.components.printingguide.979d3f7211")}</span>
                          </div>
                        ) : (
                          <div className="space-y-1.5" id="cal-status-misaligned">
                            <p className="text-rose-800 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 inline shrink-0" />
                              <span>{pfUiT("ui.components.printingguide.28c9293deb")}<b>{scalingAnalysis.recommendedPercentage}% Scale Required</b></span>
                            </p>
                            <p className="text-[10px] text-bark-600 leading-normal pl-4.5">
                              If your printed square measures {measuredValue.toFixed(2)}{unit} instead of {unit === 'in' ? "2.0" : "5.0"}{unit}, set your printer scale option to exactly <b className="font-mono text-bark-800 bg-white px-1 border border-sand-200 rounded">{scalingAnalysis.recommendedPercentage}%</b>{pfUiT("ui.components.printingguide.914f74e698")}</p>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-3 text-xs font-sans text-bark-750" id="step-info-2">
                    <p className="leading-relaxed">{pfUiT("ui.components.printingguide.0cccd09d36")}</p>
                    <div className="bg-sand-50 border border-sand-200 p-3 rounded space-y-2 text-[11px]" id="step-info-2-bullets">
                      <div className="flex items-start gap-1.5">
                        <strong className="font-mono text-clay-700">Method A (Recommended):</strong>
                        <span>{pfUiT("ui.components.printingguide.69537bf21a")}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <strong className="font-mono text-clay-700">Method B (Traditional):</strong>
                        <span>{pfUiT("ui.components.printingguide.40bb6721e8")}</span>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-3 text-xs font-sans text-bark-750" id="step-info-3">
                    <p className="leading-relaxed">{pfUiT("ui.components.printingguide.54858f145c")}</p>
                    <p className="leading-relaxed text-bark-600">{pfUiT("ui.components.printingguide.3b2f3af27f")}</p>
                    <div className="bg-sand-50 border border-sand-200 p-2.5 rounded flex items-center gap-2" id="grid-interactive-help">
                      <Info className="w-3.5 h-3.5 text-bark-500 shrink-0" />
                      <span className="text-[10px] text-bark-550 leading-tight">{pfUiT("ui.components.printingguide.99f1b0c10a")}<b>{pfUiT("ui.components.printingguide.2e4a15e565")}</b>{pfUiT("ui.components.printingguide.37e33dacc0")}</span>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-3 text-xs font-sans text-bark-750" id="step-info-4">
                    <p className="leading-relaxed">{pfUiT("ui.components.printingguide.4b1ce03ade")}</p>
                    <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-[4px] space-y-1.5" id="step-4-complete-box">
                      <h5 className="text-[11px] font-semibold text-emerald-900 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-700" />{pfUiT("ui.components.printingguide.ea829f7ea8")}</h5>
                      <p className="text-[10px] text-emerald-800 leading-relaxed">{pfUiT("ui.components.printingguide.2a93a61c42")}</p>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>

          </div>

          {/* Stepper Navigation Buttons */}
          <div className="flex justify-between items-center pt-2" id="step-nav-buttons">
            <button
              onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className={`flex items-center gap-1 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                currentStep === 0
                  ? 'bg-sand-50 border-sand-200 text-bark-300 cursor-not-allowed'
                  : 'bg-white border-sand-300 hover:bg-sand-50 text-bark-800'
              }`}
              type="button"
              id="btn-prev-step"
            >
              <ChevronLeft className="w-3.5 h-3.5" />{pfUiT("ui.components.printingguide.8fc4310a0b")}</button>

            <button
              onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
              disabled={currentStep === steps.length - 1}
              className={`flex items-center gap-1 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                currentStep === steps.length - 1
                  ? 'bg-sand-50 border-sand-200 text-bark-300 cursor-not-allowed'
                  : 'bg-bark-900 hover:bg-bark-800 border-bark-900 text-sand-50 shadow-3xs'
              }`}
              type="button"
              id="btn-next-step"
            >{pfUiT("ui.components.printingguide.e0343037e4")}<ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        {/* Right Side: Interactive Layout Grid Map */}
        <div className="lg:col-span-7 space-y-4" id="guide-grid-visualizer-col">

          <div className="bg-white border border-sand-200 rounded-[4px] p-4 space-y-3" id="visualizer-container">
            <div className="flex justify-between items-center" id="visualizer-header">
              <div>
                <span className="text-[9.5px] uppercase font-mono text-bark-400 font-bold block">{pfUiT("ui.components.printingguide.349da0dbf7")}</span>
                <h4 className="text-xs font-bold text-bark-900 font-sans uppercase tracking-wider flex items-center gap-1 mt-0.5">
                  <Grid className="w-3.5 h-3.5 text-bark-500" /> {selectedFormat} Assembly Blueprint Grid
                </h4>
              </div>

              <div className="text-[10px] text-bark-500 font-sans text-right flex items-center gap-3.5" id="assembled-totals-box">
                <button
                  type="button"
                  onClick={() => {
                    setIsPrintPreviewOpen(true);
                    // Pre-select appropriate tiling sheet if user currently has copyshop selected
                    if (selectedFormat === "A0") {
                      setSelectedFormat("Letter");
                    }
                  }}
                  className="bg-clay-700 hover:bg-clay-800 text-white text-[10.5px] font-sans font-bold px-3 py-1.5 rounded-[3px] flex items-center gap-1.5 transition-all shadow-4xs cursor-pointer hover:scale-102 active:scale-98 shrink-0"
                  id="btn-launch-print-preview"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{pfUiT("ui.components.printingguide.c3e742814b")}</span>
                </button>

                {selectedFormat !== "A0" ? (
                  <span>{pfUiT("ui.components.printingguide.7c8ce7dd59")}<b>{Object.keys(assembledPages).length}</b> / {totalGridPages}
                  </span>
                ) : (
                  <span className="text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded font-mono font-semibold">
                    Wide Roll (No Cuts)
                  </span>
                )}
              </div>
            </div>

            {/* Layout Grid Container */}
            {selectedFormat === "A0" ? (
              /* Copyshop layout - single wide roll roll */
              <div
                className="bg-sand-50 border border-sand-250 rounded-[4px] p-6 text-center space-y-4 relative overflow-hidden"
                id="copyshop-stage-mock"
              >
                <div className="absolute top-0 right-0 p-1.5 bg-indigo-700 text-white font-mono text-[8px] uppercase tracking-wider">{pfUiT("ui.components.printingguide.979b1e496b")}</div>
                <div className="w-full max-w-md mx-auto aspect-video bg-white border border-sand-300 rounded shadow-xs relative flex items-center justify-center p-4">

                  {/* Decorative sketch drawing */}
                  <svg className="absolute inset-0 w-full h-full text-indigo-100 opacity-70 p-4" fill="none" viewBox="0 0 100 60" preserveAspectRatio="none">
                    <path d="M5,10 C20,5 30,25 45,15 C60,5 75,35 90,20 C95,15 90,40 95,50" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5,1.5" />
                    <rect x="10" y="35" width="20" height="15" rx="1" stroke="currentColor" strokeWidth="1" />
                    <rect x="65" y="10" width="25" height="25" rx="1" stroke="currentColor" strokeWidth="1" />
                  </svg>

                  <div className="space-y-1.5 z-10 text-center">
                    <Printer className="w-8 h-8 text-indigo-700 mx-auto" />
                    <h5 className="font-serif text-xs font-bold text-bark-900">{selectedPattern} Copyshop Blueprint</h5>
                    <p className="text-[10px] text-bark-550 max-w-xs mx-auto leading-relaxed">
                      A continuous wide-format roll (36" x 48" or A0). Take this single-page file directly to local printing hubs or commercial plotters.
                    </p>
                  </div>
                </div>

                <div className="text-[11px] font-sans text-bark-600 max-w-sm mx-auto">{pfUiT("ui.components.printingguide.ea2adebb36")}<b>{pfUiT("ui.components.printingguide.80d3b4ba53")}</b>{pfUiT("ui.components.printingguide.ca53d42679")}</div>
              </div>
            ) : (
              /* Standard Tiled grid layout (Letter / A4) */
              <div className="space-y-4" id="tiled-grid-stage">

                {/* Visual Map of the pages */}
                <div
                  className="bg-sand-50/50 border border-sand-200/90 rounded-[4px] p-3 md:p-4 overflow-x-auto"
                  id="pages-visual-interactive-stage"
                >
                  <div
                    className="grid gap-1.5 mx-auto"
                    style={{
                      gridTemplateColumns: `repeat(${activePatternDetails.cols}, minmax(48px, 1fr))`,
                      maxWidth: `${activePatternDetails.cols * 64}px`
                    }}
                    id="grid-blueprint-container"
                  >
                    {Array.from({ length: activePatternDetails.rows }).map((_, r) => (
                      Array.from({ length: activePatternDetails.cols }).map((_, c) => {
                        const pageKey = `${r}-${c}`;
                        const isTaped = assembledPages[pageKey];
                        const overlaps = getPageOverlaps(r, c);
                        const hasPiece = overlaps.length > 0;
                        const isHovered = highlightedPage?.row === r && highlightedPage?.col === c;

                        // Pick color from overlapping pieces if any
                        const pieceColorClass = hasPiece ? overlaps[0].color : "bg-white border-sand-200";

                        return (
                          <div
                            key={pageKey}
                            onMouseEnter={() => setHighlightedPage({ row: r, col: c, overlaps })}
                            onClick={() => togglePageAssembled(r, c)}
                            className={`aspect-[3/4] rounded border relative flex flex-col justify-between p-1 cursor-pointer transition-all ${
                              isTaped
                                ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300/50'
                                : isHovered
                                  ? 'border-clay-500 scale-102 shadow-2xs z-10'
                                  : pieceColorClass
                            } erp-grid-cell`}
                            data-erp-page-coords={pageKey}
                            data-erp-page-taped={isTaped ? "true" : "false"}
                            id={`grid-cell-${pageKey}`}
                          >
                            {/* Page Label (e.g. 1A, 2C) */}
                            <div className="flex justify-between items-start" id={`cell-labels-${pageKey}`}>
                              <span className="font-mono text-[9px] font-bold text-bark-800">
                                {r + 1}{String.fromCharCode(65 + c)}
                              </span>

                              {isTaped && (
                                <Check className="w-3 h-3 text-emerald-700 bg-emerald-100 rounded-full p-0.5" />
                              )}
                            </div>

                            {/* Stylized pattern lines overlay in the cell */}
                            {hasPiece && !isTaped && (
                              <div className="w-full h-1/2 opacity-30 flex items-center justify-center">
                                <svg className="w-full h-full text-bark-600" viewBox="0 0 30 20" fill="none">
                                  <path d="M0,10 Q15,0 30,10" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5,1.5" />
                                </svg>
                              </div>
                            )}

                            {/* Miniature check indicator */}
                            <span className="text-[7.5px] text-bark-400 font-sans text-center mt-auto block select-none">
                              {isTaped ? "Taped" : "Tape"}
                            </span>
                          </div>
                        );
                      })
                    ))}
                  </div>
                </div>

                {/* Legend & Interactive cell detail read-out */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1" id="grid-legend-row">

                  {/* Selected cell details */}
                  <div className="border border-sand-200 rounded p-3 bg-sand-50/20 text-xs space-y-1.5" id="grid-cell-readout">
                    <span className="text-[9px] uppercase font-mono text-bark-400 font-bold block">{pfUiT("ui.components.printingguide.4193f64c22")}</span>
                    {highlightedPage ? (
                      <div className="space-y-1" id="cell-active-metadata">
                        <div className="flex justify-between items-baseline" id="cell-active-row1">
                          <strong className="text-bark-900 font-serif text-[13px]">
                            Page {highlightedPage.row + 1}{String.fromCharCode(65 + highlightedPage.col)}
                          </strong>
                          <span className="font-mono text-[9px] text-bark-500">
                            Row {highlightedPage.row + 1}, Col {highlightedPage.col + 1}
                          </span>
                        </div>
                        <div className="text-[10.5px] text-bark-600" id="cell-active-pieces">
                          {highlightedPage.overlaps.length > 0 ? (
                            <div>
                              <span>{pfUiT("ui.components.printingguide.2c4aec91ab")}</span>
                              <b className="text-clay-700">{highlightedPage.overlaps.map(o => o.name).join(', ')}</b>
                            </div>
                          ) : (
                            <span className="italic text-bark-450">{pfUiT("ui.components.printingguide.013c3c0caf")}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-bark-500 leading-normal italic">
                          Click page on map above to toggle "Taped &amp; Aligned" progress.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-bark-500 italic leading-relaxed py-2">
                        Hover or tap any coordinate page cell on the grid map to inspect overlapping pattern pieces &amp; cut lines.
                      </p>
                    )}
                  </div>

                  {/* Visual Pattern Pieces Color Legend */}
                  <div className="border border-sand-200 rounded p-3 bg-sand-50/20 text-xs space-y-2" id="grid-color-legend">
                    <span className="text-[9px] uppercase font-mono text-bark-400 font-bold block">{pfUiT("ui.components.printingguide.3a9106b69d")}</span>
                    <div className="grid grid-cols-2 gap-1.5 text-[10.5px]" id="legend-grid-rows">
                      {activePatternDetails.pieces.map((p, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-bark-750 font-sans truncate">
                          <span className={`w-3.5 h-3.5 rounded border ${p.color} shrink-0 block`} />
                          <span className="truncate">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            )}

          </div>

          {/* Quick instructions for assembly */}
          <div className="bg-sand-50/60 border border-sand-200 rounded-[4px] p-4 flex items-start gap-3" id="guide-sewing-pro-tip">
            <Printer className="w-5 h-5 text-clay-650 mt-0.5 shrink-0 animate-pulse" />
            <div>
              <h5 className="text-xs font-semibold text-bark-900 font-serif">{pfUiT("ui.components.printingguide.c049d7848c")}</h5>
              <p className="text-[11px] text-bark-600 leading-relaxed mt-0.5">{pfUiT("ui.components.printingguide.008853bac6")}</p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
