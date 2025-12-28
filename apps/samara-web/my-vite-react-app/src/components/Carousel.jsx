// src/components/Carousel.jsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildElement, createNavApi, CAROUSEL_SLIDES } from "../config/navigation";

// Ensure each base slide has a stable key
let uniqueKeyCounter = 0;
function assignStableKeys(arr) {
  return arr.map((item) => ({
    ...item,
    key: item.key || `slide-${uniqueKeyCounter++}`,
  }));
}

// ms to wait after last manual interaction before autoplay resumes
const AUTO_RESUME_DELAY = 8000;

function Carousel({
  ariaLabel = "Featured content",
  autoPlay = true,
  intervalMs = 7000,
}) {
  // 1. Base slide descriptors from config (never change)
  const baseSlides = useMemo(
    () => assignStableKeys(CAROUSEL_SLIDES || []),
    []
  );
  const realCount = baseSlides.length;

  // 2. Extended slides with clones at start/end for seamless looping
  const extendedSlides = useMemo(() => {
    if (!realCount) return [];
    const first = baseSlides[0];
    const last = baseSlides[realCount - 1];
    return [
      { ...last, key: `clone-start-${last.key}` },
      ...baseSlides,
      { ...first, key: `clone-end-${first.key}` },
    ];
  }, [baseSlides, realCount]);

  const railCount = extendedSlides.length;

  // 3. Index in the extended rail (start at first real slide = 1)
  const [index, setIndex] = useState(() => (realCount ? 1 : 0));
  const [isImmediate, setIsImmediate] = useState(false);

  // timers for autoplay + resume
  const autoplayRef = useRef(null);
  const resumeRef = useRef(null);
  const isAnimatingRef = useRef(false);


  // Logical slide index (0..realCount-1) for dots, aria labels, etc.
  const logicalIndex = useMemo(() => {
    if (!realCount) return 0;
    if (index === 0) return realCount - 1; // leading clone => last real
    if (index === railCount - 1) return 0; // trailing clone => first real
    return index - 1; // normal case
  }, [index, realCount, railCount]);

  // Track transform: one slide = 100% of viewport width
  const trackStyle = useMemo(
    () => ({
      transform: `translateX(-${index * 100}%)`,
    }),
    [index]
  );

  // After an "instant jump" (snap), re-enable smooth transitions on next move
  useEffect(() => {
  if (!isImmediate) return;

  // If we're snapping instantly, there is no CSS transition,
  // so transitionend may not fire. Ensure we don't stay "locked".
  isAnimatingRef.current = false;

  const id = requestAnimationFrame(() => setIsImmediate(false));
  return () => cancelAnimationFrame(id);
}, [isImmediate]);


  // Helper: clear the autoplay interval
  const clearAutoplay = useCallback(() => {
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current);
      autoplayRef.current = null;
    }
  }, []);

  // Helper: start autoplay interval
