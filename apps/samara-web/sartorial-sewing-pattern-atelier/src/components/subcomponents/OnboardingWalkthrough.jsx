import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ChevronLeft, ChevronRight, X, Play, Info, HelpCircle } from 'lucide-react';

const WALKTHROUGH_STEPS = [
  {
    title: "✨ Perfect Fit Operations Onboarding",
    desc: "Welcome to the Perfect Fit Bureau guided tour! We'll show you how to master our core professional features: the Video Time & Motion Study (Industrial SAM calculation) and the Fabric Inventory Stock Ledger.",
    tab: "projects",
    highlightId: "consolidated-collaborator-workspace"
  },
  {
    title: "📊 Step 1: Video Time & Motion Study",
    desc: "We are switching to the Sewing Timer tab. Here you will find the advanced Time & Motion Study workspace used by tailoring industrial engineers to analyze stitching speed and operator efficiency.",
    tab: "timer",
    viewMode: "motionStudy",
    highlightId: "sewing-room-view-tabs"
  },
  {
    title: "🎥 Step 2: Telemetry Footage Sources",
    desc: "Use this dropdown selector to load high-definition footage of actual tailoring motions. You can select different operations like sleeve set-ins, hems, or pocket constructions to begin analysis.",
    tab: "timer",
    viewMode: "motionStudy",
    highlightId: "video-source-selector"
  },
  {
    title: "⏱️ Step 3: Playhead & Slow-Motion Precision",
    desc: "Examine complex stitch joins frame-by-frame. Adjust the playback speed to 0.25x or 0.5x slow-motion to pinpoint operator hand delay nodes or alignment bottlenecks.",
    tab: "timer",
    viewMode: "motionStudy",
    highlightId: "player-viewport-container"
  },
  {
    title: "🎯 Step 4: Instant Timestamp Triggers",
    desc: "Capture cycle timestamps with precision. Click the T1 (Start) and T2 (Finish) hotkey-buttons as you watch the footage to record the raw cycle durations of the stitching element.",
    tab: "timer",
    viewMode: "motionStudy",
    highlightId: "timestamp-shortcut-triggers"
  },
  {
    title: "🧮 Step 5: Industrial SAM Calculator",
    desc: "Enter the Performance Rating (%) and Personal, Fatigue & Delay (PF&D) Allowance (%) to compute the Standard Allowed Minutes (SAM) instantly. This syncs with our live production database.",
    tab: "timer",
    viewMode: "motionStudy",
    highlightId: "ops-study-grid-scroller"
  },
  {
    title: "🧵 Step 6: Textile Stock Ledger",
    desc: "Let's head over to the Supplies & Suppliers tab. This is where you manage textile rolls, fabric weights (GSM), in-stock levels, and supplier lead times.",
    tab: "supply",
    subTab: "inventory",
    highlightId: "tab-ctrl-supply"
  },
  {
    title: "📊 Step 7: Fiber Stock Metrics",
    desc: "At a glance, monitor Total Active Rolls, critical Low Stock Warnings, and Consolidated Yardage across all organic wool, silk, linen, and denim fabrics in the warehouse.",
    tab: "supply",
    subTab: "inventory",
    highlightId: "inventory-metrics-cards"
  },
  {
    title: "📝 Step 8: Active Roll Stock Ledger",
    desc: "View detailed specifications of each active roll. Adjust stock levels instantly by clicking +5 or -5 yard deltas, or check which fabrics have critical warnings.",
    tab: "supply",
    subTab: "inventory",
    highlightId: "inventory-ledger-table"
  },
  {
    title: "📥 Step 9: Receiving Dock",
    desc: "When new textile shipments arrive, use the Receiving Dock form to scan or register newly received material names, swatch colors, yardage, and cost-per-yard directly.",
    tab: "supply",
    subTab: "inventory",
    highlightId: "receiving-dock-sidebar"
  },
  {
    title: "🏆 Walkthrough Complete!",
    desc: "Congratulations! You have successfully completed the Perfect Fit Operator onboarding guide. You are now fully prepared to manage sewing operations, audit B2B supply lines, and conduct video time studies.",
    tab: "projects",
    highlightId: "consolidated-collaborator-workspace"
  }
];

