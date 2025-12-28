import React, { useEffect, useMemo, useRef, useState } from "react";
import baseImg from "../assets/notebook_spread_real_01.png";
import spriteImg from "../assets/pageflip_sprite_realistic_24f.png";
//import "./notebook-sprite.css";// moved to global CSS

/* ======================================================
   SPRITE FLIP ENGINE (PRODUCTION SAFE)
   - Buttons always clickable
   - No deadlock
   - No disabled logic bugs
   ====================================================== */
function useSpriteFlip({ pageCount, frames = 24, fps = 40 }) {
  const [index, setIndex] = useState(0);
  const [frame, setFrame] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [dir, setDir] = useState(null);

  const rafRef = useRef(null);
  const lastRef = useRef(0);

  const start = (direction) => {
    if (isFlipping) return;
    if (pageCount <= 1) return;

    setDir(direction);
    setIsFlipping(true);
    setFrame(0);
  };

  useEffect(() => {
    if (!isFlipping) return;

    const frameDuration = 1000 / fps;

    const tick = (ts) => {
      if (!lastRef.current) lastRef.current = ts;
      const delta = ts - lastRef.current;

      if (delta >= frameDuration) {
        lastRef.current = ts - (delta % frameDuration);

        setFrame((f) => {
          const next = f + 1;

          if (next >= frames) {
            setIndex((i) => {
              if (dir === "next") return Math.min(i + 1, pageCount - 1);
              if (dir === "prev") return Math.max(i - 1, 0);
              return i;
            });

            setIsFlipping(false);
            setDir(null);
            lastRef.current = 0;
            return 0;
          }
          return next;
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isFlipping, dir, frames, fps, pageCount]);

  return { index, frame, isFlipping, start };
}

/* ======================================================
   MAIN COMPONENT
   ====================================================== */
export default function FeaturesSketchbook() {
  /* BLANK PLACEHOLDER PAGES — SAFE FOR PRODUCTION */
  const pages = useMemo(
    () => [
      { id: "p1" },
      { id: "p2" },
      { id: "p3" },
      { id: "p4" },
      { id: "p5" },
    ],
    []
  );

  /* SPRITE CONFIG — 24 FRAMES (6 x 4 GRID) */
  const SPRITE = {
    url: spriteImg,
    frames: 24,
    cols: 6,
    rows: 4,
    frameW: 512,
    frameH: 512,
  };

  /* PAGE AREA ON NOTEBOOK PHOTO */
  const SPREAD = {
    left: "9%",
    top: "14%",
    width: "82%",
    height: "72%",
  };

  const { index, frame, isFlipping, start } = useSpriteFlip({
    pageCount: pages.length,
    frames: SPRITE.frames,
    fps: 40,
  });

  /* GRID FRAME MAPPING */
  const col = frame % SPRITE.cols;
  const row = Math.floor(frame / SPRITE.cols);
  const bgX = -(col * SPRITE.frameW);
  const bgY = -(row * SPRITE.frameH);

  return (
    <section className="nb-section">
      <div className="nb-stage">
        {/* NOTEBOOK BASE */}
        <img src={baseImg} alt="Notebook" className="nb-base" />

        {/* EMPTY CONTENT PLACEHOLDER */}
        <div className="nb-content" style={SPREAD}>
          <div className="nb-left">
            <div className="nb-placeholder" />
          </div>
          <div className="nb-right">
            <div className="nb-placeholder" />
          </div>
        </div>

        {/* SPRITE FLIP OVERLAY */}
        {isFlipping && (
          <div
            className="nb-flip"
            style={{
              ...SPREAD,
              backgroundImage: `url(${SPRITE.url})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: `${bgX}px ${bgY}px`,
              backgroundSize: `${SPRITE.frameW * SPRITE.cols}px ${
                SPRITE.frameH * SPRITE.rows
              }px`,
            }}
          />
        )}
      </div>

      {/* CONTROLS — ALWAYS CLICKABLE */}
      <div className="nb-controls">
        <button type="button" onClick={() => start("prev")}>
          ← Previous
        </button>

        <span>
          {index + 1} / {pages.length}
        </span>

        <button type="button" onClick={() => start("next")}>
          Next →
        </button>
      </div>
    </section>
  );
}
