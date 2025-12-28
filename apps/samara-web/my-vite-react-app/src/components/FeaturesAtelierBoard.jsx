import React, { useMemo } from "react";
import heroImg from "../assets/sketch4.jpeg";
import img01 from "../assets/sketch5.jpeg";
import img02 from "../assets/sketch6.jpeg";
import img03 from "../assets/sketch7.jpeg";
import img04 from "../assets/download.jpeg";
import img05 from "../assets/download (1).jpeg";


/**
 * FeaturesAtelierBoard (V2)
 * Editorial atelier collage adapted for web + DB
 * - No "cards" look
 * - Intentional asymmetry like magazine layouts
 * - Works with empty placeholders
 */
export default function FeaturesAtelierBoard({
  heading = "Studio Features",
  subheading = "A pattern library curated like a fashion magazine—clean, layered, and ready to sew.",
  items: itemsProp,
}) {
  const items = useMemo(() => {
    // Replace later with DB data (same shape).
    return itemsProp?.length
      ? itemsProp
      : [
          { id: "a", type: "hero", tag: "Pattern Library", title: "Curated releases", note: "Editorial selection—no clutter.", imageUrl: heroImg},
          { id: "b", type: "tile", tag: "Layered PDFs", title: "Print only what you need", note: "Size layers, A4/A0/US.", imageUrl: img01 },
          { id: "c", type: "tile", tag: "Fit-first", title: "Drafted for real bodies", note: "Clean grading & guidance.", imageUrl: "" },
          { id: "d", type: "tileTall", tag: "Studio Notes", title: "Construction clarity", note: "Steps that feel premium.", imageUrl: "" },
          { id: "e", type: "tile", tag: "Instant Download", title: "No waiting", note: "Access anytime.", imageUrl: "" },
          { id: "f", type: "tileWide", tag: "Design DNA", title: "Modern silhouettes", note: "Timeless + wearable.", imageUrl: "" },
        ];
  }, [itemsProp]);

  // Grid roles
  const hero = items.find((x) => x.type === "hero") ?? items[0];
  const small = items.filter((x) => x.id !== hero.id);

  const Img = ({ imageUrl, alt = "" }) => {
    if (imageUrl) {
      return (
        <img
          src={imageUrl}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      );
    }
    // Placeholder = “editorial paper” feel (no ugly gray box)
    return (
      <div className="absolute inset-0">
        <div className="h-full w-full bg-gradient-to-br from-black/[0.06] via-black/[0.02] to-black/[0.05]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:10px_10px]" />
      </div>
    );
  };

  return (
    <section className="w-full px-4 md:px-8 py-14 md:py-20">
      <div className="mx-auto max-w-6xl">
        {/* Header (magazine) */}
        <div className="mb-10 md:mb-12">
          <div className="flex items-end justify-between gap-6">
            <h2 className="font-serif text-3xl md:text-5xl tracking-tight">
              {heading}
            </h2>
            <div className="hidden md:block text-xs uppercase tracking-[0.28em] opacity-60">
              atelier • editorial • patterns
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-base md:text-lg opacity-75 leading-relaxed">
            {subheading}
          </p>
        </div>

        {/* Atelier Board */}
        <div className="relative">
          {/* faint vertical guides (like magazine columns) */}
          <div className="pointer-events-none absolute inset-0 hidden md:grid grid-cols-12 gap-6 opacity-[0.10]">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="border-l border-black/20" />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
            {/* HERO BLOCK */}
            <article className="lg:col-span-7 relative overflow-hidden rounded-[2px] border border-black/10 bg-white">
              <div className="relative h-[420px] md:h-[560px]">
                <Img imageUrl={hero.imageUrl} alt={hero.title} />
                {/* soft editorial overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              </div>

              <div className="absolute left-6 right-6 bottom-6 md:left-8 md:right-8 md:bottom-8 text-white">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                  {hero.tag}
                </div>
                <h3 className="mt-3 font-serif text-2xl md:text-4xl tracking-tight">
                  {hero.title}
                </h3>
                <p className="mt-2 max-w-xl text-white/85 text-sm md:text-base leading-relaxed">
                  {hero.note}
                </p>

                <div className="mt-5 flex items-center gap-3">
                  <button className="rounded-2xl bg-white text-black px-5 py-2.5 text-sm md:text-base font-medium">
                    Explore
                  </button>
                  <button className="rounded-2xl bg-white/10 text-white px-5 py-2.5 text-sm md:text-base font-medium backdrop-blur">
                    See details
                  </button>
                </div>
              </div>
            </article>

            {/* RIGHT COLUMN: editorial tiles (asymmetric) */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-4">
              {small.map((it, idx) => {
                const shape =
                  it.type === "tileTall"
                    ? "row-span-2 h-[280px] md:h-[320px]"
                    : it.type === "tileWide"
                    ? "col-span-2 h-[190px] md:h-[210px]"
                    : "h-[160px] md:h-[180px]";

                return (
                  <article
                    key={it.id}
                    className={`relative overflow-hidden rounded-[2px] border border-black/10 bg-white ${shape}`}
                  >
                    <div className="absolute inset-0">
                      <Img imageUrl={it.imageUrl} alt={it.title} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                    </div>

                    <div className="absolute left-4 right-4 bottom-4 text-white">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/85">
                        {it.tag}
                      </div>
                      <div className="mt-1 font-serif text-lg md:text-xl leading-snug">
                        {it.title}
                      </div>
                      <div className="mt-1 text-xs md:text-sm text-white/80 leading-snug line-clamp-2">
                        {it.note}
                      </div>
                    </div>

                    {/* tiny “magazine” corner mark */}
                    <div className="absolute right-4 top-4 text-[11px] text-white/70 tracking-widest">
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Bottom “caption line” like a magazine footer */}
          <div className="mt-8 md:mt-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.26em] opacity-60">
              Designed for print • draft clarity • modern fit
            </div>
            <div className="text-sm opacity-70">
              Tip: This whole board can be fed from your admin DB—no code edits.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
