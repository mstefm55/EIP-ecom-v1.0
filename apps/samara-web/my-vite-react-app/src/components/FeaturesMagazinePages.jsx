import React, { useMemo, useState } from "react";
//import "./FeaturesMagazineStack.css";// moved to global CSS

// OPTIONAL: later import real images (local or DB URLs)
// import runway1 from "../assets/runway-01.jpg";
// import top1 from "../assets/piece-top-01.png";

export default function FeaturesMagazineStack({ items: itemsProp }) {
  const items = useMemo(() => {
    return itemsProp?.length
      ? itemsProp
      : [
          {
            id: "01",
            eyebrow: "Editor’s pick",
            title: "Modern Fusion Set",
            subtitle: "Runway visual + decomposed pieces, like a magazine breakdown.",
            runwayImage: "", // set later (imported image or DB URL)
            pieces: [
              { id: "a", label: "Top", image: "" },
              { id: "b", label: "Trousers", image: "" },
              { id: "c", label: "Details", image: "" },
            ],
            meta: "PDF • A4/A0 • Layers",
            cta: "Open pattern",
          },
          {
            id: "02",
            eyebrow: "Bestseller",
            title: "Tailored Wide-Leg",
            subtitle: "Clean grading + studio notes. Quiet luxury layout.",
            runwayImage: "",
            pieces: [
              { id: "a", label: "Waist", image: "" },
              { id: "b", label: "Hem", image: "" },
              { id: "c", label: "Fit", image: "" },
            ],
            meta: "PDF • US • Layers",
            cta: "See details",
          },
          {
            id: "03",
            eyebrow: "New release",
            title: "Minimal Abaya Set",
            subtitle: "Premium finishing guidance, drafted for real bodies.",
            runwayImage: "",
            pieces: [
              { id: "a", label: "Outer", image: "" },
              { id: "b", label: "Inner", image: "" },
              { id: "c", label: "Sleeve", image: "" },
            ],
            meta: "PDF • A4 • Layers",
            cta: "Explore",
          },
        ];
  }, [itemsProp]);

  const [active, setActive] = useState(0);

  const leftCount = active; // already “turned”
  const rightCount = Math.max(0, items.length - active - 1); // remaining

  const prev = () => setActive((a) => Math.max(0, a - 1));
  const next = () => setActive((a) => Math.min(items.length - 1, a + 1));

  const current = items[active];

  return (
    <section className="magSection">
      <div className="magContainer">
        <header className="magHeader">
          <div className="magHeaderRow">
            <h2 className="magH2">Featured Patterns</h2>
            <div className="magKicker">EDITORIAL • PAGES • DEPTH</div>
          </div>
          <p className="magSub">
            Editorial layouts inspired by runway-to-pattern breakdowns. Crafted to feel
            like a magazine spread.
          </p>
        </header>

        <div className="magGrid">
          {/* LEFT: Scene (physical object) */}
          <div className="scene">
            {/* “table shadow” under whole object */}
            <div className="tableShadow" aria-hidden="true" />

            {/* Book object (global tilt + perspective) */}
            <div className="book" role="group" aria-label="Magazine stack">
              {/* Left stack thickness */}
              <div className="stack stackLeft" aria-hidden="true">
                {Array.from({ length: Math.min(leftCount, 10) }).map((_, i) => (
                  <span
                    key={i}
                    className="stackLeaf"
                    style={{
                      transform: `translateX(${i * 1.2}px) translateY(${i * 0.8}px)`,
                      opacity: 0.18 - i * 0.012,
                    }}
                  />
                ))}
              </div>

              {/* Right stack thickness */}
              <div className="stack stackRight" aria-hidden="true">
                {Array.from({ length: Math.min(rightCount, 10) }).map((_, i) => (
                  <span
                    key={i}
                    className="stackLeaf"
                    style={{
                      transform: `translateX(${-i * 1.2}px) translateY(${i * 0.8}px)`,
                      opacity: 0.18 - i * 0.012,
                    }}
                  />
                ))}
              </div>

              {/* Page (printed content) */}
              <article className="page">
                <div className="pageTop">
                  <div className="pageEyebrow">{current.eyebrow}</div>
                  <div className="pageNo">{current.id}</div>
                </div>

                <h3 className="pageTitle">{current.title}</h3>
                <p className="pageSubtitle">{current.subtitle}</p>

                <div className="spread">
                  {/* Runway side */}
                  <div className="runway">
                    <div className="photoFrame">
                      {current.runwayImage ? (
                        <img className="photoImg" src={current.runwayImage} alt="" />
                      ) : (
                        <div className="photoPlaceholder">RUNWAY / LOOKBOOK IMAGE</div>
                      )}
                    </div>
                    <div className="captionRow">
                      <span>Look</span>
                      <span className="caps">{current.eyebrow}</span>
                    </div>
                  </div>

                  {/* Breakdown side */}
                  <div className="breakdown">
                    <div className="piece pieceWide">
                      <Piece item={current.pieces?.[0]} />
                    </div>
                    <div className="piece">
                      <Piece item={current.pieces?.[1]} />
                    </div>
                    <div className="piece">
                      <Piece item={current.pieces?.[2]} />
                    </div>

                    <div className="ctaRow">
                      <button className="ctaBtn" type="button">
                        {current.cta}
                      </button>
                      <span className="meta">{current.meta}</span>
                    </div>
                  </div>
                </div>
              </article>

              {/* Click zones */}
              <button
                type="button"
                className="navZone navPrev"
                onClick={prev}
                disabled={active === 0}
                aria-label="Previous page"
                title="Previous"
              />
              <button
                type="button"
                className="navZone navNext"
                onClick={next}
                disabled={active === items.length - 1}
                aria-label="Next page"
                title="Next"
              />
            </div>

            {/* Small nav */}
            <div className="pager">
              <button className="pagerBtn" onClick={prev} disabled={active === 0}>
                ← Prev
              </button>
              <div className="pagerMid">
                {active + 1} / {items.length}
              </div>
              <button
                className="pagerBtn"
                onClick={next}
                disabled={active === items.length - 1}
              >
                Next →
              </button>
            </div>
          </div>

          {/* RIGHT: Notes */}
          <aside className="notes">
            <div className="notesKicker">STUDIO NOTES</div>
            <h3 className="notesTitle">Magazine breakdown cards</h3>
            <p className="notesText">
              This version is built like a photographed object: one light source, one
              shadow plane, paper thickness edges, and a clean editorial colour palette.
            </p>

            <ul className="notesList">
              <li>Real paper depth (edges + stack), not “UI cards”</li>
              <li>Global lighting & table shadow</li>
              <li>DB-ready content model (array of objects)</li>
            </ul>

            <div className="tags">
              <span className="tag">quiet luxury</span>
              <span className="tag">editorial</span>
              <span className="tag">pattern-first</span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Piece({ item }) {
  const label = item?.label || "Piece";
  const img = item?.image || "";

  return (
    <div className="pieceInner">
      {img ? <img className="photoImg" src={img} alt={label} /> : null}
      {!img ? <div className="piecePlaceholder" /> : null}
      <div className="pieceTag">{label.toUpperCase()}</div>
    </div>
  );
}