const startAutoplay = useCallback(() => {
  if (!autoPlay || !realCount) return;

  clearAutoplay();

  autoplayRef.current = setInterval(() => {
    setIndex((prev) => {
      if (!railCount) return prev;

      // If we reached (or exceeded) the trailing clone,
      // snap to first real slide even if transitionend didn't fire.
      if (prev >= railCount - 1) {
        setIsImmediate(true);
        return 1;
      }

      setIsImmediate(false);
      return prev + 1;
    });
  }, intervalMs);
}, [autoPlay, realCount, railCount, intervalMs, clearAutoplay]);
  // Helper: schedule autoplay resume after inactivity
  const scheduleAutoplayResume = useCallback(() => {
    if (!autoPlay || !realCount) return;

    // clear any pending resume timeout
    if (resumeRef.current) {
      clearTimeout(resumeRef.current);
      resumeRef.current = null;
    }

    // wait a bit after last interaction, then restart autoplay
    resumeRef.current = setTimeout(() => {
      startAutoplay();
    }, AUTO_RESUME_DELAY);
  }, [autoPlay, realCount, startAutoplay]);

  // Initial autoplay setup + cleanup on unmount
  useEffect(() => {
    startAutoplay();
    return () => {
      clearAutoplay();
      if (resumeRef.current) {
        clearTimeout(resumeRef.current);
      }
    };
  }, [startAutoplay, clearAutoplay]);

  // === Navigation helpers (manual interaction) ===

  const handleNext = useCallback(() => {
  // Block spam while a transition is running
  if (isAnimatingRef.current) return;
  isAnimatingRef.current = true;

  // Stop autoplay immediately on user interaction (keeps your UX intention)
  clearAutoplay();

  setIndex((prev) => {
    if (!railCount) return prev;

    // Guard: if we're at (or beyond) the trailing clone, snap to first real
    if (prev >= railCount - 1) {
      setIsImmediate(true);
      return 1;
    }

    setIsImmediate(false);
    return prev + 1;
  });

  // Resume autoplay after inactivity delay (your existing behavior)
  scheduleAutoplayResume();
}, [railCount, clearAutoplay, scheduleAutoplayResume]);

  const handlePrev = useCallback(() => {
  if (isAnimatingRef.current) return;
  isAnimatingRef.current = true;

  clearAutoplay();

  setIndex((prev) => {
    if (!railCount) return prev;

    // Guard: if we're at (or beyond) the leading clone, snap to last real
    if (prev <= 0) {
      setIsImmediate(true);
      return realCount;
    }

    setIsImmediate(false);
    return prev - 1;
  });

  scheduleAutoplayResume();
}, [railCount, realCount, clearAutoplay, scheduleAutoplayResume]);

  const handleDotClick = useCallback((dotIdx) => {
  if (isAnimatingRef.current) return;
  isAnimatingRef.current = true;

  clearAutoplay();

  setIsImmediate(false);
  setIndex(dotIdx + 1); // +1 because index 1 == first real slide (clone rail)

  scheduleAutoplayResume();
}, [clearAutoplay, scheduleAutoplayResume]);


  const handleTransitionEnd = useCallback(() => {
    isAnimatingRef.current = false;

    if (!realCount) return;

    setIndex((prev) => {
      // If we just animated onto the leading clone (index 0), snap to last real slide
      if (prev === 0) {
        setIsImmediate(true);
        return realCount;
      }
      // If we just animated onto the trailing clone (last index), snap to first real slide
      if (prev === railCount - 1) {
        setIsImmediate(true);
        return 1;
      }
      return prev;
    });
  }, [realCount, railCount]);

  // 4. Build slide wrappers for the extended rail
  const slideWrappers = useMemo(
    () =>
      extendedSlides.map((slideDesc, i) => ({
        type: "div",
        key: slideDesc.key ?? `rail-${i}`,
        className: "hero-carousel__slide",
        attrs: {
          "aria-hidden": i === index ? "false" : "true",
        },
        children: [slideDesc],
      })),
    [extendedSlides, index]
  );

  // 5. Build dot descriptors for real slides only
  const dots = useMemo(
    () =>
      baseSlides.map((_, i) => ({
        type: "button",
        key: `dot-${i}`,
        className: [
          "hero-carousel__dot",
          i === logicalIndex ? "is-active" : "",
        ],
        attrs: {
          type: "button",
          "aria-label": `Go to slide ${i + 1}`,
        },
        events: {
          onClick: () => handleDotClick(i),
        },
      })),
    [baseSlides, logicalIndex, handleDotClick]
  );

  // 6. Whole carousel descriptor
  const carouselDesc = useMemo(
    () => ({
      type: "section",
      className: "hero-carousel",
      attrs: {
        role: "region",
        "aria-roledescription": "carousel",
        "aria-label": ariaLabel,
      },
      children: [
        {
          type: "div",
          className: "hero-carousel__viewport-wrapper",
          children: [
            {
              type: "div",
              className: [
                "hero-carousel__track",
                isImmediate ? "is-immediate" : "",
              ],
              style: trackStyle,
              events: {
                onTransitionEnd: handleTransitionEnd,
              },
              children: slideWrappers,
            },
          ],
        },
       {
  type: "div",
  className: "hero-carousel__controls",
  children: [
    {
      type: "button",
      className: "hero-carousel__control hero-carousel__control--prev",
      attrs: {
        type: "button",
        "aria-label": "Previous slide",
      },
      events: {
        onClick: handlePrev,
      },
      children: ["‹"],
    },
    {
      type: "button",
      className: "hero-carousel__control hero-carousel__control--next",
      attrs: {
        type: "button",
        "aria-label": "Next slide",
      },
      events: {
        onClick: handleNext,
      },
      children: ["›"],
    },
  ],
},

        {
          type: "div",
          className: "hero-carousel__dots",
          children: dots,
        },
      ],
    }),
    [
      ariaLabel,
      trackStyle,
      slideWrappers,
      dots,
      handlePrev,
      handleNext,
      handleTransitionEnd,
      isImmediate,
    ]
  );

  const api = useMemo(() => createNavApi({}), []);
  return buildElement(carouselDesc, api);
}

export default React.memo(Carousel);
