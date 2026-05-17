import React, { useEffect, useMemo, useRef, useState } from "react";
import "./HeroViewportSlider.css";

function mod(n, m) {
  return ((n % m) + m) % m;
}

function normalizeSlides(slides) {
  return Array.isArray(slides)
    ? slides.filter((slide) => slide && slide.image).map((slide, index) => ({ id: slide.id || `slide-${index + 1}`, ...slide }))
    : [];
}

export default function HeroViewportSlider({
  slides: slidesProp,
  className = "",
  autoPlay = true,
  intervalMs = 6800,
  pauseAfterManualMs = 11000,
  minHeight = "clamp(430px, 72vh, 760px)",
  ariaLabel = "Hero slider",
  onCta,
}) {
  const slides = useMemo(() => normalizeSlides(slidesProp), [slidesProp]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const pointerXRef = useRef(0);
  const interactingAtRef = useRef(0);

  useEffect(() => {
    if (!slides.length) return;
    setActive((prev) => mod(prev, slides.length));
  }, [slides.length]);

  const markManual = () => {
    interactingAtRef.current = Date.now();
  };

  const go = (step, manual = false) => {
    if (slides.length < 2) return;
    if (manual) markManual();
    setActive((prev) => mod(prev + step, slides.length));
  };

  const jump = (index) => {
    if (!slides.length) return;
    markManual();
    setActive(mod(index, slides.length));
  };

  useEffect(() => {
    if (!autoPlay || slides.length < 2) return undefined;
    const tickMs = Math.max(2800, Number(intervalMs) || 6800);
    const idleWindowMs = Math.max(tickMs, Number(pauseAfterManualMs) || 11000);
    const id = setInterval(() => {
      if (paused) return;
      if (Date.now() - interactingAtRef.current < idleWindowMs) return;
      go(1, false);
    }, tickMs);
    return () => clearInterval(id);
  }, [autoPlay, intervalMs, pauseAfterManualMs, paused, slides.length]);

  if (!slides.length) return null;

  return (
    <section
      className={`hero-slider ${className}`.trim()}
      style={{ minHeight }}
      aria-label={ariaLabel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onPointerDown={(event) => {
        pointerXRef.current = event.clientX ?? 0;
      }}
      onPointerUp={(event) => {
        const delta = (event.clientX ?? 0) - pointerXRef.current;
        if (Math.abs(delta) < 28) return;
        go(delta < 0 ? 1 : -1, true);
      }}
    >
      <div className="hero-slider-track" role="presentation">
        {slides.map((slide, index) => {
          const isActive = index === active;
          const overlay = slide.overlay === "center" ? "is-overlay-center" : "is-overlay-left";
          return (
            <article
              key={slide.id}
              className={`hero-slide ${isActive ? "is-active" : ""}`}
              aria-hidden={!isActive}
              style={{ backgroundImage: `url(${slide.image})` }}
            >
              <div className={`hero-slide-overlay ${overlay}`} />
              <div className="hero-slide-content">
                {slide.eyebrow ? <p className="hero-slide-eyebrow">{slide.eyebrow}</p> : null}
                {slide.title ? <h1>{slide.title}</h1> : null}
                {slide.subtitle ? <p className="hero-slide-subtitle">{slide.subtitle}</p> : null}
                {slide.ctaLabel ? (
                  onCta ? (
                    <button
                      type="button"
                      className="hero-slide-cta"
                      onClick={() => onCta(slide)}
                    >
                      {slide.ctaLabel}
                    </button>
                  ) : (
                    <a className="hero-slide-cta" href={slide.ctaUrl || "#"}>
                      {slide.ctaLabel}
                    </a>
                  )
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {slides.length > 1 ? (
        <>
          <button type="button" className="hero-slider-nav is-prev" onClick={() => go(-1, true)} aria-label="Previous slide">
            &#8249;
          </button>
          <button type="button" className="hero-slider-nav is-next" onClick={() => go(1, true)} aria-label="Next slide">
            &#8250;
          </button>

          <div className="hero-slider-dots" role="tablist" aria-label="Hero slides">
            {slides.map((slide, index) => (
              <button
                key={`${slide.id}-dot`}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-label={`Go to slide ${index + 1}`}
                className={`hero-slider-dot ${index === active ? "is-active" : ""}`}
                onClick={() => jump(index)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
