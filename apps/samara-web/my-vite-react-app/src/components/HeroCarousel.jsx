import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { localizeMetadataTree } from '../lib/localizedMetadata';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Compass, Ruler, ArrowRight, Scissors, BookOpen, Star } from 'lucide-react';
import dressImg from '../assets/images/pattern_dress_1782223486101.jpg';
import trenchImg from '../assets/images/pattern_trench_1782223501914.jpg';
import trouserImg from '../assets/images/pattern_trouser_1782223515288.jpg';

export default function HeroCarousel({ onExploreCatalog, onOpenSizingCalculator }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoplay, setIsAutoplay] = useState(true);
  const heroCopy = localizeMetadataTree(perfectFitMetadata.componentUi.heroCarousel.slideCopy, 'component.heroCarousel.slideCopy', pfUiT);

  const slides = [
  {
    id: 0,
    title: (
      <>{pfUiT("ui.components.herocarousel.ca638e6222")}<br />
        <span className="font-serif italic text-clay-700 font-light block mt-1">{pfUiT("ui.components.herocarousel.c566fb7dc5")}</span>
      </>
    ),
    description: heroCopy[0].description,
    ctaText1: heroCopy[0].ctaPrimary,
    ctaText2: heroCopy[0].ctaSecondary,
    image: dressImg,
  },
  {
    id: 1,
    title: (
      <>{pfUiT("ui.components.herocarousel.7e701cd8f0")}<br />
        <span className="font-serif italic text-clay-700 font-light block mt-1">{pfUiT("ui.components.herocarousel.84fe93b5a3")}</span>
      </>
    ),
    description: heroCopy[1].description,
    ctaText1: heroCopy[1].ctaPrimary,
    ctaText2: heroCopy[1].ctaSecondary,
    image: trenchImg,
  },
  {
    id: 2,
    title: (
      <>{pfUiT("ui.components.herocarousel.f2df228bd0")}<br />
        <span className="font-serif italic text-clay-700 font-light block mt-1">{pfUiT("ui.components.herocarousel.e0098a0ea1")}</span>
      </>
    ),
    description: heroCopy[2].description,
    ctaText1: heroCopy[2].ctaPrimary,
    ctaText2: heroCopy[2].ctaSecondary,
    image: trouserImg,
  }
];

  // Autoplay Effect
  useEffect(() => {
    if (!isAutoplay) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [isAutoplay, slides.length]);

  const handlePrev = () => {
    setIsAutoplay(false);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    setIsAutoplay(false);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  return (
    <div
      className="relative bg-[#FAF9F5] overflow-hidden min-h-[520px] md:min-h-[580px] flex items-center"
      id="hero-carousel-container"
      onMouseEnter={() => setIsAutoplay(false)}
      onMouseLeave={() => setIsAutoplay(true)}
    >
      {/* Absolute grid and radial background accent */}
      <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-[0.04] bg-[radial-gradient(#887857_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" id="radial-background-accent" />
      <div className="absolute left-1/4 top-12 w-96 h-96 bg-clay-50/10 rounded-full blur-3xl pointer-events-none" id="blur-background-decor" />

      {/* Slide rendering */}
      <AnimatePresence mode="wait">
        {slides.map((slide, idx) => {
          if (idx !== currentSlide) return null;
          return (
            <motion.div
              key={slide.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className="absolute inset-0 flex items-center px-4 sm:px-6 lg:px-8 overflow-hidden"
              id={`hero-slide-${slide.id}`}
            >
              {/* Full Background Picture */}
              <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden" id={`hero-slide-bg-${slide.id}`}>
                <img
                  src={slide.image}
                  alt={pfUiT("ui.components.herocarousel.056382390e")}
                  className="w-full h-full object-cover object-center grayscale-[10%] brightness-[1.01] contrast-[0.99]"
                  style={{ transform: idx === currentSlide ? 'scale(1.02)' : 'scale(1)', transition: 'transform 8s ease-out' }}
                />
                {/* Custom Luxe Gradient Scrim to ensure text is fully legible */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#FAF9F5] via-[#FAF9F5]/90 to-transparent max-md:bg-[#FAF9F5]/85" />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#FAF9F5] to-transparent pointer-events-none" />
              </div>

              <div className="max-w-7xl mx-auto w-full relative z-10 py-12" id={`hero-slide-inner-${slide.id}`}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-center" id="hero-slide-grid">

                  {/* Left Column: Text & Editorial Content */}
                  <div className="md:col-span-8 lg:col-span-7 space-y-6 lg:space-y-8" id="hero-headline-block">
                    {/* Title */}
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif font-light text-bark-950 tracking-tight leading-[1.08] max-w-2xl" id="hero-title">
                      {slide.title}
                    </h1>

                    {/* Description */}
                    <p className="text-bark-600 text-base sm:text-lg md:text-xl max-w-xl leading-relaxed font-sans font-medium" id="hero-subtext">
                      {slide.description}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3.5 pt-2" id="hero-cta-buttons">
                      <button
                        onClick={() => {
                            onExploreCatalog();
                          
                        }}
                        className="bg-bark-900 hover:bg-bark-800 text-sand-50 font-medium text-xs px-5 py-3 rounded-full border border-bark-950 hover:border-bark-800 transition-all flex items-center gap-2.5 cursor-pointer font-sans tracking-widest uppercase active:scale-[0.98]"
                        id="hero-explore-btn"
                      >
                        {slide.ctaText1}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
  if (slide.ctaText2 === 'Find My Size') {
    onOpenSizingCalculator();
    return;
  }

  const element = document.getElementById('perfect-fit-specification-guide');
  if (element) element.scrollIntoView({ behavior: 'smooth' });
}}
                        className="bg-white/85 border border-sand-200 hover:bg-sand-50 text-bark-800 font-medium text-xs px-5 py-3 rounded-full transition-all flex items-center gap-2.5 cursor-pointer font-sans tracking-widest uppercase active:scale-[0.98]"
                        id="hero-sizing-btn"
                      >
                        {slide.ctaText2}
                        {slide.id === 0 ? (
                          <Ruler className="w-3.5 h-3.5 text-bark-500" />
                        ) : (
                          <Scissors className="w-3.5 h-3.5 text-bark-500" />
                        )}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Manual Indicators & Navigation Arrows */}
      <div className="absolute bottom-6 left-4 right-4 max-w-7xl mx-auto flex items-center justify-between pointer-events-none z-20 px-4 sm:px-6 lg:px-8" id="carousel-controls-container">
        {/* Indicators */}
        <div className="flex items-center gap-3 pointer-events-auto" id="carousel-dots">
          {slides.map((slide, idx) => (
            <button
              key={slide.id}
              onClick={() => {
                setIsAutoplay(false);
                setCurrentSlide(idx);
              }}
              className={`h-1.5 transition-all duration-300 cursor-pointer ${
                currentSlide === idx ? 'w-8 bg-clay-600' : 'w-3 bg-sand-200 hover:bg-sand-300'
              }`}
              title={`Slide ${idx + 1}`}
              id={`carousel-dot-${idx}`}
            />
          ))}
        </div>

        {/* Previous / Next buttons */}
        <div className="flex items-center gap-2 pointer-events-auto" id="carousel-arrows">
          <button
            onClick={handlePrev}
            className="w-10 h-10 rounded-full bg-white/90 hover:bg-white border border-sand-200 text-bark-700 flex items-center justify-center transition-all hover:shadow-xs cursor-pointer active:scale-95"
            aria-label={pfUiT("ui.components.herocarousel.4e51f53005")}
            id="carousel-arrow-prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            className="w-10 h-10 rounded-full bg-white/90 hover:bg-white border border-sand-200 text-bark-700 flex items-center justify-center transition-all hover:shadow-xs cursor-pointer active:scale-95"
            aria-label={pfUiT("ui.components.herocarousel.1c2db4b675")}
            id="carousel-arrow-next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
