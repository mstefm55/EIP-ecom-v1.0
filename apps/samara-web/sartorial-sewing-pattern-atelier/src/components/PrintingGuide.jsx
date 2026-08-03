import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Printer, Scissors, Layers, Check, RefreshCw, Ruler,
  Grid, AlertTriangle, ChevronLeft, ChevronRight, HelpCircle,
  FileText, ArrowRight, Settings, Info, Square, Eye, Play, Pause, RotateCcw, ZoomIn, CheckCircle2
} from 'lucide-react';

// Database of SVG paths representing actual garment pattern pieces layout
const PATTERN_PATHS = {
  "Aurelia Wrap Dress": [
    // Front Bodice (cols 1-2, rows 0-1 => x: 100 to 300, y: 0 to 260)
    {
      id: "front-bodice",
      name: "Front Bodice",
      path: "M 120,40 Q 180,20 220,50 L 280,180 Q 250,240 180,240 L 120,240 Q 150,150 120,40 Z",
      grainline: "M 180,90 L 180,190",
      label: "Front Bodice - Cut 2",
      labelPos: { x: 180, y: 140 }
    },
    // Sleeve Right (cols 3-4, rows 0-1 => x: 300 to 500, y: 0 to 260)
    {
      id: "sleeve-right",
      name: "Sleeve Right",
      path: "M 320,180 Q 350,50 410,50 Q 470,50 480,180 L 450,230 L 350,230 Z",
      grainline: "M 410,100 L 410,200",
      label: "Sleeve Right - Cut 1",
      labelPos: { x: 410, y: 150 }
    },
    // Sleeve Left (cols 0-1, rows 1-2 => x: 0 to 200, y: 130 to 390)
    {
      id: "sleeve-left",
      name: "Sleeve Left",
      path: "M 20,280 Q 50,150 110,150 Q 170,150 180,280 L 150,330 L 50,330 Z",
      grainline: "M 110,200 L 110,300",
      label: "Sleeve Left - Cut 1",
      labelPos: { x: 110, y: 250 }
    },
    // Skirt Back Panel (cols 2-4, rows 2-5 => x: 200 to 500, y: 260 to 780)
    {
      id: "skirt-back",
      name: "Skirt Back Panel",
      path: "M 250,280 Q 350,270 450,280 L 480,740 Q 350,760 220,740 Z",
      grainline: "M 350,350 L 350,650",
      label: "Skirt Back Panel - Fold",
      labelPos: { x: 350, y: 500 }
    },
    // Waist Ties (cols 0-1, rows 3-5 => x: 0 to 200, y: 390 to 780)
    {
      id: "waist-ties",
      name: "Waist Ties",
      path: "M 30,420 L 170,420 L 170,750 L 30,750 Z",
      grainline: "M 100,480 L 100,680",
      label: "Waist Ties - Cut 4",
      labelPos: { x: 100, y: 580 }
    }
  ],
  "Atelier Trench Coat": [
    // Double Breasted Front (cols 0-1, rows 0-4 => x: 0 to 200, y: 0 to 650)
    {
      id: "trench-front",
      name: "Double Breasted Front",
      path: "M 40,50 L 160,50 L 180,350 L 160,620 L 40,620 L 60,350 Z",
      grainline: "M 110,150 L 110,500",
      label: "Trench Front - Cut 2",
      labelPos: { x: 110, y: 300 }
    },
    // Storm Flap (cols 2-3, rows 0-1 => x: 200 to 400, y: 0 to 260)
    {
      id: "storm-flap",
      name: "Storm Flap",
      path: "M 220,40 L 380,40 L 380,180 Q 300,240 220,180 Z",
      grainline: "M 300,80 L 300,160",
      label: "Storm Flap - Cut 1",
      labelPos: { x: 300, y: 130 }
    },
    // Back Storm Shield (cols 4-5, rows 0-1 => x: 400 to 600, y: 0 to 260)
    {
      id: "back-shield",
      name: "Back Storm Shield",
      path: "M 420,40 L 580,40 L 580,200 L 420,200 Z",
      grainline: "M 500,80 L 500,160",
      label: "Back Storm Shield",
      labelPos: { x: 500, y: 120 }
    },
    // Two-Piece Sleeve A (cols 2-3, rows 2-4 => x: 200 to 400, y: 260 to 650)
    {
      id: "sleeve-a",
      name: "Two-Piece Sleeve A",
      path: "M 220,380 Q 300,280 380,380 L 360,620 L 240,620 Z",
      grainline: "M 300,420 L 300,580",
      label: "Sleeve Upper - Cut 2",
      labelPos: { x: 300, y: 500 }
    },
    // Two-Piece Sleeve B (cols 4-5, rows 2-4 => x: 400 to 600, y: 260 to 650)
    {
      id: "sleeve-b",
      name: "Two-Piece Sleeve B",
      path: "M 440,380 Q 500,310 560,380 L 540,620 L 460,620 Z",
      grainline: "M 500,420 L 500,580",
      label: "Sleeve Under - Cut 2",
      labelPos: { x: 500, y: 500 }
    },
    // Coat Back Panel (cols 1-4, rows 5-7 => x: 100 to 500, y: 650 to 1040)
    {
      id: "coat-back",
      name: "Coat Back Panel",
      path: "M 180,680 L 420,680 L 480,1010 L 120,1010 Z",
      grainline: "M 300,720 L 300,960",
      label: "Coat Back - Fold",
      labelPos: { x: 300, y: 840 }
    },
    // Collar & lapel facing (cols 0, 5, rows 5-7)
    {
      id: "collar-facing",
      name: "Collar & Lapel facing",
      path: "M 20,680 L 80,680 L 80,950 Q 50,1010 20,950 Z",
      grainline: "M 50,720 L 50,900",
      label: "Collar Facing - Cut 2",
      labelPos: { x: 50, y: 820 }
    }
  ],
  "Renaissance Pleated Bodice": [
    // Center Front Lace Panel (cols 1-2, rows 0-1 => x: 100 to 300, y: 0 to 260)
    {
      id: "bodice-front",
      name: "Center Front Lace Panel",
      path: "M 130,40 L 270,40 L 250,230 L 150,230 Z",
      grainline: "M 200,80 L 200,190",
      label: "CF Bodice - Cut 1",
      labelPos: { x: 200, y: 130 }
    },
    // Side Front Bodice (cols 0, rows 0-3 => x: 0 to 100, y: 0 to 520)
    {
      id: "bodice-side-front",
      name: "Side Front Bodice",
      path: "M 20,40 L 80,40 L 80,480 L 20,480 Z",
      grainline: "M 50,100 L 50,420",
      label: "Side Front - Cut 2",
      labelPos: { x: 50, y: 260 }
    },
    // Side Back Bodice (cols 3, rows 0-3 => x: 300 to 400, y: 0 to 520)
    {
      id: "bodice-side-back",
      name: "Side Back Bodice",
      path: "M 320,40 L 380,40 L 380,480 L 320,480 Z",
      grainline: "M 350,100 L 350,420",
      label: "Side Back - Cut 2",
      labelPos: { x: 350, y: 260 }
    },
    // Strap & Darts facing (cols 1-2, rows 2-3 => x: 100 to 300, y: 260 to 520)
    {
      id: "bodice-strap",
      name: "Strap & Darts facing",
      path: "M 120,300 Q 200,280 280,300 L 260,480 L 140,480 Z",
      grainline: "M 200,340 L 200,440",
      label: "Strap Facing - Cut 4",
      labelPos: { x: 200, y: 390 }
    }
  ]
};

