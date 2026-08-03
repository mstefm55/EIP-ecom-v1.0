/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  HelpCircle, Sparkles, ChevronDown, Check, Ruler, Scissors,
  Info, Layers, AlertCircle, RefreshCw, Star, Compass,
  Cloud, UploadCloud, DownloadCloud, FileText, Trash2, LogIn, LogOut, X, Shirt
} from 'lucide-react';
import { MASTER_SIZING_TABLE } from '../data.js';
import { MEASUREMENT_POSITIONS } from '../data_positions.js';
import dressImg from '../assets/images/pattern_dress_1782223486101.jpg';
import FabricYardageCalculator from './FabricYardageCalculator';
import ArOverlayVisualizer from './ArOverlayVisualizer';
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

const getMatchingRow = (position, valueInUnit, currentUnit) => {
  const valueInCm = currentUnit === 'cm' ? valueInUnit : valueInUnit * 2.54;

  let closestRow = position.matrix[0];
  let minDiff = Infinity;

  for (const row of position.matrix) {
    const rangeStr = row.range;
    const clean = rangeStr.replace(' cm', '');
    const [minRange, maxRange] = clean.split('-').map(parseFloat);

    // Check if within bounds
    if (valueInCm >= minRange && valueInCm <= maxRange) {
      return row;
    }

    // Else check midpoint diff
    const midpoint = (minRange + maxRange) / 2;
    const diff = Math.abs(midpoint - valueInCm);
    if (diff < minDiff) {
      minDiff = diff;
      closestRow = row;
    }
  }
  return closestRow;
};

const LEGEND_COORDINATES = {
  1: { left: '152px', top: '48px' },
  2: { left: '104px', top: '60px' },
  3: { left: '152px', top: '119px' },
  4: { left: '12px', top: '168px' }, // Positioned beautifully on the left side of button 4
  5: { left: '152px', top: '222px' },
  6: { left: '152px', top: '286px' },
  7: { left: '152px', top: '339px' },
};

const LEGEND_TRANSFORMS = {
  1: 'translateX(-75%)',
  2: 'translateX(-10%)',
  3: 'translateX(-75%)',
  4: 'translateX(0%)',
  5: 'translateX(-75%)',
  6: 'translateX(-75%)',
  7: 'translateX(-75%)',
};

// Help diagnostics calculation for live garment ease analysis
const getFitDiagnostics = (style, bVal, wVal, hVal, htVal) => {
  let bustEase = 0;
  let waistEase = 0;
  let hipsEase = 0;
  let status = 'Tailored Balance';
  let badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200/60';
  let analysisText = '';
  let patterntip = '';

  let bustWarning = false;
  let waistWarning = false;
  let hipsWarning = false;

  let bustFit = 'Perfect';
  let waistFit = 'Perfect';
  let hipsFit = 'Perfect';

  if (style === 'dress') {
    bustEase = 3;
    waistEase = 1.2;
    hipsEase = 4.5;

    const bRatio = bVal / 36.0;
    const wRatio = wVal / 28.0;
    const hRatio = hVal / 38.0;

    if (wRatio > bRatio * 1.08 || wRatio > hRatio * 1.08) {
      status = 'Tension Alert';
      badgeClass = 'bg-amber-50 text-amber-800 border-amber-200/60';
      waistWarning = true;
      waistFit = 'Snug (+0.4″)';
      analysisText = 'The wrap waist closure might have limited overlap. To ensure a comfortable drape that doesn’t pull at the bust, consider adding small side seam extensions or slashing the back bodice paper piece.';
      patterntip = 'Couture Tip: Add 1/2″ ease directly to the side bodice seam line for a relaxed wrap contour.';
    } else if (bRatio > 1.15) {
      status = 'Full Bust Adj.';
      badgeClass = 'bg-clay-50 text-clay-800 border-clay-200/60';
      bustWarning = true;
      bustFit = 'High Tension';
      analysisText = 'The chest contour exceeds typical ease margins. We suggest applying a 1″ Full Bust Adjustment (FBA) at the bust apex circle to prevent gapping along the front wrap lapel.';
      patterntip = 'Couture Tip: Slash the pattern piece through the bust point and spread by 3/4″.';
    } else {
      status = 'Ideal Ease';
      badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200/60';
      analysisText = 'Bespoke proportions matched! The Aurelia Wrap Dress will wrap elegantly, with perfect flow around the hips and balanced shoulder drape. The selected linen or silk satin will drape fluidly.';
      patterntip = 'Couture Tip: Use lightweight fusibles along the front wrap neckline facing to prevent stretching on the bias.';
    }
  } else if (style === 'trench') {
    bustEase = 6.2;
    waistEase = 5.0;
    hipsEase = 7.5;

    const bRatio = bVal / 36.0;
    const hRatio = hVal / 38.0;

    if (bRatio > 1.2 || hRatio > 1.2) {
      status = 'Oversized Look';
      badgeClass = 'bg-clay-50 text-clay-800 border-clay-200/60';
      analysisText = 'The heavy utility trench will sit comfortably as structural outerwear. Note that double-breasted buttons allow 2″ of sizing tolerance simply by adjusting the button positioning during assembly!';
      patterntip = 'Couture Tip: Shift button markers 1/2″ outward to gain extra breathing room across the back shoulder blade.';
    } else {
      status = 'Ideal Outer Ease';
      badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200/60';
      analysisText = 'Superb trench profile! The drop shoulder sits with premium relaxed volume, perfect to layer over knitwear. The structured waist belt will cinch easily without bunching heavy wool or denim fabric.';
      patterntip = 'Couture Tip: Grade the collar pieces down slightly if using high-weight denim to keep the lapel points crisp.';
    }
  } else if (style === 'trousers') {
    bustEase = 0;
    waistEase = 0.8;
    hipsEase = 5.5;

    const wRatio = wVal / 28.0;
    const hRatio = hVal / 38.0;

    if (wRatio > hRatio * 1.05) {
      status = 'Waist Release';
      badgeClass = 'bg-amber-50 text-amber-800 border-amber-200/60';
      waistWarning = true;
      waistFit = 'Tight';
      analysisText = 'High-rise Palazzo trousers require precise waist margins. To prevent the front pleats from spreading open, expand the waistband by 1″ and release 1/4″ from the pocket slant seams.';
      patterntip = 'Couture Tip: Ease the waistband onto the trousers body or introduce back-waist elastic casing.';
    } else if (hRatio > 1.15) {
      status = 'Seat Expansion';
      badgeClass = 'bg-clay-50 text-clay-800 border-clay-200/60';
      hipsWarning = true;
      hipsFit = 'Snug';
      analysisText = 'The hip seat area is snug. Palazzo pants rely on sweeping horizontal volumes; we recommend grading up one size at the side seams starting 2″ below the waistline.';
      patterntip = 'Couture Tip: Increase the crotch curve extension slightly to ensure optimal sitting ease.';
    } else {
      status = 'Sleek Drape';
      badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200/60';
      analysisText = 'Perfect trouser alignment! The palazzo leg flows vertically with excellent drape line straight from the hips. Pleats will remain pressed and clean without bowing outward.';
      patterntip = 'Couture Tip: Stitch the front pocket bags using lightweight lining to prevent bulk over the hips.';
    }
  } else if (style === 'blouse') {
    bustEase = 5.0;
    waistEase = 3.5;
    hipsEase = 0;

    const bRatio = bVal / 36.0;

    if (bRatio > 1.15) {
      status = 'Cowl Adjustment';
      badgeClass = 'bg-amber-50 text-amber-800 border-amber-200/60';
      bustWarning = true;
      bustFit = 'Restricted';
      analysisText = 'Cowl gathers might drape slightly shallower across the neckline. We advise adding 1/2″ in depth to the front cowl fold line so it swings freely without pulling at the armhole.';
      patterntip = 'Couture Tip: Cut this blouse strictly on the bias (45 degrees) to allow the fabric to stretch naturally over the apex.';
    } else {
      status = 'Fluid Cowl';
      badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200/60';
      analysisText = 'Magnificent fluid neckline gathers! The cowl will ripple softly over the chest with beautiful negative space. Perfectly suited for silk satin or tencel crêpe fabrics.';
      patterntip = 'Couture Tip: Finish the back boatneck using a narrow bias-cut binding for a high-end clean look.';
    }
  }

  return {
    status,
    badgeClass,
    analysisText,
    patterntip,
    bustEase,
    waistEase,
    hipsEase,
    bustFit,
    waistFit,
    hipsFit,
    bustWarning,
    waistWarning,
    hipsWarning
  };
};

