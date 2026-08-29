import { localizeMetadataTree } from '../../lib/localizedMetadata';
import { perfectFitMetadata } from '../../config/perfectFitMetadata';
import React, { useEffect, useState, useRef } from 'react';
import { translatePerfectFitText as pfUiT } from '../../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ChevronLeft, ChevronRight, X, Play, Info, HelpCircle } from 'lucide-react';

export default function OnboardingWalkthrough({
  step,
  setStep,
  onClose,
  setActiveTab,
  setMaterialsTab,
  setSewingTimerForceViewMode
}) {
  const WALKTHROUGH_STEPS = localizeMetadataTree(perfectFitMetadata.componentUi.onboarding.walkthroughSteps, 'component.onboarding.walkthroughSteps', pfUiT);

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
              <span className="text-[10px] font-mono font-bold text-bark-400 tracking-wider uppercase">{pfUiT("ui.components.subcomponents.onboardingwalkthrough.75e17d4218")}</span>
            </div>
            <button
              onClick={onClose}
              className="text-bark-400 hover:text-bark-900 transition-colors p-1 rounded-lg hover:bg-sand-50 cursor-pointer"
              title={pfUiT("ui.components.subcomponents.onboardingwalkthrough.afe8693805")}
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
              <span>{pfUiT("ui.components.subcomponents.onboardingwalkthrough.c77ae1ddbb")}</span>
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