export default function PrintingGuide({
  initialPattern = "Aurelia Wrap Dress",
  initialFormat = "Letter",
  onAssemblyComplete
}) {
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
  const PATTERNS_DB = {
    "Aurelia Wrap Dress": {
      cols: 5,
      rows: 6,
      pieces: [
        { name: "Front Bodice", color: "border-clay-400 bg-clay-50/40", coords: [[0, 1], [0, 2], [1, 1], [1, 2]] },
        { name: "Sleeve Right", color: "border-emerald-400 bg-emerald-50/40", coords: [[0, 3], [0, 4], [1, 3], [1, 4]] },
        { name: "Sleeve Left", color: "border-emerald-400 bg-emerald-50/40", coords: [[1, 0], [2, 0], [1, 1], [2, 1]] },
        { name: "Skirt Back Panel", color: "border-indigo-400 bg-indigo-50/40", coords: [[2, 2], [2, 3], [2, 4], [3, 2], [3, 3], [3, 4], [4, 2], [4, 3], [4, 4], [5, 2], [5, 3], [5, 4]] },
        { name: "Waist Ties", color: "border-amber-400 bg-amber-50/40", coords: [[3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1]] }
      ],
      difficulty: "Intermediate",
      estTime: "45 mins"
    },
    "Atelier Trench Coat": {
      cols: 6,
      rows: 8,
      pieces: [
        { name: "Double Breasted Front", color: "border-clay-400 bg-clay-50/40", coords: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0], [4, 1]] },
        { name: "Storm Flap", color: "border-amber-400 bg-amber-50/40", coords: [[0, 2], [0, 3], [1, 2], [1, 3]] },
        { name: "Back Storm Shield", color: "border-indigo-400 bg-indigo-50/40", coords: [[0, 4], [0, 5], [1, 4], [1, 5]] },
        { name: "Two-Piece Sleeve A", color: "border-emerald-400 bg-emerald-50/40", coords: [[2, 2], [2, 3], [3, 2], [3, 3], [4, 2], [4, 3]] },
        { name: "Two-Piece Sleeve B", color: "border-teal-400 bg-teal-50/40", coords: [[2, 4], [2, 5], [3, 4], [3, 5], [4, 4], [4, 5]] },
        { name: "Coat Back Panel", color: "border-purple-400 bg-purple-50/40", coords: [[5, 1], [5, 2], [5, 3], [5, 4], [6, 1], [6, 2], [6, 3], [6, 4], [7, 1], [7, 2], [7, 3], [7, 4]] },
        { name: "Collar & Lapel facing", color: "border-rose-400 bg-rose-50/40", coords: [[5, 0], [6, 0], [7, 0], [5, 5], [6, 5], [7, 5]] }
      ],
      difficulty: "Advanced",
      estTime: "1 hr 15 mins"
    },
    "Renaissance Pleated Bodice": {
      cols: 4,
      rows: 4,
      pieces: [
        { name: "Center Front Lace Panel", color: "border-rose-400 bg-rose-50/40", coords: [[0, 1], [0, 2], [1, 1], [1, 2]] },
        { name: "Side Front Bodice", color: "border-clay-400 bg-clay-50/40", coords: [[0, 0], [1, 0], [2, 0], [3, 0]] },
        { name: "Side Back Bodice", color: "border-indigo-400 bg-indigo-50/40", coords: [[0, 3], [1, 3], [2, 3], [3, 3]] },
        { name: "Strap & Darts facing", color: "border-amber-400 bg-amber-50/40", coords: [[2, 1], [2, 2], [3, 1], [3, 2]] }
      ],
      difficulty: "Beginner",
      estTime: "25 mins"
    }
  };

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
        message: "ERP content injection configuration successfully updated."
      };
    };

    return () => {
      try {
        delete window.setERPPrintingGuideConfig;
      } catch {}
    };
  }, [selectedPattern, selectedFormat]);

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
  const totalGridPages = useMemo(() => {
    if (selectedFormat === "A0") return 1; // Copyshop is a single continuous blueprint sheet
    return activePatternDetails.cols * activePatternDetails.rows;
  }, [selectedFormat, activePatternDetails]);

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

  const steps = [
    {
      title: "Settings & Setup",
      icon: Settings,
      description: "Configure print scale & select blueprint layout standard."
    },
    {
      title: "Calibration Check",
      icon: Ruler,
      description: "Verify the 2-inch test square with absolute physical precision."
    },
    {
      title: "Trim Borders",
      icon: Scissors,
      description: "Slice boundaries along alignment lines to ensure accurate overlap."
    },
    {
      title: "Grid & Piece Mapping",
      icon: Grid,
      description: "Interactive visual coordinate table to align your printed pattern pages."
    },
    {
      title: "Seaming & Assembly",
      icon: Layers,
      description: "Tape and slice individual master components for fabric pinning."
    }
  ];

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
          <span className="text-[10px] uppercase font-mono text-clay-700 bg-clay-50/80 px-2 py-0.5 rounded font-bold tracking-wider">
            Atelier Technical Library
          </span>
          <h3 className="text-xl font-serif text-bark-900 font-semibold mt-1">
            Interactive PDF Sewing Pattern Assembly Guide
          </h3>
          <p className="text-xs text-bark-500 font-sans mt-0.5">
            Step-by-step mastercalibrations and visual grids mapped to your local device.
          </p>
        </div>

        {/* Dynamic ERP test console widget */}
        <div className="bg-sand-50/80 border border-sand-200 p-2.5 rounded flex items-center gap-2 text-[10.5px] font-sans shrink-0" id="erp-profile-quick-select">
          <span className="font-mono font-bold text-bark-500 uppercase text-[9.5px]">Mock ERP:</span>
          <button
            onClick={simulationProfiles.standardLetter}
            className="bg-white hover:bg-sand-100/50 text-bark-800 border border-sand-250 text-[10px] px-1.5 py-0.5 rounded cursor-pointer font-sans"
            type="button"
          >
            Letter Perfect
          </button>
          <button
            onClick={simulationProfiles.calibrationError}
            className="bg-white hover:bg-rose-50 text-rose-800 border border-rose-200 text-[10px] px-1.5 py-0.5 rounded cursor-pointer font-sans"
            type="button"
          >
            Scale Err
          </button>
          <button
            onClick={simulationProfiles.copyshopReady}
            className="bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] px-1.5 py-0.5 rounded cursor-pointer font-sans"
            type="button"
          >
            A0 Roll
          </button>
        </div>
      </div>

      {/* 2. Interactive Selections */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-sand-50/30 border border-sand-150 rounded-[4px] p-4" id="guide-form-selections">

        {/* Pattern Blueprint Choice */}
        <div className="md:col-span-5 space-y-1.5" id="field-pattern-select">
          <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-bark-450 block">
            Select Sewing Pattern:
          </label>
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
            <span>Level: <b className="text-bark-800">{activePatternDetails.difficulty}</b></span>
            <span>•</span>
            <span>Est. Assemble: <b className="text-bark-800">{activePatternDetails.estTime}</b></span>
          </div>
        </div>

        {/* Paper Format Choice */}
        <div className="md:col-span-4 space-y-1.5" id="field-format-select">
          <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-bark-450 block">
            Select Paper Output Format:
          </label>
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
            <span className="text-[9px] uppercase font-mono text-bark-400 font-bold block">Taped Pages Progress</span>
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
              >
                Tape All Pages
              </button>
              <button
                onClick={handleResetGrid}
                className="bg-white hover:bg-rose-50 text-rose-700 border border-sand-200 hover:border-rose-200 p-1 rounded transition-all cursor-pointer"
                type="button"
                title="Reset assembly progress"
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
                      <span>Always open PDF blueprints in **Adobe Reader** or your system native PDF viewer. Avoiding mobile browser quick-previews which often compress scaling factors.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-clay-500 mt-1.5 shrink-0" />
                      <span>Ensure your print settings select **Custom Scale: 100%** or **Actual Size**. Do not use "Fit to Page" or "Shrink oversized pages" under any circumstances.</span>
                    </div>
                  </div>
                )}

                {currentStep === 1 && (
                  <div className="space-y-3" id="step-info-1">
                    <p className="text-xs text-bark-700 leading-relaxed font-sans">
                      Every professional blueprint has a calibration square on page one. Print only **Page 1** first, and check its physical dimensions with a wooden or plastic tailor's ruler.
                    </p>

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
                          <Ruler className="w-3.5 h-3.5 text-bark-600" /> Metric Calibration Simulator
                        </span>

                        {/* Unit Toggles */}
                        <div className="flex bg-white border border-sand-250 rounded-[3px] overflow-hidden p-0.5" id="unit-toggles">
                          <button
                            onClick={() => handleUnitChange('in')}
                            className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-sm cursor-pointer ${unit === 'in' ? 'bg-bark-900 text-white' : 'text-bark-500 hover:bg-sand-100/50'}`}
                            type="button"
                          >
                            Inches
                          </button>
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
                          <span>Your Measured Square Size:</span>
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
                            <span><b>Perfect Scale!</b> Your printer aligns to 100% precision. Proceed to printing remainder pages.</span>
                          </div>
                        ) : (
                          <div className="space-y-1.5" id="cal-status-misaligned">
                            <p className="text-rose-800 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 inline shrink-0" />
                              <span>Scale error detected: <b>{scalingAnalysis.recommendedPercentage}% Scale Required</b></span>
                            </p>
                            <p className="text-[10px] text-bark-600 leading-normal pl-4.5">
                              If your printed square measures {measuredValue.toFixed(2)}{unit} instead of {unit === 'in' ? "2.0" : "5.0"}{unit}, set your printer scale option to exactly <b className="font-mono text-bark-800 bg-white px-1 border border-sand-200 rounded">{scalingAnalysis.recommendedPercentage}%</b> and reprint Page 1.
                            </p>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-3 text-xs font-sans text-bark-750" id="step-info-2">
                    <p className="leading-relaxed">
                      To join pages without gaps, standard blueprints print with a 1/2" margin border around all pages. Choose a cutting template:
                    </p>
                    <div className="bg-sand-50 border border-sand-200 p-3 rounded space-y-2 text-[11px]" id="step-info-2-bullets">
                      <div className="flex items-start gap-1.5">
                        <strong className="font-mono text-clay-700">Method A (Recommended):</strong>
                        <span>Slice off the **top** and **right** margins of every page. Leave the bottom and left intact to act as pasting anchors.</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <strong className="font-mono text-clay-700">Method B (Traditional):</strong>
                        <span>Fold along the crop indicators and overlay directly. Avoids scissors, but builds thickness at corners.</span>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-3 text-xs font-sans text-bark-750" id="step-info-3">
                    <p className="leading-relaxed">
                      Layout all pages in rows and columns according to their coordinates. Row 1 starts with Page 1A, 1B, 1C etc. Row 2 is 2A, 2B...
                    </p>
                    <p className="leading-relaxed text-bark-600">
                      Hover or tap any page cell in the interactive right grid map. Each cell highlights which paper coordinate matches which custom garment panel!
                    </p>
                    <div className="bg-sand-50 border border-sand-200 p-2.5 rounded flex items-center gap-2" id="grid-interactive-help">
                      <Info className="w-3.5 h-3.5 text-bark-500 shrink-0" />
                      <span className="text-[10px] text-bark-550 leading-tight">
                        Tap a coordinate page cell to toggle the <b>Taped Check</b>. Yellow panels show overlapping fabric blueprints.
                      </span>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-3 text-xs font-sans text-bark-750" id="step-info-4">
                    <p className="leading-relaxed">
                      Now tape adjacent edges using high-quality matte finish clear tape. Tape along the lines first, then secure corner intersections.
                    </p>
                    <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-[4px] space-y-1.5" id="step-4-complete-box">
                      <h5 className="text-[11px] font-semibold text-emerald-900 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-700" /> Fabric Pinning Ready
                      </h5>
                      <p className="text-[10px] text-emerald-800 leading-relaxed">
                        Once taped, locate the solid black outline corresponding to your size. Cut along the size lines, lay flat on your grainline aligned fabric, and pin or weigh for cutting.
                      </p>
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
              <ChevronLeft className="w-3.5 h-3.5" /> Previous Step
            </button>

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
            >
              Next Step <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        {/* Right Side: Interactive Layout Grid Map */}
        <div className="lg:col-span-7 space-y-4" id="guide-grid-visualizer-col">

          <div className="bg-white border border-sand-200 rounded-[4px] p-4 space-y-3" id="visualizer-container">
            <div className="flex justify-between items-center" id="visualizer-header">
              <div>
                <span className="text-[9.5px] uppercase font-mono text-bark-400 font-bold block">Layout Map View</span>
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
                  <span>🔍 Visual Print Preview</span>
                </button>

                {selectedFormat !== "A0" ? (
                  <span>
                    Taped sheets: <b>{Object.keys(assembledPages).length}</b> / {totalGridPages}
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
                <div className="absolute top-0 right-0 p-1.5 bg-indigo-700 text-white font-mono text-[8px] uppercase tracking-wider">A0 Copyshop Format</div>
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

                <div className="text-[11px] font-sans text-bark-600 max-w-sm mx-auto">
                  💡 <b>No cutting or taping required.</b> Simply unroll the paper directly onto your cutting table, weigh down the corners, and place pattern weights directly over your fabric.
                </div>
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
                    <span className="text-[9px] uppercase font-mono text-bark-400 font-bold block">Inspect Coordinate</span>
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
                              <span>Overlaps: </span>
                              <b className="text-clay-700">{highlightedPage.overlaps.map(o => o.name).join(', ')}</b>
                            </div>
                          ) : (
                            <span className="italic text-bark-450">Empty border margin sheet</span>
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
                    <span className="text-[9px] uppercase font-mono text-bark-400 font-bold block">Garment Pieces Key</span>
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
              <h5 className="text-xs font-semibold text-bark-900 font-serif">Tailoring Advice: Grainline Precision</h5>
              <p className="text-[11px] text-bark-600 leading-relaxed mt-0.5">
                Always align the printed solid arrows with the grainline direction of your fabric before slicing the textile. Biased drapes, as seen on the **Aurelia Dress**, must hang at 45 degrees to preserve the designer's structural drop.
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
