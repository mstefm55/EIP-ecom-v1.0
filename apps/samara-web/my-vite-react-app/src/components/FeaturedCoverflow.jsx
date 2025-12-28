import React, { useEffect, useMemo, useRef, useState } from "react";
//import "./FeaturedCoverflow.css";// moved to global CSS

/**
 * 3D Coverflow (circular)
 * - center card is in focus (front)
 * - side cards are angled + pushed back + blurred
 * - scroll/drag/buttons move left/right
 * - content is data-driven (DB-ready)
 */
export default function FeaturedCoverflow({ items: itemsProp }) {
  const items = useMemo(
    () =>
      itemsProp?.length
        ? itemsProp
        : [
            {
              id: "p1",
              title: "Featured Pattern 01",
              subtitle: "Editorial spread layout • placeholder",
              cover: null, // later: import or URL
            },
            {
              id: "p2",
              title: "Featured Pattern 02",
              subtitle: "Runway → pieces breakdown • placeholder",
              cover: null,
            },
            {
              id: "p3",
              title: "Featured Pattern 03",
              subtitle: "Layered PDF • Studio notes • placeholder",
              cover: null,
            },
            {
              id: "p4",
              title: "Featured Pattern 04",
              subtitle: "Quiet luxury styling • placeholder",
              cover: null,
            },
            {
              id: "p5",
              title: "Featured Pattern 05",
              subtitle: "Modern silhouette • placeholder",
              cover: null,
            },
          ],
    [itemsProp]
  );

  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(1); // +1 next, -1 prev (used for subtle directional feel)
  const rootRef = useRef(null);

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const mod = (n, m) => ((n % m) + m) % m;

  // shortest signed distance from active to index (circular)
  const rel = (index) => {
    const n = items.length;
    let d = index - active;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d; // negative: left, positive: right
  };

  const go = (step) => {
    if (!items.length) return;
    setDir(step > 0 ? 1 : -1);
    setActive((a) => mod(a + step, items.length));
  };

  // Wheel/trackpad horizontal-friendly: shift + wheel or trackpad two-axis
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    let acc = 0;
    let last = 0;

    const onWheel = (e) => {
      // allow normal page scroll when user isn't over the slider
      // (we only handle if intent looks horizontal-ish)
      const dx = Math.abs(e.deltaX);
      const dy = Math.abs(e.deltaY);
      const horizontalIntent = dx > dy || e.shiftKey;

      if (!horizontalIntent) return;

      e.preventDefault();

      const now = performance.now();
      if (now - last > 250) acc = 0;
      last = now;

      // accumulate, then step
      const delta = e.shiftKey ? e.deltaY : e.deltaX;
      acc += delta;

      if (acc > 110) {
        acc = 0;
        go(1);
      } else if (acc < -110) {
        acc = 0;
        go(-1);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [items.length]);

  // Drag / swipe
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    let startX = 0;
    let dragging = false;

    const onDown = (e) => {
      dragging = true;
      startX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      el.classList.add("isDragging");
    };

    const onMove = (e) => {
      if (!dragging) return;
      const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const dx = x - startX;

      // threshold
      if (dx > 40) {
        dragging = false;
        el.classList.remove("isDragging");
        go(-1);
      } else if (dx < -40) {
        dragging = false;
        el.classList.remove("isDragging");
        go(1);
      }
    };

    const onUp = () => {
      dragging = false;
      el.classList.remove("isDragging");
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    // touch fallback
    el.addEventListener("touchstart", onDown, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      el.removeEventListener("touchstart", onDown);
      el.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [items.length]);

  return (
    <section className="fcSection">
      <div className="fcContainer">
        <div className="fcHead">
          <h2 className="fcTitle">Featured</h2>
          <p className="fcSub">
            Scroll / drag left-right. Center page comes forward in focus; side pages
            tilt back. Circular loop.
          </p>
        </div>

        <div className="fcStage" ref={rootRef} aria-label="Featured coverflow slider">
          {/* soft ground shadow */}
          <div className="fcGround" aria-hidden="true" />

          <div className="fcPerspective">
            {items.map((it, i) => {
              const d = rel(i);
              const abs = Math.abs(d);
              const side = d === 0 ? 0 : d > 0 ? 1 : -1;

              // limit how many are visible (matches your screenshot feel)
              const visible = abs <= 3;

              // --- 3D placement ---
              // push away (Z) as it goes to sides
              // Stronger depth separation so the active page fully dominates
              const z = abs === 0 ? 310 : 180 - abs * 85;

              // spread in X
              const x = d * 260;
              // rotate Y
              const rotY = side * (abs === 0 ? 0 : 28 + abs * 6);
              // slight scale drop
              const scale = 1 - abs * 0.08;
              // blur out-of-focus
             const blur = abs === 0 ? 0 : 2.4;


              // opacity drop
              const opacity = abs === 0 ? 1 : 0.62;



              // zIndex: center highest, then closer ones
              const zIndex = 100 - abs * 10;

              // direction nuance: the “going back” side gets a touch more depth during motion
              const dirBias = side === dir ? -14 : 0; // subtle
              const zFinal = z + dirBias;

              const style = {
         transform: `translateX(${x}px) translateZ(${zFinal}px) rotateY(${rotY}deg) scale(${scale})`,
                filter: `blur(${blur}px)`,
                opacity,
                zIndex,
              
                pointerEvents: d === 0 ? "auto" : "auto", // allow clicking side to jump
              };

              return (
                <button
                  key={it.id ?? i}
                  className={`fcCard ${d === 0 ? "isActive" : ""} ${visible ? "" : "isHidden"}`}
                  style={style}
                  onClick={() => {
                    // click any visible card to bring it to center (shortest)
                    if (d === 0) return;
                    setDir(d > 0 ? 1 : -1);
                    setActive(mod(active + d, items.length));
                  }}
                  type="button"
                  aria-label={`Open ${it.title}`}
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

                    <div className="fcText">
                      <div className="fcH">{it.title}</div>
                      <div className="fcP">{it.subtitle}</div>
                    </div>

                    <div className="fcFooter">
                      <span className="fcChip">PDF</span>
                      <span className="fcChip">A4/A0</span>
                      <span className="fcChip">LAYERED</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <button className="fcNav fcPrev" type="button" onClick={() => go(-1)} aria-label="Previous">
            ‹
          </button>
          <button className="fcNav fcNext" type="button" onClick={() => go(1)} aria-label="Next">
            ›
          </button>
        </div>
      </div>
    </section>
  );
}