export default function MannequinGuide({ activeRecommendedSize, onRecommendedSizeChange } = {}) {
  const [activeId, setActiveId] = useState(3); // Default to bust girth for instant engagement

  // Read saved profile for initialization
  const initialProfile = useMemo(() => {
    try {
      const saved = localStorage.getItem('sartorial_sizing_profile');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }, []);

  const [unit, setUnit] = useState(() => initialProfile?.unit || 'in');
  const [activeTab, setActiveTab] = useState('mannequin'); // 'mannequin' | 'calculator'
  const [garmentFocus, setGarmentFocus] = useState(() => initialProfile?.garmentFocus || 'tops'); // 'tops' | 'bottoms' | 'balanced'

  // Interactive Garment Customizer States
  const [selectedGarmentStyle, setSelectedGarmentStyle] = useState('dress'); // 'none' | 'dress' | 'trench' | 'trousers' | 'blouse'
  const [garmentColor, setGarmentColor] = useState('#ba6446'); // terracotta
  const [garmentFabric, setGarmentFabric] = useState('linen'); // 'linen' | 'silk' | 'wool' | 'denim'

  // INDIVIDUAL MEASUREMENT STATES (Initialized to standard imperial values or loaded from profile)
  const [neck, setNeck] = useState(() => initialProfile?.neck !== undefined ? initialProfile.neck : 13.5);
  const [shoulder, setShoulder] = useState(() => initialProfile?.shoulder !== undefined ? initialProfile.shoulder : 4.7);
  const [bust, setBust] = useState(() => initialProfile?.bust !== undefined ? initialProfile.bust : 36.0);
  const [frontWaist, setFrontWaist] = useState(() => initialProfile?.frontWaist !== undefined ? initialProfile.frontWaist : 16.2);
  const [waist, setWaist] = useState(() => initialProfile?.waist !== undefined ? initialProfile.waist : 28.0);
  const [hips, setHips] = useState(() => initialProfile?.hips !== undefined ? initialProfile.hips : 38.0);
  const [inseam, setInseam] = useState(() => initialProfile?.inseam !== undefined ? initialProfile.inseam : 31.0);
  const [height, setHeight] = useState(() => initialProfile?.height !== undefined ? initialProfile.height : 65.0); // 5'5"

  const getImperialValue = (val) => {
    return unit === 'cm' ? val / 2.54 : val;
  };

  // ANIMATED/DISPLAYED MEASUREMENT METRICS (Smoothed out using LERP for graceful morphing)
  const animMetricsRef = useRef({
    neck: initialProfile?.neck !== undefined ? initialProfile.neck : 13.5,
    shoulder: initialProfile?.shoulder !== undefined ? initialProfile.shoulder : 4.7,
    bust: initialProfile?.bust !== undefined ? initialProfile.bust : 36.0,
    frontWaist: initialProfile?.frontWaist !== undefined ? initialProfile.frontWaist : 16.2,
    waist: initialProfile?.waist !== undefined ? initialProfile.waist : 28.0,
    hips: initialProfile?.hips !== undefined ? initialProfile.hips : 38.0,
    inseam: initialProfile?.inseam !== undefined ? initialProfile.inseam : 31.0,
    height: initialProfile?.height !== undefined ? initialProfile.height : 65.0,
  });

  const [animMetrics, setAnimMetrics] = useState(animMetricsRef.current);
  const prevUnitRef = useRef(unit);

  useEffect(() => {
    // 1. If unit changed, convert immediately to prevent extreme size distortion
    if (prevUnitRef.current !== unit) {
      const factor = unit === 'cm' ? 2.54 : 1 / 2.54;
      const converted = {
        neck: animMetricsRef.current.neck * factor,
        shoulder: animMetricsRef.current.shoulder * factor,
        bust: animMetricsRef.current.bust * factor,
        frontWaist: animMetricsRef.current.frontWaist * factor,
        waist: animMetricsRef.current.waist * factor,
        hips: animMetricsRef.current.hips * factor,
        inseam: animMetricsRef.current.inseam * factor,
        height: animMetricsRef.current.height * factor,
      };
      animMetricsRef.current = converted;
      setAnimMetrics(converted);
      prevUnitRef.current = unit;
      return;
    }

    let animationFrameId;

    const update = () => {
      const targets = { neck, shoulder, bust, frontWaist, waist, hips, inseam, height };
      const current = { ...animMetricsRef.current };
      const next = {};
      let changed = false;

      const keys = ['neck', 'shoulder', 'bust', 'frontWaist', 'waist', 'hips', 'inseam', 'height'];
      for (const key of keys) {
        const targetVal = targets[key];
        const currentVal = current[key];
        const diff = targetVal - currentVal;

        if (Math.abs(diff) > 0.005) {
          next[key] = currentVal + diff * 0.15; // Smooth fluid ease-out step
          changed = true;
        } else {
          next[key] = targetVal;
        }
      }

      if (changed) {
        animMetricsRef.current = next;
        setAnimMetrics(next);
        animationFrameId = requestAnimationFrame(update);
      } else {
        animMetricsRef.current = targets;
        setAnimMetrics(targets);
      }
    };

    animationFrameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [neck, shoulder, bust, frontWaist, waist, hips, inseam, height, unit]);

  // Apply a standard size preset to the mannequin with scaled helper proportions
  const handleApplySizingPreset = (row) => {
    const multiplier = unit === 'cm' ? 2.54 : 1;
    setBust(parseFloat((row.bust * multiplier).toFixed(1)));
    setWaist(parseFloat((row.waist * multiplier).toFixed(1)));
    setHips(parseFloat((row.hips * multiplier).toFixed(1)));

    // Proportional grading scaling factors relative to base size 8
    const bustRatio = row.bust / 36.0;
    const waistRatio = row.waist / 28.0;
    const hipsRatio = row.hips / 38.0;

    setNeck(parseFloat(((13.5 * (bustRatio + waistRatio) / 2) * multiplier).toFixed(1)));
    setShoulder(parseFloat(((4.7 * (bustRatio + hipsRatio) / 2) * multiplier).toFixed(1)));
    setFrontWaist(parseFloat(((16.2 * (waistRatio + bustRatio) / 2) * multiplier).toFixed(1)));
    setHeight(parseFloat((65.0 * multiplier).toFixed(0)));
    setInseam(parseFloat(((31.0 * (hipsRatio + 1) / 2) * multiplier).toFixed(1)));

    if (window.showToast) {
      window.showToast(`Gracefully morphing digital mannequin to Size ${row.size} specifications...`, 'success');
    }
  };

  // Helper to map activeId to state and setter
  const getActiveDetails = (id) => {
    switch (id) {
      case 1:
        return {
          name: 'Neck Girth (Base)',
          value: neck,
          setValue: setNeck,
          min: unit === 'in' ? 11.5 : 29.0,
          max: unit === 'in' ? 16.5 : 42.0,
          step: 0.1,
          desc: 'Tape runs around the neck base, level at the back, without tightening.',
          tip: 'A = START POINT, B = END POINT'
        };
      case 2:
        return {
          name: 'Shoulder Length',
          value: shoulder,
          setValue: setShoulder,
          min: unit === 'in' ? 4.0 : 10.0,
          max: unit === 'in' ? 6.5 : 16.5,
          step: 0.1,
          desc: 'Measure from neck point to shoulder/arm joint (acromion).',
          tip: 'MEASURE COUTURE SLOPE LENGTH'
        };
      case 3:
        return {
          name: 'Bust/Chest Girth',
          value: bust,
          setValue: setBust,
          min: unit === 'in' ? 30.0 : 76.0,
          max: unit === 'in' ? 52.0 : 132.0,
          step: 0.5,
          desc: 'Horizontal tape at fullest point, under arm, level around body.',
          tip: 'LEVEL WITH APEX OF SARTORIAL CHEST'
        };
      case 4:
        return {
          name: 'Front Waist Length',
          value: frontWaist,
          setValue: setFrontWaist,
          min: unit === 'in' ? 14.5 : 37.0,
          max: unit === 'in' ? 18.5 : 47.0,
          step: 0.1,
          desc: 'From high-point shoulder down over bust apex to natural waist.',
          tip: 'CRITICAL LENGTH METRIC FOR BODICE HEIGHT'
        };
      case 5:
        return {
          name: 'Waist Girth',
          value: waist,
          setValue: setWaist,
          min: unit === 'in' ? 22.0 : 56.0,
          max: unit === 'in' ? 44.0 : 112.0,
          step: 0.5,
          desc: 'Measure natural waist between lower ribs and top hip bones.',
          tip: 'TIGHT BUT BREATHABLE BIAS CONTOUR'
        };
      case 6:
        return {
          name: 'Hip Girth',
          value: hips,
          setValue: setHips,
          min: unit === 'in' ? 32.0 : 81.0,
          max: unit === 'in' ? 54.0 : 137.0,
          step: 0.5,
          desc: 'Measure horizontally around fullest seat/hip level.',
          tip: 'STAND NATURALLY WITH HEELS CLOSED'
        };
      case 7:
        return {
          name: 'Inside Leg Length (Inseam)',
          value: inseam,
          setValue: setInseam,
          min: unit === 'in' ? 28.0 : 71.0,
          max: unit === 'in' ? 35.5 : 90.0,
          step: 0.5,
          desc: 'Measure from crotch point down to floor along inside leg.',
          tip: 'IDEAL FOR HIGH-RISE TROUSER DRAFTING'
        };
      default:
        return null;
    }
  };

  const activeDetails = getActiveDetails(activeId);

  // Unified calculations - normalized to imperial inches for the sizing table matching
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

  const recommendation = useMemo(() => {
    const { bust: bIn, waist: wIn, hips: hIn, height: htIn } = parsedMeasurements;

    const getClosestSize = (val, field) => {
      let closest = MASTER_SIZING_TABLE[0];
      let minDiff = Math.abs(MASTER_SIZING_TABLE[0][field] - val);

      for (let i = 1; i < MASTER_SIZING_TABLE.length; i++) {
        const diff = Math.abs(MASTER_SIZING_TABLE[i][field] - val);
        if (diff < minDiff) {
          minDiff = diff;
          closest = MASTER_SIZING_TABLE[i];
        }
      }
      return closest.size;
    };

    const bSize = getClosestSize(bIn, 'bust');
    const wSize = getClosestSize(wIn, 'waist');
    const hSize = getClosestSize(hIn, 'hips');

    let summary = '';
    let advice = '';

    if (bSize === wSize && wSize === hSize) {
      summary = `Consistent Size ${bSize}`;
      advice = `Our calculations indicate you are a beautifully balanced Size ${bSize} across your bust, waist, and hips. You can cut the couture pattern directly from the sheet without side-grading!`;
    } else {
      const sizesArray = [parseInt(bSize), parseInt(wSize), parseInt(hSize)];
      const minSize = Math.min(...sizesArray);
      const maxSize = Math.max(...sizesArray);
      const sizeSpan = maxSize - minSize;

      summary = `Graded Silhouette (Sizes ${bSize} - ${wSize} - ${hSize})`;

      if (sizeSpan <= 4) {
        advice = `You span sizes ${minSize} to ${maxSize}. We advise grading the paper pattern's side seams on your workspace tissue: transition from Size ${bSize} at the bust, down to Size ${wSize} at the waist, and out to Size ${hSize} at the hip panels.`;
      } else {
        advice = `You span a graded range of ${minSize} to ${maxSize}. We recommend cutting according to the dominant garment profile (select by Bust size ${bSize} for jackets/tops, or Hip size ${hSize} for skirts/pants) and using the side panel seam allowances to taper.`;
      }
    }

    let heightAdvice = 'Height aligns with our standard 5\'5" pattern grade block. No length adjustments necessary.';
    if (htIn < 63) {
      heightAdvice = 'Petite Adjustments Suggested: Since you are under 5\'3", fold 1" out of the pattern bodice and shorten leg lengths by 1.5" to maintain optimal proportions.';
    } else if (htIn > 68) {
      heightAdvice = 'Tall Adjustments Suggested: Since you are 5\'8" or taller, slash and spread the printed pieces to add 1" in the torso and 2" in the legs.';
    }

    return {
      bustRec: bSize,
      waistRec: wSize,
      hipsRec: hSize,
      summary,
      advice,
      heightAdvice,
    };
  }, [parsedMeasurements]);

  const activeMetricSize = useMemo(() => {
    if (activeId === 5) return { size: recommendation.waistRec, name: 'Waist' };
    if (activeId === 6) return { size: recommendation.hipsRec, name: 'Hip' };
    return { size: recommendation.bustRec, name: 'Bust' };
  }, [activeId, recommendation]);

  const blendedSize = useMemo(() => {
    const bNum = parseInt(recommendation.bustRec);
    const wNum = parseInt(recommendation.waistRec);
    const hNum = parseInt(recommendation.hipsRec);

    if (isNaN(bNum) || isNaN(wNum) || isNaN(hNum)) return '8';

    let target = bNum;
    if (garmentFocus === 'tops') {
      target = bNum;
    } else if (garmentFocus === 'bottoms') {
      target = hNum;
    } else {
      // Balanced silhouette blend: average of the three, rounded to the closest even size
      const avg = (bNum + wNum + hNum) / 3;
      const roundedEven = Math.round(avg / 2) * 2;
      target = Math.max(0, Math.min(22, roundedEven));
    }
    return target.toString();
  }, [recommendation, garmentFocus]);

  const fitDiagnostics = useMemo(() => {
    const { bust: bIn, waist: wIn, hips: hIn, height: htIn } = parsedMeasurements;
    const diag = getFitDiagnostics(selectedGarmentStyle, bIn, wIn, hIn, htIn);

    const alerts = [];
    if (diag.analysisText && (diag.bustWarning || diag.waistWarning || diag.hipsWarning)) {
      alerts.push(diag.analysisText);
    }

    return {
      ...diag,
      alerts,
      tailoringAdvice: diag.patterntip || 'Verify your seam allowances and conduct a muslin fitting.'
    };
  }, [selectedGarmentStyle, parsedMeasurements]);

  useEffect(() => {
    if (onRecommendedSizeChange) {
      if (activeTab === 'calculator') {
        onRecommendedSizeChange(blendedSize);
      } else if (activeMetricSize.size) {
        onRecommendedSizeChange(activeMetricSize.size);
      }
    }
  }, [activeTab, blendedSize, activeMetricSize.size, onRecommendedSizeChange]);

  useEffect(() => {
    if (activeId) {
      const element = document.getElementById(`matrix-position-row-${activeId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeId]);

  useEffect(() => {
    const handleSaveShortcut = () => {
      const recSize = activeTab === 'calculator' ? blendedSize : activeMetricSize?.size;
      const ledgerData = {
        neck,
        shoulder,
        bust,
        frontWaist,
        waist,
        hips,
        inseam,
        height,
        unit,
        recommendedSize: recSize,
        garmentFocus,
        timestamp: new Date().toISOString()
      };

      localStorage.setItem('sartorial_sizing_profile', JSON.stringify(ledgerData));

      if (isDriveConnected) {
        saveJsonToDrive(ledgerData, 'sartorial_sizing_profile.json')
          .then(() => {
            console.log('Perfect Fit sizing profile backed up to Google Drive via keyboard shortcut.');
          })
          .catch(err => {
            console.error('Google Drive backup error via keyboard shortcut:', err);
          });
      }
    };

    window.addEventListener('sartorial-save-shortcut', handleSaveShortcut);
    return () => {
      window.removeEventListener('sartorial-save-shortcut', handleSaveShortcut);
    };
  }, [
    neck, shoulder, bust, frontWaist, waist, hips, inseam, height, unit,
    activeTab, blendedSize, activeMetricSize, garmentFocus, isDriveConnected
  ]);

  // Autosave / cache mannequin measurements to localStorage on change
  useEffect(() => {
    const recSize = activeTab === 'calculator' ? blendedSize : activeMetricSize?.size;
    const ledgerData = {
      neck,
      shoulder,
      bust,
      frontWaist,
      waist,
      hips,
      inseam,
      height,
      unit,
      recommendedSize: recSize,
      garmentFocus,
      timestamp: new Date().toISOString()
    };
    try {
      localStorage.setItem('sartorial_sizing_profile', JSON.stringify(ledgerData));
    } catch (e) {
      console.warn('Failed to save sizing profile cache:', e);
    }
  }, [neck, shoulder, bust, frontWaist, waist, hips, inseam, height, unit, activeTab, blendedSize, activeMetricSize, garmentFocus]);

  const lastOfflineToastTimeRef = useRef(0);

  useEffect(() => {
    // If we are offline and any measurement changes, notify the user that it's being cached locally
    if (window.isAtelierOffline) {
      const now = Date.now();
      // Show at most once every 12 seconds to avoid spamming while sliding
      if (now - lastOfflineToastTimeRef.current > 12000) {
        lastOfflineToastTimeRef.current = now;
        if (window.showToast) {
          window.showToast(
            "Working offline. Your custom mannequin measurements are being automatically cached in your local browser workspace.",
            "warning",
            "Offline Autosave Active"
          );
        }
      }
    }
  }, [neck, shoulder, bust, frontWaist, waist, hips, inseam, height, unit]);

  const handleApplyYardage = (yardage, presetName, width) => {
    if (window.showToast) {
      window.showToast(`Saved ${yardage} yards of ${presetName} fabric requirements (${width}" width) to active atelier session!`, 'success');
    }
  };

  // GOOGLE DRIVE INTEGRATION STATES
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [driveUser, setDriveUser] = useState(null);
  const [driveFiles, setDriveFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Listen to Google OAuth state changes
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
    setSyncStatus('Connecting to Google Drive...');
    try {
      const res = await googleSignIn();
      if (res) {
        setIsDriveConnected(true);
        setDriveUser(res.user);
        setSyncStatus('Connected to Google Drive!');
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

  const handleBackupLedger = async () => {
    if (!isDriveConnected) return;
    setIsSyncing(true);
    setSyncStatus('Uploading sizing ledger...');
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
      const filename = `sartorial_atelier_measurements_${dateString}.json`;

      await saveJsonToDrive(ledgerData, filename);
      setSyncStatus(`Ledger backed up as "${filename}"!`);
      const files = await listAppFilesFromDrive();
      setDriveFiles(files);
    } catch (err) {
      console.error('Backup failed:', err);
      setSyncStatus('Backup failed.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(''), 5500);
    }
  };

  const handleSaveReport = async () => {
    if (!isDriveConnected) return;
    setIsSyncing(true);
    setSyncStatus('Creating tailoring handbook report...');
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

### Perfect Fit Pattern Tailoring Advice
${recommendation.advice}

### Height Adjustments Advice
${recommendation.heightAdvice}

---
*Created using Perfect Fit Bureau Studio. Fabricate timeless couture with absolute precision.*
`;

      const dateString = new Date().toLocaleDateString().replace(/\//g, '-');
      const filename = `perfectfit_bureau_report_${dateString}.md`;

      await saveTextToDrive(reportMarkdown, filename);
      setSyncStatus(`Tailoring report saved as "${filename}"!`);
      const files = await listAppFilesFromDrive();
      setDriveFiles(files);
    } catch (err) {
      console.error('Report generation failed:', err);
      setSyncStatus('Report save failed.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(''), 5500);
    }
  };

  const handleRestoreLedger = async (file) => {
    const confirmed = window.confirm(
      `Do you want to restore measurements from the Google Drive file "${file.name}"? This will overwrite your current screen values.`
    );
    if (!confirmed) return;

    setIsSyncing(true);
    setSyncStatus('Retrieving ledger data...');
    try {
      const ledger = await readJsonFromDrive(file.id);

      // Map states safely
      if (ledger.unit) setUnit(ledger.unit);
      if (ledger.neck !== undefined) setNeck(ledger.neck);
      if (ledger.shoulder !== undefined) setShoulder(ledger.shoulder);
      if (ledger.bust !== undefined) setBust(ledger.bust);
      if (ledger.frontWaist !== undefined) setFrontWaist(ledger.frontWaist);
      if (ledger.waist !== undefined) setWaist(ledger.waist);
      if (ledger.hips !== undefined) setHips(ledger.hips);
      if (ledger.inseam !== undefined) setInseam(ledger.inseam);
      if (ledger.height !== undefined) setHeight(ledger.height);

      setSyncStatus('Ledger restored successfully!');
    } catch (err) {
      console.error('Restore failed:', err);
      setSyncStatus('Failed to restore file.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(''), 5000);
    }
  };

  const handleDeleteFile = async (file) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${file.name}" from Google Drive? This action cannot be undone.`
    );
    if (!confirmed) return;

    setIsSyncing(true);
    setSyncStatus('Deleting file...');
    try {
      await deleteFileFromDrive(file.id);
      setSyncStatus('File deleted successfully.');
      const files = await listAppFilesFromDrive();
      setDriveFiles(files);
    } catch (err) {
      console.error('Delete failed:', err);
      setSyncStatus('Delete failed.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(''), 5000);
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
      setSyncStatus('Signed out from Google Drive.');
    } catch (err) {
      console.error('Sign-out failed:', err);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(''), 4000);
    }
  };

  const activePosition = MEASUREMENT_POSITIONS.find((p) => p.id === activeId) || MEASUREMENT_POSITIONS[0];
  const coords = LEGEND_COORDINATES[activeId] || { left: '152px', top: '119px' };

  const handleSelectPosition = (id) => {
    setActiveId(id);
  };

  return (
    <div className="bg-[#FAF9F6] rounded-[4px] border border-sand-200/65 p-4 md:p-8 space-y-8 relative overflow-hidden" id="unified-fit-advisor-section">
      {/* Decorative Atelier Workspace drafting blueprint grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(186,172,143,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(186,172,143,0.02)_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none z-0" />

      {/* HEADER SPECS */}
      <div className="bg-white border border-sand-200/80 rounded-[4px] p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-3xs relative z-10" id="guide-header">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-serif font-light text-bark-950 tracking-tight leading-none">
            Dynamic Dress Form &amp; Sizing Assistant
          </h2>
          <p className="text-xs text-bark-550 max-w-xl">
            A comprehensive fitting experience. Click numbered markers on the technical drawing to check standard conversion tables, or shift the sliders to calculate custom graded sizes simultaneously.
          </p>
        </div>

        {/* Info pills */}
        <div className="flex flex-wrap gap-2" id="guide-pills">
          <span className="bg-sand-50 text-bark-800 text-[9px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full border border-sand-200/60">
            Size Range: <b className="text-clay-700">XXS - XXL</b>
          </span>
          <span className="bg-sand-50 text-bark-800 text-[9px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full border border-sand-200/60">
            Precision Grading: <b className="text-clay-700">Sub-Centimeter</b>
          </span>
          <button
            onClick={() => handleUnitChange(unit === 'in' ? 'cm' : 'in')}
            className="bg-bark-900 text-sand-50 hover:bg-bark-800 text-[9px] font-bold uppercase tracking-widest px-4 py-2 rounded-full cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-2.5 h-2.5" /> Toggle to {unit === 'in' ? 'Centimeters' : 'Inches'}
          </button>
        </div>
      </div>

      {/* Dynamic Tab Switcher - Premium minimalist style */}
      <div className="flex border-b border-sand-200/80 pb-px relative z-10" id="guide-tabs">
        <div className="flex gap-6 sm:gap-10 text-xs font-mono uppercase tracking-widest overflow-x-auto scrollbar-none pb-2 sm:pb-0">
          <button
            onClick={() => {
              setActiveTab('mannequin');
              if (window.showToast) {
                window.showToast('Switched to Interactive Studio Dress Form & Drafting Sheets.', 'info');
              }
            }}
            className={`pb-3 border-b-2 font-bold cursor-pointer transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'mannequin'
                ? 'border-clay-700 text-bark-950 font-black'
                : 'border-transparent text-bark-400 hover:text-bark-750'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${activeTab === 'mannequin' ? 'text-clay-650' : 'text-bark-400'}`} />
            1. Dress Form & Drafting Sheets
          </button>

          <button
            onClick={() => {
              setActiveTab('calculator');
              if (window.showToast) {
                window.showToast('Opened Couture Sizing Calculator Wizard.', 'info');
              }
            }}
            className={`pb-3 border-b-2 font-bold cursor-pointer transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'calculator'
                ? 'border-clay-700 text-bark-950 font-black'
                : 'border-transparent text-bark-400 hover:text-bark-750'
            }`}
            id="tab-sizing-calculator"
          >
            <Ruler className={`w-3.5 h-3.5 ${activeTab === 'calculator' ? 'text-clay-650' : 'text-bark-400'}`} />
            2. Bespoke Sizing Calculator
          </button>

          <button
            onClick={() => {
              setActiveTab('arOverlay');
              if (window.showToast) {
                window.showToast('Opened Virtual AR-Inspired Overlay Fitting Studio.', 'info');
              }
            }}
            className={`pb-3 border-b-2 font-bold cursor-pointer transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'arOverlay'
                ? 'border-clay-700 text-bark-950 font-black'
                : 'border-transparent text-bark-400 hover:text-bark-750'
            }`}
            id="tab-ar-overlay"
          >
            <Sparkles className={`w-3.5 h-3.5 ${activeTab === 'arOverlay' ? 'text-clay-650' : 'text-bark-400'}`} />
            3. AR Fitting Overlay
          </button>
        </div>
      </div>

      {activeTab === 'mannequin' && (() => {
        const getImperialValue = (val) => {
          return unit === 'cm' ? val / 2.54 : val;
        };

        const neckVal = getImperialValue(animMetrics.neck);
        const shoulderVal = getImperialValue(animMetrics.shoulder);
        const bustVal = getImperialValue(animMetrics.bust);
        const frontWaistVal = getImperialValue(animMetrics.frontWaist);
        const waistVal = getImperialValue(animMetrics.waist);
        const hipsVal = getImperialValue(animMetrics.hips);
        const heightVal = getImperialValue(animMetrics.height);
        const inseamVal = getImperialValue(animMetrics.inseam);

        // Normalization scaling factors relative to standard base sizes (Size 8 base)
        const neckScale = Math.max(0.75, Math.min(1.4, neckVal / 13.5));
        const shoulderScale = Math.max(0.75, Math.min(1.4, shoulderVal / 4.7));
        const bustScale = Math.max(0.75, Math.min(1.45, bustVal / 36.0));
        const waistScale = Math.max(0.75, Math.min(1.45, waistVal / 28.0));
        const hipsScale = Math.max(0.75, Math.min(1.45, hipsVal / 38.0));
        const heightScale = Math.max(0.8, Math.min(1.3, heightVal / 65.0));
        const inseamScale = Math.max(0.75, Math.min(1.3, inseamVal / 31.0));
        const waistYScale = Math.max(0.8, Math.min(1.25, frontWaistVal / 16.2));

        // Dynamic key coordinates on 240x450 grid canvas:
        const neckY = 60;
        const shoulderY = 82 + 8 * (waistYScale - 1);
        const bustY = 135 + 20 * (waistYScale - 1);
        const waistY = 245 + 35 * (waistYScale - 1);
        const hipsY = 315 + 40 * (heightScale - 1) + 20 * (waistYScale - 1);
        const bottomY = 340 + 45 * (heightScale - 1) + 20 * (waistYScale - 1);

        // Dynamic half-widths for the model torso contours
        const neckW = 16 * neckScale;
        const shoulderW = 58 * shoulderScale;
        const bustW = 72 * bustScale;
        const waistW = 50 * waistScale;
        const hipsW = 70 * hipsScale;
        const bottomW = 60 * hipsScale; // Base of form expands relative to hips

        // Parameterized outline paths of the custom mannequin torso (closes perfectly)
        const torsoPath = `
          M ${120 - neckW} ${neckY}
          C ${120 - neckW - 2} ${neckY}, ${120 - 24} ${neckY + 4}, ${120 - 26} ${neckY + 8}
          C ${120 - 30} ${neckY + 16}, ${120 - shoulderW + 14} ${shoulderY - 4}, ${120 - shoulderW} ${shoulderY}
          C ${120 - shoulderW - 12} ${shoulderY + 4}, ${120 - bustW + 2} ${bustY - 23}, ${120 - bustW} ${bustY}
          C ${120 - bustW + 2} ${bustY + 20}, ${120 - waistW + 4} ${waistY - 50}, ${120 - waistW + 2} ${waistY - 15}
          C ${120 - waistW} ${waistY - 5}, ${120 - waistW + 1} ${waistY + 2}, ${120 - waistW} ${waistY}
          C ${120 - waistW - 2} ${waistY + 15}, ${120 - hipsW + 4} ${hipsY - 15}, ${120 - hipsW} ${hipsY}
          C ${120 - hipsW - 4} ${hipsY + 15}, ${120 - bottomW} ${bottomY}, ${120} ${bottomY}
          C ${120 + bottomW} ${bottomY}, ${120 + hipsW + 4} ${hipsY + 15}, ${120 + hipsW} ${hipsY}
          C ${120 + hipsW - 4} ${hipsY - 15}, ${120 + waistW + 2} ${waistY + 15}, ${120 + waistW} ${waistY}
          C ${120 + waistW - 1} ${waistY + 2}, ${120 + waistW} ${waistY - 5}, ${120 + waistW - 2} ${waistY - 15}
          C ${120 + waistW - 4} ${waistY - 50}, ${120 + bustW - 2} ${bustY + 20}, ${120 + bustW} ${bustY}
          C ${120 + bustW - 2} ${bustY - 23}, ${120 + shoulderW + 12} ${shoulderY + 4}, ${120 + shoulderW} ${shoulderY}
          C ${120 + shoulderW - 14} ${shoulderY - 4}, ${120 + 30} ${neckY + 16}, ${120 + 26} ${neckY + 8}
          C ${120 + 24} ${neckY + 4}, ${120 + neckW + 2} ${neckY}, ${120 + neckW} ${neckY}
          Z
        `;

        const getGarmentPath = () => {
          switch (selectedGarmentStyle) {
            case 'dress':
              return `
                M ${120 - 20 * neckScale} ${neckY}
                L ${120 - 64 * shoulderScale} ${shoulderY + 4}
                C ${120 - 74 * shoulderScale} ${shoulderY + 14}, ${120 - 78 * bustScale} ${bustY - 10}, ${120 - 78 * bustScale} ${bustY}
                C ${120 - 75 * bustScale} ${bustY + 15}, ${120 - 54 * waistScale} ${waistY - 10}, ${120 - 52 * waistScale} ${waistY}
                C ${120 - 65 * waistScale} ${waistY + 40}, ${120 - 92 * hipsScale} ${hipsY}, ${120 - 105 * hipsScale} ${bottomY + 65}
                L ${120 + 95 * hipsScale} ${bottomY + 60}
                C ${120 + 82 * hipsScale} ${hipsY}, ${120 + 58 * waistScale} ${waistY + 40}, ${120 + 52 * waistScale} ${waistY}
                C ${120 + 54 * waistScale} ${waistY - 10}, ${120 + 75 * bustScale} ${bustY + 15}, ${120 + 78 * bustScale} ${bustY}
                C ${120 + 78 * bustScale} ${bustY - 10}, ${120 + 74 * shoulderScale} ${shoulderY + 14}, ${120 + 64 * shoulderScale} ${shoulderY + 4}
                L ${120 + 20 * neckScale} ${neckY}
                Z
              `;
            case 'trench':
              return `
                M ${120 - 22 * neckScale} ${neckY - 2}
                L ${120 - 70 * shoulderScale} ${shoulderY + 2}
                L ${120 - 82 * bustScale} ${bustY}
                C ${120 - 80 * bustScale} ${bustY + 20}, ${120 - 60 * waistScale} ${waistY - 10}, ${120 - 58 * waistScale} ${waistY}
                C ${120 - 64 * waistScale} ${waistY + 30}, ${120 - 82 * hipsScale} ${hipsY}, ${120 - 90 * hipsScale} ${bottomY + 85}
                L ${120 + 90 * hipsScale} ${bottomY + 85}
                C ${120 + 82 * hipsScale} ${hipsY}, ${120 + 64 * waistScale} ${waistY + 30}, ${120 + 58 * waistScale} ${waistY}
                C ${120 + 60 * waistScale} ${waistY - 10}, ${120 + 80 * bustScale} ${bustY + 20}, ${120 + 82 * bustScale} ${bustY}
                L ${120 + 70 * shoulderScale} ${shoulderY + 2}
                L ${120 + 22 * neckScale} ${neckY - 2}
                Z
              `;
            case 'trousers':
              return `
                M ${120 - 50 * waistScale} ${waistY}
                C ${120 - 55 * waistScale} ${waistY + 25}, ${120 - 72 * hipsScale} ${hipsY}, ${120 - 85 * hipsScale} ${bottomY + 95}
                L ${120 - 6} ${bottomY + 95}
                L ${120 - 6} ${hipsY + 30}
                L ${120 + 6} ${hipsY + 30}
                L ${120 + 6} ${bottomY + 95}
                L ${120 + 85 * hipsScale} ${bottomY + 95}
                C ${120 + 72 * hipsScale} ${hipsY}, ${120 + 55 * waistScale} ${waistY + 25}, ${120 + 50 * waistScale} ${waistY}
                Z
              `;
            case 'blouse':
              return `
                M ${120 - 32 * neckScale} ${neckY + 4}
                L ${120 - 65 * shoulderScale} ${shoulderY + 6}
                C ${120 - 78 * bustScale} ${bustY - 12}, ${120 - 84 * bustScale} ${bustY + 12}, ${120 - 75 * bustScale} ${bustY + 35}
                C ${120 - 68 * bustScale} ${bustY + 50}, ${120 - 54 * waistScale} ${waistY - 10}, ${120 - 55 * waistScale} ${waistY + 10}
                C ${120 - 30 * waistScale} ${waistY + 14}, ${120 + 30 * waistScale} ${waistY + 14}, ${120 + 55 * waistScale} ${waistY + 10}
                C ${120 + 54 * waistScale} ${waistY - 10}, ${120 + 68 * bustScale} ${bustY + 50}, ${120 + 75 * bustScale} ${bustY + 35}
                C ${120 + 84 * bustScale} ${bustY + 12}, ${120 + 78 * bustScale} ${bustY - 12}, ${120 + 65 * shoulderScale} ${shoulderY + 6}
                L ${120 + 20 * neckScale} ${neckY}
                C ${120 + 10 * neckScale} ${neckY + 15}, ${120 - 15 * neckScale} ${neckY + 15}, ${120 - 32 * neckScale} ${neckY + 4}
                Z
              `;
            default:
              return '';
          }
        };

        const renderGarmentDetails = () => {
          switch (selectedGarmentStyle) {
            case 'dress':
              return (
                <g stroke="rgba(0,0,0,0.15)" strokeWidth="1" fill="none">
                  <path d={`M ${120 + 20 * neckScale} ${neckY} Q 110 ${bustY + 20} ${120 - 52 * waistScale} ${waistY}`} strokeWidth="1.2" />
                  <path d={`M ${120 - 52 * waistScale} ${waistY} Q ${120 - 20 * waistScale} ${waistY + 50} ${120 - 35 * hipsScale} ${bottomY + 62}`} />
                  <path d={`M ${120 - 30 * waistScale} ${waistY} Q ${120 + 10 * waistScale} ${waistY + 60} ${120 + 15 * hipsScale} ${bottomY + 61}`} />
                  <rect x={120 - 54 * waistScale - 3} y={waistY - 3} width="8" height="6" fill={garmentColor} stroke="rgba(0,0,0,0.2)" rx="2" />
                  <path d={`M ${120 - 54 * waistScale} ${waistY} Q ${120 - 62 * waistScale} ${waistY + 30} ${120 - 64 * waistScale} ${waistY + 50}`} strokeWidth="1.5" />
                  <path d={`M ${120 - 54 * waistScale} ${waistY} Q ${120 - 52 * waistScale} ${waistY + 25} ${120 - 48 * waistScale} ${waistY + 45}`} strokeWidth="1.5" />
                </g>
              );
            case 'trench':
              return (
                <g stroke="rgba(0,0,0,0.18)" strokeWidth="1" fill="none">
                  <path d={`M 120 ${neckY} L ${120 - 24 * neckScale} ${neckY + 18} L ${120 - 44 * shoulderScale} ${shoulderY + 12} L 120 ${bustY - 10}`} fill="none" strokeWidth="1.2" />
                  <path d={`M 120 ${neckY} L ${120 + 24 * neckScale} ${neckY + 18} L ${120 + 44 * shoulderScale} ${shoulderY + 12} L 120 ${bustY - 10}`} fill="none" strokeWidth="1.2" />
                  <path d={`M 120 ${bustY - 10} L 120 ${bottomY + 85}`} strokeWidth="0.8" strokeDasharray="4,2" />
                  <circle cx="110" cy={bustY + 10} r="2.5" fill="#222" stroke="none" />
                  <circle cx="130" cy={bustY + 10} r="2.5" fill="#222" stroke="none" />
                  <circle cx="110" cy={bustY + 35} r="2.5" fill="#222" stroke="none" />
                  <circle cx="130" cy={bustY + 35} r="2.5" fill="#222" stroke="none" />
                  <rect x={120 - 58 * waistScale - 2} y={waistY - 4} width={116 * waistScale + 4} height="8" fill="rgba(0,0,0,0.1)" stroke="rgba(0,0,0,0.2)" rx="1" />
                  <rect x={120 - 10} y={waistY - 6} width="20" height="12" fill="url(#brass-gradient)" stroke="#553a0a" strokeWidth="1" rx="2" />
                  <path d={`M 120 ${waistY + 6} Q 116 ${waistY + 30} 112 ${waistY + 45}`} strokeWidth="2" stroke={garmentColor} />
                  <path d={`M ${120 - 40 * shoulderScale} ${shoulderY + 8} Q ${120 - 20 * bustScale} ${bustY + 15} 120 ${bustY - 10}`} />
                </g>
              );
            case 'trousers':
              return (
                <g stroke="rgba(0,0,0,0.15)" strokeWidth="1" fill="none">
                  <path d={`M ${120 - 50 * waistScale} ${waistY} L ${120 + 50 * waistScale} ${waistY}`} strokeWidth="1.2" />
                  <line x1={120 - 32 * waistScale} y1={waistY} x2={120 - 32 * waistScale} y2={waistY + 10} strokeWidth="1.5" stroke="rgba(0,0,0,0.3)" />
                  <line x1={120 + 32 * waistScale} y1={waistY} x2={120 + 32 * waistScale} y2={waistY + 10} strokeWidth="1.5" stroke="rgba(0,0,0,0.3)" />
                  <line x1="120" y1={waistY} x2="120" y2={waistY + 10} strokeWidth="1.5" stroke="rgba(0,0,0,0.3)" />
                  <path d={`M 120 ${waistY + 10} L 120 ${hipsY - 10} Q 120 ${hipsY + 10} ${120 - 6} ${hipsY + 20}`} />
                  <line x1={120 - 24 * hipsScale} y1={hipsY} x2={120 - 44 * hipsScale} y2={bottomY + 95} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                  <line x1={120 + 24 * hipsScale} y1={hipsY} x2={120 + 44 * hipsScale} y2={bottomY + 95} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                  <path d={`M ${120 - 46 * waistScale} ${waistY + 10} L ${120 - 36 * waistScale} ${waistY + 22}`} />
                  <path d={`M ${120 + 46 * waistScale} ${waistY + 10} L ${120 + 36 * waistScale} ${waistY + 22}`} />
                </g>
              );
            case 'blouse':
              return (
                <g stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none">
                  <path d={`M ${120 - 32 * neckScale} ${neckY + 4} Q 120 ${neckY + 30} ${120 + 20 * neckScale} ${neckY}`} />
                  <path d={`M ${120 - 28 * neckScale} ${neckY + 12} Q 120 ${neckY + 45} ${120 + 30 * neckScale} ${neckY + 8}`} />
                  <path d={`M ${120 - 20 * neckScale} ${neckY + 22} Q 120 ${neckY + 58} ${120 + 38 * neckScale} ${neckY + 18}`} stroke="rgba(0,0,0,0.08)" />
                  <circle cx={120 - 58 * shoulderScale} cy={shoulderY + 5} r="3" fill="url(#brass-gradient)" stroke="#443" strokeWidth="0.5" />
                  <path d={`M ${120 - 58 * shoulderScale} ${shoulderY + 5} Q ${120 - 30 * bustScale} ${bustY - 10} ${120 - 40 * bustScale} ${bustY + 10}`} stroke="rgba(0,0,0,0.15)" />
                  <path d={`M ${120 - 45 * waistScale} ${waistY + 10} Q 120 ${waistY - 15} ${120 + 45 * waistScale} ${waistY + 5}`} />
                </g>
              );
            default:
              return null;
          }
        };

        const getFabricPatternUrl = () => {
          switch (garmentFabric) {
            case 'linen':
              return 'url(#linen-weave)';
            case 'denim':
              return 'url(#denim-twill)';
            case 'wool':
              return 'url(#wool-crosshatch)';
            case 'silk':
            default:
              return 'none';
          }
        };

        const getFabricOpacity = () => {
          switch (garmentFabric) {
            case 'linen':
              return 0.55;
            case 'denim':
              return 0.45;
            case 'wool':
              return 0.35;
            case 'silk':
            default:
              return 0;
          }
        };

        const getGarmentStrokeColor = () => {
          switch (garmentColor) {
            case '#ba6446': return '#934d32';
            case '#4d6051': return '#3a4a3e';
            case '#2f3e46': return '#1b262c';
            case '#cca959': return '#a3833d';
            case '#f5eedc': return '#d9ccb2';
            default: return 'rgba(0,0,0,0.15)';
          }
        };

        const hotspots = [
          { id: 1, name: 'Neck Girth', x: 120, y: neckY - 6, title: 'Neck Girth' },
          { id: 2, name: 'Shoulder Length', x: 120 - shoulderW, y: shoulderY, title: 'Shoulder Length' },
          { id: 3, name: 'Bust Girth', x: 120, y: bustY, title: 'Bust Girth' },
          { id: 4, name: 'Front Waist Length', x: 120 + waistW * 0.4, y: (neckY + waistY) * 0.52, title: 'Front Waist Length' },
          { id: 5, name: 'Waist Girth', x: 120, y: waistY, title: 'Waist Girth' },
          { id: 6, name: 'Hip Girth', x: 120, y: hipsY, title: 'Hip Girth' },
          { id: 7, name: 'Inside Leg (Inseam)', x: 120, y: (bottomY + 410) * 0.5, title: 'Inside Leg (Inseam)' },
        ];

        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative z-10" id="guide-content-grid">

          {/* LEFT COLUMN: MANNEQUIN STAGE WITH REALISTIC studio BACKGROUND */}
          <div className="col-span-12 lg:col-span-6 xl:col-span-5 bg-[#FAF8F5] border border-sand-200/80 rounded-[4px] p-4 sm:p-6 flex flex-col items-center justify-center relative min-h-[510px] h-full overflow-hidden shadow-3xs" id="mannequin-canvas-wrapper">

            {/* NEUTRAL HIGH-END STUDIO BACKDROP WITH LIGHTING DEPTH */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none bg-gradient-to-b from-[#fdfcfb] via-[#f7f4ef] to-[#eeeae2]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,_rgba(255,253,250,1)_0%,_rgba(247,244,239,0.4)_60%,_rgba(238,234,226,0.8)_100%)]" />
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#8c7b64 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
              <div className="absolute inset-0 bg-gradient-to-tr from-stone-950/5 via-transparent to-stone-950/5 mix-blend-multiply" />
            </div>

            {/* Title on backdrop - Positioned absolutely at top */}
            <div className="absolute top-4 left-6 right-6 z-15 flex justify-between items-center" id="mannequin-top-info">
              <span className="text-[10px] text-bark-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-clay-500 animate-spin-slow" /> Atelier Studio Stand
              </span>
              {activeId ? (
                <span className="text-[9px] font-medium font-serif text-clay-800 bg-clay-50 border border-clay-200/50 px-2 py-0.5 rounded shadow-3xs">
                  Active: <b className="font-bold">{activePosition.name} ({getActiveDetails(activeId).value} {unit})</b>
                </span>
              ) : (
                <span className="text-[9px] font-mono text-bark-450 bg-sand-100 px-2 py-0.5 rounded border border-sand-200/60">
                  Click hotspots to inspect
                </span>
              )}
            </div>

            {/* SARTORIAL DRESS FORM MAIN INTERACTIVE CONTAINER */}
            <div className="relative z-10 w-full flex flex-col items-center justify-center mt-6" id="mannequin-main-interactive-container">

              {/* SARTORIAL DRESS FORM INTERACTIVE GRAPHIC */}
              <div
                className="relative w-[280px] h-[440px] flex items-center justify-center z-10 transition-all duration-500 ease-out scale-95 sm:scale-100 shrink-0"
                id="mannequin-interactive-canvas"
              >

              <div className="absolute inset-x-8 inset-y-12 bg-radial from-amber-50/50 to-transparent pointer-events-none rounded-full blur-xl opacity-75" />

              {/* DRESS FORM MANNEQUIN SVG SHAPE */}
              <svg
                viewBox="0 0 240 450"
                className="w-full h-full text-bark-900 transition-all duration-300 relative z-10"
                id="dress-form-svg"
              >
                <defs>
                  <linearGradient id="linen-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#96876c" />
                    <stop offset="8%" stopColor="#c2b498" />
                    <stop offset="22%" stopColor="#eadecb" />
                    <stop offset="45%" stopColor="#fffcf8" />
                    <stop offset="68%" stopColor="#e5dac0" />
                    <stop offset="88%" stopColor="#bcad91" />
                    <stop offset="100%" stopColor="#827258" />
                  </linearGradient>

                  <linearGradient id="wood-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#121212" />
                    <stop offset="18%" stopColor="#2c2c2c" />
                    <stop offset="50%" stopColor="#444444" />
                    <stop offset="82%" stopColor="#222222" />
                    <stop offset="100%" stopColor="#0d0d0d" />
                  </linearGradient>

                  <linearGradient id="brass-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#75561b" />
                    <stop offset="15%" stopColor="#cca959" />
                    <stop offset="30%" stopColor="#fef0b7" />
                    <stop offset="45%" stopColor="#b38f38" />
                    <stop offset="70%" stopColor="#fdf3bf" />
                    <stop offset="100%" stopColor="#553a0a" />
                  </linearGradient>

                  <linearGradient id="wood-sheen" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                    <stop offset="40%" stopColor="rgba(255,255,255,0.05)" />
                    <stop offset="50%" stopColor="rgba(255,255,255,0.45)" />
                    <stop offset="60%" stopColor="rgba(255,255,255,0.05)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                  </linearGradient>

                  <linearGradient id="silk-gloss-overlay" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                    <stop offset="30%" stopColor="rgba(255,255,255,0.02)" />
                    <stop offset="45%" stopColor="rgba(255,255,255,0.38)" />
                    <stop offset="55%" stopColor="rgba(255,255,255,0.02)" />
                    <stop offset="85%" stopColor="rgba(255,255,255,0.22)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                  </linearGradient>

                  <pattern id="linen-weave" width="4" height="4" patternUnits="userSpaceOnUse">
                    <path d="M 0,2 L 4,2 M 2,0 L 2,4" stroke="rgba(110, 95, 75, 0.08)" strokeWidth="0.5" />
                    <rect width="4" height="4" fill="none" />
                  </pattern>

                  <pattern id="denim-twill" width="6" height="6" patternUnits="userSpaceOnUse">
                    <path d="M 0,6 L 6,0 M -1,1 L 1,-1 M 5,7 L 7,5" stroke="rgba(0, 0, 0, 0.12)" strokeWidth="1" />
                  </pattern>

                  <pattern id="wool-crosshatch" width="8" height="8" patternUnits="userSpaceOnUse">
                    <path d="M 0,0 L 8,8 M 8,0 L 0,8" stroke="rgba(0, 0, 0, 0.08)" strokeWidth="1.2" />
                    <rect width="8" height="8" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
                  </pattern>

                  <radialGradient id="mannequin-base-shadow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(38, 28, 22, 0.32)" />
                    <stop offset="100%" stopColor="rgba(38, 28, 22, 0)" />
                  </radialGradient>

                  <radialGradient id="torso-3d-shading" cx="42%" cy="30%" r="65%">
                    <stop offset="0%" stopColor="rgba(255, 255, 255, 0.42)" />
                    <stop offset="35%" stopColor="rgba(240, 230, 210, 0.05)" />
                    <stop offset="75%" stopColor="rgba(125, 100, 75, 0.30)" />
                    <stop offset="100%" stopColor="rgba(50, 38, 25, 0.65)" />
                  </radialGradient>

                  <filter id="soft-depth-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="3" dy="6" stdDeviation="5" floodColor="#352925" floodOpacity="0.25" />
                  </filter>
                </defs>

                {/* Floor Shadow under tripod */}
                <ellipse cx="120" cy="442" rx="35" ry="5" fill="url(#mannequin-base-shadow)" />

                {/* Pole connecting body to base */}
                <rect x="118" y="340" width="4" height="85" fill="url(#wood-gradient)" />
                <rect x="118" y="340" width="4" height="85" fill="url(#wood-sheen)" />

                {/* Stand Cap Wood */}
                <path d="M 111 38 L 129 38 L 125 60 L 115 60 Z" fill="url(#wood-gradient)" />
                <path d="M 111 38 L 129 38 L 125 60 L 115 60 Z" fill="url(#wood-sheen)" />
                <ellipse cx="120" cy="38" rx="9" ry="4" fill="#0c0705" />
                <rect x="115" y="52" width="10" height="4" fill="url(#brass-gradient)" rx="1" />
                <circle cx="120" cy="30" r="5" fill="url(#brass-gradient)" stroke="#1a110a" strokeWidth="0.5" />

                {/* Brass rod sleeve */}
                <rect x="117" y="345" width="6" height="22" fill="url(#brass-gradient)" />
                <circle cx="123" cy="356" r="3.5" fill="url(#brass-gradient)" stroke="#2b1d16" strokeWidth="0.5" />
                <line x1="123" y1="356" x2="127" y2="356" stroke="#0a0604" strokeWidth="1" />

                {/* Base tripod legs */}
                <g id="tripod-legs">
                  <path d="M 118 420 L 86 444 L 90 447 L 118 424 Z" fill="url(#wood-gradient)" />
                  <path d="M 118 420 L 86 444 L 90 447 L 118 424 Z" fill="url(#wood-sheen)" />
                  <path d="M 122 420 L 154 444 L 150 447 L 122 424 Z" fill="url(#wood-gradient)" />
                  <path d="M 122 420 L 154 444 L 150 447 L 122 424 Z" fill="url(#wood-sheen)" />
                  <path d="M 120 420 L 120 448 L 122 448 L 122 420 Z" fill="url(#wood-gradient)" />
                  <path d="M 120 420 L 120 448 L 122 448 L 122 420 Z" fill="url(#wood-sheen)" />
                </g>
                <circle cx="120" cy="421" r="5" fill="url(#brass-gradient)" stroke="#1a110a" strokeWidth="0.5" />

                {/* DYNAMIC DRESS FORM TORSO BASE GROUP */}
                <g filter="url(#soft-depth-shadow)" id="dress-form-torso-group-main">
                  <path d={torsoPath} fill="url(#linen-gradient)" stroke="#c3b8a1" strokeWidth="1" />
                  <path d={torsoPath} fill="url(#linen-weave)" opacity="0.55" />
                  <path d={torsoPath} fill="url(#torso-3d-shading)" opacity="0.95" style={{ mixBlendMode: 'multiply' }} />

                  {/* 3D shading contour guide curves */}
                  <path d={`M 120 ${neckY} C ${120 - 7 * neckScale} ${neckY + 40}, ${120 - 26 * bustScale} ${bustY + 45}, ${120 - 26 * waistScale} ${waistY}`} stroke="rgba(165, 145, 115, 0.35)" strokeWidth="1.2" fill="none" />
                  <path d={`M 120 ${neckY} C ${120 + 7 * neckScale} ${neckY + 40}, ${120 + 26 * bustScale} ${bustY + 45}, ${120 + 26 * waistScale} ${waistY}`} stroke="rgba(165, 145, 115, 0.35)" strokeWidth="1.2" fill="none" />

                  {/* Front Neck seam line */}
                  <path d={`M ${120 - neckW} ${neckY} C ${120 - neckW} ${neckY}, 120 ${neckY + 6}, ${120 + neckW} ${neckY}`} stroke="#d3c9b4" strokeWidth="1" fill="none" />
                </g>

                {/* DYNAMIC SEAM LINES & DESIGN COUTURE GUIDELINES */}
                <g id="dress-form-torso-group" opacity="0.45">
                  {/* Center Front line seam */}
                  <path d={`M 120 ${neckY} L 120 ${bottomY}`} stroke="rgba(120, 100, 80, 0.22)" strokeWidth="0.8" strokeDasharray="3,3" fill="none" />
                  {/* Princess curves seams */}
                  <path d={`M ${120 - neckW * 0.6} ${neckY} C ${120 - 20 * neckScale} ${neckY + 50}, ${120 - 35 * bustScale} ${bustY + 15}, ${120 - 25 * waistScale} ${waistY} C ${120 - 25 * waistScale} ${waistY + 30}, ${120 - 35 * hipsScale} ${hipsY}, ${120 - 32 * hipsScale} ${bottomY}`} stroke="rgba(110, 90, 70, 0.25)" strokeWidth="0.8" strokeDasharray="3,3" fill="none" />
                  <path d={`M ${120 + neckW * 0.6} ${neckY} C ${120 + 20 * neckScale} ${neckY + 50}, ${120 + 35 * bustScale} ${bustY + 15}, ${120 + 25 * waistScale} ${waistY} C ${120 + 25 * waistScale} ${waistY + 30}, ${120 + 35 * hipsScale} ${hipsY}, ${120 + 32 * hipsScale} ${bottomY}`} stroke="rgba(110, 90, 70, 0.25)" strokeWidth="0.8" strokeDasharray="3,3" fill="none" />
                  {/* Bust horizontal guideline */}
                  <path d={`M ${120 - bustW} ${bustY} Q 120 ${bustY + 12} ${120 + bustW} ${bustY}`} stroke="rgba(120, 100, 80, 0.18)" strokeWidth="0.8" strokeDasharray="2,2" fill="none" />
                  {/* Waist horizontal guideline */}
                  <path d={`M ${120 - waistW} ${waistY} Q 120 ${waistY + 10} ${120 + waistW} ${waistY}`} stroke="rgba(120, 100, 80, 0.18)" strokeWidth="0.8" strokeDasharray="2,2" fill="none" />
                  {/* Hip horizontal guideline */}
                  <path d={`M ${120 - hipsW} ${hipsY} Q 120 ${hipsY + 10} ${120 + hipsW} ${hipsY}`} stroke="rgba(120, 100, 80, 0.18)" strokeWidth="0.8" strokeDasharray="2,2" fill="none" />
                </g>

                {/* COUTURE GARMENT LAYER OVERLAY */}
                {selectedGarmentStyle !== 'none' && (
                  <g id="garment-layer-overlay" opacity="0.85" style={{ transition: 'all 0.5s ease-in-out' }}>
                    <path d={getGarmentPath()} fill={garmentColor} stroke={getGarmentStrokeColor()} strokeWidth="1.5" filter="url(#soft-depth-shadow)" />
                    {getFabricPatternUrl() !== 'none' && (
                      <path d={getGarmentPath()} fill={getFabricPatternUrl()} opacity={getFabricOpacity()} style={{ mixBlendMode: 'multiply' }} />
                    )}
                    <path d={getGarmentPath()} fill="url(#torso-3d-shading)" opacity="0.75" style={{ mixBlendMode: 'multiply' }} />
                    {garmentFabric === 'silk' && (
                      <path d={getGarmentPath()} fill="url(#silk-gloss-overlay)" opacity="0.45" style={{ mixBlendMode: 'screen' }} />
                    )}
                    {renderGarmentDetails()}
                  </g>
                )}

                {/* DYNAMIC MEASURING TAPES OVERLAYS */}
                {/* Neck Tape (Point 1) */}
                <path d={`M ${120 - neckW * 0.9} ${neckY + 4} Q 120 ${neckY + 10} ${120 + neckW * 0.9} ${neckY + 4}`} stroke={activeId === 1 ? '#ba6446' : 'transparent'} strokeWidth={activeId === 1 ? '4.5' : '0'} strokeDasharray="4,2" fill="none" className="transition-all duration-300" />
                {activeId === 1 && (
                  <>
                    <path d={`M ${120 - neckW * 0.9} ${neckY + 4} Q 120 ${neckY + 10} ${120 + neckW * 0.9} ${neckY + 4}`} stroke="#ba6446" strokeWidth="2.5" fill="none" />
                    <circle cx={120 - neckW * 0.9} cy={neckY + 4} r="3.5" fill="#ba6446" />
                    <circle cx={120 + neckW * 0.9} cy={neckY + 4} r="3.5" fill="#ba6446" />
                  </>
                )}

                {/* Shoulder Tape (Point 2) */}
                <path d={`M ${120 - neckW} ${neckY} L ${120 - shoulderW} ${shoulderY}`} stroke={activeId === 2 ? '#ba6446' : 'transparent'} strokeWidth={activeId === 2 ? '4.5' : '0'} fill="none" className="transition-all duration-300" />
                {activeId === 2 && (
                  <>
                    <path d={`M ${120 - neckW} ${neckY} L ${120 - shoulderW} ${shoulderY}`} stroke="#ba6446" strokeWidth="2.5" fill="none" />
                    <circle cx={120 - neckW} cy={neckY} r="3.5" fill="#ba6446" />
                    <circle cx={120 - shoulderW} cy={shoulderY} r="3.5" fill="#ba6446" />
                  </>
                )}

                {/* Bust Tape (Point 3) */}
                <path d={`M ${120 - bustW} ${bustY} Q 120 ${bustY + 7} ${120 + bustW} ${bustY}`} stroke={activeId === 3 ? '#ba6446' : 'transparent'} strokeWidth={activeId === 3 ? '4.5' : '0'} strokeDasharray="4,2" fill="none" className="transition-all duration-300" />
                {activeId === 3 && (
                  <>
                    <path d={`M ${120 - bustW} ${bustY} Q 120 ${bustY + 7} ${120 + bustW} ${bustY}`} stroke="#ba6446" strokeWidth="2.5" fill="none" />
                    <circle cx={120 - bustW} cy={bustY} r="3.5" fill="#ba6446" />
                    <circle cx={120 + bustW} cy={bustY} r="3.5" fill="#ba6446" />
                  </>
                )}

                {/* Front Waist Tape (Point 4) */}
                <path d={`M ${120 + neckW * 0.4} ${neckY} Q ${120 + waistW * 0.95} ${(neckY + waistY) * 0.52} ${120 + waistW * 0.4} ${waistY}`} stroke={activeId === 4 ? '#ba6446' : 'transparent'} strokeWidth={activeId === 4 ? '4.5' : '0'} fill="none" className="transition-all duration-300" />
                {activeId === 4 && (
                  <>
                    <path d={`M ${120 + neckW * 0.4} ${neckY} Q ${120 + waistW * 0.95} ${(neckY + waistY) * 0.52} ${120 + waistW * 0.4} ${waistY}`} stroke="#ba6446" strokeWidth="2.5" fill="none" />
                    <circle cx={120 + neckW * 0.4} cy={neckY} r="3.5" fill="#ba6446" />
                    <circle cx={120 + waistW * 0.4} cy={waistY} r="3.5" fill="#ba6446" />
                  </>
                )}

                {/* Waist Tape (Point 5) */}
                <path d={`M ${120 - waistW} ${waistY} Q 120 ${waistY + 5} ${120 + waistW} ${waistY}`} stroke={activeId === 5 ? '#ba6446' : 'transparent'} strokeWidth={activeId === 5 ? '4.5' : '0'} strokeDasharray="4,2" fill="none" className="transition-all duration-300" />
                {activeId === 5 && (
                  <>
                    <path d={`M ${120 - waistW} ${waistY} Q 120 ${waistY + 5} ${120 + waistW} ${waistY}`} stroke="#ba6446" strokeWidth="2.5" fill="none" />
                    <circle cx={120 - waistW} cy={waistY} r="3.5" fill="#ba6446" />
                    <circle cx={120 + waistW} cy={waistY} r="3.5" fill="#ba6446" />
                  </>
                )}

                {/* Hip Tape (Point 6) */}
                <path d={`M ${120 - hipsW} ${hipsY} Q 120 ${hipsY + 5} ${120 + hipsW} ${hipsY}`} stroke={activeId === 6 ? '#ba6446' : 'transparent'} strokeWidth={activeId === 6 ? '4.5' : '0'} strokeDasharray="4,2" fill="none" className="transition-all duration-300" />
                {activeId === 6 && (
                  <>
                    <path d={`M ${120 - hipsW} ${hipsY} Q 120 ${hipsY + 5} ${120 + hipsW} ${hipsY}`} stroke="#ba6446" strokeWidth="2.5" fill="none" />
                    <circle cx={120 - hipsW} cy={hipsY} r="3.5" fill="#ba6446" />
                    <circle cx={120 + hipsW} cy={hipsY} r="3.5" fill="#ba6446" />
                  </>
                )}

                {/* Inseam Tape (Point 7) */}
                <path d={`M 112 ${bottomY} L 112 425`} stroke={activeId === 7 ? '#ba6446' : 'transparent'} strokeWidth={activeId === 7 ? '4.5' : '0'} fill="none" className="transition-all duration-300" />
                {activeId === 7 && (
                  <>
                    <path d={`M 112 ${bottomY} L 112 425`} stroke="#ba6446" strokeWidth="2.5" fill="none" />
                    <circle cx="112" cy={bottomY} r="3.5" fill="#ba6446" />
                    <circle cx="112" cy="425" r="3.5" fill="#ba6446" />
                  </>
                )}
              </svg>

              {/* DYNAMIC POSITION BUTTON HOTSPOTS IN ABSOLUTE PERCENTAGE SPACE */}
              {hotspots.map((spot) => (
                <button
                  key={spot.id}
                  onClick={() => handleSelectPosition(spot.id)}
                  style={{
                    left: `calc(${(spot.x / 240) * 100}% - 13px)`,
                    top: `calc(${(spot.y / 450) * 100}% - 13px)`,
                  }}
                  className={`absolute w-6.5 h-6.5 rounded-full border flex items-center justify-center font-bold text-[10px] transition-all z-20 cursor-pointer ${
                    activeId === spot.id
                      ? 'bg-bark-900 border-bark-900 text-sand-50 shadow-md scale-110'
                      : 'bg-white border-sand-300 text-bark-800 hover:bg-sand-100 hover:scale-105 shadow-3xs'
                  }`}
                  id={`hotspot-position-${spot.id}`}
                  title={spot.title}
                >
                  {spot.id}
                </button>
              ))}

              {/* Position A and B indicators for Neck Girth */}
              {activeId === 1 && (
                <>
                  <span
                    style={{
                      left: `calc(${( (120 - neckW * 0.9) / 240) * 100}% - 13px)`,
                      top: `calc(${( (neckY + 4) / 450) * 100}% - 18px)`,
                    }}
                    className="absolute bg-[#f9f5eb] border border-clay-300 text-bark-900 text-[9px] px-1.5 py-0.5 rounded-[4px] z-20 font-mono font-bold shadow-2xs"
                  >
                    A
                  </span>
                  <span
                    style={{
                      left: `calc(${( (120 + neckW * 0.9) / 240) * 100}% - 1px)`,
                      top: `calc(${( (neckY + 4) / 450) * 100}% - 18px)`,
                    }}
                    className="absolute bg-[#f9f5eb] border border-clay-300 text-bark-900 text-[9px] px-1.5 py-0.5 rounded-[4px] z-20 font-mono font-bold shadow-2xs"
                  >
                    B
                  </span>
                </>
              )}

            </div>

            {/* INTERACTIVE GARMENT STYLING & TEXTILE SELECTORS */}
            <div className="w-full mt-6 border-t border-sand-200/60 pt-4 space-y-4 relative z-20">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-clay-605 tracking-widest uppercase font-mono">
                  Style Visualizer Engine
                </span>
                <h4 className="text-xs font-serif font-bold text-bark-950 tracking-tight leading-tight">
                  Garment Style Overlay & Sizing Fit-Check
                </h4>
              </div>

              {/* Garment Style Selector Tabs */}
              <div className="grid grid-cols-5 gap-1 bg-sand-100 p-0.5 rounded-[4px] border border-sand-250/70 shadow-3xs">
                {[
                  { id: 'none', label: 'Bare' },
                  { id: 'dress', label: 'Dress' },
                  { id: 'trench', label: 'Coat' },
                  { id: 'trousers', label: 'Pants' },
                  { id: 'blouse', label: 'Top' },
                ].map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedGarmentStyle(style.id)}
                    className={`py-1 rounded-[3px] text-[10px] font-sans font-bold cursor-pointer transition-all ${
                      selectedGarmentStyle === style.id
                        ? 'bg-white text-bark-900 border border-sand-200 shadow-3xs'
                        : 'text-bark-550 hover:bg-white/50 hover:text-bark-800'
                    }`}
                    type="button"
                  >
                    {style.label}
                  </button>
                ))}
              </div>

              {selectedGarmentStyle !== 'none' && (
                <div className="grid grid-cols-2 gap-3" id="garment-fabric-color-controls">
                  {/* Fabric Grain Selector */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-sans font-bold text-bark-500 uppercase tracking-wider block">
                      Textile Fabric
                    </label>
                    <select
                      value={garmentFabric}
                      onChange={(e) => setGarmentFabric(e.target.value)}
                      className="w-full text-[10.5px] font-sans font-medium bg-white border border-sand-250 rounded-[3px] px-2 py-1 text-bark-800 focus:outline-hidden focus:ring-1 focus:ring-clay-500 cursor-pointer shadow-3xs"
                    >
                      <option value="silk">Silk Crepe (Glossy)</option>
                      <option value="linen">Natural Linen (Weave)</option>
                      <option value="denim">Denim Twill (Structured)</option>
                      <option value="wool">Merino Wool (Crosshatch)</option>
                    </select>
                  </div>

                  {/* Designer Color Swatches */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-sans font-bold text-bark-500 uppercase tracking-wider block">
                      Colorway
                    </label>
                    <div className="flex items-center gap-1.5 py-1">
                      {[
                        { color: '#ba6446', label: 'Terracotta' },
                        { color: '#4d6051', label: 'Forest' },
                        { color: '#2f3e46', label: 'Slate' },
                        { color: '#cca959', label: 'Saffron' },
                        { color: '#f5eedc', label: 'Oatmeal' },
                      ].map((item) => (
                        <button
                          key={item.color}
                          onClick={() => setGarmentColor(item.color)}
                          style={{ backgroundColor: item.color }}
                          className={`w-4 h-4 rounded-full border cursor-pointer transition-all relative ${
                            garmentColor === item.color
                              ? 'ring-2 ring-clay-600 ring-offset-1 scale-110 border-black/30'
                              : 'border-black/10 hover:scale-105'
                          }`}
                          title={item.label}
                          type="button"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* LIVE FIT DIAGNOSTICS & Tailor ADVICE */}
              <div className="bg-[#FCFAF7] border border-sand-250/80 rounded-[4px] p-3 space-y-2.5 shadow-3xs text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-bark-800 uppercase tracking-widest font-mono flex items-center gap-1">
                    <Scissors className="w-3.5 h-3.5 text-clay-605" /> Perfect Fit Analysis
                  </span>
                  <span className="px-1.5 py-0.5 rounded-[2px] text-[8px] font-mono font-bold uppercase tracking-wider bg-[#FAF0E6] text-clay-700 border border-clay-300/40">
                    {activeMetricSize.size ? `Size ${activeMetricSize.size} Recommendation` : 'Custom draft'}
                  </span>
                </div>

                {/* Sizing ease bars */}
                <div className="space-y-1.5">
                  {[
                    { label: 'Bust Ease Tolerance', value: selectedGarmentStyle === 'none' ? 0 : fitDiagnostics.bustEase, min: 2.0, max: 6.0, desc: 'Chest ease' },
                    { label: 'Waist Ease Tolerance', value: selectedGarmentStyle === 'none' ? 0 : fitDiagnostics.waistEase, min: 1.5, max: 4.5, desc: 'Midsection ease' },
                    { label: 'Hips Ease Tolerance', value: selectedGarmentStyle === 'none' ? 0 : fitDiagnostics.hipsEase, min: 2.5, max: 7.0, desc: 'Pelvic seat ease' },
                  ].map((bar) => {
                    const pct = Math.max(10, Math.min(100, ((bar.value) / bar.max) * 100));
                    let colorClass = 'bg-clay-605';
                    let labelStatus = 'Perfect Ease';

                    if (selectedGarmentStyle === 'none') {
                      colorClass = 'bg-sand-300';
                      labelStatus = 'Bare Form';
                    } else if (bar.value < bar.min) {
                      colorClass = 'bg-amber-600';
                      labelStatus = 'Snug / Low Ease';
                    } else if (bar.value > bar.max) {
                      colorClass = 'bg-teal-700';
                      labelStatus = 'Generous / Fluid';
                    }

                    return (
                      <div key={bar.label} className="space-y-0.5">
                        <div className="flex justify-between text-[8px] font-mono font-bold text-bark-500">
                          <span>{bar.label}</span>
                          <span className={selectedGarmentStyle !== 'none' && bar.value < bar.min ? 'text-amber-700' : 'text-bark-550'}>
                            {selectedGarmentStyle === 'none' ? '—' : `+${bar.value.toFixed(1)}"`} ({labelStatus})
                          </span>
                        </div>
                        <div className="w-full h-1 bg-sand-200 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${colorClass}`} style={{ width: `${selectedGarmentStyle === 'none' ? 0 : pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live tailored diagnostics alert banner */}
                <div className="bg-white border border-sand-200 rounded p-2 text-[9.5px] leading-relaxed text-bark-600 font-sans font-medium">
                  {selectedGarmentStyle === 'none' ? (
                    <p className="italic text-bark-450">
                      Select a garment style above to overlay a 3D couture simulation and inspect draping ease tolerances based on your live measurement values.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-bark-800">
                        {fitDiagnostics.alerts.length > 0 ? (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-clay-605 shrink-0" />
                        )}
                        <span>Perfect Fit Assessment:</span>
                      </div>
                      <p className="text-bark-750 font-sans leading-relaxed">
                        {fitDiagnostics.alerts.length > 0 ? fitDiagnostics.alerts.join(' ') : 'Excellent ease match! The pattern matches your form elegantly with professional drape tolerance. No sizing adjustments are needed.'}
                      </p>
                      <div className="text-[9px] text-clay-800 font-mono border-t border-sand-150/80 pt-1.5 mt-1 flex items-start gap-1">
                        <Scissors className="w-3 h-3 text-clay-605 shrink-0 mt-0.5" />
                        <span><b>Tailoring Instruction:</b> {fitDiagnostics.tailoringAdvice}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sizing profile persistence buttons */}
                {activeMetricSize.size && (
                  <button
                    onClick={() => {
                      if (onRecommendedSizeChange) {
                        onRecommendedSizeChange(activeMetricSize.size);
                      }
                      localStorage.setItem('sartorial_sizing_profile', JSON.stringify({
                        bust,
                        waist,
                        hips,
                        height,
                        unit,
                        recommendedSize: activeMetricSize.size
                      }));
                      if (window.showToast) {
                        window.showToast(`Applied custom sizing profile (Size ${activeMetricSize.size}) to store!`, 'success');
                      }
                    }}
                    className="w-full bg-bark-900 hover:bg-bark-850 text-sand-50 py-1.5 rounded-[3px] text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1 shadow-3xs active:scale-[0.98] mt-2"
                    id="apply-calculated-size-btn"
                    type="button"
                  >
                    <Check className="w-3 h-3 text-clay-400 shrink-0" />
                    Apply Size {activeMetricSize.size} to Shop
                  </button>
                )}
              </div>
            </div>

          </div> {/* Closing mannequin-main-interactive-container */}

        </div>

        {/* RIGHT COLUMN: MERGED METRIC MATRIX + CUSTOM CALCULATOR */}
        <div className="col-span-12 lg:col-span-6 xl:col-span-7 space-y-6" id="matrix-explorer-wrapper">

          {/* REGION A: STANDARD MEASUREMENT MATRIX (AUTO HIGHLIGHTED ROW) */}
          <div className="bg-white border border-sand-200/80 rounded-[4px] p-5 space-y-4 shadow-3xs" id="standard-matrix-panel">
            <h3 className="text-sm font-serif font-semibold text-bark-900 uppercase tracking-widest flex items-center gap-2">
              <Layers className="w-4 h-4 text-clay-605" /> Standard Size Conversion Matrix
            </h3>

            <div className="space-y-2.5" id="matrix-position-rows-stack">
              {MEASUREMENT_POSITIONS.map((position) => {
                const isOpen = position.id === activeId;
                const posDetails = getActiveDetails(position.id);
                const matchingRow = posDetails ? getMatchingRow(position, posDetails.value, unit) : null;

                return (
                  <div
                    key={position.id}
                    className={`border rounded-[4px] overflow-hidden transition-all duration-300 ${
                      isOpen
                        ? 'border-clay-500 bg-clay-50/10 shadow-3xs'
                        : 'border-sand-200/80 hover:border-sand-300 bg-white'
                    }`}
                    id={`matrix-position-row-${position.id}`}
                  >
                    {/* Collapsed Trigger Button */}
                    <button
                      onClick={() => setActiveId(isOpen ? null : position.id)}
                      className="w-full text-left p-3.5 flex items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="space-y-0.5">
                        <span className={`text-[9px] font-bold uppercase tracking-widest block font-mono ${isOpen ? 'text-clay-605' : 'text-bark-400'}`}>
                          {position.label}
                        </span>
                        <p className={`text-sm font-bold ${isOpen ? 'text-bark-950 font-serif' : 'text-bark-800 font-sans'}`}>
                          {position.name}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {!isOpen && (
                          <span className="text-[10px] text-bark-500 hidden md:inline max-w-[200px] truncate">
                            {position.description}
                          </span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-bark-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Table opened under selected position */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden border-t border-sand-200/60 bg-white"
                        >
                          <div className="p-3.5 space-y-3.5">
                            {/* Tape helper prompt */}
                            <div className="bg-sand-50/50 rounded-[4px] p-3 border border-sand-200/60 flex items-start gap-2.5">
                              <Info className="w-3.5 h-3.5 text-clay-605 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs text-bark-800 leading-relaxed font-sans">
                                  {position.description}
                                </p>
                                <p className="text-[9px] font-mono font-bold text-clay-700 uppercase tracking-widest mt-0.5">
                                  {position.tapeHelp}
                                </p>
                              </div>
                            </div>

                            {/* Direct Inline custom size input & slider inside chart/matrix block */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-sand-50/70 border border-sand-200/60 rounded-[4px] p-3">
                              <div className="space-y-0.5">
                                <span className="text-[9px] font-mono font-bold text-clay-700 uppercase tracking-wider block">
                                  Interactive Fine Adjuster
                                </span>
                                <p className="text-xs font-semibold text-bark-900 font-serif">
                                  Set Custom {position.name}
                                </p>
                              </div>

                              <div className="flex items-center gap-3">
                                {/* Slider */}
                                <input
                                  type="range"
                                  min={activeDetails.min}
                                  max={activeDetails.max}
                                  step={activeDetails.step}
                                  value={activeDetails.value}
                                  onChange={(e) => activeDetails.setValue(parseFloat(e.target.value))}
                                  className="w-24 sm:w-32 h-1 bg-sand-200 rounded appearance-none cursor-pointer accent-clay-605"
                                />

                                {/* Manual Input */}
                                <div className="flex items-center bg-white border border-sand-200/80 rounded-[4px] overflow-hidden h-7 shadow-3xs px-1">
                                  <input
                                    type="number"
                                    min={activeDetails.min}
                                    max={activeDetails.max}
                                    step={activeDetails.step}
                                    value={activeDetails.value}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      if (!isNaN(val)) {
                                        activeDetails.setValue(parseFloat(Math.min(activeDetails.max, Math.max(activeDetails.min, val)).toFixed(1)));
                                      }
                                    }}
                                    className="w-11 text-center text-xs font-mono font-bold bg-transparent border-0 focus:ring-0 focus:outline-hidden p-0 text-bark-900"
                                  />
                                  <span className="text-[9px] text-bark-400 font-mono pr-0.5">{unit}</span>
                                </div>
                              </div>
                            </div>

                            {/* Inner conversion table */}
                            <div className="overflow-x-auto rounded-[4px] border border-sand-200/60">
                              <table className="w-full text-left text-[11px] text-bark-750 border-collapse">
                                <thead>
                                  <tr className="border-b border-sand-200 text-bark-500 uppercase font-bold bg-sand-50/70 font-mono tracking-widest text-[9px]">
                                    <th className="py-2 px-3">Size</th>
                                    <th className="py-2 px-3">{position.name}</th>
                                    <th className="py-2 px-3 text-center">EU</th>
                                    <th className="py-2 px-3 text-center">UK</th>
                                    <th className="py-2 px-3 text-center">US</th>
                                    <th className="py-2 px-3 text-center">FR</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-sand-100 font-sans font-medium">
                                  {position.matrix.map((row) => {
                                    const isRowMatched = matchingRow && row.size === matchingRow.size;
                                    return (
                                      <tr
                                        key={row.size}
                                        className={isRowMatched
                                          ? "bg-clay-50/50 border-y border-clay-200/50 font-bold text-clay-950"
                                          : "hover:bg-sand-50/50 transition-colors text-bark-800"
                                        }
                                      >
                                        <td className="py-2 px-3 flex items-center gap-1">
                                          <span className={isRowMatched ? "text-clay-700 font-bold" : "text-bark-900"}>{row.size}</span>
                                          {isRowMatched && (
                                            <span className="text-[7px] font-mono font-bold uppercase tracking-wider bg-clay-100 text-clay-800 px-1 py-0.2 rounded shrink-0">Matched</span>
                                          )}
                                        </td>
                                        <td className={`py-2 px-3 font-mono ${isRowMatched ? 'text-clay-800 font-bold' : 'text-bark-600'}`}>{row.range}</td>
                                        <td className="py-2 px-3 text-center font-mono">{row.eu}</td>
                                        <td className="py-2 px-3 text-center font-mono">{row.uk}</td>
                                        <td className="py-2 px-3 text-center font-mono">{row.us}</td>
                                        <td className="py-2 px-3 text-center font-mono">{row.fr}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* REGION B: BESPOKE ATELIER FITTING SHEET & WORKSPACE */}
          <div className="bg-white border border-sand-200/80 rounded-[4px] p-5 space-y-5 shadow-3xs" id="custom-sliders-panel">

            {/* Header of fitting sheet */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-sand-200/60 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-serif font-semibold text-bark-900 uppercase tracking-widest flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-clay-605" /> Bespoke Fitting Sheet
                </h3>
                <p className="text-[10px] text-bark-500 font-medium">
                  Dynamic couture measurement blueprint calculated in real-time.
                </p>
              </div>
              <span className="text-[8px] font-bold text-clay-700 bg-clay-50 border border-clay-100/60 px-2 py-0.5 rounded-[4px] uppercase font-mono tracking-wider">
                Workspace Standard
              </span>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6" id="sliders-inner-columns">

              {/* Left Column: Ledger cards */}
              <div className="md:col-span-7 space-y-4" id="atelier-specs-at-a-glance">
                <h4 className="text-[10px] font-mono font-bold text-bark-400 uppercase tracking-widest">
                  Custom Measurements Ledger (Click to edit)
                </h4>

                <div className="grid grid-cols-2 gap-3">

                  {/* Point 1 */}
                  <button
                    onClick={() => handleSelectPosition(1)}
                    className={`p-2.5 rounded-[4px] border text-left transition-all cursor-pointer ${activeId === 1 ? 'bg-clay-50/20 border-clay-300 ring-1 ring-clay-100' : 'bg-sand-50/20 border-sand-200 hover:border-sand-300'}`}
                  >
                    <span className="text-[8px] font-mono font-bold text-bark-400 block uppercase">1. Neck Girth</span>
                    <strong className="text-xs font-mono text-bark-900 font-bold block mt-0.5">{neck} {unit}</strong>
                  </button>

                  {/* Point 2 */}
                  <button
                    onClick={() => handleSelectPosition(2)}
                    className={`p-2.5 rounded-[4px] border text-left transition-all cursor-pointer ${activeId === 2 ? 'bg-clay-50/20 border-clay-300 ring-1 ring-clay-100' : 'bg-sand-50/20 border-sand-200 hover:border-sand-300'}`}
                  >
                    <span className="text-[8px] font-mono font-bold text-bark-400 block uppercase">2. Shoulder Length</span>
                    <strong className="text-xs font-mono text-bark-900 font-bold block mt-0.5">{shoulder} {unit}</strong>
                  </button>

                  {/* Point 3 */}
                  <button
                    onClick={() => handleSelectPosition(3)}
                    className={`p-2.5 rounded-[4px] border text-left transition-all cursor-pointer ${activeId === 3 ? 'bg-clay-50/20 border-clay-300 ring-1 ring-clay-100' : 'bg-sand-50/20 border-sand-200 hover:border-sand-300'}`}
                  >
                    <span className="text-[8px] font-mono font-bold text-bark-400 block uppercase">3. Bust Girth</span>
                    <strong className="text-xs font-mono text-bark-900 font-bold block mt-0.5">{bust} {unit}</strong>
                  </button>

                  {/* Point 4 */}
                  <button
                    onClick={() => handleSelectPosition(4)}
                    className={`p-2.5 rounded-[4px] border text-left transition-all cursor-pointer ${activeId === 4 ? 'bg-clay-50/20 border-clay-300 ring-1 ring-clay-100' : 'bg-sand-50/20 border-sand-200 hover:border-sand-300'}`}
                  >
                    <span className="text-[8px] font-mono font-bold text-bark-400 block uppercase">4. Front Waist</span>
                    <strong className="text-xs font-mono text-bark-900 font-bold block mt-0.5">{frontWaist} {unit}</strong>
                  </button>

                  {/* Point 5 */}
                  <button
                    onClick={() => handleSelectPosition(5)}
                    className={`p-2.5 rounded-[4px] border text-left transition-all cursor-pointer ${activeId === 5 ? 'bg-clay-50/20 border-clay-300 ring-1 ring-clay-100' : 'bg-sand-50/20 border-sand-200 hover:border-sand-300'}`}
                  >
                    <span className="text-[8px] font-mono font-bold text-bark-400 block uppercase">5. Waist Girth</span>
                    <strong className="text-xs font-mono text-bark-900 font-bold block mt-0.5">{waist} {unit}</strong>
                  </button>

                  {/* Point 6 */}
                  <button
                    onClick={() => handleSelectPosition(6)}
                    className={`p-2.5 rounded-[4px] border text-left transition-all cursor-pointer ${activeId === 6 ? 'bg-clay-50/20 border-clay-300 ring-1 ring-clay-100' : 'bg-sand-50/20 border-sand-200 hover:border-sand-300'}`}
                  >
                    <span className="text-[8px] font-mono font-bold text-bark-400 block uppercase">6. Hip Girth</span>
                    <strong className="text-xs font-mono text-bark-900 font-bold block mt-0.5">{hips} {unit}</strong>
                  </button>

                  {/* Point 7 */}
                  <button
                    onClick={() => handleSelectPosition(7)}
                    className={`p-2.5 rounded-[4px] border text-left transition-all cursor-pointer ${activeId === 7 ? 'bg-clay-50/20 border-clay-300 ring-1 ring-clay-100' : 'bg-sand-50/20 border-sand-200 hover:border-sand-300'}`}
                  >
                    <span className="text-[8px] font-mono font-bold text-bark-400 block uppercase">7. Inseam Leg</span>
                    <strong className="text-xs font-mono text-bark-900 font-bold block mt-0.5">{inseam} {unit}</strong>
                  </button>

                  {/* Height */}
                  <div className="p-2.5 rounded-[4px] border border-sand-200 bg-sand-50/40 flex flex-col justify-between">
                    <div>
                      <span className="text-[8px] font-mono font-bold text-bark-400 block uppercase">Body Height</span>
                      <strong className="text-xs font-mono text-bark-900 font-bold block mt-0.5">
                        {unit === 'in'
                          ? `${Math.floor(height / 12)}'${height % 12}"`
                          : `${height} cm`}
                      </strong>
                    </div>
                    <input
                      type="range"
                      min={unit === 'in' ? 58 : 147}
                      max={unit === 'in' ? 74 : 188}
                      step={1}
                      value={height}
                      onChange={(e) => setHeight(parseInt(e.target.value))}
                      className="w-full h-1 mt-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-clay-605"
                    />
                  </div>

                </div>
              </div>

              {/* Right Column: Recommended standard breakdown */}
              <div className="md:col-span-5 bg-sand-50/50 rounded-[4px] p-4 flex flex-col justify-between border border-sand-200/60" id="bespoke-output-breakdown">
                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-clay-700 uppercase tracking-widest bg-clay-50 border border-clay-100/60 px-2 py-0.5 rounded-[4px] inline-block font-mono text-[9px]">
                    Graded Sizing Advice
                  </span>

                  <div className="grid grid-cols-3 gap-2" id="calc-badges">
                    <div className="bg-white border border-sand-200 rounded-[4px] p-2 text-center" id="badge-bust-rec">
                      <span className="text-[8px] uppercase tracking-wider text-bark-450 block">Bust</span>
                      <strong className="text-xs font-serif text-bark-900 block font-bold mt-0.5">Size {recommendation.bustRec}</strong>
                    </div>
                    <div className="bg-white border border-sand-200 rounded-[4px] p-2 text-center">
                      <span className="text-[8px] uppercase tracking-wider text-bark-450 block">Waist</span>
                      <strong className="text-xs font-serif text-bark-900 block font-bold mt-0.5">Size {recommendation.waistRec}</strong>
                    </div>
                    <div className="bg-white border border-sand-200 rounded-[4px] p-2 text-center">
                      <span className="text-[8px] uppercase tracking-wider text-bark-450 block">Hips</span>
                      <strong className="text-xs font-serif text-bark-900 block font-bold mt-0.5">Size {recommendation.hipsRec}</strong>
                    </div>
                  </div>

                  {/* Standard Size Fit Index: Dynamic range bars comparing user measurements to standard ranges */}
                  <div className="space-y-3 bg-white border border-sand-200/60 rounded-[4px] p-3 shadow-3xs" id="measurement-range-feedback">
                    <span className="text-[8.5px] font-mono font-bold text-bark-450 uppercase tracking-widest block border-b border-sand-100 pb-1.5">
                      Standard Size Fit Index
                    </span>

                    {[
                      {
                        label: 'Bust Girth',
                        val: parsedMeasurements.bust,
                        min: 32,
                        max: 49,
                        lowBound: 28,
                        highBound: 54,
                        displayVal: `${bust} ${unit}`,
                        id: 'bust-indicator'
                      },
                      {
                        label: 'Waist Girth',
                        val: parsedMeasurements.waist,
                        min: 24,
                        max: 41,
                        lowBound: 20,
                        highBound: 45,
                        displayVal: `${waist} ${unit}`,
                        id: 'waist-indicator'
                      },
                      {
                        label: 'Hip Girth',
                        val: parsedMeasurements.hips,
                        min: 34,
                        max: 51,
                        lowBound: 30,
                        highBound: 55,
                        displayVal: `${hips} ${unit}`,
                        id: 'hips-indicator'
                      }
                    ].map((metric) => {
                      const totalSpan = metric.highBound - metric.lowBound;

                      // Calculate standard range percentages
                      const stdStartPct = ((metric.min - metric.lowBound) / totalSpan) * 100;
                      const stdEndPct = ((metric.max - metric.lowBound) / totalSpan) * 100;
                      const stdWidthPct = stdEndPct - stdStartPct;

                      // Calculate user val percentage
                      const userPct = Math.max(0, Math.min(100, ((metric.val - metric.lowBound) / totalSpan) * 100));

                      // Determine sizing feedback status
                      let statusText = '';
                      let statusBadgeColor = '';
                      let needleColor = '';

                      if (metric.val < metric.min) {
                        statusText = 'Too Small';
                        statusBadgeColor = 'bg-amber-50 text-amber-800 border-amber-200/50';
                        needleColor = 'bg-amber-500';
                      } else if (metric.val > metric.max) {
                        statusText = 'Need Larger Size';
                        statusBadgeColor = 'bg-clay-50 text-clay-800 border-clay-200/50';
                        needleColor = 'bg-clay-500';
                      } else {
                        statusText = 'Just Right';
                        statusBadgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200/50';
                        needleColor = 'bg-emerald-500';
                      }

                      return (
                        <div key={metric.label} className="space-y-1" id={metric.id}>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-serif font-medium text-bark-800">{metric.label}</span>
                            <div className="flex items-center gap-1.5 font-mono">
                              <span className="text-bark-900 font-bold">{metric.displayVal}</span>
                              <span className={`text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${statusBadgeColor}`}>
                                {statusText}
                              </span>
                            </div>
                          </div>

                          {/* Progress/Indicator Scale with Zone Highlighting */}
                          <div className="relative h-2 bg-sand-100 rounded-full overflow-hidden">
                            {/* Standard Range highlighted segment */}
                            <div
                              className="absolute h-full bg-emerald-500/10 border-x border-dashed border-emerald-500/20"
                              style={{ left: `${stdStartPct}%`, width: `${stdWidthPct}%` }}
                            />

                            {/* Filled trace line up to user point */}
                            <div
                              className={`absolute h-full rounded-l-full opacity-35 ${needleColor}`}
                              style={{ left: '0%', width: `${userPct}%` }}
                            />

                            {/* Animated User Value Needle/Pointer */}
                            <motion.div
                              className={`absolute top-0 bottom-0 w-1.5 shadow-2xs rounded-full border border-white -ml-0.75 ${needleColor}`}
                              style={{ left: `${userPct}%` }}
                              animate={{ left: `${userPct}%` }}
                              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                            />
                          </div>

                          {/* Numeric ranges labels under the scale */}
                          <div className="flex justify-between text-[7.5px] text-bark-400 font-mono leading-none pt-0.5">
                            <span>Min: {unit === 'cm' ? Math.round(metric.min * 2.54) : metric.min} {unit} (Size 0)</span>
                            <span className="text-emerald-700/80 font-bold uppercase tracking-wider text-[6.5px]">Standard Fit Zone</span>
                            <span>Max: {unit === 'cm' ? Math.round(metric.max * 2.54) : metric.max} {unit} (Size 22)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-bark-900 font-serif">
                      {recommendation.summary}
                    </h5>
                    <p className="text-[10.5px] text-bark-650 leading-relaxed font-sans font-medium">
                      {recommendation.advice}
                    </p>
                  </div>
                </div>

                <div className="border-t border-sand-200/60 pt-3 mt-3 text-[10px] text-bark-550 italic" id="height-advice-box">
                  {recommendation.heightAdvice}
                </div>
              </div>

            </div>
          </div>

          {/* REGION B.5: FABRIC YARDAGE CALCULATOR */}
          <FabricYardageCalculator selectedSize={activeMetricSize.size} onApplyYardage={handleApplyYardage} />

          {/* REGION C: ATELIER CLOUD VAULT - GOOGLE DRIVE SYNC */}
          <div className="bg-white border border-sand-200/80 rounded-[4px] p-5 space-y-4 shadow-3xs" id="google-drive-sync-panel">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-sand-200/60 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-serif font-semibold text-bark-900 uppercase tracking-widest flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-clay-605" /> Atelier Cloud Vault
                </h3>
                <p className="text-[10px] text-bark-500 font-medium">
                  Connect to Google Drive to backup your bespoke fitting sheets and download custom tailoring reports.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isSyncing && (
                  <RefreshCw className="w-3.5 h-3.5 text-clay-600 animate-spin" />
                )}
                {syncStatus && (
                  <span className="text-[10px] text-clay-750 font-medium bg-clay-50 border border-clay-100 px-2 py-0.5 rounded-[4px] animate-pulse">
                    {syncStatus}
                  </span>
                )}
              </div>
            </div>

            {!isDriveConnected ? (
              <div className="flex flex-col items-center justify-center py-6 px-4 bg-sand-50/20 border border-dashed border-sand-250 rounded-[4px] text-center space-y-3">
                <Cloud className="w-10 h-10 text-bark-300" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-bark-900">Google Drive Offline</h4>
                  <p className="text-[11px] text-bark-600 max-w-sm leading-normal">
                    Securely sign in with Google to enable cloud backups, restore saved measurement ledgers, and export print-ready markdown specifications directly to your Drive workspace.
                  </p>
                </div>
                <button
                  onClick={handleGoogleDriveSignIn}
                  disabled={isSyncing}
                  className="bg-bark-900 hover:bg-bark-850 text-sand-50 text-xs font-semibold px-4 py-2 rounded-full transition-all cursor-pointer flex items-center gap-2"
                >
                  <LogIn className="w-3.5 h-3.5" /> Sign in with Google Workspace
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Active connection details & Quick actions */}
                <div className="md:col-span-5 space-y-4">
                  <div className="bg-sand-50/40 border border-sand-200/80 rounded-[4px] p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Cloud Active
                      </span>
                      <button
                        onClick={handleGoogleDriveLogout}
                        className="text-[10px] text-clay-650 hover:text-clay-605 font-medium underline flex items-center gap-1 cursor-pointer"
                        title="Disconnect Account"
                      >
                        <LogOut className="w-3 h-3" /> Disconnect
                      </button>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      {driveUser?.photoURL ? (
                        <img
                          src={driveUser.photoURL}
                          alt={driveUser.displayName || 'Google User'}
                          className="w-10 h-10 rounded-full border border-sand-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-clay-100 text-clay-800 font-bold flex items-center justify-center text-xs">
                          {driveUser?.displayName ? driveUser.displayName.slice(0, 2).toUpperCase() : 'GD'}
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-bark-900">{driveUser?.displayName || 'Google Workspace User'}</h4>
                        <p className="text-[10px] text-bark-500 font-mono truncate max-w-[180px]">{driveUser?.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleBackupLedger}
                      disabled={isSyncing}
                      className="w-full bg-clay-650 hover:bg-clay-600 text-white text-xs font-semibold py-2 px-3 rounded-[4px] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
                    >
                      <UploadCloud className="w-4 h-4" /> Backup Sizing Ledger
                    </button>
                    <button
                      onClick={handleSaveReport}
                      disabled={isSyncing}
                      className="w-full bg-white border border-sand-300 hover:bg-sand-50 text-bark-800 text-xs font-semibold py-2 px-3 rounded-[4px] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-clay-605" /> Generate Tailoring Report
                    </button>
                  </div>
                </div>

                {/* Cloud storage backups lists */}
                <div className="md:col-span-7 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-mono font-bold text-bark-400 uppercase tracking-widest">
                      Saved Workspace Files on Google Drive
                    </h4>
                    <button
                      onClick={fetchDriveFiles}
                      disabled={isLoadingFiles || isSyncing}
                      className="text-[10px] text-bark-500 hover:text-bark-900 transition-colors flex items-center gap-1 font-mono uppercase"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingFiles ? 'animate-spin' : ''}`} /> Sync List
                    </button>
                  </div>

                  {isLoadingFiles ? (
                    <div className="flex items-center justify-center py-10 bg-sand-50/10 border border-sand-150 rounded-[4px]">
                      <RefreshCw className="w-5 h-5 text-clay-600 animate-spin" />
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 bg-sand-50/10 border border-dashed border-sand-200 rounded-[4px] text-center px-4">
                      <p className="text-xs text-bark-500 italic">No Perfect Fit Bureau backups found on your Drive.</p>
                      <p className="text-[10px] text-bark-450 mt-1">Click "Backup Sizing Ledger" to save your first cloud record.</p>
                    </div>
                  ) : (
                    <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1" id="drive-files-list">
                      {driveFiles.map((file) => {
                        const isJson = file.mimeType === 'application/json';
                        return (
                          <div
                            key={file.id}
                            className="p-2.5 rounded-[4px] border border-sand-200 bg-white hover:border-sand-350 transition-all flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileText className={`w-4 h-4 shrink-0 ${isJson ? 'text-clay-600' : 'text-bark-500'}`} />
                              <div className="min-w-0">
                                <span className="font-bold text-bark-900 block truncate" title={file.name}>
                                  {file.name}
                                </span>
                                <span className="text-[9px] font-mono text-bark-400 block">
                                  Modified: {new Date(file.modifiedTime).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isJson ? (
                                <button
                                  onClick={() => handleRestoreLedger(file)}
                                  disabled={isSyncing}
                                  className="bg-sand-100 hover:bg-sand-200 text-bark-900 text-[10px] font-semibold px-2 py-1 rounded-[4px] transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Restore custom measurements from this backup"
                                >
                                  <DownloadCloud className="w-3 h-3" /> Restore
                                </button>
                              ) : (
                                <span className="text-[9px] text-bark-400 bg-sand-50 border border-sand-100 px-1.5 py-0.5 rounded-[4px] font-mono">
                                  Markdown
                                </span>
                              )}
                              <button
                                onClick={() => handleDeleteFile(file)}
                                disabled={isSyncing}
                                className="p-1 text-bark-400 hover:text-clay-650 hover:bg-clay-50 rounded-[4px] transition-colors border border-transparent hover:border-clay-100 cursor-pointer"
                                title="Delete file from Google Drive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
          </div>

          {/* Standards note */}
          <div className="text-[10px] text-bark-450 bg-sand-100/50 p-3.5 rounded-[4px] border border-sand-200 italic" id="matrix-foot-note">
            Method reference: EN 13402 / ISO 8559 measurement alignment standard. Inputs dynamically sync size matching algorithms with the mannequin hotspot markers to suggest real-time paper adjustments.
          </div>

        </div>
      </div>
      );
    })()}

      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative z-10" id="guide-calculator-grid">
          {/* CALCULATOR COLUMN 1: BESPOKE INPUTS FORM */}
          <div className="col-span-12 lg:col-span-6 xl:col-span-5 bg-white border border-sand-200/80 p-6 sm:p-8 rounded-[4px] space-y-6 shadow-3xs flex flex-col justify-between" id="calculator-inputs-panel">
            <div className="space-y-6">
              <div className="border-b border-sand-200/60 pb-4">
                <h3 className="text-lg font-serif font-bold text-bark-950 tracking-tight">
                  Enter Your Measurements
                </h3>
                <p className="text-xs text-bark-550 mt-1 leading-relaxed">
                  Provide your core anatomical dimensions below. Our sizing algorithm cross-references standard sewing charts to map your ideal paper draft size.
                </p>
              </div>

              {/* Garment Focus Type (FITTING STANDARD CRUCIAL CONCEPT) */}
              <div className="space-y-2">
                <label className="text-[9px] font-mono font-bold text-bark-450 uppercase tracking-widest block">
                  Garment Blueprint Style Focus
                </label>
                <div className="grid grid-cols-3 gap-2" id="garment-focus-toggle">
                  {[
                    { id: 'tops', label: 'Tops & Dresses', desc: 'Prioritizes Bust' },
                    { id: 'bottoms', label: 'Skirts & Pants', desc: 'Prioritizes Hips' },
                    { id: 'balanced', label: 'Balanced Blend', desc: 'Weighted Average' },
                  ].map((focus) => (
                    <button
                      key={focus.id}
                      onClick={() => {
                        setGarmentFocus(focus.id);
                        if (window.showToast) {
                          window.showToast(`Silhouette focus adjusted to: ${focus.label}.`, 'info');
                        }
                      }}
                      className={`p-2 rounded-[4px] border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                        garmentFocus === focus.id
                          ? 'border-clay-605 bg-clay-50/20 shadow-3xs'
                          : 'border-sand-200 bg-[#FAF9F6]/40 hover:bg-[#FAF9F6] hover:border-sand-300'
                      }`}
                      type="button"
                    >
                      <span className={`text-[10px] font-bold ${garmentFocus === focus.id ? 'text-clay-800' : 'text-bark-800'}`}>
                        {focus.label}
                      </span>
                      <span className="text-[7.5px] font-mono text-bark-400 font-semibold uppercase tracking-tight leading-none">
                        {focus.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Sizing Presets Row */}
              <div className="space-y-2 bg-[#F3ECE0]/30 border border-sand-250/60 rounded-[4px] p-3 mb-4" id="quick-presets-wrapper">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-sans font-extrabold text-bark-800 uppercase tracking-wider">Quick Sizing Presets</span>
                  <span className="text-[7.5px] font-mono font-bold text-clay-700 bg-clay-50/50 border border-clay-100/60 px-1.5 py-0.5 rounded uppercase">Standard Grade</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 4, 8, 12, 16, 20].map((szNum) => {
                    const row = MASTER_SIZING_TABLE.find((r) => r.size === szNum.toString());
                    const targetBust = row ? row.bust : 36.0;
                    const isMatched = row && Math.abs(getImperialValue(bust) - targetBust) < 0.5;

                    return (
                      <button
                        key={szNum}
                        onClick={() => row && handleApplySizingPreset(row)}
                        className={`flex-1 min-w-[50px] px-2 py-1.5 rounded-[4px] text-[10px] font-serif font-bold border transition-all cursor-pointer text-center ${
                          isMatched
                            ? 'bg-clay-605 text-white border-clay-605 shadow-3xs'
                            : 'bg-[#FAF9F6]/80 text-bark-850 border-sand-250 hover:bg-[#FAF9F6] hover:border-sand-350'
                        }`}
                        type="button"
                        title={`Load Size ${szNum} measurements and scale ratios`}
                      >
                        Size {szNum}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Core Measurement Inputs Stack */}
              <div className="space-y-5">

                {/* Input 1: Bust */}
                <div className="space-y-2" id="calc-input-bust">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-clay-50 border border-clay-100 text-clay-700 flex items-center justify-center font-serif text-[10px] font-bold">
                        3
                      </span>
                      <span className="text-xs font-serif font-bold text-bark-900">Bust/Chest Girth</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={unit === 'in' ? 30.0 : 76.0}
                        max={unit === 'in' ? 52.0 : 132.0}
                        step={0.5}
                        value={bust}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) setBust(val);
                        }}
                        className="w-12 text-right text-xs font-mono font-bold bg-transparent border-b border-sand-250 focus:border-clay-500 focus:outline-hidden p-0.5 text-bark-900"
                      />
                      <span className="text-[9px] font-mono font-bold text-bark-400 uppercase">{unit}</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={unit === 'in' ? 30.0 : 76.0}
                    max={unit === 'in' ? 52.0 : 132.0}
                    step={0.5}
                    value={bust}
                    onChange={(e) => setBust(parseFloat(e.target.value))}
                    className="w-full h-1 bg-sand-200 rounded appearance-none cursor-pointer accent-clay-605"
                  />
                  <p className="text-[9.5px] text-bark-450 italic font-sans">
                    Measure over the fullest part of your chest, keeping tape level across back.
                  </p>
                </div>

                {/* Input 2: Waist */}
                <div className="space-y-2" id="calc-input-waist">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-clay-50 border border-clay-100 text-clay-700 flex items-center justify-center font-serif text-[10px] font-bold">
                        5
                      </span>
                      <span className="text-xs font-serif font-bold text-bark-900">Waist Girth</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={unit === 'in' ? 22.0 : 56.0}
                        max={unit === 'in' ? 44.0 : 112.0}
                        step={0.5}
                        value={waist}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) setWaist(val);
                        }}
                        className="w-12 text-right text-xs font-mono font-bold bg-transparent border-b border-sand-250 focus:border-clay-500 focus:outline-hidden p-0.5 text-bark-900"
                      />
                      <span className="text-[9px] font-mono font-bold text-bark-400 uppercase">{unit}</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={unit === 'in' ? 22.0 : 56.0}
                    max={unit === 'in' ? 44.0 : 112.0}
                    step={0.5}
                    value={waist}
                    onChange={(e) => setWaist(parseFloat(e.target.value))}
                    className="w-full h-1 bg-sand-200 rounded appearance-none cursor-pointer accent-clay-605"
                  />
                  <p className="text-[9.5px] text-bark-450 italic font-sans">
                    Measure around your natural narrowest waistline, between ribs and hip bones.
                  </p>
                </div>

                {/* Input 3: Hips */}
                <div className="space-y-2" id="calc-input-hips">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-clay-50 border border-clay-100 text-clay-700 flex items-center justify-center font-serif text-[10px] font-bold">
                        6
                      </span>
                      <span className="text-xs font-serif font-bold text-bark-900">Hip Girth</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={unit === 'in' ? 32.0 : 81.0}
                        max={unit === 'in' ? 54.0 : 137.0}
                        step={0.5}
                        value={hips}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) setHips(val);
                        }}
                        className="w-12 text-right text-xs font-mono font-bold bg-transparent border-b border-sand-250 focus:border-clay-500 focus:outline-hidden p-0.5 text-bark-900"
                      />
                      <span className="text-[9px] font-mono font-bold text-bark-400 uppercase">{unit}</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={unit === 'in' ? 32.0 : 81.0}
                    max={unit === 'in' ? 54.0 : 137.0}
                    step={0.5}
                    value={hips}
                    onChange={(e) => setHips(parseFloat(e.target.value))}
                    className="w-full h-1 bg-sand-200 rounded appearance-none cursor-pointer accent-clay-605"
                  />
                  <p className="text-[9.5px] text-bark-450 italic font-sans">
                    Measure around the fullest point of your hips and seat standing naturally.
                  </p>
                </div>

                {/* Input 4: Height */}
                <div className="space-y-2" id="calc-input-height">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-sand-100 border border-sand-250 text-bark-800 flex items-center justify-center font-mono text-[9px] font-bold">
                        H
                      </span>
                      <span className="text-xs font-serif font-bold text-bark-900">Body Height</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-bark-800 font-bold">
                        {unit === 'in'
                          ? `${Math.floor(height / 12)}'${height % 12}"`
                          : `${height} cm`}
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={unit === 'in' ? 58 : 147}
                    max={unit === 'in' ? 74 : 188}
                    step={1}
                    value={height}
                    onChange={(e) => setHeight(parseInt(e.target.value))}
                    className="w-full h-1 bg-sand-200 rounded appearance-none cursor-pointer accent-clay-605"
                  />
                  <p className="text-[9.5px] text-bark-450 italic font-sans">
                    Height is used to calculate lengthening or shortening slash lines on your pattern.
                  </p>
                </div>

              </div>
            </div>

            {/* Quick Actions at Bottom */}
            <div className="pt-6 border-t border-sand-200/60 flex items-center justify-between gap-4">
              <button
                onClick={() => {
                  setBust(unit === 'in' ? 36.0 : 91.5);
                  setWaist(unit === 'in' ? 28.0 : 71.0);
                  setHips(unit === 'in' ? 38.0 : 96.5);
                  setHeight(unit === 'in' ? 65.0 : 165);
                  if (window.showToast) {
                    window.showToast('Measurements reset to Atelier Base Sizing profile.', 'info');
                  }
                }}
                className="text-xs font-bold text-bark-500 hover:text-bark-900 hover:underline cursor-pointer flex items-center gap-1 font-mono uppercase"
                type="button"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reset Intake Form
              </button>

              <button
                onClick={() => handleUnitChange(unit === 'in' ? 'cm' : 'in')}
                className="bg-sand-50 border border-sand-250 text-bark-800 hover:bg-sand-100 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
                type="button"
              >
                <Ruler className="w-3 h-3 text-clay-605" /> Switch Unit to {unit === 'in' ? 'cm' : 'in'}
              </button>
            </div>
          </div>

          {/* CALCULATOR COLUMN 2: RECOMMENDATIONS & CHARTS */}
          <div className="col-span-12 lg:col-span-6 xl:col-span-7 space-y-6" id="calculator-results-panel">

            {/* Verdict Card */}
            <div className="bg-[#FAF8F5] border border-clay-300 rounded-[4px] p-6 shadow-3xs space-y-4 relative overflow-hidden" id="calculator-verdict-card">
              <div className="absolute right-0 top-0 w-32 h-32 opacity-[0.03] bg-[radial-gradient(#887857_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />

              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl md:text-2xl font-serif font-light text-bark-950 tracking-tight leading-none">
                    Ideal Pattern Size: <b className="font-bold text-clay-800">Size {blendedSize}</b>
                  </h3>
                  <p className="text-[11px] font-mono text-bark-500 uppercase tracking-wider">
                    {recommendation.summary}
                  </p>
                </div>

                <div className="bg-white border border-clay-200/60 rounded-[4px] p-2 flex flex-col items-center justify-center min-w-[100px] shadow-3xs shrink-0">
                  <span className="text-[7.5px] uppercase tracking-wider text-bark-400 font-bold block leading-none">Target Draft</span>
                  <strong className="text-3xl font-serif font-black text-clay-750 block leading-none mt-1.5">Size {blendedSize}</strong>
                </div>
              </div>

              {/* Dynamic Sizing Gradients Explanation */}
              <div className="space-y-2 bg-white/60 border border-sand-200/50 p-4 rounded-[4px]">
                <div className="flex items-start gap-2.5 text-xs text-bark-750 leading-relaxed font-sans">
                  <Scissors className="w-4 h-4 text-clay-605 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-bark-900">Custom Paper Fitting Adjustments:</p>
                    <p className="mt-1">{recommendation.advice}</p>
                    <p className="mt-2 text-[10.5px] text-clay-750 border-t border-sand-100 pt-2 font-medium flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0 text-clay-600" />
                      {recommendation.heightAdvice}
                    </p>
                  </div>
                </div>
              </div>

              {/* Apply Button */}
              <button
                onClick={() => {
                  if (onRecommendedSizeChange) {
                    onRecommendedSizeChange(blendedSize);
                  }
                  localStorage.setItem('sartorial_sizing_profile', JSON.stringify({
                    bust,
                    waist,
                    hips,
                    height,
                    unit,
                    recommendedSize: blendedSize,
                    garmentFocus,
                    timestamp: new Date().toISOString()
                  }));
                  if (window.showToast) {
                    window.showToast(`Applied custom fitting profile (Size ${blendedSize}) as your standard shopping filter!`, 'success');
                  }
                }}
                className="w-full bg-bark-900 hover:bg-bark-850 text-sand-50 py-3 rounded-[3px] text-xs font-bold uppercase tracking-widest cursor-pointer transition-all flex items-center justify-center gap-2 shadow-2xs active:scale-[0.98]"
                type="button"
                id="apply-calculated-size-btn-calc"
              >
                <Check className="w-4 h-4 text-clay-400 shrink-0" />
                Apply Size {blendedSize} to Active Shop Filter
              </button>
            </div>

            {/* Standard Sewing Chart Sizing Grid */}
            <div className="bg-white border border-sand-200 p-5 space-y-4 rounded-[4px] shadow-3xs" id="calculator-sewing-chart">
              <div className="flex justify-between items-center border-b border-sand-200 pb-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-serif font-semibold text-bark-900 uppercase tracking-widest flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-clay-650" /> Standard Sewing Sizing Chart
                  </h4>
                  <p className="text-[10px] text-bark-450 leading-none">
                    Cross-referenced matching rows highlighted below based on your measurements.
                  </p>
                </div>
                <span className="text-[7.5px] font-mono bg-sand-50 border border-sand-150 px-2 py-0.5 rounded-[3px] font-bold text-bark-500 uppercase">
                  Imperial (Inches)
                </span>
              </div>

              <div className="overflow-x-auto rounded-[4px] border border-sand-200">
                <table className="w-full text-left text-[11px] text-bark-750 border-collapse">
                  <thead>
                    <tr className="border-b border-sand-200 text-bark-500 uppercase font-bold bg-sand-50/70 font-mono tracking-widest text-[9px]">
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3">Bust Girth</th>
                      <th className="py-2.5 px-3">Waist Girth</th>
                      <th className="py-2.5 px-3">Hip Girth</th>
                      <th className="py-2.5 px-3 text-center font-bold">EU</th>
                      <th className="py-2.5 px-3 text-center font-bold">US</th>
                      <th className="py-2.5 px-3 text-center font-bold">UK</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100 font-sans font-medium text-xs">
                    {MASTER_SIZING_TABLE.map((row) => {
                      const isBustMatch = row.size === recommendation.bustRec;
                      const isWaistMatch = row.size === recommendation.waistRec;
                      const isHipsMatch = row.size === recommendation.hipsRec;
                      const isBlendedRecommendation = row.size === blendedSize;

                      return (
                        <tr
                          key={row.size}
                          onClick={() => handleApplySizingPreset(row)}
                          className={`cursor-pointer select-none transition-all duration-200 ${
                            isBlendedRecommendation
                              ? "bg-clay-50/70 hover:bg-clay-100/60 border-y border-clay-200/50 font-bold text-clay-950"
                              : "hover:bg-sand-100/50 text-bark-800"
                          }`}
                          title={`Click to load Size ${row.size} measurements into the mannequin`}
                        >
                          <td className="py-2.5 px-3 flex items-center gap-1.5">
                            <span className={isBlendedRecommendation ? "text-clay-700 font-bold" : "text-bark-900"}>
                              {row.size}
                            </span>
                            {isBlendedRecommendation && (
                              <span className="text-[7px] font-mono font-bold uppercase tracking-wider bg-clay-100 text-clay-850 px-1.5 py-0.2 rounded shrink-0">
                                Best Match
                              </span>
                            )}
                          </td>
                          <td className={`py-2.5 px-3 font-mono ${isBustMatch ? 'text-clay-650 font-extrabold bg-clay-50/30' : 'text-bark-600'}`}>
                            {row.bust}"
                          </td>
                          <td className={`py-2.5 px-3 font-mono ${isWaistMatch ? 'text-clay-650 font-extrabold bg-clay-50/30' : 'text-bark-600'}`}>
                            {row.waist}"
                          </td>
                          <td className={`py-2.5 px-3 font-mono ${isHipsMatch ? 'text-clay-650 font-extrabold bg-clay-50/30' : 'text-bark-600'}`}>
                            {row.hips}"
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-stone-500">
                            {parseInt(row.size) + 32}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-stone-500">
                            {row.size}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-stone-500">
                            {parseInt(row.size) + 4}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Fabric Yardage sync-integration quick preview */}
              <div className="bg-sand-100/40 border border-sand-200/60 p-4 rounded-[4px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[8px] uppercase tracking-wider text-bark-400 font-bold block leading-none font-mono">
                    Fabric Yardage Calculator Link
                  </span>
                  <p className="font-semibold text-bark-900 font-serif">
                    Recommended Fabric length for Size {blendedSize}:
                  </p>
                  <p className="text-bark-550 text-[11px]">
                    Updating your sizes automatically scales the material requirements under the Fabric panel below.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const el = document.getElementById('fabric-yardage-calc-card');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-white hover:bg-sand-50 border border-sand-250 text-bark-800 text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-[4px] cursor-pointer transition-colors shrink-0 font-mono shadow-2xs"
                  type="button"
                >
                  Configure Yardage Now
                </button>
              </div>

              {/* Cloud Quick Backup Link */}
              {isDriveConnected && (
                <div className="bg-clay-50/30 border border-clay-200/45 p-4 rounded-[4px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-[8px] uppercase tracking-wider text-clay-700 font-bold block leading-none font-mono">
                      Cloud Vault Synchronization
                    </span>
                    <p className="font-semibold text-bark-900 font-serif">
                      Your Cloud connection is currently active.
                    </p>
                    <p className="text-bark-550 text-[11px]">
                      Quickly backup these size dimensions to your Google Drive directory workspace.
                    </p>
                  </div>
                  <button
                    onClick={handleBackupLedger}
                    disabled={isSyncing}
                    className="bg-clay-650 hover:bg-clay-600 text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-[4px] cursor-pointer transition-colors shrink-0 font-mono shadow-3xs flex items-center gap-1.5"
                    type="button"
                  >
                    <UploadCloud className="w-3 h-3" /> Quick Cloud Save
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {activeTab === 'arOverlay' && (
        <ArOverlayVisualizer />
      )}

    </div>
  );
}
