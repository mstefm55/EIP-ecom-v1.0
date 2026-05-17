import React, { useEffect, useMemo, useRef, useState } from "react";
import "./FeaturedCoverflow.css";

function mod(n, m) {
  return ((n % m) + m) % m;
}

export default function FeaturedCoverflow({
  items: itemsProp,
  compact = false,
  ariaLabel = "Featured coverflow slider",
  autoPlay = true,
  intervalMs = 5500,
  showActiveDetails = false,
  theme = "noir",
  onActiveClick,
}) {
  const items = useMemo(
    () =>
      itemsProp?.length
        ? itemsProp
        : [
            {
              id: "p1",
              title: "Featured Pattern 01",
              subtitle: "Editorial spread layout - placeholder",
              cover: null,
            },
            {
              id: "p2",
              title: "Featured Pattern 02",
              subtitle: "Runway to pieces breakdown - placeholder",
              cover: null,
            },
            {
              id: "p3",
              title: "Featured Pattern 03",
              subtitle: "Layered PDF studio notes - placeholder",
              cover: null,
            },
            {
              id: "p4",
              title: "Featured Pattern 04",
              subtitle: "Quiet luxury styling - placeholder",
              cover: null,
            },
            {
              id: "p5",
              title: "Featured Pattern 05",
              subtitle: "Modern silhouette - placeholder",
              cover: null,
            },
          ],
    [itemsProp]
  );

  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(1);
  const rootRef = useRef(null);
  const lastManualAtRef = useRef(0);
  const wheelLockUntilRef = useRef(0);

  const minInterval = Math.max(2200, Number(intervalMs) || 5500);
  const pauseAfterManualMs = Math.max(minInterval, 5500);

  useEffect(() => {
    if (!items.length) return;
    setActive((prev) => mod(prev, items.length));
  }, [items.length]);

  const rel = (index) => {
    const n = items.length;
    if (n <= 1) return 0;
    let d = index - active;
    if (n % 2 === 0 && Math.abs(d) === n / 2) {
      return (dir || 1) * (n / 2);
    }
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  };

  const markManual = () => {
    lastManualAtRef.current = Date.now();
    wheelLockUntilRef.current = Date.now() + 260;
  };

  const go = (step, manual = false) => {
    if (!items.length) return;
    if (manual) markManual();
    setDir(step > 0 ? 1 : -1);
    setActive((a) => mod(a + step, items.length));
  };

  useEffect(() => {
    if (!autoPlay || items.length < 2) return undefined;
    const id = setInterval(() => {
      if (Date.now() - lastManualAtRef.current < pauseAfterManualMs) return;
      go(1, false);
    }, minInterval);
    return () => clearInterval(id);
  }, [autoPlay, items.length, minInterval, pauseAfterManualMs]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;

    let acc = 0;
    let last = 0;

    const onWheel = (e) => {
      if (Date.now() < wheelLockUntilRef.current) return;
      const dx = Math.abs(e.deltaX);
      const dy = Math.abs(e.deltaY);
      const horizontalIntent = dx > dy || e.shiftKey;
      if (!horizontalIntent) return;

      e.preventDefault();

      const now = performance.now();
      if (now - last > 250) acc = 0;
      last = now;

      const delta = e.shiftKey ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 2) return;

      if ((acc > 0 && delta < 0) || (acc < 0 && delta > 0)) {
        acc = 0;
      }
      acc += delta;

      if (acc > 110) {
        acc = 0;
        wheelLockUntilRef.current = Date.now() + 260;
        go(1, true);
      } else if (acc < -110) {
        acc = 0;
        wheelLockUntilRef.current = Date.now() + 260;
        go(-1, true);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [items.length]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;

    let startX = 0;
    let dragging = false;

    const onDown = (e) => {
      dragging = true;
      startX = e.clientX ?? 0;
      el.classList.add("isDragging");
      markManual();
    };

    const onMove = (e) => {
      if (!dragging) return;
      const x = e.clientX ?? 0;
      const dx = x - startX;

      if (dx > 40) {
        dragging = false;
        el.classList.remove("isDragging");
        go(-1, true);
      } else if (dx < -40) {
        dragging = false;
        el.classList.remove("isDragging");
        go(1, true);
      }
    };

    const onUp = () => {
      dragging = false;
      el.classList.remove("isDragging");
      markManual();
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [items.length]);

  return (
    <div className={`fcEmbed ${compact ? "is-compact" : ""} fcTheme--${theme}`}>
      <div className={`fcStage ${compact ? "fcStage--compact" : ""}`} ref={rootRef} aria-label={ariaLabel}>
        <div className="fcGround" aria-hidden="true" />

        <div className="fcPerspective">
          {items.map((it, i) => {
            const d = rel(i);
            const abs = Math.abs(d);
            const side = d === 0 ? 0 : d > 0 ? 1 : -1;
            const visible = abs <= 3;

            const z = abs === 0 ? 310 : 180 - abs * 85;
            const x = d * (compact ? 215 : 290);
            const rotY = side * (abs === 0 ? 0 : 28 + abs * 6);
            const scale = 1 - abs * (compact ? 0.07 : 0.08);
            const blur = abs === 0 ? 0 : 2.4;
            const opacity = abs === 0 ? 1 : 0.62;
            const zIndex = 100 - abs * 10;
            const dirBias = side === dir ? -14 : 0;
            const zFinal = z + dirBias;

            const style = {
              transform: `translateX(${x}px) translateZ(${zFinal}px) rotateY(${rotY}deg) scale(${scale})`,
              filter: `blur(${blur}px)`,
              opacity,
              zIndex,
            };

            return (
              <button
                key={it.id ?? i}
                className={`fcCard ${compact ? "fcCard--compact" : ""} ${d === 0 ? "isActive" : ""} ${visible ? "" : "isHidden"}`}
                style={style}
                onClick={() => {
                  if (d === 0) {
                    if (typeof onActiveClick === "function") onActiveClick(it, i);
                    return;
                  }
                  markManual();
                  setDir(d > 0 ? 1 : -1);
                  setActive((prev) => mod(prev + d, items.length));
                }}
                type="button"
                aria-label={`Open ${it.title || `Slide ${i + 1}`}`}
              >
                <div className="fcCardInner">
                  <div className="fcCardTop">
                    <div className="fcEyebrow">FEATURED</div>
                    <div className="fcNum">{String(i + 1).padStart(2, "0")}</div>
                  </div>

                  <div className="fcCover">
                    {it.cover ? (
                      <img className="fcImg" src={it.cover} alt="" />
                    ) : (
                      <div className="fcCoverPh">COVER IMAGE</div>
                    )}
                  </div>

                  {!compact ? (
                    <>
                      <div className="fcText">
                        <div className="fcH">{it.title}</div>
                        <div className="fcP">{it.subtitle}</div>
                      </div>

                      <div className="fcFooter">
                        <span className="fcChip">PDF</span>
                        <span className="fcChip">A4/A0</span>
                        <span className="fcChip">LAYERED</span>
                      </div>
                    </>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        <button className="fcNav fcPrev" type="button" onClick={() => go(-1, true)} aria-label="Slide left">
          &lt;
        </button>
        <button className="fcNav fcNext" type="button" onClick={() => go(1, true)} aria-label="Slide right">
          &gt;
        </button>

        {!compact && showActiveDetails ? (
          <div className="fcActivePanel" aria-live="polite">
            <span className="fcActiveKicker">Pattern spotlight</span>
            <h3>{items[active]?.title || "Featured pattern"}</h3>
            <p>{items[active]?.subtitle || ""}</p>
            {items[active]?.price ? <span className="fcActivePrice">{items[active].price}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