export default function OnboardingWalkthrough({
  step,
  setStep,
  onClose,
  setActiveTab,
  setMaterialsTab,
  setSewingTimerForceViewMode
}) {
  const [highlightBounds, setHighlightBounds] = useState(null);
  const scrollTimeoutRef = useRef(null);

  const currentStepData = WALKTHROUGH_STEPS[step];

  // Monitor element position and update spotlight bounds
  const updateSpotlightBounds = () => {
    if (!currentStepData?.highlightId) {
      setHighlightBounds(null);
      return;
    }

    const element = document.getElementById(currentStepData.highlightId);
    if (element) {
      const rect = element.getBoundingClientRect();
      // Account for page scroll
      setHighlightBounds({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height
      });
    } else {
      setHighlightBounds(null);
    }
  };

  // Sync tab/view switches on step change, auto-scroll to highlight
  useEffect(() => {
    if (!currentStepData) return;

    // Apply state changes to navigate to relevant section
    if (currentStepData.tab) {
      setActiveTab(currentStepData.tab);
    }
    if (currentStepData.subTab) {
      setMaterialsTab(currentStepData.subTab);
    }
    if (currentStepData.viewMode) {
      setSewingTimerForceViewMode(currentStepData.viewMode);
    } else {
      setSewingTimerForceViewMode(null);
    }

    // Delay scroll and spotlight calculation to allow React to mount/render the tab content
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

    scrollTimeoutRef.current = setTimeout(() => {
      const targetElement = document.getElementById(currentStepData.highlightId);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
      updateSpotlightBounds();
    }, 250);

    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [step]);

  // Recalculate bounds on window resize/scroll
  useEffect(() => {
    window.addEventListener('resize', updateSpotlightBounds);
    window.addEventListener('scroll', updateSpotlightBounds);
    return () => {
      window.removeEventListener('resize', updateSpotlightBounds);
      window.removeEventListener('scroll', updateSpotlightBounds);
    };
  }, [step]);

  const handleNext = () => {
    if (step < WALKTHROUGH_STEPS.length - 1) {
      setStep(prev => prev + 1);
    } else {
      onClose();
      if (window.showToast) {
        window.showToast("Atelier operational tour finished successfully!", "success", "Tour Completed");
      }
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(prev => prev - 1);
    }
  };

  return (
    <>
      {/* 1. Global overlay background (excluding highlighted elements) */}
      <div
        className="fixed inset-0 bg-bark-950/25 backdrop-blur-xs z-[80] transition-all pointer-events-none"
        style={{
          clipPath: highlightBounds ? `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%,
            0% 0%,
            ${highlightBounds.left}px ${highlightBounds.top}px,
            ${highlightBounds.left}px ${highlightBounds.top + highlightBounds.height}px,
            ${highlightBounds.left + highlightBounds.width}px ${highlightBounds.top + highlightBounds.height}px,
            ${highlightBounds.left + highlightBounds.width}px ${highlightBounds.top}px,
            ${highlightBounds.left}px ${highlightBounds.top}px
          )` : undefined
        }}
      />

      {/* 2. Visual spotlight frame outlining target element */}
      {highlightBounds && (
        <motion.div
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="absolute border-3 border-amber-400 rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.6)] z-[81] pointer-events-none"
          style={{
            top: highlightBounds.top - 6,
            left: highlightBounds.left - 6,
            width: highlightBounds.width + 12,
            height: highlightBounds.height + 12,
          }}
        />
      )}

      {/* 3. Guide Card positioned relative to viewport or targeted element */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-[90]">
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          className="bg-white border-2 border-amber-400 rounded-2xl shadow-2xl p-5 relative overflow-hidden"
        >
          {/* Subtle warm decorative top-bar */}
          <div className="absolute top-0 inset-x-0 h-1 bg-amber-400" />

          {/* Guide Header */}
          <div className="flex items-center justify-between pb-3 border-b border-sand-150">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                Step {step + 1} of {WALKTHROUGH_STEPS.length}
              </span>
              <span className="text-[10px] font-mono font-bold text-bark-400 tracking-wider uppercase">Guide Assistant</span>
            </div>
            <button
              onClick={onClose}
              className="text-bark-400 hover:text-bark-900 transition-colors p-1 rounded-lg hover:bg-sand-50 cursor-pointer"
              title="End walkthrough"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Guide Body */}
          <div className="py-4 space-y-2">
            <h4 className="font-serif text-sm font-bold text-bark-950 flex items-center gap-1.5 leading-tight">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{currentStepData.title}</span>
            </h4>
            <p className="text-xs text-bark-650 leading-relaxed font-sans">
              {currentStepData.desc}
            </p>
          </div>

          {/* Guide Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-sand-150">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className={`text-xs font-bold font-mono px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                step === 0
                  ? 'text-bark-300 cursor-not-allowed'
                  : 'text-bark-600 hover:bg-sand-100 hover:text-bark-900 cursor-pointer'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            {/* Navigation Dots */}
            <div className="flex items-center gap-1">
              {WALKTHROUGH_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-350 ${
                    idx === step
                      ? 'bg-amber-500 w-3'
                      : 'bg-sand-250'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg shadow-3xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>{step === WALKTHROUGH_STEPS.length - 1 ? "Finish" : "Next"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
