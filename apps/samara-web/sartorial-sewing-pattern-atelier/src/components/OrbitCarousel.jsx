/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Check
} from 'lucide-react';
import InstructionsPdfModal from './InstructionsPdfModal';
import PatternQuickViewModal from './PatternQuickViewModal';

export default function OrbitCarousel({
  patterns,
  activePatternId,
  setActivePatternId,
  activeRecommendedSize,
  onAddToCart,
  reviews = {},
  onAddReview,
  currentUser,
  detailTab: externalDetailTab,
  setDetailTab: externalSetDetailTab,
  onQuickView,
  quickViewPattern: propQuickViewPattern,
  onCloseQuickView
}) {
  const activeIndex = patterns.findIndex((p) => p.id === activePatternId);
  const safeActiveIndex = activeIndex !== -1 ? activeIndex : 0;
  const currentPattern = patterns[safeActiveIndex];

  const [isMobile, setIsMobile] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);

  // Quick View Modal Management
  const [internalQuickViewPattern, setInternalQuickViewPattern] = useState(null);
  const activeQuickViewPattern = propQuickViewPattern !== undefined ? propQuickViewPattern : internalQuickViewPattern;

  const handleOpenQuickView = (patternToView) => {
    setAutoRotate(false);
    const targetPattern = patternToView || currentPattern;
    if (onQuickView) {
      onQuickView(targetPattern);
    } else {
      setInternalQuickViewPattern(targetPattern);
    }
  };

  const handleCloseQuickView = () => {
    if (onCloseQuickView) {
      onCloseQuickView();
    }
    setInternalQuickViewPattern(null);
    setAutoRotate(true);
  };

  const prevQuickViewPatternRef = useRef(activeQuickViewPattern);
  useEffect(() => {
    if (prevQuickViewPatternRef.current && !activeQuickViewPattern) {
      setAutoRotate(true);
    } else if (activeQuickViewPattern) {
      setAutoRotate(false);
    }
    prevQuickViewPatternRef.current = activeQuickViewPattern;
  }, [activeQuickViewPattern]);

  const timerRef = useRef(null);

  // Responsive check for orbit radii
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Autoplay rotation
  useEffect(() => {
    // If auto-rotation is disabled, or stage is hovered, or quick view modal is open, stop timer
    if (!autoRotate || isHovered || !!activeQuickViewPattern) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setActivePatternId((prevId) => {
        const idx = patterns.findIndex((p) => p.id === prevId);
        const nextIdx = (idx !== -1 ? idx + 1 : 0) % patterns.length;
        return patterns[nextIdx].id;
      });
    }, 8000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRotate, isHovered, activeQuickViewPattern, patterns, setActivePatternId]);

  const handlePrev = () => {
    setAutoRotate(false);
    const prevIdx = (safeActiveIndex - 1 + patterns.length) % patterns.length;
    setActivePatternId(patterns[prevIdx].id);
  };

  const handleNext = () => {
    setAutoRotate(false);
    const nextIdx = (safeActiveIndex + 1) % patterns.length;
    setActivePatternId(patterns[nextIdx].id);
  };

  const handleCardClick = (idx) => {
    setAutoRotate(false);
    setActivePatternId(patterns[idx].id);
  };

  // Difficulty badge styling helper
  const getDifficultyColor = (diff) => {
    switch (diff) {
      case 'Beginner':
        return 'bg-sage-50 text-sage-800 border-sage-200';
      case 'Intermediate':
        return 'bg-clay-50 text-clay-800 border-clay-250';
      case 'Advanced':
        return 'bg-sand-100/60 text-sand-800 border-sand-300';
      default:
        return 'bg-sand-50 text-bark-600 border-sand-200';
    }
  };

  // Math dimensions for the orbit
  const radiusX = isMobile ? 100 : 280;
  const radiusY = isMobile ? 22 : 45;
  const N = patterns.length;

  return (
    <div className="space-y-12" id="orbit-carousel-outer-wrapper">

      {/* SECTION HEADER WITH INTRO */}
      <div className="text-center max-w-2xl mx-auto space-y-3" id="orbit-header-block">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-bark-950 font-light tracking-tight leading-[1.12]" id="orbit-title">
          Our <span className="font-serif italic text-clay-600 font-normal">Signature Collection</span>
        </h2>
        <p className="text-base sm:text-lg md:text-xl font-serif italic text-bark-650 tracking-wide font-normal leading-relaxed max-w-2xl mx-auto" id="orbit-description">
          Discover Our Most Celebrated Bespoke Creations: Step Into Your Spotlight
        </p>
      </div>

      {/* THE 3D ORBIT STAGE */}
      <div
        className="relative h-[340px] md:h-[420px] bg-sand-100/10 rounded-[4px] overflow-hidden flex items-center justify-center shadow-inner"
        id="orbit-carousel-stage"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Pedestal drawing at the center of orbit */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-[20px] md:translate-y-[45px] w-[180px] md:w-[320px] h-[50px] md:h-[90px] bg-[radial-gradient(ellipse_at_center,rgba(136,120,87,0.12)_0%,transparent_70%)] rounded-full blur-xs pointer-events-none" id="orbit-center-glow" />

        {/* Ring layout illustrating the fictive orbit circle */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-dashed border-sand-300/60 rounded-full pointer-events-none"
          style={{
            width: `${radiusX * 2}px`,
            height: `${radiusY * 2}px`,
            transform: `translate(-50%, -50%)`,
          }}
          id="orbit-fictive-ring"
        />

        {/* Orbit Cards Container */}
        <div className="relative w-full h-full" id="orbit-cards-container">
          {patterns.map((pattern, i) => {
            // Calculate angle for this pattern
            // offsetAngle shifts the activeIndex to the front (angle = 0)
            const offsetAngle = -(2 * Math.PI / N) * safeActiveIndex;
            const theta = (2 * Math.PI / N) * i + offsetAngle;

            // Coordinates relative to center of stage
            const x = Math.sin(theta) * radiusX;
            const y = Math.cos(theta) * radiusY;

            // Depth cues
            // cos(theta) is 1 at front, -1 at back
            const normalizedDepth = (Math.cos(theta) + 1) / 2; // 0 to 1
            const isFront = safeActiveIndex === i;
            let scale = isMobile
              ? 0.72 + 0.28 * normalizedDepth
              : 0.75 + 0.35 * normalizedDepth;

            if (isFront) {
              scale *= 1.15; // Show focus by making it a bit bigger (zoomed in a bit)
            }

            const opacity = 0.45 + 0.55 * normalizedDepth;
            const zIndex = Math.round(10 + 20 * normalizedDepth);

            return (
              <div
                key={pattern.id}
                onClick={() => handleCardClick(i)}
                className={`absolute left-1/2 top-1/2 transition-all duration-700 ease-out cursor-pointer ${
                  isFront ? 'drop-shadow-xl' : 'drop-shadow-md hover:drop-shadow-lg'
                }`}
                style={{
                  transform: `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px - 20px), 0) scale(${scale})`,
                  zIndex: zIndex,
                  opacity: opacity,
                  pointerEvents: 'auto',
                }}
                id={`orbit-card-element-${pattern.id}`}
              >
                {/* Visual Garment Card with Full Background Picture */}
                <div
                  className={`w-[140px] sm:w-[170px] md:w-[220px] aspect-[3/4.2] bg-white border rounded-[4px] overflow-hidden relative transition-all duration-500 flex flex-col justify-end ${
                    isFront
                      ? 'border-sand-300 shadow-lux'
                      : 'border-sand-250 hover:border-sand-350 shadow-md'
                  }`}
                  id={`orbit-card-inner-${pattern.id}`}
                >
                  {/* Full Background Image */}
                  <img
                    src={pattern.image}
                    alt={pattern.name}
                    className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none z-0"
                    referrerPolicy="no-referrer"
                  />

                  {/* Gradient Overlay for Text Readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent z-10 pointer-events-none" />

                  {/* Size range indicator at the top of card */}
                  <div className="absolute top-2.5 left-2.5 z-20" id={`orbit-size-tag-${pattern.id}`}>
                    <span
                      id={`orbit-card-category-tag-${pattern.id}`}
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      className="bg-bark-900/90 backdrop-blur-xs text-sand-50 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[4px] cursor-text focus:outline-none"
                    >
                      {pattern.category}
                    </span>
                  </div>

                  {/* Difficulty tag */}
                  <div className="absolute top-2.5 right-2.5 z-20" id={`orbit-diff-tag-${pattern.id}`}>
                    <span
                      id={`orbit-card-difficulty-tag-${pattern.id}`}
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      className={`text-[9px] font-medium border px-2 py-0.5 rounded-[4px] backdrop-blur-xs cursor-text focus:outline-none ${getDifficultyColor(pattern.difficulty)}`}
                    >
                      {pattern.difficulty}
                    </span>
                  </div>

                  {/* Active item selection marker */}
                  {isFront && (
                    <div
                      className="absolute inset-0 flex items-center justify-center z-25 pointer-events-none"
                      id="orbit-front-overlay"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenQuickView(pattern);
                        }}
                        className="bg-clay-605 hover:bg-clay-705 text-sand-50 p-2.5 rounded-full shadow-xl animate-bounce cursor-pointer border border-sand-100/40 transition-all hover:scale-110 active:scale-95 group/check focus:outline-none focus:ring-2 focus:ring-clay-400 pointer-events-auto"
                        id="active-star"
                        title={`Quick View ${pattern.name}`}
                        aria-label={`Quick View ${pattern.name}`}
                      >
                        <Check className="w-5 h-5 stroke-[2.5] group-hover/check:scale-110 transition-transform" />
                      </button>
                    </div>
                  )}

                  {/* Pattern Caption overlaid on the image background */}
                  <div className="p-3 bg-transparent flex flex-col justify-between z-20 relative text-white" id="orbit-card-caption">
                    <h4 className="font-serif text-xs sm:text-sm font-semibold text-white truncate leading-tight drop-shadow-sm">
                      {pattern.name}
                    </h4>
                    <span className="font-mono text-[9px] sm:text-[10px] text-sand-200 font-bold mt-0.5 leading-none">
                      From ${pattern.pricePDF.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Orbit Stage Side Controls */}
        <div className="absolute left-4 right-4 flex justify-between pointer-events-none z-30" id="orbit-stage-controls">
          <button
            onClick={handleNext}
            className="w-10 h-10 rounded-full bg-white/90 hover:bg-white border border-sand-200 text-bark-800 flex items-center justify-center transition-all hover:shadow-md cursor-pointer active:scale-95 pointer-events-auto"
            aria-label="Previous garment in orbit"
            id="orbit-arrow-prev"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handlePrev}
            className="w-10 h-10 rounded-full bg-white/90 hover:bg-white border border-sand-200 text-bark-800 flex items-center justify-center transition-all hover:shadow-md cursor-pointer active:scale-95 pointer-events-auto"
            aria-label="Next garment in orbit"
            id="orbit-arrow-next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Indicators Bar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2.5 z-30" id="orbit-indicator-dots">
          {patterns.map((_, idx) => (
            <button
              key={idx}
              onClick={() => handleCardClick(idx)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                safeActiveIndex === idx ? 'w-5 bg-clay-605' : 'w-2 bg-sand-300 hover:bg-sand-400'
              }`}
              title={`Focus on ${patterns[idx].name}`}
              id={`orbit-dot-${idx}`}
            />
          ))}
        </div>
      </div>

      {/* Instructions Sample PDF Modal */}
      <InstructionsPdfModal
        isOpen={isInstructionsModalOpen}
        onClose={() => setIsInstructionsModalOpen(false)}
        pattern={currentPattern}
      />

      {/* Internal fallback PatternQuickViewModal if not controlled externally */}
      {!onQuickView && internalQuickViewPattern && (
        <PatternQuickViewModal
          pattern={internalQuickViewPattern}
          onClose={handleCloseQuickView}
          onAddToCart={onAddToCart}
          reviews={reviews[internalQuickViewPattern.id] || []}
          onAddReview={onAddReview}
          currentUser={currentUser}
          allPatterns={patterns}
          onSelectPattern={(p) => setInternalQuickViewPattern(p)}
        />
      )}
    </div>
  );
}
